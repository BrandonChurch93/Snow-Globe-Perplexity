import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, ...boxes] = process.argv.slice(2)
async function tops(file, box, k, share) {
  const r = { left: Math.round(box[0] * k), top: Math.round(box[1] * k), width: Math.round((box[2] - box[0]) * k), height: Math.round((box[3] - box[1]) * k) }
  const { data } = await sharp(file).removeAlpha().extract(r).raw().toBuffer({ resolveWithObject: true })
  const px = []
  for (let i = 0; i < data.length; i += 3) px.push([0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2], data[i], data[i + 1], data[i + 2]])
  px.sort((a, b) => b[0] - a[0])
  const n = Math.max(1, Math.floor(px.length * share))
  const m = [0, 0, 0, 0]
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) m[c] += px[i][c] / n
  return m.map((v) => Math.round(v)).join(',')
}
const meta = await sharp(still).metadata()
for (const b of boxes) {
  const [name, s] = b.split('=')
  const box = s.split(',').map(Number)
  for (const share of [0.001, 0.005, 0.02]) console.log(name.padEnd(8), share, 'approved L,r,g,b', (await tops(REF, box, 1, share)).padEnd(18), '| render', await tops(still, box, meta.width / 2816, share))
}
