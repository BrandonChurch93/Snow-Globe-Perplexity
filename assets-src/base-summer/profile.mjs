import fs from 'node:fs'
import { loadConfig } from '../../tools/lib/paths.mjs'
import { clamp, fbm, mix, smooth } from './lib.mjs'

const G = loadConfig().globe
export const RAD = Math.PI / 180
export const SPHERE_R = G.sphereDiameterMm / 2
export const TOP = G.baseHeightMm
export const CENTRE_H = G.baseHeightMm - G.collarDepthMm + SPHERE_R
export const sphereRadiusAt = (h) => Math.sqrt(Math.max(SPHERE_R * SPHERE_R - (CENTRE_H - h) * (CENTRE_H - h), 0))

// The stone's rim stands where the approved image has it (references/approved/summer-rest.png: the lip's corner is about 52 mm out and
// 40 mm up, and the glass goes down into the stone where the sphere is about 91 mm wide), so RISE is nothing; it stays as the one
// number that lifts the whole seat. The crown of the collar keeps winter's gap to the glass, and the cup under the sphere is the same.
export const RISE = 0
const CROWN_H = TOP + 5.6 + RISE
export const COLLAR = { crown: [sphereRadiusAt(CROWN_H) + 0.57, CROWN_H], bead: 0.8, gap: 0.12 }
export const CUP = { offset: 0.15 }
export const LEDGE_H = TOP + 7.4 + RISE

// Radius and height in mm, foot to collar, read from the silhouette of references/approved/summer-rest.png (measure.mjs). From the
// rim inward the stone goes down to the glass in one rounded seat.
export const BODY = [
  [53.2, 0.0],
  [55.6, 0.9],
  [57.7, 2.6],
  [59.3, 5.0],
  [60.2, 8.0],
  [60.3, 11.2],
  [59.7, 14.6],
  [58.6, 18.0],
  [57.3, 21.2],
  [55.8, 24.4],
  [54.3, 27.4],
  [53.0, 30.5],
  [52.9, 33.6],
  [52.8, 36.3],
  [52.3, 38.4],
  [51.5, LEDGE_H - 0.7],
  [50.3, LEDGE_H],
  [48.8, LEDGE_H - 0.1],
  [47.3, LEDGE_H - 0.4],
  [46.2, LEDGE_H - 0.85],
  [45.4, LEDGE_H - 1.4],
  [COLLAR.crown[0] - 0.13, COLLAR.crown[1]],
]

function catmull(points, per) {
  const out = []
  const at = (i) => points[Math.min(Math.max(i, 0), points.length - 1)]
  for (let i = 0; i + 1 < points.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let k = 0; k < per; k++) {
      const t = k / per
      const t2 = t * t
      const t3 = t2 * t
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)))
    }
  }
  out.push(points[points.length - 1].slice())
  return out
}

export function meridian() {
  const pts = catmull(BODY, 16)
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  return { pts, s, total: s[s.length - 1] }
}

export function atS(m, sv) {
  const v = Math.min(Math.max(sv, 0), m.total)
  let lo = 0
  let hi = m.s.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (m.s[mid] <= v) lo = mid
    else hi = mid
  }
  const t = (v - m.s[lo]) / (m.s[hi] - m.s[lo] || 1)
  const a = m.pts[lo]
  const b = m.pts[hi]
  const i0 = Math.max(lo - 1, 0)
  const i1 = Math.min(hi + 1, m.pts.length - 1)
  let tr = m.pts[i1][0] - m.pts[i0][0]
  let th = m.pts[i1][1] - m.pts[i0][1]
  const l = Math.hypot(tr, th) || 1
  tr /= l
  th /= l
  return { r: a[0] + (b[0] - a[0]) * t, h: a[1] + (b[1] - a[1]) * t, tr, th, nr: th, nh: -tr }
}

export function sOfH(m, h) {
  for (let i = 1; i < m.pts.length; i++) {
    if (m.pts[i][1] >= h) {
      const a = m.pts[i - 1]
      const b = m.pts[i]
      const t = (h - a[1]) / (b[1] - a[1] || 1)
      return m.s[i - 1] + (m.s[i] - m.s[i - 1]) * Math.min(Math.max(t, 0), 1)
    }
  }
  return m.total
}

// The map's columns favour the front: the 200 degrees that face the hero camera take FRONT_SHARE of the width.
export const FRONT_DEG = 100
export const FRONT_SHARE = 0.78
export function uOfAz(az) {
  const a = ((((az + 180) % 360) + 360) % 360) - 180
  const m = Math.abs(a)
  const half = m <= FRONT_DEG ? (m / FRONT_DEG) * (FRONT_SHARE / 2) : FRONT_SHARE / 2 + ((m - FRONT_DEG) / (180 - FRONT_DEG)) * ((1 - FRONT_SHARE) / 2)
  return 0.5 + Math.sign(a) * half
}
export function azOfU(u) {
  const d = Math.abs(u - 0.5)
  const m = d <= FRONT_SHARE / 2 ? (d / (FRONT_SHARE / 2)) * FRONT_DEG : FRONT_DEG + ((d - FRONT_SHARE / 2) / ((1 - FRONT_SHARE) / 2)) * (180 - FRONT_DEG)
  return Math.sign(u - 0.5) * m
}

// What is set into the stone, read one by one from the approved image (measure.mjs writes set.json from the picks): azimuth in degrees (0 faces the camera, positive to the
// right), height in mm, half size in mm, kind, turn in degrees, colour (linear), and for glass how long and how three-cornered.
export const SET = JSON.parse(fs.readFileSync(new URL('./set.json', import.meta.url), 'utf8'))

// Behind the hero's view the band goes on: placed by a seeded stream, the same kinds in the same sizes.
{
  let seed = 9173
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const tints = [[0.07, 0.3, 0.15], [0.05, 0.2, 0.2], [0.6, 0.36, 0.1], [0.03, 0.14, 0.27], [0.3, 0.5, 0.38], [0.1, 0.36, 0.28]]
  let az = 76
  while (az < 268) {
    const k = rnd()
    const kind = k < 0.4 ? 'glass' : k < 0.58 ? 'scallop' : k < 0.76 ? 'cockle' : k < 0.88 ? 'snail' : 'olive'
    const r = kind === 'scallop' ? 4 + 2 * rnd() : kind === 'glass' ? 1.8 + 2.4 * rnd() : 2.3 + 1.6 * rnd()
    az += r * 0.9 + 1 + 3 * rnd()
    const item = { az: az > 180 ? az - 360 : az, h: 13 + 13 * rnd(), r, kind, turn: kind === 'glass' ? 360 * rnd() : -30 + 60 * rnd(), c: kind === 'glass' ? tints[Math.floor(rnd() * tints.length)] : [0.86, 0.74 + 0.08 * rnd(), 0.6 + 0.14 * rnd()], band: [0.55, 0.3, 0.15], long: 1 + 0.4 * rnd(), tri: 0.2 * rnd() }
    // Seen from the front the outline of the base is near 96 degrees to either side; a fan shell there shows as a blade, so what the stream puts there lies low.
    if ((kind === 'scallop' || kind === 'cockle') && Math.abs(Math.abs(item.az) - 96) < 17) {
      item.kind = 'glass'
      item.r = Math.min(r, 3.1)
      item.c = tints[SET.length % tints.length]
      item.turn = (item.turn + 360) % 360
    }
    SET.push(item)
    az += r * 0.9
    if (rnd() < 0.6) SET.push({ az: (az > 180 ? az - 360 : az) - 1, h: 12 + 15 * rnd(), r: 0.6 + 0.4 * rnd(), kind: 'pearl', c: [0.84, 0.76, 0.62] })
  }
}

// How far the stone stands out from the turned shape, in mm, at an azimuth and a place along the meridian.
export const BED_MM = 6.4
const bedWarp = (w) => w + 1.9 * Math.sin(w / 5.1 + 0.7) + 1.1 * Math.sin(w / 2.3 + 1.0)
export function strataCoord(az, h) {
  const A = az / 360
  const a = az - 360 * Math.round(az / 360)
  const sag = 2.2 * Math.exp(-(((a - 14) / 42) ** 2))
  return bedWarp(h + sag + 5.6 * (fbm(A * 4 + 4, h / 34 + 3, 4, 64, 21, 3) - 0.5) + 1.3 * Math.sin((az * 2 + 35) * RAD) + 0.9 * Math.sin((az * 5 - 80) * RAD + h * 0.1))
}
const FOOT = { glass: 1.08, scallop: 1.2, cockle: 1.2, snail: 1.25, olive: 1.0, pearl: 0.95 }
// Packed sand, worked by hand. One shallow trough runs round above the foot: [height, sway, turns round the body, phase, half width, depth], in mm and degrees.
const TROUGHS = [[5.2, 1.6, 3, 20, 1.0, 0.6]]
// The body is carved in flowing ridges (references/approved/summer-rest.png): they sweep from the upper left down to the right, lie closer
// here and wider there, and part round the things set in the sand as water parts round a stone. A ridge stands out over the crease under it
// and falls back slowly to the crease over it. STARTS ridges make the whole turn, so they meet themselves behind.
const RIDGE = { apart: 3.6, starts: 22, lean: 8, deep: 0.46, edge: 0.3 }
const ridgeLean = (az) => ((RIDGE.starts * RIDGE.apart) / 360) * az + RIDGE.lean * Math.sin((az - 10) * RAD)
const ridgeWander = (A, h) => 5.0 * (fbm(A * 4 + 1, h / 30, 4, 64, 139, 2) - 0.5) + 3.0 * (fbm(A * 9 + 2, h / 12, 9, 64, 141, 3) - 0.5) + 1.2 * (fbm(A * 21 + 5, h / 6, 21, 64, 143, 2) - 0.5)
function ridgeCoord(m, az, s, h, r) {
  const A = (((az % 360) + 360) % 360) / 360
  const wander = ridgeWander(A, h)
  let psi = h + ridgeLean(az) + wander
  for (const it of SET) {
    if (it.kind === 'pearl') continue
    let da = az - it.az
    da -= 360 * Math.round(da / 360)
    if (Math.abs(da) > 26) continue
    if (it.s === undefined) it.s = sOfH(m, it.h)
    const R = it.r * FOOT[it.kind] * 1.05
    const u = da * RAD * r
    const v = s - it.s
    const dist = Math.hypot(u, v)
    if (dist > 3.4 * R + 1) continue
    if (it.psi === undefined) it.psi = it.h + ridgeLean(it.az) + ridgeWander((((it.az % 360) + 360) % 360) / 360, it.h)
    const own = h + ridgeLean(it.az + da) + wander
    psi -= 0.9 * (own - it.psi) * ((R * R) / (dist * dist + 0.3 * R * R)) * smooth(3.4 * R + 1, 1.5 * R, dist)
  }
  return psi
}
// Where a piece of the lip has broken away: [azimuth, half width], in degrees.
const BREAKS = [[-61, 4.2], [-17, 3.0], [22, 5.2], [57, 3.4], [141, 5], [-128, 4]]
function bare(m, az, s) {
  const q = atS(m, s)
  const A = (((az % 360) + 360) % 360) / 360
  const a180 = az - 360 * Math.round(az / 360)
  const onTop = smooth(36.4 + RISE, 38.4 + RISE, q.h) * smooth(52.4, 51.2, q.r)
  const h = q.h + onTop * (52 - q.r) * 0.9
  const w = strataCoord(az, h)
  const t = w / BED_MM
  const k = Math.floor(t)
  const f = t - k
  let trough = 0
  for (let i = 0; i < TROUGHS.length; i++) {
    const [h0, sway, turns, phase, wide, deep] = TROUGHS[i]
    const c = h0 + sway * Math.sin((az * turns + phase) * RAD) + 3.0 * (fbm(A * 6 + i * 3.7, 0.5, 6, 4, 91 + i, 3) - 0.5)
    const live = smooth(0.28, 0.52, fbm(A * 5 + i * 5.3, 0.5, 5, 4, 131 + i, 2))
    const x = (h - c) / wide
    trough -= deep * live * Math.exp(-x * x)
  }
  const swell = 1.9 * (fbm(A * 5 + 1, h / 16, 5, 64, 11, 3) - 0.5) + 1.2 * (fbm(A * 9 + 3, h / 11, 9, 64, 15, 3) - 0.5) + 0.4 * (fbm(A * 19 + 7, h / 5.5, 19, 64, 13, 2) - 0.5) + 0.45 * (fbm(A * 40 + 11, h / 3.5, 40, 64, 17, 3) - 0.5)
  const gh = TROUGHS[0][0] + TROUGHS[0][1] * Math.sin((az * TROUGHS[0][2] + TROUGHS[0][3]) * RAD)
  const seatLip = 0.12 * smooth(35.8 + RISE, 37.2 + RISE, q.h + 1.6 * (fbm(A * 9, 0.7, 9, 4, 61, 2) - 0.5)) * (1 - onTop)
  // The top is a thick round lip that rolls out over a shallow neck and over the corner onto the top, so the glass sits in it; where the sand falls it keeps close to the turned shape.
  // It is packed by hand: its edge wanders, the roll is thicker here and thinner there, and in a few places a piece has broken away.
  let gone = 0
  for (const [at, wide] of BREAKS) gone = Math.max(gone, smooth(1.0, 0.25, Math.abs(a180 - at) / wide + 0.9 * (fbm(A * 90 + 3, q.h / 2.5, 90, 64, 95, 2) - 0.5)))
  const lipH = 30.6 + RISE + 3.0 * (fbm(A * 5 + 5, 0.4, 5, 4, 83, 3) - 0.5) + 3.0 * (fbm(A * 13 + 2, 0.4, 13, 4, 87, 2) - 0.5) + 1.8 * (fbm(A * 37 + 6, 0.4, 37, 4, 89, 2) - 0.5) + 4.0 * gone
  const thick = (0.62 + 0.76 * fbm(A * 17 + 8, 0.6, 17, 4, 93, 2)) * (1 - 0.3 * gone)
  const lip = (2.0 * thick * smooth(lipH - 2.4, lipH + 1.0, q.h) * smooth(46.0, 49.6, q.r) - 0.35 * Math.exp(-(((q.h - lipH + 3.4) / 1.6) ** 2)) * (1 - onTop)) * (1 - 0.7 * smooth(48, 62, a180) * smooth(128, 114, a180))
  const lumps = (1.8 * (fbm(A * 23 + 4, q.h / 9, 23, 64, 99, 3) - 0.5) + 0.5 * (fbm(A * 70 + 3, q.h / 2, 70, 64, 19, 2) - 0.5)) * smooth(lipH - 2.0, lipH + 1.5, q.h) * smooth(45.0, 48.5, q.r)
  const psi = ridgeCoord(m, az, s, h, q.r)
  const rt = psi / RIDGE.apart
  const rf = rt - Math.floor(rt)
  const shape = 0.5 - 0.5 * Math.cos(Math.PI * (rf < RIDGE.edge ? rf / RIDGE.edge : 1 + (rf - RIDGE.edge) / (1 - RIDGE.edge)))
  const ridge = -RIDGE.deep * (1 - shape) * (0.45 + 1.1 * fbm(A * 6 + 9, h / 16, 6, 64, 147, 3)) * mix(1, 0.7, smooth(18, 52, a180)) * smooth(1.2, 4.5, q.h) * smooth(lipH + 0.2, lipH - 2.8, q.h) * (1 - onTop)
  const fade = smooth(0.0, 1.6, s) * smooth(m.total, m.total - 2.2, s)
  const d = (swell * (1 - 0.55 * onTop) + trough * (1 - onTop) + ridge + seatLip + lip + lumps) * fade
  return { d, w, k, f, q, onTop, gh }
}
export function relief(m, az, s) {
  const b = bare(m, az, s)
  const q = b.q
  let d = b.d
  let seat = 0
  let halo = 0
  for (const it of SET) {
    let da = az - it.az
    da -= 360 * Math.round(da / 360)
    if (Math.abs(da) > 14) continue
    if (it.s === undefined) it.s = sOfH(m, it.h)
    const foot = it.r * FOOT[it.kind]
    const fan = it.kind === 'scallop' || it.kind === 'cockle'
    const long = it.kind === 'glass' || fan ? (it.long ?? 1) : 1
    const reach = foot * long + 1.6
    const u = da * RAD * q.r
    const v = s - it.s
    if (Math.abs(u) > reach || Math.abs(v) > reach) continue
    const t = (it.turn ?? 0) * RAD
    const dist = Math.hypot((u * Math.cos(t) + v * Math.sin(t)) * (fan ? long : 1), (-u * Math.sin(t) + v * Math.cos(t)) / long)
    // A thing lies in a dish cut into the stone where the stone is, not where the turned shape was: level with its own middle.
    if (it.d0 === undefined) it.d0 = bare(m, it.az, it.s).d
    const inside = 1 - smooth(0.78 * foot, 1.07 * foot, dist)
    const deep = it.kind === 'pearl' ? 0.2 * it.r : it.kind === 'glass' ? 0.3 + 0.05 * it.r : 0.12 + 0.04 * it.r
    d = mix(d, it.d0, 0.88 * inside) - deep * inside
    seat = Math.max(seat, inside)
    halo = Math.max(halo, 1 - smooth(0.88 * foot, foot + 0.7 + 0.14 * foot, dist))
  }
  return { d, w: b.w, k: b.k, f: b.f, h: q.h, seat, halo, onTop: b.onTop, gh: b.gh }
}
export const clamp01 = (v) => clamp(v)
