import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, checkDisk, recordMatches } from './lib/page.mjs'
import { fileSha } from './lib/hashes.mjs'
import { psnr } from './lib/compose.mjs'
import { Run, argText, makeTrack, short } from './lib/frames.mjs'
import { encodeFrames, framePicture, haveFfmpeg, probe, stillJpeg } from './lib/encode.mjs'

const args = parseArgs(process.argv.slice(2))
const tier = argText(args, 'tier', 'draft')
const assets = argText(args, 'assets', 'full')
const only = argText(args, 'shot', '')
const formatId = cfg.formats.hd.id
const fps = cfg.film.previewFps
const rates = [cfg.export.bitrateMbps, cfg.quality.compressionStressMbps]
const SECONDS = 0.5
const count = Math.round(fps * SECONDS)
const dir = rel('out', 'work', 'stress')
const say = console.log
if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')

const track = makeTrack({ kind: 'film', name: 'stress', dir, format: formatId, tier, assets, fps })
const want = { seasons: cfg.seasons, format: formatId, tier }

function moments(film) {
  const mid = (a, b) => Math.round((a + b) / 2)
  const swaps = new Map((film.swaps ?? []).map((s) => [s.id ?? s.shot, s]))
  const landings = new Set(film.landings ?? [])
  const shakes = film.shots.filter((s) => landings.has(s.last + 1))
  const holds = film.shots.filter((s) => !shakes.includes(s))
  if (holds.length < 2 || shakes.length < 2) throw new Error(`the film holds ${holds.length} holds and ${shakes.length} shakes, and the stress test needs two of each`)
  const pick = [
    { kind: 'hold', shot: holds[0] },
    { kind: 'hold', shot: holds[Math.max(1, holds.length - 2)] },
    { kind: 'shake', shot: shakes[0] },
    { kind: 'shake', shot: shakes[shakes.length - 1] },
  ]
  return pick.map(({ kind, shot }) => {
    const swap = swaps.get(shot.id)
    const centre = kind === 'shake' && swap ? mid(swap.first, swap.last) : mid(shot.first, shot.last)
    const a = Math.max(shot.first, centre - Math.floor(count / 2) * track.step)
    const first = Math.ceil(a / track.step) * track.step
    const frames = Array.from({ length: count }, (_, k) => first + k * track.step).filter((i) => i <= shot.last)
    return { id: shot.id, kind, frames, at: frames[Math.floor(frames.length / 2)] }
  })
}

const names = (m) => {
  const base = path.join(dir, `${m.id}-${m.frames[0]}-${m.frames[m.frames.length - 1]}`)
  return { base, source: `${base}-frame-${m.at}-source.jpg`, videos: rates.map((r) => `${base}-${r}mbps.${track.settings.container}`), stills: rates.map((r) => `${base}-frame-${m.at}-${r}mbps.jpg`), record: `${base}-frame-${m.at}-source.jpg.json` }
}

const fresh = (m) => {
  const n = names(m)
  return [n.source, ...n.videos, ...n.stills].every((f) => recordMatches(f, want))
}

async function toJpeg(png, out) {
  await sharp(png).removeAlpha().jpeg(stillJpeg).toFile(out)
}

async function measure(m, run, page) {
  const n = names(m)
  const frames = path.join(rel('out', 'work', 'frames'), `stress-${m.id}`)
  fs.rmSync(frames, { recursive: true, force: true })
  fs.mkdirSync(frames, { recursive: true })
  const t0 = Date.now()
  const files = []
  for (const index of m.frames) {
    const f = path.join(frames, `${String(index).padStart(6, '0')}.png`)
    fs.writeFileSync(f, await run.frame(track, page, index))
    files.push(f)
  }
  const secondsPerFrame = (Date.now() - t0) / 1000 / files.length
  const nth = m.frames.indexOf(m.at)
  const sourcePng = files[nth]
  const encodes = []
  for (const [k, mbps] of rates.entries()) {
    const out = n.videos[k]
    await encodeFrames({ files, settings: { ...track.settings, mbps }, out: `${out}.new` })
    const seen = probe(`${out}.new`)
    if (seen.frames !== files.length) throw new Error(`${short(out)} holds ${seen.frames} frames, not ${files.length}`)
    fs.renameSync(`${out}.new`, out)
    const png = path.join(frames, `decoded-${mbps}.png`)
    await framePicture({ file: out, n: nth, out: png })
    const q = await psnr(sourcePng, png)
    await toJpeg(png, n.stills[k])
    encodes.push({ mbps, file: short(out), still: short(n.stills[k]), sha256: fileSha(out), probe: seen, psnr: q.psnr, maxDiff: q.maxDiff })
  }
  await toJpeg(sourcePng, n.source)
  const info = await page.evaluate(() => window.showcase.info())
  const record = run.session.record(info, { kind: 'stress', shot: m.id, moment: m.kind, first: m.frames[0], last: m.frames[m.frames.length - 1], frame: m.at, fps, frames: files.length, secondsPerFrame, source: short(n.source), encodes })
  record.tier = tier
  for (const f of [n.source, ...n.videos, ...n.stills]) writeJson(`${f}.json`, record)
  fs.rmSync(frames, { recursive: true, force: true })
  if (run.looks) run.look(track, m.at, n.stills[rates.length - 1])
  return record
}

checkDisk()
const session = await Session.open()
const run = new Run(session, { by: argText(args, 'by', 'builder'), looks: args.look !== 'no' })
const rows = []
try {
  const plan = await run.plan(track)
  const all = moments(plan.film)
  const list = only ? all.filter((m) => m.id === only) : all
  if (!list.length) throw new Error(`--shot ${only} is not one of the stress moments: ${all.map((m) => m.id).join(', ')}`)
  say(`stress: ${list.map((m) => `${m.id} ${m.frames[0]}-${m.frames[m.frames.length - 1]}`).join(', ')}; ${count} frames each, ${formatId}, ${tier}, at ${rates.join(' and ')} Mbps`)
  const page = await run.page(track)
  for (const m of list) {
    const reuse = fresh(m)
    const record = reuse ? readJson(names(m).record) : await measure(m, run, page)
    rows.push(record)
    const [hi, lo] = record.encodes
    say(`${m.kind} ${m.id}, frame ${record.frame}${reuse ? ', reused' : `, ${record.secondsPerFrame.toFixed(2)} s a frame`}: ${hi.mbps} Mbps ${hi.psnr.toFixed(1)} dB (${hi.probe.mbps.toFixed(1)} Mbps in the file), ${lo.mbps} Mbps ${lo.psnr.toFixed(1)} dB (${lo.probe.mbps.toFixed(1)} Mbps in the file), a loss of ${(hi.psnr - lo.psnr).toFixed(1)} dB`)
  }
  const done = all.every((m) => fresh(m))
  const summary = { engineHash: rows[0].engineHash, seasonHashes: rows[0].seasonHashes, format: formatId, tier, assets: rows[0].assets, time: new Date().toISOString(), complete: done, rates, moments: all.filter((m) => fresh(m)).map((m) => readJson(names(m).record)).map((r) => ({ shot: r.shot, moment: r.moment, frame: r.frame, first: r.first, last: r.last, source: r.source, encodes: r.encodes.map((e) => ({ mbps: e.mbps, file: e.file, still: e.still, psnr: e.psnr, maxDiff: e.maxDiff, fileMbps: e.probe.mbps })) })) }
  writeJson(path.join(dir, 'stress.json'), summary)
  say(`stills and encodes are in ${short(dir)}, the numbers in ${short(path.join(dir, 'stress.json'))}${done ? '' : '. Not every moment is there yet: run it again without --shot'}`)
} finally {
  await run.close()
  await session.close()
  if (run.errors.length) say(`page messages:\n${run.errors.slice(0, 10).join('\n')}`)
}
