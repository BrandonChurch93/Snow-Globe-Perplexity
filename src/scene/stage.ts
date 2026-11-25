import * as THREE from 'three'
import { config } from '../config'
import { lensFillOf, type LensFill } from '../core/accumulator'
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
import { BUILT_CHANGES, changeBloom, partChange } from '../shake/change'
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
  glass: THREE.Object3D[]
}

const BLUR_CLEAR = new THREE.Color(0, 1, 0.5)

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
  /** The glass as the lens fill's map takes it when the globe itself is in focus: one closed surface with no blur. */
  private readonly keep = new THREE.Mesh(this.shell.shell.geometry, new THREE.MeshBasicMaterial({ color: 0x000000 }))
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
      glass,
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
    if (!single && !BUILT_CHANGES.has(`${moment.from}-${moment.to}`)) flagStandIn(`change-${moment.from}-${moment.to}`)
    const u = stageUniforms
    const liquid = this.source.liquid
    const period = moment.period ?? config.scene.ambientPeriodSeconds
    const swap = config.shake.swapWindow
    const settle = config.shake.settleCheckSeconds
    const settled = Math.min(1, Math.max(0, moment.sinceLanding / settle))
    const swapping = moment.beat !== null && moment.beat >= swap.fromBeat
    const arrived = !swapping ? settled : single ? settled * (1 - partChange('base', (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat))) : 0

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
      const fill = view === '' && pose.apertureMm > 0 ? lensFillOf(target) : undefined
      if (fill?.wants(sample)) this.drawBlur(fill, target, pose, f, single ? [a] : [a, b])
    }
    renderer.autoClear = auto
    renderer.setClearColor(this.clear, alpha)
  }

  /**
   * The lens fill's map, once a picture: the blur radius of the front surface at every pixel, from
   * the sample in hand (the lens point nearest the centre). The materials write it as their texel
   * view does. The backdrop and the glass are left out: their pixels keep the clear value and take
   * the blur of what stands next to them, and so are the flakes. Then the guide: the backdrop's
   * discs and the flakes afloat, alone.
   */
  private drawBlur(fill: LensFill, target: THREE.WebGLRenderTarget, pose: Pose, f: StageFrame, sets: SeasonSet[]): void {
    const { renderer } = this.gfx
    const u = stageUniforms
    const { dome, lights } = this.backdrop
    const points = this.draw.points
    const hidden = [dome, lights, points, this.shell.through, this.shell.shell, this.shell.bubble, ...sets.flatMap((s) => s.glass)].filter((o) => o.visible)
    for (const o of hidden) o.visible = false
    const coc = u.uCoc.value.x
    const drawn = { ...renderer.info.render }
    u.uDiag.value = viewCode('texels')
    u.uCoc.value.x = (8 * pose.apertureMm * f.focalPx) / fill.rangePx
    renderer.setRenderTarget(fill.map)
    renderer.setClearColor(BLUR_CLEAR, 1)
    renderer.clear(true, true, false)
    this.floor.visible = false
    renderer.render(this.scene, this.camera)
    this.globe.visible = false
    this.floor.visible = true
    renderer.render(this.scene, this.camera)
    this.globe.visible = true
    // A globe that is itself in focus is the front surface of the picture: what is seen in the glass
    // is seen at the glass, so nothing inside its outline is filled and its rim stays as it is. Seen
    // from close by through the near wall (the macro) the glass is far out of focus and no surface
    // of the picture, and the map keeps what stands behind it.
    const radius = (this.shell.shell.geometry as THREE.SphereGeometry).parameters.radius
    const near = Math.max(this.camera.position.distanceTo(u.uLensCentre.value) - radius, 1)
    if (pose.apertureMm * f.focalPx * Math.abs(1 / near - 1 / pose.focusMm) < fill.startPx) {
      this.keep.matrixAutoUpdate = false
      this.keep.matrixWorldAutoUpdate = false
      this.keep.matrix.copy(this.shell.shell.matrixWorld)
      this.keep.matrixWorld.copy(this.keep.matrix)
      renderer.render(this.keep, this.camera)
    }
    for (const o of hidden) o.visible = true
    u.uCoc.value.x = coc
    // The guide: the discs as the picture has them and the cover of the flakes afloat, whatever
    // stands before them. A flake that lies is drawn as a copy like the ground it lies on, so its
    // lobes are closed here (`uLying.y`, the flakes' own uniform) and the fill treats it as ground.
    const flakes = points.children.map((o) => (o as THREE.Mesh).material as THREE.ShaderMaterial)
    const alone: THREE.Material[] = [lights.material as THREE.Material, ...flakes]
    const tested = alone.map((m) => m.depthTest)
    for (const m of alone) m.depthTest = false
    const lying = [...new Set(flakes.map((m) => m.uniforms.uLying?.value as THREE.Vector4 | undefined))].filter((v): v is THREE.Vector4 => v !== undefined)
    const lobes = lying.map((v) => v.y)
    for (const v of lying) v.y = 0
    renderer.setRenderTarget(fill.guide)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, false, false)
    u.uDiag.value = 0
    renderer.render(lights, this.camera)
    u.uDiag.value = viewCode('cover')
    renderer.render(points, this.camera)
    lying.forEach((v, i) => (v.y = lobes[i]!))
    alone.forEach((m, i) => (m.depthTest = tested[i]!))
    u.uDiag.value = 0
    Object.assign(renderer.info.render, drawn)
    renderer.setRenderTarget(target)
    fill.drawn = true
  }
}
