import * as THREE from 'three'
import { config } from '../config'
import { stageShader } from '../core/materials'
import { hasTexture, texture } from '../core/textures'
import { FAR_GLSL, lensUniforms } from './cameras'
import type { StageFrame } from './frame'
import { ROOM_GLSL, roomUniforms } from './room'
import { partChange } from '../shake/change'

const G = config.globe
const footRadius = G.baseDiameterMm / 2
const globeRadius = G.sphereDiameterMm / 2
const centreHeight = G.baseHeightMm - G.collarDepthMm + globeRadius
export const SLAB_MM = 6000
export const FADE_FROM_MM = 1400
export const FADE_TO_MM = 2900
export const KEY_CONE = 0.07
export const RIM_NEAR_GAIN = 3
export const SLAB_DETAIL = 'shared/scene-slab-detail.lin.tile.png'
export const SLAB_STONE = 'shared/scene-slab-stone.lin.tile.png'
export const SLAB_DETAIL_PX = 2048

export const SLAB_SHAPE = {
  turnDeg: 18,
  farMm: 1100,
  nearMm: 880,
  halfWidthMm: 900,
  cornerMm: 14,
  farLeftMm: [-226.2, -311.9] as [number, number],
  farLeftDir: [0.3911, -0.9204] as [number, number],
  farRightMm: [233, -331.5] as [number, number],
  farRightDir: [0.4136, 0.9105] as [number, number],
}

export const SLAB_EDGE = {
  tone: [16.5, 8.6, 5.7] as [number, number, number],
  wideMm: 9,
  floor: 0.3,
  fadeMm: [150, 200] as [number, number],
  humpAtMm: 125,
  humpMm: 15,
}

export const SLAB = {
  fineMm: 163,
  crumbMm: 271,
  crumbTurnDeg: -31,
  broadMm: 613,
  broadTurnDeg: 15,
  streakMm: 157,
  streakTurnDeg: 20,
  streakLong: 3,
  washMm: 280,
  washTurnDeg: -25,
  washLong: 2.5,
  slopeFull: 1,
  crumbDust: 0.3,
  dustAlbedo: 0.3,
  vein: 1.1,
  cloud: 0.7,
  markFloor: 0.5,
  markCloud: 5.5,
  markPower: 2.6,
  markWipe: 0.7,
  markMost: 2.6,
  filmAlbedo: 0.002,
  filmTint: [0.7, 1, 1.05],
  hazeAlbedo: 0.006,
  hazeMm: 50,
  gloss: 0.76,
  f0: 0.05,
  fresnelPower: 4.2,
  mirrorShare: 1,
  nearFloor: 0.9,
  nearBlur: 2.4,
  nearBlurFar: 4.2,
  nearBlurRiseMm: 90,
  nearHeightMm: 10,
  mirrorMark: 0.35,
  mirrorTint: [0.88, 0.88, 0.88],
  sheenUnder: 0.28,
  girthMoreMm: 6,
  girthSoftMm: 4,
  girthSoftRise: 0.3,
  farGain: 1.8,
  farFrom: 0.165,
  farTo: 0.125,
  roughSpread: 0.03,
  coreShare: 0.8,
  coreWidth: 0.2,
  farWidth: 0.32,
  roomRough: 0.046,
  mirrorTaps: 25,
  mirrorMaxPx: 0.075,
  farPathMm: 2600,
  farShare: 0.5,
  sideShare: 0.08,
  sideByGrazing: 1,
  sideMost: 0.45,
  sideRise: 0.4,
  sideRiseMm: 110,
  fadeHeightMm: 130,
  fadeFloor: 0.2,
  speckPx: 1.6,
  heldFar: 0.45,
  seatLine: 0.9,
  seatLineMm: 0.45,
  seatShade: 0.45,
  seatShadeMm: 2.5,
  unlitShare: 0.3,
  litFrom: 0.018,
  litTo: 0.075,
  poolGain: 4,
  poolRiseMm: 46,
  contactMm: 4,
  contactLiftMm: 1.2,
  lumpEdge: 0.45,
  lumpRagged: 0.45,
  lumpGrainMm: 0.9,
  lumpBlur: 0.75,
  lumpGain: 1.3,
  lumpSeasons: { winter: 1 } as Record<string, number>,
  lumpShade: 0.5,
  dustTint: [0.55, 1, 1.5],
  shadowReach: 0.6,
  bakedGain: 0.5,
  bakedFoot: 0.6,
  bakedGlow: 0.2,
  bakedGlowReach: 0.62,
  bakedShell: 0.5,
  bakedShellFrom: 0.55,
  bakedThrough: 0.5,
  underSky: 0.6,
  underSoftMm: 2,
  underSpread: 0.1,
  underFelt: 0.3,
  underKey: 0.35,
  underKeySide: 0.75,
  shadeBlendMm: 1,
  shadeSoftMm: 2.2,
  shadeInMm: 2,
  shadeOpen: 1,
}

/**
 * The table shows the globe as a mirror at the levels of quality that draw one and as a baked glow at the level that
 * does not. When the page steps between two such levels the two cross over, never cut: in `seconds` where the frames
 * are quick, in `fewestFrames` frames where they are slow, so a machine that had to give the mirror up draws it for
 * those few frames more and no longer. `mostFrames` is for a clock that stands still.
 */
export const REFLECT_MIX = { seconds: 0.5, fewestFrames: 8, mostFrames: 60 }

/** The mirror's share one frame on: `share` moved towards `to` by what `seconds` of the page's clock allow. */
export function reflectStep(share: number, to: number, seconds: number): number {
  const most = 1 / REFLECT_MIX.fewestFrames
  const least = 1 / REFLECT_MIX.mostFrames
  const step = seconds > 0 ? Math.min(most, Math.max(least, seconds / REFLECT_MIX.seconds)) : least
  const gap = to - share
  return Math.abs(gap) <= step + 1e-9 ? to : share + Math.sign(gap) * step
}

/**
 * Which pictures cross over and which are whole at once. A level that is set after the live picture has drawn a frame
 * at the level before it is a step of the page, and the frames that follow cross over from where the table stands.
 * The capture sets the level before each of its pictures and takes it back after, with no frame between, and a picture
 * of samples or a view is no frame of the page: all of those are whole at once, whatever was drawn before them.
 */
export class ReflectMix {
  share = 1
  private stepped = false
  private painted = false
  private at = 0

  level(): void {
    this.stepped = this.painted
    this.painted = false
  }

  frame(live: boolean, mirror: boolean, time: number): number {
    const to = mirror ? 1 : 0
    this.share = live && this.stepped ? reflectStep(this.share, to, time - this.at) : to
    if (live) {
      this.painted = true
      this.at = time
    }
    return this.share
  }
}

export const LUMPS: readonly (readonly [number, number, number, number, number])[] = [
  [-161.5, -108.3, 1.7, 3.1, 0.75],
  [-145.1, -108.3, 6.5, 2.8, 0.7],
  [-147.1, -77.7, 1.0, 1.7, 0.6],
  [-129.8, -72.4, 2.8, 1.7, 0.75],
  [-113.1, -109.9, 1.7, 3.1, 0.8],
  [-87.5, -152.7, 1.8, 3.3, 0.3],
  [-118.9, -39.2, 0.5, 0.8, 0.6],
  [-102.4, -21.1, 0.3, 0.6, 0.9],
  [-167.2, -89.5, 4.4, 2.3, 0.2],
  [94.0, -145.2, 5.6, 4.1, 0.85],
  [83.6, -143.4, 1.6, 3.0, 0.3],
  [93.4, -105.7, 1.2, 2.2, 0.6],
  [99.2, -98.3, 2.4, 2.8, 0.95],
  [107.2, -56.8, 3.7, 2.2, 0.7],
  [113.9, -74.7, 0.9, 1.5, 0.35],
  [110.0, -39.9, 1.5, 1.2, 0.5],
  [115.2, -46.8, 0.7, 1.3, 0.9],
  [123.2, -51.8, 0.6, 1.1, 0.6],
  [139.0, -108.3, 1.2, 2.2, 0.3],
  [149.5, -44.0, 0.5, 0.8, 0.7],
  [145.9, -23.1, 0.3, 0.6, 0.8],
]

const f = (v: number) => v.toFixed(4)
const turn = (SLAB_SHAPE.turnDeg * Math.PI) / 180
const broadTurn = (SLAB.broadTurnDeg * Math.PI) / 180
const crumbTurn = (SLAB.crumbTurnDeg * Math.PI) / 180
const streakTurn = (SLAB.streakTurnDeg * Math.PI) / 180
const washTurn = (SLAB.washTurnDeg * Math.PI) / 180
const tail = (((1 - SLAB.coreShare) / SLAB.coreShare) * Math.sqrt(2 * Math.PI)) / (4 / 3)

export const SLAB_SHAPE_GLSL = `
float slabInside(vec2 p) {
  vec2 q = vec2(p.x * ${f(Math.cos(turn))} - p.y * ${f(Math.sin(turn))}, p.x * ${f(Math.sin(turn))} + p.y * ${f(Math.cos(turn))});
  vec2 d = abs(q - vec2(0.0, ${f((SLAB_SHAPE.nearMm - SLAB_SHAPE.farMm) / 2)})) - vec2(${f(SLAB_SHAPE.halfWidthMm)}, ${f((SLAB_SHAPE.nearMm + SLAB_SHAPE.farMm) / 2)}) + ${f(SLAB_SHAPE.cornerMm)};
  float box = ${f(SLAB_SHAPE.cornerMm)} - length(max(d, 0.0)) - min(max(d.x, d.y), 0.0);
  float left = dot(p - vec2(${f(SLAB_SHAPE.farLeftMm[0])}, ${f(SLAB_SHAPE.farLeftMm[1])}), vec2(${f(-SLAB_SHAPE.farLeftDir[1])}, ${f(SLAB_SHAPE.farLeftDir[0])}));
  float right = dot(p - vec2(${f(SLAB_SHAPE.farRightMm[0])}, ${f(SLAB_SHAPE.farRightMm[1])}), vec2(${f(-SLAB_SHAPE.farRightDir[1])}, ${f(SLAB_SHAPE.farRightDir[0])}));
  return min(box, min(left, right));
}
`

export const SLAB_EDGE_GLSL = `
vec3 slabEdgeGlow(vec2 p, float softMm) {
  vec2 from = p - vec2(${f(SLAB_SHAPE.farLeftMm[0])}, ${f(SLAB_SHAPE.farLeftMm[1])});
  float across = dot(from, vec2(${f(-SLAB_SHAPE.farLeftDir[1])}, ${f(SLAB_SHAPE.farLeftDir[0])}));
  float along = dot(from, vec2(${f(SLAB_SHAPE.farLeftDir[0])}, ${f(SLAB_SHAPE.farLeftDir[1])}));
  float wide = length(vec2(${f(SLAB_EDGE.wideMm)}, softMm));
  float hump = (along - ${f(SLAB_EDGE.humpAtMm)}) / ${f(SLAB_EDGE.humpMm)};
  float share = ${f(SLAB_EDGE.floor)} * (1.0 - smoothstep(${f(SLAB_EDGE.fadeMm[0])}, ${f(SLAB_EDGE.fadeMm[1])}, along)) + ${f(1 - SLAB_EDGE.floor)} * exp(-0.5 * hump * hump);
  return vec3(${SLAB_EDGE.tone.map(f).join(', ')}) * (exp(-across * across / (2.0 * wide * wide)) * (${f(SLAB_EDGE.wideMm)} / wide) * share);
}
`

export const SLAB_LIGHT_GLSL = `
uniform vec3 uKeyAt;
uniform vec3 uRimAt;
uniform vec4 uFoot;
uniform vec4 uLean;
uniform vec3 uPool;
// How much of the pool reaches the place slabLight was last asked about. The slab's own surface reads it for the pour of a
// change, of which it takes more than what lies on it (lighting.ts, CHANGE_BLOOM, pour and pourOn).
float slabPoolShare;
float slabCapsule(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}
vec2 slabCast(vec2 at, vec2 foot, float lift, vec2 along) {
  float rise = ${f(G.baseHeightMm)};
  float baseFar = length(along) * (lift + rise);
  float baseSoft = 2.5 + 0.11 * baseFar + 0.5 * lift;
  vec2 sole = foot - uLean.xy;
  float baseShade = 1.0 - smoothstep(-baseSoft, baseSoft, slabCapsule(at, sole - along * lift, sole + uLean.zw * rise - along * (lift + rise)) - uFoot.z);
  vec2 ball = at - (sole + uLean.zw * ${f(centreHeight)} - along * (lift + ${f(centreHeight)}));
  vec2 dirL = along / max(length(along), 1e-3);
  float stretch = sqrt(1.0 + dot(along, along));
  float ballAt = length(vec2(dot(ball, dirL) / stretch, dot(ball, vec2(-dirL.y, dirL.x)))) / ${f(globeRadius)};
  return vec2(1.0 - baseShade, ballAt);
}
float slabRim(vec2 at) {
  vec2 d = at - uFoot.xy;
  d *= min(1.0, uFoot.z / max(length(d), 1e-3));
  float up = sqrt(max(1.0 - dot(uLean.zw, uLean.zw), 0.0));
  return max(uFoot.w - dot(uLean.zw, d) / max(up, 0.2), 0.0);
}
float slabShade(vec2 at) {
  float lift = slabRim(at);
  float gap = length(at - uFoot.xy - uLean.xy) - uFoot.z;
  float tight = exp(-max(gap, 0.0) / (${f(SLAB.contactMm)} + 0.9 * lift) - lift / ${f(SLAB.contactLiftMm)});
  float wide = (1.0 - smoothstep(-0.25 * uFoot.z, uFoot.z * (${f(SLAB.shadowReach)} + 0.035 * lift), gap)) * 0.6 / (1.0 + 0.045 * lift);
  float under = (1.0 - smoothstep(-5.0 - lift, 1.0 + 0.6 * lift, gap)) / (1.0 + 0.05 * lift);
  if (uFoot.w > 0.0 || dot(uLean.zw, uLean.zw) > 0.0) {
    float raised = smoothstep(0.0, ${f(SLAB.shadeBlendMm)}, lift);
    float rim = length(at - uFoot.xy) - uFoot.z;
    tight = exp(-max(rim, 0.0) / (${f(SLAB.contactMm)} + 0.9 * lift) - lift / ${f(SLAB.contactLiftMm)});
    float in2 = rim + ${f(SLAB.shadeInMm)};
    float open = 0.5 + 0.5 * in2 / length(vec2(in2, ${f(SLAB.shadeSoftMm)} + ${f(SLAB.shadeOpen)} * lift));
    under = mix(under, 1.0 - open, raised);
  }
  return (1.0 - 0.85 * tight) * (1.0 - wide) * (1.0 - 0.9 * under);
}
void slabLight(vec3 P, out vec3 keyDir, out float keyGain, out vec3 rimDir, out float rimGain, out float occl, out vec3 warm) {
  float lift = uFoot.w;
  vec2 foot = uFoot.xy + uLean.xy;
  float d = length(P.xz - foot);
  vec3 heart = vec3(0.0, ${f(centreHeight)}, 0.0);
  vec3 toKey = uKeyAt - P;
  float keyFar = length(toKey);
  keyDir = toKey / keyFar;
  vec3 keyAxis = uKeyAt - heart;
  float keyReach = length(keyAxis);
  float cone = exp(-(1.0 - dot(keyDir, keyAxis / keyReach)) / ${f(KEY_CONE)});
  vec2 keyCast = slabCast(P.xz, foot, lift, keyDir.xz / max(keyDir.y, 0.25));
  float keyBall = 0.5 * (1.0 - smoothstep(0.72, 1.12, keyCast.y));
  float caustic = 2.2 * exp(-keyCast.y * keyCast.y / 0.06);
  keyGain = cone * keyReach * keyReach / (keyFar * keyFar) * keyCast.x * (1.0 - keyBall + caustic);
  vec3 toRim = uRimAt - P;
  float rimFar = length(toRim);
  rimDir = toRim / rimFar;
  float rimReach = length(uRimAt - heart);
  vec2 rimCast = slabCast(P.xz, foot, lift, rimDir.xz / max(rimDir.y, 0.25));
  float rimBall = 0.5 * (1.0 - smoothstep(0.72, 1.12, rimCast.y));
  rimGain = min(rimReach * rimReach / (rimFar * rimFar), ${f(RIM_NEAR_GAIN)}) * rimCast.x * (1.0 - rimBall);
  float source = ${f(centreHeight)} + lift;
  float glowFall = pow(abs(source * source / (source * source + d * d)), 1.5);
  float glowRise = smoothstep(uFoot.z - 4.0, uFoot.z + ${f(SLAB.poolRiseMm)} + lift, d);
  slabPoolShare = ${f(SLAB.poolGain)} * glowFall * glowRise;
  warm = uPool * slabPoolShare;
  occl = slabShade(P.xz);
}
`

const blank = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1)
blank.needsUpdate = true
const dark = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
dark.needsUpdate = true

export const surfaceUniforms = {
  uSlab: { value: new THREE.Color(0.0004, 0.001, 0.0022) },
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyCol: { value: new THREE.Color() },
  uKeyAt: { value: new THREE.Vector3(0, 1000, 0) },
  uRimAt: { value: new THREE.Vector3(0, 1000, 0) },
  uRimCol: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() },
  uFoot: { value: new THREE.Vector4(0, 0, footRadius, 0) },
  uLean: { value: new THREE.Vector4(0, 0, 0, 0) },
  uPool: { value: new THREE.Color() },
  uPour: { value: new THREE.Color() },
  uReflect: { value: new THREE.Vector4(1, 0, 0, 0) },
  uBaked: { value: new THREE.Color() },
  uMirror: { value: dark as THREE.Texture },
  uMirrorSize: { value: new THREE.Vector4(1, 1, 1, 0) },
  uDetail: { value: blank as THREE.Texture },
  uStone: { value: dark as THREE.Texture },
  uLumps: { value: 0 },
}

export const slabLightUniforms = {
  uKeyAt: surfaceUniforms.uKeyAt,
  uRimAt: surfaceUniforms.uRimAt,
  uFoot: surfaceUniforms.uFoot,
  uLean: surfaceUniforms.uLean,
  uPool: surfaceUniforms.uPool,
}

const SLAB_FRAG = `${ROOM_GLSL}
${FAR_GLSL}
${SLAB_SHAPE_GLSL}
${SLAB_EDGE_GLSL}
uniform vec3 uSlab;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimCol;
uniform vec3 uSky;
uniform vec4 uReflect;
uniform vec3 uBaked;
uniform vec3 uPour;
uniform sampler2D uMirror;
uniform vec4 uMirrorSize;
uniform sampler2D uDetail;
uniform sampler2D uStone;
uniform float uLumps;
vec2 slabSlope(vec4 t) {
  vec2 c = (t.rg * 255.0 - 128.0) / 127.0;
  return vec2(c.x, -c.y) * abs(c) * ${f(SLAB.slopeFull)};
}
const vec4 slabLumpAt[${LUMPS.length}] = vec4[${LUMPS.length}](${LUMPS.map((l) => `vec4(${f(l[0])}, ${f(l[1])}, ${f(l[2])}, ${f(l[3])})`).join(', ')});
const float slabLumpGain[${LUMPS.length}] = float[${LUMPS.length}](${LUMPS.map((l) => f(l[4])).join(', ')});
float slabHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec2 slabNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  float a = mix(mix(slabHash(i), slabHash(i + vec2(1.0, 0.0)), u.x), mix(slabHash(i + vec2(0.0, 1.0)), slabHash(i + vec2(1.0, 1.0)), u.x), u.y);
  vec2 k = i + 17.0;
  float b = mix(mix(slabHash(k), slabHash(k + vec2(1.0, 0.0)), u.x), mix(slabHash(k + vec2(0.0, 1.0)), slabHash(k + vec2(1.0, 1.0)), u.x), u.y);
  return vec2(a, b) - 0.5;
}
vec2 slabLumps(vec3 at, vec3 toEye, float blurMm) {
  vec3 across = normalize(vec3(toEye.z, 0.0, -toEye.x));
  vec3 upward = cross(toEye, across);
  float sum = 0.0;
  float lit = 0.0;
  for (int i = 0; i < ${LUMPS.length}; i++) {
    vec4 c = slabLumpAt[i];
    vec3 rel = vec3(at.x - c.x, 0.0, at.z - c.y);
    vec2 s = vec2(dot(rel, across), dot(rel, upward));
    vec2 size = vec2(c.z, 0.5 * c.w) + blurMm;
    vec2 rag = slabNoise(s / (${f(SLAB.lumpGrainMm)} + blurMm) + float(i) * 7.3) + 0.5 * slabNoise(s / (${f(SLAB.lumpGrainMm * 0.37)} + 0.5 * blurMm) + float(i) * 3.1);
    vec2 q = (s - vec2(0.0, 0.5 * c.w)) / size;
    float far = length(q) + rag.x * ${f(SLAB.lumpRagged)};
    float soft = clamp(${f(SLAB.lumpEdge)} + blurMm / c.w, 0.0, 0.95);
    float m = slabLumpGain[i] * (1.0 - smoothstep(1.0 - soft, 1.0 + 0.5 * soft, far)) * sqrt(c.z * 0.5 * c.w / (size.x * size.y));
    sum += m;
    lit += m * mix(${f(SLAB.lumpShade)}, 1.0, clamp(0.5 + 0.5 * q.y + rag.y, 0.0, 1.0));
  }
  return vec2(sum, lit);
}
float discShare(float x) {
  x = clamp(x, -1.0, 1.0);
  return 0.5 + (asin(x) + x * sqrt(1.0 - x * x)) * 0.31830989;
}
${SLAB_LIGHT_GLSL}
vec4 slabMirror(vec2 st, vec2 lean, float reach, float beyond, float wide) {
  float tall = min(2.0 * ${f(SLAB.roughSpread)} * reach * uFocal, ${f(SLAB.mirrorMaxPx)} * uFocal);
  vec2 kick = clamp(lean * reach, vec2(-1.5 * tall - 2.0), vec2(1.5 * tall + 2.0));
  float gapPx = 2.0 * tall / ${f(SLAB.mirrorTaps - 1)};
  float lod = log2(max(gapPx * uMirrorSize.z * max(1.0, sqrt(wide / ${f(SLAB.mirrorTaps)}) * ${f(SLAB.mirrorTaps - 1)}), 1.0));
  float span = mix(${f(SLAB.coreWidth)}, ${f(SLAB.farWidth)}, smoothstep(0.25, 0.7, reach));
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < ${SLAB.mirrorTaps}; i++) {
    float u = float(i) / ${f(SLAB.mirrorTaps - 1)} * 2.0 - 1.0;
    float w = exp(-u * u / (2.0 * span * span)) + ${f(tail)} * span * (1.0 - u * u);
    float across = (fract(float(i) * 0.6180339887 + 0.25) * 2.0 - 1.0) * wide * tall;
    vec4 m = textureLod(uMirror, st + (kick + vec2(across, u * tall)) * uMirrorSize.xy, lod);
    sum += w * vec4(m.rgb * mix(m.a, (1.0 - m.a) * ${f(SLAB.farShare)}, beyond), m.a);
    total += w;
  }
  return sum / total;
}
void main() {
  vec3 P = vStageWorld;
  vec3 toP = P - cameraPosition;
  float dist = length(toP);
  vec3 v = toP / dist;
  float depth = max(vStageAux.y, 1.0);
  float grazing = max(-v.y, 0.004);
  float blurPx = lensBlurMm(depth) * uFocal / depth;

  float inside = slabInside(P.xz);
  float perPx = max(length(vec2(dFdx(inside), dFdy(inside))), 1e-4);
  float cover = discShare(inside / (max(blurPx, 0.75) * perPx));
  if (uDiag == 0 && cover < 0.002) discard;

  float spread = max(1.0, 1.7 * blurPx);
  vec2 uvA = P.xz / ${f(SLAB.fineMm)} + vec2(0.37, 0.11);
  vec2 uvC = vec2(P.x * ${f(Math.cos(crumbTurn))} + P.z * ${f(Math.sin(crumbTurn))}, P.z * ${f(Math.cos(crumbTurn))} - P.x * ${f(Math.sin(crumbTurn))}) / ${f(SLAB.crumbMm)} + vec2(0.13, 0.71);
  vec2 uvB = vec2(P.x * ${f(Math.cos(broadTurn))} + P.z * ${f(Math.sin(broadTurn))}, P.z * ${f(Math.cos(broadTurn))} - P.x * ${f(Math.sin(broadTurn))}) / ${f(SLAB.broadMm)};
  vec4 fine = textureGrad(uDetail, uvA, dFdx(uvA) * spread, dFdy(uvA) * spread);
  vec4 crumb = textureGrad(uDetail, uvC, dFdx(uvC) * spread, dFdy(uvC) * spread);
  vec2 uvS = vec2(P.x * ${f(Math.cos(streakTurn))} + P.z * ${f(Math.sin(streakTurn))}, P.z * ${f(Math.cos(streakTurn))} - P.x * ${f(Math.sin(streakTurn))}) / vec2(${f(SLAB.streakMm)}, ${f(SLAB.streakMm * SLAB.streakLong)}) + vec2(0.29, 0.53);
  vec2 uvW = vec2(P.x * ${f(Math.cos(washTurn))} + P.z * ${f(Math.sin(washTurn))}, P.z * ${f(Math.cos(washTurn))} - P.x * ${f(Math.sin(washTurn))}) / vec2(${f(SLAB.washMm)}, ${f(SLAB.washMm * SLAB.washLong)}) + vec2(0.61, 0.17);
  vec4 stone = textureGrad(uStone, uvB, dFdx(uvB) * spread, dFdy(uvB) * spread);
  vec4 fleck = textureGrad(uStone, uvS, dFdx(uvS) * spread, dFdy(uvS) * spread);
  vec4 wash = textureGrad(uStone, uvW, dFdx(uvW) * spread, dFdy(uvW) * spread);
  vec2 turned = slabSlope(crumb);
  vec2 tilt = slabSlope(fine) + vec2(turned.x * ${f(Math.cos(crumbTurn))} - turned.y * ${f(Math.sin(crumbTurn))}, turned.x * ${f(Math.sin(crumbTurn))} + turned.y * ${f(Math.cos(crumbTurn))});
  vec3 n = normalize(vec3(tilt.x, 1.0, tilt.y));
  vec2 lump = uLumps > 0.0 ? uLumps * slabLumps(P, -v, ${f(SLAB.lumpBlur)} * lensBlurMm(depth)) : vec2(0.0);
  float speck = max(spread, ${f(SLAB.speckPx)});
  float dust = clamp(max(textureGrad(uDetail, uvA, dFdx(uvA) * speck, dFdy(uvA) * speck).b, textureGrad(uDetail, uvC, dFdx(uvC) * speck, dFdy(uvC) * speck).b * ${f(SLAB.crumbDust)}), 0.0, 1.0);
  dust = max(dust * (1.0 - min(lump.x, 1.0)), min(lump.y * ${f(SLAB.lumpGain)}, 1.0));
  float vein = stone.r;
  float cloud = stone.g;
  float patchy = 0.5 * (wash.g + fleck.g);
  float mark = min(${f(SLAB.markFloor)} + ${f(SLAB.markCloud)} * pow(max(patchy, 1e-4), ${f(SLAB.markPower)}) + ${f(SLAB.markWipe)} * max(wash.b, fleck.b), ${f(SLAB.markMost)});

  float lift = uFoot.w;
  float haze = exp(-max(length(P.xz - uFoot.xy - uLean.xy) - uFoot.z, 0.0) / ${f(SLAB.hazeMm)});

  vec3 film = vec3(${SLAB.filmTint.map(f).join(', ')}) * mark;
  vec3 albedo = uSlab * (1.0 + ${f(SLAB.vein)} * vein + ${f(SLAB.cloud)} * cloud) + film * ${f(SLAB.filmAlbedo)};
  vec3 scatter = albedo + vec3(${SLAB.dustTint.map(f).join(', ')}) * (${f(SLAB.dustAlbedo)} * dust);
  vec3 keyDir;
  vec3 rimDir;
  vec3 warm;
  float keyGain;
  float rimGain;
  float occl;
  slabLight(P, keyDir, keyGain, rimDir, rimGain, occl, warm);
  vec3 direct = uKeyCol * (max(dot(n, keyDir), 0.0) * keyGain) + uRimCol * (max(dot(n, rimDir), 0.0) * rimGain);
  // The dust and the lumps lie on the slab: they take the smaller pour with the rest of what lies there, and the slab's own
  // near black takes the difference, so a white speck in the pool stays under white and takes the pool's colour.
  vec3 col = scatter * (direct + (uSky + warm) * occl) + albedo * (uPour * (slabPoolShare * occl)) + film * direct * (${f(SLAB.hazeAlbedo)} * haze);

  vec3 r0 = vec3(v.x, -v.y, v.z);
  vec2 ground = v.xz / max(length(v.xz), 1e-4);
  vec2 slope = tilt;
  vec3 r = normalize(r0 + 2.0 * vec3(slope.x * grazing, -dot(v.xz, slope), slope.y * grazing));
  float fres = ${f(SLAB.f0)} + ${f(1 - SLAB.f0)} * pow(abs(1.0 - clamp(grazing, 0.0, 1.0)), ${f(SLAB.fresnelPower)});

  float rl = max(length(r0.xz), 1e-4);
  vec2 rdir = r0.xz / rl;
  vec2 fq = P.xz - uFoot.xy;
  float th = -dot(fq, rdir);
  float side = abs(fq.x * rdir.y - fq.y * rdir.x);
  float girth = ${f(globeRadius + SLAB.girthMoreMm)} + length(uLean.xy);
  float tIn = (th - sqrt(max(girth * girth - side * side, 0.0))) / rl;
  float tGlobe = max(max(tIn, lift / max(r0.y, 1e-3)), 0.0);
  float reachFar = ${f(SLAB.farPathMm)} / (dist + ${f(SLAB.farPathMm)});
  float reachNear = tGlobe / (dist + tGlobe);
  float height = tGlobe * r0.y;
  float silSoft = ${f(SLAB.girthSoftMm)} + ${f(SLAB.girthSoftRise)} * height;
  float sil = (1.0 - smoothstep(girth - silSoft, girth + 0.25 * silSoft, side)) * step(0.0, th + girth);
  float above = max(height - lift, 0.0);
  float fade = mix(1.0, ${f(SLAB.nearFloor)}, smoothstep(0.0, ${f(SLAB.nearHeightMm)}, above)) * mix(1.0, ${f(SLAB.fadeFloor)}, smoothstep(0.0, ${f(SLAB.fadeHeightMm)}, above));
  float seatUp = max((th - sqrt(max(uFoot.z * uFoot.z - side * side, 0.0))) / rl, 0.0) * r0.y;
  float seatOn = (1.0 - smoothstep(uFoot.z - 1.5, uFoot.z + 1.5, side)) * step(0.0, th + uFoot.z) * exp(-slabRim(P.xz) / ${f(SLAB.contactLiftMm)});
  float seat = 1.0 - seatOn * (1.0 - (1.0 - ${f(SLAB.seatLine)} * exp(-seatUp / ${f(SLAB.seatLineMm)})) * (1.0 - ${f(SLAB.seatShade)} * exp(-seatUp / ${f(SLAB.seatShadeMm)})));

  vec3 footUp = vec3(uLean.z, sqrt(max(1.0 - dot(uLean.zw, uLean.zw), 0.0)), uLean.w);
  vec3 footAt = vec3(uFoot.x, lift, uFoot.y);
  float tUnder = max(dot(footAt - P, footUp) / max(dot(r0, footUp), 1e-3), 0.0);
  vec3 underOut = P + r0 * tUnder - footAt;
  float underFar = length(underOut);
  float underGap = r0.y * tUnder;
  vec2 underDir = underOut.xz / max(underFar, 1e-3);
  float underAlong = dot(underDir, rdir);
  float underSoft = (${f(SLAB.underSoftMm)} + ${f(SLAB.underSpread)} * tUnder) * sqrt(1.0 + underAlong * underAlong * (1.0 / max(r0.y * r0.y, 0.01) - 1.0));
  float underHit = (1.0 - smoothstep(uFoot.z - underSoft, uFoot.z + underSoft, underFar)) * smoothstep(0.0, 0.5, max(lift, uFoot.z * length(uLean.zw)));
  float underIn = max(uFoot.z - underFar, 0.0);
  float underOpen = 1.0 - underIn / length(vec2(underIn, 2.0 * underGap + 0.5));
  vec2 underKey = uKeyAt.xz - uFoot.xy;
  float underLit = mix(1.0 - ${f(SLAB.underKeySide)}, 1.0, 0.5 + 0.5 * dot(underDir, underKey / max(length(underKey), 1.0)));
  vec3 underSeen = mix(uBaked, vec3(dot(uBaked, vec3(0.3333))), 0.5) * ${f(SLAB.underFelt)} * (uSky * ${f(SLAB.underSky)} + uKeyCol * (${f(SLAB.underKey)} * underLit)) * underOpen;

  vec3 seen = vec3(0.0);
  vec3 image = vec3(0.0);
  float held = 0.0;
  if (uReflect.x > 0.0) {
    vec2 st = gl_FragCoord.xy * uMirrorSize.xy;
    vec2 lean = vec2(dot(slope, vec2(-ground.y, ground.x)) * grazing, dot(slope, ground)) * 2.0 * uFocal;
    seen = slabMirror(st, lean, reachFar, 1.0, ${f(SLAB.sideShare)}).rgb;
    if (sil > 0.002) {
      vec4 hit = slabMirror(st, lean, min(reachNear * mix(${f(SLAB.nearBlur)}, ${f(SLAB.nearBlurFar)}, smoothstep(0.0, ${f(SLAB.nearBlurRiseMm)}, height)), 1.0), 0.0, clamp(grazing * ${f(SLAB.sideByGrazing)}, ${f(SLAB.sideShare)}, ${f(SLAB.sideMost)}) + ${f(SLAB.sideRise)} * smoothstep(0.0, ${f(SLAB.sideRiseMm)}, height));
      image = hit.rgb * (sil * seat * mix(${f(SLAB.unlitShare)}, 1.0, smoothstep(${f(SLAB.litFrom)}, ${f(SLAB.litTo)}, dot(hit.rgb, vec3(0.2126, 0.7152, 0.0722)))));
      held = hit.a * sil;
    }
  }
  if (uReflect.y > 0.0) {
    float soft = 0.004 + 0.02 * reachFar;
    vec3 far = stageRoomLights(normalize(r + vec3(0.0, 0.5 * ${f(SLAB.roughSpread)} * reachFar, 0.0)), soft) * 0.6;
    float bodyTop = lift + ${f(G.baseHeightMm)};
    float blurMm = max(${f(SLAB.roughSpread)} * tGlobe * 2.0, 1.0);
    float body = sil * (1.0 - smoothstep(bodyTop - blurMm, bodyTop + blurMm, height)) * smoothstep(lift - blurMm, lift + blurMm, height);
    float domeTop = lift + ${f(centreHeight + globeRadius)};
    float glass = sil * smoothstep(bodyTop - blurMm, bodyTop + blurMm, height) * (1.0 - smoothstep(domeTop - 3.0 * blurMm, domeTop, height));
    float up = clamp((height - lift) / ${f(G.baseHeightMm)}, 0.0, 1.0);
    vec3 lit = uBaked * (uSky + uKeyCol * 0.22) * (${f(SLAB.bakedGain)} * mix(${f(SLAB.bakedFoot)}, 1.0, up));
    vec2 heart = vec2(side, height - lift - ${f(centreHeight)}) / ${f(globeRadius * SLAB.bakedGlowReach)};
    float glow = exp(-dot(heart, heart));
    float shell = smoothstep(${f(SLAB.bakedShellFrom)}, 1.0, side / girth);
    vec3 near = lit * body + ((uPool + uPour) * (${f(SLAB.bakedGlow)} * glow) + uSky * (${f(SLAB.bakedShell)} * shell)) * glass;
    far *= 1.0 - body - ${f(1 - SLAB.bakedThrough)} * glass;
    seen = far * uReflect.y + seen * uReflect.x;
    image = near * uReflect.y + image * uReflect.x;
    held = clamp(body + glass, 0.0, 1.0) * uReflect.y + held * uReflect.x;
  }
  image = mix(image, underSeen, underHit);
  held = max(held, underHit);
  vec3 room = stageRoomSeen(r, ${f(SLAB.roomRough)});
  float farGloss = fres * mark * ${f(SLAB.gloss)} * mix(1.0, ${f(SLAB.farGain)}, smoothstep(${f(SLAB.farFrom)}, ${f(SLAB.farTo)}, grazing));
  float nearGloss = max(fres, ${f(SLAB.mirrorShare)}) * fade * mix(1.0, mark, ${f(SLAB.mirrorMark)});
  col += (image * vec3(${SLAB.mirrorTint.map(f).join(', ')}) * nearGloss + (seen + room * (1.0 - held * ${f(1 - SLAB.sheenUnder)} * mix(1.0, ${f(SLAB.heldFar)}, smoothstep(0.0, ${f(SLAB.fadeHeightMm)}, above)))) * farGloss) * (1.0 - 0.6 * dust);
  col += uRoomWall * slabEdgeGlow(P.xz, 1.2 * lensBlurMm(depth));

  gl_FragColor = vec4(col * cover, 1.0 - cover);
  if (uDiag != 0) {
    if (inside < 0.0) discard;
    vec2 texel = uvA * ${f(SLAB_DETAIL_PX)};
    gl_FragColor = vec4(stageDiag(scatter, n, 0.0, 0.0, max(length(dFdx(texel)), length(dFdy(texel)))).rgb, 0.0);
  }
}`

export function makeSlab(): THREE.Mesh {
  const m = stageShader({
    part: 'surface',
    standIn: false,
    textured: true,
    texels: SLAB_DETAIL_PX,
    uniforms: { ...surfaceUniforms, ...roomUniforms, ...lensUniforms },
    fragment: SLAB_FRAG,
    params: {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.SrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.SrcAlphaFactor,
      depthWrite: false,
    },
  })
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_MM, SLAB_MM), m)
  slab.rotation.x = -Math.PI / 2
  slab.frustumCulled = false
  slab.renderOrder = -3
  return slab
}

export function updateSurface(f: StageFrame): void {
  const su = surfaceUniforms
  const g = f.globe
  const t = f.mix.base
  if (su.uDetail.value === blank && hasTexture(SLAB_DETAIL)) su.uDetail.value = texture(SLAB_DETAIL)
  if (su.uStone.value === dark && hasTexture(SLAB_STONE)) su.uStone.value = texture(SLAB_STONE)
  su.uKeyDir.value.copy(f.keyDir)
  su.uKeyCol.value.copy(f.keyCol)
  const light = f.mix.base
  const ka = f.from.rig.key.from
  const kb = f.to.rig.key.from
  su.uKeyAt.value.set(ka[0] + (kb[0] - ka[0]) * light, ka[1] + (kb[1] - ka[1]) * light, ka[2] + (kb[2] - ka[2]) * light)
  const ra = f.from.rig.rim.from
  const rb = f.to.rig.rim.from
  su.uRimAt.value.set(ra[0] + (rb[0] - ra[0]) * light, ra[1] + (rb[1] - ra[1]) * light, ra[2] + (rb[2] - ra[2]) * light)
  su.uRimCol.value.copy(f.rimCol)
  su.uSky.value.copy(f.ambient)
  su.uFoot.value.set(g.x, g.z, footRadius, g.y)
  const lean = 0.5 * G.baseHeightMm + g.y
  su.uLean.value.set(-Math.sin(g.tiltZ) * lean, Math.sin(g.tiltX) * lean, -Math.sin(g.tiltZ), Math.sin(g.tiltX) * Math.cos(g.tiltZ))
  su.uPool.value.copy(f.poolOn)
  su.uPour.value.setRGB(f.pool.r - f.poolOn.r, f.pool.g - f.poolOn.g, f.pool.b - f.poolOn.b)
  const lumpsA = SLAB.lumpSeasons[f.from.season] ?? 0
  su.uLumps.value = lumpsA * (1 - partChange('surface-leave', f.change)) + (SLAB.lumpSeasons[f.to.season] ?? 0) * partChange('surface-come', f.change)
  const mirror = f.view === '' && f.planar ? f.reflect : 0
  su.uReflect.value.set(mirror, 1 - mirror, 0, 0)
  const a = f.from.main
  const b = f.to.main
  su.uBaked.value.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}
