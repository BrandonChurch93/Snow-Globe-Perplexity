import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { barSeconds, stillTimeline } from '../src/film/timeline'
import { ParticleEngine, STATE_LIQUID } from '../src/particles/engine/engine'
import { POOL } from '../src/particles/engine/kinds'

const HZ = config.sim.stepHz
const full = process.env.BENCH === '1'
const fraction = full ? 1 : 0.1
const seconds = Math.ceil(barSeconds + (full ? 6 : 2))

describe('the storm bench', () => {
  it(`times winter's test shake at ${Math.round(POOL * fraction)} particles, one simulated second at a time`, () => {
    const season = config.lookLockUnit
    const tl = stillTimeline(season)
    const e = new ParticleEngine({ season, fraction })
    e.reset(season)
    e.advanceTo(1, tl)
    const rows: string[] = []
    let worst = 0
    let total = 0
    for (let s = 0; s < seconds; s++) {
      const t0 = performance.now()
      e.advanceTo(1 + (s + 1) * HZ, tl)
      const ms = performance.now() - t0
      let afloat = 0
      for (let i = 0; i < e.count; i++) if (e.state[i] === STATE_LIQUID) afloat++
      worst = Math.max(worst, ms)
      total += ms
      rows.push(`second ${s + 1}: ${(ms / 1000).toFixed(3)} s of work, ${afloat} afloat`)
    }
    console.log(`storm bench, ${e.count} particles (${full ? 'full pool' : 'a tenth of the pool, set BENCH=1 for all of it'})\n${rows.join('\n')}\nworst second ${(worst / 1000).toFixed(3)} s, mean ${(total / seconds / 1000).toFixed(3)} s of work for one simulated second`)
    expect(worst).toBeGreaterThan(0)
  }, 600000)
})
