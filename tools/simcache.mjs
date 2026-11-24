import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg } from './lib/page.mjs'

const args = parseArgs(process.argv.slice(2))
const ALL = ['film', 'stills', 'loop']
const want = args._.length ? args._.filter((w) => ALL.includes(w)) : ALL
if (!want.length) throw new Error(`simcache: ask for ${ALL.join(', ')} or nothing for all three`)
const format = args.format && args.format !== true ? String(args.format) : cfg.formats.hd.id
const chunkSeconds = Number(args.chunk) > 0 ? Number(args.chunk) : 45
const runMs = cfg.sandbox.chunkBudgetMinutes * 60000 * 0.8
const file = rel('out', 'work', 'simcache', 'progress.json')
const started = Date.now()

const session = await Session.open({ local: args.local === true })
let left = false
try {
  const had = fs.existsSync(file) ? readJson(file) : null
  const state = had && had.engineHash === session.hash && args.force !== true ? had : { engineHash: session.hash, runs: {} }
  const page = await session.page({ format, simcache: true })
  for (const what of want) {
    const run = (state.runs[what] ??= { simulatedSeconds: 0, totalSeconds: 0, checkpoints: 0, ms: 0, done: false })
    if (run.done) {
      console.log(`simcache ${what}: already complete, ${run.totalSeconds.toFixed(1)} s of simulation in ${run.checkpoints} checkpoints`)
      continue
    }
    for (;;) {
      if (Date.now() - started > runMs) {
        left = true
        break
      }
      const r = await page.evaluate(([w, budget, from]) => window.showcase.dev.simcache(w, budget, from), [what, chunkSeconds, run.simulatedSeconds])
      run.simulatedSeconds = r.done ? r.totalSeconds : Math.max(run.simulatedSeconds, r.simulatedSeconds)
      run.totalSeconds = r.totalSeconds
      run.checkpoints += r.checkpoints
      run.ms += r.ms
      run.done = r.done
      state.time = new Date().toISOString()
      writeJson(file, state)
      console.log(`simcache ${what}: ${run.simulatedSeconds.toFixed(1)} of ${run.totalSeconds.toFixed(1)} s, ${run.checkpoints} checkpoints, ${(run.ms / 1000).toFixed(1)} s of work${r.done ? ', complete' : ''}`)
      if (r.done) break
    }
    if (left) break
  }
  if (page.errors.length) console.log(`page messages:\n${page.errors.join('\n')}`)
  console.log(left ? `simcache: stopped at the budget of this run. Run it again to continue. Progress is in ${path.relative(rel(), file)}` : `simcache: ${want.join(', ')} complete for engine ${session.hash.slice(0, 12)}`)
} finally {
  await session.close()
}
