import fs from 'node:fs'
import path from 'node:path'
import { cfg, formatById, currentSeasonHashes } from './page.mjs'
import { rel, readJson, writeJson } from './paths.mjs'
import { freeDiskGb, machineId } from './browser.mjs'
import { engineHash, fileSha } from './hashes.mjs'
import { addLook } from './looks.mjs'
import { encodeFrames, join, probe, timing, tmpDir, videoSettings } from './encode.mjs'
import { packLine, packServed } from './openingpack.mjs'

const CALLS = { film: 'renderFilmFrame', opening: 'renderOpeningFrame', loop: 'renderLoopFrame' }
const FRAMES_ROOT = rel('out', 'work', 'frames')
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_TAIL = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
const LOCAL_CHUNK_SECONDS = 2

export const short = (f) => {
  const r = path.relative(rel(), path.resolve(f))
  return r.startsWith('..') || path.isAbsolute(r) ? path.resolve(f) : r.split(path.sep).join('/')
}
export const minutes = (sec) => (sec < 90 ? `${Math.round(sec)} s` : sec < 5400 ? `${(sec / 60).toFixed(1)} min` : `${(sec / 3600).toFixed(1)} h`)
const pad = (i) => String(i).padStart(6, '0')

export function stepOf(fps) {
  const step = cfg.film.fps / fps
  if (!Number.isInteger(step) || step < 1) throw new Error(`film.fps is not a whole multiple of ${fps}`)
  return step
}

export function argText(args, key, fallback) {
  const v = args[key]
  return v === undefined || v === true ? fallback : String(v)
}

export function argFrame(args, key) {
  if (args[key] === undefined) return null
  const n = Number(args[key])
  if (args[key] === true || !Number.isInteger(n) || n < 0) throw new Error(`--${key} takes a frame index at film.fps`)
  return n
}

export function makeTrack({ kind, name, dir, format, tier, assets = 'full', fps, local = false, graphics = local, mbps = null, keep = [] }) {
  if (!(tier in cfg.tiers)) throw new Error(`no such tier: ${tier}`)
  if (!(assets in cfg.assetSets)) throw new Error(`no such asset set: ${assets}`)
  const f = formatById(format)
  const step = stepOf(fps)
  const maxFrames = local ? Math.min(cfg.sandbox.maxFramesOnDisk, Math.round(fps * LOCAL_CHUNK_SECONDS)) : cfg.sandbox.maxFramesOnDisk
  return { kind, name, dir, format: f, tier, assets, fps, step, local, graphics, maxFrames, keep, settings: videoSettings({ format: f, fps, local, mbps }) }
}

export function planChunks(track, spans, { first = null, last = null } = {}) {
  const out = []
  for (const s of spans) {
    const a = Math.ceil(Math.max(s.first, first ?? s.first) / track.step) * track.step
    const b = Math.min(s.last, last ?? s.last)
    const frames = []
    for (let i = a; i <= b; i += track.step) frames.push(i)
    for (let o = 0; o < frames.length; o += track.maxFrames) {
      const part = frames.slice(o, o + track.maxFrames)
      out.push({ id: s.id, first: part[0], last: part[part.length - 1], frames: part })
    }
  }
  return out
}

export const keptFrame = (track, index) => path.join(track.dir, `frame-${index}.png`)
export const chunkFile = (track, c) => path.join(track.dir, `chunk-${c.first}-${c.last}.${track.settings.container}`)

let current = null
const hashesNow = () => (current ??= { engine: engineHash(), seasons: currentSeasonHashes() })
const packs = new Map()
const packNow = (track) => {
  if (!packs.has(track.format.width)) packs.set(track.format.width, packServed(track.format.width))
  return packs.get(track.format.width)
}

function recordOk(r, track) {
  const now = hashesNow()
  if (!r || r.engineHash !== now.engine) return false
  for (const s of cfg.seasons) if (r.seasonHashes?.[s] !== now.seasons[s]) return false
  if (r.format !== track.format.id || r.tier !== track.tier || r.assets !== track.assets || (r.diagnostic ?? '') !== '') return false
  if (track.kind === 'opening') {
    const p = packNow(track)
    if (!p || r.pack !== p.name || r.packSha256 !== p.sha256) return false
  }
  return r.kind === track.kind && r.fps === track.fps && r.codec === track.settings.codec && r.mbps === track.settings.mbps && !!r.card === !!track.graphics
}

export function chunkRecord(file, track) {
  if (!fs.existsSync(file) || !fs.existsSync(`${file}.json`)) return null
  let r
  try {
    r = readJson(`${file}.json`)
  } catch {
    return null
  }
  return recordOk(r, track) ? r : null
}

export function chunksOnDisk(track) {
  if (!fs.existsSync(track.dir)) return { good: [], stale: [] }
  const good = []
  const stale = []
  const pattern = new RegExp(`^chunk-(\\d+)-(\\d+)\\.${track.settings.container}$`)
  for (const name of fs.readdirSync(track.dir)) {
    const m = name.match(pattern)
    if (!m) continue
    const file = path.join(track.dir, name)
    const record = chunkRecord(file, track)
    if (record && record.first === Number(m[1]) && record.last === Number(m[2])) good.push({ file, record, first: record.first, last: record.last, frames: record.frames })
    else stale.push(file)
  }
  good.sort((a, b) => a.first - b.first || b.last - a.last)
  return { good, stale }
}

export function coverOf(track) {
  const { good, stale } = chunksOnDisk(track)
  const parts = []
  const gaps = []
  const unused = []
  let next = null
  for (const c of good) {
    if (next !== null && c.first < next) {
      unused.push(c.file)
      continue
    }
    if (next !== null && c.first > next) gaps.push({ first: next, last: c.first - track.step })
    parts.push(c)
    next = c.last + track.step
  }
  const total = parts[0]?.record.total ?? 0
  const frames = parts.reduce((n, c) => n + c.frames, 0)
  const first = parts[0]?.first ?? 0
  const last = parts.length ? parts[parts.length - 1].last : -1
  const lastWanted = total > 0 ? Math.floor((total - 1) / track.step) * track.step : -1
  const sameTotal = parts.every((c) => c.record.total === total)
  const complete = parts.length > 0 && sameTotal && gaps.length === 0 && first === 0 && last === lastWanted
  return { parts, gaps, stale, unused, total, frames, first, last, lastWanted, complete, contiguous: parts.length > 0 && gaps.length === 0 }
}

function framesOnDisk() {
  const dirs = []
  if (!fs.existsSync(FRAMES_ROOT)) return dirs
  for (const name of fs.readdirSync(FRAMES_ROOT)) {
    const dir = path.join(FRAMES_ROOT, name)
    if (!fs.statSync(dir).isDirectory()) continue
    dirs.push({ dir, count: fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length, at: fs.statSync(dir).mtimeMs })
  }
  return dirs
}

function makeRoom(mine, wanted) {
  const others = framesOnDisk().filter((d) => d.dir !== mine).sort((a, b) => a.at - b.at)
  let held = others.reduce((n, d) => n + d.count, 0)
  const dropped = []
  while (others.length && (held + wanted > cfg.sandbox.maxFramesOnDisk || freeDiskGb() < cfg.sandbox.minFreeDiskGb)) {
    const d = others.shift()
    fs.rmSync(d.dir, { recursive: true, force: true })
    held -= d.count
    dropped.push(short(d.dir))
  }
  if (wanted > cfg.sandbox.maxFramesOnDisk) throw new Error(`a chunk of ${wanted} frames is over sandbox.maxFramesOnDisk`)
  if (freeDiskGb() < cfg.sandbox.minFreeDiskGb) {
    fs.rmSync(tmpDir(), { recursive: true, force: true })
    fs.rmSync(rel('out', 'work', 'simcache'), { recursive: true, force: true })
    if (freeDiskGb() < cfg.sandbox.minFreeDiskGb) throw new Error(`only ${freeDiskGb().toFixed(1)} GB of disk is free, under sandbox.minFreeDiskGb`)
  }
  return dropped
}

function pngOk(file, format) {
  let fd
  try {
    const size = fs.statSync(file).size
    if (size < 64) return false
    fd = fs.openSync(file, 'r')
    const head = Buffer.alloc(24)
    const tail = Buffer.alloc(8)
    fs.readSync(fd, head, 0, 24, 0)
    fs.readSync(fd, tail, 0, 8, size - 8)
    return head.subarray(0, 8).equals(PNG_HEAD) && tail.equals(PNG_TAIL) && head.readUInt32BE(16) === format.width && head.readUInt32BE(20) === format.height
  } catch {
    return false
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

function checkPng(buffer, format, what) {
  if (!buffer.subarray(0, 8).equals(PNG_HEAD)) throw new Error(`${what} did not come back as a picture`)
  const w = buffer.readUInt32BE(16)
  const h = buffer.readUInt32BE(20)
  if (w !== format.width || h !== format.height) throw new Error(`${what} is ${w} x ${h}, not ${format.width} x ${format.height}`)
}

export class Run {
  constructor(session, { by = 'builder', looks = true, say = console.log } = {}) {
    this.session = session
    this.by = by
    this.looks = looks
    this.say = say
    this.pages = new Map()
    this.started = Date.now()
    this.lastLook = Date.now()
    this.lookCount = 0
    this.rendered = 0
    this.renderMs = 0
    this.pending = 0
    this.lastFrame = null
    this.errors = []
  }

  async page(track) {
    const key = `${track.format.id}|${track.assets}`
    if (!this.pages.has(key)) {
      for (const [k, p] of this.pages) {
        await p.context().close()
        this.pages.delete(k)
      }
      this.pages.set(key, await this.session.page({ format: track.format.id, assets: track.assets }))
    }
    return this.pages.get(key)
  }

  async plan(track) {
    const page = await this.page(track)
    return page.evaluate(() => {
      const sc = window.showcase
      let loopPlan = null
      let openingPlan = null
      try {
        loopPlan = sc.dev.loopPlan()
        openingPlan = sc.dev.openingPlan()
      } catch {}
      return { film: sc.film(), opening: sc.opening().frameCount, loop: sc.loop().frameCount, loopPlan, openingPlan, info: sc.info() }
    })
  }

  look(track, index, file) {
    if (!this.looks) return
    const what = track.kind === 'film' ? 'Film B' : track.kind === 'opening' ? 'The opening of film A' : 'The card loop'
    addLook(file, `${what}, frame ${index} at ${cfg.film.fps} frames a second, ${track.format.id}, ${track.tier}`, this.by, { copy: true })
    this.lastLook = Date.now()
    this.lookCount++
  }

  async frame(track, page, index) {
    const call = CALLS[track.kind]
    await page.evaluate(([c, i, t]) => window.showcase[c](i, t), [call, index, track.tier])
    const png = track.kind === 'opening' ? await this.session.grabStage(page) : await this.session.grab(page)
    checkPng(png, track.format, `${track.name} frame ${index}`)
    return png
  }

  async renderChunks(track, chunks, total, each = null) {
    const todo = chunks.filter((c) => !chunkRecord(chunkFile(track, c), track))
    for (const c of chunks) if (!todo.includes(c)) this.say(`chunk ${c.first}-${c.last} (${c.id}): reused ${short(chunkFile(track, c))}`)
    this.pending += todo.reduce((n, c) => n + c.frames.length, 0)
    const made = []
    for (const c of todo) {
      made.push(await this.renderChunk(track, c, total))
      if (each) each(made[made.length - 1], todo.length - made.length)
    }
    return made
  }

  async renderChunk(track, c, total) {
    const file = chunkFile(track, c)
    const dir = path.join(FRAMES_ROOT, `${track.name}-${track.format.id}-${track.tier}-${c.first}-${c.last}`)
    const page = await this.page(track)
    const info0 = await page.evaluate(() => window.showcase.info())
    const pack = track.kind === 'opening' ? packNow(track) : null
    const from = pack ? { pack: pack.name, packSha256: pack.sha256 } : {}
    const key = { engineHash: info0.engineHash, seasonHashes: info0.seasonHashes, format: track.format.id, tier: track.tier, assets: info0.assets, kind: track.kind, card: !!track.graphics, browser: this.session.browserVersion, ...from }
    const keyFile = path.join(dir, 'frames.json')
    if (fs.existsSync(dir) && !(fs.existsSync(keyFile) && JSON.stringify(readJson(keyFile)) === JSON.stringify(key))) fs.rmSync(dir, { recursive: true, force: true })
    const dropped = makeRoom(dir, c.frames.length)
    if (dropped.length) this.say(`dropped frames left by other chunks to stay under sandbox.maxFramesOnDisk: ${dropped.join(', ')}`)
    fs.mkdirSync(dir, { recursive: true })
    writeJson(keyFile, key)
    const t0 = Date.now()
    let kept = 0
    let beat = Date.now()
    const files = []
    for (const index of c.frames) {
      const f = path.join(dir, `${pad(index)}.png`)
      files.push(f)
      if (pngOk(f, track.format)) {
        kept++
        this.pending--
        continue
      }
      const s = Date.now()
      const png = await this.frame(track, page, index)
      fs.writeFileSync(`${f}.tmp`, png)
      fs.renameSync(`${f}.tmp`, f)
      this.renderMs += Date.now() - s
      this.rendered++
      this.pending--
      this.lastFrame = { track, index, file: f }
      if (Date.now() - this.lastLook >= cfg.status.minGapMinutes * 60000) this.look(track, index, f)
      if (Date.now() - beat >= cfg.sandbox.chunkBudgetMinutes * 60000) {
        beat = Date.now()
        this.say(`chunk ${c.first}-${c.last} (${c.id}): ${files.length} of ${c.frames.length} frames so far, ${this.perFrame().toFixed(2)} s a frame, about ${minutes(this.left())} left in this run`)
      }
    }
    const renderSeconds = (Date.now() - t0) / 1000
    if (this.looks && this.lookCount === 0 && this.lastFrame?.track === track && fs.existsSync(this.lastFrame.file)) this.look(track, this.lastFrame.index, this.lastFrame.file)
    const e0 = Date.now()
    await encodeFrames({ files, settings: track.settings, out: `${file}.new` })
    const seen = probe(`${file}.new`)
    if (seen.frames !== files.length || seen.width !== track.format.width || seen.height !== track.format.height) {
      fs.rmSync(`${file}.new`, { force: true })
      throw new Error(`chunk ${c.first}-${c.last} was encoded with ${seen.frames} frames at ${seen.width} x ${seen.height}, not ${files.length} at ${track.format.width} x ${track.format.height}`)
    }
    const info = await page.evaluate(() => window.showcase.info())
    if (pack) {
      const drawn = await page.evaluate(() => document.getElementById('opening')?.dataset.pack ?? '')
      if (drawn && drawn !== pack.name) throw new Error(`the page drew the opening from the ${drawn} pack, and the tools expected the ${pack.name} pack`)
      if (this.packSaid !== pack.name) this.say(packLine(pack.name, track.format))
      this.packSaid = pack.name
    }
    const errors = page.errors.slice(0, 20)
    for (const e of errors) if (!this.errors.includes(e)) this.errors.push(e)
    const record = this.session.record(info, {
      kind: track.kind,
      name: track.name,
      shot: c.id,
      first: c.first,
      last: c.last,
      step: track.step,
      fps: track.fps,
      frames: files.length,
      total,
      codec: track.settings.codec,
      mbps: track.settings.mbps,
      gopSeconds: track.settings.gopSeconds,
      card: !!track.graphics,
      framesReused: kept,
      renderSeconds,
      encodeSeconds: (Date.now() - e0) / 1000,
      secondsPerFrame: files.length > kept ? renderSeconds / (files.length - kept) : 0,
      bytes: seen.bytes,
      sha256: fileSha(`${file}.new`),
      standIns: info.standIns.length,
      counts: info.counts,
      errors,
      ...from,
    })
    record.tier = track.tier
    for (const index of c.frames) {
      if (!track.keep.includes(index)) continue
      const to = keptFrame(track, index)
      fs.copyFileSync(path.join(dir, `${pad(index)}.png`), to)
      writeJson(`${to}.json`, { ...record, index, chunk: short(file), sha256: fileSha(to), bytes: fs.statSync(to).size })
    }
    fs.renameSync(`${file}.new`, file)
    writeJson(`${file}.json`, record)
    fs.rmSync(dir, { recursive: true, force: true })
    this.say(`chunk ${c.first}-${c.last} (${c.id}): ${files.length} frames done${kept ? `, ${kept} of them found on disk` : ''}, ${this.perFrame().toFixed(2)} s a frame, ${(seen.bytes / 1e6).toFixed(2)} MB, about ${minutes(this.left())} left in this run`)
    return { file, record }
  }

  perFrame() {
    return this.rendered ? this.renderMs / 1000 / this.rendered : 0
  }

  left() {
    return this.pending * this.perFrame()
  }

  async close() {
    for (const p of this.pages.values()) {
      for (const e of p.errors) if (!this.errors.includes(e)) this.errors.push(e)
      await p.context().close()
    }
    this.pages.clear()
  }
}

export async function joinCovers({ covers, out, container, fps, sound = null, extra = {} }) {
  const parts = covers.flatMap((c) => c.parts)
  if (!parts.length) throw new Error('no chunk matches the current build, so there is nothing to join')
  const frames = parts.reduce((n, c) => n + c.frames, 0)
  const seconds = frames / fps
  await join({ parts: parts.map((c) => ({ file: c.file, frames: c.frames })), out: `${out}.new`, container, fps, sound })
  const seen = probe(`${out}.new`)
  const timed = timing(`${out}.new`, fps)
  if (seen.frames !== frames || !timed.even) {
    fs.rmSync(`${out}.new`, { force: true })
    throw new Error(seen.frames !== frames ? `the joined file holds ${seen.frames} frames, its chunks hold ${frames}` : `the joined file's frames are not evenly spaced: one is ${timed.worstMs.toFixed(2)} ms off its place`)
  }
  const r0 = parts[0].record
  const machines = [...new Set(parts.map((c) => c.record.machine))]
  const record = {
    engineHash: r0.engineHash,
    seasonHashes: r0.seasonHashes,
    format: r0.format,
    tier: r0.tier,
    assets: r0.assets,
    diagnostic: '',
    browser: r0.browser,
    graphics: r0.graphics,
    machine: machines.length === 1 ? machines[0] : machines,
    joinedOn: machineId(),
    time: new Date().toISOString(),
    fps,
    frames,
    seconds,
    chunks: parts.map((c) => ({ file: short(c.file), kind: c.record.kind, shot: c.record.shot, first: c.first, last: c.last, frames: c.frames, sha256: c.record.sha256, machine: c.record.machine })),
    sound: sound ? { file: short(sound.file), sha256: fileSha(sound.file), offsetSeconds: sound.offsetSeconds } : null,
    probe: seen,
    worstFrameOffsetMs: Math.round(timed.worstMs * 1000) / 1000,
    sha256: fileSha(`${out}.new`),
    ...extra,
  }
  fs.renameSync(`${out}.new`, out)
  writeJson(`${out}.json`, record)
  return { file: out, record, probe: seen }
}

export function coverNotes(cover, track, say = console.log) {
  for (const f of cover.stale) say(`left out ${short(f)}: its record does not match the current build`)
  for (const f of cover.unused) say(`left out ${short(f)}: another chunk already covers its frames`)
  for (const g of cover.gaps) say(`${track.name}: no chunk for frames ${g.first} to ${g.last}`)
  if (track.kind === 'opening') for (const name of new Set(cover.parts.map((p) => p.record.pack))) say(packLine(name, track.format))
  if (cover.parts.length && !cover.complete) {
    if (cover.first > 0) say(`${track.name}: no chunk for frames 0 to ${cover.first - track.step}`)
    if (cover.last < cover.lastWanted) say(`${track.name}: no chunk for frames ${cover.last + track.step} to ${cover.lastWanted}`)
  }
}

export function soundStart(opening, body) {
  const a = opening?.parts.length ? opening : null
  const b = body?.parts.length ? body : null
  if (a && b) return { contiguous: a.contiguous && a.last === a.lastWanted && b.contiguous && b.first === 0, offsetSeconds: a.first / cfg.film.fps }
  const only = a ?? b
  return { contiguous: !!only && only.contiguous, offsetSeconds: only ? only.first / cfg.film.fps : 0 }
}

export function pickSound(candidates) {
  for (const c of candidates) if (c && fs.existsSync(c)) return c
  return null
}
