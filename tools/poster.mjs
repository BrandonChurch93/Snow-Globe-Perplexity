import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createServer } from 'vite'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { engineHash } from './lib/hashes.mjs'
import { Session, cfg } from './lib/page.mjs'
import { watchPage } from './lib/browser.mjs'

/**
 * The stills the page paints before the app has drawn anything, and the table that says where they go.
 *
 * A still is the app's own picture: the built site is opened as a visitor opens it, once a season, and the frame the app calls
 * its first picture is kept. The same page is then given the size of every other screen a still is drawn for and draws that
 * screen as it would for a visitor who resized the window, still from the files of its first picture and a frame later on the
 * same clock. Nothing is drawn by hand and nothing is drawn by another path, so a still has the camera, the light, the level
 * and the moment the live picture has when it comes in over it.
 * One still per season and screen goes to public/first/<season>-<screen>.avif and .webp, each under a byte budget, with what they
 * were drawn from in public/first/stills.json. The page fetches one of them.
 * The table goes into index.html between the marks `first:begin` and `first:end`: the stills; where the app puts the glass on a
 * screen of any shape (src/app/framing.ts, read through the same build), so the page can place a still before the app runs;
 * and two soft pictures a season, a few hundred bytes each, made of the stills: the page lays one out of focus at its very
 * first paint and brings the still in over it.
 *
 * A still is kept while it was drawn from today's build of the app and today's files of its season, with today's framing, and
 * coded by today's rules; a run draws the others again and writes the table anew. `--season winter,fall` and `--shape phone,wide`
 * draw those again whatever they were drawn from. `--keep` keeps the stills of another build while the framing is theirs: for a
 * change that is known to move no pixel. `--check` draws nothing: it says whether the table and the stills are today's, and
 * exits 1 when they are not.
 * Run `npm run build` first (the stills are drawn from dist/) and again afterwards (the table is part of the page).
 * Files: public/first/*, index.html, and the frames as they were grabbed in out/work/poster/.
 */

const args = parseArgs(process.argv.slice(2))
const F = cfg.formats
const TOP = Object.keys(cfg.live.quality)[0]

/** Raise when a rule of the coding changes, so no still coded by the old rule is kept. */
const CODER = 3
/** The widest screen a wide still is drawn for, as width over height: wider windows than this are rare, narrower ones crop it. */
const WIDEST = 64 / 27
/** The heights a phone's browser leaves of its screen when its bars are in: the camera stands nearer on each, so each is drawn. */
const PHONE_HEIGHTS = [750, 667, 590]
/**
 * The screens a still is drawn for. The three sizes the app is judged at come from the config, so they are met exactly.
 * The glass keeps its place and size on any screen (the page lays a still by them); what a still of another shape cannot give
 * is the room behind the glass as this screen's camera sees it, and a narrow screen moves the camera with every change of
 * shape. So the narrow ones are drawn in steps the eye does not read when the live picture comes in.
 */
const SHAPES = [
  { name: 'hd', width: F.hd.width, height: F.hd.height, ratio: 1 },
  { name: 'wide', width: Math.round(F.hd.height * WIDEST), height: F.hd.height, ratio: 1 },
  { name: 'tablet', width: F.tablet.width, height: F.tablet.height, ratio: 1.5 },
  { name: 'phone', width: F.phone.width, height: F.phone.height, ratio: 2 },
  ...PHONE_HEIGHTS.map((height) => ({ name: `phone${height}`, width: F.phone.width, height, ratio: 2 })),
]
const BUDGET = { avif: 60000, webp: 90000 }
/** The quality a still is searched between. A still that does not fit the budget at the lowest is coded smaller, by `SMALLER` a
 * side, until it does: fewer pixels look better than coarser ones from there on. The page lays it at the size it was drawn for. */
const QUALITY = { avif: [34, 70], webp: [46, 86] }
const SMALLER = 0.8
const SMALLEST = 0.4
const EFFORT = { avif: [2, 4], webp: [6, 6] }
/** The few bytes of a still that go into the page itself and lie out of focus where the still will come: the stills they are
 * made of, their longer side in pixels, the rim of repeated pixels that keeps the blur whole to the edge of the screen, and
 * their quality. */
const SOFT = { of: ['wide', 'phone'], px: 32, rim: 2, quality: 90 }
const WAIT_MS = 240000
/** The frames the page draws at a new size before it is grabbed: one fits the picture to the screen and draws all of it. */
const FRAMES_AT_A_SIZE = 1
/** The screen the stills are drawn for turns this many times a second: the time the app is told at each frame. */
const SCREEN_HZ = 60

/** The table: aspects from the narrowest to the widest screen it answers for, heights in CSS pixels, and how fine it is. */
const RANGE = { aspect: [0.3, 3.2], height: [320, 2400] }
const FINEST = { aspect: 0.008, height: 16 }
const TOLERANCE = 0.001
const SCALE = 1e5
const MARKS = [/(\/\*first:begin\*\/)[\s\S]*?(\/\*first:end\*\/)/, 'first:begin', 'first:end']

const dirOut = rel('public', 'first')
const dirWork = rel('out', 'work', 'poster')
const recordFile = path.join(dirOut, 'stills.json')
const pageFile = rel('index.html')
const pick = (v, all) => (v && v !== true ? String(v).split(',') : all)
const round = (v) => Math.round(v * SCALE)

async function framing() {
  const server = await createServer({ configFile: rel('vite.config.ts'), root: rel(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const m = await server.ssrLoadModule('/src/app/framing.ts')
    return (w, h) => {
      const g = m.framingOfRig(m.liveRig(w / h, 0, 0, m.roomUnder(h, null, w)), w, h).globe
      if (Math.abs(g.cx / w - 0.5) > 1e-9) throw new Error(`the glass is not in the middle of a ${w} x ${h} screen: the table and the page take it to be`)
      return [g.cy / h, g.r / h]
    }
  } finally {
    await server.close()
  }
}

/** The table is read between its nodes along straight lines. Nodes are added, by halving, where a line of the table is further
 * than `TOLERANCE` from the app, until every line through a node is within it or as fine as `FINEST`. */
function table(globeAt) {
  const known = new Map()
  const at = (a, h) => {
    const key = `${a}:${h}`
    if (!known.has(key)) known.set(key, globeAt(a * h, h))
    return known.get(key)
  }
  const nodes = { aspect: new Set(RANGE.aspect), height: new Set(RANGE.height) }
  for (const s of [...SHAPES, F.hd]) {
    nodes.aspect.add(s.width / s.height)
    nodes.height.add(s.height)
  }
  const off = (f, from, to, u) => {
    const [a, b, c] = [f(from), f(to), f(from + (to - from) * u)]
    return Math.max(...c.map((v, k) => Math.abs(v - (a[k] + (b[k] - a[k]) * u))))
  }
  const halve = (f, [low, high], finest, into) => {
    const open = [[low, high]]
    let added = 0
    while (open.length) {
      const [from, to] = open.pop()
      if (to - from <= finest || Math.max(off(f, from, to, 0.5), off(f, from, to, 0.25), off(f, from, to, 0.75)) <= TOLERANCE) continue
      const mid = (from + to) / 2
      if (!into.has(mid)) added++
      into.add(mid)
      open.push([from, mid], [mid, to])
    }
    return added
  }
  const done = { aspect: new Set(), height: new Set() }
  for (let added = 1; added > 0; ) {
    added = 0
    for (const h of [...nodes.height]) {
      if (done.height.has(h)) continue
      done.height.add(h)
      added += halve((a) => at(a, h), RANGE.aspect, FINEST.aspect, nodes.aspect)
    }
    for (const a of [...nodes.aspect]) {
      if (done.aspect.has(a)) continue
      done.aspect.add(a)
      added += halve((h) => at(a, h), RANGE.height, FINEST.height, nodes.height)
    }
  }
  const sorted = (set) => [...set].sort((x, y) => x - y)
  const A = sorted(nodes.aspect)
  const H = sorted(nodes.height)
  const g = []
  for (const h of H) for (const a of A) g.push(...at(a, h).map(round))
  return { a: A, h: H, g }
}

/** The best quality that fits the budget. The search is made with a quick encoding, which is the larger of the two, and the
 * careful one then climbs from where the quick one stopped: a search made with the careful one takes minutes a still. */
async function fit(png, kind) {
  const [quick, careful] = EFFORT[kind]
  const [lowest, top] = QUALITY[kind]
  const meta = await sharp(png).metadata()
  for (let scale = 1; scale >= SMALLEST; scale *= SMALLER) {
    const image = scale === 1 ? png : await sharp(png).resize({ width: Math.round(meta.width * scale), kernel: 'lanczos3' }).png().toBuffer()
    const code = (quality, effort) => (kind === 'avif' ? sharp(image).avif({ quality, effort, chromaSubsampling: '4:2:0' }) : sharp(image).webp({ quality, effort, smartSubsample: true })).toBuffer()
    let best = await code(lowest, careful)
    if (best.length > BUDGET[kind]) continue
    let [low, high] = [lowest, top]
    while (high > low) {
      const mid = Math.ceil((low + high) / 2)
      if ((await code(mid, quick)).length <= BUDGET[kind]) low = mid
      else high = mid - 1
    }
    let quality = lowest
    for (let q = Math.max(low, lowest + 1); q <= top; q++) {
      const buffer = await code(q, careful)
      if (buffer.length > BUDGET[kind]) break
      best = buffer
      quality = q
    }
    return { buffer: best, quality, scale: Math.round(scale * 1000) / 1000 }
  }
  throw new Error(`a still does not fit ${BUDGET[kind]} bytes of ${kind} at quality ${lowest}, even at ${SMALLEST} of its size`)
}

/** The files the page fetches only after its first picture: the whole pictures behind the first files, and the other seasons.
 * They are left unanswered, so every frame the page draws here is drawn from what its first picture was drawn from. */
function afterFirst(season) {
  const groups = readJson(rel('dist', 'assets', 'index.json')).sets.web
  const held = new Set()
  for (const [group, files] of Object.entries(groups)) {
    const names = new Set(files.map((f) => f.path))
    for (const f of files) {
      const ours = group === 'shared' || group === season
      const whole = f.path.replace(/\.first(\.[a-z0-9]+)$/i, '$1')
      if (!ours) held.add(`/assets/${f.path}`)
      else if (whole !== f.path && names.has(whole)) held.add(`/assets/${whole}`)
    }
  }
  return held
}

/** Opens the page on a season and hands back a picture of every shape: the first as the page's first picture, the others as the
 * page draws them when its window takes their size. */
async function draw(session, season, shapes, each) {
  const context = await session.browser.newContext({ viewport: { width: shapes[0].width, height: shapes[0].height }, deviceScaleFactor: shapes[0].ratio })
  let closing = false
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(0)
    const errors = watchPage(page)
    page.on('requestfailed', (request) => closing || errors.push(`request failed: ${request.url().replace(session.server.url, '')}`))
    const held = afterFirst(season)
    await page.route((url) => held.has(url.pathname), () => undefined)
    // The page stops at the frame the app calls its first picture, and from there draws a frame only when it is asked for one.
    // Every frame is told the time of a screen that turns `SCREEN_HZ` times a second, whatever this machine takes to draw it:
    // the first picture is then the one a visitor's machine draws, and the frames after it are the moments that follow it.
    await page.addInitScript((hz) => {
      const next = window.requestAnimationFrame.bind(window)
      const first = () => document.documentElement.dataset.firstPicture === '1'
      const waiting = []
      let turns = 0
      let asked = false
      const turn = () => {
        asked = false
        const t = (turns++ * 1000) / hz
        for (const fn of waiting.splice(0)) fn(t)
      }
      window.requestAnimationFrame = (fn) => {
        waiting.push(fn)
        if (!asked && !first()) {
          asked = true
          next(() => (first() ? (asked = false) : turn()))
        }
        return 0
      }
      window.__frames = (n) =>
        new Promise((done) => {
          const one = () => {
            if (n-- <= 0) return done()
            next(() => {
              turn()
              one()
            })
          }
          one()
        })
      // Two turns of the screen with nothing drawn: what was drawn last is then what the screen shows.
      window.__shown = () => new Promise((done) => next(() => next(() => setTimeout(done, 200))))
    }, SCREEN_HZ)
    await page.goto(`${session.server.url}?season=${season}&quality=${TOP}`)
    await page.addStyleTag({ content: '#first, #ui { display: none !important } #view { opacity: 1 !important; transition: none !important }' })
    // Asked on a clock: a wait that asked once a frame would stop with the frames.
    await page.waitForFunction(() => document.documentElement.dataset.firstPicture === '1', null, { timeout: WAIT_MS, polling: 100 })
    const client = await context.newCDPSession(page)
    for (const [i, shape] of shapes.entries()) {
      if (i > 0) {
        await client.send('Emulation.setDeviceMetricsOverride', { width: shape.width, height: shape.height, deviceScaleFactor: shape.ratio, mobile: false })
        await page.evaluate((n) => window.__frames(n), FRAMES_AT_A_SIZE)
      }
      await page.evaluate(() => window.__shown())
      const png = Buffer.from((await client.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')
      const meta = await sharp(png).metadata()
      const want = [Math.round(shape.width * shape.ratio), Math.round(shape.height * shape.ratio)]
      if (meta.width !== want[0] || meta.height !== want[1]) throw new Error(`the page of ${season}, ${shape.name} was grabbed at ${meta.width} x ${meta.height}, not ${want[0]} x ${want[1]}`)
      const size = await page.evaluate(() => {
        const c = document.getElementById('view')
        return [c.width, c.height]
      })
      if (size[0] !== want[0] || size[1] !== want[1]) throw new Error(`the page of ${season}, ${shape.name} drew ${size[0]} x ${size[1]}, not ${want[0]} x ${want[1]}`)
      if (errors.length) throw new Error(`the page of ${season}, ${shape.name} logged:\n${errors.join('\n')}`)
      each(shape, png)
    }
  } finally {
    closing = true
    await context.close()
  }
}

const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex')
const fileOf = (season, shape, kind) => path.join(dirOut, `${season}-${shape}.${kind}`)

function versions(record) {
  const out = {}
  for (const shape of SHAPES) {
    const h = crypto.createHash('sha256')
    for (const season of cfg.seasons) for (const kind of Object.keys(BUDGET)) h.update(record.stills[`${season}-${shape.name}`]?.[kind]?.sha ?? '')
    out[shape.name] = h.digest('hex').slice(0, 8)
  }
  return out
}

/** Where a still lies on a screen when its glass is laid on the screen's glass: the page's own sum (index.html, `boxOf`). */
function boxOf(still, screen, globeAt) {
  const [cy, r] = globeAt(screen.width, screen.height)
  const [stillCy, stillR] = globeAt(still.width, still.height)
  const k = (r * screen.height) / (stillR * still.height)
  return { x: screen.width / 2 - (still.width * k) / 2, y: cy * screen.height - stillCy * still.height * k, w: still.width * k, h: still.height * k }
}

/** The soft picture that goes before a still: the one that leaves the least of the still's screen bare from the nearest. */
function softOf(shape, globeAt) {
  let best = 0
  let least = Infinity
  SOFT.of.forEach((name, i) => {
    const b = boxOf(SHAPES.find((s) => s.name === name), shape, globeAt)
    const all = shape.width * shape.height
    const seen = Math.max(0, Math.min(shape.width, b.x + b.w) - Math.max(0, b.x)) * Math.max(0, Math.min(shape.height, b.y + b.h) - Math.max(0, b.y))
    const off = 4 * (1 - seen / all) + Math.abs(Math.log((b.w * b.h) / all))
    if (off < least) {
      least = off
      best = i
    }
  })
  return best
}

const softList = () =>
  SOFT.of.map((name) => {
    const shape = SHAPES.find((s) => s.name === name)
    const long = Math.max(shape.width, shape.height)
    return { name, index: SHAPES.indexOf(shape), width: Math.max(1, Math.round((SOFT.px * shape.width) / long)), height: Math.max(1, Math.round((SOFT.px * shape.height) / long)) }
  })

/** The soft pictures of every season, made of the stills as the page will fetch them. */
async function softs() {
  const rim = { top: SOFT.rim, bottom: SOFT.rim, left: SOFT.rim, right: SOFT.rim, extendWith: 'copy' }
  const b = {}
  for (const season of cfg.seasons) {
    b[season] = []
    for (const soft of softList()) {
      const file = fileOf(season, soft.name, 'webp')
      if (!fs.existsSync(file)) throw new Error(`no still to make a soft picture of: ${path.relative(rel(), file)}`)
      const coded = await sharp(file).resize(soft.width, soft.height, { fit: 'fill', kernel: 'lanczos3' }).extend(rim).webp({ quality: SOFT.quality, effort: 6, smartSubsample: true }).toBuffer()
      b[season].push(coded.toString('base64'))
    }
  }
  return b
}

/** The table: the stills and the soft picture each is preceded by, where the app puts the glass, the soft pictures (`p` says
 * which still each is made of, its size and its rim; `b` holds them, season by season). */
function tableOf(record, grid, globeAt, b) {
  const v = versions(record)
  const stills = SHAPES.map((s) => [s.name, s.width, s.height, ...globeAt(s.width, s.height).map(round), v[s.name], softOf(s, globeAt)])
  return { season: cfg.defaultSeason, seasons: cfg.seasons, stills, a: grid.a, h: grid.h, g: grid.g, p: softList().map((soft) => [soft.index, soft.width, soft.height, SOFT.rim]), b }
}

const globeAt = await framing()
const grid = table(globeAt)
const record = fs.existsSync(recordFile) ? readJson(recordFile) : { stills: {} }
const html = fs.readFileSync(pageFile, 'utf8')
if (!MARKS[0].test(html)) throw new Error(`index.html has no place for the table: the marks ${MARKS[1]} and ${MARKS[2]} are missing`)

/** What a still is drawn from: the app as built, and the files of its season as the built site serves them. */
const built = fs.existsSync(rel('dist', 'assets', 'index.json')) ? readJson(rel('dist', 'assets', 'index.json')).sets.web : {}
const engine = engineHash()
const drawnFrom = (season) => sha(JSON.stringify([engine, built.shared, built[season]])).slice(0, 16)

/** A still is good while it is a picture of today's app, with the glass where the app puts it today. */
const stale = (season, shape) => {
  const r = record.stills[`${season}-${shape.name}`]
  if (!r || r.width !== shape.width || r.height !== shape.height || r.ratio !== shape.ratio) return 'not drawn'
  if (r.coder !== CODER) return 'coded by an older rule'
  if (args.keep !== true && r.from !== drawnFrom(season)) return 'drawn from another build of the app or other files'
  if (JSON.stringify(r.globe) !== JSON.stringify(globeAt(shape.width, shape.height).map(round))) return 'drawn with another framing'
  for (const kind of Object.keys(BUDGET)) {
    const file = fileOf(season, shape.name, kind)
    if (!fs.existsSync(file) || sha(fs.readFileSync(file)) !== r[kind]?.sha) return `${kind} file missing or changed`
  }
  return ''
}

if (args.check === true) {
  const reasons = new Map()
  for (const season of cfg.seasons)
    for (const shape of SHAPES) {
      const reason = stale(season, shape)
      if (reason) reasons.set(reason, [...(reasons.get(reason) ?? []), `${season}-${shape.name}`])
    }
  const problems = [...reasons].map(([reason, names]) => `${names.length > 4 ? `${names.length} stills` : names.join(', ')}: ${reason}`)
  // The soft pictures are coded bytes, which another machine may code another way: the page has to hold one for each.
  const want = tableOf(record, grid, globeAt, undefined)
  let held = null
  try {
    held = JSON.parse(MARKS[0].exec(html)[0].slice(`/*${MARKS[1]}*/`.length, -`/*${MARKS[2]}*/`.length))
  } catch {
    held = null
  }
  const { b: softHeld, ...rest } = held ?? {}
  if (JSON.stringify(rest) !== JSON.stringify(want)) problems.push('the table in index.html is not the one today\'s framing and stills give')
  else if (!cfg.seasons.every((season) => softHeld?.[season]?.length === SOFT.of.length && softHeld[season].every((data) => typeof data === 'string' && data.length > 0))) problems.push('the table in index.html does not hold the soft pictures of every season')
  if (problems.length) {
    console.log(`poster: FAIL · ${problems.join('; ')}. Run npm run build, then node tools/poster.mjs.`)
    process.exit(1)
  }
  console.log(`poster: pass · ${cfg.seasons.length * SHAPES.length} stills and the table agree with the framing (${grid.a.length} aspects by ${grid.h.length} heights)`)
  process.exit(0)
}

const seasons = pick(args.season, cfg.seasons)
const shapes = pick(args.shape, SHAPES.map((s) => s.name))
for (const s of seasons) if (!cfg.seasons.includes(s)) throw new Error(`no such season: ${s}`)
for (const s of shapes) if (!SHAPES.some((x) => x.name === s)) throw new Error(`no such shape: ${s}`)
const named = args.season !== undefined || args.shape !== undefined
const why = (season, shape) => (named && seasons.includes(season) && shapes.includes(shape.name) ? 'asked for' : stale(season, shape))
const todo = cfg.seasons.map((season) => ({ season, shapes: SHAPES.filter((shape) => why(season, shape)) })).filter((t) => t.shapes.length)
const drawn = todo.reduce((n, t) => n + t.shapes.length, 0)
if (drawn) {
  const reasons = new Map()
  for (const t of todo) for (const shape of t.shapes) reasons.set(why(t.season, shape), (reasons.get(why(t.season, shape)) ?? 0) + 1)
  console.log(`poster: ${drawn} stills to draw (${[...reasons].map(([reason, n]) => `${n} ${reason}`).join(', ')})`)
}

fs.mkdirSync(dirOut, { recursive: true })
fs.mkdirSync(dirWork, { recursive: true })
const session = todo.length ? await Session.open() : null
try {
  for (const t of todo) {
    const t0 = Date.now()
    const coding = []
    await draw(session, t.season, t.shapes, (shape, png) => {
      fs.writeFileSync(path.join(dirWork, `${t.season}-${shape.name}.png`), png)
      // Coded while the next one is drawn.
      coding.push(
        Promise.all(Object.keys(BUDGET).map((kind) => fit(png, kind))).then((coded) => {
          const entry = { season: t.season, shape: shape.name, width: shape.width, height: shape.height, ratio: shape.ratio, globe: globeAt(shape.width, shape.height).map(round), from: drawnFrom(t.season), coder: CODER }
          Object.keys(BUDGET).forEach((kind, i) => {
            const { buffer, quality, scale } = coded[i]
            fs.writeFileSync(fileOf(t.season, shape.name, kind), buffer)
            entry[kind] = { bytes: buffer.length, quality, scale, sha: sha(buffer) }
          })
          record.stills[`${t.season}-${shape.name}`] = entry
          // Kept as each one is done: a run that stops half way is taken up where it stopped.
          writeJson(recordFile, record)
          const said = (kind) => `${kind} ${(entry[kind].bytes / 1000).toFixed(1)} kB at quality ${entry[kind].quality}${entry[kind].scale < 1 ? ` and ${entry[kind].scale} of its size` : ''}`
          console.log(`${t.season}-${shape.name}: ${shape.width} x ${shape.height} at ${shape.ratio}, ${said('avif')}, ${said('webp')}`)
        }),
      )
    })
    await Promise.all(coding)
    console.log(`${t.season}: ${t.shapes.length} stills in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  }
} finally {
  await session?.close()
}
let vouched = 0
for (const [key, r] of Object.entries(record.stills)) {
  const [season, shape] = key.split('-')
  if (!cfg.seasons.includes(season) || !SHAPES.some((s) => s.name === shape)) delete record.stills[key]
  else if (args.keep === true && r.from !== drawnFrom(season)) {
    // Kept on the word of whoever ran this: from here on they count as pictures of today's build.
    r.from = drawnFrom(season)
    vouched++
  }
}
for (const f of fs.readdirSync(dirOut)) {
  const m = /^(.+)-([^-.]+)\.(avif|webp)$/.exec(f)
  if (m && !record.stills[`${m[1]}-${m[2]}`]) fs.rmSync(path.join(dirOut, f))
}
record.stills = Object.fromEntries(Object.entries(record.stills).sort(([x], [y]) => (x < y ? -1 : 1)))
writeJson(recordFile, record)
// Read again: the page may have been worked on while the stills were drawn.
const text = JSON.stringify(tableOf(record, grid, globeAt, await softs()))
fs.writeFileSync(pageFile, fs.readFileSync(pageFile, 'utf8').replace(MARKS[0], (_all, begin, end) => `${begin} ${text} ${end}`))
console.log(`poster: ${drawn} stills drawn, ${cfg.seasons.length * SHAPES.length - drawn} kept${vouched ? ` (${vouched} of them from another build, on --keep)` : ''}; the table holds ${grid.a.length} aspects by ${grid.h.length} heights`)
