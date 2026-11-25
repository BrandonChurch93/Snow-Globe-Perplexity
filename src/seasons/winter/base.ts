import * as THREE from 'three'
import { config } from '../../config'
import { lightUniforms } from '../../core/chunks/light'
import { stageMaterial, stageShader, type Rgb } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { stream } from '../../core/rng'
import { texture } from '../../core/textures'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { partChange } from '../../shake/change'
import type { KitMoment } from '../kit'

export const season = 'winter'
export const main: Rgb = [0.1, 0.062, 0.034]

const PART = 'base-winter'
const MODEL = 'winter/base-winter.glb'
const map = (name: string) => texture(`winter/base-${name}.png`)

interface IceExtras {
  count: number
  rootHeight: number
  bodyFrom: number
  bodyStep: number
  body: number[]
}
interface TileExtras {
  repeats?: number
  tileMm: number
}

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
varying float vBaseImage;
`

// The slab's mirror draws the stage turned over (src/scene/passes.ts), and there this foot stands on its own image: the plinth
// is 1.6 mm taller than the approved one and painted dark to hide it, so a true image doubles it into 5.5 mm of black between
// the gilt band and its reflection. In that pass alone the plinth is drawn pressed flat (it keeps its foot on the table, so
// the image still meets the foot where the foot touches), and the band's image begins where the dark line ends.
const IMAGE_SINK_MM = 2.6
const IMAGE_FOOT_MM = 0.15
// The slab dims what it mirrors with height and blurs it (src/scene/surface.ts); the brass is drawn that much brighter in the
// image, and its key highlight is placed as the eye sees it on the foot itself (BRASS_CARD), as the card's already is.
const IMAGE_GAIN = 1.5

const VERT_MAIN = `
vBasePos = position;
vBaseNormal = normal;
vBasePaint = color;
vBaseUv1 = uv1;
vBaseImage = determinant(mat3(modelMatrix)) < 0.0 ? 1.0 : 0.0;
transformed.y = mix(transformed.y, max(transformed.y - ${IMAGE_SINK_MM.toFixed(2)}, min(transformed.y, ${IMAGE_FOOT_MM.toFixed(2)})), vBaseImage);
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
uniform mat3 normalMatrix;
varying vec3 vBasePos;
varying vec3 vBaseNormal;
varying vec3 vBasePaint;
varying vec2 vBaseUv1;
varying float vBaseImage;
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
}
`

const OIL = `
{
  vec3 oilKey = vec3(0.0, 1.0, 0.0);
  vec3 oilKeyC = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  oilKey = stageKeyL;
  oilKeyC = stageKeyC * stageKeyS;
  #elif NUM_DIR_LIGHTS > 0
  oilKey = directionalLights[0].direction;
  oilKeyC = directionalLights[0].color;
  #endif
  float oilNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float oilF = 0.04 + 0.96 * pow(1.0 - oilNv, 5.0);
  float oilNh = max(dot(geometryNormal, normalize(oilKey + geometryViewDir)), 0.0);
  float oilNl = smoothstep(0.0, 0.12, dot(geometryNormal, oilKey));
  vec3 oilAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float oilLee = 1.0 - 0.75 * smoothstep(0.1, 0.6, baseSin) * smoothstep(11.7, 16.0, vBasePos.y);
  reflectedLight.directDiffuse *= mix(mix(0.38, 1.0, baseBead), 1.0, baseFrost);
  reflectedLight.directSpecular *= mix(0.35, 1.0, baseFrost);
  reflectedLight.indirectDiffuse *= mix(mix(vec3(4.0, 4.0, 4.8), vec3(1.4), baseBead), vec3(1.8), baseFrost);
  reflectedLight.directSpecular *= oilLee;
  reflectedLight.directSpecular += oilKeyC * (3.2 * pow(oilNh, 110.0)) * oilF * oilNl * baseOil * baseAo;
  reflectedLight.directSpecular += oilKeyC * vec3(0.62, 0.8, 1.2) * (0.008 * pow(oilNh, 9.0) + 0.22 * pow(oilNh, 44.0)) * oilNl * (0.45 + 0.55 * baseOil) * (1.0 - 0.85 * baseLeaf) * baseAo * oilLee;
  vec3 oilCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float oilCh = max(dot(geometryNormal, normalize(oilCard + geometryViewDir)), 0.0);
  float oilCl = smoothstep(0.0, 0.25, dot(geometryNormal, oilCard));
  reflectedLight.directSpecular += (uRigCardCol * vec3(1.0, 0.76, 0.52) * 1.1 * pow(oilCh, 70.0) * oilCl + oilKeyC * 0.7 * pow(oilNh, 70.0) * oilNl) * baseBead * baseAo * (1.0 - baseFrost);
  reflectedLight.directSpecular += uRigCardCol * (vec3(1.0, 0.7, 0.48) * (0.004 * pow(oilCh, 3.0) + 0.03 * pow(oilCh, 22.0)) * baseSheen + vec3(1.0, 0.68, 0.42) * baseLeaf * (0.08 * pow(oilCh, 10.0) + 0.34 * pow(oilCh, 110.0))) * oilCl * baseOil * baseAo;
  vec3 oilCell = floor(vBasePos * 5.0);
  vec3 oilFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.2 * (vec3(baseHash(oilCell + 3.7), baseHash(oilCell + 11.3), baseHash(oilCell + 23.9)) - 0.5)));
  float oilGrit = smoothstep(0.5, 0.12, length(fract(vBasePos * 5.0) - 0.5)) * step(0.5, baseHash(oilCell));
  reflectedLight.directSpecular += oilKeyC * (pow(max(dot(oilFacet, normalize(oilKey + geometryViewDir)), 0.0), 200.0) * oilGrit * baseFrost * 1.6 + 0.5 * pow(oilNh, 10.0) * baseFrost);
  reflectedLight.directSpecular += (oilKeyC * pow(max(dot(oilFacet, normalize(oilKey + geometryViewDir)), 0.0), 90.0) + uRigCardCol * vec3(1.0, 0.72, 0.42) * 1.5 * pow(max(dot(oilFacet, normalize(oilCard + geometryViewDir)), 0.0), 90.0)) * oilGrit * baseLeaf * (1.0 - baseFrost) * baseAo * 0.5;
  reflectedLight.indirectSpecular += stageRoomLights(oilAway, 0.09) * min(oilF, 0.35) * 0.4 * baseOil * baseAo;
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
    Object.assign(shader.uniforms, roomUniforms, { uBaseFloor: iceUniforms.uIceFloor }, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}\n${at.pars ?? ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${at.paint}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${at.rough}`)
      .replace('#include <normal_fragment_maps>', `${at.tilt}\n${BEND}\n${at.bent ?? ''}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${at.after}`)
  }
}

const WOOD_PAINT = `
vec4 baseDetail = texture2D(uBaseDetail, vMapUv);
vec4 baseCarve = texture2D(uBaseCarve, vBaseUv1);
float baseCarved = vBasePaint.z;
float baseCavity = clamp(1.0 - 2.0 * baseCarve.b, 0.0, 1.0) * baseCarved;
float baseHigh = clamp(2.0 * baseCarve.b - 1.0, 0.0, 1.0) * baseCarved;
float baseWear = clamp(vBasePaint.y + 0.6 * baseHigh, 0.0, 1.0);
float baseAo = vBasePaint.x * (1.0 - 0.62 * baseCavity);
float baseBlotch = baseNoise(vBasePos * 0.21) * 0.6 + baseNoise(vBasePos * 0.9) * 0.4;
float baseLeaf = smoothstep(0.02, 0.2, baseHigh);
float baseTurn = atan(vBasePos.x, vBasePos.z);
float baseFigure = baseNoise(vec3(baseTurn * 7.0, vBasePos.y * 0.42 + 0.9 * sin(baseTurn * 3.0), 2.7)) * 0.6 + baseNoise(vec3(baseTurn * 23.0, vBasePos.y * 1.3, 9.1)) * 0.4;
float baseLight = dot(diffuseColor.rgb, vec3(4.2, 7.0, 6.0));
float baseStreak = clamp(smoothstep(0.62, 1.75, baseLight) * (0.55 + 0.7 * smoothstep(0.3, 0.72, baseFigure)), 0.0, 1.0) * (1.0 - baseLeaf);
vec3 baseGrainCol = diffuseColor.rgb * vec3(0.95, 1.45, 1.65);
diffuseColor.rgb = mix(vec3(0.1, 0.066, 0.04), baseGrainCol, 0.45 - 0.3 * baseLeaf) * vec3(0.78, 0.5, 0.42) * mix(0.75, 1.15, baseBlotch) * mix(1.15, 1.0, baseLeaf);
diffuseColor.rgb *= mix(vec3(0.84, 0.77, 0.72), vec3(1.26, 1.03, 0.88), baseStreak) * mix(1.0, 0.72, baseLeaf);
diffuseColor.rgb *= mix(1.0, 0.5, baseCavity);
float baseGild = smoothstep(0.3, 0.85, baseWear);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.3, 0.13), (0.16 + 0.34 * (1.0 - baseCarved)) * baseGild);
float baseBead = smoothstep(8.1, 8.4, vBasePos.y) * (1.0 - smoothstep(10.4, 10.7, vBasePos.y)) * (1.0 - baseCarved);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14, 0.065, 0.032), 0.7 * baseBead);
`

const WOOD_ROUGH = `
roughnessFactor = clamp(mix(0.24, 0.46, baseDetail.b) + 0.3 * baseCavity - 0.12 * baseGild + 0.06 * baseCarved - 0.08 * baseStreak, 0.14, 1.0);
metalnessFactor = 0.5 * baseGild;
`

const WOOD_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * 0.28 + baseSlope(baseCarve.rg) * (1.35 * baseCarved);
`

const WOOD_BENT = `
float baseSin = vBasePos.x / max(length(vBasePos.xz), 1.0);
float baseLow = 1.0 - smoothstep(12.4, 15.25, vBasePos.y);
float baseFar = smoothstep(0.72, 0.97, baseSin);
float baseSide = smoothstep(0.3, 0.85, baseSin) * mix((0.1 + 0.9 * baseFar) * (0.3 + 0.7 * smoothstep(0.3, 0.65, baseNoise(vBasePos * 0.4 + 5.0))), 1.0, 1.0 - smoothstep(14.5, 18.5, vBasePos.y)) * (1.0 - smoothstep(27.5, 32.3, vBasePos.y));
float baseUp = smoothstep(0.12, 0.5, mix(normalize(vBaseNormal).y, baseObjectNormal.y, baseLeaf));
float baseGrain = baseNoise(vBasePos * 5.3) * 0.55 + baseNoise(vBasePos * 11.7) * 0.45;
float baseFrost = clamp(baseSide * clamp(0.08 + baseUp + baseFar * (0.55 + 0.35 * (1.0 - smoothstep(12.2, 17.0, vBasePos.y))) + 0.25 * smoothstep(0.5, 0.8, baseSin) + 0.3 * smoothstep(10.5, 10.9, vBasePos.y) * (1.0 - smoothstep(12.3, 13.4, vBasePos.y)), 0.0, 1.0) * (1.0 - 0.88 * smoothstep(0.02, 0.25, baseHigh)) * (1.0 - 0.8 * baseCavity) * mix(0.8, 1.25, smoothstep(0.38, 0.68, baseNoise(vBasePos * 8.0))), 0.0, 1.0) * (1.0 - 0.65 * baseBead);
float baseDust = (0.1 + 0.9 * smoothstep(0.06, 0.5, baseObjectNormal.y)) * (0.35 + 0.65 * baseNoise(vBasePos * 3.1)) * 0.06 + 0.12 * baseCavity;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.07, 0.075), clamp(baseDust, 0.0, 0.5));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.92, 1.1) * (0.88 + 0.24 * baseGrain), (0.75 + 0.25 * baseFar) * baseFrost);
roughnessFactor = mix(roughnessFactor, 0.9, clamp(baseDust * 1.6 + 0.9 * baseFrost, 0.0, 0.85));
metalnessFactor *= 1.0 - baseFrost;
float baseWall = smoothstep(0.7, 2.0, length(baseTilt)) * baseCarved;
roughnessFactor = mix(roughnessFactor, 0.62, 0.6 * baseWall);
float baseOil = clamp(1.0 - 2.2 * baseDust - 1.4 * baseFrost, 0.0, 1.0) * (1.0 - 0.7 * baseCavity) * (1.0 - 0.45 * baseWall);
float baseSheen = mix(0.5, 1.9, baseStreak) * (1.0 - baseLeaf) + baseLeaf + 7.0 * smoothstep(8.35, 8.85, vBasePos.y) * (1.0 - smoothstep(9.95, 10.45, vBasePos.y));
`

const BRASS_PAINT = `
vec4 baseDetail = texture2D(uBaseDetail, vMapUv);
float baseWear = vBasePaint.y;
float baseTarnish = clamp(vBasePaint.z * 1.25 + 0.04 + (baseDetail.b - 0.42) * 0.16 + (baseNoise(vBasePos * 0.8) - 0.5) * 0.22 - 0.5 * baseWear, 0.0, 1.0);
float baseAo = vBasePaint.x;
vec3 baseClean = mix(diffuseColor.rgb * vec3(1.0, 0.82, 0.6), vec3(1.0, 0.78, 0.46), 0.6 + 0.3 * baseWear) * (0.72 + 0.28 * baseWear);
diffuseColor.rgb = mix(baseClean, vec3(0.05, 0.032, 0.018) + 0.18 * baseClean, smoothstep(0.15, 0.9, baseTarnish));
diffuseColor.rgb *= mix(1.0, 0.5, smoothstep(34.0, 34.4, vBasePos.y) * smoothstep(45.5, 47.0, length(vBasePos.xz)) * (1.0 - smoothstep(50.6, 51.6, length(vBasePos.xz))));
diffuseColor.rgb *= mix(0.03, 1.0, smoothstep(2.7, 3.05, vBasePos.y));
`

const BRASS_ROUGH = `
roughnessFactor = clamp(mix(0.25, 0.78, baseTarnish) - 0.07 * baseWear + 0.1 * (baseDetail.b - 0.5) - 0.08 * smoothstep(31.5, 32.5, vBasePos.y), 0.14, 1.0);
metalnessFactor = mix(0.88, 0.4, smoothstep(0.4, 1.0, baseTarnish)) * mix(1.0, 0.55, smoothstep(47.5, 43.0, length(vBasePos.xz)) * step(33.5, vBasePos.y));
`

const BRASS_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * 0.75;
`

const BRASS_BENT = `
float baseSide = smoothstep(0.35, 0.95, vBasePos.x / max(length(vBasePos.xz), 1.0));
float baseGrain = baseNoise(vBasePos * 5.3) * 0.55 + baseNoise(vBasePos * 11.7) * 0.45;
float baseFrost = clamp(baseSide * (0.45 + 0.55 * smoothstep(0.0, 0.6, baseObjectNormal.y)) * (1.15 - 0.75 * baseAo) * (0.6 + 0.6 * baseGrain), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.46, 0.54) * (0.8 + 0.4 * baseGrain), 0.7 * baseFrost);
diffuseColor.rgb *= mix(1.0, mix(0.42, 1.0, smoothstep(-0.85, -0.1, baseObjectNormal.y)), smoothstep(52.6, 53.0, length(vBasePos.xz)) * smoothstep(32.3, 32.7, vBasePos.y));
metalnessFactor = mix(metalnessFactor, 0.0, 0.7 * baseFrost);
roughnessFactor = mix(roughnessFactor, 0.9, 0.7 * baseFrost);
`

const BRASS_CARD = `
{
  reflectedLight.directSpecular *= 0.04;
  reflectedLight.indirectSpecular *= mix(0.5, 1.0, smoothstep(10.0, 30.0, vBasePos.y));
  float brassRope = smoothstep(5.5, 5.8, vBasePos.y) * (1.0 - smoothstep(7.9, 8.2, vBasePos.y));
  vec3 brassT = normalize(normalMatrix * vec3(vBasePos.z, 0.0, -vBasePos.x) + vec3(1e-5, 0.0, 0.0));
  brassT = normalize(brassT - geometryNormal * dot(brassT, geometryNormal));
  vec3 brassB = cross(geometryNormal, brassT);
  vec3 brassCard = normalize(mat3(viewMatrix) * uRigCardDir);
  vec3 brassHc = normalize(brassCard + geometryViewDir);
  float brassCh = max(dot(geometryNormal, brassHc), 1e-3);
  float brassCs = exp(-(pow(dot(brassHc, brassT) / 0.5, 2.0) + pow(dot(brassHc, brassB) / 0.12, 2.0)) / (brassCh * brassCh));
  reflectedLight.directSpecular += uRigCardCol * material.specularColorBlended * (0.02 * pow(brassCh, 4.0) + mix(0.25 * pow(brassCh, 48.0) + 2.5 * brassCs, 1.4 * pow(brassCh, 90.0), brassRope)) * smoothstep(0.0, 0.25, dot(geometryNormal, brassCard)) * baseAo * (1.0 - baseFrost);
  #ifdef STAGE_LIGHT_DONE
  vec3 brassKeyL = normalize(mat3(viewMatrix) * (inverseTransformDirection(stageKeyL, viewMatrix) * vec3(1.0, 1.0 - 2.0 * vBaseImage, 1.0)));
  vec3 brassHk = normalize(brassKeyL + geometryViewDir);
  float brassKh0 = max(dot(geometryNormal, brassHk), 1e-3);
  float brassKs = exp(-(pow(dot(brassHk, brassT) / 0.5, 2.0) + pow(dot(brassHk, brassB) / 0.12, 2.0)) / (brassKh0 * brassKh0));
  reflectedLight.directSpecular += stageKeyC * stageKeyS * material.specularColorBlended * (0.02 * pow(brassKh0, 4.0) + mix(0.14 * pow(brassKh0, 60.0) + 1.0 * brassKs, 1.8 * pow(brassKh0, 90.0), brassRope)) * smoothstep(0.0, 0.25, dot(geometryNormal, brassKeyL)) * baseAo * (1.0 - baseFrost);
  float brassDish = smoothstep(34.1, 34.5, vBasePos.y) * (1.0 - 0.75 * smoothstep(52.0, 52.8, length(vBasePos.xz))) * smoothstep(0.3, 0.8, baseObjectNormal.y) * baseAo * (1.0 - baseFrost);
  float brassKh = max(dot(geometryNormal, normalize(brassKeyL + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += material.specularColorBlended * brassDish * (0.5 + 0.7 * baseGrain) * (stageKeyC * stageKeyS * 0.04 * pow(brassKh, 5.0) + uRigCardCol * 0.07 * pow(brassCh, 5.0));
  #endif
  reflectedLight.indirectSpecular += uRigCardCol * material.specularColorBlended * (0.018 * smoothstep(0.5, -0.4, baseObjectNormal.y) * smoothstep(31.5, 32.5, vBasePos.y) * (1.0 - baseFrost));
  reflectedLight.indirectSpecular += material.specularColorBlended * uRigCardCol * (0.03 * baseAo * (1.0 - baseFrost));
  float brassPlinth = smoothstep(2.7, 3.05, vBasePos.y);
  reflectedLight.directSpecular *= brassPlinth;
  reflectedLight.indirectSpecular *= brassPlinth;
  reflectedLight.directDiffuse *= brassPlinth;
  reflectedLight.indirectDiffuse *= brassPlinth;
  float brassImage = mix(1.0, ${IMAGE_GAIN.toFixed(2)}, vBaseImage);
  reflectedLight.directSpecular *= brassImage;
  reflectedLight.indirectSpecular *= brassImage;
  reflectedLight.directDiffuse *= brassImage;
  reflectedLight.indirectDiffuse *= brassImage;
}
`

const SNOW_PAINT = `
float baseSteep = smoothstep(0.15, 0.45, 1.0 - abs(normalize(vBaseNormal).y));
vec2 baseFlatUv = vBasePos.xz * uBaseTile;
vec2 baseWallUv = vec2(atan(vBasePos.x, vBasePos.z) * 55.0, vBasePos.y) * uBaseTile;
vec4 baseDetail = mix(texture2D(uBaseDetail, baseFlatUv), texture2D(uBaseDetail, baseWallUv), baseSteep);
diffuseColor.rgb = diffuse * mix(vec3(1.0), mix(texture2D(map, baseFlatUv).rgb, texture2D(map, baseWallUv).rgb, baseSteep), 0.35);
float baseThick = vBasePaint.x;
float baseAo = (0.55 + 0.45 * smoothstep(0.0, 0.25, baseThick)) * mix(0.8, 1.0, smoothstep(0.0, 3.0, length(vBasePos - vec3(0.0, 79.0, 0.0)) - 60.0));
float baseUnder = smoothstep(0.0, 8.0, length(vBasePos - vec3(0.0, 79.0, 0.0)) - 60.0);
if (baseThick - 0.05 * baseNoise(vBasePos * 2.3) * baseNoise(vBasePos * 0.7 + 9.0) < 0.012) discard;
diffuseColor.rgb *= mix(vec3(0.7, 0.78, 0.9), vec3(1.0), smoothstep(0.02, 0.3, baseThick));
diffuseColor.rgb *= mix(vec3(0.72, 0.82, 0.97), vec3(1.0), smoothstep(-0.3, 0.7, normalize(vBaseNormal).y));
float baseGrainy = baseHash(floor(vBasePos * 3.4)) * 0.6 + baseHash(floor(vBasePos * 6.1 + 7.0)) * 0.4;
diffuseColor.rgb *= 0.91 + 0.15 * baseGrainy;
`

const SNOW_ROUGH = `
roughnessFactor = 0.82 + 0.16 * baseDetail.b;
`

const SNOW_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * 2.2 + (vec2(baseNoise(vBasePos * 2.3 + 17.0), baseNoise(vBasePos * 2.3 + 51.0)) - 0.5) * 0.45 + (vec2(baseNoise(vBasePos * 5.1 + 3.0), baseNoise(vBasePos * 5.1 + 29.0)) - 0.5) * 0.35 + (vec2(baseNoise(vBasePos * 0.95 + 5.0), baseNoise(vBasePos * 0.95 + 37.0)) - 0.5) * 0.8;
`

const SNOW_AFTER = `
{
  reflectedLight.directDiffuse *= mix(vec3(1.12), vec3(1.14, 1.2, 1.3), smoothstep(-10.0, 30.0, vBasePos.x)) * mix(vec3(0.82, 0.88, 0.96), vec3(1.0), baseUnder);
  reflectedLight.indirectDiffuse *= baseAo * mix(vec3(0.6, 0.56, 0.62), vec3(0.43, 0.61, 0.96), smoothstep(-30.0, 15.0, vBasePos.x)) * (0.92 + 0.08 * smoothstep(-0.3, 0.6, normalize(vBaseNormal).y));
  vec3 baseKey = vec3(0.0, 1.0, 0.0);
  vec3 baseKeyC = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  baseKey = stageKeyL;
  baseKeyC = stageKeyC * stageKeyS;
  #elif NUM_DIR_LIGHTS > 0
  baseKey = directionalLights[0].direction;
  baseKeyC = directionalLights[0].color;
  #endif
  float baseWrap = clamp(dot(nonPerturbedNormal, baseKey) * 0.5 + 0.5, 0.0, 1.0);
  float baseDeep = smoothstep(0.02, 0.35, baseThick);
  reflectedLight.indirectDiffuse += baseKeyC * material.diffuseContribution * RECIPROCAL_PI * 1.45 * pow(baseWrap, 6.0) * baseDeep * mix(0.3, 1.0, baseUnder) * smoothstep(-30.0, 20.0, vBasePos.x);
  #ifdef STAGE_LIGHT_DONE
  float baseCard = clamp(dot(inverseTransformDirection(nonPerturbedNormal, viewMatrix), uRigCardDir) * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.indirectDiffuse += uRigCardCol * vec3(0.92, 0.94, 1.0) * material.diffuseContribution * RECIPROCAL_PI * 0.7 * baseCard * baseCard * baseDeep * mix(0.5, 1.0, baseUnder) * mix(0.1, 1.0, smoothstep(18.0, -14.0, vBasePos.x));
  #endif
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * (uRigCardCol * 0.3 * smoothstep(18.0, -14.0, vBasePos.x) + baseKeyC * 0.22) * (1.0 - smoothstep(-0.3, 0.6, normalize(vBaseNormal).y)) * baseDeep;
  vec3 baseCell = floor(vBasePos * 4.0);
  float baseOne = baseHash(baseCell);
  vec3 baseFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.2 * (vec3(baseHash(baseCell + 3.7), baseHash(baseCell + 11.3), baseHash(baseCell + 23.9)) - 0.5)));
  vec3 baseIn = fract(vBasePos * 4.0) - 0.5;
  float baseTwo = baseHash(baseCell + 41.0);
  float baseGrit = smoothstep(mix(0.22, 0.5, baseTwo), 0.1, length(baseIn)) * step(0.3, baseOne) * (0.25 + 2.6 * baseTwo * baseTwo * baseTwo) * vBasePaint.y;
  reflectedLight.directSpecular += baseKeyC * (pow(max(dot(baseFacet, normalize(baseKey + geometryViewDir)), 0.0), 130.0) * baseGrit * 8.0);
  reflectedLight.directSpecular += uRigCardCol * (pow(max(dot(baseFacet, normalize(normalize(mat3(viewMatrix) * uRigCardDir) + geometryViewDir)), 0.0), 100.0) * baseGrit * 6.0 * smoothstep(34.0, -8.0, vBasePos.x));
}
`

const ICE_VERT_PARS = `
attribute vec2 uv1;
attribute vec3 color;
uniform float uIceGrow[ICE_COUNT];
varying vec3 vIcePos;
varying vec3 vIceNormal;
varying vec4 vIceUv;
varying float vIceDrop;
`

const ICE_VERT_MAIN = `
vec3 iceRoot = (color - 0.5) * 128.0;
float iceG = uIceGrow[int(uv.y + 0.5)];
vec3 iceScale = vec3(mix(0.62, 1.0, iceG), iceG, mix(0.62, 1.0, iceG));
vec3 iceAt = iceRoot + (position - iceRoot) * iceScale;
vec4 iceWorld = modelMatrix * vec4(iceAt, 1.0);
vec4 iceView = viewMatrix * iceWorld;
gl_Position = projectionMatrix * iceView;
vStageWorld = iceWorld.xyz;
vStageLocal = (uGlobeInv * iceWorld).xyz;
vStageAux = vec3(0.0, -iceView.z, length(iceView.xyz));
vStagePlaced = iceWorld.xyz;
vIcePos = iceAt;
vIceNormal = normalize(normal / iceScale);
vIceUv = vec4(uv, uv1);
vIceDrop = iceRoot.y - iceAt.y;
`

const ICE_FRAG = `
uniform mat4 modelMatrix;
uniform vec3 uIceKeyDir;
uniform vec3 uIceKeyCol;
uniform vec3 uIceRimDir;
uniform vec3 uIceRimCol;
uniform vec3 uIceSky;
uniform vec3 uIceGround;
uniform vec3 uIceFloor;
uniform vec3 uIceBrass;
uniform float uIceBody[ICE_BODY];
uniform vec4 uIceSpan;
uniform vec2 uIceTile;
uniform sampler2D uIceWood;
varying vec3 vIcePos;
varying vec3 vIceNormal;
varying vec4 vIceUv;
varying float vIceDrop;
${ROOM_GLSL}
${NOISE}
float iceBody(float h) {
  float f = clamp((h - uIceSpan.x) / uIceSpan.y, 0.0, float(ICE_BODY) - 1.001);
  int i = int(f);
  return mix(uIceBody[i], uIceBody[i + 1], f - float(i));
}
vec3 iceDome(vec3 d) {
  return mix(uIceGround, uIceSky, 0.5 + 0.5 * d.y);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  mat3 turn = mat3(modelMatrix);
  vec3 no = normalize(vIceNormal);
  vec3 q = vIcePos * vec3(3.1, 0.42, 3.1);
  float e = 0.11;
  float n0 = baseNoise(q);
  vec3 g = vec3(baseNoise(q + vec3(e, 0.0, 0.0)) - n0, baseNoise(q + vec3(0.0, e, 0.0)) - n0, baseNoise(q + vec3(0.0, 0.0, e)) - n0) / e;
  vec3 q2 = vIcePos * vec3(9.0, 1.6, 9.0);
  float n1 = baseNoise(q2);
  vec3 g2 = vec3(baseNoise(q2 + vec3(e, 0.0, 0.0)) - n1, baseNoise(q2 + vec3(0.0, e, 0.0)) - n1, baseNoise(q2 + vec3(0.0, 0.0, e)) - n1) / e;
  g = g * 0.24 + g2 * 0.05;
  float ring = sin(vIcePos.y * 4.4 + vIceUv.y * 9.7 + 2.4 * n0) + 0.5 * sin(vIcePos.y * 9.6 + vIceUv.y * 4.1);
  g.y += 0.07 * ring * smoothstep(0.03, 0.2, vIceUv.x) * (1.0 - smoothstep(0.8, 1.0, vIceUv.x));
  no = normalize(no - (g - no * dot(g, no)));
  vec3 n = normalize(turn * no);
  vec3 v = normalize(cameraPosition - vStageWorld);
  float nv = clamp(dot(n, v), 0.0, 1.0);
  float fres = 0.018 + 0.982 * pow(1.0 - nv, 5.0);
  vec3 away = reflect(-v, n);
  float leeward = smoothstep(0.3, -0.5, vIcePos.x / max(length(vIcePos.xz), 1.0));
  vec3 mirror = stageRoom(away) + stageRoomLights(away, 0.06) + iceDome(away) * RECIPROCAL_PI * (1.0 - 0.75 * leeward) + uIceFloor * smoothstep(0.0, -0.3, away.y);

  vec3 into = refract(-v, n, 1.0 / 1.31);
  vec3 outW = normalize(2.0 * dot(-v, into) * into + v);
  vec3 outO = outW * turn;
  vec3 at = vIcePos + (into * turn) * (2.6 * vIceUv.w * max(dot(-into, n), 0.2));
  float hit = 0.0;
  float stride = 0.45;
  for (int i = 0; i < 11; i++) {
    at += outO * stride;
    stride *= 1.33;
    if (at.y > uIceSpan.z || length(at.xz) < iceBody(at.y)) {
      hit = 1.0;
      break;
    }
    if (at.y < 0.0) break;
  }
  vec3 behind = mix(stageRoom(outW) + stageRoomLights(outW, 0.03), uIceFloor, smoothstep(0.0, -0.3, outW.y));
  if (hit > 0.5) {
    vec3 rb = turn * normalize(vec3(at.x, 0.0, at.z));
    float under = smoothstep(0.5, 10.0, uIceSpan.z - at.y);
    vec3 fall = (uIceKeyCol * max(dot(rb, uIceKeyDir), 0.0) + uRigCardCol * max(dot(rb, uRigCardDir), 0.0)) * under + iceDome(rb) * (0.25 + 0.75 * under);
    vec2 wuv = vec2(atan(at.x, at.z) / 6.2831853 * uIceTile.x, at.y / uIceTile.y);
    vec3 wood = mix(textureLod(uIceWood, wuv, 2.5).rgb, vec3(0.5, 0.56, 0.68), 0.6 * smoothstep(0.3, 0.9, at.x / max(length(at.xz), 1.0)));
    float metal = max(1.0 - smoothstep(uIceSpan.x + 4.45, uIceSpan.x + 4.95, at.y), smoothstep(uIceSpan.z - 1.6, uIceSpan.z - 1.1, at.y));
    behind = mix(mix(wood, uIceBrass, metal) * fall * (1.8 * RECIPROCAL_PI), behind + iceDome(outW) * RECIPROCAL_PI, 0.16);
  }

  float t = vIceUv.x;
  float seed = vIceUv.y;
  float side = vIcePos.x / max(length(vIcePos.xz), 1.0);
  float lee = smoothstep(0.3, -0.5, side);
  vec3 keyC = uIceKeyCol * (1.0 - 0.8 * lee) * (1.0 + 0.5 * smoothstep(0.2, 0.8, side));
  vec3 cardC = uRigCardCol * (1.0 - 0.2 * lee);
  float core = smoothstep(0.2, 0.95, nv);
  float streak = baseNoise(vec3(vIceUv.z * 11.0 + seed * 5.0, t * 2.2 + seed * 3.0, seed * 1.7));
  float grit = baseNoise(vIcePos * 11.0);
  float band = smoothstep(0.3, 0.8, 1.0 - nv);
  float vein = smoothstep(0.3, 0.72, streak);
  float cloud = 0.03 + band * (0.06 + 0.22 * vein) + 0.1 * core * vein * vein + 0.04 * smoothstep(0.66, 0.9, grit);
  float wrap = clamp(dot(n, uIceKeyDir) * 0.5 + 0.5, 0.0, 1.0);
  cloud = clamp((0.3 + 0.5 * lee) * cloud * (1.0 - 0.65 * smoothstep(0.55, 1.0, t)) * (0.6 + 0.4 * smoothstep(0.0, 0.25, t)), 0.0, 0.85);
  float back = clamp(dot(n, uIceRimDir) * 0.5 + 0.5, 0.0, 1.0);
  float warm = clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0);
  vec3 lit = keyC * (0.1 + 1.2 * wrap * wrap) + cardC * (0.2 + 1.8 * warm * warm) + uIceRimCol * 0.5 * back * back + (0.7 - 0.5 * lee) * iceDome(n);
  vec3 milk = vec3(0.84, 0.86, 0.92) * lit * RECIPROCAL_PI;
  vec3 col = mix(behind * vec3(0.9, 0.95, 1.0) * (0.36 + 0.16 * core) * (0.75 + 0.25 * smoothstep(0.0, 0.3, t)), milk, cloud);
  col += (keyC * 0.3 + cardC * 0.1 + iceDome(vec3(0.0, 1.0, 0.0)) * (0.5 - 0.4 * lee)) * RECIPROCAL_PI * smoothstep(0.5, 0.1, nv) * (0.35 + 0.65 * vein) * smoothstep(0.03, 0.15, t);
  col = col * (1.0 - fres) + mirror * fres + milk * ((0.3 - 0.18 * lee) * pow(1.0 - nv, 2.4));
  float hk = max(dot(n, normalize(v + uIceKeyDir)), 0.0);
  float hr = max(dot(n, normalize(v + uIceRimDir)), 0.0);
  col += keyC * (pow(hk, 420.0) * 7.0 + pow(hk, 36.0) * 0.06);
  col += uIceRimCol * (pow(hr, 240.0) * 2.4 + pow(hr, 30.0) * 0.04);
  vec3 around = normalize(vec3(n.x, 0.0, n.z) + 1e-5);
  float lane = 0.55 + 0.45 * ring;
  float keyLane = exp(-pow((dot(around, -normalize(vec3(uIceKeyDir.x, 0.0, uIceKeyDir.z))) - 0.42) / 0.06, 2.0));
  float cardLane = exp(-pow((dot(around, -normalize(vec3(uRigCardDir.x, 0.0, uRigCardDir.z))) - 0.42) / 0.06, 2.0));
  col += (keyC * 0.55 * keyLane + cardC * 0.2 * cardLane * (0.3 + 0.7 * lee)) * lane * (0.2 + 1.6 * smoothstep(0.45, 0.8, grit)) * (0.35 + 0.65 * vein) * smoothstep(0.02, 0.12, t) * (1.0 - 0.4 * smoothstep(0.75, 1.0, t));
  float thru = smoothstep(0.05, 0.8, dot(around, -normalize(vec3(uRigCardDir.x, 0.0, uRigCardDir.z))));
  float mott = baseNoise(vIcePos * vec3(3.4, 1.5, 3.4) + seed * 7.0);
  float fleck = 0.25 + 1.2 * smoothstep(0.35, 0.72, mott) + 2.4 * smoothstep(0.7, 0.84, mott);
  col += uRigCardCol * vec3(1.0, 0.92, 0.9) * RECIPROCAL_PI * lee * fleck * (1.0 * thru * thru * (0.4 + 0.6 * vein) * smoothstep(0.02, 0.14, t) + 0.4 * smoothstep(0.7, 0.98, t) * core);
  float hc = max(dot(n, normalize(v + uRigCardDir)), 0.0);
  col += cardC * (pow(hc, 48.0) * 0.2 + pow(hc, 300.0) * 2.2);
  vec3 cell = floor(vIcePos * 4.5);
  vec3 jit = vec3(baseHash(cell + 1.3), baseHash(cell + 7.1), baseHash(cell + 13.7)) - 0.5;
  vec3 fn = normalize(n + turn * jit * 1.3);
  float inCell = smoothstep(0.5, 0.12, length(fract(vIcePos * 4.5) - 0.5)) * step(0.35, baseHash(cell + 29.0));
  col += (stageRoomLights(reflect(-v, fn), 0.03) * 1.4 + keyC * pow(max(dot(fn, normalize(v + uIceKeyDir)), 0.0), 320.0) * 2.0) * inCell;
  gl_FragColor = vec4(col, smoothstep(0.0, 1.9, vIceDrop));
  if (uDiag != 0) gl_FragColor = stageDiag(vec3(0.8, 0.88, 1.0), n, 0.0, c, 0.0);
}
`

const iceUniforms = {
  uIceGrow: { value: [] as number[] },
  uIceKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uIceKeyCol: { value: new THREE.Color() },
  uIceRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uIceRimCol: { value: new THREE.Color() },
  uIceSky: { value: new THREE.Color() },
  uIceFloor: { value: new THREE.Color() },
  uIceGround: { value: new THREE.Color() },
  uIceBrass: { value: new THREE.Color(0.3, 0.2, 0.09) },
  uIceBody: { value: [] as number[] },
  uIceSpan: { value: new THREE.Vector4() },
  uIceTile: { value: new THREE.Vector2(1, 1) },
  uIceWood: { value: null as THREE.Texture | null },
}

const growth: { delay: number; length: number; shed: number }[] = []
const SHORT = 0.72
const SHED = 0.4
const FLOOR_SHARE = 0.3

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

  const wood = stageMaterial({
    ...lit,
    key: `${PART}-wood`,
    physical: true,
    map: map('wood.srgb.tile.w1024'),
    hook: hookOf({ uBaseDetail: { value: map('wood-detail.lin.tile.w1024') }, uBaseCarve: { value: map('carve.lin.w2048') } }, { pars: 'uniform sampler2D uBaseCarve;', paint: WOOD_PAINT, rough: WOOD_ROUGH, tilt: WOOD_TILT, bent: WOOD_BENT, after: SHADE + OIL }),
  })
  const brass = stageMaterial({
    ...lit,
    key: `${PART}-brass`,
    physical: true,
    metalness: 1,
    map: map('brass.srgb.tile.w512'),
    hook: hookOf({ uBaseDetail: { value: map('brass-detail.lin.tile.w512') } }, { paint: BRASS_PAINT, rough: BRASS_ROUGH, tilt: BRASS_TILT, bent: BRASS_BENT, after: SHADE + BRASS_CARD }),
  })
  const snow = stageMaterial({
    ...lit,
    key: `${PART}-snow`,
    map: map('snow.srgb.tile.w256'),
    side: THREE.DoubleSide,
    hook: hookOf({ uBaseDetail: { value: map('snow.lin.tile.w256') }, uBaseTile: { value: 1 / (geometry(MODEL, 'snow').userData.extras as TileExtras).tileMm } }, { pars: 'uniform float uBaseTile;', paint: SNOW_PAINT, rough: SNOW_ROUGH, tilt: SNOW_TILT, after: SNOW_AFTER }),
  })

  const iceGeometry = geometry(MODEL, 'ice')
  const extras = iceGeometry.userData.extras as IceExtras
  const tile = geometry(MODEL, 'wood').userData.extras as TileExtras
  const landed = config.states.landedSeconds
  const rng = stream(`${PART}/icicles`)
  growth.length = 0
  for (let i = 0; i < extras.count; i++) growth.push({ delay: rng.range(0, 0.3) * landed, length: rng.range(0.45, 0.58) * landed, shed: 0 })
  for (const g of growth) g.shed = rng.range(0, 1 - SHED)
  iceUniforms.uIceGrow.value = growth.map(() => 1)
  iceUniforms.uIceBody.value = [...extras.body]
  iceUniforms.uIceSpan.value.set(extras.bodyFrom, extras.bodyStep, extras.rootHeight, 0)
  iceUniforms.uIceTile.value.set(tile.repeats ?? 1, tile.tileMm)
  iceUniforms.uIceWood.value = map('wood.srgb.tile.w1024')
  const ice = stageShader({
    ...lit,
    vertexPars: ICE_VERT_PARS,
    vertexMain: ICE_VERT_MAIN,
    fragment: ICE_FRAG,
    params: { transparent: true },
    uniforms: { ...roomUniforms, ...iceUniforms },
  })
  Object.assign(ice.defines, { ICE_COUNT: extras.count, ICE_BODY: extras.body.length })

  group.add(solid('wood', wood), solid('brass', brass), solid('snow', snow), new THREE.Mesh(iceGeometry, ice))
  return group
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  iceUniforms.uIceKeyDir.value.copy(f.keyDir)
  iceUniforms.uIceKeyCol.value.copy(f.keyCol)
  iceUniforms.uIceRimDir.value.copy(f.rimDir)
  iceUniforms.uIceRimCol.value.copy(f.rimCol)
  iceUniforms.uIceSky.value.copy(f.sky).multiplyScalar(f.fill)
  iceUniforms.uIceGround.value.copy(f.ground).multiplyScalar(f.fill)
  const card = lightUniforms.uRigCardCol.value
  const lift = (FLOOR_SHARE / Math.PI) * Math.max(lightUniforms.uRigCardDir.value.y, 0)
  const down = (FLOOR_SHARE / Math.PI) * Math.max(f.keyDir.y, 0)
  iceUniforms.uIceFloor.value.setRGB(f.keyCol.r * down + card.r * lift, f.keyCol.g * down + card.g * lift, f.keyCol.b * down + card.b * lift)
  const swap = config.shake.swapWindow
  const shaking = moment.beat !== null && moment.beat >= swap.fromBeat
  const two = f.from !== f.to && f.change > 0 && f.change < 1
  let held = -1
  let shed = -1
  if (two) held = moment.arrived >= 1 ? 1 : shaking ? 0 : -1
  else if (shaking) shed = partChange('base', (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat))
  const since = Math.max(0, moment.sinceLanding)
  const grow = iceUniforms.uIceGrow.value
  for (let i = 0; i < growth.length; i++) {
    const g = growth[i]!
    const grown = Math.min(1, Math.max(0, (since - g.delay) / g.length))
    const x = shed >= 0 ? grown * (1 - Math.min(1, Math.max(0, (shed - g.shed) / SHED))) : held >= 0 ? held * grown : grown
    grow[i] = SHORT + (1 - SHORT) * x * x * (3 - 2 * x)
  }
}
