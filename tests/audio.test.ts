import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioIndex } from '../src/core/bridge'
import { createSoundEngine, loadAudioIndex } from '../src/audio'

const BAR = 2.4
const SPRITE_FILE = 'sfx.m4a'
const SPRITES: Record<string, number> = { lift: 0, 'shake-winter': 1, 'shake-spring': 4, 'land-winter': 8, 'land-spring': 10, 'glass-clink': 12, 'ui-tick': 13, 'ui-sound-on': 14 }
const LOOPS = ['amb-winter', 'music-winter', 'amb-spring', 'music-spring']

interface Started {
  name: string
  at: number
  loop: boolean
  stoppedAt: number | null
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
  cancelScheduledValues(): void {}
  setValueAtTime(): void {}
  setValueCurveAtTime(): void {}
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}
class FakeNode {
  gain = new FakeParam()
  frequency = new FakeParam()
  Q = new FakeParam()
  type = ''
  connect(): void {}
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
  start(at: number, offset: number): void {
    const file = this.buffer?.file ?? '?'
    const name = file === SPRITE_FILE ? (Object.entries(SPRITES).find(([, s]) => s === offset)?.[0] ?? '?') : file.replace('.m4a', '')
    this.rec = { name, at, loop: this.loop, stoppedAt: null }
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
    sprites: Object.fromEntries(sprites.map((id) => [id, { file: SPRITE_FILE, start: SPRITES[id]!, seconds: 0.5, gain: 1 }])),
    loops: Object.fromEntries(loops.map((id) => [id, { file: `${id}.m4a`, loopStart: 0, loopSeconds: 8, gain: 1 }])),
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
afterEach(() => vi.unstubAllGlobals())

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
    expect(before.map((v) => v.stoppedAt)).toEqual([null, null])
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
    expect(old.map((v) => v.stoppedAt)).toEqual([null])
    heard.started = []
    engine.shake('spring', BAR)
    const cues = names().filter((n) => !n.startsWith('amb-'))
    expect(cues.slice(0, 2)).toEqual(['lift', 'shake-spring'])
    expect(cues).toEqual(['lift', 'shake-spring', 'land-spring', 'glass-clink', 'music-spring'])
    const lift = find('lift')[0]!
    expect(find('shake-spring')[0]!.at).toBeCloseTo(lift.at, 6)
    expect(lift.at).toBeLessThan(10.1)
    expect(find('land-spring')[0]!.at).toBeCloseTo(lift.at + BAR, 6)
    expect(find('music-spring')[0]!.at).toBeCloseTo(lift.at + BAR, 6)
    expect(names()).not.toContain('land-winter')
    expect(names()).not.toContain('shake-winter')
    expect(old[0]!.stoppedAt).not.toBeNull()
    heard.now = 13
    engine.setSeason('spring')
    expect(find('land-spring')).toHaveLength(1)
    expect(sounding('music-spring')).toHaveLength(1)
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
    expect(music).toHaveLength(1)
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
    expect(sounding('music-winter').filter((s) => s.stoppedAt === null)).toHaveLength(1)
    expect(sounding('amb-winter').filter((s) => s.stoppedAt === null)).toHaveLength(1)
  })
})
