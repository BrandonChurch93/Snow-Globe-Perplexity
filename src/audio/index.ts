import { config } from '../config'
import type { AudioIndex, AudioIndexEntry, SoundEngine, SoundEngineOptions } from '../core/bridge'

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
}

interface Backend {
  start(): void
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
const MUTE_FADE = 0.04
const THIN_FROM_HZ = 30
const THIN_TO_HZ = 2400
const STIR_GAP = 0.18
const STIR_FLOOR = 0.05
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

interface Voice {
  id: string
  src: AudioBufferSourceNode
  gain: GainNode
  filter: BiquadFilterNode
  startAt: number
}

class WebBackend implements Backend {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer | null>>()
  private voices: Record<Kind, Voice | null> = { amb: null, music: null }
  private serial: Record<Kind, number> = { amb: 0, music: 0 }
  private muted = false
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
      master.gain.value = this.muted ? 0 : 1
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
    if (!entry) return
    const begin = (buffer: AudioBuffer, at: number, fadeIn: number) => {
      if (!this.master) return
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.loopStart = entry.loopStart
      src.loopEnd = entry.loopStart + entry.loopSeconds
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 10
      filter.Q.value = 0.5
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter)
      filter.connect(gain)
      gain.connect(this.master)
      shape(gain.gain, 0, entry.gain, at, fadeIn)
      src.onended = () => gain.disconnect()
      src.start(at, entry.loopStart)
      this.voices[kind] = { id, src, gain, filter, startAt: at }
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
    try {
      if (v.startAt >= at) {
        v.gain.gain.cancelScheduledValues(0)
        v.gain.gain.value = 0
        v.src.stop(at)
        return
      }
      shape(v.gain.gain, v.gain.gain.value, 0, at, d)
      if (thin) {
        v.filter.frequency.setValueAtTime(THIN_FROM_HZ, at)
        v.filter.frequency.exponentialRampToValueAtTime(THIN_TO_HZ, at + d)
      }
      v.src.stop(at + d + 0.05)
    } catch {
      v.gain.disconnect()
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const at = ctx.currentTime
    const p = this.master.gain
    p.cancelScheduledValues(at)
    p.setValueAtTime(p.value, at)
    p.linearRampToValueAtTime(muted ? 0 : 1, at + MUTE_FADE)
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
      try {
        v?.src.stop()
      } catch {
        v?.gain.disconnect()
      }
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
  private hidden = false
  private dead = false

  constructor(private readonly shared: Shared) {}

  start(): void {}

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
    item.el.volume = this.muted ? 0 : clamp01(item.level * item.scale)
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
      this.seekAndPlay(item, entry.loopStart)
      this.ramp(item, 0, 1, o.fadeIn)
      this.voices[kind] = { id, item }
    }
    if (o.delay) window.setTimeout(run, o.delay * 1000)
    else run()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    for (const item of this.live) this.apply(item)
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
        music(to, { delay: 0, fadeOut: CUT_FADE, fadeIn: CUT_FADE, thin: false })
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
      beds(to, { delay: 0, fadeOut: bar, fadeIn: bar, thin: false }, { delay: bar, fadeOut: bar, fadeIn: CUT_FADE, thin: true })
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
      const cents = TICK_CENTS[ticks++ % TICK_CENTS.length] ?? 0
      play(CUE.tick, { rate: Math.pow(2, cents / 1200) })
    },

    chime(): void {
      play(CUE.chime)
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
