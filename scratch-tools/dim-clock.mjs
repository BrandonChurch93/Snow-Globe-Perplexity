// node out/work/p6s/dim-clock.mjs <url> [size=1920x1080] [rounds=3] [scale=1] [ms to wait after the controls=0]
// The dimming by the page's own clock: when each pointer move reached the page, when the controls dimmed, and beside it
// what a tool counts that sends two moves and then asks every 400 ms, as tools/visit.mjs step 11 does.
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/', size = '1920x1080', roundsArg = '3', scaleArg = '1', waitArg = '0'] = process.argv
const [width, height] = size.split('x').map(Number)
const rounds = Number(roundsArg)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: Number(scaleArg) })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  const w = (window.__dim = { moves: [], dims: [], shown: null, gaps: [] })
  window.addEventListener('pointermove', (e) => w.moves.push({ stamp: Math.round(e.timeStamp), taken: Math.round(performance.now()) }), true)
  let last = performance.now()
  setInterval(() => {
    const t = performance.now()
    if (t - last > 50) w.gaps.push({ from: Math.round(last), ms: Math.round(t - last) })
    last = t
  }, 16)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      const t = Math.round(performance.now())
      if (m.attributeName === 'data-interface' && el.getAttribute('data-interface') === 'shown') w.shown ??= t
      if (m.attributeName === 'data-dim') w.dims.push({ at: t, dim: el.hasAttribute('data-dim') })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface', 'data-dim'] })
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pageNow = () => page.evaluate(() => Math.round(performance.now()))
await page.goto(url, { waitUntil: 'commit' })
for (;;) {
  const shown = await page.evaluate(() => window.__dim?.shown ?? null).catch(() => null)
  if (shown !== null) break
  await sleep(200)
}
await sleep(Number(waitArg))
const out = []
for (let r = 0; r < rounds; r++) {
  const from = await page.evaluate(() => ({ moves: window.__dim.moves.length, dims: window.__dim.dims.length }))
  const a0 = Date.now()
  await page.mouse.move(width * 0.3 + r * 7, height * 0.3)
  const a1 = Date.now()
  await page.mouse.move(width * 0.31 + r * 7, height * 0.31)
  const a2 = Date.now()
  let counted = null
  for (;;) {
    const dim = await page.evaluate(() => document.getElementById('ui')?.firstElementChild?.hasAttribute('data-dim') ?? false)
    if (dim) {
      counted = Date.now() - a2
      break
    }
    if (Date.now() - a2 > 40000) break
    await sleep(400)
  }
  const got = await page.evaluate((f) => ({ moves: window.__dim.moves.slice(f.moves), dims: window.__dim.dims.slice(f.dims), now: Math.round(performance.now()) }), from)
  out.push({ round: r + 1, firstMoveAnswered: a1 - a0, secondMoveAnswered: a2 - a1, counted, ...got })
  await sleep(1200)
}
const all = await page.evaluate(() => ({ shown: window.__dim.shown, gaps: window.__dim.gaps }))
await browser.close()
console.log(`${url} · ${width} x ${height} at ${scaleArg} · the controls came at ${all.shown} ms`)
for (const o of out) {
  const dim = o.dims.find((d) => d.dim)
  // The page counts a move only when its own time stamp is 200 ms or more after the last one it counted.
  let lastStamp = -Infinity
  let wake = null
  for (const m of o.moves) {
    if (dim && m.taken > dim.at) break
    if (m.stamp - lastStamp >= 200) {
      lastStamp = m.stamp
      wake = m
    }
  }
  const stood = all.gaps.filter((g) => wake && dim && g.from + g.ms > wake.taken && g.from < dim.at).map((g) => `${g.ms} ms from ${g.from - wake.taken}`)
  console.log(
    `round ${o.round}: the moves reached the page at ${o.moves.map((m) => `${m.taken} (made ${m.stamp})`).join(' and ')} · the tool had its answers after ${o.firstMoveAnswered} and ${o.secondMoveAnswered} ms · ` +
      (dim && wake
        ? `the controls dimmed at ${dim.at}: ${dim.at - wake.taken} ms after the page took the last move it counted (asked 8000) · the tool counted ${o.counted} ms from its second answer`
        : `no dim seen (${JSON.stringify(o.dims)})`),
  )
  console.log(`  the thread stood between the move and the dim: ${stood.join(' · ') || 'not once'}`)
}
console.log(`console: ${lines.length} lines${lines.length ? `\n${lines.join('\n')}` : ''}`)
