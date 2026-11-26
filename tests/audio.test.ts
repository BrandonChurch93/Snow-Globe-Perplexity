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

interface Started {
  name: string
  at: number
  loop: boolean
  stoppedAt: number | null
  /** Where in its file the source starts and how long it plays. */
  span: [number, number | undefined]
  /** The level curves asked of the node the source plays into, and of the voice that node is part of. */
  fades: Fade[]
  voice: Fade[]
  /** The source ends, as the audio clock ends it. */
  end(): void
}

/** What the fake audio context saw, in the order it was asked. */
const heard = { contexts: 0, started: [] as Started[], fetched: [] as string[], now: 0 }
const sizes = new Map<string, number>()
const sizeOf = (file: string): number => {
  if (!sizes.has(file)) sizes.set(file, 16 + sizes.size)
  return sizes.get(file)!
}
const fileOfSize = (n: number): string => [...sizes].find(([, v]) => v === n)?.[0] ?? '?'

class FakeParam {
  value = 0
  fades: Fade[] = []
  cancelScheduledValues(): void {}
  setValueAtTime(): void {}
  setValueCurveAtTime(curve: Float32Array, at: number, seconds: number): void {
    this.fades.push({ from: curve[0]!, to: curve[curve.length - 1]!, at, seconds, curve: [...curve] })
  }
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}
class FakeNode {
  gain = new FakeParam()
  frequency = new FakeParam()
  Q = new FakeParam()
  type = ''
  out: FakeNode | null = null
  connect(to: FakeNode): void {
    this.out ??= to
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
    this.rec = { name, at, loop: this.loop, stoppedAt: null, span: [offset, seconds], fades: this.out?.gain.fades ?? [], voice: this.out?.out?.out?.gain.fades ?? [], end: () => this.onended?.() }
    heard.started.push(this.rec)
  }
  stop(at?: number): void {
    if (this.rec && this.rec.stoppedAt === null) this.rec.stoppedAt = at ?? heard.now
  }
}
class FakeContext {
  state = 'running'
  destination = new FakeNode()
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
