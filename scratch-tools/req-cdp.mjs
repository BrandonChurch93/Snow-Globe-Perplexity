// node out/work/p6s/req-cdp.mjs <url> [seconds] [size] [press after controls ms]: what the browser's network says of each grid file, and what the page's fetch got.
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/', seconds = '45', size = '320x320', pressAfter = ''] = process.argv
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
const t0 = Date.now()
const at = () => Date.now() - t0
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()} at ${at()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message} at ${at()}`))
page.on('requestfailed', (r) => lines.push(`requestfailed ${r.url().replace(/^.*\//, '').replace(/\?.*/, '')} ${r.failure()?.errorText} at ${at()}`))
await page.addInitScript(() => {
  const w = (window.__req = { fetches: [], rejections: [], buffers: [], shown: null })
  const orig = window.fetch
  window.fetch = function (...a) {
    const u = String(a[0] instanceof Request ? a[0].url : a[0])
    const p = orig.apply(this, a)
    if (/grids\//.test(u)) {
      const rec = { url: u.replace(/^.*grids\//, '').replace(/\?.*/, ''), asked: Math.round(performance.now()) }
      w.fetches.push(rec)
      p.then((r) => { rec.ok = r.ok; rec.status = r.status; rec.answered = Math.round(performance.now()) }, (e) => { rec.error = String(e) })
    }
    return p
  }
  const ab = Response.prototype.arrayBuffer
  Response.prototype.arrayBuffer = function () {
    const p = ab.call(this)
    const rec = { asked: Math.round(performance.now()) }
    p.then((b) => { const v = new DataView(b); if (b.byteLength >= 16 && v.getUint32(0, true) === 0x47464453) { rec.grid = v.getUint32(4, true); rec.bytes = b.byteLength; rec.at = Math.round(performance.now()); w.buffers.push(rec) } }, (e) => { rec.error = String(e); rec.at = Math.round(performance.now()); w.buffers.push(rec) })
    return p
  }
  window.addEventListener('unhandledrejection', (e) => w.rejections.push(String(e.reason?.message ?? e.reason)))
  new MutationObserver((list) => {
    for (const m of list) if (m.target.getAttribute('data-interface') === 'shown' && w.shown === null) w.shown = Math.round(performance.now())
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface'] })
})
const cdp = await context.newCDPSession(page)
await cdp.send('Network.enable')
const reqs = new Map()
cdp.on('Network.requestWillBeSent', (e) => { if (/grids\//.test(e.request.url)) reqs.set(e.requestId, { url: e.request.url.replace(/^.*grids\//, '').replace(/\?.*/, ''), sent: at(), data: 0, encoded: 0, chunks: 0 }) })
cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.answered = at(); r.fromDisk = e.response.fromDiskCache } })
cdp.on('Network.dataReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.data += e.dataLength; r.encoded += e.encodedDataLength; r.chunks++; r.lastData = at() } })
cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.finished = at(); r.total = e.encodedDataLength } })
cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) { r.failed = at(); r.errorText = e.errorText; r.canceled = e.canceled; r.blockedReason = e.blockedReason } })
await page.goto(url, { waitUntil: 'commit' })
let pressed = false
while (at() < Number(seconds) * 1000) {
  if (pressAfter !== '' && !pressed) {
    const s = await page.evaluate(() => ({ shown: window.__req.shown, now: Math.round(performance.now()) })).catch(() => null)
    if (s?.shown != null && s.now - s.shown >= Number(pressAfter)) { pressed = true; await page.keyboard.press('Space'); lines.push(`pressed at ${at()}`) }
  }
  await new Promise((r) => setTimeout(r, 200))
}
const got = await page.evaluate(() => ({ ...window.__req, detail: document.querySelector('[data-detail]')?.getAttribute('data-detail') ?? null, season: document.querySelector('[data-season]')?.getAttribute('data-season') ?? null }))
console.log(url, size, seconds, 's')
for (const r of reqs.values()) console.log(' network', JSON.stringify(r))
for (const f of got.fetches) console.log(' fetch  ', JSON.stringify(f))
for (const f of got.buffers) console.log(' buffer ', JSON.stringify(f))
console.log(' rejections', JSON.stringify(got.rejections), 'detail', got.detail, 'season', got.season, 'controls at', got.shown)
console.log(' console:', lines.join(' | ') || 'none')
await browser.close()
