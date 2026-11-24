import * as THREE from 'three'
import { sampleSdf } from '../core/sdf'
import type { SdfGrid } from '../core/stage'
import type { InnerLight } from '../seasons/kit'
import { innerRadiusMm } from './layout'

export const gridCells = 24
export const gridBytes = gridCells ** 3 * 8

export function lightAt(lights: readonly InnerLight[], solid: SdfGrid, x: number, y: number, z: number): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]
  for (const l of lights) {
    const dx = l.at[0] - x
    const dy = l.at[1] - y
    const dz = l.at[2] - z
    const d = Math.hypot(dx, dy, dz)
    let seen = 1
    const steps = 6
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      if (t * d < 3 || (1 - t) * d < 4) continue
      const v = sampleSdf(solid, x + dx * t, y + dy * t, z + dz * t)
      seen = Math.min(seen, Math.min(1, Math.max(0, v / 3 + 0.5)))
    }
    const f = (l.power * (0.25 + 0.75 * seen)) / (1 + (d / l.reachMm) * (d / l.reachMm))
    out[0] += l.color[0] * f
    out[1] += l.color[1] * f
    out[2] += l.color[2] * f
  }
  return out
}

export function bakeGrid(lights: readonly InnerLight[], solid: SdfGrid): THREE.Data3DTexture {
  const n = gridCells
  const size = 2 * innerRadiusMm
  const data = new Uint16Array(n * n * n * 4)
  const one = THREE.DataUtils.toHalfFloat(1)
  let o = 0
  for (let k = 0; k < n; k++) {
    const z = ((k + 0.5) / n - 0.5) * size
    for (let j = 0; j < n; j++) {
      const y = ((j + 0.5) / n - 0.5) * size
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n - 0.5) * size
        const c = lightAt(lights, solid, x, y, z)
        data[o++] = THREE.DataUtils.toHalfFloat(c[0])
        data[o++] = THREE.DataUtils.toHalfFloat(c[1])
        data[o++] = THREE.DataUtils.toHalfFloat(c[2])
        data[o++] = one
      }
    }
  }
  const t = new THREE.Data3DTexture(data, n, n, n)
  t.format = THREE.RGBAFormat
  t.type = THREE.HalfFloatType
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.wrapR = THREE.ClampToEdgeWrapping
  t.unpackAlignment = 1
  t.needsUpdate = true
  return t
}

export function flickerOf(l: InnerLight, time: number, period: number): number {
  return 1 + l.flicker * Math.sin(2 * Math.PI * ((l.cycles * time) / period + l.phase))
}

export function gainOf(lights: readonly InnerLight[], time: number, period: number): number {
  let sum = 0
  let weight = 0
  for (const l of lights) {
    sum += l.power * flickerOf(l, time, period)
    weight += l.power
  }
  return weight > 0 ? sum / weight : 1
}

export function glowOf(lights: readonly InnerLight[]): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]
  for (const l of lights) {
    out[0] += l.color[0] * l.power
    out[1] += l.color[1] * l.power
    out[2] += l.color[2] * l.power
  }
  return out
}
