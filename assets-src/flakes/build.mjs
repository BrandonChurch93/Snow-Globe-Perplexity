import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const VARIANTS = 64
const LOBES = 5
const COLUMNS = 8
const SEED = 0x51f1a4e5
const EDGE = 0.85

let s = SEED >>> 0
const rnd = () => {
  s = (s + 0x6d2b79f5) >>> 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const range = (a, b) => a + (b - a) * rnd()
const dir = () => {
  const z = range(-1, 1)
  const a = range(0, 2 * Math.PI)
  const r = Math.sqrt(1 - z * z)
  return [r * Math.cos(a), r * Math.sin(a), z]
}

function clump() {
  const out = [{ p: [0, 0, 0], r: range(0.5, 0.64) }]
  for (let i = 1; i < LOBES; i++) {
    const d = dir()
    const far = range(0.34, 0.62)
    out.push({ p: [d[0] * far, d[1] * far, d[2] * far], r: range(0.24, 0.42) })
  }
  return out
}

function rod() {
  const d = dir()
  const out = []
  for (let i = 0; i < LOBES; i++) {
    const t = (i / (LOBES - 1) - 0.5) * range(1.0, 1.35)
    const j = dir()
    const w = range(0.04, 0.16)
    out.push({ p: [d[0] * t + j[0] * w, d[1] * t + j[1] * w, d[2] * t + j[2] * w], r: range(0.28, 0.44) * (1 - 0.35 * Math.abs(t)) })
  }
  return out
}

function branched() {
  const out = [{ p: [0, 0, 0], r: range(0.36, 0.46) }]
  const turn = range(0, 2 * Math.PI)
  const arms = 3 + Math.floor(rnd() * 2)
  for (let i = 0; i < LOBES - 1; i++) {
    const a = turn + ((i % arms) / arms) * 2 * Math.PI + range(-0.3, 0.3)
    const far = i < arms ? range(0.42, 0.6) : range(0.72, 0.9)
    out.push({ p: [Math.cos(a) * far, Math.sin(a) * far, range(-0.16, 0.16)], r: i < arms ? range(0.26, 0.36) : range(0.16, 0.24) })
  }
  return out
}

function pair() {
  const d = dir()
  const gap = range(0.34, 0.5)
  const out = [
    { p: [d[0] * gap, d[1] * gap, d[2] * gap], r: range(0.42, 0.55) },
    { p: [-d[0] * gap, -d[1] * gap, -d[2] * gap], r: range(0.36, 0.5) },
  ]
  for (let i = 2; i < LOBES; i++) {
    const j = dir()
    const far = range(0.3, 0.75)
    out.push({ p: [j[0] * far, j[1] * far, j[2] * far], r: range(0.16, 0.3) })
  }
  return out
}

function settle(lobes, flat) {
  let wx = 0
  let wy = 0
  let wz = 0
  let w = 0
  for (const l of lobes) {
    l.p[2] *= flat
    const m = l.r * l.r
    wx += l.p[0] * m
    wy += l.p[1] * m
    wz += l.p[2] * m
    w += m
  }
  let reach = 0
  for (const l of lobes) {
    l.p[0] -= wx / w
    l.p[1] -= wy / w
    l.p[2] -= wz / w
    reach = Math.max(reach, Math.hypot(l.p[0], l.p[1], l.p[2]) + EDGE * l.r)
  }
  for (const l of lobes) {
    l.p[0] /= reach
    l.p[1] /= reach
    l.p[2] /= reach
    l.r /= reach
  }
  return lobes
}

const makers = [clump, clump, rod, branched, pair, clump, branched, pair]
const png = new PNG({ width: COLUMNS, height: VARIANTS, colorType: 6 })
png.data.fill(0)
const byte = (v) => Math.max(0, Math.min(255, Math.round(v)))
const table = []
for (let v = 0; v < VARIANTS; v++) {
  const lobes = settle(makers[v % makers.length](), range(0.45, 1))
  table.push(lobes)
  lobes.forEach((l, k) => {
    const o = (v * COLUMNS + k) * 4
    png.data[o] = byte((l.p[0] * 0.5 + 0.5) * 255)
    png.data[o + 1] = byte((l.p[1] * 0.5 + 0.5) * 255)
    png.data[o + 2] = byte((l.p[2] * 0.5 + 0.5) * 255)
    png.data[o + 3] = Math.max(1, byte(l.r * 255))
  })
  for (let k = LOBES; k < COLUMNS; k++) {
    const o = (v * COLUMNS + k) * 4
    png.data[o] = 128
    png.data[o + 1] = 128
    png.data[o + 2] = 128
    png.data[o + 3] = 255
  }
}

const out = path.join(root, 'assets-full', 'shared', 'flake-lobes.lin.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, PNG.sync.write(png, { colorType: 6, deflateLevel: 9 }))

if (process.argv.includes('--sheet')) {
  const cell = 96
  const cols = 16
  const rows = Math.ceil(VARIANTS / cols)
  const sheet = new PNG({ width: cols * cell, height: rows * cell, colorType: 6 })
  for (let v = 0; v < VARIANTS; v++) {
    const ox = (v % cols) * cell
    const oy = Math.floor(v / cols) * cell
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const px = ((x + 0.5) / cell) * 2.6 - 1.3
        const py = 1.3 - ((y + 0.5) / cell) * 2.6
        let f = 0
        for (const l of table[v]) {
          const q = 0.5 * l.r
          f += Math.exp((-0.5 * ((px - l.p[0]) ** 2 + (py - l.p[1]) ** 2)) / (q * q))
        }
        const t = Math.max(0, Math.min(1, (f - 0.2) / 0.35))
        const a = t * t * (3 - 2 * t)
        const o = ((oy + y) * sheet.width + ox + x) * 4
        const g = byte(20 + 235 * a)
        sheet.data[o] = g
        sheet.data[o + 1] = g
        sheet.data[o + 2] = g
        sheet.data[o + 3] = 255
      }
    }
  }
  const to = path.join(root, 'out', 'work', 'flakes', 'variants.png')
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.writeFileSync(to, PNG.sync.write(sheet))
  console.log(`sheet: ${path.relative(root, to)}`)
}
console.log(`flake table: ${VARIANTS} variants of ${LOBES} lobes, ${path.relative(root, out)}, ${fs.statSync(out).size} bytes`)
