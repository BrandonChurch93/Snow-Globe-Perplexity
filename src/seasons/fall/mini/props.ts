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
  { name: 'door', at: cottagePoint(-2.7, 0, cottage.halfLength + 3.7), r: 2.9, tall: 0.8, yaw: 0.38, ribs: 10, lean: 0.05 },
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
