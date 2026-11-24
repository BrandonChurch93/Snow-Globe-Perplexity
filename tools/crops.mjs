import path from 'node:path'
import { parseArgs, rel } from './lib/paths.mjs'
import { Session, cfg, stillSpec, renderStill } from './lib/page.mjs'
import { composeCrops } from './lib/compose.mjs'
import { addLook } from './lib/looks.mjs'

const REGIONS = [
  { name: 'glass shoulder', x: -0.62, y: -0.62 },
  { name: 'glass rim', x: 0.9, y: -0.1 },
  { name: 'cottage', x: -0.4, y: 0.27 },
  { name: 'tree crown', x: 0.2, y: -0.33 },
  { name: 'pond', x: 0.02, y: 0.6 },
  { name: 'particles near', x: -0.1, y: -0.05 },
  { name: 'particles far', x: 0.55, y: -0.55 },
  { name: 'base', x: 0, y: 1.2 },
  { name: 'collar', x: 0.45, y: 0.88 },
  { name: 'foot and its mirror image', x: 0, y: 1.62 },
  { name: 'dressing', x: -1.05, y: 1.45 },
  { name: 'dressing right', x: 1.05, y: 1.45 },
]

const args = parseArgs(process.argv.slice(2))
const id = args.key && args.key !== true ? String(args.key) : args.id && args.id !== true ? String(args.id) : ''
if (!id) throw new Error('give --key ID or --id ID')
const spec = stillSpec({ key: id, tier: args.tier && args.tier !== true ? String(args.tier) : 'review', assets: args.assets, format: args.format })
const session = await Session.open({ what: `crops ${id}` })
let still
try {
  still = await renderStill(session, spec, { force: args.force === true })
} finally {
  await session.close()
}
const g = still.record.framing.globe
const long = cfg.critics.maxImageLongEdgePx
const tileW = Math.floor((long - 6) / 2)
const tileH = Math.floor(tileW * 0.56)
const regions = REGIONS.map((r) => ({ name: r.name, cx: g.cx + r.x * g.r, cy: g.cy + r.y * g.r, w: tileW, h: tileH }))
const outPrefix = rel('out', 'work', 'crops', `crops-${id}`)
const files = await composeCrops({ file: still.file, regions, outPrefix, cols: 2 })
if (args.look !== 'no') files.forEach((f, i) => addLook(f, `Crops ${i + 1} of ${files.length}: ${id} at native size`))
console.log(`${still.reused ? 'reused' : 'rendered'} ${path.relative(rel(), still.file)}`)
for (const f of files) console.log(path.relative(rel(), f))
