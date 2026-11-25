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

const LIGHTS = `
  vec3 liveKey = vec3(0.0, 1.0, 0.0);
  vec3 liveKeyC = vec3(0.0);
  #ifdef STAGE_LIGHT_DONE
  liveKey = stageKeyL;
  liveKeyC = stageKeyC * stageKeyS;
  #elif NUM_DIR_LIGHTS > 0
  liveKey = directionalLights[0].direction;
  liveKeyC = directionalLights[0].color;
  #endif
  vec3 liveCard = normalize(mat3(viewMatrix) * uRigCardDir);
  float liveNv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float liveNh = max(dot(geometryNormal, normalize(liveKey + geometryViewDir)), 0.0);
  float liveCh = max(dot(geometryNormal, normalize(liveCard + geometryViewDir)), 0.0);
  float liveWrap = clamp(dot(geometryNormal, liveKey) * 0.5 + 0.5, 0.0, 1.0);
  float liveCardWrap = clamp(dot(geometryNormal, liveCard) * 0.5 + 0.5, 0.0, 1.0);
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
vec2 baseStoneUv = vMapUv * 0.5;
vec3 baseStoneC = texture2D(uBaseStone, baseStoneUv).rgb;
vec4 baseStoneD = texture2D(uBaseStoneDetail, baseStoneUv);
float baseSeat = vBasePaint.x;
float baseMoss = mix(1.0, smoothstep(0.3, 0.62, baseCover.r + 0.3 * (baseMossD.b - 0.5)), baseSeat);
float baseRun = smoothstep(uWater.x + 0.015, uWater.x - 0.015, baseCover.b);
float baseWet = baseCover.g * mix(1.0, baseRun * uWater.w, step(baseCover.b, 0.99)) * (1.0 - baseMoss);
float baseAo = mix(0.3, mix(smoothstep(-0.25, 0.5, baseRelief.b), smoothstep(0.08, 0.72, baseRelief.b), baseMoss), baseSeat);
float baseBlotch = baseNoise(vBasePos * 0.19) * 0.6 + baseNoise(vBasePos * 0.8) * 0.4;
float baseSun = baseNoise(vBasePos * 0.45 + 7.3);
vec3 baseStone = baseStoneC * vec3(1.25, 0.9, 0.66) * mix(0.55, 1.3, baseBlotch) * mix(0.7, 1.15, baseStoneD.b);
baseStone = mix(baseStone, baseStone * vec3(0.6, 0.62, 0.66), baseWet);
vec3 baseGreen = diffuseColor.rgb * mix(vec3(0.36, 0.38, 0.36), vec3(1.2, 0.86, 0.3), smoothstep(0.3, 0.75, baseSun) * (0.35 + 0.65 * baseMossD.b));
baseGreen *= mix(0.22, 1.7, smoothstep(0.15, 0.85, baseMossD.b)) * mix(0.6, 1.1, baseBlotch);
baseGreen = mix(baseGreen, vec3(0.03, 0.035, 0.012), 0.45 * (1.0 - smoothstep(0.1, 0.6, baseRelief.b)));
diffuseColor.rgb = mix(baseStone, baseGreen, baseMoss);
`

const ROCK_ROUGH = `
roughnessFactor = mix(mix(mix(0.7, 0.93, baseStoneD.b), 0.3, baseWet), 0.96, baseMoss);
metalnessFactor = 0.0;
`

const ROCK_TILT = `
vec2 baseTilt = baseSlope(baseRelief.rg) * (1.15 * baseSeat) + mix(baseSlope(baseStoneD.rg) * mix(0.75, 0.25, baseWet), baseSlope(baseMossD.rg) * 1.5, baseMoss);
`

const ROCK_AFTER = `
${SHADE}
{
  ${LIGHTS}
  float liveFuzz = pow(1.0 - liveNv, 2.2);
  vec3 liveTip = vec3(0.5, 0.55, 0.08) * RECIPROCAL_PI * baseMoss * baseAo;
  reflectedLight.directDiffuse += liveTip * (liveKeyC * (0.22 * liveWrap * liveWrap + 0.55 * liveFuzz * liveWrap) + uRigCardCol * (0.1 * liveCardWrap * liveCardWrap + 0.5 * liveFuzz * liveCardWrap));
  vec3 liveCell = floor(vBasePos * 5.5);
  vec3 liveFacet = normalize(normalMatrix * normalize(baseObjectNormal + 1.3 * (vec3(baseHash(liveCell + 3.7), baseHash(liveCell + 11.3), baseHash(liveCell + 23.9)) - 0.5)));
  float liveGrit = smoothstep(0.42, 0.08, length(fract(vBasePos * 5.5) - 0.5)) * step(0.62, baseHash(liveCell));
  float liveDew = pow(max(dot(liveFacet, normalize(liveKey + geometryViewDir)), 0.0), 120.0);
  float liveDewCard = pow(max(dot(liveFacet, normalize(liveCard + geometryViewDir)), 0.0), 120.0);
  reflectedLight.directSpecular += (liveKeyC * liveDew * 2.2 + uRigCardCol * liveDewCard * 1.6) * liveGrit * baseAo * mix(0.25 * baseWet, 1.0, baseMoss);
  float liveF = 0.03 + 0.97 * pow(1.0 - liveNv, 5.0);
  vec3 liveAway = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float liveSheet = baseWet * baseAo;
  reflectedLight.directSpecular += (liveKeyC * (4.0 * pow(liveNh, 260.0) + 0.25 * pow(liveNh, 30.0)) + uRigCardCol * (2.4 * pow(liveCh, 200.0) + 0.2 * pow(liveCh, 24.0))) * liveSheet;
  reflectedLight.indirectSpecular += (stageRoomLights(liveAway, 0.05) * 0.6 + stageRoomSoft(liveAway, 0.2) * 0.5) * min(liveF, 0.4) * liveSheet;
}
`

const GROWTH_PAINT = `
vec4 baseDetail = texture2D(uBaseDetail, vMapUv);
float baseBark = vBaseUv1.x;
float baseAo = vBaseUv1.y;
vec3 baseWood = diffuseColor.rgb * vec3(1.05, 0.9, 0.76) * vBasePaint * mix(0.55, 1.25, baseDetail.b);
diffuseColor.rgb = mix(vBasePaint, baseWood, baseBark);
`

const GROWTH_ROUGH = `
roughnessFactor = mix(0.5, mix(0.62, 0.88, baseDetail.b), baseBark);
metalnessFactor = 0.0;
`

const GROWTH_TILT = `
vec2 baseTilt = baseSlope(baseDetail.rg) * (1.1 * baseBark);
`

const GROWTH_AFTER = `
${SHADE}
{
  ${LIGHTS}
  vec3 liveSkin = diffuseColor.rgb * RECIPROCAL_PI * (1.0 - baseBark) * baseAo;
  reflectedLight.directDiffuse += liveSkin * (liveKeyC * 0.45 * liveWrap * liveWrap + uRigCardCol * 0.6 * liveCardWrap * liveCardWrap);
  reflectedLight.directSpecular += (liveKeyC * pow(liveNh, 60.0) * 0.5 + uRigCardCol * pow(liveCh, 50.0) * 0.4) * baseAo * mix(0.6, 0.25, baseBark);
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
float waterBody(float u, float mm) {
  float sway = 0.34 * (baseNoise(vec3(mm * 0.16, 2.0, 5.0)) - 0.5) + 0.12 * (baseNoise(vec3(mm * 0.7, 9.0, 1.0)) - 0.5);
  float wide = 0.5 + 0.2 * (baseNoise(vec3(mm * 0.33, 4.0, 8.0)) - 0.5);
  float x = abs(u - sway) / wide;
  return max(1.0 - x * x, 0.0);
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
  float u = vWaterUv.x * 2.0 - 1.0;
  float t = vWaterUv.y;
  float mm = vWaterAt.x;
  float front = uWater.x;
  if (t > front || uWater.w <= 0.0) discard;
  float body = waterBody(u, mm);
  float head = front < 0.999 ? smoothstep(0.05, 0.0, front - t) : 0.0;
  float tip = front < 0.999 ? smoothstep(0.0, 0.012, front - t) : 1.0;
  body *= tip;
  if (body <= 0.002) discard;
  float e = 0.06;
  float h0 = waterHeight(u, mm);
  float hu = waterHeight(u + e, mm);
  float hm = waterHeight(u, mm + 0.12);
  vec3 n0 = normalize(vWaterN);
  vec3 up = normalize(vec3(0.0, 1.0, 0.0) - n0 * n0.y + vec3(0.0, 1e-4, 0.0));
  vec3 side = normalize(cross(up, n0));
  vec3 n = normalize(n0 - side * ((hu - h0) / e) * 0.85 + up * ((hm - h0) / 0.12) * 0.22);
  vec3 v = normalize(cameraPosition - vStageWorld);
  float nv = clamp(dot(n, v), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  vec3 away = reflect(-v, n);
  vec3 mirror = stageRoom(away) + stageRoomLights(away, 0.02);
  float hk = max(dot(n, normalize(v + uWaterKeyDir)), 0.0);
  float hr = max(dot(n, normalize(v + uWaterRimDir)), 0.0);
  float hc = max(dot(n, normalize(v + uRigCardDir)), 0.0);
  vec3 col = mirror * fres;
  col += uWaterKeyCol * (pow(hk, 380.0) * 9.0 + pow(hk, 40.0) * 0.12);
  col += uWaterRimCol * (pow(hr, 260.0) * 5.0 + pow(hr, 30.0) * 0.1);
  col += uRigCardCol * (pow(hc, 300.0) * 5.0 + pow(hc, 26.0) * 0.14);
  float run = uWater.y * ${FLOW.speedMm.toFixed(1)};
  float streak = smoothstep(0.52, 0.86, baseNoise(vec3(u * 2.6, (mm - run) * 0.3, 7.0)));
  float core = body * body;
  vec3 glow = (uWaterKeyCol * 0.5 + uRigCardCol * 0.3 + uWaterSky * 1.2) * RECIPROCAL_PI;
  float rimline = smoothstep(0.55, 0.12, body) * smoothstep(0.0, 0.12, body);
  col += glow * (body * 0.1 + core * (0.9 * streak + 3.0 * head) + 0.8 * rimline * (0.4 + 0.6 * h0));
  vec3 cell = floor(vec3(u * 3.0, (mm - run) * 0.9, 1.0));
  float spark = step(0.9, baseHash(cell + 5.0)) * smoothstep(0.5, 0.1, length(fract(vec2(u * 3.0, (mm - run) * 0.9)) - 0.5));
  col += (uWaterKeyCol + uRigCardCol) * 0.9 * spark * core;
  float edge = smoothstep(0.0, 0.3, body);
  col *= edge * uWater.w;
  gl_FragColor = vec4(col, 0.18 * edge * uWater.w);
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
    map: map('moss.srgb.tile.w1024'),
    hook: hookOf(
      {
        uBaseDetail: { value: map('moss-detail.lin.tile.w1024') },
        uBaseStone: { value: map('stone.srgb.tile.w1024') },
        uBaseStoneDetail: { value: map('stone-detail.lin.tile.w1024') },
        uBaseRelief: { value: map('relief.lin.w2048') },
        uBaseCover: { value: map('cover.lin.w2048') },
      },
      { pars: ROCK_PARS, paint: ROCK_PAINT, rough: ROCK_ROUGH, tilt: ROCK_TILT, after: ROCK_AFTER },
    ),
  })
  const growth = stageMaterial({
    ...lit,
    key: `${PART}-growth`,
    map: map('bark.srgb.tile.w1024'),
    side: THREE.DoubleSide,
    hook: hookOf({ uBaseDetail: { value: map('bark-detail.lin.tile.w1024') } }, { paint: GROWTH_PAINT, rough: GROWTH_ROUGH, tilt: GROWTH_TILT, after: GROWTH_AFTER }),
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
    else strength = 1 - Math.min(1, partChange('base', through) / FLOW.leaveLead)
  }
  u.uWater.value.x = front
  u.uWater.value.y = moment.time
  u.uWater.value.w = strength
}
