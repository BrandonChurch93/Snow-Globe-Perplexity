import { loadConfig } from '../../tools/lib/paths.mjs'

const G = loadConfig().globe
export const SPHERE_R = G.sphereDiameterMm / 2
export const TOP = G.baseHeightMm
export const CENTRE_H = G.baseHeightMm - G.collarDepthMm + SPHERE_R
export const FOOT_R = 58.8

export const sphereRadiusAt = (h) => Math.sqrt(Math.max(SPHERE_R * SPHERE_R - (CENTRE_H - h) * (CENTRE_H - h), 0))

export const RIM = { r: FOOT_R, top: 3.6 }
export const ROPE = { ringR: 57.3, h: 4.9, tube: 1.4, lobes: 124, strands: 1.9, depth: 0.36 }
export const BEAD = { ringR: 56.3, h: 7.5, tube: 0.92 }
export const LIP = { ringR: 53.45, h: TOP - 0.3, tube: 1.45 }
export const LEDGE = { outer: [52.75, TOP], inner: [43.6, TOP + 1.9] }
export const COLLAR = { foot: [44.2, TOP + 2.5], crown: [44.9, TOP + 5.62], bead: 0.62, gap: 0.12 }
export const CUP = { offset: 0.15 }
export const ICE = { r: 54.75, h: TOP - 0.55, up: 0.6 }

export const BODY = [
  [56.95, 8.4],
  [57.3, 9.0],
  [57.3, 9.9],
  [57.0, 11.0],
  [56.4, 12.3],
  [55.5, 13.8],
  [54.4, 15.5],
  [53.3, 17.4],
  [52.25, 19.6],
  [51.3, 21.9],
  [50.55, 24.2],
  [50.12, 26.3],
  [50.15, 28.2],
  [50.6, 29.8],
  [51.35, 31.0],
  [52.3, 31.7],
]

export const CARVING = { low: 8.0, high: 25.0, relief: 2.1, rRef: 54.5 }

function catmull(points, per) {
  const out = []
  const at = (i) => points[Math.min(Math.max(i, 0), points.length - 1)]
  for (let i = 0; i + 1 < points.length; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
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
  const control = [[56.0, 7.3], ...BODY, [53.0, TOP - 0.45]]
  const pts = catmull(control, 16)
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
  const span = m.s[hi] - m.s[lo] || 1
  const t = (v - m.s[lo]) / span
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

export function bodyRadiusAt(m, h) {
  return atS(m, sOfH(m, h)).r
}

export const PROFILE_NOTES = [
  `rim: a flange of radius ${RIM.r} to 59.1 from 1.2 to ${RIM.top} over a recessed foot of radius 57.7`,
  `rope ring: centre radius ${ROPE.ringR}, height ${ROPE.h}, tube ${ROPE.tube}, ${ROPE.lobes} lobes of ${ROPE.strands} strands`,
  `bead: centre radius ${BEAD.ringR}, height ${BEAD.h}, tube ${BEAD.tube}`,
  `body, radius at height: ${BODY.map(([r, h]) => `${r}@${h}`).join(' ')}`,
  `ledge lip: centre radius ${LIP.ringR}, height ${LIP.h.toFixed(2)}, tube ${LIP.tube}`,
  `ledge floor: ${LEDGE.outer.join('@')} to ${LEDGE.inner.map((v) => v.toFixed(2)).join('@')}`,
  `collar: foot ${COLLAR.foot.map((v) => v.toFixed(2)).join('@')}, crown ${COLLAR.crown.map((v) => v.toFixed(2)).join('@')}, glass radius at the crown ${sphereRadiusAt(COLLAR.crown[1]).toFixed(2)}`,
]

export function ring() {
  const out = []
  out.push([RIM.r, 0, '#ff4040'], [RIM.r, RIM.top, '#ff4040'])
  out.push([ROPE.ringR + ROPE.tube, ROPE.h, '#ffd040'], [ROPE.ringR, ROPE.h + ROPE.tube, '#ffd040'])
  out.push([BEAD.ringR + BEAD.tube, BEAD.h, '#40ff80'], [BEAD.ringR, BEAD.h + BEAD.tube, '#40ff80'])
  for (const [r, h] of BODY) out.push([r, h, '#40c0ff'])
  out.push([LIP.ringR + LIP.tube, LIP.h, '#ff40ff'], [LIP.ringR, LIP.h + LIP.tube, '#ff40ff'], [LIP.ringR, LIP.h - LIP.tube, '#ff40ff'])
  out.push([LEDGE.inner[0], LEDGE.inner[1], '#ffffff'])
  out.push([COLLAR.crown[0], COLLAR.crown[1], '#ffff00'], [sphereRadiusAt(COLLAR.crown[1]), COLLAR.crown[1], '#00ffff'])
  return out
}
