import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, writeJson } from './lib/paths.mjs'
import { Session, cfg, stillSpec, renderStill, writeWithRecord } from './lib/page.mjs'
import { compareFiles } from './lib/pixels.mjs'

const args = parseArgs(process.argv.slice(2))
const format = args.format && args.format !== true ? String(args.format) : cfg.formats.preview.id
const tier = args.tier && args.tier !== true ? String(args.tier) : 'draft'
const season = args.season && args.season !== true ? String(args.season) : cfg.defaultSeason
const withFilm = args.film === true
const dir = rel('out', 'work', 'determinism')
fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(dir, { recursive: true })

const session = await Session.open({ what: 'determinism' })
const names = []
const jobs = {}
for (const state of ['landed', 'rest', 'settled']) {
  const name = `still-${state}`
  names.push(name)
  jobs[name] = async (page, file) => {
    await renderStill(session, stillSpec({ season, state, camera: 'hero', tier, format }), { file, force: true, page })
  }
}
if (withFilm) {
  const probe = await session.page({ format, simcache: true })
  const film = await probe.evaluate(() => ({ film: window.showcase.film().frameCount, loop: window.showcase.loop().frameCount }))
  await probe.context().close()
  const step = cfg.film.fps / cfg.film.previewFps
  const late = Math.floor((film.film * 0.9) / step) * step
  const loopStep = cfg.film.fps / cfg.deliver.cardLoop.fps
  const loopAt = Math.floor((film.loop * 0.6) / loopStep) * loopStep
  const frame = (call, index) => async (page, file) => {
    const info = await page.evaluate(async ([c, i, t]) => {
      await window.showcase[c](i, t)
      return window.showcase.info()
    }, [call, index, tier])
    writeWithRecord(file, await session.grab(page), session.record(info, { call, index }))
  }
  names.push(`film-${late}`, `loop-${loopAt}`)
  jobs[`film-${late}`] = frame('renderFilmFrame', late)
  jobs[`loop-${loopAt}`] = frame('renderLoopFrame', loopAt)
}

const rotate = (list, n) => list.map((_, i) => list[(i + n) % list.length])
const passes = [
  { id: 'a', order: names, simcache: false, what: 'a fresh page, checkpoints off' },
  { id: 'b', order: [...names].reverse(), simcache: false, what: 'a fresh page, the reverse order, checkpoints off' },
  { id: 'c', order: rotate(names, 1), simcache: true, what: 'a fresh page, another order, checkpoints written' },
  { id: 'd', order: rotate(names, 2), simcache: true, what: 'a fresh page, another order, checkpoints read back' },
]

const t0 = Date.now()
const errors = []
try {
  for (const pass of passes) {
    const page = await session.page({ format, simcache: pass.simcache })
    for (const name of pass.order) {
      const s = Date.now()
      await jobs[name](page, path.join(dir, `${pass.id}-${name}.png`))
      console.log(`pass ${pass.id}: ${name} in ${((Date.now() - s) / 1000).toFixed(1)} s`)
    }
    errors.push(...page.errors)
    await page.context().close()
  }
} finally {
  await session.close()
}

const pictures = []
for (const name of names) {
  for (const pass of passes.slice(1)) {
    const d = await compareFiles(path.join(dir, `a-${name}.png`), path.join(dir, `${pass.id}-${name}.png`))
    pictures.push({ picture: name, pass: pass.id, against: 'a', identical: d.identical, differing: d.differing, maxDiff: d.maxDiff })
  }
}
const ok = pictures.every((p) => p.identical) && errors.length === 0
const result = {
  pass: ok,
  engineHash: session.hash,
  format,
  tier,
  season,
  film: withFilm,
  passes: passes.map((p) => ({ id: p.id, what: p.what, order: p.order })),
  pictures,
  pageErrors: errors.slice(0, 20),
  seconds: (Date.now() - t0) / 1000,
  time: new Date().toISOString(),
}
writeJson(path.join(dir, 'result.json'), result)
for (const p of pictures) console.log(`${p.identical ? 'identical' : 'DIFFERENT'}: ${p.picture}, pass ${p.pass} against pass a${p.identical ? '' : ` (${p.differing} pixels differ, largest difference ${p.maxDiff})`}`)
if (errors.length) console.log(`page messages:\n${errors.slice(0, 10).join('\n')}`)
console.log(`determinism: ${ok ? 'pass' : 'FAIL'} · ${names.length} pictures, ${passes.length} page loads, ${format}, ${tier}, ${result.seconds.toFixed(0)} s`)
process.exit(ok ? 0 : 1)
