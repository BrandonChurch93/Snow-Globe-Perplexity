import * as THREE from 'three'
import { config } from '../../config'
import { lightUniforms } from '../../core/chunks/light'
import { stageMaterial, stageShader, type Rgb } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { texture } from '../../core/textures'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { partChange } from '../../shake/change'
import type { KitMoment } from '../kit'

export const season = 'spring'
export const main: Rgb = [0.05, 0.085, 0.03]

const PART = 'base-spring'
const MODEL = 'spring/base-spring.glb'
const map = (name: string) => texture(`spring/base-${name}.png`)

export const FLOW = { startSeconds: 0.12, runSeconds: 2.1, power: 0.8, speedMm: 30, leaveLead: 0.6 }

export const trickle: { foot: [number, number]; lengthMm: number } = { foot: [-39.6, 40.8], lengthMm: 49 }

export function flowFront(sinceLanding: number): number {
  if (!(sinceLanding < Infinity)) return 1
  const t = Math.min(1, Math.max(0, (sinceLanding - FLOW.startSeconds) / FLOW.runSeconds))
  return Math.pow(t, FLOW.power)
}

export const waterUniforms = {
  uWater: { value: new THREE.Vector4(1, 0, 40, 1) },
  uWaterKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uWaterKeyCol: { value: new THREE.Color() },
  uWaterRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uWaterRimCol: { value: new THREE.Color() },
  uWaterSky: { value: new THREE.Color() },
  uWaterFloor: { value: new THREE.Color() },
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
uniform vec4 uWater;
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
  vec3 n0 = dot(vBaseNormal, vBaseNormal) > 1e-8 ? normalize(vBaseNormal) : vec3(0.0, 1.0, 0.0);
  vec3 t0 = vec3(vBasePos.z, 0.0, -vBasePos.x);
  t0 = t0 - n0 * dot(t0, n0);
  if (dot(t0, t0) < 1e-6) t0 = abs(n0.y) < 0.9 ? cross(vec3(0.0, 1.0, 0.0), n0) : cross(vec3(1.0, 0.0, 0.0), n0);
  t0 = normalize(t0);
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

const LIGHTS = `
  vec3 liveKey = vec3(0.0, 1.0, 0.0);
  vec3 liveKeyC = vec3(0.0);
  vec3 liveSunC = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  liveKey = stageKeyL;
  liveKeyC = stageKeyC * stageKeyS;
  liveSunC = stageKeyC;
  #elif NUM_DIR_LIGHTS > 0
  liveKey = directionalLights[0].direction;
  liveKeyC = directionalLights[0].color;
  liveSunC = liveKeyC;
  #endif
  vec3 liveCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float liveNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float liveNh = max(dot(geometryNormal, normalize(liveKey + geometryViewDir)), 0.0);
  float liveCh = max(dot(geometryNormal, normalize(liveCard + geometryViewDir)), 0.0);
  float liveWrap = clamp(dot(geometryNormal, liveKey) * 0.5 + 0.5, 0.0, 1.0);
  float liveCardWrap = clamp(dot(geometryNormal, liveCard) * 0.5 + 0.5, 0.0, 1.0);
  float liveRim = clamp((dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(0.76, 0.3, -0.58))) + 0.25) / 1.25, 0.0, 1.0);
  float liveUp = max(inverseTransformDirection(geometryNormal, viewMatrix).y, 0.0);
  // How open a place is to the light behind is the base's own shape there, not each tuft's: a wall that faces the camera stays in shade however rough it is.
  // A thinned mesh can hold a corner with no normal of its own: such a place takes the bent normal, never a division by nothing.
  vec3 liveMacro = dot(vBaseNormal, vBaseNormal) > 1e-8 ? normalize(normalMatrix * vBaseNormal) : geometryNormal;
  float liveRimM = clamp((dot(liveMacro, normalize(mat3(viewMatrix) * vec3(0.76, 0.3, -0.58))) + 0.25) / 1.25, 0.0, 1.0);
  float liveUpM = max(inverseTransformDirection(liveMacro, viewMatrix).y, 0.0);
  float liveOpen = smoothstep(0.05, 0.7, mix(liveRim + 0.3 * liveUp, liveRimM + 0.3 * liveUpM, 0.75));
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
  reflectedLight.directDiffuse *= mix(1.0, baseAo, 0.7);
  reflectedLight.directSpecular *= mix(1.0, baseAo, 0.85);
}
`

// How much the low light from the left, the room's cool fill on the bare stone and the blossom-coloured light on the right flank give.
const ROCK = { kick: 3.0, fill: 1.2, mossFill: 3.6, flank: 120.0, lustre: 0.04 }

const SUN_TOP = 'vec3(2.4, 1.7, 0.7)'

const ROCK_PARS = `
uniform sampler2D uBaseStone;
uniform sampler2D uBaseStoneDetail;
uniform sampler2D uBaseRelief;
uniform sampler2D uBaseCover;
`

const ROCK_PAINT = `
vec4 baseRelief = texture2D(uBaseRelief, vBaseUv1);
vec4 baseCover = texture2D(uBaseCover, vBaseUv1);
vec4 baseMossD = texture2D(uBaseDetail, vMapUv);
// The moss sheet is laid larger than the stone's: the stone keeps its own grain size.
vec2 baseStoneUv = vMapUv * (13.0 / 17.0);
vec3 baseStoneC = texture2D(uBaseStone, baseStoneUv).rgb;
vec4 baseStoneD = texture2D(uBaseStoneDetail, vMapUv * (27.0 / 17.0));
vec4 baseStoneF = texture2D(uBaseStoneDetail, vMapUv.yx * 4.6 + 0.37);
float baseSeat = vBasePaint.x;
float baseMoss = mix(1.0, smoothstep(0.5, 0.74, baseCover.r + 0.42 * (baseMossD.b - 0.5) + 0.3 * (baseNoise(vBasePos * 0.55 + 11.0) - 0.5) + 0.34 * (baseNoise(vBasePos * 1.7 + 5.0) - 0.5)), baseSeat);
float baseRun = smoothstep(uWater.x + 0.015, uWater.x - 0.015, baseCover.b);
float baseWet = baseCover.g * mix(1.0, baseRun * uWater.w, step(baseCover.b, 0.99)) * (1.0 - baseMoss);
float baseAo = mix(0.3, mix(0.12 + 0.88 * smoothstep(0.1, 0.95, baseRelief.b), smoothstep(-0.3, 0.62, baseRelief.b), baseMoss), baseSeat);
baseAo *= mix(1.0, mix(0.66, 1.0, smoothstep(0.2, 0.6, baseMossD.b)), baseMoss);
// The glass sits in the moss: the moss darkens where it meets the glass, and the stone where it meets the table.
baseAo *= mix(0.55, 1.0, smoothstep(0.2, 1.8, length(vBasePos - vec3(0.0, 79.0, 0.0)) - 60.0)) * mix(0.45, 1.0, smoothstep(0.0, 2.6, vBasePos.y));
// At the front the glass stands over the cushion's bank: the bank lies in its shade and only the brow keeps the light.
float baseBank = smoothstep(0.55, 0.8, vBasePos.z / max(length(vBasePos.xz), 1.0)) * smoothstep(38.0, 24.0, vBasePos.x);
baseAo *= mix(1.0, mix(0.16, 1.0, smoothstep(4.4, 6.8, length(vBasePos - vec3(0.0, 79.0, 0.0)) - 60.0)), baseBank);
float baseBlotch = baseNoise(vBasePos * 0.19) * 0.6 + baseNoise(vBasePos * 0.8) * 0.4;
float baseSun = baseNoise(vBasePos * 0.45 + 7.3);
float baseSpeck = baseNoise(vBasePos * 6.5);
vec3 baseStone = baseStoneC * vec3(0.32, 0.29, 0.25) * mix(0.55, 1.3, baseBlotch) * mix(0.3, 1.4, baseStoneD.b) * mix(0.45, 1.3, baseStoneF.b) * mix(0.8, 1.15, baseSpeck);
baseStone = mix(baseStone, vec3(0.3, 0.27, 0.23), 0.5 * smoothstep(0.68, 0.8, baseSpeck) * baseStoneF.b);
baseStone = mix(baseStone, baseStone * vec3(0.42, 0.47, 0.54), baseWet);
vec3 baseGreen = diffuseColor.rgb * mix(vec3(0.11, 0.17, 0.12), vec3(0.25, 0.39, 0.23), smoothstep(0.3, 0.75, baseSun) * (0.35 + 0.65 * baseMossD.b));
baseGreen *= mix(0.46, 1.1, smoothstep(0.2, 0.9, baseMossD.b)) * mix(0.5, 1.1, baseBlotch);
baseGreen = mix(vec3(dot(baseGreen, vec3(0.3, 0.6, 0.1))) * vec3(0.9, 1.02, 0.8), baseGreen, 0.52);
float baseClump = smoothstep(0.3, 0.68, 0.55 * baseNoise(vBasePos * 0.62 + 3.0) + 0.45 * baseNoise(vBasePos * 1.45 + 9.0));
baseGreen *= mix(0.5, 1.3, baseClump);
baseGreen = mix(baseGreen, vec3(0.02, 0.04, 0.016), 0.2 * (1.0 - smoothstep(0.1, 0.6, baseRelief.b)));
float baseFilm = max(smoothstep(0.3, 0.7, 0.6 * baseNoise(vBasePos * 0.31 + 3.1) + 0.3 * baseMossD.b + 0.3 * (1.0 - smoothstep(0.1, 0.7, baseRelief.b))), smoothstep(0.03, 0.28, baseCover.r)) * (1.0 - baseWet) * baseSeat;
vec3 baseOlive = vec3(0.05, 0.075, 0.03) * mix(0.45, 1.6, baseMossD.b) * mix(0.7, 1.2, baseBlotch);
baseStone = mix(baseStone, baseOlive, 0.45 * baseFilm);
diffuseColor.rgb = mix(baseStone, baseGreen, baseMoss);
`

const ROCK_ROUGH = `
roughnessFactor = mix(mix(mix(0.84, 0.97, baseStoneD.b), 0.78, baseWet), 0.96, max(baseMoss, 0.8 * baseFilm));
metalnessFactor = 0.0;
`

const ROCK_TILT = `
vec2 baseTilt = baseSlope(baseRelief.rg) * (mix(1.5, 0.7, baseMoss) * baseSeat) + mix((baseSlope(baseStoneD.rg) * 2.0 + baseSlope(baseStoneF.rg).yx * 1.3) * mix(1.0, 0.75, baseWet), baseSlope(baseMossD.rg) * 2.8, baseMoss);
`

const ROCK_AFTER = `
${SHADE}
{
  ${LIGHTS}
  float liveFuzz = pow(abs(1.0 - liveNv), 2.2);
  float liveHigh = smoothstep(24.0, 33.0, vBasePos.y);
  float liveTuft = smoothstep(0.55, 0.85, baseMossD.b);
  float liveShade = mix(mix(0.5, 0.85, baseMoss), 1.25, liveOpen * mix(0.3, 1.0, max(liveHigh, smoothstep(0.1, 0.5, liveRimM))));
  vec3 liveKickDir = normalize(mat3(viewMatrix) * vec3(-0.85, 0.3, -0.3));
  float liveKick = clamp((dot(geometryNormal, liveKickDir) + 0.2) / 1.2, 0.0, 1.0);
  reflectedLight.indirectDiffuse *= mix(1.0, 0.75, baseMoss) * liveShade;
  reflectedLight.directDiffuse *= mix(1.0, liveShade, 0.92);
  reflectedLight.directDiffuse += diffuseColor.rgb * RECIPROCAL_PI * liveSunC * vec3(1.0, 0.82, 0.76) * (${ROCK.kick.toFixed(2)} * mix(0.4 + 1.2 * baseStoneD.b, (3.0 + 9.0 * liveTuft) * mix(0.3, 1.9, baseClump), baseMoss) * liveKick * liveKick * baseAo);
  // The dusk in the room is cool and comes from in front and above: it is what the stones and the moss in the base's own
  // shade are seen by, and it falls on each grain and tuft by the way that one faces, so the shade keeps its grain.
  float liveFill = clamp(dot(geometryNormal, normalize(mat3(viewMatrix) * vec3(-0.25, 0.62, 0.74))) * 0.6 + 0.4, 0.0, 1.0);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * RECIPROCAL_PI * mix(vec3(0.8, 1.0, 0.9), vec3(1.08, 0.96, 0.84), baseMoss * smoothstep(30.0, 38.0, vBasePos.y)) * dot(liveSunC, vec3(0.3333)) * (mix(${ROCK.fill.toFixed(2)}, ${ROCK.mossFill.toFixed(2)}, baseMoss) * mix(0.2 + 0.8 * liveFill * liveFill, (0.3 + 0.7 * liveFill * liveFill) * (mix(0.55, 0.85, smoothstep(30.0, 38.0, vBasePos.y)) + 0.9 * smoothstep(0.45, 0.85, baseMossD.b)) * mix(0.9, mix(2.0, 4.4, smoothstep(-45.0, 0.0, vBasePos.x)), smoothstep(30.0, 38.0, vBasePos.y)), baseMoss) * mix(0.25 + 0.75 * baseAo, 0.3 + 0.7 * baseAo, baseMoss) + mix(0.45, 1.0, baseMoss));
  // The low sun behind comes through the blossom and grazes the right flank: warm, and strongest on whatever stands out.
  vec3 liveGrazeDir = normalize(mat3(viewMatrix) * vec3(0.9, 0.25, -0.2));
  float liveGrazeM = clamp((dot(liveMacro, liveGrazeDir) + 0.14) / 1.14, 0.0, 1.0);
  // The mound's own body stands between the low sun and its front: only the side that looks toward the sun is reached.
  vec2 liveOut = vBasePos.xz;
  vec3 liveSide = dot(liveOut, liveOut) > 1e-6 ? normalize(normalMatrix * vec3(liveOut.x, 0.0, liveOut.y)) : geometryNormal;
  // Moss is a pile, not a skin: the low sun gets into it past the turn of each small fold.
  vec3 liveLean = mix(geometryNormal, liveMacro, 0.7 * baseMoss);
  vec3 liveSoft = dot(liveLean, liveLean) > 1e-6 ? normalize(liveLean) : geometryNormal;
  float liveReach = smoothstep(mix(0.2, -0.12, baseMoss * liveHigh), mix(0.55, 0.4, baseMoss * liveHigh), dot(liveSide, liveGrazeDir));
  float liveGraze = liveReach * liveGrazeM * liveGrazeM * mix(liveGrazeM, 1.0, 0.85 * baseMoss * liveHigh) * 1.25 * smoothstep(-0.2, 0.5, dot(liveSoft, liveGrazeDir)) * mix(0.8, 1.0, smoothstep(2.0, 16.0, vBasePos.y));
  // In the low sun the moss of the right flank is a crowd of round heads, each about half a millimetre, and the sun does not
  // reach between them: a slow pattern fixed to the stone, and gone before a head is narrower than two pixels.
  float liveSpan = max(length(dFdx(vBasePos)), length(dFdy(vBasePos)));
  float liveHeads = baseMoss * max(smoothstep(42.0, 50.0, vBasePos.x), smoothstep(30.0, 38.0, vBasePos.x) * smoothstep(37.0, 34.5, vBasePos.y)) * smoothstep(0.5, 0.25, liveSpan);
  float liveHead = baseNoise(vBasePos * 2.4 + 3.0);
  float liveBead = mix(1.0, mix(0.3, 1.0, smoothstep(0.3, 0.7, liveHead)), liveHeads);
  vec3 liveDry = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))) * mix(vec3(1.5, 1.1, 0.8), vec3(1.2, 1.5, 0.72), baseMoss), mix(0.9, 0.8, baseMoss));
  // The film's lens parts red from blue by a pixel at 3840, so a sunlit edge far over white grows a red and a blue line: the low sun rises to a warm cream and no further.
  vec3 liveLowSun = liveDry * RECIPROCAL_PI * liveSunC * vec3(1.0, 0.66, 0.5) * (${ROCK.flank.toFixed(2)} * liveGraze * mix((0.2 + 0.9 * baseStoneD.b) * mix(0.35, 1.8, baseStoneF.b), (1.0 + 1.2 * liveTuft) * mix(0.5, 1.9, baseClump) * 2.6 * smoothstep(0.1, 0.75, dot(liveSoft, liveGrazeDir)) * mix(1.0, mix(0.12, 3.5, smoothstep(0.45, 0.8, liveHead)), liveHeads), baseMoss) * baseAo);
  vec3 liveOver = liveLowSun / ${SUN_TOP};
  float liveBlade = mix(1.0, mix(0.5, 1.0, smoothstep(0.25, 0.85, baseMossD.b)), baseMoss);
  reflectedLight.directDiffuse += liveBlade * liveLowSun / pow(max(1.0 + abs(liveOver * liveOver * liveOver), 1.0), vec3(0.3333));
  // Stone that is never quite dry: a soft cool lustre off the room on every face that looks up or toward the camera.
  float liveDamp = (1.0 - baseMoss) * (1.0 - 0.7 * baseFilm) * (1.0 - 0.7 * baseWet) * baseAo;
  vec3 liveSkyDir = normalize(mat3(viewMatrix) * vec3(-0.2, 0.75, 0.6));
  reflectedLight.directSpecular += vec3(0.85, 0.92, 1.0) * dot(liveSunC, vec3(0.3333)) * (${ROCK.lustre.toFixed(2)} * (0.6 * pow(max(dot(geometryNormal, normalize(liveSkyDir + geometryViewDir)), 0.0), 26.0) + 0.15 * pow(max(dot(geometryNormal, normalize(liveSkyDir + geometryViewDir)), 0.0), 5.0)) * liveDamp * (0.4 + 0.6 * baseStoneD.b));
  // The cap is a cushion with a wall of its own: the light that comes over the glass falls on its crowns, and its face stays in the shade.
  float liveTop = smoothstep(0.3, 0.8, liveUpM);
  float liveCrown = smoothstep(34.0, 42.5, vBasePos.y) * mix(0.35, 1.0, liveUp) * liveTop;
  // The sun is behind and to the right, and the glass stands between it and the left of the collar.
  float liveEast = smoothstep(0.1, 0.8, vBasePos.x / 52.0);
  float liveLip = smoothstep(mix(39.4, 34.0, liveEast), mix(41.4, 38.5, liveEast), vBasePos.y) * mix(0.75, 1.1, smoothstep(0.35, 0.65, baseBlotch)) * mix(0.12, 1.0, liveTop);
  vec3 liveTip = mix(vec3(0.5, 0.43, 0.25), vec3(0.5, 0.42, 0.198), liveEast) * mix(0.07 + 0.3 * exp(-vBasePos.x * vBasePos.x / 400.0), 1.55, liveEast) * RECIPROCAL_PI * baseMoss * baseAo;
  vec3 liveCrest = liveTip * (liveKeyC * ((1.7 + 2.1 * liveTuft + 1.5 * liveFuzz) * mix(0.35, 2.0, baseClump) * (liveRim * liveRim * mix(0.15, 1.0, liveLip) + 2.2 * liveUp * liveUp * liveLip + mix(0.6, 0.08, liveEast) * liveCrown) * max(liveOpen * smoothstep(0.02, 0.4, liveRimM + 0.6 * liveUpM * liveHigh), liveCrown)) + uRigCardCol * (0.01 * liveCardWrap * liveCardWrap + 0.04 * liveFuzz * liveCardWrap));
  liveOver = liveCrest / ${SUN_TOP};
  reflectedLight.directDiffuse += liveBlade * liveCrest / pow(max(1.0 + abs(liveOver * liveOver * liveOver), 1.0), vec3(0.3333));
  reflectedLight.directDiffuse *= liveBead;
  // A grain of dew and the pixel it falls in are together no narrower than a cell and a fifth, with the same light in all.
  vec3 liveAt = vBasePos * 7.5;
  float liveWide = clamp((1.22 - max(length(dFdx(liveAt)), length(dFdy(liveAt)))) / 0.25, 1.0, 2.9);
  vec3 liveLow = floor(liveAt - 0.5);
  vec3 liveGrit = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec3 liveCell = liveLow + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    if (baseHash(liveCell) < 0.66) continue;
    float liveNear = 1.0 - smoothstep(0.08 * liveWide, 0.34 * liveWide, length(liveAt - liveCell - 0.5));
    if (liveNear <= 0.0) continue;
    vec3 liveFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.3 * (vec3(baseHash(liveCell + 3.7), baseHash(liveCell + 11.3), baseHash(liveCell + 23.9)) - 0.5)));
    float liveDew = pow(max(dot(liveFacet, normalize(liveKey + geometryViewDir)), 0.0), 120.0);
    float liveDewCard = pow(max(dot(liveFacet, normalize(liveCard + geometryViewDir)), 0.0), 120.0);
    float liveDewSun = pow(max(dot(liveFacet, normalize(liveGrazeDir + geometryViewDir)), 0.0), 40.0);
    liveGrit += liveNear * vec3(liveDew + 0.03 * pow(abs(liveDew), 0.2) * baseMoss, liveDewCard * 0.3 + 0.01 * pow(abs(liveDewCard), 0.2) * baseMoss, liveDewSun);
  }
  liveGrit /= liveWide * liveWide * liveWide;
  reflectedLight.directSpecular += mix(vec3(1.0), vec3(1.0, 0.82, 0.45), baseMoss) * (liveKeyC * liveGrit.x + uRigCardCol * liveGrit.y) * baseAo * mix(0.25 * baseWet, 1.0, max(baseMoss, 0.5 * baseFilm));
  // Dew on the moss that the low sun reaches: pinpoints, warm, only on the side it grazes.
  reflectedLight.directSpecular += vec3(1.0, 0.8, 0.55) * liveSunC * (2.5 * liveGrit.z * baseAo * baseMoss * smoothstep(0.0, 0.4, liveGrazeM));
  float liveF = 0.03 + 0.97 * pow(abs(1.0 - liveNv), 5.0);
  vec3 liveAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float liveSheet = baseWet * baseAo;
  reflectedLight.directSpecular += (liveKeyC * (1.2 * pow(abs(liveNh), 260.0) + 0.03 * pow(abs(liveNh), 30.0)) + uRigCardCol * (0.8 * pow(abs(liveCh), 200.0) + 0.025 * pow(abs(liveCh), 24.0))) * liveSheet;
  reflectedLight.indirectSpecular += (stageRoomLights(liveAway, 0.05) * 0.035 + stageRoomSoft(liveAway, 0.2) * 0.03) * min(liveF, 0.4) * liveSheet;
}
`

const GROWTH_PAINT = `
vec4 baseDetail = texture2D(uBaseDetail, vMapUv);
float baseBark = vBaseUv1.x;
// Where a root meets the table it stands in the film of water on it: dark, and shaded by its own foot.
float baseFoot = smoothstep(0.0, 2.6, vBasePos.y);
float baseAo = vBaseUv1.y * mix(0.2, 1.0, baseFoot);
vec3 baseWood = diffuseColor.rgb * vec3(0.25, 0.195, 0.155) * vBasePaint * mix(0.7, 1.15, baseDetail.b);
float baseRidge = 0.5 + 0.5 * sin(vMapUv.y * 37.7 + 5.0 * baseNoise(vBasePos * vec3(0.9, 0.35, 0.9)) + 4.0 * baseNoise(vBasePos * 2.3) + 2.0 * baseDetail.b);
float baseCrack = smoothstep(0.5, 0.2, baseDetail.b) * smoothstep(0.35, 0.0, baseRidge);
baseWood = mix(vec3(dot(baseWood, vec3(0.3, 0.5, 0.2))), baseWood, 0.7) * vec3(1.03, 1.0, 0.96) * mix(0.9, 1.05, baseRidge) * (1.0 - 0.35 * baseCrack);
vec3 baseCap = mix(vec3(dot(vBasePaint, vec3(0.3, 0.5, 0.2))) * vec3(1.08, 0.98, 0.86), vBasePaint, 0.6) * 0.58 * mix(0.7, 1.12, baseNoise(vBasePos * 3.1)) * mix(0.82, 1.05, baseNoise(vBasePos * 11.0));
// Moss lies on the backs of the roots in patches, as it lies on the stones beside them.
float baseRootMoss = baseBark * smoothstep(0.55, 0.95, vBaseUv1.y) * 0.4 * smoothstep(0.42, 0.7, 0.6 * baseNoise(vBasePos * 0.23 + 17.0) + 0.4 * baseNoise(vBasePos * 0.9 + 4.0));
baseWood = mix(baseWood, vec3(0.055, 0.095, 0.04) * mix(0.5, 1.5, baseDetail.b) * mix(0.6, 1.3, baseNoise(vBasePos * 1.3)), baseRootMoss);
diffuseColor.rgb = mix(baseCap, baseWood, baseBark) * mix(0.45, 1.0, baseFoot);
`

const GROWTH_ROUGH = `
roughnessFactor = mix(0.5, mix(0.62, 0.88, baseDetail.b), baseBark);
metalnessFactor = 0.0;
`

const GROWTH_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * (2.0 * baseBark) + vec2(0.0, 0.4 * cos(vMapUv.y * 37.7 + 5.0 * baseNoise(vBasePos * vec3(0.9, 0.35, 0.9)) + 4.0 * baseNoise(vBasePos * 2.3) + 2.0 * baseDetail.b) * baseBark);
`

const GROWTH_AFTER = `
${SHADE}
{
  ${LIGHTS}
  float liveShade = mix(0.22, 1.2, liveOpen);
  vec3 liveKickDir = normalize(mat3(viewMatrix) * vec3(-0.85, 0.3, -0.3));
  float liveKick = clamp((dot(geometryNormal, liveKickDir) + 0.2) / 1.2, 0.0, 1.0);
  reflectedLight.indirectDiffuse *= liveShade;
  reflectedLight.indirectDiffuse += diffuseColor.rgb * RECIPROCAL_PI * vec3(0.8, 1.0, 0.9) * dot(liveSunC, vec3(0.3333)) * (0.55 * baseBark);
  reflectedLight.directDiffuse *= mix(1.0, liveShade, 0.8);
  reflectedLight.directDiffuse += diffuseColor.rgb * RECIPROCAL_PI * liveKeyC * vec3(1.0, 0.8, 0.66) * ((mix(0.7, 0.8, baseBark) * liveRim * liveRim * liveOpen + mix(0.3, 0.25, baseBark) * liveKick * liveKick) * baseAo);
  // The same low warm sun that grazes the right flank of the stone catches the roots that stand out of it.
  vec3 liveGrazeDir = normalize(mat3(viewMatrix) * vec3(0.75, 0.55, -0.15));
  float liveGraze = clamp((dot(geometryNormal, liveGrazeDir) + 0.4) / 1.4, 0.0, 1.0);
  vec2 liveOut = vBasePos.xz;
  vec3 liveSide = dot(liveOut, liveOut) > 1e-6 ? normalize(normalMatrix * vec3(liveOut.x, 0.0, liveOut.y)) : geometryNormal;
  float liveGrazeM = clamp((dot(liveSide, liveGrazeDir) + 0.14) / 1.14, 0.0, 1.0);
  vec3 liveLowSun = diffuseColor.rgb * RECIPROCAL_PI * liveSunC * vec3(1.0, 0.78, 0.66) * (${ROCK.flank.toFixed(2)} * 2.4 * liveGraze * liveGraze * smoothstep(0.1, 0.7, liveGraze) * (0.008 + 1.25 * liveGrazeM * liveGrazeM) * smoothstep(0.2, 0.55, dot(liveSide, liveGrazeDir)) * mix(0.3, mix(0.5, 1.4, baseRidge * baseRidge) * mix(0.45, 1.45, baseDetail.b) * (1.0 - 0.6 * baseCrack), baseBark) * baseAo);
  vec3 liveOver = liveLowSun / ${SUN_TOP};
  reflectedLight.directDiffuse += liveLowSun / pow(max(1.0 + abs(liveOver * liveOver * liveOver), 1.0), vec3(0.3333));
  vec3 liveSkin = diffuseColor.rgb * RECIPROCAL_PI * (1.0 - baseBark) * baseAo;
  reflectedLight.directDiffuse += liveSkin * (liveKeyC * 0.1 * liveWrap * liveWrap + uRigCardCol * 0.12 * liveCardWrap * liveCardWrap) * mix(0.4, 1.0, liveOpen);
  reflectedLight.directSpecular += (liveKeyC * pow(abs(liveNh), 60.0) * 0.5 + uRigCardCol * pow(abs(liveCh), 50.0) * 0.4) * baseAo * mix(0.6, 0.1, baseBark);
}
`

type Shader = THREE.WebGLProgramParametersWithUniforms

interface Stages {
  pars?: string
  paint: string
  rough: string
  tilt: string
  after: string
}

function hookOf(uniforms: Record<string, THREE.IUniform>, at: Stages): (shader: Shader) => void {
  return (shader) => {
    Object.assign(shader.uniforms, roomUniforms, { uBaseFloor: waterUniforms.uWaterFloor, uWater: waterUniforms.uWater }, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}\n${at.pars ?? ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${at.paint}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${at.rough}`)
      .replace('#include <normal_fragment_maps>', `${at.tilt}\n${BEND}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${at.after}`)
  }
}

const WATER_VERT_PARS = `
attribute vec2 uv1;
varying vec3 vWaterN;
varying vec2 vWaterUv;
varying vec2 vWaterAt;
`

const WATER_VERT_MAIN = `
vWaterN = normalize(mat3(modelMatrix) * normal);
vWaterUv = uv;
vWaterAt = uv1;
`

const WATER_FRAG = `
uniform vec4 uWater;
uniform vec3 uWaterKeyDir;
uniform vec3 uWaterKeyCol;
uniform vec3 uWaterRimDir;
uniform vec3 uWaterRimCol;
uniform vec3 uWaterSky;
varying vec3 vWaterN;
varying vec2 vWaterUv;
varying vec2 vWaterAt;
${ROOM_GLSL}
${NOISE}
float waterStrand(float u, float mm, float at, float wide, float k) {
  float sway = at + 0.3 * (baseNoise(vec3(mm * 0.1, 2.0 + k, 5.0)) - 0.5) + 0.16 * (baseNoise(vec3(mm * 0.7, 9.0 + k, 1.0)) - 0.5);
  float w = wide * (0.55 + 0.9 * baseNoise(vec3(mm * 0.33, 4.0 + k, 8.0)));
  float x = abs(u - sway) / w;
  return max(1.0 - x * x, 0.0);
}
// One thread that sways as the stone under it turns, and here and there a second, thinner one beside it.
float waterBody(float u, float mm) {
  float a = waterStrand(u, mm, 0.0, 0.66, 0.0);
  float b = waterStrand(u, mm, 0.5, 0.13, 7.0) * smoothstep(0.5, 0.72, baseNoise(vec3(mm * 0.2, 1.0, 13.0)));
  return max(a, b);
}
float waterHeight(float u, float mm) {
  float run = uWater.y * ${FLOW.speedMm.toFixed(1)};
  float a = baseNoise(vec3(u * 1.7, (mm - run) * 0.4, 0.5));
  float b = baseNoise(vec3(u * 3.4 + 5.0, (mm - run * 1.4) * 1.05, 4.0));
  float c = baseNoise(vec3(u * 2.2 + 9.0, mm * 0.8, 2.0));
  float body = waterBody(u, mm);
  return sqrt(body) * (0.5 + 0.3 * a + 0.2 * b + 0.25 * c);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  float t = vWaterUv.y;
  float mm = vWaterAt.x;
  // The run is wide where the stone is flat under it and pinched where it drops between two stones.
  float u = (vWaterUv.x * 2.0 - 1.0) / mix(0.5, 1.0, smoothstep(0.2, 0.8, baseNoise(vec3(mm * 0.11, 21.0, 3.0))));
  float front = uWater.x;
  if (t > front || uWater.w <= 0.0) discard;
  float body = waterBody(u, mm);
  float head = front < 0.999 ? smoothstep(0.022, 0.0, front - t) * smoothstep(0.45, 0.85, body) : 0.0;
  float tip = front < 0.999 ? smoothstep(0.0, 0.012, front - t) : 1.0;
  body *= tip;
  if (body <= 0.002) discard;
  float e = 0.06;
  float h0 = waterHeight(u, mm);
  float hu = waterHeight(u + e, mm);
  float hm = waterHeight(u, mm + 0.12);
  vec3 n0 = dot(vWaterN, vWaterN) > 1e-8 ? normalize(vWaterN) : vec3(0.0, 1.0, 0.0);
  vec3 lean = abs(n0.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, -1.0);
  vec3 side = normalize(cross(lean, n0));
  vec3 up = cross(n0, side);
  vec3 n = normalize(n0 - side * ((hu - h0) / e) * 0.85 + up * ((hm - h0) / 0.12) * 0.22);
  vec3 v = normalize(cameraPosition - vStageWorld);
  float nv = clamp(dot(n, v), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(abs(1.0 - nv), 5.0);
  vec3 away = reflect(-v, n);
  vec3 mirror = stageRoom(away) + stageRoomLights(away, 0.02);
  float hk = max(dot(n, normalize(v + uWaterKeyDir)), 0.0);
  float hr = max(dot(n, normalize(v + uWaterRimDir)), 0.0);
  float hc = max(dot(n, normalize(v + uRigCardDir)), 0.0);
  vec3 col = mirror * min(fres, 0.3) * 0.11;
  col += uWaterKeyCol * (pow(abs(hk), 380.0) * 1.65 + pow(abs(hk), 40.0) * 0.01);
  col += uWaterRimCol * (pow(abs(hr), 260.0) * 0.68 + pow(abs(hr), 30.0) * 0.01);
  col += uRigCardCol * (pow(abs(hc), 300.0) * 0.68 + pow(abs(hc), 26.0) * 0.01);
  float run = uWater.y * ${FLOW.speedMm.toFixed(1)};
  float streak = smoothstep(0.52, 0.86, baseNoise(vec3(u * 2.6, (mm - run) * 0.3, 7.0)));
  float core = body * body;
  vec3 glow = (uWaterKeyCol * 0.5 + uRigCardCol * 0.3 + uWaterSky * 1.2) * RECIPROCAL_PI;
  float fine = smoothstep(0.58, 0.92, baseNoise(vec3(u * 9.0, (mm - run) * 0.14, 3.0))) * smoothstep(0.35, 0.7, baseNoise(vec3(u * 3.0, (mm - run) * 0.9, 11.0)));
  float foam = smoothstep(0.93, 1.0, front) * smoothstep(0.9, 1.0, t) * smoothstep(0.3, 0.75, baseNoise(vec3(u * 5.0, (mm - run) * 1.6, 17.0)));
  col += glow * vec3(0.86, 0.94, 1.0) * (body * 0.02 + core * (0.1 * streak + mix(0.6, 1.1, smoothstep(0.7, 0.97, t)) * fine + 0.9 * head + 0.6 * foam));
  float edge = smoothstep(0.0, 0.6, body);
  col *= edge * 1.15;
  col *= uWater.w;
  gl_FragColor = vec4(col, mix(0.06, 0.24, core) * edge * uWater.w);
  if (uDiag != 0) gl_FragColor = stageDiag(vec3(0.7, 0.8, 0.9), n, 0.0, c, 0.0);
}
`

interface WaterExtras {
  lengthMm: number
  foot: [number, number]
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
  const lit = { part: PART, standIn: false, change: 'base' }
  const rock = stageMaterial({
    ...lit,
    key: `${PART}-rock`,
    map: map('moss.srgb.tile.w512'),
    hook: hookOf(
      {
        uBaseDetail: { value: map('moss-detail.lin.tile.w512') },
        uBaseStone: { value: map('stone.srgb.tile.w512') },
        uBaseStoneDetail: { value: map('stone-detail.lin.tile.w512') },
        uBaseRelief: { value: map('relief.lin.w2048') },
        uBaseCover: { value: map('cover.lin.w2048') },
      },
      { pars: ROCK_PARS, paint: ROCK_PAINT, rough: ROCK_ROUGH, tilt: ROCK_TILT, after: ROCK_AFTER },
    ),
  })
  const growth = stageMaterial({
    ...lit,
    key: `${PART}-growth`,
    map: map('bark.srgb.tile.w512'),
    side: THREE.DoubleSide,
    hook: hookOf({ uBaseDetail: { value: map('bark-detail.lin.tile.w512') } }, { paint: GROWTH_PAINT, rough: GROWTH_ROUGH, tilt: GROWTH_TILT, after: GROWTH_AFTER }),
  })
  const waterGeometry = geometry(MODEL, 'water')
  const extras = waterGeometry.userData.extras as WaterExtras
  trickle.foot = [extras.foot[0], extras.foot[1]]
  trickle.lengthMm = extras.lengthMm
  waterUniforms.uWater.value.z = extras.lengthMm
  const water = stageShader({
    ...lit,
    vertexPars: WATER_VERT_PARS,
    vertexMain: WATER_VERT_MAIN,
    fragment: WATER_FRAG,
    params: { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor },
    uniforms: { ...roomUniforms, ...waterUniforms },
  })
  const stream = new THREE.Mesh(waterGeometry, water)
  stream.renderOrder = 3
  group.add(solid('rock', rock), solid('growth', growth), stream)
  return group
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  const u = waterUniforms
  u.uWaterKeyDir.value.copy(f.keyDir)
  u.uWaterKeyCol.value.copy(f.keyCol)
  u.uWaterRimDir.value.copy(f.rimDir)
  u.uWaterRimCol.value.copy(f.rimCol)
  u.uWaterSky.value.copy(f.sky).multiplyScalar(f.fill)
  const card = lightUniforms.uRigCardCol.value
  const lift = (0.3 / Math.PI) * Math.max(lightUniforms.uRigCardDir.value.y, 0)
  const down = (0.3 / Math.PI) * Math.max(f.keyDir.y, 0)
  u.uWaterFloor.value.setRGB(f.keyCol.r * down + card.r * lift, f.keyCol.g * down + card.g * lift, f.keyCol.b * down + card.b * lift)
  const swap = config.shake.swapWindow
  const shaking = moment.beat !== null && moment.beat >= swap.fromBeat
  const two = f.from !== f.to && f.change > 0 && f.change < 1
  let front = flowFront(moment.sinceLanding)
  let strength = 1
  if (two) {
    if (shaking && moment.arrived < 1) front = 0
  } else if (shaking) {
    const through = (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat)
    if (through >= 1) front = 0
    else strength = 1 - Math.min(1, partChange('shed', through) / FLOW.leaveLead)
  }
  u.uWater.value.x = front
  u.uWater.value.y = moment.time
  u.uWater.value.w = strength
}
