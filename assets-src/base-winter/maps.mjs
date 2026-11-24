import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { blur, clamp, fbm, hashInt, mix, pnoise, readRgb, smooth, toLinear, toSrgb, writePng } from './lib.mjs'
import { CARVING } from './profile.mjs'
import { PX_PER_MM } from './carve.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RAD = Math.PI / 180

export const WOOD = { tileMm: 28.8, mean: [0.108, 0.047, 0.0245], px: 2048 }
export const BRASS = { tileMm: 12, px: 1024 }
export const SNOW = { tileMm: 6, px: 512 }
export const CARVE = {
  width: 4096,
  height: 1024,
  gutter: 8,
  strips: [
    { from: -130, to: 0, row: 8, rows: 384 },
    { from: 0, to: 130, row: 408, rows: 384 },
    { from: 130, to: 230, row: 808, rows: 208 },
  ],
}

const flipRows = (bytes, w, h, ch) => {
  const out = new Uint8Array(bytes.length)
  const row = w * ch
  for (let y = 0; y < h; y++) out.set(bytes.subarray(y * row, y * row + row), (h - 1 - y) * row)
  return out
}

const byte = (v) => Math.round(clamp(v) * 255)

export async function woodMaps(dir) {
  const src = await readRgb(path.join(HERE, 'gen/wood-take1.png'))
  const n = WOOD.px
  if (src.w !== n || src.h !== n) throw new Error(`the wood sheet must be ${n} px square`)
  const lin = [0, 1, 2].map((c) => {
    const a = new Float32Array(n * n)
    for (let i = 0; i < n * n; i++) a[i] = toLinear(src.rgb[i * 3 + c])
    return a
  })
  const lum = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) lum[i] = 0.2126 * lin[0][i] + 0.7152 * lin[1][i] + 0.0722 * lin[2][i]
  const broad = blur(lum, n, n, 150, false, false)
  let meanBroad = 0
  for (let i = 0; i < n * n; i++) meanBroad += broad[i]
  meanBroad /= n * n
  for (const ch of lin) for (let i = 0; i < n * n; i++) ch[i] *= mix(1, meanBroad / Math.max(broad[i], 1e-4), 0.85)
  const half = n / 2
  const tile = lin.map(() => new Float32Array(n * n))
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const edge = Math.min(x, n - 1 - x, y, n - 1 - y) / n
      const wob = (fbm((x / n) * 6, (y / n) * 24, 6, 24, 5, 3) - 0.5) * 0.16
      const m = smooth(0.03, 0.2, edge + wob)
      const i = y * n + x
      const j = ((y + half) % n) * n + ((x + half) % n)
      for (let c = 0; c < 3; c++) tile[c][i] = lin[c][i] * m + lin[c][j] * (1 - m)
    }
  }
  const means = tile.map((ch) => ch.reduce((a, b) => a + b, 0) / (n * n))
  const colour = new Uint8Array(n * n * 3)
  const out = [0, 0, 0]
  const lum2 = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) {
    const l = (0.2126 * tile[0][i]) / means[0] + (0.7152 * tile[1][i]) / means[1] + (0.0722 * tile[2][i]) / means[2]
    lum2[i] = l
    const k = Math.pow(l, 1.25)
    for (let c = 0; c < 3; c++) {
      const v = WOOD.mean[c] * mix(k, tile[c][i] / means[c], 0.5)
      out[c] += v
      colour[i * 3 + c] = byte(toSrgb(v))
    }
  }
  const bytesColour = await writePng(path.join(dir, 'base-wood.srgb.tile.w1024.png'), n, n, 3, flipRows(colour, n, n, 3))

  const low = blur(lum2, n, n, 14, true, true)
  const fine = blur(lum2, n, n, 0.8, true, true)
  const height = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) height[i] = fine[i] - low[i]
  let rms = 0
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const gx = height[y * n + ((x + 1) % n)] - height[y * n + ((x + n - 1) % n)]
      const gy = height[((y + 1) % n) * n + x] - height[((y + n - 1) % n) * n + x]
      rms += gx * gx + gy * gy
    }
  }
  rms = Math.sqrt(rms / (n * n))
  const strength = 0.3 / Math.max(rms, 1e-6)
  const detail = new Uint8Array(n * n * 3)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const gx = (height[y * n + ((x + 1) % n)] - height[y * n + ((x + n - 1) % n)]) * strength
      const gy = -(height[((y + 1) % n) * n + x] - height[((y + n - 1) % n) * n + x]) * strength
      const l = Math.hypot(gx, gy, 1)
      const pore = clamp((low[i] - fine[i]) * 4.5)
      const dense = clamp((fine[i] - low[i]) * 3)
      detail[i * 3] = byte(0.5 - (0.5 * gx) / l)
      detail[i * 3 + 1] = byte(0.5 - (0.5 * gy) / l)
      detail[i * 3 + 2] = byte(0.46 + 0.42 * pore - 0.16 * dense + (fbm((x / n) * 9, (y / n) * 9, 9, 9, 31, 3) - 0.5) * 0.2)
    }
  }
  const bytesDetail = await writePng(path.join(dir, 'base-wood-detail.lin.tile.w1024.png'), n, n, 3, flipRows(detail, n, n, 3))
  return { mean: out.map((v) => v / (n * n)), bytes: [bytesColour, bytesDetail] }
}

export async function carveMap(dir, f) {
  const { W, H, field, wide } = f
  const gx = new Float32Array(W * H)
  const gy = new Float32Array(W * H)
  const k = CARVING.relief * PX_PER_MM * 0.5
  for (let y = 0; y < H; y++) {
    const ya = Math.max(y - 1, 0)
    const yb = Math.min(y + 1, H - 1)
    for (let x = 0; x < W; x++) {
      gx[y * W + x] = (field[y * W + ((x + 1) % W)] - field[y * W + ((x + W - 1) % W)]) * k
      gy[y * W + x] = (field[yb * W + x] - field[ya * W + x]) * k * (2 / (yb - ya))
    }
  }
  const { width, height, strips } = CARVE
  const out = new Uint8Array(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    out[i * 3] = 128
    out[i * 3 + 1] = 128
    out[i * 3 + 2] = 128
  }
  const tap = (data, x, y) => {
    const x0 = Math.floor(x)
    const fx = x - x0
    const yc = clamp(y, 0, H - 1)
    const y0 = Math.min(Math.floor(yc), H - 2)
    const fy = yc - y0
    const xa = ((x0 % W) + W) % W
    const xb = (xa + 1) % W
    const a = data[y0 * W + xa]
    const b = data[y0 * W + xb]
    const c = data[(y0 + 1) * W + xa]
    const d = data[(y0 + 1) * W + xb]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
  for (const st of strips) {
    for (let r = -CARVE.gutter; r < st.rows + CARVE.gutter; r++) {
      const row = st.row + r
      if (row < 0 || row >= height) continue
      const v = (clamp(r, 0, st.rows - 1) + 0.5) / st.rows
      const y = v * H - 0.5
      for (let x = 0; x < width; x++) {
        const az = st.from + ((st.to - st.from) * x) / (width - 1)
        const fxp = (((az * RAD + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1 * W - 0.5
        const sx = tap(gx, fxp, y)
        const sy = tap(gy, fxp, y)
        const l = Math.hypot(sx, sy, 1)
        const o = (row * width + x) * 3
        out[o] = byte(0.5 - (0.5 * sx) / l)
        out[o + 1] = byte(0.5 - (0.5 * sy) / l)
        out[o + 2] = byte(0.5 + 1.7 * (tap(field, fxp, y) - tap(wide, fxp, y)))
      }
    }
  }
  const bytes = await writePng(path.join(dir, 'base-carve.lin.w2048.png'), width, height, 3, flipRows(out, width, height, 3))
  return { bytes: [bytes] }
}

export async function brassMaps(dir) {
  const n = BRASS.px
  const height = new Float32Array(n * n)
  const tarnish = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n
      const v = y / n
      const scratch = (fbm(u * 5, v * 190, 5, 190, 3, 3) - 0.5) * 0.9 + (fbm(u * 9, v * 64, 9, 64, 8, 2) - 0.5) * 0.5
      const peel = (fbm(u * 26, v * 26, 26, 26, 21, 3) - 0.5) * 0.8
      const cell = pnoise(u * 70, v * 70, 70, 70, 44)
      const pit = smooth(0.74, 0.9, cell) * (0.6 + 0.8 * hashInt(Math.floor(u * 70), Math.floor(v * 70), 9))
      height[y * n + x] = scratch * 0.42 + peel * 0.5 - pit * 1.5
      const blotch = fbm(u * 4, v * 4, 4, 4, 51, 5)
      const speck = smooth(0.62, 0.82, fbm(u * 38, v * 38, 38, 38, 57, 2))
      tarnish[y * n + x] = clamp(smooth(0.42, 0.72, blotch) * 0.8 + pit * 0.75 + speck * 0.5 + scratch * 0.12)
    }
  }
  const colour = new Uint8Array(n * n * 3)
  const detail = new Uint8Array(n * n * 3)
  const bright = [0.93, 0.7, 0.36]
  const dull = [0.42, 0.26, 0.11]
  const green = [0.2, 0.2, 0.12]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const t = tarnish[i]
      const g = smooth(0.7, 1, t) * 0.4
      const gx = (height[y * n + ((x + 1) % n)] - height[y * n + ((x + n - 1) % n)]) * 0.5
      const gy = -(height[((y + 1) % n) * n + x] - height[((y + n - 1) % n) * n + x]) * 0.5
      const l = Math.hypot(gx, gy, 1)
      for (let c = 0; c < 3; c++) colour[i * 3 + c] = byte(toSrgb(mix(mix(bright[c], dull[c], t), green[c], g)))
      detail[i * 3] = byte(0.5 - (0.5 * gx) / l)
      detail[i * 3 + 1] = byte(0.5 - (0.5 * gy) / l)
      detail[i * 3 + 2] = byte(t)
    }
  }
  const a = await writePng(path.join(dir, 'base-brass.srgb.tile.w512.png'), n, n, 3, flipRows(colour, n, n, 3))
  const b = await writePng(path.join(dir, 'base-brass-detail.lin.tile.w512.png'), n, n, 3, flipRows(detail, n, n, 3))
  return { bytes: [a, b] }
}

export async function snowMaps(dir) {
  const n = SNOW.px
  const height = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n
      const v = y / n
      const clump = fbm(u * 5, v * 5, 5, 5, 61, 4)
      const grain = fbm(u * 42, v * 42, 42, 42, 67, 2)
      const crystal = smooth(0.66, 0.9, pnoise(u * 90, v * 90, 90, 90, 73))
      height[y * n + x] = clump * 1.6 + grain * 0.55 + crystal * 0.45
    }
  }
  const colour = new Uint8Array(n * n * 3)
  const detail = new Uint8Array(n * n * 3)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const hgt = height[i]
      const gx = (height[y * n + ((x + 1) % n)] - height[y * n + ((x + n - 1) % n)]) * 2.2
      const gy = -(height[((y + 1) % n) * n + x] - height[((y + n - 1) % n) * n + x]) * 2.2
      const l = Math.hypot(gx, gy, 1)
      const shade = clamp(0.8 + 0.2 * smooth(0.7, 1.7, hgt))
      colour[i * 3] = byte(toSrgb(0.86 * shade))
      colour[i * 3 + 1] = byte(toSrgb(0.9 * shade))
      colour[i * 3 + 2] = byte(toSrgb(0.96 * mix(shade, 1, 0.35)))
      detail[i * 3] = byte(0.5 - (0.5 * gx) / l)
      detail[i * 3 + 1] = byte(0.5 - (0.5 * gy) / l)
      detail[i * 3 + 2] = byte(hashInt(x >> 1, y >> 1, 83))
    }
  }
  const a = await writePng(path.join(dir, 'base-snow.srgb.tile.w256.png'), n, n, 3, flipRows(colour, n, n, 3))
  const b = await writePng(path.join(dir, 'base-snow.lin.tile.w256.png'), n, n, 3, flipRows(detail, n, n, 3))
  return { bytes: [a, b] }
}
