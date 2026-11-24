import type { ParticleSource, SdfGrid } from '../../core/stage'
import type { Timeline } from '../../film/timeline'
import { ParticleEngine, STATE_HIDDEN, type EngineOptions, type EngineSnapshot } from './engine'
import { KINDS, POOL, SEASONS } from './kinds'
import type { Emitter } from './sdf'

export class Padded implements ParticleSource {
  readonly count = POOL
  readonly kinds: readonly string[] = KINDS
  private readonly own = {
    pos: new Float32Array(POOL * 3),
    prev: new Float32Array(POOL * 3),
    sizes: new Float32Array(POOL),
    opacity: new Float32Array(POOL),
    phase: new Float32Array(POOL),
    kindOf: new Uint8Array(POOL),
    state: new Uint8Array(POOL).fill(STATE_HIDDEN),
  }
  private dirty = true
  private held = 0

  constructor(private readonly inner: () => ParticleSource) {}

  touch(): void {
    this.dirty = true
  }

  private sync(): typeof this.own {
    const own = this.own
    if (!this.dirty) return own
    this.dirty = false
    const s = this.inner()
    const n = Math.min(POOL, s.count)
    own.pos.set(s.pos.subarray(0, n * 3))
    own.prev.set(s.prev.subarray(0, n * 3))
    own.sizes.set(s.sizes.subarray(0, n))
    own.kindOf.set(s.kindOf.subarray(0, n))
    own.state.set(s.state.subarray(0, n))
    if (s.opacity) own.opacity.set(s.opacity.subarray(0, n))
    else own.opacity.fill(1, 0, n)
    if (s.phase) own.phase.set(s.phase.subarray(0, n))
    if (n < this.held) {
      own.sizes.fill(0, n, this.held)
      own.opacity.fill(0, n, this.held)
      own.state.fill(STATE_HIDDEN, n, this.held)
    }
    this.held = n
    return own
  }

  get step(): number {
    return this.inner().step
  }
  get liquid(): Float64Array {
    return this.inner().liquid
  }
  get pos(): Float32Array {
    return this.sync().pos
  }
  get prev(): Float32Array {
    return this.sync().prev
  }
  get sizes(): Float32Array {
    return this.sync().sizes
  }
  get opacity(): Float32Array {
    return this.sync().opacity
  }
  get phase(): Float32Array {
    return this.sync().phase
  }
  get kindOf(): Uint8Array {
    return this.sync().kindOf
  }
  get state(): Uint8Array {
    return this.sync().state
  }
}

function fit(from: EngineSnapshot, to: EngineSnapshot): EngineSnapshot {
  const m = Math.min(to.state.length, from.state.length)
  to.pos.set(from.pos.subarray(0, m * 3))
  to.prev.set(from.prev.subarray(0, m * 3))
  to.vel.set(from.vel.subarray(0, m * 3))
  to.state.set(from.state.subarray(0, m))
  to.phase.set(from.phase.subarray(0, m))
  to.fade.set(from.fade.subarray(0, m))
  to.opacity.set(from.opacity.subarray(0, m))
  to.stamp.set(from.stamp.subarray(0, m))
  to.kindOf.set(from.kindOf.subarray(0, m))
  to.era.set(from.era.subarray(0, m))
  to.mark.set(from.mark.subarray(0, m))
  for (let i = m; i < to.stamp.length; i++) to.stamp[i] = to.stamp[i]! + from.step
  return { ...to, step: from.step, liquid: from.liquid, now: from.now, start: from.start }
}

export class LiveEngine {
  readonly source: Padded
  private engine: ParticleEngine
  private options: EngineOptions

  constructor(options: EngineOptions = {}) {
    this.options = { ...options }
    this.engine = new ParticleEngine(options)
    this.source = new Padded(() => this.engine)
  }

  get step(): number {
    return this.engine.step
  }
  get season(): string {
    return this.engine.seasonNow
  }
  get active(): number {
    return this.engine.count
  }

  reset(season?: string): void {
    this.engine.reset(season)
    this.source.touch()
  }

  stir(x: number, y: number, z: number): void {
    this.engine.stir(x, y, z)
  }

  advanceTo(target: number, tl: Timeline): void {
    const e = this.engine
    if (e.step > 0 && tl.events.length === 0 && tl.startSeason !== e.seasonNow && SEASONS.includes(tl.startSeason)) this.rest(tl.startSeason)
    this.engine.advanceTo(target, tl)
    this.source.touch()
  }

  private rest(season: string): void {
    const e = this.engine
    const step = e.step
    e.reset(season)
    const s = e.snapshot()
    for (let i = 0; i < s.stamp.length; i++) s.stamp[i] = s.stamp[i]! + step
    e.restore({ ...s, step })
  }

  floating(): number {
    return this.engine.floating()
  }

  setCollider(collider: SdfGrid | ((season: string) => SdfGrid), emitters?: Record<string, Emitter[]>): void {
    this.options = { ...this.options, collider, ...(emitters ? { emitters } : {}) }
    this.engine.setCollider(collider, emitters)
  }

  setFraction(fraction: number): void {
    const want = Math.max(1, Math.min(POOL, Math.round(POOL * fraction)))
    if (want === this.engine.count) return
    const old = this.engine.snapshot()
    const next = new ParticleEngine({ ...this.options, season: this.engine.seasonNow, fraction })
    next.reset()
    next.restore(fit(old, next.snapshot()))
    this.engine = next
    this.source.touch()
  }
}
