import { describe, expect, it } from 'vitest'
import { config, shots } from '../src/config'
import { FRAME } from '../src/app/framing'
import { changeBloom, changeRamp, changeSpan, partChange, SEASONAL_PARTS } from '../src/shake/change'
import { shakeMotion } from '../src/shake/table'

const s = config.shake
const BEAT_S = 60 / config.film.defaultBpm
const FRAME_BEATS = 1 / config.film.fps / BEAT_S
const WINDOW = s.swapWindow.toBeat - s.swapWindow.fromBeat
const beatOf = (change: number): number => s.swapWindow.fromBeat + change * WINDOW
const changeAt = (beat: number): number => (beat - s.swapWindow.fromBeat) / WINDOW

/** A frame is clean when the globe moves less than this while the shutter is open. At `hero` and `hd` a millimetre is about six pixels. */
const STREAK_MM = 1.5
const SHUTTER_S = config.film.shutterDegrees / 360 / config.film.fps

const INSIDE = ['miniature', 'arrival']
const OUTSIDE = ['base', 'glass-dressing', 'surface-dressing', 'backdrop']
const ACROSS = ['light', 'veil', 'particles']
const PARTS = [...new Set([...SEASONAL_PARTS, ...INSIDE, ...OUTSIDE, ...ACROSS, 'none'])]
const film = shots.filter((shot) => shot.kind === 'shake').map((shot) => shot.id)
const NAMES = ['test', ...config.seasons.map((season) => `test:${season}`), 'preroll', ...film, 'loop', ...Array.from({ length: FRAME.shakePaths }, (_, i) => `live-${i}`)]

describe('the change number', () => {
  it('names every seasonal part once', () => {
    expect([...SEASONAL_PARTS]).toEqual(['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'particles'])
    expect(s.swapWindow.fromBeat).toBeGreaterThanOrEqual(s.liftBeats)
    expect(s.swapWindow.toBeat).toBeLessThanOrEqual(s.liftBeats + s.strokeBeats)
  })

  it('is 0 before the window, 1 after it, never outside 0 to 1 and never runs back', () => {
    for (const part of PARTS) {
      for (const side of [0, 0.25, 0.5, 1, -2, 3]) {
        expect(partChange(part, 0, side)).toBe(0)
        expect(partChange(part, -0.3, side)).toBe(0)
        expect(partChange(part, Number.NaN, side)).toBe(0)
        expect(partChange(part, 1, side)).toBe(1)
        expect(partChange(part, 1.7, side)).toBe(1)
        let before = 0
        for (let c = 0; c <= 1.0001; c += 0.001) {
          const v = partChange(part, c, side)
          expect(v).toBeGreaterThanOrEqual(before)
          expect(v).toBeLessThanOrEqual(1)
          before = v
        }
      }
      expect(partChange(part, 0.37)).toBe(partChange(part, 0.37, 0.5))
    }
  })

  it('keeps every span inside the window and hands the shader the same ramp', () => {
    for (const part of PARTS) {
      const span = changeSpan(part)
      const ramp = changeRamp(part)
      expect(span.from).toBeGreaterThanOrEqual(0)
      expect(span.to).toBeLessThanOrEqual(1)
      expect(span.to).toBeGreaterThan(span.from)
      expect(span.lag).toBeGreaterThanOrEqual(0)
      expect(span.lag).toBeLessThan(1)
      expect(ramp.start).toBe(span.from)
      expect(ramp.length).toBeGreaterThan(0)
      expect(ramp.length + ramp.lag).toBeCloseTo(span.to - span.from, 12)
      for (const side of [0, 0.3, 1]) {
        for (let c = 0.001; c < 1; c += 0.0173) {
          const shader = Math.min(1, Math.max(0, (c - ramp.start - ramp.lag * side) / ramp.length))
          expect(partChange(part, c, side)).toBeCloseTo(shader, 12)
        }
        expect(partChange(part, span.from, side)).toBe(0)
        expect(partChange(part, span.to, side)).toBeCloseTo(1, 12)
      }
    }
    expect(changeSpan('none')).toEqual({ from: 0, to: 1, lag: 0 })
  })

  it('inside the glass switches the far side of the miniature first and the near side after', () => {
    for (const part of INSIDE) {
      const span = changeSpan(part)
      expect(span.lag).toBeGreaterThan(0)
      const mid = (span.from + span.to) / 2
      expect(partChange(part, mid, 0)).toBeGreaterThan(1 - 1e-12)
      expect(partChange(part, mid, 1)).toBeLessThan(1e-12)
      for (let c = 0; c <= 1; c += 0.01) {
        expect(partChange(part, c, 0)).toBeGreaterThanOrEqual(partChange(part, c, 0.5))
        expect(partChange(part, c, 0.5)).toBeGreaterThanOrEqual(partChange(part, c, 1))
      }
      expect(span.from).toBeGreaterThan(0)
      expect(span.to).toBeLessThan(1)
    }
    expect(changeSpan('arrival')).toEqual(changeSpan('miniature'))
  })

  it('crosses the room light, the veil and the particles over the whole window', () => {
    for (const part of ACROSS) {
      expect(changeSpan(part)).toEqual({ from: 0, to: 1, lag: 0 })
      for (const c of [0.1, 0.5, 0.83]) expect(partChange(part, c)).toBeCloseTo(c, 12)
    }
  })

  it('changes what is outside the glass together, across a few frames', () => {
    const span = changeSpan('base')
    for (const part of OUTSIDE) expect(changeSpan(part)).toEqual(span)
    expect(span.lag).toBe(0)
    const frames = ((span.to - span.from) * WINDOW) / FRAME_BEATS
    expect(frames).toBeGreaterThanOrEqual(4)
    expect(frames).toBeLessThanOrEqual(9)
  })

  it('raises the bloom round those frames and nowhere else', () => {
    const span = changeSpan('base')
    const mid = (span.from + span.to) / 2
    expect(changeBloom(mid)).toBeCloseTo(1, 12)
    for (const c of [-1, 0, 1, 2, Number.NaN]) expect(changeBloom(c)).toBe(0)
    let rising = true
    let before = 0
    let lit = 0
    for (let c = 0; c <= 1; c += 0.001) {
      const v = changeBloom(c)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      if (c > mid) rising = false
      if (rising) expect(v).toBeGreaterThanOrEqual(before - 1e-12)
      else if (c > mid + 0.001) expect(v).toBeLessThanOrEqual(before + 1e-12)
      before = v
      if (v > 0) lit += 0.001
      if (c >= span.from && c <= span.to) expect(v, `bloom at ${c}`).toBeGreaterThan(0.5)
      else if (partChange('base', c) > 0 && partChange('base', c) < 1) throw new Error('the base is changing outside its span')
    }
    expect(changeBloom(0.02)).toBe(0)
    expect(changeBloom(0.98)).toBe(0)
    expect((lit * WINDOW * BEAT_S) / (span.to - span.from) / (WINDOW * BEAT_S)).toBeGreaterThan(1.5)
    expect(lit * WINDOW * BEAT_S).toBeLessThan(0.35)
  })
})

describe('the change at the first frame of the window', () => {
  it('steps nothing: every number a part reads starts from 0 and moves no faster in its first frame than its own ramp does anywhere', () => {
    const frame = FRAME_BEATS / WINDOW
    for (const part of PARTS) {
      const ramp = changeRamp(part)
      for (const side of [0, 0.25, 0.5, 0.75, 1]) {
        expect(partChange(part, 0, side), part).toBe(0)
        expect(partChange(part, 1e-9, side), part).toBeLessThan(1e-8)
        for (let k = 1; k <= 32; k++) {
          const c = (frame * k) / 16
          expect(partChange(part, c, side), `${part} ${k / 16} frames in`).toBeLessThanOrEqual(c / ramp.length + 1e-12)
          expect(partChange(part, c, side) - partChange(part, c - frame / 16, side), `${part} ${k / 16} frames in`).toBeLessThanOrEqual(frame / 16 / ramp.length + 1e-12)
        }
      }
    }
    // What is outside the glass, and the bloom that covers it, do not move at all until their own span: the first frames of the window show the season that was.
    const span = changeSpan('base')
    expect((span.from * WINDOW) / FRAME_BEATS).toBeGreaterThan(12)
    for (const part of OUTSIDE) for (let c = 0; c < span.from; c += frame / 4) expect(partChange(part, c), `${part} at ${c}`).toBe(0)
    for (let c = 0; c <= 4 * frame; c += frame / 16) expect(changeBloom(c)).toBe(0)
    let steepest = 0
    for (let c = 0; c <= 1; c += frame / 16) steepest = Math.max(steepest, Math.abs(changeBloom(c + frame) - changeBloom(c)))
    expect(steepest, 'the bloom rises over frames, not in one').toBeLessThan(0.4)
  })
})

describe('the change against the motion', () => {
  it('puts the fastest stroke of every shake on the outside parts, so no clean frame shows them half changed', () => {
    const span = changeSpan('base')
    const from = beatOf(span.from)
    const to = beatOf(span.to)
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const turns = m.plan.strokes
      const last = turns.at(-1)!
      const prior = turns.at(-2)!
      expect((prior.beat + last.beat) / 2, `${name} stroke centre`).toBeCloseTo((from + to) / 2, 2)
      expect(from - prior.beat, `${name} span starts after the turn`).toBeGreaterThan(0.012)
      expect(last.beat - to, `${name} span ends before the turn`).toBeGreaterThan(0.012)
      expect(m.plan.fastest.beat, `${name} fastest`).toBeGreaterThan(from)
      expect(m.plan.fastest.beat, `${name} fastest`).toBeLessThan(to)
      let slowest = Infinity
      for (let b = from; b <= to + 1e-9; b += FRAME_BEATS / 16) {
        const speed = Math.hypot(m.at('x', b, 1), m.at('y', b, 1), m.at('z', b, 1)) / BEAT_S
        slowest = Math.min(slowest, speed)
      }
      expect(slowest * SHUTTER_S, `${name} streak in mm at its slowest changing frame`).toBeGreaterThan(STREAK_MM)
      for (let b = s.swapWindow.fromBeat; b <= s.swapWindow.toBeat; b += FRAME_BEATS / 16) {
        const v = partChange('base', changeAt(b))
        if (v > 0 && v < 1) expect(b >= from && b <= to).toBe(true)
      }
      let fastest = 0
      for (let k = 1; k < turns.length; k++) {
        let peak = 0
        for (let b = turns[k - 1]!.beat; b <= turns[k]!.beat; b += 0.002) peak = Math.max(peak, Math.abs(m.at('x', b, 1)))
        if (k < turns.length - 1) fastest = Math.max(fastest, peak)
        else expect(peak, `${name}: the last stroke is the fastest`).toBeGreaterThan(fastest)
      }
    }
  })

  it('opens the window only when the storm has strokes behind it and closes it before the hand stops', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const turns = m.plan.strokes
      expect(turns.filter((t) => t.beat < s.swapWindow.fromBeat).length, name).toBeGreaterThanOrEqual(3)
      expect(turns.filter((t) => t.beat > s.swapWindow.fromBeat && t.beat < s.swapWindow.toBeat).length, name).toBeGreaterThanOrEqual(2)
      const miniature = changeSpan('miniature')
      expect(beatOf(miniature.from)).toBeGreaterThan(turns[2]!.beat)
      expect(beatOf(miniature.to)).toBeLessThanOrEqual(s.liftBeats + s.strokeBeats)
    }
  })
})
