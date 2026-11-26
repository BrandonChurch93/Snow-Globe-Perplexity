import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadConfig, readJson, rel } from './paths.mjs'

const cfg = loadConfig()
export const M = cfg.deliver.master
export const FPS = cfg.film.fps
export const RENDERED = ['film-b', 'loop']
export const WHATS = [...RENDERED, 'opening']
export const JOINS = { 'film-b': ['film-b'], 'film-a': ['opening', 'film-b'], loop: ['loop'] }
export const SOUND = { 'film-b': 'film-b', 'film-a': 'film-a', loop: null }
export const STILL_MAX_MB = 20
export const MEAN_SLACK = 1
export const UHD_RAM_GB = 12

export function pictureLevels(rgb) {
  let lo = [255, 255, 255]
  let hi = [0, 0, 0]
  let sum = 0
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i]
    const g = rgb[i + 1]
    const b = rgb[i + 2]
    if (r < lo[0]) lo[0] = r
    if (g < lo[1]) lo[1] = g
    if (b < lo[2]) lo[2] = b
    if (r > hi[0]) hi[0] = r
    if (g > hi[1]) hi[1] = g
    if (b > hi[2]) hi[2] = b
    sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const n = rgb.length / 3
  return { flat: n > 0 && lo[0] === hi[0] && lo[1] === hi[1] && lo[2] === hi[2], mean: n ? 16 + (219 * sum) / n / 255 : 0 }
}

export function levelProblems(levels, sources) {
  const problems = []
  levels.forEach((f, k) => {
    const src = sources?.[k]
    if (f.flat && !src?.flat) problems.push(`frame ${src?.index ?? k} decodes to one flat value (${f.min})`)
    else if (src && typeof src.mean === 'number' && Math.abs(f.mean - src.mean) > MEAN_SLACK) problems.push(`frame ${src.index ?? k} decodes to a mean of ${f.mean.toFixed(2)} and its picture's is ${src.mean.toFixed(2)}`)
  })
  return problems
}

export function procsProblem(procs, format, totalBytes) {
  const gb = Math.floor(totalBytes / 2 ** 30)
  if (procs > 1 && format === M.format && gb < UHD_RAM_GB) return `--procs ${procs} is refused: this machine has ${gb} GB (free -g) and one ${format} render holds about 3 GB, so two at once can run it out of memory, and a killed graphics process draws black frames. Under ${UHD_RAM_GB} GB it is one ${format} render at a time.`
  return null
}
export const LOOK_WIDTH = 1200

export const pad6 = (i) => String(i).padStart(6, '0')
export const chunkStem = (what, first, last) => `${what}-${pad6(first)}-${pad6(last)}`
export const tierOf = (samples) => `samples-${samples}`
export const masterRoot = (test = false) => (test ? rel('out', 'master', 'test') : rel('out', 'master'))
export const chunkDir = (what, test = false) => path.join(masterRoot(test), what)
export const stillName = (index = 0) => `frame-${pad6(index)}.png`
export const resultName = (which) => {
  const name = M.names[which]
  if (!name) throw new Error(`deliver.master.names holds no name for ${which}`)
  return name
}
export const branchFolder = (branch) => branch.replace(/[^a-zA-Z0-9._-]+/g, '_')

export function branchMatches(name, pattern = M.chunkBranches) {
  const rx = new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
  return rx.test(name)
}

export function chunkLines(total, size = M.chunkFrames) {
  const out = []
  for (let first = 0; first < total; first += size) out.push({ k: first / size, first, last: Math.min(first + size, total) - 1 })
  return out
}

export function nearestRanges(total, first, last, size = M.chunkFrames) {
  const end = total - 1
  const a = Math.min(Math.max(0, first), end)
  const b = Math.min(Math.max(a, last), end)
  const endOf = (f) => Math.min(Math.floor(f / size) * size + size, total) - 1
  const wide = { first: Math.floor(a / size) * size, last: endOf(b) }
  const up = Math.ceil(a / size) * size
  const down = (b + 1) % size === 0 || b === end ? b : Math.floor((b + 1) / size) * size - 1
  const out = [wide]
  if (up <= down && (up !== wide.first || down !== wide.last)) out.push({ first: up, last: down })
  return out
}

export function rangeChunks(total, first = null, last = null, size = M.chunkFrames) {
  const a = first ?? 0
  const b = last ?? total - 1
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a) throw new Error('--first and --last are frame indexes at film.fps, --last not before --first')
  if (b > total - 1) throw new Error(`it has frames 0 to ${total - 1}, and --last ${b} is past them`)
  const onLines = a % size === 0 && ((b + 1) % size === 0 || b === total - 1)
  if (!onLines) {
    const near = nearestRanges(total, a, b, size).map((r) => `--first ${r.first} --last ${r.last}`)
    throw new Error(`frames ${a} to ${b} are not on the chunk lines (a chunk is ${size} frames, chunk k is frames k x ${size} to k x ${size} + ${size - 1}). The nearest ranges that are: ${near.join(', or ')}`)
  }
  return chunkLines(total, size).filter((c) => c.first >= a && c.last <= b)
}

export const framesOf = (c) => Array.from({ length: c.last - c.first + 1 }, (_, i) => c.first + i)

/** What a run still has to do: every chunk without a verified record, with the frames of it that are not on disk yet. */
export function stillToDo(chunks, { done, has }) {
  return chunks.filter((c) => !done(c)).map((c) => ({ ...c, missing: framesOf(c).filter((i) => !has(c, i)) }))
}

export function split(chunks, procs, worker) {
  return chunks.filter((_, i) => i % procs === worker)
}

export function totalsFromCut(cut = readJson(rel('cut', 'CUTLIST.json'))) {
  return { 'film-b': cut.frameCount, opening: cut.opening?.frameCount ?? 0, loop: cut.loop?.frameCount ?? Math.round(cfg.deliver.cardLoop.seconds * FPS) }
}

export function recordMatchesRun(r, want) {
  if (!r) return false
  for (const k of ['what', 'first', 'last', 'engineHash', 'samples', 'format', 'fps']) if (r[k] !== want[k]) return false
  if (want.renderer !== undefined && r.renderer !== want.renderer) return false
  if (want.calibration !== undefined && (r.calibration ?? null) !== want.calibration) return false
  if (!!r.test !== !!want.test) return false
  if (JSON.stringify(r.encoderArgs) !== JSON.stringify(want.encoderArgs)) return false
  return r.verify?.ok === true && Array.isArray(r.frameHashes) && r.frameHashes.length === want.last - want.first + 1
}

const span = (a, b) => (a === b ? `${a}` : `${a} to ${b}`)
const who = (r) => `${r.machine ?? ''} ${r.boot ?? ''}`

export function ranges(list) {
  const out = []
  for (const i of [...list].sort((a, b) => a - b)) {
    const lastRange = out[out.length - 1]
    if (lastRange && i === lastRange.last + 1) lastRange.last = i
    else out.push({ first: i, last: i })
  }
  return out
}

/**
 * Decides whether a set of chunk records can be joined, with no file read except through `sha`.
 * `chunks` is [{ record, file, from }]. `totals` holds the frame count of each part.
 */
export function joinPlan({ which, chunks, totals, test = false, size = M.chunkFrames, sha = null }) {
  const whats = JOINS[which]
  if (!whats) throw new Error(`--join takes ${Object.keys(JOINS).join(', ')}`)
  const problems = []
  const conflicts = []
  const parts = []
  let twice = 0
  let twiceByTwoMachines = 0
  const mine = chunks.filter((c) => whats.includes(c.record?.what))
  const named = (c) => `${c.from ?? c.file}`

  for (const c of mine) {
    const r = c.record
    if (!test && r.test) problems.push(`${named(c)} is marked test (it was rendered with --samples or --format), and a test chunk is never joined into a master`)
    if (test && !r.test) problems.push(`${named(c)} is not marked test, and a test join takes test chunks only`)
    if (sha) {
      const seen = sha(c.file)
      if (seen !== r.sha256) problems.push(`${named(c)} does not match the sha256 in its record (${seen ? `it is ${seen.slice(0, 12)}, the record says ${String(r.sha256).slice(0, 12)}` : 'the mp4 is missing'})`)
    }
    if (!Array.isArray(r.frameHashes) || r.frameHashes.length !== r.last - r.first + 1) problems.push(`${named(c)} holds ${r.frameHashes?.length ?? 0} frame hashes for ${r.last - r.first + 1} frames`)
    if (r.verify?.ok !== true) problems.push(`${named(c)} was never verified against its frames`)
  }

  const same = (key, label, list, of = (r) => r[key]) => {
    const seen = new Map()
    for (const c of list) {
      const v = JSON.stringify(of(c.record))
      if (!seen.has(v)) seen.set(v, [])
      seen.get(v).push(c)
    }
    if (seen.size > 1) problems.push(`${label} differs between chunks: ${[...seen].map(([v, cs]) => `${v} in ${cs.length} (${named(cs[0])}${cs.length > 1 ? ' and others' : ''})`).join('; ')}`)
  }
  for (const w of whats) same('engineHash', `the build hash of ${w}`, mine.filter((c) => c.record.what === w))
  same('format', 'the format', mine)
  same('fps', 'the frame rate', mine)
  same('encoderArgs', 'the list of encoder arguments', mine)
  for (const w of whats) same('samples', `the samples of ${w}`, mine.filter((c) => c.record.what === w))
  for (const w of whats) same('renderer', `the renderer of ${w}`, mine.filter((c) => c.record.what === w))
  for (const w of whats) same('calibration', `the calibration picture of ${w}`, mine.filter((c) => c.record.what === w), (r) => r.calibration ?? null)
  for (const c of mine) if (c.record.what !== 'opening' && !c.record.calibration) problems.push(`${named(c)} names no calibration picture, so nothing says its machine draws what the others draw`)

  let frames = 0
  for (const w of whats) {
    const list = mine.filter((c) => c.record.what === w)
    const told = [...new Set(list.map((c) => c.record.total))]
    const total = test ? null : totals[w]
    if (!test) {
      if (!(total > 0)) problems.push(`the plan holds no frame count for ${w}`)
      for (const t of told) if (t !== total) problems.push(`chunks of ${w} were rendered for a plan of ${t} frames, and the plan (cut/CUTLIST.json) holds ${total}`)
    }
    const lines = total ?? told[0] ?? 0
    const cover = new Map()
    for (const c of list) {
      const r = c.record
      const onLine = r.first % size === 0 && (r.last === Math.min(r.first + size, lines) - 1 || (test && r.last - r.first + 1 <= size))
      if (!onLine) {
        problems.push(`${named(c)} (frames ${span(r.first, r.last)}) is not on the chunk lines of ${size} frames`)
        continue
      }
      for (let i = r.first; i <= r.last; i++) {
        if (!cover.has(i)) cover.set(i, [])
        cover.get(i).push(c)
      }
    }
    const firstWanted = test ? Math.min(...(cover.size ? cover.keys() : [0])) : 0
    const lastWanted = test ? Math.max(...(cover.size ? cover.keys() : [-1])) : total - 1
    const missing = []
    for (let i = firstWanted; i <= lastWanted; i++) if (!cover.has(i)) missing.push(i)
    for (const g of ranges(missing)) problems.push(`${w}: frames ${span(g.first, g.last)} are covered by no chunk`)
    if (test && !cover.size) problems.push(`${w}: no test chunk was found`)

    const chosen = new Map()
    for (const c of [...list].sort((a, b) => a.record.first - b.record.first)) {
      const first = chosen.get(c.record.first)
      if (!first) {
        if (cover.has(c.record.first)) chosen.set(c.record.first, c)
        continue
      }
      const a = first.record
      const b = c.record
      const differing = []
      for (let i = 0; i < Math.min(a.frameHashes?.length ?? 0, b.frameHashes?.length ?? 0); i++) if (a.frameHashes[i] !== b.frameHashes[i]) differing.push(a.first + i)
      if (differing.length || a.last !== b.last) {
        conflicts.push({ a: first, b: c, frames: differing })
        problems.push(`${w}: ${named(first)} and ${named(c)} both cover frames ${span(a.first, Math.min(a.last, b.last))} and their frame hashes differ in ${differing.length} of them (the first is frame ${differing[0] ?? a.first})`)
      } else if (a.sha256 !== b.sha256 || who(a) !== who(b)) {
        twice += b.frameHashes.length
        if (who(a) !== who(b)) twiceByTwoMachines += b.frameHashes.length
      }
    }
    const ordered = [...chosen.values()].sort((a, b) => a.record.first - b.record.first)
    for (const c of ordered) parts.push({ ...c, offset: frames - firstWanted })
    frames += lastWanted - firstWanted + 1
  }
  return { ok: problems.length === 0, problems, conflicts, parts, frames, twice, twiceByTwoMachines }
}

export function coverReport(chunks, totals, size = M.chunkFrames) {
  const out = []
  for (const w of WHATS) {
    const list = chunks.filter((c) => c.record?.what === w && !c.record.test)
    const total = totals[w] ?? 0
    const have = new Set()
    for (const c of list) for (let i = c.record.first; i <= c.record.last; i++) have.add(i)
    const missing = []
    for (let i = 0; i < total; i++) if (!have.has(i)) missing.push(i)
    out.push({ what: w, total, chunks: list.length, wanted: chunkLines(total, size).length, there: ranges([...have]), missing: ranges(missing) })
  }
  return out
}

export function readChunks(dirs, { recursive = true } = {}) {
  const out = []
  const seen = new Set()
  const walk = (dir, from) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (recursive && e.name !== '.git' && !e.name.startsWith('frames-')) walk(p, from)
        continue
      }
      if (!/-\d{6}-\d{6}\.json$/.test(e.name)) continue
      let record
      try {
        record = readJson(p)
      } catch {
        continue
      }
      if (!WHATS.includes(record.what) || !Number.isInteger(record.first) || !Number.isInteger(record.last)) continue
      const file = p.replace(/\.json$/, '.mp4')
      const real = fs.existsSync(file) ? fs.realpathSync(file) : file
      if (seen.has(real)) continue
      seen.add(real)
      const inside = path.relative(from, file).split(path.sep).join('/')
      out.push({ record, file, inside, test: inside.split('/').includes('test'), from: `${path.basename(from)}/${inside}` })
    }
  }
  for (const d of dirs) walk(d, d)
  return out
}

/**
 * The opening's pictures as `npm run opening -- --master` leaves them: `manifest.json` and `opening.bin`,
 * read only through `openPack` of tools/lib/openingpack.mjs. `frame(i)` gives the whole picture of film frame i as raw RGB.
 */
export async function openingPack(dir = rel('out', 'work', 'opening', 'master'), load = null) {
  const lib = rel('tools', 'lib', 'openingpack.mjs')
  if (!load && !fs.existsSync(lib)) throw new Error('tools/lib/openingpack.mjs is not in this checkout, so the opening cannot be read. It comes with the opening tool (npm run opening).')
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error(`${path.relative(rel(), dir)} holds no manifest.json. Make the opening's master pictures first: npm run opening -- --master`)
  const openPack = load ?? (await import(pathToFileURL(lib).href)).openPack
  const pack = await openPack(dir)
  for (const k of ['width', 'height', 'fps', 'frameCount']) if (!Number.isInteger(pack[k]) || pack[k] < 1) throw new Error(`the opening pack gives no ${k}`)
  return { name: 'master', width: pack.width, height: pack.height, fps: pack.fps, frameCount: pack.frameCount, frame: (i) => pack.frame(i) }
}

export function hours(seconds) {
  return seconds < 5400 ? `${(seconds / 60).toFixed(1)} min` : `${(seconds / 3600).toFixed(1)} h`
}

export function heartbeat({ chunk, frame, seconds, left, average, procs = 1 }) {
  return `chunk ${pad6(chunk.first)}-${pad6(chunk.last)} · frame ${frame} · ${seconds.toFixed(1)} s · ${left} frames left in the range · ${((left * average) / procs / 3600).toFixed(2)} h left at ${average.toFixed(1)} s a frame`
}

export function psnrOf(a, b) {
  if (a.length !== b.length) throw new Error('two pictures of different sizes cannot be compared')
  let sum = 0
  let maxDiff = 0
  let differing = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    if (d !== 0) {
      differing++
      sum += d * d
      const m = d < 0 ? -d : d
      if (m > maxDiff) maxDiff = m
    }
  }
  const mse = sum / a.length
  return { psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse), maxDiff, differing }
}

/** PSNR of the BT.709 luma of two rgb24 pictures: the measure a 4:2:0 encode can be held to. */
export function lumaPsnrOf(a, b) {
  if (a.length !== b.length) throw new Error('two pictures of different sizes cannot be compared')
  let sum = 0
  for (let i = 0; i < a.length; i += 3) {
    const d = 0.2126 * (a[i] - b[i]) + 0.7152 * (a[i + 1] - b[i + 1]) + 0.0722 * (a[i + 2] - b[i + 2])
    sum += d * d
  }
  const mse = sum / (a.length / 3)
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse)
}

export const dB = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : 'identical')

export function table(rows) {
  const cols = ['check', 'wanted', 'found', '']
  const data = rows.map((r) => [r.check, String(r.wanted), String(r.found), r.pass === null ? 'measured' : r.pass ? 'pass' : 'FAIL'])
  const w = cols.map((c, i) => Math.max(c.length, ...data.map((d) => d[i].length)))
  const line = (d) => d.map((x, i) => x.padEnd(w[i])).join('  ').trimEnd()
  return [line(cols), w.map((n) => '-'.repeat(n)).join('  '), ...data.map(line)].join('\n')
}
