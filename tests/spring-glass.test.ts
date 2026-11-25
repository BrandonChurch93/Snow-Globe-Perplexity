import { describe, expect, it } from 'vitest'
import { runAt } from '../src/seasons/spring/glass'
import { mistAt } from '../src/seasons/spring/veil'

const SLOTS = 26
const DEG = 180 / Math.PI

describe("spring's glass: the runs", () => {
  it('is one function of the time since the landing', () => {
    for (let j = 0; j < SLOTS; j++) expect(runAt(j, 7.3, 0)).toEqual(runAt(j, 7.3, 0))
  })

  it('has no run on the landing frame and several on their way at rest', () => {
    let atLanding = 0
    let atRest = 0
    for (let j = 0; j < SLOTS; j++) {
      if (runAt(j, 0, 0).b[3] > 0) atLanding++
      const r = runAt(j, 12, 0)
      if (r.b[3] > 0 && r.b[1] - Math.max(r.b[2], r.a[1]) > 15 / DEG) atRest++
    }
    expect(atLanding).toBe(0)
    expect(atRest).toBeGreaterThanOrEqual(10)
  })

  it('never lets a head climb, jump or stand still for long while it slides', () => {
    for (let j = 0; j < SLOTS; j++) {
      let last = runAt(j, 0, 0)
      for (let t = 1 / 60; t < 90; t += 1 / 60) {
        const now = runAt(j, t, 0)
        const sameRun = now.a[0] === last.a[0] && now.b[3] > 0 && last.b[3] > 0
        if (sameRun) {
          expect(now.b[1]).toBeGreaterThanOrEqual(last.b[1])
          // Under 3 mm a frame on the glass, the run off the glass included.
          expect((now.b[1] - last.b[1]) * 60).toBeLessThan(3)
        }
        last = now
      }
    }
  })

  it('grows a head from nothing and never shows a trail ahead of its head', () => {
    for (let j = 0; j < SLOTS; j++)
      for (let t = 0; t < 60; t += 0.05) {
        const r = runAt(j, t, 0)
        expect(r.b[3]).toBeLessThanOrEqual(1.6)
        expect(r.b[1]).toBeGreaterThanOrEqual(r.a[1])
      }
  })

  it('is shaken off whole: no head and no trail left, whatever the time since the landing', () => {
    for (let j = 0; j < SLOTS; j++)
      for (const t of [3, 12, 40, 1e4]) {
        const r = runAt(j, t, 1)
        expect(r.b[3]).toBe(0)
        expect(r.b[2]).toBeGreaterThanOrEqual(r.b[1])
      }
  })
})

describe("spring's veil: the dawn mist", () => {
  it('lies low and thick at the landing, rises and thins, and never ends', () => {
    const a = mistAt(0)
    const b = mistAt(12)
    const c = mistAt(Infinity)
    expect(b.heightMm).toBeGreaterThan(a.heightMm * 2)
    expect(b.density).toBeLessThan(a.density)
    expect(c.heightMm).toBeGreaterThanOrEqual(b.heightMm)
    expect(c.density).toBeGreaterThan(0)
  })
})
