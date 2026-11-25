import sharp from 'sharp'
import { readJson, rel } from './paths.mjs'
import { cfg, formatById, recordMatches, writeWithRecord } from './page.mjs'
import { limits } from './compose.mjs'

const METHOD = 3
const GAP = 6
const STRIP = 20
const GROUND = [20, 20, 23]
const INK = [196, 196, 202]
const ADVANCE = 12
const PAD = 4
const MIN_MARGIN = 16
const CROP_MARGIN = { x: 90, y: 64 }
const HINT_MARGIN = { x: 100, y: 70 }
const HINT_COLS = 4
const STATES = ['rest', 'focused', 'pressed']
const FRAME_MS = 150
const SHOTS = 5
const GLYPHS = {
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '.#...'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '###..', '.#...', '.#...', '.#...', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}

const lim = limits()
const fits = (w, h) => w >= 1 && h >= 1 && Math.max(w, h) <= lim.longEdge && w * h <= lim.maxPixels
const fileOf = (entry, tier, kind) => rel('out', 'work', 'controls', `${entry.id}-${tier}-${kind}.png`)
const touchFormats = [cfg.formats.phone.id, cfg.formats.tablet.id]
const selector = (control) => (cfg.seasons.includes(control) ? `[data-control="season"][data-season="${control}"]` : `[data-control="${control}"]`)

function specs(entry, tier) {
  const base = { method: METHOD, id: entry.id, season: entry.season, state: entry.state, camera: entry.camera, format: entry.format, tier }
  return {
    crops: { ...base, kind: 'control-crops', states: STATES, margin: CROP_MARGIN, motion: 'reduced', pointer: touchFormats.includes(entry.format) ? 'touch' : 'mouse' },
    hint: { ...base, kind: 'hint-sheet', frames: cfg.critics.contactSheetFrames, cols: HINT_COLS, margin: HINT_MARGIN },
  }
}
const want = (entry, tier, spec) => ({ seasons: [entry.season], format: entry.format, tier, spec })

/** Whether the sheets of this screen still are already on disk for this build. */
export function controlsCached(entry, tier, hint) {
  const s = specs(entry, tier)
  return recordMatches(fileOf(entry, tier, 'crops'), want(entry, tier, s.crops)) && (!hint || recordMatches(fileOf(entry, tier, 'hint'), want(entry, tier, s.hint)))
}

/** A number that changes whenever the page draws a picture: it tells a still drawn now from one reused from disk. */
export const drawMark = (page) => page.evaluate(() => window.showcase.dev.timings().samples)

function stamp(dst, text, left, top) {
  let x = left
  for (const ch of String(text)) {
    const g = GLYPHS[ch]
    if (!g) throw new Error(`no glyph for ${ch}`)
    for (let r = 0; r < g.length; r++)
      for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '#') continue
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) dst.data.set(INK, ((top + r * 2 + dy) * dst.width + x + c * 2 + dx) * 3)
      }
    x += ADVANCE
  }
}

async function sheet(cells, cols, under) {
  const w = cells[0].img.width
  const h = cells[0].img.height
  const rows = Math.ceil(cells.length / cols)
  const out = { width: cols * w + GAP * (cols - 1), height: rows * (h + STRIP) + GAP * (rows - 1) }
  if (!fits(out.width, out.height)) throw new Error(`a sheet of ${out.width} x ${out.height} is over the limits`)
  out.data = Buffer.alloc(out.width * out.height * 3)
  for (let i = 0; i < out.data.length; i += 3) out.data.set(GROUND, i)
  cells.forEach((cell, i) => {
    const left = (i % cols) * (w + GAP)
    const top = Math.floor(i / cols) * (h + STRIP + GAP)
    stamp(out, cell.label, left + PAD, top + 1 + (under ? h : 0))
    const at = top + (under ? 0 : STRIP)
    for (let y = 0; y < h; y++) cell.img.data.copy(out.data, ((at + y) * out.width + left) * 3, y * w * 3, (y + 1) * w * 3)
  })
  return sharp(out.data, { raw: { width: out.width, height: out.height, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer()
}

function tileSize(rects, stage, cols, rows, margin, chars) {
  const cw = Math.ceil(Math.max(...rects.map((r) => r[2])))
  const ch = Math.ceil(Math.max(...rects.map((r) => r[3])))
  const least = 2 * PAD + ADVANCE * chars
  let { x, y } = margin
  for (;;) {
    const w = Math.min(stage.width, Math.max(cw + 2 * x, least))
    const h = Math.min(stage.height, ch + 2 * y)
    if (w < least) throw new Error(`a label of ${chars} letters does not fit a tile ${w} px wide`)
    if (fits(cols * w + GAP * (cols - 1), rows * (h + STRIP) + GAP * (rows - 1))) return { w, h, x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2) }
    if (y > MIN_MARGIN) y -= 2
    else if (x > MIN_MARGIN && cw + 2 * x > least) x -= 2
    else throw new Error(`no tile fits a ${cols} by ${rows} grid of these controls`)
  }
}

function clipOf(rect, tile, stage) {
  const x = Math.round(rect[0] + rect[2] / 2 - tile.w / 2)
  const y = Math.round(rect[1] + rect[3] / 2 - tile.h / 2)
  return { x: Math.min(Math.max(x, 0), stage.width - tile.w), y: Math.min(Math.max(y, 0), stage.height - tile.h), width: tile.w, height: tile.h }
}

/** A crop is kept only when two shots in a row are the same picture, so a frame the browser had not finished is never kept. */
async function shoot(page, clip) {
  let png = null
  for (let i = 0; i <= SHOTS; i++) {
    const next = await page.screenshot({ type: 'png', clip, animations: 'disabled', caret: 'hide' })
    const same = png !== null && next.equals(png)
    png = next
    if (same) break
    if (i === SHOTS) throw new Error(`a crop did not hold still across ${SHOTS + 1} shots`)
  }
  const { data, info } = await sharp(png).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  if (info.width !== clip.width || info.height !== clip.height) throw new Error(`a crop came out ${info.width} x ${info.height}, not ${clip.width} x ${clip.height}`)
  return { data, width: info.width, height: info.height }
}

const ask = (page, state, a) => page.evaluate(([s, q]) => window.showcase.dev.interfaceState(s, q), [state, a])

/**
 * The crops are cut with the page told that the visitor asked for reduced motion: the interface's own style sheet then runs no
 * transition, so each state is drawn as it settles and no frame part of the way there can be shot. Whatever still moves is run to its end.
 */
const settle = (page, sel, ms) =>
  page.evaluate(
    async ([q, wait]) => {
      const frame = () =>
        new Promise((resolve) => {
          const timer = setTimeout(resolve, wait)
          requestAnimationFrame(() => {
            clearTimeout(timer)
            resolve()
          })
        })
      const el = document.querySelector(q)
      for (let pass = 0; pass < 2; pass++) {
        await frame()
        await frame()
        for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish()
      }
      await frame()
      return { active: el.matches(':active'), hover: el.matches(':hover'), moving: document.getAnimations().length }
    },
    [sel, ms],
  )

async function picture(page, entry, tier) {
  await page.evaluate(
    async ([e, t]) => {
      const sc = window.showcase
      await sc.setFormat(e.format)
      sc.setDiagnostic('none')
      await sc.renderStill({ season: e.season, state: e.state, camera: e.camera, tier: t, interface: true })
    },
    [entry, tier],
  )
}

async function crops(page, entry, spec, stage) {
  const season = entry.season
  const rows = []
  const hidden = []
  for (const control of ['shake', ...cfg.seasons, 'sound']) {
    const r = await ask(page, 'rest', { season, control })
    if (!r.shown) throw new Error('the interface is not shown on the page')
    if (!r.rect) {
      hidden.push(control)
      continue
    }
    const name = cfg.seasons.includes(control) ? `${control}${control === season ? ' current' : ''}` : control
    rows.push({ control, name, current: control === season, rect: r.rect.map((v) => Math.round(v * 100) / 100) })
  }
  if (!rows.length) throw new Error('the page shows no control')
  const last = rows.length * STATES.length
  const chars = Math.max(...rows.map((r) => r.name.length)) + Math.max(...STATES.map((s) => s.length)) + String(last).length + 2
  const tile = tileSize(rows.map((r) => r.rect), stage, STATES.length, rows.length, spec.margin, chars)
  const forced = spec.pointer === 'mouse' ? ['hover', 'active'] : ['active']
  const cdp = await page.context().newCDPSession(page)
  const cells = []
  const pressed = []
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    for (const row of rows) {
      const clip = clipOf(row.rect, tile, stage)
      const a = { season, control: row.control }
      const label = (state) => `${cells.length + 1} ${row.name} ${state}`
      await ask(page, 'rest', a)
      cells.push({ label: label(STATES[0]), img: await shoot(page, clip) })
      const f = await ask(page, 'focus', a)
      if (!f.focusVisible) throw new Error(`the ${row.control} control took the focus without the keyboard's ring`)
      cells.push({ label: label(STATES[1]), img: await shoot(page, clip) })
      await ask(page, 'rest', a)
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: selector(row.control) })
      if (!nodeId) throw new Error(`no such control on the page: ${row.control}`)
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced })
      const got = await settle(page, selector(row.control), FRAME_MS)
      if (!got.active) throw new Error(`the ${row.control} control did not take the pressed state`)
      cells.push({ label: label(STATES[2]), img: await shoot(page, clip) })
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
      await settle(page, selector(row.control), FRAME_MS)
      pressed.push({ control: row.control, ...got })
      row.clip = [clip.x, clip.y, clip.width, clip.height]
    }
    await ask(page, 'rest', { season })
  } finally {
    await page.emulateMedia({ reducedMotion: null }).catch(() => {})
    await cdp.detach().catch(() => {})
  }
  return { png: await sheet(cells, STATES.length, false), facts: { rows, hidden, tile: [tile.w, tile.h], pressed, labels: cells.map((c) => c.label) } }
}

async function hint(page, entry, spec, stage) {
  const season = entry.season
  const n = spec.frames
  const rest = await ask(page, 'rest', { season, control: 'shake' })
  if (!rest.shown || !rest.rect) throw new Error('the Shake control is not shown on the page')
  const chars = String(n).length + ' 0.00 s'.length
  const tile = tileSize([rest.rect], stage, spec.cols, Math.ceil(n / spec.cols), spec.margin, chars)
  const clip = clipOf(rest.rect, tile, stage)
  const cells = []
  const times = []
  let parts = 0
  for (let i = 0; i < n; i++) {
    const r = await ask(page, 'hint', { season, phase: n > 1 ? i / (n - 1) : 0 })
    if (!r.paused) throw new Error('the hint started no animation on the page')
    const at = await page.evaluate(() => {
      const all = document.getAnimations().filter((a) => !(a instanceof CSSTransition))
      const length = (a) => Number(a.effect?.getComputedTiming().duration) || 0
      const longest = all.reduce((a, b) => (length(b) > length(a) ? b : a))
      return { ms: Number(longest.currentTime), of: length(longest), running: all.filter((a) => a.playbackRate !== 0).length }
    })
    if (at.running) throw new Error('an animation of the hint was not held')
    parts = r.paused
    times.push(Math.round(at.ms) / 1000)
    cells.push({ label: `${i + 1} ${(at.ms / 1000).toFixed(2)} s`, img: await shoot(page, clip), of: at.of })
  }
  await ask(page, 'rest', { season })
  return { png: await sheet(cells, spec.cols, true), facts: { rect: rest.rect.map((v) => Math.round(v * 100) / 100), clip: [clip.x, clip.y, clip.width, clip.height], tile: [tile.w, tile.h], seconds: cells[0].of / 1000, times, animations: parts, labels: cells.map((c) => c.label) } }
}

/**
 * The close crops of every control at rest, focused and pressed, and (when asked) the sheet of the Shake control's hint,
 * cut from the page that holds a `screen` still: the app's own controls over the picture, at the size they are shown.
 * `drawn` says the page holds that still now; without it the still is drawn here first.
 */
export async function controlSheets(session, page, entry, tier, { drawn = false, hint: withHint = false } = {}) {
  const s = specs(entry, tier)
  const stage = formatById(entry.format)
  const jobs = [{ kind: 'crops', spec: s.crops, make: crops }, ...(withHint ? [{ kind: 'hint', spec: s.hint, make: hint }] : [])]
  const out = {}
  let ready = drawn
  for (const job of jobs) {
    const file = fileOf(entry, tier, job.kind)
    if (recordMatches(file, want(entry, tier, job.spec))) {
      out[job.kind] = { file, reused: true, record: readJson(`${file}.json`) }
      continue
    }
    if (!ready) await picture(page, entry, tier)
    ready = true
    const t0 = Date.now()
    const got = await job.make(page, entry, job.spec, stage)
    const info = await page.evaluate(() => window.showcase.info())
    const record = { ...session.record(info, { spec: job.spec, seconds: (Date.now() - t0) / 1000, ...got.facts, errors: page.errors.slice(0, 20) }), format: entry.format, tier }
    writeWithRecord(file, got.png, record)
    out[job.kind] = { file, reused: false, record }
  }
  return out
}
