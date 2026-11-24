import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, formatById, recordMatches } from './lib/page.mjs'
import { limits } from './lib/compose.mjs'
import { fileSha, sha256 } from './lib/hashes.mjs'
import { Pages, approvedFor, drawJudged, framingFromPose } from './lib/measures.mjs'

const GAP = 6
const STRIP = 20
const GROUND = [20, 20, 23]
const INK = [196, 196, 202]
const JPEG = { quality: 92, chromaSubsampling: '4:4:4' }
const FRAME = { left: 1.45, right: 1.45, up: 1.25, down: 2.05 }
const FRAME_MIN = { side: 1.1, up: 1, down: 1 }
const NAME = /^set-[A-Z]+-\d\d(-[ab])?\.jpg$/
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
}
const SURFACES = [
  { name: 'the glass at its shoulder', x: -0.62, y: -0.62, pair: true },
  { name: 'the glass at its rim', x: 0.9, y: -0.1 },
  { name: 'the cottage wall and roof', x: -0.4, y: 0.27, pair: true },
  { name: "the tree's crown", x: 0.2, y: -0.33, pair: true },
  { name: 'the pond and the ground around it', x: 0.02, y: 0.6 },
  { name: 'particles near the glass', x: -0.1, y: -0.05 },
  { name: 'particles far behind', x: 0.55, y: -0.55 },
  { name: 'the base from its rim to its foot', x: -0.5, y: 1.25, pair: true },
  { name: 'the collar', x: 0.45, y: 0.88, pair: true },
  { name: 'the line where the base meets the surface, and the mirror image', x: 0, y: 1.62, pair: true },
  { name: 'what lies on the surface, left', x: -1.05, y: 1.45 },
  { name: 'what lies on the surface, right', x: 1.05, y: 1.45 },
]
const STRESS = [
  { name: 'the dark backdrop', pick: 'dark' },
  { name: 'the soft discs of light', pick: 'lit' },
  { name: 'the surface the globe stands on, left', x: -1.6, y: 1.5 },
  { name: 'the surface the globe stands on, right', x: 1.6, y: 1.5 },
  { name: 'the particles inside the globe', x: 0, y: -0.1 },
  { name: 'frost on the glass', x: -0.62, y: -0.62 },
  { name: 'fine branches', x: 0.35, y: -0.4 },
  { name: 'glow', x: -0.1, y: 0.35 },
]
const STRESS_GRID = { cols: 4, rows: 2 }
const STRESS_SCAN = { every: 4, lit: 128, none: 0.002, below: 0.25, stepsPerTile: 8 }
const TABLE = {
  R1: (u) => seasonal(u),
  R2: () => true,
  R3: (u) => seasonal(u),
  R4: () => true,
  R5: (u) => u === 'globe' || u === 'film',
  R6: (u) => u === 'film',
  R7: (u) => u === 'film',
  R8: (u) => u === 'globe',
}
const BLOCKOUT = 'R4-blockout'
const JURY_TEXT_START = '> You will see one image.'

const seasonal = (u) => cfg.seasons.includes(u)
const args = parseArgs(process.argv.slice(2))
const str = (v) => (v && v !== true ? String(v) : '')
const phase = Number(str(args.phase))
const round = Number(str(args.round))
if (!Number.isInteger(phase) || phase < 1) throw new Error('give --phase N')
if (!Number.isInteger(round) || round < 1) throw new Error('give --round R')
const unit = str(args.unit)
const blockout = phase === 2
if (!blockout && !cfg.units.some((u) => u.id === unit)) throw new Error(`give --unit ID. Units: ${cfg.units.map((u) => u.id).join(', ')}`)
const tierGiven = str(args.tier)
const tier = tierGiven || (blockout ? 'draft' : 'final')
if (!(tier in cfg.tiers)) throw new Error(`no such tier: ${tier}`)
const tierNames = Object.keys(cfg.tiers)
const motionTier = tierGiven || (tierNames.indexOf(tier) < tierNames.indexOf('review') ? 'review' : tier)
const recordRound = args.record === true
const allRoles = blockout ? [BLOCKOUT] : Object.keys(TABLE).filter((r) => TABLE[r](unit))
const only = str(args.only) ? str(args.only).split(',').map((s) => s.trim()) : null
for (const r of only ?? []) if (!allRoles.includes(r)) throw new Error(`the round does not use ${r} here. Roles: ${allRoles.join(', ')}`)
const roles = only ? allRoles.filter((r) => only.includes(r)) : allRoles

const lim = limits()
const roundName = `round-${String(round).padStart(3, '0')}`
const roundDir = rel('out', 'work', 'packs', roundName)
const buildDir = rel('out', 'work', 'packs', 'build', roundName)
const keyFile = rel('out', 'work', 'packs', 'keys', `${roundName}.json`)
const budgetMs = cfg.sandbox.chunkBudgetMinutes * 60000
const started = Date.now()
const shown = (f) => path.relative(rel(), f).split(path.sep).join('/')
const hd = cfg.formats.hd.id
const shots = cfg.film.shots
const shakes = shots.filter((s) => s.from && s.to)
const holds = shots.filter((s) => !(s.from && s.to))
const lockKey = cfg.keys.find((k) => k.unit === cfg.lookLockUnit)

class Stop extends Error {}
const budget = (next) => {
  if (Date.now() - started > budgetMs) throw new Stop(next)
}

const fits = (w, h) => w >= 1 && h >= 1 && Math.max(w, h) <= lim.longEdge && w * h <= lim.maxPixels
const mustFit = (w, h, what) => {
  if (!fits(w, h)) throw new Error(`${what} is ${w} x ${h}, over ${lim.longEdge} px on the long edge or ${lim.maxPixels} pixels`)
}
const from = (img) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
async function raw(pipeline) {
  const { data, info } = await pipeline.removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
const load = (file) => raw(sharp(file))
async function save(img, out) {
  mustFit(img.width, img.height, shown(out))
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await from(img).jpeg(JPEG).toFile(out)
  return out
}
async function fitted(src, out) {
  const img = typeof src === 'string' ? await load(src) : src
  const scale = Math.min(1, lim.longEdge / Math.max(img.width, img.height), Math.sqrt(lim.maxPixels / (img.width * img.height)))
  if (scale === 1) return save(img, out)
  const w = Math.max(1, Math.floor(img.width * scale))
  const h = Math.max(1, Math.floor(img.height * scale))
  return save(await raw(from(img).resize(w, h, { fit: 'fill', kernel: 'lanczos3' })), out)
}
async function sized(img, w, h) {
  return img.width === w && img.height === h ? img : raw(from(img).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }))
}
async function cut(img, left, top, width, height, w = width, h = height) {
  const wd = Math.max(1, Math.min(Math.round(width), img.width))
  const ht = Math.max(1, Math.min(Math.round(height), img.height))
  const l = Math.min(Math.max(Math.round(left), 0), img.width - wd)
  const t = Math.min(Math.max(Math.round(top), 0), img.height - ht)
  return sized(await raw(from(img).extract({ left: l, top: t, width: wd, height: ht })), w, h)
}

function blank(width, height) {
  const data = Buffer.alloc(width * height * 3)
  for (let i = 0; i < data.length; i += 3) {
    data[i] = GROUND[0]
    data[i + 1] = GROUND[1]
    data[i + 2] = GROUND[2]
  }
  return { data, width, height }
}
function paste(dst, src, left, top) {
  for (let y = 0; y < src.height; y++) src.data.copy(dst.data, ((top + y) * dst.width + left) * 3, y * src.width * 3, (y + 1) * src.width * 3)
}
function stamp(dst, text, left, top) {
  let x = left
  for (const ch of String(text)) {
    const g = GLYPHS[ch]
    if (!g) throw new Error(`no glyph for ${ch}`)
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '#') continue
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const o = ((top + r * 2 + dy) * dst.width + x + c * 2 + dx) * 3
            dst.data[o] = INK[0]
            dst.data[o + 1] = INK[1]
            dst.data[o + 2] = INK[2]
          }
      }
    x += 12
  }
}
async function sheetOf(cells, cols, out) {
  const w = cells[0].img.width
  const h = cells[0].img.height
  const rows = Math.ceil(cells.length / cols)
  const sheet = blank(cols * w + GAP * (cols - 1), rows * (h + STRIP) + GAP * (rows - 1))
  cells.forEach((cell, i) => {
    const left = (i % cols) * (w + GAP)
    const top = Math.floor(i / cols) * (h + STRIP + GAP)
    stamp(sheet, cell.label, left + 4, top + 3)
    paste(sheet, cell.img, left, top + STRIP)
  })
  return save(sheet, out)
}
function tileFor(cols, rows, aspect = 0) {
  for (let w = Math.floor((lim.longEdge - GAP * (cols - 1)) / cols); w > 8; w--) {
    const W = cols * w + GAP * (cols - 1)
    const h = aspect ? Math.round(w * aspect) : Math.min(w, Math.floor((Math.min(lim.maxPixels / W, lim.longEdge) - GAP * (rows - 1)) / rows) - STRIP)
    const H = rows * (h + STRIP) + GAP * (rows - 1)
    if (h > 8 && fits(W, H)) return { w, h }
  }
  throw new Error(`no tile fits a ${cols} by ${rows} grid`)
}
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

const reach = (s) => ({ left: s.globe.cx / s.globe.r, right: (s.width - s.globe.cx) / s.globe.r, up: s.globe.cy / s.globe.r, down: (s.height - s.globe.cy) / s.globe.r })
const wholeObject = (s) => {
  const r = reach(s)
  return !!s.base && r.left >= FRAME_MIN.side && r.right >= FRAME_MIN.side && r.up >= FRAME_MIN.up && s.base.foot <= s.height && s.base.left >= 0 && s.base.right <= s.width
}
function commonFrame(sources) {
  const f = { ...FRAME }
  for (const s of sources) {
    const r = reach(s)
    for (const k of Object.keys(f)) f[k] = Math.min(f[k], Math.floor(r[k] * 100) / 100)
  }
  let r = Math.min(...sources.map((s) => s.globe.r))
  const size = () => [Math.floor((f.left + f.right) * r), Math.floor((f.up + f.down) * r)]
  while (!fits(...size()) && f.left > FRAME_MIN.side + 0.005) {
    f.left = Math.round((f.left - 0.01) * 100) / 100
    f.right = Math.min(f.right, f.left)
  }
  while (!fits(...size())) r -= 0.25
  const [width, height] = size()
  return { ...f, r, width, height }
}
async function framed(s, frame) {
  const img = await load(s.file)
  const k = s.globe.r
  return cut(img, s.globe.cx - frame.left * k, s.globe.cy - frame.up * k, (frame.left + frame.right) * k, (frame.up + frame.down) * k, frame.width, frame.height)
}
async function surfaceTiles(sources, list, tile) {
  const lead = sources[sources.length - 1]
  const all = sources.map(reach)
  const lo = { x: -Math.min(...all.map((r) => r.left)), y: -Math.min(...all.map((r) => r.up)) }
  const hi = { x: Math.min(...all.map((r) => r.right)), y: Math.min(...all.map((r) => r.down)) }
  const w = tile.w / lead.globe.r
  const h = tile.h / lead.globe.r
  const out = sources.map(() => [])
  const imgs = []
  for (const s of sources) imgs.push(await load(s.file))
  for (const region of list) {
    const x0 = Math.min(Math.max(region.x - w / 2, lo.x), hi.x - w)
    const y0 = Math.min(Math.max(region.y - h / 2, lo.y), hi.y - h)
    for (let i = 0; i < sources.length; i++) {
      const g = sources[i].globe
      out[i].push(await cut(imgs[i], g.cx + x0 * g.r, g.cy + y0 * g.r, w * g.r, h * g.r, tile.w, tile.h))
    }
  }
  return out
}
async function latticeTiles(file, cols, rows, tile) {
  const img = await load(file)
  const w = Math.min(tile.w, img.width)
  const h = Math.min(tile.h, img.height)
  const tiles = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) tiles.push(await cut(img, cols > 1 ? (c * (img.width - w)) / (cols - 1) : (img.width - w) / 2, rows > 1 ? (r * (img.height - h)) / (rows - 1) : (img.height - h) / 2, w, h))
  return tiles
}

function lastWord(r) {
  const lines = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n')
  const thrown = lines.filter((l) => /^\w*Error: /.test(l)).pop()
  return thrown ? thrown.replace(/^\w*Error: /, '') : lines.pop()
}
const sheetTool = rel('tools', 'sheet.mjs')
const sheetRuns = new Map()
function sheets(asked, what) {
  const flags = [...asked, '--look', 'no']
  const line = `node tools/sheet.mjs ${flags.join(' ')}`
  if (sheetRuns.has(line)) return sheetRuns.get(line)
  if (session) throw new Error(`${line} has to run before the page is opened, because one render runs at a time`)
  let got = null
  if (!fs.existsSync(sheetTool)) got = { files: [], missing: `${what}: tools/sheet.mjs is not in this tree, so this part is empty. It would come from: ${line}` }
  while (!got) {
    budget(line)
    console.log(`running ${line}`)
    const r = spawnSync(process.execPath, [sheetTool, ...flags], { cwd: rel(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    const out = r.stdout ?? ''
    const last = lastWord(r)
    if (r.status === 3) {
      console.log(`${line} ran out of its chunk budget, carrying on`)
      continue
    }
    const files = [...new Set([...out.matchAll(/^(?:wrote|reused) (out\/work\/sheets\/\S+\.jpe?g)(?: |$)/gim)].map((m) => rel(m[1])))].filter((f) => fs.existsSync(f))
    if (r.status === 1) got = { files: [], missing: `${what}: ${line} had nothing to show: ${last}` }
    else if (r.status !== 0) got = { files: [], missing: `${what}: ${line} ended with code ${r.status}: ${last}` }
    else if (!files.length) got = { files: [], missing: `${what}: ${line} ran, but named no sheet under out/work/sheets` }
    else got = { files, missing: '' }
  }
  sheetRuns.set(line, got)
  return got
}
function sheetLegend(file, fallback) {
  const record = fs.existsSync(`${file}.json`) ? readJson(`${file}.json`) : null
  const spec = record?.spec ?? {}
  const shot = shots.find((x) => x.id === spec.shot)
  if (spec.kind === 'film-overview') return `the whole film in ${spec.frames?.length ?? 'a few'} frames, every shot at least once`
  if (spec.kind === 'shot' && shot) {
    const plain = shot.from && shot.to ? `the shot ${shot.id}: one sheet across the shake from ${shot.from} to ${shot.to}` : `the shot ${shot.id}: a hold on ${shot.season}`
    const said = Object.entries(spec.marks ?? {}).map(([i, word]) => `the frame marked as the ${word} is the one labelled ${i} ${(i / cfg.film.fps).toFixed(2)} s ${word}`)
    if (!said.length) return plain
    return `${plain}. ${spec.frames?.[0] === 0 ? 'The first frame of the film is the one labelled 0 0.00 s, and ' : ''}${said.join(', and ')}`
  }
  return fallback
}

let session = null
let pages = null
let judged = null
async function open() {
  if (session) return
  session = await Session.open({ what: `pack ${roundName}` })
  pages = new Pages(session)
  const page = await pages.first()
  judged = await page.evaluate(() => window.showcase.dev.judged())
}
async function draw(entry, t = tier) {
  await open()
  budget(`the still ${entry.id}`)
  const got = await drawJudged(session, pages, entry, { tier: t })
  const size = formatById(entry.format)
  let framing = got.record.framing
  if (!framing && got.record.state?.camera) framing = framingFromPose(got.record.state.camera, size.width, size.height, got.record.state.globe?.heightMm ?? 0)
  return { id: entry.id, season: got.record.state?.season ?? entry.season ?? null, file: got.file, width: size.width, height: size.height, globe: framing?.globe ?? null, base: framing?.base ?? null, what: `${entry.id}: ${entry.what ?? 'a still'}, ${entry.format}, ${t} tier` }
}
async function tryDraw(entry, missing, t = tier) {
  try {
    return await draw(entry, t)
  } catch (e) {
    if (e instanceof Stop) throw e
    missing.push(`${entry.id} could not be drawn: ${String(e?.message ?? e).split('\n')[0]}`)
    return null
  }
}
function control(key) {
  const a = approvedFor(key.image)
  if (!a) throw new Error(`references/regions.json has no entry for ${key.image}`)
  return { id: `approved ${key.id}`, file: rel(key.image), width: a.width, height: a.height, globe: a.globe, base: a.base, what: `the approved image ${key.image}`, sha256: fileSha(rel(key.image)), key }
}
const filmFrame = (frame) => ({ id: `film-frame-${frame}`, unit: 'film', kind: 'film', format: hd, frame, what: `film frame ${frame}` })
const viewOf = (season, state, camera) =>
  judged.find((e) => (e.kind === 'key' || e.kind === 'still') && !e.interface && e.season === season && e.state === state && e.camera === camera && e.format === hd) ?? { id: `view-${season}-${state}-${camera}`, kind: 'view', format: hd, season, state, camera, what: `${season} in the ${state} state from ${camera}` }
const screens = () => judged.filter((e) => e.interface)
const settledLines = (key) => [...cfg.settledAll, ...(key.settled ?? [])]
const tmp = (role, name) => path.join(buildDir, role, name)
const one = (file, what, legend, extra = {}) => ({ file, what, legend, ...extra })

function sheetGroups(role, wanted, missing) {
  const groups = []
  const seen = new Map()
  for (const w of wanted) {
    if (!w.flags) {
      missing.push(`${w.what}: no tool makes this yet, so this part is empty`)
      continue
    }
    const got = sheets(w.flags, w.what)
    if (got.missing) missing.push(got.missing)
    const list = w.order ? w.order(got.files) : got.files
    const fresh = []
    for (const f of list) {
      const sha = fileSha(f)
      if (seen.has(sha)) seen.get(sha).what += `. Also: ${w.what}`
      else {
        const item = one(f, `${w.what}, from node tools/sheet.mjs ${w.flags.join(' ')}: ${shown(f)}`, '')
        seen.set(sha, item)
        fresh.push(item)
      }
    }
    fresh.forEach((item, i) => {
      const plain = fresh.length > 1 ? `${w.what}, sheet ${i + 1} of ${fresh.length}` : w.what
      item.legend = w.byRecord ? sheetLegend(item.file, plain) : plain
    })
    if (fresh.length) groups.push({ title: w.what, files: fresh })
  }
  return groups
}
const overviewFirst = (files) => [...files.filter((f) => readJson(`${f}.json`).spec?.kind === 'film-overview'), ...files.filter((f) => readJson(`${f}.json`).spec?.kind !== 'film-overview')]
const wholeFilm = (flags) => ({ what: 'the whole film', flags, byRecord: true, order: overviewFirst })
const sheetFlags = (...f) => [...f, '--tier', motionTier]

async function buildBlockout(role) {
  const missing = []
  const draft = ['--tier', tier]
  const groups = sheetGroups(role, [wholeFilm(['--film', '--mark', `${Math.round(cfg.film.revealBySeconds * cfg.film.fps)}=reveal`, ...draft]), ...shakes.map((s) => ({ what: `one sheet across the shake ${s.id}`, flags: ['--shot', s.id, ...draft] }))], missing)
  await open()
  const target = control(lockKey)
  const tile = tileFor(1, 2, target.height / target.width)
  const a = await sized(await load(target.file), tile.w, tile.h)
  const cams = { title: 'the framing of each camera', files: [], text: [] }
  for (const camera of Object.keys(cfg.cameras)) {
    const still = await tryDraw(viewOf(lockKey.season, lockKey.state, camera), missing)
    if (!still) continue
    const b = await sized(await load(still.file), tile.w, tile.h)
    const file = await sheetOf([{ img: a, label: 'a' }, { img: b, label: 'b' }], 1, tmp(role, `camera-${camera}.jpg`))
    cams.files.push(one(file, `a: ${target.what}. b: ${still.what}, the camera ${camera}`, `the camera ${camera}: the picture marked a is the target, the picture marked b is this camera on the placeholder globe`, camera === lockKey.camera ? { settled: settledLines(lockKey) } : {}))
  }
  if (cams.files.length) groups.push(cams)
  const scr = { title: "the app's screen with its controls", files: [] }
  const formats = new Set()
  for (const e of screens()) {
    if (formats.has(e.format)) continue
    formats.add(e.format)
    const still = await tryDraw(e, missing)
    if (still) scr.files.push(one(await fitted(still.file, tmp(role, `screen-${e.format}.jpg`)), still.what, `the app's screen with its controls, ${still.width} by ${still.height}`))
  }
  if (scr.files.length) groups.push(scr)
  return { groups, missing }
}

async function buildR1(role) {
  await open()
  const missing = []
  const groups = []
  const list = SURFACES.filter((s) => s.pair)
  const tile = tileFor(3, Math.ceil(list.length / 3))
  for (const key of cfg.keys.filter((k) => k.unit === unit)) {
    const a = control(key)
    const b = await tryDraw(judged.find((e) => e.id === key.id), missing)
    if (!b) continue
    const frame = commonFrame([a, b])
    const [ta, tb] = await surfaceTiles([a, b], list, tile)
    const cells = (tiles) => tiles.map((img, i) => ({ img, label: i + 1 }))
    const names = list.map((s, i) => `${i + 1} ${s.name}`).join('; ')
    groups.push({
      title: key.id,
      settled: settledLines(key),
      files: [
        one(await save(await framed(a, frame), tmp(role, `${key.id}-a.jpg`)), `${a.what}, cropped to the globe, its base and the surface around them`, 'the pair', { pair: 1, side: 'a', sha256Source: a.sha256 }),
        one(await save(await framed(b, frame), tmp(role, `${key.id}-b.jpg`)), `${b.what}, cropped the same way`, 'the pair', { pair: 1, side: 'b' }),
        one(await sheetOf(cells(ta), 3, tmp(role, `${key.id}-crops-a.jpg`)), `crops of ${a.what}, resized to the size of the still: ${names}`, `matching crops of the pair at the size of -b: ${names}`, { pair: 2, side: 'a' }),
        one(await sheetOf(cells(tb), 3, tmp(role, `${key.id}-crops-b.jpg`)), `native size crops of ${b.what}: ${names}`, `matching crops of the pair at the size of -b: ${names}`, { pair: 2, side: 'b' }),
      ],
    })
  }
  return { groups, missing }
}

const soonAfterLanding = (e) => e.state === 'landed' || e.at === 'landing' || /-(landing|landed)$/.test(e.id)
function juryCandidates() {
  const plain = judged.filter((e) => !e.interface && e.kind !== 'opening' && !(e.at === 'swap') && !/-swap$/.test(e.id))
  if (recordRound) return plain
  const mine = plain.filter((e) => e.unit === unit)
  if (unit === 'change') return mine.filter((e) => e.at === 'landing')
  if (unit === 'globe') return mine.filter((e) => e.kind === 'live')
  if (unit === 'film') return mine.filter((e) => e.kind === 'film')
  return [...mine.filter((e) => e.kind === 'key'), ...mine.filter((e) => e.kind !== 'key')]
}
async function buildR2(role) {
  await open()
  const missing = []
  const notes = []
  const picked = []
  const max = recordRound ? Infinity : cfg.quality.jury.stillsPerUnit
  for (const e of juryCandidates()) {
    if (picked.length >= max) break
    const still = await tryDraw(e, missing)
    if (!still) continue
    if (!still.globe || !wholeObject(still)) {
      notes.push(`left out of the jury: ${e.id}. Its framing does not show the globe and its base whole, so it cannot be cropped to what a control shows`)
      continue
    }
    picked.push({ ...still, entry: e })
  }
  const controls = []
  for (const key of cfg.keys) {
    const like = picked.some((p) => soonAfterLanding(p.entry) === soonAfterLanding(key) && (!p.season || p.season === key.season))
    if (like) controls.push(control(key))
  }
  if (!picked.length) return { groups: [], missing: [...missing, 'no judged image could go to the jury'], notes }
  const frame = commonFrame([...controls, ...picked])
  notes.push(`every image is cropped to ${frame.left} radii left, ${frame.right} right, ${frame.up} up and ${frame.down} down of the globe centre, at ${frame.width} x ${frame.height}`)
  const all = [...picked.map((p) => ({ ...p, role: 'judged' })), ...controls.map((c) => ({ ...c, role: 'control' }))]
  const order = (x) => sha256(`${cfg.seed}:${round}:${x.id}`)
  all.sort((x, y) => (order(x) < order(y) ? -1 : 1))
  const files = []
  for (const x of all) files.push(one(await save(await framed(x, frame), tmp(role, `${x.id.replace(/[^a-z0-9-]/gi, '-')}.jpg`)), `${x.role}: ${x.what}`, '', { jury: x.role, id: x.id, ...(x.sha256 ? { sha256Source: x.sha256 } : {}) }))
  return { groups: chunks(files, cfg.critics.maxFilesPerMessage).map((f) => ({ title: 'jury', files: f })), missing, notes }
}

async function buildR3(role) {
  await open()
  const missing = []
  const groups = []
  const tile = tileFor(3, 2)
  for (const e of judged.filter((x) => x.unit === unit && (x.kind === 'key' || x.kind === 'still') && !x.interface)) {
    const still = await tryDraw(e, missing)
    if (!still) continue
    const hero = still.globe && wholeObject(still)
    const tiles = hero ? (await surfaceTiles([still], SURFACES, tile))[0] : await latticeTiles(still.file, 4, 3, tile)
    const names = hero ? SURFACES.map((s, i) => `${i + 1} ${s.name}`).join('; ') : 'numbered left to right, top to bottom across the still, four to a row'
    const files = [one(await fitted(still.file, tmp(role, `${e.id}.jpg`)), `${still.what}, resized to fit`, 'a still, resized to fit')]
    const parts = chunks(tiles.map((img, i) => ({ img, label: i + 1 })), 6)
    for (let i = 0; i < parts.length; i++) files.push(one(await sheetOf(parts[i], 3, tmp(role, `${e.id}-crops-${i + 1}.jpg`)), `native size crops of ${still.what}: ${names}`, `native size crops of {first}: ${names}`))
    groups.push({ title: e.id, files })
  }
  return { groups, missing }
}

function buildR4(role) {
  const missing = []
  const test = cfg.lookLockUnit === unit
  const wanted = []
  if (seasonal(unit)) {
    const into = test ? null : shakes.find((s) => s.to === unit)
    const shot = test ? 'test' : into?.id
    const rest = holds.find((h) => h.season === unit)
    if (test) for (const m of ['lift', 'strokes', 'setdown', 'landing']) wanted.push({ what: `the ${m === 'setdown' ? 'set down' : m === 'landing' ? 'first second after the landing' : m} of the shake`, flags: sheetFlags('--motion', m, '--shot', shot) })
    wanted.push({ what: 'one sheet across the whole shake and the clearing that follows', flags: sheetFlags('--shot', shot) })
    if (!test) wanted.push({ what: 'the arrival', flags: sheetFlags('--motion', 'arrival', '--shot', into.id) })
    wanted.push({ what: 'the globe at rest across several seconds', flags: sheetFlags('--shot', rest.id) })
  } else if (unit === 'change') {
    for (const s of shakes) {
      wanted.push({ what: `the change ${s.from} to ${s.to}: across the swap window`, flags: sheetFlags('--motion', 'swap', '--fit', '--shot', s.id) })
      wanted.push({ what: `the change ${s.from} to ${s.to}: from the landing through the arrival`, flags: sheetFlags('--motion', 'arrival', '--shot', s.id) })
    }
  } else if (unit === 'globe') {
    for (const w of ['a shake', 'a stir', 'a drag around the globe', 'a jump to another season']) wanted.push({ what: `${w}, drawn through the app's path` })
  } else {
    wanted.push(wholeFilm(sheetFlags('--film')))
    for (const s of shakes) wanted.push({ what: `one sheet across the shake ${s.id}`, flags: sheetFlags('--shot', s.id) })
    holds.forEach((h, i) => wanted.push({ what: i === 0 ? 'the opening pull back' : i === holds.length - 1 ? 'the last push in' : `the camera move in ${h.id}`, flags: sheetFlags('--motion', 'move', '--shot', h.id) }))
    wanted.push({ what: 'one sheet across the loop', flags: sheetFlags('--loop') })
    wanted.push({ what: "the loop's seam, last frames then first frames", flags: sheetFlags('--loop', '--seam') })
  }
  return { groups: sheetGroups(role, wanted, missing), missing }
}

async function frameGrid(role, entries, name, cols, rows, width, missing, legend = null) {
  const files = []
  const stills = []
  for (const e of entries) {
    const s = await tryDraw(e, missing)
    if (s) stills.push({ ...s, entry: e })
  }
  if (!stills.length) return files
  const aspect = stills[0].height / stills[0].width
  const fit = tileFor(cols, rows, aspect)
  const tile = width && width <= fit.w ? { w: width, h: Math.round(width * aspect) } : fit
  const parts = chunks(stills, cols * rows)
  let n = 0
  for (let i = 0; i < parts.length; i++) {
    const cells = []
    for (const s of parts[i]) cells.push({ img: await sized(await load(s.file), tile.w, tile.h), label: ++n })
    const first = n - cells.length + 1
    const list = parts[i].map((s, j) => `${first + j} ${s.entry.what}`).join('; ')
    files.push(one(await sheetOf(cells, cols, tmp(role, `${name}-${i + 1}.jpg`)), `frames ${parts[i].map((s) => s.id).join(', ')}, ${tier} tier: ${list}`, legend ? `${legend}: ${list}` : `frames in order, numbered ${first} to ${n}`))
  }
  return files
}

async function buildR5(role) {
  const missing = []
  let groups
  if (unit === 'globe') {
    groups = sheetGroups(role, [{ what: 'the four seasons at rest', flags: sheetFlags('--seasons') }], missing)
    await open()
    const scr = { title: 'the screen stills', files: [] }
    for (const e of screens()) {
      const still = await tryDraw(e, missing)
      if (still) scr.files.push(one(await fitted(still.file, tmp(role, `${e.id}.jpg`)), still.what, 'a still of the app'))
    }
    if (scr.files.length) groups.push(scr)
    missing.push("one sheet across a shake in the app: no tool makes this yet, so this part is empty")
  } else {
    groups = sheetGroups(role, [wholeFilm(sheetFlags('--film'))], missing)
    await open()
    const files = await frameGrid(role, judged.filter((e) => e.kind === 'film'), 'frames', 3, 3, 0, missing)
    if (files.length) groups.push({ title: "the film's judged frames in order", files })
  }
  return { groups, missing }
}

async function buildR6(role) {
  const missing = []
  const groups = []
  await open()
  const fps = cfg.film.fps
  const last = Math.round(cfg.film.revealBySeconds * fps)
  const step = Math.round(fps / 2)
  const frames = [...new Set([...Array.from({ length: Math.floor(last / step) + 1 }, (_, i) => i * step), Math.round(cfg.film.hookSeconds * fps), last])].sort((x, y) => x - y)
  const wide = cfg.critics.phonePreviewWidthPx
  const films = [
    { name: 'film B', make: (f) => ({ ...filmFrame(f), what: `the frame at ${(f / fps).toFixed(2)} s` }) },
    { name: 'film A', make: (f) => ({ id: `opening-frame-${f}`, unit: 'film', kind: 'opening', format: hd, frame: f, what: `the frame at ${(f / fps).toFixed(2)} s` }) },
  ]
  for (const film of films) {
    const files = []
    const first = await tryDraw(film.make(0), missing)
    if (first) {
      const img = await load(first.file)
      files.push(one(await save(await sized(img, wide, Math.round((wide * img.height) / img.width)), tmp(role, `${film.name.replace(' ', '-')}-first.jpg`)), `${film.name}, frame 0, ${wide} px wide`, `${film.name}: the first frame`))
      files.push(...(await frameGrid(role, frames.map(film.make), film.name.replace(' ', '-'), 3, 3, wide, missing, `${film.name}: frames in order`)))
    }
    if (files.length) groups.push({ title: film.name, files })
    else missing.push(`${film.name}: no frame could be drawn, so this part is empty`)
  }
  return { groups, missing }
}

const stressTool = rel('tools', 'stress.mjs')
const stressFile = rel('out', 'work', 'stress', 'stress.json')
const stressWhat = 'stills taken from the stress encode beside the same frames before encoding'
let stressGot = null
function stressNow() {
  if (!fs.existsSync(stressFile)) return null
  const s = readJson(stressFile)
  if (!s.complete || s.tier !== tier || !s.moments?.length) return null
  const want = { seasons: cfg.seasons, format: hd, tier }
  const list = s.moments.map((m) => ({ ...m, low: m.encodes.find((e) => e.mbps === cfg.quality.compressionStressMbps) }))
  return list.every((m) => m.low && recordMatches(rel(m.source), want) && recordMatches(rel(m.low.still), want)) ? list : null
}
function stress() {
  if (stressGot) return stressGot
  const flags = ['--tier', tier, '--look', 'no']
  const line = `node tools/stress.mjs ${flags.join(' ')}`
  let moments = stressNow()
  let missing = ''
  if (!moments && !fs.existsSync(stressTool)) missing = `${stressWhat}: tools/stress.mjs is not in this tree, so this pack is empty. It would come from: ${line}`
  else if (!moments) {
    if (session) throw new Error(`${line} has to run before the page is opened, because one render runs at a time`)
    budget(line)
    console.log(`running ${line}`)
    const r = spawnSync(process.execPath, [stressTool, ...flags], { cwd: rel(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    const last = lastWord(r)
    moments = stressNow()
    if (!moments) missing = `${stressWhat}: ${line} ended with code ${r.status} and left no whole ${shown(stressFile)} for this build, so this pack is empty. Run the same pack command again to carry on: ${last}`
  }
  stressGot = { moments: moments ?? [], missing }
  return stressGot
}
function stressRects(img, framing, tile) {
  const known = !!framing && Number.isFinite(framing.globe.r)
  const g = known ? framing.globe : { cx: img.width / 2, cy: img.height / 2, r: img.height / 3 }
  const w = Math.min(tile.w, img.width)
  const h = Math.min(tile.h, img.height)
  const steps = (span, size) => {
    const step = Math.max(1, Math.floor(size / STRESS_SCAN.stepsPerTile))
    return [...new Set([...Array.from({ length: Math.floor((span - size) / step) + 1 }, (_, i) => i * step), span - size])]
  }
  const cands = []
  for (const top of steps(img.height, h))
    for (const left of steps(img.width, w)) {
      let sum = 0
      let lit = 0
      let n = 0
      for (let y = top; y < top + h; y += STRESS_SCAN.every)
        for (let x = left; x < left + w; x += STRESS_SCAN.every) {
          const o = (y * img.width + x) * 3
          const l = 0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2]
          sum += l
          if (l > STRESS_SCAN.lit) lit++
          n++
        }
      const clear = Math.hypot(Math.min(Math.max(g.cx, left), left + w) - g.cx, Math.min(Math.max(g.cy, top), top + h) - g.cy) >= g.r
      cands.push({ left, top, mean: sum / n, lit: lit / n, rank: !known ? 0 : clear && top + h <= g.cy + g.r * STRESS_SCAN.below ? 0 : clear ? 1 : 2 })
    }
  const best = Math.min(...cands.map((c) => c.rank))
  const pool = cands.filter((c) => c.rank === best)
  const plain = pool.filter((c) => c.lit <= STRESS_SCAN.none)
  const dark = plain.length ? plain.reduce((a, b) => (b.mean > a.mean ? b : a)) : pool.reduce((a, b) => (b.lit < a.lit ? b : a))
  const rest = pool.filter((c) => c !== dark)
  const lit = rest.length ? rest.reduce((a, b) => (b.lit > a.lit || (b.lit === a.lit && b.mean > a.mean) ? b : a)) : dark
  const fixed = (s) => ({ left: Math.round(Math.min(Math.max(g.cx + s.x * g.r - w / 2, 0), img.width - w)), top: Math.round(Math.min(Math.max(g.cy + s.y * g.r - h / 2, 0), img.height - h)) })
  return { known, w, h, rects: STRESS.map((s) => (s.pick === 'dark' ? dark : s.pick === 'lit' ? lit : fixed(s))) }
}
async function buildR7(role) {
  const got = stress()
  const missing = got.missing ? [got.missing] : []
  const notes = []
  const groups = []
  if (!got.moments.length) return { groups, missing, notes }
  await open()
  const page = await pages.first()
  const size = formatById(hd)
  const tile = tileFor(STRESS_GRID.cols, STRESS_GRID.rows)
  const names = STRESS.map((s, i) => `${i + 1} ${s.name}`).join('; ')
  for (const m of got.moments) {
    budget(`the stress pictures of ${m.shot}`)
    let framing = null
    try {
      const state = await page.evaluate((f) => window.showcase.filmState(f), m.frame)
      if (state?.camera) framing = framingFromPose(state.camera, size.width, size.height, state.globe?.heightMm ?? 0)
    } catch {}
    const a = await load(rel(m.source))
    const b = await load(rel(m.low.still))
    if (a.width !== b.width || a.height !== b.height) throw new Error(`${m.source} and ${m.low.still} are not the same size`)
    const at = stressRects(a, framing, tile)
    if (!at.known) notes.push(`${m.shot}: the film state gave no globe in frame ${m.frame}, so its crops are placed by the frame`)
    const cells = []
    for (const img of [a, b]) {
      const row = []
      for (const [i, r] of at.rects.entries()) row.push({ img: await cut(img, r.left, r.top, at.w, at.h), label: i + 1 })
      cells.push(row)
    }
    const id = `${m.shot}-${m.frame}`
    const title = `${m.moment === 'shake' ? 'the shake' : 'the hold'} ${m.shot} at ${(m.frame / cfg.film.fps).toFixed(2)} s`
    const before = `film frame ${m.frame} before encoding, ${shown(rel(m.source))}`
    const after = `the same frame taken out of the encode at ${m.low.mbps} Mbps (${m.low.fileMbps} Mbps in the file, ${m.low.psnr.toFixed(1)} dB against the frame before), ${shown(rel(m.low.still))}`
    const whole = `${title}: the picture marked -a is the frame before encoding, the picture marked -b is the same frame taken out of the encode, both resized to fit`
    const crops = `${title}: native size crops of that pair, -a before encoding and -b out of the encode: ${names}`
    groups.push({
      title,
      files: [
        one(await fitted(a, tmp(role, `${id}-a.jpg`)), `${title}: ${before}, resized to fit`, whole, { pair: 1, side: 'a', sha256Source: fileSha(rel(m.source)) }),
        one(await fitted(b, tmp(role, `${id}-b.jpg`)), `${title}: ${after}, resized to fit`, whole, { pair: 1, side: 'b', sha256Source: fileSha(rel(m.low.still)) }),
        one(await sheetOf(cells[0], STRESS_GRID.cols, tmp(role, `${id}-crops-a.jpg`)), `${title}: native size crops of the frame before encoding: ${names}`, crops, { pair: 2, side: 'a' }),
        one(await sheetOf(cells[1], STRESS_GRID.cols, tmp(role, `${id}-crops-b.jpg`)), `${title}: native size crops of the frame out of the encode: ${names}`, crops, { pair: 2, side: 'b' }),
      ],
    })
  }
  return { groups, missing, notes }
}

async function buildR8(role) {
  const missing = []
  await open()
  const scr = { title: 'the screen stills', files: [] }
  for (const e of screens()) {
    const still = await tryDraw(e, missing)
    if (still) scr.files.push(one(await fitted(still.file, tmp(role, `${e.id}.jpg`)), still.what, `a still of the app, ${still.width} by ${still.height}`))
  }
  missing.push('close crops of each control at rest, focused and pressed: no tool makes these yet, so this part is empty')
  missing.push("one sheet of the Shake control's hint: no tool makes this yet, so this part is empty")
  return { groups: scr.files.length ? [scr] : [], missing }
}

const BUILD = { [BLOCKOUT]: buildBlockout, R1: buildR1, R2: buildR2, R3: buildR3, R4: buildR4, R5: buildR5, R6: buildR6, R7: buildR7, R8: buildR8 }

const kit = fs.readFileSync(rel('kit', '07-QUALITY-BAR.md'), 'utf8').split('\n')
function kitSection(start) {
  const i = kit.findIndex((l) => l.startsWith(start))
  if (i < 0) throw new Error(`kit/07-QUALITY-BAR.md has no heading starting ${start}`)
  let j = i + 1
  while (j < kit.length && !/^#{2,3} /.test(kit[j])) j++
  return kit.slice(i, j).join('\n').trim()
}
function returnFormat(example) {
  const i = kit.findIndex((l) => l.startsWith('```json'))
  const j = kit.findIndex((l, n) => n > i && l.startsWith('```'))
  const after = kit.slice(j + 1).find((l) => l.startsWith('- `score`'))
  const shape = kit.slice(i, j + 1).map((l) => l.replace(/"file": "[^"]*"/, `"file": "${example}"`))
  return ['Return one JSON object in this shape and nothing else.', '', ...shape, '', after].join('\n')
}
function messageFor(role, part) {
  if (role === 'R2') return kit.find((l) => l.startsWith(JURY_TEXT_START)).slice(2)
  const head = role === BLOCKOUT ? '### R4 blockout ·' : `### ${role} ·`
  const out = [kitSection(head), '', kitSection('### The severity scale'), '', '### The answer', '', returnFormat(part.groups[0].files[0].name), '', '### Files', '']
  const settled = []
  for (const g of part.groups) {
    const pairs = new Map()
    for (const f of g.files) {
      if (f.pair) pairs.set(f.pair, [...(pairs.get(f.pair) ?? []), f])
      else out.push(`- \`${f.name}\`: ${f.legend}`)
      if (f.settled) settled.push({ names: [f.name], lines: f.settled })
    }
    for (const pair of pairs.values()) out.push(`- ${pair.map((f) => `\`${f.name}\``).join(' and ')}: ${pair[0].legend}`)
    if (g.settled) settled.push({ names: g.files.filter((f) => f.pair === 1).map((f) => f.name), lines: g.settled })
  }
  for (const s of settled) out.push('', '### Settled', '', s.names.map((n) => `\`${n}\``).join(' and '), '', ...s.lines.map((l) => `- ${l}`))
  return out.join('\n').trim() + '\n'
}

const letters = (n) => (n < 26 ? String.fromCharCode(65 + n) : letters(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26)))
async function emit(src, dest) {
  const m = await sharp(src).metadata()
  const clean = m.format === 'jpeg' && !m.exif && !m.icc && !m.xmp && !m.iptc && fits(m.width, m.height)
  if (clean) fs.copyFileSync(src, dest)
  else await fitted(src, dest)
  const done = await sharp(dest).metadata()
  mustFit(done.width, done.height, shown(dest))
  return { width: done.width, height: done.height }
}
async function writeRole(role, built) {
  const max = cfg.critics.maxFilesPerMessage
  const parts = []
  const whole = built.groups.flatMap((g) => (g.files.length > max && !g.settled && !g.files.some((f) => f.pair) ? chunks(g.files, max).map((files) => ({ ...g, files })) : [g]))
  for (const g of whole) {
    if (g.files.length > max) throw new Error(`${role}: ${g.title} alone is ${g.files.length} files, over critics.maxFilesPerMessage`)
    const last = parts[parts.length - 1]
    if (last && last.count + g.files.length <= max) {
      last.groups.push(g)
      last.count += g.files.length
    } else parts.push({ groups: [g], count: g.files.length })
  }
  for (const f of fs.existsSync(roundDir) ? fs.readdirSync(roundDir) : []) if (f === role || f === `${role}.message.md` || (f.startsWith(`${role}-`) && /^\d+(\.message\.md)?$/.test(f.slice(role.length + 1)))) fs.rmSync(path.join(roundDir, f), { recursive: true, force: true })
  const out = []
  let letter = 0
  for (let p = 0; p < parts.length; p++) {
    const name = parts.length > 1 ? `${role}-${p + 1}` : role
    const folder = path.join(roundDir, name)
    fs.mkdirSync(folder, { recursive: true })
    const files = []
    for (const g of parts[p].groups) {
      const L = letters(letter++)
      let n = 0
      const pairNo = new Map()
      for (const f of g.files) {
        let no
        if (f.pair) {
          if (!pairNo.has(f.pair)) pairNo.set(f.pair, ++n)
          no = pairNo.get(f.pair)
        } else no = ++n
        f.name = `set-${L}-${String(no).padStart(2, '0')}${f.side ? `-${f.side}` : ''}.jpg`
        f.legend = f.legend.replace('{first}', `\`${g.files[0].name}\``)
        if (!NAME.test(f.name)) throw new Error(`not a neutral name: ${f.name}`)
        const dest = path.join(folder, f.name)
        const size = await emit(f.file, dest)
        files.push({ name: f.name, what: f.what, ...(f.file.startsWith(buildDir) ? {} : { source: shown(f.file) }), sha256: fileSha(dest), ...size, ...(f.jury ? { jury: f.jury, id: f.id } : {}), ...(f.sha256Source ? { sha256Source: f.sha256Source } : {}) })
      }
    }
    const message = path.join(roundDir, `${name}.message.md`)
    fs.writeFileSync(message, messageFor(role, parts[p]))
    out.push({ folder: shown(folder), message: shown(message), files })
  }
  return out
}

fs.rmSync(buildDir, { recursive: true, force: true })
const key = { round, phase, unit: blockout ? null : unit, tier, motionTier, record: recordRound, limits: { longEdge: lim.longEdge, maxPixels: lim.maxPixels, maxFiles: cfg.critics.maxFilesPerMessage }, engineHash: '', roles: {} }
let stopped = ''
const results = new Map()
try {
  const first = ['R4', 'R5', BLOCKOUT]
  if (roles.includes('R7')) stress()
  for (const role of [...first.filter((r) => roles.includes(r)), ...roles.filter((r) => !first.includes(r))]) results.set(role, await BUILD[role](role))
} catch (e) {
  if (!(e instanceof Stop)) {
    if (session) await session.close()
    throw e
  }
  stopped = e.message
}
if (session) {
  key.engineHash = session.hash
  await session.close()
}
if (stopped) {
  console.log(`pack ${roundName}: stopped at sandbox.chunkBudgetMinutes before ${stopped}. Nothing was written to the pack folders, and what was drawn is kept. Run the same pack command again to carry on.`)
  process.exit(0)
}
if (only && fs.existsSync(keyFile)) {
  const prev = readJson(keyFile)
  for (const r of Object.keys(prev.roles ?? {})) if (!roles.includes(r)) key.roles[r] = prev.roles[r]
}
for (const role of roles) {
  const built = results.get(role)
  const parts = await writeRole(role, built)
  key.roles[role] = { parts, missing: built.missing, notes: built.notes ?? [] }
  for (const p of parts) console.log(`${role}: ${p.files.length} files in ${p.folder}, message in ${p.message}`)
  if (!parts.length) console.log(`${role}: empty`)
  for (const m of built.missing) console.log(`${role}: MISSING ${m}`)
  for (const n of built.notes ?? []) console.log(`${role}: ${n}`)
}
writeJson(keyFile, key)
fs.rmSync(buildDir, { recursive: true, force: true })
if (fs.existsSync(path.dirname(buildDir)) && fs.readdirSync(path.dirname(buildDir)).length === 0) fs.rmdirSync(path.dirname(buildDir))
const count = roles.reduce((n, r) => n + key.roles[r].parts.reduce((m, p) => m + p.files.length, 0), 0)
const gaps = roles.reduce((n, r) => n + key.roles[r].missing.length, 0)
console.log(`pack ${roundName}: ${count} files for ${roles.join(', ')}, ${gaps} parts missing · ${tier} · ${Math.round((Date.now() - started) / 1000)} s`)
console.log(shown(keyFile))
process.exit(0)
