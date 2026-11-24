import { describe, expect, it } from 'vitest'
import { Rng, hash2, hashText, stream, streamSeed, unit } from '../src/core/rng'

const take = (r: Rng, n: number) => Array.from({ length: n }, () => r.next())

describe('seeded random', () => {
  it('gives the same values for the same seed and stream', () => {
    expect(take(stream('particles'), 64)).toEqual(take(stream('particles'), 64))
    expect(take(new Rng(42), 64)).toEqual(take(new Rng(42), 64))
  })

  it('gives different values for another stream or another seed', () => {
    expect(take(stream('particles'), 8)).not.toEqual(take(stream('lights'), 8))
    expect(take(stream('particles', 1), 8)).not.toEqual(take(stream('particles', 2), 8))
    expect(streamSeed('a')).not.toBe(streamSeed('b'))
  })

  it('stays inside its ranges', () => {
    const r = stream('ranges')
    for (let i = 0; i < 5000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      const q = r.range(-3, 7)
      expect(q).toBeGreaterThanOrEqual(-3)
      expect(q).toBeLessThan(7)
      const k = r.int(6)
      expect(Number.isInteger(k) && k >= 0 && k < 6).toBe(true)
    }
  })

  it('is spread evenly enough', () => {
    const r = stream('spread')
    const bins = new Array(10).fill(0)
    const n = 20000
    for (let i = 0; i < n; i++) bins[Math.floor(r.next() * 10)]++
    for (const b of bins) expect(Math.abs(b - n / 10)).toBeLessThan(n * 0.012)
  })

  it('hashes are stable', () => {
    expect(hashText('snow', 1)).toBe(hashText('snow', 1))
    expect(hash2(3, 4)).toBe(hash2(3, 4))
    expect(hash2(3, 4)).not.toBe(hash2(4, 3))
    expect(unit(hash2(1, 2))).toBeLessThan(1)
    expect(new Rng(7).next()).toBeCloseTo(new Rng(7).next(), 15)
  })
})
