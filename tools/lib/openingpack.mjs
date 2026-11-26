import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { rel } from './paths.mjs'

export const PACK_FILES = { manifest: 'manifest.json', bin: 'opening.bin' }
export const PACK_VERSION = 1
export const PACK_DIRS = { source: () => rel('public', 'opening'), hosted: () => rel('dist', 'opening'), master: () => rel('out', 'work', 'opening', 'master') }

const TILE = 16
const KEY_SHARE = 0.4
const LONGEST_CHAIN = 120
const MOST_PATCHES = 12
const CHEAP_TO_JOIN = 2048

const digest = (b) => crypto.createHash('sha1').update(b).digest('hex')
const encode = (raw, width, height) => sharp(raw, { raw: { width, height, channels: 3 } }).webp({ lossless: true, effort: 6 }).toBuffer()
const decode = async (blob) => {
  const { data, info } = await sharp(blob).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) throw new Error('a picture of the opening pack is not plain colour')
  return { data, width: info.width, height: info.height }
}

const union = (p, q) => {
  const x = Math.min(p.x, q.x)
  const y = Math.min(p.y, q.y)
  return { x, y, w: Math.max(p.x + p.w, q.x + q.w) - x, h: Math.max(p.y + p.h, q.y + q.h) - y }
}

function join(boxes) {
  const list = [...boxes]
  for (;;) {
    let best = null
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const u = union(list[i], list[j])
        const cost = u.w * u.h - list[i].w * list[i].h - list[j].w * list[j].h
        if (best === null || cost < best.cost) best = { i, j, cost, u }
      }
    }
    if (!best || (best.cost > CHEAP_TO_JOIN && list.length <= MOST_PATCHES)) break
    list.splice(best.j, 1)
    list.splice(best.i, 1, best.u)
  }
  return list.sort((p, q) => p.y - q.y || p.x - q.x)
}

export function changedBoxes(a, b, width, height) {
  const cols = Math.ceil(width / TILE)
  const rows = Math.ceil(height / TILE)
  const mark = new Uint8Array(cols * rows)
  const stride = width * 3
  for (let y = 0; y < height; y++) {
    const o = y * stride
    if (a.compare(b, o, o + stride, o, o + stride) === 0) continue
    const row = Math.floor(y / TILE) * cols
    for (let tx = 0; tx < cols; tx++) {
      if (mark[row + tx]) continue
      const s = o + tx * TILE * 3
      const e = Math.min(o + stride, s + TILE * 3)
      if (a.compare(b, s, e, s, e) !== 0) mark[row + tx] = 1
    }
  }
  const seen = new Uint8Array(cols * rows)
  const boxes = []
  for (let i = 0; i < mark.length; i++) {
    if (!mark[i] || seen[i]) continue
    const stack = [i]
    seen[i] = 1
    let x0 = width
    let y0 = height
    let x1 = -1
    let y1 = -1
    while (stack.length) {
      const j = stack.pop()
      const tx = j % cols
      const ty = Math.floor(j / cols)
      const right = Math.min(width, (tx + 1) * TILE)
      const bottom = Math.min(height, (ty + 1) * TILE)
      for (let y = ty * TILE; y < bottom; y++) {
        for (let x = tx * TILE; x < right; x++) {
          const o = (y * width + x) * 3
          if (a[o] === b[o] && a[o + 1] === b[o + 1] && a[o + 2] === b[o + 2]) continue
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = tx + dx
          const ny = ty + dy
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          const n = ny * cols + nx
          if (!mark[n] || seen[n]) continue
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    boxes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
  }
  return join(boxes)
}

export function readPack(manifestBytes, bin) {
  let m
  try {
    m = JSON.parse(manifestBytes.toString('utf8'))
  } catch {
    throw new Error("the opening pack's manifest is not JSON")
  }
  const whole = (n) => Number.isInteger(n) && n >= 0
  if (m.version !== PACK_VERSION) throw new Error(`the opening pack is version ${m.version}, and this build reads version ${PACK_VERSION}`)
  if (!whole(m.width) || !whole(m.height) || !whole(m.frameCount) || !Array.isArray(m.frames) || m.frames.length !== m.frameCount || !Array.isArray(m.pictures) || !Array.isArray(m.images)) throw new Error("the opening pack's manifest is damaged")
  if (m.images.some(([o, l]) => !whole(o) || !whole(l) || o + l > bin.length)) throw new Error("the opening pack's pictures do not fit its file: the pack is damaged")
  if (m.frames.some((p) => !whole(p) || p >= m.pictures.length)) throw new Error("the opening pack's manifest names a picture it does not hold")
  const { width, height } = m
  const canvas = Buffer.alloc(width * height * 3)
  let shown = -1
  const blob = (n) => bin.subarray(m.images[n][0], m.images[n][0] + m.images[n][1])
  const apply = async (p) => {
    const pic = m.pictures[p]
    if ('key' in pic) {
      const d = await decode(blob(pic.key))
      if (d.width !== width || d.height !== height) throw new Error('a whole picture of the opening pack has the wrong size')
      d.data.copy(canvas)
    } else {
      for (const [n, x, y] of pic.patches) {
        const d = await decode(blob(n))
        if (x + d.width > width || y + d.height > height) throw new Error('a part of a picture of the opening pack lies outside the picture')
        for (let r = 0; r < d.height; r++) d.data.copy(canvas, ((y + r) * width + x) * 3, r * d.width * 3, (r + 1) * d.width * 3)
      }
    }
    shown = p
  }
  const show = async (p) => {
    const chain = []
    for (let q = p; q !== shown; q = m.pictures[q].from) {
      chain.push(q)
      if ('key' in m.pictures[q]) break
    }
    for (const q of chain.reverse()) await apply(q)
  }
  let busy = Promise.resolve()
  const frame = (i, { copy = true } = {}) => {
    const run = busy.then(async () => {
      if (!whole(i) || i >= m.frameCount) throw new Error(`the opening has no frame ${i}`)
      await show(m.frames[i])
      return copy ? Buffer.from(canvas) : canvas
    })
    busy = run.catch(() => {})
    return run
  }
  return { width, height, fps: m.fps, frameCount: m.frameCount, background: m.background, states: m.states, pictures: m.pictures.length, images: m.images.length, frame }
}

export async function openPack(dir) {
  const manifest = path.join(dir, PACK_FILES.manifest)
  const bin = path.join(dir, PACK_FILES.bin)
  if (!fs.existsSync(manifest) || !fs.existsSync(bin)) throw new Error(`there is no opening pack in ${dir}`)
  return readPack(fs.readFileSync(manifest), fs.readFileSync(bin))
}

export const hasPack = (dir) => fs.existsSync(path.join(dir, PACK_FILES.manifest)) && fs.existsSync(path.join(dir, PACK_FILES.bin))

export const packSha = (dir) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, PACK_FILES.manifest))).update(fs.readFileSync(path.join(dir, PACK_FILES.bin))).digest('hex')

export function packServed(width, { hosted = PACK_DIRS.hosted(), master = PACK_DIRS.master() } = {}) {
  if (!hasPack(hosted)) return null
  const wider = width > JSON.parse(fs.readFileSync(path.join(hosted, PACK_FILES.manifest), 'utf8')).width
  const dir = wider && hasPack(master) ? master : hosted
  return { name: dir === master ? 'master' : wider ? 'hd, enlarged' : 'hd', sha256: packSha(dir) }
}

export const packLine = (name, format) =>
  name === 'master'
    ? `the opening's frames come from the master pack, one to one at ${format.width} x ${format.height}`
    : name === 'hd'
      ? "the opening's frames come from the hd pack, one to one or reduced"
      : `the opening's frames come from the hd pack, enlarged to ${format.width} x ${format.height}: there is no master pack (npm run opening -- --master makes one)`

export function buildPack({ width, height, fps }) {
  const images = []
  const known = new Map()
  const pictures = []
  const frames = []
  const drawn = []
  let prev = null
  let chain = 0
  const image = async (raw, w, h) => {
    const id = `${w}x${h}:${digest(raw)}`
    let n = known.get(id)
    if (n === undefined) {
      n = images.length
      images.push(await encode(raw, w, h))
      known.set(id, n)
    }
    return n
  }
  const cut = (rgb, b) => {
    const out = Buffer.allocUnsafe(b.w * b.h * 3)
    for (let y = 0; y < b.h; y++) rgb.copy(out, y * b.w * 3, ((b.y + y) * width + b.x) * 3, ((b.y + y) * width + b.x + b.w) * 3)
    return out
  }
  return {
    drawn,
    async add(rgb) {
      if (rgb.length !== width * height * 3) throw new Error(`a frame of ${rgb.length} bytes does not fit ${width} x ${height}`)
      drawn.push(digest(rgb))
      if (prev && prev.equals(rgb)) {
        frames.push(pictures.length - 1)
        return
      }
      const boxes = prev ? changedBoxes(prev, rgb, width, height) : null
      const share = boxes ? boxes.reduce((s, b) => s + b.w * b.h, 0) / (width * height) : 1
      if (!boxes || share >= KEY_SHARE || chain >= LONGEST_CHAIN) {
        pictures.push({ key: await image(rgb, width, height) })
        chain = 0
      } else {
        const patches = []
        for (const b of boxes) patches.push([await image(cut(rgb, b), b.w, b.h), b.x, b.y])
        pictures.push({ from: pictures.length - 1, patches })
        chain++
      }
      frames.push(pictures.length - 1)
      prev = rgb
    },
    async finish(states, ground) {
      const table = []
      let at = 0
      for (const b of images) {
        table.push([at, b.length])
        at += b.length
      }
      const bin = Buffer.concat(images)
      const manifest = Buffer.from(JSON.stringify({ version: PACK_VERSION, width, height, fps, frameCount: frames.length, background: ground, images: table, pictures, frames, states }) + '\n')
      const pack = readPack(manifest, bin)
      let exact = true
      for (let i = 0; i < frames.length && exact; i++) exact = digest(await pack.frame(i, { copy: false })) === drawn[i]
      return { manifest, bin, pictures: pictures.length, images: images.length, bytes: manifest.length + bin.length, exact }
    },
  }
}
