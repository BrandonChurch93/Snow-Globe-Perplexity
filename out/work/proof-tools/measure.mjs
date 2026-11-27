import fs from 'node:fs'
import { FRAMES, load, step, event, BOXES, W } from './lib.mjs'
const head = process.argv[2]
const fr = []
for (const f of FRAMES) fr.push(await load(head, f))
const out = { head, over: 12, boxes: {} }
for (const [name, [x0, y0, w, h]] of Object.entries(BOXES)) {
  const px = w * h
  const steps = [], events = []
  for (let k = 0; k < 5; k++) {
    let n = 0
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (step(fr[k], fr[k + 1], (y * W + x) * 3) > 12) n++
    steps.push({ pair: `${FRAMES[k]}-${FRAMES[k + 1]}`, pixels: n, percent: 100 * n / px })
  }
  for (let k = 1; k < 5; k++) {
    let n = 0
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (event(fr[k - 1], fr[k], fr[k + 1], (y * W + x) * 3)) n++
    events.push({ frame: FRAMES[k], pixels: n, percent: 100 * n / px })
  }
  out.boxes[name] = { box: [x0, y0, w, h], pixels: px, steps, events, stepMean: steps.reduce((s, r) => s + r.percent, 0) / 5, eventMean: events.reduce((s, r) => s + r.percent, 0) / 4 }
}
fs.writeFileSync(`out/work/proof/measures-${head}.json`, JSON.stringify(out, null, 1))
const f3 = (v) => v.toFixed(3)
console.log(`head ${head}: percent of the box's pixels`)
console.log(`| box | x,y,w,h | step ${out.boxes.a.steps.map((s) => s.pair).join(' | step ')} | mean | event ${out.boxes.a.events.map((s) => s.frame).join(' | event ')} | mean |`)
for (const [name, b] of Object.entries(out.boxes)) console.log(`| ${name} | ${b.box.join(',')} | ${b.steps.map((s) => f3(s.percent)).join(' | ')} | ${f3(b.stepMean)} | ${b.events.map((s) => f3(s.percent)).join(' | ')} | ${f3(b.eventMean)} |`)
