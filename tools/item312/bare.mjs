// node tools/item312/bare.mjs --dist <built page> --name <tag> --loads "8:|4:quality=low&season=winter|2:season=spring"
//      [--local] [--limit 120] [--stay 3] [--out out/work/item312]
//
// Item 285, decision 312, T6 b: main's page as a visitor has it, with nothing of a tool in the card's way. The loads of
// tools/item312/measure.mjs that opened in winter lost the card in 5 of 12; that tool wraps the card's calls, sets a
// fence, reads a texture back and profiles the thread, so those loads cannot say whether a visitor loses it too. This one
// touches the card with nothing: it listens for the page's messages, for the loss and the return of the card, for the
// page's own marks, and counts the frames. It asks the canvas whether its card is lost, and takes a picture of the
// window, only after the stay is over.
//
// --loads names the addresses and how many browsers each gets: count:query, apart by |; an empty query is the plain
// address. Round by round, one browser begun for each load, as a first visit is. A load is over --stay s after the mark
// "ready", or 8 s after a page error where no picture came, or at --limit s.
// --local opens the installed Chrome in a window with the machine's graphics card, with the flags of every tool of
// this tree; without it the pinned browser draws with the software renderer.
// It writes <out>/<name>.json, <name>.txt and one picture a load. It changes nothing in the page.
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
const name = str('name', 'bare')
const local = args.local === true
const limitMs = Number(str('limit', '120')) * 1000
const stayMs = Number(str('stay', '3')) * 1000
const out = path.resolve(str('out', 'out/work/item312'))
const loads = str('loads', '4:').split('|').map((s) => {
  const cut = s.indexOf(':')
  return { count: Number(s.slice(0, cut)), query: s.slice(cut + 1) }
})
fs.mkdirSync(out, { recursive: true })
const utc = () => new Date().toISOString().slice(11, 19)
const build = fs.existsSync(path.join(dist, 'build.json')) ? fs.readFileSync(path.join(dist, 'build.json'), 'utf8').trim() : 'no build.json'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function early() {
  const w = (window.__bare = { marks: [], lost: [], back: [], gaps: [], frames: 0, last: null })
  window.addEventListener('webglcontextlost', () => w.lost.push(Math.round(performance.now())), true)
  window.addEventListener('webglcontextrestored', () => w.back.push(Math.round(performance.now())), true)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (el instanceof Element && m.attributeName) w.marks.push({ at: Math.round(performance.now()), mark: m.attributeName.slice(5), value: el.getAttribute(m.attributeName) })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-first-picture', 'data-made', 'data-detail'] })
  const tick = (t) => {
    if (w.last !== null && t - w.last >= 1000) w.gaps.push([Math.round(w.last), Math.round(t - w.last)])
    w.last = t
    w.frames++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function end() {
  const w = window.__bare
  const canvas = document.querySelector('canvas')
  // Only a canvas that drew holds a card to ask about: asking a canvas without one would make one.
  let lostNow = null
  try {
    if (w.marks.some((m) => m.mark === 'first-picture')) lostNow = canvas?.getContext('webgl2')?.isContextLost() ?? null
  } catch {
    lostNow = null
  }
  const now = performance.now()
  if (w.last !== null && now - w.last >= 1000) w.gaps.push([Math.round(w.last), Math.round(now - w.last)])
  const html = document.documentElement
  return { marks: w.marks, lost: w.lost, back: w.back, gaps: w.gaps, frames: w.frames, endMs: Math.round(now), lostNow, made: html.dataset.made ?? null, detail: html.dataset.detail ?? null, canvasLive: canvas ? 'live' in canvas.dataset : null, agent: navigator.userAgent, cores: navigator.hardwareConcurrency }
}

async function one(base, query, round) {
  const beganUtc = utc()
  const browser = await launch({ local, extraArgs: ['--disable-hang-monitor'] })
  const messages = []
  const tag = `${name}-r${round}-${query === '' ? 'address' : query.replace(/[^a-z0-9]+/gi, '-')}`
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
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
    await page.addInitScript(early)
    await page.goto(`${base}${query === '' ? '' : `?${query}`}`, { waitUntil: 'commit' })
    let endedBy = 'the limit'
    let readyAt = null
    while (Date.now() - t0 < limitMs) {
      await sleep(250)
      const s = await page.evaluate(() => ({ made: document.documentElement.dataset.made ?? null, first: document.documentElement.dataset.firstPicture ?? null })).catch(() => null)
      if (s?.made === 'ready') readyAt ??= Date.now()
      if (readyAt !== null && Date.now() - readyAt >= stayMs) {
        endedBy = `the mark ready and ${stayMs / 1000} s`
        break
      }
      if (errorAt !== null && s?.first !== '1' && Date.now() - errorAt >= 8000) {
        endedBy = 'a page error and no picture 8 s after it'
        break
      }
    }
    const got = await page.evaluate(end)
    const shot = `${tag}.png`
    await page.screenshot({ path: path.join(out, shot), timeout: 20000 }).catch((error) => messages.push({ afterGotoMs: Date.now() - t0, text: `the tool's picture failed: ${String(error?.message ?? error).split('\n')[0]}` }))
    return { name, tag, query, round, beganUtc, endedUtc: utc(), endedBy, shot, ...got, messages }
  } catch (error) {
    return { name, tag, query, round, beganUtc, endedUtc: utc(), failed: String(error?.message ?? error), messages }
  } finally {
    await browser.close().catch(() => undefined)
  }
}

function line(r) {
  const what = r.query === '' ? 'the plain address' : `?${r.query}`
  if (r.failed) return `${what} round ${r.round}: FAILED ${r.failed}; messages ${r.messages.length}`
  const at = (mark, value) => r.marks.find((m) => m.mark === mark && m.value === value)?.at ?? null
  const first = at('first-picture', '1')
  const ready = at('made', 'ready')
  const rel = (t) => (first === null ? `${t} ms of the page` : `${t - first >= 0 ? '+' : ''}${t - first}`)
  const gaps = r.gaps.filter(([from, ms]) => first !== null && from + ms > first)
  return `${what} round ${r.round}: first picture ${first === null ? 'none' : `${first} ms`}; ready ${ready === null || first === null ? 'none' : `+${ready - first}`}; the card lost ${r.lost.length ? r.lost.map(rel).join(', ') : 'never'}${r.back.length ? `, back ${r.back.map(rel).join(', ')}` : ''}; lost at the end: ${r.lostNow === null ? 'no card' : r.lostNow ? 'yes' : 'no'}; no frame for 1 s and more after the first picture: ${gaps.length ? gaps.map(([from, ms]) => `${ms} ms from ${rel(from)}`).join(', ') : 'none'}; frames ${r.frames}; messages ${r.messages.length}; ended by ${r.endedBy} at ${rel(r.endMs)}`
}

const server = await serve({ dist, port: 0 })
const file = path.join(out, `${name}.json`)
const table = path.join(out, `${name}.txt`)
fs.writeFileSync(table, `item 312, T6 b, bare ${name}: ${dist}, ${build}, ${local ? 'the installed Chrome with the card' : 'the pinned browser, software'}, nothing of the tool on the card, begun ${new Date().toISOString()}\n`)
const results = []
const most = Math.max(...loads.map((l) => l.count))
for (let round = 1; round <= most; round++) {
  for (const l of loads) {
    if (round > l.count) continue
    const r = await one(server.url, l.query, round)
    results.push(r)
    if (results.length === 1 && r.agent) fs.appendFileSync(table, `${r.agent} · ${r.cores} processors\n`)
    const text = `${utc()} ${line(r)}`
    console.log(text)
    fs.appendFileSync(table, `${text}\n`)
    for (const m of r.messages.slice(0, 6)) fs.appendFileSync(table, `    message at ${m.afterGotoMs} ms after the address was asked: ${m.text}\n`)
    if (r.messages.length > 6) fs.appendFileSync(table, `    and ${r.messages.length - 6} more\n`)
    fs.writeFileSync(file, JSON.stringify(results, null, 1))
  }
}
await server.close()
for (const l of loads) {
  const of = results.filter((r) => r.query === l.query)
  const drew = of.filter((r) => !r.failed && r.marks.some((m) => m.mark === 'first-picture'))
  const last = `${name} ${l.query === '' ? 'the plain address' : `?${l.query}`}: ${of.length} browsers; a first picture in ${drew.length}; the card lost in ${of.filter((r) => !r.failed && r.lost.length).length}; with a message ${of.filter((r) => r.messages.length).length}; failed ${of.filter((r) => r.failed).length}`
  console.log(last)
  fs.appendFileSync(table, `${last}\n`)
}
