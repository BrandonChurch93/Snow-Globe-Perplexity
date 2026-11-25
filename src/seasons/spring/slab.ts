import * as THREE from 'three'
import { stageShader } from '../../core/materials'
import { stream } from '../../core/rng'
import { texture } from '../../core/textures'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { SLAB_LIGHT_GLSL, slabLightUniforms, surfaceUniforms } from '../../scene/surface'
import type { Dressing, KitMoment } from '../kit'
import { FLOW, waterUniforms } from './base'

export const standIns: string[] = []

const PART = 'surface-dressing-spring'
const ATLAS = 'spring/slab-petals.srgb.w1024.png'
const FAR = 'spring/slab-far.srgb.w2048.png'
const FAR_HALF_MM = 520

export const surfaceDressing: Dressing & { reachMm: number } = { tint: [1, 0.7, 0.8], amount: 0, reachMm: 240 }

export const PETALS = { count: 300, nearMm: 63, farMm: 240, sizeMm: [5, 9.4], clumpMm: 46, wetShare: 0.2, focusMm: 60, far: [70, 330], near: [4, 80], farMips: 3.2, nearMips: 4.2 }
export const JUMP = { reachMm: 60, shockMmPerSecond: 1500, heightMm: 15, flight: [0.34, 0.8], shiftMm: 9, rise: 0.5, floor: 0.1 }
export const POOL = { radiusMm: 15, outMm: 8.5, fillSeconds: 5 }

const veil = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const

const uniforms = {
  uPetals: { value: null as THREE.Texture | null },
  uFar: { value: null as THREE.Texture | null },
  uJump: { value: new THREE.Vector4(1e3, 0, 0, 0) },
  uPoolAt: { value: new THREE.Vector4(0, 0, POOL.radiusMm, 1) },
  uPoolIn: { value: new THREE.Vector4(0, 0, 0, 1) },
  uKeyCol: surfaceUniforms.uKeyCol,
  uRimCol: surfaceUniforms.uRimCol,
  uSky: surfaceUniforms.uSky,
  ...slabLightUniforms,
}

const LIGHT = `
uniform vec3 uKeyCol;
uniform vec3 uRimCol;
uniform vec3 uSky;
${SLAB_LIGHT_GLSL}
vec3 petalLight(vec3 n, vec3 P, vec3 v, vec3 albedo, float wet) {
  vec3 keyDir;
  vec3 rimDir;
  vec3 warm;
  float keyGain;
  float rimGain;
  float occl;
  slabLight(P, keyDir, keyGain, rimDir, rimGain, occl, warm);
  float key = clamp(dot(n, keyDir) * 0.62 + 0.38, 0.0, 1.0);
  float rim = clamp(dot(n, rimDir) * 0.6 + 0.4, 0.0, 1.0);
  float card = clamp(dot(n, uRigCardDir) * 0.6 + 0.4, 0.0, 1.0);
  vec3 lit = uKeyCol * (key * keyGain) + uRimCol * (rim * rimGain) + uRigCardCol * (0.35 * card * occl) + (uSky * (0.55 + 0.45 * n.y) + warm) * occl;
  vec3 col = albedo * mix(1.0, 0.62, wet) * RECIPROCAL_PI * lit;
  float hk = max(dot(n, normalize(v + keyDir)), 0.0);
  float hr = max(dot(n, normalize(v + rimDir)), 0.0);
  float hc = max(dot(n, normalize(v + uRigCardDir)), 0.0);
  col += uKeyCol * keyGain * (mix(0.02, 0.0, wet) * pow(hk, 14.0) + wet * 0.9 * pow(hk, 120.0));
  col += uRimCol * rimGain * (0.03 * pow(hr, 12.0) + wet * 1.2 * pow(hr, 90.0));
  col += uRigCardCol * occl * (0.03 * pow(hc, 10.0) + wet * 0.8 * pow(hc, 90.0));
  return col;
}
`

const BLUR = `
float petalBlur(vec3 P) {
  float away = length(P - cameraPosition) - (length(vec3(uFoot.x, 0.0, uFoot.y) - cameraPosition) - ${PETALS.focusMm.toFixed(1)});
  return max(${PETALS.farMips.toFixed(2)} * smoothstep(${PETALS.far[0].toFixed(1)}, ${PETALS.far[1].toFixed(1)}, away), ${PETALS.nearMips.toFixed(2)} * smoothstep(${PETALS.near[0].toFixed(1)}, ${PETALS.near[1].toFixed(1)}, -away));
}
`

const PETAL_VERT_PARS = `
attribute vec4 aRest;
attribute vec4 aKind;
attribute vec4 aShape;
uniform vec4 uJump;
uniform vec4 uFoot;
varying vec3 vPetalN;
varying vec2 vPetalUv;
varying vec4 vPetalKind;
varying float vPetalSoft;
varying float vPetalBlur;
${BLUR}
mat3 petalTurn(vec3 axis, float a) {
  float s = sin(a);
  float c = cos(a);
  float o = 1.0 - c;
  return mat3(
    o * axis.x * axis.x + c, o * axis.x * axis.y + axis.z * s, o * axis.z * axis.x - axis.y * s,
    o * axis.x * axis.y - axis.z * s, o * axis.y * axis.y + c, o * axis.y * axis.z + axis.x * s,
    o * axis.z * axis.x + axis.y * s, o * axis.y * axis.z - axis.x * s, o * axis.z * axis.z + c);
}
`

const PETAL_VERT_MAIN = `
float petalSize = aRest.w;
float petalHaze = petalBlur(vec3(aRest.x, 0.0, aRest.y));
float petalPad = 1.0 + ${(2 * 0.045).toFixed(3)} * petalHaze;
vec2 petalQ2 = position.xy * petalPad;
vec2 petalOut = aRest.xy - uFoot.xy;
float petalFar = length(petalOut);
float petalGap = max(petalFar - uFoot.z, 0.0);
float petalKick = max(exp(-petalGap / ${JUMP.reachMm.toFixed(1)}), ${JUMP.floor.toFixed(2)}) * (0.5 + 0.5 * aKind.z);
float petalWait = petalGap / ${JUMP.shockMmPerSecond.toFixed(1)} + 0.03 * aKind.w;
float petalFlight = mix(${JUMP.flight[0].toFixed(3)}, ${JUMP.flight[1].toFixed(3)}, petalKick) * (0.8 + 0.4 * aKind.w);
float petalQ = clamp((uJump.x - petalWait) / petalFlight, 0.0, 1.0);
float petalArc = sin(3.14159265 * pow(petalQ, ${JUMP.rise.toFixed(2)}));
float petalEase = 1.0 - (1.0 - petalQ) * (1.0 - petalQ);
float petalUp = ${JUMP.heightMm.toFixed(1)} * petalKick * petalArc;
float petalFlips = floor(aKind.z * 2.99) * step(0.25, petalKick);
float petalRoll = 3.14159265 * petalFlips * (1.0 - petalEase) + 0.9 * petalKick * petalArc * (aKind.w - 0.5);
float petalYaw = aRest.z + (aKind.w - 0.5) * 2.6 * petalKick * (1.0 - petalEase);
vec2 petalAt = aRest.xy - (petalOut / max(petalFar, 1.0)) * (${JUMP.shiftMm.toFixed(1)} * petalKick * (0.4 + 0.6 * aKind.z) * (1.0 - petalEase));
float petalFlat = 1.0 - 0.6 * aKind.y;
vec3 petalP = vec3(petalQ2.x, 0.0, petalQ2.y) * petalSize;
float petalAcross = petalQ2.y * 2.0 * aShape.w;
petalP.y = petalSize * petalFlat * (aShape.x * petalAcross * petalAcross + aShape.y * petalQ2.x * petalQ2.x * 1.4 + aShape.z * petalQ2.x * petalQ2.y * 1.6) + 0.12;
vec3 petalN = normalize(vec3(-petalFlat * (2.8 * aShape.y * petalQ2.x + 1.6 * aShape.z * petalQ2.y), 1.0, -petalFlat * (8.0 * aShape.x * aShape.w * aShape.w * petalQ2.y + 1.6 * aShape.z * petalQ2.x)));
mat3 petalSpin = petalTurn(vec3(0.0, 1.0, 0.0), petalYaw) * petalTurn(normalize(vec3(1.0, 0.0, 0.35)), petalRoll);
vec3 petalLow = vec3(0.0, petalSize * petalFlat * aShape.y * 0.35, 0.0);
petalP = petalSpin * (petalP - petalLow) + petalLow;
petalP += vec3(petalAt.x, petalUp + 0.45 * petalSize * abs(sin(petalRoll)), petalAt.y);
vec4 petalW = modelMatrix * vec4(petalP, 1.0);
vec4 petalV = viewMatrix * petalW;
gl_Position = projectionMatrix * petalV;
vStageWorld = petalW.xyz;
vStageLocal = (uGlobeInv * petalW).xyz;
vStageAux = vec3(0.0, -petalV.z, length(petalV.xyz));
vStagePlaced = petalW.xyz;
vPetalN = normalize(mat3(modelMatrix) * (petalSpin * petalN));
vPetalUv = (uv - 0.5) * petalPad + 0.5;
vPetalBlur = petalHaze;
vPetalKind = aKind;
vPetalSoft = petalArc * petalKick;
`

const PETAL_FRAG = `
${ROOM_GLSL}
uniform sampler2D uPetals;
varying vec3 vPetalN;
varying vec2 vPetalUv;
varying vec4 vPetalKind;
varying float vPetalSoft;
varying float vPetalBlur;
${LIGHT}
${BLUR}
vec4 petalTap(vec2 cell, vec2 at, float bias) {
  float inside = step(0.0, at.x) * step(at.x, 1.0) * step(0.0, at.y) * step(at.y, 1.0);
  vec4 t = texture2D(uPetals, (cell + clamp(at, 0.02, 0.98)) / vec2(4.0, 3.0), bias);
  return vec4(t.rgb, 1.0) * (t.a * inside);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  float id = floor(vPetalKind.x + 0.5);
  vec2 cell = vec2(mod(id, 4.0), floor(id / 4.0));
  float soft = vPetalBlur;
  float bias = min(soft, 1.5);
  float reach = 0.042 * soft;
  vec4 sum = petalTap(cell, vPetalUv, bias);
  for (int i = 0; i < 8; i++) {
    float turn = 0.785398 * float(i);
    vec2 ray = vec2(cos(turn), sin(turn));
    sum += petalTap(cell, vPetalUv + ray * reach, bias);
    sum += petalTap(cell, vPetalUv + ray.yx * vec2(-0.55, 0.55) * reach, bias);
  }
  vec4 tex = vec4(sum.rgb / max(sum.a, 1e-4), sum.a / 17.0);
  float alpha = mix(smoothstep(0.38, 0.62, tex.a), tex.a, clamp(soft * 1.5, 0.0, 1.0));
  if (alpha <= 0.004) discard;
  vec3 n = normalize(vPetalN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vStageWorld);
  float wet = vPetalKind.y;
  vec3 albedo = pow(tex.rgb, vec3(1.0 + 0.5 * wet));
  albedo = min(mix(albedo, vec3(dot(albedo, vec3(0.4, 0.4, 0.2))) * vec3(0.96, 0.9, 0.97), 0.72) * 1.25, vec3(0.92));
  vec3 col = petalLight(n, vStageWorld, v, albedo, wet);
  float thin = pow(1.0 - abs(dot(n, v)), 2.0);
  col += albedo * RECIPROCAL_PI * (uRimCol + uRigCardCol) * 0.25 * thin;
  gl_FragColor = vec4(col * alpha, alpha);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, n, 0.0, c, 0.0);
}
`

const FAR_FRAG = `
${ROOM_GLSL}
uniform sampler2D uFar;
${LIGHT}
${BLUR}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  vec2 uv = vStageWorld.xz / ${(2 * FAR_HALF_MM).toFixed(1)} + 0.5;
  float soft = petalBlur(vStageWorld);
  vec4 tex = texture2D(uFar, uv, 0.6 * soft);
  float alpha = tex.a * 0.95;
  if (alpha <= 0.004) discard;
  vec3 v = normalize(cameraPosition - vStageWorld);
  vec3 albedo = min(mix(tex.rgb, vec3(dot(tex.rgb, vec3(0.4, 0.4, 0.2))) * vec3(0.96, 0.9, 0.97), 0.72) * 1.25, vec3(0.92));
  vec3 col = petalLight(vec3(0.0, 1.0, 0.0), vStageWorld, v, albedo, 0.0);
  gl_FragColor = vec4(col * alpha, alpha);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, vec3(0.0, 1.0, 0.0), 0.0, c, 0.0);
}
`

const POOL_FRAG = `
${ROOM_GLSL}
uniform vec4 uPoolAt;
uniform vec4 uPoolIn;
uniform vec4 uWater;
${LIGHT}
float poolHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float poolNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(poolHash(i), poolHash(i + vec2(1.0, 0.0)), f.x), mix(poolHash(i + vec2(0.0, 1.0)), poolHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  float fill = uPoolAt.w;
  if (fill <= 0.0) discard;
  vec2 p = vStageWorld.xz - uPoolAt.xy;
  float far = length(p);
  vec2 dir = p / max(far, 1e-3);
  float lobes = 0.62 + 0.5 * poolNoise(dir * 1.4 + 3.0) + 0.22 * poolNoise(dir * 3.7 + 9.0) + 0.1 * poolNoise(p * 0.5);
  float reach = uPoolAt.z * lobes * (0.25 + 0.75 * fill);
  float d = far - reach;
  float body = smoothstep(0.0, -0.9, d);
  if (body <= 0.0) discard;
  float lip = smoothstep(-2.2, -0.2, d) * body;
  vec2 e = vStageWorld.xz - uPoolIn.xy;
  float re = length(e);
  float live = uPoolIn.w;
  float wave = live * exp(-re / 13.0) * 0.8;
  float phase = re * 1.9 - uPoolIn.z * 8.5;
  vec2 grad = dir * (0.9 * lip) + (e / max(re, 1e-3)) * (wave * cos(phase)) + 0.1 * live * vec2(poolNoise(p * 1.1 + uPoolIn.z * 0.6) - 0.5, poolNoise(p * 1.1 + 7.0 - uPoolIn.z * 0.5) - 0.5);
  vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
  vec3 v = normalize(cameraPosition - vStageWorld);
  vec3 keyDir;
  vec3 rimDir;
  vec3 warm;
  float keyGain;
  float rimGain;
  float occl;
  slabLight(vStageWorld, keyDir, keyGain, rimDir, rimGain, occl, warm);
  float tilt = clamp(length(grad) * 1.6, 0.0, 1.0);
  vec3 away = reflect(-v, n);
  away.y = abs(away.y);
  vec3 col = (stageRoom(away) + stageRoomLights(away, 0.02)) * (0.55 * tilt);
  float hk = max(dot(n, normalize(v + keyDir)), 0.0);
  float hr = max(dot(n, normalize(v + rimDir)), 0.0);
  float hc = max(dot(n, normalize(v + uRigCardDir)), 0.0);
  col += uKeyCol * keyGain * (5.0 * pow(hk, 300.0) + 0.1 * pow(hk, 30.0) * tilt);
  col += uRimCol * rimGain * (6.0 * pow(hr, 220.0) + 0.25 * pow(hr, 24.0) * tilt);
  col += uRigCardCol * (4.0 * pow(hc, 220.0) + 0.2 * pow(hc, 24.0) * tilt);
  col += (uSky + warm) * RECIPROCAL_PI * 0.5 * lip * occl;
  col *= body * uWater.w;
  gl_FragColor = vec4(col, 0.22 * body * uWater.w);
  if (uDiag != 0) gl_FragColor = stageDiag(vec3(0.6, 0.7, 0.8), n, 0.0, c, 0.0);
}
`

export async function prepare(): Promise<void> {}

let surface: THREE.Object3D | null = null
let puddle: THREE.Mesh | null = null

function lattice(i: number, j: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function clump(x: number, z: number): number {
  const u = x / PETALS.clumpMm + 31.5
  const v = z / PETALS.clumpMm + 17.5
  const i = Math.floor(u)
  const j = Math.floor(v)
  const fu = (u - i) * (u - i) * (3 - 2 * (u - i))
  const fv = (v - j) * (v - j) * (3 - 2 * (v - j))
  const low = lattice(i, j) * (1 - fu) + lattice(i + 1, j) * fu
  const high = lattice(i, j + 1) * (1 - fu) + lattice(i + 1, j + 1) * fu
  const n = low * (1 - fv) + high * fv
  const t = Math.min(1, Math.max(0, (n - 0.36) / 0.34))
  return t * t * (3 - 2 * t)
}

function petalGeometry(): THREE.InstancedBufferGeometry {
  const plane = new THREE.PlaneGeometry(1, 1, 8, 6)
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', plane.getAttribute('position'))
  g.setAttribute('normal', plane.getAttribute('normal'))
  g.setAttribute('uv', plane.getAttribute('uv'))
  g.setIndex(plane.getIndex())
  const rng = stream(`${PART}/petals`)
  const rest: number[] = []
  const kind: number[] = []
  const shape: number[] = []
  const dry = [0, 1, 2, 5, 7, 10, 3, 0, 1, 2, 5, 7, 10, 4, 8]
  const wet = [6, 9, 11]
  const aspect = [1.371, 1.493, 1.597, 1.532, 1.397, 1.656, 1.477, 1.506, 1.391, 1.475, 1.409, 1.611]
  let placed = 0
  let guard = 0
  while (placed < PETALS.count && guard++ < 20000) {
    const a = rng.range(0, Math.PI * 2)
    const r = PETALS.nearMm + (PETALS.farMm - PETALS.nearMm) * Math.pow(rng.next(), 1.7)
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (z < -150 && rng.next() < 0.5) continue
    if (rng.next() > (0.14 + 0.86 * clump(x, z)) * (z > 0 && Math.abs(x) < 45 ? 0.45 : 1)) continue
    const soaked = rng.next() < PETALS.wetShare + 0.25 * Math.exp(-(r - PETALS.nearMm) / 30) ? 1 : 0
    const list = soaked ? wet : dry
    const id = list[Math.floor(rng.next() * list.length) % list.length]!
    rest.push(x, z, rng.range(0, Math.PI * 2), rng.range(PETALS.sizeMm[0], PETALS.sizeMm[1]))
    kind.push(id, soaked, rng.next(), rng.next())
    shape.push(rng.range(0.05, 0.3), rng.range(0.0, 0.16), rng.range(-0.12, 0.12), aspect[id]!)
    placed++
  }
  g.setAttribute('aRest', new THREE.InstancedBufferAttribute(new Float32Array(rest), 4))
  g.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(kind), 4))
  g.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(shape), 4))
  g.instanceCount = placed
  return g
}

function makeSurface(): THREE.Group {
  uniforms.uPetals.value = texture(ATLAS)
  uniforms.uFar.value = texture(FAR)
  const shared = { ...roomUniforms, ...uniforms, uWater: waterUniforms.uWater }
  const lit = { part: PART, standIn: false, change: 'surface-dressing' }
  const petals = new THREE.Mesh(
    petalGeometry(),
    stageShader({ ...lit, textured: true, texels: 512, uniforms: shared, vertexPars: PETAL_VERT_PARS, vertexMain: PETAL_VERT_MAIN, fragment: PETAL_FRAG, params: { ...veil, side: THREE.DoubleSide } }),
  )
  petals.frustumCulled = false
  petals.renderOrder = 4
  const far = new THREE.Mesh(new THREE.PlaneGeometry(2 * FAR_HALF_MM, 2 * FAR_HALF_MM), stageShader({ ...lit, textured: true, texels: 2048, uniforms: shared, fragment: FAR_FRAG, params: { ...veil } }))
  far.rotation.x = -Math.PI / 2
  far.position.y = 0.05
  far.frustumCulled = false
  far.renderOrder = 2
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.4 * POOL.radiusMm, 4.4 * POOL.radiusMm), stageShader({ ...lit, uniforms: shared, fragment: POOL_FRAG, params: { ...veil } }))
  pool.rotation.x = -Math.PI / 2
  pool.frustumCulled = false
  pool.renderOrder = 3
  pool.position.y = 0.06
  puddle = pool
  return new THREE.Group().add(far, pool, petals)
}

export function dressing(): THREE.Object3D {
  surface ??= makeSurface()
  return surface
}

export function setJump(seconds: number): void {
  uniforms.uJump.value.x = seconds
}

export function setPool(foot: readonly [number, number], fill: number, time: number, live: number): void {
  const r = Math.hypot(foot[0], foot[1]) || 1
  uniforms.uPoolIn.value.set(foot[0], foot[1], time, live)
  uniforms.uPoolAt.value.set(foot[0] * (1 + POOL.outMm / r), foot[1] * (1 + POOL.outMm / r), POOL.radiusMm, fill)
  puddle?.position.set(uniforms.uPoolAt.value.x, 0.06, uniforms.uPoolAt.value.y)
}

export function poolFill(sinceLanding: number): number {
  if (!(sinceLanding < Infinity)) return 1
  const t = (sinceLanding - FLOW.startSeconds - 0.9 * FLOW.runSeconds) / POOL.fillSeconds
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) * (1 - x)
}

export function update(_moment: KitMoment): void {}
