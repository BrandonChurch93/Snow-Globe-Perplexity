import { describe, expect, it } from 'vitest'
import { BODY } from '../assets-src/base-summer/profile.mjs'
import { FALL, fallPaths, fallShare } from '../src/seasons/summer/arrival'

// The sand that falls from the right shoulder of summer's base (open item 87: at rest nothing fell there). Each grain
// leaves the lip of the ledge, clears the belly of the stone and lands on the mound; the fall stands for as long as the
// globe stands, is fuller just after a landing and stops while the globe is in the air.
describe("summer's falling sand", () => {
  const body = BODY as [number, number][]
  const stoneAt = (h: number): number => {
    for (let i = 0; i + 1 < body.length; i++) {
      const [r0, h0] = body[i]!
      const [r1, h1] = body[i + 1]!
      if (h >= h0 && h <= h1) return r0 + ((r1 - r0) * (h - h0)) / Math.max(h1 - h0, 1e-6)
    }
    return 0
  }
  const paths = fallPaths()

  it('is the same list on every call', () => {
    expect(fallPaths()).toEqual(paths)
    expect(paths.length).toBe(FALL.count)
  })

  it('starts at the lip on the right and lands on the mound outside the foot', () => {
    for (const p of paths) {
      const az = (Math.atan2(p.from[0], p.from[2]) * 180) / Math.PI
      expect(az).toBeGreaterThan(60)
      expect(az).toBeLessThan(116)
      expect(Math.hypot(p.from[0], p.from[2])).toBeGreaterThan(52)
      expect(p.from[1]).toBeGreaterThan(40)
      expect(Math.hypot(p.to[0], p.to[2])).toBeGreaterThan(60)
      expect(p.to[1]).toBeGreaterThan(3)
      expect(p.to[1]).toBeLessThan(p.from[1] - 20)
    }
  })

  it('never passes through the stone on its way down', () => {
    let slow = 0
    for (const p of paths) {
      if (p.slide > 0) slow++
      for (let k = 1; k <= 24; k++) {
        const s = (p.seconds * k) / 24
        const h = p.from[1] + p.vy * s - 0.5 * FALL.gravity * s * s
        const reach = p.slide > 0 ? Math.hypot(p.to[0] - p.from[0], p.to[2] - p.from[2]) - p.slide : Math.hypot(p.to[0] - p.from[0], p.to[2] - p.from[2])
        const dir = Math.hypot(p.to[0] - p.from[0], p.to[2] - p.from[2])
        const x = p.from[0] + ((p.to[0] - p.from[0]) / dir) * reach * (k / 24)
        const z = p.from[2] + ((p.to[2] - p.from[2]) / dir) * reach * (k / 24)
        expect(Math.hypot(x, z)).toBeGreaterThan(stoneAt(h))
      }
    }
    // Both kinds are there: grains that tumble down the belly of the stone and grains that clear it.
    expect(slow).toBeGreaterThan(paths.length * 0.3)
    expect(slow).toBeLessThan(paths.length * 0.9)
  })

  it('takes the time a grain of sand takes to fall three centimetres, and is back at the lip only after it has landed', () => {
    const period = 8
    for (const p of paths) {
      expect(p.life).toBeGreaterThanOrEqual(p.seconds)
      expect(p.seconds).toBeGreaterThan(0.04)
      expect(p.life).toBeGreaterThan(0.06)
      expect(p.life).toBeLessThan(0.14)
      // The shader gives each grain a whole number of falls in the ambient period.
      expect(period / Math.max(1, Math.floor(period * p.rate + 0.5))).toBeGreaterThan(p.life + 0.005)
    }
  })

  it('stands at rest, surges after a landing and stops in the air', () => {
    expect(fallShare(-1)).toBe(0)
    expect(fallShare(Infinity)).toBe(FALL.stand)
    expect(fallShare(0)).toBe(1)
    let last = 1
    for (let s = 0; s <= 20; s += 1 / 60) {
      const v = fallShare(s)
      expect(v).toBeLessThanOrEqual(last)
      expect(v).toBeGreaterThanOrEqual(FALL.stand)
      last = v
    }
    expect(fallShare(12)).toBeLessThan(FALL.stand + 0.001)
  })
})
