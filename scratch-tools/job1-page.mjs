// node out/work/p6s/job1-page.mjs <base url> <out dir> [wait seconds=150]
// Opens the built page at addresses that name things the app does not know, and says for each what the page did: whether
// it stopped, whether the first picture and the controls came, whether the capture interface is there, and how far its
// picture stands from the plain page's. Then asks the capture interface for names every object carries.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { launch } from '../../../tools/lib/browser.mjs'

const [, , base = 'http://localhost:4180/', outDir = '/tmp/job1-page', waitArg = '150'] = process.argv
const WAIT = Number(waitArg) * 1000
const [W, H] = [960, 540]
fs.mkdirSync(outDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await launch()

async function visit(name, query, { live = true, film = /mode=autopilot/.test(query) } = {}) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().split('\n')[0]}`))
  const t0 = Date.now()
  await page.goto(base + query, { waitUntil: 'commit' })
  const state = () =>
    page
      .evaluate(() => ({
        first: document.documentElement.dataset.firstPicture === '1',
        shown: document.getElementById('ui')?.dataset.interface === 'shown',
        showcase: typeof window.showcase,
        liveSim: typeof window.liveSim,
        lit: [...document.querySelectorAll('#ui [data-season][aria-pressed="true"]')].map((m) => m.dataset.season).join(),
      }))
      .catch(() => null)
  let s = await state()
  const done = (x) => (film ? x && x.first : live ? x && x.first && x.shown : x && x.showcase === 'object')
  // A page that stopped says so at once and will never draw: it is not waited out.
  while (!done(s) && Date.now() - t0 < WAIT && !(errors.length && Date.now() - t0 > 20000)) {
    await sleep(500)
    s = await state()
  }
  const seconds = Math.round((Date.now() - t0) / 100) / 10
  if (live && done(s)) await sleep(film ? 8000 : 2500)
  const png = await page.screenshot({ timeout: 120000 }).catch(() => null)
  if (png) await sharp(png).jpeg({ quality: 88 }).toFile(path.join(outDir, `${name}.jpg`))
  return { name, query, seconds, errors, state: s, png, page, context }
}

const raw = (png) => sharp(png).removeAlpha().raw().toBuffer()
async function apart(a, b) {
  if (!a || !b) return null
  const [x, y] = await Promise.all([raw(a), raw(b)])
  let sum = 0
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i])
  return Math.round((sum / x.length) * 100) / 100
}
const spread = async (png) => (png ? Math.round(Math.max(...(await sharp(png).removeAlpha().stats()).channels.map((c) => c.stdev)) * 10) / 10 : null)

const say = (l) => console.log(l)
say(`${base}`)
const plain = await visit('plain', '?quality=low')
await plain.context.close()
const again = await visit('plain-again', '?quality=low')
await again.context.close()
say(`plain: first picture and controls ${plain.state?.first && plain.state?.shown ? 'came' : 'DID NOT COME'} in ${plain.seconds} s · lit ${plain.state?.lit} · errors ${plain.errors.length} · two plain pages stand ${await apart(plain.png, again.png)} apart (mean of a channel, 0 to 255) · spread ${await spread(plain.png)}`)

for (const [name, query] of [
  ['capture-bogus', '?mode=capture&format=bogus&quality=low'],
  ['capture-constructor', '?mode=capture&format=constructor&quality=low'],
  ['capture-empty', '?mode=capture&format=&quality=low'],
  ['diag-bogus', '?diag=bogus&quality=low'],
  ['diag-constructor', '?diag=constructor&quality=low'],
  ['shot-bogus', '?mode=autopilot&shot=bogus&quality=low'],
  ['all-at-once', '?mode=capture&format=__proto__&diag=toString&shot=valueOf&assets=constructor&tier=constructor&season=hasOwnProperty&quality=constructor&which=__proto__&camera=constructor&quality=low'],
]) {
  const r = await visit(name, query)
  const film = /autopilot/.test(query)
  say(
    `${name}: ${query}\n   page errors ${r.errors.length}${r.errors.length ? ` (${r.errors.slice(0, 2).join(' | ')})` : ''} · first picture ${r.state?.first ? 'came' : 'DID NOT COME'} · controls ${r.state?.shown ? 'came' : film ? 'not shown (a film has none)' : 'DID NOT COME'} · after ${r.seconds} s · capture interface ${r.state?.showcase === 'undefined' ? 'absent' : `PRESENT (${r.state?.showcase})`} · liveSim ${r.state?.liveSim} · lit ${r.state?.lit || 'none'} · from the plain page ${await apart(plain.png, r.png)} apart · spread ${await spread(r.png)}`,
  )
  await r.context.close()
}

// The capture page a tool opens, and what it answers to names every object carries.
const cap = await visit('capture-hd', '?mode=capture&format=hd', { live: false })
say(`capture-hd: capture interface ${cap.state?.showcase === 'object' ? 'present' : 'ABSENT'} after ${cap.seconds} s · page errors ${cap.errors.length}`)
if (cap.state?.showcase === 'object') {
  const answers = await cap.page.evaluate(async () => {
    const sc = window.showcase
    await sc.ready
    const out = {}
    const tell = async (name, f) => {
      try {
        const v = await f()
        out[name] = `answered ${JSON.stringify(v)?.slice(0, 110)}`
      } catch (e) {
        out[name] = `refused: ${String(e.message ?? e).slice(0, 110)}`
      }
    }
    await tell("setAssets('constructor')", () => sc.setAssets('constructor').then(() => sc.info().assets))
    await tell("setAssets('__proto__')", () => sc.setAssets('__proto__').then(() => sc.info().assets))
    await tell("dev.pose('constructor')", () => sc.dev.pose('constructor'))
    await tell("dev.pose('hero')", () => sc.dev.pose('hero'))
    await tell("setFormat('constructor')", () => sc.setFormat('constructor').then(() => sc.info().format))
    await tell("renderStill tier 'constructor'", () => sc.renderStill({ season: 'winter', state: 'rest', camera: 'hero', tier: 'constructor' }).then(() => 'a picture was drawn'))
    await tell("renderStill camera 'toString'", () => sc.renderStill({ season: 'winter', state: 'rest', camera: 'toString', tier: 'draft' }).then(() => 'a picture was drawn'))
    await tell("renderStill season 'valueOf'", () => sc.renderStill({ season: 'valueOf', state: 'rest', camera: 'hero', tier: 'draft' }).then(() => 'a picture was drawn'))
    await tell('info().assets, info().format afterwards', () => ({ assets: sc.info().assets, format: sc.info().format }))
    return out
  })
  for (const [k, v] of Object.entries(answers)) say(`   ${k}: ${v}`)
}
await cap.context.close()
await browser.close()
