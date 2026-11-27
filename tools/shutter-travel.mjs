import fs from 'node:fs'
import { parseArgs, rel } from './lib/paths.mjs'
import { Session, cfg, formatById } from './lib/page.mjs'
import { Run } from './lib/frames.mjs'
import { countFacts, ruleCount, sampleRule, tierOf } from './lib/master.mjs'

const USAGE = `node tools/shutter-travel.mjs --what film-b|loop [--format uhd] [--out file.json]
  for every frame: the travel on the picture inside its shutter, in pixels, and the count of samples the final tier gives it
  it draws nothing; it asks the page (dev.frameSamples), the same call the master tool makes`

const args = parseArgs(process.argv.slice(2))
const str = (k) => (args[k] !== undefined && args[k] !== true ? String(args[k]) : '')
const what = str('what')
if (what !== 'film-b' && what !== 'loop') {
  console.error(USAGE)
  process.exit(2)
}
const format = formatById(str('format') || cfg.deliver.master.format)
const rule = sampleRule(what)
const session = await Session.open({ what: `shutter-travel ${what}` })
try {
  const run = new Run(session, { by: 'shutter-travel', looks: false })
  const track = { kind: what === 'loop' ? 'loop' : 'film', name: what, format, tier: tierOf(rule.base), assets: 'full', fps: cfg.film.fps, step: 1 }
  const page = await run.page(track)
  const plan = await run.plan(track)
  const has = track.kind === 'loop' ? plan.loop : plan.film.frameCount
  const list = Array.from({ length: has }, (_, i) => i)
  const got = await page.evaluate(([k, l, t]) => l.map((i) => window.showcase.dev.frameSamples(k, i, t)), [track.kind, list, rule.tier])
  const counts = list.map((i, n) => ruleCount(rule, i, got[n]))
  const facts = countFacts(counts, rule.base)
  const travel = got.map((g) => g.travelPx)
  const spacing = travel.map((px, i) => px / counts[i])
  const worst = travel.reduce((a, px, i) => (px > travel[a] ? i : a), 0)
  const m = rule.motion
  const need = m ? travel.map((px) => Math.max(rule.base, Math.ceil(Math.round(px * 1000) / 1000 / m.spacingPx))) : counts
  const capped = m ? travel.filter((px) => Math.ceil(Math.round(px * 1000) / 1000 / m.spacingPx) > m.maxSamplesPerFrame).length : 0
  console.log(`${what}, ${has} frames, ${format.width} x ${format.height}`)
  console.log(`the rule: a base of ${rule.base}${m ? `, a sample every ${m.spacingPx} px of travel, at most ${m.maxSamplesPerFrame}` : ', no motion'}`)
  console.log(`frames over the base: ${facts.over}; the sum of samples: ${facts.sum} (${(facts.sum / (has * rule.base)).toFixed(3)} times the base)`)
  console.log(`frames whose count the most cuts short: ${capped}`)
  if (m?.evenFromPx !== undefined) console.log(`frames drawn with even sample times (${m.evenFromPx} px of travel or more): ${got.filter((g) => g.even).length}`)
  console.log(`the largest travel: ${travel[worst].toFixed(2)} px in frame ${worst}, drawn with ${counts[worst]} samples, one every ${spacing[worst].toFixed(3)} px`)
  console.log(`the sum of samples with no most: ${need.reduce((a, b) => a + b, 0)}; the largest count with no most: ${Math.max(...need)}`)
  const out = str('out')
  if (out) fs.writeFileSync(rel(out), JSON.stringify({ what, format: format.id, rule, frames: has, travel: travel.map((v) => Math.round(v * 1000) / 1000), counts }))
} finally {
  await session.close()
}
