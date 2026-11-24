import fs from 'node:fs'
import sharp from 'sharp'
import { loadConfig, rel } from '../../tools/lib/paths.mjs'

const cfg = loadConfig()
const OUT = rel('assets-full', 'shared')
fs.mkdirSync(OUT, { recursive: true })

const DETAIL = { px: 2048, tileMm: 163, slopeFull: 1 }
const STONE = { px: 1024, tileMm: 613 }

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)

function octave(out, size, nx, ny, amp, rand) {
  const gx = new Float32Array(nx * ny)
  const gy = new Float32Array(nx * ny)
  for (let i = 0; i < gx.length; i++) {
    const a = rand() * Math.PI * 2
    gx[i] = Math.cos(a)
    gy[i] = Math.sin(a)
  }
  const sx = nx / size
  const sy = ny / size
  for (let y = 0; y < size; y++) {
    const fy = y * sy
    const y0 = Math.floor(fy)
    const ty = fy - y0
    const wy = fade(ty)
    const r0 = (y0 % ny) * nx
    const r1 = ((y0 + 1) % ny) * nx
    for (let x = 0; x < size; x++) {
      const fx = x * sx
      const x0 = Math.floor(fx)
      const tx = fx - x0
      const wx = fade(tx)
      const c0 = x0 % nx
      const c1 = (x0 + 1) % nx
      const a = gx[r0 + c0] * tx + gy[r0 + c0] * ty
      const b = gx[r0 + c1] * (tx - 1) + gy[r0 + c1] * ty
      const c = gx[r1 + c0] * tx + gy[r1 + c0] * (ty - 1)
      const d = gx[r1 + c1] * (tx - 1) + gy[r1 + c1] * (ty - 1)
      out[y * size + x] += amp * 1.5 * ((a + (b - a) * wx) * (1 - wy) + (c + (d - c) * wx) * wy)
    }
  }
}

function fbm(size, nx, ny, octaves, gain, rand) {
  const out = new Float32Array(size * size)
  let amp = 1
  for (let o = 0; o < octaves; o++) {
    octave(out, size, nx << o, ny << o, amp, rand)
    amp *= gain
  }
  return out
}

function sample(field, size, x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const xa = ((x0 % size) + size) % size
  const ya = ((y0 % size) + size) % size
  const xb = (xa + 1) % size
  const yb = (ya + 1) % size
  const a = field[ya * size + xa]
  const b = field[ya * size + xb]
  const c = field[yb * size + xa]
  const d = field[yb * size + xb]
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
}

function warp(field, size, wx, wy, amount) {
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = sample(field, size, x + wx[y * size + x] * amount, y + wy[y * size + x] * amount)
  return out
}

function spread(field) {
  let lo = Infinity
  let hi = -Infinity
  for (const v of field) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const out = new Float32Array(field.length)
  for (let i = 0; i < field.length; i++) out[i] = (field[i] - lo) / (hi - lo)
  return out
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function splat(size, cx, cy, radius, each) {
  const r = Math.ceil(radius)
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) {
      const x = Math.floor(cx) + i
      const y = Math.floor(cy) + j
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (d > radius) continue
      each((((y % size) + size) % size) * size + (((x % size) + size) % size), d)
    }
}

async function detail() {
  const size = DETAIL.px
  const mm = DETAIL.tileMm / size
  const rand = rng(cfg.seed ^ 0x51ab)
  const height = fbm(size, 192, 192, 3, 0.55, rand)
  for (let i = 0; i < height.length; i++) height[i] *= 0.00035
  const swell = fbm(size, 6, 6, 4, 0.5, rand)
  for (let i = 0; i < height.length; i++) height[i] += swell[i] * 0.004
  const dust = new Float32Array(size * size)

  const groove = new Float32Array(size * size)
  const wipe = rand() * Math.PI
  const scratches = 330
  for (let s = 0; s < scratches; s++) {
    let x = rand() * size
    let y = rand() * size
    let angle = rand() < 0.68 ? wipe + (rand() - 0.5) * 0.5 : rand() * Math.PI
    const bend = (rand() - 0.5) * 0.004
    const length = (3 + 90 * Math.pow(rand(), 3.2)) / mm
    const width = 1.1 + rand() * 1.3
    const depth = (0.0006 + 0.0034 * Math.pow(rand(), 2.2)) * (width / 1.5)
    for (let t = 0; t < length; t += 0.5) {
      const ends = Math.min(1, Math.min(t, length - t) / (length * 0.22))
      splat(size, x, y, width, (k, d) => {
        groove[k] = Math.min(groove[k], -depth * ends * (1 - d / width))
      })
      x += Math.cos(angle) * 0.5
      y += Math.sin(angle) * 0.5
      angle += bend * 0.5
    }
  }

  for (let i = 0; i < height.length; i++) height[i] += groove[i]

  const clusters = Array.from({ length: 16 }, () => ({ x: rand() * size, y: rand() * size, r: (5 + rand() * 22) / mm }))
  const place = () => {
    if (rand() < 0.42) {
      const c = clusters[Math.floor(rand() * clusters.length)]
      const a = rand() * Math.PI * 2
      const d = c.r * Math.sqrt(-2 * Math.log(1 - rand() * 0.999)) * 0.6
      return [c.x + Math.cos(a) * d, c.y + Math.sin(a) * d]
    }
    return [rand() * size, rand() * size]
  }
  const grain = (x, y, radius, bright, tall) => {
    splat(size, x, y, radius + 0.8, (k, d) => {
      const u = clamp(d / radius, 0, 1)
      const body = 1 - smooth(0.55, 1.08, d / radius)
      dust[k] = Math.max(dust[k], bright * body)
      height[k] += tall * radius * mm * Math.sqrt(Math.max(0, 1 - u * u))
    })
  }
  for (let i = 0; i < 900; i++) {
    const [x, y] = place()
    grain(x, y, 0.7 + 1.1 * Math.pow(rand(), 1.6), 0.12 + 0.4 * rand(), 0.5)
  }
  for (let i = 0; i < 110; i++) {
    const [x, y] = place()
    grain(x, y, 1.8 + 2.6 * Math.pow(rand(), 1.8), 0.5 + 0.5 * rand(), 0.6)
  }
  for (let i = 0; i < 15; i++) {
    const [x, y] = place()
    const r = 3.6 + 5.4 * Math.pow(rand(), 2)
    const lobes = 2 + Math.floor(rand() * 3)
    for (let l = 0; l < lobes; l++) grain(x + (rand() - 0.5) * r * 1.3, y + (rand() - 0.5) * r * 1.3, r * (0.45 + 0.5 * rand()), 0.75 + 0.25 * rand(), 0.7)
  }
  for (let i = 0; i < 6; i++) {
    let [x, y] = place()
    let angle = rand() * Math.PI * 2
    const length = (1.5 + 7 * rand()) / mm
    const curl = (rand() - 0.5) * 0.05
    const bright = 0.35 + 0.35 * rand()
    for (let t = 0; t < length; t += 0.6) {
      grain(x, y, 0.95, bright, 0.25)
      x += Math.cos(angle) * 0.6
      y += Math.sin(angle) * 0.6
      angle += curl * 0.6 + (rand() - 0.5) * 0.05
    }
  }

  const out = Buffer.alloc(size * size * 3)
  const code = (s) => Math.round(128 + 127 * Math.sign(s) * Math.sqrt(clamp(Math.abs(s) / DETAIL.slopeFull, 0, 1)))
  for (let y = 0; y < size; y++) {
    const up = ((y + size - 1) % size) * size
    const down = ((y + 1) % size) * size
    for (let x = 0; x < size; x++) {
      const k = y * size + x
      const sx = (height[y * size + ((x + 1) % size)] - height[y * size + ((x + size - 1) % size)]) / (2 * mm)
      const sy = (height[down + x] - height[up + x]) / (2 * mm)
      out[k * 3] = code(-sx)
      out[k * 3 + 1] = code(-sy)
      out[k * 3 + 2] = Math.round(dust[k] * 255)
    }
  }
  const file = `${OUT}/scene-slab-detail.lin.tile.png`
  await sharp(out, { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 9 }).toFile(file)
  return file
}

async function stone() {
  const size = STONE.px
  const rand = rng(cfg.seed ^ 0x77e1)
  const wx = fbm(size, 3, 3, 4, 0.5, rand)
  const wy = fbm(size, 3, 3, 4, 0.5, rand)
  const ridge = warp(fbm(size, 3, 3, 5, 0.52, rand), size, wx, wy, 90)
  const ridge2 = warp(fbm(size, 7, 7, 4, 0.5, rand), size, wy, wx, 55)
  const where = spread(fbm(size, 2, 2, 3, 0.5, rand))
  const cloud = spread(warp(fbm(size, 4, 4, 6, 0.55, rand), size, wx, wy, 40))
  const marksA = fbm(size, 2, 56, 4, 0.6, rand)
  const marks = spread(warp(marksA, size, wx, wy, 70))
  const patch = spread(fbm(size, 3, 3, 3, 0.5, rand))
  const out = Buffer.alloc(size * size * 3)
  for (let i = 0; i < size * size; i++) {
    const main = Math.pow(1 - Math.min(1, Math.abs(ridge[i]) * 3.4), 9) * smooth(0.3, 0.7, where[i])
    const thin = Math.pow(1 - Math.min(1, Math.abs(ridge2[i]) * 4.2), 14) * 0.5 * smooth(0.45, 0.8, 1 - where[i])
    out[i * 3] = Math.round(255 * clamp(main + thin, 0, 1))
    out[i * 3 + 1] = Math.round(255 * clamp(Math.pow(cloud[i], 1.6), 0, 1))
    out[i * 3 + 2] = Math.round(255 * clamp(smooth(0.5, 0.9, marks[i]) * smooth(0.35, 0.75, patch[i]), 0, 1))
  }
  const file = `${OUT}/scene-slab-stone.lin.tile.png`
  await sharp(out, { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 9 }).toFile(file)
  return file
}

const files = [await detail(), await stone()]
for (const f of files) console.log(`scene: wrote ${f.replace(rel() + '/', '')}, ${(fs.statSync(f).size / 1e6).toFixed(2)} MB`)
