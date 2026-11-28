// Decision 294, W5. The sprinkle of grains beside the foot on the left ended on a ruled line on the side of the base's
// shadow: the grains lay whole from the edge of that shadow on and thinned out behind it over a width that was the
// same all the way along, and the veil over them came in over 0.6 mm at that edge. A round base throws a shadow with
// straight sides, so the line was ruled. That side breaks up like the others now: no line of equal cover is straight,
// a grain's chance rises nowhere as a step, and the outline of the grains that are laid wanders.
import { describe, expect, it } from 'vitest'
import { GRAIN_ROW, grainRows } from '../src/seasons/summer/arrival'
import { sandSprinkle, sandSprinkleAt, sandSprinkleRun } from '../src/seasons/summer/slab'

type Law = (x: number, z: number) => number

// The sprinkle's run along the ruled edge, in mm: it comes in from -12 to -2 and goes out from 22 to 78 (slab.ts).
const RUN = [-12, -2, 22, 78] as const
// A place on the table, as mm along the ruled edge and mm into the light from it: what sandSprinkleAt takes.
const AT = sandSprinkleAt(0, 0)
const INTO = sandSprinkleAt(0, 1).map((v, i) => v - AT[i]!)
const WAY = sandSprinkleAt(1, 0).map((v, i) => v - AT[i]!)
const placeOf = (x: number, z: number): { s: number; d: number } => ({ s: (x - AT[0]) * WAY[0]! + (z - AT[1]) * WAY[1]!, d: (x - AT[0]) * INTO[0]! + (z - AT[1]) * INTO[1]! })

// The cuts: every half millimetre along the ruled edge where the sprinkle is whole, every twentieth across it.
const ALONG = { from: -2, to: 60, step: 0.5 }
const ACROSS = { from: -14, to: 30, step: 0.05 }

const cut = (law: Law, s: number): number[] => {
  const v: number[] = []
  for (let d = ACROSS.from; d <= ACROSS.to + 1e-9; d += ACROSS.step) v.push(law(...sandSprinkleAt(s, d)))
  return v
}

/** How far into the light from the ruled edge `law` first comes to `share` of its most on the cut across at `s`, in mm. */
const first = (law: Law, s: number, share: number): number => {
  const v = cut(law, s)
  const most = Math.max(...v)
  return ACROSS.from + ACROSS.step * v.findIndex((c) => c >= share * most)
}

/** The line where `law` comes to `share` of its most, along the ruled edge. */
const contour = (law: Law, share: number): number[] => {
  const line: number[] = []
  for (let s = ALONG.from; s <= ALONG.to + 1e-9; s += ALONG.step) line.push(first(law, s, share))
  return line
}

/** Of a line of numbers: least to greatest, the rms about the straight line that fits it best, and how often it turns by over `by`. */
const wander = (a: number[], by: number): { spread: number; rms: number; turns: number } => {
  const n = a.length
  const mx = (n - 1) / 2
  const my = a.reduce((p, q) => p + q, 0) / n
  let sxy = 0
  let sxx = 0
  a.forEach((y, i) => {
    sxy += (i - mx) * (y - my)
    sxx += (i - mx) ** 2
  })
  const k = sxy / sxx
  const rms = Math.sqrt(a.reduce((p, y, i) => p + (y - my - k * (i - mx)) ** 2, 0) / n)
  let turns = 0
  let dir = 0
  let ref = a[0]!
  for (const y of a) {
    if (dir >= 0 && y < ref - by) {
      turns++
      dir = -1
      ref = y
    } else if (dir <= 0 && y > ref + by) {
      turns++
      dir = 1
      ref = y
    } else if ((dir > 0 && y > ref) || (dir < 0 && y < ref)) ref = y
  }
  return { spread: Math.max(...a) - Math.min(...a), rms, turns }
}

/** The steepest a grain's chance rises into the light, a millimetre, anywhere on the cuts. */
const steepest = (law: Law): number => {
  let steep = 0
  for (let s = ALONG.from; s <= ALONG.to + 1e-9; s += ALONG.step) {
    const v = cut(law, s)
    for (let i = 1; i < v.length; i++) steep = Math.max(steep, (v[i]! - v[i - 1]!) / ACROSS.step)
  }
  return steep
}

describe("summer's sprinkle beside the foot, on the side of the base's shadow", () => {
  it('has no straight line of equal cover in its core', () => {
    // Before: the core came in over 5 mm behind the ruled edge, the same at every place, so each line of equal cover
    // ran beside that edge within a few tenths of a millimetre.
    for (const share of [0.1, 0.5]) {
      const w = wander(contour(sandSprinkleRun, share), 1)
      expect(w.spread).toBeGreaterThan(5)
      expect(w.rms).toBeGreaterThan(1)
      expect(w.turns).toBeGreaterThanOrEqual(4)
    }
  })

  it('has no straight line of equal cover in its veil, and none of the veil at the ruled edge or behind it', () => {
    // Before: the veil came in over 0.6 mm at the ruled edge itself.
    for (const share of [0.1, 0.5]) {
      const line = contour(sandSprinkle, share)
      const w = wander(line, 0.5)
      expect(w.spread).toBeGreaterThan(1.5)
      expect(w.rms).toBeGreaterThan(0.4)
      expect(w.turns).toBeGreaterThanOrEqual(4)
      expect(Math.min(...line)).toBeGreaterThan(0)
    }
    // arrival.ts lays the veil's grains from the ruled edge on; the veil asks for none there.
    for (let s = ALONG.from; s <= ALONG.to + 1e-9; s += ALONG.step) {
      for (let d = ACROSS.from; d <= 0; d += 0.25) expect(sandSprinkle(...sandSprinkleAt(s, d))).toBe(0)
    }
  })

  it("lets a grain's chance rise nowhere as a step", () => {
    // Before: the veil rose from nothing to its most inside 0.6 mm, over 2 a millimetre.
    expect(steepest(sandSprinkleRun)).toBeLessThan(0.5)
    expect(steepest(sandSprinkle)).toBeLessThan(0.5)
  })

  it('comes in over a width of its own at every place', () => {
    // From a tenth of its most to nine tenths: the width is not one number all the way along.
    for (const law of [sandSprinkleRun, sandSprinkle]) {
      const tenth = contour(law, 0.1)
      const nine = contour(law, 0.9)
      const wide = tenth.map((t, i) => nine[i]! - t)
      expect(Math.min(...wide)).toBeGreaterThan(0.5)
      expect(Math.max(...wide) - Math.min(...wide)).toBeGreaterThan(2)
    }
  })

  it('still lies where it lay: along the same run, and whole a little way into the light', () => {
    // Nothing before the run's start and nothing past its end.
    for (const s of [RUN[0] - 1, RUN[3] + 1]) for (let d = -14; d <= 30; d += 0.5) {
      expect(sandSprinkleRun(...sandSprinkleAt(s, d))).toBe(0)
      expect(sandSprinkle(...sandSprinkleAt(s, d))).toBe(0)
    }
    // A hand's breadth into the light the core is as it was: whole but for its own mottle (0.55 to 1).
    for (let s = RUN[1]; s <= RUN[2]; s += 1) expect(sandSprinkleRun(...sandSprinkleAt(s, 20))).toBeGreaterThan(0.54)
  })

  it('lays grains whose outline on that side wanders', () => {
    // The grains as they are laid (arrival.ts): the sprinkle's are the last of the rows. Their place along the ruled
    // edge and into the light from it, and in every 6 mm along it the tenth of them that lie furthest back: the
    // outline of the sprinkle on the side of the shadow. Before, that outline ran 0.8 to 1.5 mm behind the ruled
    // edge all the way along.
    const rows = grainRows()
    const n = rows.data.length / GRAIN_ROW
    const COUNT = 2400
    const bins: number[][] = Array.from({ length: 10 }, () => [])
    let behind = 0
    for (let q = n - COUNT; q < n; q++) {
      const x = rows.data[q * GRAIN_ROW]!
      const z = rows.data[q * GRAIN_ROW + 2]!
      // Every one of them lies left of the stage's axis, beside the foot.
      expect(x).toBeLessThan(-45)
      const { s, d } = placeOf(x, z)
      if (d < 0) behind++
      const b = Math.floor((s + 2) / 6)
      if (b >= 0 && b < bins.length) bins[b]!.push(d)
    }
    const outline = bins.map((b) => {
      expect(b.length).toBeGreaterThan(40)
      const sorted = [...b].sort((p, q) => p - q)
      return sorted[Math.floor(sorted.length / 10)]!
    })
    const w = wander(outline, 1)
    expect(w.spread).toBeGreaterThan(3)
    expect(w.rms).toBeGreaterThan(0.7)
    expect(w.turns).toBeGreaterThanOrEqual(2)
    // The sprinkle still thins out into the shadow: a share of its grains lies behind the ruled edge, as before.
    expect(behind / COUNT).toBeGreaterThan(0.15)
    expect(behind / COUNT).toBeLessThan(0.4)
  }, 120000)
})
