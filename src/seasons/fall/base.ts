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

// The candles. On the landing each wick catches (`catchSeconds`): a spit of flame that all but dies, then holds low at
// `ember` of its light with a tremble that fades; then each face takes (`takeSeconds`): a flare of `flare` of what is
// left inside `flareSeconds`, and a creep to the whole of it over `creepSeconds`. The three a viewer faces never light
// in the order they stand: the middle one, then the right, then the left, at uneven gaps. All three are alight half a
// second after the landing, because that is the moment of the approved shake image, which shows them lit; the four
// behind follow over the next three seconds in a shuffled order (the arrival's spread).
const LIGHT = {
  catchSeconds: [0.2, 0.04, 0.1, 0.6, 1.9, 0.3, 1.0],
  takeSeconds: [0.44, 0.2, 0.34, 1.1, 2.5, 0.8, 1.6],
  ember: 0.42,
  flare: 0.7,
  flareSeconds: 0.07,
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
    float candleFall = uFaceGlow[i] * candleCone * uFaceOut[i].z * uFaceOut[i].z / (candleFar * candleFar + 0.35 * uFaceOut[i].z * uFaceOut[i].z);
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

// Wrought iron, blackened: the drum, the strands and the thorns. The paint of a vertex is its shade, its kind (0 the drum,
// a half the strands, 1 the thorns) and how far along a thorn it is.
const IRON_PAINT = `
vec4 baseDetail = texture2D(uBaseDetail, vBaseUv1);
float baseAo = vBasePaint.x * mix(0.2, 1.0, smoothstep(39.6, 38.9, vBasePos.y));
float baseKind = vBasePaint.y;
float baseThorn = step(0.75, baseKind);
float baseDrum = 1.0 - step(0.25, baseKind);
float baseBlotch = baseNoise(vBasePos * 0.35) * 0.6 + baseNoise(vBasePos * 1.3) * 0.4;
float baseScale = smoothstep(0.52, 0.8, baseNoise(vBasePos * 2.6) * 0.6 + baseDetail.b * 0.4);
diffuseColor.rgb = mix(vec3(0.028, 0.03, 0.034), vec3(0.05, 0.046, 0.044), baseBlotch) * mix(1.0, 0.72, baseScale) * mix(1.0, 0.6, baseDrum);
float baseRust = smoothstep(0.62, 0.85, baseNoise(vBasePos * 0.9 + 7.0)) * (1.0 - baseThorn) * 0.35;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.05, 0.028), baseRust);
// The leather of the drum is black where the key from the right does not reach it.
float baseDim = mix(1.0, mix(0.32, 1.0, smoothstep(-16.0, 42.0, vBasePos.x)), baseDrum);
diffuseColor.rgb *= baseDim;
float baseWrap = 0.1;
float baseCandle = 3.6 / baseDim;
// Bark on the vines: near black, a faint grain that runs along them and a fine pebbled skin that glints.
float baseStrand = (1.0 - baseThorn) * (1.0 - baseDrum);
vec2 fibreAt = vec2(vBaseUv1.x * 1.3, vBaseUv1.y * 7.0);
float fibreHere = baseNoise(vec3(fibreAt, 5.0)) * 0.42 + baseNoise(vec3(fibreAt * vec2(2.3, 3.1), 9.0)) * 0.3 + baseNoise(vec3(fibreAt * vec2(4.1, 6.3), 3.0)) * 0.28;
float fibreNext = baseNoise(vec3(fibreAt + vec2(0.0, 0.3), 5.0)) * 0.42 + baseNoise(vec3((fibreAt + vec2(0.0, 0.3)) * vec2(2.3, 3.1), 9.0)) * 0.3 + baseNoise(vec3((fibreAt + vec2(0.0, 0.3)) * vec2(4.1, 6.3), 3.0)) * 0.28;
diffuseColor.rgb *= mix(1.0, 0.45 + 0.6 * fibreHere, baseStrand);
baseCandle = mix(baseCandle, 13.0, baseStrand);
`
const IRON_ROUGH = `
roughnessFactor = clamp(mix(0.44, 0.62, baseDetail.b) + 0.04 * baseStrand + 0.14 * baseScale + 0.2 * baseRust - 0.08 * baseThorn * vBasePaint.z + 0.12 * baseDrum, 0.18, 1.0);
metalnessFactor = mix(0.85, 0.6, baseScale) * (1.0 - 0.6 * baseRust) * (1.0 - 0.35 * baseStrand);
`
const IRON_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * mix(mix(0.12 + 0.3 * baseStrand, 0.14 * (1.0 - vBasePaint.z), baseThorn), 0.75, baseDrum) + vec2(0.0, (fibreNext - fibreHere) * 0.8 * baseStrand);
`
const IRON_AFTER = `
#define IRON_WARM 1.5
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
  vec3 ironBefore = reflectedLight.directSpecular;
  vec3 ironCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float ironKh = max(dot(geometryNormal, normalize(ironKey + geometryViewDir)), 0.0);
  float ironCh = max(dot(geometryNormal, normalize(ironCard + geometryViewDir)), 0.0);
  float ironKl = smoothstep(0.0, 0.2, dot(geometryNormal, ironKey));
  float ironCl = smoothstep(0.0, 0.25, dot(geometryNormal, ironCard));
  float ironSheen = (1.0 - 0.45 * baseScale) * baseAo * (1.0 - 0.4 * baseDrum);
  float ironGlint = 0.55 + 2.2 * pow(baseDetail.b, 3.0);
  vec3 ironRim = normalize(mat3(viewMatrix) * uBaseRimDir);
  float ironRh = max(dot(geometryNormal, normalize(ironRim + geometryViewDir)), 0.0);
  float ironRl = smoothstep(0.0, 0.25, dot(geometryNormal, ironRim));
  reflectedLight.directSpecular += uBaseRimCol * (0.08 * pow(ironRh, 7.0) + mix(0.4 * pow(ironRh, 50.0), 0.3 * pow(ironRh, 36.0), baseStrand)) * ironRl * ironSheen;
  vec3 ironCardC = mix(uRigCardCol, vec3(dot(uRigCardCol, vec3(0.3, 0.5, 0.2))), 0.65);
  reflectedLight.directSpecular += (ironKeyC * vec3(0.8, 0.9, 1.0) * (mix(0.05, 0.4 * baseDim, baseDrum) * pow(ironKh, mix(8.0, 9.0, baseDrum)) + mix((0.14 * pow(ironKh, 10.0) + 1.3 * pow(ironKh, 50.0)) * (0.55 + 0.7 * fibreHere) * ironGlint, 0.6 * pow(ironKh, 44.0) * (0.35 + 0.65 * baseDetail.b), 1.0 - baseStrand)) * ironKl + ironCardC * (0.05 * pow(ironCh, 10.0) + mix(0.26 * pow(ironCh, 50.0), 0.45 * pow(ironCh, 40.0) * ironGlint, baseStrand)) * ironCl) * ironSheen;
  float ironEdge = pow(1.0 - clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0), 3.0);
  vec3 ironUp = inverseTransformDirection(geometryNormal, viewMatrix);
  float ironWarm = clamp(dot(ironUp, normalize(vec3(uBaseRimDir.x, uBaseRimDir.y * 0.25, uBaseRimDir.z))) * 0.5 + 0.5, 0.0, 1.0);
  float ironLeft = clamp(dot(ironUp, normalize(vec3(-0.8, 0.25, 0.55))), 0.0, 1.0);
  reflectedLight.directSpecular += uBaseRimCol * mix(vec3(1.0, 0.72, 0.5), vec3(1.0, 0.6, 0.36), baseStrand) * (IRON_WARM * (mix(0.3, 0.9 * ironGlint, baseStrand) * pow(ironWarm, mix(5.0, 16.0, baseStrand)) + mix(0.07, 0.22 * ironGlint, baseStrand) * pow(ironLeft, mix(5.0, 14.0, baseStrand)))) * mix(0.25, 1.0, baseAo) * (1.0 - 0.8 * baseDrum) * (0.4 + 1.2 * baseBlotch) * (1.0 + 2.5 * smoothstep(-8.0, -46.0, vBasePos.x) * baseStrand);
  vec3 ironTop = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
  float ironTh = max(dot(geometryNormal, normalize(ironTop + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (uRigSky * 1.1 + ironKeyC * 0.03) * pow(ironTh, mix(9.0, 18.0, baseStrand)) * smoothstep(0.0, 0.3, dot(geometryNormal, ironTop)) * (0.5 + 0.7 * fibreHere) * ironSheen * (1.0 - baseDrum);
  reflectedLight.directSpecular = ironBefore + (reflectedLight.directSpecular - ironBefore) * baseDim;
  ironEdge *= (1.0 + 3.0 * baseThorn) * baseDim;
  reflectedLight.indirectSpecular += (uRigSky * 0.35 * smoothstep(-0.2, 0.8, ironUp.y) + uBaseFloor * smoothstep(0.2, -0.8, ironUp.y)) * ironEdge * ironSheen;
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
diffuseColor.rgb = mix(vec3(0.03, 0.012, 0.005), vec3(0.075, 0.03, 0.009), faceRib) * mix(0.35, 1.0, smoothstep(0.1, 0.8, baseAo)) * mix(1.0, 0.5, faceStem);
float faceNear = exp(-max(-faceD, 0.0) / 0.03);
float faceSoft = exp(-max(-faceD, 0.0) / 0.2);
vec3 faceCandle = uFaceCol * faceGlowing;
float faceLow = smoothstep(0.75, 0.2, faceUv.y);
float faceHot = exp(-dot(faceIn - vec2(0.5, 0.3), faceIn - vec2(0.5, 0.3)) / 0.16);
vec3 faceCave = mix(vec3(1.0, 0.4, 0.07), vec3(1.0, 0.66, 0.28), faceHot) * (1.1 + 1.3 * faceHot) * (0.75 + 0.5 * baseNoise(vec3(faceUv * 9.0, 3.0)));
vec3 faceWall = vec3(1.0, 0.24, 0.02) * (0.5 + 0.6 * baseNoise(vec3(faceUv * 40.0, 7.0)));
float faceBevel = smoothstep(0.0, 0.03, faceD);
vec3 faceLight = mix(faceWall * mix(0.3, 1.0, faceBevel), faceCave, faceThrough * smoothstep(0.0, 0.018, faceD)) * faceGlowing * uFacePower;
float faceRidge = smoothstep(0.25, 0.85, baseAo);
vec3 faceSkin = faceGlowing * (vec3(1.0, 0.3, 0.04) * 0.2 * faceNear + vec3(1.0, 0.13, 0.012) * (0.055 * faceSoft * faceSoft + 0.007) * (0.1 + 0.9 * faceRidge) * (0.7 + 0.6 * faceRib)) * (1.0 - faceStem);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.006, 0.002), faceOpen);
totalEmissiveRadiance += mix(faceSkin, faceLight, faceOpen);
float baseWrap = 0.3;
float baseCandle = 0.0;
`
const PUMPKIN_ROUGH = `
roughnessFactor = mix(0.42 + 0.2 * faceRib, 0.9, faceOpen);
metalnessFactor = 0.0;
`
const PUMPKIN_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 3.3 + 11.0), baseNoise(vBasePos * 3.3 + 47.0)) - 0.5) * 0.5 * (1.0 - faceOpen);
`

// The wax: pale, soft, thick where it has gathered. Light enters it and comes out again round the edges.
const WAX_PAINT = `
float baseAo = vBasePaint.x * mix(0.25, 1.0, smoothstep(39.7, 39.25, vBasePos.y));
float waxDeep = vBasePaint.y;
float waxMottle = baseNoise(vBasePos * 0.9) * 0.6 + baseNoise(vBasePos * 3.7) * 0.4;
diffuseColor.rgb = mix(vec3(0.9, 0.83, 0.6), vec3(0.78, 0.6, 0.32), smoothstep(0.15, 0.8, waxDeep) * (0.5 + 0.5 * waxMottle)) * mix(0.9, 1.06, waxMottle);
float baseWrap = 0.55;
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
  float waxEdge = pow(1.0 - clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0), 2.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * waxThrough * vec3(dot(waxKeyC * 0.5 + uRigCardCol * 0.15 + uRigSky * 3.2, vec3(0.3, 0.5, 0.2))) * mix(0.1, 1.0, waxEdge) * baseAo;
  vec3 waxTop = normalize(mat3(viewMatrix) * vec3(0.25, 1.0, 0.35));
  float waxTh = max(dot(geometryNormal, normalize(waxTop + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * 5.0 + waxKeyC * 0.1) * (1.6 * pow(waxTh, 90.0) + 0.12 * pow(waxTh, 9.0)) * baseAo;
  vec3 waxSide = normalize(mat3(viewMatrix) * vec3(-0.7, 0.45, 0.55));
  float waxSh = max(dot(geometryNormal, normalize(waxSide + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (vec3(dot(uRigSky, vec3(0.3, 0.5, 0.2))) * 9.0 * pow(waxSh, 120.0) + waxKeyC * (1.6 * pow(max(dot(geometryNormal, normalize(waxKey + geometryViewDir)), 0.0), 90.0) + 0.2 * pow(max(dot(geometryNormal, normalize(waxKey + geometryViewDir)), 0.0), 14.0))) * baseAo;
  float waxH = max(dot(geometryNormal, normalize(waxKey + geometryViewDir)), 0.0);
  float waxHc = max(dot(geometryNormal, normalize(waxCard + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (waxKeyC * (0.9 * pow(waxH, 40.0) + 0.14 * pow(waxH, 8.0)) * smoothstep(0.0, 0.2, dot(geometryNormal, waxKey)) + uRigCardCol * (0.4 * pow(waxHc, 60.0) + 0.03 * pow(waxHc, 8.0)) * smoothstep(0.0, 0.2, dot(geometryNormal, waxCard))) * baseAo;
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
  float spokes = mix(5.0, 9.0, big);
  float u = vWebUv.x * spokes + 0.42 * sin(vWebUv.x * 17.0 + sheet) + 0.12 * sin(vWebUv.y * 6.0 + vWebUv.x * 31.0);
  float cell = floor(u);
  float between = sin(fract(u) * 3.14159265);
  float rings = mix(7.0, 14.0, big);
  float v = pow(vWebUv.y, 0.8) * rings - 1.1 * between * between + 1.0 * webHash(cell + sheet * 17.0) + 0.5 * fract(u) * (webHash(cell * 3.0 + sheet) - 0.5);
  float gapped = step(0.62, webHash(floor(v) * 13.0 + cell * 7.0 + sheet * 3.0));
  float spoke = webLine(u, 0.0) * (0.3 + 0.5 * webHash(floor(u + 0.5) + sheet * 5.0));
  float ring = webLine(v, 0.0) * gapped * smoothstep(0.06, 0.16, vWebUv.y);
  float edge = max(webLine(vWebUv.x * 0.999 + 0.0005, 0.3), 0.0);
  float glint = 0.45 + 1.3 * pow(abs(sin(vWebUv.y * 8.0 + cell * 2.1 + vWebUv.x * 5.0)), 5.0);
  float thread = max(max(spoke, ring * 0.7), edge * 0.6) * glint;
  float dew = smoothstep(0.8, 1.0, webHash(floor(v * 3.0) + cell * 5.0)) * ring;
  vec3 view = normalize(cameraPosition - vStageWorld);
  float back = pow(max(dot(-view, uBaseRimDir) * 0.5 + 0.5, 0.0), 2.0);
  float fore = pow(max(dot(view, uBaseKeyDir) * 0.5 + 0.5, 0.0), 2.0);
  vec3 lit = uBaseKeyCol * (0.35 + 0.5 * fore) + uBaseRimCol * (0.1 + 0.5 * back) + uBaseSky * 0.8;
  float tear = smoothstep(0.25, 0.6, webHash(floor(u * 0.5) + sheet * 9.0) + 0.5 * sin(vWebUv.y * 7.0 + cell));
  float veil = (0.03 + 0.045 * pow(abs(sin(u * 9.0 + 3.0 * sin(vWebUv.y * 5.0 + sheet))), 6.0) * webHash(floor(u * 2.87) + sheet)) * smoothstep(0.0, 0.3, vWebUv.y) * tear;
  float a = clamp(thread * 0.26 + veil * 1.1 + dew * 0.12, 0.0, 1.0) * smoothstep(0.0, 0.03, vWebUv.y);
  gl_FragColor = vec4(lit * vec3(0.85, 0.9, 0.95) * (0.7 + 1.3 * dew) * a, a);
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
    hook: hookOf(detail, { paint: IRON_PAINT, rough: IRON_ROUGH, tilt: IRON_TILT, after: SHADE + IRON_AFTER }),
  })
  const pumpkin = stageMaterial({
    ...lit,
    key: `${PART}-pumpkin`,
    physical: true,
    hook: hookOf(
      { ...detail, uFaceMap: { value: map('faces.lin.w1024') }, uFaceRange: { value: extras.faceRange }, uFaceRind: { value: 0.2 }, uFacePower: { value: 3.1 } },
      { pars: 'uniform sampler2D uFaceMap;\nuniform float uFaceRange;\nuniform float uFaceRind;\nuniform float uFacePower;', paint: PUMPKIN_PAINT, rough: PUMPKIN_ROUGH, tilt: PUMPKIN_TILT, after: SHADE },
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

// How lit a face is `seconds` after the landing: nothing before its turn, then a flare, then the creep to its whole light.
export function faceLevel(index: number, seconds: number): number {
  const lit = seconds - (LIGHT.catchSeconds[index] ?? 1)
  if (!(lit > 0)) return 0
  if (!(lit < Infinity)) return 1
  const spit = 0.8 * Math.exp(-(((lit - 0.06) / 0.035) ** 2))
  const hold = 1 - Math.exp(-Math.max(lit - 0.13, 0) / 0.12)
  const tremble = 1 + 0.4 * Math.exp(-lit / 0.7) * Math.sin(lit * 43 + index * 2.3) * Math.sin(lit * 17 + index * 5.1)
  const ember = LIGHT.ember * Math.min(lit / 0.03, 1) * (spit + (1 - spit) * hold * tremble)
  const t = seconds - (LIGHT.takeSeconds[index] ?? 4)
  if (!(t > 0)) return ember
  return ember + (1 - LIGHT.ember) * (LIGHT.flare * (1 - Math.exp(-t / LIGHT.flareSeconds)) + (1 - LIGHT.flare) * (1 - Math.exp(-t / LIGHT.creepSeconds)))
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
    glow[i] = faceLevel(i, seconds) * candle
  }
}
