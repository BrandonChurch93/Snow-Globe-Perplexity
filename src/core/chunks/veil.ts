import * as THREE from 'three'
import { config } from '../../config'
import { LIQUID_PHASE_B, LIQUID_ROLL, LIQUID_SLOSH, LIQUID_SWIRL, ROLL_AXIS, ROLL_CENTRE, ROLL_FLOOR_MM, ROLL_FREE, ROLL_MAX } from '../../globe/liquid'
import type { StageFrame } from '../../scene/frame'

const NOISE_N = 32
const TAU = 2 * Math.PI
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const n = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))

export const VEIL_LOOK = {
  blobTileMm: 120,
  arcTileMm: 24,
  arcDeepMm: 320,
  arcTurns: 3,
  arcSpiral: 1,
  warp: 0.45,
  blobDrift: 0.3,
  wisp: 3,
  cutLow: 0.42,
  cutHigh: 0.82,
  blobLow: 0.3,
  blobGain: 1.4,
  hazeCore: 0.07,
  hazeFrom: 0.45,
  hazeTo: 1.0,
  hazeLift: 0.25,
  hazeSide: 0.2,
  uneven: 0.97,
  whiteFrom: 0.8,
  whiteTo: 1.0,
  whitePower: 3.5,
  shakenFrom: 0.25,
  shakenTo: 1.0,
  shakenPower: 1.5,
  shakenShare: 1,
  aloftFrom: 0.8,
  aloftTo: 1.0,
  white: 0.24,
  heldFrom: 0.15,
  heldTo: 0.6,
  foldEarly: 0.9,
  foldPeak: 0.85,
  haze: 0.04,
  hazePower: 1.3,
  bank: 4,
  bankRest: -1.15,
  bankRise: 0.74,
  bankRisePower: 0.5,
  bankFlood: 0.55,
  bankFloodGain: 2,
  discMm: 5,
  discFlare: 0.25,
  discFloor: 0.15,
  discPeak: 1.8,
  eyeFromMm: 5,
  eyeToMm: 20,
  topCut: 0.75,
  topFrom: 0.55,
  topTo: 0.9,
  bankDim: 0.86,
  rollFrom: 0.2,
  rollTo: 3,
  slowFrom: 0.22,
  slowTo: 0.9,
  slowHaze: 0.2,
  bankRing: 0.72,
  bankSoft: 0.24,
  bankWhite: 2.2,
  bankWave: 0.3,
  bankEven: 0.45,
  bankLean: 0.38,
  bankGrainLow: 0.84,
  bankGrainHigh: 1.32,
  bankGrainFlood: 0.85,
  axis: [0, 0.08, 1] as const,
  keyShare: 3.2,
  keyFloor: 0.5,
  keyFloorFlood: 0.35,
  shadow: 0.5,
  bankShadow: 0.06,
  ambientShare: 1,
  gridShare: 4,
  bankGridShare: 6,
  bankShade: 0.65,
  bankShadeFrom: 0.25,
  bankShadeTo: 1.3,
  sheets: 10,
  sheetMm: 10,
  sheetLowMm: -67,
  sheetNearMm: 5,
  sheetSoftMm: 4,
  fibreTileLowMm: 9,
  fibreTileHighMm: 17,
  fibreFine: 4,
  fibreFineLong: 4,
  fibreWarp: 3,
  fibreFineShare: 0.4,
  fibreShareLow: 0.15,
  fibreShareHigh: 0.6,
  fibreSpiral: 3,
  fibreTurns: 3,
  fibreTurnsMore: 3,
  drift: 0.835,
  driftPower: 2,
  driftRest: -0.838,
  driftRise: 0.504,
  driftRisePower: 0.5,
  lean: 0.0056,
  leanMost: 0.6,
  leanBank: 0.5,
  leanDrift: 0.5,
  leanFlood: 1,
  leanFloor: 0.35,
  driftWallLeft: 1.3,
  driftWallLeftPower: 2.5,
  driftWallRight: 0.4,
  driftDip: 0.09,
  driftDipAtMm: -8,
  driftDipWideMm: 22,
  driftFront: 0.85,
  driftFrontFromMm: 8,
  driftFrontToMm: 30,
  driftBehind: 0.45,
  driftSoftWall: 0.3,
  driftSoftWallFrom: 0.2,
  driftSoftWallTo: 0.8,
  driftWhite: 0.9,
  driftSoft: 0.06,
  driftWisp: 4,
  driftDeep: 0.25,
  lieMm: 26,
  lieFromMm: 1.5,
  lieGroundMm: ROLL_FLOOR_MM - 2.5,
  lieTopFromMm: 1,
  lieTopToMm: 5,
  lieTileMm: 12,
  lieDeepMm: 12,
  lieTurns: 4,
  lieFine: 4,
  lieFineLong: 4,
  driftCutDeep: 0.38,
  driftCutCrest: 0.58,
  driftEdgeDeep: 0.4,
  driftEdgeCrest: 0.1,
  driftMist: 0.2,
  driftShadow: 0.05,
  driftKeyFloor: 0.42,
  driftShadeWhite: 0.5,
  strand: 3,
  tuftFrom: 0.3,
  tuftTo: 0.7,
  tuftLow: 0.2,
  tuftHigh: 1.7,
  arcLow: 0.45,
  arcHigh: 0.7,
  arcGain: 1.2,
  arcCore: 0.35,
  foldLow: 0.36,
  foldHigh: 0.64,
  foldGain: 1.8,
  floodEvenFrom: 0.25,
  floodEvenTo: 0.8,
  milkTileMm: 14,
  milkDeepMm: 14,
  milkSpiral: 1,
  milkTurns: 5,
  milkFine: 4,
  milkFineLong: 2,
  milkFineShare: 0.55,
  milkFrom: 0.36,
  milkTo: 0.66,
  milkGap: 0.68,
  milkCrest: 0.95,
  milkNearMm: 2,
  shearDeep: 0.618034,
  shearLong: 0.381966,
  calmFrom: 0.4,
  calmTo: 0.72,
  driftCalm: 0.25,
  openFromBeats: 0.05,
  openToBeats: 0.55,
  openHoldSeconds: 1,
  pocket: 0.86,
  pocketBank: 0.8,
  pocketAt: [1.5, -2.5] as const,
  pocketMm: [31, 23] as const,
  pocketFrom: 0.62,
  pocketTo: 1.3,
  pocketBackMm: [-24, -9] as const,
  pocketStart: 0.3,
  pocketInSeconds: 0.22,
  pocketWideSeconds: 0.45,
  pocketHoldSeconds: 3,
  pocketGoneSeconds: 6,
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
  uVeilRoll: { value: new THREE.Vector4(1, 0, 0, 0) },
  uVeilDrift: { value: new THREE.Vector4() },
  uVeilLean: { value: new THREE.Vector3() },
  uVeilOpen: { value: new THREE.Vector4(0, 1, 0, 0) },
  uVeilNoise: { value: stirNoise() as THREE.Texture },
}

const L = VEIL_LOOK
const AXIS = new THREE.Vector3(L.axis[0], L.axis[1], L.axis[2]).normalize()
const ROLL = new THREE.Vector3(ROLL_AXIS[0], ROLL_AXIS[1], ROLL_AXIS[2]).normalize()
const SIDE = new THREE.Vector3(1, 0, 0).cross(ROLL).normalize()
const OTHER = new THREE.Vector3().crossVectors(ROLL, SIDE).normalize()
const CENTRE = new THREE.Vector3(ROLL_CENTRE[0], ROLL_CENTRE[1], ROLL_CENTRE[2])
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
uniform vec4 uVeilRoll;
uniform vec4 uVeilDrift;
uniform vec3 uVeilLean;
uniform vec4 uVeilOpen;
uniform highp sampler3D uVeilNoise;
float veilPocket(vec3 p) {
  if (uVeilOpen.x <= 0.0) return 0.0;
  vec2 e = (p.xy - vec2(${n(L.pocketAt[0])}, ${n(L.pocketAt[1])})) / (vec2(${n(L.pocketMm[0])}, ${n(L.pocketMm[1])}) * uVeilOpen.y);
  return uVeilOpen.x * (1.0 - smoothstep(${n(L.pocketFrom)}, ${n(L.pocketTo)}, length(e))) * smoothstep(${n(L.pocketBackMm[0])}, ${n(L.pocketBackMm[1])}, p.z);
}
float veilDisc(vec3 p) {
  vec3 c = p - ${vec(CENTRE)};
  float h = dot(c, ${vec(ROLL)});
  float rad = length(c - h * ${vec(ROLL)});
  float s = ${n(L.discMm)} + ${n(L.discFlare)} * rad;
  return mix(1.0, exp(-h * h / (s * s)) * smoothstep(${n(L.eyeFromMm)}, ${n(L.eyeToMm)}, rad) * (1.0 - ${n(L.topCut)} * smoothstep(${n(L.topFrom)}, ${n(L.topTo)}, p.y / uLens.w)), uVeilRoll.x);
}
vec3 veilTangent(vec3 p) {
  return normalize(cross(${vec(ROLL)}, p - ${vec(CENTRE)}) + 1e-5);
}
vec3 veilOnDisc(vec3 from, vec3 dir) {
  float d = dot(dir, ${vec(ROLL)});
  return from + dir * (dot(${vec(CENTRE)} - from, ${vec(ROLL)}) / (abs(d) < 0.05 ? 0.05 : d));
}
vec4 veilStir(vec3 p) {
  vec4 w = texture(uVeilNoise, p / ${n(L.blobTileMm)} + vec3(uVeilFlow.z, uVeilFlow.w, -uVeilFlow.z));
  vec3 c = p - ${vec(CENTRE)};
  float h = dot(c, ${vec(ROLL)});
  vec3 r = c - h * ${vec(ROLL)};
  float rad = length(r);
  float turn = atan(dot(r, ${vec(OTHER)}), dot(r, ${vec(SIDE)})) / 6.2831853;
  vec3 q = vec3(rad / ${n(L.arcTileMm)} + turn * ${n(L.arcSpiral)}, h / ${n(L.arcDeepMm)}, turn * ${n(L.arcTurns)} - uVeilFlow.x);
  float a = mix(w.b, texture(uVeilNoise, q + vec3((w.rg - 0.5) * ${n(L.warp)}, uVeilFlow.y)).a, uVeilRoll.x);
  float d = ${n(L.wisp)} * smoothstep(${n(L.cutLow)}, ${n(L.cutHigh)}, a) * (${n(L.blobLow)} + ${n(L.blobGain)} * w.a) * mix(1.0, mix(${n(L.discFloor)}, ${n(L.discPeak)}, veilDisc(p)), uVeilRoll.x);
  vec3 flat2 = p - dot(p, ${vec(AXIS)}) * ${vec(AXIS)};
  float haze = mix(${n(L.hazeCore)}, 1.0, smoothstep(${n(L.hazeFrom)}, ${n(L.hazeTo)}, (length(flat2) - ${n(L.hazeLift)} * dot(p, uVeilUp.xyz) - ${n(L.hazeSide)} * p.x) / uLens.w));
  return vec4(d, haze, a, w.a);
}
vec3 veilFlow(vec3 p) {
  vec3 d = p - ${vec(CENTRE)};
  float dc = dot(d, ${vec(CENTRE)});
  float lam = min((dc + sqrt(dc * dc + ${n(ROLL_FREE)} * dot(d, d))) / ${n(ROLL_FREE)}, 1.0);
  vec3 c = d + lam * ${vec(CENTRE)};
  float off = dot(c, ${vec(ROLL)});
  vec3 r = c - off * ${vec(ROLL)};
  return vec3(lam * uLens.w, off, atan(dot(r, ${vec(OTHER)}), dot(r, ${vec(SIDE)}) + 1e-6) / 6.2831853);
}
vec3 veilCurrent(vec3 p) {
  vec3 d = p - ${vec(CENTRE)};
  float dc = dot(d, ${vec(CENTRE)});
  float lam = min((dc + sqrt(dc * dc + ${n(ROLL_FREE)} * dot(d, d))) / ${n(ROLL_FREE)}, 1.0);
  return normalize(cross(${vec(ROLL)}, d + lam * ${vec(CENTRE)}) + 1e-5);
}
float veilSheetOf(vec3 p) {
  return floor((dot(p - ${vec(CENTRE)}, ${vec(ROLL)}) - ${n(L.sheetLowMm)}) / ${n(L.sheetMm)});
}
float veilStrand(float coarse, float fine) {
  return pow(1.0 - abs(2.0 * fine - 1.0), ${n(L.strand)}) * mix(${n(L.tuftLow)}, ${n(L.tuftHigh)}, smoothstep(${n(L.tuftFrom)}, ${n(L.tuftTo)}, coarse));
}
vec3 veilFibre(vec3 at, float k) {
  vec3 fl = veilFlow(at);
  vec4 j = fract(vec4(0.618034, 0.7548777, 0.5698403, 0.4142136) * (k + 23.0));
  float turns = ${n(L.fibreTurns)} + floor(j.x * ${n(L.fibreTurnsMore - 0.001)});
  float pace = turns - floor(j.y * 1.999);
  float wide = fl.x / mix(${n(L.fibreTileLowMm)}, ${n(L.fibreTileHighMm)}, j.z);
  vec3 q = vec3(wide + fl.z * (floor(j.w * ${n(2 * L.fibreSpiral + 0.999)}) - ${n(L.fibreSpiral)}), 0.37 * k + j.w + ${n(L.shearDeep)} * wide, fl.z * turns - uVeilDrift.y * pace);
  float coarse = texture(uVeilNoise, q).a;
  float fine = texture(uVeilNoise, vec3(q.x * ${n(L.fibreFine)} + ${n(L.fibreWarp)} * coarse, q.y + 0.43 + ${n(L.shearDeep * (L.fibreFine - 1))} * wide, q.z * ${n(L.fibreFineLong)} + ${n(L.shearLong * L.fibreFine)} * wide)).a;
  return vec3(coarse, mix(coarse, fine, mix(${n(L.fibreShareLow)}, ${n(L.fibreShareHigh)}, fract((k + 23.0) * 0.3247))), veilStrand(coarse, fine));
}
vec3 veilLie(vec3 at) {
  vec3 fl = veilFlow(at);
  float wide = fl.x / ${n(L.lieTileMm)};
  vec3 q = vec3(wide + fl.z, fl.y / ${n(L.lieDeepMm)} + ${n(L.shearDeep)} * wide, (fl.z - uVeilDrift.y) * ${n(L.lieTurns)});
  float coarse = texture(uVeilNoise, q).a;
  float fine = texture(uVeilNoise, vec3(q.x * ${n(L.lieFine)} + ${n(L.fibreWarp)} * coarse, q.y * ${n(L.lieFine)} + 0.43, q.z * ${n(L.lieFineLong)} + ${n(L.shearLong * L.lieFine)} * wide)).a;
  return vec3(coarse, mix(coarse, fine, ${n(L.fibreFineShare)}), veilStrand(coarse, fine));
}
float veilMilk(vec3 p) {
  vec3 fl = veilFlow(p);
  float wide = fl.x / ${n(L.milkTileMm)};
  vec3 q = vec3(wide + fl.z * ${n(L.milkSpiral)}, fl.y / ${n(L.milkDeepMm)} + ${n(L.shearDeep)} * wide, (fl.z - uVeilDrift.y) * ${n(L.milkTurns)});
  float coarse = texture(uVeilNoise, q).a;
  float fine = texture(uVeilNoise, vec3(q.x * ${n(L.milkFine)} + ${n(L.fibreWarp)} * coarse, q.y * ${n(L.milkFine)} + 0.43, q.z * ${n(L.milkFineLong)} + ${n(L.shearLong * L.milkFine)} * wide)).a;
  return mix(${n(L.milkGap)}, ${n(L.milkCrest)}, smoothstep(${n(L.milkFrom)}, ${n(L.milkTo)}, mix(coarse, fine, ${n(L.milkFineShare)})));
}
float veilStreak(vec3 p, vec3 f, float aloft, out float deep) {
  float side = p.x / uLens.w;
  float dip = (p.x - ${n(L.driftDipAtMm)}) / ${n(L.driftDipWideMm)};
  float open = exp(-dip * dip);
  deep = uVeilDrift.z - dot(p, uVeilUp.xyz - ${n(L.leanDrift)} * uVeilLean) / uLens.w + (side < 0.0 ? ${n(L.driftWallLeft)} * pow(-side, ${n(L.driftWallLeftPower)}) : ${n(L.driftWallRight)} * side * side * side) - ${n(L.driftDip)} * open;
  float soft = mix(${n(L.driftSoft)}, ${n(L.driftSoftWall)}, smoothstep(${n(L.driftSoftWallFrom)}, ${n(L.driftSoftWallTo)}, -side));
  float inside = smoothstep(-1.0, 1.0, deep / soft + ${n(L.driftWisp)} * (f.x - 0.5));
  float cut = mix(${n(L.driftCutCrest)}, ${n(L.driftCutDeep)}, inside);
  return inside * (1.0 - ${n(L.driftFront)} * aloft * open * smoothstep(${n(L.driftFrontFromMm)}, ${n(L.driftFrontToMm)}, p.z)) * (${n(L.driftMist)} * inside + smoothstep(cut, cut + mix(${n(L.driftEdgeCrest)}, ${n(L.driftEdgeDeep)}, inside), f.y) * (1.0 + ${n(L.driftDeep)} * max(deep, 0.0) * uLens.w));
}
vec4 veilField(vec3 p, vec3 f, float sheet) {
  vec3 out2 = p - dot(p, ${vec(AXIS)}) * ${vec(AXIS)};
  float lean = dot(p, uVeilLean) / uLens.w;
  float level = dot(p, uVeilUp.xyz) / uLens.w - ${n(L.leanBank)} * lean - ${n(L.bankRing)} * dot(out2, out2) / (uLens.w * uLens.w) + ${n(L.bankLean)} * p.x / uLens.w;
  float deep;
  float streak = veilStreak(p, f, 1.0, deep);
  float arc = ${n(L.arcGain)} * smoothstep(${n(L.arcLow)}, ${n(L.arcHigh)}, f.x);
  float fold = ${n(L.foldGain)} * smoothstep(${n(L.foldLow)}, ${n(L.foldHigh)}, f.x);
  vec3 flat2 = p - dot(p, ${vec(AXIS)}) * ${vec(AXIS)};
  float ring = mix(${n(L.arcCore)}, 1.0, smoothstep(${n(L.hazeFrom)}, ${n(L.hazeTo)}, (length(flat2) - ${n(L.hazeLift)} * dot(p, uVeilUp.xyz) - ${n(L.hazeSide)} * p.x) / uLens.w));
  float even = smoothstep(uVeilBank.x + uVeilBank.y, uVeilBank.x - uVeilBank.y, level + ${n(L.bankWave)} * (f.x - 0.5));
  float thin = uVeil.a * mix(1.0, ring * arc * sheet, uVeilUp.w) + uVeilRoll.z * mix(1.0, fold, uVeilRoll.w) * max(1.0 + ${n(L.leanFlood)} * lean, ${n(L.leanFloor)});
  float bank = uVeilBank.z * even * even * even * mix(fold, 1.0, uVeilBank.w) + uVeilDrift.x * streak * sheet;
  float pocket = veilPocket(p);
  if (pocket > 0.0) {
    thin *= 1.0 - ${n(L.pocket)} * pocket;
    bank *= 1.0 - ${n(L.pocketBank)} * pocket;
  }
  return vec4(thin, bank, max(mix(deep, uVeilBank.x - level, uVeilRoll.y), 0.0) * uLens.w, f.z);
}
vec3 veilLit(vec3 p, vec4 field) {
  float pk = dot(p, uVeilKey.xyz);
  float reach = -pk + sqrt(max(pk * pk - dot(p, p) + uLens.w * uLens.w, 0.0));
  float dim = exp(-(uVeil.a + uVeilRoll.z) * ${n(L.shadow)} * reach - mix(${n(L.driftShadow)}, ${n(L.bankShadow)}, uVeilRoll.y) * field.z / max(dot(uVeilKey.xyz, uVeilUp.xyz), 0.3));
  float low = field.y / max(field.x + field.y, 1e-6);
  float floorKey = mix(uVeilKey.w, min(uVeilKey.w, ${n(L.driftKeyFloor)}), low);
  float packed = mix(1.0, mix(${n(L.bankShade)}, 1.0, smoothstep(${n(L.bankShadeFrom)}, ${n(L.bankShadeTo)}, field.y / max(uVeilBank.z, 1e-6))), low);
  vec3 toward;
  vec3 card = uRigCardCol * (uRigInside.x * uRigCard.w * stageGridOpen(p));
  vec3 lit = stageSoftIn(p) * ${n(L.ambientShare)} + (stageKeyIn(p, toward) + card) * (uRigPoint.x * ${n(L.keyShare)} * packed * (floorKey + (1.0 - floorKey) * dim)) + mix(stageGrid(p) * ${n(L.gridShare)}, (stageGridWarm(p) + stageFlood(p)) * ${n(L.bankGridShare)}, low);
  return lit * mix(vec3(1.0), vec3(1.0) / max(uVeil.rgb, vec3(0.05)), mix(${n(L.driftWhite)} * mix(${n(L.driftShadeWhite)}, 1.0, dim), ${n(L.bankWhite)}, uVeilRoll.y) * low) * mix(1.0, ${n(L.bankDim)} * mix(${n(L.bankGrainLow)}, ${n(L.bankGrainHigh)}, field.w), low * (1.0 - ${n(L.bankGrainFlood)} * uVeilRoll.y));
}
vec4 veilPath(vec3 eye, vec3 placed, vec3 world, float path) {
  float thin = (uVeil.a + uVeilRoll.z + uVeilBank.z + uVeilDrift.x) * path;
  if (thin <= 0.0) return vec4(0.0);
  if (thin < 0.003) return vec4(stageCold(uVeilTurn * (world - uLensCentre)), thin);
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
  float across = dot(along, ${vec(ROLL)});
  across = abs(across) < 0.05 ? (across < 0.0 ? -0.05 : 0.05) : across;
  float way = across > 0.0 ? 1.0 : -1.0;
  float s = (dot(from - ${vec(CENTRE)}, ${vec(ROLL)}) - ${n(L.sheetLowMm)}) / ${n(L.sheetMm)};
  float k = floor(s);
  float dt = ${n(L.sheetMm)} / abs(across);
  float t1 = (across > 0.0 ? 1.0 - (s - k) : s - k) * dt;
  float t0 = 0.0;
  float seen = 1.0;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${L.sheets}; i++) {
    float te = min(t1, path);
    float ds = te - t0;
    float tc = t1 - 0.5 * dt;
    vec3 p = from + along * (t0 + 0.5 * ds);
    float sheet = smoothstep(0.0, ${n(L.sheetNearMm)}, tc) * smoothstep(0.0, ${n(L.sheetSoftMm)}, path - tc) * dt / max(ds, 1e-3);
    vec4 field = veilField(p, veilFibre(from + along * tc, k), sheet);
    float a = 1.0 - exp(-(field.x + field.y) * ds);
    glow += seen * a * veilLit(p, field) * mix(1.0, mix(${n(L.driftBehind)}, 1.0, seen), (1.0 - uVeilRoll.y) * field.y / max(field.x + field.y, 1e-6));
    seen *= 1.0 - a;
    if (t1 >= path || seen < 0.004) break;
    t0 = t1;
    t1 += dt;
    k += way;
  }
  if (seen > 0.004 && uVeilDrift.x > 0.0) {
    vec3 pe = from + along * path;
    vec3 f = veilLie(pe);
    float deep;
    float a = 1.0 - exp(-uVeilDrift.x * veilStreak(pe, f, 0.0, deep) * ${n(L.lieMm)} * smoothstep(0.0, ${n(L.lieFromMm)}, path) * smoothstep(${n(L.lieTopToMm)}, ${n(L.lieTopFromMm)}, pe.y - ${n(L.lieGroundMm)}));
    glow += seen * a * veilLit(pe, vec4(0.0, 1.0, max(deep, 0.0) * uLens.w, f.z));
    seen *= 1.0 - a;
  }
  float fog = 1.0 - seen;
  if (uVeilRoll.y > 0.0) glow *= mix(1.0, veilMilk(from + along * ${n(L.milkNearMm)}), uVeilRoll.y);
  return vec4(fog > 1e-4 ? glow / fog : vec3(0.0), fog);
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
  vec3 glow = stageVeilMarched > 0.5 ? stageVeilGlow : stageCold(vStageLocal) + lit * ${n(L.gridShare)};
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

/** The pocket the haze opens about the miniature after a landing: how much of it is open (0 to 1) and how far it has spread (a share of its reach), from the time since the landing alone. */
export function veilPocketAt(beat: number | null, sinceLanding: number): { open: number; reach: number } {
  if (beat !== null || !(sinceLanding >= 0) || !(sinceLanding < L.pocketGoneSeconds)) return { open: 0, reach: 1 }
  return { open: ramp(sinceLanding, 0, L.pocketInSeconds) * (1 - ramp(sinceLanding, L.pocketHoldSeconds, L.pocketGoneSeconds)), reach: lerp(L.pocketStart, 1, ramp(sinceLanding, 0, L.pocketWideSeconds)) }
}

const now = { most: 0, rest: 0, turb: 0, slow: 0, held: 0, aloft: 0, roll: 0, open: 0 }
const ramp = (v: number, from: number, to: number) => {
  const t = Math.min(1, Math.max(0, (v - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function densities(): void {
  const { most, rest, turb, slow, held, aloft, roll, open } = now
  const w = Math.min(1, Math.max(0, (turb - L.whiteFrom) / (L.whiteTo - L.whiteFrom)))
  const up = Math.min(1, Math.max(0, (turb - L.shakenFrom) / (L.shakenTo - L.shakenFrom)))
  const flood = Math.max(Math.pow(w, L.whitePower), held * lerp(aloft * aloft, Math.pow(up, L.shakenPower), L.shakenShare)) * (1 - open)
  const white = most * L.white * flood
  const calm = ramp(turb, L.calmFrom, L.calmTo)
  const storm = most * L.haze * Math.pow(turb, L.hazePower) * calm
  const haze = Math.max(storm, most * L.haze * L.slowHaze * slow)
  const density = rest + haze
  const u = veilUniforms
  u.uVeil.value.w = density
  u.uVeilUp.value.w = density > 0 ? Math.min(L.uneven, storm / density) : L.uneven
  u.uVeilRoll.value.y = flood
  u.uVeilKey.value.w = lerp(L.keyFloor, L.keyFloorFlood, flood)
  u.uVeilRoll.value.z = white
  u.uVeilRoll.value.w = lerp(L.foldEarly, L.foldPeak, flood)
  const rise = Math.pow(turb, L.bankRisePower)
  u.uVeilBank.value.set(L.bankRest + L.bankRise * rise + L.bankFlood * flood, L.bankSoft, most * L.bank * L.bankFloodGain * flood * flood, ramp(flood, L.floodEvenFrom, L.floodEvenTo))
  const rolling = Math.min(1, Math.max(0, roll / ROLL_MAX))
  u.uVeilDrift.value.x = most * L.drift * Math.pow(rolling, L.driftPower) * lerp(L.driftCalm, 1, calm)
  u.uVeilDrift.value.z = L.driftRest + L.driftRise * Math.pow(rolling, L.driftRisePower)
}

export function veilSettle(afloat: number): void {
  const s = Math.min(1, Math.max(0, (afloat - L.slowFrom) / (L.slowTo - L.slowFrom)))
  now.slow = s * s * (3 - 2 * s)
  const k = Math.min(1, Math.max(0, (afloat - L.aloftFrom) / (L.aloftTo - L.aloftFrom)))
  now.aloft = k * k * (3 - 2 * k)
  densities()
}

export function updateVeil(f: StageFrame): void {
  const a = f.from.veil
  const b = f.to.veil
  const t = f.mix.veil
  now.most = lerp(a.density, b.density, t)
  now.rest = lerp(a.rest, b.rest, t)
  now.turb = Math.min(1, Math.max(0, f.turbulence))
  const h = Math.min(1, Math.max(0, (f.globe.y / config.shake.liftMm - L.heldFrom) / (L.heldTo - L.heldFrom)))
  now.held = h * h * (3 - 2 * h)
  const beat = f.moment.beat
  const since = f.moment.sinceLanding
  const shut = config.shake.swapWindow.toBeat
  now.open = beat !== null ? ramp(beat, shut + L.openFromBeats, shut + L.openToBeats) : since >= 0 && since < L.openHoldSeconds ? 1 : 0
  const u = veilUniforms
  const pocket = veilPocketAt(beat, since)
  u.uVeilOpen.value.set(pocket.open, pocket.reach, 0, 0)
  u.uVeil.value.set(lerp(a.tint[0], b.tint[0], t), lerp(a.tint[1], b.tint[1], t), lerp(a.tint[2], b.tint[2], t), 0)
  const amb = (L.ambientShare * 0.5) / Math.PI
  u.uVeilLight.value.set((f.ambient.r + f.ground.r * f.fill) * amb, (f.ambient.g + f.ground.g * f.fill) * amb, (f.ambient.b + f.ground.b * f.fill) * amb)
  turn.setFromEuler(tilt.set(f.globe.tiltX, 0, f.globe.tiltZ)).invert()
  local.copy(f.keyDir).applyQuaternion(turn)
  u.uVeilKey.value.set(local.x, local.y, local.z, L.keyFloor)
  const key = L.keyShare / Math.PI
  u.uVeilKeyCol.value.set(f.keyCol.r * key, f.keyCol.g * key, f.keyCol.b * key)
  u.uVeilTurn.value.setFromMatrix4(spin.makeRotationFromQuaternion(turn))
  u.uVeilUp.value.set(f.globeUp.x, f.globeUp.y, f.globeUp.z, L.uneven)
  now.roll = f.liquid[LIQUID_ROLL] ?? 0
  const pa = f.liquid[LIQUID_SWIRL] ?? 0
  u.uVeilDrift.value.y = pa / TAU
  densities()
  u.uVeilRoll.value.x = ramp(now.roll, L.rollFrom, L.rollTo)
  const sx = f.liquid[LIQUID_SLOSH] ?? 0
  const sy = f.liquid[LIQUID_SLOSH + 1] ?? 0
  const sz = f.liquid[LIQUID_SLOSH + 2] ?? 0
  const pace = Math.hypot(sx, sy, sz)
  const lean = pace > 0 ? Math.min(L.lean, L.leanMost / pace) : 0
  u.uVeilLean.value.set(sx * lean, sy * lean, sz * lean)
  const pb = f.liquid[LIQUID_PHASE_B] ?? 0
  u.uVeilFlow.value.set((pa / TAU) * L.arcTurns, Math.sin(pb) * 0.5 * L.blobDrift, Math.sin(pb) * L.blobDrift, Math.cos(pb) * L.blobDrift)
}
