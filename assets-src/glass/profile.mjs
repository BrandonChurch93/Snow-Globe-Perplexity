import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { REF_GLASS, REF_SIZE } from '../../tools/lib/refcam.mjs'
import { parseArgs, rel } from '../../tools/lib/paths.mjs'

const args = parseArgs(process.argv.slice(2))
const season = args.season && args.season !== true ? String(args.season) : 'winter'
const approved = rel('references', 'approved', `${season}-rest.png`)
const render = args._[0] ? path.resolve(args._[0]) : rel('out', 'work', 'stills', `${season}-rest-hero-hd-draft-rig.png`)
const [W, H] = REF_SIZE

const load = async (file) => sharp(file).removeAlpha().resize({ width: W, height: H, fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer()
const ref = await load(approved)
const ren = await load(render)

const mean = (buf, x, y) => {
  const out = [0, 0, 0]
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const o = (Math.min(Math.max(Math.round(y) + j, 0), H - 1) * W + Math.min(Math.max(Math.round(x) + i, 0), W - 1)) * 3
      for (let c = 0; c < 3; c++) out[c] += buf[o + c] / 9
    }
  }
  return out.map((v) => Math.round(v))
}

const median = (buf, [x0, y0, x1, y1]) => {
  const ch = [[], [], []]
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) ch[c].push(buf[(y * W + x) * 3 + c])
  return ch.map((v) => v.sort((a, b) => a - b)[v.length >> 1])
}

const show = (v) => `(${v.map((x) => String(x).padStart(3)).join(', ')})`

if (args.rays && args.rays !== true) {
  const from = Number(args.from ?? 0.66)
  const to = Number(args.to ?? 1.02)
  const step = Number(args.step ?? 0.01)
  for (const angle of String(args.rays).split(',').map(Number)) {
    console.log(`ray at ${angle} degrees, counter-clockwise from 3 o'clock`)
    for (let s = from; s <= to + 1e-9; s += step) {
      const x = REF_GLASS.x + REF_GLASS.r * s * Math.cos((angle * Math.PI) / 180)
      const y = REF_GLASS.y - REF_GLASS.r * s * Math.sin((angle * Math.PI) / 180)
      console.log(`  share ${s.toFixed(3)}  approved ${show(mean(ref, x, y))}  render ${show(mean(ren, x, y))}`)
    }
  }
}

const patches = {
  'open liquid, centre': [1280, 420, 1340, 470],
  'open liquid, mid left': [1130, 330, 1230, 400],
  'open liquid, left low': [1010, 560, 1080, 640],
  'top cap': [1330, 200, 1430, 260],
  'crown beside the bubble': [1500, 150, 1560, 180],
  'left soft arc': [990, 620, 1010, 700],
  'room outside, right': [2060, 500, 2140, 600],
}

if (args.patches === true) {
  for (const [name, box] of Object.entries(patches)) console.log(`${name.padEnd(26)} approved ${show(median(ref, box))}  render ${show(median(ren, box))}`)
}

if (args.looks && args.looks !== true) {
  const dir = rel('out', 'work', 'fit')
  fs.mkdirSync(dir, { recursive: true })
  const cut = (buf, [x0, y0, x1, y1], k) =>
    sharp(buf, { raw: { width: W, height: H, channels: 3 } })
      .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
      .resize({ width: Math.round((x1 - x0) * k), kernel: 'lanczos3' })
      .png()
      .toBuffer()
  const pair = async (name, box, k, stacked) => {
    const w = Math.round((box[2] - box[0]) * k)
    const h = Math.round((box[3] - box[1]) * k)
    const a = await cut(ref, box, k)
    const b = await cut(ren, box, k)
    const file = path.join(dir, `${args.looks}-${name}.jpg`)
    await sharp({ create: { width: stacked ? w : w * 2 + 8, height: stacked ? h * 2 + 8 : h, channels: 3, background: '#282828' } })
      .composite([
        { input: a, left: 0, top: 0 },
        { input: b, left: stacked ? 0 : w + 8, top: stacked ? h + 8 : 0 },
      ])
      .jpeg({ quality: 88 })
      .toFile(file)
    console.log(`wrote ${path.relative(rel(), file)}`)
  }
  await pair('glass', [820, 60, 2000, 1260], 0.505, false)
  await pair('shoulder', [1500, 80, 2000, 620], 1.19, false)
  await pair('crown', [1270, 70, 1560, 200], 4, true)
  await pair('collar', [860, 880, 1960, 1140], 1.09, true)
}
