import * as THREE from 'three'
import { config } from '../config'
import { lensFillOf, type LensFill } from '../core/accumulator'
import type { Assets } from '../core/assets'
import { updateCover } from '../core/chunks/cover'
import { updateVeil } from '../core/chunks/veil'
import type { Gfx } from '../core/gl'
import { MODE, passStep, setPresence, stageShader, stageUniforms, type Rgb } from '../core/materials'
import type { Sample } from '../core/sampler'
import type { Emitter, Moment, ParticleSource, SdfGrid, Stage, StageQuality } from '../core/stage'
import { hasTexture, preparedBytes, prepareGroup, setAnisotropy, texture } from '../core/textures'
import { FLOW_RANGE_MM_S, LIGHT_RANGE, allParts, viewCode } from '../diagnostics/views'
import { Shell } from '../globe/shell'
import { lensState } from '../post/grade'
import { ParticleDraw } from '../particles/draw/points'
import { kitOf, kits } from '../seasons'
import type { SeasonKit } from '../seasons/kit'
import { changeBloom, partChange } from '../shake/change'
import { Backdrop } from './backdrop'
import { applyPose, type Pose } from './cameras'
import { newFrame, type StageFrame } from './frame'
import { gridAddress, readGrid } from './gridfile'
import { centreHeightMm, collarY, emitters as layoutEmitters, innerRadiusMm, outerRadiusMm } from './layout'
import { bakeGrid, flickerOf, gridBytes } from './lightgrid'
import { CHANGE_BLOOM, Lighting } from './lighting'
import { drawPasses, type PassContext } from './passes'
import { makeSlab, ReflectMix, updateSurface } from './surface'

interface SeasonSet {
  kit: SeasonKit
  objects: THREE.Object3D[]
  lights: THREE.Object3D
  grid: THREE.Data3DTexture
  materials: THREE.Material[]
  arrival: THREE.Material[]
  glass: THREE.Object3D[]
  /** Whether a frame has shown the set: from then on the GPU has all of it. */
  shown: boolean
}

type Drawn = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>

/** What the renderer keeps for a material once it has a program for it. */
interface Linked {
  uniforms?: Record<string, THREE.IUniform | undefined>
}

/** A season's set while it is built: what is still to do, in the order it is done. The last step puts the set in the scene. */
interface Making {
  steps: (() => void)[]
}

/** How long a step waits for a frame before it goes without one, on a page that draws slowly or not at all. */
const SOON_MS = 50
/** How long a press holds other seasons' work back while no frame of its shake has been drawn. */
const PRESS_MS = 3000
/** What one frame spends on handing a season that is not on show to the GPU: the step that passes it is the frame's last. */
const HAND_MS = 4
/** A layer nothing is on but the lights, which every program counts, and for one draw the mesh that is handed over. */
const HAND_LAYER = 31

const NOTHING = (): void => undefined

const materialsOf = (d: Drawn): THREE.Material[] => (Array.isArray(d.material) ? d.material : [d.material])

function picturesOf(m: THREE.Material, linked: Linked['uniforms']): THREE.Texture[] {
  const out: THREE.Texture[] = []
  const take = (v: unknown): void => {
    const t = v as (THREE.Texture & { isFramebufferTexture?: boolean }) | null | undefined
    if (t && t.isTexture && t.image && !t.isRenderTargetTexture && !t.isFramebufferTexture && !(t as THREE.DepthTexture).isDepthTexture) out.push(t)
  }
  for (const v of Object.values(m)) take(v)
  for (const u of Object.values({ ...(m as THREE.ShaderMaterial).uniforms, ...linked })) take(u?.value)
  return out
}

const frameOrSoon = (): Promise<void> =>
  new Promise((resolve) => {
    let waiting = true
    const go = (): void => {
      if (!waiting) return
      waiting = false
      resolve()
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go)
    setTimeout(go, SOON_MS)
  })

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

/** The power the veil's share of the swap window is raised to. */
const VEIL_LATE = 2.5
/** The power the light's share of the swap window is raised to. */
const LIGHT_LATE = 2.5

export class GlobeStage implements Stage {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera()
  private readonly world = new THREE.Group()
  private readonly floor = new THREE.Group()
  private readonly globe = new THREE.Group()
  private readonly inside = new THREE.Group()
  private readonly slab = makeSlab()
  private readonly backdrop = new Backdrop()
  private readonly centre = new THREE.Vector3()
  private readonly shell = new Shell()
  /** The glass as the lens fill's map takes it when the globe itself is in focus: one closed surface with no blur. */
  private readonly keep = new THREE.Mesh(this.shell.shell.geometry, new THREE.MeshBasicMaterial({ color: 0x000000 }))
  private readonly draw = new ParticleDraw(outerRadiusMm)
  private readonly lighting: Lighting
  private readonly slice: THREE.Mesh
  private readonly sets = new Map<string, SeasonSet>()
  private readonly makings = new Map<string, Making>()
  private readonly colliders = new Map<string, SdfGrid>()
  private readonly prepared = new Map<string, Promise<void>>()
  private diag = ''
  private quality: StageQuality = { particleFraction: 1, shadowMapPx: config.live.quality.high.shadowMapPx, surfaceReflection: 'planar' }
  private readonly reflect = new ReflectMix()
  private readonly clear = new THREE.Color()
  private readonly frame: StageFrame
  private readonly pass: PassContext
  private readonly up = new THREE.Vector3()
  private readonly turn = new THREE.Quaternion()
  private drawn = false
  private inAir = false
  private into: string | null = null
  private intoAt = 0
  /** The picture the page paints into while it draws one sample a frame; none on a page that captures. */
  private live: THREE.WebGLRenderTarget | null = null
  private handing: Promise<void> = Promise.resolve()
  private readonly scratch = new Map<string, THREE.WebGLRenderTarget>()
  private stale = false

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
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight) o.layers.enable(HAND_LAYER)
    })
  }

  prepare(season: string): Promise<void> {
    let p = this.prepared.get(season)
    if (!p) {
      const kit = kitOf(season)
      const models = prepareGroup(this.assets, 'shared')
        .then(() => prepareGroup(this.assets, season))
        .then(() => kit.prepare?.())
      p = Promise.all([models, this.fetchCollider(season)]).then(() => this.make(season))
      this.prepared.set(season, p)
    }
    return p
  }

  expect(season: string): void {
    this.into = season
    this.intoAt = performance.now()
  }

  /** Whether a shake is in the air that does not go into `season`: nothing is made for a season the shake does not need. */
  private held(season: string): boolean {
    if (this.into !== null && !this.inAir && performance.now() - this.intoAt > PRESS_MS) this.into = null
    return (this.inAir || this.into !== null) && this.into !== season
  }

  /**
   * Builds a season's set. Before the first picture, and on a page that only captures, in one piece. Once the page draws, one
   * step a frame: built in one piece each season held the page's thread for 0.4 to 2 s, and the picture stood still for as long.
   */
  private async make(season: string): Promise<void> {
    const m = this.making(season)
    while (m.steps.length) {
      if (this.drawn) await this.turnFor(season)
      m.steps.shift()?.()
    }
    // Not waited for: the season can be shown from here on, and a frame that shows it before this is done makes the rest
    // itself, as it always did.
    if (this.live) this.handing = this.handing.then(() => this.hand(season))
  }

  /** The next frame in which something may be done for `season`: none while a shake is in the air that does not go into it. */
  private async turnFor(season: string): Promise<void> {
    do await frameOrSoon()
    while (this.held(season))
  }

  /** Resolves when every season asked for so far is built and, on a page that paints, in the GPU's hands. */
  settled(): Promise<void> {
    return Promise.allSettled([...this.prepared.values()]).then(() => this.handing)
  }

  private scratchOf(type: THREE.TextureDataType, samples: number): THREE.WebGLRenderTarget {
    const key = `${type} ${samples}`
    let t = this.scratch.get(key)
    if (!t) this.scratch.set(key, (t = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: true, stencilBuffer: false, samples })))
    return t
  }

  /**
   * Hands a season that is not on show to the GPU: its programs, its pictures, its buffers. The first frame that showed a
   * season made them all at once, and that frame is in the middle of the first shake into it. Here they are made a few a
   * frame while the picture rests. The programs are asked for first, all of them, so that a browser which links aside
   * (KHR_parallel_shader_compile) links them while the page draws on; then each mesh is drawn once, alone, into one pixel
   * of a picture of the page's own kind, which is the only way the renderer takes a buffer before the frame that needs it,
   * and which is where a browser that does not link aside waits for a program, one a frame.
   */
  private async hand(season: string): Promise<void> {
    const s = this.sets.get(season)
    const live = this.live
    if (!s || s.shown || !live) return
    const { renderer } = this.gfx
    const go = (): boolean => !s.shown && this.live !== null
    const meshes: Drawn[] = []
    for (const root of s.objects) root.traverse((o) => {
      const d = o as Drawn & { isPoints?: boolean; isLine?: boolean }
      if (d.material && (d.isMesh || d.isPoints || d.isLine)) meshes.push(d)
    })
    const aside = (target: THREE.WebGLRenderTarget, work: () => void): void => {
      const bound = renderer.getRenderTarget()
      const { calls, triangles, points, lines } = renderer.info.render
      renderer.setRenderTarget(target)
      try {
        work()
      } finally {
        renderer.setRenderTarget(bound)
        Object.assign(renderer.info.render, { calls, triangles, points, lines })
      }
    }
    const run = async (steps: (() => void)[]): Promise<void> => {
      for (let i = 0; i < steps.length && go(); ) {
        await this.turnFor(season)
        const from = performance.now()
        while (i < steps.length && go() && performance.now() - from < HAND_MS) steps[i++]!()
      }
    }
    const like = this.scratchOf(live.texture.type, live.samples)
    const linked: Promise<unknown>[] = []
    await run(
      meshes.map((d) => () =>
        aside(like, () => {
          const below = d.children
          d.children = []
          try {
            linked.push(renderer.compileAsync(d, this.camera, this.scene))
          } finally {
            d.children = below
          }
        }),
      ),
    )
    await Promise.all(linked)

    const pictures = new Set<THREE.Texture>([s.grid])
    for (const e of this.assets.entries(season)) if (e.picture && hasTexture(e.name)) pictures.add(texture(e.name))
    for (const d of meshes) for (const m of materialsOf(d)) for (const t of picturesOf(m, (renderer.properties.get(m) as Linked).uniforms)) pictures.add(t)
    await run([...pictures].map((t) => () => renderer.initTexture(t)))

    const draw = (d: Drawn, target: THREE.WebGLRenderTarget, cast: boolean): void =>
      aside(target, () => {
        const camera = this.camera
        const mask = camera.layers.mask
        const hidden: THREE.Object3D[] = []
        for (let o: THREE.Object3D | null = d; o; o = o.parent) if (!o.visible) hidden.push(o)
        const { frustumCulled, onBeforeRender, onAfterRender } = d
        const { start, count } = d.geometry.drawRange
        for (const o of hidden) o.visible = true
        d.layers.enable(HAND_LAYER)
        d.frustumCulled = false
        // What a mesh does before it is drawn reads the frame it is drawn into, and this is no frame.
        d.onBeforeRender = NOTHING
        d.onAfterRender = NOTHING
        camera.layers.set(HAND_LAYER)
        // The shadow pass has programs and buffers of its own. It leaves the map with this one mesh in it.
        renderer.shadowMap.needsUpdate = cast
        if (cast) this.stale = true
        try {
          renderer.render(this.scene, camera)
        } finally {
          renderer.shadowMap.needsUpdate = false
          camera.layers.mask = mask
          d.onBeforeRender = onBeforeRender
          d.onAfterRender = onAfterRender
          d.frustumCulled = frustumCulled
          d.layers.disable(HAND_LAYER)
          d.geometry.setDrawRange(start, count)
          for (const o of hidden) o.visible = false
        }
      })
    // What the table mirrors is drawn into a picture of another kind, and a card may keep a program apart for each kind.
    const mirrored = this.quality.surfaceReflection === 'planar' && live.samples > 0 ? this.scratchOf(live.texture.type, 0) : null
    await run(meshes.flatMap((d) => [() => draw(d, like, d.castShadow), ...(mirrored ? [() => draw(d, mirrored, false)] : [])]))
  }

  /**
   * The season's collider as the build made it (tools/lib/grids.mjs). Made here it held the page's thread for two to three
   * seconds a season, and the picture stood still for as long.
   */
  private async fetchCollider(season: string): Promise<void> {
    const version = `${__ENGINE_HASH__}${this.assets.index.seasonHashes[season] ?? ''}`
    const r = await fetch(new URL(gridAddress(season, version), document.baseURI))
    if (!r.ok || !r.body) throw new Error(`collider did not load: ${season}`)
    this.colliders.set(season, await readGrid(r.body))
  }

  /** The season's set, whole: whatever of it is still to be built is built now, because a frame that needs it is being drawn. */
  private set(season: string): SeasonSet {
    const made = this.sets.get(season)
    if (made) return made
    const m = this.making(season)
    for (let step = m.steps.shift(); step; step = m.steps.shift()) step()
    return this.sets.get(season)!
  }

  private making(season: string): Making {
    const begun = this.makings.get(season)
    if (begun) return begun
    const kit = kitOf(season)
    let base: THREE.Object3D
    let miniature: THREE.Object3D
    let arrival: THREE.Object3D
    let lights: THREE.Object3D
    let own: ReturnType<SeasonKit['dressing']>
    let grid: THREE.Data3DTexture
    const collect = (roots: THREE.Object3D[]): THREE.Material[] => {
      const out: THREE.Material[] = []
      for (const r of roots) r.traverse((o) => {
        const m = (o as THREE.Mesh).material
        if (m && !Array.isArray(m) && m.userData.stage) out.push(m)
      })
      return out
    }
    const m: Making = {
      steps: [
        () => void (base = kit.base()),
        () => void (miniature = kit.miniature()),
        () => void (arrival = kit.arrival()),
        () => void (lights = kit.lights()),
        () => void (own = kit.dressing()),
        () => void (grid = bakeGrid(kit.innerLights, this.collider(season))),
        () => {
          const dressing = own.surface
          const glass = [own.glass]
          this.globe.add(base)
          this.inside.add(miniature, arrival, lights, ...glass)
          this.floor.add(dressing)
          this.sets.set(season, {
            kit,
            objects: [base, miniature, arrival, lights, dressing, ...glass],
            lights,
            grid,
            materials: collect([base, miniature, lights, dressing, ...glass]),
            arrival: collect([arrival]),
            glass,
            shown: false,
          })
        },
      ],
    }
    this.makings.set(season, m)
    return m
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
    this.reflect.level()
  }

  collider(season: string): SdfGrid {
    kitOf(season)
    let c = this.colliders.get(season)
    if (!c) {
      // Asked before the season is prepared, which only a capture page does (its engine resets as the page starts): made here
      // as it always was, and the same to the bit as the build's (tests/collider-file.test.ts).
      c = kitOf(season).collider()
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
    this.drawn = true
    this.live = sample === null ? target : null
    // A mesh handed to the GPU since the last frame left the shadow map with nothing else in it.
    const cast = shadows || this.stale
    this.stale = false
    if (moment.beat !== null) this.inAir = true
    else if (this.inAir) {
      this.inAir = false
      this.into = null
    }
    const a = this.set(single ? moment.season : moment.from)
    const b = single ? a : this.set(moment.to)
    const change = single ? 0 : moment.change
    const u = stageUniforms
    const liquid = this.source.liquid
    const period = moment.period ?? config.scene.ambientPeriodSeconds
    const swap = config.shake.swapWindow
    const settle = config.shake.settleCheckSeconds
    const settled = Math.min(1, Math.max(0, moment.sinceLanding / settle))
    const swapping = moment.beat !== null && moment.beat >= swap.fromBeat
    const arrived = !swapping ? settled : single ? settled * (1 - partChange('shed', (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat))) : 0

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
    // The light inside crosses through the whole window, late: at the middle of the window the storm is still lit by the season
    // that leaves, and the new season's colour comes up with the flare that hides the base.
    f.mix.light = Math.pow(partChange('light', change), LIGHT_LATE)
    // The veil crosses through the whole window. Where the season that leaves has the thicker veil it crosses late: a sixth of the way
    // at the middle of the window, four tenths where the base begins to change. Crossed evenly, that storm stood in the new season's
    // colour a dozen frames before the outside of the globe. Where the season that comes has the thicker veil the crossing stays
    // even, because there the veil that comes is part of the cover of the swap.
    const veil = partChange('veil', change)
    f.mix.veil = a.kit.veil.density >= b.kit.veil.density ? Math.pow(veil, VEIL_LATE) : veil
    // Everything outside the glass reads this one number: the base, what the glass and the table show of it, the lights of the
    // backdrop and the light of the room cross in the same few frames, under the cover.
    f.mix.base = partChange('base', change)
    f.mix.particles = partChange('particles', change)
    f.mix.bloom = changeBloom(change)
    f.grids[0] = a.grid
    f.grids[1] = b.grid
    f.liquid = liquid
    f.turbulence = Math.min(1, Math.max(0, (liquid[6] ?? 0) / TURBULENCE_FULL))
    f.quality = this.quality
    f.reflect = this.reflect.frame(f.live, this.quality.surfaceReflection === 'planar', moment.time)
    f.planar = f.reflect > 0
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
    const of = sample?.of ?? 1
    u.uPass.value.set(moment.seed, sample ? passStep(sample.t, of) : 0, single ? 0 : (sample?.hold ?? change), of)
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
      s.shown = true
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
        drawPasses(this.pass, { shadows: cast && side === 0, mirror: false, sliceOnly: false, emitters: true }, f)
      }
      u.uLens.value.z = 1
      target.scissorTest = false
      target.viewport.set(0, 0, w, h)
      target.scissor.set(0, 0, w, h)
      renderer.setRenderTarget(target)
    } else {
      applyPose(this.camera, pose, w, h, sample)
      this.inside.updateWorldMatrix(true, false)
      this.inside.localToWorld(this.centre.set(0, CHANGE_BLOOM.glareSeat * collarY, 0))
      const reach = (CHANGE_BLOOM.glareReach * f.focalPx * outerRadiusMm) / (this.centre.distanceTo(this.camera.position) * h)
      this.centre.project(this.camera)
      lensState.glareAt.set(0.5 + 0.5 * this.centre.x, 0.5 + 0.5 * this.centre.y, reach)
      drawPasses(this.pass, { shadows: cast, mirror: view === '' && f.planar, sliceOnly, emitters: beauty }, f)
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
