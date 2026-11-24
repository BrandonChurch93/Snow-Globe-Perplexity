import fs from 'node:fs'
import sharp from 'sharp'
import { rel } from '../../tools/lib/paths.mjs'
import { projectWorld, rayOf } from '../../tools/lib/refcam.mjs'
import { PROFILE_NOTES, ring } from './profile.mjs'

const SIDE = [
  ['rim, left', 872, 1340],
  ['rim, right', 1941, 1340],
  ['rope ring, left', 874, 1312],
  ['rope ring, right', 1938, 1322],
  ['bead, left', 889, 1290],
  ['bead, right', 1926, 1296],
  ['shoulder low, left', 897, 1255],
  ['shoulder low, right', 1917, 1262],
  ['shoulder mid, left', 905, 1235],
  ['shoulder mid, right', 1906, 1240],
  ['shoulder high, left', 915, 1215],
  ['shoulder high, right', 1899, 1218],
  ['neck, left (behind ice, uncertain)', 945, 1150],
  ['neck, right (behind ice, uncertain)', 1851, 1140],
  ['ledge lip, left', 912, 1052],
  ['ledge lip, right', 1905, 1060],
]

const FRONT = [
  ['collar top', 1078, 40.9],
  ['ledge lip top', 1118, 54.7],
  ['ledge lip bottom', 1138, 54.7],
  ['carving top', 1225, 53.5],
  ['carving bottom', 1370, 56.3],
  ['bead top', 1375, 57.0],
  ['bead bottom', 1393, 57.0],
  ['rope top', 1396, 57.3],
  ['rope bottom', 1424, 58.7],
  ['rim top', 1426, 58.8],
  ['rim bottom', 1447, 58.8],
]

function tangent(px, py) {
  const { origin, dir } = rayOf(px, py)
  const t = -(origin[0] * dir[0] + origin[2] * dir[2]) / (dir[0] * dir[0] + dir[2] * dir[2])
  const p = [origin[0] + t * dir[0], origin[1] + t * dir[1], origin[2] + t * dir[2]]
  return { r: Math.hypot(p[0], p[2]), h: p[1] }
}

function frontHeight(py, r) {
  const { origin, dir } = rayOf(1409, py)
  const t = (r - origin[2]) / dir[2]
  return origin[1] + t * dir[1]
}

console.log('silhouette points of the approved image, as tangent rings (radius mm, height mm):')
for (const [name, x, y] of SIDE) {
  const m = tangent(x, y)
  console.log(`  ${name.padEnd(38)} px ${x},${y}  r ${m.r.toFixed(2)}  h ${m.h.toFixed(2)}`)
}
console.log('rows on the centre line x 1409 (height mm at the stated radius):')
for (const [name, y, r] of FRONT) console.log(`  ${name.padEnd(38)} py ${y}  r ${r}  h ${frontHeight(y, r).toFixed(2)}`)
console.log('profile of the build:')
for (const n of PROFILE_NOTES) console.log(`  ${n}`)

const box = [820, 1010, 2000, 1480]
const k = 1.5
const lines = []
for (const [r, h, colour] of ring()) {
  let d = ''
  for (let i = 0; i <= 180; i++) {
    const a = (-100 + (200 * i) / 180) * (Math.PI / 180)
    const [x, y] = projectWorld([r * Math.sin(a), h, r * Math.cos(a)])
    d += `${i ? 'L' : 'M'}${((x - box[0]) * k).toFixed(1)} ${((y - box[1]) * k).toFixed(1)} `
  }
  lines.push(`<path d="${d}" fill="none" stroke="${colour}" stroke-width="1"/>`)
}
const w = Math.round((box[2] - box[0]) * k)
const h = Math.round((box[3] - box[1]) * k)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines.join('')}</svg>`
const out = rel('out', 'work', 'base-winter')
fs.mkdirSync(out, { recursive: true })
await sharp(rel('references', 'approved', 'winter-rest.png'))
  .extract({ left: box[0], top: box[1], width: box[2] - box[0], height: box[3] - box[1] })
  .resize(w, h)
  .composite([{ input: Buffer.from(svg) }])
  .jpeg({ quality: 90 })
  .toFile(`${out}/measure-overlay.jpg`)
console.log(`wrote out/work/base-winter/measure-overlay.jpg`)
