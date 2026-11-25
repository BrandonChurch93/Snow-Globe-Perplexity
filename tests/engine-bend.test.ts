import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { barSeconds, stillTimeline } from '../src/film/timeline'
import { liquidBend } from '../src/globe/liquid'
import { ParticleEngine } from '../src/particles/engine/engine'
import { buildCollider } from '../src/scene/layout'

const HZ = config.sim.stepHz

describe('the bend the liquid gives what it carries', () => {
  it('is the turn and the flow the engine steps with, read from the state alone', () => {
    const tl = stillTimeline('winter')
    const e = new ParticleEngine({ season: 'winter', fraction: 0.02, collider: buildCollider() })
    e.reset('winter')
    const out = new Float64Array(6)
    let most = 0
    for (const at of [-1.2, -0.8, -0.4, 0, 0.5, 1.5, 3]) {
      e.advanceTo(Math.round((barSeconds + at) * HZ), tl)
      liquidBend(e.liquid, out)
      const c = e.model.coef
      for (let j = 0; j < 3; j++) expect(Math.abs(out[j]! - c[j]!)).toBeLessThan(0.01)
      for (let j = 3; j < 6; j++) expect(Math.abs(out[j]! - c[j]!)).toBeLessThan(0.7)
      most = Math.max(most, Math.hypot(out[3]!, out[4]!, out[5]!))
    }
    expect(most).toBeGreaterThan(100)
  }, 120000)

  it('is nothing in still water', () => {
    const out = new Float64Array(6).fill(1)
    liquidBend(new Float64Array(22), out)
    expect([...out]).toEqual([0, 0, 0, 0, 0, 0])
  })
})
