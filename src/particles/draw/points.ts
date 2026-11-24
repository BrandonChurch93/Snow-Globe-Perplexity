import * as THREE from 'three'
import { config } from '../../config'
import { coverUniforms } from '../../core/chunks/cover'
import { handleOf, stageShader, type Rgb } from '../../core/materials'
import { clearStandIn, flagStandIn } from '../../core/standins'
import type { ParticleSource } from '../../core/stage'
import { hasTexture, texture } from '../../core/textures'
import { partBytes } from '../../diagnostics/views'
import type { StageFrame } from '../../scene/frame'
import { flickerOf } from '../../scene/lightgrid'
import type { InnerLight } from '../../seasons/kit'
import { LAMPS, LENS_LOOK, LIGHT_LOOK, LOBE_TABLE, LYING_LOOK, MAX_KINDS, SHAPE, TABLE_COLUMNS, lookOf } from './looks'
import { FRAG, VERT_MAIN, VERT_PARS } from './shader'

export { MAX_KINDS } from './looks'
export const SIZE_TO_RADIUS = 0.5
const SHUTTER = (config.film.shutterDegrees / 360) * (config.sim.stepHz / config.film.fps)
const TAU = 2 * Math.PI

type KindColors = Readonly<Record<string, { color: Rgb; glow: number }>>

function plainTable(): THREE.DataTexture {
  const data = new Uint8Array(TABLE_COLUMNS * 4)
  for (let k = 0; k < TABLE_COLUMNS; k++) data.set([128, 128, 128, k === 0 ? 255 : 0], k * 4)
  const t = new THREE.DataTexture(data, TABLE_COLUMNS, 1, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
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
  private readonly plain = plainTable()
  private readonly turn = new THREE.Quaternion()
  private readonly tilt = new THREE.Euler()
  private readonly back = new THREE.Vector3()
  private readonly right = new THREE.Vector3()
  private readonly up = new THREE.Vector3()
  private cover: boolean | null = null
  drawn = 0
  maxPointPx = 256

  constructor(radiusMm: number) {
    this.uniforms = {
      ...coverUniforms,
      uPoint: { value: new THREE.Vector4(1, 1, 0, 1) },
      uAperture: { value: new THREE.Vector4(0, 0, 0, 0) },
      uEyeShift: { value: new THREE.Vector3() },
      uBlur: { value: new THREE.Vector4() },
      uLying: { value: new THREE.Vector4(LYING_LOOK.flat, LYING_LOOK.lobe, LYING_LOOK.mergeFromMm, LYING_LOOK.mergeToMm) },
      uLimit: { value: new THREE.Vector4(1, 1, LYING_LOOK.mergeSpread, LYING_LOOK.glitterTilt) },
      uTone: { value: new THREE.Vector4(LIGHT_LOOK.wrap, LIGHT_LOOK.grid, LIGHT_LOOK.veilShare, 0) },
      uKeyLocal: { value: new THREE.Vector3(0, 1, 0) },
      uKeyCol: { value: new THREE.Color() },
      uRimLocal: { value: new THREE.Vector3(0, 1, 0) },
      uRimCol: { value: new THREE.Color() },
      uSkyCol: { value: new THREE.Color() },
      uGroundCol: { value: new THREE.Color() },
      uUpLocal: { value: new THREE.Vector3(0, 1, 0) },
      uLamp: { value: Array.from({ length: LAMPS }, () => new THREE.Vector4()) },
      uLampCol: { value: Array.from({ length: LAMPS }, () => new THREE.Vector4(0, 0, 0, 1)) },
      uLobes: { value: this.plain as THREE.Texture },
      uLobeRows: { value: 1 },
      uPointChange: { value: 0 },
      uKindColor: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
      uKindPart: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
      uKindLook: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
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
    this.sprites.visible = !f.live
    this.quads.visible = f.live
    this.fill(source, f.quality.particleFraction, f.live)
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

  private fill(source: ParticleSource, fraction: number, live: boolean): void {
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
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      d[o] = sizes[i]! * SIZE_TO_RADIUS
      d[o + 1] = kindOf[i]!
      d[o + 2] = opacity ? opacity[i]! : 1
      d[o + 3] = phase[i]!
      st[i] = state[i]!
    }
    for (const a of live ? this.instanced : this.single) a.needsUpdate = true
    this.drawn = Math.max(0, Math.min(n, Math.floor(n * fraction)))
    this.sprites.geometry.setDrawRange(0, this.drawn)
    ;(this.quads.geometry as THREE.InstancedBufferGeometry).instanceCount = this.drawn
  }

  private lens(f: StageFrame): void {
    const u = this.uniforms
    const scale = f.height / LENS_LOOK.referenceHeightPx
    const span = f.live ? SHUTTER : f.sample && f.view === '' ? LENS_LOOK.sampleSpanSteps : 0
    ;(u.uPoint!.value as THREE.Vector4).set(f.moment.mix, f.focalPx, span, scale)
    const pose = f.pose
    const dx = f.sample && pose.apertureMm > 0 ? f.sample.lu * pose.apertureMm : 0
    const dy = f.sample && pose.apertureMm > 0 ? f.sample.lv * pose.apertureMm : 0
    this.back.copy(pose.position).sub(pose.aim).normalize()
    this.right.set(0, 1, 0).cross(this.back).normalize()
    this.up.copy(this.back).cross(this.right)
    ;(u.uAperture!.value as THREE.Vector4).set(dx, dy, 1 / pose.focusMm, f.blurMm)
    ;(u.uEyeShift!.value as THREE.Vector3).set(0, 0, 0).addScaledVector(this.right, dx).addScaledVector(this.up, dy)
    ;(u.uBlur!.value as THREE.Vector4).set(LENS_LOOK.nearGain, LENS_LOOK.farGain, LENS_LOOK.maxBlurPx * scale, LENS_LOOK.farShrink)
    const limit = u.uLimit!.value as THREE.Vector4
    limit.x = LENS_LOOK.maxStreakPx * scale
    limit.y = Math.max(4, this.maxPointPx / 2)
  }

  private lights(f: StageFrame): void {
    const u = this.uniforms
    this.turn.setFromEuler(this.tilt.set(f.globe.tiltX, 0, f.globe.tiltZ)).invert()
    ;(u.uKeyLocal!.value as THREE.Vector3).copy(f.keyDir).applyQuaternion(this.turn)
    ;(u.uRimLocal!.value as THREE.Vector3).copy(f.rimDir).applyQuaternion(this.turn)
    ;(u.uUpLocal!.value as THREE.Vector3).copy(f.globeUp)
    ;(u.uKeyCol!.value as THREE.Color).copy(f.keyCol)
    ;(u.uRimCol!.value as THREE.Color).copy(f.rimCol)
    ;(u.uSkyCol!.value as THREE.Color).copy(f.ambient)
    ;(u.uGroundCol!.value as THREE.Color).copy(f.ground).multiplyScalar(f.fill)
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
    const table = hasTexture(LOBE_TABLE) ? texture(LOBE_TABLE) : null
    u.uLobes!.value = table ?? this.plain
    u.uLobeRows!.value = table ? (table.image as { height: number }).height : 1
    const colors = u.uKindColor!.value as THREE.Vector4[]
    const parts = u.uKindPart!.value as THREE.Vector4[]
    const looks = u.uKindLook!.value as THREE.Vector4[]
    const flagged: string[] = []
    source.kinds.forEach((kind, i) => {
      if (i >= MAX_KINDS) return
      const a = from[kind] ?? to[kind] ?? all[kind]
      const b = to[kind] ?? from[kind] ?? all[kind]
      if (!a || !b) throw new Error(`no season gives a colour to the particle kind ${kind}`)
      colors[i]!.set(a.color[0] + (b.color[0] - a.color[0]) * t, a.color[1] + (b.color[1] - a.color[1]) * t, a.color[2] + (b.color[2] - a.color[2]) * t, a.glow + (b.glow - a.glow) * t)
      const look = lookOf(kind)
      const real = look.real && (look.shape !== SHAPE.cluster || table !== null)
      const shape = look.shape === SHAPE.cluster && !table ? SHAPE.soft : look.shape
      looks[i]!.set(shape, look.size, look.body, look.flash)
      const name = `particle-${kind}`
      const bytes = partBytes(name)
      parts[i]!.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, real ? 0 : 1)
      if (real) clearStandIn(name)
      else {
        flagStandIn(name)
        flagged.push(name)
      }
    })
    this.points.userData.standIn = flagged[0]
    this.points.userData.standIns = flagged
  }
}
