import { lensPlace, refractInto, sphereCentreMm } from './lens.mjs'

export const REF_RIG = { fovDeg: 16, distanceMm: 615.3, yawDeg: 0, pitchDeg: 4.5, aimHeightMm: 64 }
export const REF_SIZE = [2816, 1584]
export const REF_GLASS = { x: 1409, y: 646, r: 549 }
export const REF_FOOT = { left: 872, right: 1941, sideY: 1340, frontY: 1445 }
export const CENTRE = [0, sphereCentreMm, 0]

const RAD = Math.PI / 180

export function refCamera(rig = REF_RIG) {
  const yaw = rig.yawDeg * RAD
  const pitch = rig.pitchDeg * RAD
  const back = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]
  const eye = [back[0] * rig.distanceMm, rig.aimHeightMm + back[1] * rig.distanceMm, back[2] * rig.distanceMm]
  const fwd = [-back[0], -back[1], -back[2]]
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)]
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]
  return { eye, fwd, right, up, fovDeg: rig.fovDeg }
}

export function projectWorld(p, size = REF_SIZE, rig = REF_RIG) {
  const c = refCamera(rig)
  const d = [p[0] - c.eye[0], p[1] - c.eye[1], p[2] - c.eye[2]]
  const z = d[0] * c.fwd[0] + d[1] * c.fwd[1] + d[2] * c.fwd[2]
  const f = size[1] / (2 * Math.tan((c.fovDeg * RAD) / 2))
  const x = d[0] * c.right[0] + d[1] * c.right[1] + d[2] * c.right[2]
  const y = d[0] * c.up[0] + d[1] * c.up[1] + d[2] * c.up[2]
  return [size[0] / 2 + size[0] / REF_SIZE[0] + (f * x) / z, size[1] / 2 - (f * y) / z, z]
}

export function projectInside(local, size = REF_SIZE, rig = REF_RIG) {
  const c = refCamera(rig)
  const world = [local[0] + CENTRE[0], local[1] + CENTRE[1], local[2] + CENTRE[2]]
  const placed = lensPlace(world, c.eye, CENTRE)
  const [x, y, z] = projectWorld(placed.apparent, size, rig)
  return [x, y, z, placed.seen]
}

export function rayOf(x, y, size = REF_SIZE, rig = REF_RIG) {
  const c = refCamera(rig)
  const f = size[1] / (2 * Math.tan((c.fovDeg * RAD) / 2))
  const a = (x - size[0] / 2 - size[0] / REF_SIZE[0]) / f
  const b = -(y - size[1] / 2) / f
  const d = [c.fwd[0] + a * c.right[0] + b * c.up[0], c.fwd[1] + a * c.right[1] + b * c.up[1], c.fwd[2] + a * c.right[2] + b * c.up[2]]
  const l = Math.hypot(d[0], d[1], d[2])
  return { origin: c.eye, dir: [d[0] / l, d[1] / l, d[2] / l] }
}

export function insideRayOf(x, y, size = REF_SIZE, rig = REF_RIG) {
  const r = rayOf(x, y, size, rig)
  const bent = refractInto(r.origin, r.dir, CENTRE)
  if (!bent) return null
  return { origin: [bent.origin[0] - CENTRE[0], bent.origin[1] - CENTRE[1], bent.origin[2] - CENTRE[2]], dir: bent.dir }
}
