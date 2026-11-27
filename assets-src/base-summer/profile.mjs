import fs from 'node:fs'
import { loadConfig } from '../../tools/lib/paths.mjs'
import { clamp, fbm, hashInt, mix, mulberry, smooth } from './lib.mjs'

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
const CROWN_H = TOP + 8.3 + RISE
export const COLLAR = { crown: [sphereRadiusAt(CROWN_H) + 0.57, CROWN_H], bead: 0.8, gap: 0.12 }
export const CUP = { offset: 0.15 }
export const LEDGE_H = TOP + 7.4 + RISE

// Radius and height in mm, foot to collar, read from the silhouette of references/approved/summer-rest.png (measure.mjs). From the
// rim inward the stone rises a little to a crest beside the glass and goes down to it in a short bevel: the groove the ball sits in.
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
  [52.9, LEDGE_H - 8.0],
  [52.6, LEDGE_H - 6.1],
  [52.0, LEDGE_H - 4.4],
  [51.2, LEDGE_H - 2.9],
  [50.2, LEDGE_H - 1.6],
  [49.2, LEDGE_H - 0.5],
  [48.3, LEDGE_H + 0.35],
  [47.7, LEDGE_H + 0.85],
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

// A piece of sea glass is a tumbled pebble: three to five sides worn nearly round, no two alike. Its outline is a share of
// its half size by the angle in its own frame; the dish it lies in is cut to the same outline.
SET.forEach((it, i) => {
  if (it.kind !== 'glass') return
  const next = mulberry(7000 + i * 53)
  const n = (it.tri ?? 0) > 0.15 ? 3 : 3 + Math.floor(next() * 2.99)
  const power = [0, 0, 0, 2.0, 3.0, 4.2][n]
  const p0 = next() * 2 * Math.PI
  const sides = Array.from({ length: n }, (_, k) => ({ at: p0 + ((k + 0.5 * (next() - 0.5)) * 2 * Math.PI) / n, d: 0.8 + 0.3 * next() }))
  it.shard = { sides, power, scale: 1, p0 }
  let mean = 0
  for (let k = 0; k < 64; k++) mean += shardAt(it, (k / 64) * 2 * Math.PI) ** 2 / 64
  it.shard.scale = 1 / Math.sqrt(mean)
})
export function shardAt(it, phi) {
  const sh = it.shard
  let sum = 0
  for (const e of sh.sides) {
    const c = Math.cos(phi - e.at)
    if (c > 0) sum += Math.pow(c / e.d, sh.power)
  }
  return mix(1, Math.min(Math.pow(Math.max(sum, 1e-6), -1 / sh.power), 1.45) * sh.scale, 0.6) * (1 + 0.02 * Math.cos(5 * phi + sh.p0 * 2) + 0.012 * Math.cos(9 * phi + sh.p0 * 5))
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
// Wet sand moulded by hand into one low mound (references/approved/summer-rest.png): a few broad swells, no two of one width or depth. Seen
// from the front they all run down to the right: near level off the left flank, steepest under the middle, easing toward the right flank;
// where two run close they run into each other. Where two swells meet there is a round hollow in soft shade, with a faint crease in it here and there. Over the swells
// the fingers have drawn the sand into ridges a few millimetres wide that lie on each other like shingles: each stands out at its lower edge
// and has a thin shade under it, no two are as wide or as deep, and each comes and goes along its run. Right of the middle the hand has
// dabbed more than drawn: there the ridges are short and wavy and the sand between them is pitted. The mesh holds the swells; the carve map
// holds the ridges, the creases, the pits and the crumbs. All of it parts round the things set in the sand as water parts round a stone.
const SWIRL = { apart: 9.5, slope: 0.52, most: 0.85, least: 0.12, crumb: 0.034, notch: 0.03, crest: 0.22, kink: 1.0, edge: 0.08, one: 5, under: 0.35, tail: 0.82, reach: 2.2 }
const RIDGE = { apart: 3.5, deep: 0.1, crest: 0.42, under: 1.6, over: 1.3, pit: 0.1, gouge: 0.03, crack: 0.006 }
// A roll of moulded sand in section, from the hollow under it (0) to the hollow over it (1): it stands out quickly to its crest and falls
// back slowly, and where it meets the next roll the hollow is round, so it lies in soft shade and draws no line.
const shelf = (x, crest) => (x < crest ? 0.5 - 0.5 * Math.cos((Math.PI * x) / crest) : 0.5 + 0.5 * Math.cos((Math.PI * (x - crest)) / (1 - crest)))
// A shelf of drawn sand in section, the same way up: under its lip it is cut back, steepest right under the lip, and over the lip its face
// falls back slowly. The lip is an edge, with its shade under it and the light on it; both hollows are round.
const ledge = (x, lip, back = 1.5) => (x < lip ? (x / lip) ** 2 : (1 - (x - lip) / (1 - lip)) ** back)
const frac = (v) => v - Math.floor(v)
// A roll of sand in section, from its foot up: under its crest it turns in at once and eases out to the foot, over the crest it is round
// and falls back to the next roll.
const roll = (x) => (x < RIDGE.crest ? (x / RIDGE.crest) ** RIDGE.under : 1 - ((x - RIDGE.crest) / (1 - RIDGE.crest)) ** RIDGE.over)
// The light on that roll, read down the columns of the approved over the shells: under a roll's edge the shade is deepest at once and
// fades down the face under it over nearly half of a roll, the face is lit for a third, and it turns into the next shade in a quarter. The
// dark is the deepest point of a shade and has no width of its own, so it never draws as a stroke.
const ROLL = { cusp: 0.3, turn: 0.24, fade: 0.46, lit: 0.2, deep: 1.0 }
const rollLit = (x) => {
  const up = frac(x - ROLL.cusp)
  if (up < ROLL.turn) return ROLL.lit - (ROLL.lit + ROLL.deep) * (1 - up / ROLL.turn) ** 1.5
  return ROLL.lit - (ROLL.lit + ROLL.deep) * clamp(1 - (1 - up) / ROLL.fade) ** 2
}
// The rolls are not one width all over the front (counted down columns of the approved): broadest in the middle over the shells, narrowest
// low on the front. What is handed out is how far a roll's line has been moved up the wall by it, in mm of the swirls' own measure.
const PITCH = { step: 0.25, mid: -0.26, low: 0.15 }
const PITCH_RUN = (() => {
  const mid = [0]
  const low = [0]
  for (let h = PITCH.step; h <= 64; h += PITCH.step) {
    mid.push(mid[mid.length - 1] + PITCH.step * smooth(19, 23, h) * smooth(36, 32, h))
    low.push(low[low.length - 1] + PITCH.step * smooth(2, 6, h) * smooth(19, 15, h))
  }
  return { mid, low }
})()
const runAt = (run, h) => {
  const x = clamp(h / PITCH.step, 0, run.length - 1.001)
  const i = Math.floor(x)
  return mix(run[i], run[i + 1], x - i)
}
const swirlLean = (az) => {
  const a = az - 360 * Math.round(az / 360)
  return 4 * smooth(-95, -45, a) + 5 * smooth(-45, -12, a) + 12 * smooth(-14, 24, a) + 8 * smooth(22, 60, a) - 29 * smooth(100, 175, a)
}
const swirlWander = (A, h) => 4.2 * (fbm(A * 4 + 1, h / 30, 4, 64, 139, 2) - 0.5) + 2.6 * (fbm(A * 9 + 2, h / 14, 9, 64, 141, 3) - 0.5)
function swirlCoord(m, az, s, h, r) {
  const A = (((az % 360) + 360) % 360) / 360
  const wander = swirlWander(A, h)
  let psi = h + swirlLean(az) + wander
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
    if (dist > 2.4 * R + 1) continue
    if (it.psi === undefined) it.psi = it.h + swirlLean(it.az) + swirlWander((((it.az % 360) + 360) % 360) / 360, it.h)
    const own = h + swirlLean(it.az + da) + wander
    psi -= 0.35 * (own - it.psi) * ((R * R) / (dist * dist + 0.3 * R * R)) * smooth(2.4 * R + 1, 1.2 * R, dist)
  }
  return psi
}
// The roll under the glass lies on the body as a ledge: from the left flank to the middle its lower edge is a step, high on the left and
// lower toward the middle. Read on the approved: left of the middle that edge is a soft turn. One chip stands on it, whose face comes
// to a point below the edge, and right of the chip a lump of sand lies along it and hangs lower still. From there to the middle the edge
// is torn. What is handed out is how far a place lies over that edge, in mm.
const lineAt = (pts, x) => {
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return mix(pts[i - 1][1], pts[i][1], clamp((x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])))
  return pts[pts.length - 1][1]
}
// How much of a closed outline covers a place. Each side of it has its own softness: from so far outside it to so far inside it, in mm.
const coverAt = (pts, a, h, k, soft) => {
  let odd = false
  let near = 9
  let side = 0
  let cover = 1
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0]
    const ay = pts[j][1]
    if (ay > h !== pts[i][1] > h && a < ax + ((h - ay) / (pts[i][1] - ay)) * (pts[i][0] - ax)) odd = !odd
    const ex = (pts[i][0] - ax) * k
    const ey = pts[i][1] - ay
    const t = clamp(((a - ax) * k * ex + (h - ay) * ey) / (ex * ex + ey * ey))
    const dist = Math.hypot((a - ax) * k - t * ex, h - ay - t * ey)
    const s = soft(j)
    cover = Math.min(cover, smooth(s[0], s[1], dist))
    if (dist < near) {
      near = dist
      side = j
    }
  }
  const s = soft(side)
  return odd ? cover : smooth(s[0], s[1], -near)
}
// How far a place lies from a line drawn through points, in mm, and how far along that line the nearest place on it is, from nothing to one.
const pathAt = (pts, a, h, k) => {
  let near = 9
  let along = 0
  for (let i = 1; i < pts.length; i++) {
    const ex = (pts[i][0] - pts[i - 1][0]) * k
    const ey = pts[i][1] - pts[i - 1][1]
    const t = clamp(((a - pts[i - 1][0]) * k * ex + (h - pts[i - 1][1]) * ey) / (ex * ex + ey * ey))
    const dist = Math.hypot((a - pts[i - 1][0]) * k - t * ex, h - pts[i - 1][1] - t * ey)
    if (dist < near) {
      near = dist
      along = (i - 1 + t) / (pts.length - 1)
    }
  }
  return { near, along }
}
const spotAt = (p, a, h, k) => Math.hypot((a - p[0]) * k, h - p[1])
// A heap of clods: how near a place lies to the gap round its own clod (mm), which clod that is, and where its middle lies from the place.
const clodAt = (a, h, k, size, seed) => {
  const u = (a * k) / size
  const v = h / size
  let d1 = 9
  let d2 = 9
  let one = 0
  let da = 0
  let dh = 0
  for (let j = Math.floor(v) - 1; j <= Math.floor(v) + 1; j++) {
    for (let i = Math.floor(u) - 1; i <= Math.floor(u) + 1; i++) {
      const du = i + 0.04 + 0.92 * hashInt(i, j, seed) - u
      const dv = j + 0.04 + 0.92 * hashInt(i, j, seed + 2) - v
      const dist = Math.hypot(du, dv)
      if (dist < d1) {
        d2 = d1
        d1 = dist
        one = hashInt(i, j, seed + 4)
        da = (du * size) / k
        dh = dv * size
      } else if (dist < d2) d2 = dist
    }
  }
  return { gap: (d2 - d1) * size, one, da, dh }
}
// Every outline here was read on the approved hero and carried to this base's own azimuths (degrees) and heights (mm) through a grid drawn
// on the base and rendered from the hero's camera, so that what is read at a pixel of the picture lies on the base within a pixel of it.
// The lower outline of the ledge and of what stands on it: the crumbled patch, the rim, the chip, the turn between, the lump and its tail.
const EDGE = [[-64, 37.95], [-54.21, 37.837], [-50.56, 37.635], [-49.55, 37.242], [-48.78, 36.858], [-48.1, 36.685], [-47.37, 36.43], [-46.95, 36.566], [-46.68, 36.863], [-45.82, 37.077], [-45.12, 37.306], [-44.46, 37.258], [-43.62, 37.137], [-42.83, 37.062], [-41.8, 36.963], [-40.79, 36.855], [-39.77, 36.718], [-38.95, 36.59], [-38.83, 37.17], [-37.79, 36.777], [-35.98, 36.088], [-35.83, 36.0], [-34.96, 35.947], [-34.53, 35.92], [-34.27, 36.064], [-34.1, 36.314], [-33.88, 36.483], [-33.42, 36.583], [-32.04, 36.671], [-31.51, 36.662], [-30.83, 36.662], [-30.04, 36.654], [-29.24, 36.617], [-28.24, 36.522], [-27.25, 36.424], [-26.29, 36.379], [-25.36, 36.372], [-24.75, 36.459], [-24.28, 36.427], [-23.55, 36.435], [-22.46, 36.43], [-21.61, 36.329], [-21.29, 36.006], [-20.91, 35.881], [-20.55, 35.868], [-20.16, 35.53], [-19.79, 35.39], [-19.43, 35.33], [-19.08, 35.3], [-18.74, 35.3], [-18.37, 35.0], [-18.01, 34.87], [-17.68, 34.9], [-17.36, 34.96], [-17.02, 35.13], [-16.69, 35.31], [-16.36, 35.4], [-16.02, 35.49], [-15.69, 35.58], [-15.37, 35.69], [-15.04, 35.79], [-14.71, 35.88], [-14.38, 36.014], [-14.29, 36.116], [-13.74, 36.272], [-13.08, 36.372], [-12.41, 36.331], [-11.51, 36.42], [-10.93, 36.473], [-10.28, 36.539]]
// The chip's face, round from its left corner over its top to its point and back: its top is soft, its lower left edge crisp.
const CHIP = [[-39.41, 37.394], [-39.56, 37.61], [-39.37, 37.85], [-39.08, 38.025], [-38.74, 38.19], [-38.13, 38.288], [-36.21, 38.4], [-35.59, 38.286], [-35.0, 38.198], [-34.5, 38.089], [-34.07, 38.074], [-33.58, 37.965], [-32.9, 37.868], [-32.4, 37.58], [-32.01, 37.326], [-31.51, 36.662], [-32.04, 36.671], [-33.42, 36.583], [-33.88, 36.483], [-34.1, 36.314], [-34.27, 36.064], [-34.53, 35.92], [-34.96, 35.947], [-35.83, 36.0], [-35.98, 36.088]]
const chipSoft = (j) => (j >= 1 && j <= 11 ? [-0.25, 0.7] : j >= 12 && j <= 14 ? [-0.1, 0.12] : j >= 18 && j <= 23 ? [-0.09, 0.09] : [-0.06, 0.06])
// What marks that face: a crack across it and a shorter one over that, one pit, and a dim tail of sand right of it.
const CHIP_CRACK = [[-37.08, 36.882], [-36.35, 36.751], [-35.84, 36.617], [-35.12, 36.652], [-34.53, 36.566]]
const CHIP_CRACK2 = [[-37.85, 37.222], [-37.05, 36.997]]
const CHIP_PIT = [-33.01, 36.902]
const CHIP_TAIL = [[-32.1, 37.376], [-30.9, 37.393]]
// From the chip's right corner one lit streak runs down the wall to the right.
const BAND = [[-31.72, 36.649], [-31.25, 36.497], [-30.96, 36.347], [-30.48, 36.083], [-30.19, 35.861], [-29.53, 35.632], [-29.02, 35.507]]
// The rim left of the chip, along its middle: thin at its left end, thick where it ends under the chip's corner.
const RIM = [[-45.26, 37.481], [-44.56, 37.393], [-43.75, 37.299], [-42.97, 37.244], [-41.96, 37.179], [-40.97, 37.111], [-39.97, 37.015], [-39.12, 36.907]]
// The crumbled patch the rim ends in, with one straight top.
const PATCH = [[-49.97, 38.182], [-47.46, 38.389], [-46.64, 38.208], [-45.75, 37.917], [-45.1, 37.594], [-45.14, 37.333], [-45.84, 37.104], [-46.7, 36.89], [-46.97, 36.579], [-47.37, 36.43], [-48.12, 36.712], [-49.16, 36.985], [-49.95, 37.571], [-50.13, 37.92]]
// The lump's cream body, round from its left toe over its top to its right end and back along its lower side.
const LUMP = [[-24.77, 36.541], [-24.39, 36.782], [-24.01, 36.995], [-23.86, 37.332], [-23.69, 37.614], [-23.32, 37.85], [-23.0, 37.973], [-22.66, 38.056], [-22.33, 38.166], [-21.99, 38.235], [-21.26, 38.252], [-20.43, 38.231], [-19.9, 38.008], [-19.51, 37.928], [-19.1, 37.768], [-18.67, 37.525], [-18.29, 37.43], [-17.98, 37.263], [-17.77, 37.134], [-17.39, 37.009], [-17.11, 36.909], [-16.75, 36.879], [-16.39, 36.781], [-16.01, 36.626], [-15.65, 36.512], [-15.29, 36.425], [-14.93, 36.323], [-14.58, 36.221], [-14.29, 36.116], [-14.38, 36.014], [-14.71, 35.88], [-15.04, 35.79], [-15.37, 35.69], [-15.69, 35.58], [-16.02, 35.49], [-16.36, 35.4], [-16.69, 35.31], [-17.02, 35.13], [-17.36, 34.96], [-17.68, 34.9], [-18.01, 34.87], [-18.37, 35.0], [-18.74, 35.3], [-19.08, 35.3], [-19.43, 35.33], [-19.79, 35.39], [-20.16, 35.53], [-20.55, 35.868], [-20.91, 35.881], [-21.29, 36.006], [-21.61, 36.329], [-22.46, 36.43], [-23.55, 36.435], [-24.28, 36.427]]
const lumpSoft = (j) => (j <= 4 ? [-0.08, 0.3] : j <= 27 ? [-0.08, 0.1] : j <= 49 ? [-0.07, 0.08] : [-0.05, 0.28])
// The crease that parts the roll at its foot from the body over it, the knobs of that roll, and two pits in the body.
const CREASE = [[-20.22, 35.97], [-19.5, 35.88], [-18.78, 35.68], [-18.09, 35.71], [-17.41, 35.76], [-16.75, 35.96], [-16.09, 36.12]]
const KNOBS = [[-19.9, 35.62], [-19.32, 35.5]]
const LUMP_PITS = [[-20.45, 36.893], [-20.74, 36.673]]
// Over the lump's right shoulder the sand slopes away from the sun and runs out to the right as a tail: dim, with one small ring on it.
const SLOPE = [[-20.5, 38.431], [-20.26, 38.522], [-19.53, 38.509], [-19.12, 38.363], [-18.03, 38.32], [-17.28, 38.197], [-16.89, 38.101], [-16.14, 37.936], [-15.73, 37.664], [-15.02, 37.63], [-14.64, 37.463], [-13.91, 37.264], [-13.56, 37.191], [-13.03, 37.066], [-12.49, 36.899], [-11.96, 36.69], [-11.0, 36.74], [-10.0, 36.8], [-9.3, 36.78], [-9.3, 36.62], [-10.28, 36.539], [-10.93, 36.473], [-11.51, 36.42], [-12.41, 36.331], [-13.08, 36.372], [-13.74, 36.272], [-14.29, 36.116], [-14.58, 36.221], [-14.93, 36.323], [-15.29, 36.425], [-15.65, 36.512], [-16.01, 36.626], [-16.39, 36.781], [-16.75, 36.879], [-17.11, 36.909], [-17.39, 37.009], [-17.77, 37.134], [-17.98, 37.263], [-18.29, 37.43], [-18.67, 37.525], [-19.1, 37.768], [-19.51, 37.928], [-19.9, 38.008], [-20.43, 38.231]]
const RING = [-15.26, 37.146]
// How much of the low sun the lump and the slope over it take toward their right end, by azimuth.
const LUMP_RIGHT = [[-19, 1], [-18, 0.82], [-17, 0.5], [-15.5, 0.42], [-14.3, 0.36]]
const ROLL_RIGHT = [[-16.5, 1], [-15.2, 0.92], [-14.6, 0.75], [-14.3, 0.5]]
const SLOPE_RIGHT = [[-15.5, 0.38], [-13.8, 0.33], [-12.2, 0.2], [-10.5, 0.1], [-9.3, 0]]
// Under that outline the wall is not dark, it is rust. By azimuth: how deep the red right under a crisp edge is and how far down it
// goes in mm; how much rust the sand under it holds and how far down that goes; and whether it holds that rust all the way down (under
// the rim, where it goes down to the wall's second line) or thins out. Under the turn between the chip and the lump the shade is brown.
const SHADE = [
  [-52, 0, 0.4, 0, 0.6, 0],
  [-47.5, 0, 0.4, 0.5, 1.2, 0],
  [-45.4, 0.9, 0.4, 0.5, 2.1, 1],
  [-38.95, 0.9, 0.4, 0.5, 2.3, 1],
  [-38.83, 1.5, 0.75, 0.6, 2.9, 1],
  [-37, 1.5, 0.75, 0.9, 2.6, 0],
  [-36, 1.5, 0.75, 0.9, 2.6, 0],
  [-34.6, 1.5, 0.75, 0.8, 2.4, 0],
  [-33.8, 0.5, 0.6, 0.55, 1.2, 0],
  [-32.5, 0.3, 0.6, 0.35, 1.3, 0],
  [-29.8, 0.3, 0.6, 0.35, 1.2, 0],
  [-28.4, 1.1, 0.8, 0.8, 1.6, 0],
  [-25, 1.2, 0.75, 0.8, 1.9, 0],
  [-22.5, 1.0, 0.75, 0.8, 1.9, 0],
  [-20, 0.95, 0.75, 0.8, 1.7, 0],
  [-16.5, 0.75, 0.6, 0.7, 1.5, 0],
  [-14.6, 0.5, 0.4, 0.3, 0.8, 0],
  [-12.5, 0, 0.4, 0, 0.8, 0],
]
const shadeAt = (x) => {
  for (let i = 1; i < SHADE.length; i++) {
    if (x > SHADE[i][0]) continue
    const t = clamp((x - SHADE[i - 1][0]) / (SHADE[i][0] - SHADE[i - 1][0]))
    return SHADE[i].map((v, c) => mix(SHADE[i - 1][c], v, t))
  }
  return SHADE[SHADE.length - 1]
}
// What the low sun's own light reads of the carve starts at this much of a face turned up.
const SPOT = 0.22
const crustOver = (A, a180, h, hTrue) => {
  const torn = 3.6 * (fbm(A * 46 + 1, 0.5, 46, 4, 191, 4) - 0.5) + 1.5 * (fbm(A * 110 + 7, 0.5, 110, 4, 205, 3) - 0.5)
  return mix(h - 34.0 + 0.093 * (clamp(a180, -58, -6) + 10) - torn, hTrue - lineAt(EDGE, a180), smooth(-64, -56, a180) * smooth(-13, -15.5, a180))
}
// Read on the approved: under the ledge the left wall is combed into shelves about a millimetre and a half high. Each ends below in a
// soft line of rust that falls toward the middle, a millimetre in six degrees; the face between two lines is pale, palest low on it.
// No two lines are one strength and each comes and goes along its length. Here the picture has lines, and they are the grooves themselves.
// The first line runs from the chip's point to under the lump and on; the second lies under the rim.
const WALL = { top: 39.2, fall: 0.16, apart: 1.58, deep: 0.02, lit: 0.3, half: 0.5, pale: 0.06 }
// How strong the second line is along its length: it comes in under the patch, is strongest under the rim and thins out under the chip.
const WALL_SECOND = [[-50, 0.2], [-48.7, 0.35], [-46.8, 0.6], [-44.8, 0.85], [-43, 1], [-39.4, 1], [-37.7, 0.7], [-36.1, 0.4], [-34, 0.3], [-32, 0]]
// Low on the left flank the sand is folded over itself: a lip, a deep crease under it and the foot's roll standing out below. How much of
// that fold there is at an azimuth.
const foldAt = (az) => {
  const a = az - 360 * Math.round(az / 360)
  return smooth(-27, -38, a) * smooth(-66, -52, a)
}
// The fold in section, by the height over its slot in mm: the lip stands out to an edge just over the slot and falls back slowly above it,
// the slot is narrow and deep, and under it the foot's roll stands out again.
const FOLD = { lip: 1.05, at: 1.4, under: 1.15, over: 5.0, slot: 0.25, half: 0.8, foot: 1.2, footAt: -3.2, footHalf: 2.6, footLow: 4.5 }
const foldForm = (x) => {
  const up = (x - FOLD.at) / (x < FOLD.at ? FOLD.under : FOLD.over)
  return FOLD.lip * Math.exp(-up * up) - FOLD.slot * Math.exp(-((x / FOLD.half) ** 2)) + FOLD.foot * Math.exp(-(((x - FOLD.footAt) / (x < FOLD.footAt ? FOLD.footLow : FOLD.footHalf)) ** 2))
}
// The broad swells of the mound, each a hand wide on the picture: where its middle is (degrees, mm up), its half widths and how far it stands out, in mm.
const BULGES = [
  { az: -64, h: 18.5, wide: 20, tall: 11, out: 1.9 },
  { az: -22, h: 10.0, wide: 19, tall: 8.5, out: 1.6 },
  { az: 26, h: 15.0, wide: 21, tall: 11, out: 1.9 },
  { az: 68, h: 11.5, wide: 21, tall: 10, out: 1.6 },
]
const bulgeAt = (a180, h) => {
  let out = 0
  for (const b of BULGES) out += b.out * Math.exp(-(((a180 - b.az) / b.wide) ** 2) - ((h - b.h) / b.tall) ** 2)
  return out
}
// The warm stain low on the body wanders round it and lies in that crease: its height in mm.
const stainH = (az) => {
  const a = az - 360 * Math.round(az / 360)
  return mix(5.2 + 1.6 * Math.sin((az * 3 + 20) * RAD), 10.5 - 0.036 * (a + 48), smooth(-12, -34, a) * smooth(-116, -86, a))
}
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
  const fade = smooth(0.0, 1.6, s) * smooth(m.total, m.total - 1.5, s)
  const swell = 1.9 * (fbm(A * 5 + 1, h / 16, 5, 64, 11, 3) - 0.5) + 0.9 * (fbm(A * 9 + 3, h / 11, 9, 64, 15, 3) - 0.5)
  const ripple = 0.2 * (fbm(A * 19 + 7, h / 5.5, 19, 64, 13, 2) - 0.5) + 0.12 * (fbm(A * 40 + 11, h / 3.5, 40, 64, 17, 3) - 0.5)
  // The shoulder under the glass is one wide round roll with no neck under it. Where the sand falls over it on the right it stands
  // out as far as it did, so the falling sand still leaves the stone and not the air.
  const hold = smooth(34, 74, a180) * smooth(128, 114, a180) * (0.72 * smooth(25, 34, q.h) * smooth(47.3, 48.9, q.r) + 1.5 * Math.exp(-(((q.h - 38.6) / 2.2) ** 2) - ((q.r - 51.6) / 2.0) ** 2))
  const lumps = 0.3 * (fbm(A * 23 + 4, q.h / 9, 23, 64, 99, 3) - 0.5) * smooth(31, 37, q.h) * smooth(47.3, 49.2, q.r)
  // Right of the middle the hand has dabbed the sand more than drawn it: low lumps between the swirls.
  const dabbed = smooth(6, 30, a180) * smooth(100, 70, a180)
  const dabs = 1.5 * (1 + 0.6 * smooth(40, 70, a180)) * (fbm(A * 30 + 2, h / 6 + 1, 30, 64, 163, 3) - 0.5) * smooth(4, 28, a180) * smooth(125, 95, a180) * smooth(3, 8, q.h) * (1 - 0.6 * onTop)
  const psi = swirlCoord(m, az, s, h, q.r)
  const body = mix(1, 0.6, smooth(68, 95, Math.abs(a180))) * smooth(1.2, 5.5, q.h) * mix(0.3, 1, smooth(40.5, 34, h))
  const live = 0.35 + 0.65 * smooth(0.3, 0.62, fbm(A * 5 + 9, h / 20 + 3, 5, 64, 147, 2))
  const p1 = 2 * Math.PI * fbm(A * 3 + 2, 0.5, 3, 4, 151, 2)
  const p2 = 2 * Math.PI * fbm(A * 5 + 4, 0.5, 5, 4, 153, 2)
  const l1 = 1.6 * SWIRL.apart
  const l2 = 0.85 * SWIRL.apart
  const t1 = psi / SWIRL.apart + 0.62 * Math.sin(psi / l1 + p1) + 0.3 * Math.sin(psi / l2 + p2)
  const rate = 1 / SWIRL.apart + (0.62 / l1) * Math.cos(psi / l1 + p1) + (0.3 / l2) * Math.cos(psi / l2 + p2)
  // Where two swirls run into each other one broad one goes on.
  const pair = smooth(0.42, 0.66, fbm(A * 6 + 7, h / 22 + 1, 6, 64, 157, 2))
  const wave = mix(2 * shelf(frac(t1), SWIRL.crest) - 1, 2 * shelf(frac(0.5 * t1 + 0.0955), SWIRL.crest) - 1, pair)
  const across = (1 + pair) / rate
  const deep = clamp((SWIRL.slope * across) / (2 * Math.PI), SWIRL.least, SWIRL.most) * (0.72 + 0.28 * Math.sin(2 * Math.PI * 0.38 * t1 + 1.1))
  const held = smooth(3.2, 5.0, across)
  // Where the hand dabbed, a swirl does not run on: it is there for a finger's width and gone for the next.
  const stroke = 0.15 + 0.85 * smooth(0.34, 0.6, fbm(A * 44 + 13, h / 5 + 5, 44, 64, 247, 2))
  const drawn = deep * live * body * mix(0.3, 1, smooth(-40, -8, a180)) * mix(1, 0.65 * stroke * mix(1, 0.35, smooth(16, 32, a180)), dabbed)
  const swirl = drawn * wave
  // The mesh holds a swirl as a round swell. What makes its crest an edge is narrower than the mesh's cells, so the carve map holds it.
  // Low on the front the hand has patted the sand: there an edge runs a finger's width and ends. On the sunlit left the swirls stay round.
  // On the right flank the edge is gone: a piece of it alone on smooth sand draws as a hair.
  const patted = smooth(17, 12, h) * smooth(-34, -24, a180) * smooth(30, 10, a180)
  const kink = SWIRL.kink * drawn * (mix(2 * ledge(frac(t1), SWIRL.edge, 1) - 1, 2 * ledge(frac(0.5 * t1 + 0.0955), SWIRL.edge, 1) - 1, pair) - wave) * smooth(-20, -13, a180) * smooth(50, 36, a180) * mix(1, (stroke - 0.15) / 0.85, patted) * (Math.floor(t1) === SWIRL.one ? 1 : 0)
  // Under the one edge the shade does not end with the cut: it fades down the sand below it, over two millimetres on the approved left
  // of the middle and over half of that right of it.
  const below = (SWIRL.one - t1) / rate
  const cut = clamp(drawn / 0.4) * smooth(-20, -13, a180) * smooth(24, 14, a180) * mix(1, (stroke - 0.15) / 0.85, patted) * (1 - pair)
  const thin = smooth(-8, 2, a180)
  const tail = below > 0 ? -SWIRL.tail * cut * mix(1, 0.6, thin) * clamp(1 - below / mix(SWIRL.reach, 0.9, thin)) : 0
  // The first roll under that edge lies clear of its shade, and right of the middle the top of the ledge over it is one clean face.
  const clear = below > 0 ? 1 - cut * smooth(3.4, 1.4, below) : 1 - cut * smooth(-4, 2, a180) * smooth(-4.4, -3.4, below)
  // The crease at the bottom of a hollow: there on one stretch, gone on the next.
  const sharp = smooth(0.34, 0.6, fbm(A * 7 + 11, h / 9 + 2, 7, 64, 203, 2))
  const notch = SWIRL.notch * smooth(-0.6, -1, wave) ** 2 * sharp * live * clamp(deep / 0.3, 0.4, 1) * mix(1, 0.25, dabbed)
  const over = crustOver(A, a180, h, q.h)
  const flake = 0.25 + 0.75 * smooth(0.32, 0.62, fbm(A * 30 + 3, 0.5, 30, 4, 197, 2))
  // Read on the approved: left of the middle the ledge is one even strip of fine sand, and its edge is a soft turn with no line under it.
  // The low sun falls on what stands on that edge and on nothing round it: a chip, a rim left of it that ends in a crumbled patch, and
  // a lump right of it. All of it is sand: gritty, pitted, soft where it runs into the ledge, and orange where it takes less of the sun.
  const stepOn = smooth(-52, -47, a180) * smooth(-13.5, -17, a180)
  const kx = RAD * q.r
  const set = a180 > -51 && a180 < -8.4 && q.h > 34.4 && q.h < 39.2
  const grit2 = set ? fbm(A * 1700 + 3, q.h / 0.2 + 1, 1700, 256, 359, 2) : 0.5
  const pitted = 1 - 0.42 * smooth(0.5, 0.72, grit2)
  // The chip: a flake with a lit face, a crack across it and a crisp lower edge that runs down to its point. Its right end is broken up.
  const chip = set && a180 < -31 ? coverAt(CHIP, a180, q.h, kx, chipSoft) : 0
  const chipCrack = chip > 0 ? Math.max(smooth(0.22, 0.07, pathAt(CHIP_CRACK, a180, q.h, kx).near), 0.5 * smooth(0.16, 0.05, pathAt(CHIP_CRACK2, a180, q.h, kx).near)) : 0
  const chipFace = 0.97 * mix(1, pitted, 0.5) * (1 - 0.3 * chipCrack) * (1 - 0.5 * smooth(0.24, 0.08, spotAt(CHIP_PIT, a180, q.h, kx))) * mix(1, 0.35 + 0.65 * smooth(0.36, 0.56, fbm(A * 700 + 5, q.h / 0.45 + 2, 700, 128, 365, 2)), smooth(-33.0, -32.1, a180))
  const tailAt = set && a180 > -33 && a180 < -30 ? pathAt(CHIP_TAIL, a180, q.h, kx) : { near: 9, along: 0 }
  const chipTail = 0.46 * smooth(0.2, 0.06, tailAt.near) * mix(1, 0.5, tailAt.along)
  // The streak from the chip's right corner down the wall: bright where it leaves the chip, orange where it ends.
  const bandAt = set && a180 > -32.6 && a180 < -28.2 ? pathAt(BAND, a180, q.h, kx) : { near: 9, along: 0 }
  const band = smooth(0.21, 0.07, bandAt.near) * mix(0.72, 0.4, bandAt.along) * smooth(1, 0.8, bandAt.along)
  // The rim is thicker and paler toward the chip and ends under the chip's left corner with a gap of shade between them.
  const rimAt = set && a180 > -46.2 && a180 < -38.5 ? pathAt(RIM, a180, q.h, kx) : { near: 9, along: 0 }
  const rimHalf = mix(0.12, 0.33, rimAt.along)
  const rimOn = smooth(rimHalf + 0.08, rimHalf - 0.08, rimAt.near) * smooth(-38.95, -39.2, a180)
  const rim = rimOn * (mix(0.5, 0.62, smooth(0, 0.6, rimAt.along)) + 0.36 * smooth(0.7, 0.95, rimAt.along) + 0.16 * (fbm(A * 380 + 2, 0.5, 380, 4, 351, 2) - 0.5))
  // Left of the rim the edge is a patch of crumbs, each lit on its top.
  const patchOn = set && a180 < -44.5 ? coverAt(PATCH, a180, q.h, kx, () => [-0.08, 0.08]) : 0
  const crumbled = patchOn * mix(0.12, 0.44, smooth(0.4, 0.6, fbm(A * 620 + 4, q.h / 0.42 + 2, 620, 128, 361, 2))) * (0.85 + 0.3 * grit2)
  // The lump is a heap of clods. Its top is cream; lower down it takes less of the sun, and one crease parts the knobbed roll at its
  // foot from the body over it. Its left flank and the left of its lower side run out soft, and both its ends are dimmer.
  // No two clods are one size or one shape, and only here and there does a gap between two of them go deep.
  const cell = set && a180 > -25.8 ? clodAt(a180 + (1.3 * (fbm(A * 280 + 3, q.h / 1.1 + 2, 280, 64, 371, 2) - 0.5)) / kx, q.h + 1.3 * (fbm(A * 280 + 8, q.h / 1.1 + 6, 280, 64, 373, 2) - 0.5), kx, 0.52, 357) : { gap: 1, one: 0.5, da: 0, dh: 0 }
  const parted = set ? smooth(0.36, 0.62, fbm(A * 420 + 5, q.h / 0.7 + 3, 420, 128, 375, 2)) : 0
  const lumpBody = set && a180 > -25.6 ? coverAt(LUMP, a180 - 0.6 * cell.da, q.h - 0.6 * cell.dh, kx, lumpSoft) : 0
  const lumpOver = q.h - lineAt(EDGE, a180)
  const creased = smooth(-20.6, -20.0, a180) * smooth(-15.9, -16.5, a180)
  const rollTop = lumpBody > 0 ? mix(lineAt(EDGE, a180), lineAt(CREASE, a180), creased) : 0
  let knob = 0
  if (lumpBody > 0) for (const p of KNOBS) knob = Math.max(knob, smooth(0.42, 0.1, spotAt(p, a180, q.h, kx)))
  const creaseAt = lumpBody > 0 ? pathAt(CREASE, a180, q.h, kx).near : 9
  const lumpPit = lumpBody > 0 ? Math.max(smooth(0.2, 0.06, spotAt(LUMP_PITS[0], a180, q.h, kx)), smooth(0.2, 0.06, spotAt(LUMP_PITS[1], a180, q.h, kx))) : 0
  const lumpLow = mix(0.75, 0.3, smooth(-21.5, -20, a180))
  // Right of its two knobs the roll at the foot is lit along its whole length, a little less toward its right end.
  const footOn = smooth(-18.7, -18.2, a180) * smooth(-14.3, -14.9, a180)
  const footLit = 0.92 * footOn * smooth(0, 0.1, lumpOver) * smooth(0.62, 0.42, lumpOver) * lineAt(ROLL_RIGHT, a180)
  // Between two clods the sand lies in a gap, deeper low on the heap, and each clod's own lower right is turned from the sun.
  const clodLit = (1 - mix(0.5, 0.78, smooth(1.4, 0.5, lumpOver)) * mix(0.15, 1, parted) * smooth(0.14, 0.03, cell.gap)) * (1 - 0.15 * smooth(0, 0.5, (0.8 * cell.dh - 0.6 * cell.da * kx) / 0.52))
  const lumpFace = Math.max(q.h > rollTop ? mix(lumpLow, 0.96, smooth(0.1, 0.6, q.h - rollTop)) * lineAt(LUMP_RIGHT, a180) : mix(0.26, 0.94, Math.max(knob, footOn)), footLit) * (1 - 0.86 * creased * smooth(0.17, 0.04, creaseAt)) * (1 - 0.4 * lumpPit) * mix(1, pitted, 0.6) * clodLit * mix(0.55, 1, smooth(-24.7, -23.5, a180))
  const lump = lumpBody * lumpFace
  // Over its right shoulder the sand slopes away from the sun, hatched along the top, and runs on to the right as a tail.
  const slopeOn = set && a180 > -21 ? coverAt(SLOPE, a180, q.h, kx, () => [-0.1, 0.22]) : 0
  const slope = slopeOn * lineAt(SLOPE_RIGHT, a180) * (1 + 0.14 * Math.sin((2 * Math.PI * a180) / 0.66 + 5 * fbm(A * 160 + 9, q.h / 2 + 3, 160, 64, 369, 2))) * (0.8 + 0.4 * grit2)
  const ring = 0.5 * smooth(0.13, 0.04, Math.abs(spotAt(RING, a180, q.h, kx) - 0.3))
  // The chip's face stands out most at its lower edge and is cut back under it; the lump is thickest low down, every clod of it a round back.
  const chipU = q.h - lineAt(EDGE, a180)
  const crust = 0.1 * smooth(-0.9, 0.1, over) * stepOn + 0.16 * chip * smooth(1.6, 0, chipU) - 0.05 * chip * chipCrack + 0.3 * lumpBody * (1 - 0.6 * creased * smooth(0.2, 0.05, creaseAt)) * (0.72 + 0.28 * mix(0.3, 1, parted) * smooth(0, 0.25, cell.gap)) * (0.85 + 0.3 * cell.one) * mix(0.6, 1, smooth(1.2, 0, lumpOver)) + 0.08 * Math.max(rim, crumbled)
  // Under that outline the wall keeps its light and turns to rust: deep red right under a crisp edge, thinner further down.
  const under = lumpOver
  const shade = under < 0 && under > -3.6 && a180 > -52 && a180 < -12.5 ? shadeAt(a180) : [0, 0, 1, 0, 1, 0]
  const streaked = Math.max(band, chipTail)
  const deepRed = shade[1] * smooth(shade[2], 0.4 * shade[2], -under)
  const far = -under / shade[4]
  const rustHeld = mix(1, 0.7, clamp(far)) * smooth(1.12, 0.95, far)
  const rusted = under < 0 ? Math.max(deepRed, shade[3] * mix(smooth(1, 0.25, far), rustHeld, shade[5])) * (1 - streaked) : 0
  // Only under the rim does the sand turn under toward the wall's second line and lose light on the way down.
  const edgeShade = under < 0 ? -(0.08 * Math.min(deepRed, 1) + 0.05 * shade[5] * smooth(0.25, 0.9, far) * smooth(1.15, 0.95, far)) * (1 - streaked) : 0
  // Right of the lump the face under the outline is turned up, and the low sun's own light would read it: there it is held under that.
  const kept = under < 0 ? 0.45 * smooth(-18.2, -16.8, a180) * smooth(-8.4, -9.4, a180) * smooth(0.05, -0.2, under) * smooth(-3.2, -2.4, under) : 0
  // Left of that, under the lump and its toe, the wall lies in the ledge's own shade: no face in it takes the light, whichever way it is turned.
  const laid = under < 0 ? smooth(-29.2, -28.2, a180) * smooth(-17.2, -18.2, a180) * smooth(-0.05, -0.3, under) * smooth(-3.0, -2.2, under) * (1 - streaked) : 0
  const laidAt = -0.05 * smooth(-27.5, -24.5, a180)
  // Right under the lump's left end the wall takes light all the same: there that shade is laid on the sand's own tone as well.
  const laidTone = under < 0 ? 0.55 * smooth(-26.8, -24.0, a180) * smooth(-19.8, -21.4, a180) * smooth(-0.1, -0.45, under) * smooth(-1.5, -0.95, under) : 0
  // The rim, the crumbled patch, the chip's cracks and the lump's dimmer sand are rust in the grain too.
  const tinted = Math.max(0.5 * rimOn, 0.2 * patchOn, 0.7 * chip * chipCrack, 0.55 * lumpBody * Math.max(smooth(0.9, 0.5, lumpFace), 0.75 * smooth(-20.5, -17.5, a180)), 0.5 * slopeOn * (1 - lumpBody))
  // How much of the low sun each of them takes: the chip and the lump's top nearly all of it, the rim and the lump's foot about half.
  const spotLit = (v) => SPOT * smooth(0, 0.08, v) + (1 - SPOT) * v
  const lipLeft = Math.max(spotLit(Math.max(chip * chipFace, chipTail, band, rim, crumbled, lump, slope * (1 - lumpBody), ring * (1 - lumpBody))), 0.06 * stepOn * smooth(-0.1, 0.3, over) * smooth(39.6, 38.9, q.h))
  // From there to the middle the sun lies on the face of the roll above the ledge.
  const lipRight = smooth(-1, 1, over) * smooth(4.6, 0.6, over + 2.2 * (fbm(A * 50 + 9, h / 3, 50, 64, 207, 3) - 0.5)) * 0.6 * smooth(-5, -16, a180) * (0.3 + 0.7 * flake)
  // As far as the low sun's own light reaches, the roll's lit face stays under what that light reads.
  const lip = Math.max(lipLeft * smooth(-8.6, -9.6, a180), lipRight * smooth(-16.5, -14, a180) * mix(0.36, 1, smooth(-10.2, -8.6, a180)))
  // The trough above the foot is a real crease: the foot's roll stands out under it.
  const gh = stainH(az)
  const fold = foldAt(az)
  const crease = -0.4 * (1 - fold) * mix(1, 0.5, smooth(0, 30, a180)) * Math.exp(-(((q.h - gh) / 2.3) ** 2)) * (0.55 + 0.45 * fbm(A * 12 + 3, 0.5, 12, 4, 167, 2)) + fold * (0.8 + 0.4 * fbm(A * 16 + 5, 0.5, 16, 4, 171, 2)) * foldForm(q.h - gh)
  const bulge = bulgeAt(a180, q.h) * smooth(1.5, 6, q.h) * smooth(34, 27, q.h) * fade
  const form = crease * fade + bulge
  // Loose sand lies on the top of the roll up to the glass, thicker right of the middle, and ends over the roll's shoulder in a soft edge.
  const driftEdge = 38.6 - 2.2 * smooth(6, 30, a180) * smooth(100, 70, a180) + 1.4 * (fbm(A * 40 + 5, 0.5, 40, 4, 193, 3) - 0.5)
  const drift = smooth(driftEdge - 0.9, driftEdge + 0.9, q.h)
  const heap = drift * (0.28 + 0.3 * smooth(6, 30, a180) * smooth(100, 70, a180) + 0.5 * (fbm(A * 90 + 2, q.r / 2.4, 90, 64, 195, 3) - 0.5))
  // Over the roll's top the height stands still: the run inward carries the grain on, or it draws there as ribs.
  const grit = fbm(A * 560 + 3, (h + Math.max(0, 52.6 - q.r)) / 0.62 + 1, 560, 128, 181, 2) - 0.5
  const underLedge = mix(1, smooth(-0.2, -1.5, over), smooth(-62, -52, a180) * smooth(-4, -14, a180)) * smooth(35.5, 33, h)
  const dab = Math.max(dabbed, patted)
  // No roll runs true: each wanders a little off its line, so two neighbours close up here and part there.
  const mid = smooth(-26, -12, a180) * smooth(26, 12, a180)
  const rpsi = psi + 1.5 * dab * (fbm(A * 70 + 3, h / 2.6 + 2, 70, 64, 215, 2) - 0.5) + 0.5 * (fbm(A * 52 + 9, h / 4 + 6, 52, 64, 271, 2) - 0.5) + 1.4 * smooth(-30, -14, a180) * (fbm(A * 30 + 4, h / 7 + 3, 30, 64, 317, 2) - 0.5) + PITCH.mid * mid * runAt(PITCH_RUN.mid, h) + PITCH.low * runAt(PITCH_RUN.low, h)
  const rp = rpsi / RIDGE.apart + 0.4 * Math.sin(rpsi / 6.1 + p1) + 0.15 * Math.sin(rpsi / 2.9 + p2 + 12 * Math.PI * A)
  const rk = Math.floor(rp)
  // Nor is the shade under a roll as wide on one stretch as on the next, or under one roll as under its neighbour.
  const rx = (rp - rk) ** mix(0.8, 1.3, clamp(0.5 * hashInt(rk, 5, 273) + fbm(A * 24 + 0.53 * rk, 0.29 * rk + 0.5, 24, 64, 275, 2) - 0.25))
  // Where the hand patted, a roll is a short piece with two ends, and no two pieces are one length.
  const rRun = mix(smooth(0.14, 0.46, mix(fbm(A * 18 + 0.37 * rk, 0.61 * rk + 0.5, 18, 64, 219, 2), fbm(A * 46 + 0.37 * rk, 0.61 * rk + 0.5, 46, 64, 231, 2), dab)), smooth(0.4, 0.62, fbm(A * 46 + 0.37 * rk, 0.61 * rk + 0.5, 46, 64, 263, 2)), patted)
  // The comb lies under the ledge and, toward the middle, under the one edge.
  const wp = (WALL.top - WALL.fall * (a180 + 60) - q.h + 0.3 * (fbm(A * 22 + 3, h / 9 + 1, 22, 64, 331, 2) - 0.5) + 0.12 * (fbm(A * 60 + 5, h / 4 + 2, 60, 64, 333, 2) - 0.5)) / WALL.apart
  const wk = Math.round(wp)
  const combOn = smooth(-12, -19, a180) * smooth(-92, -78, a180) * smooth(25.5, 27, h) * mix(smooth(37.8, 36.6, h), smooth(-0.1, -0.8, over), smooth(-62, -52, a180)) * mix(1, below > 0 ? smooth(0.2, 1.0, below) : 0, smooth(-20, -13, a180))
  const wallRead = wk === 0 ? 0.6 * smooth(-35, -33.5, a180) * smooth(-10, -13, a180) : wk === 1 ? lineAt(WALL_SECOND, a180) : wk === 3 ? 0.5 * smooth(-50.5, -48.5, a180) * smooth(-37.5, -40, a180) : 0
  const wallLine = Math.max(0.5 * (0.55 + 0.45 * hashInt(wk, 9, 335)) * (0.2 + 0.8 * smooth(0.3, 0.62, fbm(A * 16 + 0.41 * wk, 0.37 * wk + 0.5, 16, 64, 337, 2))) * (wk === 2 ? 1 - smooth(-51, -49.5, a180) * smooth(-35, -36.5, a180) : 1), wallRead)
  // Where the wall under the outline is rust the lines begin where that rust thins out.
  const rut = combOn * mix(1, smooth(0.6, 1, far), clamp(shade[3] / 0.35)) * wallLine * smooth(WALL.half, 0, Math.abs(wp - wk))
  const wf = wp - Math.floor(wp)
  const wallPale = WALL.pale * combOn * smooth(0.25, 0.6, wf) * smooth(0.97, 0.72, wf) * (1 - clamp(rusted))
  const comb = -WALL.deep * rut
  // Low on the wall the stone's own light reads the carve at four tenths: above that line a groove is laid down that much fainter.
  const wallX = q.r * Math.sin(a180 * RAD)
  const combLit = -WALL.lit * rut * mix(0.4, 1, smooth(-20, -38, wallX) * smooth(0.3, -1.2, q.h - 32.2 + 0.094 * wallX))
  const rOn = Math.max(smooth(-40, -20, a180) * smooth(44, 22, a180) * mix(0.7, 1, smooth(9, 15, h)) * smooth(2.5, 6, h), smooth(5, 9, h)) * underLedge * mix(0.5, 1, Math.max(smooth(-45, -22, a180), smooth(20, 24, h))) * (1 - combOn)
  // Right of the middle, where the hand dabbed, most of the sand is smooth: one roll in three stands, and stands lower.
  const rFew = mix(1, 0.75 * smooth(0.62, 0.74, hashInt(rk, 7, 279)), smooth(14, 24, a180))
  const rAmp = (0.7 + 0.3 * hashInt(rk, 3, 217)) * rRun * mix(mix(0.6, 0.9, mid * smooth(17, 22, h)), 1.1, smooth(0.3, 0.6, fbm(A * 34 + 0.71 * rk, 0.43 * rk + 0.5, 34, 64, 277, 2))) * rOn * rFew * mix(0.72, 1, smooth(-48, -26, a180))
  const ridge = RIDGE.deep * rAmp * roll(rx)
  // A roll that stands at all has its facet whole; how deep the shade under it lies goes with how far it stands out.
  const lit = rollLit(rx)
  const litOn = clamp(rAmp / 0.4) * mix(0.6, 1, smooth(-34, -22, a180) * smooth(50, 38, a180))
  const rollOn = lit < 0 ? rAmp * mix(0.9, 1, mid * smooth(17, 22, h)) : litOn
  // Low on the front, where a roll is a short ledge, its lip takes the light from above and stands pale against the sand round it.
  const rLip = 0.75 * patted * smooth(RIDGE.crest, 0.47, rx) * smooth(1.0, 0.6, rx)
  // Two ledges stand longer and paler than the rest, read on the approved hero: one under the cockle (x 955 to 1028, y 937 to 961), in two
  // pieces, and one over the edge right of the middle (x 980 to 1045, y 777 to 800). Their tops take the sky, their shade is rust.
  const su = h - (12.2 - 0.03 * (a180 - 4) + 0.9 * (fbm(A * 36 + 5, 0.5, 36, 4, 299, 2) - 0.5))
  const sOn = (smooth(-2.2, -0.6, a180) * smooth(3.3, 2.1, a180) + smooth(4.8, 6.0, a180) * smooth(9.8, 8.2, a180)) * (0.6 + 0.4 * fbm(A * 50 + 2, 0.5, 50, 4, 301, 2))
  const sv = h - (35.5 - 0.05 * (a180 - 0.7) - 0.011 * (a180 - 0.7) ** 2 + 0.5 * (fbm(A * 40 + 8, 0.5, 40, 4, 303, 2) - 0.5))
  const sUp = smooth(2.0, 5.0, a180) * smooth(15, 11.5, a180) * (0.8 + 0.2 * fbm(A * 50 + 6, 0.5, 50, 4, 305, 2))
  const shelfLit = sOn * (0.8 * smooth(-0.1, 0.5, su) * smooth(2.4, 0.7, su) - 0.7 * smooth(-1.7, -0.3, su) * smooth(0.15, -0.15, su)) + sUp * (smooth(-0.05, 0.15, sv) * smooth(1.7, 0.6, sv) - smooth(-1.0, -0.25, sv) * smooth(0.1, -0.1, sv))
  // A pit where a grain or two fell out, a crumb where a few stand proud: each in its own cell, most where the hand dabbed.
  const pu = A * 232
  const pv = h / 1.55
  const pi = Math.floor(pu)
  const pj = Math.floor(pv)
  const pr = 0.2 + 0.25 * hashInt(pi, pj, 227)
  const pd = Math.hypot((pu - pi - 0.5 - 0.44 * (hashInt(pi, pj, 223) - 0.5)) * ((2 * Math.PI * q.r) / 232), (pv - pj - 0.5 - 0.44 * (hashInt(pi, pj, 225) - 0.5)) * 1.55)
  const pOne = hashInt(pi, pj, 221)
  const pit = RIDGE.pit * smooth(pr, 0.35 * pr, pd) * (pOne < 0.16 ? -1 : pOne < 0.28 ? 0.7 : 0) * smooth(0.32, 0.58, fbm(A * 26 + 5, h / 5 + 3, 26, 64, 229, 2)) * (0.3 + 0.7 * dabbed) * underLedge * smooth(3, 7, q.h)
  // Where it dabbed, the hand also left short bent gouges, each a few millimetres long and none like the next: the lines where a slow noise crosses its middle.
  const gn = fbm(A * 44 + 7, h / 8 + 3, 44, 64, 233, 2)
  const gouge = -RIDGE.gouge * smooth(0.07, 0, Math.abs(gn - 0.5)) * smooth(0.4, 0.6, fbm(A * 12 + 1, h / 14 + 5, 12, 64, 235, 2)) * smooth(0.5, 0.62, fbm(A * 70 + 3, h / 4 + 9, 70, 64, 297, 2)) * dabbed * underLedge * smooth(3, 7, q.h)
  // High on the right a finger tip left a few marks, each a comma a millimetre or two long that slants down to the right, with its shade in it.
  const cu = A * 44
  const cv = h / 4.4
  const ci = Math.floor(cu)
  const cj = Math.floor(cv)
  const cx = (cu - ci - 0.5 - 0.5 * (hashInt(ci, cj, 287) - 0.5)) * ((2 * Math.PI * q.r) / 44)
  const cy = (cv - cj - 0.5 - 0.5 * (hashInt(ci, cj, 289) - 0.5)) * 4.4
  const ct = 0.3 + 0.4 * hashInt(ci, cj, 291)
  const cl = (cx - ct * cy) / Math.hypot(1, ct)
  const ch = 0.8 + 0.9 * hashInt(ci, cj, 293)
  const cw = 0.3 + 0.22 * hashInt(ci, cj, 295)
  const ca = (cx * ct + cy) / Math.hypot(1, ct) + 0.5 * cw * (cl / ch) ** 2
  const comma = (hashInt(ci, cj, 285) < 0.4 ? 1 : 0) * smooth(1, 0.35, Math.abs(cl) / ch) * smooth(cw, 0.25 * cw, Math.abs(ca)) * smooth(16, 28, a180) * smooth(100, 84, a180) * smooth(9, 14, h) * smooth(36.5, 33, h) * underLedge
  // Where the sand was pressed it has parted in thin creases, each short, bent and unlike the next.
  const cn = fbm(A * 26 + 3, h / 11 + 7, 26, 64, 241, 3)
  const crack = -RIDGE.crack * smooth(0.04, 0.008, Math.abs(cn - 0.5)) * smooth(0.4, 0.56, fbm(A * 9 + 5, h / 18 + 1, 9, 64, 243, 2)) * smooth(8, 30, a180) * smooth(125, 100, a180) * underLedge * smooth(3, 7, q.h)
  // Crumbs: grain scale roughness, most on the side of a swell that is turned up and on the loose sand.
  const crumbs = Math.max(0.35 + 0.65 * smooth(-0.2, 0.5, wave * live * body), 1.5 * drift) * fade
  const crumb = SWIRL.crumb * 2.4 * grit * crumbs
  const small = (ridge + pit + gouge + crack - notch * (1 - patted) + comb - 0.05 * comma) * body * fade + crumb
  // The crust's torn step is narrower than the mesh's cells: the carve map holds it, or the mesh draws it as a saw.
  const drawnOut = mix(1, 0.35, patted)
  const fine = (swirl * (1 - held) + kink * drawnOut + crust) * fade + small
  const d = ((swell + ripple) * (1 - 0.55 * onTop) + swirl * held + hold + lumps + dabs + heap) * fade + form
  // What the light from above reads: every part of the relief that makes a face turned up or down. Left of the middle the ledge's edge
  // is left out of it: its light and its shade are laid down as they were read.
  // Of the swirls only the one edge is read as a ledge: the others are swells under the rolls, and the rolls carry the light.
  const edged = smooth(SWIRL.one - 0.45, SWIRL.one - 0.15, t1) * smooth(SWIRL.one + 0.95, SWIRL.one + 0.6, t1) * smooth(24, 14, a180) * smooth(-20, -13, a180)
  // The rolls are left out of it: their light is laid down as it was read, and their form is in the normal. The dabs are low and
  // round: the mesh carries them, and here they count for less than half, or every one of them draws a streak of shade.
  const rel = ((swirl * mix(SWIRL.under * mix(1, 0.3, smooth(12, 26, a180)), 1, edged) * mix(1, stroke, patted) + kink) * drawnOut + 0.15 * dabs + crust * (1 - smooth(-64, -56, a180) * smooth(-13, -15.5, a180)) + crease - ridge * body) * fade + small - crumb - comb * body * fade
  return { d, fine, rel, roll: ((mix(ROLL.lit * litOn, rollOn * lit, clear) + rAmp * rLip * clear + combLit) * body + tail - 0.42 * comma + shelfLit + edgeShade - kept) * fade, laid: laid * fade, laidAt, laidTone: laidTone * fade, form, bulge, lip: lip * fade, rut: (Math.max(rut * body, rusted, tinted) - wallPale * body) * fade, grain: 2 * grit * Math.min(crumbs, 1), drift, w, k, f, q, onTop, gh }
}
export function relief(m, az, s) {
  const b = bare(m, az, s)
  const q = b.q
  let d = b.d
  let fold = b.form - b.bulge
  let bulge = b.bulge
  let fine = b.fine
  let rel = b.rel
  let roll = b.roll
  let lip = b.lip
  let rut = b.rut
  let grain = b.grain
  let seat = 0
  let halo = 0
  let under = 0
  for (const it of SET) {
    let da = az - it.az
    da -= 360 * Math.round(da / 360)
    if (Math.abs(da) > 14) continue
    if (it.s === undefined) it.s = sOfH(m, it.h)
    const foot = it.r * FOOT[it.kind]
    const fan = it.kind === 'scallop' || it.kind === 'cockle'
    const long = it.kind === 'glass' || fan ? (it.long ?? 1) : 1
    const reach = foot * long * (it.kind === 'glass' ? 1.5 : 1) + 3.4
    const u = da * RAD * q.r
    const v = s - it.s
    if (Math.abs(u) > reach || Math.abs(v) > reach) continue
    const t = (it.turn ?? 0) * RAD
    const along = u * Math.cos(t) + v * Math.sin(t)
    const up = -u * Math.sin(t) + v * Math.cos(t)
    const dist = Math.hypot(along * (fan ? long : 1), up / long) / (it.kind === 'glass' ? shardAt(it, Math.atan2(up / long, along)) : 1)
    // A thing lies in a dish cut into the stone where the stone is, not where the turned shape was: level with its own middle.
    if (it.d0 === undefined) {
      const mid = bare(m, it.az, it.s)
      it.d0 = mid.d
      it.fold0 = mid.form - mid.bulge
      it.bulge0 = mid.bulge
    }
    // The fold stops at a thing's rim and the swell eases to it from further out: under a thing the mound is as high as under its middle, so no side of it sinks and none stands off.
    const level = 1 - smooth(0.92 * foot, foot + 1.3, dist)
    const eased = 1 - smooth(0.6 * foot, foot + 3.2, dist)
    const levelled = mix(fold, it.fold0, level)
    const swelled = mix(bulge, it.bulge0, eased)
    d += levelled - fold + swelled - bulge
    fold = levelled
    bulge = swelled
    const inside = 1 - smooth(0.78 * foot, 1.07 * foot, dist)
    const deep = it.kind === 'pearl' ? 0.2 * it.r : it.kind === 'glass' ? 0.1 + 0.02 * it.r : 0.07 + 0.025 * it.r
    d = mix(d, it.d0, 0.88 * inside) - deep * inside
    fine *= 1 - inside
    rel *= 1 - inside
    roll *= 1 - inside
    lip *= 1 - inside
    rut *= 1 - inside
    grain *= 1 - inside
    seat = Math.max(seat, inside)
    halo = Math.max(halo, 1 - smooth(0.88 * foot, foot + 0.7 + 0.14 * foot, dist))
    // The lamp stands up and to the left: each thing's own shade lies on the sand under it and to its right.
    const us = u - 0.2 * foot
    const vs = v + 0.28 * foot
    const alongS = us * Math.cos(t) + vs * Math.sin(t)
    const upS = -us * Math.sin(t) + vs * Math.cos(t)
    const distS = Math.hypot(alongS * (fan ? long : 1), upS / long) / (it.kind === 'glass' ? shardAt(it, Math.atan2(upS / long, alongS)) : 1)
    under = Math.max(under, 1 - smooth(0.85 * foot, 1.18 * foot + 0.5, distS))
  }
  return { d, fine, rel, roll, lip, rut, grain, drift: b.drift, w: b.w, k: b.k, f: b.f, h: q.h, seat, halo, under, laid: b.laid, laidAt: b.laidAt, laidTone: b.laidTone, onTop: b.onTop, gh: b.gh }
}
export const clamp01 = (v) => clamp(v)
