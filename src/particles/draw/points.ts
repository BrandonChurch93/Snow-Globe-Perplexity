import * as THREE from 'three'
import { config } from '../../config'
import { coverUniforms } from '../../core/chunks/cover'
import { veilSettle } from '../../core/chunks/veil'
import { handleOf, stageShader, type Rgb } from '../../core/materials'
import { sampleSdf } from '../../core/sdf'
import type { ParticleSource, SdfGrid } from '../../core/stage'
import { texture } from '../../core/textures'
import { partBytes } from '../../diagnostics/views'
import type { StageFrame } from '../../scene/frame'
import { flickerOf, gridInfo } from '../../scene/lightgrid'
import type { InnerLight } from '../../seasons/kit'
import { BATS, CARD, LAMPS, LENS_LOOK, LIGHT_LOOK, LOBE_TABLE, LYING_LOOK, MAX_KINDS, SEED_RESTS, SETTLE_SHOWN, SHAPE, STORM_BLOOM, lookOf, SEED_NEAR } from './looks'
import { BEHAVIOUR } from '../engine/kinds'
import { FRAG, VERT_MAIN, VERT_PARS } from './shader'
import { downAtlas } from './down'

export { MAX_KINDS } from './looks'
export const SIZE_TO_RADIUS = 0.5
/** The state the draw gives a seed that lies at one of the scene's places: between the engine's two states of rest, so the card lies, and is known. */
const STATE_LAID = 1.5
/** The state the draw gives a seed that is the storm's glow round one of the lights inside (looks.ts, STORM_BLOOM): afloat, and known. */
export const STATE_GLOW = 0.25
const NO_LIGHTS: readonly InnerLight[] = []
const SHUTTER = (config.film.shutterDegrees / 360) * (config.sim.stepHz / config.film.fps)
const TAU = 2 * Math.PI

type KindColors = Readonly<Record<string, { color: Rgb; glow: number }>>

/** The engine keeps each season's scene as it is made, a grid of distances; the draw asks it where the laid heads sit. A source that keeps no scene leaves the list as it stands. */
type SceneSource = ParticleSource & { colliderOf?(season: string): SdfGrid }
type Seat = readonly number[]
const seatsMade = new WeakMap<SdfGrid, readonly Seat[]>()

/** The laid heads' seats on a scene as it is made: a seat of the tree's crown is moved along its column onto the surface the collider has under it, with that surface's own slope; the others stand as listed (looks.ts, SEED_RESTS.follow). Found once for a scene. */
export function seatsOn(g: SdfGrid): readonly Seat[] {
  const made = seatsMade.get(g)
  if (made) return made
  const F = SEED_RESTS.follow
  const half = g.sizeMm / 2
  const cell = g.sizeMm / (g.n - 1)
  const fine = 0.25 * cell
  const slopeAt = (x: number, y: number, z: number): [number, number, number] => {
    const e = 0.5 * cell
    const gx = sampleSdf(g, x + e, y, z) - sampleSdf(g, x - e, y, z)
    const gy = sampleSdf(g, x, y + e, z) - sampleSdf(g, x, y - e, z)
    const gz = sampleSdf(g, x, y, z + e) - sampleSdf(g, x, y, z - e)
    const l = Math.hypot(gx, gy, gz)
    return l > 1e-6 ? [gx / l, gy / l, gz / l] : [0, 1, 0]
  }
  // the first surface down a column from the top of the liquid, or null where the column begins inside a thing or meets nothing
  const drop = (x: number, z: number): number | null => {
    const from = Math.sqrt(Math.max(0.96 * half * half - x * x - z * z, 0))
    if (sampleSdf(g, x, from, z) <= 0) return null
    for (let y = from; y > -half; y -= fine) {
      if (sampleSdf(g, x, y - fine, z) > 0) continue
      let free = y
      let solid = y - fine
      for (let k = 0; k < 8; k++) {
        const mid = 0.5 * (free + solid)
        if (sampleSdf(g, x, mid, z) > 0) free = mid
        else solid = mid
      }
      return free
    }
    return null
  }
  const out = SEED_RESTS.at.map((place, i): Seat => {
    if (i < F.crown[0] || i >= F.crown[1]) return place
    let best: Seat = place
    let most = -Infinity
    // the column itself, a ring of six at half the reach and a ring of six at the whole of it
    for (let c = 0; c < 13; c++) {
      const ring = c === 0 ? 0 : c <= 6 ? 0.5 : 1
      const turn = ((c - 1) / 6) * TAU + (c > 6 ? TAU / 12 : 0)
      const x = place[0] + ring * F.seek * Math.cos(turn)
      const z = place[2] + ring * F.seek * Math.sin(turn)
      const y = drop(x, z)
      if (y === null) continue
      const s = slopeAt(x, y, z)
      const level = s[1] - F.near * ring
      if (level > most) {
        most = level
        best = [x, y + F.rise, z, s[0], s[1], s[2], place[6]]
      }
    }
    return best
  })
  seatsMade.set(g, out)
  return out
}

/** The largest point a machine must draw for the film's sprites to hold every shape: SwiftShader's, 1023 px. */
export const SPRITE_POINT_PX = 1023
/** The half side a quad is cut to, the same on every machine: a quad has no machine limit. */
export const QUAD_HALF_PX = 512
/**
 * Which mesh draws the particles, and the half side a shape is cut to. A point sprite is cut to the machine's
 * largest point (256 px on Mesa's software renderers), and the cut is a square edge in the picture. So the film
 * path keeps its sprites only where the machine's largest point is SPRITE_POINT_PX or more, and otherwise draws
 * the quads the live app draws.
 */
export function pointMesh(live: boolean, maxPointPx: number): { quads: boolean; halfPx: number } {
  const quads = live || maxPointPx < SPRITE_POINT_PX
  return { quads, halfPx: quads ? QUAD_HALF_PX : Math.max(4, maxPointPx / 2) }
}

export class ParticleDraw {
  readonly points = new THREE.Group()
  private readonly sprites: THREE.Points
  private readonly quads: THREE.Mesh
  private readonly uniforms: Record<string, THREE.IUniform>
  private readonly corners = new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)
  private readonly order = new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1)
  private single: THREE.BufferAttribute[] = []
  private instanced: THREE.BufferAttribute[] = []
  private arrays: Float32Array[] = []
  private capacity = 0
  private readonly bounds: THREE.Sphere
  private readonly phases = new Map<number, Float32Array>()
  private readonly back = new THREE.Vector3()
  private readonly right = new THREE.Vector3()
  private readonly up = new THREE.Vector3()
  private cover: boolean | null = null
  private storm = 0
  private shown = 1
  private paced = 0
  private afloat = 0
  private seats: readonly Seat[] = SEED_RESTS.at
  private glows: readonly InnerLight[] = NO_LIGHTS
  private solid: SdfGrid | null = null
  private glowAt: readonly [number, number] = [0, 1]
  drawn = 0
  maxPointPx = 256

  constructor(radiusMm: number) {
    this.uniforms = {
      ...coverUniforms,
      uPoint: { value: new THREE.Vector4(1, 1, 0, 1) },
      uStorm: { value: new THREE.Vector4() },
      uAperture: { value: new THREE.Vector4(0, 0, 0, 0) },
      uEyeShift: { value: new THREE.Vector3() },
      uWhole: { value: 0 },
      uBlur: { value: new THREE.Vector4() },
      uLying: { value: new THREE.Vector4(LYING_LOOK.flat, LYING_LOOK.lobe, LYING_LOOK.mergeFromMm, LYING_LOOK.mergeToMm) },
      uLimit: { value: new THREE.Vector4(1, 1, LYING_LOOK.mergeSpread, LYING_LOOK.glitterTilt) },
      uTone: { value: new THREE.Vector4(LIGHT_LOOK.wrap, LIGHT_LOOK.grid, LIGHT_LOOK.veilShare, 0) },
      uUpLocal: { value: new THREE.Vector3(0, 1, 0) },
      uLamp: { value: Array.from({ length: LAMPS }, () => new THREE.Vector4()) },
      uLampCol: { value: Array.from({ length: LAMPS }, () => new THREE.Vector4(0, 0, 0, 1)) },
      uLobes: { value: null as THREE.Texture | null },
      uLobeRows: { value: 1 },
      uDown: { value: downAtlas() },
      uPointChange: { value: 0 },
      uKindColor: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
      uKindPart: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
      uKindLook: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
      uKindWay: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
      uBat: { value: Array.from({ length: BATS }, () => new THREE.Vector4()) },
    }
    this.bounds = new THREE.Sphere(new THREE.Vector3(), radiusMm)
    this.sprites = new THREE.Points(new THREE.BufferGeometry(), this.material(true))
    this.quads = new THREE.Mesh(new THREE.InstancedBufferGeometry(), this.material(false))
    for (const o of [this.sprites, this.quads]) {
      o.frustumCulled = false
      o.renderOrder = 5
      this.points.add(o)
    }
    this.allocate(1)
  }

  private material(sprites: boolean): THREE.ShaderMaterial {
    const m = stageShader({
      part: 'particle-engine',
      standIn: false,
      uniforms: this.uniforms,
      vertexPars: VERT_PARS,
      vertexMain: VERT_MAIN,
      fragment: FRAG,
      params: { side: THREE.DoubleSide, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation },
    })
    handleOf(m).uFlags.value.z = 1
    if (sprites) m.defines.POINT_SPRITES = 1
    return m
  }

  private allocate(count: number): void {
    this.capacity = count
    this.arrays = [3, 3, 4, 1].map((size) => new Float32Array(count * size))
    const sizes = [3, 3, 4, 1]
    this.single = this.arrays.map((a, i) => new THREE.BufferAttribute(a, sizes[i]!).setUsage(THREE.DynamicDrawUsage))
    this.instanced = this.arrays.map((a, i) => new THREE.InstancedBufferAttribute(a, sizes[i]!).setUsage(THREE.DynamicDrawUsage))
    const names = ['aNow', 'aPrev', 'aData', 'aState']
    const flat = new THREE.BufferGeometry()
    const quad = new THREE.InstancedBufferGeometry()
    quad.setIndex(this.order)
    quad.setAttribute('position', this.corners)
    names.forEach((name, i) => {
      flat.setAttribute(i === 0 ? 'position' : name, this.single[i]!)
      quad.setAttribute(name, this.instanced[i]!)
    })
    flat.boundingSphere = this.bounds
    quad.boundingSphere = this.bounds
    this.sprites.geometry.dispose()
    this.quads.geometry.dispose()
    this.sprites.geometry = flat
    this.quads.geometry = quad
  }

  private phaseOf(count: number): Float32Array {
    let p = this.phases.get(count)
    if (!p) {
      p = new Float32Array(count)
      let s = (config.seed ^ 0x9e3779b9) >>> 0
      for (let i = 0; i < count; i++) {
        s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + i) >>> 0
        s = Math.imul(s ^ (s >>> 12), 0x297a2d39) >>> 0
        p[i] = (((s ^ (s >>> 15)) >>> 0) / 4294967296) * TAU
      }
      this.phases.clear()
      this.phases.set(count, p)
    }
    return p
  }

  frame(source: ParticleSource, f: StageFrame): void {
    this.points.visible = f.view !== 'flow' && f.view !== 'lightgrid'
    const mesh = pointMesh(f.live, this.maxPointPx)
    this.sprites.visible = !mesh.quads
    this.quads.visible = mesh.quads
    const gate = Math.min(1, Math.max(0, (f.turbulence - LENS_LOOK.stormFrom) / (LENS_LOOK.stormTo - LENS_LOOK.stormFrom)))
    const stormy = f.live || f.view === 'cover' || (f.sample !== null && f.view === '')
    this.storm = stormy ? gate * gate * (3 - 2 * gate) : 0
    this.seats = this.seatsFor(source, f)
    this.glows = this.glowsFor(source, f)
    this.solid = this.solidFor(source, f)
    this.glowAt = [f.time, f.period]
    this.fill(source, f.quality.particleFraction, mesh.quads, f.moment.mix)
    this.shown = stormy ? Math.min(1, SETTLE_SHOWN / Math.max(this.afloat, 1e-3)) : 1
    this.paced = stormy ? 1 : 0
    veilSettle(this.afloat)
    this.lens(f)
    this.lights(f)
    this.kinds(source, f.from.particles, f.to.particles, f.kinds, f.mix.particles)
    this.uniforms.uPointChange!.value = f.mix.particles
    const cover = f.view === 'cover'
    if (cover !== this.cover) {
      this.cover = cover
      for (const o of [this.sprites, this.quads]) {
        const m = o.material as THREE.ShaderMaterial
        m.blendSrc = cover ? THREE.DstAlphaFactor : THREE.OneFactor
        m.blendDst = THREE.OneMinusSrcAlphaFactor
        m.blendSrcAlpha = cover ? THREE.ZeroFactor : null
        m.blendDstAlpha = cover ? THREE.OneFactor : null
      }
    }
  }

  /** Where the laid heads sit: on the scene of the season whose kind they are, as the engine has it made; as listed when the source keeps no scene. */
  private seatsFor(source: ParticleSource, f: StageFrame): readonly Seat[] {
    const scene = source as SceneSource
    if (!scene.colliderOf || this.storm >= SEED_RESTS.until) return SEED_RESTS.at
    const seed = source.kinds.find((kind) => lookOf(kind).shape === SHAPE.seed)
    if (seed === undefined) return SEED_RESTS.at
    return seatsOn(scene.colliderOf(seed in f.to.particles ? f.to.season : f.from.season))
  }

  /** The lights inside that the storm's haze glows round: those of the season whose kind the seeds are. */
  private glowsFor(source: ParticleSource, f: StageFrame): readonly InnerLight[] {
    const seed = source.kinds.find((kind) => lookOf(kind).shape === SHAPE.seed)
    if (seed === undefined) return NO_LIGHTS
    return (seed in f.to.particles ? f.to : f.from).innerLights
  }

  /** What the seeds can snag on: the scene of the season whose kind they are, as the stage has it made. None in the storm at its full, where no seed is asked how near it is (looks.ts, SEED_NEAR). */
  private solidFor(source: ParticleSource, f: StageFrame): SdfGrid | null {
    if (this.storm >= SEED_NEAR.stormOff[1]) return null
    const seed = source.kinds.find((kind) => lookOf(kind).shape === SHAPE.seed)
    if (seed === undefined) return null
    return gridInfo(f.grids[seed in f.to.particles ? 1 : 0])?.solid ?? null
  }

  private fill(source: ParticleSource, fraction: number, quads: boolean, mix: number): void {
    const n = source.count
    if (n !== this.capacity) this.allocate(Math.max(1, n))
    this.arrays[0]!.set(source.pos.subarray(0, n * 3))
    this.arrays[1]!.set(source.prev.subarray(0, n * 3))
    const d = this.arrays[2]!
    const st = this.arrays[3]!
    const sizes = source.sizes
    const kindOf = source.kindOf
    const opacity = source.opacity
    const state = source.state
    const phase = source.phase ?? this.phaseOf(n)
    let up = 0
    let down = 0
    const solid = this.solid
    const nearKind = solid ? source.kinds.findIndex((kind) => lookOf(kind).shape === SHAPE.seed) : -1
    const gone = Math.min(1, Math.max(0, (this.storm - SEED_NEAR.stormOff[0]) / (SEED_NEAR.stormOff[1] - SEED_NEAR.stormOff[0])))
    const calm = 1 - gone * gone * (3 - 2 * gone)
    const pos = source.pos
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      d[o] = sizes[i]! * SIZE_TO_RADIUS
      d[o + 1] = kindOf[i]!
      d[o + 2] = opacity ? opacity[i]! : 1
      d[o + 3] = phase[i]!
      const s = state[i]!
      st[i] = s
      if (s < 0.5) {
        up++
        // a seed in the liquid tells the shader how near it is to what it can snag on (looks.ts, SEED_NEAR): nothing in the open air and in the storm at its full
        if (solid && kindOf[i] === nearKind) {
          const o3 = i * 3
          const far = (sampleSdf(solid, pos[o3]!, pos[o3 + 1]!, pos[o3 + 2]!) - SEED_NEAR.fromMm) / (SEED_NEAR.toMm - SEED_NEAR.fromMm)
          if (far < 1) {
            const t = Math.max(0, far)
            st[i] = SEED_NEAR.state * calm * (1 - t * t * (3 - 2 * t))
          }
        }
      } else if (s < 2.5) down++
    }
    this.afloat = up + down > 0 ? up / (up + down) : 0
    // a few seeds lie where the scene has a place for them while the liquid is calm (looks.ts, SEED_RESTS): the first seeds of the list, so the same ones at every size of the film
    const seedKind = this.storm < SEED_RESTS.until ? source.kinds.findIndex((kind) => lookOf(kind).shape === SHAPE.seed) : -1
    if (seedKind >= 0) {
      const now3 = this.arrays[0]!
      const prev3 = this.arrays[1]!
      const lift = SEED_RESTS.lift
      let laid = 0
      const seats = this.seats
      const held = SEED_RESTS.held
      for (let i = 0; i < n && laid < held.length; i++) {
        if (kindOf[i] !== seedKind) continue
        const place = seats[held[laid++]!]!
        const wide = place[6]! * SEED_RESTS.size
        const o3 = i * 3
        const o4 = i * 4
        for (let c = 0; c < 3; c++) {
          const v = place[c]! + place[3 + c]! * wide * lift
          now3[o3 + c] = v
          prev3[o3 + c] = v
        }
        d[o4] = wide
        d[o4 + 2] = 1
        st[i] = STATE_LAID
      }
    }
    // the storm's glow (looks.ts, STORM_BLOOM): the seeds of the list after the laid heads' are no seeds. Each stands at one of the lights inside; one with no light is not drawn
    const glowKind = source.kinds.findIndex((kind) => lookOf(kind).shape === SHAPE.seed)
    if (glowKind >= 0) {
      const now3 = this.arrays[0]!
      const prev3 = this.arrays[1]!
      const lamps = this.glows
      // the pool of the storm: the haze of the whole yard lit by all the lights together. It stands at their middle, each light weighed by its power
      const pool = [0, 0, 0]
      let weight = 0
      for (const l of lamps) {
        for (let c = 0; c < 3; c++) pool[c]! += l.at[c]! * l.power
        weight += l.power
      }
      let seeds = 0
      for (let i = 0, k = 0; i < n && k < STORM_BLOOM.most; i++) {
        if (kindOf[i] !== glowKind) continue
        if (seeds++ < SEED_RESTS.held.length) continue
        const l = lamps[k]
        const pooled = k === lamps.length && weight > 0
        const lowly = k === lamps.length + 1 && weight > 0
        k++
        const o3 = i * 3
        const o4 = i * 4
        st[i] = STATE_GLOW
        if (pooled) {
          for (let c = 0; c < 3; c++) {
            now3[o3 + c] = pool[c]! / weight + STORM_BLOOM.poolAtMm[c]!
            prev3[o3 + c] = now3[o3 + c]!
          }
          d[o4] = STORM_BLOOM.poolMm
          d[o4 + 2] = (opacity ? opacity[i]! : 1) * STORM_BLOOM.pool
          // below zero: the card is the pool, one wide glow of the cream alone
          d[o4 + 3] = -1
          continue
        }
        // the low glow: the down that drifts low over the yard, lit by all the lights together. One wide flat glow before the ground
        if (lowly) {
          for (let c = 0; c < 3; c++) {
            now3[o3 + c] = pool[c]! / weight + STORM_BLOOM.lowAtMm[c]!
            prev3[o3 + c] = now3[o3 + c]!
          }
          d[o4] = STORM_BLOOM.lowMm
          d[o4 + 2] = (opacity ? opacity[i]! : 1) * STORM_BLOOM.low
          d[o4 + 3] = -2
          continue
        }
        if (!l) {
          d[o4 + 2] = 0
          continue
        }
        for (let c = 0; c < 3; c++) {
          now3[o3 + c] = l.at[c]!
          prev3[o3 + c] = l.at[c]!
        }
        d[o4] = STORM_BLOOM.wide * Math.min(l.reachMm, STORM_BLOOM.reachMostMm)
        // a light that is dim for its reach is a lit pane or a wash and no orb: it has no bloom
        const orb = l.power / (l.reachMm * l.reachMm) < STORM_BLOOM.paneBelow ? 0 : 1
        d[o4 + 2] = (opacity ? opacity[i]! : 1) * orb * Math.min(STORM_BLOOM.most1, Math.sqrt(Math.max(0, l.power * flickerOf(l, this.glowAt[0], this.glowAt[1]))))
        d[o4 + 3] = l.color[1] / Math.max(l.color[0], 1e-6)
      }
    }
    for (const a of quads ? this.instanced : this.single) a.needsUpdate = true
    this.drawn = Math.max(0, Math.min(n, Math.floor(n * fraction)))
    // a level that draws a part of the list sends that part alone: the rest is never read, and the whole list is megabytes a frame
    for (const a of quads ? this.instanced : this.single) {
      a.clearUpdateRanges()
      if (this.drawn > 0) a.addUpdateRange(0, this.drawn * a.itemSize)
    }
    this.sprites.geometry.setDrawRange(0, this.drawn)
    const bats = this.uniforms.uBat!.value as THREE.Vector4[]
    const batKind = source.kinds.findIndex((kind) => lookOf(kind).shape === SHAPE.bat)
    let found = 0
    if (batKind >= 0) {
      const pos = source.pos
      const prev = source.prev
      const half = lookOf(source.kinds[batKind]!).size * 0.5 * (CARD.batSpread[0] + CARD.batSpread[1])
      for (let i = 0; i < this.drawn && found < BATS; i++) {
        if (kindOf[i] !== batKind || state[i]! > 2.5) continue
        const o = i * 3
        bats[found++]!.set(prev[o]! + (pos[o]! - prev[o]!) * mix, prev[o + 1]! + (pos[o + 1]! - prev[o + 1]!) * mix, prev[o + 2]! + (pos[o + 2]! - prev[o + 2]!) * mix, sizes[i]! * SIZE_TO_RADIUS * half * (opacity ? opacity[i]! : 1))
      }
    }
    for (; found < BATS; found++) bats[found]!.set(0, 0, 0, 0)
    ;(this.quads.geometry as THREE.InstancedBufferGeometry).instanceCount = this.drawn
  }

  private lens(f: StageFrame): void {
    const u = this.uniforms
    const scale = f.height / LENS_LOOK.referenceHeightPx
    const sampled = f.sample !== null && f.view === ''
    const span = f.live || sampled ? SHUTTER : 0
    ;(u.uStorm!.value as THREE.Vector4).set(this.storm, sampled ? 0.5 - f.sample!.t : 0, this.shown, this.paced)
    ;(u.uPoint!.value as THREE.Vector4).set(f.moment.mix, f.focalPx, span, scale)
    const pose = f.pose
    const dx = f.sample && pose.apertureMm > 0 ? f.sample.lu * pose.apertureMm : 0
    const dy = f.sample && pose.apertureMm > 0 ? f.sample.lv * pose.apertureMm : 0
    this.back.copy(pose.position).sub(pose.aim).normalize()
    this.right.set(0, 1, 0).cross(this.back).normalize()
    this.up.copy(this.back).cross(this.right)
    ;(u.uAperture!.value as THREE.Vector4).set(dx, dy, 1 / pose.focusMm, f.blurMm)
    ;(u.uEyeShift!.value as THREE.Vector3).set(0, 0, 0).addScaledVector(this.right, dx).addScaledVector(this.up, dy)
    u.uWhole!.value = f.live ? 1 : 0
    ;(u.uBlur!.value as THREE.Vector4).set(LENS_LOOK.nearGain, LENS_LOOK.farGain, LENS_LOOK.maxBlurPx * scale, LENS_LOOK.farShrink)
    ;(u.uTone!.value as THREE.Vector4).w = LENS_LOOK.glassDiscPx * scale
    const limit = u.uLimit!.value as THREE.Vector4
    limit.x = LENS_LOOK.maxStreakPx * scale
    limit.y = pointMesh(f.live, this.maxPointPx).halfPx
  }

  private lights(f: StageFrame): void {
    const u = this.uniforms
    ;(u.uUpLocal!.value as THREE.Vector3).copy(f.globeUp)
    const lamp = u.uLamp!.value as THREE.Vector4[]
    const lampCol = u.uLampCol!.value as THREE.Vector4[]
    let slot = 0
    const put = (list: readonly InnerLight[], weight: number) => {
      for (const l of list) {
        if (slot >= LAMPS || weight <= 0) return
        const p = l.power * weight * flickerOf(l, f.time, f.period)
        lamp[slot]!.set(l.at[0], l.at[1], l.at[2], LIGHT_LOOK.lampFlash)
        lampCol[slot]!.set(l.color[0] * p, l.color[1] * p, l.color[2] * p, Math.max(1, l.reachMm))
        slot++
      }
    }
    if (f.from === f.to) put(f.from.innerLights, 1)
    else {
      put(f.from.innerLights.slice(0, LAMPS / 2), 1 - f.mix.light)
      put(f.to.innerLights.slice(0, LAMPS / 2), f.mix.light)
    }
    for (; slot < LAMPS; slot++) {
      lamp[slot]!.set(0, 0, 0, 0)
      lampCol[slot]!.set(0, 0, 0, 1)
    }
  }

  private kinds(source: ParticleSource, from: KindColors, to: KindColors, all: KindColors, t: number): void {
    const u = this.uniforms
    const table = texture(LOBE_TABLE)
    u.uLobes!.value = table
    u.uLobeRows!.value = (table.image as { height: number }).height
    const colors = u.uKindColor!.value as THREE.Vector4[]
    const parts = u.uKindPart!.value as THREE.Vector4[]
    const looks = u.uKindLook!.value as THREE.Vector4[]
    const ways = u.uKindWay!.value as THREE.Vector4[]
    source.kinds.forEach((kind, i) => {
      if (i >= MAX_KINDS) return
      const a = from[kind] ?? to[kind] ?? all[kind]
      const b = to[kind] ?? from[kind] ?? all[kind]
      if (!a || !b) throw new Error(`no season gives a colour to the particle kind ${kind}`)
      colors[i]!.set(a.color[0] + (b.color[0] - a.color[0]) * t, a.color[1] + (b.color[1] - a.color[1]) * t, a.color[2] + (b.color[2] - a.color[2]) * t, a.glow + (b.glow - a.glow) * t)
      const look = lookOf(kind)
      looks[i]!.set(look.shape, look.size, look.body, look.flash)
      const way = BEHAVIOUR[kind]
      ways[i]!.set(way ? way.renew : 0, way ? way.floats : 0, way && way.rest !== 'never' && way.settleMmS[1] > 0 ? 1 : 0, 0)
      const bytes = partBytes(`particle-${kind}`)
      parts[i]!.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, 0)
    })
  }
}
