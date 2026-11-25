import { loadConfig } from '../../tools/lib/paths.mjs'
import { REF_RIG, rayOf } from '../../tools/lib/refcam.mjs'

const G = loadConfig().globe
export const RAD = Math.PI / 180
export const SPHERE_R = G.sphereDiameterMm / 2
export const TOP = G.baseHeightMm
export const CENTRE_H = TOP - G.collarDepthMm + SPHERE_R
export const sphereRadiusAt = (h) => Math.sqrt(Math.max(SPHERE_R * SPHERE_R - (CENTRE_H - h) * (CENTRE_H - h), 0))

// The camera of references/approved/fall-rest.png as fall's air builder measured it (assets-src/refrig/fall.json), and the
// 5.6 px of x that camera cannot move.
export const RIG = { ...REF_RIG, distanceMm: 604.0, aimHeightMm: 65.2 }
export const SHIFT_X = 5.6

export const place = (r, h, az) => [r * Math.sin(az * RAD), h, r * Math.cos(az * RAD)]
export const front = (az) => Math.abs(((az + 540) % 360) - 180)
export const wrapDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180

// The iron drum, radius by height. The crown is winter's collar: the glass is met at the same ring.
export const CROWN = [44.93, TOP + 5.6]
export const DRUM = [
  [53.0, 0.03],
  [53.9, 1.0],
  [54.0, 2.4],
  [53.3, 4.8],
  [52.0, 9.0],
  [50.8, 15.0],
  [49.8, 22.0],
  [49.0, 28.0],
  [48.4, 33.0],
  [47.8, 36.0],
  [46.9, 37.7],
  [45.9, 38.5],
  [45.2, 38.78],
]
export function drumR(h) {
  const p = DRUM
  if (h <= p[0][1]) return p[0][0]
  for (let i = 0; i + 1 < p.length; i++) {
    if (h <= p[i + 1][1]) {
      const t = (h - p[i][1]) / (p[i + 1][1] - p[i][1])
      const s = t * t * (3 - 2 * t)
      return p[i][0] + (p[i + 1][0] - p[i][0]) * (0.5 * t + 0.5 * s)
    }
  }
  return p[p.length - 1][0]
}

// A pixel of the approved image onto a cylinder about the globe's axis: the nearer of the two crossings.
export function onCylinder(px, py, radius) {
  const { origin: o, dir: d } = rayOf(px - SHIFT_X, py, undefined, RIG)
  const a = d[0] * d[0] + d[2] * d[2]
  const b = 2 * (o[0] * d[0] + o[2] * d[2])
  const c = o[0] * o[0] + o[2] * o[2] - radius * radius
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]
  return { az: Math.atan2(p[0], p[2]) / RAD, h: p[1], p }
}

// The carved faces. The three in front are read from the approved image (centre of each face in its pixels, and its size);
// the four behind are placed to finish the ring. `rad` is the half width across the ring in mm, `tall` the half height.
const SEEN = [
  { x: 1112, y: 1268, rad: 6.6, tall: 6.5, cell: 0 },
  { x: 1497, y: 1287, rad: 7.4, tall: 7.9, cell: 1 },
  { x: 1722, y: 1262, rad: 7.0, tall: 7.2, cell: 2 },
]
const BEHIND = [
  { az: 97, h: 20.2, rad: 6.8, tall: 7.0, cell: 3 },
  { az: 148, h: 19.6, rad: 7.2, tall: 7.4, cell: 1 },
  { az: -158, h: 20.8, rad: 6.6, tall: 6.8, cell: 0 },
  { az: -101, h: 19.9, rad: 7.0, tall: 7.3, cell: 2 },
]
export const FACE_R = 51.2
export const FACES = [
  ...SEEN.map((f) => {
    const hit = onCylinder(f.x, f.y, FACE_R)
    return { az: Number(hit.az.toFixed(2)), h: Number(hit.h.toFixed(2)), rad: f.rad, tall: f.tall, cell: f.cell, seen: true }
  }),
  ...BEHIND.map((f) => ({ ...f, seen: false })),
]

// Wax that hangs from the collar, read from the approved image: x of the drip, y of its end, its width in pixels.
export const DRIPS = [
  { x: 1003, y1: 1135, w: 24, wide: 2.2 },
  { x: 1050, y1: 1085, w: 16, wide: 1.4 },
  { x: 1168, y1: 1172, w: 18, wide: 1.2 },
  { x: 1255, y1: 1112, w: 12, wide: 1.0 },
  { x: 1367, y1: 1178, w: 17, wide: 3.4 },
  { x: 1512, y1: 1142, w: 14, wide: 1.3 },
  { x: 1622, y1: 1166, w: 17, wide: 2.0 },
  { x: 1630, y1: 1282, w: 17, wide: 1.6 },
  { x: 1785, y1: 1132, w: 16, wide: 1.8 },
  { x: 1842, y1: 1110, w: 20, wide: 2.4 },
]
// Wax that has run to the slab and pooled: x of the run, y where it starts, the half width of its pool in mm.
export const RUNS = [
  { x: 1052, y0: 1332, w: 24, pool: 3.6 },
  { x: 1622, y0: 1392, w: 20, pool: 3.2 },
  { x: 1788, y0: 1345, w: 19, pool: 2.8 },
]

// The thorns a viewer can count, read from the approved image by eye: where each stands on the ring, the way it points
// (along the ring to the right, up, outward) and its length and root radius in mm.
export const HERO_THORNS = [
  { az: 19, h: 37.6, dir: [0.55, 0.8, 0.32], len: 11.5, rad: 1.55 },
  { az: 30, h: 36.4, dir: [-0.9, 0.28, 0.32], len: 9.5, rad: 0.95 },
  { az: -22, h: 36.2, dir: [-0.92, 0.3, 0.25], len: 10.5, rad: 1.2 },
  { az: -5, h: 37.2, dir: [0.85, 0.35, 0.3], len: 7.5, rad: 1.0 },
  { az: -62, h: 30.5, dir: [-0.62, 0.16, 0.76], len: 12.5, rad: 1.5 },
  { az: -74, h: 37.0, dir: [-0.3, 0.8, 0.5], len: 6.5, rad: 1.1 },
  { az: 70, h: 35.5, dir: [0.5, 0.74, 0.46], len: 11.5, rad: 1.5 },
  { az: 73, h: 33.8, dir: [0.7, -0.08, 0.7], len: 9.5, rad: 1.25 },
  { az: 64, h: 37.4, dir: [0.2, 0.95, 0.22], len: 8.0, rad: 1.2 },
  { az: 52, h: 36.0, dir: [0.75, 0.5, 0.42], len: 9.0, rad: 1.2 },
  { az: 60, h: 4.6, dir: [0.75, 0.2, 0.62], len: 22.0, rad: 1.9 },
  { az: 42, h: 3.4, dir: [0.9, 0.06, 0.42], len: 13.0, rad: 1.5 },
  { az: -70, h: 7.5, dir: [-0.72, 0.05, 0.7], len: 14.0, rad: 1.6 },
  { az: -80, h: 18.5, dir: [-0.5, 0.5, 0.7], len: 9.5, rad: 1.2 },
  { az: -55, h: 3.6, dir: [-0.85, 0.02, 0.5], len: 12.0, rad: 1.4 },
  { az: 3, h: 8.2, dir: [0.06, -0.9, 0.42], len: 6.0, rad: 1.1 },
  { az: -9, h: 4.2, dir: [-0.2, -0.5, 0.84], len: 7.0, rad: 1.2 },
  { az: 26, h: 21.0, dir: [0.3, -0.85, 0.4], len: 10.5, rad: 1.2 },
  { az: -27, h: 22.5, dir: [0.9, 0.12, 0.42], len: 9.0, rad: 1.0 },
]
