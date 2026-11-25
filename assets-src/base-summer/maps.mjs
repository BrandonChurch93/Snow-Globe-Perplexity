import { blur, clamp, fbm, hashInt, mix, mulberry, smooth, writePng } from './lib.mjs'
import * as P from './profile.mjs'
import { FIELD } from './field.mjs'

export const GRAIN = { px: 512 }
export const SAND = { px: 512, grains: 2600 }

// Row 0 of a picture is its top; the maps are worked out from the foot up.
const up = (bytes, w, h, ch) => {
  const out = new Uint8Array(bytes.length)
  const row = w * ch
  for (let y = 0; y < h; y++) out.set(bytes.subarray(y * row, y * row + row), (h - 1 - y) * row)
  return out
}

const slopeByte = (gx, gy) => {
  const l = Math.hypot(gx, gy, 1)
  return [Math.round(clamp(0.5 - (0.5 * gx) / l) * 255), Math.round(clamp(0.5 - (0.5 * gy) / l) * 255)]
}

// The relief the mesh cannot hold, as a normal in red and green; blue is the cavity (under the middle) and the edge (over it).
export async function carveMap(dir, f) {
  const { W, H } = FIELD
  const fine = blur(f.d, W, H, 2.4, true, false)
  const out = new Uint8Array(W * H * 3)
  const stepV = f.mer.total / (H - 1)
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = j * W + i
      const u = (i + 0.5) / W
      const front = Math.abs(u - 0.5) <= P.FRONT_SHARE / 2
      const stepU = (front ? (2 * P.FRONT_DEG) / (P.FRONT_SHARE * W) : (2 * (180 - P.FRONT_DEG)) / ((1 - P.FRONT_SHARE) * W)) * P.RAD * 56
      const l = j * W + ((i + W - 1) % W)
      const r = j * W + ((i + 1) % W)
      const d = Math.max(j - 1, 0) * W + i
      const t = Math.min(j + 1, H - 1) * W + i
      const hp = (k) => f.d[k] - fine[k]
      const [rb, gb] = slopeByte((hp(r) - hp(l)) / (2 * stepU), (hp(t) - hp(d)) / (2 * stepV))
      out[o * 3] = rb
      out[o * 3 + 1] = gb
      out[o * 3 + 2] = Math.round(clamp(0.5 + 0.55 * (f.d[o] - f.wide[o])) * 255)
    }
  }
  return [await writePng(`${dir}/base-carve.lin.w2048.png`, W, H, 3, up(out, W, H, 3))]
}

// The stone's colour, bed by bed: pale cream, ochre where the bed is soft, and rust in the groove above the foot.
export async function toneMap(dir, f) {
  const { W, H } = FIELD
  const out = new Uint8Array(W * H * 3)
  const cream = [0.93, 0.87, 0.77]
  const ochre = [0.87, 0.76, 0.6]
  const rust = [0.56, 0.31, 0.15]
  const pale = [0.95, 0.91, 0.83]
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = j * W + i
      const A = P.azOfU((i + 0.5) / W) / 360 + 0.5
      const k = f.bed[o]
      const fr = f.frac[o]
      const h = f.hgt[o]
      const bedTone = hashInt(k, 3, 301)
      const soft = smooth(0.35, 0.9, bedTone) * (0.4 + 0.6 * fr)
      const thin = smooth(0.8, 0.96, 0.5 + 0.5 * Math.sin(fr * 6.283 * (2 + Math.floor(3 * hashInt(k, 5, 303))) + 4 * bedTone)) * smooth(0.45, 0.75, hashInt(k, 9, 305))
      const stain = Math.exp(-(((h - f.groove[o] - 0.4) / 2.1) ** 2)) * (0.55 + 0.45 * fbm(A * 14, h / 5, 14, 64, 307, 3))
      const low = smooth(13, 3, h) * 0.35
      const blotch = fbm(A * 9, h / 9, 9, 64, 309, 3)
      const top = smooth(30, 37, h) * 0.5
      let c = [0, 1, 2].map((q) => mix(cream[q], ochre[q], clamp(0.5 * soft + low + 0.45 * (blotch - 0.5))))
      c = c.map((v, q) => mix(v, pale[q], top * (1 - soft)))
      c = c.map((v, q) => mix(v, rust[q], clamp(0.7 * stain + 0.22 * thin * smooth(0.7, 0.9, hashInt(k, 11, 317)))))
      const speck = 0.94 + 0.12 * hashInt(i, j, 311) * hashInt(i >> 1, j >> 1, 313) + 0.05 * (fbm(A * 400, h * 2.2, 400, 512, 315, 2) - 0.5)
      const dark = 1 - 0.3 * clamp(-(f.d[o] - f.wide[o]) * 0.9)
      for (let q = 0; q < 3; q++) out[o * 3 + q] = Math.round(clamp(c[q] * speck * dark) * 255)
    }
  }
  return [await writePng(`${dir}/base-stone.srgb.w2048.png`, W, H, 3, up(out, W, H, 3))]
}

function normalFromHeight(h, n, gain) {
  const out = new Uint8Array(n * n * 3)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const gx = (h[y * n + ((x + 1) % n)] - h[y * n + ((x + n - 1) % n)]) * gain
    const gy = (h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x]) * gain
    const [r, g] = slopeByte(gx, gy)
    out[(y * n + x) * 3] = r
    out[(y * n + x) * 3 + 1] = g
  }
  return out
}

// The stone's grain: packed sand grains held in cement. Normal in red and green, roughness in blue.
export async function grainMap(dir) {
  const n = GRAIN.px
  const rnd = mulberry(811)
  const a = new Float32Array(n * n)
  const b = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) {
    a[i] = rnd()
    b[i] = rnd()
  }
  const fine = blur(a, n, n, 0.9, true, true)
  const coarse = blur(b, n, n, 2.75, true, true)
  const h = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) h[i] = (fine[i] - 0.5) * 5 + (coarse[i] - 0.5) * 9
  const out = normalFromHeight(h, n, 2.8)
  for (let i = 0; i < n * n; i++) out[i * 3 + 2] = Math.round(clamp(0.5 + (fine[i] - 0.5) * 4 - (coarse[i] - 0.5) * 3) * 255)
  return [await writePng(`${dir}/base-grain.lin.tile.w512.png`, n, n, 3, up(out, n, n, 3))]
}

// Loose sand: single grains as small domes, each with its own number in blue (0 where no grain lies), so a thin layer can
// be cut grain by grain.
export async function sandMap(dir) {
  const n = SAND.px
  const rnd = mulberry(977)
  const h = new Float32Array(n * n)
  const id = new Float32Array(n * n)
  for (let g = 0; g < SAND.grains; g++) {
    const cx = rnd() * n
    const cy = rnd() * n
    const r = (9 + 15 * rnd() * rnd()) * (n / 1024)
    const ax = 0.75 + 0.5 * rnd()
    const rot = rnd() * Math.PI
    const top = 0.35 + 0.65 * rnd()
    const tag = 0.06 + 0.94 * rnd()
    const R = Math.ceil(r * 1.3)
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = dx * Math.cos(rot) + dy * Math.sin(rot)
      const y = (-dx * Math.sin(rot) + dy * Math.cos(rot)) / ax
      const q = (x * x + y * y) / (r * r)
      if (q >= 1) continue
      const z = top * Math.pow(1 - q, 0.45) * ((r * 1024) / n / 24 + 0.5)
      const o = ((((Math.round(cy) + dy) % n) + n) % n) * n + ((((Math.round(cx) + dx) % n) + n) % n)
      if (z > h[o]) {
        h[o] = z
        id[o] = tag
      }
    }
  }
  const out = normalFromHeight(h, n, 18)
  for (let i = 0; i < n * n; i++) out[i * 3 + 2] = Math.round(id[i] * 255)
  return [await writePng(`${dir}/base-sand.lin.tile.w512.png`, n, n, 3, up(out, n, n, 3))]
}
