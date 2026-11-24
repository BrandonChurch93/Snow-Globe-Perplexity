import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, ...spots] = process.argv.slice(2)
const load = async (f) => (await sharp(f).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })).data
const A = await load(REF)
const R = await load(still)
const ring = (D, cx, cy, r0, r1) => {
  let s = 0, n = 0
  for (let y = Math.round(cy - r1); y <= Math.round(cy + r1); y++) for (let x = Math.round(cx - r1); x <= Math.round(cx + r1); x++) {
    if (x < 0 || y < 0 || x >= 2816 || y >= 1584) continue
    const q = Math.hypot(x - cx, y - cy)
    if (q < r0 || q >= r1) continue
    const i = (y * 2816 + x) * 3
    s += 0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2]
    n++
  }
  return n ? s / n : 0
}
for (const spot of spots) {
  const [cx, cy] = spot.split(',').map(Number)
  const a = [], r = []
  for (let q = 0; q < 84; q += 4) { a.push(Math.round(ring(A, cx, cy, q, q + 4))); r.push(Math.round(ring(R, cx, cy, q, q + 4))) }
  console.log(`${spot}\n  approved ${a.map((v) => String(v).padStart(3)).join(' ')}\n  render   ${r.map((v) => String(v).padStart(3)).join(' ')}`)
}
