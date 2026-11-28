// Decision 294, W5. The sprinkle of grains beside the foot on the left ended on a ruled line on the side of the base's
// shadow: the grains lay whole from the edge of that shadow on and thinned out behind it over a width that was the
// same all the way along, and the veil over them came in over 0.6 mm at that edge. A round base throws a shadow with
// straight sides, so the line was ruled. That side breaks up like the others now: no line of equal cover is straight,
// a grain's chance rises nowhere as a step, and the outline of the grains that are laid wanders.
//
// Decision 319, W5b. W5 broke the ruled side where it was longest, and the sprinkle still closed to a point: its last
// stretch before the tip (x 1150 to 1290 of the film's frame at 3840 wide) lay whole between two straight lines that
// meet, a dense wedge aimed at the base's foot, its underside there as good as ruled. That head is loose now, and it
// is measured here as the camera sees it (the second block of tests).
import { describe, expect, it } from 'vitest'
import { filmCut } from '../src/film/cut'
import { filmPose } from '../src/film/moves'
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

// The head as the camera sees it. LEAN is how the sprinkle lies to the lens: places of one `s + LEAN * d` stand over
// one another in the picture. So `u` runs across the picture, less of it further to the right and nearer the base,
// and at one `u` more of `d` is further up the picture: in the film's frame at 3840 wide a place stands at about
// x 1186 - 5.6 u. The stretch the review named, x 1150 to 1290, is `u` from 6.5 down to the tip; HEAD is a little
// more of it, x 1130 on.
const LEAN = 1.82
const HEAD = 10
/** The place on the table that stands at `u` across the picture and `d` mm into the light. */
const seenAt = (u: number, d: number): [number, number] => sandSprinkleAt(u - LEAN * d, d)
/** Of a list of numbers, the one that `share` of them lie under. */
const under = (a: number[], share: number): number => [...a].sort((p, q) => p - q)[Math.min(a.length - 1, Math.floor(a.length * share))]!

// The sprinkle's grains as they are laid (arrival.ts: the last of the rows), each with its place in the picture.
interface Grain {
  x: number
  z: number
  u: number
  d: number
}
let laidGrains: Grain[] | null = null
const laid = (): Grain[] => {
  if (!laidGrains) {
    const rows = grainRows()
    const n = rows.data.length / GRAIN_ROW
    laidGrains = []
    for (let q = n - 2400; q < n; q++) {
      const x = rows.data[q * GRAIN_ROW]!
      const z = rows.data[q * GRAIN_ROW + 2]!
      const { s, d } = placeOf(x, z)
      laidGrains.push({ x, z, u: s + LEAN * d, d })
    }
  }
  return laidGrains
}

describe("summer's sprinkle beside the foot, at its head, the end its grains start at", () => {
  it('is measured as the camera of the film sees it', () => {
    // While the globe stands, the base hides most of the head from the hero camera. The film shows it while the globe
    // is off the table in the shake that takes summer away, and through that shake, up to the end of its swap, its
    // lens lies along the lean from the head's middle in every frame. 2072 and 2096, the frames the review was held
    // on, are two of them.
    const cut = filmCut()
    const shake = cut.shakes.find((s) => s.from === 'summer')!
    expect(shake.first).toBeLessThan(2072)
    expect(shake.swap.last).toBeGreaterThan(2096)
    const [x, z] = seenAt(0, -5)
    for (let f = shake.first; f <= shake.swap.last; f++) {
      const pose = filmPose(cut, f / cut.fps)
      const to = [pose.position.x - x, pose.position.z - z] as const
      const lean = -(to[0] * WAY[0]! + to[1] * WAY[1]!) / (to[0] * INTO[0]! + to[1] * INTO[1]!)
      expect(Math.abs(lean - LEAN)).toBeLessThan(0.02)
    }
  })

  it('is loose where its head lay whole', () => {
    // Before (W5): where the wedge lay, a grain's chance was 0.34 on the average and 0.83 at the most, whole but for
    // the mottle. Loose grains lie there now: nowhere half of whole, a tenth at the most on the average.
    let sum = 0
    let n = 0
    let most = 0
    for (let u = -12; u <= 0; u += 0.5) for (let d = -4; d <= 4; d += 0.5) {
      const c = sandSprinkleRun(...seenAt(u, d))
      sum += c
      n++
      most = Math.max(most, c)
    }
    expect(sum / n).toBeLessThan(0.1)
    expect(most).toBeLessThan(0.5)
  })

  it('has no straight underside at its head', () => {
    // The line where a grain's chance comes to half of its most, from below, across the picture, over the stretch
    // whose underside the review found nearly ruled, x 1150 to 1270 (`u` from 6.5 down to -15). Before (W5) it lay
    // within 0.49 mm of one straight line all the way (0.22 mm rms) and turned once: the ruled underside. It wanders
    // now as the lines along the run do, by the same floors.
    const line: number[] = []
    for (let u = -15; u <= 6.5 + 1e-9; u += 0.5) {
      const v: number[] = []
      for (let d = -16; d <= 20 + 1e-9; d += 0.05) v.push(sandSprinkleRun(...seenAt(u, d)))
      const most = Math.max(...v)
      line.push(-16 + 0.05 * v.findIndex((c) => c >= 0.5 * most))
    }
    const w = wander(line, 1)
    expect(w.spread).toBeGreaterThan(5)
    expect(w.rms).toBeGreaterThan(1)
    expect(w.turns).toBeGreaterThanOrEqual(4)
  })

  it('lays a head of loose grains: soft below, thinner than the body, and wide to its end', () => {
    const g = laid()
    // Soft below: in every 4 mm across the picture, how far it is from the grain a tenth of them lie under up to the
    // middle one. Before (W5) 2.6 mm on the average.
    const soft: number[] = []
    for (let u = -9; u < 11 - 1e-9; u += 4) {
      const d = g.filter((p) => p.u >= u && p.u < u + 4).map((p) => p.d)
      expect(d.length).toBeGreaterThan(20)
      soft.push(under(d, 0.5) - under(d, 0.1))
    }
    expect(soft.reduce((p, q) => p + q, 0) / soft.length).toBeGreaterThan(3.5)
    // How many grains lie within 2 mm of each grain, itself counted.
    const near = g.map((p) => g.reduce((c, o) => c + (Math.hypot(o.x - p.x, o.z - p.z) < 2 ? 1 : 0), 0))
    const about = (keep: (p: Grain) => boolean): number[] => near.filter((_, i) => keep(g[i]!))
    // No denser than the rest: before (W5) the head held the densest place of the whole sprinkle, 72 grains against
    // 60 anywhere else.
    expect(Math.max(...about((p) => p.u < HEAD))).toBeLessThan(Math.max(...about((p) => p.u >= HEAD)))
    // Thinner than the body: about the middle grain of the last stretch before the tip (`u` under 0) lie at most
    // seven tenths as many as about the middle grain of the body (`u` from 15 to 45). Before (W5) 41 against 29: the
    // head was the thickest of it all.
    expect(under(about((p) => p.u < 0), 0.5)).toBeLessThan(0.7 * under(about((p) => p.u >= 15 && p.u < 45), 0.5))
    // Wide to its end: the end is where a fiftieth of the grains lie further on, and in the last 4 mm before it the
    // grains lie over 8 mm across (from the twentieth of them to the nineteenth of twenty). Before (W5) 5.5 mm: it
    // closed to a point.
    const end = under(g.map((p) => p.u), 0.02)
    const last = g.filter((p) => p.u >= end && p.u < end + 4).map((p) => p.d)
    expect(under(last, 0.95) - under(last, 0.05)).toBeGreaterThan(8)
  }, 120000)
})
