import { blur, sampleBilinear } from './lib.mjs'
import * as P from './profile.mjs'

export const FIELD = { W: 4096, H: 768 }

// The relief as a grid: columns by uOfAz (the front has the most), rows by the length along the meridian.
export function buildField() {
  const { W, H } = FIELD
  const mer = P.meridian()
  const d = new Float32Array(W * H)
  const bed = new Float32Array(W * H)
  const frac = new Float32Array(W * H)
  const seat = new Float32Array(W * H)
  const halo = new Float32Array(W * H)
  const hgt = new Float32Array(W * H)
  const groove = new Float32Array(W * H)
  for (let j = 0; j < H; j++) {
    const s = (j / (H - 1)) * mer.total
    for (let i = 0; i < W; i++) {
      const az = P.azOfU((i + 0.5) / W)
      const r = P.relief(mer, az, s)
      const o = j * W + i
      d[o] = r.d
      bed[o] = r.k
      frac[o] = r.f
      seat[o] = r.seat
      halo[o] = r.halo
      hgt[o] = r.h
      groove[o] = r.gh
    }
  }
  const wide = blur(d, W, H, 14, true, false)
  const broad = blur(d, W, H, 48, true, false)
  const at = (data, u, v) => {
    const x = (((u % 1) + 1) % 1) * W - 0.5
    const y = Math.min(Math.max(v, 0), 1) * (H - 1)
    const xa = Math.min(Math.max(x, 0), W - 1)
    return sampleBilinear(data, W, H, xa, y)
  }
  return { W, H, mer, d, bed, frac, seat, halo, hgt, groove, wide, broad, at, dAt: (az, s) => at(d, P.uOfAz(az), s / mer.total) }
}
