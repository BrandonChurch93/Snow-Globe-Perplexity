import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { meshLevel } from '../../core/models'
import { stream } from '../../core/rng'
import { grade } from '../../post/grade'
import { rimGapMm } from '../../shake/table'
import type { KitMoment } from '../kit'
import { SAND_COLOUR, sinceLoose } from './base'
import { SAND_GLSL, SAND_LIT, SLAB, SPRINKLE, sandHeight, sandLitAt, sandProud, sandSpread, sandSprinkle, sandSprinkleAt, sandSprinkleRun, sandStrewn } from './slab'

const PART = 'arrival-summer'
const RAD = Math.PI / 180

// The landing shakes the sand on the ledge loose. `jump` grains leave the ledge on the thump, fly, skid and come to rest on
// the slab; once they lie still they fade and are no longer drawn, and the slab's own sand is what lies there. `fall`
// grains are the sand that runs over the lip at the right shoulder and falls past the flank onto the crest of the mound:
// the landing starts it with a surge, and it runs on as a thin standing fall for as long as the globe stands on the
// table. A grain leaves the lip with the speed it has from sliding down the bank, far enough out to clear the belly of
// the stone, and falls under gravity less the drag on a grain a fifth of a millimetre wide. Every grain's place is a
// function of the time since the landing and of the clock, nothing is kept from frame to frame. The mirror of the slab
// gets none of the grains; medium and low draw a share.
//
// A grain is drawn where it is when the shutter opens, with its own short blur along its path, and does not move through
// the samples of one picture: across a whole shutter a falling grain is a line dozens of pixels long, and a line drawn
// from a few samples is a row of dashes.
const LOOK = {
  gravity: 3400,
  lift: { stop: 0.25, share: 0.6, nearMm: [61.5, 69.0], late: 0.4, upMmS: [70, 170], inMm: 1.1 },
  ledge: { r: [46.5, 52.0], h: 42.6 },
  jump: { count: 14000, reachMm: 26, ringShare: 0, ringMm: 5, edgeDeg: [62, 76], liftMm: [1.2, 8], hopMm: [0.6, 5], quick: 0.11, tail: 0.5, tailShare: [0.6, 0.12], skidMm: [0.4, 3.2], radiusMm: [0.07, 0.15] },
  fall: { count: 32000, gravity: 7000, az: 74, spread: 2.5, most: 2.0, off: [0.35, 1.6], h: [29.0, 30.5], outMmS: [58, 130], lean: 2.2, fliers: { share: 0, far: [1.2, 1.6] }, fanDeg: 1.5, downMmS: [10, 40], rate: [5.0, 6.7], radiusMm: [0.03, 0.07], fine: 2.5, fadeFrom: 0.9, core: [0.3, 70, 160], edge: [95, 130, 0.85], exposure: 0.3, longMm: 1.0, thinPx: 0.6, grains: 1.9, mass: 2.4, sizes: [0.7, 0.9], soft: { share: 0.5, wide: 2.2, cover: 0.25 }, cover: 0.2, rise: 0.012, low: [0.66, 0.6, 0.56], shine: [0.4, 1.0], pale: 0.4, least: [0.03, 0.12], bright: [0.75, 1.9], even: 0.15, lit: 1.8, shaded: 0.08, puff: { seconds: 0.07, outMmS: [60, 330], upMmS: [90, 230], cover: 0.07, wide: 5.0, turn: 0.45 } },
  loose: { x: [16, 136], z: [-70, 112], thinPx: 1.0, round: [-0.3, 0.6, 1.4], glint: { one: 40, lit: 2.2 }, squash: [1.0, 2.4], bend: 0.7, proud: { count: 9000, radiusMm: [0.05, 0.12, 0.3], small: 0.8, lean: 2.0, sunk: 0.3, vary: [0.6, 1.2] }, dust: { count: 14000, radiusMm: [0.03, 0.07], reach: 0.16, cover: 0.6 }, grain: { count: 2600, radiusMm: [0.07, 0.22], lean: 2.5, reach: 0.3 }, crumb: { count: 60, radiusMm: [0.3, 0.8], lean: 1.6, reach: 0.5 }, vary: [0.12, 0.5], warm: [1.0, 0.8, 0.56] },
  sprinkle: { count: 0, thinPx: 0.85, vary: [0.4, 1.15], warm: [1.0, 0.84, 0.64], s: [-12, 78], d: [-0.4, 16], mm: [0.07, 0.18], core: { share: 0.7, mm: 3.0, wide: 2.4, lit: 0.85, size: [0.08, 0.2] }, glints: { count: 46, d: [13, 46], mm: [0.16, 0.34], lit: 2.6 } },
  lens: { rows: 1080, most: 4, flyPx: 1.0, round: [1.6, 4.0], clear: 6 },
  slope: { clearMm: 0.25, keeps: 0.75, roll: 0.5, bulge: 0.0038, crestMm: [60.6, 66], crestLean: 1.6, offMm: [0.12, 0.55], belly: [[60.3, 8], [60.3, 11.2], [59.7, 14.6], [58.6, 18], [57.3, 21.2], [55.8, 24.4], [54.3, 27.4], [53, 30.5], [52.8, 34], [52.7, 37.5], [52.6, 40]] },
  flow: { stand: 0.8, seconds: 1.6, gapMm: [0.3, 2.5], shadeMm: [0.5, 60] },
  exposure: 0.15,
  gold: [1, 0.8, 0.66],
  backlit: 2.6,
  shadow: { r: 57, top: [36, 41] },
  streak: 2.1,
  blurRadii: 3,
  gone: [6.5, 8],
  grow: { frames: 20, near: [55, 150], spread: 0.35, late: 0.8, soft: 0.2 },
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
uniform float uSandDown;
uniform vec2 uSandFoot;
uniform vec3 uGrainKey;
varying vec2 vGrainUv;
varying vec4 vGrainLook;
varying vec3 vGrainShape;
varying float vGrainCover;
varying float vGrainLit;
varying float vGrainSun;
${SAND_GLSL}
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
if (aSeed.y < -0.5) {
  tau = max(grainT - aFlight.x, 0.0);
} else if (aSeed.y < 0.5) {
  tau = grainT - aFlight.x;
  if (grainT < 0.0 || tau < 0.0) alive = 0.0;
} else if (aSeed.y < 1.5) {
  float cycles = max(1.0, floor(uGrainLoop.y * aFlight.x + 0.5));
  float life = aFlight.y + fallSlide();
  float spare = max(min(${LOOK.fall.puff.seconds.toFixed(3)}, uGrainLoop.y / cycles - life), 0.0);
  tau = fract(uGrainLoop.x * cycles + aSeed.z) * (uGrainLoop.y / cycles);
  if (grainT < 0.0 || tau > grainT || tau >= life + spare || fract(aSeed.z * 61.3 + aSeed.x * 17.7) > uGrain.z || fract(aSeed.z * 23.9 + 0.37) > uGrainLevel) alive = 0.0;
  if (tau > life) puff = (tau - life) / max(spare, 1e-4);
} else {
  tau = 0.0;
  if (fract(aSeed.z * 23.9 + 0.37) > uGrainLevel) alive = 0.0;
}
// No grain is on the table before the foot is down: from then they come, those by the base first.
if (aSeed.y < 0.5 || aSeed.y > 1.5) {
  float born = ${LOOK.grow.late.toFixed(2)} * mix(smoothstep(${LOOK.grow.near[0]!.toFixed(1)}, ${LOOK.grow.near[1]!.toFixed(1)}, length(position.xz)), fract(aSeed.x * 41.3 + aSeed.z * 17.1), ${LOOK.grow.spread.toFixed(2)});
  grown = smoothstep(born, born + ${LOOK.grow.soft.toFixed(2)}, uSandGrow);
  if (grown <= 0.0) alive = 0.0;
}
tau = max(tau, 0.0);
vec3 nowAt = grainPath(tau);
float falls = aSeed.y > 0.5 && aSeed.y < 1.5 ? 1.0 : 0.0;
float lies = aSeed.y > 1.5 ? 1.0 : 0.0;
vec3 thenAt = grainPath(max(tau - uGrain.w * mix(1.0, ${(LOOK.fall.exposure / LOOK.exposure).toFixed(3)}, falls), 0.0));
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
// thrown a millimetre up and out, and fading.
if (puff >= 0.0) {
  float s = tau - (aFlight.y + fallSlide());
  float turn = 6.2832 * fract(aSeed.x * 71.3 + aSeed.z * 3.7);
  vec2 out2 = (dot(position.xz, position.xz) > 0.0 ? normalize(position.xz) : vec2(1.0, 0.0)) + vec2(sin(turn), cos(turn)) * ${LOOK.fall.puff.turn.toFixed(2)};
  float outS = mix(${LOOK.fall.puff.outMmS[0].toFixed(1)}, ${LOOK.fall.puff.outMmS[1].toFixed(1)}, fract(aSeed.x * 13.9 + 0.21));
  float upS = mix(${LOOK.fall.puff.upMmS[0].toFixed(1)}, ${LOOK.fall.puff.upMmS[1].toFixed(1)}, fract(aSeed.z * 37.1 + aSeed.x * 5.3));
  nowAt = position + vec3(out2.x * outS * s, max(upS * s - 0.5 * ${LOOK.fall.gravity.toFixed(1)} * s * s, 0.0), out2.y * outS * s);
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
float wide = 1.0 + 0.6 * airborne;
float thinner = 1.0;
// A falling grain is far finer than a pixel and crosses many of them while the shutter is open. It is drawn as the line it
// leaves, never thinner than a pixel can show, and as much fainter as the line is longer and wider than the grain.
if (falls > 0.5) {
  float least = ${LOOK.fall.thinPx.toFixed(2)} * max(-nowV.z, 1.0) / uGrainPx;
  // The fall is grains, some larger, some out of focus, and none is drawn as a line longer than three of itself: what the
  // shorter line loses in length it gains in light.
  float softly = step(${(1 - LOOK.fall.soft.share).toFixed(2)}, fract(aSeed.x * 37.3 + aSeed.z * 11.9));
  float larger = fract(aSeed.x * 7.7 + aSeed.z * 29.3);
  float grow = mix(mix(${LOOK.fall.sizes[0]!.toFixed(2)}, ${LOOK.fall.sizes[1]!.toFixed(2)}, larger * larger * larger), ${LOOK.fall.soft.wide.toFixed(2)}, softly);
  float line = min(len, ${LOOK.fall.longMm.toFixed(1)});
  wide = 1.0;
  size = max(aFlight.w, least) * grow * alive;
  blur = min(line, ${(2 * LOOK.fall.grains).toFixed(1)} * size);
  float finer = aFlight.w / max(aFlight.w, least);
  thinner = finer * finer * pow(max(2.0 * aFlight.w / max(line + 2.0 * aFlight.w, 1e-5), 0.0), ${LOOK.fall.even.toFixed(2)});
  thinner *= min((line + 2.0 * size) / max(blur + 2.0 * size, 1e-5), ${LOOK.fall.mass.toFixed(2)}) * mix(1.0, ${LOOK.fall.soft.cover.toFixed(2)}, softly);
  if (puff >= 0.0) size *= ${LOOK.fall.puff.wide.toFixed(2)};
}
if (falls < 0.5) {
  // The grains strewn to the right of the base are finer than the sprinkle to its left, which keeps its own size.
  float least = mix(${LOOK.lens.flyPx.toFixed(2)}, mix(${LOOK.sprinkle.thinPx.toFixed(2)}, ${LOOK.loose.thinPx.toFixed(2)}, step(${LOOK.loose.x[0]!.toFixed(1)}, position.x)), lies) * max(-nowV.z, 1.0) / uGrainPx;
  if (lies > 0.5) blur = 0.0;
  size = max(aFlight.w, least) * alive;
  thinner = aFlight.w / max(aFlight.w, least);
  thinner *= thinner;
}
vec4 grainV = nowV;
grainV.xy -= axis * (blur * (0.5 - 0.5 * aCorner.y));
float streak = 1.0 + blur / max(2.0 * size, 1e-4);
// The lens parts red from blue toward the frame's edge (post.ts). The grain is drawn that much wider, and its fragment
// lays its red and blue where the lens will bring them back onto its green.
float pad = 1.0 + min(1.5 * (1.0 + floor(uGrainLens.z)) * max(-nowV.z, 1.0) / max(size * uGrainPx, 1e-3), ${LOOK.lens.most.toFixed(1)});
// A grain at rest stands on the sand with the whole of what is drawn of it, and the table does not cut the margin its
// colours are laid in: a cut edge is a hard edge, and the lens gives every hard edge a blue line.
if (falls < 0.5) grainV.y += (1.0 - airborne) * max(size - aFlight.w, 0.0);
grainV.xy += (axis * aCorner.y + across * aCorner.x * wide) * (size * pad);
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
vGrainShape = vec3(streak / wide, airborne, falls + 2.0 * lies);
vGrainCover = (aSeed.y > 0.5 ? 1.0 : 1.0 - uGrain.y) * min(1.0, ${LOOK.streak.toFixed(2)} / streak) / wide * min(1.0, thinner);
if (falls > 0.5) {
  float glint = fract(aSeed.x * 53.7 + aSeed.z * 7.1);
  glint *= glint * glint;
  float bright = mix(${LOOK.fall.bright[0].toFixed(2)}, 1.0, glint * glint);
  vGrainCover = min(1.0, ${LOOK.fall.cover.toFixed(2)} * ${LOOK.fall.bright[1].toFixed(2)} * bright * thinner);
  vGrainCover *= 1.0 - smoothstep(${LOOK.fall.fadeFrom.toFixed(2)}, 1.0, tau / max(aFlight.y + fallSlide(), 1e-4));
  vGrainCover *= smoothstep(0.0, ${LOOK.fall.rise.toFixed(3)}, tau);
  // The quickest grains fly farthest out and are few: they are the fainter the farther, so the fall ends in a veil and not in single grains.
  vGrainCover *= 1.0 - ${LOOK.fall.edge[2]!.toFixed(2)} * smoothstep(${LOOK.fall.edge[0]!.toFixed(1)}, ${LOOK.fall.edge[1]!.toFixed(1)}, (length(position.xz - aFrom.xz) - aSeed.w) / max(aFlight.y, 1e-3));
  if (puff >= 0.0) vGrainCover = ${LOOK.fall.puff.cover.toFixed(2)} * mix(0.4, 1.0, bright) * (1.0 - puff) * (1.0 - puff);
}
if (lies > 0.5) vGrainCover = min(1.0, thinner) * mix(1.0, ${LOOK.loose.dust.cover.toFixed(2)}, step(0.15, aSeed.w) * step(aSeed.w, 0.25));
vGrainCover *= grown;
vGrainLit = lies > 0.5 ? 1.0 + aSeed.w : falls > 0.5 ? mix(${LOOK.fall.core[0].toFixed(2)}, 1.0, smoothstep(${LOOK.fall.core[1].toFixed(1)}, ${LOOK.fall.core[2].toFixed(1)}, (length(position.xz - aFrom.xz) - aSeed.w) / max(aFlight.y, 1e-3))) : 1.0;
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
  }
  vec2 lensQ = gl_FragCoord.xy - uGrainLens.xy;
  float lensR = dot(lensQ, lensQ) / dot(uGrainLens.xy, uGrainLens.xy);
  vec2 lensPx = lensQ / max(length(lensQ), 1e-4) * (uGrainLens.z * pow(max(lensR, 1e-12), 0.5 * uGrainLens.w));
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
  float round = max(falls, smoothstep(${LOOK.lens.round[0]!.toFixed(1)}, ${LOOK.lens.round[1]!.toFixed(1)}, inversesqrt(max(lensX.x * lensX.x + lensY.x * lensY.x, 1e-8)) * ${(LOOK.lens.rows / 2).toFixed(1)} / min(uGrainLens.x, uGrainLens.y)));
  n = normalize(mix(normalize(uGrainKey + v + vec3(0.0, 1.0, 0.0)), n, round));
  float id = vGrainLook.x;
  float id2 = vGrainLook.y;
  vec3 albedo = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, smoothstep(0.1, 0.75, id));
  // A dark grain in the fall is a dark dash across the pale stone behind it; the fall is drawn in the pale grains alone.
  albedo = mix(albedo, ${vec(SAND_COLOUR.dark)}, step(0.93, id2) * (1.0 - falls));
  albedo = mix(albedo, ${vec(SAND_COLOUR.white)}, step(id2, mix(0.12, ${LOOK.fall.pale.toFixed(2)}, falls)));
  float shade = mix(0.25, 1.0, vGrainLook.z) * vGrainLit * mix(1.0, ${LOOK.fall.lit.toFixed(2)}, falls);
  float ndl = dot(n, uGrainKey);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  float thru = pow(clamp(dot(-v, uGrainKey) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  vec3 dome = mix(uGrainGround, uGrainSky, 0.5 + 0.5 * n.y);
  albedo *= mix(vec3(1.0), ${vec(LOOK.gold)} * (0.7 + 0.6 * fract(id2 * 7.3)), vGrainShape.y);
  vec3 col = albedo * RECIPROCAL_PI * (uGrainKeyCol * shade * (wrap + 1.8 + (0.6 + ${LOOK.backlit.toFixed(2)} * vGrainShape.y) * thru) + dome + uRigCardCol * 0.35 * clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0));
  float hk = max(dot(n, normalize(v + uGrainKey)), 0.0);
  col += uGrainKeyCol * shade * step(0.7, fract(id * 17.9)) * pow(abs(hk), 60.0) * 1.2;
  // A grain that lies on the heap or on the table is lit as the heap's skin is (slab.ts): by the sun the sand under it
  // takes and the stone's shade, each a little more or less than the next; one wide enough to show it has a lit side.
  if (vGrainShape.z > 1.5) {
    float kind = vGrainLit - 1.0;
    float vary = fract(id * 29.3 + id2 * 3.1);
    float proud = step(0.25, kind) * step(kind, 0.35);
    float gain = mix(mix(${LOOK.loose.vary[0]!.toFixed(2)}, ${LOOK.loose.vary[1]!.toFixed(2)}, vary), mix(${LOOK.loose.proud.vary[0]!.toFixed(2)}, ${LOOK.loose.proud.vary[1]!.toFixed(2)}, vary), proud);
    float side = mix(1.0, ${LOOK.loose.round[2]!.toFixed(2)} * smoothstep(${LOOK.loose.round[0]!.toFixed(2)}, ${LOOK.loose.round[1]!.toFixed(2)}, ndl), round);
    float back = clamp(dot(-v, uGrainKey) * 0.5 + 0.5, 0.0, 1.0);
    float near = mix(0.7, 1.0, clamp((length(vStageWorld.xz) - 55.5) / 13.0, 0.0, 1.0));
    vec3 paint = albedo * mix(${vec(LOOK.loose.warm)}, vec3(${SAND_LIT.tint.map((x) => x.toFixed(3)).join(', ')}), proud);
    col = sandKnee(sandTone(paint * mix(gain, 1.0, proud), uGrainKeyCol * (vGrainSun * vGrainLook.z * side * (1.0 + ${SAND_LIT.back.toFixed(3)} * back * back)), (dome + uRigCardCol * (${SAND_LIT.card.toFixed(3)} * clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0))) * near) * mix(1.0, gain, proud));
    // One grain in forty of those strewn on the table turns a face to the light and glints.
    col *= mix(1.0, ${LOOK.loose.glint.lit.toFixed(2)}, step(1.5, kind));
  }
  vec3 cover = vGrainCover * disc;
  if (falls > 0.5) {
    col *= mix(${vec(LOOK.fall.low)}, vec3(1.0), smoothstep(${LOOK.fall.shine[0]!.toFixed(2)}, ${LOOK.fall.shine[1]!.toFixed(2)}, fract(id * 43.7 + id2 * 5.3)));
    cover *= smoothstep(${LOOK.fall.least[0]!.toFixed(2)}, ${LOOK.fall.least[1]!.toFixed(2)}, dot(col, vec3(0.2126, 0.7152, 0.0722)));
  }
  gl_FragColor = vec4(col * cover, cover.g);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, n, 0.0, c, 0.0);
}
`

const frontLeft = (x: number, z: number): number => {
  const az = Math.atan2(x, z) / RAD
  return az > -150 && az < -8 ? 0.06 : 1
}

const flightOf = (lift: number, drop: number): { T: number; vy: number } => {
  const g = LOOK.gravity
  const vy = Math.sqrt(2 * g * Math.max(lift, 0))
  return { T: (vy + Math.sqrt(vy * vy + 2 * g * Math.max(drop, 0.5))) / g, vy }
}

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
export const sandDown = grainUniforms.uSandDown
export const sandGrow = grainUniforms.uSandGrow
export const sandLift = grainUniforms.uSandLift
export const sandFoot = grainUniforms.uSandFoot

export const FALL = { gravity: LOOK.fall.gravity, count: LOOK.fall.count, stand: LOOK.flow.stand }

// The stone's flank below the lip, radius at height (assets-src/base-summer/profile.mjs, BODY).
const stoneAt = (h: number): number => {
  const b = LOOK.slope.belly
  for (let i = 0; i + 1 < b.length; i++) if (h >= b[i]![1]! && h <= b[i + 1]![1]!) return b[i]![0]! + ((b[i + 1]![0]! - b[i]![0]!) * (h - b[i]![1]!)) / (b[i + 1]![1]! - b[i]![1]!)
  return h < b[0]![1]! ? b[0]![0]! : 0
}

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
    const speed = (F.outMmS[0] + (F.outMmS[1] - F.outMmS[0]) * rf.next() ** F.lean) * (flier < F.fliers.share ? F.fliers.far[0]! + (F.fliers.far[1]! - F.fliers.far[0]!) * (flier / F.fliers.share) : 1)
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

function grainGeometry(): THREE.BufferGeometry {
  const total = LOOK.jump.count + LOOK.fall.count + LOOK.loose.proud.count + LOOK.loose.dust.count + LOOK.loose.grain.count + LOOK.loose.crumb.count + LOOK.sprinkle.count
  const to = new Float32Array(total * 12)
  const from = new Float32Array(total * 12)
  const flight = new Float32Array(total * 16)
  const seed = new Float32Array(total * 16)
  const corner = new Float32Array(total * 8)
  const index = new Uint32Array(total * 6)
  let n = 0
  const put = (t: readonly number[], f: readonly number[], fl: readonly number[], s: readonly number[]): void => {
    for (let k = 0; k < 4; k++) {
      const o = n * 4 + k
      to.set(t, o * 3)
      from.set(f, o * 3)
      flight.set(fl, o * 4)
      seed.set(s, o * 4)
      corner[o * 2] = k % 2 === 0 ? -1 : 1
      corner[o * 2 + 1] = k < 2 ? -1 : 1
    }
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
    const pick = rj.next()
    const ringed = pick < J.ringShare
    const wide = !ringed && pick < J.ringShare + 0.12
    const ringAz = rj.range(-Math.PI, Math.PI)
    const ringR = 61.5 + -Math.log(Math.max(rj.next(), 1e-6)) * J.ringMm
    const x = ringed ? ringR * Math.sin(ringAz) : wide ? rx.range(SLAB.x[0], SLAB.x[1]) : rx.range(-6, 132)
    const z = ringed ? ringR * Math.cos(ringAz) : wide ? rz.range(SLAB.z[0], SLAB.z[1]) : rz.range(-70, 214)
    const r = Math.hypot(x, z)
    if (r < 61.5) continue
    const h = sandHeight(x, z)
    const want = ringed ? frontLeft(x, z) : h < 0.9 ? Math.min(1, 0.8 * sandSpread(x, z)) : 0.22
    if (rj.next() > want) continue
    const radius = J.radiusMm[0] + (J.radiusMm[1] - J.radiusMm[0]) * rj.next() ** 2
    const y = SLAB.liftMm + h + radius * 0.7
    const near = Math.min(1, Math.max(0, (r - 62) / J.reachMm))
    // Only the grains bound for the right edge leave the ledge: a narrow shower against the light, as the approved image has it.
    // The rest hop where they lie, so nothing falls across the front of the stone and no line of fresh grains rings the foot.
    const edge = Math.min(1, Math.max(0, (Math.atan2(x, z) / RAD - J.edgeDeg[0]) / (J.edgeDeg[1] - J.edgeDeg[0])))
    const flies = rj.next() > near && rj.next() < edge
    const late = rj.next() < J.tailShare[0] + (J.tailShare[1] - J.tailShare[0]) * near
    const delay = late ? J.quick + -Math.log(Math.max(rj.next(), 1e-6)) * J.tail : rj.next() ** 1.5 * J.quick
    if (flies) {
      const az = Math.atan2(x, z) + rj.gauss() * 0.12
      const rl = rj.range(LOOK.ledge.r[0], LOOK.ledge.r[1])
      const lift = late ? rj.range(0.2, 2) : J.liftMm[0] + (J.liftMm[1] - J.liftMm[0]) * rj.next() ** 2 * (0.35 + 0.65 * near)
      const f = flightOf(lift, LOOK.ledge.h - y)
      put([x, y, z], [rl * Math.sin(az), LOOK.ledge.h, rl * Math.cos(az)], [delay, f.T, f.vy, radius], [rj.next(), 0, rj.next(), rj.range(J.skidMm[0], J.skidMm[1])])
    } else {
      const lift = J.hopMm[0] + (J.hopMm[1] - J.hopMm[0]) * rj.next() ** 2 * Math.exp(-(r - 60) / 90)
      const vy = Math.sqrt(2 * LOOK.gravity * lift)
      const f = { T: (2 * vy) / LOOK.gravity, vy }
      const drift = rj.range(0.1, 0.9)
      const turn = rj.range(-Math.PI, Math.PI)
      put([x, y, z], [x + drift * Math.sin(turn), y, z + drift * Math.cos(turn)], [rj.next() ** 1.5 * 0.05, f.T, f.vy, radius], [rj.next(), -1, rj.next(), rj.range(0.05, 0.5)])
    }
    made++
  }

  const firstFall = n
  for (const g of fallPaths()) put(g.to, g.from, [g.rate, g.seconds, g.vy, g.radius], [g.id, 1, g.phase, g.slide])

  // The grains that lie where they are for good. Those that stand proud of the heap's skin, half sunk in it, so that
  // its outline is grains; and those strewn round it: dust close in, grains, and a few coarse crumbs, fewer with the distance.
  const rl = stream(`${PART}/loose`)
  const O = LOOK.loose
  const lie = (count: number, kind: number, want: (x: number, z: number) => number, size: (pick: number) => number, sunk: number): void => {
    for (let k = 0, laid = 0; laid < count && k < count * 600; k++) {
      const x = rl.range(O.x[0]!, O.x[1]!)
      const z = rl.range(O.z[0]!, O.z[1]!)
      const keep = rl.next()
      const radius = size(rl.next())
      const id = rl.next()
      const phase = rl.next()
      if (Math.hypot(x, z) < 61.5 || keep > want(x, z)) continue
      const at = [x, SLAB.liftMm + sandHeight(x, z) + radius * (1 - sunk), z]
      put(at, at, [sandLitAt(x, z), 0, 0, radius], [id, 2, phase, kind === 0 && (id * 977 + phase * 131) % 1 < 1 / O.glint.one ? 2 : kind])
      laid++
    }
  }
  lie(O.proud.count, 0.3, sandProud, (pick) => (pick < O.proud.small ? O.proud.radiusMm[0]! + (O.proud.radiusMm[1]! - O.proud.radiusMm[0]!) * (pick / O.proud.small) : O.proud.radiusMm[1]! + (O.proud.radiusMm[2]! - O.proud.radiusMm[1]!) * ((pick - O.proud.small) / (1 - O.proud.small)) ** O.proud.lean), O.proud.sunk)
  lie(O.dust.count, 0.2, (x, z) => sandStrewn(x, z, O.dust.reach), (pick) => O.dust.radiusMm[0]! + (O.dust.radiusMm[1]! - O.dust.radiusMm[0]!) * pick, 0.3)
  lie(O.grain.count, 0, (x, z) => sandStrewn(x, z, O.grain.reach), (pick) => O.grain.radiusMm[0]! + (O.grain.radiusMm[1]! - O.grain.radiusMm[0]!) * pick ** O.grain.lean, 0.3)
  lie(O.crumb.count, 0.1, (x, z) => sandStrewn(x, z, O.crumb.reach), (pick) => O.crumb.radiusMm[0]! + (O.crumb.radiusMm[1]! - O.crumb.radiusMm[0]!) * pick ** O.crumb.lean, 0.3)
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
  still = n - firstFall

  // The fall and the loose grains are first in the list, so that at rest they alone are drawn; within each kind the order is shuffled.
  const order = (first: number, count: number, at: number): void => {
    for (let k = 0; k < count; k++) {
      const q = first + ((k * LOOK.stride) % count)
      index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], (at + k) * 6)
    }
  }
  order(firstFall, n - firstFall, 0)
  order(0, firstFall, n - firstFall)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(to.subarray(0, n * 12), 3))
  g.setAttribute('aFrom', new THREE.BufferAttribute(from.subarray(0, n * 12), 3))
  g.setAttribute('aFlight', new THREE.BufferAttribute(flight.subarray(0, n * 16), 4))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, n * 16), 4))
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner.subarray(0, n * 8), 2))
  g.setIndex(new THREE.BufferAttribute(index.subarray(0, n * 6), 1))
  return g
}

let still = 0

export function fallShare(sinceLoose: number): number {
  const F = LOOK.flow
  if (sinceLoose < 0) return 0
  if (!(sinceLoose < Infinity)) return F.stand
  return F.stand + (1 - F.stand) * Math.exp(-sinceLoose / F.seconds)
}

export async function prepare(): Promise<void> {}

// The grains lie on the slab and fall past the foot, outside the glass, so they are drawn with the surface dressing (slab.ts
// adds them to its group); nothing of this arrival is inside the globe.
export function grains(): THREE.Mesh {
  const m = stageShader({ part: PART, standIn: false, change: 'surface-dressing', vertexPars: VERT_PARS, vertexMain: VERT_MAIN, fragment: fragment(), uniforms: grainUniforms, params: { side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } })
  const mesh = new THREE.Mesh(grainGeometry(), m)
  mesh.frustumCulled = false
  const whole = mesh.geometry.index!.count / 6
  const fall = still
  mesh.onBeforeRender = () => {
    const share = LOOK.share[meshLevel()] ?? 1
    grainUniforms.uGrainLevel.value = share
    const drawn = mesh.matrixWorld.determinant() < 0 ? 0 : grainUniforms.uGrain.value.y < 1 ? fall + Math.floor((whole - fall) * share) : fall
    mesh.geometry.setDrawRange(0, 6 * drawn)
  }
  mesh.onAfterRender = () => {
    mesh.geometry.setDrawRange(0, Infinity)
  }
  return mesh
}

export function arrival(): THREE.Object3D {
  return new THREE.Group()
}

const sinceDown = (moment: KitMoment): number => {
  const t = sinceLoose(moment)
  const fps = (config.film as { fps: number }).fps
  const open = moment.frame.sample === null ? moment.time : Math.floor(moment.time * fps + 0.25) / fps
  return t >= 0 && t < Infinity ? Math.max(0, t - (moment.time - open)) : t
}

// Nothing of the sand lies on the table before the foot is down. From the landing the heap, the fall and the strewn
// grains grow from nothing, and are whole some twenty frames on.
export function sandGrown(moment: KitMoment): number {
  const at = sinceDown(moment)
  if (at < 0) return 0
  if (!(at < Infinity)) return 1
  const s = Math.min(1, (at * (config.film as { fps: number }).fps) / LOOK.grow.frames)
  return s * s * (3 - 2 * s)
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
  u.uGrainLens.value.set(f.width / 2, f.height / 2, (grade.fringePx * Math.min(f.width, f.height)) / LOOK.lens.rows, grade.fringePower)
  u.uGrainKey.value.copy(f.keyDir)
  u.uGrainKeyCol.value.copy(f.keyCol)
  u.uGrainSky.value.copy(f.sky).multiplyScalar(f.fill)
  u.uGrainGround.value.copy(f.ground).multiplyScalar(f.fill)
}
