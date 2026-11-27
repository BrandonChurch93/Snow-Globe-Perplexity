import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARD_FRAG_PARS, CARD_VERT } from '../src/particles/draw/cards'
import { CARD, SHAPE, STORM_FLOOD, STORM_LOOSE, STORM_OWN_PATH_FROM, STORM_SHUTTER, STORM_SHUTTER_TURNED, STREAK_ARC } from '../src/particles/draw/looks'
import { VERT_MAIN } from '../src/particles/draw/shader'
import { config } from '../src/config'
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

  it('the seed of summer alone is turned to the whirl on its own path: in the storm its stroke is a curved swish of its own length and width, and none is a bit of green leaf', () => {
    expect(CARD_VERT).toContain('mix(mvC, curC * (length(mvC) * (dot(mvC, curC) < 0.0 ? -1.0 : 1.0)), mix(')
    expect(CARD.line.stormAlign[0]).toBeGreaterThan(0)
    expect(CARD.line.stormAlign[1]).toBeLessThanOrEqual(1)
    expect(CARD.line.stormLong[0]).toBeLessThan(CARD.line.stormLong[1])
    expect(CARD.line.stormWidePx[0]).toBeLessThan(CARD.line.stormWidePx[1])
    expect(CARD.line.stormBow[1]).toBeLessThanOrEqual(CARD.line.stormBowMost)
    expect(CARD.line.stormBowMost).toBeLessThanOrEqual(STREAK_ARC.most)
    // nothing green and flat flies in summer's storm: the seeds, the lights and their streaks are all of it
    expect(CARD.line.stormLeaves).toBe(0)
    expect(CARD.line.stormDwellPx).toBeGreaterThan(0)
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
      expect(u.uVeilBank.value.z).toBeLessThanOrEqual(shared.bank)
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
})
