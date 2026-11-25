import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { launch, watchPage } from './lib/browser.mjs'
import { parseArgs, rel, loadConfig } from './lib/paths.mjs'

/**
 * The visitor's pass through the app (kit/08-BUILD-ORDER.md, Phase 5, step 2).
 *
 * Opens the built, served app as a visitor does and goes through everything a visitor can do, in one layout, pressing the
 * real controls with pointer, touch and key events. After every action it saves a screenshot and a line of facts read from the
 * page (the lit season mark, the controls' attributes, where they sit, what was fetched).
 *
 *   node tools/visit.mjs --url http://localhost:4173/ --layout hd|phone|tablet
 *     --quality low     the level of quality asked for by parameter (low: most frames on a machine without a GPU). `--quality none`
 *                       opens the app with no parameter, as a visitor gets it.
 *     --only 1,2,7      runs only these steps of the walk (1 first paint, 2 Shake control, 3 space bar, 4 stir, 5 look around,
 *                       6 season marks, 7 sound control, 8 keyboard and menu, 9 reduced motion, 10 season links, 11 look of the
 *                       controls). Without it, all of them.
 *     --name NAME       the folder under out/work/visit/ (the layout's name).
 *     --wait SECONDS    the longest wait for one thing to happen (300).
 *
 * Files: out/work/visit/<name>/NN-<action>.png and facts.jsonl (one line an action), result.json (the lines and the findings).
 * The tool judges nothing by eye. Lines whose `ok` is false are what it found wrong; the pictures are for the reader.
 * It waits on the app's own state, never on a control coming to rest: without a GPU a frame takes seconds.
 */

const args = parseArgs(process.argv.slice(2))
const cfg = loadConfig()
const str = (k, d) => (args[k] && args[k] !== true ? String(args[k]) : d)
const base = str('url', 'http://localhost:4173/')
const layout = str('layout', 'hd')
const quality = str('quality', 'low')
const only = args.only && args.only !== true ? String(args.only).split(',').map(Number) : null
const WAIT = Number(str('wait', '300')) * 1000
const dir = rel('out', 'work', 'visit', str('name', layout))
const seasons = cfg.seasons
const fmt = cfg.formats[layout]
if (!fmt) throw new Error(`no layout ${layout}: hd, phone or tablet`)
const touch = layout !== 'hd'
const ratio = layout === 'phone' ? 3 : layout === 'tablet' ? 2 : 1
const want = (n) => !only || only.includes(n)

fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(dir, { recursive: true })
const lines = []
let shot = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const urlOf = (extra = {}) => {
  const u = new URL(base)
  if (quality !== 'none') u.searchParams.set('quality', quality)
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v)
  return u.href
}

const browser = await launch()
const context = await browser.newContext({
  viewport: { width: fmt.width, height: fmt.height },
  deviceScaleFactor: ratio,
  hasTouch: touch,
  isMobile: touch,
})
const page = await context.newPage()
const errors = watchPage(page)
const cdp = await context.newCDPSession(page)
const requests = []
page.on('request', (r) => requests.push({ url: r.url(), at: Date.now() }))

// A frame counter and a log of what changes on the controls, set up before the app starts.
await page.addInitScript(() => {
  window.__frames = 0
  window.__log = []
  window.__firstAt = null
  const tick = () => {
    window.__frames++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      if (el === document.documentElement && m.attributeName === 'data-first-picture' && window.__firstAt === null) window.__firstAt = performance.now()
      const what = el.getAttribute('data-season') ?? el.getAttribute('data-control') ?? (el.id || el.tagName.toLowerCase())
      if (window.__log.length < 4000) window.__log.push({ t: Math.round(performance.now()), el: what, attr: m.attributeName, value: el.getAttribute(m.attributeName ?? '') })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-pressed', 'aria-disabled', 'data-target', 'data-dim', 'data-interface', 'data-first-picture', 'data-audio', 'hidden', 'data-reduced'] })
})

/** What the page says about itself. */
const read = () =>
  page.evaluate(() => {
    const doc = document.documentElement
    const ui = document.getElementById('ui')
    const q = (s) => ui?.querySelector(s) ?? null
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null
    }
    const marks = [...(ui?.querySelectorAll('[data-season]') ?? [])]
    const shake = q('[data-control="shake"]')
    const sound = q('[data-control="sound"]')
    const menu = q('[data-menu]')
    const a = document.activeElement
    return {
      firstPicture: doc.dataset.firstPicture === '1',
      audio: doc.dataset.audio ?? '',
      detail: doc.dataset.detail ?? '',
      shown: ui?.dataset.interface === 'shown',
      lit: marks.filter((m) => m.getAttribute('aria-pressed') === 'true').map((m) => m.dataset.season),
      target: marks.filter((m) => m.hasAttribute('data-target')).map((m) => m.dataset.season),
      busy: shake?.getAttribute('aria-disabled') === 'true',
      pulse: /pulse/.test(shake?.className ?? ''),
      sound: sound ? { shown: !!box(sound), on: sound.getAttribute('aria-pressed') === 'true' } : null,
      dim: ui?.firstElementChild?.hasAttribute('data-dim') ?? false,
      reduced: ui?.firstElementChild?.hasAttribute('data-reduced') ?? false,
      menu: menu ? !menu.hidden : false,
      focus: a && a !== document.body ? (a.getAttribute('data-season') ?? a.getAttribute('data-control') ?? a.tagName.toLowerCase()) : '',
      frames: window.__frames,
      boxes: { shake: box(shake), sound: box(sound), ...Object.fromEntries(marks.map((m) => [m.dataset.season, box(m)])) },
      canvas: box(document.getElementById('view')),
    }
  })

async function until(what, test, timeout = WAIT) {
  const t0 = Date.now()
  for (;;) {
    const s = await read()
    if (test(s)) return { ok: true, seconds: (Date.now() - t0) / 1000, state: s }
    if (Date.now() - t0 > timeout) return { ok: false, seconds: (Date.now() - t0) / 1000, state: s, timedOut: what }
    await sleep(400)
  }
}

const frames = async (n, timeout = WAIT) => {
  const from = (await read()).frames
  return until(`${n} frames`, (s) => s.frames >= from + n, timeout)
}

const brief = (s) => ({ lit: s.lit.join(','), target: s.target.join(','), busy: s.busy, sound: s.sound ? (s.sound.shown ? (s.sound.on ? 'on' : 'off') : 'hidden') : 'absent', audio: s.audio, dim: s.dim, menu: s.menu, focus: s.focus })

async function note(step, action, facts, ok = true) {
  const file = `${String(++shot).padStart(2, '0')}-${action}.png`
  const png = await page.screenshot({ path: path.join(dir, file), scale: 'css', timeout: 120000 }).catch((e) => (errors.push(`screenshot ${file}: ${e.message}`), null))
  const line = { step, action, ok, file, layout, ...facts }
  lines.push(line)
  fs.appendFileSync(path.join(dir, 'facts.jsonl'), JSON.stringify(line) + '\n')
  console.log(`${ok ? 'ok ' : 'NOT'} ${step} ${action} ${JSON.stringify(facts)}`)
  return png
}

// Pointer and touch through the browser's own input path, with the times of the events set by hand: a drag keeps its speed
// however long the page takes to draw a frame.
const centre = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2]
async function press(x, y) {
  if (touch) await page.touchscreen.tap(x, y)
  else {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
  }
}
async function pressControl(name) {
  const s = await read()
  const b = s.boxes[name]
  if (!b) return false
  await press(...centre(b))
  return true
}
/** A drag along `points` ([x, y, seconds from the start]); `hold` leaves the pointer down, `goOn` carries on a drag that was held. Returns a function that lets go. */
async function drag(points, hold = false, goOn = false) {
  const t0 = Date.now() / 1000 + 0.05
  const send = (type, [x, y, t]) =>
    touch
      ? cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }], timestamp: t0 + t })
      : cdp.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !down ? 'none' : 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, timestamp: t0 + t, pointerType: 'mouse' })
  let down = false
  const [first, ...rest] = points
  if (!touch && !goOn) await send('mouseMoved', [first[0], first[1], first[2] - 0.02])
  down = true
  const all = [send(touch ? (goOn ? 'touchMove' : 'touchStart') : goOn ? 'mouseMoved' : 'mousePressed', first)]
  for (const p of rest) all.push(send(touch ? 'touchMove' : 'mouseMoved', p))
  const lastPoint = points[points.length - 1]
  const up = () => send(touch ? 'touchEnd' : 'mouseReleased', [lastPoint[0], lastPoint[1], lastPoint[2] + 0.02])
  if (!hold) all.push(up())
  await Promise.all(all)
  return up
}
const line = (x0, y0, x1, y1, seconds, n = 12) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, (seconds * i) / n])

/** How far two screenshots are apart inside the middle of the picture, where the globe is: mean difference of a channel, 0 to 255. */
async function apart(a, b) {
  if (!a || !b) return null
  const cut = { left: Math.round(fmt.width * 0.2), top: Math.round(fmt.height * 0.12), width: Math.round(fmt.width * 0.6), height: Math.round(fmt.height * 0.55) }
  const raw = (p) => sharp(p).extract(cut).removeAlpha().raw().toBuffer()
  const [x, y] = await Promise.all([raw(a), raw(b)])
  let sum = 0
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i])
  return Math.round((sum / x.length) * 100) / 100
}
const grab = () => page.screenshot({ scale: 'css', timeout: 120000 }).catch(() => null)

async function open(extra = {}) {
  requests.length = 0
  const t0 = Date.now()
  await page.goto(urlOf(extra), { waitUntil: 'domcontentloaded' })
  const first = await until('the first complete picture', (s) => s.firstPicture)
  const firstAt = Date.now()
  const shown = await until('the controls', (s) => s.shown, 60000)
  await sleep(1500)
  await frames(2)
  return { first, shown, firstAt, seconds: (firstAt - t0) / 1000, shownSeconds: (Date.now() - t0) / 1000 }
}

/** One change of season: press, see it start, see it land. */
async function change(step, action, act, to, { again = null } = {}) {
  const before = await read()
  const mark = await page.evaluate(() => window.__log.length)
  await act()
  const started = await until('the shake to start', (s) => s.busy, 60000)
  let second = null
  if (again && started.ok) {
    await frames(2)
    await again()
    second = 'pressed again while busy'
    await note(step, `${action}-during`, { ...brief(await read()), second })
  }
  const landed = await until('the season to arrive', (s) => !s.busy && s.lit[0] === to)
  const after = await frames(3)
  const log = await page.evaluate((from) => window.__log.slice(from), mark)
  const lits = log.filter((l) => l.attr === 'aria-pressed' && l.value === 'true' && seasons.includes(l.el)).map((l) => l.el)
  const starts = log.filter((l) => l.el === 'shake' && l.attr === 'aria-disabled' && l.value === 'true').length
  const ok = started.ok && landed.ok && after.state.lit.join() === to && !after.state.busy && lits.filter((l) => l !== before.lit[0]).join() === to
  await note(step, action, { from: before.lit.join(), to, started: started.ok, startSeconds: started.seconds, landed: landed.ok, seconds: Math.round(landed.seconds), litInTurn: lits.join('>'), heldCount: starts, second, ...brief(after.state) }, ok)
  return ok
}
/** The controls as the eye meets them: row by row, left to right. */
const inOrder = (boxes) => {
  const row = (b) => Math.round((b[1] + b[3] / 2) / 24)
  return boxes.slice().sort((a, b) => row(a[1]) - row(b[1]) || a[1][0] - b[1][0]).map(([k]) => k)
}
const nextOf = (s) => seasons[(seasons.indexOf(s) + 1) % seasons.length]

// ---------------------------------------------------------------------------------------------------------------------------

let opened = await open()
let s = opened.shown.state

if (want(1)) {
  const firstAt = await page.evaluate(() => window.__firstAt)
  if (firstAt === null) errors.push('the tool did not see the first picture being marked')
  const early = await page.evaluate((at) => performance.getEntriesByType('resource').filter((e) => e.startTime <= at).map((e) => e.name), firstAt ?? 0)
  const soundEarly = early.filter((u) => /\/audio\/|\.(mp3|ogg|m4a|wav|opus)(\?|$)/.test(u))
  const seen = await page.evaluate(() => {
    const out = []
    const hiddenBy = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const c = getComputedStyle(e)
        if (e.hidden || c.display === 'none' || c.visibility === 'hidden' || (c.clipPath !== 'none' && e.getBoundingClientRect().width <= 1)) return true
      }
      return false
    }
    for (const el of document.querySelectorAll('body *')) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.closest('svg')?.parentElement?.closest('button') || hiddenBy(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width <= 1 || r.height <= 1) continue
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim()
      const tag = el.tagName.toLowerCase()
      if (text || tag === 'button' || tag === 'a' || tag === 'input' || tag === 'h1' || tag === 'h2' || tag === 'p') out.push({ tag, control: el.getAttribute('data-season') ?? el.getAttribute('data-control') ?? '', text })
    }
    return { out, title: document.title }
  })
  const controls = seen.out.filter((e) => e.tag === 'button').map((e) => e.control)
  const texts = seen.out.filter((e) => e.text).map((e) => e.text)
  const expected = ['shake', ...seasons, ...(s.sound?.shown ? ['sound'] : [])]
  const ok = opened.first.ok && opened.shown.ok && s.lit.join() === cfg.defaultSeason && !s.busy && controls.slice().sort().join() === expected.slice().sort().join() && texts.join('|') === 'Shake' && soundEarly.length === 0 && firstAt !== null
  await note(1, 'first-paint', { firstPictureSeconds: opened.seconds, controlsSeconds: opened.shownSeconds, lit: s.lit.join(), busy: s.busy, onScreen: controls, words: texts, title: seen.title, sound: brief(s).sound, audioState: s.audio, fetchedBeforeFirstPicture: early.length, soundFetchedBeforeFirstPicture: soundEarly, quality, pageErrors: errors.slice() }, ok)
}

if (want(7)) {
  s = await read()
  await note(7, 'sound-at-start', { control: brief(s).sound, audioState: s.audio, soundRequests: requests.filter((r) => /\/audio\//.test(r.url)).map((r) => r.url.split('/').pop()) }, true)
}

if (want(11)) {
  // The hint: once, softly, after live.hintAfterSeconds with nothing pressed. Never a shake by itself.
  await sleep((cfg.live.hintAfterSeconds + 4) * 1000)
  await frames(2)
  const classes = (log) => log.filter((l) => l.el === 'shake' && l.attr === 'class').map((l) => ({ t: l.t, on: /pulse/.test(l.value ?? '') }))
  const log = await page.evaluate(() => window.__log)
  const shownAt = log.find((l) => l.attr === 'data-interface' && l.value === 'shown')?.t ?? null
  const first = classes(log).find((c) => c.on)
  const after = shownAt !== null && first ? (first.t - shownAt) / 1000 : null
  const now = await read()
  await note(11, 'hint-pulse', { pulsed: !!first, secondsAfterControls: after, asked: cfg.live.hintAfterSeconds, ...brief(now) }, !!first && after !== null && Math.abs(after - cfg.live.hintAfterSeconds) < 2.5)
  await sleep(12000)
  await frames(2)
  const later = await read()
  const seen = classes(await page.evaluate(() => window.__log))
  const n = seen.filter((c, i) => c.on && !(seen[i - 1]?.on ?? false)).length
  await note(11, 'hint-after', { pulses: n, stillPulsing: later.pulse, shookByItself: later.busy || later.lit.join() !== s.lit.join(), ...brief(later) }, n === 1 && !later.pulse && !later.busy && later.lit.join() === s.lit.join())
}

if (want(11)) {
  // The look of the controls, read from the page.
  const look = await page.evaluate(() => {
    const ui = document.getElementById('ui')
    const els = [...ui.querySelectorAll('*')].filter((e) => !e.closest('[data-menu]'))
    const fonts = new Set()
    const pure = []
    const colours = {}
    const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number)
    for (const el of els) {
      const c = getComputedStyle(el)
      if (el.textContent.trim() && !el.closest('svg')) fonts.add(c.fontFamily)
      for (const k of ['color', 'backgroundColor', 'outlineColor', 'borderTopColor', 'stroke', 'fill']) {
        const v = c[k]
        if (!v || v === 'none') continue
        const [r, g, b, a = 1] = parse(v)
        if (a > 0 && ((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255)) && !(k === 'outlineColor' && c.outlineStyle === 'none') && !(k === 'borderTopColor' && c.borderTopWidth === '0px') && !(k === 'fill' && !el.closest('svg')) && !(k === 'stroke' && !el.closest('svg')))
          pure.push(`${el.tagName.toLowerCase()}.${el.getAttribute('data-control') ?? el.getAttribute('data-season') ?? ''} ${k} ${v}`)
      }
    }
    for (const b of ui.querySelectorAll('button[data-control]')) {
      const c = getComputedStyle(b)
      const svg = b.querySelector('svg')
      colours[b.getAttribute('data-season') ?? b.getAttribute('data-control')] = { color: c.color, background: c.backgroundColor, shadow: c.boxShadow.slice(0, 90), opacity: c.opacity, font: `${c.fontWeight} ${c.fontSize}`, strokeWidth: svg ? getComputedStyle(svg.querySelector('[stroke-width], path, circle') ?? svg).strokeWidth : '' }
    }
    return { fonts: [...fonts], pure, colours, loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family) }
  })
  await note(11, 'look', look, look.fonts.length === 1 && look.pure.length === 0)

  // Where the controls sit.
  s = await read()
  const boxes = Object.entries(s.boxes).filter(([, b]) => b)
  const out = boxes.filter(([, b]) => b[0] < 0 || b[1] < 0 || b[0] + b[2] > fmt.width || b[1] + b[3] > fmt.height).map(([k]) => k)
  const hit = []
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i][1], boxes[j][1]]
      if (a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]) hit.push(`${boxes[i][0]}/${boxes[j][0]}`)
    }
  const top = Math.min(...boxes.map(([, b]) => b[1]))
  const bottom = Math.max(...boxes.map(([, b]) => b[1] + b[3]))
  const small = boxes.filter(([, b]) => touch && (b[2] < 44 || b[3] < 44)).map(([k]) => k)
  const order = inOrder(boxes)
  await note(11, 'places', { boxes: s.boxes, canvas: s.canvas, outside: out, overlapping: hit, controlsTopShare: top / fmt.height, gapUnder: fmt.height - bottom, under44: small, readingOrder: order }, out.length === 0 && hit.length === 0 && small.length === 0 && top / fmt.height > 0.7)

  // Dimming: after the pointer has moved once and then been still, the controls dim; they return when it moves.
  if (!touch) await page.mouse.move(fmt.width * 0.3, fmt.height * 0.3)
  else await press(fmt.width * 0.5, fmt.height * 0.06)
  if (!touch) await page.mouse.move(fmt.width * 0.31, fmt.height * 0.31)
  const dimmed = await until('the controls to dim', (x) => x.dim, 40000)
  const op = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-control="shake"]')).opacity)
  const settle = async (test) => {
    for (let i = 0; i < 40 && !test(Number(await op())); i++) await sleep(500)
    return op()
  }
  const low = await settle((v) => v < 0.6)
  await note(11, 'dimmed', { dimmed: dimmed.ok, afterSeconds: dimmed.seconds, opacity: low }, dimmed.ok && Number(low) < 0.6)
  if (!touch) await page.mouse.move(fmt.width * 0.4, fmt.height * 0.4)
  else await press(fmt.width * 0.5, fmt.height * 0.06)
  const back = await until('the controls to return', (x) => !x.dim, 20000)
  const high = await settle((v) => v > 0.9)
  await note(11, 'returned', { returned: back.ok, opacity: high }, back.ok && Number(high) > 0.9)
}

// The stir and the look around come before any shake: both are read from the picture, which must be at rest.
if (want(4)) {
  s = await read()
  const [w, h] = [fmt.width, fmt.height]
  const ref = Math.min(w, h)
  const cy = s.canvas[1] + h * 0.4
  await frames(2)
  const a = await grab()
  await frames(2)
  const b = await grab()
  await drag(line(w / 2 - ref * 0.22, cy, w / 2 + ref * 0.22, cy, 0.14, 10))
  await frames(3)
  const c = await grab()
  const rest = await apart(a, b)
  const stirred = await apart(b, c)
  const after = await read()
  await frames(4)
  const d = await grab()
  const back = await apart(a, d)
  await note(4, 'stir', { restApart: rest, afterStirApart: stirred, laterApart: back, seasonBefore: s.lit.join(), ...brief(after) }, after.lit.join() === s.lit.join() && !after.busy && stirred !== null && stirred > Math.max(rest * 1.5, rest + 0.3))
  await frames(12)
}

if (want(5)) {
  s = await read()
  const [w, h] = [fmt.width, fmt.height]
  const ref = Math.min(w, h)
  const cy = s.canvas[1] + h * 0.4
  const a = await grab()
  await frames(2)
  const a2 = await grab()
  const rest = await apart(a, a2)
  // Slow, to the right, well past the limit: 0.6 of the short side, then 0.3 more. The picture must stop turning at the limit.
  let up = await drag(line(w / 2 - ref * 0.3, cy, w / 2 + ref * 0.3, cy, 2.4, 24), true)
  await frames(3)
  const held = await grab()
  await note(5, 'look-held', { restApart: rest, turnedApart: await apart(a, held), ...brief(await read()) }, (await apart(a, held)) > rest + 1)
  await up()
  const turned = await apart(a, held)
  await frames(9)
  const back = await grab()
  const returned = await apart(a, back)
  await note(5, 'look-returned', { restApart: rest, turnedApart: turned, returnedApart: returned, ...brief(await read()) }, returned < Math.max(rest * 2, rest + 0.6))
  // The limits: two drags of different lengths, both past the limit, must end on the same picture.
  const lim = {}
  for (const [name, dx, dy] of [['yaw', 1, 0], ['pitch-up', 0, 1], ['pitch-down', 0, -1]]) {
    const span = dx ? 0.3 : 0.2
    const at = (k) => [w / 2 + dx * ref * k, cy + dy * ref * k]
    up = await drag(line(...at(-span), ...at(span), 2.4, 24), true)
    await frames(3)
    const p1 = await grab()
    // The same drag goes on, further the same way: the pointer is still down.
    await drag(line(...at(span), ...at(span + 0.12), 0.8, 8).slice(1), true, true)
    await frames(3)
    const p2 = await grab()
    if (p2) fs.writeFileSync(path.join(dir, `${String(++shot).padStart(2, '0')}-limit-${name}.png`), p2)
    await up()
    await frames(9)
    lim[name] = { turnedApart: await apart(a, p1), furtherApart: await apart(p1, p2) }
  }
  const ok = Object.values(lim).every((l) => l.turnedApart > rest + 1 && l.furtherApart < Math.max(rest * 2, rest + 0.8))
  await note(5, 'look-limits', { restApart: rest, ...lim, yawDeg: cfg.live.orbitYawDeg, pitchDeg: [cfg.live.orbitPitchMinDeg, cfg.live.orbitPitchMaxDeg], ...brief(await read()) }, ok)
}

if (want(2)) {
  s = await read()
  await change(2, 'shake-control', () => pressControl('shake'), nextOf(s.lit[0]), { again: () => pressControl('shake') })
  s = await read()
  if (want(7)) await note(7, 'sound-after-first-press', { control: brief(s).sound, audioState: s.audio, soundRequests: requests.filter((r) => /\/audio\//.test(r.url)).map((r) => r.url.split('/').pop()) }, !s.sound?.shown || s.audio === 'started')
}

if (want(3)) {
  s = await read()
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await change(3, 'space-bar', () => page.keyboard.press('Space'), nextOf(s.lit[0]), { again: () => page.keyboard.press('Space') })
}

if (want(6)) {
  s = await read()
  const here = s.lit[0]
  // The current mark: nothing starts.
  await pressControl(here)
  await frames(4)
  const same = await read()
  await note(6, `mark-current-${here}`, { ...brief(same) }, !same.busy && same.lit.join() === here)
  // The others, in turn, and back: every season is reached by its own mark. Two by pointer, one by Enter, one by Space.
  const order = [1, 2, 3, 0].map((k) => seasons[(seasons.indexOf(here) + k + 1) % seasons.length])
  const focusMark = (id) => page.evaluate((x) => document.querySelector(`#ui [data-season="${x}"]`).focus({ focusVisible: true }), id)
  const ways = [
    ['pointer', (id) => pressControl(id)],
    ['enter', async (id) => (await focusMark(id), page.keyboard.press('Enter'))],
    ['pointer', (id) => pressControl(id)],
    ['space', async (id) => (await focusMark(id), page.keyboard.press('Space'))],
  ]
  for (let i = 0; i < order.length; i++) await change(6, `mark-${order[i]}-by-${ways[i][0]}`, () => ways[i][1](order[i]), order[i])
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
}

if (want(7)) {
  s = await read()
  if (s.sound?.shown) {
    const was = s.sound.on
    await pressControl('sound')
    const off = await until('the sound control to change', (x) => x.sound.on !== was, 30000)
    await note(7, 'sound-pressed', { was: was ? 'on' : 'off', landedSeconds: off.seconds, ...brief(off.state) }, off.ok)
    await pressControl('sound')
    const on = await until('the sound control to change back', (x) => x.sound.on === was, 30000)
    // The same control through Playwright's own click, which first waits for the control to hold still for two frames.
    const t0 = Date.now()
    const clicked = await page.locator('#ui [data-control="sound"]').click({ timeout: 120000 }).then(() => '', (e) => e.message.split('\n')[0])
    const clickSeconds = (Date.now() - t0) / 1000
    const flipped = await until('the click to land', (x) => x.sound.on !== was, 30000)
    const covered = await page.evaluate(() => {
      const el = document.querySelector('#ui [data-control="sound"]')
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return { topmost: top === el || el.contains(top), pointerEvents: getComputedStyle(el).pointerEvents, disabled: el.disabled }
    })
    await note(7, 'sound-locator-click', { clickSeconds, error: clicked, changed: flipped.ok, ...covered }, flipped.ok && covered.topmost)
    await pressControl('sound')
    await until('the sound control to change back', (x) => x.sound.on === was, 30000)
    await note(7, 'sound-pressed-again', { ...brief(on.state), soundRequests: requests.filter((r) => /\/audio\//.test(r.url)).map((r) => r.url.split('/').pop()) }, on.ok && on.state.audio === 'started')
  } else await note(7, 'sound-control-absent', { ...brief(s), soundRequests: requests.filter((r) => /\/audio\//.test(r.url)).map((r) => r.url.split('/').pop()) }, true)
}

if (want(8)) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  const stops = []
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab')
    const f = await page.evaluate(() => {
      const a = document.activeElement
      if (!a || a === document.body) return null
      const c = getComputedStyle(a)
      const name = (a.getAttribute('aria-label') ?? a.textContent ?? '').replace(/\s+/g, ' ').trim()
      return { control: a.getAttribute('data-season') ?? a.getAttribute('data-control') ?? a.tagName.toLowerCase(), name, tag: a.tagName.toLowerCase(), ring: a.matches(':focus-visible') && c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0 ? `${c.outlineWidth} ${c.outlineColor}` : '', inMenu: !!a.closest('[data-menu]') }
    })
    if (!f) break
    if (stops.some((x) => x.control === f.control)) break
    stops.push(f)
    if (stops.length === 2) await note(8, 'focus-on-control', { ...f })
  }
  s = await read()
  const expected = ['shake', ...seasons, ...(s.sound?.shown ? ['sound'] : [])]
  const reading = inOrder(Object.entries(s.boxes).filter(([, b]) => b))
  const names = stops.every((x) => x.name.length > 0 && x.tag === 'button')
  const rings = stops.every((x) => x.ring !== '')
  // The order asked for is the one tools/ui-preview/check.mjs holds the interface to: the Shake control first, then the marks, then
  // sound. Whether that is also the order on screen is written down, not judged.
  await note(8, 'tab-order', { stops: stops.map((x) => `${x.control}="${x.name}"`), rings: stops.map((x) => x.ring), onScreenOrder: reading, sameAsOnScreen: stops.map((x) => x.control).join() === reading.join() }, stops.map((x) => x.control).join() === expected.join() && names && rings)

  // Enter and Space on the Shake control and on the sound control.
  const focus = (sel) => page.evaluate((x) => document.querySelector(x).focus({ focusVisible: true }), sel)
  s = await read()
  await focus('#ui [data-control="shake"]')
  await change(8, 'enter-on-shake', () => page.keyboard.press('Enter'), nextOf(s.lit[0]))
  s = await read()
  await focus('#ui [data-control="shake"]')
  await change(8, 'space-on-shake', () => page.keyboard.press('Space'), nextOf(s.lit[0]))
  s = await read()
  if (s.sound?.shown) {
    const was = s.sound.on
    await focus('#ui [data-control="sound"]')
    await page.keyboard.press('Enter')
    const one = await until('sound by Enter', (x) => x.sound.on !== was, 30000)
    await page.keyboard.press('Space')
    const two = await until('sound by Space', (x) => x.sound.on === was, 30000)
    await note(8, 'keys-on-sound', { enter: one.ok, space: two.ok, ...brief(two.state) }, one.ok && two.ok)
  }
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())

  // The owner's menu.
  await page.keyboard.press('m')
  const openMenu = await until('the menu', (x) => x.menu, 20000)
  const menu = await page.evaluate(() => {
    const m = document.querySelector('#ui [data-menu]')
    const r = m.getBoundingClientRect()
    return {
      rows: [...m.querySelectorAll('[data-row]')].map((row) => `${row.querySelector('span')?.textContent}: ${[...row.querySelectorAll('button')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' ')}`),
      tabbable: [...m.querySelectorAll('button, a, input, select, [tabindex]')].filter((b) => b.tabIndex >= 0).length,
      box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    }
  })
  await page.keyboard.press('Tab')
  const inMenu = await page.evaluate(() => !!document.activeElement?.closest('[data-menu]'))
  const has = (w) => menu.rows.some((r) => r.toLowerCase().startsWith(w))
  await note(8, 'menu-open', { opened: openMenu.ok, ...menu, tabEntersMenu: inMenu }, openMenu.ok && menu.tabbable === 0 && !inMenu && menu.inside && ['quality', 'season', 'state', 'view', 'play'].every(has) && /film-a/.test(menu.rows.join()) && /film-b/.test(menu.rows.join()))
  await page.keyboard.press('m')
  const closed = await until('the menu to close', (x) => !x.menu, 20000)
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await note(8, 'menu-closed', { closed: closed.ok }, closed.ok)
}

if (want(9)) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const set = await until('reduced motion to be seen', (x) => x.reduced, 30000)
  s = set.state
  const to = nextOf(s.lit[0])
  const a = await grab()
  const f0 = s.frames
  const mark = await page.evaluate(() => window.__log.length)
  await pressControl('shake')
  const started = await until('the change to start', (x) => x.busy, 60000)
  await frames(3)
  const mid = await grab()
  await note(9, 'reduced-during', { ...brief(await read()), apartFromBefore: await apart(a, mid) })
  const landed = await until('the season to arrive', (x) => !x.busy && x.lit[0] === to)
  const took = landed.state.frames - f0
  const rock = await page.evaluate(() => getComputedStyle(document.querySelector('#ui [data-control="shake"] svg *') ?? document.body).animationName)
  const log = await page.evaluate((from) => window.__log.slice(from), mark)
  await note(9, 'reduced-after', { reducedSeen: set.ok, started: started.ok, landed: landed.ok, framesTaken: took, seconds: Math.round(landed.seconds), controlAnimation: rock, pulses: log.filter((l) => /pulse/.test(l.value ?? '')).length, ...brief(landed.state) }, set.ok && started.ok && landed.ok)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
}

if (want(10)) {
  for (const id of seasons) {
    opened = await open({ season: id })
    const x = opened.shown.state
    await note(10, `link-${id}`, { link: urlOf({ season: id }), firstPictureSeconds: opened.seconds, lit: x.lit.join(), busy: x.busy, shown: x.shown }, opened.first.ok && opened.shown.ok && x.lit.join() === id && !x.busy)
  }
}

const bad = lines.filter((l) => !l.ok)
fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ url: base, layout, size: [fmt.width, fmt.height], ratio, touch, quality, lines, notOk: bad.map((l) => `${l.step} ${l.action}`), pageErrors: errors }, null, 1))
await browser.close()
console.log(`visit ${layout}: ${lines.length} lines, ${bad.length} not ok${bad.length ? ': ' + bad.map((l) => l.action).join(', ') : ''}${errors.length ? ` · ${errors.length} page errors` : ''} · ${dir}`)
