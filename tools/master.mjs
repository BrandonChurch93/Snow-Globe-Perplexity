import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { bootId, parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, currentSeasonHashes, formatById, renderBusy, renderStill, requireBuild, stillSpec } from './lib/page.mjs'
import { engineHash, fileSha, sha256 } from './lib/hashes.mjs'
import { freeDiskGb, launch, machineId, pinnedBrowser, rendererName } from './lib/browser.mjs'
import { serve } from './lib/server.mjs'
import { Run, argFrame, argText, pngOk, short } from './lib/frames.mjs'
import { decodedHashes, decodedPictures, encodeMasterChunk, haveFfmpeg, join, masterVideoArgs, probe, probeLine, probeStreams, scaleEvery, soundSeconds, startsFast, stillJpeg, toolVersions, videoSettings } from './lib/encode.mjs'
import { FPS, JOINS, LOOK_WIDTH, M, SOUND, STILL_MAX_MB, WHATS, chunkDir, chunkStem, coverReport, dB, framesOf, heartbeat, hours, joinPlan, lumaPsnrOf, openingPack, pad6, psnrOf, rangeChunks, ranges, readChunks, recordMatchesRun, resultName, split, stillName, stillToDo, table, tierOf, totalsFromCut } from './lib/master.mjs'
import { Shipper, collectBranches, repoFacts } from './lib/mastergit.mjs'

const args = parseArgs(process.argv.slice(2))
const say = console.log
const USAGE = [
  'npm run master -- --what film-b|loop|opening [--first N --last M] [--ship BRANCH] [--procs P]',
  'npm run master -- --calibrate',
  'npm run master -- --hd film-a|film-b [--test]',
  'npm run master -- --collect DIR',
  'npm run master -- --join film-b|film-a|loop --from DIR',
  'For tests only: --samples S, --format F, --min-psnr N, and --join ... --test [--sound FILE]',
].join('\n')
const LOCK = rel('out', 'work', 'render.lock')
const COLOUR_TAGS = 'bt709 / bt709 / bt709 / tv'
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

function psnrFloor(test) {
  if (args['min-psnr'] === undefined) return M.minChunkPsnr
  const n = Number(args['min-psnr'])
  if (!test) throw new Error('--min-psnr is for tests only (with --samples or --format, or --join ... --test). A master is held to deliver.master.minChunkPsnr.')
  if (args['min-psnr'] === true || !(n > 0)) throw new Error('--min-psnr takes a number of dB')
  return n
}

const rgbOf = async (png) => sharp(png).removeAlpha().raw().toBuffer()

function setup() {
  const what = argText(args, 'what', '')
  if (!WHATS.includes(what)) throw new Error(`--what takes ${WHATS.join(', ')}.\n${USAGE}`)
  const engine = what !== 'opening'
  const test = args.samples !== undefined || args.format !== undefined
  const format = formatById(argText(args, 'format', M.format))
  const samples = engine ? whole('samples', M.samples[what]) : 0
  const procs = whole('procs', 1)
  const total = totalsFromCut()[what]
  if (!(total > 0)) throw new Error(`cut/CUTLIST.json holds no frame count for ${what}`)
  const chunks = rangeChunks(total, argFrame(args, 'first'), argFrame(args, 'last'))
  const work = test ? rel('out', 'work', 'master', 'test', what) : rel('out', 'work', 'master', what)
  const hash = engineHash()
  const renderer = engine ? rendererName(args.local === true) : 'pack'
  const calibration = engine ? calibrationOf(hash, renderer) : null
  const want = (c) => ({ what, first: c.first, last: c.last, engineHash: hash, samples, format: format.id, fps: FPS, test, renderer, calibration, encoderArgs: masterVideoArgs(M.video, M.chunkFrames) })
  return { what, engine, test, format, samples, procs, total, chunks, work, want, hash, renderer, calibration, floor: psnrFloor(test), out: chunkDir(what, test), local: args.local === true }
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
  return r
}

function frameOnDisk(ctx, c, index) {
  const f = path.join(filesOf(ctx, c).frames, `${pad6(index)}.png`)
  if (!pngOk(f, ctx.format)) return null
  try {
    const side = readJson(f.replace(/\.png$/, '.json'))
    return typeof side.sha256 === 'string' && side.index === index ? { file: f, ...side } : null
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
  return { what: ctx.what, engineHash: ctx.engine ? ctx.hash : '', samples: ctx.samples, format: ctx.format.id, width: ctx.format.width, height: ctx.format.height, renderer: ctx.renderer, calibration: ctx.calibration }
}

function dropStaleFrames(ctx, c) {
  const dir = filesOf(ctx, c).frames
  const keyFile = path.join(dir, 'frames.json')
  const key = framesKey(ctx)
  if (fs.existsSync(dir) && !(fs.existsSync(keyFile) && JSON.stringify(readJson(keyFile)) === JSON.stringify(key))) fs.rmSync(dir, { recursive: true, force: true })
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
  if (!ctx.engine) {
    const pack = await openingPack(args.pack && args.pack !== true ? path.resolve(String(args.pack)) : undefined)
    if (pack.fps !== FPS) throw new Error(`the opening pack is at ${pack.fps} frames a second, the master is at ${FPS}`)
    if (pack.width !== ctx.format.width || pack.height !== ctx.format.height) throw new Error(`the opening pack is ${pack.width} x ${pack.height}, the master is ${ctx.format.width} x ${ctx.format.height}`)
    if (pack.frameCount !== ctx.total) throw new Error(`the opening pack holds ${pack.frameCount} frames, cut/CUTLIST.json holds ${ctx.total} for the opening`)
    return {
      graphics: 'none, the pictures come from the opening pack',
      browser: 'none',
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
    return {
      graphics,
      browser: `${pinnedBrowser().name} ${session.browserVersion}`,
      picture: async (index) => {
        const png = await run.frame(track, page, index)
        return { png, rgb: await rgbOf(png) }
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

async function verifyChunk(file, frames, format, floor) {
  const n = frames.length
  const seen = decodedHashes(file)
  const steps = seen.frames.slice(1).map((f, i) => (f.pts - seen.frames[i].pts) * seen.timeBase)
  const even = steps.every((s) => Math.abs(s - 1 / FPS) < 1e-9)
  const places = [...new Set([0, Math.floor(n / 2), n - 1])]
  const names = ['first', 'middle', 'last']
  const psnr = {}
  const psnrRgb = {}
  let low = Infinity
  if (seen.frames.length === n) {
    const pictures = decodedPictures(file, places, format.width, format.height)
    for (let k = 0; k < places.length; k++) {
      const png = await rgbOf(frames[places[k]].file)
      const p = lumaPsnrOf(pictures[k], png)
      const name = names[places.length === 1 ? 0 : k === places.length - 1 ? 2 : k]
      psnr[name] = dB(p)
      psnrRgb[name] = dB(psnrOf(pictures[k], png).psnr)
      low = Math.min(low, p)
    }
  }
  const problems = []
  if (!seen.ok) problems.push(`the decoder wrote: ${seen.errors.join(' / ') || 'an error'}`)
  if (seen.frames.length !== n) problems.push(`it decodes to ${seen.frames.length} frames, not ${n}`)
  if (!even) problems.push(`its frames are not ${FPS} a second apart`)
  const v = probeStreams(file).video[0] ?? {}
  const tags = `${v.color_space} / ${v.color_primaries} / ${v.color_transfer} / ${v.color_range}`
  if (tags !== COLOUR_TAGS) problems.push(`its colour tags are ${tags}, not ${COLOUR_TAGS}`)
  if (seen.frames.length === n && low < floor) problems.push(`a decoded frame is ${dB(low)} dB from its PNG in luma, under ${floor === M.minChunkPsnr ? 'deliver.master.minChunkPsnr' : '--min-psnr'} ${floor}`)
  return { verify: { ok: problems.length === 0, frames: seen.frames.length, decodeErrors: seen.errors, evenSteps: even, psnr, psnrRgb, measure: 'luma, BT.709', minPsnr: floor, problems }, decoded: seen.frames.map((f) => f.hash) }
}

async function doChunk(ctx, src, c, progress) {
  const f = filesOf(ctx, c)
  const { dir, keyFile, key } = dropStaleFrames(ctx, c)
  if (freeDiskGb() < cfg.sandbox.minFreeDiskGb) throw new Error(`only ${freeDiskGb().toFixed(1)} GB of disk is free, under sandbox.minFreeDiskGb ${cfg.sandbox.minFreeDiskGb}. Nothing was dropped: make room and run the same command again.`)
  fs.mkdirSync(dir, { recursive: true })
  writeJson(keyFile, key)
  const frames = []
  let kept = 0
  for (const index of framesOf(c)) {
    const had = frameOnDisk(ctx, c, index)
    if (had) {
      frames.push(had)
      kept++
      continue
    }
    const file = path.join(dir, `${pad6(index)}.png`)
    const t0 = Date.now()
    const { png, rgb } = await src.picture(index)
    const seconds = (Date.now() - t0) / 1000
    const side = { index, seconds: Math.round(seconds * 1000) / 1000, sha256: sha256(rgb) }
    writeJson(file.replace(/\.png$/, '.json'), side)
    fs.writeFileSync(`${file}.tmp`, png)
    fs.renameSync(`${file}.tmp`, file)
    frames.push({ file, ...side })
    progress.left--
    progress.rendered++
    progress.seconds += seconds
    say(heartbeat({ chunk: c, frame: index, seconds, left: progress.left, average: progress.seconds / progress.rendered }))
  }
  if (kept) say(`chunk ${pad6(c.first)}-${pad6(c.last)}: ${kept} of its ${frames.length} frames were on disk and were not rendered again`)

  const tmp = path.join(ctx.work, `${path.basename(f.mp4)}.new`)
  const e0 = Date.now()
  const encoderArgs = await encodeMasterChunk({ files: frames.map((x) => x.file), video: M.video, fps: FPS, gop: M.chunkFrames, out: tmp })
  const encodeSeconds = (Date.now() - e0) / 1000
  const { verify, decoded } = await verifyChunk(tmp, frames, ctx.format, ctx.floor)
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
    format: ctx.format.id,
    width: ctx.format.width,
    height: ctx.format.height,
    fps: FPS,
    renderer: ctx.renderer,
    ...(ctx.engine ? { seasonHashes: currentSeasonHashes() } : {}),
    graphics: src.graphics,
    ...(ctx.calibration ? { calibration: ctx.calibration } : {}),
    browser: src.browser,
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
    boot: bootId(),
    verify,
    look: path.basename(f.look),
    ...(still ? { still } : {}),
    ...(ctx.test ? { test: true } : {}),
    time: new Date().toISOString(),
  }
  fs.renameSync(tmp, f.mp4)
  writeJson(f.json, record)
  fs.rmSync(dir, { recursive: true, force: true })
  const mean = record.frameSeconds.reduce((a, b) => a + b, 0) / frames.length
  say(`finished ${chunkStem(ctx.what, c.first, c.last)}: ${frames.length} frames, ${mean.toFixed(1)} s a frame, ${mb(record.bytes)} MB, luma PSNR against the PNGs ${Object.values(verify.psnr).join(' / ')} dB`)
  return record
}

function shipFiles(ctx, c) {
  const f = filesOf(ctx, c)
  const to = (file) => `${ctx.test ? 'test/' : ''}${ctx.what}/${path.basename(file)}`
  return [f.mp4, f.json, f.look, f.still].filter(Boolean).map((src) => ({ src, to: to(src) }))
}

function ship(shipper, ctx, c) {
  if (!shipper) return
  const made = shipper.add(shipFiles(ctx, c), `Chunk ${chunkStem(ctx.what, c.first, c.last)}${ctx.test ? ', a test' : ''}`)
  const pushed = shipper.push()
  if (made && pushed) say(`shipped ${chunkStem(ctx.what, c.first, c.last)} to ${shipper.branch}`)
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

async function withWorkers(ctx, todo, shipper) {
  requireBuild()
  say(`making the checkpoints first, so that ${ctx.procs} processes never write the same one`)
  fillSimcache(ctx.what)
  holdLock(`master ${process.argv.slice(2).join(' ')}`)
  const passed = process.argv.slice(2).filter((a, i, all) => a !== '--ship' && all[i - 1] !== '--ship')
  const failed = []
  await Promise.all(
    Array.from({ length: ctx.procs }, (_, w) => {
      return new Promise((done) => {
        const child = spawn(process.execPath, [rel('tools', 'master.mjs'), ...passed, '--worker', String(w)], { cwd: rel(), stdio: ['ignore', 'pipe', 'pipe'] })
        let rest = ''
        const line = (l) => {
          if (!l) return
          say(`[${w}] ${l}`)
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
  if (failed.length) throw new Error(`render process ${failed.join(', ')} stopped with an error. Run the same command again: it renders only what is missing.`)
}

async function render() {
  const ctx = setup()
  const worker = args.worker === undefined ? null : Number(args.worker)
  if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')
  if (ctx.engine && !ctx.calibration) throw new Error(`this machine has no calibration for this build and ${ctx.renderer}. Run npm run master -- --calibrate first (one picture, a few minutes), and check that its first line is the one every other machine printed.`)
  const todo = stillToDo(ctx.chunks, { done: (c) => !!finished(ctx, c), has: (c, i) => (dropStaleFrames(ctx, c), !!frameOnDisk(ctx, c, i)) })
  const lane = worker === null ? null : split(ctx.chunks, ctx.procs, worker)
  const mine = lane ? todo.filter((t) => lane.some((c) => c.first === t.first)) : todo
  const progress = { left: mine.reduce((n, c) => n + c.missing.length, 0), rendered: 0, seconds: 0 }
  let shipper = null
  if (worker === null) {
    const all = ctx.chunks.length
    say(`${ctx.what}: frames ${ctx.chunks[0].first} to ${ctx.chunks[all - 1].last} of ${ctx.total}, ${all} ${all === 1 ? 'chunk' : 'chunks'} of ${M.chunkFrames}, ${ctx.format.width} x ${ctx.format.height}, ${ctx.engine ? `${ctx.samples} ${ctx.samples === 1 ? 'sample' : 'samples'} a frame` : 'from the opening pack'}${ctx.test ? ', a TEST that no master is joined from' : ''}`)
    say(`${all - todo.length} ${all - todo.length === 1 ? 'chunk is' : 'chunks are'} finished, ${todo.length} to do, ${progress.left} frames to render (${todo.reduce((n, c) => n + c.last - c.first + 1 - c.missing.length, 0)} more are on disk as PNGs)`)
    if (args.ship !== undefined) {
      shipper = new Shipper({ branch: argText(args, 'ship', ''), say })
      shipper.prepare()
      for (const c of ctx.chunks) if (!todo.some((t) => t.first === c.first)) ship(shipper, ctx, c)
    }
  }
  if (mine.length) {
    if (worker === null && ctx.procs > 1 && ctx.engine) await withWorkers(ctx, todo, shipper)
    else {
      const src = await source(ctx, worker === null)
      try {
        for (const c of mine) {
          await doChunk(ctx, src, c, progress)
          ship(shipper, ctx, c)
        }
      } finally {
        await src.close()
      }
    }
  }
  if (worker !== null) return
  if (shipper && shipper.unpushed && !shipper.push()) throw new Error(`the chunks are finished and on disk in ${short(ctx.out)}, and the last push to ${shipper.branch} was refused. Run the same command again to push them.`)
  say(`${ctx.what}: frames ${ctx.chunks[0].first} to ${ctx.chunks[ctx.chunks.length - 1].last} are finished in ${short(ctx.out)}${shipper ? ` and on ${shipper.branch}` : ''}`)
}

function printCover(chunks) {
  for (const r of coverReport(chunks, totalsFromCut())) {
    say(`${r.what}: ${r.chunks} of ${r.wanted} chunks. There: ${r.there.length ? r.there.map(span).join(', ') : 'nothing'}. Missing: ${r.missing.length ? r.missing.map(span).join(', ') : 'nothing'}`)
  }
  const tests = chunks.filter((c) => c.record.test)
  if (tests.length) say(`test chunks, which no master is joined from: ${tests.length} (${[...new Set(tests.map((c) => c.record.what))].join(', ')})`)
}

function collect() {
  const dir = path.resolve(argText(args, 'collect', ''))
  if (args.collect === true) throw new Error(`--collect takes a folder.\n${USAGE}`)
  if (dir === rel() || dir.startsWith(rel('.git'))) throw new Error('--collect takes a folder of its own, never the repo itself')
  const found = collectBranches({ dir, say })
  say(`${found.length} ${found.length === 1 ? 'branch matches' : 'branches match'} ${M.chunkBranches}, laid out under ${short(dir)}`)
  printCover(readChunks([dir]))
}

const row = (check, wanted, found, pass) => ({ check, wanted, found, pass })

async function prove({ file, which, plan, format, sound, test, totals }) {
  const rows = []
  const s = probeStreams(file)
  const v = s.video[0] ?? {}
  const a = s.audio[0] ?? null
  const seen = decodedHashes(file)
  const n = seen.frames.length
  rows.push(row('frames', plan.frames, n, n === plan.frames))
  rows.push(row('decode errors', 'none', seen.ok ? 'none' : seen.errors.join(' / ') || 'some', seen.ok))
  rows.push(row('size', `${format.width} x ${format.height}`, `${v.width} x ${v.height}`, v.width === format.width && v.height === format.height))
  const steps = seen.frames.slice(1).map((f, i) => (f.pts - seen.frames[i].pts) * seen.timeBase)
  const off = steps.filter((x) => Math.abs(x - 1 / FPS) > 1e-9)
  rows.push(row('pts steps', `every one 1/${FPS} s`, off.length ? `${off.length} of ${steps.length} are not, the first ${off[0].toFixed(6)} s` : `${steps.length} of 1/${FPS} s, the first frame at ${(seen.frames[0]?.pts ?? 0) * seen.timeBase} s`, off.length === 0 && seen.frames[0]?.pts === 0))
  rows.push(row('frame rate', `${FPS}/1 constant`, `${v.r_frame_rate} and ${v.avg_frame_rate} on average`, v.r_frame_rate === `${FPS}/1` && v.avg_frame_rate === `${FPS}/1`))
  rows.push(row('pixel format', M.video.pixFmt, v.pix_fmt, v.pix_fmt === M.video.pixFmt))
  const tags = `${v.color_space} / ${v.color_primaries} / ${v.color_transfer} / ${v.color_range}`
  rows.push(row('colour tags', COLOUR_TAGS, tags, tags === COLOUR_TAGS))
  rows.push(row('codec', 'h264 High', `${v.codec_name} ${v.profile}`, v.codec_name === 'h264' && v.profile === 'High'))
  if (sound) {
    const kbps = a ? Number(a.bit_rate) / 1000 : 0
    rows.push(row('sound', `aac, ${cfg.audio.sampleRate} Hz, 2 channels`, a ? `${a.codec_name}, ${a.sample_rate} Hz, ${a.channels} channels` : 'none', !!a && a.codec_name === 'aac' && Number(a.sample_rate) === cfg.audio.sampleRate && a.channels === 2))
    rows.push(row('sound bit rate', `${M.audioKbps} kbps asked, within a quarter under`, `${kbps.toFixed(0)} kbps`, kbps >= M.audioKbps * 0.75 && kbps <= M.audioKbps * 1.1))
    const gap = a ? Math.abs(Number(a.duration) - Number(v.duration)) : Infinity
    rows.push(row('sound length', `within 1/${FPS} s of the picture`, a ? `${Number(a.duration).toFixed(4)} s against ${Number(v.duration).toFixed(4)} s` : 'none', gap <= 1 / FPS + 1e-6))
  } else rows.push(row('sound', 'no sound track at all', a ? `${a.codec_name}` : 'none', !a))

  let unequal = 0
  let seams = 0
  let seamsOff = 0
  for (const p of plan.parts) {
    const own = Array.isArray(p.record.decodedHashes) && p.record.decodedHashes.length === p.record.frames ? p.record.decodedHashes : decodedHashes(p.file).frames.map((f) => f.hash)
    for (let i = 0; i < own.length; i++) {
      const same = seen.frames[p.offset + p.record.first + i]?.hash === own[i]
      const seam = i === 0 || i === own.length - 1
      if (seam) seams++
      if (!same) {
        unequal++
        if (seam) seamsOff++
      }
    }
  }
  rows.push(row('chunk seams', `bit for bit the chunk's own decoded frames`, seamsOff || unequal ? `${seamsOff} of ${seams} seam frames and ${unequal} of ${plan.frames} frames differ` : `${seams} seam frames of ${plan.parts.length} chunks equal, and all ${plan.frames} frames`, unequal === 0))
  rows.push(row('starts fast', 'the index before the pictures', startsFast(file) ? 'yes' : 'no', startsFast(file)))
  const bytes = fs.statSync(file).size
  rows.push(row('file size', `under ${cfg.platform.maxFileMb} MB`, `${(bytes / 1048576).toFixed(1)} MB`, bytes / 1048576 < cfg.platform.maxFileMb))
  rows.push(row('drawn by two machines', 'counted', `${plan.twiceByTwoMachines} frames with equal hashes from two machines, ${plan.twice} rendered twice in all`, null))
  if (which === 'film-a') {
    const opening = plan.parts.filter((p) => p.record.what === 'opening').reduce((x, p) => x + p.record.frames, 0)
    rows.push(row("the opening's frames", test ? 'counted' : totals.opening, opening, test ? null : opening === totals.opening))
  }
  const extra = {}
  if (which === 'loop' && n > 1) {
    const [first, last] = decodedPictures(file, [0, n - 1], format.width, format.height)
    let differing = 0
    for (let i = 0; i < first.length; i += 3) if (first[i] !== last[i] || first[i + 1] !== last[i + 1] || first[i + 2] !== last[i + 2]) differing++
    const d = psnrOf(first, last)
    rows.push(row("the loop's seam", 'measured, last frame against first', `${differing} pixels differ, the largest difference ${d.maxDiff} of 255, ${dB(d.psnr)} dB`, null))
    const still = path.join(path.dirname(plan.parts[0].file), stillName(0))
    const told = plan.parts[0].record.still
    if (plan.parts[0].record.first === 0 && fs.existsSync(still)) {
      const floor = psnrFloor(test)
      const p = { psnr: lumaPsnrOf(first, await rgbOf(still)) }
      const sameFile = fileSha(still) === told?.sha256
      rows.push(row('screenshot', `the PNG of frame 0, ${floor} dB or more in luma from the decoded first frame`, `${dB(p.psnr)} dB${sameFile ? '' : ', and the PNG is not the one its chunk names'}`, p.psnr >= floor && sameFile))
      extra.still = still
    } else rows.push(row('screenshot', 'the PNG of frame 0 beside the first chunk', 'not there', test ? null : false))
  }
  return { rows, extra, streams: s }
}

async function joinMaster() {
  const which = argText(args, 'join', '')
  if (!JOINS[which]) throw new Error(`--join takes ${Object.keys(JOINS).join(', ')}.\n${USAGE}`)
  if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')
  const test = args.test === true
  const from = args.from === undefined || args.from === true ? null : path.resolve(String(args.from))
  if (from && !fs.existsSync(from)) throw new Error(`--from ${args.from} does not exist. Run --collect ${args.from} first.`)
  const totals = totalsFromCut()
  const chunks = readChunks([rel('out', 'master'), ...(from ? [from] : [])]).filter((c) => c.test === test)
  const plan = joinPlan({ which, chunks, totals, test, sha: (f) => (fs.existsSync(f) ? fileSha(f) : null) })
  if (!plan.ok) {
    say(`${which} cannot be joined:`)
    for (const p of plan.problems) say(`- ${p}`)
    for (const c of plan.conflicts) {
      const at = c.frames.slice(0, 3)
      if (!at.length || !fs.existsSync(c.a.file) || !fs.existsSync(c.b.file)) continue
      const places = at.map((i) => i - c.a.record.first)
      const a = decodedPictures(c.a.file, places, c.a.record.width, c.a.record.height)
      const b = decodedPictures(c.b.file, places, c.b.record.width, c.b.record.height)
      say(`  ${c.a.from} against ${c.b.from}: ${at.map((i, k) => `frame ${i} ${dB(psnrOf(a[k], b[k]).psnr)} dB`).join(', ')}`)
    }
    process.exit(1)
  }
  const r0 = plan.parts[0].record
  const format = test ? { id: r0.format, width: r0.width, height: r0.height } : formatById(M.format)
  if (!test && r0.format !== M.format) throw new Error(`the chunks are ${r0.format}, deliver.master.format is ${M.format}`)
  const seconds = plan.frames / FPS
  let sound = null
  if (SOUND[which]) {
    const file = args.sound && args.sound !== true ? path.resolve(String(args.sound)) : rel('audio', 'final', `${SOUND[which]}.wav`)
    if (!fs.existsSync(file)) throw new Error(`${short(file)} is not here, and ${which} is never joined silent. Pass --sound FILE with its final mix.`)
    sound = { file, offsetSeconds: 0, seconds: soundSeconds(file) }
    if (Math.abs(sound.seconds - seconds) > 1 / FPS) say(`note: ${short(file)} is ${sound.seconds.toFixed(3)} s and the picture is ${seconds.toFixed(3)} s, so the sound is ${sound.seconds > seconds ? 'cut' : 'filled with silence'} to the picture's length`)
  }
  const size = plan.parts.reduce((x, p) => x + p.record.bytes, 0)
  if (freeDiskGb() * 1024 ** 3 < size * 1.1 + 64e6) throw new Error(`the join needs ${mb(size * 1.1)} MB of free disk and ${(freeDiskGb() * 1024).toFixed(0)} MB is free`)
  const out = test ? rel('out', 'work', 'master', 'test', resultName(which)) : rel('out', 'deliver', resultName(which))
  say(`joining ${plan.parts.length} chunks, ${plan.frames} frames, ${seconds.toFixed(3)} s, ${mb(size)} MB of picture${sound ? `, sound ${short(sound.file)}` : ', no sound'}`)
  await join({ parts: plan.parts.map((p) => ({ file: p.file, frames: p.record.frames })), out: `${out}.new`, container: 'mp4', fps: FPS, sound, audioKbps: M.audioKbps, channels: 2 })
  const proof = await prove({ file: `${out}.new`, which, plan, format, sound, test, totals })
  const text = table(proof.rows)
  say(text)
  const passed = proof.rows.every((x) => x.pass !== false)
  const final = passed ? out : out.replace(/\.mp4$/, '.unproven.mp4')
  fs.renameSync(`${out}.new`, final)
  let still = null
  if (passed && proof.extra.still) {
    still = path.join(path.dirname(out), test ? `test-${resultName('still')}` : resultName('still'))
    fs.copyFileSync(proof.extra.still, still)
  }
  writeJson(`${final}.json`, {
    which,
    ...(test ? { test: true } : {}),
    frames: plan.frames,
    seconds,
    fps: FPS,
    format: format.id,
    width: format.width,
    height: format.height,
    engineHash: Object.fromEntries(JOINS[which].map((w) => [w, plan.parts.find((p) => p.record.what === w)?.record.engineHash])),
    samples: Object.fromEntries(JOINS[which].map((w) => [w, plan.parts.find((p) => p.record.what === w)?.record.samples])),
    renderer: Object.fromEntries(JOINS[which].map((w) => [w, plan.parts.find((p) => p.record.what === w)?.record.renderer])),
    calibration: Object.fromEntries(JOINS[which].map((w) => [w, plan.parts.find((p) => p.record.what === w)?.record.calibration ?? null])),
    seasonHashes: plan.parts.find((p) => p.record.seasonHashes)?.record.seasonHashes ?? null,
    encoderArgs: r0.encoderArgs,
    sha256: fileSha(final),
    bytes: fs.statSync(final).size,
    sound: sound ? { file: short(sound.file), sha256: fileSha(sound.file), seconds: sound.seconds, kbps: M.audioKbps } : null,
    still: still ? { file: short(still), sha256: fileSha(still) } : null,
    chunks: plan.parts.map((p) => ({ from: p.from, what: p.record.what, first: p.record.first, last: p.record.last, sha256: p.record.sha256, machine: p.record.machine, boot: p.record.boot, commit: p.record.commit })),
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
  say(`${short(final)}: ${plan.frames} frames, ${hours(seconds)}, ${mb(fs.statSync(final).size)} MB${still ? `, screenshot ${short(still)}` : ''}`)
}

async function hdFromMaster() {
  const which = argText(args, 'hd', '')
  if (which !== 'film-a' && which !== 'film-b') throw new Error(`--hd takes film-a or film-b.\n${USAGE}`)
  if (!haveFfmpeg()) throw new Error('ffmpeg and ffprobe are needed and were not found')
  const test = args.test === true
  const src = test ? rel('out', 'work', 'master', 'test', resultName(which)) : rel('out', 'deliver', resultName(which))
  if (!fs.existsSync(src) || !fs.existsSync(`${src}.json`)) throw new Error(`${short(src)} is not here. Join it first: npm run master -- --join ${which}${test ? ' --test' : ''}`)
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
  if (args.calibrate !== undefined) await calibrate()
  else if (args.hd !== undefined) await hdFromMaster()
  else if (args.collect !== undefined) collect()
  else if (args.join !== undefined) await joinMaster()
  else if (args.what !== undefined) await render()
  else say(USAGE)
} catch (e) {
  say(`master: ${e.message}`)
  process.exit(1)
}
