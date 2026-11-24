import * as THREE from 'three'
import type { Rgb } from '../core/materials'
import { sampleSdf } from '../core/sdf'
import type { SdfGrid } from '../core/stage'
import type { InnerLight } from '../seasons/kit'
import { innerRadiusMm } from './layout'

export const GRID = {
  cells: 32,
  pages: 3,
  groups: 4,
  tail: 2.5,
  skinMm: 2,
  edgeMm: 2.5,
  stepMm: 2,
  deepMm: 9,
  fixtureMm: 8,
  nearCells: 2,
  bounce: [0.62, 0.65, 0.7] as Rgb,
  patchMm: 7,
  patchLiftMm: 1,
  patchSlope: 0.25,
  bounceReachMm: 36,
  openReachMm: 14,
  openSteps: 5,
  glowReachMm: 22,
  flickerSecond: 0.35,
  breath: 0.035,
  shadeEdgeMm: 2,
  shadeStepMm: 1.5,
  shadeStride: 0.5,
  fillPasses: 6,
} as const

export const gridCells = GRID.cells
export const gridPages = GRID.pages
export const gridBytes = gridCells ** 3 * GRID.pages * 8

const LUMA: Rgb = [0.2126, 0.7152, 0.0722]
const lumOf = (r: number, g: number, b: number) => LUMA[0] * r + LUMA[1] * g + LUMA[2] * b
const HALF = 2 * (1 - 1 / (GRID.tail * GRID.tail)) ** 2 - 1
const CELL = (2 * innerRadiusMm) / GRID.cells
const OPEN_DIRS: readonly Rgb[] = (() => {
  const out: Rgb[] = [[0, 1, 0]]
  const tilt = (55 * Math.PI) / 180
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 2 * Math.PI + 0.3
    out.push([Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)])
  }
  return out
})()

export function falloff(d: number, reachMm: number): number {
  const u = d / reachMm
  if (u >= GRID.tail) return 0
  const w = 1 - (u * u) / (GRID.tail * GRID.tail)
  return (w * w) / (1 + HALF * u * u)
}

function slope(solid: SdfGrid, x: number, y: number, z: number, out: number[]): void {
  const h = 1.2
  const gx = sampleSdf(solid, x + h, y, z) - sampleSdf(solid, x - h, y, z)
  const gy = sampleSdf(solid, x, y + h, z) - sampleSdf(solid, x, y - h, z)
  const gz = sampleSdf(solid, x, y, z + h) - sampleSdf(solid, x, y, z - h)
  const len = Math.hypot(gx, gy, gz)
  if (len < 1e-6) {
    out[0] = 0
    out[1] = 1
    out[2] = 0
    return
  }
  out[0] = gx / len
  out[1] = gy / len
  out[2] = gz / len
}

function lift(solid: SdfGrid, p: number[], g: number[]): void {
  for (let it = 0; it < 4; it++) {
    const d = sampleSdf(solid, p[0]!, p[1]!, p[2]!)
    if (d >= GRID.skinMm) return
    slope(solid, p[0]!, p[1]!, p[2]!, g)
    const step = GRID.skinMm - d + 0.2
    p[0]! += g[0]! * step
    p[1]! += g[1]! * step
    p[2]! += g[2]! * step
  }
}

function seen(solid: SdfGrid, ax: number, ay: number, az: number, bx: number, by: number, bz: number, d: number, nearA: number, nearB: number): number {
  let v = 1
  const n = Math.max(2, Math.ceil(d / GRID.stepMm))
  for (let s = 1; s < n; s++) {
    const t = s / n
    const along = t * d
    if (along < nearA || d - along < nearB) continue
    const e = sampleSdf(solid, ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t) / GRID.edgeMm + 0.5
    if (e < v) {
      if (e <= 0) return 0
      v = e
    }
  }
  return v
}

const SIDES: readonly Rgb[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

function fillDeep(n: number, live: Uint8Array, fields: readonly { data: Float32Array; width: number }[]): void {
  let have = live.slice()
  const sum = new Float64Array(8)
  for (let pass = 0; pass < GRID.fillPasses; pass++) {
    const next = have.slice()
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const c = i + n * (j + n * k)
          if (have[c]) continue
          let count = 0
          for (const s of SIDES) {
            const a = i + s[0]
            const b = j + s[1]
            const d = k + s[2]
            if (a < 0 || b < 0 || d < 0 || a >= n || b >= n || d >= n) continue
            if (have[a + n * (b + n * d)]) count++
          }
          if (count === 0) continue
          for (const f of fields) {
            sum.fill(0)
            for (const s of SIDES) {
              const a = i + s[0]
              const b = j + s[1]
              const d = k + s[2]
              if (a < 0 || b < 0 || d < 0 || a >= n || b >= n || d >= n) continue
              const o = a + n * (b + n * d)
              if (!have[o]) continue
              for (let w = 0; w < f.width; w++) sum[w]! += f.data[o * f.width + w]!
            }
            for (let w = 0; w < f.width; w++) f.data[c * f.width + w] = sum[w]! / count
          }
          next[c] = 1
        }
      }
    }
    have = next
  }
}

const fixtureOf = (l: InnerLight, solid: SdfGrid) => GRID.skinMm + Math.min(GRID.fixtureMm, Math.max(0, -sampleSdf(solid, l.at[0], l.at[1], l.at[2])))

export function lightAt(lights: readonly InnerLight[], solid: SdfGrid, x: number, y: number, z: number): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]
  for (const l of lights) {
    const d = Math.hypot(l.at[0] - x, l.at[1] - y, l.at[2] - z)
    const f = l.power * falloff(d, l.reachMm)
    if (f <= 0) continue
    const w = f * seen(solid, x, y, z, l.at[0], l.at[1], l.at[2], d, GRID.skinMm, fixtureOf(l, solid))
    out[0] += l.color[0] * w
    out[1] += l.color[1] * w
    out[2] += l.color[2] * w
  }
  return out
}

export function groupsOf(lights: readonly InnerLight[]): number[] {
  const sig = lights.map((l) => `${l.flicker}:${l.cycles}:${l.phase}`)
  const distinct = [...new Set(sig)]
  if (distinct.length <= GRID.groups) return sig.map((s) => distinct.indexOf(s))
  const seeds: number[] = []
  let first = 0
  lights.forEach((l, i) => {
    if (l.power > lights[first]!.power) first = i
  })
  seeds.push(first)
  const gap = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
  while (seeds.length < GRID.groups) {
    let best = 0
    let far = -1
    lights.forEach((l, i) => {
      const near = Math.min(...seeds.map((s) => gap(l.at, lights[s]!.at)))
      if (near > far) {
        far = near
        best = i
      }
    })
    seeds.push(best)
  }
  const centres = seeds.map((s) => [...lights[s]!.at])
  let group = lights.map(() => 0)
  for (let it = 0; it < 6; it++) {
    group = lights.map((l) => {
      let best = 0
      for (let c = 1; c < centres.length; c++) if (gap(l.at, centres[c]!) < gap(l.at, centres[best]!)) best = c
      return best
    })
    centres.forEach((c, ci) => {
      let w = 0
      const sum = [0, 0, 0]
      lights.forEach((l, i) => {
        if (group[i] !== ci) return
        w += l.power
        for (let a = 0; a < 3; a++) sum[a]! += l.at[a]! * l.power
      })
      if (w > 0) for (let a = 0; a < 3; a++) c[a] = sum[a]! / w
    })
  }
  return group
}

export interface GridInfo {
  lights: readonly InnerLight[]
  group: readonly number[]
  solid: SdfGrid
  shade: number[] | null
}

const infos = new WeakMap<THREE.Texture, GridInfo>()
export const gridInfo = (t: THREE.Texture | null): GridInfo | undefined => (t ? infos.get(t) : undefined)

export interface Field {
  n: number
  colour: Float32Array
  open: Float32Array
  moment: Float32Array
  share: Float32Array
  group: number[]
}

export function bakeField(lights: readonly InnerLight[], solid: SdfGrid, bounce: Rgb = GRID.bounce): Field {
  const n = GRID.cells
  const size = 2 * innerRadiusMm
  const cells = n * n * n
  const colour = new Float32Array(cells * 3)
  const open = new Float32Array(cells)
  const moment = new Float32Array(cells * 3)
  const share = new Float32Array(cells * GRID.groups)
  const at = new Float32Array(cells * 3)
  const live = new Uint8Array(cells)
  const group = groupsOf(lights)
  const lit = lights.map((l, i) => ({ l, range2: (GRID.tail * l.reachMm) ** 2, lum: lumOf(l.color[0], l.color[1], l.color[2]), near: fixtureOf(l, solid), group: group[i]! }))
  const p = [0, 0, 0]
  const g = [0, 0, 0]
  const q = CELL / 4
  const nearMm = GRID.nearCells * CELL

  const gather = (px: number, py: number, pz: number, facing: number[] | null, into: (r: number, gr: number, b: number, dx: number, dy: number, dz: number, lum: number, group: number) => void, spread: boolean) => {
    for (const e of lit) {
      const l = e.l
      const dx = l.at[0] - px
      const dy = l.at[1] - py
      const dz = l.at[2] - pz
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 >= e.range2) continue
      const d = Math.sqrt(d2)
      let f = 0
      if (spread && d < nearMm) {
        for (let s = 0; s < 8; s++) f += falloff(Math.hypot(dx + (s & 1 ? q : -q), dy + (s & 2 ? q : -q), dz + (s & 4 ? q : -q)), l.reachMm)
        f /= 8
      } else f = falloff(d, l.reachMm)
      f *= l.power
      const inv = d > 1e-4 ? 1 / d : 0
      if (facing) f *= Math.max(0, (facing[0]! * dx + facing[1]! * dy + facing[2]! * dz) * inv)
      if (f < 1e-5) continue
      const w = f * seen(solid, px, py, pz, l.at[0], l.at[1], l.at[2], d, GRID.skinMm, e.near)
      if (w <= 0) continue
      into(l.color[0] * w, l.color[1] * w, l.color[2] * w, dx * inv, dy * inv, dz * inv, e.lum * w, e.group)
    }
  }

  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const c = i + n * (j + n * k)
        p[0] = ((i + 0.5) / n - 0.5) * size
        p[1] = ((j + 0.5) / n - 0.5) * size
        p[2] = ((k + 0.5) / n - 0.5) * size
        const d0 = sampleSdf(solid, p[0], p[1], p[2])
        if (d0 < -GRID.deepMm) continue
        if (d0 < GRID.skinMm) lift(solid, p, g)
        live[c] = 1
        at[c * 3] = p[0]
        at[c * 3 + 1] = p[1]!
        at[c * 3 + 2] = p[2]!
        gather(p[0], p[1]!, p[2]!, null, (r, gr, b, dx, dy, dz, lum, grp) => {
          colour[c * 3]! += r
          colour[c * 3 + 1]! += gr
          colour[c * 3 + 2]! += b
          moment[c * 3]! += dx * lum
          moment[c * 3 + 1]! += dy * lum
          moment[c * 3 + 2]! += dz * lum
          share[c * GRID.groups + grp]! += lum
        }, true)
        let o = 0
        for (const dir of OPEN_DIRS) {
          const far = GRID.openReachMm
          o += seen(solid, p[0], p[1]!, p[2]!, p[0] + dir[0] * far, p[1]! + dir[1] * far, p[2]! + dir[2] * far, far, GRID.skinMm, 0)
        }
        open[c] = o / OPEN_DIRS.length
      }
    }
  }

  const patches: { x: number; y: number; z: number; nx: number; ny: number; nz: number; area: number; rgb: number[]; share: number[]; lum: number }[] = []
  const half = innerRadiusMm
  const cols = Math.ceil(size / GRID.patchMm)
  const pitch = size / cols
  for (let a = 0; a < cols; a++) {
    for (let b = 0; b < cols; b++) {
      const x = -half + (a + 0.5) * pitch
      const z = -half + (b + 0.5) * pitch
      if (x * x + z * z > half * half) continue
      let prev = sampleSdf(solid, x, half, z)
      for (let y = half - 1; y >= -half; y -= 1) {
        const cur = sampleSdf(solid, x, y, z)
        if (prev > 0 && cur <= 0) {
          const hit = y + (cur / (cur - prev)) * 1
          slope(solid, x, hit, z, g)
          if (g[1]! > GRID.patchSlope) {
            const patch = { x: x + g[0]! * GRID.patchLiftMm, y: hit + g[1]! * GRID.patchLiftMm, z: z + g[2]! * GRID.patchLiftMm, nx: g[0]!, ny: g[1]!, nz: g[2]!, area: (pitch * pitch) / g[1]!, rgb: [0, 0, 0], share: [0, 0, 0, 0], lum: 0 }
            gather(patch.x, patch.y, patch.z, [patch.nx, patch.ny, patch.nz], (r, gr, bl, _dx, _dy, _dz, lum, grp) => {
              patch.rgb[0]! += r * bounce[0]
              patch.rgb[1]! += gr * bounce[1]
              patch.rgb[2]! += bl * bounce[2]
              patch.share[grp]! += lum
            }, false)
            patch.lum = lumOf(patch.rgb[0]!, patch.rgb[1]!, patch.rgb[2]!)
            const total = patch.share[0]! + patch.share[1]! + patch.share[2]! + patch.share[3]!
            if (patch.lum > 1e-4 && total > 0) {
              for (let s = 0; s < GRID.groups; s++) patch.share[s]! /= total
              patches.push(patch)
            }
          }
        }
        prev = cur
      }
    }
  }

  const reach2 = GRID.bounceReachMm * GRID.bounceReachMm
  for (let c = 0; c < cells; c++) {
    if (!live[c]) continue
    const px = at[c * 3]!
    const py = at[c * 3 + 1]!
    const pz = at[c * 3 + 2]!
    for (const s of patches) {
      const dx = px - s.x
      const dy = py - s.y
      const dz = pz - s.z
      const r2 = dx * dx + dy * dy + dz * dz
      if (r2 >= reach2) continue
      const r = Math.sqrt(r2)
      const cos = r > 1e-4 ? (s.nx * dx + s.ny * dy + s.nz * dz) / r : 0
      if (cos <= 0) continue
      const edge = 1 - r2 / reach2
      const form = (cos * s.area * edge * edge) / (Math.PI * r2 + s.area)
      colour[c * 3]! += s.rgb[0]! * form
      colour[c * 3 + 1]! += s.rgb[1]! * form
      colour[c * 3 + 2]! += s.rgb[2]! * form
      const lum = s.lum * form
      const inv = r > 1e-4 ? 1 / r : 0
      moment[c * 3]! -= dx * inv * lum
      moment[c * 3 + 1]! -= dy * inv * lum
      moment[c * 3 + 2]! -= dz * inv * lum
      for (let gi = 0; gi < GRID.groups; gi++) share[c * GRID.groups + gi]! += lum * s.share[gi]!
    }
  }
  fillDeep(n, live, [
    { data: colour, width: 3 },
    { data: open, width: 1 },
    { data: moment, width: 3 },
    { data: share, width: GRID.groups },
  ])
  return { n, colour, open, moment, share, group }
}

export function bakeGrid(lights: readonly InnerLight[], solid: SdfGrid, bounce: Rgb = GRID.bounce): THREE.Data3DTexture {
  const f = bakeField(lights, solid, bounce)
  const n = f.n
  const cells = n * n * n
  const data = new Uint16Array(cells * GRID.pages * 4)
  const half = THREE.DataUtils.toHalfFloat
  for (let c = 0; c < cells; c++) {
    const a = c * 4
    const b = (cells + c) * 4
    const s = (2 * cells + c) * 4
    data[a] = half(f.colour[c * 3]!)
    data[a + 1] = half(f.colour[c * 3 + 1]!)
    data[a + 2] = half(f.colour[c * 3 + 2]!)
    data[a + 3] = half(f.open[c]!)
    data[b] = half(f.moment[c * 3]!)
    data[b + 1] = half(f.moment[c * 3 + 1]!)
    data[b + 2] = half(f.moment[c * 3 + 2]!)
    data[b + 3] = half(1)
    for (let gi = 0; gi < 4; gi++) data[s + gi] = half(gi < GRID.groups ? f.share[c * GRID.groups + gi]! : 0)
  }
  const t = new THREE.Data3DTexture(data, n, n, n * GRID.pages)
  t.format = THREE.RGBAFormat
  t.type = THREE.HalfFloatType
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.wrapR = THREE.ClampToEdgeWrapping
  t.unpackAlignment = 1
  t.needsUpdate = true
  infos.set(t, { lights: lights.map((l) => ({ ...l })), group: f.group, solid, shade: null })
  return t
}

export function keyBend(x: number, y: number, z: number, key: readonly number[], bend: number, out: number[]): void {
  const along = x * key[0]! + y * key[1]! + z * key[2]!
  const ox = (x - key[0]! * along) / innerRadiusMm
  const oy = (y - key[1]! * along) / innerRadiusMm
  const oz = (z - key[2]! * along) / innerRadiusMm
  const s2 = ox * ox + oy * oy + oz * oz
  const k = bend * (1 + s2 * Math.sqrt(s2))
  const dx = key[0]! + ox * k
  const dy = key[1]! + oy * k
  const dz = key[2]! + oz * k
  const len = Math.hypot(dx, dy, dz)
  out[0] = dx / len
  out[1] = dy / len
  out[2] = dz / len
}

export function keySeen(solid: SdfGrid, x: number, y: number, z: number, dir: readonly number[], spread: number): number {
  const b = x * dir[0]! + y * dir[1]! + z * dir[2]!
  const c = x * x + y * y + z * z - innerRadiusMm * innerRadiusMm
  const far = -b + Math.sqrt(Math.max(0, b * b - c))
  let v = 1
  let t = GRID.skinMm
  while (t < far) {
    const d = sampleSdf(solid, x + dir[0]! * t, y + dir[1]! * t, z + dir[2]! * t)
    const e = d / (GRID.shadeEdgeMm + spread * t)
    if (e < v) {
      if (e <= 0) return 0
      v = e
    }
    t += Math.max(GRID.shadeStepMm, d * GRID.shadeStride)
  }
  return v
}

export function shadeGrid(t: THREE.Texture | null, key: readonly number[], bend: number, spread: number): boolean {
  const info = t ? infos.get(t) : undefined
  if (!t || !info) return false
  const want = [key[0]!, key[1]!, key[2]!, bend, spread]
  if (info.shade && info.shade.every((v, i) => Math.abs(v - want[i]!) < 1e-6)) return false
  const n = GRID.cells
  const size = 2 * innerRadiusMm
  const cells = n * n * n
  const data = (t.image as { data: Uint16Array }).data
  const half = THREE.DataUtils.toHalfFloat
  const shade = new Float32Array(cells)
  const live = new Uint8Array(cells)
  const p = [0, 0, 0]
  const g = [0, 0, 0]
  const dir = [0, 1, 0]
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const c = i + n * (j + n * k)
        p[0] = ((i + 0.5) / n - 0.5) * size
        p[1] = ((j + 0.5) / n - 0.5) * size
        p[2] = ((k + 0.5) / n - 0.5) * size
        const d0 = sampleSdf(info.solid, p[0], p[1], p[2])
        if (d0 < -GRID.deepMm) continue
        if (d0 < GRID.skinMm) lift(info.solid, p, g)
        keyBend(p[0], p[1]!, p[2]!, key, bend, dir)
        shade[c] = keySeen(info.solid, p[0], p[1]!, p[2]!, dir, spread)
        live[c] = 1
      }
    }
  }
  fillDeep(n, live, [{ data: shade, width: 1 }])
  for (let c = 0; c < cells; c++) data[(cells + c) * 4 + 3] = half(shade[c]!)
  info.shade = want
  t.needsUpdate = true
  return true
}

const TAU = 2 * Math.PI

export function breathOf(time: number, period: number): number {
  return 1 + GRID.breath * Math.sin(TAU * (time / period))
}

export function flickerOf(l: InnerLight, time: number, period: number): number {
  const turn = (l.cycles * time) / period + l.phase
  const second = ((2 * l.cycles + 1) * time) / period + 2.7 * l.phase
  return 1 + l.flicker * ((1 - GRID.flickerSecond) * Math.sin(TAU * turn) + GRID.flickerSecond * Math.sin(TAU * second))
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

export function groupGains(info: Pick<GridInfo, 'lights' | 'group'> | undefined, lights: readonly InnerLight[], time: number, period: number, out: THREE.Vector4): THREE.Vector4 {
  const all = gainOf(lights, time, period)
  const sum = [0, 0, 0, 0]
  const weight = [0, 0, 0, 0]
  if (info) {
    info.lights.forEach((l, i) => {
      const k = info.group[i]!
      sum[k]! += l.power * flickerOf(l, time, period)
      weight[k]! += l.power
    })
  }
  const of = (k: number) => (weight[k]! > 0 ? sum[k]! / weight[k]! : all)
  return out.set(of(0), of(1), of(2), of(3))
}

const glowWeight = (l: InnerLight) => l.power * (l.reachMm / GRID.glowReachMm) ** 2

export function glowOf(lights: readonly InnerLight[]): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]
  for (const l of lights) {
    const w = glowWeight(l)
    out[0] += l.color[0] * w
    out[1] += l.color[1] * w
    out[2] += l.color[2] * w
  }
  return out
}

export function glowAt(lights: readonly InnerLight[]): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]
  let weight = 0
  for (const l of lights) {
    const w = glowWeight(l)
    out[0] += l.at[0] * w
    out[1] += l.at[1] * w
    out[2] += l.at[2] * w
    weight += w
  }
  return weight > 0 ? [out[0] / weight, out[1] / weight, out[2] / weight] : out
}
