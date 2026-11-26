import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioIndex } from '../src/core/bridge'
import { config } from '../src/config'
import { createSoundEngine, loadAudioIndex } from '../src/audio'

const BAR = 2.4
const SPRITE_FILE = 'sfx.m4a'
const SPRITES: Record<string, number> = { lift: 0, 'shake-winter': 1, 'shake-spring': 4, 'land-winter': 8, 'land-spring': 10, 'glass-clink': 12, 'ui-tick': 13, 'ui-sound-on': 14 }
const LOOPS = ['amb-winter', 'music-winter', 'amb-spring', 'music-spring']
/** Every sound the config names, each at its own place in the one file of short sounds. */
const EVERY: Record<string, number> = Object.fromEntries(config.audio.sfx.map((c, i) => [c.id, 100 + i]))
const SHORT = config.audio.sfx.map((c) => c.id).filter((id) => !id.startsWith('amb-'))
const SEASONS: string[] = [...config.seasons]
const bedsOf = (seasons: readonly string[]): string[] => seasons.flatMap((id) => [`amb-${id}`, `music-${id}`])
const LOOP_SECONDS = 8

interface Fade {
  from: number
  to: number
  at: number
  seconds: number
  curve: number[]
}

/** One move asked of a parameter that is not a curve: set at a time, or reached at a time on a straight or an even-ratio line. */
interface Move {
  how: 'set' | 'line' | 'ratio'
  value: number
  at: number
}

interface Started {
  name: string
  at: number
  /** How fast the source is read. */
  rate: number
  loop: boolean
  stoppedAt: number | null
  /** Where in its file the source starts and how long it plays. */
  span: [number, number | undefined]
  /** The level curves asked of the node the source plays into, and of the voice that node is part of. */
  fades: Fade[]
  voice: Fade[]
  /** What was asked of the filter of that voice: its corner and its slope. */
  corner: Move[]
  slope: Move[]
  /** The source ends, as the audio clock ends it. */
  end(): void
}

/** What the fake audio context saw, in the order it was asked. */
const heard = { contexts: 0, started: [] as Started[], fetched: [] as string[], now: 0, master: null as FakeNode | null }
const sizes = new Map<string, number>()
const sizeOf = (file: string): number => {
  if (!sizes.has(file)) sizes.set(file, 16 + sizes.size)
  return sizes.get(file)!
}
const fileOfSize = (n: number): string => [...sizes].find(([, v]) => v === n)?.[0] ?? '?'

class FakeParam {
  value = 0
  fades: Fade[] = []
  moves: Move[] = []
  cancelScheduledValues(): void {}
  setValueAtTime(value: number, at: number): void {
    this.moves.push({ how: 'set', value, at })
  }
  setValueCurveAtTime(curve: Float32Array, at: number, seconds: number): void {
    this.fades.push({ from: curve[0]!, to: curve[curve.length - 1]!, at, seconds, curve: [...curve] })
  }
  linearRampToValueAtTime(value: number, at: number): void {
    this.moves.push({ how: 'line', value, at })
  }
  exponentialRampToValueAtTime(value: number, at: number): void {
    this.moves.push({ how: 'ratio', value, at })
  }
}
class FakeNode {
  gain = new FakeParam()
  frequency = new FakeParam()
  Q = new FakeParam()
  type = ''
  /** The node every sound leaves by. What plays into it is the master level. */
  last = false
  out: FakeNode | null = null
  connect(to: FakeNode): void {
    this.out ??= to
    if (to.last) heard.master = this
  }
  disconnect(): void {}
}
class FakeSource extends FakeNode {
  buffer: { file: string } | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  playbackRate = new FakeParam()
  onended: (() => void) | null = null
  private rec: Started | null = null
  start(at: number, offset: number, seconds?: number): void {
    const file = this.buffer?.file ?? '?'
    const name = file === SPRITE_FILE ? ([...Object.entries(SPRITES), ...Object.entries(EVERY)].find(([, s]) => s === offset)?.[0] ?? '?') : file.replace('.m4a', '')
    const filter = this.out?.out
    this.rec = {
      name,
      at,
      rate: this.playbackRate.value,
      loop: this.loop,
      stoppedAt: null,
      span: [offset, seconds],
      fades: this.out?.gain.fades ?? [],
      voice: filter?.out?.gain.fades ?? [],
      corner: filter?.frequency.moves ?? [],
      slope: filter?.Q.moves ?? [],
      end: () => this.onended?.(),
    }
    heard.started.push(this.rec)
  }
  stop(at?: number): void {
    if (this.rec && this.rec.stoppedAt === null) this.rec.stoppedAt = at ?? heard.now
  }
}
class FakeContext {
  state = 'running'
  destination = Object.assign(new FakeNode(), { last: true })
  constructor() {
    heard.contexts++
  }
  get currentTime(): number {
    return heard.now
  }
  createGain(): FakeNode {
    return new FakeNode()
  }
  createBiquadFilter(): FakeNode {
    return new FakeNode()
  }
  createBufferSource(): FakeSource {
    return new FakeSource()
  }
  decodeAudioData(data: ArrayBuffer, ok: (b: unknown) => void): Promise<unknown> {
    const b = { file: fileOfSize(data.byteLength) }
    ok(b)
    return Promise.resolve(b)
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
  suspend(): Promise<void> {
    return Promise.resolve()
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

function indexOf(sprites: string[], loops: string[]): AudioIndex {
  const files = [...(sprites.length ? [SPRITE_FILE] : []), ...loops.map((l) => `${l}.m4a`)]
  return {
    version: 1,
    bytes: 0,
    files: files.map((file) => ({ file, bytes: sizeOf(file) })),
    sprites: Object.fromEntries(sprites.map((id) => [id, { file: SPRITE_FILE, start: SPRITES[id] ?? EVERY[id]!, seconds: 0.5, gain: 1 }])),
    loops: Object.fromEntries(loops.map((id) => [id, { file: `${id}.m4a`, loopStart: 0, loopSeconds: LOOP_SECONDS, gain: 1 }])),
  }
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}
const names = (): string[] => heard.started.map((s) => s.name)
const find = (name: string): Started[] => heard.started.filter((s) => s.name === name)
/** A voice that sounds from the time given on: started, and not stopped before it could be heard. */
const sounding = (name: string): Started[] => find(name).filter((s) => s.stoppedAt === null || s.stoppedAt > s.at)

async function running(index: AudioIndex | null, seasons = ['winter', 'spring']) {
  const engine = createSoundEngine({ index, baseUrl: 'http://x/audio/', afterFirstPicture: Promise.resolve(), seasons })
  await engine.unlock()
  await settle()
  return engine
}

beforeEach(() => {
  heard.contexts = 0
  heard.started = []
  heard.fetched = []
  heard.now = 0
  heard.master = null
  vi.stubGlobal('window', { AudioContext: FakeContext, setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id) })
  vi.stubGlobal('fetch', async (url: string) => {
    const file = String(url).split('/').pop()!
    heard.fetched.push(file)
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(sizeOf(file)), json: async () => indexOf(Object.keys(SPRITES), LOOPS) }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Everything the page could say to the console, heard and kept quiet. The answer is how often it spoke. */
function quiet(): () => number {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => undefined))
  return () => spies.reduce((n, spy) => n + spy.mock.calls.length, 0)
}

/** One visit with sound, through every season: a press and its landing, the small sounds, a press whose landing is held,
 * a change with no shake, and two more presses. */
async function visit(index: AudioIndex | null): Promise<Array<{ name: string; at: number }>> {
  heard.started = []
  heard.fetched = []
  heard.now = 0
  const engine = createSoundEngine({ index, baseUrl: 'http://x/audio/', afterFirstPicture: Promise.resolve(), seasons: SEASONS })
  await engine.unlock()
  await settle()
  heard.now = 10
  engine.shake(SEASONS[1]!, BAR)
  heard.now = 14
  engine.setSeason(SEASONS[1]!)
  engine.tick()
  heard.now = 14.5
  engine.chime()
  heard.now = 20
  engine.shake(SEASONS[2]!, BAR)
  heard.now = 21
  engine.shake(SEASONS[2]!, Number.POSITIVE_INFINITY)
  heard.now = 26
  engine.setSeason(SEASONS[2]!)
  heard.now = 30
  engine.setSeason(SEASONS[3]!)
  heard.now = 40
  engine.shake(SEASONS[0]!, BAR)
  heard.now = 44
  engine.setSeason(SEASONS[0]!)
  heard.now = 50
  engine.shake(SEASONS[3]!, BAR)
  heard.now = 54
  engine.setSeason(SEASONS[3]!)
  engine.stir(1)
  await settle()
  heard.now = 60
  for (const sound of [...heard.started]) sound.end()
  engine.setMuted(true)
  engine.setMuted(false)
  engine.dispose()
  return heard.started.map(({ name, at }) => ({ name, at }))
}

describe('the sound engine with files missing', () => {
  it('plays nothing and throws nothing for a cue with no file', async () => {
    const engine = await running(indexOf(['shake-spring', 'land-spring'], LOOPS))
    heard.started = []
    expect(() => {
      engine.shake('spring', BAR)
      engine.tick()
      engine.chime()
      engine.stir(1)
    }).not.toThrow()
    expect(names()).not.toContain('lift')
    expect(names()).not.toContain('?')
    expect(names().filter((n) => !n.startsWith('amb-') && !n.startsWith('music-')).sort()).toEqual(['land-spring', 'shake-spring', 'shake-spring'])
  })

  it('releases the old voice and plays nothing for a loop with no file', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), ['amb-winter', 'music-winter']))
    const before = [...find('music-winter'), ...find('amb-winter')]
    expect(before.map((v) => v.stoppedAt)).toEqual([null, null, null, null])
    const count = heard.started.length
    expect(() => engine.setSeason('spring')).not.toThrow()
    await settle()
    expect(before.every((v) => v.stoppedAt !== null)).toBe(true)
    expect(heard.started).toHaveLength(count)
  })

  it('makes no audio context and asks for nothing when there are no files at all', async () => {
    for (const index of [null, indexOf([], [])]) {
      const engine = createSoundEngine({ index, baseUrl: 'http://x/audio/', afterFirstPicture: Promise.resolve(), seasons: ['winter', 'spring'] })
      expect(engine.available()).toBe(false)
      await engine.unlock()
      engine.shake('spring', BAR)
      engine.shake('spring', Number.POSITIVE_INFINITY)
      engine.setSeason('spring')
      engine.tick()
      engine.chime()
      engine.setMuted(false)
      await settle()
      engine.dispose()
    }
    expect(heard.contexts).toBe(0)
    expect(heard.fetched).toEqual([])
    expect(heard.started).toEqual([])
  })
})

describe('a sound the pack does not hold', () => {
  it('breaks, says and delays nothing, whichever sound it is', async () => {
    const said = quiet()
    const whole = await visit(indexOf(SHORT, bedsOf(SEASONS)))
    expect(new Set(whole.map((v) => v.name))).toEqual(new Set([...bedsOf(SEASONS), 'lift', 'glass-clink', 'ui-tick', 'ui-sound-on', ...SEASONS.flatMap((id) => [`shake-${id}`, `land-${id}`])]))
    for (const gone of [...SHORT, ...bedsOf(SEASONS)]) {
      const index = indexOf(
        SHORT.filter((id) => id !== gone),
        bedsOf(SEASONS).filter((id) => id !== gone),
      )
      const got = await visit(index)
      expect(got, gone).toEqual(whole.filter((v) => v.name !== gone))
      expect(heard.fetched.filter((file) => !index.files.some((f) => f.file === file)), gone).toEqual([])
    }
    expect(said()).toBe(0)
  })

  it('is no sound at all, and nothing said, where the index is not there or is not an index', async () => {
    const said = quiet()
    const answers = [
      async () => ({ ok: false }),
      async () => Promise.reject(new Error('offline')),
      async () => ({ ok: true, json: async () => Promise.reject(new Error('not an index')) }),
      async () => ({ ok: true, json: async () => 'not an index' }),
      async () => ({ ok: true, json: async () => null }),
      async () => ({ ok: true, json: async () => ({ sprites: {} }) }),
    ]
    for (const answer of answers) {
      vi.stubGlobal('fetch', answer)
      const index = await loadAudioIndex('http://x/audio', Promise.resolve())
      expect(index).toBeNull()
      expect(await visit(index)).toEqual([])
    }
    expect(heard.contexts).toBe(0)
    expect(said()).toBe(0)
  })
})

describe('a sound added to the pack', () => {
  it('plays at its moment in every season, with nothing but the index changed', async () => {
    const engine = await running(indexOf(SHORT, bedsOf(SEASONS)), SEASONS)
    for (let i = 1; i <= SEASONS.length; i++) {
      const to = SEASONS[i % SEASONS.length]!
      const now = 20 * i
      heard.now = now
      heard.started = []
      engine.shake(to, BAR)
      const lift = find('lift')[0]!
      expect(lift.at).toBeGreaterThanOrEqual(now)
      expect(lift.at).toBeLessThan(now + 0.1)
      expect(find(`shake-${to}`).map((v) => v.at)).toEqual([lift.at])
      expect(find(`land-${to}`).map((v) => v.at)).toEqual([lift.at + BAR])
      expect(find('glass-clink').map((v) => v.at)).toEqual([lift.at + BAR])
      const bed = find(`amb-${to}`)[0]!
      expect(bed.at).toBeCloseTo(lift.at, 6)
      expect(bed.voice.map(({ from, to: level, at, seconds }) => [from, level, at, seconds])).toEqual([[0, 1, bed.at, BAR]])
      expect(find(`music-${to}`)[0]!.at).toBeCloseTo(lift.at + BAR, 6)
      heard.now = now + BAR + 5
      engine.setSeason(to)
      expect(find(`land-${to}`), to).toHaveLength(1)
      expect(find(`amb-${to}`).map((v) => v.stoppedAt), to).toEqual([null, null])
      expect(find(`music-${to}`).map((v) => v.stoppedAt), to).toEqual([null, null])
      expect(names().filter((n) => /^(shake|land|amb|music)-/.test(n) && !n.endsWith(`-${to}`)), to).toEqual([])
    }
  })

  it('changes the beds, and plays no lift, shake or landing, where the season changes with no shake', async () => {
    const engine = await running(indexOf(SHORT, bedsOf(SEASONS)), SEASONS)
    const old = [...find(`amb-${SEASONS[0]}`), ...find(`music-${SEASONS[0]}`)]
    heard.now = 10
    heard.started = []
    engine.setSeason(SEASONS[1]!)
    expect(names().sort()).toEqual([`amb-${SEASONS[1]}`, `amb-${SEASONS[1]}`, `music-${SEASONS[1]}`, `music-${SEASONS[1]}`])
    for (const id of bedsOf([SEASONS[1]!])) {
      const bed = find(id)[0]!
      expect(bed.at).toBeGreaterThanOrEqual(10)
      expect(bed.at).toBeLessThan(10.1)
      expect(bed.voice[0]!.seconds).toBeGreaterThan(1)
    }
    expect(old).toHaveLength(4)
    for (const v of old) expect(v.stoppedAt).toBeGreaterThan(11)
  })
})

describe('a loop and its seam', () => {
  /** A loop, how long the index says it is, and what two passes of it share. */
  const seams: Array<[string, number, number]> = [
    ['music-winter', config.audio.appLoopBars * BAR, BAR],
    ['amb-winter', LOOP_SECONDS, 1.5],
  ]
  const short: Array<[string, number, number]> = [
    ['music-winter', 2 * BAR, BAR / 2],
    ['amb-winter', 4, 1],
  ]
  const lengths = (of: Array<[string, number, number]>): AudioIndex => {
    const index = indexOf(Object.keys(SPRITES), LOOPS)
    for (const [id, length] of of) index.loops[id] = { ...index.loops[id]!, loopStart: 0.2, loopSeconds: length }
    return index
  }

  it('is never left to wrap: each pass starts one overlap before the last one ends, and the two cross at equal power', async () => {
    for (const set of [seams, short]) {
      heard.started = []
      const engine = await running(lengths(set))
      for (const [id, length, seam] of set) {
        const passes = find(id)
        expect(passes.map((v) => v.loop), id).toEqual([false, false])
        expect(passes.map((v) => v.span), id).toEqual([
          [0.2, length],
          [0.2, length],
        ])
        const t0 = passes[0]!.at
        const period = length - seam
        expect(passes[1]!.at).toBeCloseTo(t0 + period, 6)
        const shapes = passes.map((v) => v.fades.map((f) => [Math.round(f.from), Math.round(f.to), f.at - t0, f.seconds]))
        expect(shapes[0], id).toEqual([[1, 0, expect.closeTo(period, 6), expect.closeTo(seam, 6)]])
        expect(shapes[1], id).toEqual([
          [0, 1, expect.closeTo(period, 6), expect.closeTo(seam, 6)],
          [1, 0, expect.closeTo(2 * period, 6), expect.closeTo(seam, 6)],
        ])
        const out = passes[0]!.fades[0]!.curve
        const rise = passes[1]!.fades[0]!.curve
        expect(out.length).toBe(rise.length)
        out.forEach((v, i) => expect(v * v + rise[i]! * rise[i]!).toBeCloseTo(1, 5))
        expect(out[0]).toBeCloseTo(1, 6)
        expect(out[out.length - 1]).toBeCloseTo(0, 6)
      }
      engine.dispose()
    }
  })

  it('keeps the bar of the music: a pass of a loop of whole bars starts a whole number of bars after the last', async () => {
    await running(lengths(seams))
    const [first, second] = find('music-winter')
    expect((second!.at - first!.at) / BAR).toBeCloseTo(config.audio.appLoopBars - 1, 6)
  })

  it('schedules the pass after next when a pass ends, on the audio clock, and never in the past', async () => {
    await running(lengths(seams))
    for (const [id, length, seam] of seams) {
      const period = length - seam
      const t0 = find(id)[0]!.at
      heard.now = t0 + length + 0.01
      find(id)[0]!.end()
      expect(find(id).map((v) => v.at - t0), id).toEqual([0, period, 2 * period].map((v) => expect.closeTo(v, 6)))
      heard.now = t0 + 100
      find(id)[1]!.end()
      const late = find(id)[3]!
      expect(late.at).toBeGreaterThan(heard.now)
      expect(late.at).toBeLessThan(heard.now + 0.1)
      expect(late.fades.map((f) => [Math.round(f.from), Math.round(f.to), f.at, f.seconds])).toEqual([
        [0, 1, late.at, expect.closeTo(seam, 6)],
        [1, 0, expect.closeTo(late.at + period, 6), expect.closeTo(seam, 6)],
      ])
      heard.now = 0
    }
  })

  it('stops every pass of a loop that is let go, and starts no more of it', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.now = 3
    const old = [...find('music-winter'), ...find('amb-winter')]
    engine.setSeason('spring')
    await settle()
    expect(old.every((v) => v.stoppedAt !== null && v.stoppedAt > 3)).toBe(true)
    const count = heard.started.length
    heard.now = 20
    for (const v of old) v.end()
    expect(heard.started).toHaveLength(count)
    const now = [...find('music-spring'), ...find('amb-spring')]
    expect(now.map((v) => v.stoppedAt)).toEqual([null, null, null, null])
    engine.dispose()
    expect(now.every((v) => v.stoppedAt !== null)).toBe(true)
    for (const v of now) v.end()
    expect(heard.started).toHaveLength(count)
  })

  it('plays nothing for a loop the index gives no length', async () => {
    const index = indexOf(Object.keys(SPRITES), LOOPS)
    index.loops['music-winter']!.loopSeconds = 0
    const said = quiet()
    await running(index)
    expect(find('music-winter')).toEqual([])
    expect(find('amb-winter')).toHaveLength(2)
    expect(said()).toBe(0)
  })
})

describe('the sound engine and the first picture', () => {
  it('asks for nothing of sound before the first complete picture', async () => {
    let show = (): void => undefined
    const afterFirstPicture = new Promise<void>((r) => (show = r))
    const asked = loadAudioIndex('http://x/audio', afterFirstPicture)
    const engine = createSoundEngine({ index: indexOf(Object.keys(SPRITES), LOOPS), baseUrl: 'http://x/audio/', afterFirstPicture, seasons: ['winter', 'spring'] })
    void engine.unlock()
    engine.shake('spring', BAR)
    await settle()
    expect(heard.fetched).toEqual([])
    expect(heard.started).toEqual([])
    show()
    await asked
    await settle()
    expect(heard.fetched).toContain('index.json')
    expect(heard.fetched).toContain(SPRITE_FILE)
    expect(heard.fetched).toContain('music-winter.m4a')
  })
})

describe('the sound engine on a shake', () => {
  it('plays the lift, the incoming shake, then its land cue and the music change one bar later', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.now = 10
    const old = find('music-winter')
    expect(old.map((v) => v.stoppedAt)).toEqual([null, null])
    heard.started = []
    engine.shake('spring', BAR)
    const cues = names().filter((n) => !n.startsWith('amb-'))
    expect(cues.slice(0, 2)).toEqual(['lift', 'shake-spring'])
    expect(cues).toEqual(['lift', 'shake-spring', 'land-spring', 'glass-clink', 'music-spring', 'music-spring'])
    const lift = find('lift')[0]!
    expect(find('shake-spring')[0]!.at).toBeCloseTo(lift.at, 6)
    expect(lift.at).toBeLessThan(10.1)
    expect(find('land-spring')[0]!.at).toBeCloseTo(lift.at + BAR, 6)
    expect(find('music-spring')[0]!.at).toBeCloseTo(lift.at + BAR, 6)
    expect(names()).not.toContain('land-winter')
    expect(names()).not.toContain('shake-winter')
    expect(old.every((v) => v.stoppedAt !== null)).toBe(true)
    heard.now = 13
    engine.setSeason('spring')
    expect(find('land-spring')).toHaveLength(1)
    expect(sounding('music-spring')).toHaveLength(2)
    expect(find('land-spring')[0]!.stoppedAt).toBeNull()
  })

  it('moves the land cue and the music change to the real landing when the landing is held', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.now = 10
    heard.started = []
    engine.shake('spring', BAR)
    heard.now = 11.2
    engine.shake('spring', Number.POSITIVE_INFINITY)
    engine.shake('spring', Number.POSITIVE_INFINITY)
    expect(sounding('land-spring')).toEqual([])
    expect(sounding('glass-clink')).toEqual([])
    expect(sounding('music-spring')).toEqual([])
    expect(find('lift')).toHaveLength(1)
    expect(find('shake-spring')).toHaveLength(1)
    heard.now = 14.8
    expect(sounding('land-spring')).toEqual([])
    engine.setSeason('spring')
    const land = sounding('land-spring')
    const music = sounding('music-spring')
    expect(land).toHaveLength(1)
    expect(music).toHaveLength(2)
    expect(land[0]!.at).toBeGreaterThanOrEqual(14.8)
    expect(land[0]!.at).toBeLessThan(14.9)
    expect(music[0]!.at).toBeGreaterThanOrEqual(14.8)
    expect(music[0]!.at).toBeLessThan(14.9)
    engine.setSeason('spring')
    expect(sounding('land-spring')).toHaveLength(1)
  })

  it('does not change the music when a held shake falls back to the season it left', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.now = 10
    heard.started = []
    engine.shake('spring', BAR)
    heard.now = 11.2
    engine.shake('spring', Number.POSITIVE_INFINITY)
    heard.now = 16
    engine.setSeason('winter')
    expect(sounding('land-spring')).toEqual([])
    expect(sounding('land-winter')).toEqual([])
    expect(sounding('music-spring')).toEqual([])
    expect(sounding('music-winter').filter((s) => s.stoppedAt === null)).toHaveLength(2)
    expect(sounding('amb-winter').filter((s) => s.stoppedAt === null)).toHaveLength(2)
  })
})

const SOURCE = fs.readFileSync('src/audio/index.ts', 'utf8')
const FILM = fs.readFileSync('tools/lib/audio.mjs', 'utf8')
const numberOf = (text: string, name: string): number => Number(new RegExp(`^const ${name} = (-?[\\d.]+(?: / \\d+)?)$`, 'm').exec(text)?.[1]?.replace(/^1 \/ (\d+)$/, (_, d: string) => String(1 / Number(d))) ?? Number.NaN)
const dB = (v: number): number => 20 * Math.log10(v)

describe('interface cues are spaced', () => {
  const GAP = numberOf(SOURCE, 'INTERFACE_GAP')

  it('says by the constant what it does, and the gap is 0.1 s', () => {
    expect(GAP).toBe(0.1)
    expect(SOURCE).toMatch(/a second tick or chime inside this many seconds of the last one is not played[^;]{0,220}\*\/\nconst INTERFACE_GAP = 0\.1\n/)
  })

  it('does not play a second tick or chime inside the gap, and plays the next one after it', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.started = []
    heard.now = 5
    engine.tick()
    for (const later of [0, 0.01, 0.05, 0.099]) {
      heard.now = 5 + later
      engine.tick()
      engine.chime()
    }
    expect(names()).toEqual(['ui-tick'])
    heard.now = 5.101
    engine.chime()
    expect(names()).toEqual(['ui-tick', 'ui-sound-on'])
    heard.now = 5.19
    engine.tick()
    engine.chime()
    expect(names()).toEqual(['ui-tick', 'ui-sound-on'])
    heard.now = 5.21
    engine.tick()
    engine.tick()
    expect(names()).toEqual(['ui-tick', 'ui-sound-on', 'ui-tick'])
    const at = heard.started.map((v) => v.at)
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(GAP)
  })

  it('does not count a tick that is not played: the played ticks keep their melody', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.started = []
    for (let i = 0; i < 5; i++) {
      heard.now = 5 + i * 0.3
      engine.tick()
      engine.tick()
      heard.now += 0.05
      engine.tick()
    }
    const cents = find('ui-tick').map((v) => Math.round(1200 * Math.log2(v.rate)))
    expect(cents).toEqual([0, 200, 500, 200, 700])
  })

  it('holds back no cue of a shake, a landing or a stir', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.started = []
    heard.now = 5
    engine.tick()
    engine.shake('spring', BAR)
    engine.stir(1)
    expect(names().filter((n) => !n.startsWith('amb-') && !n.startsWith('music-'))).toEqual(['ui-tick', 'lift', 'shake-spring', 'land-spring', 'glass-clink', 'glass-clink', 'shake-spring'])
    heard.now = 5.05
    engine.tick()
    expect(find('ui-tick')).toHaveLength(1)
  })

  it('does not start the gap with a cue that could not be played', async () => {
    const engine = await running(indexOf(['ui-tick'], LOOPS))
    heard.started = []
    heard.now = 5
    engine.chime()
    engine.tick()
    expect(names()).toEqual(['ui-tick'])
  })
})

describe('the sound switch', () => {
  it('lets the sound out over 0.04 s and in over 0.35 s on a quarter sine', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    const master = heard.master!.gain
    expect(master.value).toBe(1)
    heard.now = 3
    engine.setMuted(true)
    expect(master.fades).toEqual([])
    expect(master.moves.map((m) => [m.how, m.value, Math.round(m.at * 1000)])).toEqual([
      ['set', 1, 3000],
      ['line', 0, 3040],
    ])
    heard.now = 4
    engine.setMuted(false)
    expect(master.fades.map((f) => [f.from, f.to, f.at, f.seconds])).toEqual([[0, 1, 4, 0.35]])
    const curve = master.fades[0]!.curve
    expect(curve.length).toBeGreaterThanOrEqual(16)
    curve.forEach((v, i) => expect(v).toBeCloseTo(Math.sin((i / (curve.length - 1)) * (Math.PI / 2)), 6))
    // Where the old way in stood at full level, 0.04 s after the switch, this one is 15 dB below it.
    const at = (seconds: number): number => Math.sin((seconds / 0.35) * (Math.PI / 2))
    expect(dB(at(0.04))).toBeLessThan(-14.9)
    expect(dB(at(0.175))).toBeCloseTo(-3.01, 2)
    engine.setMuted(false)
    expect(master.fades).toHaveLength(1)
    expect(master.moves).toHaveLength(3)
  })

  it('starts each way from where the last one had got to, read from the clock and not from the node', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    const master = heard.master!.gain
    heard.now = 3
    engine.setMuted(true)
    heard.now = 4
    engine.setMuted(false)
    master.value = 0.123
    heard.now = 4.175
    engine.setMuted(true)
    const out = master.moves.slice(-2)
    expect(out.map((m) => m.how)).toEqual(['set', 'line'])
    expect(out[0]!.value).toBeCloseTo(Math.SQRT1_2, 6)
    expect(out[0]!.at).toBeCloseTo(4.175, 6)
    expect(out[1]!.value).toBe(0)
    expect(out[1]!.at).toBeCloseTo(4.215, 6)
    heard.now = 4.195
    engine.setMuted(false)
    const back = master.fades[master.fades.length - 1]!
    expect(back.from).toBeCloseTo(Math.SQRT1_2 / 2, 6)
    expect([back.to, back.seconds]).toEqual([1, 0.35])
    expect(back.at).toBeCloseTo(4.195, 6)
  })

  it('opens a page whose sound starts off with the same way in', async () => {
    const engine = createSoundEngine({ index: indexOf(Object.keys(SPRITES), LOOPS), baseUrl: 'http://x/audio/', afterFirstPicture: Promise.resolve(), seasons: ['winter', 'spring'] })
    engine.setMuted(true)
    void engine.unlock()
    expect(heard.master!.gain.value).toBe(0)
    heard.now = 0.5
    engine.setMuted(false)
    expect(heard.master!.gain.fades.map((f) => [f.from, f.to, f.at, f.seconds])).toEqual([[0, 1, 0.5, 0.35]])
    await settle()
    engine.dispose()
  })
})

describe('the old music through a shake', () => {
  const film = { db: numberOf(FILM, 'THIN_DB'), topHz: numberOf(FILM, 'THIN_TOP_HZ'), tail: numberOf(FILM, 'THIN_TAIL') }

  it("takes the numbers of the film's thin", () => {
    expect([film.db, film.topHz, film.tail]).toEqual([-12, 900, 0.15])
    expect(FILM).toContain('const hz = 30 * Math.pow(THIN_TOP_HZ / 30, t)')
    expect(FILM).toContain('const wet = Math.min(1, t * 8)')
    expect(numberOf(SOURCE, 'THIN_DB')).toBe(film.db)
    expect(numberOf(SOURCE, 'THIN_TO_HZ')).toBe(film.topHz)
    expect(numberOf(SOURCE, 'THIN_TAIL')).toBe(film.tail)
    expect(numberOf(SOURCE, 'THIN_FROM_HZ')).toBe(30)
    expect(numberOf(SOURCE, 'THIN_IN')).toBe(1 / 8)
    // Two plain poles one after the other, as the film has them, are one filter of the second order whose level at the corner is a half.
    expect(numberOf(SOURCE, 'THIN_Q_DB')).toBeCloseTo(dB(0.5), 2)
  })

  it("is let go as the film thins it: even steps of dB down to -12 over the bar, the last 0.15 s to nothing, the corner swept from 30 to 900 Hz", async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    const old = find('music-winter')[0]!
    const amb = find('amb-winter')[0]!
    expect(old.voice).toHaveLength(1)
    heard.now = 10
    engine.shake('spring', BAR)
    const t0 = find('lift')[0]!.at
    expect(old.voice).toHaveLength(3)
    const [, body, tail] = old.voice as [Fade, Fade, Fade]
    expect(body.at).toBeCloseTo(t0, 6)
    expect(body.seconds).toBeCloseTo(BAR - film.tail, 6)
    expect(body.from).toBe(1)
    expect(dB(body.to)).toBeCloseTo((film.db * (BAR - film.tail)) / BAR, 3)
    const steps = body.curve.slice(1).map((v, i) => dB(v) - dB(body.curve[i]!))
    for (const step of steps) expect(step).toBeCloseTo((film.db * (BAR - film.tail)) / BAR / (body.curve.length - 1), 3)
    expect(tail.at).toBeCloseTo(t0 + BAR - film.tail, 6)
    expect(tail.seconds).toBeCloseTo(film.tail, 6)
    expect(tail.from).toBeCloseTo(body.to, 6)
    expect(tail.to).toBe(0)
    const last = tail.curve.length - 1
    tail.curve.forEach((v, i) => {
      const share = (BAR - film.tail + (i / last) * film.tail) / BAR
      expect(v).toBeCloseTo(Math.pow(10, (film.db * share) / 20) * Math.cos((i / last) * (Math.PI / 2)), 5)
    })
    for (let i = 1; i <= last; i++) expect(tail.curve[i]!).toBeLessThan(tail.curve[i - 1]!)
    const round = (m: Move): [string, number, number] => [m.how, Math.round(m.value * 100) / 100, Math.round((m.at - t0) * 1000) / 1000]
    expect(old.corner.map(round)).toEqual([
      ['set', 10, 0],
      ['ratio', Math.round(30 * Math.pow(30, 1 / 8) * 100) / 100, BAR / 8],
      ['ratio', 900, BAR],
    ])
    expect(old.slope.map(round)).toEqual([
      ['set', 0.5, 0],
      ['line', -6.02, BAR / 8],
    ])
    expect(old.stoppedAt).toBeCloseTo(t0 + BAR + 0.05, 6)
    // The ambience is crossed, not thinned: one fall over the bar and its filter left alone.
    expect(amb.voice.slice(1).map((f) => [f.from, Math.round(f.to * 1e6), f.seconds])).toEqual([[1, 0, BAR]])
    expect([amb.corner, amb.slope]).toEqual([[], []])
    // The new music is not thinned and comes in at the landing.
    const next = find('music-spring')[0]!
    expect(next.at).toBeCloseTo(t0 + BAR, 6)
    expect([next.corner, next.slope]).toEqual([[], []])
  })

  it('is not thinned where the season changes with no shake', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    const old = find('music-winter')[0]!
    heard.now = 10
    engine.setSeason('spring')
    expect(old.voice.slice(1).map((f) => [f.from, Math.round(f.to * 1e6)])).toEqual([[1, 0]])
    expect([old.corner, old.slope]).toEqual([[], []])
  })

  it('is let go from the level its rise has got to, read from the clock and not from the node', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    const old = find('music-winter')[0]!
    const rise = old.voice[0]!
    heard.now = rise.at + rise.seconds / 3 - 0.02
    engine.shake('spring', BAR)
    expect(old.voice[1]!.from).toBeCloseTo(0.5, 5)
    expect(dB(old.voice[1]!.to / old.voice[1]!.from)).toBeCloseTo((film.db * (BAR - film.tail)) / BAR, 3)
  })
})

// The last job, point B: at a landing the new season's music is entered on a bar line of its loop, as the film cuts its
// music on one. The measurement against film B stands in src/audio/index.ts at LANDING_BAR.
describe('the new music at a landing', () => {
  const PAD = 0.2
  const LEAD = numberOf(FILM, 'LOOP_LEAD')
  const BARS = config.audio.appLoopBars
  /** A music loop as the pack writes it: from LEAD before the line of its first bar, its bars and the bar of the seam. */
  const LENGTH = (BARS + 1) * BAR
  const PERIOD = BARS * BAR
  /** The bar of its track each season is entered on. The loop's first bar is bar 1 of the track. */
  const TRACK_BAR: Record<string, number> = { winter: 6, spring: 6, summer: 4, fall: 1 }
  const WHOLE: [number, number] = [PAD, LENGTH]
  const packed = (): AudioIndex => {
    const index = indexOf(SHORT, bedsOf(SEASONS))
    for (const id of SEASONS) index.loops[`music-${id}`] = { ...index.loops[`music-${id}`]!, loopStart: PAD, loopSeconds: LENGTH }
    return index
  }
  const before = (to: string): string => SEASONS[(SEASONS.indexOf(to) + SEASONS.length - 1) % SEASONS.length]!
  const shape = (v: Started, t0: number): number[][] => v.fades.map((f) => [Math.round(f.from), Math.round(f.to), f.at - t0, f.seconds])

  it('enters the loop on a bar line, each season on the bar measured against the film', async () => {
    expect(numberOf(SOURCE, 'LOOP_LEAD')).toBe(LEAD)
    expect(Object.keys(TRACK_BAR).sort()).toEqual([...SEASONS].sort())
    for (const to of SEASONS) {
      heard.started = []
      const engine = await running(packed(), [before(to), to])
      heard.now = 10
      engine.shake(to, BAR)
      const first = find(`music-${to}`)[0]!
      expect(first.at, to).toBeCloseTo(find('lift')[0]!.at + BAR, 6)
      // On a line: a whole number of bars after the line of the loop's first bar, and inside the bars that are heard.
      const into = first.span[0] - PAD - LEAD
      expect(into / BAR, to).toBeCloseTo(Math.round(into / BAR), 6)
      expect(Math.round(into / BAR) + 1, to).toBe(TRACK_BAR[to])
      expect(into, to).toBeGreaterThanOrEqual(0)
      expect(into, to).toBeLessThan(PERIOD)
      // What is left of the loop is played and no more, and the rise is the short one it was.
      expect(first.span[1], to).toBeCloseTo(LENGTH - LEAD - into, 6)
      expect(first.voice.map((f) => [f.from, f.to, f.seconds]), to).toEqual([[0, 1, numberOf(SOURCE, 'CUT_FADE')]])
      expect(first.voice[0]!.at, to).toBeCloseTo(first.at, 6)
      engine.dispose()
    }
  })

  it('goes on whole after its first pass: each later pass is the loop from its start, one seam before the last one ends', async () => {
    const engine = await running(packed(), ['fall', 'winter'])
    heard.now = 10
    engine.shake('winter', BAR)
    const [first, second] = find('music-winter') as [Started, Started]
    const left = LENGTH - (first.span[0] - PAD)
    expect(left).toBeCloseTo(LENGTH - LEAD - 5 * BAR, 6)
    expect(second.span).toEqual(WHOLE)
    expect(second.at).toBeCloseTo(first.at + left - BAR, 6)
    // The two cross over the bar of the seam, as two whole passes do.
    expect(shape(first, first.at)).toEqual([[1, 0, expect.closeTo(left - BAR, 6), expect.closeTo(BAR, 6)]])
    expect(shape(second, second.at)).toEqual([
      [0, 1, expect.closeTo(0, 6), expect.closeTo(BAR, 6)],
      [1, 0, expect.closeTo(PERIOD, 6), expect.closeTo(BAR, 6)],
    ])
    // When the first pass has ended the one after the second is asked for: the whole loop again, one period on.
    heard.now = first.at + left + 0.01
    first.end()
    const third = find('music-winter')[2]!
    expect(third.span).toEqual(WHOLE)
    expect(third.at).toBeCloseTo(second.at + PERIOD, 6)
    engine.dispose()
  })

  it('begins a loop at its start where no shake lands: the sound switched on, a season changed with no shake', async () => {
    const engine = await running(packed(), SEASONS)
    const on = find(`music-${SEASONS[0]}`)
    expect(on.map((v) => v.span)).toEqual([WHOLE, WHOLE])
    expect(on[1]!.at).toBeCloseTo(on[0]!.at + PERIOD, 6)
    expect(on[0]!.voice.map((f) => f.seconds)).toEqual([numberOf(SOURCE, 'FIRST_FADE')])
    heard.now = 10
    engine.setSeason(SEASONS[1]!)
    expect(find(`music-${SEASONS[1]}`).map((v) => v.span)).toEqual([WHOLE, WHOLE])
    heard.now = 20
    engine.setSeason(SEASONS[2]!, true)
    expect(find(`music-${SEASONS[2]}`).map((v) => v.span)).toEqual([WHOLE, WHOLE])
    engine.dispose()
  })

  it('enters on the same line when the landing was held and the picture lands later', async () => {
    const engine = await running(packed(), ['fall', 'winter'])
    heard.now = 10
    engine.shake('winter', BAR)
    heard.now = 11.2
    engine.shake('winter', Number.POSITIVE_INFINITY)
    expect(sounding('music-winter')).toEqual([])
    heard.now = 14.8
    engine.setSeason('winter')
    const music = sounding('music-winter')
    expect(music).toHaveLength(2)
    expect(music[0]!.span[0]).toBeCloseTo(PAD + LEAD + (TRACK_BAR.winter! - 1) * BAR, 6)
    expect(music[1]!.span).toEqual(WHOLE)
    engine.dispose()
  })

  it('begins a loop too short to hold the entry at its start', async () => {
    const engine = await running(indexOf(Object.keys(SPRITES), LOOPS))
    heard.now = 10
    engine.shake('spring', BAR)
    expect(find('music-spring').map((v) => v.span)).toEqual([
      [0, LOOP_SECONDS],
      [0, LOOP_SECONDS],
    ])
    engine.dispose()
  })
})
