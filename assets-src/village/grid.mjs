import sharp from 'sharp'
const [src, x0, y0, w, h, scale, step, out] = process.argv.slice(2)
const X0 = +x0, Y0 = +y0, W = +w, H = +h, S = +scale, ST = +step
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">`
for (let x = Math.ceil(X0 / ST) * ST; x < X0 + W; x += ST) {
  const px = (x - X0) * S
  svg += `<line x1="${px}" y1="0" x2="${px}" y2="${H * S}" stroke="rgba(255,255,0,0.35)" stroke-width="1"/><text x="${px + 2}" y="12" font-size="12" fill="#ff0" font-family="monospace">${x}</text>`
}
for (let y = Math.ceil(Y0 / ST) * ST; y < Y0 + H; y += ST) {
  const py = (y - Y0) * S
  svg += `<line x1="0" y1="${py}" x2="${W * S}" y2="${py}" stroke="rgba(0,255,255,0.35)" stroke-width="1"/><text x="2" y="${py - 2}" font-size="12" fill="#0ff" font-family="monospace">${y}</text>`
}
svg += '</svg>'
await sharp(src).extract({ left: X0, top: Y0, width: W, height: H }).resize(W * S, H * S, { kernel: 'lanczos3' }).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 90 }).toFile(out)
