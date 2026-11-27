import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { config } from '../../../config'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial, type Rgb } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { GLOW, glowGeometry, glowMaterial, glowPiece, haloGeometry, haloMaterial } from '../../../miniature/glow'
import { MIRROR_GLSL, MIRROR_MAX, mirrorUniforms } from '../../../miniature/mirror'
import { prepareVillage, tileMm, villageGeometry, villageGrain } from '../../../miniature/model'
import { lampFlame, lampFoot, shrubDistance } from '../../../miniature/roof'
import { BUMP_GLSL, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, surfacing, type GlowSource } from '../../../miniature/surface'
import { anchors, cottage as house, cottageFrame, groundAt, moundAt, moundSlope, pond, solidDistance, tree } from '../../../scene/layout'
import { gainOf } from '../../../scene/lightgrid'
import { ROW } from '../../../scene/steps'
import type { InnerLight, KitMoment } from '../../kit'
import { lanterns, type Lantern } from './lanterns'
import { isTree, season, tones } from './palette'
import { riseAt, SUN_TUFT } from './turf'

const MODEL = 'summer/village-summer.glb'
const TURF = 'summer/village-turf.lin.tile.png'
const PART = `miniature-${season}`
const LIGHT = `light-${season}`

const LAMP = { power: 3, reachMm: 12, flicker: 0.05, cycles: 3, phase: 0.1 }
const WINDOW = { power: 0.9, reachMm: 8, flicker: 0.1, cycles: 5, phase: 0.4 }
const NEAR = { lamp: { power: 2.1, reachMm: 7 }, pane: { power: 2.2, reachMm: 4 }, paper: { power: 2.6, reachMm: 7 } }
// The lawn takes less of it than the water: by the door and under the lanterns it is lit by their pools, not washed green.
const NEAR_LAWN = { lamp: { power: 0.55, reachMm: 7 }, pane: { power: 0.55, reachMm: 4 }, paper: { power: 0.65, reachMm: 7 } }
// Each paper lantern lays a pool of orange gold on what stands behind it and under it, a lantern and a half wide. A wall
// takes it from the lantern drawn up to it, the turf from a point just over it; the lamp post lays its own on the path.
// It follows its lantern up after the landing (the times are the tree's, `LANTERN` in tree.ts) and never burns: what it adds
// bends over under `cap`.
const POOL = { patch: 2, patchReach: 1.3, patchCap: 0.05, ember: [1, 0.4, 0.1] as Rgb, emberShare: 0.8, down: 0.55, face: 0.3, frontMm: 8, leaf: 0.015, hug: 1.1, lawn: 0.33, lawnReach: 2.4, overMm: 3, ends: 2.2, wrap: 0.22, post: 10, postReachMm: 4.5, postOverMm: 2.5, wash: 0.12, cap: 0.2, dim: 0.4, firstStepS: 0.23, firstRampS: 0.42, rampS: 0.8, stepS: 0.6, orange: [1, 0.5, 0.17] as Rgb, cream: [1, 0.68, 0.34] as Rgb, gold: [1, 0.75, 0.42] as Rgb, straw: [0.26, 0.185, 0.16] as Rgb, strawShare: 0.7 }
// The liquid is lit: it lies between the eye and every dark thing in the ball, so nothing in it is black.
const LIFT: Rgb = [0.0145, 0.012, 0.0085]
// Slate in the evening shade takes the sky's blue, not the lanterns' gold.
const SLATE_LIFT: Rgb = [0.0075, 0.0135, 0.0135]
// The bank's turf faces away from the low sun: it takes the sky's light, as the mound's front does in the approved image.
const SLOPE = { ground: 2.6, blade: 6.5, fromMm: 55.6, toMm: 56.3 }
// The low sun stands behind the scene to the right. What turns from the eye toward it takes a rim of it; a blade's tip lets it through.
const RIM = { wall: 2.0, tint: [0.62, 0.46, 0.26] as Rgb, share: 0.5, turf: 0.5, body: 0.125, bodyFar: 0.075, tipLow: 0.12, tipTint: [1.0, 1.1, 0.5] as Rgb, tipShare: 0.8, edge: 1.8, edgeTint: [1.0, 0.82, 0.55] as Rgb, edgeFromMm: 0.1, edgeToMm: 0.55, topMm: 0.85, eave: 0.7, eaveFromMm: 1.25, eaveToMm: 1.6, leaf: 1.2, petal: 3.0, rail: 0.9, railLow: 0.3, railSide: 0.1, postFromMm: 4.9 }
const NEAR_WALL = { lamp: { power: 0.5, reachMm: 8, ends: 3 }, pane: { power: 0.5, reachMm: 4.5, ends: 3 }, paper: { power: 1.5, reachMm: 6.5, ends: 3 } }
const MIRROR = { lamp: 9, flame: 5, pane: 1.2, paper: 1.6, tight: 0.002, wide: 0.03, wideShare: 0.01, lowMm: 3.4 }
const HALO = { radiusMm: 0.75, strength: 1, hot: 2, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 1, glare: [1.6, 1.12, 0.66] as Rgb }
const HALO_KIND = { lamp: { size: 3.6, rest: 0.08, hot: 0, bloom: 0.2 }, pane: { size: 2.6, rest: 0.07, hot: 0, bloom: 0.2 }, pool: { size: 5, rest: 0, hot: 0, bloom: 0.06 } }
const THROUGH = 6
const LAMP_GLASS: Rgb = [1.6, 0.66, 0.15]
const WALL_FILL = 0.3
const SAND = { white: [0.93, 0.86, 0.72] as Rgb, whiten: 0.9, clumpPerMm: 1.1, midPerMm: 2.1, sparkMid: 0.08, grainPerMm: 4.2, heapPerMm: 0.16, heapLow: 0.9, heap: 0.16, reliefMm: 0.5, reliefClump: 0.12, reliefMid: 0.05, body: 1.15, floor: 1.0, wrap: 0.6, foot: [0.5, 0.42, 0.33] as Rgb, footFrom: 0.75, footTo: 1.0, mottleLow: 0.8, mottle: 1.1, lip: 1.1, lipLow: 0.5, lipFrom: 0.15, lipTo: 0.75, breakPerMm: 0.3, shade: [1.2, 1.36, 1.6] as Rgb, shadeLow: 0.8, right: [0.75, 0.7, 0.64] as Rgb, rightFromMm: 6, rightToMm: 26, left: 0.5, leftFromMm: -36, leftToMm: -14, edgeSoft: 0.12, lipTint: [0.95, 1.0, 1.08] as Rgb, edgeVary: 0.1, fadeFrom: 0.95, fadeTo: 1.4, bump: 0.6, grainLow: 0.68, grain: 0.36, spark: 0.3, glint: 1.2 }
const TURF_LOOK = { wetFrom: 1.0, wetTo: 1.1, tone: 0.5, fineMm: 0.05, clumpMm: 0.22, fill: 0.2, wrap: 0.5, sun: 0.3, moss: [0.15, 0.2, 0.34] as Rgb, rim: 0.9, rimFromMm: 30, rimToMm: 46 }
// Where the low sun reaches the floor: the same pools as `sunAt` in assets-src/village-summer/build.mjs, which the grass carries.
const SUN_POOLS: readonly [number, number, number, number, number][] = [[1.5, 24, 4, 13, 9], [0.7, 6, -4, 9, 6], [0.4, -24, 21, 6, 5], [1.0, 24, 22, 9, 6], [1.2, -17.5, 24.6, 2.4, 2.0]]
const GRASS_LOOK = { wideMm: 0.4, cutPx: 0.3, keepFrom: 0.5, keepTo: 1.4, mean: [0.0654, 0.086, 0.0183] as Rgb, vary: 0.8, toneTop: 2.2, catch: 0.6, liftVary: 0.6, lift: [0.0115, 0.0128, 0.0072] as Rgb, liftRight: [0.013, 0.01, 0.005] as Rgb, sunTint: [0.26, 0.2, 0.1] as Rgb, sunShare: 0.5, lit: 0.81, pool: 0.8, fill: 0.05, wrap: 1.0, through: 0.16, near: 0.055, sun: 1.4, patchLow: 0.12, moss: [0.15, 0.2, 0.34] as Rgb, patchPerMm: 0.3, sunRoot: 0.12, rightDark: 0.35, rightGlow: 0.15, rightFromMm: 1, rightToMm: 6, shade: [0.26, 0.3, 0.45] as Rgb }
const ROOF = { slate: [0.07, 0.11, 0.21] as Rgb, chimney: [0.21, 0.225, 0.25] as Rgb, vary: 0.75, varyMm: 1.3, gableMm: 0.55, gableDeepMm: 0.9, underMm: 0.7, pitch: 0.2, stoneMm: 1.4, picket: [0.85, 0.5, 0.27] as Rgb, picketMm: 1.6, boardMm: 0.9, boardVary: 0.9, grainMm: 0.22, grainVary: 0.5, boardFoot: 0.7, boardTall: 3.2, pale: 0.25, rail: [1.4, 0.62, 0.32] as Rgb, railTop: 2.6, door: [0.4, 0.2, 0.2] as Rgb, doorInMm: 0.45, doorOutMm: 0.12, doorHalfMm: 2.56, doorFootMm: 0.5, cutOutMm: 0.0, cutFromMm: 2.45, cutToMm: 4.3, cutFootMm: 1.6, sillHalfMm: 2.6, sillFromMm: 2.5, sillToMm: 3.6, sideOutMm: 0.25, sideHalfMm: 2.5, sideFromMm: 3.0, sideToMm: 3.8, slabTopMm: 0.45, verge: [0.11, 0.085, 0.07] as Rgb, sheen: 1.5, sheenMm: 3.5, reachMm: 0.4, buryMm: 1.5 }
// The side windows are unlit, not black: a twentieth of the room's light comes through them, which keeps the pane between the ivy's leaves over the floor of the picture.
const DARK_PANE = { room: 0.8, through: 0.045 }
// The last sun comes low from behind, under the crown (read off the approved image). It stands in the far lawn between the
// house and the trunk and right of it (`pools`: strength, place across and width, the two depths between which it ends toward
// the lens), on the bank right of the pond (`banks`), along the brow of the slope (`crest`, `ridge`) and on the strip between
// the pond's near rim and the sand (`rim`, in the pond's own measure). Round the lamp post the lawn glows as one cream field
// that turns gold toward the lens (`lamp`), and past the trunk it glows yellow (`glow`): there the turf carries the light, in
// grains the lens resolves (`spark`). Elsewhere it falls in dapples (`clump`). A blade takes it along its body and least at its
// point (`body`), since a bright point finer than a pixel cannot settle from frame to frame; where the lens cannot tell blade
// from blade, lawn and turf keep an even share (`thinEven`). The trunk's shade falls toward the lens (`shades`) and the bank's
// face toward the pond lies turned from the sun (`face`): the approved's dark mound at the tree's foot and its dark mass at
// the pond's right end. The sand takes none of that shade.
const BLAZE = {
  tint: [1.0, 0.8, 0.38] as Rgb,
  gapTint: [1.0, 0.72, 0.36] as Rgb,
  gap: 0.4,
  grain: [1.3, 0.4] as const,
  grainFine: 0.35,
  pools: [[0.125, 1.5, 5.5, -2.5, 1.5], [0.15, 23.0, 8.0, 2.0, 7.0]] as const,
  banks: [[0.15, 31.0, 14.0, 11.0, 12.0], [0.4, 20.5, 6.0, 5.0, 5.5], [0.25, 38.0, 28.0, 7.0, 8.0], [0.3, -20.0, 30.0, 9.0, 7.0]] as const,
  crest: { x: 24.0, z: 16.0, along: [0.568, 0.823] as const, k: 0.45, backMm: 3.2, wideMm: 2.4, xFromMm: 14, xToMm: 18, endFromMm: 34, endToMm: 40 },
  ridge: { k: 0.3, zMm: 37.5, wideMm: 1.5, xFromMm: 26, xToMm: 28, endFromMm: 33, endToMm: 36 },
  rim: { k: 0.62, from: 0.93, to: 0.99, outFrom: 1.25, outTo: 1.55, zFromMm: 17, zToMm: 26, even: 0.75, tuft: 1.5 },
  lamp: { x: 0.3, z: 2.0, rx: 5.5, rzFar: 2.4, rzNear: 3.6, cutFromMm: -5.4, cutToMm: -3.8, turf: 20.0, gap: 0.25, blade: 1.55, even: 0.3, root: 0.3, tint: [1.0, 0.86, 0.58] as Rgb, gold: [1.0, 0.78, 0.36] as Rgb, coreFrom: 0.3, coreTo: 0.8, low: [1.0, 0.7, 0.3] as Rgb },
  glow: { bell: [1.0, 20.5, 7.0, 4.5, 3.4] as const, tint: [1.0, 1.0, 0.36] as Rgb, turf: 14.0, gap: 0.45, blade: 2.5, even: 0.5, root: 0.6 },
  shades: [[0.9, 11.0, 3.0, 6.5, 7.0]] as const,
  face: { k: 0.9, fromMm: -0.5, toMm: 0.5, xFromMm: 12, xToMm: 16, farFromMm: 9.5, farToMm: 10.5, zFromMm: 35.5, zToMm: 37.5 },
  turf: 4.0,
  blade: 3.2,
  body: { low: 0.2, from: 0.2, to: 0.7, tip: 0.6, tipFrom: 0.85 },
  thin: [0.8, 1.2] as const,
  thinEven: 0.6,
  thinFrom: 0.5,
  thinTo: 2.5,
  gapFrom: 1.0,
  gapTo: 5.0,
  spark: { perMm: [4.2, 3.4] as const, from: 0.5, to: 0.72, share: 0.8 },
  nearMm: 0.2,
  farMm: 0.33,
  cap: 20.0,
  clumpPerMm: 4.5,
  clumpDeep: 3.0,
  clumpLowFar: 0.15,
  clumpLow: 0.06,
  lowFromMm: 6,
  lowToMm: 12,
  clumpFrom: 0.5,
  clumpTo: 0.75,
  clumpMean: 0.314,
}
const POND_GLSL = `float turfPond(vec2 p) {
  vec2 turfPondD = p - vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)});
  vec2 turfPondL = abs(vec2(${Math.cos(pond.yaw).toFixed(4)} * turfPondD.x - ${Math.sin(pond.yaw).toFixed(4)} * turfPondD.y, ${Math.sin(pond.yaw).toFixed(4)} * turfPondD.x + ${Math.cos(pond.yaw).toFixed(4)} * turfPondD.y) / vec2(${pond.rx.toFixed(2)}, ${pond.rz.toFixed(2)}));
  return pow(abs(pow(abs(turfPondL.x), ${pond.power.toFixed(1)}) + pow(abs(turfPondL.y), ${pond.power.toFixed(1)})), ${(1 / pond.power).toFixed(4)});
}`
const eased = (from: number, to: number, v: number): number => {
  const t = Math.min(Math.max((v - from) / (to - from), 0), 1)
  return t * t * (3 - 2 * t)
}
const bodyAt = (v: number): number => (BLAZE.body.low + (1 - BLAZE.body.low) * eased(BLAZE.body.from, BLAZE.body.to, v)) * (1 + (BLAZE.body.tip - 1) * eased(BLAZE.body.tipFrom, 1, v))
const BODY_MEAN = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200).reduce((sum, v) => sum + bodyAt(v) * (1 - v), 0) / 100
const glsl = (c: Rgb): string => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`
const bell = ([k, x, z, rx, rz]: readonly [number, number, number, number, number]): string => `${k.toFixed(2)} * exp(-dot((p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)}), (p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)})))`
const mass = ([k, x, z, rx, rz]: readonly [number, number, number, number, number]): string => `${k.toFixed(2)} * blazeMass((p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)}))`
const BLAZE_GLSL = `float blazeMass(vec2 q) {
  float blazeD = dot(q, q);
  return exp(-blazeD * blazeD);
}
float blazeGlow(vec2 p) {
  return ${bell(BLAZE.glow.bell)};
}
float blazePost(vec2 p) {
  vec2 blazeQ = (p - vec2(${BLAZE.lamp.x.toFixed(1)}, ${BLAZE.lamp.z.toFixed(1)})) / vec2(${BLAZE.lamp.rx.toFixed(1)}, p.y < ${BLAZE.lamp.z.toFixed(1)} ? ${BLAZE.lamp.rzFar.toFixed(1)} : ${BLAZE.lamp.rzNear.toFixed(1)});
  blazeQ *= blazeQ;
  return exp(-blazeQ.x * blazeQ.x - blazeQ.y) * smoothstep(${BLAZE.lamp.cutFromMm.toFixed(1)}, ${BLAZE.lamp.cutToMm.toFixed(1)}, p.x);
}
float blazeLamp(vec2 p) {
  return min(blazePost(p) + blazeGlow(p), 1.0);
}
vec3 blazeHot(vec2 p) {
  return mix(mix(${glsl(BLAZE.lamp.gold)}, ${glsl(BLAZE.lamp.tint)}, smoothstep(${BLAZE.lamp.coreFrom.toFixed(2)}, ${BLAZE.lamp.coreTo.toFixed(2)}, blazePost(p))), ${glsl(BLAZE.glow.tint)}, min(blazeGlow(p) * 4.0, 1.0));
}
vec3 blazeWarm(vec2 p) {
  return mix(${glsl(BLAZE.lamp.gold)}, ${glsl(BLAZE.glow.tint)}, min(blazeGlow(p) * 4.0, 1.0));
}
vec3 blazeDeep(vec2 p) {
  return mix(${glsl(BLAZE.gapTint)}, ${glsl(BLAZE.lamp.low)}, blazePost(p));
}
float blazeCrest(vec2 p) {
  return dot(p - vec2(${BLAZE.crest.x.toFixed(1)}, ${BLAZE.crest.z.toFixed(1)}), vec2(${(-BLAZE.crest.along[1]).toFixed(3)}, ${BLAZE.crest.along[0].toFixed(3)}));
}
// The band of lit grass round the near half of the pond, from its edge outward: the brightest ground of the picture.
float blazeRim(vec2 p, float blazePond) {
  return smoothstep(${BLAZE.rim.from.toFixed(2)}, ${BLAZE.rim.to.toFixed(2)}, blazePond) * (1.0 - smoothstep(${BLAZE.rim.outFrom.toFixed(2)}, ${BLAZE.rim.outTo.toFixed(2)}, blazePond)) * smoothstep(${BLAZE.rim.zFromMm.toFixed(1)}, ${BLAZE.rim.zToMm.toFixed(1)}, p.y);
}
float blazeAt(vec2 p, float blazePond) {
  float blazeBack = (blazeCrest(p) + ${BLAZE.crest.backMm.toFixed(1)}) / ${BLAZE.crest.wideMm.toFixed(1)};
  float blazeRidge = (p.y - ${BLAZE.ridge.zMm.toFixed(1)}) / ${BLAZE.ridge.wideMm.toFixed(1)};
  return clamp(${[...BLAZE.pools.map(([k, x, r, zFrom, zTo]) => `${k.toFixed(2)} * exp(-(p.x - ${x.toFixed(2)}) * (p.x - ${x.toFixed(2)}) / ${(r * r).toFixed(2)}) * (1.0 - smoothstep(${zFrom.toFixed(2)}, ${zTo.toFixed(2)}, p.y))`), ...BLAZE.banks.map(bell)].join(' + ')} + ${BLAZE.crest.k.toFixed(2)} * exp(-blazeBack * blazeBack) * smoothstep(${BLAZE.crest.xFromMm.toFixed(1)}, ${BLAZE.crest.xToMm.toFixed(1)}, p.x) * (1.0 - smoothstep(${BLAZE.crest.endFromMm.toFixed(1)}, ${BLAZE.crest.endToMm.toFixed(1)}, p.x)) + ${BLAZE.ridge.k.toFixed(2)} * exp(-blazeRidge * blazeRidge) * smoothstep(${BLAZE.ridge.xFromMm.toFixed(1)}, ${BLAZE.ridge.xToMm.toFixed(1)}, p.x) * (1.0 - smoothstep(${BLAZE.ridge.endFromMm.toFixed(1)}, ${BLAZE.ridge.endToMm.toFixed(1)}, p.x)) + ${BLAZE.rim.k.toFixed(2)} * blazeRim(p, blazePond) + blazeLamp(p), 0.0, 1.0);
}
float blazeClump(vec2 p, float far) {
  return mix(mix(${BLAZE.clumpLowFar.toFixed(2)}, ${BLAZE.clumpLow.toFixed(2)}, smoothstep(${BLAZE.lowFromMm.toFixed(1)}, ${BLAZE.lowToMm.toFixed(1)}, p.y)), 1.0, mix(smoothstep(${BLAZE.clumpFrom.toFixed(2)}, ${BLAZE.clumpTo.toFixed(2)}, 0.5 + 0.5 * sin(p.x * ${BLAZE.clumpPerMm.toFixed(2)} + 1.7 * sin(p.y * ${((BLAZE.clumpPerMm / BLAZE.clumpDeep) * 0.72).toFixed(3)} + 0.6)) * sin(p.y * ${((BLAZE.clumpPerMm / BLAZE.clumpDeep) * 1.11).toFixed(3)} + 1.3 * sin(p.x * ${(BLAZE.clumpPerMm * 0.65).toFixed(3)}) + 2.1)), ${BLAZE.clumpMean.toFixed(3)}, ${BLAZE.thinEven.toFixed(2)} * far));
}
float blazeShade(vec2 p) {
  return ${BLAZE.shades.map((b) => `(1.0 - ${mass(b)})`).join(' * ')} * (1.0 - ${BLAZE.face.k.toFixed(2)} * smoothstep(${BLAZE.face.fromMm.toFixed(1)}, ${BLAZE.face.toMm.toFixed(1)}, blazeCrest(p)) * smoothstep(${BLAZE.face.xFromMm.toFixed(1)}, ${BLAZE.face.xToMm.toFixed(1)}, p.x) * smoothstep(${BLAZE.face.farFromMm.toFixed(1)}, ${BLAZE.face.farToMm.toFixed(1)}, p.y) * (1.0 - smoothstep(${BLAZE.face.zFromMm.toFixed(1)}, ${BLAZE.face.zToMm.toFixed(1)}, p.y)));
}`
// The tufts at the water and on the banks stand between the eye and the low sun: it comes through a blade from a third of the
// way up, and where a blade is finer than a pixel it glows evenly at `mean`, so its point does not spark.
const TUFT = { gain: 1.5, tint: [1.0, 0.8, 0.55] as Rgb, from: 0.4, to: 0.85 }
const tuftWide = (v: number): number => Math.min(1 - ((1 - SUN_TUFT.top) / SUN_TUFT.neck) * v, (SUN_TUFT.top / (1 - SUN_TUFT.neck)) * (1 - v))
const TUFT_MEAN = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200).reduce((sum, v) => sum + eased(TUFT.from, TUFT.to, v) * tuftWide(v), 0) / Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200).reduce((sum, v) => sum + tuftWide(v), 0)
const STONE_TOP = { sky: 3.2, from: 0.6, to: 0.68, fromMm: 2, toMm: 4 }
// The shared stone map lies stretched along the walls and reads as courses of logs. The approved's walls are round cobbles of
// unlike size in dark joints, lit on their upper left: cells drawn pixel by pixel in place of the map's grain, the bump laid flat.
// The lanterns' patch is capped and would level the stones out: it takes their light and dark after the cap.
const COBBLE = { cellMm: 0.66, jointFrom: 0.04, jointTo: 0.1, dark: 0.1, darkHigh: 0.5, lit: 2.2, shade: 0.6, litHigh: 0.6, round: 0.26, gritMm: 0.4, grit: 0.5, gritHigh: 0.75, gritFrom: 0.5, gritTo: 1.0, fadeFrom: 0.35, fadeTo: 0.7, mean: 0.8, highFromMm: 9.5, highToMm: 12, low: [0.068, 0.058, 0.072] as Rgb, high: [0.132, 0.068, 0.047] as Rgb, toneFromMm: 7.5, toneToMm: 10.5, cut: 0.5, cutTop: 0.8, stack: 0.5, stackWash: 1, flat: 1.0, smooth: 1.0, patch: 1.0, patchTop: 2.0, small: 0.6, big: 1.4, rough: 0.9, wash: 0.25, washTint: [0.3, 0.4, 0.6] as Rgb, poolCap: 0.05 }
// The door stands in an arc of cut stones, pale against the fieldstone, and the lamp beside it lights the jambs: the stones are
// the shared mesh's own (nine in the ring with a taller key, the jambs stacked under it), told from the wall by where they lie.
const ARCH = { toMm: 4.02, keyHalfMm: 0.8, keyToMm: 4.5, gain: 1.0, tint: [1.0, 0.9, 0.76] as Rgb, lamp: 1.3, reachMm: 7.5, gold: [1.0, 0.78, 0.42] as Rgb, wash: 0.5 }
// The approved cottage has a short stack: what stands over the ridge is drawn in to under half its height, in this season's
// copy of the mesh and in what the particles meet.
const STACK = { fromMm: 18.8, squash: 0.45, marginMm: 0.9, pot: 0.3 }
const WATER = { spark: 0.5, mass: 0.975, houseMm: 9.5, houseTall: 17, flat: 0.14, wobble: 0.1, rough: 0.035, ripple: 0.0045, fine: 0.0012, shoreFrom: 0.84, shoreTo: 1.0, sky: 1.25, skyFrom: -0.75, skyTo: 0.35, skyAt: -2.3, skyWide: 22.0, skyLow: 0.4, bankMm: 0.5, bankVary: 0.4, bankFine: 0.25, bankEdge: 0.3, bankTuft: 0.1, bankTuftPerMm: 0.19, bankDark: 0.8, env: 0.1, glint: 0.65, squash: 0.14, paperGlint: 0.16, paperMm: 0.9, paperTall: 0.5, post: 0.93, postMm: 0.75, postTall: 11.5, trunk: 0.975, trunkMm: 4.8, trunkTall: 26, body: 0.4, soft: 0.45, postSoft: 0.18, bankBlur: 2.5, floor: [0.012, 0.0105, 0.0085] as Rgb, deep: 0.4, deepFrom: 0.72, deepTo: 1.0, deepNear: 0.8, nearFromMm: -2.0, nearToMm: 3.0, ring: 0.12, ringPer: 19.0, ringFrom: 0.55, ringTo: 0.95, edgeWave: 0.35 }

const flame = lampFlame()
const mirrored: [number, number, number] = [flame[0], flame[1] - MIRROR.lowMm, flame[2]]
const postFoot = lampFoot() as Rgb
const trunkFoot: Rgb = [tree.x, groundAt(tree.x, tree.z), tree.z]
const houseFoot: Rgb = [-9.6, groundAt(-9.6, -3), -3]
const paperOf = (tone: string): Rgb => (tone === 'cream' ? tones.creamLight : tones.paperLight)

export const innerLights: InnerLight[] = [
  { at: flame, color: tones.lampLight, ...LAMP },
  { at: anchors.window, color: tones.roomLight, ...WINDOW },
]

const frame = cottageFrame()
const poolOf = (tone: string): Rgb => (tone === 'cream' ? POOL.cream : POOL.orange)
const embered = (c: Rgb): Rgb => [c[0] + (POOL.ember[0] - c[0]) * POOL.emberShare, c[1] + (POOL.ember[1] - c[1]) * POOL.emberShare, c[2] + (POOL.ember[2] - c[2]) * POOL.emberShare]
const over = (x: number, z: number, mm: number): [number, number, number] => [x, groundAt(x, z) + riseAt(x, z) + mm, z]
// A lantern that hangs before the gable is drawn up to within a little more than its own radius of the wall.
function hugged(l: Lantern): readonly [number, number, number] {
  const dx = l.at[0] - house.x
  const dz = l.at[2] - house.z
  const gap = frame.u[0] * dx + frame.u[1] * dz - house.halfLength
  if (gap < 0 || Math.abs(frame.v[0] * dx + frame.v[1] * dz) > house.halfWidth + l.radius) return l.at
  const pull = Math.max(0, gap - POOL.hug * l.radius)
  return [l.at[0] - frame.u[0] * pull, l.at[1], l.at[2] - frame.u[1] * pull]
}
interface Pool {
  at: readonly [number, number, number]
  color: Rgb
  power: number
  reachMm: number
  startS: number
}
const startOf = (order: number): number => (order < 2 ? order * POOL.firstStepS : POOL.firstRampS + POOL.stepS * (order - 2))
const postPool: Pool = { at: over(flame[0] + 0.4, flame[2] + 1.6, POOL.postOverMm), color: POOL.gold, power: POOL.post, reachMm: POOL.postReachMm, startS: -1 }
const lawnPools = [...lanterns.map((l): Pool => ({ at: over(l.at[0], l.at[2], POOL.overMm), color: poolOf(l.tone), power: POOL.lawn, reachMm: POOL.lawnReach * l.radius, startS: startOf(l.order) })), postPool]
// A wall has too few points to hold a patch one lantern wide: the lanterns that hang before the gable lay theirs on it
// pixel by pixel, each a bell round its lantern that reaches further down than up, onto the arch and the door.
const patches = lanterns
  .filter((l) => {
    const dx = l.at[0] - house.x
    const dz = l.at[2] - house.z
    const gap = frame.u[0] * dx + frame.u[1] * dz - house.halfLength
    return gap > 0 && gap < POOL.frontMm && Math.abs(frame.v[0] * dx + frame.v[1] * dz) < house.halfWidth + l.radius
  })
  .map((l) => ({ at: hugged(l), color: embered(poolOf(l.tone)), reachMm: POOL.patchReach * l.radius, startS: startOf(l.order), rampS: l.order < 2 ? POOL.firstRampS : POOL.rampS }))

function* withPools(g: THREE.BufferGeometry, pools: readonly Pool[]): Generator<void, THREE.BufferGeometry> {
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal')
  const out = new Float32Array(P.count * 4)
  for (let i = 0; i < P.count; i++) {
    if (i % ROW === 0) yield
    let weight = 0
    let start = 0
    for (const l of pools) {
      const dx = l.at[0] - P.getX(i)
      const dy = l.at[1] - P.getY(i)
      const dz = l.at[2] - P.getZ(i)
      const d2 = dx * dx + dy * dy + dz * dz
      const reach2 = l.reachMm * l.reachMm
      const far = d2 / (reach2 * POOL.ends * POOL.ends)
      if (far >= 1) continue
      const d = Math.sqrt(d2) || 1e-6
      const facing = Math.max(0, ((N.getX(i) * dx + N.getY(i) * dy + N.getZ(i) * dz) / d) * (1 - POOL.wrap) + POOL.wrap)
      const f = (l.power * facing * (1 - far) * (1 - far)) / (1 + d2 / reach2)
      for (let c = 0; c < 3; c++) out[i * 4 + c]! += l.color[c]! * f
      weight += f
      start += f * l.startS
    }
    out[i * 4 + 3] = weight > 0 ? start / weight : 0
  }
  g.setAttribute('aPool', new THREE.BufferAttribute(out, 4))
  return g
}

const PATCH_VERT_PARS = 'varying vec3 vPoolN;'
const COBBLE_AT = 'float villageMetal = villageIron * 0.55;'
const BUMP_AT = 'normal = villageBump(-vViewPosition, normal, villageDh, faceDirection);'
const COBBLE_PARS = `varying vec4 vCobble;
float cobbleShade = 1.0;
vec2 cobbleHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float cobbleGrit(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cobbleHash(i).x, cobbleHash(i + vec2(1.0, 0.0)).x, f.x), mix(cobbleHash(i + vec2(0.0, 1.0)).x, cobbleHash(i + vec2(1.0, 1.0)).x, f.x), f.y);
}`
// A stone is round: it turns to the light at its upper left edge and away from it at its lower right one, and is flat between.
// What is finer than the picture's pixel gives way to its own mean: a joint widens as it thins, the grit fades, and from far
// off the wall is one tone. Under the gable's point the wall is roughcast: the joints go, the grit stays.
const cobbleMap = (): string => `float cobbleAny = clamp(vCobble.x + vCobble.z, 0.0, 1.0);
vec2 cobbleQ = vec2(dot(vStageLocal.xz, vec2(${(frame.u[0] + frame.v[0]).toFixed(4)}, ${(frame.u[1] + frame.v[1]).toFixed(4)})), vStageLocal.y);
vec2 cobbleFw = fwidth(cobbleQ);
if (cobbleAny > 0.001) {
  float cobbleMm = max(cobbleFw.x, cobbleFw.y);
  float cobblePx = cobbleMm * ${(1 / COBBLE.cellMm).toFixed(4)};
  vec2 cobbleP = cobbleQ * ${(1 / COBBLE.cellMm).toFixed(4)};
  vec2 cobbleI = floor(cobbleP);
  vec2 cobbleF = cobbleP - cobbleI;
  float cobbleNear = 8.0;
  float cobbleNext = 8.0;
  vec2 cobbleTo = vec2(0.0);
  vec2 cobbleId = vec2(0.0);
  float cobbleSize = 1.0;
  float cobbleSize2 = 1.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 cobbleG = vec2(float(i), float(j));
      vec2 cobbleH = cobbleHash(cobbleI + cobbleG);
      vec2 cobbleR = cobbleG + 0.08 + 0.84 * cobbleH - cobbleF;
      float cobbleW = fract(cobbleH.x * 13.7 + cobbleH.y * 7.3);
      cobbleW = mix(${COBBLE.small.toFixed(2)}, ${COBBLE.big.toFixed(2)}, cobbleW * cobbleW);
      float cobbleD = length(cobbleR) / cobbleW;
      if (cobbleD < cobbleNear) {
        cobbleNext = cobbleNear;
        cobbleSize2 = cobbleSize;
        cobbleNear = cobbleD;
        cobbleTo = cobbleR;
        cobbleId = cobbleH;
        cobbleSize = cobbleW;
      } else if (cobbleD < cobbleNext) {
        cobbleNext = cobbleD;
        cobbleSize2 = cobbleW;
      }
    }
  }
  float cobbleEdge = (cobbleNext - cobbleNear) * cobbleSize * cobbleSize2 / (cobbleSize + cobbleSize2);
  float cobbleHigh = vCobble.y / max(cobbleAny, 1e-3);
  float cobbleJoint = mix(mix(${COBBLE.dark.toFixed(2)}, ${COBBLE.darkHigh.toFixed(2)}, cobbleHigh), 1.0, smoothstep(${COBBLE.jointFrom.toFixed(3)} - 0.5 * cobblePx, ${COBBLE.jointTo.toFixed(3)} + 0.5 * cobblePx, cobbleEdge));
  float cobbleTurn = dot(cobbleTo * inversesqrt(max(dot(cobbleTo, cobbleTo), 1e-4)), vec2(0.6, -0.8));
  float cobbleLit = 1.0 + (1.0 - smoothstep(0.0, ${COBBLE.round.toFixed(2)}, cobbleEdge)) * cobbleTurn * mix(${COBBLE.shade.toFixed(2)}, ${COBBLE.lit.toFixed(2)}, step(0.0, cobbleTurn)) * mix(1.0, ${COBBLE.litHigh.toFixed(2)}, cobbleHigh);
  vec3 cobbleTone = mix(vec3(0.5, 0.5, 0.5), vec3(1.45, 1.4, 1.3), cobbleId.x) * mix(vec3(1.0), vec3(1.0, 0.86, 0.72), step(0.6, cobbleId.y));
  vec3 cobbleStone = mix(vec3(${COBBLE.mean.toFixed(2)}), cobbleTone * (cobbleLit * cobbleJoint), 1.0 - smoothstep(${COBBLE.fadeFrom.toFixed(2)}, ${COBBLE.fadeTo.toFixed(2)}, cobblePx));
  float cobbleSpeck = 1.0 + mix(${COBBLE.grit.toFixed(2)}, ${COBBLE.gritHigh.toFixed(2)}, cobbleHigh) * (2.0 * smoothstep(0.25, 0.75, cobbleGrit(cobbleQ * ${(1 / COBBLE.gritMm).toFixed(4)})) - 1.0) * (1.0 - smoothstep(${COBBLE.gritFrom.toFixed(2)}, ${COBBLE.gritTo.toFixed(2)}, cobbleMm * ${(1 / COBBLE.gritMm).toFixed(4)}));
  vec3 cobbleFace = mix(vec3(1.0), cobbleStone, vCobble.x / max(cobbleAny, 1e-3)) * cobbleSpeck;
  cobbleShade = mix(1.0, clamp(dot(cobbleFace, vec3(0.3, 0.6, 0.1)) * ${COBBLE.patch.toFixed(2)}, 0.0, ${COBBLE.patchTop.toFixed(2)}), cobbleAny);
  diffuseColor.rgb *= mix(vec3(1.0), cobbleFace / max(villageTone * (0.78 + 0.44 * villageMottle), 0.04), cobbleAny);
  villageRough = mix(villageRough, ${COBBLE.rough.toFixed(2)}, cobbleAny);
}`
const PATCH_VERT_MAIN = 'vPoolN = normal;'
const POOL_VERT_PARS = 'attribute vec4 aPool;\nvarying vec4 vPool;'
const POOL_VERT_MAIN = 'vPool = aPool;'
const POOL_FRAG_PARS = 'varying vec4 vPool;\nuniform float uPoolSince;'
const poolLight = (body: string, cap = POOL.cap.toFixed(2)): string => `{
  vec3 poolC = vPool.rgb * (uGlowGain * mix(${POOL.dim.toFixed(2)}, 1.0, smoothstep(0.0, mix(${POOL.firstRampS.toFixed(2)}, ${POOL.rampS.toFixed(2)}, step(0.4, vPool.a)), uPoolSince - vPool.a))) * ${body};
  float poolM = max(max(poolC.r, poolC.g), poolC.b);
  float poolCap = ${cap};
  totalEmissiveRadiance += poolC * (poolCap * (1.0 - exp(-poolM / poolCap)) / max(poolM, 1e-4));
}`

const patchLight = (body: string): string => `{
  vec3 poolN = normalize(vPoolN);
  vec3 poolSum = vec3(0.0);
  vec3 poolD;
  float poolR;
  float poolF;
${patches
  .map(
    (q) => `  poolD = vec3(${q.at[0].toFixed(3)}, ${q.at[1].toFixed(3)}, ${q.at[2].toFixed(3)}) - vStageLocal;
  poolD.y *= poolD.y > 0.0 ? ${POOL.down.toFixed(2)} : 1.0;
  poolR = dot(poolD, poolD);
  poolF = dot(poolN, poolD) * inversesqrt(max(poolR, 0.01));
  poolSum += ${glsl(q.color)} * (exp(-poolR / ${(q.reachMm * q.reachMm).toFixed(3)}) * mix(${POOL.face.toFixed(2)}, 1.0, mix(max(poolF, 0.0), abs(poolF), villageLeaf)) * mix(${POOL.dim.toFixed(2)}, 1.0, smoothstep(0.0, ${q.rampS.toFixed(2)}, uPoolSince - ${q.startS.toFixed(2)})));`,
  )
  .join('\n')}
  vec3 poolP = poolSum * (uGlowGain * ${POOL.patch.toFixed(1)}) * ${body} / max(cobbleShade, 0.05);
  float poolQ = max(max(poolP.r, poolP.g), poolP.b);
  totalEmissiveRadiance += poolP * (${POOL.patchCap.toFixed(2)} * (1.0 - exp(-poolQ / ${POOL.patchCap.toFixed(2)})) / max(poolQ, 1e-4)) * cobbleShade;
  // The lamp beside the door lights its cut stones: the jamb next to it most, the far one least.
  vec3 archTo = vec3(${flame[0].toFixed(3)}, ${flame[1].toFixed(3)}, ${flame[2].toFixed(3)}) - vStageLocal;
  totalEmissiveRadiance += ${glsl(ARCH.gold)} * (uGlowGain * ${ARCH.lamp.toFixed(2)} * clamp(vCobble.z - 1.0, 0.0, 1.0) * exp(-dot(archTo, archTo) / ${(ARCH.reachMm * ARCH.reachMm).toFixed(2)}) * (0.5 + 0.5 * max(dot(poolN, archTo) * inversesqrt(max(dot(archTo, archTo), 0.01)), 0.0))) * ${body};
  // Away from a lantern the row's light lies on the stones as one soft cream wash.
  totalEmissiveRadiance += ${glsl(COBBLE.washTint)} * (uGlowGain * ${COBBLE.wash.toFixed(2)} * max(vCobble.w, 0.0) * mix(1.0, ${COBBLE.cutTop.toFixed(2)} + max(poolN.y, 0.0), min(vCobble.z, 1.0)) * mix(1.0, ${ARCH.wash.toFixed(2)}, clamp(vCobble.z - 1.0, 0.0, 1.0)) * mix(${POOL.dim.toFixed(2)}, 1.0, smoothstep(0.0, ${POOL.rampS.toFixed(2)}, uPoolSince))) * ${body};
}`

const near: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR.paper.power * l.radius, reachMm: NEAR.paper.reachMm * l.radius })),
]

const nearLawn: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR_LAWN.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR_LAWN.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR_LAWN.paper.power * l.radius, reachMm: NEAR_LAWN.paper.reachMm * l.radius })),
]

const nearWall: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR_WALL.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR_WALL.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR_WALL.paper.power * l.radius * POOL.wash, reachMm: NEAR_WALL.paper.reachMm * l.radius, ends: NEAR_WALL.paper.ends })),
]

const gain = { value: 1 }
const since = { value: 100 }
const clock = { value: 0 }
const storm = { value: 0 }


export async function prepare(): Promise<void> {
  await Promise.all([prepareVillage(), prepareModel(MODEL)])
}

function turfMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(TURF),
    roughness: 0.95,
    metalness: 0,
    change: 'miniature',
    key: 'village-turf-summer',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uPoolSince: since })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}\n${POOL_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}\n${POOL_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
${POOL_FRAG_PARS}
// Grains of sand have no tile: they are counted off in the globe's own millimetres, so no weave shows where the map repeats.
float sandHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float sandNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sandHash(i), sandHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(sandHash(i + vec3(0.0, 1.0, 0.0)), sandHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(sandHash(i + vec3(0.0, 0.0, 1.0)), sandHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(sandHash(i + vec3(0.0, 1.0, 1.0)), sandHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
${POND_GLSL}
${BLAZE_GLSL}
float turfSunAt(vec2 p) {
  // No pool of sun on the bank of the pond: it lies under the grass that hangs over the water.
  return smoothstep(1.06, 1.4, turfPond(p)) * clamp(${SUN_POOLS.map(([k, x, z, rx, rz]) => `${k.toFixed(2)} * exp(-dot((p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)}), (p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)})))`).join(' + ')}, 0.0, 1.0);
}
float turfHeight(vec2 uv) {
  vec3 t = texture2D(map, uv).rgb;
  return t.r * ${TURF_LOOK.fineMm.toFixed(3)} + t.g * ${TURF_LOOK.clumpMm.toFixed(3)} + texture2D(map, uv * 4.7 + 0.31).r * ${TURF_LOOK.fineMm.toFixed(3)};
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
vec3 turfT = texture2D(map, vMapUv).rgb;
float turfFine = texture2D(map, vMapUv * 4.7 + 0.31).r;
// The lawn falls into shade toward the bank: the light is on the yard, under the lanterns and by the door.
diffuseColor.rgb *= ${glsl(TURF_LOOK.moss)} * mix(1.0, ${TURF_LOOK.rim.toFixed(2)}, smoothstep(${TURF_LOOK.rimFromMm.toFixed(1)}, ${TURF_LOOK.rimToMm.toFixed(1)}, length(vStageLocal.xz))) * (1.0 + ${TURF_LOOK.tone.toFixed(2)} * (0.5 * (turfT.g - 0.5) + 0.3 * (turfT.b - 0.5) + 0.45 * (turfFine - 0.5) + 0.25 * (turfT.r - 0.5)));
// The sand is a thin layer under the mound: the turf comes down over it, and its upper edge is soft.
float sandAmt = smoothstep(0.0, ${SAND.edgeSoft.toFixed(2)}, vSurf.y + ${SAND.edgeVary.toFixed(2)} * (turfT.g - 0.5));
// The mud at the water's edge is wet and dark: a lantern's pool lies on it as on any dark thing, not as on straw.
float turfRing = turfPond(vStageLocal.xz);
float turfDry = smoothstep(${TURF_LOOK.wetFrom.toFixed(2)}, ${TURF_LOOK.wetTo.toFixed(2)}, turfRing);
float sandFineB = sandNoise(vStageLocal * ${SAND.clumpPerMm.toFixed(2)});
float sandFineC = sandNoise(vStageLocal * ${SAND.grainPerMm.toFixed(2)} + 7.3);
// A middle grain, half a millimetre wide: the one the hero lens resolves. It carries the sparkle of the lit grains.
float sandFineM = sandNoise(vStageLocal * ${SAND.midPerMm.toFixed(2)} + 4.1);
// A grain finer than the picture's pixel crawls as the lens drifts: it fades out before it gets there.
float sandPx = length(fwidth(vStageLocal));
sandFineC = mix(0.5, sandFineC, 1.0 - smoothstep(${SAND.fadeFrom.toFixed(2)}, ${SAND.fadeTo.toFixed(2)}, sandPx * ${SAND.grainPerMm.toFixed(2)}));
sandFineM = mix(0.5, sandFineM, 1.0 - smoothstep(${SAND.fadeFrom.toFixed(2)}, ${SAND.fadeTo.toFixed(2)}, sandPx * ${SAND.midPerMm.toFixed(2)}));
// Single grains sparkle, where the lens resolves a grain.
float sandSpark = smoothstep(0.66, 0.8, sandFineC * (0.45 + 0.9 * sandFineB));
float sandHeap = sandNoise(vStageLocal * ${SAND.heapPerMm.toFixed(2)} + 3.1);
// The bed has relief: heaps, clumps and grains, in millimetres, which the low sun shades.
float sandRelief = ${SAND.reliefMm.toFixed(2)} * sandHeap + ${SAND.reliefClump.toFixed(2)} * sandFineB + ${SAND.reliefMid.toFixed(2)} * sandFineM;
float sandGrain = 0.4 * turfT.g + 0.35 * sandFineB + 0.3 * sandFineC + 0.75 * sandFineM;
diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, ${glsl(SAND.white)}, ${SAND.whiten.toFixed(2)}) * (${SAND.heapLow.toFixed(2)} + ${SAND.heap.toFixed(2)} * sandHeap) * (${SAND.grainLow.toFixed(2)} + ${SAND.grain.toFixed(2)} * sandGrain + ${SAND.spark.toFixed(2)} * sandSpark + ${SAND.sparkMid.toFixed(2)} * smoothstep(0.6, 0.78, sandFineM)), sandAmt);
`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float turfH = turfHeight(vMapUv);
  vec2 turfDh = vec2(turfHeight(vMapUv + dFdx(vMapUv)) - turfH, turfHeight(vMapUv + dFdy(vMapUv)) - turfH);
  normal = villageBump(-vViewPosition, normal, turfDh * (${tileMm().toFixed(2)} * mix(1.0, ${SAND.bump.toFixed(2)}, sandAmt)) + sandAmt * vec2(dFdx(sandRelief), dFdy(sandRelief)), faceDirection);
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * uGlowGain * material.diffuseContribution;\n${poolLight(`mix(material.diffuseContribution, ${glsl(POOL.straw)}, ${POOL.strawShare.toFixed(2)} * (1.0 - sandAmt) * turfDry)`)}\n{\n  float sandBank = sandAmt;\n  vec3 sandBody = stageKeyC * (RECIPROCAL_PI * ${SAND.body.toFixed(2)} * mix(${SAND.floor.toFixed(2)}, 1.0, stageWrap(dot(geometryNormal, stageKeyL), ${SAND.wrap.toFixed(2)})) * mix(vec3(1.0), ${glsl(SAND.foot)}, smoothstep(${SAND.footFrom.toFixed(2)}, ${SAND.footTo.toFixed(2)}, vSurf.y))) * material.diffuseContribution;\n  // The low sun whitens the lip of the sand where it meets the ground and leaves the face against the glass in warm shade, deepest at the left end.\n  float sandLip = (1.0 - smoothstep(${SAND.lipFrom.toFixed(2)}, ${SAND.lipTo.toFixed(2)}, vSurf.y + 0.1 * (sandNoise(vStageLocal * 0.3 + 2.3) - 0.5)));\n  // The shelf is not one white band: heaps catch the sun, the hollows between them stay in shade.\n  float sandBreak = smoothstep(0.25, 0.75, 0.6 * sandNoise(vStageLocal * ${SAND.breakPerMm.toFixed(2)} + 9.7) + 0.4 * sandFineB);\n  sandBody *= mix(${glsl(SAND.shade)} * mix(${SAND.shadeLow.toFixed(2)}, 1.0, sandBreak), ${glsl(SAND.lipTint)} * (1.0 + mix(${SAND.lipLow.toFixed(2)}, ${SAND.lip.toFixed(2)}, sandBreak) + ${SAND.glint.toFixed(2)} * sandSpark), sandLip) * (1.0 + ${SAND.left.toFixed(2)} * (1.0 - smoothstep(${SAND.leftFromMm.toFixed(1)}, ${SAND.leftToMm.toFixed(1)}, vStageLocal.x))) * mix(vec3(1.0), ${glsl(SAND.right)}, smoothstep(${SAND.rightFromMm.toFixed(1)}, ${SAND.rightToMm.toFixed(1)}, vStageLocal.x)) * mix(${SAND.mottleLow.toFixed(2)}, ${SAND.mottle.toFixed(2)}, 0.5 * sandFineB + 0.5 * sandFineM);\n  reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, sandBody, sandBank);\n}\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${TURF_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${TURF_LOOK.wrap.toFixed(2)}) + ${SLOPE.ground.toFixed(2)} * smoothstep(0.0, 0.25, -vSurf.y))) * material.diffuseContribution;\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${TURF_LOOK.sun.toFixed(2)} * turfSunAt(vStageLocal.xz) * (1.0 - sandAmt) * (1.0 - ${GRASS_LOOK.rightDark.toFixed(2)} * smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x))) * mix(material.diffuseContribution, vec3(0.19, 0.17, 0.12), 0.3);\n{\n  float turfTurn = 1.0 - max(dot(geometryNormal, geometryViewDir), 0.0);\n  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${RIM.turf.toFixed(2)} * turfTurn * turfTurn * turfTurn * smoothstep(-0.2, 0.5, dot(geometryNormal, stageKeyL)) * (1.0 - sandAmt)) * mix(material.diffuseContribution, ${glsl(POOL.straw)}, ${POOL.strawShare.toFixed(2)});\n}\n{\n  float blazeL = blazeLamp(vStageLocal.xz);\n  float blazeC = mix(blazeClump(vStageLocal.xz, smoothstep(${BLAZE.nearMm.toFixed(2)}, ${BLAZE.farMm.toFixed(2)}, length(dFdx(vStageLocal)))), 1.0, ${BLAZE.rim.even.toFixed(2)} * blazeRim(vStageLocal.xz, turfRing));\n  // Lit turf is not one plane of light: clumps catch it and the gaps between them glow deeper, drawn out toward the lens, which looks along the ground.\n  vec3 blazeT = texture2D(map, vMapUv * vec2(${BLAZE.grain[0].toFixed(2)}, ${BLAZE.grain[1].toFixed(2)}) + 0.17).rgb;\n  float blazeG = smoothstep(0.3, 0.7, mix(blazeT.g, blazeT.r, ${BLAZE.grainFine.toFixed(2)}));\n  // Under the lamp and in the glow the turf is not a lit plane: it sparks, in grains a pixel and a half wide or more, and where the lens cannot tell them it keeps the map's grain.\n  float blazeW = min(blazePost(vStageLocal.xz) + blazeGlow(vStageLocal.xz), 1.0);\n  blazeG = mix(blazeG, smoothstep(${BLAZE.spark.from.toFixed(2)}, ${BLAZE.spark.to.toFixed(2)}, sandNoise(vec3(vStageLocal.x * ${BLAZE.spark.perMm[0].toFixed(2)}, 1.7, vStageLocal.z * ${BLAZE.spark.perMm[1].toFixed(2)}))), ${BLAZE.spark.share.toFixed(2)} * blazeW * (1.0 - smoothstep(${BLAZE.nearMm.toFixed(2)}, ${BLAZE.farMm.toFixed(2)}, length(dFdx(vStageLocal)))));\n  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * min(mix(mix(${BLAZE.turf.toFixed(2)} * blazeC, ${BLAZE.lamp.turf.toFixed(2)}, blazePost(vStageLocal.xz)), ${BLAZE.glow.turf.toFixed(2)}, blazeGlow(vStageLocal.xz)) * blazeAt(vStageLocal.xz, turfRing), ${BLAZE.cap.toFixed(2)}) * blazeShade(vStageLocal.xz) * mix(mix(mix(${BLAZE.gap.toFixed(2)}, ${BLAZE.lamp.gap.toFixed(2)}, blazePost(vStageLocal.xz)), ${BLAZE.glow.gap.toFixed(2)}, blazeGlow(vStageLocal.xz)), 1.0, blazeG) * (1.0 - sandAmt)) * mix(blazeDeep(vStageLocal.xz), mix(${glsl(BLAZE.tint)}, blazeHot(vStageLocal.xz), blazeL), blazeG);\n  reflectedLight.directDiffuse *= mix(blazeShade(vStageLocal.xz), 1.0, sandAmt);\n}\ntotalEmissiveRadiance += mix(mix(${glsl(GRASS_LOOK.lift)}, ${glsl(GRASS_LOOK.liftRight)}, smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x)), ${glsl(LIFT)}, sandAmt);`)
    },
  })
}

function grassMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(TURF),
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
    extra: { shadowSide: THREE.BackSide },
    change: 'miniature',
    key: 'village-grass-summer',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uPoolSince: since })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}\n${POOL_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}\n${POOL_VERT_MAIN}`)
      if (!shader.fragmentShader.includes('#include <color_fragment>')) throw new Error('village-summer: the place where a blade reads its own colour has moved')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${BUMP_GLSL}\n${POOL_FRAG_PARS}\n${POND_GLSL}\n${BLAZE_GLSL}`)
        .replace(
          '#include <map_fragment>',
          `// A blade ends in a point, and a point finer than the picture's pixel cannot settle from one frame to the next: where the
// blade is narrower than a pixel its own light and dark give way to the lawn's mean, and its last sliver is not drawn.
float grassTuft = step(1.5, vSurf.y);
float grassWide = mix(${(1.4 * GRASS_LOOK.wideMm).toFixed(3)} * (1.0 - vSurf.x), ${SUN_TUFT.wideMm.toFixed(3)} * min(1.0 - ${((1 - SUN_TUFT.top) / SUN_TUFT.neck).toFixed(4)} * vSurf.x, ${(SUN_TUFT.top / (1 - SUN_TUFT.neck)).toFixed(4)} * (1.0 - vSurf.x)), grassTuft) / max(length(fwidth(vStageLocal)), 1e-4);
bool grassThin = grassWide < ${GRASS_LOOK.cutPx.toFixed(2)};
float grassKeep = smoothstep(${GRASS_LOOK.keepFrom.toFixed(2)}, ${GRASS_LOOK.keepTo.toFixed(2)}, grassWide);
float grassT = mix(0.3333, vSurf.x, grassKeep);
float grassLit = mix(${GRASS_LOOK.lit.toFixed(2)} * clamp(${SUN_POOLS.map(([k, x, z, rx, rz]) => `${k.toFixed(2)} * exp(-dot((vStageLocal.xz - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)}), (vStageLocal.xz - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)})))`).join(' + ')}, 0.0, 1.0) * (1.0 - grassTuft), vSurf.y * (1.0 - grassTuft), grassKeep);
float grassBody = mix(0.6667, 4.0 * vSurf.x * (1.0 - vSurf.x), grassKeep);
diffuseColor.rgb *= ${glsl(GRASS_LOOK.moss)} * mix(1.0, ${TURF_LOOK.rim.toFixed(2)}, smoothstep(${TURF_LOOK.rimFromMm.toFixed(1)}, ${TURF_LOOK.rimToMm.toFixed(1)}, length(vStageLocal.xz))) * mix(1.0, 0.85 + 0.3 * texture2D(map, vMapUv * 3.0).g, grassKeep) * mix(${glsl(GRASS_LOOK.shade)}, vec3(1.0), grassLit);`,
        )
        .replace(
          '#include <color_fragment>',
          `vec3 grassOwn = mix(${glsl(GRASS_LOOK.mean)}, vColor.rgb, grassKeep);
diffuseColor.rgb *= grassOwn;
// Tuft by tuft the lawn has its own depth of green: how far this blade stands over or under the lawn's mean.
float grassTone = mix(1.0, clamp(dot(grassOwn, vec3(0.3, 0.6, 0.1)) * ${(1 / (0.3 * GRASS_LOOK.mean[0] + 0.6 * GRASS_LOOK.mean[1] + 0.1 * GRASS_LOOK.mean[2])).toFixed(2)}, 0.0, ${GRASS_LOOK.toneTop.toFixed(2)}), ${GRASS_LOOK.vary.toFixed(2)});
// In the blaze a blade keeps part of its own tone however fine it is, within a step the picture's samples settle.
float blazeTone = mix(mix(${BLAZE.thin[0].toFixed(2)}, ${BLAZE.thin[1].toFixed(2)}, clamp((dot(vColor.rgb, vec3(0.3, 0.6, 0.1)) * ${(1 / (0.3 * GRASS_LOOK.mean[0] + 0.6 * GRASS_LOOK.mean[1] + 0.1 * GRASS_LOOK.mean[2])).toFixed(2)} - ${BLAZE.thinFrom.toFixed(2)}) / ${(BLAZE.thinTo - BLAZE.thinFrom).toFixed(2)}, 0.0, 1.0)), grassTone, grassKeep);
// A lantern's pool is caught tuft by tuft as the sun is: one stands in it, the next in the shade of its neighbour.
float grassCatch = mix(1.0, grassTone, ${GRASS_LOOK.catch.toFixed(2)});`,
        )
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
        // The glass's outline cuts a blade last. A pixel that is cut stops being worked out, and the lighting of the pixel beside
        // it reads its numbers (the slope of the shadow's place): cut at the head, the grass at the outline was lit from numbers
        // nobody set.
        .replace('if (stageOutside()) discard;', 'bool grassOutside = stageOutside();')
        .replace(/\}\s*$/, '#ifdef STAGE_INSIDE\nif (grassOutside) discard;\n#endif\nif (grassThin) discard;\n}')
      afterLight(
        shader,
        `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * ${GRASS_LOOK.near.toFixed(2)}) * material.diffuseContribution;
${poolLight(`mix(material.diffuseContribution, ${glsl(POOL.straw)}, ${POOL.strawShare.toFixed(2)}) * (${(1 - GRASS_LOOK.pool * 0.6667).toFixed(3)} + ${GRASS_LOOK.pool.toFixed(2)} * grassBody) * grassCatch`)}
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${GRASS_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${GRASS_LOOK.wrap.toFixed(2)}) + ${SLOPE.blade.toFixed(2)} * smoothstep(${SLOPE.fromMm.toFixed(1)}, ${SLOPE.toMm.toFixed(1)}, length(vStageLocal)) * (0.35 + 0.65 * grassLit) + ${GRASS_LOOK.through.toFixed(2)} * grassT * pow(clamp(dot(normalize(vViewPosition), -stageKeyL), 0.0, 1.0), 2.0))) * material.diffuseContribution;
// The low sun does not lie evenly on the lawn: it catches tufts and leaves the moss between them in shade.
float grassPatch = 0.5 + 0.5 * sin(vStageLocal.x * ${GRASS_LOOK.patchPerMm.toFixed(2)} + 1.7 * sin(vStageLocal.z * ${(GRASS_LOOK.patchPerMm * 0.87).toFixed(3)} + 0.6)) * sin(vStageLocal.z * ${(GRASS_LOOK.patchPerMm * 1.16).toFixed(3)} + 1.3 * sin(vStageLocal.x * ${(GRASS_LOOK.patchPerMm * 0.71).toFixed(3)}) + 2.1);
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${GRASS_LOOK.sun.toFixed(2)} * mix(${GRASS_LOOK.patchLow.toFixed(2)}, 1.0, smoothstep(0.35, 0.8, grassPatch)) * grassLit * grassLit * mix(${GRASS_LOOK.sunRoot.toFixed(2)}, 1.0, grassT)) * mix(material.diffuseContribution, ${glsl(GRASS_LOOK.sunTint)}, ${GRASS_LOOK.sunShare.toFixed(2)});
// The key does not reach the lawn right of the lamp post: it lies in the crown's shade and is the dark moss of the rest.
reflectedLight.directDiffuse *= 1.0 - ${GRASS_LOOK.rightDark.toFixed(2)} * smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x);
reflectedLight.indirectDiffuse *= 1.0 - ${GRASS_LOOK.rightGlow.toFixed(2)} * smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x);
// In the blaze a blade is lit through along its whole body and least at its point, so that no bright sliver stands against the dark behind the lawn.
float blazeL = blazeLamp(vStageLocal.xz);
float blazeP = blazePost(vStageLocal.xz);
float blazeO = blazeGlow(vStageLocal.xz);
float blazeTuft = grassTuft * (1.0 - blazeL);
float blazeBody = mix(mix(${BODY_MEAN.toFixed(3)}, mix(${BLAZE.body.low.toFixed(2)}, 1.0, smoothstep(${BLAZE.body.from.toFixed(2)}, ${BLAZE.body.to.toFixed(2)}, vSurf.x)) * mix(1.0, ${BLAZE.body.tip.toFixed(2)}, smoothstep(${BLAZE.body.tipFrom.toFixed(2)}, 1.0, vSurf.x)), grassKeep), 1.0, min(${BLAZE.lamp.root.toFixed(2)} * blazeP * blazeP + ${BLAZE.glow.root.toFixed(2)} * blazeO, 1.0));
float blazeRing = turfPond(vStageLocal.xz);
float blazeLit = min(${BLAZE.blade.toFixed(2)} * mix(mix(1.0, ${BLAZE.lamp.blade.toFixed(2)}, blazeP), ${BLAZE.glow.blade.toFixed(2)}, blazeO) * blazeAt(vStageLocal.xz, blazeRing) * mix(blazeClump(vStageLocal.xz, 1.0 - grassKeep), 1.0, min(${BLAZE.lamp.even.toFixed(2)} * blazeP + ${BLAZE.glow.even.toFixed(2)} * blazeO + ${BLAZE.rim.even.toFixed(2)} * blazeRim(vStageLocal.xz, blazeRing), 1.0)) * blazeBody * blazeTone, ${BLAZE.cap.toFixed(2)}) * blazeShade(vStageLocal.xz);
// What stands low in the blaze is not grey: the light that reaches it has come through straw.
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * blazeLit * (1.0 - blazeTuft)) * mix(blazeDeep(vStageLocal.xz), mix(${glsl(BLAZE.tint)}, blazeWarm(vStageLocal.xz), blazeL), smoothstep(${BLAZE.gapFrom.toFixed(2)}, ${BLAZE.gapTo.toFixed(2)}, blazeLit));
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${TUFT.gain.toFixed(3)} * (1.0 + ${BLAZE.rim.tuft.toFixed(2)} * blazeRim(vStageLocal.xz, blazeRing)) * blazeTuft * (vSurf.y - 2.0) * mix(${TUFT_MEAN.toFixed(3)}, smoothstep(${TUFT.from.toFixed(2)}, ${TUFT.to.toFixed(2)}, vSurf.x), grassKeep)) * ${glsl(TUFT.tint)};
// A blade stands against the low sun behind it and lets it through along its length, most at its middle: a soft stroke, not a spark at the tip.
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * mix(${RIM.body.toFixed(2)}, ${RIM.bodyFar.toFixed(2)}, smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x)) * grassBody * grassTone * mix(${RIM.tipLow.toFixed(2)}, 1.0, smoothstep(0.3, 0.75, grassPatch))) * mix(material.diffuseContribution, ${glsl(RIM.tipTint)}, ${RIM.tipShare.toFixed(2)});
reflectedLight.directDiffuse *= blazeShade(vStageLocal.xz);
// The shade between the blades is green: what light reaches it has come through them.
totalEmissiveRadiance += mix(${glsl(GRASS_LOOK.lift)}, ${glsl(GRASS_LOOK.liftRight)}, smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x)) * mix(1.0, grassTone, ${GRASS_LOOK.liftVary.toFixed(2)});`,
      )
    },
  })
}

function waterMaterial(): THREE.MeshStandardMaterial {
  const level = moundAt(pond.z) - pond.level
  const sources = [{ at: mirrored, strength: MIRROR.flame }, { at: anchors.window, strength: 0 }, ...lanterns.map((l) => ({ at: [l.at[0], level + (l.at[1] - level) * WATER.squash, l.at[2]] as [number, number, number], strength: MIRROR.paper * l.radius }))]
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(TURF),
    roughness: WATER.rough,
    metalness: 0,
    change: 'miniature',
    key: 'village-water-summer',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain }, mirrorUniforms(sources))
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
${MIRROR_GLSL}
vec3 waterFlat = vec3(0.0, 0.0, 1.0);
float waterShade = 0.0;
float waterBank = 0.0;
float waterHeight(vec2 uv) {
  return texture2D(map, uv * 0.6).b * ${WATER.ripple.toFixed(4)} + texture2D(map, uv * vec2(1.3, 3.1) + 0.37).g * ${WATER.fine.toFixed(4)};
}
float waterPond(vec2 p) {
  vec2 d = p - vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)});
  vec2 l = vec2(${Math.cos(pond.yaw).toFixed(5)} * d.x - ${Math.sin(pond.yaw).toFixed(5)} * d.y, ${Math.sin(pond.yaw).toFixed(5)} * d.x + ${Math.cos(pond.yaw).toFixed(5)} * d.y);
  float a = dot(l, l) > 0.0 ? atan(l.y, l.x) : 0.0;
  float wobble = 1.0 + 0.045 * sin(3.0 * a + 1.3) + 0.03 * sin(5.0 * a + 0.4) + 0.018 * sin(9.0 * a + 2.1);
  vec2 q = abs(l / vec2(${pond.rx.toFixed(2)}, ${pond.rz.toFixed(2)}));
  return pow(abs(q.x * q.x * q.x + q.y * q.y * q.y), 1.0 / 3.0) / wobble;
}
// How much of the bank the mirrored sight line meets: the line is walked across the water to the shore, and what stands on
// the shore (moss, stones, grass) is as tall there as the turf map says.
float waterShoreline(vec3 r) {
  vec2 dir = r.xz / max(length(r.xz), 1e-4);
  float rise = r.y / max(length(r.xz), 1e-4);
  float last = waterPond(vStageLocal.xz);
  float t = 0.0;
  float hit = 60.0;
  for (int i = 0; i < 14; i++) {
    float tn = t + 2.6;
    float f = waterPond(vStageLocal.xz + dir * tn);
    if (f > 0.97) { hit = mix(t, tn, clamp((0.97 - last) / max(f - last, 1e-4), 0.0, 1.0)); break; }
    last = f;
    t = tn;
  }
  vec2 at = vStageLocal.xz + dir * hit;
  // Tufts stand on the bank, each wider than a pixel of the picture: the mirror shows their outline against the sky.
  float tall = ${WATER.bankMm.toFixed(2)} + ${WATER.bankVary.toFixed(2)} * texture2D(map, at * 0.021 + 0.3, ${WATER.bankBlur.toFixed(1)}).g + ${WATER.bankFine.toFixed(2)} * texture2D(map, at * 0.083, ${WATER.bankBlur.toFixed(1)}).r + ${WATER.bankTuft.toFixed(2)} * smoothstep(0.5, 0.6, texture2D(map, at * ${WATER.bankTuftPerMm.toFixed(3)} + 0.61, ${WATER.bankBlur.toFixed(1)}).g);
  return 1.0 - smoothstep(tall - ${WATER.bankEdge.toFixed(2)}, tall + ${WATER.bankEdge.toFixed(2)}, hit * rise);
}
float waterPost(vec3 r, vec3 foot, float radius, float tall, float soft) {
  vec2 to = foot.xz - vStageLocal.xz;
  float along = dot(to, r.xz) / max(dot(r.xz, r.xz), 1e-5);
  // The outline of what stands in the water is not ruled: the surface that carries it is never quite still.
  float miss = length(vStageLocal.xz + r.xz * along - foot.xz) + radius * soft * ${(WATER.edgeWave / WATER.soft).toFixed(3)} * (texture2D(map, vStageLocal.xz * 0.045 + 0.23).g - 0.5);
  float up = vStageLocal.y + r.y * along - foot.y;
  return step(0.0, along) * (1.0 - smoothstep(radius * (1.0 - soft), radius * (1.0 + soft), miss)) * (1.0 - smoothstep(tall * 0.85, tall, up));
}
vec3 waterLights(vec3 r) {
  vec3 sum = vec3(0.0);
  vec2 dir = r.xz / max(length(r.xz), 1e-4);
  float rise = r.y / max(length(r.xz), 1e-4);
  for (int i = 0; i < ${MIRROR_MAX}; i++) {
    if (i >= uMirrorCount) break;
    vec2 to = uMirror[i].xz - vStageLocal.xz;
    float along = dot(to, dir);
    float side = length(to - dir * along) / ${WATER.paperMm.toFixed(2)};
    float tall = uMirror[i].y - vStageLocal.y;
    float off = (along * rise - tall) / (${WATER.paperTall.toFixed(2)} * tall + 0.25);
    sum += (i == 0 ? ${glsl(tones.lampLight)} : ${glsl(tones.paperLight)}) * (${WATER.paperGlint.toFixed(2)} * step(0.0, along) * exp(-side * side - off * off)) * uMirror[i].w;
  }
  return sum;
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
float waterShore = smoothstep(${WATER.shoreFrom.toFixed(2)}, ${WATER.shoreTo.toFixed(2)}, vSurf.x + 0.09 * (texture2D(map, vMapUv * 0.8).g - 0.5) + 0.05 * (texture2D(map, vMapUv * 2.7).g - 0.5));
// At its rim the water is a thin film over damp sand and stones, not a black line.
diffuseColor.rgb = mix(${glsl(tones.waterDeep)}, vec3(0.08, 0.085, 0.05), waterShore * waterShore);
`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(${WATER.rough.toFixed(3)}, 0.22, waterShore * waterShore);`)
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float waterH = waterHeight(vMapUv);
  vec2 waterDh = vec2(waterHeight(vMapUv + dFdx(vMapUv)) - waterH, waterHeight(vMapUv + dFdy(vMapUv)) - waterH);
  waterFlat = normal;
  normal = villageBump(-vViewPosition, normal, waterDh * ${tileMm().toFixed(2)}, faceDirection);
}
`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
{
  vec3 waterN = villageInside(normal);
  vec3 waterSight = villageSight();
  float waterFresnel = 0.03 + 0.97 * pow(abs(1.0 - clamp(dot(waterN, waterSight), 0.0, 1.0)), 5.0);
  vec3 waterR = reflect(-waterSight, waterN);
  // The pond is drawn as the low view of a pond: what it mirrors is looked up along a flatter line than the lens gives, so
  // that the bank, the foot of the tree and the lamp post lie in it and the open evening sky fills the rest.
  vec2 waterAway = normalize(vStageLocal.xz - (uGlobeInv * vec4(cameraPosition, 1.0)).xz);
  vec3 waterLow = normalize(vec3(waterAway.x, ${WATER.flat.toFixed(2)}, waterAway.y) + ${WATER.wobble.toFixed(2)} * vec3(waterN.x, 0.0, waterN.z));
  vec3 waterGlint = waterLights(waterLow);
  waterShade = max(${WATER.post.toFixed(2)} * waterPost(waterLow, ${glsl(postFoot)}, ${WATER.postMm.toFixed(2)}, ${WATER.postTall.toFixed(1)}, ${WATER.postSoft.toFixed(2)}), ${WATER.trunk.toFixed(2)} * waterPost(waterLow, ${glsl(trunkFoot)}, ${WATER.trunkMm.toFixed(2)}, ${WATER.trunkTall.toFixed(1)}, ${WATER.soft.toFixed(2)}));
  waterShade = max(waterShade, ${WATER.mass.toFixed(2)} * waterPost(waterLow, ${glsl(houseFoot)}, ${WATER.houseMm.toFixed(2)}, ${WATER.houseTall.toFixed(1)}, ${WATER.soft.toFixed(2)}));
  waterBank = ${WATER.bankDark.toFixed(2)} * waterShoreline(waterLow);
  waterShade = max(waterShade, waterBank);
  float waterSky = smoothstep(${WATER.skyFrom.toFixed(2)}, ${WATER.skyTo.toFixed(2)}, waterR.x * 0.75 - waterR.z * 0.5 + 0.2);
  // Toward its banks the pond mirrors them and not the sky: dark at its ends and along the far shore, open toward the lens.
  float waterNear = smoothstep(${WATER.nearFromMm.toFixed(1)}, ${WATER.nearToMm.toFixed(1)}, -dot(vStageLocal.xz - vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)}), waterAway));
  float waterDepth = 1.0 - ${WATER.deep.toFixed(2)} * smoothstep(${WATER.deepFrom.toFixed(2)}, ${WATER.deepTo.toFixed(2)}, vSurf.x + 0.12 * (texture2D(map, vMapUv * 0.5 + 0.7).g - 0.5)) * (1.0 - ${WATER.deepNear.toFixed(2)} * waterNear);
  // Faint rings run in from the banks, each wider than a pixel of the picture; they stand still, as the water does at rest.
  waterDepth *= 1.0 - ${WATER.ring.toFixed(2)} * smoothstep(${WATER.ringFrom.toFixed(2)}, ${WATER.ringTo.toFixed(2)}, 0.5 + 0.5 * sin(vSurf.x * ${WATER.ringPer.toFixed(1)} + 3.0 * texture2D(map, vMapUv * 0.35 + 0.19).g));
  // Held low: one glint alone on the pond, clipped to white, reads as a fault and not as a ripple.
  float waterSpark = min(pow(abs(texture2D(map, vMapUv * 2.3 + 0.41).r * texture2D(map, vMapUv * 5.9 + 0.13).r * 2.2), 5.0), 0.35);
  totalEmissiveRadiance += waterGlint * (uGlowGain * ${WATER.glint.toFixed(2)}) * (1.0 - 0.6 * waterShore) * (1.0 - 0.5 * waterBank) + ${glsl(tones.waterSky)} * (${WATER.sky.toFixed(2)} * waterSky * (0.55 + 0.45 * waterFresnel) * (0.86 + 0.14 * texture2D(map, vMapUv * vec2(0.9, 2.2)).b + ${WATER.spark.toFixed(2)} * waterSpark)) * (1.0 - waterShade) * waterDepth * (1.0 - 0.75 * waterShore) * (${WATER.skyLow.toFixed(2)} + ${(1 - WATER.skyLow).toFixed(2)} * exp(-pow(abs((vStageLocal.x + 14.0 * waterN.x - ${(pond.x + WATER.skyAt).toFixed(2)}) / ${WATER.skyWide.toFixed(2)}), 2.0)));
  // What the pond mirrors is dark, not black: the bank, the bark and the wall in shade.
  totalEmissiveRadiance += ${glsl(WATER.floor)};
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * 0.12) * material.diffuseContribution;\nreflectedLight.indirectSpecular *= ${WATER.env.toFixed(2)} * (1.0 - waterShade);\nreflectedLight.directDiffuse *= 1.0 - ${WATER.body.toFixed(2)} * waterShade;\nreflectedLight.indirectDiffuse *= 1.0 - ${WATER.body.toFixed(2)} * waterShade;`)
    },
  })
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

// The planar mirror of the slab (src/scene/passes.ts) draws the whole stage a second time, turned over (the world's scale is
// -1 in height then). Single blades of grass cannot be told apart in that picture, the turf under them can: the grass gives
// the mirror none of its triangles. The ground casts no shadow either: nothing lies under it, and its own slopes are shaded
// by the light that leaves them.
// `keep` is how much of the mesh the mirror still gets, counted from its start: the cottage keeps its walls and loses the
// roses, leaves and blooms that stand on them.
const unmirrored = <T extends THREE.Mesh>(m: T, keep = 0): T => {
  m.onBeforeRender = () => {
    if (m.matrixWorld.determinant() < 0) m.geometry.setDrawRange(0, keep)
  }
  m.onAfterRender = () => {
    m.geometry.setDrawRange(0, Infinity)
  }
  return m
}

// Summer's tones on the shared cottage: the roof as dark slate, the chimney as weathered grey stone, the last sun on the tops
// of the fence. Only the colours of this season's own copy of the mesh change; the shapes are the shared ones.
// One stone lighter, the next darker: a value noise counted in millimetres, so the masonry is not one even tone.
function stoneVary(x: number, y: number, z: number, mm = ROOF.varyMm, tall = 1.6, amount = ROOF.vary): number {
  const h = (i: number, j: number, k: number): number => {
    const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453
    return v - Math.floor(v)
  }
  const s = 1 / mm
  const [px, py, pz] = [x * s, y * s * tall, z * s]
  const [ix, iy, iz] = [Math.floor(px), Math.floor(py), Math.floor(pz)]
  const f = (t: number): number => t * t * (3 - 2 * t)
  const [fx, fy, fz] = [f(px - ix), f(py - iy), f(pz - iz)]
  const at = (dy: number, dz: number): number => h(ix, iy + dy, iz + dz) * (1 - fx) + h(ix + 1, iy + dy, iz + dz) * fx
  const n = (at(0, 0) * (1 - fy) + at(1, 0) * fy) * (1 - fz) + (at(0, 1) * (1 - fy) + at(1, 1) * fy) * fz
  return 1 + amount * (n - 0.5)
}

function inStack(x: number, z: number): boolean {
  const dx = x - house.x
  const dz = z - house.z
  const across = frame.v[0] * dx + frame.v[1] * dz
  const along = frame.u[0] * dx + frame.u[1] * dz
  return Math.abs(across - house.chimney.across) < house.chimney.half + STACK.marginMm && Math.abs(along - house.chimney.along) < house.chimney.halfAlong + STACK.marginMm
}
const stackLow = (y: number): number => (y - frame.floor > STACK.fromMm ? frame.floor + STACK.fromMm + (y - frame.floor - STACK.fromMm) * STACK.squash : y)

function* dressed(g: THREE.BufferGeometry, sharedCount: number): Generator<void, THREE.BufferGeometry> {
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal')
  const C = g.getAttribute('color')
  const S = g.getAttribute('uv1')
  if (!S) throw new Error('village-summer: the walls do not say what they are made of')
  const only = (role: string) => (r: string): boolean => r === role
  const roof = only('roof')
  const chimney = only('chimney')
  const fence = only('fence')
  const cottage = only('cottage')
  // The low sun from the back right draws the ridge and the right verge: how near a point of the roof lies to that edge.
  const rim = new Float32Array(P.count)
  // What the wall's map draws there: cobbles, how far they have gone over to roughcast, cut stone, and the lanterns' wash (under zero: slate).
  const cobble = new Float32Array(P.count * 4)
  const flatten = (i: number): void => {
    const along = frame.u[0] * (P.getX(i) - house.x) + frame.u[1] * (P.getZ(i) - house.z)
    const across = frame.v[0] * (P.getX(i) - house.x) + frame.v[1] * (P.getZ(i) - house.z)
    const gable = Math.abs(along) / house.halfLength >= Math.abs(across) / house.halfWidth
    const axis = gable ? frame.u : frame.v
    const out = (gable ? along : across) < 0 ? -COBBLE.flat : COBBLE.flat
    const x = (1 - COBBLE.flat) * N.getX(i) + out * axis[0]
    const y = (1 - COBBLE.flat) * N.getY(i)
    const z = (1 - COBBLE.flat) * N.getZ(i) + out * axis[1]
    const l = Math.hypot(x, y, z) || 1
    N.setXYZ(i, x / l, y / l, z / l)
  }
  const step = (a: number, b: number, v: number): number => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const spring = house.door.height - house.door.width / 2
  const ridgeY = frame.floor + house.wall + house.rise + RIM.topMm
  // The top of a rail or a post is seen edge on and holds no light: the sides take it at their upper edge, where they meet it.
  const placed = (i: number): string => `${Math.round(P.getX(i) * 20)},${Math.round(P.getY(i) * 20)},${Math.round(P.getZ(i) * 20)}`
  const tops = new Set<string>()
  for (let i = 0; i < sharedCount; i++) {
    if (i % ROW === 0) yield
    if (N.getY(i) > 0.5 && solidDistance(P.getX(i), P.getY(i), P.getZ(i), fence) < ROOF.reachMm) tops.add(placed(i))
  }
  for (let i = 0; i < sharedCount; i++) {
    if (i % ROW === 0) yield
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    const kind = Math.floor(S.getX(i) + 0.001)
    const along = frame.u[0] * (x - house.x) + frame.u[1] * (z - house.z)
    const across = frame.v[0] * (x - house.x) + frame.v[1] * (z - house.z)
    const up = y - frame.floor
    const da = across - house.door.across
    // The approved fence is posts and two rails. The pale boards between them are laid flat under the turf.
    if (solidDistance(x, y, z, fence) < ROOF.picketMm && Math.min(C.getX(i), C.getY(i), C.getZ(i)) > 0.45 * Math.max(C.getX(i), C.getY(i), C.getZ(i))) P.setY(i, groundAt(x, z) - ROOF.buryMm)
    const stack = inStack(x, z) && up > STACK.fromMm
    if (stack) {
      P.setY(i, stackLow(y))
      const l = Math.hypot(N.getX(i), N.getY(i) / STACK.squash, N.getZ(i)) || 1
      N.setXYZ(i, N.getX(i) / l, N.getY(i) / STACK.squash / l, N.getZ(i) / l)
    }
    const lum = Math.max(0.3 * C.getX(i) + 0.6 * C.getY(i) + 0.1 * C.getZ(i), stack ? STACK.pot : 0)
    // The roof's solid fills the gable too: only what faces up is slate, the wall under the verge stays stone.
    const nearRoof = solidDistance(x, y, z, roof) < ROOF.reachMm
    // The gable's own face under the verge boards is wall, not board: it lies in the wall's plane, inside the eaves, and does not face down.
    // What lies well under the roof's line is the gable's masonry whichever way it faces: the top and the underside of a block there are wall, not slate and not board.
    const underRoof = frame.floor + house.wall + house.rise - Math.abs(across) * (house.rise / house.halfWidth) - y
    const gableWall = nearRoof && (N.getY(i) > -0.5 || underRoof > ROOF.underMm) && Math.abs(along) < house.halfLength + (underRoof > ROOF.underMm ? ROOF.gableDeepMm : ROOF.gableMm) && Math.abs(across) < house.halfWidth + 0.3
    const onHouse = nearRoof || solidDistance(x, y, z, cottage) < ROOF.stoneMm
    if (solidDistance(x, y, z, fence) < ROOF.reachMm) rim[i] = !tops.has(placed(i)) ? RIM.railSide : y - groundAt(x, z) > RIM.postFromMm ? RIM.rail : RIM.railLow
    if (nearRoof && !stack && solidDistance(x, y, z, chimney) >= ROOF.reachMm) {
      const eave = Math.min(1, Math.max(0, (-across - house.halfWidth - RIM.eaveFromMm) / (RIM.eaveToMm - RIM.eaveFromMm)))
      const t = Math.min(1, Math.max(0, (ridgeY - Math.max(across, 0) * (house.rise / house.halfWidth) - y - RIM.edgeFromMm) / (RIM.edgeToMm - RIM.edgeFromMm)))
      rim[i] = Math.max(1 - t * t * (3 - 2 * t), RIM.eave * eave * eave * (3 - 2 * eave))
    }
    if (stack || solidDistance(x, y, z, chimney) < ROOF.reachMm) {
      const v = 2 * COBBLE.stack * stoneVary(x, y, z)
      C.setXYZ(i, lum * ROOF.chimney[0] * v, lum * ROOF.chimney[1] * v, lum * ROOF.chimney[2] * v)
      cobble[4 * i] = 1
      cobble[4 * i + 3] = COBBLE.stackWash
    }
    else if (nearRoof && N.getY(i) > ROOF.pitch && underRoof < ROOF.underMm) {
      // A soft sheen along the ridge, where the slate turns up to the sky.
      const v = 2.9 * (1 + ROOF.sheen * Math.min(1, Math.max(0, (up - (house.wall + house.rise - ROOF.sheenMm)) / ROOF.sheenMm)))
      C.setXYZ(i, lum * ROOF.slate[0] * v, lum * ROOF.slate[1] * v, lum * ROOF.slate[2] * v)
      cobble[4 * i + 3] = -1
    }
    // The door is planks of dark red brown in the arch, seen whole.
    else if (kind === 1 && along > house.halfLength - ROOF.doorInMm && along < house.halfLength - ROOF.doorOutMm && Math.abs(da) < ROOF.doorHalfMm && up > -ROOF.doorFootMm && up < spring + Math.sqrt(ROOF.doorHalfMm * ROOF.doorHalfMm - da * da) + 0.06) {
      C.setXYZ(i, lum * ROOF.door[0], lum * ROOF.door[1], lum * ROOF.door[2])
      cobble[4 * i + 3] = 1
    }
    else if (nearRoof && !gableWall && C.getX(i) > 1.25 * C.getZ(i)) C.setXYZ(i, C.getX(i) * ROOF.verge[0], C.getY(i) * ROOF.verge[1], C.getZ(i) * ROOF.verge[2])
    else if (kind === 0 && onHouse) {
      const ring = up < spring ? Math.abs(da) : Math.hypot(da, up - spring)
      const arch = along > house.halfLength + ROOF.cutOutMm && up > -ROOF.cutFootMm && ring > ROOF.cutFromMm && (ring < ARCH.toMm || (Math.abs(da) < ARCH.keyHalfMm && up > spring && ring < ARCH.keyToMm))
      const surround = arch || (along > house.halfLength + ROOF.cutOutMm && Math.abs(across - house.window.across) < ROOF.sillHalfMm && up > ROOF.sillFromMm && up < ROOF.sillToMm)
      const side = across < -house.halfWidth - ROOF.sideOutMm && Math.abs(along - house.sideWindow.along) < ROOF.sideHalfMm && up > ROOF.sideFromMm && up < ROOF.sideToMm
      // The slab before the door is a stone of the ground: it keeps its own tone and takes the sky.
      if (up < ROOF.slabTopMm && Math.abs(da) < house.door.width / 2 && along > house.halfLength - ROOF.doorOutMm) continue
      if (surround || side) {
        // The arch's ring, the jambs and the sills are cut stone: each keeps its own tone and its own faces. The door's are pale (2 in the map's third number).
        const k = arch ? ARCH.gain : COBBLE.cut
        C.setXYZ(i, C.getX(i) * k * (arch ? ARCH.tint[0] : 1), C.getY(i) * k * (arch ? ARCH.tint[1] : 1), C.getZ(i) * k * (arch ? ARCH.tint[2] : 1))
        cobble[4 * i + 2] = arch ? 2 : 1
        cobble[4 * i + 3] = 1
        continue
      }
      // The wall is one fieldstone, grey brown below and warmer under the gable's point: the map gives each stone its light and dark.
      const t = step(COBBLE.toneFromMm, COBBLE.toneToMm, up)
      C.setXYZ(i, COBBLE.low[0] + (COBBLE.high[0] - COBBLE.low[0]) * t, COBBLE.low[1] + (COBBLE.high[1] - COBBLE.low[1]) * t, COBBLE.low[2] + (COBBLE.high[2] - COBBLE.low[2]) * t)
      cobble[4 * i] = 1
      cobble[4 * i + 1] = step(COBBLE.highFromMm, COBBLE.highToMm, up)
      cobble[4 * i + 3] = 1
      flatten(i)
    }
    else if (solidDistance(x, y, z, fence) < ROOF.picketMm && Math.min(C.getX(i), C.getY(i), C.getZ(i)) > 0.45 * Math.max(C.getX(i), C.getY(i), C.getZ(i)) && lum > ROOF.pale) {
      // Each board has its own tone and a grain that runs up it; the foot of the fence stands in the shade of the grass.
      const v = stoneVary(x, y, z, ROOF.boardMm, 0.12, ROOF.boardVary) * stoneVary(x, y, z, ROOF.grainMm, 0.2, ROOF.grainVary) * (ROOF.boardFoot + (1 - ROOF.boardFoot) * Math.min(1, Math.max(0, (y - groundAt(x, z)) / ROOF.boardTall)))
      C.setXYZ(i, lum * ROOF.picket[0] * v, lum * ROOF.picket[1] * v, lum * ROOF.picket[2] * v)
    }
    else if (solidDistance(x, y, z, fence) < ROOF.reachMm) {
      const v = stoneVary(x, y, z, ROOF.grainMm, 0.2, ROOF.grainVary) * (N.getY(i) > 0.6 ? ROOF.railTop : 1)
      C.setXYZ(i, C.getX(i) * ROOF.rail[0] * v, C.getY(i) * ROOF.rail[1] * v, C.getZ(i) * ROOF.rail[2] * v)
    }
  }
  g.setAttribute('aRim', new THREE.BufferAttribute(rim, 1))
  g.setAttribute('aCobble', new THREE.BufferAttribute(cobble, 4))
  C.needsUpdate = true
  P.needsUpdate = true
  N.needsUpdate = true
  return g
}

// The shared material of the walls knows no rim and no lit liquid: both are laid on after its own light.
function rimmed(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const before = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    before.call(m, shader, renderer)
    Object.assign(shader.uniforms, { uPoolSince: since })
    shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${POOL_VERT_PARS}\n${PATCH_VERT_PARS}\nattribute float aRim;\nvarying float vRim;\nattribute vec4 aCobble;\nvarying vec4 vCobble;`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${POOL_VERT_MAIN}\n${PATCH_VERT_MAIN}\nvRim = aRim;\nvCobble = aCobble;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${POOL_FRAG_PARS}\n${PATCH_VERT_PARS}\nvarying float vRim;\n${COBBLE_PARS}`)
    if (!shader.fragmentShader.includes(COBBLE_AT)) throw new Error('village-summer: the surface map of the walls has moved')
    shader.fragmentShader = shader.fragmentShader.replace(COBBLE_AT, `${COBBLE_AT}\n${cobbleMap()}`)
    if (!shader.fragmentShader.includes(BUMP_AT)) throw new Error('village-summer: the bump of the walls has moved')
    shader.fragmentShader = shader.fragmentShader.replace(BUMP_AT, `${BUMP_AT}\n  normal = mix(normal, nonPerturbedNormal, ${COBBLE.smooth.toFixed(2)} * clamp(vCobble.x + vCobble.z, 0.0, 1.0));\n  normal /= max(length(normal), 1e-4);`)
    afterLight(
      shader,
      `${poolLight(`(material.diffuseContribution * (1.0 - ${(1 - POOL.leaf).toFixed(2)} * villageLeaf))`, `mix(${POOL.cap.toFixed(2)}, ${COBBLE.poolCap.toFixed(2)}, max(vCobble.w, 0.0))`)}
${patchLight(`(material.diffuseContribution * (1.0 - ${(1 - POOL.leaf).toFixed(2)} * villageLeaf))`)}
{
  float rimTurn = 1.0 - max(dot(geometryNormal, geometryViewDir), 0.0);
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${RIM.wall.toFixed(2)} * pow(abs(rimTurn), 4.0) * smoothstep(0.1, 0.6, dot(geometryNormal, stageKeyL)))) * mix(material.diffuseContribution, ${glsl(RIM.tint)}, ${RIM.share.toFixed(2)});
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${RIM.edge.toFixed(2)} * vRim * vRim) * ${glsl(RIM.edgeTint)};
  // A leaf, a petal lets the sun behind it through.
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${RIM.leaf.toFixed(2)} * villageLeaf * max(dot(-geometryNormal, stageKeyL), 0.0) * mix(1.0, ${RIM.petal.toFixed(2)}, smoothstep(0.0, 0.08, material.diffuseContribution.r - material.diffuseContribution.g))) * material.diffuseContribution;
}
// A stone on the ground lies open to the sky: its top takes the sky's light and its flank a share of it, as the loaves by the pond do in the approved image.
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${STONE_TOP.sky.toFixed(2)} * villageStone * (1.0 - max(vCobble.w, 0.0)) * smoothstep(${STONE_TOP.from.toFixed(2)}, ${STONE_TOP.to.toFixed(2)}, normalize(vPoolN).y) * (1.0 - smoothstep(${(frame.floor + STONE_TOP.fromMm).toFixed(2)}, ${(frame.floor + STONE_TOP.toMm).toFixed(2)}, vStageLocal.y))) * material.diffuseContribution;
totalEmissiveRadiance += mix(${glsl(LIFT)}, ${glsl(SLATE_LIFT)}, max(-vCobble.w, 0.0));`,
    )
  }
  return m
}

export function* making(): Generator<void, THREE.Object3D> {
  const shared = villageGeometry('solid')
  const merged = mergeGeometries([shared, geometry(MODEL, 'decor')])
  yield
  const stone = yield* dressed(merged, shared.getAttribute('position').count)
  yield
  const lit = yield* surfacing(stone, nearWall)
  yield
  const solids = yield* withPools(lit, lawnPools)
  yield
  const walls = unmirrored(shadowed(new THREE.Mesh(solids, rimmed(surfaceMaterial({ part: PART, map: villageGrain(), gain, key: 'village-solid-summer', fill: WALL_FILL })))), shared.index ? shared.index.count : shared.getAttribute('position').count)
  yield
  const ground = shadowed(new THREE.Mesh(yield* withPools(yield* surfacing(geometry(MODEL, 'ground'), nearLawn), lawnPools), turfMaterial()), false)
  yield
  const grass = unmirrored(shadowed(new THREE.Mesh(yield* withPools(yield* surfacing(geometry(MODEL, 'grass'), nearLawn), lawnPools), grassMaterial()), false))
  yield
  const water = shadowed(new THREE.Mesh(yield* surfacing(geometry(MODEL, 'water'), near), waterMaterial()), false)
  return new THREE.Group().add(walls, ground, grass, water)
}

export function lights(): THREE.Object3D {
  const pieces = [
    glowPiece(villageGeometry('lamp-glass'), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1]),
  ]
  const unlit = [glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2])]
  const look = { bulb: 0.75, bulbCore: 1.7, glass: LAMP_GLASS, flame: tones.flame.map((v) => v * 4) as unknown as Rgb, room: tones.room.map((v) => v * 1.25) as unknown as Rgb, curtain: tones.curtain.map((v) => v * 0.45) as unknown as Rgb, frost: tones.haze.map((v) => v * 0.4) as unknown as Rgb, frostAmount: 0, flicker: 0.08, cycles: 3, through: THROUGH, paneHot: 0.4 }
  const lit = (x: number, z: number): [number, number, number] => [x, groundAt(x, z) + 1.5, z]
  const pools = [lit(flame[0] + 0.4, flame[2] + 1.6), lit(anchors.door[0] * 0.75 + flame[0] * 0.25, anchors.door[2] * 0.75 + flame[2] * 0.25)]
  const halos = new THREE.Mesh(haloGeometry([flame, anchors.window, ...pools], HALO.radiusMm, [HALO_KIND.lamp, HALO_KIND.pane, ...pools.map(() => HALO_KIND.pool)], HALO.wide), haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, HALO, clock, storm))
  halos.renderOrder = 3
  const dark = { ...look, room: tones.room.map((v) => v * DARK_PANE.room) as unknown as Rgb, curtain: tones.curtain.map((v) => v * DARK_PANE.room) as unknown as Rgb, paneHot: 0, through: DARK_PANE.through }
  return new THREE.Group().add(new THREE.Mesh(glowGeometry(pieces), glowMaterial(LIGHT, look, clock)), new THREE.Mesh(glowGeometry(unlit), glowMaterial(LIGHT, dark, clock)), halos)
}

const keep = (role: string): boolean => !isTree(role) && role !== 'ground' && role !== 'pond' && role !== 'chimney'
const stackOnly = (role: string): boolean => role === 'chimney'
const stackTop = frame.floor + STACK.fromMm + (house.chimney.top - STACK.fromMm) * STACK.squash
const STEMS = { radiusMm: 0.45, headMm: 1.1 }
let stems: number[] | null = null

function stemDistance(x: number, y: number, z: number): number {
  if (!stems) stems = ((geometry(MODEL, 'decor').userData.extras as { sunflowers?: number[] } | undefined)?.sunflowers ?? []).slice()
  let d = Infinity
  for (let i = 0; i < stems.length; i += 4) {
    const dx = x - stems[i]!
    const dz = z - stems[i + 2]!
    const h = stems[i + 3]!
    const dy = y - stems[i + 1]!
    const along = Math.min(h, Math.max(0, dy))
    const stem = Math.hypot(dx, dy - along, dz) - STEMS.radiusMm
    const head = Math.hypot(dx, dy - h, dz - 0.5) - STEMS.headMm
    d = Math.min(d, stem, head)
  }
  return d
}

function groundDistance(x: number, y: number, z: number): number {
  const slope = moundSlope(z)
  return (y - groundAt(x, z) - riseAt(x, z)) / Math.sqrt(1 + slope * slope)
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(solidDistance(x, y, z, keep), Math.max(solidDistance(x, y, z, stackOnly), y - stackTop), shrubDistance(x, y, z), groundDistance(x, y, z), stemDistance(x, y, z))
}

export function update(moment: KitMoment): void {
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  gain.value = gainOf(innerLights, moment.time, moment.period)
  since.value = Number.isFinite(moment.sinceLanding) ? Math.min(100, Math.max(0, moment.sinceLanding)) : 100
  const t = Number.isFinite(moment.sinceLanding) ? Math.min(1, Math.max(0, moment.sinceLanding / config.shake.settleCheckSeconds)) : 1
  storm.value = 1 - t * t * (3 - 2 * t)
}
