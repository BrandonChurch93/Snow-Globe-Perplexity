import sharp from 'sharp'
const file = process.argv[2] ?? process.env.REF ?? 'references/approved/winter-rest.png'
const meta = await sharp(file).metadata()
const K = meta.width / 2816
const S = 8
const w = Math.round(2816 / S), h = Math.round(1584 / S)
const { data } = await sharp(file).removeAlpha().resize(w, h, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer({ resolveWithObject: true })
const full = await sharp(file).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer()
const L = new Float32Array(w * h)
for (let i = 0; i < w * h; i++) L[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]
const inGlobe = (x, y) => Math.hypot(x * S - 1409, y * S - 646) < 600
const out = []
for (let y = 2; y < Math.round(940 / S); y++) for (let x = 2; x < w - 2; x++) {
  if (inGlobe(x, y)) continue
  const v = L[y * w + x]
  if (v < 22) continue
  let top = true
  for (let dy = -3; dy <= 3 && top; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; if (L[yy * w + xx] > v) { top = false; break } }
  if (!top) continue
  const cx = x * S + S / 2, cy = y * S + S / 2
  const px = (X, Y) => { const i = (Math.round(Y) * 2816 + Math.round(X)) * 3; return [full[i], full[i + 1], full[i + 2]] }
  const lum = (X, Y) => { if (X < 0 || Y < 0 || X >= 2816 || Y >= 1584) return 0; const c = px(X, Y); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
  let rs = []
  for (let a = 0; a < 8; a++) { const ca = Math.cos(a * Math.PI / 4), sa = Math.sin(a * Math.PI / 4); let r = 2; const ring = Math.max(lum(cx + ca * 150, cy + sa * 150), 6); const half = (v + 8) / 2; while (r < 120 && lum(cx + ca * r, cy + sa * r) > half) r += 2; rs.push(r) }
  rs.sort((a, b) => a - b)
  const c = px(cx, cy)
  out.push({ x: cx, y: cy, r: rs[3], rmin: rs[0], rmax: rs[7], c, v: Math.round(v) })
}
out.sort((a, b) => b.v - a.v)
for (const o of out) console.log(`${String(o.x).padStart(5)} ${String(o.y).padStart(5)}  r ${String(o.r).padStart(3)} (${o.rmin}-${o.rmax})  rgb ${o.c.join(',').padEnd(12)} L ${o.v}`)
console.log(out.length, 'left', out.filter((o) => o.x < 1408).length, 'right', out.filter((o) => o.x >= 1408).length)
