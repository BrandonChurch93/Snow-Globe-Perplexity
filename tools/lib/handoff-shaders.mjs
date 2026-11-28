// What the shader compiler of this machine wrote, program by program, and what the card answers to the maths probe.
// Used by the doctor of the render handoff and by the proof workflow. It reads and never changes what is drawn: the
// page's own calls go through untouched, and a second small canvas asks the maths probe its questions.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Runs in the page before any script of the build. It notes the source of every shader and which shaders a program
 * holds, and keeps the log of every program whose log is not empty, with the shader as the browser translated it for
 * the graphics system of the machine (HLSL under Direct3D, Metal's language on a Mac), when the browser gives it.
 */
export const SHADER_WATCH = `(() => {
  if (window.__shaderWatch) return
  const protos = []
  if (typeof WebGL2RenderingContext !== 'undefined') protos.push(WebGL2RenderingContext.prototype)
  if (typeof WebGLRenderingContext !== 'undefined') protos.push(WebGLRenderingContext.prototype)
  const stages = new WeakMap()
  const sources = new WeakMap()
  const attached = new WeakMap()
  const recorded = new WeakSet()
  const linked = []
  const logs = []
  const record = (gl, program, log, raw) => {
    if (recorded.has(program)) return
    recorded.add(program)
    let ext = null
    try { ext = gl.getExtension('WEBGL_debug_shaders') } catch (e) {}
    const shaders = (attached.get(program) || []).map((s) => {
      let translated = ''
      try { if (ext && gl.isShader(s)) translated = String(ext.getTranslatedShaderSource(s) || '') } catch (e) {}
      return { stage: stages.get(s) || '', source: sources.get(s) || '', translated }
    })
    logs.push({ log: String(log), askedBy: raw ? 'this tool' : 'the page', shaders })
  }
  for (const W of protos) {
    const createShader = W.createShader
    const shaderSource = W.shaderSource
    const attachShader = W.attachShader
    const linkProgram = W.linkProgram
    const getProgramInfoLog = W.getProgramInfoLog
    W.createShader = function (type) {
      const s = createShader.call(this, type)
      try { if (s) stages.set(s, type === this.VERTEX_SHADER ? 'vertex' : 'fragment') } catch (e) {}
      return s
    }
    W.shaderSource = function (shader, source) {
      try { sources.set(shader, String(source)) } catch (e) {}
      return shaderSource.call(this, shader, source)
    }
    W.attachShader = function (program, shader) {
      try { const l = attached.get(program) || []; l.push(shader); attached.set(program, l) } catch (e) {}
      return attachShader.call(this, program, shader)
    }
    W.linkProgram = function (program) {
      try { linked.push({ gl: this, program, raw: getProgramInfoLog }) } catch (e) {}
      return linkProgram.call(this, program)
    }
    W.getProgramInfoLog = function (program) {
      const log = getProgramInfoLog.call(this, program)
      try { if (log && String(log).trim()) record(this, program, log, false) } catch (e) {}
      return log
    }
  }
  window.__shaderWatch = {
    collect() {
      // the programs the page never asked about: asked now, so that no program's log is missed
      for (const l of linked) {
        try {
          if (recorded.has(l.program) || l.gl.isContextLost() || !l.gl.isProgram(l.program)) continue
          const log = l.raw.call(l.gl, l.program)
          if (log && String(log).trim()) record(l.gl, l.program, log, true)
        } catch (e) {}
      }
      return { linked: linked.length, logs }
    },
  }
})()`

/** Makes every page of this browser carry the watch. Wraps the browser's own newContext; nothing of the tools changes. */
export function watchShaders(browser) {
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async (options) => {
    const context = await newContext(options)
    await context.addInitScript(SHADER_WATCH)
    return context
  }
}

/** What the watch gathered on a page: { linked, logs } or null where the watch did not run. */
export const collectShaders = (page) => page.evaluate(() => (window.__shaderWatch ? window.__shaderWatch.collect() : null)).catch(() => null)

// three.js writes `#define SHADER_NAME` and the material's name behind it. A material without a name leaves the line empty.
const nameOf = (source) => /#define[ \t]+SHADER_NAME[ \t]+(\S+)/.exec(source ?? '')?.[1] ?? ''

/** One message of the compiler: `(1185,1): warning X4000: use of potentially uninitialized variable (f_x)`. */
export function parseMessage(line) {
  const m = /^\s*\(?(\d+),(\d+)(?:-(\d+))?\)?:\s*(warning|error)\s+([A-Z]+\d+):\s*(.*)$/i.exec(line)
  if (m) return { line: Number(m[1]), column: Number(m[2]), columnEnd: m[3] ? Number(m[3]) : null, kind: m[4].toLowerCase(), code: m[5], text: m[6].trim() }
  const text = line.trim()
  return text ? { line: null, column: null, columnEnd: null, kind: /error/i.test(text) ? 'error' : 'warning', code: '', text } : null
}

/**
 * The names a name of the translation may have in the shader's own source, the likeliest first: f_glassSeen_int is
 * the function glassSeen that takes an int, f_far_side the function far_side or the function far that takes a side.
 */
export function ownNames(translated) {
  const m = /^f_(.+)$/.exec(translated)
  if (!m) return [translated.replace(/^_/, '')]
  const parts = m[1].split('_')
  const out = []
  for (let n = parts.length; n >= 1; n--) out.push(parts.slice(0, n).join('_'))
  return out
}

/** Where a function is written in a shader's source: the number of its line and the line. */
export function whereWritten(source, name) {
  if (!source || !name) return null
  const lines = source.split(/\r?\n/)
  const re = new RegExp(`^\\s*(?:(?:highp|mediump|lowp)\\s+)?[A-Za-z_][A-Za-z0-9_]*\\s+${name.replace(/[^A-Za-z0-9_]/g, '')}\\s*\\(`)
  const at = lines.findIndex((l) => re.test(l))
  return at < 0 ? null : { line: at + 1, text: lines[at].trim().slice(0, 160) }
}

/**
 * The text the compiler was given. Chrome under Direct3D gives back the translation twice: first as it began, then,
 * between the marks COMPILER INPUT HLSL BEGIN and END, as the compiler read it. The compiler counts its lines in the
 * second: its line 1 is the second line after the mark (measured on three messages whose columns fit only there).
 */
export function compilerInput(translated) {
  const lines = String(translated ?? '').split(/\r?\n/)
  const b = lines.findIndex((l) => /COMPILER INPUT HLSL BEGIN/.test(l))
  if (b < 0) return { lines, marked: false }
  const e = lines.findIndex((l, i) => i > b && /COMPILER INPUT HLSL END/.test(l))
  return { lines: lines.slice(b + 2, e < 0 ? undefined : e), marked: true }
}

const FN_HEAD = /^\s*([A-Za-z_][A-Za-z0-9_<>]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;]*$/
const NOT_A_TYPE = ['return', 'else', 'if', 'for', 'while', 'do', 'switch', 'case']
/** The functions of a text the compiler was given: name, first line and last line, counted as the compiler counts. */
export function functionsOf(lines) {
  const out = []
  let depth = 0
  let open = null
  lines.forEach((l, i) => {
    if (depth === 0 && !open) {
      const m = FN_HEAD.exec(l)
      if (m && !NOT_A_TYPE.includes(m[1])) open = { name: m[2], from: i + 1, to: i + 1, began: false }
    }
    for (const c of l.replace(/\/\/.*$/, '')) {
      if (c === '{') {
        depth++
        if (open) open.began = true
      } else if (c === '}') depth = Math.max(0, depth - 1)
    }
    if (open && open.began && depth === 0) {
      open.to = i + 1
      out.push({ name: open.name, from: open.from, to: open.to })
      open = null
    }
  })
  return out
}
/** The function a line of the compiler's count lies in: its name there, or '' when the line lies in none. */
export function enclosing(translated, line) {
  if (!translated || !line) return ''
  return functionsOf(compilerInput(translated).lines).find((f) => line >= f.from && line <= f.to)?.name ?? ''
}
/** The functions of the compiler's text that call a function of it, at most six names. */
export function callersOf(translated, name) {
  if (!translated || !name) return []
  const { lines } = compilerInput(translated)
  const re = new RegExp(`(^|[^A-Za-z0-9_])${name}\\s*\\(`)
  return functionsOf(lines).filter((f) => f.name !== name && lines.slice(f.from, f.to).some((l) => re.test(l))).map((f) => f.name).slice(0, 6)
}

const GLSL_TYPE = '(?:void|float|int|uint|bool|[biu]?vec[234]|mat[234](?:x[234])?)'
const srcCache = new Map()
function srcFiles(dir) {
  if (srcCache.has(dir)) return srcCache.get(dir)
  const out = []
  const walk = (d) => {
    let names = []
    try {
      names = fs.readdirSync(d, { withFileTypes: true })
    } catch {}
    for (const n of names) {
      const f = path.join(d, n.name)
      if (n.isDirectory()) walk(f)
      else if (/\.(ts|js|glsl)$/.test(n.name) && !/\.test\./.test(n.name)) out.push({ file: f, lines: fs.readFileSync(f, 'utf8').split(/\r?\n/) })
    }
  }
  walk(dir)
  srcCache.set(dir, out)
  return out
}
/** Where a shader function is written in the tree: `src/globe/shell.ts:431`, every place, at most four. */
const whereCache = new Map()
export function whereInTree(srcDir, name) {
  if (!srcDir || !name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return []
  const key = `${srcDir}\n${name}`
  if (!whereCache.has(key)) whereCache.set(key, findInTree(srcDir, name))
  return whereCache.get(key)
}
function findInTree(srcDir, name) {
  const re = new RegExp(`^\\s*(?:(?:highp|mediump|lowp)\\s+)?${GLSL_TYPE}\\s+${name}\\s*\\(`)
  const out = []
  for (const { file, lines } of srcFiles(srcDir)) {
    lines.forEach((l, i) => {
      if (re.test(l)) out.push(`${path.relative(path.dirname(srcDir), file).split(path.sep).join('/')}:${i + 1}`)
    })
  }
  return out.slice(0, 4)
}

/** The files of the tree that hold the functions of a shader's own source, each with the functions found there. */
export function filesOf(source, srcDir) {
  const out = new Map()
  if (!source || !srcDir) return out
  const re = new RegExp(`^\\s*(?:(?:highp|mediump|lowp)\\s+)?${GLSL_TYPE}\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(`)
  const names = new Set()
  for (const l of source.split(/\r?\n/)) {
    const m = re.exec(l)
    if (m && m[1] !== 'main') names.add(m[1])
  }
  for (const name of names) {
    for (const at of whereInTree(srcDir, name)) {
      const file = at.replace(/:\d+$/, '')
      out.set(file, [...(out.get(file) ?? []), name])
    }
  }
  return out
}

/**
 * What tells a program apart where the library gave its shaders no name: the files of the tree its fragment shader's
 * functions are written in, the ones the fewest programs share first.
 */
export function toldApart(entries, srcDir, most = 4) {
  const maps = entries.map((e) => filesOf(e.frag?.source, srcDir))
  const shared = new Map()
  for (const m of maps) for (const f of m.keys()) shared.set(f, (shared.get(f) ?? 0) + 1)
  return maps.map((m) =>
    [...m.entries()]
      .sort((a, b) => shared.get(a[0]) - shared.get(b[0]) || (a[0] < b[0] ? -1 : 1))
      .slice(0, most)
      .map(([f, names]) => `${f} (${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''})`),
  )
}

/** The function of the shader's own source that a name of the translation stands for, with where it is written. */
function ownFunction(e, translatedName, srcDir) {
  for (const own of ownNames(translatedName)) {
    const f = whereWritten(e.frag?.source, own)
    const v = whereWritten(e.vert?.source, own)
    if (f || v) return { own, f, v, tree: whereInTree(srcDir, own) }
  }
  return null
}

const lineOf = (text, n) => {
  if (!text || !n) return null
  const l = compilerInput(text).lines[n - 1]
  return l === undefined ? null : l.trim().slice(0, 220)
}

const body = (source) =>
  crypto
    .createHash('sha256')
    .update(String(source ?? '').split(/\r?\n/).filter((l) => !/^\s*#define\b/.test(l)).join('\n'))
    .digest('hex')
    .slice(0, 12)

/** The programs with a log, sorted into different ones: the same shaders with the same messages are one entry. */
export function sortLogs(seen) {
  const entries = new Map()
  for (const p of seen?.logs ?? []) {
    const frag = p.shaders.find((s) => s.stage === 'fragment') ?? null
    const vert = p.shaders.find((s) => s.stage === 'vertex') ?? null
    const fragment = nameOf(frag?.source) || (frag ? 'no name' : 'none')
    const vertex = nameOf(vert?.source) || (vert ? 'no name' : 'none')
    const messages = p.log.split(/\r?\n/).map(parseMessage).filter(Boolean)
    // one entry for the programs made from the same two shaders with other switches: their text is the same but
    // for the lines that begin with #define, and the compiler says the same of them at other places
    const key = `${fragment}\n${vertex}\n${body(frag?.source)}\n${body(vert?.source)}\n${[...new Set(messages.map((m) => `${m.code} ${m.text}`))].join('\n')}`
    const places = [...new Set(messages.filter((m) => m.line).map((m) => `(${m.line},${m.column}${m.columnEnd ? `-${m.columnEnd}` : ''})`))].join(' ')
    const had = entries.get(key)
    if (had) {
      had.programs++
      had.others.push(places)
      continue
    }
    entries.set(key, { fragment, vertex, programs: 1, askedBy: p.askedBy, log: p.log.trim(), messages, frag, vert, others: [] })
  }
  return [...entries.values()]
}

const treeSaid = (fn) => `${fn.own}${fn.tree.length ? `, written at ${fn.tree.join(' and ')}` : ', not written under src: the library has it'}`
/** In one line, the function of the tree a message is about. */
function aboutOf(e, m, named, srcDir) {
  const inside = m.line ? enclosing(e.frag?.translated, m.line) || enclosing(e.vert?.translated, m.line) : ''
  const fn = ownFunction(e, named || inside, srcDir)
  if (fn) return treeSaid(fn)
  if (!inside) return m.line ? 'no function: the place lies in none' : 'no place given'
  // a helper the browser wrote itself: say which functions of the shader call it
  const callers = [...callersOf(e.frag?.translated, inside), ...callersOf(e.vert?.translated, inside)]
  const own = [...new Set(callers.map((c) => ownFunction(e, c, srcDir)).filter(Boolean).map(treeSaid))]
  return `${inside}, a helper the browser wrote${own.length ? `; called by ${own.join('; ')}` : callers.length ? `; called by ${callers.join(', ')} of the translation` : ''}`
}

/** The list as text. Each entry: the program, its log in full, and for each message what can be said of its place. */
export function shaderList(seen, head = [], { srcDir = '' } = {}) {
  const entries = sortLogs(seen)
  const out = [...head]
  if (!seen) {
    out.push('the watch did not run on this page: nothing can be said')
    return out.join('\n') + '\n'
  }
  const errors = entries.reduce((n, e) => n + e.messages.filter((m) => m.kind === 'error').length, 0)
  out.push(`programs linked by the page: ${seen.linked}; programs whose log is not empty: ${seen.logs.length}; different ones (other shaders or other messages): ${entries.length}; messages that are errors: ${errors}`)
  const marked = entries.some((e) => compilerInput(e.frag?.translated).marked || compilerInput(e.vert?.translated).marked)
  out.push('The place (line,column) is the compiler\'s own count in the text it was given. The browser gives that text back, and the line of that number')
  out.push(marked ? 'is printed under each message, counted from the mark COMPILER INPUT HLSL BEGIN of the translation (in the files beside this list).' : 'is printed under each message; this browser marks no compiler input in its translation, so read the line as near, not as exact.')
  out.push('')
  // every different message once, with the function it is about and where that function is written in the tree
  const digest = new Map()
  for (const e of entries) {
    const here = new Set()
    for (const m of e.messages) {
      const named = /\(([A-Za-z_][A-Za-z0-9_]*)\)\s*$/.exec(m.text)?.[1]
      const about = aboutOf(e, m, named, srcDir)
      const key = `${m.kind} ${m.code}: ${m.text}\n${about}`
      const d = digest.get(key) ?? { text: `${m.kind} ${m.code}: ${m.text}`, about, programs: 0, times: 0 }
      d.times += e.programs
      if (!here.has(key)) d.programs += e.programs
      here.add(key)
      digest.set(key, d)
    }
  }
  if (digest.size) {
    out.push(`the different messages, each once (${digest.size}), with the function each is about and how many programs carry it:`)
    for (const d of [...digest.values()].sort((a, b) => b.programs - a.programs)) out.push(`  ${String(d.programs).padStart(4)} ${d.programs === 1 ? 'program ' : 'programs'}  ${d.text}`, `                 in ${d.about}`)
    out.push('', 'then every different program, with its log in full:', '')
  }
  const apart = toldApart(entries, srcDir)
  entries.forEach((e, i) => {
    const lines = (t) => (t ? t.split(/\r?\n/).length : 0)
    out.push(`== ${i + 1}. fragment shader "${e.fragment}" (${lines(e.frag?.source)} lines), vertex shader "${e.vertex}" (${lines(e.vert?.source)} lines): ${e.programs} ${e.programs === 1 ? 'program' : 'programs'} with these messages (asked by ${e.askedBy}) ==`)
    if (apart[i].length) out.push(`its fragment shader holds functions written in: ${apart[i].join('; ')}`)
    out.push(e.programs === 1 ? 'the log in full:' : 'the log of the first of them in full:')
    for (const l of e.log.split(/\r?\n/)) out.push(`  ${l}`)
    if (e.others.length) out.push(`the same messages in the other ${e.others.length === 1 ? 'program' : `${e.others.length} programs`} (the same two shaders with other switches) stand at: ${e.others.join(' | ')}`)
    const told = new Set()
    for (const m of e.messages) {
      const named = /\(([A-Za-z_][A-Za-z0-9_]*)\)\s*$/.exec(m.text)?.[1]
      const key = `${m.code} ${m.text} ${m.line}`
      if (told.has(key)) continue
      told.add(key)
      out.push(`- ${m.kind} ${m.code}${m.line ? ` at (${m.line},${m.column}${m.columnEnd ? `-${m.columnEnd}` : ''})` : ''}: ${m.text}`)
      const said = (name, fn) => {
        if (!fn) return out.push(`    "${name}" was not found as a function of either shader's own source`)
        if (fn.f) out.push(`    "${name}" is ${fn.own} of the fragment shader's own source, line ${fn.f.line}: ${fn.f.text}`)
        if (fn.v) out.push(`    "${name}" is ${fn.own} of the vertex shader's own source, line ${fn.v.line}: ${fn.v.text}`)
        if (fn.tree.length) out.push(`    ${fn.own} is written in the tree at ${fn.tree.join(' and ')}`)
      }
      if (named) said(named, ownFunction(e, named, srcDir))
      if (m.line) {
        const inside = enclosing(e.frag?.translated, m.line) || enclosing(e.vert?.translated, m.line)
        if (inside && inside !== named) {
          const fn = ownFunction(e, inside, srcDir)
          if (fn) said(inside, fn)
          else out.push(`    the place lies in ${aboutOf(e, m, '', srcDir)}`)
        }
        const f = lineOf(e.frag?.translated, m.line)
        const v = lineOf(e.vert?.translated, m.line)
        if (f !== null) out.push(`    line ${m.line} of the fragment shader as the compiler read it: ${f || '(an empty line)'}`)
        if (v !== null) out.push(`    line ${m.line} of the vertex shader as the compiler read it: ${v || '(an empty line)'}`)
        if (f === null && v === null) out.push(e.frag?.translated || e.vert?.translated ? `    neither translated shader has a line ${m.line}` : '    the browser gave back no translated shader')
      }
    }
    out.push('')
  })
  if (!entries.length) out.push('no program wrote a message')
  return out.join('\n') + '\n'
}

/** Writes the shaders of every entry beside the list, own source and translation, so that a place can be looked up. */
export function writeShaders(seen, dir) {
  const entries = sortLogs(seen)
  if (!entries.length) return []
  fs.mkdirSync(dir, { recursive: true })
  const files = []
  entries.forEach((e, i) => {
    const stem = `${String(i + 1).padStart(2, '0')}-${(nameOf(e.frag?.source) || 'no-name').replace(/[^A-Za-z0-9_.-]/g, '_')}`
    for (const [s, stage] of [[e.frag, 'fragment'], [e.vert, 'vertex']]) {
      if (!s) continue
      if (s.source) files.push(write(path.join(dir, `${stem}.${stage}.own.glsl`), s.source))
      if (s.translated) files.push(write(path.join(dir, `${stem}.${stage}.translated.txt`), s.translated))
    }
  })
  return files
}
const write = (file, text) => {
  fs.writeFileSync(file, text)
  return file
}

/**
 * The maths probe of the tree (src/core/maths.ts), as the build holds it: what the card and its shader compiler
 * answer where the language leaves the answer open. Asked on a small canvas of its own on the page given.
 * Returns { lines } or { problem }.
 */
export async function mathsProbe(page, distDir) {
  let chunk = ''
  try {
    chunk = fs.readdirSync(path.join(distDir, 'assets')).find((n) => /^maths-.*\.js$/.test(n)) ?? ''
  } catch {}
  if (!chunk) return { problem: 'the build holds no maths probe (no assets/maths-*.js in dist)' }
  try {
    return await page.evaluate(async (name) => {
      const m = await import(new URL(`assets/${name}`, location.href).href)
      if (typeof m.mathsReport !== 'function') return { problem: 'the maths probe of the build has no mathsReport' }
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 4
      const gl = canvas.getContext('webgl2')
      if (!gl) return { problem: 'the page gave no second WebGL2 context for the maths probe' }
      const lines = m.mathsReport({ gl, renderer: { resetState() {} } })
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {}
      return lines.length ? { lines } : { problem: 'the card would not run the maths probe (its program did not link, or its target was not whole)' }
    }, chunk)
  } catch (e) {
    return { problem: `the maths probe could not be asked: ${String(e.message).split('\n')[0]}` }
  }
}

/** The answer to one question of the probe: `isnan(nan) 1.00` gives `1.00` for `isnan(nan)`. */
export const mathsAnswer = (lines, question) => {
  const l = (lines ?? []).find((x) => x.startsWith(`${question} `))
  return l === undefined ? null : l.slice(question.length + 1)
}

/** The frames that are drawn so that every program of the film and of the loop is compiled once. */
export const WALK = { 'film-b': [0, 120, 675, 720, 1000, 1440, 1720, 2160, 2440, 2880, 3599], loop: [0, 240] }

/**
 * Opens the film's own page as the render opens it, draws the frames of WALK small and in one sample, and gathers
 * what the shader compiler wrote about every program, with the answers of the maths probe. `lib` is the folder
 * tools/lib of the clone whose page is opened. It draws nothing that is kept.
 */
export async function walkShaders({ lib, dist, local = true, say = () => {}, frames = WALK, formatId = 'preview' }) {
  const from = (name) => import(pathToFileURL(path.join(lib, name)).href)
  const { Session, cfg, formatById } = await from('page.mjs')
  const { Run } = await from('frames.mjs')
  const format = formatById(formatId)
  const session = await Session.open({ local, what: 'shader list', say })
  const seen = { linked: 0, logs: [] }
  // one page may serve film B and the loop: what a page holds is read after each and counted once
  const pages = new Map()
  const out = { renderer: '', browser: session.browserVersion, format: { width: format.width, height: format.height }, frames, maths: null, drawn: [], notDrawn: [], errors: [], seen }
  try {
    watchShaders(session.browser)
    const run = new Run(session, { by: 'shader list', looks: false, say })
    for (const what of Object.keys(frames)) {
      const track = { kind: what === 'loop' ? 'loop' : 'film', name: what, format, tier: 'samples-1', assets: 'full', fps: cfg.film.fps, step: 1 }
      const page = await run.page(track)
      out.renderer ||= await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2')
        const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
        return gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'no WebGL'
      })
      for (const frame of frames[what]) {
        const t0 = Date.now()
        try {
          const png = await run.frame(track, page, frame)
          out.drawn.push(`${what} frame ${frame}: drawn in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${png.length} bytes`)
        } catch (e) {
          out.notDrawn.push(`${what} frame ${frame}: ${String(e.message).split('\n')[0]}`)
          out.drawn.push(`${what} frame ${frame}: NOT DRAWN: ${String(e.message).split('\n')[0]}`)
        }
        say(out.drawn.at(-1))
      }
      out.maths ??= await mathsProbe(page, dist)
      const got = await collectShaders(page)
      if (got) pages.set(page, { got, errors: [...(page.errors ?? [])] })
      else out.drawn.push(`${what}: the watch did not run on its page`)
    }
  } finally {
    await session.close().catch(() => {})
  }
  for (const { got, errors } of pages.values()) {
    seen.linked += got.linked
    seen.logs.push(...got.logs)
    for (const e of errors) if (!/Program Info Log/.test(e)) out.errors.push(e)
  }
  out.errors = [...new Set(out.errors)]
  return out
}

/** The head of the list a walk writes: where it was drawn, the maths probe's answers, the frames. */
export function walkHead(w, first = []) {
  return [
    ...first,
    `drawn by  ${w.renderer}`,
    `browser   Chrome ${w.browser}${process.env.SHOWCASE_LOCAL_ARGS ? `, started with ${process.env.SHOWCASE_LOCAL_ARGS}` : ''}`,
    `pages     the build's own film page, ${w.format.width} x ${w.format.height}, one sample a frame; ${Object.entries(w.frames).map(([what, list]) => `${what} frames ${list.join(', ')}`).join('; ')}`,
    '',
    'the maths probe (src/core/maths.ts), each question with what this card and its shader compiler answer:',
    ...(w.maths?.lines ? w.maths.lines.map((l) => `  ${l}`) : [`  ${w.maths?.problem ?? 'not asked'}`]),
    '',
    'the frames:',
    ...w.drawn.map((l) => `  ${l}`),
    '',
    ...(w.errors.length ? ['what else the pages wrote (not from a program log):', ...w.errors.map((l) => `  ${l}`), ''] : ['the pages wrote nothing else: no error and no other warning', '']),
  ]
}

/** The entries of a list without the shaders' text: what a json file keeps. */
export const briefLogs = (seen) => sortLogs(seen).map((e) => ({ fragment: e.fragment, vertex: e.vertex, programs: e.programs, messages: e.messages }))
