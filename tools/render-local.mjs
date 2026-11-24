import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, checkDisk, renderStill, stillSpec } from './lib/page.mjs'
import { engineHash, fileSha } from './lib/hashes.mjs'
import { freeDiskGb, machineId } from './lib/browser.mjs'
import { psnr, sideBySide } from './lib/compose.mjs'
import { Run, argText, chunkRecord, coverNotes, coverOf, joinCovers, keptFrame, makeTrack, minutes, pickSound, planChunks, short, soundStart } from './lib/frames.mjs'
import { framePicture, haveFfmpeg, probe, probeLine, stillJpeg } from './lib/encode.mjs'

const args = parseArgs(process.argv.slice(2))
const modes = ['test', 'go', 'proof'].filter((m) => args[m] === true)
const say = console.log
const USAGE = 'Use one of: --what film-b|film-a|loop --test, --what film-b|film-a|loop --go, --proof. Add --rehearse to --test or --go to run it small, with software graphics.'
if (modes.length !== 1) {
  say(USAGE)
  process.exit(modes.length ? 1 : 0)
}
const mode = modes[0]
const what = argText(args, 'what', 'film-b')
if (!['film-b', 'film-a', 'loop'].includes(what)) throw new Error(`--what takes film-b, film-a or loop. ${USAGE}`)
if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found. On a Mac: brew install ffmpeg')

const proof = mode === 'proof'
const rehearse = !proof && args.rehearse === true
const small = proof || rehearse
const fps = cfg.film.fps
const formatId = small ? cfg.formats.preview.id : cfg.formats.master.id
const tier = small ? 'draft' : 'final'
const container = cfg.export.local.container
const dir = rehearse ? rel('out', 'work', 'local', 'rehearsal') : rel('out', 'work', 'local')
const named = (base) => path.join(dir, `${base.replace(/\.[a-z0-9]+$/i, '')}.${container}`)
const SOFTWARE = /swiftshader|llvmpipe|software|basic render/i

const track = (kind) => {
  const name = kind === 'film' ? 'film-b' : kind === 'opening' ? 'film-a' : 'loop'
  return makeTrack({ kind, name: `local-${name}`, dir: path.join(dir, `${name}-${formatId}-${tier}`), format: formatId, tier, assets: 'full', fps, local: true, graphics: !small, keep: kind === 'loop' ? [0] : [] })
}
const body = track('film')
const opening = track('opening')
const loop = track('loop')

const finalMix = (w) => pickSound([rel('audio', 'final', `film-${w}.wav`)])
const soundLine = (sound, w, why = '') => (sound ? `sound: ${short(sound.file)}` : `sound: none, the result is silent (${why || `audio/final/ holds no film-${w}.wav`})`)

async function open() {
  let session
  if (small) session = await Session.open()
  else {
    try {
      session = await Session.open({ local: true })
    } catch (e) {
      if (!/chrome|executable|browser|channel/i.test(String(e.message))) throw e
      const why = String(e.message).split('\n')[0]
      if (cfg.deliver.sandboxMaster !== true) {
        say(`The installed Chrome could not be started (${why}). This tool never downloads a browser, and no master is rendered with software graphics unless deliver.sandboxMaster is true. Install Google Chrome on a computer with a graphics card and run it there. The proof for this workspace is --proof.`)
        return null
      }
      say(`the installed Chrome could not be started (${why}). deliver.sandboxMaster is true, so the master is rendered with software graphics`)
      for (const t of [body, opening, loop]) t.graphics = false
      session = await Session.open()
    }
  }
  const run = new Run(session, { by: argText(args, 'by', 'builder'), looks: small ? args.look !== 'no' : args.look === 'yes' })
  return { session, run }
}

async function card(run) {
  const page = await run.page(body)
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'no WebGL'
  })
}

async function masterAllowed(run) {
  if (small) return true
  const name = await card(run)
  say(`graphics: ${name}`)
  if (SOFTWARE.test(name) && cfg.deliver.sandboxMaster !== true) {
    say('This machine draws with software graphics, so no master is rendered on it (deliver.sandboxMaster is not true). Run this on a computer with a graphics card. The proof for this workspace is --proof.')
    return false
  }
  if (SOFTWARE.test(name)) for (const t of [body, opening, loop]) t.graphics = false
  return true
}

function wanted(plan) {
  const cut = rel('cut', 'CUTLIST.json')
  const bars = cfg.film.shots.reduce((n, s) => n + s.bars, 0)
  const seconds = fs.existsSync(cut) ? readJson(cut).seconds : (bars * cfg.film.beatsPerBar * 60) / cfg.film.defaultBpm
  const from = fs.existsSync(cut) ? 'cut/CUTLIST.json' : 'the default grid'
  return {
    film: { frames: Math.round(seconds * fps), seconds, from, has: plan.film.frameCount, name: 'film B' },
    loop: { frames: Math.round(cfg.deliver.cardLoop.seconds * fps), seconds: cfg.deliver.cardLoop.seconds, from: 'deliver.cardLoop.seconds', has: plan.loop, name: 'the card loop' },
    opening: { frames: plan.openingPlan?.frameCount ?? plan.opening, seconds: (plan.openingPlan?.frameCount ?? plan.opening) / fps, from: 'the opening plan', has: plan.opening, name: "film A's opening" },
  }
}

function checkCount(w) {
  if (w.has !== w.frames) throw new Error(`${w.name} holds ${w.has} frames, and ${w.seconds} s from ${w.from} at ${fps} frames a second is ${w.frames}. Nothing was rendered.`)
  say(`${w.name}: ${w.has} frames, which is ${w.seconds} s from ${w.from} at ${fps} frames a second`)
}

const windowAround = (centre, count, total) => {
  const first = Math.max(0, Math.min(centre - Math.floor(count / 2), total - count))
  return { first, last: Math.min(total - 1, first + count - 1) }
}

function diskFor(t, made, left) {
  if (!left || !made.record.frames) return
  const need = ((made.record.bytes / made.record.frames) * left * 2) / 1024 ** 3
  const free = freeDiskGb()
  if (need > free) throw new Error(`the rest of ${t.name} needs about ${need.toFixed(0)} GB for its chunks and the joined file, and ${free.toFixed(0)} GB is free. Free some disk and run it again: it carries on where it stopped.`)
}

async function renderSpans(run, t, spans, total) {
  const chunks = planChunks(t, spans)
  say(`${t.name}: ${chunks.length} ${chunks.length === 1 ? 'chunk' : 'chunks'} of at most ${t.maxFrames} frames, ${t.format.id}, ${t.tier}, ${fps} frames a second, ${t.settings.codec}`)
  let checked = false
  await run.renderChunks(t, chunks, total, (made) => {
    if (checked) return
    checked = true
    diskFor(t, made, run.pending)
  })
}

async function joinTo({ covers, out, sound, extra }) {
  const r = await joinCovers({ covers, out, container, fps, sound, extra })
  say(`joined ${r.record.chunks.length} ${r.record.chunks.length === 1 ? 'chunk' : 'chunks'} into ${short(out)}`)
  say(`ffprobe: ${probeLine(r.probe)}`)
  return r
}

async function cardStill(out, joined) {
  const kept = keptFrame(loop, 0)
  const rendered = chunkRecord(kept, loop)
  const src = rendered ? kept : path.join(loop.dir, 'frame-0-from-loop.png')
  if (!rendered) await framePicture({ file: joined.file, n: 0, out: src })
  await sharp(src).removeAlpha().jpeg(stillJpeg).toFile(out)
  const base = rendered ?? joined.record
  writeJson(`${out}.json`, { engineHash: base.engineHash, seasonHashes: base.seasonHashes, format: base.format, tier: base.tier, assets: base.assets, diagnostic: '', browser: base.browser, graphics: base.graphics, machine: base.machine, time: new Date().toISOString(), frame: 0, from: rendered ? `${short(kept)}, the frame as it was rendered` : `${short(joined.file)}, the first frame after encoding`, sha256: fileSha(out) })
  if (!rendered) fs.rmSync(src, { force: true })
  say(`card still ${short(out)}: frame 0`)
}

function show(file) {
  if (args.open === 'no') return
  const cmd = process.platform === 'darwin' ? ['open', [file]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]] : ['xdg-open', [file]]
  try {
    const p = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' })
    p.on('error', () => say(`could not open ${short(file)} on this machine. Open it by hand.`))
    p.unref()
  } catch {
    say(`could not open ${short(file)} on this machine. Open it by hand.`)
  }
}

function keptStill(id) {
  const root = rel('out', 'stills')
  if (!fs.existsSync(root)) return null
  const ids = id ? [id] : cfg.keys.map((k) => k.id)
  for (const k of ids)
    for (const d of fs.readdirSync(root).sort().reverse()) {
      const f = path.join(root, d, `${k}.jpg`)
      if (fs.existsSync(f) && fs.existsSync(`${f}.json`) && readJson(`${f}.json`).spec) return f
    }
  return null
}

async function judgedStill(session) {
  const kept = keptStill(argText(args, 'still', ''))
  if (!kept) {
    say('judged still: out/stills/ holds no kept still with a record, so this machine was not compared with the build')
    return null
  }
  const record = readJson(`${kept}.json`)
  const spec = stillSpec({ key: record.spec.id || undefined, season: record.spec.season, state: record.spec.state, camera: record.spec.camera, tier: record.spec.tier, format: record.spec.format, assets: record.spec.assets })
  const out = path.join(dir, 'test', `${path.basename(kept, '.jpg')}-this-machine.png`)
  const r = await renderStill(session, spec, { file: out, force: true })
  const q = await psnr(kept, out)
  const beside = path.join(dir, 'test', `${path.basename(kept, '.jpg')}-kept-and-this-machine.jpg`)
  await sideBySide({ files: [kept, out], out: beside })
  const sameBuild = record.engineHash === r.record.engineHash
  const floor = cfg.quality.crossMachineMinPsnr
  const result = { kept: short(kept), keptRecord: { engineHash: record.engineHash, graphics: record.graphics, machine: record.machine, browser: record.browser }, here: short(out), beside: short(beside), psnr: q.psnr, maxDiff: q.maxDiff, floor, sameBuild, under: q.psnr < floor }
  writeJson(`${beside}.json`, { ...r.record, ...result })
  say(`judged still ${spec.id || path.basename(kept, '.jpg')}: ${short(out)}, beside the kept still in ${short(beside)}`)
  say(`PSNR against ${short(kept)}: ${Number.isFinite(q.psnr) ? q.psnr.toFixed(1) : 'identical'} dB, the floor in quality.crossMachineMinPsnr is ${floor} dB${q.psnr < floor ? '. It is under the floor: look at the two pictures before a long render' : ''}${sameBuild ? '' : '. The kept still is from another build of the engine, so the build can be the difference, not the machine'}`)
  return result
}

function targets(plan, w) {
  if (what === 'loop') return [{ t: loop, w: w.loop, spans: [{ id: 'loop', first: 0, last: plan.loop - 1 }] }]
  const b = { t: body, w: w.film, spans: plan.film.shots }
  if (what === 'film-b') return [b]
  return [{ t: opening, w: w.opening, spans: [{ id: 'opening', first: 0, last: plan.opening - 1 }] }, b]
}

const outName = () => (what === 'loop' ? named(cfg.export.files.cardLoop) : named(what === 'film-a' ? cfg.export.files.filmA : cfg.export.files.filmB))
const which = what === 'film-a' ? 'a' : 'b'
const notBuilt = 'film A was not made: its opening is not built yet (opening().frameCount is 0). Film B is not rendered a second time for it.'

async function go() {
  const opened = await open()
  if (!opened) return
  const { session, run } = opened
  let list
  try {
    if (!(await masterAllowed(run))) return
    const plan = await run.plan(body)
    const w = wanted(plan)
    if (what === 'film-a' && plan.opening === 0) return say(notBuilt)
    list = targets(plan, w)
    for (const x of list) checkCount(x.w)
    for (const x of list) await renderSpans(run, x.t, x.spans, x.w.frames)
    if (run.rendered) say(`rendered ${run.rendered} frames at ${run.perFrame().toFixed(2)} s a frame`)
  } finally {
    await run.close()
    await session.close()
    if (run.errors.length) say(`page messages:\n${run.errors.slice(0, 10).join('\n')}`)
  }
  checkDisk()
  const covers = list.map((x) => coverOf(x.t))
  covers.forEach((c, k) => coverNotes(c, list[k].t, say))
  const total = list.reduce((n, x) => n + x.w.frames, 0)
  if (!covers.every((c) => c.complete)) throw new Error('some frames have no chunk, so nothing was joined. Run it again: it carries on where it stopped.')
  const file = what === 'loop' ? null : finalMix(which)
  const out = outName()
  const r = await joinTo({ covers, out, sound: file ? { file, offsetSeconds: 0 } : null, extra: { what, master: !small, rehearsal: rehearse, complete: true } })
  if (r.probe.frames !== total) throw new Error(`${short(out)} holds ${r.probe.frames} frames, not the ${total} the film has`)
  say(`${short(out)} holds ${r.probe.frames} frames, as it should`)
  if (what === 'loop') {
    await cardStill(path.join(dir, cfg.export.files.cardStill), r)
    say('sound: none, the card loop has no sound')
  } else say(soundLine(file ? { file } : null, which))
}

async function test() {
  const opened = await open()
  if (!opened) return
  const { session, run } = opened
  let t
  let count
  try {
    if (!(await masterAllowed(run))) return
    await judgedStill(session)
    const plan = await run.plan(body)
    const w = wanted(plan)
    if (what === 'film-a' && plan.opening === 0) return say(notBuilt)
    const x = targets(plan, w)[0]
    checkCount(x.w)
    t = x.t
    count = Math.min(x.w.frames, Math.round(cfg.export.local.testSeconds * fps))
    const spans = x.spans.map((s) => ({ ...s, last: Math.min(s.last, count - 1) })).filter((s) => s.first <= s.last)
    await renderSpans(run, t, spans, x.w.frames)
    if (run.rendered) say(`rendered ${run.rendered} frames at ${run.perFrame().toFixed(2)} s a frame. The whole of ${x.w.name} would take about ${minutes(run.perFrame() * x.w.frames)}`)
  } finally {
    await run.close()
    await session.close()
    if (run.errors.length) say(`page messages:\n${run.errors.slice(0, 10).join('\n')}`)
  }
  const cover = coverOf(t)
  const parts = cover.parts.filter((c) => c.last < count)
  const file = what === 'loop' ? null : finalMix(which)
  const out = path.join(dir, `test-${what}.${container}`)
  const r = await joinTo({ covers: [{ ...cover, parts }], out, sound: file ? { file, offsetSeconds: 0 } : null, extra: { what, test: true, rehearsal: rehearse, complete: false } })
  if (r.probe.frames !== count) throw new Error(`${short(out)} holds ${r.probe.frames} frames, not ${count}`)
  show(out)
  say(`the test is in ${short(out)}. Look at it, then run the same command with --go in place of --test.`)
  say(what === 'loop' ? 'sound: none, the card loop has no sound' : soundLine(file ? { file } : null, which))
}

async function proofRun() {
  const { session, run } = await open()
  const results = []
  const sounds = []
  let hash = ''
  let graphics = ''
  try {
    graphics = await card(run)
    const plan = await run.plan(body)
    hash = plan.info.engineHash
    const w = wanted(plan)
    checkCount(w.film)
    const count = Math.round(cfg.export.proofSeconds * fps)
    const landing = plan.film.landings[0]
    const jobs = [{ what: 'film-b', t: body, total: plan.film.frameCount, centre: landing, note: `across the landing at frame ${landing}` }]
    if (plan.opening > 0) jobs.push({ what: 'opening', t: opening, total: plan.opening, centre: plan.openingPlan?.send ?? Math.floor(plan.opening / 2), note: `around the send at frame ${plan.openingPlan?.send ?? Math.floor(plan.opening / 2)}` })
    else say("film A's opening is not built yet (opening().frameCount is 0), so the proof holds film B only")
    for (const j of jobs) {
      const win = windowAround(j.centre, count, j.total)
      await renderSpans(run, j.t, [{ id: 'proof', ...win }], j.total)
      const cover = coverOf(j.t)
      const parts = cover.parts.filter((c) => c.first >= win.first && c.last <= win.last)
      const out = path.join(dir, `proof-${j.what}.${container}`)
      const mix = j.what === 'film-b' ? finalMix('b') : null
      const r = await joinTo({ covers: [{ ...cover, parts }], out, sound: mix ? { file: mix, offsetSeconds: win.first / fps } : null, extra: { what: j.what, proof: true, complete: false } })
      const p = r.probe
      if (p.frames !== win.last - win.first + 1) throw new Error(`${short(out)} holds ${p.frames} frames, not ${win.last - win.first + 1}`)
      sounds.push(mix)
      results.push({ what: j.what, built: true, file: short(out), first: win.first, last: win.last, note: j.note, sound: mix ? short(mix) : null, sha256: r.record.sha256, ffprobe: { codec: p.codec, profile: p.profile, pixFmt: p.pixFmt, width: p.width, height: p.height, fps: p.fps, frames: p.frames, seconds: p.seconds, bytes: p.bytes, mbps: p.mbps, audio: p.audio } })
    }
    if (plan.opening === 0) results.push({ what: 'opening', built: false, note: 'opening().frameCount is 0: the opening of film A is not built yet, so there is nothing to prove for it' })
  } finally {
    await run.close()
    await session.close()
    if (run.errors.length) say(`page messages:\n${run.errors.slice(0, 10).join('\n')}`)
  }
  const file = path.join(dir, 'proof.json')
  writeJson(file, { engineHash: hash || engineHash(), time: new Date().toISOString(), machine: machineId(), platform: `${os.platform()} ${os.arch()}`, graphics, format: formatId, tier, fps, seconds: cfg.export.proofSeconds, results })
  say(`proof written to ${short(file)}`)
  say(soundLine(sounds[0] ? { file: sounds[0] } : null, 'b'))
}

fs.mkdirSync(dir, { recursive: true })
if (mode === 'go') await go()
else if (mode === 'test') await test()
else await proofRun()
process.exit(0)
