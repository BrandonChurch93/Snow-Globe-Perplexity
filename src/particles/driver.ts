import { config } from '../config'
import type { Timeline } from '../film/timeline'
import { packSnapshot, unpackSnapshot, type EngineSnapshot } from './engine/engine'

const HZ = config.sim.stepHz
const EVERY = Math.round(config.sim.checkpointSeconds * HZ)
const KEEP = 6

export interface SimStore {
  list(key: string): Promise<number[]>
  get(key: string, step: number): Promise<ArrayBuffer | null>
  put(key: string, step: number, data: ArrayBuffer): Promise<void>
}

export interface DrivenSim {
  readonly step: number
  readonly season: string
  readonly count: number
  reset(): void
  advanceTo(step: number, tl: Timeline): void
  snapshot(): EngineSnapshot
  restore(s: EngineSnapshot): void
  floating(): number
}

export class SimDriver {
  private timelineId = ''
  private marks: EngineSnapshot[] = []
  private remote: number[] = []
  replayed = 0

  constructor(readonly sim: DrivenSim, private readonly store: SimStore | null, private readonly prefix: string) {}

  private key(tl: Timeline): string {
    return `${this.prefix}-${tl.id.replace(/[^a-z0-9]+/gi, '_')}-${this.sim.season}-${this.sim.count}`
  }

  async seek(tl: Timeline, timeSec: number): Promise<number> {
    const f = timeSec * HZ
    const target = Math.max(1, Math.ceil(f - 1e-7))
    const mix = Math.min(1, Math.max(0, f - (target - 1)))
    const sim = this.sim
    if (tl.id !== this.timelineId) {
      this.timelineId = tl.id
      this.marks = []
      this.remote = this.store ? await this.store.list(this.key(tl)) : []
      sim.reset()
    }
    if (target < sim.step) {
      const mark = this.marks.filter((m) => m.step <= target).sort((a, b) => b.step - a.step)[0]
      if (mark) sim.restore(mark)
      else sim.reset()
    }
    if (this.store) {
      const best = this.remote.filter((s) => s <= target && s > sim.step).sort((a, b) => b - a)[0]
      if (best !== undefined && best - sim.step > 24) {
        const data = await this.store.get(this.key(tl), best)
        if (data) sim.restore(unpackSnapshot(data))
      }
    }
    while (sim.step < target) {
      const next = Math.min(target, (Math.floor(sim.step / EVERY) + 1) * EVERY)
      const before = sim.step
      sim.advanceTo(next, tl)
      this.replayed += sim.step - before
      if (sim.step % EVERY === 0) {
        const snap = sim.snapshot()
        this.marks.push(snap)
        if (this.marks.length > KEEP) this.marks.shift()
        if (this.store && !this.remote.includes(snap.step)) {
          await this.store.put(this.key(tl), snap.step, packSnapshot(snap))
          this.remote.push(snap.step)
        }
        await new Promise((r) => setTimeout(r, 0))
      }
    }
    return mix
  }
}

export function httpStore(base: string): SimStore {
  return {
    async list(key) {
      const r = await fetch(`${base}/${key}/`)
      return r.ok ? ((await r.json()) as number[]) : []
    },
    async get(key, step) {
      const r = await fetch(`${base}/${key}/${step}.bin`)
      return r.ok ? r.arrayBuffer() : null
    },
    async put(key, step, data) {
      await fetch(`${base}/${key}/${step}.bin`, { method: 'PUT', body: data })
    },
  }
}
