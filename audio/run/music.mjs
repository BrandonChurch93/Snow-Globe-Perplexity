// One take of one piece of music: the call, the counter before and after (the music endpoint sends no cost header), the filing with `npm run sound`.
// Run from the repo root: node audio/run/music.mjs <piece>      piece: music-one-piece, music-winter, music-spring, music-summer, music-fall
// The request is read from audio/prompts.json (music.pieces.<piece>): a prompt with music_length_ms and force_instrumental, or the composition plan in audio/plans/.
// MUSIC_FORMAT picks the output format: pcm_48000 (default) or mp3_44100_192, the format of the Phase 0 test call.
// The call goes through the credential proxy, so no key is in this file or in what it writes.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const HANDLE = process.env.ELEVENLABS_HANDLE ?? 'custom-cred:08b44ea8-85c9-4afc-a770-5985ca606785@api.elevenlabs.io'
const FORMAT = process.env.MUSIC_FORMAT ?? 'pcm_48000'
const TOOL = `ElevenLabs music, POST /v1/music, the default model (music_v1), ${FORMAT}`
const piece = process.argv[2]
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'prompts.json'), 'utf8'))
const LINES = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'lines.json'), 'utf8'))
const m = P.music?.pieces?.[piece]
if (!m) {
  console.error(`no piece in audio/prompts.json for ${piece}`)
  process.exit(1)
}
const curl = (args) => spawnSync('pplx', ['credentials', 'run', HANDLE, '--', 'curl', '-sS', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
const counter = () => {
  try {
    const j = JSON.parse(curl(['https://api.elevenlabs.io/v1/user/subscription']).stdout)
    return { used: j.character_count, limit: j.character_limit, time: new Date().toISOString() }
  } catch {
    return null
  }
}
let body
let prompt
if (m.how === 'composition_plan') {
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, m.plan), 'utf8'))
  body = { composition_plan: plan.composition_plan, respect_sections_durations: true }
  prompt = `composition plan ${m.plan}: ${plan.composition_plan.sections.map((s) => `${s.section_name} ${s.duration_ms} ms`).join(', ')}; global: ${plan.composition_plan.positive_global_styles.join('; ')}`
  if (!plan.composition_plan.positive_global_styles.includes(P.music.familyLine)) {
    console.error('the plan does not hold the music family line')
    process.exit(1)
  }
} else {
  body = { prompt: m.prompt, music_length_ms: m.music_length_ms, force_instrumental: true }
  prompt = m.prompt
  if (!prompt.endsWith(P.music.familyLine)) {
    console.error('the prompt does not end with the music family line')
    process.exit(1)
  }
}
const dir = path.join(ROOT, 'out', 'work', 'audio', 'raw')
fs.mkdirSync(dir, { recursive: true })
const raw = path.join(dir, `${piece}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
fs.writeFileSync(`${raw}.body.json`, JSON.stringify(body))
const before = counter()
const ext = FORMAT.startsWith('mp3') ? 'mp3' : 'pcm'
const r = curl(['-X', 'POST', `https://api.elevenlabs.io/v1/music?output_format=${FORMAT}`, '-H', 'Content-Type: application/json', '--data-binary', `@${raw}.body.json`, '-D', `${raw}.headers.txt`, '-o', `${raw}.${ext}`, '-w', '%{http_code} %{time_total}'])
const [code, secs] = (r.stdout || '').trim().split(' ')
const after = counter()
const headers = fs.existsSync(`${raw}.headers.txt`) ? fs.readFileSync(`${raw}.headers.txt`, 'utf8') : ''
const header = Number((/character-cost:\s*(\d+)/i.exec(headers) || [])[1] ?? NaN)
const moved = before && after ? after.used - before.used : null
console.log(`HTTP ${code} in ${secs} s · cost header ${Number.isFinite(header) ? header : 'none'} · the counter moved by ${moved ?? 'unknown'} (${before?.used} to ${after?.used} of ${after?.limit}) · ${new Date().toISOString()}`)
if (code !== '200') {
  if (fs.existsSync(`${raw}.${ext}`)) console.log(fs.readFileSync(`${raw}.${ext}`, 'utf8').slice(0, 800))
  if (r.stderr) console.log(r.stderr)
  console.log('no take was filed or counted')
  process.exit(3)
}
let src = `${raw}.${ext}`
if (ext === 'pcm') {
  const bytes = fs.statSync(src).size
  const asked = (m.music_length_ms ?? 60000) / 1000
  const channels = Math.max(1, Math.min(2, Math.round(bytes / (asked * 96000))))
  const wav = `${raw}.wav`
  const f = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', '48000', '-ac', String(channels), '-i', src, wav])
  if (f.status !== 0) {
    console.error(String(f.stderr))
    process.exit(4)
  }
  console.log(`${bytes} bytes, read as ${channels} channel(s): ${(bytes / (96000 * channels)).toFixed(2)} s`)
  src = wav
}
const settings = { endpoint: 'POST /v1/music', model: 'default', how: m.how, ...(m.how === 'composition_plan' ? { plan: m.plan, respect_sections_durations: true } : { music_length_ms: m.music_length_ms, force_instrumental: true }), output_format: FORMAT, cost: Number.isFinite(header) ? header : null, counterMovedBy: moved, counterNote: 'the music endpoint sends no cost header; the counter also moves with other work on the account' }
const s = spawnSync('npm', ['run', '-s', 'sound', '--', '--cue', piece, '--file', src, '--prompt', prompt, '--settings', JSON.stringify(settings), '--line', LINES[piece], '--tool', TOOL], { cwd: ROOT, encoding: 'utf8' })
console.log(s.stdout, s.stderr)
process.exit(s.status ?? 0)
