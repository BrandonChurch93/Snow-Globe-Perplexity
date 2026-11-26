import { stream } from '../../../core/rng'
import { crownField, localPads, padAxes } from '../../../miniature/trunk'

export const FULL = { swell: -0.85, perMm2: 0.5, radius: [0.9, 2.3] as const, dome: 0.95, reach: 1.04, blend: 0.16, knob: 0.3, knobMm: 1.15, wave: 0.45, waveMm: 4.3 }

// The shared pads stand in tiers with room between them. These stand in that room, inside the same outline, so the crown is one canopy.
const BETWEEN: readonly { at: readonly [number, number, number]; size: readonly [number, number, number] }[] = [
  { at: [2, 30.6, 3], size: [5.6, 2.6, 4.2] },
  { at: [11, 28.4, 2.4], size: [4.8, 2.6, 4] },
  { at: [-1.5, 25.6, 4.2], size: [5.2, 2.4, 3.8] },
  { at: [-13.4, 24.4, 1.6], size: [4, 2.2, 3.6] },
  { at: [5.2, 26.2, 4.4], size: [3.8, 2.2, 3.4] },
  { at: [-8.5, 31.4, 3.4], size: [4.4, 2, 3.6] },
]

function gather(): Float64Array {
  const rng = stream('crown-summer')
  const out: number[] = []
  for (const pad of localPads) {
    const ax = padAxes(pad)
    const [a, b, c] = pad.size
    const n = Math.round(a * c * FULL.perMm2)
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n) * FULL.reach
      const th = k * 2.39996 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.radius[0], FULL.radius[1]) * (1 - 0.3 * rr)
      const s = Math.cos(th) * rr * (a - 0.6 * r)
      const d = Math.sin(th) * rr * (c - 0.6 * r)
      const v = b * (0.15 + FULL.dome * (1 - rr * rr)) - 0.5 * r + rng.range(-0.5, 0.4)
      out.push(pad.at[0] + ax.side[0] * s + ax.up[0] * v + ax.depth[0] * d, pad.at[1] + ax.side[1] * s + ax.up[1] * v + ax.depth[1] * d, pad.at[2] + ax.side[2] * s + ax.up[2] * v + ax.depth[2] * d, r)
    }
  }
  for (const pad of BETWEEN) {
    const [a, b, c] = pad.size
    for (const s of [-0.9, 0, 0.9]) out.push(pad.at[0] + s * (a - b), pad.at[1], pad.at[2], b)
    const n = Math.round(a * c * FULL.perMm2)
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n) * FULL.reach
      const th = k * 2.39996 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.radius[0], FULL.radius[1]) * (1 - 0.3 * rr)
      out.push(pad.at[0] + Math.cos(th) * rr * (a - 0.6 * r), pad.at[1] + b * (0.15 + FULL.dome * (1 - rr * rr)) - 0.5 * r + rng.range(-0.5, 0.4), pad.at[2] + Math.sin(th) * rr * (c - 0.6 * r), r)
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
