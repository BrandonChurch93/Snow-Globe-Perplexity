import { describe, expect, it } from 'vitest'
import { BODY, LEDGE_H } from '../assets-src/base-summer/profile.mjs'
import { FALL, GRAIN_ROW, fallPaths, fallShare, grainRows } from '../src/seasons/summer/arrival'

// The sand that falls from the right shoulder of summer's base (open item 87: at rest nothing fell there). Each grain
// leaves the top of the shoulder under the rim of the ledge (round 22: a trickle of single grains from the top of the
// shoulder down the profile, the shells of the base before it), clears the belly of the stone or tumbles down it and
// lands on the mound; the fall stands for as long as the globe stands, is fuller just after a landing and stops while
// the globe is in the air.
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

  it('starts at the top of the shoulder under the rim of the ledge, at the right edge of the base, close to the stone, and lands on the mound outside the foot', () => {
    const rim = LEDGE_H as number
    expect(rim).toBeGreaterThan(38)
    expect(rim).toBeLessThan(42)
    const top = body.find(([, h]) => h > rim - 1)![0]
    for (const p of paths) {
      const az = (Math.atan2(p.from[0], p.from[2]) * 180) / Math.PI
      expect(az).toBeGreaterThan(82)
      expect(az).toBeLessThan(98)
      expect(Math.hypot(p.from[0], p.from[2])).toBeGreaterThan(top)
      expect(Math.hypot(p.from[0], p.from[2])).toBeGreaterThan(stoneAt(p.from[1]))
      expect(Math.hypot(p.from[0], p.from[2])).toBeLessThan(stoneAt(p.from[1]) + 2)
      expect(p.from[1]).toBeLessThanOrEqual(rim)
      expect(p.from[1]).toBeGreaterThan(rim - 2)
      expect(Math.hypot(p.to[0], p.to[2])).toBeGreaterThan(60)
      expect(p.to[1]).toBeGreaterThan(3)
      expect(p.to[1]).toBeLessThan(p.from[1] - 28)
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

  it('takes the time a grain of sand takes to fall three centimetres, and is back at the shoulder only after it has landed', () => {
    const period = 8
    for (const p of paths) {
      expect(p.life).toBeGreaterThanOrEqual(p.seconds)
      expect(p.seconds).toBeGreaterThan(0.03)
      expect(p.life).toBeGreaterThan(0.08)
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

  // Once the jumping grains are gone the draw begins after the grains that only a landing's surge sets falling: a fifth of
  // the fall, never in the air then, and not worth two triangles each. No grain that can still fall is left out of it.
  it('leaves out of the rest draw only grains that the surge alone sets falling', () => {
    const rows = grainRows()
    const n = rows.data.length / GRAIN_ROW
    const kind = (q: number): number => rows.data[q * GRAIN_ROW + 11]!
    // The share a grain belongs to as the shader reads it, in single precision.
    const share = (q: number): number => {
      const v = Math.fround(Math.fround(rows.data[q * GRAIN_ROW + 12]! * Math.fround(FALL.pick[0]!)) + Math.fround(rows.data[q * GRAIN_ROW + 10]! * Math.fround(FALL.pick[1]!)))
      return v - Math.floor(v)
    }
    const most = fallShare(FALL.gone)
    expect(most).toBeGreaterThanOrEqual(FALL.stand)
    let late = 0
    let falling = 0
    for (let q = 0; q < n; q++) {
      if (kind(q) !== 1) continue
      if (q >= rows.mark) {
        falling++
        continue
      }
      expect(share(q)).toBeGreaterThan(most + 1e-4)
      late++
    }
    expect(late + falling).toBe(fallPaths().length)
    for (let q = rows.mark - late; q < rows.mark; q++) expect(kind(q)).toBe(1)
    expect(late).toBeGreaterThan(FALL.count * (1 - FALL.stand) * 0.9)
    expect(late).toBeLessThan(FALL.count * (1 - FALL.stand))
  })
})
