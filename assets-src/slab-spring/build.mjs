import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, rel } from '../../tools/lib/paths.mjs'
import { clamp, mulberry, readRgb, smooth, writePng } from '../base-winter/lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const cfg = loadConfig()
const dir = rel('assets-full', 'spring')
fs.mkdirSync(dir, { recursive: true })
const started = process.hrtime.bigint()

export const COLS = 4
export const ROWS = 3
const CELL = 512
const FILL = 480
const FAR = { px: 2048, halfMm: 520, fromMm: 232, count: 1500, sizeMm: [7, 11.5] }
const PINK = [0.93, 0.72, 0.78]

const flipRows = (bytes, w, h, ch) => {
  const out = new Uint8Array(bytes.length)
  const row = w * ch
  for (let y = 0; y < h; y++) out.set(bytes.subarray(y * row, y * row + row), (h - 1 - y) * row)
  return out
}

const src = await readRgb(path.join(HERE, 'gen/petals-take1.png'))
const cw = src.w / COLS
const ch = src.h / ROWS
const cover = (x, y) => {
  const i = (y * src.w + x) * 3
  return smooth(0.05, 0.2, Math.max(src.rgb[i], src.rgb[i + 1], src.rgb[i + 2]))
}
const tap = (x, y) => {
  const x0 = clamp(Math.floor(x), 0, src.w - 2)
  const y0 = clamp(Math.floor(y), 0, src.h - 2)
  const fx = clamp(x - x0)
  const fy = clamp(y - y0)
  const out = [0, 0, 0, 0]
  for (const [dx, dy, w] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ]) {
    const i = ((y0 + dy) * src.w + x0 + dx) * 3
    for (let c = 0; c < 3; c++) out[c] += w * src.rgb[i + c]
    out[3] += w * cover(x0 + dx, y0 + dy)
  }
  return out
}

const aw = COLS * CELL
const ah = ROWS * CELL
const atlas = new Float32Array(aw * ah * 4)
const aspects = []
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    let x0 = 1e9
    let x1 = -1
    let y0 = 1e9
    let y1 = -1
    for (let y = Math.floor(r * ch) + 4; y < Math.floor((r + 1) * ch) - 4; y++) {
      for (let x = Math.floor(c * cw) + 4; x < Math.floor((c + 1) * cw) - 4; x++) {
        if (cover(x, y) > 0.5) {
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          y0 = Math.min(y0, y)
          y1 = Math.max(y1, y)
        }
      }
    }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    const scale = Math.max(bw, bh) / FILL
    aspects.push(Number((bw / bh).toFixed(3)))
    for (let oy = 0; oy < CELL; oy++) {
      for (let ox = 0; ox < CELL; ox++) {
        const sx = (x0 + x1) / 2 + (ox - CELL / 2) * scale
        const sy = (y0 + y1) / 2 + (oy - CELL / 2) * scale
        const inside = sx >= x0 - 3 && sx <= x1 + 3 && sy >= y0 - 3 && sy <= y1 + 3
        const t = inside ? tap(sx, sy) : [0, 0, 0, 0]
        const o = ((r * CELL + oy) * aw + c * CELL + ox) * 4
        const a = t[3]
        for (let k = 0; k < 3; k++) atlas[o + k] = a > 0.02 ? clamp(t[k] / Math.max(a, 0.3)) * smooth(0.02, 0.3, a) + PINK[k] * (1 - smooth(0.02, 0.3, a)) : PINK[k]
        atlas[o + 3] = a
      }
    }
  }
}
const atlasBytes = new Uint8Array(aw * ah * 4)
for (let i = 0; i < atlas.length; i++) atlasBytes[i] = Math.round(clamp(atlas[i]) * 255)
const a = await writePng(path.join(dir, 'slab-petals.srgb.w1024.png'), aw, ah, 4, flipRows(atlasBytes, aw, ah, 4))
console.log(`petal atlas ${aw} by ${ah}, ${COLS} by ${ROWS} petals, width over height ${aspects.join(' ')}, ${(a / 1e6).toFixed(2)} MB`)

const MINI = 40
const minis = []
for (let k = 0; k < COLS * ROWS; k++) {
  const m = new Float32Array(MINI * MINI * 4)
  const f = CELL / MINI
  const cx = (k % COLS) * CELL
  const cy = Math.floor(k / COLS) * CELL
  for (let y = 0; y < MINI; y++) {
    for (let x = 0; x < MINI; x++) {
      const sum = [0, 0, 0, 0]
      for (let v = 0; v < f; v += 2) {
        for (let u = 0; u < f; u += 2) {
          const i = ((cy + Math.floor(y * f + v)) * aw + cx + Math.floor(x * f + u)) * 4
          const al = atlas[i + 3]
          sum[0] += atlas[i] * al
          sum[1] += atlas[i + 1] * al
          sum[2] += atlas[i + 2] * al
          sum[3] += al
        }
      }
      const n = Math.ceil(f / 2) ** 2
      const o = (y * MINI + x) * 4
      for (let c = 0; c < 4; c++) m[o + c] = sum[c] / n
    }
  }
  minis.push(m)
}

const n = FAR.px
const far = new Float32Array(n * n * 4)
const rng = mulberry(90210)
const plain = [0, 1, 2, 5, 7, 10, 3, 4, 8]
let placed = 0
const mmPx = (2 * FAR.halfMm) / n
while (placed < FAR.count) {
  const x = (rng() * 2 - 1) * FAR.halfMm
  const z = (rng() * 2 - 1) * FAR.halfMm
  const r = Math.hypot(x, z)
  const keep = rng()
  if (r < FAR.fromMm || r > FAR.halfMm - 8 || keep > 0.35 + 0.65 * Math.exp(-(r - FAR.fromMm) / 160)) continue
  placed++
  const size = FAR.sizeMm[0] + (FAR.sizeMm[1] - FAR.sizeMm[0]) * rng()
  const yaw = rng() * 2 * Math.PI
  const mini = minis[plain[Math.floor(rng() * plain.length)]]
  const shade = 0.72 + 0.28 * rng()
  const half = (size / mmPx) * 0.5
  const px = (x + FAR.halfMm) / mmPx
  const pz = (z + FAR.halfMm) / mmPx
  const reach = Math.ceil(half * 1.05)
  const cs = Math.cos(yaw)
  const sn = Math.sin(yaw)
  for (let y = Math.max(0, Math.floor(pz - reach)); y <= Math.min(n - 1, Math.ceil(pz + reach)); y++) {
    for (let xx = Math.max(0, Math.floor(px - reach)); xx <= Math.min(n - 1, Math.ceil(px + reach)); xx++) {
      const dx = (xx - px) / (2 * half)
      const dy = (y - pz) / (2 * half)
      const u = (dx * cs + dy * sn + 0.5) * MINI
      const v = (-dx * sn + dy * cs + 0.5) * MINI
      if (u < 0 || v < 0 || u >= MINI - 1 || v >= MINI - 1) continue
      const u0 = Math.floor(u)
      const v0 = Math.floor(v)
      const fu = u - u0
      const fv = v - v0
      const o = (y * n + xx) * 4
      const s = [0, 0, 0, 0]
      for (const [du, dv, w] of [
        [0, 0, (1 - fu) * (1 - fv)],
        [1, 0, fu * (1 - fv)],
        [0, 1, (1 - fu) * fv],
        [1, 1, fu * fv],
      ]) {
        const i = ((v0 + dv) * MINI + u0 + du) * 4
        for (let c = 0; c < 4; c++) s[c] += w * mini[i + c]
      }
      for (let c = 0; c < 3; c++) far[o + c] = s[c] * shade + far[o + c] * (1 - s[3])
      far[o + 3] = s[3] + far[o + 3] * (1 - s[3])
    }
  }
}
const farBytes = new Uint8Array(n * n * 4)
for (let i = 0; i < n * n; i++) {
  const al = far[i * 4 + 3]
  for (let c = 0; c < 3; c++) farBytes[i * 4 + c] = Math.round(clamp(al > 0.003 ? far[i * 4 + c] / al : PINK[c]) * 255)
  farBytes[i * 4 + 3] = Math.round(clamp(al) * 255)
}
const b = await writePng(path.join(dir, 'slab-far.srgb.w2048.png'), n, n, 4, flipRows(farBytes, n, n, 4))
console.log(`far picture ${n} px over ${2 * FAR.halfMm} mm, ${placed} petals from ${FAR.fromMm} mm out, ${(b / 1e6).toFixed(2)} MB`)
const over = fs.readdirSync(dir).filter((f) => f.startsWith('slab-') && fs.statSync(path.join(dir, f)).size > cfg.repo.maxFileMb * 1e6)
if (over.length) throw new Error(`over ${cfg.repo.maxFileMb} MB: ${over.join(', ')}`)
console.log(`done in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)} s`)
