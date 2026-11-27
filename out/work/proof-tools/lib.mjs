import sharp from 'sharp'
import fs from 'node:fs'
export const FRAMES = [1988, 1989, 1990, 1991, 1992, 1993]
export const HEADS = { main: 'main-6d459061', tree: 'tree-01f1f0b9' }
export const DIR = 'out/work/shutter'
export const fileOf = (head, f) => `${DIR}/film-b-${String(f).padStart(6, '0')}-uhd-final-${HEADS[head]}.png`
export const OVER = 12
export async function load(head, f) {
  const { data, info } = await sharp(fileOf(head, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.width !== 3840 || info.height !== 2160 || info.channels !== 3) throw new Error(`${fileOf(head, f)} is ${info.width} x ${info.height} x ${info.channels}`)
  return data
}
export const W = 3840, H = 2160
// largest channel difference of two frames at a pixel
export const step = (a, b, i) => Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]))
// a one frame event: in some channel the middle frame stands more than OVER above both neighbours, or more than OVER below both
export function event(p, m, n, i) {
  for (let c = 0; c < 3; c++) {
    const d1 = m[i + c] - p[i + c], d2 = m[i + c] - n[i + c]
    if ((d1 > OVER && d2 > OVER) || (d1 < -OVER && d2 < -OVER)) return true
  }
  return false
}
export const BOXES = JSON.parse(fs.readFileSync(new URL('./boxes.json', import.meta.url), 'utf8'))
