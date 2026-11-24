import { config } from '../../config'
import { hash2, unit } from '../../core/rng'
import type { SdfGrid } from '../../core/stage'
import { globePoseAt, seasonAt, type Timeline } from '../../film/timeline'
import { Liquid, LIQUID_LENGTH, LIQUID_R, LIQUID_SWIRL, NOISE_N, ROLL_AXIS, ROLL_CENTRE, ROLL_EDGE, ROLL_FLOOR_MM, ROLL_FLOOR_SLOPE, ROLL_FREE, ROLL_RISE_MM, ROLL_SLAB_MM, SOLID_REACH_MM, TURBULENCE_MAX } from '../../globe/liquid'
import { BEHAVIOUR, KINDS, KIND_IN, NONE, POOL, SEASONS, type Behaviour } from './kinds'
import { blockoutEmitters, blockoutSdf, GROUND_Y, sdfSample, sdfSlope, type Emitter } from './sdf'

const HZ = config.sim.stepHz
export const DT = 1 / HZ
const TAU = Math.PI * 2
const R = LIQUID_R
const INV_R2 = 1 / (R * R)
export const WALL = R - 0.3
const WALL2 = WALL * WALL
const COARSE = 3
const INV_COARSE = 1 / COARSE
const RAMP = SOLID_REACH_MM
const INV_RAMP = 1 / RAMP
const R2 = R * R
const SKIN = 0.02
const LANDS_LEAST = 0.75
const FLOATS_LEAST = 0.3
// the calm snowfall is under way before the first frame: a flake that keeps falling starts in the air for the share of its round that it falls
// (this many mm of fall at its own speed against its mean wait on the ground), anywhere on its way down; the others wait what a waiting flake has left
const CALM_FALL_MM = 48
const PUSHES = 3
export const COVER_N = 96
export const COVER_SPAN_MM = 2 * R
export const COVER_CAP_MM = 4
const COVER_KNEE_MM = COVER_CAP_MM * 0.75
const COVER_ROOM_MM = COVER_CAP_MM - COVER_KNEE_MM
const COVER_PASSES = 3
const COVER_CELL_MM2 = (COVER_SPAN_MM / COVER_N) * (COVER_SPAN_MM / COVER_N)
const INV_FADE_IN = 1 / 1.4
const INV_FADE_OUT = 1 / 0.7
export const SWAP_HALF = 0.22
const HOLD = 0.6
const GRAVITY_MM = 9810
const STEER_GAIN = 1.5
const CURL = 2.5 / (R * R)
const NOISE_INV_CELL = (NOISE_N - 1) / (2 * R)
const NOISE_TOP = NOISE_N - 1.0001
const NOISE_DY = NOISE_N * 3
const NOISE_DZ = NOISE_N * NOISE_N * 3
const NN = NOISE_N
const AX = ROLL_AXIS[0]
const AY = ROLL_AXIS[1]
const AZ = ROLL_AXIS[2]
const CX = ROLL_CENTRE[0]
const CY = ROLL_CENTRE[1]
const CZ = ROLL_CENTRE[2]
const INV_FREE = 1 / ROLL_FREE
const INV_RISE = 1 / ROLL_RISE_MM
const SLAB2 = ROLL_SLAB_MM * ROLL_SLAB_MM
const SKIM_X = AZ + ROLL_FLOOR_SLOPE * AY
const SKIM_Y = -ROLL_FLOOR_SLOPE * AX
const SKIM_Z = -AX
const SIDE = Math.hypot(AY, AZ)
const E2Y = AZ / SIDE
const E2Z = -AY / SIDE
const ARMS = 3
const ARM_MM_S = 150
const ARM_CORE = 0.15
const ARM_WIND = 4
const ARM_TWIST = (TAU / 3) / 18
const ROLL_SOFT = 1
const ARM_HUB2 = 12 * 12
const BANK_GAIN = 4.5
const BANK_LIGHT = 4
const BANK_LOW = 0.2
const BALL_ROOM_MM = 0.1
const BANK_FROM = 6 / ROLL_RISE_MM
const BANK_OVER = ROLL_RISE_MM / (48 - 6)
const LEAP2 = 3 * 3

const TABLE = 4096
const MASK = TABLE - 1
const QUARTER = TABLE / 4
const TABLE_K = TABLE / TAU
const SIN = new Float64Array(TABLE)
for (let j = 0; j < TABLE; j++) SIN[j] = Math.sin(j / TABLE_K)

export const STATE_LIQUID = 0
export const STATE_REST = 1
export const STATE_SNAG = 2
export const STATE_HIDDEN = 3
const FADING = 1

const NK = KINDS.length
const TABLE_OF: Behaviour[] = KINDS.map((k) => BEHAVIOUR[k]!)
const K_MODE = new Uint8Array(NK)
const K_REST = new Uint8Array(NK)
const K_SWAY = new Float64Array(NK)
const K_CROSS = new Float64Array(NK)
const K_DIP = new Float64Array(NK)
const K_SPIN = new Float64Array(NK)
const K_SLOPE = new Float64Array(NK)
const K_REST2 = new Float64Array(NK)
const K_KICK = new Float64Array(NK)
const K_CRUISE = new Float64Array(NK)
const K_REACH = new Float64Array(NK)
const K_CLEAR = new Float64Array(NK)
const EVERY = 4
const H = DT * EVERY
const LEAD = 0.5 * H
const ahead = (x: number, s: number): number => Math.fround(Math.fround(Math.fround(Math.fround(x + s) + s) + s) + s)
const K_BLEND = new Float64Array(NK)
const K_GRIP = new Float64Array(NK)
const K_LOFT = new Float64Array(NK)
const K_GATHER = new Float64Array(NK)
let lowest = Infinity
TABLE_OF.forEach((b, k) => {
  K_MODE[k] = b.mode === 'steer' ? 1 : b.mode === 'cycle' ? 2 : 0
  K_REST[k] = b.rest === 'lies' ? STATE_REST : b.rest === 'snags' ? STATE_SNAG : 0
  K_SWAY[k] = b.swayMmS
  K_CROSS[k] = b.crossMmS
  K_DIP[k] = b.dip
  K_SPIN[k] = b.spinPerMm
  K_SLOPE[k] = b.slope
  K_REST2[k] = b.restSpeedMmS * b.restSpeedMmS
  K_KICK[k] = b.kick
  K_CRUISE[k] = b.cruiseMmS
  K_REACH[k] = b.reachMm
  K_CLEAR[k] = b.clearanceMm
  K_BLEND[k] = 1 - Math.exp(-H / b.followSeconds)
  K_GRIP[k] = 1 / (1 + b.gripPerSecond * H)
  K_LOFT[k] = b.rest === 'lies' ? b.loft : 0
  K_GATHER[k] = b.mode === 'drift' ? b.gather : 0
  if (b.rest !== 'never') lowest = Math.min(lowest, b.liftMmS[0])
})
const MIN_LIFT = lowest

const bell = (u: number, v: number): number => Math.sqrt(-2 * Math.log(u > 1e-9 ? u : 1e-9)) * Math.cos(TAU * v)

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export const emberGlow = (a: number): number => smooth(a / 0.12) * smooth((1 - a) / 0.5)

const RATES = new Float64Array(3)

export function wanderRates(i: number, kind: number, loopSeconds: number, out: Float64Array): void {
  const b = TABLE_OF[kind]!
  const snap = (w: number): number => (loopSeconds > 0 ? (TAU * Math.max(1, Math.round((w * loopSeconds) / TAU))) / loopSeconds : w)
  if (b.orbit) {
    const ring = b.reachMm * (0.55 + 0.45 * unit(hash2(i, 61)))
    out[0] = snap(b.cruiseMmS / ring)
    out[1] = 2 * out[0]!
    out[2] = out[0]!
    return
  }
  const rate = b.cruiseMmS / b.reachMm
  out[0] = snap(rate * (0.35 + 0.5 * unit(hash2(i, 64))))
  out[1] = snap(rate * (0.35 + 0.5 * unit(hash2(i, 65))))
  out[2] = snap(rate * (0.35 + 0.5 * unit(hash2(i, 66))))
}

export function wanderAt(i: number, kind: number, home: ArrayLike<number>, time: number, loopSeconds: number, out: Float64Array): void {
  const o = i * 3
  const b = TABLE_OF[kind]!
  wanderRates(i, kind, loopSeconds, RATES)
  if (b.orbit) {
    const ring = b.reachMm * (0.55 + 0.45 * unit(hash2(i, 61)))
    const a = RATES[0]! * time + unit(hash2(i, 62)) * TAU
    out[0] = home[o]! + ring * Math.cos(a)
    out[1] = home[o + 1]! + 2.5 * Math.sin(2 * a + unit(hash2(i, 63)) * TAU)
    out[2] = home[o + 2]! + ring * Math.sin(a)
    return
  }
  const reach = b.reachMm * 0.7
  out[0] = home[o]! + reach * Math.sin(RATES[0]! * time + unit(hash2(i, 67)) * TAU)
  out[1] = home[o + 1]! + reach * 0.5 * Math.sin(RATES[1]! * time + unit(hash2(i, 68)) * TAU)
  out[2] = home[o + 2]! + reach * Math.sin(RATES[2]! * time + unit(hash2(i, 69)) * TAU)
}

export interface EngineOptions {
  season?: string
  fraction?: number
  collider?: SdfGrid | ((season: string) => SdfGrid)
  emitters?: Record<string, Emitter[]>
}

export interface EngineSnapshot {
  step: number
  pos: Float32Array
  prev: Float32Array
  vel: Float32Array
  state: Uint8Array
  liquid: Float64Array
  phase: Float32Array
  fade: Float32Array
  opacity: Float32Array
  stamp: Int32Array
  kindOf: Uint8Array
  era: Uint8Array
  mark: Uint8Array
  now: number
  start: number
}

export function packSnapshot(s: EngineSnapshot): ArrayBuffer {
  const n = s.state.length
  const l = s.liquid.length
  const buf = new ArrayBuffer(16 + l * 8 + n * 52 + n * 4)
  const head = new Uint32Array(buf, 0, 4)
  head[0] = s.step
  head[1] = n
  head[2] = s.now
  head[3] = s.start
  new Float64Array(buf, 16, l).set(s.liquid)
  let o = 16 + l * 8
  for (const part of [s.pos, s.prev, s.vel]) {
    new Float32Array(buf, o, n * 3).set(part)
    o += n * 12
  }
  for (const part of [s.phase, s.fade, s.opacity]) {
    new Float32Array(buf, o, n).set(part)
    o += n * 4
  }
  new Int32Array(buf, o, n).set(s.stamp)
  o += n * 4
  for (const part of [s.state, s.kindOf, s.era, s.mark]) {
    new Uint8Array(buf, o, n).set(part)
    o += n
  }
  return buf
}

export function unpackSnapshot(buf: ArrayBuffer, liquidLength: number = LIQUID_LENGTH): EngineSnapshot {
  const head = new Uint32Array(buf, 0, 4)
  const n = head[1]!
  const liquid = new Float64Array(buf.slice(16, 16 + liquidLength * 8))
  let o = 16 + liquidLength * 8
  const floats = (per: number): Float32Array => {
    const part = new Float32Array(buf.slice(o, o + n * per * 4))
    o += n * per * 4
    return part
  }
  const pos = floats(3)
  const prev = floats(3)
  const vel = floats(3)
  const phase = floats(1)
  const fade = floats(1)
  const opacity = floats(1)
  const stamp = new Int32Array(buf.slice(o, o + n * 4))
  o += n * 4
  const bytes = (): Uint8Array => {
    const part = new Uint8Array(buf.slice(o, o + n))
    o += n
    return part
  }
  const state = bytes()
  const kindOf = bytes()
  const era = bytes()
  const mark = bytes()
  return { step: head[0]!, pos, prev, vel, state, liquid, phase, fade, opacity, stamp, kindOf, era, mark, now: head[2]!, start: head[3]! }
}

interface Grid {
  n: number
  nn: number
  scale: number
  half: number
  top: number
  inv: number
  data: Float32Array
  far: Float32Array
  fn: number
  ring: Float32Array
  source: SdfGrid
  park: [number, number, number]
}

export function parkPoint(source: SdfGrid): [number, number, number] {
  const park: [number, number, number] = [0, 0, 0]
  const g = new Float64Array(3)
  const cells = 14
  let best = -Infinity
  for (let c = 0; c < cells * cells * cells; c++) {
    const x = (((c % cells) + 0.5) / cells) * 2 * WALL - WALL
    const y = (((Math.floor(c / cells) % cells) + 0.5) / cells) * 2 * WALL - WALL
    const z = ((Math.floor(c / (cells * cells)) + 0.5) / cells) * 2 * WALL - WALL
    const room = Math.min(sdfSample(source, x, y, z, g), WALL - Math.sqrt(x * x + y * y + z * z))
    if (room > best) {
      best = room
      park[0] = x
      park[1] = y
      park[2] = z
    }
  }
  return park
}

function farOf(source: SdfGrid, fn: number): Float32Array {
  const n = source.n
  const d = source.data
  const far = new Float32Array(fn * fn * fn)
  for (let c = 0; c < far.length; c++) {
    const x0 = (c % fn) * COARSE
    const y0 = (Math.floor(c / fn) % fn) * COARSE
    const z0 = Math.floor(c / (fn * fn)) * COARSE
    let least = Infinity
    for (let z = z0; z <= z0 + COARSE && z < n; z++) {
      for (let y = y0; y <= y0 + COARSE && y < n; y++) {
        for (let x = x0; x <= x0 + COARSE && x < n; x++) least = Math.min(least, d[x + n * (y + n * z)]!)
      }
    }
    far[c] = least
  }
  return far
}

function ringOf(source: SdfGrid): Float32Array {
  const n = source.n
  const nn = n * n
  const d = source.data
  const cell = source.sizeMm / (n - 1)
  const half = source.sizeMm / 2
  const ring = new Float32Array(n)
  const known = new Uint8Array(n)
  for (let j = 1; j < n - 1; j++) {
    const y = -half + j * cell
    let sum = 0
    let weight = 0
    for (let k = 1; k < n - 1; k++) {
      const z = -half + k * cell
      for (let i = 1; i < n - 1; i++) {
        const o = i + n * (j + n * k)
        const v = d[o]!
        if (v < 0 || v > cell) continue
        const x = -half + i * cell
        if (x * x + y * y + z * z > WALL2) continue
        const gx = d[o + 1]! - d[o - 1]!
        const gy = d[o + n]! - d[o - n]!
        const gz = d[o + nn]! - d[o - nn]!
        const g2 = gx * gx + gy * gy + gz * gz
        if (g2 < 1e-12) continue
        const w = (gx * gx + gz * gz) / g2
        sum += w * (x * x + z * z)
        weight += w
      }
    }
    if (weight > 0.5) {
      ring[j] = sum / weight
      known[j] = 1
    }
  }
  let last = -1
  for (let j = 0; j < n; j++) {
    if (known[j]) last = j
    else if (last >= 0) ring[j] = ring[last]!
  }
  last = -1
  for (let j = n - 1; j >= 0; j--) {
    if (known[j]) last = j
    else if (last >= 0 && ring[j] === 0) ring[j] = ring[last]!
  }
  const blur = new Float32Array(n)
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < n; j++) blur[j] = 0.25 * ring[j > 0 ? j - 1 : j]! + 0.5 * ring[j]! + 0.25 * ring[j < n - 1 ? j + 1 : j]!
    ring.set(blur)
  }
  return ring
}

function gridOf(source: SdfGrid): Grid {
  const fn = Math.ceil((source.n - 1) / COARSE)
  return { n: source.n, nn: source.n * source.n, scale: (source.n - 1) / source.sizeMm, half: source.sizeMm / 2, top: source.n - 1.001, inv: 1 / sdfSlope(source), data: source.data, far: farOf(source, fn), fn, ring: ringOf(source), source, park: parkPoint(source) }
}

function probe(G: Grid, x: number, y: number, z: number, out: Float64Array): number {
  const top = G.top
  let fx = (x + G.half) * G.scale
  let fy = (y + G.half) * G.scale
  let fz = (z + G.half) * G.scale
  fx = fx < 0 ? 0 : fx > top ? top : fx
  fy = fy < 0 ? 0 : fy > top ? top : fy
  fz = fz < 0 ? 0 : fz > top ? top : fz
  const open = G.far[((fx * INV_COARSE) | 0) + G.fn * (((fy * INV_COARSE) | 0) + G.fn * ((fz * INV_COARSE) | 0))]!
  if (open >= RAMP) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    return open
  }
  const gn = G.n
  const data = G.data
  const ix = fx | 0
  const iy = fy | 0
  const iz = fz | 0
  const tx = fx - ix
  const ty = fy - iy
  const tz = fz - iz
  const p0 = ix + gn * (iy + gn * iz)
  const p4 = p0 + G.nn
  const va = data[p0]!
  const vb = data[p0 + 1]!
  const vc = data[p0 + gn]!
  const ve = data[p0 + gn + 1]!
  const vf = data[p4]!
  const vg = data[p4 + 1]!
  const vh = data[p4 + gn]!
  const vm = data[p4 + gn + 1]!
  const x00 = va + (vb - va) * tx
  const x10 = vc + (ve - vc) * tx
  const x01 = vf + (vg - vf) * tx
  const x11 = vh + (vm - vh) * tx
  const y0 = x00 + (x10 - x00) * ty
  const y1 = x01 + (x11 - x01) * ty
  out[0] = (((vb - va) * (1 - ty) + (ve - vc) * ty) * (1 - tz) + ((vg - vf) * (1 - ty) + (vm - vh) * ty) * tz) * G.scale
  out[1] = ((x10 - x00) * (1 - tz) + (x11 - x01) * tz) * G.scale
  out[2] = (y1 - y0) * G.scale
  return y0 + (y1 - y0) * tz
}

export function heapCover(n: number, state: Uint8Array, xyz: Float32Array, sizes: Float32Array, kindOf: Uint8Array, heap: Float32Array, out: Float32Array): void {
  const scale = COVER_N / COVER_SPAN_MM
  const each = POOL / n / COVER_CELL_MM2
  heap.fill(0)
  for (let i = 0; i < n; i++) {
    if (state[i] !== STATE_REST) continue
    const loft = K_LOFT[kindOf[i]!]!
    if (loft === 0) continue
    const o = i * 3
    const fx = (xyz[o]! + R) * scale - 0.5
    const fz = (xyz[o + 2]! + R) * scale - 0.5
    const ix = Math.floor(fx)
    const iz = Math.floor(fz)
    if (ix < 0 || iz < 0 || ix >= COVER_N - 1 || iz >= COVER_N - 1) continue
    const tx = fx - ix
    const tz = fz - iz
    const d = sizes[i]!
    const v = loft * d * d * each
    const c = iz * COVER_N + ix
    heap[c] = heap[c]! + v * (1 - tx) * (1 - tz)
    heap[c + 1] = heap[c + 1]! + v * tx * (1 - tz)
    heap[c + COVER_N] = heap[c + COVER_N]! + v * (1 - tx) * tz
    heap[c + COVER_N + 1] = heap[c + COVER_N + 1]! + v * tx * tz
  }
  for (let pass = 0; pass < COVER_PASSES; pass++) {
    for (let j = 0; j < COVER_N; j++) {
      const row = j * COVER_N
      for (let i = 0; i < COVER_N; i++) {
        const a = heap[row + (i > 0 ? i - 1 : i)]!
        const b = heap[row + (i < COVER_N - 1 ? i + 1 : i)]!
        out[row + i] = 0.25 * a + 0.5 * heap[row + i]! + 0.25 * b
      }
    }
    for (let j = 0; j < COVER_N; j++) {
      const up = (j > 0 ? j - 1 : j) * COVER_N
      const down = (j < COVER_N - 1 ? j + 1 : j) * COVER_N
      const row = j * COVER_N
      for (let i = 0; i < COVER_N; i++) heap[row + i] = 0.25 * out[up + i]! + 0.5 * out[row + i]! + 0.25 * out[down + i]!
    }
  }
  for (let c = 0; c < out.length; c++) {
    const v = heap[c]!
    const over = v - COVER_KNEE_MM
    out[c] = over > 0 ? COVER_KNEE_MM + (COVER_ROOM_MM * over) / (over + COVER_ROOM_MM) : v
  }
}

export class ParticleEngine {
  readonly count: number
  readonly kinds: readonly string[] = KINDS
  readonly season: string
  private readonly xyz: Float32Array
  private readonly old: Float32Array
  readonly vel: Float32Array
  readonly phase: Float32Array
  readonly fade: Float32Array
  readonly opacity: Float32Array
  readonly sizes: Float32Array
  readonly kindOf: Uint8Array
  readonly state: Uint8Array
  readonly era: Uint8Array
  readonly mark: Uint8Array
  readonly stamp: Int32Array
  readonly home: Float32Array
  readonly liquid: Float64Array
  readonly model = new Liquid()
  step = 0

  private readonly base: Int32Array
  private readonly feel: Float32Array
  readonly sink: Float32Array
  readonly lift: Float32Array
  private readonly layer: Float32Array
  readonly turnRate: Float32Array
  readonly life: Float32Array
  private readonly swapAt: Float32Array
  private readonly renews: Uint8Array
  private readonly heap = new Float32Array(COVER_N * COVER_N)
  private readonly lain = { n: COVER_N, spanMm: COVER_SPAN_MM, mm: new Float32Array(COVER_N * COVER_N) }
  private drifted = true
  private behind = false
  private startIx: number
  private nowIx: number
  private window = 0
  private swapTo = 0
  private change = 0
  private pending = true
  private collider: SdfGrid | ((season: string) => SdfGrid)
  private emitters: Record<string, Emitter[]>
  private readonly grids: (Grid | null)[] = SEASONS.map(() => null)
  private readonly starts: (EngineSnapshot | null)[] = SEASONS.map(() => null)
  private readonly g = new Float64Array(3)
  private readonly u = new Float64Array(3)
  private readonly q = new Float64Array(3)

  constructor(options: EngineOptions = {}) {
    const season = options.season ?? config.defaultSeason
    const ix = SEASONS.indexOf(season)
    if (ix < 0) throw new Error(`no such season: ${season}`)
    this.season = season
    this.startIx = ix
    this.nowIx = ix
    this.collider = options.collider ?? blockoutSdf()
    this.emitters = options.emitters ?? (options.collider ? {} : blockoutEmitters())
    const n = Math.max(1, Math.min(POOL, Math.round(POOL * (options.fraction ?? 1))))
    this.count = n
    this.xyz = new Float32Array(n * 3)
    this.old = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.home = new Float32Array(n * 3)
    this.phase = new Float32Array(n)
    this.fade = new Float32Array(n)
    this.opacity = new Float32Array(n)
    this.sizes = new Float32Array(n)
    this.base = new Int32Array(n)
    this.feel = new Float32Array(n * 4).fill(NaN)
    this.sink = new Float32Array(n)
    this.lift = new Float32Array(n)
    this.layer = new Float32Array(n)
    this.turnRate = new Float32Array(n)
    this.life = new Float32Array(n)
    this.swapAt = new Float32Array(n)
    this.kindOf = new Uint8Array(n)
    this.state = new Uint8Array(n).fill(STATE_HIDDEN)
    this.era = new Uint8Array(n).fill(ix)
    this.mark = new Uint8Array(n)
    this.renews = new Uint8Array(n)
    this.stamp = new Int32Array(n)
    this.liquid = this.model.state
    for (let i = 0; i < n; i++) this.swapAt[i] = SWAP_HALF + (1 - 2 * SWAP_HALF) * unit(hash2(i, 5))
  }

  get seasonNow(): string {
    return SEASONS[this.nowIx]!
  }

  get awake(): number {
    return this.floating()
  }

  get pos(): Float32Array {
    if (this.pending) this.reset()
    if (this.behind) this.present()
    return this.xyz
  }

  get prev(): Float32Array {
    if (this.pending) this.reset()
    if (this.behind) this.present()
    return this.old
  }

  get cover(): { readonly n: number; readonly spanMm: number; readonly mm: Float32Array } {
    if (this.drifted) this.heapUp()
    return this.lain
  }

  setCollider(collider: SdfGrid | ((season: string) => SdfGrid), emitters?: Record<string, Emitter[]>): void {
    this.collider = collider
    if (emitters) this.emitters = emitters
    this.grids.fill(null)
    this.starts.fill(null)
    this.pending = true
  }

  colliderOf(season: string): SdfGrid {
    return this.grid(SEASONS.indexOf(season)).source
  }

  reset(season?: string): void {
    if (season !== undefined) {
      const ix = SEASONS.indexOf(season)
      if (ix < 0) throw new Error(`no such season: ${season}`)
      this.startIx = ix
    }
    const ix = this.startIx
    const kept = this.starts[ix]
    this.pending = false
    if (kept) this.restore(kept)
    else {
      this.init(ix)
      this.starts[ix] = this.snapshot()
    }
    this.model.reset()
  }

  stir(x: number, y: number, z: number): void {
    this.model.stir(x, y, z)
  }

  floating(): number {
    let c = 0
    for (let i = 0; i < this.count; i++) if (this.state[i] === STATE_LIQUID) c++
    return c
  }

  snapshot(): EngineSnapshot {
    if (this.pending) this.reset()
    if (this.behind) this.present()
    return {
      step: this.step,
      pos: this.xyz.slice(),
      prev: this.old.slice(),
      vel: this.vel.slice(),
      state: this.state.slice(),
      liquid: this.liquid.slice(),
      phase: this.phase.slice(),
      fade: this.fade.slice(),
      opacity: this.opacity.slice(),
      stamp: this.stamp.slice(),
      kindOf: this.kindOf.slice(),
      era: this.era.slice(),
      mark: this.mark.slice(),
      now: this.nowIx,
      start: this.startIx,
    }
  }

  restore(s: EngineSnapshot): void {
    const n = this.count
    if (s.state.length !== n) throw new Error(`the snapshot holds ${s.state.length} particles, the engine ${n}`)
    this.step = s.step
    this.xyz.set(s.pos)
    this.old.set(s.prev)
    this.vel.set(s.vel)
    this.liquid.set(s.liquid)
    this.phase.set(s.phase)
    this.fade.set(s.fade)
    this.opacity.set(s.opacity)
    this.stamp.set(s.stamp)
    this.mark.set(s.mark)
    this.state.set(s.state)
    this.nowIx = s.now
    this.startIx = s.start
    this.window = 0
    const state = this.state
    for (let i = 0; i < n; i++) {
      const k = s.kindOf[i]!
      const e = s.era[i]!
      const st = state[i]!
      this.kindOf[i] = k
      this.era[i] = e
      if (st === STATE_HIDDEN) {
        this.sizes[i] = 0
        continue
      }
      this.assign(i, k)
      if (K_MODE[k] === 1) this.nest(i, k, e)
    }
    this.base.fill(this.step)
    this.feel.fill(NaN)
    this.model.prepare(Math.max(0, this.step - 1) * DT)
    this.behind = false
    this.drifted = true
    this.pending = false
  }

  advanceTo(target: number, tl: Timeline): void {
    if (this.pending) this.reset()
    if (this.step === 0 && target > 0) {
      const ix = SEASONS.indexOf(tl.startSeason)
      if (ix >= 0 && (ix !== this.startIx || ix !== this.nowIx)) this.reset(tl.startSeason)
    }
    while (this.step < target) this.stepOnce(tl)
  }

  private present(): void {
    const n = this.count
    const now = this.step
    const state = this.state
    const base = this.base
    const xyz = this.xyz
    const old = this.old
    const vel = this.vel
    this.behind = false
    for (let i = 0; i < n; i++) {
      if (state[i] !== STATE_LIQUID) continue
      let lag = now - base[i]!
      if (lag <= 0) continue
      base[i] = now
      const o = i * 3
      const vx = vel[o]! * DT
      const vy = vel[o + 1]! * DT
      const vz = vel[o + 2]! * DT
      let x = xyz[o]!
      let y = xyz[o + 1]!
      let z = xyz[o + 2]!
      while (lag > 1) {
        x = Math.fround(x + vx)
        y = Math.fround(y + vy)
        z = Math.fround(z + vz)
        lag--
      }
      old[o] = x
      old[o + 1] = y
      old[o + 2] = z
      xyz[o] = x + vx
      xyz[o + 1] = y + vy
      xyz[o + 2] = z + vz
    }
  }

  private heapUp(): void {
    heapCover(this.count, this.state, this.xyz, this.sizes, this.kindOf, this.heap, this.lain.mm)
    this.drifted = false
  }

  private grid(ix: number): Grid {
    let g = this.grids[ix]
    if (!g) {
      const c = this.collider
      g = gridOf(typeof c === 'function' ? c(SEASONS[ix]!) : c)
      this.grids[ix] = g
    }
    return g
  }

  private assign(i: number, k: number): void {
    const b = TABLE_OF[k]!
    const u1 = unit(hash2(i, 101 + k))
    const u2 = unit(hash2(i, 131 + k))
    const u3 = unit(hash2(i, 151 + k))
    const u4 = unit(hash2(i, 171 + k))
    const u5 = unit(hash2(i, 191 + k))
    const lands = b.settleMmS[1] > 0 && u5 >= Math.max(b.renew, b.floats)
    const snows = u5 < b.renew && b.renewMmS[1] > 0
    const fall = lands ? b.settleMmS : snows ? b.renewMmS : b.sinkMmS
    if (b.sizeSigma > 0) {
      const wide = bell(u1, unit(hash2(i, 211 + k)))
      // what keeps falling from the top is the fine share: the big flakes settle first and stay down
      const raw = b.sizeMedianMm * Math.exp(b.sizeSigma * (snows && wide > 0 ? -wide : wide))
      const size = raw < b.sizeMm[0] ? b.sizeMm[0] : raw > b.sizeMm[1] ? b.sizeMm[1] : raw
      const spread = lands || snows ? b.sinkSigma : size > b.sizeMedianMm ? b.hangSigma * Math.sqrt(b.sizeMedianMm / size) : b.hangSigma
      const speed = Math.sqrt(fall[0] * fall[1]) * Math.pow(size / b.sizeMedianMm, b.sinkPower) * Math.exp(spread * bell(u2, unit(hash2(i, 231 + k))))
      this.sizes[i] = size
      const least = fall[0] * (lands || snows ? LANDS_LEAST : FLOATS_LEAST)
      this.sink[i] = speed < least ? least : speed > fall[1] * 2.5 ? fall[1] * 2.5 : speed
    } else {
      const big = Math.pow(u1, b.sizeSkew)
      this.sizes[i] = b.sizeMm[0] + (b.sizeMm[1] - b.sizeMm[0]) * big
      this.sink[i] = fall[0] + (fall[1] - fall[0]) * (0.45 * big + 0.55 * u2)
    }
    const lies = b.layerMm[0] + (b.layerMm[1] - b.layerMm[0]) * Math.pow(u3, 2.4)
    const clear = b.ball > 0 ? b.ball * this.sizes[i]! + BALL_ROOM_MM : 0
    this.layer[i] = b.mode === 'steer' ? b.clearanceMm * 0.3 : lies > clear ? lies : clear
    this.lift[i] = b.liftMmS[1] - (b.liftMmS[1] - b.liftMmS[0]) * Math.pow(u3, 0.45)
    this.turnRate[i] = b.turnRadS[0] + (b.turnRadS[1] - b.turnRadS[0]) * u4
    this.life[i] = b.lifeSeconds[0] + (b.lifeSeconds[1] - b.lifeSeconds[0]) * u5
    this.renews[i] = u5 < b.renew ? 1 : 0
  }

  private hide(i: number, ix: number): void {
    const park = this.grid(ix).park
    this.put(i, park[0], park[1], park[2])
    this.state[i] = STATE_HIDDEN
    this.fade[i] = 0
    this.opacity[i] = 0
    this.sizes[i] = 0
    this.mark[i] = 0
  }

  private put(i: number, x: number, y: number, z: number): void {
    const o = i * 3
    this.xyz[o] = x
    this.xyz[o + 1] = y
    this.xyz[o + 2] = z
    this.old[o] = x
    this.old[o + 1] = y
    this.old[o + 2] = z
    this.vel[o] = 0
    this.vel[o + 1] = 0
    this.vel[o + 2] = 0
    this.base[i] = this.step
    this.feel[i * 4] = NaN
    this.drifted = true
  }

  private afloat(i: number, salt: number, G: Grid, margin: number, low: number, high: number): void {
    const g = this.g
    let x = 0
    let y = (low + high) / 2
    let z = 0
    for (let tries = 0; tries < 16; tries++) {
      const s = salt + tries * 3
      const cx = (unit(hash2(i, s)) * 2 - 1) * WALL
      const cy = low + (high - low) * unit(hash2(i, s + 1))
      const cz = (unit(hash2(i, s + 2)) * 2 - 1) * WALL
      const lim = WALL - margin
      if (cx * cx + cy * cy + cz * cz > lim * lim) continue
      x = cx
      y = cy
      z = cz
      if (sdfSample(G.source, cx, cy, cz, g) > margin + 0.5) break
    }
    this.put(i, x, y, z)
  }

  private nest(i: number, k: number, ix: number): void {
    const o = i * 3
    const b = TABLE_OF[k]!
    if (b.orbit) {
      this.home[o] = 0
      this.home[o + 1] = R * 0.6 + 8 * (unit(hash2(i, 71)) - 0.5)
      this.home[o + 2] = 0
      return
    }
    const G = this.grid(ix)
    const g = this.g
    const need = b.clearanceMm + b.reachMm * 0.5
    let x = 0
    let y = GROUND_Y + need + 4
    let z = 0
    for (let tries = 0; tries < 24; tries++) {
      const s = 72 + tries * 3
      const cx = (unit(hash2(i, s)) * 2 - 1) * WALL
      const cy = GROUND_Y + 3 + 42 * Math.pow(unit(hash2(i, s + 1)), 1.5)
      const cz = (unit(hash2(i, s + 2)) * 2 - 1) * WALL
      const lim = WALL - need
      if (cx * cx + cy * cy + cz * cz > lim * lim) continue
      x = cx
      y = cy
      z = cz
      if (sdfSample(G.source, cx, cy, cz, g) > need) break
    }
    this.home[o] = x
    this.home[o + 1] = y
    this.home[o + 2] = z
  }

  private perch(i: number, k: number, ix: number, time: number): void {
    this.nest(i, k, ix)
    wanderAt(i, k, this.home, time, 0, this.q)
    this.put(i, this.q[0]!, this.q[1]!, this.q[2]!)
  }

  private spring(i: number, k: number, salt: number, ix: number): void {
    const list = this.emitters[KINDS[k]!]
    const g = this.g
    let x: number
    let y: number
    let z: number
    if (list && list.length > 0) {
      const e = list[Math.min(list.length - 1, Math.floor(unit(hash2(i, salt)) * list.length))]!
      const cz = unit(hash2(i, salt + 1)) * 2 - 1
      const az = unit(hash2(i, salt + 2)) * TAU
      const rr = e.r * Math.cbrt(unit(hash2(i, salt + 3)))
      const sr = Math.sqrt(1 - cz * cz)
      x = e.x + rr * sr * Math.cos(az)
      y = e.y + rr * cz
      z = e.z + rr * sr * Math.sin(az)
    } else if (K_MODE[k] === 2) {
      const az = unit(hash2(i, salt + 2)) * TAU
      const rr = 14 * Math.sqrt(unit(hash2(i, salt + 3)))
      x = rr * Math.cos(az)
      y = GROUND_Y + 2 + 6 * unit(hash2(i, salt + 1))
      z = rr * Math.sin(az)
    } else {
      const az = unit(hash2(i, salt + 2)) * TAU
      const rr = Math.sqrt(unit(hash2(i, salt + 3))) * WALL * 0.985
      x = rr * Math.cos(az)
      z = rr * Math.sin(az)
      y = Math.max(GROUND_Y + 4, Math.sqrt(WALL2 - rr * rr) - 1.5 - 9 * unit(hash2(i, salt + 1)))
    }
    const r2 = x * x + y * y + z * z
    const lim = WALL - 1
    if (r2 > lim * lim) {
      const s = lim / Math.sqrt(r2)
      x *= s
      y *= s
      z *= s
    }
    const G = this.grid(ix)
    for (let pass = 0; pass < 3; pass++) {
      const d = sdfSample(G.source, x, y, z, g)
      if (d >= 0.6) break
      const gl = Math.hypot(g[0]!, g[1]!, g[2]!)
      if (gl < 1e-6) {
        y += 0.6 - d
        continue
      }
      const p = (0.6 - d) / gl
      x += g[0]! * p
      y += g[1]! * p
      z += g[2]! * p
    }
    this.put(i, x, y, z)
  }

  private drop(i: number, k: number, G: Grid): void {
    const g = this.g
    const lay = this.layer[i]!
    const slope = K_SLOPE[k]!
    const disc = Math.sqrt(WALL2 - GROUND_Y * GROUND_Y) - 0.6
    const a = unit(hash2(i, 31)) * TAU
    const rr = Math.sqrt(unit(hash2(i, 32))) * disc
    let x = rr * Math.cos(a)
    let z = rr * Math.sin(a)
    let y = Math.sqrt(Math.max(0, WALL2 - x * x - z * z)) - 1
    for (let pass = 0; pass < 160; pass++) {
      const d = sdfSample(G.source, x, y, z, g)
      if (d > lay + 0.02) {
        y -= Math.max(0.15, (d - lay) * 0.8)
      } else {
        const gl = Math.hypot(g[0]!, g[1]!, g[2]!) || 1
        const nx = g[0]! / gl
        const ny = g[1]! / gl
        const nz = g[2]! / gl
        const push = lay - d
        x += nx * push
        y += ny * push
        z += nz * push
        if (ny >= slope) break
        const hl = Math.hypot(nx, nz)
        if (hl > 1e-4) {
          x += (nx / hl) * 0.7
          z += (nz / hl) * 0.7
        } else {
          x += 0.7 * Math.cos(a)
          z += 0.7 * Math.sin(a)
        }
        y -= 0.3
      }
      const r2 = x * x + y * y + z * z
      if (r2 > WALL2) {
        const hr = Math.hypot(x, z)
        const room = Math.sqrt(Math.max(0, WALL2 - y * y))
        if (hr > room && hr > 1e-6) {
          x *= room / hr
          z *= room / hr
        }
        if (y < -WALL) y = -WALL
      }
    }
    this.put(i, x, y, z)
  }

  private init(ix: number): void {
    const table = KIND_IN[ix]!
    const G = this.grid(ix)
    const n = this.count
    this.model.reset()
    this.step = 0
    this.nowIx = ix
    this.window = 0
    this.kindOf.fill(0)
    for (let i = 0; i < n; i++) {
      const k = table[i]!
      this.era[i] = ix
      this.mark[i] = 0
      this.stamp[i] = 0
      this.phase[i] = unit(hash2(i, 7)) * TAU
      this.put(i, 0, 0, 0)
      if (k === NONE) {
        this.hide(i, ix)
        continue
      }
      this.kindOf[i] = k
      this.assign(i, k)
      this.fade[i] = 1
      this.opacity[i] = 1
      this.state[i] = STATE_LIQUID
      const mode = K_MODE[k]!
      if (mode === 1) this.perch(i, k, ix, 0)
      else if (mode === 2) {
        const age = Math.floor(unit(hash2(i, 9)) * this.life[i]! * HZ)
        this.spring(i, k, 41, ix)
        this.xyz[i * 3 + 1] = this.xyz[i * 3 + 1]! - this.sink[i]! * age * DT * 0.8
        this.stamp[i] = -age
        const a = age / (this.life[i]! * HZ)
        this.fade[i] = emberGlow(a)
        this.opacity[i] = this.fade[i]!
        this.phase[i] = a * TAU
      } else if (K_REST[k] === STATE_REST || (K_REST[k] === STATE_SNAG && this.sink[i]! > TABLE_OF[k]!.sinkMmS[1])) {
        const dw = TABLE_OF[k]!.dwellSeconds
        if (this.renews[i] && TABLE_OF[k]!.renewMmS[1] > 0 && unit(hash2(i, 35)) * (CALM_FALL_MM + (0.5 * (dw[0] + dw[1]) + 1 / INV_FADE_OUT) * this.sink[i]!) < CALM_FALL_MM) this.afloat(i, 37, G, 1.5, GROUND_Y + 1, WALL)
        else {
          this.drop(i, k, G)
          this.state[i] = K_REST[k]!
          if (this.renews[i]) this.stamp[i] = Math.floor(unit(hash2(i, 33)) * Math.sqrt(dw[0] * dw[0] + unit(hash2(i, 34)) * (dw[1] * dw[1] - dw[0] * dw[0])) * HZ)
        }
      } else this.afloat(i, 21, G, 1.5, GROUND_Y + 1, WALL)
    }
    this.old.set(this.xyz)
    this.base.fill(0)
    this.behind = false
    this.drifted = true
  }

  private turn(i: number, ix: number, n: number): void {
    const k = KIND_IN[ix]![i]!
    const shown = this.state[i] !== STATE_HIDDEN
    this.era[i] = ix
    this.feel[i * 4] = NaN
    if (this.state[i] !== STATE_LIQUID) {
      this.base[i] = n
      this.drifted = true
    }
    if (k === NONE) {
      this.hide(i, ix)
      return
    }
    this.kindOf[i] = k
    this.assign(i, k)
    this.mark[i] = 0
    this.fade[i] = 1
    this.state[i] = STATE_LIQUID
    const mode = K_MODE[k]!
    if (mode === 1) {
      if (shown) this.nest(i, k, ix)
      else this.perch(i, k, ix, (n + 1) * DT)
    } else if (mode === 2) {
      if (!shown) this.spring(i, k, 41 + (n & 1023) * 5, ix)
      this.stamp[i] = n - Math.floor(unit(hash2(i, 9)) * this.life[i]! * HZ)
    } else if (!shown) this.afloat(i, 21 + (n & 1023) * 3, this.grid(ix), 1.5, GROUND_Y + 1, WALL)
  }

  private follow(tl: Timeline, time: number, n: number): void {
    const s = seasonAt(tl, time)
    const count = this.count
    const era = this.era
    if (s.change > 0 && s.change < 1 && s.from !== s.to) {
      const to = SEASONS.indexOf(s.to)
      if (to < 0) return
      const c = s.change
      const at = this.swapAt
      this.window = 1
      this.swapTo = to
      this.change = c
      for (let i = 0; i < count; i++) if (era[i] !== to && c >= at[i]!) this.turn(i, to, n)
      return
    }
    const now = SEASONS.indexOf(s.season)
    if (now < 0) return
    if (now !== this.nowIx || this.window === 1) {
      for (let i = 0; i < count; i++) if (era[i] !== now) this.turn(i, now, n)
      this.nowIx = now
      this.window = 2
    }
  }

  private blend(): void {
    const n = this.count
    const fade = this.fade
    const opacity = this.opacity
    if (this.window === 2) {
      for (let i = 0; i < n; i++) opacity[i] = fade[i]!
      this.window = 0
      return
    }
    const c = this.change
    const at = this.swapAt
    const inv = 1 / SWAP_HALF
    for (let i = 0; i < n; i++) {
      let f = (c - at[i]!) * inv
      if (f < 0) f = -f
      opacity[i] = f >= 1 ? fade[i]! : fade[i]! * f * f * (3 - 2 * f)
    }
  }

  private stepOnce(tl: Timeline): void {
    const n = this.step
    const t = n * DT
    this.follow(tl, (n + 1) * DT, n)
    this.model.step(globePoseAt(tl, t - DT), globePoseAt(tl, t), globePoseAt(tl, t + DT), t)
    this.sweep(n)
    if (this.window !== 0) this.blend()
    this.step = n + 1
    this.behind = true
  }

  private toss(i: number, speed: number, n: number): void {
    const o = i * 3
    const g = this.g
    const u = this.u
    const k = this.kindOf[i]!
    sdfSample(this.grid(this.era[i]!).source, this.xyz[o]!, this.xyz[o + 1]!, this.xyz[o + 2]!, g)
    const gl = Math.hypot(g[0]!, g[1]!, g[2]!)
    const kick = K_KICK[k]!
    const into = gl > 1e-6 ? (u[0]! * g[0]! + u[1]! * g[1]! + u[2]! * g[2]!) / gl : 0
    const off = gl > 1e-6 ? (speed * 0.3 + 3 - (into < 0 ? into * kick : 0)) / gl : 0
    this.vel[o] = u[0]! * kick + g[0]! * off
    this.vel[o + 1] = u[1]! * kick + g[1]! * off
    this.vel[o + 2] = u[2]! * kick + g[2]! * off
    this.state[i] = STATE_LIQUID
    this.base[i] = n
    this.feel[i * 4] = NaN
    this.drifted = true
  }

  private renew(i: number, k: number, n: number): void {
    this.spring(i, k, 211 + (n % 4093) * 7, this.era[i]!)
    this.state[i] = STATE_LIQUID
    this.mark[i] = this.mark[i]! & ~FADING
    this.fade[i] = 0
    this.opacity[i] = 0
  }

  private steer(i: number, k: number, n: number, x: number, y: number, z: number, ux: number, uy: number, uz: number, b: number): void {
    const o = i * 3
    const vel = this.vel
    const q = this.q
    const g = this.g
    wanderAt(i, k, this.home, (n + 1) * DT, 0, q)
    const cruise = K_CRUISE[k]!
    const clr = K_CLEAR[k]!
    let sx = (q[0]! - x) * STEER_GAIN
    let sy = (q[1]! - y) * STEER_GAIN
    let sz = (q[2]! - z) * STEER_GAIN
    const sl = Math.sqrt(sx * sx + sy * sy + sz * sz)
    const cap = cruise * 1.6
    if (sl > cap) {
      const s = cap / sl
      sx *= s
      sy *= s
      sz *= s
    }
    const d = sdfSample(this.grid(this.era[i]!).source, x, y, z, g)
    if (d < clr) {
      const gl = Math.hypot(g[0]!, g[1]!, g[2]!)
      if (gl > 1e-6) {
        const nx = g[0]! / gl
        const ny = g[1]! / gl
        const nz = g[2]! / gl
        const f = d > 0 ? d / clr : 0
        const un = ux * nx + uy * ny + uz * nz
        if (un < 0) {
          const r = un * (1 - f)
          ux -= nx * r
          uy -= ny * r
          uz -= nz * r
        }
        const sn = sx * nx + sy * ny + sz * nz
        const out = (1 - f) * cruise * 2 - (sn < 0 ? sn * (1 - f) : 0)
        sx += nx * out
        sy += ny * out
        sz += nz * out
      }
    }
    const r = Math.sqrt(x * x + y * y + z * z)
    const lim = WALL - clr
    if (r > lim) {
      const over = ((r - lim) / clr) * cruise * 2
      sx -= (x / r) * over
      sy -= (y / r) * over
      sz -= (z / r) * over
    }
    vel[o] = vel[o]! + (ux + sx - vel[o]!) * b
    vel[o + 1] = vel[o + 1]! + (uy + sy - vel[o + 1]!) * b
    vel[o + 2] = vel[o + 2]! + (uz + sz - vel[o + 2]!) * b
  }

  private sweep(n: number): void {
    const L = this.model
    const c = L.coef
    const wx = c[0]!
    const wy = c[1]!
    const wz = c[2]!
    const hx = c[3]!
    const hy = c[4]!
    const hz = c[5]!
    const noise = L.noise
    const ng = L.grid
    const np = L.pot
    const roll = c[7]!
    const rolling = roll !== 0
    const swirl = L.state[LIQUID_SWIRL]!
    const slabK = roll * R2 * SLAB2
    const armK = (ARM_MM_S * c[6]!) / TURBULENCE_MAX
    const bankK = (BANK_GAIN * c[6]!) / TURBULENCE_MAX
    const phaseK = ARMS * swirl * TABLE_K
    const windK = ARM_WIND * TABLE_K
    const twistK = ARM_TWIST * TABLE_K
    const stiff = roll / (roll + ROLL_SOFT)
    const stirred = c[6]! > 0
    const loose = 1 - stiff
    const m = L.motion
    const gux = m.gx
    const guy = m.gy
    const guz = m.gz
    let gex = gux - m.ax / GRAVITY_MM
    let gey = guy - m.ay / GRAVITY_MM
    let gez = guz - m.az / GRAVITY_MM
    const gel = Math.sqrt(gex * gex + gey * gey + gez * gez)
    if (gel > 3) {
      const s = 3 / gel
      gex *= s
      gey *= s
      gez *= s
    }
    const bound = L.maxSpeed
    const lively = bound > MIN_LIFT
    const mask = m.ax !== 0 || m.ay !== 0 || m.az !== 0 ? 3 : lively ? 15 : 63
    const eA = this.nowIx
    const A = this.grid(eA)
    const B = this.window === 1 ? this.grid(this.swapTo) : A
    const count = this.count
    const xyz = this.xyz
    const old = this.old
    const vel = this.vel
    const base = this.base
    const phase = this.phase
    const fade = this.fade
    const opacity = this.opacity
    const kindOf = this.kindOf
    const state = this.state
    const era = this.era
    const mark = this.mark
    const stamp = this.stamp
    const sink = this.sink
    const lift = this.lift
    const layer = this.layer
    const turnRate = this.turnRate
    const life = this.life
    const renews = this.renews
    const feel = this.feel
    const u = this.u
    const g = this.g
    for (let i = (EVERY - (n & (EVERY - 1))) & (EVERY - 1); i < count; i += EVERY) {
      const st = state[i]!
      if (st !== STATE_LIQUID) {
        if (st === STATE_HIDDEN) continue
        if ((mark[i]! & FADING) !== 0) {
          const f = fade[i]! - H * INV_FADE_OUT
          if (f > 0) {
            fade[i] = f
            opacity[i] = f
          } else this.renew(i, kindOf[i]!, n)
          continue
        }
        if (((i + n) & mask) !== 0) continue
        const lf = lift[i]!
        if (lively && bound > lf) {
          const o = i * 3
          L.velocityAt(xyz[o]!, xyz[o + 1]!, xyz[o + 2]!, u)
          const sp2 = u[0]! * u[0]! + u[1]! * u[1]! + u[2]! * u[2]!
          if (sp2 > lf * lf) {
            this.toss(i, Math.sqrt(sp2), n)
            continue
          }
        }
        if (renews[i] !== 0 && n >= stamp[i]!) mark[i] = mark[i]! | FADING
        continue
      }
      const k = kindOf[i]!
      const o = i * 3
      let x = xyz[o]!
      let y = xyz[o + 1]!
      let z = xyz[o + 2]!
      let vx = vel[o]!
      let vy = vel[o + 1]!
      let vz = vel[o + 2]!
      let lag = n - base[i]!
      if (lag > 0) {
        const sx = vx * DT
        const sy = vy * DT
        const sz = vz * DT
        do {
          x = Math.fround(x + sx)
          y = Math.fround(y + sy)
          z = Math.fround(z + sz)
        } while (--lag > 0)
      }
      const G = era[i] === eA ? A : B
      const f = i * 4
      if (feel[f] !== feel[f]) {
        feel[f] = probe(G, x, y, z, g)
        feel[f + 1] = g[0]!
        feel[f + 2] = g[1]!
        feel[f + 3] = g[2]!
      }
      const d = feel[f]!
      const r2 = x * x + y * y + z * z
      const q = r2 * INV_R2
      const hill = 1 - 2 * q
      const dot = (x * hx + y * hy + z * hz) * INV_R2
      let ux = wy * z - wz * y + hx * hill + x * dot
      let uy = wz * x - wx * z + hy * hill + y * dot
      let uz = wx * y - wy * x + hz * hill + z * dot
      const walled = d < RAMP
      let ax = 0
      let ay = 0
      let az = 0
      if (noise) {
        let jx = (x + R) * NOISE_INV_CELL
        let jy = (y + R) * NOISE_INV_CELL
        let jz = (z + R) * NOISE_INV_CELL
        jx = jx < 0 ? 0 : jx > NOISE_TOP ? NOISE_TOP : jx
        jy = jy < 0 ? 0 : jy > NOISE_TOP ? NOISE_TOP : jy
        jz = jz < 0 ? 0 : jz > NOISE_TOP ? NOISE_TOP : jz
        const ix = jx | 0
        const iy = jy | 0
        const iz = jz | 0
        const tx = jx - ix
        const ty = jy - iy
        const tz = jz - iz
        const o0 = (ix + NN * (iy + NN * iz)) * 3
        const w00 = (1 - ty) * (1 - tz)
        const w10 = ty * (1 - tz)
        const w01 = (1 - ty) * tz
        const w11 = ty * tz
        const sx = 1 - tx
        const a00 = sx * w00
        const b00 = tx * w00
        const a10 = sx * w10
        const b10 = tx * w10
        const a01 = sx * w01
        const b01 = tx * w01
        const a11 = sx * w11
        const b11 = tx * w11
        const o1 = o0 + 3
        const o2 = o0 + NOISE_DY
        const o3 = o2 + 3
        const o4 = o0 + NOISE_DZ
        const o5 = o4 + 3
        const o6 = o4 + NOISE_DY
        const o7 = o6 + 3
        const px = ng[o0]! * a00 + ng[o1]! * b00 + ng[o2]! * a10 + ng[o3]! * b10 + ng[o4]! * a01 + ng[o5]! * b01 + ng[o6]! * a11 + ng[o7]! * b11
        const py = ng[o0 + 1]! * a00 + ng[o1 + 1]! * b00 + ng[o2 + 1]! * a10 + ng[o3 + 1]! * b10 + ng[o4 + 1]! * a01 + ng[o5 + 1]! * b01 + ng[o6 + 1]! * a11 + ng[o7 + 1]! * b11
        const pz = ng[o0 + 2]! * a00 + ng[o1 + 2]! * b00 + ng[o2 + 2]! * a10 + ng[o3 + 2]! * b10 + ng[o4 + 2]! * a01 + ng[o5 + 2]! * b01 + ng[o6 + 2]! * a11 + ng[o7 + 2]! * b11
        const qc = q > 1 ? 1 : q
        const q4 = qc * qc * qc * qc
        const radial = (px * x + py * y + pz * z) * INV_R2 * q4 * q4
        ux += px - x * radial
        uy += py - y * radial
        uz += pz - z * radial
        if (walled) {
          ax = np[o0]! * a00 + np[o1]! * b00 + np[o2]! * a10 + np[o3]! * b10 + np[o4]! * a01 + np[o5]! * b01 + np[o6]! * a11 + np[o7]! * b11
          ay = np[o0 + 1]! * a00 + np[o1 + 1]! * b00 + np[o2 + 1]! * a10 + np[o3 + 1]! * b10 + np[o4 + 1]! * a01 + np[o5 + 1]! * b01 + np[o6 + 1]! * a11 + np[o7 + 1]! * b11
          az = np[o0 + 2]! * a00 + np[o1 + 2]! * b00 + np[o2 + 2]! * a10 + np[o3 + 2]! * b10 + np[o4 + 2]! * a01 + np[o5 + 2]! * b01 + np[o6 + 2]! * a11 + np[o7 + 2]! * b11
        }
      }
      let fx = 0
      let fy = 0
      let fz = 0
      let rx = 0
      let ry = 0
      let rz = 0
      let spin = 0
      if (rolling) {
        const ex = x - CX
        const ey = y - CY
        const ez = z - CZ
        const ec = ex * CX + ey * CY + ez * CZ
        const es = Math.sqrt(ec * ec + ROLL_FREE * (ex * ex + ey * ey + ez * ez))
        if (es > 1e-6) {
          let lam = (ec + es) * INV_FREE
          if (lam > 1) lam = 1
          const l2 = lam * lam
          const edge = 1 - ROLL_EDGE * l2 * l2
          const ht = (y - ROLL_FLOOR_MM - ROLL_FLOOR_SLOPE * z) * INV_RISE
          const rise = ht <= 0 ? 0 : ht >= 1 ? 1 : ht * ht * (3 - 2 * ht)
          const nx = ex + lam * CX
          const ny = ey + lam * CY
          const nz = ez + lam * CZ
          const along = nx * AX + ny * AY + nz * AZ
          const inv = slabK / ((SLAB2 + along * along) * es)
          const discK = inv * es
          const rate = inv * rise * lam * edge
          const skim = ht <= 0 || ht >= 1 ? 0 : discK * 6 * ht * (1 - ht) * INV_RISE * ((1 - l2) / 2 - (ROLL_EDGE * (1 - l2 * l2 * l2)) / 6)
          const tx = AY * nz - AZ * ny
          const ty = AZ * nx - AX * nz
          const tz = AX * ny - AY * nx
          spin = rate
          rx = rate * tx + skim * SKIM_X
          ry = rate * ty + skim * SKIM_Y
          rz = rate * tz + skim * SKIM_Z
          const gk = K_GATHER[k]!
          const rho2 = tx * tx + ty * ty + tz * tz
          if (gk !== 0 && rho2 > 1e-4) {
            const pa = nx - along * AX
            const pb = (ny - along * AY) * E2Y + (nz - along * AZ) * E2Z
            const ia = (phaseK - windK * l2 + twistK * along) | 0
            const wave = pb * (3 * rho2 - 4 * pb * pb) * SIN[(ia + QUARTER) & MASK]! - pa * (4 * pa * pa - 3 * rho2) * SIN[ia & MASK]!
            const arm = (-armK * gk * wave * l2) / ((l2 + ARM_CORE) * (rho2 + ARM_HUB2) * rho2)
            fx = arm * tx
            const hb = (ht - BANK_FROM) * BANK_OVER
            const fall = hb <= 0 ? BANK_LOW : hb >= 1 ? 1 : BANK_LOW + (1 - BANK_LOW) * hb * hb * (3 - 2 * hb)
            const sk = sink[i]!
            fy = sk > BANK_LIGHT ? arm * ty - bankK * gk * fall * sk : arm * ty
            fz = arm * tz
          }
        }
      }
      const us2 = (ux + rx) * (ux + rx) + (uy + ry) * (uy + ry) + (uz + rz) * (uz + rz)
      if (walled) {
        const gx = feel[f + 1]!
        const gy = feel[f + 2]!
        const gz = feel[f + 3]!
        if (rolling) {
          const near = d <= 0 ? 1 : 1 - d * INV_RAMP
          const gg = gx * gx + gy * gy + gz * gz
          const into = rx * gx + ry * gy + rz * gz
          if (into < 0) {
            const press = near * near
            const off = (press * into) / gg
            const was = rx * rx + ry * ry + rz * rz
            rx -= gx * off
            ry -= gy * off
            rz -= gz * off
            const left = rx * rx + ry * ry + rz * rz
            const lean = (gux * gx + guy * gy + guz * gz) / gg
            const ex = gx * lean - gux
            const ey = gy * lean - guy
            const ez = gz * lean - guz
            const el = Math.sqrt(ex * ex + ey * ey + ez * ez)
            if (el > 0.05) {
              const lack = ((Math.sqrt(was) - Math.sqrt(left)) * press) / el
              rx += ex * lack
              ry += ey * lack
              rz += ez * lack
            }
          }
        }
        let jy = (y + G.half) * G.scale
        jy = jy < 0 ? 0 : jy > G.top ? G.top : jy
        const iy = jy | 0
        const ring = G.ring[iy]! + (G.ring[iy + 1]! - G.ring[iy]!) * (jy - iy)
        const turn = -0.5 * (r2 - R2)
        const hp = 0.5 * (1 - (q > 1 ? 1 : q))
        ax += turn * wx + hp * (hy * z - hz * y)
        ay += -0.5 * (x * x + z * z - ring) * wy + hp * (hz * x - hx * z)
        az += turn * wz + hp * (hx * y - hy * x)
        const s = d <= 0 ? 1 : 1 - d * INV_RAMP
        const part = 1 - s * s
        const dm = 2 * s * INV_RAMP
        let cx = part * ux + dm * (gy * az - gz * ay)
        let cy = part * uy + dm * (gz * ax - gx * az)
        let cz = part * uz + dm * (gx * ay - gy * ax)
        const away = ux * gx + uy * gy + uz * gz
        if (away > 0) {
          const rise = ((1 - part) * away) / (gx * gx + gy * gy + gz * gz)
          cx += gx * rise
          cy += gy * rise
          cz += gz * rise
        }
        ux = cx
        uy = cy
        uz = cz
      }
      ux += rx
      uy += ry
      uz += rz
      const ox = wx + (hy * z - hz * y) * CURL + spin * AX
      const oy = wy + (hz * x - hx * z) * CURL + spin * AY
      const oz = wz + (hx * y - hy * x) * CURL + spin * AZ
      const arc = (ox * ox + oy * oy + oz * oz) * H * H
      const chord = LEAD * (1 - arc / 12)
      const sag = LEAD * H * (1 - arc / 20) / 3
      const lx = oy * uz - oz * uy
      const ly = oz * ux - ox * uz
      const lz = ox * uy - oy * ux
      ux += lx * chord + (oy * lz - oz * ly) * sag + fx
      uy += ly * chord + (oz * lx - ox * lz) * sag + fy
      uz += lz * chord + (ox * ly - oy * lx) * sag + fz
      const pvx = vx
      const pvy = vy
      const pvz = vz
      vx += (oy * pvz - oz * pvy) * H
      vy += (oz * pvx - ox * pvz) * H
      vz += (ox * pvy - oy * pvx) * H
      const mode = K_MODE[k]!
      if (mode === 1) {
        vel[o] = vx
        vel[o + 1] = vy
        vel[o + 2] = vz
        this.steer(i, k, n, x, y, z, ux, uy, uz, K_BLEND[k]!)
        vx = vel[o]!
        vy = vel[o + 1]!
        vz = vel[o + 2]!
        let ph = phase[i]! + turnRate[i]! * H
        if (ph >= TAU) ph -= TAU
        phase[i] = ph
      } else {
        let ph = phase[i]!
        const ia = (ph * TABLE_K) | 0
        const s1 = SIN[ia & MASK]!
        const c2 = SIN[(ia * 2 + QUARTER) & MASK]!
        const hd = Math.imul(i, 0x9e3779b1) >>> 20
        const s2 = SIN[(ia * 2 + hd * 7) & MASK]!
        const hc = SIN[(hd + QUARTER) & MASK]!
        const hs = SIN[hd]!
        const sway = K_SWAY[k]! * s1
        const cross = K_CROSS[k]! * s2
        const snk = sink[i]! * (1 + K_DIP[k]! * c2)
        const b = K_BLEND[k]! * loose + stiff
        vx += (ux + snk * gex + sway * hc - cross * hs - vx) * b
        vy += (uy + snk * gey - vy) * b
        vz += (uz + snk * gez + sway * hs + cross * hc - vz) * b
        if (mode === 2) {
          const age = (n + 1 - stamp[i]!) * DT
          const span = life[i]!
          if (age >= span) {
            this.spring(i, k, 311 + (n % 4093) * 7, era[i]!)
            stamp[i] = n + 1
            fade[i] = 0
            opacity[i] = 0
            phase[i] = 0
            continue
          }
          const part = age / span
          const glow = emberGlow(part)
          fade[i] = glow
          opacity[i] = glow
          phase[i] = part * TAU
        } else {
          ph += (turnRate[i]! + K_SPIN[k]! * Math.sqrt(us2)) * H
          if (ph >= TAU) ph -= TAU * Math.floor(ph / TAU)
          phase[i] = ph
          const fd = fade[i]!
          if ((mark[i]! & FADING) !== 0) {
            const dim = fd - H * INV_FADE_OUT
            if (dim > 0) {
              fade[i] = dim
              opacity[i] = dim
            } else {
              this.renew(i, k, n)
              continue
            }
          } else if (fd < 1) {
            const lit = fd + H * INV_FADE_IN
            fade[i] = lit > 1 ? 1 : lit
            opacity[i] = lit > 1 ? 1 : lit
          }
        }
      }
      vx = Math.fround(vx)
      vy = Math.fround(vy)
      vz = Math.fround(vz)
      if (rolling) {
        const leap = (vx * vx + vy * vy + vz * vz) * H * H
        if (leap > LEAP2 && d * d < leap) {
          const sx = vx * DT
          const sy = vy * DT
          const sz = vz * DT
          const lay = layer[i]!
          let px = x
          let py = y
          let pz = z
          for (let j = 1; j < EVERY; j++) {
            px = Math.fround(px + sx)
            py = Math.fround(py + sy)
            pz = Math.fround(pz + sz)
            const dj = probe(G, px, py, pz, g)
            if (dj >= RAMP) continue
            const gl = Math.sqrt(g[0]! * g[0]! + g[1]! * g[1]! + g[2]! * g[2]!)
            if (dj / (gl > 0.5 ? gl : 0.5) - lay >= SKIN || gl < 1e-9) continue
            const into = (vx * g[0]! + vy * g[1]! + vz * g[2]!) / (gl * gl)
            if (into < 0) {
              vx = Math.fround(vx - g[0]! * into)
              vy = Math.fround(vy - g[1]! * into)
              vz = Math.fround(vz - g[2]! * into)
            }
            break
          }
        }
      }
      let tx = ahead(x, vx * DT)
      let ty = ahead(y, vy * DT)
      let tz = ahead(z, vz * DT)
      let tr2 = tx * tx + ty * ty + tz * tz
      if (tr2 > WALL2) {
        const s = (WALL / Math.sqrt(tr2) - 1) / H
        vx = Math.fround(vx + tx * s)
        vy = Math.fround(vy + ty * s)
        vz = Math.fround(vz + tz * s)
        tx = ahead(x, vx * DT)
        ty = ahead(y, vy * DT)
        tz = ahead(z, vz * DT)
      }
      let de = probe(G, tx, ty, tz, g)
      let known = true
      if (de < RAMP) {
        const lay = layer[i]!
        let gl = Math.sqrt(g[0]! * g[0]! + g[1]! * g[1]! + g[2]! * g[2]!)
        let gap = de / (gl > 0.5 ? gl : 0.5) - lay
        if (gap < SKIN) {
          if (mode !== 1) {
            const gr = K_GRIP[k]!
            vx = Math.fround(vx * gr)
            vy = Math.fround(vy * gr)
            vz = Math.fround(vz * gr)
            tx = ahead(x, vx * DT)
            ty = ahead(y, vy * DT)
            tz = ahead(z, vz * DT)
            de = probe(G, tx, ty, tz, g)
            gl = Math.sqrt(g[0]! * g[0]! + g[1]! * g[1]! + g[2]! * g[2]!)
            gap = de / (gl > 0.5 ? gl : 0.5) - lay
          }
          let nx = 0
          let ny = 1
          let nz = 0
          for (let tries = 0; ; tries++) {
            if (gl > 1e-9) {
              nx = g[0]! / gl
              ny = g[1]! / gl
              nz = g[2]! / gl
            }
            if (gap >= -SKIN) break
            if (tries === PUSHES) {
              vx = 0
              vy = 0
              vz = 0
              tx = x
              ty = y
              tz = z
              known = false
              break
            }
            const cut = -gap / H
            vx = Math.fround(vx + nx * cut)
            vy = Math.fround(vy + ny * cut)
            vz = Math.fround(vz + nz * cut)
            tx = ahead(x, vx * DT)
            ty = ahead(y, vy * DT)
            tz = ahead(z, vz * DT)
            de = probe(G, tx, ty, tz, g)
            gl = Math.sqrt(g[0]! * g[0]! + g[1]! * g[1]! + g[2]! * g[2]!)
            gap = de / (gl > 0.5 ? gl : 0.5) - lay
          }
          tr2 = tx * tx + ty * ty + tz * tz
          if (tr2 > WALL2) {
            const s = (WALL / Math.sqrt(tr2) - 1) / H
            vx = Math.fround(vx + tx * s)
            vy = Math.fround(vy + ty * s)
            vz = Math.fround(vz + tz * s)
            tx = ahead(x, vx * DT)
            ty = ahead(y, vy * DT)
            tz = ahead(z, vz * DT)
            known = false
          }
          const rk = K_REST[k]!
          if (rk !== 0 && mode !== 1 && known) {
            const lf = lift[i]! * HOLD
            if (us2 < lf * lf && vx * vx + vy * vy + vz * vz < K_REST2[k]! && -(nx * gux + ny * guy + nz * guz) >= K_SLOPE[k]!) {
              xyz[o] = tx
              xyz[o + 1] = ty
              xyz[o + 2] = tz
              old[o] = tx
              old[o + 1] = ty
              old[o + 2] = tz
              vel[o] = 0
              vel[o + 1] = 0
              vel[o + 2] = 0
              base[i] = n
              state[i] = rk
              feel[f] = NaN
              this.drifted = true
              if (renews[i] !== 0) {
                const dw = stirred && TABLE_OF[k]!.stormDwellSeconds[1] > 0 ? TABLE_OF[k]!.stormDwellSeconds : TABLE_OF[k]!.dwellSeconds
                stamp[i] = n + Math.floor((dw[0] + (dw[1] - dw[0]) * unit(hash2(i, n))) * HZ)
              }
              continue
            }
          }
        }
      }
      if (known) {
        feel[f] = de
        feel[f + 1] = g[0]!
        feel[f + 2] = g[1]!
        feel[f + 3] = g[2]!
      } else feel[f] = NaN
      xyz[o] = x
      xyz[o + 1] = y
      xyz[o + 2] = z
      vel[o] = vx
      vel[o + 1] = vy
      vel[o + 2] = vz
      base[i] = n
    }
  }
}
