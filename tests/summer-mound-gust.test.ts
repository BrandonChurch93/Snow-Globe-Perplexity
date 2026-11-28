import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import '../src/seasons/summer/arrival'
import { LEAVE, SAND_GONE, sandFlown, sandGustAt, sandPuff, sandStream, sandTurn } from '../src/seasons/summer/slab'

// Decision 305, W1b: at the masters' size the sand that left the heap was a crest of long thin lines, all one way and
// paler than the heap, over a heap that stood sharp and came down as a comb of upright strokes. Sand in the air is a
// soft body: each grain a soft disc on its own heading, in the paint and the light of the place it lay in, and the
// skin's grain is read ahead of its place, so that a grain of the thinned skin is a trail and not a still dot.
describe("summer's mound in the gust, at the masters' size", () => {
  const shares = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
  const numbers = Array.from({ length: 41 }, (_, k) => k / 40)

  it('gives each grain its own heading about the line out, so that their ways cross', () => {
    const turns = numbers.flatMap((a) => numbers.map((b) => sandTurn(a, b)))
    for (const t of turns) expect(Math.abs(t)).toBeLessThanOrEqual(LEAVE.grain.fan + 1e-12)
    // A fan a viewer can see, and not so wide that sand goes back under the glass.
    expect(LEAVE.grain.fan).toBeGreaterThanOrEqual(0.35)
    expect(LEAVE.grain.fan).toBeLessThanOrEqual(0.8)
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThan(1.8 * LEAVE.grain.fan)
    // The headings fill the fan: every tenth of it holds grains, and no tenth holds a third of them.
    const tenths = Array.from({ length: 10 }, () => 0)
    for (const t of turns) tenths[Math.min(9, Math.floor(((t / LEAVE.grain.fan + 1) / 2) * 10))]! += 1
    for (const n of tenths) {
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThan(turns.length / 3)
    }
    // Two grains that lie side by side part by more than a grain's width inside a tenth of the way out.
    expect(Math.abs(sandTurn(0.2, 0.3) - sandTurn(0.21, 0.3))).toBeGreaterThan(0.05)
  })

  it('draws a grain in the air as a soft disc from the first instant of its flight, and wider as it goes', () => {
    for (const a of shares) {
      expect(sandPuff(0, a)).toBe(0)
      expect(sandPuff(-1, a)).toBe(0)
      let wide = 0
      for (const q of numbers.slice(1)) {
        const w = sandPuff(q, a)
        expect(w).toBeGreaterThanOrEqual(wide)
        expect(w).toBeGreaterThanOrEqual(LEAVE.grain.puffMm[0] * LEAVE.grain.puffAt - 1e-12)
        expect(w).toBeLessThanOrEqual(LEAVE.grain.puffMm[1] + 1e-12)
        wide = w
      }
      expect(sandPuff(1, a)).toBeGreaterThanOrEqual(LEAVE.grain.puffMm[0] - 1e-12)
    }
    // No bead where a grain starts: at its first instant it is already over half a millimetre of radius, some six pixels
    // of a picture 3840 wide, where the grain itself is one or two.
    expect(LEAVE.grain.puffMm[0] * LEAVE.grain.puffAt).toBeGreaterThanOrEqual(0.6)
    // And no two the same: the discs differ by a factor of two.
    expect(LEAVE.grain.puffMm[1] / LEAVE.grain.puffMm[0]).toBeGreaterThanOrEqual(2)
  })

  it('reads the flight of a grain from the law that moves it', () => {
    for (const mm of [52.4, 60, 90, 150]) {
      for (const b of shares) {
        let q = 0
        for (const run of numbers) {
          const v = sandFlown(mm, b, run)
          expect(v).toBeGreaterThanOrEqual(q)
          // A grain that has not left its place is no disc, and one that has is.
          const moved = sandGustAt(mm, 0.5, b, run)[0] > 0
          expect(v > 0).toBe(moved)
          q = v
        }
        expect(sandFlown(mm, b, 0)).toBe(0)
        expect(sandFlown(mm, b, 1)).toBe(1)
      }
    }
  })

  it('reads the skin ahead of its place, more as the leaving goes on, and not at all at rest', () => {
    expect(sandStream(0)).toBe(0)
    expect(sandStream(-1)).toBe(0)
    let ahead = 0
    for (const run of numbers.slice(1)) {
      const v = sandStream(run)
      expect(v).toBeGreaterThan(0)
      expect(v).toBeGreaterThanOrEqual(ahead)
      expect(v).toBeLessThanOrEqual(LEAVE.streamMm + 1e-12)
      ahead = v
    }
    expect(sandStream(LEAVE.streamBy)).toBeCloseTo(LEAVE.streamMm, 12)
    // Long enough to make a trail of a grain, a few millimetres, and far under the heap's own width.
    expect(LEAVE.streamMm).toBeGreaterThanOrEqual(3)
    expect(LEAVE.streamMm).toBeLessThanOrEqual(12)
    const slab = readFileSync('src/seasons/summer/slab.ts', 'utf8')
    const update = slab.slice(slab.indexOf('export function update(moment: KitMoment)'))
    expect(update).toContain('slabOut.value.w = sandStream(go.run)')
    // A way along the table is never written: nothing of the heap is moved.
    for (const no of ['slabOut.value.x', 'slabOut.value.y', 'slabOut.value.z', 'slabOut.value.set(']) expect(slab).not.toContain(no)
  })

  it('is the colour of the heap, in wisps, and leaves no speck standing on the heap', () => {
    const G = LEAVE.grain
    // Painted down and warmer, as the skin's grit is: red most, blue least, none made lighter.
    expect(G.paint[0]).toBeLessThanOrEqual(1)
    expect(G.paint[0]).toBeGreaterThan(G.paint[1])
    expect(G.paint[1]).toBeGreaterThan(G.paint[2])
    expect(G.paint[2] / G.paint[0]).toBeGreaterThan(0.4)
    expect(G.paint[2] / G.paint[0]).toBeLessThan(0.8)
    // A body with wisps: a patch hides at least twice what another does, none nothing, and all of it less than its sand would.
    expect(G.wisp[0]).toBeGreaterThan(0)
    expect(G.wisp[1] / G.wisp[0]).toBeGreaterThanOrEqual(2)
    expect(G.wisp[1]).toBeLessThanOrEqual(1)
    expect(G.dense).toBeGreaterThanOrEqual(0.2)
    expect(G.dense).toBeLessThanOrEqual(1)
    // The specks on the heap are gone before the first grain of the far side has left, and not at once.
    expect(G.dim).toBeGreaterThan(0.05)
    expect(G.dim).toBeLessThanOrEqual(0.2)
    expect(G.onHeapMm).toBeGreaterThan(0)
    const grains = readFileSync('src/seasons/summer/arrival.ts', 'utf8')
    expect(SAND_GONE).toContain('float sandWisp(vec2 p)')
    expect(SAND_GONE).toContain(`return ${G.dense.toFixed(3)} * mix(${G.wisp[0].toFixed(3)}, ${G.wisp[1].toFixed(3)}, smoothstep(0.3, 0.7, lot));`)
    expect(grains).toContain('gustHides = sandWisp(nowAt.xz);')
    expect(grains).toContain('if (gustPuff > 0.0) thinner *= gustHides;')
    expect(grains).toContain('if (uSandGust.x > 0.0 && vGrainLine.w > 0.5) col *= vec3(${LEAVE.grain.paint.map((x) => x.toFixed(3)).join(')
    expect(grains).toContain('if (lies > 0.5 && gustTall > ${LEAVE.grain.onHeapMm.toFixed(2)} && flight.x <= 0.0) grown *= 1.0 - smoothstep(0.0, ${LEAVE.grain.dim.toFixed(2)}, uSandGust.x);')
  })

  it('is one law in the shader and here', () => {
    for (const n of [LEAVE.grain.fan, LEAVE.grain.puffMm[0], LEAVE.grain.puffMm[1], LEAVE.grain.puffAt]) expect(SAND_GONE).toContain(n.toFixed(3))
    expect(SAND_GONE).toContain('vec3 sandFlight(vec2 p, float a, float b)')
    const grains = readFileSync('src/seasons/summer/arrival.ts', 'utf8')
    // The grain's own heading, its soft disc and what the disc hides.
    expect(grains).toContain('vec3 flight = sandFlight(nowAt.xz, gustA, gustB);')
    expect(grains).toContain('gustWay = mat2(cos(flight.y), sin(flight.y), -sin(flight.y), cos(flight.y)) * gustWay;')
    expect(grains).toContain('if (gustPuff > 0.0) soft = sqrt(soft * soft + gustPuff * gustPuff) * alive;')
    expect(grains).toContain('thinner *= size * size / max(lensWide, 1e-10);')
    // A grain that still lies comes down with the heap.
    expect(grains).toContain('if (lies > 0.5 && gustTall > 0.0) nowAt.y = ')
    // The sand in the air is the sand that lay there: its shade and its paint are read where it lay.
    expect(grains).toContain('vec3 grainLay = gustPuff > 0.0 ? (modelMatrix * vec4(gustLay, 1.0)).xyz : grainW.xyz;')
    expect(grains).toContain('sandBaseShade(grainLay - vec3(uSandFoot.x, 0.0, uSandFoot.y), uGrainKey)')
    expect(grains).toContain('vec3 lay = uSandGust.x > 0.0 && vGrainLine.w > 0.5 ? vGrainLine.xyz : vStageWorld;')
    expect(grains).toContain('sandCrest(lay.y)')
    expect(grains).not.toContain('sandCrest(vStageWorld.y)')
  })
})
