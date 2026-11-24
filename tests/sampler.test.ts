import { describe, expect, it } from 'vitest'
import { diskPoint, sampleSet } from '../src/core/sampler'

describe('sampler', () => {
  it('is deterministic', () => {
    expect(sampleSet(24, 5)).toEqual(sampleSet(24, 5))
    expect(sampleSet(24, 5)).not.toEqual(sampleSet(24, 6))
  })

  it('keeps every sample inside the pixel, the lens and the shutter', () => {
    for (const n of [1, 2, 8, 24, 64]) {
      for (const s of sampleSet(n, 3)) {
        expect(Math.abs(s.px)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(s.py)).toBeLessThanOrEqual(0.5)
        expect(s.lu * s.lu + s.lv * s.lv).toBeLessThanOrEqual(1 + 1e-9)
        expect(s.t).toBeGreaterThanOrEqual(0)
        expect(s.t).toBeLessThan(1)
      }
    }
  })

  it('covers the pixel', () => {
    const set = sampleSet(64, 0)
    const cells = new Set(set.map((s) => `${Math.floor((s.px + 0.5) * 4)}:${Math.floor((s.py + 0.5) * 4)}`))
    expect(cells.size).toBe(16)
    const mx = set.reduce((a, s) => a + s.px, 0) / set.length
    const my = set.reduce((a, s) => a + s.py, 0) / set.length
    expect(Math.abs(mx)).toBeLessThan(0.04)
    expect(Math.abs(my)).toBeLessThan(0.04)
  })

  it('covers the lens', () => {
    const set = sampleSet(64, 0)
    const quadrants = new Set(set.map((s) => `${s.lu > 0}:${s.lv > 0}`))
    expect(quadrants.size).toBe(4)
    const inner = set.filter((s) => Math.hypot(s.lu, s.lv) < Math.SQRT1_2).length
    expect(Math.abs(inner - 32)).toBeLessThanOrEqual(6)
  })

  it('covers the shutter with one sample in each slice', () => {
    for (const n of [2, 8, 24]) {
      const slices = sampleSet(n, 9).map((s) => Math.floor(s.t * n)).sort((a, b) => a - b)
      expect(slices).toEqual(Array.from({ length: n }, (_, i) => i))
    }
    expect(sampleSet(1, 0)[0]!.t).toBe(0.5)
  })

  it('maps the square onto the disk', () => {
    expect(diskPoint(0.5, 0.5)).toEqual([0, 0])
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [0.2, 0.9]] as const) {
      const [x, y] = diskPoint(u, v)
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
})
