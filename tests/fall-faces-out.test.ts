import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { beatSeconds } from '../src/film/timeline'
import { FACE_COUNT, GUTTER, faceLeft, faceLevel, faceLit } from '../src/seasons/fall/base'

// Decision 294, W3: fall's three lit faces were still alight on the base while it turned into winter's (film 2820 to
// 2840). They go out before the turn: a globe that is taken up is a draught, each flame gutters and goes out at its own
// beat of the shake, and the last is dark before the window of the change opens.
describe("fall's candles when the globe is taken up", () => {
  const faces = Array.from({ length: FACE_COUNT }, (_, i) => i)
  const FRAMES_A_BEAT = beatSeconds * config.film.fps
  const swap = config.shake.swapWindow
  // Every frame of a shake of four beats, and the half frames between, as the shutter reads them.
  const beats = Array.from({ length: 4 * FRAMES_A_BEAT * 2 + 1 }, (_, k) => k / (FRAMES_A_BEAT * 2))
  const frames = Array.from({ length: 4 * FRAMES_A_BEAT + 1 }, (_, k) => k / FRAMES_A_BEAT)

  it('has a beat for every face', () => {
    expect(GUTTER.outBeat.length).toBe(FACE_COUNT)
    expect(FRAMES_A_BEAT).toBe(36)
  })

  it('touches nothing outside a shake', () => {
    for (const i of faces) for (const s of [-1, 0, 0.05, 0.2, 0.5, 1, 3, 12, 40, 1e3, Infinity]) expect(faceLit(i, s, null)).toBe(faceLevel(i, s))
  })

  it('leaves every face as it was when the shake begins', () => {
    for (const i of faces) {
      expect(faceLeft(i, 0)).toBe(1)
      expect(faceLeft(i, -1)).toBe(1)
      expect(faceLeft(i, GUTTER.outBeat[i]! - GUTTER.beats)).toBe(1)
      expect(faceLit(i, Infinity, 0)).toBe(1)
      // The first frame of its guttering is next to nothing: no frame jumps into it.
      expect(1 - faceLeft(i, GUTTER.outBeat[i]! - GUTTER.beats + 1 / FRAMES_A_BEAT)).toBeLessThan(0.01)
    }
    // The first flame begins to gutter as the globe is taken up, inside the shake's first beat.
    const first = Math.min(...GUTTER.outBeat) - GUTTER.beats
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(0.5)
  })

  it('has every face dark before the window of the change opens, and until the landing', () => {
    const last = Math.max(...GUTTER.outBeat)
    expect(last).toBeLessThan(swap.fromBeat)
    for (const i of faces) {
      for (const b of beats) {
        const left = faceLeft(i, b)
        expect(left).toBeGreaterThanOrEqual(0)
        expect(left).toBeLessThanOrEqual(1)
        if (b >= GUTTER.outBeat[i]!) expect(left).toBe(0)
        if (b >= last) expect(faceLit(i, Infinity, b)).toBe(0)
      }
    }
    // In the film the last shake begins at frame 2736: every face is dark from 2807 on, and the window opens at 2808.
    expect(Math.ceil(2736 + last * FRAMES_A_BEAT)).toBeLessThanOrEqual(2807)
    expect(2736 + swap.fromBeat * FRAMES_A_BEAT).toBe(2808)
  })

  it('puts the three in front out one after another, not in the order they stand, the middle one last', () => {
    const [left, middle, right] = [GUTTER.outBeat[0]!, GUTTER.outBeat[1]!, GUTTER.outBeat[2]!]
    expect(right).toBeLessThan(left)
    expect(left).toBeLessThan(middle)
    // A quarter of a beat and more between two of them (nine frames), and the gaps are not the same.
    expect(left - right).toBeGreaterThanOrEqual(0.25)
    expect(middle - left).toBeGreaterThanOrEqual(0.25)
    expect(Math.abs(middle - left - (left - right))).toBeGreaterThan(0.005)
    // While one is dark another still burns: at the beat the right one goes out the middle one has most of its light.
    expect(faceLeft(1, right)).toBeGreaterThan(0.6)
    expect(faceLeft(0, right)).toBeGreaterThan(0.2)
    expect(faceLeft(1, left)).toBeGreaterThan(0.2)
    // The four behind are out by then too.
    for (const i of [3, 4, 5, 6]) expect(GUTTER.outBeat[i]!).toBeLessThan(middle)
  })

  it('gutters: the flame dips and comes back, each time to less, and no frame jumps', () => {
    for (const i of faces) {
      const from = GUTTER.outBeat[i]! - GUTTER.beats
      const own = frames.filter((b) => b >= from - 1e-9 && b <= GUTTER.outBeat[i]! + 1 / FRAMES_A_BEAT)
      const levels = own.map((b) => faceLeft(i, b))
      let biggest = 0
      const peaks: number[] = []
      const troughs: number[] = []
      for (let k = 1; k < levels.length; k++) {
        biggest = Math.max(biggest, Math.abs(levels[k]! - levels[k - 1]!))
        if (k + 1 < levels.length) {
          if (levels[k]! > levels[k - 1]! && levels[k]! >= levels[k + 1]!) peaks.push(levels[k]!)
          if (levels[k]! < levels[k - 1]! && levels[k]! <= levels[k + 1]!) troughs.push(levels[k]!)
        }
      }
      // The same bound the lighting holds on its way up.
      expect(biggest).toBeLessThan(0.14)
      // It comes back at least twice before it is out, and never to what it had.
      expect(peaks.length).toBeGreaterThanOrEqual(2)
      expect(troughs.length).toBeGreaterThanOrEqual(2)
      for (let k = 1; k < peaks.length; k++) expect(peaks[k]!).toBeLessThan(peaks[k - 1]!)
      for (const p of peaks) expect(p).toBeLessThan(0.97)
      // Half way through, a face still has light to lose.
      expect(faceLeft(i, from + GUTTER.beats * 0.5)).toBeGreaterThan(0.35)
      // The guttering is long enough to be seen and short enough to be one event: a half to three quarters of a second.
      const seconds = GUTTER.beats * beatSeconds
      expect(seconds).toBeGreaterThanOrEqual(0.5)
      expect(seconds).toBeLessThanOrEqual(0.75)
    }
  })

  it('lets a landing light a face again by the law it had', () => {
    // A shake of fall that lands in fall: dark through the second half, and lit from the landing by its catch, as before.
    for (const i of faces) {
      expect(faceLit(i, 0, 3.99)).toBe(0)
      expect(faceLit(i, 0, null)).toBe(0)
      expect(faceLit(i, 0.5, null)).toBe(faceLevel(i, 0.5))
      expect(faceLit(i, 12, null)).toBe(faceLevel(i, 12))
    }
  })

  it('is the law the drawing reads', () => {
    const base = readFileSync('src/seasons/fall/base.ts', 'utf8')
    expect(base).toContain('glow[i] = faceLit(i, seconds, moment.beat) * candle * (0.74 + 0.36 * k.c)')
    expect(base).toContain('return faceLevel(index, seconds) * (beat === null ? 1 : faceLeft(index, beat))')
  })
})
