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

export const SAND_COLOUR = { pale: [0.92, 0.83, 0.67], deep: [0.8, 0.67, 0.49], dark: [0.56, 0.44, 0.3], white: [0.97, 0.94, 0.88] } as const
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

// How near a point of the base is to the glass, and to the tabletop: the crease under the sphere and the foot's own shade.
const SEAT = `
float baseSeatD = length(vBasePos - vec3(0.0, 79.0, 0.0)) - 60.0;
float baseSeatAo = mix(0.1, 1.0, smoothstep(0.1, 1.3, baseSeatD)) * mix(0.5, 1.0, smoothstep(0.6, 6.5, baseSeatD));
float baseFootAo = mix(0.42, 1.0, smoothstep(0.0, 2.4, vBasePos.y)) * mix(0.8, 1.0, smoothstep(1.5, 6.0, vBasePos.y));
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
const STONE = { grain: 0.55, carve: 1.5, dust: 0.75, glint: 3.0, wrap: 0.3, card: 0.07, sun: 1.05, kick: 0.15, flare: 1.05, side: 3.2, bounce: 0.05, sheen: 0.03, top: 0.6, belly: 0.75, table: 0.7, patch: 0.5 }

const STONE_PAINT = `
vec4 baseDetail = texture2D(uBaseGrain, vMapUv);
vec4 baseFine = texture2D(uBaseGrain, vMapUv * 3.7 + 0.37);
vec4 baseCarve = texture2D(uBaseCarve, vBaseUv1);
float baseCavity = clamp(1.0 - 2.0 * baseCarve.b, 0.0, 1.0);
float baseHigh = clamp(2.0 * baseCarve.b - 1.0, 0.0, 1.0);
${SEAT}
float baseAo = mix(1.0, vBasePaint.x, 0.8) * (1.0 - 0.46 * baseCavity) * baseSeatAo * baseFootAo;
diffuseColor.rgb = diffuse * texture2D(uBaseTone, vBaseUv1).rgb * vec3(1.0, 0.98, 0.93);
diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))) * vec3(1.0, 0.99, 0.96), diffuseColor.rgb, 0.5);
float baseBlotch = baseNoise(vBasePos * 0.23) * 0.6 + baseNoise(vBasePos * 0.9) * 0.4;
diffuseColor.rgb *= mix(0.86, 1.1, baseBlotch) * (0.96 + 0.08 * baseDetail.b) * (0.97 + 0.06 * baseFine.b);
diffuseColor.rgb *= (0.84 + 0.32 * baseHash(floor(vBasePos * 2.7 + 1.3))) * (0.86 + 0.28 * baseHash(floor(vBasePos * 7.0))) * (0.9 + 0.2 * baseNoise(vBasePos * 9.0)) * (0.9 + 0.2 * baseHash(floor(vBasePos * 13.0 + 5.0)));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.62, 0.4), 0.7 * baseCavity);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.86, 0.72), 0.42 * baseHigh);
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
  reflectedLight.indirectDiffuse *= baseAo * 0.19 * vec3(0.96, 1.0, 1.1);
  reflectedLight.indirectSpecular *= baseAo * 0.3;
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.55) * 0.6;
  reflectedLight.directSpecular *= mix(1.0, baseAo, 0.8) * 0.5;
  float stoneWarm = clamp(dot(geometryNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  float stoneSun = clamp((dot(geometryNormal, baseKey) + ${STONE.wrap.toFixed(2)}) / ${(1 + STONE.wrap).toFixed(2)}, 0.0, 1.0);
  vec3 stoneBounce = mix(vec3(3.2, 2.0, 1.0), vec3(0.95, 0.88, 0.8), smoothstep(1.0, 14.0, vBasePos.y)) * dot(baseSunC, vec3(0.3333)) * 1.6;
  float stoneUp = clamp(inverseTransformDirection(geometryNormal, viewMatrix).y, -1.0, 1.0);
  vec3 stoneKick = normalize(mat3(viewMatrix) * vec3(-0.85, 0.35, -0.3));
  float stoneLeft = clamp((dot(geometryNormal, stoneKick) + 0.25) / 1.25, 0.0, 1.0);
  float stoneBelly = mix(${STONE.belly.toFixed(2)}, 1.0, smoothstep(1.0, 27.0, vBasePos.y));
  reflectedLight.indirectDiffuse *= stoneBelly;
  reflectedLight.directDiffuse *= mix(1.0, stoneBelly, 0.6);
  float stoneOpen = mix(0.05, 2.1, smoothstep(-0.35, 0.6, stoneUp)) * mix(0.3, 1.05, smoothstep(2.0, 34.0, vBasePos.y));
  float stoneDapple = mix(0.7, 2.0, smoothstep(0.3, 0.7, baseNoise(vBasePos * 0.13 + 7.0) * 0.65 + baseNoise(vBasePos * 0.41 + 3.0) * 0.35));
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * ((uRigCardCol * ${STONE.card.toFixed(2)} * stoneWarm * stoneWarm + baseSunC * ${STONE.side.toFixed(2)} * pow(stoneWarm, 36.0) + stoneBounce * ${STONE.bounce.toFixed(2)}) * stoneOpen * stoneBelly + baseSunC * stoneDapple * (${STONE.sun.toFixed(2)} * stoneSun * stoneSun + vec3(1.0, 0.8, 0.56) * ${STONE.kick.toFixed(2)} * stoneLeft * stoneLeft * stoneLeft * smoothstep(8.0, 30.0, vBasePos.y) + ${STONE.top.toFixed(2)} * smoothstep(26.0, 42.0, vBasePos.y) * (0.3 + 0.7 * smoothstep(0.0, 0.7, stoneUp))));
  // The sun's glint on the wet table in front of the base on the left throws its warmth back up the left flank, strongest low down.
  vec3 stoneFlare = normalize(mat3(viewMatrix) * vec3(-0.72, -0.1, 0.68));
  float stoneFl = clamp((dot(geometryNormal, stoneFlare) + 0.1) / 1.1, 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * vec3(1.0, 0.56, 0.21) * dot(baseSunC, vec3(0.3333)) * (${STONE.flare.toFixed(2)} * stoneFl * stoneFl * smoothstep(44.0, 10.0, vBasePos.y) * smoothstep(8.0, -36.0, vBasePos.x));
  // The room's cool light comes back off the wet table onto the belly, most on the side the sun's glint does not reach.
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * mix(vec3(1.0, 0.83, 0.62), vec3(0.74, 0.8, 0.9), smoothstep(8.0, 46.0, vBasePos.x)) * dot(baseSunC, vec3(0.3333)) * (${STONE.table.toFixed(2)} * mix(0.55, 1.0, smoothstep(36.0, 3.0, vBasePos.y)) * smoothstep(-34.0, 22.0, vBasePos.x));
  // The sun behind goes through the globe and comes out gathered: a warm patch on the upper band left of the middle, cut off on its right by a slanting edge.
  float stoneAz = atan(vBasePos.x, vBasePos.z);
  float stoneEdge = stoneAz + 0.016 * (vBasePos.y - 30.0) + 0.1 * (baseNoise(vBasePos * 0.3 + 19.0) - 0.5);
  float stonePatch = smoothstep(0.1, -0.42, stoneEdge) * smoothstep(-1.5, -0.6, stoneAz) * smoothstep(19.0, 27.0, vBasePos.y + 5.0 * (baseNoise(vBasePos * 0.21 + 31.0) - 0.5));
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * baseSunC * vec3(1.0, 0.8, 0.58) * (${STONE.patch.toFixed(2)} * stonePatch * (0.6 + 0.8 * baseHigh) * (1.0 - 0.6 * baseCavity));
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
${SEAT}
float baseAo = (0.5 + 0.5 * pow(vBaseUv1.x, 1.2)) * baseFootAo;
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
  reflectedLight.indirectDiffuse *= baseAo * 0.4 * vec3(0.88, 0.96, 1.08);
  reflectedLight.indirectSpecular *= baseAo * 0.5;
  // The shells on the front stand in the base's own shade, lit by the room's cool fill, not by the sun.
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.5) * 0.95 * vec3(1.0, 0.97, 0.92);
  float shellLeft = clamp((dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.85, 0.35, -0.3))) + 0.2) / 1.2, 0.0, 1.0);
  // The same light wrapped right round, so the far side of each rib is dimmer, not black.
  float shellWide = clamp(dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.85, 0.35, -0.3))) * 0.5 + 0.5, 0.0, 1.0);
  float shellWarm = clamp(dot(geometryNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  float shellSun = clamp((dot(geometryNormal, baseKey) + 0.3) / 1.3, 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * (uRigCardCol * 0.15 * shellWarm * shellWarm + baseSunC * 0.5 * pow(shellWarm, 14.0) + baseKeyC * 0.9 * shellSun * shellSun + baseSunC * (0.75 * shellLeft * shellLeft + 0.5 * shellWide) + vec3(1.0, 0.9, 0.78) * dot(baseSunC, vec3(0.3333)) * 0.34);
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
${SEAT}
float baseAo = (0.55 + 0.45 * (1.0 - baseThin)) * mix(0.45, 1.0, smoothstep(0.0, 0.22, baseThin)) * baseFootAo;
float glassPit = baseNoise(vBasePos * 14.0) * 0.6 + baseNoise(vBasePos * 31.0) * 0.4;
float glassOne = baseHash(floor(vBasePaint * 255.0) + 3.0);
float glassLum = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
diffuseColor.rgb *= mix(0.95, 1.0, glassPit);
// Tumbled glass is not one flat colour: cloudy in patches, a little toward the sea's own grey-green, with pale pits where the frost is deepest.
float glassCloud = baseNoise(vBasePos * 2.7 + 40.0 * glassOne) * 0.65 + baseNoise(vBasePos * 6.3 + 9.0) * 0.35;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(glassLum) * vec3(0.72, 1.04, 1.06), 0.3) * vec3(0.86, 0.84, 0.94) * mix(0.85, 1.2, glassCloud);
float glassFleck = smoothstep(0.74, 0.86, baseNoise(vBasePos * 27.0 + 3.0)) * (0.4 + 0.6 * baseNoise(vBasePos * 4.0 + 13.0));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))) * 1.5 + 0.07, 0.55 * glassFleck);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(glassLum) * vec3(0.96, 1.02, 1.0) + 0.14, 0.16 + 0.14 * baseFrost + 0.12 * glassOne);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(glassLum) + 0.12, 0.4 * smoothstep(0.4, 0.0, baseThin));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))) * 1.25 + 0.1, 0.08 * baseFrost * glassPit);
`
const GLASS_ROUGH = `
roughnessFactor = clamp(mix(0.5, 0.74, baseFrost) + 0.2 * (glassOne - 0.5) + 0.1 * (glassPit - 0.5), 0.3, 1.0);
metalnessFactor = 0.0;
`
const GLASS_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 23.0 + 5.0), baseNoise(vBasePos * 23.0 + 31.0)) - 0.5) * 0.0;
`
const GLASS_AFTER = `
{
  ${KEY}
  vec3 glassTint = mix(material.diffuseContribution, vec3(dot(material.diffuseContribution, vec3(0.3333))) + 0.16, 0.05 + 0.1 * baseFrost);
  vec3 glassDeep = glassTint * (0.7 + 1.3 * glassTint);
  float glassNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float glassBody = mix(0.9, 1.15, baseThin);
  reflectedLight.directDiffuse *= 0.45;
  reflectedLight.indirectDiffuse *= 0.45;
  float glassSun = clamp((dot(geometryNormal, baseKey) + 0.6) / 1.6, 0.0, 1.0);
  float glassWarm = clamp(dot(geometryNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.indirectDiffuse += glassDeep * RECIPROCAL_PI * glassBody * (baseKeyC * 0.4 * glassSun * glassSun + (uRigCardCol * 0.2 + vec3(1.0, 0.93, 0.82) * dot(baseSunC, vec3(0.3333)) * 0.03) * glassWarm * glassWarm);
  #ifdef STAGE_LIGHT_DONE
  reflectedLight.indirectDiffuse += stageThrough(geometryNormal, geometryViewDir, 0.4, 3.0) * glassDeep * (0.22 + 0.08 * baseThin) * (0.7 + 0.6 * glassOne);
  #endif
  reflectedLight.indirectDiffuse += mix(glassTint, vec3(dot(glassTint, vec3(0.3333))) + 0.25, 0.5) * RECIPROCAL_PI * (baseKeyC * 0.5 + uRigCardCol * 0.4) * pow(1.0 - glassNv, 2.5) * (0.2 + 0.3 * baseFrost);
  float glassSkin = clamp((dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.6, 0.5, 0.6))) + 0.5) / 1.5, 0.0, 1.0);
  reflectedLight.indirectDiffuse += (glassTint * 0.75 + 0.1) * RECIPROCAL_PI * dot(baseSunC, vec3(0.3333)) * vec3(1.0, 0.93, 0.82) * 0.8 * glassSkin * glassSkin * (0.6 + 0.4 * baseFrost) * baseFootAo;
  vec3 glassAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float glassF = 0.04 + 0.96 * pow(1.0 - glassNv, 5.0);
  reflectedLight.indirectSpecular += (stageRoomSoft(glassAway, 0.6) + stageRoomLights(glassAway, 0.2) * 0.15 * (1.0 - baseFrost)) * glassF * 0.35;
  float glassNh = max(dot(geometryNormal, normalize(baseKey + geometryViewDir)), 0.0);
  float glassCh = max(dot(geometryNormal, normalize(baseCard + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += baseKeyC * (0.05 * pow(glassNh, 22.0) + 0.3 * pow(glassNh, 240.0)) * smoothstep(0.0, 0.15, dot(geometryNormal, baseKey)) * (1.0 - 0.6 * baseFrost);
  float glassRoom = max(dot(geometryNormal, normalize(normalize(vec3(-0.35, 0.55, 0.75)) + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += (uRigCardCol + vec3(1.0, 0.93, 0.82) * dot(baseSunC, vec3(0.3333)) * 1.6) * (0.02 * pow(glassRoom, 7.0)) * (0.3 + 1.4 * glassOne);
  // Light that went in at the far side comes out through the thin edge, in the colour of the glass.
  reflectedLight.indirectDiffuse += mix(glassTint, vec3(dot(glassTint, vec3(0.3333))) + 0.12, 0.3) * RECIPROCAL_PI * (baseSunC * 1.1 + uRigCardCol * 0.3) * pow(1.0 - baseThin, 1.3) * (0.25 + 0.75 * clamp(0.5 - 0.5 * dot(geometryNormal, baseKey), 0.0, 1.0)) * (0.5 + glassOne) * baseFootAo;
  reflectedLight.indirectDiffuse += glassDeep * RECIPROCAL_PI * uRigCardCol * 0.6 * glassBody * clamp(inverseTransformDirection(geometryNormal, viewMatrix).y * 0.6 + 0.4, 0.0, 1.0);
  reflectedLight.directSpecular += uRigCardCol * (0.02 * pow(glassCh, 12.0) + 0.1 * pow(glassCh, 110.0) * (1.0 - 0.8 * baseFrost)) * smoothstep(0.0, 0.2, dot(geometryNormal, baseCard));
}
`

// Loose sand. The mesh carries how thick it lies (red of the vertex colour); the tile carries single grains, each with its
// own number, and a grain is drawn only where the sand is thicker than its number: so a thin layer is single grains and the
// edge of a heap breaks up into them.
export const SAND = { tileMm: 6.6, cover: 0.62, glint: 5.0, slope: 0.6, wrap: 40.0, thru: 5.0, ledge: 0.3, stage: 0.2, drape: 0.55, crest: 3.0, far: [0.05, 0.14], speck: 2.4 }
const SHADE = { r: 56, soft: 3.5, top: 40, globeH: 79, globeR: 60, globe: 0.5, front: 0.1, frontMm: [-6, 44], frontX: [58, 98] }
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
  lit *= mix(1.0, ${SHADE.front.toFixed(2)}, smoothstep(${SHADE.frontMm[0].toFixed(1)}, ${SHADE.frontMm[1].toFixed(1)}, p.z) * smoothstep(${SHADE.frontX[1].toFixed(1)}, ${SHADE.frontX[0].toFixed(1)}, p.x) * step(p.y, 20.0) * step(${(SHADE.r * SHADE.r).toFixed(1)}, r2));
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
// From far off a pixel is wider than a grain and the tile's numbers average out, which would end a thin layer in one hard
// line. There the sand is cut by a number of its own for each bit of ground about as wide as a pixel is across: specks, ever fewer.
float sandPx = min(length(dFdx(vBasePos)), length(dFdy(vBasePos)));
float sandFar = smoothstep(${SAND.far[0].toFixed(2)}, ${SAND.far[1].toFixed(2)}, sandPx);
float sandCell = exp2(ceil(log2(max(sandPx, 0.03) * ${SAND.speck.toFixed(2)})));
float sandDice = baseHash(floor(vBasePos / sandCell) + 7.0);
sandNeed = mix(sandNeed, sandDice * ${SAND.cover.toFixed(2)}, sandFar);
if (sandCover < sandNeed + 0.004) discard;
float sandId = fract(sandGrain * 37.31);
float sandId2 = fract(sandGrain * 91.7);
vec3 sandC = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, smoothstep(0.1, 0.75, sandId));
sandC = mix(sandC, ${vec(SAND_COLOUR.dark)}, step(0.95, sandId2));
sandC = mix(sandC, ${vec(SAND_COLOUR.white)}, step(sandId2, 0.1));
float sandDeep = smoothstep(0.1, 0.9, sandThick);
float sandPit = sandGrain > 0.02 ? 1.0 : 0.8;
float sandBlotch = baseNoise(sandAt * 0.35) * 0.6 + baseNoise(sandAt * 1.3) * 0.4;
float sandDim = mix(1.0, mix(0.4, 1.0, smoothstep(0.1, 0.6, sandCover)), sandFar);
diffuseColor.rgb = diffuse * sandC * sandPit * mix(0.9, 1.08, sandBlotch) * sandDim * (0.8 + 0.4 * sandId);
${SEAT}
float baseAo = mix(0.6, 1.0, sandDeep) * (0.55 + 0.45 * vBasePaint.y) * baseSeatAo;
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
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.4) * mix(0.12, 1.0, sandLit) * ${SAND.stage.toFixed(2)};
  float sandWrap = clamp((dot(normalize(mix(nonPerturbedNormal, normal, 0.5)), baseKey) + 0.04) / 1.04, 0.0, 1.0);
  sandWrap = max(sandWrap, 0.07 * smoothstep(24.0, 38.0, sandAt.y));
  float sandHigh = 1.0 + ${SAND.ledge.toFixed(2)} * smoothstep(24.0, 38.0, sandAt.y) + ${SAND.crest.toFixed(2)} * (0.45 + 0.75 * sandId) * mix(0.6, 1.1, sandBlotch) * smoothstep(1.0, 6.5, sandAt.y) * (1.0 - smoothstep(14.0, 20.0, sandAt.y)) * mix(1.0, 0.3, smoothstep(22.0, 30.0, sandAt.y));
  float sandThru = pow(clamp(dot(-geometryViewDir, baseKey) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  reflectedLight.indirectDiffuse += mix(baseKeyC, baseSunC, smoothstep(24.0, 38.0, sandAt.y)) * material.diffuseContribution * RECIPROCAL_PI * (${SAND.wrap.toFixed(2)} * sandWrap * sandWrap * sandWrap + ${SAND.thru.toFixed(2)} * sandThru * sandWrap * sandWrap) * sandLit * sandHigh;
  float sandWarm = clamp(dot(nonPerturbedNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  // The sun's own side light, low from the right: what makes the dune and the ledge's sand bright on the side the camera sees.
  reflectedLight.indirectDiffuse += (uRigCardCol * 0.1 + baseSunC * 9.5 * sandWarm * sandWarm * sandWarm * mix(1.0, 0.35, smoothstep(24.0, 30.0, sandAt.y))) * material.diffuseContribution * RECIPROCAL_PI * sandWarm * sandWarm * mix(0.5, 1.0, sandLit);
  reflectedLight.indirectDiffuse *= mix(0.3, 1.0, sandLit);
  // Under the foot's overhang the slab's sand is in the stone's own shade.
  reflectedLight.indirectDiffuse *= mix(1.0, smoothstep(0.1, 0.8, vBasePaint.y), step(sandAt.y, 12.0) * (1.0 - step(0.5, vBasePaint.z)));
  vec3 sandFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.3 * (vec3(fract(sandGrain * 53.1), fract(sandGrain * 113.7), fract(sandGrain * 211.3)) - 0.5)));
  float sandShine = step(0.72, fract(sandGrain * 17.9)) * step(0.02, sandGrain) * (0.25 + 0.75 * sandDeep);
  reflectedLight.directSpecular += baseKeyC * (pow(max(dot(sandFacet, normalize(baseKey + geometryViewDir)), 0.0), 90.0) * sandShine * ${SAND.glint.toFixed(1)} * sandDim * sandDim * smoothstep(0.0, 0.2, dot(nonPerturbedNormal, baseKey))) * sandLit;
  reflectedLight.directSpecular += uRigCardCol * (pow(max(dot(sandFacet, normalize(baseCard + geometryViewDir)), 0.0), 70.0) * sandShine * sandDim * sandDim * ${(SAND.glint * 0.5).toFixed(1)});
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
