import * as THREE from 'three'
import type { Dressing, KitMoment } from '../kit'
import * as arrivalPart from './arrival'
import { sandMaterial } from './base'
import * as glassPart from './glass'

const PART = 'surface-dressing-summer'

export const standIns: string[] = []

export const surfaceDressing: Dressing & { reachMm: number } = { tint: [0.86, 0.74, 0.55], amount: 0, reachMm: 150 }

// Where the sand lies on the slab, in mm from the globe's axis (x to the right of the hero camera, z toward it), measured
// from the approved image: the dune the spill builds against the foot on the right, its shoulder round the front of the
// foot, the fan toward the camera, a thin sheet behind the foot on the left, and a few grains everywhere near the foot.
const HEAP = {
  dune: { x: 67, z: 2, sx: 15, sz: 19, mm: 12.5 },
  skirt: { x: 71, z: 30, sx: 10, sz: 20, mm: 2.2 },
  shoulder: { x: 47, z: 58, sx: 21, sz: 14, mm: 2.4 },
  fan: { x: 50, z: 98, sx: 23, sz: 44, mm: 1.5 },
  sheet: { x: -96, z: -18, sx: 36, sz: 24, mm: 0.19 },
  stray: { x: 56, z: 66, sx: 26, sz: 52, mm: 0.2 },
  ring: { r: 61.5, w: 4.5, mm: 0.55 },
}
export const SLAB = { liftMm: 0.5, footMm: 54, stepMm: 1.2, x: [-150, 142], z: [-232, 216] } as const

const hash = (x: number, y: number, s: number): number => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi, s)
  const b = hash(xi + 1, yi, s)
  const c = hash(xi, yi + 1, s)
  const d = hash(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const bump = (x: number, z: number, g: { x: number; z: number; sx: number; sz: number; mm: number }): number => g.mm * Math.exp(-(((x - g.x) / g.sx) ** 2 + ((z - g.z) / g.sz) ** 2))

export function sandHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  const broad = noise(x / 23 + 3.1, z / 23 + 7.7, 11)
  const mid = noise(x / 7.3 + 1.7, z / 7.3 + 9.2, 13)
  const fine = noise(x / 2.1 + 5.3, z / 2.1 + 2.9, 17)
  const heap = bump(x, z, HEAP.dune) * (0.86 + 0.28 * broad) + bump(x, z, HEAP.skirt) * (0.5 + mid) + bump(x, z, HEAP.shoulder) * (0.6 + 0.8 * broad) + bump(x, z, HEAP.fan) * (0.25 + 1.5 * broad * mid)
  const sheet = bump(x, z, HEAP.sheet) * (0.55 + 0.75 * broad * mid)
  const stray = bump(x, z, HEAP.stray) * mid * mid * (0.4 + 1.2 * fine)
  const az = Math.atan2(x, z) * (180 / Math.PI)
  const clear = az > -150 && az < -8 ? 0.06 : 1
  const ring = HEAP.ring.mm * Math.exp(-(((r - HEAP.ring.r) / HEAP.ring.w) ** 2)) * (0.15 + 1.7 * broad * mid) * clear
  const lumps = (fine - 0.5) * 0.22 * Math.min(1, heap / 0.8) + (mid - 0.5) * 0.5 * Math.min(1, heap / 3)
  return Math.max(0, heap + sheet + stray + ring + lumps)
}

export function sandSpread(x: number, z: number): number {
  return 0.16 * Math.min(1, 0.5 * (bump(x, z, HEAP.stray) / HEAP.stray.mm) + 0.6 * (bump(x, z, HEAP.fan) / HEAP.fan.mm) + 0.5 * (bump(x, z, HEAP.sheet) / HEAP.sheet.mm))
}

function heapGeometry(): THREE.BufferGeometry {
  const step = SLAB.stepMm
  const nx = Math.round((SLAB.x[1] - SLAB.x[0]) / step) + 1
  const nz = Math.round((SLAB.z[1] - SLAB.z[0]) / step) + 1
  const h = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = sandHeight(SLAB.x[0] + i * step, SLAB.z[0] + j * step)
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)]!
  const slot = new Int32Array(nx * nz).fill(-1)
  const position: number[] = []
  const normal: number[] = []
  const color: number[] = []
  const index: number[] = []
  const vertex = (i: number, j: number): number => {
    const o = j * nx + i
    if (slot[o]! >= 0) return slot[o]!
    const x = SLAB.x[0] + i * step
    const z = SLAB.z[0] + j * step
    const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
    const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step)
    const l = Math.hypot(gx, 1, gz)
    const r = Math.hypot(x, z)
    position.push(x, SLAB.liftMm + h[o]!, z)
    normal.push(-gx / l, 1 / l, -gz / l)
    color.push(Math.min(1, h[o]! / 0.5), 0.45 + 0.55 * Math.min(1, Math.max(0, (r - 57) / 14)), 0)
    slot[o] = position.length / 3 - 1
    return slot[o]!
  }
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const top = Math.max(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1))
      if (top < 0.012) continue
      const x = SLAB.x[0] + (i + 0.5) * step
      const z = SLAB.z[0] + (j + 0.5) * step
      if (Math.hypot(x, z) < SLAB.footMm) continue
      const a = vertex(i, j)
      const b = vertex(i + 1, j)
      const c = vertex(i, j + 1)
      const d = vertex(i + 1, j + 1)
      index.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  const count = position.length / 3
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

export async function prepare(): Promise<void> {}

export function dressing(): THREE.Object3D {
  const group = new THREE.Group()
  const pool = (glassPart as { surfacePool?: () => THREE.Object3D }).surfacePool?.()
  if (pool) group.add(pool)
  const sand = new THREE.Mesh(heapGeometry(), sandMaterial(PART, 'surface-dressing', `${PART}-sand`))
  sand.castShadow = true
  sand.receiveShadow = true
  sand.renderOrder = 3
  const loose = arrivalPart.grains()
  loose.renderOrder = 4
  group.add(sand, loose)
  return group
}

export function update(_moment: KitMoment): void {}
