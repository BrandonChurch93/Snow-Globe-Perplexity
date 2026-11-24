import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { Session, renderStill, stillSpec } from './lib/page.mjs'
import { parseArgs, rel } from './lib/paths.mjs'
import { REF_RIG, REF_SIZE } from './lib/refcam.mjs'

const args = parseArgs(process.argv.slice(2))
const season = args.season && args.season !== true ? String(args.season) : 'winter'
const approved = rel('references', 'approved', `${season}-rest.png`)
if (!fs.existsSync(approved)) throw new Error(`no approved image at ${approved}`)
const name = args.name && args.name !== true ? String(args.name) : season
const wide = Number(args.wide ?? 1200)
const box = args.box && args.box !== true ? String(args.box).split(',').map(Number) : [0, 0, REF_SIZE[0], REF_SIZE[1]]
if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || box[2] <= box[0] || box[3] <= box[1]) throw new Error('--box takes x0,y0,x1,y1 in pixels of the approved image')
const spec = stillSpec({ season, state: args.state ?? 'rest', camera: 'hero', tier: args.tier ?? 'draft', format: args.format, assets: args.assets, diag: args.diag, rig: REF_RIG })
const dir = rel('out', 'work', 'fit')
fs.mkdirSync(dir, { recursive: true })
const session = await Session.open({ local: args.local === true })
let still
try {
  still = await renderStill(session, spec, { force: args.force === true })
} finally {
  await session.close()
}
const meta = await sharp(still.file).metadata()
const k = meta.width / REF_SIZE[0]
const cut = (b, s) => ({ left: Math.round(b[0] * s), top: Math.round(b[1] * s), width: Math.round((b[2] - b[0]) * s), height: Math.round((b[3] - b[1]) * s) })
const high = Math.round((wide * (box[3] - box[1])) / (box[2] - box[0]))
const size = { width: wide, height: high, fit: 'fill' }
const ref = await sharp(approved).removeAlpha().extract(cut(box, 1)).resize(size).raw().toBuffer()
const ren = await sharp(still.file).removeAlpha().extract(cut(box, k)).resize(size).raw().toBuffer()
const raw = { raw: { width: wide, height: high, channels: 3 } }
const blend = Buffer.alloc(ref.length)
const sum = [0, 0, 0]
const mr = [0, 0, 0]
const mn = [0, 0, 0]
for (let i = 0; i < ref.length; i++) {
  blend[i] = (ref[i] + ren[i]) >> 1
  sum[i % 3] += Math.abs(ref[i] - ren[i])
  mr[i % 3] += ref[i]
  mn[i % 3] += ren[i]
}
const px = ref.length / 3
const edge = await sharp(ref, raw).greyscale().blur(1.2).convolve({ width: 3, height: 3, kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] }).raw().toBuffer()
const lines = Buffer.alloc(px * 4)
for (let i = 0; i < px; i++) {
  const on = edge[i] > 9
  lines[i * 4] = 255
  lines[i * 4 + 1] = 214
  lines[i * 4 + 2] = 60
  lines[i * 4 + 3] = on ? 210 : 0
}
const out = (tag) => path.join(dir, `${name}-${tag}.jpg`)
const pair = sharp({ create: { width: wide, height: high * 2 + 6, channels: 3, background: '#0b0d10' } }).composite([
  { input: ref, ...raw, left: 0, top: 0 },
  { input: ren, ...raw, left: 0, top: high + 6 },
])
await pair.jpeg({ quality: 88 }).toFile(out('pair'))
await sharp(blend, raw).jpeg({ quality: 88 }).toFile(out('blend'))
await sharp(ren, raw).composite([{ input: lines, raw: { width: wide, height: high, channels: 4 } }]).jpeg({ quality: 88 }).toFile(out('lines'))
const f = (a) => a.map((v) => (v / px).toFixed(1)).join(', ')
console.log(`fit: ${still.reused ? 'reused' : 'rendered'} ${path.relative(rel(), still.file)} with the reference camera (${spec.tier})`)
console.log(`box ${box.join(',')} of the approved image, ${wide} by ${high}`)
console.log(`mean difference per channel (0 to 255): ${f(sum)}`)
console.log(`mean colour, approved: ${f(mr)}; render: ${f(mn)}`)
console.log(`wrote ${['pair', 'blend', 'lines'].map((t) => path.relative(rel(), out(t))).join(', ')} (pair: approved above, render below; lines: the approved image's edges in yellow over the render)`)
