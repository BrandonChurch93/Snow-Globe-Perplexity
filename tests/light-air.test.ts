import { describe, expect, it } from 'vitest'
import { LIGHT_FRAG, LIGHT_FRAG_PARS, gridAir, lightUniforms } from '../src/core/chunks/light'
import { Lighting, ROOM_RIG } from '../src/scene/lighting'
import { falloff } from '../src/scene/lightgrid'
import { kitOf } from '../src/seasons'

const knee = ROOM_RIG.grid.air
const lumOf = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!

describe('the grid light a flake takes', () => {
  it('stays near whole by a source and goes to nothing far from one', () => {
    expect(gridAir(0, knee)).toBe(0)
    expect(gridAir(2, knee)).toBeGreaterThan(0.7)
    expect(gridAir(0.2, knee)).toBeLessThan(0.05)
    let last = 0
    for (let l = 0.01; l <= 30; l *= 1.3) {
      const g = gridAir(l, knee)
      expect(g).toBeGreaterThan(last)
      expect(g).toBeLessThan(1)
      last = g
    }
  })

  it('draws the brightest light of winter into a smaller ball than the one its surfaces see', () => {
    const lights = kitOf('winter').innerLights
    const lamp = lights.reduce((a, b) => (b.power * b.reachMm > a.power * a.reachMm ? b : a))
    const soft = (d: number) => lamp.power * lumOf(lamp.color) * falloff(d, lamp.reachMm)
    const air = (d: number) => soft(d) * gridAir(soft(d), knee)
    const tenth = (f: (d: number) => number) => {
      let d = 3
      while (f(d) > 0.1 * f(3)) d += 0.1
      return d
    }
    expect(tenth(air)).toBeLessThan(0.8 * tenth(soft))
    expect(tenth(air)).toBeLessThan(1.4 * lamp.reachMm)
    expect(air(3)).toBeGreaterThan(0.6 * soft(3))
  })

  it('is set from the rig and shapes both grids before their gain, with the flood left whole', () => {
    new Lighting(256)
    expect(lightUniforms.uGridAir.value).toBeCloseTo(knee * knee, 12)
    expect(LIGHT_FRAG_PARS).toContain('uniform float uGridAir;')
    expect(LIGHT_FRAG_PARS).toContain('return colour * (q * q / max(q * q + uGridAir * uGridAir, 1e-9));')
    const grid = LIGHT_FRAG_PARS.slice(LIGHT_FRAG_PARS.indexOf('vec3 stageGrid(vec3 local)'), LIGHT_FRAG_PARS.indexOf('void stageGridRead('))
    expect(grid).toContain('a = stageGridAir(textureLod(uGridA, stageGridAt(local, 0.0), 0.0).rgb) * stageGridGain(')
    expect(grid).toContain('b = stageGridAir(textureLod(uGridB, stageGridAt(local, 0.0), 0.0).rgb) * stageGridGain(')
    expect(grid).toContain('return mix(a, b, uGrid.x) + stageFlood(local);')
    const read = LIGHT_FRAG_PARS.slice(LIGHT_FRAG_PARS.indexOf('void stageGridRead('), LIGHT_FRAG_PARS.indexOf('void stageGridLit('))
    expect(read.match(/air \+= stageGridAir\(c\.rgb\) \* gain;/g)?.length).toBe(2)
    expect(read).toContain('colour = e.rgb + flood;')
    expect(read).toContain('air += flood;')
  })

  it('is also given without the knee and without the flood, for the glints of what flies', () => {
    const warm = LIGHT_FRAG_PARS.slice(LIGHT_FRAG_PARS.indexOf('vec3 stageGridWarm(vec3 local)'), LIGHT_FRAG_PARS.indexOf('vec3 stageKeyBent('))
    expect(warm).toContain('a = textureLod(uGridA, stageGridAt(local, 0.0), 0.0).rgb * stageGridGain(textureLod(uGridA, stageGridAt(local, 2.0), 0.0), uGridGainA);')
    expect(warm).toContain('b = textureLod(uGridB, stageGridAt(local, 0.0), 0.0).rgb * stageGridGain(textureLod(uGridB, stageGridAt(local, 2.0), 0.0), uGridGainB);')
    expect(warm).toContain('return mix(a, b, uGrid.x);')
    expect(warm).not.toContain('stageGridAir')
    expect(warm).not.toContain('stageFlood')
    expect(LIGHT_FRAG_PARS.match(/vec3 stageGridWarm\(/g)?.length).toBe(1)
  })

  it('goes to what flies, while a surface reads the grid without the knee', () => {
    const lit = LIGHT_FRAG_PARS.slice(LIGHT_FRAG_PARS.indexOf('void stageGridLit('), LIGHT_FRAG_PARS.indexOf('vec3 stageGridToward('))
    expect(lit).toContain('stageGridRead(local, soft, colour, toward, open, shade);')
    expect(LIGHT_FRAG).toContain('stageGridRead(vStageLocal, lgCol, lgThin, lgToward, lgAir, lgShade);')
    expect(LIGHT_FRAG).toContain('stageLit = lgCol;')
    expect(LIGHT_FRAG).not.toContain('stageGridLit(')
  })

  it('gives a surface a share of the grid and the whole flood, and leaves what flies and the fog on a surface the grid unshared', () => {
    new Lighting(256)
    expect(ROOM_RIG.grid.surface).toBeGreaterThan(0.2)
    expect(ROOM_RIG.grid.surface).toBeLessThan(0.7)
    expect(lightUniforms.uRigPoint.value.w).toBe(ROOM_RIG.grid.surface)
    const fog = LIGHT_FRAG.indexOf('stageLit = lgCol;')
    const share = LIGHT_FRAG.indexOf('lgCol = (lgCol - lgFlood) * uRigPoint.w + lgFlood;')
    expect(fog).toBeGreaterThan(0)
    expect(share).toBeGreaterThan(fog)
    expect(LIGHT_FRAG.slice(fog, share)).toContain('vec3 lgFlood = stageFlood(vStageLocal);')
    expect(share).toBeLessThan(LIGHT_FRAG.indexOf('reflectedLight.indirectDiffuse += lgCol'))
    expect(share).toBeLessThan(LIGHT_FRAG.indexOf('stageGridC = lgCol'))
    expect(LIGHT_FRAG.match(/uRigPoint\.w/g)?.length).toBe(1)
    expect(LIGHT_FRAG_PARS).not.toContain('uRigPoint.w')
  })
})
