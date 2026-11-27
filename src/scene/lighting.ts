import * as THREE from 'three'
import { lightUniforms } from '../core/chunks/light'
import { baseRoom, pourUniforms, type Rgb } from '../core/materials'
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
 * The glass burns from inside and the camera answers as it would to a lamp lit in a dark room: its exposure falls to `dim` of
 * what it was at the whole cover, by the cover as an exponent. Everything inside the glass is held through that fall, the
 * lights of both seasons at their resting strength (`uLightBurn`; the glass's own windows and rim are held in shell.ts), so
 * the storm is seen as it was, and what the room sends in through the glass gives way to the storm's own light (`through` of
 * it is left at the whole cover, of the dimmer of the two seasons' rooms, so the rooms cross there and the storm's light does
 * not step: `rigInside`). Between two seasons the lights do not swell as they do in a shake that keeps its season: the cover
 * is their burning.
 *
 * The source is the brightest thing in the picture, and it is the storm. At the heart of the storm the scene's own flood
 * stands tight and strong (`heart` times the flood of a swell, within `heartMm` of the middle), so the storm itself is
 * brightest at the middle and falls off from it, stroke by stroke. The lens takes that as it takes a light too bright for
 * the film (post.ts): the picture is laid on itself so that the strongest channel of the storm at the middle of the heart
 * comes to `coreTop`, just over the white of the film, in every season alike (how many times over is read from the
 * picture; never more than `coreMost`). It is laid on itself by nearly the same number over the whole middle of the ball,
 * on a bell seated `coreAt` radii down the ball's axis that is flat on top and `coreReach` radii wide (to one part in e,
 * the way out to the power `coreRound`), and by none at the limb. So what falls off from the middle is the storm's own
 * light and not a shape the lens lays there: the white melts into the season's colour over about half the ball's radius,
 * the whole ball is full of light and has its own colour at the limb, and the strokes cross the heart as brighter and
 * darker streaks. It is the storm that glows and not a thing inside it. Under the picture the lens lays the air of the
 * storm, `air` times the storm's level at the heart in the storm's own colour, on a second bell that is round on top and
 * `airReach` radii wide (the power `airRound`): where a storm is thin, what stands behind it is a little more light in a
 * ball full of light and not a white shape with an outline. `core` is the white the lens adds on the square of that
 * second bell, tight at the very middle, so nothing dark stands there. What burns blooms wider (`bloom`: the lens's glow
 * is `1 + bloom` times itself at the whole cover), and the highlights of the limb are laid on themselves `limb` times
 * within `limbMm` of the ball's line, so they clip with the heart.
 *
 * Round the glass the lens lays a glow in the colour of the pour (`glow` at the limb, under white): round, on the limb of
 * the ball where the ball is in each span of the shutter (stage.ts says where; post.ts, `lensFall.seats`), falling off
 * outward over `glowOut` radii and inward over `glowIn`, cut where the base hides the ball and dead at the picture's edge.
 *
 * The room is still there, because the glass lights it. The light of the glass pours on the table in the new season's colour
 * from its first frame: `pour` times what the new season's lights at rest lay on the slab's own surface at the whole cover,
 * `pourOn` times on what lies there (the frost, the petals, the leaves, the slab's dust and lumps), so what is white there
 * stays under white and takes the colour of the light. It lies close round the foot, brightest there and falling off
 * outward, with the base's own shade in it (surface.ts, `slabPourShare`), and it is at its most where the cover is whole.
 * What lies on the table is lit by it while it leaves, in the frames before the base passes, and while the new comes down
 * with the cover's tail (change.ts, `DRESSING_CHANGE`); under the whole cover the table is bare and the pool lies on the slab.
 * The base stands in that light as a thing (materials.ts, `pourOnBase`): `base` times the lights at rest at the collar,
 * falling off over `baseMm` and `baseWhite` of the way to the colour of the light, so lip and shoulder go to white and lose
 * their carving; the flank takes `baseFlank` of that over `baseFlankMm` in the stuff's own colour alone, lifted from its
 * dark by `baseLift`, by a light that holds `baseTint` of the pour's colour and is white for the rest, so each base keeps
 * its own colour under the pour and only its lit rim takes the light's; a face that looks away from the glass takes
 * `baseUnder` of it. Under the pour a base keeps the room's own light through the fall of the exposure, `baseHold` of it at
 * the whole cover (materials.ts, `baseRoom`), so dark carved wood is dark carved wood there, stone is stone and the basket
 * is the basket. No flood is laid outside the glass under the cover: a flood there laid the colour of the light over the
 * whole flank and made every base one salmon thing. Both bases stand so through the frames in which one gives way to the
 * other (change.ts, `BASE_PASS`), and the eye follows the base from frame to frame.
 *
 * The mirror image of the glass in the slab is the glass and holds nothing that turns. Where the slab draws the stage a
 * second time it is the glass as that is drawn. Where the slab bakes it (the level `low`, a glow under the foot:
 * surface.ts, `uImage`) it is the lights inside at rest held through the fall, with `image` times what the new season's
 * lights at rest lay there added at the whole cover in the colour of the pour: one swell with the cover, never out.
 *
 * The lamps of the backdrop fall with the room and do not go out: at the whole cover a lamp keeps `lamps` of its light
 * (backdrop.ts draws it `f.lamps` times over, through the fallen exposure), by how far the picture has gone under the
 * cover (`f.mix.shown`) as an exponent, so it falls and comes back as the picture does, with the picture's own ease, and
 * not as the cover's exponent does. And what the fall takes from the dark of the backdrop is laid back over the whole
 * picture in the backdrop's own colour (`room` of it at the whole cover), lifted a little in the colour of the pour as a
 * room is by a lamp that flares in it (`wash`), so the corners keep a tone, the lamps stand on it and no part of the
 * picture is true black.
 *
 * Each change has its own colour of light, the arriving season's: what the glass pours on the table, the base and the
 * dressing, the glow round the limb and the wash take the colour of that season's own rig, its rim through its key (rig.ts:
 * winter's blue, spring's rose, summer's gold, fall's orange; `tint` of the way to it from the colour of its lamps, at the
 * lamps' strongest channel). The heart is white.
 *
 * The cover rises eased at both ends, is whole across the span and dies away as a tail that eases out, past the end of the
 * window (change.ts, `changeBloom`, `coverPlace`): everything here goes by that one number, `f.mix.bloom`, but the lamps,
 * which go by what it shows of the picture (`f.mix.shown`, `changeShown`). `swellFrom` is where in the window the tint of
 * the lens's glow begins to rise between two seasons. The live picture has the same cover.
 */
export const CHANGE_BLOOM = { swellFrom: 0.56, dim: 0.005, through: 0.45, heart: 4, heartMm: 14, core: 0.75, coreTop: 13, coreMost: 80, coreAt: 0.1, coreReach: 0.65, coreRound: 3, air: 1.25, airReach: 0.42, airRound: 2, bloom: 2.5, pour: 40, pourOn: 5, image: 5, base: 5, baseMm: 3.5, baseWhite: 0.8, baseUnder: 0.2, baseFlank: 0.03, baseFlankMm: 30, baseTint: 0, baseLift: 0.5, baseHold: 0.75, glow: 0.5, glowOut: 0.06, glowIn: 0.03, limb: 1, limbMm: 3, lamps: 0.2, tint: 1, room: 0.75, wash: 0.02 } as const

/**
 * The colour a change pours: the light of the arriving season's own rig, its rim through its key (rig.ts: winter's blue,
 * spring's rose, summer's gold, fall's orange), at the strength of the strongest channel of the arriving lamps, so the top
 * of the glow stands where it stood. `share` of the way to it from the colour of the lamps.
 */
export function pourColour(lamps: Rgb, rig: { key: { color: Rgb }; rim: { color: Rgb } }, share = CHANGE_BLOOM.tint): Rgb {
  const own: Rgb = [rig.rim.color[0] * rig.key.color[0], rig.rim.color[1] * rig.key.color[1], rig.rim.color[2] * rig.key.color[2]]
  const k = Math.max(lamps[0], lamps[1], lamps[2]) / Math.max(own[0], own[1], own[2], 1e-6)
  return [lerp(lamps[0], own[0] * k, share), lerp(lamps[1], own[1] * k, share), lerp(lamps[2], own[2] * k, share)]
}

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

const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * What a season's room sends in through the glass, as the storm and the miniature take it (chunks/light.ts, `uRigInside.x`
 * times the key and times as much of the card as reaches inside): one number, the luma of the two.
 */
export function rigInside(rig: SeasonKit['rig']): number {
  const c = cardOf(rig)
  return luma(rig.key.color[0], rig.key.color[1], rig.key.color[2]) * rig.key.intensity + luma(c.color[0], c.color[1], c.color[2]) * c.intensity * c.inside
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
    this.turn.makeRotationFromEuler(this.tilt.set(f.globe.tiltX, f.globe.twist ?? 0, f.globe.tiltZ, 'XZY'))
    u.uLightFrame.value.setFromMatrix4(this.turn).transpose()

    const C = CHANGE_BLOOM
    const breath = breathOf(f.time, f.period)
    const swell = changeSwell(f.moment ? f.moment.change : 0, a === b ? ROOM_RIG.flood.swellFrom : C.swellFrom)
    const bloom = Math.pow(1 + ROOM_RIG.bloomGain, swell.glow)
    const lift = (bloom - 1) / ROOM_RIG.bloomGain
    const two = a !== b
    // The swell of a shake that keeps its season. Between two seasons the lights do not swell: they burn by the cover.
    const swellA = two ? 1 : bloom
    // The cover stands between two seasons and through its tail, where the season that came stands alone.
    const cover = f.mix.bloom
    lensFall.dim = Math.pow(C.dim, cover)
    const flare = 1 / lensFall.dim
    const restA = gainOf(a.innerLights, f.time, f.period) * breath
    const gainA = restA * swellA
    const restB = gainOf(b.innerLights, f.time, f.period) * breath
    const gainB = restB * swellA
    this.shade(f.grids[0], a.rig.key.from)
    this.shade(f.grids[1], b.rig.key.from)
    u.uGridA.value = f.grids[0]
    u.uGridB.value = f.grids[1]
    u.uGrid.value.set(inner, gainA * flare, gainB * flare, innerRadiusMm)
    u.uLightBurn.value = flare
    // The two rooms do not send the same light in through the glass (summer's low sun is near four times fall's dim key), and
    // the rooms cross in three frames under the whole cover: there the storm's own light stepped with them. So under the cover
    // the room's light inside stands at one level on both sides of the crossing, the dimmer season's (`rigInside`), and
    // `through` of that: the brighter season's falls to it as the cover rises or comes up from it as the cover dies away, by
    // the cover as an exponent, and the crossing itself passes the colour and the direction and no light. On the tail the
    // season that came stands alone and the frame names the one it came from.
    const sentNow = luma(f.keyCol.r, f.keyCol.g, f.keyCol.b) + luma(cardCol[0], cardCol[1], cardCol[2]) * lerp(ca.inside, cb.inside, t)
    const sentLeast = Math.min(rigInside(f.left ? f.left.rig : a.rig), rigInside(b.rig))
    u.uRigInside.value.x = ROOM_RIG.inside.through * flare * Math.pow(C.through * (sentNow > 0 ? sentLeast / sentNow : 1), cover)
    groupGains(gridInfo(f.grids[0]), a.innerLights, f.time, f.period, u.uGridGainA.value).multiplyScalar(breath * swellA * flare)
    groupGains(gridInfo(f.grids[1]), b.innerLights, f.time, f.period, u.uGridGainB.value).multiplyScalar(breath * swellA * flare)

    const ga = glowOf(a.innerLights)
    const gb = glowOf(b.innerLights)
    // What a change pours and what the lens lays round the glass are in the arriving season's own colour, not its lamps'.
    const gt = two || cover > 0 ? pourColour(gb, b.rig) : gb
    // What the lights inside lay on the base and the table at rest is held through the fallen exposure. The burning of the
    // lights is not laid there a second time: what the cover lays is the pour.
    const pool = mixRgb([ga[0] * gainA * flare, ga[1] * gainA * flare, ga[2] * gainA * flare], [gb[0] * gainB * flare, gb[1] * gainB * flare, gb[2] * gainB * flare], inner)
    // The mirror image of the glass that the slab bakes (the level `low`) is the glass's own light: the lights inside at rest
    // through the fallen exposure, and on top of that the pour in its colour, as much of it as the cover is whole.
    const burn = restB * flare * C.image * cover
    // The pour is the new season's light from its first frame: on the table's own surface many times what lies there at rest, on
    // what lies on the table (the frost, the petals, the leaves) less, so that what is white there stays under white and takes
    // the colour of the light. `f.pool` is what the slab and the glass take, `f.poolOn` what the frost on the slab takes, of
    // which `f.pourOn` is the pour's share; the petals and the leaves take the same through `uLightGlow`.
    const pourOn = restB * flare * C.pourOn * cover
    const pourTable = restB * flare * C.pour * cover
    const pa = glowAt(a.innerLights)
    const pb = glowAt(b.innerLights)
    this.at.set(lerp(pa[0], pb[0], inner), lerp(pa[1], pb[1], inner), lerp(pa[2], pb[2], inner))
    const more = a === b ? lift / bloom : 0
    const out = ROOM_RIG.glow.outside * GRID.glowReachMm * GRID.glowReachMm * (1 + ROOM_RIG.flood.spill * more)
    u.uLightGlow.value.set((pool[0] + gt[0] * pourOn) * out, (pool[1] + gt[1] * pourOn) * out, (pool[2] + gt[2] * pourOn) * out, groundY)
    u.uLightGlowAt.value.set(this.at.x, this.at.y, this.at.z, ROOM_RIG.glow.islandMm)
    this.glow.position.set(this.at.x, centreHeightMm + this.at.y, this.at.z)

    const peak = Math.max(gb[0], gb[1], gb[2], 1e-4)
    const spill = 1 + ROOM_RIG.flood.pool * more
    f.pool.setRGB((pool[0] + gt[0] * pourTable) * spill, (pool[1] + gt[1] * pourTable) * spill, (pool[2] + gt[2] * pourTable) * spill)
    f.poolOn.setRGB((pool[0] + gt[0] * pourOn) * spill, (pool[1] + gt[1] * pourOn) * spill, (pool[2] + gt[2] * pourOn) * spill)
    f.pourOn.setRGB(gt[0] * pourOn * spill, gt[1] * pourOn * spill, gt[2] * pourOn * spill)
    f.image.setRGB((pool[0] + gt[0] * burn) * spill, (pool[1] + gt[1] * burn) * spill, (pool[2] + gt[2] * burn) * spill)
    const lens = ROOM_RIG.flood.lens * lift
    f.bloomTint.setRGB(gb[0] * lens, gb[1] * lens, gb[2] * lens)
    // The glow of the lens round the glass, in the colour of the pour (post.ts lays it, the stage says where the glass is).
    const glare = (C.glow * cover) / peak
    lensState.glare.setRGB(gt[0] * glare, gt[1] * glare, gt[2] * glare)
    lensFall.reach.set(C.glowOut, C.glowIn)
    lensFall.bloom = 1 + C.bloom * cover
    // The heart of the storm as the lens takes it: the storm's own picture laid on itself, by one number over the middle of
    // the ball and by none at the limb, so its strokes cross the light and what falls off from the middle is the storm's own
    // light. At the very heart the lens adds its own white, as it does of a light too bright for the film, tight inside
    // that, so nothing dark stands in the middle of the heart.
    const core = C.core * cover
    lensFall.heart.setRGB(core, core, core)
    // The air of the storm is laid under it first (`air` times the storm's level at the whole cover), and the level the heart
    // is brought to is told with the air in it, so the middle of the heart comes to the one white at every cover.
    lensFall.heartShape.set(C.coreAt, C.coreReach, C.coreTop / (1 + C.air), C.coreMost)
    lensFall.heartShare = cover
    lensFall.air = Math.pow(1 + C.air, cover) - 1
    lensFall.bell.set(C.coreRound, C.airReach, C.airRound)
    // The highlights of the limb bloom with it: what the picture holds on the limb of the ball is laid there again, `limb` times.
    lensFall.limb.set(C.limb * cover, C.limbMm / outerRadiusMm)
    // The lamps of the backdrop fall with the exposure and do not go out (backdrop.ts draws them this many times over). They
    // are not white as the glass is, so they answer an exponent evenly: they fall by how far the picture has gone.
    f.lamps = Math.pow(C.lamps, f.mix.shown) * flare
    // The room away from the glass keeps its own tone under the fallen exposure: what the fall takes from the dark of the
    // backdrop is laid back in that season's own colour, so the corners hold and the lamps stand faint on it. The light of the
    // glass lifts it a little in the colour of the pour, as a room is lifted by a lamp that flares in it.
    const room = (1 - (1 - C.room) * cover) * (1 - lensFall.dim)
    const wash = (C.wash * cover) / peak
    const wa = a.backdrop.room
    const wb = b.backdrop.room
    lensFall.room.setRGB(lerp(wa[0], wb[0], f.mix.base) * room + gt[0] * wash, lerp(wa[1], wb[1], f.mix.base) * room + gt[1] * wash, lerp(wa[2], wb[2], f.mix.base) * room + gt[2] * wash)
    // What a base takes of the pour whatever it is made of (`pourOnBase`), through the fallen exposure.
    const onBase = restB * flare * C.base * cover
    pourUniforms.uPourBase.value.setRGB(gt[0] * onBase, gt[1] * onBase, gt[2] * onBase)
    pourUniforms.uPourBaseShape.value.set(C.baseMm, C.baseWhite, C.baseUnder, C.baseLift)
    pourUniforms.uPourBaseFlank.value.set(C.baseFlank, C.baseFlankMm, C.baseTint)
    // What a base keeps of the room's own light through the fall (materials.ts, `baseRoom`): the room's lights again, held.
    const hold = flare * (1 - (1 - C.baseHold) * cover)
    const held = baseRoom.uniforms
    baseRoom.hold = hold
    held.uRigKeyCol.value.copy(u.uRigKeyCol.value).multiplyScalar(hold)
    held.uRigRimCol.value.copy(u.uRigRimCol.value).multiplyScalar(hold)
    held.uRigCardCol.value.copy(u.uRigCardCol.value).multiplyScalar(hold)
    held.uRigSky.value.copy(u.uRigSky.value).multiplyScalar(hold)
    held.uRigGround.value.copy(u.uRigGround.value).multiplyScalar(hold)
    held.uRigRoom.value.copy(u.uRigRoom.value)
    held.uRigRoom.value.x *= hold
    held.uRigRoom.value.y *= hold
    if (cover > 0) {
      // Under the cover the scene's own flood stands at the heart of the storm alone, in the colour of the pour. Outside the
      // glass there is none: what the cover lays on a base is the pour, over the room's own light held (`baseRoom`).
      u.uLightFlood.value.setRGB(gt[0] * restB, gt[1] * restB, gt[2] * restB)
      u.uLightFloodFloor.value.w = 0
      u.uLightFloodAt.value.z = ROOM_RIG.flood.inside * flare * C.heart * cover
      u.uLightFloodAt.value.w = lerp(ROOM_RIG.flood.insideMm, C.heartMm, cover)
    } else {
      u.uLightFloodAt.value.w = ROOM_RIG.flood.insideMm
      const flood = swell.whole * breath
      u.uLightFlood.value.setRGB(gb[0] * flood, gb[1] * flood, gb[2] * flood)
      u.uLightFloodFloor.value.w = swell.whole > 0 && !two ? (ROOM_RIG.flood.outside * lift) / swell.whole : 0
      u.uLightFloodAt.value.z = swell.whole > 0 ? (ROOM_RIG.flood.inside * lift) / swell.whole : 0
    }
    if (f.pose) {
      u.uLightEye.value.set(f.pose.position.x - f.globe.x, f.pose.position.y - f.globe.y, f.pose.position.z - f.globe.z).applyMatrix3(u.uLightFrame.value)
      u.uLightEye.value.y -= centreHeightMm
    }
  }
}
