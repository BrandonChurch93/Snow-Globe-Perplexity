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
const SWIRL = { apart: 9.5, slope: 0.52, most: 0.85, least: 0.12, crumb: 0.034, notch: 0.03, crest: 0.3 }
const RIDGE = { apart: 4.4, deep: 0.5, peak: 0.56, pit: 0.1, gouge: 0.03, crack: 0.006 }
// A roll of moulded sand in section, from the hollow under it (0) to the hollow over it (1): it stands out quickly to its crest and falls
// back slowly, and where it meets the next roll the hollow is round, so it lies in soft shade and draws no line.
const shelf = (x, crest) => (x < crest ? 0.5 - 0.5 * Math.cos((Math.PI * x) / crest) : 0.5 + 0.5 * Math.cos((Math.PI * (x - crest)) / (1 - crest)))
const frac = (v) => v - Math.floor(v)
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
// The roll under the glass lies on the body as a crust: from the left flank to the middle its lower edge is a ragged step, high on the left
// and lower toward the middle, its height in mm.
const crustEdge = (A, a180) => 34.0 - 0.093 * (clamp(a180, -58, -6) + 10) + 3.6 * (fbm(A * 46 + 1, 0.5, 46, 4, 191, 4) - 0.5) + 1.5 * (fbm(A * 110 + 7, 0.5, 110, 4, 205, 3) - 0.5)
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
  const dabs = 2.1 * (1 + 0.6 * smooth(40, 70, a180)) * (fbm(A * 30 + 2, h / 6 + 1, 30, 64, 163, 3) - 0.5) * smooth(4, 28, a180) * smooth(125, 95, a180) * smooth(3, 8, q.h) * (1 - 0.6 * onTop)
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
  const swirl = deep * live * wave * body * mix(0.3, 1, smooth(-40, -8, a180)) * mix(1, 0.65 * stroke, dabbed)
  // The crease at the bottom of a hollow: there on one stretch, gone on the next.
  const sharp = smooth(0.34, 0.6, fbm(A * 7 + 11, h / 9 + 2, 7, 64, 203, 2))
  const notch = SWIRL.notch * smooth(-0.6, -1, wave) ** 2 * sharp * live * clamp(deep / 0.3, 0.4, 1) * mix(1, 0.25, dabbed)
  const over = h - crustEdge(A, a180)
  // The crust is broken into flakes: its step is high on one, low on the next, and nowhere does it end in a straight cut.
  const flake = 0.25 + 0.75 * smooth(0.32, 0.62, fbm(A * 30 + 3, 0.5, 30, 4, 197, 2))
  const crustOn = smooth(-62, -52, a180) * smooth(-16, -32, a180) * flake
  const crust = 0.45 * smooth(-0.4, 0.25, over) * crustOn
  // The sun lies on the face of the roll above the ledge, from left of the middle to the middle.
  const lipSoft = mix(0.3, 1.0, smooth(-31, -25, a180))
  const lip = smooth(-lipSoft, lipSoft, over) * smooth(4.6, 0.6, over + 2.2 * (fbm(A * 50 + 9, h / 3, 50, 64, 207, 3) - 0.5)) * Math.max(smooth(-42, -39, a180) * smooth(-28, -31, a180), 0.6 * smooth(-27, -20, a180) * smooth(-5, -16, a180)) * (0.3 + 0.7 * flake)
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
  const grit = fbm(A * 560 + 3, h / 0.62 + 1, 560, 128, 181, 2) - 0.5
  const underLedge = mix(1, smooth(-0.2, -1.5, over), smooth(-62, -52, a180) * smooth(-4, -14, a180)) * smooth(35.5, 33, h)
  const rpsi = psi + 1.5 * dabbed * (fbm(A * 70 + 3, h / 2.6 + 2, 70, 64, 215, 2) - 0.5)
  const rp = rpsi / RIDGE.apart + 0.4 * Math.sin(rpsi / 6.1 + p1) + 0.15 * Math.sin(rpsi / 2.9 + p2 + 12 * Math.PI * A)
  const rk = Math.floor(rp)
  const rx = rp - rk
  const rRun = smooth(0.14, 0.46, mix(fbm(A * 18 + 0.37 * rk, 0.61 * rk + 0.5, 18, 64, 219, 2), fbm(A * 46 + 0.37 * rk, 0.61 * rk + 0.5, 46, 64, 231, 2), dabbed))
  const rOn = Math.max(0.2 * smooth(-100, -84, a180) * smooth(-10, -28, a180) * smooth(23.5, 27, h), smooth(-40, -20, a180) * smooth(44, 22, a180) * mix(0.4, 1, smooth(9, 15, h)) * smooth(5, 9, h), 0.45 * smooth(5, 9, h)) * underLedge * mix(1, 0.55, dabbed) * mix(0.5, 1, Math.max(smooth(-45, -22, a180), smooth(20, 24, h)))
  const ridge = RIDGE.deep * (0.35 + 0.65 * hashInt(rk, 3, 217)) * rRun * shelf(rx, RIDGE.peak) * rOn
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
  const gouge = -RIDGE.gouge * smooth(0.07, 0, Math.abs(gn - 0.5)) * smooth(0.4, 0.6, fbm(A * 12 + 1, h / 14 + 5, 12, 64, 235, 2)) * dabbed * underLedge * smooth(3, 7, q.h)
  // Where the sand was pressed it has parted in thin creases, each short, bent and unlike the next.
  const cn = fbm(A * 26 + 3, h / 11 + 7, 26, 64, 241, 3)
  const crack = -RIDGE.crack * smooth(0.04, 0.008, Math.abs(cn - 0.5)) * smooth(0.4, 0.56, fbm(A * 9 + 5, h / 18 + 1, 9, 64, 243, 2)) * smooth(8, 30, a180) * smooth(125, 100, a180) * underLedge * smooth(3, 7, q.h)
  // Crumbs: grain scale roughness, most on the side of a swell that is turned up and on the loose sand.
  const crumbs = Math.max(0.35 + 0.65 * smooth(-0.2, 0.5, wave * live * body), 1.5 * drift) * fade
  const crumb = SWIRL.crumb * 2.4 * grit * crumbs
  // Under the roll on the left the sand lies in thin beds: five or six soft grooves, near level and each a little bent.
  const bedH = h + 0.55 * Math.sin((a180 + 37) * 0.11) + 2.0 * (fbm(A * 13 + 5, h / 14 + 2, 13, 64, 251, 2) - 0.5)
  const beds = -0.06 * (0.5 - 0.5 * Math.cos(2 * Math.PI * frac(bedH / 1.5))) ** 2 * smooth(-88, -74, a180) * smooth(-16, -30, a180) * smooth(25.5, 27.5, h) * smooth(-0.4, -1.6, over) * (0.5 + 0.5 * smooth(0.3, 0.55, fbm(A * 9 + 1, h / 7 + 4, 9, 64, 253, 2)))
  const small = (ridge + pit + gouge + crack - notch + beds) * body * fade + crumb
  // The crust's torn step is narrower than the mesh's cells: the carve map holds it, or the mesh draws it as a saw.
  const fine = (swirl * (1 - held) + crust) * fade + small
  const d = ((swell + ripple) * (1 - 0.55 * onTop) + swirl * held + hold + lumps + dabs + heap) * fade + form
  // What the light from above reads: every part of the relief that makes a face turned up or down.
  const rel = (swirl + dabs + crust + crease) * fade + small - crumb
  return { d, fine, rel, form, bulge, lip: lip * fade, grain: 2 * grit * Math.min(crumbs, 1), drift, w, k, f, q, onTop, gh }
}
export function relief(m, az, s) {
  const b = bare(m, az, s)
  const q = b.q
  let d = b.d
  let fold = b.form - b.bulge
  let bulge = b.bulge
  let fine = b.fine
  let rel = b.rel
  let lip = b.lip
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
    lip *= 1 - inside
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
  return { d, fine, rel, lip, grain, drift: b.drift, w: b.w, k: b.k, f: b.f, h: q.h, seat, halo, under, onTop: b.onTop, gh: b.gh }
}
export const clamp01 = (v) => clamp(v)
