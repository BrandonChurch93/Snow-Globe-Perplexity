import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, checkDisk, formatById, recordMatches } from './lib/page.mjs'
import { fileSha } from './lib/hashes.mjs'
import { machineId } from './lib/browser.mjs'
import { Run, argFrame, argText, coverNotes, coverOf, joinCovers, makeTrack, pickSound, planChunks, short, soundStart } from './lib/frames.mjs'
import { haveFfmpeg, probe, probeLine, scaleCopy, videoSettings } from './lib/encode.mjs'

const args = parseArgs(process.argv.slice(2))
const review = args.review !== undefined
const which = review ? 'b' : argText(args, 'which', 'b')
if (which !== 'a' && which !== 'b') throw new Error('--which takes a or b')
const tier = argText(args, 'tier', 'draft')
const formatId = review || args['from-hd'] === true ? cfg.formats.preview.id : argText(args, 'format', cfg.formats.hd.id)
const assets = argText(args, 'assets', 'full')
const fps = cfg.film.previewFps
const first = argFrame(args, 'first')
const last = argFrame(args, 'last')
const shot = argText(args, 'shot', '')
const ranged = first !== null || last !== null || shot !== ''
const container = cfg.export.container
const work = (...p) => rel('out', 'work', ...p)
const say = console.log
if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')
formatById(formatId)

const track = (kind) =>
  makeTrack({ kind, name: kind === 'opening' ? 'film-a-opening' : 'film-b', dir: work('film', `${kind === 'opening' ? 'a' : 'b'}-${formatId}-${tier}`), format: formatId, tier, assets, fps })
const body = track('film')
const opening = track('opening')
const filmName = (w, f, t, whole) => work(`film-${w}-${f}-${t}${whole ? '' : '-partial'}.${container}`)

function soundFor(w) {
  const mix = argText(args, 'mix', '')
  if (mix) {
    const file = path.resolve(mix)
    if (!fs.existsSync(file)) throw new Error(`--mix ${mix} does not exist`)
    return file
  }
  return pickSound([rel('audio', 'final', `film-${w}.wav`), w === 'b' ? rel('audio', 'mix', 'blockout.wav') : null])
}

const soundLine = (sound, why) => (sound ? `sound: ${short(sound.file)}` : `sound: none, the film is silent (${why})`)
const noSoundWhy = (w) => `no --mix, no audio/final/film-${w}.wav${w === 'b' ? ', no audio/mix/blockout.wav' : ''}`

async function fromHd() {
  const hd = cfg.formats.hd.id
  const src = filmName(which, hd, tier, true)
  if (!recordMatches(src, { seasons: cfg.seasons, format: hd, tier })) throw new Error(`${short(src)} is missing or is not from the current build. Render and join it first.`)
  const srcRecord = readJson(`${src}.json`)
  const out = filmName(which, formatId, tier, true)
  const settings = videoSettings({ format: formatById(formatId), fps: srcRecord.fps })
  checkDisk()
  await scaleCopy({ src, settings, out: `${out}.new` })
  const seen = probe(`${out}.new`)
  if (seen.frames !== srcRecord.frames) {
    fs.rmSync(`${out}.new`, { force: true })
    throw new Error(`the scaled copy holds ${seen.frames} frames, ${short(src)} holds ${srcRecord.frames}`)
  }
  const sha256 = fileSha(`${out}.new`)
  fs.renameSync(`${out}.new`, out)
  writeJson(`${out}.json`, { ...srcRecord, format: formatId, time: new Date().toISOString(), joinedOn: machineId(), fromHd: { file: short(src), sha256: srcRecord.sha256 }, codec: settings.codec, mbps: settings.mbps, probe: seen, sha256 })
  say(`scaled ${short(src)} down to ${short(out)}`)
  say(`ffprobe: ${probeLine(seen)}`)
  say(srcRecord.sound ? `sound: ${srcRecord.sound.file}, copied from the ${hd} film` : `sound: none, the film is silent (the ${hd} film it was scaled from is silent)`)
}

async function render() {
  const session = await Session.open()
  const run = new Run(session, { by: argText(args, 'by', 'builder'), looks: args.look !== 'no' })
  let openingBuilt = true
  try {
    const plan = await run.plan(body)
    const jobs = []
    if (which === 'a') {
      openingBuilt = plan.opening > 0
      if (!openingBuilt) return false
      const whole = [{ id: 'opening', first: 0, last: plan.opening - 1 }]
      if (shot === '' || shot === 'opening') jobs.push([opening, planChunks(opening, first !== null || last !== null ? [{ id: 'range', first: first ?? 0, last: last ?? plan.opening - 1 }] : whole), plan.opening])
    }
    if (which === 'b' || !ranged || (shot !== '' && shot !== 'opening')) {
      let spans = plan.film.shots
      let range = {}
      if (shot !== '') {
        spans = spans.filter((s) => s.id === shot)
        if (!spans.length) throw new Error(`no such shot: ${shot}. The film has ${plan.film.shots.map((s) => s.id).join(', ')}${which === 'a' ? ' and opening' : ''}`)
        if (which === 'b') range = { first, last }
      } else if (which === 'b' && (first !== null || last !== null)) {
        spans = [{ id: 'range', first: first ?? 0, last: Math.min(last ?? plan.film.frameCount - 1, plan.film.frameCount - 1) }]
      }
      jobs.push([body, planChunks(body, spans, range), plan.film.frameCount])
    }
    const count = jobs.reduce((n, j) => n + j[1].length, 0)
    if (!count) throw new Error('that range holds no frame to render')
    say(`film ${which}: ${count} ${count === 1 ? 'chunk' : 'chunks'}, ${formatId}, ${tier}, ${fps} frames a second, ${body.settings.codec} at ${body.settings.mbps} Mbps`)
    for (const [t, chunks, total] of jobs) await run.renderChunks(t, chunks, total)
    if (run.rendered) say(`rendered ${run.rendered} frames at ${run.perFrame().toFixed(2)} s a frame`)
  } finally {
    await run.close()
    await session.close()
    if (run.errors.length) say(`page messages:\n${run.errors.slice(0, 10).join('\n')}`)
  }
  return openingBuilt
}

function covers() {
  const b = coverOf(body)
  const a = which === 'a' ? coverOf(opening) : null
  if (a) coverNotes(a, opening, say)
  coverNotes(b, body, say)
  return { a, b, list: a ? [a, b] : [b], whole: (!a || a.complete) && b.complete }
}

async function joinFilm() {
  checkDisk()
  const c = covers()
  if (which === 'a' && !c.a.parts.length) {
    say('film A was not made: there is no chunk of its opening for this build. Render the opening first.')
    return
  }
  const start = soundStart(c.a, c.b)
  const file = soundFor(which)
  const sound = file && start.contiguous ? { file, offsetSeconds: start.offsetSeconds } : null
  const out = filmName(which, formatId, tier, c.whole)
  const r = await joinCovers({ covers: c.list, out, container, fps, sound, extra: { which, complete: c.whole } })
  say(`joined ${r.record.chunks.length} ${r.record.chunks.length === 1 ? 'chunk' : 'chunks'} into ${short(out)}${c.whole ? '' : ', which is not the whole film'}`)
  say(`ffprobe: ${probeLine(r.probe)}`)
  say(soundLine(sound, file ? 'the chunks leave gaps, so no sound was laid' : noSoundWhy(which)))
}

async function reviewCuts() {
  checkDisk()
  const c = covers()
  const start = soundStart(null, c.b)
  const asked = argText(args, 'candidate', '')
  if (asked && !cfg.audio.candidates.includes(asked)) throw new Error(`no such candidate: ${asked}. audio.candidates holds ${cfg.audio.candidates.join(', ')}`)
  const mixes = (asked ? [asked] : cfg.audio.candidates).map((name) => ({ name, file: rel('audio', 'mix', `${name}.wav`) }))
  const have = mixes.filter((m) => fs.existsSync(m.file))
  if (asked && !have.length) throw new Error(`audio/mix/${asked}.wav does not exist, so there is no review cut for ${asked}`)
  const cuts = have.length && start.contiguous ? have : [{ name: 'silent', file: null }]
  const lines = []
  for (const m of cuts) {
    const out = work(`review-${m.name}${c.whole ? '' : '-partial'}.${container}`)
    const sound = m.file ? { file: m.file, offsetSeconds: start.offsetSeconds } : null
    const r = await joinCovers({ covers: [c.b], out, container, fps, sound, extra: { which: 'b', review: true, candidate: m.name, complete: c.whole } })
    say(`review cut ${short(out)}${c.whole ? '' : ', which is not the whole film'}`)
    say(`ffprobe: ${probeLine(r.probe)}`)
    lines.push(sound ? `${short(out)} carries ${short(m.file)}` : `${short(out)} is silent`)
  }
  for (const m of mixes) if (!have.includes(m)) say(`no review cut for ${m.name}: audio/mix/${m.name}.wav does not exist`)
  say(`sound: ${lines.join('; ')}${have.length ? '' : ` (none of ${mixes.map((m) => `audio/mix/${m.name}.wav`).join(', ')} exists)`}`)
}

if (args['from-hd'] === true) await fromHd()
else {
  let built = true
  if (ranged || args.join !== true) built = await render()
  if (!built) say('film A was not made: its opening is not built yet (opening().frameCount is 0). Film B is not rendered a second time for it.')
  else if (review) await reviewCuts()
  else if (!ranged || args.join === true) await joinFilm()
  else say(`chunks are in ${short(which === 'a' && (shot === '' || shot === 'opening') ? opening.dir : body.dir)}. Add --join to join the chunks that exist.`)
}
