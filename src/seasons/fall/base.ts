import * as THREE from 'three'
import { lightUniforms } from '../../core/chunks/light'
import { stageMaterial, stageShader, type Rgb } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { stream } from '../../core/rng'
import { texture } from '../../core/textures'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import type { KitMoment } from '../kit'

export const season = 'fall'
export const main: Rgb = [0.03, 0.03, 0.034]

const PART = 'base-fall'
const MODEL = 'fall/base-fall.glb'
const map = (name: string) => texture(`fall/base-${name}.png`)

export const FACE_COUNT = 7
export interface Face {
  az: number
  h: number
  rad: number
  tall: number
  cell: number
  r: number
  seen: boolean
}
interface FaceExtras {
  faces: Face[]
  faceRange: number
}

// The candles. On the landing each wick catches (`catchSeconds`): its light eases up to `ember` of the whole, a little
// over it at first, and from then on never falls under `floor` of that ember (a lit face does not go out again; the
// tremble that fades is small). Then each face takes (`takeSeconds`): it eases up by `flare` of what is left over a
// few `flareSeconds`, and creeps to the whole of it over `creepSeconds`. Both rises start with no slope, so no frame
// jumps. The three a viewer faces never light in the order they stand: the middle one, then the right, then the left,
// at uneven gaps. All three are alight half a second after the landing, because that is the moment of the approved
// shake image, which shows them lit; the four behind follow over the next three seconds in a shuffled order (the
// arrival's spread). The slab's reflections and pools read the same levels (`faceUniforms.uFaceGlow`).
const LIGHT = {
  catchSeconds: [0.16, 0.04, 0.09, 0.6, 1.9, 0.3, 1.0],
  takeSeconds: [0.36, 0.18, 0.27, 1.1, 2.5, 0.8, 1.6],
  ember: 0.42,
  floor: 0.92,
  flare: 0.7,
  flareSeconds: 0.06,
  creepSeconds: 0.9,
}
const CANDLE: Rgb = [1, 0.36, 0.045]

export const faceUniforms = {
  uFaceAt: { value: [] as THREE.Vector3[] },
  uFaceOut: { value: [] as THREE.Vector4[] },
  uFaceGlow: { value: [] as number[] },
  uFaceCol: { value: new THREE.Color(...CANDLE) },
}
const baseUniforms = {
  uBaseFloor: { value: new THREE.Color() },
  uBaseKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uBaseKeyCol: { value: new THREE.Color() },
  uBaseRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uBaseRimCol: { value: new THREE.Color() },
  uBaseSky: { value: new THREE.Color() },
}
const FLOOR_SHARE = 0.1
// The brambles' tones, measured against the approved image in boxes at the review tier.
const BRAMBLE = { ALBEDO: 0.4, SPILL: 14, RIM: 0.1, RIM_FRONT: 0, KEY: 0.02, KEY_EAST: 32, CARD: 0.2, CARD_FRONT: 0, WARM: 0.3, WARM_FRONT: 0, WARM_WEST: 85, CARD_WEST: 60, TOP: 0, BARK: 0.7, LIFT: 0.005, LIFT_WEST: 75, FILL: 0.08, LINE: 1.6, LINE_POW: 320, LINE_WIDE: 0.5, KNOB: 9, LINE_EAST: 14, THORN: 0.5 }
const DRUM_SHEEN = 1.8
const DRUM_FOLD = 6
const DRUM_CRINKLE = 1.5
const DRUM_GRAIN = 2
const BARK_GRAIN = 1.8
const PUMPKIN_BODY = 0.042
const IRON_PARS = `${Object.entries(BRAMBLE).map(([k, v]) => `#define BRAMBLE_${k} ${v.toFixed(3)}`).join('\n')}\n#define DRUM_SHEEN ${DRUM_SHEEN.toFixed(3)}\n#define DRUM_FOLD ${DRUM_FOLD.toFixed(3)}\n#define DRUM_CRINKLE ${DRUM_CRINKLE.toFixed(3)}\n#define DRUM_GRAIN ${DRUM_GRAIN.toFixed(3)}\n#define BARK_GRAIN ${BARK_GRAIN.toFixed(3)}`
const flicker: { a: number; b: number; c: number }[] = []
let faceList: Face[] = []
export const faces = (): Face[] => faceList
export const faceGlow = (): number[] => faceUniforms.uFaceGlow.value

const VERT_PARS = `
#ifndef USE_UV1
attribute vec2 uv1;
#endif
#ifndef USE_COLOR
attribute vec3 color;
#endif
varying vec3 vBasePos;
varying vec3 vBaseNormal;
varying vec3 vBasePaint;
varying vec2 vBaseUv1;
`

const VERT_MAIN = `
vBasePos = position;
vBaseNormal = normal;
vBasePaint = color;
vBaseUv1 = uv1;
`

const NOISE = `
float baseHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float baseNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(baseHash(i), baseHash(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(baseHash(i + vec3(0.0, 1.0, 0.0)), baseHash(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(baseHash(i + vec3(0.0, 0.0, 1.0)), baseHash(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(baseHash(i + vec3(0.0, 1.0, 1.0)), baseHash(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
`

const FRAG_PARS = `
uniform sampler2D uBaseDetail;
uniform vec3 uBaseFloor;
uniform vec3 uBaseRimDir;
uniform vec3 uBaseRimCol;
uniform vec3 uFaceAt[${FACE_COUNT}];
uniform vec4 uFaceOut[${FACE_COUNT}];
uniform float uFaceGlow[${FACE_COUNT}];
uniform vec3 uFaceCol;
uniform mat3 normalMatrix;
varying vec3 vBasePos;
varying vec3 vBaseNormal;
varying vec3 vBasePaint;
varying vec2 vBaseUv1;
${ROOM_GLSL}
${NOISE}
float baseFold(vec3 p) {
  vec3 q = vec3(p.x, p.y * 0.3, p.z);
  float w = baseNoise(q * 0.09 + 13.0);
  float a = baseNoise(q * 0.21 + vec3(w, w * 0.7, w) * 2.2 + 7.0);
  float b = baseNoise(q * 0.47 + vec3(w, 0.0, -w) * 0.9 + 29.0);
  return abs(2.0 * a - 1.0) * 0.72 + abs(2.0 * b - 1.0) * 0.28;
}
float baseCrinkle(vec3 p) {
  vec3 q = vec3(p.x, p.y * 0.8, p.z);
  float w = baseNoise(q * 0.3 + 51.0);
  float a = baseNoise(q * 0.75 + vec3(w, -w, w) * 1.3 + 3.0);
  float b = baseNoise(q.zxy * 1.35 + vec3(-w, w, w) * 0.8 + 43.0);
  return abs(2.0 * a - 1.0) * 0.65 + abs(2.0 * b - 1.0) * 0.35;
}
vec2 baseSlope(vec2 rg) {
  vec2 n = rg * 2.0 - 1.0;
  return n / sqrt(max(1.0 - dot(n, n), 0.05));
}
vec3 baseBend(vec2 slope) {
  vec3 n0 = normalize(vBaseNormal);
  vec3 t0 = vec3(vBasePos.z, 0.0, -vBasePos.x);
  t0 = normalize(t0 - n0 * dot(t0, n0) + vec3(1e-5, 0.0, 0.0));
  vec3 b0 = cross(n0, t0);
  return normalize(n0 + t0 * slope.x + b0 * slope.y);
}
`

const BEND = `
vec3 baseObjectNormal = baseBend(baseTilt);
normal = normalize(normalMatrix * baseObjectNormal);
#ifdef DOUBLE_SIDED
normal *= faceDirection;
#endif
`

// What the room gives a surface of the base, and the candle light of the faces: each face is a small lamp that shines
// outward from its openings on whatever stands near it.
const SHADE = `
{
  #ifndef STAGE_LIGHT_DONE
  vec3 baseMirror = reflect(-geometryViewDir, geometryNormal);
  vec3 baseAway = inverseTransformDirection(baseMirror, viewMatrix);
  float baseRough = material.roughness;
  vec3 baseSeen = stageRoomSoft(baseAway, baseRough);
  if (baseRough < 0.62) baseSeen += stageRoomLights(baseAway, 0.002 + 0.5 * baseRough * baseRough) * (1.0 - baseRough / 0.62);
  baseSeen += uBaseFloor * (2.0 * smoothstep(0.05, -0.45, baseAway.y));
  reflectedLight.indirectSpecular += baseSeen * EnvironmentBRDF(geometryNormal, geometryViewDir, material.specularColorBlended, material.specularF90, baseRough);
  #endif
  reflectedLight.indirectDiffuse *= baseAo;
  reflectedLight.indirectSpecular *= baseAo;
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.6);
  reflectedLight.directSpecular *= mix(1.0, baseAo, 0.8);
  vec3 candleLit = vec3(0.0);
  vec3 candleShine = vec3(0.0);
  for (int i = 0; i < ${FACE_COUNT}; i++) {
    vec3 candleTo = uFaceAt[i] - vBasePos;
    float candleFar = length(candleTo);
    vec3 candleL = candleTo / max(candleFar, 0.01);
    vec3 candleOut = vec3(uFaceOut[i].x, 0.0, uFaceOut[i].y);
    float candleCone = smoothstep(-0.25, 0.5, dot(-candleL, candleOut));
    float candleFall = uFaceGlow[i] * candleCone * uFaceOut[i].z * uFaceOut[i].z / (candleFar * candleFar + 0.35 * uFaceOut[i].z * uFaceOut[i].z) * mix(1.0, exp(-max(candleFar - uFaceOut[i].z, 0.0) / (0.8 * uFaceOut[i].z)), baseNear);
    vec3 candleV = normalize(normalMatrix * candleL);
    float candleN = dot(geometryNormal, candleV);
    candleLit += candleFall * clamp(candleN * (1.0 - baseWrap) + baseWrap, 0.0, 1.0);
    candleShine += candleFall * pow(max(dot(geometryNormal, normalize(candleV + geometryViewDir)), 0.0), mix(90.0, 6.0, material.roughness)) * smoothstep(-0.1, 0.2, candleN);
  }
  reflectedLight.directDiffuse += uFaceCol * candleLit * material.diffuseContribution * (baseCandle * mix(0.5, 1.0, baseAo));
  reflectedLight.directSpecular += uFaceCol * candleShine * material.specularColorBlended * (baseCandle * 3.0 * mix(0.4, 1.0, baseAo));
}
`

type Shader = THREE.WebGLProgramParametersWithUniforms

interface Stages {
  pars?: string
  paint: string
  rough: string
  tilt: string
  bent?: string
  after: string
}

function hookOf(uniforms: Record<string, THREE.IUniform>, at: Stages): (shader: Shader) => void {
  return (shader) => {
    Object.assign(shader.uniforms, roomUniforms, faceUniforms, baseUniforms, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}\n${at.pars ?? ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${at.paint}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${at.rough}`)
      .replace('#include <normal_fragment_maps>', `${at.tilt}\n${BEND}\n${at.bent ?? ''}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${at.after}`)
  }
}

// The ring of thorns: the drum under it, the vines and the thorns. The paint of a vertex is its shade, its kind (0 the
// drum, a half the vines, 1 the thorns) and how far along a thorn it is. Vines and thorns are near black and wet:
// one long cool highlight along a vine, warm glints at the left. The drum is blue grey leather in long creases.
const IRON_PAINT = `
float baseAo = vBasePaint.x * mix(0.2, 1.0, smoothstep(39.6, 38.9, vBasePos.y)) * mix(mix(0.2, 1.0, smoothstep(2.0, 24.0, vBasePos.y)), 1.0, max(smoothstep(-18.0, -44.0, vBasePos.x), 0.5 * smoothstep(24.0, 46.0, vBasePos.x)));
float baseKind = vBasePaint.y;
float baseThorn = step(0.75, baseKind);
float baseDrum = 1.0 - step(0.25, baseKind);
float baseStrand = (1.0 - baseThorn) * (1.0 - baseDrum);
float baseBlotch = baseNoise(vBasePos * 0.35) * 0.6 + baseNoise(vBasePos * 1.3) * 0.4;
vec3 foldT = normalize(vec3(vBasePos.z, 0.0, -vBasePos.x) + vec3(1e-5, 0.0, 0.0));
float foldHere = baseFold(vBasePos);
float foldOn = baseFold(vBasePos + foldT * 0.4);
float foldUp = baseFold(vBasePos + vec3(0.0, 0.4, 0.0));
float crinkleHere = baseCrinkle(vBasePos);
float crinkleOn = baseCrinkle(vBasePos + foldT * 0.16);
float crinkleUp = baseCrinkle(vBasePos + vec3(0.0, 0.16, 0.0));
float grainHere = baseNoise(vBasePos * 3.5 + 11.0);
float grainOn = baseNoise((vBasePos + foldT * 0.12) * 3.5 + 11.0);
float grainUp = baseNoise((vBasePos + vec3(0.0, 0.12, 0.0)) * 3.5 + 11.0);
// The crease of a fold is dark and dull, its back takes the sheen.
float baseScale = max(1.0 - smoothstep(0.0, 0.22, foldHere), 0.8 * (1.0 - smoothstep(0.0, 0.16, crinkleHere))) * baseDrum;
diffuseColor.rgb = mix(mix(vec3(0.028, 0.03, 0.034), vec3(0.05, 0.046, 0.044), baseBlotch), mix(vec3(0.022, 0.031, 0.046), vec3(0.036, 0.05, 0.074), baseBlotch), baseDrum) * mix(1.0, 0.55, baseScale) * mix(BRAMBLE_ALBEDO * mix(1.0, 0.5, baseThorn), 0.6, baseDrum);
float baseRust = smoothstep(0.62, 0.85, baseNoise(vBasePos * 0.9 + 7.0)) * baseDrum * 0.1;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.05, 0.028), baseRust);
// The leather of the drum is black where the key from the right does not reach it.
float baseDim = mix(1.0, mix(0.32, 1.0, smoothstep(-16.0, 42.0, vBasePos.x)), baseDrum);
diffuseColor.rgb *= baseDim;
float baseWrap = 0.1;
float baseNear = 1.0 - baseDrum;
float baseCandle = 1.0 / baseDim;
vec2 fibreAt = vec2(vBaseUv1.x * 8.0, vBaseUv1.y * 12.0);
float fibreHere = baseNoise(vec3(fibreAt, 5.0)) * 0.55 + baseNoise(vec3(fibreAt * vec2(2.3, 3.1), 9.0)) * 0.45;
float fibreNext = baseNoise(vec3(fibreAt + vec2(0.0, 0.25), 5.0)) * 0.55 + baseNoise(vec3((fibreAt + vec2(0.0, 0.25)) * vec2(2.3, 3.1), 9.0)) * 0.45;
float fibreOn = baseNoise(vec3(fibreAt + vec2(0.25, 0.0), 5.0)) * 0.55 + baseNoise(vec3((fibreAt + vec2(0.25, 0.0)) * vec2(2.3, 3.1), 9.0)) * 0.45;
float knobHere = baseNoise(vBasePos * 0.6 + 71.0);
float knobOn = baseNoise((vBasePos + foldT * 0.2) * 0.6 + 71.0);
float knobUp = baseNoise((vBasePos + vec3(0.0, 0.2, 0.0)) * 0.6 + 71.0);
diffuseColor.rgb *= mix(1.0, (0.8 + 0.4 * fibreHere) * (0.7 + 0.6 * knobHere), baseStrand);
// The candles spill on the wood that stands beside a face.
baseCandle = mix(baseCandle, mix(BRAMBLE_SPILL, 0.6 * BRAMBLE_SPILL, baseThorn), 1.0 - baseDrum);
`
const IRON_ROUGH = `
roughnessFactor = clamp(mix(0.38 + 0.22 * fibreHere - 0.06 * baseThorn * vBasePaint.z, 0.74 + 0.14 * baseScale + 0.2 * baseRust, baseDrum), 0.18, 1.0);
metalnessFactor = mix(0.2, mix(0.85, 0.6, baseScale) * (1.0 - 0.6 * baseRust), baseDrum);
`
const IRON_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 0.3 + 3.0), baseNoise(vBasePos * 0.3 + 31.0)) - 0.5) * 0.5 * baseDrum + vec2(foldHere - foldOn, foldHere - foldUp) * (DRUM_FOLD * baseDrum) + vec2(crinkleHere - crinkleOn, crinkleHere - crinkleUp) * (DRUM_CRINKLE * baseDrum) + vec2(grainHere - grainOn, grainHere - grainUp) * (DRUM_GRAIN * baseDrum) + vec2(knobHere - knobOn, knobHere - knobUp) * (BRAMBLE_KNOB * baseStrand) + vec2(grainHere - grainOn, grainHere - grainUp) * (BARK_GRAIN * baseStrand * mix(0.25, 1.0, smoothstep(-18.0, -44.0, vBasePos.x))) + vec2(fibreOn - fibreHere, fibreNext - fibreHere) * (BRAMBLE_BARK * baseStrand * mix(1.0, 0.25, smoothstep(-22.0, -47.0, vBasePos.x)));
`
const IRON_AFTER = `
{
  vec3 ironKey = vec3(0.0, 1.0, 0.0);
  vec3 ironKeyC = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  ironKey = stageKeyL;
  ironKeyC = stageKeyC * stageKeyS;
  #elif NUM_DIR_LIGHTS > 0
  ironKey = directionalLights[0].direction;
  ironKeyC = directionalLights[0].color;
  #endif
  // The drum's sheen takes the key without its shadow: at this grazing angle the shadow map's own grid lay on the
  // leather as a weave. The vines' shade on the drum is in its paint.
  vec3 ironKeyOpen = ironKeyC;
  #ifdef STAGE_LIGHT_DONE
  ironKeyOpen = stageKeyC;
  #endif
  vec3 ironBefore = reflectedLight.directSpecular;
  vec3 ironRound = normalize(nonPerturbedNormal);
  vec3 ironCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float ironKh = max(dot(geometryNormal, normalize(ironKey + geometryViewDir)), 0.0);
  float ironCh = max(dot(geometryNormal, normalize(ironCard + geometryViewDir)), 0.0);
  float ironKl = smoothstep(0.0, 0.2, dot(geometryNormal, ironKey));
  float ironCl = smoothstep(0.0, 0.25, dot(geometryNormal, ironCard));
  float ironSheen = (1.0 - 0.45 * baseScale) * baseAo * (1.0 - 0.4 * baseDrum);
  float ironGrain = 0.82 + 0.36 * fibreHere;
  vec3 ironRim = normalize(mat3(viewMatrix) * uBaseRimDir);
  float ironRh = max(dot(geometryNormal, normalize(ironRim + geometryViewDir)), 0.0);
  float ironRl = smoothstep(0.0, 0.25, dot(geometryNormal, ironRim));
  // How far to the left a place is: the warm light of the card and of the lamps behind reaches the tangle there and
  // leaves the front of the ring cold.
  float ironWest = smoothstep(-18.0, -44.0, vBasePos.x);
  float ironEast = smoothstep(20.0, 46.0, vBasePos.x);
  vec3 ironRimC = mix(vec3(dot(uBaseRimCol, vec3(0.3, 0.5, 0.2))), uBaseRimCol, mix(0.35, 1.0, ironWest));
  reflectedLight.directSpecular += ironRimC * (0.03 * pow(abs(ironRh), 7.0) + mix(0.1 * pow(abs(ironRh), 40.0), BRAMBLE_RIM * mix(BRAMBLE_RIM_FRONT, 1.0, ironWest) * pow(abs(ironRh), 16.0), baseStrand) * (1.0 - baseDrum)) * ironRl * ironSheen;
  vec3 ironCardC = mix(uRigCardCol, vec3(dot(uRigCardCol, vec3(0.3, 0.5, 0.2))), 0.65 * (1.0 - ironWest)) * mix(vec3(1.0), vec3(1.0, 0.86, 1.0), ironWest);
  reflectedLight.directSpecular += (mix(ironKeyC, ironKeyOpen * baseAo, baseDrum) * vec3(0.8, 0.9, 1.0) * (mix(0.03, 0.4 * baseDim, baseDrum) * pow(abs(ironKh), mix(8.0, 9.0, baseDrum)) + mix(0.15 * pow(abs(ironKh), 40.0) * baseThorn, BRAMBLE_KEY * (1.0 + BRAMBLE_KEY_EAST * ironEast) * pow(abs(ironKh), mix(14.0, 80.0, ironEast)) * ironGrain, baseStrand)) * ironKl + ironCardC * (0.03 * pow(abs(ironCh), 10.0) + mix(0.08 * pow(abs(ironCh), 40.0) * baseThorn, BRAMBLE_CARD * (BRAMBLE_CARD_FRONT + BRAMBLE_CARD_WEST * ironWest * mix(1.0, 0.4, smoothstep(20.0, 34.0, vBasePos.y))) * pow(abs(ironCh), mix(16.0, 70.0, ironWest)) * mix(1.0, pow(abs(max(dot(ironRound, normalize(ironCard + geometryViewDir)), 0.0)), 10.0), ironWest), baseStrand)) * ironCl) * ironSheen;
  // The key rakes the bare leather of the right flank: a broad grey sheen, grained by the hide.
  reflectedLight.directSpecular += ironKeyOpen * vec3(0.56, 0.84, 1.3) * DRUM_SHEEN * pow(abs(ironKh), 7.0) * ironKl * baseDrum * smoothstep(8.0, 46.0, vBasePos.x) * (0.2 + 1.1 * smoothstep(0.05, 0.55, foldHere)) * (0.55 + 0.75 * smoothstep(0.05, 0.6, crinkleHere)) * baseAo;
  float ironEdge = pow(abs(1.0 - clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0)), 3.0);
  vec3 ironUp = inverseTransformDirection(geometryNormal, viewMatrix);
  float ironWarm = clamp(dot(ironUp, normalize(vec3(uBaseRimDir.x, uBaseRimDir.y * 0.25, uBaseRimDir.z))) * 0.5 + 0.5, 0.0, 1.0);
  float ironLeft = clamp(dot(ironUp, normalize(vec3(-0.8, 0.25, 0.55))), 0.0, 1.0);
  // Only the ridge of a vine that faces the lamps is lit, a third of its width; the knobs and the grain break it there.
  float ironRidge = mix(1.0, pow(abs(clamp(dot(inverseTransformDirection(ironRound, viewMatrix), normalize(vec3(uBaseRimDir.x, uBaseRimDir.y * 0.25, uBaseRimDir.z))) * 0.5 + 0.5, 0.0, 1.0)), 26.0), baseStrand * ironWest);
  reflectedLight.directSpecular += uBaseRimCol * mix(vec3(1.0, 0.72, 0.5), mix(vec3(1.0, 0.6, 0.36), vec3(1.0, 0.86, 1.0), ironWest), baseStrand) * (mix(0.45 * baseDrum, BRAMBLE_WARM, baseStrand) * pow(abs(ironWarm), mix(5.0, mix(26.0, 110.0, ironWest), baseStrand)) + mix(0.1 * baseDrum, 0.05 * BRAMBLE_WARM, baseStrand) * pow(abs(ironLeft), mix(5.0, 20.0, baseStrand))) * mix(0.25, 1.0, baseAo) * (1.0 - 0.8 * baseDrum) * (0.4 + 1.2 * baseBlotch) * mix(1.0, ironGrain, baseStrand * (1.0 - ironWest)) * mix(1.0, BRAMBLE_WARM_FRONT + BRAMBLE_WARM_WEST * ironWest * mix(1.0, 0.4, smoothstep(20.0, 34.0, vBasePos.y)), baseStrand) * ironRidge;
  vec3 ironTop = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
  float ironTh = max(dot(geometryNormal, normalize(ironTop + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * vec3(0.92, 0.98, 1.1) * BRAMBLE_TOP + ironKeyC * 0.03) * pow(abs(ironTh), mix(9.0, 7.0, baseStrand)) * smoothstep(0.0, 0.3, dot(geometryNormal, ironTop)) * ironGrain * ironSheen * (1.0 - baseDrum);
  // A thorn is black with one soft cool face turned up, so its edge is drawn against what stands behind it.
  reflectedLight.directSpecular += vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * vec3(0.84, 0.95, 1.18) * (BRAMBLE_THORN * (1.0 + 2.0 * ironEast) * pow(abs(ironTh), 10.0) * smoothstep(0.0, 0.3, dot(geometryNormal, ironTop)) * baseThorn * smoothstep(0.2, 0.7, baseAo));
  // One long narrow highlight along the upper edge of a vine, read from the tube's own round and not from its bark,
  // and never narrower than a pixel and a half: the lobe widens by what the normal turns across a pixel.
  vec3 lineRound = ironRound;
  vec3 lineN = normalize(mix(lineRound, geometryNormal, 0.75));
  vec3 lineL = normalize(mat3(viewMatrix) * vec3(0.2, 1.0, 0.3));
  float lineTurn = dot(dFdx(lineRound), dFdx(lineRound)) + dot(dFdy(lineRound), dFdy(lineRound));
  float lineTight = mix(BRAMBLE_LINE_POW, 110.0, ironEast);
  float linePow = lineTight / (1.0 + lineTight * BRAMBLE_LINE_WIDE * min(lineTurn, 1.0));
  float lineH = max(dot(lineN, normalize(lineL + geometryViewDir)), 0.0);
  float lineRun = (0.55 + 0.7 * baseNoise(vec3(vBaseUv1.x * 1.6, 3.0, 17.0))) * mix(1.0, 0.55 + 0.9 * fibreHere, ironEast);
  reflectedLight.directSpecular += vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * vec3(0.84, 0.95, 1.18) * (BRAMBLE_LINE * sqrt(linePow / lineTight) * pow(abs(lineH), linePow) * smoothstep(0.0, 0.3, dot(lineN, lineL)) * lineRun * smoothstep(0.15, 0.6, baseAo) * mix(baseStrand, 0.6, baseThorn) * (1.0 - 0.5 * ironWest) * (1.0 + BRAMBLE_LINE_EAST * ironEast) * mix(1.0, 0.45, smoothstep(-8.0, 2.0, vBasePos.x) * (1.0 - ironEast)));
  float lineFace = clamp(dot(lineRound, geometryViewDir), 0.0, 1.0);
  // The wood is never quite black: the sky lifts it, and at the left the lamps behind fill it warm.
  reflectedLight.indirectDiffuse += (vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * vec3(0.9, 0.96, 1.15) * BRAMBLE_LIFT * (1.0 + BRAMBLE_LIFT_WEST * ironWest) + uBaseRimCol * vec3(1.0, 0.45, 0.4) * BRAMBLE_FILL * ironWest * (0.4 + 0.6 * ironLeft)) * mix(0.35, 1.0, baseAo) * mix(1.0, 0.8, baseDrum) * mix(1.0, 0.15, baseThorn) * mix(1.0, lineFace * lineFace, baseStrand);
  reflectedLight.directSpecular = ironBefore + (reflectedLight.directSpecular - ironBefore) * baseDim;
  ironEdge *= baseDim;
  reflectedLight.indirectSpecular += (uRigSky * 0.35 * smoothstep(-0.2, 0.8, ironUp.y) + uBaseFloor * smoothstep(0.2, -0.8, ironUp.y)) * ironEdge * ironSheen * (1.0 - 0.7 * baseThorn);
}
`

// The pumpkins. The first coordinates of a vertex lie on the face (0.5 the middle of it); the paint is its shade, which face
// it belongs to and which of the four carvings it wears. An opening is cut by the carving's distance map; behind it a
// second reading of the map, moved by the thickness of the rind along the line of sight, leaves the cut wall in view.
const PUMPKIN_PAINT = `
int faceId = int(vBasePaint.y * 8.0);
float faceCell = floor(vBasePaint.z * 4.0);
float faceStem = step(0.9, vBasePaint.z);
vec2 faceOrigin = vec2(mod(faceCell, 2.0), floor(faceCell * 0.5));
vec3 faceOutward = vec3(uFaceOut[faceId].x, 0.0, uFaceOut[faceId].y);
vec3 faceRight = vec3(faceOutward.z, 0.0, -faceOutward.x);
vec3 faceEye = normalize(normalize(vViewPosition) * normalMatrix);
vec3 faceLine = vec3(dot(faceEye, faceRight), faceEye.y, max(dot(faceEye, faceOutward), 0.3));
vec2 faceUv = vBaseUv1;
vec2 faceIn = faceUv - faceLine.xy / faceLine.z * uFaceRind;
float faceInside = step(0.02, faceUv.x) * step(faceUv.x, 0.98) * step(0.02, faceUv.y) * step(faceUv.y, 0.98) * (1.0 - faceStem);
float faceD = (texture2D(uFaceMap, vec2((faceOrigin.x + faceUv.x) * 0.5, 1.0 - (faceOrigin.y + 1.0 - faceUv.y) * 0.5)).r - 0.5) * 2.0 * uFaceRange;
float faceD2 = (texture2D(uFaceMap, vec2((faceOrigin.x + clamp(faceIn.x, 0.02, 0.98)) * 0.5, 1.0 - (faceOrigin.y + 1.0 - clamp(faceIn.y, 0.02, 0.98)) * 0.5)).r - 0.5) * 2.0 * uFaceRange;
float faceAa = max(fwidth(faceD), 0.005);
float faceOpen = smoothstep(-faceAa, faceAa, faceD) * faceInside;
float faceThrough = smoothstep(-faceAa, faceAa, faceD2) * faceInside;
float faceGlowing = uFaceGlow[faceId];
float baseAo = vBasePaint.x;
float faceRib = baseNoise(vBasePos * 1.7) * 0.6 + baseNoise(vBasePos * 5.0) * 0.4;
float faceShade = smoothstep(15.0, 21.0, vBasePos.x) * step(0.0, vBasePos.z);
float faceWest = smoothstep(-15.0, -21.0, vBasePos.x) * step(0.0, vBasePos.z);
diffuseColor.rgb = mix(mix(vec3(0.07, 0.026, 0.01), vec3(0.16, 0.06, 0.022), faceRib), mix(vec3(0.02, 0.022, 0.028), vec3(0.05, 0.054, 0.066), faceRib), 0.8 * faceShade) * mix(0.35, 1.0, smoothstep(0.1, 0.8, baseAo)) * mix(1.0, 0.5, faceStem);
float faceNear = exp(-max(-faceD, 0.0) / 0.03);
float faceSoft = exp(-max(-faceD, 0.0) / 0.13);
vec3 faceCandle = uFaceCol * faceGlowing;
float faceLow = smoothstep(0.75, 0.2, faceUv.y);
// Each candle stands where it was set down: the hot place of a face is its own.
vec2 faceWick = vec2(0.5 + 0.13 * sin(float(faceId) * 2.4 + 0.7), 0.3 + 0.09 * cos(float(faceId) * 1.7));
float faceHot = exp(-dot(faceIn - faceWick, faceIn - faceWick) / 0.13);
vec3 faceCave = mix(vec3(1.0, 0.4, 0.07), vec3(1.0, 0.66, 0.28), faceHot) * (1.1 + 1.3 * faceHot) * (0.75 + 0.5 * baseNoise(vec3(faceUv * 9.0, 3.0)));
vec3 faceWall = vec3(1.0, 0.24, 0.02) * (0.5 + 0.6 * baseNoise(vec3(faceUv * 40.0, 7.0)));
float faceBevel = smoothstep(0.0, 0.03, faceD);
vec3 faceLight = mix(faceWall * mix(0.3, 1.0, faceBevel), faceCave, faceThrough * smoothstep(0.0, 0.018, faceD)) * faceGlowing * uFacePower;
float faceRidge = smoothstep(0.25, 0.85, baseAo);
// The rind is thin enough to carry the candle: the skin glows round the openings and holds a low ember all over,
// deeper in the ribs' ridges than in their grooves.
float faceStreak = baseNoise(vec3(faceUv.x * 30.0 + 3.0 * faceRib, faceUv.y * 2.2, float(faceId) * 5.0));
float faceBody = exp(-dot(faceUv - vec2(0.5, 0.45), faceUv - vec2(0.5, 0.45)) / 0.26);
vec3 faceSkin = faceGlowing * (vec3(1.0, 0.3, 0.04) * 0.2 * faceNear + vec3(1.0, 0.2, 0.02) * (0.06 * faceSoft * faceSoft + 0.008 * faceSoft + 0.002) * (0.1 + 0.9 * faceRidge) * (0.7 + 0.6 * faceRib) + vec3(1.0, 0.28, 0.09) * (PUMPKIN_BODY * faceBody * (1.0 - 0.8 * faceShade) * (1.0 - 0.68 * faceWest)) * (0.35 + 0.65 * faceRidge) * (0.3 + 0.5 * faceRib + 0.9 * faceStreak)) * (1.0 - faceStem);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.006, 0.002), faceOpen);
totalEmissiveRadiance += mix(faceSkin + vec3(0.6, 0.4, 0.3) * (0.008 * faceWest * (0.4 + 0.6 * faceRib) * (1.0 - faceStem)), faceLight, faceOpen);
float baseWrap = 0.3;
float baseNear = 0.0;
float baseCandle = 0.0;
`
const PUMPKIN_ROUGH = `
roughnessFactor = mix(0.42 + 0.2 * faceRib, 0.9, faceOpen);
metalnessFactor = 0.0;
`
const PUMPKIN_TILT = `
vec2 baseTilt = ((vec2(baseNoise(vBasePos * 3.3 + 11.0), baseNoise(vBasePos * 3.3 + 47.0)) - 0.5) * 0.7 + (vec2(baseNoise(vBasePos.yzx * 6.1 + 23.0), baseNoise(vBasePos.zxy * 6.1 + 59.0)) - 0.5) * 0.5) * (1.0 - faceOpen);
`

// The wax: pale, soft, thick where it has gathered. Light enters it and comes out again round the edges.
const WAX_PAINT = `
float baseAo = vBasePaint.x * mix(0.25, 1.0, smoothstep(39.7, 39.25, vBasePos.y));
float waxDeep = vBasePaint.y;
float waxMottle = baseNoise(vBasePos * 0.9) * 0.6 + baseNoise(vBasePos * 3.7) * 0.4;
diffuseColor.rgb = mix(vec3(0.95, 0.88, 0.66), vec3(0.88, 0.72, 0.42), smoothstep(0.15, 0.8, waxDeep) * (0.5 + 0.5 * waxMottle)) * mix(0.92, 1.06, waxMottle);
// A run thins toward its tip, and the thin wax is the warmer for the light in it.
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.82, 0.54), 0.55 * smoothstep(0.5, 1.0, vBasePaint.z));
float baseWrap = 0.55;
float baseNear = 0.0;
float baseCandle = 0.5;
`
const WAX_ROUGH = `
roughnessFactor = 0.14 + 0.14 * waxMottle;
metalnessFactor = 0.0;
`
const WAX_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 1.9 + 3.0), baseNoise(vBasePos * 1.9 + 31.0)) - 0.5) * 0.22 + (vec2(baseNoise(vBasePos * 6.0 + 13.0), baseNoise(vBasePos * 6.0 + 71.0)) - 0.5) * 0.05;
`
const WAX_AFTER = `
{
  vec3 waxKey = vec3(0.0, 1.0, 0.0);
  vec3 waxKeyC = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  waxKey = stageKeyL;
  waxKeyC = stageKeyC * stageKeyS;
  #elif NUM_DIR_LIGHTS > 0
  waxKey = directionalLights[0].direction;
  waxKeyC = directionalLights[0].color;
  #endif
  vec3 waxCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float waxK = clamp(dot(nonPerturbedNormal, waxKey) * 0.5 + 0.5, 0.0, 1.0);
  float waxC = clamp(dot(nonPerturbedNormal, waxCard) * 0.5 + 0.5, 0.0, 1.0);
  float waxThin = 1.0 - 0.6 * smoothstep(0.2, 0.9, waxDeep);
  vec3 waxThrough = vec3(1.0, 0.85, 0.6);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * waxThrough * (waxKeyC * 2.2 * waxK * waxK + uRigCardCol * 0.12 * waxC * waxC) * waxThin * baseAo;
  float waxEdge = pow(abs(1.0 - clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0)), 2.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * waxThrough * vec3(dot(waxKeyC * 0.5 + uRigCardCol * 0.15 + uRigSky * 3.2, vec3(0.3, 0.5, 0.2))) * mix(0.1, 1.0, waxEdge) * baseAo;
  vec3 waxTop = normalize(mat3(viewMatrix) * vec3(0.25, 1.0, 0.35));
  float waxTh = max(dot(geometryNormal, normalize(waxTop + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * 5.0 + waxKeyC * 0.1) * (1.6 * pow(abs(waxTh), 90.0) + 0.12 * pow(abs(waxTh), 9.0)) * baseAo;
  vec3 waxSide = normalize(mat3(viewMatrix) * vec3(-0.7, 0.45, 0.55));
  float waxSh = max(dot(geometryNormal, normalize(waxSide + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * 9.0 * pow(abs(waxSh), 120.0) + waxKeyC * (1.6 * pow(max(dot(geometryNormal, normalize(waxKey + geometryViewDir)), 0.0), 90.0) + 0.2 * pow(max(dot(geometryNormal, normalize(waxKey + geometryViewDir)), 0.0), 14.0))) * baseAo;
  float waxH = max(dot(geometryNormal, normalize(waxKey + geometryViewDir)), 0.0);
  float waxHc = max(dot(geometryNormal, normalize(waxCard + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (waxKeyC * (0.9 * pow(abs(waxH), 40.0) + 0.14 * pow(abs(waxH), 8.0)) * smoothstep(0.0, 0.2, dot(geometryNormal, waxKey)) + uRigCardCol * (0.4 * pow(abs(waxHc), 60.0) + 0.03 * pow(abs(waxHc), 8.0)) * smoothstep(0.0, 0.2, dot(geometryNormal, waxCard))) * baseAo;
}
`

const WEB_VERT_PARS = `
attribute vec3 color;
varying vec2 vWebUv;
varying vec3 vWebPaint;
varying vec3 vWebNormal;
`
const WEB_VERT_MAIN = `
vWebUv = uv;
vWebPaint = color;
vWebNormal = normalize(mat3(modelMatrix) * normal);
`
const WEB_FRAG = `
uniform vec3 uBaseKeyDir;
uniform vec3 uBaseKeyCol;
uniform vec3 uBaseRimDir;
uniform vec3 uBaseRimCol;
uniform vec3 uBaseSky;
varying vec2 vWebUv;
varying vec3 vWebPaint;
varying vec3 vWebNormal;
float webLine(float x, float width) {
  float d = abs(fract(x + 0.5) - 0.5) / max(fwidth(x), 1e-4);
  return 1.0 - smoothstep(width, width + 1.0, d);
}
float webHash(float n) {
  return fract(sin(n * 91.7) * 43758.5453);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  float sheet = floor(vWebPaint.y * 4.0);
  float big = 1.0 - step(0.5, sheet);
  float spokes = mix(5.0, 8.0, big);
  float u = vWebUv.x * spokes + 0.03 * sin(vWebUv.x * 17.0 + sheet);
  float cell = floor(u);
  float between = sin(fract(u) * 3.14159265);
  float rings = mix(7.0, 8.0, big);
  float v = pow(abs(vWebUv.y), 0.8) * rings - 0.08 * between * between + 0.3 * webHash(cell + sheet * 17.0) + 0.2 * fract(u) * (webHash(cell * 3.0 + sheet) - 0.5);
  float gapped = step(0.22, webHash(floor(v) * 13.0 + cell * 7.0 + sheet * 3.0));
  // No two threads alike: each its own weight, a third of them broken part of the way down, the loose end gone.
  float strand = floor(u + 0.5) + sheet * 5.0;
  float broken = step(0.66, webHash(strand * 3.3)) * step(0.3 + 0.5 * webHash(strand * 5.9), vWebUv.y);
  float spoke = webLine(u, 0.15 * webHash(strand * 7.7) * webHash(strand * 2.1)) * (0.3 + 0.7 * webHash(strand) * webHash(strand * 1.9 + 4.0)) * (1.0 - broken);
  // Beads of dew strung along a thread, far apart.
  float beadAt = vWebUv.y * 46.0 + 9.0 * webHash(strand * 4.3);
  float bead = step(0.9, webHash(floor(beadAt) + strand * 13.0)) * (1.0 - smoothstep(0.6, 1.6, abs(fract(beadAt) - 0.5) / max(fwidth(beadAt), 1e-4))) * webLine(u, 0.5) * (1.0 - broken);
  float ring = webLine(v, 0.0) * gapped * smoothstep(0.06, 0.16, vWebUv.y);
  float edge = max(webLine(vWebUv.x * 0.999 + 0.0005, 0.3), 0.0);
  float glint = 0.45 + 1.3 * pow(abs(sin(vWebUv.y * 8.0 + cell * 2.1 + vWebUv.x * 5.0)), 5.0);
  float thread = max(max(spoke, ring * 0.25), edge * 0.6) * glint;
  float dew = max(smoothstep(0.8, 1.0, webHash(floor(v * 3.0) + cell * 5.0)) * ring, bead * 0.9);
  vec3 view = normalize(cameraPosition - vStageWorld);
  float back = pow(max(dot(-view, uBaseRimDir) * 0.5 + 0.5, 0.0), 2.0);
  float fore = pow(max(dot(view, uBaseKeyDir) * 0.5 + 0.5, 0.0), 2.0);
  vec3 lit = uBaseKeyCol * (0.35 + 0.5 * fore) + uBaseRimCol * (0.1 + 0.5 * back) + uBaseSky * 0.8;
  lit = mix(lit, vec3(dot(lit, vec3(0.3, 0.5, 0.2))), 0.7);
  float tear = smoothstep(0.25, 0.6, webHash(floor(u * 0.5) + sheet * 9.0) + 0.5 * sin(vWebUv.y * 7.0 + cell));
  float veil = (0.006 + 0.015 * pow(abs(sin(u * 9.0 + 3.0 * sin(vWebUv.y * 5.0 + sheet))), 6.0) * webHash(floor(u * 2.87) + sheet)) * smoothstep(0.0, 0.3, vWebUv.y) * tear;
  float a = clamp(thread * 0.36 + veil * 0.6 + dew * 0.15, 0.0, 1.0) * smoothstep(0.0, 0.03, vWebUv.y);
  gl_FragColor = vec4(lit * vec3(0.9, 0.94, 1.0) * (1.5 + 1.3 * dew) * a, a);
  if (uDiag != 0) {
    if (a < 0.2) discard;
    gl_FragColor = stageDiag(vec3(0.8, 0.82, 0.85), normalize(vWebNormal), 0.0, c, 0.0);
  }
}
`

export async function prepare(): Promise<void> {
  await prepareModel(MODEL)
}

function solid(name: string, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry(MODEL, name), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function base(): THREE.Object3D {
  const group = new THREE.Group()
  const lit = { part: PART, standIn: false, change: 'base' }
  const extras = geometry(MODEL, 'pumpkin').userData.extras as FaceExtras
  faceList = extras.faces
  if (faceList.length !== FACE_COUNT) throw new Error(`${PART}: ${faceList.length} faces in the model, ${FACE_COUNT} in the shader`)
  const rad = Math.PI / 180
  faceUniforms.uFaceAt.value = faceList.map((f) => new THREE.Vector3(f.r * Math.sin(f.az * rad), f.h, f.r * Math.cos(f.az * rad)))
  faceUniforms.uFaceOut.value = faceList.map((f) => new THREE.Vector4(Math.sin(f.az * rad), Math.cos(f.az * rad), Math.max(f.rad, f.tall), f.cell))
  faceUniforms.uFaceGlow.value = faceList.map(() => 1)
  const rng = stream(`${PART}/candles`)
  flicker.length = 0
  for (let i = 0; i < FACE_COUNT; i++) flicker.push({ a: rng.range(0, 1), b: rng.range(0, 1), c: rng.range(0, 1) })

  const detail = { uBaseDetail: { value: map('iron-detail.lin.tile.w1024') } }
  const iron = stageMaterial({
    ...lit,
    key: `${PART}-iron`,
    physical: true,
    metalness: 0.8,
    hook: hookOf(detail, { pars: IRON_PARS, paint: IRON_PAINT, rough: IRON_ROUGH, tilt: IRON_TILT, after: SHADE + IRON_AFTER }),
  })
  const pumpkin = stageMaterial({
    ...lit,
    key: `${PART}-pumpkin`,
    physical: true,
    hook: hookOf(
      { ...detail, uFaceMap: { value: map('faces.lin.w1024') }, uFaceRange: { value: extras.faceRange }, uFaceRind: { value: 0.2 }, uFacePower: { value: 3.1 } },
      { pars: `uniform sampler2D uFaceMap;\nuniform float uFaceRange;\nuniform float uFaceRind;\nuniform float uFacePower;\n#define PUMPKIN_BODY ${PUMPKIN_BODY.toFixed(4)}`, paint: PUMPKIN_PAINT, rough: PUMPKIN_ROUGH, tilt: PUMPKIN_TILT, after: SHADE },
    ),
  })
  const wax = stageMaterial({
    ...lit,
    key: `${PART}-wax`,
    physical: true,
    hook: hookOf(detail, { paint: WAX_PAINT, rough: WAX_ROUGH, tilt: WAX_TILT, after: SHADE + WAX_AFTER }),
  })
  const web = stageShader({
    ...lit,
    vertexPars: WEB_VERT_PARS,
    vertexMain: WEB_VERT_MAIN,
    fragment: WEB_FRAG,
    params: { transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor },
    uniforms: { ...baseUniforms },
  })
  // The slab is drawn after the globe, so threads strung over the slab are drawn with the floor (slab.ts adds them
  // there) and follow the base by its matrix.
  threads = new THREE.Mesh(geometry(MODEL, 'web'), web)
  threads.renderOrder = 4
  threads.frustumCulled = false
  threads.matrixAutoUpdate = false
  threads.matrixWorldAutoUpdate = false
  threads.onBeforeRender = () => {
    threads!.matrixWorld.copy(group.matrixWorld)
  }
  group.add(solid('iron', iron), solid('pumpkin', pumpkin), solid('wax', wax))
  return group
}

let threads: THREE.Mesh | null = null
/** The cobweb, for the floor's group: it hangs from the base and is drawn after the slab it is seen against. */
export function cobweb(): THREE.Object3D {
  if (!threads) throw new Error(`${PART}: the cobweb is asked for before the base`)
  return threads
}

// A rise from 0 to 1 that starts and ends with no slope (a critically damped step): 0.26 at `tau`, 0.8 at three of them.
const ease = (t: number, tau: number): number => (t > 0 ? 1 - (1 + t / tau) * Math.exp(-t / tau) : 0)

// How lit a face is `seconds` after the landing: nothing before its turn, then the ember it never falls under again,
// then the rise to its whole light.
export function faceLevel(index: number, seconds: number): number {
  const lit = seconds - (LIGHT.catchSeconds[index] ?? 1)
  if (!(lit > 0)) return 0
  if (!(lit < Infinity)) return 1
  const over = 0.08 * Math.exp(-(((lit - 0.14) / 0.08) ** 2))
  const tremble = (1 - LIGHT.floor) * Math.exp(-lit / 0.7) * Math.sin(lit * 19 + index * 2.3) * Math.sin(lit * 7 + index * 5.1)
  const ember = LIGHT.ember * ease(lit, 0.03) * (1 + over + tremble)
  const t = seconds - (LIGHT.takeSeconds[index] ?? 4)
  if (!(t > 0)) return ember
  return ember + (1 - LIGHT.ember) * (LIGHT.flare * ease(t, LIGHT.flareSeconds) + (1 - LIGHT.flare) * (1 - Math.exp(-t / LIGHT.creepSeconds)))
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  baseUniforms.uBaseKeyDir.value.copy(f.keyDir)
  baseUniforms.uBaseKeyCol.value.copy(f.keyCol)
  baseUniforms.uBaseRimDir.value.copy(f.rimDir)
  baseUniforms.uBaseRimCol.value.copy(f.rimCol)
  baseUniforms.uBaseSky.value.copy(f.sky).multiplyScalar(f.fill)
  const card = lightUniforms.uRigCardCol.value
  const lift = (FLOOR_SHARE / Math.PI) * Math.max(lightUniforms.uRigCardDir.value.y, 0)
  const down = (FLOOR_SHARE / Math.PI) * Math.max(f.keyDir.y, 0)
  baseUniforms.uBaseFloor.value.setRGB(f.keyCol.r * down + card.r * lift, f.keyCol.g * down + card.g * lift, f.keyCol.b * down + card.b * lift)
}

/** The candles on this frame: `seconds` since the landing they answer (0 and under: none lit yet; Infinity: all lit). */
export function setCandles(moment: KitMoment, seconds: number): void {
  const glow = faceUniforms.uFaceGlow.value
  const turn = (moment.time / moment.period) * 2 * Math.PI
  for (let i = 0; i < glow.length; i++) {
    const k = flicker[i]!
    const candle = 1 + 0.1 * Math.sin(turn * 5 + k.a * 6.283) + 0.07 * Math.sin(turn * 11 + k.b * 6.283) + 0.05 * Math.sin(turn * 23 + k.c * 6.283) + 0.03 * Math.sin(turn * 37 + k.a * 17)
    // No two candles are the same height: each face has its own share of light.
    glow[i] = faceLevel(i, seconds) * candle * (0.74 + 0.36 * k.c)
  }
}
