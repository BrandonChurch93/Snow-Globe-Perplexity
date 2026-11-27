// node out/work/p6s/modes263.mjs <tree> <name> [host=snow-globe.example] [port=4192]
// The addresses the build hands out beside the plain page (the films, the loop, the probe), opened on a host that holds
// dist/ and nothing else (static-host.mjs) under a name that is not this machine's (or under 127.0.0.1, to hold beside it):
// for each, when its first picture came, whether it goes on drawing and moving, what it says, and every request the host
// did not answer with a file.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import { launch } from '../../../tools/lib/browser.mjs'

const [, , tree, name = 'modes', HOST = 'snow-globe.example', portArg = '4192'] = process.argv
const port = Number(portArg)
const base = `http://${HOST}:${port}/`
const outDir = `out/work/p6s/h263/${name}`
fs.mkdirSync(outDir, { recursive: true })
const log = `${outDir}/requests.jsonl`
const server = spawn(process.execPath, ['out/work/p6s/static-host.mjs', `${tree}/dist`, String(port), log], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(600)
const local = ['localhost', '127.0.0.1', '[::1]'].includes(HOST)
const browser = await launch(local ? {} : { extraArgs: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=http://${HOST}:${port}`] })
const requests = () => fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const out = []
const say = (l) => {
  out.push(l)
  console.log(l)
}
const build = JSON.parse(fs.readFileSync(`${tree}/dist/build.json`, 'utf8'))
say(`${name} · the built page of ${tree} (${JSON.stringify(build).slice(0, 110)}) on a host that holds dist/ alone, opened as ${base} · ${new Date().toISOString().slice(11, 19)} UTC`)

const WAIT = Number(process.env.WAIT ?? 240000)
const PROBE_WAIT = Number(process.env.PROBE_WAIT ?? 600000)
const [W, H] = (process.env.SIZE ?? '640x360').split('x').map(Number)
const raw = (png) => sharp(png).removeAlpha().raw().toBuffer()
async function apart(a, b) {
  if (!a || !b) return null
  const [x, y] = await Promise.all([raw(a), raw(b)])
  if (x.length !== y.length) return null
  let sum = 0
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i])
  return Math.round((sum / x.length) * 100) / 100
}
const look = async (png) => {
  if (!png) return 'no picture'
  const st = await sharp(png).removeAlpha().stats()
  return `mean ${Math.round(st.channels.reduce((n, c) => n + c.mean, 0) / 3)}, spread ${Math.round(Math.max(...st.channels.map((c) => c.stdev)) * 10) / 10}`
}
const keep = async (png, file) => png && (await sharp(png).jpeg({ quality: 90 }).toFile(path.join(outDir, file)))

const ADDRESSES = [
  ['autopilot', '?mode=autopilot'],
  ['autopilot-a', '?mode=autopilot&which=a'],
  ['loop', '?mode=loop'],
  ['probe', '?mode=probe'],
]
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
let good = 0
let asked = 0
for (const [id, query] of ADDRESSES) {
  if (only && !only.includes(id)) continue
  asked++
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text().split('\n')[0]}`))
  await page.addInitScript(() => {
    window.__frames = 0
    const tick = () => {
      window.__frames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const from = requests().length
  const t0 = Date.now()
  await page.goto(base + query, { waitUntil: 'commit' })
  const state = () =>
    page
      .evaluate(() => {
        const ui = document.getElementById('ui')
        const pre = ui?.querySelector('pre')
        return {
          host: location.hostname,
          first: document.documentElement.dataset.firstPicture === '1',
          shown: ui?.dataset.interface === 'shown',
          probe: ui?.dataset.probe ?? '',
          status: ui?.querySelector('[role="status"]')?.textContent ?? '',
          text: pre && !pre.hidden ? (pre.textContent ?? '') : '',
          showcase: typeof window.showcase,
          still: Boolean(document.querySelector('#first canvas, #first img, #first > *')),
          frames: window.__frames ?? 0,
        }
      })
      .catch(() => null)
  const shot = () => page.screenshot({ timeout: 120000 }).catch(() => null)
  const isProbe = id === 'probe'
  let s = await state()
  const done = (x) => x && (isProbe ? x.probe === 'done' || x.probe === 'failed' : x.first)
  const limit = isProbe ? PROBE_WAIT : WAIT
  let firstAt = null
  let early = null
  while (!done(s) && Date.now() - t0 < limit) {
    await sleep(500)
    s = await state()
    if (s?.first && firstAt === null) {
      firstAt = Date.now() - t0
      if (isProbe) early = await shot()
    }
  }
  if (s?.first && firstAt === null) firstAt = Date.now() - t0
  const seconds = Math.round((Date.now() - t0) / 100) / 10
  let line
  let ok
  if (isProbe) {
    const end = await shot()
    await keep(early, `${id}-${W}-first.jpg`)
    await keep(end, `${id}-${W}-end.jpg`)
    const lines = (s?.text ?? '').split('\n').filter((l) => l.trim())
    ok = s?.probe === 'done' && lines.length > 0
    line = `the probe ${s?.probe === 'done' ? `ended after ${seconds} s` : `DID NOT END in ${seconds} s (it says "${s?.probe}")`}; its status reads "${(s?.status ?? '').slice(0, 90)}"; ${lines.length} lines of text, the first "${(lines[0] ?? '').slice(0, 110)}"; ${s?.frames} frames drawn; the picture at its end ${await look(end)}`
  } else {
    const a = await shot()
    const f0 = (await state())?.frames ?? 0
    const t1 = Date.now()
    await sleep(Number(process.env.GAP ?? 15000))
    const b = await shot()
    await sleep(Number(process.env.GAP ?? 15000))
    const c = await shot()
    const x = await state()
    const span = Math.round((Date.now() - t1) / 100) / 10
    s = x ?? s
    await keep(a, `${id}-${W}-a.jpg`)
    await keep(b, `${id}-${W}-b.jpg`)
    await keep(c, `${id}-${W}-c.jpg`)
    const [ab, bc] = [await apart(a, b), await apart(b, c)]
    const drawn = (x?.frames ?? 0) - f0
    ok = Boolean(s?.first) && drawn >= 2 && (ab > 0 || bc > 0)
    line = `first picture ${s?.first ? `came after ${firstAt === null ? seconds : Math.round(firstAt / 100) / 10} s` : `DID NOT COME in ${seconds} s`}; then ${drawn} frames in ${span} s, the pictures ${ab} and ${bc} apart from one to the next (${ab > 0 || bc > 0 ? 'it moves' : 'IT STANDS STILL'}); the first of them ${await look(a)}, the last ${await look(c)}; controls ${s?.shown ? 'shown' : 'not shown'}`
  }
  const mine = requests().slice(from)
  const odd = mine.filter((r) => r.status !== 200 || r.what !== 'file' || r.method !== 'GET')
  const outside = mine.filter((r) => /__simcache|assets-full/.test(r.path))
  if (ok) good++
  say(`${id} ${query} on ${s?.host}: ${line}; capture interface ${s?.showcase === 'object' ? 'HANDED OUT' : 'absent'}; ${errors.length} errors${errors.length ? ` (${[...new Set(errors)].slice(0, 2).join(' | ').slice(0, 220)})` : ''}; ${mine.length} requests, not answered with a file by GET: ${odd.length}${odd.length ? ` (${[...new Set(odd.map((r) => `${r.method} ${r.path.replace(/\?v=.*/, '').slice(0, 60)} ${r.status}`))].slice(0, 5).join(' · ')})` : ''}, to __simcache or assets-full: ${outside.length}`)
  await context.close()
}
say(`${name}: ${good} of ${asked} addresses came and went on as they should, on ${HOST}`)
fs.writeFileSync(`${outDir}/report.txt`, out.join('\n') + '\n')
await browser.close()
server.kill()
