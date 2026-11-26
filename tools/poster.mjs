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
 * screen of any shape over controls of any height (src/app/framing.ts, read through the same build); how high the controls
 * stand on any screen, as the app measured them on this build under every way the interface's media rules hold together, so
 * the page can place a still where the globe will stay before the app or its interface has run; and two soft pictures a
 * season, a few hundred bytes each, made of the stills: the page lays one out of focus at its very first paint and brings the
 * still in over it.
 *
 * A still is kept while it was drawn from today's build of the app and today's files of its season, with today's framing, and
 * coded by today's rules; a run draws the others again and writes the table anew. `--season winter,fall` and `--shape phone,wide`
 * draw those again whatever they were drawn from, and with `--only` nothing but those: the others stay as they are, and
 * `--check` goes on saying which of them are not today's. `--keep` keeps the stills of another build while the framing is
 * theirs: for a change that is known to move no pixel. `--check` draws nothing: it says whether the table and the stills are
 * today's, and exits 1 when they are not.
 * Run `npm run build` first (the stills are drawn from dist/) and again afterwards (the table is part of the page).
 * Files: public/first/*, index.html, and the frames as they were grabbed in out/work/poster/.
 */

const args = parseArgs(process.argv.slice(2))
const F = cfg.formats
const TOP = Object.keys(cfg.live.quality)[0]
const LOWEST = Object.keys(cfg.live.quality).at(-1)

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

/** The table: aspects from the narrowest to the widest screen it answers for, the height of the controls as a share of the
 * screen's height, and how fine it is. The framing knows no pixels: a screen twice the size with controls twice as high has
 * the glass in the same place. */
const RANGE = { aspect: [0.3, 3.2], share: [0, 0.4] }
const FINEST = { aspect: 0.008, share: 0.004 }
/** The screens the controls are measured on: small and at the lowest level, since only their place is read, and from the
 * smallest to the largest window the rules are asked about. */
const PROBE = { width: 800, height: 600, ratio: 0.2, widths: [320, 3200], heights: [320, 2400] }
/** The safe area under the page the controls are measured over: one no screen has, to find where they begin to rise, and the
 * two a phone reports for its home indicator, lying and upright, where the page's sum is checked against the measure. */
const INSET = { most: 120, usual: [21, 34] }
/** How far the page's reading of the table may be from the app, as a share of the screen's height. A row is held to half of
 * it, which leaves the other half to the line between two rows. */
const TOLERANCE = 0.001
const ROW_TOLERANCE = TOLERANCE / 2
/** How near the two sides of a step in the framing are found, in aspect. */
const STEP = 1e-6
const KEEP_EVERY = 3000
const SCALE = 1e5
const MARKS = [/(\/\*first:begin\*\/)[\s\S]*?(\/\*first:end\*\/)/, 'first:begin', 'first:end']

const dirOut = rel('public', 'first')
const dirWork = rel('out', 'work', 'poster')
const recordFile = path.join(dirOut, 'stills.json')
const pageFile = rel('index.html')
const pick = (v, all) => (v && v !== true ? String(v).split(',') : all)
const round = (v) => Math.round(v * SCALE)
const tidy = (v, to) => Math.round(v * to) / to

async function framing() {
  const server = await createServer({ configFile: rel('vite.config.ts'), root: rel(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const m = await server.ssrLoadModule('/src/app/framing.ts')
    const UNIT = 1000
    const at = (aspect, under) => {
      const g = m.framingOfRig(m.liveRig(aspect, 0, 0, under), aspect * UNIT, UNIT).globe
      if (Math.abs(g.cx / (aspect * UNIT) - 0.5) > 1e-9) throw new Error(`the glass is not in the middle of a screen of aspect ${aspect}: the table and the page take it to be`)
      return [g.cy / UNIT, g.r / UNIT]
    }
    const estimate = [m.FRAME.barShare, m.FRAME.barPx, m.FRAME.barMost]
    // The page makes the app's own sum for the controls it knows no height of: it is checked here against the app's.
    for (const [w, h] of [[390, 844], [1920, 1080], [844, 390], [3000, 2400]]) {
      const px = Math.min(Math.max(estimate[0] * h, estimate[1]), estimate[2] * h)
      if (Math.abs(m.roomUnder(h, null, w) - m.roomUnder(h, px, w)) > 1e-12) throw new Error('the bar the app takes before it has measured one (src/app/framing.ts, roomUnder) is no longer the sum index.html makes of it')
    }
    // Asking the app takes milliseconds a place and the table asks tens of thousands: the answers of one build are kept, and
    // written as they come, so a run that is stopped has not asked for nothing.
    const file = path.join(dirWork, `framing-${engine}.json`)
    const known = new Map(fs.existsSync(file) ? Object.entries(readJson(file)) : [])
    let fresh = 0
    const keep = () => {
      if (!fresh) return
      fs.mkdirSync(dirWork, { recursive: true })
      for (const name of fs.readdirSync(dirWork)) if (/^framing-.*\.json$/.test(name) && path.join(dirWork, name) !== file) fs.rmSync(path.join(dirWork, name))
      fs.writeFileSync(file, JSON.stringify(Object.fromEntries(known)))
      fresh = 0
    }
    return {
      /** Where the app puts the glass on a screen of this aspect whose controls stand this share of its height high: the centre
       * and the radius, as shares of the height. */
      globe: (aspect, share) => {
        const key = `${aspect}:${share}`
        if (!known.has(key)) {
          known.set(key, at(aspect, m.roomUnder(UNIT, share * UNIT, aspect * UNIT)))
          if (++fresh >= KEEP_EVERY) keep()
        }
        return known.get(key)
      },
      keep,
      estimate,
    }
  } finally {
    await server.close()
  }
}

/** The table holds a row for an aspect: the glass over controls of every height, as the points where its line bends, read
 * along straight lines between them. Between two rows the page reads along a straight line at the share asked.
 * A row is the app asked at every `FINEST.share`, and keeps the fewest of those points that hold all of them within
 * `ROW_TOLERANCE`. Rows are added, by halving, where the page's reading between two rows is further than `TOLERANCE` from the
 * app, until they are as near as `FINEST.aspect`. Where the app steps from one framing to another at an aspect (an upright
 * screen becomes a broad one), the two sides of the step are rows `STEP` apart, so the page reads no screen across it.
 * The screens the stills are drawn for are points of rows, so the page lays each of them exactly where it was drawn. */
function table(globe, screens) {
  const [least, most] = RANGE.share
  const count = Math.round((most - least) / FINEST.share)
  const shares = Array.from({ length: count + 1 }, (_, i) => tidy(least + ((most - least) * i) / count, 1e9))
  const asked = new Map()
  const ask = (a) => {
    if (!asked.has(a)) {
      const us = [...new Set([...shares, ...screens.filter((s) => s.aspect === a).map((s) => s.share)])].sort((x, y) => x - y)
      asked.set(a, { us, vs: us.map((u) => globe(a, u)), must: new Set(screens.filter((s) => s.aspect === a).map((s) => s.share)) })
    }
    return asked.get(a)
  }
  const rows = new Map()
  const rowOf = (a) => {
    if (rows.has(a)) return rows.get(a)
    const { us, vs, must } = ask(a)
    const keep = new Set([0, us.length - 1])
    us.forEach((u, i) => must.has(u) && keep.add(i))
    const bend = (i, j) => {
      let worst = 0
      let at = -1
      for (let k = i + 1; k < j; k++) {
        const t = (us[k] - us[i]) / (us[j] - us[i])
        const off = Math.max(...vs[k].map((v, c) => Math.abs(v - (vs[i][c] + (vs[j][c] - vs[i][c]) * t))))
        if (off > worst) [worst, at] = [off, k]
      }
      if (worst <= ROW_TOLERANCE) return
      keep.add(at)
      bend(i, at)
      bend(at, j)
    }
    const ends = [...keep].sort((x, y) => x - y)
    for (let k = 0; k + 1 < ends.length; k++) bend(ends[k], ends[k + 1])
    rows.set(a, [...keep].sort((x, y) => x - y).flatMap((i) => [us[i], ...vs[i].map(round)]))
    return rows.get(a)
  }
  // The page's own reading of a row (index.html, `row`).
  const read = (row, u) => {
    const n = row.length / 3 - 1
    if (u <= row[0]) return [row[1], row[2]]
    if (u >= row[n * 3]) return [row[n * 3 + 1], row[n * 3 + 2]]
    let j = 0
    while (row[(j + 1) * 3] < u) j++
    const t = (u - row[j * 3]) / (row[(j + 1) * 3] - row[j * 3])
    return [1, 2].map((c) => row[j * 3 + c] + (row[(j + 1) * 3 + c] - row[j * 3 + c]) * t)
  }
  /** How far the page's reading between two rows is from the app at an aspect between them, over every share asked. */
  const off = (from, to, a) => {
    const [A, B] = [rowOf(from), rowOf(to)]
    const t = (a - from) / (to - from)
    const { us, vs } = ask(a)
    let worst = 0
    us.forEach((u, i) => {
      const [p, q] = [read(A, u), read(B, u)]
      vs[i].forEach((v, c) => (worst = Math.max(worst, Math.abs(v - (p[c] + (q[c] - p[c]) * t) / SCALE))))
    })
    return worst
  }
  /** How far the app's glass at one aspect is from its glass at another, over every share asked. */
  const apart = (a, b) => {
    const [A, B] = [ask(a), ask(b)]
    let worst = 0
    shares.forEach((u) => {
      const [p, q] = [A.vs[A.us.indexOf(u)], B.vs[B.us.indexOf(u)]]
      p.forEach((v, c) => (worst = Math.max(worst, Math.abs(v - q[c]))))
    })
    return worst
  }
  const nodes = new Set([...RANGE.aspect, ...screens.map((s) => s.aspect)])
  const seen = new Set()
  const sorted = () => [...nodes].sort((x, y) => x - y)
  let worst = 0
  let finest = 0
  let steps = 0
  for (let added = true; added; ) {
    added = false
    const A = sorted()
    for (let i = 0; i + 1 < A.length; i++) {
      const [from, to] = [A[i], A[i + 1]]
      if (seen.has(`${from}:${to}`) || to - from <= 2 * STEP) continue
      seen.add(`${from}:${to}`)
      const mid = tidy((from + to) / 2, 1 / STEP)
      if (to - from > FINEST.aspect) {
        const far = Math.max(off(from, to, mid), off(from, to, tidy(from + (to - from) / 4, 1 / STEP)), off(from, to, tidy(from + ((to - from) * 3) / 4, 1 / STEP)))
        if (far > TOLERANCE) {
          nodes.add(mid)
          added = true
        } else worst = Math.max(worst, far)
        continue
      }
      const far = off(from, to, mid)
      if (far <= TOLERANCE) {
        worst = Math.max(worst, far)
        continue
      }
      // Two rows as near as the table goes, and the page still reads wrong between them: the app may step there. The step is
      // looked for in the half the glass moves most over, down to `STEP`.
      let [low, high] = [from, to]
      while (high - low > STEP * 1.5 && apart(low, high) > TOLERANCE) {
        const half = tidy((low + high) / 2, 1 / STEP)
        if (half <= low || half >= high) break
        if (apart(low, half) > apart(half, high)) high = half
        else low = half
      }
      if (apart(low, high) > TOLERANCE) {
        nodes.add(low)
        nodes.add(high)
        steps++
        added = true
      } else finest = Math.max(finest, far)
    }
  }
  const A = sorted()
  return { a: A, g: A.map(rowOf), points: A.reduce((n, a) => n + rowOf(a).length / 3, 0), asked: [...asked.values()].reduce((n, r) => n + r.us.length, 0), worst, finest, steps }
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

/** The pages this tool opens are given no table: what the page would lay from the table is what the tool is about to make,
 * and the app draws and measures the same without it. */
const withoutTable = (page) =>
  page.route(
    (url) => url.pathname.endsWith('/') || url.pathname.endsWith('.html'),
    async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, body: (await response.text()).replace(MARKS[0], (_all, begin, end) => `${begin} null ${end}`) })
    },
  )

/** How high the controls stand on any screen, as the page can tell it before the app runs.
 * The measure is the app's own (src/app/app.ts makes it before its first picture and says it on the document), asked on every
 * screen that sits beside a number one of the interface's media rules names, with a mouse and with a finger. The page reads
 * the answer back from those rules alone, so a rule the measure does not change with is left out, and two screens the rules
 * do not tell apart must measure the same. The strip of a home indicator (`env(safe-area-inset-bottom)`) raises the controls
 * from some inset on, a pixel for a pixel: that inset is kept beside each height.
 * Nothing is drawn here: the files of the pictures are left unanswered, so the app stays before its first picture. */
async function controlsOf(session) {
  const held = new Set(Object.values(readJson(rel('dist', 'assets', 'index.json')).sets.web).flat().map((f) => `/assets/${f.path}`))
  const samples = []
  const reps = []
  const shapes = {}
  const relevant = new Set()
  let queries = null
  for (const coarse of [false, true]) {
    const context = await session.browser.newContext({ viewport: { width: PROBE.width, height: PROBE.height }, deviceScaleFactor: PROBE.ratio, hasTouch: coarse })
    try {
      const page = await context.newPage()
      const errors = watchPage(page)
      await page.route((url) => held.has(url.pathname), () => undefined)
      await withoutTable(page)
      await page.goto(`${session.server.url}?quality=${LOWEST}`)
      await page.waitForFunction(() => document.documentElement.dataset.controls !== undefined, null, { timeout: WAIT_MS, polling: 50 })
      if ((await page.evaluate(() => document.documentElement.dataset.controls)) === '') return null
      const client = await context.newCDPSession(page)
      const found = await page.evaluate(() => {
        const out = []
        const walk = (rules) => {
          for (const r of rules) {
            if (r instanceof CSSMediaRule && !out.includes(r.conditionText)) out.push(r.conditionText)
            if (r.cssRules) walk(r.cssRules)
          }
        }
        for (const sheet of document.styleSheets) walk(sheet.cssRules)
        return out
      })
      if (queries && JSON.stringify(queries) !== JSON.stringify(found)) throw new Error('the interface brings other media rules with a finger than with a mouse')
      queries = found
      const size = async (w, h) => {
        await client.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: PROBE.ratio, mobile: false })
        await page.waitForFunction(([w, h]) => window.innerWidth === w && window.innerHeight === h, [w, h], { polling: 10 })
      }
      // The app measures when the window says it has changed; `without` names a rule that is switched off for the measure.
      const read = (without = null) =>
        page.evaluate(
          ([queries, without]) => {
            const off = []
            const walk = (rules) => {
              for (const r of rules) {
                if (r instanceof CSSMediaRule && r.conditionText === without) off.push(r)
                if (r.cssRules) walk(r.cssRules)
              }
            }
            if (without !== null) for (const sheet of document.styleSheets) walk(sheet.cssRules)
            for (const r of off) r.media.mediaText = 'not all'
            delete document.documentElement.dataset.controls
            window.dispatchEvent(new Event('resize'))
            const said = document.documentElement.dataset.controls
            for (const r of off) r.media.mediaText = without
            const probe = document.createElement('div')
            probe.style.cssText = 'position:absolute;visibility:hidden;width:0;height:env(safe-area-inset-bottom,0px)'
            document.body.appendChild(probe)
            const inset = probe.getBoundingClientRect().height
            probe.remove()
            return { width: window.innerWidth, height: window.innerHeight, bits: queries.map((q) => (window.matchMedia(q).matches ? '1' : '0')).join(''), bar: said ? Number(said) : null, inset }
          },
          [queries, without],
        )
      const inset = async (px) => {
        await client.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: px } })
        const got = await read()
        if (Math.abs(got.inset - px) > 0.01) throw new Error(`the page was given a safe area of ${px} px under it and reads ${got.inset}`)
        return got.bar
      }
      const beside = (kind, [low, high]) => {
        const all = new Set([low, high])
        for (const q of queries) for (const m of q.matchAll(new RegExp(`-${kind}:\\s*([0-9.]+)px`, 'g'))) for (const d of [-1, 0, 1]) all.add(Math.round(Number(m[1])) + d)
        return [...all].filter((v) => v >= low && v <= high).sort((x, y) => x - y)
      }
      const seen = new Map()
      for (const h of beside('height', PROBE.heights))
        for (const w of beside('width', PROBE.widths)) {
          await size(w, h)
          const got = await read()
          if (got.bar === null) throw new Error(`the app measured no controls on a screen of ${w} x ${h}`)
          samples.push(got)
          if (!seen.has(got.bits)) seen.set(got.bits, got)
        }
      for (const rep of seen.values()) {
        await size(rep.width, rep.height)
        for (const [i, q] of queries.entries()) if (rep.bits[i] === '1' && !relevant.has(i) && (await read(q)).bar !== rep.bar) relevant.add(i)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        if ((await read()).bar !== rep.bar) throw new Error(`with reduced motion the controls stand at another height on a screen of ${rep.width} x ${rep.height}: this tool measures them without it only`)
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        const high = await inset(INSET.most)
        const from = INSET.most - (high - rep.bar)
        for (const px of INSET.usual) {
          const bar = await inset(px)
          if (Math.abs(bar - (rep.bar + Math.max(0, px - from))) > 0.01) throw new Error(`a safe area of ${px} px puts the controls ${bar} px high on a screen of ${rep.width} x ${rep.height}: not a pixel for a pixel from ${from} px on, as the page reckons it`)
        }
        await inset(0)
        reps.push({ bits: rep.bits, bar: rep.bar, from })
      }
      if (!coarse)
        for (const shape of SHAPES) {
          await size(shape.width, shape.height)
          const got = await read()
          shapes[shape.name] = got.bar
          samples.push(got)
        }
      if (errors.length) throw new Error(`the page the controls were measured on logged:\n${errors.join('\n')}`)
    } finally {
      await context.close()
    }
  }
  const kept = queries.map((_q, i) => i).filter((i) => relevant.has(i))
  const keyOf = (bits) => kept.map((i) => bits[i]).join('')
  const m = {}
  for (const rep of reps) {
    const key = keyOf(rep.bits)
    if (m[key] && (m[key][0] !== rep.bar || Math.abs(m[key][1] - rep.from) > 0.01)) throw new Error('two screens the interface\'s media rules do not tell apart hold the controls at different heights: the page cannot reckon them from the rules')
    m[key] ??= [rep.bar, Math.round(rep.from * 100) / 100]
  }
  for (const got of samples) if (m[keyOf(got.bits)]?.[0] !== got.bar) throw new Error(`a screen of ${got.width} x ${got.height} holds the controls ${got.bar} px high, and the interface's media rules say ${m[keyOf(got.bits)]?.[0]}: the page cannot reckon them from the rules`)
  return { q: kept.map((i) => queries[i]), m, shapes }
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
    await withoutTable(page)
    await page.goto(`${session.server.url}?season=${season}&quality=${TOP}`)
    // The interface is out of sight, not out of the page: the app measures its controls and keeps the room for them.
    await page.addStyleTag({ content: '#ui { opacity: 0 !important } #view { opacity: 1 !important; transition: none !important }' })
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
      const [width, height, said] = await page.evaluate(() => {
        const c = document.getElementById('view')
        return [c.width, c.height, document.documentElement.dataset.controls]
      })
      if (width !== want[0] || height !== want[1]) throw new Error(`the page of ${season}, ${shape.name} drew ${width} x ${height}, not ${want[0]} x ${want[1]}`)
      const bar = said ? Number(said) : null
      if (bar !== barOf(shape)) throw new Error(`the page of ${season}, ${shape.name} drew over controls ${bar} px high, and they were measured ${barOf(shape)} px high on a screen of its size`)
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
function boxOf(still, screen) {
  const [cy, r] = globeAt(screen)
  const [stillCy, stillR] = globeAt(still)
  const k = (r * screen.height) / (stillR * still.height)
  return { x: screen.width / 2 - (still.width * k) / 2, y: cy * screen.height - stillCy * still.height * k, w: still.width * k, h: still.height * k }
}

/** The soft picture that goes before a still: the one that leaves the least of the still's screen bare from the nearest. */
function softOf(shape) {
  let best = 0
  let least = Infinity
  SOFT.of.forEach((name, i) => {
    const b = boxOf(SHAPES.find((s) => s.name === name), shape)
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

/** The table: the stills and the soft picture each is preceded by; where the app puts the glass (`g` holds a row for each
 * aspect of `a`: the share of the screen's height the controls stand high, the centre and the radius, at every bend); the controls (`c`: the media rules that say how high they
 * stand, and for each way those hold together the height and the safe area it rises from; `e`: the bar the app takes where
 * it measures none); the soft pictures (`p` says which still each is made of, its size and its rim; `b` holds them, season
 * by season). */
function tableOf(record, grid, b) {
  const v = versions(record)
  const stills = SHAPES.map((s) => [s.name, s.width, s.height, ...globeAt(s).map(round), v[s.name], softOf(s)])
  return { season: cfg.defaultSeason, seasons: cfg.seasons, stills, a: grid.a, g: grid.g, c: controls && { q: controls.q, m: controls.m }, e: F0.estimate, p: softList().map((soft) => [soft.index, soft.width, soft.height, SOFT.rim]), b }
}

const engine = engineHash()
const F0 = await framing()
const record = fs.existsSync(recordFile) ? readJson(recordFile) : { stills: {} }
const html = fs.readFileSync(pageFile, 'utf8')
if (!MARKS[0].test(html)) throw new Error(`index.html has no place for the table: the marks ${MARKS[1]} and ${MARKS[2]} are missing`)

/** What a still is drawn from: the app as built, and the files of its season as the built site serves them. */
const built = fs.existsSync(rel('dist', 'assets', 'index.json')) ? readJson(rel('dist', 'assets', 'index.json')).sets.web : {}
const drawnFrom = (season) => sha(JSON.stringify([engine, built.shared, built[season]])).slice(0, 16)

/** The controls as today's build holds them: measured by every run that draws or writes, and read from the record by a check,
 * which opens no browser and says so when the record is of another build. `null` where the build has no interface. */
const session = args.check === true ? null : await Session.open()
let controls = record.controls ?? null
if (session) {
  try {
    const t0 = Date.now()
    controls = await controlsOf(session)
    if (controls) controls.from = engine
    console.log(controls ? `poster: the controls stand ${[...new Set(Object.values(controls.m).map((v) => v[0]))].sort((x, y) => x - y).join(', ')} px high, told apart by ${controls.q.length} media rules (${((Date.now() - t0) / 1000).toFixed(0)} s)` : 'poster: this build has no interface: the stills keep the room the app takes without one')
  } catch (e) {
    await session.close()
    throw e
  }
}
const barOf = (shape) => controls?.shapes?.[shape.name] ?? null
const estimated = (height) => Math.min(Math.max(F0.estimate[0] * height, F0.estimate[1]), F0.estimate[2] * height)
const shareOf = (shape) => (barOf(shape) ?? estimated(shape.height)) / shape.height
/** Where the glass is on the screen a still is drawn for, over the controls as they stand on it. */
const globeAt = (shape) => F0.globe(shape.width / shape.height, shareOf(shape))
const tableAt = Date.now()
const grid = table(F0.globe, SHAPES.map((s) => ({ aspect: s.width / s.height, share: shareOf(s) })))
F0.keep()
const tableSays = `${grid.a.length} aspects and ${grid.points} bends${grid.steps ? `, with both sides of the ${grid.steps} steps the framing makes` : ''}, read within ${(grid.worst * 100).toFixed(3)} % of the height from the app${grid.finest > TOLERANCE ? ` and within ${(grid.finest * 100).toFixed(3)} % where its rows are as near as they go` : ''} (${grid.asked} places asked, ${((Date.now() - tableAt) / 1000).toFixed(0)} s)`

/** A still is good while it is a picture of today's app, with the glass where the app puts it today. */
const stale = (season, shape) => {
  const r = record.stills[`${season}-${shape.name}`]
  if (!r || r.width !== shape.width || r.height !== shape.height || r.ratio !== shape.ratio) return 'not drawn'
  if (r.coder !== CODER) return 'coded by an older rule'
  if (args.keep !== true && r.from !== drawnFrom(season)) return 'drawn from another build of the app or other files'
  if ((r.bar ?? null) !== barOf(shape)) return 'drawn over controls of another height'
  if (JSON.stringify(r.globe) !== JSON.stringify(globeAt(shape).map(round))) return 'drawn with another framing'
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
  if (controls && controls.from !== engine) problems.push('the controls were measured on another build of the app')
  // The soft pictures are coded bytes, which another machine may code another way: the page has to hold one for each.
  const want = tableOf(record, grid, undefined)
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
  console.log(`poster: pass · ${cfg.seasons.length * SHAPES.length} stills and the table agree with the framing (${tableSays})`)
  process.exit(0)
}

const seasons = pick(args.season, cfg.seasons)
const shapes = pick(args.shape, SHAPES.map((s) => s.name))
for (const s of seasons) if (!cfg.seasons.includes(s)) throw new Error(`no such season: ${s}`)
for (const s of shapes) if (!SHAPES.some((x) => x.name === s)) throw new Error(`no such shape: ${s}`)
const named = args.season !== undefined || args.shape !== undefined
const why = (season, shape) => (named && seasons.includes(season) && shapes.includes(shape.name) ? 'asked for' : args.only === true ? '' : stale(season, shape))
const todo = cfg.seasons.map((season) => ({ season, shapes: SHAPES.filter((shape) => why(season, shape)) })).filter((t) => t.shapes.length)
const drawn = todo.reduce((n, t) => n + t.shapes.length, 0)
if (drawn) {
  const reasons = new Map()
  for (const t of todo) for (const shape of t.shapes) reasons.set(why(t.season, shape), (reasons.get(why(t.season, shape)) ?? 0) + 1)
  console.log(`poster: ${drawn} stills to draw (${[...reasons].map(([reason, n]) => `${n} ${reason}`).join(', ')})`)
}

fs.mkdirSync(dirOut, { recursive: true })
fs.mkdirSync(dirWork, { recursive: true })
try {
  for (const t of todo) {
    const t0 = Date.now()
    const coding = []
    await draw(session, t.season, t.shapes, (shape, png) => {
      fs.writeFileSync(path.join(dirWork, `${t.season}-${shape.name}.png`), png)
      // Coded while the next one is drawn.
      coding.push(
        Promise.all(Object.keys(BUDGET).map((kind) => fit(png, kind))).then((coded) => {
          const entry = { season: t.season, shape: shape.name, width: shape.width, height: shape.height, ratio: shape.ratio, bar: barOf(shape), globe: globeAt(shape).map(round), from: drawnFrom(t.season), coder: CODER }
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
if (controls) record.controls = controls
else delete record.controls
writeJson(recordFile, record)
// Read again: the page may have been worked on while the stills were drawn.
const text = JSON.stringify(tableOf(record, grid, await softs()))
fs.writeFileSync(pageFile, fs.readFileSync(pageFile, 'utf8').replace(MARKS[0], (_all, begin, end) => `${begin} ${text} ${end}`))
console.log(`poster: ${drawn} stills drawn, ${cfg.seasons.length * SHAPES.length - drawn} kept${vouched ? ` (${vouched} of them from another build, on --keep)` : ''}; the table holds ${tableSays}`)
