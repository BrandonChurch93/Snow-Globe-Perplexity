import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel } from './lib/paths.mjs'
import { Session, cfg, formatById } from './lib/page.mjs'
import { Run } from './lib/frames.mjs'

const USAGE = `node tools/sanity-scan.mjs --what film-b|opening|loop --first A --last B [--step S] [--samples N] [--format uhd] [--watch] [--at X,Y] [--keep]
  draws each frame with N samples and prints one line for every frame that holds a value that is not finite before the lens and the grade:
  the frame, the count, the first place from the top left, its kind and the part the ids view shows there
  --watch reads every sample as it is drawn as well: the first sample that carries such a value, the pixel in the sample before and in those after, and the largest finite value of any sample
  --at X,Y keeps that pixel's values in every sample (with --watch)
  --keep writes the picture, the ids view and a crop of 400 px around the place of each such frame to out/work/sanity-scan/
  exit 0 when it could draw, whatever it found`

const args = parseArgs(process.argv.slice(2))
const str = (k) => (args[k] !== undefined && args[k] !== true ? String(args[k]) : '')
const fail = (msg, code = 2) => {
  console.error(msg)
  process.exit(code)
}
if (args.help === true || args.h === true) {
  console.log(USAGE)
  process.exit(0)
}
const KINDS = { 'film-b': 'film', loop: 'loop', opening: 'opening' }
const what = str('what')
if (!(what in KINDS) || str('first') === '' || str('last') === '') fail(USAGE)
const first = Number(str('first'))
const last = Number(str('last'))
const step = Math.max(1, Math.floor(Number(str('step')) || 1))
const samples = Math.floor(Number(str('samples')) || cfg.deliver.master.samples['film-b'])
if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first) fail('--first and --last are frames, --last not before --first')
if (!(samples >= 1)) fail('--samples is a count of 1 or more')
const format = formatById(str('format') || cfg.deliver.master.format)
const watch = args.watch === true
const at = /^(\d+),(\d+)$/.exec(str('at'))
const mark = at ? { x: Number(at[1]), y: Number(at[2]) } : null
const keep = args.keep === true
const CROP = 400
const dir = rel('out', 'work', 'sanity-scan')
const num = (v) => (v === null || v === undefined ? 'none' : Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : Number.isNaN(v) ? 'no number' : v > 0 ? 'plus infinite' : 'minus infinite')
const rgb = (t) => (t ? `(${t.slice(0, 3).map(num).join(', ')})` : 'not read')

if (KINDS[what] === 'opening') {
  console.log(`the opening is laid out by the page and photographed: it has no samples and no mean, so there is no value to count. 0 frames drawn.`)
  process.exit(0)
}

const session = await Session.open({ what: `sanity-scan ${process.argv.slice(2).join(' ')}` })
let code = 0
try {
  const run = new Run(session, { by: 'sanity-scan', looks: false })
  const track = { kind: KINDS[what], name: what, format, tier: `samples-${samples}`, assets: 'full', fps: cfg.film.fps, step: 1 }
  const page = await run.page(track)
  const plan = await run.plan(track)
  const has = track.kind === 'loop' ? plan.loop : plan.film.frameCount
  const list = []
  for (let i = first; i <= last && i < has; i += step) list.push(i)
  if (!list.length) throw new Error(`${what} has frames 0 to ${has - 1}`)
  const parts = await page.evaluate(() => window.showcase.dev.parts())
  const partAt = (r, g, b) => {
    let best = null
    for (const p of parts) {
      const d = Math.abs(((p.color >> 16) & 255) - r) + Math.abs(((p.color >> 8) & 255) - g) + Math.abs((p.color & 255) - b)
      if (!best || d < best.d) best = { name: p.name, d }
    }
    return best && best.d <= 6 ? best.name : `no part (the ids view shows ${r}, ${g}, ${b})`
  }
  const call = track.kind === 'loop' ? 'renderLoopFrame' : 'renderFilmFrame'
  const crop = async (png, place, file) => {
    const left = Math.max(0, Math.min(format.width - CROP, place.x - CROP / 2))
    const top = Math.max(0, Math.min(format.height - CROP, place.y - CROP / 2))
    await sharp(png).extract({ left, top, width: Math.min(CROP, format.width), height: Math.min(CROP, format.height) }).png().toFile(file)
  }
  console.log(`${what}, frames ${list[0]} to ${list[list.length - 1]}${step > 1 ? ` by ${step}` : ''}, ${format.width} x ${format.height}, ${samples} samples${watch ? ', every sample read' : ''}`)
  const t0 = Date.now()
  let odd = 0
  let peak = { value: 0, frame: -1, sample: -1, at: null }
  for (const index of list) {
    await page.evaluate(([on, m]) => window.showcase.dev.watchSamples(on, m ?? undefined), [watch, mark])
    const png = await run.frame(track, page, index)
    const sane = await page.evaluate(() => window.showcase.dev.sanity())
    const seen = watch ? await page.evaluate(() => window.showcase.dev.sampleFacts().map((f) => ({ ...f, peak: f.peak, at: f.at ? f.at.map((v) => (Number.isFinite(v) ? v : String(v))) : null, before: f.before ? f.before.map((v) => (Number.isFinite(v) ? v : String(v))) : null }))) : []
    const back = (t) => (t ? t.map((v) => (typeof v === 'string' ? Number(v) : v)) : null)
    for (const f of seen) {
      f.at = back(f.at)
      f.before = back(f.before)
    }
    seen.forEach((f, k) => {
      if (f.peak > peak.value) peak = { value: f.peak, frame: index, sample: k, at: f.peakAt }
    })
    const k = seen.findIndex((f) => f.invalid > 0)
    if (sane.invalid === 0 && k < 0) {
      if (mark && watch) console.log(`frame ${index}: none. The pixel ${mark.x}, ${mark.y} in its ${seen.length} samples, in the order drawn: ${seen.map((f) => rgb(f.at)).join(' ')}`)
      continue
    }
    odd++
    const place = sane.first ?? seen[k].first
    await page.evaluate(() => window.showcase.setDiagnostic('ids'))
    await page.evaluate(([c, i, t]) => window.showcase[c](i, t), [call, index, track.tier])
    const ids = await session.grab(page)
    await page.evaluate(() => window.showcase.setDiagnostic('none'))
    const px = await sharp(ids).extract({ left: place.x, top: place.y, width: 1, height: 1 }).removeAlpha().raw().toBuffer()
    const part = partAt(px[0], px[1], px[2])
    let line = `frame ${index}: ${sane.invalid} values that are not finite in the mean, the first at ${place.x}, ${place.y} from the top left (${place.channel}, ${place.kind}), part ${part}`
    if (watch) {
      if (k < 0) line += `. No sample holds one: it is made in the mean`
      else {
        const f = seen[k]
        line += `. Sample ${k + 1} of ${seen.length} in the order drawn is the first that carries one: ${f.invalid} values, the first at ${f.first.x}, ${f.first.y} (${f.first.channel}, ${f.first.kind}); the pixel holds ${rgb(f.at)} there, ${rgb(f.before)} in the sample before`
        const after = seen.slice(k + 1).map((g) => rgb(g.at))
        if (after.length) line += `, and after it ${after.join(' ')}`
        const others = seen.map((g, j) => (g.invalid > 0 && j !== k ? j + 1 : 0)).filter(Boolean)
        if (others.length) line += `. Samples ${others.join(', ')} hold such values too`
      }
    }
    console.log(line)
    if (keep) {
      fs.mkdirSync(dir, { recursive: true })
      const stem = path.join(dir, `${what}-${index}-${format.id}-${samples}`)
      fs.writeFileSync(`${stem}.png`, png)
      fs.writeFileSync(`${stem}-ids.png`, ids)
      await crop(png, place, `${stem}-crop.png`)
      await crop(ids, place, `${stem}-ids-crop.png`)
      fs.writeFileSync(`${stem}.json`, JSON.stringify({ frame: index, sanity: sane, part, samples: seen.map((f) => ({ ...f, at: f.at?.map(num) ?? null, before: f.before?.map(num) ?? null })) }, null, 2))
    }
  }
  const sec = (Date.now() - t0) / 1000 / list.length
  if (watch) console.log(`the largest finite value of any sample: ${num(peak.value)} (frame ${peak.frame}, sample ${peak.sample + 1}, at ${peak.at ? `${peak.at.x}, ${peak.at.y}` : 'no place'})`)
  console.log(`${list.length} frames drawn, ${odd} with a value that is not finite, ${Math.round(sec * 10) / 10} s a frame`)
} catch (e) {
  console.error(e?.message ?? e)
  code = 1
} finally {
  await session.close().catch(() => {})
}
process.exit(code)
