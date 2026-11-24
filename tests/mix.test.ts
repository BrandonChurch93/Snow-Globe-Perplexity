import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as lib from '../tools/lib/audio.mjs'
import { loadConfig } from '../tools/lib/paths.mjs'

type Sound = { rate: number; L: Float64Array; R: Float64Array }
type Measured = { seconds: number; lufs: number; truePeakDb: number; silenceFrontSeconds: number; events: number; spectrum: { centroidHz: number } }
type Kept = { audio: Sound; steps: string[]; gainDb: number; loop: { seconds: number; seam: { ratio: number; levelStepDb: number } } | null }
type Mixed = {
  audio: Sound
  music: Sound
  report: { seconds: number; openingSeconds: number; placed: { cue: string; at?: number }[]; skipped: { cue: string; why: string }[]; music: { source: string; parts: { id: string }[] }; master: { lufs: number; truePeakDb: number; silent: boolean } }
}
type Cut = Record<string, unknown>
type Lib = {
  RATE: number
  PEAK_MARGIN_DB: number
  make(n: number, rate?: number): Sound
  seconds(a: Sound): number
  db(x: number): number
  lin(d: number): number
  encodeWav(a: Sound): Buffer
  parseWav(b: Buffer): Sound
  loudness(a: Sound): number
  truePeak(a: Sound): number
  peak(a: Sound): number
  measure(a: Sound): Measured
  classOf(id: string): string
  levelOf(cls: string): number
  keepChain(a: Sound, cls: string, options?: Record<string, unknown>): Kept
  master(a: Sound, target: number, ceilingDb: number): { audio: Sound; lufs: number; truePeakDb: number; passes: number; reductionDb: number }
  mixFilm(o: { cut: Cut; which?: string; candidate?: string; keptDir: string; mapsDir: string; skip?: string[]; gains?: Record<string, number> }): Mixed
  sha256(b: Buffer): string
}

const A = lib as unknown as Lib
const config = loadConfig() as { audio: { filmLoudnessLufs: number; truePeakDb: number; sampleRate: number; candidates: string[] }; film: { defaultBpm: number; beatsPerBar: number; fps: number }; seasons: string[] }
const rate = A.RATE
let dir = ''
let kept = ''
let maps = ''

const tone = (hz: number, seconds: number, amp: number, lead = 0, decay = 0): Sound => {
  const a = A.make(Math.round((seconds + lead) * rate), rate)
  const from = Math.round(lead * rate)
  for (let i = from; i < a.L.length; i++) {
    const t = (i - from) / rate
    const env = decay > 0 ? Math.exp(-t / decay) : 1
    const v = amp * env * Math.sin(2 * Math.PI * hz * t)
    a.L[i] = v
    a.R[i] = v
  }
  return a
}

const noise = (seconds: number, amp: number, seed: number): Sound => {
  const a = A.make(Math.round(seconds * rate), rate)
  let s = seed >>> 0
  let l = 0
  let r = 0
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2147483648 - 1
  }
  for (let i = 0; i < a.L.length; i++) {
    l += 0.08 * (next() - l)
    r += 0.08 * (next() - r)
    a.L[i] = amp * l * 4
    a.R[i] = amp * r * 4
  }
  return a
}

const keep = (id: string, source: Sound): Kept => {
  const k = A.keepChain(source, A.classOf(id))
  fs.writeFileSync(path.join(kept, `${id}.wav`), A.encodeWav(k.audio))
  return k
}

const bar = (config.film.beatsPerBar * 60) / config.film.defaultBpm
const cutOf = (): Cut => ({
  source: 'default-grid',
  bpm: config.film.defaultBpm,
  beatsPerBar: config.film.beatsPerBar,
  fps: config.film.fps,
  seconds: 4 * bar,
  frameCount: Math.round(4 * bar * config.film.fps),
  opening: { frameCount: 90, seconds: 1.5, cues: [{ cue: 'key-tap', frame: 12, at: 0.2 }, { cue: 'key-tap', frame: 30, at: 0.5 }, { cue: 'riser', frame: 40, at: 0.6 }] },
  cues: [
    { cue: 'lift', frame: 0, at: bar },
    { cue: 'shake-spring', frame: 0, at: bar },
    { cue: 'land-spring', frame: 0, at: 2 * bar },
    { cue: 'glass-clink', frame: 0, at: 2 * bar },
    { cue: 'land-summer', frame: 0, at: 3 * bar },
  ],
  ambience: [
    { cue: 'amb-winter', from: 0, to: 2 * bar, fadeIn: 0, fadeOut: bar },
    { cue: 'amb-spring', from: bar, to: 4 * bar, fadeIn: bar, fadeOut: 0 },
  ],
  sections: [
    { season: 'winter', from: 0, to: 2 * bar },
    { season: 'spring', from: 2 * bar, to: 4 * bar },
  ],
})

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mix-test-'))
  kept = path.join(dir, 'kept')
  maps = path.join(dir, 'maps')
  fs.mkdirSync(kept)
  fs.mkdirSync(maps)
  keep('lift', tone(330, 0.4, 0.3, 0.12, 0.12))
  keep('shake-spring', noise(2.2, 0.4, 3))
  keep('land-spring', tone(70, 1.1, 0.8, 0, 0.25))
  keep('glass-clink', tone(2400, 0.25, 0.5, 0, 0.06))
  keep('key-tap', tone(1500, 0.08, 0.4, 0, 0.02))
  keep('amb-winter', noise(24, 0.2, 7))
  keep('music-winter', tone(220, 6 * bar, 0.4))
  keep('music-spring', tone(277, 6 * bar, 0.4))
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('audio library', () => {
  it('writes the same WAV bytes for the same samples and reads them back', () => {
    const a = tone(440, 0.25, 0.5)
    const one = A.encodeWav(a)
    const two = A.encodeWav(a)
    expect(one.equals(two)).toBe(true)
    const back = A.parseWav(one)
    expect(back.rate).toBe(rate)
    expect(back.L.length).toBe(a.L.length)
    let worst = 0
    for (let i = 0; i < a.L.length; i++) worst = Math.max(worst, Math.abs(back.L[i]! - a.L[i]!))
    expect(worst).toBeLessThanOrEqual(1 / 8388608)
    expect(A.encodeWav(back).equals(one)).toBe(true)
  })

  it('measures a 1 kHz tone at -23 dB as -23 LUFS', () => {
    const a = tone(1000, 5, A.lin(-23))
    expect(Math.abs(A.loudness(a) + 23)).toBeLessThan(0.1)
    expect(Math.abs(A.db(A.truePeak(a)) + 23)).toBeLessThan(0.1)
    const twice = tone(1000, 5, A.lin(-17))
    expect(Math.abs(A.loudness(twice) - A.loudness(a) - 6)).toBeLessThan(0.05)
  })

  it('measures a take: length, silence in front, peak and where its energy sits', () => {
    const m = A.measure(tone(330, 0.5, 0.25, 0.12, 0.15))
    expect(m.seconds).toBeCloseTo(0.62, 2)
    expect(Math.abs(m.silenceFrontSeconds - 0.12)).toBeLessThan(0.01)
    expect(m.events).toBe(1)
    expect(Math.abs(m.truePeakDb - A.db(0.25))).toBeLessThan(0.3)
  })

  it('brings each class of sound to the level its table gives', () => {
    for (const id of ['amb-winter', 'ui-tick', 'lift', 'glass-clink', 'land-fall', 'shake-summer']) {
      const cls = A.classOf(id)
      const source = cls === 'ambience' ? noise(24, 0.3, 11) : cls === 'impact' ? noise(1.4, 0.3, 5) : tone(900, 0.35, 0.2, 0.1, 0.1)
      const k = A.keepChain(source, cls)
      expect(Math.abs(A.loudness(k.audio) - A.levelOf(cls))).toBeLessThan(0.15)
      expect(A.db(A.truePeak(k.audio))).toBeLessThanOrEqual(config.audio.truePeakDb)
      if (cls !== 'ambience') expect(A.measure(k.audio).silenceFrontSeconds).toBeLessThan(0.03)
    }
    expect(A.levelOf('ambience')).toBeLessThan(A.levelOf('interface'))
    expect(A.levelOf('interface')).toBeLessThan(A.levelOf(A.classOf('lift')))
    expect(A.levelOf(A.classOf('glass-clink'))).toBeLessThan(A.levelOf(A.classOf('land-winter')))
    expect(A.classOf('shake-winter')).toBe(A.classOf('land-winter'))
  })

  it('makes an ambience into a loop with no step at its seam', () => {
    const k = A.keepChain(noise(24, 0.3, 19), 'ambience')
    expect(k.loop).not.toBeNull()
    expect(k.loop!.seconds).toBeCloseTo(A.seconds(k.audio), 3)
    expect(k.loop!.seam.ratio).toBeLessThan(4)
    expect(Math.abs(k.loop!.seam.levelStepDb)).toBeLessThan(3)
  })

  it('holds the true peak under the ceiling while it reaches the loudness', () => {
    const a = noise(6, 0.05, 23)
    for (let k = 0; k < 6; k++) {
      const at = Math.round((0.5 + k * 0.9) * rate)
      for (let i = 0; i < 2400; i++) {
        const v = 0.9 * Math.exp(-i / 400) * Math.sin((2 * Math.PI * 90 * i) / rate)
        a.L[at + i] = a.L[at + i]! + v
        a.R[at + i] = a.R[at + i]! + v
      }
    }
    const m = A.master(a, config.audio.filmLoudnessLufs, config.audio.truePeakDb)
    expect(Math.abs(A.loudness(m.audio) - config.audio.filmLoudnessLufs)).toBeLessThan(0.5)
    expect(A.db(A.truePeak(m.audio))).toBeLessThanOrEqual(config.audio.truePeakDb)
    expect(m.reductionDb).toBeGreaterThan(0)
  })
})

describe('mix', () => {
  it('is byte equal when made twice from the same inputs', () => {
    const one = A.mixFilm({ cut: cutOf(), candidate: 'blockout', keptDir: kept, mapsDir: maps })
    const two = A.mixFilm({ cut: cutOf(), candidate: 'blockout', keptDir: kept, mapsDir: maps })
    const a = A.encodeWav(one.audio)
    const b = A.encodeWav(two.audio)
    expect(a.length).toBe(b.length)
    expect(a.equals(b)).toBe(true)
    expect(A.sha256(a)).toBe(A.sha256(b))
    expect(JSON.stringify(one.report)).toBe(JSON.stringify(two.report))
  })

  it('changes when an input changes', () => {
    const one = A.encodeWav(A.mixFilm({ cut: cutOf(), candidate: 'blockout', keptDir: kept, mapsDir: maps }).audio)
    const two = A.encodeWav(A.mixFilm({ cut: cutOf(), candidate: 'blockout', keptDir: kept, mapsDir: maps, gains: { lift: -6 } }).audio)
    expect(one.equals(two)).toBe(false)
  })

  it('skips a cue with no kept file, names it, and carries no music in the blockout', () => {
    const m = A.mixFilm({ cut: cutOf(), candidate: 'blockout', keptDir: kept, mapsDir: maps })
    const skipped = m.report.skipped.map((s) => s.cue)
    expect(skipped).toContain('land-summer')
    expect(skipped).toContain('amb-spring')
    expect(skipped).not.toContain('lift')
    expect(m.report.placed.map((p) => p.cue)).toEqual(expect.arrayContaining(['lift', 'shake-spring', 'land-spring', 'glass-clink', 'amb-winter']))
    expect(m.report.music.source).toBe('none')
    expect(A.peak(m.music)).toBe(0)
    const left = A.mixFilm({ cut: cutOf(), candidate: 'blockout', keptDir: kept, mapsDir: maps, skip: ['lift'] })
    expect(left.report.skipped.find((s) => s.cue === 'lift')?.why).toContain('--skip')
  })

  it('lands on the loudness of the film with the peak under its limit', () => {
    for (const candidate of ['blockout', 'four-tracks']) {
      const m = A.mixFilm({ cut: cutOf(), candidate, keptDir: kept, mapsDir: maps })
      expect(A.seconds(m.audio)).toBeCloseTo(4 * bar, 3)
      expect(Math.abs(A.loudness(m.audio) - config.audio.filmLoudnessLufs)).toBeLessThan(1)
      expect(A.db(A.truePeak(m.audio))).toBeLessThanOrEqual(config.audio.truePeakDb)
      expect(m.report.master.silent).toBe(false)
    }
  })

  it('lays one track for each season of the cut and is still byte equal twice', () => {
    expect(config.audio.candidates).toContain('four-tracks')
    const one = A.mixFilm({ cut: cutOf(), candidate: 'four-tracks', keptDir: kept, mapsDir: maps })
    const two = A.mixFilm({ cut: cutOf(), candidate: 'four-tracks', keptDir: kept, mapsDir: maps })
    expect(one.report.music.parts.map((p) => p.id)).toEqual(['music-winter', 'music-spring'])
    expect(A.peak(one.music)).toBeGreaterThan(0)
    expect(A.encodeWav(one.audio).equals(A.encodeWav(two.audio))).toBe(true)
    expect(A.encodeWav(one.music).equals(A.encodeWav(two.music))).toBe(true)
  })

  it('moves everything after the opening by its length in film A', () => {
    const b = A.mixFilm({ cut: cutOf(), which: 'b', candidate: 'blockout', keptDir: kept, mapsDir: maps })
    const a = A.mixFilm({ cut: cutOf(), which: 'a', candidate: 'blockout', keptDir: kept, mapsDir: maps })
    expect(a.report.openingSeconds).toBe(1.5)
    expect(A.seconds(a.audio)).toBeCloseTo(A.seconds(b.audio) + 1.5, 3)
    expect(a.report.placed.filter((p) => p.cue === 'key-tap').length).toBe(2)
    expect(b.report.placed.filter((p) => p.cue === 'key-tap').length).toBe(0)
    expect(a.report.skipped.map((s) => s.cue)).toContain('riser')
    const liftA = a.report.placed.find((p) => p.cue === 'lift')!.at!
    const liftB = b.report.placed.find((p) => p.cue === 'lift')!.at!
    expect(liftA - liftB).toBeCloseTo(1.5, 4)
  })

  it('is silent, and says so, when nothing is kept', () => {
    const empty = path.join(dir, 'empty')
    fs.mkdirSync(empty, { recursive: true })
    const m = A.mixFilm({ cut: cutOf(), candidate: 'blockout', keptDir: empty, mapsDir: maps })
    expect(m.report.master.silent).toBe(true)
    expect(A.peak(m.audio)).toBe(0)
    expect(m.report.placed.length).toBe(0)
  })
})
