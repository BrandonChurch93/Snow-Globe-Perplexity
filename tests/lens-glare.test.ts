import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import type { Moment } from '../src/core/stage'
import { lightUniforms } from '../src/core/chunks/light'
import { baseRoom, pourOnBase, pourUniforms } from '../src/core/materials'
import { grade, lensState } from '../src/post/grade'
import { GLOW_SEATS, addSeat, clearSeats, lensFall } from '../src/post/post'
import { Backdrop } from '../src/scene/backdrop'
import { poseById } from '../src/scene/cameras'
import { newFrame } from '../src/scene/frame'
import { centreHeightMm, outerRadiusMm } from '../src/scene/layout'
import { breathOf, gainOf, glowOf } from '../src/scene/lightgrid'
import { CHANGE_BLOOM, Lighting, ROOM_RIG, pourColour, rigInside } from '../src/scene/lighting'
import { SLAB, makeSlab, surfaceUniforms, updateSurface } from '../src/scene/surface'
import { kitOf } from '../src/seasons'
import { BASE_PASS, CHANGE_COVER, changeBloom, changeShown, changeSpan, coverPlace, coverShown, partChange } from '../src/shake/change'
import { REST_POSE } from '../src/shake/table'

const winter = kitOf('winter')
const spring = kitOf('spring')
const NAMES = ['winter', 'spring', 'summer', 'fall'] as const
const WINDOW = config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat
const FRAME = 1 / config.film.fps / (60 / config.film.defaultBpm) / WINDOW
const quality = { particleFraction: 1, shadowMapPx: 256, surfaceReflection: 'none' }
const C = CHANGE_BLOOM
const post = readFileSync('src/post/post.ts', 'utf8')

interface Cover {
  /** How much of the cover stands, as the stage reads it. */
  cover: number
  glare: number
  heart: number
  heartShare: number
  limb: number
  bloom: number
  room: number
  base: number
  lamps: number
  dim: number
}

const most = (c: { r: number; g: number; b: number }): number => Math.max(c.r, c.g, c.b)
const shares = (c: readonly number[]): number[] => c.map((v) => v / Math.max(...c))

/**
 * The stage's frame at a place in the swap window, lit. Inside the window two seasons are on the stage (`from` into `to`); from
 * its end on the season that came stands alone, the moment names the season the change has left, and the place is read from
 * the beat (change.ts, `coverPlace`), as stage.ts does it.
 */
function lit(place: number, from: (typeof NAMES)[number] = 'winter', to: (typeof NAMES)[number] = 'spring', live = false, bare = false) {
  const light = new Lighting(quality.shadowMapPx)
  const after = place >= 1 && from !== to
  const a = kitOf(after ? to : from)
  const b = kitOf(to)
  const f = newFrame(a, quality)
  f.to = b
  const two = a !== b
  const change = after ? 0 : place
  f.moment = { season: after ? to : from, from: after ? to : from, to, change, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: after ? config.shake.swapWindow.fromBeat + place * WINDOW : null, period: null, left: after ? from : null } as Moment
  f.left = after ? kitOf(from) : null
  f.mix.light = two ? partChange('light', change) : 0
  f.mix.base = two ? partChange('base', change) : 0
  const at = coverPlace(two, change, f.moment.left, f.moment.beat)
  f.mix.shown = bare ? 0 : changeShown(at, b.season)
  f.mix.bloom = bare ? 0 : changeBloom(at, b.season)
  f.live = live
  light.update(f)
  return f
}

function cover(place: number, from: (typeof NAMES)[number] = 'winter', to: (typeof NAMES)[number] = 'spring', live = false): Cover {
  const f = lit(place, from, to, live)
  return { cover: f.mix.bloom, glare: most(lensState.glare), heart: most(lensFall.heart), heartShare: lensFall.heartShare, limb: lensFall.limb.x, bloom: lensFall.bloom, room: most(lensFall.room), base: most(pourUniforms.uPourBase.value), lamps: f.lamps, dim: lensFall.dim }
}

/** What the lights inside lay on the table at a place: as they lay it with no cover, as the picture shows it on the slab under the cover, on what lies on the slab, and the pour's own share of that. */
function table(place: number): { rest: number; shown: number; on: number; pour: number } {
  const rest = lit(place, 'winter', 'spring', false, true).pool.r
  const f = lit(place)
  return { rest, shown: f.pool.r * lensFall.dim, on: f.poolOn.r * lensFall.dim, pour: f.pourOn.r * lensFall.dim }
}

const NOTHING = { cover: 0, glare: 0, heart: 0, heartShare: 0, limb: 0, bloom: 1, room: 0, base: 0, lamps: 1, dim: 1 }
const span = changeSpan('base')
const MID = (span.from + span.to) / 2
/** Every place the cover stands at, a quarter of a frame apart: through the window and on through the tail past its end. */
const places = (step = FRAME / 4): number[] => {
  const out: number[] = []
  for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.tailTo; c += step) out.push(c)
  return out
}

describe('the cover of a change in the lens', () => {
  it('is nothing through a shake of one season', () => {
    for (let c = 0; c <= 1.3; c += FRAME / 2) expect(cover(c, 'winter', 'winter'), `at ${c}`).toEqual(NOTHING)
    // Nor is a beat alone a tail: the moment must name a season the change has left.
    expect(coverPlace(false, 0, null, config.shake.swapWindow.toBeat + 0.1)).toBe(0)
    expect(coverPlace(false, 0, undefined, config.shake.swapWindow.toBeat + 0.1)).toBe(0)
    expect(coverPlace(false, 0, 'winter', null)).toBe(0)
  })

  it('is nothing before the cover rises and from the end of its tail on', () => {
    for (const c of [0, 0.02, CHANGE_COVER.riseFrom - FRAME, CHANGE_COVER.riseFrom, CHANGE_COVER.tailTo + FRAME / 1000, CHANGE_COVER.tailTo + FRAME, 2]) expect(cover(c), `at ${c}`).toEqual(NOTHING)
    // The cover itself is nothing at both ends to the last bit (the stage reads the tail's place from the beat, a rounding away).
    expect(changeBloom(CHANGE_COVER.riseFrom)).toBe(0)
    expect(changeBloom(CHANGE_COVER.tailTo)).toBe(0)
    expect(cover(CHANGE_COVER.tailTo).cover).toBeLessThan(1e-24)
  })

  it('reads the tail past the end of the window from the beat, at the window\'s own pace', () => {
    const w = config.shake.swapWindow
    expect(CHANGE_COVER.tailTo).toBeGreaterThan(1)
    // Between two seasons the place is the change; after the window it is the beat as a share of the window, so the two meet at its end.
    expect(coverPlace(true, 0.4, null, null)).toBe(0.4)
    expect(coverPlace(true, 0.4, 'winter', w.toBeat + 1)).toBe(0.4)
    expect(coverPlace(false, 0, 'winter', w.toBeat)).toBeCloseTo(1, 12)
    expect(coverPlace(false, 0, 'winter', w.toBeat + WINDOW * FRAME)).toBeCloseTo(1 + FRAME, 12)
    // Across the end of the window the cover is one curve: the last frame with two seasons and the first with one are a frame of the tail apart.
    const before = cover(1 - FRAME / 2)
    const after = cover(1 + FRAME / 2)
    expect(before.cover).toBeGreaterThan(after.cover)
    expect(before.cover - after.cover).toBeLessThan(0.1)
    for (const k of ['glare', 'heartShare', 'limb'] as const) expect(after[k] / before[k], k).toBeCloseTo(after.cover / before.cover, 9)
    // What the base takes is held through the fallen exposure: as the picture shows it, it goes by the cover as well.
    expect((after.base * after.dim) / (before.base * before.dim), 'base').toBeCloseTo(after.cover / before.cover, 9)
    // And the room's tone has no step there: in every channel, what it loses across the end of the window lies between what
    // it loses in the frame before and in the frame after, or within half a hundredth of them where the three are level
    // (there the tone falls by one share a frame, and which of three like shares is the greatest says nothing).
    const roomAt = (place: number): number[] => {
      lit(place)
      return lensFall.room.toArray()
    }
    const rooms = [-1.5, -0.5, 0.5, 1.5].map((n) => roomAt(1 + n * FRAME))
    for (let i = 0; i < 3; i++) {
      const steps = [rooms[1]![i]! / rooms[0]![i]!, rooms[2]![i]! / rooms[1]![i]!, rooms[3]![i]! / rooms[2]![i]!]
      expect(steps[1], `channel ${i}`).toBeLessThan(Math.max(steps[0]!, steps[2]!) + 0.005)
      expect(steps[1], `channel ${i}`).toBeGreaterThan(Math.min(steps[0]!, steps[2]!) - 0.005)
      for (const step of steps) expect(step, `channel ${i}`).toBeLessThan(1)
    }
    // A lamp goes by how far the picture has gone under the cover, as the picture shows it through the fallen exposure.
    expect((after.lamps * after.dim) / (before.lamps * before.dim)).toBeCloseTo(Math.pow(C.lamps, coverShown(after.cover) - coverShown(before.cover)), 9)
  })

  it('rises eased at both ends, stands whole on every instant of the span and dies away as a tail: one top and no second', () => {
    const series = places().map((c) => ({ at: c, ...cover(c) }))
    let top = 0
    for (let i = 1; i < series.length; i++) {
      const at = series[i]!
      const before = series[i - 1]!
      if (at.at <= CHANGE_COVER.fullFrom) {
        for (const k of ['cover', 'glare', 'heart', 'heartShare', 'limb', 'bloom', 'base'] as const) expect(at[k], `${k} rising at ${at.at}`).toBeGreaterThanOrEqual(before[k])
        expect(at.dim).toBeLessThanOrEqual(before.dim)
      } else if (at.at > CHANGE_COVER.fullTo + FRAME / 4) {
        for (const k of ['cover', 'glare', 'heart', 'heartShare', 'limb', 'bloom', 'base'] as const) expect(at[k], `${k} falling at ${at.at}`).toBeLessThanOrEqual(before[k])
        expect(at.dim).toBeGreaterThanOrEqual(before.dim)
      }
      if (at.at >= span.from && at.at <= span.to) {
        expect(at.cover).toBe(1)
        expect(at.glare).toBeCloseTo(C.glow, 9)
        expect(at.heart).toBeCloseTo(C.core, 9)
        expect(at.heartShare).toBe(1)
        expect(at.limb).toBeCloseTo(C.limb, 9)
        expect(at.bloom).toBeCloseTo(1 + C.bloom, 9)
        expect(at.dim).toBeCloseTo(C.dim, 9)
        top++
      }
      // No frame of it is a step in the picture. How far the picture has gone moves by under a tenth of the cover a frame
      // (the places are a quarter of a frame apart). And what the room alone lights, which the picture shows as the
      // exposure to the power of the screen's curve, moves by under an eighth of its level at rest a frame: its fall is
      // spread over the whole rise, where an exponent at an even pace took three tenths of it in one frame. The exposure
      // itself moves fastest where that is darkest, at the end of the rise, and still by under a stop and a half from one
      // frame to the next; its pace there, read over a quarter of a frame, is a hair over that.
      expect(Math.abs(coverShown(at.cover) - coverShown(before.cover)) * 4, `the picture a frame at ${at.at}`).toBeLessThan(0.1)
      expect(Math.abs(Math.pow(at.dim, 1 / 2.2) - Math.pow(before.dim, 1 / 2.2)) * 4, `what the room lights a frame at ${at.at}`).toBeLessThan(1 / 8)
      expect(Math.abs(Math.log2(at.dim / before.dim)) * 4, `the pace of the exposure in stops a frame at ${at.at}`).toBeLessThan(1.55)
      if (i >= 4) expect(Math.abs(Math.log2(at.dim / series[i - 4]!.dim)), `stops from one frame to the next at ${at.at}`).toBeLessThan(1.5)
    }
    expect(top).toBeGreaterThanOrEqual(8)
    // The whole cover holds the base's pass: every frame in which a base gives way is under it or within a frame and a half of it.
    // At the first instant of the pass and at its last the cover is over 0.95, as it is at the hand's fastest instant, and the
    // picture shows over 0.975 of it. (The rise comes to rest over its last tenth, a frame and a fifth, and the pass begins
    // three quarters of a frame before the cover is whole: the picture shows 0.978 of it there, and over 0.99 at the last.)
    expect(BASE_PASS.from).toBeGreaterThanOrEqual(CHANGE_COVER.fullFrom - 1.5 * FRAME)
    expect(BASE_PASS.to).toBeLessThanOrEqual(CHANGE_COVER.fullTo + 1.5 * FRAME)
    expect(changeBloom(BASE_PASS.from)).toBeGreaterThan(0.95)
    expect(changeBloom(BASE_PASS.to)).toBeGreaterThan(0.95)
    expect(coverShown(changeBloom(BASE_PASS.from))).toBeGreaterThan(0.975)
    expect(coverShown(changeBloom(BASE_PASS.to))).toBeGreaterThan(0.99)
  })

  it('comes up fast and dies away as a tail of twelve to eighteen frames that eases out and never blinks off', () => {
    const rise = (CHANGE_COVER.fullFrom - CHANGE_COVER.riseFrom) / FRAME
    const tail = (CHANGE_COVER.tailTo - CHANGE_COVER.fullTo) / FRAME
    expect(rise).toBeGreaterThanOrEqual(10)
    expect(rise).toBeLessThanOrEqual(12)
    expect(tail).toBeGreaterThanOrEqual(12)
    expect(tail).toBeLessThanOrEqual(18)
    expect(tail).toBeGreaterThanOrEqual(1.5 * rise)
    // What is eased is the picture: how far it has gone under the cover (change.ts, `coverShown`), not the exponent. The rise
    // is eased at both of its ends: its first frame and its last each take less of the picture than half a frame of its middle.
    const shown = (c: number): number => coverShown(changeBloom(c))
    const step = (c: number): number => shown(c + FRAME) - shown(c)
    const middle = step(CHANGE_COVER.riseFrom + (rise / 2 - 0.5) * FRAME)
    expect(step(CHANGE_COVER.riseFrom)).toBeLessThan(0.5 * middle)
    expect(step(CHANGE_COVER.fullFrom - FRAME)).toBeLessThan(0.5 * middle)
    expect(middle, 'the steepest frame of the rise is no more than a quarter over the even pace').toBeLessThanOrEqual((5 / 4 / rise) * (1 + 1e-9))
    // The tail eases out. Its pace comes up over its first three frames, so the top of the cover is a shoulder; from there every
    // frame of it takes less of the picture than the frame before, none more than a twelfth or so, and its last frame takes
    // under a fiftieth, where the exposure is within a twentieth of a stop of the whole: nothing is left to blink off.
    let last = Infinity
    let n = 0
    for (let c = CHANGE_COVER.fullTo; c < CHANGE_COVER.tailTo - FRAME / 2; c += FRAME) {
      const now = -step(c)
      expect(now, `the fall at ${c}`).toBeGreaterThan(0)
      expect(now, `the fall at ${c}`).toBeLessThan(0.085)
      if (n > 3) expect(now, `the fall at ${c}`).toBeLessThan(last)
      else if (n > 0) expect(now, `the fall at ${c}`).toBeGreaterThan(last)
      last = now
      n++
    }
    expect(-step(CHANGE_COVER.fullTo), 'the shoulder').toBeLessThan(-step(CHANGE_COVER.fullTo + 2 * FRAME) / 2)
    expect(last).toBeLessThan(0.02)
    expect(Math.abs(Math.log2(cover(CHANGE_COVER.tailTo - FRAME).dim))).toBeLessThan(0.05)
    // A third of the way down its tail the picture still shows over half of the cover: a tail and not a second flank.
    expect(shown(CHANGE_COVER.fullTo + (tail / 3) * FRAME)).toBeGreaterThan(0.5)
  })

  it('lets the exposure fall as for a lamp lit in the dark and holds everything inside the glass through it', () => {
    // What the lamps of the room light falls into the toe of the film's curve, and no deeper than the film can hold in its numbers.
    expect(C.dim).toBeGreaterThan(0.002)
    expect(C.dim).toBeLessThanOrEqual(0.01)
    const through = lightUniforms.uRigInside.value
    lit(0)
    const oldAtRest = lightUniforms.uGrid.value.y
    const newAtRest = lightUniforms.uGrid.value.z
    const room = through.x
    expect(lightUniforms.uLightBurn.value).toBe(1)
    expect(room).toBe(ROOM_RIG.inside.through)
    expect(oldAtRest).toBeGreaterThan(0)
    expect(newAtRest).toBeGreaterThan(0)
    for (const c of places(FRAME / 2)) {
      if (c >= 1) break
      const at = cover(c)
      expect(lightUniforms.uLightBurn.value * at.dim, `the burn at ${c}`).toBeCloseTo(1, 9)
      // Between two seasons the lights do not swell and are not burnt: through the fallen exposure they are their resting selves.
      expect(lightUniforms.uGrid.value.y * at.dim, `the old season's lights at ${c}`).toBeCloseTo(oldAtRest, 6)
      expect(lightUniforms.uGrid.value.z * at.dim, `the new season's lights at ${c}`).toBeCloseTo(newAtRest, 6)
      // What the room sends in through the glass gives way to the storm's own light: `through` of it is left at the whole cover.
      // Winter's room is the dimmer of these two, so on the rise it falls by `through` alone; spring's comes down to winter's.
      const brighter = c > span.to ? rigInside(spring.rig) / rigInside(winter.rig) : 1
      if (c <= span.from || c >= span.to) expect(through.x * at.dim, `the room's light inside at ${c}`).toBeCloseTo(room * Math.pow(C.through / brighter, at.cover), 9)
    }
    expect(rigInside(spring.rig)).toBeGreaterThan(rigInside(winter.rig))
    expect(C.through).toBeGreaterThan(0.25)
    expect(C.through).toBeLessThan(1)
    // A shake of one season has no cover and nothing to hold.
    for (let c = 0; c <= 1; c += FRAME) {
      cover(c, 'winter', 'winter')
      expect(lightUniforms.uLightBurn.value).toBe(1)
      expect(through.x).toBe(room)
    }
  })

  it("brings what the room sends in through the glass to one level while the two rooms cross, the dimmer room's, so the storm's light does not step with them", () => {
    const u = lightUniforms
    const lum = (c: { r: number; g: number; b: number }): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
    /** What the storm takes from the room as the picture shows it: the key and the card's share inside, through the glass and through the fallen exposure. */
    const sent = (): number => u.uRigInside.value.x * lensFall.dim * (lum(u.uRigKeyCol.value) + lum(u.uRigCardCol.value) * u.uRigCard.value.w)
    const room = ROOM_RIG.inside.through
    const stops = (a: number, b: number): number => Math.abs(Math.log2(a / b))
    let widest = 0
    for (let i = 0; i < NAMES.length; i++) {
      const from = NAMES[i]!
      const to = NAMES[(i + 1) % NAMES.length]!
      const old = rigInside(kitOf(from).rig)
      const come = rigInside(kitOf(to).rig)
      const least = Math.min(old, come)
      widest = Math.max(widest, Math.max(old, come) / least)
      // With no cover the room sends in what its rig says: before the rise the old season's, after the tail the new one's.
      lit(CHANGE_COVER.riseFrom - FRAME, from, to)
      expect(sent(), `${from} before the cover`).toBeCloseTo(room * old, 9)
      expect(u.uRigInside.value.x).toBe(room)
      lit(CHANGE_COVER.tailTo + FRAME, from, to)
      expect(sent(), `${to} after the cover`).toBeCloseTo(room * come, 9)
      expect(u.uRigInside.value.x).toBe(room)
      let crossing = 0
      let before = -1
      let step = 0
      for (const c of places()) {
        const f = lit(c, from, to)
        const k = f.mix.bloom
        const s = sent()
        // Under the whole cover it is one level, on both sides of the crossing and at every instant of it: `through` of the dimmer room's.
        if (k === 1) expect(s, `${from} into ${to} under the whole cover at ${c}`).toBeCloseTo(room * C.through * least, 9)
        if (c > span.from && c < span.to) {
          crossing += 1
          expect(k, `the cover while the rooms of ${from} and ${to} cross`).toBe(1)
        }
        // On the rise the old room stands alone and on the tail the new one: each goes between what it sends at rest and that level
        // by the cover as an exponent, so the brighter of the two falls further and neither is ever over its rest or under the level.
        const rest = c <= span.from ? old : c >= span.to ? come : 0
        if (rest > 0) expect(s, `${from} into ${to} at ${c}`).toBeCloseTo(room * Math.pow(rest, 1 - k) * Math.pow(C.through * least, k), 9)
        expect(s).toBeLessThanOrEqual(room * Math.max(old, come) * (1 + 1e-9))
        expect(s).toBeGreaterThanOrEqual(room * C.through * least * (1 - 1e-9))
        if (before > 0) step = Math.max(step, stops(s, before))
        before = s
      }
      expect(crossing, `quarter frames in the crossing of ${from} and ${to}`).toBeGreaterThan(8)
      // From one quarter frame to the next it never moves by a fifth of a stop: no step is left where the rooms cross.
      expect(step, `${from} into ${to}`).toBeLessThan(0.2)
    }
    // The rooms are far apart: summer's low sun sends in near four times what fall's dim key does. Crossed in three frames
    // with nothing to level them, that was a fall of the whole ball's light under the cover (11 levels in a frame of the film).
    expect(widest).toBeGreaterThan(3.5)
    // A frame with no season left behind and one season on the stage has nothing to level.
    for (const season of NAMES) {
      lit(0.5, season, season)
      expect(u.uRigInside.value.x, season).toBe(room)
    }
  })

  it('pours the light of the glass on the table: most at the whole cover, never under what lies there at rest', () => {
    let top = 0
    let most = 0
    let before = 0
    for (const c of places()) {
      const at = table(c)
      // The room is still there: the table is never darker than the lights at rest leave it, at any instant of the cover.
      expect(at.shown, `the pool on the table at ${c}`).toBeGreaterThanOrEqual(at.rest * (1 - 1e-12))
      // What is poured over and above the lights at rest goes by the cover: up with it, whole with it, down with it, through
      // the tail past the end of the window, with no second top. (The pool at rest crosses from one season's to the other's
      // meanwhile, so it is the poured part that is read, not the sum.)
      const poured = at.shown - at.rest
      if (c <= CHANGE_COVER.fullFrom) expect(poured, `rising at ${c}`).toBeGreaterThanOrEqual(before - 1e-9)
      else if (c > CHANGE_COVER.fullTo + FRAME / 4) expect(poured, `falling at ${c}`).toBeLessThanOrEqual(before + 1e-9)
      before = poured
      most = Math.max(most, poured)
      top = Math.max(top, at.shown / at.rest)
      if (c >= span.from && c <= span.to) expect(at.shown / at.rest, `on the span at ${c}`).toBeGreaterThan(8)
    }
    // It is many times what the lights at rest lay there, and it is at its most where the cover is whole: the glass that
    // burns lights the table under it while the base changes, and the pool is never drawn in.
    expect(top).toBeGreaterThan(8)
    for (const c of [CHANGE_COVER.fullFrom, span.from, MID, span.to, CHANGE_COVER.fullTo]) expect(table(c).shown - table(c).rest, `whole at ${c}`).toBeCloseTo(most, 9)
    // Away from the cover nothing is poured.
    for (const c of [0.02, CHANGE_COVER.riseFrom - FRAME, CHANGE_COVER.tailTo + FRAME]) expect(table(c).shown).toBe(table(c).rest)
  })

  it('lays less of the pour on what lies on the table than on the slab under it, so what is white there stays under white', () => {
    expect(C.pourOn).toBeLessThanOrEqual(C.pour / 4)
    let top = 0
    for (const c of places()) {
      const at = table(c)
      // Of the pour the frost, the petals and the leaves take `pourOn` where the slab, near black, takes `pour`.
      expect(at.on - at.rest, `what lies on the table at ${c}`).toBeCloseTo(((at.shown - at.rest) * C.pourOn) / C.pour, 9)
      // And the frame says which share of that is the pour, so the slab can lay it close round the foot.
      expect(at.pour, `the pour's share at ${c}`).toBeCloseTo(at.on - at.rest, 9)
      expect(at.on).toBeLessThanOrEqual(at.shown)
      top = Math.max(top, at.on / at.rest)
    }
    // At its most that is a few times what lies there at rest: lit by the pour, not burnt out by it.
    expect(top).toBeGreaterThan(1.5)
    expect(top).toBeLessThan(8)
    // Away from the cover they take what the slab takes, to the last bit: the pictures at rest are what they were.
    for (const c of [0.02, CHANGE_COVER.riseFrom - FRAME]) {
      expect(table(c).on).toBe(table(c).rest)
      expect(table(c).pour).toBe(0)
    }
  })

  it('lays the pour close round the foot of the base, brightest there and falling off outward, with the base\'s shade in it', () => {
    const frag = (makeSlab().material as THREE.ShaderMaterial).fragmentShader
    // `scatter` is the slab's own colour with the dust and the lumps laid on it, `albedo` the slab's own colour alone. What is
    // poured over and above the smaller pour (`uPour`) lights `albedo` by the pour's own shape, under the base's shade (`occl`).
    expect(frag).toContain('albedo * (uPour * (slabPourShare * occl))')
    const litLines = frag.split('\n').filter((line) => line.includes('scatter') && line.includes('uPour'))
    expect(litLines.length).toBe(1)
    expect(litLines[0]).toContain('scatter * (direct + (uSky + warm) * occl)')
    // What lies on the slab takes the pool at rest by the pool's shape and the pour by the pour's.
    expect(frag).toContain('warm = uPool * slabPoolShare + uPourOn * (slabPourShare - slabPoolShare);')
    const f = newFrame(winter, quality)
    f.pourOn.setRGB(0.25, 0.5, 0.75)
    updateSurface(f)
    expect(surfaceUniforms.uPourOn.value.toArray()).toEqual([0.25, 0.5, 0.75])
    // The pour is the light of a ball that burns over the base: by the square of the way to it and the slant of the table
    // under it, to the power `pourFall`, risen within `pourRiseMm` of the foot. It rises nearer the foot than the pool at
    // rest and falls off faster.
    expect(SLAB.pourRiseMm).toBeLessThan(SLAB.poolRiseMm / 2)
    expect(SLAB.pourFall).toBeGreaterThan(1.5)
    const foot = config.globe.baseDiameterMm / 2
    const share = (d: number): number => {
      const near = (centreHeightMm * centreHeightMm) / (centreHeightMm * centreHeightMm + d * d)
      const rise = Math.min(1, Math.max(0, (d - (foot - 4)) / (SLAB.pourRiseMm + 4)))
      return Math.pow(near, SLAB.pourFall) * rise * rise * (3 - 2 * rise)
    }
    let top = 0
    let topAt = 0
    for (let d = foot; d < 600; d += 1) {
      if (share(d) > top) {
        top = share(d)
        topAt = d
      }
    }
    // Brightest within two centimetres of the foot, and from there it only falls.
    expect(topAt - foot).toBeLessThan(20)
    for (let d = topAt + 1; d < 600; d += 1) expect(share(d)).toBeLessThanOrEqual(share(d - 1))
    // It is a pool under the globe and no flood of the table: a ball's width out from the foot it is under a fifth of its
    // top, and two widths out under a twentieth.
    expect(share(foot + 2 * outerRadiusMm) / top).toBeLessThan(0.2)
    expect(share(foot + 4 * outerRadiusMm) / top).toBeLessThan(0.05)
    expect(share(foot + 0.5 * outerRadiusMm) / top, 'and it is still a pool half a radius out').toBeGreaterThan(0.5)
  })

  it('holds the mirror image of the glass that the slab bakes through the cover: one swell with it, never out', () => {
    const luma = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
    for (let k = 0; k < NAMES.length; k++) {
      const from = NAMES[k]!
      const to = NAMES[(k + 1) % NAMES.length]!
      const name = `${from} to ${to}`
      /** The image at a place in the window as the picture shows it, and what it is there with no cover. */
      const at = (place: number): { rest: number[]; image: number[] } => {
        const bare = lit(place, from, to, false, true)
        const rest = bare.pool.toArray()
        // With no cover the image is the pool to the last bit: the pictures away from the cover are what they were.
        expect(bare.image.toArray(), `${name}, no cover at ${place}`).toEqual(rest)
        const f = lit(place, from, to)
        return { rest, image: f.image.toArray().map((v) => v * lensFall.dim) }
      }
      let before = 0
      for (const c of places()) {
        const now = at(c)
        // It is the glass's own light: in no channel and at no instant of the cover is it under what it is at rest.
        for (let i = 0; i < 3; i++) expect(now.image[i]!, `${name}, channel ${i} at ${c}`).toBeGreaterThanOrEqual(now.rest[i]! * (1 - 1e-12))
        // What is added to the lights at rest rises with the cover and falls with it, through the tail past the end of the
        // window: one swell, with no dip where the cover is whole. (The lights at rest cross from one season's to the
        // other's meanwhile, so it is the added part that is read.)
        const added = luma(now.image) - luma(now.rest)
        if (c <= CHANGE_COVER.fullFrom) expect(added, `${name}, rising at ${c}`).toBeGreaterThanOrEqual(before - 1e-9)
        else if (c > CHANGE_COVER.fullTo + FRAME / 4) expect(added, `${name}, falling at ${c}`).toBeLessThanOrEqual(before + 1e-9)
        before = added
      }
      // Where the cover is whole it is several times its resting self: a glow that burns with the glass and is not burnt out.
      const mid = at(MID)
      expect(luma(mid.image) / luma(mid.rest), name).toBeGreaterThan(4)
      expect(luma(mid.image) / luma(mid.rest), name).toBeLessThan(9)
      // What is added to the lights at rest is the pour's own colour, the arriving season's.
      const pour = pourColour(glowOf(kitOf(to).innerLights), kitOf(to).rig)
      const top = pour.indexOf(Math.max(...pour))
      for (let i = 0; i < 3; i++) expect((mid.image[i]! - mid.rest[i]!) / (mid.image[top]! - mid.rest[top]!), `${name}, channel ${i}`).toBeCloseTo(pour[i]! / pour[top]!, 9)
      // Away from the cover it is the pool.
      for (const c of [0.02, CHANGE_COVER.riseFrom - FRAME]) expect(at(c).image, `${name} at ${c}`).toEqual(at(c).rest)
    }
    // Through a shake of one season, swell and all, it is the pool to the last bit.
    for (let c = 0; c <= 1; c += FRAME) {
      const f = lit(c, 'winter', 'winter')
      expect(f.image.toArray(), `one season at ${c}`).toEqual(f.pool.toArray())
    }
  })

  it('reads the image and not the pool where the slab bakes the mirror image of the glass', () => {
    const frag = (makeSlab().material as THREE.ShaderMaterial).fragmentShader
    const near = frag.split('\n').filter((line) => line.includes('vec3 near ='))
    expect(near.length).toBe(1)
    expect(near[0]).toContain('uImage * (')
    expect(near[0]).not.toContain('uPool')
    expect(near[0]).not.toContain('uPour')
    // The base's own image in that line is lit by the room alone, so it falls with the room and shows no base while two cross.
    expect(near[0]).toContain('lit * body')
    const f = newFrame(winter, quality)
    f.image.setRGB(0.25, 0.5, 0.75)
    updateSurface(f)
    expect(surfaceUniforms.uImage.value.toArray()).toEqual([0.25, 0.5, 0.75])
  })

  it('is the same in the live picture as in the film', () => {
    for (const c of places(FRAME / 2)) expect(cover(c, 'winter', 'spring', true), `at ${c}`).toEqual(cover(c))
    for (let c = 0; c <= 1.3; c += FRAME / 2) expect(cover(c, 'winter', 'winter', true)).toEqual(NOTHING)
  })

  it('lays the glow round the limb of the ball, where the ball is in each span of the shutter, and lets it die before the picture\'s edge', () => {
    // The stage says where the glass is at every sample of a picture; the samples are gathered into spans of the shutter.
    clearSeats()
    for (const s of lensFall.seats) expect(s.toArray()).toEqual([0, 0, 0, 0])
    addSeat(0, 0.5, 0.4, 0.3, 0, -0.2)
    addSeat(0.01, 0.52, 0.4, 0.3, 0, -0.2)
    addSeat(0.999, 0.6, 0.4, 0.3, 0.01, -0.2)
    addSeat(1, 0.62, 0.4, 0.3, 0.01, -0.2)
    expect(lensFall.seats.length).toBe(GLOW_SEATS)
    expect(lensFall.seats[0]!.toArray()).toEqual([1.02, 0.8, 0.6, 2])
    expect(lensFall.seats[GLOW_SEATS - 1]!.toArray()).toEqual([1.22, 0.8, 0.6, 2])
    expect(lensFall.downs[0]!.toArray()).toEqual([0, -0.4])
    for (let i = 1; i < GLOW_SEATS - 1; i++) expect(lensFall.seats[i]!.w).toBe(0)
    clearSeats()
    for (const s of lensFall.seats) expect(s.toArray()).toEqual([0, 0, 0, 0])
    for (const d of lensFall.downs) expect(d.toArray()).toEqual([0, 0])
    // The resolve lays it on the limb of the ball at every seat, weighed by the seat's share of the samples: it is round and
    // centred on the globe where the globe is in that frame, and it smears as the globe does.
    expect(post).toContain('float from = length(rel) - 1.0;')
    expect(post).toContain('ring += s.w * (from > 0.0 ? exp(-from / uReach.x) : exp(-from * from / (uReach.y * uReach.y))) * open;')
    // It dies at the picture's edge: nothing of it on the edge itself, whole a twentieth of the picture's height inside.
    expect(post).toMatch(/const GLOW_EDGE = 0\.05\b/)
    expect(post).toContain('uGlare * (ring * smoothstep(0.0, ${GLOW_EDGE.toFixed(3)}, min(margin.x, margin.y)))')
    cover(MID)
    expect(lensFall.reach.toArray()).toEqual([C.glowOut, C.glowIn])
    // Hottest on the limb itself, under white there, and gone within a fraction of a radius outward: a quarter of a radius
    // out it is under a fiftieth of white. The film's picture of a shake leaves a sixth of a radius over the ball.
    expect(C.glow).toBeGreaterThanOrEqual(0.25)
    expect(C.glow).toBeLessThan(1)
    expect(C.glow * Math.exp(-0.25 / C.glowOut)).toBeLessThan(0.02)
    expect(C.glow * Math.exp(-1 / C.glowOut), 'a radius out there is none').toBeLessThan(1e-4)
    // Inward it falls as fast, so it is a line of light round the ball and no veil on it.
    expect(C.glowIn).toBeLessThanOrEqual(C.glowOut)
    expect(Math.exp(-((0.15 / C.glowIn) ** 2))).toBeLessThan(1e-6)
  })

  it('makes the heart of the storm the brightest thing in the picture: white at its middle, falling off with no edge, the storm\'s own strokes across it', () => {
    cover(MID)
    // The level the heart is brought to is told with the storm's air in it (below), so the middle comes to `coreTop`.
    expect(lensFall.heartShape.toArray()).toEqual([C.coreAt, C.coreReach, C.coreTop / (1 + C.air), C.coreMost])
    // The picture is laid on itself: what the storm holds at the heart is multiplied, so a bright stroke goes to white and a
    // dark one stays darker than what is round it. How many times over is read from the picture, so every season's storm
    // comes to the one level at its middle.
    expect(post).toContain('float most = clamp(uHeartShape.z / max(max(storm.r, max(storm.g, storm.b)), 1e-4), 1.0, uHeartShape.w) - 1.0;')
    // How much of that stands goes by the cover as an exponent, as the fall of the exposure does. A straight share gave the
    // first frame of the rise a part of the whole white at once and held the glass white through the tail until it fell in
    // a few frames; by the exponent every equal step of the cover is the same number of stops, at the heart and round it.
    expect(post).toContain('c *= uLimb.x * limb + pow(max(1.0 + most * heart, 1.0), uHeartShare);')
    const over = (times: number, bell: number, share: number): number => Math.pow(Math.max(1 + times * bell, 1), share)
    for (const bell of [1, 0.37, 0.05]) {
      // Whole, it is the picture laid on itself `most` times on the bell; with no cover it is the picture.
      expect(over(47, bell, 1)).toBeCloseTo(1 + 47 * bell, 12)
      expect(over(47, bell, 0)).toBe(1)
      // Even stops: a tenth more of the cover is the same times over wherever on the cover it is taken.
      expect(over(47, bell, 0.3) / over(47, bell, 0.2)).toBeCloseTo(over(47, bell, 0.9) / over(47, bell, 0.8), 9)
      // The first hundredth and a half of the cover, which is the first frame of the rise, is under a sixteenth of the way.
      expect(over(47, bell, 0.015) - 1).toBeLessThan((47 * bell) / 16)
    }
    expect(lensFall.heartShare).toBe(1)
    // Two bells, both about the heart, both cut only inside the limb.
    expect(post).toContain('float away = length(rel - down * (uHeartShape.x / max(seat, 1e-5)));')
    expect(post).toContain('float within = s.w * open * (1.0 - smoothstep(-${HEART_LIMB.toFixed(3)}, 0.0, from));')
    expect(lensFall.bell.toArray()).toEqual([C.coreRound, C.airReach, C.airRound])
    // The first is the one the picture is laid on itself by. It is wide and flat on top (the way out from the heart to
    // the power `coreRound`, 3 or more): over the middle of the ball the picture is laid on itself by nearly one number,
    // so what falls off from the heart is the storm's own light as the scene's flood lays it on the storm, stroke by
    // stroke, and no shape of the lens. A quarter of a radius out it has lost under a tenth of itself, half a radius out
    // it still holds over half, and at the limb it is under a twentieth: the lens leaves the storm there nearly as it is.
    expect(post).toContain('heart += within * exp(-pow(max(away / uHeartShape.y, 1e-5), uHeartBell.x));')
    expect(C.coreRound).toBeGreaterThanOrEqual(3)
    expect(C.coreReach).toBeGreaterThanOrEqual(0.55)
    expect(C.coreReach).toBeLessThanOrEqual(0.75)
    const bell = (out: number): number => Math.exp(-Math.pow(out / C.coreReach, C.coreRound))
    expect(bell(0.25)).toBeGreaterThan(0.9)
    expect(bell(0.5)).toBeGreaterThan(0.5)
    expect(bell(0.9)).toBeLessThan(0.1)
    expect(bell(1)).toBeLessThan(0.05)
    // The second is the light's bell: narrower, round on top (the power `airRound`, 2), whitest at the middle and gone by
    // the limb. The air of the storm at the heart is laid on it first, in the storm's own colour: what stands behind a
    // thin storm is then a little more light in a ball full of light and no white shape with an outline, and away from the
    // middle the strokes of the storm keep their own dark and bright. It rises with the cover as the lens's own taking
    // does, by the cover as an exponent.
    expect(post).toContain('light += within * exp(-pow(max(away / uHeartBell.y, 1e-5), uHeartBell.z));')
    expect(post).toContain('c += storm * (uHeartAir * light);')
    expect(post.indexOf('c += storm * (uHeartAir')).toBeLessThan(post.indexOf('c *= uLimb.x * limb + pow('))
    expect(lensFall.air).toBeCloseTo(C.air, 12)
    expect(C.airRound).toBe(2)
    expect(C.airReach).toBeLessThan(C.coreReach)
    expect(C.airReach).toBeGreaterThanOrEqual(0.35)
    const light = (out: number): number => Math.exp(-Math.pow(out / C.airReach, C.airRound))
    expect(light(0.1)).toBeGreaterThan(0.9)
    expect(light(0.9)).toBeLessThan(0.02)
    // The air is under the strokes and never over them: at most a little more than the storm's own level at the heart, so
    // a stroke twice as bright as what is round it is still half again as bright with the air laid on.
    expect(C.air).toBeGreaterThanOrEqual(1)
    expect(C.air).toBeLessThanOrEqual(1.5)
    expect((2 + C.air) / (1 + C.air)).toBeGreaterThan(1.4)
    for (const k of [0.25, 0.5, 0.75]) {
      cover(CHANGE_COVER.riseFrom + (CHANGE_COVER.fullFrom - CHANGE_COVER.riseFrom) * k)
      expect(lensFall.air).toBeCloseTo(Math.pow(1 + C.air, lensFall.heartShare) - 1, 12)
    }
    cover(MID)
    // The white the lens adds lies on the square of the light's bell, tight in the middle, white in every season, and
    // small beside what the storm itself is brought to: it fills what is dark at the very middle and is no lamp.
    expect(post).toContain('uHeart * (light * light)')
    expect(lensFall.heart.toArray()).toEqual([C.core, C.core, C.core])
    expect(C.core).toBeGreaterThan(0)
    expect(C.core).toBeLessThanOrEqual(C.coreTop / 12)
    // The film is white from `whiteFull` and holds a colour whole under `whiteFrom` (grade.ts). The middle of the heart is
    // brought just over white.
    expect(C.coreTop).toBeGreaterThanOrEqual(grade.whiteFull)
    expect(C.coreTop).toBeLessThan(1.25 * grade.whiteFull)
    // What the lens alone makes of a storm that stands level everywhere, at the level 1: the air laid on, the picture laid
    // on itself, the white. At the middle it is `coreTop` and the white; a quarter of a radius out it is under the film's
    // white already; half a radius out it is still over the level where the film begins to take the colour out; three
    // quarters out it is under that, and at the limb the storm is nearly as it was. So the lens has no edge anywhere: it
    // falls from white to the storm's own level over the whole radius, and a storm that is itself brightest at its heart
    // (the scene's flood, `heartMm`) melts from white into its colour over about half of it. Read on the film's frames
    // at the whole cover, the strongest channel in rings a tenth of a radius wide from the heart: 14.1, 11.8, 9.2, 6.3,
    // 3.8, 2.1 into spring; 14.2, 12.2, 9.3, 6.2, 3.8, 2.2 into summer; 12.5, 12.1, 9.1, 6.4, 3.7, 1.8 into fall; 14.1,
    // 11.8, 8.4, 6.0, 3.5, 1.9 into winter.
    const level = (out: number): number => (1 + C.air * light(out)) * (1 + (C.coreTop / (1 + C.air) - 1) * bell(out)) + C.core * light(out) * light(out)
    expect(level(0)).toBeCloseTo(C.coreTop + C.core, 9)
    expect(level(0.25)).toBeLessThan(grade.whiteFull)
    expect(level(0.25)).toBeGreaterThan(0.6 * C.coreTop)
    expect(level(0.5)).toBeGreaterThan(grade.whiteFrom)
    expect(level(0.5)).toBeLessThan(0.5 * C.coreTop)
    expect(level(0.75)).toBeLessThan(grade.whiteFrom)
    expect(level(1)).toBeLessThan(1.25)
    for (let out = 0.05; out <= 1; out += 0.05) expect(level(out), `the lens falls all the way out, at ${out.toFixed(2)}`).toBeLessThan(level(out - 0.05))
    // The heart sits low in the ball, over the miniature, where the storm is thickest.
    expect(C.coreAt).toBeGreaterThanOrEqual(0)
    expect(C.coreAt).toBeLessThan(0.3)
    // A storm far darker than the others is not laid on itself without end.
    expect(C.coreMost).toBeGreaterThanOrEqual(2 * C.coreTop)
    // The lens blooms what burns wider under the cover, and the highlights of the limb bloom with the heart.
    expect(lensFall.bloom).toBeCloseTo(1 + C.bloom, 12)
    expect(lensFall.limb.x).toBe(C.limb)
    expect(lensFall.limb.y).toBeCloseTo(C.limbMm / outerRadiusMm, 12)
    expect(post).toContain('limb += s.w * exp(-from * from / (uLimb.y * uLimb.y)) * open;')
    expect(C.limbMm / outerRadiusMm).toBeLessThan(0.1)
  })

  it('gives each change the arriving season\'s own colour of light', () => {
    const none: number = 0
    const pours = NAMES.map((name) => {
      const kit = kitOf(name)
      const lamps = glowOf(kit.innerLights)
      const pour = pourColour(lamps, kit.rig)
      // It is the colour of the season's own rig, its rim through its key, at the strongest channel of its lamps: the top of
      // the glow stands where the lamps' colour had it. None of it and it is the colour of the lamps.
      const own = shares([0, 1, 2].map((i) => kit.rig.rim.color[i]! * kit.rig.key.color[i]!))
      for (let i = 0; i < 3; i++) expect(shares(pour)[i], `${name}, channel ${i}`).toBeCloseTo(own[i]! + (shares(lamps)[i]! - own[i]!) * (1 - C.tint), 12)
      expect(Math.max(...pour), name).toBeCloseTo(Math.max(...lamps), 12)
      expect(pourColour(lamps, kit.rig, none as typeof C.tint)).toEqual([...lamps])
      return shares(pour)
    })
    expect(C.tint).toBeGreaterThan(0.75)
    expect(C.tint).toBeLessThanOrEqual(1)
    // Winter's is the one cold light, the other three are warm, and no two changes have one colour: every pair stands a tenth
    // of a channel apart or more. The lamps of winter's and spring's miniatures, which the pour took before, are one colour.
    expect(pours[0]![2], 'winter\'s blue').toBe(1)
    for (const [i, name] of NAMES.entries()) if (i > 0) expect(pours[i]![0], `${name}'s red`).toBe(1)
    const apart = (p: readonly number[], q: readonly number[]): number => Math.max(...[0, 1, 2].map((k) => Math.abs(p[k]! - q[k]!)))
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(apart(pours[i]!, pours[j]!), `${NAMES[i]} and ${NAMES[j]}`).toBeGreaterThan(0.1)
    expect(apart(shares(glowOf(winter.innerLights)), shares(glowOf(spring.innerLights))), 'the lamps of winter and of spring').toBeLessThan(0.05)
    for (const [i, name] of NAMES.entries()) {
      const from = NAMES[(i + 3) % 4]!
      // As the cover rises, where it is whole and in its tail: everything the glass pours and the lens lays is in that colour.
      for (const c of [CHANGE_COVER.fullFrom - 2 * FRAME, MID, 1 + 2 * FRAME]) {
        const f = lit(c, from, name)
        const slab = shares([f.pool.r - f.poolOn.r, f.pool.g - f.poolOn.g, f.pool.b - f.poolOn.b])
        const flood = lightUniforms.uLightFlood.value
        const base = pourUniforms.uPourBase.value
        for (const [what, colour] of [['the slab', slab], ['what lies on it', shares(f.pourOn.toArray())], ['the glow of the lens', shares(lensState.glare.toArray())], ['the base', shares(base.toArray())], ['the flood', shares(flood.toArray())]] as const) {
          for (let k = 0; k < 3; k++) expect(colour[k], `${what} into ${name} at ${c}, channel ${k}`).toBeCloseTo(pours[i]![k]!, 9)
        }
      }
    }
  })

  it('lights a base as a lamp close over a dark thing does: its rim to white, its flank in its own colour', () => {
    const f = lit(MID)
    const restB = gainOf(spring.innerLights, f.time, f.period) * breathOf(f.time, f.period)
    const pour = pourColour(glowOf(spring.innerLights), spring.rig)
    // Through the fallen exposure the light at the collar is `base` times what the new season's lights are at rest, in the pour's colour.
    for (const [i, k] of (['r', 'g', 'b'] as const).entries()) expect(pourUniforms.uPourBase.value[k] * lensFall.dim).toBeCloseTo(pour[i]! * restB * C.base, 9)
    expect(f.mix.bloom).toBe(1)
    expect(pourUniforms.uPourBaseShape.value.toArray()).toEqual([C.baseMm, C.baseWhite, C.baseUnder, C.baseLift])
    expect(pourUniforms.uPourBaseFlank.value.toArray()).toEqual([C.baseFlank, C.baseFlankMm, C.baseTint])
    // The shader: the rim takes the light whole, falling off with the way out from the glass, most of the way to the colour of
    // the light; the flank takes a small share of it in the stuff's own colour alone, by a light that is white but for
    // `baseTint` of the pour's colour; both by how a face looks at the glass.
    // It is laid on what leaves the face, on the line after three closes the sums of a base's own light, and under the coat.
    // Laid into the diffuse sum it stood between a base's last product and the sum that takes it, and the compiler joins those
    // two otherwise when a line stands between them, run or not: one pixel of summer's landed still moved by one level with no
    // cover in the picture. The line it follows is three's own, so it is read out of three: a three that writes it otherwise
    // fails here and does not drop the pour unseen.
    const closed = 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;'
    const three = THREE.ShaderLib.physical.fragmentShader
    expect(three.split(closed).length - 1).toBe(1)
    expect(THREE.ShaderLib.standard.fragmentShader).toBe(three)
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, fragmentShader: three }
    pourOnBase(shader)
    expect(shader.uniforms.uPourBase).toBe(pourUniforms.uPourBase)
    expect(shader.uniforms.uPourBaseShape).toBe(pourUniforms.uPourBaseShape)
    expect(shader.uniforms.uPourBaseFlank).toBe(pourUniforms.uPourBaseFlank)
    const frag = shader.fragmentShader
    expect(frag.indexOf('uniform vec3 uPourBase;')).toBeGreaterThan(frag.indexOf('#include <common>'))
    expect(frag.length).toBeGreaterThan(three.length)
    const laid = frag.indexOf('outgoingLight += pourFace')
    expect(frag.indexOf('if (uPourBase.r + uPourBase.g + uPourBase.b > 0.0) {')).toBeGreaterThan(frag.indexOf(closed))
    expect(laid).toBeGreaterThan(frag.indexOf(closed))
    expect(laid).toBeLessThan(frag.indexOf('outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;'))
    expect(laid).toBeLessThan(frag.indexOf('outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc )'))
    expect(laid).toBeLessThan(frag.indexOf('#include <opaque_fragment>'))
    expect(frag.split('pourFace * (').length - 1).toBe(1)
    expect(frag).not.toContain('reflectedLight.indirectDiffuse += pourFace')
    // Between three's own sums nothing of the pour stands: the lines from the shade of a face to the closing of the sums are three's.
    const from = three.indexOf('#include <aomap_fragment>')
    expect(from).toBeGreaterThan(0)
    expect(frag).toContain(three.slice(from, three.indexOf(closed) + closed.length))
    expect(frag).toContain('if (uPourBase.r + uPourBase.g + uPourBase.b > 0.0) {')
    expect(frag).toContain('float pourRim = exp(-pourOut / uPourBaseShape.x);')
    expect(frag).toContain('float pourFlank = uPourBaseFlank.x * exp(-pourOut / uPourBaseFlank.y);')
    expect(frag).toContain('vec3 pourPlain = mix(vec3(max(uPourBase.r, max(uPourBase.g, uPourBase.b))), uPourBase, uPourBaseFlank.z);')
    expect(frag).toContain('outgoingLight += pourFace * (uPourBase * (pourRim * mix(pourStuff, vec3(1.0), uPourBaseShape.y)) + pourPlain * (pourFlank * pourStuff));')
    // Every lit part of a base takes it, once, after the part's own hook, and no season's base calls it itself. Winter's ice
    // is a shader of its own that the hook does not reach: it takes its share of the pour through its own lights.
    const materials = readFileSync('src/core/materials.ts', 'utf8')
    expect(materials.split('pourOnBase(shader)').length - 1).toBe(1)
    expect(materials).toContain("    spec.hook?.(shader)\n    if (spec.change === 'base') pourOnBase(shader)")
    for (const name of NAMES) expect(readFileSync(`src/seasons/${name}/base.ts`, 'utf8'), name).not.toContain('pourOnBase(')
    expect(readFileSync('src/seasons/winter/base.ts', 'utf8')).toContain('const ICE_POUR = { above: 0.2, below: 0.5 }')
    // What that makes of a dark base, by the same sums: oiled wood, a face that looks at the glass.
    const wood = [0.09, 0.05, 0.03]
    const stuff = wood.map((v) => v * Math.pow(Math.max(...wood), -C.baseLift))
    const light = pour.map((v) => v * restB * C.base)
    const plain = light.map((v) => Math.max(...light) * (1 - C.baseTint) + v * C.baseTint)
    const at = (outMm: number): number[] => [0, 1, 2].map((i) => light[i]! * Math.exp(-outMm / C.baseMm) * (stuff[i]! + (1 - stuff[i]!) * C.baseWhite) + plain[i]! * C.baseFlank * Math.exp(-outMm / C.baseFlankMm) * stuff[i]!)
    // The lip, at the glass: over the white of the film in its strongest channel, and most of the way to the colour of the light.
    const lip = at(0)
    expect(Math.max(...lip)).toBeGreaterThan(1)
    expect(Math.min(...shares(lip)) / Math.min(...shares(light)), 'the lip has the colour of the light, not of the wood').toBeGreaterThan(0.8)
    // The flank, three centimetres down: a warm edge on a dark thing and no more, a small share of the lip, in the wood's own
    // colour. Rose light on brown wood is terracotta, which is no season's base: the light on the flank is white.
    const flank = at(30)
    expect(Math.max(...flank)).toBeLessThan(0.1 * Math.max(...lip))
    expect(Math.max(...flank)).toBeGreaterThan(0)
    expect(C.baseTint).toBe(0)
    const hue = shares(wood)
    for (let i = 0; i < 3; i++) expect(Math.abs(shares(flank)[i]! - hue[i]!), `the flank's colour, channel ${i}`).toBeLessThan(0.03)
    // A face that looks away from the glass takes a share of it and is not black.
    expect(C.baseUnder).toBeGreaterThan(0)
    expect(C.baseUnder).toBeLessThan(0.5)
    // With no cover a base takes none of it.
    lit(0.02)
    expect(pourUniforms.uPourBase.value.toArray()).toEqual([0, 0, 0])
    lit(MID, 'winter', 'winter')
    expect(pourUniforms.uPourBase.value.toArray()).toEqual([0, 0, 0])
  })

  it('floods the heart of the storm in the pour\'s colour under the cover and lays no flood outside the glass, and as before with none', () => {
    const u = lightUniforms
    const f = lit(MID)
    const restB = gainOf(spring.innerLights, f.time, f.period) * breathOf(f.time, f.period)
    const pour = pourColour(glowOf(spring.innerLights), spring.rig)
    for (const [i, k] of (['r', 'g', 'b'] as const).entries()) expect(u.uLightFlood.value[k]).toBeCloseTo(pour[i]! * restB, 12)
    // Inside the glass it is the heart, tighter than the swell of a shake that keeps its season, held through the fallen
    // exposure. Outside there is none: a flood there laid the colour of the light over the whole flank of a base.
    expect(u.uLightFloodFloor.value.w).toBe(0)
    expect(u.uLightFloodAt.value.z * lensFall.dim).toBeCloseTo(ROOM_RIG.flood.inside * C.heart, 9)
    expect(u.uLightFloodAt.value.w).toBeCloseTo(C.heartMm, 12)
    // Half way up the rise the picture is half way there, and the flood goes by the cover that shows that much.
    const half = cover(CHANGE_COVER.riseFrom + (CHANGE_COVER.fullFrom - CHANGE_COVER.riseFrom) / 2)
    expect(coverShown(half.cover)).toBeCloseTo(0.5, 9)
    expect(half.cover).toBeGreaterThan(0.15)
    expect(half.cover).toBeLessThan(0.3)
    expect(u.uLightFloodAt.value.w).toBeCloseTo(ROOM_RIG.flood.insideMm + (C.heartMm - ROOM_RIG.flood.insideMm) * half.cover, 9)
    expect(u.uLightFloodAt.value.z * half.dim).toBeCloseTo(ROOM_RIG.flood.inside * C.heart * half.cover, 9)
    expect(u.uLightFloodFloor.value.w).toBe(0)
    // Its fall by the glass is the room's own at every time: the cover has no shape of its own for it.
    expect(u.uLightFloodNear.value.toArray()).toEqual([ROOM_RIG.flood.near, ROOM_RIG.flood.nearMm])
    // With no cover the flood is the swell's, shaped as it is at rest.
    lit(0.02)
    expect(u.uLightFloodNear.value.toArray()).toEqual([ROOM_RIG.flood.near, ROOM_RIG.flood.nearMm])
    expect(u.uLightFloodAt.value.w).toBe(ROOM_RIG.flood.insideMm)
    expect(u.uLightFloodFloor.value.w).toBe(0)
  })

  it('keeps the room\'s own light on a base through the fall of the exposure, so each base is its own colour under the pour', () => {
    const u = lightUniforms
    const held = baseRoom.uniforms
    const names = ['uRigKeyCol', 'uRigRimCol', 'uRigCardCol', 'uRigSky', 'uRigGround'] as const
    // With no cover a base reads the room's lights number for number: the pictures at rest and landed do not move.
    for (const [from, to, place] of [['winter', 'winter', MID], ['winter', 'spring', 0.02], ['fall', 'fall', 0]] as const) {
      lit(place, from, to)
      expect(baseRoom.hold).toBe(1)
      for (const n of names) expect(held[n].value.toArray(), `${n} with no cover`).toEqual(u[n].value.toArray())
      expect(held.uRigRoom.value.toArray()).toEqual(u.uRigRoom.value.toArray())
    }
    // Under the whole cover the exposure is at `dim` and a base keeps `baseHold` of the room's light through it: every light
    // of the room that a base reads is as many times itself, so the base is lit as it is at rest and a little under.
    lit(MID)
    expect(lensFall.dim).toBeCloseTo(C.dim, 12)
    expect(baseRoom.hold * lensFall.dim).toBeCloseTo(C.baseHold, 12)
    for (const n of names) {
      const room = u[n].value.toArray()
      const base = held[n].value.toArray()
      expect(Math.max(...room), n).toBeGreaterThan(0)
      for (let i = 0; i < 3; i++) expect(base[i]! * lensFall.dim, `${n}, channel ${i}`).toBeCloseTo(room[i]! * C.baseHold, 9)
    }
    // The room in a base's polish, and the lamps in it, are held as much; how soft it is with roughness is not a light.
    const room = u.uRigRoom.value
    expect(held.uRigRoom.value.x * lensFall.dim).toBeCloseTo(room.x * C.baseHold, 9)
    expect(held.uRigRoom.value.y * lensFall.dim).toBeCloseTo(room.y * C.baseHold, 9)
    expect(held.uRigRoom.value.z).toBe(room.z)
    expect(held.uRigRoom.value.w).toBe(room.w)
    // The room itself is not held: only what `pourOnBase` gives a base's material reads these.
    for (const n of names) expect(held[n]).not.toBe(u[n])
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, fragmentShader: THREE.ShaderLib.physical.fragmentShader }
    pourOnBase(shader)
    for (const n of names) expect(shader.uniforms[n]).toBe(held[n])
    expect(shader.uniforms.uRigRoom).toBe(held.uRigRoom)
    // It keeps most of its light and not all of it: the room round it has fallen, and a base lit as at rest would stand out
    // of that room as a thing lit from nowhere.
    expect(C.baseHold).toBeGreaterThanOrEqual(0.5)
    expect(C.baseHold).toBeLessThan(1)
    // It goes by the cover: half way up the rise the hold is as far from 1 to `baseHold` as the cover stands there, through the fall.
    const half = cover(CHANGE_COVER.riseFrom + (CHANGE_COVER.fullFrom - CHANGE_COVER.riseFrom) / 2)
    expect(baseRoom.hold * half.dim).toBeCloseTo(1 - (1 - C.baseHold) * half.cover, 9)
    // The bases that read the room by names of their own hold it by the same number, and fall's candles with it.
    expect(readFileSync('src/seasons/winter/base.ts', 'utf8')).toContain('const hold = baseRoom.hold')
    expect(readFileSync('src/seasons/fall/base.ts', 'utf8')).toContain('const hold = baseRoom.hold')
    expect(readFileSync('src/seasons/fall/arrival.ts', 'utf8')).toContain('const hold = baseRoom.hold')
  })

  it('lays the room\'s own tone back under the fallen exposure, in the colour of each season\'s backdrop, lifted a little by the light of the glass', () => {
    const wa = winter.backdrop.room
    const wb = spring.backdrop.room
    const pour = pourColour(glowOf(spring.innerLights), spring.rig)
    const peak = Math.max(...glowOf(spring.innerLights))
    for (const c of [CHANGE_COVER.fullFrom - 3 * FRAME, MID, CHANGE_COVER.fullTo + 3 * FRAME]) {
      const at = cover(c)
      const share = partChange('base', c)
      // What the fall of the exposure takes from the dark of the backdrop is laid back, `room` of it at the whole cover: the
      // corners of the picture keep their tone. On top of it the glass lifts the room in the colour of the pour (`wash`).
      for (const [i, k] of (['r', 'g', 'b'] as const).entries()) {
        const tone = (wa[i]! + (wb[i]! - wa[i]!) * share) * (1 - (1 - C.room) * at.cover) * (1 - at.dim)
        expect(lensFall.room[k], `channel ${k} at ${c}`).toBeCloseTo(tone + (pour[i]! * C.wash * at.cover) / peak, 12)
      }
    }
    // It is a share of the backdrop's own dark, and over what the film needs to hold a pixel off true black (about 0.002 a
    // channel for a sum of 4) in at least one channel of every season. The wash is a lift and no veil: a few hundredths.
    expect(C.room).toBeGreaterThan(0.5)
    expect(C.room).toBeLessThanOrEqual(1)
    for (const name of NAMES) expect(Math.max(...kitOf(name).backdrop.room) * C.room, name).toBeGreaterThan(0.002)
    expect(C.wash).toBeGreaterThan(0)
    expect(C.wash).toBeLessThanOrEqual(0.05)
    // It rises as the exposure falls and is nothing away from the cover and in a shake of one season.
    expect(cover(CHANGE_COVER.riseFrom - FRAME).room).toBe(0)
    expect(cover(MID, 'winter', 'winter').room).toBe(0)
    let last = 0
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.fullFrom; c += FRAME / 4) {
      const now = cover(c).room
      expect(now).toBeGreaterThanOrEqual(last - 1e-12)
      last = now
    }
  })

  it('lets the lamps of the backdrop fall with the cover and never go out', () => {
    // A lamp is drawn `f.lamps` times over and the exposure takes `dim` of that: what is seen of it is `lamps` to the power
    // of how far the picture has gone under the cover (change.ts, `coverShown`). A lamp is not white as the glass is, so it
    // answers an exponent evenly; by the cover itself it fell late and came back in the first frames of the tail.
    // Veiled by the glow of the glass, not gone.
    for (const c of places(FRAME / 2)) {
      const at = cover(c)
      expect(at.lamps * at.dim, `a lamp at ${c}`).toBeCloseTo(Math.pow(C.lamps, coverShown(at.cover)), 9)
    }
    expect(cover(MID).lamps * C.dim).toBeCloseTo(C.lamps, 9)
    // At the whole cover a lamp keeps a fifth of its light or so: two to three stops down, where the room round it is
    // seven and a half, so it stands as a lamp on the room's tone and its going over into the next season's is seen dimly.
    expect(C.lamps).toBeGreaterThanOrEqual(0.1)
    expect(C.lamps).toBeLessThanOrEqual(0.35)
    expect(C.lamps).toBeGreaterThan(20 * C.dim)
    // It falls and rises on the picture's own ease, never by a third of a stop in a frame.
    let before = 1
    for (const c of places(FRAME)) {
      const at = cover(c)
      const now = at.lamps * at.dim
      expect(Math.abs(Math.log2(now / before)), `stops in the frame at ${c}`).toBeLessThan(1 / 3)
      before = now
    }
    // The backdrop draws its lamps that many times over.
    expect(readFileSync('src/scene/backdrop.ts', 'utf8')).toContain('this.material.uniforms.uBackHold!.value = f.lamps')
    expect(newFrame(winter, quality).lamps).toBe(1)
  })

  it('brings each lamp to one level between its two seasons under the cover, so the crossing of the lamps is no step', () => {
    // One season's lamps are not another's: summer gives a lamp over a hundred times what fall gives the same one. Crossed
    // plainly in the three frames of the base's span, such a lamp fell by four stops and more in one frame, under the whole
    // cover, where nothing else moves. So as the picture goes under the cover each lamp goes to the geometric mean of what
    // its two seasons give it; there the two cross, its colour passes and its light does not move; and as the cover dies
    // away it goes on to the new season's own.
    const text = readFileSync('src/scene/backdrop.ts', 'utf8')
    expect(text).toContain('float lampA = dot(aColorA, vec3(0.2126, 0.7152, 0.0722));')
    expect(text).toContain('float lampB = dot(aColorB, vec3(0.2126, 0.7152, 0.0722));')
    // Its colour passes evenly as well. Mixed by the crossing's own share, a lamp that one season gives many times the light
    // of the other had the brighter season's colour within one frame of the three: in the page's own walk from winter into
    // summer, one sample a frame, the lamp at the right edge of a phone's picture went from blue to gold between two frames,
    // by 55 levels of red and 51 of blue. So the share of the season that comes is weighed by the two lights.
    expect(text).toContain('float lampGoes = max(lampA, 1e-9);')
    expect(text).toContain('float lampComes = max(lampB, 1e-9);')
    expect(text).toContain('float lampShare = uBackMix + uBackEven * uBackMix * (1.0 - uBackMix) * (lampGoes - lampComes) / (uBackMix * lampGoes + (1.0 - uBackMix) * lampComes);')
    expect(text).toContain('vColor = mix(aColorA, aColorB, lampShare) * (size * size) / (radius * radius);')
    expect(text).toContain('vColor *= uBackHold * pow(max(sqrt(max(lampA * lampB, 0.0)) / max(mix(lampA, lampB, lampShare), 1e-9), 1e-4), uBackEven);')
    // The stage names the season a change has left while its cover dies away, and the backdrop keeps that season's lamps to
    // come up from.
    expect(readFileSync('src/scene/stage.ts', 'utf8')).toContain("f.left = single && typeof moment.left === 'string' ? kitOf(moment.left) : null")
    expect(newFrame(winter, quality).left).toBeNull()
    interface Lamps {
      update(f: ReturnType<typeof lit>): void
      a: string
      b: string
      emitters: unknown[]
      colorA: { array: Float32Array }
      colorB: { array: Float32Array }
      material: { uniforms: Record<string, { value: number }> }
    }
    const back = new Backdrop() as unknown as Lamps
    const hero = poseById('hero')
    const count = back.emitters.length
    expect(count).toBeGreaterThan(100)
    const level = (rgb: Float32Array, i: number): number => rgb[i * 3]! * 0.2126 + rgb[i * 3 + 1]! * 0.7152 + rgb[i * 3 + 2]! * 0.0722
    /** What is seen of every lamp at a place in the window: as the shader evens it, and as the plain crossing had it. */
    const seen = (place: number, from: (typeof NAMES)[number], to: (typeof NAMES)[number]) => {
      const f = lit(place, from, to)
      f.pose = hero
      back.update(f)
      const u = back.material.uniforms
      const mix = u.uBackMix!.value
      const even = u.uBackEven!.value
      const hold = u.uBackHold!.value * lensFall.dim
      const evened: number[] = []
      const plain: number[] = []
      const share: number[] = []
      const passed: number[] = []
      const plainPassed: number[] = []
      for (let i = 0; i < count; i++) {
        const a = level(back.colorA.array, i)
        const b = level(back.colorB.array, i)
        // The share of the coming season's colour, as the shader weighs it by the two lights.
        const goes = Math.max(a, 1e-9)
        const comes = Math.max(b, 1e-9)
        const part = mix + (even * mix * (1 - mix) * (goes - comes)) / (mix * goes + (1 - mix) * comes)
        const both = a + (b - a) * part
        const crossed = a + (b - a) * mix
        evened.push(both * Math.pow(Math.max(Math.sqrt(Math.max(a * b, 0)) / Math.max(both, 1e-9), 1e-4), even) * hold)
        plain.push(crossed * hold)
        share.push(part)
        // How much of the lamp's light is the coming season's, which is how far its colour has passed.
        passed.push((part * b) / both)
        plainPassed.push((mix * b) / crossed)
      }
      return { f, mix, even, held: u.uBackHold!.value, evened, plain, share, passed, plainPassed }
    }
    const stops = (now: number[], before: number[]): number => Math.max(...now.map((v, i) => Math.abs(Math.log2(v / before[i]!))))
    const worst = { evened: 0, plain: 0, passed: 0, plainPassed: 0 }
    let crossings = 0
    NAMES.forEach((from, s) => {
      const to = NAMES[(s + 1) % NAMES.length]!
      for (const phase of [0, 0.25, 0.5, 0.75]) {
        let before: ReturnType<typeof seen> | null = null
        let whole: number[] | null = null
        for (let c = CHANGE_COVER.riseFrom + (phase - 2) * FRAME; c < CHANGE_COVER.tailTo + 2 * FRAME; c += FRAME) {
          const at = seen(c, from, to)
          const cover = at.f.mix.bloom
          // The lamps are evened by how far the picture has gone under the cover (`mix.shown`). The cover is the exponent
          // that shows so much: by the law of the seven storms, or the share itself on the tail into fall.
          expect(at.even, `how far the lamps are evened at ${c}`).toBe(at.f.mix.shown)
          if (to === 'fall' && c > CHANGE_COVER.fullTo) expect(cover, `the cover on the tail into fall at ${c}`).toBe(at.f.mix.shown)
          else expect(coverShown(cover), `what the cover shows at ${c}`).toBeCloseTo(at.f.mix.shown, 9)
          expect(at.held).toBe(at.f.lamps)
          // The old season's lamps and the new season's are both held from the first frame of the window to the end of the
          // tail: inside the window by the two seasons on the stage, after it by the season the change has left.
          expect(back.a, `the lamps to go from at ${c}`).toBe(from)
          expect(back.b, `the lamps to come to at ${c}`).toBe(to)
          expect(at.mix).toBe(c >= 1 ? 1 : at.f.mix.base)
          // The two cross under the whole cover only, and there no lamp's light moves at all.
          if (at.mix > 0 && at.mix < 1) expect(cover, `the cover while the lamps cross at ${c}`).toBe(1)
          if (cover === 1) {
            whole ??= at.evened
            expect(stops(at.evened, whole), `a lamp under the whole cover at ${c}`).toBeLessThan(1e-9)
          }
          // Where no two seasons cross, the share of the coming season's colour is the crossing's own to the bit, so every
          // frame outside the crossing, and every picture at rest, is drawn as it was.
          if (at.mix === 0 || at.mix === 1) for (const part of at.share) expect(part).toBe(at.mix)
          else {
            // While they cross, every lamp's colour is as far across as the crossing is, whatever its two lights are.
            crossings++
            expect(at.even, `how far the lamps are evened while they cross at ${c}`).toBe(1)
            for (let i = 0; i < count; i++) {
              expect(at.share[i]!).toBeGreaterThan(0)
              expect(at.share[i]!).toBeLessThan(1)
              worst.passed = Math.max(worst.passed, Math.abs(at.passed[i]! - at.mix))
              worst.plainPassed = Math.max(worst.plainPassed, Math.abs(at.plainPassed[i]! - at.mix))
            }
          }
          if (before) {
            worst.evened = Math.max(worst.evened, stops(at.evened, before.evened))
            worst.plain = Math.max(worst.plain, stops(at.plain, before.plain))
            // No lamp of any of the four changes moves by three quarters of a stop in a frame.
            expect(stops(at.evened, before.evened), `stops a frame of the lamp that moves most, ${from} into ${to} at ${c}`).toBeLessThan(0.75)
          }
          before = at
        }
        expect(whole).not.toBeNull()
        // With the cover gone the season that came stands alone and its lamps are its own.
        const after = seen(CHANGE_COVER.tailTo + 2 * FRAME, from, to)
        expect(after.even).toBe(0)
        expect(after.mix).toBe(1)
        expect(stops(after.evened, after.plain)).toBe(0)
      }
    })
    // What the plain crossing did, which this takes away: a lamp fell by over four stops in one frame.
    expect(worst.plain).toBeGreaterThan(4)
    expect(worst.evened).toBeLessThan(worst.plain / 6)
    // And what the plain mixing of the colours did, which the weighing takes away: on some frame of a crossing a lamp's
    // colour was most of the way across, or hardly begun, where the crossing itself was near its middle.
    expect(crossings).toBeGreaterThan(8)
    expect(worst.plainPassed).toBeGreaterThan(0.8)
    expect(worst.passed).toBeLessThan(1e-9)
    // At rest nothing is evened and nothing held: the lamps are drawn as they always were.
    const rest = seen(0, 'winter', 'winter')
    expect(rest.even).toBe(0)
    expect(rest.held).toBe(1)
    expect(Math.pow(0.37, rest.even)).toBe(1)
    expect(stops(rest.evened, rest.plain)).toBe(0)
  })
})
