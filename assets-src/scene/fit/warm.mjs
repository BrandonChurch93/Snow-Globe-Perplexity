import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, xs, ys, steps] = process.argv.slice(2)
const [x0, x1] = xs.split(',').map(Number)
const [y0, y1] = ys.split(',').map(Number)
const step = Number(steps ?? 6)
const load = async (f) => (await sharp(f).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })).data
const A = await load(REF)
const R = await load(still)
const row = (D, y) => { const v = []; for (let yy = y; yy < Math.min(1584, y + step); yy++) for (let x = x0; x < x1; x++) { const i = (yy * 2816 + x) * 3; if (D[i] - D[i + 2] > Number(process.env.THR ?? 18)) v.push([0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2], D[i], D[i + 1], D[i + 2]]) } v.sort((p, q) => p[0] - q[0]); if (!v.length) return 'none'; const t = v[Math.floor(v.length * 0.9)], m = v[v.length >> 1]; return `${String(v.length).padStart(5)} warm, med ${Math.round(m[0])}, p90 ${Math.round(t[0])} (${t.slice(1).join(',')})` }
for (let y = y0; y < y1; y += step) console.log(String(y).padStart(4), ' ', row(A, y).padEnd(44), row(R, y))
