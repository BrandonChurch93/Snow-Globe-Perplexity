import sharp from 'sharp'
const [a, b, thr] = process.argv.slice(2)
const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const B = await sharp(b).removeAlpha().raw().toBuffer()
const { width: w, height: h } = A.info
const gx = 16
const gy = 9
const grid = Array.from({ length: gy }, () => new Array(gx).fill(0))
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (y * w + x) * 3
  const d = Math.max(Math.abs(A.data[i] - B[i]), Math.abs(A.data[i + 1] - B[i + 1]), Math.abs(A.data[i + 2] - B[i + 2]))
  if (d > Number(thr ?? 3)) grid[Math.floor((y * gy) / h)][Math.floor((x * gx) / w)]++
}
for (const row of grid) console.log(row.map((v) => String(v).padStart(6)).join(''))
