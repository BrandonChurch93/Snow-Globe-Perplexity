// node out/work/p6s/round-walk.mjs <url> <name> [presses=4] [size=320x320]
// Once the page says every season is in the GPU's hands (data-made=ready), Space is pressed, and again when the shake has
// landed, once round the four seasons. For each shake: the programs linked and the stands of the thread from the press
// to the landing, by the page's clock. A handed season should link nothing in its shake.
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/?quality=low', name = 'round-walk', pressesArg = '4', size = '320x320'] = process.argv
const presses = Number(pressesArg)
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  const w = (window.__gl = { links: [], waits: [], gaps: [], shown: [], detail: [], made: [], busy: [], season: [], target: [], keys: [], frames: [], change: [], ext: null })
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
  const changes = new WeakSet()
  const WAITS = new Set(['getProgramInfoLog', 'getProgramParameter', 'getShaderInfoLog', 'getShaderParameter', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'useProgram', 'drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'texImage3D', 'texSubImage3D', 'texStorage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'generateMipmap', 'readPixels', 'finish', 'clientWaitSync', 'getError'])
  for (const key of Object.getOwnPropertyNames(C.prototype)) {
    const d = Object.getOwnPropertyDescriptor(C.prototype, key)
    if (!d || typeof d.value !== 'function') continue
    const real = d.value
    if (key === 'linkProgram') {
      C.prototype[key] = function (...a) {
        const t = performance.now()
        try {
          return real.apply(this, a)
        } finally {
          w.links.push([Math.round(t), Math.round((performance.now() - t) * 10) / 10])
        }
      }
    } else if (key === 'getUniformLocation') {
      C.prototype[key] = function (program, uniform) {
        const t = performance.now()
        const at = real.call(this, program, uniform)
        const ms = performance.now() - t
        if (ms >= 5) w.waits.push([key, Math.round(t), Math.round(ms)])
        if (at && uniform === 'uChange') changes.add(at)
        return at
      }
    } else if (key === 'uniform1f') {
      C.prototype[key] = function (at, v) {
        if (at && v > 0 && v < 1 && changes.has(at)) w.change.push([Math.round(performance.now()), Math.round(v * 1000) / 1000])
        return real.call(this, at, v)
      }
    } else if (WAITS.has(key)) {
      C.prototype[key] = function (...a) {
        const t = performance.now()
        try {
          return real.apply(this, a)
        } finally {
          const ms = performance.now() - t
          if (ms >= 5) w.waits.push([key, Math.round(t), Math.round(ms)])
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
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      const t = Math.round(performance.now())
      const value = el.getAttribute(m.attributeName ?? '')
      if (m.attributeName === 'data-interface') w.shown.push({ at: t, value })
      else if (m.attributeName === 'data-detail') w.detail.push({ at: t, value })
      else if (m.attributeName === 'data-made') w.made.push({ at: t, value })
      else if (m.attributeName === 'aria-disabled' && el.matches('[data-control="shake"]')) w.busy.push({ at: t, busy: value === 'true' })
      else if (m.attributeName === 'aria-pressed' && value === 'true' && el.hasAttribute('data-season')) w.season.push({ at: t, season: el.getAttribute('data-season') })
      else if (m.attributeName === 'data-target') w.target.push({ at: t, season: el.getAttribute('data-season'), on: value !== null })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface', 'data-detail', 'data-made', 'aria-disabled', 'aria-pressed', 'data-target'] })
})
const cdp = await context.newCDPSession(page)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const key = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: ' ' }
const press = async () => {
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }).catch(() => undefined)
  await sleep(60)
  const { text: _text, ...up } = key
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...up }).catch(() => undefined)
}
const began = Date.now()
await page.goto(url, { waitUntil: 'commit' })
let sent = 0
let restFrom = null
while (Date.now() - began < 1500000) {
  const now = await page.evaluate(() => ({ t: performance.now(), shown: window.__gl.shown.find((s) => s.value === 'shown')?.at ?? null, made: window.__gl.made.some((r) => r.value === 'ready'), busy: window.__gl.busy, keys: window.__gl.keys.length })).catch(() => null)
  if (!now || now.shown === null || !now.made) {
    await sleep(200)
    continue
  }
  const free = now.busy.length === 0 || !now.busy[now.busy.length - 1].busy
  const answered = now.busy.filter((b) => b.busy).length >= sent
  if (free && answered) {
    restFrom ??= Date.now()
    // The picture rests three seconds between two shakes, so a thing made late would show in the next count.
    if (Date.now() - restFrom > 3000) {
      if (sent >= presses) break
      await press()
      sent++
      restFrom = null
      await sleep(400)
    }
  } else restFrom = null
  await sleep(100)
}
const got = await page.evaluate(() => ({ ...window.__gl, now: Math.round(performance.now()) }))
await browser.close()

const shownAt = got.shown.find((x) => x.value === 'shown')?.at ?? 0
const madeAt = got.made.find((m) => m.value === 'ready')?.at ?? null
const out = []
const say = (line) => {
  out.push(line)
  console.log(line)
}
say(`${name} · ${url} · ${size} · parallel compile ${got.ext} · Space ${presses} x, each once the page is at rest`)
say(`the controls came ${shownAt} ms after the page began; data-made=ready ${madeAt === null ? 'NEVER' : `${madeAt - shownAt} ms after the controls`}; ${got.links.filter((l) => madeAt === null || l[0] < madeAt).length} programs linked before it`)
const frameOf = (at) => got.frames.filter((f) => f <= at).pop() ?? at
let bad = 0
got.keys.forEach((k, i) => {
  const pressAt = k.at
  const t = (at) => at - pressAt
  const went = got.busy.find((b) => b.busy && b.at >= pressAt - 5)
  const landed = went ? got.busy.find((b) => !b.busy && b.at > went.at) : null
  const end = landed?.at ?? got.now
  const target = got.target.filter((x) => x.on && x.at >= pressAt - 5 && x.at <= end)
  const inChange = got.change.filter((c) => c[0] >= pressAt && c[0] <= end)
  const changeFrom = inChange.length ? frameOf(inChange[0][0]) : null
  const links = got.links.filter((l) => l[0] >= pressAt && l[0] < end)
  const gaps = got.gaps.filter((g) => g.from + g.ms > pressAt && g.from < end)
  const waits = got.waits.filter((x) => x[1] >= pressAt && x[1] < end)
  const byName = {}
  for (const x of waits) {
    const b = (byName[x[0]] ??= { n: 0, ms: 0, most: 0 })
    b.n++
    b.ms += x[2]
    b.most = Math.max(b.most, x[2])
  }
  const frames = got.frames.filter((f) => f >= pressAt && f < end)
  let longest = 0
  for (let j = 1; j < frames.length; j++) longest = Math.max(longest, frames[j] - frames[j - 1])
  const before = i === 0 ? madeAt ?? shownAt : (got.busy.filter((b) => !b.busy && b.at < pressAt).pop()?.at ?? shownAt)
  const resting = got.links.filter((l) => l[0] >= before && l[0] < pressAt).length
  if (links.length || !landed) bad++
  say(`press ${i + 1}: ${pressAt - shownAt} ms after the controls (${resting} programs linked in the rest before it); Shake busy ${went ? `${t(went.at)} ms after` : 'NEVER'}; data-target ${target.map((x) => `${x.season}@${t(x.at)}`).join(' ') || 'none'}; the change ${changeFrom === null ? 'never drawn' : `first drawn ${t(changeFrom)} ms after`}; ${landed ? `landed ${t(landed.at)} ms after` : 'NOT LANDED'}`)
  say(`    the press to the landing: ${links.length} programs linked${links.length ? ` (${links.map((l) => `@${t(l[0])}`).join(' ')})` : ''}; ${frames.length} frames, the longest wait between two ${longest} ms; the thread stood ${gaps.length} x, ${gaps.reduce((s, g) => s + g.ms, 0)} ms in all, ${gaps.reduce((m, g) => Math.max(m, g.ms), 0)} ms at most`)
  const named = Object.entries(byName).sort((a, b) => b[1].ms - a[1].ms).slice(0, 5)
  if (named.length) say(`    calls that waited 5 ms or more: ${named.map(([n, b]) => `${n} ${b.n} x, ${b.ms} ms, most ${b.most}`).join(' · ')}`)
})
if (got.keys.length < presses) bad++
say(`${bad ? 'NOT ' : ''}ok: ${got.keys.length} of ${presses} presses taken; ${bad} with a program linked in the shake or not landed`)
say(`console ${lines.length} ${JSON.stringify(lines.slice(0, 5))}`)
fs.writeFileSync(`out/work/p6s/${name}.json`, JSON.stringify({ url, size, presses, shownAt, madeAt, got, lines }))
fs.writeFileSync(`out/work/p6s/${name}.txt`, out.join('\n') + '\n')
