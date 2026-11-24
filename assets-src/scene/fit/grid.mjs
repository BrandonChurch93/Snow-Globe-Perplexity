import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const still = process.argv[2]
const cols = 11, rows = 6, y1 = 930
async function load(file) { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height } }
const A = await load(REF)
const R = still && still !== '-' ? await load(still) : null
function cell(img, cx, cy) {
  const k = img.w / 2816
  const x0 = Math.round((cx * 2816 / cols) * k), x1 = Math.round(((cx + 1) * 2816 / cols) * k)
  const yy0 = Math.round((cy * y1 / rows) * k), yy1 = Math.round(((cy + 1) * y1 / rows) * k)
  const px = []
  for (let y = yy0; y < yy1; y++) for (let x = x0; x < x1; x++) { const i = (y * img.w + x) * 3; px.push([0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2], img.data[i], img.data[i + 1], img.data[i + 2]]) }
  px.sort((a, b) => a[0] - b[0])
  const lo = px.slice(Math.floor(px.length * 0.15), Math.floor(px.length * 0.3))
  const m = [1, 2, 3].map((c) => Math.round(lo.reduce((s, p) => s + p[c], 0) / lo.length))
  return m.join(',')
}
for (let cy = 0; cy < rows; cy++) {
  let a = '', r = ''
  for (let cx = 0; cx < cols; cx++) { a += cell(A, cx, cy).padEnd(10); if (R) r += cell(R, cx, cy).padEnd(10) }
  console.log('A', a); if (R) console.log('R', r); console.log()
}
