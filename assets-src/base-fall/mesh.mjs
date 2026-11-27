import { projectWorld } from '../../tools/lib/refcam.mjs'
import * as L from './layout.mjs'
import { Soup, add3, clamp, cross3, dot3, fbm, mix, mulberry, norm3, smooth } from './lib.mjs'

const { RAD, place, drumR, FACES, FACE_R } = L
const TILE = 16
const radial = (az) => [Math.sin(az * RAD), 0, Math.cos(az * RAD)]
const along = (az) => [Math.cos(az * RAD), 0, -Math.sin(az * RAD)]
const azOf = (p) => Math.atan2(p[0], p[2]) / RAD
const sidesAt = (az, near, far) => (L.front(az) <= 125 ? near : far)

// A tube along a path. `radii` per point; `flat` squeezes it toward the ring. Paint: shade, kind, and for a vine its
// radius over 2.5 mm, for a thorn how far along it.
function tube(soup, pts, radii, sides, paint, flat = 1, vAt = 0, gnarl = 0, seed = 1) {
  const n = pts.length
  const frames = []
  let len = 0
  const arc = [0]
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(i - 1, 0)]
    const b = pts[Math.min(i + 1, n - 1)]
    const t = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]])
    let out = norm3([pts[i][0], 0, pts[i][2]])
    let nn = add3(out, t, -dot3(out, t))
    if (Math.hypot(...nn) < 0.2) nn = add3([0, 1, 0], t, -t[1])
    nn = norm3(nn)
    frames.push({ t, n: nn, b: cross3(t, nn) })
    if (i > 0) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])
      arc.push(len)
    }
  }
  soup.grid(sides + 1, n, (i, j) => {
    // The seam of a tube is on the side that faces the ring.
    const a = (i / sides) * 2 * Math.PI + Math.PI
    const f = frames[j]
    const d = add3([f.n[0] * Math.cos(a) * flat, f.n[1] * Math.cos(a) * flat, f.n[2] * Math.cos(a) * flat], f.b, Math.sin(a))
    let nrm = norm3(add3([f.n[0] * Math.cos(a), f.n[1] * Math.cos(a), f.n[2] * Math.cos(a)], f.b, Math.sin(a) * flat))
    let lump = 1
    if (gnarl) {
      const around = ((i % sides) / sides) * 6
      const flute = fbm(around + seed, arc[j] * 0.11, 6, 4096, seed + 2, 2) - 0.5
      const knot = fbm(arc[j] * 0.16 + seed, around * 0.5, 4096, 3, seed, 3) - 0.5
      lump = 1 + gnarl * (0.5 * flute + 1.1 * knot + 1.5 * Math.max(knot - 0.12, 0))
      const fluteNext = fbm(around + 0.35 + seed, arc[j] * 0.11, 6, 4096, seed + 2, 2) - 0.5
      const round = add3([-f.n[0] * Math.sin(a), -f.n[1] * Math.sin(a), -f.n[2] * Math.sin(a)], f.b, Math.cos(a))
      nrm = norm3(add3(nrm, round, -gnarl * 1.1 * (fluteNext - flute)))
    }
    const p = add3(pts[j], d, radii[j] * lump)
    const c = paint(j, a, p, nrm)
    return { p, n: nrm, uv: [arc[j] / TILE + vAt, i / sides], uv2: [arc[j] / TILE + vAt, (i / sides) * ((2 * Math.PI * Math.max(radii[j], 0.4)) / TILE) * 2], c }
  })
}

function lathe(soup, profile, cols, paintOf, wobble = 0, seed = 1) {
  const normals = profile.map((_, i) => {
    const a = profile[Math.max(i - 1, 0)]
    const b = profile[Math.min(i + 1, profile.length - 1)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]
  })
  const arc = [0]
  for (let i = 1; i < profile.length; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
  soup.grid(cols.length, profile.length, (i, j) => {
    const az = cols[i]
    const [r, h] = profile[j]
    const w = wobble ? (fbm(((az + 180) / 360) * 40, h * 0.22 + 3, 40, 64, seed, 3) - 0.5) * wobble : 0
    const nr = normals[j]
    const s = Math.sin(az * RAD)
    const c = Math.cos(az * RAD)
    return {
      p: place(r + w * nr[0], h + w * nr[1], az),
      n: [nr[0] * s, nr[1], nr[0] * c],
      uv: [(az / 360) * 20, arc[j] / TILE],
      uv2: [(az / 360) * Math.round((2 * Math.PI * 50) / TILE), arc[j] / TILE],
      c: paintOf(j, az, r, h),
    }
  })
}

const columns = (near, far) => {
  const out = []
  for (let az = -180; az < 180 - 1e-6; az += L.front(az + near / 2) <= 125 ? near : far) out.push(az)
  out.push(180)
  return out
}

function faceGap(az, h, pad) {
  let best = Infinity
  for (const f of FACES) {
    const dx = (L.wrapDeg(az - f.az) * RAD * FACE_R) / (f.rad + pad)
    const dy = (h - f.h) / (f.tall + pad)
    best = Math.min(best, Math.hypot(dx, dy))
  }
  return best
}

const SIZE = undefined
const SEEN_PX = FACES.filter((f) => f.seen).map((f) => {
  const c = projectWorld(place(FACE_R + 3, f.h, f.az), SIZE, L.RIG)
  const e = projectWorld(place(FACE_R + 3, f.h + f.tall, f.az), SIZE, L.RIG)
  const k = Math.abs(e[1] - c[1]) / f.tall
  return { x: c[0], y: c[1], rx: (f.rad + 1.3) * k, ry: (f.tall + 1.3) * k }
})
// The sheaf's window at the left: no thorn lies across it.
const overSheaf = (p) => azOf(p) > -72 && azOf(p) < -49 && p[1] > 8 && p[1] < 22
function crossesFace(p) {
  if (faceGap(azOf(p), p[1], 1.3) < 1 && Math.hypot(p[0], p[2]) < FACE_R + 26) return true
  const s = projectWorld(p, SIZE, L.RIG)
  for (const f of SEEN_PX) if (Math.hypot((s[0] - f.x) / f.rx, (s[1] - f.y) / f.ry) < 1) return true
  return false
}

// The woven strands: each one a path round the ring that rises and falls, lifts over and under its neighbours, and
// bows round every carved face.
const STRANDS = []
function addStrands() {
  const rng = mulberry(4107)
  const r = (a, b) => a + (b - a) * rng()
  const push = (s) => STRANDS.push({ seed: STRANDS.length * 31 + 7, slope: 0, reach: 0, bend: 0, ...s })
  // The foot: three vines that lie in a heap round it and sprawl out over the slab, so the base stands in a nest.
  for (let i = 0; i < 3; i++) push({ a0: -180, span: 360, h0: 3.0 + i * 2.3, amp: 3.0 + 0.4 * i, k: [5, 4, 6][i], ph: r(0, 6.28), rad: r(1.4, 1.9), lift: 1.6 + 1.1 * i, sprawl: 1.5 - i * 0.45, wander: 1.9, thorn: [7, 12], every: 46, layer: 0 })
  // The crown: two vines under the glass.
  for (let i = 0; i < 2; i++) push({ a0: -180, span: 360, h0: 33.0 + i * 2.5, amp: 2.6 - 0.6 * i, k: 4 + 2 * i, ph: r(0, 6.28), rad: r(1.4, 1.9), lift: 1.5 + i, sprawl: 0, wander: 1.2, thorn: [7, 11], every: 54, layer: 2 })
  // The vines: thin tapering lengths that wander round the ring, each on its own slant with its own swing, so they
  // cross one another at many angles and leave the dark drum in view between them. One in four is a short steep one.
  const count = 37
  for (let i = 0; i < count; i++) {
    const steep = i % 3 === 2
    const turn = steep ? r(20, 46) : r(7, 24)
    const span = steep ? r(22, 46) : Math.min(r(52, 128), 30 / (Math.tan(turn * RAD) * RAD * 53))
    let a0 = -180 + (i * 360) / count + r(-9, 9) + ((i * 137.5) % 360)
    // Fewer vines cross the right flank, where the key lights the leather between them.
    const mid = L.wrapDeg(a0 + span / 2)
    if (!steep && mid > 42 && mid < 100 && i % 2 === 0) a0 += 180
    const angle = (rng() < 0.5 ? -1 : 1) * turn
    const slope = Math.tan(angle * RAD) * span * RAD * 53
    const rad = steep ? r(0.85, 1.2) : i % 4 === 0 ? r(1.3, 1.7) : r(0.95, 1.4)
    push({ a0, span, h0: steep ? r(11, 26) : 5.5 + 27 * ((i * 0.618034) % 1) + r(-1.5, 1.5), slope, bend: steep ? r(-3, 3) : r(-7, 7), amp: steep ? r(0.6, 1.4) : r(1.5, 3.8), k: r(2.4, 6.5), ph: r(0, 6.28), rad, lift: r(1.2, 7.2), sprawl: 1.1, wander: r(1.2, 2.6), thorn: [7, 14], every: 36, layer: 3, open: true, reach: r(3.5, 9.5) })
  }
  // The wires: thin lengths that fill the tangle between the vines.
  for (let i = 0; i < 9; i++) {
    const a0 = -180 + i * 40 + r(-8, 8)
    const span = r(40, 100)
    push({ a0, span, h0: r(4, 32), slope: Math.tan((rng() < 0.5 ? -1 : 1) * r(4, 30) * RAD) * span * RAD * 53, bend: r(-4, 4), amp: r(1.2, 3.2), k: r(2, 5), ph: r(0, 6.28), rad: r(0.45, 0.7), lift: r(1.2, 6.5), sprawl: 0.6, wander: 2.2, thorn: [3.5, 6.5], every: 40, layer: 3, open: true, reach: r(2, 6) })
  }
  // The twigs: the left of the ring is a tangle of thin steep lengths that stand out from the drum.
  for (let i = 0; i < 9; i++) {
    const a0 = r(-128, -72)
    const span = r(18, 48)
    push({ a0, span, h0: r(3, 31), slope: Math.tan((rng() < 0.5 ? -1 : 1) * r(14, 55) * RAD) * span * RAD * 53, bend: r(-5, 5), amp: r(0.8, 2.4), k: r(2, 6), ph: r(0, 6.28), rad: r(0.24, 0.42), lift: r(2.5, 9), sprawl: 1.2, wander: 2.4, thorn: [2.5, 5], every: 30, layer: 3, open: true, reach: r(3, 8) })
  }
  // Three pairs of thick vines stand out of that tangle, the two of a pair wound round each other.
  for (let i = 0; i < 3; i++) {
    const a0 = r(-134, -108)
    const span = r(42, 60)
    const pair = { a0, span, h0: 9 + 8 * i + r(-2, 2), slope: Math.tan((i % 2 ? -1 : 1) * r(16, 38) * RAD) * span * RAD * 53, bend: r(-5, 5), k: r(7, 10), ph: r(0, 6.28), lift: r(5.5, 9), sprawl: 1.2, wander: 1.4, thorn: [5, 9], layer: 3, open: true, reach: r(2, 6), gnarl: 0.4, seed: 9001 + i * 17 }
    push({ ...pair, amp: 1.5, rad: r(1.6, 2.0), every: 34 })
    push({ ...pair, amp: -1.5, rad: r(1.1, 1.3), every: 90 })
  }
  // Thin vines curve over the bare hide of the right flank.
  for (let i = 0; i < 11; i++) {
    const span = r(20, 42)
    const a0 = r(40, 64)
    push({ a0, span, h0: 5 + 2.8 * i + r(-2, 2), slope: Math.tan((i % 2 ? -1 : 1) * r(24, 56) * RAD) * span * RAD * 53, bend: r(-9, 9), amp: r(1.5, 3.5), k: r(5, 9), ph: r(0, 6.28), rad: r(0.75, 1.15), lift: r(1.0, 4.5), sprawl: 0.6, wander: 2.0, thorn: [4, 8], every: 70, layer: 3, open: true, reach: r(2, 6) })
  }
  // The wall right of the third face: one thick vine that curls down it and two thin ones that cross it.
  push({ a0: 50, span: 36, h0: 20, slope: -20, bend: 6, amp: 2.5, k: 7, ph: 1.0, rad: 1.25, lift: 3, sprawl: 0.6, wander: 1.5, thorn: [6, 10], every: 60, layer: 3, open: true, reach: 3 })
  push({ a0: 54, span: 30, h0: 14, slope: 20, bend: -5, amp: 1.5, k: 6, ph: 2.2, rad: 0.36, lift: 4.5, sprawl: 0.6, wander: 2.2, thorn: [3, 5], every: 200, layer: 3, open: true, reach: 4 })
  push({ a0: 58, span: 26, h0: 25, slope: -14, bend: 7, amp: 2.0, k: 8, ph: 4.0, rad: 0.32, lift: 5.5, sprawl: 0.6, wander: 2.2, thorn: [3, 5], every: 200, layer: 3, open: true, reach: 4 })
}
addStrands()

function strandPath(s) {
  const n = Math.ceil((s.span * RAD * 54) / 1.5)
  const hs = []
  const azs = []
  const base = (az) => {
    const u = (az - s.a0) / s.span
    return s.h0 + s.slope * (u - 0.5) + s.bend * (4 * u * (1 - u) - 0.6) + s.amp * Math.sin(s.k * az * RAD + s.ph) + (fbm(((az + 180) / 360) * 14, 0.37, 14, 4, s.seed, 3) - 0.5) * s.amp * (s.wander ?? 1.2)
  }
  // Where this strand is level with a face: its own turn round the ring, not the face's (a strand may start at 170
  // degrees and run on past 180), and its nearer end where it does not reach the face.
  const level = (f) => {
    let d = (((f.az - s.a0) % 360) + 360) % 360
    if (d > s.span) d = d - s.span < 360 - d ? s.span : 0
    return base(s.a0 + d)
  }
  const side = FACES.map((f) => (level(f) >= f.h ? 1 : -1))
  // Half the strands that meet a pumpkin do not go round it: they pass behind it, sunk into the ring there.
  const under = FACES.map((f, q) => s.layer !== 0 && s.layer !== 2 && Math.abs(level(f) - f.h) < f.tall + 1.2 + s.rad)
  for (let i = 0; i <= n; i++) {
    const az = s.a0 + (s.span * i) / n
    let h = base(az)
    FACES.forEach((f, q) => {
      if (under[q]) return
      const d = L.wrapDeg(az - f.az) * RAD * FACE_R
      const u = fbm(q * 3.1 + s.seed, 0.5, 64, 4, 5, 1)
      const v = fbm(q * 5.7 + s.seed * 1.3, 0.5, 64, 4, 9, 1)
      // Never inside the carved face (an ellipse), and past that a bow of this strand's own width, height and lean,
      // so the strands round a face do not draw one eye.
      const rx = f.rad + 0.9 + s.rad
      const clear = Math.abs(d) < rx ? (f.tall + 0.7 + s.rad) * Math.sqrt(1 - (d / rx) ** 2) : 0
      const ex = rx * (1.05 + 0.7 * u)
      const lean = (v - 0.5) * 1.1 * ex
      const bow = s.layer === 3 || s.layer === 1 ? 0 : Math.abs(d - lean) < ex ? (f.tall + 0.7 + s.rad) * (0.7 + 0.45 * v) * Math.cos(((Math.PI / 2) * (d - lean)) / ex) ** (0.7 + 1.2 * u) : 0
      const need = Math.max(clear, bow)
      if (need <= 0) return
      const dy = (h - f.h) * side[q]
      if (dy < need) h = f.h + side[q] * need
    })
    hs.push(h)
    azs.push(az)
  }
  for (let pass = 0; pass < 2; pass++) {
    const prev = hs.slice()
    for (let i = 0; i <= n; i++) {
      const a = s.open ? prev[Math.max(i - 1, 0)] : prev[(i - 1 + n) % n]
      const b = s.open ? prev[Math.min(i + 1, n)] : prev[(i + 1) % n]
      hs[i] = 0.25 * a + 0.5 * prev[i] + 0.25 * b
    }
    if (!s.open) hs[n] = hs[0]
  }
  const pts = []
  const radii = []
  const sunk = []
  for (let i = 0; i <= n; i++) {
    const az = azs[i]
    const t = i / n
    const end = s.open ? smooth(0, 0.16, t) ** 0.7 * smooth(0, 0.2, 1 - t) ** 0.7 : 1
    const rr = s.rad * (0.56 + 0.62 * fbm(((az + 180) / 360) * 9, 0.3, 9, 4, s.seed + 3, 2) + 0.3 * fbm(((az + 180) / 360) * 60, 0.7, 60, 4, s.seed + 5, 2)) * (s.open ? 0.07 + 0.93 * end : 1)
    const h = clamp(hs[i], rr * 0.85 + 0.15, 36.6 - rr * 0.2)
    const weave = 0.5 + 0.5 * Math.sin(az * RAD * (9 + (s.seed % 5)) + s.seed)
    const low = s.sprawl * smooth(11, 1.5, h) * (0.7 + 0.6 * fbm(((az + 180) / 360) * 9, 0.2, 9, 4, s.seed + 9, 2))
    const off = s.open ? (1 - end) ** 2 * s.reach : 0
    const hug = 0.25 + 0.75 * smooth(1.15, 2.3, faceGap(az, h, 0))
    let sink = 0
    FACES.forEach((f, q) => {
      if (!under[q]) return
      const d = L.wrapDeg(az - f.az) * RAD * FACE_R
      sink = Math.max(sink, smooth(1.22, 0.95, Math.hypot(d / (f.rad + 0.5), (h - f.h) / (f.tall + 0.4))))
    })
    pts.push(place(mix(drumR(h) + rr * 0.55 + (s.lift * weave + off) * hug + low, drumR(h) - rr - 0.3, sink), h, az))
    radii.push(rr)
    sunk.push(sink)
  }
  return { pts, radii, azs, sunk }
}

function thorn(soup, root, dir, len, rad, bend, sides, shade, wide = [0, 1, 0]) {
  const rings = 7
  let d = norm3(dir)
  let u = add3(wide, d, -dot3(wide, d))
  if (Math.hypot(...u) < 0.2) u = add3([0, 1, 0], d, -d[1])
  u = norm3(u)
  const v = cross3(d, u)
  const pts = []
  const prof = []
  let p = add3(root, d, -rad * 0.3)
  const step = (len + rad * 0.3) / (rings - 1)
  let arc = 0
  const arcs = []
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1)
    pts.push(p)
    arcs.push(arc)
    prof.push(Math.max(rad * (1 - t) ** 1.15 * (0.7 + 0.85 * Math.exp(-t * 4.5)), 0.03))
    d = norm3(add3(d, bend, step * 0.075))
    p = add3(p, d, step)
    arc += step
  }
  const A = 1.1
  const B = 0.95
  soup.grid(sides + 1, rings, (i, j) => {
    const a = (i / sides) * 2 * Math.PI
    const t = j / (rings - 1)
    const w = prof[j]
    const off = add3([u[0] * Math.cos(a) * A * w, u[1] * Math.cos(a) * A * w, u[2] * Math.cos(a) * A * w], v, Math.sin(a) * B * w)
    const n = norm3(add3(add3([(u[0] * Math.cos(a)) / A, (u[1] * Math.cos(a)) / A, (u[2] * Math.cos(a)) / A], v, Math.sin(a) / B), dir, 0.22))
    return { p: add3(pts[j], off, 1), n, uv: [arcs[j] / TILE, i / sides], uv2: [arcs[j] / TILE, (i / sides) * 0.5], c: [shade * (0.75 + 0.25 * t), 1, t] }
  })
  return pts
}

export function buildIron() {
  const soup = new Soup('iron')
  const cols = columns(2.5, 7.5)
  const drum = []
  for (let i = 0; i <= 22; i++) {
    const h = 0.03 + (38.3 - 0.03) * (i / 22) ** 0.9
    drum.push([drumR(h), h])
  }
  lathe(soup, drum, cols, (j, az, r, h) => [0.34 + 0.3 * smooth(26, 38, h) - 0.14 * smooth(6, 0, h), 0, 0], 0.5, 11)
  const glass = (h) => L.sphereRadiusAt(h) + 0.12
  const cc = L.CROWN
  const bead = (deg) => [cc[0] - 0.14 + 0.8 * Math.cos(deg * RAD), cc[1] + 0.01 - 0.8 + 0.8 * Math.sin(deg * RAD)]
  lathe(
    soup,
    [[drumR(38.3), 38.3], [46.2, 38.45], bead(-15), bead(35), bead(80), [glass(cc[1] + 0.03) + 0.16, cc[1] + 0.03], [glass(cc[1] + 0.3) + 0.06, cc[1] + 0.3], [glass(cc[1] + 0.28) - 0.1, cc[1] + 0.28], [glass(cc[1] - 0.28), cc[1] - 0.28]],
    columns(2.8125, 5.625),
    () => [0.5, 0, 0],
  )
  const cup = []
  const big = L.SPHERE_R + 0.15
  const beta1 = Math.acos((L.CENTRE_H - (cc[1] - 0.22)) / big)
  for (let i = 0; i <= 7; i++) {
    const beta = beta1 * (1 - i / 7)
    cup.push([Math.max(big * Math.sin(beta), 0.01), L.CENTRE_H - big * Math.cos(beta)])
  }
  lathe(soup, cup, columns(7.5, 7.5), () => [0.03, 0, 0])
  const drumTriangles = soup.triangles

  const rng = mulberry(9241)
  const r = (a, b) => a + (b - a) * rng()
  let thorns = 0
  let refused = 0
  const tips = []
  for (const s of STRANDS) {
    const { pts, radii, azs, sunk } = strandPath(s)
    let from = 0
    while (from < pts.length - 1) {
      const far = L.front(azs[from]) > 125
      let to = from
      while (to < pts.length - 1 && L.front(azs[to]) > 125 === far) to++
      const stride = far ? 3 : s.rad < 0.55 ? 2 : 1
      const pick = []
      for (let i = from; i < to; i += stride) pick.push(i)
      pick.push(to)
      const shade = (j, a, p, nrm) => {
        const i = pick[j]
        const out = norm3([p[0], 0, p[2]])
        const open = 0.5 + 0.5 * dot3(nrm, out)
        const depth = smooth(0, 5, Math.hypot(p[0], p[2]) - drumR(clamp(p[1], 0, 38)))
        return [(0.32 + 0.68 * open) * (0.5 + 0.5 * depth) * (0.75 + 0.25 * smooth(0, 5, p[1])), 0.5, clamp(radii[i] / 2.5, 0, 1)]
      }
      tube(soup, pick.map((i) => pts[i]), pick.map((i) => radii[i]), !far && s.rad < 0.55 ? 4 : far || s.rad < 0.85 ? 5 : s.rad > 1.65 ? 8 : s.rad > 1.25 ? 7 : 6, shade, 1, s.seed * 0.37, far ? 0 : (s.gnarl ?? 0.2), s.seed)
      from = to
    }
    let next = r(4, s.every * 2.2)
    let run = 0
    for (let i = 2; i < pts.length - 2; i++) {
      run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])
      if (run < next) continue
      run = 0
      next = r(s.every * 0.66, s.every * 1.87)
      const az = azs[i]
      if (radii[i] < 0.6 || sunk[i] > 0.02) continue
      const t = norm3([pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1], pts[i + 1][2] - pts[i - 1][2]])
      const sgn = rng() < 0.5 ? -1 : 1
      const up = s.layer === 0 ? r(-0.15, 0.5) : s.layer === 2 ? r(0.1, 1) : r(-0.8, 0.8)
      const dir = norm3(add3(add3([t[0] * sgn * r(0.5, 1.1), t[1] * sgn, t[2] * sgn * r(0.5, 1.1)], radial(az), r(0.35, 0.9)), [0, 1, 0], up))
      const len = r(s.thorn[0], s.thorn[1]) * (L.front(az) > 125 ? 0.9 : 1) * 1.4
      const rad = radii[i] * r(0.7, 0.9) * 1.15
      const probe = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((q) => add3(pts[i], dir, len * q))
      if (probe.some((p) => crossesFace(p)) || probe.some((p) => p[1] < 0.5) || (s.layer !== 2 && probe[6][1] > 37)) {
        refused++
        continue
      }
      if (probe.some((p) => overSheaf(p))) {
        r(0, 1)
        r(0, 1)
        refused++
        continue
      }
      const line = thorn(soup, pts[i], dir, len * 0.92, rad * 1.12, add3([0, r(-1.3, 1.3), 0], t, -sgn * r(0.39, 2.08)), sidesAt(az, 6, 4), 0.85, t)
      tips.push(line[line.length - 1])
      thorns++
    }
  }
  // The sheaf at the left: thin fibres tied in one knot beside the first face. Below the knot they splay out and
  // droop, each with its own curl, and a few run straight across the rest.
  const pick = mulberry(5521)
  const spark = mulberry(5522)
  const f = (a, b) => a + (b - a) * pick()
  let fibres = 0
  for (let i = 0; i < 62; i++) {
    const knot = [-59 + f(-3, 3), 22.7 + f(-0.4, 0.4)]
    const foot = [f(-75, -45), f(10.5, 14.5)]
    const stray = pick() < 0.3
    const splay = stray ? f(0.7, 1.0) : f(1.5, 4)
    const curl = f(0.8, 2.0) * (pick() < 0.5 ? -1 : 1)
    const turns = f(0.4, 1.0)
    const turn = f(0, 6.28)
    const out = pick() < 0.25 || foot[0] > knot[0] + 2 ? [f(1.2, 2.0), f(3.5, 5)] : [f(1.0, 1.6), f(1.3, 3.0)]
    const rad = f(0.1, 0.15)
    const lit = f(0.55, 1)
    const glint = 6.28 * spark()
    const beat = 1.2 + 1.4 * spark()
    const pts = []
    const radii = []
    for (let j = 0; j <= 6; j++) {
      const u = j / 6
      const h = mix(knot[1], foot[1], u)
      const az = knot[0] + (foot[0] - knot[0]) * (1 - Math.pow(1 - u, splay)) + curl * u * Math.sin(2 * Math.PI * turns * u + turn)
      pts.push(place(drumR(h) + mix(out[0], out[1], u) + 0.3 * u * Math.sin(u * 5 + i), h, az))
      radii.push(rad * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(u * 0.8 + 0.2, 1))))
    }
    tube(soup, pts, radii, 3, (j) => [lit * (0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(j * beat + glint), 2)), 0.65, clamp(radii[j] / 2.5, 0, 1)], 1, i * 0.37)
    fibres++
  }
  // Twigs that leave the ring: ends that rise beside the glass at the two shoulders and poke out past the foot at the
  // left, so the outline of the base is a tangle's and not a drum's.
  let twigs = 0
  for (const w of L.TWIGS) {
    const n = 12
    let d = norm3(add3(add3([along(w.az)[0] * w.dir[0], 0, along(w.az)[2] * w.dir[0]], [0, 1, 0], w.dir[1]), radial(w.az), w.dir[2]))
    let p = place(drumR(clamp(w.h, 0, 38)) + 1.2, w.h, w.az)
    const pts = []
    const radii = []
    const curl = norm3(add3(add3([along(w.az)[0] * w.curl[0], 0, along(w.az)[2] * w.curl[0]], [0, 1, 0], w.curl[1]), radial(w.az), w.curl[2]))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const clear = p[1] > 38.6 ? L.sphereRadiusAt(Math.min(p[1], L.CENTRE_H)) + w.rad + 1.0 : 0
      const far = Math.hypot(p[0], p[2])
      if (far < clear) p = [(p[0] / far) * clear, p[1], (p[2] / far) * clear]
      pts.push([p[0], Math.max(p[1], w.rad * 0.6 + 0.2), p[2]])
      radii.push(w.rad * (1 - 0.93 * t ** 1.3) * (0.85 + 0.3 * fbm(t * 5 + w.az, 0.3, 64, 4, 23, 2)))
      const wob = (fbm(t * 4 + w.az * 0.7, 0.6, 64, 4, 29, 2) - 0.5) * 0.9
      d = norm3(add3(add3(d, curl, 0.16), along(w.az), wob * 0.25))
      p = add3(p, d, w.len / n)
    }
    const shade = (j, a, q, nrm) => [0.55 + 0.45 * (0.5 + 0.5 * dot3(nrm, norm3([q[0], 0, q[2]]))), 0.5, clamp(radii[j] / 2.5, 0, 1)]
    tube(soup, pts, radii, 6, shade, 1, w.az * 0.13, 0.2, Math.round(w.az + 400))
    for (const at of w.thorns ?? []) {
      const i = Math.round(at * n)
      const t = norm3([pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1], pts[i + 1][2] - pts[i - 1][2]])
      const sgn = at * 10 % 2 < 1 ? 1 : -1
      const dir = norm3(add3(add3(t, radial(w.az), 0.5), cross3(t, [0, 0, 1]), 0.9 * sgn))
      thorn(soup, pts[i], dir, 3.2 + 2.2 * at, radii[i] * 0.85, [0, 0.4, 0], 6, 0.9, cross3(dir, [0, 0, 1]))
      thorns++
    }
    twigs++
  }
  const heroTips = []
  for (const t of L.HERO_THORNS) {
    const root = place(drumR(clamp(t.h, 0, 38)) + 2.2, t.h, t.az)
    const dir = norm3(add3(add3([along(t.az)[0] * t.dir[0], 0, along(t.az)[2] * t.dir[0]], [0, 1, 0], t.dir[1]), radial(t.az), t.dir[2]))
    const probe = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((q) => add3(root, dir, t.len * q))
    if (probe.some((p) => crossesFace(p))) {
      refused++
      heroTips.push(null)
      continue
    }
    // The counted thorns are blades seen broadside from the front.
    const line = thorn(soup, root, dir, t.len * 1.08, t.rad * 0.8, add3([0, t.dir[1] > 0.3 ? 0.9 : -0.3, 0], along(t.az), t.dir[0] > 0 ? -0.7 : 0.7), 10, 0.95, cross3(dir, [0, 0, 1]))
    heroTips.push(line[line.length - 1])
    thorns++
  }
  // Long thorns that stand up over the lip in front of the glass, each leaning out far enough to clear it.
  for (const t of L.LIP_THORNS) {
    const root = place(drumR(clamp(t.h, 0, 38)) + 2.0, t.h, t.az)
    let dir = null
    for (let k = 0; k < 10 && !dir; k++) {
      const d = norm3(add3(add3([along(t.az)[0] * t.dir[0], 0, along(t.az)[2] * t.dir[0]], [0, 1, 0], t.dir[1]), radial(t.az), t.dir[2] + 0.1 * k))
      const clear = [0.2, 0.4, 0.6, 0.8, 1].every((q) => {
        const p = add3(root, d, t.len * q)
        return p[1] < 38.6 || Math.hypot(p[0], p[2]) > L.sphereRadiusAt(Math.min(p[1], L.CENTRE_H)) + t.rad + 0.6
      })
      if (clear) dir = d
    }
    if (!dir) {
      refused++
      continue
    }
    thorn(soup, root, dir, t.len, t.rad, add3([0, 0.3, 0], radial(t.az), 0.5), 8, 0.95, cross3(dir, [0, 0, 1]))
    thorns++
  }
  return { soup, drumTriangles, thorns, refused, strands: STRANDS.length, heroTips, twigs, fibres }
}

// The pumpkins: a ribbed gourd set into the ring behind each face, its front toward the viewer of that side.
export function buildPumpkins() {
  const soup = new Soup('pumpkin')
  FACES.forEach((f, index) => {
    const a = f.rad + 0.5
    const b = f.tall + 0.4
    const c = 5.0
    const centre = place(drumR(f.h) - 2.3, f.h, f.az)
    const out = radial(f.az)
    const tan = along(f.az)
    const near = L.front(f.az) <= 125
    // No two faces sit alike: each is turned a little its own way and its gourd has its own ribs.
    const turn = [-9, 4, 11, -6, 8, -12, 5][index % 7] * RAD
    const tc = Math.cos(turn)
    const ts = Math.sin(turn)
    const ribs = [4.5, 5.5, 4, 5, 4.5, 6, 5][index % 7]
    const colsN = near ? 44 : 20
    const rowsN = near ? 30 : 14
    soup.grid(colsN, rowsN, (i, j) => {
      const lon = mix(-104, 104, i / (colsN - 1)) * RAD
      const lat = mix(-86, 86, j / (rowsN - 1)) * RAD
      const groove = Math.abs(Math.sin(lon * ribs + 0.9 * index)) ** 6
      const squash = 1 - 0.15 * groove * Math.cos(lat) ** 0.5 + 0.02 * fbm(lon * 2 + 9, lat * 2 + 5, 64, 64, 77 + index, 2)
      const dimple = 1 - 0.12 * smooth(62 * RAD, 86 * RAD, Math.abs(lat))
      const x = a * Math.cos(lat) * Math.sin(lon) * squash
      const y = b * Math.sin(lat) * dimple
      const z = c * Math.cos(lat) * Math.cos(lon) * squash
      const p = add3(add3(add3(centre, tan, x), [0, 1, 0], y), out, z)
      const n = norm3(add3(add3([tan[0] * (x / (a * a)), 0, tan[2] * (x / (a * a))], [0, 1, 0], y / (b * b)), out, z / (c * c)))
      const span = 1.06 * Math.max(f.rad, f.tall)
      return {
        p,
        n,
        uv: [(x * tc - y * ts) / (2 * span) + 0.5, (x * ts + y * tc) / (2 * span) + 0.5],
        uv2: [(x * tc - y * ts) / (2 * span) + 0.5, (x * ts + y * tc) / (2 * span) + 0.5],
        c: [0.55 + 0.45 * smooth(0.2, 0.9, Math.cos(lat) * Math.cos(lon)) - 0.5 * groove, (index + 0.5) / 8, (f.cell + 0.5) / 4],
      }
    })
  })
  return { soup }
}

// How far out the weave reaches at a place on the ring, or null where no strand passes.
let WEAVE = null
function weaveOut(az, h, halfDeg) {
  if (!WEAVE) {
    WEAVE = []
    for (const s of STRANDS) {
      const { pts, radii } = strandPath(s)
      pts.forEach((p, i) => WEAVE.push([azOf(p), p[1], Math.hypot(p[0], p[2]), radii[i]]))
    }
  }
  let best = null
  for (const q of WEAVE) {
    const dh = Math.abs(q[1] - h)
    if (dh >= q[3] || Math.abs(L.wrapDeg(q[0] - az)) > halfDeg) continue
    const out = q[2] + Math.sqrt(q[3] * q[3] - dh * dh)
    if (best === null || out > best) best = out
  }
  return best
}

// The wax: a lumpy ring where the glass meets the iron, the runs that hang from it, and the runs that reached the slab.
export function buildWax() {
  const soup = new Soup('wax')
  const cols = columns(1.8, 6)
  const drips = L.DRIPS.map((d) => {
    const top = L.onCylinder(d.x, 1085, 48.5)
    const end = L.onCylinder(d.x, d.y1, 51.5)
    return { az: top.az, h1: end.h, w: (d.w / 9.3) * 0.72, wide: d.wide }
  })
  for (let az = 100; az < 260; az += 23 + 9 * Math.sin(az)) drips.push({ az: L.wrapDeg(az), h1: 35.5 - 9 * Math.abs(Math.sin(az * 1.7)), w: 0.85, wide: 1.4 })
  const heavy = (az) => {
    let v = 0
    for (const d of drips) {
      const x = (L.wrapDeg(az - d.az) * RAD * 48) / (d.w * d.wide * 1.25)
      v = Math.max(v, Math.exp(-x * x))
    }
    return v
  }
  const prof = (az) => {
    const m = heavy(az)
    const n = fbm(((az + 180) / 360) * 10, 0.3, 10, 4, 61, 2)
    const side = 1.1 * smooth(48, 82, L.front(az)) * smooth(140, 100, L.front(az))
    const thick = -0.8 + 0.9 * n * n + 1.35 * m + 0.3 * side
    const drop = 0.3 + 1.0 * n * n * n + 3.3 * m + 0.7 * side
    return { thick, drop }
  }
  const rows = 12
  soup.grid(cols.length, rows, (i, j) => {
    const az = cols[i]
    const { thick, drop } = prof(az)
    const t = j / (rows - 1)
    const top = [L.sphereRadiusAt(39.62) + 0.1, 39.62]
    const h = top[1] - (drop + 0.9) * t * smooth(-0.45, 0.05, thick)
    const bulge = Math.sin(Math.PI * Math.min(t * 1.08, 1)) ** 0.6
    // The wax lies over the bead of the collar, never through it.
    const beadDy = h - (L.CROWN[1] - 0.79)
    const beadR = Math.abs(beadDy) < 0.8 ? L.CROWN[0] - 0.14 + Math.sqrt(0.64 - beadDy * beadDy) + 0.14 : 0
    const inner = h > 38.75 ? Math.max(L.sphereRadiusAt(h) + 0.3, beadR) : Math.max(drumR(Math.min(h, 38.3)), 45.1 + 0.9 * smooth(38.75, 38.3, h), beadR)
    const rr = inner + Math.max(thick, 0) * 0.6 * bulge + mix(mix(0.02, -1.6, smooth(0.08, 0.3, t)), 0.02, smooth(-0.3, 0.04, thick))
    const nr = norm3([Math.sin(Math.PI * (0.25 + 0.5 * t)) + 0.2, Math.cos(Math.PI * (0.1 + 0.9 * t)) * 0.9, 0])
    const s = Math.sin(az * RAD)
    const c = Math.cos(az * RAD)
    return { p: place(rr, h, az), n: norm3([nr[0] * s, nr[1], nr[0] * c]), uv: [az / 20, t], uv2: [az / 20, t], c: [0.55 + 0.45 * bulge, clamp(thick * bulge * 0.45, 0, 1), 0] }
  })
  let count = 0
  for (const d of drips) {
    const h0 = 38.2
    const n = Math.max(6, Math.ceil((h0 - d.h1) / 0.7))
    const pts = []
    const radii = []
    // A run lies on what is under it: on the vines where one passes, on the leather between them.
    const outs = []
    for (let i = 0; i <= n; i++) {
      const h = mix(h0, d.h1, i / n)
      outs.push(weaveOut(d.az, h, 3.2))
    }
    let held = outs.find((o) => o !== null) ?? drumR(30) + 2.4
    for (let i = 0; i <= n; i++) {
      if (outs[i] === null) outs[i] = held - 0.2
      held = outs[i]
    }
    for (let pass = 0; pass < 7; pass++) {
      const prev = outs.slice()
      for (let i = 0; i <= n; i++) outs[i] = Math.max(0.25 * prev[Math.max(i - 1, 0)] + 0.5 * prev[i] + 0.25 * prev[Math.min(i + 1, n)], prev[i] - 0.3)
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const h = mix(h0, d.h1, t)
      const sway = (fbm(t * 3 + d.az, 0.4, 64, 4, 17, 2) - 0.5) * (d.h1 < 26 ? 1.6 : 0.9) * t
      const neck = mix(Math.min(d.wide, 2.3), 0.5, smooth(0, 0.42, t) ** 0.6)
      const bulb = 1 + 0.45 * Math.exp(-(((t - 0.88) / 0.09) ** 2))
      const cap = Math.sqrt(Math.max(1 - Math.max((t - 0.93) / 0.07, 0) ** 2, 0.0004))
      const rad = 0.72 * d.w * neck * bulb * cap * (0.84 + 0.34 * fbm(t * 2.2 + d.az * 1.7, 0.2, 64, 4, 47, 1))
      pts.push(place(mix(drumR(clamp(h, 0, 38.3)) + 1.2, outs[i] + rad * 0.55, smooth(0, 0.18, t)), h, d.az + sway))
      radii.push(rad)
    }
    tube(soup, pts, radii, L.front(d.az) <= 125 ? 12 : 4, (j, a, p, nrm) => [0.6 + 0.4 * (0.5 + 0.5 * dot3(nrm, norm3([p[0], 0, p[2]]))), clamp(radii[j] * 0.55, 0, 1), j / n], 0.72)
    count++
  }
  for (const run of L.RUNS) {
    const start = L.onCylinder(run.x, run.y0, 55)
    const w = (run.w / 9.3) * 0.78
    weaveOut(start.az, 5, 2)
    // A run at the foot fell on the outermost vine that passes above it, and lies over it and down to the slab.
    let over = null
    for (const q of WEAVE) if (Math.abs(L.wrapDeg(q[0] - start.az)) < 1.6 && q[1] > 7.5 && q[1] < 17 && (over === null || q[2] + q[3] > over[2] + over[3])) over = q
    const top = over && over[2] > drumR(over[1]) ? over[1] + over[3] * 0.8 : Math.min(start.h, 12)
    const n = Math.max(6, Math.ceil(top / 0.7))
    const outs = []
    for (let i = 0; i <= n; i++) outs.push(weaveOut(start.az, mix(top, run.pool > 0 ? 0.5 : 2.2, i / n), 2.0))
    let last = outs.find((o) => o !== null) ?? 59.4
    for (let i = 0; i <= n; i++) {
      if (outs[i] === null) outs[i] = last - 0.25
      last = outs[i]
    }
    for (let pass = 0; pass < 3; pass++) {
      const prev = outs.slice()
      for (let i = 0; i <= n; i++) outs[i] = Math.max(0.25 * prev[Math.max(i - 1, 0)] + 0.5 * prev[i] + 0.25 * prev[Math.min(i + 1, n)], prev[i] - 0.35)
    }
    const foot = outs[n] - 0.6
    const pts = []
    const radii = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const h = mix(top, run.pool > 0 ? 0.5 : 2.2, t)
      const sway = Math.sin(run.x) * 0.35
      const cap = Math.sqrt(Math.max(1 - Math.max((0.1 - t) / 0.1, 0) ** 2, 0.0004))
      const tail = run.pool > 0 ? 1 + 0.9 * smooth(0.72, 1, t) ** 2 : Math.sqrt(Math.max(1 - Math.max((t - 0.9) / 0.1, 0) ** 2, 0.0004)) * (1 + 0.4 * Math.exp(-(((t - 0.86) / 0.1) ** 2)))
      const rad = w * (run.pool > 0 ? 0.58 + 0.26 * Math.exp(-((t / 0.14) ** 2)) + 0.04 * Math.sin(t * 5 + run.x) : 0.3 + 0.8 * smooth(0, 0.55, t) + 0.1 * Math.sin(t * 9 + run.x)) * cap * tail
      pts.push(place(outs[i] + rad * 0.3, h, start.az + sway * 0.9 * Math.sin(2 * Math.PI * t) * (1 - t) + 0.9 * (fbm(t * 2.5 + run.x, 0.4, 64, 4, 23, 2) - 0.5) * (1 - t)))
      radii.push(rad)
    }
    tube(soup, pts, radii, 8, (j, a, p, nrm) => [(0.55 + 0.45 * (0.5 + 0.5 * dot3(nrm, norm3([p[0], 0, p[2]])))) * (0.5 + 0.5 * smooth(0, 16, p[1])), clamp(radii[j] * 0.55, 0, 1), j / n], 0.85)
    count++
    if (run.pool <= 0) continue
    const centre = place(foot + run.pool * 0.12, 0, start.az + (run.x < 1400 ? -1 : 1))
    const seg = 20
    const rings = 7
    soup.grid(seg + 1, rings, (i, j) => {
      const a = (i / seg) * 2 * Math.PI
      const q = j / (rings - 1)
      const lobes = run.pool * 1.45 * (0.5 + 0.8 * fbm((i % seg) / seg * 5, 0.5, 5, 4, Math.round(run.x), 3)) * (1 + 0.45 * Math.cos(a - 1.2))
      const rho = Math.sin((q * Math.PI) / 2)
      const y = 0.06 + 1.6 * Math.cos((q * Math.PI) / 2) ** 0.55 * (0.6 + 0.4 * rho)
      const dirx = Math.cos(a)
      const dirz = Math.sin(a) * 0.62
      const p = [centre[0] + dirx * lobes * rho, q >= 1 ? 0.04 : y * (1 - q ** 5), centre[2] + dirz * lobes * rho]
      const n = norm3([dirx * rho ** 3, 1 - 0.75 * rho ** 3, dirz * rho ** 3])
      return { p, n, uv: [i / seg, q], uv2: [i / seg, q], c: [0.5 + 0.2 * (1 - rho), clamp(0.9 * (1 - rho ** 4), 0, 1), 1] }
    })
  }
  return { soup, drips: count }
}

// The cobweb: a fan strung from the thorns at the top right of the ring down to the slab, a small one under the long
// spike, and one between the thorns of the crown. The first coordinate runs across a fan, the second from its hub out.
export function buildWeb(heroTips) {
  const soup = new Soup('web')
  const at = (x, y, r) => L.onCylinder(x, y, r).p
  const spike = heroTips[10] ?? at(2020, 1345, 66)
  // The big fan hangs from the crown ring where the ring is the base's right outline.
  const hub = place(drumR(33.6) + 3.4, 33.6, 80)
  const fans = [
    { hub, a: L.onSlab(1992, 1401), b: L.onSlab(2120, 1430), sag: 7.5, n: 18 },
    { hub: spike, a: L.onSlab(2000, 1412), b: L.onSlab(2090, 1428), sag: 1.0, n: 8 },
    { hub: at(1838, 1060, 50), a: at(1872, 1118, 53), b: at(1915, 1082, 58), sag: 1.0, n: 12 },
  ]
  fans.forEach((s, k) => {
    const n = s.n
    soup.grid(n, n, (i, j) => {
      const u = i / (n - 1)
      const v = j / (n - 1)
      const edge = [mix(s.a[0], s.b[0], u), mix(s.a[1], s.b[1], u), mix(s.a[2], s.b[2], u)]
      const p = [mix(s.hub[0], edge[0], v), mix(s.hub[1], edge[1], v), mix(s.hub[2], edge[2], v)]
      const sag = s.sag * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) ** 0.8
      p[1] = Math.max(p[1] - sag, 0.12)
      const out = norm3([p[0], 0, p[2]])
      return { p: add3(p, out, -0.5 * sag), n: out, uv: [u, v], uv2: [u, v], c: [1, (k + 0.5) / 4, 0] }
    })
  })
  return { soup }
}
