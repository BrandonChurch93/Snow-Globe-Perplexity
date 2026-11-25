import { projectWorld } from '../../tools/lib/refcam.mjs'
import * as L from './layout.mjs'
import { Soup, add3, clamp, cross3, dot3, fbm, mix, mulberry, norm3, smooth } from './lib.mjs'

const { RAD, place, drumR, FACES, FACE_R } = L
const TILE = 16
const radial = (az) => [Math.sin(az * RAD), 0, Math.cos(az * RAD)]
const along = (az) => [Math.cos(az * RAD), 0, -Math.sin(az * RAD)]
const azOf = (p) => Math.atan2(p[0], p[2]) / RAD
const sidesAt = (az, near, far) => (L.front(az) <= 125 ? near : far)

// A tube along a path. `radii` per point; `flat` squeezes it toward the ring. Paint: shade, kind, how far along a thorn.
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
    const a = (i / sides) * 2 * Math.PI
    const f = frames[j]
    const d = add3([f.n[0] * Math.cos(a) * flat, f.n[1] * Math.cos(a) * flat, f.n[2] * Math.cos(a) * flat], f.b, Math.sin(a))
    let nrm = norm3(add3([f.n[0] * Math.cos(a), f.n[1] * Math.cos(a), f.n[2] * Math.cos(a)], f.b, Math.sin(a) * flat))
    let lump = 1
    if (gnarl) {
      const turn = 2 * a + arc[j] * 0.22 + seed
      const ridge = 0.85 * gnarl
      lump = 1 + gnarl * 2 * (fbm(arc[j] * 0.3 + seed, ((i % sides) / sides) * 4, 4096, 4, seed, 2) - 0.5) + ridge * Math.cos(turn)
      const round = add3([-f.n[0] * Math.sin(a), -f.n[1] * Math.sin(a), -f.n[2] * Math.sin(a)], f.b, Math.cos(a))
      nrm = norm3(add3(nrm, round, 2 * ridge * Math.sin(turn)))
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
  const push = (s) => STRANDS.push({ seed: STRANDS.length * 31 + 7, slope: 0, reach: 0, ...s })
  for (let i = 0; i < 2; i++) push({ a0: -180, span: 360, h0: 2.3 + i * 2.7, amp: 1.1 + 0.5 * i, k: 3 + i, ph: r(0, 6.28), rad: r(1.15, 1.5), lift: 1.6, sprawl: 3.2 - i * 1.4, thorn: [7, 12], every: 46, layer: 0 })
  for (let i = 0; i < 2; i++) push({ a0: -180, span: 360, h0: 30.8 + i * 3.4, amp: 1.2, k: 4 + i, ph: r(0, 6.28), rad: r(1.25, 1.6), lift: 1.5, sprawl: 0, thorn: [6, 10], every: 60, layer: 2 })
  for (let i = 0; i < 2; i++) push({ a0: -180, span: 360, h0: 11.5 + i * 15, amp: r(2.4, 3.4), k: 3 + i, ph: r(0, 6.28), rad: r(1.0, 1.3), lift: 1.8, sprawl: 0, thorn: [6, 10], every: 52, layer: 1 })
  // The branches: long tapering lengths that cross the ring on a slant, each ending in a point that stands off it.
  const count = 25
  for (let i = 0; i < count; i++) {
    const steep = i % 3 === 2
    const span = steep ? r(26, 42) : r(62, 150)
    const a0 = -180 + (i * 360) / count + r(-9, 9) + (i * 137.5) % 360
    const slope = (rng() < 0.5 ? -1 : 1) * (steep ? r(20, 30) : r(11, 25))
    push({ a0, span, h0: steep ? r(14, 24) : r(5, 33), slope, amp: steep ? r(0.6, 1.4) : r(1.6, 3.6), k: r(1.6, 3.0), ph: r(0, 6.28), rad: steep ? r(1.1, 1.5) : r(1.2, 2.05), lift: r(2.6, 4.6), sprawl: 0.8, thorn: [6, 11], every: 46, layer: 3, open: true, reach: r(3.5, 8.5) })
  }
  // The wires: thin lengths that fill the weave between the branches.
  for (let i = 0; i < 18; i++) {
    const a0 = -180 + i * 20 + r(-8, 8)
    push({ a0, span: r(50, 110), h0: r(6, 32), slope: (rng() < 0.5 ? -1 : 1) * r(5, 22), amp: r(1.2, 3.2), k: r(2, 4), ph: r(0, 6.28), rad: r(0.5, 0.8), lift: r(1.2, 5.2), sprawl: 0.5, thorn: [3.5, 6.5], every: 40, layer: 3, open: true, reach: r(2, 6) })
  }
}
addStrands()

function strandPath(s) {
  const n = Math.ceil((s.span * RAD * 54) / 1.25)
  const hs = []
  const azs = []
  const base = (az) => s.h0 + s.slope * ((az - s.a0) / s.span - 0.5) + s.amp * Math.sin(s.k * az * RAD + s.ph) + (fbm(((az + 180) / 360) * 14, 0.37, 14, 4, s.seed, 3) - 0.5) * s.amp * 1.2
  const side = FACES.map((f) => (base(f.az) >= f.h ? 1 : -1))
  for (let i = 0; i <= n; i++) {
    const az = s.a0 + (s.span * i) / n
    let h = base(az)
    FACES.forEach((f, q) => {
      const d = L.wrapDeg(az - f.az) * RAD * FACE_R
      const ex = (f.rad + 1.2 + s.rad) * (1.3 + 0.5 * fbm(q * 3.1 + s.seed, 0.5, 64, 4, 5, 1))
      if (Math.abs(d) >= ex) return
      const need = (f.tall * 0.93 + s.rad) * 1.07 * Math.cos(((Math.PI / 2) * d) / ex)
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
  for (let i = 0; i <= n; i++) {
    const az = azs[i]
    const t = i / n
    const end = s.open ? smooth(0, 0.3, t) ** 0.7 * smooth(0, 0.34, 1 - t) ** 0.7 : 1
    const rr = s.rad * (0.82 + 0.4 * fbm(((az + 180) / 360) * 60, 0.7, 60, 4, s.seed + 5, 2)) * (s.open ? 0.07 + 0.93 * end : 1)
    const h = clamp(hs[i], rr * 0.85 + 0.15, 36.6 - rr * 0.2)
    const weave = 0.5 + 0.5 * Math.sin(az * RAD * (9 + (s.seed % 5)) + s.seed)
    const low = s.sprawl * smooth(11, 1.5, h) * (0.7 + 0.6 * fbm(((az + 180) / 360) * 9, 0.2, 9, 4, s.seed + 9, 2))
    const off = s.open ? (1 - end) ** 2 * s.reach : 0
    const hug = 0.25 + 0.75 * smooth(1.15, 2.3, faceGap(az, h, 0))
    pts.push(place(drumR(h) + rr * 0.55 + (s.lift * weave + off) * hug + low, h, az))
    radii.push(rr)
  }
  return { pts, radii, azs }
}

function thorn(soup, root, dir, len, rad, bend, sides, shade) {
  const pts = []
  const radii = []
  const rings = 8
  let d = norm3(dir)
  let p = add3(root, d, -rad * 0.2)
  const step = (len + rad * 0.2) / (rings - 1)
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1)
    pts.push(p)
    radii.push(Math.max(rad * (1 - t) ** 0.9 * (1 + 0.4 * (1 - t) ** 5), 0.03))
    d = norm3(add3(d, bend, step * 0.05))
    p = add3(p, d, step)
  }
  tube(soup, pts, radii, sides, (j) => [shade * (0.75 + 0.25 * (j / (rings - 1))), 1, j / (rings - 1)], 1)
  return pts
}

export function buildIron() {
  const soup = new Soup('iron')
  const cols = columns(1.5, 6)
  const drum = []
  for (let i = 0; i <= 30; i++) {
    const h = 0.03 + (38.3 - 0.03) * (i / 30) ** 0.9
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
    const { pts, radii, azs } = strandPath(s)
    let from = 0
    while (from < pts.length - 1) {
      const far = L.front(azs[from]) > 125
      let to = from
      while (to < pts.length - 1 && L.front(azs[to]) > 125 === far) to++
      const stride = far ? 3 : 1
      const pick = []
      for (let i = from; i < to; i += stride) pick.push(i)
      pick.push(to)
      const shade = (j, a, p, nrm) => {
        const i = pick[j]
        const out = norm3([p[0], 0, p[2]])
        const open = 0.5 + 0.5 * dot3(nrm, out)
        const depth = smooth(0, 5, Math.hypot(p[0], p[2]) - drumR(clamp(p[1], 0, 38)))
        return [(0.32 + 0.68 * open) * (0.5 + 0.5 * depth) * (0.75 + 0.25 * smooth(0, 5, p[1])), 0.5, fbm(i * 0.09, a, 64, 8, s.seed + 3, 2)]
      }
      tube(soup, pick.map((i) => pts[i]), pick.map((i) => radii[i]), far || s.rad < 0.85 ? 5 : s.rad > 1.2 ? 9 : 7, shade, 1, s.seed * 0.37, far ? 0 : 0.13, s.seed)
      from = to
    }
    let next = r(4, s.every)
    let run = 0
    for (let i = 2; i < pts.length - 2; i++) {
      run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])
      if (run < next) continue
      run = 0
      next = r(s.every * 0.45, s.every * 1.25)
      const az = azs[i]
      if (radii[i] < 0.6) continue
      const t = norm3([pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1], pts[i + 1][2] - pts[i - 1][2]])
      const sgn = rng() < 0.5 ? -1 : 1
      const up = s.layer === 0 ? r(-0.15, 0.5) : s.layer === 2 ? r(0.1, 1) : r(-0.8, 0.8)
      const dir = norm3(add3(add3([t[0] * sgn * r(0.5, 1.1), t[1] * sgn, t[2] * sgn * r(0.5, 1.1)], radial(az), r(0.35, 0.9)), [0, 1, 0], up))
      const len = r(s.thorn[0], s.thorn[1]) * (L.front(az) > 125 ? 0.9 : 1)
      const rad = radii[i] * r(0.7, 0.9)
      const probe = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((q) => add3(pts[i], dir, len * q))
      if (probe.some((p) => crossesFace(p)) || probe.some((p) => p[1] < 0.5) || (s.layer !== 2 && probe[6][1] > 37)) {
        refused++
        continue
      }
      const line = thorn(soup, pts[i], dir, len, rad, add3([0, r(-1, 1), 0], t, -sgn * r(0, 1.2)), sidesAt(az, 7, 4), 0.85)
      tips.push(line[line.length - 1])
      thorns++
    }
  }
  const heroTips = []
  for (const t of L.HERO_THORNS) {
    const root = place(drumR(clamp(t.h, 0, 38)) + 2.2, t.h, t.az)
    const dir = norm3(add3(add3([along(t.az)[0] * t.dir[0], 0, along(t.az)[2] * t.dir[0]], [0, 1, 0], t.dir[1]), radial(t.az), t.dir[2]))
    const probe = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((q) => add3(root, dir, t.len * q))
    if (probe.some((p) => crossesFace(p))) {
      refused++
      continue
    }
    const line = thorn(soup, root, dir, t.len, t.rad, [0, t.dir[1] > 0.3 ? 0.9 : -0.3, 0], 8, 0.95)
    heroTips.push(line[line.length - 1])
    thorns++
  }
  return { soup, drumTriangles, thorns, refused, strands: STRANDS.length, heroTips }
}

// The pumpkins: a ribbed gourd set into the ring behind each face, its front toward the viewer of that side.
export function buildPumpkins() {
  const soup = new Soup('pumpkin')
  FACES.forEach((f, index) => {
    const a = f.rad + 0.5
    const b = f.tall + 0.4
    const c = 5.0
    const centre = place(drumR(f.h) - 1.6, f.h, f.az)
    const out = radial(f.az)
    const tan = along(f.az)
    const near = L.front(f.az) <= 125
    const colsN = near ? 56 : 28
    const rowsN = near ? 40 : 20
    soup.grid(colsN, rowsN, (i, j) => {
      const lon = mix(-104, 104, i / (colsN - 1)) * RAD
      const lat = mix(-86, 86, j / (rowsN - 1)) * RAD
      const groove = Math.abs(Math.sin(lon * 4.5 + 0.3 * index)) ** 6
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
        uv: [x / (2 * span) + 0.5, y / (2 * span) + 0.5],
        uv2: [x / (2 * span) + 0.5, y / (2 * span) + 0.5],
        c: [0.55 + 0.45 * smooth(0.2, 0.9, Math.cos(lat) * Math.cos(lon)) - 0.5 * groove, (index + 0.5) / 8, (f.cell + 0.5) / 4],
      }
    })
    const stem = []
    const stemR = []
    for (let i = 0; i < 5; i++) {
      stem.push(add3(add3(centre, [0, 1, 0], b * 0.86 + i * 0.75), out, 1.2 + i * 0.5))
      stemR.push(1.1 - i * 0.16)
    }
    tube(soup, stem, stemR, 6, () => [0.5, (index + 0.5) / 8, 0.99], 1)
  })
  return { soup }
}

// The wax: a lumpy ring where the glass meets the iron, the runs that hang from it, and the runs that reached the slab.
export function buildWax() {
  const soup = new Soup('wax')
  const cols = columns(1.2, 5)
  const drips = L.DRIPS.map((d) => {
    const top = L.onCylinder(d.x, 1085, 48.5)
    const end = L.onCylinder(d.x, d.y1, 51.5)
    return { az: top.az, h1: end.h, w: (d.w / 9.3) * 0.62, wide: d.wide }
  })
  for (let az = 100; az < 260; az += 23 + 9 * Math.sin(az)) drips.push({ az: L.wrapDeg(az), h1: 35.5 - 9 * Math.abs(Math.sin(az * 1.7)), w: 0.85, wide: 1.4 })
  const heavy = (az) => {
    let v = 0
    for (const d of drips) {
      const x = (L.wrapDeg(az - d.az) * RAD * 48) / (d.w * d.wide * 1.6)
      v = Math.max(v, Math.exp(-x * x))
    }
    return v
  }
  const prof = (az) => {
    const m = heavy(az)
    const n = fbm(((az + 180) / 360) * 26, 0.3, 26, 4, 61, 3)
    const side = 1.1 * smooth(48, 82, L.front(az)) * smooth(140, 100, L.front(az))
    const thick = 0.45 + 1.5 * n * n + 1.6 * m + side
    const drop = 0.7 + 2.2 * n * n * n + 2.8 * m + 1.4 * side
    return { thick, drop }
  }
  const rows = 12
  soup.grid(cols.length, rows, (i, j) => {
    const az = cols[i]
    const { thick, drop } = prof(az)
    const t = j / (rows - 1)
    const top = [L.sphereRadiusAt(39.45) + 0.1, 39.45]
    const h = top[1] - (drop + 0.9) * t
    const bulge = Math.sin(Math.PI * Math.min(t * 1.08, 1)) ** 0.6
    const inner = h > 38.75 ? L.sphereRadiusAt(h) + 0.1 : Math.max(drumR(Math.min(h, 38.3)), 45.1 + 0.9 * smooth(38.75, 38.3, h))
    const rr = inner + thick * bulge + 0.02
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
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const h = mix(h0, d.h1, t)
      const sway = (fbm(t * 3 + d.az, 0.4, 64, 4, 17, 2) - 0.5) * 1.4 * t
      const ride = 1.4 + (d.h1 < 26 ? 1.6 : 3.6) * smooth(0, 0.3, t) * (0.75 + 0.25 * Math.sin(t * 5 + d.az))
      pts.push(place(drumR(clamp(h, 0, 38.3)) + ride, h, d.az + sway))
      const neck = mix(d.wide * 1.25, 0.82, smooth(0, 0.3, t))
      const bulb = 1 + 0.5 * Math.exp(-(((t - 0.9) / 0.09) ** 2))
      const cap = Math.sqrt(Math.max(1 - Math.max((t - 0.93) / 0.07, 0) ** 2, 0.0004))
      radii.push(d.w * neck * bulb * cap)
    }
    tube(soup, pts, radii, L.front(d.az) <= 125 ? 10 : 6, (j, a, p, nrm) => [0.6 + 0.4 * (0.5 + 0.5 * dot3(nrm, norm3([p[0], 0, p[2]]))), clamp(radii[j] * 0.55, 0, 1), j / n], 0.72)
    count++
  }
  for (const run of L.RUNS) {
    const start = L.onCylinder(run.x, run.y0, 55)
    const w = (run.w / 9.3) * 0.5
    const foot = 59.6 + (run.pool > 0 ? 1.2 : 0.4)
    const top = Math.min(start.h, 9.5)
    const n = Math.max(6, Math.ceil(top / 0.7))
    const pts = []
    const radii = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const h = mix(top, run.pool > 0 ? 0.5 : 2.2, t)
      const sway = Math.sin(run.x) * 0.35
      pts.push(place(mix(59.4, foot + 0.4, t * t), h, start.az + sway * Math.sin(2 * Math.PI * t) * (1 - t)))
      const cap = Math.sqrt(Math.max(1 - Math.max((0.1 - t) / 0.1, 0) ** 2, 0.0004))
      const tail = run.pool > 0 ? 1 + 0.35 * smooth(0.8, 1, t) : Math.sqrt(Math.max(1 - Math.max((t - 0.9) / 0.1, 0) ** 2, 0.0004)) * (1 + 0.4 * Math.exp(-(((t - 0.86) / 0.1) ** 2)))
      radii.push(w * (0.75 + 0.55 * t * t + 0.14 * Math.sin(t * 9 + run.x)) * cap * tail)
    }
    tube(soup, pts, radii, 10, (j, a, p, nrm) => [(0.55 + 0.45 * (0.5 + 0.5 * dot3(nrm, norm3([p[0], 0, p[2]])))) * (0.5 + 0.5 * smooth(0, 16, p[1])), clamp(radii[j] * 0.55, 0, 1), j / n], 0.85)
    count++
    if (run.pool <= 0) continue
    const centre = place(foot + run.pool * 0.3, 0, start.az + (run.x < 1400 ? -1 : 1))
    const seg = 28
    const rings = 7
    soup.grid(seg + 1, rings, (i, j) => {
      const a = (i / seg) * 2 * Math.PI
      const q = j / (rings - 1)
      const lobes = run.pool * (0.42 + 0.95 * fbm((i % seg) / seg * 5, 0.5, 5, 4, Math.round(run.x), 3)) * (1 + 0.45 * Math.cos(a - 1.2))
      const rho = Math.sin((q * Math.PI) / 2)
      const y = 0.06 + 0.85 * Math.cos((q * Math.PI) / 2) ** 0.55 * (0.6 + 0.4 * rho)
      const dirx = Math.cos(a)
      const dirz = Math.sin(a) * 0.62
      const p = [centre[0] + dirx * lobes * rho, q >= 1 ? 0.04 : y * (1 - q ** 5), centre[2] + dirz * lobes * rho]
      const n = norm3([dirx * rho ** 3, 1 - 0.75 * rho ** 3, dirz * rho ** 3])
      return { p, n, uv: [i / seg, q], uv2: [i / seg, q], c: [0.5 + 0.2 * (1 - rho), clamp(0.9 * (1 - rho ** 4), 0, 1), 1] }
    })
  }
  return { soup, drips: count }
}

// The cobweb: sheets strung from the thorns at the right of the ring to the long spike near the slab.
export function buildWeb(heroTips) {
  const soup = new Soup('web')
  const at = (x, y, r) => L.onCylinder(x, y, r).p
  const sheets = [
    { hub: at(1872, 1118, 53), a: at(1905, 1190, 57), b: heroTips.length > 10 ? heroTips[10] : at(2020, 1345, 66), sag: 3.5 },
    { hub: at(1905, 1190, 57), a: at(1880, 1330, 58), b: heroTips.length > 10 ? heroTips[10] : at(2020, 1345, 66), sag: 2.2 },
    { hub: at(1838, 1060, 50), a: at(1872, 1118, 53), b: at(1915, 1082, 58), sag: 1.0 },
  ]
  sheets.forEach((s, k) => {
    const n = 18
    soup.grid(n, n, (i, j) => {
      const u = i / (n - 1)
      const v = j / (n - 1)
      const edge = [mix(s.a[0], s.b[0], u), mix(s.a[1], s.b[1], u), mix(s.a[2], s.b[2], u)]
      const p = [mix(s.hub[0], edge[0], v), mix(s.hub[1], edge[1], v), mix(s.hub[2], edge[2], v)]
      const sag = s.sag * Math.sin(Math.PI * u) * v * v
      p[1] -= sag
      const out = norm3([p[0], 0, p[2]])
      return { p: add3(p, out, -0.6 * sag), n: out, uv: [u, v], uv2: [u, v], c: [1, (k + 0.5) / 4, 0] }
    })
  })
  return { soup }
}
