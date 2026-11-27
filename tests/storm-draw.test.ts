import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARD_FRAG_PARS, CARD_VERT, CARD_VERT_PARS } from '../src/particles/draw/cards'
import { CARD, PIXEL_SIGMA2, SEED_NEAR, SEED_RESTS, SHAPE, STORM_FLOOD, STORM_LOOSE, STORM_OWN_PATH_FROM, STORM_SHUTTER, STORM_SHUTTER_TURNED, STREAK_ARC, SUMMER_EDGE, lookOf } from '../src/particles/draw/looks'
import { seatsOn } from '../src/particles/draw/points'
import { VERT_MAIN } from '../src/particles/draw/shader'
import { gridOf } from '../src/scene/layout'
import { config, particleKinds } from '../src/config'
import { BEHAVIOUR } from '../src/particles/engine/kinds'
import { innerRadiusMm, lensIor, lensPlace, lensRadiusMm } from '../src/globe/lens'
import { VEIL_LOOK, veilUniforms } from '../src/core/chunks/veil'
import type { KitMoment } from '../src/seasons/kit'
import { STORM, TAKE, comesOfAnother, floodLeft, holdStorm, stormHeld, takePace, veil as summerVeil } from '../src/seasons/summer/veil'

const DRAW = join(__dirname, '..', 'src', 'particles', 'draw')

describe('how the storm is drawn', () => {
  it('a trail costs a few joined pieces', () => {
    expect(CARD.run.taps).toBeGreaterThanOrEqual(3)
    expect(CARD.run.taps).toBeLessThanOrEqual(6)
    expect(CARD_FRAG_PARS).toContain(`i < ${CARD.run.taps};`)
  })

  it('a kind drawn along its own path is seen for its stroke alone and the samples add none of it', () => {
    expect(STORM_SHUTTER).toBeGreaterThan(0)
    expect(STORM_SHUTTER).toBeLessThanOrEqual(1)
    expect(VERT_MAIN).toContain('uPoint.x + shut * uStorm.y * afloat * (storming ? 1.0 - uStorm.x : 1.0)')
  })

  it('the leaf, the seed, the light and the spark take their own path; the flake, the glitter, the petal and the mote are turned to the current', () => {
    expect(STORM_OWN_PATH_FROM).toBeGreaterThan(SHAPE.fleck)
    expect(STORM_OWN_PATH_FROM).toBeLessThan(SHAPE.leaf)
    expect(STORM_SHUTTER_TURNED).toBeGreaterThan(STORM_SHUTTER)
    expect(STORM_SHUTTER_TURNED).toBeLessThanOrEqual(1)
    expect(VERT_MAIN).toContain(`bool storming = uStorm.x > 0.0 && shape > ${STORM_OWN_PATH_FROM.toFixed(1)};`)
  })

  it('a kind on its own path is not turned to the current; its line runs longer along that same path, each by its own share', () => {
    expect(VERT_MAIN).toContain('if (gusty > 0.0 && !storming) {')
    expect(CARD_VERT).toContain('if (!storming) mvC = mix(mvC, curC')
    expect(CARD_VERT).toContain('if (!storming) stC *= ')
    expect(CARD_VERT).toContain('if (storming) {\n        headC = 0.0;')
    expect(CARD_VERT).toContain('if (storming) mvC *= mix(')
    expect(CARD_VERT).toContain('pointSag(nowL, pathC)')
    expect(CARD.line.shutLong[0]).toBeGreaterThanOrEqual(1)
    expect(CARD.line.shutLong[1] * STORM_SHUTTER).toBeLessThanOrEqual(1)
  })

  it('the whirl of the dabs is loosened only while the storm is drawn, so a still liquid is drawn as before', () => {
    expect(STORM_LOOSE.alignLow).toBeGreaterThan(0)
    expect(STORM_LOOSE.alignLow).toBeLessThan(1)
    expect(STORM_LOOSE.farLong).toBeLessThan(STORM_LOOSE.nearLong)
    expect(STORM_LOOSE.farSeen).toBeLessThanOrEqual(1)
    expect(VERT_MAIN).toContain(`clump = mix(clump, ${STORM_LOOSE.even}, ${STORM_LOOSE.spread} * uStorm.x);`)
    expect(VERT_MAIN).toContain('uStorm.x * gusty * (1.0 - glints));')
  })

  it('the arc of a trail and the front of the flood stay within their bounds', () => {
    expect(STREAK_ARC.most).toBeGreaterThan(0)
    expect(STREAK_ARC.most).toBeLessThanOrEqual(0.5)
    expect(STREAK_ARC.leastMm).toBeGreaterThan(0)
    expect(STORM_FLOOD.frontMm[0]).toBeLessThan(STORM_FLOOD.frontMm[1])
    expect(STORM_FLOOD.frontClear).toBeLessThanOrEqual(1)
    expect(CARD.line.dwellPx).toBeGreaterThan(0)
  })

  it('the drawing takes no number that is not the particle own seed', () => {
    for (const name of readdirSync(DRAW)) {
      if (!name.endsWith('.ts')) continue
      const text = readFileSync(join(DRAW, name), 'utf8')
      expect(text, name).not.toMatch(/Math\.random|Date\.now|performance\.now/)
    }
  })

  it('the seed of summer alone is turned to the whirl on its own path: in the storm its stroke is a curved swish of its own length and width, and the leaves among the strokes are few and dark', () => {
    expect(CARD_VERT).toContain('mix(mvC, curC * (length(mvC) * (dot(mvC, curC) < 0.0 ? -1.0 : 1.0)), mix(')
    expect(CARD.line.stormAlign[0]).toBeGreaterThan(0)
    expect(CARD.line.stormAlign[1]).toBeLessThanOrEqual(1)
    expect(CARD.line.stormLong[0]).toBeLessThan(CARD.line.stormLong[1])
    expect(CARD.line.stormWidePx[0]).toBeLessThan(CARD.line.stormWidePx[1])
    expect(CARD.line.stormBow[1]).toBeLessThanOrEqual(CARD.line.stormBowMost)
    expect(CARD.line.stormBowMost).toBeLessThanOrEqual(STREAK_ARC.most)
    // the storm's leaves are few and dark and ride in the strokes' own draw (the landing list asked for about a dozen): under one stroke in a hundred, at less than a stroke's own light, and nothing bright, green and flat
    expect(CARD.line.stormLeaves).toBeGreaterThanOrEqual(0)
    expect(CARD.line.stormLeaves).toBeLessThanOrEqual(0.01)
    expect(CARD.line.stormLeafGain).toBeLessThanOrEqual(0.5)
    expect(CARD.line.stormLeafGain).toBeLessThan(CARD.line.stormGain)
    expect(CARD_VERT).toContain('float bitC = storming &&')
    expect(CARD.line.stormDwellPx).toBeGreaterThan(0)
  })

  it("a laid head of summer's crown sits on the crown as it is made, whatever crown that is; the other seats stand as listed", () => {
    // a made scene: one slab under the crown's columns with its top at a height, and nothing else
    const slab = (top: number) => gridOf((x, y, z) => Math.max(y - top, Math.abs(x - 16) - 20, Math.abs(z + 3) - 12))
    const [first, past] = SEED_RESTS.follow.crown
    const low = seatsOn(slab(3))
    SEED_RESTS.at.forEach((listed, i) => {
      const seat = low[i]!
      if (i < first || i >= past) {
        expect(seat).toBe(listed)
        return
      }
      expect(seat[1]).toBeCloseTo(3 + SEED_RESTS.follow.rise, 1)
      expect(seat[4]).toBeGreaterThan(0.95)
      expect(Math.hypot(seat[0]! - listed[0], seat[2]! - listed[2])).toBeLessThanOrEqual(SEED_RESTS.follow.seek + 1e-6)
      expect(seat[6]).toBe(listed[6])
    })
    // the crown made higher: the seats go with it
    const high = seatsOn(slab(12))
    for (let i = first; i < past; i++) expect(high[i]![1]).toBeCloseTo(12 + SEED_RESTS.follow.rise, 1)
    // nothing under a column: the listed place stands
    const none = seatsOn(gridOf(() => 10))
    for (let i = first; i < past; i++) expect(none[i]).toBe(SEED_RESTS.at[i])
  })

  it("a head lies only on a seat of the list, no seat holds two, and the crown's seats that follow the crown hold one each", () => {
    const held: readonly number[] = SEED_RESTS.held
    expect(held.length).toBeGreaterThan(0)
    expect(new Set(held).size).toBe(held.length)
    for (const i of held) {
      expect(Number.isInteger(i)).toBe(true)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(SEED_RESTS.at.length)
    }
    const [first, past] = SEED_RESTS.follow.crown
    for (let i = first; i < past; i++) expect(held).toContain(i)
    expect(SEED_RESTS.size).toBeGreaterThan(0)
    expect(SEED_RESTS.seen[0]).toBeGreaterThan(0)
    expect(SEED_RESTS.seen[1]).toBeGreaterThanOrEqual(SEED_RESTS.seen[0])
    expect(SEED_RESTS.seen[1]).toBeLessThanOrEqual(1)
  })

  it("out of another season summer's held storm takes the shared storm over by ratio: the change stays under the whole flood, and after it no line of sight opens by more than a sixth between two frames, at the swap window's end or anywhere; a shake of summer alone and the time after a landing are as they were", () => {
    const w = config.shake.swapWindow
    const perBeat = (60 * config.film.fps) / config.film.defaultBpm
    const most = summerVeil.density
    // the shared storm near a shake's peak, as the shared veil sets it on each frame before summer's turn; once the window is
    // past it opens by itself (`openFromBeats` to `openToBeats`), the bank by the square of what is left of the flood
    const flood = 0.85
    const spring = { tint: [1, 1, 1], density: 0.002, rest: 0 }
    const u = veilUniforms
    const shared = { thin: 0, white: 0, bank: 0 }
    const momentAt = (frame: number, single: boolean): KitMoment => {
      const beat = w.fromBeat + frame / perBeat
      const x = Math.min(1, Math.max(0, (beat - w.toBeat - VEIL_LOOK.openFromBeats) / (VEIL_LOOK.openToBeats - VEIL_LOOK.openFromBeats)))
      const stands = flood * (1 - x * x * (3 - 2 * x))
      shared.thin = summerVeil.rest + most * VEIL_LOOK.haze * 0.8
      shared.white = most * VEIL_LOOK.white * stands
      shared.bank = most * VEIL_LOOK.bank * VEIL_LOOK.bankFloodGain * stands * stands
      u.uVeil.value.w = shared.thin
      u.uVeilUp.value.w = VEIL_LOOK.uneven
      u.uVeilRoll.value.set(1, stands, shared.white, VEIL_LOOK.foldPeak)
      u.uVeilBank.value.set(0.06, VEIL_LOOK.bankSoft, shared.bank, 1)
      u.uVeilDrift.value.x = 0.02
      const past = beat >= w.toBeat - 1e-7
      const stage = { mix: { veil: past || single ? 1 : (beat - w.fromBeat) / (w.toBeat - w.fromBeat) }, from: { veil: single || past ? summerVeil : spring }, to: { veil: summerVeil }, moment: { left: !single && past ? 'spring' : null } }
      return { time: 0, period: 1, sinceLanding: -1, arrived: 1, beat, seed: 1, frame: stage } as unknown as KitMoment
    }
    const at = (frame: number, single: boolean): number => {
      const moment = momentAt(frame, single)
      holdStorm(moment)
      return takePace(moment)
    }
    // how much is seen of what stands so many millimetres deep in the bank and in the white of the liquid
    const seen = (mm: number): number => Math.exp(-(u.uVeilBank.value.z + u.uVeilRoll.value.z) * mm)
    const depths = [2, 5, 10, 20, 40, 60, 100, 140]
    const windowFrames = Math.round((w.toBeat - w.fromBeat) * perBeat)
    const density = summerVeil.rest + most * VEIL_LOOK.haze * STORM.share
    expect(most * VEIL_LOOK.bank * VEIL_LOOK.bankFloodGain * flood * flood).toBeGreaterThan(50 * STORM.bank.density)
    expect(TAKE.fromFrames).toBeLessThanOrEqual(0)
    expect(floodLeft(0)).toBe(1)
    expect(floodLeft(1)).toBe(0)
    const first = windowFrames + TAKE.fromFrames
    const last = first + TAKE.frames
    // to the take over's first frame the shared storm is whole: nothing of it is touched
    for (let f = 0; f <= first; f++) {
      expect(at(f, false)).toBe(0)
      expect(u.uVeilBank.value.z).toBe(shared.bank)
      expect(u.uVeilRoll.value.z).toBe(shared.white)
      expect(u.uVeil.value.w).toBe(shared.thin)
      expect(u.uVeilBank.value.x).toBe(0.06)
      expect(u.uVeilDrift.value.x).toBe(0.02)
    }
    // the miniature's change is over, two frames before the window's end, before half of the flood has gone
    at(windowFrames - 2, false)
    expect(u.uVeilBank.value.z).toBeGreaterThan(0.5 * shared.bank)
    at(first, false)
    let before = depths.map(seen)
    let bank = u.uVeilBank.value.z
    for (let f = first + 1; f <= last + 3; f++) {
      const moment = momentAt(f, false)
      expect(comesOfAnother(moment)).toBe(true)
      const pace = at(f, false)
      const now = depths.map(seen)
      expect(u.uVeilBank.value.z).toBeLessThanOrEqual(bank)
      // never more of the bank than the shared storm has, until the shared storm has opened by itself under the held one, which then is all of it
      expect(u.uVeilBank.value.z).toBeLessThanOrEqual(Math.max(shared.bank, STORM.bank.density))
      if (f < last) expect(u.uVeilBank.value.z, `frame ${f} of the window`).toBeLessThanOrEqual(shared.bank)
      expect(u.uVeilBank.value.z).toBeGreaterThanOrEqual(STORM.bank.density - 1e-12)
      expect(u.uVeilRoll.value.z).toBeGreaterThanOrEqual(STORM.white - 1e-12)
      expect(u.uVeil.value.w).toBeGreaterThan(0)
      for (let i = 0; i < depths.length; i++) {
        expect(now[i]!).toBeGreaterThanOrEqual(before[i]! - 1e-12)
        // by sum the window's last two frames opened 26 and 40 hundredths of what stands 60 mm deep
        expect(now[i]! - before[i]!, `frame ${f} of the window, ${depths[i]} mm deep`).toBeLessThan(1 / 6)
      }
      if (f < last) expect(pace).toBeLessThan(1)
      else expect(pace).toBe(1)
      before = now
      bank = u.uVeilBank.value.z
    }
    // from the take over's end to the landing the held storm is all of it, as it was from the window's end
    expect(u.uVeilBank.value.z).toBeCloseTo(STORM.bank.density, 12)
    expect(u.uVeilRoll.value.z).toBeCloseTo(STORM.white, 12)
    expect(u.uVeil.value.w).toBeCloseTo(density, 12)
    expect(u.uVeilBank.value.x).toBeCloseTo(STORM.bank.level, 12)
    expect(u.uVeilBank.value.y).toBeCloseTo(STORM.bank.soft, 12)
    expect(u.uVeilBank.value.w).toBeCloseTo(STORM.bank.even, 12)
    expect(u.uVeilRoll.value.w).toBeCloseTo(STORM.fold, 12)
    expect(u.uVeilDrift.value.x).toBeCloseTo(0.02 * (1 - STORM.calms), 12)
    // a shake of summer alone has no take over: the held storm comes in through the whole window by the share that is kept, by sum
    for (let f = 0; f <= windowFrames + 4; f += 3) {
      const moment = momentAt(f, true)
      const kept = stormHeld(moment)
      expect(comesOfAnother(moment)).toBe(false)
      expect(takePace(moment)).toBe(0)
      expect(holdStorm(moment)).toBe(kept)
      if (f > 0 && f < windowFrames) expect(kept).toBeGreaterThan(0)
      if (f > 0 && f < windowFrames) expect(kept).toBeLessThan(1)
      expect(u.uVeilBank.value.z).toBe(shared.bank + (STORM.bank.density - shared.bank) * kept)
      expect(u.uVeilRoll.value.z).toBe(shared.white + (STORM.white - shared.white) * kept)
      expect(u.uVeil.value.w).toBe(shared.thin + (density - shared.thin) * kept)
      expect(u.uVeilBank.value.x).toBe(0.06 + (STORM.bank.level - 0.06) * kept)
      expect(u.uVeilDrift.value.x).toBe(0.02 * (1 - STORM.calms * kept))
    }
    // summer leaving holds nothing: the storm that hides the change out of summer is the shared one, whole
    u.uVeilBank.value.set(0.06, VEIL_LOOK.bankSoft, 0.5, 1)
    const leaving = { time: 0, period: 1, sinceLanding: -1, arrived: 1, beat: w.toBeat - 1 / perBeat, seed: 1, frame: { mix: { veil: 0.97 }, from: { veil: summerVeil }, to: { veil: spring }, moment: { left: null } } } as unknown as KitMoment
    expect(holdStorm(leaving)).toBe(0)
    expect(takePace(leaving)).toBe(0)
    expect(u.uVeilBank.value.z).toBe(0.5)
    // after the landing the held storm lets go by sum, as it did: half a second after it nearly all of it still stands
    u.uVeil.value.w = 0
    u.uVeilRoll.value.set(0, 0, 0, VEIL_LOOK.foldEarly)
    u.uVeilBank.value.set(VEIL_LOOK.bankRest, VEIL_LOOK.bankSoft, 0, 0)
    const landed = { time: 0, period: 1, sinceLanding: config.states.landedSeconds, arrived: 1, beat: null, seed: 1, frame: { mix: { veil: 1 }, from: { veil: summerVeil }, to: { veil: summerVeil }, moment: { left: 'spring' } } } as unknown as KitMoment
    expect(comesOfAnother(landed)).toBe(false)
    const kept = holdStorm(landed)
    expect(kept).toBeGreaterThan(0.9)
    expect(kept).toBeLessThan(1)
    expect(u.uVeilBank.value.z).toBe(STORM.bank.density * kept)
    expect(u.uVeilRoll.value.z).toBe(STORM.white * kept)
  })

  it("the take over is bent to the picture: by the glass's mean level as it was read on three courses, no pair of frames differs by 5 levels with the storm alone, where the even course fell by 8.7; its first six frames keep the even pace, it never turns back, and it is over before the shared storm has opened by itself, six frames and more before the shake's end", () => {
    const w = config.shake.swapWindow
    const perBeat = (60 * config.film.fps) / config.film.defaultBpm
    const windowFrames = Math.round((w.toBeat - w.fromBeat) * perBeat)
    const spring = { tint: [1, 1, 1], density: 0.002, rest: 0 }
    const paceAt = (frame: number): number => {
      const beat = w.fromBeat + frame / perBeat
      const past = beat >= w.toBeat - 1e-7
      const stage = { mix: { veil: past ? 1 : (beat - w.fromBeat) / (w.toBeat - w.fromBeat) }, from: { veil: past ? summerVeil : spring }, to: { veil: summerVeil }, moment: { left: past ? 'spring' : null } }
      return takePace({ time: 0, period: 1, sinceLanding: -1, arrived: 1, beat, seed: 1, frame: stage } as unknown as KitMoment)
    }
    // The ruler is the change's own: the mean of the luma of the 8 bit picture over a disc that rides with the ball, 0.85 of its
    // radius, on the second shake of the film at draft and hd with the change's cover off. Read on main b4bc96c0 where the course
    // was even, a frame a sixteenth of the way, and on two bent courses, the level of a frame is the held storm's at that frame
    // (HELD) and the flood's light over it at that frame (LIGHT) times the share of it that stands at that way (STANDS, by
    // sixteenths). The flood's light falls by a third between film frames 1409 and 1413 by itself, whatever the course.
    // The lists begin at the take over's first frame, film frame 1401; the first three frames lie under the cover and are not read.
    // The course as it stands was then drawn and read by the same ruler: its largest step is 3.96 where these lists say 4.17,
    // and no level of it lies further than 1.6 from them.
    const HELD = [138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 137.67, 136.88, 137.09, 138.41, 141.25, 144.45, 146.21, 147.77]
    const LIGHT = [48.95, 48.95, 48.95, 48.95, 48.95, 48.95, 48.95, 50.4, 49.1, 46.1, 41.3, 35.4, 33.3, 33.4, 33.3, 36.8, 35.4, 36.6, 31.7, 33, 33, 33, 33, 33]
    const STANDS = [1, 1, 1, 1, 1, 0.958, 0.897, 0.764, 0.62, 0.472, 0.322, 0.19, 0.105, 0.06, 0.024, 0.022, 0]
    const stands = (pace: number): number => {
      const at = Math.min(STANDS.length - 1, Math.max(0, pace * (STANDS.length - 1)))
      const i = Math.min(STANDS.length - 2, Math.floor(at))
      return STANDS[i]! + (STANDS[i + 1]! - STANDS[i]!) * (at - i)
    }
    const first = windowFrames + TAKE.fromFrames
    const last = first + TAKE.frames
    const level = (t: number): number => HELD[t]! + LIGHT[t]! * stands(paceAt(first + t))
    let most = 0
    for (let t = 4; t < HELD.length; t++) most = Math.max(most, Math.abs(level(t) - level(t - 1)))
    expect(most).toBeLessThan(5)
    // the course never turns back and never stands while it runs, and it is whole at its last frame
    expect(paceAt(first)).toBe(0)
    for (let f = first + 1; f <= last; f++) expect(paceAt(f), `frame ${f} of the window`).toBeGreaterThan(paceAt(f - 1))
    for (let f = last; f <= last + 4; f++) expect(paceAt(f)).toBe(1)
    expect(TAKE.way.length).toBe(TAKE.frames + 1)
    expect(TAKE.way[0]).toBe(0)
    // the thinnest lines of sight open in the first six frames and the change is under them: they keep the even pace
    for (let i = 0; i <= 6; i++) expect(paceAt(first + i)).toBeCloseTo(i / 16, 12)
    // it begins no earlier than it did, and it is over before the shared storm has opened by itself and well before the hand lets go
    expect(TAKE.fromFrames).toBe(-3)
    expect((TAKE.fromFrames + TAKE.frames) / perBeat).toBeLessThan(VEIL_LOOK.openToBeats)
    expect(w.toBeat + (TAKE.fromFrames + TAKE.frames + 6) / perBeat).toBeLessThanOrEqual(config.shake.liftBeats + config.shake.strokeBeats + config.shake.setDownBeats)
  })

  it("summer's storm lies on one swirl with no eye: a stroke is turned to the circle about one point and strays by its own angle, more in the lower half and at the sides, and a lock is many fine hairs that fan toward the tail", () => {
    const line = CARD.line
    expect(CARD_VERT).toContain('swirlC')
    expect(line.stormSwirl).toBeGreaterThan(0.5)
    expect(line.stormSwirl).toBeLessThanOrEqual(1)
    expect(Math.hypot(line.stormSwirlAt[0], line.stormSwirlAt[1])).toBeLessThan(0.5)
    expect(line.stormEye[0]).toBeLessThan(line.stormEye[1])
    // the lower half and the sides spread by 20 to 30 degrees and more, the upper middle less
    expect(line.stormStrayLow).toBeGreaterThan(line.stormStray)
    expect(line.stormStrayLow).toBeGreaterThanOrEqual((20 * Math.PI) / 180)
    expect(line.stormStrayLow).toBeLessThanOrEqual(Math.PI / 4)
    expect(line.stormStrayTop[0]).toBeLessThan(line.stormStrayTop[1])
    expect(line.stormStraySide[0]).toBeLessThan(line.stormStraySide[1])
    // fewer strokes, and longer
    expect(line.stormKeep).toBeGreaterThan(0)
    expect(line.stormKeep).toBeLessThan(1)
    expect(line.stormLong[0]).toBeLessThan(line.stormLong[1])
    // a lock is many fine hairs, not three or four, and narrower at the head than behind it
    expect(line.stormLockRows).toBeGreaterThanOrEqual(6)
    expect(line.stormLockFan[0]).toBeLessThan(line.stormLockFan[1])
    expect(line.stormLockFan[1]).toBeLessThan(1)
    expect(line.stormLockShare).toBeGreaterThan(0.5)
  })

  it("summer's lights are streaks along the swirl in the storm and soft glows with a bright heart and no edge at rest; a seed at rest is a round tuft, in sizes, with a stalk on about one in eight", () => {
    const glow = CARD.glow
    expect(glow.stormStreakPx[0]).toBeLessThan(glow.stormStreakPx[1])
    expect(glow.stormStreakSkew).toBeGreaterThan(1)
    expect(glow.stormTail).toBeLessThan(1)
    // no ring and no edge on a light out of focus, and the wide faint glows are few
    expect(glow.discRim).toBe(0)
    expect(glow.discEdge).toBe(0)
    // at rest a light is a bright heart in a soft glow by its place in the row of the lit: a share of the lights is not lit, the first of the others are fine points with a faint tight glow, and the later ones have a wide soft glow that holds a small share of the heart's light, so that it is seen round the largest hearts alone; none is large before the miniature and none stands near the lens as a disc
    expect(glow.restOut).toBeGreaterThan(0.3)
    expect(glow.restOut).toBeLessThan(0.75)
    // under the row of the lit stand the specks: the next share of the lights is lit all the same, each as the heart of the finest with less of its light, the first less than the finest and each one fainter than the one before, so a speck is a point of a pixel or two; and a share of the lights stays dark
    expect(glow.restSpeck[0]).toBeGreaterThan(0.2)
    expect(glow.restOut - glow.restSpeck[0]).toBeGreaterThan(0.3)
    expect(glow.restSpeck[2]).toBeLessThan(0.6)
    expect(glow.restSpeck[1]).toBeLessThan(glow.restSpeck[2])
    expect(glow.restSpeck[1]).toBeGreaterThan(0.1)
    expect(CARD_VERT).toContain(`step(${glow.restOut - glow.restSpeck[0]}, fract(h2.x * 113.0)), afloat * (1.0 - max(gustC, uStorm.x))`)
    expect(CARD_FRAG_PARS).toContain('float speckR = clamp((')
    expect(CARD_FRAG_PARS).toContain(', speckR)), smoothstep(0.0, 0.02, speckR)), restL);')
    expect(glow.restHeart[0]).toBeLessThan(0.5)
    expect(glow.restHeart[0] + glow.restHeart[1]).toBeLessThan(2.5)
    expect(glow.restHeart[2]).toBeGreaterThan(1)
    expect(glow.restHeartScene).toBeLessThanOrEqual(1.5)
    expect(glow.restBig[0]).toBeGreaterThan(0.3)
    expect(glow.restBig[0]).toBeLessThan(glow.restBig[1])
    expect(glow.restTop).toBeLessThanOrEqual(0.6)
    expect(glow.restGlowBig[0]).toBeGreaterThan(glow.restHeart[0] + glow.restHeart[1])
    expect(glow.restGlowBig[1]).toBeLessThanOrEqual(7)
    expect(glow.restGlowOf[0]).toBeLessThan(0.2)
    expect(glow.restGlowOf[1] * glow.restGlowVary[1]).toBeLessThan(0.1)
    expect(glow.restCut[0]).toBeLessThan(glow.restCut[1])
    expect(glow.wideOf).toBeLessThanOrEqual(0.05)
    expect(glow.nearShare).toBe(0)
    // a light is one point in every sample of the film's lens: the samples lay no light out as a bunch of dots
    expect(glow.lensFilm).toBe(1)
    // an ember is fall's: it keeps its card's reach, its pale point and its disc, and the lights' own numbers are read by the lights alone
    expect(glow.wide).toBe(4.5)
    expect(CARD_VERT).toContain('reachC = ' + String(glow.wide) + ' * 2.2 * rC')
    // the largest head is nearly three times the smallest across
    expect(CARD.hair.restSpread[1] / CARD.hair.restSpread[0]).toBeGreaterThan(2.5)
    expect(CARD.hair.stalks).toBeCloseTo(1 / 8, 6)
    // a tuft has no ray longer than its radius and no blunt end: its hairs are many, of nearly one length, and fade to the tip
    for (const form of CARD.down.puffs) expect(form.hairs).toBeGreaterThanOrEqual(40)
    expect(CARD.down.puff.long[1]).toBeLessThanOrEqual(1)
    expect(CARD.down.puff.long[0]).toBeGreaterThan(0.7)
    expect(CARD.down.puff.tipFade).toBeGreaterThan(0.5)
    expect(CARD.down.puff.bead).toBe(0)
  })

  it("a head afloat in the calm is a clock the card draws hair by hair: two rings of hairs round a small bright hub on a stalk that hangs, in three classes by depth, with no hair finer than a pixel, and none of it at the storm's full level", () => {
    const clock = CARD.clock
    // a fine head has thirty to forty hairs in its two rings, a stout one no fewer strong ones, and each ring's hairs have their own whole numbers among the 64 of a head, whose last is the head's own
    expect(2 * clock.hairs[0]).toBeGreaterThanOrEqual(30)
    expect(2 * clock.hairs[1]).toBeLessThanOrEqual(40)
    expect(clock.stoutHairs[0]).toBeGreaterThanOrEqual(clock.hairs[0])
    expect(Math.max(clock.hairs[1], clock.stoutHairs[1])).toBeLessThanOrEqual(clock.hairsMost)
    expect(2 * clock.hairsMost).toBeLessThan(63)
    expect(CARD_FRAG_PARS).toContain('vec3 cardHairHash(uint id)')
    expect(CARD_FRAG_PARS).toContain('float cardClockRing(')
    expect(CARD_FRAG_PARS).toContain(`headK + ${clock.hairsMost}u`)
    // the hairs are of unequal length and weight, most of them long, and the fine ring is the fainter; a stout head's fine ring is fainter still
    expect(clock.long[0]).toBeLessThan(clock.long[1])
    expect(clock.long[0]).toBeGreaterThanOrEqual(0.5)
    expect(clock.weight[0]).toBeLessThan(0.5 * clock.weight[1])
    expect(clock.downWeight[1]).toBeLessThan(clock.weight[1])
    expect(clock.stoutDown).toBeLessThan(1)
    // a part of each ring's light is the soft ball under the hairs, more of it in a fine head than in a stout one
    expect(clock.told[0]).toBeLessThan(clock.told[1])
    expect(clock.told[1]).toBeLessThanOrEqual(1)
    expect(clock.downTold[0]).toBeLessThan(clock.told[0])
    // no hair is finer than a pixel: with the pixel's own softness a hair is a pixel wide at half its height, and wider where it is stout or out of focus, so it is a whole line wherever it lies between the pixels
    expect(2.355 * Math.sqrt(PIXEL_SIGMA2 + clock.wide * clock.wide)).toBeGreaterThanOrEqual(1)
    expect(clock.stoutWide).toBeGreaterThanOrEqual(1)
    expect(clock.downWide).toBeGreaterThan(0)
    // a clock stands at one place in every sample of the film's lens, so a hair is one line and a tuft one dot
    expect(clock.lensFilm).toBe(1)
    expect(VERT_MAIN).toContain(`if (abs(shape - ${SHAPE.seed.toFixed(1)}) < 0.5 && uStorm.x < ${clock.stormOff[1]}) lensShare = mix(`)
    // a head hangs near upright and rocks by less than the angle between two hairs of a ring
    expect(clock.rock).toBeLessThan((2 * Math.PI) / clock.hairsMost)
    expect(clock.lean).toBeLessThan(1)
    // three classes by depth: the far ones small, soft and dim, the near ones large and sharp
    expect(clock.mm[0]).toBeLessThan(clock.mm[1])
    expect(clock.mm[1]).toBeLessThan(clock.mm[2])
    expect(clock.mm[2] / clock.mm[0]).toBeGreaterThan(2.5)
    expect(clock.softPx[0]).toBeGreaterThan(clock.softPx[2])
    expect(clock.softPx[2]).toBe(0)
    expect(clock.farWhite).toBeLessThan(clock.white)
    // a far puff takes back the lens look's dimming of what floats far behind the miniature: it is whole to see, a soft grey ball, and it is the count that says how many there are
    expect(clock.farLit).toBeGreaterThan(0)
    expect(clock.farLit).toBeLessThanOrEqual(1)
    expect(CARD_VERT).toContain('keepC *= mix(1.0, 1.0 / mix(')
    expect(CARD_VERT).toContain('- seedFar')
    // few stand before the cottage and the lanterns, fewer in the lower air where they hang thickest, and a stalk hangs under its head, the near one's the longest
    expect(clock.sceneOut[0]).toBeGreaterThanOrEqual(0.9)
    expect(clock.lowOut).toBeGreaterThan(0)
    expect(clock.lowY[0]).toBeLessThan(clock.lowY[1])
    expect(clock.foot[0]).toBeGreaterThan(0)
    expect(clock.footNear[1]).toBeGreaterThan(clock.foot[1])
    expect(clock.stem[1]).toBeLessThan(0.02)
    // the down is no brighter than about the level that burns to white, and only the stout heads in the low sun go over it
    expect(clock.white).toBeLessThanOrEqual(1.1)
    expect(clock.stoutWhite).toBeGreaterThan(clock.white)
    expect(clock.warmShare).toBeLessThanOrEqual(1)
    // a stout near head is the larger, by the head's own whole number, which the vertex and the pixel read alike, and its hairs are bold at the hub and taper to a small tuft
    expect(clock.stoutMm).toBeGreaterThan(1)
    expect(clock.stoutMm).toBeLessThanOrEqual(1.5)
    expect(clock.stoutFall).toBeLessThan(clock.fall)
    expect(clock.stoutTip).toBeLessThan(clock.tip)
    expect(CARD_VERT_PARS).toContain('vec3 cardHairHash(uint id)')
    expect(CARD_VERT).toContain('step(cardHairHash((pid & 4095u) * 64u + 63u).y, ')
    expect(CARD_VERT).toContain('float(pid & 4095u) + 0.01')
    expect(CARD_FRAG_PARS).toContain('ownK = cardHairHash(uint(floor(vKind.z)) * 64u + 63u);')
    // the look is whole in the calm and gone at the storm's full level, where a head is drawn as it was
    expect(clock.stormOff[0]).toBeLessThan(clock.stormOff[1])
    expect(clock.stormOff[1]).toBeLessThanOrEqual(0.99)
    expect(CARD_VERT).toContain('float offC = 0.0;\n      if (uStorm.x < 0.99) offC = 1.0 - smoothstep(')
    expect(CARD_VERT).toContain('denseC = mix(denseC, 1.0 - min(')
    expect(CARD_VERT).toContain('float edgeC = 0.1;\n      if (uStorm.x < 0.99) {')
  })

  it("in the calm no head is let in or taken out at a line as it drifts: the count is gentle over the whole picture, a head on its way in is a small one that grows, and it is whole to see after twelve frames and more at the seed's fastest", () => {
    const clock = CARD.clock
    const smooth = (e0: number, e1: number, x: number) => {
      const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)
      return t * t * (3 - 2 * t)
    }
    // the fastest a seed afloat drifts in a frame, in millimetres
    const fastMm = BEHAVIOUR.seed!.restSpeedMmS / config.film.fps
    // how much larger than life the ball shows a point on its axis, d radii toward the eye from its middle: by the liquid's index at the middle, about twice at the back wall, life size at the front
    const lens = (d: number) => lensIor / (lensIor - (lensIor - 1) * (1 - d))
    expect(lens(0)).toBeCloseTo(lensIor, 9)
    expect(lens(1)).toBeCloseTo(1, 9)
    expect(lens(-1)).toBeGreaterThan(1.9)
    // the share of the count as the shader reckons it: by the depth class (0 far, 1 near) and the height on the picture, in radii of the ball
    const keep = (deep: number, y: number) =>
      Math.min(clock.even * (clock.farMore + (clock.nearLess - clock.farMore) * deep), 1) * (1 - clock.lowOut * (1 - smooth(clock.lowY[0], clock.lowY[1], y))) * (1 - clock.bandOut * Math.exp((-0.5 * (y - clock.bandY[0]) * (y - clock.bandY[0])) / (clock.bandY[1] * clock.bandY[1])))
    // a head is whole to see where the step over the edge has reached goSeen: that share of the edge
    let share = 0
    for (let lo = 0, hi = 1, i = 0; i < 50; i++) {
      share = (lo + hi) / 2
      if (smooth(0, 1, share) < clock.goSeen) lo = share
      else hi = share
    }
    // by the height: the steepest the count is anywhere on the picture, for the far heads (seen largest, at the back wall) and for the others (seen no larger than at the middle)
    for (const [deep, seenLarger] of [
      [0, lens(-1)],
      [0.5, lens(0)],
      [1, lens(0)],
    ] as const) {
      let steepest = 0
      for (let y = -1; y < 1; y += 0.001) steepest = Math.max(steepest, Math.abs(keep(deep, y + 0.001) - keep(deep, y)) / 0.001)
      const framesToWhole = ((clock.edge / steepest) * lensRadiusMm * share) / (fastMm * seenLarger)
      expect(framesToWhole).toBeGreaterThanOrEqual(12)
    }
    // by the depth, where the picture does not swell the way
    const byDepth = (clock.even * Math.abs(clock.farMore - clock.nearLess) * 1.5) / (clock.keepAt[1] - clock.keepAt[0])
    expect(((clock.edge / byDepth) * lensRadiusMm * share) / fastMm).toBeGreaterThanOrEqual(12)
    // about the place where the still liquid gathers the heads fewer are drawn, in a bell in the ball's own millimetres: at its flank, where it is steepest, a head at the seed's fastest takes twelve frames and more
    expect(clock.clumpOut).toBeGreaterThan(0)
    expect(clock.clumpOut).toBeLessThan(1)
    const bell = (clock.clumpOut * Math.exp(-0.5)) / clock.clumpMm
    expect(((clock.edge / bell) * share) / fastMm).toBeGreaterThanOrEqual(12)
    expect(Math.hypot(...clock.clumpAt)).toBeLessThan(lensRadiusMm)
    expect(CARD_VERT).toContain('vec3 clumpK = (nowL - vec3(')
    expect(CARD_VERT).toContain(' * exp(-0.5 * dot(clumpK, clumpK))), offC);')
    // before the cottage and the lanterns a head fades over the whole edge, at the narrower of the two outlines' half heights
    expect(clock.sceneEdge[0]).toBeLessThan(clock.sceneEdge[1])
    const ringMm = (clock.sceneEdge[1] - clock.sceneEdge[0]) * Math.min(CARD.hair.cottageWide[0], CARD.hair.cottageWide[1], CARD.glow.bandWide[0], CARD.glow.bandWide[1]) * lensRadiusMm
    expect(ringMm / (fastMm * lens(-1))).toBeGreaterThanOrEqual(12)
    // a stalk goes over the share of that edge at which the edge is stalkScene deep, before the cottage and before the crown
    let stalkShare = 0
    for (let lo = 0, hi = 1, i = 0; i < 50; i++) {
      stalkShare = (lo + hi) / 2
      if (smooth(0, 1, stalkShare) < Math.min(clock.stalkScene, 1)) lo = stalkShare
      else hi = stalkShare
    }
    const stalkMm = stalkShare * (clock.sceneEdge[1] - clock.sceneEdge[0]) * Math.min(CARD.hair.cottageWide[0], CARD.hair.cottageWide[1], CARD.hair.crownWide[0], CARD.hair.crownWide[1]) * lensRadiusMm
    expect(stalkMm / (fastMm * lens(-1))).toBeGreaterThanOrEqual(12)
    // and at the limb
    expect(clock.rimFrom).toBeLessThan(CARD.hair.rimFrom[0])
    expect(((CARD.hair.rimFrom[1] - clock.rimFrom) * lensRadiusMm) / fastMm).toBeGreaterThanOrEqual(12)
    // a head on its way is small, never a ghost of a large one, and whole to see before it is full grown
    expect(clock.goSize).toBeGreaterThan(0)
    expect(clock.goSize).toBeLessThan(0.5)
    expect(clock.goSeen).toBeGreaterThan(0.5)
    expect(clock.goSeen).toBeLessThanOrEqual(1)
    expect(clock.edge).toBeGreaterThan(0.1)
    // the shader: the step by the head's own number has the calm's own wide edge, the miniature's cut is a fade for all but the few that stay, and neither stands at the storm's full level
    expect(CARD_VERT).toContain('float wholeC = smoothstep(denseC - edgeC, denseC, fract(own * 211.0));')
    expect(CARD_VERT).toContain('keepC *= mix(1.0, mix(wholeC, smoothstep(0.0, ')
    expect(CARD_VERT).toContain('keepC *= 1.0 - calmC * offC * max(max(cotQ, bandQ) * (1.0 - smoothstep(')
    expect(CARD_VERT).not.toContain('pow(max(1.0 - dot(atC, atC), 0.04)')
  })

  it("in the calm no head leaves the picture in one frame where it snags and no stalk is there in one frame: a head afloat goes out over the way of its nearness before the touch, and a stalk comes with its head's class, each over twelve frames and more at the seed's fastest", () => {
    const clock = CARD.clock
    // the fastest a seed afloat goes in a frame and can still snag, in millimetres: the engine holds none that is faster
    const fastMm = BEHAVIOUR.seed!.restSpeedMmS / config.film.fps
    // the draw tells every seed afloat how near it is to what it can snag on, nothing in the open air and all of it before the touch, which is within the seed's layer
    expect(SEED_NEAR.toMm).toBeGreaterThan(SEED_NEAR.fromMm)
    expect(BEHAVIOUR.seed!.layerMm[1]).toBeLessThanOrEqual(SEED_NEAR.fromMm)
    expect((SEED_NEAR.toMm - SEED_NEAR.fromMm) / fastMm).toBeGreaterThanOrEqual(12)
    // the shader: a clock's share goes with that nearness, to nothing at the touch, and its size with it; nothing of it at the storm's full level, where a seed is not asked how near it is
    expect(CARD_VERT).toContain('float snagC = 0.0;\n      if (uStorm.x < 0.99 && aState < ')
    expect(CARD_VERT).toContain('snagC = offC * min(aState * ')
    expect(CARD_VERT).toContain('keepC *= 1.0 - calmC * snagC;')
    expect(CARD_VERT).toContain('wholeC * (1.0 - snagC)), clockC);')
    // and where it is held it is not seen under the storm's full level, as no seed is that has snagged: no tuft comes in one frame where the clock went out. A head the scene has a place for lies as it lay
    expect(CARD_VERT).toContain('if (uStorm.x < 0.99 && ')
    expect(CARD_VERT).toContain(' && !laidB && !glowB && way.z > 0.5 && u5 < max(way.x, way.y)) keepC *= 1.0 - calmS * lying;')
    expect(SEED_NEAR.stormOff[1]).toBeLessThanOrEqual(0.99)
    // which heads show a stalk is each head's own for good, by its own number: the middle ones' few at every depth, and the others near the eye with the near class itself, which comes over the whole depth between the two of nearAt, in radii of the liquid
    expect(clock.stalks[0]).toBeLessThan(clock.stalks[1])
    expect(clock.nearAt[0]).toBeLessThan(clock.nearAt[1])
    expect(((clock.nearAt[1] - clock.nearAt[0]) * innerRadiusMm) / fastMm).toBeGreaterThanOrEqual(12)
    expect(CARD_FRAG_PARS).toContain('float ownStalkK = fract(vL3.x * 47.0);')
    expect(CARD_FRAG_PARS).toContain('stalkK = mix(stalkK, mix(mix(step(ownStalkK, ')
    // no line of the stalk's share moves with the depth past a head's own number
    expect(CARD_FRAG_PARS).not.toContain('step(fract(vL3.x * 47.0), mix(mix(')
  })

  it("a seed or a light at the back of the ball comes in over twelve frames and more: where the lens puts it at once well inside the outline, it rises with its millimetres past the ray through the limb, and only summer's two shapes take that", () => {
    const R = lensRadiusMm
    const eta = 1 / lensIor
    const smooth = (e0: number, e1: number, x: number) => {
      const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)
      return t * t * (3 - 2 * t)
    }
    for (const dist of [config.cameras.hero.distanceMm, config.cameras.macro.distanceMm]) {
      const cl = R / dist
      const sl = Math.sqrt(1 - cl * cl)
      // the ray through the limb grazes the ball and goes on inside at the angle of total reflection: along it, t millimetres from the limb, and past millimetres to the side the eye sees
      const k = Math.sqrt(1 - eta * eta)
      const tx = eta * -sl - k * cl
      const ty = eta * cl - k * sl
      const chord = -2 * R * (cl * tx + sl * ty)
      const at = (t: number, past: number): [number, number, number] => [R * cl + tx * t - ty * past, R * sl + ty * t + tx * past, 0]
      const where = (p: [number, number, number]) => {
        const got = lensPlace(p, [dist, 0, 0], [0, 0, 0])
        const ray = [got.exit[0] - dist, got.exit[1], got.exit[2]]
        // the share of the outline's radius the point stands at on the picture, as the shader reads it for the outline's hide
        return { seen: got.seen, q: Math.hypot(ray[1]!, ray[2]!) / Math.hypot(ray[0]!, ray[1]!, ray[2]!) / cl }
      }
      const hide = (q: number) => 1 - smooth(0.9, 0.985, q)
      // the lens's own law, which is not summer's to change: over the far half of that ray a point a tenth of a millimetre short of it is not drawn, and a tenth past it stands inside the outline's hide, at its full light to a hundredth
      for (const t of [0.6, 0.7, 0.8, 0.9].map((f) => f * chord)) {
        expect(where(at(t, -0.1)).seen).toBe(false)
        const past = where(at(t, 0.1))
        expect(past.seen).toBe(true)
        expect(past.q).toBeLessThan(0.91)
        expect(hide(past.q)).toBeGreaterThan(0.99)
        // so it comes in by the millimetres past the ray: nothing at the ray, half at half the way, whole at the end
        expect(Math.min(hide(past.q), smooth(0, SUMMER_EDGE.mm, 0.1))).toBeLessThan(0.01)
      }
      // near the limb itself a point past the ray stands on the outline, and the outline's hide is the lesser of the two: nothing changes there
      for (const t of [0.1, 0.2, 0.3].map((f) => f * chord)) for (const past of [0.5, 1, 2, 3, 5]) expect(hide(where(at(t, past)).q)).toBeLessThanOrEqual(smooth(0, SUMMER_EDGE.mm, past))
    }
    // twelve frames and more at the fastest a seed afloat or a firefly goes in the calm
    const frame = 1 / config.film.fps
    expect(SUMMER_EDGE.mm / (BEHAVIOUR.seed!.restSpeedMmS * frame)).toBeGreaterThanOrEqual(12)
    expect(SUMMER_EDGE.mm / (BEHAVIOUR.firefly!.cruiseMmS * frame)).toBeGreaterThanOrEqual(12)
    // the shader takes the lesser of the outline's hide and this rise, for the seed's and the light's shapes, and not at the storm's full
    expect(VERT_MAIN).toContain(`if (on > 0.5 && shape > ${(SHAPE.seed - 0.5).toFixed(1)} && shape < ${(SHAPE.light + 0.5).toFixed(1)} && uStorm.x < ${SUMMER_EDGE.stormOff[1]}) {`)
    expect(VERT_MAIN).toContain('rim = min(rim, mix(smoothstep(0.0, ')
    expect(SHAPE.light - SHAPE.seed).toBe(1)
    expect(SUMMER_EDGE.stormOff[1]).toBeLessThanOrEqual(0.99)
    // those two shapes are summer's alone, so no other season's picture can move by it
    for (const season of config.seasons) {
      if (season === 'summer') continue
      for (const kind of particleKinds(season)) {
        expect(lookOf(kind.kind).shape).not.toBe(SHAPE.seed)
        expect(lookOf(kind.kind).shape).not.toBe(SHAPE.light)
      }
    }
  })

  it("the held storm's bank lies low and thin and is the floor the take over's way stands on", () => {
    expect(STORM.bank.density).toBeGreaterThanOrEqual(0.005)
    expect(STORM.bank.level).toBeLessThan(0)
    expect(STORM.calms).toBeLessThanOrEqual(1)
    expect(STORM.white).toBeGreaterThan(0)
  })
})
