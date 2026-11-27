import * as THREE from 'three'
import { config } from '../../config'
import { stageMaterial, type Rgb } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { texture } from '../../core/textures'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import type { KitMoment } from '../kit'
import { stormHeld } from './veil'

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
float baseSeatAo = mix(0.3, 1.0, smoothstep(0.0, 0.8, baseSeatD)) * mix(0.82, 1.0, smoothstep(0.4, 3.2, baseSeatD));
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
  vec3 baseKeyAll = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  baseKey = stageKeyL;
  baseKeyC = stageKeyC * stageKeyS;
  baseSunC = stageKeyC * (0.4 + 0.6 * stageKeyS);
  baseKeyAll = stageKeyC;
  #elif NUM_DIR_LIGHTS > 0
  baseKey = directionalLights[0].direction;
  baseKeyC = directionalLights[0].color;
  baseSunC = baseKeyC;
  baseKeyAll = baseKeyC;
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
  cut?: string
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
    // What is cut is cut last: a pixel that is cut stops being worked out, and the lighting after it reads its neighbours' numbers.
    if (at.cut) shader.fragmentShader = shader.fragmentShader.replace(/\}\s*$/, `${at.cut}\n}`)
  }
}

// The stone. Its colour comes bed by bed from the tone map, its relief from the carve map, its grain from the tile; loose
// sand lies on whatever faces up.
// The globe stands between the lights behind and the front of the base: the stone and all that is set in it are lit on the
// left, darkest just left of the middle, and come up again to the sunlit edge on the right.
const FRONT_SHADE = { deep: 0.4, left: 0.5, at: -5, edge: 0.45, from: 12 }
function shadeIn(deep: number, left: number, from: number, edge: number, tint: boolean | string): string {
  return `
  float baseShadeIn = vBasePos.x < ${FRONT_SHADE.at.toFixed(1)} ? mix(${deep.toFixed(3)}, ${left.toFixed(3)}, smoothstep(${FRONT_SHADE.at.toFixed(1)}, -32.0, vBasePos.x)) : mix(${deep.toFixed(3)}, ${edge.toFixed(3)}, smoothstep(${from.toFixed(1)}, 49.0, vBasePos.x));
  vec3 baseShadeTint = ${typeof tint === 'string' ? tint : tint ? 'mix(mix(vec3(1.0, 0.8, 0.58), vec3(0.95, 0.98, 1.06), smoothstep(-32.0, 8.0, vBasePos.x)), vec3(1.0, 0.9, 0.76), smoothstep(36.0, 49.0, vBasePos.x))' : 'vec3(1.0)'};
  reflectedLight.indirectDiffuse *= baseShadeIn * baseShadeTint;
  reflectedLight.directDiffuse *= baseShadeIn * baseShadeTint;
  reflectedLight.indirectSpecular *= baseShadeIn;
  reflectedLight.directSpecular *= baseShadeIn;
`
}

const GRIT = [1.2, 0.8, 1.4, 2.6]
const STONE = { grain: 0.8, carve: 0.6, dust: 0.75, glint: 3.0, wrap: 0.3, card: 0.02, sun: 0.9, kick: 0.06, flare: 1.05, side: 0.06, bounce: 0.02, sheen: 0.05, top: 0.3, belly: 1.0, table: 0.14, patch: 0.7, direct: 0.12, room: 0.3, rake: 1.0, lit: 3.0, sky: 0.5, heap: 0.55, cool: 0.14, spark: 3.0, even: 0.05, storm: 1.0, grainLit: 0.4, grainShade: 0.3, grainCatch: 1.0, pit: 0.6, crumb: 0.3, deep: 0.2, rim: 2.6, faceDown: 1.0, lip: 0.78, rollShade: 0.4, glow: 0.04, fillSun: 0.145, fillMid: 0.06, fillRight: 0.1, foldSlot: 0.0, foldFoot: 1.0, foldWedge: 0.45, slot: 0.16, grainFar: 0.62 }
// From the hero's distance a pixel is wider than a grain, so the grains run together into a fine tooth; close by each one stands out.
const FAR = 'smoothstep(0.045, 0.075, min(length(dFdx(vBasePos)), length(dFdy(vBasePos))))'

// Read on the approved's hero view, on the sand between the things set in it: the share of the light worked out below that each part of the
// front keeps, by azimuth (columns, 80 degrees left of the camera to 80 right) and by height (rows, 2 mm to 38 mm).
// It is kept smooth, no two neighbours more than 2 fold apart, so that from any view it reads as where the low sun falls and never as
// patches. The row at 20 mm, where the shells leave too little sand to read, lies between the rows above and below it.
const LIGHT = { cols: 17, rows: 7, az: [-80, 80], h: [2, 38] }
// prettier-ignore
const LIGHT_SHARE: readonly (readonly string[])[] = [
  ['0.42, 0.45, 0.49', '0.38, 0.41, 0.47', '0.42, 0.46, 0.47', '0.71, 0.78, 0.76', '1.23, 1.36, 1.32', '1.60, 1.79, 1.72', '1.33, 1.48, 1.44', '1.05, 1.13, 1.08', '0.96, 1.04, 1.04', '0.89, 0.95, 0.94', '0.92, 0.96, 0.93', '0.88, 0.88, 0.82', '0.66, 0.63, 0.58', '0.49, 0.45, 0.42', '0.52, 0.45, 0.43', '0.54, 0.46, 0.46', '0.54, 0.45, 0.46'],
  ['0.55, 0.55, 0.54', '0.56, 0.54, 0.52', '0.54, 0.51, 0.43', '0.90, 0.84, 0.68', '1.47, 1.37, 1.10', '2.12, 2.03, 1.70', '1.75, 1.70, 1.52', '1.59, 1.65, 1.65', '1.49, 1.62, 1.75', '1.31, 1.44, 1.56', '1.16, 1.27, 1.35', '0.98, 1.02, 1.04', '0.75, 0.74, 0.74', '0.65, 0.60, 0.61', '0.64, 0.55, 0.56', '0.64, 0.53, 0.55', '0.63, 0.52, 0.54'],
  ['0.73, 0.70, 0.64', '0.61, 0.58, 0.51', '0.59, 0.55, 0.43', '0.81, 0.74, 0.59', '1.19, 1.10, 0.86', '1.48, 1.40, 1.17', '1.34, 1.34, 1.24', '1.46, 1.53, 1.63', '1.58, 1.78, 2.05', '1.45, 1.68, 1.96', '1.32, 1.51, 1.74', '1.13, 1.22, 1.35', '0.89, 0.91, 0.97', '0.80, 0.76, 0.82', '0.80, 0.72, 0.78', '0.81, 0.69, 0.76', '0.79, 0.67, 0.74'],
  ['0.93, 0.98, 0.96', '0.79, 0.81, 0.76', '0.70, 0.71, 0.60', '0.81, 0.80, 0.68', '0.95, 0.93, 0.80', '0.93, 0.93, 0.84', '0.83, 0.86, 0.85', '1.09, 1.20, 1.30', '1.50, 1.72, 2.00', '1.51, 1.77, 2.06', '1.38, 1.59, 1.83', '1.14, 1.25, 1.36', '0.97, 1.00, 1.07', '0.89, 0.87, 0.94', '0.88, 0.81, 0.88', '0.87, 0.77, 0.86', '0.85, 0.76, 0.85'],
  ['1.19, 1.37, 1.43', '1.14, 1.32, 1.36', '1.07, 1.20, 1.17', '1.02, 1.13, 1.10', '0.94, 1.03, 1.01', '0.74, 0.80, 0.82', '0.65, 0.73, 0.81', '0.92, 1.05, 1.22', '1.42, 1.67, 1.96', '1.58, 1.86, 2.17', '1.44, 1.69, 1.92', '1.15, 1.28, 1.38', '1.05, 1.11, 1.19', '0.99, 1.00, 1.07', '0.96, 0.92, 1.01', '0.94, 0.87, 0.98', '0.92, 0.85, 0.97'],
  ['1.44, 1.78, 2.07', '1.38, 1.72, 1.99', '1.25, 1.45, 1.51', '1.07, 1.22, 1.26', '0.92, 1.01, 1.05', '0.85, 0.90, 0.95', '0.68, 0.76, 0.90', '0.83, 0.92, 1.12', '1.14, 1.32, 1.59', '1.21, 1.41, 1.68', '1.17, 1.36, 1.57', '1.01, 1.13, 1.23', '0.92, 0.97, 1.02', '0.81, 0.81, 0.86', '0.85, 0.82, 0.90', '0.89, 0.84, 0.97', '0.88, 0.83, 0.97'],
  ['1.62, 2.01, 2.33', '1.52, 1.89, 2.19', '1.30, 1.59, 1.83', '1.06, 1.26, 1.44', '0.89, 1.02, 1.17', '0.82, 0.91, 1.06', '0.84, 0.92, 1.10', '0.91, 1.02, 1.23', '0.98, 1.12, 1.36', '0.97, 1.13, 1.34', '0.93, 1.08, 1.25', '0.88, 0.98, 1.06', '0.83, 0.87, 0.92', '0.77, 0.77, 0.82', '0.85, 0.82, 0.90', '0.92, 0.86, 1.00', '0.92, 0.87, 1.01'],
]
const STONE_PARS = `
uniform sampler2D uBaseGrain;
uniform sampler2D uBaseCarve;
uniform sampler2D uBaseTone;
uniform float uBaseStorm;
const vec3 stoneShare[${LIGHT.cols * LIGHT.rows}] = vec3[${LIGHT.cols * LIGHT.rows}](${LIGHT_SHARE.flat().map((v) => `vec3(${v})`).join(', ')});
vec3 stoneShareAt(float az, float h) {
  float u = clamp((az - ${LIGHT.az[0].toFixed(1)}) / ${((LIGHT.az[1] - LIGHT.az[0]) / (LIGHT.cols - 1)).toFixed(4)}, 0.0, ${(LIGHT.cols - 1.001).toFixed(3)});
  float v = clamp((h - ${LIGHT.h[0].toFixed(1)}) / ${((LIGHT.h[1] - LIGHT.h[0]) / (LIGHT.rows - 1)).toFixed(4)}, 0.0, ${(LIGHT.rows - 1.001).toFixed(3)});
  int i = int(u);
  int j = int(v);
  float fu = u - float(i);
  float fv = v - float(j);
  fu = fu * fu * (3.0 - 2.0 * fu);
  fv = fv * fv * (3.0 - 2.0 * fv);
  int o = j * ${LIGHT.cols} + i;
  return mix(mix(stoneShare[o], stoneShare[o + 1], fu), mix(stoneShare[o + ${LIGHT.cols}], stoneShare[o + ${LIGHT.cols + 1}], fu), fv);
}
`

// While the storm fills the ball less of the low sun comes through it, so the base loses warm light: least on the sunlit left, most in the
// ball's shade, red most and blue least (the approved's shake picture).
const STORM = `
  vec3 baseStorm = 1.0 - ${STONE.storm.toFixed(2)} * uBaseStorm * mix(0.09, 0.21, smoothstep(-24.0, 0.0, vBasePos.x)) * vec3(0.81, 0.585, 0.41);
  reflectedLight.indirectDiffuse *= baseStorm;
  reflectedLight.directDiffuse *= baseStorm;
  reflectedLight.indirectSpecular *= baseStorm;
  reflectedLight.directSpecular *= baseStorm;
`

const STONE_PAINT = `
vec4 baseDetail = texture2D(uBaseGrain, vMapUv);
vec4 baseFine = texture2D(uBaseGrain, vMapUv * 3.7 + 0.37);
vec4 baseCarve = texture2D(uBaseCarve, vBaseUv1);
float baseFace = 2.0 * baseCarve.b - 1.0;
float baseCavity = smoothstep(0.45, 0.9, -baseFace);
float baseHigh = smoothstep(0.7, 0.95, baseFace);
float baseRidged = smoothstep(38.0, 35.0, vBasePos.y);
float baseCrease = smoothstep(0.0, 0.45, baseCavity) * baseRidged;
float baseCrest = smoothstep(0.5, 0.9, baseHigh) * baseRidged;
float baseShelfUp = smoothstep(0.05, 0.4, baseFace) * baseRidged;
float baseShelfDown = smoothstep(0.05, 0.4, -baseFace) * baseRidged;
${SEAT}
float baseAo = max(mix(1.0, vBasePaint.x, 0.3) * (1.0 - mix(0.11, 0.3, smoothstep(4.0, -30.0, vBasePos.x)) * baseCavity) * (1.0 - 0.05 * baseCrease), 0.55) * (1.0 + mix(0.25, 0.35, smoothstep(4.0, -30.0, vBasePos.x)) * baseCrest) * (1.0 + 0.3 * baseShelfUp) * (1.0 - 0.3 * baseShelfDown) * baseSeatAo * baseFootAo;
diffuseColor.rgb = diffuse * texture2D(uBaseTone, vBaseUv1).rgb * vec3(1.0, 0.98, 0.93);
float basePale = smoothstep(-4.0, 36.0, vBasePos.x);
diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))) * vec3(1.0, 0.99, 0.96), diffuseColor.rgb, mix(0.78, 0.46, basePale)) * mix(1.0, 1.1, basePale);
diffuseColor.rgb *= mix(vec3(1.07, 1.02, 0.96), vec3(1.0), smoothstep(-6.0, 30.0, vBasePos.x));
// Read on the approved: the grain shows least on the sunlit left, more in the ball's shade right of the middle, most at the sunlit right end.
float baseGrit = mix(mix(${GRIT[0].toFixed(2)}, ${GRIT[1].toFixed(2)}, smoothstep(-30.0, -8.0, vBasePos.x)), mix(${GRIT[2].toFixed(2)}, ${GRIT[3].toFixed(2)}, smoothstep(40.0, 52.0, vBasePos.x)), smoothstep(8.0, 30.0, vBasePos.x));
float baseBlotch = baseNoise(vBasePos * 0.23) * 0.6 + baseNoise(vBasePos * 0.9) * 0.4;
diffuseColor.rgb *= mix(1.0, mix(0.86, 1.1, baseBlotch), min(baseGrit, 1.0)) * (0.96 + 0.08 * baseDetail.b) * (0.97 + 0.06 * baseFine.b);
diffuseColor.rgb *= max(1.0 + baseGrit * (0.2 * (baseHash(floor(vBasePos * 2.7 + 1.3)) - 0.5) + 0.16 * (baseHash(floor(vBasePos * 7.0)) - 0.5) + 0.12 * (baseNoise(vBasePos * 9.0) - 0.5) + 0.12 * (baseHash(floor(vBasePos * 13.0 + 5.0)) - 0.5)), 0.4);
float baseGrainOne = baseHash(floor(vBasePos * 3.3) + 71.0);
diffuseColor.rgb *= (1.0 - 0.1 * min(baseGrit, 2.0) * step(0.95, baseGrainOne)) * (1.0 + 0.2 * baseGrit * step(baseGrainOne, 0.07));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * mix(vec3(0.92, 0.76, 0.6), vec3(0.86, 0.84, 0.84), smoothstep(-8.0, 20.0, vBasePos.x)), mix(0.15, 0.3, smoothstep(4.0, -30.0, vBasePos.x)) * baseCavity);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * mix(vec3(1.0, 0.74, 0.5), vec3(0.88, 0.86, 0.86), smoothstep(-8.0, 20.0, vBasePos.x)), 0.1 * baseCrease);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.84, 0.68), 0.12 * baseHigh + 0.1 * baseCrest);
float baseCollar = smoothstep(34.5, 37.5, vBasePos.y);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))) * vec3(1.05, 0.99, 0.9), 0.4 * baseCollar) * (1.0 + 0.12 * baseCollar);
`

const STONE_ROUGH = `
roughnessFactor = clamp(0.86 + 0.12 * (baseDetail.b - 0.5) + 0.08 * baseCavity - 0.1 * baseHigh, 0.5, 1.0);
metalnessFactor = 0.0;
`

const STONE_TILT = `
vec2 baseTilt = (baseSlope(baseDetail.rg) * ${STONE.grain.toFixed(2)} + baseSlope(baseFine.rg) * ${(STONE.grain * 0.5).toFixed(2)}) * mix(1.0, ${STONE.grainFar.toFixed(2)}, ${FAR}) + baseSlope(baseCarve.rg) * ${STONE.carve.toFixed(2)};
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
  reflectedLight.indirectDiffuse *= baseAo * ${STONE.room.toFixed(2)} * vec3(1.0, 1.0, 1.05);
  reflectedLight.indirectSpecular *= baseAo * 0.3;
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.55) * ${STONE.direct.toFixed(2)};
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
  float stoneOpen = mix(0.3, 1.9, smoothstep(-0.35, 0.6, stoneUp)) * mix(0.3, 1.05, smoothstep(2.0, 34.0, vBasePos.y));
  float stoneDapple = 1.0;
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * ((uRigCardCol * ${STONE.card.toFixed(2)} * stoneWarm * stoneWarm + baseSunC * ${STONE.side.toFixed(2)} * pow(abs(stoneWarm), 36.0) + stoneBounce * ${STONE.bounce.toFixed(2)}) * stoneOpen * stoneBelly + baseSunC * stoneDapple * (${STONE.sun.toFixed(2)} * stoneSun * stoneSun * smoothstep(18.0, -14.0, vBasePos.z) + vec3(1.0, 0.8, 0.56) * ${STONE.kick.toFixed(2)} * stoneLeft * stoneLeft * stoneLeft * smoothstep(8.0, 30.0, vBasePos.y) + ${STONE.top.toFixed(2)} * smoothstep(33.0, 39.0, vBasePos.y) * smoothstep(0.25, 0.8, stoneUp)));
  // The sun's glint on the wet table in front of the base on the left throws its warmth back up the left flank, strongest low down.
  vec3 stoneFlare = normalize(mat3(viewMatrix) * vec3(-0.72, -0.1, 0.68));
  float stoneFl = clamp((dot(geometryNormal, stoneFlare) + 0.1) / 1.1, 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * vec3(1.0, 0.78, 0.54) * dot(baseSunC, vec3(0.3333)) * (${STONE.flare.toFixed(2)} * stoneFl * stoneFl * mix(0.3, 1.0, smoothstep(34.0, 5.0, vBasePos.y)) * smoothstep(8.0, -36.0, vBasePos.x));
  // The room's cool light comes back off the wet table onto the belly, most on the side the sun's glint does not reach.
  float stoneSky = clamp(dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(0.45, 0.75, 0.5))), 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * dot(baseSunC, vec3(0.3333)) * smoothstep(-34.0, 8.0, vBasePos.x) * mix(vec3(1.0), vec3(1.08, 0.99, 0.86), smoothstep(34.0, 50.0, vBasePos.x)) * (mix(vec3(0.9, 0.95, 1.04), vec3(0.75, 0.95, 1.3), smoothstep(8.0, 26.0, vBasePos.x)) * ${STONE.table.toFixed(2)} * mix(0.8, 1.0, smoothstep(36.0, 3.0, vBasePos.y)) * (1.0 - 0.8 * clamp(stoneUp, -0.5, 0.5)) + vec3(0.84, 0.94, 1.1) * ${STONE.sky.toFixed(2)} * stoneSky * stoneSky * smoothstep(-0.15, 0.35, stoneUp));
  // The sun behind goes through the globe and comes out gathered: a warm patch on the upper band left of the middle, cut off on its right by a slanting edge.
  float stoneAz = dot(vBasePos.xz, vBasePos.xz) > 0.0 ? atan(vBasePos.x, vBasePos.z) : 0.0;
  float stoneEdge = stoneAz + 0.016 * (vBasePos.y - 30.0) + 0.1 * (baseNoise(vBasePos * 0.3 + 19.0) - 0.5);
  float stonePatch = smoothstep(0.1, -0.42, stoneEdge) * smoothstep(-1.5, -0.6, stoneAz) * smoothstep(19.0, 27.0, vBasePos.y + 5.0 * (baseNoise(vBasePos * 0.21 + 31.0) - 0.5));
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * baseSunC * vec3(1.0, 0.8, 0.58) * (${STONE.patch.toFixed(2)} * stonePatch * (0.6 + 0.8 * baseHigh) * (1.0 - 0.6 * baseCavity) * mix(0.4, 3.0, smoothstep(0.25, 0.7, mix(clamp(inverseTransformDirection(normalize(normalMatrix * normalize(vBaseNormal)), viewMatrix).y, -1.0, 1.0), stoneUp, 0.25))));
  // The two lights behind rake the stone: only what is turned up and back to them takes it, so it lies along the ridges.
  #ifdef STAGE_LIGHT_DONE
  float stoneRakeL = clamp(dot(normalize(normalMatrix * normalize(vBaseNormal)), stageRimL), 0.0, 1.0);
  float stoneRakeR = clamp(dot(normalize(mix(normalize(normalMatrix * normalize(vBaseNormal)), geometryNormal, 0.4)), stageKeyL), 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * mix(1.0, baseAo, 0.5) * ${STONE.rake.toFixed(2)} * (1.0 + 0.5 * baseCrest) * (stageKeyC * vec3(0.68, 0.56, 0.44) * stoneRakeL * stoneRakeL * smoothstep(34.0, -30.0, vBasePos.x) + baseSunC * (1.6 * stoneRakeR * stoneRakeR * smoothstep(-10.0, 44.0, vBasePos.x) + vec3(2.7, 2.35, 1.9) * stoneRakeR * smoothstep(32.0, 50.0, vBasePos.x)));
  #endif
  float stoneSheen = pow(max(dot(normal, normalize(baseCard + geometryViewDir)), 0.0), 14.0) + pow(max(dot(normal, normalize(normalize((viewMatrix * vec4(-0.3, 0.8, 0.5, 0.0)).xyz) + geometryViewDir)), 0.0), 22.0);
  reflectedLight.directSpecular += vec3(1.0, 0.9, 0.76) * dot(baseSunC, vec3(0.3333)) * stoneSheen * ${STONE.sheen.toFixed(2)} * baseAo * (1.0 - baseDust);
  vec3 stoneCell = floor(vBasePos * 5.5);
  vec3 stoneFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.3 * (vec3(baseHash(stoneCell + 3.7), baseHash(stoneCell + 11.3), baseHash(stoneCell + 23.9)) - 0.5)));
  float stoneOne = baseHash(stoneCell + 41.0);
  float stoneGrit = smoothstep(mix(0.2, 0.45, stoneOne), 0.08, length(fract(vBasePos * 5.5) - 0.5)) * step(0.65, baseHash(stoneCell)) * (0.3 + 2.0 * stoneOne * stoneOne);
  // The sand sparkles only where the sun grazes it: on the left flank and at the right end, never in the ball's shade.
  float stoneSunSide = max(smoothstep(-10.0, -28.0, vBasePos.x), smoothstep(38.0, 48.0, vBasePos.x));
  float stoneLit = smoothstep(0.0, 0.2, dot(geometryNormal, baseKey)) * stoneSunSide;
  reflectedLight.directSpecular += baseKeyC * (pow(max(dot(stoneFacet, normalize(baseKey + geometryViewDir)), 0.0), 160.0) * stoneGrit * stoneLit * ${STONE.glint.toFixed(2)} * mix(1.0, 0.75, ${FAR}) * (0.5 + baseDust) * baseAo);
  reflectedLight.directSpecular += uRigCardCol * (pow(max(dot(stoneFacet, normalize(baseCard + geometryViewDir)), 0.0), 120.0) * stoneGrit * ${(STONE.glint * 0.6).toFixed(2)} * (0.5 + baseDust) * baseAo * stoneSunSide * smoothstep(0.0, 0.25, dot(geometryNormal, baseCard)));
  // Past the ball on either side the sun lies on the top of the stone in soft patches, broken by the ridges, each with its small shadow.
  float stoneLitL = 0.3 * smoothstep(-4.0, -20.0, vBasePos.x);
  float stoneLitR = 0.4 * smoothstep(28.0, 42.0, vBasePos.x);
  float stoneCatch = smoothstep(0.05, 0.5, stoneUp) * (1.0 - 0.8 * baseCavity) * (0.75 + 0.5 * baseHigh);
  // The ball stands between the lights behind and the roll that holds it: from left of the middle to the right shoulder the roll is in the ball's shade.
  float stoneBall = smoothstep(-34.0, -8.0, vBasePos.x) * smoothstep(47.0, 33.0, vBasePos.x);
  vec3 stoneSunlit = baseSunC * mix(vec3(1.0, 0.8, 0.64), vec3(1.0, 0.94, 0.85), smoothstep(-20.0, 10.0, vBasePos.x)) * (${STONE.lit.toFixed(2)} * smoothstep(39.5, 41.5, vBasePos.y + 1.6 * (baseNoise(vBasePos * 0.45 + 51.0) - 0.5)) * (stoneLitL + stoneLitR + 0.1 * (1.0 - stoneBall)) * stoneCatch * smoothstep(0.3, 0.7, stoneUp) * mix(0.72, 1.0, smoothstep(0.34, 0.6, baseNoise(vBasePos * 0.33 + 91.0))));
  ${shadeIn(FRONT_SHADE.deep, FRONT_SHADE.left, FRONT_SHADE.from, FRONT_SHADE.edge, 'mix(mix(mix(vec3(1.0, 0.86, 0.68), vec3(1.0, 0.95, 0.86), smoothstep(-28.0, -6.0, vBasePos.x)), mix(vec3(0.8, 0.95, 1.06), vec3(1.0, 0.96, 0.88), 0.75 * baseNoise(vBasePos * 0.16 + 61.0)), smoothstep(-2.0, 22.0, vBasePos.x)), vec3(1.06, 0.98, 0.87), smoothstep(34.0, 50.0, vBasePos.x))')}
  // Right of the middle the room's light off the table reaches into the ball's shade: there the shade is lightest and coolest.
  float stoneRoom = smoothstep(4.0, 20.0, vBasePos.x) * smoothstep(46.0, 34.0, vBasePos.x);
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.15, 1.25, 1.3), stoneRoom * smoothstep(38.0, 30.0, vBasePos.y)) * mix(vec3(1.0), vec3(0.94, 0.98, 1.06), stoneRoom * smoothstep(30.0, 38.0, vBasePos.y));
  float stoneTopUp = smoothstep(0.45, 0.85, normalize(vBaseNormal).y) * smoothstep(36.0, 39.5, vBasePos.y);
  float stoneUnderGlass = 1.0 - stoneBall * mix(0.05 * smoothstep(34.0, 38.0, vBasePos.y), 0.12, stoneTopUp);
  reflectedLight.indirectDiffuse *= stoneUnderGlass * mix(vec3(1.0), mix(vec3(0.96, 0.99, 1.03), mix(vec3(1.14, 0.92, 0.7), vec3(1.0, 0.99, 0.96), smoothstep(-6.0, 22.0, vBasePos.x)), stoneTopUp), stoneBall * smoothstep(34.0, 38.0, vBasePos.y));
  reflectedLight.directDiffuse *= stoneUnderGlass;
  // The left flank stands in deep warm shade, so the sunlit strip on the lip and the lit tops stand out of it.
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(0.6, 0.52, 0.44), smoothstep(-10.0, -28.0, vBasePos.x));
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * stoneSunlit;
  // The heap and the lit strip of table lie beside the right flank and throw their warmth back onto it, most from below.
  float stoneHeap = clamp((dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(0.7, -0.35, 0.62))) + 0.25) / 1.25, 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * mix(baseSunC, vec3(dot(baseSunC, vec3(0.3333))), 0.35) * vec3(1.0, 0.94, 0.86) * (${STONE.heap.toFixed(2)} * stoneHeap * smoothstep(40.0, 54.0, vBasePos.x) * mix(1.0, 0.75, smoothstep(8.0, 36.0, vBasePos.y)));
  // Right of the middle the front stands in the room's cool light: soft, from the front right, rising toward the shoulder.
  float stoneCool = clamp((dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(0.6, 0.3, 0.74))) + 0.35) / 1.35, 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * dot(baseSunC, vec3(0.3333)) * vec3(0.86, 0.92, 1.0) * (${STONE.cool.toFixed(2)} * stoneCool * stoneCool * smoothstep(-4.0, 24.0, vBasePos.x) * smoothstep(46.0, 32.0, vBasePos.x) * mix(0.45, 1.0, smoothstep(8.0, 34.0, vBasePos.y)) * stoneUnderGlass);
  // Wet sand: here and there a grain on the crest of a swell flashes.
  vec3 stoneSpk = floor(vBasePos * 2.2);
  float stoneSpkOn = step(0.9, baseHash(stoneSpk + 5.0)) * smoothstep(0.34, 0.1, length(fract(vBasePos * 2.2) - 0.5));
  vec3 stoneSpkN = normalize(normalMatrix * normalize(baseObjectNormal + 0.9 * (vec3(baseHash(stoneSpk + 1.7), baseHash(stoneSpk + 9.3), baseHash(stoneSpk + 27.1)) - 0.5)));
  float stoneSpkH = dot(stoneSpkN, normalize(normalize(mat3(viewMatrix) * vec3(0.3, 0.75, 0.6)) + geometryViewDir));
  reflectedLight.directSpecular += vec3(1.0, 0.95, 0.86) * dot(baseSunC, vec3(0.3333)) * (${STONE.spark.toFixed(2)} * mix(1.0, 0.55, ${FAR}) * pow(max(stoneSpkH, 0.0), 40.0) * stoneSpkOn * (0.45 + 0.55 * baseCrest) * baseAo * mix(0.15, 1.0, stoneSunSide));
  // Moulded, not cut: the light comes from above and behind, so the underside of every swell lies in a broad soft shade, warm on the left and cool on the right.
  float stoneUnder = smoothstep(0.3, -0.35, stoneUp);
  float stoneOver = smoothstep(0.15, 0.7, stoneUp);
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), mix(mix(vec3(0.9, 0.76, 0.62), vec3(0.92, 0.86, 0.78), smoothstep(-20.0, 16.0, vBasePos.x)), vec3(0.9, 0.85, 0.78), smoothstep(34.0, 50.0, vBasePos.x)), stoneUnder) * mix(vec3(1.0), vec3(1.3, 1.32, 1.36) * (1.0 + 0.9 * baseCrest), stoneOver * smoothstep(20.0, -24.0, vBasePos.x) * mix(1.0, smoothstep(0.42, 0.62, baseNoise(vBasePos * 0.14 + 91.0)), smoothstep(36.5, 39.0, vBasePos.y))) * (1.0 + 0.22 * stoneOver);
  // On the left the lip's top takes the low light in patches; between them it lies in its own soft shade. Low on the left flank the table's glint turns the stone orange.
  float stoneLipTop = smoothstep(37.5, 40.0, vBasePos.y) * smoothstep(0.2, 0.55, stoneUp) * smoothstep(-4.0, -22.0, vBasePos.x);
  reflectedLight.indirectDiffuse *= mix(1.0, mix(0.75, 1.2, smoothstep(0.38, 0.62, baseNoise(vBasePos * 0.14 + 91.0))), stoneLipTop) * mix(vec3(1.0), vec3(0.95, 0.74, 0.52), smoothstep(13.0, 2.0, vBasePos.y) * smoothstep(-8.0, -30.0, vBasePos.x));
  // What is turned up takes the warm light from behind over the whole front, so the top of every ledge stands lighter than its face.
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * baseSunC * mix(vec3(1.0, 0.92, 0.8), vec3(0.8, 0.9, 1.05), stoneBall) * (0.85 * smoothstep(0.3, 0.75, stoneUp) * (0.5 + 0.8 * baseHigh) * smoothstep(38.0, 34.0, vBasePos.y) * mix(1.0, 0.22, stoneBall));
  // The ball's shade lies deepest where the belly stands out furthest, round the things set in it.
  float stoneBand = 1.0 - 0.5 * smoothstep(-36.0, -14.0, vBasePos.x) * smoothstep(30.0, 14.0, vBasePos.x) * smoothstep(9.0, 15.0, vBasePos.y) * smoothstep(32.0, 24.0, vBasePos.y);
  reflectedLight.indirectDiffuse *= stoneBand;
  reflectedLight.directDiffuse *= stoneBand;
  // In the ball's shade the approved shows the relief only faintly: one even soft shade, warm in the middle, cool right of it.
  float stoneEven = smoothstep(-26.0, -8.0, vBasePos.x) * smoothstep(44.0, 30.0, vBasePos.x);
  vec3 stoneFloor = material.diffuseContribution * RECIPROCAL_PI * dot(baseSunC, vec3(0.3333)) * mix(vec3(0.88, 0.78, 0.62), mix(vec3(1.65, 1.8, 1.9), vec3(2.3, 2.3, 2.2), smoothstep(26.0, 40.0, vBasePos.x)), smoothstep(-4.0, 16.0, vBasePos.x)) * ${STONE.even.toFixed(3)};
  reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * mix(1.0, 0.35, stoneEven) + stoneFloor * max(stoneEven, smoothstep(30.0, 40.0, vBasePos.x) * smoothstep(56.0, 46.0, vBasePos.x) * smoothstep(41.0, 37.0, vBasePos.y));
  reflectedLight.directDiffuse *= mix(1.0, 0.35, stoneEven);
  // Under the ball the collar is no darker than the face under it.
  float stoneNeck = stoneEven * smoothstep(29.0, 33.0, vBasePos.y) * smoothstep(44.5, 42.0, vBasePos.y);
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.02, 1.01, 1.0), stoneNeck) * mix(1.0, 0.86, stoneEven * smoothstep(17.0, 9.0, vBasePos.y));
  // Low on the right the belly faces the lit sand on the table and takes its light back, neither warm nor cool.
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * dot(baseSunC, vec3(0.3333)) * vec3(1.0, 0.94, 0.86) * (0.075 * smoothstep(22.0, 36.0, vBasePos.x) * smoothstep(15.0, 5.0, vBasePos.y) * smoothstep(0.0, 2.5, vBasePos.y));
  // In the ball's shade the grey sheen on the grains goes down with the rest, or the shade turns grey.
  float stoneShade = smoothstep(-22.0, -8.0, vBasePos.x) * smoothstep(30.0, 14.0, vBasePos.x) * smoothstep(10.0, 17.0, vBasePos.y);
  float stoneSheenLeft = mix(1.0, mix(0.57, 0.9, smoothstep(30.0, 38.0, vBasePos.y)), stoneShade);
  reflectedLight.directSpecular *= stoneSheenLeft;
  reflectedLight.indirectSpecular *= stoneSheenLeft;
  // A few drops of water stand on the sand: each a small wet bead, darker than the sand round it, with one bright point and a lighter far edge.
  vec3 stoneDropC = floor(vBasePos * 0.42 + 3.0);
  vec3 stoneDropP = (fract(vBasePos * 0.42 + 3.0) - 0.5 - 0.3 * (vec3(baseHash(stoneDropC + 3.1), baseHash(stoneDropC + 13.7), baseHash(stoneDropC + 29.3)) - 0.5)) / 0.42;
  float stoneDropR = mix(0.4, 0.75, baseHash(stoneDropC + 51.0));
  float stoneDropD = length(stoneDropP) / stoneDropR;
  float stoneDrop = step(0.95, baseHash(stoneDropC + 77.0)) * smoothstep(1.0, 0.82, stoneDropD) * smoothstep(3.0, 6.0, vBasePos.y) * smoothstep(46.0, 40.0, vBasePos.x);
  float stoneDropFar = smoothstep(0.45, 0.95, stoneDropD) * clamp(dot(stoneDropP.xy, vec2(0.6, -0.8)) / stoneDropR, 0.0, 1.0);
  reflectedLight.indirectDiffuse *= mix(1.0, 0.72 + 0.9 * stoneDropFar, stoneDrop);
  reflectedLight.directDiffuse *= mix(1.0, 0.72 + 0.9 * stoneDropFar, stoneDrop);
  reflectedLight.directSpecular += vec3(1.0, 0.97, 0.9) * dot(baseSunC, vec3(0.3333)) * (2.2 * mix(0.45, 1.0, stoneSunSide) * stoneDrop * smoothstep(0.34, 0.12, length(stoneDropP - stoneDropR * vec3(-0.3, 0.38, 0.0)) / stoneDropR));
  // Measured on the approved: the ball's shade lies deep on the body from the middle to the right flank, deepest in the middle and a little cool on the right; low on the left the table's glint lifts the flank.
  float stoneMid = smoothstep(-22.0, -8.0, vBasePos.x) * smoothstep(24.0, 12.0, vBasePos.x);
  float stoneRight = smoothstep(12.0, 24.0, vBasePos.x) * smoothstep(52.0, 42.0, vBasePos.x);
  float stoneHighUp = smoothstep(10.0, 17.0, vBasePos.y);
  float stoneLeftSide = smoothstep(-12.0, -30.0, vBasePos.x);
  vec3 stoneTone = mix(vec3(1.0), mix(vec3(0.86), mix(vec3(0.26, 0.22, 0.16), vec3(0.5, 0.52, 0.5), smoothstep(27.0, 34.0, vBasePos.y)), stoneHighUp), stoneMid) * mix(vec3(1.0), mix(mix(vec3(1.2, 1.2, 1.26), vec3(0.88, 0.82, 0.82), smoothstep(9.0, 18.0, vBasePos.y)), vec3(0.86, 0.84, 0.84), smoothstep(25.0, 32.0, vBasePos.y)), stoneRight) * mix(vec3(1.0), mix(vec3(1.3, 1.9, 3.2), vec3(0.66, 0.7, 0.98), smoothstep(5.0, 14.0, vBasePos.y)), stoneLeftSide);
  reflectedLight.indirectDiffuse *= stoneTone;
  reflectedLight.directDiffuse *= stoneTone;
  // In the ball's shade this is white sand in the room's cool light: blue grey on every face, brown only in the hollows.
  float stoneShady = smoothstep(-24.0, -8.0, vBasePos.x) * smoothstep(50.0, 40.0, vBasePos.x);
  vec3 stoneCoolC = mix(vec3(1.0), vec3(1.0, 0.99, 0.98), smoothstep(0.55, 0.95, baseCavity));
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), stoneCoolC, stoneShady);
  reflectedLight.directDiffuse *= mix(vec3(1.0), stoneCoolC, stoneShady);
  // Moulded sand shows by its light and shade: the side of every swell that is turned up takes the light from above and behind, the side
  // turned down lies in its own soft shade, warm where the sun is and deep; in the ball's shade both are fainter.
  float stoneFaceUp = clamp(baseFace, 0.0, 1.0);
  float stoneFaceDown = clamp(-baseFace, 0.0, 1.0);
  vec3 stoneRelief = mix(vec3(1.0), mix(vec3(1.25, 1.32, 1.48), vec3(1.75, 1.5, 1.2), stoneSunSide), stoneFaceUp) * mix(vec3(1.0), mix(vec3(0.7, 0.68, 0.68), vec3(0.72, 0.68, 0.63), stoneSunSide), stoneFaceDown * ${STONE.faceDown.toFixed(2)});
  reflectedLight.indirectDiffuse *= stoneRelief;
  reflectedLight.directDiffuse *= stoneRelief;
  // Under a ledge on the sunlit side the light comes back off the lit sand below it: its shade glows orange, it is not black.
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseSunC * vec3(1.0, 0.62, 0.36) * (${STONE.glow.toFixed(2)} * baseCavity * stoneSunSide);
  // Past the ball the sun lies on the face of the roll above its ledge, from left of the middle to the middle; left of that the roll is in
  // the shade of the glass.
  float stoneRollAz = stoneAz * 57.29578;
  float stoneRollLit = smoothstep(-3.0, 0.5, vBasePos.y - 34.0 + 0.093 * (clamp(stoneRollAz, -58.0, -6.0) + 10.0)) * smoothstep(-54.0, -44.0, stoneRollAz) * smoothstep(-14.0, -33.0, stoneRollAz + 3.0 * (baseNoise(vBasePos * 0.5 + 77.0) - 0.5)) * smoothstep(0.0, 0.8, baseFace) * mix(1.0, 0.62, smoothstep(2.6, 5.2, baseSeatD)) * smoothstep(0.15, 0.9, baseSeatD);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseSunC * vec3(1.05, 0.93, 0.76) * (${STONE.lip.toFixed(2)} * stoneRollLit * mix(0.55, 1.25, baseBlotch));
  // The glass stands over the top of the roll: all round, the roll's top is in its soft shade.
  float stoneRollShade = (1.0 - ${STONE.rollShade.toFixed(2)} * smoothstep(33.0, 36.0, vBasePos.y) * smoothstep(-40.0, -50.0, stoneRollAz)) * mix(0.7, 1.0, smoothstep(2.0, 4.6, baseSeatD));
  reflectedLight.indirectDiffuse *= stoneRollShade;
  reflectedLight.directDiffuse *= stoneRollShade;
  // The front right lies deeper in the ball's shade than the rest, and round the right end the sun comes back: there the crests
  // that face it are lit warm and the hollows stay dark.
  float stoneDeep = 1.0 - ${STONE.deep.toFixed(2)} * smoothstep(8.0, 22.0, vBasePos.x) * smoothstep(31.0, 25.0, vBasePos.y);
  reflectedLight.indirectDiffuse *= stoneDeep;
  reflectedLight.directDiffuse *= stoneDeep;
  float stoneRim = smoothstep(47.5, 52.0, vBasePos.x - 3.0 * smoothstep(20.0, 6.0, vBasePos.y) + 2.0 * (baseNoise(vBasePos * 0.3 + 9.0) - 0.5));
  float stoneRimN = clamp(0.2 + 1.1 * dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(0.9, 0.3, -0.32))), 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * baseSunC * vec3(1.0, 0.84, 0.66) * (${STONE.rim.toFixed(2)} * stoneRim * stoneRimN * stoneRimN * clamp(0.35 + 2.0 * baseHigh - 1.2 * baseCavity, 0.1, 2.5));
  // There the sun rakes the sand: every face turned to it is lit and the one behind it lies in its shade, with a sharp line between them.
  float stoneRaked = mix(1.0, mix(0.45, 1.3, smoothstep(-0.15, 0.15, baseFace)), smoothstep(42.0, 49.0, vBasePos.x) * smoothstep(38.0, 35.0, vBasePos.y));
  stoneRaked *= mix(1.0, mix(0.55, 1.5, smoothstep(0.3, 0.6, baseHash(floor(vBasePos * 3.4 + 29.0)))), stoneRim);
  reflectedLight.indirectDiffuse *= stoneRaked;
  reflectedLight.directDiffuse *= stoneRaked;
  // Sandstone: every grain takes the light its own way, and some patches are coarser than others. On the two sides the sun reaches, a grain
  // turned to it stands out lit; in the ball's shade the grain is fainter. The sum of it leaves the tone where it was.
  float stoneLoose = smoothstep(39.0, 41.0, vBasePos.y);
  float stoneGrOne = baseHash(floor(vBasePos * 2.9 + 11.0));
  float stoneGrTwo = baseHash(floor(vBasePos * 5.3 + 3.0));
  float stoneGrCatch = smoothstep(0.86, 1.0, stoneGrOne) - 0.07;
  float stoneCatchSide = max(smoothstep(38.0, 48.0, vBasePos.x), 0.9 * smoothstep(-18.0, -34.0, vBasePos.x));
  float stoneFar = ${FAR};
  float stoneGrain = 1.0 + mix(1.0, 0.45, stoneFar) * mix(0.6, 1.4, baseNoise(vBasePos * 0.37 + 7.0)) * mix(${STONE.grainShade.toFixed(2)} * baseGrit, ${STONE.grainLit.toFixed(2)}, stoneLoose) * (1.0 + 0.5 * stoneRim + 1.5 * stoneLoose + 2.5 * stoneRollLit) * (0.6 * (stoneGrOne - 0.5) + 0.4 * (stoneGrTwo - 0.5)) + ${STONE.grainCatch.toFixed(2)} * mix(1.0, mix(1.0, 0.45, smoothstep(-12.0, -30.0, vBasePos.x)), stoneFar) * (stoneGrCatch * (0.6 + 1.2 * baseHigh) + 0.7 * (smoothstep(0.8, 1.0, baseHash(floor(vBasePos * 6.1 + 17.0))) - 0.1)) * stoneCatchSide;
  // Here and there a grain has fallen out and left a pit, or a crumb of a few grains stands proud and takes the light.
  vec3 stonePitCell = floor(vBasePos * 0.8 + 23.0);
  vec3 stonePitAt = (stonePitCell - 22.5 + 0.6 * (vec3(baseHash(stonePitCell + 3.0), baseHash(stonePitCell + 17.0), baseHash(stonePitCell + 41.0)) - 0.5)) / 0.8;
  float stonePitR = 0.2 + 0.22 * baseHash(stonePitCell + 5.0);
  float stonePitOn = baseHash(stonePitCell + 29.0);
  float stonePit = smoothstep(stonePitR, 0.45 * stonePitR, length(vBasePos - stonePitAt)) * mix(0.3, 1.0, smoothstep(0.35, 0.65, baseNoise(vBasePos * 0.21 + 3.0)));
  stoneGrain += mix(1.0, 0.85, stoneFar) * stonePit * (${STONE.crumb.toFixed(2)} * step(0.88, stonePitOn) - ${STONE.pit.toFixed(2)} * step(stonePitOn, 0.14));
  stoneGrain = max(stoneGrain, 0.3);
  reflectedLight.indirectDiffuse *= stoneGrain;
  reflectedLight.directDiffuse *= stoneGrain;
  // The ball sits in the stone: by the glass the stone is in the ball's shade, darkest in the groove.
  float stoneSeat = mix(0.08, 1.0, smoothstep(0.3, 1.25, baseSeatD)) * mix(0.8, 1.0, smoothstep(1.0, 4.0, baseSeatD));
  reflectedLight.indirectDiffuse *= stoneSeat;
  reflectedLight.directDiffuse *= stoneSeat;
  reflectedLight.indirectSpecular *= stoneSeat;
  reflectedLight.directSpecular *= stoneSeat;
  // The lit lip stands against the dark of the room. Where it turns away from the eye its light falls off, so the lens's red and blue taps find no lit grain beside the room's dark.
  float stoneLimb = mix(1.0, smoothstep(0.0, 0.5, clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0)), smoothstep(36.0, 39.0, vBasePos.y) * smoothstep(34.0, 46.0, abs(vBasePos.x)));
  reflectedLight.indirectDiffuse *= stoneLimb;
  reflectedLight.directDiffuse *= stoneLimb;
  reflectedLight.directSpecular *= stoneLimb;
  // Left of the middle the top of the roll is lit up to the glass and lies in lumps: their tops take the light and the gaps between them stay in shade.
  float stoneByGlass = smoothstep(38.7, 39.4, vBasePos.y) * smoothstep(-46.0, -40.0, vBasePos.x) * smoothstep(-12.0, -22.0, vBasePos.x);
  float stoneLump = mix(0.42, 1.3, smoothstep(0.36, 0.64, baseNoise(vBasePos * 0.8 + 31.0) * 0.6 + baseNoise(vBasePos * 0.33 + 17.0) * 0.4)) * (1.0 + 0.9 * step(0.93, baseHash(floor(vBasePos * 5.0) + 9.0)));
  reflectedLight.indirectDiffuse *= mix(1.0, stoneLump, stoneByGlass);
  reflectedLight.directDiffuse *= mix(1.0, stoneLump, stoneByGlass);
  // Low on the sunlit side the light is raking: what is turned up takes it and what is turned down lies in its own shade.
  float stoneTurned = mix(1.0, mix(0.62, 1.4, smoothstep(-0.45, 0.2, stoneUp)), stoneLeftSide * smoothstep(30.0, 20.0, vBasePos.y));
  reflectedLight.indirectDiffuse *= stoneTurned;
  reflectedLight.directDiffuse *= stoneTurned;
  vec3 stoneKeeps = stoneShareAt(stoneRollAz, vBasePos.y);
  reflectedLight.indirectDiffuse *= stoneKeeps;
  reflectedLight.directDiffuse *= stoneKeeps;
  // Pale sand lights its own hollows: under its grain no crease lies much darker than the sand round it, and the light that fills it is warm.
  float stoneOwn = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.3, 0.55, 0.15)) / stoneGrain;
  float stoneFill = dot(material.diffuseContribution, vec3(0.3, 0.55, 0.15)) * RECIPROCAL_PI * dot(baseKeyAll, vec3(0.3333)) * mix(${STONE.fillSun.toFixed(3)}, mix(${STONE.fillMid.toFixed(3)}, ${STONE.fillRight.toFixed(3)}, smoothstep(12.0, 24.0, vBasePos.x)), smoothstep(-18.0, 0.0, vBasePos.x) * smoothstep(50.0, 40.0, vBasePos.x - 8.0 * smoothstep(16.0, 4.0, vBasePos.y))) * (1.0 - 0.6 * stoneByGlass) + 0.0001;
  reflectedLight.indirectDiffuse += mix(vec3(1.22, 0.96, 0.72), mix(vec3(1.0), vec3(1.02, 0.99, 0.96), baseCavity), stoneShady) * (stoneGrain * (sqrt(sqrt(stoneOwn * stoneOwn * stoneOwn * stoneOwn + stoneFill * stoneFill * stoneFill * stoneFill)) - stoneOwn));
  // Past the sun's side the roll's crest still stands out of the ball's shade into the light, under the line of deep shade below the seat:
  // brightest where the sun's side ends, fading toward the middle; on the right the roll stays in the shade.
  float stoneLedgeMid = smoothstep(-26.0, -14.0, vBasePos.x) * smoothstep(14.0, -8.0, vBasePos.x);
  float stoneLedgeB = (vBasePos.y - 37.2) / 1.5;
  float stoneLedgeD = (vBasePos.y - 39.6) / 0.8;
  vec3 stoneLedge = (1.0 + mix(vec3(1.6, 1.3, 1.1), vec3(1.3), smoothstep(-12.0, 4.0, vBasePos.x)) * stoneLedgeMid * exp(-stoneLedgeB * stoneLedgeB) * mix(0.6, 1.0, baseBlotch)) * (1.0 - 0.45 * stoneLedgeMid * exp(-stoneLedgeD * stoneLedgeD)) * (1.0 - 0.14 * smoothstep(31.0, 34.0, vBasePos.y) * smoothstep(12.0, 26.0, vBasePos.x) * smoothstep(52.0, 44.0, vBasePos.x));
  reflectedLight.indirectDiffuse *= stoneLedge;
  reflectedLight.directDiffuse *= stoneLedge;
  // Low on the sunlit left the sand is folded over itself: under the lip the crease lies in deep shade, and the foot's roll below it stands in the sun.
  float stoneFoldOn = smoothstep(-27.0, -38.0, stoneRollAz) * smoothstep(-66.0, -52.0, stoneRollAz);
  float stoneFoldH = mix(5.2 + 1.6 * sin((stoneRollAz * 3.0 + 20.0) * 0.0174533), 10.5 - 0.036 * (stoneRollAz + 48.0), smoothstep(-12.0, -34.0, stoneRollAz) * smoothstep(-116.0, -86.0, stoneRollAz));
  float stoneFoldD = (vBasePos.y - stoneFoldH - 0.8) / 1.4;
  float stoneFoldC = (vBasePos.y - stoneFoldH + 5.2) / 3.0;
  float stoneFoldW = (vBasePos.y - stoneFoldH + 2.4) / 2.0;
  float stoneFoldU = (vBasePos.y - stoneFoldH - 0.6) / 1.4;
  vec3 stoneFolded = (1.0 - ${STONE.foldSlot.toFixed(2)} * vec3(0.9, 0.84, 0.76) * stoneFoldOn * exp(-stoneFoldD * stoneFoldD) * mix(0.7, 1.0, baseBlotch)) * mix(vec3(1.0), vec3(0.84, 0.76, 0.66), ${STONE.foldFoot.toFixed(2)} * stoneFoldOn * exp(-stoneFoldC * stoneFoldC)) * (1.0 - vec3(0.12, 0.18, 0.26) * stoneFoldOn * exp(-stoneFoldU * stoneFoldU)) * (1.0 + ${STONE.foldWedge.toFixed(2)} * vec3(1.0, 0.9, 0.76) * smoothstep(-43.0, -35.0, stoneRollAz) * smoothstep(-18.0, -27.0, stoneRollAz) * exp(-stoneFoldW * stoneFoldW));
  reflectedLight.indirectDiffuse *= stoneFolded;
  reflectedLight.directDiffuse *= stoneFolded;
  // Where the mound lies deep under the sand round it no light reaches: the slot under the fold's lip is dark from every side.
  vec3 stoneSlot = 1.0 - ${STONE.slot.toFixed(2)} * vec3(0.9, 0.94, 1.0) * smoothstep(0.42, 0.04, vBasePaint.y) * smoothstep(1.0, 3.0, vBasePos.y) * smoothstep(34.0, 30.0, vBasePos.y);
  reflectedLight.indirectDiffuse *= stoneSlot;
  reflectedLight.directDiffuse *= stoneSlot;
  reflectedLight.directSpecular *= stoneSlot;
  // The light on the foot is cream gold: the brighter it lies, the paler it is.
  float stoneFootL = dot(reflectedLight.indirectDiffuse, vec3(0.3, 0.55, 0.15));
  float stoneFootPale = stoneLeftSide * smoothstep(18.0, 10.0, vBasePos.y) * smoothstep(0.5, 1.4, stoneFootL / (dot(material.diffuseContribution, vec3(0.3, 0.55, 0.15)) * RECIPROCAL_PI * dot(baseKeyAll, vec3(0.3333)) + 0.0001));
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, stoneFootL * vec3(1.14, 1.0, 0.78), 0.25 * stoneFootPale);
  // The fold's crest under the pale piece faces the sun square on: the brightest sand of the body, cream. The strokes on the lip under it are gold and lower.
  float stoneCrestX = (vBasePos.x + 34.0) / 5.0;
  float stoneCrestY = (vBasePos.y - 17.6 + 0.35 * (vBasePos.x + 34.0)) / 2.1;
  vec3 stoneCrest = (1.0 + vec3(2.7, 3.1, 3.5) * exp(-stoneCrestX * stoneCrestX - stoneCrestY * stoneCrestY) * mix(0.75, 1.0, baseBlotch)) * (1.0 - vec3(0.08, 0.1, 0.125) * stoneLeftSide * smoothstep(15.0, 13.9, vBasePos.y) * smoothstep(8.8, 10.4, vBasePos.y));
  // Under the seat the right end's crust takes less of the sun than the crust below it.
  stoneCrest *= 1.0 - vec3(0.12, 0.1, 0.03) * smoothstep(40.0, 47.0, vBasePos.x) * smoothstep(30.5, 33.5, vBasePos.y);
  reflectedLight.indirectDiffuse *= stoneCrest;
  reflectedLight.directDiffuse *= stoneCrest;
  ${STORM}
}
`

// Shell: the colour is in the vertices; the second uv holds the shade of its own folds and how glossy it is.
const SHELL_PAINT = `
${SEAT}
// The scallops on the right show every rib: a lit crest and a groove in its shade beside it.
float shellRibbed = smoothstep(10.0, 20.0, vBasePos.x) * (1.0 - smoothstep(31.5, 33.5, vBasePos.x)) + smoothstep(41.5, 43.5, vBasePos.x);
// A whelk's spiral is the seam between two turns of its tube: a thin brown line in its own shade.
float shellSeam = 1.0 - smoothstep(0.0, 0.45, vBaseUv1.x);
float baseAo = (0.92 + 0.08 * pow(abs(vBaseUv1.x), 1.2)) * (1.0 - mix(0.08, 0.22, smoothstep(41.5, 43.5, vBasePos.x)) * shellRibbed * pow(clamp((1.0 - vBaseUv1.x) / 0.34, 0.0, 1.0), 2.0)) * (1.0 - 0.3 * shellSeam) * baseFootAo;
float baseGloss = vBaseUv1.y;
float shellChalk = baseNoise(vBasePos * 6.0) * 0.6 + baseNoise(vBasePos * 17.0) * 0.4;
float shellOne = baseHash(floor(vBasePaint * 255.0) + 7.0);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(1.0, 0.95, 0.93), vec3(1.0, 0.93, 0.89), shellOne), 0.92);
diffuseColor.rgb *= mix(0.9, 1.06, shellChalk);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.5, 0.4), 0.55 * shellSeam);
diffuseColor.rgb = mix(diffuseColor.rgb, ${vec(SAND_COLOUR.pale)}, 0.12 * (1.0 - vBaseUv1.x) * (1.0 - smoothstep(0.8, 1.0, baseGloss)) * smoothstep(0.4, 0.7, shellChalk));
`
const SHELL_ROUGH = `
roughnessFactor = clamp(mix(0.9, 0.68, baseGloss) + 0.12 * (shellChalk - 0.5), 0.1, 1.0);
metalnessFactor = 0.0;
`
const SHELL_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 9.0 + 5.0), baseNoise(vBasePos * 9.0 + 31.0)) - 0.5) * 0.22 * (1.0 - baseGloss);
`
const SHELL_AFTER = `
{
  ${KEY}
  reflectedLight.indirectDiffuse *= baseAo * 0.4 * vec3(0.88, 0.96, 1.08);
  reflectedLight.indirectSpecular *= baseAo * 0.15;
  // The shells on the front stand in the base's own shade, lit by the room's cool fill, not by the sun.
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.5) * 0.95 * vec3(1.0, 0.97, 0.92);
  float shellNear = smoothstep(-36.5, -31.5, vBasePos.x) * (1.0 - smoothstep(-20.0, -17.0, vBasePos.x));
  float shellLeft = clamp((dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.85, 0.35, -0.3))) + 0.2) / 1.2, 0.0, 1.0);
  // The same light wrapped right round, so the far side of each rib is dimmer, not black.
  float shellWide = clamp(dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.85, 0.35, -0.3))) * 0.5 + 0.5, 0.0, 1.0);
  float shellWarm = clamp(dot(geometryNormal, baseCard) * 0.5 + 0.5, 0.0, 1.0);
  float shellFront = clamp(dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.7, 0.55, 0.45))), 0.0, 1.0);
  // On the right the shells face the cool light that the table and the sky send back: one side of each takes it, the other stays in shade.
  float shellRight = clamp((dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(0.8, 0.45, 0.4))) + 0.1) / 1.1, 0.0, 1.0) * smoothstep(2.0, 26.0, vBasePos.x);
  float shellSun = clamp((dot(geometryNormal, baseKey) + 0.3) / 1.3, 0.0, 1.0);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * (uRigCardCol * 0.15 * shellWarm * shellWarm + baseSunC * 0.5 * pow(abs(shellWarm), 14.0) + baseKeyC * (0.9 + 0.6 * shellNear) * shellSun * shellSun + baseSunC * ((0.3 + 0.9 * shellNear) * shellLeft * shellLeft + (0.5 - 0.2 * shellNear) * shellWide + 1.2 * shellNear * shellFront * shellFront) + vec3(0.95, 0.9, 0.86) * dot(baseSunC, vec3(0.3333)) * (0.8 - 0.35 * shellNear) + vec3(0.9, 0.97, 1.08) * dot(baseSunC, vec3(0.3333)) * 0.9 * shellRight);
  vec3 shellAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float shellNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float shellF = 0.05 + 0.95 * pow(abs(1.0 - shellNv), 5.0);
  reflectedLight.indirectSpecular += (stageRoomSoft(shellAway, 0.3) + stageRoomLights(shellAway, 0.03)) * shellF * baseGloss * baseAo * 0.1;
  float shellNh = max(dot(geometryNormal, normalize(baseKey + geometryViewDir)), 0.0);
  float shellCh = max(dot(geometryNormal, normalize(baseCard + geometryViewDir)), 0.0);
  vec3 shellPearl = 0.5 + 0.5 * cos(6.2831853 * (shellNv * 1.3 + vec3(0.0, 0.33, 0.67)));
  float shellLustre = smoothstep(0.8, 1.0, baseGloss);
  reflectedLight.directSpecular += (baseKeyC * (0.1 * pow(abs(shellNh), 60.0) + 0.03 * pow(abs(shellNh), 14.0)) * smoothstep(0.0, 0.15, dot(geometryNormal, baseKey)) + (uRigCardCol + vec3(1.0, 0.9, 0.76) * dot(baseSunC, vec3(0.3333)) * 1.4) * (0.08 * pow(abs(shellCh), 40.0) + 0.04 * pow(abs(shellCh), 9.0)) * smoothstep(0.0, 0.2, dot(geometryNormal, baseCard))) * baseGloss * baseAo * 0.4 * mix(vec3(1.0), 0.7 + 0.6 * shellPearl, shellLustre);
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * (baseKeyC + uRigCardCol) * 0.08 * shellLustre * shellPearl;
  ${shadeIn(0.17, 0.19, 14, 0.22, 'mix(mix(mix(vec3(1.0, 0.84, 0.7), vec3(1.05, 1.05, 1.0), smoothstep(-32.0, 2.0, vBasePos.x)), vec3(0.86, 0.86, 0.84), smoothstep(10.0, 24.0, vBasePos.x)), vec3(1.0, 0.74, 0.58), smoothstep(41.0, 50.0, vBasePos.x))')}
  // In the ball's shade a shell is white in the room's cool light: the crest of every rib takes the sky and the groove beside it lies in a shallow grey shade.
  float shellFold = clamp((1.0 - vBaseUv1.x) / 0.34, 0.0, 1.0);
  float shellWhelk = 1.0 - smoothstep(3.0, 3.8, length((vBasePos.xy - vec2(34.6, 27.5)) * vec2(1.3, 1.0)));
  float shellOlive = 1.0 - smoothstep(2.9, 3.6, length((vBasePos.xy - vec2(38.8, 22.5)) * vec2(1.37, 1.0)));
  float shellFan = smoothstep(14.0, 20.0, vBasePos.x) * (1.0 - smoothstep(34.0, 35.5, vBasePos.x)) * (1.0 - shellWhelk) * (1.0 - shellOlive);
  vec3 shellKeeps = mix(vec3(1.0, 1.04, 1.2), vec3(0.9, 0.8, 0.74), smoothstep(-40.0, -30.0, vBasePos.x));
  shellKeeps = mix(shellKeeps, vec3(0.42, 0.48, 0.58), smoothstep(-24.0, 2.0, vBasePos.x));
  shellKeeps = mix(shellKeeps, vec3(0.51, 0.65, 0.9), smoothstep(8.0, 26.0, vBasePos.x));
  shellKeeps = mix(shellKeeps, vec3(0.65, 0.79, 1.05), smoothstep(30.0, 36.0, vBasePos.x));
  shellKeeps = mix(shellKeeps, vec3(0.58, 0.61, 0.8), smoothstep(41.0, 47.0, vBasePos.x));
  shellKeeps *= mix(vec3(1.0), mix(vec3(2.03, 2.27, 2.37), vec3(0.76, 0.55, 0.37), shellFold * shellFold), shellFan);
  // The scallop in the sun on the left: its crests a little whiter and the lines between them tan.
  shellKeeps *= mix(vec3(1.0), mix(vec3(1.08, 1.07, 1.12), vec3(0.86, 0.82, 0.78), shellFold * shellFold), 1.0 - smoothstep(8.5, 9.5, length((vBasePos.xy - vec2(-43.7, 23.9)) * vec2(1.5, 1.0))));
  // The fan's dome turns its upper left to the sky and its lower right to the sand: cool and light above, warm and dim below.
  shellKeeps *= mix(vec3(1.0), mix(vec3(0.58, 0.42, 0.28), vec3(1.14, 1.2, 1.3), clamp(0.42 + (vBasePos.y - 20.9 - 0.6 * (vBasePos.x - 25.0)) / 14.0, 0.0, 1.0)), shellFan);
  shellKeeps = mix(shellKeeps, vec3(0.87, 1.12, 1.75) * mix(vec3(1.0), vec3(1.0, 0.7, 0.45), shellFold), shellWhelk);
  shellKeeps = mix(shellKeeps, vec3(0.76, 0.9, 1.16), shellOlive);
  // The whelk left of the middle is as pale as the scallop beside it, not the colour of the sand it lies in.
  shellKeeps *= mix(vec3(1.0), vec3(1.03, 1.3, 1.6), 1.0 - smoothstep(3.3, 4.0, length((vBasePos.xy - vec2(-28.1, 24.1)) * vec2(1.15, 1.0))));
  // The cockle in the middle lies open to the room: its far side is dim, not dark. The one at the right end stands half in the sun.
  shellKeeps *= mix(vec3(1.0), vec3(1.48, 1.6, 1.78) * mix(vec3(1.05, 1.08, 1.11), vec3(0.9, 0.8, 0.66), shellFold * shellFold) * mix(vec3(0.94, 0.82, 0.68), vec3(1.04, 1.08, 1.12), clamp(0.5 + (vBasePos.y - 18.3) / 5.0, 0.0, 1.0)), 1.0 - smoothstep(4.2, 5.2, length(vBasePos.xy - vec2(4.0, 18.3))));
  shellKeeps *= mix(vec3(1.0), vec3(0.84, 0.78, 0.8), smoothstep(42.5, 44.0, vBasePos.x));
  // A matte shell has a faint bloom: at its turning edge it is a little paler.
  reflectedLight.indirectDiffuse += material.diffuseContribution * RECIPROCAL_PI * baseAo * dot(baseSunC, vec3(0.3333)) * vec3(1.0, 0.96, 0.94) * (0.3 * pow(abs(1.0 - shellNv), 2.0));
  reflectedLight.indirectDiffuse *= shellKeeps;
  reflectedLight.directDiffuse *= shellKeeps;
  // The whelks left of the middle lie in the same sun as the scallop beside them.
  reflectedLight.indirectDiffuse *= 1.0 + shellNear * vec3(0.5, 0.45, 0.5);
  reflectedLight.directDiffuse *= 1.0 + shellNear * vec3(0.5, 0.45, 0.5);
  // Round the right end the sun reaches the base again, and what is set there lies in it.
  float shellRim = smoothstep(45.0, 50.0, vBasePos.x);
  reflectedLight.indirectDiffuse *= 1.0 + 2.6 * shellRim;
  reflectedLight.directDiffuse *= 1.0 + 2.6 * shellRim;
  // Each shell is glossy: one soft highlight from the room, whatever shade it lies in.
  float shellSpark = max(dot(geometryNormal, normalize(normalize(mat3(viewMatrix) * vec3(-0.3, 0.8, 0.52)) + geometryViewDir)), 0.0);
  reflectedLight.directSpecular += vec3(1.0, 0.96, 0.9) * dot(baseSunC, vec3(0.3333)) * (0.06 * pow(max(shellSpark, 0.0), 160.0) + 0.012 * pow(max(shellSpark, 0.0), 40.0) + 0.006 * pow(max(shellSpark, 0.0), 12.0)) * smoothstep(0.1, 0.4, baseGloss) * baseFootAo;
  // The crest of each rib takes a small warm glint of its own.
  reflectedLight.directSpecular += vec3(1.0, 0.86, 0.66) * dot(baseSunC, vec3(0.3333)) * (0.1 * pow(max(shellSpark, 0.0), 26.0) * smoothstep(0.35, 0.0, shellFold) * (1.0 - shellWhelk) * (1.0 - shellOlive) * baseFootAo);
  ${STORM}
}
`

// Sea glass: tumbled and frosted, so nothing mirrors in it. Its heart is deepest in colour; the light goes through its thin
// edge and comes out there as its colour, on the side away from the light; the frosting lies on it in patches with small pits;
// the very rim is a dark line at the sand with a few grains on it; and each piece has one small highlight of its own.
const GLASS_PAINT = `
float baseThin = vBaseUv1.x;
float baseFrost = vBaseUv1.y;
${SEAT}
float baseAo = baseFootAo;
float glassOne = baseHash(floor(vBasePaint * 255.0) + 3.0);
float glassCloud = baseNoise(vBasePos * 1.7 + 40.0 * glassOne) * 0.6 + baseNoise(vBasePos * 4.6 + 9.0) * 0.4;
float glassMottle = baseNoise(vBasePos * 9.0 + 13.0) * 0.6 + baseNoise(vBasePos * 23.0) * 0.4;
float glassPit = smoothstep(0.36, 0.14, length(fract(vBasePos * 4.6) - 0.5)) * step(0.7, baseHash(floor(vBasePos * 4.6) + 5.0));
vec3 glassHue = vBasePaint / max(max(vBasePaint.r, max(vBasePaint.g, vBasePaint.b)), 0.02);
float glassHeart = smoothstep(0.3, 0.95, baseThin);
float glassVal = max(vBasePaint.r, max(vBasePaint.g, vBasePaint.b));
diffuseColor.rgb = pow(max(glassHue, 0.0005), vec3(mix(0.8, 1.3, glassHeart)));
`
const GLASS_ROUGH = `
roughnessFactor = clamp(mix(0.72, 0.92, baseFrost) + 0.1 * (glassMottle - 0.5), 0.5, 1.0);
metalnessFactor = 0.0;
`
const GLASS_TILT = `
vec2 baseTilt = (vec2(baseNoise(vBasePos * 23.0 + 5.0), baseNoise(vBasePos * 23.0 + 31.0)) - 0.5) * (0.12 + 0.2 * baseFrost);
`
const GLASS = { body: 1.0, thru: 0.7, frost: 0.07, grain: 0.5, rim: 0.1, spark: 0.45, glow: 0.15, glint: 3.0 }
const GLASS_AFTER = `
{
  ${KEY}
  float glassE = dot(baseSunC, vec3(0.3333));
  float glassNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  // Which way the middle of the piece lies on the picture: the side toward the upper left takes the room's light, the rim at the lower left lets the sun behind out.
  vec2 glassSlope = vec2(dFdx(baseThin), dFdy(baseThin));
  vec2 glassTo = glassSlope / max(length(glassSlope), 1e-5);
  float glassUl = dot(glassTo, vec2(0.707, -0.707)) * smoothstep(1.0, 0.45, baseThin);
  float glassSunny = 1.0 - smoothstep(-16.0, 2.0, vBasePos.x);
  float glassOut = pow(clamp(1.0 - baseThin, 0.0, 1.0), 0.6);
  float glassFar = dot(-glassTo, vec2(0.45, -0.893)) * glassOut;
  float glassFarDir = dot(-glassTo, vec2(0.45, -0.893));
  // The small teal piece on the right lets its light out on the side away from the room's lamp, and its rim toward the lamp is the dark one.
  float glassTurn = smoothstep(31.0, 35.0, vBasePos.x) * (1.0 - smoothstep(43.0, 46.0, vBasePos.x));
  float glassThru = glassOut * mix(mix(1.3 * clamp(0.75 - 0.4 * glassFarDir, 0.0, 1.0), 1.6 * clamp(0.3 + 0.5 * glassFarDir, 0.0, 1.0), glassTurn), clamp(glassFarDir * 0.35 + 0.65, 0.0, 1.0), glassSunny) * mix(1.0, 0.35, smoothstep(22.0, 34.0, vBasePos.x));
  float glassLine = smoothstep(0.08, 0.2, baseThin);
  vec3 glassDeep = material.diffuseContribution;
  vec3 glassPale = pow(max(glassHue, 0.0005), vec3(0.6));
  reflectedLight.directDiffuse *= 0.2;
  reflectedLight.indirectDiffuse *= 0.16;
  vec3 glassIn = uRigCardCol + glassE * vec3(1.0, 0.92, 0.8) * 0.3;
  float glassPatch = mix(0.7, 1.3, glassCloud) * mix(0.88, 1.08, glassMottle) * (1.0 - 0.35 * glassPit);
  float glassPalest = smoothstep(0.8, 0.86, glassVal);
  // A pale warm piece is a pebble the light lies on: lightest in its middle toward the upper left, with no lit rim round a darker heart.
  float glassPebble = glassPalest * smoothstep(0.15, 0.3, (vBasePaint.r - vBasePaint.g) / max(glassVal, 0.02));
  vec3 glassCol = glassDeep * glassIn * (${GLASS.body.toFixed(2)} * (0.42 * (1.0 + max(glassFar, 0.0) * mix(0.2, 0.5, glassPalest * (1.0 - glassPebble)) * glassSunny - 0.7 * max(-glassFar, 0.0) * glassPalest * (1.0 - glassPebble) * glassSunny - 0.3 * max(glassFar, 0.0) * (1.0 - glassSunny) * (1.0 - glassTurn) - 0.5 * max(-glassFar, 0.0) * glassTurn)) * mix(0.75, 1.8, smoothstep(0.58, 0.75, glassVal)) * mix(0.55, 1.0, smoothstep(0.2, 0.42, glassVal)) * mix(1.0, 1.35, glassPalest) * mix(1.0, 0.9, glassHeart) * glassPatch);
  glassCol += glassPale * glassIn * (${GLASS.thru.toFixed(2)} * glassThru * (0.6 + 0.8 * glassOne) * (1.0 - 0.75 * glassPebble));
  glassCol += glassPale * glassIn * (0.3 * glassPebble * smoothstep(0.12, 0.8, baseThin) * (1.0 - 0.9 * glassFar) * (0.6 + 0.8 * clamp(dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.6, 0.6, 0.5))), 0.0, 1.0)));
  glassCol += glassPale * glassIn * (${GLASS.rim.toFixed(2)} * mix(2.0, 1.0, glassSunny) * (1.0 - 0.85 * glassTurn * smoothstep(0.3, -0.5, glassFarDir)) * smoothstep(0.5, 0.22, baseThin) * glassLine * mix(0.7, 1.2, glassMottle));
  // The light that went in comes out again inside the piece: the edge of its heart glows on the side away from the lamp.
  glassCol += mix(glassDeep, glassPale, 0.5) * glassIn * (${GLASS.glow.toFixed(2)} * smoothstep(0.35, 0.6, baseThin) * smoothstep(1.0, 0.8, baseThin) * pow(max(glassFarDir, 0.0), 1.5) * (1.0 - glassPebble) * mix(1.0, 0.5, smoothstep(22.0, 34.0, vBasePos.x)));
  // Toward the lamp the rim of a piece is its dark side: the light goes in there and comes out across the heart.
  glassCol *= 1.0 - 0.4 * smoothstep(0.45, 0.12, baseThin) * clamp(0.6 + 0.6 * dot(glassTo, vec2(0.707, -0.707)), 0.0, 1.0) * (1.0 - glassPebble);
  float glassSkin = smoothstep(0.42, 0.8, glassCloud) * (0.5 + 0.5 * glassMottle) * (1.0 - 0.7 * glassPit) * mix(0.35, 1.0, baseFrost);
  glassCol += (glassPale * 0.8 + 0.08) * glassIn * (${GLASS.frost.toFixed(2)} * glassSkin);
  // The frosted face scatters the light it meets: toward the sun the colour is veiled in a pale warm grey, and the frost is a fine grain.
  float glassVeil = smoothstep(-0.3, 0.7, dot(-glassTo, vec2(-0.8, 0.6))) * glassOut * glassSunny * (1.0 - glassPalest);
  glassCol += glassIn * vec3(0.3, 0.15, 0.1) * glassVeil;
  glassCol *= 1.0 + (0.2 - 0.1 * ${FAR}) * (baseHash(floor(vBasePos * 7.0) + 31.0) - 0.5);
  glassCol = mix(vec3(dot(glassCol, vec3(0.3, 0.55, 0.15))) * vec3(1.06, 1.0, 0.9), glassCol, 0.9);
  vec3 glassCell = floor(vBasePos * 5.2);
  float glassGrain = step(0.86, baseHash(glassCell + 9.0)) * smoothstep(0.3, 0.14, baseThin + 0.2 * (baseHash(glassCell + 21.0) - 0.5)) * smoothstep(0.45, 0.15, length(fract(vBasePos * 5.2) - 0.5));
  vec3 glassSpkC = floor(vBasePos * 2.3 + 7.0);
  glassCol += glassPale * glassIn * (${GLASS.spark.toFixed(2)} * step(0.86, baseHash(glassSpkC + 2.0)) * smoothstep(0.3, 0.08, length(fract(vBasePos * 2.3 + 7.0) - 0.5)) * glassLine);
  glassCol = mix(glassCol * mix(0.92, 1.0, glassLine), ${vec(SAND_COLOUR.pale)} * glassIn * ${GLASS.grain.toFixed(2)}, glassGrain);
  glassCol *= mix(vec3(1.0), vec3(0.83, 0.84, 1.0), glassPebble);
  reflectedLight.indirectDiffuse += glassCol * RECIPROCAL_PI * baseFootAo;
  #ifdef STAGE_LIGHT_DONE
  reflectedLight.indirectDiffuse += stageThrough(geometryNormal, geometryViewDir, 0.4, 3.0) * glassPale * 0.2 * glassLine;
  #endif
  vec3 glassAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float glassF = 0.04 + 0.96 * pow(abs(1.0 - glassNv), 5.0);
  reflectedLight.indirectSpecular *= 0.1;
  reflectedLight.indirectSpecular += stageRoomSoft(glassAway, 0.8) * glassF * 0.05 * (1.0 - glassGrain);
  reflectedLight.directSpecular *= 0.1;
  ${shadeIn(0.5, 0.8, 20, 0.66, false)}
  float glassRim = smoothstep(46.0, 51.0, vBasePos.x);
  reflectedLight.indirectDiffuse *= 1.0 + 2.2 * glassRim;
  reflectedLight.directDiffuse *= 1.0 + 2.2 * glassRim;
  // There the sun grazes each piece and its near edge flashes.
  float glassSunH = dot(normal, normalize(normalize(mat3(viewMatrix) * vec3(0.9, 0.3, -0.32)) + geometryViewDir));
  reflectedLight.directSpecular += vec3(1.0, 0.95, 0.85) * glassE * (0.35 * glassRim * pow(max(glassSunH, 0.0), 24.0) * glassLine);
  // One or two small sharp sparks to a piece: single facets of its frosted skin that turn the room's lamp to the eye.
  vec3 glassSpkP = vBasePos * 4.0 + 3.0;
  vec3 glassSpkCell = floor(glassSpkP);
  vec3 glassFacet = normalize(normalMatrix * normalize(baseObjectNormal + 0.5 * (vec3(baseHash(glassSpkCell + 3.7), baseHash(glassSpkCell + 11.3), baseHash(glassSpkCell + 23.9)) - 0.5)));
  float glassSparkH = dot(glassFacet, normalize(normalize(mat3(viewMatrix) * vec3(-0.3, 0.8, 0.52)) + geometryViewDir));
  reflectedLight.directSpecular += vec3(1.0, 0.97, 0.92) * glassE * (${GLASS.glint.toFixed(2)} * pow(max(glassSparkH, 0.0), 1500.0) * step(0.9, baseHash(glassSpkCell + 5.1)) * smoothstep(0.5, 0.15, length(fract(glassSpkP) - 0.5)) * glassLine * baseFootAo);
  ${STORM}
}
`

// Loose sand. The mesh carries how thick it lies (red of the vertex colour); the tile carries single grains, each with its
// own number, and a grain is drawn only where the sand is thicker than its number: so a thin layer is single grains and the
// edge of a heap breaks up into them.
export const SAND = { tileMm: 6.6, cover: 0.62, glint: 5.0, slope: 0.6, wrap: 40.0, thru: 5.0, ledge: 0.3, stage: 0.2, drape: 0.55, crest: 3.0, far: [0.05, 0.14], speck: 2.4 }
const SHADE = { r: 56, soft: 3.5, top: 40, globeH: 79, globeR: 60, globe: 0.5, front: 0.1, frontMm: [-6, 44], frontX: [58, 98] }
const baseUniforms = {
  uBaseStorm: { value: 0 },
}
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
vec2 sandWall = vec2((dot(vBasePos.xz, vBasePos.xz) > 0.0 ? atan(vBasePos.x, vBasePos.z) : 0.0) * 55.0, vBasePos.y) / ${SAND.tileMm.toFixed(2)};
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
bool sandCut = sandCover < sandNeed + 0.004;
float sandId = fract(sandGrain * 37.31);
float sandId2 = fract(sandGrain * 91.7);
vec3 sandC = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, smoothstep(0.1, 0.75, sandId));
sandC = mix(sandC, ${vec(SAND_COLOUR.white)}, step(sandId2, 0.1));
float sandDeep = smoothstep(0.1, 0.9, sandThick);
float sandPit = sandGrain > 0.02 ? 1.0 : 0.8;
float sandBlotch = baseNoise(sandAt * 0.35) * 0.6 + baseNoise(sandAt * 1.3) * 0.4;
sandC = mix(${vec(SAND_COLOUR.pale)}, sandC, smoothstep(0.1, 0.6, sandCover));
diffuseColor.rgb = diffuse * sandC * sandPit * mix(0.9, 1.08, sandBlotch) * mix(1.0, 0.8 + 0.4 * sandId, smoothstep(0.1, 0.6, sandCover));
${SEAT}
float baseAo = mix(0.85, 1.0, sandDeep) * (0.55 + 0.45 * vBasePaint.y) * baseSeatAo;
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
  reflectedLight.directSpecular += baseKeyC * (pow(max(dot(sandFacet, normalize(baseKey + geometryViewDir)), 0.0), 90.0) * sandShine * ${SAND.glint.toFixed(1)} * smoothstep(0.0, 0.2, dot(nonPerturbedNormal, baseKey))) * sandLit;
  reflectedLight.directSpecular += uRigCardCol * (pow(max(dot(sandFacet, normalize(baseCard + geometryViewDir)), 0.0), 70.0) * sandShine * ${(SAND.glint * 0.5).toFixed(1)});
}
`

// The sand on the base's own ledge lies in the ball's shade between the two lit ends of the lip, darkest by the glass.
const SAND_LEDGE = `
{
  ${KEY}
  float ledgeBall = smoothstep(-24.0, -10.0, vBasePos.x) * smoothstep(30.0, 22.0, vBasePos.x);
  float ledgeShade = mix(0.4, 0.16, ledgeBall) * mix(0.3, 1.0, smoothstep(0.6, 2.4, baseSeatD));
  // A grain on the very edge of the lip stood many times brighter than the stone under it, and the lens gave that edge a coloured rim.
  vec3 ledgeMost = diffuseColor.rgb * RECIPROCAL_PI * dot(baseSunC, vec3(0.3333)) * 4.5;
  // Round the sunlit right end each grain of the loose sand stands lit or in its neighbour's shade, however small it is on the picture.
  float ledgeCell = exp2(ceil(log2(max(sandPx, 0.03) * 1.5)));
  float ledgeDice = baseHash(floor(vBasePos / ledgeCell) + 19.0);
  float ledgeLump = smoothstep(0.44, 0.52, baseNoise(vBasePos * 0.45 + 13.0));
  float ledgeChip = smoothstep(0.46, 0.5, baseNoise(vBasePos * 1.3 + 29.0));
  float ledgeGrit = mix(1.0, mix(0.45, 1.5, ledgeDice * ledgeDice) * mix(0.55, 1.2, ledgeLump) * mix(0.8, 1.1, ledgeChip), smoothstep(40.0, 50.0, vBasePos.x) * smoothstep(40.0, 34.0, vBasePos.y));
  reflectedLight.indirectDiffuse = min(reflectedLight.indirectDiffuse * ledgeShade * ledgeGrit * mix(vec3(1.0), vec3(0.84, 0.95, 1.14), ledgeBall), ledgeMost);
  reflectedLight.directDiffuse = min(reflectedLight.directDiffuse * ledgeShade, ledgeMost);
  reflectedLight.indirectSpecular = min(reflectedLight.indirectSpecular * ledgeShade, ledgeMost);
  reflectedLight.directSpecular = min(reflectedLight.directSpecular * ledgeShade, ledgeMost);
}
`

export function sandMaterial(part: string, change: string, key: string, ledge = false): THREE.MeshStandardMaterial {
  return stageMaterial({
    part,
    standIn: false,
    change,
    key,
    side: THREE.DoubleSide,
    hook: hookOf({ uSandTile: { value: map('sand.lin.tile.w512') }, uSandSpill: sandUniforms.uSandSpill }, { pars: SAND_PARS, paint: SAND_PAINT, rough: SAND_ROUGH, tilt: SAND_TILT, after: ledge ? SAND_AFTER + SAND_LEDGE : SAND_AFTER, cut: 'if (sandCut) discard;' }),
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
      { uBaseGrain: { value: map('grain.lin.tile.w512') }, uBaseCarve: { value: map('carve.lin.w2048') }, uBaseTone: { value: map('stone.srgb.w2048') }, uBaseStorm: baseUniforms.uBaseStorm },
      { pars: STONE_PARS, paint: STONE_PAINT, rough: STONE_ROUGH, tilt: STONE_TILT, bent: STONE_BENT, after: STONE_AFTER },
    ),
  })
  const shell = stageMaterial({ ...lit, key: `${PART}-shell`, vertexColors: true, hook: hookOf({ uBaseStorm: baseUniforms.uBaseStorm }, { pars: 'uniform float uBaseStorm;', paint: SHELL_PAINT, rough: SHELL_ROUGH, tilt: SHELL_TILT, after: SHELL_AFTER }) })
  const glass = stageMaterial({ ...lit, key: `${PART}-seaglass`, vertexColors: true, hook: hookOf({ uBaseStorm: baseUniforms.uBaseStorm }, { pars: 'uniform float uBaseStorm;', paint: GLASS_PAINT, rough: GLASS_ROUGH, tilt: GLASS_TILT, after: GLASS_AFTER }) })
  const sand = sandMaterial(PART, 'base', `${PART}-sand`, true)
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
  baseUniforms.uBaseStorm.value = stormHeld(moment)
}
