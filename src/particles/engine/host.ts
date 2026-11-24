import type { SdfGrid } from '../../core/stage'
import type { Timeline } from '../../film/timeline'
import { LIQUID_LENGTH } from '../../globe/liquid'
import { makeShake } from '../../shake/table'
import { COVER_N, packSnapshot, unpackSnapshot } from './engine'
import { LiveEngine } from './live'
import type { Emitter } from './sdf'

export interface PlainEvent {
  id: string
  startSec: number
  from: string
  to: string
  seconds?: number
  holdBeats?: number
}

export interface PlainTimeline {
  id: string
  startSeason: string
  events: PlainEvent[]
}

export const plainTimeline = (tl: Timeline): PlainTimeline => ({ id: tl.id, startSeason: tl.startSeason, events: tl.events.map((e) => ({ id: e.id, startSec: e.startSec, from: e.from, to: e.to, ...(e.seconds === undefined ? {} : { seconds: e.seconds }), ...(e.holdBeats === undefined ? {} : { holdBeats: e.holdBeats }) })) })

export const builtTimeline = (p: PlainTimeline): Timeline => ({ id: p.id, startSeason: p.startSeason, events: p.events.map((e) => ({ ...e, path: makeShake(e.id) })) })

export type Colliders = SdfGrid | Record<string, SdfGrid>

export type ToEngine =
  | { type: 'init'; season?: string; fraction?: number; colliders?: Colliders; emitters?: Record<string, Emitter[]> }
  | { type: 'collider'; colliders: Colliders; emitters?: Record<string, Emitter[]> }
  | { type: 'grid'; season: string; grid: SdfGrid }
  | { type: 'fraction'; fraction: number }
  | { type: 'reset'; season?: string }
  | { type: 'timeline'; timeline: PlainTimeline }
  | { type: 'advance'; step: number; spare?: ArrayBuffer[]; budgetMs?: number }
  | { type: 'stir'; x: number; y: number; z: number }
  | { type: 'snapshot' }
  | { type: 'restore'; buffer: ArrayBuffer }

export type FromEngine =
  | { type: 'ready'; count: number; kinds: readonly string[]; season: string }
  | { type: 'frame'; step: number; season: string; count: number; buffer: ArrayBuffer }
  | { type: 'snapshot'; buffer: ArrayBuffer }

export interface FrameViews {
  liquid: Float64Array
  cover: Float32Array
  pos: Float32Array
  prev: Float32Array
  sizes: Float32Array
  opacity: Float32Array
  phase: Float32Array
  kindOf: Uint8Array
  state: Uint8Array
}

const COVER_CELLS = COVER_N * COVER_N

export const frameBytes = (count: number): number => LIQUID_LENGTH * 8 + COVER_CELLS * 4 + count * 38

export function frameViews(buffer: ArrayBuffer, count: number): FrameViews {
  let o = LIQUID_LENGTH * 8
  const floats = (per: number): Float32Array => {
    const v = new Float32Array(buffer, o, count * per)
    o += count * per * 4
    return v
  }
  const liquid = new Float64Array(buffer, 0, LIQUID_LENGTH)
  const cover = new Float32Array(buffer, o, COVER_CELLS)
  o += COVER_CELLS * 4
  const pos = floats(3)
  const prev = floats(3)
  const sizes = floats(1)
  const opacity = floats(1)
  const phase = floats(1)
  return { liquid, cover, pos, prev, sizes, opacity, phase, kindOf: new Uint8Array(buffer, o, count), state: new Uint8Array(buffer, o + count, count) }
}

const isGrid = (c: Colliders): c is SdfGrid => 'data' in c && 'n' in c

export interface Reply {
  message: FromEngine
  transfer: ArrayBuffer[]
}

export class EngineHost {
  private engine: LiveEngine | null = null
  private timeline: Timeline = { id: 'rest', startSeason: '', events: [] }
  private table: Record<string, SdfGrid> = {}

  private colliderOf(c: Colliders): SdfGrid | ((season: string) => SdfGrid) {
    if (isGrid(c)) return c
    this.table = { ...c }
    return (season: string): SdfGrid => {
      const grid = this.table[season]
      if (!grid) throw new Error(`no collider for the season: ${season}`)
      return grid
    }
  }

  handle(m: ToEngine): Reply | null {
    if (m.type === 'init') {
      this.engine = new LiveEngine({ season: m.season, fraction: m.fraction, collider: m.colliders ? this.colliderOf(m.colliders) : undefined, emitters: m.emitters })
      this.timeline = { id: 'rest', startSeason: this.engine.season, events: [] }
      return { message: { type: 'ready', count: this.engine.active, kinds: this.engine.inner.kinds, season: this.engine.season }, transfer: [] }
    }
    const e = this.engine
    if (!e) throw new Error('the engine has not been started')
    if (m.type === 'collider') e.setCollider(this.colliderOf(m.colliders), m.emitters)
    else if (m.type === 'grid') this.table[m.season] = m.grid
    else if (m.type === 'fraction') e.setFraction(m.fraction)
    else if (m.type === 'reset') e.reset(m.season)
    else if (m.type === 'timeline') this.timeline = builtTimeline(m.timeline)
    else if (m.type === 'stir') e.stir(m.x, m.y, m.z)
    else if (m.type === 'restore') e.restore(unpackSnapshot(m.buffer, LIQUID_LENGTH))
    else if (m.type === 'snapshot') {
      const buffer = packSnapshot(e.snapshot())
      return { message: { type: 'snapshot', buffer }, transfer: [buffer] }
    } else if (m.type === 'advance') {
      if (m.step < e.step) e.reset()
      if (m.budgetMs === undefined) e.advanceTo(m.step, this.timeline)
      else {
        const t0 = performance.now()
        while (e.step < m.step) {
          e.advanceTo(e.step + 1, this.timeline)
          if (performance.now() - t0 >= m.budgetMs) break
        }
      }
      const p = e.inner
      const bytes = frameBytes(p.count)
      const buffer = m.spare?.find((b) => b.byteLength === bytes) ?? new ArrayBuffer(bytes)
      const v = frameViews(buffer, p.count)
      v.liquid.set(p.liquid)
      v.cover.set(p.cover.mm)
      v.pos.set(p.pos)
      v.prev.set(p.prev)
      v.sizes.set(p.sizes)
      v.opacity.set(p.opacity)
      v.phase.set(p.phase)
      v.kindOf.set(p.kindOf)
      v.state.set(p.state)
      return { message: { type: 'frame', step: p.step, season: p.seasonNow, count: p.count, buffer }, transfer: [buffer] }
    }
    return null
  }
}
