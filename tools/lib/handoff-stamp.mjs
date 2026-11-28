// Makes the stamp of the render handoff and its reference pictures: render/STAMP.json, render/refs and
// render/opening-pack. This is run by the one who releases the film, in the cloud, and never on the machine that
// renders. render/README.md says how. The frames are drawn by tools/shutter-frame.mjs, which draws a frame with the
// count of samples the master tool gives it, and keeps its PNG whole (the master tool keeps none).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { rel, readJson, writeJson, parseArgs } from './paths.mjs'
import { engineHash } from './hashes.mjs'
import * as L from './handoff.mjs'
import { PACK_DIR, PLAN_FILE, REFS_DIR, STAMP_FILE, runTool, readRenderer, readOr, short, mb } from './handoff-work.mjs'
import { validScreenshotSpec } from './handoff-screenshot.mjs'

export const REFS_MOST_BYTES = 40e6
export const FILE_MOST_BYTES = 45e6
const pad6 = (i) => String(i).padStart(6, '0')
const stem = (what, frame) => `${what}-${pad6(frame)}`
const FRAME_LINE = /^(\S+) frame (\d+), .*?: travel ([\d.]+) px, (\d+) samples, ([\d.]+) s .*sha256 ([0-9a-f]{64}), (.+)$/

const git = (args, opts = {}) => {
  const r = spawnSync('git', args, { cwd: rel(), maxBuffer: 1 << 28, windowsHide: true, ...opts })
  if (r.error || r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.error?.message ?? String(r.stderr).trim().split('\n').pop()}`)
  return r.stdout
}

export function planProblems(plan, format) {
  const p = []
  if (!plan || plan.version !== L.STAMP_VERSION) return [`render/PLAN.json is not a plan of version ${L.STAMP_VERSION}`]
  const seen = new Set()
  for (const f of plan.frames ?? []) {
    const id = `${f.what}:${f.frame}`
    if (seen.has(id)) p.push(`${id} is named twice`)
    seen.add(id)
    if (!['film-b', 'loop', 'opening'].includes(f.what) || !Number.isInteger(f.frame) || f.frame < 0) p.push(`${id} is no frame of film-b, loop or opening`)
    for (const b of [...(f.cuts ?? []), ...(f.glass ?? [])]) {
      if (!b.name || ![b.x, b.y, b.w, b.h].every((n) => Number.isInteger(n) && n >= 0) || b.w < 16 || b.h < 16 || b.x + b.w > format.width || b.y + b.h > format.height) p.push(`${id}: the box ${b.name ?? '(no name)'} does not lie inside ${format.width} x ${format.height}`)
    }
    if (f.what !== 'opening' && !(f.glass ?? []).length) p.push(`${id} names no glass region`)
    if (!(f.cuts ?? []).length) p.push(`${id} names no full size cut`)
  }
  if (!(plan.frames ?? []).length) p.push('the plan names no frame')
  for (const k of ['psnrWhole', 'coarseWhole', 'psnrCut', 'coarseCut', 'glassLuma', 'glassWhite']) if (!(plan.floors?.[k] > 0)) p.push(`the plan holds no floor ${k}`)
  if (!validScreenshotSpec(plan.screenshot, format)) p.push('the plan does not name a valid screenshot shape and measured loop floor')
  for (const k of ['film-a', 'film-b']) if (!/^[0-9a-f]{64}$/.test(plan.sound?.[k] ?? '')) p.push(`the plan holds no sha256 for the sound of ${k}`)
  if (!/^[0-9a-f]{40}$/.test(plan.opening?.commit ?? '') || !plan.opening?.path) p.push('the plan does not name the commit and the folder of the opening pack')
  if (!(plan.test?.stretch?.last > plan.test?.stretch?.first)) p.push('the plan names no stretch for the short test')
  return p
}

async function writeLossless(rgb, width, height, file) {
  const sharp = (await import('sharp')).default
  const buf = await sharp(rgb, { raw: { width, height, channels: 3 } }).webp({ lossless: true, effort: 6 }).toBuffer()
  // lossless must mean lossless: the file is decoded again and compared with what went in
  const back = await sharp(buf).removeAlpha().raw().toBuffer()
  if (!back.equals(rgb)) throw new Error(`${short(file)} did not come back the same from its lossless file`)
  fs.writeFileSync(file, buf)
  return { file: path.basename(file), sha256: L.sha256File(file), bytes: buf.length }
}

/** The reference of one frame from its full picture: the half size whole, the full size cuts, the glass regions, and its record. */
async function makeReference(entry, rgb, width, height, facts) {
  fs.mkdirSync(REFS_DIR, { recursive: true })
  const s = stem(entry.what, entry.frame)
  for (const n of fs.readdirSync(REFS_DIR)) if (n.startsWith(`${s}-`) || n === `${s}.json`) fs.rmSync(path.join(REFS_DIR, n))
  const h = L.half(rgb, width, height)
  const half = { ...(await writeLossless(h.data, h.width, h.height, path.join(REFS_DIR, `${s}-half.webp`))), width: h.width, height: h.height }
  const cuts = []
  for (const c of entry.cuts ?? []) cuts.push({ name: c.name, x: c.x, y: c.y, w: c.w, h: c.h, ...(await writeLossless(L.crop(rgb, width, c), c.w, c.h, path.join(REFS_DIR, `${s}-cut-${c.name}.webp`))) })
  const glass = (entry.glass ?? []).map((g) => {
    const st = L.glassStats(rgb, width, g)
    return { name: g.name, x: g.x, y: g.y, w: g.w, h: g.h, meanLuma: Math.round(st.meanLuma * 1e6) / 1e6, nearWhite: Math.round(st.nearWhite * 1e6) / 1e6 }
  })
  const record = { what: entry.what, frame: entry.frame, name: entry.name ?? '', ...facts, half, cuts, glass }
  writeJson(path.join(REFS_DIR, `${s}.json`), record)
  return record
}

const boxesOf = (list) => JSON.stringify((list ?? []).map((b) => [b.name, b.x, b.y, b.w, b.h]))
/** The reference on disk of a frame of the plan, when it was made for this engine and these boxes and its files are whole. */
function keptReference(entry, hash) {
  const r = readOr(path.join(REFS_DIR, `${stem(entry.what, entry.frame)}.json`))
  if (!r || r.engineHash !== hash || boxesOf(r.cuts) !== boxesOf(entry.cuts) || boxesOf(r.glass) !== boxesOf(entry.glass)) return null
  for (const f of [r.half, ...r.cuts]) {
    const file = path.join(REFS_DIR, f.file)
    if (!fs.existsSync(file) || L.sha256File(file) !== f.sha256) return null
  }
  return { ...r, name: entry.name ?? r.name }
}

/** The opening pack's two files, copied out of the commit that holds them. */
function copyPack(plan, say) {
  const { branch, commit, path: dir } = plan.opening
  try {
    git(['cat-file', '-e', `${commit}^{commit}`])
  } catch {
    say(`fetching ${branch} for the opening pack`)
    git(['fetch', 'origin', branch])
    git(['cat-file', '-e', `${commit}^{commit}`])
  }
  fs.mkdirSync(PACK_DIR, { recursive: true })
  const files = {}
  for (const name of ['opening.bin', 'manifest.json']) {
    const bytes = git(['show', `${commit}:${dir}/${name}`])
    const to = path.join(PACK_DIR, name)
    if (!fs.existsSync(to) || !fs.readFileSync(to).equals(bytes)) fs.writeFileSync(to, bytes)
    files[name] = L.sha256File(to)
  }
  return files
}

export async function stamp(argv, say = console.log) {
  const args = parseArgs(argv)
  const { cfg, formatById, currentSeasonHashes, Session } = await import('./page.mjs')
  const { Run } = await import('./frames.mjs')
  const { pieceCounts, sampleRule, tierOf } = await import('./master.mjs')
  const { openPack } = await import('./openingpack.mjs')
  const sharp = (await import('sharp')).default
  const format = formatById(cfg.deliver.master.format)
  const plan = readOr(PLAN_FILE)
  const bad = planProblems(plan, format)
  if (bad.length) return { pass: false, why: `the plan is not whole: ${bad.join('; ')}` }
  const hash = engineHash()
  const built = readOr(rel('dist', 'build.json'))
  if (built?.engineHash !== hash) return { pass: false, why: `the build is not made for engine ${hash}. Run npm run build first` }
  const only = typeof args.only === 'string' ? args.only.split(',').filter(Boolean) : null
  const unknown = (only ?? []).filter((id) => !plan.frames.some((f) => `${f.what}:${f.frame}` === id))
  if (unknown.length) return { pass: false, why: `--only names ${unknown.join(', ')}, and the plan has no such frame` }
  const released = args.released === 'true'
  if (args.released !== undefined && !['true', 'false'].includes(String(args.released))) return { pass: false, why: '--released takes true or false' }
  const local = args.local === true
  const ctx = { say, note: () => {}, T: {}, H: rel('out', 'work', 'handoff') }
  const work = rel('out', 'work', 'handoff', 'stamp-frames')

  const packFiles = copyPack(plan, say)
  say(`the opening pack is in ${short(PACK_DIR)}: opening.bin ${packFiles['opening.bin'].slice(0, 12)}, manifest.json ${packFiles['manifest.json'].slice(0, 12)}`)
  const pack = await openPack(PACK_DIR)
  if (pack.width !== format.width || pack.height !== format.height) return { pass: false, why: `the opening pack is ${pack.width} x ${pack.height}, not ${format.width} x ${format.height}` }

  // the frames: those kept for this engine stay, the others are drawn (or left to another helper by --only)
  const references = []
  const missing = []
  let seen = null
  for (const what of ['film-b', 'loop']) {
    const list = plan.frames.filter((f) => f.what === what)
    const todo = []
    for (const entry of list) {
      const kept = args.again === true && (!only || only.includes(`${what}:${entry.frame}`)) ? null : keptReference(entry, hash)
      if (kept) references.push(kept)
      else if (only && !only.includes(`${what}:${entry.frame}`)) missing.push(`${what}:${entry.frame}`)
      else todo.push(entry)
    }
    if (!todo.length) continue
    // a full picture drawn before for this engine is used again; the rest are drawn now
    const have = new Map()
    for (const entry of todo) {
      const rec = readOr(path.join(work, `${stem(what, entry.frame)}.json`))
      if (rec?.engineHash === hash && fs.existsSync(path.join(work, rec.file)) && L.sha256File(path.join(work, rec.file)) === rec.sha256) have.set(entry.frame, rec)
    }
    const draw = todo.filter((e) => !have.has(e.frame))
    if (draw.length) {
      seen ??= await readRenderer({ local })
      say(`drawing ${what} ${draw.length === 1 ? 'frame' : 'frames'} ${draw.map((e) => e.frame).join(', ')} at ${format.width} x ${format.height} as the masters draw them`)
      const r = await runTool(ctx, 'shutter-frame.mjs', ['--what', what, '--frames', draw.map((e) => e.frame).join(','), '--out', short(work), ...(local ? ['--local'] : [])], (l) => {
        const m = FRAME_LINE.exec(l)
        if (!m) return
        const rec = { what, frame: Number(m[2]), engineHash: hash, travelPx: Number(m[3]), samples: Number(m[4]), seconds: Number(m[5]), sha256: m[6], file: path.basename(m[7]), renderer: seen.renderer, browser: seen.browser }
        writeJson(path.join(work, `${stem(what, rec.frame)}.json`), rec)
        have.set(rec.frame, rec)
        say(`drawn: ${what} frame ${rec.frame}, ${rec.samples} samples, ${rec.seconds} s`)
      })
      if (r.code !== 0) return { pass: false, why: `the frames of ${what} could not be drawn: ${r.tail.slice(-3).join(' / ')}` }
    }
    for (const entry of todo) {
      const rec = have.get(entry.frame)
      if (!rec) return { pass: false, why: `${what} frame ${entry.frame} was not drawn` }
      const { data, info } = await sharp(path.join(work, rec.file)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      if (info.width !== format.width || info.height !== format.height) return { pass: false, why: `${rec.file} is ${info.width} x ${info.height}` }
      const flat = L.pictureProblem(data, info.width, info.height)
      if (flat) return { pass: false, why: `${what} frame ${entry.frame}: ${flat}` }
      references.push(await makeReference(entry, data, info.width, info.height, { engineHash: hash, samples: rec.samples, travelPx: rec.travelPx, seconds: rec.seconds, png: { sha256: rec.sha256, bytes: fs.statSync(path.join(work, rec.file)).size }, renderer: rec.renderer, browser: rec.browser }))
    }
  }
  for (const entry of plan.frames.filter((f) => f.what === 'opening')) {
    if (entry.frame >= pack.frameCount) return { pass: false, why: `the opening has frames 0 to ${pack.frameCount - 1}, and the plan names ${entry.frame}` }
    const kept = keptReference(entry, hash)
    if (kept && kept.pack === packFiles['opening.bin']) references.push(kept)
    else references.push(await makeReference(entry, await pack.frame(entry.frame), pack.width, pack.height, { engineHash: hash, samples: 0, pack: packFiles['opening.bin'], renderer: 'none: read from the opening pack, never drawn', browser: '' }))
  }
  const order = (r) => plan.frames.findIndex((f) => f.what === r.what && f.frame === r.frame)
  references.sort((a, b) => order(a) - order(b))

  // --proof writes a stamp that holds only the references made so far. It names what is still to draw, it can never be
  // released, and the full render refuses it by name. It is for proving the tools before the film is frozen.
  const proof = args.proof === true
  if (missing.length && released) return { pass: false, why: `a stamp can be released only when every frame of the plan has its reference, and ${missing.join(', ')} are still to draw` }
  if (missing.length && !proof) {
    return { pass: true, partial: true, why: `${references.length} of the plan's ${plan.frames.length} references are made for engine ${hash}; ${missing.join(', ')} are still to draw, so render/STAMP.json was not written. Bring the files of ${short(REFS_DIR)} together and run the stamp again` }
  }

  // references no plan names any more leave the folder
  const wanted = new Set(references.flatMap((r) => [`${stem(r.what, r.frame)}.json`, r.half.file, ...r.cuts.map((c) => c.file)]))
  for (const n of fs.readdirSync(REFS_DIR)) if (!wanted.has(n)) fs.rmSync(path.join(REFS_DIR, n))
  const sizes = [...wanted].map((n) => fs.statSync(path.join(REFS_DIR, n)).size)
  const total = sizes.reduce((a, b) => a + b, 0)
  if (total > REFS_MOST_BYTES) return { pass: false, why: `the references are ${mb(total)}, over the ${mb(REFS_MOST_BYTES)} they may be in all. Take a cut out of the plan` }
  const big = [PACK_DIR, REFS_DIR].flatMap((d) => fs.readdirSync(d).map((n) => path.join(d, n))).find((f) => fs.statSync(f).size > FILE_MOST_BYTES)
  if (big) return { pass: false, why: `${short(big)} is over ${mb(FILE_MOST_BYTES)}` }

  // the count of samples of every frame, for the projection of the short test
  say('reading the count of samples of every frame')
  const samples = {}
  const session = await Session.open({ local, what: 'handoff stamp', say })
  try {
    const run = new Run(session, { by: 'handoff', looks: false, say })
    for (const what of ['film-b', 'loop']) {
      const rule = sampleRule(what)
      const track = { kind: what === 'loop' ? 'loop' : 'film', name: what, format, tier: tierOf(rule.base), assets: 'full', fps: cfg.film.fps, step: 1 }
      const page = await run.page(track)
      const p = await run.plan(track)
      const has = track.kind === 'loop' ? p.loop : p.film.frameCount
      const got = await page.evaluate(([k, n, t]) => Array.from({ length: n }, (_, i) => window.showcase.dev.frameSamples(k, i, t)), [track.kind, has, rule.tier])
      samples[what] = L.runsOf(pieceCounts(rule, got, track.kind === 'loop').counts)
    }
  } finally {
    await session.close().catch(() => {})
  }
  const count = (runs) => runs.reduce((n, [, k]) => n + k, 0)
  const frames = { 'film-b': count(samples['film-b']), loop: count(samples.loop), opening: pack.frameCount }
  frames['film-a'] = frames.opening + frames['film-b']
  const engineRefs = references.filter((r) => r.what !== 'opening')
  for (const r of engineRefs) {
    const want = L.countsOf(samples[r.what])[r.frame]
    if (want !== r.samples) return { pass: false, why: `${r.what} frame ${r.frame} was drawn with ${r.samples} samples and the rule now gives it ${want}. Run the stamp with --again` }
  }
  const rule = sampleRule('film-b')
  const out = {
    version: L.STAMP_VERSION,
    title: L.TITLE,
    about: 'The stamp of the render handoff: what the film is, what it was checked against and whether it may be rendered. Made by node tools/handoff.mjs stamp; see render/README.md. Do not edit by hand.',
    releasedForFinalRender: released,
    stillToDraw: missing,
    engineHash: hash,
    commit: String(git(['rev-parse', 'HEAD'])).trim(),
    made: new Date().toISOString(),
    seasonHashes: currentSeasonHashes(),
    format: { id: format.id, width: format.width, height: format.height, fps: cfg.film.fps },
    tier: { name: "the masters' tier", samples: rule.base, slow: cfg.deliver.master.slow ?? null, motion: cfg.tiers.final.motion ?? null, chunkFrames: cfg.deliver.master.chunkFrames },
    frames,
    drawnBy: { renderer: [...new Set(engineRefs.map((r) => r.renderer))].join(' | '), browser: [...new Set(engineRefs.map((r) => r.browser))].join(' | ') },
    measures: { half: L.HALF_FILTER, coarse: L.COARSE_MEASURE, glass: L.GLASS_MEASURE, files: 'lossless WebP, each decoded again and compared when it was written' },
    floors: plan.floors,
    floorsFrom: plan.floorsFrom ?? '',
    screenshot: plan.screenshot,
    references,
    test: plan.test,
    opening: { branch: plan.opening.branch, commit: plan.opening.commit, path: plan.opening.path, folder: short(PACK_DIR), frames: pack.frameCount, files: packFiles },
    sound: plan.sound,
    delivery: { folder: L.deliveryFolder(false), names: L.deliveryNames(format.width, format.height), test: L.testFilmName(format.width, format.height) },
    video: cfg.deliver.master.video,
    samples,
    disk: plan.disk,
  }
  const problems = L.stampProblems(out)
  if (problems.length) return { pass: false, why: `the stamp would not be whole: ${problems.join('; ')}` }
  writeJson(STAMP_FILE, out)
  return { pass: true, why: `render/STAMP.json is written for engine ${hash}: ${references.length} references (${mb(total)}), the opening pack, releasedForFinalRender ${released}${missing.length ? `. It is a proof stamp: ${missing.join(', ')} are still to draw, and the full render refuses it` : ''}` }
}
