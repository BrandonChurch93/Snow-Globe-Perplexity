import * as THREE from 'three'
import type { KitMoment } from '../kit'
import * as arrivalPart from './arrival'
import { sandMaterial } from './base'
import * as glassPart from './glass'

const PART = 'surface-dressing-summer'



// Where the sand lies on the slab, in mm from the globe's axis (x to the right of the hero camera, z toward it), measured
// from the approved image: the dune the spill builds against the foot on the right (a cone under the stream, on a low
// mound, with loose grains sprayed out to its right), its shoulder round the front of the
// foot, the fan toward the camera, a thin sheet behind the foot on the left, and a few grains everywhere near the foot.
const HEAP = {
  dune: { x: 67, z: 2, sx: 15, sz: 19, mm: 5.5 },
  cone: { x: 60, z: 0, mm: 9.5, run: 0.44, deep: 1.3 },
  spray: { x: 80, z: 10, sx: 24, sz: 27 },
  apron: { wide: 1.1, core: [0.3, 1.0], tail: 0.16, least: 0.02 },
  streak: { x: -84, z: 0, sx: 18, sz: 30, share: 0.5 },
  skirt: { x: 71, z: 30, sx: 10, sz: 20, mm: 2.2 },
  shoulder: { x: 53, z: 56, sx: 18, sz: 14, mm: 2.4 },
  fan: { x: 58, z: 98, sx: 20, sz: 44, mm: 1.5 },
  sheet: { x: -96, z: -18, sx: 36, sz: 24, mm: 0.15 },
  stray: { x: 56, z: 66, sx: 26, sz: 52, mm: 0.2 },
  ring: { r: 61.5, w: 4.5, mm: 0.34 },
}
// What the sand's shader does with a thin layer (base.ts, SAND): none of it below `none` mm, all of it from `all` mm, a
// smooth step between, and a grain is drawn where that step is over `cover` times the grain's own number.
const GRAIN = { none: 0.11, all: 0.35, cover: 0.62 }
export const SLAB = { liftMm: 0.5, footMm: 52.4, repose: 0.62, stepMm: 1.65, x: [-150, 142], z: [-232, 216] } as const

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

// The pile under the stream: a cone at the sand's angle of repose with its top against the foot, where the stream lands.
const cone = (x: number, z: number): number => Math.max(0, HEAP.cone.mm - HEAP.cone.run * Math.hypot(x - HEAP.cone.x, (z - HEAP.cone.z) / HEAP.cone.deep))

export function sandHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  const broad = noise(x / 23 + 3.1, z / 23 + 7.7, 11)
  const mid = noise(x / 7.3 + 1.7, z / 7.3 + 9.2, 13)
  const fine = noise(x / 2.1 + 5.3, z / 2.1 + 2.9, 17)
  const heap = (bump(x, z, HEAP.dune) + cone(x, z)) * (0.86 + 0.28 * broad) + bump(x, z, HEAP.skirt) * (0.5 + mid) + bump(x, z, HEAP.shoulder) * (0.6 + 0.8 * broad) + bump(x, z, HEAP.fan) * (0.25 + 1.5 * broad * mid)
  const sheet = bump(x, z, HEAP.sheet) * (0.55 + 0.75 * broad * mid)
  const stray = bump(x, z, HEAP.stray) * mid * mid * (0.4 + 1.2 * fine)
  const az = Math.atan2(x, z) * (180 / Math.PI)
  const clear = az > -150 && az < -8 ? 0.06 : 1
  const ring = HEAP.ring.mm * Math.exp(-(((r - HEAP.ring.r) / HEAP.ring.w) ** 2)) * (0.15 + 1.7 * broad * mid) * clear
  const lumps = (fine - 0.5) * 0.3 * Math.min(1, heap / 0.8) + (mid - 0.5) * 1.1 * Math.min(1, heap / 3)
  // Round every heap lies an apron thinner than a grain is high. The shader draws such a layer as single grains, as many
  // as the layer is thick, so the apron's thickness is set from the share of the ground the grains should take: all of it
  // next to a heap, quickly less, then a few for a long way out. No heap ends in an outline.
  const near = (g: { x: number; z: number; sx: number; sz: number }): number => Math.exp(-(((x - g.x) / (g.sx * HEAP.apron.wide)) ** 2 + ((z - g.z) / (g.sz * HEAP.apron.wide)) ** 2))
  const by = Math.min(1, near(HEAP.fan) + near(HEAP.shoulder) + near(HEAP.spray) + HEAP.streak.share * near(HEAP.streak))
  const share = Math.min(1, Math.min(1, Math.max(0, (by - HEAP.apron.core[0]) / (HEAP.apron.core[1] - HEAP.apron.core[0]))) ** 1.5 + HEAP.apron.tail * by ** 0.4 * (0.5 + mid))
  const apron = share > HEAP.apron.least ? GRAIN.none + (GRAIN.all - GRAIN.none) * (0.5 - Math.sin(Math.asin(1 - 2 * GRAIN.cover * Math.min(1, share)) / 3)) : 0
  return Math.max(0, heap + sheet + stray + ring + lumps) + apron
}

export function sandSpread(x: number, z: number): number {
  return 0.16 * Math.min(1, 0.5 * (bump(x, z, HEAP.stray) / HEAP.stray.mm) + 0.6 * (bump(x, z, HEAP.fan) / HEAP.fan.mm) + 0.5 * (bump(x, z, HEAP.sheet) / HEAP.sheet.mm))
}

function heapGeometry(): THREE.BufferGeometry {
  const step = SLAB.stepMm
  const nx = Math.round((SLAB.x[1] - SLAB.x[0]) / step) + 1
  const nz = Math.round((SLAB.z[1] - SLAB.z[0]) / step) + 1
  const h = new Float32Array(nx * nz)
  // Under the foot the sand does not stop at a wall: it runs down from where it leant on the base at its angle of repose,
  // so when the globe is lifted clear the heap has a slumped inner face and a whole footprint, not a notch.
  const under = (x: number, z: number): number => {
    const r = Math.hypot(x, z)
    if (r >= SLAB.footMm) return sandHeight(x, z)
    if (r < 1) return 0
    const k = SLAB.footMm / r
    const gone = SLAB.footMm - r
    return Math.max(0, sandHeight(x * k, z * k) - SLAB.repose * gone * (0.8 + 0.4 * noise(x / 3.1 + 2.3, z / 3.1 + 6.1, 19)) - 0.02 * gone * gone)
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = under(SLAB.x[0] + i * step, SLAB.z[0] + j * step)
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
    color.push(Math.min(1, h[o]! / 0.5), 0.14 + 0.86 * Math.min(1, Math.max(0, (r - 55.5) / 13)), 0)
    slot[o] = position.length / 3 - 1
    return slot[o]!
  }
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const top = Math.max(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1))
      if (top < 0.1) continue
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
