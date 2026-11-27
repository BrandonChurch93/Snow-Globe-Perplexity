import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import { loadConfig, readJson, rel, writeJson } from './paths.mjs'

const cfg = loadConfig()
export const M = cfg.deliver.master
export const FPS = cfg.film.fps
export const RENDERED = ['film-b', 'loop']
export const WHATS = [...RENDERED, 'opening']
export const JOINS = { 'film-b': ['film-b'], 'film-a': ['opening', 'film-b'], loop: ['loop'] }
export const SOUND = { 'film-b': 'film-b', 'film-a': 'film-a', loop: null }
export const STILL_MAX_MB = 20
export const MEAN_SLACK = 1
export const UHD_PROC_GB = 4.1
export const UHD_SPARE_GB = 2
export const SIZE_AIM = 0.985
export const MUX_KBPS = 12

/** What deliver.master must hold for the intermediate chunks and the final encode. The list is empty when it does. */
export function masterConfigProblems(m = M) {
  const out = []
  const num = (v) => typeof v === 'number' && Number.isFinite(v)
  const i = m.intermediate
  const f = m.final
  if (!i) out.push('deliver.master.intermediate is missing')
  else {
    if (!num(i.crf) || i.crf < 0 || i.crf > 30) out.push(`deliver.master.intermediate.crf (${i.crf}) is not a quality from 0 to 30`)
    if (typeof i.preset !== 'string') out.push('deliver.master.intermediate.preset is missing')
    if (!num(i.minPsnr) || i.minPsnr < 30) out.push(`deliver.master.intermediate.minPsnr (${i.minPsnr}) is not a floor in dB, 30 or more`)
    if (!num(i.partMb) || i.partMb <= 0 || i.partMb > 50) out.push(`deliver.master.intermediate.partMb (${i.partMb}) is not above 0 and at most 50, the size one attachment may be`)
  }
  if (!f) out.push('deliver.master.final is missing')
  else {
    if (typeof f.preset !== 'string') out.push('deliver.master.final.preset is missing')
    if (f.passes !== 2) out.push(`deliver.master.final.passes (${f.passes}) is not 2`)
    for (const w of ['film-a', 'film-b']) if (!num(f.targetMb?.[w]) || f.targetMb[w] <= 0 || f.targetMb[w] > cfg.platform.maxFileMb) out.push(`deliver.master.final.targetMb.${w} (${f.targetMb?.[w]}) is not above 0 and at most platform.maxFileMb ${cfg.platform.maxFileMb}`)
    if (!Number.isInteger(f.keyint) || !Number.isInteger(f.minKeyint) || f.minKeyint < 1 || f.keyint < f.minKeyint) out.push(`deliver.master.final.keyint (${f.keyint}) is under deliver.master.final.minKeyint (${f.minKeyint}), or one of them is not a whole number of frames`)
    if (!Number.isInteger(f.refs) || f.refs < 1 || f.refs > 5) out.push(`deliver.master.final.refs (${f.refs}) is not 1 to 5, what level 5.2 holds at 3840 x 2160`)
    if (!Number.isInteger(f.bframes) || f.bframes < 0 || f.bframes > 16) out.push(`deliver.master.final.bframes (${f.bframes}) is not 0 to 16`)
    if (![0, 1, 2, 3].includes(f.aqMode)) out.push(`deliver.master.final.aqMode (${f.aqMode}) is not 0 to 3`)
    if (!num(f.minPsnr)) out.push('deliver.master.final.minPsnr is missing')
    if (!num(f.loop?.crf) || !num(f.loop?.crfStep) || !num(f.loop?.minCrf) || f.loop.crfStep <= 0 || f.loop.minCrf > f.loop.crf) out.push('deliver.master.final.loop needs crf, crfStep above 0 and minCrf at most crf')
    if (!num(f.loop?.seamDb) || f.loop.seamDb <= 0) out.push('deliver.master.final.loop.seamDb is missing')
  }
  if (m.video?.maxrateMbps > 300 || m.video?.bufsizeMbps > 300) out.push(`deliver.master.video is wider than level 5.2 allows the High profile (300 Mbit a second, 300 Mbit of buffer)`)
  return out
}

export const intermediateVideo = (m = M) => ({ ...m.video, preset: m.intermediate.preset, crf: m.intermediate.crf })

/** The picture's bit rate that makes a film of targetMb megabytes (of a million bytes) with its sound, aimed a little under. */
export function finalKbps({ targetMb, seconds, audioKbps = 0, aim = SIZE_AIM }) {
  if (!(targetMb > 0) || !(seconds > 0)) throw new Error('a size and a length above zero are needed to work out a bit rate')
  const kbps = ((targetMb * 8000) / seconds) * aim - audioKbps - MUX_KBPS
  if (!(kbps > 0)) throw new Error(`${targetMb} MB over ${seconds.toFixed(2)} s leaves no bits for the picture after ${audioKbps} kbps of sound`)
  return Math.floor(kbps)
}

export const partName = (name, k, n) => `${name}.part-${String(k).padStart(2, '0')}-of-${String(n).padStart(2, '0')}`

/** Where to cut a file of `bytes` so that no part is over `partMb` megabytes: as few parts as that takes, of even size. */
export function partPlan(bytes, partMb) {
  const max = Math.floor(partMb * 1e6)
  if (!(max > 0)) throw new Error('a part must be allowed some size')
  const n = Math.max(1, Math.ceil(bytes / max))
  const each = Math.ceil(bytes / n)
  return Array.from({ length: n }, (_, k) => ({ k: k + 1, n, start: k * each, bytes: Math.min(each, bytes - k * each) }))
}

function shaOfFile(file) {
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
export const bigSha = shaOfFile

/** Cuts a file into numbered parts in `dir`. Gives the whole file's sha256 and each part's. */
export function splitFile(file, dir, partMb) {
  const bytes = fs.statSync(file).size
  const plan = partPlan(bytes, partMb)
  fs.mkdirSync(dir, { recursive: true })
  const fd = fs.openSync(file, 'r')
  const parts = []
  try {
    for (const p of plan) {
      const buf = Buffer.allocUnsafe(p.bytes)
      let got = 0
      while (got < p.bytes) {
        const n = fs.readSync(fd, buf, got, p.bytes - got, p.start + got)
        if (!n) throw new Error(`${file} ended before its ${bytes} bytes were read`)
        got += n
      }
      const name = partName(path.basename(file), p.k, p.n)
      fs.writeFileSync(path.join(dir, `${name}.tmp`), buf)
      fs.renameSync(path.join(dir, `${name}.tmp`), path.join(dir, name))
      parts.push({ file: name, bytes: p.bytes, sha256: crypto.createHash('sha256').update(buf).digest('hex') })
    }
  } finally {
    fs.closeSync(fd)
  }
  return { file: path.basename(file), bytes, sha256: shaOfFile(file), parts }
}

/** Every file of a folder with its sha256, whatever it is called: a file that came by attachment may have lost its name. */
export function hashFolder(dir, skip = () => false) {
  const out = new Map()
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && !skip(p)) out.set(shaOfFile(p), p)
    }
  }
  if (fs.existsSync(dir)) walk(dir)
  return out
}

/**
 * Puts a file together again from parts found by their sha256. `wanted` is { bytes, sha256, parts } as splitFile gave it,
 * or with no parts for a file that travelled whole. Nothing is written unless the whole file's sha256 is the one wanted.
 */
export function unsplitFile(wanted, have, out, { move = false } = {}) {
  const whole = have.get(wanted.sha256)
  const parts = wanted.parts?.length ? wanted.parts : null
  if (whole) {
    if (path.resolve(whole) !== path.resolve(out)) {
      fs.mkdirSync(path.dirname(out), { recursive: true })
      if (move) fs.renameSync(whole, out)
      else fs.copyFileSync(whole, out)
    }
    return { ok: true, from: [whole], missing: [] }
  }
  if (!parts) return { ok: false, from: [], missing: ['the file itself'], why: 'no file with its sha256 is here' }
  const missing = parts.map((p, k) => (have.has(p.sha256) ? null : `part ${k + 1} of ${parts.length}${p.file ? ` (${p.file})` : ''}`)).filter(Boolean)
  if (missing.length) return { ok: false, from: [], missing, why: `${missing.length} of its ${parts.length} parts ${missing.length === 1 ? 'is' : 'are'} not here` }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const tmp = `${out}.joining`
  const fd = fs.openSync(tmp, 'w')
  try {
    for (const p of parts) fs.writeSync(fd, fs.readFileSync(have.get(p.sha256)))
  } finally {
    fs.closeSync(fd)
  }
  const seen = shaOfFile(tmp)
  if (seen !== wanted.sha256 || fs.statSync(tmp).size !== wanted.bytes) {
    fs.rmSync(tmp, { force: true })
    return { ok: false, from: [], missing: [], why: `its ${parts.length} parts are all here and together they are ${seen.slice(0, 12)}, not the ${String(wanted.sha256).slice(0, 12)} its record names` }
  }
  fs.renameSync(tmp, out)
  const from = parts.map((p) => have.get(p.sha256))
  if (move) for (const f of from) fs.rmSync(f, { force: true })
  return { ok: true, from, missing: [] }
}

export const chunkName = (c) => `${c.record.what} ${c.record.first} to ${c.record.last}${c.record.test ? ' (a test)' : ''}, drawn on ${c.record.machine}`

export function isChunkRecord(file) {
  try {
    if (fs.statSync(file).size > 1e6) return null
    const r = readJson(file)
    return WHATS.includes(r.what) && Number.isInteger(r.first) && Number.isInteger(r.last) && typeof r.sha256 === 'string' && Array.isArray(r.frameHashes) ? r : null
  } catch {
    return null
  }
}

/**
 * Takes what came by attachment, in any order and under any names, out of one flat folder: records are filed under
 * `dir`, every picture is found by its sha256, parts are put together, and nothing is placed that is not the file its record names.
 */
export function takeFiles(folder, dir, { keep = false } = {}) {
  if (!fs.existsSync(folder)) throw new Error(`--files ${folder} does not exist`)
  if (path.resolve(folder) === path.resolve(dir) || path.resolve(folder).startsWith(path.resolve(dir) + path.sep)) throw new Error('--files takes the folder the attachments were saved in, which is not inside the folder that is collected into')
  const idOf = (r) => `${r.test ? 'test ' : ''}${r.what} ${r.first} ${r.last} ${r.sha256} ${r.machine} ${r.boot}`
  const known = new Set(readChunks([dir]).map((c) => idOf(c.record)))
  let records = 0
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        walk(p)
        continue
      }
      const r = isChunkRecord(p)
      if (!r) continue
      const id = idOf(r)
      if (!known.has(id)) {
        known.add(id)
        const to = path.join(dir, 'files', ...(r.test ? ['test'] : []), r.what, `${chunkStem(r.what, r.first, r.last)}.json`)
        let n = 1
        let free = to
        while (fs.existsSync(free)) free = path.join(dir, 'files', `again-${++n}`, ...(r.test ? ['test'] : []), r.what, path.basename(to))
        fs.mkdirSync(path.dirname(free), { recursive: true })
        fs.copyFileSync(p, free)
        records++
      }
      if (!keep) fs.rmSync(p, { force: true })
    }
  }
  walk(folder)
  const have = hashFolder(folder, (p) => !!isChunkRecord(p))
  const placed = new Map()
  const problems = []
  let whole = 0
  let fromParts = 0
  let stills = 0
  const filed = readChunks([dir])
  const isThere = new Map(filed.map((c) => [c.file, fs.existsSync(c.file) && fs.statSync(c.file).size === c.record.bytes && shaOfFile(c.file) === c.record.sha256]))
  const range = (c) => [c.record.test ? 't' : 'r', c.record.what, c.record.first, c.record.last, c.record.sha256].join('/')
  const laid = new Set()
  for (const c of filed) {
    if (!isThere.get(c.file)) continue
    placed.set(c.record.sha256, c.file)
    laid.add(range(c))
  }
  for (const c of filed) {
    const r = c.record
    const there = isThere.get(c.file)
    if (!there) {
      if (laid.has(range(c))) continue
      if (placed.has(r.sha256)) fs.copyFileSync(placed.get(r.sha256), c.file)
      else {
        const got = unsplitFile({ bytes: r.bytes, sha256: r.sha256, parts: r.parts }, have, c.file, { move: !keep })
        if (!got.ok) {
          problems.push(`${chunkName(c)}: ${got.why}${got.missing.length && r.parts?.length ? ` (${got.missing.join(', ')})` : ''}`)
          continue
        }
        if (got.from.length > 1) fromParts++
        else whole++
      }
    }
    placed.set(r.sha256, c.file)
    laid.add(range(c))
    if (r.still) {
      const to = path.join(path.dirname(c.file), r.still.file)
      if (!(fs.existsSync(to) && shaOfFile(to) === r.still.sha256)) {
        const got = unsplitFile({ bytes: r.still.bytes, sha256: r.still.sha256 }, have, to, { move: !keep })
        if (got.ok) {
          stills++
        } else problems.push(`${chunkName(c)}: its screenshot ${r.still.file} is not here`)
      }
    }
  }
  const named = new Set(readChunks([dir]).flatMap((c) => [c.record.sha256, c.record.still?.sha256, ...(c.record.parts ?? []).map((p) => p.sha256)]))
  const strangers = [...have].filter(([sha, f]) => !named.has(sha) && fs.existsSync(f)).map(([, f]) => f)
  return { records, whole, fromParts, stills, problems, strangers }
}

/** The files one chunk sends by attachment, and the messages of at most `most` attachments they make. */
export function sendGroups(files, most = 10) {
  const out = []
  for (let i = 0; i < files.length; i += most) out.push(files.slice(i, i + most))
  return out
}

/** The best run of `span` frames, by its mean, of a list of one number a frame. */
export function bestRun(list, span) {
  if (!list.length) return null
  const n = Math.min(span, list.length)
  let sum = 0
  for (let i = 0; i < n; i++) sum += list[i]
  let best = sum
  let at = 0
  for (let i = n; i < list.length; i++) {
    sum += list[i] - list[i - n]
    if (sum > best) {
      best = sum
      at = i - n + 1
    }
  }
  return { first: at, last: at + n - 1, mean: best / n }
}

export function psnrFacts(list, first = 0) {
  if (!list.length) return { least: 0, leastFrame: first, mean: 0 }
  let least = Infinity
  let at = 0
  let sum = 0
  list.forEach((v, i) => {
    sum += v
    if (v < least) {
      least = v
      at = i
    }
  })
  return { least: Math.round(least * 100) / 100, leastFrame: first + at, mean: Math.round((sum / list.length) * 100) / 100 }
}

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

const GIB = 2 ** 30
const gib = (bytes) => Math.round((bytes / GIB) * 10) / 10

/**
 * What this process may really use. A pod can show its node's memory and cores to os.totalmem() and os.cpus()
 * and be held far under them by its cgroup, so the cgroup's own files are read first: memory.max and cpu.max
 * (v2) of the path in /proc/self/cgroup and of every folder above it, the least of them; the v1 names where
 * a machine still has those. read(path) gives a file's text, or null when it is not there.
 * @param {{ cgroup?: string, read?: (file: string) => string | null, totalmem: number, cpus: number }} facts
 */
export function readLimits({ cgroup = '', read = () => null, totalmem, cpus }) {
  const above = (p) => {
    const parts = p.split('/').filter(Boolean)
    return parts.map((_, i) => `/${parts.slice(0, parts.length - i).join('/')}`).concat('')
  }
  const lines = cgroup.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(':')).filter((l) => l.length >= 3).map((l) => ({ controllers: l[1].split(','), path: l.slice(2).join(':') }))
  const v2 = lines.find((l) => l.controllers.join('') === '')
  const v1 = (name) => lines.find((l) => l.controllers.includes(name))
  let mem = Infinity
  let cpu = Infinity
  if (v2) {
    for (const p of above(v2.path)) {
      const m = (read(`/sys/fs/cgroup${p}/memory.max`) ?? '').trim()
      if (/^\d+$/.test(m)) mem = Math.min(mem, Number(m))
      const c = /^(\d+)\s+(\d+)$/.exec((read(`/sys/fs/cgroup${p}/cpu.max`) ?? '').trim())
      if (c && Number(c[2]) > 0) cpu = Math.min(cpu, Number(c[1]) / Number(c[2]))
    }
  }
  if (v1('memory')) {
    for (const p of above(v1('memory').path)) {
      const m = (read(`/sys/fs/cgroup/memory${p}/memory.limit_in_bytes`) ?? '').trim()
      if (/^\d+$/.test(m)) mem = Math.min(mem, Number(m))
    }
  }
  if (v1('cpu')) {
    for (const p of above(v1('cpu').path)) {
      const dir = `/sys/fs/cgroup/${v1('cpu').controllers.join(',')}${p}`
      const quota = Number((read(`${dir}/cpu.cfs_quota_us`) ?? '').trim())
      const period = Number((read(`${dir}/cpu.cfs_period_us`) ?? '').trim())
      if (quota > 0 && period > 0) cpu = Math.min(cpu, quota / period)
    }
  }
  const capped = { memory: mem < totalmem, cpus: cpu < cpus }
  return {
    memoryBytes: capped.memory ? mem : totalmem,
    cpus: capped.cpus ? Math.round(cpu * 100) / 100 : cpus,
    memoryFrom: capped.memory ? 'cgroup' : 'machine',
    cpusFrom: capped.cpus ? 'cgroup' : 'machine',
    machineMemoryBytes: totalmem,
    machineCpus: cpus,
  }
}

export function machineLimits() {
  const read = (p) => {
    try {
      return fs.readFileSync(p, 'utf8')
    } catch {
      return null
    }
  }
  return readLimits({ cgroup: read('/proc/self/cgroup') ?? '', read, totalmem: os.totalmem(), cpus: os.availableParallelism?.() ?? os.cpus().length })
}

export function limitsLine(l) {
  const mem = `${gib(l.memoryBytes)} GiB of memory${l.memoryFrom === 'cgroup' ? ` (the cgroup's memory.max; the machine shows ${gib(l.machineMemoryBytes)} GiB)` : ''}`
  const cpu = `${l.cpus} ${l.cpus === 1 ? 'CPU' : 'CPUs'}${l.cpusFrom === 'cgroup' ? ` (the cgroup's cpu.max; the machine shows ${l.machineCpus})` : ''}`
  return `limits: ${mem}, ${cpu}`
}

export const limitsRecord = (l) => ({ memoryGiB: gib(l.memoryBytes), cpus: l.cpus, memoryFrom: l.memoryFrom, cpusFrom: l.cpusFrom, machineMemoryGiB: gib(l.machineMemoryBytes), machineCpus: l.machineCpus })

/** The most render processes the memory holds at the master's size: each about UHD_PROC_GB (measured at 24 samples), and UHD_SPARE_GB kept for the encoder and the system. */
export const procsMemoryHolds = (memoryBytes) => Math.max(1, Math.floor((memoryBytes / GIB - UHD_SPARE_GB) / UHD_PROC_GB))

export function procsProblem(procs, format, limits) {
  if (procs < 2 || format !== M.format) return null
  const most = procsMemoryHolds(limits.memoryBytes)
  if (procs <= most) return null
  return `--procs ${procs} is refused: this process may use ${gib(limits.memoryBytes)} GiB (${limits.memoryFrom === 'cgroup' ? "its cgroup's memory.max" : "the machine's memory"}) and one ${format} render holds about ${UHD_PROC_GB} GB, with ${UHD_SPARE_GB} GB kept for the encoder and the system. More than the memory holds gets browsers killed, and a killed graphics process draws nothing. The most here is --procs ${most}.`
}

/** A plain line when more than one render process is asked for, or null. No count is promised: what a second and a third bring differs from machine to machine. */
export function procsGainLine(procs, limits) {
  if (procs < 2) return null
  return `--procs ${procs} on ${limits.cpus} ${limits.cpus === 1 ? 'CPU' : 'CPUs'}: the best count depends on the machine. Measure it with --procs 1, 2 and 3 on three chunks before a long run, and keep the count that gives the most frames an hour.`
}

export const NOT_A_NUMBER = 'NOT A NUMBER'
export const NAN_MEASURE = "window.showcase.dev.sanity(): the values in the picture's mean that are no number, counted before the lens and the grade"

/** The first place of a value that is no number as the page names it, { x, y, channel, kind }, or null when it names none. */
export function firstPlace(v) {
  if (!v || !Number.isInteger(v.x) || !Number.isInteger(v.y) || typeof v.channel !== 'string' || typeof v.kind !== 'string') return null
  return { x: v.x, y: v.y, channel: v.channel, kind: v.kind }
}
const firstText = (v) => (firstPlace(v) ? `, the first at ${v.x}, ${v.y} (${v.channel}, ${v.kind})` : '')

/**
 * What a chunk's record holds about values that are no number: one total, the frames where the count is not 0, and the frames whose count was never read.
 * A frame entry keeps `first`, the place and kind of the first such value by rows from the top, when the page named one.
 * @param {{ index: number, notNumber?: number, sanityMs?: number, notNumberFirst?: any }[]} frames
 * @param {string | null} [precision]
 */
export function notNumberRecord(frames, precision = null) {
  const read = frames.filter((f) => typeof f.notNumber === 'number')
  const ms = read.filter((f) => typeof f.sanityMs === 'number').map((f) => f.sanityMs)
  return {
    total: read.reduce((n, f) => n + f.notNumber, 0),
    frames: read.filter((f) => f.notNumber > 0).map((f) => ({ frame: f.index, count: f.notNumber, ...(firstPlace(f.notNumberFirst) ? { first: firstPlace(f.notNumberFirst) } : {}) })),
    unread: frames.filter((f) => typeof f.notNumber !== 'number').map((f) => f.index),
    measure: NAN_MEASURE,
    ...(precision ? { precision, blind: precision === 'byte' } : {}),
    msAFrame: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null,
  }
}

/** The frames of a record that hold values that are no number, or null when it holds none. The mark alone is enough. */
export function notNumberOf(record) {
  const frames = Array.isArray(record?.notNumber?.frames) ? record.notNumber.frames.filter((f) => f.count > 0) : []
  const total = Number(record?.notNumber?.total) || 0
  if (record?.mark !== NOT_A_NUMBER && total <= 0 && !frames.length) return null
  return { total, frames }
}

/** True when nothing says whether a chunk's frames held values that are no number: it was drawn before the tool read the count, or some of its frames were. */
export const notNumberUnknown = (record) => record?.what !== 'opening' && (!record?.notNumber || (record.notNumber.unread ?? []).length > 0 || record.notNumber.blind === true)

const nanFramesShort = (n) => (n.frames.length ? n.frames.map((f) => `${f.frame} (${f.count})`).join(', ') : 'not named')
const nanFrames = (n) => (n.frames.some((f) => firstPlace(f.first)) ? n.frames.map((f) => `${f.frame} (${f.count})${firstText(f.first)}`).join('; ') : nanFramesShort(n))
/** The marked frames of a record in words: each with its count and, when the record holds it, the first place. */
export const notNumberFrames = (record) => nanFrames(notNumberOf(record) ?? { frames: [] })
export function notNumberLine(chunk) {
  const r = chunk.record
  const n = notNumberOf(r)
  return `${chunk.from ?? chunk.file} (${r.what} ${r.first} to ${r.last}, drawn on ${r.machine}) holds ${n.total} ${n.total === 1 ? 'value that is' : 'values that are'} no number in ${n.frames.length} ${n.frames.length === 1 ? 'frame' : 'frames'}: ${nanFrames(n)}`
}
export const notNumberLoud = (what, index, count, first = /** @type {any} */ (null)) => `${NOT_A_NUMBER}: ${what} frame ${index} holds ${count} ${count === 1 ? 'value that is' : 'values that are'} no number in its mean${firstText(first)}, before the lens and the grade. Its chunk is marked ${NOT_A_NUMBER} and no master is encoded from it. Tell /root the frame. Do not draw it again hoping: the same frame draws the same values.`

const shipMark = (record) => {
  const n = notNumberOf(record)
  return n ? `${NOT_A_NUMBER} in ${n.frames.length === 1 ? 'frame' : 'frames'} ${nanFramesShort(n)}` : ''
}
/** The message of the commit that carries a chunk's record and look to its machine's branch. A marked chunk says so in its first line. */
export function shipTitle(what, c, record, test = false) {
  const mark = shipMark(record)
  return `Chunk ${chunkStem(what, c.first, c.last)}${test ? ', a test' : ''}${mark ? `, ${mark}: never encoded into a master` : ''}`
}
export function shippedLine(what, c, record, branch, tries = 1) {
  const mark = shipMark(record)
  return `shipped the record and the look of ${chunkStem(what, c.first, c.last)}${mark ? `, marked ${mark},` : ''} to ${branch}${tries > 1 ? `, the push went through at try ${tries}` : ''} (the picture travels by attachment)`
}

/** --local starts the installed Chrome in a window, with the machine's graphics card. Without a display it cannot open. */
export function localProblem(local, platform = process.platform, env = process.env) {
  if (!local || platform !== 'linux' || env.DISPLAY || env.WAYLAND_DISPLAY) return null
  return '--local is refused: it starts the installed Chrome in a window, with the graphics card of this machine, and no display is here (DISPLAY and WAYLAND_DISPLAY are not set). On a machine without a screen leave --local off: the software renderer draws without a window. With a virtual screen, start it under xvfb-run.'
}

/** A file of JSON that is never seen half written: written under another name, then renamed. */
export function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`
  writeJson(tmp, value)
  fs.renameSync(tmp, file)
}

/** A picture of nothing real, for the tool's own tests: a smooth ramp that moves with the frame. Never flat. */
export function standInPicture(width, height, index) {
  const rgb = Buffer.alloc(width * height * 3)
  for (let y = 0, o = 0; y < height; y++) {
    const g = Math.round((255 * y) / (height - 1))
    for (let x = 0; x < width; x++, o += 3) {
      rgb[o] = Math.round((255 * x) / (width - 1))
      rgb[o + 1] = g
      rgb[o + 2] = (index * 8) % 256
    }
  }
  return rgb
}

/** The line a stopped render ends on: which chunk, which frame, and why. The parent reads it back from a worker with stoppedAt. */
export const stoppedLine = (c, index, why) => `stopped at chunk ${pad6(c.first)}-${pad6(c.last)}, frame ${index}: ${String(why).split('\n')[0]}`
export function stoppedAt(line) {
  const m = /stopped at chunk (\d{6})-(\d{6}), frame (\d+): (.*)$/m.exec(line)
  return m ? { first: Number(m[1]), last: Number(m[2]), frame: Number(m[3]), why: m[4] } : null
}

/** The command line as it was typed, without what the tool adds for its own workers. */
export function sameCommand(argv) {
  const kept = argv.filter((a, i) => a !== '--worker' && argv[i - 1] !== '--worker')
  return `npm run master -- ${kept.map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, "'\\''")}'`)).join(' ')}`
}

export const LOOK_WIDTH = 1200

export const pad6 = (i) => String(i).padStart(6, '0')
export const chunkStem = (what, first, last) => `${what}-${pad6(first)}-${pad6(last)}`
/**
 * The tier a frame of `samples` samples is drawn at. Under a rule with `evenFromPx` it is `final-N`: the final tier's own
 * picture, even sample times in a frame that travels, with the count that was read from the page. Otherwise `samples-N`.
 */
export const tierOf = (samples, rule = /** @type {any} */ (null)) => `${rule?.motion?.evenFromPx !== undefined ? 'final' : 'samples'}-${samples}`

/**
 * The count of samples a frame of a master is drawn with. Without --samples the base is deliver.master.samples of the piece
 * and the motion is tiers.final.motion, the rule the page applies at the final tier, so the page is asked what that tier
 * gives for each frame. The two bases must be one number, or the page's answer would not be the master's. With --samples N
 * (a test) every frame takes N and no motion applies.
 */
export function sampleRule(what, given = /** @type {any} */ (undefined), c = cfg) {
  if (given !== undefined) return { base: given, motion: null, tier: null }
  const base = c.deliver.master.samples[what]
  const final = c.tiers.final
  if (base !== final.samplesPerFrame) throw new Error(`deliver.master.samples.${what} is ${base} and tiers.final.samplesPerFrame is ${final.samplesPerFrame}. The count of a master frame follows its motion by the rule of the final tier, which starts from the final tier's count, so the two must be one number. Nothing was drawn.`)
  const m = final.motion
  return { base, motion: m ? { spacingPx: m.spacingPx, maxSamplesPerFrame: m.maxSamplesPerFrame, ...(m.evenFromPx !== undefined ? { evenFromPx: m.evenFromPx } : {}), ...(m.spreadFromPx !== undefined ? { spreadFromPx: m.spreadFromPx } : {}), ...(m.spreadFullPx !== undefined ? { spreadFullPx: m.spreadFullPx } : {}) } : null, tier: 'final' }
}

/** What the page says a frame takes: a whole count, never under the base, never over the rule's most. */
export function ruleCount(rule, index, given) {
  const n = given?.samples
  const most = rule.motion ? Math.max(rule.base, rule.motion.maxSamplesPerFrame) : rule.base
  if (!Number.isInteger(n) || n < rule.base || n > most) throw new Error(`the page gave ${JSON.stringify(given ?? null)} as the samples of frame ${index}, and the rule gives a whole count from ${rule.base} to ${most}. Run npm run build and render again.`)
  return n
}

/** The facts of a list of counts: how many are over the base, the most and where, the sum. */
export function countFacts(counts, base, first = 0) {
  let over = 0
  let most = base
  let mostAt = null
  let sum = 0
  counts.forEach((n, i) => {
    sum += n
    if (n > base) over++
    if (n > most) {
      most = n
      mostAt = first + i
    }
  })
  return { frames: counts.length, over, most, mostAt, sum }
}

export function countsLine(rule, facts) {
  const s = (n) => `${n} ${n === 1 ? 'sample' : 'samples'}`
  const how = rule.motion ? `the count of a frame follows its motion (tiers.final.motion: a sample every ${rule.motion.spacingPx} px of travel, at most ${rule.motion.maxSamplesPerFrame}${rule.motion.evenFromPx !== undefined ? `, even sample times from ${rule.motion.evenFromPx} px of travel` : ''}${rule.motion.spreadFromPx !== undefined ? `, a spread from ${rule.motion.spreadFromPx} px` : ''}${rule.motion.spreadFullPx !== undefined ? `, the full spread from ${rule.motion.spreadFullPx} px` : ''})` : rule.tier ? 'tiers.final holds no motion, so no frame follows its motion' : 'the count was given with --samples, so no frame follows its motion'
  if (!facts.over) return `${how}: ${facts.frames === 1 ? 'the one frame draws' : `every one of these ${facts.frames} frames draws`} the base of ${s(rule.base)}`
  return `${how}: ${facts.over} of these ${facts.frames} frames ${facts.over === 1 ? 'draws' : 'draw'} more than the base of ${s(rule.base)}, the most is ${facts.most} (frame ${facts.mostAt}); ${facts.sum} samples in all, ${(facts.sum / (facts.frames * rule.base)).toFixed(2)} times the base`
}
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
export function stillToDo(chunks, { done, has, sweep }) {
  return chunks
    .filter((c) => !done(c))
    .map((c) => {
      sweep?.(c)
      return { ...c, missing: framesOf(c).filter((i) => !has(c, i)) }
    })
}

export function split(chunks, procs, worker) {
  return chunks.filter((_, i) => i % procs === worker)
}

export function totalsFromCut(cut = readJson(rel('cut', 'CUTLIST.json'))) {
  return { 'film-b': cut.frameCount, opening: cut.opening?.frameCount ?? 0, loop: cut.loop?.frameCount ?? Math.round(cfg.deliver.cardLoop.seconds * FPS) }
}

/** A list of encoder arguments without its quality: a chunk that missed the floor is encoded again at a lower crf and is the same picture. */
export function butCrf(list) {
  if (!Array.isArray(list)) return list
  const i = list.indexOf('-crf')
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 2)]
}

/** The crf an intermediate chunk was encoded at, from its record. */
export const crfOf = (r) => {
  const i = Array.isArray(r?.encoderArgs) ? r.encoderArgs.indexOf('-crf') : -1
  return i < 0 ? null : Number(r.encoderArgs[i + 1])
}

/** The qualities a chunk is tried at: the one asked, then lower by `step` until it passes its floor, down to 0. */
export function crfLadder(crf, step = 2) {
  const out = []
  for (let q = crf; q > 0; q -= step) out.push(q)
  if (crf > 0) out.push(0)
  return out.length ? out : [0]
}

export function recordMatchesRun(r, want) {
  if (!r) return false
  for (const k of ['what', 'first', 'last', 'engineHash', 'samples', 'format', 'fps']) if (r[k] !== want[k]) return false
  if (want.renderer !== undefined && r.renderer !== want.renderer) return false
  if (want.calibration !== undefined && (r.calibration ?? null) !== want.calibration) return false
  if (!!r.test !== !!want.test) return false
  if (want.motion !== undefined) {
    if (JSON.stringify(r.motion ?? null) !== JSON.stringify(want.motion)) return false
    if (!Array.isArray(r.frameSamples) || r.frameSamples.length !== want.last - want.first + 1 || r.frameSamples.some((n) => !Number.isInteger(n) || n < want.samples)) return false
  }
  if (JSON.stringify(butCrf(r.encoderArgs)) !== JSON.stringify(butCrf(want.encoderArgs))) return false
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

const TAKE_USAGE = '--take takes BRANCH, or WHAT:FIRST-LAST=BRANCH for one range, several with commas between'
/** `--take agent/p6-chunks-a` or `--take film-b:0-29=agent/p6-chunks-a,film-b:30-59=files`: whose chunk is taken where the holders of a range do not agree. */
export function parseTake(text) {
  if (text === undefined || text === null || text === false) return []
  if (text === true || !String(text).trim()) throw new Error(TAKE_USAGE)
  return String(text)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((item) => {
      const m = /^([a-z-]+):(\d+)-(\d+)=(.+)$/.exec(item)
      if (m && WHATS.includes(m[1])) return { what: m[1], first: Number(m[2]), last: Number(m[3]), holder: m[4] }
      if (item.includes('=') || item.includes(':')) throw new Error(`${TAKE_USAGE}. Not understood: ${item}`)
      return { what: null, first: null, last: null, holder: item }
    })
}

const AGREE = [
  ['engineHash', 'the build hash'],
  ['calibration', 'the calibration picture'],
]
const BYTES = ['sha256', 'the sha256 of the intermediate']
const brief = (v) => (typeof v === 'string' && v.length > 16 ? v.slice(0, 12) : v === undefined || v === null ? 'none' : String(v))
const holderName = (c) => c.holder ?? c.from ?? c.file
const holderLabel = (c) => `${holderName(c)} (${c.record.machine ?? 'no machine named'})`
const samePixels = (a, b) => {
  const x = a.record.frameHashes ?? []
  const y = b.record.frameHashes ?? []
  const differing = []
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) differing.push(a.record.first + i)
  return differing
}
const sameCounts = (a, b) => {
  const x = a.record.frameSamples
  const y = b.record.frameSamples
  if (!Array.isArray(x) && !Array.isArray(y)) return []
  const differing = []
  for (let i = 0; i <= a.record.last - a.record.first; i++) if (x?.[i] !== y?.[i]) differing.push(a.record.first + i)
  return differing
}

/**
 * One entry a range (what, first, last), whoever holds it and however often. Holders agree when the build hash and the calibration
 * picture are the same and the pixels of every frame are the same, also when their intermediates differ in bytes. They count as one
 * and one is taken: a holder whose picture is there, and of intermediates that differ in bytes the first by name. Holders that do
 * not agree are taken only as `take` names them.
 * @param {any[]} chunks
 * @param {{ take?: { what: string | null, first: number | null, last: number | null, holder: string }[], exists?: ((file: string) => boolean) | null }} [how]
 */
export function heldRanges(chunks, { take = [], exists = null } = {}) {
  const groups = new Map()
  for (const c of chunks) {
    const r = c.record
    const key = `${r.test ? 'test ' : ''}${r.what} ${r.first} ${r.last}`
    if (!groups.has(key)) groups.set(key, { what: r.what, first: r.first, last: r.last, test: !!r.test, holders: [] })
    groups.get(key).holders.push(c)
  }
  const out = []
  for (const g of groups.values()) {
    const hs = g.holders
    const values = ([key, label]) => {
      const seen = new Map()
      for (const c of hs) {
        const v = brief(c.record[key])
        if (!seen.has(v)) seen.set(v, [])
        seen.get(v).push(c)
      }
      return seen.size > 1 ? { key, label, values: [...seen].map(([value, cs]) => ({ value, holders: cs.map(holderName) })) } : null
    }
    const differ = AGREE.map(values).filter(Boolean)
    const bytes = values(BYTES)
    const n = g.last - g.first + 1
    const hashed = (c) => Array.isArray(c.record.frameHashes) && c.record.frameHashes.length === n
    const blind = bytes ? hs.filter((c) => !hashed(c)).map(holderName) : []
    const pixels = [...new Set(hs.slice(1).flatMap((c) => (hashed(hs[0]) && hashed(c) ? samePixels(hs[0], c) : [])))].sort((a, b) => a - b)
    const counts = [...new Set(hs.slice(1).flatMap((c) => sameCounts(hs[0], c)))].sort((a, b) => a - b)
    const agree = differ.length === 0 && pixels.length === 0 && blind.length === 0 && counts.length === 0
    const ranged = take.filter((t) => t.what === g.what && t.first === g.first && t.last === g.last)
    let taken = null
    let named = null
    let wrong = null
    let passed = null
    if (hs.length === 1) taken = hs[0]
    else if (agree) {
      const byName = bytes ? [...hs].sort((x, y) => (holderName(x) < holderName(y) ? -1 : holderName(x) > holderName(y) ? 1 : 0)) : hs
      const asked = bytes && ranged.length === 1 ? hs.find((c) => holderName(c) === ranged[0].holder) : null
      if (asked) named = ranged[0].holder
      taken = asked ?? (exists && byName.find((c) => exists(c.file))) ?? byName[0]
      if (bytes && !asked && taken !== byName[0]) passed = holderName(byName[0])
    } else {
      const general = take.filter((t) => t.what === null && hs.some((c) => holderName(c) === t.holder))
      const asked = ranged.length ? ranged : general
      const names = [...new Set(asked.map((t) => t.holder))]
      if (names.length === 1) {
        taken = hs.find((c) => holderName(c) === names[0]) ?? null
        if (taken) named = names[0]
        else wrong = `--take names ${names[0]}, which does not hold it`
      } else if (names.length > 1) wrong = `--take names ${names.length} of its holders (${names.join(', ')}); name one for this range`
    }
    out.push({ ...g, agree, differ, bytes, blind, pixels, counts, taken, named, wrong, passed })
  }
  return out
}

/** The holder of a range whose record is marked: the one taken, or one that holds the very same pixels. Null when none is. */
export function markedHolder(g) {
  const of = g.taken ?? g.holders[0]
  if (notNumberOf(of.record)) return of
  const same = (c) => c !== of && Array.isArray(c.record.frameHashes) && Array.isArray(of.record.frameHashes) && samePixels(of, c).length === 0
  return g.holders.find((c) => notNumberOf(c.record) && (!g.taken || same(c))) ?? null
}

const rangeName = (g) => `${g.what} ${g.first} to ${g.last}${g.test ? ' (a test)' : ''}`
const valuesBy = (d) => d.values.map((v) => `${v.value} in ${v.holders.join(' and ')}`).join(', ')
const howTheyDiffer = (g) => {
  const parts = g.differ.map((d) => `${d.label} is ${valuesBy(d)}`)
  const n = g.last - g.first + 1
  if (g.blind.length) parts.push(`the pixels of their frames cannot be compared (${g.blind.join(' and ')} ${g.blind.length === 1 ? 'names' : 'name'} no hash for each of the ${n} frames) and the intermediates differ in bytes`)
  else if (g.pixels.length) parts.push(`the pixels of their frames differ in ${g.pixels.length} of ${n} (the first is frame ${g.pixels[0]})`)
  else parts.push(`the pixels of their frames are the same in all ${n}`)
  if (g.counts?.length) parts.push(`the count of samples a frame was drawn with differs in ${g.counts.length} of ${n} (the first is frame ${g.counts[0]})`)
  const text = parts.join('; ')
  return text.slice(0, 1).toUpperCase() + text.slice(1)
}

/** The one line of a range that more than one holds. */
export function heldLine(g) {
  const n = g.holders.length
  const frames = g.last - g.first + 1
  const who = g.holders.map(holderLabel).join('; ')
  if (g.agree && !g.bytes) return `${rangeName(g)} is held ${n} times with one and the same record (build, calibration, intermediate): ${who}. It counts once and one is taken: ${holderName(g.taken)}`
  if (g.agree) {
    const which = g.named ? `the one named is taken: ${g.named}` : g.passed ? `${holderName(g.taken)} is taken, since the picture of ${g.passed}, the first by name, is not here` : `the first by name is taken: ${holderName(g.taken)}`
    return `${rangeName(g)} is held ${n} times with the same build, the same calibration and the same pixels in all ${frames} frames${g.holders.every((c) => Array.isArray(c.record.frameSamples)) ? ', each drawn with the same count of samples' : ''}: ${who}. Their intermediates differ in bytes (sha256 ${valuesBy(g.bytes)}). It counts once and ${which}`
  }
  const how = `${rangeName(g)} is held ${n} times and the records do not agree: ${who}. ${howTheyDiffer(g)}`
  if (g.taken) return `${how}. Taken as named: ${g.named}`
  return `${how}. ${n === 2 ? 'Neither' : 'None'} is taken${g.wrong ? ` (${g.wrong})` : ''}. Name the one to take: ${g.holders.map((c) => `--take ${g.what}:${g.first}-${g.last}=${holderName(c)}`).join(' or ')}`
}

/**
 * Decides whether a set of chunk records can be joined, with no file read except through `sha`.
 * `chunks` is [{ record, file, from }]. `totals` holds the frame count of each part.
 */
export function joinPlan({ which, chunks, totals, test = false, size = M.chunkFrames, sha = null, gaps = false, take = [], exists = null }) {
  const whats = JOINS[which]
  if (!whats) throw new Error(`--encode takes ${Object.keys(JOINS).join(', ')}`)
  const problems = []
  const conflicts = []
  const parts = []
  let twice = 0
  let twiceByTwoMachines = 0
  const named = (c) => `${c.from ?? c.file}`
  const held = heldRanges(chunks.filter((c) => whats.includes(c.record?.what)), { take, exists })
  const mine = held.filter((g) => g.taken).map((g) => g.taken)
  const markedBy = new Map(held.filter((g) => g.taken).map((g) => [g.taken, markedHolder(g)]))
  for (const g of held) {
    const others = g.holders.filter((c) => c !== (g.taken ?? g.holders[0]))
    const a = (g.taken ?? g.holders[0]).record
    if (!g.taken) {
      problems.push(heldLine(g))
      if (g.pixels.length) conflicts.push({ a: g.holders[0], b: g.holders[1], frames: g.pixels })
      continue
    }
    for (const c of others) {
      const b = c.record
      if (samePixels(g.taken, c).length) continue
      if (a.sha256 !== b.sha256 || who(a) !== who(b)) {
        twice += b.frameHashes?.length ?? 0
        if (who(a) !== who(b)) twiceByTwoMachines += b.frameHashes?.length ?? 0
      }
    }
  }

  for (const c of mine) {
    const r = c.record
    if (!test && r.test) problems.push(`${named(c)} is marked test (it was rendered with --samples or --format), and a test chunk is never joined into a master`)
    if (test && !r.test) problems.push(`${named(c)} is not marked test, and a test join takes test chunks only`)
    if (sha) {
      const seen = sha(c.file)
      if (seen !== r.sha256) problems.push(`${named(c)} does not match the sha256 in its record (${seen ? `it is ${seen.slice(0, 12)}, the record says ${String(r.sha256).slice(0, 12)}` : 'the mp4 is missing'})`)
    }
    if (!Array.isArray(r.frameHashes) || r.frameHashes.length !== r.last - r.first + 1) problems.push(`${named(c)} holds ${r.frameHashes?.length ?? 0} frame hashes for ${r.last - r.first + 1} frames`)
    if (r.what !== 'opening' && (!Array.isArray(r.frameSamples) || r.frameSamples.length !== r.last - r.first + 1)) problems.push(`${named(c)} names no count of samples for each of its ${r.last - r.first + 1} frames, so nothing says its frames were drawn with the count their motion asks for`)
    if (r.verify?.ok !== true) problems.push(`${named(c)} was never verified against its frames`)
    const marked = markedBy.get(c)
    const nan = marked ? notNumberOf(marked.record) : null
    if (nan) problems.push(`${named(marked)} is marked ${NOT_A_NUMBER}: ${nan.total} ${nan.total === 1 ? 'value' : 'values'} in ${nan.frames.length === 1 ? 'frame' : 'frames'} ${nanFrames(nan)}. It is never encoded into a master: the frame is mended in the engine and drawn again by a new build`)
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
  same('encoderArgs', 'the list of encoder arguments (but for the quality)', mine, (r) => butCrf(r.encoderArgs))
  for (const w of whats) same('samples', `the samples of ${w}`, mine.filter((c) => c.record.what === w))
  for (const w of whats) same('motion', `the rule from motion to samples of ${w}`, mine.filter((c) => c.record.what === w), (r) => r.motion ?? null)
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
    for (const g of held) if (!g.taken && g.what === w) for (let i = g.first; i <= g.last; i++) cover.set(i, [])
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
    if (!(test && gaps)) for (const g of ranges(missing)) problems.push(`${w}: frames ${span(g.first, g.last)} are covered by no chunk`)
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
      const differing = samePixels(first, c)
      conflicts.push({ a: first, b: c, frames: differing })
      problems.push(`${w}: ${named(first)} and ${named(c)} both cover frames ${span(a.first, Math.min(a.last, b.last))} and are not one range (${span(a.first, a.last)} and ${span(b.first, b.last)})`)
    }
    const ordered = [...chosen.values()].sort((a, b) => a.record.first - b.record.first)
    for (const c of ordered) parts.push({ ...c, offset: frames - firstWanted })
    frames += lastWanted - firstWanted + 1
  }
  let at = 0
  for (const p of parts) {
    p.at = at
    at += p.record.last - p.record.first + 1
  }
  return { ok: problems.length === 0, problems, conflicts, parts, frames: test && gaps ? at : frames, twice, twiceByTwoMachines }
}

/** `chunks` are the ones taken, `open` the ranges held by several whose records do not agree. A range counts once, whoever holds it. */
export function coverReport(chunks, totals, size = M.chunkFrames, open = []) {
  const out = []
  for (const w of WHATS) {
    const list = chunks.filter((c) => c.record?.what === w && !c.record.test)
    const total = totals[w] ?? 0
    const have = new Set()
    for (const c of list) for (let i = c.record.first; i <= c.record.last; i++) have.add(i)
    const held = new Set()
    for (const g of open) if (g.what === w && !g.test) for (let i = g.first; i <= g.last; i++) if (!have.has(i)) held.add(i)
    const missing = []
    for (let i = 0; i < total; i++) if (!have.has(i) && !held.has(i)) missing.push(i)
    out.push({ what: w, total, chunks: new Set(list.map((c) => `${c.record.first} ${c.record.last}`)).size, wanted: chunkLines(total, size).length, there: ranges([...have]), missing: ranges(missing), notAgreed: ranges([...held]) })
  }
  return out
}

const branchNames = (dir) => {
  try {
    return new Map(Object.keys(readJson(path.join(dir, 'collected.json')).branches ?? {}).map((b) => [branchFolder(b), b]))
  } catch {
    return new Map()
  }
}
/** Who holds a chunk: the branch it was fetched from, the attachments (`files`), or the folder itself (`out/master`). */
function holderOf(root, inside, names) {
  const lead = inside.split('/').slice(0, -2).filter((x) => x !== 'test')
  if (lead.length === 1 && names.has(lead[0])) return names.get(lead[0])
  if (lead.length) return lead.join('/')
  const here = path.relative(rel(), root).split(path.sep).join('/')
  return here && !here.startsWith('..') ? here : path.basename(root)
}

export function readChunks(dirs, { recursive = true } = {}) {
  const out = []
  const seen = new Set()
  const names = new Map()
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
      out.push({ record, file, inside, test: inside.split('/').includes('test'), from: `${path.basename(from)}/${inside}`, holder: holderOf(from, inside, names.get(from)) })
    }
  }
  for (const d of dirs) {
    names.set(d, branchNames(d))
    walk(d, d)
  }
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

export function heartbeat({ chunk, frame, seconds, left, average, procs = 1, samples = /** @type {any} */ (undefined), samplesLeft = 0, perSample = 0 }) {
  if (samples !== undefined) return `chunk ${pad6(chunk.first)}-${pad6(chunk.last)} · frame ${frame} · ${samples} ${samples === 1 ? 'sample' : 'samples'} · ${seconds.toFixed(1)} s · ${left} frames left in the range (${samplesLeft} samples) · ${((samplesLeft * perSample) / procs / 3600).toFixed(2)} h left at ${perSample.toFixed(2)} s a sample (${average.toFixed(1)} s a frame in the mean so far)`
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

const row = (check, wanted, found, pass) => ({ check, wanted, found, pass })
export const COLOUR_TAGS = 'bt709 / bt709 / bt709 / tv'

/** The rows of the proof of one finished encode, from what was measured on the file. A row passes, fails, or is only measured (null). */
export function encodeProofRows(f) {
  const rows = []
  const fps = f.fps ?? FPS
  rows.push(row('frames', f.wantFrames, f.frames, f.frames === f.wantFrames))
  rows.push(row('every frame decodes', 'no decode errors', f.decodeErrors.length ? f.decodeErrors.join(' / ') : 'none', f.decodeErrors.length === 0))
  rows.push(row('size of the picture', `${f.format.width} x ${f.format.height}`, `${f.width} x ${f.height}`, f.width === f.format.width && f.height === f.format.height))
  rows.push(row('pts steps', `every one 1/${fps} s`, f.steps.off ? `${f.steps.off} of ${f.steps.count} are not, the first ${f.steps.firstOff.toFixed(6)} s` : `${f.steps.count} of 1/${fps} s, the first frame at ${f.steps.start} s`, f.steps.off === 0 && f.steps.start === 0))
  rows.push(row('frame rate', `${fps}/1 constant`, `${f.rFrameRate} and ${f.avgFrameRate} on average`, f.rFrameRate === `${fps}/1` && f.avgFrameRate === `${fps}/1`))
  rows.push(row('pixel format', M.video.pixFmt, f.pixFmt, f.pixFmt === M.video.pixFmt))
  rows.push(row('colour tags', COLOUR_TAGS, f.tags, f.tags === COLOUR_TAGS))
  const level = Math.round(Number(M.video.level) * 10)
  rows.push(row('codec', `h264 High, level ${M.video.level}`, `${f.codec} ${f.profile}, level ${(f.level / 10).toFixed(1)}`, f.codec === 'h264' && f.profile === 'High' && f.level === level))
  rows.push(row('reference frames', `at most ${M.final.refs}, what level ${M.video.level} holds at this size`, f.refs ?? 'not read from the stream', f.refs >= 1 && f.refs <= M.final.refs))
  const gaps = f.keys.map((k, i) => (i + 1 < f.keys.length ? f.keys[i + 1] : f.frames) - k)
  const widest = Math.max(0, ...gaps)
  const keyint = f.keyint ?? M.final.keyint
  rows.push(row('key frames', `the first frame is one, and none more than ${keyint} frames after the last`, `${f.keys.length}, at most ${widest} frames apart`, f.keys[0] === 0 && widest <= keyint))
  if (f.sound.wanted) {
    const a = f.sound
    rows.push(row('sound', `aac, ${cfg.audio.sampleRate} Hz, 2 channels`, a.codec ? `${a.codec}, ${a.sampleRate} Hz, ${a.channels} channels` : 'none', a.codec === 'aac' && a.sampleRate === cfg.audio.sampleRate && a.channels === 2))
    rows.push(row('sound bit rate', `${M.audioKbps} kbps asked, within a quarter under`, `${(a.kbps ?? 0).toFixed(0)} kbps`, a.kbps >= M.audioKbps * 0.75 && a.kbps <= M.audioKbps * 1.1))
    rows.push(row('sound length', `within 1/${fps} s of the picture`, a.codec ? `${a.seconds.toFixed(4)} s against ${a.pictureSeconds.toFixed(4)} s` : 'none', !!a.codec && Math.abs(a.seconds - a.pictureSeconds) <= 1 / fps + 1e-6))
  } else rows.push(row('sound', 'no sound track at all', f.sound.codec ?? 'none', !f.sound.codec))
  rows.push(row('flat frames', f.flatAllowed ? `none but the ${f.flatAllowed} the opening pack holds` : '0', String(f.flat), f.flat <= f.flatAllowed))
  rows.push(row('starts fast', 'the index before the pictures', f.fast ? 'yes' : 'no', f.fast))
  const mbs = f.bytes / 1e6
  if (f.targetMb) rows.push(row('file size', `at most ${f.targetMb} MB, the target (platform.maxFileMb is ${cfg.platform.maxFileMb})`, `${mbs.toFixed(1)} MB`, mbs <= f.targetMb && mbs < cfg.platform.maxFileMb))
  else rows.push(row('file size', `under platform.maxFileMb ${cfg.platform.maxFileMb} MB`, `${mbs.toFixed(1)} MB`, mbs < cfg.platform.maxFileMb))
  rows.push(row('luma PSNR against the chunks', `every frame ${f.minPsnr} dB or more from its decoded intermediate`, `least ${f.psnr.least} dB at frame ${f.psnr.leastFrame}, mean ${f.psnr.mean} dB`, f.psnr.least >= f.minPsnr))
  if (f.bestHold) rows.push(row('the best hold', 'measured, the best second by its mean', `frames ${f.bestHold.first} to ${f.bestHold.last}, ${dB(f.bestHold.mean)} dB`, null))
  if (f.opening) rows.push(row("the opening's frames", f.test ? 'counted' : f.opening.wanted, f.opening.found, f.test ? null : f.opening.found === f.opening.wanted))
  if (f.loop) {
    const l = f.loop
    rows.push(row("the loop against film B's best hold", l.wanted === null ? 'every frame as close to its picture as the best second of film B' : `every frame ${dB(l.wanted)} dB or more, the best second of film B`, l.wanted === null ? 'the record of film B is not here' : `least ${f.psnr.least} dB at frame ${f.psnr.leastFrame}`, l.wanted === null ? (f.test ? null : false) : f.psnr.least >= l.wanted))
    rows.push(row('the wrap', `the last frame within ${l.seamDb} dB of the first, each against its own frame of the decoded intermediate`, `frame 0 ${dB(l.first)} dB, frame ${f.frames - 1} ${dB(l.last)} dB`, Math.abs(l.first - l.last) <= l.seamDb))
  }
  return rows
}

export function table(rows) {
  const cols = ['check', 'wanted', 'found', '']
  const data = rows.map((r) => [r.check, String(r.wanted), String(r.found), r.pass === null ? 'measured' : r.pass ? 'pass' : 'FAIL'])
  const w = cols.map((c, i) => Math.max(c.length, ...data.map((d) => d[i].length)))
  const line = (d) => d.map((x, i) => x.padEnd(w[i])).join('  ').trimEnd()
  return [line(cols), w.map((n) => '-'.repeat(n)).join('  '), ...data.map(line)].join('\n')
}
