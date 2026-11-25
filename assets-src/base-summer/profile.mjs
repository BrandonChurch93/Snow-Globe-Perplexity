import { loadConfig } from '../../tools/lib/paths.mjs'
import { clamp, fbm, hashInt, smooth } from './lib.mjs'

const G = loadConfig().globe
export const RAD = Math.PI / 180
export const SPHERE_R = G.sphereDiameterMm / 2
export const TOP = G.baseHeightMm
export const CENTRE_H = G.baseHeightMm - G.collarDepthMm + SPHERE_R
export const sphereRadiusAt = (h) => Math.sqrt(Math.max(SPHERE_R * SPHERE_R - (CENTRE_H - h) * (CENTRE_H - h), 0))

// The same seat as winter's: the crown of the collar, the gap to the glass and the cup under the sphere.
export const COLLAR = { crown: [44.93, TOP + 5.6], bead: 0.8, gap: 0.12 }
export const CUP = { offset: 0.15 }
export const LEDGE_H = TOP + 4.55

// Radius and height in mm, foot to collar, read from the silhouette of references/approved/summer-rest.png (measure.mjs).
export const BODY = [
  [57.7, 0.0],
  [59.1, 0.55],
  [60.0, 1.9],
  [60.45, 4.1],
  [60.35, 6.6],
  [59.8, 9.6],
  [58.9, 13.0],
  [57.8, 16.6],
  [56.6, 20.0],
  [55.3, 23.5],
  [53.9, 27.0],
  [53.0, 30.0],
  [52.6, 33.0],
  [52.5, 35.0],
  [52.0, 36.4],
  [51.0, 37.25],
  [49.6, LEDGE_H],
  [48.0, LEDGE_H - 0.05],
  [46.5, LEDGE_H],
  [45.75, LEDGE_H + 0.3],
  [45.2, COLLAR.crown[1] - 0.2],
  [44.8, COLLAR.crown[1]],
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

// What is set into the stone, read one by one from the approved image: azimuth in degrees (0 faces the camera, positive to the
// right), height in mm, half size in mm, kind, turn in degrees, colour (linear), and for glass how long and how three-cornered.
const W = [0.86, 0.8, 0.7]
export const SET = [
  { az: -58, h: 25.6, r: 2.5, kind: 'glass', turn: 80, c: [0.72, 0.36, 0.035], long: 1.5 },
  { az: -54, h: 23.2, r: 2.7, kind: 'glass', turn: 70, c: [0.012, 0.11, 0.12], long: 1.4 },
  { az: -53.5, h: 19.6, r: 1.8, kind: 'glass', turn: 0, c: [0.42, 0.3, 0.04] },
  { az: -41, h: 21.8, r: 5.0, kind: 'scallop', turn: -14, c: W },
  { az: -37.2, h: 16.0, r: 3.1, kind: 'glass', turn: 30, c: [0.36, 0.62, 0.42], frost: 1 },
  { az: -32.3, h: 21.0, r: 2.9, kind: 'cockle', turn: 20, c: [0.84, 0.52, 0.24] },
  { az: -25.6, h: 18.9, r: 3.1, kind: 'snail', turn: 40, c: [0.84, 0.7, 0.55], band: [0.5, 0.26, 0.12] },
  { az: -23.6, h: 14.3, r: 2.6, kind: 'cockle', turn: 150, c: [0.86, 0.78, 0.7] },
  { az: -16.4, h: 16.9, r: 4.2, kind: 'glass', turn: 10, c: [0.03, 0.34, 0.12] },
  { az: -6.5, h: 18.3, r: 0.9, kind: 'pearl', c: [0.82, 0.74, 0.62] },
  { az: -4.0, h: 15.6, r: 2.2, kind: 'glass', turn: 50, c: [0.012, 0.13, 0.15] },
  { az: -8.3, h: 10.8, r: 4.6, kind: 'glass', turn: 200, c: [0.08, 0.42, 0.3], tri: 0.24 },
  { az: -21, h: 11.2, r: 1.6, kind: 'glass', turn: 0, c: [0.3, 0.3, 0.06] },
  { az: -18.2, h: 11.9, r: 0.8, kind: 'pearl', c: [0.8, 0.7, 0.55] },
  { az: -15.4, h: 11.5, r: 0.95, kind: 'pearl', c: [0.82, 0.72, 0.5] },
  { az: 3.8, h: 11.9, r: 3.9, kind: 'olive', turn: 14, c: [0.88, 0.82, 0.74] },
  { az: 14.2, h: 10.9, r: 3.6, kind: 'glass', turn: 100, c: [0.012, 0.06, 0.36], long: 1.15 },
  { az: 25.2, h: 15.8, r: 6.0, kind: 'scallop', turn: 8, c: [0.88, 0.8, 0.72] },
  { az: 32.3, h: 22.4, r: 2.4, kind: 'snail', turn: -60, c: [0.86, 0.72, 0.58], band: [0.62, 0.36, 0.2] },
  { az: 36.0, h: 18.4, r: 2.5, kind: 'cockle', turn: -30, c: [0.8, 0.76, 0.74] },
  { az: 35.6, h: 12.9, r: 2.7, kind: 'glass', turn: 0, c: [0.015, 0.2, 0.3] },
  { az: 44.8, h: 17.8, r: 4.2, kind: 'cockle', turn: 4, c: [0.86, 0.68, 0.58], long: 1.25 },
  { az: 52, h: 23.8, r: 2.5, kind: 'glass', turn: 85, c: [0.74, 0.44, 0.05], long: 1.5 },
  { az: 53.6, h: 17.8, r: 3.0, kind: 'glass', turn: 80, c: [0.6, 0.66, 0.24], long: 1.4, frost: 1 },
  { az: 17.5, h: 25.4, r: 0.7, kind: 'pearl', c: [0.84, 0.76, 0.62] },
  { az: 20.2, h: 21.4, r: 0.8, kind: 'pearl', c: [0.84, 0.76, 0.62] },
  { az: 37.6, h: 15.5, r: 0.8, kind: 'pearl', c: [0.82, 0.74, 0.6] },
  { az: -46.5, h: 14.4, r: 0.8, kind: 'pearl', c: [0.8, 0.66, 0.42] },
  { az: -34, h: 12.5, r: 0.9, kind: 'pearl', c: [0.84, 0.76, 0.62] },
  { az: -49.5, h: 16.8, r: 0.7, kind: 'pearl', c: [0.8, 0.66, 0.42] },
  { az: 8, h: 17.6, r: 0.6, kind: 'pearl', c: [0.84, 0.78, 0.66] },
  { az: 41, h: 12.4, r: 0.7, kind: 'pearl', c: [0.84, 0.78, 0.66] },
]

// Behind the hero's view the band goes on: placed by a seeded stream, the same kinds in the same sizes.
{
  let seed = 9173
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const tints = [[0.03, 0.34, 0.12], [0.012, 0.11, 0.12], [0.72, 0.36, 0.035], [0.012, 0.06, 0.36], [0.36, 0.62, 0.42], [0.08, 0.42, 0.3]]
  let az = 64
  while (az < 296) {
    const k = rnd()
    const kind = k < 0.4 ? 'glass' : k < 0.58 ? 'scallop' : k < 0.76 ? 'cockle' : k < 0.88 ? 'snail' : 'olive'
    const r = kind === 'scallop' ? 4 + 2 * rnd() : kind === 'glass' ? 1.8 + 2.4 * rnd() : 2.3 + 1.6 * rnd()
    az += r * 0.9 + 1 + 3 * rnd()
    const item = { az: az > 180 ? az - 360 : az, h: 11 + 13 * rnd(), r, kind, turn: kind === 'glass' ? 360 * rnd() : -30 + 60 * rnd(), c: kind === 'glass' ? tints[Math.floor(rnd() * tints.length)] : [0.86, 0.74 + 0.08 * rnd(), 0.6 + 0.14 * rnd()], band: [0.55, 0.3, 0.15], long: 1 + 0.4 * rnd(), tri: 0.2 * rnd() }
    SET.push(item)
    az += r * 0.9
    if (rnd() < 0.6) SET.push({ az: (az > 180 ? az - 360 : az) - 1, h: 10 + 15 * rnd(), r: 0.6 + 0.4 * rnd(), kind: 'pearl', c: [0.84, 0.76, 0.62] })
  }
}

// How far the stone stands out from the turned shape, in mm, at an azimuth and a place along the meridian.
const hashK = (k, seed) => hashInt(k, 7, seed)
export const BED_MM = 6.4
export function strataCoord(az, h) {
  const A = az / 360
  return h + 9.5 * (fbm(A * 5 + 4, h / 30 + 3, 5, 64, 21, 3) - 0.5) + 3.4 * Math.sin((az * 2 + 35) * RAD) + 2.2 * Math.sin((az * 5 - 80) * RAD + h * 0.1)
}
export function relief(m, az, s) {
  const q = atS(m, s)
  const A = (((az % 360) + 360) % 360) / 360
  const onTop = smooth(36.3, 37.3, q.h) * smooth(52.4, 51.2, q.r)
  const h = q.h + onTop * (52 - q.r) * 0.9
  const w = strataCoord(az, h)
  const t = w / BED_MM
  const k = Math.floor(t)
  const f = t - k
  const amp = (hashK(k, 5) < 0.28 ? 0.12 : 0.55 + 1.25 * hashK(k, 6)) * smooth(0.28, 0.62, fbm(A * 6 + k * 3.1, 0.5, 6, 4, 31, 2)) * 1.5
  const prof = f < 0.14 ? smooth(0, 0.14, f) : 1 - Math.pow((f - 0.14) / 0.86, 0.8)
  const swell = 2.3 * (fbm(A * 5 + 1, h / 16, 5, 64, 11, 3) - 0.5) + 0.7 * (fbm(A * 15 + 7, h / 6.5, 15, 64, 13, 2) - 0.5)
  const lam = 0.03 * Math.sin((w * 2 * Math.PI) / 1.05 + 5 * fbm(A * 40, h / 3, 40, 64, 41, 2)) * smooth(0.45, 0.7, fbm(A * 9 + 2, h / 9, 9, 64, 43, 2))
  const gh = 6.2 + 1.1 * Math.sin((az * 2 - 20) * RAD) + 1.8 * (fbm(A * 6, 0.3, 6, 4, 51, 2) - 0.5)
  const groove = -1.35 * Math.exp(-(((q.h - gh) / 1.15) ** 2)) * (1 - onTop)
  const lip = 0.12 * smooth(33.4, 34.8, q.h + 1.6 * (fbm(A * 9, 0.7, 9, 4, 61, 2) - 0.5)) * (1 - onTop)
  let pit = 0
  const cu = A * 150
  const cv = s / 2.3
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ci = Math.floor(cu) + di
    const cj = Math.floor(cv) + dj
    const wi = ((ci % 150) + 150) % 150
    if (hashInt(wi, cj, 71) > 0.05) continue
    const rr = 0.2 + 0.5 * hashInt(wi, cj, 73)
    const dx = (cu - (ci + 0.2 + 0.6 * hashInt(wi, cj, 75))) * 2.4
    const dy = (cv - (cj + 0.2 + 0.6 * hashInt(wi, cj, 77))) * 2.3
    const d = Math.hypot(dx, dy)
    if (d < rr) pit = Math.min(pit, -0.55 * (1 - (d / rr) ** 2) * rr * 2)
  }
  const fade = smooth(0.0, 1.6, s) * smooth(m.total, m.total - 2.2, s)
  let d = (swell + amp * (prof - 0.45) * (1 - 0.6 * onTop) + lam + groove + lip) * fade + pit * fade
  let seat = 0
  for (const it of SET) {
    let da = az - it.az
    da -= 360 * Math.round(da / 360)
    if (Math.abs(da) > 12) continue
    if (it.s === undefined) it.s = sOfH(m, it.h)
    const dist = Math.hypot(da * RAD * q.r, s - it.s)
    const R = it.r * (it.long ?? 1)
    if (dist > R * 1.7) continue
    const inside = 1 - smooth(0.7 * R, 1.12 * R, dist)
    const rim = smooth(0.95 * R, 1.2 * R, dist) * (1 - smooth(1.25 * R, 1.7 * R, dist))
    const deep = it.kind === 'pearl' ? 0.35 * it.r : it.kind === 'glass' ? 0.5 + 0.12 * it.r : 0.35 + 0.1 * it.r
    d = d * (1 - 0.75 * inside) - deep * inside + 0.22 * rim
    seat = Math.max(seat, inside)
  }
  return { d, w, k, f, h: q.h, seat, onTop, gh }
}
export const clamp01 = (v) => clamp(v)
