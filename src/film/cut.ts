import { config, shots, type Shot } from '../config'
import { hashText } from '../core/rng'
import { loopPlan } from './judged'
import { openingPlan } from './opening'
import { barSeconds, type Grid, type ShotSpan } from './timeline'

export interface AudioMap {
  version: number
  file: string
  sha256: string
  seconds: number
  method: 'tracked' | 'grid'
  bpm: number
  beatsPerBar: number
  beats: number[]
  barLines: number[]
  bars: number
  sections: { start: number; end: number; loudness: number }[]
  loudestSectionStart: number
  checks?: unknown
}

export interface CutShake {
  shot: string
  from: string
  to: string
  first: number
  liftEnd: number
  strokesEnd: number
  landing: number
  swap: { first: number; last: number }
  startSec: number
  endSec: number
  seconds: number
}

export interface CutSection {
  season: string
  first: number
  last: number
  from: number
  to: number
  bars: number
}

export interface Cut extends Grid {
  id: string
  source: 'default-grid' | 'audio-map'
  bpm: number
  seconds: number
  lines: number[]
  shakes: CutShake[]
  sections: CutSection[]
  musicFade: { from: number; to: number } | null
  notes: string[]
}

export interface Cue {
  cue: string
  frame: number
  at: number
  optional?: boolean
}

export interface Bed {
  cue: string
  from: number
  to: number
  fadeIn: number
  fadeOut: number
}

const MIN_BARS = 3
const SNAP_BARS = 2
const round = (v: number, places = 4): number => Math.round(v * 10 ** places) / 10 ** places

export function groupsOf(list: Shot[] = shots): Shot[][] {
  const out: Shot[][] = []
  for (const s of list) {
    if (s.kind === 'hold' || out.length === 0) out.push([s])
    else out.at(-1)!.push(s)
  }
  return out
}

const barsOf = (group: Shot[]): number => group.reduce((n, s) => n + s.bars, 0)

function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function nearest(lines: number[], t: number): number {
  let best = 0
  for (let i = 1; i < lines.length; i++) if (Math.abs(lines[i]! - t) < Math.abs(lines[best]! - t)) best = i
  return best
}

function hold(bounds: number[], total: number): number[] {
  const b = [...bounds]
  const n = b.length
  for (let k = 0; k < n; k++) b[k] = Math.max(b[k]!, (k ? b[k - 1]! : 0) + MIN_BARS)
  for (let k = n - 1; k >= 0; k--) b[k] = Math.min(b[k]!, (k < n - 1 ? b[k + 1]! : total) - MIN_BARS)
  return b
}

interface Fit {
  frames: number[]
  runs: number[]
  fade: boolean
  notes: string[]
}

function fitMap(map: AudioMap, fps: number, groups: Shot[][]): Fit | null {
  const notes: string[] = []
  const gaps: number[] = []
  const sorted = [...map.barLines].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]! - sorted[i - 1]!)
  const typical = median(gaps) || (map.beatsPerBar * 60) / map.bpm
  let inner = sorted.filter((t) => t > 1e-6 && t < map.seconds - 1e-6)
  if (inner.length && inner[0]! < typical / 2) {
    notes.push(`the pickup of ${round(inner[0]!, 3)} s belongs to the first bar`)
    inner = inner.slice(1)
  }
  const max = config.film.maxSeconds
  let times: number[]
  let fade = false
  if (map.seconds > max) {
    times = [0, ...inner.filter((t) => t <= max)]
    fade = true
    notes.push(`the music is ${round(map.seconds, 2)} s, longer than film.maxSeconds: the film ends on the bar line at ${round(times.at(-1)!, 3)} s and the sound fades over the last bar`)
  } else {
    if (inner.length && map.seconds - inner.at(-1)! < typical / 2) inner = inner.slice(0, -1)
    times = [0, ...inner, map.seconds]
    if (map.seconds < config.film.minSeconds) notes.push(`the music is ${round(map.seconds, 2)} s, shorter than film.minSeconds: the film is as long as the music`)
  }
  const frames: number[] = []
  for (const t of times) {
    const f = Math.round(t * fps)
    if (!frames.length || f > frames.at(-1)!) frames.push(f)
  }
  const total = frames.length - 1
  if (total < MIN_BARS * groups.length) return null
  const lines = frames.map((f) => f / fps)
  const want = groups.length - 1
  const starts = map.sections.map((s) => nearest(lines, s.start)).filter((b, i, all) => b > 0 && b < total && all.indexOf(b) === i)
  let bounds: number[]
  const own = map.sections.length === groups.length ? map.sections.slice(1).map((s) => nearest(lines, s.start)) : []
  const usable = own.length === want && own.every((b, k) => b - (k ? own[k - 1]! : 0) >= MIN_BARS) && total - own[want - 1]! >= MIN_BARS
  if (usable) {
    bounds = own
    notes.push(`the map's ${groups.length} sections are used as they are`)
  } else {
    const all = groups.reduce((n, g) => n + barsOf(g), 0)
    let sum = 0
    bounds = hold(
      groups.slice(0, want).map((g) => Math.round(((sum += barsOf(g)) / all) * total)),
      total,
    )
    let moved = 0
    for (let k = 0; k < want; k++) {
      const lo = (k ? bounds[k - 1]! : 0) + MIN_BARS
      const hi = (k < want - 1 ? bounds[k + 1]! : total) - MIN_BARS
      const near = starts.filter((b) => Math.abs(b - bounds[k]!) <= SNAP_BARS && b >= lo && b <= hi).sort((a, b) => Math.abs(a - bounds[k]!) - Math.abs(b - bounds[k]!) || a - b)[0]
      if (near !== undefined && near !== bounds[k]) {
        bounds[k] = near
        moved++
      }
    }
    notes.push(`the map gives ${map.sections.length} sections, so the ${total} bars are split in the default grid's proportions${moved ? `, ${moved} of the boundaries moved to a section boundary of the map` : ''}`)
  }
  const edges = [0, ...bounds, total]
  return { frames, runs: groups.map((_, k) => edges[k + 1]! - edges[k]!), fade, notes }
}

export function buildCut(map: AudioMap | null = null, fps: number = config.film.fps): Cut {
  const groups = groupsOf()
  const notes: string[] = []
  let fit: Fit | null = null
  if (map) {
    fit = fitMap(map, fps, groups)
    if (!fit) notes.push('the music has too few bars for the shots, so the default grid is kept')
  }
  const total = shots.reduce((n, s) => n + s.bars, 0)
  const frames = fit ? fit.frames : Array.from({ length: total + 1 }, (_, b) => Math.round(b * barSeconds * fps))
  const runs = fit ? fit.runs : groups.map(barsOf)
  if (fit) notes.push(...fit.notes)
  const lines = frames.map((f) => f / fps)
  const beats = config.film.beatsPerBar
  const spans: ShotSpan[] = []
  const shakes: CutShake[] = []
  const sections: CutSection[] = []
  let bar = 0
  groups.forEach((group, g) => {
    const run = runs[g]!
    const fixed = group.filter((s) => s.kind === 'shake').reduce((n, s) => n + s.bars, 0)
    const first = bar
    for (const shot of group) {
      const bars = shot.kind === 'hold' ? run - fixed : shot.bars
      const span: ShotSpan = { shot, first: frames[bar]!, last: frames[bar + bars]! - 1, startSec: lines[bar]!, seconds: lines[bar + bars]! - lines[bar]!, bars, firstBar: bar }
      spans.push(span)
      if (shot.kind === 'shake') {
        const perBeat = (span.seconds / beats) * fps
        const s = config.shake
        shakes.push({
          shot: shot.id,
          from: shot.from,
          to: shot.to,
          first: span.first,
          liftEnd: span.first + Math.round(s.liftBeats * perBeat),
          strokesEnd: span.first + Math.round((s.liftBeats + s.strokeBeats) * perBeat),
          landing: span.last + 1,
          swap: { first: span.first + Math.round(s.swapWindow.fromBeat * perBeat), last: span.first + Math.round(s.swapWindow.toBeat * perBeat) - 1 },
          startSec: span.startSec,
          endSec: lines[bar + bars]!,
          seconds: span.seconds,
        })
      }
      bar += bars
    }
    const lead = group.find((s) => s.kind === 'hold') ?? group[0]!
    sections.push({ season: lead.kind === 'hold' ? lead.season : lead.from, first: frames[first]!, last: frames[bar]! - 1, from: round(lines[first]!), to: round(lines[bar]!), bars: run })
  })
  const frameCount = frames.at(-1)!
  const seconds = frameCount / fps
  const id = fit ? hashText(JSON.stringify([frames, runs]), config.seed).toString(16) : ''
  return {
    id,
    source: fit ? 'audio-map' : 'default-grid',
    fps,
    bpm: fit && map ? map.bpm : config.film.defaultBpm,
    frameCount,
    seconds,
    lines,
    spans,
    barLines: frames.slice(0, -1),
    swaps: shakes.map((s) => ({ shot: s.shot, first: s.swap.first, last: s.swap.last })),
    landings: shakes.map((s) => s.landing),
    shakes,
    sections,
    musicFade: fit?.fade ? { from: round(lines.at(-2)!), to: round(lines.at(-1)!) } : null,
    notes,
  }
}

export function cuesOf(cut: Cut): { cues: Cue[]; ambience: Bed[] } {
  const fps = cut.fps
  const at = (frame: number) => round(frame / fps)
  const known = new Set(config.audio.sfx.map((s) => s.id))
  const cues: Cue[] = []
  const add = (cue: string, frame: number, optional = false) => {
    if (known.has(cue)) cues.push({ cue, frame, at: at(frame), ...(optional ? { optional: true } : {}) })
  }
  add('music-box', 0, true)
  for (const s of cut.shakes) {
    add('lift', s.first)
    add(`shake-${s.to}`, s.first)
    add(`land-${s.to}`, s.landing)
    add('glass-clink', s.landing)
  }
  add('music-box', cut.barLines.at(-1)!, true)
  const ambience: Bed[] = []
  let season = cut.sections[0]?.season ?? config.defaultSeason
  let from = 0
  let fadeIn = 0
  for (const s of cut.shakes) {
    ambience.push({ cue: `amb-${season}`, from: at(from), to: at(s.landing), fadeIn: round(fadeIn), fadeOut: round(s.seconds) })
    season = s.to
    from = s.first
    fadeIn = s.seconds
  }
  ambience.push({ cue: `amb-${season}`, from: at(from), to: at(cut.frameCount), fadeIn: round(fadeIn), fadeOut: 0 })
  return { cues, ambience }
}

export function openingCues(fps: number = config.film.fps): Cue[] {
  const plan = openingPlan(fps)
  const known = new Map(config.audio.sfx.map((s) => [s.id, s.seconds]))
  const cues: Cue[] = []
  const add = (cue: string, frame: number) => {
    if (known.has(cue)) cues.push({ cue, frame, at: round(frame / fps) })
  }
  for (const f of plan.keyTaps) add('key-tap', f)
  add('ui-send', plan.send)
  add('riser', Math.max(plan.send, plan.frameCount - Math.round((known.get('riser') ?? 0) * fps)))
  return cues.sort((a, b) => a.frame - b.frame)
}

export interface CameraKey {
  frame: number
  shot: string
  what: string
  camera: number[]
  focusMm: number
  apertureMm: number
}

/** Where the loop's camera stands at its first frame, when that is not the config's camera as given. */
export interface LoopCamera {
  distanceMm: number
  numbers: number[]
  fit: string
}

export function cutList(cut: Cut, cameraKeys: CameraKey[], loopCamera?: LoopCamera): Record<string, unknown> {
  const fps = cut.fps
  const { cues, ambience } = cuesOf(cut)
  const plan = openingPlan(fps)
  const loop = loopPlan(fps)
  const c = config.deliver.cardLoop
  return {
    version: 1,
    source: cut.source,
    fps,
    previewFps: config.film.previewFps,
    bpm: cut.bpm,
    beatsPerBar: config.film.beatsPerBar,
    frameCount: cut.frameCount,
    seconds: round(cut.seconds),
    barLines: cut.barLines,
    shots: cut.spans.map((s) => ({ ...s.shot, bars: s.bars, first: s.first, last: s.last, firstBar: s.firstBar, startSeconds: round(s.startSec), seconds: round(s.seconds) })),
    shakes: cut.shakes.map((s) => ({ shot: s.shot, from: s.from, to: s.to, first: s.first, liftEnd: s.liftEnd, strokesEnd: s.strokesEnd, landing: s.landing, swap: s.swap })),
    landings: cut.landings,
    sections: cut.sections,
    cameraKeys,
    cues,
    ambience,
    opening: { ...plan, seconds: round(plan.seconds), cues: openingCues(fps) },
    loop: { fps, frameCount: loop.frameCount, seconds: c.seconds, camera: c.camera, ...(loopCamera ? { distanceMm: loopCamera.distanceMm, cameraNumbers: loopCamera.numbers, fit: loopCamera.fit } : {}), format: c.format, shake: loop.shake },
    musicFade: cut.musicFade,
    notes: cut.notes,
  }
}

const found = import.meta.glob('../../cut/AUDIO-MAP.json', { eager: true, import: 'default' }) as Record<string, AudioMap>
export const audioMap: AudioMap | null = Object.values(found)[0] ?? null

const made = new Map<number, Cut>()
export function filmCut(fps: number = config.film.fps): Cut {
  let c = made.get(fps)
  if (!c) made.set(fps, (c = buildCut(audioMap, fps)))
  return c
}
