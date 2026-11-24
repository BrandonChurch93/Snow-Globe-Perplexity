import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseArgs, rel, readJson, loadConfig, ROOT } from './lib/paths.mjs'
import { checkDisk, recordMatches, writeWithRecord } from './lib/page.mjs'
import { engineHash, fileSha, hashList } from './lib/hashes.mjs'
import { machineId, outWork } from './lib/browser.mjs'
import { analyse } from './lib/beats.mjs'

const MAX_DECODED_BYTES = 2 ** 31 - 1

const args = parseArgs(process.argv.slice(2))
if (!args.file || args.file === true) {
  console.error('usage: npm run audiomap -- --file F [--approved] [--name N] [--force]')
  process.exit(1)
}
const cfg = loadConfig()
const file = path.resolve(String(args.file))
if (!fs.existsSync(file)) {
  console.error(`no such file: ${file}`)
  process.exit(1)
}
checkDisk()

const inside = !path.relative(ROOT, file).startsWith('..')
const shown = inside ? path.relative(ROOT, file).split(path.sep).join('/') : path.basename(file)
const name = args.name && args.name !== true ? String(args.name) : path.basename(file).replace(/\.[^.]+$/, '')
const out = outWork('audio', 'maps', `${name}.json`)
const approved = rel('cut', 'AUDIO-MAP.json')
const sha256 = fileSha(file)
const toolHash = hashList([rel('tools', 'audiomap.mjs'), rel('tools', 'lib', 'beats.mjs')])

function decode() {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(cfg.audio.sampleRate), '-f', 'f32le', '-'], { maxBuffer: MAX_DECODED_BYTES })
  if (r.error) throw new Error(`ffmpeg could not be run: ${r.error.message}`)
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${shown}: ${String(r.stderr).trim()}`)
  const bytes = r.stdout
  const samples = new Float32Array(Math.floor(bytes.length / 4))
  for (let i = 0; i < samples.length; i++) samples[i] = bytes.readFloatLE(i * 4)
  return samples
}

const reusable = () => {
  if (args.force === true || !recordMatches(out, {})) return false
  const r = readJson(`${out}.json`)
  return r.sha256 === sha256 && r.toolHash === toolHash && r.file === shown
}

let map
let reused = false
if (reusable()) {
  map = readJson(out)
  reused = true
} else {
  const t0 = Date.now()
  const samples = decode()
  if (!samples.length) throw new Error(`${shown} holds no sound`)
  const found = analyse(samples, cfg.audio.sampleRate, { beatsPerBar: cfg.film.beatsPerBar, defaultBpm: cfg.film.defaultBpm })
  const { version, ...rest } = found
  map = { version, file: shown, sha256, ...rest }
  const ffmpeg = String(spawnSync('ffmpeg', ['-version']).stdout).split('\n')[0]
  writeWithRecord(out, JSON.stringify(map, null, 2) + '\n', { engineHash: engineHash(), toolHash, sha256, file: shown, sampleRate: cfg.audio.sampleRate, ffmpeg, machine: machineId(), seconds: (Date.now() - t0) / 1000 })
}
if (args.approved === true) {
  fs.mkdirSync(path.dirname(approved), { recursive: true })
  fs.writeFileSync(approved, JSON.stringify(map, null, 2) + '\n')
}

const c = map.checks
const where = [path.relative(ROOT, out), ...(args.approved === true ? [path.relative(ROOT, approved)] : [])].join(' and ')
console.log(`${reused ? 'reused' : 'mapped'} ${shown}: ${map.seconds.toFixed(2)} s, ${map.method}, ${map.bpm} beats a minute, ${map.beats.length} beats, ${map.bars} bars of ${map.beatsPerBar}`)
for (const t of c.tries) console.log(`try, ${t.settings}: autocorrelation ${t.autocorrelation}, comb ${t.comb}, ${t.agree ? 'agree' : 'do not agree'}, spacing ${t.steady ? 'steady' : 'not steady'}`)
if (map.method === 'grid') console.log(`grid: ${c.reason}. The tempo fits the length in ${map.bars} whole bars`)
else console.log(`bar lines by ${c.barPhase.method}, confidence ${c.barPhase.confidence}. First at ${map.barLines[0]} s`)
console.log(`sections: ${map.sections.map((s) => `${s.start.toFixed(2)} to ${s.end.toFixed(2)} s at ${s.loudness} LUFS`).join(', ')}`)
console.log(`loudest section starts at ${map.loudestSectionStart} s`)
console.log(`written to ${where}`)
