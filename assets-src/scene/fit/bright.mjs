import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, ...boxes] = process.argv.slice(2)
const share = Number(process.env.TOP ?? 0.02)
const top = async (file, b, k) => {
  const { data, info } = await sharp(file).removeAlpha().extract({ left: Math.round(b[0] * k), top: Math.round(b[1] * k), width: Math.round((b[2] - b[0]) * k), height: Math.round((b[3] - b[1]) * k) }).raw().toBuffer({ resolveWithObject: true })
  const px = []
  for (let i = 0; i < data.length; i += info.channels) px.push([data[i], data[i + 1], data[i + 2]])
  px.sort((a, c) => c[0] + c[1] + c[2] - a[0] - a[1] - a[2])
  const n = Math.max(1, Math.round(px.length * share))
  const mean = [0, 1, 2].map((c) => Math.round(px.slice(0, n).reduce((s, p) => s + p[c], 0) / n))
  const lit = px.filter((p) => p[0] + p[1] + p[2] > 300).length / px.length
  return `${mean.join(',')} lit ${(100 * lit).toFixed(2)}%`
}
const meta = await sharp(still).metadata()
for (const spec of boxes) {
  const [name, box] = spec.split('=')
  const b = box.split(',').map(Number)
  console.log(name.padEnd(10), 'approved', await top(REF, b, 1), '  render', await top(still, b, meta.width / 2816))
}
