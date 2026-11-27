// node out/work/p6s/gl-count.mjs <url> <name> [shakes=4] [size=320x320] [first press: made|detail|<ms after the controls>]
// What the page hands the GPU and when: programs linked, buffers and pictures uploaded, the calls that waited, and the
// stretches the page's thread stood still, counted apart for each rest and each shake.
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/?quality=low', name = 'gl-count', shakesArg = '4', size = '320x320', first = 'made'] = process.argv
const shakes = Number(shakesArg)
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  const w = (window.__gl = { made: [], waits: [], gaps: [], shown: [], detail: [], hand: [], busy: [], season: [], keys: [], frames: [], ext: null })
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
  const MAKES = new Set(['linkProgram', 'bufferData', 'texImage2D', 'texImage3D', 'texSubImage2D', 'texSubImage3D', 'texStorage2D', 'texStorage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'createVertexArray', 'generateMipmap'])
  const bytesOf = (a) => {
    for (const x of a) if (ArrayBuffer.isView(x)) return x.byteLength
    for (const x of a) if (x instanceof ArrayBuffer) return x.byteLength
    return 0
  }
  const C = window.WebGL2RenderingContext
  for (const key of Object.getOwnPropertyNames(C.prototype)) {
    const d = Object.getOwnPropertyDescriptor(C.prototype, key)
    if (!d || typeof d.value !== 'function') continue
    const real = d.value
    const makes = MAKES.has(key)
    C.prototype[key] = function (...a) {
      const t = performance.now()
      try {
        return real.apply(this, a)
      } finally {
        const ms = performance.now() - t
        if (makes) w.made.push([key, Math.round(t), Math.round(ms * 10) / 10, key === 'bufferData' ? bytesOf(a) : 0])
        else if (ms >= 5) w.waits.push([key, Math.round(t), Math.round(ms)])
      }
    }
  }
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const c = getContext.call(this, kind, ...rest)
    if (c && kind === 'webgl2' && w.ext === null) w.ext = (c.getSupportedExtensions() ?? []).includes('KHR_parallel_shader_compile')
    return c
  }
  window.addEventListener('keydown', (e) => w.keys.push(Math.round(e.timeStamp)), true)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      const t = Math.round(performance.now())
      const value = el.getAttribute(m.attributeName ?? '')
      if (m.attributeName === 'data-interface') w.shown.push({ at: t, value })
      else if (m.attributeName === 'data-detail') w.detail.push({ at: t, value })
      else if (m.attributeName === 'data-made') w.hand.push({ at: t, value })
      else if (m.attributeName === 'aria-disabled' && el.matches('[data-control="shake"]')) w.busy.push({ at: t, busy: value === 'true' })
      else if (m.attributeName === 'aria-pressed' && value === 'true') w.season.push({ at: t, season: el.getAttribute('data-season') })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface', 'data-detail', 'data-made', 'aria-disabled', 'aria-pressed'] })
})
const cdp = await context.newCDPSession(page)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const space = async () => {
  const key = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 }
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ' ', ...key }).catch(() => undefined)
  await sleep(60)
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key }).catch(() => undefined)
}
const began = Date.now()
await page.goto(url, { waitUntil: 'commit' })
const landingsOf = (busy) => busy.filter((b, i) => !b.busy && i > 0 && busy[i - 1].busy)
let sent = 0
let rest = null
while (Date.now() - began < 900000) {
  const now = await page.evaluate(() => ({ t: performance.now(), shown: window.__gl.shown.find((s) => s.value === 'shown')?.at ?? null, detail: window.__gl.detail.some((r) => r.value === 'ready'), hand: window.__gl.hand, busy: window.__gl.busy })).catch(() => null)
  if (!now || now.shown === null) {
    await sleep(200)
    continue
  }
  const made = now.hand.length ? now.hand.some((h) => h.value === 'ready') : now.detail
  const go = sent > 0 || first === 'made' ? made : first === 'detail' ? now.detail : now.t - now.shown >= Number(first)
  const busy = now.busy.length > 0 && now.busy[now.busy.length - 1].busy
  if (go && !busy && landingsOf(now.busy).length === sent) {
    rest ??= Date.now()
    if (Date.now() - rest >= (sent === 0 && first !== 'made' && first !== 'detail' ? 0 : 3000)) {
      if (sent === shakes) break
      await space()
      sent++
      rest = null
    }
  } else rest = null
  await sleep(100)
}
const got = await page.evaluate(() => ({ ...window.__gl, now: Math.round(performance.now()) }))
await browser.close()
const shownAt = got.shown.find((x) => x.value === 'shown')?.at ?? 0
const since = (t) => t - shownAt
const marks = [{ name: 'rest after the controls', from: shownAt }]
const landings = landingsOf(got.busy)
got.busy.filter((b) => b.busy).forEach((went, i) => {
  const landed = landings.find((b) => b.at > went.at)
  const into = landed ? (got.season.filter((x) => x.at <= landed.at + 250).pop()?.season ?? '?') : '?'
  marks.push({ name: `shake ${i + 1} into ${into}`, from: went.at })
  if (landed) marks.push({ name: `rest after shake ${i + 1}`, from: landed.at })
})
const phases = marks.map((m, i) => ({ ...m, to: marks[i + 1]?.from ?? got.now }))
const before = { name: 'before the controls', from: 0, to: shownAt }
const report = []
for (const p of [before, ...phases]) {
  const inP = (t) => t >= p.from && t < p.to
  const made = got.made.filter((m) => inP(m[1]))
  const count = (k) => made.filter((m) => m[0] === k).length
  const ms = (k) => Math.round(made.filter((m) => m[0] === k).reduce((s, m) => s + m[2], 0))
  const tex = made.filter((m) => /^(tex|compressedTex)/.test(m[0]))
  const waits = got.waits.filter((x) => inP(x[1]))
  const byName = {}
  for (const x of waits) {
    const b = (byName[x[0]] ??= { n: 0, ms: 0, most: 0 })
    b.n++
    b.ms += x[2]
    b.most = Math.max(b.most, x[2])
  }
  const gaps = got.gaps.filter((g) => g.from + g.ms > p.from && g.from < p.to)
  report.push({
    phase: p.name,
    fromMs: since(p.from),
    longMs: p.to - p.from,
    programs: count('linkProgram'),
    linkedAt: made.filter((m) => m[0] === 'linkProgram').reduce((groups, m) => {
      const g = groups[groups.length - 1]
      if (g && m[1] - g.last < 400) {
        g.n++
        g.last = m[1]
      } else groups.push({ n: 1, at: m[1] - p.from, last: m[1] })
      return groups
    }, []).map((g) => `${g.n}@${g.at}`),
    buffers: count('bufferData'),
    bufferBytes: made.filter((m) => m[0] === 'bufferData').reduce((s, m) => s + m[3], 0),
    bufferMs: ms('bufferData'),
    pictures: tex.length,
    pictureMs: Math.round(tex.reduce((s, m) => s + m[2], 0)),
    vertexArrays: count('createVertexArray'),
    waits: Object.entries(byName).map(([k, b]) => `${k} ${b.n} x, ${b.ms} ms, most ${b.most}`),
    stoodStill: { times: gaps.length, sumMs: gaps.reduce((s, g) => s + g.ms, 0), mostMs: gaps.reduce((m, g) => Math.max(m, g.ms), 0), list: gaps.map((g) => `${g.ms}@${g.from - p.from}`) },
    frames: got.frames.filter(inP).length,
  })
}
fs.writeFileSync(`out/work/p6s/${name}.json`, JSON.stringify({ raw: { made: got.made, waits: got.waits, gaps: got.gaps, busy: got.busy, frames: got.frames }, url, size, parallelCompile: got.ext, controlsAt: shownAt, detail: got.detail.map((d) => ({ ...d, at: since(d.at) })), made: got.hand.map((d) => ({ ...d, at: since(d.at) })), report, console: lines }, null, 1))
console.log(`${name} · ${size} · parallel compile ${got.ext} · the controls at ${shownAt} ms · detail ${got.detail.map((d) => `${d.value}@${since(d.at)}`).join(' ')} · made ${got.hand.map((d) => `${d.value}@${since(d.at)}`).join(' ') || 'not told'}`)
for (const r of report) {
  console.log(`${r.phase} (${r.longMs} ms, ${r.frames} frames): programs ${r.programs} · buffers ${r.buffers} (${(r.bufferBytes / 1e6).toFixed(2)} MB, ${r.bufferMs} ms) · pictures ${r.pictures} (${r.pictureMs} ms) · vertex arrays ${r.vertexArrays} · stood still ${r.stoodStill.times} x, ${r.stoodStill.sumMs} ms, most ${r.stoodStill.mostMs}`)
  if (r.linkedAt.length) console.log(`    programs linked: ${r.linkedAt.join(' ')}`)
  if (r.waits.length) console.log(`    waited in: ${r.waits.join(' · ')}`)
  if (r.stoodStill.list.length) console.log(`    stretches: ${r.stoodStill.list.join(' ')}`)
}
console.log('console', lines.length, lines.slice(0, 5))
