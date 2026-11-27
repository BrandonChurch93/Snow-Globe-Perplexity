// node out/work/p6s/hand-walk.mjs <url> <name> [key=Space|ArrowLeft|ArrowRight] [press: detail|made|<ms after the controls>] [size=320x320]
// The case job 3 is for: a season that is built and not yet in the GPU's hands, pressed early. One press, watched from
// the press to the landing and on until the page says every season is handed (data-made=ready).
// What it prints is the page's own: its attributes (data-detail, data-made, the marks' data-target and aria-pressed, the
// Shake control's aria-disabled) and its calls to the GPU (linkProgram, the waits for a link, uChange set between 0 and 1,
// which is the change of a shake being drawn), each by the page's clock.
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/?quality=low', name = 'hand-walk', keyArg = 'Space', first = 'detail', size = '320x320'] = process.argv
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
const KEYS = {
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: ' ' },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 },
}
const key = KEYS[keyArg]
if (!key) throw new Error(`no such key: ${keyArg}`)
const press = async () => {
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }).catch(() => undefined)
  await sleep(60)
  const { text: _text, ...up } = key
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...up }).catch(() => undefined)
}
const began = Date.now()
await page.goto(url, { waitUntil: 'commit' })
let sent = false
let landedAt = null
while (Date.now() - began < 900000) {
  const now = await page.evaluate(() => ({ t: performance.now(), shown: window.__gl.shown.find((s) => s.value === 'shown')?.at ?? null, detail: window.__gl.detail.some((r) => r.value === 'ready'), made: window.__gl.made.some((r) => r.value === 'ready'), busy: window.__gl.busy })).catch(() => null)
  if (!now || now.shown === null) {
    await sleep(200)
    continue
  }
  if (!sent) {
    const go = first === 'made' ? now.made : first === 'detail' ? now.detail : now.t - now.shown >= Number(first)
    if (go) {
      await press()
      sent = true
    }
  } else {
    const went = now.busy.findIndex((b) => b.busy)
    const landed = went >= 0 && now.busy.slice(went).some((b) => !b.busy)
    if (landed) landedAt ??= Date.now()
    if (landed && now.made) break
    if (landed && Date.now() - landedAt > 240000) break
    if (went < 0 && now.t - now.shown > 120000) break
  }
  await sleep(100)
}
const got = await page.evaluate(() => ({ ...window.__gl, now: Math.round(performance.now()) }))
await browser.close()

const shownAt = got.shown.find((x) => x.value === 'shown')?.at ?? 0
const pressAt = got.keys[0]?.at ?? null
const out = []
const say = (line) => {
  out.push(line)
  console.log(line)
}
const lastBefore = (list, t) => list.filter((x) => x.at <= t).pop()?.value ?? 'not told'
say(`${name} · ${url} · ${size} · parallel compile ${got.ext} · key ${keyArg} at ${first}`)
say(`the controls came ${shownAt} ms after the page began; data-detail ${got.detail.map((d) => `${d.value}@${d.at - shownAt}`).join(' ') || 'not told'}; data-made ${got.made.map((d) => `${d.value}@${d.at - shownAt}`).join(' ') || 'not told'} (ms after the controls)`)
if (pressAt === null) say('NO PRESS was taken')
else {
  const t = (at) => at - pressAt
  const went = got.busy.find((b) => b.busy && b.at >= pressAt - 5)
  const landed = went ? got.busy.find((b) => !b.busy && b.at > went.at) : null
  const end = landed?.at ?? got.now
  const target = got.target.filter((x) => x.on && x.at >= pressAt - 5 && x.at <= end)
  const lit = got.season.filter((x) => x.at >= pressAt - 5 && x.at <= end + 300)
  const litBefore = got.season.filter((x) => x.at < pressAt).pop()?.season ?? '(the first)'
  const inChange = got.change.filter((c) => c[0] >= pressAt && c[0] <= end)
  const frameOf = (at) => got.frames.filter((f) => f <= at).pop() ?? at
  const changeFrom = inChange.length ? frameOf(inChange[0][0]) : null
  const changeTo = inChange.length ? inChange[inChange.length - 1][0] : null
  say(`the press: ${pressAt - shownAt} ms after the controls; the page then said data-detail=${lastBefore(got.detail, pressAt)}, data-made=${lastBefore(got.made, pressAt)}, the lit mark ${litBefore}`)
  say(`the page's answer: Shake busy ${went ? `${t(went.at)} ms after the press` : 'NEVER'}; data-target ${target.map((x) => `${x.season}@${t(x.at)}`).join(' ') || 'none'}; ${landed ? `landed (Shake free) ${t(landed.at)} ms after the press` : 'NOT LANDED'}; lit mark after it ${lit.map((x) => `${x.season}@${t(x.at)}`).join(' ') || 'unchanged'}`)
  say(`the change of the shake (uChange between 0 and 1): ${changeFrom === null ? 'never drawn' : `first drawn in the frame that began ${t(changeFrom)} ms after the press, last at ${t(changeTo)} ms; ${new Set(inChange.map((c) => frameOf(c[0]))).size} frames of it`}`)
  const parts = [
    { name: 'the controls to the press', from: shownAt, to: pressAt },
    ...(changeFrom === null
      ? [{ name: 'the press to the landing (no change drawn)', from: pressAt, to: end }]
      : [
          { name: 'the press to the first frame of the change', from: pressAt, to: changeFrom },
          { name: 'the first frame of the change to the landing', from: changeFrom, to: end },
        ]),
    { name: `the landing to ${got.made.some((m) => m.value === 'ready') ? 'data-made=ready' : 'the end of the look'}`, from: end, to: got.made.find((m) => m.value === 'ready' && m.at >= end)?.at ?? got.now },
  ]
  for (const p of parts) {
    const inP = (at) => at >= p.from && at < p.to
    const links = got.links.filter((l) => inP(l[0]))
    const groups = links.reduce((g, l) => {
      const lastG = g[g.length - 1]
      if (lastG && l[0] - lastG.last < 300) {
        lastG.n++
        lastG.last = l[0]
      } else g.push({ n: 1, at: l[0], last: l[0] })
      return g
    }, [])
    const waits = got.waits.filter((x) => inP(x[1]))
    const byName = {}
    for (const x of waits) {
      const b = (byName[x[0]] ??= { n: 0, ms: 0, most: 0 })
      b.n++
      b.ms += x[2]
      b.most = Math.max(b.most, x[2])
    }
    const gaps = got.gaps.filter((g) => g.from + g.ms > p.from && g.from < p.to)
    const frames = got.frames.filter(inP)
    let longest = 0
    for (let i = 1; i < frames.length; i++) longest = Math.max(longest, frames[i] - frames[i - 1])
    say(`${p.name} (${p.to - p.from} ms): ${links.length} programs linked${groups.length ? ` (${groups.map((g) => `${g.n}@${g.at - pressAt}`).join(' ')})` : ''}; ${frames.length} frames, the longest wait between two ${longest} ms; the thread stood ${gaps.length} x, ${gaps.reduce((s, g) => s + g.ms, 0)} ms in all, ${gaps.reduce((m, g) => Math.max(m, g.ms), 0)} ms at most`)
    const named = Object.entries(byName).sort((a, b) => b[1].ms - a[1].ms).slice(0, 5)
    if (named.length) say(`    calls that waited 5 ms or more: ${named.map(([k, b]) => `${k} ${b.n} x, ${b.ms} ms, most ${b.most}`).join(' · ')}`)
  }
}
say(`console ${lines.length} ${JSON.stringify(lines.slice(0, 5))}`)
fs.writeFileSync(`out/work/p6s/${name}.json`, JSON.stringify({ url, size, key: keyArg, first, shownAt, pressAt, got, lines }))
fs.writeFileSync(`out/work/p6s/${name}.txt`, out.join('\n') + '\n')
