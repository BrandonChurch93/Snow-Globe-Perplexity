import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { engineHash, fileSha } from './lib/hashes.mjs'
import { freeDiskGb } from './lib/browser.mjs'
import { limits } from './lib/compose.mjs'
import { addLook } from './lib/looks.mjs'
import { cfg, RATE, KEPT, TAKES, PUBLIC_AUDIO, classOf, seasonOf, chainOf, cueSeconds, isLoop, decodeFile, encodeWav, ffmpeg, ffmpegLoudness, keepChain, measure, peak, readKept, readLedger, writeLedger, currentRound, writePack, round, seconds } from './lib/audio.mjs'

const args = parseArgs(process.argv.slice(2))
const text = (k) => (args[k] !== undefined && args[k] !== true ? String(args[k]) : null)
const show = (f) => path.relative(rel(), f).split(path.sep).join('/')
const fail = (message) => {
  console.error(message)
  process.exit(1)
}
const usage = () => {
  console.log(
    [
      'npm run sound -- --cue ID --file F [--prompt TEXT] [--settings JSON] [--line TEXT] [--tool TEXT] [--round NAME]   file one take',
      'npm run sound -- --cue ID [--take N] --prompt TEXT | --settings JSON | --line TEXT | --tool TEXT               add to a take that is filed',
      'npm run sound -- --answers FILE [--cue ID] [--take N]                                                         the listener answers, to the newest take',
      'npm run sound -- --cue ID --keep [--take N] [--why TEXT] [--fade-in MS] [--fade-out MS] [--low-cut HZ] [--trim-db DB] [--cap SECONDS|none]',
      'npm run sound -- --pack | --sheet | --list',
    ].join('\n'),
  )
}

function checkDisk() {
  const free = freeDiskGb()
  if (free < cfg.sandbox.minFreeDiskGb) fail(`only ${free.toFixed(1)} GB of disk is free, under sandbox.minFreeDiskGb`)
}

function probe(file) {
  const r = ffmpeg(['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,bit_rate', '-of', 'json', file], { binary: 'ffprobe' })
  try {
    const j = JSON.parse(r.stdout.toString('utf8'))
    const s = j.streams?.[0] ?? {}
    return { codec: s.codec_name ?? null, sampleRate: Number(s.sample_rate) || null, channels: s.channels ?? null, seconds: round(Number(j.format?.duration), 3), kbps: j.format?.bit_rate ? Math.round(Number(j.format.bit_rate) / 1000) : null }
  } catch {
    return null
  }
}

function fits(id, m) {
  const want = cueSeconds(id)
  if (want === null) return { wantSeconds: null, note: 'no length in audio.sfx for this cue' }
  const loop = isLoop(id)
  const ok = loop ? m.soundSeconds >= want * 0.75 : m.soundSeconds <= want * 1.5 && m.soundSeconds >= Math.min(want * 0.4, want - 0.05)
  const note = ok ? 'the sound fits the length of its cue' : loop ? `the sound is ${m.soundSeconds} s, short for a loop of ${want} s` : m.soundSeconds > want ? `the sound is ${m.soundSeconds} s, long for a cue of ${want} s: the chain cuts it to length` : `the sound is ${m.soundSeconds} s, short for a cue of ${want} s`
  return { wantSeconds: want, soundSeconds: m.soundSeconds, ok, note }
}

function parseSettings(raw) {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return fail('--settings is not valid JSON')
  }
}

const takesOf = (ledger, cue) => ledger.takes.filter((t) => t.cue === cue)
const takeFile = (cue, n) => path.join(TAKES, cue, `take-${n}.wav`)

function saveTake(ledger, entry) {
  const i = ledger.takes.findIndex((t) => t.cue === entry.cue && t.take === entry.take)
  if (i < 0) ledger.takes.push(entry)
  else ledger.takes[i] = entry
  writeLedger(ledger)
  const file = takeFile(entry.cue, entry.take)
  if (fs.existsSync(file)) writeJson(`${file}.json`, { ...entry, engineHash: engineHash() })
}

function pickTake(ledger, cue, n) {
  const list = cue ? takesOf(ledger, cue) : ledger.takes
  if (!list.length) fail(cue ? `no take is filed for ${cue}` : 'no take is filed')
  if (n === null) return list[list.length - 1]
  return list.find((t) => t.take === Number(n)) ?? fail(`${cue ?? 'the ledger'} has no take ${n}`)
}

function describe(m) {
  const b = m.spectrum.bands
  const share = (v) => `${Math.round(v * 100)}%`
  return [
    `length ${m.seconds} s, sound ${m.soundSeconds} s, silence in front ${m.silenceFrontSeconds} s, at the end ${m.silenceEndSeconds} s`,
    `peak ${m.peakDb} dB, true peak ${m.truePeakDb} dB, loudness ${m.lufs} LUFS, tail ${m.tailDb} dB, separate events ${m.events}`,
    `spectrum: centre ${m.spectrum.centroidHz} Hz · under 60 Hz ${share(b.sub)} · 60 to 250 ${share(b.low)} · 250 to 1k ${share(b.lowMid)} · 1k to 4k ${share(b.mid)} · 4k to 10k ${share(b.high)} · over 10k ${share(b.air)}`,
  ]
}

function fileTake() {
  const cue = text('cue') ?? fail('give --cue ID')
  const music = ['music-one-piece', ...cfg.seasons.map((s) => `music-${s}`)]
  if (!cfg.audio.sfx.some((s) => s.id === cue) && !music.includes(cue)) fail(`no such cue: ${cue}. Known: ${[...cfg.audio.sfx.map((s) => s.id), ...music].join(', ')}`)
  const src = path.resolve(text('file'))
  if (!fs.existsSync(src)) fail(`no such file: ${src}`)
  checkDisk()
  const ledger = readLedger()
  const roundName = text('round') ?? currentRound()
  const all = takesOf(ledger, cue)
  const sourceSha = fileSha(src)
  const twin = all.find((t) => t.source.sha256 === sourceSha)
  if (twin) fail(`this file is already filed as take ${twin.take} of ${cue}. Nothing was counted.`)
  const inRound = all.filter((t) => t.round === roundName).length
  if (inRound >= cfg.audio.maxTakesPerCue) fail(`refused: ${cue} has used its ${cfg.audio.maxTakesPerCue} takes (audio.maxTakesPerCue) in ${roundName}. The cue becomes an open item and its moment plays without it.`)
  const n = all.reduce((m, t) => Math.max(m, t.take), 0) + 1
  const audio = decodeFile(src, RATE)
  if (audio.L.length === 0) fail('the file holds no sound')
  const out = takeFile(cue, n)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, encodeWav(audio))
  fs.copyFileSync(src, path.join(path.dirname(out), `take-${n}.source${path.extname(src).toLowerCase()}`))
  const m = measure(audio)
  const entry = {
    cue,
    take: n,
    round: roundName,
    class: classOf(cue),
    season: seasonOf(cue),
    line: text('line'),
    tool: text('tool'),
    prompt: text('prompt'),
    settings: parseSettings(text('settings')),
    source: { name: path.basename(src), bytes: fs.statSync(src).size, sha256: sourceSha, ...(probe(src) ?? {}) },
    sha256: fileSha(out),
    measured: m,
    ffmpeg: ffmpegLoudness(out),
    fits: fits(cue, m),
    answers: null,
    time: new Date().toISOString(),
  }
  saveTake(ledger, entry)
  console.log(`filed ${show(out)} · take ${inRound + 1} of ${cfg.audio.maxTakesPerCue} for ${cue} in ${roundName}`)
  for (const l of describe(m)) console.log(l)
  console.log(entry.fits.note)
}

function annotate() {
  const ledger = readLedger()
  const entry = pickTake(ledger, text('cue') ?? fail('give --cue ID'), text('take'))
  const changed = []
  for (const k of ['prompt', 'line', 'tool']) {
    if (text(k) !== null) {
      entry[k] = text(k)
      changed.push(k)
    }
  }
  if (text('settings') !== null) {
    entry.settings = parseSettings(text('settings'))
    changed.push('settings')
  }
  saveTake(ledger, entry)
  console.log(`take ${entry.take} of ${entry.cue}: recorded ${changed.join(', ')}`)
}

function answers() {
  const file = path.resolve(text('answers') ?? fail('give --answers FILE'))
  if (!fs.existsSync(file)) fail(`no such file: ${file}`)
  const raw = fs.readFileSync(file, 'utf8').trim()
  let value = raw
  try {
    value = JSON.parse(raw)
  } catch {}
  const ledger = readLedger()
  const entry = pickTake(ledger, text('cue'), text('take'))
  entry.answers = value
  entry.answersTime = new Date().toISOString()
  saveTake(ledger, entry)
  const keptRecord = path.join(KEPT, `${entry.cue}.json`)
  if (fs.existsSync(keptRecord)) {
    const k = readJson(keptRecord)
    if (k.take === entry.take) writeJson(keptRecord, { ...k, answers: value })
  }
  console.log(`the listener's answers are on take ${entry.take} of ${entry.cue}`)
}

function keep() {
  const cue = text('cue') ?? fail('give --cue ID')
  checkDisk()
  const ledger = readLedger()
  const entry = pickTake(ledger, cue, text('take'))
  const src = takeFile(cue, entry.take)
  if (!fs.existsSync(src)) fail(`${show(src)} is not in this workspace. File the take again, or make the sound again from its recipe.`)
  if (fileSha(src) !== entry.sha256) fail(`${show(src)} is not the file that was measured as take ${entry.take}`)
  const cls = classOf(cue)
  const options = {}
  const num = (k, key) => {
    if (text(k) !== null) options[key] = Number(text(k))
  }
  num('fade-in', 'fadeInMs')
  num('fade-out', 'fadeOutMs')
  num('low-cut', 'lowCutHz')
  num('trim-db', 'trimDb')
  const base = chainOf(cls)
  const cap = text('cap')
  options.capSeconds = cap === 'none' ? null : cap !== null ? Number(cap) : base.cap ? cueSeconds(cue) : null
  let done
  try {
    done = keepChain(decodeFile(src, RATE), cls, options)
  } catch (e) {
    return fail(`${cue} take ${entry.take} was not kept: ${e.message}`)
  }
  fs.mkdirSync(KEPT, { recursive: true })
  const out = path.join(KEPT, `${cue}.wav`)
  fs.writeFileSync(out, encodeWav(done.audio))
  const m = measure(decodeFile(out, RATE))
  const { cap: _cap, ...chainSettings } = done.settings
  const record = {
    id: cue,
    file: `${cue}.wav`,
    class: cls,
    season: seasonOf(cue),
    line: entry.line,
    seconds: m.seconds,
    take: entry.take,
    takes: takesOf(ledger, cue).length,
    round: entry.round,
    why: text('why'),
    tool: entry.tool,
    prompt: entry.prompt,
    settings: entry.settings,
    chain: { settings: chainSettings, steps: done.steps, gainDb: done.gainDb },
    loop: done.loop,
    measured: m,
    ffmpeg: ffmpegLoudness(out),
    takeMeasured: entry.measured,
    answers: entry.answers,
    source: entry.source,
    takeSha256: entry.sha256,
    sha256: fileSha(out),
    time: new Date().toISOString(),
  }
  writeJson(path.join(KEPT, `${cue}.json`), record)
  writeJson(`${out}.json`, { record: `${cue}.json`, sha256: record.sha256, engineHash: engineHash(), time: record.time })
  ledger.kept = [...ledger.kept.filter((k) => k.cue !== cue), { cue, take: entry.take, round: entry.round, file: `audio/kept/${cue}.wav`, sha256: record.sha256, seconds: m.seconds, lufs: m.lufs, time: record.time }]
  writeLedger(ledger)
  console.log(`kept take ${entry.take} of ${cue} as ${show(out)} · ${cls}, ${m.seconds} s, ${m.lufs} LUFS, peak ${m.truePeakDb} dB`)
  for (const s of done.steps) console.log(`  ${s}`)
  if (done.loop) console.log(`  seam: a step of ${done.loop.seam.ratio} times the usual step between samples, level change ${done.loop.seam.levelStepDb} dB`)
  const missing = [!entry.prompt && 'prompt', !entry.answers && "the listener's answers", !entry.line && 'the line that describes the cue'].filter(Boolean)
  if (missing.length) console.log(`  still missing on this take: ${missing.join(', ')}`)
  console.log(`row for ASSETS.md: | \`${cue}\` | \`audio/kept/${cue}.wav\` | ${entry.tool ?? 'tool and model not recorded'} | ${record.takes} | ${record.time.slice(0, 10)} |`)
}

function pack() {
  checkDisk()
  const r = writePack()
  const ledger = readLedger()
  const mb = (b) => (b / 1048576).toFixed(2)
  ledger.pack = { time: new Date().toISOString(), kbps: r.kbps, bytes: r.index.bytes, fits: r.fits, files: r.index.files.map((f) => ({ ...f, sha256: r.shas[f.file] })), sprites: Object.keys(r.index.sprites), loops: r.loopChecks, notes: r.notes }
  writeLedger(ledger)
  for (const f of r.index.files) console.log(`${show(path.join(PUBLIC_AUDIO, f.file))} · ${mb(f.bytes)} MB`)
  console.log(`sprite: ${Object.keys(r.index.sprites).length} sounds${Object.keys(r.index.sprites).length ? ` (${Object.keys(r.index.sprites).join(', ')})` : ''}`)
  for (const c of r.loopChecks) console.log(`loop ${c.id}: ${c.expectedSeconds} s written, ${c.decodedSeconds} s decoded, the two sides of the seam differ by ${c.seamErrorDb} dB of the signal`)
  for (const n of r.notes) console.log(`note: ${n}`)
  console.log(`${show(path.join(PUBLIC_AUDIO, 'index.json'))} · ${r.index.files.length} files at ${r.kbps} kbps, ${mb(r.index.bytes)} MB together, ${r.fits ? 'under' : 'OVER'} audio.appMaxMb of ${cfg.audio.appMaxMb} MB`)
}

const CLASS_INK = { ambience: '#7fa8a3', interface: '#b9b3a5', touch: '#c9b27a', impact: '#d98f5c', music: '#a99ad1' }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function sheet() {
  checkDisk()
  const kept = readKept().filter((k) => k.file)
  if (!kept.length) return fail('no kept sound to draw')
  const lim = limits()
  const width = Math.min(lim.longEdge, lim.statusLongEdge)
  const cols = kept.length <= 4 ? 1 : kept.length <= 12 ? 2 : kept.length <= 24 ? 3 : 4
  const rows = Math.ceil(kept.length / cols)
  const gap = 10
  const maxH = Math.min(width, Math.floor(lim.maxPixels / width))
  const cellH = Math.max(64, Math.min(150, Math.floor((maxH - gap) / rows) - gap))
  const cellW = Math.floor((width - gap * (cols + 1)) / cols)
  const height = gap + rows * (cellH + gap)
  const type = Math.max(13, Math.min(20, Math.round(cellH * 0.19)))
  const parts = [`<rect width="${width}" height="${height}" fill="#131417"/>`]
  kept.forEach((k, i) => {
    const x = gap + (i % cols) * (cellW + gap)
    const y = gap + Math.floor(i / cols) * (cellH + gap)
    const a = decodeFile(k.file, RATE)
    const top = peak(a) || 1
    const waveTop = y + type + 14
    const waveH = cellH - type - 22
    const mid = waveTop + waveH / 2
    const innerW = cellW - 20
    const n = a.L.length
    const up = []
    const down = []
    for (let px = 0; px < innerW; px++) {
      const from = Math.floor((px / innerW) * n)
      const to = Math.max(from + 1, Math.floor(((px + 1) / innerW) * n))
      let hi = 0
      let lo = 0
      for (let s = from; s < to && s < n; s++) {
        const v = 0.5 * (a.L[s] + a.R[s])
        if (v > hi) hi = v
        if (v < lo) lo = v
      }
      const xx = x + 10 + px
      up.push(`${xx},${(mid - Math.max(0.6, (hi / top) * (waveH / 2))).toFixed(1)}`)
      down.push(`${xx},${(mid + Math.max(0.6, (-lo / top) * (waveH / 2))).toFixed(1)}`)
    }
    const ink = CLASS_INK[k.record.class] ?? CLASS_INK.touch
    parts.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="6" fill="#1b1d21"/>`)
    parts.push(`<line x1="${x + 10}" y1="${mid}" x2="${x + cellW - 10}" y2="${mid}" stroke="#2c2f35" stroke-width="1"/>`)
    parts.push(`<polygon points="${up.join(' ')} ${down.reverse().join(' ')}" fill="${ink}"/>`)
    parts.push(`<text x="${x + 10}" y="${y + type + 4}" font-size="${type}" font-weight="700" fill="#ece7dc">${esc(k.id)}</text>`)
    parts.push(`<text x="${x + cellW - 10}" y="${y + type + 4}" font-size="${type}" text-anchor="end" fill="#a7a296">${seconds(a).toFixed(2)} s · ${k.record.measured?.lufs ?? '?'} LUFS</text>`)
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Lato, 'DejaVu Sans', sans-serif">${parts.join('')}</svg>`
  const out = rel('out', 'work', 'audio', 'sheet.jpg')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await sharp(Buffer.from(svg)).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(out)
  const record = { engineHash: engineHash(), width, height, sounds: kept.map((k) => ({ id: k.id, sha256: k.record.sha256 })), time: new Date().toISOString() }
  writeJson(`${out}.json`, record)
  const mirror = rel('out', 'work', 'sound', 'sheet.jpg')
  fs.mkdirSync(path.dirname(mirror), { recursive: true })
  fs.copyFileSync(out, mirror)
  writeJson(`${mirror}.json`, record)
  if (args.look !== 'no') addLook(out, `The ${kept.length} kept sounds as waveforms, each with its name, length and loudness`)
  console.log(`${show(out)} · ${kept.length} sounds, ${width} x ${height}`)
}

function list() {
  const ledger = readLedger()
  const kept = new Map(ledger.kept.map((k) => [k.cue, k]))
  const ids = [...new Set([...cfg.audio.sfx.map((s) => s.id), ...ledger.takes.map((t) => t.cue)])]
  for (const id of ids) {
    const takes = takesOf(ledger, id)
    const k = kept.get(id)
    const here = k && fs.existsSync(path.join(KEPT, `${id}.wav`))
    console.log(`${id} · ${classOf(id)} · takes ${takes.length}${takes.length ? ` (${[...new Set(takes.map((t) => t.round))].map((r) => `${takes.filter((t) => t.round === r).length} in ${r}`).join(', ')})` : ''} · ${k ? `kept take ${k.take}, ${k.seconds} s, ${k.lufs} LUFS${here ? '' : ', file not in this workspace'}` : 'nothing kept'}`)
  }
}

if (args.pack === true) pack()
else if (args.sheet === true) await sheet()
else if (args.list === true) list()
else if (args.answers !== undefined) answers()
else if (args.keep === true) keep()
else if (text('file') !== null) fileTake()
else if (text('cue') !== null && ['prompt', 'settings', 'line', 'tool'].some((k) => text(k) !== null)) annotate()
else usage()
