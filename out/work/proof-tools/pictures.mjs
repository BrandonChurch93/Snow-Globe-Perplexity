import sharp from 'sharp'
import fs from 'node:fs'
import { FRAMES, HEADS, load, fileOf, event, BOXES, W, H } from './lib.mjs'
const OUT = 'out/work/proof'
const heads = process.argv[2] ? process.argv[2].split(',') : ['main', 'tree']
const NAME = { main: 'main 6d459061', tree: 'tree 01f1f0b9' }
const label = (text, w, h = 56, size = 34) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#111"/><text x="12" y="${Math.round(h * 0.7)}" font-family="DejaVu Sans Mono, monospace" font-size="${size}" fill="#e8e8e8">${text}</text></svg>`)
const data = {}
for (const hd of heads) data[hd] = await Promise.all(FRAMES.map((f) => load(hd, f)))
const crop = (buf, [x0, y0, w, h]) => {
  const o = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) buf.copy(o, y * w * 3, ((y + y0) * W + x0) * 3, ((y + y0) * W + x0 + w) * 3)
  return o
}
// 1. box (b) at four times, nearest neighbour, six frames, main's strip above the tree's
{
  const [x0, y0, w, h] = BOXES.b, k = 4, gap = 16, lh = 56
  const tw = w * k, th = h * k
  const parts = []
  let row = 0
  for (const hd of heads) {
    for (let n = 0; n < 6; n++) {
      const left = n * (tw + gap), top = row * (th + lh + gap)
      parts.push({ input: label(`${NAME[hd]} · frame ${FRAMES[n]} · box b ${x0},${y0} ${w}x${h} · 4x`, tw, lh), left, top })
      const big = await sharp(crop(data[hd][n], BOXES.b), { raw: { width: w, height: h, channels: 3 } }).resize(tw, th, { kernel: 'nearest' }).png().toBuffer()
      parts.push({ input: big, left, top: top + lh })
    }
    row++
  }
  await sharp({ create: { width: 6 * tw + 5 * gap, height: heads.length * (th + lh) + (heads.length - 1) * gap, channels: 3, background: '#000' } }).composite(parts).png({ compressionLevel: 9 }).toFile(`${OUT}/box-b-4x-strips.png`)
  console.log('box-b-4x-strips.png')
}
// 2. the one frame events of box (a) in red over a dimmed frame 1990, the heads side by side
{
  const [x0, y0, w, h] = BOXES.a, gap = 16, lh = 44
  const parts = []
  const rows = [['frame 1990', [2]], ['frames 1989-1992', [1, 2, 3, 4]]]
  rows.forEach(([what, ks], r) => {
    heads.forEach((hd, c) => {
      const fr = data[hd]
      const o = Buffer.alloc(w * h * 3)
      let count = 0
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = ((y + y0) * W + x + x0) * 3, j = (y * w + x) * 3
        let ev = false
        for (const k of ks) if (event(fr[k - 1], fr[k], fr[k + 1], i)) { ev = true; break }
        if (ev) { o[j] = 255; o[j + 1] = 0; o[j + 2] = 0; count++ } else {
          const g = Math.round((0.2126 * fr[2][i] + 0.7152 * fr[2][i + 1] + 0.0722 * fr[2][i + 2]) * 0.4)
          o[j] = o[j + 1] = o[j + 2] = g
        }
      }
      const left = c * (w + gap), top = r * (h + lh + gap)
      parts.push({ input: label(`${NAME[hd]} · events, ${what}: ${count} px, ${(100 * count / (w * h)).toFixed(3)} %`, w, lh, 17), left, top })
      parts.push({ input: o, raw: { width: w, height: h, channels: 3 }, left, top: top + lh })
    })
  })
  await sharp({ create: { width: heads.length * w + (heads.length - 1) * gap, height: 2 * (h + lh) + gap, channels: 3, background: '#000' } }).composite(parts).png({ compressionLevel: 9 }).toFile(`${OUT}/box-a-one-frame-events.png`)
  console.log('box-a-one-frame-events.png')
}
// 3. frame 1990 whole at 1200 px from each head
{
  const lh = 40, gap = 12, w = 1200, h = 675
  const parts = []
  for (const [n, hd] of heads.entries()) {
    const top = n * (h + lh + gap)
    parts.push({ input: label(`${NAME[hd]} · film B frame 1990 · 3840 x 2160 shown at 1200 x 675`, w, lh, 22), left: 0, top })
    parts.push({ input: await sharp(fileOf(hd, 1990)).removeAlpha().resize(w, h, { kernel: 'lanczos3' }).png().toBuffer(), left: 0, top: top + lh })
  }
  await sharp({ create: { width: w, height: heads.length * (h + lh) + (heads.length - 1) * gap, channels: 3, background: '#000' } }).composite(parts).png({ compressionLevel: 9 }).toFile(`${OUT}/frame-1990-whole-1200.png`)
  console.log('frame-1990-whole-1200.png')
}
// extra: where the boxes lie, on frame 1990 of the last head, at half size
{
  const hd = heads[heads.length - 1]
  const col = { a: '#ff3030', b: '#ffd000', c: '#30c0ff' }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${Object.entries(BOXES).map(([n, [x, y, w, h]]) => `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" fill="none" stroke="${col[n]}" stroke-width="4"/><text x="${x + 6}" y="${y + h + 44}" font-family="DejaVu Sans Mono, monospace" font-size="40" fill="${col[n]}">${n}</text>`).join('')}</svg>`
  const whole = await sharp(fileOf(hd, 1990)).removeAlpha().composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png({ compressionLevel: 1 }).toBuffer()
  await sharp(whole).extract({ left: 1240, top: 340, width: 1400, height: 1100 }).png().toFile(`${OUT}/boxes-on-frame-1990-${hd}.png`)
  console.log('boxes picture')
}
