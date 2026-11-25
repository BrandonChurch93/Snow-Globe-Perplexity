import fs from 'node:fs'
import { createServer } from 'vite'
import { launch, ensureDir } from '../lib/browser.mjs'
import { loadConfig, parseArgs, rel, writeJson } from '../lib/paths.mjs'
import { engineHash, hashList, listFiles } from '../lib/hashes.mjs'

const config = loadConfig()
const args = parseArgs(process.argv.slice(2))
const seasons = config.seasons
const levels = Object.keys(config.live.quality)
const barMs = (60 / config.film.defaultBpm) * config.film.beatsPerBar * 1000
const hintMs = config.live.hintAfterSeconds * 1000
const outDir = rel('out/work/ui-preview')
ensureDir(outDir)

const server = await createServer({ root: rel('.'), server: { port: Number(args.port ?? 5198), host: '127.0.0.1', strictPort: false }, logLevel: 'warn' })
await server.listen()
const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await launch()
const results = []
const notes = {}

const sel = {
  shake: '[data-control="shake"]',
  season: (id) => `[data-control="season"][data-season="${id}"]`,
  sound: '[data-control="sound"]',
  menu: '[data-menu]',
}

async function open(query = {}, { reducedMotion = 'no-preference', width = 1280, height = 720, wait = true, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, hasTouch: touch, isMobile: touch })
  await context.addInitScript(() => {
    const marks = { shown: null, pulses: [] }
    Object.assign(window, { marks })
    new MutationObserver(() => {
      if (marks.shown === null && document.getElementById('ui')?.dataset.interface === 'shown') marks.shown = performance.now()
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-interface'] })
    document.addEventListener(
      'animationstart',
      (e) => {
        if (e.pseudoElement === '::after' && e.target instanceof Element && e.target.matches('[data-control="shake"]')) marks.pulses.push(performance.now())
      },
      true,
    )
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const q = new URLSearchParams(Object.entries({ season: seasons[0], ...query }).map(([k, v]) => [k, String(v)]))
  await page.goto(`${origin}/tools/ui-preview/?${q}`)
  if (wait) {
    await page.waitForSelector('#ui[data-interface="shown"]')
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
  }
  const calls = () => page.evaluate(() => window.preview.bridge.calls.filter((c) => c !== 'activity'))
  const clear = () => page.evaluate(() => void (window.preview.bridge.calls.length = 0))
  const state = () => page.evaluate(() => window.preview.bridge.state())
  const attr = (s, name) => page.evaluate(([s, name]) => document.querySelector(s)?.getAttribute(name) ?? null, [s, name])
  const seen = (s) => page.evaluate((s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'), s)
  const pulses = () => page.evaluate(() => window.marks.pulses.map((at) => Math.round(at - window.marks.shown)))
  const dimmed = () => page.evaluate(() => document.querySelector('#ui > div').hasAttribute('data-dim'))
  const idle = async () => {
    await page.waitForFunction(() => !window.preview.bridge.state().busy)
    await page.waitForTimeout(80)
  }
  return { page, context, errors, calls, clear, state, attr, seen, pulses, dimmed, idle, close: () => context.close() }
}

async function check(name, fn) {
  const t0 = Date.now()
  let problem = ''
  try {
    const said = await fn()
    if (typeof said === 'string' && said) problem = said
  } catch (e) {
    problem = String(e?.message ?? e).split('\n')[0]
  }
  results.push({ name, ok: !problem, problem, seconds: Math.round((Date.now() - t0) / 100) / 10 })
  console.log(`${problem ? 'FAIL' : 'ok  '}  ${name}${problem ? `: ${problem}` : ''}`)
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const want = (got, expected, what) => (same(got, expected) ? '' : `${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`)
const first = (...problems) => problems.find(Boolean) ?? ''

async function watch(t, ms) {
  await t.page.waitForTimeout(ms)
  return t.pulses()
}

try {
  await check('required attributes are present, once each', async () => {
    const t = await open()
    const counts = await t.page.evaluate((ids) => ({
      shake: document.querySelectorAll('[data-control="shake"]').length,
      seasons: ids.map((id) => document.querySelectorAll(`[data-control="season"][data-season="${id}"]`).length),
      allSeasons: document.querySelectorAll('[data-control="season"]').length,
      sound: document.querySelectorAll('[data-control="sound"]').length,
      menu: document.querySelectorAll('[data-menu]').length,
      controls: document.querySelectorAll('[data-control]').length,
    }), seasons)
    const errors = t.errors.slice()
    await t.close()
    return first(want(counts, { shake: 1, seasons: seasons.map(() => 1), allSeasons: seasons.length, sound: 1, menu: 1, controls: seasons.length + 2 }, 'counts'), want(errors, [], 'page errors'))
  })

  await check('names come through hidden text, and the only words on screen are the Shake word', async () => {
    const t = await open()
    const facts = await t.page.evaluate(() => {
      const ui = document.getElementById('ui')
      const words = []
      const walker = document.createTreeWalker(ui, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        const text = (node.textContent ?? '').trim()
        const box = node.parentElement.getBoundingClientRect()
        if (text && box.width > 2 && box.height > 2 && node.parentElement.getClientRects().length) words.push(text)
      }
      const name = (e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim()
      return {
        words,
        names: [...ui.querySelectorAll('[data-control]')].map(name),
        group: ui.querySelector('[role="group"]')?.getAttribute('aria-label') ?? '',
        titles: ui.querySelectorAll('[title]').length,
        marks: [...ui.querySelectorAll('[data-control="season"] svg')].every((s) => s.getAttribute('aria-hidden') === 'true'),
        banned: /[\u2014!]/.test(ui.textContent ?? ''),
      }
    })
    await t.close()
    const title = (id) => id.charAt(0).toUpperCase() + id.slice(1)
    return first(
      want(facts.words, ['Shake'], 'words on screen'),
      want(facts.names, [...seasons.map(title), 'Shake the globe', 'Sound'], 'names'),
      want(facts.group, 'Season', 'group name'),
      want(facts.titles, 0, 'title attributes'),
      want(facts.marks, true, 'glyphs hidden from assistive technology'),
      want(facts.banned, false, 'a banned character in the copy'),
    )
  })

  await check('Tab reaches each mark, Shake and sound, as they stand on screen, and never the menu', async () => {
    const t = await open()
    const order = []
    for (let i = 0; i < seasons.length + 3; i++) {
      await t.page.keyboard.press('Tab')
      order.push(await t.page.evaluate(() => {
        const a = document.activeElement
        return a?.dataset?.control ? `${a.dataset.control}${a.dataset.season ? `:${a.dataset.season}` : ''}` : a?.closest?.('[data-menu]') ? 'menu' : 'out'
      }))
    }
    const ring = await t.page.evaluate(() => {
      const out = []
      for (const e of document.querySelectorAll('[data-control]')) {
        e.focus()
        out.push(e.matches(':focus-visible') ? parseFloat(getComputedStyle(e).outlineWidth) : -1)
      }
      return out
    })
    await t.page.keyboard.press('m')
    const menuTabs = await t.page.evaluate(() => [...document.querySelectorAll('[data-menu] button')].filter((b) => b.tabIndex !== -1).length)
    await t.close()
    return first(want(order, [...seasons.map((s) => `season:${s}`), 'shake', 'sound', 'out'], 'tab order'), want(ring, ring.map(() => 2), 'focus ring width in px'), want(menuTabs, 0, 'menu options in the tab order'))
  })

  await check('Space shakes once, shows busy, and lands in the next season', async () => {
    const t = await open()
    await t.page.keyboard.press('Space')
    await t.page.keyboard.press('Space')
    await t.page.keyboard.press('Enter')
    const during = { calls: await t.calls(), busy: (await t.state()).busy, shake: await t.attr(sel.shake, 'aria-disabled'), marks: await t.page.evaluate(() => [...document.querySelectorAll('[data-control="season"]')].every((b) => b.getAttribute('aria-disabled') === 'true')), target: await t.page.evaluate(() => document.querySelector('[data-control="season"][data-target]')?.dataset.season ?? '') }
    await t.page.click(sel.shake, { force: true })
    await t.page.click(sel.season(seasons[2]), { force: true })
    const still = await t.calls()
    await t.page.waitForTimeout(barMs + 300)
    const after = { season: (await t.state()).season, pressed: await t.attr(sel.season(seasons[1]), 'aria-pressed'), was: await t.attr(sel.season(seasons[0]), 'aria-pressed'), shake: await t.attr(sel.shake, 'aria-disabled'), said: await t.page.evaluate(() => document.querySelector('#ui [role="status"]')?.textContent ?? '') }
    await t.close()
    return first(
      want(during, { calls: ['shake'], busy: true, shake: 'true', marks: true, target: seasons[1] }, 'while busy'),
      want(still, ['shake'], 'calls after pressing again while busy'),
      want(after, { season: seasons[1], pressed: 'true', was: 'false', shake: 'false', said: seasons[1].charAt(0).toUpperCase() + seasons[1].slice(1) }, 'after the bar'),
    )
  })

  await check('Enter shakes, a click shakes, a double click shakes once', async () => {
    const t = await open()
    await t.page.keyboard.press('Enter')
    const a = await t.calls()
    await t.idle()
    await t.clear()
    await t.page.dblclick(sel.shake)
    const b = await t.calls()
    await t.idle()
    await t.clear()
    await t.page.focus(sel.shake)
    await t.page.keyboard.press('Enter')
    const c = await t.calls()
    await t.idle()
    await t.clear()
    await t.page.focus(sel.shake)
    await t.page.keyboard.press('Space')
    const d = await t.calls()
    await t.close()
    return first(want(a, ['shake'], 'Enter'), want(b, ['shake'], 'double click'), want(c, ['shake'], 'Enter with focus on Shake'), want(d, ['shake'], 'Space with focus on Shake'))
  })

  await check('arrow keys step the season marks both ways and wrap', async () => {
    const t = await open()
    await t.page.keyboard.press('ArrowRight')
    const a = await t.calls()
    await t.idle()
    await t.clear()
    await t.page.keyboard.press('ArrowLeft')
    const b = await t.calls()
    await t.idle()
    await t.clear()
    await t.page.keyboard.press('ArrowLeft')
    const c = await t.calls()
    await t.idle()
    await t.clear()
    await t.page.focus(sel.season(seasons[seasons.length - 1]))
    await t.page.keyboard.press('ArrowDown')
    const d = await t.calls()
    const focus = await t.page.evaluate(() => document.activeElement?.dataset?.season ?? '')
    await t.close()
    return first(want(a, [`goTo:${seasons[1]}`], 'right'), want(b, [`goTo:${seasons[0]}`], 'left'), want(c, [`goTo:${seasons[seasons.length - 1]}`], 'left again wraps'), want(d, [`goTo:${seasons[0]}`], 'down wraps'), want(focus, seasons[0], 'focus follows the step'))
  })

  await check('a click on a mark goes to that season, a click on the lit one does nothing', async () => {
    const t = await open()
    await t.page.click(sel.season(seasons[0]))
    const a = await t.calls()
    await t.page.click(sel.season(seasons[3 % seasons.length]))
    const b = await t.calls()
    await t.idle()
    const pressed = await t.page.evaluate(() => [...document.querySelectorAll('[data-control="season"][aria-pressed="true"]')].map((b) => b.dataset.season))
    await t.close()
    return first(want(a, [], 'lit mark'), want(b, [`goTo:${seasons[3 % seasons.length]}`], 'other mark'), want(pressed, [seasons[3 % seasons.length]], 'lit after landing'))
  })

  await check('S and the sound control toggle sound and show its state', async () => {
    const t = await open()
    const before = await t.attr(sel.sound, 'aria-pressed')
    await t.page.keyboard.press('s')
    const on = await t.attr(sel.sound, 'aria-pressed')
    await t.page.keyboard.press('Shift+S')
    const off = await t.attr(sel.sound, 'aria-pressed')
    await t.page.click(sel.sound)
    const again = await t.attr(sel.sound, 'aria-pressed')
    const calls = await t.calls()
    const glyph = await t.page.evaluate(() => {
      const parts = [...document.querySelectorAll('[data-control="sound"] svg g, [data-control="sound"] svg path')].filter((e) => e.getAttribute('class'))
      return parts.map((e) => getComputedStyle(e).opacity)
    })
    await t.close()
    return first(want([before, on, off, again], ['false', 'true', 'false', 'true'], 'aria-pressed'), want(calls, ['setSound:true', 'setSound:false', 'setSound:true'], 'calls'), glyph.includes('0') && glyph.includes('1') ? '' : `glyph parts ${JSON.stringify(glyph)}`)
  })

  await check('the sound control is hidden when sound is not available', async () => {
    const t = await open({ nosound: 1 })
    const seen = await t.seen(sel.sound)
    await t.page.keyboard.press('s')
    const calls = await t.calls()
    await t.close()
    return first(want(seen, false, 'sound control on screen'), want(calls, [], 'calls'))
  })

  await check('M opens the owner menu, its rows act through the bridge, Escape closes it', async () => {
    const t = await open()
    const closed = await t.seen(sel.menu)
    await t.page.keyboard.press('m')
    const opened = await t.seen(sel.menu)
    const rows = await t.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-menu] [data-row]')].map((r) => [r.dataset.row, [...r.querySelectorAll('button')].map((b) => b.dataset.value)])))
    await t.page.click('[data-menu] [data-row="quality"] [data-value="low"]')
    await t.page.click('[data-menu] [data-row="quality"] [data-value="auto"]')
    await t.page.click(`[data-menu] [data-row="season"] [data-value="${seasons[2]}"]`)
    await t.page.click('[data-menu] [data-row="state"] [data-value="settled"]')
    await t.page.click('[data-menu] [data-row="view"] [data-value="depth"]')
    await t.page.click('[data-menu] [data-row="view"] [data-value="none"]')
    const calls = await t.calls()
    const pressed = await t.page.evaluate(() => [...document.querySelectorAll('[data-menu] button[aria-pressed="true"]')].map((b) => `${b.closest('[data-row]').dataset.row}:${b.dataset.value}`))
    await t.page.keyboard.press('Escape')
    const escaped = await t.seen(sel.menu)
    await t.page.keyboard.press('m')
    await t.page.keyboard.press('m')
    const toggled = await t.seen(sel.menu)
    await t.page.keyboard.press('m')
    await t.page.click('[data-menu] [data-row="play"] [data-value="loop"]')
    const playing = { calls: (await t.calls()).slice(-1), bar: await t.seen(sel.shake), shown: await t.attr('#ui', 'data-interface') }
    await t.close()
    const views = ['none', 'ids', 'standins', 'albedo', 'normals', 'depth', 'texels', 'cover', 'flow', 'lightgrid', 'refraction', 'change']
    return first(
      want([closed, opened, escaped, toggled], [false, true, false, false], 'closed, open, after Escape, after M twice'),
      want(rows, { quality: ['auto', ...levels], season: seasons, state: ['landed', 'rest', 'settled'], view: views, play: ['live', 'film-b', 'film-a', 'loop'] }, 'rows'),
      want(calls, ['setQuality:low', 'setQuality:auto', `setSeason:${seasons[2]}`, 'setState:settled', 'setDiagnostic:depth', 'setDiagnostic:none'], 'calls'),
      want(pressed, ['quality:auto', `season:${seasons[2]}`, 'state:settled', 'view:none', 'play:live'], 'pressed options'),
      want(playing, { calls: ['play:loop'], bar: false, shown: null }, 'while a film plays the controls are gone'),
    )
  })

  await check('nothing is shown before the app is ready, then the controls arrive', async () => {
    const t = await open({ unready: 1, readyAfter: 1.2 }, { wait: false })
    await t.page.waitForTimeout(500)
    const before = { shown: await t.attr('#ui', 'data-interface'), any: await t.seen('#ui [data-control]'), spin: await t.page.evaluate(() => document.getAnimations().length) }
    await t.page.keyboard.press('Space')
    const calls = await t.calls()
    await t.page.waitForSelector('#ui[data-interface="shown"]')
    const after = await t.seen(sel.shake)
    await t.close()
    return first(want(before, { shown: null, any: false, spin: 0 }, 'before ready'), want(calls, [], 'Space before ready'), want(after, true, 'after ready'))
  })

  await check('setVisible hides everything and brings it back', async () => {
    const t = await open()
    await t.page.evaluate(() => window.preview.handle.setVisible(false))
    const hidden = { seen: await t.seen(sel.shake), shown: await t.attr('#ui', 'data-interface') }
    await t.page.keyboard.press('Space')
    const calls = await t.calls()
    await t.page.evaluate(() => window.preview.handle.setVisible(true))
    const back = { seen: await t.seen(sel.shake), shown: await t.attr('#ui', 'data-interface') }
    await t.close()
    return first(want(hidden, { seen: false, shown: null }, 'hidden'), want(calls, [], 'Space while hidden'), want(back, { seen: true, shown: 'shown' }, 'back'))
  })

  await check('pointer and key input report activity', async () => {
    const t = await open()
    const all = () => t.page.evaluate(() => window.preview.bridge.calls.filter((c) => c === 'activity').length)
    const zero = await all()
    await t.page.mouse.move(300, 300)
    const moved = await all()
    await t.page.mouse.down()
    await t.page.mouse.up()
    const pressed = await all()
    await t.page.keyboard.press('x')
    const keyed = await all()
    await t.close()
    return zero === 0 && moved > zero && pressed > moved && keyed > pressed ? '' : `activity counts ${JSON.stringify([zero, moved, pressed, keyed])}`
  })

  await check('at every size the controls stay in the frame and clear of each other, with Shake centred; only an upright phone stacks them', async () => {
    const sizes = [...['hd', 'phone', 'tablet'].map((id) => ({ id, ...config.formats[id] })), { id: 'phone on its side', width: 667, height: 375 }, { id: 'small phone on its side', width: 568, height: 320 }, { id: 'the phone of the config on its side, by touch', width: config.formats.phone.height, height: config.formats.phone.width, touch: true, barPx: 60, hitPx: 44 }]
    const problems = []
    notes.layout = {}
    for (const size of sizes) {
      const t = await open({}, { width: size.width, height: size.height, touch: size.touch === true })
      const boxes = await t.page.evaluate(() =>
        [...document.querySelectorAll('#ui [data-control]')].map((e) => {
          const b = e.getBoundingClientRect()
          return { id: e.dataset.season ?? e.dataset.control, left: b.left, top: b.top, right: b.right, bottom: b.bottom }
        }),
      )
      await t.close()
      const shake = boxes.find((b) => b.id === 'shake')
      const mark = boxes.find((b) => b.id === seasons[0])
      const outside = boxes.filter((b) => b.left < 0 || b.top < 0 || b.right > size.width || b.bottom > size.height).map((b) => b.id)
      const touching = boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).map((b) => `${a.id} and ${b.id}`))
      const offCentre = Math.round(Math.abs((shake.left + shake.right) / 2 - size.width / 2) * 10) / 10
      const oneRow = Math.abs((mark.top + mark.bottom) / 2 - (shake.top + shake.bottom) / 2) < 2
      const barPx = Math.round((size.height - Math.min(...boxes.map((b) => b.top))) * 10) / 10
      const leastPx = Math.min(...boxes.map((b) => Math.min(b.right - b.left, b.bottom - b.top)))
      notes.layout[size.id] = { controls: boxes.length, oneRow, offCentre, barPx, leastPx }
      if (size.barPx) problems.push(barPx > size.barPx ? `${size.id}: the controls stand ${barPx} px high, more than the ${size.barPx} px the framing is drawn for` : '', leastPx < size.hitPx ? `${size.id}: a control is ${leastPx} px across, under ${size.hitPx}` : '')
      problems.push(
        want(boxes.length, seasons.length + 2, `${size.id}: controls`),
        want(outside, [], `${size.id}: controls outside the frame`),
        want(touching, [], `${size.id}: controls that touch`),
        offCentre > 1 ? `${size.id}: Shake is ${offCentre} px off centre` : '',
        want(oneRow, size.id !== 'phone', `${size.id}: marks on the row of Shake`),
      )
    }
    return first(...problems)
  })

  const slow = await Promise.all([
    (async () => {
      const t = await open()
      const seenAt = await watch(t, hintMs + 9000)
      notes.pulseAfterShownMs = seenAt
      await t.close()
      return seenAt.length === 1 && seenAt[0] > hintMs - 50 && seenAt[0] < hintMs + 1500 ? '' : `pulse starts ${JSON.stringify(seenAt)} ms after the controls were shown, expected one at ${hintMs} or just after`
    })(),
    (async () => {
      const t = await open()
      await t.page.waitForTimeout(800)
      await t.page.keyboard.press('Space')
      const seenAt = await watch(t, hintMs + 4000)
      await t.close()
      return want(seenAt, [], 'pulse after a shake')
    })(),
    (async () => {
      const t = await open({}, { reducedMotion: 'reduce' })
      const seenAt = await watch(t, hintMs + 2500)
      const moves = await t.page.evaluate(() => [...document.querySelectorAll('#ui [data-control], #ui [data-control] *')].filter((e) => parseFloat(getComputedStyle(e).transitionDuration) > 0 || getComputedStyle(e).animationName !== 'none').length)
      await t.close()
      return first(want(seenAt, [], 'pulse with prefers-reduced-motion'), want(moves, 0, 'elements that still move'))
    })(),
    (async () => {
      const t = await open({ reduced: 1 })
      const seenAt = await watch(t, hintMs + 2500)
      const moves = await t.page.evaluate(() => [...document.querySelectorAll('#ui [data-control], #ui [data-control] *')].filter((e) => parseFloat(getComputedStyle(e).transitionDuration) > 0 || getComputedStyle(e).animationName !== 'none').length)
      await t.page.keyboard.press('Space')
      await t.page.waitForTimeout(200)
      const rock = await t.page.evaluate(() => document.getAnimations().length)
      await t.close()
      return first(want(seenAt, [], 'pulse with state.reducedMotion'), want(moves, 0, 'elements that still move'), want(rock, 0, 'animations while busy'))
    })(),
    (async () => {
      const t = await open()
      await t.page.mouse.move(200, 200)
      const t0 = Date.now()
      const early = await t.dimmed()
      await t.page.waitForFunction(() => document.querySelector('#ui > div').hasAttribute('data-dim'), null, { timeout: 15000 })
      const took = Date.now() - t0
      await t.page.waitForTimeout(1300)
      const low = await t.page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), sel.shake)
      await t.page.mouse.move(420, 260)
      const back = await t.dimmed()
      await t.page.waitForTimeout(500)
      const high = await t.page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), sel.shake)
      await t.close()
      return early === false && took > 7000 && took < 10500 && low > 0.2 && low < 0.5 && back === false && high === 1 ? '' : `dim facts ${JSON.stringify({ early, took, low, back, high })}`
    })(),
    (async () => {
      const t = await open()
      await t.page.waitForTimeout(10500)
      const dim = await t.dimmed()
      await t.close()
      return want(dim, false, 'dimmed with no input at all')
    })(),
    (async () => {
      const t = await open()
      await t.page.keyboard.press('Tab')
      await t.page.waitForTimeout(9500)
      const opacity = await t.page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), sel.shake)
      await t.close()
      return want(opacity, 1, 'opacity while a control holds keyboard focus')
    })(),
  ])
  const slowNames = [
    'one soft pulse on Shake after the hint time, once, never again',
    'no pulse once somebody has shaken',
    'prefers-reduced-motion turns the pulse and the transitions off',
    'state.reducedMotion turns the pulse and the transitions off',
    'the controls dim after input stops and come back on movement',
    'the controls never dim when there was no input (harness stills)',
    'the controls stay lit while one holds keyboard focus',
  ]
  for (const [i, problem] of slow.entries()) {
    results.push({ name: slowNames[i], ok: !problem, problem, seconds: 0 })
    console.log(`${problem ? 'FAIL' : 'ok  '}  ${slowNames[i]}${problem ? `: ${problem}` : ''}`)
  }

  await check('the probe page runs, fills the table and ends with the text and Copy', async () => {
    const context = await browser.newContext({ viewport: { width: config.formats.phone.width, height: config.formats.phone.height } })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
    const page = await context.newPage()
    await page.goto(`${origin}/tools/ui-preview/?page=probe&seconds=0.3`)
    await page.waitForSelector('#ui[data-probe="running"]')
    const running = await page.evaluate(() => ({ copy: [...document.querySelectorAll('#ui button')].some((b) => b.getClientRects().length > 0), rows: document.querySelectorAll('#ui tbody tr').length }))
    await page.waitForSelector('#ui[data-probe="done"]')
    await page.waitForTimeout(600)
    const done = await page.evaluate(() => {
      const button = document.querySelector('#ui button')
      const box = button.getBoundingClientRect()
      return {
        cells: [...document.querySelectorAll('#ui tbody td')].every((c) => /^\d+\.\d$/.test(c.textContent ?? '')),
        picked: document.querySelectorAll('#ui tbody tr[data-pick]').length,
        lines: (document.querySelector('#ui pre').textContent ?? '').split('\n').length,
        inView: box.top >= 0 && box.bottom <= window.innerHeight && box.height >= 44,
        banned: /[\u2014!]/.test(document.getElementById('ui').textContent ?? ''),
      }
    })
    await page.click('#ui button')
    await page.waitForTimeout(300)
    const label = await page.evaluate(() => document.querySelector('#ui button').textContent)
    let pasted = ''
    try {
      pasted = await page.evaluate(() => navigator.clipboard.readText())
    } catch {
      pasted = ''
    }
    const text = await page.evaluate(() => document.querySelector('#ui pre').textContent)
    await context.close()
    return first(
      want(running, { copy: false, rows: levels.length }, 'while running'),
      want(done, { cells: true, picked: 1, lines: levels.length + 5, inView: true, banned: false }, 'when done'),
      want(label, 'Copied', 'button after a press'),
      pasted && pasted !== text ? 'the clipboard does not hold the text block' : '',
    )
  })

  await check('while measuring, the probe page writes only when something changes, and its line only moves forward', async () => {
    const context = await browser.newContext({ viewport: { width: config.formats.phone.width, height: config.formats.phone.height } })
    await context.addInitScript(() => {
      const writes = { table: 0, status: 0, left: 0, line: [] }
      window.writes = writes
      new MutationObserver((list) => {
        for (const m of list) {
          const t = m.target.nodeType === 1 ? m.target : m.target.parentElement
          if (!t || !t.closest('#ui')) continue
          if (m.type === 'attributes') {
            const found = t.tagName === 'I' ? /scaleX\(([\d.]+)\)/.exec(t.style.transform) : null
            if (found) writes.line.push(Number(found[1]))
          } else if (t.closest('tbody')) writes.table++
          else if (t.matches('[role="status"]')) writes.status++
          else if (t.matches('[role="status"] + span')) writes.left++
        }
      }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] })
    })
    const page = await context.newPage()
    const perLevel = 1.2
    await page.goto(`${origin}/tools/ui-preview/?page=probe&seconds=${perLevel}`)
    await page.waitForSelector('#ui[data-probe="done"]', { timeout: 20000 })
    await page.waitForTimeout(200)
    const seen = await page.evaluate(() => ({ ...window.writes, frames: window.probeFrames.count }))
    await context.close()
    const phases = levels.length * 2
    const cells = levels.length * 4
    const steps = seen.line.slice(1).map((v, i) => v - seen.line[i])
    return first(
      seen.frames >= phases * 8 ? '' : `the mock reported only ${seen.frames} frames`,
      seen.table <= cells * (phases + 3) ? '' : `${seen.table} writes to the table in ${seen.frames} frames`,
      seen.status <= phases + 2 ? '' : `${seen.status} writes to the status line in ${seen.frames} frames`,
      seen.left <= Math.ceil(perLevel * levels.length) + 2 ? '' : `${seen.left} writes to the time left in ${seen.frames} frames`,
      seen.line.length > phases && seen.line.length <= seen.frames + 2 ? '' : `${seen.line.length} writes to the line in ${seen.frames} frames`,
      steps.every((d) => d >= 0) ? '' : 'the line moved backwards',
      Math.max(...steps) < 1 / (4 * levels.length) ? '' : `the line jumped by ${Math.max(...steps).toFixed(3)} of its length`,
      seen.line.at(-1) === 1 ? '' : `the line ended at ${seen.line.at(-1)}`,
    )
  })

  await check('a short phone screen keeps Copy in view and fades what scrolls under the edges', async () => {
    const width = config.formats.phone.width
    const height = Math.round(config.formats.phone.height * 0.78)
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()
    await page.goto(`${origin}/tools/ui-preview/?page=probe&seconds=0.2`)
    await page.waitForSelector('#ui[data-probe="done"]')
    await page.waitForTimeout(600)
    const read = () =>
      page.evaluate(() => {
        const card = document.querySelector('#ui [data-more], #ui [data-above]')
        const scroller = [...document.querySelectorAll('#ui *')].find((e) => e.scrollHeight - e.clientHeight > 1 && getComputedStyle(e).overflowY === 'auto')
        const box = document.querySelector('#ui button').getBoundingClientRect()
        return {
          more: !!card && card.hasAttribute('data-more'),
          above: !!card && card.hasAttribute('data-above'),
          overflows: !!scroller,
          copyInView: box.top >= 0 && box.bottom <= window.innerHeight,
        }
      })
    const rest = await read()
    await page.evaluate(() => {
      const scroller = [...document.querySelectorAll('#ui *')].find((e) => e.scrollHeight - e.clientHeight > 1 && getComputedStyle(e).overflowY === 'auto')
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    })
    await page.waitForTimeout(400)
    const end = await read()
    await page.setViewportSize({ width, height: config.formats.phone.height })
    await page.waitForTimeout(400)
    const tall = await read()
    await context.close()
    return first(
      want(rest, { more: true, above: false, overflows: true, copyInView: true }, 'at rest'),
      want(end, { more: false, above: true, overflows: true, copyInView: true }, 'scrolled to the end'),
      want(tall, { more: false, above: false, overflows: false, copyInView: true }, 'on the full phone height'),
    )
  })
  await check('with no WebGL2 the app says so in one quiet line, centred, and shows no control', async () => {
    const said = /cannot: '([^']+)'/.exec(fs.readFileSync(rel('src', 'copy.ts'), 'utf8'))?.[1] ?? ''
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    await context.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null
    })
    const page = await context.newPage()
    await page.goto(`${origin}/`)
    await page.waitForSelector('#ui [role="status"]')
    await page.evaluate(() => document.fonts.ready)
    const got = await page.evaluate(() => {
      const line = document.querySelector('#ui [role="status"]')
      const words = line.firstElementChild.getBoundingClientRect()
      const style = getComputedStyle(line)
      return {
        text: line.textContent,
        inUi: document.getElementById('ui').children.length,
        controls: document.querySelectorAll('[data-control], [data-menu], button, a').length,
        offCentre: [Math.round(Math.abs(words.left + words.width / 2 - innerWidth / 2)), Math.round(Math.abs(words.top + words.height / 2 - innerHeight / 2))],
        face: style.fontFamily.split(',')[0].replace(/['"]/g, ''),
        loaded: document.fonts.check(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`),
        colour: style.color,
        told: document.documentElement.dataset.cannot ?? '',
        firstPicture: document.documentElement.dataset.firstPicture ?? '',
      }
    })
    fs.writeFileSync(rel('out', 'work', 'ui-preview', 'no-webgl2.png'), await page.screenshot())
    notes.noWebgl2 = got
    await context.close()
    return first(
      said ? '' : 'src/copy.ts holds no line for it',
      want(got.text, said, 'the line'),
      want([got.inUi, got.controls], [1, 0], 'what else is in the interface'),
      got.offCentre[0] <= 1 && got.offCentre[1] <= 1 ? '' : `the line is ${got.offCentre} px off the centre`,
      want([got.face, got.loaded], ['Jost', true], 'the type'),
      /^rgba?\((0, 0, 0|255, 255, 255)\b/.test(got.colour) ? `the line is ${got.colour}` : '',
      want([got.told, got.firstPicture], ['1', ''], 'what the page says of itself'),
    )
  })
} finally {
  await browser.close()
  await server.close()
}

const failed = results.filter((r) => !r.ok)
writeJson(rel('out/work/ui-preview/check.json'), { engineHash: engineHash(), tool: 'ui-preview-check', preview: hashList(listFiles(rel('tools', 'ui-preview'))), passed: results.length - failed.length, failed: failed.length, notes, results })
console.log(`ui-preview check: ${results.length - failed.length} of ${results.length} passed`)
if (failed.length) process.exit(1)
