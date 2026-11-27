import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import * as THREE from 'three'
import { LIGHT_FRAG, LIGHT_FRAG_PARS, floodCore, lightUniforms } from '../src/core/chunks/light'
import { VEIL_GLSL, VEIL_LOOK, updateVeil, veilUniforms } from '../src/core/chunks/veil'
import type { Moment } from '../src/core/stage'
import { newFrame, withVeilLeft } from '../src/scene/frame'
import { centreHeightMm, innerRadiusMm } from '../src/scene/layout'
import { CHANGE_BLOOM, Lighting, ROOM_RIG, changeSwell } from '../src/scene/lighting'
import { glowOf } from '../src/scene/lightgrid'
import { kitOf } from '../src/seasons'
import { CHANGE_COVER, changeSpan, coverShown, partChange, veilCrossed } from '../src/shake/change'
import { REST_POSE } from '../src/shake/table'

const winter = kitOf('winter')
const WINDOW = config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat
const FRAME = 1 / config.film.fps / (60 / config.film.defaultBpm) / WINDOW
const quality = { particleFraction: 1, shadowMapPx: 256, surfaceReflection: 'none' }
const lum = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

/** The lights at a place in the window. `cover` is how much of the cover of a change stands (`f.mix.bloom`): none, unless a test says. */
function lit(change: number, to = winter, cover = 0) {
  const light = new Lighting(quality.shadowMapPx)
  const f = newFrame(winter, quality)
  f.to = to
  const two = to !== winter
  f.moment = { season: 'winter', from: 'winter', to: two ? 'other' : 'winter', change, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
  f.mix.light = two ? partChange('light', change) : 0
  f.mix.bloom = cover
  f.mix.shown = coverShown(cover)
  light.update(f)
  const u = lightUniforms
  return { flood: lum(u.uLightFlood.value), outside: lum(u.uLightFlood.value) * u.uLightFloodFloor.value.w, gainA: u.uGrid.value.y, gainB: u.uGrid.value.z, pool: lum(f.pool), tint: lum(f.bloomTint), burn: u.uLightBurn.value }
}

describe('the flood of a change', () => {
  const span = changeSpan('shed')
  const mid = (span.from + span.to) / 2
  const rest = lit(0)

  it('is nothing at rest and before and after the window', () => {
    for (const c of [0, 1, -1, 0.02, 0.98]) {
      const at = lit(c)
      expect(at.flood).toBe(0)
      expect(at.outside).toBe(0)
      expect(at.tint).toBe(0)
      expect(at.gainA).toBeCloseTo(rest.gainA, 12)
      expect(at.pool).toBeCloseTo(rest.pool, 12)
    }
  })

  it('rises far above the resting light in a shake of one season, inside and out', () => {
    const top = lit(span.from)
    expect(top.gainA / rest.gainA).toBeCloseTo(1 + ROOM_RIG.bloomGain, 9)
    expect(top.gainA / rest.gainA).toBeGreaterThan(5)
    expect(top.flood).toBeCloseTo(lum({ r: glowOf(winter.innerLights)[0], g: glowOf(winter.innerLights)[1], b: glowOf(winter.innerLights)[2] }) * (top.gainB / (rest.gainB * (1 + ROOM_RIG.bloomGain))), 6)
    expect(top.outside).toBeCloseTo(top.flood * ROOM_RIG.flood.outside, 9)
    expect(top.outside).toBeGreaterThan(20)
    expect(top.pool / rest.pool).toBeGreaterThan(1 + ROOM_RIG.bloomGain)
    expect(top.tint).toBeGreaterThan(0)
  })

  it('is whole on every frame that shows the base half changed', () => {
    let seen = 0
    for (let c = 0; c <= 1; c += FRAME / 8) {
      const v = partChange('base', c)
      if (v <= 0 || v >= 1) continue
      seen++
      expect(changeSwell(c).whole, `flood at ${c}`).toBe(1)
    }
    expect(seen).toBeGreaterThan(16)
    expect(lit(span.from + 1e-6).flood).toBeCloseTo(lit(mid).flood, 9)
    expect(lit(span.to - 1e-6).flood).toBeCloseTo(lit(mid).flood, 9)
  })

  it('is nothing in the first frames of the window and nothing outside it', () => {
    for (const c of [-1, 0, 1, 2, Number.NaN, 0.02, 0.98]) expect(changeSwell(c)).toEqual({ whole: 0, glow: 0 })
    for (let c = 0; c <= 4 * FRAME; c += FRAME / 16) expect(changeSwell(c)).toEqual({ whole: 0, glow: 0 })
  })

  it('swells over a third of a second and falls over every frame the window leaves, never in three', () => {
    for (let phase = 0; phase < 1; phase += 0.125) {
      let before = 0
      let rise = 0
      let fall = 0
      for (let c = phase * FRAME; c <= 1; c += FRAME) {
        const { whole, glow } = changeSwell(c)
        expect(glow).toBeLessThanOrEqual(whole)
        if (c <= span.from) {
          expect(glow, `rise at ${c}`).toBeGreaterThanOrEqual(before)
          expect(glow - before, `step up at ${c}`).toBeLessThan(0.08)
          if (glow > 0 && glow < 1) rise++
        } else {
          if (c - FRAME > span.from) expect(glow, `fall at ${c}`).toBeLessThanOrEqual(before)
          expect(Math.abs(before - glow), `step down at ${c}`).toBeLessThan(0.22)
          if (glow > 0 && glow < 1) fall++
        }
        if (c >= span.from && c <= span.to) expect(whole).toBe(1)
        if (c >= span.from && c <= span.to) expect(((1 + ROOM_RIG.bloomGain) ** glow - 1) / ROOM_RIG.bloomGain, `the light through the base's change at ${c}`).toBeGreaterThan(0.4)
        before = glow
      }
      expect(rise).toBeGreaterThanOrEqual(19)
      expect(fall).toBeGreaterThanOrEqual(10)
    }
  })

  it('swells onto the base with the lights inside, so no frame of it is a jump', () => {
    const top = lit(span.from).outside
    const tint = lit(span.from).tint
    for (let phase = 0; phase < 1; phase += 0.25) {
      let before = 0
      let rise = 0
      let fall = 0
      for (let c = phase * FRAME; c < 1; c += FRAME) {
        const at = lit(c)
        const v = at.outside / top
        expect(v, `the base follows the lights inside at ${c}`).toBeCloseTo((at.gainA / rest.gainA - 1) / ROOM_RIG.bloomGain, 9)
        expect(at.tint / tint).toBeCloseTo(v, 9)
        if (c <= span.from) {
          expect(v).toBeGreaterThanOrEqual(before)
          expect(v - before, `step up at ${c}`).toBeLessThan(0.1)
          if (v > 0.02 && v < 0.98) rise++
        } else {
          if (c - FRAME > span.from) expect(v).toBeLessThanOrEqual(before)
          expect(Math.abs(before - v), `step down at ${c}`).toBeLessThan(0.16)
          if (v > 0.02 && v < 0.98) fall++
        }
        before = v
      }
      expect(before, 'the last frame of the window').toBeLessThan(0.001)
      expect(rise).toBeGreaterThanOrEqual(14)
      expect(fall).toBeGreaterThanOrEqual(8)
    }
    expect(lit(span.from - 2 * FRAME).outside / top).toBeGreaterThan(0.9)
    expect(lit(mid).outside / top).toBeGreaterThan(0.8)
    expect(lit(span.to).outside / top).toBeGreaterThan(0.4)
  })

  it('swells neither season where two seasons meet: their lights are held at rest, and through the fall of the exposure where the cover stands', () => {
    const other = kitOf('spring')
    const top = lit(span.from, other)
    const low = lit(0.02, other)
    expect(top.gainA).toBeCloseTo(low.gainA, 12)
    expect(top.gainB).toBeCloseTo(low.gainB, 12)
    expect(top.burn).toBe(1)
    expect(top.flood).toBeGreaterThan(0)
    // Under the cover the exposure falls to `dim` of itself by the cover as an exponent, and the lights of both seasons are
    // drawn that many times over: on the film they stand as they stood at rest, at every part of the cover.
    for (const cover of [0.25, 0.5, 1]) {
      const under = lit(span.from, other, cover)
      const fall = Math.pow(CHANGE_BLOOM.dim, cover)
      expect(under.burn * fall, `held at the cover ${cover}`).toBeCloseTo(1, 12)
      expect(under.gainA * fall, `the season that leaves at the cover ${cover}`).toBeCloseTo(low.gainA, 9)
      expect(under.gainB * fall, `the season that comes at the cover ${cover}`).toBeCloseTo(low.gainB, 9)
    }
    // A shake that keeps its season swells as it did.
    expect(lit(span.from).gainA / rest.gainA).toBeCloseTo(1 + ROOM_RIG.bloomGain, 9)
  })

  it('lays nothing of the swell on the base and the table between two seasons: away from the cover they keep what the lights at rest lay on them', () => {
    const other = kitOf('spring')
    const ga = glowOf(winter.innerLights)
    const gb = glowOf(other.innerLights)
    const still = lit(0, other)
    let top = 0
    for (const c of [span.from, ...Array.from({ length: Math.ceil(2 / FRAME) }, (_, i) => (i * FRAME) / 2)]) {
      const at = lit(c, other)
      expect(at.outside, `the flood on the base at ${c}`).toBe(0)
      const share = partChange('light', c)
      const each = (i: number) => ga[i]! * still.gainA * (1 - share) + gb[i]! * still.gainB * share
      expect(at.pool, `the pool on the table at ${c}`).toBeCloseTo(lum({ r: each(0), g: each(1), b: each(2) }), 9)
      top = Math.max(top, at.gainB / still.gainB, at.gainA / still.gainA)
    }
    expect(top, 'and the lights inside do not swell there either: the cover is their burning').toBeCloseTo(1, 9)
  })

  it('lays no flood outside the glass under the cover of a change: what stands on a base there is the room\'s own light, held, and the pour', () => {
    const other = kitOf('spring')
    const whole = lit(span.from, other, 1)
    const half = lit(span.from, other, 0.5)
    // A flood outside the glass laid the colour of the light over the whole flank of a base: winter's dark carved wood read as
    // terracotta under it, which is no season's base.
    expect(whole.outside).toBe(0)
    expect(half.outside).toBe(0)
    expect(Object.keys(CHANGE_BLOOM)).not.toContain('flood')
    // The colour and the strength of the flood at the heart are the same at every part of the cover: the new season's lights at rest.
    expect(whole.flood).toBeGreaterThan(0)
    expect(half.flood).toBeCloseTo(whole.flood, 12)
  })

  it('reaches the grid inside and the base outside, and is declared once', () => {
    expect(LIGHT_FRAG_PARS).toContain('vec3 stageFlood(vec3 local)')
    expect(LIGHT_FRAG_PARS).toMatch(/vec3 stageGrid\(vec3 local\) \{[^}]*stageFlood\(local\)/)
    const outside = LIGHT_FRAG.slice(LIGHT_FRAG.indexOf('#else'), LIGHT_FRAG.indexOf('float lgNdk'))
    expect(outside).toContain('uLightFlood')
    expect(outside).toContain('reflectedLight.indirectDiffuse += lgFlood')
    for (const n of ['uLightFlood', 'uLightFloodAt', 'uLightFloodFloor', 'uLightFloodNear']) expect(Object.keys(lightUniforms)).toContain(n)
  })
})

describe('the source of the flood inside the glass', () => {
  it('is measured from the line of sight through the lights, wide and low, so no ball stands in the storm and the rim keeps its own light', () => {
    const flood = LIGHT_FRAG_PARS.slice(LIGHT_FRAG_PARS.indexOf('vec3 stageFlood(vec3 local)'), LIGHT_FRAG_PARS.indexOf('vec3 stageGridAir'))
    expect(flood).toContain('float along = dot(d, normalize(local - uLightEye));')
    expect(flood).toContain('float q = 1.0 + max(dot(d, d) - along * along, 0.0) / (uLightFloodAt.w * uLightFloodAt.w);')
    expect(flood).toContain('return uLightFlood * (uLightFloodAt.z / (q * sqrt(q)));')
    const reach = ROOM_RIG.flood.insideMm
    const level = (mm: number) => ROOM_RIG.flood.inside * floodCore(mm, reach)
    expect(floodCore(0, reach)).toBe(1)
    expect(floodCore(reach, reach)).toBeCloseTo(2 ** -1.5, 12)
    // The halo is held to the light it had under the core of 1.5 (0.04 and 0.004 of it); the middle is held to the halo.
    expect(level(innerRadiusMm * 0.45)).toBeLessThan(0.04 * 1.5)
    expect(level(innerRadiusMm * 0.95)).toBeLessThan(0.004 * 1.5)
    expect(level(innerRadiusMm * 0.45), 'the halo still reaches the storm').toBeGreaterThan(0.02)
    expect(level(0), 'the middle is no ball of white').toBeLessThan(0.2)
    expect(level(0) / level(innerRadiusMm * 0.45), 'the middle against the halo').toBeLessThan(6)
    let before = 1
    for (let mm = 1; mm <= innerRadiusMm; mm++) {
      const v = floodCore(mm, reach)
      expect(v).toBeLessThan(before)
      before = v
    }
    expect(Object.keys(lightUniforms)).toContain('uLightEye')
  })

  it('takes the eye into the frame of the globe, moved and tilted with it', () => {
    const light = new Lighting(quality.shadowMapPx)
    const f = newFrame(winter, quality)
    f.moment = { season: 'winter', from: 'winter', to: 'winter', change: 0.5, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
    f.pose = { position: new THREE.Vector3(30, centreHeightMm + 12, 400), aim: new THREE.Vector3(), fovDeg: 30, focusMm: 400, apertureMm: 2 }
    light.update(f)
    const eye = lightUniforms.uLightEye.value
    expect(eye.x).toBeCloseTo(30, 9)
    expect(eye.y).toBeCloseTo(12, 9)
    expect(eye.z).toBeCloseTo(400, 9)
    f.globe = { x: 5, y: 20, z: -8, tiltX: 0.3, tiltZ: -0.2 }
    light.update(f)
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.3, 0, -0.2))
    const back = new THREE.Vector3(eye.x, eye.y + centreHeightMm, eye.z).applyMatrix4(turn).add(new THREE.Vector3(5, 20, -8))
    expect(back.x).toBeCloseTo(30, 6)
    expect(back.y).toBeCloseTo(centreHeightMm + 12, 6)
    expect(back.z).toBeCloseTo(400, 6)
  })
})

describe('the shadow map on a face turned from the key', () => {
  it('asks the face itself, not only the shading normal', () => {
    expect(LIGHT_FRAG).toContain('cross(dFdx(vStageLocal), dFdy(vStageLocal))')
    expect(LIGHT_FRAG).toMatch(/lgFacing = min\(lgFacing, dot\(lgFace \* uLightFrame, uRigKeyDir\)\)/)
    expect(LIGHT_FRAG).toMatch(/float lgSure = receiveShadow \? smoothstep\(uRigGlow\.z, uRigGlow\.w, lgFacing\) : 0\.0;/)
  })
})

describe('the veil of a season that has left', () => {
  // The shared veil as stage.ts lays it at a place in the window and past its end: inside the window from the old season to
  // the new; from the end of the window the season that came stands alone and the frame names the one it left. The liquid
  // is at its wildest, so the flood's bank is whole and its density is the veil's alone.
  const seasons = ['winter', 'spring', 'summer', 'fall'] as const
  const lay = (place: number, from: string, to: string) => {
    const after = place >= 1
    const f = newFrame(kitOf(after ? to : from), quality)
    f.to = kitOf(to)
    f.left = after ? kitOf(from) : null
    f.turbulence = 1
    const even = after ? 0 : partChange('veil', place)
    f.mix.veil = (f.left ?? f.from).veil.density >= f.to.veil.density ? veilCrossed(place) : even
    f.moment = { season: after ? to : from, from: after ? to : from, to, change: after ? 0 : place, sinceLanding: Infinity, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null, left: after ? from : null } as Moment
    withVeilLeft(f, updateVeil)
    expect(f.from, 'the frame is put back').toBe(kitOf(after ? to : from))
    return { bank: veilUniforms.uVeilBank.value.z, white: veilUniforms.uVeilWhite.value, tint: veilUniforms.uVeil.value.x }
  }
  const whole = (season: string): number => kitOf(season).veil.density * VEIL_LOOK.bank * VEIL_LOOK.bankFloodGain
  /** The place of a frame of the film, counted from the first frame of the window, at the instant its exposure is taken. */
  const at = (frame: number): number => (frame + 0.25) * FRAME
  const last = Math.round(1 / FRAME) - 1

  it('goes over the end of the window by ratio where the thicker veil leaves: its bank never falls by more than two fifths in a frame', () => {
    for (const [from, to] of [['summer', 'fall'], ['winter', 'spring']] as const) {
      expect(kitOf(from).veil.density, from).toBeGreaterThan(20 * kitOf(to).veil.density)
      // Inside the window, on the last frame of it, the old law had 5 hundredths of the old bank and the frame after had the
      // new season's alone, under a quarter of that: the wash over the foot of the ball that left in one frame.
      const old = (1 - Math.pow(at(last), 2.5)) * whole(from)
      expect(old / whole(to), `${from} into ${to} as it was`).toBeGreaterThan(4)
      let before = lay(at(last - 4), from, to).bank
      let frames = 0
      for (let n = last - 3; n <= last + 14; n++) {
        const bank = lay(at(n), from, to).bank
        expect(bank, `${from} into ${to} on frame ${n}`).toBeLessThanOrEqual(before)
        expect(bank, `${from} into ${to} on frame ${n}`).toBeGreaterThanOrEqual(whole(to) * (1 - 1e-12))
        // What is over the new season's own bank loses under two fifths of itself in a frame, until a hundredth of the old bank is left.
        if (before - whole(to) > 0.01 * whole(from)) {
          expect((bank - whole(to)) / (before - whole(to)), `${from} into ${to} on frame ${n}`).toBeGreaterThan(0.6)
          if (n > last) frames += 1
        }
        before = bank
      }
      // It is still thinning eight frames past the end of the window, and it ends on the new season's own bank with the cover's tail.
      expect(frames, `${from} into ${to}`).toBeGreaterThanOrEqual(8)
      expect(lay(CHANGE_COVER.tailTo, from, to).bank).toBeCloseTo(whole(to), 12)
      expect(lay(CHANGE_COVER.tailTo + FRAME, from, to).bank).toBeCloseTo(whole(to), 12)
      // The tint and the white of the bank go on crossing with it: no step in either over the end of the window.
      const inside = lay(at(last), from, to)
      const past = lay(at(last + 1), from, to)
      const far = lay(CHANGE_COVER.tailTo + FRAME, from, to)
      expect(Math.abs(past.white - inside.white)).toBeLessThanOrEqual(0.05 * Math.abs(lay(0, from, to).white - far.white) + 1e-12)
      expect(Math.abs(past.tint - inside.tint)).toBeLessThanOrEqual(0.05 * Math.abs(lay(0, from, to).tint - far.tint) + 1e-12)
    }
  })

  it('is the veil of the season that came alone where that one is the thicker, and wherever no season was left', () => {
    for (const [from, to] of [['spring', 'summer'], ['fall', 'winter']] as const) {
      expect(kitOf(to).veil.density).toBeGreaterThan(kitOf(from).veil.density)
      // Inside the window it crosses evenly, and it is whole when the window ends.
      expect(lay(0.5, from, to).bank).toBeCloseTo((whole(from) + whole(to)) / 2, 12)
      for (const n of [last + 1, last + 2, last + 8]) expect(lay(at(n), from, to).bank, `${from} into ${to} on frame ${n}`).toBe(whole(to))
    }
    for (const season of seasons) {
      const f = newFrame(kitOf(season), quality)
      f.turbulence = 1
      f.moment = { season, from: season, to: season, change: 0, sinceLanding: Infinity, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null, left: null } as Moment
      // A veil number between 0 and 1 with no season left behind lays nothing else: the frame stands as it is.
      f.mix.veil = 0.5
      const seen: unknown[] = []
      withVeilLeft(f, (g) => seen.push(g.from))
      expect(seen).toEqual([kitOf(season)])
      // Nor does a season left behind while the veil number is at either end.
      f.left = kitOf(seasons[(seasons.indexOf(season) + 3) % 4]!)
      for (const veil of [0, 1]) {
        f.mix.veil = veil
        withVeilLeft(f, (g) => seen.push(g.from))
      }
      expect(seen).toEqual([kitOf(season), kitOf(season), kitOf(season)])
      f.mix.veil = 0.5
      withVeilLeft(f, (g) => seen.push(g.from))
      expect(seen[3]).toBe(f.left)
      expect(f.from).toBe(kitOf(season))
    }
  })
})

describe("the white of the flood's bank", () => {
  // The bank of a flood is its season's veil tint turned toward white by a share: the tint at 0, white at 1, and past 1 the
  // opposite of the tint. The shared share was made for snow, whose blue it turns to a warm white.
  const bank = (tint: readonly number[], share: number) => tint.map((c) => c * (1 - share) + share)
  const white = (from: string, to: string, veil: number) => {
    const f = newFrame(kitOf(from), quality)
    f.to = kitOf(to)
    f.mix.veil = veil
    f.moment = { season: from, from, to, change: veil, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
    updateVeil(f)
    return veilUniforms.uVeilWhite.value
  }

  it('is the shared share for a season that gives none, so winter, spring and fall are drawn as they were', () => {
    expect(VEIL_LOOK.bankWhite).toBe(2.2)
    for (const season of ['winter', 'spring', 'fall']) {
      expect(kitOf(season).veil.bankWhite, season).toBeUndefined()
      expect(white(season, season, 0), season).toBe(VEIL_LOOK.bankWhite)
    }
  })

  it("is summer's own and short of white: its gold turned past white was a sky blue", () => {
    const summer = kitOf('summer').veil
    const own = summer.bankWhite as number
    expect(own).toBeGreaterThanOrEqual(0)
    expect(own).toBeLessThan(1)
    expect(white('summer', 'summer', 0)).toBe(own)
    const [r, g, b] = bank(summer.tint, own) as [number, number, number]
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    const [pr, pg, pb] = bank(summer.tint, VEIL_LOOK.bankWhite) as [number, number, number]
    expect(pb, 'the shared share on gold').toBeGreaterThan(pg)
    expect(pg).toBeGreaterThan(pr)
  })

  it('crosses with the tint where two seasons meet', () => {
    const own = kitOf('summer').veil.bankWhite as number
    const shared = VEIL_LOOK.bankWhite
    expect(white('spring', 'summer', 0)).toBe(shared)
    expect(white('spring', 'summer', 1)).toBeCloseTo(own, 12)
    expect(white('spring', 'summer', 0.25)).toBeCloseTo(shared + (own - shared) * 0.25, 12)
    expect(white('summer', 'fall', 0.5)).toBeCloseTo((own + shared) / 2, 12)
    expect(white('summer', 'fall', 1)).toBeCloseTo(shared, 12)
  })

  it('reaches the shader as one uniform, read where the flood rolls the bank and nowhere else', () => {
    expect(VEIL_GLSL.match(/uniform float uVeilWhite;/g)).toHaveLength(1)
    expect(VEIL_GLSL.match(/uVeilWhite/g)).toHaveLength(2)
    expect(VEIL_GLSL).toContain('uVeilWhite, uVeilRoll.y) * low)')
  })
})
