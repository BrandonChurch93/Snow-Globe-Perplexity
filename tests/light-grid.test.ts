import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { config } from '../src/config'
import { lightGridShape } from '../src/core/chunks/light'
import type { SdfGrid } from '../src/core/stage'
import { buildCollider, innerRadiusMm } from '../src/scene/layout'
import { GRID, bakeField, bakeGrid, breathOf, falloff, flickerOf, gainOf, glowAt, glowOf, gridBytes, gridCells, gridInfo, gridPages, groupGains, groupsOf, keyBend, keySeen, lightAt, shadeGrid } from '../src/scene/lightgrid'
import type { InnerLight } from '../src/seasons/kit'
import { kit as winter } from '../src/seasons/winter'

const period = config.scene.ambientPeriodSeconds
const light = (at: [number, number, number], over: Partial<InnerLight> = {}): InnerLight => ({ at, color: [1, 0.7, 0.4], power: 1, reachMm: 20, flicker: 0.1, cycles: 3, phase: 0.2, ...over })

const floorY = -20
const wall = { x: 10, half: 2, top: 12, depth: 16 }
function room(): SdfGrid {
  const n = 48
  const sizeMm = 2 * innerRadiusMm
  const data = new Float32Array(n * n * n)
  const step = sizeMm / (n - 1)
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -sizeMm / 2 + i * step
    const y = -sizeMm / 2 + j * step
    const z = -sizeMm / 2 + k * step
    const ground = y - floorY
    const qx = Math.abs(x - wall.x) - wall.half
    const qy = Math.abs(y - (floorY + wall.top) / 2) - (wall.top - floorY) / 2
    const qz = Math.abs(z) - wall.depth
    const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0)
    data[i + n * (j + n * k)] = Math.min(ground, box)
  }
  return { n, sizeMm, data }
}

const cellOf = (v: number) => Math.min(gridCells - 1, Math.max(0, Math.floor((v / (2 * innerRadiusMm) + 0.5) * gridCells)))
const indexOf = (x: number, y: number, z: number) => cellOf(x) + gridCells * (cellOf(y) + gridCells * cellOf(z))
const lum = (f: { colour: Float32Array }, i: number) => 0.2126 * f.colour[3 * i]! + 0.7152 * f.colour[3 * i + 1]! + 0.0722 * f.colour[3 * i + 2]!

describe('the fall of a small light', () => {
  it('is whole at the light, half at its reach and gone at the tail', () => {
    expect(falloff(0, 20)).toBe(1)
    expect(falloff(20, 20)).toBeCloseTo(0.5, 12)
    expect(falloff(GRID.tail * 20, 20)).toBe(0)
    expect(falloff(GRID.tail * 20 + 5, 20)).toBe(0)
    let last = 1
    for (let d = 0.5; d <= GRID.tail * 20; d += 0.5) {
      const f = falloff(d, 20)
      expect(f).toBeLessThanOrEqual(last)
      last = f
    }
  })

  it('is blocked by what stands between', () => {
    const solid = room()
    const lamp = [light([0, 0, 0])]
    const open = lightAt(lamp, solid, -18, 0, 0)
    const hidden = lightAt(lamp, solid, 18, 0, 0)
    expect(open[0]).toBeGreaterThan(0.2)
    expect(hidden[0]).toBeLessThan(open[0] * 0.2)
    expect(lightAt(lamp, solid, 18, 30, 0)[0]).toBeGreaterThan(hidden[0])
  })
})

describe('flicker and breath', () => {
  const lights = [light([0, 0, 0]), light([5, 0, 0], { cycles: 5, phase: 0.61, flicker: 0.2 }), light([0, 5, 0], { flicker: 0 })]

  it('close over the ambient period', () => {
    for (const l of lights) expect(flickerOf(l, period, period)).toBeCloseTo(flickerOf(l, 0, period), 9)
    expect(breathOf(period, period)).toBeCloseTo(breathOf(0, period), 9)
    expect(gainOf(lights, period, period)).toBeCloseTo(gainOf(lights, 0, period), 9)
    expect(gainOf(lights, 2 * period + 1.25, period)).toBeCloseTo(gainOf(lights, 1.25, period), 9)
  })

  it('are pure functions of the time that do move', () => {
    expect(flickerOf(lights[0]!, 1.3, period)).toBe(flickerOf(lights[0]!, 1.3, period))
    const seen = new Set<string>()
    for (let i = 0; i < 16; i++) seen.add(flickerOf(lights[1]!, (i / 16) * period, period).toFixed(4))
    expect(seen.size).toBeGreaterThan(8)
    expect(flickerOf(lights[2]!, 2.2, period)).toBe(1)
    for (let i = 0; i < 64; i++) {
      const f = flickerOf(lights[1]!, (i / 64) * period, period)
      expect(f).toBeGreaterThan(1 - 1.5 * lights[1]!.flicker)
      expect(f).toBeLessThan(1 + 1.5 * lights[1]!.flicker)
      expect(Math.abs(breathOf((i / 64) * period, period) - 1)).toBeLessThanOrEqual(GRID.breath + 1e-9)
    }
  })
})

describe('the flicker groups', () => {
  it('keep lights that flicker together in one group when there are few kinds', () => {
    const lights = [light([0, 0, 0]), light([9, 0, 0]), light([0, 9, 0], { cycles: 5 }), light([0, 0, 9], { phase: 0.7 }), light([4, 4, 4], { cycles: 5 })]
    const g = groupsOf(lights)
    expect(g[0]).toBe(g[1])
    expect(g[2]).toBe(g[4])
    expect(new Set(g).size).toBe(3)
  })

  it('fold many kinds into the four the texture holds, the same way every time', () => {
    const lights: InnerLight[] = []
    for (let i = 0; i < 23; i++) lights.push(light([Math.cos(i) * 30, Math.sin(i * 1.7) * 20, Math.sin(i) * 30], { cycles: 1 + (i % 6), phase: (i * 0.137) % 1 }))
    const g = groupsOf(lights)
    expect(g).toEqual(groupsOf(lights))
    expect(g.length).toBe(lights.length)
    for (const v of g) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(GRID.groups)
    }
    expect(new Set(g).size).toBe(GRID.groups)
  })
})

describe('the baked grid', () => {
  const solid = room()
  const lamp = [light([0, 0, 0])]
  const field = bakeField(lamp, solid)

  it('has the shape the shader reads', () => {
    expect(lightGridShape.cells).toBe(gridCells)
    expect(lightGridShape.pages).toBe(gridPages)
    expect(gridBytes).toBe(gridCells ** 3 * gridPages * 8)
    const t = bakeGrid(lamp, solid)
    expect(t).toBeInstanceOf(THREE.Data3DTexture)
    expect(t.image.width).toBe(gridCells)
    expect(t.image.height).toBe(gridCells)
    expect(t.image.depth).toBe(gridCells * gridPages)
    expect((t.image.data as Uint16Array).byteLength).toBe(gridBytes)
    expect(gridInfo(t)?.lights.length).toBe(1)
  })

  it('carries its light a little way into the solid, so no surface steps to black', () => {
    const under = indexOf(0, floorY - 16, 0)
    const above = indexOf(0, floorY + 2, 0)
    expect(lum(field, above)).toBeGreaterThan(0.1)
    expect(lum(field, under)).toBeGreaterThan(lum(field, above) * 0.3)
    expect(field.open[under]).toBeGreaterThan(0)
    expect(lum(field, indexOf(0, floorY - 34, 0))).toBe(0)
  })

  it('is bright by the light, dark behind the wall and carries the way to the light', () => {
    const open = indexOf(-18, 0, 0)
    const hidden = indexOf(18, 0, 0)
    expect(lum(field, open)).toBeGreaterThan(0.2)
    expect(lum(field, hidden)).toBeLessThan(lum(field, open) * 0.35)
    const m = [field.moment[3 * open]!, field.moment[3 * open + 1]!, field.moment[3 * open + 2]!]
    const len = Math.hypot(m[0]!, m[1]!, m[2]!)
    expect(len).toBeGreaterThan(0.6 * lum(field, open))
    expect(m[0]! / len).toBeGreaterThan(0.9)
    const below = indexOf(0, -12, 0)
    expect(field.moment[3 * below + 1]!).toBeGreaterThan(0)
  })

  it('gets one bounce off bright ground and none off black ground', () => {
    const black = bakeField(lamp, solid, [0, 0, 0])
    const above = indexOf(-18, 6, 0)
    expect(lum(field, above)).toBeGreaterThan(lum(black, above))
    const shaded = indexOf(22, -10, 0)
    expect(lum(field, shaded)).toBeGreaterThan(lum(black, shaded))
    const far = indexOf(-18, 40, 0)
    expect(lum(field, far) - lum(black, far)).toBeLessThan(lum(field, above) - lum(black, above))
  })

  it('knows open air from a corner', () => {
    expect(field.open[indexOf(-25, 20, 0)]!).toBeGreaterThan(0.9)
    expect(field.open[indexOf(6.5, -17, 0)]!).toBeLessThan(field.open[indexOf(-25, -17, 0)]!)
  })

  it('splits its light among the flicker groups', () => {
    const two = [light([-20, 0, 0]), light([-20, 0, 20], { cycles: 5 })]
    const f = bakeField(two, solid)
    const near0 = indexOf(-26, 0, -6)
    const near1 = indexOf(-26, 0, 26)
    const g = f.group
    expect(g[0]).not.toBe(g[1])
    expect(f.share[GRID.groups * near0 + g[0]!]!).toBeGreaterThan(f.share[GRID.groups * near0 + g[1]!]!)
    expect(f.share[GRID.groups * near1 + g[1]!]!).toBeGreaterThan(f.share[GRID.groups * near1 + g[0]!]!)
    const out = new THREE.Vector4()
    groupGains({ lights: two, group: g }, two, 0.9, period, out)
    expect(out.getComponent(g[0]!)).toBeCloseTo(flickerOf(two[0]!, 0.9, period), 9)
    expect(out.getComponent(g[1]!)).toBeCloseTo(flickerOf(two[1]!, 0.9, period), 9)
  })

  it('bakes the same grid twice', () => {
    const again = bakeField(lamp, solid)
    expect(Array.from(again.colour.slice(0, 3000))).toEqual(Array.from(field.colour.slice(0, 3000)))
    expect(Array.from(again.moment.slice(0, 3000))).toEqual(Array.from(field.moment.slice(0, 3000)))
  })
})

describe('the glow that reaches out', () => {
  it('adds the lights by power and reach and sits among them', () => {
    const a = light([10, 0, 0], { power: 2, reachMm: GRID.glowReachMm })
    const b = light([-10, 0, 0], { power: 1, reachMm: GRID.glowReachMm })
    const g = glowOf([a, b])
    expect(g[0]).toBeCloseTo(3, 9)
    expect(g[1]).toBeCloseTo(3 * 0.7, 9)
    expect(glowOf([light([0, 0, 0], { reachMm: 2 * GRID.glowReachMm })])[0]).toBeCloseTo(4, 9)
    const at = glowAt([a, b])
    expect(at[0]).toBeGreaterThan(0)
    expect(at[0]).toBeLessThan(10)
    expect(glowOf([])).toEqual([0, 0, 0])
  })
})

describe('winter under this grid', () => {
  it('bakes its own lights in time, with light and with direction', () => {
    const lights = winter.innerLights
    expect(lights.length).toBeGreaterThan(0)
    const t0 = process.hrtime.bigint()
    const f = bakeField(lights, buildCollider())
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    expect(ms).toBeLessThan(6000)
    let lit = 0
    let sided = 0
    for (let i = 0; i < gridCells ** 3; i++) {
      const l = lum(f, i)
      if (l > 0.02) {
        lit++
        if (Math.hypot(f.moment[3 * i]!, f.moment[3 * i + 1]!, f.moment[3 * i + 2]!) > 0.3 * l) sided++
      }
      expect(Number.isFinite(l)).toBe(true)
    }
    expect(lit).toBeGreaterThan(200)
    expect(sided / lit).toBeGreaterThan(0.6)
    for (const l of lights) expect(flickerOf(l, period, period)).toBeCloseTo(flickerOf(l, 0, period), 9)
  })
})

describe('the key\'s shade in the grid', () => {
  const solid = room()
  const lamp = [light([0, 0, 0])]
  const len = Math.hypot(1, 0.6)
  const key = [1 / len, 0.6 / len, 0]
  const shadeAt = (t: THREE.Data3DTexture, x: number, y: number, z: number) => THREE.DataUtils.fromHalfFloat((t.image.data as Uint16Array)[(gridCells ** 3 + indexOf(x, y, z)) * 4 + 3]!)

  it('is whole in the open and gone behind the wall, softer far from it', () => {
    expect(keySeen(solid, 30, -15, 0, key, 0.2)).toBe(1)
    expect(keySeen(solid, 0, 30, 0, key, 0.2)).toBe(1)
    expect(keySeen(solid, 2, -15, 0, key, 0.2)).toBe(0)
    const near = [keySeen(solid, 0, 5.5, 0, key, 0.2), keySeen(solid, 0, 8.5, 0, key, 0.2)]
    const far = [keySeen(solid, -30, -12.5, 0, key, 0.2), keySeen(solid, -30, -9.5, 0, key, 0.2)]
    expect(near[1]! - near[0]!).toBeGreaterThan(far[1]! - far[0]!)
    expect(far[1]!).toBeGreaterThanOrEqual(far[0]!)
  })

  it('bends toward the rim as the glass bends it', () => {
    const out = [0, 0, 0]
    keyBend(key[0]! * 20, key[1]! * 20, 0, key, 0.25, out)
    expect(out[0]).toBeCloseTo(key[0]!, 12)
    expect(out[1]).toBeCloseTo(key[1]!, 12)
    keyBend(0, 0, 30, key, 0.25, out)
    expect(out[2]).toBeGreaterThan(0.1)
    expect(Math.hypot(out[0]!, out[1]!, out[2]!)).toBeCloseTo(1, 12)
    keyBend(0, 0, 30, key, 0, out)
    expect(out[2]).toBe(0)
  })

  it('is packed into the grid once for a key and again when the key moves', () => {
    const t = bakeGrid(lamp, solid)
    const before = (t.image.data as Uint16Array).slice()
    const version = t.version
    expect(shadeGrid(t, key, 0, 0.2)).toBe(true)
    expect(t.version).toBeGreaterThan(version)
    expect(shadeGrid(t, key, 0, 0.2)).toBe(false)
    expect(shadeAt(t, 30, -15, 0)).toBe(1)
    expect(shadeAt(t, 2, -15, 0)).toBe(0)
    const after = t.image.data as Uint16Array
    let moved = 0
    for (let i = 0; i < before.length; i++) if (!(i >= gridCells ** 3 * 4 && i < 2 * gridCells ** 3 * 4 && i % 4 === 3) && after[i] !== before[i]) moved++
    expect(moved).toBe(0)
    expect(shadeGrid(t, [-key[0]!, key[1]!, 0], 0, 0.2)).toBe(true)
    expect(shadeAt(t, 30, -15, 0)).toBe(0)
    expect(shadeAt(t, -30, -15, 0)).toBe(1)
    expect(shadeGrid(null, key, 0, 0.2)).toBe(false)
  })

  it('bakes within the time a season can spare', () => {
    const t = bakeGrid(winter.innerLights, buildCollider())
    const start = process.hrtime.bigint()
    shadeGrid(t, key, 0.25, 0.256)
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    console.log(`shade bake: ${ms.toFixed(0)} ms`)
    expect(ms).toBeLessThan(1500)
  })
})
