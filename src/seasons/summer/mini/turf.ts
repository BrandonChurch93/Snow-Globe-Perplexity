import { cottage, cottageFrame, fence, groundAt, innerRadiusMm, pondField, steps, stones, tree } from '../../../scene/layout'

// Decision 157: the shared ground does not move. Summer lays turf over it as winter lays snow: thick against the cottage's
// foot and the tree's roots, and nothing at the pond's edge, on the path and at the glass. The mesh and what the seeds meet
// both read it here.
export const RISE = { lawnMm: 1.4, cottageMm: 1.4, treeMm: 3.4, reachMm: 10, pondFrom: 1.02, pondTo: 1.5, pathFrom: 1.0, pathTo: 4.5, glassFrom: 2.5, glassTo: 11, fence: 0.45, fenceFrom: 1.5, fenceTo: 7, doorOutMm: 0.5 }

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const frame = cottageFrame()

// The door's threshold lies as bare as the steps before it: the turf stood 2 mm up its left jamb.
const sill = ((): { x: number; z: number; dx: number; dz: number } => {
  const at = (across: number): [number, number] => [
    cottage.x + frame.v[0] * across + frame.u[0] * (cottage.halfLength + RISE.doorOutMm),
    cottage.z + frame.v[1] * across + frame.u[1] * (cottage.halfLength + RISE.doorOutMm),
  ]
  const a = at(cottage.door.across - cottage.door.width / 2)
  const b = at(cottage.door.across + cottage.door.width / 2)
  return { x: a[0], z: a[1], dx: b[0] - a[0], dz: b[1] - a[1] }
})()

export function riseAt(x: number, z: number): number {
  const dx = x - cottage.x
  const dz = z - cottage.z
  const wall = Math.hypot(Math.max(Math.abs(dx * frame.u[0] + dz * frame.u[1]) - cottage.halfLength, 0), Math.max(Math.abs(dx * frame.v[0] + dz * frame.v[1]) - cottage.halfWidth, 0))
  const root = Math.max(Math.hypot(x - tree.x, z - tree.z) - tree.trunk, 0)
  let path = Infinity
  for (const [px, pz] of steps) path = Math.min(path, Math.hypot(x - px, z - pz))
  for (const [px, pz] of stones) path = Math.min(path, Math.hypot(x - px, z - pz))
  const st = Math.min(1, Math.max(0, ((x - sill.x) * sill.dx + (z - sill.z) * sill.dz) / (sill.dx * sill.dx + sill.dz * sill.dz)))
  path = Math.min(path, Math.hypot(x - sill.x - sill.dx * st, z - sill.z - sill.dz * st))
  // The fence keeps its lower rail clear of the turf.
  const fx = fence.to[0] - fence.from[0]
  const fz = fence.to[1] - fence.from[1]
  const ft = Math.min(1, Math.max(0, ((x - fence.from[0]) * fx + (z - fence.from[1]) * fz) / (fx * fx + fz * fz)))
  const rail = Math.hypot(x - fence.from[0] - fx * ft, z - fence.from[1] - fz * ft)
  const y = groundAt(x, z)
  const glass = Math.sqrt(Math.max(0, innerRadiusMm * innerRadiusMm - y * y)) - Math.hypot(x, z)
  const open = smooth(RISE.pondFrom, RISE.pondTo, pondField(x, z)) * smooth(RISE.pathFrom, RISE.pathTo, path) * smooth(RISE.glassFrom, RISE.glassTo, glass)
  return (RISE.lawnMm + RISE.cottageMm * Math.exp(-wall / RISE.reachMm) + RISE.treeMm * Math.exp(-root / RISE.reachMm)) * open * (RISE.fence + (1 - RISE.fence) * smooth(RISE.fenceFrom, RISE.fenceTo, rail))
}
