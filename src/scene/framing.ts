import { cameraById, config } from '../config'

const RAD = Math.PI / 180
type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

export const sphereRadiusMm = config.globe.sphereDiameterMm / 2
export const sphereCentreHeightMm = config.globe.baseHeightMm - config.globe.collarDepthMm + sphereRadiusMm
export const globeTopMm = sphereCentreHeightMm + sphereRadiusMm

export interface Framing {
  globe: { cx: number; cy: number; r: number }
  base: { left: number; right: number; top: number; foot: number }
  frameHeightMm: number
  frameWidthMm: number
  heroFill: number
  cornerReachMm: number
}

export function framingOf(cameraId: string, width: number, height: number): Framing {
  const c = cameraById(cameraId)
  const yaw = c.yawDeg * RAD
  const pitch = c.pitchDeg * RAD
  const aim: V3 = [0, c.aimHeightMm, 0]
  const dir: V3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]
  const pos: V3 = [aim[0] + dir[0] * c.distanceMm, aim[1] + dir[1] * c.distanceMm, aim[2] + dir[2] * c.distanceMm]
  const fwd: V3 = [-dir[0], -dir[1], -dir[2]]
  const right = norm(cross(fwd, [0, 1, 0]))
  const up = cross(right, fwd)
  const tanHalf = Math.tan((c.fovDeg * RAD) / 2)
  const f = height / 2 / tanHalf
  const project = (p: V3): [number, number, number] => {
    const v = sub(p, pos)
    const z = dot(v, fwd)
    return [width / 2 + (f * dot(v, right)) / z, height / 2 - (f * dot(v, up)) / z, z]
  }
  const centre: V3 = [0, sphereCentreHeightMm, 0]
  const [cx, cy, cz] = project(centre)
  const d = Math.hypot(...sub(centre, pos))
  const r = (f * sphereRadiusMm) / Math.sqrt(d * d - sphereRadiusMm * sphereRadiusMm)
  const half = config.globe.baseDiameterMm / 2
  const base = { left: Infinity, right: -Infinity, top: Infinity, foot: -Infinity }
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2
    for (const y of [0, config.globe.baseHeightMm]) {
      const [x, py] = project([Math.cos(a) * half, y, Math.sin(a) * half])
      base.left = Math.min(base.left, x)
      base.right = Math.max(base.right, x)
      if (y > 0) base.top = Math.min(base.top, py)
      else base.foot = Math.max(base.foot, py)
    }
  }
  const frameHeightMm = 2 * c.distanceMm * tanHalf
  const frameWidthMm = (frameHeightMm * width) / height
  const planeH = 2 * cz * tanHalf
  const planeW = (planeH * width) / height
  const ox = ((cx - width / 2) / width) * planeW
  const oy = ((cy - height / 2) / height) * planeH
  let cornerReachMm = 0
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) cornerReachMm = Math.max(cornerReachMm, Math.hypot((sx * planeW) / 2 - ox, (sy * planeH) / 2 - oy))
  return { globe: { cx, cy, r }, base, frameHeightMm, frameWidthMm, heroFill: globeTopMm / frameHeightMm, cornerReachMm }
}
