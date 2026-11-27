import * as THREE from 'three'
import { applyPose, type Pose } from '../scene/cameras'
import { CENTRE_Y } from '../particles/engine/sdf'
import { config } from '../config'
import type { Sample } from '../core/sampler'
import type { GlobePose } from '../shake/table'

const STEPS = 12
const camera = new THREE.PerspectiveCamera()
const euler = new THREE.Euler()
const point = new THREE.Vector3()
const shift = new THREE.Vector3()

type Mark = readonly [number, number, number]

const RING = 12

/**
 * The marks whose travel is read: the ball's centre and top, three rings on the glass, the base's foot and its rim.
 * A tilt about the foot moves the top and the glass's far side furthest; a twist moves only what stands off the
 * upright axis, so the rings and the base's edges are what tell it.
 */
export const TRAVEL_MARKS: readonly Mark[] = (() => {
  const r = config.globe.sphereDiameterMm / 2
  const b = config.globe.baseDiameterMm / 2
  const out: Mark[] = [
    [0, CENTRE_Y, 0],
    [0, CENTRE_Y + r, 0],
  ]
  for (let i = 0; i < RING; i++) {
    const a = (2 * Math.PI * i) / RING
    const c = Math.cos(a)
    const s = Math.sin(a)
    for (const lat of [-Math.PI / 4, 0, Math.PI / 4]) out.push([r * Math.cos(lat) * c, CENTRE_Y + r * Math.sin(lat), r * Math.cos(lat) * s])
    out.push([b * c, 0, b * s], [b * c, config.globe.baseHeightMm, b * s])
  }
  return out
})()

function aim(pose: Pose, width: number, height: number): void {
  applyPose(camera, pose, width, height, null)
  camera.updateMatrixWorld(true)
}

/** Where a point of the ball (local, in mm) lands on the picture drawn by the camera in hand, in pixels from the top left; `mirrored` gives its image in the table. Null behind the camera. */
function land(local: Mark, g: GlobePose, width: number, height: number, mirrored: boolean): [number, number] | null {
  point.set(local[0], local[1], local[2]).applyEuler(euler.set(g.tiltX, g.twist ?? 0, g.tiltZ, 'XZY')).add(shift.set(g.x, g.y, g.z))
  if (mirrored) point.y = -point.y
  point.project(camera)
  if (!(point.z > -1 && point.z < 1)) return null
  return [(point.x * 0.5 + 0.5) * width, (0.5 - point.y * 0.5) * height]
}

const inside = (p: [number, number] | null, width: number, height: number): p is [number, number] => p !== null && p[0] >= 0 && p[0] <= width && p[1] >= 0 && p[1] <= height

/**
 * The fastest travel on the picture, in pixels a shutter, of the ball's marks and of their images in the table inside
 * the shutter that starts at `from`: the largest step between neighbouring moments, scaled to the whole shutter, so the
 * spacing of the samples is bounded where the ball is quickest. The centre and the top count wherever they land, as they
 * always did; the other marks count while they are in the picture. It reads the timeline and the camera only.
 */
export function shutterTravelPx(from: number, shutterSec: number, globeAt: (sec: number) => GlobePose, poseAt: (sec: number) => Pose, width: number, height: number): number {
  if (!(shutterSec > 0)) return 0
  const marks = TRAVEL_MARKS
  const n = marks.length
  let worst = 0
  let last: ([number, number] | null)[] = []
  for (let k = 0; k <= STEPS; k++) {
    const t = from + (shutterSec * k) / STEPS
    const g = globeAt(t)
    aim(poseAt(t), width, height)
    const now: ([number, number] | null)[] = []
    for (let j = 0; j < 2 * n; j++) {
      const always = j < 2
      const p = land(marks[j % n]!, g, width, height, j >= n)
      now.push(p)
      const q = last[j]
      if (!p || !q) continue
      if (!always && !(inside(p, width, height) && inside(q, width, height))) continue
      worst = Math.max(worst, Math.hypot(p[0] - q[0], p[1] - q[1]) * STEPS)
    }
    last = now
  }
  return worst
}

/** The travel of the ball's centre on the picture at `sec`, in pixels a shutter, x to the right and y down. */
export function centrePacePx(sec: number, shutterSec: number, globeAt: (sec: number) => GlobePose, poseAt: (sec: number) => Pose, width: number, height: number): [number, number] {
  if (!(shutterSec > 0)) return [0, 0]
  const h = shutterSec / (2 * STEPS)
  aim(poseAt(sec - h), width, height)
  const a = land(TRAVEL_MARKS[0]!, globeAt(sec - h), width, height, false)
  aim(poseAt(sec + h), width, height)
  const b = land(TRAVEL_MARKS[0]!, globeAt(sec + h), width, height, false)
  if (!a || !b) return [0, 0]
  return [(b[0] - a[0]) * STEPS, (b[1] - a[1]) * STEPS]
}

/** The tier's count for one frame: its fixed count, or, where the tier has `motion`, enough to keep the samples `spacingPx` apart. */
export function framesamples(base: number, motion: { spacingPx: number; maxSamplesPerFrame: number } | undefined, travelPx: () => number): number {
  if (!motion) return base
  const need = Math.ceil(Math.round(travelPx() * 1000) / 1000 / motion.spacingPx)
  return Math.max(base, Math.min(motion.maxSamplesPerFrame, need))
}

const PLASTIC = 1.324717957244746
const ALONG = 1 / PLASTIC
const ACROSS = 1 / (PLASTIC * PLASTIC)
const frac = (x: number) => x - Math.floor(x)
/** How far a moment may be moved, in parts of the shutter: where the ball turns round its pace is near nothing and the move would be without end. */
const REACH = 2

/** One sample of a moving frame: what the stage draws it with, and its moment as a share of the shutter. */
export interface Timed {
  sample: Sample
  at: number
}

/**
 * The samples of a frame in which the ball travels, for a streak with no copies in it. `set` is the picture's set in
 * the order of its times; `pace(u)` is the travel of the ball's centre at the share `u` of the shutter, in pixels a
 * shutter. Three things change against the set as it stands:
 * the times are even, the middle of each of `count` equal parts, where the set's own times leave a hole after every
 * seventh sample;
 * the place in the pixel is taken anew in the order of time, along the travel and across it, from a sequence whose every
 * short run fills the pixel evenly, so the few copies that overlap at one spot of a streak settle its edge;
 * and each moment is moved by the time the ball takes to cross the sample's place along the travel, so the copies of
 * what moves with the ball lie at even steps on the picture whatever their place in the pixel. What stands still keeps
 * the whole pixel. The lens points and the numbers of the samples stay with their rank in time.
 */
export function evenSet(set: readonly Sample[], pace: (u: number) => readonly [number, number]): Timed[] {
  const n = set.length
  const out: Timed[] = set.map((s, k) => {
    const u = (k + 0.5) / n
    const along = frac(0.5 + ALONG * (k + 1)) - 0.5
    const across = frac(0.5 + ACROSS * (k + 1)) - 0.5
    const [vx, vy] = pace(u)
    const speed = Math.hypot(vx, vy)
    if (!(speed > 1e-6)) return { sample: { ...s, px: along, py: across, t: u }, at: u }
    const dx = vx / speed
    const dy = vy / speed
    const move = Math.max(-REACH / n, Math.min(REACH / n, along / speed))
    return { sample: { ...s, px: along * dx - across * dy, py: along * dy + across * dx, t: u }, at: Math.max(0, Math.min(1, u + move)) }
  })
  return out.sort((a, b) => a.at - b.at || a.sample.index - b.sample.index)
}
