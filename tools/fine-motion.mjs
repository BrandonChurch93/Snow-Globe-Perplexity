import sharp from 'sharp'
import { parseArgs } from './lib/paths.mjs'

const USAGE = `node tools/fine-motion.mjs --a first.png --b second.png --box X,Y,W,H [--reach 14] [--over 12]
  two frames of one run, one box from the top left of the picture. Prints, for the box:
  the fine and the slow measure of each frame, the shift of the second frame that fits the first best
  (whole pixels within the reach, then sixteenths of a pixel), and the share of pixels whose largest
  channel differs by more than --over levels with no shift, at the whole shift and at the fine shift,
  with the cost of the resampling itself beside it`

const args = parseArgs(process.argv.slice(2))
const box = String(args.box ?? '').split(',').map(Number)
const reach = Number(args.reach ?? 14)
const over = Number(args.over ?? 12)
if (typeof args.a !== 'string' || typeof args.b !== 'string' || box.length !== 4 || box.some((n) => !Number.isInteger(n) || n < 0) || !Number.isInteger(reach) || reach < 1) {
  console.error(USAGE)
  process.exit(2)
}
const [X, Y, W, H] = box
const M = reach + 3
const SW = W + 2 * M

async function read(file) {
  const meta = await sharp(file).metadata()
  if (X - M < 0 || Y - M < 0 || X + W + M > meta.width || Y + H + M > meta.height) {
    console.error(`the box and its margin of ${M} px do not lie inside ${file} (${meta.width} x ${meta.height})`)
    process.exit(2)
  }
  return sharp(file).extract({ left: X - M, top: Y - M, width: SW, height: H + 2 * M }).removeAlpha().raw().toBuffer()
}

const at = (D, i, j, c) => D[((j + M) * SW + i + M) * 3 + c]
const weights = (t) => [(-t * t * t + 2 * t * t - t) / 2, (3 * t * t * t - 5 * t * t + 2) / 2, (-3 * t * t * t + 4 * t * t + t) / 2, (t * t * t - t * t) / 2]
function sample(D, fx, fy, c) {
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const wx = weights(fx - ix)
  const wy = weights(fy - iy)
  let s = 0
  for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) s += wx[p] * wy[q] * at(D, ix - 1 + p, iy - 1 + q, c)
  return s
}
function compare(A, B, sx, sy) {
  const whole = Number.isInteger(sx) && Number.isInteger(sy)
  let count = 0
  let sum = 0
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      let most = 0
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(at(A, i, j, c) - (whole ? at(B, i + sx, j + sy, c) : sample(B, i + sx, j + sy, c)))
        if (d > most) most = d
        sum += d
      }
      if (most > over) count++
    }
  return { share: (100 * count) / (W * H), mean: sum / (W * H * 3) }
}
function slid(D, fx, fy, edge) {
  const out = new Float32Array(D.length)
  for (let j = -M + edge; j < H + M - edge; j++) for (let i = -M + edge; i < W + M - edge; i++) for (let c = 0; c < 3; c++) out[((j + M) * SW + i + M) * 3 + c] = sample(D, i + fx, j + fy, c)
  return out
}
function fineAndSlow(D) {
  let fine = 0
  let slow = 0
  let n = 0
  const grey = (i, j) => 0.2126 * at(D, i, j, 0) + 0.7152 * at(D, i, j, 1) + 0.0722 * at(D, i, j, 2)
  for (let j = 0; j < H; j++)
    for (let i = 4; i < W - 4; i++) {
      const m3 = (grey(i - 1, j) + grey(i, j) + grey(i + 1, j)) / 3
      let m9 = 0
      for (let k = -4; k <= 4; k++) m9 += grey(i + k, j) / 9
      fine += Math.abs(grey(i, j) - m3)
      slow += Math.abs(m3 - m9)
      n++
    }
  return `fine ${(fine / n).toFixed(2)}, slow ${(slow / n).toFixed(2)}`
}

const A = await read(args.a)
const B = await read(args.b)
let whole = null
for (let sy = -reach; sy <= reach; sy++)
  for (let sx = -reach; sx <= reach; sx++) {
    const s = compare(A, B, sx, sy)
    if (!whole || s.mean < whole.s.mean) whole = { sx, sy, s }
  }
let fine = { ...whole }
for (const step of [0.25, 0.0625]) {
  const from = { ...fine }
  for (let qy = -4; qy <= 4; qy++)
    for (let qx = -4; qx <= 4; qx++) {
      const sx = from.sx + qx * step
      const sy = from.sy + qy * step
      if (Math.abs(sx) > reach + 1 || Math.abs(sy) > reach + 1) continue
      const s = compare(A, B, sx, sy)
      if (s.mean < fine.s.mean) fine = { sx, sy, s }
    }
}
const rx = fine.sx - whole.sx
const ry = fine.sy - whole.sy
const there = slid(A, rx, ry, 2)
const back = Uint8Array.from(slid(there, -rx, -ry, 4), (v) => Math.max(0, Math.min(255, Math.round(v))))
const cost = compare(A, back, 0, 0)
const slide = compare(A, A, rx, ry)
const none = compare(A, B, 0, 0)
const say = (s) => `${s.share.toFixed(1)}% over ${over}, mean ${s.mean.toFixed(2)}`
console.log(`box ${X}, ${Y}, ${W} x ${H}`)
console.log(`first:  ${fineAndSlow(A)}`)
console.log(`second: ${fineAndSlow(B)}`)
console.log(`no shift: ${say(none)}`)
console.log(`whole shift ${whole.sx}, ${whole.sy}: ${say(whole.s)}`)
console.log(`fine shift ${fine.sx.toFixed(2)}, ${fine.sy.toFixed(2)}: ${say(fine.s)}`)
console.log(`the resampling's own cost (the first slid by ${rx.toFixed(2)}, ${ry.toFixed(2)} and back): ${say(cost)}`)
console.log(`a slide of the first alone by that part of a pixel, against itself: ${say(slide)}`)
if (Math.abs(whole.sx) === reach || Math.abs(whole.sy) === reach) console.log(`the best whole shift lies on the edge of the reach of ${reach} px: ask for a wider one`)
