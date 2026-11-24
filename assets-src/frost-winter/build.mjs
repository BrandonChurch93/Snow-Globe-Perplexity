import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { loadConfig, parseArgs, rel } from '../../tools/lib/paths.mjs'
import { CENTRE, REF_GLASS, rayOf } from '../../tools/lib/refcam.mjs'

// Grows the winter frost: fern arms on the glass (on the sphere) and on the slab (on the plane).
// Every stroke carries the time it appears, so the maps hold a threshold the arrival can play back.
// Outputs: assets-full/winter/frost-glass.lin.w1536.png, frost-slab.lin.w1536.png, frost-grain.lin.tile.png, frost-shapes.glb.
// Map channels: R = square root of the height, G = when it appears (0 first, 1 last), B = how much it sparkles.

const cfg = loadConfig()
const args = parseArgs(process.argv.slice(2))
const here = path.dirname(fileURLToPath(import.meta.url))
const L = JSON.parse(fs.readFileSync(path.join(here, 'layout.json'), 'utf8'))
const OUT = rel('assets-full', 'winter')
const LOOK = rel('out', 'work', 'frost')
const Rs = cfg.globe.sphereDiameterMm / 2
const footR = cfg.globe.baseDiameterMm / 2
const shrink = args.size && args.size !== true ? Number(args.size) / L.glass.mapPx : 1
const RAD = Math.PI / 180

// ---------- random numbers, the same generator as src/core/rng.ts ----------
function hashText(text, seed) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 ^ h2) >>> 0
}
function stream(name) {
  let s = hashText(name, cfg.seed) >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    sign: () => (next() < 0.5 ? -1 : 1),
    gauss: () => Math.sqrt(-2 * Math.log(Math.max(next(), 1e-12))) * Math.cos(2 * Math.PI * next()),
  }
}

// ---------- noise ----------
function hash3(x, y, z) {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
const fade = (t) => t * t * (3 - 2 * t)
function noise3(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)
  const l = (a, b, t) => a + (b - a) * t
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}
function fbm(x, y, z, octaves = 4) {
  let a = 0.5
  let s = 0
  let n = 0
  for (let i = 0; i < octaves; i++) {
    s += a * noise3(x, y, z)
    n += a
    x = x * 2.03 + 17.1
    y = y * 2.03 + 3.7
    z = z * 2.03 + 9.2
    a *= 0.5
  }
  return s / n
}
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// ---------- vectors ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// ---------- the field every stroke is drawn into ----------
class Field {
  constructor(n) {
    this.n = n
    this.H = new Float32Array(n * n)
    this.T = new Float32Array(n * n).fill(1e9)
    this.S = new Float32Array(n * n)
    this.tMax = 0
  }
  // A tapered stroke from A to B (pixels). m maps a pixel offset to millimetres on the surface.
  stroke(ax, ay, bx, by, m, pxPerMm, wa, wb, ha, hb, ta, tb, spark, kappa, reach, power) {
    const n = this.n
    const pad = (Math.max(wa, wb) + reach) * pxPerMm + 1.5
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - pad))
    const x1 = Math.min(n - 1, Math.ceil(Math.max(ax, bx) + pad))
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - pad))
    const y1 = Math.min(n - 1, Math.ceil(Math.max(ay, by) + pad))
    if (x1 < x0 || y1 < y0) return
    const cx = (ax + bx) / 2
    const cy = (ay + by) / 2
    const pax = m[0] * (ax - cx) + m[1] * (ay - cy)
    const pay = m[2] * (ax - cx) + m[3] * (ay - cy)
    const pbx = m[0] * (bx - cx) + m[1] * (by - cy)
    const pby = m[2] * (bx - cx) + m[3] * (by - cy)
    const ex = pbx - pax
    const ey = pby - pay
    const ee = ex * ex + ey * ey || 1e-12
    const { H, T, S } = this
    if (tb > this.tMax) this.tMax = tb
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx
        const px = m[0] * dx + m[1] * dy
        const py = m[2] * dx + m[3] * dy
        const u = clamp(((px - pax) * ex + (py - pay) * ey) / ee)
        const qx = px - pax - ex * u
        const qy = py - pay - ey * u
        const d = Math.sqrt(qx * qx + qy * qy)
        const w = wa + (wb - wa) * u
        if (d > w + reach) continue
        const i = y * n + x
        const t = ta + (tb - ta) * u + kappa * d
        if (t < T[i]) T[i] = t
        if (d < w) {
          const p = 1 - Math.pow(d / w, power)
          const h = (ha + (hb - ha) * u) * p
          if (h > H[i]) H[i] = h
          const s = spark * Math.sqrt(p)
          if (s > S[i]) S[i] = s
        }
      }
    }
  }
  bytes() {
    const n = this.n
    const { H, T, S } = this
    const times = []
    for (let i = 0; i < n * n; i += 7) if (H[i] > 0.03) times.push(T[i])
    times.sort((a, b) => a - b)
    const top = times[Math.floor(times.length * 0.996)] || 1
    this.top = top
    const out = Buffer.alloc(n * n * 3)
    for (let i = 0; i < n * n; i++) {
      out[i * 3] = Math.round(255 * Math.sqrt(clamp(H[i])))
      out[i * 3 + 1] = Math.round(255 * clamp((T[i] / top) * 0.96))
      out[i * 3 + 2] = Math.round(255 * clamp(S[i]))
    }
    return out
  }
}

// ---------- the two surfaces ----------
function sphereSpace(n, maxPolar) {
  const sr = n / 2 / (maxPolar * Rs)
  return {
    normal: (p) => norm(p),
    project: (p) => {
      const l = Rs / len(p)
      return [p[0] * l, p[1] * l, p[2] * l]
    },
    map(p) {
      const th = Math.acos(clamp(p[2] / Rs, -1, 1))
      const rho = Math.hypot(p[0], p[1]) || 1e-9
      const ex = p[0] / rho
      const ey = p[1] / rho
      const rr = (th / maxPolar) * (n / 2)
      const st = th > 0.05 ? rr / (Rs * Math.sin(th)) : sr
      return { x: n / 2 + rr * ex, y: n / 2 - rr * ey, m: [ex / sr, -ey / sr, -ey / st, -ex / st], pxPerMm: Math.max(sr, st) }
    },
  }
}
function planeSpace(n, half) {
  const s = n / (2 * half)
  return {
    normal: () => [0, 1, 0],
    project: (p) => [p[0], 0, p[2]],
    map: (p) => ({ x: (p[0] + half) * s, y: (p[2] + half) * s, m: [1 / s, 0, 0, 1 / s], pxPerMm: s }),
  }
}

// ---------- growth ----------
// One arm: a spine that steps over the surface, bends a little, may steer toward waypoints, and sprouts side arms as it goes.
// Time runs along it: a child starts when the spine passes its root, so the front is uneven, branch by branch.
function grow(ctx, p, h, o, depth = 0) {
  const { space, rng, field } = ctx
  const steps = Math.max(2, Math.round(o.len / o.step))
  const ds = o.len / steps
  let t = o.t0
  let s = 0
  const kids = o.kids
  const next = kids ? [kids.start ?? kids.gap * rng.next(), kids.start ?? kids.gap * rng.next()] : null
  const line = ctx.keep && depth <= ctx.keepDepth ? { pts: [], w: [], h: [], t: [], depth } : null
  let way = 0
  for (let i = 0; i < steps; i++) {
    const u0 = i / steps
    const u1 = (i + 1) / steps
    let a = (o.curl ?? 0) * ds + rng.gauss() * (o.wobble ?? 0) * Math.sqrt(ds)
    if (o.to && way < o.to.length) {
      const target = o.to[way]
      const n = space.normal(p)
      const d = [target[0] - p[0], target[1] - p[1], target[2] - p[2]]
      const dn = dot(d, n)
      const want = norm([d[0] - dn * n[0], d[1] - dn * n[1], d[2] - dn * n[2]])
      const side = dot(cross(h, want), n)
      const ang = Math.atan2(side, dot(h, want))
      a += clamp(ang, -1, 1) * Math.min(1, (o.steer ?? 0.35) * ds)
      if (len(d) < Math.max(1.2, o.len * 0.04)) way++
    }
    const n0 = space.normal(p)
    const c = cross(n0, h)
    h = norm([h[0] * Math.cos(a) + c[0] * Math.sin(a), h[1] * Math.cos(a) + c[1] * Math.sin(a), h[2] * Math.cos(a) + c[2] * Math.sin(a)])
    const q = space.project([p[0] + h[0] * ds, p[1] + h[1] * ds, p[2] + h[2] * ds])
    const n1 = space.normal(q)
    const hn = dot(h, n1)
    const h1 = norm([h[0] - hn * n1[0], h[1] - hn * n1[1], h[2] - hn * n1[2]])
    const shape = (u) => Math.pow(1 - u, o.taper ?? 0.7)
    const wa = o.w1 + (o.w0 - o.w1) * shape(u0)
    const wb = o.w1 + (o.w0 - o.w1) * shape(u1)
    const ha = o.h1 + (o.h0 - o.h1) * shape(u0)
    const hb = o.h1 + (o.h0 - o.h1) * shape(u1)
    const t1 = t + ds / o.speed
    const A = space.map(p)
    const B = space.map(q)
    const M = space.map(space.project(mix3(p, q, 0.5)))
    field.stroke(A.x, A.y, B.x, B.y, M.m, M.pxPerMm, wa, wb, ha, hb, t, t1, o.spark ?? 0.6, o.kappa ?? 2, o.reach ?? 0.12, o.power ?? 1.7)
    if (o.film) {
      const f = o.film
      const fa = f.w1 + (f.w0 - f.w1) * shape(u0)
      const fb = f.w1 + (f.w0 - f.w1) * shape(u1)
      const ga = f.h1 + (f.h0 - f.h1) * shape(u0)
      const gb = f.h1 + (f.h0 - f.h1) * shape(u1)
      field.stroke(A.x, A.y, B.x, B.y, M.m, M.pxPerMm, fa, fb, ga, gb, t, t1, f.spark ?? 0.15, f.kappa ?? 2.5, 0, f.power ?? 1.3)
    }
    if (line) {
      if (i === 0) {
        line.pts.push(p)
        line.w.push(wa)
        line.h.push(ha)
        line.t.push(t)
      }
      line.pts.push(q)
      line.w.push(wb)
      line.h.push(hb)
      line.t.push(t1)
    }
    if (kids) {
      for (let side = 0; side < 2; side++) {
        while (next[side] <= s + ds) {
          const f = clamp((next[side] - s) / ds)
          const u = (s + f * ds) / o.len
          next[side] += kids.gap * rng.range(0.7, 1.35)
          const bias = side === 0 ? (kids.lean ?? 1) : 1
          const l = kids.len * kids.profile(u) * rng.range(0.62, 1.12) * bias
          if (l < kids.min) continue
          const at = space.project(mix3(p, q, f))
          const hh = mix3(h, h1, f)
          const sgn = side === 0 ? 1 : -1
          const ang = sgn * (kids.angle + (kids.angleTip - kids.angle) * u + rng.gauss() * (kids.spread ?? 0.08))
          const nn = space.normal(at)
          const cc = cross(nn, hh)
          const hk = norm([hh[0] * Math.cos(ang) + cc[0] * Math.sin(ang), hh[1] * Math.cos(ang) + cc[1] * Math.sin(ang), hh[2] * Math.cos(ang) + cc[2] * Math.sin(ang)])
          const child = kids.make(l, u, rng, depth + 1)
          child.len = l
          child.t0 = t + (f * ds) / o.speed + (kids.delay ?? 0) * rng.next()
          child.curl = (child.curl ?? 0) * -sgn
          grow(ctx, at, hk, child, depth + 1)
        }
      }
    }
    p = q
    h = h1
    s += ds
    t = t1
  }
  if (line) ctx.keep.push(line)
}

const feather = (rise, fall) => (u) => Math.pow(Math.min(1, u / rise), 0.7) * Math.pow(1 - u, fall)

// ---------- the glass ----------
function pixelOnGlass(px, py) {
  const cx = REF_GLASS.x
  const cy = REF_GLASS.y
  for (let k = 0; k < 40; k++) {
    const x = cx + (px - cx) * (1 - k * 0.01)
    const y = cy + (py - cy) * (1 - k * 0.01)
    const r = rayOf(x, y)
    const oc = [r.origin[0] - CENTRE[0], r.origin[1] - CENTRE[1], r.origin[2] - CENTRE[2]]
    const b = dot(oc, r.dir)
    const disc = b * b - (dot(oc, oc) - Rs * Rs)
    if (disc <= 0) continue
    const t = -b - Math.sqrt(disc)
    return [oc[0] + r.dir[0] * t, oc[1] + r.dir[1] * t, oc[2] + r.dir[2] * t]
  }
  throw new Error(`pixel ${px},${py} is not on the glass`)
}
const arc = (a, b) => Rs * Math.acos(clamp(dot(a, b) / (Rs * Rs), -1, 1))

function profileAt(deg) {
  const P = L.glass.profile
  const d = ((((deg - P[0].deg) % 360) + 360) % 360) + P[0].deg
  for (let i = 0; i < P.length; i++) {
    const a = P[i]
    const b = P[(i + 1) % P.length]
    const bd = i + 1 < P.length ? b.deg : b.deg + 360
    if (d >= a.deg && d <= bd) {
      const t = smooth(0, 1, (d - a.deg) / (bd - a.deg))
      const o = {}
      for (const k of Object.keys(a)) o[k] = a[k] + (b[k] - a[k]) * t
      return o
    }
  }
  return P[0]
}

function needle(l, u, rng) {
  return { step: 0.38, w0: rng.range(0.06, 0.1), w1: 0.025, h0: rng.range(0.5, 0.78), h1: 0.28, speed: 0.5, curl: rng.range(0.01, 0.07), wobble: 0.012, spark: rng.range(0.45, 1), kappa: 3, reach: 0.1, taper: 0.8, power: 1.5 }
}
function plumeSpec(length, barbMm, rng, t0) {
  const lean = rng.range(0.55, 1)
  return {
    len: length,
    step: 0.3,
    w0: rng.range(0.15, 0.22),
    w1: 0.05,
    h0: 1,
    h1: 0.55,
    speed: 1,
    t0,
    wobble: 0.018,
    curl: rng.gauss() * 0.006,
    spark: 0.8,
    kappa: 2.5,
    reach: 0.15,
    taper: 0.75,
    film: { w0: Math.min(1.5, 0.22 * barbMm + 0.3), w1: 0.15, h0: 0.17, h1: 0.05, kappa: 3 },
    kids: {
      gap: rng.range(0.27, 0.36),
      len: barbMm,
      min: 0.35,
      lean: rng.next() < 0.5 ? lean : 1 / lean,
      angle: rng.range(44, 58) * RAD,
      angleTip: rng.range(30, 40) * RAD,
      spread: 0.09,
      profile: feather(rng.range(0.08, 0.2), rng.range(0.75, 1.15)),
      make: (l, u, r) => {
        const o = needle(l, u, r)
        if (l > 2.6 && r.next() < 0.3) {
          o.w0 *= 1.25
          o.h0 = Math.min(0.9, o.h0 * 1.2)
          o.speed = 0.65
          o.kids = { gap: r.range(0.3, 0.42), len: l * 0.26, min: 0.25, angle: 48 * RAD, angleTip: 36 * RAD, profile: feather(0.15, 0.9), make: (l2, u2, r2) => ({ ...needle(l2, u2, r2), w0: 0.05, h0: 0.42, speed: 0.4 }) }
        }
        return o
      },
    },
  }
}

function buildGlass() {
  const n = Math.round(L.glass.mapPx * shrink)
  const maxPolar = L.glass.maxPolarDeg * RAD
  const space = sphereSpace(n, maxPolar)
  const field = new Field(n)
  const rng = stream('frost-glass')
  const ctx = { space, rng, field }
  const rimAt = (deg, inMm) => {
    const th = Math.PI / 2 - inMm / Rs
    return [Rs * Math.sin(th) * Math.cos(deg * RAD), Rs * Math.sin(th) * Math.sin(deg * RAD), Rs * Math.cos(th)]
  }
  const toward = (p, q) => {
    const nn = norm(p)
    const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]
    const dn = dot(d, nn)
    return norm([d[0] - dn * nn[0], d[1] - dn * nn[1], d[2] - dn * nn[2]])
  }
  // The measured plumes: a stem from the rim to the root, then on to the tip.
  for (const pl of L.glass.plumes) {
    const root = pixelOnGlass(pl.root[0], pl.root[1])
    const tip = pixelOnGlass(pl.tip[0], pl.tip[1])
    const deg = Math.atan2(root[1], root[0]) / RAD
    const start = rimAt(deg + rng.range(-4, 4), rng.range(-1, 2))
    const length = (arc(start, root) + arc(root, tip)) * 1.04
    const o = plumeSpec(length, pl.barbMm, rng, rng.range(0, 3))
    o.to = [root, tip]
    o.steer = 0.5
    grow(ctx, start, toward(start, root), o)
  }
  // Stars: seeded points on the glass, arms thrown out from each.
  for (const st of L.glass.stars) {
    const at = pixelOnGlass(st.at[0], st.at[1])
    const t0 = Math.max(0, Rs * Math.asin(clamp(at[2] / Rs, -1, 1))) * 0.9
    for (const tp of st.tips) {
      const tip = pixelOnGlass(tp[0], tp[1])
      const o = plumeSpec(arc(at, tip) * 1.03, st.barbMm, rng, t0 + rng.range(0, 2))
      o.to = [tip]
      grow(ctx, at, toward(at, tip), o)
    }
  }
  // Ferns seeded all along the rim, front and back, many short and a few long.
  const seeded = (count, front) => {
    for (let i = 0; i < count; i++) {
      const deg = rng.range(-90, 270)
      const pr = profileAt(deg)
      if (rng.next() > pr.density) continue
      const reach = pr.reachMm * (front ? 1 : L.glass.backShare)
      const length = 1.5 + reach * Math.pow(rng.next(), 2.1) * 0.95
      const inMm = rng.range(-1.5, 5) + (rng.next() < 0.3 ? rng.range(0, pr.filmMm * 0.8) : 0)
      const start = rimAt(deg, front ? inMm : -inMm)
      const inward = toward(start, [0, 0, front ? Rs : -Rs])
      const up = toward(start, [0, Rs, 0])
      const sweep = (rng.next() < 0.68 ? 1 : -1) * rng.range(5, 78) * RAD
      const nn = norm(start)
      const side = Math.sign(dot(cross(inward, up), nn)) || 1
      const a = sweep * side
      const c = cross(nn, inward)
      const h = norm([inward[0] * Math.cos(a) + c[0] * Math.sin(a), inward[1] * Math.cos(a) + c[1] * Math.sin(a), inward[2] * Math.cos(a) + c[2] * Math.sin(a)])
      const o = plumeSpec(length, clamp(length * rng.range(0.2, 0.34), 0.9, 5.2), rng, rng.range(0, 4) + Math.abs(inMm) * 0.8)
      o.curl = rng.gauss() * 0.012
      grow(ctx, start, h, o)
    }
  }
  seeded(760, true)
  seeded(430, false)
  // Loose needles in the rim band.
  for (let i = 0; i < 5200; i++) {
    const deg = rng.range(-90, 270)
    const pr = profileAt(deg)
    if (rng.next() > pr.film) continue
    const front = rng.next() < 0.62
    const inMm = Math.pow(rng.next(), 1.4) * pr.filmMm * (front ? 1 : L.glass.backShare) * 1.15
    const start = rimAt(deg + rng.range(-0.5, 0.5), front ? inMm : -inMm)
    const nn = norm(start)
    const inward = toward(start, [0, 0, front ? Rs : -Rs])
    const a = rng.range(-1.35, 1.35)
    const c = cross(nn, inward)
    const h = norm([inward[0] * Math.cos(a) + c[0] * Math.sin(a), inward[1] * Math.cos(a) + c[1] * Math.sin(a), inward[2] * Math.cos(a) + c[2] * Math.sin(a)])
    const l = rng.range(0.7, 3.6)
    grow(ctx, start, h, { ...needle(l, 0, rng), len: l, t0: 1 + inMm * 0.9 + rng.range(0, 5), curl: rng.gauss() * 0.03 })
  }
  // The milky film in the rim band, thick at the rim and broken toward its inner edge.
  const { H, T, S } = field
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2
      const dy = n / 2 - (y + 0.5)
      const rr = Math.hypot(dx, dy)
      const th = (rr / (n / 2)) * maxPolar
      if (th > maxPolar || th < 0.5) continue
      const d = Rs * (Math.PI / 2 - th)
      const deg = Math.atan2(dy, dx) / RAD
      const pr = profileAt(deg)
      const reach = pr.filmMm * (d >= 0 ? 1 : L.glass.backShare)
      const q = Math.abs(d) / reach
      if (q > 1.5) continue
      const sx = Rs * Math.sin(th) * (dx / (rr || 1))
      const sy = Rs * Math.sin(th) * (dy / (rr || 1))
      const sz = Rs * Math.cos(th)
      const big = fbm(sx * 0.11, sy * 0.11, sz * 0.11, 3)
      const mid = fbm(sx * 0.55 + 31, sy * 0.55, sz * 0.55, 3)
      const edge = q + (big - 0.5) * 0.9 + (mid - 0.5) * 0.35
      const body = 1 - smooth(0.45, 1.05, edge)
      if (body <= 0) continue
      const h = pr.film * body * (0.1 + 0.13 * mid + 0.07 * (1 - clamp(q)))
      const i = y * n + x
      if (h > H[i]) H[i] = h
      const s = 0.1 + 0.25 * mid
      if (s > S[i]) S[i] = s
      const t = 1 + Math.abs(d) * 0.75 + big * 9 + mid * 3
      if (t < T[i]) T[i] = t
    }
  }
  return field
}

// ---------- the slab ----------
function slabArm(length, rng, t0) {
  const twig = (l, u, r) => ({ step: 0.3, w0: r.range(0.1, 0.16), w1: 0.04, h0: r.range(0.3, 0.45), h1: 0.14, speed: 0.4, wobble: 0.02, spark: r.range(0.5, 1), kappa: 3, reach: 0.12, taper: 0.8, power: 1.5 })
  const barb = (l, u, r) => ({
    step: 0.32,
    w0: r.range(0.17, 0.26) * (0.6 + 0.4 * Math.min(1, l / 2)),
    w1: 0.05,
    h0: r.range(0.36, 0.52),
    h1: 0.16,
    speed: 0.45,
    wobble: 0.025,
    curl: r.range(0, 0.05),
    spark: r.range(0.5, 1),
    kappa: 3,
    reach: 0.15,
    taper: 0.8,
    power: 1.5,
    kids: l > 1.5 ? { gap: r.range(0.36, 0.5), len: l * 0.3, min: 0.2, angle: 52 * RAD, angleTip: 40 * RAD, profile: feather(0.2, 0.9), make: twig } : undefined,
  })
  const branch = (l, u, r) => ({
    step: 0.4,
    w0: r.range(0.36, 0.5) * (0.55 + 0.45 * Math.min(1, l / 8)),
    w1: 0.09,
    h0: r.range(0.55, 0.75),
    h1: 0.22,
    speed: 0.62,
    wobble: 0.022,
    curl: r.range(0.0, 0.035),
    spark: 0.7,
    kappa: 2.5,
    reach: 0.2,
    taper: 0.75,
    power: 1.6,
    film: { w0: 0.95 * (1 - 0.6 * u), w1: 0.15, h0: 0.26 * (1 - 0.7 * u), h1: 0.05, kappa: 3, spark: 0.3 },
    kids: { gap: r.range(0.62, 0.86), len: clamp(l * 0.32, 0.6, 4.2), min: 0.3, angle: r.range(46, 58) * RAD, angleTip: 36 * RAD, profile: feather(0.16, 0.95), make: barb },
  })
  return {
    len: length,
    step: 0.5,
    w0: rng.range(0.85, 1.15),
    w1: 0.16,
    h0: 1,
    h1: 0.32,
    speed: 1,
    t0,
    wobble: 0.014,
    curl: rng.gauss() * 0.003,
    spark: 0.7,
    kappa: 2,
    reach: 0.3,
    taper: 0.8,
    power: 1.8,
    film: { w0: rng.range(3.2, 5.2), w1: 0.5, h0: rng.range(0.5, 0.72), h1: 0.08, kappa: 2.5, spark: 0.35, power: 1.15 },
    kids: {
      gap: rng.range(2.1, 2.9),
      start: rng.range(1.5, 3),
      len: clamp(length * rng.range(0.27, 0.36), 5, 19),
      min: 0.8,
      delay: 1.5,
      angle: rng.range(50, 62) * RAD,
      angleTip: rng.range(38, 46) * RAD,
      spread: 0.07,
      profile: feather(rng.range(0.1, 0.22), rng.range(0.8, 1.1)),
      make: branch,
    },
  }
}

function buildSlab() {
  const n = Math.round(L.slab.mapPx * shrink)
  const half = L.slab.halfMm
  const space = planeSpace(n, half)
  const field = new Field(n)
  const rng = stream('frost-slab')
  const lines = []
  const ctx = { space, rng, field, keep: lines, keepDepth: 1 }
  const at = (deg, r) => [r * Math.cos(deg * RAD), 0, r * Math.sin(deg * RAD)]
  const arms = L.slab.arms.map((a) => ({ ...a }))
  const taken = arms.map((a) => a.rootDeg)
  let guard = 0
  while (arms.length < L.slab.arms.length + L.slab.fillArms && guard++ < 4000) {
    const deg = rng.range(-180, 180)
    if (taken.some((t) => Math.abs(((deg - t + 540) % 360) - 180) < 8.5)) continue
    taken.push(deg)
    arms.push({ rootDeg: deg, tipDeg: deg + rng.range(-9, 9), tipMm: rng.range(L.slab.fillMm[0], L.slab.fillMm[1]) })
  }
  for (const a of arms) {
    const root = at(a.rootDeg, footR - 0.6)
    const tip = at(a.tipDeg, a.tipMm)
    const d = norm([tip[0] - root[0], 0, tip[2] - root[2]])
    const length = Math.hypot(tip[0] - root[0], tip[2] - root[2]) * 1.02
    const o = slabArm(length, rng, rng.range(0, 2.5))
    o.to = [tip]
    o.steer = 0.25
    grow(ctx, root, d, o)
  }
  // The heap that hugs the foot, loose grains, clumps and thin patches further out.
  const { H, T, S } = field
  const grains = []
  const bump = (x, z, r, h, t, spark) => {
    const m = space.map([x, 0, z])
    field.stroke(m.x, m.y, m.x + 0.01, m.y, m.m, m.pxPerMm, r, r, h, h, t, t, spark, 0, 0, 2)
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const wx = ((x + 0.5) / n) * 2 * half - half
      const wz = ((y + 0.5) / n) * 2 * half - half
      const r = Math.hypot(wx, wz)
      if (r < footR - 2.5) continue
      const i = y * n + x
      const big = fbm(wx * 0.09, 3.1, wz * 0.09, 3)
      const mid = fbm(wx * 0.5, 9.4, wz * 0.5, 3)
      const reach = 3.5 + 11 * smooth(0.3, 0.75, big)
      const q = (r - footR + 1.5) / reach
      if (q < 1.2) {
        const body = (1 - smooth(0.35, 1.1, q + (mid - 0.5) * 0.5)) * smooth(-2.5, -0.5, r - footR)
        const h = body * (0.5 + 0.35 * mid + 0.25 * (1 - clamp(q)))
        if (h > H[i]) H[i] = h
        const s = body * (0.3 + 0.4 * mid)
        if (s > S[i]) S[i] = s
        const t = 0.5 + Math.max(0, r - footR) * 0.8 + mid * 2
        if (t < T[i]) T[i] = t
      }
      const far = fbm(wx * 0.06 + 40, 1.7, wz * 0.06, 4)
      const thin = smooth(0.6, 0.74, far) * (1 - smooth(half * 0.72, half * 0.97, r)) * smooth(footR + 6, footR + 24, r)
      if (thin > 0) {
        const h = thin * (0.035 + 0.075 * mid)
        if (h > H[i]) H[i] = h
        const s = 0.1 + 0.2 * mid
        if (s > S[i]) S[i] = s
        const t = 6 + (r - footR) * 1.05 + mid * 8
        if (t < T[i]) T[i] = t
      }
    }
  }
  for (let i = 0; i < L.slab.grains; i++) {
    const deg = rng.range(-180, 180)
    const r = footR + 0.5 + Math.min(70, -Math.log(1 - rng.next() * 0.985) * 15)
    const size = 0.11 + 0.42 * Math.pow(rng.next(), 2.4)
    const x = r * Math.cos(deg * RAD)
    const z = r * Math.sin(deg * RAD)
    const t = 2 + (r - footR) * 0.95 + rng.range(0, 7)
    const h = clamp(size * rng.range(0.9, 1.5), 0.1, 0.7)
    bump(x, z, size, h, t, rng.range(0.4, 1))
    grains.push({ x, z, r: size, h, t })
  }
  for (let i = 0; i < L.slab.clumps; i++) {
    const deg = rng.range(-180, 180)
    const r = footR + 2 + Math.min(58, -Math.log(1 - rng.next() * 0.97) * 17)
    const cx = r * Math.cos(deg * RAD)
    const cz = r * Math.sin(deg * RAD)
    const spread = rng.range(0.8, 3.6)
    const count = Math.round(rng.range(8, 16) * spread)
    const t0 = 2 + (r - footR) * 0.95 + rng.range(0, 5)
    bump(cx, cz, spread * 1.1, 0.16 + 0.1 * spread, t0, 0.3)
    for (let k = 0; k < count; k++) {
      const a = rng.range(0, 2 * Math.PI)
      const d = spread * Math.sqrt(rng.next())
      const size = 0.16 + 0.42 * Math.pow(rng.next(), 1.7)
      const x = cx + d * Math.cos(a)
      const z = cz + d * Math.sin(a)
      const h = clamp(0.2 + 0.1 * spread + size * rng.range(0.5, 1.1), 0.1, 0.85)
      const t = t0 + d * 1.5 + rng.range(0, 2)
      bump(x, z, size, h, t, rng.range(0.4, 1))
      grains.push({ x, z, r: size, h, t, base: (0.12 + 0.07 * spread) * (1 - d / (spread * 1.1)) })
    }
  }
  return { field, lines, grains }
}

// ---------- real small shapes on the slab ----------
function slabShapes(lines, grains, tTop) {
  const rng = stream('frost-shapes')
  const pos = []
  const uv = []
  const idx = []
  const mm = L.slab.heightMm
  const when = (t) => clamp((t / tTop) * 0.96)
  const vert = (x, y, z, t, r) => {
    pos.push(x, y, z)
    uv.push(when(t), r)
    return pos.length / 3 - 1
  }
  const S = L.slab.shapes
  const count = { ridges: 0, lumps: 0, far: 0 }
  for (const line of lines) {
    const n = line.pts.length
    if (n < 3 || (line.depth > 0 && line.w[0] < S.branchMinMm)) continue
    const id = rng.next()
    const every = line.depth > 0 ? S.branchEvery : S.spineEvery
    let prev = null
    for (let i = 0; i < n; i++) {
      if (i % every !== 0 && i !== n - 1) continue
      const p = line.pts[i]
      const a = line.pts[Math.max(0, i - every)]
      const b = line.pts[Math.min(n - 1, i + every)]
      const d = norm([b[0] - a[0], 0, b[2] - a[2]])
      const lat = [-d[2], 0, d[0]]
      const w = line.w[i] * rng.range(0.85, 1.2)
      const h = line.h[i] * mm * rng.range(0.7, 1.15)
      const off = rng.range(-0.3, 0.3) * w
      const t = line.t[i]
      const row = [
        vert(p[0] - lat[0] * w, 0, p[2] - lat[2] * w, t + 2 * w, id),
        vert(p[0] + lat[0] * (off - 0.4 * w), h * rng.range(0.72, 0.95), p[2] + lat[2] * (off - 0.4 * w), t, id),
        vert(p[0] + lat[0] * (off + 0.4 * w), h * rng.range(0.72, 0.95), p[2] + lat[2] * (off + 0.4 * w), t, id),
        vert(p[0] + lat[0] * w, 0, p[2] + lat[2] * w, t + 2 * w, id),
      ]
      if (prev) for (let k = 0; k < 3; k++) idx.push(prev[k], row[k], prev[k + 1], prev[k + 1], row[k], row[k + 1])
      if (prev) count.ridges += 6
      prev = row
    }
  }
  const lump = (x, z, r, h, t, y0 = 0) => {
    const id = rng.next()
    const top = vert(x + rng.range(-0.2, 0.2) * r, y0 + h * mm, z + rng.range(-0.2, 0.2) * r, t, id)
    const ring = []
    const mid = []
    const full = r >= S.lumpFullMm
    const sides = full ? 5 : 4
    const turn = rng.range(0, 6.28)
    for (let k = 0; k < sides; k++) {
      const a = turn + (k / sides) * 2 * Math.PI
      const rr = r * rng.range(0.85, 1.25)
      ring.push(vert(x + rr * Math.cos(a), y0, z + rr * Math.sin(a), t, id))
      if (!full) continue
      const rm = r * rng.range(0.6, 0.85)
      mid.push(vert(x + rm * Math.cos(a + 0.6), y0 + h * mm * rng.range(0.5, 0.75), z + rm * Math.sin(a + 0.6), t, id))
    }
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides
      if (full) idx.push(ring[k], mid[k], ring[k1], ring[k1], mid[k], mid[k1], mid[k], top, mid[k1])
      else idx.push(ring[k], top, ring[k1])
    }
  }
  const before = idx.length
  for (const g of grains) if (g.r >= S.grainMinMm) lump(g.x, g.z, g.r, g.h, g.t, (g.base ?? 0) * mm)
  count.lumps = (idx.length - before) / 3
  for (const f of L.slab.farPatches) {
    const cx = f.mm * Math.cos(f.deg * RAD)
    const cz = f.mm * Math.sin(f.deg * RAD)
    const lumps = Math.round(f.sizeMm * S.farPerMm)
    for (let k = 0; k < lumps; k++) {
      const a = rng.range(0, 2 * Math.PI)
      const d = f.sizeMm * Math.pow(rng.next(), 0.7)
      lump(cx + d * Math.cos(a) * 1.6, cz + d * Math.sin(a) * 0.8, rng.range(0.4, 1.3), rng.range(0.25, 0.6), tTop * (0.55 + 0.4 * rng.next()))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.userData.count = count
  return g
}

function glassBand() {
  const G = L.glass
  const r = Rs + G.liftMm
  const pos = []
  const idx = []
  for (let i = 0; i <= G.meshRings; i++) {
    const th = (G.meshFromPolarDeg + ((G.maxPolarDeg - G.meshFromPolarDeg) * i) / G.meshRings) * RAD
    for (let k = 0; k <= G.meshSegments; k++) {
      const ph = (k / G.meshSegments) * 2 * Math.PI
      pos.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th))
    }
  }
  const row = G.meshSegments + 1
  for (let i = 0; i < G.meshRings; i++) for (let k = 0; k < G.meshSegments; k++) {
    const a = i * row + k
    idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function slabSheet() {
  const g = new THREE.RingGeometry(footR - 2.5, L.slab.halfMm, 128, 1)
  g.rotateX(-Math.PI / 2)
  g.deleteAttribute('uv')
  return g
}

// ---------- the grain every frost surface shares: a tile of packed crystals ----------
function grainTile(n) {
  const rng = stream('frost-grain')
  const layer = (cells) => {
    const pts = []
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + rng.next()) / cells, (j + rng.next()) / cells, rng.next()])
    const out = new Float32Array(n * n * 2)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n
      const v = (y + 0.5) / n
      const ci = Math.floor(u * cells)
      const cj = Math.floor(v * cells)
      let best = 9
      let second = 9
      let id = 0
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const p = pts[((cj + dj + cells) % cells) * cells + ((ci + di + cells) % cells)]
        let dx = Math.abs(p[0] - u)
        let dy = Math.abs(p[1] - v)
        if (dx > 0.5) dx = 1 - dx
        if (dy > 0.5) dy = 1 - dy
        const d = Math.hypot(dx, dy) * cells
        if (d < best) {
          second = best
          best = d
          id = p[2]
        } else if (d < second) second = d
      }
      out[(y * n + x) * 2] = clamp((second - best) * 1.4) * (0.55 + 0.45 * id)
      out[(y * n + x) * 2 + 1] = id
    }
    return out
  }
  const a = layer(L.grain.cells[0])
  const b = layer(L.grain.cells[1])
  const rel = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) rel[i] = clamp(0.7 * a[i * 2] + 0.45 * b[i * 2])
  const buf = Buffer.alloc(n * n * 3)
  const at = (x, y) => rel[((y + n) % n) * n + ((x + n) % n)]
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x
    const sx = (at(x + 1, y) - at(x - 1, y)) * L.grain.slopeGain
    const sy = (at(x, y - 1) - at(x, y + 1)) * L.grain.slopeGain
    buf[i * 3] = Math.round(255 * rel[i])
    buf[i * 3 + 1] = Math.round(255 * clamp(0.5 + 0.5 * sx))
    buf[i * 3 + 2] = Math.round(255 * clamp(0.5 + 0.5 * sy))
  }
  return buf
}

// ---------- write ----------
const png = (buf, n, file) => sharp(buf, { raw: { width: n, height: n, channels: 3 } }).png({ compressionLevel: 9 }).toFile(file)
async function look(buf, n, file, pick) {
  const out = Buffer.alloc(n * n)
  for (let i = 0; i < n * n; i++) out[i] = pick(buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2])
  await sharp(out, { raw: { width: n, height: n, channels: 1 } }).resize(1400, 1400, { kernel: 'lanczos3' }).jpeg({ quality: 88 }).toFile(file)
}

fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(LOOK, { recursive: true })
const t0 = process.hrtime.bigint()
const only = args.only && args.only !== true ? String(args.only) : ''
const report = []

if (!only || only === 'glass') {
  const glass = buildGlass()
  const bytes = glass.bytes()
  await png(bytes, glass.n, path.join(OUT, 'frost-glass.lin.w1536.png'))
  await look(bytes, glass.n, path.join(LOOK, 'glass-height.jpg'), (r) => r)
  await look(bytes, glass.n, path.join(LOOK, 'glass-when.jpg'), (r, g) => (r > 20 ? g : 0))
  report.push(`glass map ${glass.n} px, last stroke at ${glass.tMax.toFixed(1)}, threshold top ${glass.top.toFixed(1)}`)
}
let shapes = null
if (!only || only === 'slab') {
  const slab = buildSlab()
  const bytes = slab.field.bytes()
  await png(bytes, slab.field.n, path.join(OUT, 'frost-slab.lin.w1536.png'))
  await look(bytes, slab.field.n, path.join(LOOK, 'slab-height.jpg'), (r) => r)
  await look(bytes, slab.field.n, path.join(LOOK, 'slab-when.jpg'), (r, g) => (r > 20 ? g : 0))
  shapes = slabShapes(slab.lines, slab.grains, slab.field.top)
  report.push(`slab map ${slab.field.n} px, ${slab.lines.length} kept lines, ${slab.grains.length} grains, threshold top ${slab.field.top.toFixed(1)}`)
}
if (!only || only === 'grain') await png(grainTile(L.grain.px), L.grain.px, path.join(OUT, 'frost-grain.lin.tile.png'))
if (shapes) {
  const extras = { glassMaxPolarDeg: L.glass.maxPolarDeg, glassHeightMm: L.glass.heightMm, glassLiftMm: L.glass.liftMm, slabHalfMm: L.slab.halfMm, slabHeightMm: L.slab.heightMm, grainTileMm: L.grain.tileMm }
  const r = writeGlb(path.join(OUT, 'frost-shapes.glb'), [fromThree('glass', glassBand(), extras), fromThree('sheet', slabSheet(), extras), fromThree('shapes', shapes, extras)], extras)
  report.push(`frost-shapes.glb ${(r.bytes / 1e6).toFixed(2)} MB, ${r.triangles} triangles in ${r.meshes} meshes (shapes ${shapes.index.count / 3}: ridges ${shapes.userData.count.ridges}, grain lumps ${shapes.userData.count.lumps})`)
}
for (const f of fs.readdirSync(OUT).filter((f) => f.startsWith('frost-'))) report.push(`${f} ${(fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2)} MB`)
console.log(report.join('\n'))
console.log(`frost-winter built in ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1)} s`)
