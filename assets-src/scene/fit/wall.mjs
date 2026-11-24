import sharp from 'sharp'
const REF = process.env.REF ?? 'references/approved/winter-rest.png'
const [still, ...boxes] = process.argv.slice(2)
const load = async (f) => (await sharp(f).removeAlpha().resize(2816, 1584, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })).data
const A = await load(REF)
const R = await load(still)
const low = (D, b, share) => [0, 1, 2].map((c) => { const v = []; for (let y = b[1]; y < b[3]; y += 2) for (let x = b[0]; x < b[2]; x += 2) v.push(D[(y * 2816 + x) * 3 + c]); v.sort((p, q) => p - q); return v[Math.floor(v.length * share)] })
for (const spec of boxes) {
  const [name, box] = spec.split('=')
  const b = box.split(',').map(Number)
  console.log(`${name.padEnd(8)} low fifth: approved ${low(A, b, 0.2).join(',').padEnd(9)} render ${low(R, b, 0.2).join(',').padEnd(9)} | median: approved ${low(A, b, 0.5).join(',').padEnd(9)} render ${low(R, b, 0.5).join(',')}`)
}
