import { streamSeed, hash2, unit } from './rng'

export interface Sample {
  index: number
  px: number
  py: number
  lu: number
  lv: number
  t: number
  /** How many samples the set has. */
  of?: number
  /** The change number at the first sample of the frame. The base's share is read from it at every sample, so that all of a frame's samples hold one share. */
  hold?: number
}

const PHI5 = 1.1673039782614187
const ALPHA = [1, 2, 3, 4, 5].map((k) => 1 / PHI5 ** k)
const frac = (x: number) => x - Math.floor(x)
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

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
    // The lens. One sample keeps the old point. A set is a sunflower spiral, turned by the
    // picture's own angle and slid along its radius: its points fall on `count` different
    // offsets along every direction, so an edge out of focus is a ramp of `count` fine steps.
    // (Two dimensions of the R sequence gave a few rows of points at 24, and a far ridge drew
    // as five stacked copies of itself.)
    let lu: number
    let lv: number
    if (count === 1) {
      ;[lu, lv] = diskPoint(v[2]!, v[3]!)
    } else {
      const r = Math.sqrt((i + offset[3]!) / count)
      const th = 2 * Math.PI * offset[2]! + GOLDEN_ANGLE * i
      lu = r * Math.cos(th)
      lv = r * Math.sin(th)
    }
    const t = count === 1 ? 0.5 : (i + frac(offset[4]! + ALPHA[0]! * (i + 1))) / count
    out.push({ index: i, px: v[0]! - 0.5, py: v[1]! - 0.5, lu, lv, t: count === 1 ? 0.5 : t, of: count })
  }
  if (count > 1) {
    const order = out.map((_, i) => i).sort((a, b) => v4(out[a]!) - v4(out[b]!))
    const ts = out.map((s) => s.t)
    order.forEach((idx, rank) => (out[idx]!.t = ts[rank]!))
  }
  return out
}

/**
 * The set every picture is drawn with. A set of more than `anchor` samples is slid so that its mean place in the pixel is
 * the anchor set's: a frame drawn with more samples then sits where a frame drawn with `anchor` sits, and a film that
 * changes its count does not step sideways. Sets of `anchor` or fewer are the plain sets, bit for bit.
 */
export function pictureSet(count: number, anchor: number): Sample[] {
  const set = sampleSet(count, 0, 'picture')
  if (count <= anchor) return set
  const mean = (list: Sample[]): [number, number] => [list.reduce((a, s) => a + s.px, 0) / list.length, list.reduce((a, s) => a + s.py, 0) / list.length]
  const [ax, ay] = mean(sampleSet(anchor, 0, 'picture'))
  const [mx, my] = mean(set)
  for (const s of set) {
    s.px += ax - mx
    s.py += ay - my
  }
  return set
}

function v4(s: Sample): number {
  return frac(s.px + 0.5 + (s.lu + 1) * 0.37 + (s.lv + 1) * 0.11)
}
