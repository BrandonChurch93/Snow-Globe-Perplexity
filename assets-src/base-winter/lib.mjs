import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

export function mulberry(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashInt(x, y, seed) {
  let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(seed + 0x165667b1, 0x27d4eb2f)
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const fade = (t) => t * t * (3 - 2 * t)
const wrap = (i, n) => ((i % n) + n) % n

export function pnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = fade(x - x0)
  const fy = fade(y - y0)
  const a = hashInt(wrap(x0, px), wrap(y0, py), seed)
  const b = hashInt(wrap(x0 + 1, px), wrap(y0, py), seed)
  const c = hashInt(wrap(x0, px), wrap(y0 + 1, py), seed)
  const d = hashInt(wrap(x0 + 1, px), wrap(y0 + 1, py), seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

export function fbm(x, y, px, py, seed, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += amp * pnoise(x * f, y * f, px * f, py * f, seed + o * 17)
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

export function blur(src, w, h, sigma, wrapX = false, wrapY = false) {
  if (sigma <= 0) return Float32Array.from(src)
  const radius = Math.max(1, Math.ceil(sigma * 2.6))
  const kernel = new Float32Array(2 * radius + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    kernel[i + radius] = Math.exp((-i * i) / (2 * sigma * sigma))
    sum += kernel[i + radius]
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let a = 0
      for (let k = -radius; k <= radius; k++) {
        let xx = x + k
        if (wrapX) xx = wrap(xx, w)
        else if (xx < 0) xx = 0
        else if (xx >= w) xx = w - 1
        a += src[row + xx] * kernel[k + radius]
      }
      tmp[row + x] = a
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0
      for (let k = -radius; k <= radius; k++) {
        let yy = y + k
        if (wrapY) yy = wrap(yy, h)
        else if (yy < 0) yy = 0
        else if (yy >= h) yy = h - 1
        a += tmp[yy * w + x] * kernel[k + radius]
      }
      out[y * w + x] = a
    }
  }
  return out
}

export async function readRgb(file) {
  const { data, info } = await sharp(file).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  const n = info.width * info.height
  const rgb = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) rgb[i] = data[i] / 255
  return { w: info.width, h: info.height, rgb }
}

export function luminance(img) {
  const n = img.w * img.h
  const l = new Float32Array(n)
  for (let i = 0; i < n; i++) l[i] = 0.2126 * img.rgb[i * 3] + 0.7152 * img.rgb[i * 3 + 1] + 0.0722 * img.rgb[i * 3 + 2]
  return l
}

export const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
export const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const mix = (a, b, t) => a + (b - a) * t

export async function writePng(file, w, h, channels, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await sharp(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), { raw: { width: w, height: h, channels } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(file)
  return fs.statSync(file).size
}

export function sampleBilinear(data, w, h, x, y) {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, w - 1)
  const y1 = Math.min(y0 + 1, h - 1)
  const fx = x - x0
  const fy = y - y0
  const a = data[y0 * w + x0]
  const b = data[y0 * w + x1]
  const c = data[y1 * w + x0]
  const d = data[y1 * w + x1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

export function components(mask, w, h, minArea) {
  const label = new Int32Array(w * h).fill(-1)
  const boxes = []
  const stack = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start] >= 0) continue
    const id = boxes.length
    let x0 = w
    let y0 = h
    let x1 = 0
    let y1 = 0
    let area = 0
    stack.push(start)
    label[start] = id
    while (stack.length) {
      const p = stack.pop()
      const x = p % w
      const y = (p - x) / w
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const q = yy * w + xx
          if (mask[q] && label[q] < 0) {
            label[q] = id
            stack.push(q)
          }
        }
      }
    }
    boxes.push({ x0, y0, x1, y1, area })
  }
  return boxes.filter((b) => b.area >= minArea)
}

export class Soup {
  constructor(name) {
    this.name = name
    this.position = []
    this.normal = []
    this.uv = []
    this.uv2 = []
    this.color = []
    this.index = []
  }
  get count() {
    return this.position.length / 3
  }
  get triangles() {
    return this.index.length / 3
  }
  vert(p, n, uv, uv2, c) {
    this.position.push(p[0], p[1], p[2])
    this.normal.push(n[0], n[1], n[2])
    this.uv.push(uv[0], uv[1])
    this.uv2.push(uv2[0], uv2[1])
    this.color.push(c[0], c[1], c[2])
    return this.count - 1
  }
  tri(a, b, c) {
    this.index.push(a, b, c)
  }
  grid(cols, rows, at, keep) {
    const first = this.count
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = at(i, j)
      this.vert(v.p, v.n, v.uv, v.uv2 ?? [0, 0], v.c ?? [1, 0, 0])
    }
    let vote = 0
    const P = (k) => [this.position[k * 3], this.position[k * 3 + 1], this.position[k * 3 + 2]]
    const N = (k) => [this.normal[k * 3], this.normal[k * 3 + 1], this.normal[k * 3 + 2]]
    const step = Math.max(1, Math.floor(cols / 16))
    for (let j = 0; j + 1 < rows; j += Math.max(1, Math.floor(rows / 6))) {
      for (let i = 0; i + 1 < cols; i += step) {
        const a = first + j * cols + i
        const pa = P(a)
        const pb = P(a + 1)
        const pd = P(a + cols)
        const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]
        const e2 = [pd[0] - pa[0], pd[1] - pa[1], pd[2] - pa[2]]
        const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
        const n = N(a)
        vote += Math.sign(g[0] * n[0] + g[1] * n[1] + g[2] * n[2])
      }
    }
    const flip = vote < 0
    for (let j = 0; j + 1 < rows; j++) {
      for (let i = 0; i + 1 < cols; i++) {
        if (keep && !keep(i, j)) continue
        const a = first + j * cols + i
        const b = a + 1
        const c = a + cols + 1
        const d = a + cols
        if (flip) {
          this.tri(a, c, b)
          this.tri(a, d, c)
        } else {
          this.tri(a, b, c)
          this.tri(a, c, d)
        }
      }
    }
    return first
  }
  mesh(extras) {
    return {
      name: this.name,
      position: Float32Array.from(this.position),
      normal: Float32Array.from(this.normal),
      uv: Float32Array.from(this.uv),
      uv2: Float32Array.from(this.uv2),
      color: Float32Array.from(this.color),
      colorSize: 3,
      index: Uint32Array.from(this.index),
      extras,
    }
  }
}

export const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
