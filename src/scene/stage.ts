import * as THREE from 'three'
import { config } from '../config'
import type { Assets } from '../core/assets'
import { updateCover } from '../core/chunks/cover'
import { updateVeil } from '../core/chunks/veil'
import type { Gfx } from '../core/gl'
import { MODE, setPresence, stageShader, stageUniforms, type Rgb } from '../core/materials'
import type { Sample } from '../core/sampler'
import type { Emitter, Moment, ParticleSource, SdfGrid, Stage, StageQuality } from '../core/stage'
import { flagStandIn } from '../core/standins'
import { preparedBytes, prepareGroup, setAnisotropy } from '../core/textures'
import { FLOW_RANGE_MM_S, LIGHT_RANGE, allParts, viewCode } from '../diagnostics/views'
import { Shell } from '../globe/shell'
import { ParticleDraw } from '../particles/draw/points'
import { kitOf, kits } from '../seasons'
import type { SeasonKit } from '../seasons/kit'
import { changeBloom, partChange } from '../shake/change'
import { Backdrop } from './backdrop'
import { applyPose, type Pose } from './cameras'
import { newFrame, type StageFrame } from './frame'
import { buildCollider, centreHeightMm, emitters as layoutEmitters, innerRadiusMm, outerRadiusMm } from './layout'
import { bakeGrid, flickerOf, gridBytes } from './lightgrid'
import { Lighting } from './lighting'
import { drawPasses, type PassContext } from './passes'
import { makeDressing, makeSlab, updateSurface } from './surface'

interface SeasonSet {
  kit: SeasonKit
  objects: THREE.Object3D[]
  lights: THREE.Object3D
  grid: THREE.Data3DTexture
  materials: THREE.Material[]
  arrival: THREE.Material[]
}

const TURBULENCE_FULL = 260

const SLICE = `
uniform vec4 uSlice;
uniform vec3 uSpin;
uniform vec3 uSlosh;
void main() {
  if (length(vStageLocal) > uGrid.w) discard;
  vec3 col = uSlice.x > 0.5 ? 0.5 + (cross(uSpin, vStageLocal) + uSlosh) / ${(2 * FLOW_RANGE_MM_S).toFixed(1)} : stageGrid(vStageLocal) / ${LIGHT_RANGE.toFixed(1)};
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

export class GlobeStage implements Stage {
  readonly standIn = true
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera()
  private readonly world = new THREE.Group()
  private readonly floor = new THREE.Group()
  private readonly globe = new THREE.Group()
  private readonly inside = new THREE.Group()
  private readonly slab = makeSlab()
  private readonly backdrop = new Backdrop()
  private readonly shell = new Shell()
  private readonly draw = new ParticleDraw(outerRadiusMm)
  private readonly lighting: Lighting
  private readonly slice: THREE.Mesh
  private readonly sets = new Map<string, SeasonSet>()
  private readonly colliders = new Map<string, SdfGrid>()
  private readonly prepared = new Map<string, Promise<void>>()
  private solid: SdfGrid | null = null
  private diag = ''
  private quality: StageQuality = { particleFraction: 1, shadowMapPx: config.live.quality.high.shadowMapPx, surfaceReflection: 'planar' }
  private readonly clear = new THREE.Color()
  private readonly frame: StageFrame
  private readonly pass: PassContext
  private readonly up = new THREE.Vector3()
  private readonly turn = new THREE.Quaternion()

  constructor(private readonly gfx: Gfx, private readonly source: ParticleSource, private readonly assets: Assets) {
    const { scene, world, floor, globe, inside } = this
    this.lighting = new Lighting(this.quality.shadowMapPx)
    scene.add(world, floor)
    world.add(globe, this.backdrop.group, this.lighting.rig)
    floor.add(this.slab)
    inside.position.y = centreHeightMm
    globe.add(inside)
    globe.add(this.lighting.glow)
    inside.add(this.shell.through, this.shell.shell, this.shell.bubble, this.shell.stamp, this.draw.points)

    this.slice = new THREE.Mesh(
      new THREE.CircleGeometry(innerRadiusMm, 96),
      stageShader({ part: 'light-engine', standIn: false, inside: true, uniforms: { uSlice: { value: new THREE.Vector4() }, uSpin: { value: new THREE.Vector3() }, uSlosh: { value: new THREE.Vector3() } }, fragment: SLICE, params: { side: THREE.DoubleSide } }),
    )
    this.slice.visible = false
    inside.add(this.slice)

    const { renderer } = gfx
    setAnisotropy(renderer.capabilities.getMaxAnisotropy())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.shadowMap.autoUpdate = false
    const range = gfx.gl.getParameter(gfx.gl.ALIASED_POINT_SIZE_RANGE) as Float32Array
    this.draw.maxPointPx = Math.min(1024, range[1] ?? 256)

    this.frame = newFrame(kits[0]!, this.quality)
    const all: Record<string, { color: Rgb; glow: number }> = {}
    for (const k of kits) for (const [name, c] of Object.entries(k.particles)) all[name] ??= c
    this.frame.kinds = all
    this.pass = { renderer, scene, camera: this.camera, floor, globe, backdrop: this.backdrop, key: this.lighting.key, orient: (sign) => this.orient(sign) }
  }

  prepare(season: string): Promise<void> {
    let p = this.prepared.get(season)
    if (!p) {
      const kit = kitOf(season)
      p = prepareGroup(this.assets, 'shared')
        .then(() => prepareGroup(this.assets, season))
        .then(() => kit.prepare?.())
        .then(() => {
          this.set(season)
        })
      this.prepared.set(season, p)
    }
    return p
  }

  private set(season: string): SeasonSet {
    let s = this.sets.get(season)
    if (s) return s
    const kit = kitOf(season)
    const base = kit.base()
    const miniature = kit.miniature()
    const arrival = kit.arrival()
    const lights = kit.lights()
    const own = kit.dressing?.() ?? {}
    const dressing = own.surface ?? makeDressing(kit)
    const glass = own.glass ? [own.glass] : []
    this.globe.add(base)
    this.inside.add(miniature, arrival, lights, ...glass)
    this.floor.add(dressing)
    for (const part of kit.standIns ?? []) flagStandIn(part)
    const collect = (roots: THREE.Object3D[]): THREE.Material[] => {
      const out: THREE.Material[] = []
      for (const r of roots) r.traverse((o) => {
        const m = (o as THREE.Mesh).material
        if (m && !Array.isArray(m) && m.userData.stage) out.push(m)
      })
      return out
    }
    s = {
      kit,
      objects: [base, miniature, arrival, lights, dressing, ...glass],
      lights,
      grid: bakeGrid(kit.innerLights, this.collider(season)),
      materials: collect([base, miniature, lights, dressing, ...glass]),
      arrival: collect([arrival]),
    }
    this.sets.set(season, s)
    return s
  }

  parts(): { name: string; color: number }[] {
    return allParts()
  }

  resize(_width: number, _height: number): void {}

  setDiagnostic(view: string): void {
    this.diag = view === 'none' ? '' : view
  }

  setQuality(level: StageQuality): void {
    this.lighting.setShadowMap(level.shadowMapPx)
    this.quality = { ...level }
  }

  collider(season: string): SdfGrid {
    kitOf(season)
    let c = this.colliders.get(season)
    if (!c) {
      const own = kitOf(season).collider
      if (own) c = own()
      else {
        this.solid ??= buildCollider()
        c = this.solid
      }
      this.colliders.set(season, c)
    }
    return c
  }

  emitters(season: string): Record<string, Emitter[]> {
    const out: Record<string, Emitter[]> = {}
    for (const kind of Object.keys(kitOf(season).particles)) {
      const list = layoutEmitters[kind]
      if (list) out[kind] = list.map((e) => ({ ...e }))
    }
    return out
  }

  particleCount(): number {
    return Math.floor(this.source.count * Math.min(1, Math.max(0, this.quality.particleFraction)))
  }

  textureBytes(): number {
    return this.lighting.shadowBytes() + this.sets.size * gridBytes + 64 * 64 * 4 + preparedBytes()
  }

  private orient(sign: number): void {
    this.world.scale.y = sign
    this.world.updateMatrixWorld(true)
    this.inside.getWorldPosition(stageUniforms.uLensCentre.value)
    stageUniforms.uGlobeInv.value.copy(this.inside.matrixWorld).invert()
  }

  drawSample(target: THREE.WebGLRenderTarget, pose: Pose, sample: Sample | null, moment: Moment, shadows: boolean): void {
    const { renderer } = this.gfx
    const w = target.width
    const h = target.height
    const view = this.diag
    const beauty = view === '' || view === 'refraction'
    const sliceOnly = view === 'flow' || view === 'lightgrid'
    const single = moment.from === moment.to || !(moment.change > 0) || moment.change >= 1
    const a = this.set(single ? moment.season : moment.from)
    const b = single ? a : this.set(moment.to)
    const change = single ? 0 : moment.change
    if (!single) flagStandIn(`change-${moment.from}-${moment.to}`)
    const u = stageUniforms
    const liquid = this.source.liquid
    const period = moment.period ?? config.scene.ambientPeriodSeconds
    const swap = config.shake.swapWindow
    const settle = config.shake.settleCheckSeconds
    const arrived = moment.beat !== null && moment.beat >= swap.fromBeat ? 0 : Math.min(1, Math.max(0, moment.sinceLanding / settle))

    const f = this.frame
    f.width = w
    f.height = h
    f.pose = pose
    f.sample = sample
    f.view = view
    f.live = sample === null && view === ''
    f.lensOn = view === ''
    f.moment = moment
    f.time = moment.time
    f.period = period
    f.clock = (((moment.time / period) % 1) + 1) % 1
    f.arrived = arrived
    f.from = a.kit
    f.to = b.kit
    f.change = change
    f.mix.light = partChange('light', change)
    f.mix.veil = partChange('veil', change)
    f.mix.base = partChange('base', change)
    f.mix.particles = partChange('particles', change)
    f.mix.bloom = changeBloom(change)
    f.grids[0] = a.grid
    f.grids[1] = b.grid
    f.liquid = liquid
    f.turbulence = Math.min(1, Math.max(0, (liquid[6] ?? 0) / TURBULENCE_FULL))
    f.quality = this.quality
    f.planar = this.quality.surfaceReflection === 'planar'
    f.focalPx = h / (2 * Math.tan((pose.fovDeg * Math.PI) / 360))
    f.blurMm = f.lensOn ? pose.apertureMm : 0

    const g = moment.globe
    f.globe = g
    this.globe.position.set(g.x, g.y, g.z)
    this.globe.rotation.set(g.tiltX, 0, g.tiltZ)
    f.globeUp.copy(this.up.set(0, 1, 0).applyQuaternion(this.turn.copy(this.globe.quaternion).invert()))

    u.uChange.value = change
    u.uDiag.value = beauty || sliceOnly ? 0 : viewCode(view)
    u.uSeed.value = moment.seed + (sample ? sample.index * 7.31 : 0)
    u.uLens.value.z = 1
    u.uCoc.value.set(2 * pose.apertureMm * f.focalPx, 1 / pose.focusMm, 0)

    this.lighting.update(f)
    updateVeil(f)
    this.shell.update(f)
    updateSurface(f)
    this.backdrop.update(f)
    updateCover(this.source)
    this.draw.frame(this.source, f)

    for (const s of this.sets.values()) {
      const on = !sliceOnly && (s === a || s === b)
      for (const o of s.objects) o.visible = on
      if (!on) continue
      const mode = single ? MODE.always : s === a ? MODE.outgoing : MODE.incoming
      for (const m of s.materials) setPresence(m, mode, 1)
      const here = single ? arrived : s === a ? 1 : 0
      for (const m of s.arrival) setPresence(m, mode, here)
      s.kit.update?.({ time: moment.time, period, sinceLanding: single || s === b ? moment.sinceLanding : Infinity, arrived: here, beat: moment.beat, seed: moment.seed, frame: f })
      s.lights.traverse((o) => {
        const l = o.userData.light
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (l && m) m.emissiveIntensity = flickerOf(l, moment.time, period)
      })
    }
    this.slab.visible = !sliceOnly
    this.slice.visible = sliceOnly

    if (sliceOnly) {
      const su2 = (this.slice.material as THREE.ShaderMaterial).uniforms
      ;(su2.uSlice!.value as THREE.Vector4).set(view === 'flow' ? 1 : 0, 0, 0, 0)
      ;(su2.uSpin!.value as THREE.Vector3).set(liquid[0] ?? 0, liquid[1] ?? 0, liquid[2] ?? 0)
      ;(su2.uSlosh!.value as THREE.Vector3).set(liquid[3] ?? 0, liquid[4] ?? 0, liquid[5] ?? 0)
    }

    const auto = renderer.autoClear
    const alpha = renderer.getClearAlpha()
    renderer.getClearColor(this.clear)
    renderer.autoClear = false
    renderer.setClearColor(0x000000, 0)
    target.scissorTest = false
    target.viewport.set(0, 0, w, h)
    renderer.setRenderTarget(target)
    renderer.clear(true, true, false)
    if (view === 'refraction') {
      const half = Math.floor(w / 2)
      for (const side of [0, 1]) {
        target.viewport.set(side * half, 0, half, h)
        target.scissor.set(side * half, 0, half, h)
        target.scissorTest = true
        renderer.setRenderTarget(target)
        applyPose(this.camera, pose, half, h, null)
        u.uLens.value.z = side === 0 ? 1 : 0
        drawPasses(this.pass, { shadows: shadows && side === 0, mirror: false, sliceOnly: false, emitters: true }, f)
      }
      u.uLens.value.z = 1
      target.scissorTest = false
      target.viewport.set(0, 0, w, h)
      target.scissor.set(0, 0, w, h)
      renderer.setRenderTarget(target)
    } else {
      applyPose(this.camera, pose, w, h, sample)
      drawPasses(this.pass, { shadows, mirror: view === '' && f.planar, sliceOnly, emitters: beauty }, f)
    }
    renderer.autoClear = auto
    renderer.setClearColor(this.clear, alpha)
  }
}
