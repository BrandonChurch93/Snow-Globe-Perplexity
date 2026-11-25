import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { VEIL_LOOK, loadLean } from '../src/core/chunks/veil'
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
