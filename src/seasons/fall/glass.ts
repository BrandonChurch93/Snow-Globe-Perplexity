import * as THREE from 'three'
import { config } from '../../config'
import { viewCode } from '../../diagnostics/views'
import { stageShader } from '../../core/materials'
import { leanGlsl, loadLean } from '../../core/chunks/veil'
import { ROLL_AXIS } from '../../globe/liquid'
import { setGlass, shellUniforms } from '../../globe/shell'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { moundAt } from '../../scene/layout'
import { surfaceUniforms } from '../../scene/surface'
import type { KitMoment } from '../kit'

// Part `glass-dressing-fall`: one fine crack on the outside of the glass and a green fog pooled inside at the bottom of the dome.
//
// The crack is a line on the shell: a thin shadow with a bright edge where the fracture's face catches the key, the rim and the
// discs of the room. It is drawn from its own path (measured in the approved at-rest image) and spreads from its hub to its tips
// after the landing; a place on it is either cracked or not, so nothing of it fades in.
//
// The fog is a lit volume: sheets across the inside of the glass, each of them a slice of one density that is thick at the floor
// of the dome and thins upward, with billows that roll round the axis once a period. Stirred by the liquid it rises and thins
// through the whole dome (the storm's veil has it then); after the landing it pours down the wall and pools again.
const PART = 'glass-dressing-fall'
const RS = config.globe.sphereDiameterMm / 2
const RI = RS - config.globe.glassThicknessMm
const GROUND = config.globe.islandLevelMm - (config.globe.baseHeightMm - config.globe.collarDepthMm + RS)
const RAD = Math.PI / 180

setGlass('fall', { windowTint: [0.8, 0.88, 1], windowGain: [0.15, 0.05, 1, 1], windowSoftDeg: 4, windowGrain: 0.5, rimTint: [0.5, 0.6, 0.55], wallTint: [0.44, 0.55, 0.48], ringCover: 0.35, strip: 0, bend: 0, ringThin: 1, rimClear: 0.3, topLine: 0, ringMottle: 0.3, ceiling: 0.15, roomHue: [0.85, 0.95, 1.1], roomHueOn: 1, windowShade: 0, rimGlow: 0, arcs: 3.2, arcTint: [1, 0.42, 0.13], arcCool: 0.4 })

export const look = {
  fog: {
    tint: [0.4, 1.0, 0.5],
    sheets: 46,
    skinMm: 1.2,
    poolMm: 2.0,
    ringFromMm: 46,
    ringToMm: 56,
    back: 0.08,
    front: 0.3,
    swirl: 15,
    // Half the width of a ribbon, in the weave's own measure, and how much of the broad body stays under the ribbons.
    ribbon: 0.045,
    ribbonBody: 0.25,
    swirlThin: 0.0,
    spinRadS: 2.2,
    spinDownSeconds: 2.6,
    backTall: 2.4,
    restMm: 3.2,
    liftMm: 28,
    floodMm: 42,
    rest: 0.03,
    lip: 1.1,
    lipLifted: 0.9,
    lipLiftedGlow: 0.9,
    lipGlow: 1.1,
    lipDeepGlow: 2.6,
    // Tufts of it stand a little over the ground's edge before the scene, so the edge is no hard line.
    lipFrontMm: 3,
    lipSides: 0.6,
    lipDeepMm: 8,
    lipRiseMm: 11,
    lipDeep: [0.26, 1.0, 0.32],
    lifted: 0.03,
    liftedMiddle: 0.007,
    liftedFromMm: 45,
    liftedToMm: 54,
    liftedFront: 0.025,
    // Above the roof and the crown the strands go round the front of the dome too: there is nothing there for them to hide.
    liftedFrontHigh: 0.45,
    lean: 0.22,
    bank: 0.24,
    bankMm: 9,
    pale: [0.6, 1.0, 0.54],
    paleMm: 2.5,
    paleGain: 0.1,
    air: 0.0003,
    airStirred: 0.3,
    airTint: [0.3, 0.24, 0.1],
    airGrid: 0.6,
    dustGlow: 0.0004,
    // Stirred, the liquid is full of fine stuff, and the lamp and the windows stand in a wide warm glow.
    dustStirred: 1.5,
    dustTint: [1.0, 0.72, 0.42],
    flood: 0.1,
    // Only at the full flood, where one season is changed for the next: it is gone long before the landing.
    floodPeak: 0.6,
    floodFrom: 0.64,
    floodTo: 0.99,
    floodHeld: 0.015,
    floodGoneSeconds: 1.2,
    lumpMm: 5,
    lumpFineMm: 1.8,
    middle: 0.01,
    haze: 0.016,
    hazeMm: 12,
    // Far behind the scene a glow stands between the house and the tree, as high as the eaves: the approved picture has it,
    // and the lamp is a dark shape before it. It ends under where the bats fly, since the fog is drawn over them.
    hazeMid: 0.68,
    hazeMidAtMm: -2,
    hazeMidWideMm: 10,
    hazeMidTopMm: 29,
    hazeMidMm: 4.5,
    hazeMidFrontMm: -24,
    hazeMidBackMm: -38,
    hazeMidTint: [0.8, 0.84, 0.76],
    hazeMidGlow: 0.1,
    hazeLumpMm: 16,
    hazeBankMm: 150,
    hazeBillowMm: 64,
    hazeTint: [0.45, 1.0, 0.55],
    hazeFrontMm: -9,
    hazeBackMm: -24,
    pour: 0.006,
    pourFallMm: 36,
    cold: 0.9,
    warm: 1.0,
    // Thrown up by the shake it is thin strands on the wall: the lamp and the windows no longer light it, or the thin fog
    // before the house would stand as a pale veil over it.
    warmLifted: 0.9,
    glow: 0.11,
    glowDeepMm: 8,
    glowLifted: 1.6,
    rollRad: 0.55,
    bigMm: 96,
    fineMm: 37,
  },
  crack: { widthMm: 0.09, edgeMm: 0.055, shade: 0.3, bright: 3.6, sky: 0.3, key: 1.6, rim: 3.0, room: 2.4, jitterMm: 0.14, bowMm: 0.5, stepMm: 1.6, glintPerMm: 0.3, catchPerMm: 0.1, faint: 0.07, warm: [1.0, 0.74, 0.46] },
}

// The crack's path in the pixels of `references/approved/fall-rest.png` (glass circle centre (1417.1, 662.2), radius 564.3 px,
// the hero camera pitched 4.5 degrees down). The hub is where the arms meet; an arm starts at a point of the arm named in `on`.
const CIRCLE = { cx: 1417.1, cy: 662.2, r: 564.3 }
const HUB: [number, number] = [1154, 366]
const ARMS: { on: number; at: number; path: [number, number][] }[] = [
  { on: -1, at: 0, path: [[1201, 323], [1258, 270], [1320, 199]] },
  { on: -1, at: 0, path: [[1165, 323], [1186, 278], [1194, 258], [1227, 234]] },
  { on: -1, at: 0, path: [[1081, 415.5], [1023.7, 448.7], [1006, 473], [937.4, 504]] },
  { on: -1, at: 0, path: [[1152, 397.8], [1132, 459.7], [1110, 519.5]] },
  { on: 0, at: 2, path: [[1296, 267]] },
  { on: 1, at: 2, path: [[1147.6, 282.7], [1141, 292.5], [1072.4, 302.7], [1065.8, 316], [970.6, 342.5]] },
  // A second line runs down from the hub, right of the first, and a short bow joins the two upper arms.
  { on: -1, at: 0, path: [[1161, 387], [1173, 406], [1166, 445], [1171, 465], [1186.5, 524]] },
  { on: 1, at: 2, path: [[1176, 305], [1173, 328], [1184, 334]] },
]

const unit = (n: number): number => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

interface Piece {
  a: [number, number, number]
  b: [number, number, number]
  ta: number
  tb: number
}

/** A point of the approved image on the front of the shell, as a direction from the centre of the globe in the globe's own frame. */
function toward(x: number, y: number): [number, number, number] {
  const nx = (x - CIRCLE.cx) / CIRCLE.r
  const ny = -(y - CIRCLE.cy) / CIRCLE.r
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
  const p = config.cameras.hero.pitchDeg * RAD
  return [nx, ny * Math.cos(p) + nz * Math.sin(p), nz * Math.cos(p) - ny * Math.sin(p)]
}

/** The crack as short pieces, each with the share of the way from the hub to the furthest tip at its two ends. */
function crackPieces(): Piece[] {
  const L = look.crack
  const pxPerMm = CIRCLE.r / RS
  const out: { a: [number, number]; b: [number, number]; da: number; db: number }[] = []
  const nodes: { p: [number, number]; d: number }[][] = []
  let salt = 1
  ARMS.forEach((arm, k) => {
    const start = arm.on < 0 ? { p: HUB, d: 0 } : nodes[arm.on]![arm.at]!
    const list = [start]
    let from = start
    for (const to of arm.path) {
      const dx = to[0] - from.p[0]
      const dy = to[1] - from.p[1]
      const len = Math.hypot(dx, dy)
      const n = Math.max(1, Math.round(len / (L.stepMm * pxPerMm)))
      // Glass does not break along a ruler: between two traced points the line bows a little to one side.
      const bow = (unit(salt++ * 13 + k + 500) - 0.5) * 2 * L.bowMm * pxPerMm * Math.min(1, len / (10 * pxPerMm))
      let prev = from
      for (let i = 1; i <= n; i++) {
        const t = i / n
        const j = i < n ? (unit(salt++ * 7 + k) - 0.5) * 2 * L.jitterMm * pxPerMm + bow * Math.sin(Math.PI * t) : 0
        const p: [number, number] = [from.p[0] + dx * t - (dy / len) * j, from.p[1] + dy * t + (dx / len) * j]
        const d = prev.d + Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1])
        out.push({ a: prev.p, b: p, da: prev.d, db: d })
        prev = { p, d }
      }
      from = prev
      list.push(prev)
    }
    nodes[k] = list
  })
  const far = Math.max(...out.map((s) => s.db))
  return out.map((s) => ({ a: toward(s.a[0], s.a[1]), b: toward(s.b[0], s.b[1]), ta: s.da / far, tb: s.db / far }))
}

const PIECES = crackPieces()
const CRACK_LENGTH_MM = (() => {
  let far = 0
  let run = 0
  for (const s of PIECES) {
    run = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]) * RS
    far = Math.max(far, run / Math.max(s.tb - s.ta, 1e-6))
  }
  return far
})()
const CAP = (() => {
  const mid = new THREE.Vector3()
  for (const s of PIECES) mid.add(new THREE.Vector3(...s.a)).add(new THREE.Vector3(...s.b))
  mid.normalize()
  let least = 1
  for (const s of PIECES) least = Math.min(least, mid.dot(new THREE.Vector3(...s.a)), mid.dot(new THREE.Vector3(...s.b)))
  return { axis: mid, cos: least - 0.02 }
})()

const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : n.toFixed(5))
const vec = (v: readonly number[]): string => `vec3(${v.map(f).join(', ')})`

const uniforms = {
  /** x: the ambient clock, 0 to 1; y: how far the fog is lifted, 0 pooled to 1 through the whole dome; z: how much pours down the wall; w: how far the pouring fog has fallen, mm. */
  uFog: { value: new THREE.Vector4(0, 0, 0, 0) },
  uFogNoise: { value: null as THREE.Data3DTexture | null },
  /** x: how far the stirred fog has gone round the upright axis, radians; y: how much the hardest of the shake has it fill the dome, 0 to 1. */
  uFogTurn: { value: new THREE.Vector2(0, 0) },
  /** Which way and how far the liquid's load is thrown: the fog is thick on that side and thin on the other. */
  uFogLean: { value: new THREE.Vector3(0, 0, 0) },
  /** x: how far the crack has spread, 0 to 1 of the way from the hub to the furthest tip. */
  uCrack: { value: new THREE.Vector4(1, 0, 0, 0) },
}

const lightUniforms = {
  uKeyDir: shellUniforms.uKeyDir,
  uKeyCol: shellUniforms.uKeyCol,
  uRimDir: shellUniforms.uRimDir,
  uRimCol: shellUniforms.uRimCol,
  uSky: surfaceUniforms.uSky,
}

/** Smooth noise that repeats in every direction: two octaves of a lattice, 8 and 16 cells to the tile. */
function fogNoise(): THREE.Data3DTexture {
  const N = 64
  const data = new Uint8Array(N * N * N)
  const lattice = (cells: number, salt: number): Float32Array => {
    const v = new Float32Array(cells * cells * cells)
    for (let i = 0; i < v.length; i++) v[i] = unit(i * 3 + salt)
    return v
  }
  const octaves = [
    { cells: 8, v: lattice(8, 11), w: 0.64 },
    { cells: 16, v: lattice(16, 29), w: 0.36 },
  ]
  const ease = (t: number): number => t * t * (3 - 2 * t)
  let o = 0
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let sum = 0
        for (const oc of octaves) {
          const c = oc.cells
          const gx = (x / N) * c
          const gy = (y / N) * c
          const gz = (z / N) * c
          const x0 = Math.floor(gx)
          const y0 = Math.floor(gy)
          const z0 = Math.floor(gz)
          const fx = ease(gx - x0)
          const fy = ease(gy - y0)
          const fz = ease(gz - z0)
          const at = (i: number, j: number, k: number): number => oc.v[(((z0 + k) % c) * c + ((y0 + j) % c)) * c + ((x0 + i) % c)]!
          const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
          sum += oc.w * lerp(lerp(lerp(at(0, 0, 0), at(1, 0, 0), fx), lerp(at(0, 1, 0), at(1, 1, 0), fx), fy), lerp(lerp(at(0, 0, 1), at(1, 0, 1), fx), lerp(at(0, 1, 1), at(1, 1, 1), fx), fy), fz)
        }
        data[o++] = Math.max(0, Math.min(255, Math.round(sum * 255)))
      }
  const t = new THREE.Data3DTexture(data, N, N, N)
  t.format = THREE.RedFormat
  t.type = THREE.UnsignedByteType
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.wrapR = THREE.RepeatWrapping
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.unpackAlignment = 1
  t.needsUpdate = true
  return t
}

const F = look.fog
// `moundAt` of `src/scene/layout.ts`, read off the function itself so it follows the layout.
const MOUND = (() => {
  const from = -8
  const full = 4
  const back = moundAt(from - 1) - moundAt(from)
  const rake = moundAt(full + 1) - moundAt(full + 2)
  return { from, full, top: moundAt(from), back, rake }
})()
const FOG_STEP = (2 * (RI - 1.5)) / (F.sheets - 1)

const FOG_HEAD = `
uniform highp sampler3D uFogNoise;
uniform vec4 uFog;
uniform vec2 uFogTurn;
uniform vec3 uFogLean;
vec3 fogTurn(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, c * p.z - s * p.x);
}
// The billows at a place and a moment of the roll. The big ones go round the axis one way and the fine ones the other.
// The ground under the fog: the mound of \`src/scene/layout.ts\` (\`moundAt\`), level at the back and raked down to the front.
float fogMound(float z) {
  float t = clamp(z, ${f(MOUND.from)}, ${f(MOUND.full)}) - ${f(MOUND.from)};
  float y = ${f(MOUND.top)} - ${f(MOUND.back)} * t - ${f((MOUND.rake - MOUND.back) / (2 * (MOUND.full - MOUND.from)))} * t * t;
  return y + ${f(MOUND.back)} * max(${f(MOUND.from)} - z, 0.0) - ${f(MOUND.rake)} * max(z - ${f(MOUND.full)}, 0.0);
}
// Where the fog lies: a skin on the ground, and a pool where the ground is lower than the pool's level.
float fogFloor(vec3 p) {
  float d = fogMound(p.z) - ${f(F.skinMm)} - ${f(GROUND + F.poolMm)};
  return ${f(GROUND + F.poolMm)} + 0.5 * (d + sqrt(d * d + 6.0));
}
vec2 fogBillows(vec3 p, float along) {
  float big = texture(uFogNoise, fogTurn(p, ${f(F.rollRad)} * along) / ${f(F.bigMm)} + vec3(0.13, 0.41 - 0.05 * along, 0.71)).r;
  vec3 q = fogTurn(p, -${f(F.rollRad * 1.4)} * along);
  float fine = texture(uFogNoise, q / ${f(F.fineMm)} + vec3(0.52 + 0.3 * big, 0.27 + 0.11 * along, 0.9)).r;
  return vec2(big, fine);
}
`

const FOG = `
${FOG_HEAD}
void main() {
  // It crosses with the season's veil, thinning evenly and not as a stipple.
  float c = stageChange();
  float seen = (uState.w > 1.5 ? 1.0 - c : uState.w > 0.5 ? c : 1.0) * uFlags.w;
  if (seen <= 0.0) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  vec3 p = vStageLocal;
  float r = length(p);
  if (r > ${f(RI - 0.25)}) discard;
  float lift = uFog.y;
  float deepMm = mix(${f(F.restMm)}, mix(${f(F.liftMm)}, ${f(F.floodMm)}, uFogTurn.y), lift);
  float full = uFogTurn.y * uFogTurn.y;
  float amp = mix(${f(F.rest)}, mix(${f(F.lifted)}, ${f(F.flood)}, uFogTurn.y) + ${f(F.floodPeak)} * full * full, lift);
  float base = fogFloor(p);
  float ground = fogMound(p.z);
  float under = ground - 0.4;
  float h = p.y - base;
  float hazeBack = smoothstep(${f(F.hazeFrontMm)}, ${f(F.hazeBackMm)}, p.z);
  float hazeAmp = ${f(F.haze)} * (1.0 - lift);
  float span = smoothstep(-2.0, 7.0, h) * (1.0 - smoothstep(34.0, 76.0, h));
  float bound = amp * exp(-max(h - ${f((F.lumpMm + F.lumpFineMm) * F.backTall)}, 0.0) / (deepMm * ${f(F.backTall)})) + hazeAmp * hazeBack * 3.0 * exp(-max(h - ${f(F.hazeLumpMm)}, 0.0) / ${f(F.hazeMm)}) + uFog.z * ${f(F.pour)} * span;
  // The liquid itself is not clear: fine dust in it takes the orange of the lights, most in the upper dome and near the wall.
  float air = ${f(F.air)} * (1.0 + ${f(F.airStirred)} * lift) * smoothstep(${f(GROUND + 14)}, ${f(GROUND + 46)}, p.y) * mix(0.35, 1.0, smoothstep(24.0, 50.0, r));
  float thrown = ${leanGlsl('p', 'uFogLean', f(RI))};
  bound *= max(thrown, 1.0);
  air *= thrown;
  bool fogHere = bound * ${f(FOG_STEP * 1.7)} >= 0.003;
  float midX = (p.x - ${f(F.hazeMidAtMm)}) / ${f(F.hazeMidWideMm)};
  float midY = max(h - ${f(F.hazeMidTopMm)}, 0.0) / ${f(F.hazeMidMm)};
  float midMost = hazeAmp * smoothstep(${f(F.hazeMidFrontMm)}, ${f(F.hazeMidBackMm)}, p.z) * ${f(F.hazeMid)} * exp(-midX * midX - midY * midY);
  bool midHere = midMost * ${f(FOG_STEP)} >= 0.0006;
  if (p.y < under) discard;
  // The same dust shows the light of the lamp, the windows and the lanterns as a glow in the liquid round them.
  vec3 grid = stageGrid(p);
  vec3 dust = ${vec(F.dustTint)} * grid * ${f(F.dustGlow * FOG_STEP)} * (1.0 + ${f(F.dustStirred)} * lift) * thrown;
  bool dustHere = dust.r + dust.g > 0.0012;
  if (!fogHere && !midHere && !dustHere && air * ${f(FOG_STEP)} < 0.0006) discard;
  // The roll comes round once a period: two takes of the billows half a turn of the clock apart, the one handed over to the other.
  float k = uFog.x;
  vec2 n = vec2(0.5);
  if (fogHere) {
    vec2 n0 = fogBillows(p, k);
    vec2 n1 = fogBillows(p, k - 1.0);
    n = 0.5 + (mix(n0, n1, k) - 0.5) / sqrt(k * k + (1.0 - k) * (1.0 - k));
  }
  float lump = ${f(F.lumpMm)} * (n.x - 0.5) * 2.0 + ${f(F.lumpFineMm)} * (n.y - 0.5) * 2.0;
  // Pooled, it lies against the wall, where the ground is lowest, and leaves the ground of the scene clear; behind the scene
  // it stands taller and thinner, a glow at the back of the dome.
  float behind = smoothstep(${f(F.hazeFrontMm)}, ${f(F.hazeBackMm)}, p.z) * (1.0 - lift);
  float wall = max(mix(${f(F.middle)}, 1.0, smoothstep(${f(F.ringFromMm)}, ${f(F.ringToMm)}, length(p.xz))), ${f(F.back)} * behind);
  // In front of the scene it stays low, under the ground's edge, so the fence and the path stand dark before it.
  wall *= mix(1.0, ${f(F.front)}, smoothstep(6.0, 34.0, p.z) * smoothstep(${f(GROUND - 5)}, ${f(GROUND - 1)}, p.y));
  float tall = mix(1.0, ${f(F.backTall)}, behind);
  float body = exp(-max(h - lump * tall * (1.0 + 2.0 * lift), 0.0) / (deepMm * tall));
  float wisp = 0.12 + 1.9 * smoothstep(0.3, 0.8, n.y) * (0.25 + n.x);
  // Nothing of it lies under the ground.
  float open = smoothstep(ground - 0.4, ground + 2.4, p.y);
  // Stirred, it is drawn out into long strands that go round with the liquid's roll, with clear water between them. They lie
  // on the wall of the dome, about the axis the liquid rolls on, and change little through the wall's depth, so a strand
  // stays a strand along the line of sight.
  float strands = 1.0;
  float around = 1.0;
  float bank = 0.0;
  if (lift > 0.0) {
    vec3 d = p / max(r, 1.0);
    float lat = dot(d, ${vec(ROLL_AXIS)});
    vec3 e = d - lat * ${vec(ROLL_AXIS)};
    vec2 about = vec2(dot(e, ${vec([0, ROLL_AXIS[2], -ROLL_AXIS[1]])}), e.x);
    float turn = (dot(about, about) > 0.0 ? atan(about.x, about.y) : 0.0) / 6.2831853 - uFogTurn.x * mix(1.04, 0.96, r / ${f(RI)}) / 6.2831853 + ${f(F.lean)} * lat;
    float s1 = texture(uFogNoise, vec3(turn, 2.3 * lat + 0.17, r / 110.0 + 0.4)).r;
    float s2 = texture(uFogNoise, vec3(2.0 * turn + 0.31, 5.1 * lat + 0.5, r / 70.0 + 0.63)).r;
    // A finer run of wisps lies over the broad ones, and each depth of the wall has its own.
    float s3 = texture(uFogNoise, vec3(4.0 * turn + 0.77, 11.3 * lat + 0.21, r / 45.0 + 0.19)).r;
    float weave = 0.46 * s1 + 0.34 * s2 + 0.2 * s3 + 0.08 * (n.y - 0.5);
    // A strand is a thin ribbon: the line where the weave crosses a level, not the whole of what lies above it. Two levels,
    // the second fainter, and a little of the body between them.
    float ribbon = 1.0 - smoothstep(${f(F.ribbon * 0.3)}, ${f(F.ribbon)}, abs(weave - 0.585));
    float second = 1.0 - smoothstep(${f(F.ribbon * 0.3)}, ${f(F.ribbon)}, abs(weave - 0.45));
    float strand = max(max(ribbon, 0.5 * second), ${f(F.ribbonBody)} * smoothstep(0.55, 0.61, weave));
    // At the flood the strands are as broad as they were, so the cover of the change is what it was.
    float broad = smoothstep(0.52, 0.6, weave);
    strands = mix(1.0, mix(${f(F.swirlThin)} + ${f(F.swirl)} * strand * strand, 0.55 + 0.9 * broad, uFogTurn.y), lift);
    // The turning liquid throws it to the wall: thick round the scene and behind it, thin in the middle and before it, so
    // the house and the tree stand dark against the green. Only at the hardest of the shake does it fill the dome.
    around = mix(${f(F.liftedMiddle)}, 1.0, smoothstep(${f(F.liftedFromMm)}, ${f(F.liftedToMm)}, r)) * mix(1.0, mix(${f(F.liftedFront)}, ${f(F.liftedFrontHigh)}, smoothstep(${f(GROUND + 24)}, ${f(GROUND + 50)}, p.y)), smoothstep(-8.0, 24.0, p.z));
    // What is left of the pool is a low bright bank behind the scene.
    bank = lift * ${f(F.bank)} * exp(-max(h, 0.0) / ${f(F.bankMm)}) * smoothstep(-2.0, -22.0, p.z) * mix(1.0, strands, 0.75);
  }
  float rho = amp * wisp * open * (body * mix(wall, mix(around, 1.0, uFogTurn.y), lift) * strands + bank) * thrown;
  // The haze is a glow at the back of the dome: it stands behind the house and the tree, which are dark and clear before it.
  float hazeRho = 0.0;
  float midRho = 0.0;
  if (hazeAmp * hazeBack > 0.0) {
    // Banks of it, a few to the width of the dome, each standing to its own height, with finer billows on them. They change
    // little along the line of sight from the front, so a bank stays a bank through the depth of the dome.
    vec3 hp = vec3(p.x, p.y, 0.3 * p.z);
    float kn = 1.0 / sqrt(k * k + (1.0 - k) * (1.0 - k));
    float z0 = texture(uFogNoise, fogTurn(hp, 0.35 * k) / ${f(F.hazeBankMm)} + vec3(0.37, 0.11 - 0.04 * k, 0.59)).r;
    float z1 = texture(uFogNoise, fogTurn(hp, 0.35 * (k - 1.0)) / ${f(F.hazeBankMm)} + vec3(0.37, 0.11 - 0.04 * (k - 1.0), 0.59)).r;
    float hz = 0.5 + (mix(z0, z1, k) - 0.5) * kn;
    float f0 = texture(uFogNoise, fogTurn(hp, -0.5 * k) / ${f(F.hazeBillowMm)} + vec3(0.81 + 0.2 * hz, 0.43 + 0.07 * k, 0.17)).r;
    float f1 = texture(uFogNoise, fogTurn(hp, -0.5 * (k - 1.0)) / ${f(F.hazeBillowMm)} + vec3(0.81 + 0.2 * hz, 0.43 + 0.07 * (k - 1.0), 0.17)).r;
    float hf = 0.5 + (mix(f0, f1, k) - 0.5) * kn;
    float puff = smoothstep(0.43, 0.57, 0.5 * hz + 0.5 * hf);
    hazeRho = hazeAmp * hazeBack * exp(-max(h - ${f(F.hazeLumpMm)} * (hz - 0.5) * 2.0, 0.0) / ${f(F.hazeMm)}) * (0.03 + 2.2 * puff * puff);
    midRho = midHere ? midMost * (0.6 + 0.8 * hf) : 0.0;
    rho += hazeRho;
  }
  if (uFog.z > 0.0) {
    float run = texture(uFogNoise, vec3(p.x / 31.0, (p.y + uFog.w) / 110.0, p.z / 31.0) + vec3(0.3, 0.0, 0.6)).r;
    float fall = texture(uFogNoise, vec3(p.x / 13.0, (p.y + 1.6 * uFog.w) / 64.0, p.z / 13.0)).r;
    rho += uFog.z * ${f(F.pour)} * span * smoothstep(0.46, 0.72, run) * (0.4 + 1.2 * fall) * mix(0.08, 1.0, smoothstep(28.0, 54.0, r)) * mix(1.0, ${f(F.liftedFront)}, smoothstep(-8.0, 24.0, p.z)) * mix(1.0, strands, 0.6);
  }
  if (!fogHere) rho = 0.0;
  rho += midRho;
  float a = 1.0 - exp(-(rho + air) * ${f(FOG_STEP)});
  a *= seen;
  if (a < 0.0006 && !dustHere) discard;
  float deep = exp(-max(h, 0.0) / ${f(F.glowDeepMm)});
  vec3 lit = stageCold(p) * ${f(F.cold)} + grid * ${f(F.warm)} * (1.0 - ${f(F.warmLifted)} * lift) + vec3(${f(F.glow)}) * mix(mix(0.3, 1.0, deep), 1.0, ${f(F.glowLifted)} * lift) * (0.75 + 0.5 * n.y);
  // Where it is thick it scatters more and goes pale: mint, not green.
  float thick = clamp(rho * ${f(F.paleMm)}, 0.0, 1.0);
  vec3 col = mix(mix(${vec(F.tint)}, ${vec(F.pale)}, thick), ${vec(F.hazeTint)}, hazeRho / max(rho, 1e-6)) * lit * (1.0 + ${f(F.paleGain)} * thick);
  col = mix(col, ${vec(F.hazeMidTint)} * (lit + vec3(${f(F.hazeMidGlow)})), midRho / max(rho, 1e-6));
  col = (col * rho + ${vec(F.airTint)} * (1.0 + ${f(F.airGrid)} * (grid.r + grid.g)) * air) / max(rho + air, 1e-6);
  gl_FragColor = vec4(col * a + dust * seen, a);
  // In the cover view the fog says how much of the miniature it hides, as the particles do.
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(a, 0.0, a, a);
    return;
  }
  if (uDiag != 0) {
    if (a < 0.35) discard;
    gl_FragColor = stageDiag(${vec(F.tint)}, vec3(0.0, 0.0, 1.0), 0.0, c, 0.0);
  }
}
`

// The fog in the gap between the soil and the glass, under the ground's edge: the bright lip at the bottom of the dome. One
// more slice of the same volume, bent to the wall.
const LIP = `
${FOG_HEAD}
void main() {
  // It crosses with the season's veil, thinning evenly and not as a stipple.
  float c = stageChange();
  float seen = (uState.w > 1.5 ? 1.0 - c : uState.w > 0.5 ? c : 1.0) * uFlags.w;
  if (seen <= 0.0) discard;
  vec3 p = vStageLocal;
  float edge = fogMound(p.z) + 1.0;
  if (p.y > edge + ${f(1.5 + F.lipRiseMm * 1.3)}) discard;
  float k = uFog.x;
  vec2 n0 = fogBillows(p * vec3(1.0, 2.2, 1.0), k);
  vec2 n1 = fogBillows(p * vec3(1.0, 2.2, 1.0), k - 1.0);
  vec2 n = 0.5 + (mix(n0, n1, k) - 0.5) / sqrt(k * k + (1.0 - k) * (1.0 - k));
  // Behind the scene and beside it the mist stands up the wall in tufts, each to its own height; before the scene it stays
  // under the ground's edge.
  float rise = ${f(F.lipRiseMm)} * smoothstep(14.0, -8.0, p.z) * (0.3 + n.x) + ${f(F.lipFrontMm)} * n.x * n.x * 2.0;
  // It is brightest low in the middle of the front and thins and darkens toward the sides of the dome: no even band.
  float side = 1.0 - ${f(F.lipSides)} * smoothstep(16.0, 50.0, abs(p.x));
  float top = 1.0 - smoothstep(edge - 3.0, edge + 1.5 + rise, p.y);
  if (top <= 0.0) discard;
  float lift = uFog.y;
  float deep = clamp((edge - p.y) / 12.0, 0.0, 1.0);
  float rho = ${f(F.lip)} * mix(1.0, ${f(F.lipLifted)}, lift) * top * (0.24 + 1.4 * smoothstep(0.3, 0.75, n.y) * (0.3 + n.x)) * mix(0.6, 1.0, deep) * side;
  float a = 1.0 - exp(-rho);
  a *= seen;
  if (a < 0.003) discard;
  // It glows from below: brightest at the collar, where it is deepest, and fading up to the ground's edge.
  float low = clamp((edge - p.y) / ${f(F.lipDeepMm)}, 0.0, 1.0);
  low *= low;
  vec3 lit = stageCold(p) * ${f(F.cold)} + stageGrid(p) * ${f(F.warm)} + vec3(${f(F.glow * F.lipGlow)}) * side * (0.2 + 1.6 * n.y * n.y * 1.5) * (1.0 + ${f(F.lipDeepGlow)} * low * mix(1.0, ${f(F.lipLiftedGlow)}, lift));
  vec3 col = mix(${vec(F.tint)}, ${vec(F.lipDeep)}, low) * lit;
  gl_FragColor = vec4(col * a, a);
  // In the cover view the fog says how much of the miniature it hides, as the particles do.
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(a, 0.0, a, a);
    return;
  }
  if (uDiag != 0) {
    if (a < 0.35) discard;
    gl_FragColor = stageDiag(${vec(F.tint)}, vec3(0.0, 0.0, 1.0), 0.0, c, 0.0);
  }
}
`

const C = look.crack
const list = (get: (s: Piece) => number[]): string => PIECES.map((s) => `vec4(${get(s).map((n) => n.toFixed(6)).join(', ')})`).join(',\n  ')

const CRACK = `
${ROOM_GLSL}
uniform vec4 uCrack;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uSky;
varying vec3 vAxisX;
varying vec3 vAxisY;
varying vec3 vAxisZ;
const int CRACK_N = ${PIECES.length};
const vec4 CRACK_A[CRACK_N] = vec4[CRACK_N](
  ${list((s) => [...s.a, s.ta])}
);
const vec4 CRACK_B[CRACK_N] = vec4[CRACK_N](
  ${list((s) => [...s.b, s.tb])}
);
float crackGlint(float x) {
  float i = floor(x);
  float t = x - i;
  t = t * t * (3.0 - 2.0 * t);
  return mix(stageHash(vec3(i + 64.0, 7.0, 0.31)), stageHash(vec3(i + 65.0, 7.0, 0.31)), t);
}
void main() {
  // The crack goes and comes by its cover, evenly, and not as a stipple: the app draws one sample a frame, and a hair of a
  // pixel's width that drops pixels stands as a row of dots. Its colour holds its cover already, so the picture times the
  // share that stays is the mean of a film frame's samples that kept it and dropped it.
  float c = stageChange();
  float seen = (uState.w > 1.5 ? 1.0 - c : uState.w > 0.5 ? c : 1.0) * uFlags.w;
  if (seen <= 0.0) discard;
  vec3 d = normalize(vStageLocal);
  if (dot(d, ${vec(CAP.axis.toArray())}) < ${f(CAP.cos)}) discard;
  float best = 1e9;
  float tau = 0.0;
  vec3 at = d;
  vec3 along = vec3(1.0, 0.0, 0.0);
  for (int i = 0; i < CRACK_N; i++) {
    vec3 a = CRACK_A[i].xyz;
    vec3 ab = CRACK_B[i].xyz - a;
    float t = clamp(dot(d - a, ab) / dot(ab, ab), 0.0, 1.0);
    vec3 q = normalize(a + ab * t);
    float far = length(d - q);
    if (far < best) {
      best = far;
      tau = mix(CRACK_A[i].w, CRACK_B[i].w, t);
      at = q;
      along = normalize(ab);
    }
  }
  // A place on the crack is there once the crack has run to it: the tip is a hair and what lies behind it has its width.
  float run = uCrack.x * 1.03 - tau;
  if (run <= 0.0) discard;
  float mm = best * ${f(RS)};
  // Thinner than a pixel, it is spread over nearly two with the same light, so that it does not break into dots that crawl.
  float px = 1.8 * max(max(length(dFdx(vStageLocal)), length(dFdy(vStageLocal))), 1e-4);
  float taper = smoothstep(0.0, 0.07, run) * mix(1.0, 0.45, smoothstep(0.35, 1.0, tau));
  float w = ${f(C.widthMm)} * taper;
  float core = clamp((0.5 * (w + px) - mm) / px, 0.0, min(1.0, w / px));
  vec3 across = normalize(cross(along, at));
  float side = dot(d - at, across) * ${f(RS)};
  vec3 n = normalize(vAxisX * d.x + vAxisY * d.y + vAxisZ * d.z);
  vec3 v = normalize(vStageWorld - cameraPosition);
  vec3 acrossW = normalize(vAxisX * across.x + vAxisY * across.y + vAxisZ * across.z);
  // The bright edge lies on the side of the crack that faces the key.
  float lit = dot(acrossW, uKeyDir) > 0.0 ? 1.0 : -1.0;
  float we = ${f(C.edgeMm)} * (0.4 + 0.6 * taper);
  float edge = clamp((0.5 * (we + px) - abs(side * lit - 0.5 * (w + we))) / px, 0.0, min(1.0, we / px));
  float arc = tau * ${f(CRACK_LENGTH_MM * C.glintPerMm)};
  float g = crackGlint(arc);
  float g2 = crackGlint(arc * 3.7 + 19.0);
  vec3 face = normalize(n + acrossW * (lit * (0.5 + 0.9 * g2)) + cross(n, acrossW) * (g - 0.5));
  vec3 r = reflect(v, face);
  vec3 light = uSky * ${f(C.sky)} + uKeyCol * (0.2 + ${f(C.key)} * pow(max(dot(r, uKeyDir), 0.0), 6.0)) + uRimCol * (0.15 + ${f(C.rim)} * pow(max(dot(r, uRimDir), 0.0), 4.0)) + stageRoomLights(r, 0.08) * ${f(C.room)};
  float flash = 0.22 + 3.2 * g * g * g + 1.5 * (1.0 - smoothstep(0.0, 0.05, run)) * step(uCrack.x, 0.999);
  // It catches the light in stretches and is a faint hair between them, fainter still toward its tips.
  vec2 fromStart = d.xy - CRACK_A[0].xy;
  float stretch = crackGlint(tau * ${f(CRACK_LENGTH_MM * C.catchPerMm)} + 9.0 * floor(4.0 * (dot(fromStart, fromStart) > 0.0 ? atan(fromStart.y, fromStart.x) : 0.0) / 6.2831853 + 0.5) + 40.0);
  float caught = mix(${f(C.faint)}, 1.0, smoothstep(0.38, 0.72, stretch)) * mix(1.0, 0.35, smoothstep(0.6, 1.0, tau));
  vec3 col = light * ${vec(C.warm)} * (${f(C.bright)} * flash) * edge * caught + uSky * (0.3 * ${f(C.shade)} * core);
  float alpha = max(${f(C.shade)} * core, 0.85 * edge * caught);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha) * seen;
  if (uDiag != 0) {
    if (alpha * seen < 0.3) discard;
    gl_FragColor = stageDiag(vec3(0.8), n, 0.0, c, 0.0);
  }
}
`

const blend = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const

/** The fog's sheets: planes across the inside of the glass from back to front, each cut to the circle of the dome at its depth. */
function sheets(): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const reach = RI - 1.5
  // The liquid bends what is inside at every corner of a sheet, and most near the wall: the corners crowd there.
  const cols = 16
  const rows = 12
  const crowd = (t: number): number => Math.sin((t - 0.5) * Math.PI)
  for (let s = 0; s < F.sheets; s++) {
    const z = -reach + s * FOG_STEP
    const half = Math.sqrt(Math.max(0, RI * RI - z * z))
    if (half < 2) continue
    const base = pos.length / 3
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) pos.push(crowd(i / cols) * half, crowd(j / rows) * half, z)
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = base + j * (cols + 1) + i
        const b = a + cols + 1
        idx.push(a, a + 1, b, a + 1, b + 1, b)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

function makeFog(): THREE.Mesh {
  uniforms.uFogNoise.value ??= fogNoise()
  const m = stageShader({
    part: PART,
    standIn: false,
    inside: true,
    change: 'veil',
    uniforms: { uFog: uniforms.uFog, uFogNoise: uniforms.uFogNoise, uFogTurn: uniforms.uFogTurn },
    fragment: FOG,
    // Drawn with the solid things, after the particles and before the glass stamps its depth: what is inside the liquid is
    // closed by that stamp to everything drawn later.
    params: { ...blend, transparent: false, side: THREE.DoubleSide },
  })
  volumes.push(m)
  const mesh = new THREE.Mesh(sheets(), m)
  mesh.renderOrder = 5.5
  mesh.frustumCulled = false
  return mesh
}

const volumes: THREE.ShaderMaterial[] = []

function makeLip(): THREE.Mesh {
  const r = RI - 0.3
  const from = Math.acos((MOUND.top + 3 + F.lipRiseMm * 1.3) / r)
  const to = Math.acos(-50 / r)
  const m = stageShader({
    part: PART,
    standIn: false,
    inside: true,
    change: 'veil',
    uniforms: { uFog: uniforms.uFog, uFogNoise: uniforms.uFogNoise, uFogTurn: uniforms.uFogTurn },
    fragment: LIP,
    params: { ...blend, transparent: false, side: THREE.DoubleSide },
  })
  volumes.push(m)
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 12, 0, Math.PI * 2, from, to - from), m)
  mesh.renderOrder = 5.4
  mesh.frustumCulled = false
  return mesh
}

function makeCrack(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { ...roomUniforms, ...lightUniforms, uCrack: uniforms.uCrack },
    vertexPars: 'varying vec3 vAxisX;\nvarying vec3 vAxisY;\nvarying vec3 vAxisZ;',
    vertexMain: 'vAxisX = normalize(modelMatrix[0].xyz);\nvAxisY = normalize(modelMatrix[1].xyz);\nvAxisZ = normalize(modelMatrix[2].xyz);',
    fragment: CRACK,
    params: { ...blend, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RS + 0.06, 96, 64), m)
  mesh.renderOrder = 11
  mesh.frustumCulled = false
  return mesh
}

let group: THREE.Group | null = null

export function dressing(): THREE.Object3D {
  group ??= new THREE.Group().add(makeLip(), makeFog(), makeCrack())
  return group
}

export async function prepare(): Promise<void> {}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const ease = (v: number): number => {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}

/** How far the crack has spread, seconds after the landing: it runs in three starts, most of the way with the first. */
export function crackSpread(seconds: number): number {
  return 0.52 * ease(seconds / 0.14) + 0.3 * ease((seconds - 0.2) / 0.22) + 0.18 * ease((seconds - 0.55) / 0.4)
}

/** How far the fog is lifted out of its pool by the landing, 1 through the whole dome to 0 pooled. */
export function fogLift(seconds: number): number {
  const t = clamp01((seconds - 0.3) / 6.2)
  return Math.pow(1 - t, 2.2)
}

export function update(moment: KitMoment): void {
  const fr = moment.frame
  const settle = config.shake.settleCheckSeconds
  // In a shake the season that leaves keeps what it has (`arrived` 1) and the one that comes has nothing until it lands.
  const shaken = moment.beat !== null
  const since = shaken ? (moment.arrived >= 1 ? Infinity : moment.arrived * settle) : Math.max(0, moment.sinceLanding)
  const landed = shaken ? 1 - clamp01(moment.arrived) : fogLift(since)
  const stirred = ease((fr.turbulence - 0.04) / 0.5)
  const lift = Math.max(landed, stirred)
  const pour = shaken || !Number.isFinite(since) ? 0 : ease(since / 0.6) * (1 - ease((since - 2.6) / 4.2))
  const fallen = Number.isFinite(since) ? look.fog.pourFallMm * (1 - Math.exp(-since / 2.4)) : look.fog.pourFallMm
  uniforms.uFog.value.set(fr.clock, lift, pour, fallen)
  // The stirred fog goes round with the liquid: at the shake's rate until the landing, then it spins down.
  const spun = Number.isFinite(since) ? moment.time - since + F.spinDownSeconds * (1 - Math.exp(-since / F.spinDownSeconds)) : moment.time
  // It floods the dome while the liquid is thrown about, and so through the swap. Over the set down it eases to the little
  // that the landed picture holds, keeps that until the landed still, and then goes with the vortex. No step anywhere.
  const stir = ease((fr.turbulence - F.floodFrom) / (F.floodTo - F.floodFrom))
  const swap = config.shake.swapWindow
  let flood = 0
  if (shaken) {
    const beats = config.shake.liftBeats + config.shake.strokeBeats + config.shake.setDownBeats
    const thrown = Math.max(stir * stir, ease((moment.beat! - config.shake.liftBeats) / (swap.fromBeat - config.shake.liftBeats)))
    flood = thrown + (F.floodHeld - thrown) * ease((moment.beat! - swap.toBeat) / (beats - swap.toBeat))
  } else if (Number.isFinite(since)) flood = F.floodHeld * (1 - ease((since - config.states.landedSeconds) / F.floodGoneSeconds))
  uniforms.uFogTurn.value.set(F.spinRadS * spun, flood)
  loadLean(fr.liquid, uniforms.uFogLean.value)
  // The cover view counts what is hidden of the miniature only: there the fog is laid on where the miniature already is.
  const src = fr.view === 'cover' ? THREE.DstAlphaFactor : THREE.OneFactor
  for (const m of volumes) m.blendSrc = src
  uniforms.uCrack.value.x = Number.isFinite(since) ? crackSpread(since) : 1
}

