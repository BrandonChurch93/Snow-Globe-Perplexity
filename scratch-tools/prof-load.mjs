// node prof-load.mjs <url> <name> [seconds after the controls] [press after ms]: the processor profile of the page's thread from its start.
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/?quality=low', name = 'load', seconds = '16', pressAfter = '', size = '320x320'] = process.argv
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  const w = (window.__prof = { shown: [], frames: [], gaps: [], busy: [], other: [], marks: [] })
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
  new MutationObserver((list) => {
    for (const m of list) {
      const t = Math.round(performance.now())
      if (m.attributeName === 'data-interface') w.shown.push({ at: t, value: m.target.getAttribute('data-interface') })
      else if (m.attributeName === 'data-detail') w.other.push({ at: t, detail: m.target.getAttribute('data-detail') })
      else if (m.attributeName === 'aria-disabled' && m.target.matches?.('[data-control="shake"]')) w.busy.push({ at: t, busy: m.target.getAttribute('aria-disabled') === 'true' })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface', 'data-detail', 'aria-disabled'] })
})
const cdp = await context.newCDPSession(page)
await page.goto(new URL('/build.json', url).href)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 1000 })
await cdp.send('Profiler.start')
const wall0 = Date.now()
await page.goto(url, { waitUntil: 'commit' })
let got = null
let pressed = false
while (Date.now() - wall0 < 240000) {
  got = await page.evaluate(() => ({ ...window.__prof, now: Math.round(performance.now()) })).catch(() => null)
  const shown = got?.shown.find((x) => x.value === 'shown')
  if (shown && pressAfter !== '' && !pressed && got.now - shown.at >= Number(pressAfter)) {
    pressed = true
    await page.keyboard.press('Space')
  }
  if (shown && got.now - shown.at > Number(seconds) * 1000) break
  await new Promise((r) => setTimeout(r, 200))
}
const { profile } = await cdp.send('Profiler.stop')
got = await page.evaluate(() => ({ ...window.__prof, now: Math.round(performance.now()), origin: performance.timeOrigin }))
fs.writeFileSync(`out/work/p6s/${name}.json`, JSON.stringify({ url, ...got, console: lines }, null, 1))
fs.writeFileSync(`out/work/p6s/${name}.cpuprofile`, JSON.stringify(profile))
const shownAt = got.shown.find((x) => x.value === 'shown')?.at
console.log(name, 'controls at', shownAt, 'gaps', got.gaps.map((g) => `${g.ms}@${g.from - shownAt}`).join(' '), 'ready', got.other.map((o) => `${o.detail}@${o.at - shownAt}`).join(' '), 'console', lines.length, lines.slice(0, 5))
await browser.close()
