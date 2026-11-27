import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { bootId, parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, currentSeasonHashes, formatById, renderBusy, renderStill, requireBuild, stillSpec } from './lib/page.mjs'
import { engineHash, fileSha, sha256 } from './lib/hashes.mjs'
import { freeDiskGb, launch, machineId, pinnedBrowser, rendererName } from './lib/browser.mjs'
import { serve } from './lib/server.mjs'
import { Run, argFrame, argText, pngOk, short } from './lib/frames.mjs'
import { decodedHashes, encodeFinal, encodeMasterChunk, finalVideoArgs, frameLevels, framePsnr, haveFfmpeg, headerRefFrames, keyFrames, masterVideoArgs, probe, probeLine, probeStreams, scaleEvery, soundSeconds, startsFast, stillJpeg, toolVersions, videoSettings } from './lib/encode.mjs'
import { COLOUR_TAGS, FPS, JOINS, LOOK_WIDTH, M, SOUND, STILL_MAX_MB, WHATS, bestRun, bigSha, chunkDir, chunkStem, coverReport, dB, encodeProofRows, finalKbps, framesOf, heartbeat, firstPlace, heldLine, heldRanges, hours, intermediateVideo, joinPlan, markedHolder, notNumberFrames, levelProblems, masterConfigProblems, openingPack, pad6, pictureLevels, procsProblem, NOT_A_NUMBER, notNumberLine, notNumberLoud, notNumberOf, notNumberRecord, notNumberUnknown, parseTake, procsGainLine, limitsLine, limitsRecord, localProblem, machineLimits, sameCommand, standInPicture, stoppedAt, stoppedLine, writeJsonAtomic, sampleRule, pieceCounts, countFacts, countsLine, psnrFacts, rangeChunks, readChunks, recordMatchesRun, crfLadder, crfOf, resultName, sendGroups, shipTitle, shippedLine, split, splitFile, stillName, stillToDo, table, takeFiles, tierOf, totalsFromCut, unsplitFile, hashFolder, chunkName } from './lib/master.mjs'
import { Shipper, identityProblem, mainAuthor, collectBranches, repoFacts } from './lib/mastergit.mjs'

const args = parseArgs(process.argv.slice(2))
const say = console.log
const USAGE = [
  'npm run master -- --what film-b|loop|opening [--first N --last M] [--ship BRANCH] [--procs P] [--crf N] [--part-mb N]',
  'npm run master -- --calibrate',
  'npm run master -- --hd film-a|film-b [--test]',
  'npm run master -- --collect DIR [--files FOLDER] [--keep] [--no-branches] [--take BRANCH | WHAT:FIRST-LAST=BRANCH,...]',
  'npm run master -- --encode film-b|film-a|loop --from DIR [--target-mb N] [--preset P] [--keyint N] [--min-keyint N] [--x264 PARAMS] [--final-min-psnr N] [--take ...]',
  '  and for the loop: [--crf N] [--min-crf N] [--loop-x264 PARAMS] [--seam-db N]',
  'npm run master -- --split FILE [--part-mb N]',
  'npm run master -- --unsplit DIR [--out FILE]',
  'For tests only: --samples S, --format F, --chunk N, --min-psnr N, and --encode ... --test [--gaps] [--sound FILE]',
  "For the tool's own tests: --stand-in DIR [--stand-in-fail N] [--stand-in-nan N] [--stand-in-more N] draws ramps instead of the film, without a browser, into DIR",
].join('\n')
const LOCK = rel('out', 'work', 'render.lock')
const CALIBRATION = rel('out', 'work', 'master', 'calibration.json')
const CALIBRATION_SPEC = { season: 'winter', state: 'rest', camera: 'hero', tier: 'review', format: 'hd' }
const span = (r) => (r.first === r.last ? `${r.first}` : `${r.first} to ${r.last}`)
const mb = (bytes) => (bytes / 1e6).toFixed(2)

function whole(key, fallback) {
  if (args[key] === undefined) return fallback
  const n = Number(args[key])
  if (args[key] === true || !Number.isInteger(n) || n < 1) throw new Error(`--${key} takes a whole number, 1 or more`)
  return n
}

const SIZE = whole('chunk', M.chunkFrames)

function number(key, fallback, { least = -Infinity, most = Infinity, int = false } = {}) {
  if (args[key] === undefined) return fallback
  const n = Number(args[key])
  if (args[key] === true || !Number.isFinite(n) || n < least || n > most || (int && !Number.isInteger(n))) throw new Error(`--${key} takes a ${int ? 'whole ' : ''}number from ${least} to ${most}`)
  return n
}

const overridden = (keys) => Object.fromEntries(keys.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]))
const FINAL = {
  ...M.final,
  preset: args.preset === undefined ? M.final.preset : argText(args, 'preset', ''),
  keyint: number('keyint', M.final.keyint, { least: 1, most: 600, int: true }),
  minKeyint: number('min-keyint', M.final.minKeyint, { least: 1, most: 600, int: true }),
  params: args.x264 === undefined ? M.final.params : args.x264 === true ? '' : String(args.x264),
  minPsnr: number('final-min-psnr', M.final.minPsnr, { least: 20, most: 100 }),
  loop: {
    ...M.final.loop,
    crf: number('crf', M.final.loop.crf, { least: 0, most: 30 }),
    minCrf: Math.min(number('min-crf', M.final.loop.minCrf, { least: 0, most: 30 }), number('crf', M.final.loop.crf, { least: 0, most: 30 })),
    seamDb: number('seam-db', M.final.loop.seamDb, { least: 0.000001, most: 10 }),
    params: args['loop-x264'] === undefined ? M.final.loop.params : args['loop-x264'] === true ? '' : String(args['loop-x264']),
  },
}
const INTER = { ...M.intermediate, crf: number('crf', M.intermediate.crf, { least: 0, most: 30 }), partMb: number('part-mb', M.intermediate.partMb, { least: 0.000001, most: 50 }) }
const TEST_RUN = args.samples !== undefined || args.format !== undefined || args.chunk !== undefined
const LIMITS = machineLimits()
const COMMAND = sameCommand(process.argv.slice(2))

function psnrFloor(test) {
  if (args['min-psnr'] === undefined) return M.intermediate.minPsnr
  const n = Number(args['min-psnr'])
  if (!test) throw new Error('--min-psnr is for tests only (with --samples, --format or --chunk). A chunk of a master is held to deliver.master.intermediate.minPsnr.')
  if (args['min-psnr'] === true || !(n > 0)) throw new Error('--min-psnr takes a number of dB')
  return n
}

const rgbOf = async (png) => sharp(png).removeAlpha().raw().toBuffer()

function setup() {
  const what = argText(args, 'what', '')
  if (!WHATS.includes(what)) throw new Error(`--what takes ${WHATS.join(', ')}.\n${USAGE}`)
  const engine = what !== 'opening'
  const test = TEST_RUN
  const format = formatById(argText(args, 'format', M.format))
  const rule = engine ? sampleRule(what, args.samples === undefined ? undefined : whole('samples', M.samples[what])) : null
  const samples = rule ? rule.base : 0
  const procs = whole('procs', 1)
  const total = totalsFromCut()[what]
  if (!(total > 0)) throw new Error(`cut/CUTLIST.json holds no frame count for ${what}`)
  const chunks = rangeChunks(total, argFrame(args, 'first'), argFrame(args, 'last'), SIZE)
  const work = args['stand-in'] !== undefined && args['stand-in'] !== true ? path.join(path.resolve(String(args['stand-in'])), 'work', what) : test ? rel('out', 'work', 'master', 'test', what) : rel('out', 'work', 'master', what)
  const hash = engineHash()
  const standIn = args['stand-in'] === undefined ? null : path.resolve(argText(args, 'stand-in', ''))
  if (standIn && (!engine || !test || args['stand-in'] === true)) throw new Error("--stand-in DIR is for the tool's own tests: it takes a folder, film-b or loop, and one of --samples, --format, --chunk")
  const noScreen = localProblem(args.local === true)
  if (noScreen && !standIn) throw new Error(noScreen)
  const renderer = standIn ? 'stand-in' : engine ? rendererName(args.local === true) : 'pack'
  const calibration = engine && !standIn ? calibrationOf(hash, renderer) : null
  const want = (c) => ({ what, first: c.first, last: c.last, engineHash: hash, samples, format: format.id, fps: FPS, test, renderer, calibration, ...(rule ? { motion: rule.motion } : {}), encoderArgs: masterVideoArgs({ ...intermediateVideo(), crf: INTER.crf }, SIZE) })
  return { what, engine, test, format, samples, rule, moreAt: standIn && args['stand-in-more'] !== undefined ? Number(args['stand-in-more']) : -1, procs, total, chunks, work, want, hash, renderer, calibration, floor: psnrFloor(test), out: standIn ? path.join(standIn, 'out', what) : chunkDir(what, test), local: args.local === true, standIn, failAt: standIn && args['stand-in-fail'] !== undefined ? Number(args['stand-in-fail']) : null, nanAt: standIn && args['stand-in-nan'] !== undefined ? Number(args['stand-in-nan']) : null, overrides: overridden(['crf', 'part-mb']) }
}

const filesOf = (ctx, c) => {
  const stem = path.join(ctx.out, chunkStem(ctx.what, c.first, c.last))
  return { mp4: `${stem}.mp4`, json: `${stem}.json`, look: `${stem}.jpg`, still: ctx.what === 'loop' && c.first === 0 ? path.join(ctx.out, stillName(0)) : null, frames: path.join(ctx.work, `frames-${pad6(c.first)}-${pad6(c.last)}`) }
}

function finished(ctx, c) {
  const f = filesOf(ctx, c)
  if (!fs.existsSync(f.mp4) || !fs.existsSync(f.json)) return null
  let r
  try {
    r = readJson(f.json)
  } catch {
    return null
  }
  if (!recordMatchesRun(r, ctx.want(c)) || fs.statSync(f.mp4).size !== r.bytes || fileSha(f.mp4) !== r.sha256) return null
  if (f.still && !(fs.existsSync(f.still) && fileSha(f.still) === r.still?.sha256)) return null
  for (const p of r.parts ?? []) {
    const part = path.join(ctx.out, p.file)
    if (!fs.existsSync(part) || fs.statSync(part).size !== p.bytes || fileSha(part) !== p.sha256) return null
  }
  return r
}

function frameOnDisk(ctx, c, index) {
  const f = path.join(filesOf(ctx, c).frames, `${pad6(index)}.png`)
  if (!pngOk(f, ctx.format)) return null
  try {
    const side = readJson(f.replace(/\.png$/, '.json'))
    return typeof side.sha256 === 'string' && side.index === index && (!ctx.engine || Number.isInteger(side.samples)) ? { file: f, ...side } : null
  } catch {
    return null
  }
}

function calibrationOf(hash, renderer) {
  let c = null
  try {
    c = readJson(CALIBRATION)
  } catch {}
  return c && c.engineHash === hash && c.renderer === renderer && c.machine === machineId() && typeof c.sha256 === 'string' ? c.sha256 : null
}

async function calibrate() {
  const noScreen = localProblem(args.local === true)
  if (noScreen) throw new Error(noScreen)
  const hash = requireBuild()
  const renderer = rendererName(args.local === true)
  const session = await openSession(true, args.local === true)
  const file = rel('out', 'work', 'master', 'calibration.png')
  const t0 = Date.now()
  try {
    await renderStill(session, stillSpec(CALIBRATION_SPEC), { file, force: true })
  } finally {
    await session.close()
  }
  const record = { sha256: fileSha(file), pixelsSha256: sha256(await rgbOf(file)), spec: CALIBRATION_SPEC, engineHash: hash, renderer, machine: machineId(), boot: bootId(), seconds: Math.round((Date.now() - t0) / 100) / 10, time: new Date().toISOString() }
  writeJson(CALIBRATION, record)
  say(`calibration ${record.sha256}`)
  say(`the sha256 of the PNG of ${Object.values(CALIBRATION_SPEC).join(' ')} drawn by ${renderer} on ${record.machine}, build ${hash}, in ${record.seconds} s (its pixels alone: ${record.pixelsSha256})`)
  say('Every machine that renders for one master must print the same first line. A machine that prints another one renders nothing for it.')
}

function framesKey(ctx) {
  return { what: ctx.what, engineHash: ctx.engine ? ctx.hash : '', samples: ctx.samples, motion: ctx.rule?.motion ?? null, format: ctx.format.id, width: ctx.format.width, height: ctx.format.height, renderer: ctx.renderer, calibration: ctx.calibration }
}

function dropStaleFrames(ctx, c) {
  const dir = filesOf(ctx, c).frames
  const keyFile = path.join(dir, 'frames.json')
  const key = framesKey(ctx)
  let same = false
  try {
    same = JSON.stringify(readJson(keyFile)) === JSON.stringify(key)
  } catch {}
  if (!same && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  return { dir, keyFile, key }
}

async function openSession(lock, local) {
  const busy = lock ? renderBusy() : null
  if (busy) say(`waiting for the render that holds this clone's lock: ${busy.what} (pid ${busy.pid})`)
  if (lock) return Session.open({ local, what: `master ${process.argv.slice(2).join(' ')}` })
  const s = Object.create(Session.prototype)
  s.hash = requireBuild()
  s.server = await serve()
  try {
    s.browser = await launch({ local })
  } catch (e) {
    await s.server.close().catch(() => {})
    throw e
  }
  s.browserVersion = s.browser.version()
  s.local = local
  s.pages = new Set()
  return s
}

async function source(ctx, lock) {
  if (ctx.standIn) {
    const standInCount = (index) => (index === ctx.moreAt ? ctx.samples * 2 : ctx.samples)
    const { width, height } = ctx.format
    return {
      graphics: 'none, a stand-in for tests',
      browser: 'none',
      counts: async (list) => list.map(standInCount),
      picture: async (index) => {
        if (index === ctx.failAt) throw new Error('the WebGL context was lost before the picture was read back (a stand-in said so, for a test). No picture was written.')
        const rgb = standInPicture(width, height, index)
        return { png: await sharp(rgb, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 3 }).toBuffer(), rgb, samples: standInCount(index), notNumber: index === ctx.nanAt ? 3 : 0, sanityMs: 0, first: index === ctx.nanAt ? { x: 7, y: 5, channel: 'green', kind: 'no number' } : null }
      },
      close: async () => {},
    }
  }
  if (!ctx.engine) {
    const pack = await openingPack(args.pack && args.pack !== true ? path.resolve(String(args.pack)) : undefined)
    if (pack.fps !== FPS) throw new Error(`the opening pack is at ${pack.fps} frames a second, the master is at ${FPS}`)
    if (pack.width !== ctx.format.width || pack.height !== ctx.format.height) throw new Error(`the opening pack is ${pack.width} x ${pack.height}, the master is ${ctx.format.width} x ${ctx.format.height}`)
    if (pack.frameCount !== ctx.total) throw new Error(`the opening pack holds ${pack.frameCount} frames, cut/CUTLIST.json holds ${ctx.total} for the opening`)
    return {
      graphics: 'none, the pictures come from the opening pack',
      browser: 'none',
      counts: async () => null,
      picture: async (index) => {
        const rgb = await pack.frame(index)
        if (rgb.length !== pack.width * pack.height * 3) throw new Error(`the opening pack gave ${rgb.length} bytes for frame ${index}, not ${pack.width} x ${pack.height} x 3`)
        return { png: await sharp(rgb, { raw: { width: pack.width, height: pack.height, channels: 3 } }).png({ compressionLevel: 3 }).toBuffer(), rgb }
      },
      close: async () => {},
    }
  }
  const session = await openSession(lock, ctx.local)
  try {
    const run = new Run(session, { by: 'master', looks: false, say })
    const track = { kind: ctx.what === 'loop' ? 'loop' : 'film', name: ctx.what, format: ctx.format, tier: tierOf(ctx.samples), assets: 'full', fps: FPS, step: 1 }
    const page = await run.page(track)
    const plan = await run.plan(track)
    const has = ctx.what === 'loop' ? plan.loop : plan.film.frameCount
    if (has !== ctx.total) throw new Error(`the page holds ${has} frames for ${ctx.what}, cut/CUTLIST.json holds ${ctx.total}. Run npm run cut and npm run build, then render again.`)
    const graphics = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      const ext = gl?.getExtension('WEBGL_debug_renderer_info')
      return gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'no WebGL'
    })
    const precision = await page.evaluate(() => window.showcase.dev.caps().precision)
    let whole = null
    const counts = async (list) => {
      if (!ctx.rule.tier) return list.map(() => ctx.rule.base)
      if (!whole) {
        const got = await page.evaluate(([k, n, t]) => Array.from({ length: n }, (_, i) => window.showcase.dev.frameSamples(k, i, t)), [track.kind, ctx.total, ctx.rule.tier])
        whole = pieceCounts(ctx.rule, got, track.kind === 'loop').counts
      }
      return list.map((i) => whole[i])
    }
    return {
      graphics,
      precision,
      browser: `${pinnedBrowser().name} ${session.browserVersion}`,
      counts,
      picture: async (index) => {
        const [samples] = await counts([index])
        const png = await run.frame({ ...track, tier: tierOf(samples, ctx.rule) }, page, index)
        const s0 = Date.now()
        const sane = await page.evaluate(() => window.showcase.dev.sanity())
        const sanityMs = Date.now() - s0
        if (!Number.isInteger(sane?.invalid)) throw new Error(`the page gave no count of values that are no number for frame ${index}`)
        return { png, rgb: await rgbOf(png), samples, notNumber: sane.invalid, sanityMs, first: firstPlace(sane.first) }
      },
      close: async () => {
        await run.close()
        await session.close()
      },
    }
  } catch (e) {
    await session.close().catch(() => {})
    throw e
  }
}

function lazySource(ctx, lock) {
  let src = null
  return {
    facts: () => (src ? { graphics: src.graphics, browser: src.browser, ...(src.precision ? { precision: src.precision } : {}) } : null),
    counts: async (list) => {
      src ??= await source(ctx, lock)
      return src.counts(list)
    },
    picture: async (index) => {
      src ??= await source(ctx, lock)
      return src.picture(index)
    },
    close: async () => {
      if (src) await src.close()
    },
  }
}

async function verifyChunk(file, frames, floor) {
  const n = frames.length
  const seen = decodedHashes(file)
  const steps = seen.frames.slice(1).map((f, i) => (f.pts - seen.frames[i].pts) * seen.timeBase)
  const even = steps.every((s) => Math.abs(s - 1 / FPS) < 1e-9)
  const early = []
  let psnr = { least: 0, leastFrame: frames[0].index, mean: 0 }
  if (seen.frames.length === n) {
    const list = await framePsnr({ file, files: frames.map((x) => x.file), fps: FPS, pixFmt: M.video.pixFmt })
    if (list.length === n) psnr = { ...psnrFacts(list, frames[0].index), frames: list.map((x) => Math.round(x * 100) / 100) }
    else early.push(`its PSNR could be measured on ${list.length} frames, not ${n}`)
  }
  const problems = [...early]
  const sources = []
  for (const f of frames) sources.push(typeof f.mean === 'number' ? { index: f.index, mean: f.mean, flat: f.flat === true } : { index: f.index, ...pictureLevels(await rgbOf(f.file)) })
  const levels = frameLevels(file)
  problems.push(...levelProblems(levels, sources))
  if (!seen.ok) problems.push(`the decoder wrote: ${seen.errors.join(' / ') || 'an error'}`)
  if (seen.frames.length !== n) problems.push(`it decodes to ${seen.frames.length} frames, not ${n}`)
  if (!even) problems.push(`its frames are not ${FPS} a second apart`)
  const v = probeStreams(file).video[0] ?? {}
  const tags = `${v.color_space} / ${v.color_primaries} / ${v.color_transfer} / ${v.color_range}`
  if (tags !== COLOUR_TAGS) problems.push(`its colour tags are ${tags}, not ${COLOUR_TAGS}`)
  const before = problems.length
  if (seen.frames.length === n && !early.length && psnr.least < floor) problems.push(`frame ${psnr.leastFrame} decodes to ${psnr.least} dB from its PNG in luma, under ${floor === M.intermediate.minPsnr ? 'deliver.master.intermediate.minPsnr' : '--min-psnr'} ${floor}`)
  return { verify: { ok: problems.length === 0, onlyTheFloor: before === 0 && problems.length === 1, frames: seen.frames.length, decodeErrors: seen.errors, evenSteps: even, psnr, measure: 'luma of the yuv420p picture each PNG makes, BT.709, every frame', minPsnr: floor, flatFrames: levels.filter((f) => f.flat).length, worstMeanStep: Math.round(Math.max(0, ...levels.map((f, k) => Math.abs(f.mean - sources[k]?.mean))) * 1000) / 1000, problems }, decoded: seen.frames.map((f) => f.hash) }
}

async function doChunk(ctx, src, c, progress) {
  const f = filesOf(ctx, c)
  const { dir, keyFile, key } = dropStaleFrames(ctx, c)
  if (!ctx.standIn && freeDiskGb() < cfg.sandbox.minFreeDiskGb) throw new Error(`only ${freeDiskGb().toFixed(1)} GB of disk is free, under sandbox.minFreeDiskGb ${cfg.sandbox.minFreeDiskGb}. Nothing was dropped: make room and run the same command again.`)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(keyFile)) writeJsonAtomic(keyFile, key)
  const factsFile = path.join(dir, 'source.json')
  const frames = []
  let kept = 0
  for (const index of framesOf(c)) {
    const had = frameOnDisk(ctx, c, index)
    const planned = progress.counts?.get(index)
    if (had && (planned === undefined || had.samples === undefined || had.samples === planned)) {
      frames.push(had)
      kept++
      continue
    }
    const file = path.join(dir, `${pad6(index)}.png`)
    const t0 = Date.now()
    const stays = `${frames.length} of this chunk's ${c.last - c.first + 1} frames are PNGs in ${short(dir)} and stay there.`
    let png
    let rgb
    let notNumber
    let sanityMs
    let first
    let samples
    try {
      ;({ png, rgb, samples, notNumber = null, sanityMs = null, first = null } = await src.picture(index))
      if (planned !== undefined && samples !== planned) throw new Error(`the page gave ${planned} samples for this frame when the range was counted and ${samples} when it was drawn`)
    } catch (e) {
      const more = String(e.message).split('\n').slice(1).join('\n')
      throw new Error(`${stoppedLine(c, index, e.message)} ${stays}${more ? `\n${more}` : ''}`)
    }
    const seconds = (Date.now() - t0) / 1000
    if (!fs.existsSync(factsFile)) writeJson(factsFile, src.facts())
    const seen = pictureLevels(rgb)
    if (seen.flat && ctx.engine) throw new Error(`${stoppedLine(c, index, 'the frame came back as one flat value over the whole picture. Nothing was written for it. Look at dmesg for a killed chrome process.')} ${stays}`)
    const side = { index, seconds: Math.round(seconds * 1000) / 1000, ...(samples === undefined ? {} : { samples }), sha256: sha256(rgb), mean: Math.round(seen.mean * 1000) / 1000, flat: seen.flat, ...(notNumber === null ? {} : { notNumber, sanityMs, ...(first ? { notNumberFirst: first } : {}) }) }
    writeJson(file.replace(/\.png$/, '.json'), side)
    fs.writeFileSync(`${file}.tmp`, png)
    fs.renameSync(`${file}.tmp`, file)
    if (notNumber > 0) {
      const kept = path.join(ctx.work, 'not-a-number', `${pad6(index)}.png`)
      fs.mkdirSync(path.dirname(kept), { recursive: true })
      fs.copyFileSync(file, kept)
      say(`${notNumberLoud(ctx.what, index, notNumber, first)} Its PNG is kept as ${short(kept)}.`)
    }
    frames.push({ file, ...side })
    progress.left--
    progress.rendered++
    progress.seconds += seconds
    if (samples !== undefined) {
      progress.samplesDone += samples
      progress.samplesLeft = Math.max(0, progress.samplesLeft - samples)
    }
    say(heartbeat({ chunk: c, frame: index, seconds, left: progress.left, average: progress.seconds / progress.rendered, ...(samples === undefined ? {} : { samples, samplesLeft: progress.samplesLeft, perSample: progress.seconds / progress.samplesDone }) }))
  }
  if (kept) say(`chunk ${pad6(c.first)}-${pad6(c.last)}: ${kept} of its ${frames.length} frames were on disk and were not rendered again`)

  const tmp = path.join(ctx.work, `${path.basename(f.mp4)}.new`)
  const e0 = Date.now()
  let facts = src.facts()
  if (!facts) {
    try {
      facts = readJson(factsFile)
    } catch {
      facts = { graphics: 'not recorded', browser: 'not recorded' }
    }
  }
  let encoderArgs
  let verify
  let decoded
  const tried = []
  for (const crf of crfLadder(INTER.crf)) {
    encoderArgs = await encodeMasterChunk({ files: frames.map((x) => x.file), video: { ...intermediateVideo(), crf }, fps: FPS, gop: SIZE, out: tmp })
    ;({ verify, decoded } = await verifyChunk(tmp, frames, ctx.floor))
    tried.push({ crf, bytes: fs.statSync(tmp).size, least: verify.psnr.least, mean: verify.psnr.mean })
    if (verify.ok || !verify.onlyTheFloor) break
    say(`chunk ${pad6(c.first)}-${pad6(c.last)} at crf ${crf}: frame ${verify.psnr.leastFrame} is ${verify.psnr.least} dB from its PNG, under the floor of ${ctx.floor}, so it is encoded again from its PNGs at a lower crf`)
  }
  const encodeSeconds = (Date.now() - e0) / 1000
  delete verify.onlyTheFloor
  verify.tried = tried
  if (!verify.ok) {
    fs.rmSync(tmp, { force: true })
    throw new Error(`chunk ${pad6(c.first)}-${pad6(c.last)} did not pass its check after encoding: ${verify.problems.join('; ')}. Its frames stay in ${short(dir)}.`)
  }
  fs.mkdirSync(ctx.out, { recursive: true })
  const middle = frames[Math.floor(frames.length / 2)]
  await sharp(middle.file).resize({ width: LOOK_WIDTH }).jpeg(stillJpeg).toFile(f.look)
  let still = null
  if (f.still) {
    const bytes = fs.statSync(frames[0].file).size
    if (bytes > STILL_MAX_MB * 1e6) throw new Error(`frame 0 of the loop is ${mb(bytes)} MB as a PNG, over the ${STILL_MAX_MB} MB a screenshot may be. Nothing was shipped. Its frames stay in ${short(dir)}.`)
    fs.copyFileSync(frames[0].file, `${f.still}.tmp`)
    fs.renameSync(`${f.still}.tmp`, f.still)
    still = { file: path.basename(f.still), sha256: fileSha(f.still), bytes }
  }
  const versions = toolVersions()
  const record = {
    what: ctx.what,
    first: c.first,
    last: c.last,
    frames: frames.length,
    total: ctx.total,
    engineHash: ctx.hash,
    commit: repoFacts().commit,
    samples: ctx.samples,
    ...(ctx.engine ? { frameSamples: frames.map((x) => x.samples), motion: ctx.rule.motion } : {}),
    format: ctx.format.id,
    width: ctx.format.width,
    height: ctx.format.height,
    fps: FPS,
    renderer: ctx.renderer,
    flatFrames: frames.filter((x) => x.flat === true).map((x) => x.index),
    ...(ctx.engine ? { seasonHashes: currentSeasonHashes() } : {}),
    graphics: facts.graphics,
    ...(ctx.calibration ? { calibration: ctx.calibration } : {}),
    browser: facts.browser,
    ffmpeg: versions.ffmpeg,
    x264: versions.x264,
    encoderArgs,
    sha256: fileSha(tmp),
    bytes: fs.statSync(tmp).size,
    frameHashes: frames.map((x) => x.sha256),
    decodedHashes: decoded,
    frameSeconds: frames.map((x) => x.seconds),
    encodeSeconds: Math.round(encodeSeconds * 10) / 10,
    machine: machineId(),
    limits: limitsRecord(LIMITS),
    boot: bootId(),
    ...(ctx.engine ? { notNumber: notNumberRecord(frames, facts.precision ?? null) } : {}),
    ...(ctx.engine && frames.some((x) => x.notNumber > 0) ? { mark: NOT_A_NUMBER } : {}),
    verify,
    look: path.basename(f.look),
    ...(still ? { still } : {}),
    ...(ctx.test ? { test: true } : {}),
    ...(Object.keys(ctx.overrides).length ? { overrides: ctx.overrides } : {}),
    time: new Date().toISOString(),
  }
  fs.renameSync(tmp, f.mp4)
  for (const old of fs.readdirSync(ctx.out)) if (old.startsWith(`${path.basename(f.mp4)}.part-`)) fs.rmSync(path.join(ctx.out, old), { force: true })
  if (record.bytes > INTER.partMb * 1e6) record.parts = splitFile(f.mp4, ctx.out, INTER.partMb).parts
  writeJsonAtomic(f.json, record)
  fs.rmSync(dir, { recursive: true, force: true })
  const took = record.frameSeconds.reduce((a, b) => a + b, 0)
  const mean = took / frames.length
  const drawn = ctx.engine ? countFacts(record.frameSamples, ctx.samples, c.first) : null
  say(`finished ${chunkStem(ctx.what, c.first, c.last)}: ${frames.length} frames, ${mean.toFixed(1)} s a frame${drawn ? ` in the mean, ${(took / drawn.sum).toFixed(2)} s a sample (${drawn.sum} samples: ${drawn.over ? `${drawn.over} of the frames over the base of ${ctx.samples}, the most ${drawn.most} at frame ${drawn.mostAt}` : `every frame at the base of ${ctx.samples}`})` : ''}, crf ${crfOf(record)}, ${mb(record.bytes)} MB${record.parts ? ` in ${record.parts.length} parts` : ''}, luma PSNR against the PNGs least ${verify.psnr.least} dB (frame ${verify.psnr.leastFrame}), mean ${verify.psnr.mean} dB. Its PNGs are deleted${still ? `, but for ${short(f.still)}` : ''}${record.mark ? `. It is marked ${NOT_A_NUMBER}: frames ${notNumberFrames(record)}` : ''}`)
  return record
}

function shipFiles(ctx, c) {
  const f = filesOf(ctx, c)
  const to = (file) => `${ctx.test ? 'test/' : ''}${ctx.what}/${path.basename(file)}`
  return [f.json, f.look].map((src) => ({ src, to: to(src) }))
}

function ship(shipper, ctx, c) {
  if (!shipper) return
  let record = null
  try {
    record = readJson(filesOf(ctx, c).json)
  } catch {
    record = null
  }
  const made = shipper.add(shipFiles(ctx, c), shipTitle(ctx.what, c, record, ctx.test))
  const pushed = shipper.push()
  if (made && pushed) say(shippedLine(ctx.what, c, record, shipper.branch, shipper.tries))
  else if (pushed && shipper.tries > 1) say(`the push to ${shipper.branch} went through at try ${shipper.tries}`)
}

function holdLock(what) {
  const busy = renderBusy()
  if (busy) throw new Error(`a render job is running in this VM: ${busy.what} (pid ${busy.pid})`)
  writeJson(LOCK, { pid: process.pid, what, since: new Date().toISOString() })
  process.on('exit', () => {
    try {
      if (readJson(LOCK).pid === process.pid) fs.rmSync(LOCK)
    } catch {}
  })
}

function fillSimcache(what) {
  for (let i = 0; i < 40; i++) {
    const r = spawnSync(process.execPath, [rel('tools', 'simcache.mjs'), what === 'loop' ? 'loop' : 'film'], { cwd: rel(), encoding: 'utf8', maxBuffer: 1 << 26 })
    if (r.status !== 0) throw new Error(`the checkpoints could not be made: ${(r.stderr || r.stdout).trim().split('\n').slice(-2).join(' ')}`)
    if (/complete for engine/.test(r.stdout)) return
  }
  throw new Error('the checkpoints were not complete after 40 runs of npm run simcache')
}

async function withWorkers(ctx, shipper, count) {
  if (!ctx.standIn) {
    requireBuild()
    say(`making the checkpoints first, so that ${ctx.procs} processes never write the same one`)
    fillSimcache(ctx.what)
    holdLock(`master ${process.argv.slice(2).join(' ')}`)
  }
  const asked = await source(ctx, false)
  try {
    await count(asked)
  } finally {
    await asked.close()
  }
  const passed = process.argv.slice(2).filter((a, i, all) => a !== '--ship' && all[i - 1] !== '--ship')
  const failed = []
  const stops = new Map()
  await Promise.all(
    Array.from({ length: ctx.procs }, (_, w) => {
      return new Promise((done) => {
        const child = spawn(process.execPath, [rel('tools', 'master.mjs'), ...passed, '--worker', String(w)], { cwd: rel(), stdio: ['ignore', 'pipe', 'pipe'] })
        let rest = ''
        const line = (l) => {
          if (!l) return
          say(`[${w}] ${l}`)
          const stop = l.startsWith('master: ') ? stoppedAt(l) : null
          if (stop) stops.set(w, stop)
          const m = /^finished \S+-(\d{6})-(\d{6}):/.exec(l)
          if (m) ship(shipper, ctx, { first: Number(m[1]), last: Number(m[2]) })
        }
        const take = (d) => {
          const lines = (rest + d).split('\n')
          rest = lines.pop()
          lines.forEach(line)
        }
        child.stdout.on('data', take)
        child.stderr.on('data', take)
        child.on('close', (code) => {
          line(rest)
          if (code !== 0) failed.push(w)
          done()
        })
      })
    }),
  )
  if (!failed.length) return
  failed.sort((a, b) => a - b)
  const lines = failed.map((w) => {
    const s = stops.get(w)
    return s ? `render process ${w} ${stoppedLine(s, s.frame, s.why)}` : `render process ${w} stopped with an error: its last lines are above, marked [${w}]`
  })
  throw new Error(`${lines.join('\n')}\n${goOn(ctx, [...stops.values()])}`)
}

function goOn(ctx, stops) {
  const lost = stops.some((s) => /context was lost|flat value/.test(s.why))
  return `Nothing drawn is lost: every finished frame is a PNG under ${short(ctx.work)}, every finished chunk is in ${short(ctx.out)}, and neither is drawn again.${lost ? ` A lost context is most often a browser killed for memory (dmesg says so): if it was, go on with a smaller --procs${ctx.procs > 1 ? ` than ${ctx.procs}` : ''}.` : ''}\nTo go on from there: ${COMMAND}`
}

async function render() {
  const ctx = setup()
  const worker = args.worker === undefined ? null : Number(args.worker)
  if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')
  const tooMany = ctx.engine && !ctx.standIn ? procsProblem(ctx.procs, ctx.format.id, LIMITS) : null
  if (tooMany) throw new Error(tooMany)
  if (ctx.engine && !ctx.standIn && !ctx.calibration) throw new Error(`this machine has no calibration for this build and ${ctx.renderer}. Run npm run master -- --calibrate first (one picture, a few minutes), and check that its first line is the one every other machine printed.`)
  const own = worker === null ? ctx.chunks : split(ctx.chunks, ctx.procs, worker)
  const todo = stillToDo(own, { done: (c) => !!finished(ctx, c), sweep: (c) => dropStaleFrames(ctx, c), has: (c, i) => !!frameOnDisk(ctx, c, i) })
  const mine = todo
  const progress = { left: mine.reduce((n, c) => n + c.missing.length, 0), rendered: 0, seconds: 0, samplesLeft: 0, samplesDone: 0, counts: /** @type {Map<number, number> | undefined} */ (undefined) }
  const count = async (src) => {
    if (!ctx.engine) return
    const list = (worker === null ? ctx.chunks : mine).flatMap(framesOf)
    const counts = await src.counts(list)
    progress.counts = new Map(list.map((i, k) => [i, counts[k]]))
    progress.samplesLeft = mine.reduce((n, c) => n + c.missing.reduce((m, i) => m + (progress.counts?.get(i) ?? 0), 0), 0)
    if (worker === null) say(countsLine(ctx.rule, countFacts(counts, ctx.samples, list[0])))
  }
  let shipper = null
  if (worker === null) {
    const all = ctx.chunks.length
    say(`${ctx.what}: frames ${ctx.chunks[0].first} to ${ctx.chunks[all - 1].last} of ${ctx.total}, ${all} ${all === 1 ? 'chunk' : 'chunks'} of ${SIZE}, ${ctx.format.width} x ${ctx.format.height}, ${ctx.engine ? `${ctx.rule.motion ? 'a base of ' : ''}${ctx.samples} ${ctx.samples === 1 ? 'sample' : 'samples'} a frame` : 'from the opening pack'}${ctx.test ? ', a TEST that no master is made from' : ''}`)
    const slow = ctx.engine && !ctx.standIn ? procsGainLine(ctx.procs, LIMITS) : null
    if (slow) say(slow)
    say(`${all - todo.length} ${all - todo.length === 1 ? 'chunk is' : 'chunks are'} finished, ${todo.length} to do, ${progress.left} frames to render (${todo.reduce((n, c) => n + c.last - c.first + 1 - c.missing.length, 0)} more are on disk as PNGs)`)
    if (args.ship !== undefined) {
      shipper = new Shipper({ branch: argText(args, 'ship', ''), say })
      const who = identityProblem(mainAuthor(), shipper.identity())
      if (who) throw new Error(who)
      shipper.prepare()
      for (const c of ctx.chunks) if (!todo.some((t) => t.first === c.first)) ship(shipper, ctx, c)
    }
  }
  if (mine.length) {
    if (worker === null && ctx.procs > 1 && ctx.engine) await withWorkers(ctx, shipper, count)
    else {
      const src = lazySource(ctx, worker === null && !ctx.standIn)
      try {
        await count(src)
        for (const c of mine) {
          await doChunk(ctx, src, c, progress)
          ship(shipper, ctx, c)
        }
      } catch (e) {
        const stop = worker === null ? stoppedAt(e.message) : null
        throw stop ? new Error(`${e.message}\n${goOn(ctx, [stop])}`) : e
      } finally {
        await src.close()
      }
    }
  }
  if (worker !== null) return
  if (shipper && shipper.unpushed) {
    if (!shipper.push()) throw new Error(`the chunks are finished and on disk in ${short(ctx.out)}, and the last push to ${shipper.branch} was refused. Run the same command again to push them.`)
    if (shipper.tries > 1) say(`the push to ${shipper.branch} went through at try ${shipper.tries}`)
  }
  say(`${ctx.what}: frames ${ctx.chunks[0].first} to ${ctx.chunks[ctx.chunks.length - 1].last} are finished in ${short(ctx.out)}${shipper ? `, their records and looks on ${shipper.branch}` : ''}`)
  printOutbox(ctx)
  const marked = ctx.chunks.map((c) => ({ file: filesOf(ctx, c).json, record: finished(ctx, c) })).filter((c) => c.record && notNumberOf(c.record))
  for (const c of marked) say(`${NOT_A_NUMBER}: ${notNumberLine({ ...c, from: short(c.file) })}`)
  if (marked.length) throw new Error(`${marked.length} ${marked.length === 1 ? 'chunk of this range is' : 'chunks of this range are'} marked ${NOT_A_NUMBER}. Every other chunk is drawn and may be sent. Tell /root the frames above. Do not draw them again hoping: the same frame draws the same values, and no master is encoded from a marked chunk.`)
}

function printOutbox(ctx) {
  const files = []
  for (const c of ctx.chunks) {
    const f = filesOf(ctx, c)
    const r = finished(ctx, c)
    if (!r) continue
    files.push(f.json, ...(r.parts ? r.parts.map((p) => path.join(ctx.out, p.file)) : [f.mp4]))
    if (f.still) files.push(f.still)
  }
  const bytes = files.reduce((n, x) => n + fs.statSync(x).size, 0)
  const groups = sendGroups(files)
  say(`to send to the joining agent by attachment: ${files.length} files, ${mb(bytes)} MB, none over ${INTER.partMb} MB, in ${groups.length} ${groups.length === 1 ? 'message' : 'messages'} of at most 10:`)
  groups.forEach((g, k) => say(`  message ${k + 1}: ${g.map(short).join(' ')}`))
}

function printCover(chunks, open = []) {
  for (const r of coverReport(chunks, totalsFromCut(), SIZE, open)) {
    say(`${r.what}: ${r.chunks} of ${r.wanted} chunks. There: ${r.there.length ? r.there.map(span).join(', ') : 'nothing'}. Missing: ${r.missing.length ? r.missing.map(span).join(', ') : 'nothing'}${r.notAgreed.length ? `. Held but not agreed: ${r.notAgreed.map(span).join(', ')}` : ''}`)
  }
  const tests = chunks.filter((c) => c.record.test)
  if (tests.length) say(`test chunks, which no master is made from: ${tests.length} (${[...new Set(tests.map((c) => c.record.what))].join(', ')})`)
}

function collect() {
  const dir = path.resolve(argText(args, 'collect', ''))
  if (args.collect === true) throw new Error(`--collect takes a folder.\n${USAGE}`)
  if (dir === rel() || dir.startsWith(rel('.git'))) throw new Error('--collect takes a folder of its own, never the repo itself')
  if (args['no-branches'] !== true) {
    const found = collectBranches({ dir, say })
    say(`${found.length} ${found.length === 1 ? 'branch matches' : 'branches match'} ${M.chunkBranches}, their records laid out under ${short(dir)}`)
  } else fs.mkdirSync(dir, { recursive: true })
  let incomplete = []
  if (args.files !== undefined) {
    const folder = path.resolve(argText(args, 'files', ''))
    const keep = args.keep === true
    const got = takeFiles(folder, dir, { keep })
    incomplete = got.problems
    say(`from ${short(folder)}: ${got.records} new ${got.records === 1 ? 'record' : 'records'}, ${got.whole} ${got.whole === 1 ? 'chunk' : 'chunks'} that came whole, ${got.fromParts} put together from parts, ${got.stills} ${got.stills === 1 ? 'screenshot' : 'screenshots'}; every one has the sha256 its record names${keep ? '' : '. What was taken is no longer in that folder'}`)
    for (const p of got.problems) say(`NOT COMPLETE: ${p}`)
    if (got.strangers.length) say(`${got.strangers.length} ${got.strangers.length === 1 ? 'file' : 'files'} in ${short(folder)} that no record here names (left there): ${got.strangers.slice(0, 8).map((f) => path.basename(f)).join(', ')}${got.strangers.length > 8 ? ', ...' : ''}`)
  }
  const held = heldRanges(readChunks([rel('out', 'master'), dir]), { take: parseTake(args.take), exists: fs.existsSync })
  for (const g of held) if (g.holders.length > 1) say(g.taken ? heldLine(g) : `NOT AGREED: ${heldLine(g)}`)
  const open = held.filter((g) => !g.taken)
  const all = held.map((g) => markedHolder(g) ?? g.taken ?? g.holders[0])
  const taken = held.filter((g) => g.taken && fs.existsSync(g.taken.file)).map((g) => g.taken)
  const waiting = held.filter((g) => g.taken && !fs.existsSync(g.taken.file)).map((g) => g.taken)
  if (waiting.length) say(`${waiting.length} ${waiting.length === 1 ? 'record has' : 'records have'} no picture here yet: ${waiting.slice(0, 12).map(chunkName).join('; ')}${waiting.length > 12 ? '; ...' : ''}`)
  const nan = all.filter((c) => notNumberOf(c.record))
  for (const c of nan) say(`${NOT_A_NUMBER}: ${notNumberLine(c)}. Do not encode from it, and do not draw it again hoping: tell /root the frames.`)
  const unknown = all.filter((c) => c.record.renderer !== 'stand-in' && notNumberUnknown(c.record))
  if (unknown.length) say(`${unknown.length} ${unknown.length === 1 ? 'chunk carries' : 'chunks carry'} no full count of values that are no number (drawn before the tool read it, or on a page that cannot be read): ${unknown.slice(0, 12).map(chunkName).join('; ')}${unknown.length > 12 ? '; ...' : ''}`)
  const bad = flatChunks(taken)
  for (const b of bad) say(`FLAT: ${flatLine(b)}. Do not encode from it: render that range again.`)
  if (!bad.length) say(`no flat frame in ${taken.length} ${taken.length === 1 ? 'chunk' : 'chunks'}`)
  printCover(taken, open)
  if (bad.length || incomplete.length || nan.length || open.length) process.exit(1)
}

function flatChunks(chunks) {
  const bad = []
  for (const c of chunks) {
    if (!fs.existsSync(c.file)) continue
    const ok = new Set(c.record.flatFrames ?? [])
    const flat = frameLevels(c.file).map((f, k) => (f.flat ? c.record.first + k : -1)).filter((i) => i >= 0 && !ok.has(i))
    if (flat.length) bad.push({ chunk: c, flat })
  }
  return bad
}

const flatLine = (b) => `${b.chunk.from} (${b.chunk.record.what} ${b.chunk.record.first} to ${b.chunk.record.last}, drawn on ${b.chunk.record.machine}) holds ${b.flat.length} flat ${b.flat.length === 1 ? 'frame' : 'frames'}: ${b.flat.slice(0, 12).join(', ')}`

const deliverPath = (which, test) => (test ? rel('out', 'work', 'master', 'test', resultName(which)) : rel('out', 'deliver', resultName(which)))

function filmBBest(test) {
  try {
    const r = readJson(`${deliverPath('film-b', test)}.json`)
    return r.passed === true && typeof r.psnr?.bestHold?.mean === 'number' ? r.psnr.bestHold.mean : null
  } catch {
    return null
  }
}

async function measure({ file, which, plan, format, sound, test, totals, targetMb }) {
  const s = probeStreams(file)
  const v = s.video[0] ?? {}
  const a = s.audio[0] ?? null
  const seen = decodedHashes(file)
  const steps = seen.frames.slice(1).map((f, i) => (f.pts - seen.frames[i].pts) * seen.timeBase)
  const off = steps.filter((x) => Math.abs(x - 1 / FPS) > 1e-9)
  const list = seen.frames.length === plan.frames ? await framePsnr({ file, parts: plan.parts.map((p) => ({ file: p.file, frames: p.record.frames })), fps: FPS }) : []
  const psnr = psnrFacts(list, 0)
  const allowed = plan.parts.reduce((n, p) => n + (p.record.flatFrames ?? []).length, 0)
  const facts = {
    which,
    test,
    frames: seen.frames.length,
    wantFrames: plan.frames,
    decodeErrors: seen.ok ? [] : seen.errors.length ? seen.errors : ['an error'],
    format,
    width: v.width,
    height: v.height,
    steps: { off: off.length, count: steps.length, firstOff: off[0] ?? 0, start: (seen.frames[0]?.pts ?? 0) * seen.timeBase },
    rFrameRate: v.r_frame_rate,
    avgFrameRate: v.avg_frame_rate,
    pixFmt: v.pix_fmt,
    tags: `${v.color_space} / ${v.color_primaries} / ${v.color_transfer} / ${v.color_range}`,
    codec: v.codec_name,
    profile: v.profile,
    level: Number(v.level),
    refs: headerRefFrames(file),
    keys: keyFrames(file),
    sound: sound ? { wanted: true, codec: a?.codec_name ?? null, sampleRate: Number(a?.sample_rate), channels: a?.channels, kbps: a ? Number(a.bit_rate) / 1000 : 0, seconds: Number(a?.duration), pictureSeconds: Number(v.duration) } : { wanted: false, codec: a?.codec_name ?? null },
    flat: frameLevels(file).filter((f) => f.flat).length,
    flatAllowed: allowed,
    fast: startsFast(file),
    bytes: fs.statSync(file).size,
    targetMb,
    psnr,
    minPsnr: FINAL.minPsnr,
    keyint: FINAL.keyint,
    bestHold: which === 'loop' ? null : bestRun(list, FPS),
    opening: which === 'film-a' ? { found: plan.parts.filter((p) => p.record.what === 'opening').reduce((x, p) => x + p.record.frames, 0), wanted: totals.opening } : null,
    loop: which === 'loop' && list.length ? { first: list[0], last: list[list.length - 1], seamDb: FINAL.loop.seamDb, wanted: filmBBest(test) } : null,
  }
  return { facts, rows: encodeProofRows(facts), list, streams: s }
}

async function encodeMaster() {
  const which = argText(args, 'encode', '')
  if (!JOINS[which]) throw new Error(`--encode takes ${Object.keys(JOINS).join(', ')}.\n${USAGE}`)
  if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')
  const test = args.test === true
  if (args.gaps !== undefined && !test) throw new Error('--gaps is for tests only (with --test)')
  if (FINAL.keyint < FINAL.minKeyint) throw new Error(`--keyint ${FINAL.keyint} is under the least spacing ${FINAL.minKeyint}`)
  const overrides = overridden(['target-mb', 'preset', 'keyint', 'min-keyint', 'x264', 'final-min-psnr', 'crf', 'min-crf', 'loop-x264', 'seam-db'])
  if (Object.keys(overrides).length) say(`not from the config but from the command line: ${Object.entries(overrides).map(([k, v]) => `--${k} ${v}`).join(' ')}`)
  const from = args.from === undefined || args.from === true ? null : path.resolve(String(args.from))
  if (from && !fs.existsSync(from)) throw new Error(`--from ${args.from} does not exist. Run --collect ${args.from} first.`)
  const totals = totalsFromCut()
  const chunks = readChunks([rel('out', 'master'), ...(from ? [from] : [])]).filter((c) => c.test === test)
  const plan = joinPlan({ which, chunks, totals, test, take: parseTake(args.take), exists: fs.existsSync, size: test ? Math.max(SIZE, ...chunks.map((c) => c.record.frames ?? 0)) : SIZE, gaps: args.gaps === true, sha: (f) => (fs.existsSync(f) ? bigSha(f) : null) })
  if (!plan.ok) {
    say(`${which} cannot be encoded:`)
    for (const p of plan.problems) say(`- ${p}`)
    process.exit(1)
  }
  const bad = flatChunks(plan.parts)
  if (bad.length) {
    say(`${which} cannot be encoded:`)
    for (const b of bad) say(`- ${flatLine(b)}`)
    process.exit(1)
  }
  const r0 = plan.parts[0].record
  const format = test ? { id: r0.format, width: r0.width, height: r0.height } : formatById(M.format)
  if (!test && r0.format !== M.format) throw new Error(`the chunks are ${r0.format}, deliver.master.format is ${M.format}`)
  const seconds = plan.frames / FPS
  let sound = null
  if (SOUND[which]) {
    const file = args.sound && args.sound !== true ? path.resolve(String(args.sound)) : rel('audio', 'final', `${SOUND[which]}.wav`)
    if (!fs.existsSync(file)) throw new Error(`${short(file)} is not here, and ${which} is never encoded silent. Pass --sound FILE with its final mix.`)
    sound = { file, offsetSeconds: 0, seconds: soundSeconds(file) }
    if (Math.abs(sound.seconds - seconds) > 1 / FPS) say(`note: ${short(file)} is ${sound.seconds.toFixed(3)} s and the picture is ${seconds.toFixed(3)} s, so the sound is ${sound.seconds > seconds ? 'cut' : 'filled with silence'} to the picture's length`)
  }
  const isLoop = which === 'loop'
  const targetMb = isLoop ? null : number('target-mb', M.final.targetMb[which], { least: 0.000001, most: cfg.platform.maxFileMb })
  const size = plan.parts.reduce((x, p) => x + p.record.bytes, 0)
  const room = ((targetMb ?? (M.video.maxrateMbps * seconds) / 8) * 1e6) * 2.2 + 256e6
  if (freeDiskGb() * 1024 ** 3 < room) throw new Error(`the encode needs ${mb(room)} MB of free disk and ${(freeDiskGb() * 1024).toFixed(0)} MB is free`)
  const out = deliverPath(which, test)
  const threads = Math.max(1, Math.min(os.cpus().length, Math.ceil(LIMITS.cpus)))
  const parts = plan.parts.map((p) => ({ file: p.file, frames: p.record.frames }))
  say(`encoding ${which} once, whole: ${plan.parts.length} chunks, ${plan.frames} frames, ${seconds.toFixed(3)} s, ${mb(size)} MB of intermediate picture${sound ? `, sound ${short(sound.file)}` : ', no sound'}`)
  const tries = []
  let encoderArgs
  let proof
  const t0 = Date.now()
  if (isLoop) {
    const wanted = filmBBest(test)
    let crf = FINAL.loop.crf
    for (;;) {
      encoderArgs = finalVideoArgs(M.video, FINAL, { crf, params: FINAL.loop.params, threads })
      say(`the loop at crf ${crf}, one pass, preset ${FINAL.preset}`)
      await encodeFinal({ parts, args: encoderArgs, out: `${out}.new`, fps: FPS, passes: 1, sound: null, audioKbps: M.audioKbps })
      proof = await measure({ file: `${out}.new`, which, plan, format, sound, test, totals, targetMb })
      tries.push({ crf, bytes: proof.facts.bytes, psnr: proof.facts.psnr })
      if (wanted === null || proof.facts.psnr.least >= wanted || crf - FINAL.loop.crfStep < FINAL.loop.minCrf) break
      say(`its least frame is ${proof.facts.psnr.least} dB (frame ${proof.facts.psnr.leastFrame}) and the best second of film B is ${dB(wanted)} dB, so it is encoded again ${FINAL.loop.crfStep} lower`)
      crf -= FINAL.loop.crfStep
    }
  } else {
    let kbps = finalKbps({ targetMb, seconds, audioKbps: sound ? M.audioKbps : 0 })
    for (let go = 0; go < 2; go++) {
      encoderArgs = finalVideoArgs(M.video, FINAL, { kbps, threads })
      say(`two passes at ${kbps} kbps of picture for ${targetMb} MB with its sound, preset ${FINAL.preset}, a key frame every ${FINAL.keyint} frames at most`)
      await encodeFinal({ parts, args: encoderArgs, out: `${out}.new`, fps: FPS, passes: FINAL.passes, sound, audioKbps: M.audioKbps })
      const bytes = fs.statSync(`${out}.new`).size
      tries.push({ kbps, bytes })
      if (bytes <= targetMb * 1e6 || go === 1) break
      const next = Math.floor(kbps * ((targetMb * 1e6) / bytes) * 0.99)
      say(`it came out at ${mb(bytes)} MB, over the ${targetMb} MB target, so it is encoded once more at ${next} kbps`)
      kbps = next
    }
    proof = await measure({ file: `${out}.new`, which, plan, format, sound, test, totals, targetMb })
  }
  const encodeSeconds = (Date.now() - t0) / 1000
  const final0 = () => `${out}.new`
  let still = null
  const first = plan.parts[0]
  let seam = null
  if (isLoop) {
    const png = path.join(path.dirname(first.file), stillName(0))
    const told = first.record.still
    const ok = first.record.first === 0 && fs.existsSync(png) && bigSha(png) === told?.sha256
    proof.rows.push({ check: 'screenshot', wanted: "the PNG of frame 0, the file its chunk's record names", found: ok ? `${stillName(0)}, ${mb(fs.statSync(png).size)} MB` : 'not there, or not that file', pass: ok ? true : test ? null : false })
    if (ok) still = png
    const last = plan.parts[plan.parts.length - 1].record
    const from = { first: first.record.verify?.psnr?.frames?.[0] ?? null, last: last.verify?.psnr?.frames?.[last.frames - 1] ?? null }
    const direct = ok ? (await framePsnr({ file: final0(), files: [png], fps: FPS, pixFmt: M.video.pixFmt, frames: 1 }))[0] : null
    seam = { firstAgainstItsPng: direct === undefined ? null : direct, intermediateAgainstPng: from }
    proof.rows.push({ check: 'frame 0 against the screenshot', wanted: 'measured: the film\'s first frame against the PNG itself', found: direct === null || direct === undefined ? 'no screenshot here' : `${dB(direct)} dB (its intermediate was ${from.first ?? '?'} dB from that PNG, the last frame's ${from.last ?? '?'} dB from its own)`, pass: null })
  }
  const text = table(proof.rows)
  say(text)
  const passed = proof.rows.every((x) => x.pass !== false)
  const final = passed ? out : out.replace(/\.mp4$/, '.unproven.mp4')
  fs.renameSync(`${out}.new`, final)
  let stillOut = null
  if (passed && still) {
    stillOut = path.join(path.dirname(out), test ? `test-${resultName('still')}` : resultName('still'))
    fs.copyFileSync(still, stillOut)
  }
  const of = (key, fallback = undefined) => Object.fromEntries(JOINS[which].map((w) => [w, plan.parts.find((p) => p.record.what === w)?.record[key] ?? fallback]))
  writeJson(`${final}.json`, {
    which,
    ...(test ? { test: true } : {}),
    frames: plan.frames,
    seconds,
    fps: FPS,
    format: format.id,
    width: format.width,
    height: format.height,
    engineHash: of('engineHash'),
    samples: of('samples'),
    renderer: of('renderer'),
    calibration: of('calibration', null),
    seasonHashes: plan.parts.find((p) => p.record.seasonHashes)?.record.seasonHashes ?? null,
    intermediateArgs: r0.encoderArgs,
    encoderArgs,
    passes: isLoop ? 1 : FINAL.passes,
    overrides,
    targetMb,
    tries,
    encodeSeconds: Math.round(encodeSeconds),
    sha256: bigSha(final),
    bytes: fs.statSync(final).size,
    psnr: { ...proof.facts.psnr, measure: 'luma, every frame against its decoded intermediate chunk', seam, bestHold: proof.facts.bestHold, first: proof.list[0] ?? null, last: proof.list[proof.list.length - 1] ?? null },
    framePsnr: proof.list.map((x) => Math.round(x * 100) / 100),
    keyFrames: proof.facts.keys,
    sound: sound ? { file: short(sound.file), sha256: fileSha(sound.file), seconds: sound.seconds, kbps: M.audioKbps } : null,
    still: stillOut ? { file: short(stillOut), sha256: fileSha(stillOut) } : null,
    chunks: plan.parts.map((p) => ({ from: p.from, what: p.record.what, first: p.record.first, last: p.record.last, sha256: p.record.sha256, machine: p.record.machine, boot: p.record.boot, commit: p.record.commit, psnr: p.record.verify?.psnr })),
    machines: [...new Set(plan.parts.map((p) => `${p.record.machine} · ${p.record.boot ?? ''}`))],
    joinedOn: machineId(),
    tools: toolVersions(),
    proof: proof.rows,
    table: text.split('\n'),
    passed,
    time: new Date().toISOString(),
  })
  if (!passed) {
    say(`the proof did not pass, so the file is kept as ${short(final)} and is not a master`)
    process.exit(1)
  }
  say(`${short(final)}: ${plan.frames} frames, ${hours(seconds)}, ${mb(fs.statSync(final).size)} MB, encoded and proven in ${hours(encodeSeconds)}${stillOut ? `, screenshot ${short(stillOut)}` : ''}`)
  if (fs.statSync(final).size > INTER.partMb * 1e6) say(`it is over ${INTER.partMb} MB, so it leaves this machine in parts: npm run master -- --split ${short(final)}`)
}

function splitCommand() {
  if (args.split === true) throw new Error(`--split takes a file.\n${USAGE}`)
  const file = path.resolve(argText(args, 'split', ''))
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`${short(file)} is not a file`)
  const dir = `${file}.parts`
  fs.rmSync(dir, { recursive: true, force: true })
  const made = splitFile(file, dir, INTER.partMb)
  writeJson(path.join(dir, `${path.basename(file)}.manifest.json`), { ...made, splitOn: machineId(), time: new Date().toISOString() })
  const files = [path.join(dir, `${path.basename(file)}.manifest.json`), ...made.parts.map((p) => path.join(dir, p.file))]
  const groups = sendGroups(files)
  say(`${short(file)}: ${mb(made.bytes)} MB, sha256 ${made.sha256}`)
  say(`${made.parts.length} parts of at most ${INTER.partMb} MB and a manifest in ${short(dir)}, to send in ${groups.length} ${groups.length === 1 ? 'message' : 'messages'} of at most 10 attachments:`)
  groups.forEach((g, k) => say(`  message ${k + 1}: ${g.map(short).join(' ')}`))
  say(`where they arrive: npm run master -- --unsplit FOLDER (the folder they were saved in, under any names)`)
}

function unsplitCommand() {
  if (args.unsplit === true) throw new Error(`--unsplit takes a folder.\n${USAGE}`)
  const dir = path.resolve(argText(args, 'unsplit', ''))
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`${short(dir)} is not a folder`)
  const manifests = []
  const isManifest = (p) => {
    try {
      if (!fs.statSync(p).isFile() || fs.statSync(p).size > 1e6) return null
      const m = readJson(p)
      return typeof m.sha256 === 'string' && typeof m.file === 'string' && Array.isArray(m.parts) && m.parts.every((x) => typeof x.sha256 === 'string') ? m : null
    } catch {
      return null
    }
  }
  for (const e of fs.readdirSync(dir)) {
    const m = isManifest(path.join(dir, e))
    if (m) manifests.push(m)
  }
  if (!manifests.length) throw new Error(`${short(dir)} holds no manifest (the file --split wrote beside the parts, <name>.manifest.json)`)
  if (args.out !== undefined && manifests.length > 1) throw new Error(`--out names one file and ${short(dir)} holds ${manifests.length} manifests`)
  const have = hashFolder(dir, (p) => !!isManifest(p))
  let failed = 0
  for (const m of manifests) {
    const out = args.out !== undefined ? path.resolve(argText(args, 'out', '')) : path.join(dir, path.basename(m.file))
    const got = unsplitFile(m, have, out)
    if (!got.ok) {
      failed++
      say(`NOT PUT TOGETHER: ${m.file}: ${got.why}${got.missing.length ? ` (${got.missing.join(', ')})` : ''}`)
      continue
    }
    say(`${short(out)}: ${mb(m.bytes)} MB from ${m.parts.length} parts, sha256 ${m.sha256}, the one its manifest names`)
  }
  if (failed) process.exit(1)
}

async function hdFromMaster() {
  const which = argText(args, 'hd', '')
  if (which !== 'film-a' && which !== 'film-b') throw new Error(`--hd takes film-a or film-b.\n${USAGE}`)
  if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')
  const test = args.test === true
  const src = test ? rel('out', 'work', 'master', 'test', resultName(which)) : rel('out', 'deliver', resultName(which))
  if (!fs.existsSync(src) || !fs.existsSync(`${src}.json`)) throw new Error(`${short(src)} is not here. Encode it first: npm run master -- --encode ${which}${test ? ' --test' : ''}`)
  const m = readJson(`${src}.json`)
  if (m.passed !== true) throw new Error(`${short(src)} did not pass its proof, so nothing is made from it`)
  if (fileSha(src) !== m.sha256) throw new Error(`${short(src)} is not the file its record names`)
  const fps = cfg.film.previewFps
  const every = m.fps / fps
  if (!Number.isInteger(every)) throw new Error(`the master is at ${m.fps} frames a second, which is not a whole multiple of film.previewFps ${fps}`)
  const hd = formatById(cfg.formats.hd.id)
  const size = test ? { id: hd.id, width: Math.round(m.width / 4) * 2, height: Math.round(m.height / 4) * 2 } : hd
  if (!test && (m.width !== hd.width * 2 || m.height !== hd.height * 2)) throw new Error(`the master is ${m.width} x ${m.height}, which is not twice ${hd.width} x ${hd.height}`)
  const settings = videoSettings({ format: size, fps })
  const letter = which === 'film-a' ? 'a' : 'b'
  const out = test ? rel('out', 'work', 'master', 'test', `film-${letter}-${hd.id}-final.${cfg.export.container}`) : rel('out', 'work', `film-${letter}-${hd.id}-final.${cfg.export.container}`)
  const frames = Math.ceil(m.frames / every)
  await scaleEvery({ src, every, settings, out: `${out}.new` })
  const seen = probe(`${out}.new`)
  if (seen.frames !== frames) {
    fs.rmSync(`${out}.new`, { force: true })
    throw new Error(`the scaled film holds ${seen.frames} frames, every ${every === 2 ? 'second' : `${every}th`} frame of ${short(src)} is ${frames}`)
  }
  const sha = fileSha(`${out}.new`)
  fs.renameSync(`${out}.new`, out)
  const built = m.engineHash['film-b']
  writeJson(`${out}.json`, {
    engineHash: built,
    seasonHashes: m.seasonHashes ?? currentSeasonHashes(),
    format: hd.id,
    tier: 'final',
    assets: 'full',
    diagnostic: '',
    renderer: m.renderer?.['film-b'],
    samples: m.samples,
    calibration: m.calibration,
    machine: m.machines,
    joinedOn: machineId(),
    time: new Date().toISOString(),
    fps,
    frames,
    seconds: frames / fps,
    which: letter,
    complete: !test,
    ...(test ? { test: true } : {}),
    sound: m.sound ? { file: m.sound.file, sha256: m.sound.sha256, offsetSeconds: 0 } : null,
    scaledFrom: { file: short(src), sha256: m.sha256, width: m.width, height: m.height, fps: m.fps, every },
    codec: settings.codec,
    mbps: settings.mbps,
    probe: seen,
    sha256: sha,
  })
  say(`scaled every ${every === 2 ? 'second' : `${every}th`} frame of ${short(src)} down to ${short(out)}: ${frames} frames at ${fps} a second, ${settings.width} x ${settings.height}, ${settings.codec} at ${settings.mbps} Mbps`)
  say(`ffprobe: ${probeLine(seen)}`)
  say(m.sound ? `sound: ${m.sound.file}, the master's own track, copied` : 'sound: none')
  if (built !== engineHash()) say(`note: the master was rendered from build ${built} and this clone is at ${engineHash()}, so npm run film -- --from-hd will not take this film here`)
  else say(`next: npm run film -- --which ${letter} --from-hd --tier final, then npm run keep -- --film`)
}

try {
  if (args.worker === undefined) say(limitsLine(LIMITS))
  const wrong = masterConfigProblems()
  if (wrong.length) throw new Error(`config/showcase.json: ${wrong.join('; ')}`)
  if (args.calibrate !== undefined) await calibrate()
  else if (args.hd !== undefined) await hdFromMaster()
  else if (args.collect !== undefined) collect()
  else if (args.encode !== undefined) await encodeMaster()
  else if (args.split !== undefined) splitCommand()
  else if (args.unsplit !== undefined) unsplitCommand()
  else if (args.join !== undefined) throw new Error('--join is gone: a master is one encode of the whole film from its chunks. Use --encode film-b|film-a|loop --from DIR')
  else if (args.what !== undefined) await render()
  else say(USAGE)
} catch (e) {
  say(`master: ${e.message}`)
  process.exit(1)
}
