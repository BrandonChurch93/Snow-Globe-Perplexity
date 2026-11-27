import fs from 'node:fs'
import { FRAMES, load, step, event, BOXES, W } from './lib.mjs'
// the lit edge alone: pixels of box (b) that are bright and red-led (cream, not the green-led lights) in frame 1990 and lie on the crown (leaves grown by 6 px)
const leaf = (buf, i) => { const r = buf[i], g = buf[i + 1], b = buf[i + 2]; const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; return (g >= r && g > b + 3 && lum < 150) || (lum < 40 && g >= r - 2) }
const out = {}
for (const hd of ['main', 'tree']) {
  const fr = []
  for (const f of FRAMES) fr.push(await load(hd, f))
  const [x0, y0, w, h] = BOXES.b
  const P = 12, ww = w + 2 * P, hh = h + 2 * P
  const m = new Uint8Array(ww * hh)
  for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) if (leaf(fr[2], ((y + y0 - P) * W + x + x0 - P) * 3)) m[y * ww + x] = 1
  const dense = new Uint8Array(ww * hh)
  for (let y = 4; y < hh - 4; y++) for (let x = 4; x < ww - 4; x++) { let c = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) c += m[(y + dy) * ww + x + dx]; if (c >= 40) dense[y * ww + x] = 1 }
  const grown = new Uint8Array(ww * hh)
  for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) if (dense[y * ww + x]) for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < ww && yy < hh) grown[yy * ww + xx] = 1 }
  let n = 0; const st = [0, 0, 0, 0, 0], ev = [0, 0, 0, 0]
  // lit in all six frames (so a passing puff or light does not make the set), and lit in frame 1990 alone
  let nAll = 0; const stAll = [0, 0, 0, 0, 0], evAll = [0, 0, 0, 0]
  const lit = (buf, i) => { const r = buf[i], g = buf[i + 1], b = buf[i + 2]; return 0.2126 * r + 0.7152 * g + 0.0722 * b > 110 && r > g + 4 && g > b }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!grown[(y + P) * ww + x + P]) continue
    const i = ((y + y0) * W + x + x0) * 3
    if (!lit(fr[2], i)) continue
    n++
    for (let k = 0; k < 5; k++) if (step(fr[k], fr[k + 1], i) > 12) st[k]++
    for (let k = 1; k < 5; k++) if (event(fr[k - 1], fr[k], fr[k + 1], i)) ev[k - 1]++
    if (fr.every((b) => lit(b, i))) { nAll++; for (let k = 0; k < 5; k++) if (step(fr[k], fr[k + 1], i) > 12) stAll[k]++; for (let k = 1; k < 5; k++) if (event(fr[k - 1], fr[k], fr[k + 1], i)) evAll[k - 1]++ }
  }
  out[hd] = { litPixels1990: n, steps: st, events: ev, litInAllSix: nAll, stepsAll: stAll, eventsAll: evAll }
  console.log(`${hd} box b, lit edge: ${n} px lit in frame 1990 (${(100 * n / (w * h)).toFixed(2)} % of the box); of them stepping in the five pairs ${st.join(', ')} px (${st.map((v) => (100 * v / n).toFixed(2)).join(', ')} %), one frame events at 1989..1992 ${ev.join(', ')} px. Lit in all six frames ${nAll} px (${(100 * nAll / n).toFixed(1)} % of the lit); of them stepping ${stAll.join(', ')} px, events ${evAll.join(', ')} px`)
}
fs.writeFileSync('out/work/proof/lit-edge.json', JSON.stringify(out, null, 1))
