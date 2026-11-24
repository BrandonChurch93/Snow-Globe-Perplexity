import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { rel, readJson, writeJson, loadConfig, parseArgs } from './lib/paths.mjs'
import { fileSha } from './lib/hashes.mjs'

// The lit cottage, the lamppost and the foot of the tree in winter-rest.png: left, top and width as fractions of the image.
const TIGHT = { x: 0.371, y: 0.356, w: 0.224 }
const GLOBE = { x: 0.5, y: 0.45 }
const HOLD_PUSH = 0.06
const OPEN_DRIFT = 0.035
const CLOSE_PRE_SPEED = 0.02
const LANDED_HOLD_BEATS = 2
const LANDED_DISSOLVE_BEATS = 2
const STROKE_REACH = 0.03
const STROKE_QUICKEN = 0.9
const STREAK_BASE = 0.05
const STREAK_PER_SPEED = 6
const STREAK_MAX = 0.16
const LEVEL_STEP = 1.25
const LEVEL_MIN_RATIO = 1.02
const FONT = 'DejaVu Sans, Liberation Sans, Noto Sans, Helvetica, Arial, sans-serif'
const ENCODERS = { h264: 'libx264' }
// The encoder's output depends on its thread count, so it is pinned.
const ENCODER_THREADS = '2'

const cfg = loadConfig()
const args = parseArgs(process.argv.slice(2))
const { film, shake, formats } = cfg
const OW = formats.preview.width
const OH = formats.preview.height
const FPS = film.previewFps
const ASPECT = OW / OH
const framesPerBeat = (60 / film.defaultBpm) * FPS
const framesPerBar = framesPerBeat * film.beatsPerBar
const approvedDir = rel('references', 'approved')
const workDir = rel('out', 'work', 'animatic')

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v) => {
  const u = clamp01(v)
  return u * u * (3 - 2 * u)
}
const whole = (v, what) => {
  const r = Math.round(v)
  if (Math.abs(v - r) > 1e-6) throw new Error(`${what} is not a whole number of frames: ${v}`)
  return r
}

function layoutShots() {
  let bars = 0
  const shots = film.shots.map((s, index) => {
    const first = whole(bars * framesPerBar, `the start of ${s.id}`)
    const firstBar = bars
    bars += s.bars
    const end = whole(bars * framesPerBar, `the end of ${s.id}`)
    return { ...s, index, first, end, last: end - 1, firstBar }
  })
  for (const s of shots) {
    if (s.kind === 'hold') continue
    const before = shots[s.index - 1]
    const after = shots[s.index + 1]
    if (s.kind !== 'shake' || s.bars !== 1) throw new Error(`${s.id}: a shake is exactly one bar`)
    if (!before || !after || before.kind !== 'hold' || after.kind !== 'hold') throw new Error(`${s.id}: a shake sits between two holds`)
    if (before.season !== s.from || after.season !== s.to) throw new Error(`${s.id}: its seasons do not match the holds around it`)
    if (shake.liftBeats + shake.strokeBeats + shake.setDownBeats !== film.beatsPerBar) throw new Error('the shake does not fill one bar')
    s.swapFrom = s.first + shake.swapWindow.fromBeat * framesPerBeat
    s.swapTo = s.first + shake.swapWindow.toBeat * framesPerBeat
  }
  return { shots, total: whole(bars * framesPerBar, 'the film') }
}

const { shots, total } = layoutShots()
const lastShot = shots[shots.length - 1]

function strokeTable() {
  const n = shake.strokes
  const times = [shake.liftBeats]
  const ends = []
  let sum = 0
  for (let i = 0; i < n; i++) sum += STROKE_QUICKEN ** i
  for (let i = 0; i < n; i++) times.push(times[i] + (shake.strokeBeats * STROKE_QUICKEN ** i) / sum)
  times[n] = shake.liftBeats + shake.strokeBeats
  for (let i = 0; i <= n; i++) ends.push((i % 2 ? 1 : -1) * STROKE_REACH * (0.82 + (0.36 * ((i * 5) % 7)) / 6))
  return { times, ends }
}
const strokes = strokeTable()

function sway(beat) {
  const { times, ends } = strokes
  const n = shake.strokes
  if (beat <= 0) return 0
  if (beat < times[0]) return ends[0] * smooth(beat / times[0])
  if (beat < times[n]) {
    let i = 0
    while (beat >= times[i + 1]) i++
    const u = (beat - times[i]) / (times[i + 1] - times[i])
    return ends[i] + (ends[i + 1] - ends[i]) * (0.75 * u + 0.25 * smooth(u))
  }
  const u = clamp01((beat - times[n]) / shake.setDownBeats)
  return ends[n] * (1 - u) ** 3
}

function streak(beat) {
  const half = 0.5 / framesPerBeat
  const speed = Math.abs(sway(beat + half) - sway(beat - half))
  const strokesEnd = shake.liftBeats + shake.strokeBeats
  let env = 1
  if (beat < shake.liftBeats) env = (beat / shake.liftBeats) ** 2
  else if (beat > strokesEnd) env = (1 - clamp01((beat - strokesEnd) / shake.setDownBeats)) ** 2
  return Math.min(STREAK_MAX, env * STREAK_BASE + STREAK_PER_SPEED * speed)
}

function buildVisits(geo) {
  const tightW = (TIGHT.w * geo.iw) / geo.fw
  const tightCx = TIGHT.x + TIGHT.w / 2
  const tightCy = TIGHT.y + (TIGHT.w * geo.iw) / ASPECT / geo.ih / 2
  const tightPoint = { x: (tightCx - 0.5 * tightW) / (1 - tightW), y: (tightCy - 0.5 * tightW) / (1 - tightW) }
  const tightZoom = Math.log(1 / tightW)
  const at = (point, logZoom) => {
    const w = Math.exp(-logZoom)
    return { cx: point.x + (0.5 - point.x) * w, cy: point.y + (0.5 - point.y) * w, w }
  }
  const visits = new Map()
  for (const s of shots) {
    if (s.kind !== 'hold') continue
    const before = shots[s.index - 1]
    const after = shots[s.index + 1]
    const a = before ? before.swapFrom : s.first
    const b = after ? after.swapTo : s.end
    let cam
    if (s.index === 0) {
      const wide = s.first + Math.min(2, s.bars) * framesPerBar
      const ramp = 0.35
      cam = (f) => {
        if (f < wide) return at(tightPoint, tightZoom * (1 - (f - s.first) / (wide - s.first)) ** 2)
        const v = clamp01((f - wide) / Math.max(1, b - wide))
        const d = (v < ramp ? (v * v) / (2 * ramp) : v - ramp / 2) / (1 - ramp / 2)
        return at(GLOBE, Math.log(1 + OPEN_DRIFT) * d)
      }
    } else if (s === lastShot) {
      if (s.bars < 3) throw new Error(`${s.id}: the last shot needs three bars or more`)
      const p0 = s.first + framesPerBar
      const p1 = s.end - framesPerBar
      const ramp = Math.min(framesPerBar, (p1 - p0) / 2)
      const speed = (f) => {
        if (f < p0) return CLOSE_PRE_SPEED
        if (f >= p1) return 0
        return Math.min(CLOSE_PRE_SPEED + (1 - CLOSE_PRE_SPEED) * smooth((f - p0) / ramp), smooth((p1 - f) / ramp))
      }
      const start = Math.floor(a)
      const run = [0]
      for (let f = start; f < p1; f++) run.push(run[run.length - 1] + speed(f + 0.5))
      const sum = run[run.length - 1]
      cam = (f) => at(tightPoint, f >= p1 ? tightZoom : (tightZoom * run[Math.max(0, f - start)]) / sum)
    } else {
      cam = (f) => {
        const u = clamp01((f - a) / (b - a))
        return at(GLOBE, Math.log(1 + HOLD_PUSH) * (0.6 * u + 0.4 * smooth(u)))
      }
    }
    visits.set(s.index, cam)
  }
  return visits
}

function planFrame(f, visits) {
  const s = shots.find((x) => f >= x.first && f < x.end)
  const bar = Math.floor((f + 1e-6) / framesPerBar) + 1
  const plan = { shot: s, label: `${s.id} \u00b7 bar ${bar}`, layers: [], shift: 0, streak: 0 }
  if (s.kind === 'hold') {
    const cam = visits.get(s.index)(f)
    const before = shots[s.index - 1]
    const beat = (f - s.first) / framesPerBeat
    const m = before ? smooth((beat - LANDED_HOLD_BEATS) / LANDED_DISSOLVE_BEATS) : 1
    if (m < 1) plan.layers.push({ image: `${s.season}-shake`, cam, weight: 1 - m })
    if (m > 0) plan.layers.push({ image: `${s.season}-rest`, cam, weight: m })
    return plan
  }
  const beat = (f - s.first) / framesPerBeat
  const m = smooth((f - s.swapFrom) / (s.swapTo - s.swapFrom))
  if (m < 1) plan.layers.push({ image: `${s.from}-rest`, cam: visits.get(s.index - 1)(f), weight: 1 - m })
  if (m > 0) plan.layers.push({ image: `${s.to}-shake`, cam: visits.get(s.index + 1)(f), weight: m })
  plan.shift = sway(beat)
  plan.streak = streak(beat)
  return plan
}

const levelOf = (cam) => {
  let j = 0
  while (cam.w * LEVEL_STEP ** j < LEVEL_MIN_RATIO) j++
  return j
}

async function loadLevels(needed, geo) {
  const levels = new Map()
  await Promise.all(
    [...needed].map(async (key) => {
      const [image, j] = key.split('@')
      const k = Math.min(1, (OW * LEVEL_STEP ** Number(j)) / geo.fw)
      const width = Math.round(geo.iw * k)
      const height = Math.round(geo.ih * k)
      const data = await sharp(path.join(approvedDir, `${image}.png`))
        .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer()
      levels.set(key, { data, width, height, k })
    })
  )
  return levels
}

const cubic = (x) => {
  const a = Math.abs(x)
  if (a < 1) return 1.5 * a * a * a - 2.5 * a * a + 1
  if (a < 2) return -0.5 * a * a * a + 2.5 * a * a - 4 * a + 2
  return 0
}

function taps(n, start, size, limit) {
  const scale = Math.max(1, size / n)
  const support = 2 * scale
  const count = Math.ceil(support * 2) + 1
  const idx = new Int32Array(n * count)
  const wt = new Float32Array(n * count)
  for (let j = 0; j < n; j++) {
    const c = start + ((j + 0.5) * size) / n - 0.5
    const first = Math.ceil(c - support)
    let sum = 0
    for (let t = 0; t < count; t++) {
      const i = first + t
      const w = cubic((i - c) / scale)
      idx[j * count + t] = i < 0 ? 0 : i >= limit ? limit - 1 : i
      wt[j * count + t] = w
      sum += w
    }
    for (let t = 0; t < count; t++) wt[j * count + t] /= sum
  }
  return { idx, wt, count }
}

let scratch = new Float32Array(0)

function drawLayer(level, geo, cam, shift, weight, out) {
  const { data, width, height } = level
  const rw = (cam.w * geo.fw * width) / geo.iw
  const rh = rw / ASPECT
  const x0 = cam.cx * width - rw / 2 - shift * rw
  const y0 = cam.cy * height - rh / 2
  const tx = taps(OW, x0, rw, width)
  const ty = taps(OH, y0, rh, height)
  let rowMin = height
  let rowMax = 0
  for (let i = 0; i < ty.idx.length; i++) {
    if (ty.idx[i] < rowMin) rowMin = ty.idx[i]
    if (ty.idx[i] > rowMax) rowMax = ty.idx[i]
  }
  const rows = rowMax - rowMin + 1
  const stride = OW * 3
  if (scratch.length < rows * stride) scratch = new Float32Array(rows * stride)
  const nx = tx.count
  for (let r = 0; r < rows; r++) {
    const src = (rowMin + r) * width * 3
    let o = r * stride
    for (let j = 0; j < OW; j++) {
      let cr = 0
      let cg = 0
      let cb = 0
      const base = j * nx
      for (let t = 0; t < nx; t++) {
        const w = tx.wt[base + t]
        const p = src + tx.idx[base + t] * 3
        cr += w * data[p]
        cg += w * data[p + 1]
        cb += w * data[p + 2]
      }
      scratch[o++] = cr
      scratch[o++] = cg
      scratch[o++] = cb
    }
  }
  const ny = ty.count
  for (let y = 0; y < OH; y++) {
    const o = y * stride
    for (let t = 0; t < ny; t++) {
      const w = ty.wt[y * ny + t] * weight
      if (w === 0) continue
      const p = (ty.idx[y * ny + t] - rowMin) * stride
      for (let i = 0; i < stride; i++) out[o + i] += w * scratch[p + i]
    }
  }
}

const sums = new Float64Array((OW + 1) * 3)

function streakRows(buf, widthPx) {
  const r = widthPx / 2
  const stride = OW * 3
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] < 0 ? 0 : buf[i]
    buf[i] = v * v
  }
  for (let y = 0; y < OH; y++) {
    const o = y * stride
    for (let c = 0; c < 3; c++) {
      let run = 0
      sums[c] = 0
      for (let x = 0; x < OW; x++) {
        run += buf[o + x * 3 + c]
        sums[(x + 1) * 3 + c] = run
      }
      const firstV = buf[o + c]
      const lastV = buf[o + (OW - 1) * 3 + c]
      const total = run
      const integral = (x) => {
        if (x <= 0) return x * firstV
        if (x >= OW) return total + (x - OW) * lastV
        const i = Math.floor(x)
        return sums[i * 3 + c] + (x - i) * (sums[(i + 1) * 3 + c] - sums[i * 3 + c])
      }
      let lo = integral(0.5 - r)
      for (let x = 0; x < OW; x++) {
        const hi = integral(x + 0.5 + r)
        const next = integral(x + 1.5 - r)
        streakOut[x] = (hi - lo) / widthPx
        lo = next
      }
      for (let x = 0; x < OW; x++) buf[o + x * 3 + c] = Math.sqrt(streakOut[x])
    }
  }
}
const streakOut = new Float64Array(OW)

function xml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function textMask(text, size) {
  const w = Math.ceil(size * (text.length * 0.9 + 2))
  const h = Math.ceil(size * 2.2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="${size}" y="${Math.round(size * 1.5)}" font-family="${FONT}" font-size="${size}" fill="#fff">${xml(text)}</text></svg>`
  const alpha = await sharp(Buffer.from(svg)).extractChannel(3).raw().toBuffer()
  let left = w
  let right = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x] > 8) {
        if (x < left) left = x
        if (x > right) right = x
      }
  if (right < 0) throw new Error('no font could draw the label')
  return { alpha, w, h, left, right, baseline: Math.round(size * 1.5) }
}

async function makeLabel(text) {
  const size = Math.max(11, Math.round(OH * 0.024))
  const mask = await textMask(text, size)
  const padX = Math.round(size * 0.7)
  const height = Math.round(size * 1.9)
  const width = mask.right - mask.left + 1 + padX * 2
  const radius = height * 0.32
  const top = mask.baseline - Math.round(size * 1.28)
  const rgba = new Float32Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = Math.max(Math.abs(x + 0.5 - width / 2) - (width / 2 - radius), 0)
      const dy = Math.max(Math.abs(y + 0.5 - height / 2) - (height / 2 - radius), 0)
      const plate = 0.46 * clamp01(radius - Math.hypot(dx, dy) + 0.5)
      const sx = x - padX + mask.left
      const sy = y + top
      const ink = sy >= 0 && sy < mask.h ? (0.88 * mask.alpha[sy * mask.w + sx]) / 255 : 0
      const a = ink + plate * (1 - ink)
      const o = (y * width + x) * 4
      rgba[o] = a > 0 ? (ink * 232 + plate * (1 - ink) * 10) / a : 0
      rgba[o + 1] = a > 0 ? (ink * 235 + plate * (1 - ink) * 12) / a : 0
      rgba[o + 2] = a > 0 ? (ink * 240 + plate * (1 - ink) * 17) / a : 0
      rgba[o + 3] = a
    }
  const margin = Math.round(OH * 0.035)
  return { rgba, width, height, x: margin, y: OH - margin - height }
}

function stamp(frame, label) {
  for (let y = 0; y < label.height; y++)
    for (let x = 0; x < label.width; x++) {
      const s = (y * label.width + x) * 4
      const a = label.rgba[s + 3]
      if (a === 0) continue
      const o = ((label.y + y) * OW + label.x + x) * 3
      frame[o] = frame[o] * (1 - a) + label.rgba[s] * a
      frame[o + 1] = frame[o + 1] * (1 - a) + label.rgba[s + 1] * a
      frame[o + 2] = frame[o + 2] * (1 - a) + label.rgba[s + 2] * a
    }
}

async function makeRenderer() {
  const meta = await sharp(path.join(approvedDir, `${cfg.defaultSeason}-rest.png`)).metadata()
  const geo = { iw: meta.width, ih: meta.height, fw: Math.min(meta.width, meta.height * ASPECT) }
  const visits = buildVisits(geo)
  const plans = []
  const needed = new Set()
  const labelTexts = new Set()
  for (let f = 0; f < total; f++) {
    const plan = planFrame(f, visits)
    for (const l of plan.layers) {
      l.key = `${l.image}@${levelOf(l.cam)}`
      needed.add(l.key)
    }
    plan.key = JSON.stringify([plan.layers.map((l) => [l.key, l.cam.cx, l.cam.cy, l.cam.w, l.weight]), plan.shift, plan.streak])
    labelTexts.add(plan.label)
    plans.push(plan)
  }
  const images = [...new Set([...needed].map((k) => k.split('@')[0]))].sort()
  const manifestFile = path.join(approvedDir, 'MANIFEST.sha256')
  const manifest = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : ''
  const hashes = {}
  for (const image of images) {
    const file = path.join(approvedDir, `${image}.png`)
    const m = await sharp(file).metadata()
    if (m.width !== geo.iw || m.height !== geo.ih) throw new Error(`${image}.png is not ${geo.iw} x ${geo.ih}`)
    hashes[`references/approved/${image}.png`] = fileSha(file)
    const pinned = manifest.split('\n').find((line) => line.trim().endsWith(` ${image}.png`))
    if (pinned && pinned.trim().split(/\s+/)[0] !== hashes[`references/approved/${image}.png`]) throw new Error(`${image}.png does not match MANIFEST.sha256`)
  }
  const levels = await loadLevels(needed, geo)
  const labels = new Map()
  for (const text of labelTexts) labels.set(text, await makeLabel(text))
  const picture = new Float32Array(OW * OH * 3)
  let pictureKey = ''
  const render = (f) => {
    const plan = plans[f]
    if (plan.key !== pictureKey) {
      picture.fill(0)
      for (const l of plan.layers) drawLayer(levels.get(l.key), geo, l.cam, plan.shift, l.weight, picture)
      const widthPx = plan.streak * OW
      if (widthPx > 1) streakRows(picture, widthPx)
      pictureKey = plan.key
    }
    const frame = new Uint8ClampedArray(picture)
    stamp(frame, labels.get(plan.label))
    return Buffer.from(frame.buffer)
  }
  return { render, hashes }
}

const frameName = (f) => `frame-${String(f).padStart(String(total).length, '0')}.png`

async function writeSheet(render) {
  const longEdge = cfg.critics.maxImageLongEdgePx
  const cols = Math.ceil(Math.sqrt(shots.length))
  const rowsCount = Math.ceil(shots.length / cols)
  const gap = Math.round(longEdge * 0.012)
  const caption = Math.round(longEdge * 0.024)
  let cellW = Math.floor((longEdge - gap * (cols + 1)) / cols)
  let cellH = Math.round(cellW / ASPECT)
  const tall = gap + rowsCount * (cellH + caption + gap)
  if (tall > longEdge) {
    cellH = Math.floor((longEdge - gap) / rowsCount - caption - gap)
    cellW = Math.round(cellH * ASPECT)
  }
  const width = gap + cols * (cellW + gap)
  const height = gap + rowsCount * (cellH + caption + gap)
  const size = Math.round(caption * 0.56)
  const parts = []
  let text = ''
  for (const s of shots) {
    const x = gap + (s.index % cols) * (cellW + gap)
    const y = gap + Math.floor(s.index / cols) * (cellH + caption + gap)
    const f = s.first + Math.floor((s.end - s.first) / 2)
    const input = await sharp(render(f), { raw: { width: OW, height: OH, channels: 3 } }).resize(cellW, cellH).png().toBuffer()
    parts.push({ input, left: x, top: y })
    text += `<text x="${x}" y="${y + cellH + Math.round(caption * 0.72)}" font-family="${FONT}" font-size="${size}" fill="#c9ced6">${xml(s.id)}</text>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#14161b"/>${text}</svg>`
  const file = path.join(workDir, 'sheet.jpg')
  await sharp(Buffer.from(svg)).composite(parts).flatten({ background: '#14161b' }).jpeg({ quality: 88 }).toFile(file)
  console.log(`sheet ${path.relative(rel(), file)} ${width} x ${height}`)
}

async function encode(render, file) {
  const encoder = ENCODERS[cfg.export.videoCodec]
  if (!encoder) throw new Error(`no encoder for ${cfg.export.videoCodec}`)
  const kbps = Math.round(cfg.previewFilm.bitrateMbps * 1000)
  const gop = String(Math.max(...shots.map((s) => s.end - s.first)))
  const keys = 'expr:' + shots.map((s) => `eq(n,${s.first})`).join('+')
  const ff = spawn(
    'ffmpeg',
    [
      '-v', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${OW}x${OH}`, '-r', String(FPS), '-i', 'pipe:0',
      '-an', '-map_metadata', '-1',
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
      '-c:v', encoder, '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-threads', ENCODER_THREADS, '-g', gop, '-sc_threshold', '0', '-force_key_frames', keys, '-x264-params', 'ipratio=1.0:pbratio=1.0',
      '-b:v', `${kbps}k`, '-maxrate', `${kbps * 2}k`, '-bufsize', `${kbps * 2}k`,
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-fflags', '+bitexact', '-flags:v', '+bitexact',
      '-movflags', '+faststart', '-f', cfg.export.container, file
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  )
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ended with code ${code}`))))
  })
  ff.stdin.on('error', () => {})
  for (let f = 0; f < total; f++) {
    if (!ff.stdin.write(render(f))) await new Promise((resolve) => ff.stdin.once('drain', resolve))
  }
  ff.stdin.end()
  await done
}

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate,nb_read_frames', '-of', 'json', file], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr}`)
  const streams = JSON.parse(r.stdout).streams
  const v = streams.find((s) => s.codec_type === 'video')
  const [num, den] = v.r_frame_rate.split('/').map(Number)
  return { streams: streams.length, codec: v.codec_name, pixFmt: v.pix_fmt, width: v.width, height: v.height, fps: num / (den || 1), frames: Number(v.nb_read_frames) }
}

async function main() {
  fs.mkdirSync(workDir, { recursive: true })
  const { render, hashes } = await makeRenderer()
  if (args['frames-only'] !== undefined) {
    const list = String(args['frames-only']).split(',').map((v) => Number(v.trim()))
    for (const f of list) {
      if (!Number.isInteger(f) || f < 0 || f >= total) throw new Error(`no frame ${f}: the film has frames 0 to ${total - 1}`)
      const file = path.join(workDir, frameName(f))
      await sharp(render(f), { raw: { width: OW, height: OH, channels: 3 } }).png().toFile(file)
      console.log(`frame ${f} ${path.relative(rel(), file)}`)
    }
    if (args.sheet) await writeSheet(render)
    return
  }
  const ext = cfg.export.container
  const temp = path.join(workDir, `roughcut.part.${ext}`)
  const file = rel('out', `roughcut.${ext}`)
  await encode(render, temp)
  fs.renameSync(temp, file)
  writeJson(rel('out', 'roughcut.json'), {
    file: `out/roughcut.${ext}`,
    frames: total,
    fps: FPS,
    width: OW,
    height: OH,
    seconds: total / FPS,
    bpm: film.defaultBpm,
    beatsPerBar: film.beatsPerBar,
    shots: shots.map((s) => ({ id: s.id, kind: s.kind, bars: s.bars, firstBar: s.firstBar + 1, firstFrame: s.first, lastFrame: s.last })),
    images: hashes
  })
  if (args.sheet) await writeSheet(render)
  const seen = probe(file)
  const mb = fs.statSync(file).size / 1e6
  console.log(`frames ${total}`)
  console.log(`length ${(total / FPS).toFixed(2)} s`)
  console.log(`file ${mb.toFixed(1)} MB`)
  console.log(`ffprobe ${seen.width} x ${seen.height}, ${seen.fps} fps, ${seen.frames} frames, ${seen.codec} ${seen.pixFmt}, ${seen.streams} stream`)
  const faults = []
  if (seen.width !== OW || seen.height !== OH) faults.push(`size is not ${OW} x ${OH}`)
  if (Math.abs(seen.fps - FPS) > 1e-9) faults.push(`frame rate is not ${FPS}`)
  if (seen.frames !== total) faults.push(`frame count is not ${total}`)
  if (seen.streams !== 1) faults.push('there is more than the one picture stream')
  if (mb >= cfg.repo.maxFileMb) faults.push(`file is not under ${cfg.repo.maxFileMb} MB`)
  if (faults.length) {
    for (const fault of faults) console.error(`fault: ${fault}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
