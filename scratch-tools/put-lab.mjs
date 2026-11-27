// node out/work/p6s/put-lab.mjs <url> <name> [variants=a,b] [cases=a,b] [gpu]
// A trial of ways to lay the first still, on one built page: the page's document is answered with its `put` swapped for
// another, nothing else changed. The app runs and says where the globe stands; none of its fetches is answered, so no
// live picture comes and the still stays. One picture for each way and window, with what the page gave the picture.
import fs from 'node:fs'
import { chromium } from 'playwright-core'
import { findBrowser, softwareRenderer } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/', name = 'put-lab', variantsArg = '', casesArg = '', mode = ''] = process.argv
const gpu = mode.includes('gpu') ? 'gpu' : ''
const real = mode.includes('real')
const out = `/home/user/workspace/snow-globe/out/work/p6s/${name}`
fs.mkdirSync(out, { recursive: true })

const NOTE = `img.__b = { x: b.x, y: b.y, w: b.w, h: b.h }`
const PLAIN = `function put(img, b) {
  ${NOTE}
  img.style.left = b.x + 'px'
  img.style.top = b.y + 'px'
  img.style.width = b.w + 'px'
  img.style.height = b.h + 'px'
}`
const V2 = `function put(img, b) {
  ${NOTE}
  var w = Math.round(b.w) || 1
  var h = Math.round(b.h) || 1
  img.style.left = img.style.top = '0'
  img.style.width = w + 'px'
  img.style.height = h + 'px'
  img.style.transformOrigin = '0 0'
  img.style.transform = 'matrix(' + [b.w / w, 0, 0, b.h / h, b.x, b.y].join(',') + ')'
}`
const v3 = (o = {}) => `function put(img, b) {
  ${NOTE}
  var NEAR = 0.1
  var d = window.devicePixelRatio || 1
  var edges = [b.x, b.y, b.x + b.w, b.y + b.h]
  var off = 0
  for (var i = 0; i < 4; i++) off = Math.max(off, Math.abs(edges[i] * d - Math.round(edges[i] * d)))
  var whole = off < NEAR
  var w = whole ? b.w : (Math.round(b.w * d) || 1) / d
  var h = whole ? b.h : (Math.round(b.h * d) || 1) / d
  ${
    o.natural
      ? `var plainly = !img.style.maskImage && img.src.slice(0, 5) !== 'data:'
  if (!whole && plainly && img.naturalWidth && img.naturalWidth / d > b.w) {
    w = img.naturalWidth / d
    h = img.naturalHeight / d
  } else if (!whole && plainly && !img.naturalWidth && !img.__waits) {
    img.__waits = true
    img.addEventListener('load', function () {
      img.__waits = false
      put(img, img.__b)
    })
  }`
      : ''
  }
  img.style.left = (whole ? b.x : 0) + 'px'
  img.style.top = (whole ? b.y : 0) + 'px'
  img.style.width = w + 'px'
  img.style.height = h + 'px'
  img.style.transformOrigin = '0 0'
  img.style.transform = whole ? '' : 'matrix(' + [b.w / w, 0, 0, b.h / h, b.x, b.y].join(',') + ')'
  ${o.will ? `img.style.willChange = whole ? '' : 'transform'` : ''}
  ${o.low ? `img.style.imageRendering = whole ? '' : '-webkit-optimize-contrast'` : ''}
  ${o.three ? `img.style.transform = whole ? '' : 'matrix3d(' + [b.w / w, 0, 0, 0, 0, b.h / h, 0, 0, 0, 0, 1, 0, b.x, b.y, 0, 1].join(',') + ')'` : ''}
}`
const v4 = (o = {}) => `function put(img, b) {
  ${NOTE}
  var NEAR = 0.1
  var d = window.devicePixelRatio || 1
  var edges = [b.x, b.y, b.x + b.w, b.y + b.h]
  var off = 0
  for (var i = 0; i < 4; i++) off = Math.max(off, Math.abs(edges[i] * d - Math.round(edges[i] * d)))
  var whole = off < NEAR
  var both = function (v) {
    var n = Math.round(v) || 1
    for (var i = 0; i < 16; i++) if (Math.abs((n + i) * d - Math.round((n + i) * d)) < 1e-3) return n + i
    return n
  }
  var w = whole ? b.w : both(b.w)
  var h = whole ? b.h : both(b.h)
  img.style.left = (whole ? b.x : 0) + 'px'
  img.style.top = (whole ? b.y : 0) + 'px'
  img.style.width = w + 'px'
  img.style.height = h + 'px'
  img.style.transformOrigin = '0 0'
  img.style.transform = whole ? '' : 'matrix(' + [b.w / w, 0, 0, b.h / h, b.x, b.y].join(',') + ')'
  ${o.will ? `img.style.willChange = !whole && !img.style.maskImage && img.naturalWidth >= ${o.from || 2} * w * d ? 'transform' : ''
  if (!img.naturalWidth && !img.__waits) {
    img.__waits = true
    img.addEventListener('load', function () {
      img.__waits = false
      put(img, img.__b)
    })
  }` : ''}
}`
const v5 = (o = {}) => `function put(img, b) {
  ${NOTE}
  var NEAR = 0.1
  var HAIR = ${o.hair === undefined ? 1e-5 : o.hair}
  var d = window.devicePixelRatio || 1
  var far = function (n) {
    var e = [b.x, b.y, b.x + b.w, b.y + b.h]
    var most = 0
    for (var i = 0; i < 4; i++) most = Math.max(most, Math.abs(e[i] * d * n - Math.round(e[i] * d * n)) / n)
    return most
  }
  var both = function (v) {
    var n = Math.round(v) || 1
    for (var i = 0; i < 100; i++) if (Math.abs((n + i) * d - Math.round((n + i) * d)) < 1e-3) return n + i
    return n
  }
  var whole = far(1) < NEAR ${o.css ? '&& far(1 / d) * d < NEAR' : ''}
  var W = img.naturalWidth / 2 / d
  var H = img.naturalHeight / 2 / d
  var halved = !whole && !img.style.maskImage && far(2) < NEAR && Math.abs(b.w - W) * d < NEAR && Math.abs(b.h - H) * d < NEAR
  var to = halved ? { x: b.x + (b.w - W * (1 + HAIR)) / 2, y: b.y + (b.h - H * (1 + HAIR)) / 2, w: W * (1 + HAIR), h: H * (1 + HAIR) } : b
  var w = whole ? b.w : both(b.w)
  var h = whole ? b.h : both(b.h)
  img.style.left = (whole ? b.x : 0) + 'px'
  img.style.top = (whole ? b.y : 0) + 'px'
  img.style.width = w + 'px'
  img.style.height = h + 'px'
  img.style.transformOrigin = '0 0'
  img.style.transform = whole ? '' : 'matrix(' + [to.w / w, 0, 0, to.h / h, to.x, to.y].join(',') + ')'
  img.style.willChange = halved ${o.nolayer ? '&& false' : ''} ? 'transform' : ''
  if (!img.naturalWidth) img.addEventListener('load', function () { put(img, b) }, { once: true })
}`
const VARIANTS = {
  page: 'page',
  v5: v5(),
  v5in: v5({ nolayer: true }),
  v5c: v5({ css: true }),
  v5h6: v5({ hair: 1e-6 }),
  v5h0: v5({ hair: 0 }),
  v4: v4(),
  v4w: v4({ will: true }),
  plain: PLAIN,
  v2: V2,
  v3: v3(),
  v3w: v3({ will: true }),
  v3low: v3({ low: true }),
  v3wlow: v3({ will: true, low: true }),
  nat: v3({ natural: true }),
  natw: v3({ natural: true, will: true }),
  natlow: v3({ natural: true, low: true }),
}
const CASES = [
  ['600', 600, 600, 1],
  ['601', 601, 600, 1],
  ['hd', 1920, 1080, 1],
  ['1280', 1280, 720, 1],
  ['1366', 1366, 768, 1],
  ['640', 640, 640, 1],
  ['1536-at-125', 1536, 864, 1.25],
  ['1440-at-2', 1440, 900, 2],
  ['phone-at-3', 390, 844, 3],
  ['iphone-at-3', 390, 664, 3],
  ['tablet-at-2', 1024, 1366, 2],
  ['ipad-at-2', 820, 1180, 2],
  ['320', 320, 320, 1],
  ['360', 360, 640, 1],
  ['800', 800, 600, 1],
  ['1024', 1024, 768, 1],
  ['2560', 2560, 1440, 1],
  ['1920-at-2', 1920, 1080, 2],
  ['412-at-2625', 412, 915, 2.625],
  ['360-at-3', 360, 800, 3],
  ['600-at-2', 600, 600, 2],
  ['590', 590, 590, 1],
  ['560', 560, 560, 1],
  ['500', 500, 500, 1],
  ['400', 400, 400, 1],
  ['600x481', 600, 481, 1],
  ['500x720', 500, 720, 1],
  ['640x600', 640, 600, 1],
  ['1280-at-15', 1280, 720, 1.5],
  ['1500-at-15', 1500, 800, 1.5],
  ['1100-at-11', 1100, 700, 1.1],
  ['598x600', 598, 600, 1],
  ['480x600', 480, 600, 1],
  ['700x600', 700, 600, 1],
  ['560x481', 560, 481, 1],
  ['700x481', 700, 481, 1],
  ['599x481', 599, 481, 1],
  ['600x720', 600, 720, 1],
  ['400x720', 400, 720, 1],
  ['300-at-2', 300, 300, 2],
  ['320x300-at-2', 320, 300, 2],
  ['250x360-at-2', 250, 360, 2],
  ['480-at-125', 480, 480, 1.25],
  ['576x576-at-125', 576, 576, 1.25],
  ['400-at-15', 400, 400, 1.5],
  ['1366-at-125', 1366, 768, 1.25],
  ['1280-at-175', 1280, 720, 1.75],
  ['1500-at-165', 1500, 800, 1.65],
  ['600-real', 600, 687, 1],
  ['600x481-real', 600, 568, 1],
  ['640x600-real', 640, 687, 1],
  ['500x720-real', 500, 807, 1],
  ['598x600-real', 598, 687, 1],
  ['601-real', 601, 687, 1],
  ['1200x1287-at-2-real', 1200, 1287, 2],
  ['600-at-2-real', 600, 687, 2],
  ['601-at-2-real', 601, 687, 2],
  ['600x481-at-2-real', 600, 568, 2],
  ['601-at-2', 601, 600, 2],
  ['600x481-at-2', 600, 481, 2],
  ['501-at-15-real', 501, 687, 1.5],
  ['501-at-15', 501, 600, 1.5],
]
const variants = Object.keys(VARIANTS).filter((v) => !variantsArg || variantsArg === 'all' || variantsArg.split(',').includes(v))
const cases = CASES.filter((c) => !casesArg || casesArg === 'all' || casesArg.split(',').includes(c[0]))

const swap = (html, body) => {
  if (body === 'page') {
    // The page's own put, untouched but for its name: the one in front of it only writes down where the picture was sent.
    if (html.split('function put(img, b) {').length !== 2) throw new Error('no put() in the page')
    return html.replace('function put(img, b) {', 'function put(img, b) {\n  img.__b = { x: b.x, y: b.y, w: b.w, h: b.h }\n  return put0(img, b)\n}\nfunction put0(img, b) {')
  }
  const a = html.indexOf('function put(img, b) {')
  const e = html.indexOf('\n        }\n', a) + '\n        }'.length
  if (a < 0 || e < a) throw new Error('no put() in the page')
  return html.slice(0, a) + body + html.slice(e)
}

const soft = softwareRenderer()
const flags = gpu === 'gpu' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : soft.flags
const open = (more = []) =>
  chromium.launch({
    executablePath: findBrowser(),
    headless: true,
    args: [...flags, '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...more],
    ...(gpu !== 'gpu' && soft.env ? { env: soft.env } : {}),
  })
let browser = real ? null : await open()
const rows = []
const jobs = []
for (const c of cases) for (const v of variants) jobs.push([c, v])

const one = async ([label, width, height, dpr], v) => {
  const own = real ? await open([`--force-device-scale-factor=${dpr}`, `--window-size=${width},${height}`]) : null
  const context = real ? await own.newContext({ viewport: null }) : await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr })
  const page = await context.newPage()
  const lines = []
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && lines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
  await page.addInitScript(() => {
    window.__globes = []
    let kept
    Object.defineProperty(window, 'firstStill', {
      configurable: true,
      get: () => kept,
      set: (f) => {
        const place = f.place
        f.place = (globe, again) => {
          window.__globes.push(globe ? { cx: globe.cx, cy: globe.cy, r: globe.r, at: performance.now() } : null)
          return place(globe, again)
        }
        kept = f
      },
    })
  })
  await page.route('**/*', async (route) => {
    const kind = route.request().resourceType()
    if (kind === 'document') {
      const res = await route.fetch()
      await route.fulfill({ response: res, body: swap(await res.text(), VARIANTS[v]) })
    } else if (kind === 'fetch' || kind === 'xhr') return
    else await route.continue().catch(() => {})
  })
  await page.goto(url, { waitUntil: 'commit' })
  const read = () =>
    page.evaluate(() => {
      const imgs = [...document.querySelectorAll('#first img')]
      const softs = imgs.filter((i) => i.src.startsWith('data:')).length
      const top = imgs.filter((i) => !i.src.startsWith('data:')).pop()
      const said = window.__globes.filter(Boolean)
      const r = top ? top.getBoundingClientRect() : null
      return {
        pictures: imgs.length,
        softs,
        whole: !!top && top.complete && top.naturalWidth > 0 && (top.style.opacity === '' || top.style.opacity === '1'),
        said: said.length,
        lastSaidMs: said.length ? performance.now() - said[said.length - 1].at : null,
        globe: said.length ? said[said.length - 1] : null,
        file: top ? top.currentSrc.split('/').pop() : null,
        natural: top ? [top.naturalWidth, top.naturalHeight] : null,
        b: top ? top.__b : null,
        style: top ? { left: top.style.left, top: top.style.top, width: top.style.width, height: top.style.height, transform: top.style.transform, mask: top.style.maskImage, will: top.style.willChange, rendering: top.style.imageRendering } : null,
        box: r ? [r.x, r.y, r.width, r.height] : null,
        ratio: window.devicePixelRatio,
        inner: [window.innerWidth, window.innerHeight],
        cannot: document.documentElement.hasAttribute('data-cannot'),
        all: imgs.map((i) => ({ data: i.src.startsWith('data:'), nat: [i.naturalWidth, i.naturalHeight], b: i.__b, width: i.style.width, height: i.style.height, left: i.style.left, transform: i.style.transform, mask: !!i.style.maskImage, will: i.style.willChange, opacity: i.style.opacity, filter: i.style.filter })),
      }
    })
  const t0 = Date.now()
  let x = await read()
  while (Date.now() - t0 < 120000 && !(x.whole && x.softs === 0 && x.said > 0 && x.lastSaidMs > 1500)) {
    await page.waitForTimeout(250)
    x = await read()
  }
  await page.waitForTimeout(800)
  x = await read()
  fs.writeFileSync(`${out}/${label}--${v}.png`, await page.screenshot({ type: 'png' }))
  const row = { label, variant: v, width, height, dpr, waitedMs: Date.now() - t0, ...x, console: lines }
  rows.push(row)
  console.log(JSON.stringify({ label, v, ms: row.waitedMs, ratio: x.ratio, inner: x.inner, whole: x.whole, said: x.said, pictures: x.pictures, file: x.file, natural: x.natural, b: x.b && [x.b.x, x.b.y, x.b.w, x.b.h].map((n) => Math.round(n * 1e4) / 1e4), style: x.style, cannot: x.cannot, console: lines.length }))
  await context.close()
  if (own) await own.close()
}

const AT_ONCE = 3
let next = 0
await Promise.all(
  Array.from({ length: AT_ONCE }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++]
      try {
        await one(j[0], j[1])
      } catch (e) {
        console.log(`failed ${j[0][0]} ${j[1]}: ${e.message}`)
      }
    }
  }),
)
fs.writeFileSync(`${out}/rows.json`, JSON.stringify(rows, null, 1))
if (browser) await browser.close()
