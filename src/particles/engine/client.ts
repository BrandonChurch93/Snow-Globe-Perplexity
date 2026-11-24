import { config } from '../../config'
import type { Timeline } from '../../film/timeline'
import { LIQUID_LENGTH } from '../../globe/liquid'
import { STATE_HIDDEN } from './engine'
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
}

export class EngineClient {
  readonly count: number
  readonly kinds: readonly string[] = KINDS
  readonly pos: Float32Array
  readonly prev: Float32Array
  readonly sizes: Float32Array
  readonly opacity: Float32Array
  readonly phase: Float32Array
  readonly kindOf: Uint8Array
  readonly state: Uint8Array
  readonly liquid = new Float64Array(LIQUID_LENGTH)
  readonly ready: Promise<void>
  step = 0
  season: string
  onFrame: (() => void) | null = null

  private readonly port: EnginePort
  private readonly spare: ArrayBuffer[] = []
  private busy = false
  private wanted = -1
  private epoch = 0
  private sent = 0

  constructor(port: EnginePort, options: ClientOptions = {}) {
    const n = Math.max(1, Math.min(POOL, Math.round(POOL * (options.fraction ?? 1))))
    this.port = port
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
      if (m.type === 'ready') started()
      else if (m.type === 'frame') this.take(m.step, m.season, m.buffer)
    }
    port.postMessage({ type: 'init', season: this.season, fraction: options.fraction, colliders: options.colliders, emitters: options.emitters })
  }

  setTimeline(tl: Timeline): void {
    this.port.postMessage({ type: 'timeline', timeline: plainTimeline(tl) })
  }

  setCollider(colliders: Colliders, emitters?: Record<string, Emitter[]>): void {
    this.epoch++
    this.port.postMessage({ type: 'collider', colliders, emitters })
  }

  reset(season?: string): void {
    this.epoch++
    this.port.postMessage({ type: 'reset', season })
  }

  stir(x: number, y: number, z: number): void {
    this.port.postMessage({ type: 'stir', x, y, z })
  }

  advanceTo(step: number): void {
    if (this.busy) {
      this.wanted = step
      return
    }
    this.busy = true
    this.wanted = -1
    this.sent = this.epoch
    const spare = this.spare.splice(0)
    this.port.postMessage({ type: 'advance', step, spare }, spare)
  }

  private take(step: number, season: string, buffer: ArrayBuffer): void {
    this.busy = false
    if (this.sent === this.epoch) {
      const v = frameViews(buffer, this.count)
      this.liquid.set(v.liquid)
      this.pos.set(v.pos)
      this.prev.set(v.prev)
      this.sizes.set(v.sizes)
      this.opacity.set(v.opacity)
      this.phase.set(v.phase)
      this.kindOf.set(v.kindOf)
      this.state.set(v.state)
      this.step = step
      this.season = season
    }
    this.spare.push(buffer)
    if (this.sent === this.epoch && this.onFrame) this.onFrame()
    if (this.wanted >= 0) this.advanceTo(this.wanted)
  }
}
