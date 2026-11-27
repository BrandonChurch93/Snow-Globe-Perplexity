import { hash2, stream, unit } from '../../../core/rng'
import { crownOffset, foot, limbs, padAxes, type Limb, type Pad } from '../../../miniature/trunk'
import type { Vec3 } from '../../kit'
import { lanterns, stringEnds } from './lanterns'

// The crown is a handful of rounded clumps of unlike size. Each is a dome of leaf on a nearly flat underside: `at` is the middle of
// that underside, `size` the clump's half width, its height and its half depth (millimetres, in the trunk's own frame) and `dir` the
// way it stands. Lumps stand proud of the dome and make its lobes; small ones hang under it, some lower than others (`underDrop`),
// and break the underside into unequal lobes.
export interface Clump {
  at: Pad['at']
  size: Pad['size']
  dir: Pad['dir']
}

export const FULL = { core: 0.9, belly: 1.3, perMm2: 0.2, radius: [1.15, 2.3] as const, small: 0.3, proud: 0.45, under: 0.2, underRadius: [0.7, 1.7] as const, underDrop: [-0.75, 0.3] as const, grain: 4.6, middle: 0.42, blend: 0.16, knob: 0.3, knobMm: 1.15, wave: 0.45, waveMm: 4.3 }

// The hero camera looks a little down: a point nearer to it by a millimetre sits lower in the picture by PITCH. The clumps are set
// out as that camera sees them, so `seen` takes the height in the picture and gives the height in the trunk's frame.
const PITCH = 0.0787

const seen = (x: number, hs: number, z: number, size: Pad['size'], lx = 0, lz = 0): Clump => {
  const n = Math.hypot(lx, 1, lz)
  return { at: [x, hs + PITCH * z, z], size, dir: [lx / n, 1 / n, lz / n] }
}

// A body that hangs: its flat side lies at the height `hs` in the picture, inside the mass it hangs from, and its dome points down.
const hung = (x: number, hs: number, z: number, size: Pad['size'], lx = 0): Clump => {
  const n = Math.hypot(lx, 1)
  return { at: [x, hs + PITCH * z, z], size, dir: [lx / n, -1 / n, 0] }
}

export const clumps: readonly Clump[] = [
  // The top clump, left of the middle, with a knob on its left shoulder and a smaller one at its right.
  seen(-0.8, 37.6, 0.3, [4.4, 4.6, 4.0], 0.03),
  seen(-2.4, 41.4, 0.7, [2.3, 2.2, 2.8], -0.05),
  seen(3.4, 38.6, 0.6, [2.0, 1.6, 2.6], 0.08),
  // Its two shoulders: a body at each side, so that the outline runs down from the top to the masses in one curve and not in steps.
  seen(-5.4, 36.6, 1.4, [2.6, 3.6, 3.0], -0.12),
  seen(6.2, 35.6, 1.6, [2.8, 3.2, 3.0], 0.15),
  // The upper left clump, and a small body behind and under it. Its underside falls toward the stem, so the notch under it is a wedge.
  seen(-11.4, 36.3, 2.0, [2.0, 2.8, 2.6], -0.2),
  seen(-8.2, 36.1, 1.5, [2.8, 3.6, 3.0], 0.25),
  seen(-9.6, 29.4, -2.2, [1.6, 1.4, 1.6]),
  // The right mass: lobes that step down to the right, and a tip. It hangs low over the mass under it.
  seen(6.0, 30.6, 3.0, [2.9, 3.8, 3.5], 0.05),
  seen(9.8, 33.4, 2.2, [3.0, 3.4, 3.2], 0.1),
  seen(12.4, 29.0, 1.6, [2.6, 4.6, 3.5], 0.3),
  seen(14.6, 26.6, 1.8, [1.4, 2.0, 2.0], 0.15),
  // The large left mass: it reaches farthest out.
  seen(-14.1, 28.4, 2.6, [3.4, 2.8, 3.3], -0.25),
  seen(-8.7, 30.2, 3.1, [3.0, 2.3, 3.9], 0.08),
  seen(-12.4, 28.6, 3.4, [2.0, 1.8, 2.2], -0.1),
  seen(-4.4, 30.1, 3.2, [2.0, 1.9, 3.0], 0.1),
  seen(-5.2, 32.0, 2.4, [1.6, 2.0, 2.4], 0.1),
  // The mass low at the left, over the left limb: the lowest of the crown, a full rounded body that climbs toward the stem.
  seen(-14.7, 20.2, 1.6, [2.6, 2.4, 2.4], 0.05),
  seen(-11.6, 21.2, 3.6, [3.4, 2.8, 3.0], -0.2),
  seen(-8.6, 22.4, 4.4, [2.6, 2.2, 2.0], -0.06),
  seen(-6.2, 23.4, 3.4, [2.0, 1.6, 2.6], -0.1),
  // About the stem: a small clump at each side before the fork, which brings the crown's underside down over it, a lobe over the right
  // limb, and two lumps above it.
  seen(2.4, 25.0, 3.2, [1.8, 1.6, 1.8]),
  seen(-0.4, 26.0, 3.4, [1.5, 1.5, 2.0]),
  seen(7.2, 25.0, 3.1, [2.2, 1.4, 3.7], 0.15),
  seen(4.6, 27.6, 3.4, [1.0, 2.6, 1.2]),
  seen(2.6, 30.4, 2.6, [1.4, 2.4, 1.8]),
  // The mass low at the right.
  seen(12.0, 22.6, 2.8, [2.8, 3.2, 3.9], 0.03),
  seen(15.0, 19.8, 1.8, [2.2, 3.0, 2.9], 0.12),
  // Bodies about the stem that fill the middle between the masses. Under them small windows stay open at each side of the stem, where
  // the lit arms show.
  seen(0.5, 33.6, -0.6, [4.8, 3.6, 3.3]),
  seen(-1.2, 30.5, 3.4, [3.0, 3.4, 2.6]),
  seen(5.8, 24.0, -2.2, [2.0, 1.4, 2.4], 0.1),
  // No level band of sky stays between the masses: bodies of unlike size hang from the upper ones toward the lower, each a rounded
  // lobe, and what is left between them is a crease that the sprigs nearly close. At the left three hang from the large mass over
  // the low one (the middle one comes down onto it, the one by the fork stays short), and one from the upper clump over the large mass,
  // so that the notch over it opens only at the outline.
  hung(-12.6, 28.6, 3.0, [1.9, 1.6, 2.4]),
  hung(-9.4, 29.4, 3.6, [1.8, 4.3, 2.2]),
  hung(-6.2, 29.6, 3.2, [1.4, 2.2, 2.0]),
  hung(-8.6, 36.2, 2.2, [2.0, 2.3, 2.4]),
  // At the right two hang from the right mass over the low one, the outer one onto it.
  hung(7.6, 30.2, 3.4, [1.9, 2.0, 2.4]),
  hung(11.0, 28.8, 3.0, [1.8, 2.2, 2.4]),
  // One at the right of the fork, in front of the arms, short, so that small holes stay about the stem.
  hung(4.9, 25.6, 3.8, [1.5, 2.4, 1.8]),
  // Lobes under the low masses, where the limbs that carry them end, and one over the end of the twig that carries the last lanterns.
  hung(11.2, 22.4, 3.4, [1.6, 3.4, 2.0]),
  hung(-13.2, 20.4, 0.4, [1.6, 2.0, 1.8]),
  hung(-9.4, 21.6, 3.2, [1.4, 2.2, 1.8]),
  hung(13.8, 20.3, 3.9, [1.5, 3.6, 1.8]),
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
      put(Math.cos(th) * rr * (f.a - r), (-FULL.belly * (1 - rr * rr) + rng.range(FULL.underDrop[0], FULL.underDrop[1])) * f.grain + 0.35 * r, Math.sin(th) * rr * (f.c - r), r)
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
// PITCH for every millimetre toward the camera. The sprigs on their walls close about a millimetre of each side. None is cut now:
// the notches are what the clumps leave between them, each a wedge that opens at the outline.
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

// The shared trunk's limbs are straight, and some of its twigs end in the open. This season winds the wood after it is made: each
// vertex follows the limb it lies on. A limb winds about its own line (`windPerMm` of its length, `windMm` at most, over `cycles`),
// is thick at its foot and thin at its tip (`thick`, `thin`), and its tip is led into the nearest leaf within `reachMm`, `insideMm`
// deep. One that finds no leaf is drawn back into the wood it grows from, or to the last lantern it carries. Where a lantern hangs
// from the wood, at the peg of the large one and at the string's end nothing moves (`holdMm`, free again by `freeMm`).
export const BOUGH = { windPerMm: 0.05, windMm: 0.8, cycles: [1.3, 1.8] as const, windFrom: 0.08, windTo: 0.45, depth: 0.5, thick: 1.2, thin: 0.65, twigThin: 0.8, insideMm: 0.5, reachMm: 3.3, stepMm: 0.55, turnFrom: 0.5, twigTurnFrom: 0.2, onMm: 0.15, holdMm: 0.5, freeMm: 1.6, footFade: 0.6, past: 0.04, bareMm: 2.2, bareSteps: 12, skinMm: 0.12 }
// The stem winds in a slow S between these heights over the ground: to the left below, to the right above (`mm` at its widest).
export const STEM_S = { mm: 0.9, fromMm: 2.5, toMm: 17 }

export interface Bough {
  kind: Limb['kind']
  points: readonly Vec3[]
  radii: readonly number[]
  along: number[]
  length: number
  box: number[]
  foot: Vec3
  fade: number
  side: Vec3
  deep: Vec3
  wind: number
  depth: number
  cycles: number
  phase: number
  end: Vec3
  from: number
  cut: number
  to: Vec3
  thick: number
  thin: number
}

export type Xyz = [number, number, number]

export interface Hit {
  k: number
  s: number
  d: number
  at: Xyz
  r: number
}

export const newHit = (): Hit => ({ k: -1, s: 0, d: Infinity, at: [0, 0, 0], r: 0 })

const ease = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// How far a point is from the skin of one limb, and where along it. The hit is kept only if it is nearer than what `hit` holds.
// With `kept`, only the length of the limb that is not drawn back counts.
function nearOn(b: Bough, k: number, x: number, y: number, z: number, hit: Hit, kept = false): void {
  if (Math.max(b.box[0]! - x, x - b.box[3]!, b.box[1]! - y, y - b.box[4]!, b.box[2]! - z, z - b.box[5]!) > hit.d) return
  for (let j = 1; j < b.points.length; j++) {
    if (kept && b.along[j - 1]! >= b.cut * b.length) break
    const p = b.points[j - 1]!
    const q = b.points[j]!
    const ex = q[0] - p[0]
    const ey = q[1] - p[1]
    const ez = q[2] - p[2]
    const len = ex * ex + ey * ey + ez * ez
    const t = len > 0 ? Math.min(1, Math.max(0, ((x - p[0]) * ex + (y - p[1]) * ey + (z - p[2]) * ez) / len)) : 0
    const ax = p[0] + ex * t
    const ay = p[1] + ey * t
    const az = p[2] + ez * t
    const r = b.radii[j - 1]! + (b.radii[j]! - b.radii[j - 1]!) * t
    const d = Math.hypot(x - ax, y - ay, z - az) - r
    if (d >= hit.d) continue
    hit.d = d
    hit.k = k
    hit.s = (b.along[j - 1]! + (b.along[j]! - b.along[j - 1]!) * t) / b.length
    hit.at[0] = ax
    hit.at[1] = ay
    hit.at[2] = az
    hit.r = r
  }
}

// The limb a point lies on: the nearest by its skin, among the first `upTo` of the list.
export function nearest(list: readonly Bough[], x: number, y: number, z: number, hit: Hit, upTo = list.length, kept = false): Hit {
  hit.k = -1
  hit.d = Infinity
  for (let k = 0; k < upTo; k++) nearOn(list[k]!, k, x, y, z, hit, kept)
  return hit
}

const stemShift = (h: number): number => {
  const u = Math.min(1, Math.max(0, (h - STEM_S.fromMm) / (STEM_S.toMm - STEM_S.fromMm)))
  const s = Math.sin(Math.PI * u)
  return -1.3 * STEM_S.mm * Math.sin(2 * Math.PI * u) * s * s
}

// What the wood of one limb is moved by at the share `s` of its length (the stem and the roots: at the height `y` on the stage).
export function shiftOf(b: Bough, s: number, y: number, out: Xyz): Xyz {
  if (b.kind === 'stem' || b.kind === 'root') {
    out[0] = stemShift(y - foot[1])
    out[1] = 0
    out[2] = 0
    return out
  }
  const keep = b.fade > 0 ? 1 - ease(0, b.fade, s) : 1
  const env = b.wind * ease(BOUGH.windFrom, BOUGH.windTo, s)
  const a = env * Math.sin(2 * Math.PI * (b.cycles * s + b.phase))
  const c = env * b.depth * Math.sin(2 * Math.PI * (0.8 * b.cycles * s + 1.7 * b.phase + 0.3))
  const e = ease(b.from, 1, s)
  for (let j = 0; j < 3; j++) out[j] = b.foot[j]! * keep + b.side[j]! * a + b.deep[j]! * c + b.end[j]! * e
  return out
}

function pointAt(b: Bough, s: number): Vec3 {
  const want = s * b.length
  let j = 1
  while (j < b.points.length - 1 && b.along[j]! < want) j++
  const t = Math.min(1, Math.max(0, (want - b.along[j - 1]!) / Math.max(1e-9, b.along[j]! - b.along[j - 1]!)))
  const p = b.points[j - 1]!
  const q = b.points[j]!
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]
}

const DIRS: readonly Vec3[] = ((): Vec3[] => {
  const out: Vec3[] = []
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const n = Math.hypot(x, y, z)
        if (n > 0) out.push([x / n, y / n, z / n])
      }
  return out
})()

export interface Winding {
  list: Bough[]
  holds: Vec3[]
}

let wound: Winding | null = null

// The limbs with what each is moved by, worked out once. It yields between limbs: the search for leaf is not cheap.
export function* winding(): Generator<void, Winding> {
  if (wound) return wound
  const offset = crownOffset()
  const hit = newHit()
  const move: Xyz = [0, 0, 0]
  const list: Bough[] = limbs.map((l) => {
    const along = [0]
    for (let j = 1; j < l.points.length; j++) along.push(along[j - 1]! + Math.hypot(l.points[j]![0] - l.points[j - 1]![0], l.points[j]![1] - l.points[j - 1]![1], l.points[j]![2] - l.points[j - 1]![2]))
    const wide = Math.max(...l.radii)
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    for (const p of l.points)
      for (let a = 0; a < 3; a++) {
        box[a] = Math.min(box[a]!, p[a]! - wide)
        box[a + 3] = Math.max(box[a + 3]!, p[a]! + wide)
      }
    return { kind: l.kind, points: l.points, radii: l.radii, along, length: along[along.length - 1]! || 1, box, foot: [0, 0, 0], fade: 0, side: [1, 0, 0], deep: [0, 0, 1], wind: 0, depth: 0, cycles: 1, phase: 0, end: [0, 0, 0], from: 0.5, cut: 1, to: [0, 0, 0], thick: 1, thin: 1 }
  })
  const marks: Vec3[] = [stringEnds[1], ...lanterns.flatMap((l) => (l.arm ? [l.hang, l.arm] : [l.hang]))]
  const holds = marks.filter((m) => nearest(list, m[0], m[1], m[2], hit).d < BOUGH.onMm)
  for (let k = 0; k < list.length; k++) {
    const b = list[k]!
    if (b.kind !== 'limb' && b.kind !== 'twig') continue
    const first = b.points[0]!
    const last = b.points[b.points.length - 1]!
    nearest(list, first[0], first[1], first[2], hit, k)
    if (hit.k >= 0 && hit.d < 0.5) {
      const parent = list[hit.k]!
      shiftOf(parent, hit.s, first[1], move)
      b.foot = [move[0], move[1], move[2]]
      b.fade = parent.kind === 'stem' || parent.kind === 'root' ? BOUGH.footFade : 0
      if (parent.cut < 1 && hit.s > parent.cut) {
        b.cut = 0
        b.to = parent.to
      }
    }
    const chord: Vec3 = [last[0] - first[0], last[1] - first[1], last[2] - first[2]]
    const flat = Math.hypot(chord[0], chord[1])
    b.side = flat > 1e-6 ? [-chord[1] / flat, chord[0] / flat, 0] : [1, 0, 0]
    const deep: Vec3 = [chord[1] * b.side[2] - chord[2] * b.side[1], chord[2] * b.side[0] - chord[0] * b.side[2], chord[0] * b.side[1] - chord[1] * b.side[0]]
    const deepLen = Math.hypot(deep[0], deep[1], deep[2]) || 1
    b.deep = [deep[0] / deepLen, deep[1] / deepLen, deep[2] / deepLen]
    b.wind = Math.min(BOUGH.windMm, BOUGH.windPerMm * b.length) * (0.75 + 0.5 * unit(hash2(k, 11)))
    b.depth = BOUGH.depth
    b.cycles = BOUGH.cycles[0] + (BOUGH.cycles[1] - BOUGH.cycles[0]) * unit(hash2(k, 23))
    b.phase = unit(hash2(k, 37))
    b.thick = b.kind === 'limb' ? BOUGH.thick : 1
    b.thin = b.kind === 'limb' ? BOUGH.thin : BOUGH.twigThin
    // A limb that carries a lantern does not move where it hangs: its winding passes through nought there, and its tip turns only after it.
    const on: number[] = []
    for (const m of holds) {
      hit.d = Infinity
      nearOn(b, k, m[0], m[1], m[2], hit)
      if (hit.d < BOUGH.onMm) on.push(hit.s)
    }
    const lastOn = on.length > 0 ? Math.max(...on) : 0
    if (on.length === 1) b.phase = -b.cycles * on[0]!
    if (on.length > 1) {
      const span = Math.max(1e-3, lastOn - Math.min(...on))
      b.cycles = Math.max(1, Math.round(2 * b.cycles * span)) / (2 * span)
      b.phase = -b.cycles * lastOn
    }
    if (on.length > 0) b.depth = 0
    b.from = Math.max(b.kind === 'limb' ? BOUGH.turnFrom : BOUGH.twigTurnFrom, on.length > 0 ? lastOn + BOUGH.past : 0)
    if (b.cut > 0) {
      shiftOf(b, 1, last[1], move)
      const tip: Vec3 = [last[0] + move[0] - offset[0], last[1] + move[1] - offset[1], last[2] + move[2] - offset[2]]
      if (leafField(tip[0], tip[1], tip[2]) > -BOUGH.insideMm) {
        let found: Vec3 | null = null
        for (let r = BOUGH.stepMm; r <= BOUGH.reachMm + 1e-6 && !found; r += BOUGH.stepMm) {
          let least = -BOUGH.insideMm
          for (const d of DIRS) {
            const f = leafField(tip[0] + d[0] * r, tip[1] + d[1] * r, tip[2] + d[2] * r)
            if (f >= least) continue
            least = f
            found = [d[0] * r, d[1] * r, d[2] * r]
          }
        }
        if (found) b.end = found
        else b.cut = on.length > 0 ? Math.min(1, lastOn + BOUGH.past) : 0
      }
      // A twig that would stand bare over more than `bareMm` on its way into the leaf is drawn back as well: it read as a spoke.
      if (b.cut >= 1 && b.kind === 'twig' && on.length === 0) {
        let bare = 0
        for (let j = 0; j < BOUGH.bareSteps; j++) {
          const at = pointAt(b, (j + 0.5) / BOUGH.bareSteps)
          shiftOf(b, (j + 0.5) / BOUGH.bareSteps, at[1], move)
          if (leafField(at[0] + move[0] - offset[0], at[1] + move[1] - offset[1], at[2] + move[2] - offset[2]) > 0) bare += b.length / BOUGH.bareSteps
        }
        if (bare > BOUGH.bareMm) b.cut = 0
      }
      if (b.cut < 1) {
        const at = pointAt(b, b.cut)
        shiftOf(b, b.cut, at[1], move)
        b.to = [at[0] + move[0], at[1] + move[1], at[2] + move[2]]
      }
    }
    yield
  }
  wound = { list, holds }
  return wound
}

// Where a point of the wood goes: with the limb it lies on, thinner toward the tip, and not at all where something hangs.
export function wind(w: Winding, x: number, y: number, z: number, hit: Hit, out: Xyz): Xyz {
  nearest(w.list, x, y, z, hit)
  out[0] = x
  out[1] = y
  out[2] = z
  if (hit.k < 0) return out
  let b = w.list[hit.k]!
  if (b.cut < 1 && hit.s >= b.cut) {
    // What lies on a limb that is drawn back goes into the wood with it. The skin of the limb it grew from, about its foot, stays with that limb.
    const gone = b
    nearest(w.list, x, y, z, hit, w.list.length, true)
    if (hit.k < 0 || hit.d > BOUGH.skinMm) {
      out[0] = gone.to[0]
      out[1] = gone.to[1]
      out[2] = gone.to[2]
      return out
    }
    b = w.list[hit.k]!
  }
  let free = 1
  for (const m of w.holds) free *= ease(BOUGH.holdMm, BOUGH.freeMm, Math.hypot(x - m[0], y - m[1], z - m[2]))
  const ax = hit.at[0]
  const ay = hit.at[1]
  const az = hit.at[2]
  const girth = 1 + (b.thick + (b.thin - b.thick) * hit.s - 1) * free
  shiftOf(b, hit.s, y, out)
  out[0] = ax + (x - ax) * girth + out[0] * free
  out[1] = ay + (y - ay) * girth + out[1] * free
  out[2] = az + (z - az) * girth + out[2] * free
  return out
}
