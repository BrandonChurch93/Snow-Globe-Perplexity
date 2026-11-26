import type { ParticleSource, SdfGrid } from '../../core/stage'
import type { Timeline } from '../../film/timeline'
import { EngineClient, poolAt, type EnginePort } from './client'
import { packSnapshot, STATE_LIQUID } from './engine'
import { plainTimeline } from './host'
import { SEASONS } from './kinds'
import { LiveEngine, Padded } from './live'
import type { Emitter } from './sdf'

export interface EngineWorker extends EnginePort {
  onerror: ((event: unknown) => void) | null
  onmessageerror: ((event: unknown) => void) | null
  terminate(): void
}

export function spawnEngineWorker(): EngineWorker | null {
  if (typeof Worker === 'undefined') return null
  try {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as EngineWorker
  } catch {
    return null
  }
}

export interface RunnerOptions {
  season?: string
  fraction?: number
  spawn?: (() => EngineWorker | null) | null
  now?: () => number
  /** Runs `then` once the page has read every message that was already waiting for it. */
  turn?: (then: () => void) => void
  readyMs?: number
  frameMs?: number
  budgetMs?: number
}

const READY_MS = 6000
const FRAME_MS = 3000
/** The most one frame of the page adds to a wait: the longest frame the session's own clock counts. */
const SHARE_MS = 250
const BUDGET_MS = 8

/** A message the page posts to itself joins the queue the worker's answers wait in, behind them. */
function afterMessages(then: () => void): void {
  if (typeof MessageChannel === 'undefined') {
    setTimeout(then, 0)
    return
  }
  const channel = new MessageChannel()
  channel.port1.onmessage = () => {
    channel.port1.close()
    then()
  }
  channel.port2.postMessage(0)
}

/**
 * How long the page has waited for the worker, counted so that only the worker can use it up. The page's own clock would
 * count the time in which the page stood still and could not have read an answer, and a browser may run a tap and then
 * a frame before it reads one that has long been waiting. So each look adds the time since the last one, at most
 * `SHARE_MS` of it, and the wait is over only once the page's message queue has turned after the limit was passed and
 * the answer is still missing.
 */
class Patience {
  private counted = 0
  private last = -1
  private asked = false
  private turned = false
  private round = 0

  constructor(
    private readonly now: () => number,
    private readonly turn: (then: () => void) => void,
  ) {}

  /** Starts to count, unless it is counting. */
  begin(): void {
    if (this.last >= 0) return
    this.last = this.now()
    this.counted = 0
  }

  /** The answer came, or nothing is asked: nothing is counted, and a turn asked for earlier tells nothing. */
  rest(): void {
    this.last = -1
    this.counted = 0
    this.asked = false
    this.turned = false
    this.round++
  }

  /** Counts up to now and says whether the wait is over `limit` and the queue has turned since it was. */
  spent(limit: number): boolean {
    if (this.last < 0) return false
    const t = this.now()
    this.counted += Math.min(Math.max(t - this.last, 0), SHARE_MS)
    this.last = t
    if (this.counted <= limit) return false
    if (this.turned) return true
    if (!this.asked) {
      this.asked = true
      const round = this.round
      this.turn(() => {
        if (round === this.round) this.turned = true
      })
    }
    return false
  }
}

type Collider = SdfGrid | ((season: string) => SdfGrid)

export class LiveRunner {
  readonly source: Padded
  fallbacks = 0
  private readonly local: LiveEngine
  private readonly patience: Patience
  private readonly readyMs: number
  private readonly frameMs: number
  private worker: EngineWorker | null = null
  private client: EngineClient | null = null
  private away = false
  private fraction: number
  private collider: Collider | null = null
  private readonly posted = new Set<string>()
  private line = ''
  private held = false
  private heldSeason: string | undefined = undefined

  constructor(options: RunnerOptions = {}) {
    this.fraction = options.fraction ?? 1
    this.patience = new Patience(options.now ?? (() => performance.now()), options.turn ?? afterMessages)
    this.readyMs = options.readyMs ?? READY_MS
    this.frameMs = options.frameMs ?? FRAME_MS
    this.local = new LiveEngine({ season: options.season, fraction: options.fraction })
    this.source = new Padded(() => this.shown())
    const worker = options.spawn ? options.spawn() : null
    if (!worker) return
    this.worker = worker
    this.patience.begin()
    worker.onerror = () => this.fail()
    worker.onmessageerror = () => this.fail()
    try {
      const client = new EngineClient(worker, { season: options.season, fraction: options.fraction, budgetMs: options.budgetMs ?? BUDGET_MS })
      client.onFrame = () => {
        this.patience.rest()
        this.source.touch()
      }
      this.client = client
    } catch {
      this.drop()
    }
  }

  get remote(): boolean {
    return this.away
  }
  get frames(): number {
    return this.client?.frames ?? 0
  }
  get step(): number {
    return this.away ? this.client!.step : this.local.step
  }
  get season(): string {
    return this.away ? this.client!.season : this.local.season
  }
  get active(): number {
    return poolAt(this.fraction)
  }

  private shown(): ParticleSource {
    const c = this.client
    return this.away && c && c.frames > 0 ? c : this.local.inner
  }

  /** Holds every reset until `release`: a season's collider may read models the stage has not prepared yet. */
  hold(): void {
    this.held = true
  }

  /** Ends the hold and resets once, on `season` or on the last season a held reset named. */
  release(season?: string): void {
    const to = season ?? this.heldSeason
    this.held = false
    this.heldSeason = undefined
    this.reset(to)
  }

  reset(season?: string): void {
    if (this.held) {
      this.heldSeason = season ?? this.heldSeason
      return
    }
    if (this.away) this.client!.reset(season)
    else this.local.reset(season)
    this.source.touch()
  }

  stir(x: number, y: number, z: number): void {
    if (this.away) this.client!.stir(x, y, z)
    else this.local.stir(x, y, z)
  }

  floating(): number {
    const s = this.shown()
    let c = 0
    for (let i = 0; i < s.count; i++) if (s.state[i] === STATE_LIQUID) c++
    return c
  }

  setCollider(collider: Collider, emitters?: Record<string, Emitter[]>): void {
    this.collider = collider
    this.local.setCollider(collider, emitters)
    this.posted.clear()
    try {
      this.client?.setCollider(typeof collider === 'function' ? {} : collider, emitters)
    } catch {
      this.fail()
    }
  }

  setFraction(fraction: number): void {
    this.fraction = fraction
    if (this.away) this.client!.setFraction(fraction)
    else this.local.setFraction(fraction)
    this.source.touch()
  }

  advanceTo(target: number, tl: Timeline): void {
    if (!this.away && this.client) {
      if (this.client.started) this.handOver(tl)
      else if (this.patience.spent(this.readyMs)) this.drop()
    }
    if (this.away && this.patience.spent(this.frameMs)) this.fail()
    if (!this.away) {
      // The picture reads `source`, a copy made again only when it is told the arrays moved; the engine tells its own view, not this one.
      this.local.advanceTo(target, tl)
      this.source.touch()
      return
    }
    const c = this.client!
    try {
      this.tell(tl)
      c.advanceTo(target)
      if (c.waiting) this.patience.begin()
      else this.patience.rest()
    } catch {
      this.fail()
      this.local.advanceTo(target, tl)
      this.source.touch()
    }
  }

  private grids(seasons: string[]): void {
    const collider = this.collider
    const c = this.client
    if (!c || typeof collider !== 'function') return
    for (const s of seasons) {
      if (this.posted.has(s) || !SEASONS.includes(s)) continue
      this.posted.add(s)
      c.addGrid(s, collider(s))
    }
  }

  private tell(tl: Timeline): void {
    const line = JSON.stringify(plainTimeline(tl))
    if (line === this.line) return
    this.grids([tl.startSeason, ...tl.events.flatMap((e) => [e.from, e.to])])
    this.client!.setTimeline(tl)
    this.line = line
  }

  private handOver(tl: Timeline): void {
    const c = this.client!
    try {
      const s = this.local.snapshot()
      this.grids([this.local.season, ...SEASONS.filter((_, ix) => s.era.includes(ix))])
      this.line = ''
      this.tell(tl)
      c.setFraction(this.fraction)
      c.restore(packSnapshot(s), s.step, this.local.season)
      this.away = true
      this.patience.rest()
    } catch {
      this.drop()
    }
  }

  private drop(): void {
    const w = this.worker
    this.worker = null
    this.client = null
    this.away = false
    this.patience.rest()
    if (!w) return
    w.onmessage = null
    w.onerror = null
    w.onmessageerror = null
    try {
      w.terminate()
    } catch {
      return
    }
  }

  private fail(): void {
    const c = this.client
    const moved = this.away && c !== null && c.frames > 0
    const step = c ? c.step : 0
    const season = c ? c.season : this.local.season
    const was = this.away
    this.drop()
    if (!was) return
    this.fallbacks++
    this.local.setFraction(this.fraction)
    if (moved) this.local.restAt(season, step)
    this.source.touch()
  }
}
