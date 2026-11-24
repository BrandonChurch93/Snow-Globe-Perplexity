import * as THREE from 'three'
import { config } from '../config'
import { stageShader } from '../core/materials'
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
    edgeDeg: { outer: 0.45, inner: 1.8, innerMain: 1.3, tipInner: 0.8, end: 1.1, tail: 4, cut: 2, wobble: 0.9, wobbleRate: 12 },
    gap: { wideDeg: [6, 13] as const, tint: [0.9, 0.89, 0.8] as V3, gain: 0.9, mid: [0.22, 0.36, 0.55] as const, top: [0.46, 0.6] as const, low: [-0.24, -0.06] as const },
    halo: { wideDeg: [2.5, 5] as const, tint: [0.4, 0.75, 1] as V3, gain: 0.24 },
    tip: { flatDeg: [6, 10.5] as const, fadeDeg: [8.5, 14] as const, tint: [0.4, 0.55, 0.75] as V3, slant: 0.35, slantFromDeg: -3.5, tailDeg: [-16, -13.5] as const, tailSlope: 0, tailFromDeg: -18, tailCurve: 0.037, tailLevel: 0.08 },
    dark: { atDeg: [13.6, -8.7] as const, axis: [0.803, -0.595] as const, sideDeg: [-1.5, 1.5, 11, 17] as const, inDeg: [-17, -11] as const, depth: 0.95, shade: 0.3, share: [0.935, 0.965] as const, glow: [0.0018, 0.019, 0.021] as V3 },
    orders: [
      { alongDeg: [-44, 15.5], acrossDeg: [-3.8, 14.6], outFrom: 2, outSlope: -0.5, inFrom: 8.5, inSlope: 1.9, outer: 1, inner: 0.078, power: 4, cutDeg: -90, cutSlant: 0, tail: 1, tint: [2.5, 1.83, 1.35] as V3, base: [1, 1, 1] as V3, core: [0, 0, 0] as V3, fallDeg: [80, 90, 80, 90] as const, fallTo: 1 },
      { alongDeg: [-22.5, 2.7], acrossDeg: [-2.4, 15.4], outFrom: -9, outSlope: -0.35, inFrom: 0.2, inSlope: 2.9, outer: 1, inner: 0.235, power: 3.7, cutDeg: -12.7, cutSlant: 0.16, tail: 0.004, tint: [1, 1, 1] as V3, base: [0.9, 0.98, 0.93] as V3, core: [3.2, 2, 1.2] as V3, fallDeg: [-9.5, -4, -7, -2] as const, fallTo: 0.46 },
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
  floor: 0.4,
  band: { from: 0.976, to: 0.99, wander: 0.004, dim: 0.5, shade: 0.3, side: [-0.2, 0.5] as const, low: [-0.5, -0.1] as const },
  edge: { from: 0.978, peak: 0.994, keyLobe: [0.84, 0.97] as const, key: 0.5, keyTint: [0.75, 0.76, 0.585] as V3, tip: 0.33, tipTint: [0.6, 0.78, 1] as V3, tipDeg: [4.3, 2.5, 1.3] as const, tipShare: [0.975, 0.997] as const, rimLobe: [0.16, 0.5] as const, rim: 0.04, sky: 0.04, pool: 0 },
  body: { from: 0.962, to: 0.978, sky: 0.04, tint: [1.8, 1.2, 0.4] as V3 },
  rim: { from: 0.96, to: 0.967, clear: 0.65, tint: [0.9, 1, 1.08] as V3, high: 0.085, low: 0.28, line: 0.9655, lineWide: 0.0022, lineGain: 0.25, highTint: [0.9, 1.05, 1] as V3, streak: 0.6, outer: 0.9905, outerWide: 0.004, outerGain: 0.16 },
  wall: { from: [0.896, 0.926] as const, to: [0.966, 0.976] as const, crest: 0.9635, crestWide: 0.013, plate: 0.14, peak: 0.3, inTint: [1.15, 0.97, 0.8] as V3, tint: [1, 1, 0.83] as V3, lowY: [0.02, -0.22] as const, leftDrop: 0.1, lowTo: 0.012, grain: 0.5, speck: 0.5, spark: 1.2, wander: 0.006, mirror: 0.5, mirrorTo: 0.93, leftTo: 0.016 },
  ring: { from: 0.9625, to: 0.9675, soft: 0.008, spanDeg: 21, around: 96, rows: 3, side: [0.5, 0.2] as const, low: [-0.22, -0.08] as const, wallSide: [0.1, -0.5] as const, keep: 0.3, cover: 0.75, wall: [0.17, 0.19, 0.165] as V3, grain: 0.5, speck: 0.4, edge: [0.985, 0.991] as const, line: [0.26, 0.3, 0.25] as V3, lineTop: [0.11, 0.2, 0.25] as V3, lineMix: 0.9, lowMix: 1, lowLine: [0.67, 0.69, 0.55] as V3, lowAt: [0.992, 0.997] as const, lowEnd: [-0.8, -0.72] as const, night: [0.014, 0.0255, 0.026] as V3, reach: 1.002, lowFrom: 0.99, lowTo: 0.996, mirror: { from: 0.955, lowFrom: 0.972, wide: 0.022, side: [-0.34, -0.2, -0.06] as const, coverHigh: 0.2, gain: 1.6, cover: 0.55, steps: 10, solid: [0.35, 0.62] as const, snow: [0.2, 0.22] as const, warm: 0.5, air: 0.6, streak: 0.7, streakRings: 420 } },
  wave: { rings: 46, ringDeg: 0.3, driftDeg: 0.35, inner: 1.9 },
  dust: { cells: 240, share: 0.085, depth: 0.42 },
  hair: { count: 7, widthMm: 0.035, depth: 0.32, bend: 0.012 },
  seat: { lineMm: 1.3, shadeMm: 8, gain: 1.5 },
  through: { disc: 0.0009, point: 3, pointGain: 2.5, wall: [0.94, 0.975, 0.985] as V3, mirror: 0.06, steps: 5, own: 0.12, window: 0.018, softDeg: 3, lift: [0.056, 0.012, 2.5] as const, liftTint: [0.9, 1.25, 1] as V3, arcs: 0.4, arcRings: 13 },
  bubble: { widthMm: 20.5, depthMm: 5.6, gapMm: 0.12, patch: 0.46, waist: 0.5, flat: 2.7, leanDeg: 16, slide: 0.0025, wobble: 0.09, line: 0.015, sky: 0.2, inner: 0.08, glint: 0.5, milk: 0.05, patchFill: 0.15, fill: [1.6, 1.25, 0.85] as V3, shade: 0.12, edge: 0.5, warm: 1, reach: 0.35, patchGain: 0.1, swirl: 0.12, streakDir: [-0.9, 0, 0.35] as V3, streakPower: 2.5, lip: 0.6, spark: 2.5, sparkTint: [1, 0.92, 0.75] as V3 },
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
varying vec3 vEye;
const float GLASS_IOR = ${num(G.glassIor)};
const float SEAT_Y = ${num(collarY)};
const float SEAT_R = ${num(seatRadiusMm)};
const float BASE_R = ${num(baseRadiusMm)};
const float CENTRE_Y = ${num(centreHeightMm)};
const vec3 WIN_C = ${vec(unit(W.centre))};
const vec3 WIN_A = ${vec(unit(W.along))};
const vec3 WIN_B = ${vec(unit(W.across))};
const vec3 WIN_TINT = ${vec(W.tint.map((x) => x * W.level))};
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
float glassLimb(float s) {
  return 1.0 - smoothstep(1.0 - max(1.5 * fwidth(s), 1e-4), 1.0, s);
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
  float inner = span.w - cut.w * max(q.x - cut.z, 0.0);
  float eo = ${num(W.edgeDeg.outer * RAD)} + soft;
  float ei = (k == 1 ? ${num(W.edgeDeg.innerMain * RAD)} : mix(${num(W.edgeDeg.inner * RAD)}, ${num(W.edgeDeg.tipInner * RAD)}, first * smoothstep(${num(W.tip.flatDeg[0] * RAD)}, ${num(W.tip.flatDeg[1] * RAD)}, q.x))) + soft;
  float ee = ${num(W.edgeDeg.end * RAD)} + soft;
  float et = mix(ee, ${num(W.edgeDeg.tail * RAD)} + soft, first);
  float reach = q.x + first * ${num(W.tip.slant)} * max(${num(W.tip.slantFromDeg * RAD)} - q.y, 0.0);
  float m = smoothstep(-eo, eo, (q.y - outer) * inversesqrt(1.0 + cut.y * cut.y)) * smoothstep(-ei, ei, (inner - q.y) * inversesqrt(1.0 + cut.w * cut.w));
  m *= smoothstep(-et, et, q.x - span.x) * smoothstep(-ee, ee, span.y - reach) * smoothstep(0.0, eo + ei, inner - outer);
  vec3 ending = WIN_END[k];
  m *= mix(ending.z, 1.0, smoothstep(${num(-W.edgeDeg.cut * RAD)}, ${num(W.edgeDeg.cut * RAD)}, q.x - ending.x + ending.y * (q.y - outer)));
  if (m <= 0.0) return vec3(0.0);
  float u = clamp((q.y - outer) / max(inner - outer, 1e-3), 0.0, 1.0);
  float tail = 1.0 - smoothstep(${num(W.tip.tailDeg[0] * RAD)}, ${num(W.tip.tailDeg[1] * RAD)}, q.x);
  float top = mix(level.x, level.y, first * max(smoothstep(${num(W.tip.flatDeg[0] * RAD)}, ${num(W.tip.flatDeg[1] * RAD)}, q.x), tail));
  m *= (1.0 - ${num(1 - W.tip.tailLevel)} * first * tail) * mix(1.0, WIN_FLOOR[k], smoothstep(WIN_FALL[k].z, WIN_FALL[k].w, q.x));
  vec3 fade = WIN_HUE[k] * mix(vec3(1.0), ${vec(W.tip.tint)}, first * smoothstep(${num(W.tip.fadeDeg[0] * RAD)}, ${num(W.tip.fadeDeg[1] * RAD)}, reach));
  vec3 core = vec3(1.0) + WIN_CORE[k] * (1.0 - smoothstep(WIN_FALL[k].x, WIN_FALL[k].y, q.x));
  return fade * (level.y * WIN_BASE[k] + (top - level.y) * pow(1.0 - u, level.z) * core) * (m * (0.9 + 0.1 * glassNoise(vec3(q * 22.0, 3.0))));
}
float glassHalo(vec3 d) {
  float z = dot(d, WIN_C);
  if (z < 0.2) return 0.0;
  vec2 q = vec2(atan(dot(d, WIN_A), z), atan(dot(d, WIN_B), z));
  vec4 span = WIN_SPAN[0];
  vec4 cut = WIN_CUT[0];
  float outer = span.z + cut.y * max(q.x - cut.x, 0.0) + glassTail(q.x);
  float inner = span.w - cut.w * max(q.x - cut.z, 0.0);
  vec2 away = vec2(max(max(span.x - q.x, q.x - span.y), 0.0), max(max(outer - q.y, q.y - inner), 0.0)) / ${vec(W.halo.wideDeg.map((x) => x * RAD))};
  return exp(-0.5 * dot(away, away));
}
float glassGap(vec3 d) {
  float z = dot(d, WIN_C);
  if (z < 0.2) return 0.0;
  vec2 q = vec2(atan(dot(d, WIN_A), z), atan(dot(d, WIN_B), z));
  vec4 span = WIN_SPAN[0];
  vec4 cut = WIN_CUT[0];
  float inner = span.w - cut.w * max(q.x - cut.z, 0.0);
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
vec3 glassRoom(vec3 d, float soft, int k, float own) {
  vec3 c = stageRoomSeen(d, k == 3 ? ${num(glassLook.room.throughRough)} : ${num(glassLook.room.innerRough)});
  c += soft < 0.0 ? glassPoints(d) : stageRoomLights(d, ${num(glassLook.through.disc)} + soft * 0.05);
  if (uOwn < 0.5) return c;
  soft = max(soft, 0.0);
  float side = mix(${num(glassLook.room.side)}, 1.0, smoothstep(-0.35, 0.85, dot(d, WIN_C)));
  float blotch = 1.0 - ${num(glassLook.room.blotch)} * glassNoise(d * 2.7 + 13.0);
  vec3 dim = mix(uGround, uSky, smoothstep(-0.3, 0.45, d.y)) * ${num(glassLook.room.gain)} * own * side * blotch * smoothstep(-0.8, 0.2, d.z);
  float up = dot(d, ${vec(unit(glassLook.ceiling.dir))});
  float streak = 1.0 - ${num(glassLook.ceiling.depth)} * (0.5 + 0.5 * sin(up * ${num(glassLook.ceiling.rings)} + 6.0 * glassNoise(d * 2.3 + 29.0)));
  if (k != 3) dim += uSky * ${vec(glassLook.ceiling.tint)} * ${num(glassLook.ceiling.gain)} * own * blotch * streak * smoothstep(${num(glassLook.ceiling.edge[0])}, ${num(glassLook.ceiling.edge[1])}, up) * smoothstep(${num(glassLook.ceiling.low[0])}, ${num(glassLook.ceiling.low[1])}, d.y);
  float rim = max(dot(d, uRimDir), 0.0);
  dim += uRimCol * ${vec(glassLook.rimCard.tint)} * own * (${num(glassLook.rimCard.wide)} * pow(rim, ${num(glassLook.rimCard.widePower)}) + ${num(glassLook.rimCard.core)} * pow(rim, ${num(glassLook.rimCard.corePower)}));
  float lit = k == 0 ? 1.0 - ${num(W.dark.depth)} * glassDark(d) : 1.0;
  c += dim * lit;
  c += uKeyCol * WIN_TINT * WIN_GAIN[k] * glassWindow(d, k == 3 ? ${num(glassLook.through.softDeg * RAD)} : soft, k);
  if (k == 0) c += uKeyCol * WIN_TINT * ${vec(W.halo.tint)} * ${num(W.halo.gain)} * glassHalo(d) * lit;
  c += ${vec(glassLook.strip.tint)} * uKeyCol.b * STRIP_GAIN[k] * glassStrip(d, soft);
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
uniform vec4 uDress;
uniform vec3 uBloom;
uniform vec3 uOverlay[3];
uniform vec3 uOverlayOn;
${GLASS_GLSL}
void main() {
#ifdef GLASS_RING
  if (uDiag != 0) discard;
#endif
  if (uDiag != 0) {
    if (uDiag != ${viewCode('ids')} && uDiag != ${viewCode('standins')}) discard;
    vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
    if (cell.x == 0.0 && cell.y == 0.0 && uOverlayOn.x > 0.5) gl_FragColor = vec4(uOverlay[0], 0.0);
    else if (cell.x == 2.0 && cell.y == 0.0 && uOverlayOn.y > 0.5) gl_FragColor = vec4(uOverlay[1], 0.0);
    else if (cell.x == 0.0 && cell.y == 2.0 && uOverlayOn.z > 0.5) gl_FragColor = vec4(uOverlay[2], 0.0);
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
  if (uOwn > 0.5) col += uSky * mix(${vec(glassLook.rim.tint)}, ${vec(glassLook.rim.highTint)}, rimHigh) * (mix(${num(glassLook.rim.low)}, ${num(glassLook.rim.high)}, rimHigh) * rimZone * (0.75 + 0.5 * thick) * rimStreak + ${num(glassLook.rim.lineGain)} * rimLine * (0.3 + 0.7 * fine) * (1.0 - 0.7 * rimHigh) + ${num(glassLook.rim.outerGain)} * rimOuter * rimHigh);
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
    col += wallLow * (1.0 + ${num(glassLook.wall.grain)} * (grain - 0.5) + ${num(glassLook.wall.speck)} * (speck - 0.5) + ${num(glassLook.wall.spark)} * spark) * (uSky * hue * (${num(glassLook.wall.plate)} * plate + ${num(glassLook.wall.peak)} * crest) + mirrored * ${num(glassLook.wall.mirror)} * plate * (1.0 - smoothstep(${num(glassLook.wall.from[1])}, ${num(glassLook.wall.mirrorTo)}, s)));
  }
  col *= 1.0 - ${num(glassLook.band.dim)} * band;

  vec3 seen = uTurn * r1;
  float seenZ = dot(seen, WIN_C);
  float dark = uOwn > 0.5 ? glassDark(seen) : 0.0;
  float tipAt = seenZ > 0.2 ? atan(dot(seen, WIN_A), seenZ) - ${num(glassLook.edge.tipDeg[0] * RAD)} : 9.0;
  tipAt /= tipAt > 0.0 ? ${num(glassLook.edge.tipDeg[2] * RAD)} : ${num(glassLook.edge.tipDeg[1] * RAD)};
  float wallZone = smoothstep(${num(glassLook.body.from)}, ${num(glassLook.body.to)}, s);
  col += uKeyCol * WIN_TINT * ${vec(W.gap.tint)} * (${num(W.gap.gain)} * glassGap(seen) * f1 * marks * (1.0 - ${num(W.dark.depth)} * dark) * mix(1.0, ${num(W.gap.mid[2])}, smoothstep(${num(W.gap.mid[0])}, ${num(W.gap.mid[1])}, nWorld.y)) * (1.0 - smoothstep(${num(W.gap.top[0])}, ${num(W.gap.top[1])}, nWorld.y)) * (0.45 + 0.55 * smoothstep(${num(W.gap.low[0])}, ${num(W.gap.low[1])}, nWorld.y)) * uOwn);
  float deep = dark * smoothstep(${num(W.dark.share[0])}, ${num(W.dark.share[1])}, s);
  if (uOwn > 0.5) col += uSky * ${vec(glassLook.body.tint)} * ${num(glassLook.body.sky)} * wallZone * (0.6 + 0.4 * thick) * (1.0 - dark);
  col += uKeyCol * WIN_TINT * ${vec(W.dark.glow)} * deep * (0.7 + 0.6 * thick);
  col += uKeyCol * WIN_TINT * ${vec(glassLook.edge.tipTint)} * (${num(glassLook.edge.tip)} * exp(-0.5 * tipAt * tipAt) * uOwn * smoothstep(${num(glassLook.edge.tipShare[0])}, ${num(glassLook.edge.tipShare[1])}, s) * (0.6 + 0.4 * fine));

  vec3 piped = uKeyCol * WIN_TINT * ${vec(glassLook.edge.keyTint)} * ${num(glassLook.edge.key)} * lobe + uRimCol * ${num(glassLook.edge.rim)} * back;
  if (uOwn > 0.5) piped += uSky * ${num(glassLook.edge.sky)} * (0.4 + 0.6 * smoothstep(-0.7, 0.5, nWorld.y));
  piped += uPool * ${num(glassLook.edge.pool)} * smoothstep(-0.2, -0.75, n.y);
  float edge = smoothstep(${num(glassLook.edge.from)}, ${num(glassLook.edge.peak)}, s) * (0.35 + 0.65 * thick) * (0.7 + 0.3 * fine);
  col += piped * edge;

  float lift = p.y - SEAT_Y;
  float shade = 1.0 - smoothstep(0.0, ${num(glassLook.seat.shadeMm)}, lift);
  float line = 1.0 - smoothstep(${num(glassLook.seat.lineMm * 0.25)}, ${num(glassLook.seat.lineMm)}, lift);
  float low = smoothstep(${num(glassLook.seat.shadeMm * 2.5)}, 0.0, lift);
  col *= 1.0 + (${num(glassLook.seat.gain)} - 1.0) * low * step(0.0, -r1.y);
  float seat = (1.0 - 0.55 * shade * shade) * (1.0 - 0.8 * line);
  col *= seat;

  col = min(col, ${num(glassLook.shoulder.from)}) + ${num(glassLook.shoulder.to - glassLook.shoulder.from)} * (1.0 - exp(-max(col - ${num(glassLook.shoulder.from)}, 0.0) / ${num(glassLook.shoulder.to - glassLook.shoulder.from)}));
  float alpha = (1.0 - f1) * (1.0 - ${num(glassLook.band.shade)} * band) * seat * (1.0 - ${num(W.dark.shade)} * deep) * (1.0 - ${num(glassLook.rim.clear)} * rimZone * uOwn);
  col += uDress.rgb * uDress.a * 0.05 * (0.4 + 0.6 * pow(1.0 - nv, 2.0));
  col += uBloom * (0.25 + 0.75 * nv);
  alpha *= 1.0 - 0.5 * uDress.a;

  float limb = glassLimb(s);
#ifdef GLASS_RING
  float ringTop = smoothstep(${num(glassLook.ring.side[0])}, ${num(glassLook.ring.side[1])}, nWorld.x) * smoothstep(${num(glassLook.ring.low[0])}, ${num(glassLook.ring.low[1])}, nWorld.y);
  float ringWall = ringTop * smoothstep(${num(glassLook.ring.wallSide[0])}, ${num(glassLook.ring.wallSide[1])}, nWorld.x);
  float ringEdge = ringTop * smoothstep(${num(glassLook.ring.edge[0])}, ${num(glassLook.ring.edge[1])}, s);
  float ringGrain = glassNoise(rimAround * 70.0 + rimAxis * (s * 90.0) + 3.0) - 0.5;
  float ringSpeck = glassNoise(rimAround * 190.0 + rimAxis * (s * 200.0) + 9.0) - 0.5;
  float ringUnder = 1.0 - smoothstep(${num(glassLook.ring.low[0])}, ${num(glassLook.ring.low[1])}, nWorld.y);
  float ring = smoothstep(mix(${num(glassLook.ring.from)} - ${num(glassLook.ring.soft)} * ringTop, ${num(glassLook.ring.lowFrom)}, ringUnder), mix(${num(glassLook.ring.to)}, ${num(glassLook.ring.lowTo)}, ringUnder), s);
  vec3 ringCol = col * mix(1.0, ${num(glassLook.ring.keep)}, ringTop) + uSky * ${vec(glassLook.ring.wall)} * (ringWall * (1.0 + ${num(glassLook.ring.grain)} * ringGrain + ${num(glassLook.ring.speck)} * ringSpeck));
  ringCol = mix(ringCol, uSky * mix(${vec(glassLook.ring.line)}, ${vec(glassLook.ring.lineTop)}, smoothstep(0.6, 0.95, nWorld.y)), ${num(glassLook.ring.lineMix)} * ringEdge);
  float ringLow = (1.0 - smoothstep(${num(glassLook.ring.low[0])}, ${num(glassLook.ring.low[1])}, nWorld.y)) * smoothstep(${num(glassLook.ring.lowEnd[0])}, ${num(glassLook.ring.lowEnd[1])}, nWorld.y);
  ringCol = mix(ringCol, uSky * ${vec(glassLook.ring.lowLine)}, ${num(glassLook.ring.lowMix)} * ringLow * smoothstep(${num(glassLook.ring.lowAt[0])}, ${num(glassLook.ring.lowAt[1])}, s));
  float ringCover = ring * mix(1.0, mix(${num(glassLook.ring.cover)}, 1.0, ringEdge), ringTop);
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
  float mirCover = mix(${num(glassLook.ring.mirror.cover)}, ${num(glassLook.ring.mirror.coverHigh)}, smoothstep(${num(glassLook.ring.mirror.side[1])}, ${num(glassLook.ring.mirror.side[2])}, nWorld.y)) * mirBand;
  gl_FragColor = vec4(ringOut * (1.0 - mirCover) + mirror * (${num(glassLook.ring.mirror.gain)} * mirBand), ringKeep * (1.0 - mirCover));
#else
  gl_FragColor = vec4(col * limb, mix(1.0, alpha, limb));
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
  vec3 col = outerRing * (pale * (0.25 + 0.45 * front) * (0.6 + 0.8 * fine) + warm * front * front + streak * ${num(glassLook.bubble.glint)} * smoothstep(0.3, 0.75, swirl));
  col += innerRing * (pale * (0.5 + 0.3 * front) + streak * ${num(glassLook.bubble.glint * 0.8)} + warm * 2.0 * front * front * glints);
  col += inPatch * (uSky * ${vec(glassLook.bubble.fill)} * ${num(glassLook.bubble.patchFill)} * (0.8 + 0.4 * fine) + streak * ${num(glassLook.bubble.patchGain)} * (0.6 + 0.4 * swirl));
  col += between * (uSky * ${num(glassLook.bubble.milk * 0.2)} + streak * ${num(glassLook.bubble.swirl)} * smoothstep(0.42, 0.8, swirl) * smoothstep(${num(glassLook.bubble.patch)}, 0.9, x));
  col += lip * spark * uKeyCol * ${vec(glassLook.bubble.sparkTint)} * ${num(glassLook.bubble.spark)};
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
  uDress: { value: new THREE.Vector4(1, 1, 1, 0) },
  uBloom: { value: new THREE.Color() },
  uOverlay: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  uOverlayOn: { value: new THREE.Vector3(1, 1, 1) },
  uTurn: { value: new THREE.Matrix3() },
  uGlobeAt: { value: new THREE.Vector3() },
  uSky: { value: new THREE.Color() },
  uGround: { value: new THREE.Color() },
  uBase: { value: new THREE.Color() },
  uPool: { value: new THREE.Color() },
  uSlab: surfaceUniforms.uSlab,
  uOwn: { value: 1 },
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
    const da = a.glassDressing
    const db = b.glassDressing
    sh.uDress.value.set(da.tint[0] + (db.tint[0] - da.tint[0]) * t, da.tint[1] + (db.tint[1] - da.tint[1]) * t, da.tint[2] + (db.tint[2] - da.tint[2]) * t, da.amount + (db.amount - da.amount) * t)
    sh.uBloom.value.copy(f.bloomTint).multiplyScalar(0.12)
    const shown = t < 0.5 ? a : b
    const veiled = f.mix.veil < 0.5 ? a : b
    const dressing = `glass-dressing-${shown.season}`
    const veil = `veil-${veiled.season}`
    ;[partBytes('glass'), partBytes(dressing), partBytes(veil)].forEach((c, i) => sh.uOverlay.value[i]!.set(c[0] / 255, c[1] / 255, c[2] / 255))
    const flagged = f.view === 'standins'
    sh.uOverlayOn.value.set(flagged ? 0 : 1, flagged ? (shown.standIns?.includes(dressing) ? 1 : 0) : sh.uDress.value.w > 0 ? 1 : 0, flagged && !veiled.standIns?.includes(veil) ? 0 : 1)

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
    this.bubble.visible = on
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
    this.bubble.quaternion.copy(this.lean.setFromUnitVectors(this.yAxis, d)).multiply(this.spin.setFromAxisAngle(this.yAxis, 3 * q))
    this.bubble.scale.set(1 + w * Math.cos(5 * p), 1 + 1.6 * w * Math.sin(4 * q + 1.3), 1 - w * Math.cos(5 * p) + 0.5 * w * Math.sin(7 * q))
  }
}
