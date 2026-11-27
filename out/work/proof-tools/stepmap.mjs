import sharp from 'sharp'
import { FRAMES, load, step, event, BOXES, W } from './lib.mjs'
// steps (red) of the pair 1990-1991 and the one frame events of 1989..1992 (yellow) over frame 1990 dimmed, box (b), twice the size, both heads
const [x0, y0, w, h] = BOXES.b, k = 2
const parts = []
for (const [c, hd] of ['main', 'tree'].entries()) {
  const fr = []
  for (const f of FRAMES) fr.push(await load(hd, f))
  const o = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y + y0) * W + x + x0) * 3, j = (y * w + x) * 3
    let ev = false
    for (let q = 1; q < 5; q++) if (event(fr[q - 1], fr[q], fr[q + 1], i)) ev = true
    if (ev) { o[j] = 255; o[j + 1] = 230; o[j + 2] = 0 } else if (step(fr[2], fr[3], i) > 12) { o[j] = 255; o[j + 1] = 0; o[j + 2] = 0 } else {
      o[j] = fr[2][i] * 0.5; o[j + 1] = fr[2][i + 1] * 0.5; o[j + 2] = fr[2][i + 2] * 0.5
    }
  }
  parts.push({ input: await sharp(o, { raw: { width: w, height: h, channels: 3 } }).resize(w * k, h * k, { kernel: 'nearest' }).png().toBuffer(), left: 0, top: c * (h * k + 12) })
}
await sharp({ create: { width: w * k, height: 2 * h * k + 12, channels: 3, background: '#fff' } }).composite(parts).png().toFile('out/work/proof/box-b-steps-1990-1991.png')
