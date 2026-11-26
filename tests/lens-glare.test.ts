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
  halo: number
  veil: number
  dim: number
  inside: number
}

const most = (c: { r: number; g: number; b: number }): number => Math.max(c.r, c.g, c.b)

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
  return { glare: most(lensState.glare), halo: most(lensFall.halo), veil: most(lensFall.veil), dim: lensFall.dim, inside: lightUniforms.uGrid.value.z }
}

/** What lies on the table from the lights inside at a place in the window: as the lights at rest lay it, and as the picture shows it under the cover. */
function table(change: number): { rest: number; shown: number } {
  const light = new Lighting(quality.shadowMapPx)
  const f = newFrame(winter, quality)
  f.to = spring
  f.moment = { season: 'winter', from: 'winter', to: 'spring', change, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
  f.mix.light = partChange('light', change)
  f.mix.bloom = 0
  light.update(f)
  const rest = f.pool.r
  f.mix.bloom = changeBloom(change)
  light.update(f)
  return { rest, shown: f.pool.r * lensFall.dim }
}

describe('the cover of a change in the lens', () => {
  const span = changeSpan('base')
  const NOTHING = { glare: 0, halo: 0, veil: 0, dim: 1 }

  it('is nothing through a shake of one season', () => {
    for (let c = 0; c <= 1; c += FRAME / 2) expect(cover(c, winter)).toMatchObject(NOTHING)
  })

  it('is nothing away from the change between two seasons', () => {
    for (const c of [0, 1, CHANGE_COVER.riseFrom, CHANGE_COVER.riseFrom - FRAME, CHANGE_COVER.goneAt, CHANGE_COVER.goneAt + FRAME / 2]) expect(cover(c)).toMatchObject(NOTHING)
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
        expect(at.halo).toBeGreaterThanOrEqual(before.halo)
        expect(at.veil).toBeGreaterThanOrEqual(before.veil)
        expect(at.dim).toBeLessThanOrEqual(before.dim)
      } else if (at.inside > CHANGE_COVER.fullTo + FRAME / 4) {
        expect(at.glare).toBeLessThanOrEqual(before.glare)
        expect(at.halo).toBeLessThanOrEqual(before.halo)
        expect(at.veil).toBeLessThanOrEqual(before.veil)
        expect(at.dim).toBeGreaterThanOrEqual(before.dim)
      }
      if (at.inside >= span.from && at.inside <= span.to) {
        expect(at.glare).toBeCloseTo(CHANGE_BLOOM.glare + CHANGE_BLOOM.flashGlare, 9)
        expect(at.halo).toBeCloseTo(CHANGE_BLOOM.halo, 9)
        expect(at.veil).toBeCloseTo(CHANGE_BLOOM.veil + CHANGE_BLOOM.flashVeil, 9)
        expect(at.dim).toBeCloseTo(CHANGE_BLOOM.dim, 9)
        top++
      }
      // No frame of it is a step: the exposure moves by under a stop and a half from one frame to the next.
      expect(Math.abs(Math.log2(at.dim / before.dim)) * 4, `stops a frame at ${at.inside}`).toBeLessThan(1.5)
    }
    expect(top).toBeGreaterThanOrEqual(8)
  })

  it('lets what the room lights fall to a near silhouette while the lights inside rise by as much, so the glass burns as it did', () => {
    // What the lamps of the room light (the side of the base, what lies far out on the table) falls into the toe of the film's
    // curve, where one season's and the next's are the same dark, and no deeper than the film can hold in its numbers.
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
    f.mix.bloom = changeBloom(mid)
    light.update(f)
    // The swell of the shake is not laid on top of the flare: through the fallen exposure the lights inside are their resting selves.
    expect(swollen).toBeGreaterThan(5 * still)
    expect(lightUniforms.uGrid.value.z * lensFall.dim).toBeCloseTo(still, 6)
  })

  it('pours the light of the glass on the table as the cover rises and falls, and draws it in under the flash', () => {
    let most = 0
    let mostAt = 0
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.goneAt; c += FRAME / 4) {
      const at = table(c)
      // The table never falls with the room as far as the fallen exposure alone would take it: the room is still there.
      expect(at.shown, `the pool on the table at ${c}`).toBeGreaterThanOrEqual(at.rest * Math.min(1, 10 * lensFall.dim))
      if (at.shown / at.rest > most) {
        most = at.shown / at.rest
        mostAt = c
      }
    }
    // It is a pool of light many times what the lights at rest lay there, and it is at its most while the room is still in sight.
    expect(most).toBeGreaterThan(8)
    expect(mostAt < CHANGE_COVER.fullFrom || mostAt > CHANGE_COVER.fullTo).toBe(true)
    // Two frames before the cover is whole and two after it the table is lit several times over.
    for (const c of [CHANGE_COVER.fullFrom - 2 * FRAME, CHANGE_COVER.fullTo + 2 * FRAME]) expect(table(c).shown / table(c).rest, `the pool at ${c}`).toBeGreaterThan(4)
    // On the span itself, where what lies on the table leaves and comes, the lens carries the light (the glare and the halo) and
    // the pool is drawn in under what it is at rest: what lies far out on the table is not lit while it changes.
    for (let c = span.from; c <= span.to; c += FRAME / 4) {
      const at = table(c)
      expect(at.shown / at.rest, `the pool on the span at ${c}`).toBeLessThan(0.5)
      expect(at.shown / at.rest).toBeGreaterThanOrEqual(10 * CHANGE_BLOOM.dim)
    }
    // Away from the cover nothing is poured.
    for (const c of [0.02, CHANGE_COVER.riseFrom - FRAME, CHANGE_COVER.goneAt + FRAME / 2]) expect(table(c).shown).toBe(table(c).rest)
  })

  it('holds everything inside the glass through the fallen exposure: both seasons\' lights and what the room sends in', () => {
    const through = lightUniforms.uRigInside.value
    const rest = cover(0)
    const oldAtRest = lightUniforms.uGrid.value.y
    expect(lightUniforms.uLightBurn.value).toBe(1)
    const room = through.x
    expect(room).toBeGreaterThan(0)
    expect(oldAtRest).toBeGreaterThan(0)
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.goneAt; c += FRAME / 2) {
      const at = cover(c)
      expect(lightUniforms.uLightBurn.value * at.dim, `the burn at ${c}`).toBeCloseTo(1, 9)
      expect(lightUniforms.uGrid.value.y * at.dim, `the old season's lights at ${c}`).toBeCloseTo(oldAtRest, 6)
      expect(through.x * at.dim, `the room's light inside at ${c}`).toBeCloseTo(room, 9)
    }
    expect(rest.dim).toBe(1)
    // A shake of one season has no cover and nothing to hold.
    for (let c = 0; c <= 1; c += FRAME) {
      cover(c, winter)
      expect(lightUniforms.uLightBurn.value).toBe(1)
      expect(through.x).toBe(room)
    }
  })

  it('is the same in the live picture as in the film', () => {
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.goneAt; c += FRAME / 2) {
      const film = cover(c)
      const live = cover(c, spring, true)
      expect(live.glare).toBe(film.glare)
      expect(live.halo).toBe(film.halo)
      expect(live.veil).toBe(film.veil)
      expect(live.dim).toBe(film.dim)
    }
    for (let c = 0; c <= 1; c += FRAME / 2) expect(cover(c, winter, true)).toMatchObject(NOTHING)
  })

  it('sits round the ball more than on it, lies flat over the base under the flash and leaves the corners of the picture to the room', () => {
    expect(CHANGE_BLOOM.glareSeat).toBeGreaterThanOrEqual(0)
    expect(CHANGE_BLOOM.glareSeat).toBeLessThanOrEqual(1)
    // post.ts: the glare is a bell, exp(-d * d), d the distance from its middle in reaches, with `glareHole` of it taken off
    // its middle by a second bell `glareHoleReach` wide. The halo is a bell too, about its own seat: `haloReach` to the sides,
    // `haloUp` upward and `haloDown` downward. Distances here are in radii of the glass, down the axis from its middle.
    const share = (radii: number): number => Math.exp(-((radii / CHANGE_BLOOM.glareReach) ** 2)) * (1 - CHANGE_BLOOM.glareHole * Math.exp(-((radii / CHANGE_BLOOM.glareHoleReach) ** 2)))
    const low = (side: number, up: number): number => Math.exp(-((side / CHANGE_BLOOM.haloReach) ** 2) - (up / (up > 0 ? CHANGE_BLOOM.haloUp : CHANGE_BLOOM.haloDown)) ** 2)
    cover((span.from + span.to) / 2)
    expect(lensFall.glareHole.x).toBe(CHANGE_BLOOM.glareHole)
    expect(lensFall.glareHole.y).toBeCloseTo((CHANGE_BLOOM.glareReach / CHANGE_BLOOM.glareHoleReach) ** 2, 12)
    expect(lensFall.haloFlat.x).toBeCloseTo(CHANGE_BLOOM.haloReach / CHANGE_BLOOM.haloUp, 12)
    expect(lensFall.haloFlat.y).toBeCloseTo(CHANGE_BLOOM.haloReach / CHANGE_BLOOM.haloDown, 12)
    expect(lensFall.veilTight).toBeCloseTo((CHANGE_BLOOM.glareReach / CHANGE_BLOOM.veilReach) ** 2, 12)
    const r = config.globe.sphereDiameterMm / 2
    const collar = (r - config.globe.collarDepthMm) / r
    const seat = CHANGE_BLOOM.glareSeat * collar
    const foot = collar + config.globe.baseHeightMm / r
    const half = config.globe.baseDiameterMm / (2 * r)
    expect(seat, 'its middle is inside the glass, above the base').toBeLessThan(0.6)
    // The glow of the pool sits in the base, between the collar and the foot, and the whole of the base is inside one reach
    // of it each way. It is a flat shape that lies on the table: at least three times as wide as it is tall.
    const haloSeat = CHANGE_BLOOM.haloSeat * collar
    expect(haloSeat).toBeGreaterThanOrEqual(collar)
    expect(haloSeat).toBeLessThanOrEqual(foot)
    expect(half, 'the sides of the base').toBeLessThan(CHANGE_BLOOM.haloReach)
    expect(haloSeat - collar, 'the collar').toBeLessThanOrEqual(CHANGE_BLOOM.haloUp)
    expect(foot - haloSeat, 'the foot').toBeLessThanOrEqual(CHANGE_BLOOM.haloDown)
    expect(CHANGE_BLOOM.haloReach).toBeGreaterThanOrEqual(3 * Math.max(CHANGE_BLOOM.haloUp, CHANGE_BLOOM.haloDown))
    // What the room keeps of its own light under the fallen exposure is `dim` of it. Before the flash the lens lays several times
    // that on the foot of the base, and under the flash, in the frames in which the base turns, tens of times that on every
    // corner of it: the base is in the light of the lens and one season's is the other's.
    expect(share(foot - seat) * CHANGE_BLOOM.glare, 'the light the lens lays on the foot of the base').toBeGreaterThan(4 * CHANGE_BLOOM.dim)
    expect(share(Math.hypot(foot - seat, half)) * CHANGE_BLOOM.glare, 'and on the corners of the foot').toBeGreaterThan(2 * CHANGE_BLOOM.dim)
    expect(low(half, haloSeat - foot) * CHANGE_BLOOM.halo, 'the halo on the corners of the foot under the flash').toBeGreaterThan(30 * CHANGE_BLOOM.dim)
    expect(low(half, haloSeat - collar) * CHANGE_BLOOM.halo, 'and on the corners of the collar').toBeGreaterThan(20 * CHANGE_BLOOM.dim)
    // It leaves the ball alone, and it has fallen off by the front edge of the table as it has above the base: three quarters
    // of a radius under its seat, and as far over it, it is under a tenth of itself.
    expect(low(0, haloSeat - seat), 'the halo on the middle of the ball').toBeLessThan(0.01)
    expect(low(0, -0.75), 'the halo under the foot').toBeLessThan(0.1)
    expect(low(0, 0.75), 'and over the base').toBeLessThan(0.1)
    // The film's picture of a shake is about five and a half radii wide. Its sides keep the room: the glare has almost nothing
    // there, the pool's glow lies out to them thin, and the veil is under what the room's own tone is.
    expect(share(2.5) * (CHANGE_BLOOM.glare + CHANGE_BLOOM.flashGlare), 'the glare two and a half radii to the side has almost none').toBeLessThan(0.02)
    expect(low(2.5, 0) * CHANGE_BLOOM.halo, 'and the halo along the table').toBeLessThan(0.05)
    expect(Math.exp(-((2.75 / CHANGE_BLOOM.veilReach) ** 2)) * (CHANGE_BLOOM.veil + CHANGE_BLOOM.flashVeil), 'the veil at the sides under the flash').toBeLessThan(0.003)
    // The lens lays its glow round what burns more than on it: at the middle of the ball it stays well under the white of
    // the film even under the flash, so the storm's strokes are read through the whole cover, and it is at its most by the
    // edge of the glass, where it is still under half of white.
    const whole = CHANGE_BLOOM.glare + CHANGE_BLOOM.flashGlare
    expect(share(0) * whole, 'the middle of the ball under the flash').toBeLessThan(0.35)
    expect(share(1), 'more round the ball than on its middle').toBeGreaterThan(share(0))
    let most = 0
    for (let d = 0; d <= 3; d += 0.01) most = Math.max(most, share(d))
    expect(most * whole, 'nowhere over half of white').toBeLessThan(0.5)
    expect(CHANGE_BLOOM.glare, 'before the flash it is a glow').toBeGreaterThanOrEqual(0.25)
    expect(share(1) * CHANGE_BLOOM.glare, 'and the edge of the glass keeps its line').toBeLessThan(0.25)
  })

  it('lays the room\'s own tone back under the fallen exposure, in the colour of each season\'s backdrop', () => {
    const mid = (span.from + span.to) / 2
    cover(mid)
    const wa = winter.backdrop.room
    const wb = spring.backdrop.room
    const share = partChange('base', mid)
    // What the fall of the exposure takes from the dark of the backdrop is laid back: the corners of the picture keep their tone.
    for (const [i, k] of (['r', 'g', 'b'] as const).entries()) {
      expect(lensFall.room[k]).toBeCloseTo((wa[i]! + (wb[i]! - wa[i]!) * share) * CHANGE_BLOOM.room * (1 - CHANGE_BLOOM.dim), 12)
    }
    // It is a share of the backdrop's own dark, and over what the film needs to hold a pixel off true black (about 0.002 a
    // channel for a sum of 4) in at least one channel of every season.
    expect(CHANGE_BLOOM.room).toBeGreaterThan(0.5)
    expect(CHANGE_BLOOM.room).toBeLessThanOrEqual(1)
    for (const name of ['winter', 'spring', 'summer', 'fall'] as const) expect(Math.max(...kitOf(name).backdrop.room) * CHANGE_BLOOM.room, name).toBeGreaterThan(0.002)
    // It rises as the exposure falls and is nothing away from the cover and in a shake of one season.
    cover(CHANGE_COVER.riseFrom - FRAME)
    expect(most(lensFall.room)).toBe(0)
    cover(mid, winter)
    expect(most(lensFall.room)).toBe(0)
    let last = 0
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.fullFrom; c += FRAME / 4) {
      cover(c)
      const now = most(lensFall.room) / Math.max(...[0, 1, 2].map((i) => wa[i]! + (wb[i]! - wa[i]!) * partChange('base', c)))
      expect(now).toBeGreaterThanOrEqual(last - 1e-12)
      last = now
    }
  })

  it('lets the lamps of the backdrop fall with the room and never go out', () => {
    // The brightest lamp of a backdrop is about five times the white of the film at rest (measured in the film's frames).
    const lamp = 5.5
    const top = lamp * CHANGE_BLOOM.dim
    // Under the whole cover it is in the toe of the film's curve, where its colour is not read while the lamps of one season
    // give way to the next's, and it is still over the room's own tone laid back at the sides by a share that is seen.
    expect(top).toBeLessThan(0.03)
    for (const name of ['winter', 'spring', 'summer', 'fall'] as const) expect(top, name).toBeGreaterThan(2 * Math.max(...kitOf(name).backdrop.room) * CHANGE_BLOOM.room)
    // Two frames before the cover is whole and two frames after it the lamps are lamps again: several times that.
    const flank = (c: number): number => lamp * Math.pow(CHANGE_BLOOM.dim, changeBloom(c))
    expect(flank(CHANGE_COVER.fullFrom - 2 * FRAME)).toBeGreaterThan(3 * top)
    expect(flank(CHANGE_COVER.fullTo + 2 * FRAME)).toBeGreaterThan(3 * top)
  })
})
