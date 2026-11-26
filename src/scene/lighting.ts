import * as THREE from 'three'
import { lightUniforms } from '../core/chunks/light'
import type { Rgb } from '../core/materials'
import { lensState } from '../post/grade'
import { lensFall } from '../post/post'
import type { StageFrame } from './frame'
import type { SeasonKit } from '../seasons/kit'
import { centreHeightMm, groundY, innerRadiusMm, outerRadiusMm } from './layout'
import { GRID, breathOf, gainOf, glowAt, glowOf, gridInfo, groupGains, shadeGrid } from './lightgrid'
import { lensIor } from '../globe/lens'
import { changeSpan } from '../shake/change'

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
  grid: { flat: 0.1, wrap: 0.3, specular: 1, openFloor: 0.35, air: 0.62, surface: 0.25 },
  bloomGain: 9,
  flood: { inside: 0.14, insideMm: 20, outside: 18, wrap: 0.35, near: 0.3, nearMm: 10, floor: 0.07, floorMm: 50, pool: 45, spill: 30, lens: 0.04, swellFrom: 0.12, swellTo: 0.975 },
  glow: { outside: 0.8, islandMm: innerRadiusMm * 0.88, lobe: 0.3, specular: 1 },
} as const

/**
 * The bloom of a change between two seasons, the cover of everything outside the glass that changes (change.ts, `CHANGE_COVER`).
 * The lights of the new season flare inside the glass and the camera answers as it would to a lamp lit in a dark room: its
 * exposure falls to `dim` of what it was. The lights inside rise by as much again, so the glass burns as it did, and everything
 * the room lights, the base, the table and the lamps of the backdrop, sinks into the dark: at `dim` the brightest lamp of a
 * backdrop is under the toe of the film, so nothing outside the glass is seen to change. The swell of every shake is not laid
 * on top of that flare: it gives way as the cover rises, and under the whole cover the lights inside are their resting
 * selves through the fallen exposure. Over that the lens spreads the flare (`glare`, the light it adds at the middle of the
 * flare, in the colour of the light inside, falling off round it as a bell `glareReach` radii of the glass wide; post.ts adds
 * it, the stage says where the glass is). Its middle burns out as a lamp looked into does and by the edge of the glass it is
 * under white, so the light has a source and is not a fog. `glareSeat` is where the flare is centred on the glass's axis, 0
 * the middle of the glass, 1 the plane where it sits in the base.
 * Nothing in the picture feeds the glare, no lamp of the room and no petal, and between two seasons the swell lays no light
 * on the base or the table, so under it the base is its own dark shape and never a lamp. The sides of the picture keep the
 * dark of the room: the light reads as pouring out of the glass, not as a pale frame. `lens` is the tint of the glow round
 * what burns, risen over `fall` of the swell from `swellFrom` of the window. The live picture has the same cover.
 */
export const CHANGE_BLOOM = { lens: 0.2, swellFrom: 0.56, fall: 0.6, dim: 0.005, glare: 2, glareReach: 0.7, glareSeat: 0.1 } as const

const SHADOW_OFF = 10

const smooth = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v))

/**
 * The light of a change inside the glass, by how far the swap window has run.
 * `whole` rises slowly from the first frames of the window, is 1 on every frame of the base's change and is gone before the window ends.
 * `glow` is the same rise to the frame the base begins to change. From there the light itself (the lift, not the gain's exponent)
 * falls smoothly over every frame the window leaves, so the fall is as easy to follow as the rise, and through the base's change
 * it is still above four tenths of its top.
 */
export function changeSwell(change: number, from: number = ROOM_RIG.flood.swellFrom): { whole: number; glow: number } {
  if (!(change > 0) || change >= 1) return { whole: 0, glow: 0 }
  const f = ROOM_RIG.flood
  const span = changeSpan('shed')
  const rise = (change - from) / (span.from - from)
  const lift = smooth((f.swellTo - change) / (f.swellTo - span.from))
  return {
    whole: smooth(Math.min(1, rise, (f.swellTo - change) / (f.swellTo - span.to))),
    glow: Math.min(smooth(Math.min(1, rise)), Math.log(1 + ROOM_RIG.bloomGain * lift) / Math.log(1 + ROOM_RIG.bloomGain)),
  }
}

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
    u.uRigPoint.value.set(ROOM_RIG.point.key, ROOM_RIG.point.rim, ROOM_RIG.point.sky, ROOM_RIG.grid.surface)
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
    const t = f.mix.base
    const inner = f.mix.light
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
    const swell = changeSwell(f.moment ? f.moment.change : 0, a === b ? ROOM_RIG.flood.swellFrom : CHANGE_BLOOM.swellFrom)
    const bloom = Math.pow(1 + ROOM_RIG.bloomGain, swell.glow)
    const lift = (bloom - 1) / ROOM_RIG.bloomGain
    const bloomA = a === b ? bloom : 1
    const cover = a === b ? 0 : f.mix.bloom
    lensFall.dim = Math.pow(CHANGE_BLOOM.dim, cover)
    const flare = 1 / lensFall.dim
    const gainA = gainOf(a.innerLights, f.time, f.period) * breath * bloomA
    const restB = gainOf(b.innerLights, f.time, f.period) * breath
    const swellB = Math.pow(bloom, 1 - cover)
    const gainB = restB * swellB
    this.shade(f.grids[0], a.rig.key.from)
    this.shade(f.grids[1], b.rig.key.from)
    u.uGridA.value = f.grids[0]
    u.uGridB.value = f.grids[1]
    u.uGrid.value.set(inner, gainA, gainB * flare, innerRadiusMm)
    groupGains(gridInfo(f.grids[0]), a.innerLights, f.time, f.period, u.uGridGainA.value).multiplyScalar(breath * bloomA)
    groupGains(gridInfo(f.grids[1]), b.innerLights, f.time, f.period, u.uGridGainB.value).multiplyScalar(breath * swellB * flare)

    const ga = glowOf(a.innerLights)
    const gb = glowOf(b.innerLights)
    // Between two seasons the swell lays nothing on the base and the table, which keep what the lights at rest lay on them: the
    // room is falling into the dark there, and a base or a table lit from the glass is a lamp, not a silhouette.
    const laidB = a === b ? gainB : restB
    const pool = mixRgb([ga[0] * gainA, ga[1] * gainA, ga[2] * gainA], [gb[0] * laidB, gb[1] * laidB, gb[2] * laidB], inner)
    const pa = glowAt(a.innerLights)
    const pb = glowAt(b.innerLights)
    this.at.set(lerp(pa[0], pb[0], inner), lerp(pa[1], pb[1], inner), lerp(pa[2], pb[2], inner))
    const more = a === b ? lift / bloom : 0
    const out = ROOM_RIG.glow.outside * GRID.glowReachMm * GRID.glowReachMm * (1 + ROOM_RIG.flood.spill * more)
    u.uLightGlow.value.set(pool[0] * out, pool[1] * out, pool[2] * out, groundY)
    u.uLightGlowAt.value.set(this.at.x, this.at.y, this.at.z, ROOM_RIG.glow.islandMm)
    this.glow.position.set(this.at.x, centreHeightMm + this.at.y, this.at.z)

    const cross = a === b ? 0 : f.mix.bloom * smooth(Math.min(1, lift / CHANGE_BLOOM.fall))
    const peak = Math.max(gb[0], gb[1], gb[2], 1e-4)
    const spill = 1 + ROOM_RIG.flood.pool * more
    f.pool.setRGB(pool[0] * spill, pool[1] * spill, pool[2] * spill)
    const lens = ROOM_RIG.flood.lens * lift + (CHANGE_BLOOM.lens * cross) / peak
    f.bloomTint.setRGB(gb[0] * lens, gb[1] * lens, gb[2] * lens)
    const glare = (CHANGE_BLOOM.glare * cover) / peak
    lensState.glare.setRGB(gb[0] * glare, gb[1] * glare, gb[2] * glare)
    const flood = swell.whole * breath
    u.uLightFlood.value.setRGB(gb[0] * flood, gb[1] * flood, gb[2] * flood)
    u.uLightFloodFloor.value.w = swell.whole > 0 && a === b ? (ROOM_RIG.flood.outside * lift) / swell.whole : 0
    u.uLightFloodAt.value.z = swell.whole > 0 ? (ROOM_RIG.flood.inside * lift) / swell.whole : 0
    if (f.pose) {
      u.uLightEye.value.set(f.pose.position.x - f.globe.x, f.pose.position.y - f.globe.y, f.pose.position.z - f.globe.z).applyMatrix3(u.uLightFrame.value)
      u.uLightEye.value.y -= centreHeightMm
    }
  }
}
