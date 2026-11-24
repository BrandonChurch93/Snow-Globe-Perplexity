import fs from 'node:fs'
import path from 'node:path'
import { launch, machineId, pinnedBrowser, watchPage, ensureDir, freeDiskGb } from './browser.mjs'
import { serve } from './server.mjs'
import { loadConfig, rel, writeJson, readJson } from './paths.mjs'
import { engineHash, buildAssetIndex } from './hashes.mjs'

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

async function takeLock(what, wait) {
  ensureDir(path.dirname(LOCK))
  for (;;) {
    const busy = renderBusy()
    if (!busy) break
    if (!wait) throw new Error(`a render job is running in this VM: ${busy.what} (pid ${busy.pid})`)
    await new Promise((r) => setTimeout(r, 1000))
  }
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
  static async open({ local = false, headless = true, what = process.argv.slice(1).map((a) => path.basename(a)).join(' '), wait = true } = {}) {
    const s = new Session()
    s.hash = requireBuild()
    checkDisk()
    await takeLock(what, wait)
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
    this.pages.add(page)
    page.errors = errors
    return page
  }

  async grab(page) {
    const data = await page.evaluate(() => document.getElementById('view').toDataURL('image/png'))
    return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')
  }

  async grabStage(page) {
    const box = await page.evaluate(() => {
      const r = document.getElementById('app').getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    return page.screenshot({ type: 'png', clip: box, animations: 'disabled', caret: 'hide' })
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
  if (!cfg.seasons.includes(spec.season)) throw new Error(`no such season: ${spec.season}`)
  if (!(spec.camera in cfg.cameras)) throw new Error(`no such camera: ${spec.camera}`)
  if (!(spec.tier in cfg.tiers)) throw new Error(`no such tier: ${spec.tier}`)
  if (!['landed', 'rest', 'settled'].includes(spec.state)) throw new Error(`no such state: ${spec.state}`)
  formatById(spec.format)
  return spec
}

export function stillName(spec, suffix = '') {
  const head = spec.id || `${spec.season}-${spec.state}-${spec.camera}`
  return [head, spec.format, spec.tier, spec.assets === 'full' ? '' : spec.assets, spec.diag, spec.live ? `live-${spec.live}` : '', spec.interface ? 'ui' : '', spec.rig ? 'rig' : '', suffix].filter(Boolean).join('-') + '.png'
}

export async function renderStill(session, spec, { file, noext = [], force = false, page: given = null } = {}) {
  const out = file ?? rel('out', 'work', 'stills', stillName(spec))
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
    await sc.renderStill(call)
    const after = sc.dev.timings()
    return { info: sc.info(), caps: sc.dev.caps(), framing: sc.dev.stillFraming(), timings: { simMs: after.simMs - before.simMs, drawMs: after.drawMs - before.drawMs, samples: after.samples - before.samples, steps: after.steps - before.steps } }
  }, spec)
  const png = await session.grab(page)
  const seconds = (Date.now() - t0) / 1000
  const record = session.record(result.info, { diag: spec.diag, spec, noext, seconds, timings: result.timings, precision: result.caps.precision, standIns: result.info.standIns.length, counts: result.info.counts, framing: result.framing, errors: page.errors.slice(0, 20) })
  writeWithRecord(out, png, record)
  if (!given) await page.context().close()
  return { file: out, reused: false, record }
}
