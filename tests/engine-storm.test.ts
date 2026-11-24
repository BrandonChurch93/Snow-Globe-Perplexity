import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { stream } from '../src/core/rng'
import { barSeconds, stateSeconds, stillTimeline } from '../src/film/timeline'
import { ParticleEngine, STATE_HIDDEN, STATE_LIQUID, WALL } from '../src/particles/engine/engine'
import { KINDS } from '../src/particles/engine/kinds'
import { sdfSample } from '../src/particles/engine/sdf'
import { buildCollider, groundAt } from '../src/scene/layout'

const HZ = config.sim.stepHz
const steps = (seconds: number): number => Math.round(seconds * HZ)
const season = config.lookLockUnit
const collider = buildCollider()
const tl = stillTimeline(season)
const LIFTS = [0, 3, 12, 48, 200]

function bandOf(x: number, y: number, z: number): number {
  const up = y - groundAt(x, z)
  for (let b = 0; b < LIFTS.length - 1; b++) if (up < LIFTS[b + 1]!) return b
  return LIFTS.length - 2
}

const even = ((): number[] => {
  const rng = stream('test:engine:even')
  const out = new Array<number>(LIFTS.length - 1).fill(0)
  let n = 0
  while (n < 60000) {
    const x = rng.range(-WALL, WALL)
    const y = rng.range(-WALL, WALL)
    const z = rng.range(-WALL, WALL)
    if (x * x + y * y + z * z > WALL * WALL || sampleAt(x, y, z) < 0) continue
    out[bandOf(x, y, z)]!++
    n++
  }
  return out.map((c) => c / n)
})()

function sampleAt(x: number, y: number, z: number): number {
  return sdfSample(collider, x, y, z, new Float64Array(3))
}

function fill(e: ParticleEngine): number[] {
  const out = new Array<number>(LIFTS.length - 1).fill(0)
  let n = 0
  for (let i = 0; i < e.count; i++) {
    if (e.state[i] !== STATE_LIQUID) continue
    out[bandOf(e.pos[i * 3]!, e.pos[i * 3 + 1]!, e.pos[i * 3 + 2]!)]!++
    n++
  }
  return out.map((c, b) => c / n / even[b]!)
}

describe('the storm of the look lock season', () => {
  it('fills the whole dome at the landing and does not press into a low layer', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    for (const seconds of [barSeconds, stateSeconds('landed')]) {
      e.advanceTo(steps(seconds), tl)
      expect(e.floating()).toBeGreaterThan(e.count * 0.97)
      const [low, near, mid, high] = fill(e) as [number, number, number, number]
      expect(low).toBeLessThan(3)
      expect(near).toBeLessThan(2)
      expect(mid).toBeGreaterThan(0.7)
      expect(mid).toBeLessThan(1.4)
      expect(high).toBeGreaterThan(0.4)
      expect(high).toBeLessThan(1.4)
    }
  }, 120000)

  it('still has flakes through the whole dome at rest, a little denser low down, and far fewer once settled', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    e.advanceTo(steps(stateSeconds('rest')), tl)
    const rest = e.floating()
    expect(rest).toBeGreaterThan(e.count * 0.04)
    expect(rest).toBeLessThan(e.count * 0.1)
    const [, , mid, high] = fill(e) as [number, number, number, number]
    expect(high).toBeGreaterThan(0.3)
    expect(high).toBeLessThan(mid)
    e.advanceTo(steps(stateSeconds('settled')), tl)
    const settled = e.floating()
    expect(settled).toBeLessThan(rest * 0.6)
    expect(settled).toBeGreaterThan(e.count * 0.01)
    expect(fill(e)[3]).toBeGreaterThan(0.4)
  }, 240000)

  it('gives sizes in millimetres with most flakes small and a long tail of large ones', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    const flake = KINDS.indexOf('flake')
    const sizes: number[] = []
    for (let i = 0; i < e.count; i++) if (e.kindOf[i] === flake && e.state[i] !== STATE_HIDDEN) sizes.push(e.sizes[i]!)
    sizes.sort((a, b) => a - b)
    const at = (p: number): number => sizes[Math.floor((sizes.length - 1) * p)]!
    expect(at(0.5)).toBeGreaterThan(0.2)
    expect(at(0.5)).toBeLessThan(0.34)
    expect(at(0.9)).toBeGreaterThan(2 * at(0.5))
    expect(at(0.99)).toBeGreaterThan(4 * at(0.5))
    expect(at(1)).toBeLessThanOrEqual(1.9 + 1e-6)
    expect(at(0)).toBeGreaterThan(0.05)
  })

  it('shows the same positions whether they are read at every step or only at the end', () => {
    const watched = new ParticleEngine({ season, fraction: 0.02, collider })
    const blind = new ParticleEngine({ season, fraction: 0.02, collider })
    const last = steps(barSeconds + 0.5)
    let before = watched.pos.slice()
    let jumps = 0
    for (let n = 1; n <= last; n++) {
      watched.advanceTo(n, tl)
      const now = watched.pos
      const prev = watched.prev
      for (let i = 0; i < watched.count; i++) {
        if (watched.state[i] !== STATE_LIQUID) continue
        const o = i * 3
        if (Math.hypot(prev[o]! - before[o]!, prev[o + 1]! - before[o + 1]!, prev[o + 2]! - before[o + 2]!) > 0.6) jumps++
      }
      before = now.slice()
    }
    blind.advanceTo(last, tl)
    expect(watched.pos).toEqual(blind.pos)
    expect(watched.prev).toEqual(blind.prev)
    expect(watched.vel).toEqual(blind.vel)
    expect(watched.state).toEqual(blind.state)
    expect(jumps).toBeLessThan(watched.count * 0.02)
  }, 120000)
})
