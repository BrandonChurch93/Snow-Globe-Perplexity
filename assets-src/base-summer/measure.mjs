import fs from 'node:fs'
import { projectWorld } from '../../tools/lib/refcam.mjs'
import { rel } from '../../tools/lib/paths.mjs'
import * as P from './profile.mjs'

// Where each thing set into the stone sits, from where it is seen in references/approved/summer-rest.png.
// A pick is the middle of the thing and its half width, in pixels of the crop 820,960..2000,1480 shown 1139 wide (the pair
// pictures `npm run fit` writes), with the camera of assets-src/refrig/summer.json. The place on the turned shape whose
// picture falls on the pick is found by search.
//   node assets-src/base-summer/measure.mjs        writes set.json, which profile.mjs reads
const RIG = { fovDeg: 16, yawDeg: 0, pitchDeg: 4.5, ...JSON.parse(fs.readFileSync(rel('assets-src', 'refrig', 'summer.json'), 'utf8')) }
const SCALE = 1180 / 1139
const W = [0.86, 0.8, 0.7]
const PICKS = [
  ['glass', 88, 188, 10, { turn: 80, c: [0.72, 0.36, 0.035], long: 1.4 }],
  ['glass', 108, 222, 14, { turn: 80, c: [0.012, 0.11, 0.12], long: 1.5 }],
  ['glass', 112, 258, 13, { turn: 0, c: [0.5, 0.34, 0.04] }],
  ['scallop', 170, 236, 47, { turn: -12, c: W }],
  ['glass', 198, 281, 29, { turn: 30, c: [0.42, 0.66, 0.5], frost: 1 }],
  ['pearl', 207, 190, 6, { c: [0.82, 0.74, 0.62] }],
  ['cockle', 248, 232, 25, { turn: 24, c: [0.86, 0.56, 0.3] }],
  ['pearl', 267, 318, 9, { c: [0.8, 0.62, 0.3] }],
  ['glass', 135, 340, 27, { turn: 10, c: [0.5, 0.44, 0.27], frost: 1, long: 1.2 }],
  ['snail', 307, 252, 30, { turn: 40, c: [0.84, 0.7, 0.55], band: [0.5, 0.26, 0.12] }],
  ['cockle', 328, 298, 25, { turn: 150, c: [0.86, 0.78, 0.7] }],
  ['glass', 398, 272, 40, { turn: 10, c: [0.03, 0.34, 0.12] }],
  ['pearl', 385, 326, 8, { c: [0.8, 0.7, 0.55] }],
  ['pearl', 410, 328, 9, { c: [0.82, 0.72, 0.5] }],
  ['glass', 356, 333, 14, { turn: 0, c: [0.3, 0.3, 0.06] }],
  ['pearl', 497, 263, 8, { c: [0.82, 0.74, 0.62] }],
  ['glass', 521, 288, 22, { turn: 50, c: [0.012, 0.13, 0.15] }],
  ['glass', 481, 330, 44, { turn: 200, c: [0.08, 0.42, 0.3], tri: 0.24 }],
  ['olive', 608, 322, 40, { turn: 14, c: [0.88, 0.82, 0.74] }],
  ['glass', 716, 333, 33, { turn: 100, c: [0.012, 0.06, 0.36], long: 1.2 }],
  ['pearl', 748, 195, 5, { c: [0.84, 0.76, 0.62] }],
  ['pearl', 640, 262, 5, { c: [0.84, 0.76, 0.62] }],
  ['scallop', 825, 285, 60, { turn: 8, c: [0.88, 0.8, 0.72] }],
  ['snail', 890, 212, 23, { turn: -60, c: [0.86, 0.72, 0.58], band: [0.62, 0.36, 0.2] }],
  ['cockle', 925, 257, 24, { turn: -30, c: [0.8, 0.76, 0.74] }],
  ['glass', 920, 315, 27, { turn: 0, c: [0.015, 0.2, 0.3] }],
  ['pearl', 962, 287, 6, { c: [0.82, 0.74, 0.6] }],
  ['cockle', 992, 252, 31, { turn: 4, c: [0.86, 0.68, 0.58], long: 1.3 }],
  ['glass', 1030, 196, 14, { turn: 85, c: [0.74, 0.5, 0.08], long: 1.3 }],
  ['glass', 1012, 224, 10, { turn: 20, c: [0.7, 0.6, 0.2], frost: 1 }],
  ['glass', 1040, 262, 19, { turn: 80, c: [0.66, 0.66, 0.3], long: 1.5, frost: 1 }],
  ['pearl', 236, 292, 5, { c: [0.84, 0.78, 0.66] }],
  ['pearl', 560, 345, 5, { c: [0.84, 0.78, 0.66] }],
  ['pearl', 872, 352, 6, { c: [0.84, 0.78, 0.66] }],
]

const mer = P.meridian()
const at = (az, h) => {
  const q = P.atS(mer, P.sOfH(mer, h))
  return [q.r * Math.sin(az * P.RAD), q.h, q.r * Math.cos(az * P.RAD)]
}
const seen = (az, h) => projectWorld(at(az, h), undefined, RIG)
const out = []
for (const [kind, X, Y, R, more] of PICKS) {
  const px = 820 + X * SCALE
  const py = 960 + Y * SCALE
  let best = { e: Infinity, az: 0, h: 0 }
  for (let span = 100, step = 2, pass = 0; pass < 4; pass++, span = step * 2, step /= 6) {
    const c = { ...best }
    for (let az = c.az - span; az <= c.az + span; az += step) {
      if (Math.abs(az) > 100) continue
      for (let h = Math.max(1, pass ? c.h - span / 3 : 1); h <= Math.min(38, pass ? c.h + span / 3 : 38); h += step / 3) {
        const p = seen(az, h)
        const e = Math.hypot(p[0] - px, p[1] - py)
        if (e < best.e) best = { e, az, h }
      }
    }
  }
  const a = seen(best.az, best.h)
  const b = seen(best.az, best.h + 1)
  const perMm = Math.hypot(b[0] - a[0], b[1] - a[1])
  out.push({ az: +best.az.toFixed(2), h: +best.h.toFixed(2), r: +((R * SCALE) / perMm).toFixed(2), kind, ...more })
  if (best.e > 1.5) console.log(`pick ${kind} at ${X},${Y} is ${best.e.toFixed(1)} px off the shape`)
}
fs.writeFileSync(rel('assets-src', 'base-summer', 'set.json'), `[\n${out.map((o) => `  ${JSON.stringify(o)}`).join(',\n')}\n]\n`)
console.log(`${out.length} things placed: ${out.map((o) => `${o.kind} ${o.az}/${o.h}/${o.r}`).join(', ')}`)
