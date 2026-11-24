import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
import fs from 'node:fs'
const still = process.argv[2]
const src = fs.readFileSync('src/scene/backdrop.ts', 'utf8')
const tones = { COOL: 0.05, BLUE: 0.35, PALE: 0.65, WARM: 0.75, WHITE: 0.85, AMBER: 0.95 }
const rows = [...src.matchAll(/^\s*\[(\d+), (\d+), (\d+), ([A-Z]+), ([\d.]+), ([\d.]+), (-?[\d.]+)(?:, (\d+))?\],$/gm)].map((m) => ({ x: +m[1], y: +m[2], r: +m[3], tone: m[4], shown: +m[5], soft: +m[6], edge: +m[7] }))
const aces = (x) => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)))
const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
const code = (x) => 255 * enc(aces(x))
const inv = (c) => { let lo = 0, hi = 50; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (code(m) < c) lo = m; else hi = m } return lo }
const load = async (f) => { const m = await sharp(f).metadata(); const { data } = await sharp(f).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }); return data }
const A = await load(REF)
const R = await load(still)
const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1] }
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
function at(D, d, from, to) {
  const ch = [[], [], []]
  for (let y = Math.max(0, Math.round(d.y - d.r * to)); y <= Math.min(1583, Math.round(d.y + d.r * to)); y++) for (let x = Math.max(0, Math.round(d.x - d.r * to)); x <= Math.min(2815, Math.round(d.x + d.r * to)); x++) {
    const q = Math.hypot(x - d.x, y - d.y) / d.r
    if (q < from || q > to) continue
    const i = (y * 2816 + x) * 3
    ch[0].push(D[i]); ch[1].push(D[i + 1]); ch[2].push(D[i + 2])
  }
  return ch
}
for (const d of rows) {
  const a = at(A, d, 0, 0.4).map(med), r = at(R, d, 0, 0.4).map(med)
  const wa = at(A, d, 1.35, 2).map((c) => pct(c, 0.15)), wr = at(R, d, 1.35, 2).map((c) => pct(c, 0.15))
  const la = a.map(inv), lr = r.map(inv), lwa = wa.map(inv), lwr = wr.map(inv)
  const g = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
  const ratio = (g(la) - g(lwa)) / Math.max(1e-4, g(lr) - g(lwr))
  console.log(`${String(d.x).padStart(4)},${String(d.y).padStart(4)} ${d.tone.padEnd(5)} shown ${String(d.shown).padEnd(5)} A ${a.join(',').padEnd(11)} R ${r.join(',').padEnd(11)} wallA ${wa.join(',').padEnd(9)} wallR ${wr.join(',').padEnd(9)} ratio ${ratio.toFixed(2)} -> ${(d.shown * ratio).toPrecision(2)}`)
}
