import { beforeAll, describe, expect, it } from 'vitest'
import {
  LIMITS,
  MAP_VERSION,
  SETTINGS,
  analyse,
  gridBeats,
  loudnessBetween,
  makeFft,
  median,
  onsetEnvelope,
  quantile,
  spectra,
  squareSums,
  tempoByAutocorrelation,
  tempoByComb,
} from '../tools/lib/beats.mjs'
import { loadConfig } from '../tools/lib/paths.mjs'

const cfg = loadConfig()
const sampleRate: number = cfg.audio.sampleRate
const beatsPerBar: number = cfg.film.beatsPerBar
const defaultBpm: number = cfg.film.defaultBpm
const opts = { beatsPerBar, defaultBpm }

const TEMPO_TOLERANCE = 0.5
const BEAT_TOLERANCE = 0.02
const SLOW_BPM = 87
const LONG = 30000
const TAU = 2 * Math.PI

function lcg(seed: number) {
  let s = seed >>> 0
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
}

type Clicks = { bpm: number; count: number; offset?: number; accentAt?: number; level?: (index: number) => number; tail?: number }

function clickTrack({ bpm, count, offset = 0, accentAt = -1, level = () => 1, tail = 0 }: Clicks) {
  const beat = 60 / bpm
  const seconds = offset + count * beat + tail
  const samples = new Float32Array(Math.round(seconds * sampleRate))
  const times: number[] = []
  const length = Math.round(0.03 * sampleRate)
  for (let c = 0; c < count; c++) {
    const at = offset + c * beat
    times.push(at)
    const accent = accentAt >= 0 && c % beatsPerBar === accentAt
    const start = Math.round(at * sampleRate)
    for (let i = 0; i < length && start + i < samples.length; i++) {
      const t = i / sampleRate
      samples[start + i] += level(c) * (accent ? 0.8 : 0.35) * Math.exp(-t * 180) * Math.sin(TAU * (accent ? 1500 : 1000) * t)
    }
  }
  return { samples, seconds, times, beat }
}

function worstError(found: number[], truth: number[]) {
  let worst = 0
  for (const t of found) {
    let near = Infinity
    for (const v of truth) near = Math.min(near, Math.abs(v - t))
    worst = Math.max(worst, near)
  }
  return worst
}

type Piece = { bpm: number; sectionBars: number[]; offset?: number; jitter?: number; seed?: number }

function piece({ bpm, sectionBars, offset = 0, jitter = 0.006, seed = 11 }: Piece) {
  const beat = 60 / bpm
  const bars = sectionBars.reduce((a, v) => a + v, 0)
  const seconds = offset + bars * beatsPerBar * beat
  const x = new Float32Array(Math.round(seconds * sampleRate))
  const rand = lcg(seed)
  type Partials = number[][]
  const note = (at: number, hz: number, amp: number, attack: number, decay: number, partials: Partials) => {
    const start = Math.round(at * sampleRate)
    const count = Math.round((6 / decay) * sampleRate)
    for (let i = 0; i < count && start + i < x.length; i++) {
      if (start + i < 0) continue
      const t = i / sampleRate
      const e = Math.min(1, t / attack) * Math.exp(-t * decay)
      let v = 0
      for (const [ratio, level] of partials) v += level * Math.sin(TAU * hz * ratio * t)
      x[start + i] += amp * e * v
    }
  }
  const pad = (from: number, to: number, hz: number, amp: number, partials: Partials) => {
    const start = Math.round(from * sampleRate)
    const count = Math.round((to - from) * sampleRate)
    for (let i = 0; i < count && start + i < x.length; i++) {
      const t = i / sampleRate
      const e = Math.min(1, t / 0.15, (to - from - t) / 0.15)
      let v = 0
      for (const [ratio, level] of partials) v += level * Math.sin(TAU * hz * ratio * t)
      x[start + i] += amp * e * v
    }
  }
  const shake = (at: number, amp: number) => {
    const start = Math.round(at * sampleRate)
    let last = 0
    for (let i = 0; i < 0.08 * sampleRate && start + i < x.length; i++) {
      const w = rand() * 2 - 1
      x[start + i] += amp * (w - last) * Math.min(1, i / 48) * Math.exp((-i / sampleRate) * 60)
      last = w
    }
  }
  const BELL = [[1, 1], [2.76, 0.5], [5.4, 0.25]]
  const PLUCK = [[1, 1], [2, 0.4], [3, 0.2]]
  const SOFT = [[1, 1], [2, 0.15]]
  const STRING = [[1, 1], [2, 0.5], [3, 0.33], [4, 0.25], [5, 0.2]]
  const major = [[261.63, 329.63, 392.0, 65.41], [220.0, 261.63, 329.63, 55.0], [174.61, 220.0, 261.63, 87.31], [196.0, 246.94, 293.66, 98.0]]
  const minor = [[220.0, 261.63, 329.63, 55.0], [174.61, 207.65, 261.63, 87.31], [146.83, 174.61, 220.0, 73.42], [164.81, 207.65, 246.94, 82.41]]
  const levels = [0.5, 0.3, 0.42, 0.36, 0.75]
  const j = () => (rand() * 2 - 1) * jitter
  let bar = 0
  const boundaries: number[] = []
  sectionBars.forEach((count, section) => {
    const kind = section % levels.length
    for (let b = 0; b < count; b++, bar++) {
      const t0 = offset + bar * beatsPerBar * beat
      const chord = (kind === 3 ? minor : major)[bar % 4]
      const thin = b === count - 1
      const level = levels[kind] * (thin ? 0.6 : 1)
      if (kind !== 2) for (let k = 0; k < 3; k++) pad(t0, t0 + beatsPerBar * beat, chord[k] * (kind === 3 ? 0.5 : 1), level * 0.12, kind === 3 ? STRING : SOFT)
      note(t0 + j() * 0.3, chord[3], level * 0.5, 0.008, 3, SOFT)
      if (thin) continue
      if (kind !== 1) note(t0 + 2 * beat + j() * 0.3, chord[3] * (kind === 2 ? 1.5 : 1), level * 0.35, 0.008, 3, SOFT)
      for (let q = 0; q < beatsPerBar * 2; q++) {
        const at = t0 + (q * beat) / 2 + j()
        const on = q % 2 === 0
        const hz = chord[q % 3]
        if (kind === 0 || kind === 4) {
          note(at, hz * 4, level * (q === 0 ? 0.4 : on ? 0.28 : 0.16), 0.002, 4, BELL)
          if (kind === 4) note(at, hz * 8, level * 0.1, 0.002, 5, BELL)
          shake(at, level * (q === 0 ? 0.5 : on ? 0.3 : 0.12))
        } else if (kind === 1) {
          note(at, hz * 4, level * (q === 0 ? 0.5 : on ? 0.35 : 0.25), 0.004, 5, PLUCK)
          if (q % 4 === 0) note(at, chord[(q / 4) % 3] * 8, level * 0.2, 0.06, 1.5, SOFT)
        } else if (kind === 2) {
          if (on || q === 3 || q === 7) note(at, hz * 2, level * (q === 0 ? 0.6 : on ? 0.45 : 0.3), 0.003, 6, PLUCK)
          if (on) note(at, chord[(q / 2) % 3], level * 0.4, 0.002, 14, SOFT)
        } else if (q === 0 || q === 4 || q === 3 || q === 6) {
          note(at, hz * 4 * (1 + (rand() - 0.5) * 0.02), level * (q === 0 ? 0.55 : 0.35), 0.002, 3, BELL)
        }
      }
    }
    boundaries.push(offset + bar * beatsPerBar * beat)
  })
  let peak = 0
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]))
  for (let i = 0; i < x.length; i++) x[i] *= 0.8 / peak
  const beats = Array.from({ length: bars * beatsPerBar }, (_, i) => offset + i * beat)
  return { samples: x, seconds, beat, beats, barLines: beats.filter((_, i) => i % beatsPerBar === 0), boundaries: boundaries.slice(0, -1) }
}

describe('the pieces of the audio map', () => {
  it('finds a sine in the right bin of the transform', () => {
    const n = 256
    const re = new Float64Array(n)
    const im = new Float64Array(n)
    for (let i = 0; i < n; i++) re[i] = Math.cos((TAU * 19 * i) / n) + 0.5 * Math.sin((TAU * 40 * i) / n)
    makeFft(n)(re, im)
    const size = (k: number) => Math.hypot(re[k], im[k])
    expect(size(19)).toBeCloseTo(n / 2, 6)
    expect(size(40)).toBeCloseTo(n / 4, 6)
    expect(size(20)).toBeLessThan(1e-9)
    expect(() => makeFft(100)).toThrow()
  })

  it('takes the median and a quantile', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
    expect(quantile([0, 10, 20, 30, 40], 0.5)).toBe(20)
    expect(quantile([0, 10, 20, 30, 40], 0.9)).toBeCloseTo(36, 9)
  })

  it('lays a grid that fills the length with whole bars', () => {
    const exact = (10 * beatsPerBar * 60) / defaultBpm
    const fit = gridBeats(exact, defaultBpm, beatsPerBar)
    expect(fit.bars).toBe(10)
    expect(fit.bpm).toBeCloseTo(defaultBpm, 9)
    for (const seconds of [exact * 1.03, cfg.film.minSeconds + 0.37, cfg.film.maxSeconds - 0.61]) {
      const grid = gridBeats(seconds, defaultBpm, beatsPerBar)
      expect(Number.isInteger(grid.bars)).toBe(true)
      expect(grid.beats.length).toBe(grid.bars * beatsPerBar)
      expect(grid.beats[0]).toBe(0)
      expect((grid.bars * beatsPerBar * 60) / grid.bpm).toBeCloseTo(seconds, 9)
      expect(Math.abs((seconds * defaultBpm) / 60 / beatsPerBar - grid.bars)).toBeLessThanOrEqual(0.5)
      expect(grid.beats[grid.beats.length - 1] + 60 / grid.bpm).toBeCloseTo(seconds, 9)
    }
  })

  it('measures loudness in step with level', () => {
    const tone = (amp: number) => Float32Array.from({ length: sampleRate }, (_, i) => amp * Math.sin((TAU * 1000 * i) / sampleRate))
    const loud = loudnessBetween(squareSums(tone(0.5)), sampleRate, 0, 1)
    const soft = loudnessBetween(squareSums(tone(0.05)), sampleRate, 0, 1)
    expect(loud - soft).toBeCloseTo(20, 3)
    expect(loud).toBeCloseTo(-0.691 + 10 * Math.log10(0.125), 2)
  })

  it.each([defaultBpm, SLOW_BPM, 126])('finds %d beats a minute with both tempo methods', (bpm) => {
    const track = clickTrack({ bpm, count: Math.round((20 * bpm) / 60) })
    const onset = onsetEnvelope(spectra(track.samples, sampleRate, SETTINGS[0]), SETTINGS[0])
    const a = tempoByAutocorrelation(onset.env, onset.frameRate, defaultBpm)
    const c = tempoByComb(onset.env, onset.frameRate, defaultBpm)
    expect(Math.abs(a.bpm - bpm)).toBeLessThan(TEMPO_TOLERANCE)
    expect(Math.abs(c.bpm - bpm)).toBeLessThan(TEMPO_TOLERANCE)
    expect(Math.abs(a.bpm - c.bpm)).toBeLessThanOrEqual(LIMITS.tempoToleranceBpm)
  })
})

describe('a click track with an accent on every bar', () => {
  const bars = 14
  const track = clickTrack({ bpm: defaultBpm, count: bars * beatsPerBar, accentAt: 0 })
  let map: ReturnType<typeof analyse>
  beforeAll(() => {
    map = analyse(track.samples, sampleRate, opts)
  }, LONG)

  it('is tracked at the right tempo', () => {
    expect(map.method).toBe('tracked')
    expect(Math.abs(map.bpm - defaultBpm)).toBeLessThan(TEMPO_TOLERANCE)
    expect(map.checks.tempo.agree).toBe(true)
    expect(map.checks.steady.pass).toBe(true)
  })

  it('puts every beat on a click', () => {
    expect(map.beats.length).toBe(track.times.length)
    expect(worstError(map.beats, track.times)).toBeLessThan(BEAT_TOLERANCE)
  })

  it('puts the bar lines on the accents', () => {
    expect(map.checks.barPhase.method).toBe('accents')
    expect(map.bars).toBe(bars)
    expect(map.barLines.length).toBe(bars)
    map.barLines.forEach((t: number, i: number) => expect(Math.abs(t - track.times[i * beatsPerBar])).toBeLessThan(BEAT_TOLERANCE))
  })

  it('has the shape the cut reads', () => {
    expect(map.version).toBe(MAP_VERSION)
    expect(map.beatsPerBar).toBe(beatsPerBar)
    expect(map.seconds).toBeCloseTo(track.seconds, 3)
    for (let i = 1; i < map.beats.length; i++) expect(map.beats[i]).toBeGreaterThan(map.beats[i - 1])
    for (const t of map.barLines) expect(map.beats).toContain(t)
    expect(map.sections.length).toBe(1)
    expect(map.sections[0].start).toBe(0)
    expect(map.sections[0].end).toBeCloseTo(track.seconds, 3)
    expect(map.loudestSectionStart).toBe(0)
  })
})

describe('a click track that starts late on a pickup', () => {
  const offset = 0.37
  const accentAt = 2
  const track = clickTrack({ bpm: 112, count: 13 * beatsPerBar, offset, accentAt })
  let map: ReturnType<typeof analyse>
  beforeAll(() => {
    map = analyse(track.samples, sampleRate, opts)
  }, LONG)

  it('keeps the tempo and the beats', () => {
    expect(map.method).toBe('tracked')
    expect(Math.abs(map.bpm - 112)).toBeLessThan(TEMPO_TOLERANCE)
    expect(Math.abs(map.beats[0] - offset)).toBeLessThan(BEAT_TOLERANCE)
    expect(map.beats.length).toBe(track.times.length)
    expect(worstError(map.beats, track.times)).toBeLessThan(BEAT_TOLERANCE)
  })

  it('starts the first bar on the first accent', () => {
    expect(map.checks.barPhase.phase).toBe(accentAt)
    map.barLines.forEach((t: number, i: number) => expect(Math.abs(t - track.times[accentAt + i * beatsPerBar])).toBeLessThan(BEAT_TOLERANCE))
    expect(map.bars).toBe(12)
  })
})

describe('a click track with a quiet middle and a loud end', () => {
  const each = 6 * beatsPerBar
  const level = (c: number) => (c < each ? 0.6 : c < 2 * each ? 0.06 : 1)
  const track = clickTrack({ bpm: SLOW_BPM, count: 3 * each, accentAt: 0, level })
  let map: ReturnType<typeof analyse>
  beforeAll(() => {
    map = analyse(track.samples, sampleRate, opts)
  }, LONG)

  it('holds the beat through the quiet part', () => {
    expect(map.method).toBe('tracked')
    expect(Math.abs(map.bpm - SLOW_BPM)).toBeLessThan(TEMPO_TOLERANCE)
    expect(map.beats.length).toBe(track.times.length)
    expect(worstError(map.beats, track.times)).toBeLessThan(BEAT_TOLERANCE)
    map.barLines.forEach((t: number, i: number) => expect(Math.abs(t - track.times[i * beatsPerBar])).toBeLessThan(BEAT_TOLERANCE))
  })

  it('finds the three sections and the loudest one', () => {
    expect(map.sections.length).toBe(3)
    expect(map.sections[0].start).toBe(0)
    expect(map.sections[2].end).toBeCloseTo(track.seconds, 3)
    expect(Math.abs(map.sections[1].start - track.times[each])).toBeLessThan(BEAT_TOLERANCE)
    expect(Math.abs(map.sections[2].start - track.times[2 * each])).toBeLessThan(BEAT_TOLERANCE)
    expect(map.sections[1].start).toBe(map.sections[0].end)
    expect(map.sections[2].start).toBe(map.sections[1].end)
    expect(map.sections[0].loudness - map.sections[1].loudness).toBeCloseTo(20, 0)
    expect(map.sections[2].loudness).toBeGreaterThan(map.sections[0].loudness)
    expect(map.loudestSectionStart).toBe(map.sections[2].start)
    expect(map.checks.steady.sections.length).toBe(3)
    for (const row of map.checks.steady.sections) expect(row.steady).toBe(true)
  })
})

describe('a piece of music in five sections', () => {
  const music = piece({ bpm: defaultBpm, sectionBars: [4, 5, 4, 4, 5], offset: 0.2 })
  const bar = beatsPerBar * music.beat
  let map: ReturnType<typeof analyse>
  beforeAll(() => {
    map = analyse(music.samples, sampleRate, opts)
  }, LONG)

  it('is tracked with every beat in place', () => {
    expect(map.method).toBe('tracked')
    expect(Math.abs(map.bpm - defaultBpm)).toBeLessThan(TEMPO_TOLERANCE)
    expect(map.beats.length).toBe(music.beats.length)
    expect(worstError(map.beats, music.beats)).toBeLessThan(BEAT_TOLERANCE)
  })

  it('puts the bar lines on the downbeats', () => {
    expect(map.checks.barPhase.method).toBe('accents')
    expect(map.barLines.length).toBe(music.barLines.length)
    expect(worstError(map.barLines, music.barLines)).toBeLessThan(BEAT_TOLERANCE)
  })

  it('puts a section boundary within a bar of each planned one', () => {
    const found = map.sections.slice(1).map((s: { start: number }) => s.start)
    for (const planned of music.boundaries) expect(worstError([planned], found)).toBeLessThanOrEqual(bar + BEAT_TOLERANCE)
    expect(found.length).toBeLessThanOrEqual(music.boundaries.length + 1)
    expect(Math.abs(map.loudestSectionStart - music.boundaries[3])).toBeLessThanOrEqual(bar + BEAT_TOLERANCE)
  })
})

describe('sound with no beat', () => {
  it('falls back to a grid of whole bars for noise', () => {
    const rand = lcg(7)
    const seconds = 17.3
    const noise = Float32Array.from({ length: Math.round(seconds * sampleRate) }, () => (rand() * 2 - 1) * 0.3)
    const map = analyse(noise, sampleRate, opts)
    expect(map.method).toBe('grid')
    expect(map.checks.tries.length).toBe(SETTINGS.length)
    expect(map.checks.reason).toBeTruthy()
    expect(map.beats.length).toBe(map.bars * beatsPerBar)
    expect(map.barLines.length).toBe(map.bars)
    expect(map.beats[0]).toBe(0)
    expect((map.bars * beatsPerBar * 60) / map.bpm).toBeCloseTo(seconds, 2)
    expect(map.sections[0].start).toBe(0)
    expect(map.sections[map.sections.length - 1].end).toBeCloseTo(seconds, 3)
  }, LONG)

  it('falls back to a grid for silence', () => {
    const seconds = (6 * beatsPerBar * 60) / defaultBpm
    const map = analyse(new Float32Array(Math.round(seconds * sampleRate)), sampleRate, opts)
    expect(map.method).toBe('grid')
    expect(map.checks.reason).toBe('the file is silent')
    expect(map.bars).toBe(6)
    expect(map.bpm).toBeCloseTo(defaultBpm, 3)
    expect(map.sections.length).toBe(1)
    expect(map.loudestSectionStart).toBe(0)
  })
})
