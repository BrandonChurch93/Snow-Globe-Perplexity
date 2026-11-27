import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeGlb } from '../../tools/lib/glb.mjs'
import { loadConfig, rel } from '../../tools/lib/paths.mjs'
import { Soup, blur, clamp, cross3, fbm, hashInt, mix, mulberry, norm3, readRgb, smooth, toLinear, toSrgb, writePng } from '../base-winter/lib.mjs'
import { lighter, thin } from './thin.mjs'
import { FLOWERS, LEDGE_PETALS, MUSHROOMS, PATCHES, PROFILE, ROOTS, TRICKLE, TRICKLE_WIDTH, DRIPS } from './layout.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RAD = Math.PI / 180
const cfg = loadConfig()
const G = cfg.globe
const SPHERE_R = G.sphereDiameterMm / 2
const CENTRE_H = G.baseHeightMm - G.collarDepthMm + SPHERE_R
const CUP_R = SPHERE_R + 0.15
const W = 4096
const H = 1024
const R_REF = 58
const MOSS_TILE = 22
const REPEATS = Math.round((2 * Math.PI * R_REF) / MOSS_TILE)
const dir = rel('assets-full', 'spring')
fs.mkdirSync(dir, { recursive: true })
if (W > cfg.assetSets.full.baseMapPx) throw new Error('the base maps are over the full set')
const started = process.hrtime.bigint()

const place = (r, h, az) => [r * Math.sin(az * RAD), h, r * Math.cos(az * RAD)]
const turn = (nr, nh, az) => [nr * Math.sin(az * RAD), nh, nr * Math.cos(az * RAD)]
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const byte = (v) => Math.round(clamp(v) * 255)
const flipRows = (bytes, w, h, ch) => {
  const out = new Uint8Array(bytes.length)
  const row = w * ch
  for (let y = 0; y < h; y++) out.set(bytes.subarray(y * row, y * row + row), (h - 1 - y) * row)
  return out
}

function spline(points, per) {
  const out = []
  const at = (i) => points[Math.min(Math.max(i, 0), points.length - 1)]
  for (let i = 0; i + 1 < points.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let k = 0; k < per; k++) {
      const t = k / per
      out.push(p1.map((_, c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t)))
    }
  }
  out.push(points[points.length - 1].slice())
  return out
}

const mer = (() => {
  const pts = spline(PROFILE, 24)
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  return { pts, s, total: s[s.length - 1] }
})()
const S_MAP = mer.total

function atS(sv) {
  const v = clamp(sv, 0, mer.total)
  let lo = 0
  let hi = mer.s.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (mer.s[mid] <= v) lo = mid
    else hi = mid
  }
  const t = (v - mer.s[lo]) / (mer.s[hi] - mer.s[lo] || 1)
  const a = mer.pts[lo]
  const b = mer.pts[hi]
  const i0 = Math.max(lo - 2, 0)
  const i1 = Math.min(hi + 2, mer.pts.length - 1)
  const l = Math.hypot(mer.pts[i1][0] - mer.pts[i0][0], mer.pts[i1][1] - mer.pts[i0][1]) || 1
  const tr = (mer.pts[i1][0] - mer.pts[i0][0]) / l
  const th = (mer.pts[i1][1] - mer.pts[i0][1]) / l
  return { r: a[0] + (b[0] - a[0]) * t, h: a[1] + (b[1] - a[1]) * t, nr: th, nh: -tr }
}
function sOfH(h) {
  for (let i = 1; i < mer.pts.length; i++) {
    if (mer.pts[i][1] >= h) {
      const a = mer.pts[i - 1]
      const b = mer.pts[i]
      return mer.s[i - 1] + (mer.s[i] - mer.s[i - 1]) * clamp((h - a[1]) / (b[1] - a[1] || 1))
    }
  }
  return mer.total
}
const S_TOP = sOfH(31)
const sOf = (pt) => (pt[1] > 31 ? S_TOP : sOfH(pt[1])) + (pt[2] ?? 0)

const MM_X = (2 * Math.PI * R_REF) / W
const MM_Y = S_MAP / (H - 1)
const xOfAz = (az) => ((az + 180) / 360) * W
const yOfS = (s) => clamp(s / S_MAP, 0, 1) * (H - 1)
const wrapX = (x) => ((x % W) + W) % W

function sample(f, az, s) {
  const x = xOfAz(az) - 0.5
  const y = yOfS(s)
  const x0 = Math.floor(x)
  const y0 = Math.min(Math.floor(y), H - 2)
  const fx = x - x0
  const fy = y - y0
  const a = wrapX(x0)
  const b = wrapX(x0 + 1)
  return (f[y0 * W + a] * (1 - fx) + f[y0 * W + b] * fx) * (1 - fy) + (f[(y0 + 1) * W + a] * (1 - fx) + f[(y0 + 1) * W + b] * fx) * fy
}

function voronoi(cellX, cellY, seed, jitter, warp = 1) {
  const nx = Math.round((W * MM_X) / cellX)
  const ny = Math.ceil((H * MM_Y) / cellY) + 1
  const cw = (W * MM_X) / nx
  const f1 = new Float32Array(W * H)
  const f2 = new Float32Array(W * H)
  const id = new Float32Array(W * H)
  const px = (i, j) => (i + 0.5 + (j & 1) * 0.5 + (hashInt(((i % nx) + nx) % nx, j, seed) - 0.5) * jitter) * cw
  const py = (i, j) => (j + 0.5 + (hashInt(((i % nx) + nx) % nx, j, seed + 7) - 0.5) * jitter) * cellY
  for (let y = 0; y < H; y++) {
    const my = y * MM_Y
    for (let x = 0; x < W; x++) {
      const mx = x * MM_X + (warp ? warp * 3.4 * (fbm((x / W) * 36, (y / H) * 6, 36, 6, seed + 3, 3) - 0.5) : 0)
      const myw = my + (warp ? warp * 2.6 * (fbm((x / W) * 40, (y / H) * 7, 40, 7, seed + 9, 3) - 0.5) : 0)
      const ci = Math.floor(mx / cw)
      const cj = Math.floor(myw / cellY)
      let a = 1e9
      let b = 1e9
      let who = 0
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (let i = ci - 2; i <= ci + 1; i++) {
          const dx = mx - px(i, j)
          const dy = myw - py(i, j)
          const d = Math.hypot(dx, dy)
          if (d < a) {
            b = a
            a = d
            who = hashInt(((i % nx) + nx) % nx, j, seed + 21)
          } else if (d < b) b = d
        }
      }
      const k = y * W + x
      f1[k] = a
      f2[k] = b
      id[k] = who
    }
  }
  return { f1, f2, id }
}

function stampPath(samples, reach, on) {
  for (const p of samples) {
    const cx = xOfAz(p.az)
    const cy = yOfS(p.s)
    const rx = Math.ceil(reach / MM_X)
    const ry = Math.ceil(reach / MM_Y)
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = Math.hypot((x - cx) * MM_X, (y - cy) * MM_Y)
        if (d <= reach) on(y * W + wrapX(x), d, p)
      }
    }
  }
}

function pathOf(points, step, wiggle = 0, seed = 0) {
  const ctrl = points.map((p) => [p[0], sOf(p)])
  const fine = spline(ctrl, 24)
  if (wiggle) fine.forEach((q, i) => {
    const u = i / 24
    const ends = Math.min(1, i / 12, (fine.length - 1 - i) / 12)
    q[0] += wiggle * ends * (1.5 * (fbm(u * 0.9, seed * 0.37, 64, 64, 7, 2) - 0.5) + 0.7 * (fbm(u * 2.7, seed * 0.61, 64, 64, 19, 2) - 0.5))
    q[1] += wiggle * ends * 1.1 * (fbm(u * 1.1, seed * 0.53, 64, 64, 23, 2) - 0.5)
  })
  const out = []
  let length = 0
  let last = null
  let due = 0
  for (const q of fine) {
    const r = atS(q[1]).r
    const here = [q[0] * RAD * r, q[1]]
    if (last) length += Math.hypot(here[0] - last[0], here[1] - last[1])
    last = here
    if (length >= due) {
      out.push({ az: q[0], s: q[1], at: length })
      due += step
    }
  }
  for (const p of out) p.t = p.at / length
  return { samples: out, length }
}

const trickle = pathOf(TRICKLE, 0.28)
const widthAt = (t) => {
  for (let i = 1; i < TRICKLE_WIDTH.length; i++) if (t <= TRICKLE_WIDTH[i][0]) return mix(TRICKLE_WIDTH[i - 1][1], TRICKLE_WIDTH[i][1], smooth(TRICKLE_WIDTH[i - 1][0], TRICKLE_WIDTH[i][0], t))
  return TRICKLE_WIDTH[TRICKLE_WIDTH.length - 1][1]
}
for (const p of trickle.samples) p.w = widthAt(p.t)

console.log(`profile ${mer.total.toFixed(1)} mm long, the shoulder at ${S_TOP.toFixed(1)}; field ${W} by ${H}; trickle ${trickle.length.toFixed(1)} mm`)

const cob = voronoi(9.4, 6.6, 11, 0.95, 0.7)
const tuft = voronoi(5.2, 4.6, 57, 1.0, 1.6)
const sprig = voronoi(0.95, 0.9, 91, 1.0, 0)
const rock = new Float32Array(W * H)
const moss = new Float32Array(W * H)
for (let y = 0; y < H; y++) {
  const s = y * MM_Y
  const m = atS(s)
  for (let x = 0; x < W; x++) {
    const k = y * W + x
    const az = (x / W) * 360 - 180
    const pillow = smooth(0, 3.3, cob.f2[k] - cob.f1[k])
    const lump = fbm((x / W) * 60, (y / H) * 9, 60, 9, 31, 4) - 0.5
    const dome = Math.max(0, 1 - (cob.f1[k] / 4.8) ** 2)
    rock[k] = (1.15 + 1.35 * dome) * Math.sin(1.5708 * pillow) + (cob.id[k] - 0.5) * 1.3 + 1.3 * lump - 1.5
    let tongue = 0
    for (const d of DRIPS) {
      const da = ((az - d[0] + 540) % 360) - 180
      tongue = Math.max(tongue, d[1] * Math.exp(-((da / d[2]) ** 2)))
    }
    const drape = -4.5 + 4 * (fbm((x / W) * 22, 0.5, 22, 1, 71, 3) - 0.5) + 4 * (fbm((x / W) * 76, 0.5, 76, 1, 171, 2) - 0.5) + tongue
    const ragged = 5.0 * (fbm((x / W) * 90, (y / H) * 12, 90, 12, 83, 4) - 0.5) + 3.0 * (1 - pillow)
    let cover = smooth(S_TOP - drape - 1.2, S_TOP - drape + 1.2, s + ragged)
    let patch = smooth(0.58, 0.78, fbm((x / W) * 26, (y / H) * 4, 26, 4, 97, 4) + 0.16 * (1 - pillow))
    const frayed = 0.3 * (fbm((x / W) * 110, (y / H) * 16, 110, 16, 41, 3) - 0.5) + 0.2 * (1 - pillow)
    for (const p of PATCHES) {
      const da = (((az - p[0] + 540) % 360) - 180) * RAD * m.r
      const dh = m.h - p[1]
      patch = Math.max(patch, smooth(1.0, 0.35, Math.hypot(da / p[2], dh / p[3]) - 1.6 * frayed))
    }
    const seam = smooth(0.34, 0.04, pillow) * smooth(0.5, 0.74, fbm((x / W) * 34, (y / H) * 5, 34, 5, 211, 3) + 0.25 * smooth(8, 30, m.h))
    cover = Math.max(cover, patch * smooth(0.5, 3.5, s), 0.42 * seam * smooth(0.5, 3.5, s))
    const fine = fbm((x / W) * 420, (y / H) * 60, 420, 60, 149, 3) - 0.5
    moss[k] = clamp(cover + 2.6 * fine * cover * (1 - cover))
  }
}

const band = new Float32Array(W * H).fill(99)
const along = new Float32Array(W * H)
stampPath(trickle.samples, 7, (k, d, p) => {
  const v = d / (0.5 * p.w)
  if (v < band[k]) {
    band[k] = v
    along[k] = p.t
  }
})
const rockRaw = Float32Array.from(rock)
rock.set(blur(rockRaw, W, H, 0.75 / MM_X, true, false))
const rockSoft = blur(rock, W, H, 1.2 / MM_X, true, false)
for (let k = 0; k < W * H; k++) {
  const bed = smooth(2.4, 0.7, band[k])
  rock[k] = mix(rock[k], rockSoft[k] - 0.2, bed)
  moss[k] *= smooth(0.3, 1.3, band[k])
}

const rockWide = blur(rock, W, H, 2.2 / MM_X, true, false)
const mossSoft = blur(moss, W, H, 1.3 / MM_X, true, false)
const rockBroad = blur(rockWide, W, H, 4 / MM_X, true, false)
const height = new Float32Array(W * H)
for (let y = 0; y < H; y++) {
  const s = y * MM_Y
  const top = smooth(S_TOP - 5, S_TOP + 2, s)
  const seat = 1 - smooth(S_MAP - 4.5, S_MAP - 0.5, s)
  for (let x = 0; x < W; x++) {
    const k = y * W + x
    const c = moss[k]
    const mound = smooth(0, 2.6, tuft.f2[k] - tuft.f1[k])
    const star = smooth(0, 0.6, sprig.f2[k] - sprig.f1[k])
    const cushion = 0.46 * Math.pow(mound, 0.8) + 0.3 * fbm((x / W) * 64, (y / H) * 10, 64, 10, 173, 3) + 0.24 * fbm((x / W) * 150, (y / H) * 22, 150, 22, 131, 3)
    const thick = (0.25 + 1.9 * cushion + 0.55 * top * seat + 0.55 * (tuft.id[k] - 0.5) + 0.3 * star * star * (0.35 + sprig.id[k])) * smooth(0.12, 0.95, c) * smooth(0.3, 0.92, mossSoft[k])
    height[k] = mix(rock[k], Math.max(rock[k], mix(rockWide[k], rockBroad[k] + 0.5, 0.8) + 0.15) + thick, smooth(0.12, 0.6, c))
  }
}

const THIN = { rock: { share: 0.74, error: 0.06 }, growth: { share: 0.74, error: 0.06 }, levels: { medium: { error: 0.18, worth: 1 }, low: { error: 0.3, worth: 1 } } }
const roots = []
const rng = mulberry(4401)
const pushRoot = (spec) => {
  const p = pathOf(spec.pts, 0.8, spec.keep ? 1.2 : 2.2, roots.length + 1)
  spec = { ...spec, r: spec.r * (spec.keep ? 0.8 : spec.fine ? 1 : spec.r > 1.3 ? 0.92 : 0.74) }
  roots.push({ ...spec, ...p })
  return p
}
for (const spec of ROOTS) {
  const p = pushRoot(spec)
  const twigs = spec.keep ? 0 : (spec.twigs ?? 0) + 2
  for (let i = 0; i < twigs; i++) {
    const from = p.samples[Math.floor(p.samples.length * (0.25 + 0.6 * rng()))]
    const side = rng() < 0.5 ? -1 : 1
    const len = 6 + 11 * rng()
    const r = atS(from.s).r
    const pts = []
    let az = from.az
    let h = atS(from.s).h
    let lean = side * (0.6 + 0.8 * rng())
    for (let j = 0; j < 5; j++) {
      pts.push([az, Math.max(h, 0.2)])
      az += ((lean * len) / 4 / r) / RAD
      h -= (len / 4) * (0.5 + 0.5 * rng())
      lean += 0.7 * (rng() - 0.5)
    }
    if (from.s < S_TOP) pushRoot({ r: Math.max(0.3, spec.r * 0.62 * (0.5 + 0.3 * rng()) * (1 - 0.5 * from.t)), pts, twigs: 0, fine: true })
  }
}
for (let i = 0; i < 11; i++) {
  let az = -92 + (184 * (i + rng())) / 11
  let h = 20 + 12 * rng()
  const pts = [[az, h]]
  let lean = (rng() - 0.5) * 3.2
  while (h > 0.5) {
    az += lean * 2.6 + 5 * (rng() - 0.5)
    h -= 3.5 + 3.5 * rng()
    lean += 1.2 * (rng() - 0.5)
    pts.push([az, Math.max(h, 0.2)])
  }
  if (pts.length > 2) pushRoot({ r: 0.38 + 0.36 * rng(), pts, twigs: 0, fine: true })
}
for (let i = 0; i < 12; i++) {
  let az = 100 + (160 * (i + rng())) / 12
  const pts = [[az, 35, 1]]
  let h = 33
  const lean = (rng() - 0.5) * 2.4
  while (h > 0.5) {
    az += lean * 4 + 6 * (rng() - 0.5)
    h -= 5 + 4 * rng()
    pts.push([az, Math.max(h, 0.2)])
  }
  pushRoot({ r: 0.7 + 1.1 * rng(), pts, twigs: -2 })
}
const shade = new Float32Array(W * H)
for (const root of roots) {
  stampPath(root.samples, root.r * 2.6 + 0.4, (k, d, p) => {
    const rr = root.r * taper(root, p.t)
    const v = Math.exp(-((Math.max(d - 0.6 * rr, 0) / (0.9 * rr + 0.3)) ** 2))
    if (v > shade[k]) shade[k] = v
  })
}
function taper(root, t) {
  return root.keep ? 1 : mix(1.25, 0.32, Math.pow(t, 1.1))
}

const low = blur(height, W, H, 6, true, false)
const wide = blur(height, W, H, 2.6 / MM_X, true, false)
const sheets = {}
for (const name of ['moss', 'stone', 'bark']) sheets[name] = await sheet(name)

function soften(src, n, by, sigma, wrap) {
  const m = n / by
  const small = new Float32Array(m * m)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) small[Math.floor(y / by) * m + Math.floor(x / by)] += src[y * n + x] / (by * by)
  const soft = blur(small, m, m, sigma, wrap, wrap)
  const out = new Float32Array(n * n)
  const at = (i) => (wrap ? ((i % m) + m) % m : Math.min(Math.max(i, 0), m - 1))
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) / by - 0.5
    const y0 = Math.floor(v)
    const fy = v - y0
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / by - 0.5
      const x0 = Math.floor(u)
      const fx = u - x0
      out[y * n + x] = (soft[at(y0) * m + at(x0)] * (1 - fx) + soft[at(y0) * m + at(x0 + 1)] * fx) * (1 - fy) + (soft[at(y0 + 1) * m + at(x0)] * (1 - fx) + soft[at(y0 + 1) * m + at(x0 + 1)] * fx) * fy
    }
  }
  return out
}

async function sheet(name) {
  const src = await readRgb(path.join(HERE, `gen/${name}-take1.png`))
  const n = src.w
  const lin = [0, 1, 2].map((c) => {
    const a = new Float32Array(n * n)
    for (let i = 0; i < n * n; i++) a[i] = toLinear(src.rgb[i * 3 + c])
    return a
  })
  const lum = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) lum[i] = 0.2126 * lin[0][i] + 0.7152 * lin[1][i] + 0.0722 * lin[2][i]
  const broad = soften(lum, n, 8, 17.5, false)
  let mean = 0
  for (let i = 0; i < n * n; i++) mean += broad[i]
  mean /= n * n
  for (const ch of lin) for (let i = 0; i < n * n; i++) ch[i] *= mix(1, mean / Math.max(broad[i], 1e-4), 0.8)
  const half = n / 2
  const tile = lin.map(() => new Float32Array(n * n))
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const edge = Math.min(x, n - 1 - x, y, n - 1 - y) / n
      const wob = (fbm((x / n) * 12, (y / n) * 12, 12, 12, 5, 3) - 0.5) * 0.16
      const m = smooth(0.03, 0.2, edge + wob)
      const i = y * n + x
      const j = ((y + half) % n) * n + ((x + half) % n)
      for (let c = 0; c < 3; c++) tile[c][i] = lin[c][i] * m + lin[c][j] * (1 - m)
    }
  }
  const colour = new Uint8Array(n * n * 3)
  const tone = new Float32Array(n * n)
  let sum = [0, 0, 0]
  for (let i = 0; i < n * n; i++) {
    for (let c = 0; c < 3; c++) {
      colour[i * 3 + c] = byte(toSrgb(tile[c][i]))
      sum[c] += tile[c][i]
    }
    tone[i] = Math.sqrt(0.2126 * tile[0][i] + 0.7152 * tile[1][i] + 0.0722 * tile[2][i])
  }
  const soft = blur(tone, n, n, 1.1, true, true)
  const body = soften(tone, n, 4, 3.5, true)
  const detail = new Uint8Array(n * n * 3)
  const gain = name === 'moss' ? 9 : name === 'bark' ? 7 : 5
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const dx = (soft[y * n + ((x + 1) % n)] - soft[y * n + ((x + n - 1) % n)]) * gain
      const dy = (soft[((y + 1) % n) * n + x] - soft[((y + n - 1) % n) * n + x]) * gain
      const l = Math.sqrt(1 + dx * dx + dy * dy)
      detail[i * 3] = byte(0.5 - (0.5 * dx) / l)
      detail[i * 3 + 1] = byte(0.5 - (0.5 * dy) / l)
      detail[i * 3 + 2] = byte(0.5 + 2.2 * (soft[i] - body[i]))
    }
  }
  const a = await writePng(path.join(dir, `base-${name}.srgb.tile.w512.png`), n, n, 3, flipRows(colour, n, n, 3))
  const b = await writePng(path.join(dir, `base-${name}-detail.lin.tile.w512.png`), n, n, 3, flipRows(detail, n, n, 3))
  console.log(`${name} sheet ${n} px, mean linear colour ${sum.map((v) => (v / (n * n)).toFixed(4)).join(', ')}, ${((a + b) / 1e6).toFixed(2)} MB`)
  return { mean: sum.map((v) => v / (n * n)) }
}

const relief = new Uint8Array(W * H * 3)
const cover = new Uint8Array(W * H * 3)
for (let y = 0; y < H; y++) {
  const s = y * MM_Y
  const m = atS(s)
  const mmx = (2 * Math.PI * m.r) / W
  const y0 = Math.max(y - 1, 0)
  const y1 = Math.min(y + 1, H - 1)
  for (let x = 0; x < W; x++) {
    const k = y * W + x
    const fine = (i) => height[i] - low[i]
    const dx = (fine(y * W + wrapX(x + 1)) - fine(y * W + wrapX(x - 1))) / (2 * mmx)
    const dy = (fine(y1 * W + x) - fine(y0 * W + x)) / ((y1 - y0) * MM_Y)
    const l = Math.sqrt(1 + dx * dx + dy * dy)
    const cavity = clamp(0.62 + (height[k] - wide[k]) * 0.3) * (1 - 0.55 * shade[k]) * mix(0.55, 1, smooth(0, 5, s))
    relief[k * 3] = byte(0.5 - (0.5 * dx) / l)
    relief[k * 3 + 1] = byte(0.5 - (0.5 * dy) / l)
    relief[k * 3 + 2] = byte(cavity)
    const wet = Math.max(smooth(2.6, 0.9, band[k]), 0.55 * smooth(5, 0.5, m.h) * smooth(0.3, 0.8, fbm((x / W) * 50, (y / H) * 8, 50, 8, 211, 3) + 0.25 * smooth(3, 0, m.h)))
    cover[k * 3] = byte(0.3 * smooth(0.04, 0.6, mossSoft[k]) + 0.7 * smooth(0.25, 0.8, moss[k]))
    cover[k * 3 + 1] = byte(wet)
    cover[k * 3 + 2] = byte(band[k] < 4 ? along[k] : 1)
  }
}
const mapBytes = (await writePng(path.join(dir, 'base-relief.lin.w2048.png'), W, H, 3, flipRows(relief, W, H, 3))) + (await writePng(path.join(dir, 'base-cover.lin.w2048.png'), W, H, 3, flipRows(cover, W, H, 3)))
console.log(`relief and cover maps ${(mapBytes / 1e6).toFixed(2)} MB`)

const C = [0, CENTRE_H, 0]
function outside(p) {
  const d = sub(p, C)
  const l = Math.hypot(d[0], d[1], d[2])
  return l < CUP_R ? add(C, d, CUP_R / l) : p
}
function surf(az, s, field, liftMm = 0) {
  const m = atS(s)
  const d = sample(field, az, s) * seatOf(s) + liftMm
  return { p: outside(place(m.r + m.nr * d, m.h + m.nh * d, az)), n: turn(m.nr, m.nh, az), r: m.r }
}
function seatOf(s) {
  return 1 - smooth(S_MAP - 3, S_MAP, s)
}

function buildRock() {
  const soup = new Soup('rock')
  const cols = 541
  const rows = []
  for (let s = 0; s < S_MAP; s += 0.52) rows.push({ s })
  rows.push({ s: S_MAP })
  const end = PROFILE[PROFILE.length - 1]
  for (const t of [0.12, 0.3, 0.5, 0.7, 0.88, 1]) rows.push({ s: S_MAP, cup: [end[0] * (1 - t), mix(end[1] - 2, CENTRE_H - CUP_R, t)] })
  const pos = rows.map((row) => {
    const line = []
    for (let i = 0; i < cols; i++) {
      const az = -180 + (360 * i) / (cols - 1)
      line.push(row.cup ? outside(place(row.cup[0], row.cup[1], az)) : surf(az, row.s, low).p)
    }
    return line
  })
  soup.grid(cols, rows.length, (i, j) => {
    const az = -180 + (360 * i) / (cols - 1)
    const a = pos[j][(i + cols - 2) % (cols - 1)]
    const b = pos[j][(i + 1) % (cols - 1)]
    const c = pos[Math.max(j - 1, 0)][i]
    const d = pos[Math.min(j + 1, rows.length - 1)][i]
    let n = norm3(cross3(sub(b, a), sub(d, c)))
    if (!(Math.hypot(n[0], n[1], n[2]) > 0.5)) n = [0, 1, 0]
    const out = turn(1, 0.3, az)
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = [-n[0], -n[1], -n[2]]
    const s = rows[j].s
    return { p: pos[j][i], n, uv: [(az / 360 + 0.5) * REPEATS, s / MOSS_TILE], uv2: [(az + 180) / 360, (yOfS(s) + 0.5) / H], c: [rows[j].cup ? 0 : 1, 0, 0] }
  })
  return soup
}

function tube(soup, centres, radii, colour, uvScale, flat = 0.9, sides = 8) {
  const first = soup.count
  let run = 0
  for (let i = 0; i < centres.length; i++) {
    const c = centres[i]
    const t = norm3(sub(centres[Math.min(i + 1, centres.length - 1)].p, centres[Math.max(i - 1, 0)].p))
    const side = norm3(cross3(t, c.n))
    const up = norm3(cross3(side, t))
    if (i > 0) run += Math.hypot(...sub(c.p, centres[i - 1].p))
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * 2 * Math.PI
      const n = norm3(add([side[0] * Math.cos(a), side[1] * Math.cos(a), side[2] * Math.cos(a)], up, Math.sin(a)))
      const p = add(add(c.p, side, Math.cos(a) * radii[i]), up, Math.sin(a) * radii[i] * flat)
      soup.vert(p, n, [run / uvScale[1], (k / sides) * uvScale[0]], [c.mark ?? 1, mix(0.45, 1, 0.5 + 0.5 * Math.sin(a))], colour(i, k))
    }
  }
  for (let i = 0; i + 1 < centres.length; i++) {
    for (let k = 0; k < sides; k++) {
      const a = first + i * (sides + 1) + k
      const b = a + sides + 1
      soup.tri(a, b, a + 1)
      soup.tri(a + 1, b, b + 1)
    }
  }
}

function buildGrowth() {
  const soup = new Soup('growth')
  let rootTriangles = 0
  for (const root of roots) {
    const tint = 0.75 + 0.5 * rng()
    const knot = 6.283 * rng()
    const centres = root.samples.map((q) => {
      const rr = Math.max(root.r * taper(root, q.t), 0.17)
      const g = surf(q.az, q.s, rockWide, 0.45 * rr)
      return { p: g.p, n: g.n, rr }
    })
    const before = soup.triangles
    const gnarl = (i) => 1 + 0.13 * Math.sin(i * 0.31 + knot) + 0.07 * Math.sin(i * 0.9 + 2.7 * knot)
    tube(soup, centres, centres.map((c, i) => c.rr * gnarl(i)), (i) => { const v = tint * (0.86 + 0.2 * Math.sin(i * 0.33 + 1.7 * knot)); return [v, v, v] }, [1, 14], 1.0, root.r > 1.1 ? 10 : 6)
    rootTriangles += soup.triangles - before
  }
  const caps = []
  for (const cap of MUSHROOMS) {
    caps.push(cap)
    const more = cap[2] > 1.2 ? 2 : cap[2] > 0.95 ? 1 : 0
    for (let i = 0; i < more; i++) caps.push([cap[0] + (i ? -1 : 1) * (1.6 + 1.6 * rng()) * (cap[2] / 1.6), Math.max(cap[1] - 1.2 - 2.2 * rng(), 1.5), cap[2] * (0.42 + 0.22 * rng())])
  }
  for (let i = 0; i < 14; i++) caps.push([95 + 170 * rng(), 6 + 26 * rng(), 0.9 + 1.2 * rng()])
  for (const [az, h, R] of caps) {
    const s = sOf([az, h])
    const g = surf(az, s, height, -0.2)
    const len = R * (2.3 + 1.5 * rng())
    const lean = norm3(add(add(g.n, [0, 1, 0], 1.5), [rng() - 0.5, 0, rng() - 0.5], 0.5))
    const p1 = add(g.p, g.n, len * 0.5)
    const p2 = add(p1, lean, len * 0.6)
    const stem = []
    for (let i = 0; i <= 5; i++) {
      const t = i / 5
      const p = add(add([g.p[0] * (1 - t) * (1 - t), g.p[1] * (1 - t) * (1 - t), g.p[2] * (1 - t) * (1 - t)], p1, 2 * t * (1 - t)), p2, t * t)
      stem.push({ p, n: norm3(cross3(lean, [lean[2], 0.3, -lean[0]])), mark: 0 })
    }
    const pale = [0.62 + 0.1 * rng(), 0.54, 0.42]
    tube(soup, stem, stem.map((_, i) => R * mix(0.3, 0.2, i / 5)), (i) => pale.map((v) => v * mix(0.55, 1, i / 5)), [1, 4], 1)
    const axis = norm3(sub(p2, p1))
    const u = norm3(cross3(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]))
    const v = cross3(axis, u)
    const tan = [0.36 + 0.12 * rng(), 0.21 + 0.06 * rng(), 0.1 + 0.03 * rng()]
    const dark = tan.map((c) => c * 0.5)
    const prof = [
      [0, 0.52, 0, 1],
      [0.28, 0.5, 0.1, 1],
      [0.58, 0.4, 0.5, 1],
      [0.84, 0.24, 0.85, 1],
      [1, 0.04, 1, 0.9],
      [0.96, -0.06, 2, 0.6],
      [0.6, -0.03, 2, 0.45],
      [0.22, 0.02, 2, 0.4],
    ]
    const sides = 14
    const first = soup.count
    for (let j = 0; j < prof.length; j++) {
      const [pr, ph, zone, ao] = prof[j]
      const a = prof[Math.max(j - 1, 0)]
      const b = prof[Math.min(j + 1, prof.length - 1)]
      const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nr = -(b[1] - a[1]) / tl
      const nh = (b[0] - a[0]) / tl
      for (let k = 0; k <= sides; k++) {
        const ang = (k / sides) * 2 * Math.PI
        const wob = 1 + 0.08 * Math.sin(ang * 3 + az)
        const radial = add([u[0] * Math.cos(ang), u[1] * Math.cos(ang), u[2] * Math.cos(ang)], v, Math.sin(ang))
        const p = add(add(p2, radial, pr * R * wob), axis, ph * R * 1.15)
        const n = norm3(add([radial[0] * nr, radial[1] * nr, radial[2] * nr], axis, zone === 2 ? -Math.abs(nh) - 0.3 : nh))
        const col = zone === 2 ? [0.6, 0.5, 0.38] : [0, 1, 2].map((c) => mix(dark[c], tan[c], smooth(0, 0.7, zone)) * mix(1, 1.25, smooth(0.8, 1, zone)))
        soup.vert(p, n, [k / sides, j / prof.length], [0, ao], col)
      }
    }
    for (let j = 0; j + 1 < prof.length; j++) {
      for (let k = 0; k < sides; k++) {
        const a = first + j * (sides + 1) + k
        const b = a + sides + 1
        soup.tri(a, a + 1, b)
        soup.tri(a + 1, b + 1, b)
      }
    }
  }
  const leaf = (centre, n, radius, colour, turnBy, long = 1.5, cupped = 0.25) => {
    const u0 = norm3(cross3(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]))
    const v0 = cross3(n, u0)
    const u = add([u0[0] * Math.cos(turnBy), u0[1] * Math.cos(turnBy), u0[2] * Math.cos(turnBy)], v0, Math.sin(turnBy))
    const v = cross3(n, u)
    const first = soup.count
    soup.vert(add(centre, n, -cupped * radius * 0.4), n, [0.5, 0.5], [0, 1], colour)
    const seg = 10
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * 2 * Math.PI
      const edge = add(add(add(centre, u, Math.cos(a) * radius * long), v, Math.sin(a) * radius), n, cupped * radius * (0.4 + 0.6 * Math.cos(a) ** 2))
      soup.vert(edge, norm3(add(n, add([u[0] * Math.cos(a), u[1] * Math.cos(a), u[2] * Math.cos(a)], v, Math.sin(a)), -cupped)), [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)], [0, 1], colour.map((c) => c * 0.86))
    }
    for (let k = 0; k < seg; k++) soup.tri(first, first + 1 + k, first + 2 + k)
  }
  for (const [az, h, extra] of FLOWERS) {
    const g = surf(az, sOf([az, h, extra]), height, 0.7)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 2 * Math.PI + az
      const side = norm3(cross3(g.n, [0, 1, 0.01]))
      const upv = cross3(side, g.n)
      const c = add(add(g.p, side, Math.cos(a) * 0.62), upv, Math.sin(a) * 0.62)
      leaf(c, g.n, 0.42, [0.92, 0.9, 0.86], a, 1.35, 0.3)
    }
    leaf(add(g.p, g.n, 0.12), g.n, 0.24, [0.85, 0.62, 0.12], 0, 1, -0.5)
  }
  for (const [az, h, extra, size] of LEDGE_PETALS) {
    const g = surf(az, sOf([az, h, extra]), height, 0.25)
    const n = norm3(add(g.n, [rng() - 0.5, rng() * 0.3, rng() - 0.5], 0.5))
    leaf(g.p, n, size * (0.52 + 0.2 * rng()), [0.8, 0.54 + 0.1 * rng(), 0.58 + 0.08 * rng()], rng() * 6.28, 1.2 + 0.4 * rng(), 0.3)
  }
  return { soup, rootTriangles }
}

function buildWater() {
  const soup = new Soup('water')
  const across = 9
  const list = trickle.samples
  soup.grid(across, list.length, (i, j) => {
    const q = list[j]
    const u = (i / (across - 1)) * 2 - 1
    const m = atS(q.s)
    const hw = 0.5 * q.w * 1.5
    const g = surf(q.az + ((u * hw) / m.r) / RAD, q.s, wide, 0.3 + 0.4 * (1 - u * u))
    const sideways = turn(0, 0, 0)
    sideways[0] = Math.cos(q.az * RAD)
    sideways[2] = -Math.sin(q.az * RAD)
    return { p: g.p, n: norm3(add(g.n, sideways, 0.7 * u)), uv: [u * 0.5 + 0.5, q.t], uv2: [q.at, q.w], c: [1, 0, 0] }
  })
  return soup
}

const rockSoup = buildRock()
const growth = buildGrowth()
const water = buildWater()
const foot = surf(trickle.samples[trickle.samples.length - 1].az, 0, wide).p
const extras = {
  rock: { repeats: REPEATS, tileMm: MOSS_TILE },
  growth: { tileMm: 9 },
  water: { lengthMm: Number(trickle.length.toFixed(2)), foot: [Number(foot[0].toFixed(2)), Number(foot[2].toFixed(2))] },
}
// G15: the full lists lose a quarter of their triangles where the surface moves by less than a twentieth of a millimetre.
const meshes = [await thin(rockSoup.mesh(extras.rock), THIN.rock), await thin(growth.soup.mesh(extras.growth), THIN.growth), water.mesh(extras.water)]
const file = rel('assets-full', 'spring', 'base-spring.glb')
writeGlb(file, meshes, { part: 'base-spring' })
const lists = await lighter(file, THIN.levels)
const tri = meshes.map((m) => m.index.length / 3)
console.log(`quality levels: ${lists.map((m) => `${m.name} ${m.triangles}/${m.medium ?? '-'}/${m.low ?? '-'}`).join('; ')}`)
console.log(`rock ${tri[0]} triangles, growth ${tri[1]} (roots ${growth.rootTriangles} in ${roots.length} roots), water ${tri[2]}; total ${tri.reduce((a, b) => a + b, 0)}, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`)
console.log(`trickle foot at x ${foot[0].toFixed(1)}, z ${foot[2].toFixed(1)}`)
const over = fs.readdirSync(dir).filter((n) => n.startsWith('base-') && fs.statSync(path.join(dir, n)).size > cfg.repo.maxFileMb * 1e6)
if (over.length) throw new Error(`over ${cfg.repo.maxFileMb} MB: ${over.join(', ')}`)
console.log(`files: ${fs.readdirSync(dir).filter((n) => n.startsWith('base-')).map((n) => `${n} ${(fs.statSync(path.join(dir, n)).size / 1e6).toFixed(2)} MB`).join(', ')}`)
console.log(`done in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)} s`)
