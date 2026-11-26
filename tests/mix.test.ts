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
type Ends = { ratio: number; levelStepDb: number; secondStepDb: number }
type Heard = { periodSeconds: number; seamSeconds: number; meanDb: number; seamDb: number; quartersDb: number[]; startAloneDb: number; tailAloneDb: number }
type Loop = { id: string; audio: Sound; loopStart: number; loopSeconds: number; gain: number; seam: Ends | null; heard: Heard; bars?: number; periodSeconds?: number; tailSeconds?: number; fromBar?: number; toBar?: number; leadSeconds?: number; centredByDb?: number; turnedSeconds?: number }
type ShakeOfPack = { id: string; class: string; trimDb: number; stepDb: number; appDb: number; riseMs: number; gain: number }
type Plan = { sprite: { audio: Sound | null; entries: Record<string, { start: number; seconds: number; gain: number }> }; loops: Loop[]; notes: string[]; laid: { id: string; state: string }[]; shakes: ShakeOfPack[]; trimsDb: Record<string, number> }
type Mixed = {
  audio: Sound
  music: Sound
  report: {
    seconds: number
    openingSeconds: number
    placed: { cue: string; at?: number; cents?: number; moveMs?: number; downDb?: number; riseMs?: number; press?: number }[]
    laid: { cue: string; state: string; kept: boolean; times: number; presses?: number; step?: number; varied?: boolean }[]
    typing: { keys: number; taps: number; withoutKey: number; keysWithoutTap: number; limitMs: number; largestOffsetMs: number; earliestMs: number; latestMs: number }
    skipped: { cue: string; why: string }[]
    music: { source: string; parts: { id: string; fromBar?: number; toBar?: number; centredByDb?: number }[] }
    landings: { at: number[]; beforeDb: number[]; trimsDb: number[]; afterDb: number[]; spreadDb: number }
    channels: { leftOverRightDb: number }
    master: { lufs: number; truePeakDb: number; silent: boolean; encoded: { truePeakDb: number; roomDb: number } | null }
  }
}
type Cut = Record<string, unknown>
type Lib = {
  RATE: number
  HAND_LIMIT_MS: number
  PEAK_MARGIN_DB: number
  LOUDNESS_BLOCK: number
  SHORT_CREST_DB: number
  MEASURES: Record<string, string>
  loudnessOf(a: Sound): { lufs: number; measure: string; seconds: number }
  cueSeconds(id: string): number | null
  planPack(o: { keptDir: string; mapsDir: string; laidDir?: string }): Plan
  APP_SEAM: { music: number; ambience: number }
  APP_SEAM_SHARE: number
  LAID_STATE: string
  SHAKE: { downDb: number; riseMs: number; moreDb: number; more: string[] }
  APP_TRIM_DB: Record<string, number>
  isShake(id: string): boolean
  shakeStepDb(id: string): number
  spriteSound(id: string, cls: string, a: Sound): { audio: Sound; gain: number; shake: Omit<ShakeOfPack, 'id'> | null } | null
  laidDirOf(keptDir: string): string
  readLaid(dir: string): { id: string; file: string | null; record: Record<string, unknown> }[]
  laidSound(id: string, dir: string): { file: string; audio: Sound; set: { presses: Sound[]; step: number; varied: boolean } | null } | null
  buildLaid(recipe: Record<string, unknown>, o: { takesDir?: string; keptDir?: string }): { audio: Sound; presses: { at: number; seconds: number; fromDb: number }[] | null; source: Record<string, unknown> }
  heardSeam(body: Sound, seamSeconds: number): Heard
  riseIn(a: Sound, seconds: number): Sound
  make(n: number, rate?: number): Sound
  seconds(a: Sound): number
  db(x: number): number
  lin(d: number): number
  encodeWav(a: Sound): Buffer
  parseWav(b: Buffer): Sound
  loudness(a: Sound): number
  truePeak(a: Sound): number
  peak(a: Sound): number
  slice(a: Sound, from: number, to?: number): Sound
  measure(a: Sound): Measured
  classOf(id: string): string
  levelOf(cls: string): number
  keepChain(a: Sound, cls: string, options?: Record<string, unknown>): Kept
  master(a: Sound, target: number, ceilingDb: number): { audio: Sound; lufs: number; truePeakDb: number; passes: number; reductionDb: number }
  mixFilm(o: { cut: Cut; which?: string; candidate?: string; keptDir?: string; laidDir?: string; mapsDir?: string; skip?: string[]; gains?: Record<string, number> }): Mixed
  sha256(b: Buffer): string
  KEPT: string
  levelDb(a: Sound, from?: number, to?: number): number
  channelsDb(a: Sound, from?: number, to?: number): number
  centre(a: Sound, most?: number): { audio: Sound; movedDb: number }
  musicBars(a: Sound, lines: number[]): { first: number; last: number; lastWhole: number; medianDb: number }
  loopEnds(a: Sound): Ends
  turnLoop(a: Sound): { audio: Sound; turnedSeconds: number; seam: Ends }
  encodedTruePeak(a: Sound): number | null
  encodedCopy(a: Sound): Sound | null
  giveWay(a: Sound, ceilingDb: number): { audio: Sound; encodedDb: number | null; places: { at: number; db: number }[] }
  layTogether(recipe: Record<string, unknown>, o: { takesDir: string; keptDir: string }): { audio: Sound; sha256: string; layers: { underMainDb: number; gainDb: number; levelDb: number; seconds: number; source: Record<string, unknown> }[] }
  MADE_UNDER_DB: number
  readJson(file: string): unknown
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
    // A run of key presses is laid as a hand types: each repeat keeps its place in the report and says by how many
    // milliseconds it was moved (never more than 20, the first not at all) and how far under one press alone it lies.
    const taps = a.report.placed.filter((p) => p.cue === 'key-tap')
    expect(taps.map((p) => p.at)).toEqual([0.2, 0.5])
    expect(taps.map((p) => p.moveMs)).toEqual([0, 14])
    expect(taps.map((p) => p.downDb)).toEqual([-9, -11.5])
    expect(a.report.placed.find((p) => p.cue === 'lift')!.moveMs).toBeUndefined()
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

// The faults the fresh review measured in the film's sound, built into four small tracks:
// a count-in before the winter music and a last bar that only rings out, a spring track that leans left,
// a summer track of plucked notes, a fall track that fades in.
const BARS = 12
const sing = (i: number, hz: number[]): number => hz.reduce((sum, f, k) => sum + Math.sin((2 * Math.PI * f * i) / rate + k) / (k + 1), 0)
const track = (f: (b: number, t: number, i: number) => [number, number], tail = 1.4): Sound => {
  const a = A.make(Math.round(((BARS - 1) * bar + tail) * rate), rate)
  for (let i = 0; i < a.L.length; i++) {
    const at = i / rate
    const b = Math.min(BARS - 1, Math.floor(at / bar))
    const [l, r] = f(b, at - b * bar, i)
    a.L[i] = l
    a.R[i] = r
  }
  return a
}
const winterLike = (): Sound =>
  track((b, t, i) => {
    const pad = 0.11 * sing(i, [220, 277, 330, 880, 1760]) * (1 + 0.2 * Math.sin(i / 9000))
    if (b === 0) {
      const u = t % 0.3
      const tick = u < 0.02 ? 0.12 * Math.sin((2 * Math.PI * 3000 * i) / rate) : 0
      return [tick, tick]
    }
    if (b === 1 && t < 0.3) return [pad * 0.02, pad * 0.02]
    if (b >= BARS - 2) {
      const v = 0.3 * sing(i, [220, 277, 330, 880]) * Math.exp(-(t + (b - (BARS - 2)) * bar) / 0.45)
      return [v, v]
    }
    return [pad, pad * 0.95]
  })
const pluckLike = (amp: number, decay: number, left: number, right: number, hz: number[]): Sound =>
  track((b, t, i) => {
    const beat = t % (bar / 4)
    const v = amp * Math.exp(-beat / decay) * sing(i, [hz[(b + Math.floor(t / (bar / 4))) % hz.length]!, 1320, 2640]) + 0.01 * sing(i, [330, 990])
    return [v * left, v * right]
  }, bar - 0.01)
const fallLike = (): Sound =>
  track((b, t, i) => {
    const pad = 0.12 * sing(i, [147, 233, 311, 932, 1870]) * (1 + 0.25 * Math.sin(i / 7000))
    if (b === 0) return [pad * (t / bar) ** 2, pad * (t / bar) ** 2]
    if (b >= BARS - 2) return [pad * Math.exp(-(t + (b - (BARS - 2)) * bar) / 0.3), pad * Math.exp(-(t + (b - (BARS - 2)) * bar) / 0.3)]
    return [pad, pad]
  })
const PER = 3
const SLOW = 300000
const filmCut = (): Cut => {
  const seasons = ['winter', 'spring', 'summer', 'fall', 'winter']
  const sections = seasons.map((season, k) => ({ season, from: k * PER * bar, to: (k + 1) * PER * bar }))
  const landings = sections.slice(1).map((sec) => Math.round(sec.from * config.film.fps))
  return {
    source: 'default-grid',
    bpm: config.film.defaultBpm,
    beatsPerBar: config.film.beatsPerBar,
    fps: config.film.fps,
    seconds: seasons.length * PER * bar,
    frameCount: Math.round(seasons.length * PER * bar * config.film.fps),
    landings,
    opening: { frameCount: 90, seconds: 1.5, cues: [{ cue: 'key-tap', frame: 12, at: 0.2 }] },
    cues: sections.slice(1).flatMap((sec) => [
      { cue: 'lift', at: sec.from - bar },
      { cue: `shake-${sec.season}`, at: sec.from - bar },
      { cue: `land-${sec.season}`, at: sec.from },
      { cue: 'glass-clink', at: sec.from },
    ]),
    ambience: sections.map((sec, k) => ({ cue: `amb-${sec.season}`, from: Math.max(0, sec.from - bar), to: sec.to, fadeIn: k ? bar : 0, fadeOut: k < seasons.length - 1 ? bar : 0 })),
    sections,
  }
}
const zeroRuns = (a: Sound, from = 0): { inside: number; atTheEnd: number } => {
  const bytes = A.parseWav(A.encodeWav(a))
  let run = 0
  let inside = 0
  for (let i = from; i < bytes.L.length; i++) {
    if (bytes.L[i] === 0 && bytes.R[i] === 0) run++
    else {
      inside = Math.max(inside, run)
      run = 0
    }
  }
  return { inside: inside / rate, atTheEnd: run / rate }
}
const filmNumbers = (m: Mixed, cut: Cut, offset = 0) => {
  const sections = cut.sections as { from: number; to: number }[]
  const at = (t: number): number => Math.round((t + offset) * rate)
  const landings = sections.slice(1).map((sec) => sec.from)
  const holds = sections.map((sec, k) => A.levelDb(m.audio, at(sec.from + bar / 2), at((k < sections.length - 1 ? sec.to - bar : sec.to) - bar / 4)))
  const open = landings.map((t) => A.levelDb(m.audio, at(t), at(t + 0.05)))
  const before = landings.map((t) => A.levelDb(m.audio, at(t - 0.2), at(t)))
  return { holds, open, before, firstSecond: A.levelDb(m.audio, at(0), at(1)), channels: A.channelsDb(m.audio), zeros: zeroRuns(m.audio, at(0)), lastHalfSecond: A.levelDb(m.audio, m.audio.L.length - rate / 2, m.audio.L.length), lastMoment: A.levelDb(m.audio, m.audio.L.length - 48, m.audio.L.length), momentBefore: A.levelDb(m.audio, m.audio.L.length - 4800, m.audio.L.length - 2400) }
}
const expectFilm = (n: ReturnType<typeof filmNumbers>, m: Mixed): void => {
  // (a) the last bar rings to the last sample and the fade ends on it
  expect(n.zeros.atTheEnd).toBeLessThan(0.001)
  expect(n.lastHalfSecond).toBeGreaterThan(-70)
  expect(n.lastMoment).toBeLessThan(n.momentBefore)
  // (b) no run of exact zero inside the body of the film, and no shake bar runs down to nothing
  expect(n.zeros.inside).toBeLessThan(0.002)
  for (const v of n.before) expect(v).toBeGreaterThan(-62)
  // (c) the four landings start alike
  expect(Math.max(...n.open) - Math.min(...n.open)).toBeLessThanOrEqual(2)
  // (d) the music is there from frame 0 of the body
  expect(Math.abs(n.firstSecond - Math.min(...n.holds))).toBeLessThan(6)
  expect(Math.abs(n.firstSecond - Math.max(...n.holds))).toBeLessThan(6)
  // (e) centred, at the film's loudness, under the ceiling as a wav and as the film's encoded sound
  expect(Math.abs(n.channels)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(A.loudness(m.audio) - config.audio.filmLoudnessLufs)).toBeLessThan(0.5)
  expect(A.db(A.truePeak(m.audio))).toBeLessThanOrEqual(config.audio.truePeakDb)
  expect(m.report.master.encoded).not.toBeNull()
  expect(m.report.master.encoded!.truePeakDb).toBeLessThanOrEqual(config.audio.truePeakDb)
}

describe('the film mix, by number', () => {
  let film = ''
  let one: Mixed
  beforeAll(() => {
    film = path.join(dir, 'film')
    fs.mkdirSync(film, { recursive: true })
    for (const id of ['lift', 'glass-clink', 'shake-spring', 'key-tap', 'amb-winter']) fs.copyFileSync(path.join(kept, `${id}.wav`), path.join(film, `${id}.wav`))
    const write = (id: string, a: Sound): void => {
      fs.writeFileSync(path.join(film, `${id}.wav`), A.encodeWav(a))
      fs.writeFileSync(path.join(film, `${id}.json`), JSON.stringify({ id, class: A.classOf(id) }))
    }
    write('music-winter', winterLike())
    write('music-spring', pluckLike(0.3, 0.25, 1, 0.4, [523, 659, 784, 988]))
    write('music-summer', pluckLike(0.45, 0.12, 1, 1, [392, 494, 587, 740]))
    write('music-fall', fallLike())
    one = A.mixFilm({ cut: filmCut(), candidate: 'four-tracks', keptDir: film, mapsDir: maps })
  }, SLOW)

  it('chooses the bars of each track by what they hold', () => {
    const lines = Array.from({ length: BARS - 1 }, (_, i) => i * bar)
    const winter = A.musicBars(winterLike(), lines)
    expect(winter.first).toBe(2)
    expect(winter.last).toBe(BARS - 2)
    expect(A.musicBars(fallLike(), lines).first).toBe(1)
    expect(A.musicBars(pluckLike(0.45, 0.12, 1, 1, [392]), lines).first).toBe(0)
    const parts = one.report.music.parts
    expect(parts.map((p) => p.id)).toEqual(['music-winter', 'music-spring', 'music-summer', 'music-fall', 'music-winter'])
    expect(parts[0]!.fromBar).toBe(2)
    expect(parts[3]!.fromBar).toBe(1)
    expect(parts[4]!.toBar).toBe(BARS - 2)
    expect(Math.abs(parts[1]!.centredByDb!)).toBeGreaterThan(6)
  })

  it('holds the numbers of the review: the end, the shake bars, the landings, frame 0, the channels and the peak', () => {
    expectFilm(filmNumbers(one, filmCut()), one)
    expect(one.report.landings.spreadDb).toBeLessThanOrEqual(2)
    expect(Math.max(...one.report.landings.beforeDb) - Math.min(...one.report.landings.beforeDb)).toBeGreaterThan(2)
  })

  // These mix a whole film and read its encoded copy, which is slow while the machine renders: the time allowed is long.
  it('holds them in film A too', () => {
    const a = A.mixFilm({ cut: filmCut(), which: 'a', candidate: 'four-tracks', keptDir: film, mapsDir: maps })
    expectFilm(filmNumbers(a, filmCut(), 1.5), a)
  }, SLOW)

  it('gives the same bytes and the same report twice', () => {
    const two = A.mixFilm({ cut: filmCut(), candidate: 'four-tracks', keptDir: film, mapsDir: maps })
    expect(A.encodeWav(one.audio).equals(A.encodeWav(two.audio))).toBe(true)
    expect(JSON.stringify(one.report)).toBe(JSON.stringify(two.report))
  }, SLOW)

  it('centres a track that leans to one side and keeps its two channels apart', () => {
    const lean = pluckLike(0.3, 0.25, 1, 0.4, [523, 659])
    expect(A.channelsDb(lean)).toBeGreaterThan(7)
    const c = A.centre(lean)
    expect(Math.abs(A.channelsDb(c.audio))).toBeLessThan(0.01)
    expect(Math.abs(A.levelDb(c.audio) - A.levelDb(lean))).toBeLessThan(0.01)
    expect(A.centre(c.audio).audio).toBe(c.audio)
  })

  const filmIsHere = config.seasons.every((s) => fs.existsSync(path.join(A.KEPT, `music-${s}.wav`))) && fs.existsSync('cut/CUTLIST.json')
  for (const which of ['b', 'a']) {
    it.skipIf(!filmIsHere)(`holds them on film ${which.toUpperCase()} itself when its tracks are in the workspace`, () => {
      const cut = A.readJson('cut/CUTLIST.json') as Cut
      const m = A.mixFilm({ cut, which, candidate: 'four-tracks' })
      expectFilm(filmNumbers(m, cut, which === 'a' ? Number((cut.opening as { seconds: number }).seconds) : 0), m)
      // Decision 144: one tap for each key of the cut list and none without a key, each beginning within 20 ms of the
      // time of its own key, and nothing sounds before the first cue of the opening.
      const cues = which === 'a' ? (cut.opening as { cues: { cue: string; at: number }[] }).cues : []
      const keys = cues.filter((c) => c.cue === 'key-tap')
      const t = m.report.typing
      expect(t.keys).toBe(keys.length)
      expect(t.withoutKey).toBe(0)
      expect(t.limitMs).toBe(20)
      expect(t.largestOffsetMs).toBeLessThanOrEqual(20)
      if (keys.length && !m.report.skipped.some((s) => s.cue === 'key-tap')) {
        expect(t.taps).toBe(keys.length)
        expect(t.keysWithoutTap).toBe(0)
        const first = Math.min(...cues.map((c) => Number(c.at)))
        if (first === Number(keys[0]!.at)) expect(A.peak(A.slice(m.audio, 0, Math.round(first * rate)))).toBe(0)
      }
    }, SLOW)
  }
})

describe("the app's loops, by number", () => {
  // The seam of src/audio/index.ts: one bar for music, 1.5 s for ambience, never more than a quarter of the loop.
  const seamOf = (l: Loop): number => Math.min(A.classOf(l.id) === 'music' ? bar : 1.5, l.loopSeconds * 0.25)
  // What the app sounds from a loop of the pack: each pass starts one seam before the pass in front of it ends, rises
  // over that seam as a sine while the other falls as a cosine, and the first pass starts at full level.
  const played = (l: Loop, passes: number): { audio: Sound; period: number; seam: number } => {
    const from = Math.round(l.loopStart * rate)
    const n = Math.round(l.loopSeconds * rate)
    const seam = Math.round(seamOf(l) * rate)
    const period = n - seam
    const out = A.make(period * passes + seam, rate)
    for (let p = 0; p < passes; p++) {
      for (let i = 0; i < n; i++) {
        let g = 1
        if (p > 0 && i < seam) g = Math.sin(((i + 0.5) / seam) * (Math.PI / 2))
        if (i >= period) g = Math.cos(((i - period + 0.5) / seam) * (Math.PI / 2))
        out.L[p * period + i] += l.audio.L[from + i]! * g
        out.R[p * period + i] += l.audio.R[from + i]! * g
      }
    }
    return { audio: out, period, seam }
  }
  const expectEnds = (l: Loop): void => {
    const from = Math.round(l.loopStart * rate)
    const body: Sound = { rate, L: l.audio.L.slice(from, from + Math.round(l.loopSeconds * rate)), R: l.audio.R.slice(from, from + Math.round(l.loopSeconds * rate)) }
    expect(A.seconds(l.audio)).toBeCloseTo(l.loopSeconds + 2 * l.loopStart, 3)
    // By the tool's own number and by the app's passes played here: the level through the cross against the loop's mean.
    const heard = A.heardSeam(body, seamOf(l))
    expect(heard.periodSeconds, `${l.id}: the heard period`).toBeCloseTo(l.loopSeconds - seamOf(l), 3)
    expect(Math.abs(heard.seamDb), `${l.id}: the level through the app's cross against the loop's mean`).toBeLessThanOrEqual(3)
    expect(l.heard.seamDb).toBeCloseTo(heard.seamDb, 1)
    const p = played(l, 3)
    expect(p.period / rate).toBeCloseTo(heard.periodSeconds, 3)
    let apart = 0
    for (let i = 0; i < p.period; i++) apart = Math.max(apart, Math.abs(p.audio.L[p.period + i]! - p.audio.L[2 * p.period + i]!))
    expect(apart, `${l.id}: the second pass and the third sound alike, sample for sample`).toBeLessThan(1e-9)
    const mean = A.levelDb(p.audio, p.period, 2 * p.period)
    expect(Math.abs(A.levelDb(p.audio, p.period, p.period + p.seam) - mean), `${l.id}: the crossed part as played`).toBeLessThanOrEqual(3)
    if (A.classOf(l.id) === 'music') {
      // A music loop is the track itself: its bars and then the track's own next bar for the cross. Nothing is wrapped.
      expect(l.seam).toBeNull()
      expect(l.bars).toBe(l.toBar! - l.fromBar! + 1)
      expect(l.tailSeconds!).toBeCloseTo(bar, 2)
      expect(l.periodSeconds!, `${l.id}: heard every ${l.bars} bars`).toBeCloseTo(l.bars! * bar, 2)
      expect(heard.periodSeconds).toBeCloseTo(l.periodSeconds!, 3)
      // No bar of the played loop falls out of the level of the others.
      for (let b = 0; b < l.bars!; b++) {
        const at = p.period + Math.round((b * p.period) / l.bars!)
        expect(Math.abs(A.levelDb(p.audio, at, at + Math.round(p.period / l.bars!)) - mean), `${l.id}: bar ${b} of the played loop`).toBeLessThanOrEqual(9)
      }
    } else {
      const ends = A.loopEnds(body)
      expect(Math.abs(ends.secondStepDb), `${l.id}: the last second against the first`).toBeLessThanOrEqual(3)
      expect(Math.abs(ends.levelStepDb), `${l.id}: the last 50 ms against the first`).toBeLessThanOrEqual(3)
      expect(ends.ratio, `${l.id}: the step across the seam against a usual step`).toBeLessThan(4)
    }
  }

  it('crosses a loop as the app does', () => {
    const src = fs.readFileSync(path.join(path.dirname(A.KEPT), '..', 'src', 'audio', 'index.ts'), 'utf8')
    expect(Number(/const AMB_SEAM = ([\d.]+)/.exec(src)?.[1])).toBe(A.APP_SEAM.ambience)
    expect(Number(/const SEAM_SHARE = ([\d.]+)/.exec(src)?.[1])).toBe(A.APP_SEAM_SHARE)
    expect(src).toContain("Math.min(kind === 'music' ? barSeconds : AMB_SEAM, loopSeconds * SEAM_SHARE)")
    expect(src).toContain('voice.next = t + length - seam')
    expect(A.APP_SEAM.music).toBeCloseTo(bar, 9)
  })

  it('gives every music loop its bars and the bar after them, heard as that many bars at one level', () => {
    const pack = path.join(dir, 'film')
    const crickets = A.make(Math.round(18.5 * rate), rate)
    for (let i = 0; i < crickets.L.length; i++) {
      const v = (((i / rate) % 0.4 < 0.25 ? 0.05 : 0.008) * Math.sin((2 * Math.PI * 4200 * i) / rate)) / (1 + 0.3 * Math.sin((2 * Math.PI * i) / crickets.L.length))
      crickets.L[i] = v
      crickets.R[i] = v
    }
    fs.writeFileSync(path.join(pack, 'amb-summer.wav'), A.encodeWav(crickets))
    fs.writeFileSync(path.join(pack, 'amb-summer.json'), JSON.stringify({ id: 'amb-summer', class: 'ambience' }))
    fs.writeFileSync(path.join(pack, 'amb-winter.json'), JSON.stringify({ id: 'amb-winter', class: 'ambience' }))
    const plan = A.planPack({ keptDir: pack, mapsDir: maps })
    expect(plan.notes).toEqual([])
    expect(plan.loops.map((l) => l.id).sort()).toEqual(['amb-summer', 'amb-winter', 'music-fall', 'music-spring', 'music-summer', 'music-winter'])
    for (const l of plan.loops) expectEnds(l)
    // The winter track counts in over bar 0 and only rings out from bar 10: the loop is eight bars of the music itself
    // and the bar the app crosses over its start is music too, so neither the count nor the ring is ever heard.
    const winter = plan.loops.find((l) => l.id === 'music-winter')!
    expect(winter.bars).toBe(8)
    expect(winter.fromBar).toBeGreaterThanOrEqual(1)
    expect(winter.toBar! + 1).toBeLessThan(BARS - 2)
    expect(winter.loopSeconds).toBeCloseTo(9 * bar, 2)
    expect(winter.loopSeconds - seamOf(winter)).toBeCloseTo(8 * bar, 2)
    const spring = plan.loops.find((l) => l.id === 'music-spring')!
    const from = Math.round(spring.loopStart * rate)
    expect(Math.abs(A.channelsDb(spring.audio, from, from + Math.round(spring.loopSeconds * rate)))).toBeLessThanOrEqual(0.5)
    const again = A.planPack({ keptDir: pack, mapsDir: maps })
    for (const [k, l] of plan.loops.entries()) expect(A.encodeWav(l.audio).equals(A.encodeWav(again.loops[k]!.audio))).toBe(true)
  })

  it('turns an ambience that pulses so that its ends fall in a level place', () => {
    const a = A.make(Math.round(6 * rate), rate)
    for (let i = 0; i < a.L.length; i++) {
      const v = ((i / rate) % 0.5 < 0.2 ? 0.1 : 0.01) * Math.sin((2 * Math.PI * 3000 * i) / rate)
      a.L[i] = v
      a.R[i] = v
    }
    expect(Math.abs(A.loopEnds(a).levelStepDb)).toBeGreaterThan(3)
    const t = A.turnLoop(a)
    expect(t.turnedSeconds).toBeGreaterThan(0)
    expect(Math.abs(t.seam.levelStepDb)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(t.seam.secondStepDb)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(A.levelDb(t.audio) - A.levelDb(a))).toBeLessThan(0.001)
    const level = A.keepChain(noise(24, 0.3, 19), 'ambience').audio
    expect(A.turnLoop(level).turnedSeconds).toBe(0)
  })

  it.skipIf(!config.seasons.every((s) => fs.existsSync(path.join(A.KEPT, `music-${s}.wav`))))('holds on the loops of the app itself when its tracks are in the workspace', () => {
    const plan = (A.planPack as unknown as () => Plan)()
    expect(plan.loops.length).toBeGreaterThanOrEqual(4)
    for (const l of plan.loops) expectEnds(l)
  })
})

describe('the encoded copy of the mix', () => {
  // A quiet bed with three hard bursts cut flat at the ceiling: the encoder throws peaks above them.
  const hard = (): Sound => {
    const a = tone(330, 3, A.lin(-30))
    const top = A.lin(config.audio.truePeakDb - 0.2)
    for (const at of [0.5, 1.4, 2.3]) {
      const from = Math.round(at * rate)
      for (let i = 0; i < Math.round(0.06 * rate); i++) {
        const v = Math.max(-top, Math.min(top, 1.6 * top * (Math.sin((2 * Math.PI * 900 * i) / rate) + 0.5 * Math.sin((2 * Math.PI * 3100 * i) / rate))))
        a.L[from + i] = v
        a.R[from + i] = -v * 0.9
      }
    }
    return a
  }

  it('comes back in step with the wav', () => {
    const a = tone(440, 1.5, 0.3)
    for (let i = 0; i < a.L.length; i++) a.R[i] = a.L[i]! * (i < rate / 2 ? 0.1 : 1)
    const back = A.encodedCopy(a)!
    expect(back.L.length).toBe(a.L.length)
    let worst = 0
    for (let i = rate / 4; i < a.L.length - rate / 4; i++) worst = Math.max(worst, Math.abs(back.L[i]! - a.L[i]!))
    expect(worst).toBeLessThan(0.02)
  })

  it('makes the wav give way only where the copy stands over the limit', () => {
    const a = hard()
    const ceiling = config.audio.truePeakDb
    expect(A.db(A.truePeak(a))).toBeLessThanOrEqual(ceiling + 0.3)
    expect(A.encodedTruePeak(a)!).toBeGreaterThan(ceiling)
    const fit = A.giveWay(a, ceiling)
    expect(fit.places.length).toBeGreaterThan(0)
    expect(fit.encodedDb!).toBeLessThanOrEqual(ceiling)
    expect(A.encodedTruePeak(fit.audio)!).toBeLessThanOrEqual(ceiling)
    for (const p of fit.places) expect([0.5, 1.4, 2.3].some((t) => p.at > t - 0.02 && p.at < t + 0.09)).toBe(true)
    // the bed between the bursts is the same sample for sample
    for (const t of [0.2, 1.0, 1.9, 2.7]) {
      const i = Math.round(t * rate)
      expect(fit.audio.L[i]).toBe(a.L[i])
    }
    const again = A.giveWay(a, ceiling)
    expect(A.encodeWav(again.audio).equals(A.encodeWav(fit.audio))).toBe(true)
  })

  it('leaves a mix alone whose copy is under the limit', () => {
    const a = tone(440, 1, 0.3)
    const fit = A.giveWay(a, config.audio.truePeakDb)
    expect(fit.places).toEqual([])
    expect(fit.audio).toBe(a)
  })
})

describe('laying sounds together', () => {
  let takes = ''
  const recipe = (underMade: number): Record<string, unknown> => ({
    cue: 'shake-summer',
    seconds: 2.6,
    layers: [
      { kept: 'shake-spring', cents: -70 },
      { take: 1, underDb: 8, at: 0.2, lowCutHz: 800, fadeInMs: 5, fadeOutMs: 60 },
      { made: 'noise', fromHz: 3000, toHz: 9000, seconds: 1, seed: 5, underDb: underMade, at: 0.4, fadeInMs: 100, fadeOutMs: 300 },
      { made: 'tone', hz: 110, seconds: 1.2, underDb: underMade + 2, at: 1, fadeInMs: 50, fadeOutMs: 400 },
    ],
  })
  beforeAll(() => {
    takes = path.join(dir, 'takes')
    fs.mkdirSync(path.join(takes, 'shake-summer'), { recursive: true })
    fs.writeFileSync(path.join(takes, 'shake-summer', 'take-1.wav'), A.encodeWav(burst(1.2, 0.1, 0.9, -6, 29)))
  })

  it('gives the same bytes from the same recipe, each layer at its level under the main one', () => {
    const one = A.layTogether(recipe(14), { takesDir: takes, keptDir: kept })
    const two = A.layTogether(recipe(14), { takesDir: takes, keptDir: kept })
    expect(one.sha256).toBe(two.sha256)
    expect(A.encodeWav(one.audio).equals(A.encodeWav(two.audio))).toBe(true)
    expect(A.seconds(one.audio)).toBeCloseTo(2.6, 3)
    expect(one.layers.map((l) => l.underMainDb)).toEqual([0, 8, 14, 16])
    const main = one.layers[0]!.levelDb
    expect(one.layers[1]!.levelDb).toBeCloseTo(main - 8, 1)
    expect(one.layers[2]!.levelDb).toBeCloseTo(main - 14, 1)
    expect(one.layers[3]!.levelDb).toBeCloseTo(main - 16, 1)
    expect(one.layers[0]!.source).toMatchObject({ kept: 'shake-spring' })
    expect(one.layers[1]!.source).toMatchObject({ cue: 'shake-summer', take: 1 })
    expect(one.layers[2]!.source).toEqual({ made: 'noise' })
    const other = A.layTogether({ ...recipe(14), layers: (recipe(14).layers as Record<string, unknown>[]).map((l, k) => (k === 1 ? { ...l, underDb: 9 } : l)) }, { takesDir: takes, keptDir: kept })
    expect(other.sha256).not.toBe(one.sha256)
  })

  it('refuses a made layer nearer than 12 dB to the main layer, or as the main layer', () => {
    expect(A.MADE_UNDER_DB).toBe(12)
    expect(() => A.layTogether(recipe(11.9), { takesDir: takes, keptDir: kept })).toThrow(/quiet support/)
    expect(() => A.layTogether({ cue: 'amb-fall', layers: [{ made: 'tone', hz: 110, seconds: 2 }] }, { takesDir: takes, keptDir: kept })).toThrow(/main/)
    expect(() => A.layTogether({ cue: 'shake-summer', layers: [{ kept: 'shake-spring' }, { take: 9, underDb: 6 }] }, { takesDir: takes, keptDir: kept })).toThrow(/not in this workspace/)
  })
})

// Decision 141 of kit/PROGRESS.md. Where every allowed take of a cue is used and none is kept, the nearest right sound
// may be laid in its place. It is not a kept take: its record lies in laid/ beside the kept folder and never in it, its
// cue stays open, and every report names it as laid and not kept.
describe('sounds laid by decision 141', () => {
  const HZ = [500, 700, 900, 1100]
  let ownKept = ''
  let ownLaid = ''
  let takes = ''
  const water = (): string => `${A.LAID_STATE}, the water of shake-spring`
  const setOf = (varied: boolean): Record<string, unknown> => ({
    set: { cue: 'key-tap', take: 7, windows: HZ.map((_, k) => [0.09 + 0.2 * k, 0.19 + 0.2 * k]), highCutHz: 2500, highCutEndHz: 3500, fadeInMs: 2, fadeOutMs: 30, pressDb: -30 },
    step: 3,
    varied,
  })
  const lay = (id: string, recipe: Record<string, unknown>, state = A.LAID_STATE): void => {
    const built = A.buildLaid(recipe, { takesDir: takes, keptDir: ownKept })
    fs.writeFileSync(path.join(ownLaid, `${id}.wav`), A.encodeWav(built.audio))
    fs.writeFileSync(path.join(ownLaid, `${id}.json`), JSON.stringify({ id, state, kept: false, recipe, ...(built.presses ? { presses: built.presses } : {}) }))
  }
  const typed = (): Cut => ({
    ...cutOf(),
    opening: { frameCount: 90, seconds: 1.5, cues: Array.from({ length: 6 }, (_, k) => ({ cue: 'key-tap', frame: 6 + 12 * k, at: 0.1 + 0.2 * k })) },
    cues: [...(cutOf().cues as Record<string, unknown>[]), { cue: 'shake-summer', frame: 0, at: 3 * bar }],
  })
  // Which of the four tones a stretch of sound holds: that is the press that lies there.
  const toneOf = (a: Sound, from: number, n: number): number => {
    const power = HZ.map((hz) => {
      let re = 0
      let im = 0
      for (let i = 0; i < n; i++) {
        re += a.L[from + i]! * Math.cos((2 * Math.PI * hz * i) / rate)
        im += a.L[from + i]! * Math.sin((2 * Math.PI * hz * i) / rate)
      }
      return re * re + im * im
    })
    return power.indexOf(Math.max(...power))
  }

  beforeAll(() => {
    const own = path.join(dir, 'own')
    ownKept = path.join(own, 'kept')
    ownLaid = path.join(own, 'laid')
    takes = path.join(own, 'takes')
    fs.mkdirSync(ownKept, { recursive: true })
    fs.mkdirSync(ownLaid, { recursive: true })
    fs.mkdirSync(path.join(takes, 'key-tap'), { recursive: true })
    for (const n of fs.readdirSync(kept)) if (!n.startsWith('key-tap')) fs.copyFileSync(path.join(kept, n), path.join(ownKept, n))
    // One take that holds four presses, each a different tone at a different level.
    const take = A.make(Math.round(0.9 * rate), rate)
    HZ.forEach((hz, k) => {
      const from = Math.round((0.1 + 0.2 * k) * rate)
      for (let i = 0; i < Math.round(0.08 * rate); i++) {
        const v = 0.1 * (k + 1) * Math.sin((2 * Math.PI * hz * i) / rate) * Math.exp(-i / (0.03 * rate))
        take.L[from + i] = v
        take.R[from + i] = v
      }
    })
    fs.writeFileSync(path.join(takes, 'key-tap', 'take-7.wav'), A.encodeWav(take))
    lay('key-tap', setOf(false))
    lay('shake-summer', { borrow: { kept: 'shake-spring', cents: -110 } }, water())
  })

  it('builds a set of presses levelled alike and a borrow at its pitch, the same bytes twice', () => {
    expect(A.laidDirOf(ownKept)).toBe(ownLaid)
    const one = A.buildLaid(setOf(false), { takesDir: takes, keptDir: ownKept })
    const two = A.buildLaid(setOf(false), { takesDir: takes, keptDir: ownKept })
    expect(A.encodeWav(one.audio).equals(A.encodeWav(two.audio))).toBe(true)
    expect(one.presses!.length).toBe(4)
    expect(one.source).toMatchObject({ cue: 'key-tap', take: 7 })
    // In the take the first press and the last lie 12 dB apart; in the set every press is at the level of the recipe.
    expect(one.presses![3]!.fromDb - one.presses![0]!.fromDb).toBeGreaterThan(11)
    const l = A.laidSound('key-tap', ownLaid)!
    expect(l.set!.step).toBe(3)
    expect(l.set!.varied).toBe(false)
    expect(l.set!.presses.length).toBe(4)
    for (const [k, p] of l.set!.presses.entries()) {
      expect(A.levelDb(p)).toBeCloseTo(-30, 1)
      expect(toneOf(p, 0, p.L.length)).toBe(k)
    }
    const spring = A.parseWav(fs.readFileSync(path.join(ownKept, 'shake-spring.wav')))
    const low = A.buildLaid({ borrow: { kept: 'shake-spring', cents: -110 } }, { keptDir: ownKept })
    const high = A.buildLaid({ borrow: { kept: 'shake-spring', cents: 40 } }, { keptDir: ownKept })
    expect(A.seconds(low.audio) / A.seconds(spring)).toBeCloseTo(2 ** (110 / 1200), 3)
    expect(A.seconds(high.audio) / A.seconds(spring)).toBeCloseTo(2 ** (-40 / 1200), 3)
    expect(low.source).toMatchObject({ kept: 'shake-spring' })
    expect(() => A.buildLaid({ borrow: { kept: 'shake-nowhere', cents: 0 } }, { keptDir: ownKept })).toThrow(/not in this workspace/)
    expect(() => A.buildLaid({}, { keptDir: ownKept })).toThrow(/recipe.borrow or recipe.set/)
  })

  it('lays the presses of a set in turn at their own level and names the cue as laid, not kept', () => {
    const one = A.mixFilm({ cut: typed(), which: 'a', candidate: 'blockout', keptDir: ownKept, mapsDir: maps })
    const two = A.mixFilm({ cut: typed(), which: 'a', candidate: 'blockout', keptDir: ownKept, mapsDir: maps })
    expect(A.encodeWav(one.audio).equals(A.encodeWav(two.audio))).toBe(true)
    expect(JSON.stringify(one.report)).toBe(JSON.stringify(two.report))
    const taps = one.report.placed.filter((p) => p.cue === 'key-tap')
    expect(taps.map((p) => p.press)).toEqual([0, 3, 2, 1, 0, 3])
    expect(taps.map((p) => p.cents)).toEqual([0, 0, 0, 0, 0, 0])
    expect(taps.map((p) => p.moveMs)).toEqual([0, 14, -9, 18, -16, 6])
    // The level of a set is in its record, so the 9 dB one kept press is turned down by are not taken off again.
    expect(taps.map((p) => p.downDb)).toEqual([0, -2.5, -1, -4, -0.5, -3])
    expect(one.report.skipped.map((s) => s.cue)).not.toContain('key-tap')
    expect(one.report.laid.find((l) => l.cue === 'key-tap')).toEqual({ cue: 'key-tap', state: A.LAID_STATE, kept: false, times: 6, presses: 4, step: 3, varied: false })
    // Decision 144: the taps against the keys. One for each key, none without one, none further than 20 ms from its own.
    expect(A.HAND_LIMIT_MS).toBe(20)
    expect(one.report.typing).toEqual({ keys: 6, taps: 6, withoutKey: 0, keysWithoutTap: 0, limitMs: 20, largestOffsetMs: 18, earliestMs: -16, latestMs: 18 })
    expect(A.mixFilm({ cut: typed(), which: 'b', candidate: 'blockout', keptDir: ownKept, mapsDir: maps }).report.typing).toMatchObject({ keys: 0, taps: 0, withoutKey: 0, largestOffsetMs: 0 })
    expect(A.mixFilm({ cut: typed(), which: 'a', candidate: 'blockout', keptDir: ownKept, mapsDir: maps, skip: ['key-tap'] }).report.typing).toMatchObject({ keys: 6, taps: 0, withoutKey: 0, keysWithoutTap: 6 })
    // In the sound itself: each tap holds the tone of its press and lies under the first by what the hand takes off.
    const n = Math.round(0.1 * rate)
    const at = taps.map((p) => Math.round((p.at! + p.moveMs! / 1000) * rate))
    const first = A.levelDb(one.audio, at[0]!, at[0]! + n)
    for (const [k, p] of taps.entries()) {
      expect(toneOf(one.audio, at[k]!, n)).toBe(p.press)
      expect(A.levelDb(one.audio, at[k]!, at[k]! + n) - first).toBeCloseTo(p.downDb!, 1)
    }
  })

  it('uses the pitch offsets on a set only when its record says so', () => {
    lay('key-tap', setOf(true))
    const m = A.mixFilm({ cut: typed(), which: 'a', candidate: 'blockout', keptDir: ownKept, mapsDir: maps })
    lay('key-tap', setOf(false))
    const taps = m.report.placed.filter((p) => p.cue === 'key-tap')
    expect(taps.map((p) => p.cents)).toEqual([0, -45, 30, -20, 55, -65])
    expect(taps.map((p) => p.press)).toEqual([0, 3, 2, 1, 0, 3])
    expect(m.report.laid.find((l) => l.cue === 'key-tap')!.varied).toBe(true)
  })

  it('lets a kept take win over a laid sound and never counts a laid sound as kept', () => {
    // The folder kept/ of this file holds a kept key press: beside the same laid folder nothing of the set is used.
    const m = A.mixFilm({ cut: typed(), which: 'a', candidate: 'blockout', keptDir: kept, laidDir: ownLaid, mapsDir: maps })
    const taps = m.report.placed.filter((p) => p.cue === 'key-tap')
    expect(taps.length).toBe(6)
    expect(taps.every((p) => p.press === undefined)).toBe(true)
    expect(taps.slice(0, 2).map((p) => p.downDb)).toEqual([-9, -11.5])
    expect(m.report.laid.map((l) => l.cue)).toEqual(['shake-summer'])
    expect(m.report.laid.every((l) => l.kept === false && l.state.startsWith(A.LAID_STATE))).toBe(true)
    // With no laid folder the cue is silent and named, as it was before the decision.
    const none = A.mixFilm({ cut: typed(), which: 'a', candidate: 'blockout', keptDir: ownKept, laidDir: path.join(dir, 'nothing-laid'), mapsDir: maps })
    expect(none.report.skipped.map((s) => s.cue)).toEqual(expect.arrayContaining(['key-tap', 'shake-summer']))
    expect(none.report.laid).toEqual([])
    // A record whose state does not begin with the words of the decision is not a laid sound.
    const odd = path.join(dir, 'odd-laid')
    fs.mkdirSync(odd, { recursive: true })
    fs.copyFileSync(path.join(ownLaid, 'shake-summer.wav'), path.join(odd, 'shake-summer.wav'))
    fs.writeFileSync(path.join(odd, 'shake-summer.json'), JSON.stringify({ id: 'shake-summer', state: 'kept', recipe: { borrow: { kept: 'shake-spring', cents: -110 } } }))
    expect(A.laidSound('shake-summer', odd)).toBeNull()
    expect(A.readLaid(odd)).toEqual([])
  })

  it('places a borrowed shake in the film and in the pack as laid, and leaves a set of presses to the film', () => {
    const m = A.mixFilm({ cut: typed(), which: 'b', candidate: 'blockout', keptDir: ownKept, mapsDir: maps })
    expect(m.report.placed.map((p) => p.cue)).toContain('shake-summer')
    expect(m.report.skipped.map((s) => s.cue)).not.toContain('shake-summer')
    expect(m.report.laid).toEqual([{ cue: 'shake-summer', state: water(), kept: false, times: 1 }])
    const without = A.mixFilm({ cut: typed(), which: 'b', candidate: 'blockout', keptDir: ownKept, laidDir: path.join(dir, 'nothing-laid'), mapsDir: maps })
    expect(A.encodeWav(m.audio).equals(A.encodeWav(without.audio))).toBe(false)
    const plan = A.planPack({ keptDir: ownKept, mapsDir: maps })
    expect(plan.laid).toEqual([{ id: 'shake-summer', state: water() }])
    const laid = A.parseWav(fs.readFileSync(path.join(ownLaid, 'shake-summer.wav')))
    expect(plan.sprite.entries['shake-summer']!.seconds).toBeCloseTo(A.seconds(laid), 3)
    expect(plan.sprite.entries['key-tap']).toBeUndefined()
    // A laid shake takes the film's step and its rise in the pack as a kept one does (decision 146).
    expect(plan.shakes.map((s) => s.id)).toEqual(['shake-summer'])
    expect(plan.shakes[0]).toMatchObject({ stepDb: A.shakeStepDb('shake-summer'), appDb: A.APP_TRIM_DB.impact! + A.shakeStepDb('shake-summer'), riseMs: A.SHAKE.riseMs, gain: plan.sprite.entries['shake-summer']!.gain })
    expect(Object.keys(A.planPack({ keptDir: ownKept, laidDir: path.join(dir, 'nothing-laid'), mapsDir: maps }).sprite.entries)).not.toContain('shake-summer')
  })

  // Decision 142: in its own bar the shake was called too loud or abrupt against the music, so the film brings every
  // shake down and lets it rise from nothing, kept or laid alike.
  it('brings every shake of the film down and lets it rise over its first moment', () => {
    expect(A.SHAKE.downDb).toBe(3)
    expect(A.SHAKE.riseMs).toBe(30)
    const m = A.mixFilm({ cut: typed(), which: 'b', candidate: 'blockout', keptDir: ownKept, mapsDir: maps })
    const shakes = m.report.placed.filter((p) => p.cue.startsWith('shake-'))
    expect(shakes.map((p) => p.cue)).toEqual(['shake-spring', 'shake-summer'])
    for (const p of shakes) {
      expect(p.downDb).toBe(-(A.SHAKE.downDb + (A.SHAKE.more.includes(p.cue) ? A.SHAKE.moreDb : 0)))
      expect(p.riseMs).toBe(A.SHAKE.riseMs)
    }
    expect(m.report.placed.find((p) => p.cue === 'lift')!.downDb).toBeUndefined()
    const a = noise(1, 0.3, 11)
    const before = Float64Array.from(a.L)
    const r = A.riseIn(a, 0.03)
    const n = Math.round(0.03 * rate)
    expect(a.L).toEqual(before)
    expect(A.levelDb(r, 0, n >> 2)).toBeLessThan(A.levelDb(a, 0, n >> 2) - 12)
    expect(A.levelDb(r, n >> 1, n)).toBeGreaterThan(A.levelDb(a, n >> 1, n) - 3)
    for (let i = n; i < a.L.length; i += 997) expect(r.L[i]).toBe(a.L[i])
  })
})

// Decision 146 of kit/PROGRESS.md: the app keeps the film's distances between every sound that plays in a shake, at
// its own lower level. Touch and impact take the music's trim, as the ambience did; a shake takes the film's own step
// on top, from the one constant SHAKE, and rises over its first moment in the sprite's own audio.
describe("the app's pack keeps the film's balance of a shake", () => {
  // Decided by listening (audio/RECIPE.md, decision 146): the press's tick and the chime stay at their kept level.
  const INTERFACE_DB = 0
  let own = ''
  let plan: Plan
  const keptOf = (id: string): Sound => A.parseWav(fs.readFileSync(path.join(own, `${id}.wav`)))
  // What the app sounds of one entry: its stretch of the sprite at the entry's gain.
  const cutOut = (p: Plan, id: string): Sound => {
    const e = p.sprite.entries[id]!
    const from = Math.round(e.start * rate)
    const n = Math.round(e.seconds * rate)
    const o = A.make(n, rate)
    for (let i = 0; i < n; i++) {
      o.L[i] = p.sprite.audio!.L[from + i]! * e.gain
      o.R[i] = p.sprite.audio!.R[from + i]! * e.gain
    }
    return o
  }
  const played = (id: string): Sound => cutOut(plan, id)
  const riseSamples = (): number => Math.round((A.SHAKE.riseMs / 1000) * rate)

  beforeAll(() => {
    own = path.join(dir, 'balance')
    fs.mkdirSync(own, { recursive: true })
    for (const n of fs.readdirSync(kept)) fs.copyFileSync(path.join(kept, n), path.join(own, n))
    const put = (id: string, source: Sound, options?: Record<string, unknown>): void => fs.writeFileSync(path.join(own, `${id}.wav`), A.encodeWav(A.keepChain(source, A.classOf(id), options).audio))
    put('shake-fall', noise(2.2, 0.4, 5))
    // A track long enough for the app's loop of music, and steady, so any stretch of it has the level of the whole.
    put('music-winter', tone(220, 12 * bar, 0.4))
    put('ui-tick', burst(0.48, 0.15, 0.06, -8, 37), { capSeconds: A.cueSeconds('ui-tick') })
    // The pack holds what has a record, so each sound of this folder gets one.
    for (const n of fs.readdirSync(own)) {
      const id = path.basename(n, '.wav')
      if (n.endsWith('.wav')) fs.writeFileSync(path.join(own, `${id}.json`), JSON.stringify({ id, class: A.classOf(id) }))
    }
    plan = A.planPack({ keptDir: own, mapsDir: maps, laidDir: path.join(dir, 'nothing-laid') })
  })

  it('trims touch and impact as the music and the ambience, and takes the step of a shake from the one rule of the film', () => {
    expect(A.APP_TRIM_DB.music).toBe(-8)
    for (const cls of ['ambience', 'touch', 'impact']) expect(A.APP_TRIM_DB[cls], cls).toBe(A.APP_TRIM_DB.music)
    expect(A.APP_TRIM_DB.interface).toBe(INTERFACE_DB)
    for (const season of config.seasons) {
      const id = `shake-${season}`
      expect(A.isShake(id), id).toBe(true)
      expect(A.shakeStepDb(id), id).toBe(-(A.SHAKE.downDb + (A.SHAKE.more.includes(id) ? A.SHAKE.moreDb : 0)))
    }
    expect(A.shakeStepDb('shake-spring')).toBe(-3)
    expect(A.shakeStepDb('shake-fall')).toBe(-6)
    for (const id of ['lift', 'glass-clink', 'land-spring', 'ui-tick', 'music-box', 'amb-winter', 'music-winter']) {
      expect(A.isShake(id), id).toBe(false)
      expect(A.shakeStepDb(id), id).toBe(0)
    }
    // The film asks the same rule: what its report says it took off each shake is that step.
    const cut = { ...cutOf(), cues: [...(cutOf().cues as Record<string, unknown>[]), { cue: 'shake-fall', frame: 0, at: 3 * bar }] }
    const m = A.mixFilm({ cut, which: 'b', candidate: 'blockout', keptDir: own, mapsDir: maps, laidDir: path.join(dir, 'nothing-laid') })
    const shakes = m.report.placed.filter((p) => A.isShake(p.cue))
    expect(shakes.map((p) => p.cue).sort()).toEqual(['shake-fall', 'shake-spring'])
    for (const p of shakes) expect(p.downDb, p.cue).toBe(A.shakeStepDb(p.cue))
  })

  it('sounds the lift, the clink and the landing 8 dB under their kept level, a shake 11 and the shake of fall 14', () => {
    const under = (id: string, from = 0): number => A.levelDb(played(id), from) - A.levelDb(keptOf(id), from)
    expect(under('lift')).toBeCloseTo(-8, 1)
    expect(under('glass-clink')).toBeCloseTo(-8, 1)
    expect(under('land-spring')).toBeCloseTo(-8, 1)
    expect(under('shake-spring', riseSamples())).toBeCloseTo(-11, 1)
    expect(under('shake-fall', riseSamples())).toBeCloseTo(-14, 1)
    expect(under('ui-tick')).toBeCloseTo(INTERFACE_DB, 1)
    // So the distances inside a shake are the film's: there the lift lies at its kept level and a shake 3 dB (fall 6)
    // under its own, and here the lift sounds 3 dB (fall 6) over the shake by the same measure.
    expect(under('lift') - under('shake-spring', riseSamples())).toBeCloseTo(-A.shakeStepDb('shake-spring'), 1)
    expect(under('lift') - under('shake-fall', riseSamples())).toBeCloseTo(-A.shakeStepDb('shake-fall'), 1)
    expect(under('glass-clink') - under('lift')).toBeCloseTo(0, 1)
    // The loops sound at the music's trim under their kept level, as before the decision: these two are steady, so
    // any stretch of them has the level of the whole.
    for (const l of plan.loops) {
      const from = Math.round(l.loopStart * rate)
      const sounded = A.levelDb(l.audio, from, from + Math.round(l.loopSeconds * rate)) + A.db(l.gain)
      expect(sounded - A.levelDb(keptOf(l.id)), l.id).toBeGreaterThan(A.APP_TRIM_DB.music! - 0.5)
      expect(sounded - A.levelDb(keptOf(l.id)), l.id).toBeLessThan(A.APP_TRIM_DB.music! + 0.5)
    }
  })

  it('lets a shake rise from nothing in the sprite itself and leaves every other sound as it was kept', () => {
    const k = keptOf('shake-spring')
    const n = riseSamples()
    const p = played('shake-spring')
    const down = A.lin(A.APP_TRIM_DB.impact! + A.shakeStepDb('shake-spring'))
    // The film's own rise, sample for sample, and after it the kept sound at the app's level.
    const risen = A.riseIn(k, A.SHAKE.riseMs / 1000)
    for (let i = 0; i < k.L.length; i += 53) expect(p.L[i]!).toBeCloseTo(risen.L[i]! * down, 4)
    for (let i = n; i < k.L.length; i += 997) expect(p.L[i]!).toBeCloseTo(k.L[i]! * down, 4)
    expect(A.levelDb(p, 0, n >> 2)).toBeLessThan(A.levelDb(k, 0, n >> 2) + A.db(down) - 12)
    const one = A.spriteSound('shake-spring', 'impact', k)!
    expect(one.shake).toEqual({ class: 'impact', trimDb: A.APP_TRIM_DB.impact, stepDb: -3, appDb: -11, riseMs: A.SHAKE.riseMs, gain: one.gain })
    expect(one.gain).toBe(plan.sprite.entries['shake-spring']!.gain)
    const lift = keptOf('lift')
    // Every copy in the sprite has its peak at one height, a shake's after its rise, so each gain puts back what sounds.
    expect(A.db(A.peak(one.audio))).toBeCloseTo(A.db(A.peak(A.spriteSound('lift', 'touch', lift)!.audio)), 6)
    const sounded = played('lift')
    for (let i = 0; i < lift.L.length; i += 97) expect(sounded.L[i]!).toBeCloseTo(lift.L[i]! * A.lin(A.APP_TRIM_DB.touch!), 4)
    expect(A.spriteSound('lift', 'touch', lift)!.shake).toBeNull()
    expect(A.spriteSound('lift', 'touch', A.make(64, rate))).toBeNull()
  })

  it('says in the plan what the gain of each shake is made of', () => {
    expect(plan.trimsDb).toEqual({ ...A.APP_TRIM_DB })
    expect(plan.shakes.map((s) => s.id).sort()).toEqual(['shake-fall', 'shake-spring'])
    for (const s of plan.shakes) {
      expect(s).toMatchObject({ class: 'impact', trimDb: A.APP_TRIM_DB.impact, stepDb: A.shakeStepDb(s.id), appDb: A.APP_TRIM_DB.impact! + A.shakeStepDb(s.id), riseMs: A.SHAKE.riseMs })
      expect(s.gain).toBe(plan.sprite.entries[s.id]!.gain)
    }
    expect(plan.shakes.find((s) => s.id === 'shake-fall')!.appDb).toBe(-14)
    expect(plan.shakes.find((s) => s.id === 'shake-spring')!.appDb).toBe(-11)
  })

  it('rests on the app playing an entry at its gain and making the stir from the entry of the shake', () => {
    const src = fs.readFileSync(path.join(path.dirname(A.KEPT), '..', 'src', 'audio', 'index.ts'), 'utf8')
    // An entry sounds at its gain times what the call asks, so the step in the gain is the step that sounds.
    expect(src).toContain('const level = entry.gain * (o.gain ?? 1)')
    // The stir is the shake's own entry, slowed and low-passed, at a share of its gain: it follows the entry.
    expect(src).toMatch(/play\(CUE\.shake\(season\), \{ gain: /)
  })

  const real = config.seasons.every((s) => fs.existsSync(path.join(A.KEPT, `music-${s}.wav`)))
  it.skipIf(!real)("holds in the app's own pack, with room over the highest sum a shake can reach, since the app has no limiter", () => {
    const pack = (A.planPack as unknown as () => Plan)()
    expect(pack.trimsDb).toEqual({ ...A.APP_TRIM_DB })
    expect(pack.shakes.map((s) => s.id).sort()).toEqual(config.seasons.map((s) => `shake-${s}`).sort())
    for (const s of pack.shakes) {
      expect(s.appDb, s.id).toBe(A.APP_TRIM_DB.impact! + A.shakeStepDb(s.id))
      expect(s.gain, s.id).toBe(pack.sprite.entries[s.id]!.gain)
      // A shake is over before the bar it is played in: the landing's sounds never meet it.
      expect(pack.sprite.entries[s.id]!.seconds, s.id).toBeLessThan(bar)
    }
    // The highest a loop sounds in the app: its passes crossed as the app crosses them, at its gain.
    const seamOf = (l: Loop): number => Math.min(A.classOf(l.id) === 'music' ? bar : A.APP_SEAM.ambience, l.loopSeconds * A.APP_SEAM_SHARE)
    const top = (id: string): number => {
      const l = pack.loops.find((x) => x.id === id)!
      const from = Math.round(l.loopStart * rate)
      const n = Math.round(l.loopSeconds * rate)
      const seam = Math.round(seamOf(l) * rate)
      const period = n - seam
      const out = A.make(period * 2 + seam, rate)
      for (let p = 0; p < 2; p++) {
        for (let i = 0; i < n; i++) {
          let g = l.gain
          if (p > 0 && i < seam) g *= Math.sin(((i + 0.5) / seam) * (Math.PI / 2))
          if (i >= period) g *= Math.cos(((i - period + 0.5) / seam) * (Math.PI / 2))
          out.L[p * period + i] += l.audio.L[from + i]! * g
          out.R[p * period + i] += l.audio.R[from + i]! * g
        }
      }
      return A.truePeak(out)
    }
    const tops = Object.fromEntries(pack.loops.map((l) => [l.id, top(l.id)]))
    const together = (...ids: string[]): number => {
      const parts = ids.map((id) => cutOut(pack, id))
      const o = A.make(Math.max(...parts.map((x) => x.L.length)), rate)
      for (const x of parts) {
        for (let i = 0; i < x.L.length; i++) {
          o.L[i] += x.L[i]!
          o.R[i] += x.R[i]!
        }
      }
      return A.truePeak(o)
    }
    // The button and the device's motion go to the next season; a season's chip goes from any season to any other
    // (bridge.goTo in src/ui/index.ts). So every pair is asked, twelve of them.
    let pairs = 0
    for (const before of config.seasons) {
      for (const to of config.seasons) {
        if (to === before) continue
        pairs++
        // Through the bar of the shake: the old music and the old ambience (let go, at most their own highest), the
        // new ambience coming in (at most its own highest), and what begins with the shake summed as it falls: the
        // lift, the shake and the press's tick. A loose bound, since the three loops are taken at their highest at
        // once: -1.7 dB at the worst (summer into spring) and -2.35 dB at the worst to the next season (spring into
        // summer) when it was written. The tight one of decision 146, with the old music at every place of its round
        // as the app lets it go, lies 0.3 to 2.3 dB lower (-2.94 dB at the worst). What a visitor lays on top of a
        // shake (one more press, a stir) is not in this sum: see audio/RECIPE.md, decision 146.
        const inBar = tops[`music-${before}`]! + tops[`amb-${before}`]! + tops[`amb-${to}`]! + together('lift', `shake-${to}`, 'ui-tick')
        expect(A.db(inBar), `the shake from ${before} into ${to}`).toBeLessThan(-1)
        // From the landing: the new music from its start, the new ambience and the clink.
        const landing = tops[`music-${to}`]! + tops[`amb-${to}`]! + together('glass-clink')
        expect(A.db(landing), `the landing into ${to}`).toBeLessThan(-1)
      }
    }
    expect(pairs).toBe(config.seasons.length * (config.seasons.length - 1))
    // On top of a shake a visitor can press once more and stir. The engine keeps a gap between interface cues and
    // the tick is over inside that gap, so two presses never sound together and a second press adds one tick at
    // most. With that the tight sum of the last job of decision 146 stays under -1 dBFS (audio/RECIPE.md). That sum
    // takes minutes and is not run here.
    const engine = fs.readFileSync(path.join(path.dirname(A.KEPT), '..', 'src', 'audio', 'index.ts'), 'utf8')
    const gap = Number(/^const INTERFACE_GAP = ([\d.]+)$/m.exec(engine)?.[1])
    expect(gap).toBe(0.1)
    expect(pack.sprite.entries['ui-tick']!.seconds).toBeLessThan(gap)
    expect(engine).toMatch(/if \(now - lastInterface < INTERFACE_GAP\) return false/)
  })
})
