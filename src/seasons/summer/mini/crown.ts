import { stream } from '../../../core/rng'
import { crownField, localPads, padAxes, type Pad } from '../../../miniature/trunk'

// Each pad is a cushion with a flat underside: lumps heap up on it, and only a thin layer of small ones lies under it. The shared body
// is worn down to a core, so that the tiers stand apart and the light of the bank shows between them, with the limbs crossing it.
export const FULL = { swell: -2.6, perMm2: 0.55, radius: [0.8, 1.75] as const, dome: 0.5, plump: 1.3, under: 0.6, underReach: 0.86, hang: 0.14, underSize: 0.7, reach: 1.04, blend: 0.16, knob: 0.3, knobMm: 1.15, wave: 0.45, waveMm: 4.3 }

// No pad stands over the fork or at the right any more: there the air is open and the limbs are seen against the bank.
export const more: readonly Pad[] = []

// How each shared pad carries its leaves: moved sideways (dx) and down (drop), narrower (wide, a share of its width) and heaped higher at
// its middle (heap, a factor on the dome). The two upper pads draw back from the middle and the thin pad behind them is bare, which leaves
// a slit of light under the dome. The wide pad at the middle left hangs lower, which opens the air between it and the pads above. The three
// lower pads heap up into full cushions; the upper ones keep their tops, so the tree is as tall as it was. The lumps are drawn as the
// shared list has them (the same draws, in the same order) and then moved, so that a pad that is not named here stands where it stood.
type Carry = { dx: number; drop: number; wide: number; heap: number; bare?: boolean }
const SAME: Carry = { dx: 0, drop: 0, wide: 1, heap: 1 }
const CARRY: readonly Carry[] = [
  SAME,
  { dx: -1.0, drop: 0, wide: 0.82, heap: 1 },
  { dx: 1.4, drop: 0, wide: 0.8, heap: 1 },
  SAME,
  SAME,
  SAME,
  { dx: 0, drop: 0, wide: 1, heap: 1, bare: true },
  { dx: 0, drop: 1.5, wide: 1, heap: 1.7 },
  { dx: 0, drop: 0, wide: 1, heap: 1.7 },
  { dx: 0, drop: 0, wide: 1, heap: 1.7 },
]
const carry = (i: number): Carry => CARRY[i] ?? SAME

// The pads as the leaves stand on them, in the trunk's own frame.
export const crownPads: readonly Pad[] = [...localPads.map((p, i): Pad => ({ ...p, at: [p.at[0] + carry(i).dx, p.at[1] - carry(i).drop, p.at[2]], size: [p.size[0] * carry(i).wide, p.size[1], p.size[2]] })).filter((_, i) => !carry(i).bare), ...more]

function gather(): Float64Array {
  const rng = stream('crown-summer')
  const out: number[] = []
  const all = [...localPads, ...more]
  for (let i = 0; i < all.length; i++) {
    const pad = all[i]!
    const how = i < localPads.length ? carry(i) : SAME
    const at = [pad.at[0] + how.dx, pad.at[1] - how.drop, pad.at[2]]
    const ax = padAxes(pad)
    const [a, b, c] = pad.size
    const n = Math.round(a * c * FULL.perMm2)
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n) * FULL.reach
      const th = k * 2.39996 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.radius[0], FULL.radius[1]) * (1 - 0.3 * rr)
      const s = Math.cos(th) * rr * (a - 0.6 * r) * how.wide
      const d = Math.sin(th) * rr * (c - 0.6 * r)
      const v = b * FULL.plump * (0.15 + FULL.dome * how.heap * (1 - rr * rr)) - 0.5 * r + rng.range(-0.5, 0.4)
      if (!how.bare) out.push(at[0]! + ax.side[0] * s + ax.up[0] * v + ax.depth[0] * d, at[1]! + ax.side[1] * s + ax.up[1] * v + ax.depth[1] * d, at[2]! + ax.side[2] * s + ax.up[2] * v + ax.depth[2] * d, r)
    }
    const m = Math.round(n * FULL.under)
    for (let k = 0; k < m; k++) {
      const rr = Math.sqrt((k + 0.5) / m) * FULL.underReach
      const th = k * 2.39996 + 1.1 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.radius[0], FULL.radius[1]) * (1 - 0.3 * rr)
      const s = Math.cos(th) * rr * (a - 0.6 * r) * how.wide
      const d = Math.sin(th) * rr * (c - 0.6 * r)
      const v = -b * FULL.plump * (0.1 + FULL.hang * (1 - rr * rr)) + 0.5 * r + rng.range(-0.4, 0.4)
      if (!how.bare) out.push(at[0]! + ax.side[0] * s + ax.up[0] * v + ax.depth[0] * d, at[1]! + ax.side[1] * s + ax.up[1] * v + ax.depth[1] * d, at[2]! + ax.side[2] * s + ax.up[2] * v + ax.depth[2] * d, r * FULL.underSize)
    }
  }
  return new Float64Array(out)
}

export const lumps = gather()

const box = ((): number[] => {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (let o = 0; o < lumps.length; o += 4) {
    for (let j = 0; j < 3; j++) {
      b[j] = Math.min(b[j]!, lumps[o + j]! - lumps[o + 3]!)
      b[j + 3] = Math.max(b[j + 3]!, lumps[o + j]! + lumps[o + 3]!)
    }
  }
  return b
})()

function lumpField(x: number, h: number, z: number): number {
  const out = Math.max(box[0]! - x, x - box[3]!, box[1]! - h, h - box[4]!, box[2]! - z, z - box[5]!)
  if (out > 3) return out
  let near = Infinity
  for (let o = 0; o < lumps.length; o += 4) {
    const d = Math.hypot(x - lumps[o]!, h - lumps[o + 1]!, z - lumps[o + 2]!) - lumps[o + 3]!
    if (d < near) near = d
  }
  if (near > 2.5) return near
  let sum = 0
  for (let o = 0; o < lumps.length; o += 4) {
    const d = Math.hypot(x - lumps[o]!, h - lumps[o + 1]!, z - lumps[o + 2]!) - lumps[o + 3]!
    sum += Math.exp(-(d - near) / FULL.blend)
  }
  return near - FULL.blend * Math.log(sum)
}

const knobs = (x: number, h: number, z: number): number => {
  const k = (2 * Math.PI) / FULL.knobMm
  const w = (2 * Math.PI) / FULL.waveMm
  return FULL.knob * (Math.sin(k * x + 1.3 * Math.sin(0.9 * h)) * Math.sin(k * h + 1.1 * Math.sin(1.2 * z)) * Math.sin(k * z + 1.7 * Math.sin(0.8 * x)) + 0.5 * Math.sin(1.9 * k * x + 2) * Math.sin(2.1 * k * h + 1) * Math.sin(1.7 * k * z)) + FULL.wave * Math.sin(w * x + 0.7) * Math.sin(w * h + 2.1) * Math.sin(w * z + 4.2)
}

export function leafBody(x: number, h: number, z: number): number {
  return Math.min(crownField(x, h, z) - FULL.swell, lumpField(x, h, z))
}

export function leafField(x: number, h: number, z: number): number {
  const d = leafBody(x, h, z)
  return d > 1.5 || d < -1.5 ? d : d + knobs(x, h, z)
}
