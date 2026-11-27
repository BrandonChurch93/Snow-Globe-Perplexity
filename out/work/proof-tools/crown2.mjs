import sharp from 'sharp'
const [file, winS, outPng] = process.argv.slice(2)
const [X0, Y0, X1, Y1] = winS.split(',').map(Number)
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, w = X1 - X0, h = Y1 - Y0
const m = new Uint8Array(w * h)
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = ((y + Y0) * W + x + X0) * 3
  const r = data[i], g = data[i + 1], b = data[i + 2]
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if ((g >= r && g > b + 3 && lum < 150) || (lum < 40 && g >= r - 2)) m[y * w + x] = 1
}
const lab = new Int32Array(w * h); const comps = []; let n = 0; const stack = []
for (let p = 0; p < w * h; p++) {
  if (!m[p] || lab[p]) continue
  n++; lab[p] = n; stack.push(p)
  const c = { id: n, c: 0, x0: w, y0: h, x1: -1, y1: -1 }
  while (stack.length) {
    const q = stack.pop(); c.c++
    const x = q % w, y = (q / w) | 0
    if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      const r = yy * w + xx
      if (m[r] && !lab[r]) { lab[r] = n; stack.push(r) }
    }
  }
  comps.push(c)
}
comps.sort((a, b) => b.c - a.c)
for (const c of comps.slice(0, 5)) console.log(`component of ${c.c} px: x ${c.x0 + X0} to ${c.x1 + X0}, y ${c.y0 + Y0} to ${c.y1 + Y0}`)
if (outPng) {
  const o = Buffer.alloc(w * h)
  for (let p = 0; p < w * h; p++) o[p] = lab[p] === comps[0].id ? 255 : m[p] ? 90 : 0
  await sharp(o, { raw: { width: w, height: h, channels: 1 } }).resize(Math.round(w / 2)).png().toFile(outPng)
}
