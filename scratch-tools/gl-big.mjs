// node gl-big.mjs <url> [seconds after the controls]: every WebGL call of the page that takes 20 ms or more, with what it was given.
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/?quality=low', seconds = '16', name = 'gl-big', size = '320x320', pressAfter = ''] = process.argv
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  const w = (window.__gl = { big: [], shown: [], gaps: [], count: {}, busy: [], other: [] })
  let last = performance.now()
  setInterval(() => {
    const t = performance.now()
    if (t - last > 50) w.gaps.push({ from: Math.round(last), ms: Math.round(t - last) })
    last = t
  }, 16)
  const brief = (a) => {
    if (a == null) return String(a)
    if (typeof a === 'number' || typeof a === 'string' || typeof a === 'boolean') return a
    if (ArrayBuffer.isView(a)) return `${a.constructor.name}(${a.length})`
    if (a instanceof ImageBitmap) return `ImageBitmap(${a.width}x${a.height})`
    if (a instanceof HTMLCanvasElement) return `canvas(${a.width}x${a.height})`
    if (a instanceof HTMLImageElement) return `img(${a.naturalWidth}x${a.naturalHeight})`
    return a.constructor?.name ?? typeof a
  }
  const C = window.WebGL2RenderingContext
  for (const key of Object.getOwnPropertyNames(C.prototype)) {
    const d = Object.getOwnPropertyDescriptor(C.prototype, key)
    if (!d || typeof d.value !== 'function') continue
    const real = d.value
    C.prototype[key] = function (...a) {
      const t = performance.now()
      try {
        return real.apply(this, a)
      } finally {
        const ms = performance.now() - t
        const b = Math.floor(t / 1000)
        if (ms >= 20) w.big.push({ at: Math.round(t), ms: Math.round(ms), name: key, args: a.slice(0, 10).map(brief) })
      }
    }
  }
  new MutationObserver((list) => {
    for (const m of list) {
      const t = Math.round(performance.now())
      if (m.attributeName === 'data-interface') w.shown.push({ at: t, value: m.target.getAttribute('data-interface') })
      else if (m.attributeName === 'data-detail') w.other.push({ at: t, detail: m.target.getAttribute('data-detail') })
      else if (m.attributeName === 'aria-disabled' && m.target.matches?.('[data-control="shake"]')) w.busy.push({ at: t, busy: m.target.getAttribute('aria-disabled') === 'true' })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface', 'data-detail', 'aria-disabled'] })
})
const wall0 = Date.now()
await page.goto(url, { waitUntil: 'commit' })
let got = null
let pressed = false
while (Date.now() - wall0 < 240000) {
  got = await page.evaluate(() => ({ ...window.__gl, now: Math.round(performance.now()) })).catch(() => null)
  const shown = got?.shown.find((x) => x.value === 'shown')
  if (shown && pressAfter !== '' && !pressed && got.now - shown.at >= Number(pressAfter)) {
    pressed = true
    await page.keyboard.press('Space')
  }
  if (shown && got.now - shown.at > Number(seconds) * 1000) break
  await new Promise((r) => setTimeout(r, 200))
}
got = await page.evaluate(() => ({ ...window.__gl, now: Math.round(performance.now()) }))
fs.writeFileSync(`out/work/p6s/${name}.json`, JSON.stringify({ url, ...got, console: lines }, null, 1))
const shownAt = got.shown.find((x) => x.value === 'shown')?.at
console.log('controls at', shownAt, 'ready', got.other.map((o) => `${o.detail}@${o.at - shownAt}`).join(' '), 'busy', got.busy.map((o) => `${o.busy}@${o.at - shownAt}`).join(' '))
console.log('gaps', got.gaps.filter((g) => g.from + g.ms > shownAt).map((g) => `${g.ms}@${g.from - shownAt}`).join(' '))
for (const b of got.big) if (b.at + b.ms > shownAt) console.log(`  ${b.ms} ms at ${b.at - shownAt}: ${b.name}(${b.args.join(', ')})`)
console.log('before the controls, calls of 100 ms or more:')
for (const b of got.big) if (b.at + b.ms <= shownAt && b.ms >= 100) console.log(`  ${b.ms} ms at ${b.at - shownAt}: ${b.name}(${b.args.join(', ')})`)
console.log('console', lines.slice(0, 6))
await browser.close()
