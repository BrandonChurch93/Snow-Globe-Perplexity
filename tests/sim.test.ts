import { describe, expect, it } from 'vitest'
import { config, particleKinds } from '../src/config'
import { sampleSdf } from '../src/core/sdf'
import type { ParticleSource } from '../src/core/stage'
import { barSeconds, beatSeconds, stillTimeline, type Timeline } from '../src/film/timeline'
import { LIQUID_LENGTH, LIQUID_TURBULENCE, LIQUID_TURN } from '../src/globe/liquid'
import { makeShake, REST_POSE, type GlobePose, type ShakePath } from '../src/shake/table'
import { COVER_N, packSnapshot, ParticleEngine, STATE_HIDDEN, STATE_LIQUID, STATE_REST, STATE_SNAG, unpackSnapshot, WALL } from '../src/particles/engine/engine'
import { countsIn, KINDS, POOL, SEASONS } from '../src/particles/engine/kinds'
import { blockoutSdf, buildSdf, GROUND_Y, INNER_R, sdfSample } from '../src/particles/engine/sdf'
import { EngineClient, type EnginePort } from '../src/particles/engine/client'
import { builtTimeline, EngineHost, frameBytes, plainTimeline } from '../src/particles/engine/host'
import { LiveEngine } from '../src/particles/engine/live'
import { LiveRunner, type EngineWorker } from '../src/particles/engine/remote'
import { SimDriver, type SimStore } from '../src/particles/driver'

const HZ = config.sim.stepHz
const steps = (seconds: number): number => Math.round(seconds * HZ)
const grid = blockoutSdf()

function swapTimeline(from: string, to: string): Timeline {
  return { id: `test:${from}:${to}`, startSeason: from, events: [{ id: 'shake-1', startSec: 0, from, to, path: makeShake('shake-1') }] }
}

const idle = (season: string): Timeline => ({ id: `idle:${season}`, startSeason: season, events: [] })

const TURN_PEAK_FLOOR = 2
const TURN_AFTER_FLOOR = 0.75

function rockingTimeline(season: string, degrees: number): Timeline {
  const s = config.shake
  const bar = config.film.beatsPerBar
  const liftEnd = s.liftBeats
  const strokesEnd = s.liftBeats + s.strokeBeats
  const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
  const n = Math.round(s.strokes)
  const lateral = (beat: number): number => {
    if (beat <= liftEnd || beat >= strokesEnd) return 0
    const u = (beat - liftEnd) / (strokesEnd - liftEnd)
    const f = u * (0.6 + 0.4 * u) * n
    const i = Math.min(n - 1, Math.floor(f))
    return (i % 2 === 0 ? 1 : -1) * s.strokeMm * Math.sin(Math.PI * (f - i)) * smooth(u / 0.08) * smooth((1 - u) / 0.1)
  }
  const path: ShakePath = {
    standIn: true,
    parts: { liftEnd, strokesEnd, landing: bar },
    poseAt(beat: number): GlobePose {
      if (beat <= 0 || beat >= bar) return REST_POSE
      const lift = beat < liftEnd ? smooth(beat / liftEnd) : beat < strokesEnd ? 1 : 1 - ((beat - strokesEnd) / s.setDownBeats) ** 2
      const rate = (lateral(beat + 0.02) - lateral(beat - 0.02)) / 0.04
      const tilt = (Math.max(-1, Math.min(1, rate / (s.strokeMm * 6))) * degrees * Math.PI) / 180
      const x = lateral(beat)
      return { x, y: s.liftMm * lift, z: x * 0.3, tiltX: tilt * 0.18, tiltZ: -tilt }
    },
  }
  return { id: `rock:${season}`, startSeason: season, events: [{ id: `rock:${season}`, startSec: 0, from: season, to: season, path }] }
}

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

  it('starts the whole pool inside the glass in every season', () => {
    for (const season of SEASONS) {
      const e = new ParticleEngine({ season })
      e.reset()
      expect(e.count).toBe(POOL)
      let outside = 0
      for (let i = 0; i < e.count; i++) {
        if (e.state[i] === STATE_HIDDEN) continue
        if (Math.hypot(e.pos[i * 3]!, e.pos[i * 3 + 1]!, e.pos[i * 3 + 2]!) > INNER_R + 0.05) outside++
      }
      expect(outside).toBe(0)
    }
  })

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
  describe('what hangs in the liquid goes round with it, not out against the glass', () => {
    const even = { glass: 0, core: 0, n: 0 }
    for (let x = -WALL; x <= WALL; x += 1.5) {
      for (let y = GROUND_Y; y <= WALL; y += 1.5) {
        for (let z = -WALL; z <= WALL; z += 1.5) {
          const r = Math.hypot(x, y, z)
          if (r > WALL) continue
          even.n++
          if (r > WALL - 3) even.glass++
          if (r < WALL * 0.6) even.core++
        }
      }
    }
    const shares = (e: ParticleEngine): { glass: number; core: number } => {
      const mote = e.kinds.indexOf('mote')
      let n = 0
      let glass = 0
      let core = 0
      for (let i = 0; i < e.count; i++) {
        if (e.kindOf[i] !== mote) continue
        const r = Math.hypot(e.pos[i * 3]!, e.pos[i * 3 + 1]!, e.pos[i * 3 + 2]!)
        n++
        if (r > WALL - 3) glass++
        if (r < WALL * 0.6) core++
      }
      return { glass: (glass / n) * (even.n / even.glass), core: (core / n) * (even.n / even.core) }
    }
    const turn = (e: ParticleEngine): number => Math.hypot(e.liquid[LIQUID_TURN]!, e.liquid[LIQUID_TURN + 1]!, e.liquid[LIQUID_TURN + 2]!)
    const run = (tl: Timeline): { peak: number; after: number; upright: number } => {
      const e = new ParticleEngine({ season: 'summer', fraction: 0.2 })
      e.reset()
      let peak = 0
      for (let quarter = 8; quarter <= 16; quarter++) {
        e.advanceTo(steps((quarter / 4) * beatSeconds), tl)
        peak = Math.max(peak, turn(e))
        if (quarter % 4 === 0) expect(shares(e).glass).toBeLessThan(1.8)
      }
      e.advanceTo(steps(5 * beatSeconds), tl)
      const after = turn(e)
      const upright = Math.abs(e.liquid[LIQUID_TURN + 1]!) / after
      e.advanceTo(steps(barSeconds + config.states.restSeconds), tl)
      const rest = shares(e)
      expect(rest.glass).toBeLessThan(1.3)
      expect(rest.core).toBeGreaterThan(0.6)
      expect(turn(e)).toBeLessThan(0.01)
      return { peak, after, upright }
    }

    it('under the real shake, which leaves the liquid turning about the upright axis', () => {
      const { peak, after, upright } = run(stillTimeline('summer'))
      expect(peak).toBeGreaterThan(TURN_PEAK_FLOOR)
      expect(after).toBeGreaterThan(TURN_AFTER_FLOOR)
      expect(after).toBeLessThan(peak)
      expect(upright).toBeGreaterThan(0.97)
    })

    it('and under a hand that rocks the globe 14 degrees, which turns it faster than 2 rad/s', () => {
      const { peak } = run(rockingTimeline('summer', 14))
      expect(peak).toBeGreaterThan(2)
    })
  })
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

describe('the worker wrapper', () => {
  function wire(): EnginePort {
    const host = new EngineHost()
    const port: EnginePort = {
      onmessage: null,
      postMessage(message, transfer) {
        const arrived = structuredClone(message, { transfer: transfer ?? [] })
        const reply = host.handle(arrived)
        if (!reply) return
        const back = structuredClone(reply.message, { transfer: reply.transfer })
        queueMicrotask(() => port.onmessage?.({ data: back }))
      },
    }
    return port
  }

  const frameOf = (client: EngineClient, step: number): Promise<void> =>
    new Promise<void>((resolve) => {
      client.onFrame = () => {
        if (client.step === step) resolve()
      }
      client.advanceTo(step)
    })

  function matches(client: EngineClient, direct: ParticleEngine): void {
    expect(client.step).toBe(direct.step)
    expect(client.season).toBe(direct.seasonNow)
    expect(client.pos).toEqual(direct.pos)
    expect(client.prev).toEqual(direct.prev)
    expect(client.sizes).toEqual(direct.sizes)
    expect(client.opacity).toEqual(direct.opacity)
    expect(client.phase).toEqual(direct.phase)
    expect(client.kindOf).toEqual(direct.kindOf)
    expect(client.state).toEqual(direct.state)
    expect(client.liquid).toEqual(direct.liquid)
    expect(client.cover.n).toBe(direct.cover.n)
    expect(client.cover.spanMm).toBe(direct.cover.spanMm)
    expect(client.cover.mm).toEqual(direct.cover.mm)
  }

  it('a timeline crosses to the worker as plain data and is rebuilt the same', () => {
    const tl = swapTimeline('winter', 'spring')
    const plain = plainTimeline(tl)
    expect(JSON.parse(JSON.stringify(plain))).toEqual(plain)
    const built = builtTimeline(plain)
    expect(built.id).toBe(tl.id)
    expect(built.startSeason).toBe(tl.startSeason)
    for (const beat of [0.3, 1.1, 1.9, 2.7, 3.6]) expect(built.events[0]!.path.poseAt(beat)).toEqual(tl.events[0]!.path.poseAt(beat))
  })

  it('posts the same typed arrays as the engine on the main thread', async () => {
    const fraction = 0.02
    const client = new EngineClient(wire(), { season: 'winter', fraction })
    const source: ParticleSource = client
    expect(source.count).toBe(Math.round(POOL * fraction))
    expect(Array.from(client.state).every((v) => v === STATE_HIDDEN)).toBe(true)
    await client.ready
    const tl = swapTimeline('winter', 'spring')
    client.setTimeline(tl)
    const direct = new ParticleEngine({ season: 'winter', fraction })
    direct.reset()
    for (const step of [1, 130, 131, 420, steps(barSeconds) + 60]) {
      await frameOf(client, step)
      direct.advanceTo(step, tl)
      matches(client, direct)
    }
    expect(client.season).toBe('spring')
    client.stir(0, 2.5, 0)
    direct.stir(0, 2.5, 0)
    const far = direct.step + 90
    client.advanceTo(far - 50)
    client.advanceTo(far - 20)
    await frameOf(client, far)
    direct.advanceTo(far, tl)
    matches(client, direct)

    client.reset('summer')
    client.setTimeline(idle('summer'))
    await frameOf(client, 40)
    const fresh = new ParticleEngine({ season: 'summer', fraction })
    fresh.reset()
    fresh.advanceTo(40, idle('summer'))
    matches(client, fresh)
    expect(frameBytes(client.count)).toBe(LIQUID_LENGTH * 8 + COVER_N * COVER_N * 4 + client.count * 38)
  })
})

function memoryStore(): SimStore & { size: number } {
  const kept = new Map<string, ArrayBuffer>()
  return {
    get size() {
      return kept.size
    },
    async list(key) {
      return [...kept.keys()].filter((k) => k.startsWith(`${key}/`)).map((k) => Number(k.slice(key.length + 1)))
    },
    async get(key, step) {
      return kept.get(`${key}/${step}`) ?? null
    },
    async put(key, step, data) {
      kept.set(`${key}/${step}`, data)
    },
  }
}

describe('the driver on the engine', () => {
  const fraction = 0.02
  const tl = swapTimeline('winter', 'spring')
  const straight = (seconds: number): ParticleEngine => {
    const e = new ParticleEngine({ fraction })
    e.reset()
    e.advanceTo(Math.max(1, Math.ceil(seconds * HZ - 1e-7)), tl)
    return e
  }

  it('a seek to any time gives the same arrays as a straight run', async () => {
    const store = memoryStore()
    const sim = new ParticleEngine({ fraction })
    const driver = new SimDriver(sim, store, 'test')
    await driver.seek(tl, 5.3)
    same(straight(5.3), sim)
    expect(store.size).toBe(2)
    await driver.seek(tl, 2.6)
    same(straight(2.6), sim)
    await driver.seek(tl, 0.5)
    same(straight(0.5), sim)
    await driver.seek(tl, 4.1)
    same(straight(4.1), sim)

    const other = new ParticleEngine({ fraction })
    const cold = new SimDriver(other, store, 'test')
    await cold.seek(tl, 5.3)
    same(straight(5.3), other)
    expect(cold.replayed).toBeLessThan(steps(5.3) - steps(4) + 2)
  }, 120000)
})

describe('the live engine', () => {
  it('shows a full pool with the tail hidden and follows the quality level', () => {
    const live = new LiveEngine({ season: 'winter', fraction: 0.3 })
    live.reset('winter')
    const src = live.source
    expect(src.count).toBe(POOL)
    expect(src.pos.length).toBe(POOL * 3)
    const n = live.active
    expect(n).toBe(Math.round(POOL * 0.3))
    let shown = 0
    for (let i = 0; i < POOL; i++) if (src.state[i] !== STATE_HIDDEN) shown++
    expect(shown).toBeGreaterThan(0)
    for (let i = n; i < POOL; i++) expect(src.state[i] === STATE_HIDDEN && src.opacity[i] === 0 && src.sizes[i] === 0).toBe(true)

    const tl = swapTimeline('winter', 'spring')
    live.advanceTo(steps(1.5), tl)
    const before = src.pos.slice(0, 300)
    live.setFraction(0.1)
    expect(live.active).toBe(Math.round(POOL * 0.1))
    expect(live.step).toBe(steps(1.5))
    expect([...src.pos.subarray(0, 300)]).toEqual([...before])
    for (let i = live.active; i < POOL; i++) expect(src.state[i] === STATE_HIDDEN && src.opacity[i] === 0).toBe(true)
    live.advanceTo(steps(1.6), tl)
    live.setFraction(0.3)
    expect(live.active).toBe(n)
    live.advanceTo(steps(7), tl)
    expect(live.season).toBe('spring')
    for (let i = 0; i < live.active * 3; i++) expect(Number.isFinite(src.pos[i])).toBe(true)
  }, 120000)

  it('lands at rest in the new season when the timeline jumps without a shake', () => {
    const live = new LiveEngine({ season: 'winter', fraction: 0.05 })
    live.reset('winter')
    live.advanceTo(steps(1), idle('winter'))
    live.advanceTo(steps(1) + 1, idle('fall'))
    expect(live.season).toBe('fall')
    expect(live.step).toBe(steps(1) + 1)
    const rest = new ParticleEngine({ season: 'fall', fraction: 0.05 })
    rest.reset()
    rest.advanceTo(1, idle('fall'))
    expect([...live.source.kindOf.subarray(0, live.active)]).toEqual([...rest.kindOf])
    let far = 0
    for (let i = 0; i < live.active * 3; i++) far = Math.max(far, Math.abs(live.source.pos[i]! - rest.pos[i]!))
    expect(far).toBeLessThan(0.5)
    live.advanceTo(steps(3), idle('fall'))
    expect(live.floating()).toBeLessThan(live.active)
  }, 120000)
})

describe('the live runner', () => {
  const fraction = 0.02
  const n = Math.round(POOL * fraction)
  const settle = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0))

  function fakeWorker(o: { silent?: boolean; dieAtFrame?: number } = {}): EngineWorker & { closed: boolean } {
    const host = new EngineHost()
    let frames = 0
    const w: EngineWorker & { closed: boolean } = {
      closed: false,
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      terminate() {
        w.closed = true
      },
      postMessage(message, transfer) {
        const arrived = structuredClone(message, { transfer: transfer ?? [] })
        if (o.silent || w.closed) return
        queueMicrotask(() => {
          if (w.closed) return
          const reply = host.handle(arrived)
          if (!reply) return
          if (reply.message.type === 'frame' && ++frames === o.dieAtFrame) {
            w.onerror?.(new Error('gone'))
            return
          }
          const back = structuredClone(reply.message, { transfer: reply.transfer })
          queueMicrotask(() => w.onmessage?.({ data: back }))
        })
      },
    }
    return w
  }

  function agrees(runner: LiveRunner, direct: ParticleEngine): void {
    const s = runner.source
    expect(runner.step).toBe(direct.step)
    expect([...s.pos.subarray(0, n * 3)]).toEqual([...direct.pos])
    expect([...s.prev.subarray(0, n * 3)]).toEqual([...direct.prev])
    expect([...s.state.subarray(0, n)]).toEqual([...direct.state])
    expect([...s.kindOf.subarray(0, n)]).toEqual([...direct.kindOf])
    expect([...s.opacity.subarray(0, n)]).toEqual([...direct.opacity])
    expect([...s.liquid]).toEqual([...direct.liquid])
    for (let i = n; i < POOL; i++) expect(s.state[i]).toBe(STATE_HIDDEN)
  }

  it('hands the simulation to the worker and shows the same state as the main thread would', async () => {
    const worker = fakeWorker()
    const runner = new LiveRunner({ season: 'winter', fraction, spawn: () => worker })
    runner.reset('winter')
    const tl = swapTimeline('winter', 'spring')
    expect(runner.remote).toBe(false)
    runner.advanceTo(4, tl)
    expect(runner.step).toBe(4)
    await settle()
    let target = 4
    for (let frame = 0; frame < 150; frame++) {
      target += 4
      runner.advanceTo(target, tl)
      await settle()
    }
    expect(runner.remote).toBe(true)
    expect(runner.frames).toBeGreaterThan(0)
    for (let wait = 0; wait < 50 && runner.step < target; wait++) {
      runner.advanceTo(target, tl)
      await settle()
    }
    const direct = new ParticleEngine({ season: 'winter', fraction })
    direct.reset()
    direct.advanceTo(target, tl)
    agrees(runner, direct)
    expect(runner.fallbacks).toBe(0)

    runner.setFraction(0.01)
    expect(runner.active).toBe(Math.round(POOL * 0.01))
    target += 8
    for (let wait = 0; wait < 50 && (runner.step < target || runner.source.state[n - 1] !== STATE_HIDDEN); wait++) {
      runner.advanceTo(target, tl)
      await settle()
    }
    expect(runner.step).toBe(target)
    expect(runner.source.state[n - 1]).toBe(STATE_HIDDEN)

    runner.reset()
    expect(runner.step).toBe(0)
    const idleTl = idle('summer')
    for (let wait = 0; wait < 50 && (runner.step < 12 || runner.season !== 'summer'); wait++) {
      runner.advanceTo(12, idleTl)
      await settle()
    }
    expect(runner.step).toBe(12)
    expect(runner.season).toBe('summer')
  }, 120000)

  it('stays on the main thread when the worker never answers', async () => {
    let clock = 0
    const worker = fakeWorker({ silent: true })
    const runner = new LiveRunner({ season: 'winter', fraction, spawn: () => worker, now: () => clock, readyMs: 1000 })
    runner.reset('winter')
    const tl = swapTimeline('winter', 'spring')
    for (let target = 4; target <= 400; target += 4) {
      clock += 16
      runner.advanceTo(target, tl)
      expect(runner.step).toBe(target)
      await settle()
    }
    expect(runner.remote).toBe(false)
    expect(worker.closed).toBe(true)
    const direct = new ParticleEngine({ season: 'winter', fraction })
    direct.reset()
    direct.advanceTo(400, tl)
    agrees(runner, direct)
  }, 120000)

  it('falls back to the main thread when the worker stops, and carries on at the same step', async () => {
    let clock = 0
    for (const how of ['error', 'silence'] as const) {
      const worker = fakeWorker(how === 'error' ? { dieAtFrame: 6 } : {})
      const runner = new LiveRunner({ season: 'winter', fraction, spawn: () => worker, now: () => clock, frameMs: 500 })
      runner.reset('winter')
      const tl = idle('winter')
      let target = 0
      for (let frame = 0; frame < 40; frame++) {
        target += 4
        clock += 16
        runner.advanceTo(target, tl)
        await settle()
        if (how === 'silence' && frame === 20) {
          expect(runner.remote).toBe(true)
          worker.closed = true
        }
      }
      for (let frame = 0; frame < 40; frame++) {
        target += 4
        clock += 16
        runner.advanceTo(target, tl)
        await settle()
      }
      expect(runner.remote).toBe(false)
      expect(runner.fallbacks).toBe(1)
      expect(runner.step).toBe(target)
      expect(runner.season).toBe('winter')
      const s = runner.source
      for (let i = 0; i < n * 3; i++) expect(Number.isFinite(s.pos[i])).toBe(true)
      expect(runner.floating()).toBeLessThan(n)
    }
  }, 120000)
})
