import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import type { KitMoment } from '../src/seasons/kit'
import { HELD, landingClock } from '../src/seasons/spring/arrival'
import { FLOW, flowFront } from '../src/seasons/spring/base'
import { poolFill } from '../src/seasons/spring/slab'

const swap = config.shake.swapWindow

function moment(over: Partial<KitMoment>, from = 'spring', to = 'spring', change = 0): KitMoment {
  return { time: 0, period: 0, sinceLanding: 0, arrived: 1, beat: null, seed: 1, frame: { from, to, change } as unknown as KitMoment['frame'], ...over }
}

describe("spring's arrival: the first water", () => {
  it('has no water on the landing frame and all of it once the run is over', () => {
    expect(flowFront(0)).toBe(0)
    expect(flowFront(FLOW.startSeconds)).toBe(0)
    expect(flowFront(FLOW.startSeconds + FLOW.runSeconds)).toBe(1)
    expect(flowFront(Infinity)).toBe(1)
  })

  it('only ever runs down, and never jumps', () => {
    let last = 0
    for (let t = 0; t < 4; t += 1 / 60) {
      const now = flowFront(t)
      expect(now).toBeGreaterThanOrEqual(last)
      expect(now - last).toBeLessThan(0.05)
      last = now
    }
  })

  it('fills the pool only after the water has reached the foot', () => {
    expect(poolFill(0)).toBe(0)
    expect(poolFill(FLOW.startSeconds + 0.5 * FLOW.runSeconds)).toBe(0)
    let last = 0
    for (let t = 0; t < 12; t += 1 / 60) {
      const now = poolFill(t)
      expect(now).toBeGreaterThanOrEqual(last)
      last = now
    }
    expect(last).toBe(1)
    expect(poolFill(Infinity)).toBe(1)
  })
})

describe("spring's arrival: the clock of the landing", () => {
  it('reads the time since the landing at rest and holds a season that has gone', () => {
    expect(landingClock(moment({ sinceLanding: 0.4 }))).toBe(0.4)
    expect(landingClock(moment({ sinceLanding: 12 }))).toBe(12)
    expect(landingClock(moment({ sinceLanding: Infinity }))).toBe(HELD)
  })

  it('stands at nothing while spring comes in and until the globe lands', () => {
    const mid = (swap.fromBeat + swap.toBeat) / 2
    expect(landingClock(moment({ beat: mid, arrived: 0, sinceLanding: 30 }, 'winter', 'spring', 0.5))).toBe(0)
    expect(landingClock(moment({ beat: swap.toBeat + 0.01, arrived: 0, sinceLanding: 30 }))).toBe(0)
  })

  it('leaves the petals lying while spring goes out', () => {
    const mid = (swap.fromBeat + swap.toBeat) / 2
    expect(landingClock(moment({ beat: mid, arrived: 1, sinceLanding: Infinity }, 'spring', 'summer', 0.5))).toBe(HELD)
    expect(landingClock(moment({ beat: swap.fromBeat - 0.01, sinceLanding: 20 }))).toBe(20)
  })

  it('is one function of the moment', () => {
    const m = moment({ sinceLanding: 1.7, time: 9 })
    expect(landingClock(m)).toBe(landingClock(m))
  })
})
