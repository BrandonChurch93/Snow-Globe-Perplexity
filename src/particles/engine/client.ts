import { config } from '../../config'
import type { SdfGrid } from '../../core/stage'
import type { Timeline } from '../../film/timeline'
import { LIQUID_LENGTH } from '../../globe/liquid'
import { COVER_N, COVER_SPAN_MM, STATE_HIDDEN } from './engine'
import { frameViews, plainTimeline, type Colliders, type FromEngine, type ToEngine } from './host'
import { KINDS, POOL } from './kinds'
import type { Emitter } from './sdf'

export interface EnginePort {
  onmessage: ((event: { data: FromEngine }) => void) | null
  postMessage(message: ToEngine, transfer?: ArrayBuffer[]): void
}

export interface ClientOptions {
  season?: string
  fraction?: number
  colliders?: Colliders
  emitters?: Record<string, Emitter[]>
  budgetMs?: number
}

export const poolAt = (fraction: number | undefined): number => Math.max(1, Math.min(POOL, Math.round(POOL * (fraction ?? 1))))

export class EngineClient {
  readonly kinds: readonly string[] = KINDS
  readonly ready: Promise<void>
  count: number
  pos: Float32Array
  prev: Float32Array
  sizes: Float32Array
  opacity: Float32Array
  phase: Float32Array
  kindOf: Uint8Array
  state: Uint8Array
  liquid: Float64Array = new Float64Array(LIQUID_LENGTH)
  cover: { n: number; spanMm: number; mm: Float32Array } = { n: COVER_N, spanMm: COVER_SPAN_MM, mm: new Float32Array(COVER_N * COVER_N) }
  step = 0
  season: string
  frames = 0
  started = false
  onFrame: (() => void) | null = null

  private readonly port: EnginePort
  private readonly budgetMs: number | undefined
  private spare: ArrayBuffer[] = []
  private shown: ArrayBuffer | null = null
  private busy = false
  private goal = -1
  private epoch = 0
  private sent = 0
  private fresh = false

  constructor(port: EnginePort, options: ClientOptions = {}) {
    const n = poolAt(options.fraction)
    this.port = port
    this.budgetMs = options.budgetMs
    this.count = n
    this.season = options.season ?? config.defaultSeason
    this.pos = new Float32Array(n * 3)
    this.prev = new Float32Array(n * 3)
    this.sizes = new Float32Array(n)
    this.opacity = new Float32Array(n)
    this.phase = new Float32Array(n)
    this.kindOf = new Uint8Array(n)
    this.state = new Uint8Array(n).fill(STATE_HIDDEN)
    let started: () => void = () => {}
    this.ready = new Promise<void>((resolve) => {
      started = resolve
    })
    port.onmessage = (event) => {
      const m = event.data
      if (m.type === 'ready') {
        this.started = true
        started()
      } else if (m.type === 'frame') this.take(m.step, m.season, m.count, m.buffer)
    }
    port.postMessage({ type: 'init', season: this.season, fraction: options.fraction, colliders: options.colliders, emitters: options.emitters })
  }

  get waiting(): boolean {
    return this.busy
  }

  setTimeline(tl: Timeline): void {
    this.port.postMessage({ type: 'timeline', timeline: plainTimeline(tl) })
  }

  setCollider(colliders: Colliders, emitters?: Record<string, Emitter[]>): void {
    this.stale()
    this.port.postMessage({ type: 'collider', colliders, emitters })
  }

  addGrid(season: string, grid: SdfGrid): void {
    this.port.postMessage({ type: 'grid', season, grid })
  }

  setFraction(fraction: number): void {
    this.port.postMessage({ type: 'fraction', fraction })
  }

  reset(season?: string): void {
    this.stale()
    this.step = 0
    this.port.postMessage({ type: 'reset', season })
  }

  restore(buffer: ArrayBuffer, step: number, season: string): void {
    this.stale()
    this.step = step
    this.season = season
    this.port.postMessage({ type: 'restore', buffer }, [buffer])
  }

  stir(x: number, y: number, z: number): void {
    this.port.postMessage({ type: 'stir', x, y, z })
  }

  advanceTo(step: number): void {
    this.goal = step
    if (this.busy || (this.fresh && step <= this.step)) return
    this.busy = true
    this.sent = this.epoch
    const spare = this.spare
    this.spare = []
    this.port.postMessage({ type: 'advance', step, spare, ...(this.budgetMs === undefined ? {} : { budgetMs: this.budgetMs }) }, spare)
  }

  private stale(): void {
    this.epoch++
    this.fresh = false
    this.goal = -1
  }

  private take(step: number, season: string, count: number, buffer: ArrayBuffer): void {
    this.busy = false
    const current = this.sent === this.epoch
    if (current) {
      const v = frameViews(buffer, count)
      this.count = count
      this.liquid = v.liquid
      this.cover = { n: COVER_N, spanMm: COVER_SPAN_MM, mm: v.cover }
      this.pos = v.pos
      this.prev = v.prev
      this.sizes = v.sizes
      this.opacity = v.opacity
      this.phase = v.phase
      this.kindOf = v.kindOf
      this.state = v.state
      this.step = step
      this.season = season
      this.frames++
      this.fresh = true
      if (this.shown) this.spare.push(this.shown)
      this.shown = buffer
      if (this.onFrame) this.onFrame()
    } else this.spare.push(buffer)
    if (this.goal >= 0 && (!this.fresh || this.goal > this.step)) this.advanceTo(this.goal)
  }
}
