import { cottage, cottagePoint, groundAt } from '../../../scene/layout'

export type Point = [number, number, number]

export interface Pumpkin {
  name: 'door' | 'tree'
  at: Point
  r: number
  tall: number
  yaw: number
  ribs: number
  lean: number
}

export const ATTIC = { across: 0.2, sill: 11.5, width: 2.1, height: 2.7, frame: 0.3, out: 0.5 }

export const PUMPKINS: readonly Pumpkin[] = [
  { name: 'door', at: cottagePoint(-3.9, 0, cottage.halfLength + 3.5), r: 2.9, tall: 0.8, yaw: 0.38, ribs: 10, lean: 0.05 },
  { name: 'tree', at: [21.4, 0, 3.4], r: 2.6, tall: 0.84, yaw: -0.18, ribs: 9, lean: -0.07 },
]

export const STONES = [
  { at: [5.2, -9.5] as [number, number], w: 1.45, h: 5.3, d: 0.55, yaw: 0.2, lean: 0.07 },
  { at: [7.7, -10.6] as [number, number], w: 1.25, h: 3.8, d: 0.5, yaw: -0.25, lean: -0.1 },
]

export const pumpkinTall = (p: Pumpkin): number => p.r * p.tall
export const pumpkinCentre = (p: Pumpkin): Point => [p.at[0], groundAt(p.at[0], p.at[2]) + pumpkinTall(p) * 0.86, p.at[2]]
export const pumpkinFace = (p: Pumpkin, out: number, up = 0): Point => {
  const c = pumpkinCentre(p)
  return [c[0] + Math.sin(p.yaw) * p.r * out, c[1] + up * pumpkinTall(p), c[2] + Math.cos(p.yaw) * p.r * out]
}
export const atticAt = (): Point => cottagePoint(ATTIC.across, ATTIC.sill + ATTIC.height / 2, cottage.halfLength + ATTIC.out)
export const stoneBase = (s: (typeof STONES)[number]): number => groundAt(s.at[0], s.at[1]) + s.h / 2 - 0.45

export interface Board {
  a: Point
  b: Point
  wide: number
  thick: number
  out: [number, number]
  post: boolean
}

const RAIL = { from: [-39.2, 10.6] as [number, number], to: [-16.4, 32.6] as [number, number], bow: 1.6 }
const POSTS = [
  { t: 0.0, tall: 10.2, along: 0.1, out: 0.08, wide: 2.28 },
  { t: 0.17, tall: 11.2, along: -0.07, out: 0.14, wide: 2.11 },
  { t: 0.335, tall: 10.0, along: 0.13, out: 0.05, wide: 2.38 },
  { t: 0.5, tall: 11.0, along: -0.04, out: 0.16, wide: 2.19 },
  { t: 0.665, tall: 10.4, along: 0.09, out: 0.1, wide: 2.28 },
  { t: 0.835, tall: 11.4, along: -0.11, out: 0.18, wide: 2.11 },
  { t: 1.0, tall: 9.6, along: 0.16, out: 0.12, wide: 2.46 },
]
const RAILS = [
  { at: 3.5, tilt: [0.2, -0.3, 0.25, -0.15, 0.3, -0.25], wide: 1.6 },
  { at: 7.6, tilt: [-0.25, 0.3, -0.2, 0.35, -0.3, 0.2], wide: 1.5 },
]

export function fenceBoards(): Board[] {
  const dx = RAIL.to[0] - RAIL.from[0]
  const dz = RAIL.to[1] - RAIL.from[1]
  const l = Math.hypot(dx, dz)
  const dir: [number, number] = [dx / l, dz / l]
  const out: [number, number] = [-dir[1], dir[0]]
  const foot = (t: number): Point => {
    const bow = RAIL.bow * Math.sin(Math.PI * t)
    const x = RAIL.from[0] + dx * t - out[0] * bow
    const z = RAIL.from[1] + dz * t - out[1] * bow
    return [x, groundAt(x, z) - 0.6, z]
  }
  const on = (i: number, h: number): Point => {
    const p = POSTS[i]!
    const f = foot(p.t)
    const s = h + 0.6
    return [f[0] + (dir[0] * Math.sin(p.along) + out[0] * Math.sin(p.out)) * s, f[1] + Math.cos(p.along) * Math.cos(p.out) * s, f[2] + (dir[1] * Math.sin(p.along) + out[1] * Math.sin(p.out)) * s]
  }
  const boards: Board[] = POSTS.map((p, i): Board => ({ a: foot(p.t), b: on(i, p.tall), wide: p.wide, thick: 0.85, out, post: true }))
  for (const r of RAILS)
    for (let i = 0; i < POSTS.length - 1; i++) {
      const a = on(i, r.at + r.tilt[i]!)
      const b = on(i + 1, r.at - r.tilt[i]! * 0.6)
      const k = 0.9 / Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const front = 0.55
      boards.push({
        a: [a[0] - (b[0] - a[0]) * k + out[0] * front, a[1] - (b[1] - a[1]) * k, a[2] - (b[2] - a[2]) * k + out[1] * front],
        b: [b[0] + (b[0] - a[0]) * k + out[0] * front, b[1] + (b[1] - a[1]) * k, b[2] + (b[2] - a[2]) * k + out[1] * front],
        wide: r.wide,
        thick: 0.4,
        out,
        post: false,
      })
    }
  return boards
}

export function boardDistance(x: number, y: number, z: number, boards: readonly Board[]): number {
  let d = Infinity
  for (const b of boards) {
    const ex = b.b[0] - b.a[0]
    const ey = b.b[1] - b.a[1]
    const ez = b.b[2] - b.a[2]
    const t = Math.min(1, Math.max(0, ((x - b.a[0]) * ex + (y - b.a[1]) * ey + (z - b.a[2]) * ez) / (ex * ex + ey * ey + ez * ez)))
    d = Math.min(d, Math.hypot(x - b.a[0] - ex * t, y - b.a[1] - ey * t, z - b.a[2] - ez * t) - (b.wide + b.thick) / 4)
  }
  return d
}

export const fenceGapOf = (x: number, z: number): number => {
  const dx = RAIL.to[0] - RAIL.from[0]
  const dz = RAIL.to[1] - RAIL.from[1]
  const t = Math.min(1.1, Math.max(-0.1, ((x - RAIL.from[0]) * dx + (z - RAIL.from[1]) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(x - RAIL.from[0] - dx * t, z - RAIL.from[1] - dz * t)
}

export const ROCKS = [
  { at: [31.0, 22.0] as [number, number], r: [7.4, 4.9, 5.2] as Point, yaw: 0.5, seed: 3.1 },
  { at: [37.5, 13.4] as [number, number], r: [3.6, 2.6, 3.0] as Point, yaw: -0.4, seed: 8.4 },
  { at: [23.6, 30.4] as [number, number], r: [3.4, 2.0, 2.7] as Point, yaw: 1.2, seed: 5.7 },
  { at: [-22.5, 31.5] as [number, number], r: [1.9, 1.2, 1.6] as Point, yaw: 0.2, seed: 1.9 },
]
export const rockCentre = (r: (typeof ROCKS)[number]): Point => [r.at[0], groundAt(r.at[0], r.at[1]) + r.r[1] * 0.45, r.at[1]]

export const PATH_LINE: readonly [number, number][] = [
  [-5.6, 2.4],
  [-6.6, 6.6],
  [-8.6, 10.6],
  [-10.9, 14.2],
  [-12.9, 17.8],
  [-14.2, 21.6],
  [-14.4, 25.4],
  [-13.0, 29.0],
]
