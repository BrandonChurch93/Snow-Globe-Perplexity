import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, ...boxes] = process.argv.slice(2)
const med = (a) => { const s = Array.from(a).sort((x, y) => x - y); return s[s.length >> 1] }
const pct = (a, p) => { const s = Array.from(a).sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
async function stats(file, box, k) {
  const r = { left: Math.round(box[0] * k), top: Math.round(box[1] * k), width: Math.max(1, Math.round((box[2] - box[0]) * k)), height: Math.max(1, Math.round((box[3] - box[1]) * k)) }
  const { data } = await sharp(file).removeAlpha().extract(r).raw().toBuffer({ resolveWithObject: true })
  const ch = [[], [], []]
  const lum = []
  for (let i = 0; i < data.length; i += 3) { ch[0].push(data[i]); ch[1].push(data[i + 1]); ch[2].push(data[i + 2]); lum.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) }
  return { med: ch.map(med), p10: Math.round(pct(lum, 0.1)), p50: Math.round(pct(lum, 0.5)), p90: Math.round(pct(lum, 0.9)), p98: Math.round(pct(lum, 0.98)) }
}
const meta = still === '-' ? null : await sharp(still).metadata()
for (const b of boxes) {
  const [name, s] = b.split('=')
  const box = s.split(',').map(Number)
  const a = await stats(REF, box, 1)
  const r = meta ? await stats(still, box, meta.width / 2816) : null
  console.log(name.padEnd(14), 'approved', a.med.join(',').padEnd(12), `L p10 ${a.p10} p50 ${a.p50} p90 ${a.p90} p98 ${a.p98}`.padEnd(34), r ? `| render ${r.med.join(',').padEnd(12)} L p10 ${r.p10} p50 ${r.p50} p90 ${r.p90} p98 ${r.p98}` : '')
}
