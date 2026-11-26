import { stream } from '../../../core/rng'
import { crownField, localPads, padAxes, type Pad } from '../../../miniature/trunk'

// Each pad is a cushion with a flat underside: lumps heap up on it and a layer of them hangs under it. The shared body is worn down
// only a little, so the pads of one tier run into one another; the slits further down cut the tiers apart.
export const FULL = { swell: -1.5, perMm2: 0.55, radius: [0.8, 1.75] as const, dome: 0.48, plump: 1.3, under: 0.6, underReach: 0.86, hang: 0.3, underSize: 1, reach: 1.04, blend: 0.16, knob: 0.3, knobMm: 1.15, wave: 0.45, waveMm: 4.3 }

// More pads than the shared list has, all of them in front of the limbs, so that from the front the leaves cover the wood. One stands
// over the fork in the wide middle tier, one hangs on the left limb under it and one fills the right of the middle tier. Four more
// stand at the ends of the middle and the lower tier: they carry the crown out to the width it has in the approved picture and join
// the tiers at their far ends.
export const more: readonly Pad[] = [
  { at: [0.5, 28.6, 3.6], size: [6.0, 2.3, 4.0], dir: [0.02, 1.0, 0] },
  { at: [-7.0, 21.4, 3.2], size: [4.6, 2.2, 3.6], dir: [-0.1, 0.995, 0] },
  { at: [7.4, 29.4, 3.8], size: [5.4, 2.8, 4.0], dir: [0.1, 0.995, 0] },
  { at: [-12.4, 27.8, 2.4], size: [4.2, 2.3, 3.8], dir: [-0.12, 0.993, 0] },
  { at: [-15.2, 23.0, 1.0], size: [4.0, 2.3, 3.6], dir: [-0.15, 0.989, 0] },
  { at: [13.1, 27.8, 1.4], size: [4.8, 2.4, 3.8], dir: [0.14, 0.99, 0] },
  { at: [13.6, 23.4, 2.4], size: [3.8, 2.4, 3.6], dir: [0.12, 0.993, 0] },
]

// How each shared pad carries its leaves: moved sideways (dx) and down (drop), narrower (wide, a share of its width) and heaped higher at
// its middle (heap, a factor on the dome). The wide pad at the middle left hangs a little lower and the three lower pads heap a little
// higher; the others stand as the shared list has them. The lumps are drawn as the shared list has them (the same draws, in the same
// order) and then moved, so that a pad that is not named here stands where it stood.
type Carry = { dx: number; drop: number; wide: number; heap: number; bare?: boolean }
const SAME: Carry = { dx: 0, drop: 0, wide: 1, heap: 1 }
const CARRY: readonly Carry[] = [
  SAME,
  SAME,
  SAME,
  SAME,
  SAME,
  SAME,
  SAME,
  { dx: 0, drop: 0.6, wide: 1, heap: 1.3 },
  { dx: 0, drop: 0, wide: 1, heap: 1.3 },
  { dx: 0, drop: 0, wide: 1, heap: 1.3 },
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

// Cuts through the crown, as the hero camera sees it: each is an ellipse in the plane that faces the camera (its middle, then its
// half width and half height, in millimetres) and runs straight through along the line of sight, which climbs by PITCH for every
// millimetre toward the camera. The first four are the long slits of sky between the tiers (upper left, upper right, lower left,
// lower right), through which the limbs show. The last three take the shoulders down beside the top tuft and at the upper left.
// The sprigs on their walls close about a millimetre of each side.
const PITCH = 0.0787
export const holes: readonly (readonly [number, number, number, number])[] = [
  [-8.6, 32.2, 7.2, 2.15],
  [7.8, 31.8, 4.2, 1.85],
  [-9.4, 24.0, 6.6, 2.3],
  [8.8, 25.0, 5.4, 2.1],
  [-12.6, 40.0, 5.6, 2.9],
  [12.0, 38.8, 5.6, 3.2],
  [-19.0, 33.2, 3.8, 3.0],
]

function holeField(x: number, h: number, z: number): number {
  let near = Infinity
  for (const o of holes) {
    const d = (Math.hypot((x - o[0]) / o[2], (h - o[1] - PITCH * z) / o[3]) - 1) * Math.min(o[2], o[3])
    if (d < near) near = d
  }
  return near
}

export function leafBody(x: number, h: number, z: number): number {
  return Math.max(Math.min(crownField(x, h, z) - FULL.swell, lumpField(x, h, z)), -holeField(x, h, z))
}

export function leafField(x: number, h: number, z: number): number {
  const d = leafBody(x, h, z)
  return d > 1.5 || d < -1.5 ? d : d + knobs(x, h, z)
}
