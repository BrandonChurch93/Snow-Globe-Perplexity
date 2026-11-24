import * as THREE from 'three'
import { config } from '../config'
import type { Assets } from '../core/assets'
import type { Gfx } from '../core/gl'
import { MODE, setPresence, stageShader, stageUniforms, type Rgb } from '../core/materials'
import type { Sample } from '../core/sampler'
import type { Emitter, Moment, ParticleSource, SdfGrid, Stage, StageQuality } from '../core/stage'
import { flagStandIn } from '../core/standins'
import { preparedBytes, prepareGroup, setAnisotropy } from '../core/textures'
import { FLOW_RANGE_MM_S, LIGHT_RANGE, allParts, partBytes, viewCode } from '../diagnostics/views'
import { Shell, shellUniforms } from '../globe/shell'
import { ParticleDraw } from '../particles/draw/points'
import { kitOf, kits } from '../seasons'
import type { SeasonKit } from '../seasons/kit'
import { changeBloom, partChange } from '../shake/change'
import { Backdrop } from './backdrop'
import { applyPose, type Pose } from './cameras'
import { buildCollider, centreHeightMm, emitters as layoutEmitters, innerRadiusMm, outerRadiusMm } from './layout'
import { bakeGrid, flickerOf, gainOf, glowOf, gridBytes } from './lightgrid'
import { makeDressing, makeSlab, surfaceUniforms } from './surface'

interface SeasonSet {
  kit: SeasonKit
  objects: THREE.Object3D[]
  lights: THREE.Object3D
  grid: THREE.Data3DTexture
  materials: THREE.Material[]
  arrival: THREE.Material[]
}

const mixRgb = (a: Rgb, b: Rgb, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const MIRROR = new THREE.Matrix4().makeScale(1, -1, 1)
const CARD_SHARE = 0.14
const SHADOW_SOFTNESS = 3
const SHUTTER = (config.film.shutterDegrees / 360) * (config.sim.stepHz / config.film.fps)
const TURBULENCE_FULL = 260
const blankGrid = (): THREE.Data3DTexture => {
  const t = new THREE.Data3DTexture(new Uint16Array(4), 1, 1, 1)
  t.format = THREE.RGBAFormat
  t.type = THREE.HalfFloatType
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

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
  private readonly rig = new THREE.Group()
  private readonly key = new THREE.DirectionalLight(0xffffff, 1)
  private readonly rim = new THREE.DirectionalLight(0xffffff, 1)
  private readonly card = new THREE.DirectionalLight(0xffffff, 0)
  private readonly fill = new THREE.HemisphereLight(0xffffff, 0x000000, 1)
  private readonly glow = new THREE.PointLight(0xffffff, 0, 0, 0)
  private readonly slab = makeSlab()
  private readonly backdrop = new Backdrop()
  private readonly shell = new Shell()
  private readonly draw = new ParticleDraw(outerRadiusMm)
  private readonly slice: THREE.Mesh
  private readonly sets = new Map<string, SeasonSet>()
  private readonly colliders = new Map<string, SdfGrid>()
  private readonly prepared = new Map<string, Promise<void>>()
  private solid: SdfGrid | null = null
  private readonly empty = blankGrid()
  private diag = ''
  private quality: StageQuality = { particleFraction: 1, shadowMapPx: config.live.quality.high.shadowMapPx, surfaceReflection: 'planar' }
  private readonly savedShadow = new THREE.Matrix4()
  private readonly clear = new THREE.Color()

  constructor(private readonly gfx: Gfx, private readonly source: ParticleSource, private readonly assets: Assets) {
    const { scene, world, floor, globe, inside, rig, key, rim, card, fill, glow } = this
    scene.add(world, floor)
    world.add(globe, this.backdrop.group, rig)
    floor.add(this.slab)
    inside.position.y = centreHeightMm
    globe.add(inside)
    glow.position.y = centreHeightMm
    globe.add(glow)
    inside.add(this.shell.through, this.shell.shell, this.shell.bubble, this.shell.stamp, this.draw.points)

    this.slice = new THREE.Mesh(
      new THREE.CircleGeometry(innerRadiusMm, 96),
      stageShader({ part: 'light-engine', inside: true, uniforms: { uSlice: { value: new THREE.Vector4() }, uSpin: { value: new THREE.Vector3() }, uSlosh: { value: new THREE.Vector3() } }, fragment: SLICE, params: { side: THREE.DoubleSide } }),
    )
    this.slice.visible = false
    inside.add(this.slice)

    key.target.position.set(0, 70, 0)
    key.castShadow = true
    key.shadow.mapSize.set(this.quality.shadowMapPx, this.quality.shadowMapPx)
    const sc = key.shadow.camera
    sc.left = -130
    sc.right = 130
    sc.top = 150
    sc.bottom = -130
    sc.near = 100
    sc.far = 1200
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.6
    key.shadow.radius = SHADOW_SOFTNESS
    rig.add(key, key.target, rim, card, fill)

    for (const part of ['lens', 'light-engine']) flagStandIn(part)
    const { renderer } = gfx
    setAnisotropy(renderer.capabilities.getMaxAnisotropy())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.shadowMap.autoUpdate = false
    const range = gfx.gl.getParameter(gfx.gl.ALIASED_POINT_SIZE_RANGE) as Float32Array
    this.draw.maxPointPx = Math.min(1024, range[1] ?? 256)
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
    const dressing = makeDressing(kit)
    this.globe.add(base)
    this.inside.add(miniature, arrival, lights)
    this.floor.add(dressing)
    for (const part of ['glass-dressing', 'veil']) flagStandIn(`${part}-${season}`)
    const collect = (roots: THREE.Object3D[]): THREE.Material[] => {
      const out: THREE.Material[] = []
      for (const r of roots) r.traverse((o) => {
        const m = (o as THREE.Mesh).material
        if (m && !Array.isArray(m)) out.push(m)
      })
      return out
    }
    s = {
      kit,
      objects: [base, miniature, arrival, lights, dressing],
      lights,
      grid: bakeGrid(kit.innerLights, this.collider(season)),
      materials: collect([base, miniature, lights, dressing]),
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
    if (level.shadowMapPx !== this.quality.shadowMapPx) {
      this.key.shadow.mapSize.set(level.shadowMapPx, level.shadowMapPx)
      this.key.shadow.map?.dispose()
      this.key.shadow.map = null
    }
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
    const s = this.key.shadow.mapSize
    return s.x * s.y * 4 + this.sets.size * gridBytes + 64 * 64 * 4 + preparedBytes()
  }

  private orient(sign: number): void {
    this.world.scale.y = sign
    this.world.updateMatrixWorld(true)
    this.inside.getWorldPosition(stageUniforms.uLensCentre.value)
    stageUniforms.uGlobeInv.value.copy(this.inside.matrixWorld).invert()
  }

  private passes(shadows: boolean, mirror: boolean, sliceOnly: boolean, emitters: boolean): void {
    const { renderer } = this.gfx
    const key = this.key
    const { dome, lights } = this.backdrop
    this.floor.visible = false
    lights.visible = false
    this.orient(1)
    renderer.shadowMap.needsUpdate = shadows && !sliceOnly
    renderer.render(this.scene, this.camera)
    renderer.shadowMap.needsUpdate = false
    if (sliceOnly) return
    dome.visible = false
    lights.visible = emitters
    if (mirror) {
      this.orient(-1)
      this.savedShadow.copy(key.shadow.matrix)
      key.shadow.matrix.multiply(MIRROR)
      renderer.render(this.scene, this.camera)
      key.shadow.matrix.copy(this.savedShadow)
      this.orient(1)
    }
    this.globe.visible = false
    this.floor.visible = true
    renderer.render(this.scene, this.camera)
    this.globe.visible = true
    dome.visible = true
  }

  drawSample(target: THREE.WebGLRenderTarget, pose: Pose, sample: Sample | null, moment: Moment, shadows: boolean): void {
    const { renderer } = this.gfx
    const w = target.width
    const h = target.height
    const view = this.diag
    const beauty = view === '' || view === 'refraction'
    const sliceOnly = view === 'flow' || view === 'lightgrid'
    const live = sample === null && view === ''
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

    for (const s of this.sets.values()) {
      const on = !sliceOnly && (s === a || s === b)
      for (const o of s.objects) o.visible = on
      if (!on) continue
      const mode = single ? MODE.always : s === a ? MODE.outgoing : MODE.incoming
      for (const m of s.materials) setPresence(m, mode, 1)
      const here = single ? arrived : s === a ? 1 : 0
      for (const m of s.arrival) setPresence(m, mode, here)
      s.kit.update?.({ time: moment.time, period, sinceLanding: single || s === b ? moment.sinceLanding : Infinity, arrived: here, beat: moment.beat, seed: moment.seed })
      s.lights.traverse((o) => {
        const l = o.userData.light
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (l && m) m.emissiveIntensity = flickerOf(l, moment.time, period)
      })
    }
    this.shell.through.visible = !sliceOnly
    this.shell.shell.visible = !sliceOnly
    this.shell.bubble.visible = !sliceOnly
    this.shell.stamp.visible = !sliceOnly
    this.draw.points.visible = !sliceOnly
    this.backdrop.group.visible = !sliceOnly
    this.slab.visible = !sliceOnly
    this.slice.visible = sliceOnly

    const tLight = partChange('light', change)
    const tVeil = partChange('veil', change)
    const tOut = partChange('base', change)
    const bloom = changeBloom(change)
    const ka = a.kit
    const kb = b.kit

    u.uChange.value = change
    u.uDiag.value = beauty || sliceOnly ? 0 : viewCode(view)
    u.uSeed.value = moment.seed + (sample ? sample.index * 7.31 : 0)
    u.uLens.value.z = 1
    const focal = h / (2 * Math.tan((pose.fovDeg * Math.PI) / 360))
    u.uCoc.value.set(2 * pose.apertureMm * focal, 1 / pose.focusMm, 0)

    const turbulence = Math.min(1, Math.max(0, (liquid[6] ?? 0) / TURBULENCE_FULL))
    const veilTint = mixRgb(ka.veil.tint, kb.veil.tint, tVeil)
    const density = lerp(ka.veil.rest, kb.veil.rest, tVeil) + lerp(ka.veil.density, kb.veil.density, tVeil) * Math.pow(turbulence, 1.5)
    u.uVeil.value.set(veilTint[0], veilTint[1], veilTint[2], density)

    const keyCol = mixRgb(ka.rig.key.color, kb.rig.key.color, tLight)
    const keyPower = lerp(ka.rig.key.intensity, kb.rig.key.intensity, tLight)
    const keyFrom = mixRgb(ka.rig.key.from, kb.rig.key.from, tLight)
    const rimCol = mixRgb(ka.rig.rim.color, kb.rig.rim.color, tLight)
    const rimPower = lerp(ka.rig.rim.intensity, kb.rig.rim.intensity, tLight)
    const rimFrom = mixRgb(ka.rig.rim.from, kb.rig.rim.from, tLight)
    const sky = mixRgb(ka.rig.sky, kb.rig.sky, tLight)
    const ground = mixRgb(ka.rig.ground, kb.rig.ground, tLight)
    const fill = lerp(ka.rig.fill, kb.rig.fill, tLight)
    this.key.color.setRGB(keyCol[0], keyCol[1], keyCol[2])
    this.key.intensity = keyPower
    this.key.position.set(keyFrom[0], keyFrom[1], keyFrom[2])
    this.rim.color.setRGB(rimCol[0], rimCol[1], rimCol[2])
    this.rim.intensity = rimPower
    this.rim.position.set(rimFrom[0], rimFrom[1], rimFrom[2])
    const skyPeak = Math.max(sky[0], sky[1], sky[2], 1e-4)
    this.card.color.setRGB(sky[0] / skyPeak, sky[1] / skyPeak, sky[2] / skyPeak)
    this.card.intensity = keyPower * CARD_SHARE
    this.card.position.set(-keyFrom[0] * 0.9, keyFrom[1] * 0.3, Math.abs(keyFrom[2]) * 1.1)
    this.fill.color.setRGB(sky[0], sky[1], sky[2])
    this.fill.groundColor.setRGB(ground[0], ground[1], ground[2])
    this.fill.intensity = fill
    u.uVeilLight.value.set(sky[0] * fill * 0.6 + keyCol[0] * keyPower * 0.12, sky[1] * fill * 0.6 + keyCol[1] * keyPower * 0.12, sky[2] * fill * 0.6 + keyCol[2] * keyPower * 0.12)

    const gainA = gainOf(ka.innerLights, moment.time, period)
    const gainB = gainOf(kb.innerLights, moment.time, period) * (1 + 2.5 * bloom)
    u.uGridA.value = a.grid ?? this.empty
    u.uGridB.value = b.grid ?? this.empty
    u.uGrid.value.set(tLight, gainA, gainB, innerRadiusMm)
    const ga = glowOf(ka.innerLights)
    const gb = glowOf(kb.innerLights)
    const pool = mixRgb([ga[0] * gainA, ga[1] * gainA, ga[2] * gainA], [gb[0] * gainB, gb[1] * gainB, gb[2] * gainB], tLight)
    this.glow.color.setRGB(pool[0], pool[1], pool[2])
    this.glow.intensity = 0.12

    const g = moment.globe
    this.globe.position.set(g.x, g.y, g.z)
    this.globe.rotation.set(g.tiltX, 0, g.tiltZ)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.globe.quaternion.clone().invert())
    this.shell.placeBubble(up, new THREE.Vector3(liquid[3] ?? 0, liquid[4] ?? 0, liquid[5] ?? 0))

    const keyDir = new THREE.Vector3(keyFrom[0], keyFrom[1], keyFrom[2]).sub(this.key.target.position).normalize()
    const rimDir = new THREE.Vector3(rimFrom[0], rimFrom[1], rimFrom[2]).sub(this.key.target.position).normalize()
    const su = surfaceUniforms
    su.uKeyDir.value.copy(keyDir)
    su.uKeyCol.value.setRGB(keyCol[0] * keyPower, keyCol[1] * keyPower, keyCol[2] * keyPower)
    su.uSky.value.setRGB(sky[0] * fill, sky[1] * fill, sky[2] * fill)
    su.uFoot.value.set(g.x, g.z, config.globe.baseDiameterMm / 2, g.y)
    su.uPool.value.setRGB(pool[0], pool[1], pool[2])
    const planar = this.quality.surfaceReflection === 'planar'
    su.uReflect.value.set(planar ? 1 : 0, planar ? 0 : 1, 0, 0)
    const baked = mixRgb(ka.main, kb.main, tOut)
    su.uBaked.value.setRGB(baked[0], baked[1], baked[2])

    const sh = shellUniforms
    sh.uKeyDir.value.copy(keyDir)
    sh.uKeyCol.value.setRGB(keyCol[0] * keyPower, keyCol[1] * keyPower, keyCol[2] * keyPower)
    sh.uRimDir.value.copy(rimDir)
    sh.uRimCol.value.setRGB(rimCol[0] * rimPower, rimCol[1] * rimPower, rimCol[2] * rimPower)
    const dress = mixRgb(ka.glassDressing.tint, kb.glassDressing.tint, tOut)
    sh.uDress.value.set(dress[0], dress[1], dress[2], lerp(ka.glassDressing.amount, kb.glassDressing.amount, tOut))
    sh.uBloom.value.setRGB(gb[0] * bloom * 0.12, gb[1] * bloom * 0.12, gb[2] * bloom * 0.12)
    const shown = tOut < 0.5 ? ka.season : kb.season
    ;[partBytes('glass'), partBytes(`glass-dressing-${shown}`), partBytes(`veil-${tVeil < 0.5 ? ka.season : kb.season}`)].forEach((c, i) => sh.uOverlay.value[i]!.set(c[0] / 255, c[1] / 255, c[2] / 255))

    const lensOn = view === ''
    const blur = lensOn ? pose.apertureMm : 0
    this.backdrop.set(ka, kb, tOut, blur, pose.focusMm, sample ? sample.lu * blur : 0, sample ? sample.lv * blur : 0)

    const all: Record<string, { color: Rgb; glow: number }> = {}
    for (const k of kits) for (const [name, c] of Object.entries(k.particles)) all[name] ??= c
    this.draw.update(this.source, {
      mix: moment.mix,
      focalPx: focal,
      streak: live ? SHUTTER : 0,
      width: w,
      height: h,
      fraction: this.quality.particleFraction,
      clock: (((moment.time / period) % 1) + 1) % 1,
      colors: { from: ka.particles, to: kb.particles, all, mix: partChange('particles', change) },
      light: [sky[0] * fill * 0.8 + keyCol[0] * keyPower * 0.3, sky[1] * fill * 0.8 + keyCol[1] * keyPower * 0.3, sky[2] * fill * 0.8 + keyCol[2] * keyPower * 0.3],
      change: partChange('particles', change),
      diagnostic: view === 'cover',
    })

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
        this.passes(shadows && side === 0, false, false, true)
      }
      u.uLens.value.z = 1
      target.scissorTest = false
      target.viewport.set(0, 0, w, h)
      target.scissor.set(0, 0, w, h)
      renderer.setRenderTarget(target)
    } else {
      applyPose(this.camera, pose, w, h, sample)
      this.passes(shadows, view === '' && planar, sliceOnly, beauty)
    }
    renderer.autoClear = auto
    renderer.setClearColor(this.clear, alpha)
  }
}
