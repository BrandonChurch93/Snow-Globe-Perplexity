import fs from 'node:fs'
import { FRAMES, load, step, event, BOXES, W } from './lib.mjs'
const d = { main: [], tree: [] }
for (const hd of ['main', 'tree']) for (const f of FRAMES) d[hd].push(await load(hd, f))
const out = { crossHead: {}, split: {} }
// 1. head against head, the same frame: share of pixels whose largest channel differs by more than 12
console.log('head against head, same frame, percent of the box over 12 levels')
console.log(`| box | ${FRAMES.join(' | ')} |`)
for (const [name, [x0, y0, w, h]] of Object.entries(BOXES)) {
  const row = FRAMES.map((f, k) => { let n = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (step(d.main[k], d.tree[k], (y * W + x) * 3) > 12) n++; return 100 * n / (w * h) })
  out.crossHead[name] = row
  console.log(`| ${name} | ${row.map((v) => v.toFixed(3)).join(' | ')} |`)
}
// 2. the crown's own pixels: leaves (green-led or near black and not red-led) of frame 1990, grown by 6 px, in box (a) and (b)
const leaf = (buf, i) => { const r = buf[i], g = buf[i + 1], b = buf[i + 2]; const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; return (g >= r && g > b + 3 && lum < 150) || (lum < 40 && g >= r - 2) }
for (const hd of ['main', 'tree']) {
  const [x0, y0, w, h] = BOXES.a
  const m = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (leaf(d[hd][2], ((y + y0) * W + x + x0) * 3)) m[y * w + x] = 1
  // drop specks: keep a leaf pixel only when at least 40 of the 81 pixels about it are leaf
  const dense = new Uint8Array(w * h)
  for (let y = 4; y < h - 4; y++) for (let x = 4; x < w - 4; x++) { let c = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) c += m[(y + dy) * w + x + dx]; if (c >= 40) dense[y * w + x] = 1 }
  const grown = new Uint8Array(w * h)
  const R = 6
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dense[y * w + x]) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) grown[yy * w + xx] = 1 }
  const res = {}
  for (const bn of ['a', 'b']) {
    const [bx, by, bw, bh] = BOXES[bn]
    let inPx = 0, outPx = 0
    const ev = { in: [0, 0, 0, 0], out: [0, 0, 0, 0] }, st = { in: [0, 0, 0, 0, 0], out: [0, 0, 0, 0, 0] }
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
      const on = grown[(y - y0) * w + (x - x0)] ? 'in' : 'out'
      if (on === 'in') inPx++; else outPx++
      const i = (y * W + x) * 3
      for (let k = 1; k < 5; k++) if (event(d[hd][k - 1], d[hd][k], d[hd][k + 1], i)) ev[on][k - 1]++
      for (let k = 0; k < 5; k++) if (step(d[hd][k], d[hd][k + 1], i) > 12) st[on][k]++
    }
    res[bn] = { crownPixels: inPx, otherPixels: outPx, eventsOnCrown: ev.in, eventsElsewhere: ev.out, stepsOnCrown: st.in, stepsElsewhere: st.out }
    console.log(`${hd} box ${bn}: crown (leaves grown by 6 px) ${inPx} px, the rest ${outPx} px. One frame events at 1989..1992 on the crown ${ev.in.join(', ')} px (${ev.in.map((n) => (100 * n / inPx).toFixed(3)).join(', ')} % of the crown's pixels), elsewhere ${ev.out.join(', ')} px (${ev.out.map((n) => (100 * n / outPx).toFixed(3)).join(', ')} %). Steps for the five pairs on the crown ${st.in.map((n) => (100 * n / inPx).toFixed(3)).join(', ')} %, elsewhere ${st.out.map((n) => (100 * n / outPx).toFixed(3)).join(', ')} %`)
  }
  out.split[hd] = res
}
fs.writeFileSync('out/work/proof/extra.json', JSON.stringify(out, null, 1))
