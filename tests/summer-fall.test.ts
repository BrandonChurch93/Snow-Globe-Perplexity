import { describe, expect, it } from 'vitest'
import { BODY, LEDGE_H } from '../assets-src/base-summer/profile.mjs'
import { FALL, GRAIN_ROW, fallPaths, fallShare, grainRows } from '../src/seasons/summer/arrival'
import type { FallPath } from '../src/seasons/summer/arrival'

// The sand that falls from the right shoulder of summer's base (open item 87: at rest nothing fell there). It
// leaves the top of the shoulder under the rim of the ledge (round 22: a trickle from the top of the shoulder down the
// profile, the shells of the base before it), clears the belly of the stone or runs down it and lands on the mound;
// the fall stands for as long as the globe stands, is fuller just after a landing and stops while the globe is in the
// air. It is a sheet of threads, each the one path its sand takes and each a row for every grain it is drawn with, and
// a few loose grains that sink along its outer face (`slide` under 0).
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
  let made: ReturnType<typeof grainRows> | undefined
  const fileRows = (): ReturnType<typeof grainRows> => (made ??= grainRows())

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
      // The sand of a thread falls freely. A loose grain sinks at its own even speed, along the path of sand that falls.
      const along = (s: number): number => (Math.sqrt(FALL.lead * FALL.lead - 2 * FALL.gravity * p.vy * s) - FALL.lead) / FALL.gravity
      for (let k = 1; k <= 24; k++) {
        const s = (p.seconds * k) / 24
        const h = p.slide < 0 ? p.from[1] + p.vy * s : p.from[1] + p.vy * s - 0.5 * FALL.gravity * s * s
        const reach = p.slide > 0 ? Math.hypot(p.to[0] - p.from[0], p.to[2] - p.from[2]) - p.slide : Math.hypot(p.to[0] - p.from[0], p.to[2] - p.from[2])
        const dir = Math.hypot(p.to[0] - p.from[0], p.to[2] - p.from[2])
        const gone = p.slide < 0 ? along(s) / along(p.seconds) : k / 24
        const x = p.from[0] + ((p.to[0] - p.from[0]) / dir) * reach * gone
        const z = p.from[2] + ((p.to[2] - p.from[2]) / dir) * reach * gone
        expect(Math.hypot(x, z)).toBeGreaterThan(stoneAt(h))
      }
    }
    // Both kinds are there: threads that run down the belly of the stone and threads that clear it.
    expect(slow).toBeGreaterThan(paths.length * 0.3)
    expect(slow).toBeLessThan(paths.length * 0.9)
  })

  it('takes the time sand takes to fall three centimetres, a loose grain the time fine dust takes to sink them, and a loose grain is back at the shoulder only after it has landed', () => {
    const period = 8
    for (const p of paths) {
      expect(p.life).toBeGreaterThanOrEqual(p.seconds)
      expect(p.seconds).toBeGreaterThan(0.03)
      expect(p.life).toBeGreaterThan(p.slide < 0 ? 0.3 : 0.08)
      expect(p.life).toBeLessThan(p.slide < 0 ? 0.9 : 0.14)
      // The shader gives each loose grain a whole number of falls in the ambient period, and draws it for one opening of
      // the shutter more than it flies. A grain of a thread is at every place of its path a whole number of times in
      // `fold` ambient periods, so the stream comes round with the period: three times at the back of the sheet, and
      // three, four or five times at its face (decision 201: the whole fall travels and nothing of it stands).
      expect(p.rate).toBeGreaterThan(0)
      expect(period / Math.max(1, Math.floor(period * p.rate + 0.5))).toBeGreaterThan(p.life + 0.005)
      if (p.slide < 0) expect(period / Math.max(1, Math.floor(period * p.rate + 0.5))).toBeGreaterThan(p.life + FALL.shutter)
      else expect(p.back ? [3] : [3, 4, 5]).toContain(p.rate * FALL.fold * period)
    }
  })

  // A thread is one path, and the rows of its grains differ in nothing but how far down it the grain is: no grain of a
  // thread can be drawn beside the line of the others, and the grains are dealt evenly down it, each a chance way off
  // its place. The threads at the back of the sheet come first and then those of its face. Each kind lies in the order
  // of its speed, the slowest next to the stone, and lands in that order: none crosses another of its kind.
  it('is threads of grains dealt evenly down one path, side by side in the order of their speed', () => {
    const sand = paths.filter((p) => p.slide >= 0)
    const loose = paths.filter((p) => p.slide < 0)
    expect(paths.slice(0, sand.length).every((p) => p.slide >= 0)).toBe(true)
    const threads: FallPath[][] = []
    for (const p of sand) {
      const last = threads[threads.length - 1]
      if (last && last[0]!.id === p.id && last[0]!.from[0] === p.from[0] && last[0]!.from[2] === p.from[2]) last.push(p)
      else threads.push([p])
    }
    const back = threads.filter((t) => t[0]!.back)
    const face = threads.filter((t) => !t[0]!.back)
    expect(back.length).toBeGreaterThan(20)
    expect(face.length).toBeGreaterThan(30)
    expect(threads.slice(0, back.length).every((t) => t[0]!.back)).toBe(true)
    expect(loose.every((p) => !p.back)).toBe(true)
    expect(loose.length).toBeGreaterThan(0)
    expect(loose.length).toBeLessThan(threads.length)
    for (const kind of [back, face]) {
      let last = { speed: 0, lands: 0 }
      for (const t of kind) {
        const first = t[0]!
        expect(t.length % FALL.fold).toBe(0)
        const dealt = t.length / FALL.fold
        expect(dealt).toBeGreaterThan(3)
        t.forEach((p, i) => {
          expect({ ...p, phase: 0 }).toEqual({ ...first, phase: 0 })
          const place = (p.phase * FALL.fold - (i % FALL.fold)) * dealt - Math.floor(i / FALL.fold)
          expect(place).toBeGreaterThan(-1e-9)
          expect(place).toBeLessThan(1 + 1e-9)
        })
        const way = Math.hypot(first.to[0] - first.from[0], first.to[2] - first.from[2])
        const speed = (way - Math.max(first.slide, 0)) / first.seconds
        const lands = Math.hypot(first.to[0], first.to[2])
        expect(speed).toBeGreaterThan(last.speed)
        expect(lands).toBeGreaterThan(last.lands)
        last = { speed, lands }
      }
    }
  })

  // Neighbours shear: no two threads of the face that lie side by side go down as often, whether the surge's threads
  // run between them or not, each of the three numbers has a third of the threads that stand, and their mean is four.
  it('runs the threads of its face at three rates dealt so that no two neighbours share one', () => {
    const period = 8
    expect(FALL.turns).toEqual([3, 4, 5])
    expect(FALL.deepTurns).toBe(3)
    const rows = fileRows()
    const share = (q: number): number => {
      const v = Math.fround(Math.fround(rows.data[q * GRAIN_ROW + 12]! * Math.fround(FALL.pick[0]!)) + Math.fround(rows.data[q * GRAIN_ROW + 10]! * Math.fround(FALL.pick[1]!)))
      return v - Math.floor(v)
    }
    // A row of the file says with the sign of its rate whether its grain is at the back of the sheet.
    let behind = 0
    const stands = new Set<number>()
    for (let q = 0; q < rows.data.length / GRAIN_ROW; q++) {
      if (rows.data[q * GRAIN_ROW + 11] !== 1) continue
      if (rows.data[q * GRAIN_ROW + 6]! < 0) behind++
      if (share(q) <= FALL.stand) stands.add(rows.data[q * GRAIN_ROW + 10]! * 1e6 + rows.data[q * GRAIN_ROW + 3]!)
    }
    expect(behind).toBe(paths.filter((p) => p.back).length)
    const face: FallPath[] = []
    for (const p of paths) {
      if (p.slide < 0 || p.back) continue
      const last = face[face.length - 1]
      if (!last || last.id !== p.id || last.from[0] !== p.from[0] || last.from[2] !== p.from[2]) face.push(p)
    }
    const standing = face.filter((p) => stands.has(Math.fround(p.id) * 1e6 + Math.fround(p.from[0])))
    expect(standing.length).toBeGreaterThan(face.length * 0.7)
    expect(standing.length).toBeLessThan(face.length)
    for (const kind of [face, standing]) {
      for (let i = 1; i < kind.length; i++) expect(kind[i]!.rate).not.toBe(kind[i - 1]!.rate)
    }
    const counts = FALL.turns.map((n) => standing.filter((p) => Math.round(p.rate * FALL.fold * period) === n).length)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    const mean = standing.reduce((sum, p) => sum + p.rate * FALL.fold * period, 0) / standing.length
    expect(Math.abs(mean - 4)).toBeLessThan(0.05)
  })

  // The length law (decision 210). What is lit of a line along its path, its soft ends left out and the film's shutter
  // left out, is at least twice the way the line goes in one frame at its thread's own rate, the quickest of the three
  // included. A shorter line is lit in one frame where the frame before and the frame after are dark, and that is a
  // flash. A line of the face is some travels long, any length between two bounds, and one at the back is a set time
  // long; only the lip and the heap, where its path ends, cut a line shorter.
  it('draws no line shorter than twice its travel in a frame', () => {
    const fps = 60
    const lit = 1 - 2 * FALL.ends
    expect(lit).toBeGreaterThan(0.5)
    expect(FALL.long[1]).toBeGreaterThan(FALL.long[0])
    expect(FALL.long[0] * lit).toBeGreaterThanOrEqual(2)
    let behind = 0
    for (const p of paths) {
      if (p.slide < 0 || !p.back) continue
      behind++
      expect(FALL.deepDash[0] * lit).toBeGreaterThanOrEqual((2 * p.life * p.rate * FALL.fold) / fps)
    }
    expect(behind).toBeGreaterThan(0)
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
    const rows = fileRows()
    const n = rows.data.length / GRAIN_ROW
    const kind = (q: number): number => rows.data[q * GRAIN_ROW + 11]!
    // The share a grain belongs to as the shader reads it, in single precision.
    const share = (q: number): number => {
      const v = Math.fround(Math.fround(rows.data[q * GRAIN_ROW + 12]! * Math.fround(FALL.pick[0]!)) + Math.fround(rows.data[q * GRAIN_ROW + 10]! * Math.fround(FALL.pick[1]!)))
      return v - Math.floor(v)
    }
    // A grain shows the sand that left the lip as long before as the sand takes to reach it, a thread's life and one
    // opening of the shutter at the most, and a thread thins out over `fade` of the share before it is empty.
    const longest = Math.max(...paths.filter((p) => p.slide >= 0).map((p) => p.life))
    const most = fallShare(FALL.gone - longest - FALL.shutter) + FALL.fade
    expect(most).toBeGreaterThanOrEqual(fallShare(FALL.gone))
    expect(most).toBeGreaterThanOrEqual(FALL.stand)
    let late = 0
    let falling = 0
    for (let q = 0; q < n; q++) {
      if (kind(q) !== 1) continue
      if (q >= rows.mark) {
        // A thread of the rest draw has all of its sand at rest.
        expect(share(q)).toBeLessThanOrEqual(FALL.stand)
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
