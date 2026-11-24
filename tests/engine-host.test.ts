import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { stream } from '../src/core/rng'
import { barSeconds, type Timeline } from '../src/film/timeline'
import { makeShake } from '../src/shake/table'
import { EngineHost, plainTimeline, type FromEngine } from '../src/particles/engine/host'

const HZ = config.sim.stepHz
const fraction = 0.02
const tl: Timeline = { id: 'test:host', startSeason: 'winter', events: [{ id: 'shake-1', startSec: 0, from: 'winter', to: 'spring', path: makeShake('shake-1') }] }
const last = Math.round((barSeconds + 0.8) * HZ)

function started(now?: () => number): EngineHost {
  const host = now ? new EngineHost(now) : new EngineHost()
  host.handle({ type: 'init', season: 'winter', fraction })
  host.handle({ type: 'timeline', timeline: plainTimeline(tl) })
  return host
}

function frame(host: EngineHost, step: number, budgetMs?: number): { step: number; season: string; bytes: Uint8Array } {
  const reply = host.handle(budgetMs === undefined ? { type: 'advance', step } : { type: 'advance', step, budgetMs })
  const m = reply!.message as Extract<FromEngine, { type: 'frame' }>
  return { step: m.step, season: m.season, bytes: new Uint8Array(m.buffer) }
}

describe('the slices of the live worker', () => {
  it('give the same frame at every step they stop on as a run that was never sliced, whatever the clock says', () => {
    const whole = started(() => {
      throw new Error('a run with no budget must not read the clock')
    })
    const goal = frame(whole, last)
    expect(goal.step).toBe(last)
    for (const seed of ['a', 'b', 'c']) {
      const rng = stream(`test:host:${seed}`)
      let clock = 0
      const host = started(() => {
        clock += seed === 'a' ? 100 : rng.next() < 0.7 ? 0 : rng.range(0, 9)
        return clock
      })
      const straight = started()
      const stops: number[] = []
      let at = 0
      let checked = 0
      while (at < last) {
        const sliced = frame(host, last, seed === 'c' ? 0 : 8)
        expect(sliced.step).toBeGreaterThan(at)
        expect(sliced.step).toBeLessThanOrEqual(last)
        stops.push(sliced.step - at)
        at = sliced.step
        if (at === last || stops.length % 11 === 0) {
          const direct = frame(straight, at)
          expect(direct.step).toBe(at)
          expect(sliced.season).toBe(direct.season)
          expect(Buffer.compare(sliced.bytes, direct.bytes)).toBe(0)
          checked++
        }
      }
      const final = frame(host, last, 8)
      expect(Buffer.compare(final.bytes, goal.bytes)).toBe(0)
      expect(checked).toBeGreaterThan(3)
      if (seed === 'a' || seed === 'c') expect(Math.max(...stops)).toBe(1)
      else {
        expect(Math.max(...stops)).toBeGreaterThan(4)
        expect(Math.min(...stops)).toBe(1)
      }
    }
  }, 120000)
})
