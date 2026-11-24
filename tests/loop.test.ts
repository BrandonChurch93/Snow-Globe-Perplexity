import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { sampleSdf } from '../src/core/sdf'
import type { ParticleSource } from '../src/core/stage'
import { barSeconds, stateSeconds, stillTimeline } from '../src/film/timeline'
import { LIQUID_LENGTH } from '../src/globe/liquid'
import { ParticleEngine, STATE_HIDDEN, STATE_LIQUID, STATE_REST } from '../src/particles/engine/engine'
import { LoopPaths, loopTimeline } from '../src/particles/engine/loop'
import { INNER_R } from '../src/particles/engine/sdf'

const HZ = config.sim.stepHz
const DT = 1 / HZ
const L = config.deliver.cardLoop.seconds
const START = config.deliver.cardLoop.shakeStartSeconds
const FRACTION = 0.04

const made = new Map<string, { rest: ParticleEngine; loop: LoopPaths }>()

function build(season: string): { rest: ParticleEngine; loop: LoopPaths } {
  let m = made.get(season)
  if (!m) {
    const rest = new ParticleEngine({ season, fraction: FRACTION })
    rest.reset(season)
    rest.advanceTo(Math.round(stateSeconds('rest') * HZ), stillTimeline(season))
    m = { rest, loop: new LoopPaths(rest) }
    made.set(season, m)
  }
  return m
}

interface Frame {
  pos: Float32Array
  prev: Float32Array
  opacity: Float32Array
  phase: Float32Array
  state: Uint8Array
  liquid: Float64Array
  step: number
}

function frame(loop: LoopPaths, t: number): Frame {
  loop.setTime(t)
  return { pos: loop.pos.slice(), prev: loop.prev.slice(), opacity: loop.opacity.slice(), phase: loop.phase.slice(), state: loop.state.slice(), liquid: loop.liquid.slice(), step: loop.step }
}

describe('the card loop: closed paths', () => {
  it('gives the drawing the same arrays as the simulation', () => {
    const { rest, loop } = build(config.defaultSeason)
    const card: { readonly source: ParticleSource; setTime(seconds: number): void } = loop
    const source: ParticleSource = card.source
    expect(source).toBe(loop)
    expect(source.count).toBe(rest.count)
    expect(source.pos.length).toBe(rest.count * 3)
    expect(source.prev.length).toBe(rest.count * 3)
    expect(source.sizes.length).toBe(rest.count)
    expect(source.kindOf.length).toBe(rest.count)
    expect(source.state.length).toBe(rest.count)
    expect(source.liquid.length).toBe(LIQUID_LENGTH)
    expect(loop.opacity.length).toBe(rest.count)
    expect(loop.phase.length).toBe(rest.count)
    expect(source.kinds).toEqual(rest.kinds)
    expect(Array.from(loop.kindOf)).toEqual(Array.from(rest.kindOf))
    expect(Array.from(loop.sizes)).toEqual(Array.from(rest.sizes))
    loop.setTime(1.25)
    expect(loop.step).toBe(Math.round(1.25 * HZ))
    expect(loop.time).toBe(1.25)
    expect(loop.seconds).toBe(L)
  })

  for (const season of config.seasons) {
    it(`${season}: every period divides the loop length`, () => {
      const { loop } = build(season)
      expect(loop.periods.length).toBeGreaterThan(0)
      for (const p of loop.periods) {
        const whole = L / p
        expect(p).toBeGreaterThan(0)
        expect(Math.abs(whole - Math.round(whole))).toBeLessThan(1e-9)
        expect(Math.round(whole)).toBeGreaterThanOrEqual(1)
      }
      expect(L / config.scene.ambientPeriodSeconds).toBe(Math.round(L / config.scene.ambientPeriodSeconds))
    })

    it(`${season}: every particle's path closes`, () => {
      const { rest, loop } = build(season)
      const a = frame(loop, 0)
      const b = frame(loop, L)
      const c = frame(loop, 3 * L)
      const d = frame(loop, -L)
      for (const other of [b, c, d]) {
        expect(other.pos).toEqual(a.pos)
        expect(other.prev).toEqual(a.prev)
        expect(other.opacity).toEqual(a.opacity)
        expect(other.phase).toEqual(a.phase)
        expect(other.state).toEqual(a.state)
        expect(other.liquid).toEqual(a.liquid)
        expect(other.step).toBe(0)
      }
      const last = frame(loop, L - DT)
      expect(a.prev).toEqual(last.pos)
      let jump = 0
      let away = 0
      for (let i = 0; i < loop.count; i++) {
        const o = i * 3
        if (a.state[i] === STATE_HIDDEN) continue
        if (a.opacity[i]! > 0.02 || last.opacity[i]! > 0.02) jump = Math.max(jump, Math.hypot(a.pos[o]! - last.pos[o]!, a.pos[o + 1]! - last.pos[o + 1]!, a.pos[o + 2]! - last.pos[o + 2]!))
        if (a.opacity[i]! > 0.98) away = Math.max(away, Math.hypot(a.pos[o]! - rest.pos[o]!, a.pos[o + 1]! - rest.pos[o + 1]!, a.pos[o + 2]! - rest.pos[o + 2]!))
        expect(Math.abs(a.opacity[i]! - last.opacity[i]!)).toBeLessThan(0.08)
      }
      expect(jump).toBeLessThan(0.3)
      expect(away).toBeLessThan(0.2)
      expect(Array.from(a.liquid)).toEqual(new Array(LIQUID_LENGTH).fill(0))
      expect(Array.from(a.state)).toEqual(Array.from(rest.state))
    })

    it(`${season}: nobody leaves the sphere or shows inside a solid, and nothing jumps`, () => {
      const { rest, loop } = build(season)
      const grid = rest.colliderOf(season)
      let worst = 0
      let leaps = 0
      let seen = 0
      let broken = 0
      let buried = 0
      for (let t = 0; t < L; t += 0.09) {
        loop.setTime(t)
        for (let i = 0; i < loop.count; i++) {
          const o = i * 3
          const x = loop.pos[o]!
          const y = loop.pos[o + 1]!
          const z = loop.pos[o + 2]!
          const op = loop.opacity[i]!
          if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && op >= 0 && op <= 1)) broken++
          worst = Math.max(worst, Math.hypot(x, y, z))
          if (sampleSdf(grid, x, y, z) < -0.05) buried++
          if (op > 0.05) {
            seen++
            if (Math.hypot(x - loop.prev[o]!, y - loop.prev[o + 1]!, z - loop.prev[o + 2]!) > 2.5) leaps++
          }
        }
      }
      expect(broken).toBe(0)
      expect(buried).toBe(0)
      expect(worst).toBeLessThanOrEqual(INNER_R + 0.05)
      expect(leaps / seen).toBeLessThan(2e-5)
    })
  }

  it('a particle at rest stays at rest until the shake and after the storm, and the storm fills the glass between', () => {
    const season = config.defaultSeason
    const { rest, loop } = build(season)
    const resting: number[] = []
    for (let i = 0; i < loop.count; i++) if (rest.state[i] === STATE_REST) resting.push(i)
    expect(resting.length).toBeGreaterThan(loop.count * 0.5)
    expect(loopTimeline(season).events[0]!.startSec).toBe(START)
    expect(loop.stormEnd).toBeLessThan(L)
    expect(loop.stormEnd).toBeGreaterThan(START + barSeconds)
    for (const t of [0, START * 0.5, START - DT, loop.stormEnd + DT, L - DT]) {
      loop.setTime(t)
      for (const i of resting) {
        const o = i * 3
        expect(loop.state[i]).toBe(STATE_REST)
        expect(loop.pos[o]).toBe(rest.pos[o])
        expect(loop.pos[o + 1]).toBe(rest.pos[o + 1])
        expect(loop.pos[o + 2]).toBe(rest.pos[o + 2])
        expect(loop.prev[o]).toBe(rest.pos[o])
        expect(loop.prev[o + 1]).toBe(rest.pos[o + 1])
        expect(loop.prev[o + 2]).toBe(rest.pos[o + 2])
        expect(loop.opacity[i]).toBe(rest.opacity[i])
      }
      expect(Array.from(loop.liquid)).toEqual(new Array(LIQUID_LENGTH).fill(0))
    }
    loop.setTime(START + barSeconds + config.states.landedSeconds)
    let afloat = 0
    let high = 0
    let turned = 0
    for (const i of resting) {
      const o = i * 3
      if (loop.state[i] === STATE_LIQUID) afloat++
      if (loop.pos[o + 1]! > 0) high++
      const before = Math.atan2(rest.pos[o + 2]!, rest.pos[o]!)
      const now = Math.atan2(loop.pos[o + 2]!, loop.pos[o]!)
      let turn = Math.abs(now - before)
      if (turn > Math.PI) turn = 2 * Math.PI - turn
      if (turn > 0.5) turned++
    }
    expect(afloat / resting.length).toBeGreaterThan(0.85)
    expect(high / resting.length).toBeGreaterThan(0.04)
    expect(turned / resting.length).toBeGreaterThan(0.5)
    expect(loop.liquid.some((v) => v !== 0)).toBe(true)
    loop.setTime(L * 0.75)
    let late = 0
    for (const i of resting) if (loop.state[i] === STATE_LIQUID) late++
    expect(late).toBeLessThan(afloat)
    expect(late).toBeGreaterThan(0)
  })

  it('the same rest picture gives the same loop', () => {
    const season = config.defaultSeason
    const { rest, loop } = build(season)
    const again = new LoopPaths(rest)
    for (const t of [0, 2.2, 3.7, 6.1]) {
      const a = frame(loop, t)
      again.setTime(t)
      expect(again.pos).toEqual(a.pos)
      expect(again.prev).toEqual(a.prev)
      expect(again.opacity).toEqual(a.opacity)
      expect(again.phase).toEqual(a.phase)
    }
  })

  it('a loop with no shake only drifts', () => {
    const season = config.defaultSeason
    const { rest } = build(season)
    const calm = new LoopPaths(rest, { timeline: { id: 'calm', startSeason: season, events: [] } })
    expect(calm.stormEnd).toBe(0)
    const a = frame(calm, 0)
    const b = frame(calm, L / 2)
    let moved = 0
    for (let i = 0; i < calm.count; i++) {
      const o = i * 3
      const d = Math.hypot(a.pos[o]! - b.pos[o]!, a.pos[o + 1]! - b.pos[o + 1]!, a.pos[o + 2]! - b.pos[o + 2]!)
      if (rest.state[i] === STATE_REST) expect(d).toBe(0)
      else if (d > 0) moved++
    }
    expect(moved).toBeGreaterThan(0)
    expect(frame(calm, L).pos).toEqual(a.pos)
  })
})
