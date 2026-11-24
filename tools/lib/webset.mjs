import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { packGlb, STREAMS } from './glbpack.mjs'
import { sha256 } from './hashes.mjs'
import { rel } from './paths.mjs'

/**
 * How a file of the full set becomes its files of the web set. `tools/texpack.mjs` is the only caller.
 *
 * A picture keeps its name and takes the ending of its coding, and the page asks for it by the name the full set has:
 *   name.png          lossless, as in the full set: small tables that are read as data, and any picture the rules below cannot hold
 *   name.webp         WebP near-lossless: no channel of any pixel moves by more than WEB.maxError of 255, checked on every file as it is made
 *   name.first.webp   the same picture at half the size (each 2x2 block averaged, in linear light for a colour map): what the first
 *                     picture needs, so the page can draw before the full file is there. Only for an opaque picture whose long
 *                     side is at least WEB.firstFromPx
 * A model keeps its name; its streams are packed with EXT_meshopt_compression (see glbpack.mjs).
 */

/** Raise when a rule changes, so nothing made by the old rule is taken from the cache. */
export const CODER = 3

export const WEB = {
  /** libwebp's near-lossless level. 60 keeps every value within 2 of 255. */
  nearLossless: 60,
  maxError: 2,
  effort: 6,
  /** A picture with a side under this is a table read as data: it stays lossless and whole. */
  tablePx: 128,
  /** A picture at least this long gets a `.first.` file. */
  firstFromPx: 1024,
}

const PICTURE = /\.png$/i
const MODEL = /\.glb$/i
const CACHE = () => rel('out', 'work', 'texpack', 'cache')

const stem = (name) => name.replace(/\.[^.]+$/, '')

/** The long side the web set may have: the `.wN.` in the name, or the cap of the web set. */
export const webLimit = (name, cap) => Number(/\.w(\d+)\./.exec(name)?.[1] ?? cap)

export function webSize(width, height, limit) {
  const long = Math.max(width, height)
  return long > limit ? { width: Math.round((width * limit) / long), height: Math.round((height * limit) / long), resized: true } : { width, height, resized: false }
}

const TO_LINEAR = Float64Array.from({ length: 256 }, (_, v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})
const toSrgb = (l) => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055))

/** Half the size, each 2x2 block averaged: the next mip level as the GPU makes it. A colour map is averaged in linear light; alpha is always averaged as it is. */
export function halve(data, width, height, channels, colour) {
  const w = width >> 1
  const h = height >> 1
  const out = Buffer.alloc(w * h * channels)
  const colourChannels = channels >= 3 ? 3 : 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (2 * y * width + 2 * x) * channels
      const b = a + channels
      const c = a + width * channels
      const d = c + channels
      const o = (y * w + x) * channels
      for (let k = 0; k < channels; k++) {
        if (colour && k < colourChannels) out[o + k] = toSrgb((TO_LINEAR[data[a + k]] + TO_LINEAR[data[b + k]] + TO_LINEAR[data[c + k]] + TO_LINEAR[data[d + k]]) / 4)
        else out[o + k] = (data[a + k] + data[b + k] + data[c + k] + data[d + k] + 2) >> 2
      }
    }
  }
  return { data: out, width: w, height: h, channels }
}

/** The largest difference of any channel of any pixel, and the PSNR over all of them. */
export function difference(a, b) {
  if (a.length !== b.length) return { max: 255, psnr: 0 }
  let max = 0
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    if (d > max) max = d
    sum += d * d
  }
  return { max, psnr: sum === 0 ? Infinity : 10 * Math.log10((255 * 255 * a.length) / sum) }
}

async function nearLossless(raw) {
  const from = { raw: { width: raw.width, height: raw.height, channels: raw.channels } }
  const coded = await sharp(raw.data, from).webp({ nearLossless: true, quality: WEB.nearLossless, effort: WEB.effort }).toBuffer()
  const back = await sharp(coded).raw().toBuffer({ resolveWithObject: true })
  const d = back.info.channels === raw.channels ? difference(raw.data, back.data) : { max: 255, psnr: 0 }
  if (d.max <= WEB.maxError) return { data: coded, ...d, coding: 'webp near-lossless' }
  const exact = await sharp(raw.data, from).webp({ lossless: true, effort: WEB.effort }).toBuffer()
  const again = await sharp(exact).raw().toBuffer({ resolveWithObject: true })
  const e = again.info.channels === raw.channels ? difference(raw.data, again.data) : { max: 255, psnr: 0 }
  return e.max === 0 ? { data: exact, ...e, coding: 'webp lossless' } : null
}

async function makePicture(file, name, limit) {
  const meta = await sharp(file).metadata()
  const size = webSize(meta.width, meta.height, limit)
  const picture = () => (size.resized ? sharp(file).resize({ width: size.width, height: size.height, kernel: 'lanczos3' }) : sharp(file))
  const lossless = async () => ({ name, data: size.resized ? await picture().png({ compressionLevel: 9 }).toBuffer() : fs.readFileSync(file), coding: 'png', max: 0, width: size.width, height: size.height })
  if (Math.min(size.width, size.height) < WEB.tablePx) return [await lossless()]
  const got = await picture().raw().toBuffer({ resolveWithObject: true })
  const raw = { data: got.data, width: got.info.width, height: got.info.height, channels: got.info.channels }
  const full = raw.channels >= 3 ? await nearLossless(raw) : null
  const plain = await lossless()
  if (!full || full.data.length >= plain.data.length) return [plain]
  const out = [{ name: `${stem(name)}.webp`, data: full.data, coding: full.coding, max: full.max, psnr: full.psnr, width: raw.width, height: raw.height }]
  // Only an opaque picture: the page draws a `.first.` file at twice its size, and a browser may not keep colour under alpha exact when it does.
  if (raw.channels === 3 && Math.max(raw.width, raw.height) >= WEB.firstFromPx && raw.width % 2 === 0 && raw.height % 2 === 0) {
    const small = halve(raw.data, raw.width, raw.height, raw.channels, /\.srgb\./i.test(name))
    const first = await nearLossless(small)
    if (first) out.push({ name: `${stem(name)}.first.webp`, data: first.data, coding: first.coding, max: first.max, psnr: first.psnr, width: small.width, height: small.height, first: true })
  }
  return out
}

async function makeModel(file, name) {
  const source = fs.readFileSync(file)
  const r = await packGlb(source)
  return [{ name, data: r.glb, coding: r.packed ? `meshopt, ${r.packed} of ${r.packed + r.kept} streams` : 'as it is', change: r.change }]
}

/**
 * The web files of one file of the full set: `[{ name, data, coding, ... }]`. Made once per content and rule, then taken from out/work/texpack/cache.
 */
export async function webFiles(file, name, cap, { cache = true } = {}) {
  const kind = PICTURE.test(name) ? 'picture' : MODEL.test(name) ? 'model' : 'copy'
  if (kind === 'copy') return [{ name, data: fs.readFileSync(file), coding: 'as it is' }]
  const limit = webLimit(name, cap)
  const key = sha256(JSON.stringify({ CODER, kind, name, limit, WEB, STREAMS, sharp: sharp.versions, sha: sha256(fs.readFileSync(file)) })).slice(0, 32)
  const dir = path.join(CACHE(), key)
  const list = path.join(dir, 'files.json')
  if (cache && fs.existsSync(list)) {
    try {
      const kept = JSON.parse(fs.readFileSync(list, 'utf8'))
      return kept.map((k, i) => ({ ...k, data: fs.readFileSync(path.join(dir, String(i))), cached: true }))
    } catch {
      // A cache entry that cannot be read is made again.
    }
  }
  const made = kind === 'picture' ? await makePicture(file, name, limit) : await makeModel(file, name)
  if (cache) {
    fs.mkdirSync(dir, { recursive: true })
    made.forEach((m, i) => fs.writeFileSync(path.join(dir, String(i)), m.data))
    const temp = `${list}.${process.pid}`
    fs.writeFileSync(temp, JSON.stringify(made.map(({ data, ...rest }) => rest)))
    fs.renameSync(temp, list)
  }
  return made
}
