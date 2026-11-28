import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { VEIL_GLSL, VEIL_LOOK, leanGlsl, loadLean } from '../src/core/chunks/veil'
import { LIQUID_LENGTH, LIQUID_LOAD } from '../src/globe/liquid'

const lean = (x: number, y = 0, z = 0) => {
  const L = new Float64Array(LIQUID_LENGTH)
  L[LIQUID_LOAD] = x
  L[LIQUID_LOAD + 1] = y
  L[LIQUID_LOAD + 2] = z
  return loadLean(L, new THREE.Vector3())
}

describe('the lean of the veil under the load of the liquid', () => {
  it('is nothing in still liquid, so a resting globe is drawn as it was', () => {
    const v = lean(0)
    expect(v.x).toBe(0)
    expect(v.y).toBe(0)
    expect(v.z).toBe(0)
  })

  it('points where the load is thrown', () => {
    const v = lean(-6, 3, 1)
    expect(v.x).toBeLessThan(0)
    expect(v.y / v.x).toBeCloseTo(-0.5, 9)
    expect(v.z / v.x).toBeCloseTo(-1 / 6, 9)
  })

  it('comes on with the square of the load and stops at its most', () => {
    expect(lean(4).length() / lean(2).length()).toBeCloseTo(4, 9)
    expect(lean(VEIL_LOOK.leanKneeMm / 2).length()).toBeLessThan(VEIL_LOOK.leanMost / 3)
    expect(lean(VEIL_LOOK.leanKneeMm).length()).toBeCloseTo(VEIL_LOOK.leanMost, 2)
    expect(lean(60).length()).toBeCloseTo(VEIL_LOOK.leanMost, 9)
  })
})

/** The share of a veil's density that the lean leaves, in the shader's own words read as numbers: `along` runs from -1 at the wall the load has left to 1 at the wall it runs to. */
const thrown = new Function(
  'along',
  'lean',
  `return ${leanGlsl('P', 'L', 'R').replaceAll('dot(P, L)', '(along * lean)').replaceAll('dot(L, L)', '(lean * lean)').replaceAll(' / R)', ' / 1.0)').replaceAll('exp(', 'Math.exp(')}`,
) as (along: number, lean: number) => number
const line = (name: string) => VEIL_GLSL.split('\n').find((l) => l.trimStart().startsWith(`float ${name} = `) && l.includes('thrown')) ?? ''

describe('the floor under the throw of the thin veil', () => {
  it('stands under the thin part alone, and the bank keeps its throw whole', () => {
    expect(line('thin').trimEnd().endsWith(` * max(thrown, ${VEIL_LOOK.leanFloor});`)).toBe(true)
    expect(line('bank')).toContain(' * thrown + ')
    expect(line('bank')).not.toContain('max(')
  })

  it('is a floor from the span the pictures were judged over', () => {
    expect(VEIL_LOOK.leanFloor).toBeGreaterThanOrEqual(0.2)
    expect(VEIL_LOOK.leanFloor).toBeLessThanOrEqual(0.5)
  })

  it('holds up the side the load has left at the most lean, where the throw alone leaves under a hundredth', () => {
    const far = thrown(-1, VEIL_LOOK.leanMost)
    expect(far).toBeGreaterThan(0.009)
    expect(far).toBeLessThan(0.01)
    expect(Math.max(far, VEIL_LOOK.leanFloor) / far).toBeGreaterThan(20)
    expect(thrown(1, VEIL_LOOK.leanMost)).toBeGreaterThan(12)
  })

  it('does nothing in still liquid or under a small lean, so a resting globe is drawn as it was', () => {
    expect(thrown(-1, 0)).toBe(1)
    expect(thrown(1, 0)).toBe(1)
    for (const lean of [0.02, 0.05, 0.1]) expect(thrown(-1, lean)).toBeGreaterThan(0.5)
  })
})
