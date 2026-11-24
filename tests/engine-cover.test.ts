import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { COVER_MAX_MM } from '../src/core/chunks/cover'
import type { ParticleSource } from '../src/core/stage'
import { barSeconds, beatSeconds, stateSeconds, type Timeline } from '../src/film/timeline'
import { COVER_CAP_MM, COVER_N, COVER_SPAN_MM, ParticleEngine, WALL } from '../src/particles/engine/engine'
import { buildCollider, cottage, cottagePoint } from '../src/scene/layout'
import { makeShake } from '../src/shake/table'

const HZ = config.sim.stepHz
const steps = (seconds: number): number => Math.round(seconds * HZ)
const season = config.lookLockUnit
const collider = buildCollider()
const again = stateSeconds('settled') + 1
const swap = ((config.shake.swapWindow.fromBeat + config.shake.swapWindow.toBeat) / 2) * beatSeconds

const twice: Timeline = {
  id: 'test:twice',
  startSeason: season,
  events: [
    { id: 'test:first', startSec: 0, from: season, to: season, path: makeShake('test:first') },
    { id: 'test:second', startSec: again, from: season, to: season, path: makeShake('test:second') },
  ],
}

function total(e: ParticleSource): number {
  let sum = 0
  for (const v of e.cover!.mm) sum += v
  return sum
}

function under(e: ParticleSource, x: number, z: number): number {
  const c = e.cover!
  let sum = 0
  let n = 0
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ix = Math.floor((x / c.spanMm + 0.5) * c.n) + dx
      const iz = Math.floor((z / c.spanMm + 0.5) * c.n) + dz
      sum += c.mm[iz * c.n + ix]!
      n++
    }
  }
  return sum / n
}

describe('what lies at rest builds up', () => {
  it('is the map the stage asks for, capped where the stage caps it', () => {
    const e = new ParticleEngine({ season, fraction: 0.05, collider })
    e.reset(season)
    const source: ParticleSource = e
    const c = source.cover!
    expect(COVER_CAP_MM).toBe(COVER_MAX_MM)
    expect(c.n).toBe(COVER_N)
    expect(c.mm.length).toBe(COVER_N * COVER_N)
    expect(c.spanMm).toBe(COVER_SPAN_MM)
    expect(c.spanMm).toBeGreaterThanOrEqual(2 * WALL)
    expect(total(e)).toBeGreaterThan(0)
  })

  it('gives the same thickness from a small share of the pool as from a large one', () => {
    const small = new ParticleEngine({ season, fraction: 0.05, collider })
    const large = new ParticleEngine({ season, fraction: 0.3, collider })
    small.reset(season)
    large.reset(season)
    expect(total(small) / total(large)).toBeGreaterThan(0.85)
    expect(total(small) / total(large)).toBeLessThan(1.15)
  })

  it('lays a fresh layer on the roof once settled, never past the cap, and a shake clears it', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    e.advanceTo(steps(stateSeconds('settled')), twice)
    const settled = total(e)
    let top = 0
    let covered = 0
    for (const v of e.cover.mm) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(COVER_MAX_MM)
      if (v > top) top = v
      if (v > 0.1) covered++
    }
    expect(top).toBeGreaterThan(1)
    expect(covered).toBeGreaterThan(COVER_N * COVER_N * 0.4)
    const slopes = [-0.5, 0.5].map((side) => cottagePoint(cottage.halfWidth * side, 0, 0))
    const roof = slopes.map((p) => under(e, p[0], p[2]))
    expect(Math.min(...roof)).toBeGreaterThan(0.2)
    expect(Math.max(...roof)).toBeGreaterThan(0.6)

    e.advanceTo(steps(again + swap), twice)
    expect(total(e)).toBeLessThan(settled * 0.1)
    for (const p of slopes) expect(under(e, p[0], p[2])).toBeLessThan(0.1)
    e.advanceTo(steps(again + barSeconds), twice)
    expect(total(e)).toBeLessThan(settled * 0.02)

    e.advanceTo(steps(again + stateSeconds('rest')), twice)
    expect(total(e)).toBeGreaterThan(settled * 0.7)
  }, 240000)

  it('is the same map whether it is read at every step or once', () => {
    const often = new ParticleEngine({ season, fraction: 0.03, collider })
    const once = new ParticleEngine({ season, fraction: 0.03, collider })
    const last = steps(barSeconds + 3)
    for (let n = 30; n <= last; n += 30) {
      often.advanceTo(n, twice)
      expect(often.cover.mm.length).toBe(COVER_N * COVER_N)
    }
    often.advanceTo(last, twice)
    once.advanceTo(last, twice)
    expect(often.cover.mm).toEqual(once.cover.mm)
  }, 120000)
})
