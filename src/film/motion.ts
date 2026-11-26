import * as THREE from 'three'
import { applyPose, type Pose } from '../scene/cameras'
import { CENTRE_Y } from '../particles/engine/sdf'
import { config } from '../config'
import type { GlobePose } from '../shake/table'

const STEPS = 12
const camera = new THREE.PerspectiveCamera()
const euler = new THREE.Euler()
const point = new THREE.Vector3()

/** Where a point of the ball (local, in mm) lands on the picture, in pixels of a width x height format. */
function screenOf(local: readonly [number, number, number], g: GlobePose, pose: Pose, width: number, height: number): [number, number] {
  applyPose(camera, pose, width, height, null)
  camera.updateMatrixWorld(true)
  point.set(local[0], local[1], local[2]).applyEuler(euler.set(g.tiltX, g.twist ?? 0, g.tiltZ, 'XZY')).add(new THREE.Vector3(g.x, g.y, g.z)).project(camera)
  return [(point.x * 0.5 + 0.5) * width, (0.5 - point.y * 0.5) * height]
}

/**
 * The fastest travel on the picture, in pixels a shutter, of the ball's centre and its top inside the shutter that
 * starts at `from`: the largest step between neighbouring moments, scaled to the whole shutter, so the spacing of
 * the samples is bounded where the ball is quickest. It reads the timeline and the camera only.
 */
export function shutterTravelPx(from: number, shutterSec: number, globeAt: (sec: number) => GlobePose, poseAt: (sec: number) => Pose, width: number, height: number): number {
  if (!(shutterSec > 0)) return 0
  const r = config.globe.sphereDiameterMm / 2
  const marks: [number, number, number][] = [
    [0, CENTRE_Y, 0],
    [0, CENTRE_Y + r, 0],
  ]
  let worst = 0
  const last: ([number, number] | null)[] = marks.map(() => null)
  for (let k = 0; k <= STEPS; k++) {
    const t = from + (shutterSec * k) / STEPS
    const g = globeAt(t)
    const pose = poseAt(t)
    marks.forEach((m, j) => {
      const p = screenOf(m, g, pose, width, height)
      const q = last[j]
      if (q) worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1]) * STEPS)
      last[j] = p
    })
  }
  return worst
}

/** The tier's count for one frame: its fixed count, or, where the tier has `motion`, enough to keep the samples `spacingPx` apart. */
export function framesamples(base: number, motion: { spacingPx: number; maxSamplesPerFrame: number } | undefined, travelPx: () => number): number {
  if (!motion) return base
  const need = Math.ceil(Math.round(travelPx() * 1000) / 1000 / motion.spacingPx)
  return Math.max(base, Math.min(motion.maxSamplesPerFrame, need))
}
