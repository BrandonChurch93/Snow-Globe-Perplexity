import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { barSeconds, globePoseAt, stateSeconds, stillTimeline } from '../src/film/timeline'
import { Liquid, LIQUID_R } from '../src/globe/liquid'
import { ParticleEngine, STATE_LIQUID } from '../src/particles/engine/engine'
import { buildCollider } from '../src/scene/layout'

const HZ = config.sim.stepHz
const DT = 1 / HZ
const collider = buildCollider()

describe('the landed whirl sweeps what it carries out of the middle', () => {
  for (const season of config.seasons) {
    it(`${season}: sweeps nothing until the landed moment has passed, then sweeps, and has stopped when the roll has died`, () => {
      const tl = stillTimeline(season)
      const liquid = new Liquid()
      const key = Math.round((stateSeconds('landed') + 0.1) * HZ)
      const end = Math.round((barSeconds + 8) * HZ)
      let most = 0
      for (let n = 0; n < end; n++) {
        const t = n * DT
        liquid.step(globePoseAt(tl, t - DT), globePoseAt(tl, t), globePoseAt(tl, t + DT), t)
        if (n <= key) expect(liquid.clearing, `at ${(t - barSeconds).toFixed(3)} s`).toBe(0)
        else if (liquid.clearing > most) most = liquid.clearing
      }
      expect(most).toBeGreaterThan(0.5)
      expect(liquid.clearing, 'at the end').toBe(0)
    })
  }

  it('so that three and four seconds after the landing the middle holds no more than its share of what is afloat', () => {
    const tl = stillTimeline('winter')
    const e = new ParticleEngine({ season: 'winter', fraction: 0.2, collider })
    e.reset('winter')
    for (const after of [3, 4]) {
      e.advanceTo(Math.round((barSeconds + after) * HZ), tl)
      let afloat = 0
      let mid = 0
      for (let i = 0; i < e.count; i++) {
        if (e.state[i] !== STATE_LIQUID) continue
        afloat++
        if (Math.hypot(e.pos[i * 3]!, e.pos[i * 3 + 2]!) < 0.45 * LIQUID_R) mid++
      }
      expect(afloat).toBeGreaterThan(e.count * 0.3)
      expect(mid / afloat).toBeLessThan(0.32)
    }
  }, 120000)
})
