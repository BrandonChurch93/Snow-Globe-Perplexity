export const MAP_VERSION = 1

export const SETTINGS = [
  { name: 'short window', windowSeconds: 0.0213, hopSeconds: 0.005, bands: 40, lowHz: 30, highHz: 16000, compression: 1000, lagSeconds: 0.01, spread: 0, tightness: 1000 },
  { name: 'long window', windowSeconds: 0.0427, hopSeconds: 0.005, bands: 40, lowHz: 30, highHz: 16000, compression: 100, lagSeconds: 0.015, spread: 1, tightness: 1000 },
  { name: 'wide bands', windowSeconds: 0.0213, hopSeconds: 0.005, bands: 12, lowHz: 60, highHz: 12000, compression: 10000, lagSeconds: 0.01, spread: 0, tightness: 3000 },
]

export const LIMITS = {
  minBpm: 40,
  maxBpm: 240,
  priorOctaves: 0.7,
  tempoToleranceBpm: 1,
  minPulse: 0.05,
  steadyTolerance: 0.05,
  steadyShare: 0.9,
  slipTolerance: 0.15,
  peakReachSeconds: 0.025,
  peakShare: 0.3,
  smoothBars: 2,
  accentSeconds: 0.12,
  bassHz: 160,
  barConfidence: 3,
  harmonyWindowSeconds: 0.17,
  harmonyHopSeconds: 0.04,
  harmonyLowHz: 55,
  harmonyOctaves: 5,
  minSectionBars: 2,
  sectionBands: 10,
  sectionStepDb: 3,
  sectionNoiseFloorDb: 1.5,
  sectionPenalty: 8,
  soundFloorDb: 60,
  blockSeconds: 0.05,
  edgeGuardSeconds: 0.05,
  combWindowSeconds: 12,
  combStepBpm: 0.25,
  halfBeatShare: 0.5,
  halfBeatTie: 0.1,
  halfBeatEdge: 0.1,
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const round = (v, places = 4) => {
  const m = 10 ** places
  return Math.round(v * m) / m
}

export function median(values) {
  if (!values.length) return 0
  const s = Float64Array.from(values).sort()
  const h = s.length >> 1
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2
}

export function quantile(values, q) {
  if (!values.length) return 0
  const s = Float64Array.from(values).sort()
  const x = clamp(q, 0, 1) * (s.length - 1)
  const i = Math.floor(x)
  const f = x - i
  return i + 1 < s.length ? s[i] * (1 - f) + s[i + 1] * f : s[i]
}

export function makeFft(n) {
  if (n < 2 || (n & (n - 1)) !== 0) throw new Error(`the transform length must be a power of two: ${n}`)
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  const rev = new Uint32Array(n)
  const bits = Math.log2(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    rev[i] = r
  }
  return (re, im) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i]
      if (j > i) {
        const a = re[i]
        re[i] = re[j]
        re[j] = a
        const b = im[i]
        im[i] = im[j]
        im[j] = b
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1
      const step = n / size
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const c = cos[k * step]
          const s = sin[k * step]
          const i = start + k
          const j = i + half
          const xr = re[j] * c + im[j] * s
          const xi = im[j] * c - re[j] * s
          re[j] = re[i] - xr
          im[j] = im[i] - xi
          re[i] += xr
          im[i] += xi
        }
      }
    }
  }
}

const mel = (hz) => 2595 * Math.log10(1 + hz / 700)
const melToHz = (m) => 700 * (10 ** (m / 2595) - 1)

function bandPlan(n, sampleRate, bands, lowHz, highHz) {
  const top = Math.min(highHz, sampleRate * 0.45)
  const lo = mel(lowHz)
  const hi = mel(top)
  const bins = n / 2 + 1
  const index = new Int32Array(bins).fill(-1)
  const weight = new Float32Array(bins)
  for (let k = 1; k < bins; k++) {
    const hz = (k * sampleRate) / n
    if (hz < lowHz || hz > top) continue
    const x = ((mel(hz) - lo) / (hi - lo)) * (bands - 1)
    const b = Math.min(bands - 2, Math.floor(x))
    index[k] = b
    weight[k] = x - b
  }
  const centres = Array.from({ length: bands }, (_, b) => melToHz(lo + ((hi - lo) * b) / (bands - 1)))
  return { index, weight, centres }
}

export function spectra(samples, sampleRate, setting) {
  const n = 2 ** Math.round(Math.log2(setting.windowSeconds * sampleRate))
  const hop = Math.max(1, Math.round(setting.hopSeconds * sampleRate))
  const frames = Math.floor((samples.length + n) / hop) + 1
  const { bands } = setting
  const plan = bandPlan(n, sampleRate, bands, setting.lowHz, setting.highHz)
  const hann = new Float64Array(n)
  for (let i = 0; i < n; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n)
  const fft = makeFft(n)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const power = new Float32Array(frames * bands)
  for (let f = 0; f < frames; f++) {
    const start = f * hop - n
    let any = false
    for (let i = 0; i < n; i++) {
      const j = start + i
      const v = j >= 0 && j < samples.length ? samples[j] : 0
      if (v !== 0) any = true
      re[i] = v * hann[i]
      im[i] = 0
    }
    if (!any) continue
    fft(re, im)
    const row = f * bands
    for (let k = 1; k <= n / 2; k++) {
      const b = plan.index[k]
      if (b < 0) continue
      const p = re[k] * re[k] + im[k] * im[k]
      const w = plan.weight[k]
      power[row + b] += p * (1 - w)
      power[row + b + 1] += p * w
    }
  }
  return { sampleRate, n, hop, frames, bands, power, centres: plan.centres, frameRate: sampleRate / hop, centreOffset: n / 2 / sampleRate }
}

export function harmony(samples, sampleRate, limits = LIMITS) {
  const n = 2 ** Math.round(Math.log2(limits.harmonyWindowSeconds * sampleRate))
  const hop = Math.max(1, Math.round(limits.harmonyHopSeconds * sampleRate))
  const notes = 12 * limits.harmonyOctaves
  const frames = Math.floor((samples.length + n) / hop) + 1
  const index = new Int32Array(n / 2 + 1).fill(-1)
  for (let k = 1; k <= n / 2; k++) {
    const note = Math.round(12 * Math.log2((k * sampleRate) / n / limits.harmonyLowHz))
    if (note >= 0 && note < notes) index[k] = note
  }
  const hann = new Float64Array(n)
  for (let i = 0; i < n; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n)
  const fft = makeFft(n)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const power = new Float32Array(frames * notes)
  for (let f = 0; f < frames; f++) {
    const start = f * hop - n
    let any = false
    for (let i = 0; i < n; i++) {
      const j = start + i
      const v = j >= 0 && j < samples.length ? samples[j] : 0
      if (v !== 0) any = true
      re[i] = v * hann[i]
      im[i] = 0
    }
    if (!any) continue
    fft(re, im)
    for (let k = 1; k <= n / 2; k++) if (index[k] >= 0) power[f * notes + index[k]] += re[k] * re[k] + im[k] * im[k]
  }
  return { sampleRate, n, hop, frames, bands: notes, power }
}

export function onsetEnvelope(spec, setting) {
  const { frames, bands, power, frameRate } = spec
  let top = 0
  for (let i = 0; i < power.length; i++) if (power[i] > top) top = power[i]
  const env = new Float32Array(frames)
  const lag = Math.max(1, Math.round(setting.lagSeconds * frameRate))
  const latency = (0.24 * spec.n) / spec.sampleRate + (0.5 * (lag - 1)) / frameRate
  if (top <= 0) return { env, frameRate, latency, lag, silent: true }
  const scale = setting.compression / Math.sqrt(top)
  const level = new Float32Array(power.length)
  for (let i = 0; i < power.length; i++) level[i] = Math.log1p(scale * Math.sqrt(power[i]))
  const flux = new Float32Array(frames)
  for (let f = lag; f < frames; f++) {
    const a = f * bands
    const b = (f - lag) * bands
    let sum = 0
    for (let k = 0; k < bands; k++) {
      let ref = level[b + k]
      if (setting.spread) {
        if (k > 0 && level[b + k - 1] > ref) ref = level[b + k - 1]
        if (k + 1 < bands && level[b + k + 1] > ref) ref = level[b + k + 1]
      }
      const d = level[a + k] - ref
      if (d > 0) sum += d
    }
    flux[f] = sum
  }
  const half = Math.round(frameRate * 0.5)
  const prefix = new Float64Array(frames + 1)
  for (let f = 0; f < frames; f++) prefix[f + 1] = prefix[f] + flux[f]
  let sq = 0
  for (let f = 0; f < frames; f++) {
    const lo = Math.max(0, f - half)
    const hi = Math.min(frames, f + half + 1)
    const v = flux[f] - (prefix[hi] - prefix[lo]) / (hi - lo)
    env[f] = v > 0 ? v : 0
    sq += env[f] * env[f]
  }
  const rms = Math.sqrt(sq / frames)
  if (rms <= 0) return { env, frameRate, latency, lag, silent: true }
  for (let f = 0; f < frames; f++) env[f] /= rms
  return { env, frameRate, latency, lag, silent: false }
}

const prior = (bpm, centreBpm, octaves) => Math.exp(-0.5 * (Math.log2(bpm / centreBpm) / octaves) ** 2)

function peakAt(values, i) {
  if (i <= 0 || i >= values.length - 1) return i
  const a = values[i - 1]
  const b = values[i]
  const c = values[i + 1]
  const d = a - 2 * b + c
  return d < 0 ? i + clamp((0.5 * (a - c)) / d, -0.5, 0.5) : i
}

function localMax(values, from, to) {
  let best = -1
  for (let i = Math.max(1, from); i <= Math.min(values.length - 2, to); i++) {
    if (values[i] >= values[i - 1] && values[i] >= values[i + 1] && (best < 0 || values[i] > values[best])) best = i
  }
  return best
}

export function autocorrelation(env, maxLag) {
  const n = env.length
  let mean = 0
  for (let i = 0; i < n; i++) mean += env[i]
  mean /= n || 1
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) x[i] = env[i] - mean
  const top = Math.min(maxLag, n - 1)
  const acf = new Float64Array(top + 1)
  for (let lag = 0; lag <= top; lag++) {
    let s = 0
    for (let i = lag; i < n; i++) s += x[i] * x[i - lag]
    acf[lag] = s / (n - lag)
  }
  return acf
}

export function tempoByAutocorrelation(env, frameRate, centreBpm, limits = LIMITS) {
  const lagMin = Math.max(2, Math.floor((frameRate * 60) / limits.maxBpm))
  const lagMax = Math.ceil((frameRate * 60) / limits.minBpm)
  const multiples = 4
  const acf = autocorrelation(env, Math.max(lagMax * multiples, lagMax + 2))
  if (acf.length <= lagMin + 2 || acf[0] <= 0) return { bpm: 0, strength: 0 }
  const near = (lag) => {
    const c = Math.round(lag)
    const reach = Math.max(1, Math.round(lag * 0.01))
    let best = -Infinity
    for (let i = Math.max(1, c - reach); i <= Math.min(acf.length - 1, c + reach); i++) if (acf[i] > best) best = acf[i]
    return best === -Infinity ? 0 : best
  }
  let bestLag = 0
  let bestScore = -Infinity
  for (let lag = lagMin; lag <= Math.min(lagMax, acf.length - 2); lag++) {
    if (!(acf[lag] >= acf[lag - 1] && acf[lag] >= acf[lag + 1])) continue
    let sum = 0
    for (let m = 1; m <= multiples; m++) sum += near(lag * m)
    const score = Math.sqrt(Math.max(0, acf[lag]) * Math.max(0, sum / multiples)) * prior((frameRate * 60) / lag, centreBpm, limits.priorOctaves)
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  if (!bestLag) return { bpm: 0, strength: 0 }
  let period = peakAt(acf, bestLag)
  for (let m = 2; m * period < acf.length - 2; m++) {
    const guess = m * period
    const reach = Math.max(2, Math.round(guess * 0.015))
    const at = localMax(acf, Math.round(guess) - reach, Math.round(guess) + reach)
    if (at < 0 || acf[at] < 0.25 * acf[bestLag]) break
    period = peakAt(acf, at) / m
  }
  return { bpm: (frameRate * 60) / period, strength: acf[bestLag] / acf[0] }
}

function combScore(env, frameRate, bpm, windowFrames) {
  const period = (frameRate * 60) / bpm
  const bins = Math.max(2, Math.round(period))
  const sum = new Float64Array(2 * bins)
  const count = new Float64Array(2 * bins)
  const hopFrames = Math.max(1, windowFrames >> 1)
  const at = (b) => {
    const l = (b + 2 * bins - 1) % (2 * bins)
    const r = (b + 1) % (2 * bins)
    return (sum[l] + 2 * sum[b] + sum[r]) / Math.max(1, count[l] + 2 * count[b] + count[r])
  }
  let total = 0
  let windows = 0
  for (let start = 0; start === 0 || start + hopFrames < env.length; start += hopFrames) {
    const end = Math.min(env.length, start + windowFrames)
    if (end - start < 4 * period) break
    sum.fill(0)
    count.fill(0)
    let mean = 0
    for (let t = start; t < end; t++) {
      const x = t / (2 * period)
      const b = Math.min(2 * bins - 1, Math.floor((x - Math.floor(x)) * 2 * bins))
      sum[b] += env[t]
      count[b]++
      mean += env[t]
    }
    mean /= end - start
    let best = 0
    for (let b = 0; b < bins; b++) {
      const one = Math.max(0, at(b) - mean)
      const other = Math.max(0, at(b + bins) - mean)
      const v = Math.sqrt(one * other)
      if (v > best) best = v
    }
    total += best
    windows++
  }
  return windows ? total / windows : 0
}

export function tempoByComb(env, frameRate, centreBpm, limits = LIMITS) {
  const windowFrames = Math.round(limits.combWindowSeconds * frameRate)
  const score = (bpm) => combScore(env, frameRate, bpm, windowFrames) * prior(bpm, centreBpm, limits.priorOctaves)
  let best = 0
  let bestScore = 0
  for (let bpm = limits.minBpm; bpm <= limits.maxBpm; bpm += limits.combStepBpm) {
    const s = score(bpm)
    if (s > bestScore) {
      bestScore = s
      best = bpm
    }
  }
  if (!best) return { bpm: 0, strength: 0 }
  let step = limits.combStepBpm
  for (let pass = 0; pass < 4; pass++) {
    step /= 3
    for (const bpm of [best - step, best + step]) {
      const s = score(bpm)
      if (s > bestScore) {
        bestScore = s
        best = bpm
      }
    }
  }
  const a = score(best - step)
  const c = score(best + step)
  const d = a - 2 * bestScore + c
  const fine = d < 0 ? best + clamp((0.5 * (a - c)) / d, -0.5, 0.5) * step : best
  return { bpm: fine, strength: bestScore }
}

export function trackBeats(env, frameRate, bpm, tightness = 100) {
  const n = env.length
  const period = (frameRate * 60) / bpm
  if (!(period > 1) || n < period) return []
  let top = 0
  for (let i = 0; i < n; i++) if (env[i] > top) top = env[i]
  const from = Math.round(2 * period)
  const to = Math.max(1, Math.round(period / 2))
  const cost = new Float64Array(from + 1)
  for (let d = to; d <= from; d++) cost[d] = -tightness * Math.log(d / period) ** 2
  const score = new Float64Array(n)
  const back = new Int32Array(n).fill(-1)
  let first = true
  for (let i = 0; i < n; i++) {
    let best = -Infinity
    let at = -1
    for (let d = to; d <= from && i - d >= 0; d++) {
      const v = score[i - d] + cost[d]
      if (v > best) {
        best = v
        at = i - d
      }
    }
    if (at < 0) best = 0
    score[i] = env[i] + best
    if (first && env[i] < 0.01 * top) continue
    back[i] = at
    first = false
  }
  const peaks = []
  for (let i = 1; i < n - 1; i++) if (score[i] > score[i - 1] && score[i] >= score[i + 1]) peaks.push(i)
  if (!peaks.length) return []
  const floor = 0.5 * median(peaks.map((i) => score[i]))
  let tail = -1
  for (let k = peaks.length - 1; k >= 0; k--) {
    if (score[peaks[k]] >= floor) {
      tail = peaks[k]
      break
    }
  }
  const beats = []
  for (let i = tail; i >= 0; i = back[i]) beats.push(i)
  return beats.reverse()
}

export function measureBeats(frames, onset, limits = LIMITS) {
  const { env, frameRate, latency } = onset
  const reach = Math.max(1, Math.round(limits.peakReachSeconds * frameRate))
  const peaks = frames.map((f) => localMax(env, f - reach, f + reach))
  const floor = limits.peakShare * median(peaks.filter((at) => at >= 0).map((at) => env[at]))
  return frames.map((f, i) => {
    const at = peaks[i]
    const found = at >= 0 && env[at] > 0 && env[at] >= floor
    return { time: (found ? peakAt(env, at) : f) / frameRate - latency, weight: found ? env[at] : 0.02, found }
  })
}

export function smoothBeats(measured, beatsPerBar, limits = LIMITS) {
  const n = measured.length
  const reach = Math.max(2, limits.smoothBars * beatsPerBar)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    let sw = 0
    let sx = 0
    let sy = 0
    let sxx = 0
    let sxy = 0
    const lo = Math.max(0, Math.min(i - reach, n - 1 - 2 * reach))
    const hi = Math.min(n - 1, lo + 2 * reach)
    const span = Math.max(i - lo, hi - i) + 1
    for (let j = lo; j <= hi; j++) {
      const u = Math.abs(j - i) / span
      const w = (1 - u * u * u) ** 3 * Math.min(measured[j].weight, 4)
      const x = j - i
      sw += w
      sx += w * x
      sy += w * measured[j].time
      sxx += w * x * x
      sxy += w * x * measured[j].time
    }
    const den = sw * sxx - sx * sx
    out[i] = den > 1e-9 ? (sy * sxx - sx * sxy) / den : measured[i].time
  }
  return out
}

export function extendBeats(times, from, to) {
  if (times.length < 2) return [...times]
  const out = [...times]
  const k = Math.min(4, out.length - 1)
  const head = (out[k] - out[0]) / k
  while (out[0] - head >= from - head * 0.02) out.unshift(out[0] - head)
  const tail = (out[out.length - 1] - out[out.length - 1 - k]) / k
  while (out[out.length - 1] + tail < to - tail * 0.02) out.push(out[out.length - 1] + tail)
  return out
}

export function kWeighted(samples, sampleRate) {
  const stage = (input, b0, b1, b2, a1, a2) => {
    const out = new Float32Array(input.length)
    let x1 = 0
    let x2 = 0
    let y1 = 0
    let y2 = 0
    for (let i = 0; i < input.length; i++) {
      const x = input[i]
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      out[i] = y
    }
    return out
  }
  const shelfK = Math.tan((Math.PI * 1681.974450955533) / sampleRate)
  const shelfQ = 0.7071752369554196
  const vh = 10 ** (3.999843853973347 / 20)
  const vb = vh ** 0.4996667741545416
  const sa = 1 + shelfK / shelfQ + shelfK * shelfK
  const shelved = stage(samples, (vh + (vb * shelfK) / shelfQ + shelfK * shelfK) / sa, (2 * (shelfK * shelfK - vh)) / sa, (vh - (vb * shelfK) / shelfQ + shelfK * shelfK) / sa, (2 * (shelfK * shelfK - 1)) / sa, (1 - shelfK / shelfQ + shelfK * shelfK) / sa)
  const passK = Math.tan((Math.PI * 38.13547087602444) / sampleRate)
  const passQ = 0.5003270373238773
  const pa = 1 + passK / passQ + passK * passK
  return stage(shelved, 1, -2, 1, (2 * (passK * passK - 1)) / pa, (1 - passK / passQ + passK * passK) / pa)
}

export function squareSums(samples) {
  const sums = new Float64Array(samples.length + 1)
  for (let i = 0; i < samples.length; i++) sums[i + 1] = sums[i] + samples[i] * samples[i]
  return sums
}

const LOUDNESS_FLOOR = -120

export function loudnessBetween(sums, sampleRate, start, end) {
  const a = clamp(Math.round(start * sampleRate), 0, sums.length - 1)
  const b = clamp(Math.round(end * sampleRate), 0, sums.length - 1)
  if (b <= a) return LOUDNESS_FLOOR
  const ms = (sums[b] - sums[a]) / (b - a)
  return ms > 0 ? Math.max(LOUDNESS_FLOOR, -0.691 + 10 * Math.log10(ms)) : LOUDNESS_FLOOR
}

export function soundBounds(samples, sampleRate, limits = LIMITS) {
  const block = Math.max(1, Math.round(limits.blockSeconds * sampleRate))
  const count = Math.ceil(samples.length / block)
  const level = new Float64Array(count)
  let top = 0
  for (let b = 0; b < count; b++) {
    let s = 0
    const end = Math.min(samples.length, (b + 1) * block)
    for (let i = b * block; i < end; i++) s += samples[i] * samples[i]
    level[b] = s / (end - b * block)
    if (level[b] > top) top = level[b]
  }
  const seconds = samples.length / sampleRate
  if (top <= 0) return { start: 0, end: seconds, silent: true }
  const floor = top * 10 ** (-limits.soundFloorDb / 10)
  let first = 0
  while (level[first] < floor) first++
  let last = count - 1
  while (level[last] < floor) last--
  return { start: (first * block) / sampleRate, end: Math.min(seconds, ((last + 1) * block) / sampleRate), silent: false }
}

function bandMeans(spec, start, end) {
  const { bands, power, frames, hop, n, sampleRate } = spec
  const a = clamp(Math.ceil((start * sampleRate + n / 2) / hop), 0, frames - 1)
  const b = clamp(Math.max(a + 1, Math.ceil((end * sampleRate + n / 2) / hop)), a + 1, frames)
  const out = new Float64Array(bands)
  for (let f = a; f < b; f++) for (let k = 0; k < bands; k++) out[k] += power[f * bands + k]
  for (let k = 0; k < bands; k++) out[k] /= b - a
  return out
}

function zScores(values) {
  const m = median(values)
  const spread = 1.4826 * median(values.map((v) => Math.abs(v - m)))
  let sd = spread
  if (!(sd > 1e-9)) {
    const mean = values.reduce((a, v) => a + v, 0) / (values.length || 1)
    sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length || 1))
  }
  return values.map((v) => (sd > 1e-9 ? clamp((v - m) / sd, -6, 6) : 0))
}

export function beatFeatures(spec, onset, sums, times, seconds, limits = LIMITS, tones = null) {
  const { bands, centres } = spec
  let top = 0
  for (let i = 0; i < spec.power.length; i++) if (spec.power[i] > top) top = spec.power[i]
  const eps = top * 1e-9 + 1e-30
  const bassBands = centres.filter((hz) => hz <= limits.bassHz).length || 1
  const reach = Math.max(1, Math.round(limits.peakReachSeconds * onset.frameRate))
  const shapes = []
  const loudness = []
  const hit = []
  const bass = []
  const strength = []
  const chords = []
  for (let i = 0; i < times.length; i++) {
    const start = times[i]
    const end = i + 1 < times.length ? times[i + 1] : Math.min(seconds, start + (i ? start - times[i - 1] : 0.5))
    const whole = bandMeans(spec, start, Math.max(end, start + 0.02))
    const db = Array.from(whole, (p) => 10 * Math.log10(p + eps))
    const mean = db.reduce((a, v) => a + v, 0) / bands
    shapes.push(db.map((v) => v - mean))
    loudness.push(loudnessBetween(sums, spec.sampleRate, start, end))
    const head = bandMeans(spec, start - 0.01, start + limits.accentSeconds)
    let all = 0
    let low = 0
    for (let k = 0; k < bands; k++) {
      all += head[k]
      if (k < bassBands) low += head[k]
    }
    hit.push(10 * Math.log10(all + eps))
    const before = bandMeans(spec, start - limits.accentSeconds, start - 0.01)
    let lowBefore = 0
    for (let k = 0; k < bassBands; k++) lowBefore += before[k]
    bass.push(10 * Math.log10(low + eps * 1e3) - 10 * Math.log10(lowBefore + eps * 1e3))
    if (tones) {
      const pad = Math.min(tones.n / 2 / tones.sampleRate, (end - start) / 4)
      const chord = bandMeans(tones, start + pad, Math.max(end - pad, start + pad + 0.02))
      let norm = 0
      for (let k = 0; k < chord.length; k++) {
        chord[k] = Math.sqrt(chord[k])
        norm += chord[k] * chord[k]
      }
      norm = Math.sqrt(norm)
      if (norm > 0) for (let k = 0; k < chord.length; k++) chord[k] /= norm
      chords.push(chord)
    }
    const f = Math.round((start + onset.latency) * onset.frameRate)
    let s = 0
    for (let j = Math.max(0, f - reach); j <= Math.min(onset.env.length - 1, f + reach); j++) if (onset.env[j] > s) s = onset.env[j]
    strength.push(s)
  }
  const change = shapes.map((shape, i) => {
    if (!i) return 0
    let d = 0
    for (let k = 0; k < bands; k++) d += (shape[k] - shapes[i - 1][k]) ** 2
    return Math.sqrt(d / bands)
  })
  const chordChange = chords.map((chord, i) => {
    if (!i) return 0
    let dot = 0
    for (let k = 0; k < chord.length; k++) dot += chord[k] * chords[i - 1][k]
    return 1 - dot
  })
  return { shapes, loudness, hit, bass, strength, change, chordChange }
}

function againstNeighbours(values, reach) {
  return values.map((v, i) => v - median(values.slice(Math.max(0, i - reach), i + reach + 1)))
}

export function barPhase(features, beatsPerBar, firstSounding = 0, limits = LIMITS) {
  const n = features.hit.length
  const named = { hit: 1, strength: 1, bass: 1, change: 0.5, chordChange: 1.5 }
  const used = Object.keys(named).filter((k) => features[k]?.length === n)
  const parts = used.map((k) => zScores(againstNeighbours(features[k], beatsPerBar)))
  const weights = used.map((k) => named[k])
  const accent = new Array(n).fill(0)
  for (let p = 0; p < parts.length; p++) for (let i = 0; i < n; i++) accent[i] += weights[p] * parts[p][i]
  const sum = new Array(beatsPerBar).fill(0)
  const count = new Array(beatsPerBar).fill(0)
  for (let i = firstSounding; i < n; i++) {
    sum[i % beatsPerBar] += accent[i]
    count[i % beatsPerBar]++
  }
  const scores = sum.map((s, k) => (count[k] ? s / count[k] : -Infinity))
  const order = scores.map((_, k) => k).sort((a, b) => scores[b] - scores[a])
  const best = order[0]
  let within = 0
  let seen = 0
  for (let i = firstSounding; i < n; i++) {
    within += (accent[i] - scores[i % beatsPerBar]) ** 2
    seen++
  }
  const sd = Math.sqrt(within / Math.max(1, seen - beatsPerBar))
  const perPhase = Math.max(1, Math.floor(seen / beatsPerBar))
  const gap = beatsPerBar > 1 ? scores[best] - scores[order[1]] : Infinity
  const confidence = beatsPerBar > 1 ? (sd > 1e-9 ? gap / (sd * Math.sqrt(2 / perPhase)) : gap > 1e-9 ? Infinity : 0) : Infinity
  const sure = confidence >= limits.barConfidence && seen >= 2 * beatsPerBar
  const phase = sure ? best : firstSounding % beatsPerBar
  return { phase, method: sure ? 'accents' : 'first beat', confidence: Number.isFinite(confidence) ? round(confidence, 2) : 99, scores: scores.map((s) => (Number.isFinite(s) ? round(s, 3) : 0)) }
}

export function findSections(features, times, phase, beatsPerBar, seconds, sums, sampleRate, limits = LIMITS) {
  const beats = times.length
  const starts = []
  if (phase > 0) starts.push(0)
  for (let i = phase; i < beats; i += beatsPerBar) starts.push(i)
  const n = starts.length
  const least = limits.minSectionBars
  const floor = Math.max(...features.loudness) - limits.soundFloorDb
  const bands = features.shapes[0]?.length ?? 0
  const group = Math.max(1, Math.ceil(bands / limits.sectionBands))
  const pooled = Math.ceil(bands / group)
  const dims = pooled + 1
  const scale = 1 / limits.sectionStepDb
  const raw = starts.map((from, b) => {
    const to = b + 1 < n ? starts[b + 1] : beats
    const row = new Float64Array(dims)
    for (let i = from; i < to; i++) {
      row[0] += (Math.max(features.loudness[i], floor) * scale) / (to - from)
      for (let k = 0; k < bands; k++) row[1 + Math.floor(k / group)] += (features.shapes[i][k] * scale) / Math.sqrt(pooled) / Math.min(group, bands - Math.floor(k / group) * group) / (to - from)
    }
    return row
  })
  const rows = raw.map((row, b) => (b === 0 || b === n - 1 ? row : row.map((_, k) => median([raw[b - 1][k], row[k], raw[b + 1][k]]))))
  const apart = []
  for (let b = 0; b + 1 < n; b++) {
    let d = 0
    for (let k = 0; k < dims; k++) d += (raw[b][k] - raw[b + 1][k]) ** 2
    apart.push(d / 2)
  }
  const noise = Math.max(median(apart), (limits.sectionNoiseFloorDb * scale) ** 2)
  const penalty = limits.sectionPenalty * noise
  const linear = Array.from({ length: dims }, () => new Float64Array(n + 1))
  const squares = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    let sq = 0
    for (let k = 0; k < dims; k++) {
      linear[k][i + 1] = linear[k][i] + rows[i][k]
      sq += rows[i][k] ** 2
    }
    squares[i + 1] = squares[i] + sq
  }
  const cost = (from, to) => {
    let mean = 0
    for (let k = 0; k < dims; k++) mean += (linear[k][to] - linear[k][from]) ** 2
    return Math.max(0, squares[to] - squares[from] - mean / (to - from))
  }
  const best = new Float64Array(n + 1).fill(Infinity)
  const back = new Int32Array(n + 1).fill(-1)
  best[0] = -penalty
  for (let to = 1; to <= n; to++) {
    if (to !== n && (to < least || n - to < least)) continue
    for (let from = 0; from < to; from++) {
      if (best[from] === Infinity || (to - from < least && !(from === 0 && to === n))) continue
      const v = best[from] + penalty + cost(from, to)
      if (v < best[to]) {
        best[to] = v
        back[to] = from
      }
    }
  }
  const cuts = []
  for (let at = back[n]; at > 0; at = back[at]) cuts.push(at)
  cuts.reverse()
  const boundaries = cuts.map((cut, c) => {
    const before = c ? cuts[c - 1] : 0
    const after = c + 1 < cuts.length ? cuts[c + 1] : n
    const gain = cost(before, after) - cost(before, cut) - cost(cut, after)
    return { beat: starts[cut], time: round(times[starts[cut]]), strength: round(gain / noise, 1) }
  })
  const edges = [0, ...boundaries.map((c) => times[c.beat]), seconds]
  const sections = []
  for (let i = 0; i + 1 < edges.length; i++) {
    const guard = i + 2 < edges.length ? Math.min(limits.edgeGuardSeconds, (edges[i + 1] - edges[i]) / 2) : 0
    sections.push({ start: round(edges[i]), end: round(edges[i + 1]), loudness: round(loudnessBetween(sums, sampleRate, edges[i], edges[i + 1] - guard), 2) })
  }
  return { sections, boundaries }
}

export function steadiness(measured, sections, limits = LIMITS) {
  const rows = sections.map((s) => {
    const inside = measured.filter((m) => m.time >= s.start - 1e-6 && m.time < s.end)
    const gaps = []
    for (let i = 1; i < inside.length; i++) gaps.push(inside[i].time - inside[i - 1].time)
    if (gaps.length < 3) return { start: s.start, beats: inside.length, spread: 0, worst: 0, steady: true }
    const mid = median(gaps)
    const off = gaps.map((g) => Math.abs(g / mid - 1))
    const spread = quantile(off, limits.steadyShare)
    const worst = Math.max(...off)
    return { start: s.start, beats: inside.length, bpm: round(60 / mid, 2), spread: round(spread, 4), worst: round(worst, 4), steady: spread <= limits.steadyTolerance && worst <= limits.slipTolerance }
  })
  return { tolerance: limits.steadyTolerance, share: limits.steadyShare, slip: limits.slipTolerance, sections: rows, pass: rows.every((r) => r.steady) }
}

export function gridBeats(seconds, defaultBpm, beatsPerBar) {
  const bars = Math.max(1, Math.round((seconds * defaultBpm) / 60 / beatsPerBar))
  const bpm = (bars * beatsPerBar * 60) / seconds
  const beats = Array.from({ length: bars * beatsPerBar }, (_, i) => (i * 60) / bpm)
  return { bars, bpm, beats }
}

function slopeBpm(times) {
  const n = times.length
  if (n < 2) return 0
  const mx = (n - 1) / 2
  const my = times.reduce((a, v) => a + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (times[i] - my)
    den += (i - mx) ** 2
  }
  return 60 / (num / den)
}

function countBars(barLines, beats, beatsPerBar, seconds) {
  if (!barLines.length) return 0
  const k = Math.min(4, beats.length - 1)
  const beat = k > 0 ? (beats[beats.length - 1] - beats[beats.length - 1 - k]) / k : 0
  const lastEnd = barLines[barLines.length - 1] + beat * beatsPerBar
  return barLines.length - (lastEnd <= seconds + beat * 0.25 ? 0 : 1)
}

// Which of two pulses half a beat apart is the beat. The tracker follows the onsets, and where the notes run in
// eighths both pulses carry onsets: which of the two its path ends on can then turn on the last half second of
// the file. Asked only when the other pulse carries at least limits.halfBeatShare of the tracked one's onsets.
// Then, in this order: the pulse on which the bass strikes and the harmony changes (the two as one statistic,
// held to limits.barConfidence); the pulse with the stronger onsets, when the two differ by more than
// limits.halfBeatTie; the pulse on which the first sound of the file lies, which moves the beat only where bass
// and harmony do not lean the other way.
export function beatPhase(frames, spec, onset, sums, seconds, limits = LIMITS, tones = null) {
  const { env, frameRate, latency } = onset
  const report = { share: 0, limit: limits.halfBeatShare, tested: false, method: 'onsets', moved: false, confidence: 0 }
  if (frames.length < 6) return { report }
  const period = median(frames.slice(1).map((f, i) => f - frames[i]))
  const half = Math.round(period / 2)
  let head = 0
  while (head < frames.length - 2 && Math.abs(frames[head + 1] - frames[head] - period) > 0.25 * period) head++
  const own = frames.slice(head)
  const reach = Math.max(1, Math.round(limits.peakReachSeconds * frameRate))
  const top = (f) => {
    let v = 0
    for (let j = Math.max(0, f - reach); j <= Math.min(env.length - 1, f + reach); j++) if (env[j] > v) v = env[j]
    return v
  }
  const mean = (list) => list.reduce((acc, v) => acc + v, 0) / (list.length || 1)
  const tops = own.map(top)
  const strength = mean(tops)
  const between = own.slice(1).map((f) => f - half)
  report.share = round(strength > 0 ? mean(between.map(top)) / strength : 0, 3)
  if (!(report.share >= limits.halfBeatShare)) return { report }
  report.tested = true
  const floor = limits.peakShare * median(tops)
  const lead = own[0] - half
  const other = lead >= -reach && top(lead) >= floor ? [Math.max(0, lead), ...between] : between
  const a = measureBeats(own, onset, limits)
  const b = measureBeats(other, onset, limits)
  const grid = [...a.map((m) => ({ time: m.time, tracked: true })), ...b.map((m) => ({ time: m.time, tracked: false }))].sort((x, y) => x.time - y.time)
  for (let i = 1; i < grid.length; i++) if (!(grid[i].time > grid[i - 1].time) || grid[i].tracked === grid[i - 1].tracked) return { report }
  const features = beatFeatures(spec, onset, sums, grid.map((g) => g.time), seconds, limits, tones)
  const lean = (values) => {
    const d = []
    for (let i = 2; i < grid.length; i++) if (grid[i].tracked) d.push(values[i] - values[i - 1])
    if (d.length < 4) return 0
    const m = mean(d)
    const sd = Math.sqrt(d.reduce((acc, v) => acc + (v - m) ** 2, 0) / (d.length - 1))
    return sd > 1e-12 ? (m / sd) * Math.sqrt(d.length) : 0
  }
  const bass = lean(features.bass)
  const chords = features.chordChange.length === grid.length ? lean(features.chordChange) : null
  const both = chords === null ? bass : (bass + chords) / Math.SQRT2
  report.bass = round(bass, 2)
  report.harmony = chords === null ? null : round(chords, 2)
  report.confidence = round(Math.abs(both), 2)
  let first = -1
  for (let f = 1; f < env.length - 1 && first < 0; f++) if (env[f] >= floor && env[f] >= env[f - 1] && env[f] >= env[f + 1]) first = f
  let away = 0.25
  if (first >= 0) {
    const off = (((first - own[0]) % period) + period) % period
    away = Math.min(off, period - off) / period
    report.firstSound = round(Math.max(0, peakAt(env, first) / frameRate - latency))
  }
  let move
  if (Math.abs(both) >= limits.barConfidence) {
    move = both < 0
    report.method = 'bass and harmony'
  } else if (Math.abs(report.share - 1) > limits.halfBeatTie) {
    move = report.share > 1
    report.method = 'stronger onsets'
  } else if (Math.abs(away - 0.25) > limits.halfBeatEdge && !(away > 0.25 && both > 0)) {
    move = away > 0.25
    report.method = 'first sound'
  } else return { report }
  if (!move) return { report }
  report.moved = true
  return { report, measured: b }
}

function attempt(samples, sampleRate, setting, opts, limits) {
  const spec = spectra(samples, sampleRate, setting)
  const onset = onsetEnvelope(spec, setting)
  const row = { settings: setting.name, autocorrelation: 0, comb: 0, difference: null, agree: false, pulse: 0, clear: false, steady: false }
  if (onset.silent) return { spec, onset, row }
  const a = tempoByAutocorrelation(onset.env, onset.frameRate, opts.defaultBpm, limits)
  const c = tempoByComb(onset.env, onset.frameRate, opts.defaultBpm, limits)
  row.autocorrelation = round(a.bpm, 3)
  row.comb = round(c.bpm, 3)
  if (!a.bpm || !c.bpm) return { spec, onset, row }
  row.difference = round(Math.abs(a.bpm - c.bpm), 3)
  row.agree = Math.abs(a.bpm - c.bpm) <= limits.tempoToleranceBpm
  row.pulse = round(a.strength, 3)
  row.clear = a.strength >= limits.minPulse
  if (!row.agree || !row.clear) return { spec, onset, row }
  const frames = trackBeats(onset.env, onset.frameRate, (a.bpm + c.bpm) / 2, setting.tightness)
  if (frames.length < 2 * opts.beatsPerBar) return { spec, onset, row }
  const measured = measureBeats(frames, onset, limits)
  return { spec, onset, row, measured, frames }
}

export function analyse(samples, sampleRate, opts, limits = LIMITS, settings = SETTINGS) {
  const { beatsPerBar, defaultBpm } = opts
  const seconds = samples.length / sampleRate
  const bounds = soundBounds(samples, sampleRate, limits)
  const sums = squareSums(kWeighted(samples, sampleRate))
  const tones = bounds.silent ? null : harmony(samples, sampleRate, limits)
  const tries = []
  let kept = null
  let base = null
  if (!bounds.silent) {
    for (const setting of settings) {
      const t = attempt(samples, sampleRate, setting, opts, limits)
      base ??= t
      if (t.measured) {
        const half = beatPhase(t.frames, t.spec, t.onset, sums, seconds, limits, tones)
        if (half.measured) t.measured = half.measured
        const smooth = smoothBeats(t.measured, beatsPerBar, limits)
        const end = Math.min(seconds, bounds.end)
        const times = extendBeats(smooth, bounds.start, end).filter((v) => v >= 0 && v < end - limits.peakReachSeconds)
        const firstSounding = times.findIndex((v) => v >= smooth[0] - 1e-6)
        const features = beatFeatures(t.spec, t.onset, sums, times, seconds, limits, tones)
        const bar = barPhase(features, beatsPerBar, Math.max(0, firstSounding), limits)
        const found = findSections(features, times, bar.phase, beatsPerBar, seconds, sums, sampleRate, limits)
        const steady = steadiness(t.measured, found.sections, limits)
        t.row.steady = steady.pass
        t.row.spread = Math.max(...steady.sections.map((r) => r.spread))
        t.row.worst = Math.max(...steady.sections.map((r) => r.worst))
        tries.push(t.row)
        if (steady.pass) {
          kept = { t, times, bar, found, steady, half: half.report }
          break
        }
      } else tries.push(t.row)
    }
  }
  const head = { version: MAP_VERSION, seconds: round(seconds), beatsPerBar }
  const loudest = (sections) => sections.reduce((best, s) => (s.loudness > best.loudness ? s : best), sections[0]).start
  if (kept) {
    const { t, times, bar, found, steady, half } = kept
    const beats = times.map((v) => round(v))
    const barLines = beats.filter((_, i) => i % beatsPerBar === bar.phase)
    return {
      ...head,
      method: 'tracked',
      bpm: round(slopeBpm(times), 3),
      beats,
      barLines,
      bars: countBars(barLines, beats, beatsPerBar, seconds),
      sections: found.sections,
      loudestSectionStart: loudest(found.sections),
      checks: {
        tempo: { autocorrelation: t.row.autocorrelation, comb: t.row.comb, difference: t.row.difference, tolerance: limits.tempoToleranceBpm, agree: true, pulse: t.row.pulse, minPulse: limits.minPulse },
        steady,
        tries,
        settings: t.row.settings,
        barPhase: bar,
        beatPhase: half,
        beatsMeasured: t.measured.filter((m) => m.found).length,
        beatsTracked: t.measured.length,
        boundaries: found.boundaries,
        soundStart: round(bounds.start),
        soundEnd: round(bounds.end),
        loudness: 'LUFS of the mono mix, K-weighted, not gated',
      },
    }
  }
  const grid = gridBeats(seconds, defaultBpm, beatsPerBar)
  const beats = grid.beats.map((v) => round(v))
  const barLines = beats.filter((_, i) => i % beatsPerBar === 0)
  let sections = [{ start: 0, end: round(seconds), loudness: round(loudnessBetween(sums, sampleRate, 0, seconds), 2) }]
  let boundaries = []
  if (base && !bounds.silent && beats.length >= 2 * beatsPerBar) {
    const features = beatFeatures(base.spec, base.onset, sums, grid.beats, seconds, limits, tones)
    const found = findSections(features, grid.beats, 0, beatsPerBar, seconds, sums, sampleRate, limits)
    sections = found.sections
    boundaries = found.boundaries
  }
  const last = tries[tries.length - 1]
  return {
    ...head,
    method: 'grid',
    bpm: round(grid.bpm, 3),
    beats,
    barLines,
    bars: grid.bars,
    sections,
    loudestSectionStart: loudest(sections),
    checks: {
      tempo: { autocorrelation: last?.autocorrelation ?? 0, comb: last?.comb ?? 0, difference: last?.difference ?? null, tolerance: limits.tempoToleranceBpm, agree: false, pulse: last?.pulse ?? 0, minPulse: limits.minPulse },
      steady: { tolerance: limits.steadyTolerance, share: limits.steadyShare, slip: limits.slipTolerance, sections: [], pass: false },
      tries,
      settings: 'grid',
      barPhase: { phase: 0, method: 'grid', confidence: 0, scores: [] },
      beatPhase: { share: 0, limit: limits.halfBeatShare, tested: false, method: 'grid', moved: false, confidence: 0 },
      beatsMeasured: 0,
      beatsTracked: 0,
      boundaries,
      soundStart: round(bounds.start),
      soundEnd: round(bounds.end),
      loudness: 'LUFS of the mono mix, K-weighted, not gated',
      reason: bounds.silent ? 'the file is silent' : tries.some((r) => r.agree && r.clear) ? 'the beat spacing was not steady in any try' : tries.some((r) => r.agree) ? 'no try found a clear pulse' : 'the two tempo methods did not agree in any try',
    },
  }
}
