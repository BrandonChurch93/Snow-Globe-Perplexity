import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import type { Moment } from '../src/core/stage'
import { lensState } from '../src/post/grade'
import { newFrame } from '../src/scene/frame'
import { CHANGE_BLOOM, Lighting } from '../src/scene/lighting'
import { kitOf } from '../src/seasons'
import { CHANGE_CUT, changeBloom, partChange } from '../src/shake/change'
import { REST_POSE } from '../src/shake/table'

const winter = kitOf('winter')
const spring = kitOf('spring')
const WINDOW = config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat
const FRAME = 1 / config.film.fps / (60 / config.film.defaultBpm) / WINDOW
const quality = { particleFraction: 1, shadowMapPx: 256, surfaceReflection: 'none' }

function glare(change: number, to = spring): number {
  const light = new Lighting(quality.shadowMapPx)
  const f = newFrame(winter, quality)
  f.to = to
  const two = to !== winter
  f.moment = { season: 'winter', from: 'winter', to: two ? 'spring' : 'winter', change, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
  f.mix.light = two ? partChange('light', change) : 0
  f.mix.bloom = changeBloom(change)
  light.update(f)
  return Math.max(lensState.glare.r, lensState.glare.g, lensState.glare.b)
}

describe('the glare of a change in the lens', () => {
  it('is black through a shake of one season', () => {
    for (let c = 0; c <= 1; c += FRAME / 2) expect(glare(c, winter)).toBe(0)
  })

  it('is black away from the cut between two seasons', () => {
    for (const c of [0, 1, CHANGE_CUT.at - 7 * FRAME, CHANGE_CUT.at + 7 * FRAME]) expect(glare(c)).toBe(0)
  })

  it('rises to the cut and falls from it, one top and no second', () => {
    const series: number[] = []
    for (let k = -7; k <= 7; k++) series.push(glare(CHANGE_CUT.at + k * FRAME))
    expect(series[7]).toBeCloseTo(CHANGE_BLOOM.glare, 9)
    for (let k = 1; k <= 7; k++) expect(series[k]!).toBeGreaterThanOrEqual(series[k - 1]!)
    for (let k = 8; k <= 14; k++) expect(series[k]!).toBeLessThanOrEqual(series[k - 1]!)
    expect(series[4]!).toBeGreaterThan(0)
    expect(series[10]!).toBeGreaterThan(0)
  })

  it('lies over the seat of the glass and leaves the room behind the glass dark', () => {
    expect(CHANGE_BLOOM.glareSeat).toBeGreaterThan(0.5)
    expect(CHANGE_BLOOM.glareSeat).toBeLessThanOrEqual(1)
    // post.ts: the glare falls off as (1 + d * d) to the power of -2.5, d the distance from the seat in reaches.
    const share = (radii: number): number => Math.pow(1 + (radii / CHANGE_BLOOM.glareReach) ** 2, -2.5)
    const r = config.globe.sphereDiameterMm / 2
    const seat = (CHANGE_BLOOM.glareSeat * (r - config.globe.collarDepthMm)) / r
    expect(share(config.globe.baseHeightMm / r), 'the foot of the base is still under it').toBeGreaterThan(0.4)
    expect(share(seat + 1), 'the top of the glass has almost none').toBeLessThan(0.06)
    expect(share(2), 'nor the room two radii to the side').toBeLessThan(0.03)
  })
})
