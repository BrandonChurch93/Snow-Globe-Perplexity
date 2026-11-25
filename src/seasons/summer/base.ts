import * as THREE from 'three'
import { config } from '../../config'
import { stageMaterial, type Rgb } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { texture } from '../../core/textures'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import type { KitMoment } from '../kit'

export const season = 'summer'
export const main: Rgb = [0.62, 0.45, 0.26]

const PART = 'base-summer'
const MODEL = 'summer/base-summer.glb'
const map = (name: string) => texture(`summer/base-${name}.png`)

export const SAND_COLOUR = { pale: [0.9, 0.8, 0.63], deep: [0.72, 0.58, 0.4], dark: [0.4, 0.3, 0.2], white: [0.97, 0.94, 0.88] } as const
const vec = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`

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

const KEY = `
  vec3 baseKey = vec3(0.0, 1.0, 0.0);
  vec3 baseKeyC = vec3(0.0);
  vec3 baseSunC = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  baseKey = stageKeyL;
  baseKeyC = stageKeyC * stageKeyS;
  baseSunC = stageKeyC * (0.4 + 0.6 * stageKeyS);
  #elif NUM_DIR_LIGHTS > 0
  baseKey = directionalLights[0].direction;
  baseKeyC = directionalLights[0].color;
  baseSunC = baseKeyC;
  #endif
  vec3 baseCard = normalize(mat3(viewMatrix) * uRigCardDir);
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
    Object.assign(shader.uniforms, roomUniforms, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}\n${at.pars ?? ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${at.paint}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${at.rough}`)
      .replace('#include <normal_fragment_maps>', `${at.tilt}\n${BEND}\n${at.bent ?? ''}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${at.after}`)
  }
}

// The stone. Its colour comes bed by bed from the tone map, its relief from the carve map, its grain from the tile; loose
// sand lies on whatever faces up.
const STONE = { grain: 0.16, carve: 2.1, dust: 0.75, glint: 3.0, wrap: 0.9, card: 1.0, sun: 3.4, bounce: 0.5, sheen: 0.5, top: 1.6 }

const STONE_PAINT = `
vec4 baseDetail = texture2D(uBaseGrain, vMapUv);
vec4 baseFine = texture2D(uBaseGrain, vMapUv * 3.7 + 0.37);
vec4 baseCarve = texture2D(uBaseCarve, vBaseUv1);
float baseCavity = clamp(1.0 - 2.0 * baseCarve.b, 0.0, 1.0);
float baseHigh = clamp(2.0 * baseCarve.b - 1.0, 0.0, 1.0);
float baseAo = mix(1.0, vBasePaint.x, 0.8) * (1.0 - 0.24 * baseCavity);
diffuseColor.rgb = diffuse * texture2D(uBaseTone, vBaseUv1).rgb;
float baseBlotch = baseNoise(vBasePos * 0.23) * 0.6 + baseNoise(vBasePos * 0.9) * 0.4;
diffuseColor.rgb *= mix(0.86, 1.1, baseBlotch) * (0.96 + 0.08 * baseDetail.b) * (0.97 + 0.06 * baseFine.b);
diffuseColor.rgb *= 0.88 + 0.24 * baseHash(floor(vBasePos * 6.5));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.72, 0.56), 0.32 * baseCavity);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.86, 0.72), 0.3 * baseHigh);
`

const STONE_ROUGH = `
roughnessFactor = clamp(0.86 + 0.12 * (baseDetail.b - 0.5) + 0.08 * baseCavity - 0.1 * baseHigh, 0.5, 1.0);
metalnessFactor = 0.0;
`

const STONE_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * ${STONE.grain.toFixed(2)} + baseSlope(baseFine.rg) * ${(STONE.grain * 0.5).toFixed(2)} + baseSlope(baseCarve.rg) * ${STONE.carve.toFixed(2)};
`

const STONE_BENT = `
float baseUp = smoothstep(0.35, 0.8, mix(normalize(vBaseNormal).y, baseObjectNormal.y, 0.5));
float baseDrift = baseNoise(vBasePos * 0.7 + 3.0) * 0.6 + baseNoise(vBasePos * 2.9) * 0.4;
float baseDust = clamp(baseUp * (0.35 + 0.9 * baseDrift) * ${STONE.dust.toFixed(2)} * smoothstep(0.6, 3.0, vBasePos.y), 0.0, 1.0);
vec3 baseCellS = floor(vBasePos * 3.6);
float baseSpeck = baseHash(baseCellS);
vec3 baseSandC = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, baseSpeck) * (0.9 + 0.2 * baseFine.b);
diffuseColor.rgb = mix(diffuseColor.rgb, baseSandC, baseDust * (0.55 + 0.45 * step(0.35, baseFine.b)));
roughnessFactor = mix(roughnessFactor, 0.95, baseDust);
`

const STONE_AFTER = `
{
  ${KEY}
  reflectedLight.indirectDiffuse *= baseAo;
  reflectedLight.indirectSpecular *= baseAo * 0.6;
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.55);
  reflectedLight.directSpecular *= mix(1.0, baseAo, 0.8) * 0.5;
  float stoneWarm = clamp(dot(geometryNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  float stoneSun = clamp((dot(geometryNormal, baseKey) + ${STONE.wrap.toFixed(2)}) / ${(1 + STONE.wrap).toFixed(2)}, 0.0, 1.0);
  vec3 stoneBounce = mix(vec3(1.0, 0.7, 0.42), vec3(1.0, 0.93, 0.82), smoothstep(2.0, 26.0, vBasePos.y)) * dot(baseSunC, vec3(0.3333)) * 1.6;
  float stoneUp = clamp(inverseTransformDirection(geometryNormal, viewMatrix).y, -1.0, 1.0);
  float stoneOpen = mix(0.28, 1.45, smoothstep(-0.45, 0.5, stoneUp)) * mix(0.42, 1.2, smoothstep(2.0, 34.0, vBasePos.y));
  float stoneDapple = mix(0.45, 1.7, smoothstep(0.3, 0.7, baseNoise(vBasePos * 0.13 + 7.0) * 0.65 + baseNoise(vBasePos * 0.41 + 3.0) * 0.35));
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * ((uRigCardCol * ${STONE.card.toFixed(2)} * stoneWarm * stoneWarm + stoneBounce * ${STONE.bounce.toFixed(2)}) * stoneOpen + baseSunC * stoneDapple * (${STONE.sun.toFixed(2)} * stoneSun * stoneSun + ${STONE.top.toFixed(2)} * smoothstep(27.0, 39.0, vBasePos.y) * (0.3 + 0.7 * smoothstep(0.0, 0.7, stoneUp))));
  float stoneSheen = pow(max(dot(normal, normalize(baseCard + geometryViewDir)), 0.0), 14.0) + pow(max(dot(normal, normalize(normalize((viewMatrix * vec4(-0.3, 0.8, 0.5, 0.0)).xyz) + geometryViewDir)), 0.0), 22.0);
  reflectedLight.directSpecular += vec3(1.0, 0.9, 0.76) * dot(baseSunC, vec3(0.3333)) * stoneSheen * ${STONE.sheen.toFixed(2)} * baseAo * (1.0 - baseDust);
  vec3 stoneCell = floor(vBasePos * 5.5);
  vec3 stoneFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.3 * (vec3(baseHash(stoneCell + 3.7), baseHash(stoneCell + 11.3), baseHash(stoneCell + 23.9)) - 0.5)));
  float stoneOne = baseHash(stoneCell + 41.0);
  float stoneGrit = smoothstep(mix(0.2, 0.45, stoneOne), 0.08, length(fract(vBasePos * 5.5) - 0.5)) * step(0.55, baseHash(stoneCell)) * (0.3 + 2.0 * stoneOne * stoneOne);
  float stoneLit = smoothstep(0.0, 0.2, dot(geometryNormal, baseKey));
  reflectedLight.directSpecular += baseKeyC * (pow(max(dot(stoneFacet, normalize(baseKey + geometryViewDir)), 0.0), 160.0) * stoneGrit * stoneLit * ${STONE.glint.toFixed(2)} * (0.5 + baseDust) * baseAo);
  reflectedLight.directSpecular += uRigCardCol * (pow(max(dot(stoneFacet, normalize(baseCard + geometryViewDir)), 0.0), 120.0) * stoneGrit * ${(STONE.glint * 0.6).toFixed(2)} * (0.5 + baseDust) * baseAo * smoothstep(0.0, 0.25, dot(geometryNormal, baseCard)));
}
`

// Shell: the colour is in the vertices; the second uv holds the shade of its own folds and how glossy it is.
const SHELL_PAINT = `
float baseAo = 0.18 + 0.82 * pow(vBaseUv1.x, 1.4);
float baseGloss = vBaseUv1.y;
float shellChalk = baseNoise(vBasePos * 6.0) * 0.6 + baseNoise(vBasePos * 17.0) * 0.4;
diffuseColor.rgb *= mix(0.9, 1.06, shellChalk);
diffuseColor.rgb = mix(diffuseColor.rgb, ${vec(SAND_COLOUR.pale)}, 0.5 * (1.0 - vBaseUv1.x) * (1.0 - smoothstep(0.8, 1.0, baseGloss)) * smoothstep(0.4, 0.7, shellChalk));
`
const SHELL_ROUGH = `
roughnessFactor = clamp(mix(0.72, 0.16, baseGloss) + 0.12 * (shellChalk - 0.5), 0.1, 1.0);
metalnessFactor = 0.0;
`
const SHELL_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 9.0 + 5.0), baseNoise(vBasePos * 9.0 + 31.0)) - 0.5) * 0.22 * (1.0 - baseGloss);
`
const SHELL_AFTER = `
{
  ${KEY}
  reflectedLight.indirectDiffuse *= baseAo;
  reflectedLight.indirectSpecular *= baseAo;
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.5);
  float shellWarm = clamp(dot(geometryNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  float shellSun = clamp((dot(geometryNormal, baseKey) + 0.3) / 1.3, 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * (uRigCardCol * 0.75 * shellWarm * shellWarm + baseKeyC * 1.3 * shellSun * shellSun + vec3(1.0, 0.9, 0.76) * dot(baseSunC, vec3(0.3333)) * 1.5 * (0.4 + 0.6 * shellWarm));
  vec3 shellAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float shellNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float shellF = 0.05 + 0.95 * pow(1.0 - shellNv, 5.0);
  reflectedLight.indirectSpecular += (stageRoomSoft(shellAway, 0.3) + stageRoomLights(shellAway, 0.03)) * shellF * baseGloss * baseAo;
  float shellNh = max(dot(geometryNormal, normalize(baseKey + geometryViewDir)), 0.0);
  float shellCh = max(dot(geometryNormal, normalize(baseCard + geometryViewDir)), 0.0);
  vec3 shellPearl = 0.5 + 0.5 * cos(6.2831853 * (shellNv * 1.3 + vec3(0.0, 0.33, 0.67)));
  float shellLustre = smoothstep(0.8, 1.0, baseGloss);
  reflectedLight.directSpecular += (baseKeyC * (0.9 * pow(shellNh, 220.0) + 0.05 * pow(shellNh, 14.0)) * smoothstep(0.0, 0.15, dot(geometryNormal, baseKey)) + (uRigCardCol + vec3(1.0, 0.9, 0.76) * dot(baseSunC, vec3(0.3333)) * 1.4) * (0.7 * pow(shellCh, 120.0) + 0.1 * pow(shellCh, 9.0)) * smoothstep(0.0, 0.2, dot(geometryNormal, baseCard))) * baseGloss * baseAo * mix(vec3(1.0), 0.7 + 0.6 * shellPearl, shellLustre);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * (baseKeyC + uRigCardCol) * 0.08 * shellLustre * shellPearl;
}
`

// Sea glass: tumbled, so nothing mirrors in it; the light goes into it and comes out as its colour, most where it is thin.
const GLASS_PAINT = `
float baseThin = vBaseUv1.x;
float baseFrost = vBaseUv1.y;
float baseAo = 0.55 + 0.45 * (1.0 - baseThin);
float glassPit = baseNoise(vBasePos * 14.0) * 0.6 + baseNoise(vBasePos * 31.0) * 0.4;
diffuseColor.rgb *= mix(0.82, 1.0, glassPit);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))) * 1.25 + 0.1, 0.22 * baseFrost * glassPit);
`
const GLASS_ROUGH = `
roughnessFactor = clamp(mix(0.2, 0.55, baseFrost) + 0.12 * (glassPit - 0.5), 0.12, 1.0);
metalnessFactor = 0.0;
`
const GLASS_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 23.0 + 5.0), baseNoise(vBasePos * 23.0 + 31.0)) - 0.5) * 0.3;
`
const GLASS_AFTER = `
{
  ${KEY}
  vec3 glassTint = mix(material.diffuseContribution, vec3(dot(material.diffuseContribution, vec3(0.3333))) + 0.16, 0.16 + 0.16 * baseFrost);
  vec3 glassDeep = glassTint * (0.7 + 1.3 * glassTint);
  float glassNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float glassBody = mix(0.35, 1.0, baseThin);
  reflectedLight.directDiffuse *= 0.5;
  reflectedLight.indirectDiffuse *= 0.6;
  float glassSun = clamp((dot(geometryNormal, baseKey) + 0.6) / 1.6, 0.0, 1.0);
  float glassWarm = clamp(dot(geometryNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.indirectDiffuse += glassDeep * RECIPROCAL_PI * glassBody * (baseKeyC * 1.8 * glassSun * glassSun + (uRigCardCol * 1.5 + vec3(1.0, 0.93, 0.82) * dot(baseSunC, vec3(0.3333)) * 1.3) * glassWarm * glassWarm);
  #ifdef STAGE_LIGHT_DONE
  reflectedLight.indirectDiffuse += stageThrough(geometryNormal, geometryViewDir, 0.4, 3.0) * glassDeep * (0.4 + 1.6 * baseThin);
  #endif
  reflectedLight.indirectDiffuse += mix(glassTint, vec3(dot(glassTint, vec3(0.3333))) + 0.25, 0.5) * RECIPROCAL_PI * (baseKeyC * 0.5 + uRigCardCol * 0.4) * pow(1.0 - glassNv, 2.5) * (0.4 + 0.6 * baseFrost);
  vec3 glassAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float glassF = 0.04 + 0.96 * pow(1.0 - glassNv, 5.0);
  reflectedLight.indirectSpecular += (stageRoomSoft(glassAway, 0.4) + stageRoomLights(glassAway, 0.05) * (1.0 - baseFrost)) * glassF;
  float glassNh = max(dot(geometryNormal, normalize(baseKey + geometryViewDir)), 0.0);
  float glassCh = max(dot(geometryNormal, normalize(baseCard + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += baseKeyC * (0.3 * pow(glassNh, 30.0) + 2.0 * pow(glassNh, 500.0)) * smoothstep(0.0, 0.15, dot(geometryNormal, baseKey)) * (1.0 - 0.6 * baseFrost);
  float glassRoom = max(dot(geometryNormal, normalize(normalize(vec3(-0.35, 0.55, 0.75)) + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (uRigCardCol + vec3(1.0, 0.93, 0.82) * dot(baseSunC, vec3(0.3333)) * 1.6) * (0.3 * pow(glassRoom, 18.0) + 0.7 * pow(glassRoom, 140.0) * (1.0 - 0.7 * baseFrost));
  reflectedLight.indirectDiffuse += glassDeep * RECIPROCAL_PI * uRigCardCol * 0.6 * glassBody * clamp(inverseTransformDirection(geometryNormal, viewMatrix).y * 0.6 + 0.4, 0.0, 1.0);
  reflectedLight.directSpecular += uRigCardCol * (0.22 * pow(glassCh, 14.0) + 0.9 * pow(glassCh, 180.0) * (1.0 - 0.8 * baseFrost)) * smoothstep(0.0, 0.2, dot(geometryNormal, baseCard));
}
`

// Loose sand. The mesh carries how thick it lies (red of the vertex colour); the tile carries single grains, each with its
// own number, and a grain is drawn only where the sand is thicker than its number: so a thin layer is single grains and the
// edge of a heap breaks up into them.
export const SAND = { tileMm: 9.6, cover: 0.62, glint: 5.0, slope: 1.5, wrap: 32.0, thru: 5.0, ledge: 1.0, stage: 0.35, drape: 0.55, crest: 1.6 }
const SHADE = { r: 56, soft: 3.5, top: 40, globeH: 79, globeR: 60, globe: 0.5, front: 0.35, frontMm: [16, 52] }
export const sandUniforms = {
  uSandSpill: { value: 1 },
}

const SAND_PARS = `
uniform sampler2D uSandTile;
uniform mat4 modelMatrix;
uniform float uSandSpill;
float sandShadow(vec3 p, vec3 L) {
  float lit = 1.0;
  float a = dot(L.xz, L.xz);
  float r2 = dot(p.xz, p.xz);
  if (a > 1e-5 && r2 > ${(SHADE.r * SHADE.r).toFixed(1)}) {
    float b = dot(p.xz, L.xz);
    float miss = sqrt(max(r2 - b * b / a, 0.0));
    float disc = max(b * b - a * (r2 - ${(SHADE.r * SHADE.r).toFixed(1)}), 0.0);
    float t = (-b - sqrt(disc)) / a;
    float hit = smoothstep(${(SHADE.r + SHADE.soft).toFixed(1)}, ${(SHADE.r - SHADE.soft).toFixed(1)}, miss) * step(0.0, -b) * smoothstep(${(SHADE.top + 3).toFixed(1)}, ${(SHADE.top - 3).toFixed(1)}, p.y + max(t, 0.0) * L.y);
    lit *= 1.0 - hit;
  }
  vec3 oc = p - vec3(0.0, ${SHADE.globeH.toFixed(1)}, 0.0);
  float bs = dot(oc, L);
  float away = sqrt(max(dot(oc, oc) - bs * bs, 0.0));
  lit *= 1.0 - ${SHADE.globe.toFixed(2)} * step(bs, 0.0) * smoothstep(${(SHADE.globeR + 2).toFixed(1)}, ${(SHADE.globeR - 9).toFixed(1)}, away) * step(${(SHADE.r * SHADE.r).toFixed(1)}, r2);
  lit *= mix(1.0, ${SHADE.front.toFixed(2)}, smoothstep(${SHADE.frontMm[0].toFixed(1)}, ${SHADE.frontMm[1].toFixed(1)}, p.z) * step(p.y, 20.0) * step(${(SHADE.r * SHADE.r).toFixed(1)}, r2));
  return lit;
}
`
const SAND_PAINT = `
float sandSteep = smoothstep(0.35, 0.7, 1.0 - abs(normalize(vBaseNormal).y));
vec3 sandAt = (modelMatrix * vec4(vBasePos, 1.0)).xyz;
vec2 sandFlat = (mat2(0.891, 0.454, -0.454, 0.891) * vBasePos.xz) / ${SAND.tileMm.toFixed(2)} + 0.3 * vec2(baseNoise(sandAt * 0.13 + 5.0), baseNoise(sandAt * 0.13 + 23.0));
vec2 sandWall = vec2(atan(vBasePos.x, vBasePos.z) * 55.0, vBasePos.y) / ${SAND.tileMm.toFixed(2)};
vec2 sandUv = mix(sandFlat, sandWall, step(0.5, vBasePaint.z));
vec4 sandOne = texture2D(uSandTile, sandUv);
vec4 sandTwo = texture2D(uSandTile, mat2(0.454, 0.891, -0.891, 0.454) * sandUv * 0.71 + 0.31);
float sandThick = vBasePaint.x;
if (vBasePaint.z > 0.5) sandThick *= ${SAND.drape.toFixed(2)} * smoothstep(uSandSpill * 1.2, uSandSpill * 1.2 - 0.25, vBaseUv1.x);
float sandCover = vBasePaint.z > 0.5 ? sandThick : smoothstep(0.22, 0.7, sandThick);
bool sandFirst = sandOne.b > 0.02 && sandCover >= sandOne.b * ${SAND.cover.toFixed(2)} + 0.004;
float sandGrain = sandFirst ? sandOne.b : sandTwo.b;
vec2 sandRg = sandFirst ? sandOne.rg : sandTwo.rg;
float sandNeed = sandGrain > 0.02 ? sandGrain * ${SAND.cover.toFixed(2)} : ${(SAND.cover * 1.05).toFixed(2)};
if (sandCover < sandNeed + 0.004) discard;
float sandId = fract(sandGrain * 37.31);
float sandId2 = fract(sandGrain * 91.7);
vec3 sandC = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, smoothstep(0.1, 0.75, sandId));
sandC = mix(sandC, ${vec(SAND_COLOUR.dark)}, step(0.93, sandId2));
sandC = mix(sandC, ${vec(SAND_COLOUR.white)}, step(sandId2, 0.1));
float sandDeep = smoothstep(0.1, 0.9, sandThick);
float sandPit = sandGrain > 0.02 ? 1.0 : 0.55;
float sandBlotch = baseNoise(sandAt * 0.35) * 0.6 + baseNoise(sandAt * 1.3) * 0.4;
diffuseColor.rgb = diffuse * sandC * sandPit * mix(0.9, 1.08, sandBlotch);
float baseAo = mix(0.8, 1.0, sandDeep) * (0.55 + 0.45 * vBasePaint.y);
`
const SAND_ROUGH = `
roughnessFactor = 0.9;
metalnessFactor = 0.0;
`
const SAND_TILT = `
vec2 baseTilt = baseSlope(sandRg) * ${SAND.slope.toFixed(2)} + (vec2(baseNoise(sandAt * 1.9 + 17.0), baseNoise(sandAt * 1.9 + 51.0)) - 0.5) * 0.5;
`
const SAND_AFTER = `
{
  ${KEY}
  float sandLit = sandShadow(sandAt, normalize(inverseTransformDirection(baseKey, viewMatrix)));
  reflectedLight.indirectDiffuse *= baseAo * ${(SAND.stage * 1.4).toFixed(2)};
  reflectedLight.indirectSpecular *= baseAo * 0.3;
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.4) * mix(0.25, 1.0, sandLit) * ${SAND.stage.toFixed(2)};
  float sandWrap = clamp((dot(normalize(mix(nonPerturbedNormal, normal, 0.5)), baseKey) + 0.04) / 1.04, 0.0, 1.0);
  sandWrap = max(sandWrap, 0.5 * smoothstep(24.0, 38.0, sandAt.y));
  float sandHigh = 1.0 + ${SAND.ledge.toFixed(2)} * smoothstep(24.0, 38.0, sandAt.y) + ${SAND.crest.toFixed(2)} * smoothstep(1.0, 6.5, sandAt.y) * (1.0 - smoothstep(14.0, 20.0, sandAt.y));
  float sandThru = pow(clamp(dot(-geometryViewDir, baseKey) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  reflectedLight.indirectDiffuse += mix(baseKeyC, baseSunC, smoothstep(24.0, 38.0, sandAt.y)) * material.diffuseContribution * RECIPROCAL_PI * (${SAND.wrap.toFixed(2)} * sandWrap * sandWrap * sandWrap + ${SAND.thru.toFixed(2)} * sandThru * sandWrap * sandWrap) * sandLit * sandHigh;
  float sandWarm = clamp(dot(nonPerturbedNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.indirectDiffuse += uRigCardCol * material.diffuseContribution * RECIPROCAL_PI * 0.1 * sandWarm * sandWarm * mix(0.5, 1.0, sandLit);
  reflectedLight.indirectDiffuse *= mix(0.55, 1.0, sandLit);
  vec3 sandFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.3 * (vec3(fract(sandGrain * 53.1), fract(sandGrain * 113.7), fract(sandGrain * 211.3)) - 0.5)));
  float sandShine = step(0.72, fract(sandGrain * 17.9)) * step(0.02, sandGrain);
  reflectedLight.directSpecular += baseKeyC * (pow(max(dot(sandFacet, normalize(baseKey + geometryViewDir)), 0.0), 90.0) * sandShine * ${SAND.glint.toFixed(1)} * smoothstep(0.0, 0.2, dot(nonPerturbedNormal, baseKey))) * sandLit;
  reflectedLight.directSpecular += uRigCardCol * (pow(max(dot(sandFacet, normalize(baseCard + geometryViewDir)), 0.0), 70.0) * sandShine * ${(SAND.glint * 0.5).toFixed(1)});
}
`

export function sandMaterial(part: string, change: string, key: string): THREE.MeshStandardMaterial {
  return stageMaterial({
    part,
    standIn: false,
    change,
    key,
    side: THREE.DoubleSide,
    hook: hookOf({ uSandTile: { value: map('sand.lin.tile.w512') }, uSandSpill: sandUniforms.uSandSpill }, { pars: SAND_PARS, paint: SAND_PAINT, rough: SAND_ROUGH, tilt: SAND_TILT, after: SAND_AFTER }),
  })
}

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
  const lit = { part: PART, standIn: false, change: 'base' } as const
  const stone = stageMaterial({
    ...lit,
    key: `${PART}-stone`,
    map: map('grain.lin.tile.w512'),
    hook: hookOf(
      { uBaseGrain: { value: map('grain.lin.tile.w512') }, uBaseCarve: { value: map('carve.lin.w2048') }, uBaseTone: { value: map('stone.srgb.w2048') } },
      { pars: 'uniform sampler2D uBaseGrain;\nuniform sampler2D uBaseCarve;\nuniform sampler2D uBaseTone;', paint: STONE_PAINT, rough: STONE_ROUGH, tilt: STONE_TILT, bent: STONE_BENT, after: STONE_AFTER },
    ),
  })
  const shell = stageMaterial({ ...lit, key: `${PART}-shell`, vertexColors: true, hook: hookOf({}, { paint: SHELL_PAINT, rough: SHELL_ROUGH, tilt: SHELL_TILT, after: SHELL_AFTER }) })
  const glass = stageMaterial({ ...lit, key: `${PART}-seaglass`, vertexColors: true, hook: hookOf({}, { paint: GLASS_PAINT, rough: GLASS_ROUGH, tilt: GLASS_TILT, after: GLASS_AFTER }) })
  const sand = sandMaterial(PART, 'base', `${PART}-sand`)
  group.add(solid('stone', stone), solid('shells', shell), solid('seaglass', glass), solid('sand', sand))
  return group
}

// Seconds since the sand was set loose by a landing: Infinity when it has long come to rest (and for the season that is
// leaving), negative while the globe is in the air with this season not yet landed.
export function sinceLoose(moment: KitMoment): number {
  if (!(moment.sinceLanding < Infinity)) return Infinity
  const swapping = moment.beat !== null && moment.beat >= config.shake.swapWindow.fromBeat
  if (swapping) return moment.arrived >= 0.5 ? Infinity : -1
  return Math.max(0, moment.sinceLanding)
}

// The sand over the lip runs after the landing: it is held back while the globe is in the air and has run its length a
// little over a second after the foot is flat.
const SPILL = { start: 0.3, seconds: 1.1 }
export function spillAt(moment: KitMoment): number {
  const t = sinceLoose(moment)
  if (t < 0) return SPILL.start
  if (!(t < Infinity)) return 1
  return SPILL.start + (1 - SPILL.start) * Math.min(1, (1 - Math.exp((-3 * t) / SPILL.seconds)) / (1 - Math.exp(-3)))
}

export function update(moment: KitMoment): void {
  sandUniforms.uSandSpill.value = spillAt(moment)
}
