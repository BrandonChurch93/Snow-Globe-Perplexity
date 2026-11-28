import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import '../src/seasons/summer/arrival'
import { GUST } from '../src/core/materials'
import { DRESSING_CHANGE, SHUTTER_CHANGE, changeRamp, partChange } from '../src/shake/change'
import { LEAVE, SAND_GONE, sandCap, sandGust, sandGustAt, sandLeaving, sandLeft, sandSlumped } from '../src/seasons/summer/slab'

// Decision 294, W1: summer's mound slid off the table as one lump when the season changed (film 2107 to 2110). It breaks
// up where it lies instead: the peak comes down, the skin goes in patches, and the single grains are taken out by the
// gust that takes the petals and the leaves. Every part of it is a function of the one share of the span `surface-leave`.
describe("summer's mound as it leaves the table", () => {
  const d = DRESSING_CHANGE
  const runs = Array.from({ length: 97 }, (_, k) => k / 96)
  const shares = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
  const places = [52.4, 60, 75, 90, 110, 130, 150, 190]
  const PEAK = 10.2
  const LOW = 2

  it('reads nothing at rest, in a change that does not take the sand away, and before the span', () => {
    const still = { run: 0, flat: 0, stepPx: 0 }
    for (const c of [0, d.leaveFrom, (d.leaveFrom + d.leaveTo) / 2, d.leaveTo, 1]) {
      expect(sandLeaving(false, c, null, 5)).toEqual(still)
      expect(sandLeaving(false, c, { t: 0.4, of: 24, hold: c }, 5)).toEqual(still)
    }
    expect(sandLeaving(true, 0, null, 5)).toEqual(still)
    expect(sandLeaving(true, d.leaveFrom, null, 5)).toEqual(still)
    expect(sandCap(0)).toBe(Infinity)
    expect(sandCap(-1)).toBe(Infinity)
    for (const h of [0, 0.3, LOW, PEAK]) expect(sandSlumped(h, sandCap(0))).toBe(h)
    for (const mm of places) for (const lot of shares) for (const own of shares) expect(sandLeft(mm, lot, own, 0)).toBe(1)
    for (const mm of places) for (const a of shares) for (const b of shares) expect(sandGustAt(mm, a, b, 0)).toEqual([0, 0, 1])
  })

  it('takes the span in which the table is cleared, and has taken everything when it is over', () => {
    expect(sandLeaving(true, d.leaveTo, null, 5).run).toBe(1)
    expect(sandLeaving(true, 1, null, 5).run).toBe(1)
    for (const k of [1, 24, 48, 72, 95]) {
      const c = d.leaveFrom + ((d.leaveTo - d.leaveFrom) * k) / 96
      expect(sandLeaving(true, c, null, 5).run).toBeCloseTo(k / 96, 9)
    }
    expect(sandCap(1)).toBe(0)
    expect(sandSlumped(PEAK, sandCap(1))).toBe(0)
    for (const mm of places) for (const lot of shares) for (const own of shares) expect(sandLeft(mm, lot, own, 1)).toBe(0)
    for (const mm of places) for (const a of shares) for (const b of shares) expect(sandGustAt(mm, a, b, 1)[2]).toBe(0)
  })

  it('never moves the heap or the grains as one piece', () => {
    // What is told to the shaders is a share, a height and a step: no way along the table. The heap and the grains keep
    // the place they are made at, so no frame can hold the peaked outline away from it.
    expect(Object.keys(sandLeaving(true, (d.leaveFrom + d.leaveTo) / 2, null, 5)).sort()).toEqual(['flat', 'run', 'stepPx'])
    const text = readFileSync('src/seasons/summer/slab.ts', 'utf8')
    const update = text.slice(text.indexOf('export function update(moment: KitMoment)'))
    expect(update).toContain('heap.position.set(0, SLAB.liftMm * (1 - grown), 0)')
    expect(update).toContain('grains.position.set(0, 0, 0)')
    // The skin's grain may be read ahead of its place (W1b: the last place of `uSlabOut`, a reach and no way along the
    // table). The places that would move the heap are never written.
    for (const no of ['slabOut.value.x', 'slabOut.value.y', 'slabOut.value.z', 'slabOut.value.set(']) expect(update).not.toContain(no)
    expect(text).not.toContain('slabOut.value.set(')
  })

  it('brings the peak down first and the low sand last, with no step, and leaves nothing standing', () => {
    let peak = PEAK
    let low = LOW
    let halved = false
    for (const run of runs) {
      const cap = sandCap(run)
      const p = sandSlumped(PEAK, cap)
      const l = sandSlumped(LOW, cap)
      expect(p, `peak at ${run}`).toBeLessThanOrEqual(peak)
      expect(l, `low sand at ${run}`).toBeLessThanOrEqual(low)
      expect(peak - p, `the peak's step at ${run}`).toBeLessThan(0.6)
      expect(p).toBeGreaterThanOrEqual(l)
      // The peak has always lost the greater share of its height.
      expect(p / PEAK).toBeLessThanOrEqual(l / LOW + 1e-12)
      if (p < PEAK / 2 && l > 0.8 * LOW) halved = true
      if (run >= LEAVE.slumpBy) expect(p).toBe(0)
      peak = p
      low = l
    }
    expect(halved, 'an instant with the peak under half its height and the low sand over four fifths of its own').toBe(true)
    // In the film the span is six frames: on each of them the peak is plainly lower than on the one before.
    const onFrame = [1, 2, 3, 4].map((n) => sandSlumped(PEAK, sandCap((n + 0.28) / 6)))
    expect(onFrame[0]!).toBeGreaterThan(8)
    for (let i = 1; i < onFrame.length; i++) expect(onFrame[i - 1]! - onFrame[i]!).toBeGreaterThan(1)
    expect(onFrame[3]!).toBeLessThan(1.5)
  })

  it('thins the skin in patches, those by the foot first', () => {
    for (const lot of shares) {
      for (const own of shares) {
        for (const mm of places) {
          let left = 1
          for (const run of runs) {
            const v = sandLeft(mm, lot, own, run)
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThanOrEqual(left)
            left = v
          }
        }
        for (const run of runs) for (let i = 1; i < places.length; i++) expect(sandLeft(places[i - 1]!, lot, own, run), `near and far at ${run}`).toBeLessThanOrEqual(sandLeft(places[i]!, lot, own, run) + 1e-12)
      }
    }
    // Patches: at one instant and one distance, some of the skin is whole and some of it has gone.
    expect(sandLeft(70, 0, 0.5, 0.35)).toBeLessThan(0.35)
    expect(sandLeft(70, 1, 0.5, 0.35)).toBeGreaterThan(0.9)
    // By the foot the first patches thin from the first instant of the span on.
    expect(sandLeft(52.4, 0, 0, 1 / 96)).toBeLessThan(1)
  })

  it('takes each grain out with the gust of the petals and the leaves: slowly, then fast, the near ones first', () => {
    for (const a of shares) {
      for (const b of shares) {
        for (const mm of places) {
          let out = 0
          let first = true
          for (const run of runs) {
            const [far, high, kept] = sandGustAt(mm, a, b, run)
            expect(far).toBeGreaterThanOrEqual(out)
            expect(high).toBeGreaterThanOrEqual(0)
            expect(high).toBeLessThanOrEqual(GUST.heightMm + 1e-9)
            expect(kept).toBeGreaterThanOrEqual(0)
            expect(kept).toBeLessThanOrEqual(1)
            // It leaves its place slowly: under a millimetre and a half in its first ninety-sixth of the span.
            if (far > 0 && first) {
              expect(far).toBeLessThan(1.5)
              first = false
            }
            out = far
          }
          // Its whole way is the gust's reach, by its own number, and by then it is no longer drawn.
          expect(out).toBeCloseTo(GUST.reachOutMm * (0.5 + a), 9)
        }
        for (const run of runs) for (let i = 1; i < places.length; i++) expect(sandGustAt(places[i - 1]!, a, b, run)[0] + 1e-9).toBeGreaterThanOrEqual(sandGustAt(places[i]!, a, b, run)[0])
      }
    }
    // No two grains go as one: at an instant the grains of one place are spread along the way.
    const ways = shares.flatMap((a) => shares.map((b) => sandGustAt(70, a, b, 0.6)[0]))
    expect(Math.max(...ways) - Math.min(...ways)).toBeGreaterThan(40)
  })

  it('does not draw a grain as beads that stand apart, where the samples of a frame are joined', () => {
    const px = 12.5
    const joined = sandLeaving(true, (d.leaveFrom + d.leaveTo) / 2, { t: 0.5, of: 24, hold: (d.leaveFrom + d.leaveTo) / 2 - SHUTTER_CHANGE / 2 }, px)
    expect(joined.stepPx).toBeCloseTo((SHUTTER_CHANGE / 24 / changeRamp('surface-leave').length) * px, 12)
    expect(joined.run).toBeCloseTo(partChange('surface-leave', (d.leaveFrom + d.leaveTo) / 2), 9)
    // Two samples a frame are too far apart to be joined: each holds every grain whole.
    expect(sandLeaving(true, (d.leaveFrom + d.leaveTo) / 2, { t: 0.5, of: 2, hold: d.leaveFrom }, px).stepPx).toBe(0)
    const pace = (mm: number, a: number, b: number, run: number): number => (sandGustAt(mm, a, b, run + 1e-6)[0] - sandGustAt(mm, a, b, run - 1e-6)[0]) / 2e-6
    for (const run of [0.2, 0.4, 0.6, 0.8]) {
      for (const a of shares) {
        const step = pace(70, a, 0.3, run) * joined.stepPx
        const kept = sandGustAt(70, a, 0.3, run, joined.stepPx)[2]
        if (step >= LEAVE.loosePx[1]) expect(kept).toBe(0)
        if (step <= LEAVE.loosePx[0]) expect(kept).toBeCloseTo(sandGustAt(70, a, 0.3, run)[2], 9)
      }
    }
  })

  it('is one law in the heap, in its shadow and in the grains', () => {
    for (const n of [GUST.reachOutMm, GUST.heightMm, LEAVE.late, LEAVE.soft, LEAVE.grain.late, LEAVE.grain.thin, LEAVE.near[0], LEAVE.near[1]]) expect(SAND_GONE).toContain(n.toFixed(3))
    for (const name of ['uniform vec4 uSandGust;', 'float sandGo(', 'float sandSlump(', 'vec3 sandGust(']) expect(SAND_GONE).toContain(name)
    const slab = readFileSync('src/seasons/summer/slab.ts', 'utf8')
    const grains = readFileSync('src/seasons/summer/arrival.ts', 'utf8')
    expect(slab).toContain('sand.customDepthMaterial = slabShadow()')
    expect(slab).toContain('if (uSandGust.x > 0.0) slabTall = sandSlump(slabTall);')
    expect(slab).toContain('if (uSandGust.x > 0.0) vSlab.x *= sandGo(position.xz, 0.5);')
    expect(grains).toContain('${SAND_GONE}')
    expect(grains).toContain('uSandGust: sandGust,')
    expect(grains).toContain('if (uSandGust.x > 0.0 && falls < 0.5) {')
  })

  it('leaves a table at rest as it was: what the drawing is told is nothing, in all four places', () => {
    // A vector of four made with no numbers has a 1 in its last place. The heap's skin reads its grain as far ahead as the
    // last place of `uSlabOut` says, so that 1 softened the sand of every still picture.
    expect(sandGust.value.toArray()).toEqual([0, 0, 0, 0])
    const slab = readFileSync('src/seasons/summer/slab.ts', 'utf8')
    expect(slab).toContain('const slabOut = { value: new THREE.Vector4(0, 0, 0, 0) }')
    expect(slab).not.toContain('new THREE.Vector4()')
    expect(slab).not.toContain('slabOut.value.set(')
  })
})
