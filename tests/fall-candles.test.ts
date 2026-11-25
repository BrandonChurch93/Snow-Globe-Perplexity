import { describe, expect, it } from 'vitest'
import { faceLevel } from '../src/seasons/fall/base'

// The candles of fall's base after a landing (Round 13, set-B-01: a face that lit, all but went out and lit again read
// as a lighting pop). A face that has caught never goes out again, no frame jumps, and the three a viewer faces are
// alight half a second after the landing, the moment of the approved shake image.
describe("fall's candles after the landing", () => {
  const frames = Array.from({ length: 60 * 5 + 1 }, (_, i) => i / 60)
  const faces = [0, 1, 2, 3, 4, 5, 6]

  it('are dark until the landing and whole long after it', () => {
    for (const i of faces) {
      expect(faceLevel(i, 0)).toBe(0)
      expect(faceLevel(i, -1)).toBe(0)
      expect(faceLevel(i, Infinity)).toBe(1)
      expect(faceLevel(i, 8)).toBeGreaterThan(0.98)
    }
  })

  it('never lets a lit face fall back toward dark', () => {
    for (const i of faces) {
      let peak = 0
      for (const s of frames) {
        const v = faceLevel(i, s)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1.0001)
        // Once a face has reached a level it keeps at least 0.8 of it.
        expect(v).toBeGreaterThanOrEqual(peak * 0.8)
        peak = Math.max(peak, v)
      }
    }
  })

  it('moves by small steps from frame to frame at 60 a second', () => {
    for (const i of faces) {
      for (let k = 1; k < frames.length; k++) {
        const step = faceLevel(i, frames[k]!) - faceLevel(i, frames[k - 1]!)
        expect(step).toBeLessThan(0.14)
        expect(step).toBeGreaterThan(-0.03)
      }
    }
  })

  it('has the three faces a viewer sees alight half a second after the landing, each at its own moment', () => {
    for (const i of [0, 1, 2]) expect(faceLevel(i, 0.5)).toBeGreaterThan(0.6)
    const half = [0, 1, 2].map((i) => frames.find((s) => faceLevel(i, s) > 0.5)!)
    expect(new Set(half).size).toBe(3)
    expect(half[1]).toBeLessThan(half[2]!)
    expect(half[2]).toBeLessThan(half[0]!)
  })
})
