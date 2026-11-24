import path from 'node:path'
import { parseArgs, rel, readJson } from './lib/paths.mjs'
import { Session, cfg, stillSpec, renderStill } from './lib/page.mjs'
import { composeComparison } from './lib/compose.mjs'
import { addLook } from './lib/looks.mjs'

const args = parseArgs(process.argv.slice(2))
const id = args.key && args.key !== true ? String(args.key) : ''
const key = cfg.keys.find((k) => k.id === id)
if (!key) throw new Error(`no key named ${id || '(none given)'}. Keys: ${cfg.keys.map((k) => k.id).join(', ')}`)
const regions = readJson(rel('references', 'regions.json'))
const approved = regions[path.basename(key.image, path.extname(key.image))]
if (!approved) throw new Error(`references/regions.json has no entry for ${key.image}`)

const spec = stillSpec({ key: id, tier: args.tier && args.tier !== true ? String(args.tier) : 'review', assets: args.assets, format: args.format })
const session = await Session.open({ what: `compare ${id}` })
let still
try {
  still = await renderStill(session, spec, { force: args.force === true })
} finally {
  await session.close()
}
const framing = still.record.framing
if (!framing) throw new Error('the still has no framing in its record')
const out = rel('out', 'work', 'compare', `compare-${id}.jpg`)
const caption = `${id}: the approved image (a) beside the build (b), ${spec.format}, ${spec.tier}`
const made = await composeComparison({
  a: { file: rel(approved.file), globe: approved.globe, base: approved.base },
  b: { file: still.file, globe: framing.globe, base: framing.base },
  out,
  caption,
})
if (args.look !== 'no') {
  addLook(made.files[0], `Comparison: ${id}, approved image left, build right`)
  made.files.slice(1).forEach((f, i) => addLook(f, `Comparison crops ${i + 1}: ${id}, approved image left, build right`))
}
console.log(`${still.reused ? 'reused' : 'rendered'} ${path.relative(rel(), still.file)}`)
for (const [i, f] of made.files.entries()) console.log(`${path.relative(rel(), f)} ${made.widths[i]} x ${made.heights[i]}`)
