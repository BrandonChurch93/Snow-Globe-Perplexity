// node tools/item285/walk.mjs <url> <name> <mode> [size=320x320]   (run from the root of the tree; item 285, for measuring alone)
// One load of the built page, with what item 285 asks of it measured by the page's own clock (ms after navigation):
// the first picture (data-first-picture), the controls, the hand's end (data-made=ready), every stand of the thread and
// every program linked, with what it is. Then, by mode:
//   round  Space four times, each once the page says every season is in the GPU's hands and the picture has rested 3 s
//   menu   the owner's menu opened with its key, then each other season chosen there from the season the page began in,
//          and that season chosen again in between: every one of the others is gone into for the first time from it
//   soon   Space once, 1000 ms after the first picture, while the hands still work; then the shake to its end, 6 s more,
//          and on to the hand's end
//   rest   no press: the load alone, to the hand's end
//   first  no press: the first 31 s of the load alone, and the hand's end is not waited for
// For each press: the programs linked from the press to the landing, the thread's longest stand in it, where it landed.
// The last line says ok when every press was taken and landed and the page threw nothing; in round and menu it asks as
// well that no program was linked from any press to its landing. In soon a press may go to a season still being made,
// and that season's own programs are then linked while the press waits: they are said, not counted against the walk.
import fs from 'node:fs'
import { launch } from '../lib/browser.mjs'
const [, , url = 'http://localhost:4190/?quality=low', name = 'early-walk', mode = 'round', size = '320x320'] = process.argv
const [width, height] = size.split('x').map(Number)
const browser = await launch({ extraArgs: (process.env.WALK_ARGS ?? '').split(' ').filter(Boolean) })
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
const OUT = 'out/work/item285'
fs.mkdirSync(OUT, { recursive: true })
const beganAt = new Date().toISOString().slice(0, 19) + 'Z'
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  const w = (window.__gl = { links: [], waits: [], gaps: [], shown: [], first: [], made: [], detail: [], busy: [], season: [], target: [], keys: [], downs: [], clicks: [], frames: [], ext: null })
  let last = performance.now()
  setInterval(() => {
    const t = performance.now()
    if (t - last > 50) w.gaps.push({ from: Math.round(last), ms: Math.round(t - last) })
    last = t
  }, 16)
  const frame = () => {
    w.frames.push(Math.round(performance.now()))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  const C = window.WebGL2RenderingContext
  const sources = new WeakMap()
  const attached = new WeakMap()
  const names = new WeakMap()
  const KINDS = [
    ['the wash of spring', /uWash\.x <= 0\.0\) discard/],
    ['the bubble of the glass', /outerRing/],
    ['the storm of spring', /uStorm\.x \* /],
  ]
  const nameOf = (program) => {
    let n = names.get(program)
    if (n === undefined) {
      const all = (attached.get(program) ?? []).map((x) => sources.get(x) ?? '')
      const text = all.join('\n')
      const kind = KINDS.find(([, re]) => re.test(text))
      n = `${kind ? `${kind[0]}, ` : ''}${all.map((x) => x.length).join('+')} chars`
      names.set(program, n)
    }
    return n
  }
  const WAITS = new Set(['getProgramInfoLog', 'getProgramParameter', 'getShaderInfoLog', 'getShaderParameter', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'useProgram', 'drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'texStorage2D', 'texStorage3D', 'generateMipmap', 'readPixels', 'clientWaitSync', 'getSyncParameter', 'finish', 'flush', 'blitFramebuffer', 'checkFramebufferStatus', 'getError', 'validateProgram'])
  const OF_PROGRAM = new Set(['getProgramInfoLog', 'getProgramParameter', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'useProgram', 'validateProgram'])
  for (const key of Object.getOwnPropertyNames(C.prototype)) {
    const d = Object.getOwnPropertyDescriptor(C.prototype, key)
    if (!d || typeof d.value !== 'function') continue
    const real = d.value
    if (key === 'shaderSource') {
      C.prototype[key] = function (shader, source) {
        sources.set(shader, String(source))
        return real.call(this, shader, source)
      }
    } else if (key === 'attachShader') {
      C.prototype[key] = function (program, shader) {
        const list = attached.get(program) ?? []
        list.push(shader)
        attached.set(program, list)
        return real.call(this, program, shader)
      }
    } else if (key === 'linkProgram') {
      C.prototype[key] = function (...a) {
        const t = performance.now()
        try {
          return real.apply(this, a)
        } finally {
          w.links.push([Math.round(t), Math.round((performance.now() - t) * 10) / 10, nameOf(a[0])])
        }
      }
    } else if (WAITS.has(key)) {
      C.prototype[key] = function (...a) {
        const t = performance.now()
        try {
          return real.apply(this, a)
        } finally {
          const ms = performance.now() - t
          if (ms >= 5) w.waits.push([key, Math.round(t), Math.round(ms), OF_PROGRAM.has(key) && a[0] ? nameOf(a[0]) : ''])
        }
      }
    }
  }
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const c = getContext.call(this, kind, ...rest)
    if (c && kind === 'webgl2' && w.ext === null) w.ext = (c.getSupportedExtensions() ?? []).includes('KHR_parallel_shader_compile')
    return c
  }
  window.addEventListener('keydown', (e) => w.keys.push({ at: Math.round(performance.now()), key: e.key }), true)
  const option = (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-menu] button') : null
    return b ? { at: Math.round(performance.now()), row: b.closest('[data-row]')?.getAttribute('data-row') ?? '', value: b.getAttribute('data-value') } : null
  }
  for (const [type, into] of [['pointerdown', 'downs'], ['click', 'clicks']])
    window.addEventListener(type, (e) => {
      const o = option(e)
      if (o) w[into].push(o)
    }, true)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      const t = Math.round(performance.now())
      const value = el.getAttribute(m.attributeName ?? '')
      if (m.attributeName === 'data-interface') w.shown.push({ at: t, value })
      else if (m.attributeName === 'data-first-picture') w.first.push({ at: t, value })
      else if (m.attributeName === 'data-detail') w.detail.push({ at: t, value })
      else if (m.attributeName === 'data-made') w.made.push({ at: t, value })
      else if (m.attributeName === 'aria-disabled' && el.matches('[data-control="shake"]')) w.busy.push({ at: t, busy: value === 'true' })
      else if (m.attributeName === 'aria-pressed' && value === 'true' && el.hasAttribute('data-season')) w.season.push({ at: t, season: el.getAttribute('data-season') })
      else if (m.attributeName === 'data-target') w.target.push({ at: t, season: el.getAttribute('data-season'), on: value !== null })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface', 'data-first-picture', 'data-detail', 'data-made', 'aria-disabled', 'aria-pressed', 'data-target'] })
})
const cdp = await context.newCDPSession(page)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = () => new Date().toISOString().slice(11, 19)
const key = async (k) => {
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k }).catch(() => undefined)
  await sleep(60)
  const { text: _text, ...up } = k
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...up }).catch(() => undefined)
}
const SPACE = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: ' ' }
const M = { key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77, nativeVirtualKeyCode: 77, text: 'm' }
const state = () =>
  page
    .evaluate(() => ({
      t: performance.now(),
      first: window.__gl.first[0]?.at ?? null,
      shown: window.__gl.shown.find((s) => s.value === 'shown')?.at ?? null,
      made: window.__gl.made.some((r) => r.value === 'ready'),
      busy: window.__gl.busy,
      keys: window.__gl.keys.length,
      downs: window.__gl.downs.length,
    }))
    .catch(() => null)
/** Waits until the shake control has answered `sent` presses and is free, and the picture has rested `restMs`. False after `limitMs`. */
const landedAndRested = async (sent, restMs, limitMs) => {
  const from = Date.now()
  let restFrom = null
  while (Date.now() - from < limitMs) {
    const now = await state()
    if (now) {
      const free = now.busy.length === 0 || !now.busy[now.busy.length - 1].busy
      const answered = now.busy.filter((b) => b.busy).length >= sent
      if (free && answered) {
        restFrom ??= Date.now()
        if (Date.now() - restFrom > restMs) return true
      } else restFrom = null
    }
    await sleep(100)
  }
  return false
}
const began = Date.now()
await page.goto(url, { waitUntil: 'commit' })
const presses = []
if (mode === 'soon') {
  // The press is sent when the page's clock says a second has gone by since the first picture. A thread that stands
  // then takes it when it is free again, as it takes a visitor's.
  for (;;) {
    const now = await state()
    if (now && now.first !== null && now.t >= now.first + 1000) break
    if (Date.now() - began > 600000) throw new Error('no first picture within ten minutes')
    await sleep(20)
  }
  await key(SPACE)
  presses.push({ how: 'Space' })
  await sleep(400)
  const landed = await landedAndRested(1, 6000, 600000)
  console.log(`${stamp()} ${name}: the press was sent; landed and rested ${landed}`)
  const from = Date.now()
  for (;;) {
    const now = await state()
    if ((now && now.made) || Date.now() - from > 600000) break
    await sleep(200)
  }
  await sleep(1000)
} else if (mode === 'first') {
  for (;;) {
    const now = await state()
    if (now && now.first !== null && now.t >= 31000) break
    if (Date.now() - began > 600000) throw new Error('no first picture within ten minutes')
    await sleep(200)
  }
} else {
  for (;;) {
    const now = await state()
    if (now && now.shown !== null && now.made) break
    if (Date.now() - began > 1500000) throw new Error('data-made=ready did not come within 25 minutes')
    await sleep(200)
  }
  console.log(`${stamp()} ${name}: every season is in the GPU's hands, ${Math.round((Date.now() - began) / 1000)} s after the navigation`)
  if (mode === 'rest') {
    await sleep(1000)
  } else if (mode === 'round') {
    for (let i = 0; i < 4; i++) {
      if (!(await landedAndRested(i, 3000, 600000))) throw new Error(`the picture did not come to rest before press ${i + 1}`)
      await key(SPACE)
      presses.push({ how: 'Space' })
      await sleep(400)
    }
    await landedAndRested(4, 3000, 600000)
  } else if (mode === 'menu') {
    await landedAndRested(0, 3000, 600000)
    await key(M)
    await page.waitForFunction(() => document.querySelector('[data-menu]') && !document.querySelector('[data-menu]').hidden, null, { timeout: 60000 })
    await sleep(3000)
    const read = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-menu] [data-row="season"] button')].map((b) => {
          const r = b.getBoundingClientRect()
          return { value: b.getAttribute('data-value'), chosen: b.getAttribute('aria-pressed') === 'true', x: r.x + r.width / 2, y: r.y + r.height / 2 }
        }),
      )
    const options = await read()
    const home = options.find((o) => o.chosen)?.value
    const others = options.filter((o) => o.value !== home).map((o) => o.value)
    const plan = others.flatMap((s, i) => (i < others.length - 1 ? [s, home] : [s]))
    console.log(`${stamp()} ${name}: the menu is open on ${home}; the plan ${plan.join(', ')}`)
    let sent = 0
    for (const value of plan) {
      const o = (await read()).find((x) => x.value === value)
      if (!o) throw new Error(`no season option ${value}`)
      if (!(o.x > 0 && o.y > 0 && o.x < width && o.y < height)) throw new Error(`the option ${value} is outside the page: ${o.x},${o.y}`)
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: o.x, y: o.y, button: 'none', buttons: 0, pointerType: 'mouse' })
      await sleep(500)
      void cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: o.x, y: o.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' }).catch(() => undefined)
      await Promise.all([page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null)))), sleep(80)])
      void cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: o.x, y: o.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' }).catch(() => undefined)
      presses.push({ how: `the menu, ${value}` })
      sent++
      await sleep(400)
      if (!(await landedAndRested(sent, 3000, 600000))) throw new Error(`the picture did not come to rest after the menu's ${value}`)
    }
  } else throw new Error(`no mode ${mode}`)
}
const got = await page.evaluate(() => ({ ...window.__gl, now: Math.round(performance.now()) }))
const machine = await page.evaluate(async () => {
  const c = document.createElement('canvas').getContext('webgl2')
  const e = c?.getExtension('WEBGL_debug_renderer_info')
  const build = await fetch('build.json').then((r) => r.json()).catch(() => null)
  return { renderer: c ? String(c.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : c.RENDERER)) : 'no webgl2', processors: navigator.hardwareConcurrency, engine: build?.engineHash ?? null, agent: navigator.userAgent }
})
await browser.close()
const endedAt = new Date().toISOString().slice(0, 19) + 'Z'

const firstAt = got.first[0]?.at ?? null
const shownAt = got.shown.find((x) => x.value === 'shown')?.at ?? null
const madeAt = got.made.find((m) => m.value === 'ready')?.at ?? null
const out = []
const say = (line) => {
  out.push(line)
  console.log(line)
}
say(`${name} · ${url} · ${size} · ${mode} · parallel compile ${got.ext} · engine ${machine.engine} · began ${beganAt} ended ${endedAt}`)
say(`the renderer as the page reports it: ${machine.renderer} · ${machine.processors} processors`)
say(`after the navigation: the first picture ${firstAt === null ? 'NEVER' : `${firstAt} ms`}, the controls ${shownAt === null ? 'NEVER' : `${shownAt} ms`}, the hand's end ${madeAt === null ? (mode === 'first' ? 'not waited for' : 'NEVER') : `${madeAt} ms`}; ${got.links.length} programs linked in all, ${got.links.filter((l) => firstAt !== null && l[0] <= firstAt).length} of them by the first picture${madeAt === null ? '' : `, ${got.links.filter((l) => l[0] <= madeAt).length} by the hand's end`}`)
const inside = (list, at, from, to) => list.filter((x) => at(x) >= from && at(x) < to)
const stands = got.gaps
  .filter((g) => g.from < 30000 && g.ms >= 300)
  .map((g) => {
    const links = inside(got.links, (l) => l[0], g.from, g.from + g.ms)
    const waits = inside(got.waits, (x) => x[1], g.from, g.from + g.ms).filter((x) => x[2] >= 100)
    return { from: g.from, ms: g.ms, afterFirst: firstAt === null ? null : g.from - firstAt, links: links.length, linked: links.map((l) => l[2]), waits: waits.map((x) => ({ call: x[0], ms: x[2], of: x[3] })) }
  })
say(`the stands of 300 ms or more in the first 30 s: ${stands.length}, ${stands.reduce((s, g) => s + g.ms, 0)} ms in all; ${stands.filter((g) => firstAt !== null && g.from >= firstAt).length} of them after the first picture, ${stands.filter((g) => firstAt !== null && g.from >= firstAt).reduce((s, g) => s + g.ms, 0)} ms in all`)
for (const g of stands) {
  const kinds = {}
  for (const n of g.linked) kinds[n] = (kinds[n] ?? 0) + 1
  const named = Object.entries(kinds).filter(([n]) => n.startsWith('the '))
  say(`    at ${g.from} ms${g.afterFirst === null ? '' : ` (${g.afterFirst >= 0 ? `${g.afterFirst} ms after` : `${-g.afterFirst} ms before`} the first picture)`} for ${g.ms} ms: ${g.links} programs linked in it${named.length ? ` [${named.map(([n]) => n).join('; ')}]` : ''}; waited 100 ms or more in ${g.waits.map((x) => `${x.call} ${x.ms} ms${x.of ? ` (${x.of})` : ''}`).join(', ') || 'no call of the page'}`)
}
const taken = mode === 'menu' ? got.downs.filter((d) => d.row === 'season') : got.keys.filter((k) => k.key === ' ')
let bad = 0
const rows = []
taken.forEach((k, i) => {
  const pressAt = k.at
  const t = (at) => at - pressAt
  const went = got.busy.find((b) => b.busy && b.at >= pressAt - 5)
  const landed = went ? got.busy.find((b) => !b.busy && b.at > went.at) : null
  const end = landed?.at ?? got.now
  const target = got.target.filter((x) => x.on && x.at >= pressAt - 5 && x.at <= end)
  const links = inside(got.links, (l) => l[0], pressAt, end)
  const gaps = got.gaps.filter((g) => g.from + g.ms > pressAt && g.from < end)
  const waits = inside(got.waits, (x) => x[1], pressAt, end)
  const byName = {}
  for (const x of waits) {
    const b = (byName[x[0]] ??= { n: 0, ms: 0, most: 0 })
    b.n++
    b.ms += x[2]
    b.most = Math.max(b.most, x[2])
  }
  const frames = got.frames.filter((f) => f >= pressAt && f < end)
  const longest = gaps.reduce((m, g) => Math.max(m, g.ms), 0)
  const nextPress = taken[i + 1]?.at ?? got.now
  const after = inside(got.links, (l) => l[0], end, nextPress)
  const into = got.season.filter((s) => s.at >= pressAt && s.at <= end + 2000).pop()?.season ?? null
  if (!landed || (mode !== 'soon' && links.length)) bad++
  const row = { press: i + 1, how: presses[i]?.how ?? '', at: pressAt, afterFirst: firstAt === null ? null : pressAt - firstAt, busyAfter: went ? t(went.at) : null, target: target.map((x) => x.season), landedAfter: landed ? t(landed.at) : null, into, links: links.length, linked: links.map((l) => `@${t(l[0])} ${l[2]}`), longest, stood: gaps.length, stoodMs: gaps.reduce((s, g) => s + g.ms, 0), frames: frames.length, linksAfter: after.length, linkedAfter: after.map((l) => l[2]), waits: byName }
  rows.push(row)
  say(`press ${row.press} (${row.how}): ${pressAt} ms after the navigation${row.afterFirst === null ? '' : `, ${row.afterFirst} ms after the first picture`}; Shake busy ${row.busyAfter === null ? 'NEVER' : `${row.busyAfter} ms after`}; target ${row.target.join(' ') || 'none'}; landed ${row.landedAfter === null ? 'NEVER' : `${row.landedAfter} ms after`}${into ? `, in ${into}` : ''}`)
  say(`    the press to the landing: ${row.links} programs linked${row.links ? ` (${row.linked.join('; ')})` : ''}; the thread's longest stand ${row.longest} ms, ${row.stood} stands, ${row.stoodMs} ms in all; ${row.frames} frames; from the landing to the next press ${row.linksAfter} programs linked${row.linksAfter ? ` (${[...new Set(row.linkedAfter)].join('; ')})` : ''}`)
  const named = Object.entries(byName).sort((a, b) => b[1].ms - a[1].ms).slice(0, 5)
  if (named.length) say(`    calls that waited 5 ms or more: ${named.map(([n, b]) => `${n} ${b.n} x, ${b.ms} ms, most ${b.most}`).join(' · ')}`)
})
const want = presses.length
if (taken.length < want) bad++
const errors = lines.filter((l) => l.startsWith('error:') || l.startsWith('pageerror:'))
const warnings = lines.filter((l) => l.startsWith('warning:'))
if (errors.length) bad++
if (firstAt === null || (mode !== 'first' && madeAt === null)) bad++
say(`${bad ? 'NOT ' : ''}ok: ${taken.length} of ${want} presses taken; ${rows.filter((r) => r.links).length} with a program linked from the press to the landing, ${rows.filter((r) => r.landedAfter === null).length} not landed; ${errors.length} errors thrown`)
say(`console: ${errors.length} errors, ${warnings.length} warnings, ${lines.length} lines in all ${JSON.stringify(lines.slice(0, 8))}`)
const record = { name, url, size, mode, beganAt, endedAt, machine, ext: got.ext, firstAt, shownAt, madeAt, programs: got.links.length, byFirst: got.links.filter((l) => firstAt !== null && l[0] <= firstAt).length, stands, rows, errors, warnings, lines, ok: !bad }
fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(record))
fs.writeFileSync(`${OUT}/${name}.full.json`, JSON.stringify({ ...record, got }))
fs.writeFileSync(`${OUT}/${name}.txt`, out.join('\n') + '\n')
