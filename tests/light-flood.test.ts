import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import * as THREE from 'three'
import { LIGHT_FRAG, LIGHT_FRAG_PARS, floodCore, lightUniforms } from '../src/core/chunks/light'
import type { Moment } from '../src/core/stage'
import { newFrame } from '../src/scene/frame'
import { centreHeightMm, innerRadiusMm } from '../src/scene/layout'
import { Lighting, ROOM_RIG, changeSwell } from '../src/scene/lighting'
import { glowOf } from '../src/scene/lightgrid'
import { kitOf } from '../src/seasons'
import { changeSpan, partChange } from '../src/shake/change'
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

  it('lifts only the new season where two seasons meet', () => {
    const other = kitOf('spring')
    const top = lit(span.from, other)
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

describe('the source of the flood inside the glass', () => {
  it('is measured from the line of sight, so it has a core and the rim keeps its own light', () => {
    const flood = LIGHT_FRAG_PARS.slice(LIGHT_FRAG_PARS.indexOf('vec3 stageFlood(vec3 local)'), LIGHT_FRAG_PARS.indexOf('vec3 stageGridAir'))
    expect(flood).toContain('float along = dot(d, normalize(local - uLightEye));')
    expect(flood).toContain('float q = 1.0 + max(dot(d, d) - along * along, 0.0) / (uLightFloodAt.w * uLightFloodAt.w);')
    expect(flood).toContain('return uLightFlood * (uLightFloodAt.z / (q * sqrt(q)));')
    const reach = ROOM_RIG.flood.insideMm
    expect(floodCore(0, reach)).toBe(1)
    expect(floodCore(reach, reach)).toBeCloseTo(2 ** -1.5, 12)
    expect(floodCore(innerRadiusMm * 0.45, reach)).toBeLessThan(0.04)
    expect(floodCore(innerRadiusMm * 0.95, reach)).toBeLessThan(0.004)
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
