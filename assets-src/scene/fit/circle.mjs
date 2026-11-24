import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const files = process.argv.slice(2)
const C0 = [1409, 650]
const THR = Number(process.env.THR ?? 10)
async function fit(file, show) {
  const meta = await sharp(file).metadata()
  const k = meta.width / 2816
  const { data, info } = await sharp(file).removeAlpha().greyscale().blur(Math.max(0.6, 1.0 * k)).raw().toBuffer({ resolveWithObject: true })
  const g = (a, b) => data[Math.min(info.height - 1, Math.max(0, b)) * info.width + Math.min(info.width - 1, Math.max(0, a))]
  const at = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y); const fx = x - xi, fy = y - yi; return (g(xi, yi) * (1 - fx) + g(xi + 1, yi) * fx) * (1 - fy) + (g(xi, yi + 1) * (1 - fx) + g(xi + 1, yi + 1) * fx) * fy }
  let pts = []
  for (let deg = -176; deg <= -4; deg += 1) {
    const a = (deg * Math.PI) / 180
    const grad = (r) => at((C0[0] + Math.cos(a) * (r - 1.5)) * k, (C0[1] + Math.sin(a) * (r - 1.5)) * k) - at((C0[0] + Math.cos(a) * (r + 1.5)) * k, (C0[1] + Math.sin(a) * (r + 1.5)) * k)
    for (let r = 590; r >= 515; r -= 0.25) {
      if (grad(r) > THR) {
        let best = grad(r), br = r
        for (let q = r; q >= r - 5; q -= 0.25) { const v = grad(q); if (v > best) { best = v; br = q } }
        pts.push([C0[0] + Math.cos(a) * br, C0[1] + Math.sin(a) * br, deg, br])
        break
      }
    }
  }
  let c = [...C0], R = 549, rms = 0
  for (let pass = 0; pass < 5; pass++) {
    for (let it = 0; it < 80; it++) {
      let sx = 0, sy = 0, sr = 0
      for (const p of pts) sr += Math.hypot(p[0] - c[0], p[1] - c[1])
      R = sr / pts.length
      for (const p of pts) { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); sx += ((p[0] - c[0]) / d) * (d - R); sy += ((p[1] - c[1]) / d) * (d - R) }
      c = [c[0] + (2 * sx) / pts.length, c[1] + (2 * sy) / pts.length]
    }
    const res = pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) - R)
    rms = Math.sqrt(res.reduce((s, v) => s + v * v, 0) / res.length)
    if (pass < 4) pts = pts.filter((_, i) => Math.abs(res[i]) < Math.max(2 * rms, 1.2))
  }
  if (show) console.log(pts.filter((_, i) => i % 8 === 0).map((p) => `${p[2]}:${(Math.hypot(p[0] - c[0], p[1] - c[1]) - R).toFixed(1)}`).join(' '))
  const top = c[1] - R
  return { cx: +c[0].toFixed(1), cy: +c[1].toFixed(1), r: +R.toFixed(1), top: +top.toFixed(1), left: +(c[0] - R).toFixed(1), right: +(c[0] + R).toFixed(1), points: pts.length, rms: +rms.toFixed(2) }
}
console.log('approved', JSON.stringify(await fit(REF, true)))
for (const f of files) console.log(f, JSON.stringify(await fit(f, true)))
