import { describe, expect, it } from 'vitest'
import { config, particleKinds } from '../src/config'
import { sampleSdf } from '../src/core/sdf'
import type { ParticleSource } from '../src/core/stage'
import { barSeconds, beatSeconds, stillTimeline, type Timeline } from '../src/film/timeline'
import { LIQUID_LENGTH, LIQUID_TURBULENCE, LIQUID_TURN } from '../src/globe/liquid'
import { makeShake } from '../src/shake/table'
import { packSnapshot, ParticleEngine, STATE_HIDDEN, STATE_LIQUID, STATE_REST, STATE_SNAG, unpackSnapshot, WALL } from '../src/particles/engine/engine'
import { countsIn, KINDS, POOL, SEASONS } from '../src/particles/engine/kinds'
import { blockoutSdf, buildSdf, GROUND_Y, INNER_R, sdfSample } from '../src/particles/engine/sdf'

const HZ = config.sim.stepHz
const steps = (seconds: number): number => Math.round(seconds * HZ)
const grid = blockoutSdf()

function swapTimeline(from: string, to: string): Timeline {
  return { id: `test:${from}:${to}`, startSeason: from, events: [{ id: 'shake-1', startSec: 0, from, to, path: makeShake('shake-1') }] }
}

const idle = (season: string): Timeline => ({ id: `idle:${season}`, startSeason: season, events: [] })

function same(a: ParticleEngine, b: ParticleEngine): void {
  expect(b.step).toBe(a.step)
  expect(b.seasonNow).toBe(a.seasonNow)
  for (const key of ['pos', 'prev', 'vel', 'phase', 'opacity', 'sizes', 'kindOf', 'state', 'liquid'] as const) {
    const x = a[key]
    const y = b[key]
    let differ = -1
    for (let i = 0; i < x.length; i++) {
      if (!Object.is(x[i], y[i])) {
        differ = i
        break
      }
    }
    expect(differ, `${key} differs at ${differ}`).toBe(-1)
  }
}

function census(e: ParticleEngine): { liquid: number; rest: number; hidden: number; outside: number; inside: number; far: number } {
  let liquid = 0
  let rest = 0
  let hidden = 0
  let outside = 0
  let inside = 0
  let far = 0
  for (let i = 0; i < e.count; i++) {
    const x = e.pos[i * 3]!
    const y = e.pos[i * 3 + 1]!
    const z = e.pos[i * 3 + 2]!
    const r = Math.hypot(x, y, z)
    if (r > far) far = r
    if (r > INNER_R + 0.05) outside++
    else if (sampleSdf(grid, x, y, z) < -0.05) inside++
    const s = e.state[i]!
    if (s === STATE_HIDDEN) hidden++
    else if (s === STATE_LIQUID) liquid++
    else rest++
  }
  return { liquid, rest, hidden, outside, inside, far }
}

describe('the pool and its kinds', () => {
  it('is sized to the largest season, with every count from the config', () => {
    const totals = SEASONS.map((s) => particleKinds(s).reduce((n, k) => n + k.count, 0))
    expect(POOL).toBe(Math.max(...totals))
    for (const season of SEASONS) {
      const counts = countsIn(season)
      for (const k of particleKinds(season)) expect(counts[k.kind]).toBe(k.count)
    }
  })

  it('keeps each kind in proportion in any first share of the pool', () => {
    for (const season of SEASONS) {
      for (const share of [0.3, 0.6]) {
        const upTo = Math.round(POOL * share)
        const counts = countsIn(season, upTo)
        for (const k of particleKinds(season)) expect(Math.abs(counts[k.kind]! - k.count * share)).toBeLessThanOrEqual(Math.max(3, k.count * share * 0.02))
      }
    }
  })

  it('gives the drawing what the particle source contract asks', () => {
    const e = new ParticleEngine({ season: 'fall', fraction: 0.02 })
    const source: ParticleSource = e
    e.reset()
    expect(source.count).toBe(Math.round(POOL * 0.02))
    expect(source.pos.length).toBe(source.count * 3)
    expect(source.prev.length).toBe(source.count * 3)
    expect(source.liquid.length).toBe(LIQUID_LENGTH)
    const seen = new Set<string>()
    let shown = 0
    for (let i = 0; i < source.count; i++) {
      const name = source.kinds[source.kindOf[i]!]!
      expect(KINDS).toContain(name)
      if (e.state[i] === STATE_HIDDEN) {
        expect(source.sizes[i]).toBe(0)
        expect(e.opacity[i]).toBe(0)
        continue
      }
      shown++
      seen.add(name)
      expect(source.sizes[i]).toBeGreaterThan(0)
    }
    expect([...seen].sort()).toEqual(particleKinds('fall').map((k) => k.kind).filter((k) => countsIn('fall', e.count)[k]! > 0).sort())
    expect(shown).toBe(Object.values(countsIn('fall', e.count)).reduce((a, b) => a + b, 0))
  })
})

describe('the simulation', () => {
  it('reaches the same state at step N one step at a time, in groups, and through a checkpoint', () => {
    const tl = swapTimeline('winter', 'spring')
    const last = steps(barSeconds + 1.1)
    const options = { season: 'winter', fraction: 0.03 }
    const single = new ParticleEngine(options)
    for (let n = 1; n <= last; n++) single.advanceTo(n, tl)

    const grouped = new ParticleEngine(options)
    const sizes = [1, 7, 64, 3, 240, 19]
    for (let n = 0, g = 0; n < last; g++) {
      n = Math.min(last, n + sizes[g % sizes.length]!)
      grouped.advanceTo(n, tl)
    }
    same(single, grouped)

    const first = new ParticleEngine(options)
    first.advanceTo(steps(1.37), tl)
    const packed = packSnapshot(first.snapshot())
    const second = new ParticleEngine(options)
    second.restore(unpackSnapshot(packed))
    expect(second.step).toBe(steps(1.37))
    second.advanceTo(last, tl)
    same(single, second)

    const again = new ParticleEngine(options)
    again.advanceTo(last, tl)
    const kept = again.snapshot()
    again.advanceTo(last + 300, tl)
    again.restore(kept)
    same(single, again)
  }, 120000)

  it('starts each season the same way every time, with what rests already lying', () => {
    for (const season of SEASONS) {
      const a = new ParticleEngine({ season, fraction: 0.03 })
      const b = new ParticleEngine({ season: 'winter', fraction: 0.03 })
      a.reset()
      b.reset(season)
      expect(b.seasonNow).toBe(season)
      for (let i = 0; i < a.pos.length; i++) expect(b.pos[i]).toBe(a.pos[i])
      const c = census(a)
      expect(c.outside).toBe(0)
      expect(c.inside).toBe(0)
      expect(c.hidden).toBe(a.count - Object.values(countsIn(season, a.count)).reduce((x, y) => x + y, 0))
    }
    const winter = new ParticleEngine({ season: 'winter', fraction: 0.03 })
    winter.reset()
    expect(census(winter).rest).toBe(winter.count)
  })

  for (const season of SEASONS) {
    it(`keeps every ${season} particle in the sphere and out of solids through a shake and a settle`, () => {
      const e = new ParticleEngine({ season, fraction: 0.05 })
      const tl = stillTimeline(season)
      const end = steps(barSeconds + config.states.restSeconds)
      let most = 0
      let worst = 0
      for (let n = steps(0.25); n <= end; n += steps(0.25)) {
        e.advanceTo(n, tl)
        const c = census(e)
        expect(c.outside).toBe(0)
        expect(c.far).toBeLessThanOrEqual(WALL + 1e-3)
        most = Math.max(most, c.liquid)
        worst = Math.max(worst, c.inside / e.count)
      }
      const c = census(e)
      expect(worst).toBeLessThanOrEqual(config.sim.maxInsideFraction)
      expect(c.inside / e.count).toBeLessThanOrEqual(config.sim.maxInsideFraction)
      expect(most).toBeGreaterThan((e.count - c.hidden) * 0.9)
      for (let i = 0; i < e.pos.length; i++) expect(Number.isFinite(e.pos[i])).toBe(true)
    }, 120000)
  }

  it('throws what rests back into the liquid and lets it settle again, not stacked in a grid', () => {
    const e = new ParticleEngine({ season: 'winter', fraction: 0.08 })
    const tl = stillTimeline('winter')
    e.reset()
    const before = e.pos.slice()
    e.advanceTo(steps(barSeconds * 0.7), tl)
    expect(e.floating()).toBeGreaterThan(e.count * 0.97)
    e.advanceTo(steps(barSeconds + config.states.restSeconds), tl)
    const settled = census(e)
    expect(settled.rest).toBeGreaterThan(e.count * 0.9)
    expect(settled.liquid).toBeGreaterThan(0)

    const cell = grid.sizeMm / (grid.n - 1)
    const bins = new Float64Array(8)
    const spots = new Set<string>()
    const g = new Float64Array(3)
    let resting = 0
    let moved = 0
    let steep = 0
    let height = 0
    let height2 = 0
    for (let i = 0; i < e.count; i++) {
      if (e.state[i] !== STATE_REST) continue
      const x = e.pos[i * 3]!
      const y = e.pos[i * 3 + 1]!
      const z = e.pos[i * 3 + 2]!
      resting++
      spots.add(`${x.toFixed(2)} ${z.toFixed(2)}`)
      const fx = (x + grid.sizeMm / 2) / cell
      const fz = (z + grid.sizeMm / 2) / cell
      bins[Math.floor((fx - Math.floor(fx)) * 4)] += 1
      bins[4 + Math.floor((fz - Math.floor(fz)) * 4)] += 1
      const d = sdfSample(grid, x, y, z, g)
      expect(d).toBeGreaterThan(0)
      expect(d).toBeLessThan(2)
      if (g[1]! / Math.hypot(g[0]!, g[1]!, g[2]!) < 0.45) steep++
      height += d
      height2 += d * d
      if (Math.hypot(x - before[i * 3]!, z - before[i * 3 + 2]!) > 2) moved++
    }
    expect(steep).toBeLessThan(resting * 0.01)
    expect(spots.size).toBeGreaterThan(resting * 0.98)
    for (const b of bins) expect(b / resting).toBeGreaterThan(0.17)
    for (const b of bins) expect(b / resting).toBeLessThan(0.33)
    const mean = height / resting
    expect(Math.sqrt(height2 / resting - mean * mean)).toBeGreaterThan(0.1)
    expect(moved).toBeGreaterThan(resting * 0.9)
  }, 120000)

  it('changes season inside the shake, kind for kind by index, with nothing popping', () => {
    const tl = swapTimeline('winter', 'spring')
    const e = new ParticleEngine({ season: 'winter', fraction: 0.05 })
    const w = config.shake.swapWindow
    const from = steps(w.fromBeat * beatSeconds)
    const to = steps(w.toBeat * beatSeconds)
    e.advanceTo(from - 2, tl)
    expect(e.seasonNow).toBe('winter')
    const tally = (): Record<string, number> => {
      const out: Record<string, number> = {}
      for (let i = 0; i < e.count; i++) if (e.state[i] !== STATE_HIDDEN) out[KINDS[e.kindOf[i]!]!] = (out[KINDS[e.kindOf[i]!]!] ?? 0) + 1
      return out
    }
    expect(tally()).toEqual(countsIn('winter', e.count))
    const kind = e.kindOf.slice()
    const shown = e.state.map((s) => (s === STATE_HIDDEN ? 0 : 1))
    const opacity = e.opacity.slice()
    let turned = 0
    let mixed = 0
    let jump = 0
    for (let n = from - 1; n <= to + 2; n++) {
      e.advanceTo(n, tl)
      let old = 0
      let fresh = 0
      for (let i = 0; i < e.count; i++) {
        const now = e.state[i] === STATE_HIDDEN ? 0 : 1
        if (e.kindOf[i] !== kind[i] || now !== shown[i]) {
          expect(opacity[i]).toBeLessThan(0.02)
          expect(e.opacity[i]).toBeLessThan(0.02)
          turned++
          kind[i] = e.kindOf[i]!
          shown[i] = now
        }
        jump = Math.max(jump, Math.abs(e.opacity[i]! - opacity[i]!))
        opacity[i] = e.opacity[i]!
        if (now === 1 && e.opacity[i]! > 0.5) {
          if (KINDS[e.kindOf[i]!] === 'flake' || KINDS[e.kindOf[i]!] === 'glitter') old++
          else fresh++
        }
      }
      if (old > e.count * 0.1 && fresh > e.count * 0.04) mixed++
    }
    expect(jump).toBeLessThan(0.08)
    expect(mixed).toBeGreaterThan((to - from) * 0.15)
    expect(turned).toBeGreaterThan(e.count * 0.9)
    expect(e.seasonNow).toBe('spring')
    expect(tally()).toEqual(countsIn('spring', e.count))
    for (let i = 0; i < e.count; i++) if (e.state[i] !== STATE_HIDDEN) expect(e.opacity[i]).toBeGreaterThan(0.98)
    expect(census(e).outside).toBe(0)
  }, 120000)

  it('stays at rest until it is stirred, and a stir lifts what was lying', () => {
    const e = new ParticleEngine({ season: 'winter', fraction: 0.05 })
    const tl = idle('winter')
    e.advanceTo(steps(1), tl)
    for (let j = 0; j <= LIQUID_TURBULENCE; j++) expect(e.liquid[j]).toBe(0)
    const calm = e.floating()
    expect(calm).toBeLessThan(e.count * 0.05)
    e.stir(0, 9, 0)
    e.advanceTo(steps(1) + 1, tl)
    expect(e.liquid[LIQUID_TURN + 1]).toBeGreaterThan(1)
    e.advanceTo(steps(1.6), tl)
    expect(e.floating()).toBeGreaterThan(calm + e.count * 0.2)
    expect(census(e).outside).toBe(0)
    const turn = e.liquid[LIQUID_TURN + 1]!
    e.advanceTo(steps(4), tl)
    expect(e.liquid[LIQUID_TURN + 1]).toBeLessThan(turn * 0.5)
  }, 120000)

  it('lets some of what rests go round again, and snags seeds where they touch', () => {
    const winter = new ParticleEngine({ season: 'winter', fraction: 0.05 })
    winter.advanceTo(steps(14), idle('winter'))
    const falling = winter.floating()
    expect(falling).toBeGreaterThan(winter.count * 0.004)
    expect(falling).toBeLessThan(winter.count * 0.08)

    const summer = new ParticleEngine({ season: 'summer', fraction: 0.05 })
    summer.advanceTo(steps(barSeconds + 4), stillTimeline('summer'))
    let snagged = 0
    let seeds = 0
    for (let i = 0; i < summer.count; i++) {
      if (KINDS[summer.kindOf[i]!] !== 'seed' || summer.state[i] === STATE_HIDDEN) continue
      seeds++
      if (summer.state[i] === STATE_SNAG) snagged++
    }
    expect(snagged).toBeGreaterThan(seeds * 0.1)
    expect(snagged).toBeLessThan(seeds)
  }, 120000)
})

describe('the distance grid helper', () => {
  it('builds n cubed values, positive outside the shapes and negative inside them', () => {
    const g = buildSdf(
      [
        { kind: 'ground', y: GROUND_Y },
        { kind: 'box', cx: -10, cy: 0, cz: 0, hx: 5, hy: 6, hz: 7 },
        { kind: 'ball', cx: 20, cy: 10, cz: 5, r: 8 },
        { kind: 'cone', cx: 0, baseY: GROUND_Y, cz: -25, r: 10, h: 30 },
      ],
      48,
    )
    expect(g.data.length).toBe(48 * 48 * 48)
    expect(g.sizeMm).toBe(config.globe.sphereDiameterMm)
    expect(sampleSdf(g, -10, 0, 0)).toBeLessThan(-3)
    expect(sampleSdf(g, 20, 10, 5)).toBeLessThan(-5)
    expect(sampleSdf(g, 0, GROUND_Y + 8, -25)).toBeLessThan(-1)
    expect(sampleSdf(g, 0, GROUND_Y - 6, 0)).toBeLessThan(-4)
    expect(sampleSdf(g, 0, 30, 0)).toBeGreaterThan(10)
    expect(sampleSdf(g, 20, 10, 5 + 12)).toBeCloseTo(4, 0)
    expect(sampleSdf(g, -10 + 9, 0, 0)).toBeCloseTo(4, 0)
    expect(sampleSdf(g, 30, GROUND_Y + 5, -30)).toBeCloseTo(5, 0)
  })
})
