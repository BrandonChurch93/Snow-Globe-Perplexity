import fs from 'node:fs'
import { writeGlb } from '../../tools/lib/glb.mjs'
import { loadConfig, rel } from '../../tools/lib/paths.mjs'
import { Soup, clamp, fbm, mix, mulberry, norm3, smooth, writePng } from './lib.mjs'

// The dry leaves of fall's slab: one sheet of leaf pictures (eight leaves, colour and cut-out), and one model that lays
// them round the foot: curled ones with real thickness of form near the camera, flat ones further off, crumbs at the foot.
const cfg = loadConfig()
const started = process.hrtime.bigint()
const CELL = 256
const COLS = 4
const ROWS = 2
const FOOT = cfg.globe.baseDiameterMm / 2

// A leaf in its own square: x along the midrib (-1 the stalk, 1 the tip), y across. Each kind gives the half width at x.
const KINDS = [
  { name: 'maple', lobes: 5, deep: 0.34, wide: 0.9, tooth: 0.08 },
  { name: 'oak', lobes: 0, wide: 0.46, wave: 7, deep: 0.2, tooth: 0 },
  { name: 'beech', lobes: 0, wide: 0.5, wave: 0, deep: 0, tooth: 0.05 },
  { name: 'beech', lobes: 0, wide: 0.44, wave: 0, deep: 0, tooth: 0.07 },
  { name: 'birch', lobes: 0, wide: 0.6, wave: 0, deep: 0, tooth: 0.09 },
  { name: 'oak', lobes: 0, wide: 0.4, wave: 9, deep: 0.26, tooth: 0 },
  { name: 'maple', lobes: 5, deep: 0.26, wide: 0.84, tooth: 0.05 },
  { name: 'beech', lobes: 0, wide: 0.36, wave: 0, deep: 0, tooth: 0.03 },
]
const PALETTE = [
  [0.8, 0.42, 0.14],
  [0.55, 0.24, 0.08],
  [0.45, 0.26, 0.12],
  [0.85, 0.58, 0.2],
  [0.7, 0.34, 0.1],
  [0.38, 0.2, 0.09],
  [0.88, 0.5, 0.15],
  [0.6, 0.38, 0.16],
]
function inLeaf(k, x, y, seed) {
  const kind = KINDS[k]
  if (kind.lobes > 0) {
    const cx = x + 0.15
    const r = Math.hypot(cx, y)
    const a = Math.atan2(y, cx)
    const lobe = Math.abs(Math.cos((a * kind.lobes) / 2))
    const reach = kind.wide * (1 - kind.deep + kind.deep * lobe ** 0.7) * (0.72 + 0.28 * Math.cos(a) ** 2) * (1 + kind.tooth * (0.55 * Math.sin(a * kind.lobes * 3.7 + seed) + 0.45 * Math.sin(a * kind.lobes * 8.3 + seed * 1.7)) * (0.35 + 0.65 * Math.sin(a * 2.3 + seed * 0.9) ** 2))
    const notch = smooth(2.75, 3.14, Math.abs(a)) * 0.5
    return reach * (1 - notch) - r
  }
  const t = (x + 0.9) / 1.8
  if (t <= 0 || t >= 1) return -1
  const body = Math.sin(Math.PI * t ** (kind.name === 'birch' ? 0.62 : 0.8)) ** (kind.name === 'beech' ? 0.75 : 0.9)
  const half = kind.wide * body * (1 + (kind.wave ? kind.deep * Math.sin(t * kind.wave * Math.PI + seed) * smooth(0.02, 0.2, t) * smooth(1, 0.85, t) : 0)) * (1 + kind.tooth * (0.55 * Math.sin(t * 41 + seed) + 0.45 * Math.sin(t * 97 + seed * 1.7)) * (0.35 + 0.65 * Math.sin(t * 7 + seed * 0.9) ** 2))
  return half - Math.abs(y)
}
function leafSheet() {
  const w = CELL * COLS
  const h = CELL * ROWS
  const out = new Uint8Array(w * h * 4)
  for (let k = 0; k < COLS * ROWS; k++) {
    const ox = (k % COLS) * CELL
    const oy = Math.floor(k / COLS) * CELL
    const base = PALETTE[k]
    const kind = KINDS[k]
    for (let py = 0; py < CELL; py++) {
      for (let px = 0; px < CELL; px++) {
        const x = ((px + 0.5) / CELL) * 2 - 1
        const y = ((py + 0.5) / CELL) * 2 - 1
        const d = inLeaf(k, x, y, k * 2.3)
        const stalk = Math.abs(y) < 0.022 && x < -0.75 && x > -0.98
        const i = ((oy + py) * w + ox + px) * 4
        const edgeNoise = (fbm(px / 9, py / 9, 64, 64, 40 + k, 3) - 0.5) * 0.09
        const a = stalk ? 1 : smooth(-0.012, 0.012, d + edgeNoise)
        if (a <= 0) continue
        const blot = fbm(px / 40, py / 40, 64, 64, 7 + k, 4)
        const fine = fbm(px / 6, py / 6, 64, 64, 19 + k, 3)
        const rim = smooth(0.16, 0.0, d)
        const ang = kind.lobes > 0 ? Math.atan2(y, x + 0.15) : 0
        const rib = kind.lobes > 0 ? Math.abs(Math.sin((ang * kind.lobes) / 2)) * Math.hypot(x + 0.15, y) : Math.abs(y)
        const mid = Math.exp(-((rib / 0.022) ** 2))
        const sx = kind.lobes > 0 ? 0 : (x + 0.9) * 5.5 - Math.abs(y) * 4.2
        const side = kind.lobes > 0 ? Math.exp(-((Math.abs(Math.sin(Math.hypot(x + 0.15, y) * 14 - rib * 9)) / 0.16) ** 2)) * 0.35 * smooth(0.02, 0.12, rib) : Math.exp(-((Math.abs(sx - Math.round(sx)) / 0.07) ** 2)) * 0.5
        const vein = clamp(mid + side * smooth(0.0, 0.08, d), 0, 1)
        const spots = smooth(0.66, 0.78, fbm(px / 14, py / 14, 64, 64, 90 + k, 2))
        let c = base.map((v, q) => v * mix(0.55, 1.25, blot) * mix(0.85, 1.12, fine) * (q === 1 ? mix(0.8, 1.15, blot) : 1))
        c = c.map((v, q) => mix(v, [0.2, 0.09, 0.035][q], 0.75 * rim * (0.5 + fine) + 0.5 * spots))
        c = c.map((v, q) => mix(v, [0.95, 0.7, 0.34][q] * 0.8, 0.45 * vein))
        if (stalk) c = [0.3, 0.16, 0.07]
        out[i] = Math.round(clamp(c[0]) * 255)
        out[i + 1] = Math.round(clamp(c[1]) * 255)
        out[i + 2] = Math.round(clamp(c[2]) * 255)
        out[i + 3] = Math.round(a * 255)
      }
    }
  }
  // Colour bled outward under the cut-out so a soft edge never shows black.
  for (let pass = 0; pass < 6; pass++) {
    const prev = out.slice()
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (prev[i + 3] > 0 || prev[i] + prev[i + 1] + prev[i + 2] > 0) continue
        let n = 0
        const s = [0, 0, 0]
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const j = (yy * w + xx) * 4
          if (prev[j] + prev[j + 1] + prev[j + 2] === 0) continue
          s[0] += prev[j]
          s[1] += prev[j + 1]
          s[2] += prev[j + 2]
          n++
        }
        if (n) {
          out[i] = Math.round(s[0] / n)
          out[i + 1] = Math.round(s[1] / n)
          out[i + 2] = Math.round(s[2] / n)
        }
      }
    }
  }
  return { w, h, out }
}

function leaves() {
  const soup = new Soup('leaves')
  const rng = mulberry(20311)
  const r = (a, b) => a + (b - a) * rng()
  const RAD = Math.PI / 180
  const placed = []
  const add = (dist, az, size, curl, grid, far) => {
    const cx = dist * Math.sin(az * RAD)
    const cz = dist * Math.cos(az * RAD)
    const yaw = r(0, 2 * Math.PI)
    const k = Math.floor(r(0, COLS * ROWS))
    const id = rng()
    const fold = r(0.1, 0.5) * curl
    const arch = r(-0.35, 0.5) * curl
    const cup = r(0.1, 0.55) * curl
    const twist = r(-0.3, 0.3) * curl
    const tiltA = r(0, 2 * Math.PI)
    const tilt = r(0, 0.22) * curl
    const at = (u, v) => {
      const y = size * (fold * Math.abs(v) + arch * u * u + cup * Math.abs(v) ** 1.6 * (0.5 + 0.5 * u) + twist * u * v + tilt * (u * Math.cos(tiltA) + v * Math.sin(tiltA)))
      return [u * size, y, v * size]
    }
    let low = Infinity
    for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) low = Math.min(low, at((i / (grid - 1)) * 2 - 1, (j / (grid - 1)) * 2 - 1)[1])
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    soup.grid(grid, grid, (i, j) => {
      const u = (i / (grid - 1)) * 2 - 1
      const v = (j / (grid - 1)) * 2 - 1
      const p = at(u, v)
      const e = 0.02
      const pu = at(u + e, v)
      const pv = at(u, v + e)
      const n = norm3([-(pu[1] - p[1]) * (pv[2] - p[2]), (pu[0] - p[0]) * (pv[2] - p[2]), -(pv[1] - p[1]) * (pu[0] - p[0])])
      const wx = p[0] * cos + p[2] * sin
      const wz = -p[0] * sin + p[2] * cos
      const nx = n[0] * cos + n[2] * sin
      const nz = -n[0] * sin + n[2] * cos
      return {
        p: [cx + wx, p[1] - low + 0.06, cz + wz],
        n: [nx, n[1], nz],
        uv: [((k % COLS) + (u * 0.5 + 0.5)) / COLS, 1 - (Math.floor(k / COLS) + (v * 0.5 + 0.5)) / ROWS],
        uv2: [id, far],
        c: [cx / 1100 + 0.5, cz / 1100 + 0.5, size / 32],
      }
    })
    placed.push([cx, cz, size])
  }
  const density = (az) => {
    const f = Math.abs(((az + 540) % 360) - 180)
    const sides = Math.exp(-(((f - 78) / 34) ** 2))
    return (f < 28 ? 0.2 : f < 50 ? 0.4 : 0.6) * (0.25 + 0.75 * sides) + 0.4 * sides
  }
  let near = 0
  let tries = 0
  while (near < 96 && tries++ < 12000) {
    const az = r(-180, 180)
    if (rng() > density(az)) continue
    const size = r(5.0, 8.6) * (rng() < 0.15 ? 1.2 : 1)
    const dist = FOOT + 6 + size * 0.5 + 105 * rng() ** 2.6
    const cx = dist * Math.sin(az * RAD)
    const cz = dist * Math.cos(az * RAD)
    if (placed.some((p) => Math.hypot(p[0] - cx, p[1] - cz) < (p[2] + size) * 0.42)) continue
    add(dist, az, size, r(0.7, 1.35), 5, 0)
    near++
  }
  let crumbs = 0
  while (crumbs < 60) {
    const az = r(-180, 180)
    add(FOOT + 2 + 60 * rng() ** 2.4, az, r(0.9, 2.4), 0.6, 2, 0.5)
    crumbs++
  }
  let far = 0
  while (far < 120) {
    const az = r(-180, 180)
    const dist = FOOT + 110 + 420 * rng() ** 1.2
    add(dist, az, r(5, 10), 0.45, far < 60 ? 4 : 2, 1)
    far++
  }
  return { soup, near, crumbs, far }
}

const sheet = leafSheet()
// The cut-out is kept in straight colour; the colour is stored in sRGB as painted.
const dir = rel('assets-full', 'fall')
fs.mkdirSync(dir, { recursive: true })
const bytes = await writePng(rel('assets-full', 'fall', 'slab-leaves.srgb.w1024.png'), sheet.w, sheet.h, 4, sheet.out)
const model = leaves()
const file = rel('assets-full', 'fall', 'slab-fall.glb')
writeGlb(file, [model.soup.mesh({ footMm: FOOT, centreSpanMm: 1100, sizeSpanMm: 32, cols: COLS, rows: ROWS })], { part: 'surface-dressing-fall' })
console.log(`leaf sheet ${sheet.w} by ${sheet.h}, ${(bytes / 1e6).toFixed(2)} MB; ${model.near} curled leaves, ${model.crumbs} crumbs, ${model.far} far leaves, ${model.soup.triangles} triangles, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`)
console.log(`done in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)} s`)
