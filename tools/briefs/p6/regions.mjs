#!/usr/bin/env node
// A ruler for summer's second list: the same regions of the object, cut from the approved image and from ours,
// each given as three colours (the 2nd, 50th and 98th percentile of luminance, as the mean colour of the pixels
// within 5 levels of it), the share of pixels above 200 and below 40, the spread and the mean saturation.
// Regions are in globe radii about the globe's centre, x to the right and y down.
//
//   node tools/briefs/p6/regions.mjs <our still.png or .jpg> [--approved references/approved/summer-rest.png]
//        [--centre 960,468 --radius 377]   our globe at hd from the hero camera, scaled by the picture's width
//        [--steps]   a second line for each: luminance at the 10th, 25th, 50th, 75th and 90th percentile and the share between 40 and 80
//        [--json]
//
// The approved images' globe: centre (1405, 658), radius 546 of 2816 x 1584, fitted by eye with a drawn circle.
// This reads pictures and judges nothing: the eye decides, the numbers say which way a thing is off.
import sharp from 'sharp'

const REGIONS = [
  ['base front, whole', -0.8, 0.8, 0.75, 1.35],
  ['base top band, left third', -0.8, -0.3, 0.7, 0.9],
  ['base top band, middle', -0.25, 0.25, 0.72, 0.92],
  ['base top band, right end', 0.45, 0.85, 0.7, 0.9],
  ['base body, right', 0.3, 0.8, 0.9, 1.3],
  ['base body, lower left', -0.85, -0.4, 1.05, 1.35],
  ['heap, table right', 0.95, 1.6, 1.1, 1.5],
  ['net of light, table left', -1.7, -0.4, 1.3, 1.6],
  ['ball, upper left', -0.7, -0.1, -0.7, -0.1],
  ['ball, upper right', 0.1, 0.6, -0.75, -0.45],
  ['ball, low left (the glow)', -0.75, -0.35, 0.15, 0.55],
  ['ball, bottom band', -0.6, 0.6, 0.56, 0.7],
  ['crown of the tree', 0.0, 0.6, -0.5, 0.0],
  ['cottage', -0.5, -0.1, 0.05, 0.45],
  ['pond', -0.2, 0.3, 0.46, 0.62],
  // added for the third list
  ['base body, middle', -0.3, 0.3, 0.95, 1.3],
  ['base body, left', -0.8, -0.35, 0.9, 1.3],
  ['bank face, centre', -0.4, 0.4, 0.65, 0.71],
  ['bank, left side', -0.85, -0.55, 0.45, 0.6],
  ['ball, top centre', -0.25, 0.05, -0.85, -0.55],
  ['heap, near the base', 0.95, 1.25, 1.1, 1.5],
  ['heap, further out', 1.25, 1.6, 1.1, 1.5],
  ['sand at the left front', -1.45, -0.85, 1.2, 1.45],
]

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const valued = new Set(['--approved', '--centre', '--radius'])
let ours = null
for (let i = 0; i < args.length; i++) {
  if (valued.has(args[i])) {
    i++
    continue
  }
  if (args[i].startsWith('--')) continue
  ours = args[i]
  break
}
if (!ours) {
  console.error('usage: node tools/briefs/p6/regions.mjs <our still> [--approved <image>] [--centre x,y --radius r] [--json]')
  process.exit(2)
}
const approved = flag('approved', 'references/approved/summer-rest.png')

async function load(file) {
  const { data, info } = await sharp(file).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

function measure(img, fit, [, x0, x1, y0, y1]) {
  const [cx, cy, r] = fit
  const X0 = Math.max(0, Math.floor(cx + x0 * r))
  const X1 = Math.min(img.w, Math.ceil(cx + x1 * r))
  const Y0 = Math.max(0, Math.floor(cy + y0 * r))
  const Y1 = Math.min(img.h, Math.ceil(cy + y1 * r))
  const px = []
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const i = (y * img.w + x) * 3
      const R = img.data[i]
      const G = img.data[i + 1]
      const B = img.data[i + 2]
      px.push([0.2126 * R + 0.7152 * G + 0.0722 * B, R, G, B])
    }
  }
  if (!px.length) return null
  const lum = px.map((p) => p[0]).sort((a, b) => a - b)
  const at = (q) => lum[Math.min(lum.length - 1, Math.floor((q / 100) * lum.length))]
  const colour = (q) => {
    const v = at(q)
    const near = px.filter((p) => Math.abs(p[0] - v) < 5)
    return [1, 2, 3].map((k) => Math.round(near.reduce((s, p) => s + p[k], 0) / near.length))
  }
  const mean = lum.reduce((s, v) => s + v, 0) / lum.length
  const spread = Math.sqrt(lum.reduce((s, v) => s + (v - mean) ** 2, 0) / lum.length)
  const sat = px.reduce((s, p) => s + (Math.max(p[1], p[2], p[3]) - Math.min(p[1], p[2], p[3])) / Math.max(1, Math.max(p[1], p[2], p[3])), 0) / px.length
  return {
    p2: colour(2),
    p50: colour(50),
    p98: colour(98),
    above200: +((100 * lum.filter((v) => v > 200).length) / lum.length).toFixed(1),
    below40: +((100 * lum.filter((v) => v < 40).length) / lum.length).toFixed(1),
    spread: +spread.toFixed(1),
    saturation: +sat.toFixed(2),
    steps: [10, 25, 50, 75, 90].map((q) => Math.round(at(q))),
    from40to80: +((100 * lum.filter((v) => v >= 40 && v < 80).length) / lum.length).toFixed(1),
    pixels: px.length,
  }
}

const a = await load(approved)
const o = await load(ours)
const fitA = [1405, 658, 546].map((v) => (v * a.w) / 2816)
const centre = flag('centre', '960,468').split(',').map(Number)
const radius = Number(flag('radius', '377'))
const scale = flag('centre', null) || flag('radius', null) ? 1 : o.w / 1920
const fitO = [centre[0] * scale, centre[1] * scale, radius * scale]

const rows = REGIONS.map((region) => ({ region: region[0], approved: measure(a, fitA, region), ours: measure(o, fitO, region) }))
if (args.includes('--json')) {
  console.log(JSON.stringify({ approved, ours, fitApproved: fitA, fitOurs: fitO, rows }, null, 1))
} else {
  const c = (v) => (v ? `(${v.join(', ')})` : 'none')
  const line = (label, m) =>
    m
      ? `  ${label.padEnd(9)} dark ${c(m.p2).padEnd(16)} middle ${c(m.p50).padEnd(16)} bright ${c(m.p98).padEnd(16)} above 200: ${String(m.above200).padStart(4)}%  below 40: ${String(m.below40).padStart(4)}%  spread ${String(m.spread).padStart(4)}  saturation ${m.saturation}`
      : `  ${label.padEnd(9)} outside the picture`
  console.log(`approved: ${approved}\nours:     ${ours}\n`)
  const steps = (label, m) => (m ? `  ${label.padEnd(9)} luminance at 10, 25, 50, 75, 90 percent: ${m.steps.join(', ')}  between 40 and 80: ${m.from40to80}%` : '')
  for (const row of rows) {
    console.log(row.region)
    console.log(line('approved', row.approved))
    console.log(line('ours', row.ours))
    if (args.includes('--steps')) {
      console.log(steps('approved', row.approved))
      console.log(steps('ours', row.ours))
    }
  }
}
