// The file for the family check: two kept sounds and a new one, one after another, one second apart (audio/QUESTIONS.md, "Family").
// Run from the repo root: node audio/run/family.mjs <file A> <file B> <file C> [out]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RATE, decodeFile, encodeWav, make } from '../../tools/lib/audio.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const files = process.argv.slice(2, 5).map((f) => path.resolve(f))
if (files.length !== 3) {
  console.error('give three files')
  process.exit(1)
}
const parts = files.map((f) => decodeFile(f, RATE))
const gap = RATE
const n = parts.reduce((s, p) => s + p.L.length, 0) + gap * 2 + Math.round(0.5 * RATE) * 2
const o = make(n, RATE)
let at = Math.round(0.5 * RATE)
for (const p of parts) {
  o.L.set(p.L, at)
  o.R.set(p.R, at)
  at += p.L.length + gap
}
const out = process.argv[5] ? path.resolve(process.argv[5]) : path.join(ROOT, 'out', 'work', 'audio', 'listen', `family-${files.map((f) => path.basename(f, '.wav')).join('+')}.wav`)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, encodeWav(o))
console.log(out, `${(n / RATE).toFixed(2)} s`)
