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
/** The folder a short test that failed leaves on the Desktop, for Brandon to bring into the build thread. */
export const failedTestName = () => `${TITLE} - Test - Failed`
/**
 * What of the tool's work folder goes into that folder. `have` lists files as { path, ms, bytes }: the path under
 * the work folder with forward slashes, and when it was written. What the doctor found and the numbers of the test
 * always go. Pictures, the sheet and the shader messages go only when this test wrote them (`since`, the time the
 * test began): those of an earlier test would pass for this one's. Every file lies flat in the folder.
 */
export function failedTestPick(have, since) {
  const always = ['test.json', 'doctor.json', 'report-doctor.txt']
  const fresh = (p) => p === 'test/contact-sheet.jpg' || p === 'shader-messages-test.txt' || /^compared\/[^/]+$/.test(p)
  return have
    .filter((f) => always.includes(f.path) || (fresh(f.path) && f.ms >= since - 2000))
    .map((f) => ({ from: f.path, as: f.path.split('/').pop(), bytes: f.bytes, picture: /\.(png|jpg|webp)$/.test(f.path) }))
    .sort((a, b) => (a.as < b.as ? -1 : a.as > b.as ? 1 : 0))
}
/** The block of the test's report that says what to send, when the test failed. */
export function toSendLines(kept) {
  if (!kept) return []
  const pictures = kept.pictures ? `the sheet of pictures and what this machine drew (${kept.pictures} picture ${kept.pictures === 1 ? 'file' : 'files'})` : 'no picture, since the test drew none'
  return [
    'TO SEND. The short test failed. Nothing is rendered and no floor is changed on this machine.',
    `  folder   ${kept.folder}`,
    `  holds    this report, the numbers (test.json), ${pictures}: ${kept.files + 1} files, ${(kept.bytes / 1e6).toFixed(1)} MB`,
    '  Brandon brings that folder into the build thread. The floors are ruled on there.',
  ]
}
/** The folder on the Desktop. A run of the tool's own tests gets another folder, so that it never passes for the film. */
export const deliveryFolder = (small = false) => (small ? `${TITLE} (tool test)` : TITLE)

// ---------------------------------------------------------------------------------------------------------------------
// The switches of the tool's own tests. They come in one variable of the environment that RENDER-ON-YOUR-PC.md never
// names, so that no line an agent is given can turn one on.
export const TEST_VARIABLE = 'HANDOFF_TEST'
const TEST_WORDS = ['software', 'small', 'tones', 'linux', 'inline', 'fast-watch', 'browser-moved', 'floors-high']
export function testSwitches(text = '') {
  const out = { software: false, small: false, tones: false, linux: false, inline: false, fastWatch: false, browserMoved: false, floorsHigh: false, angle: '', refs: '', stretch: '', stop: 0 }
  for (const word of String(text).split(',').map((w) => w.trim()).filter(Boolean)) {
    const [key, value = ''] = word.split('=')
    if (key === 'angle' && /^[a-z0-9]+$/.test(value)) out.angle = value
    else if (key === 'refs' && value) out.refs = value
    else if (key === 'stretch' && /^\d+-\d+(\/\d+)?$/.test(value)) out.stretch = value
    else if (key === 'fast-watch' && !value) out.fastWatch = true
    else if (key === 'browser-moved' && !value) out.browserMoved = true
    else if (key === 'floors-high' && !value) out.floorsHigh = true
    else if (TEST_WORDS.includes(key) && !value) out[key] = true
    else throw new Error(`${TEST_VARIABLE} holds ${word}, which is no switch of the tool's tests`)
  }
  return out
}
export const anyTestSwitch = (t) => t.software || t.small || t.tones || t.linux || t.floorsHigh || !!t.angle || !!t.refs || !!t.stretch

/**
 * The tool's own test of a short test that fails. With the switch on, the floors of the comparison are raised out
 * of reach, so that every frame this machine draws fails with its real numbers, and one row says that the failure
 * is made up. What a failed test leaves behind (the folder for the build thread) can so be proven on a machine
 * whose pictures are right.
 */
export const MADE_UP_FAILURE = "a failure made up by the tool's own test"
export function floorsOfTest(floors, high) {
  if (!high) return floors
  return { ...floors, psnrWhole: 99, coarseWhole: 99, psnrCut: 99, coarseCut: 99 }
}

/**
 * The tool's own test of a browser that updated itself between the short test and the render. With the switch on,
 * the render is told that the test passed on another version than the one it sees, from the first time it looks
 * until a short test has been started after that. `seen` is when the render first looked (null: never), `testTime`
 * when the last short test started. `mark` says that this look is the first and its time is to be kept.
 * `framesDone` is how many frames lie finished on disk at this start (left out: not looked at).
 * @param {{ on: any, seen: any, testTime: any, framesDone?: number }} p
 */
export function browserMovedPretend({ on, seen, testTime, framesDone }) {
  if (!on) return { pretend: false, mark: false }
  // with chunks on disk, as a browser updates itself in the middle of a render: a start that finds none waits
  if (!seen) return framesDone === 0 ? { pretend: false, mark: false } : { pretend: true, mark: true }
  const t = Date.parse(testTime ?? '')
  return { pretend: !(Number.isFinite(t) && t > Date.parse(seen)), mark: false }
}
export const MADE_UP_UPDATE = "of before an update that the tool's own test made up"

// ---------------------------------------------------------------------------------------------------------------------
// The calibration picture: one still that a machine draws for a build. Every chunk of the film names the sha256 of
// its file, and the films are joined only from chunks that all name one and the same picture. So it is drawn once
// for a build on the machine and kept; whatever is run afterwards uses the kept one.

/** The rule by which the renderer itself takes a record of the calibration picture as this machine's and this build's. */
export function calibrationKept(record, { engineHash, renderer, machine }) {
  return !!record && record.engineHash === engineHash && record.renderer === renderer && record.machine === machine && typeof record.sha256 === 'string' && record.sha256.length > 0
}

/**
 * The calibration pictures that finished chunks name, the one that holds the most frames first. Only chunks that
 * this machine drew for this build with this renderer count: another machine's word says nothing of this one.
 * `chunks` are the records of the finished chunks, each with its count of frames.
 */
export function calibrationOfChunks(chunks, { engineHash, renderer, machine }) {
  const tally = new Map()
  for (const c of chunks ?? []) {
    if (!c || c.what === 'opening' || c.engineHash !== engineHash || c.renderer !== renderer || c.machine !== machine) continue
    if (typeof c.calibration !== 'string' || !c.calibration) continue
    const t = tally.get(c.calibration) ?? { sha256: c.calibration, chunks: 0, frames: 0 }
    t.chunks += 1
    t.frames += c.frames ?? 0
    tally.set(c.calibration, t)
  }
  return [...tally.values()].sort((a, b) => b.frames - a.frames || b.chunks - a.chunks || (a.sha256 < b.sha256 ? -1 : 1))
}

/**
 * What is done about the calibration picture before anything is drawn.
 * keep: a record is here that the renderer takes. It is never replaced.
 * restore: the record is gone or cannot be read, and finished chunks that this machine drew for this build name a
 *   picture. The record is written again from their word and nothing is drawn: a new picture could come out
 *   another one, and the chunks on disk would then not be joined with those drawn after it.
 * draw: no record and no chunk of this machine and build: the picture is drawn, once.
 */
export function calibrationStep({ record, chunks, want }) {
  if (calibrationKept(record, want)) return { do: 'keep', sha256: record.sha256 }
  const named = calibrationOfChunks(chunks, want)
  if (named.length) return { do: 'restore', sha256: named[0].sha256, chunks: named[0].chunks, frames: named[0].frames }
  return { do: 'draw', sha256: null }
}

/**
 * Whether a finished chunk on disk counts for the render that goes on. A chunk of the opening is no drawing of the
 * engine and names no calibration picture. A chunk of film B or of the loop counts when it names this build and
 * the kept calibration picture: any other one is drawn again before the films are joined, so that the join never
 * finds two pictures.
 */
export function chunkCounts(record, { what, engineHash, calibration }) {
  if (!record) return false
  if (what === 'opening') return true
  return record.engineHash === engineHash && typeof calibration === 'string' && calibration.length > 0 && record.calibration === calibration
}

/** Two pictures of one size, pixel by pixel: how many differ, and the largest difference in any channel. */
export function pixelsApart(a, b, channels = 3) {
  if (!a || !b || a.length !== b.length || a.length % channels !== 0) return null
  let pixels = 0
  let most = 0
  for (let i = 0; i < a.length; i += channels) {
    let d = 0
    for (let k = 0; k < channels; k++) {
      const x = Math.abs(a[i + k] - b[i + k])
      if (x > d) d = x
    }
    if (d > 0) {
      pixels += 1
      if (d > most) most = d
    }
  }
  return { pixels, most, total: a.length / channels }
}

/** The one line of the short test that says whether this machine draws the calibration picture the same twice. */
export function twiceLine(t) {
  if (!t) return 'not compared'
  if (t.why) return `not compared: ${t.why}`
  if (Number.isInteger(t.pixels)) {
    const n = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return t.pixels === 0
      ? `the same twice: a second drawing differs from the kept one in 0 of ${n(t.total)} pixels, the largest difference in any channel is 0 levels`
      : `not the same twice: a second drawing differs from the kept one in ${n(t.pixels)} of ${n(t.total)} pixels, the largest difference in any channel is ${t.most} of 255 levels`
  }
  return t.same ? 'the same twice by the sha256 of the file (the kept picture itself is not on disk, so no pixels are counted)' : 'not the same twice by the sha256 of the file (the kept picture itself is not on disk, so no pixels are counted)'
}

/**
 * The versions of the browser a render drew with, in the order of its starts. Each start keeps the version its short
 * test passed on; `last` is the version of the newest short test, for a render whose starts kept none.
 */
export function browsersUsed(sessions, last) {
  const out = []
  for (const v of (sessions ?? []).map((s) => s?.browser)) if (v && !out.includes(v)) out.push(v)
  if (!out.length && last) out.push(last)
  return out
}
/** The line of the render report that names them. */
export function browsersLine(sessions, last) {
  const used = browsersUsed(sessions, last)
  if (!used.length) return 'Google Chrome, version not recorded'
  if (used.length === 1) return `Google Chrome ${used[0]}`
  return `Google Chrome ${used.join(', then ')}: the browser was updated on the way, and each version passed the short test before it drew a frame`
}

/** What a copy to the Desktop does when the file there is held open by another program (a player, a viewer). */
export const HELD_CODES = ['EBUSY', 'EPERM', 'EACCES']
export const heldOpen = (e) => HELD_CODES.includes(e?.code)
export const heldSentence = (name) => `"${name}" on the Desktop could not be written, because another program holds it open (a player or a viewer, most likely). Brandon closes that program, then the same line is run again`
/** The name a second copy gets beside a file that is held open: "a.mp4" becomes "a (new).mp4". */
export const besideName = (name) => name.replace(/(\.[^.]+)?$/, (ext) => ` (new)${ext}`)

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
/**
 * The card the film must be drawn on: an NVIDIA card before an AMD one before an Apple one, and of two cards of one
 * maker the one with more memory of its own. Null when the machine has none of them.
 */
export function wantedCard(cards) {
  for (const vendor of RANK) {
    const same = (cards ?? []).filter((c) => vendorOf(c.name) === vendor)
    if (!same.length) continue
    const card = same.reduce((best, c) => ((c.memoryBytes ?? 0) > (best.memoryBytes ?? 0) ? c : best), same[0])
    return { vendor, name: card.name, others: same.filter((c) => c !== card).map((c) => c.name) }
  }
  return null
}

const FILLER_WORDS = new Set(['tm', 'r', 'c', 'gpu', 'graphics', 'series', 'adapter', 'device'])
/** The words of a card's name that tell one model from another: lower case, no marks, no filler. */
export const modelWords = (name) => String(name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !FILLER_WORDS.has(w))
/** Which model words of the card's name the page's renderer string does not hold. */
export function wordsMissing(renderer, cardName) {
  const have = new Set(modelWords(renderer))
  return modelWords(cardName).filter((w) => !have.has(w))
}

/**
 * Whether the page draws on the right thing. `renderer` is WebGL's unmasked renderer string, read from the page that
 * draws; `cards` are the video cards the system names. Software is refused by name. A card of another maker than the
 * one the machine has for the work is refused. Where the machine has two different cards of that maker, the page's name
 * must hold the model words of the stronger one. Where it has one, words that differ are noted (`look`) and not refused:
 * the maker is the same and there is no other card it could be.
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
  if (got !== want.vendor) return { ok: false, software: false, why: `the page draws on "${renderer}" and this machine has ${want.name}. The film must be drawn on the ${want.vendor} card` }
  const missing = wordsMissing(renderer, want.name)
  if (!missing.length) return { ok: true, software: false, card: want.name, why: `the page draws on the ${want.vendor} card, and its name holds the model words of ${want.name}` }
  const rivals = want.others.filter((n) => wordsMissing(renderer, n).length === 0 || modelWords(n).join(' ') !== modelWords(want.name).join(' '))
  if (rivals.length) return { ok: false, software: false, why: `the page draws on "${renderer}", and this machine has more than one ${want.vendor} card (${[want.name, ...want.others].join(', ')}). The page's name does not hold the model words of the stronger one, ${want.name} (it lacks: ${missing.join(' ')}). The film must be drawn on that card` }
  return { ok: true, software: false, card: want.name, look: `the page draws on "${renderer}". That is a ${want.vendor} card and the only one this machine has, but its name does not hold these words of the system's name for it, "${want.name}": ${missing.join(' ')}`, why: `the page draws on the ${want.vendor} card` }
}

// ---------------------------------------------------------------------------------------------------------------------
// The card's load while frames are drawn, as nvidia-smi says it.

export const SMI_ARGS = ['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits']
/** One line of nvidia-smi's answer to SMI_ARGS: percent busy, MiB in use, MiB in all. Null for a line that is none. */
export function parseSmi(line) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*$/.exec(String(line ?? ''))
  return m ? { busy: Number(m[1]), usedMb: Number(m[2]), totalMb: Number(m[3]) } : null
}
/** The busiest reading and the most memory in use of many lines. */
export function smiSummary(lines) {
  const read = (lines ?? []).map(parseSmi).filter(Boolean)
  if (!read.length) return { readings: 0, busiest: 0, mostMb: 0, totalMb: 0 }
  return { readings: read.length, busiest: Math.max(...read.map((r) => r.busy)), mostMb: Math.max(...read.map((r) => r.usedMb)), totalMb: Math.max(...read.map((r) => r.totalMb)) }
}
/** Under this share of its time busy, while frames are drawn, a card is taken to stand idle. */
export const IDLE_PERCENT = 5
/** What the card's load says of the test: a line to print, and `look` when someone must look at it. */
export function loadVerdict(sum, { wantNvidia, found, why = '' }) {
  if (!found) return wantNvidia ? { text: `not read: nvidia-smi ${why || 'was not found'}`, look: `the load of the NVIDIA card could not be read while frames were drawn (nvidia-smi ${why || 'was not found'}), so only the page's own name says what drew` } : { text: 'not read: this machine has no NVIDIA card, and nvidia-smi is the one reader this tool has', look: '' }
  if (!sum.readings) return { text: 'nvidia-smi gave no reading', look: wantNvidia ? 'nvidia-smi was started and gave no reading of the card while frames were drawn' : '' }
  const text = `busiest ${sum.busiest} %, most memory in use ${Math.round(sum.mostMb)} of ${Math.round(sum.totalMb)} MiB, ${sum.readings} readings two seconds apart`
  if (sum.busiest < IDLE_PERCENT) return { text, look: `the NVIDIA card stayed idle while frames were drawn (busiest ${sum.busiest} %). The page's name says it draws there, the card's own counter says it does not` }
  return { text, look: '' }
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
  gh: 'winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements',
}
export const BREW = { git: 'brew install git', node: 'brew install node', ffmpeg: 'brew install ffmpeg', chrome: 'brew install --cask google-chrome', gh: 'brew install gh' }
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
// The upload: the finished files go to a draft release of the private repo, so that the remote team can fetch them.

/** GitHub takes no file of a release of 2 GiB or more. The tool holds every file under 2,000 MB. */
export const UPLOAD_LIMIT_BYTES = 2000 * 1e6
/** Every release the upload's own test makes carries this mark at the start of its tag. */
export const UPLOAD_TEST_MARK = 'handoff-upload-test'

/** Owner and name of a GitHub repo, from the address of a clone's origin. The address itself is never printed. */
export function repoOf(url) {
  const m = /^(?:https:\/\/(?:[^@/\s]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(String(url ?? '').trim())
  return m ? { owner: m[1], repo: m[2], slug: `${m[1]}/${m[2]}` } : null
}

/**
 * The name a file carries on a release. GitHub itself puts a dot for a space ("Stand In - A.mp4" came back as
 * "Stand.In.-.A.mp4", measured), so the tool sends that name and keeps the true name as the file's label.
 */
export const assetName = (name) => String(name).replace(/[^A-Za-z0-9._-]/g, '.')

const cleanWord = (s, most = 40) => String(s ?? '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, most).replace(/-+$/, '') || 'machine'
/** Tag and title of the draft release of a render: its day, its engine hash and the machine that drew it. */
export function releaseNames({ date, engineHash, machine, small = false }) {
  const day = String(date).slice(0, 10)
  const m = cleanWord(machine)
  return {
    tag: `render-${day.replace(/-/g, '')}-${engineHash}-${m}${small ? '-tool-test' : ''}`,
    title: `${TITLE} render, ${day}, engine ${engineHash}, ${m}${small ? " (a small run of the tool's own tests, no film)" : ''}`,
  }
}
/** Tag and title of the draft the upload's own test makes and removes. */
export function testReleaseNames({ time, machine }) {
  const t = String(time).replace(/[^0-9]/g, '').slice(0, 14)
  return { tag: `${UPLOAD_TEST_MARK}-${t}-${cleanWord(machine)}`, title: 'handoff upload test: stand-in files of a few bytes, removed by the test itself' }
}

/** The stand-ins of the upload's own test: fixed names that carry the word test, a few bytes each, and no film. */
export const STAND_INS = [
  { label: 'Upload Test Stand In - With Prompt - 3840x2160.mp4', text: 'upload test, stand-in 1: no film\n' },
  { label: 'Upload Test Stand In - Without Prompt - 3840x2160.mp4', text: 'upload test, stand-in 2: no film\n' },
  { label: 'Upload Test Stand In - Portfolio Looping Video - 3840x2160.mp4', text: 'upload test, stand-in 3: no film, and long enough to be cut short once\n' },
  { label: 'Upload Test Stand In - Portfolio Screenshot - 3840x2160.png', text: 'upload test, stand-in 4: no picture\n' },
]
export const STAND_IN_RECORDS = 'Upload Test Stand In - Render Records.zip'
export const STAND_IN_SUMS = 'Upload Test Stand In - Render Sums.txt'
export const recordsName = () => `${TITLE} - Render Records.zip`
export const sumsName = () => `${TITLE} - Render Sums.txt`

const TYPES = { mp4: 'video/mp4', png: 'image/png', zip: 'application/zip', txt: 'text/plain; charset=utf-8' }
export const contentType = (name) => TYPES[String(name).toLowerCase().split('.').pop()] ?? 'application/octet-stream'

/** The files that may not be sent: those of 2,000 MB or more. */
export const tooLarge = (files, limit = UPLOAD_LIMIT_BYTES) => files.filter((f) => !(f.bytes < limit))

/**
 * What a call of the upload does with what the release holds already. `wanted` is [{ name, bytes, sha256 }], `assets`
 * what GitHub lists, [{ id, name, size, state, digest }]. A file that is there whole is kept, one that is short, not
 * finished or not the same is removed and sent again, one that is missing is sent. What the release holds beside
 * them is named and left.
 */
export function uploadPlan(wanted, assets) {
  const keep = []
  const drop = []
  const send = []
  for (const w of wanted) {
    const have = assets.filter((a) => a.name === w.name)
    const sumOf = (a) => /^sha256:([0-9a-f]{64})$/.exec(a.digest ?? '')?.[1] ?? ''
    const sameSum = (a) => !sumOf(a) || !w.sha256 || sumOf(a) === w.sha256
    const whole = have.find((a) => a.state === 'uploaded' && a.size === w.bytes && sameSum(a))
    if (whole) keep.push({ ...w, id: whole.id })
    else send.push(w)
    for (const a of have) if (a !== whole) drop.push({ id: a.id, name: a.name, why: a.state !== 'uploaded' ? `not finished (GitHub calls it ${a.state})` : a.size !== w.bytes ? `${a.size} bytes where ${w.bytes} are wanted` : 'as long as the file and not the file (its sum differs)' })
  }
  return { keep, drop, send, others: assets.filter((a) => !wanted.some((w) => w.name === a.name)).map((a) => a.name) }
}

/** The release read back against what was sent: every name there, whole, with the bytes, the label and the sum that were sent. */
export function readBackRows(wanted, release) {
  const assets = release?.assets ?? []
  const rows = wanted.map((w) => {
    const a = assets.find((x) => x.name === w.name)
    const want = `${w.bytes} bytes${w.sha256 ? `, sha256 ${w.sha256.slice(0, 12)}` : ''}`
    if (!a) return { check: `on the release: ${w.name}`, found: 'not there', wanted: want, pass: false }
    const sum = /^sha256:([0-9a-f]{64})$/.exec(a.digest ?? '')?.[1] ?? ''
    const label = (a.label ?? '') === (w.label ?? '')
    const pass = a.state === 'uploaded' && a.size === w.bytes && (!sum || !w.sha256 || sum === w.sha256) && label
    return { check: `on the release: ${w.name}`, found: `${a.size} bytes, ${a.state === 'uploaded' ? 'whole' : `not finished (${a.state})`}, ${sum ? `sha256 ${sum.slice(0, 12)} by GitHub's own count` : 'GitHub names no sum of it'}${label ? '' : `, labelled "${a.label ?? ''}"`}`, wanted: want, pass }
  })
  rows.push({ check: 'on the release: a draft', found: release?.draft === true ? 'a draft: published to no one, and no tag is made' : 'it is not a draft', wanted: 'a draft', pass: release?.draft === true })
  const others = assets.filter((a) => !wanted.some((w) => w.name === a.name)).map((a) => a.name)
  rows.push({ check: 'on the release: nothing else', found: others.length ? `also there: ${others.join(', ')}` : 'the files that were sent and no other', wanted: 'noted', pass: null })
  return rows
}

/** The sums file: one line a file, tabs between sha256, bytes, frames, seconds, size in pixels, the name on the release and the file's own name. */
export function sumsText({ title, tag, made, engineHash, commit, machine, files }) {
  const cell = (v) => (v === null || v === undefined || v === '' ? '-' : String(v))
  return [
    `${TITLE}: the sums of the files of one render`,
    `release\t${title}`,
    `tag\t${tag}`,
    `written\t${made}`,
    `engine\t${engineHash}`,
    `commit\t${commit}`,
    `machine\t${machine}`,
    '',
    ['sha256', 'bytes', 'frames', 'seconds', 'pixels', 'name on the release', 'name of the file'].join('\t'),
    ...files.map((f) => [f.sha256, f.bytes, cell(f.frames), cell(typeof f.seconds === 'number' ? f.seconds.toFixed(3) : f.seconds), cell(f.pixels), f.name, f.label].join('\t')),
    '',
  ].join('\n')
}

/** What an answer of the gh program means: `r` is { code, out, err }. */
export function ghSays(r) {
  if (r.code === 0) return { ok: true, kind: '' }
  const text = `${r.err ?? ''}\n${r.out ?? ''}`
  const said = String(r.err ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? `it ended with code ${r.code}`
  if (r.code === 4 || /gh auth login|set the GH_TOKEN environment variable|HTTP 401|Bad credentials/i.test(text)) return { ok: false, kind: 'sign in', said }
  if (/HTTP 404/.test(text)) return { ok: false, kind: 'not found', said }
  if (/HTTP 403/.test(text)) return { ok: false, kind: 'not allowed', said }
  if (/HTTP 422/.test(text) && /already_exists/.test(text)) return { ok: false, kind: 'there already', said }
  return { ok: false, kind: 'other', said }
}

export const SIGN_IN_LINE = 'gh auth login'
export const notSignedIn = () => `gh, the GitHub program, is not signed in on this machine, so nothing is sent. Brandon runs this one line in a terminal of his own and answers what it asks, then the upload line is run again: ${SIGN_IN_LINE}`
export const notPrivate = (slug) => `the repo ${slug} is not private, so nothing is sent: no film is to be published by mistake. The remote team makes the repo private first`
export const mayNotWrite = (slug) => `the GitHub sign in of this machine may not write to the repo ${slug}, so nothing is sent. It must be the account that owns the repo: Brandon runs this one line in a terminal of his own and signs in with that account, then the upload line is run again: ${SIGN_IN_LINE}`
export const ghMissing = (platform) => `gh, the GitHub program that sends the files, is not on this machine. Run this line, then the upload line again: ${installLine('gh', platform) ?? 'install gh from https://cli.github.com'}`

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
export const COMMANDS = ['setup', 'doctor', 'test', 'render', 'check', 'deliver', 'upload', 'clean']
/** A word of the tool's own tests, which the handoff file never names: it sends stand-in files and takes no argument at all. */
export const UPLOAD_TEST_WORD = 'upload-test'
/**
 * The switches of `stamp`, the remote team's word. One it does not know is refused before anything is drawn: a
 * mistyped switch would otherwise start hours of drawing, or write a stamp other than the one that was meant.
 */
export function stampArgProblem(rest) {
  const plain = ['again', 'proof', 'local']
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    const value = rest[i + 1]
    const has = value !== undefined && !value.startsWith('--')
    if (plain.includes(a.slice(2)) && a.startsWith('--')) {
      if (has) return `stamp: ${a} takes no value, and it was given "${value}"`
    } else if (a === '--only') {
      if (!has || !/^[a-z-]+:\d+(,[a-z-]+:\d+)*$/.test(value)) return 'stamp: --only wants frames as what:frame,what:frame'
      i++
    } else if (a === '--released') {
      if (value !== 'true' && value !== 'false') return 'stamp: --released wants true or false'
      i++
    } else return `stamp knows no "${a}". Its switches are --only, --again, --proof, --released and --local (render/README.md)`
  }
  return ''
}
export function argProblem(argv) {
  const words = [...COMMANDS, UPLOAD_TEST_WORD]
  if (argv.length === 1 && words.includes(argv[0])) return ''
  if (argv.length === 2 && words.includes(argv[0]) && argv[1] === '--worker') return ''
  if (argv[0] === 'stamp') return stampArgProblem(argv.slice(1))
  return `this tool takes one word and nothing else: ${COMMANDS.join(', ')}. It was given "${argv.join(' ')}"`
}
