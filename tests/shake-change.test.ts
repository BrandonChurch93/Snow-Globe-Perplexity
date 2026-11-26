import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { config, shots, tiers } from '../src/config'
import { FRAME } from '../src/app/framing'
import * as THREE from 'three'
import { GLASS_COME, GLASS_LEAVE, GUST_CLOSES, GUST_LAST_DOWN, GUST_LAST_DOWN_AT, MODE, makeHandle, passLevel, passSpread, passStep, passStride, setPresence, STAGE_FRAG_PARS } from '../src/core/materials'
import { BASE_PASS, CHANGE_COVER, DRESSING_CHANGE, changeBloom, changeRamp, changeSpan, partChange, SEASONAL_PARTS } from '../src/shake/change'
import { shakeMotion } from '../src/shake/table'
import { CHANGE_BLOOM } from '../src/scene/lighting'
import { makeSlab, REFLECT_MIX, ReflectMix, reflectStep } from '../src/scene/surface'

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

describe('the dressing on the glass under a change', () => {
  const frame = FRAME_BEATS / WINDOW
  const span = changeSpan('base')

  it('is off the glass while the base changes: the old goes as the cover rises and the new comes as it falls', () => {
    expect(GLASS_LEAVE.start).toBe(CHANGE_COVER.riseFrom)
    expect(GLASS_LEAVE.start + GLASS_LEAVE.length).toBeLessThanOrEqual(CHANGE_COVER.fullFrom)
    expect(GLASS_LEAVE.start + GLASS_LEAVE.length).toBeLessThan(span.from)
    expect(GLASS_COME.start).toBeGreaterThanOrEqual(CHANGE_COVER.fullTo)
    expect(GLASS_COME.start).toBeGreaterThan(span.to)
    expect(GLASS_COME.start + GLASS_COME.length).toBeLessThanOrEqual(CHANGE_COVER.goneAt)
    // Neither is a cut: each runs over five frames or more, and nothing of either moves outside the cover.
    expect(GLASS_LEAVE.length).toBeGreaterThanOrEqual(5 * frame)
    expect(GLASS_COME.length).toBeGreaterThanOrEqual(5 * frame)
    for (const c of [GLASS_LEAVE.start, GLASS_COME.start + GLASS_COME.length]) expect(changeBloom(c)).toBe(0)
    for (const c of [GLASS_LEAVE.start + GLASS_LEAVE.length, GLASS_COME.start]) expect(changeBloom(c)).toBe(1)
  })

  it('gives a part on the glass the ramp of the way it goes, and no other part', () => {
    const glass = new THREE.Material()
    glass.userData.stage = makeHandle({ part: 'glass-dressing-winter', standIn: false, change: 'glass-dressing' })
    const state = (glass.userData.stage as ReturnType<typeof makeHandle>).uState.value
    setPresence(glass, MODE.outgoing)
    expect([state.x, state.y, state.w]).toEqual([GLASS_LEAVE.start, GLASS_LEAVE.length, MODE.outgoing])
    setPresence(glass, MODE.incoming)
    expect([state.x, state.y, state.w]).toEqual([GLASS_COME.start, GLASS_COME.length, MODE.incoming])
    const base = new THREE.Material()
    base.userData.stage = makeHandle({ part: 'base-winter', standIn: false, change: 'base' })
    const ramp = changeRamp('base')
    for (const mode of [MODE.outgoing, MODE.incoming, MODE.always]) {
      setPresence(base, mode)
      const b = (base.userData.stage as ReturnType<typeof makeHandle>).uState.value
      expect([b.x, b.y]).toEqual([ramp.start, ramp.length])
    }
  })

  it('passes the base from the old shape to the new over six frames or more about the middle of its span, so its line against the lit glass never steps', () => {
    const frame = FRAME_BEATS / WINDOW
    const mid = (span.from + span.to) / 2
    expect((BASE_PASS.to - BASE_PASS.from) / frame, 'frames of the pass').toBeGreaterThanOrEqual(6 - 1e-9)
    expect((BASE_PASS.from + BASE_PASS.to) / 2).toBeCloseTo(mid, 12)
    expect(changeBloom(mid)).toBe(1)
    const ramp = changeRamp('base')
    const from = (BASE_PASS.from - ramp.start) / ramp.length
    const long = (BASE_PASS.to - BASE_PASS.from) / ramp.length
    expect(/if \(uState\.z < -9\.0\) return ([^;]+);/.exec(STAGE_FRAG_PARS)?.[1]).toBe(`clamp(((uPass.z - uState.x) / uState.y + ${(-from).toFixed(4)}) / ${long.toFixed(4)}, 0.0, 1.0)`)
    // The pass is longer than the whole cover. Outside the whole cover the room stands under a fiftieth of its light, and no more than an eighth of the base is the other season's.
    const passed = (c: number): number => Math.min(1, Math.max(0, (c - BASE_PASS.from) / (BASE_PASS.to - BASE_PASS.from)))
    for (let i = 0; i <= 240; i++) {
      const c = BASE_PASS.from + ((BASE_PASS.to - BASE_PASS.from) * i) / 240
      const cover = changeBloom(c)
      expect(Math.pow(CHANGE_BLOOM.dim, cover), `the room at ${i} of 240 of the pass`).toBeLessThan(0.02)
      if (cover < 1) expect(Math.min(passed(c), 1 - passed(c)), `the other base at ${i} of 240 of the pass`).toBeLessThanOrEqual(0.125 + 1e-9)
    }
  })

  it("holds the new base at every pixel in the same number of a frame's samples, the share that has passed to the nearest of them, and one base or the other in each", () => {
    const body = /if \(uState\.z < -9\.0\) \{([^}]+)\}/.exec(STAGE_FRAG_PARS)?.[1]?.replace(/\s+/g, ' ').trim()
    expect(body).toBe('h = stageHash(vec3(gl_FragCoord.xy, uPass.x)); if (uPass.w > 1.5) h = (floor(h * uPass.w) + 0.5) / uPass.w; h = fract(h + uPass.y);')
    expect(STAGE_FRAG_PARS).toContain('if (uState.w > 1.5 ? h < c : h >= c) return true;')
    const counts = Object.values(tiers).map((t) => t.samplesPerFrame)
    expect(counts.some((n) => n >= 24)).toBe(true)
    for (const n of counts) {
      expect(n).toBeGreaterThan(1)
      // 487 is prime, so no share of this row stands on a level, where the last bit of a sum would say which side it falls.
      for (let k = 0; k <= 487; k++) {
        const c = k / 487
        let least = n
        let most = 0
        for (let j = 0; j < 997; j++) {
          let m = 0
          for (let i = 0; i < n; i++) if (passLevel(j / 997, passStep((i + 0.5) / n, n), n) < c) m++
          least = Math.min(least, m)
          most = Math.max(most, m)
        }
        expect([least, most], `the samples of ${n} that hold the new base at the share ${k} of 487, the least and the most over 997 hashes`).toEqual([most, most])
        expect(Math.abs(most / n - c), `the share held of ${n} at ${k} of 487`).toBeLessThanOrEqual(0.5 / n + 1e-9)
      }
      // Which samples they are is the pixel's own: every sample is the first of some pixel's.
      const starts = new Set<number>()
      for (let j = 0; j < 997; j++) for (let i = 0; i < n; i++) if (passLevel(j / 997, passStep((i + 0.5) / n, n), n) < 1 / n) starts.add(i)
      expect(starts.size).toBe(n)
      // The globe travels while the shutter is open, so a pixel on a base's drawn out line is under it for a part of the shutter.
      // Over the first parts of the shutter, at any pixel, the samples that hold the new base stand about half a sample from their even share,
      // and no other stride that visits every level does better. Taken in the plain order they stood up to a quarter of the frame's samples off.
      const steps = Array.from({ length: n }, (_, i) => Math.round(passStep((i + 0.5) / n, n) * n))
      expect([...steps].sort((a, b) => a - b), `the levels the ${n} samples step to`).toEqual(Array.from({ length: n }, (_, i) => i))
      expect(steps[1], `the stride of ${n}`).toBe(passStride(n) % n)
      expect(passSpread(n, passStride(n)), `the spread of ${n}`).toBeLessThanOrEqual(0.6)
      if (n >= 8) expect(passSpread(n, 1), `the spread of ${n} in the plain order`).toBeGreaterThan(1.5 * passSpread(n, passStride(n)))
      for (let g = 1; g < n; g++) {
        let visits = true
        for (let d = 2; d <= g; d++) if (g % d === 0 && n % d === 0) visits = false
        if (visits) expect(passSpread(n, g), `the stride ${g} of ${n}`).toBeGreaterThanOrEqual(passSpread(n, passStride(n)) - 1e-9)
      }
    }
    // One sample, the app's own path: the plain hash.
    expect(passStep(0.5, 1)).toBe(0)
    for (let j = 0; j < 997; j++) expect(passLevel(j / 997, 0, 1)).toBe(j / 997)
  })

  /** One shader of a season's file by the name of its constant: the text between its two backticks. */
  const shaderOf = (file: string, name: string): string => {
    const text = readFileSync(file, 'utf8')
    const open = `\nconst ${name} = \`\n`
    const at = text.indexOf(open)
    expect(at, `${name} in ${file}`).toBeGreaterThanOrEqual(0)
    return text.slice(at + open.length, text.indexOf('`\n', at + open.length))
  }
  /** The share of a dressing that a pixel holds, as its shader works it out. */
  const SHARE = 'float seen = (uState.w > 1.5 ? 1.0 - c : uState.w > 0.5 ? c : 1.0) * uFlags.w;'
  const share = (mode: number, c: number, presence: number): number => (mode > 1.5 ? 1 - c : mode > 0.5 ? c : 1) * presence
  /** Whether one sample holds it at a pixel by the stipple's rule (`stageGone`), from the pixel's two hashes. */
  const kept = (mode: number, c: number, presence: number, h: number, h2: number): boolean => !(mode > 0.5 && (mode > 1.5 ? h < c : h >= c)) && !(presence < 1 && h2 >= presence)
  /** The share is the part of all hashes that the stipple keeps, and a picture thinned by it is the mean of the samples that keep it and that drop it. */
  const thinsAsTheStippleDoesInTheMean = (): void => {
    expect(STAGE_FRAG_PARS).toContain('if (uState.w > 1.5 ? h < c : h >= c) return true;')
    expect(STAGE_FRAG_PARS).toContain('if (uFlags.w < 1.0 && stageHash(vec3(gl_FragCoord.xy + 29.0, uSeed + 0.61)) >= uFlags.w) return true;')
    const n = 240
    for (const mode of [MODE.always, MODE.incoming, MODE.outgoing])
      for (const c of [0, 0.125, 0.37, 0.5, 0.815, 1])
        for (const presence of [1, 0.6, 0.25]) {
          let held = 0
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (kept(mode, c, presence, (i + 0.5) / n, (j + 0.5) / n)) held++
          const s = share(mode, c, presence)
          expect(Math.abs(held / (n * n) - s), `the part of the hashes that keep it, mode ${mode}, change ${c}, presence ${presence}`).toBeLessThanOrEqual(1.5 / n)
          // A colour P that holds its cover A already, over a ground B.
          for (const [P, A, B] of [[0.31, 0.72, 0.9], [1.4, 1, 0.02], [0.05, 0.1, 0.5]] as const) expect(s * (P + (1 - A) * B) + (1 - s) * B).toBeCloseTo(s * P + (1 - s * A) * B, 12)
        }
    expect([share(MODE.outgoing, 0, 1), share(MODE.outgoing, 1, 1), share(MODE.incoming, 0, 1), share(MODE.incoming, 1, 1), share(MODE.always, 0.5, 1)]).toEqual([1, 0, 0, 1, 1])
  }

  it("thins winter's frost by the share that stays and drops none of it pixel by pixel, so one sample of the app holds no dots", () => {
    const file = 'src/seasons/winter/frost.ts'
    const frost = shaderOf(file, 'GLASS')
    expect(frost).toContain(SHARE)
    expect(frost).toContain('if (seen <= 0.0) discard;')
    expect(frost).not.toContain('stageGone(')
    // Both ways it sets its colour hold the cover in the colour, and the share thins colour and cover once, after both.
    const sets = [...frost.matchAll(/gl_FragColor = vec4\(col \* alpha \+ spark/g)].map((m) => m.index)
    expect(sets.length).toBe(2)
    expect(frost.split('gl_FragColor *= seen;').length).toBe(2)
    expect(frost.indexOf('gl_FragColor *= seen;')).toBeGreaterThan(Math.max(...sets))
    // The views that say which part a pixel is read the cover it has left.
    expect(frost).toContain('if (alpha * seen < 0.3) discard;')
    // It is laid over what is behind it as one plus what its cover leaves.
    const text = readFileSync(file, 'utf8')
    expect(/fragment: GLASS,\s+params: \{ \.\.\.veil \},/.test(text)).toBe(true)
    expect(/const veil = \{[^}]*blendSrc: THREE\.OneFactor,\s+blendDst: THREE\.OneMinusSrcAlphaFactor,/.test(text)).toBe(true)
    thinsAsTheStippleDoesInTheMean()
  })

  it("thins fall's crack by the share that stays and drops none of it pixel by pixel, so a hair of one pixel's width is not a row of dots in the app", () => {
    const file = 'src/seasons/fall/glass.ts'
    const crack = shaderOf(file, 'CRACK')
    expect(crack).toContain(SHARE)
    expect(crack).toContain('if (seen <= 0.0) discard;')
    expect(crack).not.toContain('stageGone(')
    // Its colour holds its cover: both terms of it are times how much of the pixel the hair or its edge fills.
    expect(crack).toContain('* edge * caught + uSky * (0.3 * ')
    expect(crack.split('gl_FragColor = vec4(col, alpha) * seen;').length).toBe(2)
    expect(crack).not.toContain('gl_FragColor = vec4(col, alpha);')
    expect(crack).toContain('if (alpha * seen < 0.3) discard;')
    const text = readFileSync(file, 'utf8')
    expect(/fragment: CRACK,\s+params: \{ \.\.\.blend, /.test(text)).toBe(true)
    expect(/const blend = \{[^}]*blendSrc: THREE\.OneFactor,\s+blendDst: THREE\.OneMinusSrcAlphaFactor,/.test(text)).toBe(true)
    // The fog of the same season crosses the same way already.
    expect(shaderOf(file, 'FOG')).toContain(SHARE)
    thinsAsTheStippleDoesInTheMean()
  })
})

describe('the table between two levels of quality', () => {
  const EIGHTH = 1 / REFLECT_MIX.fewestFrames

  it('crosses over in a few frames where the frames are slow and in half a second where they are quick, and never by more than an eighth a frame', () => {
    const cases: [number, number][] = [
      [0.25, REFLECT_MIX.fewestFrames],
      [1 / 12, REFLECT_MIX.fewestFrames],
      [1 / 30, 15],
      [1 / 60, 30],
      [1 / 240, REFLECT_MIX.mostFrames],
      [0, REFLECT_MIX.mostFrames],
      [-3, REFLECT_MIX.mostFrames],
      [Number.NaN, REFLECT_MIX.mostFrames],
      [900, REFLECT_MIX.fewestFrames],
    ]
    expect(REFLECT_MIX.fewestFrames).toBeLessThanOrEqual(8)
    expect(REFLECT_MIX.seconds).toBeGreaterThanOrEqual(0.4)
    for (const [seconds, frames] of cases) {
      for (const to of [0, 1]) {
        const seen: number[] = [1 - to]
        while (seen[seen.length - 1] !== to && seen.length < 500) seen.push(reflectStep(seen[seen.length - 1]!, to, seconds))
        expect(seen.length - 1, `frames from ${1 - to} to ${to} at ${seconds} s a frame`).toBe(frames)
        for (let i = 1; i < seen.length; i++) {
          const step = Math.abs(seen[i]! - seen[i - 1]!)
          expect(step, `step ${i} at ${seconds} s a frame`).toBeGreaterThan(0)
          expect(step, `step ${i} at ${seconds} s a frame`).toBeLessThanOrEqual(EIGHTH + 1e-9)
          expect(seen[i]! >= 0 && seen[i]! <= 1).toBe(true)
        }
        expect(reflectStep(to, to, seconds), 'at rest').toBe(to)
      }
    }
  })

  it('crosses over at a step of the page, either way, and from where it stands when the page turns back', () => {
    const mix = new ReflectMix()
    let clock = 0
    const frames = (mirror: boolean, count: number, seconds = 0.25): number[] => Array.from({ length: count }, () => mix.frame(true, mirror, (clock += seconds)))
    mix.level()
    expect(frames(true, 5), 'the first frames, at high').toEqual([1, 1, 1, 1, 1])
    mix.level()
    expect(frames(true, 5), 'at medium, which draws the mirror too').toEqual([1, 1, 1, 1, 1])
    mix.level()
    expect(frames(false, 10), 'down to low').toEqual([7, 6, 5, 4, 3, 2, 1, 0, 0, 0].map((k) => k * EIGHTH))
    mix.level()
    expect(frames(true, 3), 'back up').toEqual([1, 2, 3].map((k) => k * EIGHTH))
    mix.level()
    expect(frames(false, 2), 'and down again from where it stands').toEqual([2, 1].map((k) => k * EIGHTH))
    mix.level()
    const quick = frames(true, 40, 1 / 60)
    for (let i = 1; i < quick.length; i++) expect(quick[i]! - quick[i - 1]!, `quick frame ${i}`).toBeLessThanOrEqual(1 / 30 + 1e-9)
    expect(quick[quick.length - 1]).toBe(1)
    // The mirror pass runs for as long as any of the mirror is in the picture, and not a frame longer.
    mix.level()
    const down = frames(false, 12)
    expect(down.filter((share) => share > 0).length, 'frames that still draw the mirror after the step down').toBe(REFLECT_MIX.fewestFrames - 1)
  })

  it('draws a picture of the capture whole at once, whatever was drawn before it', () => {
    const mix = new ReflectMix()
    const live = (mirror: boolean, time: number): number => {
      mix.level()
      const share = mix.frame(true, mirror, time)
      mix.level()
      return share
    }
    const order = [true, false, false, true, true, false, true, false]
    order.forEach((mirror, i) => expect(live(mirror, i / 60), `picture ${i}`).toBe(mirror ? 1 : 0))
    // Pictures of samples and views between them, and a first live picture after those.
    expect(mix.frame(false, true, 5)).toBe(1)
    expect(live(false, 5.1)).toBe(0)
    expect(mix.frame(false, true, 5.2)).toBe(1)
    expect(mix.frame(false, false, 5.2)).toBe(0)
    expect(live(true, 5.3)).toBe(1)
    expect(live(false, 5.3 + 1 / 60)).toBe(0)
  })

  it('draws each of the two alone where the other has no share, and the two by their shares between', () => {
    const frag = (makeSlab().material as THREE.ShaderMaterial).fragmentShader
    const mirror = frag.indexOf('if (uReflect.x > 0.0) {')
    const baked = frag.indexOf('if (uReflect.y > 0.0) {')
    expect(mirror).toBeGreaterThan(0)
    expect(baked).toBeGreaterThan(mirror)
    expect(frag.slice(mirror, baked)).toContain('slabMirror(')
    expect(frag.slice(baked)).not.toContain('slabMirror(')
    for (const line of ['seen = far * uReflect.y + seen * uReflect.x;', 'image = near * uReflect.y + image * uReflect.x;', 'held = clamp(body + glass, 0.0, 1.0) * uReflect.y + held * uReflect.x;']) expect(frag, line).toContain(line)
    expect(frag).not.toMatch(/uReflect\.[xy] > 0\.5/)
  })
})

describe('a fragment of the inside whose varyings are no number', () => {
  it('is dropped: both tests of the outline are asked the way that is true for no number', () => {
    const from = STAGE_FRAG_PARS.indexOf('bool stageOutside() {')
    expect(from).toBeGreaterThan(0)
    const body = STAGE_FRAG_PARS.slice(from, STAGE_FRAG_PARS.indexOf('}', from) + 1)
    expect(body).toContain('if (!(vStageSeen > 0.0)) return true;')
    expect(body).toContain('return !(dot(c, c) <= uLens.x * uLens.x);')
    expect(body.split('\n').length, 'the lines of the function').toBe(5)
    // The same two tests in numbers. For a number they answer what the plain forms answer; for no number they answer true.
    const outside = (seen: number, d: number, r: number): boolean => {
      if (!(seen > 0)) return true
      return !(d <= r * r)
    }
    const plain = (seen: number, d: number, r: number): boolean => {
      if (seen <= 0) return true
      return d > r * r
    }
    for (const seen of [-1, 0, 1e-6, 0.25, 1]) for (const d of [0, 1, 2499.999, 2500, 2500.001, 1e9, Infinity]) expect(outside(seen, d, 50), `seen ${seen}, ${d}`).toBe(plain(seen, d, 50))
    expect(outside(Number.NaN, 0, 50), 'seen is no number').toBe(true)
    expect(outside(1, Number.NaN, 50), 'the place is no number').toBe(true)
    expect(plain(Number.NaN, Number.NaN, 50), 'the plain forms kept it').toBe(false)
  })
})
