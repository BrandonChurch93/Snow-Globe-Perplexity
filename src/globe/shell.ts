import * as THREE from 'three'
import { config } from '../config'
import { stageShader, stageUniforms } from '../core/materials'
import { resolveBehind } from '../core/accumulator'
import { stream } from '../core/rng'
import { partBytes, viewCode } from '../diagnostics/views'
import type { StageFrame } from '../scene/frame'
import { centreHeightMm, collarY } from '../scene/layout'
import { ROOM_GLSL, ROOM_LIGHTS, roomUniforms } from '../scene/room'
import { surfaceUniforms } from '../scene/surface'
import { innerRadiusMm, lensRadiusMm } from './lens'
import { LIQUID_BUBBLE, LIQUID_PHASE, LIQUID_PHASE_B, LIQUID_SLOSH, LIQUID_TURBULENCE, TURBULENCE_MAX } from './liquid'

type V3 = readonly [number, number, number]

export const glassLook = {
  ownSources: true,
  window: {
    centre: [0.4179, 0.3537, -0.8368] as V3,
    along: [-0.5279, 0.8442, 0.0931] as V3,
    across: [0.7394, 0.4029, 0.5395] as V3,
    tint: [0.56, 0.73, 1] as V3,
    level: 3.2,
    gain: 11,
    edgeDeg: { outer: 2, firstOuter: 1.12, outerMain: 1, inner: 1.2, innerMain: 1.3, tipInner: 0.8, end: 1.1, tail: 4, cut: 2, wobble: 0.6, wobbleRate: 12 },
    gap: { wideDeg: [6, 13] as const, tint: [0.9, 0.89, 0.8] as V3, gain: 0.9, mid: [0.22, 0.36, 0.55] as const, top: [0.46, 0.6] as const, low: [-0.24, -0.06] as const },
    halo: { wideDeg: [2.5, 5] as const, tint: [0.4, 0.75, 1] as V3, gain: 0.24 },
    tip: { flatDeg: [7.5, 12] as const, fadeDeg: [8.5, 14] as const, tint: [0.4, 0.55, 0.75] as V3, slant: 0.35, slantFromDeg: -3.5, tailDeg: [-16, -13.5] as const, tailSlope: 0, tailFromDeg: -18, tailCurve: 0.037, tailLevel: 0.021, tailLeanDeg: 3.2, widenDeg: [-12, 7] as const, widen: 10, plate: 2.8, plateDeg: [-7, -2] as const },
    dark: { atDeg: [13.6, -8.7] as const, axis: [0.803, -0.595] as const, sideDeg: [-1.5, 1.5, 11, 17] as const, inDeg: [-17, -11] as const, depth: 0.95, shade: 0.3, share: [0.935, 0.965] as const, glow: [0.0018, 0.019, 0.021] as V3 },
    orders: [
      { alongDeg: [-44, 15.5], acrossDeg: [-3.8, 11.6], outFrom: 0.8, outSlope: -1, inFrom: 8.5, inSlope: 0.7, outer: 1, inner: 0.07, power: 1.5, cutDeg: -90, cutSlant: 0, tail: 1, tint: [2.5, 1.83, 1.35] as V3, base: [1, 1, 1] as V3, core: [0.4, 0.4, 0.4] as V3, fallDeg: [-5, 1, 80, 90] as const, fallTo: 1 },
      { alongDeg: [-22.5, 2.7], acrossDeg: [-4.2, 13.2], outFrom: -9, outSlope: -0.05, inFrom: 1.2, inSlope: 2.9, outer: 1, inner: 0.235, power: 2.6, cutDeg: -10, cutSlant: 0.3, tail: 0.004, tint: [1, 1, 1] as V3, base: [0.8, 0.96, 1.05] as V3, core: [3.2, 2, 1.2] as V3, fallDeg: [-9.5, -4, -7, -2] as const, fallTo: 0.46 },
      { alongDeg: [-17, 3.5], acrossDeg: [-2.5, 11.3], outFrom: -0.5, outSlope: 0.2, inFrom: -7.2, inSlope: 0.15, outer: 1.6, inner: 0.7, power: 4, cutDeg: -90, cutSlant: 0, tail: 1, tint: [1, 1, 1] as V3, base: [1, 1, 1] as V3, core: [0, 0, 0] as V3, fallDeg: [80, 90, 80, 90] as const, fallTo: 1 },
      { alongDeg: [-16, 15.5], acrossDeg: [-3.8, 14.6], outFrom: 0, outSlope: 0, inFrom: 0, inSlope: 0, outer: 1, inner: 1, power: 1, cutDeg: -90, cutSlant: 0, tail: 1, tint: [1, 1, 1] as V3, base: [1, 1, 1] as V3, core: [0, 0, 0] as V3, fallDeg: [80, 90, 80, 90] as const, fallTo: 1 },
    ],
  },
  rimCard: { wide: 0.05, widePower: 3, core: 0.75, corePower: 26, tint: [2.63, 2.29, 1.6] as V3 },
  strip: { centre: [-0.449, -0.031, -0.893] as V3, tint: [0.3, 0.8, 1] as V3, wideDeg: 3.4, tallDeg: [-9, 7] as const, endDeg: 3, gain: [0.32, 0.96, 4.48, 0] as const },
  room: { gain: 0.3, side: 0.22, blotch: 0.5, level: 4.31, tint: [1.62, 1.04, 1.04] as V3, innerRough: 0.1, throughRough: 0.3 },
  ceiling: { dir: [0.1, 0.5, -0.866] as V3, edge: [0.5, 0.61] as const, low: [0.25, 1] as const, gain: 1.5, tint: [0.74, 1.04, 1] as V3, rings: 40, depth: 0.45 },
  second: { face: 0.72, gain: 3.3, tint: [1.25, 1.1, 1] as V3, softDeg: 0.5, own: 0.15 },
  third: { face: 0.6, gain: 0.07, tint: [0.75, 0.85, 1] as V3, softDeg: 1.6, own: 0.15, fade: [0.78, 0.97] as const },
  shoulder: { from: 1.4, to: 3.6 },
  /** The width in pixels over which the glass fades out at its outline, so that the outline is soft in every sample before the samples are averaged. */
  limbPx: 1.5,
  floor: 0.4,
  band: { from: 0.976, to: 0.99, wander: 0.004, dim: 0.25, shade: 0.3, side: [-0.2, 0.5] as const, low: [-0.5, -0.1] as const },
  edge: { from: 0.978, keyFrom: 0.988, peak: 0.994, keyLobe: [0.84, 0.97] as const, key: 0.5, keyOn: 0.35, keyLow: 0.45, keyLowDir: [0.5, 0.866, 0] as V3, keyLowLobe: [0.8, 0.93] as const, line: { from: 0.9955, peak: 0.998, gain: 1.3, dir: [0.978, 0.208, 0] as V3, lobe: [0.8, 0.97] as const, spanDir: [0.743, 0.669, 0] as V3, span: [0.8, 0.86] as const, rest: 0.35, wander: 0.5, glint: 1.8, glintDir: [0.326, 0.946, 0] as V3, glintLobe: [0.978, 0.998] as const }, keyTint: [0.75, 0.76, 0.585] as V3, tip: 0.5, tipTint: [0.6, 0.78, 1] as V3, tipDeg: [4.3, 2.5, 1.3] as const, tipShare: [0.984, 0.997] as const, rimLobe: [0.16, 0.5] as const, rim: 0.04, sky: 0.04, pool: 0 },
  body: { from: 0.962, to: 0.978, sky: 0.04, tint: [1.8, 1.2, 0.4] as V3 },
  rim: { from: 0.96, to: 0.967, clear: 0.65, tint: [0.9, 1, 1.08] as V3, high: 0.085, low: 0.28, line: 0.9655, lineWide: 0.0022, lineGain: 0.25, highTint: [0.9, 1.05, 1] as V3, streak: 0.6, outer: 0.9905, outerWide: 0.004, outerGain: 0.16 },
  wall: { from: [0.896, 0.926] as const, to: [0.966, 0.976] as const, crest: 0.9635, crestWide: 0.013, plate: 0.14, peak: 0.3, inTint: [1.15, 0.97, 0.8] as V3, tint: [1, 1, 0.83] as V3, lowY: [0.02, -0.22] as const, leftDrop: 0.1, lowTo: 0.012, grain: 0.5, speck: 0.5, spark: 1.2, wander: 0.006, mirror: 0.5, mirrorTo: 0.93, leftTo: 0.016 },
  ring: { from: 0.9625, to: 0.9675, thin: 0.024, soft: 0.008, spanDeg: 21, around: 96, rows: 3, side: [0.5, 0.2] as const, low: [-0.22, -0.08] as const, wallSide: [0.1, -0.5] as const, keep: 0.3, cover: 0.75, wall: [0.17, 0.19, 0.165] as V3, grain: 0.5, speck: 0.4, streak: 1, streakRings: 110, mottle: 1.6, edge: [0.989, 0.994] as const, line: [0.26, 0.3, 0.25] as V3, lineTop: [0.11, 0.2, 0.25] as V3, lineMix: 0.9, lowMix: 1, lowLine: [0.67, 0.69, 0.55] as V3, lowAt: [0.992, 0.997] as const, lowEnd: [-0.8, -0.72] as const, night: [0.014, 0.0255, 0.026] as V3, reach: 1.002, lowFrom: 0.99, lowTo: 0.996, mirror: { from: 0.955, lowFrom: 0.972, wide: 0.022, side: [-0.34, -0.2, -0.06] as const, coverHigh: 0.2, gain: 1.6, cover: 0.55, steps: 10, solid: [0.35, 0.62] as const, snow: [0.2, 0.22] as const, warm: 0.5, air: 0.6, streak: 0.7, streakRings: 150 } },
  bend: { from: 0.92, soft: 0.2, shift: 0.16, power: 2, dark: 0.5, taps: 4, bubbleDeg: [13, 19] as const },
  wave: { rings: 46, ringDeg: 0.3, driftDeg: 0.35, inner: 1.9 },
  dust: { cells: 240, share: 0.085, depth: 0.42 },
  hair: { count: 7, widthMm: 0.035, depth: 0.32, bend: 0.012 },
  seat: { topMm: 4, lineMm: 0.8, lineDepth: 0.7, shadeMm: 4.5, shade: 0.4, gain: 1.5, wideMm: 9, wide: 0.32, footMm: 1.1, footWideMm: 0.14, foot: 0.1, footTint: [1.5, 1.15, 0.85] as V3, mirrorMm: 4, mirrorSpanMm: 2, mirror: 0.2, mirrorCap: 0.8, mirrorTaps: 4, limb: [0.9, 0.975] as const },
  bloom: { gain: 0.6, floor: 0.1, power: 3, white: 3, whitePower: 8 },
  through: { disc: 0.0009, point: 3, pointGain: 2.5, wall: [0.94, 0.975, 0.985] as V3, mirror: 0.06, steps: 5, own: 0.12, window: 0.018, softDeg: 3, lift: [0.056, 0.012, 2.5] as const, liftTint: [0.9, 1.25, 1] as V3, arcs: 0.4, arcRings: 13 },
  /**
   * The room's lamps that stand outside the frame, behind the globe and to its sides, as the glass shows them: each is a short strip
   * round the axis from the hero camera through the globe, and the grazing glass squeezes it into a fine arc along the rim.
   * A lamp: its share of the radius at which the outer face shows it from `hero`, its place round the rim in degrees (0 at the right, 90 at the top),
   * its thickness and its half length in degrees, its level, and how cool it is (0 the season's warm lamps, 1 the room's cool ones). They are placed once, from the seed `glass:arcs`.
   */
  arcs: {
    cool: [0.62, 0.8, 1] as V3,
    broken: 0.6,
    inner: 0.5,
    core: 1.6,
    /** The least thickness of a lamp's arc, in pixels: a thinner one is drawn that wide and as much dimmer, so its line does not step. */
    leastPx: 0.9,
    /** The most the lamps add where they lie over one another: above it the sum rolls off, so no arc burns to white. */
    most: 1.1,
    /** Where round the rim the lamps stand: from and to in degrees, how many, share of the radius, thickness and half length in degrees, level, coolness (each a range). */
    groups: [
      { deg: [-52, 50], count: 14, share: [0.9, 0.988], thick: [0.5, 1.2], half: [4, 15], level: [0.3, 1.5], cool: [0, 0.08] },
      { deg: [132, 232], count: 12, share: [0.9, 0.988], thick: [0.5, 1.2], half: [4, 15], level: [0.3, 1.5], cool: [0, 0.1] },
      { deg: [48, 134], count: 6, share: [0.93, 0.988], thick: [0.8, 2.2], half: [10, 26], level: [0.15, 0.4], cool: [0.7, 1] },
      { deg: [234, 306], count: 4, share: [0.93, 0.985], thick: [0.6, 1.1], half: [4, 10], level: [0.3, 0.7], cool: [0, 0.1] },
    ],
    /** The ceiling's soft light over the top of the rim: share, place, thickness, half length, level, coolness. */
    top: [0.957, 92, 9, 70, 0.06, 1] as const,
  },
  /** The air bubble under the crown of the glass. `seasons`: the seasons whose approved images show it (winter's only); in the others it is not drawn. */
  bubble: { seasons: ['winter'] as readonly string[], widthMm: 20.5, depthMm: 5.6, gapMm: 0.12, patch: 0.46, waist: 0.5, flat: 2.7, leanDeg: 16, under: 0.03, underTint: [1, 0.66, 0.36] as V3, slide: 0.0025, wobble: 0.09, line: 0.015, sky: 0.2, inner: 0.08, glint: 0.5, milk: 0.05, patchFill: 0.11, outer: 0.5, fill: [1.6, 1.25, 0.85] as V3, shade: 0.12, edge: 0.5, warm: 1, reach: 0.35, patchGain: 0.1, swirl: 0.12, streakDir: [-0.9, 0, 0.35] as V3, streakPower: 2.5, lip: 0.6, spark: 2.5, sparkTint: [1, 0.92, 0.75] as V3 },
}

/**
 * What a season sets on the shared glass, against its own approved image. Winter's are the amounts the shell was built on.
 * `windowTint`: the colour of the window's reflection over the key light's. `windowGain`: the gain of its four orders (outer
 * face, inner face, third, through view). `windowSoftDeg`: how far its edges are feathered. `windowGrain`: the depth of the
 * texture inside it. `rimTint`: the room's light in the rim's band and on the outline. `wallTint`: the same in the wall low on
 * the glass. `ringCover`: how much of the inside the ring at the outline hides, short of its outermost line, which always covers. `strip`: the gain of the tall cool strip at the left.
 * `bend`: how much of the mirrored band inside the outline is drawn over the lens's own picture there. `ringThin`: how far the
 * ring's inner edge is moved out toward the outline, 0 to 1, which thins the band round the glass. `rimClear`: how much of the
 * inside the rim's band hides. `topLine`: how much of the cool line the ring carries over the top. `ringMottle`: the depth of the
 * streaks and mottle in the ring. `ceiling`: the gain of the ceiling's reflection across the top of the glass.
 * `windowShade`: how much of the dark crescent beside the window's reflection, its shade and its cool glow, is drawn.
 * `rimGlow`: how much of the room's even glow across the rim zone is drawn (its lines stay).
 * `roomHue`, `roomHueOn`: the colour the room's walls take in the glass's reflections and how far they take it, 0 to 1.
 * `arcs`, `arcTint`, `arcCool`: the gain and the colour of the lamps outside the frame that the rim shows as fine arcs, and the gain of the cool ones among them.
 */
export interface GlassAmounts {
  windowTint: V3
  windowGain: readonly [number, number, number, number]
  windowSoftDeg: number
  windowGrain: number
  rimTint: V3
  wallTint: V3
  ringCover: number
  strip: number
  bend: number
  ringThin: number
  rimClear: number
  topLine: number
  ringMottle: number
  ceiling: number
  roomHue: V3
  roomHueOn: number
  windowShade: number
  rimGlow: number
  arcs: number
  arcTint: V3
  arcCool: number
}

const WINTER_GLASS: GlassAmounts = { windowTint: glassLook.window.tint, windowGain: [1, 1, 1, 1], windowSoftDeg: 0, windowGrain: 0, rimTint: [1, 1, 1], wallTint: [1, 1, 1], ringCover: 1, strip: 1, bend: 1, ringThin: 0, rimClear: 1, topLine: 1, ringMottle: 1, ceiling: 1, roomHue: [1, 1, 1], roomHueOn: 0, windowShade: 1, rimGlow: 1, arcs: 0, arcTint: [1, 1, 1], arcCool: 0 }
const glassAmounts = new Map<string, GlassAmounts>()

export function setGlass(season: string, amounts: Partial<GlassAmounts>): void {
  glassAmounts.set(season, { ...WINTER_GLASS, ...amounts })
}

export function glassOf(season: string): GlassAmounts {
  return glassAmounts.get(season) ?? WINTER_GLASS
}

const G = config.globe
const RAD = Math.PI / 180
const baseRadiusMm = G.baseDiameterMm / 2
const seatRadiusMm = Math.sqrt(Math.max(lensRadiusMm * lensRadiusMm - collarY * collarY, 1))
const num = (x: number): string => {
  const s = String(x)
  return /[.e]/.test(s) ? s : `${s}.0`
}
const vec = (a: readonly number[]): string => `vec${a.length}(${a.map(num).join(', ')})`
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

function hairs(): { planes: string; spans: string } {
  const rng = stream('glass:hair')
  const planes: string[] = []
  const spans: string[] = []
  const n = glassLook.hair.count
  for (let i = 0; i < n; i++) {
    const near = i < Math.ceil(n * 0.6)
    const c = unit(near ? [0.62 + rng.range(-0.3, 0.3), 0.6 + rng.range(-0.3, 0.3), 0.45 + rng.range(-0.25, 0.3)] : [rng.range(-1, 1), rng.range(-0.6, 1), rng.range(0.1, 1)])
    const k = unit([rng.gauss(), rng.gauss(), rng.gauss()])
    const m = unit([c[1] * k[2] - c[2] * k[1], c[2] * k[0] - c[0] * k[2], c[0] * k[1] - c[1] * k[0]])
    planes.push(vec([m[0], m[1], m[2], rng.range(0.45, 1)]))
    spans.push(vec([c[0], c[1], c[2], Math.cos(rng.range(5, 17) * RAD)]))
  }
  return { planes: `vec4[${n}](${planes.join(', ')})`, spans: `vec4[${n}](${spans.join(', ')})` }
}

const W = glassLook.window
const heroPitch = config.cameras.hero.pitchDeg * RAD
const ARC_AXIS: V3 = [0, -Math.sin(heroPitch), -Math.cos(heroPitch)]
const ARC_UP: V3 = [0, Math.cos(heroPitch), -Math.sin(heroPitch)]
function arcLamps(): (readonly [number, number, number, number, number, number])[] {
  const rng = stream('glass:arcs')
  const out: (readonly [number, number, number, number, number, number])[] = [glassLook.arcs.top]
  for (const g of glassLook.arcs.groups) {
    for (let i = 0; i < g.count; i++) {
      const at = g.deg[0] + ((i + rng.range(0.15, 0.85)) / g.count) * (g.deg[1] - g.deg[0])
      const bright = Math.pow(rng.range(0, 1), 2.2)
      out.push([rng.range(g.share[0], g.share[1]), at, rng.range(g.thick[0], g.thick[1]), rng.range(g.half[0], g.half[1]), g.level[0] + (g.level[1] - g.level[0]) * bright, rng.range(g.cool[0], g.cool[1])])
    }
  }
  return out
}
const ARC_LAMPS = arcLamps()
const ARC_N = ARC_LAMPS.length
const ARC_AT = `vec4[${ARC_N}](${ARC_LAMPS.map((l) => vec([2 * Math.acos(l[0]), l[1] * RAD, l[2] * RAD, 1 / (l[3] * RAD)])).join(', ')})`
const ARC_LEVEL = `vec2[${ARC_N}](${ARC_LAMPS.map((l) => vec([l[4] * (1 - l[5]), l[4] * l[5]])).join(', ')})`
const STRIP = (() => {
  const c = unit(glassLook.strip.centre)
  const b = unit([-c[2], 0, c[0]])
  const a = unit([b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]])
  return { c, a, b }
})()
const HAIR = hairs()

const GLASS_GLSL = `
${ROOM_GLSL}
uniform mat3 uTurn;
uniform vec3 uGlobeAt;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uBase;
uniform vec3 uPool;
uniform vec3 uSlab;
uniform float uOwn;
uniform vec3 uWinTint;
uniform vec4 uWinGain;
uniform vec3 uWinSoft;
uniform vec3 uRimTint;
uniform vec3 uWallTint;
uniform vec4 uRingAmt;
uniform vec4 uRimAmt;
uniform vec4 uRoomHue;
uniform float uRimGlow;
uniform vec4 uArc;
varying vec3 vEye;
const float GLASS_IOR = ${num(G.glassIor)};
const float SEAT_Y = ${num(collarY)};
const float SEAT_R = ${num(seatRadiusMm)};
const float BASE_R = ${num(baseRadiusMm)};
const float CENTRE_Y = ${num(centreHeightMm)};
const vec3 WIN_C = ${vec(unit(W.centre))};
const vec3 WIN_A = ${vec(unit(W.along))};
const vec3 WIN_B = ${vec(unit(W.across))};
#define WIN_TINT (uWinTint * ${num(W.level)})
const vec4 WIN_SPAN[4] = vec4[4](${W.orders.map((o) => vec([o.alongDeg[0] * RAD, o.alongDeg[1] * RAD, o.acrossDeg[0] * RAD, o.acrossDeg[1] * RAD])).join(', ')});
const vec4 WIN_CUT[4] = vec4[4](${W.orders.map((o) => vec([o.outFrom * RAD, o.outSlope, o.inFrom * RAD, o.inSlope])).join(', ')});
const vec3 WIN_LEVEL[4] = vec3[4](${W.orders.map((o) => vec([o.outer, o.inner, o.power])).join(', ')});
const vec3 WIN_END[4] = vec3[4](${W.orders.map((o) => vec([o.cutDeg * RAD, o.cutSlant, o.tail])).join(', ')});
const vec3 WIN_HUE[4] = vec3[4](${W.orders.map((o) => vec(o.tint)).join(', ')});
const vec3 WIN_BASE[4] = vec3[4](${W.orders.map((o) => vec(o.base)).join(', ')});
const vec3 WIN_CORE[4] = vec3[4](${W.orders.map((o) => vec(o.core)).join(', ')});
const vec4 WIN_FALL[4] = vec4[4](${W.orders.map((o) => vec(o.fallDeg.map((x) => x * RAD))).join(', ')});
const float WIN_FLOOR[4] = float[4](${W.orders.map((o) => num(o.fallTo)).join(', ')});
const float WIN_GAIN[4] = float[4](${[1, glassLook.second.gain, glassLook.third.gain, glassLook.through.window].map((g) => num(g * W.gain)).join(', ')});
const vec3 STRIP_C = ${vec(STRIP.c)};
const vec3 STRIP_A = ${vec(STRIP.a)};
const vec3 STRIP_B = ${vec(STRIP.b)};
const float STRIP_GAIN[4] = float[4](${glassLook.strip.gain.map(num).join(', ')});
const vec4 HAIR_M[${glassLook.hair.count}] = ${HAIR.planes};
const vec4 HAIR_C[${glassLook.hair.count}] = ${HAIR.spans};

float glassShare(vec3 v) {
  float eyeDist = length(vEye);
  float along = dot(v, -vEye / eyeDist);
  return clamp(sqrt(max(1.0 - along * along, 0.0)) / max(along, 1e-4) * sqrt(max(eyeDist * eyeDist - uLens.x * uLens.x, 1.0)) / uLens.x, 0.0, 1.0);
}
float glassShareRaw(vec3 v) {
  float eyeDist = length(vEye);
  float along = dot(v, -vEye / eyeDist);
  return sqrt(max(1.0 - along * along, 0.0)) / max(along, 1e-4) * sqrt(max(eyeDist * eyeDist - uLens.x * uLens.x, 1.0)) / uLens.x;
}
float glassLimb(float s) {
  return 1.0 - smoothstep(1.0 - max(${num(glassLook.limbPx)} * fwidth(s), 1e-4), 1.0, s);
}
float glassFresnel(float c, float n) {
  float g2 = n * n - 1.0 + c * c;
  if (g2 <= 0.0) return 1.0;
  float g = sqrt(g2);
  float a = (g - c) / (g + c);
  float b = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
  return clamp(0.5 * a * a * (1.0 + b * b), 0.0, 1.0);
}
float glassHash(vec3 c) {
  uvec3 v = uvec3(ivec3(c) + 32768);
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return float(v.x >> 8u) / 16777216.0;
}
float glassNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(glassHash(i), glassHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(glassHash(i + vec3(0.0, 1.0, 0.0)), glassHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(glassHash(i + vec3(0.0, 0.0, 1.0)), glassHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(glassHash(i + vec3(0.0, 1.0, 1.0)), glassHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float glassTail(float x) {
  float under = max(${num(W.tip.tailFromDeg * RAD)} - x, 0.0);
  return ${num(W.tip.tailSlope)} * max(${num(W.tip.tailDeg[1] * RAD)} - x, 0.0) - ${num(W.tip.tailCurve / RAD)} * under * under;
}
vec3 glassWindow(vec3 d, float soft, int k) {
  float z = dot(d, WIN_C);
  if (z < 0.25) return vec3(0.0);
  vec2 q = vec2(atan(dot(d, WIN_A), z), atan(dot(d, WIN_B), z));
  if (k != 0) q += vec2(-1.3, 1.0) * ((glassNoise(vec3(q * ${num(W.edgeDeg.wobbleRate)}, 11.0)) - 0.5) * ${num(W.edgeDeg.wobble * RAD)});
  vec4 span = WIN_SPAN[k];
  vec4 cut = WIN_CUT[k];
  vec3 level = WIN_LEVEL[k];
  float first = k == 0 ? 1.0 : 0.0;
  float outer = span.z + cut.y * max(q.x - cut.x, 0.0) + first * glassTail(q.x);
  float inner = span.w - cut.w * max(q.x - cut.z, 0.0) + first * ${num(W.tip.widen * RAD)} * smoothstep(${num(W.tip.widenDeg[0] * RAD)}, ${num(W.tip.widenDeg[1] * RAD)}, q.x);
  float eo = (k == 1 ? ${num(W.edgeDeg.outerMain * RAD)} : ${num(W.edgeDeg.outer * RAD)} * (1.0 + ${num(W.edgeDeg.firstOuter - 1)} * first)) + soft;
  float ei = (k == 1 ? ${num(W.edgeDeg.innerMain * RAD)} : mix(${num(W.edgeDeg.inner * RAD)}, ${num(W.edgeDeg.tipInner * RAD)}, first * smoothstep(${num(W.tip.flatDeg[0] * RAD)}, ${num(W.tip.flatDeg[1] * RAD)}, q.x))) + soft;
  float ee = ${num(W.edgeDeg.end * RAD)} + soft;
  float et = mix(ee, ${num(W.edgeDeg.tail * RAD)} + soft, first);
  float reach = q.x + first * ${num(W.tip.slant)} * max(${num(W.tip.slantFromDeg * RAD)} - q.y, 0.0);
  float lean = cut.y * smoothstep(0.0, ${num(3 * RAD)}, q.x - cut.x);
  float m = smoothstep(-eo, eo, (q.y - outer) * inversesqrt(1.0 + lean * lean)) * smoothstep(-ei, ei, (inner - q.y) * inversesqrt(1.0 + cut.w * cut.w));
  m *= smoothstep(-et, et, q.x - span.x) * smoothstep(-ee, ee, span.y - reach) * smoothstep(0.0, eo + ei, inner - outer);
  vec3 ending = WIN_END[k];
  m *= mix(ending.z, 1.0, smoothstep(${num(-W.edgeDeg.cut * RAD)}, ${num(W.edgeDeg.cut * RAD)}, q.x - ending.x + ending.y * (q.y - outer)));
  if (m <= 0.0) return vec3(0.0);
  float u = clamp((q.y - outer) / max(inner - outer, 1e-3), 0.0, 1.0);
  float tail = 1.0 - smoothstep(${num(W.tip.tailDeg[0] * RAD)}, ${num(W.tip.tailDeg[1] * RAD)}, q.x - ${num(W.tip.tailLeanDeg * RAD)} * pow(1.0 - u, 8.0));
  float top = mix(level.x, level.y, first * max(smoothstep(${num(W.tip.flatDeg[0] * RAD)}, ${num(W.tip.flatDeg[1] * RAD)}, q.x), tail));
  m *= (1.0 - ${num(1 - W.tip.tailLevel)} * first * tail) * mix(1.0, WIN_FLOOR[k], smoothstep(WIN_FALL[k].z, WIN_FALL[k].w, q.x));
  vec3 fade = WIN_HUE[k] * mix(vec3(1.0), ${vec(W.tip.tint)}, first * smoothstep(${num(W.tip.fadeDeg[0] * RAD)}, ${num(W.tip.fadeDeg[1] * RAD)}, reach));
  vec3 core = vec3(1.0) + WIN_CORE[k] * (1.0 - smoothstep(WIN_FALL[k].x, WIN_FALL[k].y, q.x));
  float plate = 1.0 + first * ${num(W.tip.plate)} * (1.0 - smoothstep(${num(W.tip.plateDeg[0] * RAD)}, ${num(W.tip.plateDeg[1] * RAD)}, q.x));
  return fade * (level.y * plate * WIN_BASE[k] + (top - level.y) * pow(1.0 - u, level.z) * core) * (m * (0.9 + 0.1 * glassNoise(vec3(q * 22.0, 3.0))) * (1.0 + uWinSoft.y * (glassNoise(vec3(q * 5.0, 7.0)) + 0.5 * glassNoise(vec3(q * 13.0, 5.0)) - 0.75)));
}
float glassHalo(vec3 d) {
  float z = dot(d, WIN_C);
  if (z < 0.2) return 0.0;
  vec2 q = vec2(atan(dot(d, WIN_A), z), atan(dot(d, WIN_B), z));
  vec4 span = WIN_SPAN[0];
  vec4 cut = WIN_CUT[0];
  float outer = span.z + cut.y * max(q.x - cut.x, 0.0) + glassTail(q.x);
  float inner = span.w - cut.w * max(q.x - cut.z, 0.0) + ${num(W.tip.widen * RAD)} * smoothstep(${num(W.tip.widenDeg[0] * RAD)}, ${num(W.tip.widenDeg[1] * RAD)}, q.x);
  vec2 away = vec2(max(max(span.x - q.x, q.x - span.y), 0.0), max(max(outer - q.y, q.y - inner), 0.0)) / ${vec(W.halo.wideDeg.map((x) => x * RAD))};
  return exp(-0.5 * dot(away, away));
}
float glassGap(vec3 d) {
  float z = dot(d, WIN_C);
  if (z < 0.2) return 0.0;
  vec2 q = vec2(atan(dot(d, WIN_A), z), atan(dot(d, WIN_B), z));
  vec4 span = WIN_SPAN[0];
  vec4 cut = WIN_CUT[0];
  float inner = span.w - cut.w * max(q.x - cut.z, 0.0) + ${num(W.tip.widen * RAD)} * smoothstep(${num(W.tip.widenDeg[0] * RAD)}, ${num(W.tip.widenDeg[1] * RAD)}, q.x);
  vec2 away = vec2(max(max(span.x - q.x, q.x - span.y), 0.0), max(q.y - inner, 0.0)) / ${vec(W.gap.wideDeg.map((x) => x * RAD))};
  return exp(-0.5 * dot(away, away)) * smoothstep(${num(-2 * RAD)}, 0.0, q.y - inner);
}
float glassDark(vec3 d) {
  float z = dot(d, WIN_C);
  if (z < 0.2) return 0.0;
  vec2 q = vec2(atan(dot(d, WIN_A), z), atan(dot(d, WIN_B), z)) - ${vec(W.dark.atDeg.map((x) => x * RAD))};
  vec2 axis = ${vec(W.dark.axis)};
  float side = dot(q, axis);
  float inward = dot(q, vec2(axis.y, -axis.x));
  return smoothstep(${num(W.dark.sideDeg[0] * RAD)}, ${num(W.dark.sideDeg[1] * RAD)}, side) * (1.0 - smoothstep(${num(W.dark.sideDeg[2] * RAD)}, ${num(W.dark.sideDeg[3] * RAD)}, side)) * smoothstep(${num(W.dark.inDeg[0] * RAD)}, ${num(W.dark.inDeg[1] * RAD)}, inward);
}
float glassStrip(vec3 d, float soft) {
  float z = dot(d, STRIP_C);
  if (z < 0.3) return 0.0;
  vec2 q = vec2(atan(dot(d, STRIP_A), z), atan(dot(d, STRIP_B), z));
  float wide = ${num(glassLook.strip.wideDeg * RAD)} + soft;
  float end = ${num(glassLook.strip.endDeg * RAD)} + soft;
  float tall = smoothstep(${num(glassLook.strip.tallDeg[0] * RAD)} - end, ${num(glassLook.strip.tallDeg[0] * RAD)} + end, q.x) * (1.0 - smoothstep(${num(glassLook.strip.tallDeg[1] * RAD)} - end, ${num(glassLook.strip.tallDeg[1] * RAD)} + end, q.x));
  return exp(-q.y * q.y / (2.0 * wide * wide)) * tall * (0.6 + 0.4 * (1.0 - smoothstep(-0.05, 0.12, q.x))) * (0.8 + 0.4 * glassNoise(vec3(q * 17.0, 9.0)));
}
vec3 glassPoints(vec3 d) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${ROOM_LIGHTS}; i++) {
    float w = uRoomDir[i].w;
    float narrow = inversesqrt(1.0 + (1.0 - w * w) / (w * w * ${num(glassLook.through.point * glassLook.through.point)}));
    sum += uRoomCol[i] * smoothstep(narrow - (1.0 - narrow) * 1.8, narrow + (1.0 - narrow) * 0.2, dot(d, uRoomDir[i].xyz));
  }
  return sum * ${num(glassLook.through.pointGain)};
}
vec3 glassArcs(vec3 d) {
  float along = dot(d, ${vec(ARC_AXIS)});
  float beta = acos(clamp(along, -1.0, 1.0));
  float least = min(${num(glassLook.arcs.leastPx)} * fwidth(beta), 0.05);
  if (along < 0.45) return vec3(0.0);
  float phi = atan(dot(d, ${vec(ARC_UP)}), d.x);
  vec4 at[${ARC_N}] = ${ARC_AT};
  vec2 level[${ARC_N}] = ${ARC_LEVEL};
  vec2 sum = vec2(0.0);
  for (int i = 0; i < ${ARC_N}; i++) {
    float wide = max(at[i].z, least);
    float across = (beta - at[i].x) / wide;
    float turnAt = abs(mod(phi - at[i].y + ${num(Math.PI)}, ${num(2 * Math.PI)}) - ${num(Math.PI)}) * at[i].w;
    if (abs(across) > 3.0 || turnAt > 1.0) continue;
    float whole = 1.0 - ${num(glassLook.arcs.broken)} * (1.0 - smoothstep(0.3, 0.62, glassNoise(vec3(phi * 9.0, beta * 23.0, float(i) * 3.7))));
    sum += level[i] * (exp(-across * across) * (1.0 - smoothstep(0.3, 1.0, turnAt)) * (1.0 + ${num(glassLook.arcs.core)} * exp(-9.0 * turnAt * turnAt)) * (i == 0 ? 1.0 : whole) * at[i].z / wide);
  }
  float all = sum.x + sum.y;
  if (all > 0.0) sum *= ${num(glassLook.arcs.most)} * (1.0 - exp(-all / ${num(glassLook.arcs.most)})) / all;
  return uArc.rgb * sum.x + ${vec(glassLook.arcs.cool)} * (uArc.a * sum.y);
}
vec3 glassRoom(vec3 d, float soft, int k, float own) {
  vec3 c = stageRoomSeen(d, k == 3 ? ${num(glassLook.room.throughRough)} : ${num(glassLook.room.innerRough)});
  if (k != 3) c = mix(c, uRoomHue.rgb * dot(c, vec3(0.2126, 0.7152, 0.0722)), uRoomHue.a);
  c += soft < 0.0 ? glassPoints(d) : stageRoomLights(d, ${num(glassLook.through.disc)} + soft * 0.05);
  if (uOwn < 0.5) return c;
  soft = max(soft, 0.0);
  float side = mix(${num(glassLook.room.side)}, 1.0, smoothstep(-0.35, 0.85, dot(d, WIN_C)));
  float blotch = 1.0 - ${num(glassLook.room.blotch)} * glassNoise(d * 2.7 + 13.0);
  vec3 dim = mix(uGround, uSky, smoothstep(-0.3, 0.45, d.y)) * ${num(glassLook.room.gain)} * own * side * blotch * smoothstep(-0.8, 0.2, d.z);
  float up = dot(d, ${vec(unit(glassLook.ceiling.dir))});
  float streak = 1.0 - ${num(glassLook.ceiling.depth)} * (0.5 + 0.5 * sin(up * ${num(glassLook.ceiling.rings)} + 6.0 * glassNoise(d * 2.3 + 29.0)));
  if (k != 3) dim += uSky * ${vec(glassLook.ceiling.tint)} * (${num(glassLook.ceiling.gain)} * uRimAmt.w) * own * blotch * streak * smoothstep(${num(glassLook.ceiling.edge[0])}, ${num(glassLook.ceiling.edge[1])}, up) * smoothstep(${num(glassLook.ceiling.low[0])}, ${num(glassLook.ceiling.low[1])}, d.y);
  float rim = max(dot(d, uRimDir), 0.0);
  dim += uRimCol * ${vec(glassLook.rimCard.tint)} * own * (${num(glassLook.rimCard.wide)} * pow(rim, ${num(glassLook.rimCard.widePower)}) + ${num(glassLook.rimCard.core)} * pow(rim, ${num(glassLook.rimCard.corePower)}));
  float lit = k == 0 ? 1.0 - ${num(W.dark.depth)} * glassDark(d) : 1.0;
  c += dim * lit;
  if (k < 2 && uArc.a + uArc.r + uArc.g + uArc.b > 0.0) c += glassArcs(d) * (k == 0 ? 1.0 : ${num(glassLook.arcs.inner)});
  c += uKeyCol * WIN_TINT * (WIN_GAIN[k] * uWinGain[k]) * glassWindow(d, (k == 3 ? ${num(glassLook.through.softDeg * RAD)} : soft) + uWinSoft.x, k);
  if (k == 0) c += uKeyCol * WIN_TINT * ${vec(W.halo.tint)} * (${num(W.halo.gain)} * uWinGain.x) * glassHalo(d) * lit;
  c += ${vec(glassLook.strip.tint)} * uKeyCol.b * (STRIP_GAIN[k] * uRingAmt.y) * glassStrip(d, soft);
  return c;
}
vec3 glassSeen(vec3 o, vec3 d, float soft, int k, float own) {
  vec3 dw = uTurn * d;
  vec3 c = glassRoom(dw, soft, k, own);
  if (d.y < -0.003) {
    float t = (SEAT_Y - o.y) / d.y;
    vec3 q = o + d * t;
    float rho = length(q.xz);
    if (t > 0.0 && rho < BASE_R) {
      float open = smoothstep(SEAT_R - 2.0, SEAT_R + 17.0, rho);
      vec3 keyLocal = uKeyDir * uTurn;
      vec3 lit = uSky * (0.2 + 0.8 * open) + uKeyCol * max(keyLocal.y, 0.0) * open * (0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(normalize(q.xz), normalize(keyLocal.xz + 1e-4))));
      float wear = 0.75 + 0.5 * glassNoise(vec3(q.xz * 0.35, 1.0));
      return uBase * lit * wear * 0.3183 + uPool * uBase * 0.2 * (1.0 - open);
    }
    vec3 ow = uTurn * (o + vec3(0.0, CENTRE_Y, 0.0)) + uGlobeAt;
    if (dw.y < -0.003 && ow.y > 0.0) {
      vec3 s = ow + dw * (-ow.y / dw.y);
      float dist = length(s.xz - uGlobeAt.xz);
      float contact = 0.8 * (1.0 - smoothstep(BASE_R * 0.85, BASE_R * 1.5, dist));
      float lit = exp(-dist * dist / (2.0 * 650.0 * 650.0));
      vec3 slab = uRoomFloor * (1.0 - 0.6 * contact) + uSlab * uKeyCol * max(uKeyDir.y, 0.0) * (1.0 - contact) * lit;
      slab += uSlab * uPool * 3.0 * exp(-dist * dist / (2.0 * 110.0 * 110.0)) * (1.0 - 0.6 * contact);
      float away = smoothstep(1400.0, 2900.0, length(s.xz));
      return mix(slab * ${num(glassLook.floor)}, c, away);
    }
  }
  return c;
}
vec3 glassWavy(vec3 n, float amount) {
  float ring = sin(n.y * ${num(glassLook.wave.rings)} + 2.6 * glassNoise(n * 2.3 + 4.0));
  vec3 up = vec3(0.0, 1.0, 0.0) - n * n.y;
  vec3 drift = vec3(glassNoise(n * 5.7 + 11.0), glassNoise(n * 5.7 + 23.0), glassNoise(n * 5.7 + 37.0)) - 0.5;
  vec3 w = up * ring * ${num(glassLook.wave.ringDeg * RAD)} + (drift - n * dot(drift, n)) * ${num(glassLook.wave.driftDeg * RAD * 2)};
  return normalize(n + w * amount);
}
float glassDust(vec3 n) {
  vec3 x = n * ${num(glassLook.dust.cells)};
  vec3 i = floor(x);
  float h = glassHash(i);
  if (h > ${num(glassLook.dust.share)}) return 0.0;
  vec3 c = vec3(glassHash(i + 91.0), glassHash(i + 173.0), glassHash(i + 257.0)) * 0.6 + 0.2;
  float size = 0.14 + 0.22 * glassHash(i + 311.0);
  return (1.0 - smoothstep(size * 0.45, size, length(x - i - c))) * (0.35 + 0.65 * h / ${num(glassLook.dust.share)});
}
float glassHair(vec3 n) {
  float bend = glassNoise(n * 6.0 + 51.0) - 0.5;
  float sum = 0.0;
  for (int i = 0; i < ${glassLook.hair.count}; i++) {
    float d = dot(n, HAIR_M[i].xyz) + ${num(glassLook.hair.bend)} * bend * (mod(float(i), 2.0) * 2.0 - 1.0);
    float w = max(fwidth(d), ${num(glassLook.hair.widthMm / lensRadiusMm)});
    sum += (1.0 - smoothstep(0.4 * w, 1.3 * w, abs(d))) * smoothstep(HAIR_C[i].w, HAIR_C[i].w + 0.015, dot(n, HAIR_C[i].xyz)) * HAIR_M[i].w;
  }
  return min(sum, 1.0);
}
`

const THROUGH = `
${GLASS_GLSL}
void main() {
  vec3 n = normalize(vStageLocal);
  vec3 p = n * uLens.x;
  vec3 v = normalize(p - vEye);
  float c1 = clamp(dot(n, -v), 0.0, 1.0);
  vec3 t = uLens.z > 0.5 ? refract(v, n, 1.0 / uLens.y) : v;
  float chord = 2.0 * uLens.x * max(dot(-n, t), 0.0);
  vec3 q = p + t * chord;
  vec3 n2 = normalize(q);
  vec3 o = uLens.z > 0.5 ? refract(t, -n2, uLens.y) : v;
  if (dot(o, o) < 0.5) o = reflect(t, -n2);
  float wall = uLens.z > 0.5 ? glassFresnel(c1, GLASS_IOR) : 0.0;
  vec3 mid = stageGrid(p + t * chord * 0.5);
  vec3 back = glassSeen(q, o, -1.0, 3, ${num(glassLook.through.own)});
  if (q.y < SEAT_Y) back = uBase * (0.12 * uSky + 0.3183 * stageGrid(q * 0.96));
  vec3 col = back * (1.0 - wall) * ${vec(glassLook.through.wall)};
  vec3 m = reflect(t, -n2);
  vec3 glow = vec3(0.0);
  for (int i = 1; i <= ${glassLook.through.steps}; i++) glow += stageGrid(q + m * chord * (float(i) / ${num(glassLook.through.steps + 1)}));
  float share = glassShare(v);
  vec3 axis = normalize(-vEye);
  vec3 around = n - axis * dot(n, axis);
  around /= max(length(around), 1e-4);
  float arcs = 1.0 + ${num(glassLook.through.arcs)} * smoothstep(0.35, 0.8, share) * (glassNoise(vec3(around.xy * 1.7, share * ${num(glassLook.through.arcRings)})) - 0.5);
  col += uSky * ${vec(glassLook.through.liftTint)} * (${num(glassLook.through.lift[0])} + ${num(glassLook.through.lift[1])} * pow(share, ${num(glassLook.through.lift[2])})) * (0.78 + 0.44 * glassNoise(n2 * 2.2 + 17.0)) * arcs;
  col += wall * ${num(glassLook.through.mirror)} * glow / ${num(glassLook.through.steps)};
  float fog = stageVeil(chord);
  col = stageFogged(col, mid, fog);
  float cover = glassLimb(share);
  gl_FragColor = vec4(col * cover, 1.0 - cover);
  if (uDiag != 0) gl_FragColor = vec4(stageDiag(col, normalize(vStageWorld - uLensCentre), fog, 0.0, 0.0).rgb, 0.0);
}`

const SHELL = `
uniform vec3 uBloom;
uniform vec3 uOverlay[2];
uniform vec2 uOverlayOn;
uniform sampler2D uBehind;
uniform vec2 uBehindSize;
uniform vec3 uBubbleAt;
${GLASS_GLSL}
void main() {
#ifdef GLASS_RING
  if (uDiag != 0) discard;
#endif
  if (uDiag != 0) {
    if (uDiag != ${viewCode('ids')} && uDiag != ${viewCode('standins')}) discard;
    vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
    if (cell.x == 0.0 && cell.y == 0.0 && uOverlayOn.x > 0.5) gl_FragColor = vec4(uOverlay[0], 0.0);
    else if (cell.x == 0.0 && cell.y == 2.0 && uOverlayOn.y > 0.5) gl_FragColor = vec4(uOverlay[1], 0.0);
    else discard;
    return;
  }
#ifdef GLASS_RING
  vec3 v = normalize(vStageLocal - vEye);
  float ringB = dot(vEye, v);
  vec3 n = normalize(vEye - v * (ringB + sqrt(max(ringB * ringB - dot(vEye, vEye) + uLens.x * uLens.x, 0.0))));
  vec3 p = n * uLens.x;
  float s = glassShare(v);
  if (s < ${num(Math.min(glassLook.ring.from - glassLook.ring.soft, glassLook.ring.mirror.from))}) discard;
#else
  vec3 n = normalize(vStageLocal);
  vec3 p = n * uLens.x;
  vec3 v = normalize(p - vEye);
  float s = glassShare(v);
  float bendRaw = glassShareRaw(normalize(vStageLocal - vEye));
  vec2 bendSlope = vec2(dFdx(bendRaw), dFdy(bendRaw));
  vec2 footSlope = vec2(dFdx(p.y), dFdy(p.y));
#endif
  float nv = clamp(dot(n, -v), 0.0, 1.0);

  vec3 nw = glassWavy(n, 1.0);
  float cw = clamp(dot(nw, -v), 0.0, 1.0);
  vec3 tang = v + nw * cw;
  float st = length(tang);
  tang = st > 1e-5 ? tang / st : normalize(cross(nw, vec3(0.0, 1.0, 0.0)));
  float theta = atan(st, cw);
  float f1 = glassFresnel(nv, GLASS_IOR);
  float marks = 1.0 - ${num(glassLook.dust.depth)} * glassDust(n) - ${num(glassLook.hair.depth)} * glassHair(n);
  vec3 r1 = cos(theta) * nw + sin(theta) * tang;

  vec3 col = glassSeen(p, r1, 0.0, 0, 1.0) * f1 * marks;

  vec3 ni = glassWavy(n, ${num(glassLook.wave.inner)});
  float ci = clamp(dot(ni, -v), 0.0, 1.0);
  vec3 ti = v + ni * ci;
  float si = length(ti);
  ti = si > 1e-5 ? ti / si : tang;
  float thetaI = atan(si, ci);
  float inGlass = si / GLASS_IOR;
  float pass = (1.0 - f1) * (1.0 - f1) * (0.6 + 0.4 * marks);
  float s2 = inGlass / ${num(glassLook.second.face)};
  if (s2 < 1.0) {
    float a2 = thetaI + 2.0 * (asin(s2) - asin(inGlass));
    float f2 = glassFresnel(sqrt(1.0 - s2 * s2), GLASS_IOR);
    col += glassSeen(p, cos(a2) * ni + sin(a2) * ti, ${num(glassLook.second.softDeg * RAD)}, 1, ${num(glassLook.second.own)}) * ${vec(glassLook.second.tint)} * (f2 * pass);
  }
  float s3 = inGlass / ${num(glassLook.third.face)};
  if (s3 < 1.0) {
    float a3 = thetaI + 2.0 * (asin(s3) - asin(inGlass));
    float f3 = glassFresnel(sqrt(1.0 - s3 * s3), GLASS_IOR) * (1.0 - smoothstep(${num(glassLook.third.fade[0])}, ${num(glassLook.third.fade[1])}, s3));
    col += glassSeen(p, cos(a3) * ni + sin(a3) * ti, ${num(glassLook.third.softDeg * RAD)}, 2, ${num(glassLook.third.own)}) * ${vec(glassLook.third.tint)} * (f3 * pass);
  }

  float thick = glassNoise(n * 3.1 + 7.0);
  float fine = glassNoise(n * 8.3 + 2.0);
  vec3 nWorld = uTurn * n;
  float lobe = smoothstep(${num(glassLook.edge.keyLobe[0])}, ${num(glassLook.edge.keyLobe[1])}, dot(nWorld, uKeyDir));
  float back = smoothstep(${num(glassLook.edge.rimLobe[0])}, ${num(glassLook.edge.rimLobe[1])}, dot(nWorld, uRimDir));
  float from = ${num(glassLook.band.from)} + ${num(glassLook.band.wander)} * (thick - 0.5) * 2.0;
  float to = ${num(glassLook.band.to)} + ${num(glassLook.band.wander * 0.4)} * (fine - 0.5) * 2.0;
  float band = smoothstep(from - 0.004, from + 0.003, s) * (1.0 - smoothstep(to - 0.003, to + 0.004, s)) * (0.5 + 0.5 * fine) * smoothstep(${num(glassLook.band.side[0])}, ${num(glassLook.band.side[1])}, nWorld.x) * smoothstep(${num(glassLook.band.low[0])}, ${num(glassLook.band.low[1])}, nWorld.y);
  float rimZone = smoothstep(${num(glassLook.rim.from)}, ${num(glassLook.rim.to)}, s);
  float rimHigh = smoothstep(-0.35, 0.15, nWorld.y);
  float rimLine = exp(-pow((s - ${num(glassLook.rim.line)}) / ${num(glassLook.rim.lineWide)}, 2.0));
  vec3 rimAxis = normalize(-vEye);
  vec3 rimAround = n - rimAxis * dot(n, rimAxis);
  rimAround /= max(length(rimAround), 1e-4);
  float rimStreak = 1.0 + ${num(glassLook.rim.streak)} * rimHigh * (glassNoise(rimAround * 9.0 + rimAxis * (s * 60.0) + 41.0) - 0.5);
  float rimOuter = exp(-pow((s - ${num(glassLook.rim.outer)}) / ${num(glassLook.rim.outerWide)}, 2.0)) * (0.3 + 0.7 * smoothstep(0.35, 0.75, glassNoise(rimAround * 5.0 + 31.0)));
  if (uOwn > 0.5) col += uSky * uRimTint * mix(${vec(glassLook.rim.tint)}, ${vec(glassLook.rim.highTint)}, rimHigh) * (mix(${num(glassLook.rim.low)}, ${num(glassLook.rim.high)}, rimHigh) * uRimGlow * rimZone * (0.75 + 0.5 * thick) * rimStreak + ${num(glassLook.rim.lineGain)} * rimLine * (0.3 + 0.7 * fine) * (1.0 - 0.7 * rimHigh) + ${num(glassLook.rim.outerGain)} * rimOuter * rimHigh);
  float wallLeft = smoothstep(0.3, -0.3, nWorld.x);
  float wallLow = smoothstep(${num(glassLook.wall.lowY[0])}, ${num(glassLook.wall.lowY[1])}, nWorld.y + ${num(glassLook.wall.leftDrop)} * wallLeft) * uOwn;
  if (wallLow > 0.0) {
    vec3 axis = normalize(-vEye);
    vec3 around = n - axis * dot(n, axis);
    around /= max(length(around), 1e-4);
    float grain = glassNoise(around * 70.0 + axis * (s * 90.0) + 3.0);
    float speck = glassNoise(around * 190.0 + axis * (s * 200.0) + 9.0);
    float spark = smoothstep(0.84, 0.97, glassNoise(around * 330.0 + axis * (s * 300.0) + 21.0));
    float inner = ${num(glassLook.wall.wander)} * (thick - 0.5) * 2.0;
    float wallTo = ${num(glassLook.wall.leftTo)} * wallLeft + ${num(glassLook.wall.lowTo)} * smoothstep(-0.3, -0.6, nWorld.y);
    float plate = smoothstep(${num(glassLook.wall.from[0])} + inner, ${num(glassLook.wall.from[1])} + inner, s) * (1.0 - smoothstep(${num(glassLook.wall.to[0])} + wallTo, ${num(glassLook.wall.to[1])} + wallTo, s));
    float crest = exp(-pow((s - ${num(glassLook.wall.crest)}) / ${num(glassLook.wall.crestWide)}, 2.0));
    vec3 hue = mix(${vec(glassLook.wall.inTint)}, ${vec(glassLook.wall.tint)}, smoothstep(${num(glassLook.wall.from[1])}, ${num(glassLook.wall.mirrorTo)}, s));
    vec3 tw = refract(v, n, 1.0 / uLens.y);
    float chordW = 2.0 * uLens.x * max(dot(-n, tw), 0.0);
    vec3 qw = p + tw * chordW;
    vec3 mirrored = stageGrid(qw + reflect(tw, -normalize(qw)) * chordW * 0.5);
    col += wallLow * (1.0 + ${num(glassLook.wall.grain)} * (grain - 0.5) + ${num(glassLook.wall.speck)} * (speck - 0.5) + ${num(glassLook.wall.spark)} * spark) * (uSky * uWallTint * hue * (${num(glassLook.wall.plate)} * plate + ${num(glassLook.wall.peak)} * crest) + mirrored * ${num(glassLook.wall.mirror)} * plate * (1.0 - smoothstep(${num(glassLook.wall.from[1])}, ${num(glassLook.wall.mirrorTo)}, s)));
  }
  col *= 1.0 - ${num(glassLook.band.dim)} * band;

  vec3 seen = uTurn * r1;
  float seenZ = dot(seen, WIN_C);
  float dark = uOwn > 0.5 ? glassDark(seen) : 0.0;
  float tipAt = seenZ > 0.2 ? atan(dot(seen, WIN_A), seenZ) - ${num(glassLook.edge.tipDeg[0] * RAD)} : 9.0;
  tipAt /= tipAt > 0.0 ? ${num(glassLook.edge.tipDeg[2] * RAD)} : ${num(glassLook.edge.tipDeg[1] * RAD)};
  float wallZone = smoothstep(${num(glassLook.body.from)}, ${num(glassLook.body.to)}, s);
  col += uKeyCol * WIN_TINT * ${vec(W.gap.tint)} * (${num(W.gap.gain)} * uWinGain.x * glassGap(seen) * f1 * marks * (1.0 - ${num(W.dark.depth)} * dark) * mix(1.0, ${num(W.gap.mid[2])}, smoothstep(${num(W.gap.mid[0])}, ${num(W.gap.mid[1])}, nWorld.y)) * (1.0 - smoothstep(${num(W.gap.top[0])}, ${num(W.gap.top[1])}, nWorld.y)) * (0.45 + 0.55 * smoothstep(${num(W.gap.low[0])}, ${num(W.gap.low[1])}, nWorld.y)) * uOwn);
  float deep = dark * smoothstep(${num(W.dark.share[0])}, ${num(W.dark.share[1])}, s);
  if (uOwn > 0.5) col += uSky * uRimTint * ${vec(glassLook.body.tint)} * ${num(glassLook.body.sky)} * wallZone * (0.6 + 0.4 * thick) * (1.0 - dark);
  col += uKeyCol * WIN_TINT * ${vec(W.dark.glow)} * (uWinSoft.z * deep) * (0.7 + 0.6 * thick);
  col += uKeyCol * WIN_TINT * ${vec(glassLook.edge.tipTint)} * (${num(glassLook.edge.tip)} * exp(-0.5 * tipAt * tipAt) * uOwn * smoothstep(${num(glassLook.edge.tipShare[0])}, ${num(glassLook.edge.tipShare[1])}, s) * (0.6 + 0.4 * fine));

  vec3 piped = uKeyCol * WIN_TINT * ${vec(glassLook.edge.keyTint)} * ${num(glassLook.edge.key)} * lobe * mix(${num(glassLook.edge.keyLow)}, 1.0, smoothstep(${num(glassLook.edge.keyLowLobe[0])}, ${num(glassLook.edge.keyLowLobe[1])}, dot(nWorld, ${vec(glassLook.edge.keyLowDir)}))) + uRimCol * ${num(glassLook.edge.rim)} * back;
  if (uOwn > 0.5) piped += uSky * uRimTint * ${num(glassLook.edge.sky)} * (0.4 + 0.6 * smoothstep(-0.7, 0.5, nWorld.y));
  piped += uPool * ${num(glassLook.edge.pool)} * smoothstep(-0.2, -0.75, n.y);
  float edge = smoothstep(mix(${num(glassLook.edge.from)}, ${num(glassLook.edge.keyFrom)}, smoothstep(0.0, ${num(glassLook.edge.keyOn)}, lobe)), ${num(glassLook.edge.peak)}, s) * (0.35 + 0.65 * thick) * (0.7 + 0.3 * fine);
  col += piped * edge;
  col += uKeyCol * WIN_TINT * ${vec(glassLook.edge.keyTint)} * (${num(glassLook.edge.line.gain)} * smoothstep(${num(glassLook.edge.line.from)}, ${num(glassLook.edge.line.peak)}, s) * (mix(${num(glassLook.edge.line.rest)}, 1.0, smoothstep(${num(glassLook.edge.line.lobe[0])}, ${num(glassLook.edge.line.lobe[1])}, dot(nWorld, ${vec(glassLook.edge.line.dir)}))) + ${num(glassLook.edge.line.glint)} * smoothstep(${num(glassLook.edge.line.glintLobe[0])}, ${num(glassLook.edge.line.glintLobe[1])}, dot(nWorld, ${vec(glassLook.edge.line.glintDir)}))) * smoothstep(${num(glassLook.edge.line.span[0])}, ${num(glassLook.edge.line.span[1])}, dot(nWorld, ${vec(glassLook.edge.line.spanDir)})) * (1.0 + ${num(glassLook.edge.line.wander)} * (thick - 0.5)) * uOwn);

  float lift = p.y - SEAT_Y;
  float above = lift - ${num(glassLook.seat.topMm)};
  float shade = 1.0 - smoothstep(0.0, ${num(glassLook.seat.shadeMm)}, above);
  float wide = clamp(1.0 - above / ${num(glassLook.seat.wideMm)}, 0.0, 1.0);
  float line = 1.0 - smoothstep(${num(glassLook.seat.lineMm * 0.25)}, ${num(glassLook.seat.lineMm)}, above);
  float low = smoothstep(${num(glassLook.seat.shadeMm * 2.5)}, 0.0, lift);
  col *= 1.0 + (${num(glassLook.seat.gain)} - 1.0) * low * step(0.0, -r1.y);
  float footLimb = 1.0 - smoothstep(${num(glassLook.seat.limb[0])}, ${num(glassLook.seat.limb[1])}, s);
  float seat = (1.0 - mix(${num(glassLook.seat.shade)} * shade * shade, ${num(glassLook.seat.wide)} * wide, footLimb)) * (1.0 - ${num(glassLook.seat.lineDepth)} * line);
  col *= seat;
  if (uOwn > 0.5) col += uSky * ${vec(glassLook.seat.footTint)} * (${num(glassLook.seat.foot)} * exp(-pow((above - ${num(glassLook.seat.footMm)}) / ${num(glassLook.seat.footWideMm)}, 2.0)) * (0.5 + 0.5 * fine) * footLimb);

  col = min(col, ${num(glassLook.shoulder.from)}) + ${num(glassLook.shoulder.to - glassLook.shoulder.from)} * (1.0 - exp(-max(col - ${num(glassLook.shoulder.from)}, 0.0) / ${num(glassLook.shoulder.to - glassLook.shoulder.from)}));
  float alpha = (1.0 - f1) * (1.0 - ${num(glassLook.band.shade)} * band) * seat * (1.0 - ${num(W.dark.shade)} * (uWinSoft.z * deep)) * (1.0 - ${num(glassLook.rim.clear)} * uRimAmt.x * rimZone * uOwn);
  col += uBloom * (${num(glassLook.bloom.floor)} + ${num(1 - glassLook.bloom.floor)} * pow(nv, ${num(glassLook.bloom.power)})) + vec3(dot(uBloom, vec3(0.2126, 0.7152, 0.0722)) * ${num(glassLook.bloom.white)} * pow(nv, ${num(glassLook.bloom.whitePower)}));

  float limb = glassLimb(s);
#ifdef GLASS_RING
  float ringTop = smoothstep(${num(glassLook.ring.side[0])}, ${num(glassLook.ring.side[1])}, nWorld.x) * smoothstep(${num(glassLook.ring.low[0])}, ${num(glassLook.ring.low[1])}, nWorld.y);
  float ringWall = ringTop * smoothstep(${num(glassLook.ring.wallSide[0])}, ${num(glassLook.ring.wallSide[1])}, nWorld.x);
  float ringEdge = ringTop * smoothstep(${num(glassLook.ring.edge[0])}, ${num(glassLook.ring.edge[1])}, s);
  float ringGrain = glassNoise(rimAround * 70.0 + rimAxis * (s * 90.0) + 3.0) - 0.5;
  float ringSpeck = glassNoise(rimAround * 190.0 + rimAxis * (s * 200.0) + 9.0) - 0.5;
  float ringUnder = 1.0 - smoothstep(${num(glassLook.ring.low[0])}, ${num(glassLook.ring.low[1])}, nWorld.y);
  float ringIn = uRingAmt.w * ${num(glassLook.ring.thin)};
  float ring = smoothstep(mix(${num(glassLook.ring.from)} + ringIn - ${num(glassLook.ring.soft)} * ringTop, ${num(glassLook.ring.lowFrom)}, ringUnder), mix(${num(glassLook.ring.to)} + ringIn, ${num(glassLook.ring.lowTo)}, ringUnder), s);
  vec3 ringCol = col * mix(1.0, ${num(glassLook.ring.keep)}, ringTop) + uSky * uRimTint * ${vec(glassLook.ring.wall)} * (ringWall * (1.0 + uRimAmt.z * (${num(glassLook.ring.grain)} * ringGrain + ${num(glassLook.ring.speck)} * ringSpeck)));
  ringCol *= 1.0 + ringWall * uRimAmt.z * (${num(glassLook.ring.streak)} * (glassNoise(rimAround * 14.0 + rimAxis * (s * ${num(glassLook.ring.streakRings)}) + 71.0) - 0.5) + ${num(glassLook.ring.mottle)} * (glassNoise(rimAround * 38.0 + rimAxis * (s * 60.0) + 17.0) - 0.5));
  ringCol = mix(ringCol, uSky * uRimTint * mix(${vec(glassLook.ring.line)}, ${vec(glassLook.ring.lineTop)}, uRimAmt.y * smoothstep(0.6, 0.95, nWorld.y)), ${num(glassLook.ring.lineMix)} * ringEdge);
  float ringLow = (1.0 - smoothstep(${num(glassLook.ring.low[0])}, ${num(glassLook.ring.low[1])}, nWorld.y)) * smoothstep(${num(glassLook.ring.lowEnd[0])}, ${num(glassLook.ring.lowEnd[1])}, nWorld.y);
  ringCol = mix(ringCol, uSky * uRimTint * ${vec(glassLook.ring.lowLine)}, ${num(glassLook.ring.lowMix)} * ringLow * smoothstep(${num(glassLook.ring.lowAt[0])}, ${num(glassLook.ring.lowAt[1])}, s));
  float ringCover = ring * mix(1.0, mix(${num(glassLook.ring.cover)}, 1.0, ringEdge), ringTop) * (uRingAmt.x + (1.0 - uRingAmt.x) * smoothstep(${num(glassLook.ring.edge[0])}, ${num(glassLook.ring.edge[1])}, s));
  vec3 mirTo = refract(v, n, 1.0 / uLens.y);
  float mirChord = 2.0 * uLens.x * max(dot(-n, mirTo), 0.0);
  vec3 mirAt = p + mirTo * mirChord;
  vec3 mirDir = reflect(mirTo, -normalize(mirAt));
  vec3 mirror = vec3(0.0);
  float mirOpen = 1.0;
  for (int i = 0; i < ${glassLook.ring.mirror.steps}; i++) {
    vec3 x = (mirAt + mirDir * mirChord * ((float(i) + 0.5) / ${num(glassLook.ring.mirror.steps)})) * 0.96;
    vec3 gridLit;
    vec3 gridAir;
    vec3 gridToward;
    float gridOpen;
    float gridShade;
    stageGridRead(x, gridLit, gridAir, gridToward, gridOpen, gridShade);
    float solid = (1.0 - smoothstep(${num(glassLook.ring.mirror.solid[0])}, ${num(glassLook.ring.mirror.solid[1])}, gridOpen)) * mirOpen;
    mirror += solid * (uSky * ${num(glassLook.ring.mirror.snow[0])} + uKeyCol * ${num(glassLook.ring.mirror.snow[1])} * smoothstep(-0.2, 0.6, dot(normalize(x), uKeyDir * uTurn)) + gridLit * ${num(glassLook.ring.mirror.warm)}) + mirOpen * gridAir * ${num(glassLook.ring.mirror.air / glassLook.ring.mirror.steps)};
    mirOpen -= solid;
  }
  mirror *= 1.0 + ${num(glassLook.ring.mirror.streak)} * (glassNoise(rimAround * 4.0 + rimAxis * (s * ${num(glassLook.ring.mirror.streakRings)}) + 57.0) - 0.5);
  float mirFrom = mix(${num(glassLook.ring.mirror.lowFrom)}, ${num(glassLook.ring.mirror.from)}, smoothstep(${num(glassLook.ring.mirror.side[0])}, ${num(glassLook.ring.mirror.side[1])}, nWorld.y) * (1.0 - smoothstep(${num(glassLook.ring.mirror.side[1])}, ${num(glassLook.ring.mirror.side[2])}, nWorld.y)) * smoothstep(0.3, -0.3, nWorld.x));
  float mirBand = smoothstep(mirFrom, mirFrom + ${num(glassLook.ring.mirror.wide)}, s) * (1.0 - f1) * limb;
  vec3 ringOut = ringCol * (limb * ringCover);
  float ringKeep = 1.0 - ringCover * limb;
  float mirCover = mix(${num(glassLook.ring.mirror.cover)}, ${num(glassLook.ring.mirror.coverHigh)}, smoothstep(${num(glassLook.ring.mirror.side[1])}, ${num(glassLook.ring.mirror.side[2])}, nWorld.y)) * mirBand * uRingAmt.x;
  gl_FragColor = vec4(ringOut * (1.0 - mirCover) + mirror * (${num(glassLook.ring.mirror.gain)} * mirBand * uRingAmt.x), ringKeep * (1.0 - mirCover));
#else
  float keep = mix(1.0, alpha, limb);
  vec3 lit = col * limb;
  float bendAt = (s - ${num(glassLook.bend.from)}) / ${num(1 - glassLook.bend.from)};
  float bendPer = length(bendSlope);
  if (uBehindSize.x > 0.0 && uLens.z > 0.5 && bendAt > 0.0 && bendPer > 1e-6) {
    vec2 outward = bendSlope / bendPer;
    vec3 bent = vec3(0.0);
    for (int i = 0; i < ${glassLook.bend.taps}; i++) {
      float sj = s + ((float(i) + 0.5) / ${num(glassLook.bend.taps)} - 0.5) * bendPer;
      float uj = clamp((sj - ${num(glassLook.bend.from)}) / ${num(1 - glassLook.bend.from)}, 0.0, 1.0);
      float to = sj - ${num(glassLook.bend.shift)} * pow(uj, ${num(glassLook.bend.power)});
      vec3 tap = textureLod(uBehind, (gl_FragCoord.xy + outward * ((to - s) / bendPer)) / uBehindSize, 0.0).rgb;
      if (any(isnan(tap)) || any(isinf(tap))) tap = vec3(0.0);
      bent += max(tap, 0.0);
    }
    float bendOn = uRingAmt.z * smoothstep(0.0, ${num(glassLook.bend.soft)}, bendAt) * limb * (1.0 - smoothstep(${num(Math.cos(glassLook.bend.bubbleDeg[1] * RAD))}, ${num(Math.cos(glassLook.bend.bubbleDeg[0] * RAD))}, dot(n, uBubbleAt)));
    lit += bent * (keep * bendOn * (1.0 - ${num(glassLook.bend.dark)} * bendAt) / ${num(glassLook.bend.taps)});
    keep *= 1.0 - bendOn;
  }
  float footPer = length(footSlope);
  float footU = 1.0 - above / ${num(glassLook.seat.mirrorMm)};
  if (uBehindSize.x > 0.0 && uLens.z > 0.5 && above > 0.0 && footU > 0.0 && footPer > 1e-6) {
    vec3 foot = vec3(0.0);
    for (int i = 0; i < ${glassLook.seat.mirrorTaps}; i++) {
      float uj = clamp(footU - ((float(i) + 0.5) / ${num(glassLook.seat.mirrorTaps)} - 0.5) * footPer / ${num(glassLook.seat.mirrorMm)}, 0.0, 1.0);
      vec3 tap = textureLod(uBehind, (gl_FragCoord.xy + footSlope * ((${num(glassLook.seat.mirrorSpanMm)} * uj + ${num(glassLook.seat.mirrorMm)} * footU) / (footPer * footPer))) / uBehindSize, 0.0).rgb;
      if (any(isnan(tap)) || any(isinf(tap))) tap = vec3(0.0);
      foot += max(tap, 0.0);
    }
    lit += min(foot / ${num(glassLook.seat.mirrorTaps)}, vec3(${num(glassLook.seat.mirrorCap)})) * (${num(glassLook.seat.mirror)} * 6.75 * footU * (1.0 - footU) * (1.0 - footU) * footLimb * limb * (1.0 - ${num(glassLook.seat.lineDepth)} * line));
  }
  gl_FragColor = vec4(lit, keep);
#endif
}`

const RING_VERT = `
vEye = (uGlobeInv * vec4(cameraPosition, 1.0)).xyz;
vec3 ringEye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
float ringFar = length(ringEye);
vec3 ringAxis = ringEye / ringFar;
vec3 ringSide = normalize(cross(abs(ringAxis.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), ringAxis));
vec3 ringUp = cross(ringAxis, ringSide);
float ringTheta = acos(clamp(${num(lensRadiusMm)} / ringFar, 0.0, 1.0)) - (1.0 - position.z) * ${num(glassLook.ring.spanDeg * RAD)};
float ringOut = ${num(lensRadiusMm)} * (position.z > 0.999 ? ${num(glassLook.ring.reach)} : 1.0);
vec4 ringWorld = modelMatrix * vec4(ringOut * (sin(ringTheta) * (position.x * ringSide + position.y * ringUp) + cos(ringTheta) * ringAxis), 1.0);
vec4 ringView = viewMatrix * ringWorld;
gl_Position = projectionMatrix * ringView;
vStageWorld = ringWorld.xyz;
vStageLocal = (uGlobeInv * ringWorld).xyz;
vStageAux = vec3(0.0, -ringView.z, length(ringView.xyz));
vStagePlaced = ringWorld.xyz;`

const BUBBLE = `
${GLASS_GLSL}
varying vec3 vBubbleNormal;
varying vec3 vBubblePlaced;
varying vec3 vBubbleShape;
varying vec3 vBubbleRadial;
void main() {
  if (stageOutside()) discard;
  vec3 nb = normalize(vBubbleNormal);
  vec3 radial = normalize(vBubbleRadial);
  float x = vBubbleShape.x;
  float cap = vBubbleShape.y;
  float front = 0.5 + 0.5 * dot(radial, normalize(vec3(vEye.x, 0.0, vEye.z)));
  float side = pow(max(dot(uTurn * radial, ${vec(unit(glassLook.bubble.streakDir))}), 0.0), ${num(glassLook.bubble.streakPower)});
  float swirl = glassNoise(radial * 2.6 + vec3(0.0, x * 5.0, 3.0));
  float fine = glassNoise(vStageLocal * 2.3 + 5.0);
  float wide = max(${num(glassLook.bubble.line)}, 0.75 * length(vec2(dFdx(x), dFdy(x))));
  float thin = ${num(glassLook.bubble.line)} / wide;
  float outerRing = exp(-pow((x - ${num(1 - glassLook.bubble.line * 2.2)}) / wide, 2.0)) * thin;
  float innerRing = exp(-pow((x - ${num(glassLook.bubble.patch)}) / (wide * 1.2), 2.0)) * cap * thin;
  float inPatch = cap * (1.0 - smoothstep(${num(glassLook.bubble.patch - 0.06)}, ${num(glassLook.bubble.patch + 0.02)}, x));
  float between = (1.0 - inPatch) * (1.0 - smoothstep(0.84, 0.97, x));
  float lip = cap * front * front * smoothstep(${num(glassLook.bubble.patch - 0.04)}, ${num(glassLook.bubble.patch + 0.01)}, x) * (1.0 - smoothstep(${num(glassLook.bubble.patch + 0.03)}, ${num(glassLook.bubble.patch + 0.09)}, x));
  float spark = smoothstep(0.66, 0.78, glassNoise(radial * 14.0 + 4.0));
  vec3 pale = uSky * ${num(glassLook.bubble.sky)} + stageGrid(vStageLocal) * ${num(glassLook.bubble.inner)};
  vec3 warm = stageGrid(vStageLocal * ${num(glassLook.bubble.reach)}) * ${num(glassLook.bubble.warm)};
  vec3 streak = uKeyCol * WIN_TINT * side;
  float glints = smoothstep(0.5, 0.7, glassNoise(radial * 9.0 + 1.0));
  vec3 col = outerRing * ${num(glassLook.bubble.outer)} * (pale * (0.25 + 0.45 * front) * (0.6 + 0.8 * fine) + warm * front * front + streak * ${num(glassLook.bubble.glint)} * smoothstep(0.3, 0.75, swirl));
  col += innerRing * (pale * (0.5 + 0.3 * front) + streak * ${num(glassLook.bubble.glint * 0.8)} + warm * 2.0 * front * front * glints);
  col += inPatch * (uSky * ${vec(glassLook.bubble.fill)} * ${num(glassLook.bubble.patchFill)} * (0.8 + 0.4 * fine) + streak * ${num(glassLook.bubble.patchGain)} * (0.6 + 0.4 * swirl));
  col += between * (uSky * ${num(glassLook.bubble.milk * 0.2)} + streak * ${num(glassLook.bubble.swirl)} * smoothstep(0.42, 0.8, swirl) * smoothstep(${num(glassLook.bubble.patch)}, 0.9, x));
  col += lip * spark * uKeyCol * ${vec(glassLook.bubble.sparkTint)} * ${num(glassLook.bubble.spark)};
  col += uKeyCol * ${vec(glassLook.bubble.underTint)} * (${num(glassLook.bubble.under)} * exp(-pow((x - ${num(1 - glassLook.bubble.line * 0.5)}) / (wide * 0.8), 2.0)) * thin * front * front * (0.6 + 0.8 * fine));
  float alpha = (1.0 - ${num(glassLook.bubble.lip)} * lip) * (1.0 - ${num(glassLook.bubble.shade)} * inPatch) * (1.0 - ${num(glassLook.bubble.edge)} * outerRing * (1.0 - 0.5 * front)) * (1.0 - ${num(glassLook.bubble.edge)} * innerRing * front);
  gl_FragColor = vec4(col, alpha);
  if (uDiag != 0) gl_FragColor = vec4(stageDiag(vec3(1.0), nb, 0.0, 0.0, 0.0).rgb, 0.0);
}`

const eyeChunk = { pars: 'varying vec3 vEye;', main: 'vEye = (uGlobeInv * vec4(cameraPosition, 1.0)).xyz;' }

export const shellUniforms = {
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyCol: { value: new THREE.Color() },
  uRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uRimCol: { value: new THREE.Color() },
  uBloom: { value: new THREE.Color() },
  uOverlay: { value: [new THREE.Vector3(), new THREE.Vector3()] },
  uOverlayOn: { value: new THREE.Vector2(1, 1) },
  uTurn: { value: new THREE.Matrix3() },
  uGlobeAt: { value: new THREE.Vector3() },
  uSky: { value: new THREE.Color() },
  uGround: { value: new THREE.Color() },
  uBase: { value: new THREE.Color() },
  uPool: { value: new THREE.Color() },
  uSlab: surfaceUniforms.uSlab,
  uOwn: { value: 1 },
  uBehind: { value: null as THREE.Texture | null },
  uBehindSize: { value: new THREE.Vector2(0, 0) },
  uBubbleAt: { value: new THREE.Vector3(0, 1, 0) },
  uWinTint: { value: new THREE.Vector3(...WINTER_GLASS.windowTint) },
  uWinGain: { value: new THREE.Vector4(1, 1, 1, 1) },
  uWinSoft: { value: new THREE.Vector3(0, 0, 1) },
  uRimTint: { value: new THREE.Vector3(1, 1, 1) },
  uWallTint: { value: new THREE.Vector3(1, 1, 1) },
  uRingAmt: { value: new THREE.Vector4(1, 1, 1, 0) },
  uRimAmt: { value: new THREE.Vector4(1, 1, 1, 1) },
  uRoomHue: { value: new THREE.Vector4(1, 1, 1, 0) },
  uRimGlow: { value: 1 },
  uArc: { value: new THREE.Vector4(0, 0, 0, 0) },
}

const blend: THREE.ShaderMaterialParameters = {
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.SrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
}

const behind = new Map<string, THREE.FramebufferTexture>()

function copyBehind(renderer: THREE.WebGLRenderer, material: THREE.Material): void {
  const target = renderer.getRenderTarget()
  const u = shellUniforms
  ;(material as THREE.ShaderMaterial).uniformsNeedUpdate = true
  if (!target || stageUniforms.uDiag.value !== 0) {
    u.uBehindSize.value.set(0, 0)
    return
  }
  if (target.samples > 0) {
    const resolved = resolveBehind(renderer, target, 'shell')
    if (resolved) u.uBehind.value = resolved
    u.uBehindSize.value.set(resolved ? target.width : 0, resolved ? target.height : 0)
    return
  }
  const type = target.texture.type
  const key = `${target.width} ${target.height} ${type}`
  let copy = behind.get(key)
  if (!copy) {
    if (behind.size >= 4) {
      for (const old of behind.values()) old.dispose()
      behind.clear()
    }
    copy = new THREE.FramebufferTexture(target.width, target.height)
    copy.type = type
    copy.magFilter = THREE.LinearFilter
    copy.minFilter = THREE.LinearFilter
    copy.colorSpace = THREE.NoColorSpace
    behind.set(key, copy)
  }
  renderer.copyFramebufferToTexture(copy)
  u.uBehind.value = copy
  u.uBehindSize.value.set(target.width, target.height)
}

function bubbleGeometry(): THREE.BufferGeometry {
  const B = glassLook.bubble
  const a = B.widthMm / 2
  const wall = innerRadiusMm - B.gapMm
  const sag = (rho: number) => wall - Math.sqrt(wall * wall - rho * rho)
  const patch = a * B.patch
  const waist = -B.depthMm * B.waist
  const profile: [number, number][] = []
  const cap = 10
  const shoulder = 12
  const under = 22
  for (let i = 0; i <= cap; i++) {
    const rho = (patch * i) / cap
    profile.push([rho, -sag(rho)])
  }
  const y0 = -sag(patch)
  for (let i = 1; i <= shoulder; i++) {
    const t = (i / shoulder) * (Math.PI / 2)
    profile.push([patch + (a - patch) * Math.sin(t), y0 - (y0 - waist) * (1 - Math.cos(t))])
  }
  for (let i = 1; i <= under; i++) {
    const t = (i / under) * (Math.PI / 2)
    const k = 2 / B.flat
    profile.push([a * Math.pow(Math.cos(t), k), waist - (B.depthMm + waist) * Math.pow(Math.sin(t), k)])
  }
  const around = 56
  const rows = profile.length
  const position = new Float32Array(rows * (around + 1) * 3)
  const shape = new Float32Array(rows * (around + 1) * 3)
  const index: number[] = []
  for (let j = 0; j < rows; j++) {
    const [rho, y] = profile[j]!
    for (let i = 0; i <= around; i++) {
      const phi = (i / around) * Math.PI * 2
      const o = (j * (around + 1) + i) * 3
      position[o] = rho * Math.cos(phi)
      position[o + 1] = y
      position[o + 2] = rho * Math.sin(phi)
      shape[o] = rho / a
      shape[o + 1] = j <= cap + 2 ? 1 : 0
      shape[o + 2] = phi
    }
  }
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < around; i++) {
      const p = j * (around + 1) + i
      const q = p + around + 1
      index.push(p, p + 1, q, p + 1, q + 1, q)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aShape', new THREE.BufferAttribute(shape, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

function ringGeometry(): THREE.BufferGeometry {
  const around = glassLook.ring.around
  const rows = glassLook.ring.rows
  const position = new Float32Array((rows + 1) * (around + 1) * 3)
  const index: number[] = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= around; i++) {
      const phi = (i / around) * Math.PI * 2
      const o = (j * (around + 1) + i) * 3
      position[o] = Math.cos(phi)
      position[o + 1] = Math.sin(phi)
      position[o + 2] = j / rows
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < around; i++) {
      const p = j * (around + 1) + i
      const q = p + around + 1
      index.push(p, p + 1, q, p + 1, q + 1, q)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setIndex(index)
  return g
}

export class Shell {
  readonly through: THREE.Mesh
  readonly shell: THREE.Mesh
  readonly ring: THREE.Mesh
  readonly bubble: THREE.Mesh
  readonly stamp: THREE.Mesh
  readonly bubbleRadius = glassLook.bubble.widthMm / 2
  private readonly turn = new THREE.Matrix4()
  private readonly euler = new THREE.Euler()
  private readonly up = new THREE.Vector3()
  private readonly slosh = new THREE.Vector3()
  private readonly lean = new THREE.Quaternion()
  private readonly spin = new THREE.Quaternion()
  private readonly yAxis = new THREE.Vector3(0, 1, 0)
  private readonly front = new THREE.Vector3()
  private wobble = 0
  private phase = 0
  private phaseB = 0

  constructor() {
    const sphere = new THREE.SphereGeometry(lensRadiusMm, 128, 64)
    const uniforms = { ...roomUniforms, ...shellUniforms }
    this.through = new THREE.Mesh(sphere, stageShader({ part: 'liquid', standIn: false, uniforms, vertexPars: eyeChunk.pars, vertexMain: eyeChunk.main, fragment: THROUGH, params: { ...blend } }))
    this.through.renderOrder = -0.5
    this.shell = new THREE.Mesh(sphere, stageShader({ part: 'glass', standIn: false, uniforms, vertexPars: eyeChunk.pars, vertexMain: eyeChunk.main, fragment: SHELL, params: { ...blend, transparent: true } }))
    this.shell.renderOrder = 10
    this.shell.onBeforeRender = (renderer, _scene, _camera, _geometry, material) => copyBehind(renderer, material)
    this.ring = new THREE.Mesh(ringGeometry(), stageShader({ part: 'glass', standIn: false, uniforms, vertexPars: eyeChunk.pars, vertexMain: RING_VERT, fragment: `#define GLASS_RING 1\n${SHELL}`, params: { ...blend, transparent: true, side: THREE.DoubleSide, forceSinglePass: true } }))
    this.ring.renderOrder = 12
    this.ring.frustumCulled = false
    this.shell.add(this.ring)
    this.bubble = new THREE.Mesh(
      bubbleGeometry(),
      stageShader({
        part: 'liquid',
        standIn: false,
        inside: true,
        uniforms,
        vertexPars: `${eyeChunk.pars}\nattribute vec3 aShape;\nvarying vec3 vBubbleNormal;\nvarying vec3 vBubblePlaced;\nvarying vec3 vBubbleShape;\nvarying vec3 vBubbleRadial;`,
        vertexMain: `${eyeChunk.main}\nvBubbleNormal = mat3(uGlobeInv) * (mat3(modelMatrix) * normal);\nvBubblePlaced = (uGlobeInv * vec4(vStagePlaced, 1.0)).xyz;\nvBubbleShape = aShape;\nvBubbleRadial = mat3(uGlobeInv) * (mat3(modelMatrix) * vec3(cos(aShape.z), 0.0, sin(aShape.z)));`,
        fragment: BUBBLE,
        params: { ...blend, side: THREE.DoubleSide },
      }),
    )
    this.bubble.renderOrder = 4
    this.bubble.frustumCulled = false
    this.stamp = new THREE.Mesh(new THREE.SphereGeometry(lensRadiusMm, 64, 34), stageShader({ part: 'glass', standIn: false, fragment: 'void main() { gl_FragColor = vec4(0.0); }', params: { colorWrite: false } }))
    this.stamp.scale.setScalar(0.998)
    this.stamp.renderOrder = 6
  }

  update(f: StageFrame): void {
    const sh = shellUniforms
    const a = f.from
    const b = f.to
    const t = f.mix.base
    sh.uKeyDir.value.copy(f.keyDir)
    sh.uKeyCol.value.copy(f.keyCol)
    sh.uRimDir.value.copy(f.rimDir)
    sh.uRimCol.value.copy(f.rimCol)
    const room = glassLook.room
    const ra = a.backdrop.room
    const rb = b.backdrop.room
    const hue = [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t]
    const top = Math.max(hue[0]!, hue[1]!, hue[2]!, 1e-6)
    const sky = (0.2126 * f.ambient.r + 0.7152 * f.ambient.g + 0.0722 * f.ambient.b) * room.level
    const ground = (0.2126 * f.ground.r + 0.7152 * f.ground.g + 0.0722 * f.ground.b) * f.fill * room.level
    sh.uSky.value.setRGB((hue[0]! / top) * sky * room.tint[0], (hue[1]! / top) * sky * room.tint[1], (hue[2]! / top) * sky * room.tint[2])
    sh.uGround.value.setRGB((hue[0]! / top) * ground * room.tint[0], (hue[1]! / top) * ground * room.tint[1], (hue[2]! / top) * ground * room.tint[2])
    sh.uBase.value.setRGB(a.main[0] + (b.main[0] - a.main[0]) * t, a.main[1] + (b.main[1] - a.main[1]) * t, a.main[2] + (b.main[2] - a.main[2]) * t)
    sh.uPool.value.copy(f.pool)
    sh.uOwn.value = glassLook.ownSources ? 1 : 0
    sh.uTurn.value.setFromMatrix4(this.turn.makeRotationFromEuler(this.euler.set(f.globe.tiltX, 0, f.globe.tiltZ)))
    sh.uGlobeAt.value.set(f.globe.x, f.globe.y, f.globe.z)
    sh.uBloom.value.copy(f.bloomTint).multiplyScalar(glassLook.bloom.gain)
    const ga = glassOf(a.season)
    const gb = glassOf(b.season)
    const mixed = (x: number, y: number) => x + (y - x) * t
    sh.uWinTint.value.set(mixed(ga.windowTint[0], gb.windowTint[0]), mixed(ga.windowTint[1], gb.windowTint[1]), mixed(ga.windowTint[2], gb.windowTint[2]))
    sh.uWinGain.value.set(mixed(ga.windowGain[0], gb.windowGain[0]), mixed(ga.windowGain[1], gb.windowGain[1]), mixed(ga.windowGain[2], gb.windowGain[2]), mixed(ga.windowGain[3], gb.windowGain[3]))
    sh.uWinSoft.value.set(mixed(ga.windowSoftDeg, gb.windowSoftDeg) * RAD, mixed(ga.windowGrain, gb.windowGrain), mixed(ga.windowShade, gb.windowShade))
    sh.uRimGlow.value = mixed(ga.rimGlow, gb.rimGlow)
    sh.uArc.value.set(mixed(ga.arcs * ga.arcTint[0], gb.arcs * gb.arcTint[0]), mixed(ga.arcs * ga.arcTint[1], gb.arcs * gb.arcTint[1]), mixed(ga.arcs * ga.arcTint[2], gb.arcs * gb.arcTint[2]), mixed(ga.arcs * ga.arcCool, gb.arcs * gb.arcCool))
    sh.uRimTint.value.set(mixed(ga.rimTint[0], gb.rimTint[0]), mixed(ga.rimTint[1], gb.rimTint[1]), mixed(ga.rimTint[2], gb.rimTint[2]))
    sh.uWallTint.value.set(mixed(ga.wallTint[0], gb.wallTint[0]), mixed(ga.wallTint[1], gb.wallTint[1]), mixed(ga.wallTint[2], gb.wallTint[2]))
    sh.uRingAmt.value.set(mixed(ga.ringCover, gb.ringCover), mixed(ga.strip, gb.strip), mixed(ga.bend, gb.bend), mixed(ga.ringThin, gb.ringThin))
    sh.uRimAmt.value.set(mixed(ga.rimClear, gb.rimClear), mixed(ga.topLine, gb.topLine), mixed(ga.ringMottle, gb.ringMottle), mixed(ga.ceiling, gb.ceiling))
    sh.uRoomHue.value.set(mixed(ga.roomHue[0], gb.roomHue[0]), mixed(ga.roomHue[1], gb.roomHue[1]), mixed(ga.roomHue[2], gb.roomHue[2]), mixed(ga.roomHueOn, gb.roomHueOn))
    const shown = t < 0.5 ? a : b
    const veiled = f.mix.veil < 0.5 ? a : b
    const veil = `veil-${veiled.season}`
    ;[partBytes('glass'), partBytes(veil)].forEach((c, i) => sh.uOverlay.value[i]!.set(c[0] / 255, c[1] / 255, c[2] / 255))
    const flagged = f.view === 'standins'
    sh.uOverlayOn.value.set(flagged ? 0 : 1, flagged ? 0 : 1)

    const L = f.liquid
    const has = L.length > LIQUID_BUBBLE + 1
    const bx = has ? L[LIQUID_BUBBLE]! : 0
    const bz = has ? L[LIQUID_BUBBLE + 1]! : 0
    const tilted = f.globeUp.x * f.globeUp.x + f.globeUp.z * f.globeUp.z > 1e-8
    if (has && (bx !== 0 || bz !== 0 || !tilted)) this.up.set(bx, Math.sqrt(Math.max(1 - bx * bx - bz * bz, 0)), bz)
    else this.up.copy(f.globeUp)
    this.slosh.set(L[LIQUID_SLOSH] ?? 0, L[LIQUID_SLOSH + 1] ?? 0, L[LIQUID_SLOSH + 2] ?? 0)
    this.wobble = Math.min(1, (L[LIQUID_TURBULENCE] ?? 0) / TURBULENCE_MAX + this.slosh.length() / 400)
    this.phase = L[LIQUID_PHASE] ?? 0
    this.phaseB = L[LIQUID_PHASE_B] ?? 0
    this.placeBubble(this.up, this.slosh)

    const on = f.view !== 'flow' && f.view !== 'lightgrid'
    this.through.visible = on
    this.shell.visible = on
    // The bubble is one season's: it goes and comes with the glass dressing, inside the swap window, where the storm hides the glass.
    this.bubble.visible = on && glassLook.bubble.seasons.includes(shown.season)
    this.stamp.visible = on
  }

  placeBubble(up: THREE.Vector3, slosh: THREE.Vector3): void {
    const B = glassLook.bubble
    const d = up.clone().addScaledVector(slosh, -B.slide)
    if (d.lengthSq() < 1e-9) d.set(0, 1, 0)
    d.normalize()
    const front = this.front.set(0, 0, 1).addScaledVector(d, -d.z)
    if (front.lengthSq() > 1e-9) d.multiplyScalar(Math.cos(B.leanDeg * RAD)).addScaledVector(front.normalize(), Math.sin(B.leanDeg * RAD))
    const w = this.wobble * B.wobble
    const p = this.phase
    const q = this.phaseB
    this.bubble.position.copy(d).multiplyScalar(innerRadiusMm - B.gapMm)
    shellUniforms.uBubbleAt.value.copy(d)
    this.bubble.quaternion.copy(this.lean.setFromUnitVectors(this.yAxis, d)).multiply(this.spin.setFromAxisAngle(this.yAxis, 3 * q))
    this.bubble.scale.set(1 + w * Math.cos(5 * p), 1 + 1.6 * w * Math.sin(4 * q + 1.3), 1 - w * Math.cos(5 * p) + 0.5 * w * Math.sin(7 * q))
  }
}
