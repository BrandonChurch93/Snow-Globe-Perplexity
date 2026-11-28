// node tools/item285b/measure.mjs --dist <built page> --name <tag> [--local] [--seasons winter,spring] [--qualities low,medium,plain]
//      [--presses 5,30,ready] [--size 1280x720] [--limit 300] [--on] [--out out/work/item285b]
// Item 285, for measuring alone: nothing of the page is changed. Run from the root of a tree that has node_modules.
// The built page of --dist is served here and loaded once for every season, quality and press, one load after the other.
// Read by the page's own clock:
//   the name of the renderer the browser reports, and whether it links programs aside (KHR_parallel_shader_compile)
//   the first picture (the page's mark data-first-picture) and the mark data-made reading "ready"
//   every stand of 200 ms and more with its beginning: a timer of 20 ms inside the page, and each gap between two of
//     its ticks is a stand; the browser's own long tasks are kept beside it
//   the press: a real click on the SHAKE control. `5` and `30` send it that many seconds after the first picture,
//     by this tool's clock, so a page whose thread stands gets it when it is free again, as it gets a visitor's;
//     `ready` sends it 2 s after the mark reads "ready"; `none` sends none and waits for "ready"
//   when the page took the press, when SHAKE went held, when and where the shake landed (the season mark that reads
//     pressed once SHAKE is free again), and the page's messages (errors, warnings, exceptions)
// --local opens the installed Chrome in a window with the machine's graphics card; without it the pinned browser draws
// with the software renderer of the build machines. --on lets a load with a press run on until "ready" as well.
// --pieces keeps as well every call of the card that takes 5 ms and more, with what it is (the program by the name its
// shaders carry, a picture by its size, a buffer by its bytes), and says for each stand how much of it those calls were
// and which were the longest. For that the calls that can wait are wrapped inside the page, the page's own code is not.
// --profile takes the browser's own record of what the page's thread ran (a sample every millisecond) and says for each
// stand the heaviest way down through the page's code and what ran longest at its end. The names are those of the
// built page: a page built with --minify false keeps the names of the source. It says the same for the first 5 s after
// the first picture and for the whole time from the press to the landing.
// Kept beside the stands: every time no frame came for 1 s and more and for three frames at rest. The picture can stand
// while the thread is free, where the browser cannot draw.
import fs from 'node:fs'
import path from 'node:path'
import { isReadbackNotice, launch } from '../lib/browser.mjs'
import { serve } from '../lib/server.mjs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (!a.startsWith('--')) continue
  const next = process.argv[i + 1]
  if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true
  else args[a.slice(2)] = process.argv[++i]
}
const str = (k, d) => (typeof args[k] === 'string' ? args[k] : d)
const dist = path.resolve(str('dist', 'dist'))
const name = str('name', 'measure')
const local = args.local === true
const seasons = str('seasons', 'winter,spring').split(',')
const qualities = str('qualities', 'low,medium,plain').split(',')
const presses = str('presses', '5,30,ready').split(',')
const [width, height] = str('size', '1280x720').split('x').map(Number)
const limitMs = Number(str('limit', '300')) * 1000
const out = path.resolve(str('out', 'out/work/item285b'))
const SETTLE_MS = 3000
const AFTER_READY_MS = 2000
fs.mkdirSync(out, { recursive: true })

const cfg = JSON.parse(fs.readFileSync(path.join(path.dirname(dist), 'config', 'showcase.json'), 'utf8'))
const nextOf = (s) => cfg.seasons[(cfg.seasons.indexOf(s) + 1) % cfg.seasons.length]
const build = fs.existsSync(path.join(dist, 'build.json')) ? fs.readFileSync(path.join(dist, 'build.json'), 'utf8').trim() : 'no build.json'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const utc = () => new Date().toISOString().slice(11, 19)

function watch([pieces, profile]) {
  const w = (window.__m = { stands: [], long: [], frames: [], marks: [], busy: [], season: [], downs: [], gl: null, rect: null, pieces: pieces ? [] : null, beacon: null })
  if (profile) {
    // The profile's clock is not the page's. A function of a name nothing else has runs for a moment here, and where the
    // profile shows it is the page's time `beacon`.
    w.beacon = performance.now()
    ;(function __beacon285() {
      const end = performance.now() + 30
      while (performance.now() < end);
    })()
  }
  const tell = (kind, data) => {
    try {
      window.__tell?.(JSON.stringify({ kind, origin: performance.timeOrigin, at: performance.now(), ...data }))
    } catch {
      return
    }
  }
  let last = performance.now()
  let ticks = 0
  setInterval(() => {
    const t = performance.now()
    if (t - last >= 200) w.stands.push([Math.round(last), Math.round(t - last)])
    last = t
    if (++ticks % 10 || w.downs.length) return
    const b = document.querySelector('[data-control="shake"]')
    const r = b?.getBoundingClientRect()
    if (!r || !r.width) return
    const rect = [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]
    if (w.rect && w.rect[0] === rect[0] && w.rect[1] === rect[1]) return
    w.rect = rect
    tell('rect', { rect })
  }, 20)
  const frame = () => {
    w.frames.push(Math.round(performance.now()))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.duration >= 200) w.long.push([Math.round(e.startTime), Math.round(e.duration)])
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    w.long = null
  }
  if (pieces) {
    // Each call of the card that takes 5 ms and more, with what it is: the program by the name its shaders carry, a
    // picture by its size, a buffer by its bytes. Only the calls that can wait are watched, none of the many small ones.
    const C = window.WebGL2RenderingContext.prototype
    const sources = new WeakMap()
    const attached = new WeakMap()
    const names = new WeakMap()
    let current = null
    const nameOf = (program) => {
      if (!program) return ''
      let n = names.get(program)
      if (n === undefined) {
        const all = (attached.get(program) ?? []).map((x) => sources.get(x) ?? '')
        const text = all.join('\n')
        const name = /#define SHADER_NAME (\S+)/.exec(text)?.[1] ?? 'no name'
        const marks = ['USE_INSTANCING', 'USE_SHADOWMAP', 'USE_SKINNING', 'DEPTH_PACKING', 'USE_MAP', 'USE_NORMALMAP', 'USE_ENVMAP', 'USE_TRANSMISSION'].filter((d) => text.includes(`#define ${d}`))
        n = `${name} (${all.map((x) => x.length).join('+')} chars${marks.length ? `, ${marks.join(' ')}` : ''})`
        names.set(program, n)
      }
      return n
    }
    const size = (x) => (x && typeof x === 'object' && 'width' in x ? `${x.width}x${x.height}` : '')
    const WHAT = {
      compileShader: (a) => `${(sources.get(a[0]) ?? '').length} chars`,
      linkProgram: (a) => nameOf(a[0]),
      getProgramParameter: (a) => nameOf(a[0]),
      getProgramInfoLog: (a) => nameOf(a[0]),
      getShaderParameter: (a) => `${(sources.get(a[0]) ?? '').length} chars`,
      getShaderInfoLog: (a) => `${(sources.get(a[0]) ?? '').length} chars`,
      getUniformLocation: (a) => nameOf(a[0]),
      getActiveUniform: (a) => nameOf(a[0]),
      getActiveAttrib: (a) => nameOf(a[0]),
      validateProgram: (a) => nameOf(a[0]),
      useProgram: (a) => nameOf(a[0]),
      drawElements: (a) => `${nameOf(current)}, ${a[1]} indices`,
      drawArrays: (a) => `${nameOf(current)}, ${a[2]} vertices`,
      drawElementsInstanced: (a) => `${nameOf(current)}, ${a[1]} indices x ${a[4]}`,
      drawArraysInstanced: (a) => `${nameOf(current)}, ${a[2]} vertices x ${a[3]}`,
      drawRangeElements: (a) => `${nameOf(current)}, ${a[3]} indices`,
      bufferData: (a) => `${typeof a[1] === 'number' ? a[1] : (a[1]?.byteLength ?? 0)} bytes`,
      bufferSubData: (a) => `${a[2]?.byteLength ?? 0} bytes`,
      texImage2D: (a) => (a.length >= 9 ? `${a[3]}x${a[4]}` : size(a[5])),
      texSubImage2D: (a) => (a.length >= 9 ? `${a[4]}x${a[5]}` : size(a[6])),
      texStorage2D: (a) => `${a[3]}x${a[4]}, ${a[1]} levels`,
      compressedTexImage2D: (a) => `${a[3]}x${a[4]}`,
      compressedTexSubImage2D: (a) => `${a[4]}x${a[5]}`,
      texImage3D: (a) => `${a[3]}x${a[4]}x${a[5]}`,
      texSubImage3D: (a) => `${a[5]}x${a[6]}x${a[7]}`,
      texStorage3D: (a) => `${a[3]}x${a[4]}x${a[5]}`,
      generateMipmap: () => '',
      renderbufferStorage: (a) => `${a[2]}x${a[3]}`,
      renderbufferStorageMultisample: (a) => `${a[3]}x${a[4]}, ${a[1]} samples`,
      blitFramebuffer: () => '',
      checkFramebufferStatus: () => '',
      clear: () => '',
      readPixels: (a) => `${a[2]}x${a[3]}`,
      finish: () => '',
      flush: () => '',
      clientWaitSync: () => '',
      getSyncParameter: () => '',
      getError: () => '',
      getParameter: () => '',
      getExtension: (a) => String(a[0]),
    }
    for (const key of Object.getOwnPropertyNames(C)) {
      const d = Object.getOwnPropertyDescriptor(C, key)
      if (!d || typeof d.value !== 'function') continue
      const real = d.value
      if (key === 'shaderSource')
        C[key] = function (shader, source) {
          sources.set(shader, String(source))
          return real.call(this, shader, source)
        }
      else if (key === 'attachShader')
        C[key] = function (program, shader) {
          const list = attached.get(program) ?? []
          list.push(shader)
          attached.set(program, list)
          return real.call(this, program, shader)
        }
      else if (WHAT[key]) {
        const what = WHAT[key]
        const use = key === 'useProgram'
        C[key] = function (...a) {
          if (use) current = a[0]
          const t = performance.now()
          try {
            return real.apply(this, a)
          } finally {
            const ms = performance.now() - t
            if (ms >= 5) {
              let name = ''
              try {
                name = what(a)
              } catch {
                name = ''
              }
              w.pieces.push([Math.round(t), Math.round(ms), key, name])
            }
          }
        }
      }
    }
  }
  if (pieces) {
    // The sound's own pieces: the making of its context, and each call of it that takes 5 ms and more.
    const note = (t, call, what) => {
      const ms = performance.now() - t
      if (ms >= 5) w.pieces.push([Math.round(t), Math.round(ms), call, what])
    }
    for (const name of ['AudioContext', 'webkitAudioContext']) {
      const Real = window[name]
      if (typeof Real !== 'function') continue
      window[name] = new Proxy(Real, {
        construct(target, a, newTarget) {
          const t = performance.now()
          try {
            return Reflect.construct(target, a, newTarget)
          } finally {
            note(t, `new ${name}`, '')
          }
        },
      })
    }
    const B = window.BaseAudioContext?.prototype
    if (B)
      for (const key of ['decodeAudioData', 'createBuffer', 'createBufferSource', 'createGain', 'createConvolver', 'createDynamicsCompressor', 'createBiquadFilter'])
        if (typeof B[key] === 'function') {
          const real = B[key]
          B[key] = function (...a) {
            const t = performance.now()
            try {
              return real.apply(this, a)
            } finally {
              note(t, key, key === 'decodeAudioData' ? `${a[0]?.byteLength ?? 0} bytes` : '')
            }
          }
        }
    const A = window.AudioContext?.prototype
    if (A && typeof A.resume === 'function') {
      const real = A.resume
      A.resume = function (...a) {
        const t = performance.now()
        try {
          return real.apply(this, a)
        } finally {
          note(t, 'resume', '')
        }
      }
    }
  }
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const c = getContext.call(this, kind, ...rest)
    if (c && (kind === 'webgl2' || kind === 'webgl') && !w.gl) {
      const info = c.getExtension('WEBGL_debug_renderer_info')
      w.gl = {
        kind,
        renderer: String(info ? c.getParameter(info.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)),
        vendor: String(info ? c.getParameter(info.UNMASKED_VENDOR_WEBGL) : c.getParameter(c.VENDOR)),
        parallel: (c.getSupportedExtensions() ?? []).includes('KHR_parallel_shader_compile'),
      }
    }
    return c
  }
  window.addEventListener(
    'pointerdown',
    (e) => {
      const on = e.target instanceof Element && !!e.target.closest('[data-control="shake"]')
      w.downs.push({ at: Math.round(performance.now()), stamp: Math.round(e.timeStamp), on, trusted: e.isTrusted })
    },
    true,
  )
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      const at = Math.round(performance.now())
      const value = el.getAttribute(m.attributeName ?? '')
      if (m.attributeName === 'data-first-picture' || m.attributeName === 'data-made' || m.attributeName === 'data-detail' || m.attributeName === 'data-audio') {
        w.marks.push({ at, mark: m.attributeName.slice(5), value })
        if (m.attributeName === 'data-first-picture') tell('first', {})
        if (m.attributeName === 'data-made' && value === 'ready') tell('ready', {})
      } else if (m.attributeName === 'aria-disabled' && el.matches('[data-control="shake"]')) w.busy.push({ at, held: value === 'true' })
      else if (m.attributeName === 'aria-pressed' && value === 'true' && el.hasAttribute('data-season')) w.season.push({ at, season: el.getAttribute('data-season') })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-first-picture', 'data-made', 'data-detail', 'data-audio', 'aria-disabled', 'aria-pressed'] })
  const canvasWatch = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    new MutationObserver(() => {
      if (canvas.style.transition === 'none' && !w.marks.some((m) => m.mark === 'handed')) w.marks.push({ at: Math.round(performance.now()), mark: 'handed', value: getComputedStyle(canvas).opacity })
    }).observe(canvas, { attributes: true, attributeFilter: ['style'] })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', canvasWatch, { once: true })
  else canvasWatch()
}

/**
 * What the page's thread ran, by the profile, between two of the page's times: the heaviest way down from the top, each
 * function with the time spent in it and below it, and the functions that ran longest themselves.
 */
function ran(profile, beaconAt) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]))
  const parent = new Map()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const times = []
  let t = profile.startTime
  for (let i = 0; i < profile.samples.length; i++) times.push((t += profile.timeDeltas[i]))
  const inBeacon = (id) => {
    for (let n = id; n !== undefined; n = parent.get(n)) if (nodes.get(n).callFrame.functionName === '__beacon285') return true
    return false
  }
  let at = profile.samples.length - 1
  while (at >= 0 && !inBeacon(profile.samples[at])) at--
  if (at < 0) return null
  while (at > 0 && inBeacon(profile.samples[at - 1])) at--
  const zero = times[at] / 1000 - beaconAt
  const label = (n) => {
    const f = n.callFrame
    const where = f.url ? ` ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}:${f.columnNumber + 1}` : ''
    return `${f.functionName || '(no name)'}${where}`
  }
  return (fromMs, forMs) => {
    const a = (fromMs + zero) * 1000
    const b = (fromMs + forMs + zero) * 1000
    const self = new Map()
    const whole = new Map()
    let all = 0
    for (let i = 0; i < times.length; i++) {
      if (times[i] < a || times[i] >= b) continue
      const ms = ((times[i + 1] ?? times[i] + 1000) - times[i]) / 1000
      all += ms
      const leaf = profile.samples[i]
      self.set(leaf, (self.get(leaf) ?? 0) + ms)
      for (let n = leaf; n !== undefined; n = parent.get(n)) whole.set(n, (whole.get(n) ?? 0) + ms)
    }
    const way = []
    let n = profile.nodes[0]
    for (;;) {
      const below = (n.children ?? []).map((c) => nodes.get(c)).filter((c) => whole.has(c.id)).sort((x, y) => whole.get(y.id) - whole.get(x.id))[0]
      if (!below || whole.get(below.id) < all * 0.05) break
      way.push(`${label(below)} ${Math.round(whole.get(below.id))}`)
      n = below
    }
    const bySelf = new Map()
    for (const [id, ms] of self) {
      const k = label(nodes.get(id))
      bySelf.set(k, (bySelf.get(k) ?? 0) + ms)
    }
    const longest = [...bySelf].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, ms]) => `${k} ${Math.round(ms)}`)
    return { sampledMs: Math.round(all), way, ranLongest: longest }
  }
}

async function load(browser, base, season, quality, press) {
  const query = `?${quality === 'plain' ? '' : `quality=${quality}&`}season=${season}`
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const messages = []
  let counting = true
  page.on('console', (m) => {
    if (!counting || isReadbackNotice(m.type(), m.text())) return
    const from = m.location()?.url ?? ''
    // The page names its own icon. Only the document the profile is begun on makes the browser ask for this one.
    if (args.profile === true && from === `${base}favicon.ico`) return
    if (m.type() === 'error' || m.type() === 'warning') messages.push(`${m.type()}: ${m.text()}${from ? ` (${from})` : ''}`)
  })
  page.on('pageerror', (e) => counting && messages.push(`pageerror: ${e.message}`))
  const told = { first: null, ready: null, rect: null }
  let sent = null
  await page.exposeBinding('__tell', (_source, text) => {
    const m = JSON.parse(text)
    const wall = m.origin + m.at
    if (m.kind === 'rect') told.rect = m.rect
    else told[m.kind] ??= { wall, at: m.at, origin: m.origin }
  })
  await page.addInitScript(watch, [args.pieces === true, args.profile === true])
  const cdp = await context.newCDPSession(page)
  let profiling = false
  if (args.profile === true) {
    try {
      // A page of the same origin first, so that the profile is begun in the process that will run the page.
      await page.goto(`${base}build.json`, { waitUntil: 'commit' })
      await cdp.send('Profiler.enable')
      await cdp.send('Profiler.setSamplingInterval', { interval: 1000 })
      await cdp.send('Profiler.start')
      profiling = true
    } catch (error) {
      console.log(`no profile: ${error?.message ?? error}`)
    }
  }
  const mouse = (type, x, y, more = {}) => void cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...more }).catch(() => undefined)
  const began = Date.now()
  const beganUtc = utc()
  await page.goto(base + query, { waitUntil: 'commit' })
  const over = () => Date.now() - began > limitMs
  const read = () =>
    page
      .evaluate(() => {
        const w = window.__m
        return { t: performance.now(), busy: w.busy, season: w.season, downs: w.downs, ready: w.marks.some((m) => m.mark === 'made' && m.value === 'ready') }
      })
      .catch(() => null)
  let ended = 'the limit'
  const wanted = press === 'none' ? null : nextOf(season)
  while (!told.first && !over()) await sleep(20)
  if (told.first && press !== 'none') {
    if (press === 'ready') {
      while (!told.ready && !over()) await sleep(50)
      if (told.ready) await sleep(Math.max(0, told.ready.wall + AFTER_READY_MS - Date.now()))
    } else await sleep(Math.max(0, told.first.wall + Number(press) * 1000 - Date.now()))
    while (!told.rect && !over()) await sleep(20)
    if (told.rect && (press !== 'ready' || told.ready)) {
      const [x, y] = told.rect
      mouse('mouseMoved', x, y)
      mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 })
      sent = Date.now()
      await sleep(60)
      mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 })
      let freeFrom = null
      while (!over()) {
        const now = await read()
        const sentAt = sent - told.first.origin
        if (now) {
          const held = now.busy.find((b) => b.held && b.at >= sentAt - 50)
          const free = held && now.busy.at(-1) && !now.busy.at(-1).held
          if (free) {
            freeFrom ??= Date.now()
            if (Date.now() - freeFrom >= SETTLE_MS) {
              ended = 'the landing and 3 s of rest'
              break
            }
          } else freeFrom = null
        }
        await sleep(200)
      }
    }
  }
  if (told.first && (press === 'none' || args.on === true)) {
    while (!told.ready && !over()) await sleep(100)
    if (told.ready) {
      await sleep(SETTLE_MS)
      if (press === 'none') ended = 'the mark ready and 3 s'
    }
  }
  const got = await page.evaluate(() => ({ ...window.__m, now: performance.now(), agent: navigator.userAgent, cores: navigator.hardwareConcurrency, live: document.querySelector('canvas')?.dataset.live !== undefined })).catch(() => null)
  // What the browser itself takes to make a sound context, the first and one more: the page's sound makes its own at the
  // first press. Only after a press, because a browser warns of one made before, and after everything else is read.
  counting = false
  const sound =
    sent === null
      ? null
      : await page
          .evaluate(async () => {
            const C = window.AudioContext ?? window.webkitAudioContext
            const made = []
            for (let i = 0; C && i < 2; i++) {
              const t = performance.now()
              const c = new C()
              made.push({ ms: Math.round(performance.now() - t), state: c.state, rate: c.sampleRate })
              await c.close().catch(() => undefined)
            }
            return made
          })
          .catch((error) => [{ failed: String(error?.message ?? error) }])
  const profile = profiling ? await cdp.send('Profiler.stop').then((r) => r.profile, () => null) : null
  await context.close()
  if (!got) return { name, season, quality, pressAsked: press, query, beganUtc, failed: 'the page gave nothing back', messages }
  const first = got.marks.find((m) => m.mark === 'first-picture')?.at ?? null
  const rel = (t) => (t === null || t === undefined || first === null ? null : Math.round(t - first))
  const ready = got.marks.find((m) => m.mark === 'made' && m.value === 'ready')?.at ?? null
  const detail = got.marks.find((m) => m.mark === 'detail' && m.value === 'ready')?.at ?? null
  const sentByTool = sent === null || !told.first ? null : Math.round(sent - told.first.origin)
  const down = sentByTool === null ? null : (got.downs.find((d) => d.on && d.at >= sentByTool - 50) ?? null)
  // the press's own time is the input's stamp, which the browser gives it when it comes in, however late the page takes it
  const sentAt = down ? down.stamp : sentByTool
  const handed = got.marks.find((m) => m.mark === 'handed')?.at ?? null
  const held = sentAt === null ? null : (got.busy.find((b) => b.held && b.at >= sentAt - 50)?.at ?? null)
  const freed = held === null ? null : (got.busy.find((b) => !b.held && b.at > held)?.at ?? null)
  const landedOn = freed === null ? null : (got.season.filter((s) => s.at <= freed + 50).at(-1)?.season ?? season)
  const stands = got.stands.map(([from, ms]) => ({
    from: rel(from),
    ms,
    afterPress: sentAt === null ? null : from - sentAt,
    inShake: sentAt !== null && from >= sentAt && freed !== null && from < freed,
    overPress: sentAt !== null && from < sentAt && from + ms > sentAt,
  }))
  const pieces = got.pieces === null ? null : got.pieces.map(([from, ms, call, what]) => ({ from: rel(from), at: from, ms, call, what }))
  if (pieces)
    for (const s of stands) {
      const from = s.from + (first ?? 0)
      const inside = pieces.filter((p) => p.at >= from - 2 && p.at < from + s.ms)
      s.cardMs = inside.reduce((sum, p) => sum + p.ms, 0)
      s.longest = [...inside].sort((a, b) => b.ms - a.ms).slice(0, 4).map((p) => `${p.call} ${p.ms} ms${p.what ? ` (${p.what})` : ''}`)
    }
  const windows = []
  if (profile && got.beacon !== null) {
    try {
      fs.writeFileSync(path.join(out, `${name}-${season}-${quality}-${press}.cpuprofile`), JSON.stringify(profile))
      const by = ran(profile, got.beacon)
      if (by) for (const s of stands) Object.assign(s, by(s.from + (first ?? 0), s.ms))
      if (by && first !== null) windows.push({ what: 'the first 5 s after the first picture', ...by(first, 5000) })
      if (by && sentAt !== null && freed !== null) windows.push({ what: 'from the press to the landing', ...by(sentAt, freed - sentAt) })
    } catch (error) {
      console.log(`the profile was not read: ${error?.message ?? error}`)
    }
  }
  const inShake = stands.filter((s) => s.inShake)
  const gaps = (from, to) => {
    const f = got.frames.filter((t) => t >= from && t <= to)
    const d = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b)
    return { frames: f.length, middleMs: d.length ? d[Math.floor(d.length / 2)] : null, longestMs: d.length ? d.at(-1) : null }
  }
  // The picture can stand while the thread is free: a frame that the browser does not ask the page for is no stand above.
  const atRest = first === null ? null : gaps(first, sentAt ?? got.now)
  const after = first === null ? [] : got.frames.filter((f) => f >= first)
  const noFrame = after
    .slice(1)
    .map((f, i) => ({ from: rel(after[i]), ms: f - after[i] }))
    .filter((g) => g.ms >= 1000 && g.ms >= 3 * (atRest?.middleMs ?? 0))
  return {
    name,
    season,
    quality,
    pressAsked: press,
    query,
    beganUtc,
    endedUtc: utc(),
    endedBy: ended,
    build,
    renderer: got.gl?.renderer ?? null,
    vendor: got.gl?.vendor ?? null,
    linksAside: got.gl?.parallel ?? null,
    agent: got.agent,
    cores: got.cores,
    size: `${width}x${height}`,
    firstPictureMs: first,
    liveMark: got.live,
    handedOverAfterFirstMs: rel(handed),
    marks: got.marks.map((m) => ({ ...m, at: rel(m.at) })),
    detailReadyAfterFirstMs: rel(detail),
    readyAfterFirstMs: rel(ready),
    press:
      sentAt === null
        ? null
        : {
            sentAfterFirstMs: rel(sentAt),
            sentAfterReadyMs: ready === null || ready > sentAt ? null : Math.round(sentAt - ready),
            madeAtThePress: ready !== null && ready <= sentAt ? 'ready' : 'making',
            takenAfterSentMs: down ? down.at - down.stamp : null,
            heldAfterSentMs: held === null ? null : held - sentAt,
            landedAfterSentMs: freed === null ? null : freed - sentAt,
            landedOn,
            wanted,
            right: landedOn === wanted,
            framesInShake: freed === null ? null : gaps(sentAt, freed),
          },
    standsInShake: inShake.length,
    longestInShakeMs: inShake.reduce((m, s) => Math.max(m, s.ms), 0),
    standOverThePressMs: stands.find((s) => s.overPress)?.ms ?? 0,
    stands,
    longTasks: got.long === null ? null : got.long.map(([from, ms]) => ({ from: rel(from), ms })),
    pieces: pieces === null ? null : pieces.map(({ at: _at, ...p }) => p),
    framesAtRest: atRest,
    noFrame,
    windows,
    soundContext: sound,
    messages,
  }
}

const line = (r) => {
  if (r.failed) return `${r.season} ${r.quality} press ${r.pressAsked}: ${r.failed}`
  const p = r.press
  const s = (ms) => (ms === null || ms === undefined ? 'not read' : `${(ms / 1000).toFixed(2)} s`)
  const list = (xs) => (xs.length ? xs.map((x) => `${x.ms} ms from ${s(x.afterPress ?? x.from)}`).join(', ') : 'none')
  const head = `${r.season} ${r.quality} press ${r.pressAsked}: first picture ${s(r.firstPictureMs)} of the page, handed over ${s(r.handedOverAfterFirstMs)} after it, ready ${s(r.readyAfterFirstMs)} after it, a frame at rest ${r.framesAtRest?.middleMs ?? 'not read'} ms`
  if (!p) return `${head}, no press; stands of 200 ms and more: ${r.stands.length}, longest ${r.stands.reduce((m, x) => Math.max(m, x.ms), 0)} ms; messages ${r.messages.length}; ended by ${r.endedBy}`
  return `${head}; press sent ${s(p.sentAfterFirstMs)} after the first picture (mark ${p.madeAtThePress}), taken ${s(p.takenAfterSentMs)} later, SHAKE held ${s(p.heldAfterSentMs)}, landed ${s(p.landedAfterSentMs)} after the press on ${p.landedOn} (${p.right ? 'right' : `WRONG, wanted ${p.wanted}`}); a stand over the press: ${r.standOverThePressMs} ms; stands begun in the shake: ${list(r.stands.filter((x) => x.inShake))}; messages ${r.messages.length}; ended by ${r.endedBy}${r.soundContext?.length ? `; a sound context of the browser's own, made after all this: ${r.soundContext.map((c) => (c.failed ? `failed (${c.failed})` : `${c.ms} ms`)).join(', then ')}` : ''}`
}

const server = await serve({ dist, port: 0 })
// A page that stands for long with a press waiting is not to be offered for closing by the browser.
const browser = await launch({ local, extraArgs: ['--disable-hang-monitor', ...(process.env.MEASURE_ARGS ?? '').split(' ').filter(Boolean)] })
const results = []
const file = path.join(out, `${name}.json`)
const table = path.join(out, `${name}.txt`)
fs.writeFileSync(table, `item 285, measure ${name}: ${dist}, ${build}, ${local ? 'the installed Chrome with the card' : 'the pinned browser, software'}, window ${width}x${height}, begun ${new Date().toISOString()}\n`)
let failed = 0
for (const season of seasons) {
  for (const quality of qualities) {
    for (const press of presses) {
      let r
      try {
        r = await load(browser, server.url, season, quality, press)
      } catch (error) {
        r = { name, season, quality, pressAsked: press, failed: `the load threw: ${error?.message ?? error}`, messages: [] }
      }
      results.push(r)
      if (results.length === 1 && r.renderer) fs.appendFileSync(table, `renderer: ${r.renderer} · links aside: ${r.linksAside} · ${r.agent} · ${r.cores} processors\n`)
      if (r.failed || r.messages.length || (r.press && !r.press.right) || (press !== 'none' && !r.press)) failed++
      const text = `${utc()} ${line(r)}`
      console.log(text)
      fs.appendFileSync(table, `${text}\n`)
      for (const m of r.messages ?? []) fs.appendFileSync(table, `    message: ${m}\n`)
      if (args.pieces === true || args.profile === true)
        for (const x of r.stands ?? []) {
          const card = x.cardMs === undefined ? '' : `: calls of the card ${x.cardMs} ms${x.longest.length ? `; ${x.longest.join('; ')}` : ''}`
          fs.appendFileSync(table, `    stand ${x.ms} ms from ${(x.from / 1000).toFixed(2)} s after the first picture${x.inShake ? ' (in the shake)' : x.overPress ? ' (over the press)' : ''}${card}\n`)
          if (x.way) fs.appendFileSync(table, `        by the profile (${x.sampledMs} ms sampled), the heaviest way down, ms in and below each: ${x.way.join(' > ')}\n        ran longest themselves, ms: ${x.ranLongest.join('; ')}\n`)
        }
      for (const g of r.noFrame ?? []) fs.appendFileSync(table, `    no frame for ${g.ms} ms from ${(g.from / 1000).toFixed(2)} s after the first picture\n`)
      for (const x of r.windows ?? []) fs.appendFileSync(table, `    ${x.what}, by the profile (${x.sampledMs} ms sampled): ran longest themselves, ms: ${x.ranLongest.join('; ')}\n`)
      fs.writeFileSync(file, JSON.stringify(results, null, 1))
    }
  }
}
await browser.close()
await server.close()
const last = `${name}: ${results.length} loads, ${failed} with a message, a wrong landing or no press taken`
console.log(last)
fs.appendFileSync(table, `${last}\n`)
