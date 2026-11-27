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
// Between the two, a row over the limits against the plain picture is read by its answers: the mode is drawn three
// times more, with every open case answering 0 (`as0`), 0.577 (`asunit`, a number of ordinary size, and a vector of
// length one where the answer is a vector) and 1e30 (`asbig`) instead of no number. The four builds have the same
// wrappers, the same tests and the same choices and differ in that one answer alone, so a picture that is the same
// under all four, within the limits, holds no pixel the answer of an open case reaches, whatever a graphics card
// answers there, and what it differs from the plain picture by is the wrappers' form. Such a row passes and says the
// counts. Only a row whose four pictures are not the same goes on to its --same picture. This reading was put in
// because under lavapipe the --same picture is no sound measure where the mode's is: winter in its shake through the
// app's own path at high is one picture to the byte under the answers of all+smooth, two pixels from the plain
// picture, and 754 pixels from its --same picture (the tree), each of them the same picture on every render; three
// calls of normalize alone, where no answer moves a pixel, move 117 pixels of the --same picture.
// A row that passes by its answers says only that no answer reaches the picture as the mode stands. With the guards
// on, a guard may be what holds an answer back: the noguard row of the same mode says so, read the same way.
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
// --paint native|answer is for finding the call: it draws no row but a picture in which a pixel is painted where a
// wrapper's own test was true, that is where a call met a case GLSL leaves open. `native` lets the open case answer
// what the plain function answers, so the picture is the app's own up to the paint; `answer` keeps the mode's answer,
// which also shows a call that is met only once a call before it has answered a number. The functions are those of
// --only (with its #a-b and ~text), painted red, green and blue by their place in that list; with --digit j the colour
// is instead digit j of the call's number written in threes (0 red, 1 green, 2 blue), so that a few pictures name
// the call. The calls and their numbers are written beside the picture. Only fragment shaders that write
// a colour are painted; a case met in a vertex shader paints the triangles of that vertex. --digit 99 is the paint's
// own control: every wrapper's test counts as true, so every pixel a listed call is run for is painted.
// The paint sees a call only where it is run. A call in a branch that is not taken paints nothing, though a compiler
// may still work it out there; the glass's ring at the limb was such a call and was found by the next three.
// --has text and --hasnot text narrow a run to the shaders whose source holds (or does not hold) `text`, `a|b` for
// either; the other shaders keep their wrappers unused and their guards, so the run names the shader a row comes from.
// In --only, `fn=a.b.c` takes exactly the calls numbered a, b and c. A list of calls to leave out (`fn#a-b!k,m`)
// cannot be given through --only when it holds a comma, because --only is split at commas: only `!k` is read.
// --once reads a failing row a single time and says so ("read once"); for a hunt, never for a judged row.
// --guardpaint paints red where the glass's own guard (NUMBER_GUARD in src/globe/shell.ts) finds no number.
// --probe 'vec4 expr' ends every chosen fragment shader with `gl_FragColor = expr;`, for reading a term of the
// shader as a picture; with --stash 'text', `sm_pre` in the expression is `col` as it stood before that text.
// --same keeps every wrapper as the mode has it, test and choice and all, but makes the open case answer what the
// plain function answers (plus a uniform that is never set, so no compiler can fold the choice away). `dry` cannot
// show what the wrappers alone change, because a wrapper that only calls the plain function is compiled as the plain
// function. A picture that differs from the plain one under --same differs by the wrappers alone; what an open case
// does to a picture is the difference between the mode's picture and the --same picture of that mode. A run with
// --same is always read against the plain picture.
import crypto from 'node:crypto'
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
// The other answers an open case is given when a row is read by its answers (tools/lib/strict.mjs), and their names.
const ANSWERS = ['as0', 'asunit', 'asbig']
const SAYS = { as0: '0', asunit: '0.577', asbig: '1e30' }

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
const has = text('has', '')
const probe = text('probe', '')
const hasnot = text('hasnot', '')
const same = args.same === true
const paint = text('paint', '')
if (paint && paint !== 'native' && paint !== 'answer') throw new Error(`--paint takes native or answer, not ${paint}`)
if (paint && !only) throw new Error('--paint needs --only: the functions to paint')
const digit = args.digit === undefined || args.digit === true ? -1 : Number(args.digit)
const against = same ? 'plain' : text('against', 'both')
if (against !== 'same' && against !== 'plain' && against !== 'both') throw new Error(`--against takes plain or same, not ${against}`)
const repeat = Number(text('repeat', '0'))
const renderer = rendererName(false)
const sub = [live ? `live-${live}` : '', assets].filter(Boolean).join('-')
const root = sub ? rel('out', 'work', 'strict', sub) : rel('out', 'work', 'strict')
const tag = (mode, s = same) => (mode === 'none' ? mode : `${mode}${s ? ' same' : ''}${only ? ` only ${only}` : ''}${has ? ` has ${has}` : ''}${probe ? ` probe ${crypto.createHash('sha256').update(probe + text('stash', '')).digest('hex').slice(0, 8)}` : ''}${hasnot ? ` hasnot ${hasnot}` : ''}${paint ? ` paint ${paint}${digit >= 0 ? ` digit ${digit}` : ''}` : ''}${args.guardpaint === true ? ' guardpaint' : ''}`)
// A long narrowing would make a folder name no disk takes: past 120 characters it is cut and ends in a hash of the whole.
const folder = (mode, s = same) => {
  const name = tag(mode, s).replace(/[^a-zA-Z0-9]+/g, '_')
  return path.join(root, name.length > 120 ? `${name.slice(0, 100)}_${crypto.createHash('sha256').update(tag(mode, s)).digest('hex').slice(0, 12)}` : name)
}
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
      just: rest.match(/=([\d.]+)/) ? new Set(rest.match(/=([\d.]+)/)[1].split('.').filter(Boolean).map(Number)) : undefined,
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
          const take = k >= pick.lo && k < pick.hi && !pick.skip.has(k) && (pick.just === undefined || pick.just.has(k)) && (pick.text === undefined || near.includes(pick.text)) && (pick.shader === undefined || name.includes(pick.shader))
          if (take) state.taken.push(line)
          return take ? `${d[2]}(` : hit
        })
      }
      s = head + tail
    }
    return orig.call(this, shader, s)
  }
}

// Runs in the page before STRICT_INIT, so that it is handed each source last, prelude and all. It takes the place of
// NARROW_INIT: the wrappers are copied three times over, one set for each colour, each set marking its colour where
// its test is true, and every chosen call is turned to the set of its colour. The mark is painted at the end of main.
const PAINT_INIT = ({ list, native, digit }) => {
  const picks = new Map()
  String(list).split(',').filter(Boolean).forEach((item, at) => {
    const m = item.match(/^(\w+)(.*)$/)
    const rest = m[2]
    const range = (rest.match(/#(\d+)-(\d+)/) || []).slice(1).map(Number)
    picks.set(m[1], { at, lo: range.length ? range[0] : 0, hi: range.length ? range[1] : Infinity, text: (rest.match(/~([^@#!]+)/) || [])[1] })
  })
  const FAM = ['r', 'g', 'b']
  const state = (window.__paint = { counts: {}, sites: [], taken: [], painted: 0, unpainted: 0 })
  const P = WebGL2RenderingContext.prototype
  const orig = P.shaderSource
  P.shaderSource = function (shader, src) {
    let s = String(src)
    const defs = [...s.matchAll(/#define (\w+) (sm_\w+)\n/g)].filter((d) => d[2] !== 'sm_never')
    if (defs.length && s.includes('float sm_nan()')) {
      const kind = this.getShaderParameter(shader, this.SHADER_TYPE) === this.VERTEX_SHADER ? 'vertex' : 'fragment'
      const first = defs[0].index
      const last = defs[defs.length - 1]
      const cut = last.index + last[0].length
      let head = s.slice(0, cut)
      let tail = s.slice(cut)
      const wrappers = head.split('\n').filter((l) => /^(float|vec[234]) sm_\w+\(/.test(l) && !l.startsWith('float sm_nan()'))
      let sets = `vec3 sm_hit = vec3(0.0);\n${kind === 'vertex' ? 'out' : 'in'} vec3 sm_hitv;\n`
      FAM.forEach((f, i) => {
        for (const t of ['float', 'vec2', 'vec3', 'vec4']) sets += `${t} sm_m${f}(${t} v) { sm_hit[${i}] = 1.0; return v; }\n`
        for (const l of wrappers) {
          let line = l
          const m = l.match(/^(.*\{ return )(.*) \? (.*) : (.*)(; \})$/)
          if (m && l.includes('sm_nan()')) {
            const open = m[3].includes('sm_nan()')
            const answer = native ? (open ? m[4] : m[3]) : open ? m[3] : m[4]
            const test = digit === 99 ? (open ? 'true' : 'false') : m[2]
            line = open ? `${m[1]}${test} ? sm_m${f}(${answer}) : ${m[4]}${m[5]}` : `${m[1]}${test} ? ${m[3]} : sm_m${f}(${answer})${m[5]}`
          }
          sets += line.replace(/\bsm_(?!nan\b|m[rgb]\b)(\w+)\(/g, `sm${f}_$1(`) + '\n'
        }
      })
      for (const d of defs) {
        const pick = picks.get(d[1])
        // A function that is not painted stays plain under `native` and stays as the mode has it under `answer`.
        if (pick || native) head = head.replace(d[0], '')
        if (!pick) continue
        tail = tail.replace(new RegExp(`(?<![\\w.])${d[1]}\\(`, 'g'), (hit, at, whole) => {
          const k = (state.counts[d[1]] = (state.counts[d[1]] ?? -1) + 1)
          const near = whole.slice(at, at + 200)
          const line = `${d[1]} ${k} ${kind}: ${near.slice(0, 150).replace(/\s+/g, ' ')}`
          state.sites.push(line)
          const take = k >= pick.lo && k < pick.hi && (pick.text === undefined || near.includes(pick.text))
          if (!take) return hit
          state.taken.push(line)
          const f = FAM[digit >= 0 && digit < 99 ? Math.floor(k / 3 ** digit) % 3 : pick.at % 3]
          return `${d[2].replace('sm_', `sm${f}_`)}(`
        })
      }
      head = head.slice(0, first) + sets + head.slice(first)
      const mains = [...tail.matchAll(/void\s+main\s*\(\s*(void)?\s*\)\s*\{/g)]
      let done = false
      const wrote = kind === 'vertex' || /gl_FragColor/.test(tail) ? 'gl_FragColor' : (tail.match(/out\s+(?:highp\s+|mediump\s+)?vec4\s+(\w+)\s*;/) || [])[1]
      if (mains.length && wrote) {
        const from = mains[mains.length - 1].index + mains[mains.length - 1][0].length
        let depth = 1
        let j = from
        for (; j < tail.length && depth; j++) depth += tail[j] === '{' ? 1 : tail[j] === '}' ? -1 : 0
        if (!depth) {
          const mark = kind === 'vertex' ? 'sm_hitv = sm_hit;' : `vec3 sm_all = max(sm_hit, step(1e-6, sm_hitv)); if (sm_all.r + sm_all.g + sm_all.b > 0.5) ${wrote} = vec4(sm_all * 4.0, 1.0);`
          tail = `${tail.slice(0, j - 1)}\n  ${mark}\n${tail.slice(j - 1)}`
          done = true
        }
      }
      if (kind === 'fragment') state[done ? 'painted' : 'unpainted']++
      if (!done) (state.left ??= []).push(`${kind}: ${tail.slice(0, 160).replace(/\s+/g, ' ')}`)
      s = head + tail
    }
    return orig.call(this, shader, s)
  }
}

// --guardpaint: the glass's own guard paints instead of clearing: red where its colour is no number, blue where it is
// without end. A picture with paint in it shows where the guard is what holds the picture.
const GUARD_INIT = () => {
  const P = WebGL2RenderingContext.prototype
  const orig = P.shaderSource
  const state = (window.__guard = { found: 0 })
  P.shaderSource = function (shader, src) {
    let s = String(src)
    const m = s.match(/if \(any\((\w+)\(gl_FragColor\)\) \|\| any\((\w+)\(gl_FragColor\)\)\) gl_FragColor = vec4\(0\.0, 0\.0, 0\.0, 1\.0\);/)
    if (m) {
      state.found++
      s = s.replace(m[0], `if (any(${m[1]}(gl_FragColor))) gl_FragColor = vec4(4.0, 0.0, 0.0, 1.0); else if (any(${m[2]}(gl_FragColor))) gl_FragColor = vec4(0.0, 0.0, 4.0, 1.0);`)
    }
    return orig.call(this, shader, s)
  }
}

// --has text / --hasnot text: only the shaders whose source holds one of the texts (a|b), or none of them, are made
// strict. The others keep the wrappers, unused, and keep what `noguard` does to their guards.
const WITHIN_INIT = ({ has, hasnot }) => {
  const P = WebGL2RenderingContext.prototype
  const orig = P.shaderSource
  const state = (window.__within = { strict: 0, plain: 0 })
  P.shaderSource = function (shader, src) {
    let s = String(src)
    if (s.includes('float sm_nan()')) {
      const keep = (!has || has.split('|').some((t) => s.includes(t))) && (!hasnot || !hasnot.split('|').some((t) => s.includes(t)))
      state[keep ? 'strict' : 'plain']++
      if (!keep) s = s.replace(/#define \w+ sm_(?!never)\w+\n/g, '')
    }
    return orig.call(this, shader, s)
  }
}

// --probe expr: the fragment shaders chosen by --has end by writing `expr` (a vec4) as their colour. A picture of what
// a term is, or of where a condition holds, in the shader as it stands.
const PROBE_INIT = ({ has, expr, stash }) => {
  const P = WebGL2RenderingContext.prototype
  const orig = P.shaderSource
  const state = (window.__probe = { put: 0 })
  P.shaderSource = function (shader, src) {
    let s = String(src)
    if (this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER && has.split('|').some((t) => s.includes(t))) {
      // --stash 'text': what `col` holds just before the first place this text stands is kept as sm_pre for the probe.
      if (stash && s.includes(stash)) s = s.replace(stash, `vec3 sm_pre = col;\n  ${stash}`)
      const mains = [...s.matchAll(/void\s+main\s*\(\s*(void)?\s*\)\s*\{/g)]
      if (mains.length) {
        const from = mains[mains.length - 1].index + mains[mains.length - 1][0].length
        let depth = 1
        let j = from
        for (; j < s.length && depth; j++) depth += s[j] === '{' ? 1 : s[j] === '}' ? -1 : 0
        if (!depth) { s = `${s.slice(0, j - 1)}\n  gl_FragColor = ${expr};\n${s.slice(j - 1)}`; state.put++ }
      }
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
  if (mode !== 'none' && args.guardpaint === true) await context.addInitScript(GUARD_INIT)
  if (mode !== 'none' && probe) await context.addInitScript(PROBE_INIT, { has, expr: probe, stash: text('stash', '') })
  if (mode !== 'none' && paint) await context.addInitScript(PAINT_INIT, { list: only, native: paint === 'native', digit })
  if (mode !== 'none' && only && !paint) await context.addInitScript(NARROW_INIT, only)
  // Added after the narrowing so that it runs before it: the calls are then counted in the chosen shaders alone.
  if (mode !== 'none' && (has || hasnot)) await context.addInitScript(WITHIN_INIT, { has, hasnot })
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
    const narrow = only ? await page.evaluate(() => window.__paint || window.__narrow || null) : null
    if (narrow) writeJson(`${file}.calls.json`, narrow)
    await page.context().close()
    report.made[id] = { taken: narrow && /[#~@=]/.test(only) ? narrow.taken.length : undefined, shaders: state ? state.shaders : 0, missed: state ? state.missed : 0, messages: made.record.errors ?? [], seconds: Math.round((Date.now() - t) / 1000) }
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
  if (!ok && args.once === true) said += ' (read once)'
  else if (!ok) {
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
    if (paint) {
      // No row: where each colour was painted, against the plain picture.
      const plain = await pixels((await plainPicture(spec, key)).file)
      for (const m of modes) {
        const pic = await picture(spec, key, m, same, '', true)
        if (pic.messages.length) console.log(`  page messages: ${pic.messages.join(' | ').slice(0, 600)}`)
        const got = await pixels(pic.file)
        const said = ['red', 'green', 'blue'].map((name, c) => {
          let count = 0
          const box = [got.width, got.height, -1, -1]
          for (let p = 0; p < got.width * got.height; p++) {
            const i = p * got.channels
            let far = 0
            for (let k = 0; k < 3; k++) far = Math.max(far, Math.abs(got.data[i + k] - plain.data[i + k]))
            if (far <= 24 || got.data[i + c] < 200 || got.data[i + ((c + 1) % 3)] > 120 && got.data[i + ((c + 2) % 3)] > 120) continue
            count++
            const x = p % got.width
            const y = (p - x) / got.width
            box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y)
          }
          return `${name} ${count}${count ? ` (box ${box.join(',')})` : ''}`
        }).join(', ')
        const all = await differ((await plainPicture(spec, key)).file, pic.file)
        console.log(`  ${tag(m)} (${pic.taken ?? 'all'} calls): painted ${said}; ${all.count} pixels differ from the plain picture; ${pic.shaders} shaders rewritten; ${rel('').length ? path.relative(rel(), pic.file) : pic.file}`)
      }
      continue
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
        let note = `${c.count} pixels differ from the plain picture (largest step ${c.step})`
        // By its answers: the same mode with an open case answering 0, 0.577 and 1e30. Not for a mode that names its answer
        // or is narrowed in its own name.
        if (!/[~#]/.test(m) && !m.split('+').some((p) => p === 'dry' || ANSWERS.includes(p))) {
          const others = []
          for (const answer of ANSWERS) {
            const other = await picture(spec, key, `${m}+${answer}`, same)
            others.push({ answer, ...other, ...(await differ(pic.file, other.file)) })
          }
          const said = others.map((o) => `${o.count} pixels differ with ${SAYS[o.answer]}${o.count ? ` (largest step ${o.step})` : ''}`).join(', ')
          const sound = [pic, ...others].every((p) => p.shaders > 0 && !p.messages.length)
          if (sound && others.every(within)) {
            report.rows[`${key} ${tag(m)}`] = { key, mode: tag(m), against: 'answers', taken: pic.taken, shaders: pic.shaders, missed: pic.missed, ...c, answers: Object.fromEntries(others.map((o) => [o.answer, { count: o.count, step: o.step, box: o.box, share: o.share }])), messages: [], seconds: pic.seconds + others.reduce((n, o) => n + o.seconds, 0) }
            writeJson(reportFile, report)
            console.log(`  ${tag(m)} by its answers${pic.taken === undefined ? '' : ` (${pic.taken} calls)`}: ${note}, box ${c.box.join(',')}, so read by its answers: against the picture with no number ${said}: no answer of an open case reaches the picture, the wrappers' form alone moves it; ${pic.shaders} shaders rewritten${pic.missed ? `, ${pic.missed} not` : ''}  pass`)
            continue
          }
          note += `, and by its answers ${said}`
        }
        note += ', so read against same: '
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
const reading = against === 'same' ? 'each row read against its own --same picture' : against === 'plain' ? 'each row read against the plain picture' : 'each row read against the plain picture, where that one differs by its answers (no number, 0, 0.577 and 1e30), and where those differ against its own --same picture'
const drawn = `engine ${engine}, drawn by ${renderer}`
if (repeat) {
  console.log(failed ? `strict: ${failed} of ${rows} renders are not the picture of the first render${through} (${drawn})` : `strict: the same, ${keys.length} keys${through} under ${modes.map((m) => tag(m, true)).join(', ')}, each rendered ${repeat} times (${drawn}): every render is the same picture, pixel for pixel`)
  process.exit(failed ? 1 : 0)
}
console.log(failed ? `strict: ${failed} FAILED${through}, ${reading} (${drawn})` : `strict: pass, ${keys.length} keys${through} under ${modes.map((m) => tag(m)).join(', ')}, ${reading} (${drawn}): no pixel moves by more than ${MAX_STEP} level, at most ${(MAX_SHARE * 100).toFixed(2)}% of pixels move`)
process.exit(failed ? 1 : 0)
