import sharp from 'sharp'
import fs from 'node:fs'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const still = process.argv[2]
const src = fs.readFileSync('src/scene/backdrop.ts', 'utf8')
const rows = [...src.matchAll(/^\s*\[(\d+), (\d+), (\d+), ([A-Z]+), ([\d.]+), ([\d.]+), (-?[\d.]+)(?:, (\d+))?\],$/gm)].map((m) => ({ x: +m[1], y: +m[2], r: +m[3], tone: m[4], shown: +m[5], soft: +m[6], edge: +m[7] }))
const load = async (f) => (await sharp(f).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })).data
const A = await load(REF)
const R = still ? await load(still) : null
const lum = (D, x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= 2816 || y >= 1584) return -1; const i = (y * 2816 + x) * 3; return 0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2] }
const med = (a) => { const s = a.filter((v) => v >= 0).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0 }
function shape(D, d) {
  const prof = []
  for (let q = 0; q <= 100; q += 2) { const ring = []; for (let a = 0; a < 24; a++) ring.push(lum(D, d.x + Math.cos((a * Math.PI) / 12) * q, d.y + Math.sin((a * Math.PI) / 12) * q)); prof.push(med(ring)) }
  const mid = prof[0], far = Math.min(...prof.slice(30))
  const at = (share) => { const v = far + (mid - far) * share; for (let i = 1; i < prof.length; i++) if (prof[i] < v) return 2 * (i - 1 + (prof[i - 1] - v) / Math.max(1e-3, prof[i - 1] - prof[i])); return 100 }
  const r50 = at(0.5), wide = at(0.2) - at(0.8)
  const rim = (prof[Math.round((0.8 * r50) / 2)] - far) / Math.max(1, mid - far) - 1
  return { r50, soft: wide / (0.85 * r50), rim }
}
for (const d of rows) {
  const a = shape(A, d)
  const r = R ? shape(R, d) : null
  console.log(`${String(d.x).padStart(4)},${String(d.y).padStart(4)} ${d.tone.padEnd(5)} ${String(d.shown).padEnd(6)} row r ${d.r} soft ${d.soft} edge ${d.edge} | approved r ${a.r50.toFixed(0)} soft ${a.soft.toFixed(2)} rim ${a.rim.toFixed(2)}${r ? ` | render r ${r.r50.toFixed(0)} soft ${r.soft.toFixed(2)} rim ${r.rim.toFixed(2)}` : ''}`)
}
