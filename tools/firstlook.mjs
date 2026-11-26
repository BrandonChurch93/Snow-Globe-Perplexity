import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel, loadConfig, readJson, writeJson } from './lib/paths.mjs'
import { Session, stillSpec, renderStill } from './lib/page.mjs'
import { watchPage } from './lib/browser.mjs'
import { pixels } from './lib/pixels.mjs'

/**
 * What the first picture of the live page costs, and how the rest follows it.
 *
 * The live page draws its first picture from the `.first.` files of the web set (each picture at half its size, see
 * tools/lib/webset.mjs) and fetches the whole files behind it.
 *
 * Stills: the same still is rendered twice from the web set, once held at the first files (`detail=first`) and once whole, and
 * the tool says how far the two are apart, per camera. `--camera hero,macro` names the cameras, `--season` and `--state` the
 * picture, `--tier` the tier (draft).
 * Live: the built site is opened as a visitor opens it. The tool says when the still the page paints first was there and what
 * had to arrive for it (the page and one file, see tools/poster.mjs), lists what was fetched before the first complete picture
 * and what after it, checks that the whole file of every picture that was drawn from its first file arrives, and times the
 * frames while they arrive: the longest wait between two frames against the usual one.
 * `--stills` or `--live` runs one half alone. `--wait SECONDS` is how long the live page may take (180).
 * Files: out/work/firstlook/<camera>-first.png, <camera>-whole.png, <camera>-pair.jpg, live.png, result.json.
 */

const args = parseArgs(process.argv.slice(2))
const cfg = loadConfig()
const cameras = args.camera && args.camera !== true ? String(args.camera).split(',') : ['hero', 'macro']
const season = args.season && args.season !== true ? String(args.season) : cfg.defaultSeason
const state = args.state && args.state !== true ? String(args.state) : 'rest'
const tier = args.tier && args.tier !== true ? String(args.tier) : 'draft'
const dir = rel('out', 'work', 'firstlook')
const only = args.stills === true ? 'stills' : args.live === true ? 'live' : ''
const waitSeconds = args.wait && args.wait !== true ? Number(args.wait) : 180
const mb = (bytes) => bytes / 1048576

function compare(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('the two pictures do not have the same size')
  const n = a.width * a.height
  let max = 0
  let sum = 0
  let sq = 0
  let over2 = 0
  let over8 = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    let m = 0
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(a.data[o + k] - b.data[o + k])
      sum += d
      sq += d * d
      if (d > m) m = d
    }
    if (m > max) max = m
    if (m > 2) over2++
    if (m > 8) over8++
  }
  return { largest: max, mean: sum / (n * 3), psnr: sq === 0 ? null : 10 * Math.log10((255 * 255) / (sq / (n * 3))), shareOver2: over2 / n, shareOver8: over8 / n }
}

/** Opens the built site as a visitor does and follows it until every whole picture is in place. */
async function live(session) {
  const f = cfg.formats.hd
  const context = await session.browser.newContext({ viewport: { width: f.width, height: f.height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultTimeout(0)
  const errors = watchPage(page)
  const fetched = []
  const pending = []
  const seen = { still: 0, first: 0, ready: 0 }
  await page.exposeBinding('__firstlook', (_source, what) => {
    if (!seen[what]) seen[what] = Date.now()
  })
  await page.addInitScript(() => {
    const frames = (window.__frames = [])
    const tick = () => {
      frames.push(performance.now())
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    const marks = (window.__marks = { still: 0, first: 0, ready: 0 })
    // The still is there when its picture has loaded: a load does not bubble, so it is caught on its way down.
    document.addEventListener(
      'load',
      (e) => {
        if (marks.still || !(e.target instanceof HTMLImageElement) || !e.target.closest('#first')) return
        marks.still = performance.now()
        marks.stillFile = e.target.currentSrc
        window.__firstlook('still')
      },
      true,
    )
    const tell = () => {
      const d = document.documentElement?.dataset
      if (!d) return
      if (d.firstPicture === '1' && !marks.first) {
        marks.first = performance.now()
        window.__firstlook('first')
      }
      if (d.detail === 'ready' && !marks.ready) {
        marks.ready = performance.now()
        window.__firstlook('ready')
      }
    }
    new MutationObserver(tell).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-first-picture', 'data-detail'] })
    document.addEventListener('DOMContentLoaded', tell)
  })
  page.on('requestfinished', (request) => {
    const entry = { url: request.url().replace(session.server.url, '') || 'index.html', bytes: 0, early: !seen.first }
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
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url().replace(session.server.url, '')}`))
  const t = Date.now()
  await page.goto(session.server.url)
  const limit = t + waitSeconds * 1000
  while (!seen.ready && Date.now() < limit) await new Promise((r) => setTimeout(r, 50))
  if (!seen.first) throw new Error(`the page did not set dataset.firstPicture within ${waitSeconds} s`)
  if (!seen.ready) throw new Error(`the page did not set dataset.detail to ready within ${waitSeconds} s: the whole pictures did not all arrive`)
  // Some frames more, so the frames after the last picture can be set against the frames while they came.
  const enough = Date.now() + 45000
  while (Date.now() < enough && (await page.evaluate(() => window.__frames.filter((f) => f > window.__marks.ready).length)) < 8) await new Promise((r) => setTimeout(r, 500))
  await Promise.all(pending)
  const timing = await page.evaluate(() => ({ frames: window.__frames, marks: window.__marks }))
  const shot = path.join(dir, 'live.png')
  await page.screenshot({ path: shot })
  await context.close()

  const gaps = (from, to) => {
    const g = []
    for (let i = 1; i < timing.frames.length; i++) if (timing.frames[i - 1] >= from && timing.frames[i] <= to) g.push(timing.frames[i] - timing.frames[i - 1])
    g.sort((a, b) => a - b)
    return { frames: g.length, medianMs: g.length ? g[g.length >> 1] : 0, longestMs: g.length ? g[g.length - 1] : 0 }
  }
  const early = fetched.filter((x) => x.early)
  const stillUrl = timing.marks.stillFile ? timing.marks.stillFile.replace(session.server.url, '') : ''
  const forStill = fetched.filter((x) => x.url === 'index.html' || (stillUrl && x.url === stillUrl))
  const late = fetched.filter((x) => !x.early)
  const sum = (list) => list.reduce((n, x) => n + x.bytes, 0)
  // Every picture that was drawn from its first file must have had its whole file fetched afterwards.
  const index = readJson(rel('dist', 'assets', 'index.json'))
  const names = new Set(Object.values(index.sets.web).flatMap((files) => files.map((x) => `assets/${x.path}`)))
  // An address carries the hash of its file (`name?v=sha`): files are told apart by their names.
  const bare = (url) => url.replace(/\?.*$/, '')
  const owed = early.map((x) => bare(x.url)).filter((url) => /\.first\.[a-z0-9]+$/i.test(url)).map((url) => url.replace(/\.first(\.[a-z0-9]+)$/i, '$1'))
  const missing = owed.filter((url) => names.has(url) && !late.some((x) => bare(x.url) === url))
  const twice = early.filter((x) => late.some((y) => bare(y.url) === bare(x.url))).map((x) => bare(x.url))
  // The first files of the season the page opened with: when it fetched none of them, it did not start from what the first picture needs.
  const firstFiles = [...names].filter((n) => n.startsWith('assets/shared/') || n.startsWith(`assets/${cfg.defaultSeason}/`)).filter((n) => /\.first\.[a-z0-9]+$/i.test(n)).length
  return {
    still: stillUrl && timing.marks.still < timing.marks.first ? { seconds: timing.marks.still / 1000, kb: sum(forStill) / 1000, requests: forStill.length, file: stillUrl.replace(/\?.*$/, '') } : null,
    firstPictureSeconds: (seen.first - t) / 1000,
    wholeSeconds: (seen.ready - t) / 1000,
    before: { mb: mb(sum(early)), requests: early.length },
    after: { mb: mb(sum(late)), requests: late.length, files: late.map((x) => ({ url: x.url, bytes: x.bytes })) },
    owed: owed.length,
    firstFiles,
    missing,
    twice,
    frames: {
      whileArriving: gaps(timing.marks.first, timing.marks.ready),
      afterwards: gaps(timing.marks.ready, Infinity),
    },
    picture: path.relative(rel(), shot),
    errors: errors.slice(0, 20),
  }
}

const session = await Session.open()
const result = { time: new Date().toISOString(), season, state, tier, format: cfg.formats.hd.id, cameras: {}, live: null }
let failed = ''
try {
  if (only !== 'stills') {
    const l = (result.live = await live(session))
    if (l.still) console.log(`live: the still after ${l.still.seconds.toFixed(2)} s from ${l.still.kb.toFixed(1)} kB in ${l.still.requests} requests, the page and ${l.still.file}`)
    console.log(`live: the first picture after ${l.firstPictureSeconds.toFixed(1)} s from ${l.before.mb.toFixed(2)} MB in ${l.before.requests} requests; the whole pictures after ${l.wholeSeconds.toFixed(1)} s, ${l.after.mb.toFixed(2)} MB more in ${l.after.requests} requests`)
    console.log(
      `live: while the whole pictures arrived, ${l.frames.whileArriving.frames} frames, usual wait ${l.frames.whileArriving.medianMs.toFixed(0)} ms, longest ${l.frames.whileArriving.longestMs.toFixed(0)} ms; afterwards ${l.frames.afterwards.frames} frames, usual ${l.frames.afterwards.medianMs.toFixed(0)} ms, longest ${l.frames.afterwards.longestMs.toFixed(0)} ms`,
    )
    if (!l.still) failed = 'the page painted no still before its first picture'
    else if (l.owed < l.firstFiles) failed = `the page fetched ${l.owed} of the ${l.firstFiles} first files before its first picture: it did not start from what the first picture needs`
    else if (l.missing.length) failed = `the whole file never came for ${l.missing.join(', ')}`
    else if (l.twice.length) failed = `fetched before and again after the first picture: ${l.twice.join(', ')}`
    else if (l.errors.length) failed = `the page logged:\n${l.errors.join('\n')}`
    else console.log(`live: all ${l.owed} pictures drawn from a first file got their whole file, nothing was fetched twice, nothing logged`)
  }
  for (const camera of only === 'live' ? [] : cameras) {
    const spec = stillSpec({ season, state, camera, tier, format: cfg.formats.hd.id, assets: 'web' })
    const files = {}
    const standIns = {}
    for (const [which, extra] of [
      ['first', '&detail=first'],
      ['whole', ''],
    ]) {
      const page = await session.page({ format: spec.format, assets: 'web', extra })
      const file = path.join(dir, `${camera}-${which}.png`)
      const r = await renderStill(session, spec, { file, force: true, page })
      standIns[which] = r.record.standIns
      if (r.record.errors?.length) console.log(`page messages (${camera}, ${which}):\n${r.record.errors.join('\n')}`)
      await page.context().close()
      files[which] = file
    }
    // A part whose files did not load is drawn as a stand-in: the first files must give every part the whole set gives.
    if (standIns.first !== standIns.whole) throw new Error(`${camera}: ${standIns.first} parts are stand-ins from the first files, ${standIns.whole} from the whole set`)
    const d = compare(await pixels(files.first), await pixels(files.whole))
    const meta = await sharp(files.whole).metadata()
    const half = Math.min(600, meta.width)
    const side = async (f) => sharp(f).resize({ width: half }).toBuffer()
    const pair = path.join(dir, `${camera}-pair.jpg`)
    await sharp({ create: { width: half * 2, height: Math.round((meta.height * half) / meta.width), channels: 3, background: '#000' } })
      .composite([
        { input: await side(files.first), left: 0, top: 0 },
        { input: await side(files.whole), left: half, top: 0 },
      ])
      .jpeg({ quality: 92 })
      .toFile(pair)
    result.cameras[camera] = { ...d, first: path.relative(rel(), files.first), whole: path.relative(rel(), files.whole), pair: path.relative(rel(), pair) }
    console.log(
      `${camera}: first files against the whole set · largest difference ${d.largest} of 255, mean ${d.mean.toFixed(3)}, ${d.psnr === null ? 'identical' : `${d.psnr.toFixed(1)} dB`}, ${(d.shareOver2 * 100).toFixed(2)} % of pixels differ by more than 2, ${(d.shareOver8 * 100).toFixed(2)} % by more than 8`,
    )
  }
} finally {
  await session.close()
}
writeJson(path.join(dir, 'result.json'), result)
console.log(`firstlook: ${path.relative(rel(), path.join(dir, 'result.json'))}`)
if (failed) {
  console.log(`firstlook: FAIL · ${failed}`)
  process.exit(1)
}
