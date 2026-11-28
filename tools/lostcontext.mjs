import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { ensureDir, launch, outWork } from './lib/browser.mjs'
import { loadConfig, parseArgs, rel, writeJson } from './lib/paths.mjs'
import { serve } from './lib/server.mjs'

/**
 * What the live page does when the browser takes its WebGL context away (src/app/lost.ts).
 *
 * The built page is served from this machine and opened in a browser. The tool takes the context with the browser's own
 * WEBGL_lose_context extension and reads what a visitor would meet: what stands on the screen, whether anything still
 * reaches the card, whether the page comes back by itself, and every line of the console, of any kind.
 *
 *   node tools/lostcontext.mjs [--dist dist] [--name NAME] [--cases restore,none,...] [--sizes hd,phone] [--local]
 *                              [--season winter] [--quality low|medium|plain] [--limit 300] [--ready 300]
 *     --cases   restore   the page whole and at rest, a loss, then the context given back
 *               none      a loss and no context given back
 *               second    a loss, the load that follows, and a second loss right after it
 *               shake     a loss while a shake is held: asked for while the season it goes to is in the making
 *               making    a loss in the first seconds, while the other seasons are in the making
 *               low, medium, plain   a loss at each quality (plain: the address names none)
 *               usual     no loss at all: the page until every season is made, its marks with their times, its picture
 *                         at rest and every line of its console; only when it is asked for, at --quality (low)
 *     --local   the installed Chrome with its graphics card, as a visitor has it; without it the pinned browser
 *     --limit   the seconds a page is given to come to a mark
 *     --ready   the seconds the case `restore` waits for every season to be made before it takes the context
 *
 * Files: out/work/context/<name>/: a picture before the loss, right after it, a moment later, and when the page is back
 * or stays as it is; a sheet of them for each case; lines.txt and result.json. It ends with 1 when a case fails.
 * Run it alone on the machine.
 */

const args = parseArgs(process.argv.slice(2))
const cfg = loadConfig()
const str = (k, d) => (args[k] && args[k] !== true ? String(args[k]) : d)
const dist = path.resolve(str('dist', rel('dist')))
const name = str('name', 'context')
const LOSSES = ['restore', 'none', 'second', 'shake', 'making', 'low', 'medium', 'plain']
const ALL = [...LOSSES, 'usual']
const cases = str('cases', LOSSES.join(',')).split(',')
const sizes = str('sizes', 'hd,phone').split(',')
const season = str('season', cfg.seasons[0])
const LIMIT = Number(str('limit', '300')) * 1000
const READY = Number(str('ready', '300')) * 1000
const local = args.local === true
const dir = ensureDir(outWork('context', name))
for (const c of cases) if (!ALL.includes(c)) throw new Error(`no case ${c}: ${ALL.join(', ')}`)

/** The page's own numbers (src/app/lost.ts), and how late a timer may be on a machine that draws without a card. */
const WAIT_MS = 4000
const LATE_MS = 2500
/** A held shake begins two beats in and lasts four seconds at most (config.shake.swapWindow, config.live.loadWaitSeconds). */
const HELD_MS = 2000
const NOTICE = 'This browser cannot draw the globe. A current Chrome, Safari, Firefox or Edge can.'
const after = (from) => cfg.seasons[(cfg.seasons.indexOf(from) + 1) % cfg.seasons.length]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DONE = Symbol('done')

const server = await serve({ dist })
const browser = await launch({ local })
const out = []
const say = (line) => {
  out.push(line)
  process.stdout.write(`${line}\n`)
}
const results = []

/** Counts every call that reaches the card from the moment the browser tells the page that its context is gone. */
function watchCard() {
  const w = (window.__card = { on: false, calls: 0, names: {}, before: null, isLost: WebGL2RenderingContext.prototype.isContextLost })
  try {
    w.before = sessionStorage.getItem('tool:calls')
    sessionStorage.removeItem('tool:calls')
  } catch {
    w.before = null
  }
  const proto = WebGL2RenderingContext.prototype
  for (const key of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, key)
    if (!d || typeof d.value !== 'function' || key === 'constructor') continue
    const real = d.value
    proto[key] = function (...a) {
      if (w.on) {
        w.calls++
        w.names[key] = (w.names[key] ?? 0) + 1
      }
      return real.apply(this, a)
    }
  }
  // From the loss on: how long the page stays, and the longest stretch in which its thread did not come to a timer.
  let beat = 0
  document.addEventListener(
    'webglcontextlost',
    () => {
      if (w.on) return
      w.on = true
      w.lostAt = beat = performance.now()
      w.stood = 0
      setInterval(() => {
        const now = performance.now()
        w.stood = Math.max(w.stood, now - beat)
        beat = now
      }, 50)
      // When the file of the still is whole over the soft picture.
      const sharp = () => {
        const stills = [...document.querySelectorAll('#first img')].filter((i) => !i.src.startsWith('data:'))
        if (stills.length > 0 && stills.every((i) => i.complete && i.naturalWidth > 0)) w.sharp = Math.round(performance.now() - w.lostAt)
        else requestAnimationFrame(sharp)
      }
      requestAnimationFrame(sharp)
    },
    true,
  )
  // The page's own marks, with the time each was first seen, in ms from the start of the load.
  const marks = (window.__marks = {})
  const seen = () => {
    const d = document.documentElement.dataset
    const now = Math.round(performance.now())
    if (d.firstPicture) marks.firstPicture ??= now
    if (d.made) marks[`made-${d.made}`] ??= now
    if (d.detail) marks[`detail-${d.detail}`] ??= now
    if (document.getElementById('ui')?.dataset.interface === 'shown') marks.controls ??= now
    if (marks.firstPicture && !window.firstStill) marks.handedOver ??= now
  }
  new MutationObserver(seen).observe(document, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-first-picture', 'data-made', 'data-detail', 'data-interface', 'data-live'] })
  window.__seen = seen
  window.addEventListener('pagehide', () => {
    try {
      if (w.on) sessionStorage.setItem('tool:calls', `${w.calls} ${Math.round(performance.now() - w.lostAt)} ${Math.round(Math.max(w.stood, performance.now() - beat))} ${w.sharp ?? -1} ${Math.round(w.left - w.took)} ${Math.round(w.lostAt - w.left)}`)
    } catch {
      // a page without storage keeps no count over a load
    }
  })
}

const read = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement
    const view = document.getElementById('view')
    const first = document.getElementById('first')
    const imgs = [...first.querySelectorAll('img')]
    const stills = imgs.filter((i) => !i.src.startsWith('data:'))
    const notice = document.querySelector('#ui [role="status"]')
    return {
      address: location.search,
      firstPicture: doc.dataset.firstPicture ?? '',
      made: doc.dataset.made ?? '',
      cannot: doc.dataset.cannot ?? '',
      canvasShown: getComputedStyle(view).opacity !== '0',
      stillFiles: [...new Set(stills.map((i) => (i.currentSrc || i.src).replace(/^.*\/first\//, '').replace(/\?.*$/, '')))],
      stillArrived: stills.length > 0 && stills.every((i) => i.complete && i.naturalWidth > 0),
      soft: imgs.length - stills.length,
      notice: notice ? notice.textContent : '',
      controls: document.getElementById('ui').dataset.interface ?? '',
      lost: window.__card.isLost.call(view.getContext('webgl2')),
      marks: (window.__seen(), { ...window.__marks }),
      calls: window.__card.calls,
      names: window.__card.names,
      callsBeforeLoad: window.__card.before === null ? null : window.__card.before.split(' ')[0],
      stayed: window.__card.before === null ? null : Number(window.__card.before.split(' ')[1]),
      stood: window.__card.before === null ? Math.round(window.__card.stood ?? 0) : Number(window.__card.before.split(' ')[2]),
      sharp: window.__card.before === null ? (window.__card.sharp ?? -1) : Number(window.__card.before.split(' ')[3]),
      taking: window.__card.before === null ? Math.round(window.__card.left - window.__card.took) : Number(window.__card.before.split(' ')[4]),
      told: window.__card.before === null ? Math.round(window.__card.lostAt - window.__card.left) : Number(window.__card.before.split(' ')[5]),
    }
  })

async function mark(page, test, limit = LIMIT) {
  try {
    await page.waitForFunction(test, null, { timeout: limit, polling: 100 })
    return true
  } catch {
    return false
  }
}

/** The page's first picture, the canvas in full sight over it with the still gone, and the controls in their place. */
async function whole(page) {
  const t0 = Date.now()
  const ok = await mark(page, () => document.documentElement.dataset.firstPicture === '1' && document.getElementById('view').dataset.live !== undefined && !window.firstStill && document.getElementById('ui').dataset.interface === 'shown')
  await sleep(1500)
  return { ok, seconds: (Date.now() - t0) / 1000 }
}

const lose = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const view = document.getElementById('view')
        const gl = view.getContext('webgl2')
        window.__take = gl.getExtension('WEBGL_lose_context')
        document.addEventListener('webglcontextlost', () => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))), { capture: true, once: true })
        window.__card.took = performance.now()
        window.__take.loseContext()
        window.__card.left = performance.now()
      }),
  )

const giveBack = (page) => page.evaluate(() => window.__take.restoreContext()).catch(() => undefined)

async function stats(file) {
  const { data, info } = await sharp(file).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true })
  let sum = 0
  let dark = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i]
    if (data[i] < 12) dark++
  }
  return { mean: sum / data.length, dark: dark / data.length, width: info.width, height: info.height }
}

async function run(id, size) {
  const fmt = cfg.formats[size]
  if (!fmt) throw new Error(`no size ${size}`)
  const phone = size !== 'hd'
  const context = await browser.newContext({ viewport: { width: fmt.width, height: fmt.height }, deviceScaleFactor: phone ? 3 : 1, hasTouch: phone, isMobile: phone })
  const page = await context.newPage()
  const lines = []
  let loads = 0
  page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
  page.on('framenavigated', (f) => f === page.mainFrame() && loads++)
  await page.addInitScript(watchCard)
  const tag = `${id}-${size}`
  const fails = []
  const notes = []
  const shots = []
  let extra = {}
  const need = (ok, what) => {
    if (!ok) fails.push(what)
    return ok
  }
  const shot = async (k, label) => {
    const file = path.join(dir, `${tag}-${k}.png`)
    await page.screenshot({ path: file })
    const s = await stats(file)
    shots.push({ file, label, ...s })
    return s
  }
  /** Waits for the page to load itself again; says how long it took, or null when it did not. */
  const loadsAgain = async (from, limit) => {
    const t0 = Date.now()
    while (loads === from && Date.now() - t0 < limit) await sleep(50)
    return loads === from ? null : Date.now() - t0
  }
  const named = id === 'usual' ? str('quality', 'low') : id
  const quality = named === 'medium' ? 'medium' : named === 'plain' ? null : 'low'
  const address = new URL(server.url)
  address.searchParams.set('season', season)
  if (quality) address.searchParams.set('quality', quality)

  try {
    await page.goto(address.href)
    const up = await whole(page)
    need(up.ok, `the page did not come whole in ${LIMIT / 1000} s`)
    if (id === 'restore') {
      const made = await mark(page, () => document.documentElement.dataset.made === 'ready', READY)
      notes.push(made ? 'every season was made before the loss' : `the seasons were not all made ${READY / 1000} s after the page was whole: lost while in the making`)
      await sleep(1000)
    }
    if (id === 'usual') {
      const made = await mark(page, () => document.documentElement.dataset.made === 'ready', READY)
      need(made, `the seasons were not all made ${READY / 1000} s after the page was whole`)
      await sleep(2000)
      // A picture at rest, and whether the page stands still: two pictures 1.5 s apart, equal in every pixel or not.
      const raw = async (k, label) => {
        const s = await shot(k, label)
        const pixels = await sharp(s.file).removeAlpha().raw().toBuffer()
        return { pixels, sha: crypto.createHash('sha256').update(pixels).digest('hex').slice(0, 16) }
      }
      const a = await raw('1-rest', 'at rest, every season made')
      await sleep(1500)
      const b = await raw('2-rest-later', '1.5 s later')
      let differ = 0
      for (let i = 0; i < a.pixels.length; i += 3) if (a.pixels[i] !== b.pixels[i] || a.pixels[i + 1] !== b.pixels[i + 1] || a.pixels[i + 2] !== b.pixels[i + 2]) differ++
      const now = await read(page)
      extra = { marks: now.marks, picture: a.sha, later: b.sha, differ, address: now.address }
      need(now.canvasShown && !now.cannot && now.stillFiles.length === 0 && now.controls === 'shown', 'the page is not whole at rest')
      notes.push(`marks in ms: ${Object.entries(now.marks).map(([k, v]) => `${k} ${v}`).join(', ')}; picture at rest ${a.sha}, 1.5 s later ${b.sha} (${differ} pixels differ)`)
      throw DONE
    }
    let wanted = season
    if (id === 'shake') {
      // A shake asked for while the season it goes to is in the making is held: the globe goes on shaking until that season is there.
      await page.locator('[data-control="shake"]').first().click()
      await sleep(HELD_MS)
      const held = await page.evaluate(() => document.querySelector('[data-control="shake"]').getAttribute('aria-disabled') === 'true' && document.documentElement.dataset.made === 'making')
      need(held, 'the shake was over, or every season made, before the loss')
      notes.push(`Shake pressed ${HELD_MS} ms before the loss: ${held ? 'the shake goes on and the seasons are in the making' : 'not held'}`)
      wanted = after(season)
    }
    const before = await shot('1-before', 'before the loss')
    const at = await read(page)
    notes.push(`at the loss: seasons ${at.made}, canvas ${at.canvasShown ? 'shown' : 'hidden'}, marks in ms ${Object.entries(at.marks).map(([k, v]) => `${k} ${v}`).join(', ')}`)
    if (id === 'making') need(at.made === 'making', `the seasons were ${at.made} at the loss, not in the making`)
    const from = loads
    const t0 = Date.now()
    await lose(page)
    const lost = await shot('2-lost', 'right after the loss')
    const then = await read(page).catch(() => null)
    // The page with the context gone: a whole picture, the still of the season, nothing asked of the card, and presses that do nothing.
    if (then) {
      need(!then.canvasShown, 'the canvas is still shown after the loss')
      need(then.stillFiles.length > 0 && then.stillFiles.every((f) => f.startsWith(`${wanted}-`)), `the still laid is ${then.stillFiles.join(', ') || 'none'}, wanted one of ${wanted}`)
      need(then.soft > 0 || then.stillArrived, 'no picture of the still was there in the frame after the loss')
      need(then.calls === 0, `${then.calls} calls reached the card after the loss (${Object.entries(then.names).slice(0, 6).map(([k, n]) => `${k} ${n}`).join(', ')})`)
    }
    need(lost.dark < before.dark + 0.1 && lost.mean > before.mean * 0.6, `the picture right after the loss is darker than a whole one (mean ${lost.mean.toFixed(1)} against ${before.mean.toFixed(1)}, dark share ${lost.dark.toFixed(3)} against ${before.dark.toFixed(3)})`)

    let again = null
    if (id === 'none') {
      again = await loadsAgain(from, WAIT_MS + LATE_MS + 12000)
      need(again !== null, 'with no context given back the page never loaded again')
      notes.push(`no context given back: the tool saw the load ${again === null ? 'never' : `${Date.now() - t0} ms after it took the context`}`)
    } else {
      await sleep(1200)
      const later = await shot('3-still', 'a moment later')
      const still = await read(page).catch(() => null)
      if (still) {
        need(still.stillArrived, 'the still had not arrived 1.2 s after the loss')
        need(still.calls === 0, `${still.calls} calls reached the card in the 1.2 s after the loss`)
      }
      need(later.mean > before.mean * 0.6, 'the picture a moment after the loss is darker than a whole one')
      // A press on the globe, on the Shake control and on the space bar while the context is gone.
      {
        await page.mouse.click(fmt.width / 2, fmt.height * 0.4)
        const box = await page.locator('[data-control="shake"]').first().boundingBox().catch(() => null)
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        await page.keyboard.press('Space')
        await sleep(300)
        const pressed = await read(page).catch(() => null)
        if (pressed) need(pressed.calls === 0 && !pressed.canvasShown, `after three presses ${pressed.calls} calls reached the card`)
      }
      need(loads === from, 'the page loaded again before the context was given back')
      await giveBack(page)
      again = await loadsAgain(from, 5000)
      need(again !== null, 'the page did not load again when the context was given back')
      notes.push(`context given back: loaded again ${again === null ? 'never' : `${again} ms later`}`)
    }

    if (again !== null) {
      const back = await whole(page)
      need(back.ok, `the page that was loaded again did not come whole in ${LIMIT / 1000} s`)
      const now = await read(page)
      await shot('4-back', 'the page loaded again')
      need(new URLSearchParams(now.address).get('season') === wanted, `it was loaded again at ${now.address}, wanted season ${wanted}`)
      need((quality ?? '') === (new URLSearchParams(now.address).get('quality') ?? ''), `the address lost its quality: ${now.address}`)
      need(now.canvasShown && !now.cannot && !now.lost, 'the page that was loaded again does not draw')
      need(now.callsBeforeLoad === '0', `${now.callsBeforeLoad ?? 'an unknown number of'} calls reached the card between the loss and the load`)
      // By the page's own clock: how long it stayed after the loss, and the longest its thread stood in that time.
      if (id === 'none') need(now.stayed !== null && now.stayed >= WAIT_MS - 50 && now.stayed <= WAIT_MS + LATE_MS, `with no context given back the page stayed ${now.stayed} ms after the loss, wanted ${WAIT_MS} ms`)
      notes.push(`by the page's clock: taking the context held the thread ${now.taking} ms, the browser told the page ${now.told} ms later, the page stayed ${now.stayed} ms from then, its thread stood ${now.stood} ms at most, the file of the still was whole ${now.sharp < 0 ? 'never' : `${now.sharp} ms after the page was told`}`)
      need(now.sharp >= 0, 'the file of the still was never whole between the loss and the load')
      need(loads === from + 1, `the page loaded ${loads - from} times`)
      notes.push(`back whole ${back.seconds.toFixed(1)} s after its load, at ${now.address}`)
      if (id === 'second') {
        const second = loads
        const t1 = Date.now()
        await lose(page)
        await shot('5-lost-again', 'right after the second loss')
        const none = await loadsAgain(second, WAIT_MS + LATE_MS + 3000)
        need(none === null, 'the page loaded again after a second loss')
        const stays = await read(page)
        await shot('6-stays', 'the state it stays in')
        need(stays.cannot === '1' && stays.notice === NOTICE, `the notice is "${stays.notice}"`)
        need(!stays.canvasShown && stays.stillFiles.length > 0 && stays.stillFiles.every((f) => f.startsWith(`${wanted}-`)) && stays.stillArrived, 'the page does not stay on its still')
        need(stays.calls === 0, `${stays.calls} calls reached the card after the second loss`)
        notes.push(`second loss ${((t1 - t0) / 1000).toFixed(1)} s after the first: no load in ${(WAIT_MS + LATE_MS + 3000) / 1000} s, notice "${stays.notice}"`)
      }
    } else {
      await sleep(3000)
      const stays = await read(page).catch(() => null)
      await shot('4-not-back', 'the page that did not come back')
      if (stays) notes.push(`not back: canvas ${stays.canvasShown ? 'shown' : 'hidden'}, ${stays.calls} calls reached the card since the loss`)
    }
  } catch (e) {
    if (e !== DONE) fails.push(`the tool stopped: ${String(e.message ?? e).split('\n')[0]}`)
  }
  need(lines.length === 0, `${lines.length} lines in the console`)
  await context.close()

  const tiles = []
  const high = 360
  for (const s of shots) {
    const w = Math.round((s.width / s.height) * high)
    tiles.push({ input: await sharp(s.file).resize(w, high).png().toBuffer(), w, label: s.label })
  }
  const sheet = path.join(dir, `${tag}-sheet.png`)
  if (tiles.length) {
    const width = tiles.reduce((a, t) => a + t.w + 8, 8)
    let left = 8
    const parts = []
    for (const t of tiles) {
      const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="22"><text x="0" y="16" font-family="sans-serif" font-size="14" fill="#e8e8e8">${t.label}</text></svg>`)
      parts.push({ input: t.input, left, top: 30 }, { input: text, left, top: 4 })
      left += t.w + 8
    }
    await sharp({ create: { width, height: high + 38, channels: 3, background: '#202226' } }).composite(parts).png().toFile(sheet)
  }
  const result = { case: id, size, ok: fails.length === 0, messages: lines.length, lines, fails, notes, ...extra, pictures: shots.map((s) => ({ file: path.relative(rel(), s.file), label: s.label, mean: Number(s.mean.toFixed(2)), dark: Number(s.dark.toFixed(4)) })), sheet: path.relative(rel(), sheet) }
  results.push(result)
  say(`${fails.length ? 'FAIL' : 'PASS'} ${tag}: console ${lines.length}; ${notes.join('; ')}`)
  for (const f of fails) say(`      not as wanted: ${f}`)
  for (const l of [...new Set(lines)].slice(0, 12)) say(`      console (${lines.filter((x) => x === l).length} times): ${l.slice(0, 220)}`)
}

const version = browser.version()
say(`lost context, ${name}: ${path.relative(rel(), dist) || dist} (${fs.existsSync(path.join(dist, 'build.json')) ? fs.readFileSync(path.join(dist, 'build.json'), 'utf8').trim() : 'no build.json'}), ${local ? 'the installed Chrome' : 'the pinned browser'} ${version}, season ${season}`)
for (const size of sizes) for (const id of cases) await run(id, size)
await browser.close()
await server.close()
const failed = results.filter((r) => !r.ok)
say(`${results.length - failed.length} of ${results.length} cases as wanted; console lines in all: ${results.reduce((a, r) => a + r.messages, 0)}`)
fs.writeFileSync(path.join(dir, 'lines.txt'), `${out.join('\n')}\n`)
writeJson(path.join(dir, 'result.json'), { name, dist, browser: version, local, season, results })
process.exit(failed.length ? 1 : 0)
