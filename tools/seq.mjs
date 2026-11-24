import path from 'node:path'
import { parseArgs, writeJson } from './lib/paths.mjs'
import { Session, cfg, formatById } from './lib/page.mjs'
import { addLook } from './lib/looks.mjs'
import { SHEETS, composeSheet, frameDir, frameFile, gridLayout, labelUnits, layoutHashFor, matches, nameParts, pageInfo, pick, readPlan, renderFrames, run, secondsText, shown, sourceOf } from './lib/sheetlayout.mjs'

const USAGE = `npm run seq -- --first N --last M --tier T [--format F] [--step K] [--assets A] [--diag V] [--force] [--look no] [--by NAME]
  every film frame from N to M as its own picture under out/work/seq/, each with a record, and one sheet across the range as the look
  at most sandbox.maxFramesOnDisk (${cfg.sandbox.maxFramesOnDisk}) frames in one range. --step K keeps every Kth frame
exit 0 when every frame is written, 3 when the chunk budget ran out: run the same command again to carry on`

const layoutHash = layoutHashFor(import.meta.url)
const args = parseArgs(process.argv.slice(2))
const str = (k) => (args[k] !== undefined && args[k] !== true ? String(args[k]) : '')
const fail = (msg, code = 1) => {
  console.error(msg)
  process.exit(code)
}
if (args.help === true || args.h === true) {
  console.log(USAGE)
  process.exit(0)
}
if (str('first') === '' || str('last') === '' || !str('tier')) fail(USAGE, 2)

const o = { tier: str('tier'), format: str('format') || cfg.formats.preview.id, assets: str('assets') || 'full', diag: str('diag') === 'none' ? '' : str('diag'), force: args.force === true }
if (!(o.tier in cfg.tiers)) fail(`no such tier: ${o.tier}`, 2)
if (!(o.assets in cfg.assetSets)) fail(`no such asset set: ${o.assets}`, 2)
const format = formatById(o.format)
const first = Number(str('first'))
const last = Number(str('last'))
const step = Math.max(1, Math.floor(Number(str('step')) || 1))
const by = str('by') || 'builder'
if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first) fail('--first and --last are film frames, --last not before --first', 2)
const list = run(first, last + 1, step)
if (!list.length) fail(`no frame from ${first} to ${last} falls on --step ${step}`, 2)
if (list.length > cfg.sandbox.maxFramesOnDisk) fail(`that is ${list.length} frames and sandbox.maxFramesOnDisk is ${cfg.sandbox.maxFramesOnDisk}. Ask for a shorter range or a larger --step`, 2)

const started = Date.now()
o.deadline = started + cfg.sandbox.chunkBudgetMinutes * 60000
const tag = nameParts(o).join('-')
const tail = `${o.format}, ${o.tier}${o.assets === 'full' ? '' : `, ${o.assets} assets`}${o.diag ? `, ${o.diag} view` : ''}`
const per = cfg.critics.contactSheetFrames

const session = await Session.open({ what: `seq ${process.argv.slice(2).join(' ')}` })
let r = null
let sheet = null
let stopped = ''
let messages = []
try {
  const page = await session.page({ format: o.format, assets: o.assets })
  const src = sourceOf(await readPlan(page), 'film')
  if (last >= src.count) stopped = `the film has frames 0 to ${src.count - 1}`
  else {
    r = await renderFrames(session, page, src, list, o)
    messages = page.errors.slice(0, 20)
    const dir = frameDir(src, o)
    const stem = ['seq', first, last, step > 1 ? `x${step}` : ''].filter(Boolean).join('-')
    const info = await pageInfo(page)
    const written = list.filter((i) => r.files.has(i))
    const manifest = path.join(dir, `${stem}.json`)
    writeJson(manifest, {
      ...session.record(info, { diag: o.diag }),
      format: o.format,
      tier: o.tier,
      assets: o.assets,
      spec: { kind: 'seq', source: src.id, first, last, step },
      complete: r.complete,
      count: list.length,
      written: written.length,
      frames: written.map((i) => ({ index: i, seconds: i / src.fps, file: shown(r.files.get(i)) })),
    })
    if (r.complete) {
      const frames = pick(list, per)
      const file = path.join(SHEETS, `${['seq', src.id, first, last, step > 1 ? `x${step}` : '', tag].filter(Boolean).join('-')}.jpg`)
      const spec = { kind: 'seq', source: src.id, first, last, step, frames }
      const label = (i) => [String(i), secondsText(i, src.fps, step)]
      const layout = gridLayout({ count: frames.length, perSheet: per, frameWidth: format.width, frameHeight: format.height, labelUnits: Math.max(...frames.map((i) => labelUnits(label(i)))) })
      const caption = `Sequence: film frames ${first} to ${last}${step > 1 ? `, every ${step}` : ''}, ${list.length} pictures in ${shown(dir)}, ${frames.length} of them on this sheet, ${tail}`
      const fresh = r.rendered > 0 || o.force || !matches(file, { format: o.format, tier: o.tier, assets: o.assets, diagnostic: o.diag, layoutHash, spec })
      if (fresh) {
        await composeSheet({ tiles: frames.map((i) => ({ file: r.files.get(i), label: label(i) })), out: file, layout })
        writeJson(`${file}.json`, {
          ...session.record(info, { diag: o.diag }),
          format: o.format,
          tier: o.tier,
          assets: o.assets,
          layoutHash,
          spec,
          caption,
          width: layout.width,
          height: layout.height,
          limits: layout.limits,
          manifest: shown(manifest),
          frames: frames.map((i, k) => ({ index: i, seconds: i / src.fps, file: shown(r.files.get(i)), at: layout.cells[k] })),
        })
        if (args.look !== 'no') addLook(file, caption, by)
      }
      sheet = { file, fresh, width: layout.width, height: layout.height }
    }
    console.log(`frames in ${shown(dir)} · ${shown(frameFile(src, o, list[0]))} to ${shown(frameFile(src, o, list[list.length - 1]))} · list in ${shown(manifest)}`)
  }
} finally {
  await session.close()
}

if (stopped) fail(stopped)
if (sheet) console.log(`${sheet.fresh ? 'wrote' : 'reused'} ${shown(sheet.file)} · ${sheet.width} x ${sheet.height}`)
if (messages.length) console.log(`page messages:\n${messages.join('\n')}`)
const secs = ((Date.now() - started) / 1000).toFixed(0)
const counts = `${r.rendered} rendered, ${r.reused} reused`
if (r.complete) console.log(`seq: done · ${r.total} frames (${counts}) · ${secs} s`)
else {
  console.log(`seq: incomplete · ${r.rendered + r.reused} of ${r.total} frames (${counts}) · sandbox.chunkBudgetMinutes ran out after ${secs} s · run the same command again to carry on`)
  process.exit(3)
}
