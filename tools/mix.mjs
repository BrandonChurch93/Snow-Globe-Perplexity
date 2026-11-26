import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { engineHash, fileSha, sha256 } from './lib/hashes.mjs'
import { freeDiskGb } from './lib/browser.mjs'
import { cfg, AUDIO, encodeWav, ffmpegLoudness, keptFile, mixFilm, peak, readLedger, writeLedger } from './lib/audio.mjs'

const args = parseArgs(process.argv.slice(2))
const text = (k) => (args[k] !== undefined && args[k] !== true ? String(args[k]) : null)
const show = (f) => path.relative(rel(), f).split(path.sep).join('/')
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

if (args.final !== true && text('candidate') === null) {
  console.log(['npm run mix -- --candidate NAME [--which b|a] [--music FILE] [--skip CUE,CUE] [--gain CUE=DB,music=DB]', 'npm run mix -- --final [--candidate NAME | --music FILE] [--skip CUE,CUE] [--gain CUE=DB,music=DB]', `NAME is blockout (effects and ambience only) or one of ${cfg.audio.candidates.join(', ')}`].join('\n'))
  process.exit(2)
}
if (freeDiskGb() < cfg.sandbox.minFreeDiskGb) fail(`only ${freeDiskGb().toFixed(1)} GB of disk is free, under sandbox.minFreeDiskGb`)

const cutFile = rel('cut', 'CUTLIST.json')
if (!fs.existsSync(cutFile)) fail('cut/CUTLIST.json does not exist. Run npm run cut.')
const cut = readJson(cutFile)
const skip = (text('skip') ?? '').split(',').filter(Boolean)
const gains = Object.fromEntries(
  (text('gain') ?? '')
    .split(',')
    .filter(Boolean)
    .map((p) => p.split('='))
    .map(([k, v]) => [k, Number(v)]),
)
for (const [k, v] of Object.entries(gains)) if (!Number.isFinite(v)) fail(`--gain ${k} needs a number of dB`)

const hasMusic = (name) => (name === 'one-piece' ? keptFile('music-one-piece') !== null : name === 'four-tracks' ? cfg.seasons.some((s) => keptFile(`music-${s}`) !== null) : false)

function chosen() {
  try {
    const m = /^- Soundtrack chosen:\s*(.+?)\s*$/m.exec(fs.readFileSync(rel('kit', 'PROGRESS.md'), 'utf8'))
    return m ? m[1] : 'none'
  } catch {
    return 'none'
  }
}

function supplied() {
  const dir = path.join(AUDIO, 'supplied')
  if (!fs.existsSync(dir)) return null
  const files = fs
    .readdirSync(dir)
    .filter((n) => /\.(wav|mp3|m4a|flac|aac|ogg)$/i.test(n))
    .map((n) => path.join(dir, n))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs || (a < b ? -1 : 1))
  return files[0] ?? null
}

function run({ name, which, candidate, musicFile, out, stem }) {
  const t0 = Date.now()
  const r = mixFilm({ cut, which, candidate, musicFile, skip, gains })
  const bytes = encodeWav(r.audio)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, bytes)
  const hash = sha256(bytes)
  const measured = ffmpegLoudness(out)
  let stemSha = null
  if (stem && peak(r.music) > 0) {
    const sb = encodeWav(r.music)
    fs.writeFileSync(stem, sb)
    stemSha = sha256(sb)
  } else if (stem) fs.rmSync(stem, { force: true })
  const record = {
    name,
    file: path.basename(out),
    which,
    candidate,
    args: { skip, gains, music: musicFile ? show(musicFile) : null },
    cutlist: { sha256: fileSha(cutFile), source: cut.source ?? null, seconds: cut.seconds, frameCount: cut.frameCount },
    ...r.report,
    measuredByFfmpeg: measured,
    sha256: hash,
    musicStem: stemSha ? { file: path.basename(stem), sha256: stemSha } : null,
    engineHash: engineHash(),
    time: new Date().toISOString(),
  }
  writeJson(out.replace(/\.wav$/, '.json'), record)
  const ledger = readLedger()
  ledger.mixes[show(out)] = { sha256: hash, lufs: measured.lufs, truePeakDb: measured.truePeakDb, candidate, which, time: record.time }
  writeLedger(ledger)
  const m = r.report.master
  console.log(`${show(out)} · film ${which.toUpperCase()}, ${r.report.seconds} s${r.report.openingSeconds ? `, of which the opening is ${r.report.openingSeconds} s` : ''}, ${((Date.now() - t0) / 1000).toFixed(1)} s to mix`)
  console.log(`  placed: ${r.report.placed.length} cues and ambience beds · music: ${r.report.music.source}${r.report.music.end ? `, ${r.report.music.end}` : ''}`)
  if (r.report.skipped.length) console.log(`  skipped: ${r.report.skipped.map((s) => `${s.cue} (${s.why})`).join(', ')}`)
  if (r.report.laid?.length) console.log(`  laid by decision 141, not kept, the cue open: ${r.report.laid.map((l) => `${l.cue} (${l.times} ${l.times === 1 ? 'time' : 'times'}${l.presses ? `, ${l.presses} presses in turn` : ''})`).join(', ')}`)
  const ty = r.report.typing
  if (ty && (ty.keys || ty.taps)) console.log(`  typing: ${ty.taps} taps for ${ty.keys} keys, ${ty.withoutKey ? `${ty.withoutKey} WITHOUT A KEY` : 'none without a key'}${ty.keysWithoutTap ? `, ${ty.keysWithoutTap} keys with no tap` : ''}; each begins within ${ty.limitMs} ms of its own key (the earliest ${ty.earliestMs} ms, the latest ${ty.latestMs} ms)`)
  if (m.silent) console.log('  the mix is silent: nothing was placed')
  else {
    console.log(`  level: ${m.gainDb} dB of gain, the limiter took off at most ${m.limiterReductionDb} dB, ${m.passes} passes`)
    console.log(`  measured by ffmpeg: ${measured.lufs} LUFS (wanted ${cfg.audio.filmLoudnessLufs}), true peak ${measured.truePeakDb} dB (limit ${cfg.audio.truePeakDb}), range ${measured.lra} LU`)
    if (m.encoded) {
      const gave = m.encoded.gaveWay ?? []
      console.log(`  as ${m.encoded.codec} at ${m.encoded.kbps} kbit/s: true peak ${m.encoded.truePeakDb} dB; ${gave.length ? `the wav gives way in ${gave.length} place${gave.length === 1 ? '' : 's'} of 5 ms where the encoder overshoots (${gave.slice(0, 6).map((g) => `${g.db} dB at ${g.at} s`).join(', ')}${gave.length > 6 ? ', ...' : ''})` : 'the encoder overshoots nowhere'}${m.encoded.roomDb ? `, and the whole film stays ${m.encoded.roomDb} dB lower under the limit` : ''}`)
    }
    const parts = r.report.music.parts.filter((p) => p.fromBar !== undefined)
    if (parts.length) console.log(`  music: ${parts.map((p) => `${p.id} bars ${p.fromBar} to ${p.toBar}${p.centredByDb ? `, centred by ${p.centredByDb} dB` : ''}`).join(' · ')}`)
    const l = r.report.landings
    if (l.at.length > 1) console.log(`  landings, first ${l.firstMomentSeconds * 1000} ms: ${l.afterDb.join(', ')} dB (${l.spreadDb} dB apart; ${l.beforeDb.join(', ')} before trims of ${l.trimsDb.join(', ')} dB)`)
    console.log(`  left over right: ${r.report.channels.leftOverRightDb} dB`)
  }
  if (stemSha) console.log(`  music alone: ${show(stem)}`)
  console.log(`  sha256 ${hash}`)
  return record
}

if (args.final === true) {
  let candidate = text('candidate')
  let musicFile = text('music') ? path.resolve(text('music')) : null
  let why = candidate ? 'named with --candidate' : musicFile ? 'given with --music' : ''
  if (!candidate && !musicFile) {
    const pick = chosen()
    if (cfg.audio.candidates.includes(pick)) {
      candidate = pick
      why = 'the soundtrack chosen in kit/PROGRESS.md'
    } else if (pick === 'his own file' && supplied()) {
      musicFile = supplied()
      why = 'his own file, from audio/supplied/'
    } else {
      candidate = cfg.audio.candidates.find(hasMusic) ?? 'blockout'
      why = candidate === 'blockout' ? 'no music exists, so effects and ambience alone' : `kit/PROGRESS.md names no soundtrack (${pick}), so the first candidate whose music exists`
    }
  }
  if (musicFile && !fs.existsSync(musicFile)) fail(`no such file: ${musicFile}`)
  if (candidate && candidate !== 'blockout' && !musicFile) {
    const stem = path.join(AUDIO, 'mix', `${candidate}-music.wav`)
    if (candidate === 'four-tracks' && cut.source !== 'default-grid' && fs.existsSync(stem)) {
      musicFile = stem
      why += ', laid as the one bed the cut was fitted to'
    } else if (!hasMusic(candidate)) why += ', whose music is not in this workspace'
  }
  candidate = candidate ?? 'supplied'
  console.log(`final mix: ${musicFile ? show(musicFile) : candidate} · ${why}`)
  const dir = path.join(AUDIO, 'final')
  run({ name: 'film-b', which: 'b', candidate, musicFile, out: path.join(dir, 'film-b.wav'), stem: path.join(dir, 'music.wav') })
  run({ name: 'film-a', which: 'a', candidate, musicFile, out: path.join(dir, 'film-a.wav'), stem: null })
} else {
  const candidate = text('candidate')
  if (candidate !== 'blockout' && !cfg.audio.candidates.includes(candidate) && !text('music')) fail(`no such candidate: ${candidate}. Known: blockout, ${cfg.audio.candidates.join(', ')}`)
  const which = text('which') === 'a' ? 'a' : 'b'
  const musicFile = text('music') ? path.resolve(text('music')) : null
  if (musicFile && !fs.existsSync(musicFile)) fail(`no such file: ${musicFile}`)
  const dir = path.join(AUDIO, 'mix')
  const base = which === 'a' ? `${candidate}-film-a` : candidate
  run({ name: base, which, candidate, musicFile, out: path.join(dir, `${base}.wav`), stem: path.join(dir, `${base}-music.wav`) })
}
