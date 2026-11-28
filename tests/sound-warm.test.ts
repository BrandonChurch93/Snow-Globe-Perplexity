import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioIndex } from '../src/core/bridge'
import { createSoundEngine } from '../src/audio'

const FILE = 'sfx.m4a'
const INDEX: AudioIndex = { version: 1, bytes: 0, files: [{ file: FILE, bytes: 16 }], sprites: { lift: { file: FILE, start: 0, seconds: 0.5, gain: 1 } }, loops: {} }
const EMPTY: AudioIndex = { version: 1, bytes: 0, files: [], sprites: {}, loops: {} }

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
  connect(): void {}
  disconnect(): void {}
}
let contexts = 0
class FakeContext {
  state = 'running'
  currentTime = 0
  destination = new FakeNode()
  constructor() {
    contexts++
  }
  createGain(): FakeNode {
    return new FakeNode()
  }
  decodeAudioData(_: ArrayBuffer, ok: (b: unknown) => void): Promise<unknown> {
    ok({})
    return Promise.resolve({})
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

let fetched: string[] = []
let lost: unknown[] = []
const onLost = (reason: unknown): void => void lost.push(reason)

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}

/** A browser with the sound's context class and, where `devices` is given, with the list of devices it answers by. */
function browser(devices?: { enumerateDevices: () => Promise<unknown> }, withContext = true): void {
  vi.stubGlobal('window', { ...(withContext ? { AudioContext: FakeContext } : {}), setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id) })
  vi.stubGlobal('navigator', devices ? { mediaDevices: devices } : {})
}

const engineOf = (index: AudioIndex | null, afterFirstPicture: Promise<void> = Promise.resolve()) => createSoundEngine({ index, baseUrl: 'http://x/audio/', afterFirstPicture, seasons: ['winter', 'spring'] })

beforeEach(() => {
  contexts = 0
  fetched = []
  lost = []
  process.on('unhandledRejection', onLost)
  vi.stubGlobal('fetch', async (url: string) => {
    fetched.push(String(url).split('/').pop()!)
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) }
  })
})
afterEach(() => {
  process.off('unhandledRejection', onLost)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the browser is asked for its list of sound devices before a first press, so that its sound service is up', () => {
  it('asks once, after the first picture and not before, and not again at the press', async () => {
    const enumerateDevices = vi.fn(async () => [])
    browser({ enumerateDevices })
    let show: () => void = () => undefined
    const engine = engineOf(INDEX, new Promise<void>((r) => (show = r)))
    await settle()
    expect(engine.available()).toBe(true)
    expect(enumerateDevices).toHaveBeenCalledTimes(0)
    expect(fetched).toEqual([])

    show()
    await settle()
    expect(enumerateDevices).toHaveBeenCalledTimes(1)
    expect(enumerateDevices.mock.calls[0]).toEqual([])
    expect(fetched).toEqual([FILE])
    expect(contexts).toBe(0)

    await engine.unlock()
    engine.setSeason('spring')
    await settle()
    expect(contexts).toBe(1)
    expect(enumerateDevices).toHaveBeenCalledTimes(1)
    expect(lost).toEqual([])
  })

  it('is skipped where the browser has no navigator.mediaDevices, and the sound loads as before', async () => {
    browser()
    const engine = engineOf(INDEX)
    await settle()
    expect(engine.available()).toBe(true)
    expect(fetched).toEqual([FILE])
    expect(lost).toEqual([])

    for (const none of [undefined, { mediaDevices: {} }]) {
      vi.stubGlobal('navigator', none)
      fetched = []
      expect(engineOf(INDEX).available()).toBe(true)
      await settle()
      expect(fetched).toEqual([FILE])
      expect(lost).toEqual([])
    }
  })

  it('swallows a list that is refused, whether the call rejects or throws, and the sound loads as before', async () => {
    const rejects = vi.fn(() => Promise.reject(new Error('refused')))
    browser({ enumerateDevices: rejects })
    engineOf(INDEX)
    await settle()
    expect(rejects).toHaveBeenCalledTimes(1)
    expect(fetched).toEqual([FILE])
    expect(lost).toEqual([])

    const throws = vi.fn((): Promise<unknown> => {
      throw new Error('refused')
    })
    browser({ enumerateDevices: throws })
    fetched = []
    engineOf(INDEX)
    await settle()
    expect(throws).toHaveBeenCalledTimes(1)
    expect(fetched).toEqual([FILE])
    expect(lost).toEqual([])
  })

  it('never asks when the sound engine is not available, nor where it plays through elements and makes no context', async () => {
    const enumerateDevices = vi.fn(async () => [])
    browser({ enumerateDevices })
    for (const index of [null, EMPTY]) {
      const engine = engineOf(index)
      await settle()
      expect(engine.available()).toBe(false)
    }
    expect(enumerateDevices).toHaveBeenCalledTimes(0)

    browser({ enumerateDevices }, false)
    const none = engineOf(INDEX)
    await settle()
    expect(none.available()).toBe(false)
    expect(enumerateDevices).toHaveBeenCalledTimes(0)

    vi.stubGlobal('Audio', class {})
    const elements = engineOf(INDEX)
    await settle()
    expect(elements.available()).toBe(true)
    expect(enumerateDevices).toHaveBeenCalledTimes(0)

    browser({ enumerateDevices })
    let show: () => void = () => undefined
    const gone = engineOf(INDEX, new Promise<void>((r) => (show = r)))
    gone.dispose()
    show()
    await settle()
    expect(gone.available()).toBe(false)
    expect(enumerateDevices).toHaveBeenCalledTimes(0)
    expect(fetched).toEqual([])
    expect(lost).toEqual([])
  })
})
