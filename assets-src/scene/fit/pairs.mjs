import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, name, wides, ...boxes] = process.argv.slice(2)
const wide = Number(wides)
const meta = await sharp(still).metadata()
const k = meta.width / 2816
const tiles = []
let top = 0
for (const spec of boxes) {
  const b = spec.split(',').map(Number)
  const high = Math.round((wide * (b[3] - b[1])) / (b[2] - b[0]))
  const cut = (f, s) => sharp(f).removeAlpha().extract({ left: Math.round(b[0] * s), top: Math.round(b[1] * s), width: Math.round((b[2] - b[0]) * s), height: Math.round((b[3] - b[1]) * s) }).resize(wide, high, { fit: 'fill', kernel: 'cubic' }).png().toBuffer()
  tiles.push({ input: await cut(REF, 1), left: 0, top }, { input: await cut(still, k), left: wide + 6, top })
  top += high + 6
}
await sharp({ create: { width: wide * 2 + 6, height: top - 6, channels: 3, background: '#0b0d10' } }).composite(tiles).jpeg({ quality: 92 }).toFile(`out/work/fit/${name}.jpg`)
console.log(`out/work/fit/${name}.jpg`, wide * 2 + 6, top - 6)
