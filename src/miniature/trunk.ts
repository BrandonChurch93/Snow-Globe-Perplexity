import * as THREE from 'three'
import { stageMaterial, type Rgb } from '../core/materials'
import { geometry, prepareModel } from '../core/models'
import { stream } from '../core/rng'
import { texture } from '../core/textures'
import { groundAt, tree } from '../scene/layout'
import { ROW, whole } from '../scene/steps'
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
  wrap?: number
}

type Table = readonly (readonly [number, number])[]

const TAU = Math.PI * 2
const FOOT_X = tree.x
const FOOT_Z = tree.z
const FOOT_Y = -19.6
const FLARE_H = 4
const FORK_H = 13.6
const TOP_H = 37.6
const DEEP_H = -4.5
const MIN_SHAFT = 5
const ROOT_RISE = 7
const ROOT_FALL = 1.6
const ROOT_SKIRT = 1.8
const TWIST_LOW = 0.1
const TWIST_HIGH = 0.03
const RIDGE_DEEP = 0.16
const GNARL = 0.06
const PLATE = { perMm: 0.85, width: 0.03, deep: 0.08 }
const KNOTS: readonly { phi: number; h: number; r: number }[] = [
  { phi: 1.95, h: 8.4, r: 1.15 },
  { phi: 1.05, h: 5.3, r: 0.85 },
  { phi: 2.6, h: 11.4, r: 0.8 },
  { phi: 0.55, h: 10.6, r: 0.7 },
  { phi: 4.4, h: 7, r: 1 },
]
const BARK_MM = 6.5
const BARK_AROUND = 3
const BARK_RELIEF = 0.95
const MODEL = 'shared/trunk-wood.glb'
const BARK = 'shared/trunk-bark.srgb.tile.w1024.png'
const BARK_NORMAL = 'shared/trunk-bark-n.lin.tile.w1024.png'

const RADIUS: Table = [[-4.5, 5.1], [0, 4.6], [1.2, 4.2], [3.2, 3.9], [5.2, 3.7], [8, 3.4], [10, 3.1], [11.6, 2.85], [13.6, 2.5], [15.5, 2.0], [18, 1.6], [19.6, 1.38], [21, 1.15], [24, 0.95], [27.5, 0.88], [30, 0.78], [33, 0.6], [37.6, 0.4]]
const AXIS_X: Table = [[-4.5, -0.5], [0, -0.4], [5, 0.05], [10, 0.75], [13.6, 0.7], [16.5, 0.45], [19, 0.1], [22, -0.75], [25, -1.3], [27.5, -1.7], [30, -1.6], [33, -0.8], [35.5, 0.2], [37.6, 0.7]]
const AXIS_Z: Table = [[-4.5, 0], [0, 0], [8, 0.35], [14, -0.1], [26, -0.4], [37.6, 0]]

const ROOTS: readonly { angle: number; reach: number; width: number }[] = [
  { angle: 3.02, reach: 7.4, width: 0.4 },
  { angle: 2.2, reach: 6.4, width: 0.35 },
  { angle: 1.43, reach: 6.3, width: 0.36 },
  { angle: 0.52, reach: 6.6, width: 0.33 },
  { angle: 6.2, reach: 7.0, width: 0.35 },
  { angle: 5.5, reach: 6.2, width: 0.33 },
  { angle: 4.75, reach: 5.8, width: 0.31 },
  { angle: 3.9, reach: 6.3, width: 0.36 },
]

const PADS: readonly { at: Vec3; size: Vec3; lean: number; tip: number }[] = [
  { at: [0.6, 39.3, 0], size: [6.6, 2.4, 4.4], lean: 0.03, tip: 0.12 },
  { at: [-6.6, 35.6, 2.6], size: [6.8, 2.5, 4.8], lean: -0.16, tip: 0.15 },
  { at: [3.9, 35.1, 3.3], size: [5.8, 2.5, 4.4], lean: 0.12, tip: 0.2 },
  { at: [-8, 34.9, 0.4], size: [5.8, 2.1, 4.2], lean: -0.12, tip: 0.12 },
  { at: [7.8, 33.8, 3.6], size: [5.2, 2.8, 4.4], lean: 0.32, tip: 0.15 },
  { at: [11.6, 30.8, 1.2], size: [3.9, 2.9, 3.8], lean: 0.42, tip: 0.15 },
  { at: [2.6, 34.4, -0.4], size: [6, 1.6, 4.2], lean: 0.12, tip: 0 },
  { at: [-9.3, 27.6, 3.2], size: [8.3, 2.7, 5.2], lean: -0.14, tip: 0.18 },
  { at: [-13.6, 20.2, -0.6], size: [3.9, 2.4, 3.8], lean: -0.21, tip: 0.12 },
  { at: [9, 20.8, 3.6], size: [8, 3.9, 5.4], lean: 0.3, tip: 0.2 },
]

interface Bough {
  kind: 'limb' | 'twig'
  pad: number
  r: readonly [number, number]
  via: readonly Vec3[]
  forks: readonly number[]
}

const BOUGHS: readonly Bough[] = [
  { kind: 'limb', pad: 8, r: [1.3, 0.42], via: [[-0.3, 12.2, 0.5], [-2.2, 14.9, 0.8], [-4.6, 17.3, 0.7], [-7.2, 18.2, 0.2], [-9.4, 18, -0.3], [-11.5, 17.7, -0.6], [-13.4, 18, -0.8]], forks: [0.72, 0.86, 0.95] },
  { kind: 'limb', pad: 8, r: [0.95, 0.36], via: [[-0.4, 15, -0.7], [-2.5, 17.9, -1.3], [-4.5, 19.6, -1.7], [-7, 20, -1.7], [-9.6, 19.5, -1.4], [-12, 19.8, -1], [-14.4, 20.4, -0.6]], forks: [0.7, 0.84, 0.95] },
  { kind: 'limb', pad: 7, r: [1.1, 0.4], via: [[-0.3, 16.6, 0.9], [-2.1, 19.4, 1.8], [-3.6, 22, 2.6], [-5.2, 24.4, 3.1], [-7.6, 25.3, 3.3], [-10.4, 25.1, 3.2], [-13.4, 25.2, 3]], forks: [0.6, 0.72, 0.84, 0.94] },
  { kind: 'limb', pad: 7, r: [0.72, 0.3], via: [[-0.5, 20.4, -0.6], [-2.6, 22.6, -0.3], [-4.8, 23.9, 0.5], [-7.4, 24.2, 1.3], [-9.8, 24.1, 1.9]], forks: [0.75, 0.92] },
  { kind: 'limb', pad: 3, r: [0.8, 0.36], via: [[-1.5, 25.8, -0.4], [-2.6, 28.6, -1.1], [-3.7, 30.4, -1.7], [-5.2, 31.4, -2.2], [-7.3, 31.8, -2.5], [-9.6, 32.4, -2.6]], forks: [0.55, 0.7, 0.84, 0.95] },
  { kind: 'limb', pad: 9, r: [1.3, 0.42], via: [[0.9, 10, 1], [3.1, 12.2, 1.8], [4.7, 13.8, 2.4], [6.1, 15.3, 3], [7.6, 16.6, 3.4], [9.3, 17.5, 3.6], [11.2, 17.9, 3.6]], forks: [0.62, 0.76, 0.88, 0.96] },
  { kind: 'limb', pad: 9, r: [0.7, 0.28], via: [[1, 14, -0.4], [2.9, 16, 0], [4.4, 17.4, 0.8], [6.2, 17.9, 1.6], [8.6, 17.7, 2.2]], forks: [0.8, 0.94] },
  { kind: 'limb', pad: 5, r: [1.05, 0.4], via: [[0.5, 16.4, 0.2], [1.6, 19, 0.5], [2.9, 21.5, 0.9], [4.2, 23.7, 1.2], [5.6, 25.5, 1.4], [7, 26.9, 1.5], [8.8, 28.3, 1.5], [10.4, 29.2, 1.5]], forks: [0.64, 0.76, 0.88, 0.96] },
  { kind: 'limb', pad: 2, r: [0.8, 0.36], via: [[-1.2, 24.8, 0.2], [0, 27.8, 0.5], [1.1, 30.4, 0.7], [2.2, 33, 0.6], [3.4, 35.6, 0.3]], forks: [0.7, 0.9] },
  { kind: 'twig', pad: 8, r: [0.34, 0.1], via: [[-9.2, 18, -0.3], [-10.6, 17.2, 0.1], [-11.8, 16.4, 0.3], [-12.7, 15.7, 0.4]], forks: [] },
  { kind: 'twig', pad: 9, r: [0.42, 0.14], via: [[4.5, 13.6, 2.3], [6.6, 14.6, 3.2], [9.4, 15.3, 3.9], [12.2, 15.7, 4.2], [14.6, 15.6, 4.2]], forks: [] },
  { kind: 'twig', pad: 9, r: [0.17, 0.06], via: [[10.4, 22.4, 3.5], [11.9, 24.2, 3.6], [13.3, 25.9, 3.6]], forks: [] },
  { kind: 'twig', pad: 5, r: [0.36, 0.12], via: [[4.2, 23.7, 1.2], [5.2, 24.9, 2.2], [6.6, 25.4, 3]], forks: [] },
]
const LIMB_TAPER = 0.6
const LIMB_SLIM: readonly [number, number] = [0.8, 0.82]
const LIMB_STEP = 0.42

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
  const r1 = 0.6 * Math.pow(Math.abs(Math.sin(5.5 * a + wander)), 0.8) + 0.4 * (0.5 - 0.5 * Math.cos(11 * a + 2 * wander))
  const r2 = Math.pow(Math.abs(Math.sin(13.5 * a + 1.6 * wander + 0.9 + 0.5 * Math.sin(0.7 * h))), 0.6)
  const band = PLATE.perMm * h + 1.9 * Math.sin(3 * a + 0.4 * h) + 1.1 * Math.sin(7 * a + 1.3) + 0.8 * Math.sin(17 * a + 0.9 * h)
  const sound = 1 - Math.exp(-(Math.sin(band) * Math.sin(band)) / PLATE.width)
  let ridge = (0.84 * r1 + 0.16 * r2) * (1 - PLATE.deep * (1 - sound))
  for (const k of KNOTS) {
    const rho = Math.hypot(wrap(phi - k.phi) * 3.3, (h - k.h) * 0.8) / k.r
    if (rho > 1.4) continue
    const rings = rho < 0.22 ? 0.05 : 0.5 + 0.5 * Math.cos(8.5 * rho + 0.6 * Math.sin(3 * phi + h))
    ridge = lerp(ridge, rings, 1 - clamp01((rho - 0.85) / 0.55))
  }
  return ridge
}

export function trunkRadius(phi: number, h: number): number {
  const R = trunkGirth(h)
  let r = R * (1 + RIDGE_DEEP * (trunkRidge(phi, h) - 0.6) + GNARL * (0.6 * Math.sin(2 * (phi + trunkTwist(h)) - 0.41 * h + 0.8) + 0.4 * Math.sin(3 * (phi + trunkTwist(h)) + 0.29 * h + 2.1)))
  if (h < ROOT_RISE) {
    const a = phi + trunkTwist(h)
    const g = h <= 0 ? 1 - 0.1 * h : Math.pow(1 - h / ROOT_RISE, ROOT_SKIRT)
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

function spline(via: readonly Vec3[], u: number): [number, number, number] {
  const n = via.length - 1
  const f = Math.min(n - 1e-9, Math.max(0, u * n))
  const i = Math.floor(f)
  const t = f - i
  const p0 = via[Math.max(0, i - 1)]!
  const p1 = via[i]!
  const p2 = via[i + 1]!
  const p3 = via[Math.min(n, i + 2)]!
  const t2 = t * t
  const t3 = t2 * t
  const out: [number, number, number] = [0, 0, 0]
  for (let k = 0; k < 3; k++) out[k] = 0.5 * (2 * p1[k]! + (p2[k]! - p0[k]!) * t + (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 + (3 * p1[k]! - p0[k]! - 3 * p2[k]! + p3[k]!) * t3)
  return out
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
    const extra = rng.range(0.2, 1.2)
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const h = 4 - 5 * Math.pow(t, ROOT_FALL)
      const phi = root.angle - trunkTwist(h) + drift * t * t
      const [ax, az] = trunkAxis(h)
      const d = lerp(trunkGirth(4) * 0.7, root.reach + extra, Math.pow(t, ROOT_FALL))
      pts.push([ax + Math.cos(phi) * d, h, az + Math.sin(phi) * d])
      rad.push(lerp(1.9, 0.4, Math.pow(t, 0.75)))
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

  for (const B of BOUGHS) {
    let length = 0
    let last = spline(B.via, 0)
    for (let s = 1; s <= 40; s++) {
      const q = spline(B.via, s / 40)
      length += Math.hypot(q[0] - last[0], q[1] - last[1], q[2] - last[2])
      last = q
    }
    const w1 = rng.range(0, TAU)
    const w2 = rng.range(0, TAU)
    const amp = B.kind === 'limb' ? rng.range(0.16, 0.34) : 0.05
    const at = (t: number): Vec3 => {
      const b = spline(B.via, t)
      const e = Math.sin(Math.PI * t) * amp
      return [b[0] + e * 0.5 * Math.sin(5.1 * t + w1), b[1] + e * 0.6 * Math.sin(6.3 * t + w2), b[2] + e * Math.cos(5.1 * t + w1)]
    }
    const slim = B.kind === 'limb' ? LIMB_SLIM : ([1, 1] as const)
    const radius = (t: number): number => lerp(B.r[0] * slim[0], B.r[1] * slim[1], Math.pow(t, LIMB_TAPER))
    const steps = Math.max(8, Math.round(length / LIMB_STEP))
    const pts: Vec3[] = []
    const rad: number[] = []
    for (let s = 0; s <= steps; s++) {
      pts.push(at(s / steps))
      rad.push(radius(s / steps))
    }
    chain(B.kind, B.pad, pts, rad)
    twigs(B.pad, at, radius, B.forks)
  }

  const up = (t: number): Vec3 => {
    const h = lerp(31.5, TOP_H, t)
    const [x, z] = trunkAxis(h)
    return [x, h, z]
  }
  const girth = (t: number): number => trunkGirth(lerp(31.5, TOP_H, t)) * 0.55
  twigs(6, up, girth, [0, 0.08])
  twigs(4, up, girth, [0.12, 0.3])
  twigs(1, up, girth, [0.35, 0.5, 0.62])
  twigs(0, up, girth, [0.7, 0.85, 0.95])
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

const DOME = 0.3
const BODY = { blend: 0.5, bias: 0.4 }
const TOP_DROP = 1.56
const CAP = { lift: 1.05, thick: 0.25, cover: 1.08, fore: 0.12, lee: 0.12, skew: 0.45, rim: 0.98, brow: 0.5, swell: 0.42, ripple: 0.16, lump: 0.08, flat: 2.4, gap: 2.2, gapFrom: 0.24, gapTo: 0.8, sink: 0.1, slope: 0.75, depth: -0.75, lip: 0.7, droop: 0.7, hem: 0.9 }
const LOADS: readonly (readonly [number, number, number, number, number])[] = [[1.3, 1, 0.2, 0, 0.3], [1.4, 1.02, 0, 0.8, 1], [1.5, 1.02, -0.2, -0.5, -1], [0.9, 1, 0, 0.8, 1], [1.3, 0.95, -0.8, -1, -1], [1.2, 1.05, -1.2, -1.2, -1], [0.35, 0.5, 0, 0, 1], [0.95, 1.02, 0.1, 1.2, 1], [1.2, 1, 0.3, 1.2, 1], [1, 1.02, -0.6, -0.6, -1]]
const wobble = (x: number, h: number, z: number): number => 0.16 * Math.sin(1.9 * x + 0.3 * h) * Math.sin(2.3 * h + 1.1 * z) * Math.sin(1.7 * z + 0.5 * x) + 0.07 * Math.sin(4.3 * x + 1) * Math.sin(3.9 * h + 2) * Math.sin(4.7 * z)
const dome = (rim: number): number => 1 - DOME * Math.pow(rim, 1.5)

function gather(): Cluster[] {
  const rng = stream('crown')
  const out: Cluster[] = []
  PADS.forEach((P, pad) => {
    const f = padFrame(P.lean, P.tip)
    const [a, b, c] = P.size
    const thin = Math.min(1, Math.max(0.62, b / 3.3))
    const drop = TOP_DROP * thin
    const n = Math.round((a * c * 1.25) / (thin * thin))
    const put = (s: number, v: number, d: number, radius: number): void => {
      out.push({ pad, radius, local: [P.at[0] + f.side[0] * s + f.up[0] * v + f.depth[0] * d, P.at[1] + f.side[1] * s + f.up[1] * v + f.depth[1] * d, P.at[2] + f.side[2] * s + f.up[2] * v + f.depth[2] * d] })
    }
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n)
      const th = k * 2.39996 + rng.range(-0.3, 0.3)
      const r = lerp(1.7, 1.4, rr) * rng.range(0.84, 1.18) * thin
      const top = b * dome(rr * rr) - drop
      put(Math.cos(th) * rr * (a - r), top - r + rng.range(-0.45, 0.2) * thin, Math.sin(th) * rr * (c - r), r)
    }
    const under = Math.round(n * 0.62)
    for (let k = 0; k < under; k++) {
      const rr = 0.93 * Math.sqrt((k + 0.5) / under)
      const th = k * 2.39996 + 1.3 + rng.range(-0.4, 0.4)
      const r = rng.range(0.95, 1.4) * thin
      put(Math.cos(th) * rr * (a - r), -b + r + 0.36 * b * rr * rr * rr + rng.range(0, 0.6) * thin, Math.sin(th) * rr * (c - r), r)
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
  drop: number
  lift: number
  cover: number
  raise: number
  slant: number
  skew: number
}

const padFields: PadField[] = PADS.map((P, pad) => {
  const mine = clusters.filter((c) => c.pad === pad)
  const balls = new Float64Array(mine.length * 4)
  let reach = 0
  mine.forEach((c, i) => {
    balls.set([c.local[0], c.local[1], c.local[2], c.radius], i * 4)
    reach = Math.max(reach, Math.hypot(c.local[0] - P.at[0], c.local[1] - P.at[1], c.local[2] - P.at[2]) + c.radius)
  })
  return { centre: P.at, reach, balls, frame: padFrame(P.lean, P.tip), size: P.size, n: pad, drop: TOP_DROP * Math.min(1, Math.max(0.62, P.size[1] / 3.3)), lift: (CAP.lift + CAP.thick * P.size[1]) * LOADS[pad]![0], cover: CAP.cover * LOADS[pad]![1], raise: LOADS[pad]![2], slant: LOADS[pad]![3], skew: LOADS[pad]![4] }
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
  return best + wobble(x, h, z)
}

export function crownCap(x: number, h: number, z: number): number {
  let best = Infinity
  for (const f of padFields) {
    const far = Math.hypot(x - f.centre[0], h - f.centre[1], z - f.centre[2]) - f.reach - f.lift
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
    const rim = (s * s) / (f.size[0] * f.size[0]) + (d * d) / (f.size[2] * f.size[2])
    const fore = d / f.size[2] - CAP.fore
    const lee = s / f.size[0] + CAP.lee * f.skew
    const turn = Math.atan2(fore, lee)
    const edge = (lee * lee + fore * fore) / (f.cover * (1 + 0.2 * Math.sin(2 * turn + 2.3 * f.n) + 0.16 * Math.sin(3 * turn + 1.7 * f.n) + 0.1 * Math.sin(5 * turn + 2.9 * f.n)))
    const load = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(edge, 0), CAP.flat)))
    const swell = CAP.swell * (Math.sin(0.75 * s + 1.9 * f.n) * Math.sin(0.8 * d + 2.6 * f.n) + 0.35 * Math.sin(1.5 * s - 1.2 * d + f.n)) + CAP.ripple * Math.sin(2.1 * s + 0.9 * d + 2.2 * f.n) * Math.sin(1.9 * d - 0.7 * s + 1.1 * f.n) + CAP.lump * Math.sin(3.7 * s + 1.3 * f.n) * Math.sin(4.1 * d + 0.7 * f.n)
    const bare = clamp01((Math.sin(0.8 * s + 3.1 * f.n) * Math.sin(0.85 * d + 1.3 * f.n) - CAP.gapFrom) / (CAP.gapTo - CAP.gapFrom))
    const top = f.size[1] * dome(rim) - f.drop + (f.lift * (1 - CAP.skew * f.skew * lee) + swell) * load - CAP.gap * bare * bare * (3 - 2 * bare) - CAP.sink - 0.8 * Math.max(0, edge - 1)
    const over = CAP.slope * (v - top)
    const wall = 1.2 * (Math.sqrt(Math.max(edge, rim / (CAP.rim * (1 + 0.1 * Math.sin(3 * turn + 1.3 * f.n) + 0.07 * Math.sin(7 * turn + 2.1 * f.n))))) - 1.02)
    const brow = clamp01(0.5 + (0.5 * (wall - over)) / CAP.brow)
    const body = lerp(over, wall, brow) + CAP.brow * brow * (1 - brow)
    const hem = CAP.hem * (0.6 * Math.sin(0.93 * s + 1.7 * f.n) * Math.sin(0.81 * d + 2.3 * f.n) + 0.4 * Math.sin(1.73 * s - 1.12 * d + f.n) + 0.12 * Math.sin(3.1 * s + 2.7 * d + 0.6 * f.n))
    const line = f.size[1] * dome(rim) - f.drop - CAP.depth + f.raise + hem - CAP.droop * rim * rim + (f.slant * s) / f.size[0]
    const cut = line - v
    const k = CAP.lip
    const t = clamp01(0.5 + (0.5 * (body - cut)) / k)
    const both = lerp(cut, body, t) + k * t * (1 - t)
    if (both < best) best = both
  }
  return best + 0.25 * wobble(0.7 * x + 3, 0.7 * h, 0.7 * z)
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

const tubeSolid = chainSolid(limbs.filter((l) => l.kind !== 'stem').map((l) => ({ points: l.points, radii: l.radii })), 2)
const COLUMN_REACH = 13
const COLUMN_SLOPE = 0.8

function heightAt(x: number, y: number, z: number): number {
  const g0 = footGround()
  const raise = Math.max(0, g0 + FLARE_H + MIN_SHAFT - (FOOT_Y + FORK_H))
  const forkY = FOOT_Y + FORK_H + raise
  if (y >= forkY) return y - FOOT_Y - raise
  if (y >= g0 + FLARE_H) return FLARE_H + ((y - g0 - FLARE_H) / (forkY - g0 - FLARE_H)) * (FORK_H - FLARE_H)
  const delta = groundAt(x, z) - g0
  const low = y - g0 - delta
  if (low <= 1) return low
  const k = delta / (FLARE_H - 1)
  return Math.min(FLARE_H, (y - g0 - delta - k) / (1 - k))
}

function columnSolid(x: number, y: number, z: number): number {
  const h = heightAt(x, y, z)
  const hc = Math.min(TOP_H, Math.max(DEEP_H, h))
  const [ax, az] = trunkAxis(hc)
  const dx = x - FOOT_X - ax
  const dz = z - FOOT_Z - az
  const rho = Math.hypot(dx, dz)
  const past = Math.max(h - TOP_H, DEEP_H - h, 0)
  if (rho > COLUMN_REACH) return Math.hypot(rho - COLUMN_REACH + 1, past)
  const side = (rho - trunkRadius(Math.atan2(dz, dx), hc)) * COLUMN_SLOPE
  return past > 0 ? Math.hypot(Math.max(side, 0), past) : side
}

export const trunkSolid = (x: number, y: number, z: number): number => Math.min(columnSolid(x, y, z), tubeSolid(x, y, z))

export const glow = { uTwinkle: { value: new THREE.Vector4(0, 0, 1, 0) } }

export function* glowing(g: THREE.BufferGeometry, lights: readonly GlowLight[], wrapLight = 0.35): Generator<void, void> {
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const n = pos.count
  const out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    if (i % ROW === 0) yield
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
      const wr = l.wrap ?? wrapLight
      const w = (l.power * Math.max(0, wr + (1 - wr) * facing)) / (1 + d2 / reach2) ** 1.5
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

export function bakeGlow(g: THREE.BufferGeometry, lights: readonly GlowLight[], wrapLight = 0.35): void {
  whole(glowing(g, lights, wrapLight))
}

export function glowHook(shader: THREE.WebGLProgramParametersWithUniforms, albedo = 'material.diffuseContribution', relief = 0): void {
  shader.uniforms.uTwinkle = glow.uTwinkle
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aGlow;\nvarying vec4 vGlow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec4 uTwinkle;\nvarying vec4 vGlow;')
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += vGlow.rgb * uTwinkle.z * (1.0 + uTwinkle.y * sin(6.2831853 * (uTwinkle.x + vGlow.a))) * ${albedo}${relief > 0 ? ` * (1.0 - ${relief.toFixed(2)} * (1.0 - pow(max(dot(normal, nonPerturbedNormal), 0.0), 3.0)))` : ''};`,
    )
}

export function prepareTrunk(): Promise<void> {
  return prepareModel(MODEL)
}

export function* placing(source: THREE.BufferGeometry): Generator<void, THREE.BufferGeometry> {
  const g = source.clone()
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const e = 0.05
  for (let i = 0; i < pos.count; i++) {
    if (i % ROW === 0) yield
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

export function placeGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  return whole(placing(source))
}

export function* trunkMaking(part: string, lights: readonly GlowLight[] = [], tint: Rgb = [0.8, 1.5, 2.6]): Generator<void, THREE.Mesh> {
  const g = yield* placing(geometry(MODEL, 'trunk'))
  yield* glowing(g, lights)
  const normal = texture(BARK_NORMAL)
  const m = stageMaterial({
    part,
    standIn: false,
    inside: true,
    miniature: true,
    change: 'miniature',
    map: texture(BARK),
    color: new THREE.Color(tint[0], tint[1], tint[2]),
    vertexColors: true,
    roughness: 0.86,
    extra: { normalMap: normal, normalScale: new THREE.Vector2(1.6, 1.6) },
    hook: (shader) => glowHook(shader, undefined, BARK_RELIEF),
    key: 'trunk',
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function buildTrunk(part: string, lights: readonly GlowLight[] = [], tint: Rgb = [0.8, 1.5, 2.6]): THREE.Mesh {
  return whole(trunkMaking(part, lights, tint))
}
