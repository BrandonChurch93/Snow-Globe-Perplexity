import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, xs, ...bands] = process.argv.slice(2)
const [x0, x1] = xs.split(',').map(Number)
const win = Number(process.env.WIN ?? 15)
const rows = async (file, k, y0, y1) => {
  const w = Math.round((x1 - x0) * k)
  const h = Math.round((y1 - y0) * k)
  const { data, info } = await sharp(file).removeAlpha().extract({ left: Math.round(x0 * k), top: Math.round(y0 * k), width: w, height: h }).resize(x1 - x0, y1 - y0, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  let best = [0, 0, 0]
  for (let y = 0; y < info.height; y++) {
    const L = []
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      L.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])
    }
    let sum = 0
    let grad = 0
    let n = 0
    for (let x = win; x < L.length - win; x++) {
      let m = 0
      for (let j = -win; j <= win; j++) m += L[x + j]
      m /= 2 * win + 1
      sum += (L[x] - m) ** 2
      grad += Math.abs(L[x + 1] - L[x])
      n++
    }
    const rms = Math.sqrt(sum / n)
    if (rms > best[0]) best = [rms, grad / n, y0 + y]
  }
  return best
}
const meta = await sharp(still).metadata()
for (const spec of bands) {
  const [name, box] = spec.split('=')
  const [y0, y1] = box.split(',').map(Number)
  const a = await rows(REF, 1, y0, y1)
  const r = await rows(still, meta.width / 2816, y0, y1)
  console.log(name.padEnd(8), `approved rms ${a[0].toFixed(1)} step ${a[1].toFixed(2)} at y ${a[2]}`, `  render rms ${r[0].toFixed(1)} step ${r[1].toFixed(2)} at y ${r[2]}`)
}
