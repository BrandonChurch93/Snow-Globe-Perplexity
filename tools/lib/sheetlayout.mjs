import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { rel, readJson } from './paths.mjs'
import { limits, fitForModel } from './compose.mjs'
import { engineHash } from './hashes.mjs'
import { cfg, currentSeasonHashes, writeWithRecord } from './page.mjs'

const GROUND = [30, 30, 30]
const INK = [176, 176, 176]
const DIM = [124, 124, 124]
const MARGIN = 12
const GAP = 12
const ROW_GAP = 18
const WORD_GAP = 5
const LABEL_TOP = 6
const GLYPH_ROWS = 7
const SPACE = 3
const GLYPHS = {
  0: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
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
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  j: ['..#', '...', '.##', '..#', '..#', '#.#', '.#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#'],
  n: ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '###..', '.#...', '.#...', '.#..#', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  '-': ['...', '...', '...', '...', '###', '...', '...'],
}

const glyphOf = (ch) => GLYPHS[ch] ?? GLYPHS[ch.toLowerCase()] ?? null

export function textUnits(text) {
  let w = 0
  for (const ch of String(text)) {
    const g = glyphOf(ch)
    w += (g ? g[0].length : SPACE - 1) + 1
  }
  return Math.max(0, w - 1)
}

function drawText(img, text, left, top, unit, ink) {
  let x = left
  for (const ch of String(text)) {
    const g = glyphOf(ch)
    if (!g) {
      x += SPACE * unit
      continue
    }
    for (let j = 0; j < g.length; j++) {
      for (let i = 0; i < g[j].length; i++) {
        if (g[j][i] !== '#') continue
        for (let dy = 0; dy < unit; dy++) {
          const py = top + j * unit + dy
          if (py < 0 || py >= img.height) continue
          for (let dx = 0; dx < unit; dx++) {
            const px = x + i * unit + dx
            if (px < 0 || px >= img.width) continue
            const o = (py * img.width + px) * 3
            img.data[o] = ink[0]
            img.data[o + 1] = ink[1]
            img.data[o + 2] = ink[2]
          }
        }
      }
    }
    x += (g[0].length + 1) * unit
  }
  return x
}

export const labelUnits = (label) => label.reduce((w, part, i) => w + textUnits(part) + (i ? WORD_GAP : 0), 0)

const fits = (w, h, lim) => Math.max(w, h) <= lim.longEdge && w * h <= lim.maxPixels

function sized(cols, rows, cellW, frameWidth, frameHeight, unit) {
  const cellH = Math.max(1, Math.round((cellW * frameHeight) / frameWidth))
  const strip = LABEL_TOP + GLYPH_ROWS * unit
  return {
    cellH,
    strip,
    width: 2 * MARGIN + cols * cellW + (cols - 1) * GAP,
    height: 2 * MARGIN + rows * (cellH + strip) + (rows - 1) * ROW_GAP,
  }
}

function best(perSheet, frameWidth, frameHeight, unit, lim, fixedCols) {
  let pick = null
  const from = fixedCols || 1
  const to = fixedCols || perSheet
  for (let cols = from; cols <= to; cols++) {
    const rows = Math.ceil(perSheet / cols)
    let cellW = Math.min(frameWidth, Math.floor((lim.longEdge - 2 * MARGIN - (cols - 1) * GAP) / cols))
    while (cellW > 1) {
      const s = sized(cols, rows, cellW, frameWidth, frameHeight, unit)
      if (fits(s.width, s.height, lim)) break
      cellW--
    }
    if (cellW < 2) continue
    if (!pick || cellW >= pick.cellW) pick = { cols, cellW }
  }
  return pick
}

export function gridLayout({ count, perSheet = count, frameWidth, frameHeight, labelUnits = 0, cols = 0, lim = limits() }) {
  if (!(count >= 1)) throw new Error('a sheet needs at least one frame')
  const per = Math.max(perSheet, count)
  const fixed = cols > 0 ? Math.min(Math.floor(cols), per) : 0
  let unit = 2
  let pick = best(per, frameWidth, frameHeight, unit, lim, fixed)
  if (!pick || pick.cellW < labelUnits * unit) {
    unit = 1
    pick = best(per, frameWidth, frameHeight, unit, lim, fixed)
  }
  if (!pick) throw new Error(`${per} frames of ${frameWidth} x ${frameHeight} do not fit a sheet of at most ${lim.longEdge} px and ${lim.maxPixels} pixels`)
  const rows = Math.ceil(count / pick.cols)
  const s = sized(pick.cols, rows, pick.cellW, frameWidth, frameHeight, unit)
  if (!fits(s.width, s.height, lim)) throw new Error(`a sheet of ${s.width} x ${s.height} is over the picture limits`)
  const cells = []
  for (let k = 0; k < count; k++) {
    const c = k % pick.cols
    const r = Math.floor(k / pick.cols)
    cells.push({ left: MARGIN + c * (pick.cellW + GAP), top: MARGIN + r * (s.cellH + s.strip + ROW_GAP), width: pick.cellW, height: s.cellH })
  }
  return { cols: pick.cols, rows, cellW: pick.cellW, cellH: s.cellH, unit, strip: s.strip, gap: GAP, rowGap: ROW_GAP, margin: MARGIN, width: s.width, height: s.height, cells, limits: { longEdge: lim.longEdge, maxPixels: lim.maxPixels } }
}

export async function composeSheet({ tiles, out, layout }) {
  if (tiles.length !== layout.cells.length) throw new Error('the layout does not match the tiles')
  const img = { data: Buffer.alloc(layout.width * layout.height * 3), width: layout.width, height: layout.height }
  for (let i = 0; i < img.data.length; i += 3) {
    img.data[i] = GROUND[0]
    img.data[i + 1] = GROUND[1]
    img.data[i + 2] = GROUND[2]
  }
  for (let k = 0; k < tiles.length; k++) {
    const t = tiles[k]
    const cell = layout.cells[k]
    const data = await sharp(t.file).removeAlpha().toColourspace('srgb').resize(cell.width, cell.height, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer()
    for (let y = 0; y < cell.height; y++) data.copy(img.data, ((cell.top + y) * img.width + cell.left) * 3, y * cell.width * 3, (y + 1) * cell.width * 3)
    let x = cell.left
    ;(t.label ?? []).forEach((part, i) => {
      x = drawText(img, part, x, cell.top + cell.height + LABEL_TOP, layout.unit, i ? DIM : INK) + (WORD_GAP - 1) * layout.unit
    })
  }
  const tmp = rel('out', 'work', 'tmp', `sheet-${process.pid}-${path.basename(out, path.extname(out))}.png`)
  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  fs.mkdirSync(path.dirname(out), { recursive: true })
  try {
    await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } }).png({ compressionLevel: 1 }).toFile(tmp)
    const size = await fitForModel(tmp, out)
    if (size.width !== layout.width || size.height !== layout.height) throw new Error(`the sheet was resized to ${size.width} x ${size.height}: the layout broke the picture limits`)
  } finally {
    fs.rmSync(tmp, { force: true })
  }
  return { width: layout.width, height: layout.height }
}

export const snapUp = (i, step) => Math.ceil(i / step) * step
export const snapDown = (i, step) => Math.floor(i / step) * step

export function run(first, end, step) {
  const out = []
  for (let i = snapUp(first, step); i < end; i += step) out.push(i)
  return out
}

export function pick(list, count) {
  if (list.length <= count) return [...list]
  const out = []
  for (let k = 0; k < count; k++) out.push(list[Math.round((k * (list.length - 1)) / (count - 1))])
  return [...new Set(out)]
}

export function across(first, last, count, step) {
  const all = run(first, last + 1, step)
  return pick(all.length ? all : [first], count)
}

export function around(count, frames, step) {
  const out = []
  for (let k = 0; k < frames; k++) out.push(snapDown(Math.round((k * count) / frames), step))
  return [...new Set(out)].filter((i) => i < count)
}

export function overview(shots, frameCount, count, step) {
  if (!shots.length || shots.length > count) return across(0, frameCount - 1, count, step)
  const give = shots.map(() => 1)
  const len = shots.map((s) => s.last + 1 - s.first)
  for (let extra = count - shots.length; extra > 0; extra--) {
    let k = 0
    for (let i = 1; i < shots.length; i++) if (len[i] / (give[i] + 1) > len[k] / (give[k] + 1)) k = i
    give[k]++
  }
  const out = []
  shots.forEach((s, i) => {
    for (let j = 0; j < give[i]; j++) {
      const at = snapDown(s.first + Math.floor(((j + 0.5) * len[i]) / give[i]), step)
      out.push(Math.min(s.last, Math.max(at, snapUp(s.first, step) <= s.last ? snapUp(s.first, step) : s.first)))
    }
  })
  return [...new Set(out)]
}

export function pages(list, perSheet) {
  const out = []
  for (let i = 0; i < list.length; i += perSheet) out.push(list.slice(i, i + perSheet))
  return out
}

export const secondsText = (index, fps, step = 1) => `${(index / fps).toFixed(step / fps < 0.02 ? 3 : 2)} s`

export async function readPlan(page) {
  return page.evaluate(() => {
    const sc = window.showcase
    const safe = (f) => {
      try {
        return f()
      } catch {
        return null
      }
    }
    return {
      fps: sc.info().fps,
      film: sc.film(),
      test: safe(() => sc.dev.testShake()),
      loop: { frameCount: sc.loop().frameCount, plan: safe(() => sc.dev.loopPlan()) },
      opening: { frameCount: sc.opening().frameCount, plan: safe(() => sc.dev.openingPlan()) },
    }
  })
}

export function sourceOf(plan, id) {
  const fps = plan.fps
  const preview = Math.max(1, Math.round(fps / cfg.film.previewFps))
  if (id === 'film') return { id, what: 'film', count: plan.film.frameCount, step: preview, fps, tiered: true, stage: false }
  if (id === 'test') {
    if (!plan.test) throw new Error('the page gives no test shake')
    return { id, what: 'test shake', count: plan.test.frameCount, step: preview, fps, tiered: true, stage: false }
  }
  if (id === 'loop') return { id, what: 'card loop', count: plan.loop.frameCount, step: Math.max(1, Math.round(fps / cfg.deliver.cardLoop.fps)), fps, tiered: true, stage: false }
  if (id === 'opening') {
    const own = plan.opening.plan?.fps ?? fps
    return { id, what: 'opening', count: plan.opening.frameCount, step: Math.max(1, Math.round(own / cfg.film.previewFps)), fps: own, tiered: false, stage: true }
  }
  throw new Error(`no such source: ${id}`)
}

export const SEQ = rel('out', 'work', 'seq')
export const SHEETS = rel('out', 'work', 'sheets')
export const nameParts = (o, tiered = true) => [o.format, tiered ? o.tier : '', o.assets === 'full' ? '' : o.assets, o.diag].filter(Boolean)
export const frameDir = (src, o) => path.join(SEQ, [src.id, ...nameParts(o, src.tiered)].join('-'))
export const frameFile = (src, o, i) => path.join(frameDir(src, o), `${src.id}-${String(i).padStart(6, '0')}.png`)
export const shown = (file) => path.relative(rel(), file).split(path.sep).join('/')

let now = null
const current = () => (now ??= { engine: engineHash(), seasons: currentSeasonHashes() })

export function matches(file, want) {
  if (!fs.existsSync(file) || !fs.existsSync(`${file}.json`)) return false
  let r
  try {
    r = readJson(`${file}.json`)
  } catch {
    return false
  }
  const c = current()
  if (r.engineHash !== c.engine) return false
  for (const s of cfg.seasons) if (r.seasonHashes?.[s] !== c.seasons[s]) return false
  for (const k of ['format', 'tier', 'assets', 'diagnostic']) if (want[k] !== undefined && r[k] !== want[k]) return false
  if (want.spec && JSON.stringify(r.spec) !== JSON.stringify(want.spec)) return false
  return true
}

const frameWant = (src, o, i) => ({ format: o.format, tier: src.tiered ? o.tier : undefined, assets: o.assets, diagnostic: o.diag, spec: { source: src.id, index: i } })

function storedFrames() {
  const out = []
  if (!fs.existsSync(SEQ)) return out
  for (const d of fs.readdirSync(SEQ, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    for (const f of fs.readdirSync(path.join(SEQ, d.name))) {
      if (!f.endsWith('.png')) continue
      const file = path.join(SEQ, d.name, f)
      out.push({ file, time: fs.statSync(file).mtimeMs })
    }
  }
  return out
}

export function makeRoom(keep, adding) {
  const cap = cfg.sandbox.maxFramesOnDisk
  const stored = storedFrames()
  let over = stored.length + adding - cap
  if (over <= 0) return 0
  let removed = 0
  for (const f of stored.sort((a, b) => a.time - b.time)) {
    if (over <= 0) break
    if (keep.has(f.file)) continue
    fs.rmSync(f.file, { force: true })
    fs.rmSync(`${f.file}.json`, { force: true })
    over--
    removed++
  }
  if (over > 0) throw new Error(`this needs more than sandbox.maxFramesOnDisk (${cap}) frames on disk. Ask for a shorter range`)
  return removed
}

export async function renderFrames(session, page, src, indices, o, onFrame = async () => {}) {
  const list = [...new Set(indices)].sort((a, b) => a - b)
  for (const i of list) if (!Number.isInteger(i) || i < 0 || i >= src.count) throw new Error(`frame ${i} is outside the ${src.what}, which has ${src.count} frames`)
  const files = new Map()
  const todo = []
  for (const i of list) {
    const file = frameFile(src, o, i)
    if (!o.force && matches(file, frameWant(src, o, i))) files.set(i, file)
    else todo.push(i)
  }
  makeRoom(new Set(list.map((i) => frameFile(src, o, i))), todo.length)
  const reused = files.size
  for (const [i, file] of files) await onFrame(i, file, true)
  let rendered = 0
  let lastMs = 0
  let seen = page.errors.length
  const started = Date.now()
  for (const i of todo) {
    if (rendered > 0 && Date.now() + lastMs > o.deadline) break
    const t0 = Date.now()
    const r = await page.evaluate(
      async ([id, index, tier, diag]) => {
        const sc = window.showcase
        if (id !== 'opening') sc.setDiagnostic(diag || 'none')
        const before = sc.dev.timings()
        let state = null
        if (id === 'film') {
          await sc.renderFilmFrame(index, tier)
          state = sc.filmState(index)
        } else if (id === 'test') {
          await sc.dev.renderTestShakeFrame(index, tier)
          state = sc.dev.testShakeState(index)
        } else if (id === 'loop') {
          await sc.renderLoopFrame(index, tier)
          state = sc.dev.loopState(index)
        } else await sc.renderOpeningFrame(index)
        const after = sc.dev.timings()
        return {
          info: sc.info(),
          precision: sc.dev.caps().precision,
          shot: state?.shot ?? '',
          season: state?.season ?? '',
          timings: { simMs: after.simMs - before.simMs, drawMs: after.drawMs - before.drawMs, samples: after.samples - before.samples, steps: after.steps - before.steps },
        }
      },
      [src.id, i, o.tier, o.diag],
    )
    const png = src.stage ? await session.grabStage(page) : await session.grab(page)
    lastMs = Date.now() - t0
    const file = frameFile(src, o, i)
    const record = session.record(r.info, { diag: o.diag, spec: { source: src.id, index: i }, frameSeconds: i / src.fps, shot: r.shot, season: r.season, seconds: lastMs / 1000, timings: r.timings, precision: r.precision, errors: page.errors.slice(seen, seen + 20) })
    seen = page.errors.length
    writeWithRecord(file, png, record)
    files.set(i, file)
    rendered++
    await onFrame(i, file, false)
    if (rendered % 12 === 0 && rendered < todo.length) {
      const per = (Date.now() - started) / 1000 / rendered
      console.log(`frames: ${reused + rendered} of ${list.length} · ${per.toFixed(1)} s a frame · about ${Math.ceil(((todo.length - rendered) * per) / 60)} min left`)
    }
  }
  return { files, total: list.length, rendered, reused, complete: files.size === list.length, seconds: (Date.now() - started) / 1000 }
}

export async function pageInfo(page) {
  return page.evaluate(() => window.showcase.info())
}
