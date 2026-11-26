import * as THREE from 'three'
import { config } from '../../config'
import { coverUniforms } from '../../core/chunks/cover'
import { veilSettle } from '../../core/chunks/veil'
import { handleOf, stageShader, type Rgb } from '../../core/materials'
import type { ParticleSource } from '../../core/stage'
import { texture } from '../../core/textures'
import { partBytes } from '../../diagnostics/views'
import type { StageFrame } from '../../scene/frame'
import { flickerOf } from '../../scene/lightgrid'
import type { InnerLight } from '../../seasons/kit'
import { BATS, CARD, LAMPS, LENS_LOOK, LIGHT_LOOK, LOBE_TABLE, LYING_LOOK, MAX_KINDS, SEED_RESTS, SETTLE_SHOWN, SHAPE, lookOf } from './looks'
import { BEHAVIOUR } from '../engine/kinds'
import { FRAG, VERT_MAIN, VERT_PARS } from './shader'
import { downAtlas } from './down'

export { MAX_KINDS } from './looks'
export const SIZE_TO_RADIUS = 0.5
/** The state the draw gives a seed that lies at one of the scene's places: between the engine's two states of rest, so the card lies, and is known. */
const STATE_LAID = 1.5
const SHUTTER = (config.film.shutterDegrees / 360) * (config.sim.stepHz / config.film.fps)
const TAU = 2 * Math.PI

type KindColors = Readonly<Record<string, { color: Rgb; glow: number }>>

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
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      d[o] = sizes[i]! * SIZE_TO_RADIUS
      d[o + 1] = kindOf[i]!
      d[o + 2] = opacity ? opacity[i]! : 1
      d[o + 3] = phase[i]!
      const s = state[i]!
      st[i] = s
      if (s < 0.5) up++
      else if (s < 2.5) down++
    }
    this.afloat = up + down > 0 ? up / (up + down) : 0
    // a few seeds lie where the scene has a place for them while the liquid is calm (looks.ts, SEED_RESTS): the first seeds of the list, so the same ones at every size of the film
    const seedKind = this.storm < SEED_RESTS.until ? source.kinds.findIndex((kind) => lookOf(kind).shape === SHAPE.seed) : -1
    if (seedKind >= 0) {
      const now3 = this.arrays[0]!
      const prev3 = this.arrays[1]!
      const lift = SEED_RESTS.lift
      let laid = 0
      for (let i = 0; i < n && laid < SEED_RESTS.at.length; i++) {
        if (kindOf[i] !== seedKind) continue
        const place = SEED_RESTS.at[laid++]!
        const o3 = i * 3
        const o4 = i * 4
        for (let c = 0; c < 3; c++) {
          const v = place[c]! + place[3 + c]! * place[6]! * lift
          now3[o3 + c] = v
          prev3[o3 + c] = v
        }
        d[o4] = place[6]!
        d[o4 + 2] = 1
        st[i] = STATE_LAID
      }
    }
    for (const a of quads ? this.instanced : this.single) a.needsUpdate = true
    this.drawn = Math.max(0, Math.min(n, Math.floor(n * fraction)))
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
