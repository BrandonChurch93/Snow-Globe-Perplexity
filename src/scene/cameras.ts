import * as THREE from 'three'
import { cameraById, config, type CameraSpec } from '../config'
import type { Sample } from '../core/sampler'

export interface Pose {
  position: THREE.Vector3
  aim: THREE.Vector3
  fovDeg: number
  focusMm: number
  apertureMm: number
}

const RAD = Math.PI / 180

const LENS: Record<string, { apertureMm: number; focusShiftMm: number }> = {
  hero: { apertureMm: 9, focusShiftMm: -40 },
  macro: { apertureMm: 5, focusShiftMm: 0 },
  interior: { apertureMm: 7, focusShiftMm: -10 },
  base: { apertureMm: 7, focusShiftMm: -50 },
  surface: { apertureMm: 7, focusShiftMm: -40 },
  low: { apertureMm: 8, focusShiftMm: -40 },
}

export function poseOf(spec: CameraSpec, lens = { apertureMm: 8, focusShiftMm: 0 }): Pose {
  const yaw = spec.yawDeg * RAD
  const pitch = spec.pitchDeg * RAD
  const aim = new THREE.Vector3(0, spec.aimHeightMm, 0)
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
  return {
    position: aim.clone().addScaledVector(dir, spec.distanceMm),
    aim,
    fovDeg: spec.fovDeg,
    focusMm: spec.distanceMm + lens.focusShiftMm,
    apertureMm: lens.apertureMm,
  }
}

export const poseById = (id: string): Pose => poseOf(cameraById(id), LENS[id])

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    position: a.position.clone().lerp(b.position, t),
    aim: a.aim.clone().lerp(b.aim, t),
    fovDeg: a.fovDeg + (b.fovDeg - a.fovDeg) * t,
    focusMm: a.focusMm + (b.focusMm - a.focusMm) * t,
    apertureMm: a.apertureMm + (b.apertureMm - a.apertureMm) * t,
  }
}

const right = new THREE.Vector3()
const up = new THREE.Vector3()
const back = new THREE.Vector3()

export const ROOM_RADIUS_MM = 5000
const NEAR_MM = 20
const FAR_MM = 2.4 * ROOM_RADIUS_MM

export function applyPose(camera: THREE.PerspectiveCamera, pose: Pose, width: number, height: number, sample: Sample | null): void {
  camera.fov = pose.fovDeg
  camera.aspect = width / height
  camera.near = NEAR_MM
  camera.far = FAR_MM
  camera.position.copy(pose.position)
  camera.up.set(0, 1, 0)
  camera.lookAt(pose.aim)
  if (sample) camera.setViewOffset(width, height, sample.px, sample.py, width, height)
  else camera.clearViewOffset()
  camera.updateProjectionMatrix()
  if (sample && pose.apertureMm > 0) {
    camera.updateMatrixWorld(true)
    camera.matrixWorld.extractBasis(right, up, back)
    const dx = sample.lu * pose.apertureMm
    const dy = sample.lv * pose.apertureMm
    camera.position.addScaledVector(right, dx).addScaledVector(up, dy)
    const e = camera.projectionMatrix.elements
    e[8] -= (e[0] * dx) / pose.focusMm
    e[9] -= (e[5] * dy) / pose.focusMm
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
  }
  camera.updateMatrixWorld(true)
}

export const sphereCentreMm = config.globe.baseHeightMm - config.globe.collarDepthMm + config.globe.sphereDiameterMm / 2
