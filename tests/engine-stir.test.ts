import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import type { Timeline } from '../src/film/timeline'
import { Liquid, LIQUID_ROLL, LIQUID_STIR, LIQUID_TURN, ROLL_MAX, STIR_RAD_S2, liquidWhirl } from '../src/globe/liquid'
import { ParticleEngine } from '../src/particles/engine/engine'
import { buildCollider } from '../src/scene/layout'
import { REST_POSE } from '../src/shake/table'
import { barSeconds, globePoseAt, stillTimeline } from '../src/film/timeline'

const HZ = config.sim.stepHz
const DT = 1 / HZ
const FPS = 60
const PER_FRAME = HZ / FPS
const collider = buildCollider()
const idle = (season: string): Timeline => ({ id: `idle:${season}`, startSeason: season, events: [] })

describe('a stir is a push the liquid takes up over tenths of a second', () => {
  it('raises the turn at a bounded pace, gives the whole push in the end, and is the same fed at once or in pieces', () => {
    const once = new Liquid()
    const fed = new Liquid()
    once.stir(0, 6, 0)
    let was = 0
    let peak = 0
    for (let n = 0; n < HZ * 2; n++) {
      if (n < 48 && n % 4 === 0) fed.stir(0, 0.5, 0)
      once.step(REST_POSE, REST_POSE, REST_POSE, n * DT)
      fed.step(REST_POSE, REST_POSE, REST_POSE, n * DT)
      const w = once.state[LIQUID_TURN + 1]!
      expect(w - was).toBeLessThanOrEqual(STIR_RAD_S2 * DT * 1.0001)
      was = w
      if (w > peak) peak = w
    }
    expect(once.state[LIQUID_TURN + 1]! < peak).toBe(true)
    expect(peak).toBeGreaterThan(2.5)
    expect(peak).toBeLessThan(6)
    expect(once.state[LIQUID_STIR + 1]).toBeLessThan(0.05)
    expect(fed.state[LIQUID_STIR + 1]).toBeLessThan(0.05)
    expect(Math.abs(fed.state[LIQUID_TURN + 1]! - once.state[LIQUID_TURN + 1]!)).toBeLessThan(0.25)
    for (let n = HZ * 2; n < HZ * 5; n++) once.step(REST_POSE, REST_POSE, REST_POSE, n * DT)
    expect(once.state[LIQUID_STIR + 1]).toBe(0)
    for (let n = HZ * 5; n < HZ * 40; n++) once.step(REST_POSE, REST_POSE, REST_POSE, n * DT)
    expect(once.atRest).toBe(true)
  })

  for (const season of config.seasons) {
    it(`in ${season}: lifts what lies over many frames, no frame a whole storm, and as much as a hard stir should`, () => {
      const tl = idle(season)
      const e = new ParticleEngine({ season, fraction: 0.2, collider })
      e.reset(season)
      e.advanceTo(HZ, tl)
      const calm = e.floating()
      let was = calm
      let most = 0
      let frames = 0
      let top = calm
      e.stir(0, 6, 0)
      for (let f = 1; f <= 90; f++) {
        e.advanceTo(HZ + f * PER_FRAME, tl)
        const now = e.floating()
        if (now - was > most) most = now - was
        if (now - was > 0.002 * e.count) frames++
        if (now > top) top = now
        was = now
      }
      const lifted = top - calm
      expect(lifted).toBeGreaterThan(e.count * 0.04)
      expect(most).toBeLessThan(lifted * 0.15)
      if (lifted > e.count * 0.1) expect(frames).toBeGreaterThanOrEqual(12)
    }, 120000)
  }
})

describe('the number that says landed, turning slowly', () => {
  it('is nothing at rest and while the hand strokes, near one soon after the landing, and gone when the whirl has died', () => {
    const tl = stillTimeline('winter')
    const liquid = new Liquid()
    expect(liquidWhirl(liquid.state)).toBe(0)
    let n = 0
    const to = (sec: number, each?: () => void): void => {
      for (const end = Math.round(sec * HZ); n < end; n++) {
        const t = n * DT
        liquid.step(globePoseAt(tl, t - DT), globePoseAt(tl, t), globePoseAt(tl, t + DT), t)
        if (each) each()
      }
    }
    let stroked = 0
    let steps = 0
    to(barSeconds * 0.3)
    to(barSeconds * 0.8, () => {
      stroked += liquidWhirl(liquid.state)
      steps++
    })
    expect(stroked / steps).toBeLessThan(0.2)
    to(barSeconds + 0.35)
    const landed = liquidWhirl(liquid.state)
    expect(landed).toBeGreaterThan(0.8)
    to(barSeconds + 2)
    const later = liquidWhirl(liquid.state)
    expect(later).toBeLessThan(landed)
    expect(later).toBeGreaterThan(0.25)
    expect(Math.abs(later - liquid.state[LIQUID_ROLL]! / ROLL_MAX)).toBeLessThan(0.02)
    to(barSeconds + config.states.restSeconds)
    expect(liquidWhirl(liquid.state)).toBe(0)
  })
})
