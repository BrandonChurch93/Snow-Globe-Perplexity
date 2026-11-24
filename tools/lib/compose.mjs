import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { ROOT, loadConfig, readJson, rel, writeJson } from './paths.mjs'
import { fileSha } from './hashes.mjs'

const PANEL_GAP = 8
const GRID_GAP = 6
const STRIP = 22
const FRAME = { left: 1.45, right: 1.45, up: 1.25, down: 2.05 }
const CROP_HEIGHT = 392
const CROPS = [
  { name: 'miniature', x: 0, y: 0.15 },
  { name: 'crown', x: -0.45, y: -0.72 },
  { name: 'collar', x: 0, y: 0.93 },
  { name: 'base-front', x: 0, y: 1.3 },
  { name: 'foot', x: 0, y: 1.75 },
]
const GROUND = { r: 20, g: 20, b: 23 }
const INK = [112, 112, 120]
const EDGE_BLUR = 14
const JPEG = { quality: 92, chromaSubsampling: '4:4:4' }
const GLYPHS = {
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
}

export function limits() {
  const cfg = loadConfig()
  const lim = readJson(rel('config', 'image-limit.json'))
  return {
    longEdge: cfg.critics.maxImageLongEdgePx,
    maxPixels: Math.min(lim.safePixels ?? lim.maxPixels, lim.maxPixels),
    statusLongEdge: cfg.status.pictureLongEdgePx,
  }
}

const fits = (w, h, lim) => w >= 1 && h >= 1 && Math.max(w, h) <= lim.longEdge && w * h <= lim.maxPixels

function assertFits(w, h, lim, what) {
  if (!fits(w, h, lim)) throw new Error(`${what} is ${w} x ${h}, over the limit of ${lim.longEdge} px on the long edge or ${lim.maxPixels} pixels`)
}

const shown = (file) => {
  const abs = path.resolve(file)
  const r = path.relative(ROOT, abs)
  return r.startsWith('..') || path.isAbsolute(r) ? abs : r.split(path.sep).join('/')
}

const ensureDirFor = (file) => fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })

async function loadRgb(file) {
  const { data, info } = await sharp(file).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) throw new Error(`${file} did not decode to 3 channels`)
  return { data, width: info.width, height: info.height }
}

const fromRgb = (img) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })

async function toRgb(pipeline) {
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

async function save(img, out) {
  ensureDirFor(out)
  const p = fromRgb(img)
  if (path.extname(out).toLowerCase() === '.png') await p.png({ compressionLevel: 9 }).toFile(out)
  else await p.jpeg(JPEG).toFile(out)
}

function canvas(width, height) {
  const data = Buffer.alloc(width * height * 3)
  for (let i = 0; i < data.length; i += 3) {
    data[i] = GROUND.r
    data[i + 1] = GROUND.g
    data[i + 2] = GROUND.b
  }
  return { data, width, height }
}

function paste(dst, src, left, top) {
  for (let y = 0; y < src.height; y++) {
    src.data.copy(dst.data, ((top + y) * dst.width + left) * 3, y * src.width * 3, (y + 1) * src.width * 3)
  }
}

function drawMark(dst, letter, centreX, centreY, unit = 2) {
  const rows = GLYPHS[letter]
  const left = Math.round(centreX - (rows[0].length * unit) / 2)
  const top = Math.round(centreY - (rows.length * unit) / 2)
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '#') continue
      for (let dy = 0; dy < unit; dy++) {
        for (let dx = 0; dx < unit; dx++) {
          const o = ((top + j * unit + dy) * dst.width + left + i * unit + dx) * 3
          dst.data[o] = INK[0]
          dst.data[o + 1] = INK[1]
          dst.data[o + 2] = INK[2]
        }
      }
    }
  })
}

function scaler(source) {
  const cache = new Map()
  return async (scale) => {
    const w = Math.max(1, Math.round(source.width * scale))
    const h = Math.max(1, Math.round(source.height * scale))
    const key = `${w}x${h}`
    if (!cache.has(key)) {
      const img = w === source.width && h === source.height ? source : await toRgb(fromRgb(source).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }))
      cache.set(key, img)
    }
    return { img: cache.get(key), sx: w / source.width, sy: h / source.height }
  }
}

async function cut(scaled, rect, outW, outH) {
  const { img, sx, sy } = await scaled(outW / rect.w)
  const left = Math.round(rect.x * sx)
  const top = Math.round(rect.y * sy)
  const pad = {
    left: Math.max(0, -left),
    top: Math.max(0, -top),
    right: Math.max(0, left + outW - img.width),
    bottom: Math.max(0, top + outH - img.height),
  }
  const filled = pad.left + pad.top + pad.right + pad.bottom > 0
  let field = img
  if (filled) {
    const spread = await toRgb(fromRgb(img).extend({ ...pad, extendWith: 'copy' }))
    const soft = await toRgb(fromRgb(spread).blur(EDGE_BLUR))
    paste(soft, img, pad.left, pad.top)
    field = soft
  }
  const out = await toRgb(fromRgb(field).extract({ left: left + pad.left, top: top + pad.top, width: outW, height: outH }))
  return { img: out, filled, pad }
}

const frameRect = (g) => ({
  x: g.cx - FRAME.left * g.r,
  y: g.cy - FRAME.up * g.r,
  w: (FRAME.left + FRAME.right) * g.r,
  h: (FRAME.up + FRAME.down) * g.r,
})

const round2 = (v) => Math.round(v * 100) / 100
const roundRect = (r) => ({ x: round2(r.x), y: round2(r.y), w: round2(r.w), h: round2(r.h) })

function rowsPerFile(width, rowHeight, gap, lim) {
  let n = 0
  while (fits(width, (n + 1) * rowHeight + n * gap, lim)) n++
  return n
}

export async function composeComparison({ a, b, out, caption = '' }) {
  const lim = limits()
  for (const [k, v] of [['a', a], ['b', b]]) {
    if (!v || !v.file || !v.globe || !(v.globe.r > 0)) throw new Error(`composeComparison: ${k} needs a file and a globe circle`)
  }
  const srcA = await loadRgb(a.file)
  const srcB = await loadRgb(b.file)
  const scaledA = scaler(srcA)
  const scaledB = scaler(srcB)

  let panelW = Math.floor((lim.longEdge - PANEL_GAP) / 2)
  const aspect = (FRAME.up + FRAME.down) / (FRAME.left + FRAME.right)
  while (panelW > 1 && !fits(2 * panelW + PANEL_GAP, STRIP + Math.round(panelW * aspect), lim)) panelW--
  const panelH = Math.round(panelW * aspect)
  const sheetW = 2 * panelW + PANEL_GAP
  const sheetH = STRIP + panelH
  assertFits(sheetW, sheetH, lim, 'the comparison sheet')

  const frameA = frameRect(a.globe)
  const frameB = frameRect(b.globe)
  const panelA = await cut(scaledA, frameA, panelW, panelH)
  const panelB = await cut(scaledB, frameB, panelW, panelH)
  const main = canvas(sheetW, sheetH)
  paste(main, panelA.img, 0, STRIP)
  paste(main, panelB.img, panelW + PANEL_GAP, STRIP)
  drawMark(main, 'a', panelW / 2, STRIP / 2)
  drawMark(main, 'b', panelW + PANEL_GAP + panelW / 2, STRIP / 2)
  await save(main, out)

  const files = [out]
  const widths = [sheetW]
  const heights = [sheetH]

  const cropW = Math.floor((lim.longEdge - PANEL_GAP) / 2)
  const rowW = 2 * cropW + PANEL_GAP
  const perFile = rowsPerFile(rowW, CROP_HEIGHT, PANEL_GAP, lim)
  if (perFile < 1) throw new Error(`a crop row of ${rowW} x ${CROP_HEIGHT} does not fit the limits`)
  const ratio = a.globe.r / b.globe.r
  const ext = path.extname(out)
  const stem = out.slice(0, out.length - ext.length)
  const cropRecords = []
  for (let first = 0, n = 1; first < CROPS.length; first += perFile, n++) {
    const group = CROPS.slice(first, first + perFile)
    const h = group.length * CROP_HEIGHT + (group.length - 1) * PANEL_GAP
    assertFits(rowW, h, lim, 'a crop sheet')
    const sheet = canvas(rowW, h)
    const file = `${stem}-crops-${n}${ext}`
    for (let i = 0; i < group.length; i++) {
      const c = group[i]
      const top = i * (CROP_HEIGHT + PANEL_GAP)
      const rectB = { x: b.globe.cx + c.x * b.globe.r - cropW / 2, y: b.globe.cy + c.y * b.globe.r - CROP_HEIGHT / 2, w: cropW, h: CROP_HEIGHT }
      const rectA = { x: a.globe.cx + c.x * a.globe.r - (cropW * ratio) / 2, y: a.globe.cy + c.y * a.globe.r - (CROP_HEIGHT * ratio) / 2, w: cropW * ratio, h: CROP_HEIGHT * ratio }
      const tileA = await cut(scaledA, rectA, cropW, CROP_HEIGHT)
      const tileB = await cut(scaledB, rectB, cropW, CROP_HEIGHT)
      paste(sheet, tileA.img, 0, top)
      paste(sheet, tileB.img, cropW + PANEL_GAP, top)
      cropRecords.push({
        name: c.name,
        centreInRadii: { x: c.x, y: c.y },
        file: shown(file),
        a: { source: roundRect(rectA), at: { left: 0, top, width: cropW, height: CROP_HEIGHT }, filled: tileA.filled },
        b: { source: roundRect(rectB), at: { left: cropW + PANEL_GAP, top, width: cropW, height: CROP_HEIGHT }, filled: tileB.filled },
      })
    }
    await save(sheet, file)
    files.push(file)
    widths.push(rowW)
    heights.push(h)
  }

  const side = (v, src, frame, panel) => ({
    file: shown(v.file),
    sha256: fileSha(v.file),
    width: src.width,
    height: src.height,
    globe: v.globe,
    base: v.base ?? null,
    frame: roundRect(frame),
    edgeFilled: panel.filled,
  })
  writeJson(`${stem}.json`, {
    caption,
    a: side(a, srcA, frameA, panelA),
    b: side(b, srcB, frameB, panelB),
    limits: { longEdge: lim.longEdge, maxPixels: lim.maxPixels },
    frameInRadii: FRAME,
    panels: {
      file: shown(out),
      stripHeight: STRIP,
      globeRadiusPx: round2(panelW / (FRAME.left + FRAME.right)),
      a: { left: 0, top: STRIP, width: panelW, height: panelH },
      b: { left: panelW + PANEL_GAP, top: STRIP, width: panelW, height: panelH },
    },
    cropScale: { a: round2(1 / ratio), b: 1 },
    crops: cropRecords,
    files: files.map((f, i) => ({ file: shown(f), width: widths[i], height: heights[i] })),
  })
  return { files, widths, heights }
}

function clampSpan(centre, size, limit) {
  const len = Math.max(1, Math.min(Math.round(size), limit))
  const start = Math.min(Math.max(Math.round(centre - len / 2), 0), limit - len)
  return [start, len]
}

export async function composeCrops({ file, regions, outPrefix, cols = 2 }) {
  const lim = limits()
  if (!Array.isArray(regions) || regions.length === 0) throw new Error('composeCrops: no regions')
  const perRow = Math.max(1, Math.floor(cols))
  const src = await loadRgb(file)
  const tiles = []
  for (const r of regions) {
    const [left, width] = clampSpan(r.cx, r.w, src.width)
    const [top, height] = clampSpan(r.cy, r.h, src.height)
    assertFits(width, height, lim, `the region ${r.name}`)
    const img = await toRgb(fromRgb(src).extract({ left, top, width, height }))
    tiles.push({ name: r.name, asked: { cx: r.cx, cy: r.cy, w: r.w, h: r.h }, source: { left, top, width, height }, img })
  }

  const rows = []
  let row = null
  for (const t of tiles) {
    const w = row ? row.width + GRID_GAP + t.source.width : t.source.width
    const h = row ? Math.max(row.height, t.source.height) : t.source.height
    if (row && row.tiles.length < perRow && fits(w, h, lim)) {
      row.tiles.push(t)
      row.width = w
      row.height = h
    } else {
      row = { tiles: [t], width: t.source.width, height: t.source.height }
      rows.push(row)
    }
  }

  const sheets = []
  let sheet = null
  for (const r of rows) {
    const w = sheet ? Math.max(sheet.width, r.width) : r.width
    const h = sheet ? sheet.height + GRID_GAP + r.height : r.height
    if (sheet && fits(w, h, lim)) {
      sheet.rows.push(r)
      sheet.width = w
      sheet.height = h
    } else {
      sheet = { rows: [r], width: r.width, height: r.height }
      sheets.push(sheet)
    }
  }

  const files = []
  const record = { file: shown(file), sha256: fileSha(file), width: src.width, height: src.height, cols: perRow, gap: GRID_GAP, limits: { longEdge: lim.longEdge, maxPixels: lim.maxPixels }, sheets: [] }
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i]
    assertFits(s.width, s.height, lim, 'a crop sheet')
    const img = canvas(s.width, s.height)
    const out = `${outPrefix}-${i + 1}.jpg`
    const placed = []
    let top = 0
    for (const r of s.rows) {
      let left = 0
      for (const t of r.tiles) {
        paste(img, t.img, left, top)
        placed.push({ name: t.name, asked: t.asked, source: t.source, at: { left, top, width: t.source.width, height: t.source.height } })
        left += t.source.width + GRID_GAP
      }
      top += r.height + GRID_GAP
    }
    await save(img, out)
    files.push(out)
    record.sheets.push({ file: shown(out), width: s.width, height: s.height, regions: placed })
  }
  writeJson(`${outPrefix}.json`, record)
  return files
}

export async function fitForModel(file, out) {
  const lim = limits()
  const src = await loadRgb(file)
  const scale = Math.min(1, lim.longEdge / Math.max(src.width, src.height), Math.sqrt(lim.maxPixels / (src.width * src.height)))
  let width = Math.max(1, Math.floor(src.width * scale))
  let height = Math.max(1, Math.floor(src.height * scale))
  if (scale === 1) {
    width = src.width
    height = src.height
  }
  assertFits(width, height, lim, 'the fitted picture')
  const img = scale === 1 ? src : await toRgb(fromRgb(src).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }))
  await save(img, out)
  return { width, height }
}

export async function psnr(fileA, fileB) {
  const a = await loadRgb(fileA)
  const b = await loadRgb(fileB)
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`psnr: sizes differ, ${a.width} x ${a.height} and ${b.width} x ${b.height}`)
  }
  let sum = 0
  let maxDiff = 0
  let differingPixels = 0
  for (let i = 0; i < a.data.length; i += 3) {
    const d0 = Math.abs(a.data[i] - b.data[i])
    const d1 = Math.abs(a.data[i + 1] - b.data[i + 1])
    const d2 = Math.abs(a.data[i + 2] - b.data[i + 2])
    if (d0 | d1 | d2) {
      differingPixels++
      sum += d0 * d0 + d1 * d1 + d2 * d2
      maxDiff = Math.max(maxDiff, d0, d1, d2)
    }
  }
  const mse = sum / a.data.length
  return { psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse), mse, maxDiff, differingPixels, width: a.width, height: a.height }
}

export async function sideBySide({ files, out, gap = PANEL_GAP, maxLongEdge }) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('sideBySide: no files')
  const longEdge = maxLongEdge ?? limits().statusLongEdge
  const sources = []
  for (const f of files) sources.push(await loadRgb(f))
  const gaps = gap * (sources.length - 1)
  const widthsAt = (h) => sources.map((s) => Math.max(1, Math.round((s.width * h) / s.height)))
  const total = (h) => widthsAt(h).reduce((x, y) => x + y, 0) + gaps
  let height = Math.min(longEdge, ...sources.map((s) => s.height))
  const aspects = sources.reduce((x, s) => x + s.width / s.height, 0)
  if (total(height) > longEdge) height = Math.max(1, Math.min(height, Math.floor((longEdge - gaps) / aspects)))
  while (height > 1 && total(height) > longEdge) height--
  if (total(height) > longEdge) throw new Error(`sideBySide: ${sources.length} pictures do not fit in ${longEdge} px`)
  const widths = widthsAt(height)
  const sheet = canvas(total(height), height)
  let left = 0
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]
    const img = s.width === widths[i] && s.height === height ? s : await toRgb(fromRgb(s).resize(widths[i], height, { fit: 'fill', kernel: 'lanczos3' }))
    paste(sheet, img, left, 0)
    left += widths[i] + gap
  }
  await save(sheet, out)
  return { width: sheet.width, height: sheet.height }
}
