import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as lib from '../tools/lib/audio.mjs'
import { loadConfig } from '../tools/lib/paths.mjs'

type Sound = { rate: number; L: Float64Array; R: Float64Array }
type Measured = { seconds: number; lufs: number; lufsMeasure: string; soundLufs: number | null; offsetDb: number | null; soundSeconds: number; truePeakDb: number; silenceFrontSeconds: number; events: number; spectrum: { centroidHz: number } }
type Level = { measure: string; measuredAs: string; seconds: number; beforeLufs: number; afterLufs: number; targetLufs: number; truePeakDb: number }
type Kept = { audio: Sound; steps: string[]; gainDb: number; level: Level; loop: { seconds: number; seam: { ratio: number; levelStepDb: number } } | null }
type Plan = { sprite: { audio: Sound | null; entries: Record<string, { start: number; seconds: number; gain: number }> }; loops: unknown[]; notes: string[] }
type Mixed = {
  audio: Sound
  music: Sound
  report: { seconds: number; openingSeconds: number; placed: { cue: string; at?: number }[]; skipped: { cue: string; why: string }[]; music: { source: string; parts: { id: string }[] }; master: { lufs: number; truePeakDb: number; silent: boolean } }
}
type Cut = Record<string, unknown>
type Lib = {
  RATE: number
  PEAK_MARGIN_DB: number
  LOUDNESS_BLOCK: number
  SHORT_CREST_DB: number
  MEASURES: Record<string, string>
  loudnessOf(a: Sound): { lufs: number; measure: string; seconds: number }
  cueSeconds(id: string): number | null
  planPack(o: { keptDir: string; mapsDir: string }): Plan
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

const burst = (total: number, lead: number, length: number, peakDb: number, seed: number): Sound => {
  const a = A.make(Math.round(total * rate), rate)
  const from = Math.round(lead * rate)
  const n = Math.round(length * rate)
  let s = seed >>> 0
  const x = new Float64Array(a.L.length)
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    x[from + i] = (s / 2147483648 - 1) * Math.exp((-5 * i) / n)
  }
  const k = 1 / (1 + (2 * Math.PI * 6000) / rate)
  let y = x
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float64Array(y.length)
    for (let i = 1; i < y.length; i++) o[i] = k * (o[i - 1]! + y[i]! - y[i - 1]!)
    y = o
  }
  let top = 0
  for (const v of y) top = Math.max(top, Math.abs(v))
  const g = A.lin(peakDb) / top
  for (let i = 0; i < y.length; i++) {
    a.L[i] = y[i]! * g
    a.R[i] = y[i]! * g
  }
  return a
}

const plus = (a: Sound, f: (i: number) => number): Sound => {
  const o = A.make(a.L.length, rate)
  for (let i = 0; i < a.L.length; i++) {
    const v = f(i)
    o.L[i] = a.L[i]! + v
    o.R[i] = a.R[i]! + v
  }
  return o
}

const padTo = (a: Sound, seconds: number): Sound => {
  const o = A.make(Math.round(seconds * rate), rate)
  o.L.set(a.L)
  o.R.set(a.R)
  return o
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

describe('sounds shorter than the loudness block', () => {
  const tickTake = (): Sound => burst(0.48, 0.15, 0.11, -8, 41)
  const landing = (): Kept => {
    const body = tone(70, 1.1, 0.8, 0.05, 0.25)
    const air = noise(1.15, 0.05, 13)
    return A.keepChain(plus(body, (i) => air.L[i] ?? 0), 'impact', { capSeconds: A.cueSeconds('land-winter') })
  }

  it('measures a 60 ms and a 100 ms burst over their own length and says so', () => {
    for (const length of [0.06, 0.1]) {
      const alone = burst(length, 0, length, -8, 17)
      const found = A.loudnessOf(alone)
      expect(found.measure).toBe('own-length')
      expect(Number.isFinite(found.lufs)).toBe(true)
      expect(found.seconds).toBeCloseTo(length, 3)
      const twice = A.make(alone.L.length * 2, rate)
      twice.L.set(alone.L)
      twice.L.set(alone.L, alone.L.length)
      twice.R.set(alone.R)
      twice.R.set(alone.R, alone.R.length)
      expect(Math.abs(A.loudnessOf(twice).lufs - found.lufs)).toBeLessThan(0.3)
      const m = A.measure(burst(0.48, 0.15, length, -8, 17))
      expect(m.lufsMeasure).toBe('gated')
      expect(Number.isFinite(m.lufs)).toBe(true)
      expect(Number.isFinite(m.soundLufs)).toBe(true)
      expect(m.soundLufs!).toBeGreaterThan(m.lufs)
    }
    expect(A.loudnessOf(tone(1000, A.LOUDNESS_BLOCK + 0.1, 0.1)).measure).toBe('gated')
    expect(A.loudnessOf(A.make(2400, rate)).lufs).toBe(-Infinity)
  })

  it('keeps a 60 ms and a 100 ms burst at the level of their class', () => {
    for (const [id, length] of [['ui-tick', 0.06], ['key-tap', 0.1]] as const) {
      const cls = A.classOf(id)
      const k = A.keepChain(burst(0.48, 0.15, length, -8, 29), cls, { capSeconds: A.cueSeconds(id) })
      const found = A.loudnessOf(k.audio)
      expect(found.measure).toBe('own-length')
      expect(Math.abs(found.lufs - A.levelOf(cls))).toBeLessThan(0.15)
      expect(k.level.measure).toBe('own-length')
      expect(k.level.afterLufs).toBeCloseTo(A.levelOf(cls), 1)
      expect(k.steps.join(' ')).toContain(A.MEASURES['own-length']!)
      expect(A.seconds(k.audio)).toBeLessThanOrEqual(A.cueSeconds(id)! + 0.001)
      expect(A.seconds(k.audio)).toBeGreaterThan(length * 0.6)
      expect(A.measure(k.audio).lufsMeasure).toBe('own-length')
    }
    const long = A.keepChain(noise(1.4, 0.3, 5), 'impact')
    expect(long.level.measure).toBe('gated')
    expect(long.steps.join(' ')).toContain(A.MEASURES.gated!)
  })

  it('keeps the tick of a take like the real one: 0.15 s of silence, a 0.11 s burst, silence to 0.48 s', () => {
    const cap = A.cueSeconds('ui-tick')
    const clean = A.keepChain(tickTake(), 'interface', { capSeconds: cap })
    expect(Math.abs(A.loudnessOf(clean.audio).lufs - A.levelOf('interface'))).toBeLessThan(0.15)
    expect(A.seconds(clean.audio)).toBeCloseTo(cap!, 3)
    const cases: [string, Sound][] = [
      ['a constant offset', plus(tickTake(), () => A.lin(-55))],
      ['a 30 Hz rumble', plus(tickTake(), (i) => A.lin(-50) * Math.sin((2 * Math.PI * 30 * i) / rate))],
      ['a hiss in front', plus(tickTake(), (i) => A.lin(-58) * Math.sin(i * 1.7) * Math.sin(i * 0.37))],
      ['a small click at the very start', plus(tickTake(), (i) => (i < 48 ? A.lin(-40) * (i % 2 ? 1 : -1) : 0))],
    ]
    for (const [name, take] of cases) {
      const k = A.keepChain(take, 'interface', { capSeconds: cap })
      expect(Math.abs(k.gainDb - clean.gainDb), name).toBeLessThan(0.6)
      expect(Math.abs(A.loudnessOf(k.audio).lufs - A.levelOf('interface')), name).toBeLessThan(0.15)
      expect(A.db(A.peak(k.audio)), name).toBeGreaterThan(A.db(A.peak(clean.audio)) - 1)
    }
    const m = A.measure(cases[0]![1])
    expect(m.offsetDb).toBeCloseTo(-55, 0)
    expect(Math.abs(m.silenceFrontSeconds - 0.15)).toBeLessThan(0.011)
    expect(m.soundSeconds).toBeLessThan(0.13)
    expect(A.measure(tickTake()).offsetDb).toBeNull()
    expect(() => A.keepChain(A.make(4800, rate), 'interface')).toThrow()
  })

  it('never brings an interface tick out louder than a landing', () => {
    const land = landing()
    const landLufs = A.loudness(land.audio)
    expect(Math.abs(landLufs - A.levelOf('impact'))).toBeLessThan(0.15)
    for (const [id, length] of [['ui-tick', 0.06], ['key-tap', 0.1], ['ui-tick', 0.11]] as const) {
      const k = A.keepChain(burst(0.48, 0.15, length, -8, 31), 'interface', { capSeconds: A.cueSeconds(id) })
      expect(A.loudnessOf(k.audio).lufs).toBeLessThan(landLufs)
      expect(A.loudness(padTo(k.audio, A.LOUDNESS_BLOCK))).toBeLessThan(landLufs)
      expect(A.loudness(padTo(k.audio, 1.2))).toBeLessThan(landLufs)
      expect(A.db(A.truePeak(k.audio))).toBeLessThan(A.db(A.truePeak(land.audio)))
      expect(A.db(A.truePeak(k.audio))).toBeLessThanOrEqual(A.levelOf('interface') + A.SHORT_CREST_DB + 0.01)
    }
    const click = A.make(Math.round(0.06 * rate), rate)
    for (let i = 0; i < click.L.length; i++) {
      const v = i >= 480 && i < 483 ? (i % 2 ? 0.7 : -0.7) : 0.007 * Math.sin(i * 0.9)
      click.L[i] = v
      click.R[i] = v
    }
    const sharp = A.keepChain(click, 'interface', { capSeconds: A.cueSeconds('ui-tick') })
    expect(A.db(A.truePeak(sharp.audio))).toBeLessThanOrEqual(A.levelOf('interface') + A.SHORT_CREST_DB + 0.01)
    expect(A.loudnessOf(sharp.audio).lufs).toBeLessThanOrEqual(A.levelOf('interface') + 0.01)
    expect(sharp.steps.join(' ')).toContain('short sound')
  })

  it('packs and mixes a 0.08 s cue without a loudness call failing', () => {
    const short = path.join(dir, 'short')
    fs.mkdirSync(short, { recursive: true })
    for (const [id, length] of [['ui-tick', 0.06], ['key-tap', 0.1]] as const) {
      const k = A.keepChain(burst(0.48, 0.15, length, -8, 37), A.classOf(id), { capSeconds: A.cueSeconds(id) })
      fs.writeFileSync(path.join(short, `${id}.wav`), A.encodeWav(k.audio))
      fs.writeFileSync(path.join(short, `${id}.json`), JSON.stringify({ id, class: A.classOf(id) }))
    }
    const plan = A.planPack({ keptDir: short, mapsDir: maps })
    expect(Object.keys(plan.sprite.entries).sort()).toEqual(['key-tap', 'ui-tick'])
    expect(plan.notes).toEqual([])
    expect(plan.sprite.entries['ui-tick']!.seconds).toBeLessThanOrEqual(0.081)
    expect(plan.sprite.entries['ui-tick']!.gain).toBeGreaterThan(0)
    expect(plan.sprite.entries['ui-tick']!.gain).toBeLessThan(1)
    expect(A.peak(plan.sprite.audio!)).toBeGreaterThan(0)
    const cut = { ...cutOf(), cues: [{ cue: 'ui-tick', frame: 0, at: bar }], ambience: [], opening: { frameCount: 90, seconds: 1.5, cues: [{ cue: 'key-tap', frame: 12, at: 0.2 }, { cue: 'key-tap', frame: 30, at: 0.5 }] } }
    for (const which of ['b', 'a']) {
      const one = A.mixFilm({ cut, which, candidate: 'blockout', keptDir: short, mapsDir: maps })
      const two = A.mixFilm({ cut, which, candidate: 'blockout', keptDir: short, mapsDir: maps })
      expect(one.report.skipped).toEqual([])
      expect(one.report.master.silent).toBe(false)
      expect(Number.isFinite(one.report.master.lufs)).toBe(true)
      expect(A.db(A.truePeak(one.audio))).toBeLessThanOrEqual(config.audio.truePeakDb)
      expect(A.encodeWav(one.audio).equals(A.encodeWav(two.audio))).toBe(true)
    }
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
