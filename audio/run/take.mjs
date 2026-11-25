// One take of one sound effect cue: the call, the cost header, the filing with `npm run sound`.
// Run from the repo root: node audio/run/take.mjs <cue>
// The text, length and influence are read from audio/prompts.json (cues.<cue>), the cue's line from audio/lines.json.
// The call goes through the credential proxy, so no key is in this file or in what it writes.
// Set ELEVENLABS_HANDLE to the handle that list_credentials shows for api.elevenlabs.io.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const HANDLE = process.env.ELEVENLABS_HANDLE
if (!HANDLE) {
  console.error('Set ELEVENLABS_HANDLE to the handle of the saved ElevenLabs credential (it has the form custom-cred:<id>@api.elevenlabs.io). No handle is kept in this repo.')
  process.exit(2)
}
const TOOL = 'ElevenLabs sound effects, POST /v1/sound-generation, the default model (eleven_text_to_sound_v2), PCM at 48 kHz'
const cue = process.argv[2]
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'prompts.json'), 'utf8'))
const LINES = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'lines.json'), 'utf8'))
const c = P.cues[cue]
if (!c) {
  console.error(`no text in audio/prompts.json for ${cue}`)
  process.exit(1)
}
if (!LINES[cue]) {
  console.error(`no line in audio/lines.json for ${cue}`)
  process.exit(1)
}
const prompt = `${c.text}, ${P.familyLine}`
const dir = path.join(ROOT, 'out', 'work', 'audio', 'raw')
fs.mkdirSync(dir, { recursive: true })
const raw = path.join(dir, `${cue}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const body = { text: prompt, duration_seconds: c.seconds, prompt_influence: c.influence, loop: c.loop }
fs.writeFileSync(`${raw}.body.json`, JSON.stringify(body))
const r = spawnSync('pplx', ['credentials', 'run', HANDLE, '--', 'curl', '-sS', '-X', 'POST', 'https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_48000', '-H', 'Content-Type: application/json', '--data-binary', `@${raw}.body.json`, '-D', `${raw}.headers.txt`, '-o', `${raw}.pcm`, '-w', '%{http_code} %{time_total}'], { encoding: 'utf8' })
const [code, secs] = (r.stdout || '').trim().split(' ')
const headers = fs.existsSync(`${raw}.headers.txt`) ? fs.readFileSync(`${raw}.headers.txt`, 'utf8') : ''
const cost = Number((/character-cost:\s*(\d+)/i.exec(headers) || [])[1] ?? NaN)
console.log(`HTTP ${code} in ${secs} s · cost header ${Number.isFinite(cost) ? cost : 'none'} · ${new Date().toISOString()}`)
if (code !== '200') {
  if (fs.existsSync(`${raw}.pcm`)) console.log(fs.readFileSync(`${raw}.pcm`, 'utf8').slice(0, 800))
  if (r.stderr) console.log(r.stderr)
  console.log('no take was filed or counted')
  process.exit(3)
}
const bytes = fs.statSync(`${raw}.pcm`).size
// The endpoint has returned stereo 16 bit PCM (Phase 0 test call). The byte count against the length asked for tells mono from stereo.
const channels = Math.max(1, Math.min(2, Math.round(bytes / (c.seconds * 96000))))
const wav = `${raw}.wav`
const f = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', '48000', '-ac', String(channels), '-i', `${raw}.pcm`, wav])
if (f.status !== 0) {
  console.error(String(f.stderr))
  process.exit(4)
}
console.log(`${bytes} bytes, read as ${channels} channel(s): ${(bytes / (96000 * channels)).toFixed(2)} s`)
const settings = { endpoint: 'POST /v1/sound-generation', model: 'default', duration_seconds: c.seconds, prompt_influence: c.influence, loop: c.loop, output_format: 'pcm_48000', cost: Number.isFinite(cost) ? cost : null }
const s = spawnSync('npm', ['run', '-s', 'sound', '--', '--cue', cue, '--file', wav, '--prompt', prompt, '--settings', JSON.stringify(settings), '--line', LINES[cue], '--tool', TOOL], { cwd: ROOT, encoding: 'utf8' })
console.log(s.stdout, s.stderr)
process.exit(s.status ?? 0)
