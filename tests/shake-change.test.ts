import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { config, shots, tiers } from '../src/config'
import { FRAME } from '../src/app/framing'
import * as THREE from 'three'
import { GLASS_COME, GLASS_LEAVE, GUST_CLOSES, GUST_LAST_DOWN, GUST_LAST_DOWN_AT, MODE, makeHandle, PASS_EVEN, passCount, passLevel, passShare, passSpread, passStep, passStride, setPresence, STAGE_FRAG_PARS, stageUniforms, stillLevel } from '../src/core/materials'
import { STILL_SIDE, stillBytes } from '../src/core/still'
import { BASE_PASS, CHANGE_COVER, DRESSING_CHANGE, changeBloom, changeRamp, changeShown, changeSpan, coverShown, LEAVE_OUT, leaveKept, leaveOut, partChange, PILED_LEAVE, piledLeft, SEASONAL_PARTS, VEIL_LEAVE, veilCrossed } from '../src/shake/change'
import { shakeMotion } from '../src/shake/table'
import { loopMoment, timelineMoment } from '../src/film/moments'
import { loopSeconds } from '../src/film/loop'
import { eventSeconds, filmTimeline, stillTimeline, type ShakeEvent, type Timeline } from '../src/film/timeline'
import { CHANGE_BLOOM } from '../src/scene/lighting'
import { LUMPS_LEAVE, makeSlab, REFLECT_MIX, ReflectMix, reflectStep } from '../src/scene/surface'
import { STILL_FILE, stillSource } from '../tools/lib/stilltile.mjs'

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

  it('lets the last of a veil that leaves late go by ratio, on past the end of the window under the tail of the cover, and never in one frame', () => {
    const V = VEIL_LEAVE
    const frame = FRAME_BEATS / WINDOW
    const left = (c: number): number => 1 - veilCrossed(c)
    // Up to `ratioFrom` it is the late crossing it was, the power of the place: a sixth of the way at the middle of the window.
    for (const c of [0.1, 0.5, 0.74, V.ratioFrom]) expect(veilCrossed(c)).toBeCloseTo(Math.pow(c, V.late), 12)
    expect(veilCrossed(0)).toBe(0)
    expect(veilCrossed(-1)).toBe(0)
    expect(veilCrossed(0.5)).toBeGreaterThan(0.15)
    expect(veilCrossed(0.5)).toBeLessThan(0.2)
    // Under half where the base begins to change, so the storm of the season that leaves stands through the swap.
    expect(veilCrossed(changeSpan('base').from)).toBeLessThan(0.5)
    // It never runs back, is whole at the end of the cover's tail to the last bit and stays whole.
    let before = 0
    for (let c = 0; c <= CHANGE_COVER.tailTo + 2 * frame; c += frame / 8) {
      const v = veilCrossed(c)
      expect(v, `at ${c}`).toBeGreaterThanOrEqual(before)
      expect(v).toBeLessThanOrEqual(1)
      before = v
    }
    expect(veilCrossed(CHANGE_COVER.tailTo)).toBe(1)
    expect(veilCrossed(CHANGE_COVER.tailTo + frame)).toBe(1)
    expect(veilCrossed(2)).toBe(1)
    expect(left(CHANGE_COVER.tailTo - frame / 1000)).toBeLessThan(1e-4)
    // No break where the law changes: the same value and the same pace on both sides.
    const e = 1e-6
    expect(left(V.ratioFrom + e)).toBeCloseTo(left(V.ratioFrom - e), 5)
    expect((left(V.ratioFrom) - left(V.ratioFrom + e)) / e).toBeCloseTo((left(V.ratioFrom - e) - left(V.ratioFrom)) / e, 3)
    // The old law, carried to the end of the window: on the film's last frame inside the window 5 hundredths of the veil
    // stood, enough of a bank to hide what is behind it, and the frame after had none.
    const lastInside = 1 - frame * 0.75
    expect(1 - Math.pow(lastInside, V.late)).toBeGreaterThan(0.05)
    // Now what is left goes on by ratio: on every frame from `ratioFrom` until a hundredth of the veil is left it loses
    // between a quarter and a third of itself, so a bank thins as a haze does and opens over half a dozen frames.
    let most = 0
    let least = 1
    let framesToHundredth = 0
    for (let c = V.ratioFrom; left(c) > 0.01; c += frame / 4) {
      const r = left(c + frame) / left(c)
      most = Math.max(most, r)
      least = Math.min(least, r)
      framesToHundredth += 0.25
    }
    expect(least).toBeGreaterThan(0.66)
    expect(most).toBeLessThan(0.78)
    expect(framesToHundredth).toBeGreaterThan(10)
    // Some of it stands at the end of the window, under a tenth, and under a hundredth four frames before the cover's tail ends.
    expect(left(1)).toBeGreaterThan(0.05)
    expect(left(1)).toBeLessThan(0.1)
    expect(left(CHANGE_COVER.tailTo - 4 * frame)).toBeLessThan(0.01)
    // From one frame of the film to the next, anywhere, the veil never crosses by more than seven hundredths.
    let step = 0
    for (let c = 0; c <= CHANGE_COVER.tailTo; c += frame / 8) step = Math.max(step, veilCrossed(c + frame) - veilCrossed(c))
    expect(step).toBeLessThan(0.07)
    // The stage crosses the veil by this where the season that leaves has the thicker veil, and lays the shared veil from
    // the season that left while the last of it goes (frame.ts, `withVeilLeft`).
    const stage = readFileSync('src/scene/stage.ts', 'utf8')
    expect(stage).toContain('f.mix.veil = (f.left ?? a.kit).veil.density >= b.kit.veil.density ? veilCrossed(place) : veil')
    expect(stage).toContain('withVeilLeft(f, updateVeil)')
    expect(stage.split('updateVeil(').length - 1).toBe(0)
  })

  it('changes everything that stands outside the glass in one span of a few frames', () => {
    const span = changeSpan('base')
    for (const part of OUTSIDE) expect(changeSpan(part), part).toEqual(span)
    expect(span.lag).toBe(0)
    const frames = ((span.to - span.from) * WINDOW) / FRAME_BEATS
    expect(frames).toBeGreaterThanOrEqual(2)
    expect(frames).toBeLessThanOrEqual(4)
  })

  it('carries what lies on the table out before the base passes and in after it, as motion, and never lays two seasons there', () => {
    const frame = FRAME_BEATS / WINDOW
    const span = changeSpan('base')
    const d = DRESSING_CHANGE
    // The heaps of the slab sink with the old dressing and rise with the new, and the table never carries both.
    expect(changeSpan('surface-leave')).toEqual({ from: d.leaveFrom, to: d.leaveTo, lag: 0 })
    expect(changeSpan('surface-come')).toEqual({ from: d.comeFrom, to: d.comeTo, lag: 0 })
    for (let c = 0; c <= 1; c += 0.001) expect(partChange('surface-leave', c) < 1 && partChange('surface-come', c) > 0, `a heap of both seasons at ${c}`).toBe(false)
    // The old leaves over six frames, long enough for the eye to follow it as motion, and nothing on the table moves before.
    expect(d.liftFrom).toBe(d.leaveFrom)
    expect((d.leaveTo - d.leaveFrom) / frame).toBeGreaterThanOrEqual(5 - 1e-9)
    expect((d.leaveTo - d.leaveFrom) / frame).toBeLessThanOrEqual(6 + 1e-9)
    // It leaves ahead of the peak: while the cover rises, and the last of it is gone as the base begins to pass.
    expect(d.leaveFrom).toBeGreaterThan(CHANGE_COVER.riseFrom)
    expect(d.leaveTo).toBe(BASE_PASS.from)
    expect(d.leaveTo).toBeLessThanOrEqual(CHANGE_COVER.fullFrom)
    // The table is bare while the base passes, so through the span and through the whole cover.
    expect(d.leaveTo).toBeLessThanOrEqual(span.from)
    expect(d.comeFrom).toBeGreaterThanOrEqual(span.to)
    expect(d.comeFrom).toBe(BASE_PASS.to)
    expect(d.comeFrom).toBeGreaterThanOrEqual(CHANGE_COVER.fullTo)
    // The new comes with the cover's tail, over four frames and more, and is whole inside the window.
    expect((d.comeTo - d.comeFrom) / frame).toBeGreaterThanOrEqual(4)
    expect(d.comeTo).toBe(CHANGE_COVER.goneAt)
    expect(d.comeTo).toBeLessThan(1)
    expect(d.comeTo).toBeLessThan(CHANGE_COVER.tailTo)
    // While what lies on the table is on its way, everything that stands outside the glass is one season: the one that
    // leaves while the old dressing goes, the one that has come while the new comes down. The base's own pass is included.
    for (let c = 0; c <= 1; c += frame / 64) {
      const leaving = partChange('surface-leave', c) > 0 && partChange('surface-leave', c) < 1
      const coming = partChange('surface-come', c) > 0 && partChange('surface-come', c) < 1
      if (!leaving && !coming) continue
      for (const part of OUTSIDE) expect(partChange(part, c), `${part} at ${c}`).toBe(leaving ? 0 : 1)
      expect(c <= BASE_PASS.from || c >= BASE_PASS.to, `the base passes at ${c}`).toBe(true)
    }
  })

  it('takes what lies on the table as one piece out along it, whole in every sample, and at even shares of the shutter where the samples of a frame join', () => {
    const frame = FRAME_BEATS / WINDOW
    const shutter = (config.film.shutterDegrees / 360) * frame
    const d = DRESSING_CHANGE
    const REACH = 200
    const THIN = 150
    const STILL = { run: 0, out: 0, behind: 0, ahead: 0, of: 0, kept: 1 }
    const law = (c: number): number => REACH * partChange('surface-leave', c) ** 2
    // In a change that does not take it away, and at rest, the thing lies where it lay whatever the change number says.
    for (const c of [0, d.leaveFrom, (d.leaveFrom + d.leaveTo) / 2, d.leaveTo, 1]) {
      expect(leaveOut(false, c, null, REACH, THIN)).toEqual(STILL)
      expect(leaveOut(false, c, { t: 0.3, of: 24, hold: c }, REACH, THIN)).toEqual(STILL)
    }
    // In one that does, it lies still until the leaving begins and is gone when it ends.
    expect(leaveOut(true, 0, null, REACH, THIN)).toEqual(STILL)
    expect(leaveOut(true, d.leaveFrom, null, REACH, THIN)).toEqual(STILL)
    const last = leaveOut(true, d.leaveTo, null, REACH, THIN)
    expect(last.run).toBe(1)
    expect(last.out).toBeCloseTo(REACH, 9)
    expect(last.kept).toBeCloseTo(0, 9)
    // On the way it only goes out, from rest (under a millimetre in the first quarter of a frame, so no frame is a step
    // from the still one), faster and faster, and it thins only past `thinFromMm`.
    expect(leaveOut(true, d.leaveFrom + frame / 4, null, REACH, THIN).out).toBeLessThan(1)
    let before = 0
    let pace = 0
    for (let c = d.leaveFrom; c <= d.leaveTo + 1e-12; c += frame / 64) {
      const go = leaveOut(true, c, null, REACH, THIN)
      expect(go.out).toBeGreaterThanOrEqual(before)
      expect(go.out - before).toBeGreaterThanOrEqual(pace - 1e-9)
      expect(go.kept).toBeCloseTo(Math.min(1, (REACH - go.out) / (REACH - THIN)), 12)
      if (go.out <= THIN) expect(go.kept).toBe(1)
      expect([go.behind, go.ahead, go.of]).toEqual([0, 0, 0])
      pace = go.out - before
      before = go.out
    }
    // A frame of fewer samples than `join`, a sample that does not say where its frame began, and the page's one sample
    // a frame hold the thing at the sample's own moment, sharp: nothing is read along the way.
    const mid = d.leaveFrom + 2.3 * frame
    for (const sample of [null, { t: 0.4 }, { t: 0.4, of: 24 }, { t: 0.4, of: LEAVE_OUT.join - 1, hold: mid - shutter / 2 }, { t: 0.4, of: 2, hold: mid - shutter / 2 }]) {
      const go = leaveOut(true, mid, sample, REACH, THIN)
      expect(go.out).toBe(law(mid))
      expect([go.behind, go.ahead, go.of]).toEqual([0, 0, 0])
    }
    // From `join` samples on the copies lie at even shares of the shutter from the frame's first sample on, a sample's
    // share being its rank in time: wherever in its share a sample is taken, and whatever change number its own moment
    // has, it draws the thing at the same place. The grain of each copy reaches to the copy `tent` steps behind it and
    // the copy `tent` steps ahead of it, so the tents of neighbours add up to the same at every place between.
    expect(LEAVE_OUT.join).toBe(PASS_EVEN)
    expect(LEAVE_OUT.tent).toBeGreaterThanOrEqual(2)
    for (const of of [LEAVE_OUT.join, 24, 41]) {
      for (const hold of [d.leaveFrom - shutter / 3, d.leaveFrom + 1.2 * frame, d.leaveFrom + 4.7 * frame, d.leaveTo - shutter / 2]) {
        const copies = Array.from({ length: of }, (_, k) => leaveOut(true, hold + ((k + 0.5) / of) * shutter, { t: (k + 0.5) / of, of, hold }, REACH, THIN))
        for (let k = 0; k < of; k++) {
          const go = copies[k]!
          const at = hold + (k / of) * shutter
          expect(go.of).toBe(of)
          expect(go.out).toBeCloseTo(law(at), 12)
          expect(go.run).toBeCloseTo(partChange('surface-leave', at), 12)
          for (const [t, change] of [[(k + 0.02) / of, 0.1], [(k + 0.98) / of, 0.9]] as const) expect(leaveOut(true, change, { t, of, hold }, REACH, THIN)).toEqual(go)
          expect(go.behind).toBeGreaterThanOrEqual(0)
          expect(go.ahead).toBeGreaterThanOrEqual(0)
          expect(go.out - go.behind).toBeCloseTo(law(at - (LEAVE_OUT.tent * shutter) / of), 12)
          expect(go.out + go.ahead).toBeCloseTo(law(at + (LEAVE_OUT.tent * shutter) / of), 12)
          if (k + LEAVE_OUT.tent < of) expect(go.out + go.ahead).toBeCloseTo(copies[k + LEAVE_OUT.tent]!.out, 9)
          if (k >= LEAVE_OUT.tent) expect(go.out - go.behind).toBeCloseTo(copies[k - LEAVE_OUT.tent]!.out, 9)
        }
      }
    }
    // The sand, the frost and the lumps of snow read this one law and none of them works the span out for itself.
    for (const file of ['src/seasons/summer/slab.ts', 'src/seasons/winter/frost.ts', 'src/scene/surface.ts']) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).toContain('leaveOut(')
      expect(text, file).not.toContain("partChange('surface-leave'")
    }
  })

  it("takes a pile's own light from it as it goes, and the pile from the table before what it lies on begins to thin", () => {
    const P = PILED_LEAVE
    const d = DRESSING_CHANGE
    // One share for everything that thins on its way: 1 until it begins, 0 from where it is gone, a straight line between.
    expect(leaveKept(0, 80, 40)).toBe(1)
    expect(leaveKept(40, 80, 40)).toBe(1)
    expect(leaveKept(60, 80, 40)).toBeCloseTo(0.5, 12)
    expect(leaveKept(80, 80, 40)).toBe(0)
    expect(leaveKept(500, 80, 40)).toBe(0)
    // `leaveOut` reads it for the thing itself, to the last bit.
    for (let k = 0; k <= 96; k++) {
      const go = leaveOut(true, d.leaveFrom + ((d.leaveTo - d.leaveFrom) * k) / 96, null, LUMPS_LEAVE.reachMm, LUMPS_LEAVE.thinFromMm)
      expect(go.kept).toBe(leaveKept(go.out, LUMPS_LEAVE.reachMm, LUMPS_LEAVE.thinFromMm))
    }
    // At rest, and in a change that does not take the thing away, a pile has all of its light and all of itself: 1 and 1.
    expect(piledLeft(0)).toEqual({ lit: 1, kept: 1 })
    for (const c of [0, d.leaveFrom, (d.leaveFrom + d.leaveTo) / 2, 1]) expect(piledLeft(leaveOut(false, c, null, LUMPS_LEAVE.reachMm, LUMPS_LEAVE.thinFromMm).out)).toEqual({ lit: 1, kept: 1 })
    expect(piledLeft(leaveOut(true, d.leaveFrom, null, LUMPS_LEAVE.reachMm, LUMPS_LEAVE.thinFromMm).out)).toEqual({ lit: 1, kept: 1 })
    // The light falls from the first of the way, with no step from the still pile, and only falls: by the square of what
    // is left of the way to `darkMm`, where it is out. The pile only thins, from `thinFromMm` to `goneMm`.
    expect(piledLeft(1).lit).toBeGreaterThan(0.95)
    let before = { lit: 1, kept: 1 }
    for (let out = 0; out <= LUMPS_LEAVE.reachMm; out += 0.25) {
      const now = piledLeft(out)
      expect(now.lit).toBeCloseTo(Math.max(0, 1 - out / P.darkMm) ** 2, 12)
      expect(now.kept).toBe(leaveKept(out, P.goneMm, P.thinFromMm))
      expect(now.lit).toBeLessThanOrEqual(before.lit)
      expect(now.kept).toBeLessThanOrEqual(before.kept)
      if (out <= P.thinFromMm) expect(now.kept).toBe(1)
      if (out >= P.darkMm) expect(now.lit).toBe(0)
      if (out >= P.goneMm) expect(now.kept).toBe(0)
      before = now
    }
    // The order of it: the pile is whole until its own light is all but out, so it is never seen thin and bright; its light
    // is out while most of it is still there, so what thins away is lit as the frost beside it; and it is gone before the
    // thing it lies on begins to thin.
    expect(P.thinFromMm).toBeGreaterThan(0)
    expect(piledLeft(P.thinFromMm).lit).toBeLessThan(0.05)
    expect(piledLeft(P.darkMm).kept).toBeGreaterThan(0.7)
    expect(P.goneMm).toBeLessThanOrEqual(LUMPS_LEAVE.thinFromMm)
    // Winter's frost reads these shares and works none of them out for itself. The piled snow (the shapes) thins by the
    // pile's share and the sheet by the frost's; the heap's own light takes its share in the leaving alone, so at rest the
    // shader reads nothing new.
    const text = readFileSync('src/seasons/winter/frost.ts', 'utf8')
    const shader = (name: string): string => {
      const open = `\nconst ${name} = \`\n`
      const at = text.indexOf(open)
      expect(at, name).toBeGreaterThanOrEqual(0)
      return text.slice(at + open.length, text.indexOf('`\n', at + open.length))
    }
    expect(text).toContain('const pile = piledLeft(go.out)\n  frostUniforms.uGonePile.value.set(pile.lit, pile.kept)')
    expect(text).not.toContain('PILED_LEAVE.')
    expect(text).toContain('uGonePile: { value: new THREE.Vector2(1, 1) }')
    const shapes = shader('SHAPES')
    expect(shapes.split('uGonePile.y').length).toBe(3)
    expect(shapes).toContain('if (alpha * uGonePile.y < 0.012) discard;')
    expect(shapes).not.toContain('uGoneAt.w')
    const sheet = shader('SHEET')
    expect(sheet).toContain('cover *= uGoneAt.w;')
    expect(sheet).not.toContain('uGonePile')
    const light = shader('SLAB_GLSL')
    expect(light.split('uGonePile').length).toBe(2)
    expect(light).toContain('if (uGone.x > 0.0) own *= uGonePile.x;')
    expect(light).toContain('0.45) * own);')
  })

  it('raises a cover that comes up fast, is whole across the span and dies away as a tail past the end of the window', () => {
    const span = changeSpan('base')
    const cover = CHANGE_COVER
    const frame = FRAME_BEATS / WINDOW
    expect(cover.riseFrom).toBeLessThan(cover.fullFrom)
    expect(cover.fullFrom).toBeLessThan(span.from)
    expect(cover.fullTo).toBeGreaterThan(span.to)
    expect(cover.goneAt).toBeGreaterThan(cover.fullTo)
    // The tail runs on past the end of the window: there the place is read from the beat (`coverPlace`).
    expect(cover.tailTo).toBeGreaterThan(cover.goneAt)
    expect(cover.tailTo).toBeGreaterThan(1)
    for (const c of [-1, 0, cover.riseFrom, cover.tailTo, 2, Number.NaN]) expect(changeBloom(c)).toBe(0)
    let before = 0
    let lit = 0
    for (let c = 0; c <= 1.5; c += 0.001) {
      const v = changeBloom(c)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      if (c < cover.fullFrom) expect(v).toBeGreaterThanOrEqual(before - 1e-12)
      else if (c > cover.fullTo) expect(v).toBeLessThanOrEqual(before + 1e-12)
      else expect(v, `cover at ${c}`).toBe(1)
      before = v
      if (v > 0) lit += 0.001
      expect(v > 0, `lit at ${c}`).toBe(c > cover.riseFrom && c < cover.tailTo)
      if (partChange('base', c) > 0 && partChange('base', c) < 1 && (c < span.from || c > span.to)) throw new Error('the base is changing outside its span')
    }
    // Up fast: the rise takes ten to twelve frames. What is eased is the picture, how far it has gone under the cover
    // (`coverShown`), and not the exponent the cover is: a glass that burns near white answers the exponent less the higher
    // it stands. The rise neither starts nor lands on a step: its first frame and its last each bring less than half of
    // what a frame of its middle brings, and no frame brings more than a ninth of the picture, which on the glass that
    // stands lowest before its cover (47 levels of 255 under the whole cover's) is under five and a half levels.
    const rise = (cover.fullFrom - cover.riseFrom) / frame
    expect(rise, 'frames of rise').toBeGreaterThanOrEqual(10)
    expect(rise, 'frames of rise').toBeLessThanOrEqual(12)
    const shown = (c: number): number => coverShown(changeBloom(c))
    const up = (n: number): number => shown(cover.riseFrom + n * frame) - shown(cover.riseFrom + (n - 1) * frame)
    const middle = up(Math.ceil(rise / 2))
    expect(up(1)).toBeLessThan(middle / 2)
    expect(up(Math.round(rise))).toBeLessThan(middle / 2)
    for (let n = 1; n <= Math.round(rise); n++) {
      expect(up(n), `frame ${n} of the rise`).toBeGreaterThan(0)
      expect(up(n), `frame ${n} of the rise`).toBeLessThanOrEqual(1 / 9)
    }
    // Then a tail that dies away: twelve to eighteen frames from the whole cover. Its pace comes up over its first three
    // frames, a shoulder and no corner. From there each frame takes less of the picture than the one before, none of them
    // more than a twelfth of it or so, and the last takes under a fiftieth, so it never blinks off.
    const tail = (cover.tailTo - cover.fullTo) / frame
    expect(tail, 'frames of tail').toBeGreaterThanOrEqual(12)
    expect(tail, 'frames of tail').toBeLessThanOrEqual(18)
    let step = Infinity
    for (let n = 1; n <= Math.round(tail); n++) {
      const fall = shown(cover.fullTo + (n - 1) * frame) - shown(cover.fullTo + n * frame)
      expect(fall, `frame ${n} of the tail`).toBeGreaterThan(0)
      expect(fall, `frame ${n} of the tail`).toBeLessThan(0.085)
      if (n > 4) expect(fall, `frame ${n} of the tail`).toBeLessThan(step)
      else if (n > 1) expect(fall, `frame ${n} of the tail`).toBeGreaterThan(step)
      step = fall
    }
    expect(shown(cover.fullTo) - shown(cover.fullTo + frame), 'the first frame of the tail').toBeLessThan((shown(cover.fullTo + 2 * frame) - shown(cover.fullTo + 3 * frame)) / 2)
    expect(shown(cover.tailTo - frame)).toBeLessThan(0.02)
    expect(changeBloom(cover.tailTo - frame)).toBeLessThan(0.01)
    // The cover is whole for a few frames, and the part of it that hides, the rise and the whole, is under three tenths of a second.
    expect((cover.fullTo - cover.fullFrom) / frame, 'frames of the whole cover').toBeLessThanOrEqual(5)
    expect((cover.fullTo - cover.riseFrom) * WINDOW * BEAT_S).toBeLessThan(0.3)
    expect(changeBloom(0.02)).toBe(0)
    // The end of the window lies in the tail, where the picture still shows over half of the cover, and the whole of the
    // cover, tail and all, is under six tenths of a second.
    expect(changeBloom(0.99)).toBeGreaterThan(0.2)
    expect(changeBloom(0.99)).toBeLessThan(0.5)
    expect(shown(0.99)).toBeGreaterThan(0.5)
    expect(changeBloom(1)).toBeLessThan(changeBloom(0.99))
    expect(lit * WINDOW * BEAT_S).toBeLessThan(0.6)
  })

  it('turns the cover by the storm that is in the glass: on the tail into fall the cover is the share of the picture itself', () => {
    const cover = CHANGE_COVER
    const frame = FRAME_BEATS / WINDOW
    // What the cover is made to show is one law for every change: nothing before the rise and from the tail's end, all of
    // the picture while the cover is whole.
    for (const c of [-1, 0, cover.riseFrom, cover.tailTo, 2, Number.NaN]) expect(changeShown(c)).toBe(0)
    for (const c of [cover.fullFrom, (cover.fullFrom + cover.fullTo) / 2, cover.fullTo]) expect(changeShown(c)).toBe(1)
    // Seven storms answer the cover by one law (`coverShown`): for them the cover is the exponent that shows so much.
    for (let c = 0; c <= cover.tailTo + frame; c += frame / 8) {
      expect(coverShown(changeBloom(c)), `what the cover shows at ${c}`).toBeCloseTo(changeShown(c), 12)
      for (const came of ['winter', 'spring', 'summer']) expect(changeBloom(c, came)).toBe(changeBloom(c))
      // Up to the end of the whole cover the storm in the glass is the one that leaves, so the season that comes says nothing.
      if (c <= cover.fullTo) expect(changeBloom(c, 'fall')).toBe(changeBloom(c))
    }
    // Fall's storm as its change has just brought it answers the cover evenly. Turned by the law of the seven, the exponent
    // falls by 0.16 in the steepest frame of the tail and is under three tenths after seven, where the picture is meant to
    // show over half of the cover still: on fall's glass that was 86 in 100 of the cover gone where 47 were meant, and 9.6
    // levels of 255 in one frame.
    let old = 0
    for (let n = 1; n <= 18; n++) old = Math.max(old, changeBloom(cover.fullTo + (n - 1) * frame) - changeBloom(cover.fullTo + n * frame))
    expect(old).toBeGreaterThan(0.15)
    expect(changeBloom(cover.fullTo + 7 * frame)).toBeLessThan(0.3)
    expect(changeShown(cover.fullTo + 7 * frame)).toBeGreaterThan(0.5)
    // So on that tail the cover is the share itself: it leaves the whole cover with no step, takes under 0.086 of itself in
    // any frame, each frame after the sixth less than the one before, and ends on nothing.
    expect(changeBloom(cover.fullTo, 'fall')).toBe(1)
    expect(changeBloom(cover.fullTo + frame / 1000, 'fall')).toBeGreaterThan(0.9999)
    let step = Infinity
    for (let n = 1; n <= 18; n++) {
      const at = cover.fullTo + n * frame
      expect(changeBloom(at, 'fall'), `the cover on the tail into fall at frame ${n}`).toBe(changeShown(at, 'fall'))
      const fall = changeBloom(at - frame, 'fall') - changeBloom(at, 'fall')
      expect(fall, `frame ${n} of the tail into fall`).toBeGreaterThan(0)
      expect(fall, `frame ${n} of the tail into fall`).toBeLessThan(0.086)
      if (n > 6) expect(fall, `frame ${n} of the tail into fall`).toBeLessThan(step)
      step = fall
    }
    expect(changeBloom(cover.tailTo - frame, 'fall')).toBeLessThan(0.02)
    for (const c of [cover.tailTo, cover.tailTo + frame, 2]) expect(changeBloom(c, 'fall')).toBe(0)
    // Its shoulder is five frames where the others' is three: fall's glass stands at the white of the film under the whole
    // cover and its storm loses light of its own in the tail's second and third frames, so the full pace of the fall comes
    // past them. In its first three frames that tail takes under 0.08 of the cover where the others' takes over 0.12, it is
    // never under the others' on the way down, and what the picture shows is told by the same season.
    for (const came of ['winter', 'spring', 'summer']) for (let n = 0; n <= 19; n++) expect(changeShown(cover.fullTo + n * frame, came)).toBe(changeShown(cover.fullTo + n * frame))
    expect(1 - changeShown(cover.fullTo + 3 * frame, 'fall')).toBeLessThan(0.08)
    expect(1 - changeShown(cover.fullTo + 3 * frame)).toBeGreaterThan(0.12)
    for (let n = 1; n < 18; n++) expect(changeShown(cover.fullTo + n * frame, 'fall'), `frame ${n}`).toBeGreaterThan(changeShown(cover.fullTo + n * frame))
    for (let c = 0; c <= cover.fullTo; c += frame / 8) expect(changeShown(c, 'fall')).toBe(changeShown(c))
    // The stage asks for the cover and for what the picture shows by the season that comes.
    const stage = readFileSync('src/scene/stage.ts', 'utf8')
    expect(stage).toContain('f.mix.shown = changeShown(place, b.kit.season)')
    expect(stage).toContain('f.mix.bloom = changeBloom(place, b.kit.season)')
  })

  it('holds no picture, of the film or live, with anything that stands outside the glass between two seasons and the cover not whole', () => {
    const frame = FRAME_BEATS / WINDOW
    const shutter = SHUTTER_S / BEAT_S / WINDOW
    // What lies on the table is not in this: it leaves before the base passes and comes after it, in sight, and its own test
    // above holds that everything else outside the glass is one season while it does.
    const between = (c: number): boolean => OUTSIDE.some((part) => partChange(part, c) > 0 && partChange(part, c) < 1)
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
    // The new pieces come down in sight, with the cover's tail, and the last of them while a third of the cover still stands.
    expect(GUST_LAST_DOWN_AT).toBeGreaterThan(CHANGE_COVER.fullTo)
    expect(GUST_LAST_DOWN_AT).toBeLessThan(1)
    expect(changeShown(GUST_LAST_DOWN_AT)).toBeGreaterThan(0.33)
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
    expect(changeBloom(GLASS_LEAVE.start)).toBe(0)
    for (const c of [GLASS_LEAVE.start + GLASS_LEAVE.length, GLASS_COME.start]) expect(changeBloom(c)).toBe(1)
    // The new comes while the picture still shows over half of the cover (`coverShown`: the exponent itself is under a third
    // by then, and the glass still burns): the cover's tail runs on after it. At every instant of its coming more of the
    // cover stands than under a straight fall to `goneAt`.
    expect(coverShown(changeBloom(GLASS_COME.start + GLASS_COME.length))).toBeGreaterThan(0.5)
    for (let i = 0; i <= 64; i++) {
      const c = GLASS_COME.start + (GLASS_COME.length * i) / 64
      expect(changeBloom(c), `the cover at ${i} of 64 of the coming`).toBeGreaterThanOrEqual(1 - (c - CHANGE_COVER.fullTo) / (CHANGE_COVER.goneAt - CHANGE_COVER.fullTo) - 1e-12)
    }
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
    // The share that has passed is read in the base's branch of `stageChange`, from the frame's own place (`uPass.z`).
    const change = /\nfloat stageChange\(\) \{\n([\s\S]*?)\n\}\n/.exec(STAGE_FRAG_PARS)?.[1] ?? ''
    expect(/if \(uState\.z < -9\.0\) \{\s*float pass = ([^;]+);/.exec(change)?.[1]).toBe(`clamp(((uPass.z - uState.x) / uState.y + ${(-from).toFixed(4)}) / ${long.toFixed(4)}, 0.0, 1.0)`)
    // The pass is longer than the whole cover. Outside the whole cover the room stands under a fiftieth of its light, and no more than an eighth of the base is the other season's.
    const passed = (c: number): number => Math.min(1, Math.max(0, (c - BASE_PASS.from) / (BASE_PASS.to - BASE_PASS.from)))
    for (let i = 0; i <= 240; i++) {
      const c = BASE_PASS.from + ((BASE_PASS.to - BASE_PASS.from) * i) / 240
      const cover = changeBloom(c)
      expect(Math.pow(CHANGE_BLOOM.dim, cover), `the room at ${i} of 240 of the pass`).toBeLessThan(0.02)
      if (cover < 1) expect(Math.min(passed(c), 1 - passed(c)), `the other base at ${i} of 240 of the pass`).toBeLessThanOrEqual(0.125 + 1e-9)
    }
  })

  it("holds the new base in the share of a frame's samples that has passed: from eight samples on in the same number at every pixel, with fewer the odd sample shared out among the pixels by the still tile, and one base or the other in each", () => {
    // What a captured frame holds a base's pixel against: the pixel's own hash, set at the middle of one of the frame's levels and stepped with the sample.
    const gone = /\nbool stageGone\(float c\) \{\n([\s\S]*?)\n\}\n/.exec(STAGE_FRAG_PARS)?.[1] ?? ''
    const body = /if \(uState\.z < -9\.0\) \{([^}]+)\}/.exec(gone)?.[1]?.replace(/\s+/g, ' ').trim()
    expect(body).toBe('h = stageHash(vec3(gl_FragCoord.xy, uPass.x)); if (uPass.w > 1.5) h = (floor(h * uPass.w) + 0.5) / uPass.w; h = fract(h + uPass.y);')
    expect(gone).toContain('gone = uState.w > 1.5 ? h < c : h >= c;')
    // And the share it is held against: the share that has passed, and in a frame of two to seven samples the whole number of
    // samples under that share times the count plus the pixel's own level on the still tile, as a share of the count.
    const change = /\nfloat stageChange\(\) \{\n([\s\S]*?)\n\}\n/.exec(STAGE_FRAG_PARS)?.[1] ?? ''
    expect(PASS_EVEN).toBe(8)
    expect(/float pass = [^;]+;\s*([^;]+;)/.exec(change)?.[1]).toBe('return uPass.w > 1.5 && uPass.w < 7.5 ? floor(pass * uPass.w + stageStill(ivec2(gl_FragCoord.xy))) / uPass.w : pass;')
    expect(STAGE_FRAG_PARS.indexOf('float stageStill(ivec2 at);')).toBeLessThan(STAGE_FRAG_PARS.indexOf('float stageChange() {'))
    for (const share of [0, 0.3, 0.77, 1]) {
      for (const level of [0.002, 0.5, 0.998]) {
        for (const n of [0, 1, PASS_EVEN, 24]) expect(passShare(share, n, level)).toBe(share)
        for (let n = 2; n < PASS_EVEN; n++) expect(passShare(share, n, level)).toBe(Math.floor(share * n + level) / n)
      }
    }
    const counts = Object.values(tiers).map((t) => t.samplesPerFrame)
    expect(counts.some((n) => n >= 24)).toBe(true)
    expect(counts.some((n) => n < PASS_EVEN)).toBe(true)
    for (const n of counts) {
      expect(n).toBeGreaterThan(1)
      // 487 is prime, so no share of this row stands on a level, where the last bit of a sum would say which side it falls.
      for (let k = 0; k <= 487; k++) {
        const c = k / 487
        if (n >= PASS_EVEN) {
          let least = n
          let most = 0
          for (let j = 0; j < 997; j++) {
            let m = 0
            for (let i = 0; i < n; i++) if (passLevel(j / 997, passStep((i + 0.5) / n, n), n) < passShare(c, n, 0.5)) m++
            least = Math.min(least, m)
            most = Math.max(most, m)
          }
          expect([least, most], `the samples of ${n} that hold the new base at the share ${k} of 487, the least and the most over 997 hashes`).toEqual([most, most])
          expect(Math.abs(most / n - c), `the share held of ${n} at ${k} of 487`).toBeLessThanOrEqual(0.5 / n + 1e-9)
          continue
        }
        // Of few samples the share to the nearest of them is a few states: a frame of two would hold the old base, half of each
        // or the new, and a pass of six frames would be two steps. So the pixels differ by one sample, by their level on the
        // tile: whatever its hash, a pixel holds the new base in the whole number of samples under the share times the count
        // plus its level, and over the 256 levels of the tile, each held by as many pixels as every other, that is the share itself.
        let sum = 0
        for (let b = 0; b < 256; b++) {
          const level = (b + 0.5) / 256
          const want = Math.floor(c * n + level)
          for (let j = 0; j < 97; j++) {
            let m = 0
            for (let i = 0; i < n; i++) if (passLevel(j / 97, passStep((i + 0.5) / n, n), n) < passShare(c, n, level)) m++
            if (m !== want) throw new Error(`a pixel at the level ${b} of the tile holds the new base in ${m} of ${n} samples at the share ${k} of 487, not in ${want}`)
          }
          if (Math.abs(want - c * n) >= 1) throw new Error(`a pixel at the level ${b} of the tile is a sample or more from the share ${k} of 487`)
          // A pixel that has taken a sample more keeps it as the share grows.
          if (k > 0 && want < Math.floor(((k - 1) / 487) * n + level)) throw new Error(`a pixel at the level ${b} of the tile gives a sample back at the share ${k} of 487`)
          sum += want
        }
        expect(Math.abs(sum / 256 / n - c), `the share the tile holds of ${n} at ${k} of 487`).toBeLessThanOrEqual(0.5 / 256 / n + 1e-9)
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
    // A frame of one sample that is captured: the plain hash against the share that has passed.
    expect(passStep(0.5, 1)).toBe(0)
    for (let j = 0; j < 997; j++) expect(passLevel(j / 997, 0, 1)).toBe(j / 997)
    // The level a pixel has on the tile is the one the page's own path reads (`stillLevel`): the middle of one of 256.
    for (const [x, y] of [[0, 0], [5, 77], [127, 127], [300, 41]] as const) expect((stillLevel(x, y) * 256 - 0.5) % 1).toBe(0)
  })

  it('holds the pattern still where the page draws one sample a frame, so a pixel goes once and stays gone, and leaves a captured frame as it was', () => {
    const body = /\nbool stageGone\(float c\) \{\n([\s\S]*?)\n\}\n/.exec(STAGE_FRAG_PARS)?.[1]
    expect(body?.split('\n').slice(0, 2)).toEqual(['  bool still = uPass.w < 0.5;', '  bool gone = still && stageGoneStill(c);'])
    // What a captured frame runs is every line after those two, and it is what it was before the page's own path left it, written with one exit.
    expect(body?.split('\n').slice(2).join('\n')).toBe(
      [
        '  if (!still && uState.w > 0.5) {',
        '    float h = stageHash(vec3(gl_FragCoord.xy, uSeed));',
        '    if (uState.z < -9.0) {',
        '      h = stageHash(vec3(gl_FragCoord.xy, uPass.x));',
        '      if (uPass.w > 1.5) h = (floor(h * uPass.w) + 0.5) / uPass.w;',
        '      h = fract(h + uPass.y);',
        '    } else if (stageEdge > -0.5) h = clamp(stageEdge + (h - 0.5) * 0.14, 0.001, 0.999);',
        '    gone = uState.w > 1.5 ? h < c : h >= c;',
        '  }',
        '  return gone || (!still && uFlags.w < 1.0 && stageHash(vec3(gl_FragCoord.xy + 29.0, uSeed + 0.61)) >= uFlags.w);',
      ].join('\n'),
    )
    // A captured frame never takes the page's branch, whatever its tier, and the page always does.
    expect(passCount(null)).toBe(0)
    expect(passCount({})).toBe(1)
    for (const t of Object.values(tiers)) expect(passCount({ of: t.samplesPerFrame })).toBe(t.samplesPerFrame)
    expect(readFileSync('src/scene/stage.ts', 'utf8')).toContain('const of = passCount(sample)\n    u.uPass.value.set(moment.seed, sample ? passStep(sample.t, of) : 0, single ? 0 : (sample?.hold ?? change), of)')

    const still = /\nbool stageGoneStill\(float c\) \{\n([\s\S]*?)\n\}\n/.exec(STAGE_FRAG_PARS)?.[1] ?? ''
    // Nothing in it reads the frame: no seed, no share of a pass, and no hash but the pixel's own.
    expect(still).not.toMatch(/uSeed|uPass|stageHash/)
    expect(still).toContain('float h = stageStill(ivec2(gl_FragCoord.xy));')
    expect(still).toContain('gone = uState.w > 1.5 ? h < c : h >= c;')
    expect(still).toContain('return gone || (uFlags.w < 1.0 && stageStill(ivec2(gl_FragCoord.yx) + 29) >= uFlags.w);')
    // The level is the middle of the byte the tile holds for the pixel, read whole and from nothing else.
    expect(STAGE_FRAG_PARS).toContain('uniform highp sampler2D uStill;')
    expect(STAGE_FRAG_PARS).toContain('float stageStill(ivec2 at) {\n  return (floor(texelFetch(uStill, at & 127, 0).r * 255.0 + 0.5) + 0.5) / 256.0;\n}')
    const picture = stageUniforms.uStill.value
    expect([picture.image.width, picture.image.height, picture.format, picture.type, picture.generateMipmaps, picture.flipY]).toEqual([STILL_SIDE, STILL_SIDE, THREE.RedFormat, THREE.UnsignedByteType, false, false])
    expect(STILL_SIDE).toBe(128)
    const tile = stillBytes()
    expect(Buffer.compare(Buffer.from(picture.image.data as Uint8Array), Buffer.from(tile))).toBe(0)
    // The tile in the source is the one its tool makes, and every level of it is held by as many pixels as every other.
    expect(readFileSync(STILL_FILE, 'utf8')).toBe(stillSource())
    const held = new Uint32Array(256)
    for (const b of tile) held[b]!++
    expect([Math.min(...held), Math.max(...held)]).toEqual([64, 64])
    let apart = 0
    for (let y = 0; y < STILL_SIDE; y++) for (let x = 0; x < STILL_SIDE; x++) if (stillLevel(x, y) !== (tile[y * STILL_SIDE + x]! + 0.5) / 256 || stillLevel(x + STILL_SIDE, y + 3 * STILL_SIDE) !== stillLevel(x, y)) apart++
    expect(apart).toBe(0)

    // The level is the pixel's and the rule is one comparison with the share, so as the share rises a pixel of the part that
    // leaves goes once, a pixel of the part that comes arrives once, and at every share a pixel holds one of the two.
    const N = 512
    const first = new Float32Array(N * N)
    const second = new Float32Array(N * N)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        first[y * N + x] = stillLevel(x, y)
        second[y * N + x] = stillLevel(y + 29, x + 29)
      }
    expect([first.reduce((a, b) => Math.min(a, b)) >= 0, first.reduce((a, b) => Math.max(a, b)) < 1]).toEqual([true, true])
    // Even to the eye. Every share of the pixels is the share asked for, to the pixel. Every patch of four by four holds that
    // share to three pixels of sixteen, and the patches taken together stand within 0.82 of a pixel of it (the root of the
    // mean square). The white hash this replaced left such patches empty at a half and full at an eighth, 1.3 to 2 pixels
    // from the share taken together.
    const bands: [number, number, number][] = [
      [0.125, 1, 4],
      [0.25, 2, 6],
      [0.5, 5, 11],
      [0.75, 9, 14],
    ]
    for (const [name, level] of [
      ['the exchange', first],
      ['the presence', second],
    ] as const)
      for (const [c, least, most] of bands) {
        let under = 0
        for (const h of level) if (h < c) under++
        expect(under / (N * N), `the share of ${name} at ${c}`).toBe(c)
        const rows = new Uint8Array(N * N)
        for (let y = 0; y < N; y++) for (let x = 0; x + 4 <= N; x++) rows[y * N + x] = (level[y * N + x]! < c ? 1 : 0) + (level[y * N + x + 1]! < c ? 1 : 0) + (level[y * N + x + 2]! < c ? 1 : 0) + (level[y * N + x + 3]! < c ? 1 : 0)
        let lo = 16
        let hi = 0
        let square = 0
        let patches = 0
        for (let y = 0; y + 4 <= N; y++)
          for (let x = 0; x + 4 <= N; x++) {
            const n = rows[y * N + x]! + rows[(y + 1) * N + x]! + rows[(y + 2) * N + x]! + rows[(y + 3) * N + x]!
            if (n < lo) lo = n
            if (n > hi) hi = n
            square += (n - 16 * c) ** 2
            patches++
          }
        expect([lo, hi], `what a patch of four by four holds of ${name} at ${c}, the least and the most`).toEqual([least, most])
        expect(Math.sqrt(square / patches), `how far the patches of ${name} stand from the share at ${c}`).toBeLessThanOrEqual(0.82)
      }
    // In no rows. Were the dots set on a lattice, a dot would find another at one and the same step from it nearly every time:
    // interleaved gradient noise, which this pattern was first, does at the step of 5 across and 9 up, 89 times of 100 at a
    // sixteenth and 99 of 100 at three quarters, and the eye reads the rows as a weave. Here no step within 12 pixels is
    // surer of a dot than the share itself by more than 7 of 100.
    for (const c of [1 / 16, 0.125, 0.25, 0.5, 0.75]) {
      let surest = 0
      for (let dy = -12; dy <= 12; dy++)
        for (let dx = -12; dx <= 12; dx++) {
          if (dx === 0 && dy === 0) continue
          let dots = 0
          let both = 0
          for (let y = 0; y < STILL_SIDE; y++)
            for (let x = 0; x < STILL_SIDE; x++)
              if (stillLevel(x, y) < c) {
                dots++
                if (stillLevel(x + dx + STILL_SIDE, y + dy + STILL_SIDE) < c) both++
              }
          surest = Math.max(surest, both / dots)
        }
      expect(surest - c, `how much surer than the share the surest step is of a dot at ${c}`).toBeLessThanOrEqual(0.07)
    }
    // The two levels of a pixel are not one level: a part that thins while it changes is not thinned twice by the same dots.
    let same = 0
    for (let i = 0; i < N * N; i++) if (first[i]! < 0.5 === second[i]! < 0.5) same++
    expect(Math.abs(same / (N * N) - 0.5), 'the pixels on the same side of a half in both').toBeLessThanOrEqual(0.02)
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
    expect(STAGE_FRAG_PARS).toContain('gone = uState.w > 1.5 ? h < c : h >= c;')
    expect(STAGE_FRAG_PARS).toContain('return gone || (!still && uFlags.w < 1.0 && stageHash(vec3(gl_FragCoord.xy + 29.0, uSeed + 0.61)) >= uFlags.w);')
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
    // The views that say which part a pixel is read the cover it has left, against a cut the frost holds: 0.3 in the plain
    // view, the picture's own floor where the lens fill's map asks, so no part of a frond takes its neighbour's reach.
    expect(frost).toContain('if (alpha * seen < uGlassThru.w) discard;')
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('viewCut: 0.3, mapCut: 0.004')
    expect(text).toContain('frostUniforms.uGlassThru.value.w = on ? look.glass.mapCut : look.glass.viewCut')
    // It is laid over what is behind it as one plus what its cover leaves.
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

describe('the season a change has left', () => {
  const beatsOf = (e: ShakeEvent): number => eventSeconds(e) / BEAT_S
  const at = (tl: Timeline, e: ShakeEvent, beat: number) => timelineMoment(tl, e.startSec + beat * BEAT_S, 1, 1)
  const closes = s.swapWindow.toBeat

  it('is named from the end of the swap window to the landing of a shake that changes the season, and nowhere else', () => {
    const tl = filmTimeline()
    const changes = tl.events.filter((e) => e.from !== e.to)
    expect(changes.map((e) => e.id)).toEqual(film)
    for (const e of changes) {
      expect(e.seconds, 'the film at its own tempo: a beat of a shake is a beat of the film').toBeUndefined()
      expect(beatsOf(e)).toBeGreaterThan(closes + 0.5)
      let named = 0
      for (let beat = 0; beat < beatsOf(e) - 1e-6; beat += FRAME_BEATS / 4) {
        const m = at(tl, e, beat)
        if (beat < closes - 1e-6) expect(m.left, `${e.id} at beat ${beat}`).toBeNull()
        else if (beat > closes + 1e-6) {
          expect(m.left, `${e.id} at beat ${beat}`).toBe(e.from)
          // The picture is of the season that came, alone: nothing but this field says a season has just gone.
          expect([m.season, m.from, m.to, m.change]).toEqual([e.to, e.to, e.to, 0])
          named++
        }
      }
      expect(named).toBeGreaterThan(100)
      // The frame on the end of the window is the first the stage draws with one season, and the first that names the other.
      const first = at(tl, e, closes)
      expect([first.season, first.from, first.to, first.change, first.left]).toEqual([e.to, e.to, e.to, 0, e.from])
      const last = at(tl, e, closes - FRAME_BEATS)
      expect([last.from, last.to, last.left]).toEqual([e.from, e.to, null])
      expect(last.change).toBeGreaterThan(0.9)
      // At the landing and at rest after it.
      for (const after of [0, 1e-6, 0.5, 2]) expect(timelineMoment(tl, e.startSec + eventSeconds(e) + after, 1, 1).left, `${e.id}, ${after} s after the landing`).toBeNull()
    }
  })

  it('is null through a shake that does not change the season: the preroll of the film and the test shake of every still', () => {
    const whole = filmTimeline()
    const preroll = whole.events[0]!
    expect([preroll.id, preroll.from === preroll.to]).toEqual(['preroll', true])
    const kept: [Timeline, ShakeEvent][] = [[whole, preroll]]
    for (const season of config.seasons) {
      const tl = stillTimeline(season)
      expect(tl.events.map((e) => [e.id, e.from, e.to])).toEqual([[`test:${season}`, season, season]])
      kept.push([tl, tl.events[0]!])
    }
    for (const [tl, e] of kept) {
      let asked = 0
      // Through the whole shake, past the end of its swap window, and on into the rest after it.
      for (let beat = 0; beat < beatsOf(e) + 4; beat += FRAME_BEATS / 4) {
        const m = at(tl, e, beat)
        expect(m.left, `${e.id} at beat ${beat}`).toBeNull()
        expect([m.season, m.from, m.to]).toEqual([e.from, e.from, e.from])
        if (beat > closes && beat < beatsOf(e)) asked++
      }
      expect(asked, `${e.id}: beats after the window and before the landing`).toBeGreaterThan(100)
    }
  })

  it('is null all the way round the loop, which changes nothing', () => {
    for (let t = 0; t < loopSeconds; t += loopSeconds / 257) expect(loopMoment(config.defaultSeason, t, 1).left).toBeNull()
  })
})
