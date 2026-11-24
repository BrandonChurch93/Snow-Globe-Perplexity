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
  reflectedLight.directSpecular += oilKeyC * (3.2 * pow(oilNh, 110.0)) * oilF * oilNl * baseOil * baseAo;
  vec3 oilCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float oilCh = max(dot(geometryNormal, normalize(oilCard + geometryViewDir)), 0.0);
  float oilCl = smoothstep(0.0, 0.25, dot(geometryNormal, oilCard));
  reflectedLight.directSpecular += uRigCardCol * (0.002 * pow(oilCh, 4.0) + 0.02 * pow(oilCh, 60.0) + 0.11 * baseLeaf * pow(oilCh, 14.0)) * oilCl * baseOil * baseAo;
  vec3 oilCell = floor(vBasePos * 5.0);
  vec3 oilFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.2 * (vec3(baseHash(oilCell + 3.7), baseHash(oilCell + 11.3), baseHash(oilCell + 23.9)) - 0.5)));
  float oilGrit = smoothstep(0.5, 0.12, length(fract(vBasePos * 5.0) - 0.5)) * step(0.5, baseHash(oilCell));
  reflectedLight.directSpecular += oilKeyC * (pow(max(dot(oilFacet, normalize(oilKey + geometryViewDir)), 0.0), 200.0) * oilGrit * baseFrost * 9.0 + 0.5 * pow(oilNh, 10.0) * baseFrost);
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
float baseAo = vBasePaint.x * (1.0 - 0.85 * baseCavity);
float baseBlotch = baseNoise(vBasePos * 0.21) * 0.6 + baseNoise(vBasePos * 0.9) * 0.4;
float baseLeaf = smoothstep(0.02, 0.2, baseHigh);
diffuseColor.rgb = mix(vec3(0.1, 0.066, 0.04), diffuseColor.rgb * vec3(0.95, 1.45, 1.65), 0.45 - 0.3 * baseLeaf) * vec3(0.78, 0.5, 0.42) * mix(0.75, 1.15, baseBlotch) * mix(1.15, 1.0, baseLeaf);
diffuseColor.rgb *= mix(1.0, 0.3, baseCavity);
float baseGild = smoothstep(0.3, 0.85, baseWear);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.34, 0.15), 0.5 * baseGild);
`

const WOOD_ROUGH = `
roughnessFactor = clamp(mix(0.26, 0.48, baseDetail.b) + 0.3 * baseCavity - 0.12 * baseGild + 0.06 * baseCarved, 0.14, 1.0);
metalnessFactor = 0.3 * baseGild;
`

const WOOD_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * 0.42 + baseSlope(baseCarve.rg) * (1.35 * baseCarved);
`

const WOOD_BENT = `
float baseSin = vBasePos.x / max(length(vBasePos.xz), 1.0);
float baseLow = 1.0 - smoothstep(10.2, 13.2, vBasePos.y);
float baseSide = smoothstep(0.2, 0.85, baseSin) * mix(0.05 + 0.25 * smoothstep(0.3, 0.7, baseNoise(vBasePos * 0.4 + 5.0)), 1.0, 1.0 - smoothstep(8.0, 13.0, vBasePos.y)) * (1.0 - smoothstep(26.0, 31.0, vBasePos.y));
float baseUp = smoothstep(0.0, 0.42, baseObjectNormal.y);
float baseGrain = baseNoise(vBasePos * 5.3) * 0.55 + baseNoise(vBasePos * 11.7) * 0.45;
float baseFrost = clamp(baseSide * (0.08 + 1.0 * baseUp) * (1.0 - 0.88 * smoothstep(0.02, 0.25, baseHigh)) * (1.0 - 0.8 * baseCavity) * (0.75 + 0.5 * baseGrain), 0.0, 1.0);
float baseDust = (0.1 + 0.9 * smoothstep(0.06, 0.5, baseObjectNormal.y)) * (0.35 + 0.65 * baseNoise(vBasePos * 3.1)) * 0.06 + 0.12 * baseCavity;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.07, 0.075), clamp(baseDust, 0.0, 0.5));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 1.0) * (0.8 + 0.4 * baseGrain), 0.68 * baseFrost);
roughnessFactor = mix(roughnessFactor, 0.9, clamp(baseDust * 1.6 + 0.9 * baseFrost, 0.0, 0.85));
metalnessFactor *= 1.0 - baseFrost;
float baseWall = smoothstep(0.7, 2.0, length(baseTilt)) * baseCarved;
roughnessFactor = mix(roughnessFactor, 0.62, 0.6 * baseWall);
float baseOil = clamp(1.0 - 2.2 * baseDust - 1.4 * baseFrost, 0.0, 1.0) * (1.0 - 0.7 * baseCavity) * (1.0 - 0.45 * baseWall);
`

const BRASS_PAINT = `
vec4 baseDetail = texture2D(uBaseDetail, vMapUv);
float baseWear = vBasePaint.y;
float baseTarnish = clamp(vBasePaint.z * 1.25 + 0.04 + (baseDetail.b - 0.42) * 0.16 + (baseNoise(vBasePos * 0.8) - 0.5) * 0.22 - 0.5 * baseWear, 0.0, 1.0);
float baseAo = vBasePaint.x;
vec3 baseClean = mix(diffuseColor.rgb * vec3(1.0, 0.8, 0.62), vec3(1.0, 0.63, 0.3), 0.6 + 0.3 * baseWear) * (0.9 + 0.2 * baseWear);
diffuseColor.rgb = mix(baseClean, vec3(0.05, 0.032, 0.018) + 0.18 * baseClean, smoothstep(0.15, 0.9, baseTarnish));
diffuseColor.rgb *= mix(0.3, 1.0, smoothstep(2.6, 3.4, vBasePos.y)) * mix(0.35, 1.0, smoothstep(0.1, 1.6, vBasePos.y));
`

const BRASS_ROUGH = `
roughnessFactor = clamp(mix(0.25, 0.78, baseTarnish) - 0.07 * baseWear + 0.1 * (baseDetail.b - 0.5), 0.14, 1.0);
metalnessFactor = mix(0.88, 0.4, smoothstep(0.4, 1.0, baseTarnish)) * mix(1.0, 0.55, smoothstep(34.4, 35.6, vBasePos.y));
`

const BRASS_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * 0.4;
`

const BRASS_BENT = `
float baseSide = smoothstep(0.35, 0.95, vBasePos.x / max(length(vBasePos.xz), 1.0));
float baseGrain = baseNoise(vBasePos * 5.3) * 0.55 + baseNoise(vBasePos * 11.7) * 0.45;
float baseFrost = clamp(baseSide * (0.25 + 0.75 * smoothstep(0.0, 0.6, baseObjectNormal.y)) * (1.15 - 0.75 * baseAo) * (0.6 + 0.6 * baseGrain), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.68, 0.8) * (0.8 + 0.4 * baseGrain), 0.7 * baseFrost);
metalnessFactor = mix(metalnessFactor, 0.0, 0.7 * baseFrost);
roughnessFactor = mix(roughnessFactor, 0.9, 0.7 * baseFrost);
`

const BRASS_CARD = `
{
  vec3 brassCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float brassCh = max(dot(geometryNormal, normalize(brassCard + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += uRigCardCol * material.specularColorBlended * (0.5 * pow(brassCh, 6.0) + 2.2 * pow(brassCh, 40.0)) * smoothstep(0.0, 0.25, dot(geometryNormal, brassCard)) * baseAo * (1.0 - baseFrost) * mix(0.03, 1.0, smoothstep(2.7, 3.5, vBasePos.y));
}
`

const SNOW_PAINT = `
float baseSteep = smoothstep(0.35, 0.75, 1.0 - abs(normalize(vBaseNormal).y));
vec2 baseFlatUv = vBasePos.xz * uBaseTile;
vec2 baseWallUv = vec2(atan(vBasePos.x, vBasePos.z) * 55.0, vBasePos.y) * uBaseTile;
vec4 baseDetail = mix(texture2D(uBaseDetail, baseFlatUv), texture2D(uBaseDetail, baseWallUv), baseSteep);
diffuseColor.rgb = diffuse * mix(vec3(1.0), mix(texture2D(map, baseFlatUv).rgb, texture2D(map, baseWallUv).rgb, baseSteep), 0.55);
float baseThick = vBasePaint.x;
float baseAo = 0.55 + 0.45 * smoothstep(0.0, 0.5, baseThick);
if (baseThick - 0.05 * baseNoise(vBasePos * 2.3) * baseNoise(vBasePos * 0.7 + 9.0) < 0.012) discard;
diffuseColor.rgb *= mix(vec3(0.56, 0.66, 0.82), vec3(1.0), smoothstep(0.02, 0.6, baseThick));
`

const SNOW_ROUGH = `
roughnessFactor = 0.82 + 0.16 * baseDetail.b;
`

const SNOW_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * 0.9;
`

const SNOW_AFTER = `
{
  reflectedLight.indirectDiffuse *= baseAo * vec3(0.6, 0.76, 1.0) * (0.28 + 0.72 * smoothstep(-0.3, 0.6, normalize(vBaseNormal).y));
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
  float baseDeep = smoothstep(0.1, 0.9, baseThick);
  reflectedLight.indirectDiffuse += baseKeyC * material.diffuseContribution * RECIPROCAL_PI * 0.42 * baseWrap * baseWrap * baseWrap * baseDeep * smoothstep(-30.0, 20.0, vBasePos.x);
  #ifdef STAGE_LIGHT_DONE
  float baseCard = clamp(dot(inverseTransformDirection(nonPerturbedNormal, viewMatrix), uRigCardDir) * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.indirectDiffuse += uRigCardCol * material.diffuseContribution * RECIPROCAL_PI * 0.34 * baseCard * baseCard * baseDeep * smoothstep(34.0, -8.0, vBasePos.x);
  #endif
  vec3 baseCell = floor(vBasePos * 4.0);
  float baseOne = baseHash(baseCell);
  vec3 baseFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.2 * (vec3(baseHash(baseCell + 3.7), baseHash(baseCell + 11.3), baseHash(baseCell + 23.9)) - 0.5)));
  vec3 baseIn = fract(vBasePos * 4.0) - 0.5;
  float baseGrit = smoothstep(0.5, 0.12, length(baseIn)) * step(0.62, baseOne) * vBasePaint.y;
  reflectedLight.directSpecular += baseKeyC * (pow(max(dot(baseFacet, normalize(baseKey + geometryViewDir)), 0.0), 220.0) * baseGrit * 16.0);
  reflectedLight.directSpecular += uRigCardCol * (pow(max(dot(baseFacet, normalize(normalize(mat3(viewMatrix) * uRigCardDir) + geometryViewDir)), 0.0), 160.0) * baseGrit * 12.0 * smoothstep(34.0, -8.0, vBasePos.x));
}
`

const ICE_VERT_PARS = `
attribute vec2 uv1;
attribute vec3 color;
uniform float uIceGrow[ICE_COUNT];
varying vec3 vIcePos;
varying vec3 vIceNormal;
varying vec4 vIceUv;
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
  vec3 q = vIcePos * vec3(2.6, 1.1, 2.6);
  float e = 0.11;
  float n0 = baseNoise(q);
  vec3 g = vec3(baseNoise(q + vec3(e, 0.0, 0.0)) - n0, baseNoise(q + vec3(0.0, e, 0.0)) - n0, baseNoise(q + vec3(0.0, 0.0, e)) - n0) / e;
  vec3 q2 = vIcePos * 9.0;
  float n1 = baseNoise(q2);
  vec3 g2 = vec3(baseNoise(q2 + vec3(e, 0.0, 0.0)) - n1, baseNoise(q2 + vec3(0.0, e, 0.0)) - n1, baseNoise(q2 + vec3(0.0, 0.0, e)) - n1) / e;
  g = g * 0.34 + g2 * 0.06;
  no = normalize(no - (g - no * dot(g, no)));
  vec3 n = normalize(turn * no);
  vec3 v = normalize(cameraPosition - vStageWorld);
  float nv = clamp(dot(n, v), 0.0, 1.0);
  float fres = 0.018 + 0.982 * pow(1.0 - nv, 5.0);
  vec3 away = reflect(-v, n);
  vec3 mirror = stageRoom(away) + stageRoomLights(away, 0.06) + iceDome(away) * RECIPROCAL_PI + uIceFloor * smoothstep(0.0, -0.3, away.y);

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
  vec3 behind = mix(stageRoom(outW), uIceFloor, smoothstep(0.0, -0.3, outW.y));
  if (hit > 0.5) {
    vec3 rb = turn * normalize(vec3(at.x, 0.0, at.z));
    float under = smoothstep(0.5, 10.0, uIceSpan.z - at.y);
    vec3 fall = (uIceKeyCol * max(dot(rb, uIceKeyDir), 0.0) + uRigCardCol * max(dot(rb, uRigCardDir), 0.0)) * under + iceDome(rb) * (0.25 + 0.75 * under);
    vec2 wuv = vec2(atan(at.x, at.z) / 6.2831853 * uIceTile.x, at.y / uIceTile.y);
    vec3 wood = textureLod(uIceWood, wuv, 2.5).rgb;
    float metal = max(1.0 - smoothstep(uIceSpan.x + 2.2, uIceSpan.x + 2.7, at.y), smoothstep(uIceSpan.z - 1.6, uIceSpan.z - 1.1, at.y));
    behind = mix(wood, uIceBrass, metal) * fall * RECIPROCAL_PI;
  }

  float t = vIceUv.x;
  float seed = vIceUv.y;
  float core = smoothstep(0.2, 0.95, nv);
  float streak = baseNoise(vec3(vIceUv.z * 11.0 + seed * 5.0, t * 2.2 + seed * 3.0, seed * 1.7));
  float grit = baseNoise(vIcePos * 11.0);
  float band = smoothstep(0.3, 0.8, 1.0 - nv);
  float vein = smoothstep(0.3, 0.72, streak);
  float cloud = 0.1 + band * (0.2 + 0.3 * vein) + 0.2 * core * vein * vein + 0.05 * smoothstep(0.66, 0.9, grit) + 0.3 * (1.0 - smoothstep(0.0, 0.1, t));
  float wrap = clamp(dot(n, uIceKeyDir) * 0.5 + 0.5, 0.0, 1.0);
  cloud = clamp(cloud + 0.06 * wrap * wrap, 0.0, 0.85);
  float back = clamp(dot(n, uIceRimDir) * 0.5 + 0.5, 0.0, 1.0);
  float warm = clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0);
  vec3 lit = uIceKeyCol * (0.1 + 0.9 * wrap * wrap) + uRigCardCol * (0.12 + 1.1 * warm * warm) + uIceRimCol * 0.5 * back * back + iceDome(n);
  vec3 milk = vec3(0.7, 0.8, 0.95) * lit * RECIPROCAL_PI;
  vec3 col = mix(behind * vec3(0.92, 0.96, 1.0) * (0.75 + 0.25 * core), milk, cloud);
  col = col * (1.0 - fres) + mirror * fres + milk * (1.25 * pow(1.0 - nv, 3.4));
  float hk = max(dot(n, normalize(v + uIceKeyDir)), 0.0);
  float hr = max(dot(n, normalize(v + uIceRimDir)), 0.0);
  col += uIceKeyCol * (pow(hk, 420.0) * 4.5 + pow(hk, 36.0) * 0.12);
  col += uIceRimCol * (pow(hr, 240.0) * 2.4 + pow(hr, 30.0) * 0.1);
  col += uRigCardCol * (pow(max(dot(n, normalize(v + uRigCardDir)), 0.0), 48.0) * 0.5);
  vec3 cell = floor(vIcePos * 4.5);
  vec3 jit = vec3(baseHash(cell + 1.3), baseHash(cell + 7.1), baseHash(cell + 13.7)) - 0.5;
  vec3 fn = normalize(n + turn * jit * 1.3);
  float inCell = smoothstep(0.5, 0.12, length(fract(vIcePos * 4.5) - 0.5)) * step(0.35, baseHash(cell + 29.0));
  col += (stageRoomLights(reflect(-v, fn), 0.03) * 1.4 + uIceKeyCol * pow(max(dot(fn, normalize(v + uIceKeyDir)), 0.0), 320.0) * 2.0) * inCell;
  gl_FragColor = vec4(col, 1.0);
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

const growth: { delay: number; length: number }[] = []
const SHORT = 0.72
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
  for (let i = 0; i < extras.count; i++) growth.push({ delay: rng.range(0, 0.3) * landed, length: rng.range(0.45, 0.58) * landed })
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
  if (two) held = moment.arrived >= 1 ? 1 : shaking ? 0 : -1
  else if (shaking) held = 1 - partChange('base', (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat))
  const since = Math.max(0, moment.sinceLanding)
  const grow = iceUniforms.uIceGrow.value
  for (let i = 0; i < growth.length; i++) {
    const g = growth[i]!
    const x = held >= 0 ? held : Math.min(1, Math.max(0, (since - g.delay) / g.length))
    grow[i] = SHORT + (1 - SHORT) * x * x * (3 - 2 * x)
  }
}
