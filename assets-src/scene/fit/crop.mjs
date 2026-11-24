import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, name, boxs, wides] = process.argv.slice(2)
const box = boxs.split(',').map(Number)
const wide = Number(wides ?? 700)
const meta = await sharp(still).metadata()
const k = meta.width / 2816
const cut = (s) => ({ left: Math.round(box[0] * s), top: Math.round(box[1] * s), width: Math.round((box[2] - box[0]) * s), height: Math.round((box[3] - box[1]) * s) })
const high = Math.round((wide * (box[3] - box[1])) / (box[2] - box[0]))
const size = { width: wide, height: high, fit: 'fill' }
const ref = await sharp(REF).removeAlpha().extract(cut(1)).resize(size).png().toBuffer()
const ren = await sharp(still).removeAlpha().extract(cut(k)).resize(size).png().toBuffer()
await sharp({ create: { width: wide * 2 + 6, height: high, channels: 3, background: '#0b0d10' } }).composite([{ input: ref, left: 0, top: 0 }, { input: ren, left: wide + 6, top: 0 }]).jpeg({ quality: 90 }).toFile(`out/work/fit/${name}.jpg`)
console.log(`out/work/fit/${name}.jpg`, wide * 2 + 6, high)
