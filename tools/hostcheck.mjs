import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs, rel, loadConfig, readJson, writeJson } from './lib/paths.mjs'
import { engineHash, listFiles } from './lib/hashes.mjs'
import { launch, machineId, pinnedBrowser, watchPage } from './lib/browser.mjs'
import { serve } from './lib/server.mjs'
import { checkDisk, renderBusy } from './lib/page.mjs'
import { pixels } from './lib/pixels.mjs'

const args = parseArgs(process.argv.slice(2))
const cfg = loadConfig()
const host = cfg.host
const waitSeconds = args.wait && args.wait !== true ? Number(args.wait) : 120
const out = rel('out', 'work', 'hostcheck', 'result.json')
const mb = (bytes) => bytes / 1048576
const sh = (cmd, argv, cwd) => spawnSync(cmd, argv, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: '1' } })
const tail = (text, n = 8) => String(text ?? '').trim().split('\n').slice(-n).join('\n')
const NEVER = ['assets-full', 'audio', 'references', 'out', 'pipeline', 'scorecards']
const OUTSIDE = ['assets-full/', '__simcache']
const LOCK = rel('out', 'work', 'render.lock')

checkDisk()
const tracked = sh('git', ['ls-files', '-z'], rel()).stdout.split('\0').filter(Boolean).filter((f) => fs.existsSync(rel(f)))
const temp = fs.mkdtempSync(path.join(os.tmpdir(), `${cfg.slug}-hostcheck-`))
const result = {
  engineHash: engineHash(),
  commit: sh('git', ['rev-parse', '--short', 'HEAD'], rel()).stdout.trim(),
  time: new Date().toISOString(),
  machine: machineId(),
  browser: '',
  limits: host,
  copied: tracked.length,
  build: { ok: false, installSeconds: 0, buildSeconds: 0, minutes: 0, error: '' },
  dist: { mb: 0, files: 0, largest: { file: '', mb: 0 }, never: [] },
  firstLoad: { bytes: 0, mb: 0, requests: 0, files: [], sizes: 'bytes of each response body as this server sent it, with no compression' },
  live: { opened: false, firstPicture: false, seconds: 0, waitSeconds, mode: 'live', picture: null, errors: [], error: '' },
  inside: {},
  pass: false,
}

let server = null
let browser = null
try {
  for (const f of tracked) {
    const to = path.join(temp, f)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(rel(f), to)
  }
  console.log(`copied ${tracked.length} tracked files to ${temp}`)

  let t = Date.now()
  const install = sh('npm', ['ci', '--no-audit', '--no-fund'], temp)
  result.build.installSeconds = (Date.now() - t) / 1000
  if (install.status !== 0) throw new Error(`npm ci failed in the clean copy:\n${tail(install.stdout + install.stderr)}`)
  console.log(`npm ci in ${result.build.installSeconds.toFixed(1)} s`)

  t = Date.now()
  const build = sh('npm', ['run', 'build'], temp)
  result.build.buildSeconds = (Date.now() - t) / 1000
  result.build.minutes = (result.build.installSeconds + result.build.buildSeconds) / 60
  if (build.status !== 0) throw new Error(`npm run build failed in the clean copy:\n${tail(build.stdout + build.stderr)}`)
  const dist = path.join(temp, 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('the clean build wrote no dist/index.html')
  result.build.ok = true
  console.log(`npm run build in ${result.build.buildSeconds.toFixed(1)} s`)

  const files = listFiles(dist).map((f) => ({ file: path.relative(dist, f).split(path.sep).join('/'), bytes: fs.statSync(f).size }))
  const largest = files.reduce((a, b) => (b.bytes > a.bytes ? b : a), { file: '', bytes: 0 })
  result.dist = {
    mb: mb(files.reduce((n, f) => n + f.bytes, 0)),
    files: files.length,
    largest: { file: largest.file, mb: mb(largest.bytes) },
    never: NEVER.filter((d) => fs.existsSync(path.join(dist, d))),
  }

  while (renderBusy()) await new Promise((r) => setTimeout(r, 1000))
  writeJson(LOCK, { pid: process.pid, what: 'hostcheck', since: new Date().toISOString() })
  server = await serve({ dist })
  browser = await launch()
  result.browser = `${pinnedBrowser().name} ${browser.version()}`
  const f = cfg.formats.hd
  const context = await browser.newContext({ viewport: { width: f.width, height: f.height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultTimeout(0)
  const errors = watchPage(page)
  const fetched = []
  const pending = []
  let seen = 0
  await page.exposeBinding('__hostcheckFirstPicture', () => {
    if (!seen) seen = Date.now()
  })
  await page.addInitScript(() => {
    const tell = () => {
      if (document.documentElement?.dataset.firstPicture === '1') window.__hostcheckFirstPicture()
    }
    new MutationObserver(tell).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-first-picture'] })
    document.addEventListener('DOMContentLoaded', tell)
  })
  page.on('requestfinished', (request) => {
    if (seen) return
    const entry = { url: request.url().replace(server.url, '') || 'index.html', bytes: 0 }
    fetched.push(entry)
    pending.push(
      request
        .sizes()
        .then((sizes) => {
          entry.bytes = sizes.responseBodySize
        })
        .catch(() => {}),
    )
  })
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url().replace(server.url, '')}`))
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`status ${response.status()}: ${response.url().replace(server.url, '')}`)
  })
  t = Date.now()
  await page.goto(server.url)
  const limit = t + waitSeconds * 1000
  while (!seen && Date.now() < limit) await new Promise((r) => setTimeout(r, 50))
  result.live.firstPicture = seen > 0
  if (!seen) result.live.error = `the page did not set dataset.firstPicture within ${waitSeconds} s`
  result.live.seconds = ((seen || Date.now()) - t) / 1000
  const upTo = fetched.length
  await Promise.all(pending)
  const state = await page.evaluate(() => ({ canvas: !!document.getElementById('view'), width: document.getElementById('view')?.width ?? 0, mode: new URLSearchParams(location.search).get('mode') ?? 'live' }))
  const mine = fetched.slice(0, upTo)
  const shot = rel('out', 'work', 'hostcheck', 'live.png')
  fs.mkdirSync(path.dirname(shot), { recursive: true })
  fs.writeFileSync(shot, await page.screenshot())
  const seenPixels = await pixels(shot)
  const colours = new Set()
  for (let o = 0; o < seenPixels.data.length; o += 4) colours.add((seenPixels.data[o] << 16) | (seenPixels.data[o + 1] << 8) | seenPixels.data[o + 2])
  result.live.picture = { file: path.relative(rel(), shot).split(path.sep).join('/'), width: seenPixels.width, height: seenPixels.height, colours: colours.size }
  if (colours.size < 2) errors.push('blank: the page shows one flat colour')
  const outside = mine.filter((x) => OUTSIDE.some((prefix) => x.url.startsWith(prefix))).map((x) => x.url)
  for (const url of outside.slice(0, 5)) errors.push(`fetched ${url}, which is not in dist/`)
  result.live.mode = state.mode
  result.live.errors = errors.slice(0, 20)
  const broke = errors.find((l) => l.startsWith('pageerror') || l.startsWith('blank') || l.startsWith('fetched ') || l.startsWith('status ') || l.startsWith('request failed'))
  result.live.opened = state.canvas && state.width > 0 && !broke
  if (!result.live.opened) result.live.error = broke ?? 'the page has no canvas'
  const bytes = mine.reduce((n, x) => n + x.bytes, 0)
  result.firstLoad = { ...result.firstLoad, bytes, mb: mb(bytes), requests: mine.length, files: [...mine].sort((x, y) => y.bytes - x.bytes).slice(0, 40) }
  await context.close()
} catch (e) {
  result.build.error ||= result.build.ok ? '' : e.message
  if (result.build.ok) result.live.error ||= e.message
  console.log(e.message)
} finally {
  if (browser) await browser.close()
  if (server) await server.close()
  try {
    if (fs.existsSync(LOCK) && readJson(LOCK).pid === process.pid) fs.rmSync(LOCK)
  } catch {}
  if (args.keep === true) console.log(`kept ${temp}`)
  else fs.rmSync(temp, { recursive: true, force: true })
}

result.inside = {
  maxShippedMb: result.build.ok && result.dist.mb <= host.maxShippedMb,
  maxFileMb: result.build.ok && result.dist.largest.mb <= host.maxFileMb,
  firstLoadMaxMb: result.live.firstPicture && result.firstLoad.mb <= host.firstLoadMaxMb,
  maxBuildMinutes: result.build.ok && result.build.minutes <= host.maxBuildMinutes,
}
result.pass = Object.values(result.inside).every(Boolean) && result.live.opened && result.live.errors.length === 0 && result.dist.never.length === 0
writeJson(out, result)

const line = (ok, text, words = ['inside', 'OUTSIDE']) => console.log(`${words[ok ? 0 : 1]} · ${text}`)
const PASS = ['pass', 'FAIL']
if (result.build.ok) {
  line(result.inside.maxShippedMb, `dist/ is ${result.dist.mb.toFixed(2)} MB in ${result.dist.files} files, host.maxShippedMb is ${host.maxShippedMb}`)
  line(result.inside.maxFileMb, `the largest file is ${result.dist.largest.file}, ${result.dist.largest.mb.toFixed(2)} MB, host.maxFileMb is ${host.maxFileMb}`)
  line(result.inside.firstLoadMaxMb, result.live.firstPicture ? `${result.firstLoad.mb.toFixed(2)} MB in ${result.firstLoad.requests} requests were fetched before the first complete picture, ${result.live.seconds.toFixed(1)} s after the page was opened, host.firstLoadMaxMb is ${host.firstLoadMaxMb}` : `the page never set dataset.firstPicture in ${waitSeconds} s, so what loads before the first complete picture is not known (${result.firstLoad.mb.toFixed(2)} MB in ${result.firstLoad.requests} requests by then)`)
  line(result.inside.maxBuildMinutes, `the clean install and build took ${result.build.minutes.toFixed(2)} minutes (npm ci ${result.build.installSeconds.toFixed(1)} s, npm run build ${result.build.buildSeconds.toFixed(1)} s), host.maxBuildMinutes is ${host.maxBuildMinutes}`)
  line(result.dist.never.length === 0, result.dist.never.length ? `dist/ holds ${result.dist.never.join(', ')}, which never ship` : `dist/ holds none of ${NEVER.join(', ')}`, PASS)
  line(result.live.opened && result.live.errors.length === 0, result.live.opened ? `the built site opens in ${result.live.mode} mode${result.live.errors.length ? ` and logs: ${result.live.errors[0]}` : ' with nothing logged'}, and ${result.live.picture.file} holds ${result.live.picture.colours} colours` : `the built site does not open: ${result.live.error}`, PASS)
}
console.log(`hostcheck: ${result.pass ? 'pass' : 'FAIL'} · ${path.relative(rel(), out)}`)
process.exit(result.pass ? 0 : 1)
