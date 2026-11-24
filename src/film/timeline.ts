import { config, shots, type Shot } from '../config'
import { makeShake, REST_POSE, type GlobePose, type ShakePath } from '../shake/table'

export const barSeconds = (config.film.beatsPerBar * 60) / config.film.defaultBpm
export const beatSeconds = 60 / config.film.defaultBpm

export interface ShakeEvent {
  id: string
  startSec: number
  from: string
  to: string
  path: ShakePath
  seconds?: number
  holdBeats?: number
}

const BEATS = config.film.beatsPerBar
const beatOf = (e: ShakeEvent): number => (e.seconds === undefined ? beatSeconds : e.seconds / BEATS)

export const eventSeconds = (e: ShakeEvent): number => (e.seconds ?? barSeconds) + (e.holdBeats ?? 0) * beatOf(e)

export function eventBeat(e: ShakeEvent, sec: number): number {
  const raw = (sec - e.startSec) / beatOf(e)
  const hold = e.holdBeats ?? 0
  if (hold <= 0) return raw
  const at = config.shake.swapWindow.fromBeat
  if (raw <= at) return raw
  if (raw >= at + hold) return raw - hold
  const span = at - config.shake.liftBeats
  const turn = ((raw - at) / span) % 2
  return turn < 1 ? at - turn * span : at - (2 - turn) * span
}

export interface Timeline {
  id: string
  events: ShakeEvent[]
  startSeason: string
}

export function stillTimeline(season: string): Timeline {
  return { id: `still:${season}`, startSeason: season, events: [{ id: `test:${season}`, startSec: 0, from: season, to: season, path: makeShake(`test:${season}`) }] }
}

export const stateSeconds = (state: string): number => {
  const s = config.states
  const v = state === 'landed' ? s.landedSeconds : state === 'rest' ? s.restSeconds : state === 'settled' ? s.settledSeconds : NaN
  if (Number.isNaN(v)) throw new Error(`no such state: ${state}`)
  return barSeconds + v
}

export const prerollSeconds = barSeconds + config.states.restSeconds

export interface ShotSpan {
  shot: Shot
  first: number
  last: number
  startSec: number
  seconds: number
  bars: number
  firstBar: number
}

export interface Grid {
  id?: string
  fps: number
  frameCount: number
  spans: ShotSpan[]
  barLines: number[]
  swaps: { shot: string; first: number; last: number }[]
  landings: number[]
}

export function defaultGrid(fps: number = config.film.fps): Grid {
  const perBar = barSeconds * fps
  const perBeat = beatSeconds * fps
  const spans: ShotSpan[] = []
  let bar = 0
  for (const shot of shots) {
    const first = Math.round(bar * perBar)
    const last = Math.round((bar + shot.bars) * perBar) - 1
    spans.push({ shot, first, last, startSec: bar * barSeconds, seconds: shot.bars * barSeconds, bars: shot.bars, firstBar: bar })
    bar += shot.bars
  }
  const frameCount = Math.round(bar * perBar)
  const barLines: number[] = []
  for (let b = 0; b < bar; b++) barLines.push(Math.round(b * perBar))
  const swaps = spans
    .filter((s) => s.shot.kind === 'shake')
    .map((s) => ({
      shot: s.shot.id,
      first: s.first + Math.round(config.shake.swapWindow.fromBeat * perBeat),
      last: s.first + Math.round(config.shake.swapWindow.toBeat * perBeat) - 1,
    }))
  const landings = spans.filter((s) => s.shot.kind === 'shake').map((s) => s.last + 1)
  return { fps, frameCount, spans, barLines, swaps, landings }
}

export function filmTimeline(grid: Grid = defaultGrid()): Timeline {
  const first = shots[0]!
  const startSeason = first.kind === 'hold' ? first.season : first.from
  const events: ShakeEvent[] = [{ id: 'preroll', startSec: 0, from: startSeason, to: startSeason, path: makeShake('preroll') }]
  for (const s of grid.spans) {
    if (s.shot.kind === 'shake') events.push({ id: s.shot.id, startSec: prerollSeconds + s.startSec, from: s.shot.from, to: s.shot.to, path: makeShake(s.shot.id), ...(grid.id ? { seconds: s.seconds } : {}) })
  }
  return { id: grid.id ? `film-${grid.id}` : 'film', startSeason, events }
}

export function eventAt(tl: Timeline, sec: number): { event: ShakeEvent; beat: number } | null {
  for (const e of tl.events) {
    if (sec >= e.startSec && sec < e.startSec + eventSeconds(e)) return { event: e, beat: eventBeat(e, sec) }
  }
  return null
}

export function globePoseAt(tl: Timeline, sec: number): GlobePose {
  const hit = eventAt(tl, sec)
  return hit ? hit.event.path.poseAt(hit.beat) : REST_POSE
}

const EDGE = 1e-7

export function seasonAt(tl: Timeline, sec: number): { season: string; from: string; to: string; change: number } {
  let season = tl.startSeason
  for (const e of tl.events) {
    if (sec < e.startSec) break
    const beat = eventBeat(e, sec)
    const w = config.shake.swapWindow
    if (beat >= w.toBeat - EDGE) season = e.to
    else if (beat > w.fromBeat + EDGE) return { season: e.from, from: e.from, to: e.to, change: (beat - w.fromBeat) / (w.toBeat - w.fromBeat) }
    else season = e.from
  }
  return { season, from: season, to: season, change: 0 }
}

export function lastLandingBefore(tl: Timeline, sec: number): number {
  let t = -Infinity
  for (const e of tl.events) if (e.startSec + eventSeconds(e) <= sec) t = e.startSec + eventSeconds(e)
  return t
}
