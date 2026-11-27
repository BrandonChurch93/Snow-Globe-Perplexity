// node out/work/p6s/host263.mjs <tree> <name> [fallback] [port=4191]
// What the built page of <tree> does on a host that holds dist/ and nothing else (static-host.mjs), opened under a name
// that is not this machine's (snow-globe.example, mapped to this machine in the browser alone): for each address, what
// came (first picture, controls, capture interface), what the visitor sees, and every request the host did not answer
// with a file. Where the capture interface is handed out it is then driven as a tool would drive it.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import { launch } from '../../../tools/lib/browser.mjs'

const [, , tree, name = 'h263', fallback = '', portArg = '4191'] = process.argv
const port = Number(portArg)
const HOST = 'snow-globe.example'
const base = `http://${HOST}:${port}/`
const outDir = `out/work/p6s/h263/${name}`
fs.mkdirSync(outDir, { recursive: true })
const log = `${outDir}/requests.jsonl`
const server = spawn(process.execPath, ['out/work/p6s/static-host.mjs', `${tree}/dist`, String(port), log, ...(fallback === 'fallback' ? ['fallback'] : [])], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(600)
const browser = await launch({ extraArgs: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=http://${HOST}:${port}`] })
const requests = () => fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const out = []
const say = (l) => {
  out.push(l)
  console.log(l)
}
const build = JSON.parse(fs.readFileSync(`${tree}/dist/build.json`, 'utf8'))
say(`${name} · the built page of ${tree} (${JSON.stringify(build).slice(0, 110)}) on a host that holds dist/ alone${fallback === 'fallback' ? ' and answers with the page for what it does not hold' : ', 404 for what it does not hold'}, 405 for every method but GET and HEAD · opened as ${base}`)

const WAIT = Number(process.env.WAIT ?? 60000)
async function visit(id, query, [W, H] = [960, 540], waitMs = WAIT) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text().split('\n')[0]}`))
  const from = requests().length
  const t0 = Date.now()
  await page.goto(base + query, { waitUntil: 'commit' })
  const state = () =>
    page
      .evaluate(() => ({
        host: location.hostname,
        secure: window.isSecureContext,
        first: document.documentElement.dataset.firstPicture === '1',
        shown: document.getElementById('ui')?.dataset.interface === 'shown',
        showcase: typeof window.showcase,
        still: Boolean(document.querySelector('#first canvas, #first img, #first > *')),
        canvasOpacity: getComputedStyle(document.getElementById('view')).opacity,
        lit: [...document.querySelectorAll('#ui [data-season][aria-pressed="true"]')].map((m) => m.dataset.season).join(),
      }))
      .catch(() => null)
  let s = await state()
  let early = null
  let stillEver = Boolean(s?.still)
  while (!(s && s.first && s.shown) && Date.now() - t0 < waitMs) {
    await sleep(250)
    s = await state()
    stillEver ||= Boolean(s?.still)
    if (!early && Date.now() - t0 > 2500) early = await page.screenshot({ timeout: 60000 }).catch(() => null)
  }
  const seconds = Math.round((Date.now() - t0) / 100) / 10
  if (s && s.first && s.shown) await sleep(2500)
  const png = await page.screenshot({ timeout: 120000 }).catch(() => null)
  if (png) await sharp(png).jpeg({ quality: 90 }).toFile(path.join(outDir, `${id}-${W}.jpg`))
  if (early) await sharp(early).jpeg({ quality: 90 }).toFile(path.join(outDir, `${id}-${W}-at-2s.jpg`))
  return { id, query, seconds, errors, state: s, png, page, context, from, stillEver, early }
}
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
const asked = (from) => {
  const mine = requests().slice(from)
  const odd = mine.filter((r) => r.status !== 200 || r.what !== 'file' || r.method !== 'GET')
  const outside = mine.filter((r) => /__simcache|assets-full/.test(r.path))
  return { n: mine.length, odd, outside }
}
const tellAsked = (a) =>
  `${a.n} requests; not answered with a file by GET: ${a.odd.length}${a.odd.length ? ` (${[...new Set(a.odd.map((r) => `${r.method} ${r.path.replace(/\?v=.*/, '').slice(0, 60)} ${r.status}${r.what === 'the page instead' ? ' the page instead' : ''}`))].slice(0, 6).join(' · ')}${a.odd.length > 6 ? ' ...' : ''})` : ''}; to __simcache or assets-full: ${a.outside.length}`

const plain = await visit('plain', '?quality=low')
const plainEarly = plain.early
const plainAsked = asked(plain.from)
await plain.context.close()
const again = await visit('plain-again', '?quality=low')
await again.context.close()
say(`plain ?quality=low: host ${plain.state?.host}, secure context ${plain.state?.secure}; first picture and controls ${plain.state?.first && plain.state?.shown ? 'came' : 'DID NOT COME'} in ${plain.seconds} s; lit ${plain.state?.lit}; capture interface ${plain.state?.showcase === 'object' ? 'HANDED OUT' : 'absent'}; ${plain.errors.length} errors${plain.errors.length ? ` (${plain.errors.slice(0, 2).join(' | ')})` : ''}; ${tellAsked(plainAsked)}; picture ${await look(plain.png)}; two plain pages stand ${await apart(plain.png, again.png)} apart`)

const ADDRESSES = [
  ['capture', '?mode=capture&quality=low'],
  ['capture-simcache', '?mode=capture&simcache=1&quality=low'],
  ['capture-web', '?mode=capture&assets=web&quality=low'],
  ['capture-web-simcache', '?mode=capture&assets=web&simcache=1&quality=low'],
  ['capture-phone-simcache', '?mode=capture&format=phone&simcache=1&quality=low'],
  ['simcache-alone', '?simcache=1&quality=low'],
  ['capture-full-simcache', '?mode=capture&assets=full&simcache=1&quality=low'],
]
let dead = 0
let handed = 0
let refused = 0
for (const [id, query] of ADDRESSES) {
  const r = await visit(id, query)
  const a = asked(r.from)
  const ok = r.state?.first && r.state?.shown
  if (!ok) dead++
  if (r.state?.showcase === 'object') handed++
  say(`${id} ${query}\n    first picture ${r.state?.first ? 'came' : 'DID NOT COME'}, controls ${r.state?.shown ? 'came' : 'DID NOT COME'} (${r.seconds} s), the page's own still ${r.stillEver ? 'laid before the live picture' : 'never laid'}, canvas opacity ${r.state?.canvasOpacity}, lit ${r.state?.lit || 'none'}; capture interface ${r.state?.showcase === 'object' ? 'HANDED OUT' : 'absent'}; ${r.errors.length} errors${r.errors.length ? ` (${r.errors.slice(0, 2).join(' | ').slice(0, 220)})` : ''}\n    ${tellAsked(a)}\n    picture ${await look(r.png)}; ${await apart(r.png, plain.png)} apart from the plain page; at 2.5 s ${await look(r.early)}, ${await apart(r.early, plainEarly)} apart from the plain page then`)
  if (r.state?.showcase === 'object' && /simcache/.test(id)) {
    const before = requests().length
    const driven = await r.page
      .evaluate(async () => {
        const sc = window.showcase
        const out = {}
        const tell = async (what, f) => {
          try {
            out[what] = `answered ${JSON.stringify(await f())?.slice(0, 140)}`
          } catch (e) {
            out[what] = `threw: ${String(e?.message ?? e).slice(0, 140)}`
          }
        }
        await tell('ready', () => Promise.race([sc.ready.then(() => 'ready'), new Promise((res) => setTimeout(() => res('not ready after 12 s'), 12000))]))
        await tell("dev.simcache('stills', 3)", () => Promise.race([sc.dev.simcache('stills', 3), new Promise((res) => setTimeout(() => res('no answer after 50 s'), 50000))]))
        return out
      })
      .catch((e) => ({ evaluate: `threw: ${String(e.message).slice(0, 140)}` }))
    const d = asked(before)
    refused += d.odd.filter((x) => x.status === 405).length
    for (const [k, v] of Object.entries(driven)) say(`    driven as a tool drives it: ${k}: ${v}`)
    say(`    while driven: ${tellAsked(d)}`)
  }
  await r.context.close()
}
// The same at a phone's width, for the picture.
for (const [id, query] of [['plain', '?quality=low'], ['capture', '?mode=capture&quality=low'], ['capture-web-simcache', '?mode=capture&assets=web&simcache=1&quality=low']]) {
  const r = await visit(id, query, [400, 700])
  say(`${id} at 400 x 700: first picture ${r.state?.first ? 'came' : 'DID NOT COME'}, controls ${r.state?.shown ? 'came' : 'DID NOT COME'} (${r.seconds} s); capture interface ${r.state?.showcase === 'object' ? 'HANDED OUT' : 'absent'}; picture ${await look(r.png)}`)
  await r.context.close()
}
const all = requests()
say(`${name}: ${dead} of ${ADDRESSES.length} addresses did not end in the plain page; the capture interface was handed out on ${handed}; ${refused} requests refused with 405 while driven; over the whole run ${all.filter((r) => r.status === 405).length} refused with 405, ${all.filter((r) => /__simcache/.test(r.path)).length} to __simcache, ${all.filter((r) => /assets-full/.test(r.path)).length} to assets-full, ${all.filter((r) => r.status === 404).length} answered 404`)
fs.writeFileSync(`${outDir}/report.txt`, out.join('\n') + '\n')
await browser.close()
server.kill()
