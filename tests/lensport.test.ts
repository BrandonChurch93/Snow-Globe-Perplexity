import { describe, expect, it } from 'vitest'
import { lensPlace } from '../src/globe/lens'
import { lensPlace as ported, sphereCentreMm as portedCentre } from '../tools/lib/lens.mjs'
import { sphereCentreMm } from '../src/scene/cameras'

describe('the lens as the tools use it', () => {
  it('places points exactly as the lens of the page does', () => {
    expect(portedCentre).toBe(sphereCentreMm)
    const centre: [number, number, number] = [0, sphereCentreMm, 0]
    const eye: [number, number, number] = [30, 111, 618]
    let s = 12345
    const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1
    for (let i = 0; i < 400; i++) {
      const p: [number, number, number] = [next() * 50, sphereCentreMm + next() * 50, next() * 50]
      const a = lensPlace(p, eye, centre)
      const b = ported(p, eye, centre)
      expect(b.apparent).toEqual(a.apparent)
      expect(b.exit).toEqual(a.exit)
      expect(b.seen).toBe(a.seen)
    }
  })
})
