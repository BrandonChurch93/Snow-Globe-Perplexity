import { config } from '../config'
import type { AudioIndex, AudioIndexEntry, SoundEngine, SoundEngineOptions } from '../core/bridge'
import { barSeconds } from '../film/timeline'

type Kind = 'amb' | 'music'
type LoopEntry = AudioIndex['loops'][string]

interface PlayOptions {
  delay?: number
  gain?: number
  rate?: number
  lowpassHz?: number
  seconds?: number
  fadeOut?: number
}

interface SwapOptions {
  delay: number
  fadeOut: number
  fadeIn: number
  thin: boolean
  /** Seconds into the loop where its first pass begins: the entry of a landing. Left out, the loop begins at its start. */
  enter?: number
}

interface Backend {
  start(): void
  /** The clock a cue is placed on, in seconds: the audio clock where there is one. */
  now(): number
  ready(files: string[]): Promise<void>
  /** Plays or schedules one cue. The answer takes it back: a cue not yet heard is never heard. */
  play(entry: AudioIndexEntry, o: PlayOptions): () => void
  swap(kind: Kind, id: string, entry: LoopEntry | undefined, o: SwapOptions): void
  setMuted(muted: boolean): void
  setHidden(hidden: boolean): void
  dispose(): void
}

interface Shared {
  url(file: string): string
  raw(file: string): Promise<ArrayBuffer | null>
  count(bytes: number): void
  sizeOf(file: string): number
  gate: Promise<void>
}

const known = new Set(config.audio.sfx.map((s) => s.id))
const cue = (id: string): string => (known.has(id) ? id : '')
const CUE = {
  lift: cue('lift'),
  clink: cue('glass-clink'),
  tick: cue('ui-tick'),
  chime: cue('ui-sound-on'),
  shake: (season: string) => cue(`shake-${season}`),
  land: (season: string) => cue(`land-${season}`),
  amb: (season: string) => `amb-${season}`,
  music: (season: string) => `music-${season}`,
}

const LEAD = 0.02
const TAIL = 0.06
const SEASON_FADE = 1.6
const FIRST_FADE = 0.8
const LATE_FADE = 0.5
const CUT_FADE = 0.03
/**
 * Where the new season's music is entered at a landing: on a bar line of its loop, as film B cuts its music on one
 * (kit: "the music changes on the landing, as in the film"). The pack writes a music loop from LOOP_LEAD before the
 * line of its first bar (LOOP_LEAD of tools/lib/audio.mjs) and from bar 1 of its track, so begun at its start the
 * downbeat came 0.06 s after the landing's clink, on a bar the film does not land on. Measured against the music stem
 * of film B, the app brought up by its trim and the master's gain: dB under the film over the 0.1 s after the landing,
 * over 0 to 0.5 s and over the first bar (a minus sign: over the film).
 *   spring: begun at its start 5.8, 1.9, -1.3; on the line of bar 6 of its track 1.7, 1.1, 0.7
 *   summer: begun at its start 5.0, 0.9, 0.5; on the line of bar 4 1.0, 0.9, 0.5
 *   fall: begun at its start 2.9, 0.6, 0.2; on the line of bar 1 1.0, 0.4, 0.3
 *   winter: begun at its start 15.6, 5.6, 2.6; on the line of bar 6 1.0, 0.4, 0.3
 * Fall's bar 1 and winter's bar 6 are the bars the film lands on. In spring and summer it lands on bar 0, which no
 * loop holds, and the bar taken is one that stands within 1.5 dB of the film both over 0 to 0.5 s and over the first
 * bar: in spring bar 6 alone does, in summer bars 1 and 4 do and bar 4 is the nearer over the first 0.1 s. Of that
 * 0.1 s the lead alone cost 2.4 to 3.6 dB in every season and the bar 12.7 dB in winter. The rise of CUT_FADE stays:
 * it costs 0.55 to 1.04 dB of that 0.1 s and nothing after. LANDING_BAR counts bars into the loop, whose first bar is
 * bar 1 of the track. Only a landing enters there: switched on with no shake, or changed with no shake, a loop begins
 * at its start, and after its first pass every loop goes on whole. Not heard by a human.
 */
const LOOP_LEAD = 0.06
const LANDING_BAR: Record<string, number> = { winter: 5, spring: 5, summer: 3, fall: 0 }
const landingEntry = (season: string): number => (season in LANDING_BAR ? LOOP_LEAD + LANDING_BAR[season]! * barSeconds : 0)
/** The way out when the sound is turned off stays short. The way in is longer, a quarter sine: at 0.04 s it was heard as a blast. */
const MUTE_FADE = 0.04
const UNMUTE_FADE = 0.35
/**
 * The old music through a shake is let go as the film's mix thins it (thin() of tools/lib/audio.mjs): down to THIN_DB in
 * even steps of dB over the bar and to nothing over the last THIN_TAIL seconds, behind a high-pass of two plain poles
 * (THIN_Q_DB is that slope as the filter node counts it) that is brought in over the first THIN_IN of the bar and swept
 * from THIN_FROM_HZ to THIN_TO_HZ.
 */
const THIN_FROM_HZ = 30
const THIN_TO_HZ = 900
const THIN_DB = -12
const THIN_TAIL = 0.15
const THIN_IN = 1 / 8
const THIN_Q_DB = -6.02
const VOICE_HZ = 10
const VOICE_Q_DB = 0.5
const AMB_SEAM = 1.5
const SEAM_SHARE = 0.25
const STIR_GAP = 0.18
const STIR_FLOOR = 0.05
/**
 * Interface cues are spaced: a second tick or chime inside this many seconds of the last one is not played. Two presses
 * that close are one gesture, and two interface cues on top of each other are the one sum the headroom cannot carry.
 */
const INTERFACE_GAP = 0.1
const TICK_CENTS = [0, 200, 500, 200, 700, 500, 0, -300]
const CURVE_POINTS = 24

const NOTHING = (): void => undefined

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const withSlash = (url: string): string => (url.endsWith('/') ? url : `${url}/`)

export async function loadAudioIndex(baseUrl: string, afterFirstPicture: Promise<void>): Promise<AudioIndex | null> {
  await afterFirstPicture
  try {
    const res = await fetch(`${withSlash(baseUrl)}index.json`)
    if (!res.ok) return null
    const index = (await res.json()) as AudioIndex
    return index && typeof index === 'object' && typeof index.sprites === 'object' && typeof index.loops === 'object' ? index : null
  } catch {
    return null
  }
}

function contextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function shape(p: AudioParam, from: number, to: number, at: number, seconds: number): void {
  const d = Math.max(seconds, 0.005)
  try {
    p.cancelScheduledValues(at)
    p.setValueAtTime(from, at)
    const curve = new Float32Array(CURVE_POINTS)
    for (let i = 0; i < CURVE_POINTS; i++) {
      const t = (i / (CURVE_POINTS - 1)) * (Math.PI / 2)
      curve[i] = to >= from ? from + (to - from) * Math.sin(t) : to + (from - to) * Math.cos(t)
    }
    p.setValueCurveAtTime(curve, at, d)
  } catch {
    try {
      p.cancelScheduledValues(at)
      p.setValueAtTime(from, at)
      p.linearRampToValueAtTime(to, at + d)
    } catch {
      p.value = to
    }
  }
}

/** The film's thin as a level: even steps of dB from `from` down to THIN_DB over the whole time, the last THIN_TAIL of it down to nothing. */
function thinOut(p: AudioParam, from: number, at: number, seconds: number): void {
  const tail = Math.min(THIN_TAIL, seconds)
  const body = seconds - tail
  const down = (share: number): number => from * Math.pow(10, (THIN_DB * share) / 20)
  const last = CURVE_POINTS - 1
  p.cancelScheduledValues(at)
  p.setValueAtTime(from, at)
  if (body >= 0.005) {
    const curve = new Float32Array(CURVE_POINTS)
    for (let i = 0; i <= last; i++) curve[i] = down(((i / last) * body) / seconds)
    p.setValueCurveAtTime(curve, at, body)
  }
  const end = new Float32Array(CURVE_POINTS)
  for (let i = 0; i < last; i++) end[i] = down((body + (i / last) * tail) / seconds) * Math.cos((i / last) * (Math.PI / 2))
  end[last] = 0
  p.setValueCurveAtTime(end, at + body, tail)
}

/**
 * A loop is not left to the source to wrap: the file is played pass after pass, each pass starting one overlap before the
 * last one ends and the two crossed at equal power over it. Whatever level the file ends and begins at, no step is heard.
 */
interface Voice {
  id: string
  gain: GainNode
  filter: BiquadFilterNode
  startAt: number
  /** Where its rise ends: at `level`, `rise` seconds after startAt. Kept so that no level has to be read back from the node. */
  level: number
  rise: number
  /** The passes that have been started and have not ended: the one that sounds and the one after it. */
  passes: Set<AudioBufferSourceNode>
  next: number
  over: boolean
}

/** What two passes of a loop share: one bar of the music, so its beat is kept, a breath of the ambience, and never more than a quarter of the loop. */
const seamOf = (kind: Kind, loopSeconds: number): number => Math.min(kind === 'music' ? barSeconds : AMB_SEAM, loopSeconds * SEAM_SHARE)

/** The level a voice has got to at a time on the audio clock: shape() gives its rise, a quarter sine. */
const levelOf = (v: Voice, at: number): number => (at >= v.startAt + v.rise ? v.level : v.level * Math.sin((Math.max(0, at - v.startAt) / v.rise) * (Math.PI / 2)))

function stopAll(v: Voice, at?: number): void {
  for (const src of v.passes) {
    try {
      src.stop(at)
    } catch {
      // it has ended
    }
  }
}

class WebBackend implements Backend {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer | null>>()
  private voices: Record<Kind, Voice | null> = { amb: null, music: null }
  private serial: Record<Kind, number> = { amb: 0, music: 0 }
  private muted = false
  /** The last move of the master level. The next move starts where this one has got to, worked out from the clock. */
  private gate = { from: 1, to: 1, at: 0, seconds: 0 }
  private hidden = false
  private dead = false

  constructor(
    private readonly Ctor: typeof AudioContext,
    private readonly shared: Shared,
  ) {}

  start(): void {
    if (this.dead) return
    if (!this.ctx) {
      const ctx = new this.Ctor()
      const master = ctx.createGain()
      const through = this.muted ? 0 : 1
      master.gain.value = through
      this.gate = { from: through, to: through, at: 0, seconds: 0 }
      master.connect(ctx.destination)
      this.ctx = ctx
      this.master = master
    }
    if (this.ctx.state === 'suspended' && !this.hidden) void this.ctx.resume().catch(() => undefined)
  }

  private load(file: string): Promise<AudioBuffer | null> {
    const had = this.loading.get(file)
    if (had) return had
    const job = this.shared.raw(file).then((data) => {
      const ctx = this.ctx
      if (!data || !ctx || this.dead) return null
      return new Promise<AudioBuffer | null>((resolve) => {
        const done = (b: AudioBuffer | null) => {
          if (b) this.buffers.set(file, b)
          resolve(b)
        }
        try {
          const p = ctx.decodeAudioData(
            data.slice(0),
            (b) => done(b),
            () => done(null),
          )
          if (p && typeof p.catch === 'function') p.catch(() => done(null))
        } catch {
          done(null)
        }
      })
    })
    this.loading.set(file, job)
    return job
  }

  async ready(files: string[]): Promise<void> {
    await Promise.all(files.map((f) => this.load(f)))
  }

  play(entry: AudioIndexEntry, o: PlayOptions): () => void {
    const ctx = this.ctx
    const buffer = this.buffers.get(entry.file)
    if (!ctx || !this.master || !buffer || this.dead) return NOTHING
    const at = ctx.currentTime + LEAD + (o.delay ?? 0)
    const level = entry.gain * (o.gain ?? 1)
    const length = Math.min(o.seconds ?? entry.seconds, entry.seconds)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = o.rate ?? 1
    const gain = ctx.createGain()
    gain.gain.value = level
    let tail: AudioNode = src
    if (o.lowpassHz) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = o.lowpassHz
      tail.connect(f)
      tail = f
    }
    tail.connect(gain)
    gain.connect(this.master)
    const heard = length / (o.rate ?? 1)
    if (o.fadeOut) {
      const d = Math.min(o.fadeOut, heard)
      gain.gain.setValueAtTime(level, at + heard - d)
      gain.gain.linearRampToValueAtTime(0, at + heard)
    }
    src.onended = () => gain.disconnect()
    src.start(at, Math.max(0, entry.start), length + (o.fadeOut ? 0 : TAIL))
    return () => {
      try {
        src.stop()
      } catch {
        // it never started or has ended
      }
      gain.disconnect()
    }
  }

  swap(kind: Kind, id: string, entry: LoopEntry | undefined, o: SwapOptions): void {
    const ctx = this.ctx
    if (!ctx || !this.master || this.dead) return
    const now = ctx.currentTime + LEAD
    const old = this.voices[kind]
    if (old && old.id === id) return
    if (old) this.release(old, now, o.fadeOut, o.thin)
    this.voices[kind] = null
    const serial = ++this.serial[kind]
    if (!entry || !(entry.loopSeconds > 0)) return
    const length = entry.loopSeconds
    const seam = seamOf(kind, length)
    // A loop too short to hold the entry asked of it begins at its start.
    const enter = o.enter !== undefined && o.enter > 0 && o.enter < length - seam ? o.enter : 0
    const begin = (buffer: AudioBuffer, at: number, fadeIn: number) => {
      if (!this.master) return
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = VOICE_HZ
      filter.Q.value = VOICE_Q_DB
      const gain = ctx.createGain()
      gain.gain.value = 0
      filter.connect(gain)
      gain.connect(this.master)
      shape(gain.gain, 0, entry.gain, at, fadeIn)
      const voice: Voice = { id, gain, filter, startAt: at, level: entry.gain, rise: Math.max(fadeIn, 0.005), passes: new Set(), next: at, over: false }
      // The pass after the one that sounds is always scheduled already, and each pass that ends schedules the one after that:
      // the audio clock keeps the seam, and no timer or frame of the page is waited on.
      const pass = (first: boolean): void => {
        if (voice.over || this.dead) return
        const t = first ? voice.next : Math.max(voice.next, ctx.currentTime + LEAD)
        // Only the first pass is entered part of the way in: every pass after it is the whole loop.
        const from = first ? enter : 0
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const level = ctx.createGain()
        level.gain.value = first ? 1 : 0
        src.connect(level)
        level.connect(filter)
        if (!first) shape(level.gain, 0, 1, t, seam)
        shape(level.gain, 1, 0, t + length - from - seam, seam)
        src.onended = () => {
          level.disconnect()
          voice.passes.delete(src)
          if (!voice.over) pass(false)
          else if (voice.passes.size === 0) gain.disconnect()
        }
        src.start(t, entry.loopStart + from, length - from)
        voice.passes.add(src)
        voice.next = t + length - from - seam
      }
      pass(true)
      pass(false)
      this.voices[kind] = voice
    }
    const buffer = this.buffers.get(entry.file)
    if (buffer) begin(buffer, now + o.delay, o.fadeIn)
    else
      void this.load(entry.file).then((b) => {
        if (!b || this.dead || this.serial[kind] !== serial) return
        const late = ctx.currentTime + LEAD
        if (late > now + o.delay) begin(b, late, Math.max(o.fadeIn, LATE_FADE))
        else begin(b, now + o.delay, o.fadeIn)
      })
  }

  private release(v: Voice, at: number, seconds: number, thin: boolean): void {
    const d = Math.max(seconds, 0.01)
    v.over = true
    try {
      if (v.startAt >= at) {
        v.gain.gain.cancelScheduledValues(0)
        v.gain.gain.value = 0
        stopAll(v, at)
        return
      }
      const from = levelOf(v, at)
      if (thin && from > 0) {
        try {
          thinOut(v.gain.gain, from, at, d)
        } catch {
          shape(v.gain.gain, from, 0, at, d)
        }
        // The film blends its filter in over the first eighth of the bar: here the corner and the slope move there from the
        // voice's own, and from then on the corner is the film's, THIN_FROM_HZ * (THIN_TO_HZ / THIN_FROM_HZ) ** (t / d).
        const f = v.filter.frequency
        const q = v.filter.Q
        f.setValueAtTime(VOICE_HZ, at)
        f.exponentialRampToValueAtTime(THIN_FROM_HZ * Math.pow(THIN_TO_HZ / THIN_FROM_HZ, THIN_IN), at + d * THIN_IN)
        f.exponentialRampToValueAtTime(THIN_TO_HZ, at + d)
        q.setValueAtTime(VOICE_Q_DB, at)
        q.linearRampToValueAtTime(THIN_Q_DB, at + d * THIN_IN)
      } else shape(v.gain.gain, from, 0, at, d)
      stopAll(v, at + d + 0.05)
    } catch {
      stopAll(v)
      v.gain.disconnect()
    }
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /** The master level at a time: the way in is shape()'s quarter sine, the way out a straight line. */
  private through(at: number): number {
    const g = this.gate
    if (at >= g.at + g.seconds) return g.to
    const x = Math.max(0, (at - g.at) / g.seconds)
    return g.from + (g.to - g.from) * (g.to >= g.from ? Math.sin(x * (Math.PI / 2)) : x)
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return
    this.muted = muted
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const at = ctx.currentTime
    const p = this.master.gain
    const from = this.through(at)
    this.gate = { from, to: muted ? 0 : 1, at, seconds: muted ? MUTE_FADE : UNMUTE_FADE }
    if (!muted) {
      shape(p, from, 1, at, UNMUTE_FADE)
      return
    }
    try {
      p.cancelScheduledValues(at)
      p.setValueAtTime(from, at)
      p.linearRampToValueAtTime(0, at + MUTE_FADE)
    } catch {
      p.value = 0
    }
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden
    const ctx = this.ctx
    if (!ctx || this.dead) return
    if (hidden && ctx.state === 'running') void ctx.suspend().catch(() => undefined)
    if (!hidden && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  }

  dispose(): void {
    this.dead = true
    for (const kind of ['amb', 'music'] as const) {
      const v = this.voices[kind]
      this.voices[kind] = null
      if (!v) continue
      v.over = true
      stopAll(v)
      v.gain.disconnect()
    }
    this.master?.disconnect()
    this.buffers.clear()
    this.loading.clear()
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined)
  }
}

interface Item {
  el: HTMLAudioElement
  level: number
  scale: number
  timers: number[]
  loop: boolean
}

class ElementBackend implements Backend {
  private live = new Set<Item>()
  private voices: Record<Kind, { id: string; item: Item } | null> = { amb: null, music: null }
  private serial: Record<Kind, number> = { amb: 0, music: 0 }
  private counted = new Set<string>()
  private open = false
  private muted = false
  /** What the sound switch lets through: nothing while it is off, and it rises over UNMUTE_FADE when it is turned on. */
  private through = 1
  private rising: number[] = []
  private hidden = false
  private dead = false

  constructor(private readonly shared: Shared) {}

  start(): void {}

  now(): number {
    return (typeof performance === 'undefined' ? Date.now() : performance.now()) / 1000
  }

  async ready(): Promise<void> {
    await this.shared.gate
    this.open = true
  }

  private make(file: string, level: number, loop: boolean): Item {
    if (!this.counted.has(file)) {
      this.counted.add(file)
      this.shared.count(this.shared.sizeOf(file))
    }
    const el = new Audio()
    el.preload = 'auto'
    el.src = this.shared.url(file)
    const item: Item = { el, level, scale: 1, timers: [], loop }
    this.live.add(item)
    this.apply(item)
    return item
  }

  private apply(item: Item): void {
    item.el.volume = this.muted ? 0 : clamp01(item.level * item.scale * this.through)
  }

  private seekAndPlay(item: Item, at: number): void {
    const go = () => {
      try {
        item.el.currentTime = at
      } catch {
        return
      }
      if (!this.hidden || !item.loop) void item.el.play().catch(() => undefined)
    }
    if (item.el.readyState >= 1) go()
    else item.el.addEventListener('loadedmetadata', go, { once: true })
  }

  private drop(item: Item): void {
    for (const t of item.timers) window.clearTimeout(t)
    item.timers.length = 0
    item.el.pause()
    item.el.removeAttribute('src')
    item.el.load()
    this.live.delete(item)
  }

  private ramp(item: Item, from: number, to: number, seconds: number, then?: () => void): void {
    const steps = Math.max(1, Math.round(seconds / 0.05))
    item.scale = from
    this.apply(item)
    for (let i = 1; i <= steps; i++) {
      item.timers.push(
        window.setTimeout(
          () => {
            item.scale = from + ((to - from) * i) / steps
            this.apply(item)
            if (i === steps) then?.()
          },
          (seconds * 1000 * i) / steps,
        ),
      )
    }
  }

  play(entry: AudioIndexEntry, o: PlayOptions): () => void {
    if (!this.open || this.dead) return NOTHING
    const length = Math.min(o.seconds ?? entry.seconds, entry.seconds)
    const rate = o.rate ?? 1
    const run = () => {
      if (this.dead) return
      const item = this.make(entry.file, entry.gain * (o.gain ?? 1), false)
      item.el.playbackRate = rate
      this.seekAndPlay(item, Math.max(0, entry.start))
      item.timers.push(window.setTimeout(() => this.drop(item), ((length + TAIL) / rate) * 1000 + 250))
      made = item
    }
    let made: Item | null = null
    let off = false
    const timer = o.delay ? window.setTimeout(run, o.delay * 1000) : null
    if (timer === null) run()
    return () => {
      if (off) return
      off = true
      if (timer !== null) window.clearTimeout(timer)
      if (made && this.live.has(made)) this.drop(made)
    }
  }

  swap(kind: Kind, id: string, entry: LoopEntry | undefined, o: SwapOptions): void {
    if (!this.open || this.dead) return
    const old = this.voices[kind]
    if (old && old.id === id) return
    if (old) this.ramp(old.item, old.item.scale, 0, o.fadeOut, () => this.drop(old.item))
    this.voices[kind] = null
    const serial = ++this.serial[kind]
    if (!entry) return
    const run = () => {
      if (this.dead || this.serial[kind] !== serial) return
      const item = this.make(entry.file, entry.gain, true)
      const end = entry.loopStart + entry.loopSeconds
      item.el.addEventListener('timeupdate', () => {
        if (item.el.currentTime >= end - 0.05) item.el.currentTime -= entry.loopSeconds
      })
      item.el.addEventListener('ended', () => this.seekAndPlay(item, entry.loopStart))
      const enter = o.enter !== undefined && o.enter > 0 && o.enter < entry.loopSeconds - seamOf(kind, entry.loopSeconds) ? o.enter : 0
      this.seekAndPlay(item, entry.loopStart + enter)
      this.ramp(item, 0, 1, o.fadeIn)
      this.voices[kind] = { id, item }
    }
    if (o.delay) window.setTimeout(run, o.delay * 1000)
    else run()
  }

  setMuted(muted: boolean): void {
    if (muted === this.muted) return
    this.muted = muted
    for (const t of this.rising) window.clearTimeout(t)
    this.rising.length = 0
    const set = (through: number): void => {
      this.through = through
      for (const item of this.live) this.apply(item)
    }
    set(muted ? 1 : 0)
    if (muted) return
    const steps = Math.max(1, Math.round(UNMUTE_FADE / 0.05))
    for (let i = 1; i <= steps; i++) this.rising.push(window.setTimeout(() => set(Math.sin((Math.PI / 2) * (i / steps))), (UNMUTE_FADE * 1000 * i) / steps))
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden
    for (const item of this.live) {
      if (!item.loop) continue
      if (hidden) item.el.pause()
      else void item.el.play().catch(() => undefined)
    }
  }

  dispose(): void {
    this.dead = true
    for (const t of this.rising) window.clearTimeout(t)
    this.rising.length = 0
    for (const item of [...this.live]) this.drop(item)
    this.voices = { amb: null, music: null }
  }
}

export function createSoundEngine(opts: SoundEngineOptions): SoundEngine {
  const index = opts.index
  const base = withSlash(opts.baseUrl)
  const root = typeof document === 'undefined' ? null : document.documentElement
  const Ctor = contextClass()
  const hasElement = typeof Audio !== 'undefined'
  const usable = index !== null && (Object.keys(index.sprites).length > 0 || Object.keys(index.loops).length > 0) && (Ctor !== null || hasElement)
  const fetched = new Map<string, Promise<ArrayBuffer | null>>()
  let bytes = 0
  let season = opts.seasons[0] ?? ''
  let unlocked = false
  let opened: Promise<void> | null = null
  let disposed = false
  let stirOpen = true
  let ticks = 0
  let lastInterface = Number.NEGATIVE_INFINITY
  /** The shake whose landing has not been confirmed by the picture: its cues can still be taken back. */
  let pending: { to: string; held: boolean; cancel: Array<() => void> } | null = null

  if (root && root.dataset.audio === undefined) root.dataset.audio = 'none'

  const shared: Shared = {
    url: (file) => base + file,
    gate: opts.afterFirstPicture,
    count: (n) => {
      bytes += n
    },
    sizeOf: (file) => index?.files.find((f) => f.file === file)?.bytes ?? 0,
    raw: (file) => {
      const had = fetched.get(file)
      if (had) return had
      const job = opts.afterFirstPicture
        .then(() => (disposed ? null : fetch(base + file)))
        .then((res) => (res && res.ok ? res.arrayBuffer() : null))
        .then((data) => {
          if (data) bytes += data.byteLength
          return data
        })
        .catch(() => null)
      fetched.set(file, job)
      return job
    },
  }

  const backend: Backend | null = !usable ? null : Ctor ? new WebBackend(Ctor, shared) : new ElementBackend(shared)
  const sprite = (id: string): AudioIndexEntry | undefined => (id && index ? index.sprites[id] : undefined)
  const loopOf = (id: string): LoopEntry | undefined => (index ? index.loops[id] : undefined)
  const spriteFiles = index ? [...new Set(Object.values(index.sprites).map((e) => e.file))] : []
  const loopFiles = (s: string): string[] => [CUE.amb(s), CUE.music(s)].map((id) => loopOf(id)?.file).filter((f): f is string => typeof f === 'string')

  const play = (id: string, o: PlayOptions = {}): (() => void) => {
    const entry = sprite(id)
    return entry && backend && unlocked && !disposed ? backend.play(entry, o) : NOTHING
  }

  /** An interface cue, kept INTERFACE_GAP from the last one that was played. The answer says whether it was played. */
  const spaced = (id: string, o: PlayOptions = {}): boolean => {
    if (!backend) return false
    const now = backend.now()
    if (now - lastInterface < INTERFACE_GAP) return false
    if (play(id, o) === NOTHING) return false
    lastInterface = now
    return true
  }

  const music = (to: string, o: SwapOptions): void => {
    if (backend && unlocked && !disposed) backend.swap('music', CUE.music(to), loopOf(CUE.music(to)), o)
  }

  const beds = (to: string, amb: SwapOptions, music: SwapOptions): void => {
    if (!backend || !unlocked || disposed) return
    backend.swap('amb', CUE.amb(to), loopOf(CUE.amb(to)), amb)
    backend.swap('music', CUE.music(to), loopOf(CUE.music(to)), music)
  }

  const onVisibility = (): void => backend?.setHidden(document.visibilityState === 'hidden')
  if (backend && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)

  if (backend && Ctor) {
    void opts.afterFirstPicture.then(() => {
      if (disposed) return
      for (const f of [...spriteFiles, ...loopFiles(season)]) void shared.raw(f)
    })
  }

  return {
    available: () => usable && !disposed,

    unlock(): Promise<void> {
      if (!backend || disposed) return Promise.resolve()
      backend.start()
      if (root) root.dataset.audio = 'started'
      if (!opened) {
        opened = backend.ready([...spriteFiles, ...loopFiles(season)]).then(() => {
          if (disposed) return
          unlocked = true
          const o = { delay: 0, fadeOut: FIRST_FADE, fadeIn: FIRST_FADE, thin: false }
          beds(season, o, o)
          const rest = opts.seasons.filter((s) => s !== season)
          void rest.reduce((chain, s) => chain.then(() => (disposed ? undefined : backend.ready(loopFiles(s)))), Promise.resolve())
        })
      }
      return opened
    },

    setMuted(muted: boolean): void {
      backend?.setMuted(muted)
    },

    /**
     * The picture is in this season now. After a shake whose landing was held this is the landing: the land cue and
     * the music change happen here, and if the shake fell back to the season it left the music does not change.
     */
    setSeason(to: string, immediate = false): void {
      const p = pending
      pending = null
      season = to
      if (p && p.held && p.to === to) {
        play(CUE.land(to))
        play(CUE.clink)
        music(to, { delay: 0, fadeOut: CUT_FADE, fadeIn: CUT_FADE, thin: false, enter: landingEntry(to) })
      }
      const fade = immediate ? CUT_FADE : SEASON_FADE
      const o = { delay: 0, fadeOut: fade, fadeIn: fade, thin: false }
      beds(to, o, o)
    },

    /**
     * A shake has started: the lift and the storm now, the land cue and the music change one bar later on the audio clock.
     * Called again for the same season with a bar that is not finite, it says the landing is held (the season is still
     * loading): the land cue and the new music are taken back and wait for setSeason, which the app calls when the
     * picture really lands.
     */
    shake(to: string, barSeconds: number): void {
      if (!Number.isFinite(barSeconds)) {
        const p = pending
        if (!p || p.to !== to || p.held) return
        p.held = true
        for (const off of p.cancel) off()
        p.cancel.length = 0
        if (backend && unlocked && !disposed) backend.swap('music', '', undefined, { delay: 0, fadeOut: CUT_FADE, fadeIn: 0, thin: false })
        return
      }
      const bar = Math.max(0, barSeconds)
      season = to
      play(CUE.lift)
      play(CUE.shake(to))
      pending = { to, held: false, cancel: [play(CUE.land(to), { delay: bar }), play(CUE.clink, { delay: bar })] }
      beds(to, { delay: 0, fadeOut: bar, fadeIn: bar, thin: false }, { delay: bar, fadeOut: bar, fadeIn: CUT_FADE, thin: true, enter: landingEntry(to) })
    },

    stir(strength: number): void {
      const s = clamp01(strength)
      if (s < STIR_FLOOR || !unlocked || !stirOpen) return
      stirOpen = false
      window.setTimeout(() => {
        stirOpen = true
      }, STIR_GAP * 1000)
      play(CUE.clink, { gain: 0.2 + 0.45 * s, rate: 1.12 - 0.12 * s })
      const swirl = 0.5 + 0.9 * s
      play(CUE.shake(season), { gain: 0.5 * s, rate: 0.62, lowpassHz: 700 + 900 * s, seconds: swirl * 0.62, fadeOut: swirl * 0.7 })
    },

    tick(): void {
      const cents = TICK_CENTS[ticks % TICK_CENTS.length] ?? 0
      if (spaced(CUE.tick, { rate: Math.pow(2, cents / 1200) })) ticks++
    },

    chime(): void {
      spaced(CUE.chime)
    },

    bytesFetched: () => bytes,

    dispose(): void {
      if (disposed) return
      disposed = true
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
      backend?.dispose()
      fetched.clear()
    },
  }
}
