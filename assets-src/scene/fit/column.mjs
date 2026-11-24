import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, xs, ys, steps] = process.argv.slice(2)
const [x0, x1] = xs.split(',').map(Number)
const [y0, y1] = ys.split(',').map(Number)
const step = Number(steps ?? 4)
const load = async (f) => (await sharp(f).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })).data
const A = await load(REF)
const R = await load(still)
const row = (D, y) => { const v = []; for (let yy = y; yy < Math.min(1584, y + step); yy++) for (let x = x0; x < x1; x++) { const i = (yy * 2816 + x) * 3; v.push([0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2], D[i], D[i + 1], D[i + 2]]) } v.sort((p, q) => p[0] - q[0]); const m = v[v.length >> 1], t = v[Math.floor(v.length * 0.95)]; return `${String(Math.round(m[0])).padStart(3)} ${String(Math.round(t[0])).padStart(3)} (${t.slice(1).join(',')})` }
console.log('y     approved med p95 (rgb of p95)        render med p95')
for (let y = y0; y < y1; y += step) console.log(String(y).padStart(4), ' ', row(A, y).padEnd(30), row(R, y))
