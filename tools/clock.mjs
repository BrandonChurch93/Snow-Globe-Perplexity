import fs from 'node:fs'
import { rel, readJson, writeJson, loadConfig, parseArgs, bootId, replaceSection } from './lib/paths.mjs'
import * as core from './lib/clock-core.mjs'

const args = parseArgs(process.argv.slice(2))
const cfg = loadConfig()
const file = rel('kit', 'CLOCK.json')
const progressFile = rel('kit', 'PROGRESS.md')
const state = fs.existsSync(file) ? readJson(file) : core.emptyClock()
const now = Date.now()
const boot = bootId()
const status = Boolean(args.status)

function donePhases() {
  const text = fs.readFileSync(progressFile, 'utf8')
  const done = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(\d)\s*·[^|]*\|\s*done\s*\|/)
    if (m) done.push(Number(m[1]))
  }
  return done
}

let lines = []
if (args.start) {
  core.applyStart(state, cfg, now, boot)
  lines = [`clock: task started at ${new Date(now).toISOString()}. No time added.`]
} else if (args.review) {
  const changed = core.applyReview(state, cfg, now, boot)
  lines = [changed ? `clock: review approved. The allowance in force is now ${cfg.budget.afterReviewHours} h, counted from zero.` : 'clock: the review was already approved. Nothing changed.']
} else if (args.continue) {
  const n = Number(args.continue)
  const boxes = core.applyContinue(state, cfg, { n, now, boot, donePhases: donePhases() })
  lines = [`clock: continuation ${n}. New boxes in hours: ${Object.entries(boxes).map(([p, h]) => `phase ${p} ${h.toFixed(2)}`).join(', ')}`]
} else if (args['review-round']) {
  const n = Number(args['review-round'])
  const dt = args.peek ? 0 : core.applyReviewRoundTick(state, cfg, { n, now, boot, status })
  lines = core.sideReport(state, cfg, 'review round', n, dt)
} else if (args.extension) {
  const n = Number(args.extension)
  const dt = args.peek ? 0 : core.applyExtensionTick(state, cfg, { n, now, boot, status })
  lines = core.sideReport(state, cfg, 'extension', n, dt)
} else if (args.phase !== undefined) {
  const phase = Number(args.phase)
  if (!state.segment) core.applyStart(state, cfg, now, boot)
  const dt = args.peek ? 0 : core.applyTick(state, cfg, { phase, now, boot, status })
  lines = core.phaseReport(state, cfg, phase, dt)
} else {
  console.error('usage: npm run clock -- --start | --phase N [--status] [--peek] | --review | --continue N | --review-round N | --extension N')
  process.exit(2)
}

state.lastReport = [`${new Date(now).toISOString().replace('T', ' ').slice(0, 16)} UTC`, ...lines]
if (!args.peek) {
  writeJson(file, state)
  const md = fs.readFileSync(progressFile, 'utf8')
  const body = ['Copied from the last tick of `npm run clock`.', '', '```', ...state.lastReport, '```'].join('\n')
  fs.writeFileSync(progressFile, replaceSection(md, 'Clock', body))
}
console.log(lines.join('\n'))
