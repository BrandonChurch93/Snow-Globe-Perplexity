import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import type { Moment } from '../src/core/stage'
import { lensState } from '../src/post/grade'
import { lensFall } from '../src/post/post'
import { newFrame } from '../src/scene/frame'
import { lightUniforms } from '../src/core/chunks/light'
import { CHANGE_BLOOM, Lighting } from '../src/scene/lighting'
import { kitOf } from '../src/seasons'
import { CHANGE_COVER, changeBloom, changeSpan, partChange } from '../src/shake/change'
import { REST_POSE } from '../src/shake/table'

const winter = kitOf('winter')
const spring = kitOf('spring')
const WINDOW = config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat
const FRAME = 1 / config.film.fps / (60 / config.film.defaultBpm) / WINDOW
const quality = { particleFraction: 1, shadowMapPx: 256, surfaceReflection: 'none' }

interface Cover {
  glare: number
  dim: number
  inside: number
}

function cover(change: number, to = spring, live = false): Cover {
  const light = new Lighting(quality.shadowMapPx)
  const f = newFrame(winter, quality)
  f.to = to
  const two = to !== winter
  f.moment = { season: 'winter', from: 'winter', to: two ? 'spring' : 'winter', change, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
  f.mix.light = two ? partChange('light', change) : 0
  f.mix.base = two ? partChange('base', change) : 0
  f.mix.bloom = changeBloom(change)
  f.live = live
  light.update(f)
  return { glare: Math.max(lensState.glare.r, lensState.glare.g, lensState.glare.b), dim: lensFall.dim, inside: lightUniforms.uGrid.value.z }
}

describe('the cover of a change in the lens', () => {
  const span = changeSpan('base')

  it('is nothing through a shake of one season', () => {
    for (let c = 0; c <= 1; c += FRAME / 2) expect(cover(c, winter)).toMatchObject({ glare: 0, dim: 1 })
  })

  it('is nothing away from the change between two seasons', () => {
    for (const c of [0, 1, CHANGE_COVER.riseFrom, CHANGE_COVER.riseFrom - FRAME, CHANGE_COVER.goneAt, CHANGE_COVER.goneAt + FRAME / 2]) expect(cover(c)).toMatchObject({ glare: 0, dim: 1 })
  })

  it('rises, stands whole on every instant of the span and falls, one top and no second', () => {
    const series: Cover[] = []
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.goneAt; c += FRAME / 4) series.push({ ...cover(c), inside: c })
    let top = 0
    for (let i = 1; i < series.length; i++) {
      const at = series[i]!
      const before = series[i - 1]!
      if (at.inside <= CHANGE_COVER.fullFrom) {
        expect(at.glare).toBeGreaterThanOrEqual(before.glare)
        expect(at.dim).toBeLessThanOrEqual(before.dim)
      } else if (at.inside > CHANGE_COVER.fullTo + FRAME / 4) {
        expect(at.glare).toBeLessThanOrEqual(before.glare)
        expect(at.dim).toBeGreaterThanOrEqual(before.dim)
      }
      if (at.inside >= span.from && at.inside <= span.to) {
        expect(at.glare).toBeCloseTo(CHANGE_BLOOM.glare, 9)
        expect(at.dim).toBeCloseTo(CHANGE_BLOOM.dim, 9)
        top++
      }
      // No frame of it is a step: the exposure moves by under a stop and a half from one frame to the next.
      expect(Math.abs(Math.log2(at.dim / before.dim)) * 4, `stops a frame at ${at.inside}`).toBeLessThan(1.5)
    }
    expect(top).toBeGreaterThanOrEqual(8)
  })

  it('lets the room fall to a near silhouette while the lights inside rise by as much, so the glass burns as it did', () => {
    // The brightest lamp of a backdrop is about twice the white of the film: under a fiftieth of the exposure it is in the toe of
    // the film's curve, where a lamp of one season and of the next are the same dark.
    expect(CHANGE_BLOOM.dim).toBeGreaterThan(0.002)
    expect(CHANGE_BLOOM.dim).toBeLessThanOrEqual(0.01)
    const mid = (span.from + span.to) / 2
    const still = cover(0).inside
    const light = new Lighting(quality.shadowMapPx)
    const f = newFrame(winter, quality)
    f.to = spring
    f.moment = { season: 'winter', from: 'winter', to: 'spring', change: mid, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
    f.mix.light = partChange('light', mid)
    f.mix.bloom = 0
    light.update(f)
    const swollen = lightUniforms.uGrid.value.z
    const pool = f.pool.r
    f.mix.bloom = changeBloom(mid)
    light.update(f)
    // The swell of the shake is not laid on top of the flare: through the fallen exposure the lights inside are their resting selves.
    expect(swollen).toBeGreaterThan(5 * still)
    expect(lightUniforms.uGrid.value.z * lensFall.dim).toBeCloseTo(still, 6)
    // What the lights inside lay on the table does not rise with them: the table falls with the room.
    expect(f.pool.r * lensFall.dim).toBeLessThan(pool)
  })

  it('is the same in the live picture as in the film', () => {
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.goneAt; c += FRAME / 2) {
      const film = cover(c)
      const live = cover(c, spring, true)
      expect(live.glare).toBe(film.glare)
      expect(live.dim).toBe(film.dim)
    }
    for (let c = 0; c <= 1; c += FRAME / 2) expect(cover(c, winter, true)).toMatchObject({ glare: 0, dim: 1 })
  })

  it('is centred in the glass, lies over the base and leaves the sides of the picture dark', () => {
    expect(CHANGE_BLOOM.glareSeat).toBeGreaterThanOrEqual(0)
    expect(CHANGE_BLOOM.glareSeat).toBeLessThanOrEqual(1)
    // post.ts: the glare falls off as a bell, exp(-d * d), d the distance from its middle in reaches.
    const share = (radii: number): number => Math.exp(-((radii / CHANGE_BLOOM.glareReach) ** 2))
    const r = config.globe.sphereDiameterMm / 2
    const seat = (CHANGE_BLOOM.glareSeat * (r - config.globe.collarDepthMm)) / r
    const foot = (r - config.globe.collarDepthMm + config.globe.baseHeightMm) / r - seat
    expect(seat, 'its middle is inside the glass, above the base').toBeLessThan(0.6)
    // What the room keeps of its own light under the fallen exposure is `dim` of it: over the base the lens lays several times that.
    expect(share(foot) * CHANGE_BLOOM.glare, 'the light the lens lays on the foot of the base').toBeGreaterThan(4 * CHANGE_BLOOM.dim)
    expect(share(Math.hypot(foot, config.globe.baseDiameterMm / (2 * r))) * CHANGE_BLOOM.glare, 'and on the corners of the foot').toBeGreaterThan(2 * CHANGE_BLOOM.dim)
    // The film's picture of a shake is about five and a half radii wide: its sides keep the dark of the room.
    expect(share(2.5) * CHANGE_BLOOM.glare, 'the room two and a half radii to the side has almost none').toBeLessThan(0.02)
    // Its middle burns out, as a lamp looked into does, and it is under the white of the film by the edge of the glass: the
    // light has a source, and the white is never wider than the glass.
    expect(CHANGE_BLOOM.glare, 'the middle burns').toBeGreaterThanOrEqual(2)
    expect(share(1) * CHANGE_BLOOM.glare, 'the edge of the glass does not').toBeLessThan(1)
  })
})
