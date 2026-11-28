import { describe, expect, it } from 'vitest'
import { GUST_FLIGHT, GUST_LAST_DOWN, GUST_STREAK, gustStreaks } from '../src/core/materials'
import type { Sample } from '../src/core/sampler'
import { changeRamp, SHUTTER_CHANGE } from '../src/shake/change'

const ramp = changeRamp('base')
const at = (share: number): number => ramp.start + share * ramp.length
const sample = (hold: number | undefined, of: number | undefined, t = 0.5): Sample => ({ index: 0, px: 0, py: 0, lu: 0, lv: 0, t, of, hold })

describe('the scatter in the air, drawn in parts', () => {
  it('has a flight out and a flight in, each with a length', () => {
    expect(GUST_FLIGHT.out[0]).toBeLessThan(GUST_FLIGHT.out[1])
    expect(GUST_FLIGHT.in[0]).toBeLessThan(GUST_FLIGHT.in[1])
    expect(GUST_FLIGHT.in[1]).toBe(GUST_LAST_DOWN)
  })

  it('is never asked for where one sample is a frame', () => {
    expect(gustStreaks(null, false)).toBe(false)
    expect(gustStreaks(null, true)).toBe(false)
  })

  it('is not asked for by a frame of few samples or one that holds no change number', () => {
    const mid = at((GUST_FLIGHT.out[0] + GUST_FLIGHT.out[1]) / 2)
    expect(gustStreaks(sample(mid, GUST_STREAK.join - 1), false)).toBe(false)
    expect(gustStreaks(sample(mid, undefined), false)).toBe(false)
    expect(gustStreaks(sample(undefined, 76), false)).toBe(false)
    expect(gustStreaks(sample(mid, GUST_STREAK.join), false)).toBe(true)
  })

  it('is asked for only by a frame whose shutter is open while a piece is in the air', () => {
    for (const [flight, incoming] of [[GUST_FLIGHT.out, false], [GUST_FLIGHT.in, true]] as const) {
      expect(gustStreaks(sample(at(flight[0]) - 1.01 * SHUTTER_CHANGE, 76), incoming)).toBe(false)
      expect(gustStreaks(sample(at(flight[0]) - 0.5 * SHUTTER_CHANGE, 76), incoming)).toBe(true)
      expect(gustStreaks(sample(at((flight[0] + flight[1]) / 2), 76), incoming)).toBe(true)
      expect(gustStreaks(sample(at(flight[1]) - 0.01 * SHUTTER_CHANGE, 76), incoming)).toBe(true)
      expect(gustStreaks(sample(at(flight[1]) + 0.01 * SHUTTER_CHANGE, 76), incoming)).toBe(false)
    }
    expect(gustStreaks(sample(0, 76), false)).toBe(false)
    expect(gustStreaks(sample(1, 76), true)).toBe(false)
  })

  it('gives every pixel each part about as often over a frame', () => {
    for (const of of [24, 76, 128]) {
      for (let level = 0; level < 256; level += 17) {
        const seen = new Array<number>(GUST_STREAK.parts).fill(0)
        for (let rank = 0; rank < of; rank++) {
          const part = Math.floor((((level + 0.5) / 256 + ((rank * GUST_STREAK.turn) % 1)) % 1) * GUST_STREAK.parts)
          seen[part] = (seen[part] ?? 0) + 1
        }
        const even = of / GUST_STREAK.parts
        expect(Math.min(...seen)).toBeGreaterThanOrEqual(Math.floor(even) - 2)
        expect(Math.max(...seen)).toBeLessThanOrEqual(Math.ceil(even) + 2)
      }
    }
  })
})
