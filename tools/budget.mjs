import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseArgs, rel, writeJson } from './lib/paths.mjs'
import { Session, cfg, stillSpec, renderStill } from './lib/page.mjs'
import { machineId } from './lib/browser.mjs'

const args = parseArgs(process.argv.slice(2))
const dir = rel('out', 'work', 'budget')
fs.mkdirSync(dir, { recursive: true })
const formats = Object.values(cfg.formats)
const tiers = Object.entries(cfg.tiers).map(([id, t]) => ({ id, samples: t.samplesPerFrame }))
const bar = (cfg.film.beatsPerBar * 60) / cfg.film.defaultBpm

const t0 = Date.now()
const session = await Session.open({ what: 'budget' })
const launchSeconds = (Date.now() - t0) / 1000
const rows = []
let sim
let pageSeconds = 0
let replaySeconds = 0
let scene
try {
  for (const f of formats) {
    const s = Date.now()
    const page = await session.page({ format: f.id, simcache: false })
    const load = (Date.now() - s) / 1000
    if (!sim) {
      pageSeconds = load
      sim = await page.evaluate(async ([barSec, rest]) => {
        const d = window.showcase.dev
        const storm = await d.simulate(barSec * 0.6, 1)
        const landed = await d.simulate(barSec + 0.5, 1)
        const atRest = await d.simulate(barSec + rest, 1)
        return { storm, landed, atRest }
      }, [bar, cfg.states.restSeconds])
    }
    const per = {}
    for (const tier of ['draft', 'review']) {
      const r = await renderStill(session, stillSpec({ season: cfg.defaultSeason, state: 'rest', camera: 'hero', tier, format: f.id }), { file: path.join(dir, `${f.id}-${tier}.png`), force: true, page })
      per[tier] = r.record
      if (!scene) scene = { counts: r.record.counts, precision: r.record.precision, standIns: r.record.standIns }
      if (!replaySeconds && r.record.timings.simMs > 1000) replaySeconds = r.record.timings.simMs / 1000
    }
    const a = per.draft.timings
    const b = per.review.timings
    const perSample = (b.drawMs - a.drawMs) / (b.samples - a.samples) / 1000
    const fixed = Math.max(0, a.drawMs / 1000 - perSample * a.samples)
    const whole = per.review.seconds - b.simMs / 1000
    rows.push({ format: f.id, width: f.width, height: f.height, pageLoadSeconds: load, secondsPerSample: perSample, perPictureFixedSeconds: fixed, outsideDrawSeconds: Math.max(0, whole - b.drawMs / 1000), draftDrawSeconds: a.drawMs / 1000, reviewDrawSeconds: b.drawMs / 1000 })
    console.log(`${f.id}: ${perSample.toFixed(2)} s per sample, page ready in ${load.toFixed(1)} s`)
    await page.context().close()
  }
} finally {
  await session.close()
}

const picture = (row, samples) => samples * row.secondsPerSample + row.perPictureFixedSeconds + row.outsideDrawSeconds
const shakes = cfg.film.shots.filter((s) => s.kind === 'shake').length
const bars = cfg.film.shots.reduce((n, s) => n + s.bars, 0)
const filmSeconds = bars * bar
const stormSeconds = shakes * (bar + 2)
const simFilm = ((stormSeconds + bar + 2) * sim.storm.ms + (filmSeconds - stormSeconds + cfg.states.restSeconds - 2) * sim.atRest.ms) / 1000
const filmFrames = Math.round(filmSeconds * cfg.film.previewFps)
const loopFrames = Math.round(cfg.deliver.cardLoop.seconds * cfg.deliver.cardLoop.fps)
const row = (id) => rows.find((r) => r.format === id)
const jobs = []
for (const [what, frames, format] of [
  ['Film B, preview', filmFrames, cfg.formats.preview.id],
  ['Film B, hd', filmFrames, cfg.formats.hd.id],
  ['Card loop, hd', loopFrames, cfg.formats.hd.id],
]) {
  for (const t of tiers) jobs.push({ what, format, tier: t.id, frames, hours: (frames * picture(row(format), t.samples) + (what.startsWith('Film') ? simFilm : sim.storm.ms / 1000 * cfg.deliver.cardLoop.seconds)) / 3600 })
}

const nproc = spawnSync('nproc', { encoding: 'utf8' }).stdout.trim()
const result = {
  time: new Date().toISOString(),
  machine: machineId(),
  cores: Number(nproc),
  engineHash: session.hash,
  scene,
  fixed: { browserLaunchSeconds: launchSeconds, pageLoadSeconds: pageSeconds, stillReplaySeconds: replaySeconds, stillReplaySimulatedSeconds: bar + cfg.states.restSeconds },
  simulation: { stepHz: cfg.sim.stepHz, secondsPerSimulatedSecond: { storm: sim.storm.ms / 1000, justLanded: sim.landed.ms / 1000, atRest: sim.atRest.ms / 1000 }, floating: { storm: sim.storm.floating, justLanded: sim.landed.floating, atRest: sim.atRest.floating } },
  formats: rows,
  tiers,
  jobs,
}
writeJson(path.join(dir, 'budget.json'), result)

const n = (v, d = 2) => v.toFixed(d)
const md = []
md.push(`Measured ${result.time.slice(0, 16).replace('T', ' ')} UTC on ${result.machine} (${result.cores} cores), software rendering, on the scene of build \`${result.engineHash}\`: ${scene.counts.particles} particles, ${scene.counts.triangles} triangles, ${scene.counts.drawCalls} draw calls a sample, accumulation in ${scene.precision}.`)
md.push('')
md.push('| Format | Size | Seconds per sample | Draft picture (2) | Review picture (8) | Final picture (24) |')
md.push('| --- | --- | --- | --- | --- | --- |')
for (const r of rows) md.push(`| ${r.format} | ${r.width} x ${r.height} | ${n(r.secondsPerSample)} | ${n(picture(r, 2), 1)} s | ${n(picture(r, 8), 1)} s | ${n(picture(r, 24), 1)} s |`)
md.push('')
md.push(`- Fixed cost of starting a render: the browser starts in ${n(launchSeconds, 1)} s and a page is ready in ${n(pageSeconds, 1)} s. The first still of a page also replays the test shake: ${n(replaySeconds, 1)} s for ${n(bar + cfg.states.restSeconds, 1)} simulated seconds without checkpoints.`)
md.push(`- One simulated second at winter's particle count (${scene.counts.particles}, ${cfg.sim.stepHz} steps): ${n(sim.storm.ms / 1000)} s in the storm, ${n(sim.landed.ms / 1000)} s just after the landing, ${n(sim.atRest.ms / 1000)} s at rest.`)
md.push(`- The whole film's simulation, ${n(filmSeconds, 1)} s plus the preroll: about ${n(simFilm / 60, 1)} minutes, once, then read from checkpoints.`)
md.push('')
md.push('| Job | Frames | Draft | Review | Final |')
md.push('| --- | --- | --- | --- | --- |')
for (const what of [...new Set(jobs.map((j) => j.what))]) {
  const js = jobs.filter((j) => j.what === what)
  md.push(`| ${what} | ${js[0].frames} | ${js.map((j) => `${n(j.hours, 1)} h`).join(' | ')} |`)
}
md.push('')
md.push(`These are one render process on this VM. Sandbox VMs have more cores and render ranges in parallel, so a job split across N of them takes about 1/N of its time plus the join.`)
fs.writeFileSync(path.join(dir, 'budget.md'), md.join('\n') + '\n')
console.log(md.join('\n'))
if (args.write === true) {
  const r = spawnSync('node', ['tools/progress.mjs', '--replace', 'Render budget', '--file', path.join(dir, 'budget.md')], { cwd: rel(), encoding: 'utf8' })
  console.log(r.stdout.trim() || r.stderr.trim())
}
