import { cottage, cottagePoint, groundAt, lamppost } from '../scene/layout'

export type Point = [number, number, number]

const c = cottage
export const pitch = Math.atan2(c.rise, c.halfWidth)
const cp = Math.cos(pitch)
const sp = Math.sin(pitch)
export const ridgeY = c.wall + c.rise + c.roofThick * cp
export const slopeLength = (c.halfWidth + c.overhang) / cp
export const roofLength = c.halfLength + c.gableOverhang

export const roofAt = (side: number, down: number, along: number, lift: number): Point => cottagePoint(side * (down * cp + lift * sp), ridgeY - down * sp + lift * cp, along)

export const HANG = { eaveStep: 2.4, rakeStep: 1.95, drop: 0.34, eaveOut: 0.5, eaveUnder: -0.24, gableOut: 0.36, rakeUnder: 0.9 }

export function eaveHangs(): Point[] {
  const out: Point[] = []
  const reach = roofLength - 0.7
  const n = Math.round((2 * reach) / HANG.eaveStep)
  for (let i = 0; i <= n; i++) {
    const p = roofAt(-1, slopeLength + HANG.eaveOut, -reach + (2 * reach * i) / n, -0.1)
    out.push([p[0], p[1] - HANG.eaveUnder - HANG.drop, p[2]])
  }
  return out
}

export function rakeHangs(): Point[] {
  const out: Point[] = []
  const run = slopeLength - 0.5 - 0.95 * HANG.rakeStep
  const m = Math.max(1, Math.round(run / HANG.rakeStep))
  const step = run / m
  const at = (side: number, down: number, extra: number): Point => {
    const p = roofAt(side, down, roofLength + HANG.gableOut, -HANG.rakeUnder)
    return [p[0], p[1] - HANG.drop - extra, p[2]]
  }
  for (let i = 0; i <= m; i++) out.push(at(-1, slopeLength - 0.5 - i * step, 0))
  out.push(at(1, 0, 0.25))
  for (let i = m; i >= 0; i--) out.push(at(1, slopeLength - 0.5 - i * step, 0))
  return out
}

export const hangPoints = (): Point[] => [...eaveHangs(), ...rakeHangs()]

export const LAMP = { yaw: 0.12, sink: 0.3, cageLo: 9.9, cageHi: 11.65, loHalf: 0.64, hiHalf: 0.88, flame: 0.9 }

export function lampFoot(): Point {
  return [lamppost.x, groundAt(lamppost.x, lamppost.z) - LAMP.sink, lamppost.z]
}

export function lampFlame(): Point {
  const f = lampFoot()
  return [f[0], f[1] + LAMP.cageLo + LAMP.flame, f[2]]
}

const SHRUBS: { at: [number, number]; r: Point }[] = [
  { at: [c.halfWidth + 0.9, c.halfLength + 0.9], r: [1.9, 2.5, 1.8] },
  { at: [-c.halfWidth + 1.3, c.halfLength + 1.7], r: [2.3, 2.3, 1.9] },
  { at: [-c.halfWidth + 0.2, -8.7], r: [1.25, 6.1, 1.25] },
  { at: [-c.halfWidth + 0.2, -7.3], r: [1.2, 5.9, 1.2] },
  { at: [-c.halfWidth + 0.2, -5.9], r: [1.2, 6, 1.2] },
  { at: [-c.halfWidth + 0.2, -4.5], r: [1.15, 5.3, 1.15] },
  { at: [-c.halfWidth + 0.2, -3.1], r: [1.1, 3.8, 1.1] },
]

export const isIvy = (r: Point): boolean => r[1] > 2 * r[0]

export function wallOutward(): number {
  const a = cottagePoint(-1, 0, 0)
  const b = cottagePoint(0, 0, 0)
  return Math.atan2(a[2] - b[2], a[0] - b[0])
}

export function shrubs(): { centre: Point; r: Point }[] {
  return SHRUBS.map((s) => {
    const p = cottagePoint(s.at[0], 0, s.at[1])
    return { centre: [p[0], groundAt(p[0], p[2]) + s.r[1] * 0.55, p[2]], r: s.r }
  })
}

export function shrubDistance(x: number, y: number, z: number): number {
  let d = Infinity
  for (const s of shrubs()) {
    const k = Math.hypot((x - s.centre[0]) / s.r[0], (y - s.centre[1]) / s.r[1], (z - s.centre[2]) / s.r[2])
    const v = (k - 1) * Math.min(s.r[0], s.r[1], s.r[2])
    if (v < d) d = v
  }
  return d
}
