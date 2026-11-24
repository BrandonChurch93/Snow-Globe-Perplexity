import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, xsArg, range = '840,1100'] = process.argv.slice(2)
const xs = xsArg.split(',').map(Number)
const [y0, y1] = range.split(',').map(Number)
const load = async (f) => await sharp(f).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer()
const A = await load(REF)
const R = still === '-' ? null : await load(still)
const lum = (D, x, y) => { let s = 0, n = 0; for (let yy = y - 6; yy <= y + 6; yy++) for (let xx = x - 25; xx <= x + 25; xx++) { const i = (yy * 2816 + xx) * 3; s += 0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2]; n++ } return s / n }
const edge = (D, x) => { let best = -1e9, at = 0, top = 0, topAt = 0; for (let y = y0; y < y1; y += 2) { const g = lum(D, x, y + 14) - lum(D, x, y - 14); if (g > best) { best = g; at = y } const l = lum(D, x, y); if (l > top) { top = l; topAt = y } } return `${at} (+${best.toFixed(0)}: ${lum(D, x, at - 30).toFixed(0)} to ${lum(D, x, at + 30).toFixed(0)})` }
for (const x of xs) console.log(String(x).padEnd(6), 'approved', edge(A, x).padEnd(26), R ? 'render ' + edge(R, x) : '')
