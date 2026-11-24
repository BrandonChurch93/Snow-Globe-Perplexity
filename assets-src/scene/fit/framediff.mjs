import sharp from 'sharp'
const [a, b, boxs, ...frames] = process.argv.slice(2)
const box = boxs.split(',').map(Number)
const cut = { left: box[0], top: box[1], width: box[2] - box[0], height: box[3] - box[1] }
for (const n of frames) {
  const name = `test-${String(n).padStart(6, '0')}.png`
  const A = await sharp(`${a}/${name}`).removeAlpha().extract(cut).raw().toBuffer()
  const B = await sharp(`${b}/${name}`).removeAlpha().extract(cut).raw().toBuffer()
  let sum = 0
  let most = 0
  let lumA = 0
  let lumB = 0
  for (let i = 0; i < A.length; i++) {
    const d = Math.abs(A[i] - B[i])
    sum += d
    if (d > most) most = d
    lumA += A[i]
    lumB += B[i]
  }
  console.log(n, 'mean abs', (sum / A.length).toFixed(3), 'most', most, 'mean', (lumA / A.length).toFixed(2), (lumB / A.length).toFixed(2))
}
