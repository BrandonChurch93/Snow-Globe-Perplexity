// npm run strict -- [--keys winter-rest,fall-shake] [--modes pow,all+smooth,all+smooth+noguard] [--format preview] [--tier draft] [--live high] [--assets web] [--fresh]
// Renders each key plainly and under each mode of the strict rule (tools/lib/strict.mjs) and counts the pixels that
// differ. Without --keys it takes every judged key. The report is out/work/strict/report.json.
// --live LEVEL draws each key through the app's own path at that level of live.quality, as `still --live` does: the
// painter a visitor's browser runs, not the film's shutter. Its pictures and report are kept apart, in
// out/work/strict/live-LEVEL/. --assets web draws the set a visitor is sent instead of the full one.
// --only narrows a mode to some of its functions and to some of their calls, for finding the call that meets an open
// case: a list joined by commas of `fn`, `fn#a-b` (the calls numbered a up to b, not b itself, counted per function
// through every shader in the order handed over), `fn#a-b!k,m` (leaving out k and m), `fn~text` (calls whose own
// text holds `text`) and `fn@name` (calls in shaders whose SHADER_NAME holds `name`); the last three may be joined.
// Every function of the mode that is not listed is left plain. The calls taken are written beside the picture.
// --same keeps every wrapper as the mode has it, test and choice and all, but makes the open case answer what the
// plain function answers (plus a uniform that is never set, so no compiler can fold the choice away). `dry` cannot
// show what the wrappers alone change, because a wrapper that only calls the plain function is compiled as the plain
// function. A picture that differs from the plain one under --same differs by the wrappers alone; what an open case
// does to a picture is the difference between the mode's picture and the --same picture of that mode.
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
const live = text('live', '')
const assets = text('assets', '')
if (live && !(live in cfg.live.quality)) throw new Error(`no such level: ${live}. The levels are ${Object.keys(cfg.live.quality).join(', ')}`)
const only = text('only', '')
const same = args.same === true
const sub = [live ? `live-${live}` : '', assets].filter(Boolean).join('-')
const root = sub ? rel('out', 'work', 'strict', sub) : rel('out', 'work', 'strict')
const tag = (mode) => (mode === 'none' ? mode : `${mode}${same ? ' same' : ''}${only ? ` only ${only}` : ''}`)
const folder = (mode) => path.join(root, tag(mode).replace(/[^a-zA-Z0-9]+/g, '_'))
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

// Runs in the page before STRICT_INIT, so that it is handed each source after the strict prelude has been put in.
const NARROW_INIT = (list) => {
  const picks = new Map()
  for (const item of String(list).split(',').filter(Boolean)) {
    const m = item.match(/^(\w+)(.*)$/)
    const rest = m[2]
    const range = (rest.match(/#(\d+)-(\d+)/) || []).slice(1).map(Number)
    picks.set(m[1], {
      narrowed: rest !== '',
      lo: range.length ? range[0] : 0,
      hi: range.length ? range[1] : Infinity,
      skip: new Set(((rest.match(/!([\d,]+)/) || [])[1] || '').split(',').filter(Boolean).map(Number)),
      text: (rest.match(/~([^@#!]+)/) || [])[1],
      shader: (rest.match(/@([^~#!]+)/) || [])[1],
    })
  }
  const state = (window.__narrow = { counts: {}, taken: [], sites: [] })
  const P = WebGL2RenderingContext.prototype
  const orig = P.shaderSource
  P.shaderSource = function (shader, src) {
    let s = String(src)
    const name = (s.match(/#define SHADER_NAME (\S+)/) || [])[1] || ''
    const kind = this.getShaderParameter(shader, this.SHADER_TYPE) === this.VERTEX_SHADER ? 'vertex' : 'fragment'
    const defs = [...s.matchAll(/#define (\w+) (sm_\w+)\n/g)]
    if (defs.length) {
      const last = defs[defs.length - 1]
      const cut = last.index + last[0].length
      let head = s.slice(0, cut)
      let tail = s.slice(cut)
      for (const d of defs) {
        const fn = d[1]
        const pick = picks.get(fn)
        if (pick && !pick.narrowed) continue
        head = head.replace(d[0], '')
        if (!pick) continue
        tail = tail.replace(new RegExp(`(?<![\\w.])${fn}\\(`, 'g'), (hit, at, whole) => {
          const k = (state.counts[fn] = (state.counts[fn] ?? -1) + 1)
          const near = whole.slice(at, at + 200)
          const line = `${fn} ${k} ${name} ${kind}: ${near.slice(0, 110).replace(/\s+/g, ' ')}`
          state.sites.push(line)
          const take = k >= pick.lo && k < pick.hi && !pick.skip.has(k) && (pick.text === undefined || near.includes(pick.text)) && (pick.shader === undefined || name.includes(pick.shader))
          if (take) state.taken.push(line)
          return take ? `${d[2]}(` : hit
        })
      }
      s = head + tail
    }
    return orig.call(this, shader, s)
  }
}

// Runs in the page before STRICT_INIT and NARROW_INIT, so that it is handed each source last, prelude and all.
const SAME_INIT = () => {
  const P = WebGL2RenderingContext.prototype
  const orig = P.shaderSource
  P.shaderSource = function (shader, src) {
    let s = String(src)
    const at = s.indexOf('float sm_nan()')
    if (at >= 0) {
      const lines = s.split('\n').map((l) => {
        if (!l.includes('sm_nan()') || l.startsWith('float sm_nan()')) return l
        const m = l.match(/^(.*\{ return )(.*) \? (.*) : (.*)(; \})$/)
        if (!m) throw new Error('same: cannot read ' + l)
        return m[3].includes('sm_nan()') ? `${m[1]}${m[2]} ? (${m[4]} + sm_same) : ${m[4]}${m[5]}` : `${m[1]}${m[2]} ? ${m[3]} : (${m[3]} + sm_same)${m[5]}`
      })
      s = lines.join('\n').replace('float sm_nan()', 'uniform float sm_same;\nfloat sm_nan()')
    }
    return orig.call(this, shader, s)
  }
}

const engine = requireBuild()
const session = await Session.open({ what: 'strict' })
const old = fs.existsSync(reportFile) && args.fresh !== true ? readJson(reportFile) : null
const report = old && old.engineHash === engine && old.format === format && old.tier === tier && (old.live ?? '') === live && (old.assets ?? '') === assets ? old : { engineHash: engine, format, tier, live, assets, rows: {} }
const newContext = session.browser.newContext.bind(session.browser)
let mode = 'none'
session.browser.newContext = async (...x) => {
  const context = await newContext(...x)
  if (mode !== 'none' && same) await context.addInitScript(SAME_INIT)
  if (mode !== 'none' && only) await context.addInitScript(NARROW_INIT, only)
  if (mode !== 'none') await context.addInitScript(STRICT_INIT, mode)
  return context
}

let failed = 0
try {
  for (const key of keys) {
    const spec = stillSpec({ key, format, tier, live: live || undefined, assets: assets || undefined })
    mode = 'none'
    const plain = path.join(folder('none'), `${key}.png`)
    const first = await renderStill(session, spec, { file: plain })
    console.log(`${key}: plain ${first.reused ? 'kept' : 'rendered'}`)
    for (const m of modes) {
      const id = `${key} ${tag(m)}`
      const file = path.join(folder(m), `${key}.png`)
      if (!report.rows[id] || !fs.existsSync(file)) {
        mode = m
        const t = Date.now()
        const page = await session.page({ format: spec.format, assets: spec.assets })
        const made = await renderStill(session, spec, { file, force: true, page })
        const state = await page.evaluate(() => window.__strict || null)
        const narrow = only ? await page.evaluate(() => window.__narrow || null) : null
        if (narrow) writeJson(`${file}.calls.json`, narrow)
        const narrowed = narrow && /[#~@]/.test(only)
        await page.context().close()
        const d = await differ(plain, file)
        report.rows[id] = { key, mode: tag(m), taken: narrowed ? narrow.taken.length : undefined, shaders: state ? state.shaders : 0, missed: state ? state.missed : 0, ...d, messages: made.record.errors ?? [], seconds: Math.round((Date.now() - t) / 1000) }
        writeJson(reportFile, report)
      }
      const r = report.rows[id]
      const ok = r.step <= MAX_STEP && r.share <= MAX_SHARE && r.shaders > 0 && !r.messages.length
      if (!ok) failed++
      console.log(`  ${tag(m)}${r.taken === undefined ? '' : ` (${r.taken} calls)`}: ${r.count} pixels differ${r.count ? `, largest step ${r.step}, box ${r.box.join(',')}` : ''}; ${r.shaders} shaders rewritten${r.missed ? `, ${r.missed} not` : ''}${r.messages.length ? `; messages: ${r.messages.slice(0, 2).join(' | ')}` : ''}  ${ok ? 'pass' : 'FAIL'}`)
    }
  }
} finally {
  await session.close()
}
const through = `${live ? ` through the app's own path at ${live}` : ''}${assets ? ` with the ${assets} set` : ''}`
console.log(failed ? `strict: ${failed} FAILED${through} (engine ${engine})` : `strict: pass, ${keys.length} keys${through} under ${modes.map(tag).join(', ')} (engine ${engine}): no pixel moves by more than ${MAX_STEP} level, at most ${(MAX_SHARE * 100).toFixed(2)}% of pixels move`)
process.exit(failed ? 1 : 0)
