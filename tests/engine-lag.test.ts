import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { barSeconds, globePoseAt, stillTimeline } from '../src/film/timeline'
import { LIQUID_LOAD, LIQUID_R } from '../src/globe/liquid'
import { ParticleEngine, STATE_LIQUID } from '../src/particles/engine/engine'
import { buildCollider } from '../src/scene/layout'

const HZ = config.sim.stepHz
const FPS = 60
const collider = buildCollider()

function centre(e: ParticleEngine): number {
  let n = 0
  let cx = 0
  for (let i = 0; i < e.count; i++) {
    if (e.state[i] !== STATE_LIQUID) continue
    cx += e.pos[i * 3]!
    n++
  }
  return n > 0 ? cx / n : 0
}

describe('what the liquid carries lags behind the glass and runs across at a reversal', () => {
  for (const season of config.seasons) {
    it(`in ${season}: the cloud swings from wall to wall in the frame of the glass, against the way the glass went`, () => {
      const tl = stillTimeline(season)
      const e = new ParticleEngine({ season, fraction: 0.2, collider })
      e.reset(season)
      let most = -Infinity
      let least = Infinity
      let against = 0
      let ends = 0
      let was = globePoseAt(tl, barSeconds - 1.5).x
      let going = 0
      for (let f = Math.round((barSeconds - 1.5) * FPS); f <= Math.round((barSeconds - 0.3) * FPS); f++) {
        const sec = f / FPS
        e.advanceTo(Math.round(sec * HZ), tl)
        const x = globePoseAt(tl, sec).x
        const c = centre(e)
        if (c > most) most = c
        if (c < least) least = c
        const way = Math.sign(x - was)
        if (way !== 0 && going !== 0 && way !== going) {
          ends++
          if (Math.sign(e.liquid[LIQUID_LOAD]!) === -going && (season !== 'winter' || Math.sign(c) === -going)) against++
        }
        if (way !== 0) going = way
        was = x
      }
      expect(ends).toBeGreaterThanOrEqual(3)
      expect(against).toBeGreaterThanOrEqual(ends - 1)
      expect(most - least).toBeGreaterThan(LIQUID_R * (season === 'winter' ? 0.45 : 0.2))
    }, 120000)
  }

  it('has thrown nothing by the time the globe has stood for the rest', () => {
    const tl = stillTimeline('winter')
    const e = new ParticleEngine({ season: 'winter', fraction: 0.05, collider })
    e.reset('winter')
    e.advanceTo(Math.round((barSeconds + config.states.restSeconds) * HZ), tl)
    expect(e.liquid[LIQUID_LOAD]).toBe(0)
    expect(e.liquid[LIQUID_LOAD + 1]).toBe(0)
    expect(e.liquid[LIQUID_LOAD + 2]).toBe(0)
  }, 120000)
})
