// npm run strict -- [--keys winter-rest,fall-shake] [--modes pow,all+smooth,all+smooth+noguard] [--format preview] [--tier draft] [--fresh]
// Renders each key plainly and under each mode of the strict rule (tools/lib/strict.mjs) and counts the pixels that
// differ. Without --keys it takes every judged key. The report is out/work/strict/report.json.
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, writeJson, readJson } from './lib/paths.mjs'
import { Session, cfg, stillSpec, renderStill, requireBuild } from './lib/page.mjs'
import { STRICT_INIT } from './lib/strict.mjs'
import sharp from 'sharp'

// A wrapped call is compiled a little differently from a plain one, which can move the last digit of a pixel here and
// there without any open case being met. An answer of no number is never that small: it blanks a part or the picture.
const MAX_STEP = 1
const MAX_SHARE = 1e-4

const args = parseArgs(process.argv.slice(2))
const text = (k, d) => (args[k] && args[k] !== true ? String(args[k]) : d)
const keys = text('keys', cfg.keys.map((k) => k.id).join(',')).split(',').filter(Boolean)
const modes = text('modes', 'pow,all+smooth,all+smooth+noguard').split(',').filter(Boolean)
const format = text('format', cfg.formats.preview.id)
const tier = text('tier', 'draft')
const root = rel('out', 'work', 'strict')
const folder = (mode) => path.join(root, mode.replace(/[^a-zA-Z0-9]+/g, '_'))
const reportFile = path.join(root, 'report.json')
fs.mkdirSync(root, { recursive: true })

async function pixels(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

async function differ(a, b) {
  const A = await pixels(a)
  const B = await pixels(b)
  if (A.width !== B.width || A.height !== B.height || A.channels !== B.channels) throw new Error(`sizes differ: ${a} and ${b}`)
  let count = 0
  let step = 0
  let box = null
  for (let y = 0; y < A.height; y++) {
    for (let x = 0; x < A.width; x++) {
      const i = (y * A.width + x) * A.channels
      let d = 0
      for (let c = 0; c < Math.min(3, A.channels); c++) d = Math.max(d, Math.abs(A.data[i + c] - B.data[i + c]))
      if (!d) continue
      count++
      step = Math.max(step, d)
      box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y]
    }
  }
  return { count, step, box, share: count / (A.width * A.height) }
}

const engine = requireBuild()
const session = await Session.open({ what: 'strict' })
const old = fs.existsSync(reportFile) && args.fresh !== true ? readJson(reportFile) : null
const report = old && old.engineHash === engine && old.format === format && old.tier === tier ? old : { engineHash: engine, format, tier, rows: {} }
const newContext = session.browser.newContext.bind(session.browser)
let mode = 'none'
session.browser.newContext = async (...x) => {
  const context = await newContext(...x)
  if (mode !== 'none') await context.addInitScript(STRICT_INIT, mode)
  return context
}

let failed = 0
try {
  for (const key of keys) {
    const spec = stillSpec({ key, format, tier })
    mode = 'none'
    const plain = path.join(folder('none'), `${key}.png`)
    const first = await renderStill(session, spec, { file: plain })
    console.log(`${key}: plain ${first.reused ? 'kept' : 'rendered'}`)
    for (const m of modes) {
      const id = `${key} ${m}`
      const file = path.join(folder(m), `${key}.png`)
      if (!report.rows[id] || !fs.existsSync(file)) {
        mode = m
        const t = Date.now()
        const page = await session.page({ format: spec.format, assets: spec.assets })
        const made = await renderStill(session, spec, { file, force: true, page })
        const state = await page.evaluate(() => window.__strict || null)
        await page.context().close()
        const d = await differ(plain, file)
        report.rows[id] = { key, mode: m, shaders: state ? state.shaders : 0, missed: state ? state.missed : 0, ...d, messages: made.record.errors ?? [], seconds: Math.round((Date.now() - t) / 1000) }
        writeJson(reportFile, report)
      }
      const r = report.rows[id]
      const ok = r.step <= MAX_STEP && r.share <= MAX_SHARE && r.shaders > 0 && !r.messages.length
      if (!ok) failed++
      console.log(`  ${m}: ${r.count} pixels differ${r.count ? `, largest step ${r.step}, box ${r.box.join(',')}` : ''}; ${r.shaders} shaders rewritten${r.missed ? `, ${r.missed} not` : ''}${r.messages.length ? `; messages: ${r.messages.slice(0, 2).join(' | ')}` : ''}  ${ok ? 'pass' : 'FAIL'}`)
    }
  }
} finally {
  await session.close()
}
console.log(failed ? `strict: ${failed} FAILED (engine ${engine})` : `strict: pass, ${keys.length} keys under ${modes.join(', ')} (engine ${engine}): no pixel moves by more than ${MAX_STEP} level, at most ${(MAX_SHARE * 100).toFixed(2)}% of pixels move`)
process.exit(failed ? 1 : 0)
