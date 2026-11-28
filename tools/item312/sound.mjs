// node tools/item312/sound.mjs --dist <built page> --name <tag> [--local] [--unmuted] [--rounds 8] [--arms without,with,near]
//      [--lead 2000] [--near 100] [--limit 120] [--out out/work/item312]
// Decision 314, T4c, for measuring alone: nothing of the page is changed. Run from the root of a tree that has node_modules.
// The question: the first sound context a browser makes in its life is long (the browser wakes its sound service inside
// `new AudioContext()`). Does one early call of navigator.mediaDevices.enumerateDevices() wake that service, so that
// the first context is short.
// Every reading is taken in a browser begun for it, and a round begins one browser for each arm:
//   without   no call; the first context is made --lead ms after the first picture
//   with      the call is made at the first picture, not awaited, its rejection swallowed; the first context --lead ms later
//   near      the same with the context only --near ms after the call: a visitor who presses at once
// Odd rounds take the arms in the order given, even rounds in the other, so that no arm is always the first of a round.
// The context is made as a gesture makes it (the browser is told the script runs for a gesture), so it is born as the
// page's own is at a first press, and the browser writes no warning of a context made before a gesture. The call is
// made with no gesture, as a page would make it early. Kept for each browser, by the page's clock:
//   the first picture; the call's own time on the thread, the ms until its promise settled and how (fulfilled,
//   rejected, not settled when the context was made), the count of entries it gave, whole and by kind (numbers only:
//   no label and no id is read); the ms of `new AudioContext()` for the first context and for one more made after it;
//   the first context's state at birth and when it read "running"; the longest gap of a 20 ms timer between the call
//   and the context (the thread standing); what navigator.permissions.query says of the microphone and of the camera
//   before the call and after the context; rejections that reached the page (unhandledrejection); the page's messages
//   (errors, warnings, exceptions).
// --local opens the installed Chrome in a window with the machine's graphics card; without it the pinned browser draws
// with the software renderer. --unmuted leaves out --mute-audio, which every other tool of this tree passes: a
// visitor's browser is not muted. Nothing is ever played: no source is made or started.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { findBrowser, isReadbackNotice, softwareRenderer } from '../lib/browser.mjs'
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
const name = str('name', 'sound')
const local = args.local === true
const unmuted = args.unmuted === true
const rounds = Number(str('rounds', '8'))
const arms = str('arms', 'without,with,near').split(',')
const leadMs = Number(str('lead', '2000'))
const nearMs = Number(str('near', '100'))
const limitMs = Number(str('limit', '120')) * 1000
const out = path.resolve(str('out', 'out/work/item312'))
fs.mkdirSync(out, { recursive: true })
const utc = () => new Date().toISOString().slice(11, 19)
const build = fs.existsSync(path.join(dist, 'build.json')) ? fs.readFileSync(path.join(dist, 'build.json'), 'utf8').trim() : 'no build.json'

// The flags of tools/lib/browser.mjs, written out here so that --mute-audio can be left out.
const COMMON = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', '--hide-scrollbars']
const flags = [...COMMON, ...(unmuted ? [] : ['--mute-audio'])]
function begin() {
  const ignore = unmuted ? { ignoreDefaultArgs: ['--mute-audio'] } : {}
  if (local) return chromium.launch({ channel: 'chrome', headless: false, args: [...flags, '--ignore-gpu-blocklist', '--enable-gpu-rasterization'], ...ignore })
  const soft = softwareRenderer()
  return chromium.launch({ executablePath: findBrowser(), headless: true, args: [...soft.flags, ...flags], ...(soft.env ? { env: soft.env } : {}), ...ignore })
}

function early() {
  window.__t4c = { rejections: [], gaps: [], last: performance.now(), call: null }
  const w = window.__t4c
  window.addEventListener('unhandledrejection', (e) => w.rejections.push(String(e.reason?.message ?? e.reason)))
  setInterval(() => {
    const t = performance.now()
    if (t - w.last >= 60) w.gaps.push([Math.round(w.last), Math.round(t - w.last)])
    w.last = t
  }, 20)
}

async function ask(call) {
  const w = window.__t4c
  const state = async (what) => {
    try {
      return (await navigator.permissions.query({ name: what })).state
    } catch (error) {
      return `not known (${error?.name ?? 'error'})`
    }
  }
  const before = { microphone: await state('microphone'), camera: await state('camera') }
  const c = { made: call, at: performance.now(), has: typeof navigator.mediaDevices?.enumerateDevices === 'function', secure: window.isSecureContext, callMs: null, settledMs: null, how: call ? 'not settled' : 'not made', entries: null, kinds: null, before }
  w.call = c
  if (call && c.has) {
    const t = performance.now()
    c.at = t
    try {
      const p = navigator.mediaDevices.enumerateDevices()
      c.callMs = performance.now() - t
      p.then(
        (list) => {
          c.settledMs = performance.now() - t
          c.how = 'fulfilled'
          c.entries = list.length
          c.kinds = { audioinput: 0, audiooutput: 0, videoinput: 0 }
          for (const d of list) c.kinds[d.kind] = (c.kinds[d.kind] ?? 0) + 1
        },
        (error) => {
          c.settledMs = performance.now() - t
          c.how = `rejected (${error?.name ?? 'error'})`
        },
      )
    } catch (error) {
      c.callMs = performance.now() - t
      c.how = `threw (${error?.name ?? 'error'})`
    }
  } else if (call) c.how = 'skipped: no navigator.mediaDevices'
  return true
}

async function make(lead) {
  const w = window.__t4c
  const c = w.call
  const wait = c.at + lead - performance.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  const C = window.AudioContext ?? window.webkitAudioContext
  const made = []
  const howThen = c.how
  let first = null
  for (let i = 0; C && i < 2; i++) {
    const t = performance.now()
    const x = new C()
    const one = { afterCallMs: t - c.at, ms: performance.now() - t, state: x.state, rate: x.sampleRate, runningAfterMs: x.state === 'running' ? 0 : null }
    made.push(one)
    if (i === 0) {
      first = x
      x.addEventListener('statechange', () => {
        if (x.state === 'running' && one.runningAfterMs === null) one.runningAfterMs = performance.now() - t
      })
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  const tEnd = performance.now()
  while (c.made && c.has && c.how === 'not settled' && performance.now() - tEnd < 10000) await new Promise((r) => setTimeout(r, 50))
  const state = async (what) => {
    try {
      return (await navigator.permissions.query({ name: what })).state
    } catch (error) {
      return `not known (${error?.name ?? 'error'})`
    }
  }
  const after = { microphone: await state('microphone'), camera: await state('camera') }
  const firstAt = c.at + (made[0]?.afterCallMs ?? 0)
  const gaps = w.gaps.filter(([from, ms]) => from + ms >= c.at && from <= firstAt)
  await first?.close().catch(() => undefined)
  return {
    call: { made: c.made, has: c.has, secure: c.secure, atMs: Math.round(c.at), callMs: c.callMs, settledMs: c.settledMs, how: c.how, howWhenTheContextWasMade: howThen, entries: c.entries, kinds: c.kinds },
    contexts: made,
    permission: { before: c.before, after },
    longestGapMs: gaps.reduce((m, [, ms]) => Math.max(m, ms), 0),
    rejections: w.rejections,
    agent: navigator.userAgent,
    cores: navigator.hardwareConcurrency,
  }
}

async function one(base, arm, round) {
  const beganUtc = utc()
  const browser = await begin()
  const messages = []
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on('console', (m) => {
      if (isReadbackNotice(m.type(), m.text())) return
      if (m.type() === 'error' || m.type() === 'warning') messages.push(`${m.type()}: ${m.text()}`)
    })
    page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
    await page.addInitScript(early)
    const cdp = await context.newCDPSession(page)
    await page.goto(`${base}?quality=low&season=winter`, { waitUntil: 'commit' })
    await page.waitForFunction(() => document.documentElement.dataset.firstPicture === '1', null, { timeout: limitMs, polling: 20 })
    const firstPictureMs = Math.round(await page.evaluate(() => performance.now()))
    await page.evaluate(ask, arm !== 'without')
    const lead = arm === 'near' ? nearMs : leadMs
    const got = await cdp.send('Runtime.evaluate', { expression: `(${make})(${lead})`, awaitPromise: true, returnByValue: true, userGesture: true })
    if (got.exceptionDetails) throw new Error(got.exceptionDetails.exception?.description ?? got.exceptionDetails.text)
    return { name, arm, round, leadMs: lead, beganUtc, firstPictureMs, ...got.result.value, messages }
  } catch (error) {
    return { name, arm, round, beganUtc, failed: String(error?.message ?? error), messages }
  } finally {
    await browser.close().catch(() => undefined)
  }
}

const f = (x, d = 1) => (x === null || x === undefined ? 'none' : Number(x).toFixed(d))
function line(r) {
  if (r.failed) return `${r.arm} round ${r.round}: FAILED ${r.failed}; messages ${r.messages.length}`
  const c = r.call
  const call = !c.made ? 'no call' : `the call ${f(c.callMs)} ms on the thread, ${c.how}${c.settledMs === null ? '' : ` after ${f(c.settledMs)} ms`}${c.entries === null ? '' : `, ${c.entries} entries (${c.kinds.audioinput} sound in, ${c.kinds.audiooutput} sound out, ${c.kinds.videoinput} picture in)`}${c.howWhenTheContextWasMade === c.how ? '' : `, ${c.howWhenTheContextWasMade} when the context was made`}`
  const x = r.contexts
  const p = r.permission
  const same = p.before.microphone === p.after.microphone && p.before.camera === p.after.camera
  return `${r.arm} round ${r.round}: first picture ${r.firstPictureMs} ms; ${call}; first context ${f(x[0]?.ms)} ms, made ${f(x[0]?.afterCallMs, 0)} ms after ${c.made ? 'the call' : 'the first picture'}, born ${x[0]?.state}${x[0]?.runningAfterMs ? `, running after ${f(x[0].runningAfterMs, 0)} ms` : ''}; one more ${f(x[1]?.ms)} ms; longest gap of the thread between ${f(r.longestGapMs, 0)} ms; microphone ${p.before.microphone} then ${p.after.microphone}, camera ${p.before.camera} then ${p.after.camera}${same ? '' : ' CHANGED'}; rejections that reached the page ${r.rejections.length}; messages ${r.messages.length}`
}

const server = await serve({ dist, port: 0 })
const file = path.join(out, `${name}.json`)
const table = path.join(out, `${name}.txt`)
fs.writeFileSync(table, `item 314, T4c, sound ${name}: ${dist}, ${build}, ${local ? 'the installed Chrome with the card' : 'the pinned browser, software'}, ${unmuted ? 'not muted' : 'muted (--mute-audio)'}, the context ${leadMs} ms after the call (near: ${nearMs} ms), begun ${new Date().toISOString()}\n`)
const results = []
for (let round = 1; round <= rounds; round++) {
  for (const arm of round % 2 ? arms : [...arms].reverse()) {
    const r = await one(server.url, arm, round)
    results.push(r)
    if (results.length === 1 && r.agent) fs.appendFileSync(table, `${r.agent} · ${r.cores} processors\n`)
    const text = `${utc()} ${line(r)}`
    console.log(text)
    fs.appendFileSync(table, `${text}\n`)
    for (const m of r.messages) fs.appendFileSync(table, `    message: ${m}\n`)
    for (const m of r.rejections ?? []) fs.appendFileSync(table, `    rejection: ${m}\n`)
    fs.writeFileSync(file, JSON.stringify(results, null, 1))
  }
}
await server.close()
const mid = (v) => {
  const s = [...v].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null
}
for (const arm of arms) {
  const of = results.filter((r) => r.arm === arm && !r.failed)
  const ms = of.map((r) => r.contexts[0]?.ms).filter((x) => typeof x === 'number')
  const last = `${name} ${arm}: ${of.length} browsers of ${results.filter((r) => r.arm === arm).length}; first context ms, least ${f(Math.min(...ms))}, middle ${f(mid(ms))}, most ${f(Math.max(...ms))}; with a message ${of.filter((r) => r.messages.length).length}; with a rejection ${of.filter((r) => r.rejections.length).length}; permission changed ${of.filter((r) => r.permission.before.microphone !== r.permission.after.microphone || r.permission.before.camera !== r.permission.after.camera).length}`
  console.log(last)
  fs.appendFileSync(table, `${last}\n`)
}
