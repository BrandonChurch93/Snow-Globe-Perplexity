import { describe, expect, it } from 'vitest'
import { config, shots } from '../src/config'
import { FRAME } from '../src/app/framing'
import { GUST_CLOSES, GUST_LAST_DOWN, GUST_LAST_DOWN_AT } from '../src/core/materials'
import { CHANGE_COVER, DRESSING_CHANGE, changeBloom, changeRamp, changeSpan, partChange, SEASONAL_PARTS } from '../src/shake/change'
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
const OUTSIDE = ['base', 'glass-dressing', 'surface-dressing', 'backdrop', 'room']
const ON_THE_TABLE = ['surface-leave', 'surface-come']
const ACROSS = ['light', 'veil', 'particles']
const PARTS = [...new Set([...SEASONAL_PARTS, ...INSIDE, ...OUTSIDE, ...ON_THE_TABLE, ...ACROSS, 'none'])]
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

  it('changes everything outside the glass in one span of a few frames', () => {
    const span = changeSpan('base')
    for (const part of OUTSIDE) expect(changeSpan(part), part).toEqual(span)
    expect(span.lag).toBe(0)
    // The heaps of the slab sink with the old dressing and rise with the new, and the table never carries both.
    expect(changeSpan('surface-leave')).toEqual({ from: DRESSING_CHANGE.leaveFrom, to: DRESSING_CHANGE.leaveTo, lag: 0 })
    expect(changeSpan('surface-come')).toEqual({ from: DRESSING_CHANGE.comeFrom, to: DRESSING_CHANGE.comeTo, lag: 0 })
    for (let c = 0; c <= 1; c += 0.001) expect(partChange('surface-leave', c) < 1 && partChange('surface-come', c) > 0, `a heap of both seasons at ${c}`).toBe(false)
    // Nothing on the table moves before the span or after it.
    expect(DRESSING_CHANGE.liftFrom).toBeGreaterThanOrEqual(span.from)
    expect(DRESSING_CHANGE.leaveFrom).toBeGreaterThanOrEqual(DRESSING_CHANGE.liftFrom)
    expect(DRESSING_CHANGE.leaveTo).toBeLessThanOrEqual(DRESSING_CHANGE.comeFrom)
    expect(DRESSING_CHANGE.comeTo).toBeLessThanOrEqual(span.to)
    const frames = ((span.to - span.from) * WINDOW) / FRAME_BEATS
    expect(frames).toBeGreaterThanOrEqual(2)
    expect(frames).toBeLessThanOrEqual(4)
  })

  it('raises a short cover with a rise and a fall the eye can follow, whole across the span', () => {
    const span = changeSpan('base')
    const cover = CHANGE_COVER
    const frame = FRAME_BEATS / WINDOW
    expect(cover.riseFrom).toBeLessThan(cover.fullFrom)
    expect(cover.fullFrom).toBeLessThan(span.from)
    expect(cover.fullTo).toBeGreaterThan(span.to)
    expect(cover.goneAt).toBeGreaterThan(cover.fullTo)
    for (const c of [-1, 0, 1, 2, Number.NaN]) expect(changeBloom(c)).toBe(0)
    let before = 0
    let lit = 0
    for (let c = 0; c <= 1; c += 0.001) {
      const v = changeBloom(c)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      if (c < cover.fullFrom) expect(v).toBeGreaterThanOrEqual(before - 1e-12)
      else if (c > cover.fullTo) expect(v).toBeLessThanOrEqual(before + 1e-12)
      else expect(v, `cover at ${c}`).toBe(1)
      before = v
      if (v > 0) lit += 0.001
      expect(v > 0, `lit at ${c}`).toBe(c > cover.riseFrom && c < cover.goneAt)
      if (partChange('base', c) > 0 && partChange('base', c) < 1 && (c < span.from || c > span.to)) throw new Error('the base is changing outside its span')
    }
    // The rise and the fall each take five frames or more, so neither is a pop; the cover is whole for a few frames and the whole of it is short.
    expect((cover.fullFrom - cover.riseFrom) / frame, 'frames of rise').toBeGreaterThanOrEqual(5)
    expect((cover.goneAt - cover.fullTo) / frame, 'frames of fall').toBeGreaterThanOrEqual(5)
    expect((cover.fullTo - cover.fullFrom) / frame, 'frames of the whole cover').toBeLessThanOrEqual(5)
    expect(changeBloom(0.02)).toBe(0)
    expect(changeBloom(0.99)).toBe(0)
    expect(lit * WINDOW * BEAT_S).toBeLessThan(0.35)
  })

  it('holds no picture, of the film or live, with anything outside the glass between two seasons and the cover not whole', () => {
    const frame = FRAME_BEATS / WINDOW
    const shutter = SHUTTER_S / BEAT_S / WINDOW
    const between = (c: number): boolean => [...OUTSIDE, ...ON_THE_TABLE].some((part) => partChange(part, c) > 0 && partChange(part, c) < 1) || (partChange('surface-leave', c) >= 1 && partChange('surface-come', c) <= 0 && c > 0 && c < 1)
    let mixed = 0
    for (let k = 0; k < WINDOW / FRAME_BEATS; k++) {
      const opens = k * frame
      let any = false
      for (let i = 0; i <= 32; i++) any = any || between(opens + (shutter * i) / 32)
      if (!any) continue
      mixed++
      for (let i = 0; i <= 32; i++) expect(changeBloom(opens + (shutter * i) / 32), `frame ${k} of the window is under the whole cover`).toBe(1)
    }
    expect(mixed, 'film frames that hold two seasons').toBeGreaterThanOrEqual(2)
    expect(mixed).toBeLessThanOrEqual(5)
    // A live picture has no shutter and is taken on any instant: a quarter of a frame to each side of the span is covered as well.
    for (let c = 0; c <= 1; c += frame / 64) {
      if (!between(c)) continue
      expect(changeBloom(c - frame / 4), `live at ${c}`).toBe(1)
      expect(changeBloom(c + frame / 4), `live at ${c}`).toBe(1)
    }
    expect(DRESSING_CHANGE.comeTo).toBeLessThan(1)
    expect(DRESSING_CHANGE.liftFrom / frame, 'the first frames of the window show the table as it was').toBeGreaterThan(12 - 1e-9)
    expect(GUST_LAST_DOWN, 'every new piece on the table is down before the window closes').toBeLessThan(GUST_CLOSES)
    expect(GUST_LAST_DOWN_AT, 'and while the cover is still whole, so none is seen in the air').toBeLessThanOrEqual(CHANGE_COVER.fullTo)
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
  it('puts the outside parts on the fast run of the last stroke of every shake, so no clean frame shows them half changed', () => {
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
      expect(m.plan.fastest.beat, `${name} fastest`).toBeGreaterThan(prior.beat)
      expect(m.plan.fastest.beat, `${name} fastest`).toBeLessThan(to)
      expect(changeBloom(changeAt(m.plan.fastest.beat)), `${name} cover at the fastest instant`).toBeGreaterThan(0.95)
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
      // The span lies on the fast run of the stroke: through all of it the globe moves at seven tenths or more of its top speed.
      expect(slowest * BEAT_S, `${name} slowest speed in the span`).toBeGreaterThan(0.7 * m.plan.fastest.mmPerBeat)
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
