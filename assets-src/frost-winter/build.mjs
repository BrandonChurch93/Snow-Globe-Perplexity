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
// Outputs: assets-full/winter/frost-glass.lin.w2048.png, frost-slab.lin.w2048.png, frost-grain.lin.tile.png, frost-shapes.glb.
// Map channels: R = the height, G = when it appears (0 first, 1 last), B = how much it sparkles.

const cfg = loadConfig()
const args = parseArgs(process.argv.slice(2))
const here = path.dirname(fileURLToPath(import.meta.url))
const L = JSON.parse(fs.readFileSync(path.join(here, 'layout.json'), 'utf8'))
const OUT = rel('assets-full', 'winter')
const LOOK = rel('out', 'work', 'frost')
const Rs = cfg.globe.sphereDiameterMm / 2
const REF_PX_PER_MM = REF_GLASS.r / Rs
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
      out[i * 3] = Math.round(255 * clamp(H[i]))
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
  // When the stroke reaches a place along itself: at its own speed from its root, or sooner where a seed sits ahead.
  const when = o.when ?? ((x) => o.t0 + x / o.speed)
  let t = when(0)
  let s = 0
  const kids = o.kids
  const next = kids ? [kids.start ?? kids.gap * rng.next(), kids.start ?? kids.gap * rng.next()] : null
  const line = ctx.keep && depth <= ctx.keepDepth ? { pts: [], w: [], f: [], h: [], t: [], depth } : null
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
    const t1 = when(s + ds)
    const A = space.map(p)
    const B = space.map(q)
    const M0 = space.map(space.project(mix3(p, q, 0.5)))
    const M = ctx.metric ? ctx.metric(M0) : M0
    field.stroke(A.x, A.y, B.x, B.y, M.m, M.pxPerMm, wa, wb, ha, hb, t, t1, o.spark ?? 0.6, o.kappa ?? 2, o.reach ?? 0.12, o.power ?? 1.7)
    let fa = 0
    let fb = 0
    if (o.film) {
      const f = o.film
      fa = f.profile ? Math.max(f.w1, f.w0 * f.profile(u0)) : f.w1 + (f.w0 - f.w1) * shape(u0)
      fb = f.profile ? Math.max(f.w1, f.w0 * f.profile(u1)) : f.w1 + (f.w0 - f.w1) * shape(u1)
      const ga = f.h1 + (f.h0 - f.h1) * shape(u0)
      const gb = f.h1 + (f.h0 - f.h1) * shape(u1)
      field.stroke(A.x, A.y, B.x, B.y, M.m, M.pxPerMm, fa, fb, ga, gb, t, t1, f.spark ?? 0.15, f.kappa ?? 2.5, 0, f.power ?? 1.3)
    }
    if (o.halo) {
      const f = o.halo
      const wide = (u) => Math.max(f.w1, f.w0 * (f.profile ? f.profile(u) : shape(u)))
      field.stroke(A.x, A.y, B.x, B.y, M.m, M.pxPerMm, wide(u0), wide(u1), f.h, f.h, t + f.late, t1 + f.late, f.spark ?? 0.1, f.kappa ?? 3, 0, f.power ?? 1.6)
    }
    if (line) {
      if (i === 0) {
        line.pts.push(p)
        line.w.push(wa)
        line.f.push(fa)
        line.h.push(ha)
        line.t.push(t)
      }
      line.pts.push(q)
      line.w.push(wb)
      line.f.push(fb)
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
          let hk = norm([hh[0] * Math.cos(ang) + cc[0] * Math.sin(ang), hh[1] * Math.cos(ang) + cc[1] * Math.sin(ang), hh[2] * Math.cos(ang) + cc[2] * Math.sin(ang)])
          let ll = l
          if (ctx.warp) {
            const w = ctx.warp(at, hh, hk)
            hk = w.dir
            ll = l * w.scale
          }
          const child = kids.make(ctx.designed ? l : ll, u, rng, depth + 1)
          child.len = ll * (child.stretch ?? 1)
          child.t0 = when(s + f * ds) + (kids.wait ?? 0) + (kids.delay ?? 0) * rng.next()
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

function fibre(rng, k) {
  const W = L.glass.barbWide
  return { step: 0.7, w0: rng.range(W[0], W[1]), w1: W[2], h0: k * rng.range(0.55, 0.9), h1: k * L.glass.barbTip, speed: 0.6, curl: rng.range(0.003, 0.03), wobble: 0.008, spark: rng.range(0.45, 1), kappa: 3, reach: 0.1, taper: 0.62, power: L.glass.barbPower }
}
// A feather: a spine, a low soft body in the feather's outline, and fine barbs set close enough to read as fibres.
// How fast each feather's spine runs in from the rim: its own stream, so the drawn shapes do not move with it.
let glassPace = null
function plumeSpec(length, barbMm, rng, t0, k = 1, bold = 1, body = bold) {
  const G = L.glass
  glassPace ??= stream('frost-glass-pace')
  const lean = rng.range(0.6, 1)
  const angle = rng.range(G.barbAngle[0], G.barbAngle[1]) * RAD
  const profile = feather(rng.range(0.16, 0.36), rng.range(0.6, 0.95))
  return {
    len: length,
    step: 0.35,
    w0: rng.range(G.spineWide[0], G.spineWide[1]) * bold,
    w1: 0.05,
    h0: k,
    h1: 0.6 * k,
    speed: G.pace[0] + (G.pace[1] - G.pace[0]) * glassPace.next(),
    t0,
    wobble: G.spineWobble,
    curl: rng.gauss() * 0.005,
    spark: 0.8,
    kappa: 2.5,
    reach: 0.15,
    taper: 0.75,
    film: { w0: barbMm * Math.sin(angle) * G.bodyWide, w1: 0.12, h0: G.bodyFilm * k * body, h1: 0.05 * k, profile, kappa: 3, spark: 0.2 },
    kids: {
      gap: rng.range(L.glass.barbGap[0], L.glass.barbGap[1]),
      len: barbMm,
      min: 0.3,
      wait: G.barbWait[0],
      delay: G.barbWait[1] - G.barbWait[0],
      lean: rng.next() < 0.5 ? lean : 1 / lean,
      angle,
      angleTip: angle * rng.range(0.55, 0.75),
      spread: G.barbSpread,
      profile,
      make: (l, u, r) => {
        const o = fibre(r, k)
        o.w0 *= bold
        if (r.next() < G.longBarbs[0]) {
          o.w0 *= 1.35
          o.h0 = Math.min(1, o.h0 * 1.3)
          o.stretch = r.range(G.longBarbs[1], G.longBarbs[2])
        } else {
          o.h0 *= r.range(0.7, 1)
          o.stretch = r.range(G.barbVary[0], G.barbVary[1])
        }
        return o
      },
    },
  }
}
// A fan: one long bare needle with a few short teeth.
function fanNeedle(length, rng, t0) {
  return {
    len: length,
    step: 0.5,
    w0: rng.range(0.1, 0.15),
    w1: 0.04,
    h0: rng.range(0.85, 1),
    h1: 0.5,
    speed: 1.4,
    t0,
    wobble: 0.006,
    curl: rng.gauss() * 0.004,
    spark: 0.9,
    kappa: 2.5,
    reach: 0.12,
    taper: 0.7,
    film: { w0: 0.5, w1: 0.12, h0: 0.14, h1: 0.05, kappa: 3, spark: 0.2 },
    kids: { gap: rng.range(0.8, 1.5), len: rng.range(0.9, 1.7), min: 0.3, angle: rng.range(26, 36) * RAD, angleTip: 20 * RAD, spread: 0.08, profile: feather(0.1, 0.8), make: (l, u, r) => fibre(r, 0.9) },
  }
}

// A needle of a spray: straight, hair-fine, tapering to nothing; a share of them carry a few short splinters low down.
// A blade of a spray (`blade`): a stouter spear with a soft body and close fibres lying almost along it, like a brush stroke,
// pointed at its tip. With `side` the fibres are fewer, stand further off and are small blades themselves: a stalk with side
// blades, which is how the narrow sheaves beside the plume are built.
function sprayNeedle(length, rng, t0, wide = 1, splinters = 0.35, blade = null) {
  const o = {
    len: length,
    step: 0.5,
    w0: rng.range(0.1, 0.19) * wide,
    w1: 0.035,
    h0: rng.range(0.82, 1),
    h1: 0.45,
    speed: 1.6,
    t0,
    wobble: 0.012,
    curl: rng.gauss() * 0.006,
    spark: 0.9,
    kappa: 2.5,
    reach: 0.1,
    taper: 0.55,
    power: 1.8,
    film: { w0: 0.4, w1: 0.1, h0: 0.12, h1: 0.03, kappa: 3, spark: 0.2 },
  }
  const gap = rng.range(1.5, 2.6)
  const reach = rng.range(0.6, 1.2)
  const angle = rng.range(20, 30) * RAD
  const share = rng.next()
  if (blade) {
    o.w0 = rng.range(blade.wide[0], blade.wide[1]) * wide
    o.taper = blade.taper ?? 0.8
    o.wobble = 0.008
    o.film = { w0: blade.body[0], w1: 0.12, h0: blade.body[1], h1: 0.04, profile: feather(0.12, 0.8), kappa: 3, spark: 0.25 }
    const lie = (blade.angle[0] + (blade.angle[1] - blade.angle[0]) * rng.next()) * RAD
    const k = blade.k ?? 0.85
    o.kids = {
      gap: blade.gap[0] + (blade.gap[1] - blade.gap[0]) * rng.next(),
      len: length * (blade.len[0] + (blade.len[1] - blade.len[0]) * rng.next()),
      min: 0.3,
      angle: lie,
      angleTip: lie * 0.55,
      spread: 0.035,
      profile: feather(0.08, blade.fall ?? 0.9),
      make: (l, u, r) => {
        const f = fibre(r, k)
        f.curl *= 0.4
        // `side`: the fibres are themselves small blades, standing off a stalk (a narrow sheaf like a feather).
        if (blade.side) {
          f.w0 = blade.side[0]
          f.h0 = blade.side[1]
          f.taper = 0.8
          f.spark = 0.9
        }
        return f
      },
    }
  } else if (share < splinters) o.kids = { gap, len: reach, min: 0.3, angle, angleTip: 16 * RAD, spread: 0.06, profile: feather(0.08, 1.6), make: (l, u, r) => fibre(r, 0.8) }
  return o
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
  // The picture is matched from the hero camera, which sees the rim band edge on. A branch is laid out as that camera sees it
  // and then stretched along the glass toward the pole, so that the angle it makes on screen is the one that was asked for.
  const squash = L.glass.minSquash
  const frame = (p) => {
    const nn = norm(p)
    const er = toward(p, [0, 0, p[2] >= 0 ? Rs : -Rs])
    return { nn, er, et: cross(nn, er) }
  }
  ctx.warp = (p, h, hk) => {
    const { nn, er, et } = frame(p)
    const c = Math.max(squash, Math.abs(nn[2]))
    const sa = dot(h, er) * c
    const sb = dot(h, et)
    const sl = Math.hypot(sa, sb) || 1
    const ang = Math.atan2(dot(cross(h, hk), nn), dot(h, hk))
    const ra = (sa * Math.cos(ang) - sb * Math.sin(ang)) / sl
    const rb = (sa * Math.sin(ang) + sb * Math.cos(ang)) / sl
    const va = ra / c
    return { dir: norm([er[0] * va + et[0] * rb, er[1] * va + et[1] * rb, er[2] * va + et[2] * rb]), scale: Math.hypot(va, rb) }
  }
  // A heading and a length on the glass from an angle on screen (0 inward, positive clockwise) and a length on screen.
  const heading = (p, phi, screenMm) => {
    const { nn, er, et } = frame(p)
    const d0 = Math.asin(clamp(Math.abs(nn[2]), 0, 1))
    const d1 = Math.acos(clamp(Math.cos(d0) - (screenMm * Math.cos(phi)) / Rs, 0.05, 1))
    const va = Rs * (d1 - d0)
    const vb = screenMm * Math.sin(phi)
    const l = Math.hypot(va, vb) || 1
    return { h: norm([er[0] * va + et[0] * vb, er[1] * va + et[1] * vb, er[2] * va + et[2] * vb]), scale: Math.min(l / screenMm, L.glass.maxStretch) }
  }
  const leanAt = (deg) => clamp((fbm(Math.cos(deg * RAD) * 1.9 + 5.3, Math.sin(deg * RAD) * 1.9 + 1.7, 3.3, 2) - 0.5) * 3.2, -0.75, 0.75)
  // The measured plumes: a stem from the rim to the root, then on to the tip.
  for (const pl of L.glass.plumes) {
    const root = pixelOnGlass(pl.root[0], pl.root[1])
    const tip = pixelOnGlass(pl.tip[0], pl.tip[1])
    const fromRim = Rs * Math.asin(clamp(Math.abs(root[2]) / Rs, 0, 1))
    const path = [root, ...(pl.via ?? []).map((v) => pixelOnGlass(v[0], v[1])), tip]
    let along = 0
    for (let i = 1; i < path.length; i++) along += arc(path[i - 1], path[i])
    const o = plumeSpec(along * (pl.via ? 1.08 : 1.25), pl.barbMm, rng, rng.range(0, 3) + fromRim * 0.8, 1, pl.bold ?? L.glass.measuredBold)
    o.curl = rng.gauss() * 0.012
    if (pl.spine) {
      o.h0 *= pl.spine
      o.h1 *= pl.spine
      o.w0 *= Math.sqrt(pl.spine)
    }
    if (pl.gap) o.kids.gap *= pl.gap
    o.to = path.slice(1)
    o.steer = 0.5
    grow(ctx, root, toward(root, path[1]), o)
  }
  // Stars: seeded points on the glass, arms thrown out from each.
  for (const st of L.glass.stars) {
    const at = pixelOnGlass(st.at[0], st.at[1])
    const t0 = Math.max(0, Rs * Math.asin(clamp(at[2] / Rs, -1, 1))) * 0.9
    for (const tp of st.tips) {
      const tip = pixelOnGlass(tp[0], tp[1])
      const o = plumeSpec(arc(at, tip) * 1.2, st.barbMm, rng, t0 + rng.range(0, 2), 1, st.bold ?? L.glass.measuredBold)
      o.to = [tip]
      grow(ctx, at, toward(at, tip), o)
    }
  }
  // Tufts: soft fans of fine fronds that rise out of the milk, laid out on screen so the fan opens as the picture's does.
  // The roots of a tuft are frayed along its own axis from their own stream, so a fan does not end on one straight line.
  const fray = stream('frost-tuft-root')
  const tufts = (list, rng, ctx) => {
  for (const tf of list) {
    const T = L.glass.tuft
    const ax = [tf.to[0] - tf.at[0], tf.to[1] - tf.at[1]]
    const al = Math.hypot(ax[0], ax[1])
    const across = [-ax[1] / al, ax[0] / al]
    const basePx = tf.baseMm * REF_PX_PER_MM
    for (let j = 0; j < tf.count; j++) {
      const off = rng.range(-1, 1)
      const a = (off * 0.7 + rng.gauss() * 0.3) * tf.spreadDeg * RAD
      const l = (tf.len[0] + (tf.len[1] - tf.len[0]) * rng.next()) * (1 - (tf.round ?? 0.45) * Math.abs(off))
      const back = (fray.next() - 0.7) * L.glass.rootFray
      const from = [tf.at[0] + across[0] * off * basePx + ax[0] * back, tf.at[1] + across[1] * off * basePx + ax[1] * back]
      const dir = [ax[0] * Math.cos(a) - ax[1] * Math.sin(a), ax[0] * Math.sin(a) + ax[1] * Math.cos(a)]
      const at = pixelOnGlass(from[0], from[1])
      const tip = pixelOnGlass(from[0] + dir[0] * l, from[1] + dir[1] * l)
      const t0 = Math.max(0, Rs * Math.asin(clamp(at[2] / Rs, -1, 1))) * 0.9
      const along = arc(at, tip)
      const o = plumeSpec(along * 1.1, clamp(along * tf.barb, 0.5, 3), rng, t0 + rng.range(0, 2.5), (tf.k ?? T.k) * rng.range(0.7, 1), tf.bold ?? T.bold, tf.body ?? T.body)
      o.to = [tip]
      o.wobble = 0.03
      // A tuft marked skip is grown into nothing: it takes its random numbers, so everything drawn after it keeps its shape.
      grow(tf.skip ? { ...ctx, field: { stroke() {} }, keep: null } : ctx, at, toward(at, tip), o)
    }
  }
  }
  tufts(L.glass.tufts, rng, ctx)
  // Feathers seeded along the rim, front and back. The large ones root at the rim and their tips make the band's inner edge;
  // the small ones are thin and lie under them.
  const seeded = (count, front, kind) => {
    for (let i = 0; i < count; i++) {
      const deg = rng.range(-90, 270)
      const pr = profileAt(deg)
      if (rng.next() > pr.density * (kind === L.glass.feathers.large ? pr.large : 1)) continue
      const reach = pr.reachMm * (front ? 1 : L.glass.backShare)
      const inMm = kind.inFrom + (reach * kind.inShare - kind.inFrom) * Math.pow(rng.next(), kind.inPow)
      const start = rimAt(deg, front ? inMm : -inMm)
      const screenMm = (kind.screenMm[0] + (kind.screenMm[1] - kind.screenMm[0]) * Math.pow(rng.next(), kind.lenPow)) * (0.45 + 0.55 * pr.density)
      const phi = clamp(pr.lean + leanAt(deg) * kind.lean + rng.gauss() * kind.spread, -1.25, 1.25)
      const hd = heading(start, phi, screenMm)
      const length = Math.min(screenMm * hd.scale, Math.max(2, (reach - inMm) * kind.fill))
      const k = rng.range(kind.k[0], kind.k[1])
      const o = plumeSpec(length, clamp((length / hd.scale) * rng.range(kind.barb[0], kind.barb[1]), 0.8, kind.barbMax), rng, rng.range(0, 4) + Math.abs(inMm) * 0.8, k, 1, L.glass.bodyByDensity[0] + L.glass.bodyByDensity[1] * pr.density * pr.density)
      o.curl = rng.gauss() * 0.008
      grow(ctx, start, hd.h, o)
    }
  }
  const F = L.glass.feathers
  seeded(F.large.front, true, F.large)
  seeded(F.large.back, false, F.large)
  seeded(F.small.front, true, F.small)
  seeded(F.small.back, false, F.small)
  // Fans: a handful of long bare needles thrown from one point.
  for (let i = 0; i < F.fans.count; i++) {
    const deg = rng.range(-90, 270)
    const pr = profileAt(deg)
    if (rng.next() > pr.density * pr.density * pr.fan) continue
    const front = rng.next() < 0.7
    const reach = pr.reachMm * (front ? 1 : L.glass.backShare)
    const inMm = reach * rng.range(0.08, 0.5)
    const start = rimAt(deg, front ? inMm : -inMm)
    const phi0 = leanAt(deg) * 0.9 + rng.gauss() * 0.2
    const count = 4 + Math.floor(rng.next() * 6)
    const t0 = rng.range(0, 4) + inMm * 0.8
    for (let j = 0; j < count; j++) {
      const off = rng.range(-0.62, 0.62)
      const screenMm = rng.range(F.fans.screenMm[0], F.fans.screenMm[1]) * (1 - 0.55 * Math.abs(off) / 0.62) * (0.5 + 0.5 * pr.density)
      const hd = heading(start, phi0 + off, screenMm)
      const length = Math.min(screenMm * hd.scale, Math.max(2, (reach - inMm) * 1.1))
      grow(ctx, start, hd.h, fanNeedle(length, rng, t0 + rng.range(0, 1.5)))
    }
  }
  // Loose needles in the rim band.
  for (let i = 0; i < F.needles; i++) {
    const deg = rng.range(-90, 270)
    const pr = profileAt(deg)
    if (rng.next() > pr.film) continue
    const front = rng.next() < 0.62
    const inMm = Math.pow(rng.next(), 1.4) * pr.filmMm * (front ? 1 : L.glass.backShare) * 1.15
    const start = rimAt(deg + rng.range(-0.5, 0.5), front ? inMm : -inMm)
    const screenMm = rng.range(0.5, 2.2)
    const hd = heading(start, leanAt(deg) * 0.6 + rng.gauss() * 0.7, screenMm)
    const l = screenMm * hd.scale
    grow(ctx, start, hd.h, { ...fibre(rng, rng.range(0.35, 0.8)), step: 0.4, len: l, t0: 1 + inMm * 0.9 + rng.range(0, 5), curl: rng.gauss() * 0.02 })
  }
  // The packed bristles of the rim, last and from their own stream.
  const crustRng = stream('frost-glass-crust')
  tufts(L.glass.crust, crustRng, { ...ctx, rng: crustRng })
  // Sprays: sheaves thrown from one root (the sharp needles low on the right of the glass), placed by pixel of the approved
  // image and drawn from their own stream, so nothing else moves. A sheaf is of bare hair needles (a share with a few short
  // splinters) or, with `blade`, of stout pointed blades with fibres lying along them. The large plume is several sheaves
  // from one root (up, up and left, left, up and right) over a core of short needles that overlap into a white body.
  const sprayRng = stream('frost-glass-spray')
  const sprayCtx = { ...ctx, rng: sprayRng }
  for (const sp of L.glass.sprays ?? []) {
    const ax = [sp.to[0] - sp.at[0], sp.to[1] - sp.at[1]]
    const al = Math.hypot(ax[0], ax[1])
    const across = [-ax[1] / al, ax[0] / al]
    const basePx = sp.baseMm * REF_PX_PER_MM
    for (let j = 0; j < sp.count; j++) {
      const off = sprayRng.range(-1, 1)
      const a = (off * 0.85 + sprayRng.gauss() * 0.1) * sp.spreadDeg * RAD
      const tall = sp.long && sprayRng.next() < sp.long[0] ? sp.long[1] : 1
      const l = (sp.len[0] + (sp.len[1] - sp.len[0]) * sprayRng.next()) * (1 - (sp.round ?? 0.3) * Math.abs(off)) * tall
      const back = (sprayRng.next() - 0.6) * (sp.fray ?? 0.12)
      const from = [sp.at[0] + across[0] * off * basePx + ax[0] * back, sp.at[1] + across[1] * off * basePx + ax[1] * back]
      const dir = [ax[0] * Math.cos(a) - ax[1] * Math.sin(a), ax[0] * Math.sin(a) + ax[1] * Math.cos(a)]
      // `lift`: the needle begins this share of its length out from the root, so a sheaf does not close to one point.
      const lift = sp.lift ? l * (sp.lift[0] + (sp.lift[1] - sp.lift[0]) * sprayRng.next()) : 0
      const at = pixelOnGlass(from[0] + dir[0] * lift, from[1] + dir[1] * lift)
      const tip = pixelOnGlass(from[0] + dir[0] * l, from[1] + dir[1] * l)
      const t0 = Math.max(0, Rs * Math.asin(clamp(at[2] / Rs, -1, 1))) * 0.9
      const o = sprayNeedle(arc(at, tip), sprayRng, t0 + sprayRng.range(0, 2.5), sp.wide ?? 1, sp.splinters ?? 0.5, sp.blade ?? null)
      o.to = [tip]
      o.steer = 0.5
      grow(sprayCtx, at, toward(at, tip), o)
    }
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
      const edge = q + (big - 0.5) * L.glass.filmFray[0] + (mid - 0.5) * L.glass.filmFray[1]
      const body = 1 - smooth(L.glass.filmEdge[0], L.glass.filmEdge[1], edge)
      if (body <= 0) continue
      const h = Math.min(1, pr.film * body * (0.1 + 0.13 * mid + 0.07 * (1 - clamp(q))) * L.glass.filmTall)
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

// ---------- the snow heaped against the foot ----------
// A height in millimetres over the slab. It rises from under the rim of the foot, so the lifted globe leaves a soft edge,
// runs out as far as the profile says at that angle, and is lumpy at two sizes so it has lit tops and shaded sides.
function driftProfile(deg) {
  const P = L.slab.drift.profile
  const n = P.length
  let k = 0
  while (k < n && P[k].deg <= deg) k++
  const a = P[(k - 1 + n) % n]
  const b = P[k % n]
  const a0 = k === 0 ? a.deg - 360 : a.deg
  const b0 = k === n ? b.deg + 360 : b.deg
  const u = fade(clamp((deg - a0) / (b0 - a0)))
  return { reachMm: a.reachMm + (b.reachMm - a.reachMm) * u, mm: a.mm + (b.mm - a.mm) * u }
}
// The mound in front of the foot: how full the snow is there, 0 to 1, and when it gets there. It is a crescent that leaves
// the heap on either side of the foot and closes in front of it, away from the rim, so the dark slab shows between.
function moundAt(x, z) {
  const M = L.slab.mound
  const out = Math.hypot(x, z) - footR
  if (out < 0 || out > M.outMm[1] * 1.1) return null
  const deg = Math.atan2(z, x) / RAD
  if (deg < M.deg[0] - 14 || deg > M.deg[1] + 14) return null
  const lobe = fbm(x * 0.07 + 31, 4.2, z * 0.07, 3)
  const reach = fbm(x * 0.05 + 77, 2.2, z * 0.05, 3)
  const fray = fbm(x * 0.45 + 5, 7.7, z * 0.45, 3)
  const ends = smooth(M.deg[0] - 12 + 20 * lobe, M.deg[0] + 6 + 20 * lobe, deg) * (1 - smooth(M.deg[1] - 6 - 20 * lobe, M.deg[1] + 12 - 20 * lobe, deg))
  // At its two ends the crescent meets the heap, so it starts nearer the foot there.
  const mid = Math.sin(Math.PI * clamp((deg - M.deg[0]) / (M.deg[1] - M.deg[0])))
  const inner = M.outMm[0] * (0.6 + 0.4 * smooth(0.0, 0.6, mid)) + M.inVaryMm * (lobe - 0.5) * 2
  // It is a narrow tongue where it leaves the heap and widest in front of the foot.
  const outer = inner + (M.outMm[1] * (0.72 + 0.36 * smooth(0.28, 0.72, reach)) - inner) * (M.endShare + (1 - M.endShare) * smooth(0.0, 0.7, mid))
  const u = (out - inner) / (outer - inner)
  if (u <= 0 || u >= 1) return null
  const across = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 1.15)
  // Broken into clumps: under a broad noise the mound is cut away, so the slab shows through it in places.
  const clump = 0.1 + 0.9 * smooth(M.gap[0], M.gap[1], fbm(x / M.gapMm + 13, 5.5, z / M.gapMm, 3))
  const full = clamp(across * ends * 1.5 * clump - (fray - 0.5) * 2 * M.fray * (1 - 0.6 * across))
  if (full <= 0) return null
  const arc = Math.min(deg - M.deg[0], M.deg[1] - deg)
  return { full, t: M.startAt + Math.max(0, arc) * M.perDeg + Math.max(0, out - inner) * M.perMm + 3 * fray }
}
function driftAt(x, z) {
  const heap = heapAt(x, z)
  const m = moundAt(x, z)
  if (!m) return heap
  const D = L.slab.drift
  const hump = smooth(D.hump[0], D.hump[1], fbm(x / D.lumpMm[0] + 3, 8.6, z / D.lumpMm[0], 3))
  const small = fbm(x / D.lumpMm[1] + 9, 1.3, z / D.lumpMm[1], 3)
  const lumps = (0.45 + 0.9 * hump) * (1 - D.lump[2] + 2 * D.lump[2] * small)
  return Math.max(heap, L.slab.mound.mm * smooth(0.0, 0.7, m.full) * lumps)
}
function heapAt(x, z) {
  const D = L.slab.drift
  const out = Math.hypot(x, z) - footR
  if (out <= -D.underMm || out >= D.outMm) return 0
  const p = driftProfile(Math.atan2(z, x) / RAD)
  const lobe = smooth(0.25, 0.75, fbm(x * 0.045 + 11, 2.7, z * 0.045, 3))
  const reach = p.reachMm * (1 - D.lobe * 0.5 + D.lobe * lobe)
  const far = Math.max(0, out) / reach
  const q = far + (fbm(x * 0.42, 9.4, z * 0.42, 3) - 0.5) * D.fray * smooth(0.12, 0.6, far)
  if (q >= 1) return 0
  const hump = smooth(D.hump[0], D.hump[1], fbm(x / D.lumpMm[0], 5.1, z / D.lumpMm[0], 3))
  const small = fbm(x / D.lumpMm[1] + 9, 1.3, z / D.lumpMm[1], 3)
  const lumps = (D.lump[0] + D.lump[1] * hump) * (1 - D.lump[2] + 2 * D.lump[2] * small)
  return p.mm * smooth(-D.underMm, D.wallMm, out) * Math.pow(1 - Math.max(q, 0), D.fall) * lumps
}

// ---------- the slab ----------
function slabArm(length, rng, t0, bold = 1, pace = 0.5) {
  // A fern of ice: a spine, side branches that are longest a third of the way out, and on each of those a row of short
  // needles. Widths are in millimetres as the hero camera sees them (see the metric in buildSlab). No broad body under it:
  // the dark slab shows between the branches, and the fern thins to single needles at its tip.
  const S = L.slab.fern
  const scale = rng.range(S.scale[0], S.scale[1]) * bold
  const fine = rng.next()
  const needle = (l, u, r) => ({
    step: 0.25,
    w0: r.range(S.needleMm[0], S.needleMm[1]) * scale,
    w1: S.needleTipMm,
    h0: r.range(0.6, 0.85),
    h1: 0.35,
    speed: S.needleSpeed,
    wobble: 0.03,
    spark: r.range(0.5, 1),
    kappa: 3,
    reach: 0.1,
    taper: 0.8,
    power: 1.6,
  })
  const branch = (l, u, r) => ({
    step: 0.3,
    w0: r.range(S.branchMm[0], S.branchMm[1]) * scale * (0.6 + 0.4 * Math.min(1, l / 5)),
    w1: S.branchTipMm,
    h0: r.range(0.75, 0.95),
    h1: 0.5,
    speed: S.branchSpeed * r.range(0.8, 1.25),
    wobble: 0.03,
    curl: r.range(0.0, 0.05),
    spark: r.range(0.5, 0.9),
    kappa: 2.5,
    reach: 0.14,
    taper: 0.6,
    power: 1.7,
    kids:
      l > 1.2
        ? {
            gap: r.range(S.needleGapMm[0], S.needleGapMm[1]),
            start: r.range(0.3, 0.7),
            len: clamp(l * r.range(S.needleShare[0], S.needleShare[1]), 0.5, S.needleMaxMm),
            min: 0.3,
            angle: r.range(42, 52) * RAD,
            angleTip: r.range(30, 38) * RAD,
            spread: 0.1,
            profile: feather(r.range(0.1, 0.25), r.range(0.7, 1.1)),
            make: needle,
          }
        : undefined,
  })
  return {
    len: length,
    step: 0.4,
    w0: rng.range(S.spineMm[0], S.spineMm[1]) * scale,
    w1: S.spineTipMm,
    h0: 1,
    h1: 0.5,
    // The spine shoots out first, each arm at its own speed; the side branches start well behind its tip and fill in slowly.
    speed: S.speed[0] + (S.speed[1] - S.speed[0]) * pace,
    t0,
    wobble: 0.016,
    curl: rng.gauss() * 0.003,
    spark: 0.7,
    kappa: 2,
    reach: 0.2,
    taper: 0.7,
    power: 1.8,
    film: { w0: rng.range(S.rootMm[0], S.rootMm[1]) * scale, w1: 0.1, h0: rng.range(0.5, 0.7), h1: 0.0, profile: (u) => Math.pow(1 - Math.min(1, u / S.rootShare), 1.5), kappa: 2.5, spark: 0.35, power: 1.2 },
    kids: {
      gap: (S.gapMm[0] + (S.gapMm[1] - S.gapMm[0]) * fine) * scale,
      start: rng.range(1, 2.5),
      len: clamp(length * rng.range(S.lenShare[0], S.lenShare[1]), S.lenMm[0], S.lenMm[1]) * (0.8 + 0.4 * fine) * Math.sqrt(bold),
      min: 0.5,
      wait: S.branchWait[0],
      delay: S.branchWait[1] - S.branchWait[0],
      lean: rng.range(S.lean[0], S.lean[1]),
      angle: rng.range(S.angleDeg[0], S.angleDeg[1]) * RAD,
      angleTip: rng.range(S.angleTipDeg[0], S.angleTipDeg[1]) * RAD,
      spread: 0.07,
      profile: feather(rng.range(S.rise[0], S.rise[1]), rng.range(S.fall[0], S.fall[1])),
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
  const ctx = { space, rng, field, keep: lines, keepDepth: 1, designed: true }
  // The slab is seen at a grazing angle by the hero camera. A branch is laid out as that camera sees it and then
  // stretched away from the camera, so that the frond reads as a frond from there; the stretch is capped by minSquash.
  const squash = L.slab.minSquash
  ctx.warp = (p, h, hk) => {
    const sa = h[2] * squash
    const sb = h[0]
    const sl = Math.hypot(sa, sb) || 1
    const ang = Math.atan2(dot(cross(h, hk), [0, 1, 0]), dot(h, hk))
    const ra = (sa * Math.cos(ang) - sb * Math.sin(ang)) / sl
    const rb = (sa * Math.sin(ang) + sb * Math.cos(ang)) / sl
    const va = ra / squash
    return { dir: norm([rb, 0, va]), scale: Math.hypot(va, rb) }
  }
  // A stroke's width is measured as that camera sees it too: a spine that runs across the picture is as thick on screen
  // as one that runs toward the camera, so every stroke is drawn wider along z by the same share.
  ctx.metric = (M) => ({ ...M, m: [M.m[0], M.m[1], M.m[2] * squash, M.m[3] * squash], pxPerMm: M.pxPerMm / squash })
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
  // When each arm starts and how fast its spine runs come from their own stream, so the drawn shapes do not move with them.
  const paces = stream('frost-slab-pace')
  const seeds = stream('frost-slab-seed')
  for (const a of arms) {
    const root = at(a.rootDeg, footR - 0.6)
    const tip = at(a.tipDeg, a.tipMm)
    const d = norm([tip[0] - root[0], 0, tip[2] - root[2]])
    const length = Math.hypot(tip[0] - root[0], tip[2] - root[2]) * 1.02
    const jitter = rng.range(0, 2.5)
    const startAt = L.slab.fern.startAt[0] + (L.slab.fern.startAt[1] - L.slab.fern.startAt[0]) * paces.next() + 0.4 * jitter
    const o = slabArm(length, rng, startAt, a.bold ?? 1, paces.next())
    // Crystals nucleate ahead of the front on the arm's own line and grow both ways until they join it, so the arm is never
    // one picture scaling outward from the foot.
    const E = L.slab.fern.seeds
    const marks = [{ s: 0, t: startAt }]
    for (let k = 0; k < E.count; k++) {
      const s = length * (E.at[0] + ((E.at[1] - E.at[0]) * (k + seeds.next())) / E.count)
      marks.push({ s, t: startAt + (s / o.speed) * (E.early[0] + (E.early[1] - E.early[0]) * seeds.next()) })
    }
    o.when = (x) => Math.min(...marks.map((m) => m.t + Math.abs(x - m.s) / o.speed))
    o.to = [tip]
    o.steer = 0.25
    // An arm marked skip is grown into nothing: it takes its random numbers, so the arms after it keep their shapes.
    grow(a.skip ? { ...ctx, field: { stroke() {} }, keep: null } : ctx, root, d, o)
  }
  // The heap that hugs the foot, loose grains, clumps and thin patches further out.
  const { H, T, S } = field
  const U = L.slab.under
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
      const i = y * n + x
      if (r < footR) {
        // Under the rim of the foot a thin film creeps inward and breaks into specks, so the lifted globe leaves no clean hole.
        const lobe = fbm(wx * 0.11 + 7, 6.3, wz * 0.11, 3)
        const fray = fbm(wx * 0.5, 9.4, wz * 0.5, 3)
        const q = (footR - r) / (U.inMm[0] + (U.inMm[1] - U.inMm[0]) * smooth(0.3, 0.72, lobe))
        if (q < 1.3) {
          const speck = smooth(0.45, 0.68, 0.6 * noise3(wx * 2.6, 5.5, wz * 2.6) + 0.4 * noise3(wx * 6.4, 2.2, wz * 6.4))
          const body = 1 - smooth(0.1, 1.1, q + (fray - 0.5) * 0.7)
          const h = body * (U.film * (0.4 + 1.2 * fray) + U.speck * speck)
          if (h > H[i]) H[i] = h
          const s = body * (0.15 + 0.5 * speck)
          if (s > S[i]) S[i] = s
          const t = 0.4 + (footR - r) * 0.5 + fray * 1.5
          if (t < T[i]) T[i] = t
        }
      }
      if (r < footR - 8) continue
      const big = fbm(wx * 0.09, 3.1, wz * 0.09, 3)
      const mid = fbm(wx * 0.5, 9.4, wz * 0.5, 3)
      const frontClear = 1 - (1 - L.slab.front.keep) * smooth(L.slab.front.clear[0], L.slab.front.clear[1], wz / (r || 1))
      const reach = (L.slab.heapMm[0] + L.slab.heapMm[1] * smooth(0.3, 0.75, big)) * (L.slab.heapSide[0] + L.slab.heapSide[1] * (wx / (r || 1)) ** 2) * frontClear
      const q = (r - footR + 1.5) / reach
      if (q < 1.2) {
        const wall = U.wallMm * smooth(0.35, 0.7, fbm(wx * 0.3 + 3, 1.1, wz * 0.3, 3))
        const body = (1 - smooth(0.35, 1.1, q + (mid - 0.5) * 0.9)) * smooth(-2.5 - wall, -0.5 - 0.6 * wall, r - footR)
        const h = body * (0.36 + 0.55 * mid + 0.25 * (1 - clamp(q)))
        if (h > H[i]) H[i] = h
        const s = body * (0.3 + 0.4 * mid)
        if (s > S[i]) S[i] = s
        const t = 0.5 + Math.max(0, r - footR) * 0.8 + mid * 2
        if (t < T[i]) T[i] = t
      }
      const md = moundAt(wx, wz)
      if (md) {
        const body = smooth(0.0, 0.55, md.full)
        const h = body * L.slab.mound.body * (0.55 + 0.6 * mid + 0.3 * md.full)
        if (h > H[i]) H[i] = h
        const s = body * (0.3 + 0.4 * mid)
        if (s > S[i]) S[i] = s
        if (md.t < T[i]) T[i] = md.t
      }
      const far = fbm(wx * 0.06 + 40, 1.7, wz * 0.06, 4)
      const thin = smooth(0.6, 0.74, far) * (1 - smooth(half * 0.72, half * 0.97, r)) * smooth(footR + 6, footR + 24, r)
      if (thin > 0) {
        const speck = smooth(0.5, 0.68, 0.6 * noise3(wx * 3.1, 5.5, wz * 3.1) + 0.4 * noise3(wx * 7.3, 2.2, wz * 7.3))
        const h = thin * speck * (0.1 + 0.22 * mid)
        if (h > H[i]) H[i] = h
        const s = 0.1 + 0.2 * mid + 0.5 * speck
        if (s > S[i]) S[i] = s
        // The thin patches nucleate on their own, ahead of the arms, in the order of the noise rather than of the distance.
        const t = 5 + (r - footR) * 0.35 + mid * 26
        if (t < T[i]) T[i] = t
      }
    }
  }
  // The strip of slab between the front of the foot and the mound is kept bare (the approved image shows the dark slab and the
  // foot's reflection there): a loose grain or a clump that falls in it is left out. Its random numbers are still drawn, so
  // the grains after it keep their places.
  const inStrip = (x, z) => {
    const r = Math.hypot(x, z)
    return r < footR + L.slab.mound.outMm[0] - 1 && smooth(L.slab.front.clear[0], L.slab.front.clear[1], z / (r || 1)) > L.slab.front.bare
  }
  for (let i = 0; i < L.slab.grains; i++) {
    const deg = rng.range(-180, 180)
    const r = footR + 0.5 + Math.min(70, -Math.log(1 - rng.next() * 0.985) * 15)
    const size = L.slab.grainMm[0] + L.slab.grainMm[1] * Math.pow(rng.next(), 2.6)
    const x = r * Math.cos(deg * RAD)
    const z = r * Math.sin(deg * RAD)
    const t = 3 + (r - footR) * 0.55 + rng.range(0, 12)
    const h = clamp(size * rng.range(0.9, 1.5), 0.1, 0.7)
    const spark = rng.range(0.4, 1)
    if (inStrip(x, z)) continue
    bump(x, z, size, h, t, spark)
    grains.push({ x, z, r: size, h, t })
  }
  for (let i = 0; i < L.slab.clumps; i++) {
    const deg = rng.range(-180, 180)
    const r = footR + 2 + Math.min(58, -Math.log(1 - rng.next() * 0.97) * 17)
    const cx = r * Math.cos(deg * RAD)
    const cz = r * Math.sin(deg * RAD)
    const spread = rng.range(0.8, 3.6)
    const count = Math.round(rng.range(8, 16) * spread)
    const t0 = 3 + (r - footR) * 0.3 + rng.range(0, 26)
    const bare = inStrip(cx, cz)
    if (!bare) bump(cx, cz, spread * 0.9, 0.07 + 0.04 * spread, t0, 0.3)
    for (let k = 0; k < count; k++) {
      const a = rng.range(0, 2 * Math.PI)
      const d = spread * Math.sqrt(rng.next())
      const size = 0.16 + 0.42 * Math.pow(rng.next(), 1.7)
      const x = cx + d * Math.cos(a)
      const z = cz + d * Math.sin(a)
      const h = clamp(0.2 + 0.1 * spread + size * rng.range(0.5, 1.1), 0.1, 0.85)
      const t = t0 + d * 1.5 + rng.range(0, 2)
      const spark = rng.range(0.4, 1)
      if (bare || inStrip(x, z)) continue
      bump(x, z, size, h, t, spark)
      grains.push({ x, z, r: size, h, t, base: (0.12 + 0.07 * spread) * (1 - d / (spread * 1.1)) })
    }
  }
  return { field, lines, grains }
}

// ---------- real shapes on the slab ----------
// One mesh in three kinds, drawn in this order: the heap, then the ridges of the arms and the grains, each sorted far to near
// for the hero camera so that their soft edges blend over what is behind them.
// uv = (when it appears, how deep the snow is there: 0 a film, 1 a full body), uv1 = (0 at a soft edge to 1 inside, how open it is to the sky).
function slabShapes(lines, grains, tTop) {
  const rng = stream('frost-shapes')
  const pos = []
  const uv = []
  const uv1 = []
  const mm = L.slab.heightMm
  const when = (t) => clamp((t / tTop) * 0.96)
  const vert = (x, y, z, t, deep, edge, open) => {
    pos.push(x, y, z)
    uv.push(when(t), deep)
    uv1.push(edge, open)
    return pos.length / 3 - 1
  }
  const S = L.slab.shapes
  const D = L.slab.drift
  const count = { heap: 0, ridges: 0, lumps: 0 }

  const heap = []
  const row = D.segments
  const r0 = footR - D.underMm
  const dr = (D.underMm + D.outMm) / D.rings
  const tall = new Float32Array((D.rings + 1) * row)
  const spot = (i, k) => {
    const r = r0 + i * dr
    const a = (k / row) * 2 * Math.PI
    return [r * Math.cos(a), r * Math.sin(a)]
  }
  for (let i = 1; i < D.rings; i++) for (let k = 0; k < row; k++) {
    const [x, z] = spot(i, k)
    tall[i * row + k] = driftAt(x, z)
  }
  const tallAt = (i, k) => (i < 0 || i > D.rings ? 0 : tall[i * row + (((k % row) + row) % row)])
  const ids = new Int32Array(tall.length).fill(-1)
  const corner = (i, k) => {
    const j = i * row + (k % row)
    if (ids[j] < 0) {
      const [x, z] = spot(i, k % row)
      const r = r0 + i * dr
      const si = Math.max(1, Math.round(D.openMm / dr))
      const sk = Math.max(1, Math.round(D.openMm / ((r * 2 * Math.PI) / row)))
      const around = (tallAt(i - si, k) + tallAt(i + si, k) + tallAt(i, k - sk) + tallAt(i, k + sk)) / 4
      const open = clamp(1 - (around - tall[j]) * D.cavity, D.openMin, 1)
      const md = moundAt(x, z)
      const loose = md && heapAt(x, z) < tall[j]
      const t = loose ? md.t : 0.5 + Math.max(0, r - footR) * 0.8 + 2 * fbm(x * 0.5, 9.4, z * 0.5, 3)
      // The mound in front is thin loose snow: a wide soft edge and less body than the heap at the foot.
      ids[j] = vert(x, tall[j], z, t, smooth(0, D.deepMm, tall[j]) * (loose ? L.slab.mound.deep : 1), clamp(tall[j] / (loose ? L.slab.mound.softMm : D.softMm)), open)
    }
    return ids[j]
  }
  for (let i = 0; i < D.rings; i++) for (let k = 0; k < row; k++) {
    if (Math.max(tallAt(i, k), tallAt(i + 1, k), tallAt(i, k + 1), tallAt(i + 1, k + 1)) <= D.minMm) continue
    const a = corner(i, k)
    const b = corner(i + 1, k)
    const c = corner(i, k + 1)
    const d = corner(i + 1, k + 1)
    heap.push([a, c, b], [b, c, d])
  }
  count.heap = heap.length

  const small = []
  const onDrift = (y) => 1 - (1 - S.ridgeOnDrift) * smooth(0.15, 1.4, y)
  for (const line of S.ridges ? lines : []) {
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
      const sway = Math.sin(id * 40 + i * 0.37)
      const low = onDrift(driftAt(p[0], p[2]))
      const t = line.t[i]
      const end = i === 0 || i === n - 1 ? 0 : 1
      const at = (side, y, tt, edge, open) => {
        const x = p[0] + lat[0] * side
        const z = p[2] + lat[2] * side
        const under = driftAt(x, z)
        return vert(x, under + y, z, tt, Math.max(smooth(0, D.deepMm, under), open * open * (line.depth > 0 ? S.leafDeep : S.bodyDeep)), edge * end, open)
      }
      let rowNow
      if (line.depth === 0) {
        // An arm: a broad rounded body of snow with a low crest along the spine.
        const body = Math.max(line.f[i] * S.bodyShare * (1 + 0.14 * sway + rng.range(-0.05, 0.05)), line.w[i])
        const high = S.bodyTall * Math.pow(line.f[i] / line.f[0], S.bodyFall) * low * (0.85 + 0.3 * fbm(p[0] * 0.3, id * 9, p[2] * 0.3, 2))
        const core = Math.min(line.w[i], 0.3 * body)
        const crest = Math.min(line.h[i] * mm, core * S.ridgeSteep) * S.crestTall * low
        const off = 0.08 * body * Math.sin(id * 70 + i * 0.23)
        rowNow = [
          at(-body, 0, t + 2.5 * body, 0, 0.5),
          at(-0.7 * body, 0.55 * high, t + 1.8 * body, S.bodyEdge, 0.72),
          at(-0.36 * body, 0.9 * high, t + body, 1, 0.9),
          at(off, high + crest * rng.range(0.9, 1), t, 1, 1),
          at(0.36 * body, 0.9 * high, t + body, 1, 0.9),
          at(0.7 * body, 0.55 * high, t + 1.8 * body, S.bodyEdge, 0.72),
          at(body, 0, t + 2.5 * body, 0, 0.5),
        ]
      } else {
        // A side leaf: fat and rounded, as wide as the blade the map draws for it.
        const core = line.w[i] * (1 + 0.12 * sway + rng.range(-0.05, 0.05))
        const w = Math.max(core, line.f[i] * S.leafShare)
        const h = Math.min(line.h[i] * mm * (0.8 + 0.1 * sway), core * S.ridgeSteep + (w - core) * 0.25) * S.ridgeTall * low
        const off = (0.2 * Math.sin(id * 70 + i * 0.23) + rng.range(-0.05, 0.05)) * w
        const crest = h * rng.range(0.9, 1)
        rowNow = [
          at(-w, 0, t + 2 * w, 0, 0.55),
          at(off - 0.52 * w, 0.72 * h, t + w, S.leafEdge, 0.8),
          at(off, crest, t, 1, 1),
          at(off + 0.52 * w, 0.72 * h, t + w, S.leafEdge, 0.8),
          at(w, 0, t + 2 * w, 0, 0.55),
        ]
      }
      const strips = rowNow.length - 1
      if (prev) for (let k = 0; k < strips; k++) small.push([prev[k], prev[k + 1], rowNow[k]], [prev[k + 1], rowNow[k + 1], rowNow[k]])
      if (prev) count.ridges += 2 * strips
      prev = rowNow
    }
  }
  // `thrown` marks a loose grain the landing throws outward: its vertices carry 2 + (how far it skids, mm) / 64 in place of
  // how open they are, and the shader slides the grain in from that far nearer the foot.
  const lump = (x, z, r, h, t, y0 = 0, soft = 1, thrown = 0) => {
    const base = y0 + driftAt(x, z)
    const high = Math.min(h * mm, r * rng.range(0.5, 0.85))
    const open = (o) => (thrown > 0 ? 2 + thrown / 64 : o)
    const top = vert(x + rng.range(-0.15, 0.15) * r, base + high, z + rng.range(-0.15, 0.15) * r, t, soft, soft, open(1))
    const ring = []
    const mid = []
    const sides = r >= S.lumpFullMm ? 8 : 6
    const turn = rng.range(0, 6.28)
    for (let k = 0; k < sides; k++) {
      const a = turn + (k / sides) * 2 * Math.PI
      const rr = r * rng.range(0.95, 1.2)
      ring.push(vert(x + rr * Math.cos(a), base, z + rr * Math.sin(a), t, 0.3 * soft, 0, open(0.5)))
      const rm = r * rng.range(0.62, 0.76)
      mid.push(vert(x + rm * Math.cos(a + 0.4), base + high * rng.range(0.66, 0.8), z + rm * Math.sin(a + 0.4), t, 0.75 * soft, soft * (soft < 1 ? 0.55 : 1), open(0.85)))
    }
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides
      small.push([ring[k], mid[k], ring[k1]], [ring[k1], mid[k], mid[k1]], [mid[k], top, mid[k1]])
    }
    count.lumps += sides * 3
  }
  for (const g of grains) if (g.base !== undefined && g.r >= S.grainMinMm) lump(g.x, g.z, g.r, g.h, g.t, g.base * mm)
  for (const f of L.slab.farPatches) {
    const cx = f.mm * Math.cos(f.deg * RAD)
    const cz = f.mm * Math.sin(f.deg * RAD)
    const lumps = Math.round(f.sizeMm * S.farPerMm)
    for (let k = 0; k < lumps; k++) {
      const a = rng.range(0, 2 * Math.PI)
      const d = f.sizeMm * Math.pow(rng.next(), 0.7)
      lump(cx + d * Math.cos(a) * 1.6, cz + d * Math.sin(a) * 0.8, rng.range(1.2, 2.6), rng.range(0.12, 0.3), tTop * (0.55 + 0.4 * rng.next()), 0, S.farSoft)
    }
  }
  // Loose grains the landing throws out of the heap: each skids outward and stops, the far ones last.
  const TH = L.slab.thrown
  const tr = stream('frost-thrown')
  for (let k = 0; k < TH.count; k++) {
    const deg = tr.range(-180, 180)
    const out = TH.outMm[0] + (TH.outMm[1] - TH.outMm[0]) * Math.pow(tr.next(), 1.4)
    const r = footR + out
    const size = TH.sizeMm[0] + (TH.sizeMm[1] - TH.sizeMm[0]) * Math.pow(tr.next(), 2)
    const skid = Math.min(out + 2, tr.range(TH.skidMm[0], TH.skidMm[1]))
    const share = clamp((out - TH.outMm[0]) / (TH.outMm[1] - TH.outMm[0]))
    const t = tTop * (TH.when[0] + (TH.when[1] - TH.when[0]) * clamp(0.75 * share + 0.25 * tr.next()))
    lump(r * Math.cos(deg * RAD), r * Math.sin(deg * RAD), size, tr.range(0.35, 0.7), t, 0, 1, skid)
    count.thrown = (count.thrown ?? 0) + 1
  }
  const depth = (tri) => pos[tri[0] * 3 + 2] + pos[tri[1] * 3 + 2] + pos[tri[2] * 3 + 2]
  const far = (list) => list.map((tri) => ({ tri, z: depth(tri) })).sort((a, b) => a.z - b.z).flatMap((e) => e.tri)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2))
  g.setIndex([...far(heap), ...far(small)])
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
  const g = new THREE.CircleGeometry(L.slab.halfMm, 128)
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
for (const old of ['frost-glass.lin.w1536.png', 'frost-slab.lin.w1536.png']) fs.rmSync(path.join(OUT, old), { force: true })
const t0 = process.hrtime.bigint()
const only = args.only && args.only !== true ? String(args.only) : ''
const report = []

if (!only || only === 'glass') {
  const glass = buildGlass()
  const bytes = glass.bytes()
  await png(bytes, glass.n, path.join(OUT, 'frost-glass.lin.w2048.png'))
  await look(bytes, glass.n, path.join(LOOK, 'glass-height.jpg'), (r) => r)
  await look(bytes, glass.n, path.join(LOOK, 'glass-when.jpg'), (r, g) => (r > 20 ? g : 0))
  report.push(`glass map ${glass.n} px, last stroke at ${glass.tMax.toFixed(1)}, threshold top ${glass.top.toFixed(1)}`)
}
let shapes = null
if (!only || only === 'slab') {
  const slab = buildSlab()
  const bytes = slab.field.bytes()
  await png(bytes, slab.field.n, path.join(OUT, 'frost-slab.lin.w2048.png'))
  await look(bytes, slab.field.n, path.join(LOOK, 'slab-height.jpg'), (r) => r)
  await look(bytes, slab.field.n, path.join(LOOK, 'slab-when.jpg'), (r, g) => (r > 20 ? g : 0))
  shapes = slabShapes(slab.lines, slab.grains, slab.field.top)
  report.push(`slab map ${slab.field.n} px, ${slab.lines.length} kept lines, ${slab.grains.length} grains, threshold top ${slab.field.top.toFixed(1)}`)
}
if (!only || only === 'grain') await png(grainTile(L.grain.px), L.grain.px, path.join(OUT, 'frost-grain.lin.tile.png'))
if (shapes) {
  const extras = { glassMaxPolarDeg: L.glass.maxPolarDeg, glassHeightMm: L.glass.heightMm, glassLiftMm: L.glass.liftMm, slabHalfMm: L.slab.halfMm, slabHeightMm: L.slab.heightMm, grainTileMm: L.grain.tileMm }
  const r = writeGlb(path.join(OUT, 'frost-shapes.glb'), [fromThree('glass', glassBand(), extras), fromThree('sheet', slabSheet(), extras), fromThree('shapes', shapes, extras)], extras)
  report.push(`frost-shapes.glb ${(r.bytes / 1e6).toFixed(2)} MB, ${r.triangles} triangles in ${r.meshes} meshes (shapes ${shapes.index.count / 3}: heap ${shapes.userData.count.heap}, ridges ${shapes.userData.count.ridges}, grain lumps ${shapes.userData.count.lumps})`)
}
for (const f of fs.readdirSync(OUT).filter((f) => f.startsWith('frost-'))) report.push(`${f} ${(fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2)} MB`)
console.log(report.join('\n'))
console.log(`frost-winter built in ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1)} s`)
