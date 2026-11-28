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

const nameOf = (source) => /#define\s+SHADER_NAME\s+(\S+)/.exec(source ?? '')?.[1] ?? ''
const firstLine = (source) => (String(source ?? '').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('//') && !l.startsWith('precision')) ?? '').slice(0, 100)

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

const lineOf = (text, n) => {
  if (!text || !n) return null
  const l = text.split(/\r?\n/)[n - 1]
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
    const fragment = nameOf(frag?.source) || (frag ? `no name; it begins: ${firstLine(frag.source)}` : 'none')
    const vertex = nameOf(vert?.source) || (vert ? `no name; it begins: ${firstLine(vert.source)}` : 'none')
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

/** The list as text. Each entry: the program, its log in full, and for each message what can be said of its place. */
export function shaderList(seen, head = []) {
  const entries = sortLogs(seen)
  const out = [...head]
  if (!seen) {
    out.push('the watch did not run on this page: nothing can be said')
    return out.join('\n') + '\n'
  }
  const errors = entries.reduce((n, e) => n + e.messages.filter((m) => m.kind === 'error').length, 0)
  out.push(`programs linked by the page: ${seen.linked}; programs whose log is not empty: ${seen.logs.length}; different ones (other shaders or other messages): ${entries.length}; messages that are errors: ${errors}`)
  out.push('The place (line,column) is the compiler\'s own count in the shader it was given. The browser gives back the shader it translated, and the')
  out.push('line of that number is printed under each message; the compiler may count a few lines more than that text holds, so read the line as near, not as exact.')
  out.push('')
  entries.forEach((e, i) => {
    out.push(`== ${i + 1}. fragment shader "${e.fragment}", vertex shader "${e.vertex}": ${e.programs} ${e.programs === 1 ? 'program' : 'programs'} with these messages (asked by ${e.askedBy}) ==`)
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
      if (named) {
        let found = false
        for (const own of ownNames(named)) {
          const f = whereWritten(e.frag?.source, own)
          const v = whereWritten(e.vert?.source, own)
          if (f) out.push(`    "${named}" is ${own} of the fragment shader's own source, line ${f.line}: ${f.text}`)
          if (v) out.push(`    "${named}" is ${own} of the vertex shader's own source, line ${v.line}: ${v.text}`)
          if (f || v) {
            found = true
            break
          }
        }
        if (!found) out.push(`    "${named}" was not found as a function of either shader's own source`)
      }
      if (m.line) {
        const f = lineOf(e.frag?.translated, m.line)
        const v = lineOf(e.vert?.translated, m.line)
        if (f !== null) out.push(`    line ${m.line} of the translated fragment shader: ${f || '(an empty line)'}`)
        if (v !== null) out.push(`    line ${m.line} of the translated vertex shader: ${v || '(an empty line)'}`)
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
