import { streamSeed, hash2, unit } from './rng'

export interface Sample {
  index: number
  px: number
  py: number
  lu: number
  lv: number
  t: number
}

const PHI5 = 1.1673039782614187
const ALPHA = [1, 2, 3, 4, 5].map((k) => 1 / PHI5 ** k)
const frac = (x: number) => x - Math.floor(x)

export function diskPoint(u: number, v: number): [number, number] {
  const a = 2 * u - 1
  const b = 2 * v - 1
  if (a === 0 && b === 0) return [0, 0]
  let r: number
  let phi: number
  if (Math.abs(a) > Math.abs(b)) {
    r = a
    phi = (Math.PI / 4) * (b / a)
  } else {
    r = b
    phi = Math.PI / 2 - (Math.PI / 4) * (a / b)
  }
  return [r * Math.cos(phi), r * Math.sin(phi)]
}

export function sampleSet(count: number, salt = 0, name = 'sampler'): Sample[] {
  const seed = streamSeed(name)
  const offset = [0, 1, 2, 3, 4].map((d) => unit(hash2(seed + d, salt)))
  const out: Sample[] = []
  for (let i = 0; i < count; i++) {
    const v = ALPHA.map((a, d) => frac(offset[d]! + a * (i + 1)))
    const [lu, lv] = diskPoint(v[2]!, v[3]!)
    const t = count === 1 ? 0.5 : (i + frac(offset[4]! + ALPHA[0]! * (i + 1))) / count
    out.push({ index: i, px: v[0]! - 0.5, py: v[1]! - 0.5, lu, lv, t: count === 1 ? 0.5 : t })
  }
  if (count > 1) {
    const order = out.map((_, i) => i).sort((a, b) => v4(out[a]!) - v4(out[b]!))
    const ts = out.map((s) => s.t)
    order.forEach((idx, rank) => (out[idx]!.t = ts[rank]!))
  }
  return out
}

function v4(s: Sample): number {
  return frac(s.px + 0.5 + (s.lu + 1) * 0.37 + (s.lv + 1) * 0.11)
}
