import { stream } from '../../../core/rng'
import { crownField, localPads, padAxes } from '../../../miniature/trunk'

export const FULL = { swell: 0.15, perMm2: 0.5, radius: [1.0, 1.8] as const, dome: 0.7, reach: 1.12, blend: 0.35, knob: 0.24, knobMm: 1.15 }

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
  return FULL.knob * (Math.sin(k * x + 1.3 * Math.sin(0.9 * h)) * Math.sin(k * h + 1.1 * Math.sin(1.2 * z)) * Math.sin(k * z + 1.7 * Math.sin(0.8 * x)) + 0.5 * Math.sin(1.9 * k * x + 2) * Math.sin(2.1 * k * h + 1) * Math.sin(1.7 * k * z))
}

export function leafBody(x: number, h: number, z: number): number {
  return Math.min(crownField(x, h, z) - FULL.swell, lumpField(x, h, z))
}

export function leafField(x: number, h: number, z: number): number {
  const d = leafBody(x, h, z)
  return d > 1.5 || d < -1.5 ? d : d + knobs(x, h, z)
}
