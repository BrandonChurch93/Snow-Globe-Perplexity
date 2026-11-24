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
const APP_TRIM_DB = { ambience: 0, interface: 0, touch: 0, impact: 0, music: -8 }
const VARIED = { 'key-tap': [0, -45, 30, -20, 55, -65, 15, 40, -30] }
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
  for (const x of [bus.L, bus.R]) {
    let px = s0 > 0 ? x[s0 - 1] : 0
    let p1 = 0
    let pm = 0
    let p2 = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      const hz = 30 * Math.pow(2400 / 30, t)
      const c = 1 / (1 + (2 * Math.PI * hz) / rate)
      const v = x[s0 + i]
      const y1 = c * (p1 + v - px)
      const y2 = c * (p2 + y1 - pm)
      px = v
      p1 = y1
      pm = y1
      p2 = y2
      const wet = Math.min(1, t * 8)
      const g = Math.cos((Math.PI / 2) * t)
      x[s0 + i] = (v * (1 - wet) + y2 * wet) * g * g
    }
  }
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

export function keptFile(id, dir = KEPT) {
  const file = path.join(dir, `${id}.wav`)
  return fs.existsSync(file) ? file : null
}

export function mixFilm({ cut, which = 'b', candidate = 'blockout', keptDir = KEPT, mapsDir = rel('out', 'work', 'audio', 'maps'), musicFile = null, skip = [], gains = {}, rate = RATE, target = cfg.audio.filmLoudnessLufs, ceilingDb = cfg.audio.truePeakDb }) {
  const offset = which === 'a' ? Number(cut.opening?.seconds ?? 0) : 0
  const total = Math.round((offset + cut.seconds) * rate)
  const bus = make(total, rate)
  const music = make(total, rate)
  const cache = new Map()
  const inputs = {}
  const load = (id) => {
    if (cache.has(id)) return cache.get(id)
    const file = keptFile(id, keptDir)
    const a = file ? decodeFile(file, rate) : null
    if (file) inputs[id] = fileSha(file)
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
    const cents = VARIED[c.cue] ? VARIED[c.cue][k % VARIED[c.cue].length] : 0
    if (cents) a = resample(a, Math.pow(2, cents / 1200))
    add(bus, a, Math.round(c.at * rate), gainOf(c.cue, c))
    placed.push({ cue: c.cue, at: round(c.at, 4), cents })
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
      const a = load(id)
      if (!a) {
        miss(id, 'no kept file')
        return
      }
      musicNote.source = 'four tracks'
      const map = mapOf(id)
      const lines = Array.isArray(map?.barLines) && map.barLines.length ? map.barLines : Array.from({ length: Math.max(1, Math.floor(seconds(a) / barSeconds)) }, (_, i) => i * barSeconds)
      const bars = Math.round((sec.to - sec.from) / barSeconds)
      const again = seen[id] === true
      seen[id] = true
      const lastSection = index === sections.length - 1
      const first = again ? Math.max(0, lines.length - bars) : 0
      const src = Math.round(lines[first] * rate)
      const len = Math.round((sec.to - sec.from) * rate)
      const part = fade(slice(a, src, src + len), 0.002, 0)
      const section = make(total, rate)
      add(section, part, Math.round((sec.from + offset) * rate), lin(gains.music ?? 0))
      if (!lastSection) thin(section, sec.to + offset - barSeconds, sec.to + offset)
      add(music, section, 0)
      musicNote.parts.push({ id, at: round(sec.from + offset, 4), fromBar: first, sourceAt: round(lines[first], 3), seconds: round(part.L.length / rate, 3), barLines: map ? 'map' : 'grid', thinned: !lastSection })
    })
  }
  if (which === 'a' && musicNote.source !== 'none') musicNote.note = 'the music starts on frame 0 of film B'

  const endFade = (bus2, sec) => {
    const n = Math.min(total, Math.round(sec * rate))
    for (let i = 0; i < n; i++) {
      const g = 0.5 - 0.5 * Math.cos((Math.PI * (i + 0.5)) / n)
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
  endFade(bus, 0.02)
  endFade(music, 0.02)
  const done = master(bus, target, ceilingDb)
  const stem = done.silent ? music : scale(music, lin(done.gainDb))
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
      music: musicNote,
      master: { targetLufs: target, ceilingDb, gainDb: done.gainDb, limiterReductionDb: done.reductionDb, lufs: done.lufs, truePeakDb: done.truePeakDb, passes: done.passes, silent: done.silent },
      inputs,
    },
  }
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

export function planPack({ keptDir = KEPT, mapsDir = rel('out', 'work', 'audio', 'maps'), rate = RATE } = {}) {
  const kept = readKept(keptDir).filter((k) => k.file)
  const barSeconds = (cfg.film.beatsPerBar * 60) / cfg.film.defaultBpm
  const lead = make(Math.round(SPRITE_LEAD * rate), rate)
  const sprite = { parts: [lead], entries: {}, at: lead.L.length }
  const loops = []
  const notes = []
  for (const k of kept) {
    const cls = k.record.class ?? classOf(k.id)
    const a = decodeFile(k.file, rate)
    const top = peak(a)
    if (top <= 0) {
      notes.push(`${k.id} is silent and was left out`)
      continue
    }
    const norm = lin(SPRITE_PEAK_DB) / top
    const gain = round((1 / norm) * lin(APP_TRIM_DB[cls] ?? 0), 5)
    if (cls === 'music' && !seasonOf(k.id)) continue
    if (!isLoop(k.id)) {
      const gap = make(Math.round(SPRITE_GAP * rate), rate)
      sprite.parts.push(scale(a, norm), gap)
      sprite.entries[k.id] = { start: round(sprite.at / rate, 5), seconds: round(seconds(a), 5), gain }
      sprite.at += a.L.length + gap.L.length
      continue
    }
    let loop = a
    if (cls === 'music') {
      const mapFile = path.join(mapsDir, `${k.id}.json`)
      const map = fs.existsSync(mapFile) ? readJson(mapFile) : null
      const lines = Array.isArray(map?.barLines) && map.barLines.length > 1 ? map.barLines : null
      const bar = lines ? (lines[lines.length - 1] - lines[0]) / (lines.length - 1) : barSeconds
      const start = lines ? lines[0] : 0
      const fit = Math.floor((seconds(a) - start - 0.05) / bar)
      const bars = Math.min(cfg.audio.appLoopBars, fit)
      if (bars < 1) {
        notes.push(`${k.id} is shorter than one bar and was left out`)
        continue
      }
      if (bars < cfg.audio.appLoopBars) notes.push(`${k.id} holds ${bars} whole bars, fewer than audio.appLoopBars`)
      const from = Math.round(start * rate)
      loop = makeLoop(slice(a, from), bars * bar, 0.04, false).audio
    }
    const pad = Math.min(Math.round(LOOP_PAD * rate), loop.L.length)
    const body = scale(loop, norm)
    loops.push({ id: k.id, audio: concat([slice(body, body.L.length - pad), body, slice(body, 0, pad)], rate), loopStart: round(pad / rate, 5), loopSeconds: round(body.L.length / rate, 5), gain, seam: seam(loop) })
  }
  return { sprite: { audio: sprite.parts.length > 1 ? concat(sprite.parts, rate) : null, entries: sprite.entries }, loops, notes }
}

export function writePack({ outDir = PUBLIC_AUDIO, keptDir = KEPT, mapsDir, rate = RATE, maxMb = cfg.audio.appMaxMb } = {}) {
  const plan = planPack({ keptDir, mapsDir, rate })
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
    const w = Math.min(Math.round(0.05 * rate), back.L.length - b)
    let num = 0
    let den = 0
    for (let i = 0; i < w; i++) {
      num += (back.L[a + i] - back.L[b + i]) ** 2 + (back.R[a + i] - back.R[b + i]) ** 2
      den += back.L[a + i] ** 2 + back.R[a + i] ** 2
    }
    checks.push({ id: l.id, decodedSeconds: round(seconds(back), 4), expectedSeconds: round(seconds(l.audio), 4), seamErrorDb: round(den > 0 && num > 0 ? 10 * Math.log10(num / den) : -120), sourceSeam: l.seam })
  }
  const shas = Object.fromEntries(result.index.files.map((f) => [f.file, fileSha(path.join(outDir, f.file))]))
  return { ...result, notes: plan.notes, loopChecks: checks, shas }
}

export { sha256, fileSha, readJson, writeJson }
