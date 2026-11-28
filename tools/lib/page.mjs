import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { launch, machineId, pinnedBrowser, watchPage, ensureDir, freeDiskGb, rendererName, sameRenderer } from './browser.mjs'
import { serve } from './server.mjs'
import { loadConfig, rel, writeJson, readJson } from './paths.mjs'
import { engineHash, buildAssetIndex } from './hashes.mjs'
import { flatHint, goneHint, lostHint } from './lost-context.mjs'

export const cfg = loadConfig()
export const formatById = (id) => {
  const f = Object.values(cfg.formats).find((x) => x.id === id)
  if (!f) throw new Error(`no such format: ${id}`)
  return f
}

export function requireBuild() {
  const stamp = rel('dist', 'build.json')
  const hash = engineHash()
  if (!fs.existsSync(stamp) || readJson(stamp).engineHash !== hash) throw new Error('dist/ does not match the source. Run npm run build.')
  return hash
}

export function checkDisk() {
  const free = freeDiskGb()
  if (free >= cfg.sandbox.minFreeDiskGb) return free
  for (const d of ['simcache', 'frames', 'tmp']) fs.rmSync(rel('out', 'work', d), { recursive: true, force: true })
  const after = freeDiskGb()
  if (after < cfg.sandbox.minFreeDiskGb) throw new Error(`only ${after.toFixed(1)} GB of disk is free, under sandbox.minFreeDiskGb`)
  return after
}

const LOCK = rel('out', 'work', 'render.lock')
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function renderBusy() {
  if (!fs.existsSync(LOCK)) return null
  try {
    const l = readJson(LOCK)
    return alive(l.pid) && l.pid !== process.pid ? l : null
  } catch {
    return null
  }
}

export function lockWaitLine(busy, seconds) {
  const m = Math.floor(seconds / 60)
  return `waiting for the render that holds this clone's lock: ${busy.what} (pid ${busy.pid}), ${m === 0 ? 'from now' : `${m} min so far`}. Nothing is drawn here meanwhile and no time ends the wait. If pid ${busy.pid} is not a render of this clone, stop this and remove ${path.relative(rel(), LOCK)}.`
}

/** Waits while another render holds the lock, with one line at once and one a minute after. It gives up nothing. */
export async function waitForLock({ busy = renderBusy, wait = true, say = (line) => console.error(line), now = Date.now } = {}) {
  const t0 = now()
  let next = 0
  for (;;) {
    const holder = busy()
    if (!holder) return
    if (!wait) throw new Error(`a render job is running in this VM: ${holder.what} (pid ${holder.pid})`)
    const seconds = (now() - t0) / 1000
    if (seconds >= next) {
      say(lockWaitLine(holder, seconds))
      next = (Math.floor(seconds / 60) + 1) * 60
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
}

async function takeLock(what, wait, say) {
  ensureDir(path.dirname(LOCK))
  await waitForLock({ wait, say })
  writeJson(LOCK, { pid: process.pid, what, since: new Date().toISOString() })
}

function dropLock() {
  try {
    if (fs.existsSync(LOCK) && readJson(LOCK).pid === process.pid) fs.rmSync(LOCK)
  } catch {}
}
process.on('exit', dropLock)
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1))

export class Session {
  static async open({ local = false, headless = true, what = process.argv.slice(1).map((a) => path.basename(a)).join(' '), wait = true, say = /** @type {((line: string) => void) | undefined} */ (undefined) } = {}) {
    const s = new Session()
    s.hash = requireBuild()
    checkDisk()
    await takeLock(what, wait, say)
    s.server = await serve()
    try {
      s.browser = await launch({ local, headless })
    } catch (e) {
      // a browser that cannot start must not leave the server open, or the process never ends
      await s.server.close().catch(() => {})
      dropLock()
      throw e
    }
    s.browserVersion = s.browser.version()
    s.local = local
    s.pages = new Set()
    return s
  }

  async page({ format = cfg.formats.hd.id, noext = [], simcache = true, diag = '', assets = '', mode = 'capture', extra = '' } = {}) {
    const f = formatById(format)
    const context = await this.browser.newContext({ viewport: { width: f.width, height: f.height }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.setDefaultTimeout(0)
    const errors = watchPage(page)
    const q = new URLSearchParams({ mode, format })
    if (noext.length) q.set('noext', noext.join(','))
    if (simcache) q.set('simcache', '1')
    if (diag) q.set('diag', diag)
    if (assets) q.set('assets', assets)
    await page.goto(`${this.server.url}?${q}${extra}`)
    if (mode === 'capture') {
      await page.waitForFunction(() => !!window.showcase, null, { timeout: 60000 })
      await page.evaluate(() => window.showcase.ready)
    }
    page.on('crash', () => (page.crashed = true))
    await page.evaluate(() => {
      window.__contextLost = 0
      document.getElementById('view')?.addEventListener('webglcontextlost', () => window.__contextLost++)
    })
    this.pages.add(page)
    page.errors = errors
    return page
  }

  alive(page) {
    if (page.crashed || page.isClosed()) throw new Error(`the page crashed or closed while a picture was drawn (${goneHint()}). No picture was written.`)
    if (this.browser.isConnected && !this.browser.isConnected()) throw new Error(`the browser went away while a picture was drawn (${goneHint()}). No picture was written.`)
  }

  async contextLost(page) {
    return page.evaluate(() => {
      const c = document.getElementById('view')
      const gl = c ? (c.getContext('webgl2') ?? c.getContext('webgl')) : null
      return (window.__contextLost ?? 0) > 0 || (gl ? gl.isContextLost() : false)
    })
  }

  async grab(page) {
    this.alive(page)
    const r = await page.evaluate(() => {
      const c = document.getElementById('view')
      const gl = c.getContext('webgl2') ?? c.getContext('webgl')
      const lost = () => (window.__contextLost ?? 0) > 0 || (gl ? gl.isContextLost() : false)
      if (lost()) return { lost: 'before the picture was read back' }
      const data = c.toDataURL('image/png')
      return lost() ? { lost: 'while the picture was read back' } : { data }
    })
    this.alive(page)
    if (r.lost) throw new Error(`the WebGL context was lost ${r.lost} (${lostHint()}). No picture was written.`)
    return Buffer.from(r.data.slice(r.data.indexOf(',') + 1), 'base64')
  }

  async grabStage(page) {
    const box = await page.evaluate(() => {
      const r = document.getElementById('app').getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    this.alive(page)
    if (await this.contextLost(page)) throw new Error(`the WebGL context was lost before the picture was taken (${lostHint()}). No picture was written.`)
    const png = await page.screenshot({ type: 'png', clip: box, animations: 'disabled', caret: 'hide' })
    this.alive(page)
    if (await this.contextLost(page)) throw new Error(`the WebGL context was lost while the picture was taken (${lostHint()}). No picture was written.`)
    return png
  }

  record(info, extra = {}) {
    return {
      engineHash: info.engineHash,
      seasonHashes: info.seasonHashes,
      format: info.format,
      tier: info.tier,
      assets: info.assets,
      diagnostic: extra.diag ?? '',
      browser: `${pinnedBrowser().name} ${this.browserVersion}`,
      graphics: this.local ? 'installed browser, graphics card on' : 'software',
      renderer: rendererName(this.local),
      machine: machineId(),
      time: new Date().toISOString(),
      ...extra,
    }
  }

  async close() {
    await this.browser.close()
    await this.server.close()
    dropLock()
  }
}

export function currentSeasonHashes() {
  return buildAssetIndex().seasonHashes
}

export function recordMatches(file, want) {
  const rec = `${file}.json`
  if (!fs.existsSync(file) || !fs.existsSync(rec)) return false
  const r = readJson(rec)
  const hashes = currentSeasonHashes()
  if (r.engineHash !== engineHash()) return false
  if (!sameRenderer(r)) return false
  for (const s of want.seasons ?? []) if (r.seasonHashes?.[s] !== hashes[s]) return false
  for (const k of ['format', 'tier', 'assets', 'diagnostic']) if (want[k] !== undefined && r[k] !== want[k]) return false
  if (want.spec && JSON.stringify(r.spec) !== JSON.stringify(want.spec)) return false
  if (want.noext && JSON.stringify(r.noext ?? []) !== JSON.stringify(want.noext)) return false
  return true
}

export function writeWithRecord(file, buffer, record) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, buffer)
  writeJson(`${file}.json`, record)
}

export function stillSpec(args) {
  const all = [...cfg.keys, ...cfg.stills]
  const id = args.key ?? args.id
  let base = {}
  if (id) {
    const pic = all.find((p) => p.id === id)
    if (!pic) throw new Error(`no key or still named ${id}`)
    base = { id: pic.id, season: pic.season, state: pic.state, camera: pic.camera, format: pic.format, interface: !!pic.interface }
  }
  const spec = {
    id: base.id ?? '',
    season: args.season ?? base.season ?? cfg.defaultSeason,
    state: args.state ?? base.state ?? 'rest',
    camera: args.camera ?? base.camera ?? 'hero',
    tier: args.tier ?? 'draft',
    format: args.format ?? base.format ?? cfg.formats.hd.id,
    assets: args.assets ?? 'full',
    diag: args.diag && args.diag !== true ? args.diag : '',
    interface: args.interface === true || base.interface === true,
    live: args.live && args.live !== true ? args.live : '',
  }
  if (args.rig && args.rig !== true) spec.rig = typeof args.rig === 'string' ? JSON.parse(args.rig) : args.rig
  if (args['no-air'] !== undefined) {
    if (args['no-air'] !== true) throw new Error('--no-air takes no value')
    if (id) throw new Error(`${id} is a judged picture and is never drawn without the air. --no-air goes with --season, --state and --camera.`)
    spec.noAir = true
  }
  if (!cfg.seasons.includes(spec.season)) throw new Error(`no such season: ${spec.season}`)
  if (!(spec.camera in cfg.cameras)) throw new Error(`no such camera: ${spec.camera}`)
  if (!(spec.tier in cfg.tiers)) throw new Error(`no such tier: ${spec.tier}`)
  if (!['landed', 'rest', 'settled'].includes(spec.state)) throw new Error(`no such state: ${spec.state}`)
  formatById(spec.format)
  return spec
}

const NO_AIR = 'noair'

export function stillName(spec, suffix = '') {
  const head = spec.id || `${spec.season}-${spec.state}-${spec.camera}`
  return [head, spec.format, spec.tier, spec.assets === 'full' ? '' : spec.assets, spec.diag, spec.live ? `live-${spec.live}` : '', spec.interface ? 'ui' : '', spec.rig ? 'rig' : '', suffix, spec.noAir ? NO_AIR : ''].filter(Boolean).join('-') + '.png'
}

/**
 * Why a still may not be drawn as asked, or nothing. A still without the air is a measuring aid: a builder reads the tone of
 * wood, walls and lawn in it, which the plain still shows through particles and haze. Only `npm run still` asks for one
 * (`aid`), never of a judged picture, and its file ends in -noair, so that no tool and no reader takes it for the plain still.
 */
export function noAirProblem(spec, out, aid) {
  const name = path.basename(out)
  const named = name.endsWith(`-${NO_AIR}.png`)
  if (!spec.noAir) return named ? `${name} is the name of a still without the air, and this still has its air. Nothing was drawn.` : ''
  if (!aid) return 'A still without the air is a measuring aid of `npm run still` alone. Nothing was drawn.'
  if (spec.id) return `${spec.id} is a judged picture and is never drawn without the air. Nothing was drawn.`
  if (!named) return `A still without the air has a name that ends in -${NO_AIR}.png, and ${name} does not. Nothing was drawn.`
  return ''
}

const AIR_LEFT_OUT = {
  leftOut: true,
  what: 'no particle afloat or lain, nothing in the shared veil (haze, whitening, bank, drift, a held storm), no mist or pooled fog that a season hangs in the liquid, and none of the lit liquid that summer paints on its far wall',
  use: 'a measuring aid for the tone of the surfaces: never a judged picture, and never held against an approved image',
}

export async function flatValue(png) {
  const { channels } = await sharp(png).stats()
  const colour = channels.slice(0, 3)
  return colour.every((c) => c.min === c.max) ? colour.map((c) => c.min) : null
}

export async function refuseFlat(png, what) {
  const flat = await flatValue(png)
  if (flat) throw new Error(`${what} came back as one flat value (${flat.join(', ')}) over the whole picture, which no frame of the cut is. ${flatHint()} No picture and no record were written.`)
}

export async function renderStill(session, spec, { file, noext = [], force = false, page: given = null, aid = false } = {}) {
  const out = file ?? rel('out', 'work', 'stills', stillName(spec))
  const problem = noAirProblem(spec, out, aid)
  if (problem) throw new Error(problem)
  const want = { seasons: [spec.season], format: spec.format, tier: spec.tier, assets: spec.assets, diagnostic: spec.diag, spec, noext }
  if (!force && recordMatches(out, want)) return { file: out, reused: true, record: readJson(`${out}.json`) }
  const page = given ?? (await session.page({ format: spec.format, noext, assets: spec.assets }))
  const t0 = Date.now()
  const result = await page.evaluate(async (s) => {
    const sc = window.showcase
    await sc.setFormat(s.format)
    sc.setDiagnostic(s.diag || 'none')
    const before = sc.dev.timings()
    const call = { season: s.season, state: s.state, camera: s.camera, tier: s.tier }
    if (s.interface) call.interface = true
    if (s.live) call.live = s.live
    if (s.rig) call.rig = s.rig
    if (s.noAir) call.noAir = true
    await sc.renderStill(call)
    const after = sc.dev.timings()
    return { info: sc.info(), caps: sc.dev.caps(), framing: sc.dev.stillFraming(), timings: { simMs: after.simMs - before.simMs, drawMs: after.drawMs - before.drawMs, samples: after.samples - before.samples, steps: after.steps - before.steps } }
  }, spec)
  // The page counts no particle in a picture it drew with the air out: a page that did not know the switch would count them.
  if (spec.noAir && result.info.counts.particles !== 0) throw new Error(`the page drew ${result.info.counts.particles} particles into ${path.basename(out)}, which leaves the air out. No picture and no record were written.`)
  const png = await session.grab(page)
  if (!spec.diag) await refuseFlat(png, `the still ${path.basename(out)}`)
  const seconds = (Date.now() - t0) / 1000
  const record = session.record(result.info, { diag: spec.diag, spec, noext, seconds, timings: result.timings, precision: result.caps.precision, standIns: result.info.standIns.length, counts: result.info.counts, framing: result.framing, errors: page.errors.slice(0, 20), ...(spec.noAir ? { air: AIR_LEFT_OUT } : {}) })
  writeWithRecord(out, png, record)
  if (!given) await page.context().close()
  return { file: out, reused: false, record }
}
