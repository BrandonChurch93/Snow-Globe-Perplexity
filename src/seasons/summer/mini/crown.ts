import { stream } from '../../../core/rng'
import { padAxes, type Pad } from '../../../miniature/trunk'

// The crown is a handful of rounded clumps of unlike size. Each is a dome of leaf on a nearly flat underside: `at` is the middle of
// that underside, `size` the clump's half width, its height and its half depth (millimetres, in the trunk's own frame) and `dir` the
// way it stands. Lumps stand proud of the dome and make its lobes; small ones hang under it and break the underside.
export interface Clump {
  at: Pad['at']
  size: Pad['size']
  dir: Pad['dir']
}

export const FULL = { core: 0.9, belly: 0.75, perMm2: 0.2, radius: [1.15, 2.3] as const, small: 0.3, proud: 0.45, under: 0.1, underRadius: [0.7, 1.15] as const, grain: 4.6, middle: 0.42, blend: 0.16, knob: 0.3, knobMm: 1.15, wave: 0.45, waveMm: 4.3 }

// The hero camera looks a little down: a point nearer to it by a millimetre sits lower in the picture by PITCH. The clumps are set
// out as that camera sees them, so `seen` takes the height in the picture and gives the height in the trunk's frame.
const PITCH = 0.0787

const seen = (x: number, hs: number, z: number, size: Pad['size'], lx = 0, lz = 0): Clump => {
  const n = Math.hypot(lx, 1, lz)
  return { at: [x, hs + PITCH * z, z], size, dir: [lx / n, 1 / n, lz / n] }
}

export const clumps: readonly Clump[] = [
  seen(-0.8, 37.6, 0.3, [4.4, 4.4, 4.0], 0.03),
  seen(-3.2, 39.8, 0.7, [2.2, 2.2, 2.8], -0.05),
  seen(3.4, 38.6, 0.6, [2.0, 1.6, 2.6], 0.08),
  seen(-11.7, 36.9, 2.0, [1.7, 1.2, 2.6], -0.2),
  seen(-7.8, 37.3, 1.5, [2.6, 1.4, 3.0], 0.12),
  seen(-9.6, 29.4, -2.2, [1.6, 1.4, 1.6]),
  seen(6.0, 32.2, 3.0, [2.9, 2.6, 3.5], 0.05),
  seen(7.2, 35.2, 2.2, [2.6, 2.8, 3.2], 0.1),
  seen(11.8, 31.0, 1.6, [2.3, 2.9, 3.5], 0.3),
  seen(-13.0, 29.3, 2.6, [3.0, 1.5, 3.3]),
  seen(-8.7, 29.1, 3.1, [3.0, 2.0, 3.9], 0.1),
  seen(-10.4, 27.6, 3.4, [1.5, 1.2, 2.2], -0.05),
  seen(-4.6, 30.3, 3.2, [1.6, 0.8, 3.0], 0.12),
  seen(-5.2, 32.4, 2.4, [1.4, 1.5, 2.4], 0.1),
  seen(-15.6, 21.4, 1.4, [1.4, 1.2, 2.0], 0.08),
  seen(-13.4, 23.0, 3.6, [3.2, 0.5, 3.0], -0.18),
  seen(-10.9, 24.0, 4.8, [1.7, 0.7, 1.4], -0.06),
  seen(-9.0, 23.6, 3.6, [2.6, 0.6, 3.0], -0.18),
  seen(2.4, 25.0, 2.6, [1.4, 0.2, 1.6]),
  seen(6.4, 24.2, 3.1, [2.4, 1.2, 3.7], 0.15),
  seen(11.3, 21.2, 2.8, [2.8, 5.0, 3.9], 0.03),
  seen(14.8, 19.5, 1.8, [1.6, 2.4, 2.9], 0.12),
  seen(10.2, 17.4, 3.8, [1.1, 1.6, 1.5], -0.05),
  seen(0.5, 33.6, -0.6, [4.8, 3.6, 3.3]),
  seen(-0.3, 32.0, 3.6, [3.4, 2.2, 2.4]),
  seen(5.8, 24.0, -2.2, [2.0, 1.4, 2.4], 0.1),
]

const frames = clumps.map((k) => ({ at: k.at, a: k.size[0], t: k.size[1], c: k.size[2], grain: Math.min(1, Math.max(0.35, Math.sqrt(k.size[0] * k.size[2]) / FULL.grain)), ...padAxes(k) }))

// The clumps as the leaves are lit on them: each a flat ellipsoid about the clump's middle, so that its top faces up and its
// underside faces down.
export const crownPads: readonly Pad[] = clumps.map((k) => {
  const lift = FULL.middle * k.size[1]
  return { at: [k.at[0] + k.dir[0] * lift, k.at[1] + k.dir[1] * lift, k.at[2] + k.dir[2] * lift], size: [k.size[0], (1 - FULL.middle) * k.size[1], k.size[2]], dir: k.dir }
})

function gather(): Float64Array {
  const rng = stream('crown-summer')
  const out: number[] = []
  for (const f of frames) {
    const put = (s: number, v: number, d: number, r: number): void => {
      out.push(f.at[0] + f.side[0] * s + f.up[0] * v + f.depth[0] * d, f.at[1] + f.side[1] * s + f.up[1] * v + f.depth[1] * d, f.at[2] + f.side[2] * s + f.up[2] * v + f.depth[2] * d, r)
    }
    const n = Math.round((Math.PI * f.a * f.c * (1 + (0.6 * f.t) / Math.sqrt(f.a * f.c)) * FULL.perMm2) / (f.grain * f.grain))
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n)
      const th = k * 2.39996 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.radius[0], FULL.radius[1]) * (1 - FULL.small * rr) * f.grain
      const s = Math.cos(th) * rr * f.a
      const d = Math.sin(th) * rr * f.c
      const v = f.t * Math.sqrt(Math.max(0, 1 - rr * rr))
      const pull = 1 - ((1 - FULL.proud) * r + rng.range(-0.45, 0.35) * f.grain) / (Math.hypot(s, v, d) || 1)
      put(s * pull, Math.max(v * pull, 0.3 * r), d * pull, r)
    }
    const m = Math.round((Math.PI * f.a * f.c * FULL.under) / (f.grain * f.grain))
    for (let k = 0; k < m; k++) {
      const rr = Math.sqrt((k + 0.5) / m) * 0.85
      const th = k * 2.39996 + 1.1 + rng.range(-0.4, 0.4)
      const r = rng.range(FULL.underRadius[0], FULL.underRadius[1]) * f.grain
      put(Math.cos(th) * rr * (f.a - r), (-FULL.belly * (1 - rr * rr) + rng.range(-0.2, 0.2)) * f.grain + 0.35 * r, Math.sin(th) * rr * (f.c - r), r)
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

// The smooth body of the clumps, under the lumps: a dome over each underside and a shallow belly below it.
function bodyField(x: number, h: number, z: number): number {
  let near = Infinity
  for (const f of frames) {
    const dx = x - f.at[0]
    const dy = h - f.at[1]
    const dz = z - f.at[2]
    const s = dx * f.side[0] + dy * f.side[1] + dz * f.side[2]
    const u = dx * f.up[0] + dy * f.up[1] + dz * f.up[2]
    const d = dx * f.depth[0] + dy * f.depth[1] + dz * f.depth[2]
    const q = Math.hypot(s / f.a, u / (u >= 0 ? f.t : FULL.belly * f.grain), d / f.c)
    const dist = (q > 1e-6 ? Math.hypot(s, u, d) * (1 - 1 / q) : -FULL.belly * f.grain) + FULL.core * f.grain
    if (dist < near) near = dist
  }
  return near
}

const knobs = (x: number, h: number, z: number): number => {
  const k = (2 * Math.PI) / FULL.knobMm
  const w = (2 * Math.PI) / FULL.waveMm
  return FULL.knob * (Math.sin(k * x + 1.3 * Math.sin(0.9 * h)) * Math.sin(k * h + 1.1 * Math.sin(1.2 * z)) * Math.sin(k * z + 1.7 * Math.sin(0.8 * x)) + 0.5 * Math.sin(1.9 * k * x + 2) * Math.sin(2.1 * k * h + 1) * Math.sin(1.7 * k * z)) + FULL.wave * Math.sin(w * x + 0.7) * Math.sin(w * h + 2.1) * Math.sin(w * z + 4.2)
}

// Notches through the crown, as the hero camera sees it: each is an ellipse in the plane that faces the camera (its middle, its half
// width and half height in millimetres, and its tilt in degrees) and runs straight through along the line of sight, which climbs by
// PITCH for every millimetre toward the camera. The sprigs on their walls close about a millimetre of each side.
export const holes: readonly (readonly [number, number, number, number, number])[] = []

const cuts = holes.map((o) => ({ x: o[0], h: o[1], a: o[2], b: o[3], cos: Math.cos((o[4] * Math.PI) / 180), sin: Math.sin((o[4] * Math.PI) / 180) }))

function holeField(x: number, h: number, z: number): number {
  let near = Infinity
  const hs = h - PITCH * z
  for (const o of cuts) {
    const dx = x - o.x
    const dy = hs - o.h
    const d = (Math.hypot((dx * o.cos + dy * o.sin) / o.a, (dy * o.cos - dx * o.sin) / o.b) - 1) * Math.min(o.a, o.b)
    if (d < near) near = d
  }
  return near
}

export function leafBody(x: number, h: number, z: number): number {
  return Math.max(Math.min(bodyField(x, h, z), lumpField(x, h, z)), -holeField(x, h, z))
}

export function leafField(x: number, h: number, z: number): number {
  const d = leafBody(x, h, z)
  return d > 1.5 || d < -1.5 ? d : d + knobs(x, h, z)
}
