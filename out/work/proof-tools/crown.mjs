import sharp from 'sharp'
// crown bbox: largest connected component of "leaf" pixels in a search window
export async function crown(file, win, scale = 1) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height
  const [X0, Y0, X1, Y1] = win
  const w = X1 - X0, h = Y1 - Y0
  const m = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y + Y0) * W + x + X0) * 3
    const r = data[i], g = data[i + 1], b = data[i + 2]
    // dark or green: darker than the warm backdrop behind the crown, or green-led
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if ((g > r + 6 && g > b + 6) || lum < 60) m[y * w + x] = 1
  }
  // components
  const lab = new Int32Array(w * h); let best = null, n = 0
  const stack = []
  for (let p = 0; p < w * h; p++) {
    if (!m[p] || lab[p]) continue
    n++; lab[p] = n; stack.push(p)
    let c = 0, x0 = w, y0 = h, x1 = -1, y1 = -1
    while (stack.length) {
      const q = stack.pop(); c++
      const x = q % w, y = (q / w) | 0
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const r = yy * w + xx
        if (m[r] && !lab[r]) { lab[r] = n; stack.push(r) }
      }
    }
    if (!best || c > best.c) best = { c, x0: x0 + X0, y0: y0 + Y0, x1: x1 + X0, y1: y1 + Y0, id: n }
  }
  return { best, m, lab, w, h }
}
if (process.argv[2]) {
  const win = process.argv[3].split(',').map(Number)
  const r = await crown(process.argv[2], win)
  console.log(process.argv[2].split('/').pop(), JSON.stringify(r.best))
  if (process.argv[4]) {
    const o = Buffer.alloc(r.w * r.h)
    for (let p = 0; p < r.w * r.h; p++) o[p] = r.lab[p] === r.best.id ? 255 : r.m[p] ? 90 : 0
    await sharp(o, { raw: { width: r.w, height: r.h, channels: 1 } }).png().toFile(process.argv[4])
  }
}
