import { config } from '../../config'
import { hash2, unit } from '../../core/rng'
import type { SdfGrid } from '../../core/stage'
import { globePoseAt, seasonAt, type Timeline } from '../../film/timeline'
import { Liquid, LIQUID_LENGTH, LIQUID_R, NOISE_N } from '../../globe/liquid'
import { BEHAVIOUR, KINDS, KIND_IN, NONE, POOL, SEASONS, type Behaviour } from './kinds'
import { blockoutEmitters, blockoutSdf, GROUND_Y, sdfSample, sdfSlope, type Emitter } from './sdf'

const HZ = config.sim.stepHz
export const DT = 1 / HZ
const TAU = Math.PI * 2
const R = LIQUID_R
const INV_R2 = 1 / (R * R)
export const WALL = R - 0.3
const WALL2 = WALL * WALL
const NEAR = 3
const INV_NEAR = 1 / NEAR
const SLIP = 0.35
const SKIN = 0.02
const CALM = 3
const INV_FADE_IN = 1 / 1.4
const INV_FADE_OUT = 1 / 0.7
export const SWAP_HALF = 0.22
const HOLD = 0.6
const GRAVITY_MM = 9810
const STEER_GAIN = 1.5
const DISPERSE = 0.45
const NOISE_INV_CELL = (NOISE_N - 1) / (2 * R)
const NOISE_TOP = NOISE_N - 1.0001
const NOISE_DY = NOISE_N * 3
const NOISE_DZ = NOISE_N * NOISE_N * 3
const NN = NOISE_N

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
const STORM_MASK = 3
const STORM_H = DT * (STORM_MASK + 1)
const K_CALM = new Int32Array(NK)
const K_CALM_H = new Float64Array(NK)
const K_BLEND = new Float64Array(NK)
const K_BLEND_CALM = new Float64Array(NK)
const K_GRIP = new Float64Array(NK)
const K_GRIP_CALM = new Float64Array(NK)
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
  const slow = b.mode === 'drift' && b.turnRadS[1] < 1 && Math.abs(b.sinkMmS[0]) + Math.abs(b.sinkMmS[1]) + b.swayMmS < 2
  K_CALM[k] = slow ? 7 : STORM_MASK
  K_CALM_H[k] = DT * (K_CALM[k]! + 1)
  K_BLEND[k] = 1 - Math.exp(-STORM_H / b.followSeconds)
  K_BLEND_CALM[k] = 1 - Math.exp(-K_CALM_H[k]! / b.followSeconds)
  K_GRIP[k] = 1 / (1 + b.gripPerSecond * STORM_H)
  K_GRIP_CALM[k] = 1 / (1 + b.gripPerSecond * K_CALM_H[k]!)
  if (b.rest !== 'never') lowest = Math.min(lowest, b.liftMmS[0])
})
const MIN_LIFT = lowest

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export const emberGlow = (a: number): number => smooth(a / 0.12) * smooth((1 - a) / 0.5)

export function wanderAt(i: number, kind: number, home: ArrayLike<number>, time: number, loopSeconds: number, out: Float64Array): void {
  const o = i * 3
  const b = TABLE_OF[kind]!
  const rate = b.cruiseMmS / b.reachMm
  const snap = (w: number): number => (loopSeconds > 0 ? (TAU * Math.max(1, Math.round((w * loopSeconds) / TAU))) / loopSeconds : w)
  if (b.orbit) {
    const ring = b.reachMm * (0.55 + 0.45 * unit(hash2(i, 61)))
    const w = snap(b.cruiseMmS / ring)
    const a = w * time + unit(hash2(i, 62)) * TAU
    out[0] = home[o]! + ring * Math.cos(a)
    out[1] = home[o + 1]! + 2.5 * Math.sin(2 * a + unit(hash2(i, 63)) * TAU)
    out[2] = home[o + 2]! + ring * Math.sin(a)
    return
  }
  const w1 = snap(rate * (0.35 + 0.5 * unit(hash2(i, 64))))
  const w2 = snap(rate * (0.35 + 0.5 * unit(hash2(i, 65))))
  const w3 = snap(rate * (0.35 + 0.5 * unit(hash2(i, 66))))
  const reach = b.reachMm * 0.7
  out[0] = home[o]! + reach * Math.sin(w1 * time + unit(hash2(i, 67)) * TAU)
  out[1] = home[o + 1]! + reach * 0.5 * Math.sin(w2 * time + unit(hash2(i, 68)) * TAU)
  out[2] = home[o + 2]! + reach * Math.sin(w3 * time + unit(hash2(i, 69)) * TAU)
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
  source: SdfGrid
  park: [number, number, number]
}

function gridOf(source: SdfGrid): Grid {
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
  return { n: source.n, nn: source.n * source.n, scale: (source.n - 1) / source.sizeMm, half: source.sizeMm / 2, top: source.n - 1.001, inv: 1 / sdfSlope(source), data: source.data, source, park }
}

export class ParticleEngine {
  readonly count: number
  readonly kinds: readonly string[] = KINDS
  readonly season: string
  readonly pos: Float32Array
  readonly prev: Float32Array
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

  private readonly clear: Float32Array
  private readonly sink: Float32Array
  private readonly lift: Float32Array
  private readonly layer: Float32Array
  private readonly turnRate: Float32Array
  private readonly life: Float32Array
  private readonly swapAt: Float32Array
  private readonly renews: Uint8Array
  private readonly listed: Uint8Array
  private readonly list: Int32Array
  private awakeN = 0
  private startIx: number
  private nowIx: number
  private window = 0
  private swapTo = 0
  private change = 0
  private stale = false
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
    this.pos = new Float32Array(n * 3)
    this.prev = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.home = new Float32Array(n * 3)
    this.phase = new Float32Array(n)
    this.fade = new Float32Array(n)
    this.opacity = new Float32Array(n)
    this.sizes = new Float32Array(n)
    this.clear = new Float32Array(n)
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
    this.listed = new Uint8Array(n)
    this.stamp = new Int32Array(n)
    this.list = new Int32Array(n)
    this.liquid = this.model.state
    for (let i = 0; i < n; i++) this.swapAt[i] = SWAP_HALF + (1 - 2 * SWAP_HALF) * unit(hash2(i, 5))
  }

  get seasonNow(): string {
    return SEASONS[this.nowIx]!
  }

  get awake(): number {
    return this.awakeN
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
    return {
      step: this.step,
      pos: this.pos.slice(),
      prev: this.prev.slice(),
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
    this.pos.set(s.pos)
    this.prev.set(s.prev)
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
    this.awakeN = 0
    const state = this.state
    for (let i = 0; i < n; i++) {
      const k = s.kindOf[i]!
      const e = s.era[i]!
      const st = state[i]!
      this.kindOf[i] = k
      this.era[i] = e
      if (st === STATE_HIDDEN) {
        this.sizes[i] = 0
        this.listed[i] = 0
        continue
      }
      this.assign(i, k)
      if (K_MODE[k] === 1) this.nest(i, k, e)
      const on = st === STATE_LIQUID || (this.mark[i]! & FADING) !== 0
      this.listed[i] = on ? 1 : 0
      if (on) this.list[this.awakeN++] = i
    }
    this.clear.fill(0)
    this.model.prepare(Math.max(0, this.step - 1) * DT)
    this.stale = true
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
    const big = Math.pow(u1, b.sizeSkew)
    this.sizes[i] = b.sizeMm[0] + (b.sizeMm[1] - b.sizeMm[0]) * big
    this.sink[i] = b.sinkMmS[0] + (b.sinkMmS[1] - b.sinkMmS[0]) * (0.45 * big + 0.55 * u2)
    this.layer[i] = b.mode === 'steer' ? b.clearanceMm * 0.3 : b.layerMm[0] + (b.layerMm[1] - b.layerMm[0]) * Math.pow(u3, 2.4)
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
    this.pos[o] = x
    this.pos[o + 1] = y
    this.pos[o + 2] = z
    this.prev[o] = x
    this.prev[o + 1] = y
    this.prev[o + 2] = z
    this.vel[o] = 0
    this.vel[o + 1] = 0
    this.vel[o + 2] = 0
    this.clear[i] = 0
  }

  private enlist(i: number): void {
    if (this.listed[i] === 0) {
      this.listed[i] = 1
      this.list[this.awakeN++] = i
    }
  }

  private afloat(i: number, salt: number, G: Grid, margin: number, low: number, high: number): void {
    const g = this.g
    let x = 0
    let y = (low + high) / 2
    let z = 0
    for (let tries = 0; tries < 16; tries++) {
      const s = salt + tries * 3
      x = (unit(hash2(i, s)) * 2 - 1) * WALL
      y = low + (high - low) * unit(hash2(i, s + 1))
      z = (unit(hash2(i, s + 2)) * 2 - 1) * WALL
      const lim = WALL - margin
      if (x * x + y * y + z * z > lim * lim) continue
      if (sdfSample(G.source, x, y, z, g) > margin + 0.5) break
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
    this.awakeN = 0
    this.listed.fill(0)
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
        this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! - this.sink[i]! * age * DT * 0.8
        this.stamp[i] = -age
        const a = age / (this.life[i]! * HZ)
        this.fade[i] = emberGlow(a)
        this.opacity[i] = this.fade[i]!
        this.phase[i] = a * TAU
      } else if (K_REST[k] === STATE_REST) {
        this.drop(i, k, G)
        this.state[i] = STATE_REST
        if (this.renews[i]) this.stamp[i] = Math.floor(unit(hash2(i, 33)) * TABLE_OF[k]!.dwellSeconds[1] * HZ)
      } else this.afloat(i, 21, G, 1.5, GROUND_Y + 1, WALL)
      if (this.state[i] === STATE_LIQUID) this.enlist(i)
    }
    this.prev.set(this.pos)
    this.clear.fill(0)
    this.stale = false
  }

  private turn(i: number, ix: number, n: number): void {
    const k = KIND_IN[ix]![i]!
    const shown = this.state[i] !== STATE_HIDDEN
    this.era[i] = ix
    this.clear[i] = 0
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
    this.enlist(i)
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
    if (this.stale) {
      this.carry()
      this.stale = false
    }
    this.wake(n)
    this.move(n)
    if (this.window !== 0) this.blend()
    this.step = n + 1
  }

  private carry(): void {
    const pos = this.pos
    const prev = this.prev
    const total = this.awakeN
    if (total * 6 > this.count) {
      prev.set(pos)
      return
    }
    const list = this.list
    for (let a = 0; a < total; a++) {
      const o = list[a]! * 3
      prev[o] = pos[o]!
      prev[o + 1] = pos[o + 1]!
      prev[o + 2] = pos[o + 2]!
    }
  }

  private wake(n: number): void {
    const L = this.model
    const m = L.motion
    const bound = L.maxSpeed
    const lively = bound > MIN_LIFT
    const mask = m.ax !== 0 || m.ay !== 0 || m.az !== 0 ? 3 : lively ? 15 : 63
    const count = this.count
    const state = this.state
    const listed = this.listed
    const lift = this.lift
    const renews = this.renews
    const stamp = this.stamp
    const pos = this.pos
    const u = this.u
    for (let i = (mask + 1 - (n & mask)) & mask; i < count; i += mask + 1) {
      const s = state[i]!
      if ((s !== STATE_REST && s !== STATE_SNAG) || listed[i] !== 0) continue
      const lf = lift[i]!
      if (lively && bound > lf) {
        const o = i * 3
        L.velocityAt(pos[o]!, pos[o + 1]!, pos[o + 2]!, u)
        const sp2 = u[0]! * u[0]! + u[1]! * u[1]! + u[2]! * u[2]!
        if (sp2 > lf * lf) {
          this.toss(i, Math.sqrt(sp2))
          continue
        }
      }
      if (renews[i] !== 0 && n >= stamp[i]!) {
        this.mark[i] = this.mark[i]! | FADING
        this.enlist(i)
      }
    }
  }

  private toss(i: number, speed: number): void {
    const o = i * 3
    const g = this.g
    const u = this.u
    const k = this.kindOf[i]!
    sdfSample(this.grid(this.era[i]!).source, this.pos[o]!, this.pos[o + 1]!, this.pos[o + 2]!, g)
    const gl = Math.hypot(g[0]!, g[1]!, g[2]!)
    const kick = K_KICK[k]!
    const off = gl > 1e-6 ? (speed * 0.3 + 3) / gl : 0
    this.vel[o] = u[0]! * kick + g[0]! * off
    this.vel[o + 1] = u[1]! * kick + g[1]! * off
    this.vel[o + 2] = u[2]! * kick + g[2]! * off
    this.state[i] = STATE_LIQUID
    this.clear[i] = 0
    this.enlist(i)
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

  private move(n: number): void {
    const L = this.model
    const calm = L.maxSpeed < CALM
    const c = L.coef
    const wx = c[0]!
    const wy = c[1]!
    const wz = c[2]!
    const hx = c[3]!
    const hy = c[4]!
    const hz = c[5]!
    const noise = L.noise
    const ng = L.grid
    const kick = (c[6]! * DISPERSE) / 512
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
    const eA = this.nowIx
    const A = this.grid(eA)
    const B = this.window === 1 ? this.grid(this.swapTo) : A
    const blend = calm ? K_BLEND_CALM : K_BLEND
    const grip = calm ? K_GRIP_CALM : K_GRIP
    const pos = this.pos
    const prev = this.prev
    const vel = this.vel
    const phase = this.phase
    const fade = this.fade
    const opacity = this.opacity
    const kindOf = this.kindOf
    const state = this.state
    const era = this.era
    const mark = this.mark
    const stamp = this.stamp
    const clear = this.clear
    const sink = this.sink
    const lift = this.lift
    const layer = this.layer
    const turnRate = this.turnRate
    const life = this.life
    const renews = this.renews
    const listed = this.listed
    const list = this.list
    const total = this.awakeN
    let w = 0
    for (let a = 0; a < total; a++) {
      const i = list[a]!
      const st = state[i]!
      const k = kindOf[i]!
      if (st !== STATE_LIQUID) {
        if (st === STATE_HIDDEN || (mark[i]! & FADING) === 0) {
          listed[i] = 0
          continue
        }
        if (((i + n) & STORM_MASK) === 0) {
          const f = fade[i]! - STORM_H * INV_FADE_OUT
          if (f > 0) {
            fade[i] = f
            opacity[i] = f
          } else this.renew(i, k, n)
        }
        list[w++] = i
        continue
      }
      const every = calm ? K_CALM[k]! : STORM_MASK
      const due = ((i + n) & every) === 0
      const lazy = every > STORM_MASK
      if (lazy && !due) {
        list[w++] = i
        continue
      }
      const span = lazy ? K_CALM_H[k]! : DT
      const o = i * 3
      let x = pos[o]!
      let y = pos[o + 1]!
      let z = pos[o + 2]!
      let vx = vel[o]!
      let vy = vel[o + 1]!
      let vz = vel[o + 2]!
      let nx = 0
      let ny = 0
      let nz = 0
      let d = 0
      let near = false
      let touch = false
      let dirty = false
      if (clear[i]! <= 0) {
        const G = era[i] === eA ? A : B
        const gn = G.n
        const data = G.data
        const top = G.top
        let fx = (x + G.half) * G.scale
        let fy = (y + G.half) * G.scale
        let fz = (z + G.half) * G.scale
        fx = fx < 0 ? 0 : fx > top ? top : fx
        fy = fy < 0 ? 0 : fy > top ? top : fy
        fz = fz < 0 ? 0 : fz > top ? top : fz
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
        d = y0 + (y1 - y0) * tz
        if (d < NEAR) {
          const gx = ((vb - va) * (1 - ty) + (ve - vc) * ty) * (1 - tz) + ((vg - vf) * (1 - ty) + (vm - vh) * ty) * tz
          const gy = (x10 - x00) * (1 - tz) + (x11 - x01) * tz
          const gz = y1 - y0
          const gl = Math.sqrt(gx * gx + gy * gy + gz * gz)
          if (gl > 1e-9) {
            nx = gx / gl
            ny = gy / gl
            nz = gz / gl
          } else ny = 1
          near = true
          const lay = layer[i]!
          if (d < lay + SKIN) {
            touch = true
            if (d < lay) {
              const push = lay - d
              x += nx * push
              y += ny * push
              z += nz * push
              d = lay
            }
          }
        } else clear[i] = (d - NEAR) * G.inv
      }
      if (due) {
        const h = calm ? K_CALM_H[k]! : STORM_H
        const half = h * 0.5
        const mx = x + vx * half
        const my = y + vy * half
        const mz = z + vz * half
        const q = (mx * mx + my * my + mz * mz) * INV_R2
        const hill = 1 - 2 * q
        const dot = (mx * hx + my * hy + mz * hz) * INV_R2
        let ux = wy * mz - wz * my + hx * hill + mx * dot
        let uy = wz * mx - wx * mz + hy * hill + my * dot
        let uz = wx * my - wy * mx + hz * hill + mz * dot
        if (noise) {
          let fx = (mx + R) * NOISE_INV_CELL
          let fy = (my + R) * NOISE_INV_CELL
          let fz = (mz + R) * NOISE_INV_CELL
          fx = fx < 0 ? 0 : fx > NOISE_TOP ? NOISE_TOP : fx
          fy = fy < 0 ? 0 : fy > NOISE_TOP ? NOISE_TOP : fy
          fz = fz < 0 ? 0 : fz > NOISE_TOP ? NOISE_TOP : fz
          const ix = fx | 0
          const iy = fy | 0
          const iz = fz | 0
          const tx = fx - ix
          const ty = fy - iy
          const tz = fz - iz
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
          const radial = (px * mx + py * my + pz * mz) * INV_R2
          ux += px - mx * radial
          uy += py - my * radial
          uz += pz - mz * radial
        }
        const us2 = ux * ux + uy * uy + uz * uz
        if (noise) {
          const bits = hash2(i, n)
          ux += ((bits & 1023) - 511.5) * kick
          uy += (((bits >>> 10) & 1023) - 511.5) * kick
          uz += ((bits >>> 20) - 2047.5) * kick * 0.25
        }
        const mode = K_MODE[k]!
        if (mode === 1) {
          this.steer(i, k, n, x, y, z, ux, uy, uz, blend[k]!)
          vx = vel[o]!
          vy = vel[o + 1]!
          vz = vel[o + 2]!
          let ph = phase[i]! + turnRate[i]! * h
          if (ph >= TAU) ph -= TAU
          phase[i] = ph
        } else {
          if (near) {
            const f = d * INV_NEAR
            const un = ux * nx + uy * ny + uz * nz
            if (un < 0) {
              const r = un * (1 - f)
              ux -= nx * r
              uy -= ny * r
              uz -= nz * r
            }
            const slip = SLIP + (1 - SLIP) * f
            ux *= slip
            uy *= slip
            uz *= slip
          }
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
          const b = blend[k]!
          vx += (ux + snk * gex + sway * hc - cross * hs - vx) * b
          vy += (uy + snk * gey - vy) * b
          vz += (uz + snk * gez + sway * hs + cross * hc - vz) * b
          if (touch) {
            const vn = vx * nx + vy * ny + vz * nz
            if (vn < 0) {
              vx -= nx * vn
              vy -= ny * vn
              vz -= nz * vn
            }
            const gr = grip[k]!
            vx *= gr
            vy *= gr
            vz *= gr
            const rk = K_REST[k]!
            if (rk !== 0) {
              const lf = lift[i]! * HOLD
              if (us2 < lf * lf && vx * vx + vy * vy + vz * vz < K_REST2[k]! && -(nx * gux + ny * guy + nz * guz) >= K_SLOPE[k]!) {
                pos[o] = x
                pos[o + 1] = y
                pos[o + 2] = z
                prev[o] = x
                prev[o + 1] = y
                prev[o + 2] = z
                vel[o] = 0
                vel[o + 1] = 0
                vel[o + 2] = 0
                state[i] = rk
                if (renews[i] !== 0) {
                  const dw = TABLE_OF[k]!.dwellSeconds
                  stamp[i] = n + Math.floor((dw[0] + (dw[1] - dw[0]) * unit(hash2(i, n))) * HZ)
                }
                if ((mark[i]! & FADING) !== 0) list[w++] = i
                else listed[i] = 0
                continue
              }
            }
          }
          if (mode === 2) {
            const age = (n + 1 - stamp[i]!) * DT
            const span = life[i]!
            if (age >= span) {
              this.spring(i, k, 311 + (n % 4093) * 7, era[i]!)
              stamp[i] = n + 1
              fade[i] = 0
              opacity[i] = 0
              phase[i] = 0
              list[w++] = i
              continue
            }
            const part = age / span
            const f = emberGlow(part)
            fade[i] = f
            opacity[i] = f
            phase[i] = part * TAU
          } else {
            ph += (turnRate[i]! + K_SPIN[k]! * Math.sqrt(us2)) * h
            if (ph >= TAU) ph -= TAU * Math.floor(ph / TAU)
            phase[i] = ph
            const fd = fade[i]!
            if ((mark[i]! & FADING) !== 0) {
              const f = fd - h * INV_FADE_OUT
              if (f > 0) {
                fade[i] = f
                opacity[i] = f
              } else {
                this.renew(i, k, n)
                list[w++] = i
                continue
              }
            } else if (fd < 1) {
              const f = fd + h * INV_FADE_IN
              fade[i] = f > 1 ? 1 : f
              opacity[i] = f > 1 ? 1 : f
            }
          }
        }
        dirty = true
      } else if (touch) {
        const vn = vx * nx + vy * ny + vz * nz
        if (vn < 0) {
          vx -= nx * vn
          vy -= ny * vn
          vz -= nz * vn
          dirty = true
        }
      }
      x += vx * span
      y += vy * span
      z += vz * span
      if (near) {
        const dn = d + (nx * vx + ny * vy + nz * vz) * span
        const lay = layer[i]!
        if (dn < lay) {
          const push = lay - dn
          x += nx * push
          y += ny * push
          z += nz * push
        }
      } else clear[i] = clear[i]! - ((vx < 0 ? -vx : vx) + (vy < 0 ? -vy : vy) + (vz < 0 ? -vz : vz)) * span
      const r2 = x * x + y * y + z * z
      if (r2 > WALL2) {
        const vr = (vx * x + vy * y + vz * z) / r2
        if (vr > 0) {
          vx -= x * vr
          vy -= y * vr
          vz -= z * vr
          dirty = true
        }
        const s = WALL / Math.sqrt(r2)
        x *= s
        y *= s
        z *= s
      }
      pos[o] = x
      pos[o + 1] = y
      pos[o + 2] = z
      if (dirty) {
        vel[o] = vx
        vel[o + 1] = vy
        vel[o + 2] = vz
      }
      list[w++] = i
    }
    this.awakeN = w
    if (total > 0) this.stale = true
  }
}
