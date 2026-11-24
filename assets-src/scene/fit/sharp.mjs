import sharp from 'sharp'
const [, , src, ...boxes] = process.argv
const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height
const L = new Float32Array(W * H)
for (let i = 0; i < W * H; i++) L[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]
const pct = (a, p) => { const s = Float32Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
for (const b of boxes) {
  const [name, box] = b.split('=')
  const [x0, y0, x1, y1] = box.split(',').map((v) => Math.round((Number(v) * W) / 2816))
  const g = [], l = []
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    const i = y * W + x
    const gx = (L[i + 1] - L[i - 1]) / 2, gy = (L[i + W] - L[i - W]) / 2
    g.push(Math.hypot(gx, gy)); l.push(L[i])
  }
  const span = pct(l, 0.99) - pct(l, 0.01)
  const slope = pct(g, 0.995)
  console.log(`${name.padEnd(12)} contrast ${span.toFixed(0)} steepest slope ${slope.toFixed(1)} per px, edge width ${((span / Math.max(slope, 1e-3)) * 2816 / W).toFixed(1)} px of 2816`)
}
