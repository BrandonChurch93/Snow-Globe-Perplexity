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
  hero: { apertureMm: 2, focusShiftMm: -12 },
  macro: { apertureMm: 2.5, focusShiftMm: 21.5 },
  interior: { apertureMm: 0.6, focusShiftMm: -15 },
  base: { apertureMm: 0.8, focusShiftMm: -44 },
  surface: { apertureMm: 2.2, focusShiftMm: -52 },
  low: { apertureMm: 1.6, focusShiftMm: -10 },
}

export const FAR_FIELD = { apertureMm: 5.8, startsPastFocus: 0.12 }

export const farApertureMm = (pose: Pose): number => (pose.apertureMm > 0 ? FAR_FIELD.apertureMm : 0)
export const farFromMm = (pose: Pose): number => pose.focusMm * (1 + FAR_FIELD.startsPastFocus)

export const lensUniforms = {
  uFar: { value: new THREE.Vector4(0, 1, 0, 1) },
  uEye: { value: new THREE.Vector3() },
  uShift: { value: new THREE.Vector2() },
  uFocal: { value: 1 },
}

export const FAR_GLSL = `
uniform vec4 uFar;
uniform vec3 uEye;
uniform vec2 uShift;
uniform float uFocal;
float lensBlurMm(float depth) {
  return uFar.z * abs(depth * uFar.w - 1.0) + uFar.x * max(depth * uFar.y - 1.0, 0.0);
}
`

export function setLens(pose: Pose, sample: Sample | null, focalPx: number, on: boolean): void {
  lensUniforms.uFar.value.set(on ? farApertureMm(pose) : 0, 1 / farFromMm(pose), on ? pose.apertureMm : 0, 1 / pose.focusMm)
  lensUniforms.uEye.value.copy(pose.position)
  lensUniforms.uShift.value.set(sample ? sample.lu * pose.apertureMm : 0, sample ? sample.lv * pose.apertureMm : 0)
  lensUniforms.uFocal.value = focalPx
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
export const poseWith = (id: string, rig: CameraSpec): Pose => poseOf(rig, LENS[id])

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
