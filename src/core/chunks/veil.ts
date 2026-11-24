import * as THREE from 'three'
import { config } from '../../config'
import { LIQUID_PHASE, LIQUID_PHASE_B } from '../../globe/liquid'
import type { StageFrame } from '../../scene/frame'

const TURBULENCE_POWER = 7
const NOISE_N = 32
const TAU = 2 * Math.PI
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const n = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))

export const VEIL_LOOK = {
  steps: 8,
  stepMm: 15,
  blobTileMm: 170,
  arcTileMm: 40,
  arcTurns: 1,
  warp: 0.34,
  blobDrift: 0.3,
  wisp: 2.6,
  cutLow: 0.4,
  cutHigh: 0.8,
  blobLow: 0.35,
  blobGain: 1.3,
  uneven: 1,
  unevenAtPeak: 0.5,
  peakFrom: 0.7,
  bank: 5.6,
  bankPower: 3,
  bankRest: -0.63,
  bankRise: 0.36,
  bankSoft: 0.12,
  bankWave: 0.34,
  bankWisp: 0.3,
  bankEven: 0.75,
  axis: [0.1, 0.5, 0.86] as const,
  keyShare: 0.8,
  keyFloor: 0.25,
  shadow: 0.5,
  ambientShare: 0.8,
  gridShare: 0.55,
}

function hash(x: number, y: number, z: number, s: number): number {
  let h = (Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ Math.imul(s, 0x165667b1)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

function tiled(x: number, y: number, z: number, cells: number, salt: number): number {
  const fx = x * cells
  const fy = y * cells
  const fz = z * cells
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const iz = Math.floor(fz)
  const tx = fade(fx - ix)
  const ty = fade(fy - iy)
  const tz = fade(fz - iz)
  let v = 0
  for (let c = 0; c < 8; c++) {
    const dx = c & 1
    const dy = (c >> 1) & 1
    const dz = (c >> 2) & 1
    const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz)
    v += w * hash((ix + dx) % cells, (iy + dy) % cells, (iz + dz) % cells, salt)
  }
  return v
}

function stirNoise(): THREE.Data3DTexture {
  const N = NOISE_N
  const raw = new Float32Array(N * N * N * 4)
  const seed = config.seed | 0
  const low = [1, 1, 1, 1]
  const high = [0, 0, 0, 0]
  for (let k = 0, o = 0; k < N; k++) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++, o += 4) {
        const x = i / N
        const y = j / N
        const z = k / N
        raw[o] = tiled(x, y, z, 4, seed + 11)
        raw[o + 1] = tiled(x, y, z, 4, seed + 23)
        raw[o + 2] = tiled(x, y, z, 4, seed + 37)
        raw[o + 3] = 0.5 * tiled(x, y, z, 4, seed + 41) + 0.32 * tiled(x, y, z, 8, seed + 53) + 0.18 * tiled(x, y, z, 16, seed + 67)
        for (let c = 0; c < 4; c++) {
          const v = raw[o + c]!
          if (v < low[c]!) low[c] = v
          if (v > high[c]!) high[c] = v
        }
      }
    }
  }
  const data = new Uint8Array(raw.length)
  for (let o = 0; o < raw.length; o++) {
    const c = o & 3
    data[o] = Math.round((255 * (raw[o]! - low[c]!)) / (high[c]! - low[c]!))
  }
  const t = new THREE.Data3DTexture(data, N, N, N)
  t.format = THREE.RGBAFormat
  t.type = THREE.UnsignedByteType
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.wrapR = THREE.RepeatWrapping
  t.unpackAlignment = 1
  t.needsUpdate = true
  return t
}

export const VEIL_NOISE_BYTES = NOISE_N * NOISE_N * NOISE_N * 4

export const veilUniforms = {
  uVeil: { value: new THREE.Vector4(1, 1, 1, 0) },
  uVeilLight: { value: new THREE.Vector3() },
  uVeilKey: { value: new THREE.Vector4(0, 1, 0, VEIL_LOOK.keyFloor) },
  uVeilKeyCol: { value: new THREE.Vector3() },
  uVeilFlow: { value: new THREE.Vector4() },
  uVeilUp: { value: new THREE.Vector4(0, 1, 0, VEIL_LOOK.uneven) },
  uVeilBank: { value: new THREE.Vector4(VEIL_LOOK.bankRest, VEIL_LOOK.bankSoft, 0, VEIL_LOOK.bankEven) },
  uVeilTurn: { value: new THREE.Matrix3() },
  uVeilNoise: { value: stirNoise() as THREE.Texture },
}

const L = VEIL_LOOK
const AXIS = new THREE.Vector3(L.axis[0], L.axis[1], L.axis[2]).normalize()
const SIDE = new THREE.Vector3(1, 0, 0).cross(AXIS).normalize()
const OTHER = new THREE.Vector3().crossVectors(AXIS, SIDE).normalize()
const vec = (v: THREE.Vector3) => `vec3(${n(v.x)}, ${n(v.y)}, ${n(v.z)})`

export const VEIL_GLSL = `
uniform vec4 uVeil;
uniform vec3 uVeilLight;
uniform vec4 uVeilKey;
uniform vec3 uVeilKeyCol;
uniform vec4 uVeilFlow;
uniform vec4 uVeilUp;
uniform vec4 uVeilBank;
uniform mat3 uVeilTurn;
uniform highp sampler3D uVeilNoise;
vec3 veilGrid(vec3 p) {
  vec3 at = clamp(p / (2.0 * uGrid.w) + 0.5, 0.0, 1.0);
  vec3 a = texture(uGridA, at).rgb * uGrid.y;
  return uGrid.x > 0.001 ? mix(a, texture(uGridB, at).rgb * uGrid.z, uGrid.x) : a;
}
float veilDensity(vec3 p) {
  vec4 w = texture(uVeilNoise, p / ${n(L.blobTileMm)} + vec3(uVeilFlow.z, uVeilFlow.w, -uVeilFlow.z));
  float h = dot(p, ${vec(AXIS)});
  vec3 r = p - h * ${vec(AXIS)};
  float turn = atan(dot(r, ${vec(OTHER)}), dot(r, ${vec(SIDE)})) / 6.2831853;
  vec3 q = vec3(length(r) / ${n(L.arcTileMm)}, h / ${n(L.arcTileMm)}, turn * ${n(L.arcTurns)} - uVeilFlow.x);
  float a = texture(uVeilNoise, q + vec3((w.rg - 0.5) * ${n(L.warp)}, uVeilFlow.y)).a;
  float d = ${n(L.wisp)} * smoothstep(${n(L.cutLow)}, ${n(L.cutHigh)}, a) * (${n(L.blobLow)} + ${n(L.blobGain)} * w.a);
  float level = dot(p, uVeilUp.xyz) / uLens.w + (w.a - 0.5) * ${n(L.bankWave)} + (a - 0.5) * ${n(L.bankWisp)};
  float bank = smoothstep(uVeilBank.x + uVeilBank.y, uVeilBank.x - uVeilBank.y, level);
  return uVeil.a * mix(1.0, d, uVeilUp.w) + uVeilBank.z * bank * mix(d, 1.0, uVeilBank.w);
}
vec3 veilLit(vec3 p, float sigma) {
  float pk = dot(p, uVeilKey.xyz);
  float reach = -pk + sqrt(max(pk * pk - dot(p, p) + uLens.w * uLens.w, 0.0));
  return uVeilLight + uVeilKeyCol * (uVeilKey.w + (1.0 - uVeilKey.w) * exp(-sigma * reach)) + veilGrid(p) * ${n(L.gridShare)};
}
vec4 veilPath(vec3 eye, vec3 placed, vec3 world, float path) {
  float thin = (uVeil.a + uVeilBank.z) * path;
  if (thin < 0.003) return vec4(uVeilLight + uVeilKeyCol, thin);
  vec3 dir = normalize(placed - eye);
  vec3 oc = eye - uLensCentre;
  float b = dot(oc, dir);
  float disc = b * b - dot(oc, oc) + uLens.x * uLens.x;
  vec3 along = dir;
  vec3 entry = world - dir * path;
  if (disc > 0.0 && -b - sqrt(disc) > 0.0) {
    entry = eye + dir * (-b - sqrt(disc));
    if (uLens.z > 0.5) along = refract(dir, (entry - uLensCentre) / uLens.x, 1.0 / uLens.y);
  }
  vec3 from = uVeilTurn * (entry - uLensCentre);
  along = uVeilTurn * along;
  float shade = uVeil.a * ${n(L.shadow)};
  float seen = 1.0;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${L.steps}; i++) {
    float t0 = float(i) * ${n(L.stepMm)};
    if (t0 >= path) break;
    float ds = min(${n(L.stepMm)}, path - t0);
    vec3 p = from + along * (t0 + 0.5 * ds);
    float a = 1.0 - exp(-veilDensity(p) * ds);
    glow += seen * a * veilLit(p, shade);
    seen *= 1.0 - a;
  }
  float fog = 1.0 - seen;
  return vec4(fog > 1e-4 ? glow / fog : uVeilLight + uVeilKeyCol, fog);
}
`

export const VEIL_FRAG_PARS = `
${VEIL_GLSL}
vec3 stageVeilGlow = vec3(0.0);
float stageVeilMarched = 0.0;
float stageVeil(float path) {
  vec4 v = veilPath(cameraPosition, vStagePlaced, vStageWorld, path);
  stageVeilGlow = v.rgb;
  stageVeilMarched = 1.0;
  return v.a;
}
vec3 stageFogged(vec3 col, vec3 lit, float fog) {
  vec3 glow = stageVeilMarched > 0.5 ? stageVeilGlow : uVeilLight + uVeilKeyCol + lit * ${n(L.gridShare)};
  return mix(col, uVeil.rgb * glow, fog);
}
`

export const VEIL_FRAG = `
float stageFog = 0.0;
#ifdef STAGE_INSIDE
stageFog = stageVeil(vStageAux.x);
gl_FragColor.rgb = stageFogged(gl_FragColor.rgb, stageLit, stageFog);
#endif
`

const turn = new THREE.Quaternion()
const tilt = new THREE.Euler()
const local = new THREE.Vector3()
const spin = new THREE.Matrix4()

export function updateVeil(f: StageFrame): void {
  const a = f.from.veil
  const b = f.to.veil
  const t = f.mix.veil
  const density = lerp(a.rest, b.rest, t) + lerp(a.density, b.density, t) * Math.pow(f.turbulence, TURBULENCE_POWER)
  const u = veilUniforms
  u.uVeil.value.set(lerp(a.tint[0], b.tint[0], t), lerp(a.tint[1], b.tint[1], t), lerp(a.tint[2], b.tint[2], t), density)
  const amb = (L.ambientShare * 0.5) / Math.PI
  u.uVeilLight.value.set((f.ambient.r + f.ground.r * f.fill) * amb, (f.ambient.g + f.ground.g * f.fill) * amb, (f.ambient.b + f.ground.b * f.fill) * amb)
  turn.setFromEuler(tilt.set(f.globe.tiltX, 0, f.globe.tiltZ)).invert()
  local.copy(f.keyDir).applyQuaternion(turn)
  u.uVeilKey.value.set(local.x, local.y, local.z, L.keyFloor)
  const key = L.keyShare / Math.PI
  u.uVeilKeyCol.value.set(f.keyCol.r * key, f.keyCol.g * key, f.keyCol.b * key)
  u.uVeilTurn.value.setFromMatrix4(spin.makeRotationFromQuaternion(turn))
  const peak = Math.min(1, Math.max(0, (f.turbulence - L.peakFrom) / (1 - L.peakFrom)))
  u.uVeilUp.value.set(f.globeUp.x, f.globeUp.y, f.globeUp.z, lerp(L.uneven, L.unevenAtPeak, peak * peak * (3 - 2 * peak)))
  const most = lerp(a.density, b.density, t)
  u.uVeilBank.value.set(L.bankRest + L.bankRise * f.turbulence, L.bankSoft, most * L.bank * Math.pow(f.turbulence, L.bankPower), L.bankEven)
  const pa = f.liquid[LIQUID_PHASE] ?? 0
  const pb = f.liquid[LIQUID_PHASE_B] ?? 0
  u.uVeilFlow.value.set((pa / TAU) * L.arcTurns, Math.sin(pb) * 0.5 * L.blobDrift, Math.sin(pb) * L.blobDrift, Math.cos(pb) * L.blobDrift)
  ;(globalThis as unknown as { __veil?: object }).__veil = { turbulence: f.turbulence, density, arrived: f.arrived }
}
