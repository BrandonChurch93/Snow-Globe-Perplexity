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
  return { marks: w.marks, lost: w.lost, back: w.back, refused: w.refused, gaps: w.gaps, perSecond: w.perSecond, frames: w.frames, endMs: Math.round(now), wall0: w.wall0, page0: w.page0, lostNow, cardByPage, made: html.dataset.made ?? null, detail: html.dataset.detail ?? null, canvasLive: canvas ? 'live' in canvas.dataset : null, canvas: size, ratio: window.devicePixelRatio, agent: navigator.userAgent, cores: navigator.hardwareConcurrency, memoryGb: navigator.deviceMemory ?? null }
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
