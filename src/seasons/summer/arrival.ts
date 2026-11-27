import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { meshLevel } from '../../core/models'
import { stream } from '../../core/rng'
import { grade } from '../../post/grade'
import { readRows, rowsAddress, type Rows } from '../../scene/rowsfile'
import { ROW, inSteps } from '../../scene/steps'
import { rimGapMm } from '../../shake/table'
import type { KitMoment } from '../kit'
import { SAND_COLOUR, sinceLoose } from './base'
import { SAND_BORN, SAND_GLSL, SAND_LIT, SLAB, SPRINKLE, sandDeep, sandHeight, sandLitAt, sandProud, sandSprinkle, sandSprinkleAt, sandSprinkleRun, sandStrewn } from './slab'

const PART = 'arrival-summer'
const RAD = Math.PI / 180

// The landing shakes the sand loose. `jump` grains are fine sand round the heap that the thump throws a grain's height
// or two: each hops where it lies and is still again; later they fade and are no longer drawn, and the slab's own sand
// is what lies there. Nothing but the fall leaves the ledge, and no grain rises above it. The fall is the sand that runs
// over the rim of the right shoulder and down the flank onto the mound: the landing starts it with a surge, and it runs
// on as a thin standing fall for as long as the globe stands on the table. It is a sheet of threads. A thread is the one
// path sand takes from the lip with the speed it has from sliding down the bank: the quick ones clear the belly of the
// stone, the rest run down it. The grains of a thread follow one another down that path, and each is drawn as a camera
// with a quick shutter sees it: as the short line it travels in that time, soft at its ends. Sand falls a few
// millimetres from one frame to the next, and grains drawn where each of them is would be other grains in other places
// in every frame, which boils. So a thread is drawn as a camera sees grains that follow one another evenly: each line
// where the line before it was, a little further on. The lines travel down the thread, each along its own path from the
// lip to the heap three, four or five times in the ambient period, and none comes or goes in the open: the whole fall
// travels and nothing of it stands. Neighbours go at different rates, so the sheet shears as it runs. The sheet is a
// few grains deep. Its
// back is the sand in the shade of the sand before it: threads over its breadth but for the outer fringe, their lines
// long, wide, soft and dim, which close the sheet against the room. Its face is the sand in the light: many fine
// threads side by side, each with a few lines, so that the lines of neighbours lie staggered and the back shows between
// them as thin dark lines. No two lines need be as long: each is some travels of a frame long, most of them near the
// least, which is what the length law asks (lit for twice its travel, its soft ends not counted), and a few three times
// that. Nor as light: a line has any tone from the shade's to the sun's, the dim ones the sand's own brown and the
// lightest pale. The face is dim next to the stone and bright at its outer edge. A few loose
// grains sink along the outer face, each drawn as the line it travels while the film's shutter is open. Every place is
// a function of the time since the landing and of the clock, nothing is kept from frame to frame. The mirror of the
// slab gets none of the grains; medium and low draw a share.
const LOOK = {
  gravity: 3400,
  lift: { share: 0.6, nearMm: [61.5, 69.0], late: 0.4, upMmS: [70, 170], inMm: 1.1 },
  jump: { count: 8600, shade: 0.3, reach: 0.2, onHeap: 0.1, hopMm: [0.15, 1.0], within: 0.05, radiusMm: [0.04, 0.1] },
  fall: { count: 1371, gravity: 7000, bands: 12, strands: 4, surge: 1, fill: 0.8, stray: 0.45, sway: 0.1, lines: 70, fold: 1, turns: [3, 4, 5], long: [2.9, 10], ends: 0.15, looks: [0, 7, 1, 8, 15, 3, 9, 4, 5, 10, 12, 4, 13, 6, 11, 14], picks: { stand: [0.02, 0.78], surge: [0.82, 0.95] }, part: [0.02, 0.9], azDeg: [92, 86], off: [1.05, 1.25], h: [38.9, 39.1], outMmS: [72, 150], downMmS: [10, 40], radiusMm: [0.04, 0.05], wide: [0.0004, 0.0006], finePx: 0.7, bow: 16, kink: 0.004, core: [80, 148], tone: [0.3, 10], knee: 1.3, over: 0.15, cream: [1, 1.4], stone: 0.22, redder: [1, 1.08, 1.2], warm: [1, 0.82, 0.81], faint: 0.9, shutter: 1, cover: 0.95, keep: 100, rise: 0.012, pale: 0.3, plain: 0.4, lit: 1.3, shaded: 0.08, deep: { threads: 30, grains: 8, every: 6, turns: 3, span: 0.88, stray: 0.4, dashS: [0.012, 0.032], radiusMm: [0.2, 0.28], wide: [0.0024, 0.0033], cover: 0.95, faint: 1, tone: [0.04, 0.065, 0.09, 1] }, loose: { count: 40, outMmS: [152, 175], lean: 2, sinkMmS: [45, 90], offMm: [0.05, 0.3], azDeg: [85, 87], radiusMm: 0.085, most: 12, stepS: 0.002, floorMm: 3.2, solid: 0.9, lit: 1.3 } },
  loose: { x: [16, 136], z: [-70, 112], kind: { proud: [0.26, 0.08] }, thinPx: 0.3, round: [-0.3, 0.6, 1.4], glint: { one: 40, lit: 2.2 }, squash: [1.0, 2.4], bend: 0.7, proud: { count: 9000, under: 3500, radiusMm: [0.07, 0.17, 0.45], small: 0.6, lean: 1.6, thin: 0.45, sunk: 0.3, vary: [0.6, 1.2], apart: 0.3 }, dust: { count: 12400, radiusMm: [0.03, 0.07], reach: 0.13, cover: 0.6 }, grain: { count: 2600, radiusMm: [0.05, 0.1], lean: 1.4, reach: 0.15 }, crumb: { count: 40, radiusMm: [0.12, 0.17], lean: 1.6, reach: 0.35 }, strewn: { behind: [3, 17], thinMm: 0.6, runMm: [0.5, 1, 2, 3, 5, 7, 10, 14], thins: 5, front: 0.1, skinMm: 1.2 }, vary: [0.1, 0.42], warm: [1.0, 0.8, 0.56] },
  sprinkle: { count: 0, thinPx: 0.85, vary: [0.4, 1.15], warm: [1.0, 0.84, 0.64], s: [-12, 78], d: [-0.4, 16], mm: [0.07, 0.18], core: { share: 0.7, mm: 3.0, wide: 2.4, lit: 0.85, size: [0.08, 0.2] }, glints: { count: 46, d: [13, 46], mm: [0.16, 0.34], lit: 2.6 } },
  lens: { rows: 1080, most: 4, flyPx: 0.5, round: [1.6, 4.0], clear: 6 },
  slope: { clearMm: 0.25, keeps: 0.75, roll: 0.5, bulge: 0.0038, crestMm: [60.6, 61.75], offMm: [0.12, 0.55], belly: [[60.3, 8], [60.3, 11.2], [59.7, 14.6], [58.6, 18], [57.3, 21.2], [55.8, 24.4], [54.3, 27.4], [53, 30.5], [52.9, 32.4], [52.6, 34.3], [52, 36], [51.2, 37.5], [50.2, 38.8], [49.2, 39.9]] },
  flow: { stand: 0.8, seconds: 1.6, gapMm: [0.3, 2.5], shadeMm: [0.5, 60], pick: [0, 17.7], slack: 0.001 },
  exposure: 0.15,
  gold: [1, 0.8, 0.66],
  backlit: 2.6,
  shadow: { r: 57, top: [36, 41] },
  streak: 2.1,
  blurRadii: 3,
  gone: [6.5, 8],
  grow: { frames: 20 },
  share: { medium: 0.6, low: 0.3 } as Record<string, number>,
  stride: 7919,
}

const LOOKS = 16
const FPS = config.film.fps

const vec = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`

const grainUniforms = {
  uGrain: { value: new THREE.Vector4(50, 0, 0, 1 / 120) },
  uGrainLoop: { value: new THREE.Vector2(0, 12) },
  uGrainLevel: { value: 1 },
  uGrainPx: { value: 1000 },
  uGrainFine: { value: 0 },
  uGrainLens: { value: new THREE.Vector4(1, 1, 0, 1) },
  uGrainFocus: { value: new THREE.Vector2(0, 1) },
  uGrainShift: { value: new THREE.Vector2() },
  uGrainKey: { value: new THREE.Vector3(0, 1, 0) },
  uGrainKeyCol: { value: new THREE.Color() },
  uGrainSky: { value: new THREE.Color() },
  uGrainGround: { value: new THREE.Color() },
  uSandDown: { value: 1 },
  uSandGrow: { value: 1 },
  uSandLift: { value: -1 },
  uSandFoot: { value: new THREE.Vector2(0, 0) },
}

const VERT_PARS = `
attribute vec3 aFrom;
attribute vec4 aFlight;
attribute vec4 aSeed;
attribute vec2 aCorner;
uniform float uSandGrow;
uniform float uSandLift;
uniform vec4 uGrain;
uniform vec2 uGrainLoop;
uniform float uGrainLevel;
uniform float uGrainPx;
uniform float uGrainFine;
uniform vec4 uGrainLens;
uniform vec2 uGrainFocus;
uniform vec2 uGrainShift;
uniform float uSandDown;
uniform vec2 uSandFoot;
uniform vec3 uGrainKey;
varying vec2 vGrainUv;
varying float vGrainSoft;
varying vec4 vGrainLook;
varying vec3 vGrainShape;
varying float vGrainCover;
varying float vGrainLit;
varying float vGrainSun;
varying vec4 vGrainLine;
varying float vGrainRun;
${SAND_GLSL}
${SAND_BORN}
vec3 fallRoll() {
  float G = ${LOOK.fall.gravity.toFixed(1)};
  float T = aFlight.y;
  float deep = max(aFrom.y + aFlight.z * T - 0.5 * G * T * T - position.y, 0.0);
  float first = ${LOOK.slope.keeps.toFixed(2)} * (G * T - aFlight.z);
  return vec3((sqrt(first * first + ${(2 * LOOK.slope.roll * LOOK.fall.gravity).toFixed(1)} * deep) - first) / ${(LOOK.slope.roll * LOOK.fall.gravity).toFixed(1)}, first, deep);
}
float fallSlide() {
  if (aSeed.w <= 0.0) return 0.0;
  return fallRoll().x;
}
// How much of its sand a thread has at the place sand reaches so many seconds after the lip: none that left the lip
// before the landing or after the lift, little at first, and of the threads that only the surge runs, less with the time.
float fallRun(float s, float shut) {
  float left = uGrain.x - s;
  float come = clamp(left * ${(FPS / LOOK.grow.frames).toFixed(3)}, 0.0, 1.0);
  float kept = clamp((uGrain.z * (${LOOK.flow.stand.toFixed(3)} + ${(1 - LOOK.flow.stand).toFixed(3)} * exp(-max(left, 0.0) / ${LOOK.flow.seconds.toFixed(3)})) - fract(aSeed.x * ${LOOK.flow.pick[1]!.toFixed(1)})) * ${LOOK.fall.keep.toFixed(1)} + 1.0, 0.0, 1.0);
  float held = uSandLift >= 0.0 ? clamp((s - uSandLift) / shut, 0.0, 1.0) : 1.0;
  return clamp(left / shut, 0.0, 1.0) * come * (2.0 - come) * kept * held;
}
vec3 grainPath(float tau) {
  if (aSeed.y > 1.5) return position;
  float GRAVITY = aSeed.y > 0.5 ? ${LOOK.fall.gravity.toFixed(1)} : ${LOOK.gravity.toFixed(1)};
  float T = aFlight.y;
  float vy = aFlight.z;
  vec3 to = position;
  vec2 way = to.xz - aFrom.xz;
  vec2 dir = (dot(way, way) > 0.0 ? normalize(way) : vec2(1.0, 0.0));
  float skid = aSeed.w;
  if (aSeed.y > 0.5 && skid < 0.0) {
    float lead = ${LOOK.fall.downMmS[0].toFixed(1)};
    float run = (sqrt(lead * lead - 2.0 * GRAVITY * vy * tau) - lead) / GRAVITY;
    float whole = (sqrt(lead * lead - 2.0 * GRAVITY * vy * T) - lead) / GRAVITY;
    return vec3(mix(aFrom.xz, to.xz, run / max(whole, 1e-5)), aFrom.y + vy * tau).xzy;
  }
  vec2 touch = to.xz - dir * skid;
  vec3 fly = vec3(mix(aFrom.xz, touch, tau / T), aFrom.y + vy * tau - 0.5 * GRAVITY * tau * tau).xzy;
  if (aSeed.y < 0.5) {
    if (tau < T) return fly;
    float after = tau - T;
    float hop = skid * 0.45 * abs(sin(after * 38.0)) * exp(-after * 16.0);
    return vec3(to.xz - dir * skid * exp(-after * 13.0), to.y + hop).xzy;
  }
  if (skid <= 0.0) return fly;
  float touchY = aFrom.y + vy * T - 0.5 * GRAVITY * T * T;
  vec3 roll = fallRoll();
  float after = min(tau - T, roll.x);
  float s = min((roll.y * after + ${(0.5 * LOOK.slope.roll * LOOK.fall.gravity).toFixed(1)} * after * after) / max(roll.z, 1e-4), 1.0);
  float off = sin(3.14159 * s) * (${LOOK.slope.bulge.toFixed(4)} * roll.z * roll.z + mix(${LOOK.slope.offMm[0].toFixed(2)}, ${LOOK.slope.offMm[1].toFixed(2)}, 0.5 - 0.5 * cos(s * 7.0 + floor(aSeed.x * ${LOOKS.toFixed(1)}) * 2.5)));
  vec3 run = vec3(mix(touch, to.xz, s) + dir * off, mix(touchY, to.y, s)).xzy;
  return mix(fly, run, smoothstep(T - ${LOOK.fall.kink.toFixed(4)}, T + ${LOOK.fall.kink.toFixed(4)}, tau));
}
`

const VERT_MAIN = `
float grainT = uGrain.x;
float tau;
float alive = 1.0;
float airborne = 0.0;
float grown = 1.0;
float fallLife = 0.0;
float shut = uGrain.w * ${(LOOK.fall.shutter / LOOK.exposure).toFixed(4)};
float past = 0.0;
vec4 line = vec4(0.0, 1.0, 0.0, 0.0);
vec2 ran = vec2(1.0);
float chance = 0.0;
float back = 0.0;
if (aSeed.y < -0.5) {
  tau = max(grainT - aFlight.x, 0.0);
} else if (aSeed.y < 0.5) {
  tau = grainT - aFlight.x;
  if (grainT < 0.0 || tau < 0.0) alive = 0.0;
} else if (aSeed.y < 1.5) {
  fallLife = aFlight.y + fallSlide();
  float middle;
  float open;
  if (aSeed.w < 0.0) {
    // A loose grain is where it is, and its line is the way it goes while the film's shutter is open.
    float cycles = max(1.0, floor(uGrainLoop.y * aFlight.x + 0.5));
    open = shut;
    middle = fract(uGrainLoop.x * cycles + aSeed.z) * (uGrainLoop.y / cycles) - 0.5 * open;
  } else {
    // A grain of a thread is where the grain before it was, a little further on, and its line is the way a grain goes
    // while a quick shutter is open. Grains whose places are a whole share of the path apart are one grain to the eye.
    // A row whose rate is below zero is a grain at the back of the sheet.
    back = aFlight.x > 0.0 ? 0.0 : 1.0;
    float turns = max(1.0, floor(uGrainLoop.y * abs(aFlight.x) * ${LOOK.fall.fold.toFixed(1)} + 0.5));
    chance = fract(aSeed.z * ${LOOK.fall.fold.toFixed(1)});
    float travel = fallLife * abs(aFlight.x) * ${(LOOK.fall.fold / FPS).toFixed(6)};
    float span = fract(chance * 631.7);
    open = max(mix(mix(travel * ${LOOK.fall.long[0].toFixed(2)}, ${LOOK.fall.deep.dashS[0].toFixed(5)}, back), mix(travel * ${LOOK.fall.long[1].toFixed(2)}, ${LOOK.fall.deep.dashS[1].toFixed(5)}, back), mix(span * span, span, back)), 1e-5);
    middle = fract(uGrainLoop.x * turns / ${LOOK.fall.fold.toFixed(1)} + aSeed.z) * fallLife;
  }
  past = max(middle - 0.5 * open, 0.0);
  tau = min(middle + 0.5 * open, fallLife);
  ran = middle - 0.5 * open < fallLife ? vec2(fallRun(past, shut), fallRun(tau, shut)) : vec2(0.0);
  line.xy = vec2(past - middle + 0.5 * open, tau - past) / open;
  ran *= smoothstep(0.0, ${LOOK.fall.rise.toFixed(3)}, vec2(past, tau));
  if (grainT < 0.0 || max(ran.x, ran.y) <= 0.0 || fract(aSeed.x * 23.9 + 0.37) > uGrainLevel) alive = 0.0;
} else {
  tau = 0.0;
  if (fract(aSeed.z * 23.9 + 0.37) > uGrainLevel) alive = 0.0;
}
// No grain is on the table before the foot is down: from then they come in the slab's patches, those by the base first.
if (aSeed.y < 0.5 || aSeed.y > 1.5) {
  grown = sandCome(position.xz, fract(aSeed.x * 41.3 + aSeed.z * 17.1), uSandGrow);
  if (grown <= 0.0) alive = 0.0;
}
tau = max(tau, 0.0);
float falls = aSeed.y > 0.5 && aSeed.y < 1.5 ? 1.0 : 0.0;
float lies = aSeed.y > 1.5 ? 1.0 : 0.0;
vec3 nowAt = grainPath(tau);
vec3 thenAt = grainPath(falls > 0.5 ? past : max(tau - uGrain.w, 0.0));
if (lies > 0.5) {
  nowAt.y = mix(${SLAB.liftMm.toFixed(2)} + (nowAt.y - ${SLAB.liftMm.toFixed(2)}) * uSandGrow, nowAt.y, step(1.0, uSandGrow));
  // A few of the grains that lay against the foot are taken up a little way as it leaves, and fall back.
  float taken = 1.0 - smoothstep(${LOOK.lift.nearMm[0]!.toFixed(1)}, ${LOOK.lift.nearMm[1]!.toFixed(1)}, length(position.xz));
  if (uSandLift >= 0.0 && fract(aSeed.x * 57.3 + aSeed.z * 31.7) < ${LOOK.lift.share.toFixed(2)} * taken) {
    float up = mix(${LOOK.lift.upMmS[0]!.toFixed(1)}, ${LOOK.lift.upMmS[1]!.toFixed(1)}, fract(aSeed.z * 83.7 + aSeed.x * 9.1));
    float air = 2.0 * up / ${LOOK.gravity.toFixed(1)};
    float fly = clamp(uSandLift - ${LOOK.lift.late.toFixed(2)} * fract(aSeed.x * 23.1 + aSeed.z * 47.9), 0.0, air);
    nowAt.y += up * fly - ${(0.5 * LOOK.gravity).toFixed(1)} * fly * fly;
    nowAt.xz -= (dot(position.xz, position.xz) > 0.0 ? normalize(position.xz) : vec2(1.0, 0.0)) * (${LOOK.lift.inMm.toFixed(2)} * sin(3.14159 * fly / air));
  }
  thenAt = nowAt;
} else if (falls < 0.5) {
  float low = (1.0 - uSandGrow) * (position.y - ${SLAB.liftMm.toFixed(2)}) * (aSeed.y < -0.5 ? 1.0 : clamp(tau / max(aFlight.y, 1e-4), 0.0, 1.0));
  nowAt.y -= low;
  thenAt.y -= low;
}
airborne = (tau < aFlight.y && lies < 0.5) || falls > 0.5 ? 1.0 : 0.0;
vec4 nowV = viewMatrix * modelMatrix * vec4(nowAt, 1.0);
vec4 thenV = viewMatrix * modelMatrix * vec4(thenAt, 1.0);
float size = aFlight.w * alive;
float thinner = 1.0;
float soft = 0.0;
float streak = 1.0;
float pad = 1.0;
vGrainRun = 1.0;
vec4 grainV = nowV;
vec3 endAt = nowAt;
if (falls > 0.5) {
  // The line from one end to the other at the depth of its later end, bowed through the place the grain has halfway in
  // time. It is as wide as the grain, but never under nor over a set share of the picture's shorter side, which is the
  // same line in a picture of any size; drawn wider than the grain it hides that much less. The page, which draws each
  // pixel once, has a floor of its own.
  vec4 midV = viewMatrix * modelMatrix * vec4(grainPath(0.5 * (past + tau)), 1.0);
  thenV.xy *= nowV.z / min(thenV.z, -1e-3);
  midV.xy *= nowV.z / min(midV.z, -1e-3);
  vec2 chord = nowV.xy - thenV.xy;
  float reach = length(chord);
  vec2 way = reach > 1e-5 ? chord / reach : vec2(0.0, 1.0);
  vec2 side = vec2(-way.y, way.x);
  float unit = max(-nowV.z, 1.0) / uGrainPx;
  float shorter = min(uGrainLens.x, uGrainLens.y);
  float drawn = max(clamp(aFlight.w, mix(${LOOK.fall.wide[0].toFixed(5)}, ${LOOK.fall.deep.wide[0].toFixed(5)}, back) * shorter * unit, mix(${LOOK.fall.wide[1].toFixed(5)}, ${LOOK.fall.deep.wide[1].toFixed(5)}, back) * shorter * unit), uGrainFine * unit);
  size = drawn;
  thinner = min(aFlight.w / drawn, 1.0);
  vec2 sag = midV.xy - thenV.xy;
  float amid = reach > 1e-5 ? clamp(dot(sag, way) / reach, 0.26, 0.74) : 0.5;
  float bow = reach > 1e-5 ? clamp(dot(sag, side) / drawn, -${LOOK.fall.bow.toFixed(1)}, ${LOOK.fall.bow.toFixed(1)}) : 0.0;
  line.zw = vec2(4.0 * amid - 2.0, bow);
  pad = 1.0 + min(1.5 * (1.0 + floor(uGrainLens.z)) * unit / drawn, ${LOOK.lens.most.toFixed(1)});
  float aside = 0.5 * bow + aCorner.x * (pad + 0.5 * abs(bow));
  grainV = vec4(mix(thenV.xy, nowV.xy, 0.5 + 0.5 * aCorner.y) + side * (aside * drawn), nowV.z, 1.0);
  vGrainUv = vec2(aside, 0.5 + 0.5 * aCorner.y);
  endAt = aCorner.y < 0.0 ? thenAt : nowAt;
  vGrainRun = aCorner.y < 0.0 ? ran.x : ran.y;
} else {
  vec2 along = nowV.xy - thenV.xy;
  float len = length(along);
  vec2 axis = len > 1e-4 ? along / len : vec2(0.0, 1.0);
  vec2 across = vec2(-axis.y, axis.x);
  float blur = min(len, ${LOOK.blurRadii.toFixed(2)} * aFlight.w);
  // The grains strewn to the right of the base are finer than the sprinkle to its left, which keeps its own size.
  float least = mix(${LOOK.lens.flyPx.toFixed(2)}, mix(${LOOK.sprinkle.thinPx.toFixed(2)}, ${LOOK.loose.thinPx.toFixed(2)}, step(${LOOK.loose.x[0]!.toFixed(1)}, position.x)), lies) * max(-nowV.z, 1.0) / uGrainPx;
  if (lies > 0.5) blur = 0.0;
  size = max(aFlight.w, least) * alive;
  thinner = aFlight.w / max(aFlight.w, least);
  thinner *= thinner;
  // A grain out of focus is one soft disc as wide as the lens draws it, at the one place the lens's points share (as the
  // backdrop's discs are): drawn once from each point it is a row of beads. A blur narrower than the grain widens it
  // as squares add, hardly at all; a blur three times the grain and more is laid round it whole.
  float lensPull = max(-nowV.z, 1.0) * uGrainFocus.y - 1.0;
  nowV.xy -= uGrainShift * lensPull;
  soft = uGrainFocus.x * abs(lensPull) * alive;
  float lensWide = size * size + soft * soft + 2.0 * size * soft * smoothstep(1.0, 3.0, soft / max(size, 1e-10));
  thinner *= size * size / max(lensWide, 1e-10);
  soft = sqrt(lensWide) - size;
  size += soft;
  grainV = nowV;
  grainV.xy -= axis * (blur * (0.5 - 0.5 * aCorner.y));
  streak = 1.0 + blur / max(2.0 * size, 1e-4);
  // The lens parts red from blue toward the frame's edge (post.ts). The grain is drawn that much wider, and its fragment
  // lays its red and blue where the lens will bring them back onto its green.
  pad = 1.0 + min(1.5 * (1.0 + floor(uGrainLens.z)) * max(-nowV.z, 1.0) / max(size * uGrainPx, 1e-3), ${LOOK.lens.most.toFixed(1)});
  // A grain at rest stands on the sand with the whole of what is drawn of it, and the table does not cut the margin its
  // colours are laid in: a cut edge is a hard edge, and the lens gives every hard edge a blue line.
  grainV.y += (1.0 - airborne) * max(size - soft - aFlight.w, 0.0);
  grainV.xy += (axis * aCorner.y + across * aCorner.x) * (size * pad);
  vGrainUv = aCorner * vec2(pad, 1.0 + (pad - 1.0) / streak);
}
gl_Position = projectionMatrix * grainV;
if (falls < 0.5) {
  vec4 grainNear = projectionMatrix * vec4(grainV.xy, grainV.z + ${LOOK.lens.clear.toFixed(1)} * size * pad, 1.0);
  gl_Position.z = grainNear.z / grainNear.w * gl_Position.w;
} else if (alive < 0.5) {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
vec4 grainW = modelMatrix * vec4(endAt, 1.0);
vStageWorld = grainW.xyz;
vStageLocal = (uGlobeInv * grainW).xyz;
vStageAux = vec3(0.0, -grainV.z, length(grainV.xyz));
vStagePlaced = grainW.xyz;
vStageSeen = 1.0;
vGrainShape = vec3(streak, airborne, falls + 2.0 * lies);
vGrainSoft = soft / max(size, 1e-5);
vGrainCover = (aSeed.y > 0.5 ? 1.0 : 1.0 - uGrain.y) * min(1.0, ${LOOK.streak.toFixed(2)} / streak) * min(1.0, thinner);
float drifts = falls > 0.5 && aSeed.w < 0.0 ? 1.0 : 0.0;
if (falls > 0.5) vGrainCover = mix(mix(${LOOK.fall.cover.toFixed(3)}, ${LOOK.fall.deep.cover.toFixed(3)}, back) * mix(mix(${LOOK.fall.faint.toFixed(2)}, ${LOOK.fall.deep.faint.toFixed(2)}, back), 1.0, fract(chance * 293.3)), ${LOOK.fall.loose.solid.toFixed(3)}, drifts) * thinner;
if (lies > 0.5) vGrainCover = min(1.0, thinner) * mix(1.0, ${LOOK.loose.dust.cover.toFixed(2)}, step(0.15, aSeed.w) * step(aSeed.w, 0.25));
vGrainCover *= grown;
// The threads next to the stone are in the fall's own shade, and the sheet is the brighter the farther out it flies.
float outward = (length(position.xz - aFrom.xz) - max(aSeed.w, 0.0)) / max(aFlight.y, 1e-3);
// A line of the fall is as light as the light that reaches its sand through the sand beside it: any tone from the
// shade's to the sun's, and all of them dimmer toward the stone. Light over the sun's own adds little: the lightest
// lines differ, and none burns out. Those at the back of the sheet are in the shade of those before them. A loose grain
// says with its light that it is one.
float face = smoothstep(${LOOK.fall.core[0].toFixed(1)}, ${LOOK.fall.core[1].toFixed(1)}, outward);
float dice = fract(chance * 977.0);
float dealt = mix(${LOOK.fall.stone.toFixed(3)}, 1.0, face) * exp2(mix(${Math.log2(LOOK.fall.tone[0]).toFixed(3)}, ${Math.log2(LOOK.fall.tone[1]).toFixed(3)}, dice));
float toned = min(dealt, ${LOOK.fall.knee.toFixed(2)}) * pow(max(dealt / ${LOOK.fall.knee.toFixed(2)}, 1.0), ${LOOK.fall.over.toFixed(2)});
float shady = mix(${LOOK.fall.deep.tone[0].toFixed(3)}, mix(${LOOK.fall.deep.tone[1].toFixed(3)}, ${LOOK.fall.deep.tone[2].toFixed(3)}, face), pow(max(dice, 1e-4), ${LOOK.fall.deep.tone[3].toFixed(3)}));
vGrainLit = lies > 0.5 ? 1.0 + aSeed.w : falls > 0.5 ? mix(mix(toned, shady, back), 1000.0, drifts) : 1.0;
float sunlit = mix(1.0, sandBaseShade(grainW.xyz - vec3(uSandFoot.x, 0.0, uSandFoot.y), uGrainKey), uSandDown);
vGrainSun = lies > 0.5 ? aFlight.x : 1.0;
// A grain of the fall in the shade of the stone is as dark as the stone behind it and is all but lost against it.
if (falls > 0.5) vGrainCover *= mix(${LOOK.fall.shaded.toFixed(2)}, 1.0, sunlit);
// All the grains of one thread have the thread's look, which is the whole part of their seed.
float kind = (floor(aSeed.x * ${LOOKS.toFixed(1)}) + 0.5) / ${LOOKS.toFixed(1)};
vGrainLook = falls > 0.5 ? vec4(kind, fract(kind * 91.7), sunlit, alive) : vec4(aSeed.x, fract(aSeed.x * 91.7 + aSeed.z * 13.1), sunlit, alive);
vGrainLine = line;
`

const fragment = (): string => `
uniform vec3 uGrainKey;
uniform vec3 uGrainKeyCol;
uniform vec3 uGrainSky;
uniform vec3 uGrainGround;
varying vec2 vGrainUv;
varying float vGrainSoft;
varying vec4 vGrainLook;
varying vec3 vGrainShape;
varying float vGrainCover;
varying float vGrainLit;
varying float vGrainSun;
varying vec4 vGrainLine;
varying float vGrainRun;
uniform vec4 uGrainLens;
${SAND_GLSL}
mat2 grainTurn = mat2(1.0, 0.0, 0.0, 1.0);
vec2 grainCrumb = vec2(1.0, 0.0);
bool grainThread = false;
float grainBow = 0.0;
float grainDisc(vec2 at, float L) {
  if (grainThread) {
    float off = at.x - grainBow;
    return 1.0 - smoothstep(0.0, 1.0, off * off);
  }
  vec2 uv = grainTurn * at * (1.0 + 0.3 * abs(grainCrumb.y));
  uv.y *= grainCrumb.x;
  uv.x += grainCrumb.y * (uv.y * uv.y - 0.3);
  float capY = sign(uv.y) * max(abs(uv.y) * L - (L - 1.0), 0.0);
  return 1.0 - smoothstep(0.0, 1.0, uv.x * uv.x + capY * capY);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (vGrainLook.w < 0.5) discard;
  float L = vGrainShape.x;
  float falls = vGrainShape.z > 0.5 && vGrainShape.z < 1.5 ? 1.0 : 0.0;
  // A grain of the fall: when in the shutter's time it was at this pixel, how far its line is bowed here from the
  // straight between its ends, and how much of it is left toward the end of the line.
  float share = 1.0;
  if (falls > 0.5) {
    float went = clamp(vGrainUv.y, 0.0, 1.0);
    float lead = vGrainLine.z;
    float timed = 2.0 * went / (1.0 + lead + sqrt(max((1.0 + lead) * (1.0 + lead) - 4.0 * lead * went, 0.0)));
    float place = vGrainLine.x + vGrainLine.y * timed;
    share = clamp(min(place, 1.0 - place) * ${(1 / LOOK.fall.ends).toFixed(3)}, 0.0, 1.0);
    if (share <= 0.0) discard;
    share *= share * (3.0 - 2.0 * share);
    grainBow = 4.0 * vGrainLine.w * timed * (1.0 - timed);
    grainThread = true;
  }
  // A coarse crumb on the table is not a ball: it is longer one way than the other, and bent.
  if (vGrainShape.z > 1.5 && vGrainLit < 2.5) {
    float turn = 6.2832 * fract(vGrainLook.x * 57.3);
    grainTurn = mat2(cos(turn), sin(turn), -sin(turn), cos(turn));
    grainCrumb = vec2(mix(${LOOK.loose.squash[0]!.toFixed(2)}, ${LOOK.loose.squash[1]!.toFixed(2)}, vGrainLook.y), ${LOOK.loose.bend.toFixed(2)} * (2.0 * fract(vGrainLook.x * 13.7) - 1.0));
    grainCrumb = mix(grainCrumb, vec2(1.0, 0.0), vGrainSoft);
  }
  vec2 lensQ = gl_FragCoord.xy - uGrainLens.xy;
  float lensR = dot(lensQ, lensQ) / dot(uGrainLens.xy, uGrainLens.xy);
  vec2 lensPx = lensQ / max(length(lensQ), 1e-4) * (uGrainLens.z * pow(max(lensR, 1e-12), 0.5 * uGrainLens.w));
  // A grain hides what lies behind it with one cover for its three colours. On the dark table that is right; a grain that
  // stands proud of the heap has pale sand behind it, and laid as far apart its inner edge would lose its red: a mint line.
  if (vGrainShape.z > 1.5 && vGrainLit > 1.255 && vGrainLit < 1.345) lensPx *= ${LOOK.loose.proud.apart.toFixed(2)};
  vec2 lensX = dFdx(vGrainUv);
  vec2 lensY = dFdy(vGrainUv);
  // The post reads the red between four pixels on one side of this one and the blue between four on the other. The red is
  // laid on its four pixels with the weights the post will read them back with, the blue likewise, and the green is laid
  // as both come out: the three are the same picture after the lens, at any size of picture.
  vec2 lensLowR = floor(lensPx);
  vec2 lensFarR = lensPx - lensLowR;
  vec2 lensLowB = floor(-lensPx);
  vec2 lensFarB = -lensPx - lensLowB;
  vec3 disc = vec3(0.0);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 k = vec2(float(i), float(j));
      vec2 wR = mix(1.0 - lensFarR, lensFarR, k);
      vec2 wB = mix(1.0 - lensFarB, lensFarB, k);
      vec2 oR = lensLowR + k;
      vec2 oB = lensLowB + k;
      disc.r += wR.x * wR.y * grainDisc(vGrainUv - lensX * oR.x - lensY * oR.y, L);
      disc.b += wB.x * wB.y * grainDisc(vGrainUv - lensX * oB.x - lensY * oB.y, L);
    }
  }
  vec2 lensSide = lensFarR * (1.0 - lensFarR);
  vec2 lensMid = 1.0 - 2.0 * lensSide;
  for (int j = -1; j < 2; j++) {
    for (int i = -1; i < 2; i++) {
      float w = (i == 0 ? lensMid.x : lensSide.x) * (j == 0 ? lensMid.y : lensSide.y);
      disc.g += w * grainDisc(vGrainUv + lensX * float(i) + lensY * float(j), L);
    }
  }
  if (max(disc.r, max(disc.g, disc.b)) <= 0.0) discard;
  float capY = sign(vGrainUv.y) * max(abs(vGrainUv.y) * L - (L - 1.0), 0.0);
  float d2 = min(vGrainUv.x * vGrainUv.x + capY * capY, 1.0);
  vec3 nv = normalize(vec3(vGrainUv.x, capY, sqrt(1.0 - d2)));
  vec3 n = normalize(nv * mat3(viewMatrix));
  vec3 v = normalize(cameraPosition - vStageWorld);
  // A grain a pixel or two wide has no lit side and shaded side to show: each would be a rim of its own colour. It is lit as one.
  // What counts is the grain's own width, not the width of the disc the lens makes of it. A thread is lit as one.
  float round = (1.0 - falls) * smoothstep(${LOOK.lens.round[0]!.toFixed(1)}, ${LOOK.lens.round[1]!.toFixed(1)}, (1.0 - vGrainSoft) * inversesqrt(max(lensX.x * lensX.x + lensY.x * lensY.x, 1e-8)) * ${(LOOK.lens.rows / 2).toFixed(1)} / min(uGrainLens.x, uGrainLens.y));
  round *= 1.0 - vGrainSoft;
  n = normalize(mix(normalize(uGrainKey + v + vec3(0.0, 1.0, 0.0)), n, round));
  float id = vGrainLook.x;
  float id2 = vGrainLook.y;
  vec3 albedo = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, smoothstep(0.1, 0.75, id));
  albedo = mix(albedo, ${vec(SAND_COLOUR.dark)}, step(0.93, id2) * (1.0 - falls));
  float flies = falls * step(999.0, vGrainLit);
  float creamy = falls * (1.0 - flies) * smoothstep(${LOOK.fall.cream[0].toFixed(2)}, ${LOOK.fall.cream[1].toFixed(2)}, vGrainLit);
  float white = max(max(step(id2, mix(0.12, ${LOOK.fall.pale.toFixed(2)}, falls)), flies), creamy);
  albedo = mix(albedo, ${vec(SAND_COLOUR.white)}, white);
  float shade = mix(0.25, 1.0, vGrainLook.z) * mix(mix(vGrainLit, 1.0, falls), ${LOOK.fall.loose.lit.toFixed(2)}, flies) * mix(1.0, ${LOOK.fall.lit.toFixed(2)}, falls);
  float ndl = dot(n, uGrainKey);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  float thru = pow(clamp(dot(-v, uGrainKey) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  vec3 dome = mix(uGrainGround, uGrainSky, 0.5 + 0.5 * n.y);
  albedo *= mix(vec3(1.0), ${vec(LOOK.gold)} * (0.7 + 0.6 * fract(id2 * 7.3)), vGrainShape.y * (1.0 - ${LOOK.fall.plain.toFixed(2)} * falls * white));
  vec3 col = albedo * RECIPROCAL_PI * (uGrainKeyCol * shade * (wrap + 1.8 + (0.6 + ${LOOK.backlit.toFixed(2)} * vGrainShape.y) * thru) + dome + uRigCardCol * 0.35 * clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0));
  float hk = max(dot(n, normalize(v + uGrainKey)), 0.0);
  col += uGrainKeyCol * shade * step(0.7, fract(id * 17.9)) * pow(abs(hk), 60.0) * 1.2;
  // A grain that lies on the heap or on the table is lit as the heap's skin is (slab.ts): by the sun the sand under it
  // takes and the stone's shade, each a little more or less than the next; one wide enough to show it has a lit side.
  if (vGrainShape.z > 1.5) {
    float kind = vGrainLit - 1.0;
    float vary = fract(id * 29.3 + id2 * 3.1);
    float proud = step(0.255, kind) * step(kind, 0.345);
    float deep = clamp((kind - ${LOOK.loose.kind.proud[0]!.toFixed(2)}) / ${LOOK.loose.kind.proud[1]!.toFixed(2)}, 0.0, 1.0);
    float gain = mix(mix(${LOOK.loose.vary[0]!.toFixed(2)}, ${LOOK.loose.vary[1]!.toFixed(2)}, vary), mix(${LOOK.loose.proud.vary[0]!.toFixed(2)}, ${LOOK.loose.proud.vary[1]!.toFixed(2)}, vary), proud);
    float side = mix(1.0, ${LOOK.loose.round[2]!.toFixed(2)} * smoothstep(${LOOK.loose.round[0]!.toFixed(2)}, ${LOOK.loose.round[1]!.toFixed(2)}, ndl), round);
    float back = clamp(dot(-v, uGrainKey) * 0.5 + 0.5, 0.0, 1.0);
    float near = mix(0.7, 1.0, clamp((length(vStageWorld.xz) - 55.5) / 13.0, 0.0, 1.0));
    vec3 paint = albedo * mix(${vec(LOOK.loose.warm)}, vec3(${SAND_LIT.tint.map((x) => x.toFixed(3)).join(', ')}) * sandCrest(vStageWorld.y) * mix(${vec(SAND_LIT.lone)} * ${SAND_LIT.thin[0]!.toFixed(3)}, vec3(1.0), deep), proud);
    col = sandKnee(sandTone(paint * mix(gain, 1.0, proud), uGrainKeyCol * (vGrainSun * vGrainLook.z * side * (1.0 + ${SAND_LIT.back.toFixed(3)} * back * back)), (dome + uRigCardCol * (${SAND_LIT.card.toFixed(3)} * clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0))) * near * sandShade(vGrainSun * vGrainLook.z)) * mix(1.0, gain, proud));
    // One grain in forty of those strewn on the table turns a face to the light and glints.
    col *= mix(1.0, ${LOOK.loose.glint.lit.toFixed(2)}, step(1.5, kind));
  }
  // Light that has come through sand is the redder the less of it is left.
  if (falls > 0.5 && flies < 0.5) col *= pow(max(vec3(vGrainLit), 1e-3), ${vec(LOOK.fall.redder)}) * mix(${vec(LOOK.fall.warm)}, vec3(1.0), creamy);
  vec3 cover = vGrainCover * disc;
  if (falls > 0.5) cover *= vGrainRun * share;
  gl_FragColor = vec4(col * cover, cover.g);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, n, 0.0, c, 0.0);
}
`

export interface FallPath {
  from: [number, number, number]
  to: [number, number, number]
  seconds: number
  life: number
  slide: number
  vy: number
  rate: number
  back: boolean
  radius: number
  id: number
  phase: number
}

export const grainLens = grainUniforms.uGrainLens
export const grainFocus = grainUniforms.uGrainFocus
export const grainPx = grainUniforms.uGrainPx
export const sandDown = grainUniforms.uSandDown
export const sandGrow = grainUniforms.uSandGrow
export const sandLift = grainUniforms.uSandLift
export const sandFoot = grainUniforms.uSandFoot

export const FALL = { gravity: LOOK.fall.gravity, count: LOOK.fall.count, stand: LOOK.flow.stand, gone: LOOK.gone[1]!, pick: LOOK.flow.pick, fade: 1 / LOOK.fall.keep, lead: LOOK.fall.downMmS[0], fold: LOOK.fall.fold, turns: LOOK.fall.turns, deepTurns: LOOK.fall.deep.turns, long: LOOK.fall.long, ends: LOOK.fall.ends, deepDash: LOOK.fall.deep.dashS, shutter: (LOOK.fall.shutter * config.film.shutterDegrees) / 360 / FPS }

// The stone's flank below the lip, radius at height (assets-src/base-summer/profile.mjs, BODY).
const stoneAt = (h: number): number => {
  const b = LOOK.slope.belly
  for (let i = 0; i + 1 < b.length; i++) if (h >= b[i]![1]! && h <= b[i + 1]![1]!) return b[i]![0]! + ((b[i + 1]![0]! - b[i]![0]!) * (h - b[i]![1]!)) / (b[i + 1]![1]! - b[i]![1]!)
  return h < b[0]![1]! ? b[0]![0]! : 0
}

// The sand strewn round the heap as the camera sees it. None behind the heap, where a grain on the dark table reads as a
// grain in the air; and a run of it before the heap's near edge, thinning toward the camera, where the skin would else
// end in a line.
const before = (z: number): number => {
  const S = LOOK.loose.strewn
  const t = Math.min(1, Math.max(0, (z - S.behind[0]) / (S.behind[1] - S.behind[0])))
  return t * t * (3 - 2 * t)
}
const strewn = (x: number, z: number, reach: number): number => {
  const S = LOOK.loose.strewn
  const h = sandHeight(x, z)
  let run = 0
  if (h < S.thinMm) {
    for (const d of S.runMm) {
      if (sandHeight(x, z - d) < S.thinMm) continue
      run = S.front * Math.exp(-d / S.thins) * (1 - h / S.thinMm)
      break
    }
  }
  return before(z) * Math.max(sandStrewn(x, z, reach), run)
}
// The proud grains of the heap's thin skirt behind it are single grains on the table as well.
const proud = (x: number, z: number): number => sandProud(x, z) * (sandHeight(x, z) < LOOK.loose.strewn.skinMm ? before(z) : 1)

// A thread leaves the lip with the speed its sand has from sliding down the bank, and the threads lie side by side in
// the order of their speed, so none crosses another. The quick ones clear the belly of the stone and land on the mound.
// The slow ones meet the belly, and run down it onto the crest of the mound. A thread is a row for each of its grains:
// the rows of one thread differ in nothing but how far down the thread the grain is (`phase`), and the grains are dealt
// evenly down it, each a chance way off its place. The sheet is a few grains deep. The threads at its back come first,
// spread over its breadth but for the fringe (`span`), the one next to the stone first (`back`). Then the threads of
// its face, in bands, the band next to the stone first: the threads of a band lie side by side over `fill` of its
// breadth, each a chance way off its even place, and after them the thread that only a landing's surge runs, in what
// is left of the band. A thread's lines go down it a whole number of times in the ambient period (`rate`): those at
// the back all as often, those of the face one of three numbers each, dealt so that no two neighbours have the same
// and each number has a third of the threads. The loose grains are the last rows: each sinks at its own even speed
// along the path of a thread a little quicker than the outermost (`slide` under 0 says so).
export function fallPaths(): FallPath[] {
  const rf = stream(`${PART}/fall`)
  const F = LOOK.fall
  const S = LOOK.slope
  const out: FallPath[] = []
  const step = 0.00005
  const period = config.scene.ambientPeriodSeconds
  const ground = (x: number, z: number, radius: number): number => SLAB.liftMm + sandHeight(x, z) + radius * 0.5
  // The whole part of a seed times LOOKS is the look of the thread, and what is left of it says which share of the fall the thread belongs to.
  const seedOf = (look: number, span: readonly number[]): number => {
    const m = LOOK.flow.pick[1]! / LOOKS
    let part = 0
    for (let k = 0; k < 16; k++) {
      const v = rf.range(span[0]!, span[1]!) - look * m
      part = (v - Math.floor(v)) / m
      if (part >= F.part[0] && part < F.part[1]) break
    }
    return (look + part) / LOOKS
  }
  const thread = (q: number, look: number, span: readonly number[], dealt: number, turns: number, back = false): void => {
    const speed = F.outMmS[0] + (F.outMmS[1] - F.outMmS[0]) * q
    const az = (F.azDeg[0] + (F.azDeg[1] - F.azDeg[0]) * q) * RAD
    const h0 = F.h[0] + (F.h[1] - F.h[0]) * q
    const r0 = stoneAt(h0) + S.clearMm + F.off[0] + (F.off[1] - F.off[0]) * q
    const vy = -(F.downMmS[1] + (F.downMmS[0] - F.downMmS[1]) * q)
    const crest = S.crestMm[0]! + (S.crestMm[1]! - S.crestMm[0]!) * q
    const radius = back ? rf.range(F.deep.radiusMm[0], F.deep.radiusMm[1]) : rf.range(F.radiusMm[0], F.radiusMm[1])
    const rate = turns / (F.fold * period)
    const id = seedOf(look, span)
    const from: [number, number, number] = [r0 * Math.sin(az), h0, r0 * Math.cos(az)]
    const at = (s: number): [number, number, number] => [from[0] + speed * s * Math.sin(az), h0 + vy * s - 0.5 * F.gravity * s * s, from[2] + speed * s * Math.cos(az)]
    let done: Omit<FallPath, 'phase'> | undefined
    let grazed = false
    for (let s = step; s < 0.2 && !done; s += step) {
      const [x, h, z] = at(s)
      if (!grazed && Math.hypot(x, z) <= stoneAt(h) + S.clearMm) {
        const seconds = s - step
        const [tx, th, tz] = at(seconds)
        const slide = Math.max(crest - Math.hypot(tx, tz), 0.3)
        const to: [number, number, number] = [tx + slide * Math.sin(az), 0, tz + slide * Math.cos(az)]
        to[1] = ground(to[0], to[2], radius)
        // A thread that meets the stone where the sand lies against it does not run down it: it lands there.
        if (th - to[1] < 1) {
          grazed = true
          continue
        }
        const first = S.keeps * (F.gravity * seconds - vy)
        done = { from, to, seconds, life: seconds + (Math.sqrt(first * first + 2 * S.roll * F.gravity * (th - to[1])) - first) / (S.roll * F.gravity), slide, vy, rate, back, radius, id }
      } else if (h <= ground(x, z, radius)) {
        const [tx, , tz] = at(s - step)
        const ty = ground(tx, tz, radius)
        const exact = (vy + Math.sqrt(vy * vy + 2 * F.gravity * Math.max(h0 - ty, 0.5))) / F.gravity
        done = { from, to: [from[0] + speed * exact * Math.sin(az), ty, from[2] + speed * exact * Math.cos(az)], seconds: exact, life: exact, slide: 0, vy, rate, back, radius, id }
      }
    }
    if (!done) return
    for (let j = 0; j < dealt; j++) {
      const place = (j + rf.next()) / dealt
      for (let k = 0; k < F.fold; k++) out.push({ ...done, phase: (k + place) / F.fold })
    }
  }
  const D = F.deep
  for (let i = 0; i < D.threads; i++) thread((D.span * (i + 0.5 + rf.range(-D.stray, D.stray))) / D.threads, F.looks[(i * 5 + 2) % F.looks.length]!, i % D.every === D.every - 1 ? F.picks.surge : F.picks.stand, Math.max(1, Math.round(D.grains / F.fold)), D.turns, true)
  const rt = stream(`${PART}/fall-turns`)
  const turns: number[] = []
  while (turns.length < F.bands * F.strands) {
    const three = [...F.turns]
    for (let k = three.length - 1; k > 0; k--) {
      const j = Math.floor(rt.next() * (k + 1))
      const held = three[k]!
      three[k] = three[j]!
      three[j] = held
    }
    if (three[0] === turns[turns.length - 1]) three.push(three.shift()!)
    turns.push(...three)
  }
  for (let b = 0; b < F.bands; b++) {
    const dealt = (t: number): number => Math.max(1, Math.round(F.lines / (t * F.fold)))
    const sway = rf.range(-F.sway, F.sway)
    for (let k = 0; k < F.strands; k++) thread((b + sway + (F.fill * (k + 0.5 + rf.range(-F.stray, F.stray))) / F.strands) / F.bands, F.looks[(b * F.strands + k) % F.looks.length]!, F.picks.stand, dealt(turns[b * F.strands + k]!), turns[b * F.strands + k]!)
    // The thread of the surge lies between the last of this band and the first of the next, and goes as neither does.
    const beside = [turns[b * F.strands + F.strands - 1], turns[(b + 1) * F.strands]]
    const other = F.turns.find((t) => !beside.includes(t))!
    for (let k = 0; k < F.surge; k++) thread((b + F.fill + ((1 - F.fill) * (k + 0.5)) / F.surge) / F.bands, F.looks[(b * F.surge + k + 5) % F.looks.length]!, F.picks.surge, dealt(other), other)
  }
  const L = F.loose
  const lead = F.downMmS[0]
  for (let made = 0, tries = 0; made < L.count && tries < L.count * 50; tries++) {
    const speed = L.outMmS[0] + (L.outMmS[1] - L.outMmS[0]) * rf.next() ** L.lean
    const sink = rf.range(L.sinkMmS[0], L.sinkMmS[1])
    const az = rf.range(L.azDeg[0], L.azDeg[1]) * RAD
    const h0 = F.h[1]
    const r0 = stoneAt(h0) + S.clearMm + F.off[1] + rf.range(L.offMm[0], L.offMm[1])
    const phase = rf.next()
    const id = seedOf(Math.floor(rf.next() * LOOKS), F.picks.stand)
    const from: [number, number, number] = [r0 * Math.sin(az), h0, r0 * Math.cos(az)]
    const run = (s: number): number => (Math.sqrt(lead * lead + 2 * F.gravity * sink * s) - lead) / F.gravity
    const at = (s: number): [number, number, number] => [from[0] + speed * run(s) * Math.sin(az), h0 - sink * s, from[2] + speed * run(s) * Math.cos(az)]
    const over = (s: number): number => {
      const [x, h, z] = at(s)
      return h - ground(x, z, L.radiusMm)
    }
    let low = 0
    let high = 0
    let clear = true
    for (let s = L.stepS; s < 2 && high === 0 && clear; s += L.stepS) {
      const [x, h, z] = at(s)
      if (Math.hypot(x, z) <= stoneAt(h) + S.clearMm) clear = false
      else if (over(s) <= 0) high = s
      else low = s
    }
    if (!clear || high === 0) continue
    for (let k = 0; k < 30; k++) {
      const mid = 0.5 * (low + high)
      if (over(mid) > 0) low = mid
      else high = mid
    }
    const to = at(low)
    if (to[1] < L.floorMm) continue
    const cycles = Math.max(1, Math.min(L.most, Math.floor(period / (low + FALL.shutter + 0.002))))
    out.push({ from, to, seconds: low, life: low, slide: -1, vy: -sink, rate: cycles / period, back: false, radius: L.radiusMm, id, phase })
    made++
  }
  return out
}

/** A grain is fourteen numbers: where it lies, where it comes from, its flight and its seed. */
export const GRAIN_ROW = 14

/**
 * The file of the grains as the build makes it (tools/lib/grids.mjs), and which of a grain's numbers it holds against which:
 * where a grain comes from against where it lies, which is one place for every grain that never flies.
 */
export const GRAIN_FILE = { name: 'summer-grains', against: [null, null, null, 0, 1, 2] as readonly (number | null)[] }

/**
 * Every grain, a row each, the jumping ones first: `mark` is the first that does not jump. Working them out takes the page's
 * thread 1.6 s on a desktop, in one piece, so the build does it and the page reads the file (`prepare`).
 */
export function grainRows(): Rows {
  const total = LOOK.jump.count + LOOK.fall.count + LOOK.loose.proud.count + LOOK.loose.proud.under + LOOK.loose.dust.count + LOOK.loose.grain.count + LOOK.loose.crumb.count + LOOK.sprinkle.count
  const rows = new Float32Array(total * GRAIN_ROW)
  let n = 0
  const put = (t: readonly number[], f: readonly number[], fl: readonly number[], s: readonly number[]): void => {
    rows.set(t, n * GRAIN_ROW)
    rows.set(f, n * GRAIN_ROW + 3)
    rows.set(fl, n * GRAIN_ROW + 6)
    rows.set(s, n * GRAIN_ROW + 10)
    n++
  }

  const rj = stream(`${PART}/jump`)
  const rx = stream(`${PART}/jump-x`)
  const rz = stream(`${PART}/jump-z`)
  const J = LOOK.jump
  let made = 0
  let tries = 0
  while (made < J.count && tries < J.count * 400) {
    tries++
    const x = rx.range(LOOK.loose.x[0]!, LOOK.loose.x[1]!)
    const z = rz.range(LOOK.loose.z[0]!, LOOK.loose.z[1]!)
    const r = Math.hypot(x, z)
    if (r < 61.5) continue
    const h = sandHeight(x, z)
    const want = sandLitAt(x, z) < J.shade ? 0 : h < 0.9 ? strewn(x, z, J.reach) : J.onHeap
    if (rj.next() > want) continue
    const radius = J.radiusMm[0] + (J.radiusMm[1] - J.radiusMm[0]) * rj.next() ** 2
    const y = SLAB.liftMm + h + radius * 0.7
    const lift = J.hopMm[0] + (J.hopMm[1] - J.hopMm[0]) * rj.next() ** 2 * Math.exp(-(r - 60) / 90)
    const vy = Math.sqrt(2 * LOOK.gravity * lift)
    const drift = rj.range(0.1, 0.9)
    const turn = rj.range(-Math.PI, Math.PI)
    put([x, y, z], [x + drift * Math.sin(turn), y, z + drift * Math.cos(turn)], [rj.next() ** 1.5 * J.within, (2 * vy) / LOOK.gravity, vy, radius], [rj.next(), -1, rj.next(), rj.range(0.05, 0.5)])
    made++
  }

  // The threads of the fall that only the landing's surge runs come before the mark: once the jumping grains are gone
  // none of them has sand, and the rest draw begins after them.
  const fall = fallPaths()
  const surge = restShare()
  for (const g of fall) if (fallPick(g.phase, g.id) > surge) put(g.to, g.from, [g.back ? -g.rate : g.rate, g.seconds, g.vy, g.radius], [g.id, 1, g.phase, g.slide])
  const firstFall = n
  for (const g of fall) if (!(fallPick(g.phase, g.id) > surge)) put(g.to, g.from, [g.back ? -g.rate : g.rate, g.seconds, g.vy, g.radius], [g.id, 1, g.phase, g.slide])

  // The grains that lie where they are for good. Those that stand proud of the heap's skin, half sunk in it, so that
  // its outline is grains; and those strewn round it: dust close in, grains, and a few coarse crumbs, fewer with the distance.
  const rl = stream(`${PART}/loose`)
  const O = LOOK.loose
  const lie = (count: number, kind: number, want: (x: number, z: number) => number, size: (pick: number) => number, sunk: number, under = false, from = rl, most = count * 600): number => {
    let k = 0
    for (let laid = 0; laid < count && k < most; k++) {
      const x = from.range(O.x[0]!, O.x[1]!)
      const z = from.range(O.z[0]!, O.z[1]!)
      const keep = from.next()
      const pick = from.next()
      const id = from.next()
      const phase = from.next()
      const r = Math.hypot(x, z)
      if (r < 61.5 !== under || r < SLAB.footMm || keep > want(x, z)) continue
      const radius = size(pick) * (kind < 0 ? O.proud.thin + (1 - O.proud.thin) * sandDeep(x, z) : 1)
      const at = [x, SLAB.liftMm + sandHeight(x, z) + radius * (1 - sunk), z]
      put(at, at, [sandLitAt(x, z), 0, 0, radius], [id, 2, phase, kind === 0 && (id * 977 + phase * 131) % 1 < 1 / O.glint.one ? 2 : kind < 0 ? O.kind.proud[0]! + O.kind.proud[1]! * sandDeep(x, z) : kind])
      laid++
    }
    return k
  }
  const proudSize = (pick: number): number => (pick < O.proud.small ? O.proud.radiusMm[0]! + (O.proud.radiusMm[1]! - O.proud.radiusMm[0]!) * (pick / O.proud.small) : O.proud.radiusMm[1]! + (O.proud.radiusMm[2]! - O.proud.radiusMm[1]!) * ((pick - O.proud.small) / (1 - O.proud.small)) ** O.proud.lean)
  const tried = lie(O.proud.count, -1, proud, proudSize, O.proud.sunk)
  lie(O.dust.count, 0.2, (x, z) => strewn(x, z, O.dust.reach), (pick) => O.dust.radiusMm[0]! + (O.dust.radiusMm[1]! - O.dust.radiusMm[0]!) * pick, 0.3)
  lie(O.grain.count, 0, (x, z) => strewn(x, z, O.grain.reach), (pick) => O.grain.radiusMm[0]! + (O.grain.radiusMm[1]! - O.grain.radiusMm[0]!) * pick ** O.grain.lean, 0.3)
  lie(O.crumb.count, 0.1, (x, z) => strewn(x, z, O.crumb.reach), (pick) => O.crumb.radiusMm[0]! + (O.crumb.radiusMm[1]! - O.crumb.radiusMm[0]!) * pick ** O.crumb.lean, 0.3)
  // The heap's sand under the belly of the stone, as thick with proud grains as the rest: out of sight while the globe
  // stands, and the heap's outline on that side when it is lifted. None inside the foot's own circle: the sand there
  // slides into the print as the foot leaves (slab.ts), and a grain laid at the heap's height would hang over it.
  lie(O.proud.under, -1, sandProud, proudSize, O.proud.sunk, true, stream(`${PART}/loose-under`), tried)
  // The sprinkle beside the foot on the left (slab.ts): single grains, laid where they are for good.
  const rs = stream(`${PART}/sprinkle`)
  const ra = stream(`${PART}/sprinkle-along`)
  const rd = stream(`${PART}/sprinkle-across`)
  const K = LOOK.sprinkle
  // Most of them lie in the core, a strip along the edge of the base's shadow; a few lie far out and glint.
  for (let k = 0, laid = 0; laid < K.count && k < K.count * 400; k++) {
    const core = laid < K.count * K.core.share
    const glint = !core && laid >= K.count - K.glints.count
    const along = ra.range(K.s[0]!, K.s[1]!)
    const pick = rd.next()
    const keep = rs.next()
    const size = rs.next() ** 2
    const span = glint ? K.glints.mm : core ? K.core.size : K.mm
    const radius = span[0]! + (span[1]! - span[0]!) * size
    const id = rs.next()
    const phase = rs.next()
    const d = core ? -Math.log(Math.max(pick, 1e-6)) * K.core.mm * (laid % 3 === 0 ? K.core.wide : 1) - SPRINKLE.softMm * phase : glint ? K.glints.d[0]! + (K.glints.d[1]! - K.glints.d[0]!) * pick : K.d[0]! + (K.d[1]! - K.d[0]!) * pick
    const [x, z] = sandSprinkleAt(along, d)
    if (Math.hypot(x, z) < 61.5 || keep > (core || glint ? sandSprinkleRun(x, z) : sandSprinkle(x, z))) continue
    const at = [x, SLAB.liftMm + radius * 0.7, z]
    put(at, at, [0, 0, 0, radius], [id, 2, phase, core ? 0.5 : glint ? 1 : 0])
    laid++
  }
  return { width: GRAIN_ROW, mark: firstFall, data: rows.subarray(0, n * GRAIN_ROW) }
}

let baked: Rows | null = null

/** How many grains are put into the card's lists before the making stops for a frame: as many as have a ROW of corners four times over. */
const LOT = ROW * 4

// The lists are filled a lot of grains at a time, with a place to stop after each (src/scene/steps.ts): filled in one
// piece, sixty thousand grains held the page's thread for longer than any step of a miniature does.
function* grainGeometry(): Generator<void, THREE.BufferGeometry> {
  const { data, mark: firstFall } = baked ?? grainRows()
  const n = data.length / GRAIN_ROW
  const to = new Float32Array(n * 12)
  const from = new Float32Array(n * 12)
  const flight = new Float32Array(n * 16)
  const seed = new Float32Array(n * 16)
  const corner = new Float32Array(n * 8)
  const index = new Uint32Array(n * 6)
  const fill = (first: number, end: number): void => {
    for (let q = first; q < end; q++) {
      const r = q * GRAIN_ROW
      for (let k = 0; k < 4; k++) {
        const o = q * 4 + k
        for (let i = 0; i < 3; i++) {
          to[o * 3 + i] = data[r + i]!
          from[o * 3 + i] = data[r + 3 + i]!
        }
        for (let i = 0; i < 4; i++) {
          flight[o * 4 + i] = data[r + 6 + i]!
          seed[o * 4 + i] = data[r + 10 + i]!
        }
        corner[o * 2] = k % 2 === 0 ? -1 : 1
        corner[o * 2 + 1] = k < 2 ? -1 : 1
      }
    }
  }
  for (let q = 0; q < n; q += LOT) {
    fill(q, Math.min(q + LOT, n))
    yield
  }
  let firstSurge = firstFall
  while (firstSurge > 0 && data[(firstSurge - 1) * GRAIN_ROW + 11] === 1) firstSurge--
  let firstLie = firstFall
  while (firstLie < n && data[firstLie * GRAIN_ROW + 11] === 1) firstLie++
  let firstFace = firstSurge
  while (firstFace < firstFall && data[firstFace * GRAIN_ROW + 6]! < 0) firstFace++
  const behind = firstFace - firstSurge
  let firstStand = firstFall
  while (firstStand < firstLie && data[firstStand * GRAIN_ROW + 6]! < 0) firstStand++
  let firstLoose = firstStand
  while (firstLoose < firstLie && !(data[firstLoose * GRAIN_ROW + 13]! < 0)) firstLoose++

  // The grains that lie are first in the list and then the fall, so that at rest they alone are drawn; then the threads
  // only the surge runs, then the jumping grains. The grains that lie and those that jump are shuffled. The fall is
  // drawn in the order of its rows, thread by thread from the stone outward: the outer threads lie over the inner.
  function* order(first: number, count: number, at: number, stride: number): Generator<void, void> {
    const lot = (k0: number, end: number): void => {
      for (let k = k0; k < end; k++) {
        const q = first + ((k * stride) % count)
        index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], (at + k) * 6)
      }
    }
    for (let k = 0; k < count; k += LOT) {
      lot(k, Math.min(k + LOT, count))
      yield
    }
  }
  // The lines of the face are drawn the dark ones first, as the shader tones them: a pale line is whole wherever it lies.
  function* paler(first: number, count: number, at: number): Generator<void, void> {
    const dice = (q: number): number => {
      const v = Math.fround(data[q * GRAIN_ROW + 12]! * 977)
      return v - Math.floor(v)
    }
    const rows = Array.from({ length: count }, (_, k) => first + k).sort((a, b) => dice(a) - dice(b) || a - b)
    for (let k = 0; k < count; k++) {
      const q = rows[k]!
      index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], (at + k) * 6)
    }
    yield
  }
  yield* order(firstLie, n - firstLie, 0, LOOK.stride)
  yield* order(firstSurge, behind, n - firstLie, 1)
  yield* order(firstFall, firstStand - firstFall, n - firstLie + behind, 1)
  yield* paler(firstStand, firstLoose - firstStand, n - firstLie + behind + firstStand - firstFall)
  yield* order(firstLoose, firstLie - firstLoose, n - firstLie + behind + firstLoose - firstFall, 1)
  yield* paler(firstFace, firstFall - firstFace, n - firstFall + behind)
  yield* order(0, firstSurge, n - firstSurge, LOOK.stride)
  // Said after the last stop, so that no other making of the grains stands between the saying and the reading (`grains`).
  still = n - firstFall + behind
  aloft = n - firstSurge
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(to, 3))
  g.setAttribute('aFrom', new THREE.BufferAttribute(from, 3))
  g.setAttribute('aFlight', new THREE.BufferAttribute(flight, 4))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2))
  g.setIndex(new THREE.BufferAttribute(index, 1))
  return g
}

let still = 0
let aloft = 0

// Which share of the fall a thread belongs to, as the shader reads it, and the largest share that still runs when the
// jumping grains are gone and the rest draw begins. The shader reads it in single precision, hence the slack.
export const fallPick = (phase: number, id: number): number => {
  const v = phase * LOOK.flow.pick[0]! + id * LOOK.flow.pick[1]!
  return v - Math.floor(v)
}
export const restShare = (): number => fallShare(LOOK.gone[1]!) + LOOK.flow.slack

export function fallShare(sinceLoose: number): number {
  const F = LOOK.flow
  if (sinceLoose < 0) return 0
  if (!(sinceLoose < Infinity)) return F.stand
  return F.stand + (1 - F.stand) * Math.exp(-sinceLoose / F.seconds)
}

/**
 * The grains as the build made them, where the page can have them. A page with no such file, or with one that is no file
 * of grains, works them out itself as it always did: the file holds the same numbers to the bit and nothing else.
 */
export async function prepare(): Promise<void> {
  if (baked || typeof document === 'undefined') return
  try {
    const r = await fetch(new URL(rowsAddress(GRAIN_FILE.name, __ENGINE_HASH__), document.baseURI))
    if (!r.ok || !r.body) return
    const rows = await readRows(r.body)
    if (rows.width === GRAIN_ROW && rows.mark * GRAIN_ROW <= rows.data.length) baked = rows
  } catch {
    baked = null
  }
}

// The grains lie on the slab and fall past the foot, outside the glass, so they are drawn with the surface dressing (slab.ts
// adds them to its group); nothing of this arrival is inside the globe.
export const grains = inSteps(function* (): Generator<void, THREE.Mesh> {
  const m = stageShader({ part: PART, standIn: false, change: 'surface-dressing', vertexPars: VERT_PARS, vertexMain: VERT_MAIN, fragment: fragment(), uniforms: grainUniforms, params: { side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } })
  const mesh = new THREE.Mesh(yield* grainGeometry(), m)
  mesh.frustumCulled = false
  const whole = mesh.geometry.index!.count / 6
  const fall = still
  const flying = aloft
  mesh.onBeforeRender = () => {
    const share = LOOK.share[meshLevel()] ?? 1
    grainUniforms.uGrainLevel.value = share
    const drawn = mesh.matrixWorld.determinant() < 0 ? 0 : grainUniforms.uGrain.value.y < 1 ? flying + Math.floor((whole - flying) * share) : fall
    mesh.geometry.setDrawRange(0, 6 * drawn)
  }
  mesh.onAfterRender = () => {
    mesh.geometry.setDrawRange(0, Infinity)
  }
  return mesh
})

export function arrival(): THREE.Object3D {
  return new THREE.Group()
}

const sinceDown = (moment: KitMoment): number => {
  const t = sinceLoose(moment)
  const fps = (config.film as { fps: number }).fps
  const open = moment.frame.sample === null ? moment.time : Math.floor(moment.time * fps + 0.25) / fps
  return t >= 0 && t < Infinity ? Math.max(0, t - (moment.time - open)) : t
}

// Nothing of the sand lies on the table before the foot is down. From the contact the heap, the fall and the strewn
// grains grow from nothing, quickest at first, and are whole some twenty frames on.
export function sandGrown(moment: KitMoment): number {
  const at = sinceDown(moment)
  if (at < 0) return 0
  if (!(at < Infinity)) return 1
  const s = Math.min(1, (at * (config.film as { fps: number }).fps) / LOOK.grow.frames)
  return s * (2 - s)
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  const u = grainUniforms
  const film = config.film as { fps: number; shutterDegrees: number }
  const shutter = film.shutterDegrees / 360 / film.fps
  const open = f.sample === null ? moment.time : Math.floor(moment.time * film.fps + 0.25) / film.fps
  const at = sinceDown(moment)
  const grown = sandGrown(moment)
  u.uSandGrow.value = grown
  u.uSandFoot.value.set(f.globe.x, f.globe.z)
  const down = 1 - Math.min(1, Math.max(0, (rimGapMm(f.globe) - LOOK.flow.gapMm[0]) / (LOOK.flow.gapMm[1] - LOOK.flow.gapMm[0])))
  const out = Math.min(1, Math.max(0, (at - LOOK.gone[0]!) / (LOOK.gone[1]! - LOOK.gone[0]!)))
  const gone = at < 0 || !(at < Infinity) ? 1 : out * out * (3 - 2 * out)
  const lifted = Math.min(1, Math.max(0, (rimGapMm(f.globe) - LOOK.flow.shadeMm[0]) / (LOOK.flow.shadeMm[1] - LOOK.flow.shadeMm[0])))
  u.uSandDown.value = 1 - lifted * lifted * (3 - 2 * lifted)
  // The time since the foot left the table is told by the beat of the shake. Sand left on a table stays on it; no sand
  // leaves the ledge after the lift, what is in the air then falls to the heap, and the stream does not start again
  // while the globe is in the air.
  const lifting = moment.beat !== null && moment.arrived >= 0.5 && at >= 0
  u.uSandLift.value = lifting ? (moment.beat! * 60) / (config.film as unknown as { defaultBpm: number }).defaultBpm : -1
  u.uGrain.value.set(at < 0 ? -1 : Math.min(at, 50), gone, lifting ? 1 : down, shutter * LOOK.exposure)
  u.uGrainFine.value = f.sample === null ? LOOK.fall.finePx : 0
  u.uGrainLoop.value.set((((open / moment.period) % 1) + 1) % 1, moment.period)
  u.uGrainPx.value = f.focalPx
  u.uGrainFocus.value.set(f.lensOn ? f.pose.apertureMm : 0, 1 / f.pose.focusMm)
  u.uGrainShift.value.set(f.sample ? f.sample.lu * f.pose.apertureMm : 0, f.sample ? f.sample.lv * f.pose.apertureMm : 0)
  u.uGrainLens.value.set(f.width / 2, f.height / 2, (grade.fringePx * Math.min(f.width, f.height)) / LOOK.lens.rows, grade.fringePower)
  u.uGrainKey.value.copy(f.keyDir)
  u.uGrainKeyCol.value.copy(f.keyCol)
  u.uGrainSky.value.copy(f.sky).multiplyScalar(f.fill)
  u.uGrainGround.value.copy(f.ground).multiplyScalar(f.fill)
}
