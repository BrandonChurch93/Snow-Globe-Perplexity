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

export const LAMP = { yaw: 0.5, sink: 0.3, cageLo: 8.6, cageHi: 11.2, loHalf: 0.62, hiHalf: 1, flame: 1.05 }

export function lampFoot(): Point {
  return [lamppost.x, groundAt(lamppost.x, lamppost.z) - LAMP.sink, lamppost.z]
}

export function lampFlame(): Point {
  const f = lampFoot()
  return [f[0], f[1] + LAMP.cageLo + LAMP.flame, f[2]]
}

const SHRUBS: { at: [number, number]; r: Point }[] = [
  { at: [c.halfWidth + 0.9, c.halfLength + 0.9], r: [1.9, 2.5, 1.8] },
  { at: [-c.halfWidth + 1.3, c.halfLength + 1.7], r: [2.3, 1.7, 1.9] },
  { at: [-c.halfWidth - 1.5, 5.5], r: [1.8, 2, 2.3] },
  { at: [-c.halfWidth - 1.6, -2.1], r: [1.7, 1.8, 2.4] },
  { at: [-c.halfWidth - 1.5, -6.8], r: [1.8, 2.3, 2.2] },
]

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
