import { launch } from './lib/browser.mjs'
import { parseArgs, rel, loadConfig, writeJson } from './lib/paths.mjs'

/**
 * How long the page's own thread stands still after the controls come.
 *
 * At rest the app is live, so a stretch in which its thread does nothing but one long piece of script is a picture that
 * has stopped and a press that waits. A timer of 16 ms, set before the app starts, is the heartbeat: every gap of more
 * than `--gap` ms between two beats is such a stretch. No profiler runs and nothing of the app is wrapped.
 *
 *   node tools/standstill.mjs [--url http://localhost:4173/] [--layout 320x320|hd|phone|tablet|side] [--touch] [--ratio N]
 *                             [--quality low|none] [--seconds 30] [--press 1000] [--shakes N] [--gap 250] [--name NAME]
 *                             [--wait 300]
 *     --layout    a format of the config, `side` (the phone held sideways) or a size. Without a GPU a small window (the
 *                 default) leaves the renderer little to do, so what is left is the page's own script.
 *     --seconds   how long after the controls came the page is listened to (30).
 *     --press MS  the space bar is pressed that long after the controls came, without waiting for the page: the line says
 *                 when the key reached the page, when the Shake control went busy and when the next frame came.
 *     --shakes N  the space bar is pressed once the other seasons are ready and again 3 s after each landing, N times
 *                 in all; the listening ends 3 s after the last landing and `--seconds` is not used. A line for each
 *                 shake says where it landed, how long the control was busy, its frames and the stretches in it. The
 *                 first shake into a season draws it for the first time; a shake into a season seen before does not.
 *                 Ready is `data-made` where the page sets it (the seasons built and in the GPU's hands), and
 *                 `data-detail` where it does not.
 *     --gap MS    the shortest gap that counts as a stretch (250).
 *
 * Files: out/work/visit/<name>.json (standstill-<layout> unless named). The tool judges nothing; it prints what it read.
 * Run it alone on the machine: a second browser takes the processor the page is being timed on.
 * A stretch is the page's thread kept from its next beat, by its own script or by a call that waits for the renderer
 * (a program's first use, at a change of season). Without a GPU the second kind is long, so a stretch that begins as a
 * season changes says little about a visitor's machine; a profile tells the two kinds apart.
 */

const args = parseArgs(process.argv.slice(2))
const cfg = loadConfig()
const str = (k, d) => (args[k] && args[k] !== true ? String(args[k]) : d)
const base = str('url', 'http://localhost:4173/')
const layout = str('layout', '320x320')
const quality = str('quality', 'low')
const seconds = Number(str('seconds', '30'))
const pressAt = args.press && args.press !== true ? Number(args.press) : null
const shakes = args.shakes && args.shakes !== true ? Number(args.shakes) : 0
if (pressAt !== null && shakes) throw new Error('--press or --shakes, not both')
const REST = 3000
const gap = Number(str('gap', '250'))
const WAIT = Number(str('wait', '300')) * 1000
const name = str('name', `standstill-${layout}`)
const sized = /^(\d+)x(\d+)$/.exec(layout)
const fmt = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : layout === 'side' ? { width: cfg.formats.phone.height, height: cfg.formats.phone.width } : cfg.formats[layout]
if (!fmt) throw new Error(`no layout ${layout}: hd, phone, tablet, side or a size such as 320x320`)
const touch = sized ? args.touch === true : layout !== 'hd'
const ratio = Number(str('ratio', '')) || (layout === 'phone' || layout === 'side' ? 3 : layout === 'tablet' ? 2 : 1)
const address = new URL(base)
if (quality !== 'none') address.searchParams.set('quality', quality)

const browser = await launch()
const context = await browser.newContext({ viewport: { width: fmt.width, height: fmt.height }, deviceScaleFactor: ratio, hasTouch: touch, isMobile: touch })
const page = await context.newPage()
const consoleLines = []
page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))
await page.addInitScript((least) => {
  const w = (window.__standstill = { gaps: [], frames: [], shown: [], ready: [], made: [], busy: [], keys: [], hint: [], season: [] })
  let last = performance.now()
  setInterval(() => {
    const t = performance.now()
    if (t - last > least) w.gaps.push({ from: Math.round(last), ms: Math.round(t - last) })
    last = t
  }, 16)
  const frame = () => {
    w.frames.push(Math.round(performance.now()))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  window.addEventListener('keydown', (e) => w.keys.push({ sent: Math.round(e.timeStamp), reached: Math.round(performance.now()) }), true)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      const t = Math.round(performance.now())
      const value = el.getAttribute(m.attributeName ?? '')
      const control = el.matches('[data-control="shake"]')
      if (m.attributeName === 'data-interface') w.shown.push({ at: t, value })
      else if (m.attributeName === 'data-detail') w.ready.push({ at: t, value })
      else if (m.attributeName === 'data-made') w.made.push({ at: t, value })
      else if (m.attributeName === 'aria-disabled' && control) w.busy.push({ at: t, busy: value === 'true' })
      else if (m.attributeName === 'aria-pressed' && value === 'true') w.season.push({ at: t, season: el.getAttribute('data-season') })
      else if (m.attributeName === 'class' && control) w.hint.push({ at: t, on: /pulse/.test(el.className) })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['class', 'data-interface', 'data-detail', 'data-made', 'aria-disabled', 'aria-pressed'] })
}, gap)
const cdp = await context.newCDPSession(page)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(address.href, { waitUntil: 'commit' })
const began = Date.now()
let shownWall = null
while (Date.now() - began < WAIT) {
  const shown = await page.evaluate(() => window.__standstill.shown.find((s) => s.value === 'shown')?.at ?? null).catch(() => null)
  if (shown !== null) {
    shownWall = Date.now() - ((await page.evaluate(() => performance.now())) - shown)
    break
  }
  await sleep(100)
}
if (shownWall === null) {
  await browser.close()
  throw new Error(`the controls did not come in ${WAIT / 1000} s`)
}
// Sent and not waited for: the browser takes the key while the page's thread may be in the middle of a stretch.
const space = async () => {
  const key = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 }
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ' ', ...key }).catch(() => undefined)
  await sleep(60)
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key }).catch(() => undefined)
}
// The control is told not busy once as it comes, so a landing is busy that ends, not every time it is told not busy.
const landingsOf = (busy) => busy.filter((b, i) => !b.busy && i > 0 && busy[i - 1].busy)
if (pressAt !== null) {
  const wait = shownWall + pressAt - Date.now()
  if (wait > 0) await sleep(wait)
  await space()
}
if (shakes) {
  let sent = 0
  let rest = null
  while (Date.now() - began < WAIT) {
    const now = await page.evaluate(() => {
      const w = window.__standstill
      return { ready: (w.made.length ? w.made : w.ready).some((r) => r.value === 'ready'), busy: w.busy }
    })
    const busy = now.busy.length > 0 && now.busy[now.busy.length - 1].busy
    if (now.ready && !busy && landingsOf(now.busy).length === sent) {
      rest ??= Date.now()
      if (Date.now() - rest >= REST) {
        if (sent === shakes) break
        await space()
        sent++
        rest = null
      }
    } else rest = null
    await sleep(200)
  }
} else while (Date.now() - shownWall < seconds * 1000) await sleep(250)
const listened = shakes ? Math.round((Date.now() - shownWall) / 1000) : seconds
const got = await page.evaluate(() => window.__standstill)
await browser.close()

const shownAt = got.shown.find((s) => s.value === 'shown').at
const since = (t) => t - shownAt
const after = got.gaps.filter((g) => g.from + g.ms > shownAt).map((g) => ({ from: since(g.from), ms: g.ms }))
const frames = got.frames.filter((f) => f >= shownAt)
const hintOn = got.hint.find((h) => h.on && h.at >= shownAt)
const ready = got.ready.find((r) => r.value === 'ready')
const made = got.made.find((r) => r.value === 'ready')
const out = {
  url: address.href,
  layout,
  size: [fmt.width, fmt.height],
  ratio,
  touch,
  seconds: listened,
  gapMs: gap,
  controlsAtMs: shownAt,
  stoodStill: { times: after.length, totalMs: after.reduce((s, g) => s + g.ms, 0), longestMs: after.reduce((m, g) => Math.max(m, g.ms), 0), stretches: after },
  beforeTheControls: got.gaps.filter((g) => g.from + g.ms <= shownAt),
  framesAfterTheControls: frames.length,
  otherSeasonsReadyAfterMs: ready ? since(ready.at) : null,
  inTheGpusHandsAfterMs: got.made.length ? (made ? since(made.at) : null) : undefined,
  hintAfterMs: hintOn ? since(hintOn.at) : null,
  hintAskedAfterMs: cfg.live.hintAfterSeconds * 1000,
  busy: got.busy.map((b) => ({ at: since(b.at), busy: b.busy })),
  season: got.season.map((s) => ({ at: since(s.at), season: s.season })),
  press: null,
  shakes: null,
  console: consoleLines,
}
const key = got.keys[0]
if (pressAt !== null && key) {
  const went = got.busy.find((b) => b.busy && b.at >= key.sent)
  const next = went ? frames.find((f) => f > went.at) : undefined
  const landed = went ? got.busy.find((b) => !b.busy && b.at > went.at) : undefined
  out.press = {
    askedAfterMs: pressAt,
    sentAfterMs: since(key.sent),
    reachedThePageAfterMs: key.reached - key.sent,
    controlBusyAfterMs: went ? went.at - key.sent : null,
    nextFrameAfterMs: next ? next - key.sent : null,
    landedAfterMs: landed ? landed.at - key.sent : null,
  }
} else if (pressAt !== null) out.press = { askedAfterMs: pressAt, sentAfterMs: null }
if (shakes) {
  const landings = landingsOf(got.busy)
  out.shakes = got.busy
    .filter((b) => b.busy)
    .map((went) => {
      const landed = landings.find((b) => b.at > went.at)
      const to = landed ? landed.at : got.frames[got.frames.length - 1]
      const within = got.frames.filter((f) => f >= went.at && f <= to)
      const key = got.keys.filter((x) => x.sent <= went.at).pop()
      return {
        pressedAfterMs: key ? since(key.sent) : null,
        controlBusyAfterMs: key ? went.at - key.sent : null,
        landedIn: landed ? (got.season.filter((x) => x.at <= landed.at + 250).pop()?.season ?? null) : null,
        busyMs: landed ? landed.at - went.at : null,
        frames: within.length,
        widestGapBetweenFramesMs: within.reduce((m, f, i) => (i ? Math.max(m, f - within[i - 1]) : m), 0),
        stoodStill: got.gaps.filter((g) => g.from + g.ms > went.at && g.from < to).map((g) => ({ from: g.from - went.at, ms: g.ms })),
      }
    })
}
writeJson(rel('out', 'work', 'visit', `${name}.json`), out)

const list = (gaps) => gaps.map((g) => `${g.ms} ms from ${g.from}`).join(' · ') || 'none'
console.log(`${name} · ${fmt.width} x ${fmt.height} at ${ratio} · the controls came at ${shownAt} ms · ${frames.length} frames in the ${listened} s after them`)
console.log(`after the controls the page's thread stood still ${out.stoodStill.times} times, ${out.stoodStill.totalMs} ms in all, the longest ${out.stoodStill.longestMs} ms: ${list(after)}`)
console.log(`before the controls: ${list(out.beforeTheControls)}`)
const when = (v, after) => (v == null ? 'not in this time' : `${v} ms ${after}`)
console.log(`the other seasons were ready ${when(out.otherSeasonsReadyAfterMs, 'after the controls')} · the hint came ${when(out.hintAfterMs, 'after them')} (asked ${out.hintAskedAfterMs})`)
if (out.inTheGpusHandsAfterMs !== undefined) console.log(`the other seasons were in the GPU's hands ${when(out.inTheGpusHandsAfterMs, 'after the controls')}`)
if (out.press?.sentAfterMs != null) {
  const p = out.press
  console.log(`the press: sent ${p.sentAfterMs} ms after the controls · reached the page ${p.reachedThePageAfterMs} ms later · the control went busy ${when(p.controlBusyAfterMs, 'after it')} · the next frame came ${when(p.nextFrameAfterMs, 'after it')} · landed ${when(p.landedAfterMs, 'after it')}`)
} else if (pressAt !== null) console.log('the press: the key did not reach the page in this time')
if (out.shakes) {
  out.shakes.forEach((k, i) => {
    const end = k.busyMs === null ? 'did not land in this time' : `landed in ${k.landedIn} · the control was busy ${k.busyMs} ms`
    console.log(`shake ${i + 1} of ${shakes}: ${end} · ${k.frames} frames, the widest gap between two ${k.widestGapBetweenFramesMs} ms · stood still, from the control going busy: ${list(k.stoodStill)}`)
  })
  if (out.shakes.length < shakes) console.log(`${shakes - out.shakes.length} of the ${shakes} shakes were not begun in this time`)
}
console.log(`console: ${consoleLines.length} lines${consoleLines.length ? ': ' + consoleLines.slice(0, 5).join(' | ') : ''}`)
