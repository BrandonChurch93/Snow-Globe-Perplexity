import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, checkDisk, formatById } from './lib/page.mjs'
import { fileSha } from './lib/hashes.mjs'
import { machineId } from './lib/browser.mjs'
import { Run, argFrame, argText, chunkRecord, coverNotes, coverOf, joinCovers, keptFrame, makeTrack, planChunks, short } from './lib/frames.mjs'
import { framePicture, haveFfmpeg, probe, probeLine, scaleCopy, stillJpeg, videoSettings } from './lib/encode.mjs'

const args = parseArgs(process.argv.slice(2))
const card = cfg.deliver.cardLoop
const tier = argText(args, 'tier', 'draft')
const formatId = argText(args, 'format', card.format)
const assets = argText(args, 'assets', 'full')
const fps = card.fps
const first = argFrame(args, 'first')
const last = argFrame(args, 'last')
const ranged = first !== null || last !== null
const dir = rel('out', 'work', 'loop')
const say = console.log
if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')

const track = makeTrack({ kind: 'loop', name: 'loop', dir: path.join(dir, `${formatId}-${tier}`), format: formatId, tier, assets, fps, keep: [0] })
const named = (name, whole) => path.join(dir, whole ? name : name.replace(/(\.[a-z0-9]+)$/i, '-partial$1'))

async function render() {
  const session = await Session.open()
  const run = new Run(session, { by: argText(args, 'by', 'builder'), looks: args.look !== 'no' })
  try {
    const plan = await run.plan(track)
    const end = plan.loop - 1
    const sh = plan.loopPlan?.shake
    let spans = sh ? [{ id: 'rest', first: 0, last: sh.first - 1 }, { id: 'shake', first: sh.first, last: sh.landing - 1 }, { id: 'settle', first: sh.landing, last: end }] : [{ id: 'loop', first: 0, last: end }]
    if (ranged) spans = [{ id: 'range', first: first ?? 0, last: Math.min(last ?? end, end) }]
    const chunks = planChunks(track, spans.filter((s) => s.first <= s.last))
    if (!chunks.length) throw new Error('that range holds no frame to render')
    say(`card loop: ${chunks.length} ${chunks.length === 1 ? 'chunk' : 'chunks'}, ${formatId}, ${tier}, ${fps} frames a second, ${track.settings.codec} at ${track.settings.mbps} Mbps`)
    await run.renderChunks(track, chunks, plan.loop)
    if (run.rendered) say(`rendered ${run.rendered} frames at ${run.perFrame().toFixed(2)} s a frame`)
  } finally {
    await run.close()
    await session.close()
    if (run.errors.length) say(`page messages:\n${run.errors.slice(0, 10).join('\n')}`)
  }
}

async function writeStill(cover, loop, whole) {
  const out = named(cfg.export.files.cardStill, whole)
  if (cover.first !== 0) {
    say('no card still: frame 0 is not among the joined chunks')
    return
  }
  const kept = keptFrame(track, 0)
  const rendered = chunkRecord(kept, track)
  const src = rendered ? kept : path.join(dir, `${formatId}-${tier}`, 'frame-0-from-loop.png')
  if (!rendered) await framePicture({ file: loop.file, n: 0, out: src })
  const img = sharp(src).removeAlpha()
  if (/\.png$/i.test(out)) await img.png({ compressionLevel: 9 }).toFile(out)
  else await img.jpeg(stillJpeg).toFile(out)
  const meta = await sharp(out).metadata()
  const base = rendered ?? loop.record
  writeJson(`${out}.json`, { engineHash: base.engineHash, seasonHashes: base.seasonHashes, format: base.format, tier: base.tier, assets: base.assets, diagnostic: '', browser: base.browser, graphics: base.graphics, machine: base.machine, time: new Date().toISOString(), frame: 0, from: rendered ? `${short(kept)}, the frame as it was rendered` : `${short(loop.file)}, the first frame after encoding`, width: meta.width, height: meta.height, sha256: fileSha(out) })
  if (!rendered) fs.rmSync(src, { force: true })
  say(`card still ${short(out)}: frame 0, ${meta.width} x ${meta.height}, ${rendered ? 'from the frame as it was rendered' : 'from the encoded loop, because the rendered frame 0 is not on this machine'}`)
}

async function joinLoop() {
  checkDisk()
  const cover = coverOf(track)
  coverNotes(cover, track, say)
  const whole = cover.complete
  const out = named(cfg.export.files.cardLoop, whole)
  const loop = await joinCovers({ covers: [cover], out, container: cfg.export.container, fps, extra: { loop: true, complete: whole } })
  say(`joined ${loop.record.chunks.length} ${loop.record.chunks.length === 1 ? 'chunk' : 'chunks'} into ${short(out)}${whole ? '' : ', which is not the whole loop'}`)
  say(`ffprobe: ${probeLine(loop.probe)}`)

  const f = formatById(formatId)
  const width = Math.min(card.webWidth, f.width)
  const web = { id: 'web', width, height: Math.round((width * f.height) / f.width / 2) * 2 }
  const settings = videoSettings({ format: web, fps, mbps: card.webBitrateMbps })
  const webOut = named(cfg.export.files.cardLoopWeb, whole)
  await scaleCopy({ src: out, settings, out: `${webOut}.new` })
  const seen = probe(`${webOut}.new`)
  if (seen.frames !== loop.record.frames) {
    fs.rmSync(`${webOut}.new`, { force: true })
    throw new Error(`the web copy holds ${seen.frames} frames, the loop holds ${loop.record.frames}`)
  }
  const sha256 = fileSha(`${webOut}.new`)
  fs.renameSync(`${webOut}.new`, webOut)
  writeJson(`${webOut}.json`, { ...readJson(`${out}.json`), time: new Date().toISOString(), joinedOn: machineId(), scaledFrom: { file: short(out), sha256: loop.record.sha256 }, codec: settings.codec, mbps: settings.mbps, probe: seen, sha256 })
  say(`web copy ${short(webOut)}`)
  say(`ffprobe: ${probeLine(seen)}`)
  await writeStill(cover, loop, whole)
}

if (ranged || args.join !== true) await render()
if (!ranged || args.join === true) await joinLoop()
else say(`chunks are in ${short(track.dir)}. Add --join to join the chunks that exist.`)
