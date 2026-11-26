// npm run strict -- [--keys winter-rest,fall-shake] [--modes pow,all+smooth,all+smooth+noguard] [--against plain|same] [--format preview] [--tier draft] [--live high] [--assets web] [--fresh]
// Renders each key under each mode of the strict rule (tools/lib/strict.mjs) and counts the pixels that differ from
// the picture the row is read against. Without --keys it takes every judged key. The report is
// out/work/strict/report.json.
// What a row is read against. First the plain picture: a mode whose picture is the plain picture, within the limits,
// does not rest on an answer the language leaves open, and nothing more needs rendering. Where it is not, the row is
// read against its own --same picture (decision of the lead, phase 6), which is the same mode with every wrapper kept
// and each open case answering what the plain function answers: against the plain picture a wrapped build can also
// differ by the wrappers' compiled form alone (under SwiftShader a wide field of last digits, up to 9 levels in the
// summer crown), which says nothing about any graphics card, and the difference between the mode and its --same
// picture leaves that out. Which of the two pictures the wrappers' form moves depends on the renderer: lavapipe draws
// the mode of winter at rest as the plain picture to the byte and moves the --same picture; SwiftShader does the
// reverse. So each row says what it was read against. The limits are the same for both readings.
// --against plain reads against the plain picture alone, --against same against the --same picture alone.
// In the --same picture of a noguard mode isnan() and isinf() answer false as they do in the mode itself, so that row
// says whether an open case reaches the picture once the guards are gone. Whether a guard holds back a number that
// came from somewhere the wrappers do not watch (a division by zero) is the guards row: for every key whose modes hold
// both `x` and `x+noguard`, the picture of `x` against the picture of `x+noguard`, at no extra render: two pictures
// that are the same with the guards and without them hold nothing a guard holds back. Where they are not the same
// (an open case the wrappers answer with no number is held back by a guard too), the row is read on the --same
// pictures of the two modes, which differ only in what isnan() and isinf() answer. A guards row over the limit means
// the plain picture rests on isnan() working, which some graphics cards do not promise. With --against same the row
// is read on the --same pictures at once.
// A row that fails is read a second time: both its pictures are rendered again, and a pixel counts only when it
// moves at the same place in both readings (for the limit on the step, by more than the limit in both). A met open
// case moves the same pixels every time; a picture that wobbles from render to render does not. The row says that it
// was read twice and gives both counts. The limits are the same.
// Kept pictures count only for the engine and the renderer that drew them (tools/lib/browser.mjs); the report and
// the last line name the renderer.
// --repeat N is for finding a wobble: it renders the --same picture of each mode N times and says whether the
// pictures are the same, pixel for pixel. It judges nothing else.
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
// does to a picture is the difference between the mode's picture and the --same picture of that mode. A run with
// --same is always read against the plain picture.
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, writeJson, readJson } from './lib/paths.mjs'
import { Session, cfg, stillSpec, renderStill, requireBuild } from './lib/page.mjs'
import { rendererName } from './lib/browser.mjs'
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
const against = same ? 'plain' : text('against', 'both')
if (against !== 'same' && against !== 'plain' && against !== 'both') throw new Error(`--against takes plain or same, not ${against}`)
const repeat = Number(text('repeat', '0'))
const renderer = rendererName(false)
const sub = [live ? `live-${live}` : '', assets].filter(Boolean).join('-')
const root = sub ? rel('out', 'work', 'strict', sub) : rel('out', 'work', 'strict')
const tag = (mode, s = same) => (mode === 'none' ? mode : `${mode}${s ? ' same' : ''}${only ? ` only ${only}` : ''}`)
const folder = (mode, s = same) => path.join(root, tag(mode, s).replace(/[^a-zA-Z0-9]+/g, '_'))
const reportFile = path.join(root, 'report.json')
fs.mkdirSync(root, { recursive: true })

async function pixels(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

// How far each pixel of b is from the same pixel of a, in levels: the largest of the three colours.
async function steps(a, b) {
  const A = await pixels(a)
  const B = await pixels(b)
  if (A.width !== B.width || A.height !== B.height || A.channels !== B.channels) throw new Error(`sizes differ: ${a} and ${b}`)
  const d = new Uint8Array(A.width * A.height)
  for (let p = 0; p < d.length; p++) {
    const i = p * A.channels
    let m = 0
    for (let c = 0; c < Math.min(3, A.channels); c++) m = Math.max(m, Math.abs(A.data[i + c] - B.data[i + c]))
    d[p] = m
  }
  return { d, width: A.width, height: A.height }
}

function count({ d, width, height }) {
  let n = 0
  let step = 0
  let box = null
  for (let p = 0; p < d.length; p++) {
    if (!d[p]) continue
    const x = p % width
    const y = (p - x) / width
    n++
    step = Math.max(step, d[p])
    box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y]
  }
  return { count: n, step, box, share: n / (width * height) }
}

const differ = async (a, b) => count(await steps(a, b))
// What two readings of one row agree on: a pixel moves here by the smaller of its two steps, so it counts as moved
// only when it moved in both, and as over a limit only when it was over that limit in both.
const both = (one, two) => ({ d: one.d.map((v, p) => Math.min(v, two.d[p])), width: one.width, height: one.height })
const within = (c) => c.step <= MAX_STEP && c.share <= MAX_SHARE

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
const report = old && old.engineHash === engine && (old.renderer ?? 'swiftshader') === renderer && old.format === format && old.tier === tier && (old.live ?? '') === live && (old.assets ?? '') === assets ? old : { engineHash: engine, renderer, format, tier, live, assets, rows: {} }
report.made ??= {}
const newContext = session.browser.newContext.bind(session.browser)
let mode = 'none'
let sameNow = false
session.browser.newContext = async (...x) => {
  const context = await newContext(...x)
  if (mode !== 'none' && sameNow) await context.addInitScript(SAME_INIT)
  if (mode !== 'none' && only) await context.addInitScript(NARROW_INIT, only)
  if (mode !== 'none') await context.addInitScript(STRICT_INIT, mode)
  return context
}

// One picture of one key under one mode, with or without --same. A picture made for this engine by this renderer is
// kept: the report holds what was made, and a report of another engine or renderer is thrown away above. `turn` names
// a further render of the same picture ('again' for the second reading of a row, 'r2' for --repeat).
async function picture(spec, key, m, s, turn = '', fresh = false) {
  const file = path.join(folder(m, s), `${key}${turn ? `.${turn}` : ''}.png`)
  const id = path.relative(root, file)
  if (!fresh && report.made[id] && fs.existsSync(file)) return { file, ...report.made[id] }
  mode = m
  sameNow = s
  const t = Date.now()
  try {
    const page = await session.page({ format: spec.format, assets: spec.assets })
    const made = await renderStill(session, spec, { file, force: true, page })
    const state = await page.evaluate(() => window.__strict || null)
    const narrow = only ? await page.evaluate(() => window.__narrow || null) : null
    if (narrow) writeJson(`${file}.calls.json`, narrow)
    await page.context().close()
    report.made[id] = { taken: narrow && /[#~@]/.test(only) ? narrow.taken.length : undefined, shaders: state ? state.shaders : 0, missed: state ? state.missed : 0, messages: made.record.errors ?? [], seconds: Math.round((Date.now() - t) / 1000) }
  } finally {
    mode = 'none'
    sameNow = false
  }
  writeJson(reportFile, report)
  return { file, ...report.made[id] }
}

// The plain picture, for --against plain. The second reading renders it again beside the first.
async function plainPicture(spec, key, turn = '') {
  const file = path.join(folder('none'), `${key}${turn ? `.${turn}` : ''}.png`)
  const made = await renderStill(session, spec, { file, force: turn !== '' })
  return { file, reused: made.reused, shaders: 1, missed: 0, messages: [], seconds: 0 }
}

// One row: the picture `get(turn)` gives against the picture `ref(turn)` gives. A row over a limit is read again.
async function read(key, name, mode, get, ref, note = '') {
  const pic = await get('')
  const base = await ref('')
  const one = await steps(base.file, pic.file)
  const first = count(one)
  const messages = [...pic.messages, ...base.messages]
  const row = { key, mode, against: name.includes('same') ? 'same' : 'plain', taken: pic.taken, shaders: pic.shaders, missed: pic.missed, ...first, messages, seconds: pic.seconds + base.seconds }
  let ok = within(first)
  let said = `${first.count} pixels differ${first.count ? `, largest step ${first.step}, box ${first.box.join(',')}` : ''}`
  if (!ok) {
    const pic2 = await get('again')
    const base2 = await ref('again')
    const two = await steps(base2.file, pic2.file)
    const second = count(two)
    const agreed = count(both(one, two))
    ok = within(agreed)
    row.twice = { first, second, agreed }
    row.messages.push(...pic2.messages, ...base2.messages)
    said = `read twice: ${first.count} pixels differ (largest step ${first.step}) and ${second.count} (largest step ${second.step}); ${agreed.count} at the same place in both${agreed.count ? `, largest step there ${agreed.step}, box ${agreed.box.join(',')}` : ''}`
  }
  ok = ok && pic.shaders > 0 && base.shaders > 0 && !row.messages.length
  report.rows[`${key} ${name}`] = row
  writeJson(reportFile, report)
  console.log(`  ${name}${row.taken === undefined ? '' : ` (${row.taken} calls)`}: ${note}${said}; ${row.shaders} shaders rewritten${row.missed ? `, ${row.missed} not` : ''}${row.messages.length ? `; messages: ${row.messages.slice(0, 2).join(' | ')}` : ''}  ${ok ? 'pass' : 'FAIL'}`)
  return ok
}

let failed = 0
let rows = 0
try {
  for (const key of keys) {
    const spec = stillSpec({ key, format, tier, live: live || undefined, assets: assets || undefined })
    if (repeat) {
      console.log(`${key}:`)
      for (const m of modes) {
        const firstOne = await picture(spec, key, m, true, 'r1', true)
        for (let i = 2; i <= repeat; i++) {
          const next = await picture(spec, key, m, true, `r${i}`, true)
          const c = await differ(firstOne.file, next.file)
          rows++
          if (c.count) failed++
          console.log(`  ${tag(m, true)}, render ${i} against render 1: ${c.count ? `${c.count} pixels differ, largest step ${c.step}, box ${c.box.join(',')}` : 'the same picture'}; ${next.shaders} shaders rewritten${next.missed ? `, ${next.missed} not` : ''}`)
        }
      }
      continue
    }
    const fresh = (turn) => turn !== ''
    const sameOf = (m) => (turn) => picture(spec, key, m, true, turn, fresh(turn))
    if (against === 'same') console.log(`${key}:`)
    else {
      const first = await plainPicture(spec, key)
      console.log(`${key}: plain ${first.reused ? 'kept' : 'rendered'}`)
    }
    for (const m of modes) {
      const get = (turn) => picture(spec, key, m, same, turn, fresh(turn))
      rows++
      if (against === 'both') {
        // Against the plain picture first, once: a row inside the limits there is done.
        const pic = await get('')
        const plain = await plainPicture(spec, key)
        const c = await differ(plain.file, pic.file)
        if (within(c) && pic.shaders > 0 && !pic.messages.length) {
          report.rows[`${key} ${tag(m)}`] = { key, mode: tag(m), against: 'plain', taken: pic.taken, shaders: pic.shaders, missed: pic.missed, ...c, messages: [], seconds: pic.seconds }
          writeJson(reportFile, report)
          console.log(`  ${tag(m)} against plain${pic.taken === undefined ? '' : ` (${pic.taken} calls)`}: ${c.count} pixels differ${c.count ? `, largest step ${c.step}, box ${c.box.join(',')}` : ''}; ${pic.shaders} shaders rewritten${pic.missed ? `, ${pic.missed} not` : ''}  pass`)
          continue
        }
        const note = `${c.count} pixels differ from the plain picture (largest step ${c.step}), so read against same: `
        if (!(await read(key, `${tag(m)} against same`, tag(m), get, sameOf(m), note))) failed++
        continue
      }
      const ref = against === 'same' ? sameOf(m) : (turn) => plainPicture(spec, key, turn)
      if (!(await read(key, `${tag(m)}${against === 'same' ? ' against same' : ' against plain'}`, tag(m), get, ref))) failed++
    }
    // The guards rows. The pictures were made for the rows above, so a row costs no render unless it has to be read
    // on the --same pictures or read again.
    if (against !== 'plain' && !only) {
      for (const m of modes) {
        const parts = m.split('+')
        if (!parts.includes('noguard')) continue
        const bare = parts.filter((p) => p !== 'noguard').join('+')
        if (!modes.includes(bare)) continue
        rows++
        let note = ''
        if (against === 'both') {
          const withGuards = await picture(spec, key, bare, false)
          const without = await picture(spec, key, m, false)
          const c = await differ(withGuards.file, without.file)
          if (within(c)) {
            report.rows[`${key} guards ${bare}`] = { key, mode: `guards ${bare}`, against: 'each other', shaders: without.shaders, missed: without.missed, ...c, messages: [], seconds: 0 }
            writeJson(reportFile, report)
            console.log(`  guards (${bare} against ${m}): ${c.count} pixels differ${c.count ? `, largest step ${c.step}, box ${c.box.join(',')}` : ''}  pass`)
            continue
          }
          note = `${c.count} pixels differ between ${bare} and ${m} (largest step ${c.step}), so read on their --same pictures: `
        }
        const get = (turn) => picture(spec, key, m, true, turn)
        const ref = (turn) => picture(spec, key, bare, true, turn)
        if (!(await read(key, `guards (${bare} same against ${m} same)`, `guards ${bare}`, get, ref, note))) failed++
      }
    }
  }
} finally {
  await session.close()
}
const through = `${live ? ` through the app's own path at ${live}` : ''}${assets ? ` with the ${assets} set` : ''}`
const reading = against === 'same' ? 'each row read against its own --same picture' : against === 'plain' ? 'each row read against the plain picture' : 'each row read against the plain picture, and against its own --same picture where that one differs'
const drawn = `engine ${engine}, drawn by ${renderer}`
if (repeat) {
  console.log(failed ? `strict: ${failed} of ${rows} renders are not the picture of the first render${through} (${drawn})` : `strict: the same, ${keys.length} keys${through} under ${modes.map((m) => tag(m, true)).join(', ')}, each rendered ${repeat} times (${drawn}): every render is the same picture, pixel for pixel`)
  process.exit(failed ? 1 : 0)
}
console.log(failed ? `strict: ${failed} FAILED${through}, ${reading} (${drawn})` : `strict: pass, ${keys.length} keys${through} under ${modes.map((m) => tag(m)).join(', ')}, ${reading} (${drawn}): no pixel moves by more than ${MAX_STEP} level, at most ${(MAX_SHARE * 100).toFixed(2)}% of pixels move`)
process.exit(failed ? 1 : 0)
