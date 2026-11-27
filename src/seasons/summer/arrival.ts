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
// is what lies there. Nothing but the fall leaves the ledge, and no grain rises above it. `fall` grains are the sand
// that runs over the rim of the right shoulder and down the flank onto the mound: the landing starts it with a surge,
// and it runs on as a thin standing fall for as long as the globe stands on the table. A grain leaves the rim with the
// speed it has from sliding down the bank; the quick ones clear the belly of the stone, the rest run down it. Every
// grain's place is a function of the time since the landing and of the clock, nothing is kept from frame to frame. The
// mirror of the slab gets none of the grains; medium and low draw a share.
//
// A falling grain is drawn as a camera with a quick shutter sees it: as the short line it travels in that time. Each
// hides what is behind it, the dark grains too, so the fall is single lit grains with dark between them and not a
// veil. The side toward the stone is in the fall's own shade: there most grains are dark and the lit ones stand as
// single threads. The line is the same in every sample of one picture: drawn from a few samples it would be a row of dashes.
const LOOK = {
  gravity: 3400,
  lift: { stop: 0.25, share: 0.6, nearMm: [61.5, 69.0], late: 0.4, upMmS: [70, 170], inMm: 1.1 },
  jump: { count: 8600, shade: 0.3, reach: 0.2, onHeap: 0.1, hopMm: [0.15, 1.0], within: 0.05, radiusMm: [0.04, 0.1] },
  fall: { count: 5500, gravity: 7000, az: 90, spread: 2.5, most: 2.0, off: [0.9, 1.7], h: [38.7, 39.8], outMmS: [72, 150], lean: 1.7, fliers: { share: 0.012, far: [1.12, 1.22], brief: 0.15, size: 1.5, solid: 0.9, lit: 1.3 }, fanDeg: 1.5, downMmS: [10, 40], rate: [5.0, 6.7], radiusMm: [0.035, 0.085], fine: 2.5, core: [0.5, 85, 135], edge: [120, 150, 0.0], thinPx: 0.3, sizes: [1.0, 1.5], soft: { share: 0, wide: 2.2 }, shutter: 0.15, cover: 40, rise: 0.012, low: [0.085, 0.038, 0.017], shine: [0.25, 0.39], dim: [0.7, 0.84], pale: 0.3, plain: 0.4, least: [0.0, 0.01], bright: [0.75, 1.0], lit: 1.3, shaded: 0.08, mist: { seconds: 0.07, outMmS: [5, 40], upMmS: [5, 45], cover: 0.012, mm: [0.25, 0.5], turn: 0.45 } },
  loose: { x: [16, 136], z: [-70, 112], kind: { proud: [0.26, 0.08] }, thinPx: 0.3, round: [-0.3, 0.6, 1.4], glint: { one: 40, lit: 2.2 }, squash: [1.0, 2.4], bend: 0.7, proud: { count: 9000, under: 3500, radiusMm: [0.07, 0.17, 0.45], small: 0.6, lean: 1.6, thin: 0.45, sunk: 0.3, vary: [0.6, 1.2], apart: 0.3 }, dust: { count: 12400, radiusMm: [0.03, 0.07], reach: 0.13, cover: 0.6 }, grain: { count: 2600, radiusMm: [0.05, 0.1], lean: 1.4, reach: 0.15 }, crumb: { count: 40, radiusMm: [0.12, 0.17], lean: 1.6, reach: 0.35 }, strewn: { behind: [3, 17], thinMm: 0.6, runMm: [0.5, 1, 2, 3, 5, 7, 10, 14], thins: 5, front: 0.1, skinMm: 1.2 }, vary: [0.1, 0.42], warm: [1.0, 0.8, 0.56] },
  sprinkle: { count: 0, thinPx: 0.85, vary: [0.4, 1.15], warm: [1.0, 0.84, 0.64], s: [-12, 78], d: [-0.4, 16], mm: [0.07, 0.18], core: { share: 0.7, mm: 3.0, wide: 2.4, lit: 0.85, size: [0.08, 0.2] }, glints: { count: 46, d: [13, 46], mm: [0.16, 0.34], lit: 2.6 } },
  lens: { rows: 1080, most: 4, flyPx: 0.5, round: [1.6, 4.0], clear: 6 },
  slope: { clearMm: 0.25, keeps: 0.75, roll: 0.5, bulge: 0.0038, crestMm: [60.6, 66], crestLean: 1.6, offMm: [0.12, 0.55], belly: [[60.3, 8], [60.3, 11.2], [59.7, 14.6], [58.6, 18], [57.3, 21.2], [55.8, 24.4], [54.3, 27.4], [53, 30.5], [52.9, 32.4], [52.6, 34.3], [52, 36], [51.2, 37.5], [50.2, 38.8], [49.2, 39.9]] },
  flow: { stand: 0.8, seconds: 1.6, gapMm: [0.3, 2.5], shadeMm: [0.5, 60], pick: [61.3, 17.7], slack: 0.001 },
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

const vec = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`

const grainUniforms = {
  uGrain: { value: new THREE.Vector4(50, 0, 0, 1 / 120) },
  uGrainLoop: { value: new THREE.Vector2(0, 12) },
  uGrainLevel: { value: 1 },
  uGrainPx: { value: 1000 },
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
vec3 grainPath(float tau) {
  if (aSeed.y > 1.5) return position;
  float GRAVITY = aSeed.y > 0.5 ? ${LOOK.fall.gravity.toFixed(1)} : ${LOOK.gravity.toFixed(1)};
  float T = aFlight.y;
  float vy = aFlight.z;
  vec3 to = position;
  vec2 way = to.xz - aFrom.xz;
  vec2 dir = (dot(way, way) > 0.0 ? normalize(way) : vec2(1.0, 0.0));
  float skid = aSeed.w;
  vec2 touch = to.xz - dir * skid;
  if (tau < T) {
    vec3 p;
    p.xz = mix(aFrom.xz, touch, tau / T);
    p.y = aFrom.y + vy * tau - 0.5 * GRAVITY * tau * tau;
    return p;
  }
  if (aSeed.y > 0.5) {
    float touchY = aFrom.y + vy * T - 0.5 * GRAVITY * T * T;
    vec3 roll = fallRoll();
    float after = min(tau - T, roll.x);
    float s = clamp((roll.y * after + ${(0.5 * LOOK.slope.roll * LOOK.fall.gravity).toFixed(1)} * after * after) / max(roll.z, 1e-4), 0.0, 1.0);
    float off = sin(3.14159 * s) * (${LOOK.slope.bulge.toFixed(4)} * roll.z * roll.z + mix(${LOOK.slope.offMm[0].toFixed(2)}, ${LOOK.slope.offMm[1].toFixed(2)}, abs(sin(s * 7.0 + aSeed.z * 40.0))));
    return vec3(mix(touch, to.xz, s) + dir * off, mix(touchY, to.y, s)).xzy;
  }
  float after = tau - T;
  float hop = skid * 0.45 * abs(sin(after * 38.0)) * exp(-after * 16.0);
  return vec3(to.xz - dir * skid * exp(-after * 13.0), to.y + hop).xzy;
}
`

const VERT_MAIN = `
float grainT = uGrain.x;
float tau;
float alive = 1.0;
float airborne = 0.0;
float puff = -1.0;
float grown = 1.0;
float fallLife = 0.0;
if (aSeed.y < -0.5) {
  tau = max(grainT - aFlight.x, 0.0);
} else if (aSeed.y < 0.5) {
  tau = grainT - aFlight.x;
  if (grainT < 0.0 || tau < 0.0) alive = 0.0;
} else if (aSeed.y < 1.5) {
  float cycles = max(1.0, floor(uGrainLoop.y * aFlight.x + 0.5));
  float life = aFlight.y + fallSlide();
  fallLife = life;
  float spare = max(min(${LOOK.fall.mist.seconds.toFixed(3)}, uGrainLoop.y / cycles - life), 0.0);
  tau = fract(uGrainLoop.x * cycles + aSeed.z) * (uGrainLoop.y / cycles);
  if (grainT < 0.0 || tau > grainT || tau >= life + spare || fract(aSeed.z * ${LOOK.flow.pick[0]!.toFixed(1)} + aSeed.x * ${LOOK.flow.pick[1]!.toFixed(1)}) > uGrain.z || fract(aSeed.z * 23.9 + 0.37) > uGrainLevel) alive = 0.0;
  if (tau > life) puff = (tau - life) / max(spare, 1e-4);
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
// A falling grain is in the picture from the place it has when its quick shutter opens to the place it has when it shuts,
// or to where it lands if that is sooner.
float outward = (length(position.xz - aFrom.xz) - aSeed.w) / max(aFlight.y, 1e-3);
float flier = smoothstep(${(LOOK.fall.outMmS[1] * 1.02).toFixed(1)}, ${(LOOK.fall.outMmS[1] * 1.1).toFixed(1)}, outward);
float shut = uGrain.w * ${(LOOK.fall.shutter / LOOK.exposure).toFixed(4)} * mix(1.0, ${LOOK.fall.fliers.brief.toFixed(2)}, flier);
float until = falls > 0.5 ? min(tau + shut, max(fallLife, tau)) : tau;
float seen = falls > 0.5 ? clamp((until - tau) / max(shut, 1e-5), 0.0, 1.0) : 1.0;
vec3 nowAt = grainPath(until);
vec3 thenAt = grainPath(falls > 0.5 ? tau : max(tau - uGrain.w, 0.0));
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
// Where a falling grain lands it knocks a little dust off the mound: for a moment after its fall the grain is that dust,
// a wide faint mote that drifts up and out slowly enough to be followed, and the many of them are a still mist.
if (puff >= 0.0) {
  float s = tau - fallLife;
  float turn = 6.2832 * fract(aSeed.x * 71.3 + aSeed.z * 3.7);
  vec2 out2 = (dot(position.xz, position.xz) > 0.0 ? normalize(position.xz) : vec2(1.0, 0.0)) + vec2(sin(turn), cos(turn)) * ${LOOK.fall.mist.turn.toFixed(2)};
  float outS = mix(${LOOK.fall.mist.outMmS[0].toFixed(1)}, ${LOOK.fall.mist.outMmS[1].toFixed(1)}, fract(aSeed.x * 13.9 + 0.21));
  float upS = mix(${LOOK.fall.mist.upMmS[0].toFixed(1)}, ${LOOK.fall.mist.upMmS[1].toFixed(1)}, fract(aSeed.z * 37.1 + aSeed.x * 5.3));
  nowAt = position + vec3(out2.x * outS * s, upS * s, out2.y * outS * s);
  thenAt = nowAt;
}
airborne = (tau < aFlight.y && lies < 0.5) || falls > 0.5 ? 1.0 : 0.0;
vec4 nowV = viewMatrix * modelMatrix * vec4(nowAt, 1.0);
vec4 thenV = viewMatrix * modelMatrix * vec4(thenAt, 1.0);
float size = aFlight.w * alive;
vec2 along = nowV.xy - thenV.xy;
float len = length(along);
vec2 axis = len > 1e-4 ? along / len : vec2(0.0, 1.0);
vec2 across = vec2(-axis.y, axis.x);
float blur = min(len, ${LOOK.blurRadii.toFixed(2)} * aFlight.w);
float thinner = 1.0;
float soft = 0.0;
// A falling grain is finer than a pixel. It is drawn as the short line it leaves while the shutter is open, never thinner
// than a pixel can show; only the finest grains on the longest lines are fainter for it. The few that fly clear of the
// fall are single bright dots.
if (falls > 0.5) {
  float least = ${LOOK.fall.thinPx.toFixed(2)} * max(-nowV.z, 1.0) / uGrainPx;
  float softly = step(${(1 - LOOK.fall.soft.share).toFixed(2)}, fract(aSeed.x * 37.3 + aSeed.z * 11.9));
  float larger = fract(aSeed.x * 7.7 + aSeed.z * 29.3);
  float grow = mix(mix(${LOOK.fall.sizes[0]!.toFixed(2)}, ${LOOK.fall.sizes[1]!.toFixed(2)}, larger * larger * larger), ${LOOK.fall.soft.wide.toFixed(2)}, softly) * mix(1.0, ${LOOK.fall.fliers.size.toFixed(2)}, flier);
  size = max(aFlight.w, least) * grow * alive;
  blur = len;
  float fine = aFlight.w / max(size, 1e-5);
  thinner = seen * fine * fine / (1.0 + 0.637 * len / max(size, 1e-5));
  if (puff >= 0.0) {
    size = mix(${LOOK.fall.mist.mm[0].toFixed(2)}, ${LOOK.fall.mist.mm[1].toFixed(2)}, fract(aSeed.x * 3.3 + aSeed.z * 19.1)) * alive;
    blur = 0.0;
  }
}
if (falls < 0.5) {
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
}
vec4 grainV = nowV;
grainV.xy -= axis * (blur * (0.5 - 0.5 * aCorner.y));
float streak = 1.0 + blur / max(2.0 * size, 1e-4);
// The lens parts red from blue toward the frame's edge (post.ts). The grain is drawn that much wider, and its fragment
// lays its red and blue where the lens will bring them back onto its green.
float pad = 1.0 + min(1.5 * (1.0 + floor(uGrainLens.z)) * max(-nowV.z, 1.0) / max(size * uGrainPx, 1e-3), ${LOOK.lens.most.toFixed(1)});
// A grain at rest stands on the sand with the whole of what is drawn of it, and the table does not cut the margin its
// colours are laid in: a cut edge is a hard edge, and the lens gives every hard edge a blue line.
if (falls < 0.5) grainV.y += (1.0 - airborne) * max(size - soft - aFlight.w, 0.0);
grainV.xy += (axis * aCorner.y + across * aCorner.x) * (size * pad);
gl_Position = projectionMatrix * grainV;
if (falls < 0.5) {
  vec4 grainNear = projectionMatrix * vec4(grainV.xy, grainV.z + ${LOOK.lens.clear.toFixed(1)} * size * pad, 1.0);
  gl_Position.z = grainNear.z / grainNear.w * gl_Position.w;
}
vec4 grainW = modelMatrix * vec4(nowAt, 1.0);
vStageWorld = grainW.xyz;
vStageLocal = (uGlobeInv * grainW).xyz;
vStageAux = vec3(0.0, -grainV.z, length(grainV.xyz));
vStagePlaced = grainW.xyz;
vStageSeen = 1.0;
vGrainUv = aCorner * vec2(pad, 1.0 + (pad - 1.0) / streak);
vGrainShape = vec3(streak, airborne, falls + 2.0 * lies);
vGrainSoft = soft / max(size, 1e-5);
vGrainCover = (aSeed.y > 0.5 ? 1.0 : 1.0 - uGrain.y) * min(1.0, ${LOOK.streak.toFixed(2)} / streak) * min(1.0, thinner);
if (falls > 0.5) {
  float glint = fract(aSeed.x * 53.7 + aSeed.z * 7.1);
  glint *= glint * glint;
  float bright = mix(${LOOK.fall.bright[0].toFixed(2)}, 1.0, glint * glint);
  vGrainCover = mix(min(1.0, ${LOOK.fall.cover.toFixed(2)} * bright * thinner), ${LOOK.fall.fliers.solid.toFixed(2)} * seen, flier);
  vGrainCover *= smoothstep(0.0, ${LOOK.fall.rise.toFixed(3)}, tau);
  // The quickest grains fly farthest out and are few: they are a little fainter, and the fall's outer edge is single grains and no line.
  vGrainCover *= 1.0 - ${LOOK.fall.edge[2]!.toFixed(2)} * smoothstep(${LOOK.fall.edge[0]!.toFixed(1)}, ${LOOK.fall.edge[1]!.toFixed(1)}, outward);
  if (puff >= 0.0) vGrainCover = ${LOOK.fall.mist.cover.toFixed(3)} * 4.0 * puff * (1.0 - puff);
}
if (lies > 0.5) vGrainCover = min(1.0, thinner) * mix(1.0, ${LOOK.loose.dust.cover.toFixed(2)}, step(0.15, aSeed.w) * step(aSeed.w, 0.25));
vGrainCover *= grown;
vGrainLit = lies > 0.5 ? 1.0 + aSeed.w : falls > 0.5 ? mix(${LOOK.fall.core[0].toFixed(2)}, 1.0, smoothstep(${LOOK.fall.core[1].toFixed(1)}, ${LOOK.fall.core[2].toFixed(1)}, outward)) + 2.0 * flier : 1.0;
float sunlit = mix(1.0, sandBaseShade(grainW.xyz - vec3(uSandFoot.x, 0.0, uSandFoot.y), uGrainKey), uSandDown);
vGrainSun = lies > 0.5 ? aFlight.x : 1.0;
// A falling grain in the shade of the stone is as dark as the stone behind it and is all but lost against it.
if (falls > 0.5) vGrainCover *= mix(${LOOK.fall.shaded.toFixed(2)}, 1.0, sunlit);
vGrainLook = vec4(aSeed.x, fract(aSeed.x * 91.7 + aSeed.z * 13.1), sunlit, alive);
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
uniform vec4 uGrainLens;
${SAND_GLSL}
mat2 grainTurn = mat2(1.0, 0.0, 0.0, 1.0);
vec2 grainCrumb = vec2(1.0, 0.0);
float grainDisc(vec2 at, float L) {
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
  float falls = vGrainShape.z > 0.5 && vGrainShape.z < 1.5 ? 1.0 : 0.0;
  // A grain a pixel or two wide has no lit side and shaded side to show: each would be a rim of its own colour. It is lit as one.
  // What counts is the grain's own width, not the width of the disc the lens makes of it.
  float round = max(falls, smoothstep(${LOOK.lens.round[0]!.toFixed(1)}, ${LOOK.lens.round[1]!.toFixed(1)}, (1.0 - vGrainSoft) * inversesqrt(max(lensX.x * lensX.x + lensY.x * lensY.x, 1e-8)) * ${(LOOK.lens.rows / 2).toFixed(1)} / min(uGrainLens.x, uGrainLens.y)));
  round *= 1.0 - vGrainSoft;
  n = normalize(mix(normalize(uGrainKey + v + vec3(0.0, 1.0, 0.0)), n, round));
  float id = vGrainLook.x;
  float id2 = vGrainLook.y;
  vec3 albedo = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, smoothstep(0.1, 0.75, id));
  // The dark between the fall's lit grains is its own (the low grains, below), not the dark sand's.
  albedo = mix(albedo, ${vec(SAND_COLOUR.dark)}, step(0.93, id2) * (1.0 - falls));
  float flies = falls * step(2.0, vGrainLit);
  float white = max(step(id2, mix(0.12, ${LOOK.fall.pale.toFixed(2)}, falls)), flies);
  albedo = mix(albedo, ${vec(SAND_COLOUR.white)}, white);
  float shade = mix(0.25, 1.0, vGrainLook.z) * mix(vGrainLit, ${LOOK.fall.fliers.lit.toFixed(2)}, flies) * mix(1.0, ${LOOK.fall.lit.toFixed(2)}, falls);
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
  vec3 cover = vGrainCover * disc;
  if (falls > 0.5) {
    float inner = 1.0 - clamp((vGrainLit - ${LOOK.fall.core[0].toFixed(2)}) / ${(1 - LOOK.fall.core[0]).toFixed(2)}, 0.0, 1.0);
    col *= mix(${vec(LOOK.fall.low)}, vec3(1.0), max(flies, smoothstep(mix(${LOOK.fall.shine[0]!.toFixed(2)}, ${LOOK.fall.dim[0]!.toFixed(2)}, inner), mix(${LOOK.fall.shine[1]!.toFixed(2)}, ${LOOK.fall.dim[1]!.toFixed(2)}, inner), fract(id * 43.7 + id2 * 5.3))));
    cover *= smoothstep(${LOOK.fall.least[0]!.toFixed(2)}, ${LOOK.fall.least[1]!.toFixed(2)}, dot(col, vec3(0.2126, 0.7152, 0.0722)));
  }
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

export const FALL = { gravity: LOOK.fall.gravity, count: LOOK.fall.count, stand: LOOK.flow.stand, gone: LOOK.gone[1]!, pick: LOOK.flow.pick }

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

// A grain leaves the lip with the speed it has from sliding down the bank. The quick ones clear the belly of the stone
// and land on the mound. The slow ones meet the belly, and tumble down it onto the crest of the mound.
export function fallPaths(): FallPath[] {
  const rf = stream(`${PART}/fall`)
  const F = LOOK.fall
  const S = LOOK.slope
  const out: FallPath[] = []
  const step = 0.0005
  let tries = 0
  while (out.length < F.count && tries++ < F.count * 50) {
    const az0 = (F.az + Math.max(-F.most, Math.min(F.most, rf.gauss())) * F.spread) * RAD
    const az1 = az0 + Math.max(-F.most, Math.min(F.most, rf.gauss())) * F.fanDeg * RAD
    const flier = rf.next()
    const run = F.outMmS[0] + (F.outMmS[1] - F.outMmS[0]) * rf.next() ** F.lean
    const speed = flier < F.fliers.share ? F.outMmS[1] * (F.fliers.far[0]! + (F.fliers.far[1]! - F.fliers.far[0]!) * (flier / F.fliers.share)) : run
    const h0 = rf.range(F.h[0], F.h[1])
    const r0 = stoneAt(h0) + S.clearMm + rf.range(F.off[0], F.off[1])
    const radius = F.radiusMm[0] + (F.radiusMm[1] - F.radiusMm[0]) * rf.next() ** F.fine
    const vy = -rf.range(F.downMmS[0], F.downMmS[1])
    const rate = rf.range(F.rate[0], F.rate[1])
    const id = rf.next()
    const phase = rf.next()
    const crest = S.crestMm[0]! + (S.crestMm[1]! - S.crestMm[0]!) * rf.next() ** S.crestLean
    const from: [number, number, number] = [r0 * Math.sin(az0), h0, r0 * Math.cos(az0)]
    const at = (s: number): [number, number, number] => [from[0] + speed * s * Math.sin(az1), h0 + vy * s - 0.5 * F.gravity * s * s, from[2] + speed * s * Math.cos(az1)]
    const ground = (x: number, z: number): number => SLAB.liftMm + sandHeight(x, z) + radius * 0.5
    let done: FallPath | undefined
    for (let s = step; s < 0.2 && !done; s += step) {
      const [x, h, z] = at(s)
      const r = Math.hypot(x, z)
      if (r <= stoneAt(h) + S.clearMm) {
        const seconds = s - step
        const [tx, th, tz] = at(seconds)
        const tr = Math.hypot(tx, tz)
        const slide = Math.max(crest - tr, 0.3)
        const to: [number, number, number] = [tx + slide * Math.sin(az1), 0, tz + slide * Math.cos(az1)]
        to[1] = ground(to[0], to[2])
        if (th - to[1] < 1) break
        const first = S.keeps * (F.gravity * seconds - vy)
        done = { from, to, seconds, life: seconds + (Math.sqrt(first * first + 2 * S.roll * F.gravity * (th - to[1])) - first) / (S.roll * F.gravity), slide, vy, rate, radius, id, phase }
      } else if (h <= ground(x, z)) {
        const seconds = s - step
        const [tx, , tz] = at(seconds)
        const ty = ground(tx, tz)
        const exact = (vy + Math.sqrt(vy * vy + 2 * F.gravity * Math.max(h0 - ty, 0.5))) / F.gravity
        done = { from, to: [from[0] + speed * exact * Math.sin(az1), ty, from[2] + speed * exact * Math.cos(az1)], seconds: exact, life: exact, slide: 0, vy, rate, radius, id, phase }
      }
    }
    if (done) out.push(done)
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

  // The grains of the fall that only the landing's surge sets falling come before the mark: once the jumping grains are
  // gone none of them is in the air, and the rest draw begins after them.
  const fall = fallPaths()
  const surge = restShare()
  for (const g of fall) if (fallPick(g.phase, g.id) > surge) put(g.to, g.from, [g.rate, g.seconds, g.vy, g.radius], [g.id, 1, g.phase, g.slide])
  const firstFall = n
  for (const g of fall) if (!(fallPick(g.phase, g.id) > surge)) put(g.to, g.from, [g.rate, g.seconds, g.vy, g.radius], [g.id, 1, g.phase, g.slide])

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

  // The fall and the loose grains are first in the list, so that at rest they alone are drawn; then the surge's own
  // grains of the fall, then the jumping grains. Within each kind the order is shuffled.
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
  yield* order(firstFall, n - firstFall, 0, LOOK.stride)
  yield* order(firstSurge, firstFall - firstSurge, n - firstFall, 1)
  yield* order(0, firstSurge, n - firstSurge, LOOK.stride)
  // Said after the last stop, so that no other making of the grains stands between the saying and the reading (`grains`).
  still = n - firstFall
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

// Which share of the fall a grain belongs to, as the shader reads it, and the largest share that is still falling when
// the jumping grains are gone and the rest draw begins. The shader reads it in single precision, hence the slack.
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
  // The time since the foot left the table is told by the beat of the shake. Sand left on a table stays on it; the
  // stream from the ledge ends with the lift and does not start again while the globe is in the air.
  const lifting = moment.beat !== null && moment.arrived >= 0.5 && at >= 0
  u.uSandLift.value = lifting ? (moment.beat! * 60) / (config.film as unknown as { defaultBpm: number }).defaultBpm : -1
  const falling = moment.beat !== null && moment.beat > LOOK.lift.stop ? 0 : fallShare(at) * down * grown
  u.uGrain.value.set(at < 0 ? -1 : Math.min(at, 50), gone, falling, shutter * LOOK.exposure)
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
