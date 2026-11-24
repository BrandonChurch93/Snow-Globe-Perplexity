import type { SdfGrid } from '../../core/stage'
import type { Timeline } from '../../film/timeline'
import { LIQUID_LENGTH } from '../../globe/liquid'
import { makeShake } from '../../shake/table'
import { packSnapshot, ParticleEngine, unpackSnapshot } from './engine'
import type { Emitter } from './sdf'

export interface PlainEvent {
  id: string
  startSec: number
  from: string
  to: string
}

export interface PlainTimeline {
  id: string
  startSeason: string
  events: PlainEvent[]
}

export const plainTimeline = (tl: Timeline): PlainTimeline => ({ id: tl.id, startSeason: tl.startSeason, events: tl.events.map((e) => ({ id: e.id, startSec: e.startSec, from: e.from, to: e.to })) })

export const builtTimeline = (p: PlainTimeline): Timeline => ({ id: p.id, startSeason: p.startSeason, events: p.events.map((e) => ({ id: e.id, startSec: e.startSec, from: e.from, to: e.to, path: makeShake(e.id) })) })

export type Colliders = SdfGrid | Record<string, SdfGrid>

export type ToEngine =
  | { type: 'init'; season?: string; fraction?: number; colliders?: Colliders; emitters?: Record<string, Emitter[]> }
  | { type: 'collider'; colliders: Colliders; emitters?: Record<string, Emitter[]> }
  | { type: 'reset'; season?: string }
  | { type: 'timeline'; timeline: PlainTimeline }
  | { type: 'advance'; step: number; spare?: ArrayBuffer[] }
  | { type: 'stir'; x: number; y: number; z: number }
  | { type: 'snapshot' }
  | { type: 'restore'; buffer: ArrayBuffer }

export type FromEngine =
  | { type: 'ready'; count: number; kinds: readonly string[]; season: string }
  | { type: 'frame'; step: number; season: string; count: number; buffer: ArrayBuffer }
  | { type: 'snapshot'; buffer: ArrayBuffer }

export interface FrameViews {
  liquid: Float64Array
  pos: Float32Array
  prev: Float32Array
  sizes: Float32Array
  opacity: Float32Array
  phase: Float32Array
  kindOf: Uint8Array
  state: Uint8Array
}

export const frameBytes = (count: number): number => LIQUID_LENGTH * 8 + count * 38

export function frameViews(buffer: ArrayBuffer, count: number): FrameViews {
  let o = LIQUID_LENGTH * 8
  const floats = (per: number): Float32Array => {
    const v = new Float32Array(buffer, o, count * per)
    o += count * per * 4
    return v
  }
  const liquid = new Float64Array(buffer, 0, LIQUID_LENGTH)
  const pos = floats(3)
  const prev = floats(3)
  const sizes = floats(1)
  const opacity = floats(1)
  const phase = floats(1)
  return { liquid, pos, prev, sizes, opacity, phase, kindOf: new Uint8Array(buffer, o, count), state: new Uint8Array(buffer, o + count, count) }
}

const colliderOf = (c: Colliders): SdfGrid | ((season: string) => SdfGrid) => {
  if ('data' in c && 'n' in c) return c as SdfGrid
  const table = c as Record<string, SdfGrid>
  return (season: string): SdfGrid => {
    const grid = table[season]
    if (!grid) throw new Error(`no collider for the season: ${season}`)
    return grid
  }
}

export interface Reply {
  message: FromEngine
  transfer: ArrayBuffer[]
}

export class EngineHost {
  private engine: ParticleEngine | null = null
  private timeline: Timeline = { id: 'rest', startSeason: '', events: [] }

  handle(m: ToEngine): Reply | null {
    if (m.type === 'init') {
      this.engine = new ParticleEngine({ season: m.season, fraction: m.fraction, collider: m.colliders ? colliderOf(m.colliders) : undefined, emitters: m.emitters })
      this.timeline = { id: 'rest', startSeason: this.engine.season, events: [] }
      return { message: { type: 'ready', count: this.engine.count, kinds: this.engine.kinds, season: this.engine.season }, transfer: [] }
    }
    const e = this.engine
    if (!e) throw new Error('the engine has not been started')
    if (m.type === 'collider') e.setCollider(colliderOf(m.colliders), m.emitters)
    else if (m.type === 'reset') e.reset(m.season)
    else if (m.type === 'timeline') this.timeline = builtTimeline(m.timeline)
    else if (m.type === 'stir') e.stir(m.x, m.y, m.z)
    else if (m.type === 'restore') e.restore(unpackSnapshot(m.buffer, e.liquid.length))
    else if (m.type === 'snapshot') {
      const buffer = packSnapshot(e.snapshot())
      return { message: { type: 'snapshot', buffer }, transfer: [buffer] }
    } else if (m.type === 'advance') {
      if (m.step < e.step) e.reset()
      e.advanceTo(m.step, this.timeline)
      const bytes = frameBytes(e.count)
      const buffer = m.spare?.find((b) => b.byteLength === bytes) ?? new ArrayBuffer(bytes)
      const v = frameViews(buffer, e.count)
      v.liquid.set(e.liquid)
      v.pos.set(e.pos)
      v.prev.set(e.prev)
      v.sizes.set(e.sizes)
      v.opacity.set(e.opacity)
      v.phase.set(e.phase)
      v.kindOf.set(e.kindOf)
      v.state.set(e.state)
      return { message: { type: 'frame', step: e.step, season: e.seasonNow, count: e.count, buffer }, transfer: [buffer] }
    }
    return null
  }
}
