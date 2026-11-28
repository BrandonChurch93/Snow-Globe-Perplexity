// The parts of the render handoff that need no browser and no machine: names, refusals, plans and measures.
// tools/handoff.mjs is the command, tools/lib/handoff-machine.mjs reads the machine, RENDER-ON-YOUR-PC.md is the file an agent follows.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const TITLE = 'Snow Globe Seasons'
export const STAMP_VERSION = 1
export const KINDS = ['film-a', 'film-b', 'loop', 'still']
const LABEL = { 'film-a': 'With Prompt', 'film-b': 'Without Prompt', loop: 'Portfolio Looping Video', still: 'Portfolio Screenshot' }
const EXT = { 'film-a': 'mp4', 'film-b': 'mp4', loop: 'mp4', still: 'png' }

/** The name a delivered file has on the Desktop. */
export const deliveryName = (kind, width, height) => {
  if (!LABEL[kind]) throw new Error(`there is no delivered file called ${kind}`)
  return `${TITLE} - ${LABEL[kind]} - ${width}x${height}.${EXT[kind]}`
}
export const deliveryNames = (width, height) => Object.fromEntries(KINDS.map((k) => [k, deliveryName(k, width, height)]))
export const testFilmName = (width, height) => `${TITLE} - Test - ${width}x${height}.mp4`
/** The folder on the Desktop. A run of the tool's own tests gets another folder, so that it never passes for the film. */
export const deliveryFolder = (small = false) => (small ? `${TITLE} (tool test)` : TITLE)

// ---------------------------------------------------------------------------------------------------------------------
// The switches of the tool's own tests. They come in one variable of the environment that RENDER-ON-YOUR-PC.md never
// names, so that no line an agent is given can turn one on.
export const TEST_VARIABLE = 'HANDOFF_TEST'
const TEST_WORDS = ['software', 'small', 'tones', 'linux', 'inline', 'fast-watch']
export function testSwitches(text = '') {
  const out = { software: false, small: false, tones: false, linux: false, inline: false, fastWatch: false, angle: '', refs: '', stretch: '', stop: 0 }
  for (const word of String(text).split(',').map((w) => w.trim()).filter(Boolean)) {
    const [key, value = ''] = word.split('=')
    if (key === 'angle' && /^[a-z0-9]+$/.test(value)) out.angle = value
    else if (key === 'refs' && value) out.refs = value
    else if (key === 'stretch' && /^\d+-\d+(\/\d+)?$/.test(value)) out.stretch = value
    else if (key === 'fast-watch') out.fastWatch = true
    else if (TEST_WORDS.includes(key) && !value) out[key] = true
    else throw new Error(`${TEST_VARIABLE} holds ${word}, which is no switch of the tool's tests`)
  }
  return out
}
export const anyTestSwitch = (t) => t.software || t.small || t.tones || t.linux || !!t.angle || !!t.refs || !!t.stretch

// ---------------------------------------------------------------------------------------------------------------------
// What draws.

/** render-local's list (swiftshader, llvmpipe, software, basic render) and the names it did not know. */
export const SOFTWARE_NAMES = ['swiftshader', 'llvmpipe', 'lavapipe', 'softpipe', 'software', 'basic render', 'warp', 'gdi generic', 'mesa offscreen']
/** The software renderer a WebGL renderer string names, or '' when it names none. */
export function softwareName(renderer) {
  const text = String(renderer ?? '').toLowerCase()
  return SOFTWARE_NAMES.find((n) => (n === 'warp' ? /\bwarp\b/.test(text) : text.includes(n))) ?? ''
}

export function vendorOf(name) {
  const t = String(name ?? '').toLowerCase()
  if (/nvidia|geforce|quadro|\brtx\b|\bgtx\b/.test(t)) return 'NVIDIA'
  if (/\bamd\b|radeon|\bati\b/.test(t)) return 'AMD'
  if (/apple/.test(t)) return 'Apple'
  if (/intel/.test(t)) return 'Intel'
  return ''
}

const RANK = ['NVIDIA', 'AMD', 'Apple']
/** The card the film must be drawn on: an NVIDIA card before an AMD one before an Apple one, or null when the machine has none of them. */
export function wantedCard(cards) {
  for (const vendor of RANK) {
    const card = (cards ?? []).find((c) => vendorOf(c.name) === vendor)
    if (card) return { vendor, name: card.name }
  }
  return null
}

/**
 * Whether the page draws on the right thing. `renderer` is WebGL's unmasked renderer string, `cards` the video cards the
 * system names. Software is refused by name, and so is a card other than the one the machine has for the work.
 */
export function drawVerdict({ renderer, cards, allowSoftware = false }) {
  if (!renderer || /^no webgl/i.test(renderer)) return { ok: false, software: false, why: 'the page got no WebGL at all, so nothing can be drawn' }
  const soft = softwareName(renderer)
  if (soft) {
    if (allowSoftware) return { ok: true, software: true, why: `the page draws in software (${soft}), let through by a switch of the tool's tests. No film is made this way` }
    return { ok: false, software: true, why: `the page draws in software ("${renderer}" names ${soft}), not on a graphics card. A film drawn this way would take weeks and is refused` }
  }
  const want = wantedCard(cards)
  if (!want) return { ok: true, software: false, why: 'the page draws on hardware, and the system names no NVIDIA, AMD or Apple card to hold it to' }
  const got = vendorOf(renderer)
  if (got === want.vendor) return { ok: true, software: false, why: `the page draws on the ${want.vendor} card` }
  return { ok: false, software: false, why: `the page draws on "${renderer}" and this machine has ${want.name}. The film must be drawn on the ${want.vendor} card` }
}

// ---------------------------------------------------------------------------------------------------------------------
// Versions.

/**
 * The seam of the loop: the step from its last frame back to its first, against the steps beside it. A loop that
 * closes steps across its seam as it steps on either side of it; a loop that does not close jumps there.
 * MEASURED on the whole loop of engine 22b2ad3ea80cf9c7 (480 frames, preview size, 2 samples, Linux in software,
 * mean absolute difference of 320 x 180 grey pictures in levels of 255): the seam 0.656, the four steps on each
 * side 0.41 to 0.47, the median step of the loop 1.08 and its largest 10.56 (in the storm). So the largest step of
 * the loop says nothing about the seam, and the steps beside it do: the seam there is 1.4 times the largest of them.
 */
export const SEAM = { beside: 4, times: 3, least: 1, wanted: 'at most three times the largest of the four steps on each side of it, or under one level' }
export const besideSeam = (steps, k = SEAM.beside) => Math.max(0, ...steps.slice(0, k), ...steps.slice(-k))
export const seamOk = ({ seam, beside }) => seam <= Math.max(beside * SEAM.times, SEAM.least)

/**
 * What the page wrote while it loaded and drew, sorted. An error (a shader that does not compile or link, a script
 * that throws) stops the doctor. A warning does not: on Windows the shader compiler of Direct3D writes warnings for
 * shaders that compile and draw, on every card. Each different warning is kept once, with how often it came; the
 * place in the shader, (line,column), is left out of the comparison because it differs from program to program.
 */
export function pageMessages(list = []) {
  const errors = []
  const warnings = new Map()
  for (const m of list) {
    const text = String(m)
    if (/^warning: /.test(text)) {
      const key = text.replace(/\(\d+,[\d-]+\)/g, '(line)')
      const had = warnings.get(key)
      if (had) had.times++
      else warnings.set(key, { text, times: 1 })
    } else if (!errors.includes(text)) errors.push(text)
  }
  return { errors, warnings: [...warnings.values()] }
}

export const LEAST = { node: [20, 19, 0], git: [2, 25, 0], ffmpeg: [7, 0, 0], chrome: [147, 0, 0] }
/** The Node the build tools take: 20.19 or newer of 20, 22.12 or newer of 22, or anything newer than 22. */
export function nodeOk(text) {
  const v = versionOf(text)
  if (!v) return false
  if (v[0] === 20) return v[1] >= 19
  if (v[0] === 22) return v[1] >= 12
  return v[0] > 22
}
export const NODE_WANTED = 'Node 20.19 or newer of 20, 22.12 or newer of 22, or a newer line (24 and up)'
export const versionOf = (text) => {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(text ?? ''))
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null
}
export const atLeast = (have, least) => {
  if (!have) return false
  for (let i = 0; i < 3; i++) if ((have[i] ?? 0) !== least[i]) return (have[i] ?? 0) > least[i]
  return true
}
/** The version of an ffmpeg build from its first line. A build named by its date or its git hash is taken as new. */
export function ffmpegVersion(firstLine) {
  const m = /^ff(?:mpeg|probe) version (\S+)/.exec(String(firstLine ?? ''))
  if (!m) return null
  const name = m[1].replace(/^n/, '')
  if (/^\d+\.\d+/.test(name)) return { text: m[1], numbers: versionOf(name), dated: false }
  return { text: m[1], numbers: null, dated: true }
}

export const WINGET = {
  git: 'winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements',
  node: 'winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements',
  ffmpeg: 'winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements',
  chrome: 'winget install --id Google.Chrome -e --source winget --accept-package-agreements --accept-source-agreements',
}
export const BREW = { git: 'brew install git', node: 'brew install node', ffmpeg: 'brew install ffmpeg', chrome: 'brew install --cask google-chrome' }
export const installLine = (tool, platform) => (platform === 'win32' ? WINGET[tool] : BREW[tool])
export const NEW_TERMINAL = 'A program installed a moment ago is found only by a terminal opened after the install. This tool also looks in the places winget and Homebrew install to, so run the same line again first.'

// ---------------------------------------------------------------------------------------------------------------------
// Where the machine is.

/** A plain sentence when this is a Linux layer inside Windows, or any Linux, and '' when the film may be drawn here. */
export function placeProblem({ platform, release = '', env = {}, procVersion = '', allowLinux = false }) {
  if (platform === 'win32' || platform === 'darwin') return ''
  const wsl = /microsoft|wsl/i.test(`${release} ${procVersion}`) || !!env.WSL_DISTRO_NAME || !!env.WSL_INTEROP
  if (wsl) return 'this terminal is a Linux layer inside Windows (WSL), and from there the film would be drawn without the graphics card. Close it, open Windows PowerShell or Git Bash, and run the same line there'
  if (allowLinux) return ''
  return `this machine runs ${platform}. The film is drawn on Windows or macOS with their own Google Chrome, and this handoff has no path for ${platform}`
}

// ---------------------------------------------------------------------------------------------------------------------
// The stamp.

export const NOT_RELEASED = 'the film is not released for its final render yet; step 1 only'

export function stampProblems(stamp) {
  const p = []
  if (!stamp || typeof stamp !== 'object') return ['render/STAMP.json is not a stamp']
  if (stamp.version !== STAMP_VERSION) p.push(`the stamp is version ${stamp.version}, this tool reads version ${STAMP_VERSION}`)
  if (typeof stamp.releasedForFinalRender !== 'boolean') p.push('the stamp does not say whether the film is released')
  if (!/^[0-9a-f]{16}$/.test(stamp.engineHash ?? '')) p.push('the stamp holds no engine hash')
  if (!Array.isArray(stamp.references) || !stamp.references.length) p.push('the stamp names no reference frame')
  for (const k of ['film-a', 'film-b']) if (!/^[0-9a-f]{64}$/.test(stamp.sound?.[k] ?? '')) p.push(`the stamp holds no sha256 for the sound of ${k}`)
  for (const f of ['opening.bin', 'manifest.json']) if (!/^[0-9a-f]{64}$/.test(stamp.opening?.files?.[f] ?? '')) p.push(`the stamp holds no sha256 for the opening pack's ${f}`)
  for (const k of ['film-b', 'loop', 'opening', 'film-a']) if (!(stamp.frames?.[k] > 0)) p.push(`the stamp holds no frame count for ${k}`)
  if (stamp.frames && stamp.frames['film-a'] !== stamp.frames.opening + stamp.frames['film-b']) p.push('the stamp\'s frame counts do not add up: film A is the opening and film B')
  return p
}

/** The reasons the full render is refused, in the order they are said. An empty list lets it start. */
export function renderRefusals({ stamp, engineHash, doctor, test, sound, freeGb, needGb, small = false, machine = '' }) {
  const out = []
  const bad = stampProblems(stamp)
  if (bad.length) return bad.map((b) => `${b}. Nothing was drawn`)
  if (!small && stamp.releasedForFinalRender !== true) return [NOT_RELEASED]
  if (!small && (stamp.stillToDraw ?? []).length) return [`${NOT_RELEASED} (the stamp still lacks the references of ${stamp.stillToDraw.join(', ')})`]
  if (stamp.engineHash !== engineHash) out.push(`the engine here is ${engineHash} and the stamp was made for ${stamp.engineHash}: ${hashCause()}`)
  if (!doctor?.pass) out.push(`the doctor does not pass on this machine now: ${doctor?.why ?? 'it was not run'}`)
  if (!test) out.push('the short test has not been run on this machine. Run step 1 first')
  else if (!test.pass) out.push('the short test did not pass on this machine. Run step 1 again and send its report')
  else if (test.engineHash !== engineHash) out.push(`the short test passed for engine ${test.engineHash} and the engine here is now ${engineHash}. Run step 1 again`)
  else if (machine && test.machine !== machine) out.push(`the short test passed on another machine (${test.machine}). Run step 1 on this one`)
  else if (!small && test.small) out.push("the short test here was a run of the tool's own tests, not the real one. Run step 1")
  for (const s of sound ?? []) if (!s.ok) out.push(s.why)
  if (Number.isFinite(freeGb) && Number.isFinite(needGb) && freeGb < needGb) out.push(`${freeGb.toFixed(0)} GB of disk is free where the clone is, and the render needs ${needGb.toFixed(0)} GB`)
  return out
}

export const hashCause = () => 'either the clone is not at the commit the stamp names (somebody pulled, or a file was edited), or git changed the line endings on the way in (the repo carries a .gitattributes against that, so look first for an edited file with: git status)'

/** One of the two final mixes against the stamp. */
export function soundVerdict(which, file, sha, wanted) {
  if (!sha) return { which, ok: false, why: `the sound of ${which} is not here: ${file} is missing. The two final mixes are not in the public repo; they are put there by hand before the full render` }
  if (sha !== wanted) return { which, ok: false, why: `${file} is not the final mix the stamp names (its sha256 starts ${sha.slice(0, 12)}, the stamp says ${String(wanted).slice(0, 12)})` }
  return { which, ok: true, why: `${file} is the final mix the stamp names` }
}

// ---------------------------------------------------------------------------------------------------------------------
// The plan of the full render and of what a second run still has to do.

/** The batches one render process takes: `chunks` whole chunks a batch, in order. */
export function batchesOf(total, chunkFrames, chunks, first = 0, last = total - 1) {
  const out = []
  const step = chunkFrames * Math.max(1, chunks)
  for (let a = first; a <= last; a += step) out.push({ first: a, last: Math.min(last, a + step - 1) })
  return out
}

/** The chunk lines of a range, as the master tool cuts them. */
export function chunkLines(first, last, size) {
  const out = []
  for (let a = first; a <= last; a += size) out.push({ first: a, last: Math.min(last, a + size - 1) })
  return out
}

/**
 * What is left of a render: for each part its chunks, those already finished and the batches that still hold work.
 * `done(what, chunk)` says whether a chunk is finished on disk.
 */
export function resumePlan({ parts, chunkFrames, batchChunks, done }) {
  return parts.map((p) => {
    const chunks = chunkLines(p.first, p.last, chunkFrames)
    const finished = chunks.filter((c) => done(p.what, c))
    const batches = batchesOf(p.last + 1, chunkFrames, batchChunks, p.first, p.last).filter((b) => chunkLines(b.first, b.last, chunkFrames).some((c) => !done(p.what, c)))
    return { ...p, chunks: chunks.length, finished: finished.length, frames: p.last - p.first + 1, framesDone: finished.reduce((n, c) => n + c.last - c.first + 1, 0), batches }
  })
}

const pad6 = (i) => String(i).padStart(6, '0')
export const chunkFile = (what, c) => `${what}-${pad6(c.first)}-${pad6(c.last)}`

// ---------------------------------------------------------------------------------------------------------------------
// Time, processes and disk, from what the short test measured.

/** Least squares of seconds = each + perSample x samples over the frames of the test. With one count only, everything goes to the samples. */
export function fitCost(frames) {
  const list = frames.filter((f) => f.samples > 0 && f.seconds > 0)
  if (!list.length) return null
  const n = list.length
  const sx = list.reduce((s, f) => s + f.samples, 0)
  const sy = list.reduce((s, f) => s + f.seconds, 0)
  const sxx = list.reduce((s, f) => s + f.samples * f.samples, 0)
  const sxy = list.reduce((s, f) => s + f.samples * f.seconds, 0)
  const spread = n * sxx - sx * sx
  if (spread < 1e-9) return { each: 0, perSample: sy / sx, frames: n, counts: 1 }
  let perSample = (n * sxy - sx * sy) / spread
  let each = (sy - perSample * sx) / n
  if (each < 0 || perSample <= 0) {
    each = 0
    perSample = sy / sx
  }
  return { each, perSample, frames: n, counts: new Set(list.map((f) => f.samples)).size }
}

/**
 * The count of render processes, by rule: two when two drew at least GAIN times the samples a second of one and the
 * memory holds two, else one. Never more than two: the test measures no third.
 */
export const PROCS_GAIN = 1.3
export function procsRule({ one, two, memoryHolds }) {
  if (!(one > 0)) return { procs: 1, why: 'the speed of one process was not measured, so one is used' }
  if (!(two > 0)) return { procs: 1, why: 'the speed of two processes was not measured, so one is used' }
  const gain = two / one
  if (memoryHolds < 2) return { procs: 1, gain, why: `two processes drew ${gain.toFixed(2)} times what one draws, and the memory holds one process only` }
  if (gain >= PROCS_GAIN) return { procs: 2, gain, why: `two processes drew ${gain.toFixed(2)} times what one draws, which is ${PROCS_GAIN} times or more` }
  return { procs: 1, gain, why: `two processes drew ${gain.toFixed(2)} times what one draws, under the ${PROCS_GAIN} times that would pay for a second` }
}

/** The seconds the film still needs: every frame's samples at the measured cost, shared by the processes' gain, and the encodes. */
export function projection({ counts, cost, gain = 1, encodeSeconds = 0, startSeconds = 0, batches = 0, chunkSeconds = 0, chunks = 0 }) {
  let seconds = chunkSeconds * chunks
  let frames = 0
  for (const [samples, n] of Object.entries(counts ?? {})) {
    seconds += n * (cost.each + cost.perSample * Number(samples))
    frames += n
  }
  const draw = seconds / Math.max(1, gain)
  return { frames, drawSeconds: draw, encodeSeconds, startSeconds: startSeconds * batches, seconds: draw + encodeSeconds + startSeconds * batches }
}

export const TOO_LONG_HOURS = 10

/** The disk the full render needs at its fullest, in bytes. */
export function diskPlan({ chunkBytes, frames, chunkFrames, pngBytes, procs = 1, finalBytes, deliverOnSameDrive = true, spare = 3 * 1024 ** 3 }) {
  const chunks = Object.values(frames).reduce((n, f) => n + Math.ceil(f / chunkFrames), 0)
  const intermediates = chunks * chunkBytes
  const inFlight = pngBytes * chunkFrames * procs
  const finals = finalBytes.reduce((a, b) => a + b, 0)
  const encodeRoom = Math.max(...finalBytes) * 2.2 + 256e6
  const copies = deliverOnSameDrive ? finals : 0
  return { chunks, intermediates, inFlight, finals, encodeRoom, copies, spare, total: intermediates + inFlight + finals + encodeRoom + copies + spare }
}

export const gb = (bytes) => bytes / 1024 ** 3
export const hoursText = (seconds) => (seconds < 90 ? `${Math.round(seconds)} s` : seconds < 5400 ? `${(seconds / 60).toFixed(1)} min` : `${(seconds / 3600).toFixed(1)} h`)

// ---------------------------------------------------------------------------------------------------------------------
// Pictures: plain measures on rgb24 buffers, the same arithmetic on every machine.

export const HALF_FILTER = 'the mean of each 2 x 2 block of pixels, rounded half up'
/** Half size by the mean of each 2 x 2 block. */
export function half(rgb, width, height) {
  const w = width >> 1
  const h = height >> 1
  const out = Buffer.allocUnsafe(w * h * 3)
  for (let y = 0; y < h; y++) {
    const a = y * 2 * width * 3
    const b = a + width * 3
    for (let x = 0; x < w; x++) {
      const i = x * 6
      const o = (y * w + x) * 3
      for (let c = 0; c < 3; c++) out[o + c] = (rgb[a + i + c] + rgb[a + i + 3 + c] + rgb[b + i + c] + rgb[b + i + 3 + c] + 2) >> 2
    }
  }
  return { data: out, width: w, height: h }
}

export function crop(rgb, width, box) {
  const out = Buffer.allocUnsafe(box.w * box.h * 3)
  for (let y = 0; y < box.h; y++) rgb.copy(out, y * box.w * 3, ((box.y + y) * width + box.x) * 3, ((box.y + y) * width + box.x + box.w) * 3)
  return out
}

/** PSNR over all three colours, and the largest difference of one value. */
export function psnr(a, b) {
  if (a.length !== b.length) throw new Error('two pictures of different sizes cannot be compared')
  let sum = 0
  let most = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    if (d !== 0) {
      sum += d * d
      const m = d < 0 ? -d : d
      if (m > most) most = m
    }
  }
  const mse = sum / a.length
  return { psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse), maxDiff: most }
}

export const COARSE_BLOCK = 8
export const COARSE_MEASURE = `PSNR of the means of ${COARSE_BLOCK} x ${COARSE_BLOCK} pixel blocks, which a shift of one pixel hardly moves`
/** The means of size x size blocks, as floats. */
export function blockMeans(rgb, width, height, size = COARSE_BLOCK) {
  const w = Math.floor(width / size)
  const h = Math.floor(height / size)
  const out = new Float64Array(w * h * 3)
  for (let y = 0; y < h * size; y++) {
    const row = y * width * 3
    const o = Math.floor(y / size) * w * 3
    for (let x = 0; x < w * size; x++) {
      const i = row + x * 3
      const p = o + Math.floor(x / size) * 3
      out[p] += rgb[i]
      out[p + 1] += rgb[i + 1]
      out[p + 2] += rgb[i + 2]
    }
  }
  const n = size * size
  for (let i = 0; i < out.length; i++) out[i] /= n
  return out
}
export function coarsePsnr(a, b, width, height, size = COARSE_BLOCK) {
  const p = blockMeans(a, width, height, size)
  const q = blockMeans(b, width, height, size)
  let sum = 0
  for (let i = 0; i < p.length; i++) sum += (p[i] - q[i]) ** 2
  const mse = sum / p.length
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse)
}

export const NEAR_WHITE = 235
export const GLASS_MEASURE = `the mean BT.709 luma of the region from 0 to 1, and the share of its pixels whose luma is ${NEAR_WHITE} of 255 or more`
/** The glass check of one region: a glass that came out white is brighter in the mean and holds far more near white pixels. */
export function glassStats(rgb, width, box) {
  let sum = 0
  let white = 0
  for (let y = box.y; y < box.y + box.h; y++) {
    let i = (y * width + box.x) * 3
    for (let x = 0; x < box.w; x++, i += 3) {
      const l = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2]
      sum += l
      if (l >= NEAR_WHITE) white++
    }
  }
  const n = box.w * box.h
  return { meanLuma: sum / n / 255, nearWhite: white / n }
}

/** Whether a picture is one flat value, or holds a value that cannot be. */
export function pictureProblem(rgb, width, height) {
  if (rgb.length !== width * height * 3) return `it holds ${rgb.length} bytes, not ${width} x ${height} x 3`
  let lo = 255
  let hi = 0
  for (let i = 0; i < rgb.length; i++) {
    const v = rgb[i]
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (hi - lo <= 2) return `it is one flat value (${lo} to ${hi}) over the whole picture`
  return ''
}

const num = (x, digits = 2) => (x === Infinity ? 'identical' : `${Number(x).toFixed(digits)} dB`)

/**
 * One reference frame against what this machine drew. `here` is the frame at full size, `ref` the reference's
 * decoded pictures. Returns the numbers and one row for each check, each with its floor.
 */
/**
 * How far two pictures stand apart, pixel by pixel. A pixel's difference is the largest of its three channels'
 * differences, in levels of 255. The floors above hold the test; this says where the difference lies.
 */
export const APART = { levels: 8, columns: 8, rows: 4 }
export const APART_MEASURE = `a pixel counts as apart when one of its channels differs by more than ${APART.levels} of 255 levels; the picture is laid out as ${APART.columns} columns by ${APART.rows} rows of cells, column 1 at the left and row 1 at the top`
export function apart(a, b, width, height, { levels = APART.levels, columns = APART.columns, rows = APART.rows } = {}) {
  const px = width * height
  const cells = new Array(columns * rows).fill(0)
  let largest = 0
  let sum = 0
  let over = 0
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  let at = null
  for (let y = 0; y < height; y++) {
    const cy = Math.min(rows - 1, Math.floor((y * rows) / height))
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const d0 = Math.abs(a[i] - b[i])
      const d1 = Math.abs(a[i + 1] - b[i + 1])
      const d2 = Math.abs(a[i + 2] - b[i + 2])
      sum += d0 + d1 + d2
      const d = d0 > d1 ? (d0 > d2 ? d0 : d2) : d1 > d2 ? d1 : d2
      if (d > largest) {
        largest = d
        at = { x, y }
      }
      if (d > levels) {
        over++
        cells[cy * columns + Math.min(columns - 1, Math.floor((x * columns) / width))]++
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  const most = cells
    .map((n, k) => ({ column: (k % columns) + 1, row: Math.floor(k / columns) + 1, pixels: n }))
    .filter((c) => c.pixels > 0)
    .sort((p, q) => q.pixels - p.pixels || p.row - q.row || p.column - q.column)
  return { largest, largestAt: at, mean: px ? sum / (px * 3) : 0, over, share: px ? over / px : 0, levels, box: over ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null, cells: most }
}

/** One line of words for what apart() found. `scale` and `offset` put places into the pixels of the full picture. */
export function apartText(m, { scale = 1, x = 0, y = 0 } = {}) {
  const head = `largest ${m.largest} of 255${m.largestAt && m.largest ? ` at x ${m.largestAt.x * scale + x} y ${m.largestAt.y * scale + y}` : ''}, mean ${m.mean.toFixed(3)}, ${m.over} pixels (${(m.share * 100).toFixed(3)} %) over ${m.levels}`
  if (!m.over) return head
  const cells = m.cells.slice(0, 3).map((c) => `column ${c.column} row ${c.row}: ${c.pixels}`).join(', ')
  return `${head}; they lie within x ${m.box.x * scale + x} to ${(m.box.x + m.box.w) * scale + x - 1}, y ${m.box.y * scale + y} to ${(m.box.y + m.box.h) * scale + y - 1} of the full picture, most in ${cells}`
}

/** A picture of where two pictures differ: grey, the difference times 16, so that one level shows. */
export function apartPicture(a, b, width, height, times = 16) {
  const out = Buffer.alloc(width * height * 3)
  for (let i = 0; i < out.length; i += 3) {
    const d = Math.min(255, Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) * times)
    out[i] = out[i + 1] = out[i + 2] = d
  }
  return out
}

export function compareFrame({ here, width, height, ref, floors }) {
  const rows = []
  const row = (check, found, wanted, pass) => rows.push({ check, found, wanted, pass })
  const bad = pictureProblem(here, width, height)
  row('a picture', bad || 'it holds a picture', 'no flat or empty frame', !bad)
  if (bad) return { rows, pass: false, numbers: {} }
  const h = half(here, width, height)
  const whole = psnr(h.data, ref.half.data)
  const wholeCoarse = coarsePsnr(h.data, ref.half.data, h.width, h.height)
  row('whole picture, half size', num(whole.psnr), `${floors.psnrWhole} dB or more`, whole.psnr >= floors.psnrWhole)
  row('whole picture, blocks', num(wholeCoarse), `${floors.coarseWhole} dB or more`, wholeCoarse >= floors.coarseWhole)
  const wholeApart = apart(h.data, ref.half.data, h.width, h.height)
  row('whole picture, how far apart', apartText(wholeApart, { scale: 2 }), 'noted only: it says where the difference lies', null)
  const cuts = []
  for (const c of ref.cuts) {
    const mine = crop(here, width, c)
    const p = psnr(mine, c.data)
    const coarse = coarsePsnr(mine, c.data, c.w, c.h)
    const cutApart = apart(mine, c.data, c.w, c.h)
    cuts.push({ name: c.name, psnr: p.psnr, coarse, maxDiff: p.maxDiff, apart: cutApart })
    row(`cut ${c.name}, full size`, num(p.psnr), `${floors.psnrCut} dB or more`, p.psnr >= floors.psnrCut)
    row(`cut ${c.name}, blocks`, num(coarse), `${floors.coarseCut} dB or more`, coarse >= floors.coarseCut)
    row(`cut ${c.name}, how far apart`, apartText(cutApart, { x: c.x, y: c.y }), 'noted only', null)
  }
  const glass = []
  for (const g of ref.glass ?? []) {
    const s = glassStats(here, width, g)
    const lumaOff = Math.abs(s.meanLuma - g.meanLuma)
    const whiteOver = s.nearWhite - g.nearWhite
    glass.push({ name: g.name, ...s, lumaOff, whiteOver })
    row(`glass ${g.name}, mean luma`, `${s.meanLuma.toFixed(4)} (the reference is ${g.meanLuma.toFixed(4)})`, `within ${floors.glassLuma} of the reference`, lumaOff <= floors.glassLuma)
    row(`glass ${g.name}, near white`, `${(s.nearWhite * 100).toFixed(2)} % (the reference is ${(g.nearWhite * 100).toFixed(2)} %)`, `at most ${(floors.glassWhite * 100).toFixed(1)} points over the reference`, whiteOver <= floors.glassWhite)
  }
  return { rows, pass: rows.every((r) => r.pass !== false), numbers: { psnrWhole: whole.psnr, coarseWhole: wholeCoarse, maxDiff: whole.maxDiff, apart: wholeApart, cuts, glass } }
}

// ---------------------------------------------------------------------------------------------------------------------
// Reports.

export function tableText(rows) {
  const cols = ['check', 'found', 'wanted', 'pass']
  const cell = (r, c) => (c === 'pass' ? (r.pass === true ? 'ok' : r.pass === false ? 'FAILS' : 'noted') : String(r[c] ?? ''))
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => cell(r, c).length)))
  const line = (cells) => cells.map((t, i) => t.padEnd(width[i])).join('  ').trimEnd()
  return [line(cols), line(width.map((w) => '-'.repeat(w))), ...rows.map((r) => line(cols.map((c) => cell(r, c))))].join('\n')
}

/** The last line of every command: PASS or FAIL and one sentence, on one line. RUNNING is the answer of a watch that ran out of time. */
export function verdictLine(state, sentence) {
  if (!['PASS', 'FAIL', 'RUNNING'].includes(state)) throw new Error(`${state} is no verdict`)
  return `${state}: ${String(sentence).replace(/\s+/g, ' ').trim()}`
}
export const EXIT = { PASS: 0, FAIL: 1, RUNNING: 3 }

export const sha256File = (file) => {
  const h = crypto.createHash('sha256')
  const fd = fs.openSync(file, 'r')
  const buf = Buffer.allocUnsafe(1 << 22)
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null)
      if (!n) break
      h.update(buf.subarray(0, n))
    }
  } finally {
    fs.closeSync(fd)
  }
  return h.digest('hex')
}

/** Where a tool is: the first folder of `dirs` that holds one of its file names. */
export function findIn(dirs, names, exists = fs.existsSync) {
  for (const d of dirs) for (const n of names) if (d && exists(path.join(d, n))) return path.join(d, n)
  return ''
}

/** The folders of the PATH variable, whatever the platform calls and separates it. */
export function pathDirs(env, platform) {
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path')
  return String(key ? env[key] : '').split(platform === 'win32' ? ';' : ':').filter(Boolean)
}

// ---------------------------------------------------------------------------------------------------------------------
// Sample counts of every frame, kept short: [count, run] pairs.

export function runsOf(counts) {
  const out = []
  for (const c of counts) {
    const last = out[out.length - 1]
    if (last && last[0] === c) last[1]++
    else out.push([c, 1])
  }
  return out
}
export const countsOf = (runs) => (runs ?? []).flatMap(([c, n]) => new Array(n).fill(c))
/** samples -> frames, for the frames `first` to `last` of a list of counts. */
export function tally(counts, first = 0, last = counts.length - 1) {
  const out = {}
  for (let i = first; i <= last; i++) out[counts[i]] = (out[counts[i]] ?? 0) + 1
  return out
}

/** The stretch of the short test: its frames, the chunk size, and the chunks one process and two processes draw. */
export function stretchPlan(text, fallback, chunkFrames) {
  const m = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(text || '')
  const first = m ? Number(m[1]) : fallback.first
  const last = m ? Number(m[2]) : fallback.last
  const size = m && m[3] ? Number(m[3]) : m ? Math.min(chunkFrames, last - first + 1) : chunkFrames
  if (!(last >= first) || first % size !== 0 || (last + 1) % size !== 0) throw new Error(`the stretch ${first} to ${last} is not whole chunks of ${size} frames`)
  const chunks = chunkLines(first, last, size)
  const cut = Math.ceil(chunks.length / 2)
  return { first, last, size, chunks, one: chunks.slice(0, cut), two: chunks.slice(cut) }
}

// ---------------------------------------------------------------------------------------------------------------------
// The work that goes on behind a command.

export const STALE_SECONDS = 900
/**
 * What a call of a long command does with the job file it finds: follow the work that runs, show a result nobody has
 * seen, or start. `job` is the file's content or null, `alive` whether its process lives, `age` the seconds since its
 * last sign of life.
 */
export function jobStep({ job, cmd, alive, age }) {
  if (!job) return { do: 'start' }
  const running = job.state === 'running' && alive && age < STALE_SECONDS
  if (running) return job.cmd === cmd ? { do: 'follow' } : { do: 'busy', why: `"${job.cmd}" is still at work in the background. Run "node tools/handoff.mjs ${job.cmd}" to follow it, and this line after it has ended` }
  if (job.state === 'running') return { do: 'start', stopped: job.cmd === cmd, why: `the last "${job.cmd}" was stopped before it ended (its process is gone)` }
  if (job.cmd === cmd && job.state === 'done' && job.shown !== true) return { do: 'show' }
  return { do: 'start' }
}

/** One line of progress for a render: frames done and left, the pace, the expected end. */
export function heartbeatLine({ done, total, secondsAFrame, leftSeconds, now = Date.now(), phase = '' }) {
  const left = total - done
  const end = new Date(now + leftSeconds * 1000)
  const clock = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
  return `heartbeat: ${phase ? `${phase}, ` : ''}${done} of ${total} frames done, ${left} left, ${secondsAFrame > 0 ? `${secondsAFrame.toFixed(2)} s a frame` : 'no pace yet'}, ${leftSeconds > 0 ? `expected end about ${clock} (${hoursText(leftSeconds)} from now)` : 'no end to name yet'}`
}

/** Seconds the frames `from` on still need, by the measured cost of a sample and of a frame. */
export function secondsLeft(counts, done, cost, gain = 1) {
  let s = 0
  for (let i = 0; i < counts.length; i++) if (!done(i)) s += cost.each + cost.perSample * counts[i]
  return s / Math.max(1, gain)
}

/** The arguments this tool takes. Anything else is refused, so that no line can carry a switch the handoff file does not hold. */
export const COMMANDS = ['setup', 'doctor', 'test', 'render', 'check', 'deliver', 'clean']
export function argProblem(argv) {
  if (argv.length === 1 && COMMANDS.includes(argv[0])) return ''
  if (argv.length === 2 && COMMANDS.includes(argv[0]) && argv[1] === '--worker') return ''
  if (argv[0] === 'stamp') return ''
  return `this tool takes one word and nothing else: ${COMMANDS.join(', ')}. It was given "${argv.join(' ')}"`
}
