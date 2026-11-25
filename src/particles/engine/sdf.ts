import { config } from '../../config'
import type { SdfGrid } from '../../core/stage'

const G = config.globe

export const INNER_R = G.sphereDiameterMm / 2 - G.glassThicknessMm
export const CENTRE_Y = G.baseHeightMm - G.collarDepthMm + G.sphereDiameterMm / 2
export const GROUND_Y = G.islandLevelMm - CENTRE_Y

export type Shape =
  | { kind: 'box'; cx: number; cy: number; cz: number; hx: number; hy: number; hz: number }
  | { kind: 'cone'; cx: number; baseY: number; cz: number; r: number; h: number }
  | { kind: 'ball'; cx: number; cy: number; cz: number; r: number }
  | { kind: 'ground'; y: number }

export interface Emitter {
  x: number
  y: number
  z: number
  r: number
}

function segment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax
  const ey = by - ay
  const t = Math.min(1, Math.max(0, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)))
  return Math.hypot(px - ax - ex * t, py - ay - ey * t)
}

export function shapeDistance(s: Shape, x: number, y: number, z: number): number {
  if (s.kind === 'ground') return y - s.y
  if (s.kind === 'ball') return Math.hypot(x - s.cx, y - s.cy, z - s.cz) - s.r
  if (s.kind === 'box') {
    const dx = Math.abs(x - s.cx) - s.hx
    const dy = Math.abs(y - s.cy) - s.hy
    const dz = Math.abs(z - s.cz) - s.hz
    const out = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0))
    return out + Math.min(Math.max(dx, dy, dz), 0)
  }
  const q = Math.hypot(x - s.cx, z - s.cz)
  const v = y - s.baseY
  const side = segment(q, v, s.r, 0, 0, s.h)
  const foot = segment(q, v, 0, 0, s.r, 0)
  const inside = v > 0 && v < s.h && q < s.r * (1 - v / s.h)
  const d = Math.min(side, foot)
  return inside ? -d : d
}

export function buildSdf(shapes: readonly Shape[], n = 64, sizeMm: number = G.sphereDiameterMm): SdfGrid {
  const data = new Float32Array(n * n * n)
  const half = sizeMm / 2
  const cell = sizeMm / (n - 1)
  let o = 0
  for (let k = 0; k < n; k++) {
    const z = -half + k * cell
    for (let j = 0; j < n; j++) {
      const y = -half + j * cell
      for (let i = 0; i < n; i++, o++) {
        const x = -half + i * cell
        let d = Infinity
        for (const s of shapes) d = Math.min(d, shapeDistance(s, x, y, z))
        data[o] = d
      }
    }
  }
  return { n, sizeMm, data }
}

let empty: SdfGrid | null = null

/** The globe with nothing in it but its ground: what an engine holds until the stage gives it the collider of the season. */
export function emptySdf(): SdfGrid {
  if (!empty) empty = buildSdf([{ kind: 'ground', y: GROUND_Y }])
  return empty
}

export function sdfSlope(g: SdfGrid): number {
  const n = g.n
  const d = g.data
  const inv = (n - 1) / g.sizeMm
  const nn = n * n
  let worst = 0
  for (let k = 0; k < n - 1; k++) {
    for (let j = 0; j < n - 1; j++) {
      let o = n * (j + n * k)
      for (let i = 0; i < n - 1; i++, o++) {
        const a = d[o]!
        const b = d[o + 1]!
        const c = d[o + n]!
        const e = d[o + n + 1]!
        const f = d[o + nn]!
        const g1 = d[o + nn + 1]!
        const h = d[o + nn + n]!
        const m = d[o + nn + n + 1]!
        const gx = Math.max(Math.abs(b - a), Math.abs(e - c), Math.abs(g1 - f), Math.abs(m - h))
        const gy = Math.max(Math.abs(c - a), Math.abs(e - b), Math.abs(h - f), Math.abs(m - g1))
        const gz = Math.max(Math.abs(f - a), Math.abs(g1 - b), Math.abs(h - c), Math.abs(m - e))
        const s = gx * gx + gy * gy + gz * gz
        if (s > worst) worst = s
      }
    }
  }
  return Math.max(1, Math.sqrt(worst) * inv)
}

export function sdfSample(g: SdfGrid, x: number, y: number, z: number, out: Float64Array): number {
  const n = g.n
  const s = (n - 1) / g.sizeMm
  const half = g.sizeMm / 2
  const top = n - 1.001
  let fx = (x + half) * s
  let fy = (y + half) * s
  let fz = (z + half) * s
  fx = fx < 0 ? 0 : fx > top ? top : fx
  fy = fy < 0 ? 0 : fy > top ? top : fy
  fz = fz < 0 ? 0 : fz > top ? top : fz
  const ix = fx | 0
  const iy = fy | 0
  const iz = fz | 0
  const tx = fx - ix
  const ty = fy - iy
  const tz = fz - iz
  const d = g.data
  const o = ix + n * (iy + n * iz)
  const nn = n * n
  const a = d[o]!
  const b = d[o + 1]!
  const c = d[o + n]!
  const e = d[o + n + 1]!
  const f = d[o + nn]!
  const g1 = d[o + nn + 1]!
  const h = d[o + nn + n]!
  const m = d[o + nn + n + 1]!
  const x00 = a + (b - a) * tx
  const x10 = c + (e - c) * tx
  const x01 = f + (g1 - f) * tx
  const x11 = h + (m - h) * tx
  const y0 = x00 + (x10 - x00) * ty
  const y1 = x01 + (x11 - x01) * ty
  out[0] = ((b - a) * (1 - ty) + (e - c) * ty) * (1 - tz) + ((g1 - f) * (1 - ty) + (m - h) * ty) * tz
  out[1] = (x10 - x00) * (1 - tz) + (x11 - x01) * tz
  out[2] = y1 - y0
  return y0 + (y1 - y0) * tz
}
