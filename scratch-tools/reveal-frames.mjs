// node out/work/p6s/reveal-frames.mjs <url> <name> [size=320x320] [frames after the mark=36] [ms a frame=17]
// Job 5 on the built page with the frames in this script's hand (the browser's begin frame control): a frame comes only
// when it is asked for and carries the time it is given, while timers keep the wall. So the reading root made by chance
// on a slow machine is made on purpose: up to the live mark every frame carries the time of the wall; from the mark on
// each frame carries a time 17 ms after the one before, however long the frame took to draw. The page's clock then runs
// behind the wall, as it does where frames come late, and the wait of reveal() (1500 ms of the wall) is over early in
// the fade (500 ms of the page's clock). Every frame from the mark on is kept as a picture of what was presented.
// Nothing of the app is wrapped.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { softwareRenderer } from '../../../tools/lib/browser.mjs'

const [, , url = 'http://localhost:4180/?quality=low', name = 'frames', size = '320x320', afterArg = '36', stepArg = '17'] = process.argv
const [width, height] = size.split('x').map(Number)
const after = Number(afterArg)
const step = Number(stepArg)
const here = path.dirname(new URL(import.meta.url).pathname)
const shots = path.join(here, `reveal-frames-${name}`)
fs.rmSync(shots, { recursive: true, force: true })
fs.mkdirSync(shots, { recursive: true })
const shell = path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell')
const soft = softwareRenderer()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'reveal-frames-'))
const context = await chromium.launchPersistentContext(profile, {
  executablePath: shell,
  headless: true,
  viewport: null,
  args: [
    ...soft.flags,
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--mute-audio',
    '--enable-begin-frame-control',
    '--run-all-compositor-stages-before-draw',
    '--disable-new-content-rendering-timeout',
    `--window-size=${width},${height}`,
  ],
  ...(soft.env ? { env: soft.env } : {}),
})
const out = []
const say = (s) => {
  out.push(s)
  console.log(s)
}
const lines = []
let page
try {
  const [first] = context.pages()
  const s0 = await context.newCDPSession(first)
  const coming = context.waitForEvent('page', { timeout: 20000 })
  await s0.send('Target.createTarget', { url: 'about:blank', enableBeginFrameControl: true, width, height })
  page = await coming
  page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await page.addInitScript(() => {
    const w = (window.__rv = { wall0: Date.now(), frames: [], events: [], count: 0, last: null })
    const canvas = () => document.getElementById('view')
    const look = (kind) => {
      const c = canvas()
      const fade = c && c.getAnimations ? c.getAnimations().map((a) => (typeof a.currentTime === 'number' ? Math.round(a.currentTime) : null)) : []
      return {
        kind,
        wall: Date.now() - w.wall0,
        clock: w.last === null ? null : Math.round(w.last * 10) / 10,
        frames: w.count,
        opacity: c ? Number(getComputedStyle(c).opacity) : null,
        stills: document.querySelectorAll('#first img').length,
        live: !!c && c.dataset.live !== undefined,
        own: c ? c.style.transition : null,
        fade,
      }
    }
    w.look = look
    const frame = (t) => {
      w.count++
      w.last = t
      if (w.frames.length < 6000) w.frames.push(look('frame'))
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    for (const type of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel'])
      document.addEventListener(type, (e) => e.target === canvas() && w.events.push({ ...look(type), property: e.propertyName }), true)
    let had = 0
    new MutationObserver(() => {
      const c = canvas()
      const n = document.querySelectorAll('#first img').length
      if (had > 0 && n === 0) w.events.push(look('the still left'))
      if (had === 0 && n > 0) w.events.push(look('the still came'))
      had = n
      if (c && c.dataset.live !== undefined && !w.marked) {
        w.marked = true
        w.events.push(look('the live mark'))
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-live'] })
  })
  const ticks = () => Number(process.hrtime.bigint() / 1000n) / 1000
  const frame = async (at, shot) => {
    const t0 = Date.now()
    const got = await cdp.send('HeadlessExperimental.beginFrame', { frameTimeTicks: at, interval: 1000 / 60, noDisplayUpdates: false, ...(shot ? { screenshot: { format: 'png' } } : {}) })
    return { ...got, took: Date.now() - t0 }
  }
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'commit' })
  const state = () => page.evaluate(() => window.__rv?.look?.('read') ?? null)
  let at = ticks()
  let pumped = 0
  let mark = null
  while (Date.now() - t0 < 300000) {
    at = Math.max(at + 1, ticks())
    await frame(at, false)
    pumped++
    mark = await page.evaluate(() => window.__rv?.events.find((e) => e.kind === 'the live mark') ?? null)
    if (mark) break
  }
  const info = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2')
    const d = c && c.getExtension('WEBGL_debug_renderer_info')
    return { renderer: c && d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown' }
  })
  say(`${name} · ${url} · ${width}x${height} · ${info.renderer} · frames by the script (begin frame control)`)
  const f4 = (v) => (v === null || v === undefined ? 'none' : v.toFixed(4))
  if (!mark) say(`NOT ok: the live mark did not come in 300 s (${pumped} frames asked)`)
  else {
    say(`the live mark: frame ${mark.frames} of the page, ${pumped} asked, wall ${mark.wall} ms, page clock ${mark.clock} ms, opacity ${f4(mark.opacity)}, still ${mark.stills} pictures`)
    const rows = []
    const wallAtMark = mark.wall
    for (let k = 1; k <= after; k++) {
      at += step
      const got = await frame(at, true)
      const s = await state()
      const file = `${String(k).padStart(2, '0')}.png`
      if (got.screenshotData) fs.writeFileSync(path.join(shots, file), Buffer.from(got.screenshotData, 'base64'))
      rows.push({ k, clockAfterMark: Math.round((s.clock - mark.clock) * 10) / 10, wallAfterMark: s.wall - wallAtMark, opacity: s.opacity, stills: s.stills, own: s.own, fade: s.fade, took: got.took, damage: got.hasDamage, picture: got.screenshotData ? file : null })
    }
    const rv = await page.evaluate(() => {
      const { look, ...rest } = window.__rv
      return rest
    })
    for (const e of rv.events) say(`  ${e.kind}${e.property ? ` (${e.property})` : ''} at wall ${e.wall} ms (${e.wall - wallAtMark} after the mark), page clock ${e.clock} ms (${e.clock === null ? 'none' : Math.round((e.clock - mark.clock) * 10) / 10} after the mark), frame ${e.frames}: opacity ${f4(e.opacity)}, still ${e.stills}${e.own ? `, own transition ${e.own}` : ''}${e.fade.length ? `, fade at ${e.fade.join()} ms` : ''}`)
    const seen = rv.frames.filter((f) => f.live)
    const bare = seen.filter((f) => f.stills === 0 && f.opacity < 1)
    for (const r of rows) say(`  frame ${String(r.k).padStart(2)} after the mark: page clock +${r.clockAfterMark} ms, wall +${r.wallAfterMark} ms, opacity ${f4(r.opacity)}, still ${r.stills}${r.own ? `, own transition ${r.own}` : ''}${r.fade.length ? `, fade at ${r.fade.join()} ms` : ''} · ${r.took} ms to draw · ${r.picture ?? 'no picture'}`)
    const left = rv.events.find((e) => e.kind === 'the still left')
    const ended = rv.events.find((e) => e.kind === 'transitionend')
    say(`frames of the page from the live mark on: ${seen.length}; with the still gone and the canvas short of full sight: ${bare.length}${bare.length ? `, over ${bare[bare.length - 1].wall - bare[0].wall} ms of the wall, opacity ${bare.map((f) => f.opacity.toFixed(3)).join(' ')}` : ''}`)
    say(`the still left ${left ? `${left.wall - wallAtMark} ms after the live mark by the wall, ${Math.round((left.clock - mark.clock) * 10) / 10} ms by the page's clock, ${ended && rv.events.indexOf(ended) < rv.events.indexOf(left) ? 'at the end of the fade (transitionend)' : 'when the wait was over (no transitionend before it)'}, the canvas at ${f4(left.opacity)}` : 'NEVER'}`)
    const ok = !!left && bare.length === 0 && left.opacity >= 1
    say(`${ok ? 'ok' : 'NOT ok'}: ${ok ? 'at no frame was the still gone and the canvas under full opacity' : 'the still was gone under a canvas short of full sight, or it did not leave'}`)
    fs.writeFileSync(path.join(here, `reveal-frames-${name}.json`), JSON.stringify({ url, size, info, mark, rows, rv }, null, 1))
  }
} catch (e) {
  say(`NOT ok: ${e?.stack ?? e}`)
}
say(`console ${lines.length} ${JSON.stringify(lines.slice(0, 5))}`)
fs.writeFileSync(path.join(here, `reveal-frames-${name}.txt`), out.join('\n') + '\n')
await context.close().catch(() => undefined)
fs.rmSync(profile, { recursive: true, force: true })
