import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel } from './lib/paths.mjs'
import { Session, cfg, formatById } from './lib/page.mjs'
import { Run } from './lib/frames.mjs'

const USAGE = `node tools/shutter-frame.mjs --what film-b|loop --frames A,B,C [--tier final] [--format uhd] [--out out/work/shutter] [--tag name]
  draws each frame as the tier draws it and writes its PNG with one line: the frame, the travel, the samples, the seconds and the sha256 of the PNG`

const args = parseArgs(process.argv.slice(2))
const str = (k) => (args[k] !== undefined && args[k] !== true ? String(args[k]) : '')
const what = str('what')
const frames = str('frames').split(',').filter(Boolean).map(Number)
if ((what !== 'film-b' && what !== 'loop') || !frames.length || frames.some((n) => !Number.isInteger(n) || n < 0)) {
  console.error(USAGE)
  process.exit(2)
}
const tier = str('tier') || 'final'
const format = formatById(str('format') || cfg.deliver.master.format)
const dir = rel(str('out') || path.join('out', 'work', 'shutter'))
const tag = str('tag')
fs.mkdirSync(dir, { recursive: true })
const session = await Session.open({ what: `shutter-frame ${process.argv.slice(2).join(' ')}` })
try {
  const run = new Run(session, { by: 'shutter-frame', looks: false })
  const track = { kind: what === 'loop' ? 'loop' : 'film', name: what, format, tier, assets: 'full', fps: cfg.film.fps, step: 1 }
  const page = await run.page(track)
  for (const index of frames) {
    const asked = await page.evaluate(([k, i, t]) => window.showcase.dev.frameSamples(k, i, t), [track.kind, index, tier])
    const t0 = Date.now()
    const png = await run.frame(track, page, index)
    const sec = (Date.now() - t0) / 1000
    const file = path.join(dir, `${what}-${String(index).padStart(6, '0')}-${format.id}-${tier}${tag ? `-${tag}` : ''}.png`)
    fs.writeFileSync(file, png)
    console.log(`${what} frame ${index}, ${format.width} x ${format.height}, ${tier}: travel ${asked.travelPx.toFixed(2)} px, ${asked.samples} samples, ${sec.toFixed(1)} s (${(sec / asked.samples).toFixed(2)} s a sample), sha256 ${crypto.createHash('sha256').update(png).digest('hex')}, ${path.relative(rel(), file)}`)
  }
} finally {
  await session.close()
}
