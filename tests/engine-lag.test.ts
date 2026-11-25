import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { barSeconds, globePoseAt, stillTimeline } from '../src/film/timeline'
import { Liquid, LIQUID_LOAD, LIQUID_R, LOAD_MAX_MM } from '../src/globe/liquid'
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
      expect(most - least).toBeGreaterThan(LIQUID_R * (season === 'winter' ? 0.45 : season === 'summer' ? 0.18 : 0.2))
    }, 120000)
  }

  it('throws at the pace the load moves, so that what a stroke threw has come back when the load has died', () => {
    const tl = stillTimeline('winter')
    const liquid = new Liquid()
    const DT = 1 / HZ
    const gone = [0, 0, 0]
    let far = 0
    let fastest = 0
    const end = Math.round((barSeconds + 6) * HZ)
    const landed = Math.round((barSeconds + config.states.landedSeconds) * HZ)
    let atLanded = 0
    for (let n = 0; n < end; n++) {
      const t = n * DT
      liquid.step(globePoseAt(tl, t - DT), globePoseAt(tl, t), globePoseAt(tl, t + DT), t)
      for (let a = 0; a < 3; a++) gone[a] = gone[a]! + liquid.carry[a]! * DT
      const out = Math.hypot(gone[0]!, gone[1]!, gone[2]!)
      if (out > far) far = out
      const pace = Math.hypot(liquid.carry[0]!, liquid.carry[1]!, liquid.carry[2]!)
      if (pace > fastest) fastest = pace
      for (let a = 0; a < 3; a++) expect(Math.abs(gone[a]! - liquid.state[LIQUID_LOAD + a]!)).toBeLessThan(1e-6)
      if (n === landed) atLanded = out
    }
    expect(far).toBeGreaterThan(LOAD_MAX_MM * 0.5)
    expect(far).toBeLessThanOrEqual(LOAD_MAX_MM + 1e-6)
    expect(fastest).toBeGreaterThan(60)
    expect(atLanded).toBeLessThan(LOAD_MAX_MM * 0.1)
    expect(Math.hypot(gone[0]!, gone[1]!, gone[2]!)).toBeLessThan(1e-3)
  })

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
