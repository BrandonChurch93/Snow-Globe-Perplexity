// node out/work/p6s/open-one.mjs <url> [seconds=90] [size=600x600]: opens one address and says what the page says of itself, every 5 s.
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url, secs = '90', size = '600x600', tag = ''] = process.argv
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && lines.push(`${m.type()}: ${m.text().split('\n')[0].slice(0, 300)}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message.split('\n')[0].slice(0, 300)} @ ${(e.stack ?? '').split('\n').slice(1, 4).join(' | ').slice(0, 400)}`))
page.on('requestfailed', (r) => lines.push(`request failed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`))
await page.addInitScript(() => {
  window.__frames = 0
  const tick = () => {
    window.__frames++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
const t0 = Date.now()
await page.goto(url, { waitUntil: 'commit' })
let last = ''
while (Date.now() - t0 < Number(secs) * 1000) {
  await new Promise((r) => setTimeout(r, 5000))
  const s = await page
    .evaluate(() => {
      const ui = document.getElementById('ui')
      const d = document.documentElement.dataset
      return { root: { ...d }, ui: ui ? { ...ui.dataset } : null, frames: window.__frames, canvas: document.querySelectorAll('canvas').length }
    })
    .catch((e) => ({ threw: String(e).slice(0, 200) }))
  const now = JSON.stringify(s)
  console.log(`${Math.round((Date.now() - t0) / 1000)} s: ${now.slice(0, 700)}`)
  if (s.root?.firstPicture === '1' && s.ui?.interface === 'shown') break
  last = now
}
if (tag) {
  const t1 = Date.now()
  let s = null
  while (Date.now() - t1 < 60000) {
    s = await page.evaluate(() => ({ ...document.documentElement.dataset })).catch(() => null)
    if (s?.detail === 'ready') break
    await new Promise((r) => setTimeout(r, 1000))
  }
  await new Promise((r) => setTimeout(r, 2500))
  console.log(`for the picture, ${Math.round((Date.now() - t0) / 1000)} s: ${JSON.stringify(s).slice(0, 400)}`)
  await page.screenshot({ path: `out/work/p6s/vl/${tag}.png` }).catch(() => null)
}
console.log(`console and errors (${lines.length}):`)
for (const l of [...new Set(lines)].slice(0, 12)) console.log('  ' + l)
await page.screenshot({ path: `out/work/p6s/open-one.png` }).catch(() => null)
await browser.close()
