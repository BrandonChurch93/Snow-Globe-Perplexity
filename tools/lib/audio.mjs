import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadConfig, rel, readJson, writeJson } from './paths.mjs'
import { sha256, fileSha } from './hashes.mjs'

export const cfg = loadConfig()
export const RATE = cfg.audio.sampleRate

const CLASS_LUFS = { ambience: -30, interface: -26, touch: -22, impact: -18, music: -16 }
const CLASS_OF = { lift: 'touch', 'glass-clink': 'touch', riser: 'touch', 'music-box': 'interface', 'ui-tick': 'interface', 'ui-sound-on': 'interface', 'key-tap': 'interface', 'ui-send': 'interface' }
const CHAIN = {
  ambience: { trimDb: -60, padMs: 0, fadeInMs: 0, fadeOutMs: 0, lowCutHz: 70, loop: true, crossSeconds: 1.5, cap: true },
  interface: { trimDb: -48, padMs: 2, fadeInMs: 2, fadeOutMs: 30, lowCutHz: 120, loop: false, cap: true },
  touch: { trimDb: -48, padMs: 3, fadeInMs: 3, fadeOutMs: 80, lowCutHz: 45, loop: false, cap: true },
  impact: { trimDb: -50, padMs: 3, fadeInMs: 3, fadeOutMs: 180, lowCutHz: 30, loop: false, cap: true },
  music: { trimDb: -60, padMs: 5, fadeInMs: 2, fadeOutMs: 30, lowCutHz: 0, loop: false, cap: false },
}
// The app plays its music 8 dB under the kept level. The ambience was left at its kept level, 6 dB under that music by
// loudness, where the film has it 14 dB under: the listener, given each season's two loops at the pack's gains, said of the
// ambience "too loud", "competes" or "overpowers" in 8 of 12 answers (each of the four seasons at least once), in 2 of 7
// with it 4 dB lower and in 1 of 11 with it 8 dB lower. So the ambience takes the music's trim and the app keeps the
// film's distance between the two (kit: "The music leads. Ambience sits far under it."). Not heard by a human.
// Decision 146 of kit/PROGRESS.md: the same holds for every sound of a shake. Left at their kept level against music
// 8 dB down, the lift and the landing's clink stood 8 dB further over the app's music than over the film's, and a
// shake, which the film has 3 dB down (fall 6) since decision 142, 11 dB further (fall 14): by measurement 0.7 to
// 3.7 dB under the bar of music before it, where film B has it 12.6 to 14.8 dB under. So touch and impact take the
// music's trim too, and the app keeps the film's distances between the sounds of a shake at its own lower level; a
// shake then takes the film's own step on top (shakeStepDb).
// The interface stays at its kept level. The press's tick and the chime of sound on were laid over each season's two
// loops at these gains, at 0 dB and 8 dB lower, and the listener asked only what it hears, four times each. It named a
// tick at a press in 4 of 16 listenings at 0 dB and in 1 of 16 at 8 dB lower (2 of 16 where no tick was laid), a chime
// in 2 of 16 and 1 of 16 (1 of 16 where none was laid), and called the tick too loud at 0 dB in none of 16, the chime
// in 1 of 16. At 0 dB the tick stands between 1.9 dB over and 4.7 dB under the music it plays on (two presses in each
// season), 8 dB lower 6.1 to 12.7 dB under it; the chime 5.5 to 7.7 dB under, 8 dB lower 13.5 to 15.7 dB under.
// So 8 dB lower it is lost, and where it is it is not too loud, though it is named little oftener there than where
// none was laid (decision 146, point 2). Not heard by a human.
// The uniform step (the last job of 2026-11-26): every class 0.5 dB lower than the text above says, the interface
// with the rest, so the 8 dB above read 8.5 and the interface's 0 reads 0.5, and no distance between two sounds of
// the app moves. With the gap between interface cues the two nearest lines of the headroom table stood 0.04 and
// 0.06 dB under the -1 dBFS that is asked (-1.04 and -1.06 dBFS, bounds on the sum, as the app has no limiter). They
// stand at -1.54 and -1.56 dBFS now, and every other line is 0.5 dB lower too (audio/RECIPE.md, "The uniform step").
// Only the gains of index.json moved: the sound files of the pack are byte for byte the same.
export const APP_TRIM_DB = { ambience: -8.5, interface: -0.5, touch: -8.5, impact: -8.5, music: -8.5 }
const VARIED = { 'key-tap': [0, -45, 30, -20, 55, -65, 15, 40, -30] }
// A hand does not type like a wheel. At the film's 14 a second one press repeated in the cut list's even steps was heard as
// a ratchet, a prize wheel or a card in bicycle spokes (asked 5 times, with three different presses), and as typing on a
// keyboard once each repeat is moved a few milliseconds off its place and turned down a little. Both lists are fixed, so
// the film stays the same bytes; no tap is moved by more than 20 ms, about one frame, and the first tap is not moved at all.
// underDb: a run of 14 presses a second, each at the level its class gives one press alone, was heard in film A as loud,
// sharp typing (fit to "Soft key presses": no, twice); 9 dB lower it was heard as soft typing (yes, twice), 6 dB lower once.
const HAND = { 'key-tap': { ms: [0, 14, -9, 18, -16, 6, -20, 11, -4, 20, -13, 8, -18], db: [0, -2.5, -1, -4, -0.5, -3, -1.5], underDb: 9 } }
// Decision 144 of kit/PROGRESS.md: a tap may begin this far from the time of its own key and no further. The cut of the
// opening gives every key its own frame; laid exactly on it, or kept inside it, the typing was heard once in three as a
// rapid mechanical clicking, and with the list above as keyboard typing three times of three. So the list stays, the mix
// refuses a move beyond the limit, and every mix reports its taps against the keys of the cut list.
export const HAND_LIMIT_MS = 20
// Decision 142 of kit/PROGRESS.md. In its own bar of film B the kept shake was called too loud or abrupt against the
// music in 4 of 4 listenings. So every shake of the film comes down by downDb and rises from nothing over its first
// riseMs. A shake still called so in 2 or more of 4 listenings at that level comes down by moreDb more, once, and is
// left there: those cues are named in more. The film's mix does this to the cue as it lays it; the app's pack does the
// same to the shake's sound in the sprite (spriteSound), from this one constant (decision 146).
// At 3 dB down: the kept shake of spring 1 of 4, summer 1 of 4, winter 1 of 4, and fall (the kept water at its own pitch
// in the third shake's bar, where the music is thin) 2 of 4, so fall alone is named in more.
export const SHAKE = { downDb: 3, riseMs: 30, moreDb: 3, more: ['shake-fall'] }
export const isShake = (id) => String(id).startsWith('shake-')
// What that rule takes off a shake, in dB, and nothing off any other sound: the film's mix and the app's pack both ask here.
export const shakeStepDb = (id) => (isShake(id) ? -(SHAKE.downDb + (SHAKE.more.includes(id) ? SHAKE.moreDb : 0)) : 0)
export const PEAK_MARGIN_DB = 0.15
export const LOUDNESS_BLOCK = 0.4
export const SHORT_CREST_DB = 16
const OFFSET_DB = -80
const HEAD_SHARE = 0.25
const ONSET_DB = -30
const SPRITE_PEAK_DB = -3
const SPRITE_GAP = 0.3
const SPRITE_LEAD = 0.1
const LOOP_PAD = 0.2
const LOOP_LEAD = 0.06
const LOOP_CROSS = 0.05
const LOOP_STEP_DB = 3
// What the app does with a loop (src/audio/index.ts, seamOf): the file is played pass over pass, each pass starting one
// seam before the last one ends, the two crossed at equal power. What is heard repeats every pass less one seam. The
// seam is one bar for music, 1.5 s for ambience, and never more than a quarter of the pass.
export const APP_SEAM = { music: (cfg.film.beatsPerBar * 60) / cfg.film.defaultBpm, ambience: 1.5 }
export const APP_SEAM_SHARE = 0.25
export const appSeam = (cls, loopSeconds) => Math.min(cls === 'music' ? APP_SEAM.music : APP_SEAM.ambience, loopSeconds * APP_SEAM_SHARE)
const SET_GAP = 0.02
const HOLD_DB = 9
const OPEN_SECONDS = 0.05
const CENTRE_WITHIN_DB = 0.1
const BUS_CENTRE_DB = 1.5
const THIN_DB = -12
const THIN_TOP_HZ = 900
const THIN_TAIL = 0.15
const LANDING_TRIM_DB = 6
const LANDING_MATCH_DB = 1
const LANDING_EASE = 0.25
const ENCODERS = { aac: 'aac' }
const ENCODE_ROOM_DB = 0.25
const ENCODER_DELAY = { aac: 1024 }
const GIVE_WINDOW = 0.005
const GIVE_EDGE = 0.004
const GIVE_MORE_DB = 0.1
const GIVE_PASSES = 6
const BITRATES = [192, 160, 128, 112, 96, 80, 64]
const BANDS = [['sub', 0, 60], ['low', 60, 250], ['lowMid', 250, 1000], ['mid', 1000, 4000], ['high', 4000, 10000], ['air', 10000, Infinity]]

export const AUDIO = rel('audio')
export const KEPT = rel('audio', 'kept')
export const TAKES = rel('out', 'work', 'audio', 'takes')
export const LEDGER = rel('audio', 'RECORDS.json')
export const PUBLIC_AUDIO = rel('public', 'audio')

export const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity)
export const lin = (d) => Math.pow(10, d / 20)
export const round = (x, n = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** n) / 10 ** n : null)

export function classOf(id) {
  if (id.startsWith('amb-')) return 'ambience'
  if (id.startsWith('music-') && id !== 'music-box') return 'music'
  if (id.startsWith('land-') || id.startsWith('shake-')) return 'impact'
  return CLASS_OF[id] ?? 'touch'
}
export const seasonOf = (id) => cfg.seasons.find((s) => id.endsWith(`-${s}`)) ?? null
export const levelOf = (cls) => cfg.audio.levels?.[cls] ?? CLASS_LUFS[cls]
export const chainOf = (cls) => ({ ...CHAIN[cls], targetLufs: levelOf(cls) })
export const cueSeconds = (id) => cfg.audio.sfx.find((s) => s.id === id)?.seconds ?? null
export const isLoop = (id) => id.startsWith('amb-') || (id.startsWith('music-') && seasonOf(id) !== null)

export const make = (n, rate = RATE) => ({ rate, L: new Float64Array(Math.max(0, n)), R: new Float64Array(Math.max(0, n)) })
export const seconds = (a) => a.L.length / a.rate
export const slice = (a, from, to = a.L.length) => ({ rate: a.rate, L: a.L.slice(Math.max(0, from), Math.max(0, to)), R: a.R.slice(Math.max(0, from), Math.max(0, to)) })
export function scale(a, g) {
  const o = make(a.L.length, a.rate)
  for (let i = 0; i < a.L.length; i++) {
    o.L[i] = a.L[i] * g
    o.R[i] = a.R[i] * g
  }
  return o
}

export function parseWav(buf) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') return null
  let p = 12
  let fmt = null
  let data = null
  while (p + 8 <= buf.length) {
    const id = buf.toString('latin1', p, p + 4)
    const size = buf.readUInt32LE(p + 4)
    const body = p + 8
    if (id === 'fmt ' && size >= 16) {
      let tag = buf.readUInt16LE(body)
      if (tag === 0xfffe && size >= 26) tag = buf.readUInt16LE(body + 24)
      fmt = { tag, channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) }
    } else if (id === 'data') data = buf.subarray(body, Math.min(buf.length, body + size))
    p = body + size + (size & 1)
  }
  if (!fmt || !data || fmt.channels < 1) return null
  const bytes = fmt.bits / 8
  const read = fmt.tag === 3 ? (bytes === 4 ? (o) => data.readFloatLE(o) : bytes === 8 ? (o) => data.readDoubleLE(o) : null) : fmt.tag === 1 ? { 1: (o) => (data[o] - 128) / 128, 2: (o) => data.readInt16LE(o) / 32768, 3: (o) => data.readIntLE(o, 3) / 8388608, 4: (o) => data.readInt32LE(o) / 2147483648 }[bytes] : null
  if (!read) return null
  const n = Math.floor(data.length / (bytes * fmt.channels))
  const a = make(n, fmt.rate)
  const second = fmt.channels > 1 ? bytes : 0
  for (let i = 0; i < n; i++) {
    const o = i * bytes * fmt.channels
    a.L[i] = read(o)
    a.R[i] = read(o + second)
  }
  return a
}

export function encodeWav(a) {
  const n = a.L.length
  const out = Buffer.alloc(44 + n * 6)
  out.write('RIFF', 0, 'latin1')
  out.writeUInt32LE(36 + n * 6, 4)
  out.write('WAVEfmt ', 8, 'latin1')
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(2, 22)
  out.writeUInt32LE(a.rate, 24)
  out.writeUInt32LE(a.rate * 6, 28)
  out.writeUInt16LE(6, 32)
  out.writeUInt16LE(24, 34)
  out.write('data', 36, 'latin1')
  out.writeUInt32LE(n * 6, 40)
  const q = (x) => Math.max(-8388608, Math.min(8388607, Math.round(x * 8388607)))
  for (let i = 0; i < n; i++) {
    out.writeIntLE(q(a.L[i]), 44 + i * 6, 3)
    out.writeIntLE(q(a.R[i]), 47 + i * 6, 3)
  }
  return out
}

export function ffmpeg(args, { input, binary = 'ffmpeg' } = {}) {
  const r = spawnSync(binary, args, { input, maxBuffer: 2 ** 31 - 1, encoding: 'buffer' })
  if (r.error) throw new Error(`${binary} could not be run: ${r.error.message}`)
  return { code: r.status, stdout: r.stdout, stderr: r.stderr.toString('utf8') }
}

export function decodeFile(file, rate = RATE) {
  if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`)
  const wav = path.extname(file).toLowerCase() === '.wav' ? parseWav(fs.readFileSync(file)) : null
  if (wav && wav.rate === rate) return wav
  const r = ffmpeg(['-v', 'error', '-nostdin', '-i', file, '-map', '0:a:0', '-f', 'f32le', '-ac', '2', '-ar', String(rate), '-'])
  if (r.code !== 0 || r.stdout.length === 0) throw new Error(`ffmpeg could not decode ${file}: ${r.stderr.trim().split('\n').pop() ?? ''}`)
  const n = Math.floor(r.stdout.length / 8)
  const a = make(n, rate)
  for (let i = 0; i < n; i++) {
    a.L[i] = r.stdout.readFloatLE(i * 8)
    a.R[i] = r.stdout.readFloatLE(i * 8 + 4)
  }
  return a
}

export function ffmpegLoudness(file) {
  const r = ffmpeg(['-nostats', '-hide_banner', '-nostdin', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'))
  const num = (re) => {
    const m = re.exec(tail)
    return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : null
  }
  return { lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+|-inf) LU/), truePeakDb: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) }
}

export function peak(a) {
  let m = 0
  for (let i = 0; i < a.L.length; i++) {
    const l = Math.abs(a.L[i])
    const r = Math.abs(a.R[i])
    if (l > m) m = l
    if (r > m) m = r
  }
  return m
}

const TP_TAPS = 32
const TP_PHASES = (() => {
  const phases = []
  for (let p = 1; p < 4; p++) {
    const h = new Float64Array(TP_TAPS)
    let sum = 0
    for (let k = 0; k < TP_TAPS; k++) {
      const x = k - (TP_TAPS / 2 - 1) - p / 4
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (TP_TAPS / 2))
      h[k] = (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * Math.max(0, w)
      sum += h[k]
    }
    for (let k = 0; k < TP_TAPS; k++) h[k] /= sum
    phases.push(h)
  }
  return phases
})()

export function truePeak(a) {
  let m = peak(a)
  const half = TP_TAPS / 2 - 1
  for (const x of [a.L, a.R]) {
    const n = x.length
    for (let i = 0; i < n; i++) {
      if (Math.abs(x[i]) * 2 < m && Math.abs(x[Math.min(n - 1, i + 1)]) * 2 < m) continue
      for (const h of TP_PHASES) {
        let s = 0
        for (let k = 0; k < TP_TAPS; k++) {
          const j = i - half + k
          if (j >= 0 && j < n) s += h[k] * x[j]
        }
        if (s > m) m = s
        else if (-s > m) m = -s
      }
    }
  }
  return m
}

function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = v
    y[i] = v
  }
  return y
}

function kWeight(x, rate) {
  let k = Math.tan((Math.PI * 1681.974450955533) / rate)
  let q = 0.7071752369554196
  const vh = Math.pow(10, 3.999843853973347 / 20)
  const vb = Math.pow(vh, 0.4996667741545416)
  let a0 = 1 + k / q + k * k
  const shelf = biquad(x, (vh + (vb * k) / q + k * k) / a0, (2 * (k * k - vh)) / a0, (vh - (vb * k) / q + k * k) / a0, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0)
  k = Math.tan((Math.PI * 38.13547087602444) / rate)
  q = 0.5003270373238773
  a0 = 1 + k / q + k * k
  return biquad(shelf, 1, -2, 1, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0)
}

export const MEASURES = {
  gated: 'gated loudness over 400 ms blocks',
  'own-length': "K weighted mean square over the sound's own length (it is shorter than one 400 ms block)",
}

export function loudnessOf(a) {
  const n = a.L.length
  const secs = round(n / a.rate, 4)
  const block = Math.round(LOUDNESS_BLOCK * a.rate)
  const measure = n < block ? 'own-length' : 'gated'
  if (n === 0) return { lufs: -Infinity, measure, seconds: 0 }
  const l = kWeight(a.L, a.rate)
  const r = kWeight(a.R, a.rate)
  const lk = (p) => -0.691 + 10 * Math.log10(p)
  if (n < block) {
    let s = 0
    for (let i = 0; i < n; i++) s += l[i] * l[i] + r[i] * r[i]
    return { lufs: s > 0 ? lk(s / n) : -Infinity, measure, seconds: secs }
  }
  const step = Math.round(0.1 * a.rate)
  const z = []
  const cum = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + l[i] * l[i] + r[i] * r[i]
  for (let s = 0; s + block <= n; s += step) z.push((cum[s + block] - cum[s]) / block)
  const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length
  const loud = z.filter((p) => p > 0 && lk(p) > -70)
  if (!loud.length) return { lufs: -Infinity, measure, seconds: secs }
  const gate = lk(mean(loud)) - 10
  const kept = loud.filter((p) => lk(p) > gate)
  return { lufs: kept.length ? lk(mean(kept)) : -Infinity, measure, seconds: secs }
}

export const loudness = (a) => loudnessOf(a).lufs

function windowRms(a, win) {
  const n = a.L.length
  const count = Math.max(1, Math.ceil(n / win))
  const out = new Float64Array(count)
  for (let w = 0; w < count; w++) {
    let s = 0
    const end = Math.min(n, (w + 1) * win)
    for (let i = w * win; i < end; i++) s += a.L[i] * a.L[i] + a.R[i] * a.R[i]
    out[w] = Math.sqrt(s / (2 * Math.max(1, end - w * win)))
  }
  return out
}

export function soundSpan(a, relDb) {
  const win = Math.max(1, Math.round(0.005 * a.rate))
  const rms = windowRms(a, win)
  let top = 0
  for (const v of rms) if (v > top) top = v
  const floor = Math.max(top * lin(relDb), lin(-72))
  let first = -1
  let last = -1
  for (let w = 0; w < rms.length; w++) {
    if (rms[w] > floor) {
      if (first < 0) first = w
      last = w
    }
  }
  if (first < 0) return { first: 0, last: 0, silent: true }
  return { first: first * win, last: Math.min(a.L.length, (last + 1) * win), silent: false }
}

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr
        im[i + k + len / 2] = ui - vi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

export function spectrum(a) {
  const size = 4096
  const hop = 2048
  const n = a.L.length
  const power = new Float64Array(size / 2)
  const frames = Math.max(1, Math.ceil(Math.max(0, n - size) / hop) + 1)
  for (let f = 0; f < frames; f++) {
    const re = new Float64Array(size)
    const im = new Float64Array(size)
    for (let i = 0; i < size; i++) {
      const j = f * hop + i
      if (j < n) re[i] = 0.5 * (a.L[j] + a.R[j]) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size))
    }
    fft(re, im)
    for (let k = 0; k < size / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k]
  }
  let total = 0
  let weighted = 0
  const bands = Object.fromEntries(BANDS.map(([name]) => [name, 0]))
  for (let k = 1; k < size / 2; k++) {
    const hz = (k * a.rate) / size
    total += power[k]
    weighted += power[k] * hz
    bands[BANDS.find(([, lo, hi]) => hz >= lo && hz < hi)[0]] += power[k]
  }
  if (total <= 0) return { centroidHz: null, bands }
  for (const k of Object.keys(bands)) bands[k] = round(bands[k] / total, 4)
  return { centroidHz: Math.round(weighted / total), bands }
}

export function measure(a) {
  const flat = withoutOffset(a)
  const span = soundSpan(highpass(flat.audio, 20), -50)
  const n = a.L.length
  const tailN = Math.min(n, Math.round(0.1 * a.rate))
  let tail = 0
  let all = 0
  for (let i = 0; i < n; i++) {
    const p = a.L[i] * a.L[i] + a.R[i] * a.R[i]
    all += p
    if (i >= n - tailN) tail += p
  }
  let events = 0
  if (!span.silent) {
    const env = windowRms(a, Math.max(1, Math.round(0.02 * a.rate)))
    let top = 0
    for (const v of env) if (v > top) top = v
    let on = false
    let quiet = 0
    for (const v of env) {
      if (v > top * lin(-18)) {
        if (!on) events++
        on = true
        quiet = 0
      } else if (v < top * lin(-30) && ++quiet >= 6) on = false
    }
  }
  const whole = loudnessOf(a)
  const short = !span.silent && span.last - span.first < Math.round(LOUDNESS_BLOCK * a.rate) && span.last - span.first < n
  const alone = short ? loudnessOf(slice(a, span.first, span.last)) : null
  return {
    seconds: round(n / a.rate, 3),
    peakDb: round(db(peak(a))),
    truePeakDb: round(db(truePeak(a))),
    lufs: round(whole.lufs),
    lufsMeasure: whole.measure,
    soundLufs: alone ? round(alone.lufs) : null,
    offsetDb: flat.offset > 0 ? round(db(flat.offset)) : null,
    rmsDb: round(n ? db(Math.sqrt(all / (2 * n))) : -Infinity),
    silenceFrontSeconds: round(span.first / a.rate, 3),
    silenceEndSeconds: round((n - span.last) / a.rate, 3),
    soundSeconds: round((span.last - span.first) / a.rate, 3),
    tailDb: round(tailN ? db(Math.sqrt(tail / (2 * tailN))) : -Infinity),
    events,
    spectrum: spectrum(a),
  }
}

export function highpass(a, hz) {
  if (!(hz > 0)) return a
  const w = (2 * Math.PI * hz) / a.rate
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2)
  const c = Math.cos(w)
  const a0 = 1 + alpha
  const run = (x) => biquad(x, (1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - alpha) / a0)
  return { rate: a.rate, L: run(a.L), R: run(a.R) }
}

export function fade(a, inSeconds, outSeconds) {
  const o = slice(a, 0)
  const n = o.L.length
  const ni = Math.min(n, Math.round(inSeconds * a.rate))
  const no = Math.min(n, Math.round(outSeconds * a.rate))
  for (let i = 0; i < ni; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / ni)
    o.L[i] *= g
    o.R[i] *= g
  }
  for (let i = 0; i < no; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / no)
    o.L[n - 1 - i] *= g
    o.R[n - 1 - i] *= g
  }
  return o
}

export function makeLoop(a, loopSeconds, crossSeconds, power = true) {
  const n = a.L.length
  let cross = Math.round(crossSeconds * a.rate)
  let len = Math.round(loopSeconds * a.rate)
  if (len + cross > n) {
    cross = Math.min(cross, Math.floor(n * 0.2))
    len = Math.min(len, n - cross)
  }
  const o = slice(a, 0, len)
  for (let i = 0; i < cross; i++) {
    const t = (i + 0.5) / cross
    const gin = power ? Math.sin((Math.PI / 2) * t) : t
    const gout = power ? Math.cos((Math.PI / 2) * t) : 1 - t
    o.L[i] = a.L[i] * gin + a.L[len + i] * gout
    o.R[i] = a.R[i] * gin + a.R[len + i] * gout
  }
  return { audio: o, crossSeconds: cross / a.rate }
}

export function seam(a) {
  const n = a.L.length
  if (n < 4) return { jump: 0, typicalStep: 0, ratio: 0, levelStepDb: 0 }
  let steps = 0
  for (let i = 1; i < n; i++) steps += (a.L[i] - a.L[i - 1]) ** 2 + (a.R[i] - a.R[i - 1]) ** 2
  const typical = Math.sqrt(steps / (2 * (n - 1)))
  const jump = Math.sqrt(((a.L[0] - a.L[n - 1]) ** 2 + (a.R[0] - a.R[n - 1]) ** 2) / 2)
  const w = Math.min(Math.floor(n / 2), Math.round(0.05 * a.rate))
  const before = db(windowRms(slice(a, n - w), w)[0])
  const after = db(windowRms(slice(a, 0, w), w)[0])
  return { jump: round(jump, 6), typicalStep: round(typical, 6), ratio: round(typical > 0 ? jump / typical : 0, 2), levelStepDb: round(Number.isFinite(before) && Number.isFinite(after) ? after - before : 0) }
}

function withoutOffset(a) {
  const win = Math.max(1, Math.round(0.01 * a.rate))
  const count = Math.floor(a.L.length / win)
  if (!count) return { audio: a, offset: 0 }
  const middle = (x) => {
    const means = new Float64Array(count)
    for (let w = 0; w < count; w++) {
      let sum = 0
      for (let i = w * win; i < (w + 1) * win; i++) sum += x[i]
      means[w] = sum / win
    }
    means.sort()
    return count % 2 ? means[(count - 1) / 2] : (means[count / 2 - 1] + means[count / 2]) / 2
  }
  const l = middle(a.L)
  const r = middle(a.R)
  const offset = Math.max(Math.abs(l), Math.abs(r))
  if (offset <= lin(OFFSET_DB)) return { audio: a, offset: 0 }
  const o = make(a.L.length, a.rate)
  for (let i = 0; i < a.L.length; i++) {
    o.L[i] = a.L[i] - l
    o.R[i] = a.R[i] - r
  }
  return { audio: o, offset }
}

function mainSound(a, from, to, capN) {
  const energy = (x, y) => {
    let s = 0
    for (let i = x; i < y; i++) s += a.L[i] * a.L[i] + a.R[i] * a.R[i]
    return s
  }
  const head = energy(from, from + capN)
  const hop = Math.max(1, Math.round(0.001 * a.rate))
  let run = head
  let best = head
  for (let b = from + hop; b + capN <= to; b += hop) {
    run += energy(b + capN - hop, b + capN) - energy(b - hop, b)
    if (run > best) best = run
  }
  if (head >= best * HEAD_SHARE) return null
  const win = Math.max(1, Math.round(0.005 * a.rate))
  const rms = windowRms(a, win)
  const w0 = Math.floor(from / win)
  const w1 = Math.min(rms.length - 1, Math.floor((to - 1) / win))
  let top = w0
  for (let w = w0; w <= w1; w++) if (rms[w] > rms[top]) top = w
  const floor = rms[top] * lin(ONSET_DB)
  let onset = top
  let quiet = 0
  for (let w = top; w >= w0; w--) {
    if (rms[w] > floor) {
      onset = w
      quiet = 0
    } else if (++quiet >= 4) break
  }
  return onset * win
}

export function keepChain(input, cls, options = {}) {
  const s = { ...chainOf(cls), ...options }
  const steps = []
  const flat = withoutOffset(input)
  let a = flat.audio
  if (flat.offset > 0) steps.push(`took a constant offset of ${round(db(flat.offset))} dB out`)
  if (s.lowCutHz > 0) a = highpass(a, s.lowCutHz)
  const probe = s.lowCutHz >= 20 ? a : highpass(a, 20)
  const span = soundSpan(probe, s.trimDb)
  if (span.silent) throw new Error('the take is silent')
  const pad = Math.round((s.padMs / 1000) * a.rate)
  let from = Math.max(0, span.first - pad)
  const to = Math.min(a.L.length, span.last + pad * 4)
  let moved = null
  const capN = s.capSeconds ? Math.round(s.capSeconds * a.rate) : 0
  if (!s.loop && capN > 0 && to - from > capN) {
    const start = mainSound(probe, from, to, capN)
    if (start !== null && start - pad > from) {
      moved = from
      from = Math.max(0, start - pad)
    }
  }
  a = slice(a, from, to)
  if (s.lowCutHz > 0) steps.push(`low cut at ${s.lowCutHz} Hz, before the trim`)
  steps.push(`trimmed ${round(from / a.rate, 3)} s in front and ${round((input.L.length - to) / a.rate, 3)} s at the end`)
  if (moved !== null) steps.push(`the first ${s.capSeconds} s after the trim at ${round(moved / a.rate, 3)} s held under a quarter of the energy of the loudest ${s.capSeconds} s, so the cut starts where the main sound starts`)
  let loop = null
  if (s.loop) {
    const want = s.capSeconds ?? seconds(a)
    const made = makeLoop(a, want, s.crossSeconds, true)
    a = made.audio
    loop = { seconds: round(seconds(a), 4), crossSeconds: round(made.crossSeconds, 3), seam: seam(a) }
    steps.push(`looped: ${loop.seconds} s with ${loop.crossSeconds} s of its end crossfaded into its start`)
  } else {
    if (s.capSeconds && seconds(a) > s.capSeconds) {
      a = slice(a, 0, Math.round(s.capSeconds * a.rate))
      steps.push(`cut to ${s.capSeconds} s`)
    }
    const out = Math.min(s.fadeOutMs / 1000, seconds(a) * 0.5)
    a = fade(a, s.fadeInMs / 1000, out)
    steps.push(`fade in ${s.fadeInMs} ms, fade out ${Math.round(out * 1000)} ms`)
  }
  const found = loudnessOf(a)
  const before = found.lufs
  if (!Number.isFinite(before)) throw new Error('nothing is left of the take after the low cut and the trim')
  let gainDb = s.targetLufs - before
  const top = db(truePeak(a))
  const over = top + gainDb - (cfg.audio.truePeakDb - PEAK_MARGIN_DB)
  if (over > 0) {
    gainDb -= over
    steps.push(`held ${round(over)} dB under ${s.targetLufs} LUFS so the peak stays under ${cfg.audio.truePeakDb} dB`)
  }
  const spike = found.measure === 'own-length' ? top + gainDb - (s.targetLufs + SHORT_CREST_DB) : 0
  if (spike > 0) {
    gainDb -= spike
    steps.push(`held ${round(spike)} dB under ${s.targetLufs} LUFS so the peak of this short sound stays within ${SHORT_CREST_DB} dB of its class level`)
  }
  a = scale(a, lin(gainDb))
  const words = found.measure === 'own-length' ? `${MEASURES[found.measure]}, ${found.seconds} s` : MEASURES[found.measure]
  steps.push(`level: ${round(gainDb)} dB to ${round(before + gainDb)} LUFS, measured as ${words}`)
  const level = { measure: found.measure, measuredAs: words, seconds: found.seconds, beforeLufs: round(before), afterLufs: round(before + gainDb), targetLufs: s.targetLufs, truePeakDb: round(top + gainDb) }
  return { audio: a, settings: s, steps, gainDb: round(gainDb), loop, level }
}

export function resample(a, ratio) {
  if (ratio === 1) return a
  const n = Math.max(1, Math.floor(a.L.length / ratio))
  const o = make(n, a.rate)
  const at = (x, i) => (i < 0 || i >= x.length ? 0 : x[i])
  for (const [src, dst] of [[a.L, o.L], [a.R, o.R]]) {
    for (let i = 0; i < n; i++) {
      const p = i * ratio
      const k = Math.floor(p)
      const t = p - k
      const y0 = at(src, k - 1)
      const y1 = at(src, k)
      const y2 = at(src, k + 1)
      const y3 = at(src, k + 2)
      dst[i] = y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0)))
    }
  }
  return o
}

function add(bus, a, at, gain = 1) {
  const n = bus.L.length
  const from = Math.max(0, -at)
  const count = Math.min(a.L.length, n - at)
  for (let i = from; i < count; i++) {
    bus.L[at + i] += a.L[i] * gain
    bus.R[at + i] += a.R[i] * gain
  }
  return a.L.length + at > n
}

function addLooped(bus, a, from, to, fadeIn, fadeOut) {
  const rate = bus.rate
  const s0 = Math.max(0, Math.round(from * rate))
  const s1 = Math.min(bus.L.length, Math.round(to * rate))
  const ni = Math.round(fadeIn * rate)
  const no = Math.round(fadeOut * rate)
  const len = a.L.length
  for (let i = s0; i < s1; i++) {
    const k = i - s0
    let g = 1
    if (k < ni) g *= Math.sin((Math.PI / 2) * ((k + 0.5) / ni))
    if (s1 - i <= no) g *= Math.sin((Math.PI / 2) * ((s1 - i - 0.5) / no))
    bus.L[i] += a.L[k % len] * g
    bus.R[i] += a.R[k % len] * g
  }
}

function thin(bus, from, to) {
  const rate = bus.rate
  const s0 = Math.max(0, Math.round(from * rate))
  const s1 = Math.min(bus.L.length, Math.round(to * rate))
  const n = s1 - s0
  if (n <= 0) return
  const tail = Math.max(1, Math.min(n, Math.round(THIN_TAIL * rate)))
  for (const x of [bus.L, bus.R]) {
    let px = s0 > 0 ? x[s0 - 1] : 0
    let p1 = 0
    let pm = 0
    let p2 = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      const hz = 30 * Math.pow(THIN_TOP_HZ / 30, t)
      const c = 1 / (1 + (2 * Math.PI * hz) / rate)
      const v = x[s0 + i]
      const y1 = c * (p1 + v - px)
      const y2 = c * (p2 + y1 - pm)
      px = v
      p1 = y1
      pm = y1
      p2 = y2
      const wet = Math.min(1, t * 8)
      const left = n - i
      const g = lin(THIN_DB * t) * (left <= tail ? Math.sin((Math.PI / 2) * ((left - 0.5) / tail)) : 1)
      x[s0 + i] = (v * (1 - wet) + y2 * wet) * g
    }
  }
}

export function levelDb(a, from = 0, to = a.L.length) {
  const s0 = Math.max(0, from)
  const s1 = Math.min(a.L.length, to)
  if (s1 <= s0) return -Infinity
  let e = 0
  for (let i = s0; i < s1; i++) e += a.L[i] * a.L[i] + a.R[i] * a.R[i]
  return e > 0 ? 10 * Math.log10(e / (2 * (s1 - s0))) : -Infinity
}

export function channelsDb(a, from = 0, to = a.L.length) {
  let l = 0
  let r = 0
  for (let i = Math.max(0, from); i < Math.min(a.L.length, to); i++) {
    l += a.L[i] * a.L[i]
    r += a.R[i] * a.R[i]
  }
  return l > 0 && r > 0 ? 10 * Math.log10(l / r) : 0
}

export function centre(a, most = Infinity) {
  const off = channelsDb(a)
  if (Math.abs(off) < CENTRE_WITHIN_DB) return { audio: a, movedDb: 0 }
  const move = Math.max(-most, Math.min(most, off))
  const l = Math.pow(10, off / 10)
  const k = Math.pow(10, move / 10)
  const gl = Math.sqrt((l + 1) / (l + k))
  const gr = gl * Math.sqrt(k)
  const o = make(a.L.length, a.rate)
  for (let i = 0; i < a.L.length; i++) {
    o.L[i] = a.L[i] * gl
    o.R[i] = a.R[i] * gr
  }
  return { audio: o, movedDb: round(move) }
}

export function musicBars(a, lines) {
  const rate = a.rate
  const n = lines.length
  const bar = n > 1 ? (lines[n - 1] - lines[0]) / (n - 1) : seconds(a) - lines[0]
  const level = lines.map((t, i) => levelDb(a, Math.round(t * rate), Math.round((i + 1 < n ? lines[i + 1] : t + bar) * rate)))
  const open = lines.map((t) => levelDb(a, Math.round(t * rate), Math.round((t + OPEN_SECONDS) * rate)))
  const sorted = level.filter(Number.isFinite).sort((x, y) => x - y)
  const median = sorted.length ? (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2 : -Infinity
  const holds = level.map((v) => v >= median - HOLD_DB)
  const whole = lines.map((t) => Math.round((t + bar) * rate) <= a.L.length)
  let first = holds.findIndex((h, i) => h && open[i] >= median - HOLD_DB)
  if (first < 0) first = Math.max(0, holds.indexOf(true))
  let last = -1
  for (let i = 0; i < n; i++) if (holds[i] && whole[i]) last = i
  if (last < 0) last = Math.max(0, whole.lastIndexOf(true))
  return { bar, level: level.map((v) => round(v)), open: open.map((v) => round(v)), medianDb: round(median), first, last, lastWhole: Math.max(0, whole.lastIndexOf(true)) }
}

export function limit(a, ceiling) {
  const n = a.L.length
  const look = Math.round(0.004 * a.rate)
  const need = new Float64Array(n)
  let any = false
  for (let i = 0; i < n; i++) {
    const m = Math.max(Math.abs(a.L[i]), Math.abs(a.R[i]))
    need[i] = m > ceiling ? ceiling / m : 1
    if (m > ceiling) any = true
  }
  if (!any) return { audio: a, reductionDb: 0 }
  const held = new Float64Array(n)
  const dq = new Int32Array(n)
  let head = 0
  let tail = 0
  for (let i = 0; i < n + look; i++) {
    if (i < n) {
      while (tail > head && need[dq[tail - 1]] >= need[i]) tail--
      dq[tail++] = i
    }
    const out = i - look
    if (out < 0) continue
    while (dq[head] < out) head++
    held[out] = need[dq[head]]
  }
  const release = Math.exp(-1 / (0.08 * a.rate))
  let g = 1
  for (let i = 0; i < n; i++) {
    g = Math.min(held[i], 1 - (1 - g) * release)
    held[i] = g
  }
  const o = make(n, a.rate)
  const win = look + 1
  let acc = 0
  let least = 1
  for (let i = 0; i < n; i++) {
    acc += held[i]
    if (i >= win) acc -= held[i - win]
    const gain = Math.min(1, acc / Math.min(win, i + 1))
    if (gain < least) least = gain
    o.L[i] = a.L[i] * gain
    o.R[i] = a.R[i] * gain
  }
  return { audio: o, reductionDb: round(-db(least)) }
}

export function master(a, target, ceilingDb) {
  const start = loudness(a)
  if (!Number.isFinite(start)) return { audio: a, gainDb: 0, reductionDb: 0, lufs: null, truePeakDb: null, passes: 0, silent: true }
  const goal = ceilingDb - PEAK_MARGIN_DB
  let gainDb = Math.min(36, target - start)
  let ceiling = lin(goal)
  let best = null
  for (let pass = 1; pass <= 14; pass++) {
    const limited = limit(scale(a, lin(gainDb)), ceiling)
    const lufs = loudness(limited.audio)
    const tp = db(truePeak(limited.audio))
    best = { audio: limited.audio, gainDb: round(gainDb, 3), reductionDb: limited.reductionDb, lufs: round(lufs), truePeakDb: round(tp), passes: pass, silent: false }
    const offLevel = Math.abs(lufs - target) > 0.05
    const offPeak = tp > goal + 0.02
    if (!offLevel && !offPeak) break
    if (offPeak) ceiling *= lin(goal - tp)
    if (offLevel) gainDb = Math.min(36, gainDb + (target - lufs))
  }
  return best
}

// The film carries an encoded copy of the mix, and an encoder can throw a peak above the wav's own at a
// hard start. The copy is made the way the film's export makes it and comes back in step with the wav.
export function encodedCopy(a, codec = cfg.export?.audioCodec, kbps = cfg.export?.audioKbps) {
  const encoder = ENCODERS[codec]
  if (!encoder || !(kbps > 0) || a.L.length === 0) return null
  const enc = ffmpeg(['-v', 'error', '-nostdin', '-f', 'wav', '-i', 'pipe:0', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags', '+bitexact', '-c:a', encoder, '-b:a', `${kbps}k`, '-ar', String(a.rate), '-f', 'adts', 'pipe:1'], { input: encodeWav(a) })
  if (enc.code !== 0 || enc.stdout.length === 0) throw new Error(`ffmpeg could not encode the mix as ${codec}: ${enc.stderr.trim().split('\n').pop() ?? ''}`)
  const dec = ffmpeg(['-v', 'error', '-nostdin', '-f', 'aac', '-i', 'pipe:0', '-f', 'f32le', '-ac', '2', '-ar', String(a.rate), 'pipe:1'], { input: enc.stdout })
  if (dec.code !== 0 || dec.stdout.length === 0) throw new Error(`ffmpeg could not read the ${codec} copy of the mix: ${dec.stderr.trim().split('\n').pop() ?? ''}`)
  const late = ENCODER_DELAY[codec] ?? 0
  const n = Math.max(0, Math.min(a.L.length, Math.floor(dec.stdout.length / 8) - late))
  const back = make(n, a.rate)
  for (let i = 0; i < n; i++) {
    back.L[i] = dec.stdout.readFloatLE((i + late) * 8)
    back.R[i] = dec.stdout.readFloatLE((i + late) * 8 + 4)
  }
  return back
}

export function encodedTruePeak(a, codec = cfg.export?.audioCodec, kbps = cfg.export?.audioKbps) {
  const back = encodedCopy(a, codec, kbps)
  return back ? db(truePeak(back)) : null
}

// The true peak of each short window, read between the samples only where a sample comes near `least`.
function windowPeaks(a, win, least) {
  const n = a.L.length
  const out = new Float64Array(Math.ceil(n / win))
  const half = TP_TAPS / 2 - 1
  for (const x of [a.L, a.R]) {
    for (let i = 0; i < n; i++) {
      const w = Math.floor(i / win)
      const v = Math.abs(x[i])
      if (v > out[w]) out[w] = v
      if (v * 2 < least && Math.abs(x[Math.min(n - 1, i + 1)]) * 2 < least) continue
      for (const h of TP_PHASES) {
        let s = 0
        for (let k = 0; k < TP_TAPS; k++) {
          const j = i - half + k
          if (j >= 0 && j < n) s += h[k] * x[j]
        }
        if (s > out[w]) out[w] = s
        else if (-s > out[w]) out[w] = -s
      }
    }
  }
  return out
}

// Where the encoded copy stands over its limit, the wav gives way there and only there: a short dip as
// deep as the copy is over, with a slope each side, read again until the copy fits. The rest of the mix
// keeps its level, which a lower ceiling for the whole film would not allow.
export function giveWay(a, ceilingDb, codec = cfg.export?.audioCodec, kbps = cfg.export?.audioKbps) {
  const goal = lin(ceilingDb - ENCODE_ROOM_DB)
  const n = a.L.length
  const win = Math.max(1, Math.round(GIVE_WINDOW * a.rate))
  const edge = Math.max(1, Math.round(GIVE_EDGE * a.rate))
  const taken = new Map()
  let audio = a
  let encodedDb = null
  for (let pass = 0; pass <= GIVE_PASSES; pass++) {
    const back = encodedCopy(audio, codec, kbps)
    if (!back) return { audio: a, encodedDb: null, places: [] }
    const peaks = windowPeaks(back, win, goal)
    let top = 0
    const over = []
    peaks.forEach((v, w) => {
      if (v > top) top = v
      if (v > goal) over.push([w, db(v / goal)])
    })
    encodedDb = top > goal / 2 ? db(top) : db(truePeak(back))
    if (!over.length || pass === GIVE_PASSES) break
    const curve = new Float64Array(n).fill(1)
    for (const [w, by] of over) {
      const depth = by + GIVE_MORE_DB
      taken.set(w, (taken.get(w) ?? 0) + depth)
      const from = w * win
      const to = Math.min(n, from + win)
      for (let i = Math.max(0, from - edge); i < Math.min(n, to + edge); i++) {
        const u = i < from ? (i - (from - edge) + 0.5) / edge : i >= to ? (to + edge - i - 0.5) / edge : 1
        const g = lin(-depth * (0.5 - 0.5 * Math.cos(Math.PI * u)))
        if (g < curve[i]) curve[i] = g
      }
    }
    const next = make(n, a.rate)
    for (let i = 0; i < n; i++) {
      next.L[i] = audio.L[i] * curve[i]
      next.R[i] = audio.R[i] * curve[i]
    }
    audio = next
  }
  const places = [...taken].sort((p, q) => p[0] - q[0]).map(([w, by]) => ({ at: round((w * win) / a.rate, 3), db: round(by) }))
  return { audio, encodedDb, places }
}

function accent(bus, times, trims) {
  const rate = bus.rate
  const o = slice(bus, 0)
  const pre = Math.max(1, Math.round(0.002 * rate))
  const hold = Math.round(OPEN_SECONDS * rate)
  const ease = Math.max(1, Math.round(LANDING_EASE * rate))
  times.forEach((t, k) => {
    if (!trims[k]) return
    const at = Math.round(t * rate)
    for (let i = Math.max(0, at - pre); i < Math.min(o.L.length, at + hold + ease); i++) {
      const u = i < at ? (i - (at - pre) + 0.5) / pre : i < at + hold ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (i - at - hold + 0.5)) / ease)
      const g = lin(trims[k] * u)
      o.L[i] *= g
      o.R[i] *= g
    }
  })
  return o
}

export function keptFile(id, dir = KEPT) {
  const file = path.join(dir, `${id}.wav`)
  return fs.existsSync(file) ? file : null
}

// Laid by decision 141 of kit/PROGRESS.md. Where every allowed take of a cue is used and its silence reads as a fault,
// the nearest right sound plays in its place. It is not a kept take and its cue stays open: its record lies in
// audio/laid/ and never in audio/kept/, its state begins "laid by decision 141", and no check counts it as kept.
// Two kinds: a borrow (a kept sound of another cue at a fixed pitch offset) and a set (the presses of one take, each cut
// out by a fixed window, band limited, levelled alike, which the mix takes in turn).
export const LAID = rel('audio', 'laid')
export const LAID_STATE = 'laid by decision 141'
export const laidDirOf = (keptDir = KEPT) => path.join(path.dirname(keptDir), 'laid')

export function readLaid(dir = LAID) {
  if (!fs.existsSync(dir)) return []
  const order = cfg.audio.sfx.map((s) => s.id)
  const rank = (id) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id))
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.json') && !n.endsWith('.wav.json'))
    .map((n) => ({ id: n.slice(0, -5), record: readJson(path.join(dir, n)), file: fs.existsSync(path.join(dir, `${n.slice(0, -5)}.wav`)) ? path.join(dir, `${n.slice(0, -5)}.wav`) : null }))
    .filter((l) => typeof l.record?.state === 'string' && l.record.state.startsWith(LAID_STATE))
    .sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1))
}

// The first moment of a sound eased in from nothing along a raised cosine. The rest is untouched.
export function riseIn(a, seconds) {
  const n = Math.min(a.L.length, Math.round(seconds * a.rate))
  if (n < 2) return a
  const o = { rate: a.rate, L: Float64Array.from(a.L), R: Float64Array.from(a.R) }
  for (let i = 0; i < n; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / n)
    o.L[i] *= g
    o.R[i] *= g
  }
  return o
}

// A laid sound as the mix and the pack take it: the file, its record and, for a set, each press as its own sound.
export function laidSound(id, dir = LAID, rate = RATE) {
  const file = path.join(dir, `${id}.wav`)
  const rec = path.join(dir, `${id}.json`)
  if (!fs.existsSync(file) || !fs.existsSync(rec)) return null
  const record = readJson(rec)
  if (typeof record?.state !== 'string' || !record.state.startsWith(LAID_STATE)) return null
  const audio = decodeFile(file, rate)
  const presses = Array.isArray(record.presses) && record.presses.length ? record.presses.map((p) => slice(audio, Math.round(Number(p.at) * rate), Math.round((Number(p.at) + Number(p.seconds)) * rate))) : null
  const step = Math.max(1, Math.round(Number(record.recipe?.step ?? 1)))
  return { file, record, audio, set: presses ? { presses, step, varied: record.recipe?.varied === true } : null }
}

// The parts of a short sound under a frequency, with nothing moved in time: the sound is taken as one period, what lies
// over endHz is dropped and what lies between hz and endHz is eased out along a raised cosine.
export function lowpassWhole(a, hz, endHz = hz * 1.4) {
  const n = a.L.length
  if (!(hz > 0) || n < 2) return a
  const cos = new Float64Array(n)
  const sin = new Float64Array(n)
  for (let j = 0; j < n; j++) {
    cos[j] = Math.cos((2 * Math.PI * j) / n)
    sin[j] = Math.sin((2 * Math.PI * j) / n)
  }
  const half = Math.floor(n / 2)
  const run = (x) => {
    const y = new Float64Array(n)
    for (let k = 0; k <= half; k++) {
      const f = (k * a.rate) / n
      const g = f <= hz ? 1 : f >= endHz ? 0 : 0.5 * (1 + Math.cos((Math.PI * (f - hz)) / (endHz - hz)))
      if (g === 0) break
      let re = 0
      let im = 0
      for (let i = 0, j = 0; i < n; i++, j = (j + k) % n) {
        re += x[i] * cos[j]
        im -= x[i] * sin[j]
      }
      const w = ((k === 0 || (n % 2 === 0 && k === half) ? 1 : 2) * g) / n
      for (let i = 0, j = 0; i < n; i++, j = (j + k) % n) y[i] += w * (re * cos[j] - im * sin[j])
    }
    return y
  }
  return { rate: a.rate, L: run(a.L), R: run(a.R) }
}

// Builds the sound of a laid record from its recipe. The same recipe and the same sources give the same bytes.
export function buildLaid(recipe, { takesDir = TAKES, keptDir = KEPT, rate = RATE } = {}) {
  if (recipe?.borrow) {
    const b = recipe.borrow
    const file = path.join(keptDir, `${b.kept}.wav`)
    if (!fs.existsSync(file)) throw new Error(`the kept sound to borrow is not in this workspace: ${file}`)
    const cents = Number(b.cents ?? 0)
    if (!Number.isFinite(cents)) throw new Error('a borrow needs cents as a number')
    const a = decodeFile(file, rate)
    return { audio: cents ? resample(a, Math.pow(2, cents / 1200)) : a, presses: null, source: { kept: b.kept, sha256: fileSha(file) } }
  }
  if (recipe?.set) {
    const s = recipe.set
    const file = path.join(takesDir, String(s.cue), `take-${s.take}.wav`)
    if (!fs.existsSync(file)) throw new Error(`the take of the set is not in this workspace: ${file}`)
    if (!Array.isArray(s.windows) || !s.windows.length) throw new Error('a set needs its windows, each [from, to] in seconds of the take')
    if (!Number.isFinite(Number(s.pressDb))) throw new Error('a set needs pressDb, the level every press is brought to')
    const take = decodeFile(file, rate)
    const gap = Math.round(SET_GAP * rate)
    const parts = []
    const presses = []
    let at = 0
    for (const [from, to] of s.windows) {
      let p = slice(take, Math.round(Number(from) * rate), Math.round(Number(to) * rate))
      if (s.highCutHz) p = lowpassWhole(p, Number(s.highCutHz), Number(s.highCutEndHz ?? Number(s.highCutHz) * 1.4))
      const n = p.L.length
      const ni = Math.min(n, Math.floor((Number(s.fadeInMs ?? 0) / 1000) * rate))
      const no = Math.min(n >> 1, Math.floor((Number(s.fadeOutMs ?? 0) / 1000) * rate))
      for (let i = 0; i < ni; i++) {
        const g = ni > 1 ? i / (ni - 1) : 1
        p.L[i] *= g
        p.R[i] *= g
      }
      for (let i = 0; i < no; i++) {
        const g = no > 1 ? 1 - i / (no - 1) : 0
        p.L[n - no + i] *= g
        p.R[n - no + i] *= g
      }
      const level = levelDb(p)
      if (!Number.isFinite(level)) throw new Error(`the window ${from} to ${to} s of the take holds no sound`)
      p = scale(p, lin(Number(s.pressDb) - level))
      presses.push({ at: round(at / rate, 6), seconds: round(n / rate, 6), fromDb: round(level) })
      parts.push(p, make(gap, rate))
      at += n + gap
    }
    return { audio: concat(parts, rate), presses, source: { cue: String(s.cue), take: Number(s.take), sha256: fileSha(file) } }
  }
  throw new Error('a laid record needs recipe.borrow or recipe.set')
}

export function mixFilm({ cut, which = 'b', candidate = 'blockout', keptDir = KEPT, laidDir = laidDirOf(keptDir), mapsDir = rel('out', 'work', 'audio', 'maps'), musicFile = null, skip = [], gains = {}, rate = RATE, target = cfg.audio.filmLoudnessLufs, ceilingDb = cfg.audio.truePeakDb }) {
  const offset = which === 'a' ? Number(cut.opening?.seconds ?? 0) : 0
  const total = Math.round((offset + cut.seconds) * rate)
  const bus = make(total, rate)
  const music = make(total, rate)
  const cache = new Map()
  const inputs = {}
  const laid = {}
  const load = (id) => {
    if (cache.has(id)) return cache.get(id)
    const file = keptFile(id, keptDir)
    let a = file ? decodeFile(file, rate) : null
    if (file) inputs[id] = fileSha(file)
    else {
      // No kept take: a sound laid by decision 141 plays in its place, and the report names it as that.
      const l = laidSound(id, laidDir, rate)
      if (l) {
        a = l.audio
        inputs[`laid:${id}`] = fileSha(l.file)
        laid[id] = l
      }
    }
    cache.set(id, a)
    return a
  }
  const placed = []
  const skipped = new Map()
  const miss = (id, why) => skipped.set(id, why)
  const gainOf = (id, entry) => lin((gains[id] ?? 0) + Number(entry?.gainDb ?? 0))
  const counts = {}
  const cues = [...(which === 'a' ? (cut.opening?.cues ?? []).map((c) => ({ ...c, at: Number(c.at) })) : []), ...(cut.cues ?? []).map((c) => ({ ...c, at: Number(c.at) + offset }))]
  for (const c of cues) {
    if (skip.includes(c.cue)) {
      miss(c.cue, 'left out by --skip')
      continue
    }
    let a = load(c.cue)
    if (!a) {
      miss(c.cue, 'no kept file')
      continue
    }
    const k = counts[c.cue] ?? 0
    counts[c.cue] = k + 1
    // A laid set gives its presses in turn (press k times its step), each a different press of the take, so no pitch
    // offset is needed to keep one press from sounding as a wheel; its own record says whether the offsets are used.
    const set = laid[c.cue]?.set ?? null
    const press = set ? (k * set.step) % set.presses.length : null
    if (set) a = set.presses[press]
    const offsets = set && !set.varied ? null : VARIED[c.cue]
    const cents = offsets ? offsets[k % offsets.length] : 0
    if (cents) a = resample(a, Math.pow(2, cents / 1200))
    const hand = HAND[c.cue]
    const moveMs = hand ? hand.ms[k % hand.ms.length] : 0
    if (Math.abs(moveMs) > HAND_LIMIT_MS) throw new Error(`${c.cue} would begin ${moveMs} ms from its place: the limit is ${HAND_LIMIT_MS} ms (decision 144)`)
    // The level of a set is in its record (the level every press is brought to), so the step down of one kept press is not taken twice.
    const downDb = hand ? hand.db[k % hand.db.length] - (set ? 0 : (hand.underDb ?? 0)) : 0
    // A shake comes down and rises over its first moment (decision 142), kept or laid alike.
    const shake = isShake(c.cue) ? SHAKE : null
    const shakeDb = shakeStepDb(c.cue)
    if (shake) a = riseIn(a, shake.riseMs / 1000)
    add(bus, a, Math.max(0, Math.round((c.at + moveMs / 1000) * rate)), gainOf(c.cue, c) * lin(downDb + shakeDb))
    placed.push({ cue: c.cue, at: round(c.at, 4), cents, ...(hand ? { moveMs, downDb } : {}), ...(shake ? { downDb: shakeDb, riseMs: shake.riseMs } : {}), ...(set ? { press } : {}) })
  }
  for (const e of cut.ambience ?? []) {
    if (skip.includes(e.cue)) {
      miss(e.cue, 'left out by --skip')
      continue
    }
    const a = load(e.cue)
    if (!a) {
      miss(e.cue, 'no kept file')
      continue
    }
    addLooped(bus, gainOf(e.cue, e) === 1 ? a : scale(a, gainOf(e.cue, e)), e.from + offset, e.to + offset, e.fadeIn, e.fadeOut)
    placed.push({ cue: e.cue, from: round(e.from + offset, 4), to: round(e.to + offset, 4) })
  }

  const musicNote = { candidate, source: 'none', parts: [] }
  const barSeconds = (cut.beatsPerBar * 60) / cut.bpm
  const mapOf = (id) => {
    const f = path.join(mapsDir, `${id}.json`)
    return fs.existsSync(f) ? readJson(f) : null
  }
  const whole = (a, name) => {
    const cutOff = add(music, a, Math.round(offset * rate), lin(gains.music ?? 0))
    musicNote.parts.push({ id: name, at: round(offset, 4), seconds: round(seconds(a), 3), cutAtTheEnd: cutOff })
  }
  if (musicFile) {
    inputs[`music:${path.basename(musicFile)}`] = fileSha(musicFile)
    musicNote.source = path.basename(musicFile)
    whole(decodeFile(musicFile, rate), path.basename(musicFile))
  } else if (candidate === 'one-piece') {
    const a = load('music-one-piece')
    if (a) {
      musicNote.source = 'music-one-piece'
      whole(a, 'music-one-piece')
    } else miss('music-one-piece', 'no kept file')
  } else if (candidate === 'four-tracks') {
    const sections = cut.sections ?? []
    const seen = {}
    sections.forEach((sec, index) => {
      const id = `music-${sec.season}`
      const kept = load(id)
      if (!kept) {
        miss(id, 'no kept file')
        return
      }
      musicNote.source = 'four tracks'
      if (!seen[id]) seen[id] = { ...centre(kept), next: null }
      const a = seen[id].audio
      const map = mapOf(id)
      const lines = Array.isArray(map?.barLines) && map.barLines.length ? map.barLines : Array.from({ length: Math.max(1, Math.floor(seconds(a) / barSeconds)) }, (_, i) => i * barSeconds)
      const found = musicBars(a, lines)
      const bars = Math.max(1, Math.round((sec.to - sec.from) / barSeconds))
      const again = seen[id].next !== null
      const lastSection = index === sections.length - 1
      const toTheEnd = found.last - bars + 1
      const wanted = lastSection ? toTheEnd : !again ? found.first : seen[id].next + bars - 1 <= found.last ? seen[id].next : toTheEnd
      const first = Math.max(0, Math.min(wanted, found.lastWhole - bars + 1))
      seen[id].next = first + bars
      const src = Math.round(lines[first] * rate)
      const len = Math.round((sec.to - sec.from) * rate)
      const part = fade(slice(a, src, src + len), 0.002, 0)
      const section = make(total, rate)
      add(section, part, Math.round((sec.from + offset) * rate), lin(gains.music ?? 0))
      if (!lastSection) thin(section, sec.to + offset - barSeconds, sec.to + offset)
      add(music, section, 0)
      musicNote.parts.push({ id, at: round(sec.from + offset, 4), fromBar: first, toBar: first + bars - 1, sourceAt: round(lines[first], 3), seconds: round(part.L.length / rate, 3), barLines: map ? 'map' : 'grid', firstBarWithMusic: found.first, lastBarWithMusic: found.last, centredByDb: seen[id].movedDb, thinned: !lastSection })
    })
  }
  if (which === 'a' && musicNote.source !== 'none') musicNote.note = 'the music starts on frame 0 of film B'

  const beat = barSeconds / Math.max(1, Number(cut.beatsPerBar) || 1)
  const endFade = (bus2, sec) => {
    const n = Math.min(total, Math.round(sec * rate))
    for (let i = 0; i < n; i++) {
      const g = Math.sin((Math.PI / 2) * ((i + 0.5) / n))
      bus2.L[total - 1 - i] *= g
      bus2.R[total - 1 - i] *= g
    }
  }
  const musicRunsOn = musicNote.parts.some((p) => p.cutAtTheEnd)
  if (musicRunsOn) {
    endFade(music, barSeconds)
    musicNote.end = 'the music is longer than the film and fades over the last bar'
  }
  add(bus, music, 0)
  endFade(bus, beat)
  endFade(music, beat)

  const landingTimes = (Array.isArray(cut.landings) && cut.fps > 0 ? cut.landings.map((f) => Number(f) / cut.fps) : (cut.sections ?? []).slice(1).map((sec) => Number(sec.from))).map((t) => t + offset).filter((t) => t >= 0 && Math.round((t + OPEN_SECONDS) * rate) <= total)
  const firstMoment = (a) => landingTimes.map((t) => levelDb(a, Math.round(t * rate), Math.round((t + OPEN_SECONDS) * rate)))
  const spreadOf = (v) => {
    const f = v.filter(Number.isFinite)
    return f.length > 1 ? Math.max(...f) - Math.min(...f) : 0
  }
  const centred = centre(bus, BUS_CENTRE_DB)
  // One finish of the film: the landings' trims, the level and the limit, then the encoded copy's peak.
  const finish = (trims, room) => {
    const m = master(accent(centred.audio, landingTimes, trims), target, ceilingDb - room)
    if (m.silent) return { ...m, encodedDb: null, places: [] }
    const fit = giveWay(m.audio, ceilingDb)
    if (!fit.places.length) return { ...m, encodedDb: fit.encodedDb, places: [] }
    return { ...m, audio: fit.audio, lufs: round(loudness(fit.audio)), truePeakDb: round(db(truePeak(fit.audio))), encodedDb: fit.encodedDb, places: fit.places }
  }
  let trims = landingTimes.map(() => 0)
  let room = 0
  let done = finish(trims, room)
  const before = done.silent ? [] : firstMoment(done.audio)
  let heard = before
  let rounds = 0
  while (!done.silent && rounds < 4 && spreadOf(heard) > LANDING_MATCH_DB) {
    const f = heard.filter(Number.isFinite)
    const goal = (Math.max(...f) + Math.min(...f)) / 2
    const next = trims.map((v, k) => (Number.isFinite(heard[k]) ? Math.max(-LANDING_TRIM_DB, Math.min(LANDING_TRIM_DB, v + goal - heard[k])) : v))
    if (next.every((v, k) => Math.abs(v - trims[k]) < 0.02)) break
    trims = next
    rounds++
    done = finish(trims, room)
    heard = firstMoment(done.audio)
  }
  // Only if giving way where the copy is over was not enough does the whole film get a lower ceiling.
  for (let pass = 0; !done.silent && done.encodedDb !== null && pass < 3 && done.encodedDb > ceilingDb - ENCODE_ROOM_DB + 0.01; pass++) {
    room += done.encodedDb - ceilingDb + ENCODE_ROOM_DB + 0.1
    done = finish(trims, room)
    heard = firstMoment(done.audio)
  }
  const encodedDb = done.encodedDb ?? null
  const stem = done.silent ? music : scale(music, lin(done.gainDb))
  // The taps against the keys of the cut list (decision 144): one tap for each key, none without a key, and how far the
  // furthest begins from the time of its own key.
  const keys = which === 'a' ? (cut.opening?.cues ?? []).filter((c) => HAND[c.cue]).map((c) => round(Number(c.at), 4)) : []
  const taps = placed.filter((p) => HAND[p.cue])
  const unmet = [...keys]
  let withoutKey = 0
  for (const t of taps) {
    const i = unmet.indexOf(t.at)
    if (i < 0) withoutKey++
    else unmet.splice(i, 1)
  }
  const moves = taps.map((t) => t.moveMs)
  const typing = { keys: keys.length, taps: taps.length, withoutKey, keysWithoutTap: unmet.length, limitMs: HAND_LIMIT_MS, largestOffsetMs: moves.length ? Math.max(...moves.map((v) => Math.abs(v))) : 0, earliestMs: moves.length ? Math.min(...moves) : 0, latestMs: moves.length ? Math.max(...moves) : 0 }
  return {
    audio: done.audio,
    music: stem,
    report: {
      which,
      candidate,
      seconds: round(total / rate, 4),
      openingSeconds: round(offset, 4),
      placed,
      skipped: [...skipped].map(([cue, why]) => ({ cue, why })),
      laid: Object.entries(laid).map(([cue, l]) => ({ cue, state: l.record.state, kept: false, times: placed.filter((p) => p.cue === cue).length, ...(l.set ? { presses: l.set.presses.length, step: l.set.step, varied: l.set.varied } : {}) })),
      typing,
      music: musicNote,
      landings: { at: landingTimes.map((t) => round(t, 4)), firstMomentSeconds: OPEN_SECONDS, beforeDb: before.map((v) => round(v)), trimsDb: trims.map((v) => round(v)), afterDb: heard.map((v) => round(v)), spreadDb: round(spreadOf(heard)), rounds },
      channels: { leftOverRightDb: done.silent ? 0 : round(channelsDb(done.audio)), busMovedDb: centred.movedDb },
      master: { targetLufs: target, ceilingDb, gainDb: done.gainDb, limiterReductionDb: done.reductionDb, lufs: done.lufs, truePeakDb: done.truePeakDb, passes: done.passes, silent: done.silent, encoded: encodedDb === null ? null : { codec: cfg.export.audioCodec, kbps: cfg.export.audioKbps, truePeakDb: round(encodedDb), roomDb: round(room), gaveWay: done.places } },
      inputs,
    },
  }
}

// Laying sounds together (decisions 111 and 134 of kit/PROGRESS.md). One call of the sound tool gives one
// thing, so a cue whose line names two or three is laid from parts: takes of the cue, a kept take of
// another cue whose line names the same thing, and, only as quiet support, a plain made layer. Every
// number is fixed in the recipe, so the same recipe gives the same bytes. Laying costs no credit and
// is not a take: the laid sound is heard and judged like one before it is kept.
export const MADE_UNDER_DB = 12

function mulberry(seed) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function lowpass(a, hz) {
  if (!(hz > 0) || hz >= a.rate / 2) return a
  const w = (2 * Math.PI * hz) / a.rate
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2)
  const c = Math.cos(w)
  const a0 = 1 + alpha
  const run = (x) => biquad(x, (1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, (-2 * c) / a0, (1 - alpha) / a0)
  return { rate: a.rate, L: run(a.L), R: run(a.R) }
}

// A made layer: shaped noise (a hiss of snow or sand) or one steady tone. Nothing made stands in for a cue.
function madeLayer(spec, rate) {
  const n = Math.max(1, Math.round(Number(spec.seconds) * rate))
  const o = make(n, rate)
  if (spec.made === 'noise') {
    const rand = mulberry(Number(spec.seed ?? 1))
    for (let i = 0; i < n; i++) {
      o.L[i] = rand() * 2 - 1
      o.R[i] = rand() * 2 - 1
    }
    let a = o
    for (let k = 0; k < 2; k++) a = lowpass(highpass(a, Number(spec.fromHz ?? 0)), Number(spec.toHz ?? 0))
    return a
  }
  if (spec.made === 'tone') {
    const hz = Number(spec.hz)
    if (!(hz > 0)) throw new Error('a made tone needs hz')
    const waverHz = Number(spec.waverHz ?? 0)
    const waverCents = Number(spec.waverCents ?? 0)
    const partials = Array.isArray(spec.partials) && spec.partials.length ? spec.partials.map(Number) : [1]
    let phase = 0
    for (let i = 0; i < n; i++) {
      const bend = waverHz > 0 ? Math.pow(2, (waverCents * Math.sin((2 * Math.PI * waverHz * i) / rate)) / 1200) : 1
      phase += (2 * Math.PI * hz * bend) / rate
      let v = 0
      partials.forEach((g, k) => (v += g * Math.sin(phase * (k + 1))))
      o.L[i] = v
      o.R[i] = v
    }
    return o
  }
  throw new Error(`no such made layer: ${spec.made} (noise or tone)`)
}

export function layTogether(recipe, { takesDir = TAKES, keptDir = KEPT, rate = RATE } = {}) {
  const specs = Array.isArray(recipe?.layers) ? recipe.layers : []
  if (!specs.length) throw new Error('a lay needs at least one layer')
  if (specs[0].made) throw new Error('the first layer is the main one, and nothing made stands in for a cue')
  const parts = specs.map((l) => {
    let a
    let source
    if (l.made) {
      a = madeLayer(l, rate)
      source = { made: l.made }
    } else {
      const file = l.kept ? path.join(keptDir, `${l.kept}.wav`) : path.join(takesDir, String(l.cue ?? recipe.cue), `take-${l.take}.wav`)
      if (!fs.existsSync(file)) throw new Error(`the layer's file is not in this workspace: ${file}`)
      a = decodeFile(file, rate)
      source = l.kept ? { kept: l.kept, sha256: fileSha(file) } : { cue: String(l.cue ?? recipe.cue), take: Number(l.take), sha256: fileSha(file) }
    }
    if (l.from !== undefined || l.to !== undefined) a = slice(a, Math.round(Number(l.from ?? 0) * rate), l.to !== undefined ? Math.round(Number(l.to) * rate) : a.L.length)
    if (l.cents) a = resample(a, Math.pow(2, Number(l.cents) / 1200))
    if (l.lowCutHz) a = highpass(a, Number(l.lowCutHz))
    if (l.highCutHz) a = lowpass(a, Number(l.highCutHz))
    if (l.fadeInMs || l.fadeOutMs) a = fade(a, Number(l.fadeInMs ?? 0) / 1000, Number(l.fadeOutMs ?? 0) / 1000)
    const span = soundSpan(a, -40)
    return { l, a, source, level: span.silent ? -Infinity : levelDb(a, span.first, span.last) }
  })
  const main = parts[0]
  if (!Number.isFinite(main.level)) throw new Error('the main layer holds no sound')
  const ends = parts.map((p) => Math.round(Number(p.l.at ?? 0) * rate) + p.a.L.length)
  const total = recipe.seconds > 0 ? Math.round(Number(recipe.seconds) * rate) : Math.max(...ends)
  const bus = make(total, rate)
  const layers = parts.map((p, k) => {
    const under = k === 0 ? 0 : Number(p.l.underDb)
    if (!Number.isFinite(under)) throw new Error(`layer ${k + 1} needs underDb, its level under the main layer`)
    if (!Number.isFinite(p.level)) throw new Error(`layer ${k + 1} holds no sound`)
    if (p.l.made && under < MADE_UNDER_DB) throw new Error(`a made layer is quiet support: at least ${MADE_UNDER_DB} dB under the main layer, not ${under}`)
    const gainDb = main.level - under - p.level
    add(bus, p.a, Math.round(Number(p.l.at ?? 0) * rate), lin(gainDb))
    const { underDb: _under, ...asked } = p.l
    return { ...asked, source: p.source, underMainDb: under, gainDb: round(gainDb), levelDb: round(p.level + gainDb), seconds: round(p.a.L.length / rate, 3) }
  })
  // The file is whole numbers: a sum that stands over full scale would be cut off. The whole lay is turned down so its top stays 1 dB under it.
  const top = db(peak(bus))
  const roomDb = top > -1 ? round(-1 - top) : 0
  if (roomDb < 0) {
    const g = lin(roomDb)
    for (let i = 0; i < bus.L.length; i++) {
      bus.L[i] *= g
      bus.R[i] *= g
    }
    for (const l of layers) {
      l.gainDb = round(l.gainDb + roomDb)
      l.levelDb = round(l.levelDb + roomDb)
    }
  }
  return { audio: bus, layers, roomDb, sha256: sha256(encodeWav(bus)) }
}

export function readLedger() {
  const empty = { version: 1, takes: [], kept: [], pack: null, mixes: {} }
  if (!fs.existsSync(LEDGER)) return empty
  return { ...empty, ...readJson(LEDGER) }
}
export const writeLedger = (ledger) => writeJson(LEDGER, ledger)

export function currentRound() {
  try {
    const m = /^- Review round:\s*(\d+)\s*$/m.exec(fs.readFileSync(rel('kit', 'PROGRESS.md'), 'utf8'))
    return m ? `review-${m[1]}` : 'build'
  } catch {
    return 'build'
  }
}

export function readKept(dir = KEPT) {
  if (!fs.existsSync(dir)) return []
  const order = cfg.audio.sfx.map((s) => s.id)
  const rank = (id) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id))
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.json') && !n.endsWith('.wav.json'))
    .map((n) => ({ id: n.slice(0, -5), record: readJson(path.join(dir, n)), file: keptFile(n.slice(0, -5), dir) }))
    .sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1))
}

function encodeMp3(a, file, kbps) {
  const r = ffmpeg(['-v', 'error', '-nostdin', '-y', '-f', 'wav', '-i', 'pipe:0', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags', '+bitexact', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, '-ar', String(a.rate), '-ac', '2', '-id3v2_version', '0', '-write_xing', '1', file], { input: encodeWav(a) })
  if (r.code !== 0 || !fs.existsSync(file)) throw new Error(`ffmpeg could not write ${file}: ${r.stderr.trim().split('\n').pop() ?? ''}`)
  return fs.statSync(file).size
}

function concat(parts, rate) {
  const n = parts.reduce((s, p) => s + p.L.length, 0)
  const o = make(n, rate)
  let at = 0
  for (const p of parts) {
    o.L.set(p.L, at)
    o.R.set(p.R, at)
    at += p.L.length
  }
  return o
}

export function loopEnds(a) {
  const n = a.L.length
  const second = Math.min(Math.round(a.rate), n >> 1)
  const s = seam(a)
  return { ...s, secondStepDb: round(levelDb(a, 0, second) - levelDb(a, n - second, n)) }
}

// One period of a loop as the app plays it: the first seam of a pass rises as a sine while the last seam of the pass
// before it falls as a cosine. body is one pass: the period and, after it, the seam.
export function heardLoop(body, seamSeconds) {
  const n = body.L.length
  const s = Math.max(0, Math.min(Math.round(seamSeconds * body.rate), n >> 1))
  const p = n - s
  const o = slice(body, 0, p)
  for (let i = 0; i < s; i++) {
    const t = ((i + 0.5) / s) * (Math.PI / 2)
    const up = Math.sin(t)
    const down = Math.cos(t)
    o.L[i] = body.L[i] * up + body.L[p + i] * down
    o.R[i] = body.R[i] * up + body.R[p + i] * down
  }
  return { audio: o, seamSeconds: s / body.rate, periodSeconds: p / body.rate }
}

// The numbers of that period: its length, and the level through the crossed seam against the mean of the whole period.
// startAloneDb and tailAloneDb are the two sounds that are crossed, each alone, against the same mean.
export function heardSeam(body, seamSeconds) {
  const h = heardLoop(body, seamSeconds)
  const s = Math.round(h.seamSeconds * body.rate)
  const mean = levelDb(h.audio)
  const q = Math.max(1, Math.round(s / 4))
  const against = (v) => (Number.isFinite(v) && Number.isFinite(mean) ? round(v - mean) : 0)
  return {
    periodSeconds: round(h.periodSeconds, 4),
    seamSeconds: round(h.seamSeconds, 4),
    meanDb: round(mean),
    seamDb: s > 0 ? against(levelDb(h.audio, 0, s)) : 0,
    quartersDb: s > 0 ? [0, 1, 2, 3].map((k) => against(levelDb(h.audio, k * q, Math.min(s, (k + 1) * q)))) : [],
    startAloneDb: s > 0 ? against(levelDb(body, 0, s)) : 0,
    tailAloneDb: s > 0 ? against(levelDb(body, body.L.length - s, body.L.length)) : 0,
  }
}

// The run of bars the app loops. The app crosses the end of each pass over the start of the next (APP_SEAM), so a pass
// holds the bars and, after them, the track's own continuation for one seam: bar 1 comes in under what follows the last
// bar, on the beat, and the bars are heard as that many bars. Nothing is wrapped or crossed in the file itself.
export function musicLoop(a, lines, bars, seamSeconds = APP_SEAM.music) {
  const rate = a.rate
  const found = musicBars(a, lines)
  const options = []
  for (let k = 0; k < lines.length; k++) {
    const lead = lines[k] >= LOOP_LEAD ? LOOP_LEAD : 0
    const period = k + bars < lines.length ? lines[k + bars] - lines[k] : bars * found.bar
    const from = Math.round((lines[k] - lead) * rate)
    const n = Math.round(period * rate)
    const tail = Math.round(Math.min(seamSeconds, (period * APP_SEAM_SHARE) / (1 - APP_SEAM_SHARE)) * rate)
    if (from + n + tail > a.L.length) break
    const heard = heardSeam(slice(a, from, from + n + tail), tail / rate)
    const quiet = found.level.slice(k, k + bars).some((v) => !(v >= found.medianDb - HOLD_DB)) || !(levelDb(a, from + n, from + n + tail) >= found.medianDb - HOLD_DB)
    options.push({ from, samples: n + tail, fromBar: k, toBar: k + bars - 1, leadSeconds: lead, periodSeconds: round(n / rate, 5), tailSeconds: round(tail / rate, 5), heard, score: Math.abs(heard.seamDb) + (quiet ? 100 : 0) + (lead ? 0 : 50) })
  }
  if (!options.length) return null
  return options.find((o) => o.score <= LOOP_STEP_DB / 2) ?? options.reduce((p, o) => (o.score < p.score ? o : p))
}

export function turnLoop(a) {
  const n = a.L.length
  const w = Math.round(0.05 * a.rate)
  const second = Math.min(Math.round(a.rate), n >> 1)
  const still = { audio: a, turnedSeconds: 0, seam: loopEnds(a) }
  if (n < 8 * w || Math.max(Math.abs(still.seam.levelStepDb), Math.abs(still.seam.secondStepDb)) <= LOOP_STEP_DB / 2) return still
  const e = new Float64Array(3 * n + 1)
  for (let i = 0; i < 3 * n; i++) e[i + 1] = e[i] + a.L[i % n] * a.L[i % n] + a.R[i % n] * a.R[i % n]
  const level = (from, len) => (e[from + len] > e[from] ? 10 * Math.log10((e[from + len] - e[from]) / (2 * len)) : -200)
  const step = Math.max(1, Math.round(0.01 * a.rate))
  let best = { at: 0, score: Infinity }
  for (let r = 0; r < n; r += step) {
    const p = r + n
    const score = Math.max(Math.abs(level(p, w) - level(p - w, w)), Math.abs(level(p, second) - level(p - second, second)))
    if (score < best.score - 1e-9) best = { at: r, score }
  }
  if (best.at === 0) return still
  const o = make(n, a.rate)
  for (let i = 0; i < n; i++) {
    o.L[i] = a.L[(i + best.at) % n]
    o.R[i] = a.R[(i + best.at) % n]
  }
  return { audio: o, turnedSeconds: round(best.at / a.rate, 3), seam: loopEnds(o) }
}

// One sound as the sprite holds it and the gain that puts it back at its level in the app: its kept level and the trim
// of its class. A shake takes the film's step on top and rises over its first moment as in the film; the rise is in
// the sprite's own audio and the step in the gain of its entry, so src/audio/index.ts, which plays an entry at its
// gain, does both without a change. The app's stir is made from the same entry (half its gain times the strength,
// slowed and low-passed) and follows it.
export function spriteSound(id, cls, a) {
  const shake = isShake(id)
  const body = shake ? riseIn(a, SHAKE.riseMs / 1000) : a
  const top = peak(body)
  if (top <= 0) return null
  const norm = lin(SPRITE_PEAK_DB) / top
  const trimDb = APP_TRIM_DB[cls] ?? 0
  const stepDb = shakeStepDb(id)
  const gain = round((1 / norm) * lin(trimDb + stepDb), 5)
  return { audio: scale(body, norm), gain, shake: shake ? { class: cls, trimDb, stepDb, appDb: round(trimDb + stepDb), riseMs: SHAKE.riseMs, gain } : null }
}

export function planPack({ keptDir = KEPT, laidDir = laidDirOf(keptDir), mapsDir = rel('out', 'work', 'audio', 'maps'), rate = RATE } = {}) {
  const kept = readKept(keptDir).filter((k) => k.file)
  const barSeconds = (cfg.film.beatsPerBar * 60) / cfg.film.defaultBpm
  const lead = make(Math.round(SPRITE_LEAD * rate), rate)
  const sprite = { parts: [lead], entries: {}, at: lead.L.length }
  const loops = []
  const notes = []
  const shakes = []
  // One sound into the sprite, kept or laid alike: its audio with the peak at SPRITE_PEAK_DB and the entry that puts it
  // back at its level in the app.
  const put = (id, cls, a) => {
    const s = spriteSound(id, cls, a)
    if (!s) return false
    const gap = make(Math.round(SPRITE_GAP * rate), rate)
    sprite.parts.push(s.audio, gap)
    sprite.entries[id] = { start: round(sprite.at / rate, 5), seconds: round(seconds(a), 5), gain: s.gain }
    sprite.at += a.L.length + gap.L.length
    if (s.shake) shakes.push({ id, ...s.shake })
    return true
  }
  for (const k of kept) {
    const cls = k.record.class ?? classOf(k.id)
    const a = decodeFile(k.file, rate)
    const top = peak(a)
    if (top <= 0) {
      notes.push(`${k.id} is silent and was left out`)
      continue
    }
    if (cls === 'music' && !seasonOf(k.id)) continue
    if (!isLoop(k.id)) {
      put(k.id, cls, a)
      continue
    }
    let loop = a
    let how = null
    if (cls === 'music') {
      const mapFile = path.join(mapsDir, `${k.id}.json`)
      const map = fs.existsSync(mapFile) ? readJson(mapFile) : null
      const lines = Array.isArray(map?.barLines) && map.barLines.length > 1 ? map.barLines : Array.from({ length: Math.floor(seconds(a) / barSeconds) + 1 }, (_, i) => i * barSeconds)
      const bar = lines.length > 1 ? (lines[lines.length - 1] - lines[0]) / (lines.length - 1) : barSeconds
      const fit = Math.floor((seconds(a) - lines[0] - APP_SEAM.music) / bar)
      const bars = Math.min(cfg.audio.appLoopBars, fit)
      if (bars < 1) {
        notes.push(`${k.id} is shorter than one bar and was left out`)
        continue
      }
      if (bars < cfg.audio.appLoopBars) notes.push(`${k.id} holds ${bars} whole bars, fewer than audio.appLoopBars`)
      const centred = centre(a)
      const made = musicLoop(centred.audio, lines, bars)
      if (!made) {
        notes.push(`${k.id} has no run of ${bars} bars with the track's own bar after them for the app's cross and was left out`)
        continue
      }
      if (Math.abs(made.heard.seamDb) > LOOP_STEP_DB) notes.push(`${k.id} changes level through its seam: ${made.heard.seamDb} dB against the loop's mean`)
      // The file is the track itself, from one pad before the pass to one pad after it: nothing is wrapped, nothing crossed.
      const pad = Math.round(LOOP_PAD * rate)
      const file = make(made.samples + 2 * pad, rate)
      for (let i = 0; i < file.L.length; i++) {
        const j = made.from - pad + i
        if (j < 0 || j >= centred.audio.L.length) continue
        file.L[i] = centred.audio.L[j]
        file.R[i] = centred.audio.R[j]
      }
      const fileNorm = lin(SPRITE_PEAK_DB) / peak(file)
      loops.push({ id: k.id, audio: scale(file, fileNorm), loopStart: round(pad / rate, 5), loopSeconds: round(made.samples / rate, 5), gain: round((1 / fileNorm) * lin(APP_TRIM_DB[cls] ?? 0), 5), seam: null, heard: made.heard, bars, periodSeconds: made.periodSeconds, tailSeconds: made.tailSeconds, fromBar: made.fromBar, toBar: made.toBar, leadSeconds: made.leadSeconds, centredByDb: centred.movedDb, barLines: map ? 'map' : 'grid' })
      continue
    } else {
      const turned = turnLoop(a)
      loop = turned.audio
      how = { turnedSeconds: turned.turnedSeconds }
    }
    const ends = loopEnds(loop)
    if (Math.abs(ends.levelStepDb) > LOOP_STEP_DB || Math.abs(ends.secondStepDb) > LOOP_STEP_DB) notes.push(`${k.id} changes level at its seam: ${ends.levelStepDb} dB over 50 ms, ${ends.secondStepDb} dB over a second`)
    const loopNorm = lin(SPRITE_PEAK_DB) / peak(loop)
    const loopGain = round((1 / loopNorm) * lin(APP_TRIM_DB[cls] ?? 0), 5)
    const pad = Math.min(Math.round(LOOP_PAD * rate), loop.L.length)
    const body = scale(loop, loopNorm)
    loops.push({ id: k.id, audio: concat([slice(body, body.L.length - pad), body, slice(body, 0, pad)], rate), loopStart: round(pad / rate, 5), loopSeconds: round(body.L.length / rate, 5), gain: loopGain, seam: ends, heard: heardSeam(loop, appSeam(cls, seconds(loop))), ...how })
  }
  // The sounds laid by decision 141 play in the app as they do in the film. A set of presses is the film's alone.
  const laid = []
  for (const l of readLaid(laidDir)) {
    if (!l.file || Array.isArray(l.record.presses) || isLoop(l.id) || sprite.entries[l.id]) continue
    const cls = l.record.class ?? classOf(l.id)
    if (!put(l.id, cls, decodeFile(l.file, rate))) continue
    laid.push({ id: l.id, state: l.record.state })
  }
  return { sprite: { audio: sprite.parts.length > 1 ? concat(sprite.parts, rate) : null, entries: sprite.entries }, loops, notes, laid, shakes, trimsDb: { ...APP_TRIM_DB } }
}

export function writePack({ outDir = PUBLIC_AUDIO, keptDir = KEPT, laidDir = laidDirOf(keptDir), mapsDir, rate = RATE, maxMb = cfg.audio.appMaxMb } = {}) {
  const plan = planPack({ keptDir, laidDir, mapsDir, rate })
  const limitBytes = maxMb * 1024 * 1024
  let result = null
  for (const kbps of BITRATES) {
    fs.rmSync(outDir, { recursive: true, force: true })
    fs.mkdirSync(outDir, { recursive: true })
    const files = []
    const sprites = {}
    const loops = {}
    if (plan.sprite.audio) {
      const bytes = encodeMp3(plan.sprite.audio, path.join(outDir, 'sprite.mp3'), kbps)
      files.push({ file: 'sprite.mp3', bytes })
      for (const [id, e] of Object.entries(plan.sprite.entries)) sprites[id] = { file: 'sprite.mp3', ...e }
    }
    for (const l of plan.loops) {
      const name = `${l.id}.mp3`
      files.push({ file: name, bytes: encodeMp3(l.audio, path.join(outDir, name), kbps) })
      loops[l.id] = { file: name, loopStart: l.loopStart, loopSeconds: l.loopSeconds, gain: l.gain }
    }
    const bytes = files.reduce((s, f) => s + f.bytes, 0)
    result = { index: { version: 1, bytes, files, sprites, loops }, kbps, fits: bytes <= limitBytes }
    if (result.fits) break
  }
  writeJson(path.join(outDir, 'index.json'), result.index)
  const checks = []
  for (const l of plan.loops) {
    const back = decodeFile(path.join(outDir, `${l.id}.mp3`), rate)
    const a = Math.round(l.loopStart * rate)
    const b = a + Math.round(l.loopSeconds * rate)
    // What the app's cross makes of the packed file: the period that is heard and the level through its seam.
    const heard = heardSeam(slice(back, a, b), appSeam(l.seam === null ? 'music' : 'ambience', l.loopSeconds))
    if (l.seam === null) {
      checks.push({ id: l.id, decodedSeconds: round(seconds(back), 4), expectedSeconds: round(seconds(l.audio), 4), bars: l.bars, fromBar: l.fromBar, toBar: l.toBar, heard, planned: l.heard })
      continue
    }
    const w = Math.min(Math.round(0.05 * rate), back.L.length - b)
    let num = 0
    let den = 0
    for (let i = 0; i < w; i++) {
      num += (back.L[a + i] - back.L[b + i]) ** 2 + (back.R[a + i] - back.R[b + i]) ** 2
      den += back.L[a + i] ** 2 + back.R[a + i] ** 2
    }
    checks.push({ id: l.id, decodedSeconds: round(seconds(back), 4), expectedSeconds: round(seconds(l.audio), 4), seamErrorDb: round(den > 0 && num > 0 ? 10 * Math.log10(num / den) : -120), sourceSeam: l.seam, heard })
  }
  const shas = Object.fromEntries(result.index.files.map((f) => [f.file, fileSha(path.join(outDir, f.file))]))
  return { ...result, notes: plan.notes, loopChecks: checks, shas, laid: plan.laid, shakes: plan.shakes, trimsDb: plan.trimsDb }
}

export { sha256, fileSha, readJson, writeJson }
