import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const W = 2816, H = 1584
const args = process.argv.slice(2)
const [cx, cy, r] = args[1].split(',').map(Number)
const [a0, a1, da] = args[2].split(',').map(Number)
const [s0, s1, ds] = args[3].split(',').map(Number)
const pct = Number(args[4] ?? 15)
const mode = args[5] ?? 'lum'
const season = args[6] ?? 'winter'
const f = args[0] === 'approved' ? path.join(root, `references/approved/${season}-rest.png`) : args[0] === 'shake' ? path.join(root, `references/approved/${season}-shake.png`) : args[0]
const buf = await sharp(f).removeAlpha().resize({ width: W, height: H, fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer()
const cells = new Map()
for (let y = Math.max(0, Math.floor(cy - r * 1.02)); y < Math.min(H, cy + r * 1.02); y++) for (let x = Math.max(0, Math.floor(cx - r * 1.02)); x < Math.min(W, cx + r * 1.02); x++) {
  const s = Math.hypot(x - cx, y - cy) / r
  if (s < s0 || s >= s1) continue
  let a = Math.atan2(cy - y, x - cx) * 180 / Math.PI
  if (a < -90) a += 360
  if (a < a0 || a >= a1) continue
  const key = `${Math.floor((a - a0) / da)}:${Math.floor((s - s0) / ds)}`
  const o = (y * W + x) * 3
  let list = cells.get(key)
  if (!list) cells.set(key, (list = []))
  list.push([0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2], buf[o], buf[o + 1], buf[o + 2]])
}
const na = Math.round((a1 - a0) / da), ns = Math.round((s1 - s0) / ds)
console.log(`${args[0].split('/').pop()}  centre ${cx},${cy} r ${r}  percentile ${pct}  rows: share, columns: angle`)
console.log('share  ' + Array.from({ length: na }, (_, i) => String(a0 + i * da).padStart(mode === 'rgb' ? 12 : 5)).join(''))
for (let j = ns - 1; j >= 0; j--) {
  let line = (s0 + j * ds).toFixed(3) + '  '
  for (let i = 0; i < na; i++) {
    const list = cells.get(`${i}:${j}`)
    if (!list) { line += ''.padStart(mode === 'rgb' ? 12 : 5); continue }
    list.sort((p, q) => p[0] - q[0])
    const v = list[Math.floor((list.length - 1) * pct / 100)]
    line += mode === 'rgb' ? `${v[1]},${v[2]},${v[3]}`.padStart(12) : v[0].toFixed(0).padStart(5)
  }
  console.log(line)
}
