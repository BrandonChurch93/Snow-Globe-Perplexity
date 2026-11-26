import { stream } from '../../../core/rng'
import { crownField, localPads, padAxes, type Pad } from '../../../miniature/trunk'

// Each pad is a plump cushion: lumps heap up on it and hang under it, so that the tiers stand close and only narrow air parts them.
export const FULL = { swell: -1.5, perMm2: 0.55, radius: [0.8, 1.75] as const, dome: 0.5, plump: 1.3, under: 0.6, underReach: 0.86, hang: 0.38, reach: 1.04, blend: 0.16, knob: 0.3, knobMm: 1.15, wave: 0.45, waveMm: 4.3 }

// The shared pads leave the fork and the right side bare. Two more pads stand there, one over the fork and one at the right, each parted from its neighbours by a narrow slit of air.
export const more: readonly Pad[] = [
  { at: [0.8, 30, 2.6], size: [4.2, 1.6, 3.4], dir: [0, 1, 0] },
  { at: [12.6, 26.9, 0.8], size: [3.4, 1.5, 3.2], dir: [0, 1, 0] },
]

function gather(): Float64Array {
  const rng = stream('crown-summer')
  const out: number[] = []
  for (const pad of [...localPads, ...more]) {
    const ax = padAxes(pad)
    const [a, b, c] = pad.size
    const n = Math.round(a * c * FULL.perMm2)
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n) * FULL.reach
      const th = k * 2.39996 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.radius[0], FULL.radius[1]) * (1 - 0.3 * rr)
      const s = Math.cos(th) * rr * (a - 0.6 * r)
      const d = Math.sin(th) * rr * (c - 0.6 * r)
      const v = b * FULL.plump * (0.15 + FULL.dome * (1 - rr * rr)) - 0.5 * r + rng.range(-0.5, 0.4)
      out.push(pad.at[0] + ax.side[0] * s + ax.up[0] * v + ax.depth[0] * d, pad.at[1] + ax.side[1] * s + ax.up[1] * v + ax.depth[1] * d, pad.at[2] + ax.side[2] * s + ax.up[2] * v + ax.depth[2] * d, r)
    }
    const m = Math.round(n * FULL.under)
    for (let k = 0; k < m; k++) {
      const rr = Math.sqrt((k + 0.5) / m) * FULL.underReach
      const th = k * 2.39996 + 1.1 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.radius[0], FULL.radius[1]) * (1 - 0.3 * rr)
      const s = Math.cos(th) * rr * (a - 0.6 * r)
      const d = Math.sin(th) * rr * (c - 0.6 * r)
      const v = -b * FULL.plump * (0.1 + FULL.hang * (1 - rr * rr)) + 0.5 * r + rng.range(-0.4, 0.4)
      out.push(pad.at[0] + ax.side[0] * s + ax.up[0] * v + ax.depth[0] * d, pad.at[1] + ax.side[1] * s + ax.up[1] * v + ax.depth[1] * d, pad.at[2] + ax.side[2] * s + ax.up[2] * v + ax.depth[2] * d, r)
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
