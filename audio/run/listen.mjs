// The copy of a take that the listener hears: the take after the level chain of its class, exactly as `--keep` would make it. Changes no record.
// Run from the repo root: node audio/run/listen.mjs <cue> [take] [--file F] [key=value ...]
// key=value passes a chain option (fadeInMs, fadeOutMs, lowCutHz, trimDb, capSeconds; capSeconds=null for no cap).
// A copy shorter than a quarter of a second gets half a second of silence before it and one second after it (audio/QUESTIONS.md).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RATE, TAKES, classOf, chainOf, cueSeconds, decodeFile, encodeWav, keepChain, measure, make, readLedger } from '../../tools/lib/audio.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const cue = argv.shift()
let take = null
let file = null
const opt = {}
while (argv.length) {
  const a = argv.shift()
  if (a === '--file') file = path.resolve(argv.shift())
  else if (a.includes('=')) {
    const [k, v] = a.split('=')
    opt[k] = v === 'null' ? null : Number(v)
  } else take = Number(a)
}
if (!file) {
  const list = readLedger().takes.filter((t) => t.cue === cue)
  if (!list.length) {
    console.error(`no take is filed for ${cue}`)
    process.exit(1)
  }
  take = take ?? list[list.length - 1].take
  file = path.join(TAKES, cue, `take-${take}.wav`)
}
const cls = classOf(cue)
if (!('capSeconds' in opt)) opt.capSeconds = chainOf(cls).cap ? cueSeconds(cue) : null
const done = keepChain(decodeFile(file, RATE), cls, opt)
let a = done.audio
if (a.L.length / RATE < 0.25) {
  const o = make(a.L.length + Math.round(1.5 * RATE), RATE)
  o.L.set(a.L, Math.round(0.5 * RATE))
  o.R.set(a.R, Math.round(0.5 * RATE))
  a = o
}
const dir = path.join(ROOT, 'out', 'work', 'audio', 'listen')
fs.mkdirSync(dir, { recursive: true })
const out = path.join(dir, `${cue}-take-${take ?? 'file'}.wav`)
fs.writeFileSync(out, encodeWav(a))
const m = measure(done.audio)
console.log(out)
for (const s of done.steps) console.log(`  ${s}`)
console.log(JSON.stringify({ class: cls, seconds: m.seconds, soundSeconds: m.soundSeconds, lufs: m.lufs, soundLufs: m.soundLufs, peakDb: m.peakDb, tailDb: m.tailDb, events: m.events, spectrum: m.spectrum, loop: done.loop }))
