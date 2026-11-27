import sharp from 'sharp'
import { fileOf } from './lib.mjs'
// peek.mjs head x y w h k f1,f2,f3 out : tiles side by side, nearest neighbour
const [head, x, y, w, h, k, fs_, out] = process.argv.slice(2)
const frames = fs_.split(',').map(Number)
const W = Number(w) * Number(k), H = Number(h) * Number(k)
const parts = []
for (const [n, f] of frames.entries()) parts.push({ input: await sharp(fileOf(head, f)).removeAlpha().extract({ left: Number(x), top: Number(y), width: Number(w), height: Number(h) }).resize(W, H, { kernel: 'nearest' }).png().toBuffer(), left: n * (W + 8), top: 0 })
await sharp({ create: { width: frames.length * W + (frames.length - 1) * 8, height: H, channels: 3, background: '#f0f' } }).composite(parts).png().toFile(out)
