import path from 'node:path'
import sharp from 'sharp'
import { rel, readJson } from './paths.mjs'
import { cfg, stillSpec, stillName, recordMatches, writeWithRecord } from './page.mjs'

export const METHOD = 3
const HIGH_PASS_SIGMA_PX = 1.5
const MIN_MASK_SHARE = 0.02
const ENCODING_TOLERANCE = 0.005
const COLOUR_TOLERANCE = 2
const ON = 128
const SEASON_UNITS = new Set(cfg.seasons)

export const MEASURES = {
  M1: { name: 'Sanity', units: () => true, key: '' },
  M2: { name: 'Texture detail', units: (u) => SEASON_UNITS.has(u), key: 'detail.maxSoftPixelFraction' },
  M3: { name: 'Real sharpness', units: (u) => SEASON_UNITS.has(u), key: 'detail.minSharpnessRatio' },
  M4: { name: 'Cover at the swap', units: (u) => u === cfg.lookLockUnit || u === 'change' || u === 'film', key: 'shake.minCoverAtSwap' },
  M5: { name: 'Clearing', units: (u) => u === cfg.lookLockUnit || u === 'change' || u === 'film', key: 'shake.minVisibleAfterSettle' },
  M6: { name: 'Nothing inside', units: (u) => SEASON_UNITS.has(u) || u === 'change', key: 'sim.maxInsideFraction' },
}

export const measuresFor = (unit) => Object.keys(MEASURES).filter((m) => MEASURES[m].units(unit))

export function shakesFor(unit, film) {
  if (unit === cfg.lookLockUnit) return ['test']
  if (unit === 'change' || unit === 'film') return film.swaps.map((s) => s.shot)
  return []
}

export const seasonsOf = (entry) => (entry.season && (entry.kind === 'key' || entry.kind === 'still' || entry.kind === 'live' || entry.kind === 'view') ? [entry.season] : [...cfg.seasons])

export function specOf(entry, tier, diag = '') {
  if (entry.kind === 'key' || entry.kind === 'still') return stillSpec({ id: entry.id, tier, diag: diag || undefined })
  if (entry.kind === 'view') return { ...stillSpec({ season: entry.season, state: entry.state, camera: entry.camera, tier, format: entry.format, diag: diag || undefined }), id: entry.id }
  if (entry.kind === 'live') return { ...stillSpec({ season: entry.season, state: entry.state, camera: entry.camera, tier, format: entry.format, diag: diag || undefined, live: entry.level }), id: entry.id }
  const spec = { id: entry.id, kind: entry.kind, tier, format: entry.format, assets: 'full', diag }
  for (const k of ['shot', 'at', 'frame', 'camera']) if (entry[k] !== undefined) spec[k] = entry[k]
  return spec
}

export function judgedFile(entry, tier, diag = '') {
  const spec = specOf(entry, tier, diag)
  if (entry.kind === 'key' || entry.kind === 'still') return rel('out', 'work', 'stills', stillName(spec, spec.interface ? 'stage' : ''))
  return rel('out', 'work', 'stills', [entry.id, spec.format, tier, diag].filter(Boolean).join('-') + '.png')
}

export const momentEntry = (shot, at) => ({ id: `moment-${shot}-${at}`, kind: 'moment', format: cfg.formats.hd.id, camera: 'hero', shot, at })

export class Pages {
  constructor(session) {
    this.session = session
    this.byFormat = new Map()
  }

  async get(format) {
    if (!this.byFormat.has(format)) this.byFormat.set(format, await this.session.page({ format }))
    return this.byFormat.get(format)
  }

  async first() {
    return this.get(cfg.formats.hd.id)
  }
}

// Which camera's numbers a judged still is measured with. A screen still (drawn with the controls, or the live app's view)
// is drawn from the app's own framing, which is not the film's camera of the same name: `stillFraming()` gives the numbers
// of the camera that drew the last still. Every other still is drawn from the named camera itself.
export function framingSource(entry) {
  if (entry.interface || entry.kind === 'live') return 'still'
  return entry.camera ? 'camera' : 'none'
}

export async function drawJudged(session, pages, entry, { tier, diag = '', force = false } = {}) {
  const spec = specOf(entry, tier, diag)
  const file = judgedFile(entry, tier, diag)
  const want = { seasons: seasonsOf(entry), format: spec.format, tier, assets: spec.assets, diagnostic: diag, spec }
  if (!force && recordMatches(file, want)) {
    const record = readJson(`${file}.json`)
    // a screen still measured before its framing was read from the camera that drew it is drawn again
    if (record.measured && record.method === METHOD && (framingSource(entry) !== 'still' || record.framingFrom === 'still')) return { file, reused: true, record }
  }
  const page = await pages.get(spec.format)
  const t0 = Date.now()
  const got = await page.evaluate(
    async ([e, t, d, season, from]) => {
      const sc = window.showcase
      await sc.setFormat(e.format)
      sc.setDiagnostic(d || 'none')
      const before = sc.dev.timings()
      if (e.kind === 'key' || e.kind === 'still' || e.kind === 'live' || e.kind === 'view') {
        const call = { season: e.season, state: e.state, camera: e.camera, tier: t }
        if (e.interface) call.interface = true
        if (e.kind === 'live') call.live = e.level
        await sc.renderStill(call)
      } else if (e.kind === 'change') await sc.renderStill({ season, state: 'rest', camera: 'hero', tier: t, change: { shot: e.shot, at: e.at } })
      else if (e.kind === 'film') await sc.renderFilmFrame(e.frame, t)
      else if (e.kind === 'opening') await sc.renderOpeningFrame(e.frame)
      else if (e.kind === 'loop') await sc.renderLoopFrame(e.frame, t)
      else if (e.kind === 'moment') await sc.dev.renderShakeMoment(e.shot, e.at, t)
      else throw new Error(`no way to draw the kind ${e.kind}`)
      const after = sc.dev.timings()
      const state = e.kind === 'film' ? sc.filmState(e.frame) : e.kind === 'loop' ? sc.dev.loopState(e.frame) : null
      return {
        info: sc.info(),
        sanity: sc.dev.sanity(),
        inside: sc.dev.inside(),
        framing: from === 'still' ? sc.dev.stillFraming() : from === 'camera' ? sc.dev.framing(e.camera) : null,
        state,
        timings: { simMs: after.simMs - before.simMs, drawMs: after.drawMs - before.drawMs, samples: after.samples - before.samples, steps: after.steps - before.steps },
      }
    },
    [entry, tier, diag, cfg.defaultSeason, framingSource(entry)],
  )
  const png = entry.interface ? await session.grabStage(page) : await session.grab(page)
  const record = session.record(got.info, {
    diag,
    spec,
    noext: [],
    method: METHOD,
    seconds: (Date.now() - t0) / 1000,
    timings: got.timings,
    measured: { sanity: got.sanity, inside: got.inside },
    framing: got.framing,
    framingFrom: framingSource(entry),
    state: got.state,
    standIns: got.info.standIns.length,
    counts: got.info.counts,
    errors: page.errors.slice(0, 20),
  })
  record.tier = tier
  writeWithRecord(file, png, record)
  return { file, reused: false, record }
}

export async function rgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

export function partMask(img, parts, test) {
  const wanted = parts.filter((p) => test(p.name)).map((p) => [(p.color >> 16) & 255, (p.color >> 8) & 255, p.color & 255])
  const mask = new Uint8Array(img.width * img.height)
  let count = 0
  if (!wanted.length) return { mask, count, parts: 0 }
  for (let i = 0, o = 0; i < mask.length; i++, o += 4) {
    for (const c of wanted) {
      if (Math.abs(img.data[o] - c[0]) <= COLOUR_TOLERANCE && Math.abs(img.data[o + 1] - c[1]) <= COLOUR_TOLERANCE && Math.abs(img.data[o + 2] - c[2]) <= COLOUR_TOLERANCE) {
        mask[i] = 1
        count++
        break
      }
    }
  }
  return { mask, count, parts: wanted.length }
}

function touchesEdge(mask, width, height) {
  for (let x = 0; x < width; x++) if (mask[x] || mask[(height - 1) * width + x]) return true
  for (let y = 0; y < height; y++) if (mask[y * width] || mask[y * width + width - 1]) return true
  return false
}

const line = (measure, still, pass, value, threshold, detail, extra = {}) => ({ measure, still, pass, value, threshold, key: MEASURES[measure].key, detail, ...extra })
const pct = (v) => `${(v * 100).toFixed(2)} %`
const round = (v, n = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** n) / 10 ** n : v)

export function m1(entry, record, size, miniature) {
  const invalid = record.measured.sanity.invalid
  const f = record.framing
  let framed = true
  let about = 'no framing rule for this camera'
  if (entry.camera === 'hero' && f && entry.kind !== 'film') {
    const g = f.globe
    framed = g.cx - g.r >= 0 && g.cx + g.r <= size.width && g.cy - g.r >= 0 && f.base.left >= 0 && f.base.right <= size.width && f.base.foot <= size.height && f.base.top >= 0
    about = `the globe and base ${framed ? 'lie inside' : 'leave'} the ${size.width} x ${size.height} frame (glass top at ${round(g.cy - g.r, 1)} px, foot at ${round(f.base.foot, 1)} px, base from ${round(f.base.left, 1)} to ${round(f.base.right, 1)} px)`
  } else if (entry.camera === 'base' && f) {
    framed = f.base.left >= 0 && f.base.right <= size.width && f.base.top >= 0 && f.base.foot <= size.height
    about = `the base ${framed ? 'lies inside' : 'leaves'} the frame (${round(f.base.left, 1)} to ${round(f.base.right, 1)} px across, ${round(f.base.top, 1)} to ${round(f.base.foot, 1)} px down)`
  } else if (entry.camera === 'interior') {
    if (!miniature) {
      framed = false
      about = 'the miniature could not be read from the ids view'
    } else if (miniature.count === 0) {
      framed = false
      about = miniature.parts ? 'the ids view shows no pixel of the miniature' : `the page lists no part named miniature-${entry.season}`
    } else {
      framed = !miniature.touches
      about = `the miniature, ${miniature.count} pixels in the ids view, ${framed ? 'stays clear of' : 'touches'} the edge of the frame`
    }
  }
  const pass = invalid === 0 && framed
  return line('M1', entry.id, pass, invalid, 0, `${invalid} invalid values in ${record.measured.sanity.pixels} pixels; ${about}`, { framed })
}

export function miniatureInFrame(ids, parts, season) {
  const m = partMask(ids, parts, (n) => n === `miniature-${season}`)
  return { count: m.count, parts: m.parts, touches: m.count > 0 && touchesEdge(m.mask, ids.width, ids.height) }
}

export function encoding(img, channel) {
  let off = 0
  const n = img.width * img.height
  for (let i = 0, o = channel; i < n; i++, o += 4) {
    const v = img.data[o]
    if (v > 7 && v < 248) off++
  }
  const share = off / n
  return { share, ok: share <= ENCODING_TOLERANCE }
}

const notEncoded = (view, enc) => `the ${view} view does not hold its encoding: blue is neither 0 nor 1 in ${pct(enc.share)} of the picture, so the page does not draw this view yet`

export function m2(still, img, shown = null) {
  const enc = encoding(img, 2)
  const d = cfg.detail
  let textured = 0
  let zone = 0
  let soft = 0
  const n = img.width * img.height
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    if (img.data[o + 2] < ON) continue
    textured++
    if ((img.data[o + 1] / 255) * 8 >= d.focusCocPx) continue
    zone++
    if ((img.data[o] / 255) * 4 < d.minTexelsPerPixel) soft++
  }
  const share = zone ? soft / zone : 0
  const counts = { textured, sharpZone: zone, soft, ...(shown === null ? {} : { shownInIds: shown }) }
  if (!enc.ok) return line('M2', still, false, round(share), d.maxSoftPixelFraction, notEncoded('texels', enc), { ...counts, encodingOff: round(enc.share) })
  if (textured === 0 && shown > 0) return line('M2', still, false, 0, d.maxSoftPixelFraction, `the texels view marks no textured pixel, though the ids view shows ${shown} pixels of the base and the miniature`, counts)
  if (zone === 0) return line('M2', still, true, 0, d.maxSoftPixelFraction, `no textured pixel of the base or the miniature lies in the sharp zone, so there is nothing to count (${textured} textured pixels in all)`, counts)
  return line('M2', still, share <= d.maxSoftPixelFraction, round(share), d.maxSoftPixelFraction, `${soft} of ${zone} textured pixels in the sharp zone are under detail.minTexelsPerPixel (${textured} textured pixels in all)`, counts)
}

export function shownParts(ids, parts, season) {
  return partMask(ids, parts, (n) => n === `miniature-${season}` || n === `base-${season}`).count
}

function coverShares(img) {
  const n = img.width * img.height
  const at = Math.ceil(cfg.shake.coverOpacity * 255 - 1e-9)
  let miniature = 0
  let hidden = 0
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    if (img.data[o + 2] < ON) continue
    miniature++
    if (img.data[o] >= at) hidden++
  }
  return { miniature, hidden }
}

export function m4(shot, img) {
  const enc = encoding(img, 2)
  const c = coverShares(img)
  const share = c.miniature ? c.hidden / c.miniature : 0
  const s = cfg.shake
  if (!enc.ok) return line('M4', shot, false, round(share), s.minCoverAtSwap, notEncoded('cover', enc), { ...c, encodingOff: round(enc.share) })
  const detail = c.miniature ? `${c.hidden} of ${c.miniature} miniature pixels are hidden to at least shake.coverOpacity in the middle of the swap window` : 'the cover view shows no pixel of the miniature'
  return line('M4', shot, c.miniature > 0 && share >= s.minCoverAtSwap, round(share), s.minCoverAtSwap, detail, c)
}

export function m5(shot, img) {
  const enc = encoding(img, 2)
  const c = coverShares(img)
  const share = c.miniature ? (c.miniature - c.hidden) / c.miniature : 0
  const s = cfg.shake
  if (!enc.ok) return line('M5', shot, false, round(share), s.minVisibleAfterSettle, notEncoded('cover', enc), { ...c, encodingOff: round(enc.share) })
  const detail = c.miniature ? `${c.miniature - c.hidden} of ${c.miniature} miniature pixels are hidden by less than shake.coverOpacity, shake.settleCheckSeconds after the landing` : 'the cover view shows no pixel of the miniature'
  return line('M5', shot, c.miniature > 0 && share >= s.minVisibleAfterSettle, round(share), s.minVisibleAfterSettle, detail, c)
}

export function m6(still, record) {
  const i = record.measured.inside
  const share = i.total ? i.inside / i.total : 0
  const pass = share <= cfg.sim.maxInsideFraction && i.outside === 0
  return line('M6', still, pass, round(share, 6), cfg.sim.maxInsideFraction, `${i.inside} of ${i.total} particles inside a solid, ${i.outside} outside the sphere`, { ...i })
}

function kernel(sigma) {
  const half = Math.ceil(sigma * 3)
  const k = new Float64Array(2 * half + 1)
  let sum = 0
  for (let i = -half; i <= half; i++) sum += k[i + half] = Math.exp(-(i * i) / (2 * sigma * sigma))
  for (let i = 0; i < k.length; i++) k[i] /= sum
  return { k, half }
}

function luma(img, box) {
  const out = new Float64Array(box.width * box.height)
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const o = ((box.top + y) * img.width + box.left + x) * 4
      out[y * box.width + x] = (0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2]) / 255
    }
  }
  return out
}

function blur(src, width, height, sigma) {
  const { k, half } = kernel(sigma)
  const tmp = new Float64Array(src.length)
  const out = new Float64Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0
      for (let i = -half; i <= half; i++) s += k[i + half] * src[y * width + Math.min(width - 1, Math.max(0, x + i))]
      tmp[y * width + x] = s
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0
      for (let i = -half; i <= half; i++) s += k[i + half] * tmp[Math.min(height - 1, Math.max(0, y + i)) * width + x]
      out[y * width + x] = s
    }
  }
  return out
}

export function highFrequencyEnergy(img, box, mask = null) {
  const y = luma(img, box)
  const low = blur(y, box.width, box.height, HIGH_PASS_SIGMA_PX)
  let sum = 0
  let n = 0
  for (let i = 0; i < y.length; i++) {
    if (mask && !mask[i]) continue
    const d = y[i] - low[i]
    sum += d * d
    n++
  }
  return { energy: n ? sum / n : 0, pixels: n }
}

const M3_REGIONS = [
  { name: 'base', crop: 'base-front', part: (season) => (n) => n === `base-${season}` },
  { name: 'miniature', crop: 'miniature', part: (season) => (n) => n === `miniature-${season}` },
]

export async function m3(still, season, comparison, ids, parts) {
  const d = cfg.detail
  const regions = []
  const sheets = new Map()
  for (const r of M3_REGIONS) {
    const c = comparison.crops.find((x) => x.name === r.crop)
    if (!c) {
      regions.push({ name: r.name, ratio: 0, note: `the comparison has no crop named ${r.crop}` })
      continue
    }
    const file = rel(c.file)
    if (!sheets.has(file)) sheets.set(file, await rgba(file))
    const sheet = sheets.get(file)
    const pad = { left: Math.max(c.a.edgeFillPx.left, c.b.edgeFillPx.left), top: Math.max(c.a.edgeFillPx.top, c.b.edgeFillPx.top), right: Math.max(c.a.edgeFillPx.right, c.b.edgeFillPx.right), bottom: Math.max(c.a.edgeFillPx.bottom, c.b.edgeFillPx.bottom) }
    const width = c.b.at.width - pad.left - pad.right
    const height = c.b.at.height - pad.top - pad.bottom
    if (width < 16 || height < 16) {
      regions.push({ name: r.name, ratio: 0, note: 'the region lies outside one of the two pictures' })
      continue
    }
    const boxA = { left: c.a.at.left + pad.left, top: c.a.at.top + pad.top, width, height }
    const boxB = { left: c.b.at.left + pad.left, top: c.b.at.top + pad.top, width, height }
    let mask = null
    let masked = 0
    if (ids) {
      const part = partMask(ids, parts, r.part(season))
      const x0 = Math.round(c.b.source.x) + pad.left
      const y0 = Math.round(c.b.source.y) + pad.top
      mask = new Uint8Array(width * height)
      for (let y = 0; y < height; y++) {
        const sy = y0 + y
        if (sy < 0 || sy >= ids.height) continue
        for (let x = 0; x < width; x++) {
          const sx = x0 + x
          if (sx < 0 || sx >= ids.width) continue
          if (part.mask[sy * ids.width + sx]) {
            mask[y * width + x] = 1
            masked++
          }
        }
      }
      if (masked < MIN_MASK_SHARE * width * height) mask = null
    }
    const a = highFrequencyEnergy(sheet, boxA, mask)
    const b = highFrequencyEnergy(sheet, boxB, mask)
    regions.push({
      name: r.name,
      ratio: a.energy > 0 ? b.energy / a.energy : 0,
      energy: { approved: a.energy, still: b.energy },
      pixels: b.pixels,
      masked: mask ? 'the part in the ids view' : 'the whole matching region',
      box: { width, height },
    })
  }
  const worst = regions.reduce((m, r) => Math.min(m, r.ratio), Infinity)
  const pass = regions.length === M3_REGIONS.length && regions.every((r) => !r.note) && worst >= d.minSharpnessRatio
  const detail = regions.map((r) => (r.note ? `${r.name}: ${r.note}` : `${r.name} ${r.ratio.toFixed(3)} over ${r.pixels} pixels of ${r.masked}`)).join('; ')
  return line('M3', still, pass, round(worst === Infinity ? 0 : worst), d.minSharpnessRatio, `high frequency energy of the still over the approved image at the same size: ${detail}`, { regions, sigmaPx: HIGH_PASS_SIGMA_PX })
}

export function approvedFor(image) {
  const regions = readJson(rel('references', 'regions.json'))
  return regions[path.basename(image, path.extname(image))] ?? null
}

const RAD = Math.PI / 180
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

export function framingFromPose(pose, width, height, liftMm = 0) {
  const g = cfg.globe
  const pos = pose.slice(0, 3)
  const fwd = unit(sub(pose.slice(3, 6), pos))
  const right = unit(cross(fwd, [0, 1, 0]))
  const up = cross(right, fwd)
  const f = height / 2 / Math.tan((pose[6] * RAD) / 2)
  const project = (p) => {
    const v = sub(p, pos)
    const z = dot(v, fwd)
    return [width / 2 + (f * dot(v, right)) / z, height / 2 - (f * dot(v, up)) / z, z]
  }
  const radius = g.sphereDiameterMm / 2
  const centre = [0, g.baseHeightMm - g.collarDepthMm + radius + liftMm, 0]
  const [cx, cy, cz] = project(centre)
  const d = Math.hypot(...sub(centre, pos))
  const inside = d <= radius || cz <= 0
  const r = inside ? Infinity : (f * radius) / Math.sqrt(d * d - radius * radius)
  const half = g.baseDiameterMm / 2
  const base = { left: Infinity, right: -Infinity, top: Infinity, foot: -Infinity }
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2
    for (const y of [0, g.baseHeightMm]) {
      const [x, py] = project([Math.cos(a) * half, y + liftMm, Math.sin(a) * half])
      base.left = Math.min(base.left, x)
      base.right = Math.max(base.right, x)
      if (y > 0) base.top = Math.min(base.top, py)
      else base.foot = Math.max(base.foot, py)
    }
  }
  return { globe: { cx, cy, r }, base }
}

export function toMarkdown(result) {
  const out = []
  out.push(`# Measures · ${result.unit}`)
  out.push('')
  out.push(`${result.complete ? 'Complete' : 'Not complete'}: ${result.lines.length} of ${result.planned} lines, ${result.red} red. Tier ${result.tier}, asset set ${result.assets}, engine ${result.engineHash}, ${result.time}.`)
  out.push('')
  out.push('| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |')
  out.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const l of result.lines) out.push(`| ${l.measure} ${MEASURES[l.measure].name} | \`${l.still}\` | ${l.pass ? 'pass' : 'fail'} | ${l.value} | ${l.threshold} | ${l.key ? `\`${l.key}\`` : 'none'} | ${l.detail} |`)
  if (result.notes.length) {
    out.push('')
    for (const n of result.notes) out.push(`- ${n}`)
  }
  return out.join('\n') + '\n'
}

export const printLine = (l) => `${l.pass ? 'pass' : 'FAIL'} ${l.measure} ${l.still}: ${l.value} (threshold ${l.threshold}, ${l.key || 'no config key'}) ${l.detail}`

