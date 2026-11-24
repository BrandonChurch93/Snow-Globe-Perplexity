import type { SdfGrid } from './stage'

export function sampleSdf(g: SdfGrid, x: number, y: number, z: number): number {
  const n = g.n
  const s = (n - 1) / g.sizeMm
  const half = g.sizeMm / 2
  const fx = Math.min(n - 1.001, Math.max(0, (x + half) * s))
  const fy = Math.min(n - 1.001, Math.max(0, (y + half) * s))
  const fz = Math.min(n - 1.001, Math.max(0, (z + half) * s))
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const iz = Math.floor(fz)
  const tx = fx - ix
  const ty = fy - iy
  const tz = fz - iz
  const d = g.data
  const at = (i: number, j: number, k: number) => d[i + n * (j + n * k)]!
  const x00 = at(ix, iy, iz) * (1 - tx) + at(ix + 1, iy, iz) * tx
  const x10 = at(ix, iy + 1, iz) * (1 - tx) + at(ix + 1, iy + 1, iz) * tx
  const x01 = at(ix, iy, iz + 1) * (1 - tx) + at(ix + 1, iy, iz + 1) * tx
  const x11 = at(ix, iy + 1, iz + 1) * (1 - tx) + at(ix + 1, iy + 1, iz + 1) * tx
  return (x00 * (1 - ty) + x10 * ty) * (1 - tz) + (x01 * (1 - ty) + x11 * ty) * tz
}
