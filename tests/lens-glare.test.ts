import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import type { Moment } from '../src/core/stage'
import { lensState } from '../src/post/grade'
import { lensFall } from '../src/post/post'
import { newFrame } from '../src/scene/frame'
import { lightUniforms } from '../src/core/chunks/light'
import { glowOf } from '../src/scene/lightgrid'
import { CHANGE_BLOOM, Lighting, pourColour } from '../src/scene/lighting'
import { makeSlab, surfaceUniforms, updateSurface } from '../src/scene/surface'
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

/** What the lights inside lay on the table at a place in the window: as the lights at rest lay it, as the picture shows it on the slab under the cover, and as it shows it on what lies on the slab. */
function table(change: number): { rest: number; shown: number; on: number } {
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
  return { rest, shown: f.pool.r * lensFall.dim, on: f.poolOn.r * lensFall.dim }
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

  it('lays less of the pour on what lies on the table than on the slab under it, so what is white there stays under white', () => {
    expect(CHANGE_BLOOM.pourOn).toBeLessThanOrEqual(CHANGE_BLOOM.pour / 4)
    let top = 0
    for (let c = CHANGE_COVER.riseFrom; c <= CHANGE_COVER.goneAt; c += FRAME / 4) {
      const at = table(c)
      // Without the pour both take what the lights at rest lay, drawn in under the flash. Of the pour the frost, the petals
      // and the leaves take `pourOn` where the slab, near black, takes `pour`.
      const drawn = at.rest * Math.pow(CHANGE_BLOOM.flashPour, Math.pow(changeBloom(c), CHANGE_BLOOM.sharp))
      expect(at.on - drawn, `what lies on the table at ${c}`).toBeCloseTo(((at.shown - drawn) * CHANGE_BLOOM.pourOn) / CHANGE_BLOOM.pour, 9)
      expect(at.on).toBeLessThanOrEqual(at.shown)
      top = Math.max(top, at.on / at.rest)
    }
    // At its most that is between one and a half and three times what lies there at rest: lit by the pour, not burnt out by it.
    expect(top).toBeGreaterThan(1.5)
    expect(top).toBeLessThan(3)
    // Away from the cover they take what the slab takes, to the last bit: the pictures at rest are what they were.
    for (const c of [0.02, CHANGE_COVER.riseFrom - FRAME, CHANGE_COVER.goneAt + FRAME / 2]) expect(table(c).on).toBe(table(c).rest)
  })

  it('lays the larger pour on the slab\'s own near black only: its dust and its lumps take the smaller one', () => {
    const frag = (makeSlab().material as THREE.ShaderMaterial).fragmentShader
    // `scatter` is the slab's own colour with the dust and the lumps laid on it, `albedo` the slab's own colour alone. What is
    // poured over and above the smaller pour (`uPour`) lights `albedo`; the dust and the lumps are lit as the frost is.
    expect(frag).toContain('albedo * (uPour * (slabPoolShare * occl))')
    const lit = frag.split('\n').filter((line) => line.includes('scatter') && line.includes('uPour'))
    expect(lit.length).toBe(1)
    expect(lit[0]).toContain('scatter * (direct + (uSky + warm) * occl)')
  })

  it('holds the mirror image of the glass that the slab bakes through the flash: one swell with the cover, never out', () => {
    const names = ['winter', 'spring', 'summer', 'fall'] as const
    const luma = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
    for (let k = 0; k < names.length; k++) {
      const from = names[k]!
      const to = names[(k + 1) % names.length]!
      const name = `${from} to ${to}`
      const light = new Lighting(quality.shadowMapPx)
      const f = newFrame(kitOf(from), quality)
      f.to = kitOf(to)
      /** The image and the pool at a place in the window as the picture shows them, and what both are there with no cover. */
      const at = (change: number): { rest: number[]; image: number[]; pool: number[] } => {
        f.moment = { season: from, from, to, change, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
        f.mix.light = partChange('light', change)
        f.mix.bloom = 0
        light.update(f)
        const rest = f.pool.toArray()
        // With no cover the image is the pool to the last bit: the pictures away from the cover are what they were.
        expect(f.image.toArray(), `${name}, no cover at ${change}`).toEqual(rest)
        f.mix.bloom = changeBloom(change)
        light.update(f)
        return { rest, image: f.image.toArray().map((v) => v * lensFall.dim), pool: f.pool.toArray().map((v) => v * lensFall.dim) }
      }
      const first = at(CHANGE_COVER.riseFrom)
      let before = luma(first.image) / luma(first.rest)
      for (let c = CHANGE_COVER.riseFrom + FRAME / 4; c <= CHANGE_COVER.goneAt; c += FRAME / 4) {
        const now = at(c)
        // It is the glass's own light: in no channel and at no instant of the cover is it under what it is at rest.
        for (let i = 0; i < 3; i++) expect(now.image[i]!, `${name}, channel ${i} at ${c}`).toBeGreaterThanOrEqual(now.rest[i]! * (1 - 1e-12))
        // It rises with the cover and falls with it: one swell, with no dip under the flash.
        const share = luma(now.image) / luma(now.rest)
        if (c <= CHANGE_COVER.fullFrom) expect(share, `${name}, rising at ${c}`).toBeGreaterThanOrEqual(before - 1e-9)
        else if (c > CHANGE_COVER.fullTo + FRAME / 4) expect(share, `${name}, falling at ${c}`).toBeLessThanOrEqual(before + 1e-9)
        before = share
      }
      // Where the cover is whole it is several times its resting self: a glow that burns with the glass and is not burnt out.
      const mid = at((span.from + span.to) / 2)
      expect(luma(mid.image) / luma(mid.rest), name).toBeGreaterThan(4)
      expect(luma(mid.image) / luma(mid.rest), name).toBeLessThan(9)
      // The pool round it is drawn in there, the image is not: on the span it is many times the pool.
      for (let c = span.from; c <= span.to; c += FRAME / 4) {
        const now = at(c)
        expect(luma(now.image), `${name}, on the span at ${c}`).toBeGreaterThan(10 * luma(now.pool))
      }
      // What is added to the lights at rest is the pour's own colour, the arriving season's.
      const pour = pourColour(glowOf(kitOf(to).innerLights), kitOf(to).rig)
      const top = pour.indexOf(Math.max(...pour))
      for (let i = 0; i < 3; i++) expect((mid.image[i]! - mid.rest[i]!) / (mid.image[top]! - mid.rest[top]!), `${name}, channel ${i}`).toBeCloseTo(pour[i]! / pour[top]!, 9)
      // Away from the cover it is the pool.
      for (const c of [0.02, CHANGE_COVER.riseFrom - FRAME, CHANGE_COVER.goneAt + FRAME / 2]) expect(at(c).image, `${name} at ${c}`).toEqual(at(c).rest)
    }
    // Through a shake of one season, swell and all, it is the pool to the last bit.
    const light = new Lighting(quality.shadowMapPx)
    const f = newFrame(winter, quality)
    for (let c = 0; c <= 1; c += FRAME) {
      f.moment = { season: 'winter', from: 'winter', to: 'winter', change: c, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
      f.mix.light = 0
      f.mix.bloom = changeBloom(c)
      light.update(f)
      expect(f.image.toArray(), `one season at ${c}`).toEqual(f.pool.toArray())
    }
  })

  it('reads the image and not the pool where the slab bakes the mirror image of the glass', () => {
    const frag = (makeSlab().material as THREE.ShaderMaterial).fragmentShader
    const near = frag.split('\n').filter((line) => line.includes('vec3 near ='))
    expect(near.length).toBe(1)
    expect(near[0]).toContain('uImage * (')
    expect(near[0]).not.toContain('uPool')
    expect(near[0]).not.toContain('uPour')
    // The base's own image in that line is lit by the room alone, so it falls with the room and shows no base while two cross.
    expect(near[0]).toContain('lit * body')
    const f = newFrame(winter, quality)
    f.image.setRGB(0.25, 0.5, 0.75)
    updateSurface(f)
    expect(surfaceUniforms.uImage.value.toArray()).toEqual([0.25, 0.5, 0.75])
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

  it('gives each change the arriving season\'s own colour of light, near white at the heart of the pool', () => {
    const names = ['winter', 'spring', 'summer', 'fall'] as const
    const mid = (span.from + span.to) / 2
    const shares = (c: readonly number[]): number[] => c.map((v) => v / Math.max(...c))
    const none: number = 0
    const pours = names.map((name) => {
      const kit = kitOf(name)
      const lamps = glowOf(kit.innerLights)
      const pour = pourColour(lamps, kit.rig)
      // It is the colour of the season's own rig, its rim through its key, at the strongest channel of its lamps: the top of
      // the glow stands where the lamps' colour had it. None of it and it is the colour of the lamps.
      const own = shares([0, 1, 2].map((i) => kit.rig.rim.color[i]! * kit.rig.key.color[i]!))
      for (let i = 0; i < 3; i++) expect(shares(pour)[i], `${name}, channel ${i}`).toBeCloseTo(own[i]! + (shares(lamps)[i]! - own[i]!) * (1 - CHANGE_BLOOM.tint), 12)
      expect(Math.max(...pour), name).toBeCloseTo(Math.max(...lamps), 12)
      expect(pourColour(lamps, kit.rig, none as typeof CHANGE_BLOOM.tint)).toEqual([...lamps])
      return shares(pour)
    })
    expect(CHANGE_BLOOM.tint).toBeGreaterThan(0.75)
    expect(CHANGE_BLOOM.tint).toBeLessThanOrEqual(1)
    // Winter's is the one cold light, the other three are warm, and no two changes have one colour: every pair stands a tenth
    // of a channel apart or more. The lamps of winter's and spring's miniatures, which the pour took before, are one colour.
    expect(pours[0]![2], 'winter\'s blue').toBe(1)
    for (const [i, name] of names.entries()) if (i > 0) expect(pours[i]![0], `${name}'s red`).toBe(1)
    const apart = (p: readonly number[], q: readonly number[]): number => Math.max(...[0, 1, 2].map((k) => Math.abs(p[k]! - q[k]!)))
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(apart(pours[i]!, pours[j]!), `${names[i]} and ${names[j]}`).toBeGreaterThan(0.1)
    expect(apart(shares(glowOf(winter.innerLights)), shares(glowOf(spring.innerLights))), 'the lamps of winter and of spring').toBeLessThan(0.05)
    for (const [i, name] of names.entries()) {
      const from = names[(i + 3) % 4]!
      const light = new Lighting(quality.shadowMapPx)
      const f = newFrame(kitOf(from), quality)
      f.to = kitOf(name)
      // Before the flash, as the cover rises: what the slab takes of the pour, over what lies on it, is in that colour.
      for (const c of [CHANGE_COVER.fullFrom - 2 * FRAME, mid]) {
        f.moment = { season: from, from, to: name, change: c, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
        f.mix.light = partChange('light', c)
        f.mix.base = partChange('base', c)
        f.mix.bloom = changeBloom(c)
        light.update(f)
        const slab = shares([f.pool.r - f.poolOn.r, f.pool.g - f.poolOn.g, f.pool.b - f.poolOn.b])
        for (let k = 0; k < 3; k++) expect(slab[k], `the pour into ${name} at ${c}, channel ${k}`).toBeCloseTo(pours[i]![k]!, 9)
      }
      // Under the flash the glare, the veil and the halo are in it too.
      for (const lens of [lensState.glare, lensFall.halo, lensFall.veil]) {
        const now = shares([lens.r, lens.g, lens.b])
        for (let k = 0; k < 3; k++) expect(now[k], `the lens into ${name}, channel ${k}`).toBeCloseTo(pours[i]![k]!, 9)
      }
      // The heart of the halo is whitened: each channel `haloWhite` of the way to the strongest, which stays where it was, so
      // the heart is under white as the halo is, and it is a tighter bell than the halo.
      const halo = [lensFall.halo.r, lensFall.halo.g, lensFall.halo.b]
      const top = Math.max(...halo)
      const heart = [halo[0]! + lensFall.haloCore.x, halo[1]! + lensFall.haloCore.y, halo[2]! + lensFall.haloCore.z]
      for (let k = 0; k < 3; k++) expect(heart[k], `the heart into ${name}, channel ${k}`).toBeCloseTo(halo[k]! + (top - halo[k]!) * CHANGE_BLOOM.haloWhite, 12)
      expect(Math.max(...heart)).toBeCloseTo(top, 12)
      expect(Math.min(...heart) / top, `the heart into ${name} is nearer white than its skirt`).toBeGreaterThan(Math.min(...halo) / top + 0.2)
      expect(Math.min(...heart) / top, 'and under white in a channel').toBeLessThan(0.9)
      expect(lensFall.haloCore.w).toBe(CHANGE_BLOOM.haloCore)
    }
    expect(CHANGE_BLOOM.haloWhite).toBeGreaterThan(0.25)
    expect(CHANGE_BLOOM.haloWhite).toBeLessThanOrEqual(0.75)
    expect(CHANGE_BLOOM.haloCore).toBeGreaterThan(1)
    // The film adds the heart on the halo's own shape, in the same sum.
    const post = readFileSync('src/post/post.ts', 'utf8')
    expect(post).toContain('uHalo * exp(-pool) + uHaloCore.rgb * exp(-pool * uHaloCore.w)')
    // A shake of one season and every place away from the cover have none of it.
    cover(mid, winter)
    expect([lensFall.haloCore.x, lensFall.haloCore.y, lensFall.haloCore.z]).toEqual([0, 0, 0])
    cover(CHANGE_COVER.riseFrom - FRAME)
    expect([lensFall.haloCore.x, lensFall.haloCore.y, lensFall.haloCore.z]).toEqual([0, 0, 0])
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
