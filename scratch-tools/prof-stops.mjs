// node out/work/p6s/prof-stops.mjs <name> [over ms=500]: where the page's thread was in each of its long stops after the controls, by the innermost function.
import fs from 'node:fs'
const [, , name, over = '500'] = process.argv
const prof = JSON.parse(fs.readFileSync(`out/work/p6s/${name}.cpuprofile`, 'utf8'))
const facts = JSON.parse(fs.readFileSync(`out/work/p6s/${name}.json`, 'utf8'))
const shownAt = facts.shown.find((x) => x.value === 'shown')?.at ?? 0
const byId = new Map(prof.nodes.map((n) => [n.id, n]))
const pageMs = (us) => facts.now - (prof.endTime - us) / 1000
const stops = facts.gaps.filter((g) => g.from >= shownAt && g.ms >= Number(over))
const label = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`
const all = new Map()
const per = stops.map(() => new Map())
let t = prof.startTime
for (let i = 0; i < prof.samples.length; i++) {
  t += prof.timeDeltas[i]
  const dt = (i + 1 < prof.samples.length ? prof.timeDeltas[i + 1] : 0) / 1000
  const at = pageMs(t)
  const k = stops.findIndex((g) => at >= g.from && at <= g.from + g.ms)
  if (k < 0) continue
  const key = label(byId.get(prof.samples[i]))
  all.set(key, (all.get(key) ?? 0) + dt)
  per[k].set(key, (per[k].get(key) ?? 0) + dt)
}
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${Math.round(v)} ms ${k}`).join(' · ')
console.log(`${name}: the controls at ${shownAt} ms; ${stops.length} stops of ${over} ms or more after them, ${stops.reduce((s, g) => s + g.ms, 0)} ms in all, watched until ${Math.round(facts.now - shownAt)} ms after the controls`)
stops.forEach((g, k) => console.log(`  ${g.ms} ms from ${g.from - shownAt}: ${top(per[k], 3)}`))
console.log('in all: ' + top(all, 12))
