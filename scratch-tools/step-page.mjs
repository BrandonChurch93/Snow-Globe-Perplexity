// node out/work/p6s/step-page.mjs <url> <name> [size=320x320]: each step of the sets a live page makes aside, as the page's
// own clock has it. Needs a scratch build with a clock round each step (step-probe.py <tree> puts it in src/scene/steps.ts).
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url, name, size = '320x320'] = process.argv
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  window.__steps = []
})
const wall0 = Date.now()
await page.goto(url, { waitUntil: 'commit' })
let steps = []
while (Date.now() - wall0 < 240000) {
  steps = await page.evaluate(() => window.__steps).catch(() => [])
  if (new Set(steps.filter((s) => s[2] === 0).map((s) => s[0])).size >= 3) break
  await new Promise((r) => setTimeout(r, 500))
}
const build = await page.evaluate(() => fetch('build.json').then((r) => r.text())).catch(() => '')
await browser.close()
const bySeason = new Map()
for (const [season, ms, left, small, at] of steps) {
  if (!bySeason.has(season)) bySeason.set(season, [])
  bySeason.get(season).push({ ms, left, small, at })
}
const out = { url, build: build.trim(), seconds: (Date.now() - wall0) / 1000, console: lines, seasons: {} }
console.log(`${name}: ${url}, build ${build.trim()}, ${steps.length} steps clocked in ${out.seconds.toFixed(0)} s; console: ${lines.join(' | ') || 'nothing'}`)
for (const [season, list] of bySeason) {
  const parts = new Map()
  let part = 'base'
  list.forEach((s, i) => {
    if (i === 0) part = 'base'
    else if (s.left >= 5) part = 'miniature'
    else if (s.left === 4) part = 'arrival'
    else if (s.left === 3 && part === 'arrival') part = 'lights'
    else if (s.left === 1) part = 'grid'
    else if (s.left === 0) part = 'last'
    else part = 'dressing'
    if (!parts.has(part)) parts.set(part, [])
    parts.get(part).push({ ...s, i: i + 1 })
  })
  out.seasons[season] = {}
  for (const [p, l] of parts) {
    const longest = l.reduce((a, b) => (b.ms > a.ms ? b : a))
    const sum = l.reduce((a, b) => a + b.ms, 0)
    const sorted = l.map((x) => x.ms).sort((a, b) => b - a)
    out.seasons[season][p] = { steps: l.length, all: sum, longest: longest.ms, at: longest.i, next: sorted.slice(1, 4) }
    console.log(`  ${season.padEnd(7)} ${p.padEnd(10)} ${String(l.length).padStart(5)} steps, ${sum.toFixed(1).padStart(7)} ms in all, the longest ${longest.ms.toFixed(1).padStart(6)} ms (step ${longest.i} of the set); the next three ${sorted.slice(1, 4).map((x) => x.toFixed(1)).join(', ')}`)
  }
}
fs.writeFileSync(`out/work/p6s/${name}.json`, JSON.stringify(out, null, 1))
