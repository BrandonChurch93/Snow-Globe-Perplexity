import { config } from '../../config'
import { hash2, unit } from '../../core/rng'
import type { SdfGrid } from '../../core/stage'
import { barSeconds, beatSeconds, eventAt, globePoseAt, stateSeconds, stillTimeline, type Timeline } from '../../film/timeline'
import { Liquid, LIQUID_LENGTH, LIQUID_R, LIQUID_SLOSH, LIQUID_TURBULENCE, LIQUID_TURN, TURBULENCE_MAX } from '../../globe/liquid'
import { makeShake } from '../../shake/table'
import { COVER_N, COVER_SPAN_MM, DT, emberGlow, heapCover, ParticleEngine, parkPoint, STATE_HIDDEN, STATE_LIQUID, WALL, wanderAt, wanderRates, type EngineOptions } from './engine'
import { BEHAVIOUR, KINDS } from './kinds'
import { sdfSample } from './sdf'

const HZ = config.sim.stepHz
const TAU = Math.PI * 2
const R2 = LIQUID_R * LIQUID_R
const WALL2 = WALL * WALL

const STILL = 0
const SINK = 1
const DRIFT = 2
const WANDER = 3
const CYCLE = 4

const EDGE = 0.12
const QUIET_TAIL = 0.35
const WINDOW = 1.6
const SURGE_SECONDS = 0.4
const SURGE_MAX = 20
const EDDY: readonly (readonly number[])[] = [
  [0.11, 0.05, -0.07, 0.3, 0.6, 0.74, 7, 4.5],
  [-0.09, 0.16, 0.12, 0.8, 0.1, -0.59, 5, -6.3],
  [0.2, -0.12, 0.17, -0.45, 0.5, 0.74, 3.5, 8.2],
]
const EASE = 0.3
const MARGIN = 0.15
const SHALLOW = 0.4
const DEEP = 1.4
const PER = 6
const MIN_COLUMN = 24

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const fall = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : (u < EASE ? (u * u) / (2 * EASE) : u - EASE / 2) / (1 - EASE / 2))

export interface LoopOptions {
  seconds?: number
  shakeStartSeconds?: number
  timeline?: Timeline
}

export function loopTimeline(season: string, shakeStartSeconds: number = config.deliver.cardLoop.shakeStartSeconds): Timeline {
  return { id: `loop:${season}`, startSeason: season, events: [{ id: 'loop', startSec: shakeStartSeconds, from: season, to: season, path: makeShake('loop') }] }
}

export class LoopPaths {
  readonly count: number
  readonly kinds: readonly string[] = KINDS
  readonly season: string
  readonly seconds: number
  readonly timeline: Timeline
  readonly periods: readonly number[]
  readonly stormEnd: number
  readonly pos: Float32Array
  readonly prev: Float32Array
  readonly sizes: Float32Array
  readonly opacity: Float32Array
  readonly phase: Float32Array
  readonly kindOf: Uint8Array
  readonly state: Uint8Array
  readonly liquid = new Float64Array(LIQUID_LENGTH)
  step = 0
  time = 0

  private readonly home: Float32Array
  private readonly nest: Float32Array
  private readonly path: Uint8Array
  private readonly state0: Uint8Array
  private readonly opacity0: Float32Array
  private readonly phase0: Float32Array
  private readonly spin: Float32Array
  private readonly par: Float32Array
  private readonly tossAt: Float32Array
  private readonly rise: Float32Array
  private readonly sinkAt: Float32Array
  private readonly landAt: Float32Array
  private readonly off: Float32Array
  private readonly turns: Float32Array
  private readonly tumble: Float32Array
  private readonly turned: Float64Array
  private readonly span: Float64Array
  private readonly amp: Float32Array
  private readonly rate: Float32Array
  private readonly seed: Float32Array
  private readonly hill: Float32Array
  private readonly steps: number
  private readonly cum: Float64Array
  private readonly gust: Float64Array
  private readonly surge: Float64Array
  private readonly trace: Float64Array
  private readonly wave: Float32Array
  private readonly grid: SdfGrid
  private readonly park: [number, number, number]
  private readonly g = new Float64Array(3)
  private readonly q = new Float64Array(3)
  private readonly w = new Float64Array(3)
  private readonly then = new Float64Array(5)
  private readonly now = new Float64Array(5)
  private readonly heap = new Float32Array(COVER_N * COVER_N)
  private readonly lain = { n: COVER_N, spanMm: COVER_SPAN_MM, mm: new Float32Array(COVER_N * COVER_N) }
  private drifted = true
  private parked = false
  private op = 0
  private ph = 0
  private st = 0

  static fromRest(season: string = config.defaultSeason, engine: EngineOptions = {}, options: LoopOptions = {}): LoopPaths {
    const sim = new ParticleEngine({ ...engine, season })
    sim.reset(season)
    sim.advanceTo(Math.round(stateSeconds('rest') * HZ), stillTimeline(season))
    return new LoopPaths(sim, options)
  }

  constructor(rest: ParticleEngine, options: LoopOptions = {}) {
    const n = rest.count
    const L = options.seconds ?? config.deliver.cardLoop.seconds
    const season = rest.seasonNow
    const tl = options.timeline ?? loopTimeline(season, options.shakeStartSeconds)
    const event = tl.events[0]
    const t0 = event ? event.startSec : L
    const landing = t0 + barSeconds
    const strokesEnd = t0 + (config.shake.liftBeats + config.shake.strokeBeats) * beatSeconds
    const end = L - QUIET_TAIL
    if (event && landing + 2.2 > end) throw new Error('the loop is too short for its shake and a settle')
    this.count = n
    this.season = season
    this.seconds = L
    this.timeline = tl
    this.stormEnd = event ? end : 0
    this.grid = rest.colliderOf(season)
    this.park = parkPoint(this.grid)
    this.pos = rest.pos.slice()
    this.prev = rest.pos.slice()
    this.sizes = rest.sizes.slice()
    this.kindOf = rest.kindOf.slice()
    this.state = rest.state.slice()
    this.state0 = rest.state.slice()
    this.opacity = rest.opacity.slice()
    this.opacity0 = rest.opacity.slice()
    this.phase = rest.phase.slice()
    this.phase0 = rest.phase.slice()
    this.home = rest.pos.slice()
    this.nest = rest.home.slice()
    this.path = new Uint8Array(n)
    this.spin = new Float32Array(n)
    this.par = new Float32Array(n * PER)
    this.tossAt = new Float32Array(n).fill(L)
    this.rise = new Float32Array(n).fill(1)
    this.sinkAt = new Float32Array(n).fill(L)
    this.landAt = new Float32Array(n).fill(L)
    this.off = new Float32Array(n * 3)
    this.turns = new Float32Array(n)
    this.tumble = new Float32Array(n)
    this.turned = new Float64Array(n)
    this.span = new Float64Array(n)
    this.amp = new Float32Array(n)
    this.rate = new Float32Array(n)
    this.seed = new Float32Array(n)
    this.hill = new Float32Array(n)
    this.wave = new Float32Array(n * 3)

    const steps = Math.round(L * HZ)
    this.steps = steps
    this.cum = new Float64Array(steps + 2)
    this.gust = new Float64Array(steps + 2)
    this.surge = new Float64Array((steps + 2) * 3)
    this.trace = new Float64Array((steps + 2) * LIQUID_LENGTH)
    const reach = new Float64Array(steps + 2)
    const model = new Liquid()
    const ax = model.axis
    let side = 0
    let sweep = 0
    let peak = 0
    let px = 0
    let py = 0
    let pz = 0
    const keep = Math.exp(-DT / SURGE_SECONDS)
    for (let j = 0; j <= steps; j++) {
      const t = j * DT
      const window = 1 - smooth((t - (end - WINDOW)) / WINDOW)
      const s = model.state
      const along = s[LIQUID_TURN]! * ax[0] + s[LIQUID_TURN + 1]! * ax[1] + s[LIQUID_TURN + 2]! * ax[2]
      side += along * DT
      sweep += Math.abs(along) * window * DT
      this.cum[j] = sweep
      this.gust[j] = Math.min(1, s[LIQUID_TURBULENCE]! / TURBULENCE_MAX) * window
      px = px * keep + 1.5 * s[LIQUID_SLOSH]! * DT
      py = py * keep + 1.5 * s[LIQUID_SLOSH + 1]! * DT
      pz = pz * keep + 1.5 * s[LIQUID_SLOSH + 2]! * DT
      this.surge[j * 3] = px * window
      this.surge[j * 3 + 1] = py * window
      this.surge[j * 3 + 2] = pz * window
      peak = Math.max(peak, Math.hypot(px, py, pz) * window)
      reach[j] = Math.max(j > 0 ? reach[j - 1]! : 0, t >= t0 ? model.maxSpeed : 0)
      for (let c = 0; c < LIQUID_LENGTH; c++) this.trace[j * LIQUID_LENGTH + c] = s[c]! * window
      model.step(globePoseAt(tl, t - DT), globePoseAt(tl, t), globePoseAt(tl, t + DT), t, eventAt(tl, t)?.beat ?? null)
    }
    const tame = peak > SURGE_MAX ? SURGE_MAX / peak : 1
    for (let j = 0; j <= steps; j++) {
      this.surge[j * 3] = this.surge[j * 3]! * tame
      this.surge[j * 3 + 1] = this.surge[j * 3 + 1]! * tame
      this.surge[j * 3 + 2] = this.surge[j * 3 + 2]! * tame
    }
    for (let c = 0; c < LIQUID_LENGTH; c++) this.trace[(steps + 1) * LIQUID_LENGTH + c] = this.trace[c]!
    this.cum[steps + 1] = this.cum[steps]!
    const hand = side < 0 ? -1 : 1

    const cycles = new Set<number>()
    const base = TAU / L
    const g = this.g
    const grid = this.grid
    for (let i = 0; i < n; i++) {
      const o = i * 3
      const p = i * PER
      const st = this.state0[i]!
      if (st === STATE_HIDDEN) continue
      const k = this.kindOf[i]!
      const b = BEHAVIOUR[KINDS[k]!]!
      const hx = this.home[o]!
      const hy = this.home[o + 1]!
      const hz = this.home[o + 2]!
      const u = (salt: number): number => unit(hash2(i, 300 + salt))
      const afloat = st === STATE_LIQUID
      if (b.mode === 'steer') {
        this.path[i] = WANDER
        wanderRates(i, k, L, this.w)
        for (let c = 0; c < 3; c++) cycles.add(Math.round(this.w[c]! / base))
        wanderAt(i, k, this.nest, 0, L, this.q)
        this.par[p] = this.q[0]!
        this.par[p + 1] = this.q[1]!
        this.par[p + 2] = this.q[2]!
        const beats = Math.max(1, Math.round(rest.turnRate[i]! / base))
        cycles.add(beats)
        this.spin[i] = beats * base
      } else if (b.mode === 'cycle') {
        this.path[i] = CYCLE
        const laps = Math.max(1, Math.round(L / rest.life[i]!))
        cycles.add(laps)
        const a0 = (this.phase0[i]! / TAU) % 1
        const climb = -rest.sink[i]! * 0.8 * (L / laps)
        this.par[p] = hy - climb * a0
        this.par[p + 1] = climb
        this.par[p + 2] = a0
        this.par[p + 3] = laps / L
        const waves = 1 + Math.floor(u(1) * 3)
        cycles.add(waves)
        this.par[p + 4] = b.swayMmS / (waves * base)
        this.par[p + 5] = waves * base
      } else if (afloat && Math.abs(rest.sink[i]!) >= 1.5) {
        this.path[i] = SINK
        const speed = rest.sink[i]!
        const dir = speed > 0 ? 1 : -1
        let above = 0
        let below = 0
        for (let s = 0.5; s < 2 * WALL; s += 0.5) {
          const y = hy + s
          if (hx * hx + y * y + hz * hz > WALL2 || sdfSample(grid, hx, y, hz, g) < 0.4) break
          above = s
        }
        for (let s = 0.5; s < 2 * WALL; s += 0.5) {
          const y = hy - s
          if (hx * hx + y * y + hz * hz > WALL2 || sdfSample(grid, hx, y, hz, g) < 0.4) break
          below = s
        }
        const room = above + below
        if (room >= MIN_COLUMN) {
          const laps = Math.max(1, Math.ceil((Math.abs(speed) * L) / room))
          cycles.add(laps)
          const len = (Math.abs(speed) * L) / laps
          const ahead = dir > 0 ? below : above
          const behind = dir > 0 ? above : below
          let f0 = 0.15 + 0.7 * u(2)
          if (f0 * len > behind) f0 = behind / len
          if ((1 - f0) * len > ahead) f0 = 1 - ahead / len
          this.par[p] = hy + dir * f0 * len
          this.par[p + 1] = dir * len
          this.par[p + 2] = f0
          this.par[p + 3] = laps / L
          const waves = 2 + Math.floor(u(1) * 4)
          cycles.add(waves)
          cycles.add(waves + 1)
          this.par[p + 4] = b.swayMmS / (waves * base)
          this.par[p + 5] = waves * base
        } else this.path[i] = STILL
      } else if (afloat) {
        this.path[i] = DRIFT
        const waves = 1 + Math.floor(u(1) * 2)
        cycles.add(waves)
        cycles.add(waves + 1)
        this.par[p] = (0.9 + b.swayMmS) / (waves * base)
        this.par[p + 1] = waves * base
      }
      if (b.mode === 'drift') {
        const whole = Math.max(1, Math.round(rest.turnRate[i]! / base))
        if (afloat && this.path[i] !== STILL) {
          cycles.add(whole)
          this.spin[i] = whole * base
        }
        this.tumble[i] = TAU * (1 + Math.floor(u(3) * 3))
      }
      this.seed[i] = u(4) * TAU
      if (!event) continue

      let toss = t0 + 0.02 + 0.25 * u(5)
      if (!afloat) {
        const need = rest.lift[i]!
        if (reach[steps]! < need) continue
        let lo = 0
        let hi = steps
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (reach[mid]! >= need) hi = mid
          else lo = mid + 1
        }
        toss = Math.min(strokesEnd, lo * DT) + 0.1 * u(5)
      }
      const reachMm = afloat ? 12 : 9
      const jx = (u(6) * 2 - 1) * reachMm
      const jz = (u(7) * 2 - 1) * reachMm
      const wide = afloat ? 1 : 1 + 0.12 * (u(8) * 2 - 1)
      let qx = hx * wide + jx
      let qz = hz * wide + jz
      const lim = WALL - 2
      const rho = Math.hypot(qx, qz)
      if (rho > lim * 0.97) {
        qx *= (lim * 0.97) / rho
        qz *= (lim * 0.97) / rho
      }
      const top = Math.sqrt(lim * lim - qx * qx - qz * qz) - 1
      const low = Math.min(hy, top)
      let qy = afloat ? hy + (u(9) * 2 - 1) * reachMm : low + (top - low) * (0.004 + 0.88 * Math.pow(u(9), 3.4))
      for (let pass = 0; pass < 3; pass++) {
        const d = sdfSample(grid, qx, qy, qz, g)
        if (d >= 2) break
        const gl = Math.hypot(g[0]!, g[1]!, g[2]!)
        if (gl < 1e-6) {
          qy += 2 - d
          continue
        }
        const push = (2 - d) / gl
        qx += g[0]! * push
        qy += g[1]! * push
        qz += g[2]! * push
      }
      const far = Math.hypot(qx, qy, qz)
      if (far > lim) {
        qx *= lim / far
        qy *= lim / far
        qz *= lim / far
      }
      this.off[o] = qx - hx
      this.off[o + 1] = qy - hy
      this.off[o + 2] = qz - hz
      const drop = Math.max(0, qy - hy)
      const free = b.rest === 'never'
      const begin = free ? landing + 0.3 + 1.2 * u(10) : landing - 0.25 + 0.6 * u(10)
      const room = end - begin
      const took = free ? L : Math.min(Math.max(afloat ? 1.5 + 2 * u(11) : 0.6, drop / (6 + 12 * Math.pow(u(11), 1.5))), room * (0.55 + 0.45 * u(12)))
      const land = Math.min(end - 0.25 * u(12), begin + took)
      this.tossAt[i] = toss
      this.rise[i] = 0.45 + 0.5 * u(13)
      this.sinkAt[i] = begin
      this.landAt[i] = land
      const from = this.cumAt(this.tossAt[i]!)
      const swept = this.cumAt(this.landAt[i]!) - from
      this.turned[i] = from
      this.span[i] = swept > 1e-9 ? 1 / swept : 0
      const rr = (qx * qx + qz * qz) / R2
      const whole = Math.max(swept > 2.4 ? 1 : 0, Math.floor((swept * (2 - rr)) / TAU + u(14)))
      this.turns[i] = hand * TAU * whole
      this.amp[i] = 1.5 + 2.5 * u(15)
      for (let m = 0; m < 3; m++) this.wave[o + m] = EDDY[m]![0]! * qx + EDDY[m]![1]! * qy + EDDY[m]![2]! * qz
      this.rate[i] = 2.5 + 4.5 * u(16)
      this.hill[i] = Math.max(0, 1 - (qx * qx + qy * qy + qz * qz) / R2)
    }
    const list = [...cycles].filter((c) => c > 0).sort((a, b) => a - b)
    this.periods = list.map((c) => L / c)
    this.setTime(0)
  }

  private cumAt(t: number): number {
    const f = Math.min(this.steps, Math.max(0, t * HZ))
    const j = Math.floor(f)
    const a = this.cum[j]!
    return a + (this.cum[j + 1]! - a) * (f - j)
  }

  private tune(t: number, w: Float64Array): void {
    const f = Math.min(this.steps, Math.max(0, t * HZ))
    const j = Math.floor(f)
    const m = f - j
    w[0] = this.cum[j]! + (this.cum[j + 1]! - this.cum[j]!) * m
    w[1] = this.gust[j]! + (this.gust[j + 1]! - this.gust[j]!) * m
    const s = this.surge
    w[2] = s[j * 3]! + (s[j * 3 + 3]! - s[j * 3]!) * m
    w[3] = s[j * 3 + 1]! + (s[j * 3 + 4]! - s[j * 3 + 1]!) * m
    w[4] = s[j * 3 + 2]! + (s[j * 3 + 5]! - s[j * 3 + 2]!) * m
  }

  private place(i: number, t: number, out: Float32Array, w: Float64Array): void {
    this.parked = false
    const o = i * 3
    const p = i * PER
    const par = this.par
    const kind = this.path[i]!
    let x = this.home[o]!
    let y = this.home[o + 1]!
    let z = this.home[o + 2]!
    let op = this.opacity0[i]!
    let ph = this.phase0[i]! + this.spin[i]! * t
    let st = this.state0[i]!
    const flying = t > this.tossAt[i]! && t < this.landAt[i]!
    if (kind === STILL && !flying) {
      out[o] = x
      out[o + 1] = y
      out[o + 2] = z
      this.op = op
      this.ph = ph
      this.st = st
      return
    }
    const seed = this.seed[i]!
    if (kind === SINK) {
      let f = par[p + 2]! + t * par[p + 3]!
      f -= Math.floor(f)
      y = par[p]! - par[p + 1]! * f
      op *= smooth(f / EDGE) * smooth((1 - f) / EDGE)
      const a = par[p + 4]!
      const wv = par[p + 5]!
      x += a * (Math.sin(wv * t + seed) - Math.sin(seed))
      z += a * 0.8 * (Math.sin((wv + TAU / this.seconds) * t + seed * 1.7) - Math.sin(seed * 1.7))
    } else if (kind === DRIFT) {
      const a = par[p]!
      const wv = par[p + 1]!
      const w2 = wv + TAU / this.seconds
      x += a * (Math.sin(wv * t + seed) - Math.sin(seed))
      y += a * 0.5 * (Math.sin(w2 * t + seed * 2.3) - Math.sin(seed * 2.3))
      z += a * (Math.sin(wv * t + seed * 1.7 + 1) - Math.sin(seed * 1.7 + 1))
    } else if (kind === WANDER) {
      wanderAt(i, this.kindOf[i]!, this.nest, t, this.seconds, this.q)
      x += this.q[0]! - par[p]!
      y += this.q[1]! - par[p + 1]!
      z += this.q[2]! - par[p + 2]!
    } else if (kind === CYCLE) {
      let a = par[p + 2]! + t * par[p + 3]!
      a -= Math.floor(a)
      y = par[p]! + par[p + 1]! * a
      const s = par[p + 4]!
      const wv = par[p + 5]!
      x += s * (Math.sin(wv * t + seed) - Math.sin(seed))
      z += s * (Math.sin(wv * t + seed * 1.7) - Math.sin(seed * 1.7))
      op = emberGlow(a)
      ph = a * TAU
    }
    if (flying) {
      const up = smooth((t - this.tossAt[i]!) / this.rise[i]!)
      const down = 1 - fall((t - this.sinkAt[i]!) / (this.landAt[i]! - this.sinkAt[i]!))
      const e = up * down
      x += this.off[o]! * e
      y += this.off[o + 1]! * e
      z += this.off[o + 2]! * e
      const wob = e * w[1]! * this.amp[i]!
      const wr = this.rate[i]!
      x += wob * Math.sin(wr * t + seed)
      y += wob * 0.6 * Math.sin(1.37 * wr * t + seed + 2.1)
      z += wob * Math.sin(0.81 * wr * t + seed + 4.2)
      const swirl = e * w[1]!
      for (let m = 0; m < 3; m++) {
        const k = EDDY[m]!
        const a = swirl * k[6]! * Math.sin(this.wave[o + m]! + k[7]! * t)
        x += a * k[3]!
        y += a * k[4]!
        z += a * k[5]!
      }
      const lag = e * this.hill[i]!
      x += w[2]! * lag
      y += w[3]! * lag
      z += w[4]! * lag
      const part = (w[0]! - this.turned[i]!) * this.span[i]!
      const th = this.turns[i]! * part
      if (th !== 0) {
        const c = Math.cos(th)
        const s = Math.sin(th)
        const rx = x * c + z * s
        z = z * c - x * s
        x = rx
      }
      if (kind !== CYCLE) ph += this.tumble[i]! * part
      st = STATE_LIQUID
    }
    let r2 = x * x + y * y + z * z
    if (r2 > WALL2) {
      const s = WALL / Math.sqrt(r2)
      x *= s
      y *= s
      z *= s
    }
    const g = this.g
    let d = sdfSample(this.grid, x, y, z, g)
    if (d < MARGIN) {
      if (d < -SHALLOW) op *= smooth((d + DEEP) / (DEEP - SHALLOW))
      for (let pass = 0; pass < 8 && d < MARGIN; pass++) {
        const gl = Math.sqrt(g[0]! * g[0]! + g[1]! * g[1]! + g[2]! * g[2]!)
        if (gl < 1e-6) break
        const push = (MARGIN - d) / gl
        x += g[0]! * push
        y += g[1]! * push
        z += g[2]! * push
        r2 = x * x + y * y + z * z
        if (r2 > WALL2) {
          const s = WALL / Math.sqrt(r2)
          x *= s
          y *= s
          z *= s
        }
        d = sdfSample(this.grid, x, y, z, g)
      }
      if (d < -0.04) {
        x = this.park[0]
        y = this.park[1]
        z = this.park[2]
        op = 0
        this.parked = true
      }
    }
    out[o] = x
    out[o + 1] = y
    out[o + 2] = z
    this.op = op
    this.ph = ph
    this.st = st
  }

  get source(): LoopPaths {
    return this
  }

  get cover(): { readonly n: number; readonly spanMm: number; readonly mm: Float32Array } {
    if (this.drifted) {
      heapCover(this.count, this.state, this.pos, this.sizes, this.kindOf, this.heap, this.lain.mm)
      this.drifted = false
    }
    return this.lain
  }

  setTime(seconds: number): void {
    const L = this.seconds
    const n = this.count
    let t = seconds - L * Math.floor(seconds / L)
    if (!(t >= 0 && t < L)) t = 0
    let before = t - DT
    if (before < 0) before += L
    this.time = t
    this.step = Math.round(t * HZ)
    const state0 = this.state0
    const pos = this.pos
    const prev = this.prev
    this.tune(before, this.then)
    this.tune(t, this.now)
    for (let i = 0; i < n; i++) {
      if (state0[i] === STATE_HIDDEN) continue
      this.place(i, before, prev, this.then)
      const was = this.parked
      this.place(i, t, pos, this.now)
      if (was || this.parked) {
        const o = i * 3
        prev[o] = pos[o]!
        prev[o + 1] = pos[o + 1]!
        prev[o + 2] = pos[o + 2]!
      }
      this.opacity[i] = this.op
      const ph = this.ph
      this.phase[i] = ph - TAU * Math.floor(ph / TAU)
      this.state[i] = this.st
    }
    const f = t * HZ
    const j = Math.floor(f)
    const m = f - j
    const tr = this.trace
    for (let c = 0; c < LIQUID_LENGTH; c++) {
      const a = tr[j * LIQUID_LENGTH + c]!
      this.liquid[c] = a + (tr[(j + 1) * LIQUID_LENGTH + c]! - a) * m
    }
    this.drifted = true
  }
}
