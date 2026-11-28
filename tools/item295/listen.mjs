// node tools/item295/listen.mjs --dist <built page> --name <tag> --loads "12:|12:quality=low&season=winter|12:season=spring"
//      [--local] [--stay 150] [--after-loss 30] [--limit 200] [--flags "--disable-gpu-watchdog,--other"] [--spindump 12]
//      [--oslog lost|all|none] [--out out/work/item295]
//
// Item 295: why main's page loses its WebGL context in winter on the hosted macOS card. This tool only listens. It puts
// nothing on the card: no call of the card is wrapped, no fence is set, nothing is read back, the thread is not profiled.
// In the page it listens for the loss and the return of the card, for the page's own marks and for the frames, as
// tools/item312/bare.mjs does. Everything else is read from outside the browser: its processes (ps), the machine's
// memory (vm_stat), the card's own counters where the machine has them (ioreg), Chrome's own log lines (the browser is
// begun with --enable-logging=stderr and the driver passes the lines on), the machine's crash reports and its log.
//
// --loads names the addresses and how many browsers each gets: count:query, apart by |; an empty query is the plain
// address. Round by round, one browser begun for each load, as a first visit is. A load is over --stay s after the first
// picture, or --after-loss s after the card was lost (0 or absent: the loss ends nothing), or at --limit s where no
// picture came. Only after that does the tool ask the canvas whether its card is lost, take a picture of the window, open
// chrome://gpu in the same browser and ask the browser for its processes.
// --flags are passed to the browser as they stand (a switch of the browser, never of the page).
// --plain-flags: the browser is begun without the flags every tool of this tree begins it with; the driver's own
// default switches stay (none of them names the card). --viewport WxH and --scale N set the window and its pixel ratio.
// --spindump N: at the first picture the machine's own sampler (spindump, as root) is begun for N s on the browser's
// graphics process. That is a tool beside the card, so such loads are never counted with the listening ones.
// --spindump-at MS begins that sampler MS after the address was asked for instead. --hide-canvas S: a style of the tool
// keeps the canvas out of sight (opacity 0, as the page keeps it before its first picture) until S s after the first
// picture. Such loads are named so and never counted with the listening ones.
// --cut-canvas: a style of the tool takes the transition from the canvas, so it comes into sight at the first picture
// by a cut. --fade-canvas frames|S: the tool holds the canvas and the page's still until the page's frames run again
// (or until S s after the first picture) and then lets the page's own 0.5 s fade run. Named so, never counted with
// the listening ones.
// --canvas-opacity V: a style of the tool gives the canvas the opacity V from the page's first moment for as long as it
// carries no data-live; at the first picture the page's own fade runs, from V to 1. --canvas-will-change: a style of the
// tool sets will-change: opacity on the canvas from the page's first moment and nothing else. Both write down what the
// canvas's computed style was. Named so, never counted with the listening ones.
// --local opens the installed Chrome in a window with the machine's graphics card, with the flags of every tool of
// this tree; without it the pinned browser draws with the software renderer.
// It writes <out>/<name>.json, <name>.txt, and for each load <tag>.png, <tag>-chrome.log, <tag>-gpu.txt and what the
// machine wrote about it. It changes nothing in the page.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile, spawn } from 'node:child_process'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (!a.startsWith('--')) continue
  const next = process.argv[i + 1]
  if (next === undefined || (next.startsWith('--') && a !== '--flags')) args[a.slice(2)] = true
  else args[a.slice(2)] = process.argv[++i]
}
const str = (k, d) => (typeof args[k] === 'string' ? args[k] : d)
const dist = path.resolve(str('dist', 'dist'))
const name = str('name', 'listen')
const local = args.local === true
const stayMs = Number(str('stay', '150')) * 1000
const afterLossMs = Number(str('after-loss', '0')) * 1000
const limitMs = Number(str('limit', '200')) * 1000
const spindumpS = Number(str('spindump', '0'))
// --spindump-at MS: the sampler begins MS after the address was asked for instead of at the first picture (a season whose
// standstill falls before its first picture). --hide-canvas S: the tool keeps the canvas as the page keeps it before its
// first picture (opacity 0, no fade) until S s after the first picture, then lets go. Both are tools beside the page.
const spindumpAtMs = Number(str('spindump-at', '-1'))
const hideCanvasS = Number(str('hide-canvas', '0'))
// --plain-canvas: a style of the tool keeps the canvas in full sight with no fade from the page's first moment to its
// last (opacity 1, no transition), as the page's canvas was before it had a still under it. A tool beside the page.
const plainCanvas = args['plain-canvas'] === true
// --no-blur: a style of the tool takes the blur of what lies under a panel (backdrop-filter) from every element for the
// whole load. The panels stay; only that blur goes. A tool beside the page.
const noBlur = args['no-blur'] === true
// --cut-canvas: a style of the tool takes the transition from the canvas for the whole load, so that the canvas comes
// into sight at the first picture by a cut and not by the page's 0.5 s fade. The page keeps it out of sight until then
// by its own rule, and everything else is the page's. A tool beside the page.
const cutCanvas = args['cut-canvas'] === true
// --canvas-opacity V: a style of the tool gives the canvas the opacity V (0.004, 0.02) from the page's first moment for
// as long as it carries no data-live, where the page's own rule gives it 0. Everything else is the page's: at the first
// picture the page sets data-live and its own 0.5 s fade runs, from V to 1. --canvas-will-change: a style of the tool
// sets will-change: opacity on the canvas from the page's first moment and nothing else; its opacity is the page's 0
// until the first picture. Both write down the canvas's computed style frame by frame before the first picture, at the
// moments of the fade and at the load's end, so that a load proves what it set. Tools beside the page.
const canvasOpacity = str('canvas-opacity', '')
if (canvasOpacity !== '' && !(Number(canvasOpacity) > 0 && Number(canvasOpacity) < 1)) throw new Error(`--canvas-opacity is ${canvasOpacity}. It is a number between 0 and 1.`)
const canvasWillChange = args['canvas-will-change'] === true
// --fade-canvas frames|S: the tool holds the canvas out of sight (opacity 0, no fade) and holds the page's still under
// it (the page's own call that ends the still is kept back), then lets the page's own rule fade the canvas in over
// 0.5 s and ends the still when that fade is over, as the page does. With "frames" it lets go when the page's frames
// run again: at the first frame that is 2 s or more after the first picture and has had no two frames 250 ms or more
// apart in the half second before it. With a number S it lets go S s after the first picture. It stands in for a page
// that holds its canvas back until the card has answered; it makes nothing on the card. A tool beside the page.
const fadeCanvas = str('fade-canvas', '')
const FADE_AFTER_MS = 2000
const FADE_STEADY_MS = 500
const oslog = str('oslog', 'lost')
// --webkit: the driver's own build of WebKit in a window instead of Chrome (the engine of Safari; it is not Safari itself).
// It has no chrome://gpu and names no processes to the driver: its processes are found by their names.
const webkitMode = args.webkit === true
// --plain-flags: the browser is begun without the flags of this tree's tools (the driver's own stay, and the logging).
const plainFlags = args['plain-flags'] === true
const [viewW, viewH] = str('viewport', '1280x720').split('x').map(Number)
const scale = Number(str('scale', '1'))
const extraFlags = str('flags', '').split(',').map((s) => s.trim()).filter(Boolean)
const out = path.resolve(str('out', 'out/work/item295'))
const loads = str('loads', '4:').split('|').map((s) => {
  const cut = s.indexOf(':')
  return { count: Number(s.slice(0, cut)), query: s.slice(cut + 1) }
})
fs.mkdirSync(out, { recursive: true })
const mac = process.platform === 'darwin'
const utc = () => new Date().toISOString().slice(11, 19)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const build = fs.existsSync(path.join(dist, 'build.json')) ? fs.readFileSync(path.join(dist, 'build.json'), 'utf8').trim() : 'no build.json'

// The driver writes every line the browser prints to this file, once it is told to before it is loaded.
const driverLog = path.join(out, `${name}-driver.log`)
process.env.DEBUG = 'pw:browser'
process.env.DEBUG_FILE = driverLog
const { chromium, webkit } = await import('playwright-core')
const { serve } = await import('../lib/server.mjs')
const { findBrowser, softwareRenderer, isReadbackNotice } = await import('../lib/browser.mjs')

const sh = (cmd, a, ms = 15000) =>
  new Promise((resolve) => {
    execFile(cmd, a, { timeout: ms, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => resolve({ ok: !error, out: String(stdout ?? ''), err: String(stderr ?? '') + (error ? ` ${error.message}` : '') }))
  })

// The flags of tools/lib/browser.mjs for a window with the card, and the one tools/item312/bare.mjs adds.
const COMMON = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio']
const LOGGING = ['--enable-logging=stderr', '--log-level=0']
function begin(tag) {
  if (webkitMode) return webkit.launch({ headless: false })
  const more = ['--disable-hang-monitor', ...LOGGING, `--loss295-tag=${tag}`, ...extraFlags]
  if (local && plainFlags) return chromium.launch({ channel: 'chrome', headless: false, ignoreDefaultArgs: ['--disable-hang-monitor', ...COMMON.slice(0, 4)], args: [...LOGGING, `--loss295-tag=${tag}`, ...extraFlags] })
  if (local) return chromium.launch({ channel: 'chrome', headless: false, args: [...COMMON, '--ignore-gpu-blocklist', '--enable-gpu-rasterization', ...more] })
  const soft = softwareRenderer()
  return chromium.launch({ executablePath: findBrowser(), headless: true, args: [...soft.flags, ...COMMON, ...more], ...(soft.env ? { env: soft.env } : {}) })
}

async function processes() {
  const r = await sh('ps', ['-axww', '-o', 'pid=', '-o', 'ppid=', '-o', 'rss=', '-o', 'vsz=', '-o', 'pcpu=', '-o', 'time=', '-o', 'args='])
  const list = []
  for (const line of r.out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(.*)$/.exec(line)
    if (m) list.push({ pid: Number(m[1]), ppid: Number(m[2]), rssKb: Number(m[3]), vszKb: Number(m[4]), cpu: Number(m[5]), time: m[6], args: m[7] })
  }
  return list
}
const kindOf = (a) => {
  const type = /--type=([a-z-]+)/.exec(a)?.[1]
  if (!type) return 'browser'
  if (type === 'utility') return `utility:${/--utility-sub-type=([\w.]+)/.exec(a)?.[1] ?? ''}`
  return type
}
const cpuSeconds = (t) => {
  const p = String(t).split(/[:-]/).map(Number)
  return p.reduce((s, x) => s * 60 + x, 0)
}

async function machineMemory() {
  if (!mac) {
    const r = await sh('cat', ['/proc/meminfo'])
    const g = (k) => Number(new RegExp(`${k}:\\s+(\\d+)`).exec(r.out)?.[1] ?? NaN)
    return { freeMb: Math.round(g('MemFree') / 1024), availableMb: Math.round(g('MemAvailable') / 1024) }
  }
  const [vm, swap] = await Promise.all([sh('vm_stat', []), sh('sysctl', ['-n', 'vm.swapusage'])])
  const page = Number(/page size of (\d+) bytes/.exec(vm.out)?.[1] ?? 16384)
  const g = (k) => Math.round((Number(new RegExp(`${k}:\\s+(\\d+)`).exec(vm.out)?.[1] ?? NaN) * page) / 1048576)
  return {
    freeMb: g('Pages free'),
    activeMb: g('Pages active'),
    inactiveMb: g('Pages inactive'),
    speculativeMb: g('Pages speculative'),
    wiredMb: g('Pages wired down'),
    purgeableMb: g('Pages purgeable'),
    compressorMb: g('Pages occupied by compressor'),
    swapins: Number(/Swapins:\s+(\d+)/.exec(vm.out)?.[1] ?? NaN),
    swapouts: Number(/Swapouts:\s+(\d+)/.exec(vm.out)?.[1] ?? NaN),
    swapUsedMb: Number(/used = ([\d.]+)M/.exec(swap.out)?.[1] ?? NaN),
  }
}

async function cardCounters() {
  if (!mac) return null
  const r = await sh('sh', ['-c', "ioreg -r -c IOAccelerator -w 0 -d 2 2>/dev/null | grep -E 'PerformanceStatistics' | head -2"], 5000)
  return r.out.trim() ? r.out.trim().slice(0, 1500) : null
}

function early() {
  const w = (window.__listen = { marks: [], lost: [], back: [], refused: [], gaps: [], perSecond: {}, frames: 0, last: null, wall0: Date.now(), page0: performance.now() })
  window.addEventListener('webglcontextlost', (e) => w.lost.push({ at: Math.round(performance.now()), message: String(e.statusMessage ?? '') }), true)
  window.addEventListener('webglcontextrestored', () => w.back.push(Math.round(performance.now())), true)
  window.addEventListener('webglcontextcreationerror', (e) => w.refused.push({ at: Math.round(performance.now()), message: String(e.statusMessage ?? '') }), true)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (el instanceof Element && m.attributeName) w.marks.push({ at: Math.round(performance.now()), mark: m.attributeName.slice(5), value: el.getAttribute(m.attributeName) })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-first-picture', 'data-made', 'data-detail'] })
  const tick = (t) => {
    if (w.last !== null && t - w.last >= 250) w.gaps.push([Math.round(w.last), Math.round(t - w.last)])
    w.last = t
    w.frames++
    const s = Math.floor(t / 1000)
    w.perSecond[s] = (w.perSecond[s] ?? 0) + 1
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// In the page, before any of its scripts: holds the canvas and the still, and lets the page's own fade run at the moment
// named. Everything it does is written into window.__listen.fade with the page's clock.
function holdAndFade({ mode, seconds, afterMs, steadyMs }) {
  const w = window.__listen
  const f = (w.fade = { mode, seconds, afterMs, steadyMs, firstAt: null, stillAskedToEndAt: null, releasedAt: null, releasedBy: null, opacityAtRelease: null, transitionAtRelease: null, fadeRuns: null, fadeEndedAt: null, fadeEndedBy: null, opacityAfter: null, stillEndedAt: null, stillThere: null })
  const put = () => {
    if (document.getElementById('__listen_hold') || !document.documentElement) return
    const st = document.createElement('style')
    st.id = '__listen_hold'
    st.textContent = 'canvas{opacity:0 !important;transition:none !important}'
    document.documentElement.appendChild(st)
  }
  put()
  document.addEventListener('DOMContentLoaded', put)
  // The page's still: the page ends it at the end of its own fade or 1500 ms after the first picture. Under the tool's
  // hold there is no fade to end, so that call is kept back until the tool's fade is over.
  let still
  let endStill = null
  Object.defineProperty(window, 'firstStill', {
    configurable: true,
    enumerable: true,
    get: () => still,
    set: (v) => {
      still = v
      if (v && typeof v.end === 'function') {
        const real = v.end
        v.end = function () {
          if (f.fadeEndedAt !== null) return real.call(v)
          if (f.stillAskedToEndAt === null) f.stillAskedToEndAt = Math.round(performance.now())
          endStill = () => real.call(v)
          return undefined
        }
      }
    },
  })
  const release = (by) => {
    if (f.releasedAt !== null) return
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    f.releasedAt = Math.round(performance.now())
    f.releasedBy = by
    f.stillThere = (document.getElementById('first')?.childElementCount ?? 0) > 0
    // The page's reveal has set the canvas's own transition to none at its 1500 ms cap: the page's rule gets its fade back.
    canvas.style.transition = ''
    f.opacityAtRelease = getComputedStyle(canvas).opacity
    const over = (by2) => {
      if (f.fadeEndedAt !== null) return
      f.fadeEndedAt = Math.round(performance.now())
      f.fadeEndedBy = by2
      f.opacityAfter = getComputedStyle(canvas).opacity
      canvas.style.transition = 'none'
      if (endStill) {
        endStill()
        f.stillEndedAt = Math.round(performance.now())
      }
    }
    canvas.addEventListener('transitionrun', () => (f.fadeRuns = Math.round(performance.now())), { once: true })
    canvas.addEventListener('transitionend', () => over('the fade ended'), { once: true })
    setTimeout(() => over('1500 ms after the tool let go'), 1500)
    document.getElementById('__listen_hold')?.remove()
    f.transitionAtRelease = getComputedStyle(canvas).transitionDuration
  }
  let lastGapEnd = null
  let last = null
  // The first picture is taken in the moment the page sets its mark, before the page's thread can stand still.
  const marked = () => {
    if (f.firstAt !== null || document.documentElement.dataset.firstPicture !== '1') return
    const now = performance.now()
    f.firstAt = Math.round(now)
    lastGapEnd = now
    if (mode === 'seconds') setTimeout(() => release(`${seconds} s after the first picture, by the clock`), seconds * 1000)
  }
  new MutationObserver(marked).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-first-picture'] })
  const tick = (t) => {
    marked()
    if (last !== null && t - last >= 250) lastGapEnd = t
    last = t
    if (f.firstAt !== null && f.releasedAt === null) {
      if (mode === 'frames' && t - f.firstAt >= afterMs && t - lastGapEnd >= steadyMs) release('the frames ran again')
      if (mode === 'seconds' && t - f.firstAt >= seconds * 1000) release(`${seconds} s after the first picture, at a frame`)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// In the page, before any of its scripts: the canvas's transition is taken away, and the moment the canvas is in sight
// is written down with the page's clock.
function cutIn() {
  const w = window.__listen
  const c = (w.cut = { seenAt: null, opacity: null, transition: null })
  const put = () => {
    if (document.getElementById('__listen_cut') || !document.documentElement) return
    const st = document.createElement('style')
    st.id = '__listen_cut'
    st.textContent = 'canvas{transition:none !important}'
    document.documentElement.appendChild(st)
  }
  put()
  document.addEventListener('DOMContentLoaded', put)
  const tick = (t) => {
    const canvas = document.querySelector('canvas')
    if (canvas && 'live' in canvas.dataset) {
      c.seenAt = Math.round(t)
      c.opacity = getComputedStyle(canvas).opacity
      c.transition = getComputedStyle(canvas).transitionDuration
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// In the page, before any of its scripts: one rule of the tool for the canvas, put into the document the moment it has a
// root, and what the canvas's computed style is: at every frame until the canvas carries data-live, at the first frame
// that finds it there, at each event of its fade, and at the first frame that finds the fade ended by the page (its own
// transition set to none). The computed style is read only in a frame or in an event of the fade, never between, so that
// no reading of the tool begins the fade at another moment than the page's own. Everything is on the page's clock.
function styleCanvas({ id, css }) {
  const w = window.__listen
  const s = (w.canvasStyle = { css, putAt: null, putBy: null, canvasThereAtPut: null, bodyThereAtPut: null, reads: 0, firstReadAt: null, lastReadAt: null, opacityFirst: null, opacityLast: null, opacityMin: null, opacityMax: null, willChange: null, transition: null, liveSetAt: null, liveAt: null, opacityAtLive: null, transitionAtLive: null, willChangeAtLive: null, events: [], fadeOverAt: null, fadeOverBy: null, opacityAfterFade: null, endedByPageAt: null, endedSeenAt: null, opacityWhenEnded: null, willChangeWhenEnded: null })
  const now = () => Math.round(performance.now())
  const put = (by) => {
    if (document.getElementById(id) || !document.documentElement) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = css
    document.documentElement.appendChild(st)
    s.putAt = now()
    s.putBy = by
    s.canvasThereAtPut = document.querySelector('canvas') !== null
    s.bodyThereAtPut = document.body !== null
  }
  put('at once')
  if (s.putAt === null) {
    const seen = new MutationObserver(() => {
      put('when the document got its root')
      if (s.putAt !== null) seen.disconnect()
    })
    seen.observe(document, { childList: true, subtree: true })
    document.addEventListener('DOMContentLoaded', () => put('when the document was read'))
  }
  // The moments the page sets data-live on the canvas and ends its fade: the time only, no style is read here.
  new MutationObserver((list) => {
    for (const m of list) {
      if (!(m.target instanceof HTMLCanvasElement)) continue
      if (m.attributeName === 'data-live' && s.liveSetAt === null) s.liveSetAt = now()
      if (m.attributeName === 'style' && s.endedByPageAt === null && m.target.style.transition === 'none') s.endedByPageAt = now()
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-live', 'style'] })
  const note = (e) => {
    const canvas = document.querySelector('canvas')
    if (!canvas || e.target !== canvas || e.propertyName !== 'opacity') return
    const at = now()
    const opacity = getComputedStyle(canvas).opacity
    if (s.events.length < 12) s.events.push({ at, type: e.type, opacity, elapsed: e.elapsedTime })
    if ((e.type === 'transitionend' || e.type === 'transitioncancel') && s.fadeOverAt === null) {
      s.fadeOverAt = at
      s.fadeOverBy = e.type
      s.opacityAfterFade = opacity
    }
  }
  for (const type of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']) document.addEventListener(type, note, true)
  const tick = (t) => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      if (!('live' in canvas.dataset)) {
        const cs = getComputedStyle(canvas)
        const o = Number(cs.opacity)
        s.reads++
        if (s.firstReadAt === null) {
          s.firstReadAt = Math.round(t)
          s.opacityFirst = cs.opacity
        }
        s.lastReadAt = Math.round(t)
        s.opacityLast = cs.opacity
        s.opacityMin = s.opacityMin === null ? o : Math.min(s.opacityMin, o)
        s.opacityMax = s.opacityMax === null ? o : Math.max(s.opacityMax, o)
        s.willChange = cs.willChange
        s.transition = cs.transitionDuration
      } else {
        if (s.liveAt === null) {
          const cs = getComputedStyle(canvas)
          s.liveAt = Math.round(t)
          s.opacityAtLive = cs.opacity
          s.transitionAtLive = cs.transitionDuration
          s.willChangeAtLive = cs.willChange
        }
        if (canvas.style.transition === 'none') {
          const cs = getComputedStyle(canvas)
          s.endedSeenAt = Math.round(t)
          s.opacityWhenEnded = cs.opacity
          s.willChangeWhenEnded = cs.willChange
          return
        }
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function end() {
  const w = window.__listen
  const canvas = document.querySelector('canvas')
  // Only a canvas that drew holds a card to ask about: asking a canvas without one would make one.
  let lostNow = null
  try {
    if (w.marks.some((m) => m.mark === 'first-picture')) lostNow = canvas?.getContext('webgl2')?.isContextLost() ?? null
  } catch {
    lostNow = null
  }
  // The card as the page's own context names it, asked only now, when the stay is over and only of a card that is there.
  let cardByPage = null
  try {
    const gl = lostNow === false ? canvas.getContext('webgl2') : null
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    if (gl) cardByPage = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  } catch {
    cardByPage = null
  }
  const now = performance.now()
  if (w.last !== null && now - w.last >= 250) w.gaps.push([Math.round(w.last), Math.round(now - w.last)])
  const html = document.documentElement
  const size = canvas ? { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight } : null
  return { marks: w.marks, lost: w.lost, back: w.back, refused: w.refused, gaps: w.gaps, perSecond: w.perSecond, frames: w.frames, endMs: Math.round(now), wall0: w.wall0, page0: w.page0, lostNow, cardByPage, made: html.dataset.made ?? null, detail: html.dataset.detail ?? null, canvasLive: canvas ? 'live' in canvas.dataset : null, canvas: size, ratio: window.devicePixelRatio, agent: navigator.userAgent, cores: navigator.hardwareConcurrency, memoryGb: navigator.deviceMemory ?? null, fade: w.fade ?? null, cut: w.cut ?? null, canvasStyle: w.canvasStyle ?? null, canvasAtEnd: canvas ? { opacity: getComputedStyle(canvas).opacity, willChange: getComputedStyle(canvas).willChange, inlineTransition: canvas.style.transition, stillThere: (document.getElementById('first')?.childElementCount ?? 0) > 0 } : null }
}

// The words of a page of the browser's own, through its shadow trees.
function words() {
  const parts = []
  const BLOCK = new Set(['TR', 'H1', 'H2', 'H3', 'H4', 'LI', 'DIV', 'P', 'TABLE', 'UL', 'BR', 'PRE'])
  const walk = (node) => {
    if (node.nodeType === 3) {
      const s = node.textContent.replace(/\s+/g, ' ').trim()
      if (s) parts.push(s)
      return
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return
    if (node.nodeType === 1 && (node.tagName === 'STYLE' || node.tagName === 'SCRIPT')) return
    if (node.shadowRoot) walk(node.shadowRoot)
    for (const c of node.childNodes) walk(c)
    if (node.nodeType === 1) parts.push(BLOCK.has(node.tagName) ? '\n' : node.tagName === 'TD' || node.tagName === 'TH' ? '\t' : ' ')
  }
  walk(document.documentElement)
  return parts.join('').replace(/[ \t]*\n[ \t\n]*/g, '\n')
}

async function cardPage(browserContext, file) {
  const page = await browserContext.newPage()
  try {
    await page.goto('chrome://gpu', { timeout: 20000 })
    let text = ''
    for (let i = 0; i < 20; i++) {
      await sleep(500)
      text = await page.evaluate(words).catch(() => '')
      if (/GL_RENDERER/.test(text) && /Log Messages/.test(text)) break
    }
    fs.writeFileSync(file, text)
    return text
  } catch (error) {
    fs.writeFileSync(file, `chrome://gpu could not be read: ${String(error?.message ?? error).split('\n')[0]}\n`)
    return ''
  } finally {
    await page.close().catch(() => undefined)
  }
}

const REPORT_DIRS = mac ? [path.join(os.homedir(), 'Library/Logs/DiagnosticReports'), '/Library/Logs/DiagnosticReports'] : []
function reportsSince(ms, into) {
  const found = []
  for (const dir of REPORT_DIRS) {
    let names = []
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const n of names) {
      const full = path.join(dir, n)
      try {
        const st = fs.statSync(full)
        if (!st.isFile() || st.mtimeMs < ms) continue
        found.push({ file: full, bytes: st.size, at: new Date(st.mtimeMs).toISOString() })
        if (st.size < 3 * 1048576) {
          fs.mkdirSync(into, { recursive: true })
          fs.copyFileSync(full, path.join(into, n))
        }
      } catch {
        // a report that went while it was read is no report
      }
    }
  }
  return found
}

const stamp = (ms) => {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
const OSLOG = 'process CONTAINS[c] "Chrome" OR process CONTAINS[c] "WebKit" OR process CONTAINS[c] "Playwright" OR senderImagePath CONTAINS[c] "Paravirt" OR senderImagePath CONTAINS[c] "IOGPU" OR senderImagePath CONTAINS[c] "IOAccel" OR senderImagePath CONTAINS[c] "Metal" OR subsystem CONTAINS[c] "Metal" OR process == "ReportCrash" OR (process == "kernel" AND (eventMessage CONTAINS[c] "GPU" OR eventMessage CONTAINS[c] "Paravirt" OR eventMessage CONTAINS[c] "memorystatus" OR eventMessage CONTAINS[c] "jetsam" OR eventMessage CONTAINS[c] "low swap"))'
async function machineLog(fromMs, toMs, file) {
  if (!mac) return null
  const r = await sh('log', ['show', '--start', stamp(fromMs - 2000), '--end', stamp(toMs + 2000), '--style', 'compact', '--info', '--predicate', OSLOG], 120000)
  const text = r.ok ? r.out : `log show failed: ${r.err.slice(0, 600)}\n${r.out}`
  fs.writeFileSync(file, text.length > 1500000 ? `${text.slice(0, 1500000)}\n... cut at 1500000 characters of ${text.length}\n` : text)
  return text.split('\n').length
}

// Chrome's own lines worth a place in the table. The whole of them is in <tag>-chrome.log.
const TELLING = /gpu_process_host|exit_code|GPU process|watchdog|[Cc]ontext lost|context was lost|ContextResult|command buffer|Metal|MTL|Exiting GPU|out of memory|OOM|hang|Hang|timed? ?out|Timeout|device lost|DeviceLost|GL_OUT_OF_MEMORY|CONTEXT_LOST|blocklist|crash/

async function one(base, query, round) {
  const beganUtc = utc()
  const tag = `${name}-r${round}-${query === '' ? 'address' : query.replace(/[^a-z0-9]+/gi, '-')}`
  const logFrom = fs.existsSync(driverLog) ? fs.statSync(driverLog).size : 0
  const began = Date.now()
  const browser = await begin(tag)
  const messages = []
  const samples = []
  const notes = []
  let root = null
  let profile = null
  let sampling = true
  let lossSeen = null
  const sample = async (why) => {
    const at = Date.now()
    const [list, memory, card] = await Promise.all([processes(), machineMemory(), cardCounters()])
    if (webkitMode) {
      const kind = (a) => (/WebKit\.GPU/.test(a) ? 'gpu-process' : /WebKit\.WebContent/.test(a) ? 'renderer' : /WebKit\.Networking/.test(a) ? 'network' : 'browser')
      const theirs = list.filter((p) => /Playwright\.app|com\.apple\.WebKit\./.test(p.args) && !/ps -axww/.test(p.args)).map((p) => ({ pid: p.pid, kind: kind(p.args), rssMb: Math.round(p.rssKb / 1024), vszMb: Math.round(p.vszKb / 1024), cpu: p.cpu, cpuS: cpuSeconds(p.time) }))
      samples.push({ at, why, processes: theirs, memory, card })
      return theirs
    }
    const rootIs = list.find((p) => p.args.includes(`--loss295-tag=${tag}`) && !/--type=/.test(p.args))
    root ??= rootIs?.pid ?? null
    profile ??= /--user-data-dir=(\S+)/.exec(rootIs?.args ?? '')?.[1] ?? null
    // The browser and everything begun under it (on some machines its children are begun by a helper of its own).
    const under = new Set(root === null ? [] : [root])
    for (let grew = true; grew; ) {
      grew = false
      for (const p of list) if (under.has(p.ppid) && !under.has(p.pid)) grew = under.add(p.pid) && true
    }
    const own = list.filter((p) => under.has(p.pid)).map((p) => ({ pid: p.pid, kind: kindOf(p.args), rssMb: Math.round(p.rssKb / 1024), vszMb: Math.round(p.vszKb / 1024), cpu: p.cpu, cpuS: cpuSeconds(p.time) }))
    samples.push({ at, why, processes: own, memory, card })
    return own
  }
  const loop = (async () => {
    while (sampling) {
      await sample('every 2 s').catch(() => undefined)
      await sleep(2000)
    }
  })()
  let result
  try {
    const context = await browser.newContext({ viewport: { width: viewW, height: viewH }, deviceScaleFactor: scale })
    const page = await context.newPage()
    let errorAt = null
    const t0 = Date.now()
    page.on('console', (m) => {
      if (isReadbackNotice(m.type(), m.text())) return
      if (m.type() === 'error' || m.type() === 'warning') messages.push({ afterGotoMs: Date.now() - t0, text: `${m.type()}: ${m.text()}` })
    })
    page.on('pageerror', (e) => {
      errorAt ??= Date.now()
      messages.push({ afterGotoMs: Date.now() - t0, text: `pageerror: ${e.message}` })
    })
    page.on('crash', () => messages.push({ afterGotoMs: Date.now() - t0, text: 'the page crashed (its process went)' }))
    await page.addInitScript(early)
    if (plainCanvas) {
      await page.addInitScript(() => {
        const put = () => {
          if (document.getElementById('__listen_plain') || !document.documentElement) return
          const st = document.createElement('style')
          st.id = '__listen_plain'
          st.textContent = 'canvas{opacity:1 !important;transition:none !important}'
          document.documentElement.appendChild(st)
        }
        put()
        document.addEventListener('DOMContentLoaded', put)
      })
      notes.push('the tool keeps the canvas at opacity 1 with no fade for the whole load')
    }
    if (noBlur) {
      await page.addInitScript(() => {
        const put = () => {
          if (document.getElementById('__listen_noblur') || !document.documentElement) return
          const st = document.createElement('style')
          st.id = '__listen_noblur'
          st.textContent = '*,*::before,*::after{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}'
          document.documentElement.appendChild(st)
        }
        put()
        document.addEventListener('DOMContentLoaded', put)
      })
      notes.push('the tool takes backdrop-filter from every element for the whole load')
    }
    if (hideCanvasS > 0) {
      await page.addInitScript(() => {
        const put = () => {
          if (document.getElementById('__listen_hide') || !document.documentElement) return
          const st = document.createElement('style')
          st.id = '__listen_hide'
          st.textContent = 'canvas{opacity:0 !important;transition:none !important}'
          document.documentElement.appendChild(st)
        }
        put()
        document.addEventListener('DOMContentLoaded', put)
      })
      notes.push(`the tool keeps the canvas at opacity 0 until ${hideCanvasS} s after the first picture`)
    }
    if (cutCanvas) {
      await page.addInitScript(cutIn)
      notes.push('the tool takes the transition from the canvas for the whole load: it comes into sight at the first picture by a cut')
    }
    if (canvasOpacity !== '') {
      await page.addInitScript(styleCanvas, { id: '__listen_opacity', css: `canvas:not([data-live]){opacity:${Number(canvasOpacity)} !important}` })
      notes.push(`the tool gives the canvas opacity ${Number(canvasOpacity)} from the page's first moment for as long as it carries no data-live; the fade at the first picture is the page's own`)
    }
    if (canvasWillChange) {
      await page.addInitScript(styleCanvas, { id: '__listen_willchange', css: 'canvas{will-change:opacity !important}' })
      notes.push("the tool sets will-change: opacity on the canvas from the page's first moment; its opacity and its fade are the page's own")
    }
    if (fadeCanvas !== '') {
      const frames = fadeCanvas === 'frames'
      await page.addInitScript(holdAndFade, { mode: frames ? 'frames' : 'seconds', seconds: frames ? null : Number(fadeCanvas), afterMs: FADE_AFTER_MS, steadyMs: FADE_STEADY_MS })
      notes.push(
        frames
          ? `the tool holds the canvas at opacity 0 and the still under it until the page's frames run again (${FADE_AFTER_MS} ms or more after the first picture, no two frames 250 ms apart in the ${FADE_STEADY_MS} ms before), then the page's own 0.5 s fade runs`
          : `the tool holds the canvas at opacity 0 and the still under it until ${Number(fadeCanvas)} s after the first picture, then the page's own 0.5 s fade runs`,
      )
    }
    await page.goto(`${base}${query === '' ? '' : `?${query}`}`, { waitUntil: 'commit' })
    let endedBy = 'the limit'
    let firstAt = null
    let dump = null
    let shownAt = null
    while (Date.now() - t0 < limitMs + stayMs) {
      await sleep(250)
      if (spindumpS > 0 && spindumpAtMs >= 0 && mac && dump === null && Date.now() - t0 >= spindumpAtMs) {
        const own = await sample('the sampler begun').catch(() => [])
        const gpu = own.find((p) => p.kind === 'gpu-process')?.pid
        if (gpu) {
          const file = path.join(out, `${tag}-spindump.txt`)
          notes.push(`spindump begun on the graphics process ${gpu} ${Date.now() - t0} ms after the address was asked for, for ${spindumpS} s`)
          dump = sh('sudo', ['-n', 'spindump', String(gpu), String(spindumpS), '10', '-file', file, '-noProcessingWhileSampling'], (spindumpS + 240) * 1000).then((r) => notes.push(`spindump ended ${r.ok ? 'well' : `badly: ${r.err.slice(0, 300)}`}`))
        }
      }
      // While the page's own thread waits for the card this question waits with it; the 2 s samples go on beside it.
      const s = await Promise.race([
        page.evaluate(() => ({ first: document.documentElement.dataset.firstPicture ?? null, lost: window.__listen?.lost.length ?? 0 })).catch(() => null),
        sleep(4000).then(() => null),
      ])
      if (hideCanvasS > 0 && firstAt !== null && shownAt === null && Date.now() - firstAt >= hideCanvasS * 1000) {
        shownAt = Date.now()
        const pageAt = await page.evaluate(() => (document.getElementById('__listen_hide')?.remove(), Math.round(performance.now()))).catch(() => null)
        notes.push(`the tool let the canvas into sight ${shownAt - firstAt} ms after the first picture (page clock ${pageAt})`)
        await sample('the canvas let into sight').catch(() => undefined)
      }
      if (s?.first === '1' && firstAt === null) {
        firstAt = Date.now()
        const own = await sample('the first picture').catch(() => [])
        if (spindumpS > 0 && spindumpAtMs < 0 && mac) {
          const gpu = own.find((p) => p.kind === 'gpu-process')?.pid
          if (gpu) {
            const file = path.join(out, `${tag}-spindump.txt`)
            notes.push(`spindump begun on the graphics process ${gpu} at the first picture for ${spindumpS} s`)
            dump = sh('sudo', ['-n', 'spindump', String(gpu), String(spindumpS), '10', '-file', file, '-noProcessingWhileSampling'], (spindumpS + 240) * 1000).then((r) => notes.push(`spindump ended ${r.ok ? 'well' : `badly: ${r.err.slice(0, 300)}`}`))
          }
        }
      }
      if (s && s.lost > 0 && lossSeen === null) {
        lossSeen = Date.now()
        await sample('the loss seen').catch(() => undefined)
      }
      if (lossSeen !== null && afterLossMs > 0 && Date.now() - lossSeen >= afterLossMs) {
        endedBy = `the loss and ${afterLossMs / 1000} s`
        break
      }
      if (firstAt !== null && Date.now() - firstAt >= stayMs) {
        endedBy = `the first picture and ${stayMs / 1000} s`
        break
      }
      if (firstAt === null && Date.now() - t0 >= limitMs) break
      if (errorAt !== null && firstAt === null && Date.now() - errorAt >= 8000) {
        endedBy = 'a page error and no picture 8 s after it'
        break
      }
    }
    await sample('the end of the stay').catch(() => undefined)
    const got = await page.evaluate(end).catch((error) => ({ failedAtEnd: String(error?.message ?? error).split('\n')[0], marks: [], lost: [], back: [], refused: [], gaps: [], perSecond: {}, frames: 0 }))
    if (got.canvasStyle) {
      const c = got.canvasStyle
      const first = got.marks?.find((m) => m.mark === 'first-picture')?.at ?? null
      const rel = (t) => (t === null || first === null ? `${t}` : `${t - first >= 0 ? '+' : ''}${t - first}`)
      notes.push(`the canvas's style by the page's clock: the tool's rule (${c.css}) put ${c.putAt} ms of the page, ${c.putBy}, the canvas ${c.canvasThereAtPut ? 'already there' : 'not yet there'}, the body ${c.bodyThereAtPut ? 'already there' : 'not yet there'}; before data-live ${c.reads} frames read (${c.firstReadAt} to ${c.lastReadAt} ms of the page): opacity ${c.opacityFirst} first, ${c.opacityLast} last, ${c.opacityMin} to ${c.opacityMax}, will-change ${c.willChange}, transition ${c.transition}; data-live set ${rel(c.liveSetAt)} of the first picture; at the first frame with data-live (${rel(c.liveAt)}): opacity ${c.opacityAtLive}, transition ${c.transitionAtLive}, will-change ${c.willChangeAtLive}; the fade's events: ${c.events.map((e) => `${e.type} ${rel(e.at)} opacity ${e.opacity} elapsed ${e.elapsed}`).join(', ') || 'none'}; the fade ended by the page ${rel(c.endedByPageAt)}, seen in a frame ${rel(c.endedSeenAt)}: opacity ${c.opacityWhenEnded}, will-change ${c.willChangeWhenEnded}`)
    }
    if (got.canvasAtEnd) notes.push(`the canvas at the load's end: opacity ${got.canvasAtEnd.opacity}, will-change ${got.canvasAtEnd.willChange}, its own transition "${got.canvasAtEnd.inlineTransition}", the still ${got.canvasAtEnd.stillThere ? 'still there' : 'gone'}`)
    const shot = `${tag}.png`
    await page.screenshot({ path: path.join(out, shot), timeout: 20000 }).catch((error) => messages.push({ afterGotoMs: Date.now() - t0, text: `the tool's picture failed: ${String(error?.message ?? error).split('\n')[0]}` }))
    if (dump) await dump
    const cardText = webkitMode ? '' : await cardPage(context, path.join(out, `${tag}-gpu.txt`))
    let told = null
    try {
      if (webkitMode) throw new Error('WebKit names none to the driver')
      const cdp = await browser.newBrowserCDPSession()
      told = (await cdp.send('SystemInfo.getProcessInfo')).processInfo
    } catch (error) {
      notes.push(`the browser did not name its processes: ${String(error?.message ?? error).split('\n')[0]}`)
    }
    await sample('before the browser was closed').catch(() => undefined)
    // What Chrome's own crash handler wrote for this browser (a dump made with or without a crash), before the profile goes.
    if (profile) {
      for (const sub of ['new', 'pending', 'completed']) {
        let names = []
        try {
          names = fs.readdirSync(path.join(profile, 'Crashpad', sub))
        } catch {
          continue
        }
        for (const n of names.filter((x) => x.endsWith('.dmp')).slice(0, 4)) {
          try {
            const st = fs.statSync(path.join(profile, 'Crashpad', sub, n))
            notes.push(`Chrome's crash handler wrote ${sub}/${n}: ${st.size} bytes at ${new Date(st.mtimeMs).toISOString()}${firstAt ? ` (${Math.round(st.mtimeMs - firstAt)} ms after the tool saw the first picture)` : ''}`)
            if (st.size < 40 * 1048576) {
              fs.mkdirSync(path.join(out, `${tag}-dumps`), { recursive: true })
              fs.copyFileSync(path.join(profile, 'Crashpad', sub, n), path.join(out, `${tag}-dumps`, n))
            }
          } catch {
            // a dump that went while it was read is no dump
          }
        }
      }
    }
    result = { name, tag, query, round, beganUtc, endedUtc: utc(), endedBy, shot, t0, firstAtWall: firstAt, lossSeenWall: lossSeen, ...got, messages, told, crashCount: /GPU process crash count\s*:?\s*(\d+)/.exec(cardText)?.[1] ?? null }
  } catch (error) {
    result = { name, tag, query, round, beganUtc, endedUtc: utc(), failed: String(error?.message ?? error), messages, marks: [], lost: [], back: [], refused: [], gaps: [], perSecond: {}, frames: 0 }
  } finally {
    sampling = false
    await loop
    await browser.close().catch(() => undefined)
  }
  await sleep(600)
  // Chrome's own lines of this load, cut out of the driver's file.
  let lines = []
  try {
    const fd = fs.openSync(driverLog, 'r')
    const size = fs.fstatSync(fd).size
    const buf = Buffer.alloc(Math.max(0, size - logFrom))
    fs.readSync(fd, buf, 0, buf.length, logFrom)
    fs.closeSync(fd)
    const text = buf.toString('utf8')
    fs.writeFileSync(path.join(out, `${tag}-chrome.log`), text)
    lines = text.split('\n')
  } catch (error) {
    notes.push(`the driver's file could not be read: ${String(error?.message ?? error)}`)
  }
  const telling = lines.filter((l) => /\[(err|out)\]/.test(l) && TELLING.test(l) && !/<launching>/.test(l) && !/\]cmd: /.test(l)).map((l) => l.replace(/^\S+ pw:browser /, '').slice(0, 700)).slice(0, 400)
  const reports = reportsSince(began, path.join(out, `${tag}-reports`))
  const gpus = []
  for (const s of samples) for (const p of s.processes) if (p.kind === 'gpu-process' && !gpus.includes(p.pid)) gpus.push(p.pid)
  let logLines = null
  // The machine's own log: around the loss where one was seen (25 s before it to 15 s after), else the first 90 s of the load.
  const seen = result.lossSeenWall ?? null
  if (oslog === 'all' || (oslog === 'lost' && (result.lost?.length || round === 1))) logLines = await machineLog(seen === null ? began : seen - 25000, seen === null ? Math.min(Date.now(), began + 90000) : seen + 15000, path.join(out, `${tag}-oslog.txt`)).catch(() => null)
  return { ...result, root, graphicsProcesses: gpus, chromeLines: lines.length, telling, reports, machineLogLines: logLines, notes, samples }
}

function line(r) {
  const what = r.query === '' ? 'the plain address' : `?${r.query}`
  if (r.failed) return `${what} round ${r.round}: FAILED ${r.failed}; messages ${r.messages.length}`
  const at = (mark, value) => r.marks.find((m) => m.mark === mark && m.value === value)?.at ?? null
  const first = at('first-picture', '1')
  const ready = at('made', 'ready')
  const rel = (t) => (first === null ? `${t} ms of the page` : `${t - first >= 0 ? '+' : ''}${t - first}`)
  const gaps = r.gaps.filter(([from, ms]) => first !== null && from + ms > first && ms >= 1000)
  const firstWall = first === null ? null : r.wall0 + (first - r.page0)
  const gpuAt = (s) => s.processes.filter((p) => p.kind === 'gpu-process').map((p) => `${p.pid} ${p.rssMb} MB ${p.cpuS} s`).join(' and ') || 'none'
  const lossWall = r.lost.length && first !== null ? r.wall0 + (r.lost[0].at - r.page0) : null
  const before = lossWall === null ? null : [...r.samples].reverse().find((s) => s.at <= lossWall)
  const after = lossWall === null ? null : r.samples.find((s) => s.at > lossWall + 1500)
  const top = r.samples.reduce((m, s) => Math.max(m, ...s.processes.filter((p) => p.kind === 'gpu-process').map((p) => p.rssMb)), 0)
  const free = r.samples.map((s) => s.memory?.freeMb).filter((x) => Number.isFinite(x))
  return `${what} round ${r.round}: first picture ${first === null ? 'none' : `${first} ms`}; ready ${ready === null || first === null ? 'none' : `+${ready - first}`}; the card lost ${r.lost.length ? r.lost.map((l) => rel(l.at)).join(', ') : 'never'}${r.back.length ? `, back ${r.back.map(rel).join(', ')}` : ''}; lost at the end: ${r.lostNow === null ? 'no card' : r.lostNow ? 'yes' : 'no'}; graphics processes ${r.graphicsProcesses.join(' then ') || 'none seen'}${lossWall === null ? '' : `; the last reading before the loss (${before ? `${Math.round((before.at - firstWall) / 100) / 10} s` : 'none'}): ${before ? gpuAt(before) : 'none'}; the first 1.5 s and more after it: ${after ? gpuAt(after) : 'none'}`}; most of the graphics process ${top} MB; the machine's free memory least ${free.length ? Math.min(...free) : 'not read'} MB; crash count on chrome://gpu ${r.crashCount ?? 'not read'}; crash reports ${r.reports.length}; no frame for 1 s and more after the first picture: ${gaps.length ? gaps.map(([from, ms]) => `${ms} ms from ${rel(from)}`).join(', ') : 'none'}; frames ${r.frames}; messages ${r.messages.length}; Chrome's lines ${r.chromeLines}, telling ${r.telling.length}; ended by ${r.endedBy} at ${rel(r.endMs)}`
}

const server = await serve({ dist, port: 0 })
const file = path.join(out, `${name}.json`)
const table = path.join(out, `${name}.txt`)
fs.writeFileSync(table, `item 295, listen ${name}: ${dist}, ${build}, ${webkitMode ? `the driver's WebKit ${webkit.executablePath().split('/').find((x) => /^webkit-\d+/.test(x)) ?? ''} in a window with the card (the engine of Safari, not Safari itself)` : local ? 'the installed Chrome with the card' : 'the pinned browser, software'}, nothing of the tool on the card, flags ${extraFlags.join(' ') || 'none of its own'}${plainFlags ? ', WITHOUT the flags of the tree\'s tools (no --ignore-gpu-blocklist, --enable-gpu-rasterization, --disable-hang-monitor, --hide-scrollbars, --mute-audio, nor the three against throttling and the colour profile one; the driver\'s other default switches stay, the whole line is in each load\'s chrome log)' : ''}, window ${viewW}x${viewH} at scale ${scale}${spindumpS ? `, SPINDUMP ${spindumpS} s at the first picture (not a listening load)` : ''}, stay ${stayMs / 1000} s, after a loss ${afterLossMs ? `${afterLossMs / 1000} s` : 'the whole stay'}, ${os.cpus().length} processors, ${Math.round(os.totalmem() / 1048576)} MB, begun ${new Date().toISOString()}\n`)

// The card as the browser names it before any page of ours, in a browser of its own.
try {
  if (webkitMode) throw new Error('WebKit has no such page; each load names the card by the page\'s own context at its end')
  const b = await begin(`${name}-card`)
  const c = await b.newContext()
  const text = await cardPage(c, path.join(out, `${name}-gpu-before.txt`))
  const pick = (k) => new RegExp(`${k}\\s*:?\\s*([^\\n]*)`).exec(text)?.[1]?.trim() ?? 'not read'
  fs.appendFileSync(table, `chrome://gpu before any page: GL_RENDERER ${pick('GL_RENDERER')}; GL_VERSION ${pick('GL_VERSION')}; Display type ${pick('Display type')}; crash count ${pick('GPU process crash count')}\n`)
  await b.close()
} catch (error) {
  fs.appendFileSync(table, `chrome://gpu before any page: not read (${String(error?.message ?? error).split('\n')[0]})\n`)
}

const results = []
const most = Math.max(...loads.map((l) => l.count))
for (let round = 1; round <= most; round++) {
  for (const l of loads) {
    if (round > l.count) continue
    const r = await one(server.url, l.query, round)
    results.push(r)
    if (results.length === 1 && r.agent) fs.appendFileSync(table, `${r.agent} · ${r.cores} processors · the card by the page's own context at the end of the first load: ${r.cardByPage ?? 'not asked (lost) or not named'}\n`)
    const text = `${utc()} ${line(r)}`
    console.log(text)
    fs.appendFileSync(table, `${text}\n`)
    for (const m of r.messages.slice(0, 4)) fs.appendFileSync(table, `    message at ${m.afterGotoMs} ms after the address was asked: ${m.text}\n`)
    if (r.messages.length > 4) fs.appendFileSync(table, `    and ${r.messages.length - 4} more\n`)
    for (const l2 of r.telling.slice(0, 14)) fs.appendFileSync(table, `    chrome: ${l2}\n`)
    if (r.telling.length > 14) fs.appendFileSync(table, `    and ${r.telling.length - 14} more telling lines\n`)
    for (const rep of r.reports) fs.appendFileSync(table, `    crash report: ${rep.file} (${rep.bytes} bytes, ${rep.at})\n`)
    for (const n of r.notes) fs.appendFileSync(table, `    note: ${n}\n`)
    fs.writeFileSync(file, JSON.stringify(results, null, 1))
  }
}
await server.close()
for (const l of loads) {
  const of = results.filter((r) => r.query === l.query)
  const drew = of.filter((r) => !r.failed && r.marks.some((m) => m.mark === 'first-picture'))
  const lost = of.filter((r) => !r.failed && r.lost.length)
  const died = lost.filter((r) => r.graphicsProcesses.length > 1)
  const last = `${name} ${l.query === '' ? 'the plain address' : `?${l.query}`}: ${of.length} browsers; a first picture in ${drew.length}; the card lost in ${lost.length}; of those with a new graphics process ${died.length}; with a message ${of.filter((r) => r.messages.length).length}; failed ${of.filter((r) => r.failed).length}`
  console.log(last)
  fs.appendFileSync(table, `${last}\n`)
}
