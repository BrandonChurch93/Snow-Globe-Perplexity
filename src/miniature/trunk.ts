import * as THREE from 'three'
import { stageMaterial, type Rgb } from '../core/materials'
import { geometry, prepareModel } from '../core/models'
import { stream } from '../core/rng'
import { texture } from '../core/textures'
import { groundAt } from '../scene/layout'
import type { Vec3 } from '../seasons/kit'

export interface Pad {
  at: Vec3
  size: Vec3
  dir: Vec3
}

export interface Limb {
  kind: 'stem' | 'root' | 'limb' | 'twig'
  pad: number
  local: Vec3[]
  points: Vec3[]
  radii: number[]
}

export interface GlowLight {
  at: Vec3
  color: Rgb
  power: number
  reachMm: number
  phase: number
}

type Table = readonly (readonly [number, number])[]

const TAU = Math.PI * 2
const FOOT_X = 12.5
const FOOT_Z = -5
const FOOT_Y = -19.6
const FLARE_H = 4
const FORK_H = 13.6
const TOP_H = 37.6
const DEEP_H = -4.5
const MIN_SHAFT = 5
const TWIST_LOW = 0.1
const TWIST_HIGH = 0.055
const BARK_MM = 6.5
const BARK_AROUND = 3
const MODEL = 'shared/trunk-wood.glb'
const BARK = 'shared/trunk-bark.srgb.tile.png'
const BARK_NORMAL = 'shared/trunk-bark-n.lin.tile.png'

const RADIUS: Table = [[-4.5, 4.9], [0, 4.55], [1.5, 4.2], [4, 3.72], [8.4, 3.38], [11.6, 2.86], [13.6, 2.82], [18, 2.25], [26.2, 1.8], [33, 1.15], [37.6, 0.5]]
const AXIS_X: Table = [[-4.5, -0.3], [0, -0.2], [8.4, 0.4], [11.6, 0.8], [13.6, 0.7], [26.2, 0.35], [37.6, 0.2]]
const AXIS_Z: Table = [[-4.5, 0], [0, 0], [8, 0.35], [14, -0.1], [26, -0.4], [37.6, 0]]

const ROOTS: readonly { angle: number; reach: number; width: number }[] = [
  { angle: 3.07, reach: 6.9, width: 0.3 },
  { angle: 2.23, reach: 6.3, width: 0.26 },
  { angle: 1.43, reach: 5.7, width: 0.24 },
  { angle: 0.24, reach: 6.4, width: 0.3 },
  { angle: 5.67, reach: 6.0, width: 0.28 },
  { angle: 4.85, reach: 5.6, width: 0.25 },
  { angle: 3.98, reach: 6.1, width: 0.28 },
]

const PADS: readonly { at: Vec3; size: Vec3; lean: number; tip: number; from: number }[] = [
  { at: [0.7, 38.9, 0], size: [7.2, 2.95, 5.6], lean: 0.05, tip: 0, from: TOP_H },
  { at: [-7.1, 35.2, -3], size: [6.7, 3.5, 5.2], lean: -0.17, tip: -0.08, from: 27 },
  { at: [7.4, 32.1, 2], size: [8.7, 3.9, 5.6], lean: 0.58, tip: 0.1, from: 22 },
  { at: [-9.2, 26.9, 4], size: [7.9, 3.6, 5.8], lean: -0.14, tip: 0.1, from: 16.5 },
  { at: [-13, 19.6, 1], size: [4.3, 3.4, 4.2], lean: -0.21, tip: 0.08, from: 12.2 },
  { at: [9.5, 20.2, 5], size: [8.5, 4.1, 5.6], lean: 0.44, tip: 0.12, from: 12.8 },
  { at: [3.5, 33.5, -8.5], size: [6, 3.2, 4.5], lean: 0.1, tip: -0.25, from: 24.5 },
  { at: [-7.5, 27.5, -6.5], size: [5.5, 3, 4.2], lean: -0.1, tip: -0.25, from: 18.5 },
]

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const wrap = (a: number): number => a - TAU * Math.round(a / TAU)

function curve(t: Table, x: number): number {
  const n = t.length
  if (x <= t[0]![0]) return t[0]![1]
  if (x >= t[n - 1]![0]) return t[n - 1]![1]
  let i = 0
  while (x > t[i + 1]![0]) i++
  const a = t[i]!
  const b = t[i + 1]!
  const p = t[Math.max(0, i - 1)]!
  const q = t[Math.min(n - 1, i + 2)]!
  const w = b[0] - a[0]
  const ma = ((b[1] - p[1]) / (b[0] - p[0])) * w
  const mb = ((q[1] - a[1]) / (q[0] - a[0])) * w
  const s = (x - a[0]) / w
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * a[1] + (s3 - 2 * s2 + s) * ma + (-2 * s3 + 3 * s2) * b[1] + (s3 - s2) * mb
}

export const trunkTwist = (h: number): number => TWIST_LOW * Math.min(Math.max(h, DEEP_H), FORK_H) + TWIST_HIGH * Math.max(0, h - FORK_H)
export const trunkAxis = (h: number): [number, number] => [curve(AXIS_X, h), curve(AXIS_Z, h)]
export const trunkGirth = (h: number): number => curve(RADIUS, h)

export function trunkRidge(phi: number, h: number): number {
  const a = phi + trunkTwist(h)
  const wander = 0.5 * Math.sin(2 * a + 0.31 * h + 1.7) + 0.35 * Math.sin(3 * a - 0.23 * h + 0.4)
  const r1 = Math.pow(Math.abs(Math.sin(5.5 * a + wander)), 0.6)
  const r2 = Math.pow(Math.abs(Math.sin(11.5 * a + 1.3 * wander + 0.9)), 0.6)
  return 0.68 * r1 + 0.32 * r2
}

export function trunkRadius(phi: number, h: number): number {
  const R = trunkGirth(h)
  let r = R * (1 + 0.125 * (trunkRidge(phi, h) - 0.66))
  if (h < 6) {
    const a = phi + trunkTwist(h)
    const g = h <= 0 ? 1 - 0.1 * h : Math.pow(1 - h / 6, 2.4)
    let sum = 0
    for (const root of ROOTS) {
      const d = wrap(a - root.angle)
      const l = (root.reach - RADIUS[1]![1]) * Math.exp(-(d * d) / (root.width * root.width))
      sum += l * l
    }
    r += Math.sqrt(sum) * g * (0.86 + 0.14 * trunkRidge(phi, h))
  }
  return r
}

const footGround = (): number => groundAt(FOOT_X, FOOT_Z)

function place(x: number, h: number, z: number): [number, number, number] {
  const g0 = footGround()
  const near = clamp01(1 - (h - 1) / (FLARE_H - 1))
  const g = g0 + (groundAt(FOOT_X + x, FOOT_Z + z) - g0) * near
  const raise = Math.max(0, g0 + FLARE_H + MIN_SHAFT - (FOOT_Y + FORK_H))
  let y: number
  if (h <= FLARE_H) y = g + h
  else if (h >= FORK_H) y = FOOT_Y + h + raise
  else y = lerp(g + FLARE_H, FOOT_Y + FORK_H + raise, (h - FLARE_H) / (FORK_H - FLARE_H))
  return [FOOT_X + x, y, FOOT_Z + z]
}

const norm = (v: readonly number[]): [number, number, number] => {
  const l = Math.hypot(v[0]!, v[1]!, v[2]!) || 1
  return [v[0]! / l, v[1]! / l, v[2]! / l]
}

function padFrame(lean: number, tip: number): { up: Vec3; side: Vec3; depth: Vec3 } {
  const up = norm([Math.sin(lean), Math.cos(lean), tip])
  const side = norm([up[1], -up[0], 0])
  const depth: Vec3 = [side[1] * up[2] - side[2] * up[1], side[2] * up[0] - side[0] * up[2], side[0] * up[1] - side[1] * up[0]]
  return { up, side, depth }
}

function bezier(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): [number, number, number] {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1], a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]]
}

function grow(): Limb[] {
  const rng = stream('trunk')
  const out: Limb[] = []
  const chain = (kind: Limb['kind'], pad: number, local: Vec3[], radii: number[]): void => {
    out.push({ kind, pad, local, radii, points: local.map((p) => place(p[0], p[1], p[2])) })
  }

  const stem: Vec3[] = []
  const stemR: number[] = []
  for (let h = DEEP_H; h <= TOP_H + 1e-6; h += 0.7) {
    const [x, z] = trunkAxis(h)
    stem.push([x, h, z])
    stemR.push(trunkGirth(h))
  }
  chain('stem', 0, stem, stemR)

  for (const root of ROOTS) {
    const pts: Vec3[] = []
    const rad: number[] = []
    const drift = rng.range(-0.22, 0.22)
    const extra = rng.range(1.4, 2.6)
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const h = lerp(2.6, -1.3, Math.pow(t, 0.75))
      const phi = root.angle - trunkTwist(h) + drift * t * t
      const [ax, az] = trunkAxis(h)
      const d = lerp(trunkGirth(2.6) * 0.72, root.reach + extra, Math.pow(t, 1.25))
      pts.push([ax + Math.cos(phi) * d, h, az + Math.sin(phi) * d])
      rad.push(lerp(1.15, 0.24, Math.pow(t, 0.8)))
    }
    chain('root', 0, pts, rad)
  }

  const twigs = (pad: number, at: (t: number) => Vec3, radius: (t: number) => number, forks: readonly number[]): void => {
    const P = PADS[pad]!
    const f = padFrame(P.lean, P.tip)
    for (const t0 of forks) {
      const from = at(t0)
      const a = rng.range(0, TAU)
      const k = rng.range(0.42, 0.7)
      const drop = rng.range(0.1, 0.4)
      const to: Vec3 = [
        P.at[0] + f.side[0] * Math.cos(a) * k * P.size[0] + f.depth[0] * Math.sin(a) * k * P.size[2] - f.up[0] * drop * P.size[1],
        P.at[1] + f.side[1] * Math.cos(a) * k * P.size[0] + f.depth[1] * Math.sin(a) * k * P.size[2] - f.up[1] * drop * P.size[1],
        P.at[2] + f.side[2] * Math.cos(a) * k * P.size[0] + f.depth[2] * Math.sin(a) * k * P.size[2] - f.up[2] * drop * P.size[1],
      ]
      const mid: Vec3 = [lerp(from[0], to[0], 0.5), lerp(from[1], to[1], 0.5) + rng.range(-0.3, 0.9), lerp(from[2], to[2], 0.5)]
      const pts: Vec3[] = []
      const rad: number[] = []
      const r0 = radius(t0) * 0.62
      for (let i = 0; i <= 8; i++) {
        const t = i / 8
        const u = 1 - t
        pts.push([u * u * from[0] + 2 * u * t * mid[0] + t * t * to[0], u * u * from[1] + 2 * u * t * mid[1] + t * t * to[1], u * u * from[2] + 2 * u * t * mid[2] + t * t * to[2]])
        rad.push(lerp(r0, 0.17, Math.pow(t, 0.7)))
      }
      chain('twig', pad, pts, rad)
    }
  }

  for (let i = 1; i < PADS.length; i++) {
    const P = PADS[i]!
    const f = padFrame(P.lean, P.tip)
    const h0 = P.from - 1.6
    const [ax, az] = trunkAxis(h0)
    const p0: Vec3 = [ax, h0, az]
    const end: Vec3 = [P.at[0] - f.up[0] * 0.35 * P.size[1], P.at[1] - f.up[1] * 0.35 * P.size[1], P.at[2] - f.up[2] * 0.35 * P.size[1]]
    const flat = norm([end[0] - p0[0], 0, end[2] - p0[2]])
    const L = Math.hypot(end[0] - p0[0], end[1] - p0[1], end[2] - p0[2])
    const t0 = norm([flat[0] * 0.6, 0.8, flat[2] * 0.6])
    const t3 = norm([flat[0] * 0.82, 0.48, flat[2] * 0.82])
    const p1: Vec3 = [p0[0] + t0[0] * 0.42 * L, p0[1] + t0[1] * 0.42 * L, p0[2] + t0[2] * 0.42 * L]
    const p2: Vec3 = [end[0] - t3[0] * 0.3 * L, end[1] - t3[1] * 0.3 * L, end[2] - t3[2] * 0.3 * L]
    const w1 = rng.range(0, TAU)
    const w2 = rng.range(0, TAU)
    const amp = rng.range(0.25, 0.5)
    const r0 = trunkGirth(P.from) * 0.37
    const at = (t: number): Vec3 => {
      const b = bezier(p0, p1, p2, end, t)
      const e = Math.sin(Math.PI * t) * amp
      return [b[0] - flat[2] * e * Math.sin(5.1 * t + w1), b[1] + e * 0.8 * Math.sin(6.3 * t + w2), b[2] + flat[0] * e * Math.sin(5.1 * t + w1)]
    }
    const radius = (t: number): number => lerp(r0, 0.34, Math.pow(t, 0.75))
    const steps = Math.max(12, Math.round(L / 0.6))
    const pts: Vec3[] = []
    const rad: number[] = []
    for (let s = 0; s <= steps; s++) {
      pts.push(at(s / steps))
      rad.push(radius(s / steps))
    }
    chain('limb', i, pts, rad)
    twigs(i, at, radius, [0.5, 0.63, 0.76, 0.88])
  }

  const up = (t: number): Vec3 => {
    const h = lerp(30, TOP_H, t)
    const [x, z] = trunkAxis(h)
    return [x, h, z]
  }
  twigs(0, up, (t) => trunkGirth(lerp(30, TOP_H, t)) * 0.55, [0.1, 0.3, 0.5, 0.7, 0.85])
  return out
}

export const limbs: readonly Limb[] = grow()

export const foot: Vec3 = [FOOT_X, footGround(), FOOT_Z]

export const localPads: readonly Pad[] = PADS.map((p) => ({ at: p.at, size: p.size, dir: padFrame(p.lean, p.tip).up }))

export const pads: readonly Pad[] = localPads.map((p) => ({ ...p, at: place(p.at[0], p.at[1], p.at[2]) }))

export const placePoint = (p: Vec3): Vec3 => place(p[0], p[1], p[2])

export interface Cluster {
  pad: number
  local: Vec3
  radius: number
}

const DOME = 0.72
const BODY = { blend: 0.5, bias: 0.4 }
const CAP = { lift: 1.1, puff: 0.3, blend: 0.9, bias: 1.3, depth: 0.55, lip: 0.35 }

function gather(): Cluster[] {
  const rng = stream('crown')
  const out: Cluster[] = []
  PADS.forEach((P, pad) => {
    const f = padFrame(P.lean, P.tip)
    const [a, b, c] = P.size
    const n = Math.round(a * c * 0.95)
    const put = (s: number, v: number, d: number, radius: number): void => {
      out.push({ pad, radius, local: [P.at[0] + f.side[0] * s + f.up[0] * v + f.depth[0] * d, P.at[1] + f.side[1] * s + f.up[1] * v + f.depth[1] * d, P.at[2] + f.side[2] * s + f.up[2] * v + f.depth[2] * d] })
    }
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n)
      const th = k * 2.39996 + rng.range(-0.3, 0.3)
      const r = lerp(1.95, 1.2, rr) * rng.range(0.84, 1.18)
      const top = b * (1 - DOME * rr * rr) - CAP.lift - CAP.puff
      put(Math.cos(th) * rr * (a - r), top - r + rng.range(-0.45, 0.2), Math.sin(th) * rr * (c - r), r)
    }
    const under = Math.round(n * 0.3)
    for (let k = 0; k < under; k++) {
      const rr = 0.66 * Math.sqrt((k + 0.5) / under)
      const th = k * 2.39996 + 1.3 + rng.range(-0.4, 0.4)
      const r = rng.range(1.0, 1.45)
      put(Math.cos(th) * rr * a, -b + r + rng.range(0, 0.7), Math.sin(th) * rr * c, r)
    }
  })
  return out
}

export const clusters: readonly Cluster[] = gather()

interface PadField {
  centre: Vec3
  reach: number
  balls: Float64Array
  frame: { up: Vec3; side: Vec3; depth: Vec3 }
  size: Vec3
  n: number
}

const padFields: PadField[] = PADS.map((P, pad) => {
  const mine = clusters.filter((c) => c.pad === pad)
  const balls = new Float64Array(mine.length * 4)
  let reach = 0
  mine.forEach((c, i) => {
    balls.set([c.local[0], c.local[1], c.local[2], c.radius], i * 4)
    reach = Math.max(reach, Math.hypot(c.local[0] - P.at[0], c.local[1] - P.at[1], c.local[2] - P.at[2]) + c.radius)
  })
  return { centre: P.at, reach, balls, frame: padFrame(P.lean, P.tip), size: P.size, n: pad }
})

function ballField(f: PadField, x: number, h: number, z: number, blend: number): number {
  const b = f.balls
  let sum = 0
  let near = Infinity
  for (let o = 0; o < b.length; o += 4) {
    const d = Math.hypot(x - b[o]!, h - b[o + 1]!, z - b[o + 2]!) - b[o + 3]!
    if (d < near) near = d
  }
  for (let o = 0; o < b.length; o += 4) {
    const d = Math.hypot(x - b[o]!, h - b[o + 1]!, z - b[o + 2]!) - b[o + 3]!
    sum += Math.exp(-(d - near) / blend)
  }
  return near - blend * Math.log(sum)
}

const FAR = 2.5

export function crownField(x: number, h: number, z: number): number {
  let best = Infinity
  for (const f of padFields) {
    const far = Math.hypot(x - f.centre[0], h - f.centre[1], z - f.centre[2]) - f.reach
    if (far > FAR) {
      if (far < best) best = far
      continue
    }
    const d = ballField(f, x, h, z, BODY.blend) + BODY.bias
    if (d < best) best = d
  }
  return best
}

export function crownCap(x: number, h: number, z: number): number {
  let best = Infinity
  for (const f of padFields) {
    const far = Math.hypot(x - f.centre[0], h - f.centre[1], z - f.centre[2]) - f.reach - CAP.lift - CAP.puff
    if (far > FAR) {
      if (far < best) best = far
      continue
    }
    const u = f.frame.up
    const px = x - f.centre[0]
    const ph = h - f.centre[1]
    const pz = z - f.centre[2]
    const s = px * f.frame.side[0] + ph * f.frame.side[1] + pz * f.frame.side[2]
    const v = px * u[0] + ph * u[1] + pz * u[2]
    const d = px * f.frame.depth[0] + ph * f.frame.depth[1] + pz * f.frame.depth[2]
    const body = ballField(f, x - u[0] * CAP.lift, h - u[1] * CAP.lift, z - u[2] * CAP.lift, CAP.blend) + CAP.bias - CAP.puff
    const rim = (s * s) / (f.size[0] * f.size[0]) + (d * d) / (f.size[2] * f.size[2])
    const lobes = 0.6 * Math.sin(0.93 * s + 1.7 * f.n) * Math.sin(0.81 * d + 2.3 * f.n) + 0.38 * Math.sin(1.73 * s - 1.12 * d + f.n) + 0.2 * Math.sin(3.1 * s + 2.7 * d + 0.6 * f.n)
    const line = f.size[1] * (1 - DOME * rim) - CAP.lift - CAP.puff - CAP.depth + lobes
    const cut = line - v
    const k = CAP.lip
    const t = clamp01(0.5 + (0.5 * (body - cut)) / k)
    const both = lerp(cut, body, t) + k * t * (1 - t)
    if (both < best) best = both
  }
  return best
}

export const crownOffset = (): Vec3 => {
  const p = place(0, TOP_H, 0)
  return [p[0], p[1] - TOP_H, p[2]]
}

export const padAxes = (pad: Pad): { up: Vec3; side: Vec3; depth: Vec3 } => {
  const up = pad.dir
  const side = norm([up[1], -up[0], 0])
  return { up, side, depth: [side[1] * up[2] - side[2] * up[1], side[2] * up[0] - side[0] * up[2], side[0] * up[1] - side[1] * up[0]] }
}

export const trunkShape = { deep: DEEP_H, flare: FLARE_H, fork: FORK_H, top: TOP_H, barkMm: BARK_MM, barkAround: BARK_AROUND, footX: FOOT_X, footZ: FOOT_Z }

interface Chain {
  box: Float64Array
  segs: Float64Array
}

export function chainSolid(chains: readonly { points: readonly Vec3[]; radii: readonly number[] }[], stride = 1): (x: number, y: number, z: number) => number {
  const built: Chain[] = []
  for (const c of chains) {
    const idx: number[] = []
    for (let i = 0; i < c.points.length; i += stride) idx.push(i)
    if (idx[idx.length - 1] !== c.points.length - 1) idx.push(c.points.length - 1)
    const segs = new Float64Array((idx.length - 1) * 9)
    const box = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity])
    for (let k = 0; k < idx.length - 1; k++) {
      const a = c.points[idx[k]!]!
      const b = c.points[idx[k + 1]!]!
      const ra = c.radii[idx[k]!]!
      const rb = c.radii[idx[k + 1]!]!
      const bx = b[0] - a[0]
      const by = b[1] - a[1]
      const bz = b[2] - a[2]
      segs.set([a[0], a[1], a[2], bx, by, bz, 1 / Math.max(bx * bx + by * by + bz * bz, 1e-9), ra, rb], k * 9)
      const r = Math.max(ra, rb)
      for (let j = 0; j < 3; j++) {
        box[j] = Math.min(box[j]!, a[j]! - r, b[j]! - r)
        box[j + 3] = Math.max(box[j + 3]!, a[j]! + r, b[j]! + r)
      }
    }
    built.push({ box, segs })
  }
  return (x, y, z) => {
    let best = Infinity
    for (const c of built) {
      const b = c.box
      const dx = Math.max(b[0]! - x, 0, x - b[3]!)
      const dy = Math.max(b[1]! - y, 0, y - b[4]!)
      const dz = Math.max(b[2]! - z, 0, z - b[5]!)
      const far = dx * dx + dy * dy + dz * dz
      if (far > 0 && (best <= 0 || far >= best * best)) continue
      const s = c.segs
      for (let o = 0; o < s.length; o += 9) {
        const px = x - s[o]!
        const py = y - s[o + 1]!
        const pz = z - s[o + 2]!
        const t = clamp01((px * s[o + 3]! + py * s[o + 4]! + pz * s[o + 5]!) * s[o + 6]!)
        const qx = px - s[o + 3]! * t
        const qy = py - s[o + 4]! * t
        const qz = pz - s[o + 5]! * t
        const d = Math.sqrt(qx * qx + qy * qy + qz * qz) - (s[o + 7]! + (s[o + 8]! - s[o + 7]!) * t)
        if (d < best) best = d
      }
    }
    return best
  }
}

const placedSolid = chainSolid(limbs.map((l) => ({ points: l.points, radii: l.radii })), 2)

export const trunkSolid = (x: number, y: number, z: number): number => placedSolid(x, y, z)

export const glow = { uTwinkle: { value: new THREE.Vector4(0, 0, 1, 0) } }

export function bakeGlow(g: THREE.BufferGeometry, lights: readonly GlowLight[], wrapLight = 0.35): void {
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const n = pos.count
  const out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const nx = nor.getX(i)
    const ny = nor.getY(i)
    const nz = nor.getZ(i)
    let r = 0
    let gr = 0
    let b = 0
    let top = 0
    let phase = 0
    for (const l of lights) {
      const dx = l.at[0] - x
      const dy = l.at[1] - y
      const dz = l.at[2] - z
      const d2 = dx * dx + dy * dy + dz * dz
      const reach2 = l.reachMm * l.reachMm
      if (d2 > 36 * reach2) continue
      const d = Math.sqrt(d2) || 1e-6
      const facing = Math.max(0, (dx * nx + dy * ny + dz * nz) / d)
      const w = (l.power * (wrapLight + (1 - wrapLight) * facing)) / (1 + d2 / reach2) ** 1.5
      r += l.color[0] * w
      gr += l.color[1] * w
      b += l.color[2] * w
      if (w > top) {
        top = w
        phase = l.phase
      }
    }
    out.set([r, gr, b, phase], i * 4)
  }
  g.setAttribute('aGlow', new THREE.BufferAttribute(out, 4))
}

export function glowHook(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uTwinkle = glow.uTwinkle
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aGlow;\nvarying vec4 vGlow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec4 uTwinkle;\nvarying vec4 vGlow;')
    .replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += vGlow.rgb * uTwinkle.z * (1.0 + uTwinkle.y * sin(6.2831853 * (uTwinkle.x + vGlow.a))) * material.diffuseContribution;',
    )
}

export function prepareTrunk(): Promise<void> {
  return prepareModel(MODEL)
}

export function placeGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = source.clone()
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const e = 0.05
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const h = pos.getY(i)
    const z = pos.getZ(i)
    const p = place(x, h, z)
    const fx = (place(x + e, h, z)[1] - p[1]) / e
    const fh = Math.max((place(x, h + e, z)[1] - p[1]) / e, 0.05)
    const fz = (place(x, h, z + e)[1] - p[1]) / e
    const ny = nor.getY(i) / fh
    const n = norm([nor.getX(i) - fx * ny, ny, nor.getZ(i) - fz * ny])
    pos.setXYZ(i, p[0], p[1], p[2])
    nor.setXYZ(i, n[0], n[1], n[2])
  }
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

export function buildTrunk(part: string, lights: readonly GlowLight[] = []): THREE.Mesh {
  const g = placeGeometry(geometry(MODEL, 'trunk'))
  bakeGlow(g, lights)
  const normal = texture(BARK_NORMAL)
  const m = stageMaterial({
    part,
    standIn: false,
    inside: true,
    miniature: true,
    change: 'miniature',
    map: texture(BARK),
    vertexColors: true,
    roughness: 0.86,
    extra: { normalMap: normal, normalScale: new THREE.Vector2(1.6, 1.6) },
    hook: glowHook,
    key: 'trunk',
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
