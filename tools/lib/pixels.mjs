import sharp from 'sharp'

export async function pixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data }
}

export function diff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { sameSize: false, identical: false, differing: -1, maxDiff: 255, psnr: 0 }
  const n = a.width * a.height
  let differing = 0
  let maxDiff = 0
  let sq = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const d0 = Math.abs(a.data[o] - b.data[o])
    const d1 = Math.abs(a.data[o + 1] - b.data[o + 1])
    const d2 = Math.abs(a.data[o + 2] - b.data[o + 2])
    const m = Math.max(d0, d1, d2)
    if (m > 0) {
      differing++
      if (m > maxDiff) maxDiff = m
      sq += d0 * d0 + d1 * d1 + d2 * d2
    }
  }
  const psnr = sq === 0 ? Infinity : 10 * Math.log10((255 * 255) / (sq / (n * 3)))
  return { sameSize: true, identical: differing === 0, differing, maxDiff, psnr }
}

export async function compareFiles(fileA, fileB) {
  return diff(await pixels(fileA), await pixels(fileB))
}

export async function stats(file) {
  const p = await pixels(file)
  const n = p.width * p.height
  let sum = 0
  let min = 255
  let max = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const l = 0.2126 * p.data[o] + 0.7152 * p.data[o + 1] + 0.0722 * p.data[o + 2]
    sum += l
    if (l < min) min = l
    if (l > max) max = l
  }
  return { width: p.width, height: p.height, mean: sum / n, min, max }
}
