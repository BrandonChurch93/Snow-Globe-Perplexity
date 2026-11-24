import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { LIGHT_FRAG, LIGHT_FRAG_PARS, lightUniforms } from '../src/core/chunks/light'
import type { Moment } from '../src/core/stage'
import { newFrame } from '../src/scene/frame'
import { Lighting, ROOM_RIG } from '../src/scene/lighting'
import { glowOf } from '../src/scene/lightgrid'
import { kitOf } from '../src/seasons'
import { changeBloom, changeSpan, partChange } from '../src/shake/change'
import { REST_POSE } from '../src/shake/table'

const winter = kitOf('winter')
const WINDOW = config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat
const FRAME = 1 / config.film.fps / (60 / config.film.defaultBpm) / WINDOW
const quality = { particleFraction: 1, shadowMapPx: 256, surfaceReflection: 'none' }
const lum = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

function lit(change: number, to = winter) {
  const light = new Lighting(quality.shadowMapPx)
  const f = newFrame(winter, quality)
  f.to = to
  const two = to !== winter
  f.moment = { season: 'winter', from: 'winter', to: two ? 'other' : 'winter', change, sinceLanding: 0, globe: REST_POSE, mix: 0, seed: 1, time: 0, beat: null, period: null } as Moment
  f.mix.bloom = two ? changeBloom(change) : 0
  f.mix.light = two ? partChange('light', change) : 0
  light.update(f)
  const u = lightUniforms
  return { flood: lum(u.uLightFlood.value), outside: lum(u.uLightFlood.value) * u.uLightFloodFloor.value.w, gainA: u.uGrid.value.y, gainB: u.uGrid.value.z, pool: lum(f.pool), tint: lum(f.bloomTint) }
}

describe('the flood of a change', () => {
  const span = changeSpan('base')
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
    const top = lit(mid)
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
      expect(changeBloom(c), `bloom at ${c}`).toBe(1)
    }
    expect(seen).toBeGreaterThan(16)
    expect(lit(span.from + 1e-6).flood).toBeCloseTo(lit(mid).flood, 9)
    expect(lit(span.to - 1e-6).flood).toBeCloseTo(lit(mid).flood, 9)
  })

  it('rises and falls over frames, never in one', () => {
    for (let phase = 0; phase < 1; phase += 0.125) {
      let before = 0
      let rise = 0
      for (let c = phase * FRAME; c <= 1; c += FRAME) {
        const v = changeBloom(c)
        if (v > 0 && v < 1) rise++
        expect(Math.abs(v - before), `step at ${c}`).toBeLessThan(0.4)
        before = v
      }
      expect(rise).toBeGreaterThanOrEqual(6)
    }
  })

  it('eases onto the base, so its first frame is a small share of its last', () => {
    const top = lit(mid).outside
    let before = 0
    for (let c = span.from - 0.2; c <= mid; c += FRAME) {
      const v = lit(c).outside / top
      expect(v).toBeGreaterThanOrEqual(before)
      expect(v - before, `step at ${c}`).toBeLessThan(0.6)
      if (changeBloom(c) > 0 && changeBloom(c) < 0.2) expect(v).toBeLessThan(0.02)
      before = v
    }
    expect(before).toBeCloseTo(1, 9)
  })

  it('lifts only the new season where two seasons meet', () => {
    const other = kitOf('spring')
    const top = lit(mid, other)
    const low = lit(0.02, other)
    expect(top.gainA).toBeCloseTo(low.gainA, 12)
    expect(top.gainB / low.gainB).toBeCloseTo(1 + ROOM_RIG.bloomGain, 9)
    expect(top.flood).toBeGreaterThan(0)
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

describe('the shadow map on a face turned from the key', () => {
  it('asks the face itself, not only the shading normal', () => {
    expect(LIGHT_FRAG).toContain('cross(dFdx(vStageLocal), dFdy(vStageLocal))')
    expect(LIGHT_FRAG).toMatch(/lgFacing = min\(lgFacing, dot\(lgFace \* uLightFrame, uRigKeyDir\)\)/)
    expect(LIGHT_FRAG).toMatch(/float lgSure = receiveShadow \? smoothstep\(uRigGlow\.z, uRigGlow\.w, lgFacing\) : 0\.0;/)
  })
})
