import * as THREE from 'three'
import { lightUniforms } from '../core/chunks/light'
import type { Rgb } from '../core/materials'
import type { StageFrame } from './frame'
import type { SeasonKit } from '../seasons/kit'
import { centreHeightMm, groundY, innerRadiusMm, outerRadiusMm } from './layout'
import { GRID, breathOf, gainOf, glowAt, glowOf, gridInfo, groupGains, shadeGrid } from './lightgrid'
import { lensIor } from '../globe/lens'
import { changeBloom } from '../shake/change'

const mixRgb = (a: Rgb, b: Rgb, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type RigCard = NonNullable<SeasonKit['rig']['card']>

export const ROOM_RIG = {
  targetMm: [0, 70, 0] as Rgb,
  shadow: { halfWidthMm: 130, topMm: 150, bottomMm: -130, nearMm: 100, farMm: 1200, normalBiasMm: 0.6, biasMm: 0.45, tiltLimit: 4, sureFrom: 0.06, sureTo: 0.32 },
  keySpread: 0.16,
  shadowMinMm: 0.35,
  shadowMaxMm: 6,
  keyLobe: 0.18,
  keySpecular: 1,
  rimWrap: 0.12,
  rimSpecular: 1,
  card: { share: 0.1, side: -0.9, lift: 0.3, front: 1.1, wrap: 0.5, specular: 0, inside: 1, lobe: 0.25 },
  inside: { through: 0.5, wrap: 0.1, spread: 1.6, bounce: 0.08, sky: 0.15, axis: [0, 0.45, 1] as Rgb, pull: 0.3 },
  point: { key: 0.4, rim: 0.1, sky: 0.32 },
  room: { gain: 1, lights: 1, softPerRough: 0.5, lightsBelowRough: 0.62 },
  grid: { flat: 0.1, wrap: 0.3, specular: 1, openFloor: 0.35, air: 0.62 },
  bloomGain: 9,
  flood: { inside: 12, insideMm: 8, outside: 18, ease: 4, wrap: 0.35, near: 0.3, nearMm: 10, floor: 0.18, floorMm: 50, pool: 45 },
  glow: { outside: 0.8, islandMm: innerRadiusMm * 0.88, lobe: 0.3, specular: 1 },
} as const

const SHADOW_OFF = 10

export function keyInside(from: Rgb): [number, number, number] {
  const t = ROOM_RIG.targetMm
  const a = ROOM_RIG.inside.axis
  const k = ROOM_RIG.inside.pull
  const x = from[0] - t[0]
  const y = from[1] - t[1]
  const z = from[2] - t[2]
  const len = Math.hypot(x, y, z) || 1
  const al = Math.hypot(a[0], a[1], a[2]) || 1
  const px = (x / len) * (1 - k) + (a[0] / al) * k
  const py = (y / len) * (1 - k) + (a[1] / al) * k
  const pz = (z / len) * (1 - k) + (a[2] / al) * k
  const pl = Math.hypot(px, py, pz) || 1
  return [px / pl, py / pl, pz / pl]
}

export function cardOf(rig: SeasonKit['rig']): RigCard {
  if (rig.card) return rig.card
  const c = ROOM_RIG.card
  const peak = Math.max(rig.sky[0], rig.sky[1], rig.sky[2], 1e-4)
  return {
    color: [rig.sky[0] / peak, rig.sky[1] / peak, rig.sky[2] / peak],
    intensity: rig.key.intensity * c.share,
    from: [rig.key.from[0] * c.side, rig.key.from[1] * c.lift, Math.abs(rig.key.from[2]) * c.front],
    wrap: c.wrap,
    specular: c.specular,
    inside: c.inside,
  }
}

export class Lighting {
  readonly rig = new THREE.Group()
  readonly key = new THREE.DirectionalLight(0x000000, 0)
  readonly rim = new THREE.DirectionalLight(0x000000, 0)
  readonly card = new THREE.DirectionalLight(0x000000, 0)
  readonly fill = new THREE.HemisphereLight(0x000000, 0x000000, 0)
  readonly glow = new THREE.PointLight(0x000000, 0, 0, 0)
  private readonly turn = new THREE.Matrix4()
  private readonly tilt = new THREE.Euler()
  private readonly at = new THREE.Vector3()

  constructor(shadowMapPx: number) {
    const { key } = this
    const s = ROOM_RIG.shadow
    key.target.position.set(ROOM_RIG.targetMm[0], ROOM_RIG.targetMm[1], ROOM_RIG.targetMm[2])
    key.castShadow = true
    key.shadow.mapSize.set(shadowMapPx, shadowMapPx)
    const sc = key.shadow.camera
    sc.left = -s.halfWidthMm
    sc.right = s.halfWidthMm
    sc.top = s.topMm
    sc.bottom = s.bottomMm
    sc.near = s.nearMm
    sc.far = s.farMm
    key.shadow.bias = SHADOW_OFF
    key.shadow.normalBias = s.normalBiasMm
    key.shadow.radius = 0
    this.rim.visible = false
    this.card.visible = false
    this.fill.visible = false
    this.glow.visible = false
    this.rig.add(key, key.target, this.rim, this.card, this.fill)
    this.glow.position.y = centreHeightMm
    const u = lightUniforms
    u.uRigShadow.value.set(ROOM_RIG.keySpread, ROOM_RIG.shadowMinMm, 1 / (s.farMm - s.nearMm), s.biasMm)
    u.uRigShadowUv.value.set(1 / (2 * s.halfWidthMm), 1 / (s.topMm - s.bottomMm), ROOM_RIG.shadowMaxMm, s.tiltLimit)
    u.uRigInside.value.set(ROOM_RIG.inside.through, 1 - 1 / lensIor, ROOM_RIG.inside.wrap, ROOM_RIG.inside.spread)
    u.uRigLobe.value.set(ROOM_RIG.keyLobe, ROOM_RIG.keySpecular, ROOM_RIG.rimWrap, ROOM_RIG.rimSpecular)
    u.uRigRoom.value.set(ROOM_RIG.room.gain, ROOM_RIG.room.lights, ROOM_RIG.room.softPerRough, ROOM_RIG.room.lightsBelowRough)
    u.uGridShade.value.set(ROOM_RIG.grid.flat, ROOM_RIG.grid.wrap, ROOM_RIG.grid.specular, ROOM_RIG.grid.openFloor)
    u.uGridAir.value = ROOM_RIG.grid.air * ROOM_RIG.grid.air
    u.uRigGlow.value.set(ROOM_RIG.glow.lobe, ROOM_RIG.glow.specular, s.sureFrom, s.sureTo)
    u.uRigPoint.value.set(ROOM_RIG.point.key, ROOM_RIG.point.rim, ROOM_RIG.point.sky, 0)
    u.uLightFloodAt.value.set(outerRadiusMm, ROOM_RIG.flood.wrap, ROOM_RIG.flood.inside, ROOM_RIG.flood.insideMm)
    u.uLightFloodFloor.value.set(-centreHeightMm, ROOM_RIG.flood.floorMm, ROOM_RIG.flood.floor, ROOM_RIG.flood.outside)
    u.uLightFloodNear.value.set(ROOM_RIG.flood.near, ROOM_RIG.flood.nearMm)
  }

  private shade(grid: THREE.Texture | null, from: Rgb): void {
    shadeGrid(grid, keyInside(from), 1 - 1 / lensIor, ROOM_RIG.keySpread * ROOM_RIG.inside.spread)
  }

  setShadowMap(px: number): void {
    if (px === this.key.shadow.mapSize.x) return
    this.key.shadow.mapSize.set(px, px)
    this.key.shadow.map?.dispose()
    this.key.shadow.map = null
  }

  shadowBytes(): number {
    const s = this.key.shadow.mapSize
    return s.x * s.y * 4
  }

  update(f: StageFrame): void {
    const a = f.from
    const b = f.to
    const t = f.mix.light
    const u = lightUniforms
    const keyCol = mixRgb(a.rig.key.color, b.rig.key.color, t)
    const keyPower = lerp(a.rig.key.intensity, b.rig.key.intensity, t)
    const keyFrom = mixRgb(a.rig.key.from, b.rig.key.from, t)
    const rimCol = mixRgb(a.rig.rim.color, b.rig.rim.color, t)
    const rimPower = lerp(a.rig.rim.intensity, b.rig.rim.intensity, t)
    const rimFrom = mixRgb(a.rig.rim.from, b.rig.rim.from, t)
    const sky = mixRgb(a.rig.sky, b.rig.sky, t)
    const ground = mixRgb(a.rig.ground, b.rig.ground, t)
    const fill = lerp(a.rig.fill, b.rig.fill, t)
    const target = this.key.target.position
    this.key.position.set(keyFrom[0], keyFrom[1], keyFrom[2])
    this.rim.position.set(rimFrom[0], rimFrom[1], rimFrom[2])
    const ca = cardOf(a.rig)
    const cb = cardOf(b.rig)
    const cardFrom = mixRgb(ca.from, cb.from, t)
    const cardCol = mixRgb([ca.color[0] * ca.intensity, ca.color[1] * ca.intensity, ca.color[2] * ca.intensity], [cb.color[0] * cb.intensity, cb.color[1] * cb.intensity, cb.color[2] * cb.intensity], t)
    this.card.position.set(cardFrom[0], cardFrom[1], cardFrom[2])

    f.keyDir.set(keyFrom[0], keyFrom[1], keyFrom[2]).sub(target).normalize()
    f.rimDir.set(rimFrom[0], rimFrom[1], rimFrom[2]).sub(target).normalize()
    f.keyCol.setRGB(keyCol[0] * keyPower, keyCol[1] * keyPower, keyCol[2] * keyPower)
    f.rimCol.setRGB(rimCol[0] * rimPower, rimCol[1] * rimPower, rimCol[2] * rimPower)
    f.sky.setRGB(sky[0], sky[1], sky[2])
    f.ground.setRGB(ground[0], ground[1], ground[2])
    f.fill = fill
    f.ambient.setRGB(sky[0] * fill, sky[1] * fill, sky[2] * fill)

    u.uRigKeyDir.value.copy(f.keyDir)
    const keyIn = keyInside(keyFrom)
    u.uRigKeyIn.value.set(keyIn[0], keyIn[1], keyIn[2])
    u.uRigKeyCol.value.copy(f.keyCol)
    u.uRigRimDir.value.copy(f.rimDir)
    u.uRigRimCol.value.copy(f.rimCol)
    u.uRigCardDir.value.copy(this.card.position).sub(target).normalize()
    u.uRigCardCol.value.setRGB(cardCol[0], cardCol[1], cardCol[2])
    u.uRigCard.value.set(lerp(ca.wrap, cb.wrap, t), ROOM_RIG.card.lobe, lerp(ca.specular, cb.specular, t), lerp(ca.inside, cb.inside, t))
    u.uRigSky.value.setRGB(sky[0] * fill, sky[1] * fill, sky[2] * fill)
    u.uRigBounce.value.set(f.keyCol.r * ROOM_RIG.inside.bounce, f.keyCol.g * ROOM_RIG.inside.bounce, f.keyCol.b * ROOM_RIG.inside.bounce, ROOM_RIG.inside.sky)
    u.uRigGround.value.setRGB(ground[0] * fill, ground[1] * fill, ground[2] * fill)
    this.turn.makeRotationFromEuler(this.tilt.set(f.globe.tiltX, 0, f.globe.tiltZ))
    u.uLightFrame.value.setFromMatrix4(this.turn).transpose()

    const breath = breathOf(f.time, f.period)
    const through = f.moment && f.moment.from === f.moment.to ? changeBloom(f.moment.change) : f.mix.bloom
    const bloom = 1 + ROOM_RIG.bloomGain * through
    const bloomA = a === b ? bloom : 1
    const gainA = gainOf(a.innerLights, f.time, f.period) * breath * bloomA
    const gainB = gainOf(b.innerLights, f.time, f.period) * breath * bloom
    this.shade(f.grids[0], a.rig.key.from)
    this.shade(f.grids[1], b.rig.key.from)
    u.uGridA.value = f.grids[0]
    u.uGridB.value = f.grids[1]
    u.uGrid.value.set(t, gainA, gainB, innerRadiusMm)
    groupGains(gridInfo(f.grids[0]), a.innerLights, f.time, f.period, u.uGridGainA.value).multiplyScalar(breath * bloomA)
    groupGains(gridInfo(f.grids[1]), b.innerLights, f.time, f.period, u.uGridGainB.value).multiplyScalar(breath * bloom)

    const ga = glowOf(a.innerLights)
    const gb = glowOf(b.innerLights)
    const pool = mixRgb([ga[0] * gainA, ga[1] * gainA, ga[2] * gainA], [gb[0] * gainB, gb[1] * gainB, gb[2] * gainB], t)
    const pa = glowAt(a.innerLights)
    const pb = glowAt(b.innerLights)
    this.at.set(lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), lerp(pa[2], pb[2], t))
    const out = ROOM_RIG.glow.outside * GRID.glowReachMm * GRID.glowReachMm
    u.uLightGlow.value.set(pool[0] * out, pool[1] * out, pool[2] * out, groundY)
    u.uLightGlowAt.value.set(this.at.x, this.at.y, this.at.z, ROOM_RIG.glow.islandMm)
    this.glow.position.set(this.at.x, centreHeightMm + this.at.y, this.at.z)

    const spill = 1 + (ROOM_RIG.flood.pool * through) / bloom
    f.pool.setRGB(pool[0] * spill, pool[1] * spill, pool[2] * spill)
    f.bloomTint.setRGB(gb[0] * through, gb[1] * through, gb[2] * through)
    const flood = through * breath
    u.uLightFlood.value.setRGB(gb[0] * flood, gb[1] * flood, gb[2] * flood)
    const ease = through > 0 ? Math.expm1(ROOM_RIG.flood.ease * through) / (Math.expm1(ROOM_RIG.flood.ease) * through) : 0
    u.uLightFloodFloor.value.w = ROOM_RIG.flood.outside * ease
    u.uLightFloodAt.value.z = ROOM_RIG.flood.inside * ease
    if (f.pose) {
      u.uLightEye.value.set(f.pose.position.x - f.globe.x, f.pose.position.y - f.globe.y, f.pose.position.z - f.globe.z).applyMatrix3(u.uLightFrame.value)
      u.uLightEye.value.y -= centreHeightMm
    }
  }
}
