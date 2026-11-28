// The work behind each command of the render handoff. tools/handoff.mjs calls these; tools/lib/handoff.mjs holds the
// rules they follow and tools/lib/handoff-machine.mjs what they read from the machine. Nothing here draws by itself:
// every picture is drawn by tools/master.mjs or tools/shutter-frame.mjs, and every film is encoded by tools/master.mjs.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { rel, readJson, writeJson } from './paths.mjs'
import { engineHash } from './hashes.mjs'
import * as L from './handoff.mjs'
import * as A from './handoff-approve.mjs'
import * as X from './handoff-machine.mjs'
import { PROFILE_ENV, profileRoot } from './handoff-processes.mjs'
import { BUNDLE_RECORDS, addBundleFile, discardBundle, fileMatches, startBundle, unexpectedEntries } from './handoff-owned-files.mjs'
import { compareLoopScreenshot, decodeScreenshot, validScreenshotSpec } from './handoff-screenshot.mjs'

export const STAMP_DIR = rel('render')
export const STAMP_FILE = rel('render', 'STAMP.json')
export const PLAN_FILE = rel('render', 'PLAN.json')
export const PACK_DIR = rel('render', 'opening-pack')
export const REFS_DIR = rel('render', 'refs')
const WIN = process.platform === 'win32'
const short = (p) => path.relative(rel(), p).split(path.sep).join('/') || '.'
const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d
const sum = (list) => list.reduce((a, b) => a + b, 0)

export const readStamp = () => {
  try {
    return readJson(STAMP_FILE)
  } catch {
    return null
  }
}
const readOr = (file, fallback = null) => {
  try {
    return readJson(file)
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Children. Every child is a program by its full path or a name the system finds as an .exe: never npm, npx or a
// .cmd by a bare name, and never a shell.

/** The tools a run started and did not see end, by process number and start time. */
function trackChild(ctx, pid, on) {
  if (!ctx.H || !pid) return
  const f = path.join(ctx.H, 'children.json')
  const old = readOr(f, [])
  const list = Array.isArray(old) ? old.filter((r) => r?.pid && r.pid !== pid) : []
  const started = on ? X.processStart(pid) : null
  if (started) list.push({ pid, started })
  try {
    fs.mkdirSync(ctx.H, { recursive: true })
    fs.writeFileSync(f, JSON.stringify(list))
  } catch {}
}

export function runFile(ctx, file, args, onLine = null) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    let child
    try {
      // on macOS and Linux a tool leads a process group of its own, so that it can be ended with all it started
      child = spawn(file, args, { cwd: rel(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: process.env, detached: !WIN })
    } catch (e) {
      return resolve({ code: -1, tail: [e.message], seconds: 0 })
    }
    trackChild(ctx, child.pid, true)
    const tail = []
    let rest = ''
    const line = (l) => {
      if (!l) return
      tail.push(l)
      if (tail.length > 80) tail.shift()
      ctx.note(`  | ${l}`)
      onLine?.(l)
    }
    const take = (d) => {
      const lines = (rest + d).split(/\r?\n/)
      rest = lines.pop() ?? ''
      lines.forEach(line)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    child.on('error', (e) => resolve({ code: -1, tail: [...tail, e.message], seconds: (Date.now() - t0) / 1000 }))
    child.on('close', (code) => {
      line(rest)
      trackChild(ctx, child.pid, false)
      resolve({ code, tail, seconds: (Date.now() - t0) / 1000 })
    })
  })
}
export const runTool = (ctx, tool, args, onLine = null) => {
  ctx.note(`> node tools/${tool} ${args.join(' ')}`)
  return runFile(ctx, process.execPath, [rel('tools', tool), ...args], onLine)
}
const lastLines = (r, n = 12) => r.tail.slice(-n).join('\n')
/** The sentence a failed tool ended with: its own last line that starts with its name, or its last line. */
const whyOf = (r) => {
  const own = [...r.tail].reverse().find((l) => /^(\[\d+\] )?(master|shutter-frame|simcache): /.test(l) || /^Error: /.test(l))
  return (own ?? r.tail[r.tail.length - 1] ?? `it ended with code ${r.code}`).replace(/^(\[\d+\] )?/, '')
}

// ---------------------------------------------------------------------------------------------------------------------
// Modes. The tool's own tests draw small and in software; a real run never does.

export function modeOf(ctx, cfg) {
  const small = ctx.T.small
  const master = Object.values(cfg.formats).find((f) => f.id === cfg.deliver.master.format)
  const format = small ? cfg.formats.preview : master
  // On the Linux machines of the tool's own tests there is no installed Chrome and no card: the pinned browser draws.
  const local = !(ctx.T.linux && process.platform === 'linux')
  return {
    small,
    local,
    format,
    master,
    fps: cfg.film.fps,
    chunk: small ? 6 : cfg.deliver.master.chunkFrames,
    // what a tool is told beside its range
    draw: [...(small ? ['--format', format.id, '--samples', '2', '--chunk', '6'] : []), ...(local ? ['--local'] : [])],
    names: cfg.deliver.master.names,
  }
}

const loadCfg = () => readJson(rel('config', 'showcase.json'))

/** The Chrome switches of every local run: the graphics card by name, and what a test asked for. */
export function setChromeSwitches(ctx) {
  // a test switch may name the layer Chrome draws through; Chrome asks for a second word before it draws in SwiftShader
  const extra = ['--force_high_performance_gpu', ...(ctx.T.angle ? [`--use-angle=${ctx.T.angle}`] : []), ...(ctx.T.angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : [])]
  process.env.SHOWCASE_LOCAL_ARGS = extra.join(' ')
  if (ctx.H) process.env[PROFILE_ENV] = profileRoot(ctx.H)
  return extra
}

// ---------------------------------------------------------------------------------------------------------------------
// The doctor.

const GL_FACTS = () => {
  const gl = document.createElement('canvas').getContext('webgl2')
  if (!gl) return null
  const e = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    vendor: String(gl.getParameter(e ? e.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
    renderer: String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    version: String(gl.getParameter(gl.VERSION)),
    shading: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxRenderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    maxViewport: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
    max3d: gl.getParameter(gl.MAX_3D_TEXTURE_SIZE),
    floatBuffer: !!gl.getExtension('EXT_color_buffer_float'),
    floatLinear: !!gl.getExtension('OES_texture_float_linear'),
  }
}

/** Opens the browser as the render will, on the build's own page at the render's size, and draws one picture of one sample. */
async function readPage(ctx, mode) {
  const { Session, cfg, formatById } = await import('./page.mjs')
  const { Run } = await import('./frames.mjs')
  const sharp = (await import('sharp')).default
  const S = await import('./handoff-shaders.mjs')
  const session = await Session.open({ local: mode.local, what: 'handoff doctor', say: ctx.note })
  try {
    S.watchShaders(session.browser)
    const run = new Run(session, { by: 'handoff', looks: false, say: ctx.note })
    const track = { kind: 'film', name: 'film-b', format: formatById(mode.format.id), tier: 'samples-1', assets: 'full', fps: cfg.film.fps, step: 1 }
    const t0 = Date.now()
    const page = await run.page(track)
    const loadSeconds = (Date.now() - t0) / 1000
    const gl = await page.evaluate(GL_FACTS)
    const caps = await page.evaluate(() => window.showcase.dev.caps()).catch(() => null)
    let picture = null
    let drawProblem = ''
    try {
      const t1 = Date.now()
      const png = await run.frame(track, page, 0)
      const rgb = await sharp(png).removeAlpha().raw().toBuffer()
      picture = { seconds: (Date.now() - t1) / 1000, bytes: png.length, problem: L.pictureProblem(rgb, mode.format.width, mode.format.height) }
    } catch (e) {
      drawProblem = e.message
    }
    const lost = await page.evaluate(() => window.__contextLost).catch(() => null)
    // the maths probe of the tree on a canvas of its own, then what the shader compiler wrote, program by program
    const maths = await S.mathsProbe(page, rel('dist'))
    const shaders = await S.collectShaders(page)
    let shaderFile = ''
    if (shaders) {
      shaderFile = path.join(ctx.H, 'shader-messages-doctor.txt')
      fs.writeFileSync(shaderFile, S.shaderList(shaders, [`${L.TITLE}: what the shader compiler wrote, program by program`, `written   ${new Date().toISOString()}`, `drawn by  ${gl?.renderer ?? 'nothing'}`, `browser   ${session.browserVersion}`, `page      the build's own page, film B frame 0 at ${mode.format.width} x ${mode.format.height}, one sample`, ''], { srcDir: rel('src') }))
      fs.rmSync(path.join(ctx.H, 'shaders-doctor'), { recursive: true, force: true })
      S.writeShaders(shaders, path.join(ctx.H, 'shaders-doctor'))
    }
    const programs = shaders ? { linked: shaders.linked, withLog: shaders.logs.length, file: shaderFile, different: S.briefLogs(shaders) } : null
    return { browser: session.browserVersion, gl, caps, picture, drawProblem, loadSeconds, lost, maths, programs, errors: [...page.errors] }
  } finally {
    await session.close().catch(() => {})
  }
}

/** The renderer and the browser's version alone, from a blank page: what is read again before every render process. */
export async function readRenderer(mode) {
  const { launch } = await import('./browser.mjs')
  const browser = await launch({ local: mode.local })
  try {
    const page = await browser.newPage()
    const gl = await page.evaluate(GL_FACTS)
    return { browser: browser.version(), renderer: gl ? gl.renderer : 'no WebGL', vendor: gl ? gl.vendor : '' }
  } finally {
    await browser.close().catch(() => {})
  }
}

export function diskNeed(stamp, mode, measured = null, procs = 2) {
  const d = { ...(stamp?.disk ?? {}), ...(measured ?? {}) }
  const scale = mode.small ? 0.02 : 1
  const frames = mode.small ? { 'film-b': 18, loop: 12, opening: 12 } : { 'film-b': stamp.frames['film-b'], loop: stamp.frames.loop, opening: stamp.frames.opening }
  return L.diskPlan({
    chunkBytes: (d.chunkMb ?? 27) * 1e6 * scale,
    frames,
    chunkFrames: mode.chunk,
    pngBytes: (d.pngMb ?? 30) * 1e6 * scale,
    procs,
    finalBytes: [d.finalMb?.['film-a'] ?? 500, d.finalMb?.['film-b'] ?? 500, d.finalMb?.loop ?? 400, d.finalMb?.still ?? 30].map((m) => m * 1e6 * scale),
    deliverOnSameDrive: true,
    spare: 3 * 1024 ** 3,
  })
}

/** The folder itself, or the nearest folder above it that is there: a Desktop that is not made yet is on the drive of what holds it. */
const existingFolder = (dir) => {
  let d = path.resolve(dir)
  for (let i = 0; i < 64 && !fs.existsSync(d); i++) {
    const up = path.dirname(d)
    if (up === d) break
    d = up
  }
  return d
}

/** What of the render is on disk already, counted lightly: finished chunks by their two files, the films by their size, the delivery by its record. */
function workDone(ctx, stamp, mode) {
  let chunksFinished = 0
  for (const p of renderParts(stamp, mode)) {
    for (const c of L.chunkLines(p.first, p.last, mode.chunk)) {
      const stem = path.join(chunksDir(mode), p.what, L.chunkFile(p.what, c))
      if (fs.existsSync(`${stem}.json`) && fs.existsSync(`${stem}.mp4`)) chunksFinished++
    }
  }
  let finalsBytes = 0
  for (const f of Object.values(finalFiles(mode))) {
    try {
      finalsBytes += fs.statSync(f).size
    } catch {}
  }
  const delivered = readOr(path.join(ctx.H, 'deliver.json'))
  return { chunksFinished, finalsBytes, deliveredBytes: delivered?.pass ? sum((delivered.files ?? []).map((f) => f.bytes ?? 0)) : 0 }
}

// Whether Windows waits for a restart: the two places where Windows Update and the servicing of the system mark it.
// It reads only, and changes nothing.
const RESTART_SCRIPT = `
$a = Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired'
$b = Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending'
Write-Output "update=$a servicing=$b"
`
export function pendingRestart() {
  if (!WIN) return { read: false, why: '', said: 'not read on this system (the tool reads it on Windows alone)' }
  try {
    const said = X.powershell(RESTART_SCRIPT, { timeout: 60000 }).trim()
    const why = [/update=True/i.test(said) ? 'Windows Update has installed something that needs one' : '', /servicing=True/i.test(said) ? 'the servicing of the system needs one' : ''].filter(Boolean).join(', and ')
    return { read: true, why, said }
  } catch (e) {
    return { read: false, why: '', said: `could not be read (${String(e?.message ?? e).split('\n')[0]})` }
  }
}

/** Before the four files are copied: the Desktop's own drive must take them. Empty when it does, else the refusal. */
export function desktopRoom(ctx) {
  const checked = readOr(path.join(ctx.H, 'check.json'))
  if (!checked?.pass) return ''
  let desktop = ''
  try {
    desktop = X.readMachine().desktop
  } catch {
    return ''
  }
  const mode = modeOf(ctx, loadCfg())
  const folder = path.join(desktop, L.deliveryFolder(mode.small))
  let need = mode.small ? 1024 ** 2 : A.DESKTOP_SPARE
  for (const kind of L.KINDS) {
    const f = checked.files?.[kind]
    if (!f) continue
    let there = -1
    try {
      there = fs.statSync(path.join(folder, L.deliveryName(kind, mode.format.width, mode.format.height))).size
    } catch {}
    if (there !== f.bytes) need += f.bytes
  }
  let free
  try {
    free = X.freeBytes(existingFolder(folder))
  } catch (e) {
    return `the room on the drive of the Desktop (${desktop}) could not be read (${String(e?.message ?? e).split('\n')[0]}), so nothing was copied. Stop and report`
  }
  return free >= need ? '' : `the drive of the Desktop (${desktop}) has ${mb(free)} free, and the four files and their report need ${mb(need)} there. Nothing was copied. Make room on that drive, then run the same line again: node tools/handoff.mjs deliver`
}

export async function doctor(ctx, { draw = true } = {}) {
  const rows = []
  const row = (check, found, wanted, pass) => rows.push({ check, found, wanted, pass })
  const out = { pass: false, why: '', rows, time: new Date().toISOString() }
  const after = []
  // what stops nothing and must still be looked at by the remote team
  const look = []
  out.look = look
  const done = (why) => {
    ctx.tables?.push({ title: 'the doctor', rows, after })
    out.pass = rows.every((r) => r.pass !== false)
    out.why = out.pass ? why : rows.filter((r) => r.pass === false).map((r) => r.why ?? `${r.check}: ${r.found}`).join('. ')
    return out
  }
  const fail = (check, found, wanted, why) => rows.push({ check, found, wanted, pass: false, why })

  // where this is
  let procVersion = ''
  try {
    procVersion = fs.readFileSync('/proc/version', 'utf8')
  } catch {}
  const place = L.placeProblem({ platform: process.platform, release: os.release(), env: process.env, procVersion, allowLinux: ctx.T.linux })
  if (place) {
    fail('the place', `${process.platform} ${os.release()}`, 'Windows or macOS itself', place)
    return done('')
  }

  // the machine, read now
  let machine
  try {
    machine = X.readMachine()
  } catch (e) {
    fail('the machine', 'could not be read', 'processor, memory and video cards read from the system', `the machine could not be read: ${e.message}`)
    return done('')
  }
  out.machine = machine
  ctx.say(`system     ${machine.os}${machine.model ? `, ${machine.model}` : ''}`)
  ctx.say(`processor  ${machine.processor.name}, ${machine.processor.cores || '?'} cores, ${machine.processor.threads} threads`)
  ctx.say(`memory     ${L.gb(machine.memoryBytes).toFixed(1)} GB`)
  if (!machine.cards.length) ctx.say('video card  the system names none')
  if (machine.cardsSaid) ctx.say(`            what it said when asked: ${machine.cardsSaid}`)
  for (const c of machine.cards) ctx.say(`video card ${c.name}${c.driverVersion ? `, driver ${c.driverVersion}` : ''}${c.driverDate ? ` of ${c.driverDate}` : ''}${c.memoryBytes ? `, ${L.gb(c.memoryBytes).toFixed(1)} GB (${c.memoryFrom})` : ''}`)
  ctx.say(`power      ${machine.power}`)
  ctx.say(`desktop    ${machine.desktop}`)
  ctx.say(`read with  ${machine.readWith}`)
  if (machine.onBattery) row('power', machine.power, 'mains power for a render of hours', null)
  // the driver of the card that draws: a part of the build a short test passes on
  const driver = A.driverText({ platform: process.platform, os: machine.os, cards: machine.cards, wanted: L.wantedCard(machine.cards) })
  out.driver = driver.text
  ctx.say(`driver     ${driver.text}`)
  // what bears on a render of hours and stops nothing here: each is a LOOK line, and Brandon's yes must have seen it
  const restart = pendingRestart()
  out.pendingRestart = restart
  ctx.say(`restart    ${restart.read ? (restart.why ? `Windows waits for one: ${restart.why}` : 'Windows waits for none') : restart.said}`)
  const cloud = A.desktopInCloud({ platform: process.platform, desktop: machine.desktop, env: process.env, icloudDesktop: process.platform === 'darwin' && fs.existsSync(path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Desktop')) })
  out.longRun = A.longRunLines({ onBattery: machine.onBattery, power: machine.power, pendingRestart: restart.why, cloud, driverMissing: driver.missing })
  for (const l of out.longRun) look.push(l.text)

  // the tools
  const tools = X.readTools()
  out.tools = tools
  const plat = process.platform
  const need = (tool, ok, found, wanted) => {
    if (ok) return row(tool, found, wanted, true)
    const line = L.installLine(tool === 'ffprobe' ? 'ffmpeg' : tool, plat)
    fail(tool, found, wanted, `${tool} ${found}. Install it with this line, then run the doctor again: ${line} . ${L.NEW_TERMINAL}`)
  }
  need('node', L.nodeOk(tools.node.version), `${tools.node.version} at ${tools.node.file}`, L.NODE_WANTED)
  row('npm', tools.npm.version ? `${tools.npm.version}, ${tools.npm.from}` : 'not found beside this node', 'the npm that came with this node', tools.npm.version ? true : false)
  need('git', tools.git.runs && L.atLeast(L.versionOf(tools.git.version), L.LEAST.git), tools.git.runs ? `${tools.git.version} at ${tools.git.file} (${tools.git.from})` : 'is missing', `git ${L.LEAST.git.join('.')} or newer`)
  const ff = L.ffmpegVersion(tools.ffmpeg.version)
  const ffOk = tools.ffmpeg.runs && ff && (ff.dated || L.atLeast(ff.numbers, L.LEAST.ffmpeg)) && tools.ffmpeg.libx264 && tools.ffmpeg.aac
  need('ffmpeg', ffOk, tools.ffmpeg.runs ? `${ff?.text ?? tools.ffmpeg.version} at ${tools.ffmpeg.file} (${tools.ffmpeg.from}), the picture encoder libx264 ${tools.ffmpeg.libx264 ? 'yes' : 'NO'}, the sound encoder aac ${tools.ffmpeg.aac ? 'yes' : 'NO'}` : 'is missing', `ffmpeg ${L.LEAST.ffmpeg[0]} or newer with the picture encoder libx264 and the sound encoder aac`)
  const fp = L.ffmpegVersion(tools.ffprobe.version)
  need('ffprobe', tools.ffprobe.runs && !!fp, tools.ffprobe.runs ? `${fp?.text ?? tools.ffprobe.version} at ${tools.ffprobe.file}` : 'is missing', 'ffprobe, which comes with ffmpeg')
  // the Linux machines of the tool's own tests have no Chrome: the pinned browser draws there, and only there
  if (ctx.T.linux && plat === 'linux') row('chrome', "not looked for: the pinned browser of the tool's own tests draws", 'Google Chrome, installed', null)
  else need('chrome', !!tools.chrome.file, tools.chrome.file ? `at ${tools.chrome.file}` : 'is missing', 'Google Chrome, installed')

  // the clone, the stamp and the build
  const stamp = readStamp()
  out.stamp = stamp ? { engineHash: stamp.engineHash, released: stamp.releasedForFinalRender === true } : null
  const bad = L.stampProblems(stamp)
  if (bad.length) fail('the stamp', bad.join('; '), 'render/STAMP.json, whole', `the stamp is not whole: ${bad.join('; ')}. The clone is damaged or not at the commit of the handoff`)
  const hash = engineHash()
  out.engineHash = hash
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: rel(), encoding: 'utf8', windowsHide: true })
    return r.status === 0 ? r.stdout.trim() : ''
  }
  out.commit = git(['rev-parse', 'HEAD'])
  const edited = git(['status', '--porcelain', '--untracked-files=no']).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  ctx.say(`clone      ${rel()} at commit ${out.commit ? out.commit.slice(0, 12) : 'not read'}${edited.length ? `, ${edited.length} tracked ${edited.length === 1 ? 'file is' : 'files are'} changed: ${edited.slice(0, 6).join(', ')}` : ', no tracked file changed'}`)
  if (!bad.length) {
    if (hash === stamp.engineHash) row('engine hash', hash, `${stamp.engineHash}, the stamp's`, true)
    else fail('engine hash', hash, `${stamp.engineHash}, the stamp's`, `the engine here is ${hash} and the stamp was made for ${stamp.engineHash}: ${L.hashCause()}${edited.length ? `. Changed here: ${edited.slice(0, 6).join(', ')}` : ''}`)
  }
  const built = readOr(rel('dist', 'build.json'))
  const hasModules = fs.existsSync(rel('node_modules', 'playwright-core')) && fs.existsSync(rel('node_modules', 'sharp'))
  if (!hasModules || built?.engineHash !== hash) fail('the build', !hasModules ? 'the packages are not installed' : built ? `made for engine ${built.engineHash}` : 'not made', 'made by setup for this engine', 'the build is not made for this engine yet. Run this line first, then the doctor again: node tools/handoff.mjs setup')

  // the disk
  const cfg = loadCfg()
  const mode = modeOf(ctx, cfg)
  out.mode = { small: mode.small, local: mode.local, format: mode.format.id, width: mode.format.width, height: mode.format.height }
  const free = X.freeBytes(rel())
  out.freeBytes = free
  if (!bad.length) {
    const plan = diskNeed(stamp, mode, readOr(path.join(ctx.H, 'test.json'))?.disk ?? null)
    // what is drawn, encoded or delivered already needs no room again: a render that carries on is asked only for
    // the work that remains, and the Desktop's own drive is looked at for what is written there
    const desk = existingFolder(machine.desktop)
    const sameDrive = X.sameDrive(rel(), desk)
    const left = A.diskRemaining(plan, { ...workDone(ctx, stamp, mode), sameDrive })
    out.diskNeedBytes = left.total
    out.diskWholeBytes = plan.total
    const text = `${L.gb(free).toFixed(1)} GB free on the drive of the clone`
    const want = A.remainingText(left)
    if (free >= left.total) row('free disk', text, want, true)
    else fail('free disk', text, want, `${text}, and ${left.leftChunks === left.chunks ? 'the render needs' : 'what is still to do of the render needs'} ${L.gb(left.total).toFixed(1)} GB at its fullest. Make room on that drive, or clone onto a drive with more`)
    let deskFree = null
    try {
      deskFree = X.freeBytes(desk)
    } catch {}
    out.desktopFreeBytes = deskFree
    const deskNeed = left.desktop + A.DESKTOP_SPARE
    const deskWant = `${L.gb(deskNeed).toFixed(1)} GB for the test film, the sheet of pictures and the four files`
    if (deskFree === null) fail("free on the Desktop's drive", `not read for ${machine.desktop}`, deskWant, `the room on the drive of the Desktop (${machine.desktop}) could not be read, and the test film, the sheet of pictures and the four files are written there. Stop and report`)
    else if (sameDrive) row("free on the Desktop's drive", `the Desktop (${machine.desktop}) is on the drive of the clone`, `counted in the row above: the copies for the Desktop ${L.gb(left.copies).toFixed(1)} GB`, true)
    else if (deskFree >= deskNeed) row("free on the Desktop's drive", `${L.gb(deskFree).toFixed(1)} GB free on the drive of ${machine.desktop}`, deskWant, true)
    else fail("free on the Desktop's drive", `${L.gb(deskFree).toFixed(1)} GB free on the drive of ${machine.desktop}`, deskWant, `the drive of the Desktop (${machine.desktop}) has ${L.gb(deskFree).toFixed(1)} GB free, and the test film, the sheet of pictures and the four files need ${L.gb(deskNeed).toFixed(1)} GB there. Make room on that drive`)
  }

  // the browser, opened as the render opens it
  if (rows.some((r) => r.pass === false)) return done('')
  const switches = setChromeSwitches(ctx)
  let seen
  try {
    seen = await readPage(ctx, mode)
  } catch (e) {
    fail('the browser', 'could not open the page of the build', 'Chrome, in a window, on the page of the build', `Chrome could not open the page of the build: ${String(e.message).split('\n')[0]}`)
    return done('')
  }
  out.page = seen
  out.switches = switches
  const gl = seen.gl
  ctx.say(`browser    ${mode.local ? 'Google Chrome' : 'the pinned browser of the tool tests'} ${seen.browser}, in a window, with ${switches.join(' ')}`)
  ctx.say(`WebGL      vendor: ${gl?.vendor ?? 'none'}`)
  ctx.say(`WebGL      renderer: ${gl?.renderer ?? 'none'}`)
  if (gl) ctx.say(`WebGL      ${gl.version}; largest texture ${gl.maxTexture}, largest render buffer ${gl.maxRenderbuffer}, largest view ${gl.maxViewport.join(' x ')}, ${gl.maxSamples} samples, ${gl.maxDrawBuffers} draw buffers, float buffers ${gl.floatBuffer ? 'yes' : 'no'}`)
  if (mode.local) need('chrome version', L.atLeast(L.versionOf(seen.browser), L.LEAST.chrome), seen.browser, `Chrome ${L.LEAST.chrome[0]} or newer`)
  const verdict = L.drawVerdict({ renderer: gl?.renderer ?? '', cards: machine.cards, allowSoftware: ctx.T.software })
  out.renderer = gl?.renderer ?? ''
  out.software = verdict.software
  const wanted = L.wantedCard(machine.cards)
  if (verdict.ok) row('what draws', gl?.renderer ?? '', wanted ? `the ${wanted.vendor} card (${wanted.name})` : 'a graphics card, not software', verdict.software ? null : true)
  else fail('what draws', gl?.renderer ?? 'nothing', wanted ? `the ${wanted.vendor} card (${wanted.name})` : 'a graphics card, not software', `${verdict.why}${verdict.software ? '' : `. Chrome was started with ${switches.join(' ')} and still drew on the other card. What is left is a setting of the system that this tool does not touch: on Windows, Settings > System > Display > Graphics, add Google Chrome and choose High performance; then run the doctor again`}`)
  if (verdict.ok && verdict.software) ctx.say(`NOTE       ${verdict.why}`)
  if (verdict.ok && verdict.look) look.push(verdict.look)
  // the one reader of a card's load this tool has comes with the NVIDIA driver
  if (wanted?.vendor === 'NVIDIA') {
    const smi = X.findSmi()
    ctx.say(`card load  ${smi ? `nvidia-smi is at ${smi}: the short test reads the card's load with it while frames are drawn` : 'nvidia-smi was not found, so the short test cannot read the load of the card'}`)
  }
  if (gl) {
    const side = Math.max(mode.master.width, mode.master.height)
    const fits = gl.maxTexture >= side && gl.maxRenderbuffer >= side && Math.min(...gl.maxViewport) >= Math.min(mode.master.width, mode.master.height)
    if (fits) row('size', `textures to ${gl.maxTexture}, render buffers to ${gl.maxRenderbuffer}`, `${mode.master.width} x ${mode.master.height} and more`, true)
    else fail('size', `textures to ${gl.maxTexture}, render buffers to ${gl.maxRenderbuffer}`, `${mode.master.width} x ${mode.master.height} and more`, `this card draws no picture of ${mode.master.width} x ${mode.master.height}: its largest texture is ${gl.maxTexture}`)
  }
  const wrote = L.pageMessages(seen.errors)
  out.pageErrors = wrote.errors
  out.pageWarnings = wrote.warnings
  if (wrote.errors.length) fail('page errors', `${wrote.errors.length} ${wrote.errors.length === 1 ? 'error' : 'errors'}`, 'none', `the page wrote ${wrote.errors.length === 1 ? 'an error' : 'errors'} while it loaded and drew (a shader that does not compile shows here). In full:\n${wrote.errors.join('\n')}`)
  else row('page errors', 'none', 'none', true)
  // what the shader compiler wrote: with the shaders it belongs to where the watch could read them, else as the page wrote it
  const progs = seen.programs
  const other = wrote.warnings.filter((w) => !(progs?.different.length && /Program Info Log/.test(w.text)))
  if (progs?.different.length) {
    const count = progs.different.reduce((n, e) => n + new Set(e.messages.map((m) => `${m.code} ${m.text}`)).size, 0)
    row('shader messages', `${progs.withLog} of ${progs.linked} programs wrote messages, ${count} different ones; listed under this table`, 'noted only: a shader that warns still compiles and draws', null)
    after.push(`what the shader compiler of this machine wrote (it stops nothing; the remote team reads it). Each place and each shader in full: ${short(progs.file)} and the folder shaders-doctor beside it`)
    for (const e of progs.different) {
      const each = new Map()
      for (const m of e.messages) each.set(`${m.code} ${m.text}`, (each.get(`${m.code} ${m.text}`) ?? 0) + 1)
      after.push(`  fragment shader "${e.fragment}", vertex shader "${e.vertex}", ${e.programs} ${e.programs === 1 ? 'program' : 'programs'}:`)
      for (const [text, times] of each) after.push(`      ${times} x  ${text}`)
    }
  }
  if (other.length) {
    row('page warnings', `${other.length} different ${other.length === 1 ? 'warning' : 'warnings'}, in full under this table`, 'noted only', null)
    after.push('the warnings the page wrote while it loaded and drew, each once (they stop nothing; the remote team reads them):')
    for (const w of other) after.push(`  ${w.times} x  ${w.text.replace(/\s*\n\s*/g, ' | ')}`)
  }
  // the maths probe of the tree: what this card and its compiler answer where the shading language leaves it open
  const maths = seen.maths
  out.maths = maths
  if (maths?.lines) {
    const S = await import('./handoff-shaders.mjs')
    const isnan = S.mathsAnswer(maths.lines, 'isnan(nan)')
    row('maths probe', `${maths.lines.length} questions answered${isnan === null ? '' : `; isnan of a value that is not a number answers ${isnan} (1.00 is yes)`}`, 'noted only: the answers are for the remote team', null)
    after.push('what this card and its shader compiler answer to the maths probe of the tree (src/core/maths.ts):')
    after.push(`  ${maths.lines.join('; ')}`)
  } else row('maths probe', maths?.problem ?? 'not asked', 'noted only: the answers are for the remote team', null)
  if (seen.drawProblem) fail('one picture', 'not drawn', 'one picture of one sample, drawn and read back', `the page could not draw its first picture: ${seen.drawProblem}`)
  else if (draw && seen.picture) {
    if (seen.picture.problem) fail('one picture', seen.picture.problem, 'a picture that is not flat', `the first picture came back wrong: ${seen.picture.problem}`)
    else row('one picture', `film B frame 0 at ${mode.format.width} x ${mode.format.height}, 1 sample, drawn and read back in ${seen.picture.seconds.toFixed(1)} s (${mb(seen.picture.bytes)} as a PNG); the page loaded in ${seen.loadSeconds.toFixed(1)} s`, 'drawn, read back, not flat', true)
  }
  if (seen.lost) fail('graphics context', `lost ${seen.lost} ${seen.lost === 1 ? 'time' : 'times'}`, 'never lost', `the graphics context of the page was lost ${seen.lost} ${seen.lost === 1 ? 'time' : 'times'} while one picture was drawn. The card or its driver gave up`)
  return done(`this machine can draw the film: ${gl?.renderer ?? ''}, Chrome ${seen.browser}, engine ${hash}, ${L.gb(free).toFixed(0)} GB free${look.length ? `. ${look.length} ${look.length === 1 ? 'thing is' : 'things are'} marked LOOK in the report for the remote team` : ''}`)
}

// ---------------------------------------------------------------------------------------------------------------------
// Setup: the packages and the build, with this node alone.

export async function setup(ctx) {
  if (!L.nodeOk(process.version)) return { pass: false, why: `this is Node ${process.version}, and the build needs ${L.NODE_WANTED}. Install it with this line, open a new terminal and run setup again: ${L.installLine('node', process.platform)}` }
  X.readTools()
  const npm = X.npmCli()
  if (!npm) return { pass: false, why: `npm was not found beside ${process.execPath}. Node is installed without its npm: install Node again with: ${L.installLine('node', process.platform)}` }
  ctx.say(`installing the packages the lock file names (npm ci, with ${short(npm) === npm ? npm : npm})`)
  const ci = await runFile(ctx, process.execPath, [npm, 'ci', '--no-audit', '--no-fund'])
  if (ci.code !== 0) return { pass: false, why: `the packages could not be installed (npm ci ended with code ${ci.code}). Its last lines:\n${lastLines(ci)}` }
  ctx.say(`packages installed in ${L.hoursText(ci.seconds)}`)
  // the build, as package.json writes it, each step started by this node
  const steps = String(readJson(rel('package.json')).scripts?.build ?? '').split('&&').map((s) => s.trim().split(/\s+/))
  const bin = { tsc: rel('node_modules', 'typescript', 'bin', 'tsc'), vite: rel('node_modules', 'vite', 'bin', 'vite.js') }
  const known = steps.length > 0 && steps.every((s) => (s[0] === 'node' && s[1]) || bin[s[0]])
  if (!known) {
    ctx.say('building (npm run build)')
    const r = await runFile(ctx, process.execPath, [npm, 'run', 'build'])
    if (r.code !== 0) return { pass: false, why: `the build failed (npm run build ended with code ${r.code}). Its last lines:\n${lastLines(r)}` }
  } else {
    for (const s of steps) {
      const args = s[0] === 'node' ? [rel(s[1]), ...s.slice(2)] : [bin[s[0]], ...s.slice(1)]
      ctx.say(`building: ${s.join(' ')}`)
      const r = await runFile(ctx, process.execPath, args)
      if (r.code !== 0) return { pass: false, why: `the build failed at "${s.join(' ')}" (code ${r.code}). Its last lines:\n${lastLines(r)}` }
    }
  }
  const hash = engineHash()
  const built = readOr(rel('dist', 'build.json'))
  if (built?.engineHash !== hash) return { pass: false, why: `the build ended and dist/build.json ${built ? `names engine ${built.engineHash}` : 'is not there'}, where the source is ${hash}` }
  const stamp = readStamp()
  const bad = L.stampProblems(stamp)
  if (bad.length) return { pass: false, why: `the build is made (engine ${hash}), and the stamp is not whole: ${bad.join('; ')}` }
  ctx.say(`engine hash here   ${hash}`)
  ctx.say(`engine hash stamp  ${stamp.engineHash}`)
  if (stamp.engineHash !== hash) return { pass: false, why: `the build is made, and its engine is ${hash} where the stamp was made for ${stamp.engineHash}: ${L.hashCause()}` }
  return { pass: true, why: `the packages are installed and the build is made, engine ${hash}, the stamp's` }
}

// ---------------------------------------------------------------------------------------------------------------------
// Pictures.

async function rgbOfFile(file) {
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/** The pictures of one reference of the stamp, decoded. */
export async function loadReference(ref) {
  const check = (f) => {
    const file = path.join(REFS_DIR, f.file)
    if (!fs.existsSync(file)) throw new Error(`the reference picture ${short(file)} is not in the clone`)
    if (L.sha256File(file) !== f.sha256) throw new Error(`the reference picture ${short(file)} is not the one the stamp names`)
    return file
  }
  const half = await rgbOfFile(check(ref.half))
  const cuts = []
  for (const c of ref.cuts ?? []) cuts.push({ ...c, data: (await rgbOfFile(check(c))).data })
  return { half, cuts, glass: ref.glass ?? [] }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The contact sheet: for every reference frame the reference beside what this machine drew, whole at half size and
 * then each cut at full size. One JPEG.
 */
export async function contactSheet(items, file, title) {
  const sharp = (await import('sharp')).default
  const TW = 960
  const TH = 540
  const PAD = 12
  const BAR = 44
  const width = PAD * 3 + TW * 2
  const parts = []
  let y = PAD
  const text = (label, top, size = 24) => parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width - PAD * 2}" height="${BAR}"><text x="0" y="${Math.round(BAR * 0.68)}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="#f2f2f2">${esc(label)}</text></svg>`), left: PAD, top })
  text(title, y, 28)
  y += BAR
  text('left: the reference          right: what this machine drew', y, 20)
  y += BAR
  const tile = async (rgb, w, h) => (w === TW && h === TH ? rgb : sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).resize(TW, TH, { fit: 'contain', background: '#101010' }).raw().toBuffer())
  for (const it of items) {
    text(it.label, y)
    y += BAR
    for (const pair of it.pairs) {
      parts.push({ input: await tile(pair.ref, pair.w, pair.h), raw: { width: TW, height: TH, channels: 3 }, left: PAD, top: y })
      parts.push({ input: await tile(pair.here, pair.w, pair.h), raw: { width: TW, height: TH, channels: 3 }, left: PAD * 2 + TW, top: y })
      y += TH
      text(pair.label, y, 18)
      y += Math.round(BAR * 0.8)
    }
    y += PAD
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await sharp({ create: { width, height: y + PAD, channels: 3, background: '#101010' } }).composite(parts).jpeg({ quality: 82, chromaSubsampling: '4:2:0', mozjpeg: true }).toFile(file)
  return { file, bytes: fs.statSync(file).size, width, height: y + PAD }
}

// ---------------------------------------------------------------------------------------------------------------------
// The short test.

const FRAME_LINE = /^(\S+) frame (\d+), .*?: travel ([\d.]+) px, (\d+) samples, ([\d.]+) s .*sha256 ([0-9a-f]{64}), (.+)$/

function chunkRecords(dir, what) {
  const out = []
  let names = []
  try {
    names = fs.readdirSync(path.join(dir, what)).filter((n) => n.endsWith('.json'))
  } catch {}
  for (const n of names.sort()) {
    const r = readOr(path.join(dir, what, n))
    if (r && r.what === what && Number.isInteger(r.first)) out.push({ ...r, file: path.join(dir, what, n.replace(/\.json$/, '.mp4')) })
  }
  return out.sort((a, b) => a.first - b.first)
}

async function fillSimcache(ctx, mode, whats) {
  const t0 = Date.now()
  for (let i = 0; i < 40; i++) {
    const r = await runTool(ctx, 'simcache.mjs', [...whats, ...(mode.local ? ['--local'] : [])])
    if (r.code !== 0) return { ok: false, why: `the checkpoints of the simulation could not be made: ${whyOf(r)}` }
    if (r.tail.some((l) => /complete for engine/.test(l))) return { ok: true, seconds: (Date.now() - t0) / 1000 }
  }
  return { ok: false, why: 'the checkpoints of the simulation were not complete after 40 runs' }
}

async function calibrate(ctx, mode) {
  const r = await runTool(ctx, 'master.mjs', ['--calibrate', ...(mode.local ? ['--local'] : [])])
  if (r.code !== 0) return { ok: false, why: `the calibration picture could not be drawn: ${whyOf(r)}` }
  const c = readOr(CAL_FILE())
  return c ? { ok: true, seconds: c.seconds, sha256: c.sha256 } : { ok: false, why: 'the calibration picture left no record' }
}

// The calibration picture and its record, where the renderer keeps them
const CAL_FILE = () => rel('out', 'work', 'master', 'calibration.json')
const CAL_PNG = () => rel('out', 'work', 'master', 'calibration.png')
// the note the renderer writes beside every still it draws
const CAL_SIDE = () => `${CAL_PNG()}.json`
const shaOfFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

/** A second drawing that was cut short left the kept pair under its other name: it comes back before anything else. */
function calibrationHome(ctx, cut = true) {
  for (const f of [CAL_FILE(), CAL_PNG(), CAL_SIDE()]) {
    if (!fs.existsSync(`${f}.kept`)) continue
    fs.rmSync(f, { force: true })
    fs.renameSync(`${f}.kept`, f)
    if (cut) ctx.note(`put back after a second drawing that was cut short: the kept ${path.basename(f)}`)
  }
}

/** The records of the finished chunks of film B and of the loop that lie on disk, whatever build and picture they name. */
function engineChunksOnDisk(ctx, mode, parts) {
  const out = []
  // the tool's own small run: while a test runs, the render's chunks stand aside (holdSmallRender)
  const dir = mode.small && fs.existsSync(path.join(ctx.H, 'small-render-chunks')) ? path.join(ctx.H, 'small-render-chunks') : chunksDir(mode)
  for (const part of parts) {
    if (part.what === 'opening') continue
    for (const c of L.chunkLines(part.first, part.last, mode.chunk)) {
      const stem = path.join(dir, part.what, L.chunkFile(part.what, c))
      if (!fs.existsSync(`${stem}.mp4`) || !fs.existsSync(`${stem}.json`)) continue
      const r = readOr(`${stem}.json`)
      out.push({ what: part.what, frames: c.last - c.first + 1, engineHash: r?.engineHash ?? null, renderer: r?.renderer ?? null, machine: r?.machine ?? null, calibration: r?.calibration ?? null })
    }
  }
  return out
}

/**
 * The calibration picture is drawn once for a build on this machine and kept. Every chunk names it, and the films
 * are joined only from chunks that name one and the same, so nothing here replaces a record that the renderer
 * takes: the short test and the render both come through this, however often and in whatever order.
 * Where the record is gone or cannot be read while finished chunks of this machine and build name a picture, the
 * record is written again from their word and nothing is drawn. Where a picture must be drawn although chunks lie
 * on disk, that is said at once with their count: they name another one and are drawn again before the join.
 * `draw: false` only looks and says what would be done (the render's refusals come before anything is drawn).
 */
async function keptCalibration(ctx, mode, hash, parts, { draw = true } = {}) {
  calibrationHome(ctx)
  const { machineId, rendererName } = await import('./browser.mjs')
  const want = { engineHash: hash, renderer: rendererName(mode.local), machine: machineId() }
  const onDisk = engineChunksOnDisk(ctx, mode, parts)
  const step = L.calibrationStep({ record: readOr(CAL_FILE()), chunks: onDisk, want })
  const others = (sha) => onDisk.filter((c) => !L.chunkCounts(c, { what: c.what, engineHash: hash, calibration: sha }))
  const again = (list) => `${list.length} finished ${list.length === 1 ? 'chunk' : 'chunks'} (${sum(list.map((c) => c.frames))} frames) on disk ${list.length === 1 ? 'names' : 'name'} another build or another calibration picture, and ${list.length === 1 ? 'is' : 'are'} drawn again before the films are joined`
  if (step.do === 'keep') {
    ctx.say(`the calibration picture of this build on this machine is kept and not drawn again: ${step.sha256.slice(0, 12)}`)
  } else if (step.do === 'restore') {
    const png = CAL_PNG()
    if (fs.existsSync(png) && shaOfFile(png) !== step.sha256) fs.rmSync(png, { force: true })
    writeJson(CAL_FILE(), { sha256: step.sha256, engineHash: want.engineHash, renderer: want.renderer, machine: want.machine, restored: new Date().toISOString(), restoredFrom: `${step.chunks} finished chunks (${step.frames} frames) that this machine drew for this build` })
    ctx.say(`the record of the calibration picture was gone or could not be read, and ${step.chunks} finished ${step.chunks === 1 ? 'chunk' : 'chunks'} (${step.frames} frames) of this build name the picture ${step.sha256.slice(0, 12)}: the record is written again from them and no new picture is drawn, so every chunk goes on naming one picture`)
  } else if (!draw) {
    return { ok: true, did: 'draw', sha256: null, seconds: null, again: others(null).length }
  } else {
    const list = others(null)
    if (list.length) ctx.say(`no calibration picture of this build is kept on this machine and no finished chunk of it names one, so one is drawn. ${again(list)}`)
    const cal = await calibrate(ctx, mode)
    if (!cal.ok) return { ok: false, why: cal.why }
    ctx.say(`the calibration picture is drawn for this build on this machine and kept from here on: ${cal.sha256.slice(0, 12)} (${cal.seconds} s)`)
    return { ok: true, did: 'draw', sha256: cal.sha256, seconds: cal.seconds, again: list.length }
  }
  const list = others(step.sha256)
  if (list.length) ctx.say(again(list))
  return { ok: true, did: step.do, sha256: step.sha256, seconds: readOr(CAL_FILE())?.seconds ?? null, again: list.length }
}

/**
 * Whether this machine draws the calibration picture the same twice: a second one is drawn into the test's own
 * folder and compared with the kept one. The kept pair stands aside under another name meanwhile and comes back
 * whatever happens; it is never replaced. What comes out is a line of the report, no pass and no fail.
 */
async function calibrationTwice(ctx, mode, T) {
  const json = CAL_FILE()
  const png = CAL_PNG()
  const kept = readOr(json)
  if (!kept) return { why: 'no kept record to compare with' }
  const keptPng = fs.existsSync(png) && shaOfFile(png) === kept.sha256
  const secondJson = path.join(T, 'calibration-second.json')
  const secondPng = path.join(T, 'calibration-second.png')
  // aside: the picture first, then the record. Back: the record first, then the picture. calibrationHome mends a cut
  if (fs.existsSync(CAL_SIDE())) fs.renameSync(CAL_SIDE(), `${CAL_SIDE()}.kept`)
  if (fs.existsSync(png)) fs.renameSync(png, `${png}.kept`)
  fs.renameSync(json, `${json}.kept`)
  let r = null
  let second = null
  try {
    r = await runTool(ctx, 'master.mjs', ['--calibrate', ...(mode.local ? ['--local'] : [])])
    second = r.code === 0 ? readOr(json) : null
    if (second && fs.existsSync(png)) {
      fs.rmSync(secondPng, { force: true })
      fs.renameSync(png, secondPng)
    }
    if (second) writeJson(secondJson, second)
  } finally {
    fs.rmSync(json, { force: true })
    fs.rmSync(png, { force: true })
    fs.rmSync(CAL_SIDE(), { force: true })
    calibrationHome(ctx, false)
  }
  if (!second) return { why: `the second picture could not be drawn: ${r ? whyOf(r) : 'the renderer did not start'}` }
  const out = { sha256: second.sha256, kept: kept.sha256, same: second.sha256 === kept.sha256, seconds: second.seconds }
  if (keptPng && fs.existsSync(secondPng)) {
    const a = await rgbOfFile(png)
    const b = await rgbOfFile(secondPng)
    const apart = a.width === b.width && a.height === b.height ? L.pixelsApart(a.data, b.data, 3) : null
    if (apart) Object.assign(out, apart)
  }
  return out
}

async function makeSound(ctx, file, kind, seconds, { from = null, offset = 0 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const d = seconds.toFixed(6)
  const args =
    kind === 'mix'
      ? ['-v', 'error', '-nostdin', '-y', '-ss', offset.toFixed(6), '-t', d, '-i', from, '-c:a', 'copy', file]
      : kind === 'tone'
        ? // two channels of noise that share nothing: the one made up sound that takes the bits a real mix takes
          ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', `anoisesrc=color=white:sample_rate=48000:amplitude=0.25:duration=${d}:seed=7`, '-f', 'lavfi', '-i', `anoisesrc=color=white:sample_rate=48000:amplitude=0.25:duration=${d}:seed=11`, '-filter_complex', '[0:a][1:a]amerge=inputs=2[a]', '-map', '[a]', '-c:a', 'pcm_s16le', file]
        : ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-t', d, '-c:a', 'pcm_s16le', file]
  const r = await runFile(ctx, 'ffmpeg', args)
  return r.code === 0 && fs.existsSync(file)
}

/** The two final mixes against the stamp. */
export function soundState(stamp) {
  return ['film-a', 'film-b'].map((k) => {
    const file = rel('audio', 'final', `${k}.wav`)
    return { ...L.soundVerdict(k, `audio/final/${k}.wav`, fs.existsSync(file) ? L.sha256File(file) : '', stamp.sound[k]), file }
  })
}

/**
 * A short test that failed leaves one folder for the remote team, where the floors are ruled on: the numbers, the
 * sheet of pictures, what this machine drew and what the doctor found. It lies on the Desktop, or in the work folder
 * when the Desktop cannot be written. The caller puts the report of the test into it, last.
 */
export function keepFailedTest(ctx, result) {
  const since = Date.parse(result.time ?? '') || 0
  const have = []
  const see = (p) => {
    try {
      const s = fs.statSync(path.join(ctx.H, ...p.split('/')))
      if (s.isFile()) have.push({ path: p, ms: s.mtimeMs, bytes: s.size })
    } catch {}
  }
  for (const p of ['test.json', 'doctor.json', 'report-doctor.txt', 'shader-messages-test.txt', 'test/contact-sheet.jpg']) see(p)
  try {
    for (const n of fs.readdirSync(path.join(ctx.H, 'compared'))) see(`compared/${n}`)
  } catch {}
  const picked = L.failedTestPick(have, since)
  const desktop = result.desktop || readOr(path.join(ctx.H, 'doctor.json'))?.machine?.desktop || ''
  const places = [...(desktop ? [path.join(desktop, L.failedTestName())] : []), path.join(ctx.H, 'test-failed')]
  const say = (m) => (ctx.say ?? ctx.note)(m)
  for (const folder of places) {
    try {
      if (!startBundle(ctx.H, folder, say)) continue
      for (const f of picked) addBundleFile(ctx.H, folder, f.as, (to) => fs.copyFileSync(path.join(ctx.H, ...f.from.split('/')), to, fs.constants.COPYFILE_EXCL))
      return { folder, files: picked.length, bytes: sum(picked.map((f) => f.bytes)), pictures: picked.filter((f) => f.picture).length }
    } catch (e) {
      ctx.note(`the folder of the failed test could not be written as ${folder}: ${e.message}`)
    }
  }
  return null
}

/** A short test that passed takes away only sealed files of an earlier failed test. */
export function dropFailedTest(ctx, result) {
  const desktop = result.desktop || readOr(path.join(ctx.H, 'doctor.json'))?.machine?.desktop || ''
  const say = (m) => (ctx.say ?? ctx.note)(m)
  for (const folder of [...(desktop ? [path.join(desktop, L.failedTestName())] : []), path.join(ctx.H, 'test-failed')]) {
    try {
      discardBundle(ctx.H, folder, say)
    } catch (e) {
      ctx.note(`the folder of an earlier failed test could not be taken away (${folder}): ${e.message}`)
    }
  }
}

export function writeFailedTestReport(ctx, folder, text) {
  addBundleFile(ctx.H, folder, 'report-test.txt', (to) => fs.writeFileSync(to, text, { flag: 'wx' }))
}

// The small run of the tool's own tests keeps the chunks of its render where the short test keeps its own (the
// renderer puts both in one folder there; a real render has a folder of its own that the test never touches).
// So a small test sets a small render's chunks aside while it runs and puts them back at its end.
const smallHeld = (ctx) => path.join(ctx.H, 'small-render-chunks')
function holdSmallRender(ctx) {
  if (!ctx.T.small) return
  const here = rel('out', 'master', 'test')
  const held = smallHeld(ctx)
  if (fs.existsSync(held)) return
  const started = (readOr(path.join(ctx.H, 'render-state.json'))?.sessions ?? []).length > 0
  if (started && fs.existsSync(here)) {
    fs.renameSync(here, held)
    ctx.note(`small run: the chunks of the render stand aside in ${short(held)} while the test runs`)
  }
}
function backSmallRender(ctx) {
  if (!ctx.T.small) return
  const here = rel('out', 'master', 'test')
  const held = smallHeld(ctx)
  if (!fs.existsSync(held)) return
  fs.rmSync(here, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(here), { recursive: true })
  fs.renameSync(held, here)
  ctx.note(`small run: the chunks of the render are back in ${short(here)}`)
}

export async function shortTest(ctx) {
  calibrationHome(ctx)
  holdSmallRender(ctx)
  try {
    return await shortTestOnce(ctx)
  } finally {
    backSmallRender(ctx)
  }
}

async function shortTestOnce(ctx) {
  const rows = []
  const row = (check, found, wanted, pass) => rows.push({ check, found, wanted, pass })
  const result = { pass: false, why: '', rows, time: new Date().toISOString() }
  // a test that begins takes away the record of the test before it, and the yes that was given on that test: a test
  // that dies leaves no older pass behind, and every yes belongs to one test
  for (const f of ['test.json', A.APPROVAL_FILES.render, A.APPROVAL_FILES.asked]) fs.rmSync(path.join(ctx.H, f), { force: true })
  let onFail = () => {}
  const fail = (why) => {
    onFail()
    result.pass = false
    result.why = why
    return result
  }
  const doc = await doctor(ctx)
  if (doc.machine?.desktop) result.desktop = doc.machine.desktop
  if (!doc.pass) return fail(`the doctor does not pass, so nothing was drawn: ${doc.why}`)
  result.driver = doc.driver ?? ''
  const look = [...(doc.look ?? [])]
  result.look = look
  // the machine is kept awake for as long as this process lives; nothing of the system's settings is changed
  const awake = await X.keepAwake(process.pid)
  ctx.say(`awake: ${awake.how}${awake.pid ? ` (process ${awake.pid})` : ''}`)
  result.awake = awake.how
  const stamp = readStamp()
  const { cfg } = await import('./page.mjs')
  const { machineId } = await import('./browser.mjs')
  const { probeStreams } = await import('./encode.mjs')
  const { procsMemoryHolds } = await import('./master.mjs')
  const mode = modeOf(ctx, cfg)
  const hash = engineHash()
  const T = path.join(ctx.H, 'test')
  fs.rmSync(T, { recursive: true, force: true })
  fs.mkdirSync(T, { recursive: true })
  // the test's own chunks and films: nothing of a real render lives in these two folders
  fs.rmSync(rel('out', 'master', 'test'), { recursive: true, force: true })
  fs.rmSync(rel('out', 'work', 'master', 'test'), { recursive: true, force: true })
  Object.assign(result, { engineHash: hash, machine: machineId(), small: mode.small, software: doc.software === true, renderer: doc.renderer, browser: doc.page.browser, width: mode.format.width, height: mode.format.height, switches: { ...ctx.T } })
  const counts = { 'film-b': L.countsOf(stamp.samples?.['film-b']), loop: L.countsOf(stamp.samples?.loop) }
  const refs = stamp.references.filter((r) => !ctx.T.refs || ctx.T.refs.split('+').includes(`${r.what}:${r.frame}`))
  const stretch = L.stretchPlan(ctx.T.stretch || (mode.small ? '708-731/6' : ''), stamp.test.stretch, mode.chunk)
  const size = stretch.size
  const memoryHolds = mode.small ? 2 : procsMemoryHolds(os.totalmem())

  // how long, said before anything is drawn
  ctx.say(`the short test: ${refs.length} reference ${refs.length === 1 ? 'frame' : 'frames'} and film B frames ${stretch.first} to ${stretch.last} at ${mode.format.width} x ${mode.format.height}, ${mode.small ? "small and in few samples, a run of the tool's own tests" : "the masters' tier"}`)
  // what this stamp holds to compare with, counted from the stamp itself
  for (const l of L.referencesLines(stamp)) ctx.say(l)
  result.references = { kept: stamp.references.map((r) => `${r.what}:${r.frame}`), stillToDraw: [...(stamp.stillToDraw ?? [])], compared: refs.map((r) => `${r.what}:${r.frame}`) }
  result.where = []
  // the calibration picture: drawn once for a build on this machine and kept, never replaced by a test
  const cal = await keptCalibration(ctx, mode, hash, renderParts(stamp, mode))
  if (!cal.ok) return fail(cal.why)
  // and whether this machine draws it the same twice: a line of the report, no pass and no fail
  const twice = await calibrationTwice(ctx, mode, T)
  ctx.say(`the calibration picture drawn twice on this machine: ${L.twiceLine(twice)}`)
  row('the calibration picture drawn twice', L.twiceLine(twice), `noted only: the kept one (${cal.sha256.slice(0, 12)}) stays and is the one every chunk names`, null)
  if (!(cal.seconds > 0)) cal.seconds = twice.seconds > 0 ? twice.seconds : 0
  const tierSamples = cfg.tiers.review.samplesPerFrame
  const perSampleGuess = (cal.seconds / tierSamples) * ((mode.format.width * mode.format.height) / (cfg.formats.hd.width * cfg.formats.hd.height))
  const samplesAhead = mode.small ? (refs.length + stretch.last - stretch.first + 1) * 2 : sum(refs.filter((r) => r.what !== 'opening').map((r) => r.samples)) + sum(counts['film-b'].slice(stretch.first, stretch.last + 1))
  const guess = samplesAhead * perSampleGuess
  result.calibration = { seconds: cal.seconds, sha256: cal.sha256, did: cal.did, twice: { ...twice, line: L.twiceLine(twice) } }
  // the build this test stands for: a render finds the same again, or it does not start
  result.identity = A.identityOf({ engineHash: hash, stamp, calibration: cal.sha256, renderer: doc.renderer, driver: doc.driver ?? '', chrome: doc.page?.browser ?? '' })
  ctx.say(`the calibration picture took ${cal.seconds} s. By that, the test draws ${samplesAhead} samples in about ${L.hoursText(guess)} (a rough guess before anything is measured)`)
  if (guess > 20 * 60) ctx.say(`THIS MACHINE IS SLOW: the short test will take about ${L.hoursText(guess)}. It goes on by itself and nothing needs doing meanwhile`)

  const sim = await fillSimcache(ctx, mode, ['film', 'loop'])
  if (!sim.ok) return fail(sim.why)
  ctx.say(`the checkpoints of the simulation are made (${L.hoursText(sim.seconds)})`)

  // every program of the film and of the loop compiled once on this machine: what its shader compiler says of each
  const S = await import('./handoff-shaders.mjs')
  const after = []
  result.after = after
  let walk = null
  ctx.say(`every program of the film is compiled once: ${Object.values(S.WALK).flat().length} frames of film B and of the loop, drawn small in one sample`)
  try {
    walk = await S.walkShaders({ lib: rel('tools', 'lib'), dist: rel('dist'), local: mode.local, say: ctx.note })
  } catch (e) {
    row('shaders across the film', `the page could not be walked: ${String(e.message).split('\n')[0]}`, `${Object.values(S.WALK).flat().length} frames drawn small, every program compiled`, false)
  }
  if (walk) {
    const file = path.join(ctx.H, 'shader-messages-test.txt')
    fs.writeFileSync(file, S.shaderList(walk.seen, S.walkHead(walk, [`${L.TITLE}: what the shader compiler wrote, program by program, across the film`, `written   ${new Date().toISOString()}`, `engine    ${hash}`]), { srcDir: rel('src') }))
    fs.rmSync(path.join(ctx.H, 'shaders-test'), { recursive: true, force: true })
    S.writeShaders(walk.seen, path.join(ctx.H, 'shaders-test'))
    const brief = S.briefLogs(walk.seen)
    const errors = brief.flatMap((e) => e.messages.filter((m) => m.kind === 'error').map((m) => `${e.fragment}: ${m.code} ${m.text}`))
    const frames = Object.values(walk.frames).flat().length
    result.shaders = { file, linked: walk.seen.linked, withLog: walk.seen.logs.length, different: brief, maths: walk.maths, notDrawn: walk.notDrawn, errors: walk.errors }
    row('shaders across the film', walk.notDrawn.length ? `not drawn: ${walk.notDrawn.join('; ')}` : `${frames} frames drawn small, ${walk.seen.linked} programs compiled`, `${frames} frames drawn small, every program compiled`, walk.notDrawn.length === 0)
    row('shader errors', errors.length ? errors.join('; ') : walk.errors.filter((e) => /^(error|pageerror): /.test(e)).join('; ') || 'none', 'none', errors.length === 0 && !walk.errors.some((e) => /^(error|pageerror): /.test(e)))
    row('shader messages', `${walk.seen.logs.length} of ${walk.seen.linked} programs wrote messages, ${brief.length} different ones; in ${short(file)}`, 'noted only: a shader that warns still compiles and draws', null)
    ctx.say(`${walk.seen.linked} programs compiled, ${walk.seen.logs.length} of them with messages of the shader compiler: ${short(file)}`)
    if (brief.length) {
      after.push(`what the shader compiler of this machine wrote across the film (it stops nothing; the remote team reads it). Each place and each shader in full: ${short(file)} and the folder shaders-test beside it`)
      for (const e of brief) {
        const each = new Map()
        for (const m of e.messages) each.set(`${m.code} ${m.text}`, (each.get(`${m.code} ${m.text}`) ?? 0) + 1)
        after.push(`  fragment shader "${e.fragment}", vertex shader "${e.vertex}", ${e.programs} ${e.programs === 1 ? 'program' : 'programs'}:`)
        for (const [text, times] of each) after.push(`      ${times} x  ${text}`)
      }
    }
    if (walk.maths?.lines) after.push('the maths probe of the tree on this card (src/core/maths.ts):', `  ${walk.maths.lines.join('; ')}`)
  }

  // the card's load is read from here until the last chunk of the stretch is drawn
  const wantNvidia = L.wantedCard(doc.machine.cards)?.vendor === 'NVIDIA'
  const cardWatch = X.watchCard()
  let cardRead = false
  const readCard = () => {
    if (cardRead) return
    cardRead = true
    const load = cardWatch.stop()
    const v = L.loadVerdict(load, { wantNvidia, found: load.found, why: load.why })
    result.cardLoad = { ...load, text: v.text }
    row('the card while frames were drawn', v.text, 'noted only: a card that draws is busy', null)
    ctx.say(`card load  ${v.text}`)
    if (v.look) look.push(v.look)
  }
  onFail = () => {
    try {
      cardWatch.stop()
    } catch {}
  }

  // (a) the reference frames
  const sheet = []
  const timed = []
  const drawnDir = path.join(T, 'frames')
  const sharp = (await import('sharp')).default
  const comparedDir = path.join(ctx.H, 'compared')
  fs.rmSync(comparedDir, { recursive: true, force: true })
  fs.mkdirSync(comparedDir, { recursive: true })
  for (const what of ['film-b', 'loop']) {
    const list = refs.filter((r) => r.what === what)
    if (!list.length) continue
    const seen = new Map()
    const r = await runTool(ctx, 'shutter-frame.mjs', ['--what', what, '--frames', list.map((x) => x.frame).join(','), '--out', short(drawnDir), ...(mode.small ? ['--format', mode.format.id, '--tier', 'samples-2'] : []), ...(mode.local ? ['--local'] : [])], (l) => {
      const m = FRAME_LINE.exec(l)
      if (m) {
        seen.set(Number(m[2]), { samples: Number(m[4]), seconds: Number(m[5]), file: rel(m[7]) })
        ctx.say(`drawn: ${what} frame ${m[2]}, ${m[4]} samples, ${m[5]} s`)
      }
    })
    if (r.code !== 0) return fail(`the reference frames of ${what} could not be drawn: ${whyOf(r)}`)
    for (const ref of list) {
      const got = seen.get(ref.frame)
      if (!got || !fs.existsSync(got.file)) return fail(`${what} frame ${ref.frame} was not drawn: the tool named no file for it`)
      timed.push({ what, frame: ref.frame, samples: got.samples, seconds: got.seconds })
      const here = await rgbOfFile(got.file)
      const loaded = await loadReference(ref)
      const name = `${what} frame ${ref.frame}${ref.name ? ` (${ref.name})` : ''}`
      if (mode.small) {
        // a small picture of few samples is no match for the reference: the numbers are noted and hold nothing
        const quarter = L.half(loaded.half.data, loaded.half.width, loaded.half.height)
        const bad = L.pictureProblem(here.data, here.width, here.height)
        row(`${name}: a picture`, bad || 'it holds a picture', 'no flat or empty frame', !bad)
        if (!bad && quarter.width === here.width) row(`${name}: whole picture, small`, `${L.psnr(here.data, quarter.data).psnr.toFixed(2)} dB, blocks ${L.coarsePsnr(here.data, quarter.data, here.width, here.height).toFixed(2)} dB`, 'noted only: a small draft against the reference', null)
        continue
      }
      if (got.samples !== ref.samples) row(`${name}: samples`, `${got.samples}`, `${ref.samples}, as the reference was drawn`, false)
      const c = L.compareFrame({ here: here.data, width: here.width, height: here.height, ref: loaded, floors: L.floorsOfTest(stamp.floors, ctx.T.floorsHigh === true) })
      for (const x of c.rows) row(`${name}: ${x.check}`, x.found, x.wanted, x.pass)
      ;(result.frames ??= []).push({ what, frame: ref.frame, samples: got.samples, seconds: got.seconds, ...c.numbers, pass: c.pass })
      const h = L.half(here.data, here.width, here.height)
      // what this machine drew is kept beside the reports, so that a frame that fails can be looked at far away
      const stem = path.join(comparedDir, `${what}-${String(ref.frame).padStart(6, '0')}`)
      const raw3 = (data, w, hh) => sharp(data, { raw: { width: w, height: hh, channels: 3 } })
      await raw3(h.data, h.width, h.height).webp({ lossless: true }).toFile(`${stem}-here-half.webp`)
      await raw3(L.apartPicture(h.data, loaded.half.data, h.width, h.height), h.width, h.height).png().toFile(`${stem}-apart-half.png`)
      for (const cut of loaded.cuts) await raw3(L.crop(here.data, here.width, cut), cut.w, cut.h).webp({ lossless: true }).toFile(`${stem}-here-cut-${cut.name}.webp`)
      sheet.push({ label: `${name}, ${got.samples} samples: whole ${Number.isFinite(c.numbers.psnrWhole) ? c.numbers.psnrWhole.toFixed(2) : 'identical'} dB${c.pass ? '' : '   FAILS'}`, pairs: [{ label: 'the whole picture at half size', ref: loaded.half.data, here: h.data, w: h.width, h: h.height }, ...loaded.cuts.map((cut, k) => ({ label: `cut ${cut.name} at full size, x ${cut.x} y ${cut.y}: ${Number.isFinite(c.numbers.cuts[k].psnr) ? c.numbers.cuts[k].psnr.toFixed(2) : 'identical'} dB`, ref: cut.data, here: L.crop(here.data, here.width, cut), w: cut.w, h: cut.h }))] })
    }
  }
  // the tool's own test of a short test that fails: see floorsOfTest
  if (ctx.T.floorsHigh) row(L.MADE_UP_FAILURE, 'the floors of the drawn frames were raised to 99 dB by a switch', 'no such switch in a real test', false)
  // the opening is never drawn: its reference frame is read from the pack and must be the same picture
  const { openPack } = await import('./openingpack.mjs')
  let pack = null
  for (const ref of refs.filter((r) => r.what === 'opening')) {
    pack ??= await openPack(PACK_DIR)
    const here = await pack.frame(ref.frame)
    const loaded = await loadReference(ref)
    const c = L.compareFrame({ here, width: pack.width, height: pack.height, ref: loaded, floors: stamp.floors })
    for (const x of c.rows) row(`opening frame ${ref.frame}, read from the pack: ${x.check}`, x.found, x.wanted, x.pass)
    const h = L.half(here, pack.width, pack.height)
    sheet.push({ label: `opening frame ${ref.frame}, read from the pack and never drawn here`, pairs: [{ label: 'the whole picture at half size', ref: loaded.half.data, here: h.data, w: h.width, h: h.height }, ...loaded.cuts.map((cut) => ({ label: `cut ${cut.name} at full size, x ${cut.x} y ${cut.y}`, ref: cut.data, here: L.crop(here, pack.width, cut), w: cut.w, h: cut.h }))] })
  }

  // the contact sheet, made as soon as the frames are compared: a test that stops later still leaves its pictures
  if (sheet.length) {
    const file = path.join(T, 'contact-sheet.jpg')
    const made2 = await contactSheet(sheet, file, `${L.TITLE}: the short test on ${doc.renderer}`)
    result.sheet = { file, bytes: made2.bytes, sha256: L.sha256File(file) }
    ctx.say(`contact sheet: ${file} (${mb(made2.bytes)})`)
    const sheetName = `${L.TITLE} - Test - Contact Sheet.jpg`
    let sheetProblem = ''
    try {
      const to = path.join(doc.machine.desktop, sheetName)
      fs.copyFileSync(file, to)
      result.sheet.onDesktop = to
    } catch (e) {
      // the sheet of an earlier test is open in a viewer: the new one goes beside it
      try {
        if (!L.heldOpen(e)) throw e
        const beside = path.join(doc.machine.desktop, L.besideName(sheetName))
        fs.copyFileSync(file, beside)
        result.sheet.onDesktop = beside
        look.push(`the sheet of pictures of an earlier test, "${sheetName}" on the Desktop, is held open by another program and was left as it is. The sheet of this test is beside it as "${path.basename(beside)}"`)
      } catch (e2) {
        sheetProblem = String(e2?.message ?? e2).split('\n')[0]
      }
    }
    // a preview that is not where the reader is sent is a failure of the test, and it is said which one
    row('sheet of pictures: on the Desktop', result.sheet.onDesktop ?? `not copied (${sheetProblem}); it is in the clone as ${file}`, 'copied there', !!result.sheet.onDesktop)
    result.where.push({ label: 'THE SHEET OF PICTURES', path: result.sheet.onDesktop ?? file })
  }

  // one chunk of the opening from the pack, as the full render takes it
  let openingSeconds = null
  if (!mode.small) {
    // cut as the stretch is cut: the encode of the test film reads every chunk of the test and holds them to one size
    const o = await runTool(ctx, 'master.mjs', ['--what', 'opening', '--first', '0', '--last', String(size - 1), '--chunk', String(size), '--pack', PACK_DIR])
    if (o.code !== 0) return fail(`a chunk of the opening could not be made from the pack: ${whyOf(o)}`)
    openingSeconds = o.seconds / size
    row('the opening pack', `${size === 1 ? 'frame 0' : `frames 0 to ${size - 1}`} made into a chunk in ${o.seconds.toFixed(1)} s`, 'read from the pack and encoded, never drawn', true)
  }

  // (b) the stretch across the landing, in chunks, through the master tool
  const range = (list) => ['--what', 'film-b', '--first', String(list[0].first), '--last', String(list[list.length - 1].last)]
  const size6 = ['--chunk', String(size)]
  const drawArgs = mode.small ? ['--format', mode.format.id, '--samples', '2', ...size6] : size6
  const local = mode.local ? ['--local'] : []
  const watch = (l) => {
    const m = /^(?:\[\d+\] )?finished (\S+):/.exec(l)
    if (m) ctx.say(`chunk ${m[1]} is finished`)
  }
  const one = await runTool(ctx, 'master.mjs', [...range(stretch.one), ...drawArgs, ...local], watch)
  if (one.code !== 0) return fail(`the stretch could not be drawn with one process: ${whyOf(one)}`)
  let two = null
  if (stretch.two.length) {
    const procs = memoryHolds >= 2 ? ['--procs', '2'] : []
    two = await runTool(ctx, 'master.mjs', [...range(stretch.two), ...drawArgs, ...local, ...procs], watch)
    if (two.code !== 0) return fail(`the stretch could not be drawn with ${procs.length ? 'two processes' : 'one process'}: ${whyOf(two)}`)
    two.procs = procs.length ? 2 : 1
  }
  readCard()
  const records = chunkRecords(rel('out', 'master', 'test'), 'film-b')
  if (records.length !== stretch.chunks.length) return fail(`the stretch should be ${stretch.chunks.length} chunks on disk and is ${records.length}`)
  const wrong = records.filter((r) => L.softwareName(r.graphics) && !ctx.T.software)
  if (wrong.length) return fail(`a chunk of the stretch was drawn in software ("${wrong[0].graphics}")`)
  // what drew is read again from the record of every chunk: a test that drew nothing, or drew elsewhere, is no proof of the card
  const drewOn = [...new Set(records.map((r) => String(r.graphics ?? '')))]
  result.drewOn = drewOn
  row('the same card drew every piece of the test film', drewOn.map((g) => g || 'a record names nothing').join(' | '), doc.renderer, drewOn.length === 1 && drewOn[0] === doc.renderer)
  row('the stretch', `${records.length} chunks of ${size} frames, frames ${stretch.first} to ${stretch.last}, every one verified against its PNGs (least ${Math.min(...records.map((r) => r.verify?.psnr?.least ?? 0))} dB)`, 'drawn in chunks, each verified', records.every((r) => r.verify?.ok === true))
  const flat = sum(records.map((r) => (r.flatFrames ?? []).length))
  const nan = sum(records.map((r) => r.notNumber?.total ?? 0))
  row('no flat frame, no value that is no number', `${flat} flat, ${nan} values that are no number`, 'none', flat === 0 && nan === 0)

  // the test film, through the encode of the masters
  const frames = stretch.last - stretch.first + 1
  const seconds = frames / mode.fps
  const mixes = soundState(stamp)
  // both final mixes against the stamp, one line each: after a plain pass the render never refuses for a mix
  for (const m of mixes) {
    const name = m.which === 'film-a' ? 'film A' : 'film B'
    ctx.say(`the final mix of ${name}: ${m.ok ? `audio/final/${m.which}.wav is here and is the one the stamp names (sha256 ${stamp.sound[m.which]})` : m.why}`)
    row(`the final mix of ${name}`, m.ok ? `here, sha256 ${stamp.sound[m.which]}` : fs.existsSync(m.file) ? 'here, and not the one the stamp names' : 'not in this clone', 'noted here; the full render needs the mix the stamp names, by its sha256', null)
  }
  result.mixes = mixes.map((m) => ({ which: m.which, ok: m.ok, why: m.why }))
  const soundFile = path.join(T, 'sound.wav')
  let soundLine
  const b = mixes.find((s) => s.which === 'film-b')
  if (b.ok && (await makeSound(ctx, soundFile, 'mix', seconds, { from: b.file, offset: stretch.first / mode.fps }))) soundLine = `The test film carries its own piece of the final mix of film B (audio/final/film-b.wav, sha256 ${stamp.sound['film-b']}).`
  else if (ctx.T.tones && (await makeSound(ctx, soundFile, 'tone', seconds))) soundLine = "The test film carries a made up sound, by a switch of the tool's own tests."
  else if (await makeSound(ctx, soundFile, 'silence', seconds)) soundLine = `The test film is silent: ${fs.existsSync(b.file) ? 'audio/final/film-b.wav is here and is not the final mix the stamp names' : 'the two final mixes are not in this clone (they are not in the public repo)'}, so it carries a track of silence. The full render needs both mixes.`
  else return fail('no sound could be made for the test film: ffmpeg wrote no wav')
  ctx.say(soundLine)
  result.sound = soundLine
  const targetMb = Math.max(0.05, round(cfg.deliver.master.final.targetMb['film-b'] * (frames / stamp.frames['film-b']), 3))
  // the encode cuts its chunk lines as the stretch was cut
  const enc = await runTool(ctx, 'master.mjs', ['--encode', 'film-b', '--test', '--gaps', '--sound', soundFile, '--target-mb', String(targetMb), ...(size !== cfg.deliver.master.chunkFrames ? size6 : [])])
  let made = rel('out', 'work', 'master', 'test', mode.names['film-b'])
  let madeRecord = readOr(`${made}.json`)
  // The encoder proves its film as it proves a master. One of its checks cannot hold for two seconds: the bit rate of
  // the sound, which a piece of silence or a quiet piece of the mix does not reach. That one is noted here, and held
  // by the full render, whose films carry their whole mixes. Every other check is held.
  const SOUND_RATE = 'sound bit rate'
  let rateNote = ''
  if (!fs.existsSync(made)) {
    const unproven = made.replace(/\.mp4$/, '.unproven.mp4')
    const u = readOr(`${unproven}.json`)
    const failing = (u?.proof ?? []).filter((x) => x.pass === false)
    if (fs.existsSync(unproven) && failing.length === 1 && failing[0].check === SOUND_RATE) {
      made = unproven
      madeRecord = u
      rateNote = `the sound takes ${failing[0].found} where a whole mix takes ${failing[0].wanted}`
    }
  }
  if (!fs.existsSync(made) || !madeRecord || (!rateNote && (enc.code !== 0 || madeRecord.passed !== true))) return fail(`the test film could not be encoded and proven: ${whyOf(enc)}`)
  const s = probeStreams(made)
  const v = s.video[0] ?? {}
  const a = s.audio[0] ?? null
  const V = cfg.deliver.master.video
  row('test film: size', `${v.width} x ${v.height}`, `${mode.format.width} x ${mode.format.height}`, v.width === mode.format.width && v.height === mode.format.height)
  row('test film: frames', `${madeRecord.frames} (the container says ${v.nb_frames})`, `${frames}`, madeRecord.frames === frames && Number(v.nb_frames) === frames)
  row('test film: rate', `${v.r_frame_rate}`, `${mode.fps}/1`, v.r_frame_rate === `${mode.fps}/1`)
  row('test film: pixel format', `${v.pix_fmt}`, V.pixFmt, v.pix_fmt === V.pixFmt)
  row('test film: codec, profile, level', `${v.codec_name}, ${v.profile}, ${v.level}`, `h264, ${V.profile}, ${Math.round(Number(V.level) * 10)}`, v.codec_name === 'h264' && String(v.profile).toLowerCase() === V.profile && Number(v.level) === Math.round(Number(V.level) * 10))
  row('test film: sound', a ? `${a.codec_name}, ${a.sample_rate} Hz, ${a.channels} channels, ${Number(a.duration).toFixed(3)} s` : 'none', `aac, ${seconds.toFixed(3)} s`, !!a && a.codec_name === 'aac' && Math.abs(Number(a.duration) - seconds) < 0.05)
  row("test film: the encoder's own proof", rateNote ? `${madeRecord.proof.length - 1} of ${madeRecord.proof.length} checks hold; ${rateNote}, which a piece of two seconds cannot show` : `${madeRecord.proof.filter((p) => p.pass === false).length} of ${madeRecord.proof.length} checks fail`, 'none fails but the bit rate of a short piece of sound', rateNote ? null : madeRecord.passed === true)
  const testName = L.testFilmName(mode.format.width, mode.format.height)
  const kept = path.join(T, testName)
  fs.copyFileSync(made, kept)
  let onDesktop = ''
  try {
    fs.mkdirSync(doc.machine.desktop, { recursive: true })
    onDesktop = path.join(doc.machine.desktop, testName)
    try {
      fs.copyFileSync(made, onDesktop)
    } catch (e) {
      // the test film of an earlier test is open in a player: the new one goes beside it, and the test goes on
      if (!L.heldOpen(e)) throw e
      const beside = path.join(doc.machine.desktop, L.besideName(testName))
      fs.copyFileSync(made, beside)
      look.push(`the test film of an earlier test, "${testName}" on the Desktop, is held open by another program and was left as it is. The film of this test is beside it as "${path.basename(beside)}"`)
      onDesktop = beside
    }
    row('test film: on the Desktop', onDesktop, 'copied there', L.sha256File(onDesktop) === madeRecord.sha256)
  } catch (e) {
    row('test film: on the Desktop', `not copied (${e.message})`, 'copied there', false)
  }
  const filmThere = !!onDesktop && fs.existsSync(onDesktop)
  result.testFilm = { file: filmThere ? onDesktop : kept, bytes: fs.statSync(made).size, sha256: madeRecord.sha256, frames, seconds }
  result.where.unshift({ label: 'THE TEST FILM', path: result.testFilm.file })

  // (c) time, processes and disk
  const first = stretch.one.map((c) => records.find((r) => r.first === c.first))
  // the first frame of a chunk also pays for what the chunk starts with, so it is measured apart
  const timedFrames = first.flatMap((r) => r.frameSamples.map((n, i) => ({ samples: n, seconds: r.frameSeconds[i], head: i === 0 })))
  const inside = timedFrames.filter((f) => !f.head)
  const fitFrames = inside.length >= 4 ? inside : timedFrames
  const cost = L.fitCost(fitFrames) ?? { each: 0, perSample: 0, frames: 0, counts: 0 }
  const heads = inside.length >= 4 ? timedFrames.filter((f) => f.head) : []
  const chunkStart = heads.length ? Math.max(0, sum(heads.map((f) => f.seconds - cost.each - cost.perSample * f.samples)) / heads.length) : 0
  let gainMeasured = 0
  if (two && two.procs === 2) {
    const later = stretch.two.map((c) => records.find((r) => r.first === c.first))
    const alone = sum(later.flatMap((r) => r.frameSamples.map((n) => cost.each + cost.perSample * n))) + chunkStart * later.length
    const wall = Math.max(...[0, 1].map((w) => sum(later.filter((_, i) => i % 2 === w).flatMap((r) => r.frameSeconds))))
    gainMeasured = wall > 0 && later.length >= 2 ? alone / wall : 0
  }
  const rule = L.procsRule({ one: cost.perSample > 0 ? 1 : 0, two: gainMeasured, memoryHolds })
  const gain = rule.procs === 2 ? gainMeasured : 1
  const by = (n) => fitFrames.filter((f) => f.samples === n)
  const at = (n) => (by(n).length ? `${(sum(by(n).map((f) => f.seconds)) / by(n).length).toFixed(2)} s measured on ${by(n).length} frames` : `${(cost.each + cost.perSample * n).toFixed(2)} s by the time estimate`)
  const chunkBytes = sum(records.map((r) => r.bytes)) / records.length
  const pngBytes = timed.length ? Math.max(...timed.map((t) => fs.statSync(path.join(drawnDir, fs.readdirSync(drawnDir).find((n) => n.startsWith(`${t.what}-${String(t.frame).padStart(6, '0')}`)))).size)) : 0
  const disk = mode.small ? null : { chunkMb: round((chunkBytes * (mode.chunk / size)) / 1e6, 1), ...(pngBytes ? { pngMb: round(pngBytes / 1e6, 1) } : {}) }
  const plan = diskNeed(stamp, mode, disk, rule.procs)
  const free = X.freeBytes(rel())
  // a test in the middle of a render is asked for the work that remains, not for a whole new render
  const left = A.diskRemaining(plan, { ...workDone(ctx, stamp, mode), sameDrive: X.sameDrive(rel(), existingFolder(doc.machine.desktop)) })
  row('free disk for the full render', `${L.gb(free).toFixed(1)} GB free`, `${A.remainingText(left)}, with the chunks as large as the test's`, free >= left.total)
  const encodePerFrame = madeRecord.encodeSeconds / frames
  const all = stamp.frames['film-a'] + stamp.frames['film-b'] + stamp.frames.loop
  const batches = Math.ceil(stamp.frames['film-b'] / (mode.chunk * BATCH_CHUNKS)) + Math.ceil(stamp.frames.loop / (mode.chunk * BATCH_CHUNKS))
  const proj = mode.small ? null : L.projection({ counts: { ...addTally(L.tally(counts['film-b']), L.tally(counts.loop)) }, cost, gain, encodeSeconds: encodePerFrame * all + (openingSeconds ?? 0) * stamp.frames.opening, startSeconds: 20, batches, chunkSeconds: chunkStart, chunks: Math.ceil(stamp.frames['film-b'] / mode.chunk) + Math.ceil(stamp.frames.loop / mode.chunk) })
  Object.assign(result, { cost: { each: round(cost.each, 3), perSample: round(cost.perSample, 4), frames: cost.frames, chunkStart: round(chunkStart, 2) }, gainMeasured: round(gainMeasured, 2), procs: rule.procs, procsWhy: rule.why, memoryHolds, disk, diskNeedBytes: left.total, timed, projection: proj })
  ctx.say(`time: a frame of 24 samples takes ${at(24)}, a frame of 96 samples ${at(96)} (the time estimate: ${cost.each.toFixed(2)} s a frame and ${cost.perSample.toFixed(3)} s a sample, from ${cost.frames} frames drawn by one process${chunkStart > 0 ? `, and ${chunkStart.toFixed(1)} s more at the start of each chunk` : ''})`)
  ctx.say(`workers (drawing processes side by side): ${rule.why}. The full render uses ${rule.procs} ${rule.procs === 1 ? 'worker' : 'workers'}`)
  if (proj) {
    ctx.say(`projection: film B and the loop are ${proj.frames} frames, ${L.hoursText(proj.drawSeconds)} of drawing with ${rule.procs} ${rule.procs === 1 ? 'process' : 'processes'}, ${L.hoursText(proj.startSeconds)} of starting browsers, ${L.hoursText(proj.encodeSeconds)} for the opening and the three encodes: ${L.hoursText(proj.seconds)} in all`)
    ctx.say(`disk: at its fullest ${left.leftChunks === left.chunks ? 'the full render holds' : 'what is still to do of the full render holds'} ${L.gb(left.total).toFixed(1)} GB (chunks of ${disk.chunkMb} MB), and ${L.gb(free).toFixed(1)} GB is free`)
    if (proj.seconds > L.TOO_LONG_HOURS * 3600) ctx.say(`MORE THAN ${L.TOO_LONG_HOURS} HOURS: the full render is projected at ${L.hoursText(proj.seconds)} on this machine. Say so in the report; whether it is started is decided by the one who released the film`)
  }

  // what bears on a render of hours: each is a LOOK line of this report, and Brandon's yes for the full render quotes it
  const cleanTime = cleanedSince(ctx)
  result.longRun = [...A.longRunLines({ projectionSeconds: proj?.seconds ?? null, tooLongHours: L.TOO_LONG_HOURS, freeBytes: free, needBytes: left.total, awakeFailed: awake.pid ? '' : awake.how, again: cleanTime ? A.againText(cleanTime) : '' }), ...(doc.longRun ?? [])]
  for (const l of result.longRun) if (!look.includes(l.text)) look.push(l.text)
  ctx.say(`test film: ${result.testFilm.file} (${mb(fs.statSync(made).size)}, ${frames} frames)`)

  // the test's chunks leave the folder a later encode reads
  fs.renameSync(rel('out', 'master', 'test'), path.join(T, 'chunks'))
  fs.rmSync(rel('out', 'work', 'master', 'test'), { recursive: true, force: true })
  result.pass = rows.every((r) => r.pass !== false)
  // a picture that passed is not yet a render that can start: what stands in its way is said in the same sentence
  const notReady = L.notReadyReasons({ stamp, sound: mixes, tones: ctx.T.tones === true, small: mode.small })
  result.notReady = notReady
  result.why = result.pass ? `${notReady.length ? 'the picture passed' : 'the short test passed'} on ${doc.renderer}: ${refs.length} reference ${refs.length === 1 ? 'frame' : 'frames'} and ${frames} frames of film B${proj ? `, the full render is projected at ${L.hoursText(proj.seconds)} with ${rule.procs} ${rule.procs === 1 ? 'worker' : 'workers'}` : ''}${look.length ? `. ${look.length} ${look.length === 1 ? 'thing is' : 'things are'} marked LOOK in the report for the remote team` : ''}${notReady.length ? `, and the render is not ready: ${notReady.join('; ')}` : ''}. No full render was started. Stop here` : `the short test did not pass: ${rows.filter((r) => r.pass === false).map((r) => `${r.check} is ${r.found}, wanted ${r.wanted}`).slice(0, 4).join('; ')}. No full render was started`
  return result
}

function addTally(a, b) {
  const out = { ...a }
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] ?? 0) + n
  return out
}

// ---------------------------------------------------------------------------------------------------------------------
// The full render.

export const BATCH_CHUNKS = 6

export const finalsDir = (mode) => (mode.small ? rel('out', 'work', 'master', 'test') : rel('out', 'deliver'))
export const chunksDir = (mode) => (mode.small ? rel('out', 'master', 'test') : rel('out', 'master'))
// Rows of the encoder's own proof that say how well a whole film came out. A draft of a dozen small frames cannot
// hold them, so the small run of the tool's own tests notes them and goes on. A real render holds every row.
const DRAFT_ROWS = ['sound bit rate', "the loop against film B's best hold", 'the wrap']
const proven = (rec, mode) => rec?.passed === true || (mode.small === true && Array.isArray(rec?.draftNoted))
/** Small run only: takes a file whose proof failed on draft rows alone, and names those rows in its record. */
function draftAccept(which, mode) {
  if (!mode.small) return null
  const files = finalFiles(mode)
  const unproven = files[which].replace(/\.mp4$/, '.unproven.mp4')
  const u = readOr(`${unproven}.json`)
  const failing = (u?.proof ?? []).filter((x) => x.pass === false).map((x) => x.check)
  if (!u || !fs.existsSync(unproven) || !failing.length || failing.some((c) => !DRAFT_ROWS.includes(c))) return null
  fs.renameSync(unproven, files[which])
  fs.writeFileSync(`${files[which]}.json`, `${JSON.stringify({ ...u, draftNoted: failing }, null, 2)}\n`)
  fs.rmSync(`${unproven}.json`, { force: true })
  if (which === 'loop') {
    const png = path.join(chunksDir(mode), 'loop', 'frame-000000.png')
    if (fs.existsSync(png)) fs.copyFileSync(png, files.still)
  }
  return failing
}
export const finalFiles = (mode) => ({
  'film-a': path.join(finalsDir(mode), mode.names['film-a']),
  'film-b': path.join(finalsDir(mode), mode.names['film-b']),
  loop: path.join(finalsDir(mode), mode.names.loop),
  still: path.join(finalsDir(mode), mode.small ? `test-${mode.names.still}` : mode.names.still),
})

/** The parts the render draws, in order. The tool's own tests take short ranges. */
function renderParts(stamp, mode) {
  if (mode.small) return [{ what: 'film-b', first: 0, last: 17 }, { what: 'loop', first: 0, last: 11 }, { what: 'opening', first: 0, last: 11 }]
  return [{ what: 'film-b', first: 0, last: stamp.frames['film-b'] - 1 }, { what: 'loop', first: 0, last: stamp.frames.loop - 1 }, { what: 'opening', first: 0, last: stamp.frames.opening - 1 }]
}

/** A small pack of the opening for the tool's own tests, made from the real one: every frame, at the small size. */
async function smallPack(ctx, mode) {
  const dir = path.join(ctx.H, 'small-pack')
  const { openPack, buildPack, hasPack, PACK_FILES } = await import('./openingpack.mjs')
  if (hasPack(dir)) return dir
  const sharp = (await import('sharp')).default
  const pack = await openPack(PACK_DIR)
  const made = buildPack({ width: mode.format.width, height: mode.format.height, fps: pack.fps })
  let last = null
  let lastSmall = null
  for (let i = 0; i < pack.frameCount; i++) {
    const rgb = await pack.frame(i)
    if (!last || !last.equals(rgb)) {
      lastSmall = await sharp(rgb, { raw: { width: pack.width, height: pack.height, channels: 3 } }).resize(mode.format.width, mode.format.height, { kernel: 'nearest' }).raw().toBuffer()
      last = rgb
    }
    await made.add(lastSmall)
  }
  const out = await made.finish(pack.states ?? [], pack.background ?? null)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, PACK_FILES.bin), out.bin)
  fs.writeFileSync(path.join(dir, PACK_FILES.manifest), out.manifest)
  return dir
}

// ---------------------------------------------------------------------------------------------------------------------
// Brandon's yes, for the full render and for the upload. The rules are in tools/lib/handoff-approve.mjs.

/** When the film was rendered, delivered and cleaned here and not rendered since: the time the clean passed. Else empty. */
function cleanedSince(ctx) {
  const ended = readOr(path.join(ctx.H, 'ended.json'), {})
  const c = ended?.clean
  const r = ended?.render
  if (c?.state !== 'PASS' || !c.time) return ''
  if (r?.state === 'PASS' && Date.parse(r.time) > Date.parse(c.time)) return ''
  return c.time
}

/** What bears on a render of hours as the machine is now, with the room that what is still to do needs. */
function longRunNow(ctx, { doc, test, stamp, mode, awake = null }) {
  const plan = diskNeed(stamp, mode, test?.disk ?? null, mode.small ? 2 : (test?.procs ?? 1))
  const left = A.diskRemaining(plan, { ...workDone(ctx, stamp, mode), sameDrive: X.sameDrive(rel(), existingFolder(doc.machine.desktop)) })
  const free = X.freeBytes(rel())
  const cleanTime = cleanedSince(ctx)
  const lines = [...A.longRunLines({ projectionSeconds: test?.projection?.seconds ?? null, tooLongHours: L.TOO_LONG_HOURS, freeBytes: free, needBytes: left.total, awakeFailed: awake && !awake.pid ? awake.how : '', again: cleanTime ? A.againText(cleanTime) : '' }), ...(doc.longRun ?? [])]
  return { lines, left, free, cleanTime, plan }
}

/** A preview of the test by path and sha256: where the test left it, or its copy in the clone, whichever still is that file. */
function previewOf(paths, sha) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p) && L.sha256File(p) === sha) return { path: p, sha256: sha }
    } catch {}
  }
  return null
}

export async function approve(ctx) {
  const a = A.approveArgs(['approve', ...(ctx.args ?? [])])
  if ('problem' in a) return { pass: false, why: a.problem, refused: true }
  return a.what === 'render' ? approveRender(ctx, a.words) : approveUpload(ctx, a.words)
}

async function approveRender(ctx, words) {
  const fail = (why) => ({ pass: false, why, refused: true })
  const none = 'No yes is recorded'
  const stamp = readStamp()
  const mode = modeOf(ctx, loadCfg())
  const hash = engineHash()
  // the remote team's own lock stands beside this one, and comes first
  const gate = L.renderRefusals({ stamp, engineHash: hash, doctor: { pass: true }, test: { pass: true, engineHash: hash }, sound: [], small: mode.small })
  if (gate.length) return fail(`${gate[0]}. ${none}`)
  const { machineId } = await import('./browser.mjs')
  const machine = machineId()
  const test = readOr(path.join(ctx.H, 'test.json'))
  const again = "Run step 1's test, give Brandon its report, stop"
  if (!test || test.pass !== true) return fail(`the short test has not passed on this machine, so there is nothing for a yes to cover. ${none}. ${again}`)
  if (test.machine !== machine) return fail(`the short test has not passed on this machine: its record names another machine (${test.machine}). ${none}. ${again}`)
  if (!mode.small && (test.small || (test.switches && L.anyTestSwitch(test.switches)))) return fail(`the short test has not passed on this machine as a real test: the one recorded here was a run of the tool's own tests. ${none}. ${again}`)
  if ((test.notReady ?? []).length) return fail(`the short test has not passed on this machine in full: its picture passed, and the full render cannot start yet (${test.notReady.join('; ')}). ${none}. Stop and give Brandon the report of the test`)
  if (!test.identity) return fail(`${A.NO_IDENTITY}. ${none}`)
  const doc = await doctor(ctx)
  if (!doc.pass) return fail(`the doctor does not pass on this machine now: ${doc.why}. ${none}`)
  const cal = await keptCalibration(ctx, mode, hash, renderParts(stamp, mode), { draw: false })
  const identity = A.identityOf({ engineHash: hash, stamp, calibration: cal.sha256 ?? '', renderer: doc.renderer, driver: doc.driver ?? '', chrome: doc.page?.browser ?? '' })
  const diff = A.identityDiff(test.identity, identity)
  if (diff.length) return fail(`${A.buildChanged(diff)}. ${none}`)
  // the mixes the test found are the stamp's still: a yes covers a film that can be made
  const gone = soundState(stamp).filter((m) => !m.ok)
  if (gone.length && !mode.small) return fail(`${A.buildChanged(gone.map((m) => `a final mix that the test found is not that mix now (${m.why})`))}. ${none}`)
  // the report of the test and its two previews, by path and sha256
  const reportFile = path.join(ctx.H, 'report-test.txt')
  if (!fs.existsSync(reportFile)) return fail(`the report of the short test is not in this clone any more (${reportFile}), and a yes names it by its sha256. ${none}. ${again}`)
  const report = { path: reportFile, sha256: L.sha256File(reportFile) }
  const T = path.join(ctx.H, 'test')
  const film = previewOf([test.testFilm?.file, path.join(T, L.testFilmName(mode.format.width, mode.format.height))], test.testFilm?.sha256)
  if (!film) return fail(`the test film of the short test is not the file the test made any more, neither where the test left it (${test.testFilm?.file ?? 'no place recorded'}) nor in the clone, and a yes names it by its sha256. ${none}. ${again}`)
  let sheet = { path: 'none was made by this test', sha256: 'none' }
  if (test.sheet) {
    sheet = previewOf([test.sheet.onDesktop, test.sheet.file], test.sheet.sha256)
    if (!sheet) return fail(`the sheet of pictures of the short test is not the file the test made any more, neither where the test left it (${test.sheet.onDesktop ?? test.sheet.file}) nor in the clone, and a yes names it by its sha256. ${none}. ${again}`)
  }
  // what bears on a run of hours, as the machine is now
  const awake = await X.keepAwake(process.pid)
  awake.stop()
  const now = longRunNow(ctx, { doc, test, stamp, mode, awake })
  if (now.free < now.left.total) return fail(`the drive of the clone has ${L.gb(now.free).toFixed(1)} GB free, and what is still to do of the render needs ${L.gb(now.left.total).toFixed(1)} GB at its fullest. ${none}. Make room on that drive, then run the same approve line again`)
  // a line that Brandon cannot have read in the test's report goes to him first: the same line a second time records his yes
  const askedFile = path.join(ctx.H, A.APPROVAL_FILES.asked)
  const asked = readOr(askedFile)
  const covered = [...(test.longRun ?? []), ...(asked?.testTime === test.time ? (asked.lines ?? []) : [])]
  const fresh = A.freshLines(now.lines, covered)
  if (fresh.length) {
    writeJson(askedFile, { testTime: test.time, time: new Date().toISOString(), lines: [...(asked?.testTime === test.time ? (asked.lines ?? []) : []), ...fresh] })
    for (const l of fresh) ctx.say(`LOOK  ${l.text}`)
    return fail(`this is new since the test, and the report Brandon read does not say it: ${fresh.map((l) => l.text).join(' | ')}. ${none}. Give Brandon these lines word for word. If he then writes that the full render may start, copy his words into the same line and run it again: ${A.approveLine('render')}`)
  }
  const longTexts = new Set((test.longRun ?? []).map((l) => l.text))
  const made = A.renderApproval({
    words,
    time: new Date().toISOString(),
    machine,
    identity,
    test: { time: test.time, report, film, sheet },
    projection: test.projection?.seconds > 0 ? { seconds: test.projection.seconds, procs: test.procs ?? 1 } : null,
    disk: { needBytes: now.left.total, freeBytes: now.free },
    longRun: now.lines,
    look: (test.look ?? []).filter((l) => !longTexts.has(l)),
    small: mode.small,
  })
  writeJson(path.join(ctx.H, A.APPROVAL_FILES.render), made.record)
  for (const l of made.lines) ctx.say(l)
  return { pass: true, why: `the full render is approved on this machine, by Brandon's words "${words}", for the build and the test named above. The record is ${short(path.join(ctx.H, A.APPROVAL_FILES.render))}. Next: node tools/handoff.mjs render` }
}

async function approveUpload(ctx, words) {
  const fail = (why) => ({ pass: false, why, refused: true })
  const delivered = readOr(path.join(ctx.H, 'deliver.json'))
  const checked = readOr(path.join(ctx.H, 'check.json'))
  if (!A.deliveryStands(delivered, checked)) return fail(A.uploadApprovalProblems({ approval: null, delivered, repo: null, checked })[0])
  for (const f of delivered.files ?? []) {
    let size = -1
    try {
      size = fs.statSync(f.file).size
    } catch {}
    if (size !== f.bytes) return fail(`${f.file} is not on the Desktop any more as it was delivered, so no yes for the upload is recorded. Run the delivery again: node tools/handoff.mjs deliver`)
  }
  // GitHub is asked now which repository this clone belongs to and whether it is private: his yes names both
  const { uploadGround } = await import('./handoff-upload.mjs')
  const g = await uploadGround(ctx)
  // the same sentences as the upload's own, with the line that is run again named as it is here
  if (g.refuse) return fail(`no yes for the upload is recorded: ${g.refuse.replace(/the upload line/g, 'the approve line')}`)
  const made = A.uploadApproval({
    words,
    time: new Date().toISOString(),
    repo: { owner: g.repo.owner, name: g.repo.repo, slug: g.repo.slug },
    isPrivate: g.isPrivate === true,
    files: delivered.files.map((f) => ({ kind: f.kind, name: path.basename(f.file), bytes: f.bytes, sha256: f.sha256 })),
    deliverTime: delivered.time ?? '',
  })
  writeJson(path.join(ctx.H, A.APPROVAL_FILES.upload), made.record)
  for (const l of made.lines) ctx.say(l)
  return { pass: true, why: `the upload is approved on this machine, by Brandon's words "${words}", for the repository and the files named above. The record is ${short(path.join(ctx.H, A.APPROVAL_FILES.upload))}. Next: node tools/handoff.mjs upload` }
}

/** The first thing the upload asks: whether the delivery passed and Brandon's yes for this upload is recorded here. Empty when it is, else the refusal. */
export function uploadGate(ctx, repo) {
  return A.uploadApprovalProblems({ approval: readOr(path.join(ctx.H, A.APPROVAL_FILES.upload)), delivered: readOr(path.join(ctx.H, 'deliver.json')), repo, checked: readOr(path.join(ctx.H, 'check.json')) })[0] ?? ''
}

// ---------------------------------------------------------------------------------------------------------------------
// Which finished chunks count, and the tool's own ledger of them.

const ledgerFile = (ctx) => path.join(ctx.H, A.APPROVAL_FILES.ledger)
function readLedger(ctx) {
  const l = readOr(ledgerFile(ctx))
  return { drawn: l?.drawn ?? {}, rejected: l?.rejected ?? [] }
}
const chunkKey = (what, c) => `${what}/${L.chunkFile(what, c)}`
const framesFolder = (mode, what, c) => path.join(mode.small ? rel('out', 'work', 'master', 'test', what) : rel('out', 'work', 'master', what), `frames-${String(c.first).padStart(6, '0')}-${String(c.last).padStart(6, '0')}`)

/**
 * Whether a chunk on disk counts for the approved render, and why not. `now()` gives the build of the approved
 * test, the kept calibration picture and the ledger. The bytes of a chunk are read once for as long as the file
 * stays as it is.
 */
function chunkJudge(mode, now) {
  const sums = new Map()
  return (what, c) => {
    const stem = path.join(chunksDir(mode), what, L.chunkFile(what, c))
    if (!fs.existsSync(`${stem}.json`) || !fs.existsSync(`${stem}.mp4`)) return { there: false, why: 'it is not on disk' }
    const st = fs.statSync(`${stem}.mp4`)
    const at = `${stem}|${st.size}|${st.mtimeMs}`
    if (!sums.has(at)) sums.set(at, L.sha256File(`${stem}.mp4`))
    const k = now()
    const key = chunkKey(what, c)
    const record = readOr(`${stem}.json`)
    return { there: true, record, stem, key, why: A.chunkProblem({ what, record, bytesSha: sums.get(at), identity: k.identity, calibration: k.calibration ?? '', drawn: k.ledger.drawn[key] ?? null, rejected: k.ledger.rejected, key }) }
  }
}

/** A chunk that does not count leaves the folder of the chunks for good: its film is deleted, its record is kept, and the ledger names it. */
function rejectChunk(ctx, mode, ledger, what, c, v) {
  const dir = path.join(ctx.H, 'rejected')
  fs.mkdirSync(dir, { recursive: true })
  const name = `${L.chunkFile(what, c)}-${Date.now().toString(36)}.json`
  try {
    if (v.record) writeJson(path.join(dir, name), { ...v.record, rejected: { why: v.why, time: new Date().toISOString() } })
  } catch {}
  // the ledger is written first: whatever happens to the files after this line, this chunk is never taken again
  ledger.rejected.push({ key: v.key, time: v.record?.time ?? '', sha256: v.record?.sha256 ?? '', why: v.why, at: new Date().toISOString(), record: v.record ? short(path.join(dir, name)) : '' })
  delete ledger.drawn[v.key]
  writeJson(ledgerFile(ctx), ledger)
  // then its film, its record and its frames leave the folders of the render. A file that another program holds
  // stays where it is and is still rejected: the render then ends at this chunk, with the reason
  const gone = (f, o = {}) => {
    try {
      fs.rmSync(f, { force: true, ...o })
    } catch {}
  }
  for (const p of v.record?.parts ?? []) gone(path.join(chunksDir(mode), what, p.file))
  for (const ext of ['mp4', 'json', 'jpg']) gone(`${v.stem}.${ext}`)
  gone(framesFolder(mode, what, c), { recursive: true })
}

export async function fullRender(ctx) {
  const stamp = readStamp()
  const cfg = loadCfg()
  const mode = modeOf(ctx, cfg)
  const hash = engineHash()
  const fail = (why, extra = {}) => ({ pass: false, why, ...extra })
  // the gate comes before anything else is read or drawn
  const gate = L.renderRefusals({ stamp, engineHash: hash, doctor: { pass: true }, test: { pass: true, engineHash: hash }, sound: [], small: mode.small })
  if (gate.length) return fail(gate[0], { refused: true })
  const doc = await doctor(ctx)
  const { machineId } = await import('./browser.mjs')
  const test = readOr(path.join(ctx.H, 'test.json'))
  let sound = soundState(stamp)
  const tones = mode.small && ctx.T.tones
  if (tones) sound = []
  else if (mode.small) return fail("a small run of the tool's own tests needs its made up sound", { refused: true })
  const procs = mode.small ? 2 : (test?.procs ?? 1)
  const need = diskNeed(stamp, mode, test?.disk ?? null, procs)
  const parts = renderParts(stamp, mode)
  // the tool's own small run: chunks that a test set aside and could not put back come back first
  backSmallRender(ctx)
  // the calibration picture, before the first look at the chunks: kept, or written again from the chunks' word.
  // Where one must be drawn, that is done further down, after the refusals
  let cal = await keptCalibration(ctx, mode, hash, parts, { draw: false })
  // a chunk on disk counts only for the build the approved test passed on, with the bytes its record names
  const ledger = readLedger(ctx)
  const judge = chunkJudge(mode, () => ({ identity: test?.identity ?? {}, calibration: test?.identity?.calibration ?? '', ledger }))
  const done = (what, c) => judge(what, c).why === ''
  const planNow = L.resumePlan({ parts, chunkFrames: mode.chunk, batchChunks: BATCH_CHUNKS, done })
  // what is drawn, encoded or delivered already needs no room again: the room is asked for the work that remains
  const sameDrive = X.sameDrive(rel(), existingFolder(doc.machine?.desktop ?? rel()))
  const left = A.diskRemaining(need, { ...workDone(ctx, stamp, mode), chunksFinished: sum(planNow.map((p) => p.finished)), sameDrive })
  const refusals = L.renderRefusals({ stamp, engineHash: hash, doctor: doc, test, sound, freeGb: L.gb(X.freeBytes(rel())), needGb: L.gb(left.total), small: mode.small, machine: machineId() })
  if (refusals.length) return fail(`the full render is refused, and nothing was drawn: ${refusals.join('. ')}`, { refused: true, refusals })
  if (!mode.small && test.software) return fail('the short test here was drawn in software, so no full render starts on this machine', { refused: true })
  // the build the test passed on is the build that is here now: the engine, the stamp's references and floors, the
  // kept calibration picture, the card, its driver and Chrome. Else nothing is drawn
  if (!test.identity) return fail(A.NO_IDENTITY, { refused: true })
  const identity = A.identityOf({ engineHash: hash, stamp, calibration: cal.sha256 ?? '', renderer: doc.renderer, driver: doc.driver ?? '', chrome: doc.page?.browser ?? '' })
  const changed = A.identityDiff(test.identity, identity)
  if (changed.length) return fail(A.buildChanged(changed), { refused: true })
  // Brandon's yes for this render: on this machine, for this build, after this test, and covering every line that
  // bears on a run of hours as the machine is now. The stamp's own lock was held above, beside this one
  const awake = await X.keepAwake(process.pid)
  const longRun = longRunNow(ctx, { doc, test, stamp, mode, awake })
  const reportOfTest = path.join(ctx.H, 'report-test.txt')
  const notApproved = A.renderApprovalProblems({ approval: readOr(path.join(ctx.H, A.APPROVAL_FILES.render)), machine: machineId(), identity, test, reportSha: fs.existsSync(reportOfTest) ? L.sha256File(reportOfTest) : '', longRun: longRun.lines, cleanTime: longRun.cleanTime })
  if (notApproved.length) {
    awake.stop()
    return fail(notApproved[0], { refused: true })
  }
  // chunks on disk that do not count leave the folder for good, before the first frame: they are drawn again
  let setAside = 0
  for (const part of parts) {
    for (const c of L.chunkLines(part.first, part.last, mode.chunk)) {
      const v = judge(part.what, c)
      if (!v.there || !v.why) continue
      ctx.say(`the chunk ${L.chunkFile(part.what, c)} on disk is not taken: ${v.why}. Its film is deleted and it is drawn again`)
      rejectChunk(ctx, mode, ledger, part.what, c, v)
      setAside++
    }
  }
  if (setAside) ctx.say(`${setAside} ${setAside === 1 ? 'chunk' : 'chunks'} on disk did not count for this render and ${setAside === 1 ? 'is' : 'are'} drawn again. What the tool rejected is listed in ${short(ledgerFile(ctx))}`)

  const state = readOr(path.join(ctx.H, 'render-state.json'), { sessions: [] })
  const open = state.sessions.filter((s) => !s.end)
  for (const s of open) Object.assign(s, { end: s.last ?? s.start, how: 'stopped before it ended' })
  const session = { start: new Date().toISOString(), last: new Date().toISOString(), framesAtStart: sum(planNow.map((p) => p.framesDone)), browser: test?.browser ?? null }
  state.sessions.push(session)
  const saveState = () => writeJson(path.join(ctx.H, 'render-state.json'), state)
  saveState()
  if (state.sessions.length > 1) ctx.say(`carrying on: this is start ${state.sessions.length} of the render. ${sum(planNow.map((p) => p.framesDone))} frames are finished in chunks on disk and are not drawn again`)
  ctx.say(`awake: ${awake.how}${awake.pid ? ` (process ${awake.pid})` : ''}`)
  state.awake = awake.how
  const end = (result) => {
    Object.assign(session, { end: new Date().toISOString(), how: result.pass ? 'finished' : `stopped: ${String(result.why).split('\n')[0].slice(0, 200)}` })
    saveState()
    awake.stop()
    return result
  }

  // progress, for the heartbeat
  const total = sum(parts.map((p) => p.last - p.first + 1))
  const counts = { 'film-b': L.countsOf(stamp.samples?.['film-b']), loop: L.countsOf(stamp.samples?.loop) }
  const cost = test?.cost?.perSample > 0 ? test.cost : null
  const gain = procs === 2 ? Math.max(1, test?.gainMeasured ?? 1) : 1
  const drawn = { session: 0, t0: Date.now() }
  let inBatch = 0
  let phase = 'starting'
  const framesDone = () => sum(L.resumePlan({ parts, chunkFrames: mode.chunk, batchChunks: BATCH_CHUNKS, done }).map((p) => p.framesDone))
  let base = framesDone()
  const beat = () => {
    const doneNow = Math.min(total, base + inBatch)
    const pace = drawn.session > 0 ? (Date.now() - drawn.t0) / 1000 / drawn.session : 0
    let left = (total - doneNow) * pace
    if (cost && !mode.small) {
      const plan = L.resumePlan({ parts, chunkFrames: mode.chunk, batchChunks: BATCH_CHUNKS, done })
      left = 0
      for (const p of plan) {
        const list = counts[p.what]
        const share2 = 1 - p.framesDone / p.frames
        if (list?.length) left += ((sum(list.map((n) => cost.each + cost.perSample * n)) + (cost.chunkStart ?? 0) * p.chunks) * share2) / gain
        else left += p.frames * share2 * (test.projection ? test.projection.encodeSeconds / (stamp.frames['film-a'] + stamp.frames['film-b'] + stamp.frames.loop + stamp.frames.opening) : 0.5)
      }
      left = Math.max(0, left - inBatch * pace) + (test.projection?.encodeSeconds ?? 0)
    }
    return { line: L.heartbeatLine({ done: doneNow, total, secondsAFrame: pace, leftSeconds: left, phase }), done: doneNow, left: total - doneNow, pace, leftSeconds: left }
  }
  ctx.heartbeat = () => {
    const b2 = beat()
    session.last = new Date().toISOString()
    saveState()
    return { phase, framesDone: b2.done, framesLeft: b2.left, secondsAFrame: round(b2.pace, 3), expectedEnd: b2.leftSeconds > 0 ? new Date(Date.now() + b2.leftSeconds * 1000).toISOString() : null, line: b2.line }
  }
  ctx.heartbeatLine = () => beat().line

  if (!cal.sha256) {
    cal = await keptCalibration(ctx, mode, hash, parts)
    if (!cal.ok) return end(fail(cal.why))
    // a calibration picture drawn now must be the one the test saw: every chunk names it
    if (test.identity.calibration && cal.sha256 !== test.identity.calibration) return end(fail(A.buildChanged([`the calibration picture kept on this machine is now ${cal.sha256}, and the test passed on ${test.identity.calibration}`])))
  }
  const expected = { renderer: test.identity.renderer, browser: test.identity.chrome, driver: test.identity.driver }
  // the tool's own test of a browser that updated itself: see browserMovedPretend
  const movedFile = path.join(ctx.H, 'browser-moved.json')
  const moved = L.browserMovedPretend({ on: ctx.T.browserMoved === true, seen: readOr(movedFile)?.seen ?? null, testTime: test?.time, framesDone: session.framesAtStart })
  if (moved.mark) writeJson(movedFile, { seen: new Date().toISOString() })
  if (moved.pretend) expected.browser = `${expected.browser} ${L.MADE_UP_UPDATE}`
  // the driver of the card that draws, as it is read at this moment
  const driverNow = () => {
    const m = X.readMachine()
    return A.driverText({ platform: process.platform, os: m.os, cards: m.cards, wanted: L.wantedCard(m.cards) }).text
  }
  // Before the first frame of every batch of every part: the room on the disk, and the card, its driver and the
  // browser as they are read now, held against the build the approved test passed on
  let read = null
  const guard = async () => {
    const free = X.freeBytes(rel())
    const floor = need.spare + need.inFlight
    if (free < floor) return `only ${L.gb(free).toFixed(1)} GB of disk is free and the next chunks need ${L.gb(floor).toFixed(1)} GB. Nothing drawn is lost: make room and run the same line again`
    let driver
    try {
      driver = driverNow()
    } catch (e) {
      return `the card and its driver could not be read before the next chunks: ${String(e.message).split('\n')[0]}. Nothing drawn is lost`
    }
    if (driver !== expected.driver) return `${A.buildChanged([`the card's driver is now ${driver}, and the test passed on ${expected.driver}`])}. Nothing was drawn by the other driver`
    let seen
    try {
      seen = await readRenderer(mode)
    } catch (e) {
      return `Chrome could not be opened before the next chunks: ${String(e.message).split('\n')[0]}`
    }
    const v = L.drawVerdict({ renderer: seen.renderer, cards: doc.machine.cards, allowSoftware: ctx.T.software })
    if (!v.ok) return `before the next chunks ${v.why}. Nothing drawn is lost`
    if (seen.renderer !== expected.renderer) return `before the next chunks the page draws on "${seen.renderer}", and the short test passed on "${expected.renderer}". Nothing drawn is lost`
    if (seen.browser !== expected.browser) return `Chrome is now version ${seen.browser}, and the short test passed on ${expected.browser}: the browser was updated. Nothing drawn is lost, and no chunk is drawn by another browser than the one that was tested`
    read = { driver, chrome: seen.browser, renderer: seen.renderer, time: new Date().toISOString() }
    return ''
  }
  // the room the encodes and the films still need, asked before each encode
  const encodeGuard = () => {
    const free = X.freeBytes(rel())
    const now = A.diskRemaining(need, { ...workDone(ctx, stamp, mode), chunksFinished: Infinity, sameDrive: false })
    const floor = now.finals + now.encodeRoom + need.spare
    return free < floor ? `only ${L.gb(free).toFixed(1)} GB of disk is free and the films still to encode need ${L.gb(floor).toFixed(1)} GB. Nothing drawn is lost: make room and run the same line again` : ''
  }

  const packDir = mode.small ? await smallPack(ctx, mode) : PACK_DIR
  for (const part of parts) {
    const plan = L.resumePlan({ parts: [part], chunkFrames: mode.chunk, batchChunks: BATCH_CHUNKS, done })[0]
    ctx.say(`${part.what}: ${plan.finished} of ${plan.chunks} chunks are finished, ${plan.batches.length} ${plan.batches.length === 1 ? 'batch' : 'batches'} to draw`)
    for (const b2 of plan.batches) {
      phase = `${part.what} frames ${b2.first} to ${b2.last}`
      const engine = part.what !== 'opening'
      const stop = await guard()
      if (stop) return end(fail(stop))
      const batch = L.chunkLines(b2.first, b2.last, mode.chunk)
      if (engine) {
        // the ledger says what was read before the first frame of each chunk. Frames that lie in work from an
        // earlier start under another reading, or under none, are deleted: a chunk is drawn whole by one build
        for (const c of batch) {
          if (done(part.what, c)) continue
          const key = chunkKey(part.what, c)
          const had = ledger.drawn[key]
          const frames = framesFolder(mode, part.what, c)
          if (fs.existsSync(frames) && (!had || had.driver !== read.driver || had.chrome !== read.chrome || had.renderer !== read.renderer)) {
            fs.rmSync(frames, { recursive: true, force: true })
            ctx.say(`the frames in work of ${L.chunkFile(part.what, c)} were drawn ${had ? 'under another card, driver or browser' : 'before the tool recorded what drew them'}: they are deleted and the chunk is drawn whole`)
          }
          ledger.drawn[key] = { ...read }
        }
        writeJson(ledgerFile(ctx), ledger)
      }
      base = framesDone()
      inBatch = 0
      const args = ['--what', part.what, '--first', String(b2.first), '--last', String(b2.last), ...(engine ? [...mode.draw, ...(procs > 1 ? ['--procs', String(procs)] : [])] : [...(mode.small ? ['--format', mode.format.id, '--chunk', '6'] : []), '--pack', packDir])]
      const r = await runTool(ctx, 'master.mjs', args, (l) => {
        if (/ · frame \d+ · /.test(l)) {
          inBatch++
          drawn.session++
        }
        const m = /^(?:\[\d+\] )?finished (\S+):/.exec(l)
        if (m) ctx.note(`finished ${m[1]}`)
      })
      if (r.code !== 0) return end(fail(`the render stopped at ${part.what} frames ${b2.first} to ${b2.last}: ${whyOf(r)}\nNothing drawn is lost: the same line carries on from the last finished frame`))
      // a driver that changed while the batch was drawn: no chunk of the batch is taken
      let driverAfter = expected.driver
      if (engine) {
        try {
          driverAfter = driverNow()
        } catch {
          driverAfter = 'not read'
        }
      }
      // every chunk of the batch says what drew it, and counts only as the approved test's build with its own bytes
      let bad = ''
      for (const c of batch) {
        const v = judge(part.what, c)
        if (!v.there || !v.record) return end(fail(`the chunk ${L.chunkFile(part.what, c)} left no record`))
        let why = v.why
        if (!why && engine && L.softwareName(v.record.graphics) && !ctx.T.software) why = `it was drawn in software ("${v.record.graphics}")`
        if (!why && engine && driverAfter !== expected.driver) why = `the card's driver was ${driverAfter} after its batch, and the test passed on ${expected.driver}`
        if (!why) continue
        ctx.say(`the chunk ${L.chunkFile(part.what, c)} that was just drawn is not taken: ${why}. Its film is deleted`)
        rejectChunk(ctx, mode, ledger, part.what, c, { ...v, why })
        bad ||= `the chunk ${L.chunkFile(part.what, c)} that was just drawn is not taken: ${why}`
      }
      if (bad) return end(fail(`${bad}. It is not taken a second time, and what the tool rejected is listed in ${short(ledgerFile(ctx))}. Stop and report`))
      inBatch = 0
      base = framesDone()
      ctx.say(beat().line)
    }
  }

  // every chunk is here: the three encodes, unchanged, and the screenshot
  phase = 'checking the chunks'
  if (!mode.small) {
    const col = await runTool(ctx, 'master.mjs', ['--collect', path.join(ctx.H, 'collect'), '--no-branches'])
    if (col.code !== 0) return end(fail(`the chunks are drawn and their check before the encode fails: ${whyOf(col)}\n${lastLines(col, 8)}`))
  }
  const files = finalFiles(mode)
  const tonesDir = path.join(ctx.H, 'tones')
  for (const which of ['film-b', 'film-a', 'loop']) {
    phase = `encoding ${which}`
    const rec = readOr(`${files[which]}.json`)
    const current = (rec?.chunks ?? []).every((c) => readOr(path.join(chunksDir(mode), c.what, `${L.chunkFile(c.what, c)}.json`))?.sha256 === c.sha256)
    if (proven(rec, mode) && current && rec.chunks?.length && fs.existsSync(files[which]) && fs.statSync(files[which]).size === rec.bytes) {
      ctx.say(`${which} is encoded and proven already (${mb(rec.bytes)})`)
      continue
    }
    const noRoom = encodeGuard()
    if (noRoom) return end(fail(noRoom))
    ctx.say(`encoding ${which}`)
    let extra = []
    if (mode.small) {
      extra = ['--test', '--gaps', '--target-mb', '2', '--chunk', String(mode.chunk)]
      if (which !== 'loop') {
        const tone = path.join(tonesDir, `${which}.wav`)
        if (!fs.existsSync(tone) && !(await makeSound(ctx, tone, 'tone', 2))) return end(fail('a made up sound could not be written'))
        extra.push('--sound', tone)
      }
    }
    const r = await runTool(ctx, 'master.mjs', ['--encode', which, ...extra])
    let after = readOr(`${files[which]}.json`)
    let noted = null
    if (r.code !== 0 || after?.passed !== true) {
      noted = draftAccept(which, mode)
      if (!noted) return end(fail(`${which} could not be encoded and proven: ${whyOf(r)}\n${lastLines(r, 10)}`))
      after = readOr(`${files[which]}.json`)
    }
    ctx.say(`${which}: ${after.frames} frames, ${mb(after.bytes)}, ${noted ? `taken as a small draft of the tool's own tests, with these rows of the encoder's proof noted and not held: ${noted.join(', ')}` : 'proven'}`)
  }
  if (!fs.existsSync(files.still)) return end(fail(`the screenshot ${short(files.still)} was not written by the encode of the loop`))
  phase = 'finished'
  return end({ pass: true, why: `the two films, the loop and the screenshot are made in ${short(finalsDir(mode))}. Next: node tools/handoff.mjs check` })
}

/** The hours the render took, its starts and its stops, from the state the render keeps. */
export function renderHistory(H) {
  const state = readOr(path.join(H, 'render-state.json'), { sessions: [] })
  const seconds = sum(state.sessions.map((s) => Math.max(0, (Date.parse(s.end ?? s.last ?? s.start) - Date.parse(s.start)) / 1000)))
  return { starts: state.sessions.length, stops: state.sessions.filter((s) => s.how && s.how !== 'finished').length, seconds, sessions: state.sessions, awake: state.awake ?? '' }
}

// ---------------------------------------------------------------------------------------------------------------------
// Check, deliver, clean.

/** A program run to its end without holding up this process: its output as bytes, what it wrote as errors, its code. */
function runBytes(file, args) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    } catch (e) {
      return resolve({ code: -1, out: Buffer.alloc(0), err: e.message })
    }
    const out = []
    let err = ''
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => (err = (err + d).slice(-4000)))
    child.on('error', (e) => resolve({ code: -1, out: Buffer.concat(out), err: e.message }))
    child.on('close', (code) => resolve({ code, out: Buffer.concat(out), err }))
  })
}

async function decodeWhole(file, screenshot = null) {
  if (screenshot) return decodeScreenshot(file, screenshot)
  const r = await runBytes('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-i', file, '-f', 'null', '-'])
  const said = r.err.trim()
  return { ok: r.code === 0 && !said, said: said.split(/\r?\n/).slice(0, 3).join(' / ') }
}

/** The steps of a loop from frame to frame and across its seam, on small grey pictures: mean absolute difference in levels of 255. */
async function seamSteps(file) {
  const w = 320
  const h = 180
  const r = await runBytes('ffmpeg', ['-v', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'])
  if (r.code !== 0) return null
  const n = Math.floor(r.out.length / (w * h))
  if (n < 3) return null
  const step = (a, b) => {
    let s = 0
    const A = a * w * h
    const B = b * w * h
    for (let i = 0; i < w * h; i++) s += Math.abs(r.out[A + i] - r.out[B + i])
    return s / (w * h)
  }
  const steps = []
  for (let i = 1; i < n; i++) steps.push(step(i - 1, i))
  const sorted = [...steps].sort((a, b) => a - b)
  return { frames: n, seam: step(n - 1, 0), median: sorted[Math.floor(sorted.length / 2)], most: sorted[sorted.length - 1], beside: L.besideSeam(steps) }
}

export async function check(ctx, { stamp = readStamp(), plan = readOr(PLAN_FILE) } = {}) {
  const png = stamp?.screenshot
  if (!validScreenshotSpec(png, stamp?.format) || !validScreenshotSpec(plan?.screenshot, stamp?.format) ||
      Object.entries(plan.screenshot).some(([key, value]) => png[key] !== value)) {
    return { pass: false, why: 'the stamp is older than the plan and must be made again by the remote team' }
  }
  const { cfg } = await import('./page.mjs')
  const { probeStreams, probe } = await import('./encode.mjs')
  X.readTools()
  const mode = modeOf(ctx, cfg)
  const files = finalFiles(mode)
  const rows = []
  const row = (check2, found, wanted, pass) => rows.push({ check: check2, found, wanted, pass })
  const V = cfg.deliver.master.video
  const out = { pass: false, why: '', rows, small: mode.small, files: {}, time: new Date().toISOString() }
  const records = {}
  for (const which of ['film-a', 'film-b', 'loop']) {
    const file = files[which]
    const label = L.deliveryName(which, mode.format.width, mode.format.height)
    if (!fs.existsSync(file)) {
      row(`${which}: the file`, 'not there', short(file), false)
      continue
    }
    const rec = readOr(`${file}.json`)
    records[which] = rec
    const sha = L.sha256File(file)
    out.files[which] = { file, name: label, bytes: fs.statSync(file).size, sha256: sha }
    row(`${which}: its record`, proven(rec, mode) && rec.sha256 === sha ? (rec.draftNoted ? `a small draft of the tool's own tests, these rows noted and not held: ${rec.draftNoted.join(', ')}` : 'proven by the encode, and the file is the one its record names') : 'no proven record of this file', "the encode's proof, of this very file", proven(rec, mode) && rec.sha256 === sha)
    const s = probeStreams(file)
    const v = s.video[0] ?? {}
    const a = s.audio[0] ?? null
    const counted = probe(file).frames
    const wantFrames = mode.small ? (rec?.frames ?? 0) : stamp.frames[which]
    row(`${which}: codec, profile, level`, `${v.codec_name}, ${v.profile}, ${v.level}`, `h264, ${V.profile}, ${Math.round(Number(V.level) * 10)}`, v.codec_name === 'h264' && String(v.profile).toLowerCase() === V.profile && Number(v.level) === Math.round(Number(V.level) * 10))
    row(`${which}: pixel format`, `${v.pix_fmt}`, V.pixFmt, v.pix_fmt === V.pixFmt)
    row(`${which}: size`, `${v.width} x ${v.height}`, `${mode.format.width} x ${mode.format.height}`, v.width === mode.format.width && v.height === mode.format.height)
    row(`${which}: rate`, `${v.r_frame_rate} (mean ${v.avg_frame_rate})`, `${mode.fps}/1`, v.r_frame_rate === `${mode.fps}/1` && v.avg_frame_rate === `${mode.fps}/1`)
    row(`${which}: frames`, `${counted} decoded and counted, ${v.nb_frames} in the container`, `exactly ${wantFrames}`, counted === wantFrames && Number(v.nb_frames) === wantFrames)
    const seconds = wantFrames / mode.fps
    if (which === 'loop') row('loop: sound', a ? `${a.codec_name}` : 'none', 'none', !a)
    else row(`${which}: sound`, a ? `${a.codec_name}, ${a.sample_rate} Hz, ${a.channels} channels, ${Number(a.duration).toFixed(3)} s` : 'none', `aac, as long as the picture (${seconds.toFixed(3)} s)`, !!a && a.codec_name === 'aac' && Math.abs(Number(a.duration) - seconds) < 0.05)
    const dec = await decodeWhole(file)
    row(`${which}: whole decode`, dec.ok ? 'every frame and the sound decode, no error' : `the decoder wrote: ${dec.said || 'an error'}`, 'no error', dec.ok)
    // the films are encoded to a size; the loop to a quality, and it must still be a file that travels (under 2 GB)
    row(`${which}: size on disk`, mb(out.files[which].bytes), which === 'loop' ? 'under 2,000 MB' : `at most ${cfg.deliver.master.final.targetMb[which]} MB`, which === 'loop' ? out.files[which].bytes < 2e9 : mode.small ? null : out.files[which].bytes <= cfg.deliver.master.final.targetMb[which] * 1e6)
    if (!mode.small && which !== 'loop') {
      const mix = rel('audio', 'final', `${which}.wav`)
      row(`${which}: its mix`, rec?.sound?.sha256 === stamp.sound[which] ? `the final mix the stamp names (${stamp.sound[which].slice(0, 12)})` : `sha256 ${String(rec?.sound?.sha256).slice(0, 12)}`, `sha256 ${stamp.sound[which].slice(0, 12)}`, rec?.sound?.sha256 === stamp.sound[which] && fs.existsSync(mix))
    }
    if (which === 'loop') {
      const seam = await seamSteps(file)
      if (!seam) row('loop: the seam', 'could not be measured', 'the step from the last frame back to the first', false)
      else row('loop: the seam', `the step from the last frame to the first is ${seam.seam.toFixed(3)} levels; the largest of the ${L.SEAM.beside} steps on each side of it is ${seam.beside.toFixed(3)}; inside the loop the median step is ${seam.median.toFixed(3)} and the largest ${seam.most.toFixed(3)}`, mode.small ? 'noted only: a dozen frames of the loop do not close a loop' : L.SEAM.wanted, mode.small ? null : L.seamOk(seam))
    }
  }
  // the screenshot is the loop's frame 0, the very PNG its chunk names
  const still = files.still
  const loopFirst = readOr(path.join(chunksDir(mode), 'loop', `${L.chunkFile('loop', { first: 0, last: mode.chunk - 1 })}.json`))
  if (!fs.existsSync(still)) row('screenshot: the file', 'not there', short(still), false)
  else {
    const sha = L.sha256File(still)
    out.files.still = { file: still, name: L.deliveryName('still', mode.format.width, mode.format.height), bytes: fs.statSync(still).size, sha256: sha }
    const expected = mode.small ? { ...png, width: mode.format.width, height: mode.format.height } : png
    const decoded = await decodeWhole(still, expected)
    row('screenshot: whole decode, size and bit depth', decoded.said, `STATED: ${expected.width} x ${expected.height}, ${expected.bitDepth}-bit PNG with every pixel decoded`, decoded.ok && expected.width === mode.format.width && expected.height === mode.format.height)
    row('screenshot: is frame 0 of the loop', sha === loopFirst?.still?.sha256 ? `the PNG the loop's first chunk names (${sha.slice(0, 12)})` : `sha256 ${sha.slice(0, 12)}, the chunk names ${String(loopFirst?.still?.sha256).slice(0, 12)}`, "the very PNG of the loop's frame 0", sha === loopFirst?.still?.sha256)
    const comparison = decoded.ok ? await compareLoopScreenshot({ file: files.loop, png: still, fps: mode.fps, pixFmt: V.pixFmt, floorDb: mode.small ? null : png.floorDb }) : null
    if (comparison) rows.push(comparison)
  }
  // film B inside film A is made of the same chunks as film B itself
  const ofA = (records['film-a']?.chunks ?? []).filter((c) => c.what === 'film-b').map((c) => c.sha256)
  const ofB = (records['film-b']?.chunks ?? []).map((c) => c.sha256)
  const onDisk = (records['film-b']?.chunks ?? []).map((c) => {
    const f = path.join(chunksDir(mode), 'film-b', `${L.chunkFile('film-b', c)}.mp4`)
    return fs.existsSync(f) ? L.sha256File(f) : ''
  })
  const sameChunks = ofA.length > 0 && ofA.length === ofB.length && ofA.every((x, i) => x === ofB[i])
  row('film B inside film A', sameChunks ? `the same ${ofB.length} chunks, by sha256, in the same order` : `film A names ${ofA.length} chunks of film B, film B names ${ofB.length}, and they differ`, 'the same source chunks in both films', sameChunks)
  row('the chunks on disk', `${onDisk.filter((x, i) => x === ofB[i]).length} of ${ofB.length} are the files both films were made from`, 'every one', ofB.length > 0 && onDisk.every((x, i) => x === ofB[i]))
  const openingFrames = sum((records['film-a']?.chunks ?? []).filter((c) => c.what === 'opening').map((c) => c.last - c.first + 1))
  row('the opening inside film A', `${openingFrames} frames from the pack`, mode.small ? 'noted' : `${stamp.frames.opening}`, mode.small ? null : openingFrames === stamp.frames.opening)
  out.pass = rows.every((r) => r.pass !== false)
  out.why = out.pass ? `the two films, the loop and the screenshot pass every check (${rows.filter((r) => r.pass === true).length} checks). Next: node tools/handoff.mjs deliver` : `${rows.filter((r) => r.pass === false).length} of the checks fail: ${rows.filter((r) => r.pass === false).map((r) => `${r.check} is ${r.found}`).slice(0, 4).join('; ')}`
  return out
}

export async function deliver(ctx, reportText) {
  const cfg = loadCfg()
  const mode = modeOf(ctx, cfg)
  const checked = readOr(path.join(ctx.H, 'check.json'))
  if (!checked?.pass) return { pass: false, why: 'the check has not passed here, so nothing is delivered. Run: node tools/handoff.mjs check' }
  if (checked.small !== mode.small) return { pass: false, why: 'the check that passed was of another kind of run than this one. Run: node tools/handoff.mjs check' }
  const machine = X.readMachine()
  const folder = path.join(machine.desktop, L.deliveryFolder(mode.small))
  const report = path.join(folder, `${L.TITLE} - Render Report.txt`)
  const targets = L.KINDS.map((kind) => ({ kind, from: checked.files[kind], to: path.join(folder, L.deliveryName(kind, mode.format.width, mode.format.height)) }))
  const other = unexpectedEntries(folder, [...targets.map(({ to }) => path.basename(to)), path.basename(report)])
  const leave = (names) => ({ pass: false, refused: true, why: `left the Desktop folder alone at ${folder}. It contains other or changed files: ${names.join(', ')}` })
  if (other.length) return leave(other)
  const previous = readOr(path.join(ctx.H, 'deliver.json'))
  const exists = (file) => !!fs.lstatSync(file, { throwIfNoEntry: false })
  const priorReport = exists(report)
  if (priorReport && (previous?.report !== report || !fileMatches(report, previous?.reportSha256))) return leave([path.basename(report)])
  for (const { kind, from, to } of targets) {
    if (!from || !fileMatches(from.file, from.sha256, from.bytes)) return { pass: false, why: `${kind} is not the file that was checked any more (${from ? short(from.file) : 'not named'}). Run the check again` }
    if (exists(to) && !fileMatches(to, from.sha256, from.bytes)) return leave([path.basename(to)])
  }
  fs.mkdirSync(folder, { recursive: true })
  const rows = []
  const files = []
  for (const { kind, from: f, to } of targets) {
    try {
      if (!exists(to)) {
        ctx.say(`copying ${path.basename(to)} (MEASURED: ${mb(f.bytes)})`)
        fs.copyFileSync(f.file, to, fs.constants.COPYFILE_EXCL)
      }
    } catch (e) {
      if (e.code === 'EEXIST') return leave([path.basename(to)])
      if (L.heldOpen(e)) return { pass: false, why: L.heldSentence(path.basename(to)) }
      throw e
    }
    const same = fileMatches(to, f.sha256, f.bytes)
    rows.push({ check: path.basename(to), found: same ? `MEASURED: ${mb(f.bytes)}, sha256 ${f.sha256}` : 'not the checked file', wanted: 'the checked file, byte for byte', pass: same })
    files.push({ kind, file: to, bytes: f.bytes, sha256: f.sha256 })
  }
  const pass = rows.every((r) => r.pass)
  if (!pass) return { pass, why: 'a copy on the Desktop is not the file that was checked', rows, folder, files, small: mode.small }
  const more = unexpectedEntries(folder, [...targets.map(({ to }) => path.basename(to)), ...(priorReport ? [path.basename(report)] : [])])
  if (more.length) return leave(more)
  let reportSha256
  try {
    if (priorReport) {
      reportSha256 = previous.reportSha256
      if (!fileMatches(report, reportSha256)) return leave([path.basename(report)])
    } else {
      const body = reportText({ machine, mode, checked, files, rows, folder })
      fs.writeFileSync(report, body, { flag: 'wx' })
      reportSha256 = crypto.createHash('sha256').update(body).digest('hex')
      if (!fileMatches(report, reportSha256)) return leave([path.basename(report)])
    }
  } catch (e) {
    if (e.code === 'EEXIST') return leave([path.basename(report)])
    if (L.heldOpen(e)) return { pass: false, why: L.heldSentence(path.basename(report)) }
    throw e
  }
  return { pass, why: `the four files and the report are in ${folder}. Next, only if Brandon says yes to sending them to the remote team: node tools/handoff.mjs upload. Then: node tools/handoff.mjs clean`, rows, folder, files, report, reportSha256, small: mode.small }
}

/** @param {((ctx: any, mode: any) => {file: string, entries: number, bytes: number}) | null} recordsZip */
export function clean(ctx, recordsZip = null) {
  const delivered = readOr(path.join(ctx.H, 'deliver.json'))
  if (!delivered?.pass) return { pass: false, why: 'nothing is deleted before the delivery has passed. Run: node tools/handoff.mjs deliver' }
  const files = Array.isArray(delivered.files) ? delivered.files : []
  const bad = L.KINDS.find((kind) => files.filter((f) => f?.kind === kind).length !== 1)
  if (bad || files.length !== L.KINDS.length) return { pass: false, why: 'the last delivery does not name all the checked files, so the work files stay. Run the delivery again' }
  for (const f of files) if (!fileMatches(f.file, f.sha256, f.bytes)) return { pass: false, why: `${f.file} does not match the last delivery by SHA-256, so the work files stay. Run the delivery again` }
  if (delivered.report && !fileMatches(delivered.report, delivered.reportSha256)) return { pass: false, why: `${delivered.report} does not match the last delivery by SHA-256, so the work files stay. Run the delivery again` }
  const dirs = [['master'], ['deliver'], ['work']].map((parts) => rel('out', ...parts))
  const inWork = (file) => dirs.some((dir) => {
    const part = path.relative(dir, fs.realpathSync(file))
    return !path.isAbsolute(part) && part !== '..' && !part.startsWith(`..${path.sep}`)
  })
  if (files.some((f) => inWork(f.file))) return { pass: false, why: 'the Desktop copies are inside the render work folders, so the work files stay' }
  // the records of the render are kept as one zip before anything goes, so that an upload after this still has them
  let kept = ''
  if (recordsZip && fs.existsSync(path.join(ctx.H, 'render-state.json'))) {
    try {
      const z = recordsZip(ctx, modeOf(ctx, loadCfg()))
      kept = `${short(z.file)} (${z.entries} files, ${mb(z.bytes)})`
    } catch (e) {
      return { pass: false, why: `the records of the render could not be kept as a zip (${e.message}), so the work files stay` }
    }
  }
  const before = X.freeBytes(rel())
  const gone = []
  const drop = (p) => {
    if (!fs.existsSync(p)) return
    fs.rmSync(p, { recursive: true, force: true })
    gone.push(short(p))
  }
  drop(rel('out', 'master'))
  drop(rel('out', 'deliver'))
  let names = []
  try {
    names = fs.readdirSync(rel('out', 'work'))
  } catch {}
  for (const n of names) if (n !== 'handoff') drop(rel('out', 'work', n))
  // the reports stay, and so does what the doctor, the short test and the delivery found; the state of the render goes
  const keep = (n) => /^report-.*\.txt$/.test(n) || ['doctor.json', 'test.json', 'check.json', 'deliver.json', 'upload.json', 'upload-release.json', 'upload', 'job.json', 'job-seen.json', BUNDLE_RECORDS].includes(n)
  for (const n of fs.readdirSync(ctx.H)) if (!keep(n)) drop(path.join(ctx.H, n))
  const after = X.freeBytes(rel())
  return { pass: true, why: `the work files are deleted and ${L.gb(Math.max(0, after - before)).toFixed(1)} GB of disk is regained (${L.gb(after).toFixed(1)} GB free now). The delivered files on the Desktop, the reports${kept ? `, the records of the render as one zip (${kept})` : ''} and the clone itself stay`, gone, regainedBytes: Math.max(0, after - before), rows: gone.map((g) => ({ check: g, found: 'deleted', wanted: 'a work folder of the render, which git does not track', pass: true })) }
}

export { short, mb, round, sum, readOr, loadCfg, rgbOfFile }
