// node out/work/p6s/open-throw.mjs <url> [seconds=40] [size=600x600]: opens one address and prints every exception thrown in it, caught or not, with where.
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url, secs = '40', size = '600x600', tag = ''] = process.argv
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
const seen = new Map()
await cdp.send('Debugger.enable')
await cdp.send('Debugger.setPauseOnExceptions', { state: 'all' })
cdp.on('Debugger.paused', async (e) => {
  const what = String(e.data?.description ?? e.data?.value ?? e.reason).split('\n')[0].slice(0, 300)
  const where = e.callFrames.slice(0, 7).map((f) => `${f.functionName || '(anonymous)'} ${f.url.split('/').slice(-3).join('/').split('?')[0]}:${f.location.lineNumber + 1}:${f.location.columnNumber}`).join(' < ')
  const key = `${what} @ ${where}`
  if (/blade/.test(what) && !seen.has(key)) {
    const r = await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: e.callFrames[0].callFrameId, expression: "JSON.stringify({S: !!S, corners, count: P.count, indexed: !!index, indexCount: index ? index.count : null, attrs: Object.keys(g.attributes), posType: P.array.constructor.name, itemSize: P.itemSize, normalized: P.normalized, interleaved: !!P.isInterleavedBufferAttribute})", returnByValue: true }).catch((x) => ({ result: { value: String(x) } }))
    console.log('AT THE THROW: ' + r.result.value)
  }
  seen.set(key, (seen.get(key) ?? 0) + 1)
  if (seen.get(key) === 1 && seen.size <= 25) console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s THROWN: ${key}`)
  await cdp.send('Debugger.resume').catch(() => null)
})
const t0 = Date.now()
await page.goto(url, { waitUntil: 'commit' })
while (Date.now() - t0 < Number(secs) * 1000) {
  await new Promise((r) => setTimeout(r, 5000))
  const s = await page.evaluate(() => ({ root: { ...document.documentElement.dataset }, ui: { ...(document.getElementById('ui')?.dataset ?? {}) } })).catch((e) => ({ threw: String(e).slice(0, 200) }))
  console.log(`${Math.round((Date.now() - t0) / 1000)} s: ${JSON.stringify(s).slice(0, 400)}`)
  if ([...seen.keys()].some((k) => /blade/.test(k)) || s.root?.firstPicture === "1") break
}
if (tag) {
  await new Promise((r) => setTimeout(r, 14000))
  const s = await page.evaluate(() => ({ root: { ...document.documentElement.dataset }, ui: { ...(document.getElementById('ui')?.dataset ?? {}) } })).catch((e) => ({ threw: String(e).slice(0, 200) }))
  console.log(`at the picture: ${JSON.stringify(s).slice(0, 400)}`)
  await page.screenshot({ path: `out/work/p6s/throw-${tag}.png` }).catch(() => null)
}
console.log(`distinct thrown: ${seen.size}`)
for (const [k, n] of [...seen].slice(0, 25)) console.log(`  ${n} x ${k.slice(0, 200)}`)
await browser.close()
