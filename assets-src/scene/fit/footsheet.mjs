import fs from 'node:fs'
import sharp from 'sharp'
const [dir, name, boxs, firsts, lasts, steps, scales] = process.argv.slice(2)
const box = boxs.split(',').map(Number)
const first = Number(firsts)
const last = Number(lasts)
const step = Number(steps ?? 1)
const scale = Number(scales ?? 3)
const w = (box[2] - box[0]) * scale
const h = (box[3] - box[1]) * scale
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => ({ f, n: Number(f.match(/(\d+)\.png$/)[1]) })).filter((x) => x.n >= first && x.n <= last && (x.n - first) % step === 0).sort((a, b) => a.n - b.n)
const cols = Math.min(4, files.length)
const rows = Math.ceil(files.length / cols)
const tiles = []
for (let i = 0; i < files.length; i++) {
  const cut = await sharp(`${dir}/${files[i].f}`).removeAlpha().extract({ left: box[0], top: box[1], width: box[2] - box[0], height: box[3] - box[1] }).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer()
  const tag = Buffer.from(`<svg width="${w}" height="20"><rect width="60" height="20" fill="#000"/><text x="4" y="15" font-family="monospace" font-size="14" fill="#fff">${files[i].n}</text></svg>`)
  tiles.push({ input: cut, left: (i % cols) * (w + 4), top: Math.floor(i / cols) * (h + 4) }, { input: tag, left: (i % cols) * (w + 4), top: Math.floor(i / cols) * (h + 4) })
}
await sharp({ create: { width: cols * (w + 4), height: rows * (h + 4), channels: 3, background: '#0b0d10' } }).composite(tiles).jpeg({ quality: 90 }).toFile(`out/work/fit/${name}.jpg`)
console.log(`out/work/fit/${name}.jpg`, files.map((x) => x.n).join(' '))
