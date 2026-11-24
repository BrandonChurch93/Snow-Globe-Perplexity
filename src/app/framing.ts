import { config } from '../config'
import { MOVES, poseOfRig, rigOf, type Rig } from '../film/moves'
import type { Pose } from '../scene/cameras'
import { sphereRadiusMm } from '../scene/framing'

export const FRAME = { widthFill: 0.86, underShare: 0.08, leastAspect: 0.2 }

const L = config.live

export function liveRig(aspect: number, yawDeg = 0, pitchDeg = 0): Rig {
  const rig = rigOf(MOVES.wide)
  const k = 2 * Math.tan((rig.fovDeg * Math.PI) / 360)
  const across = Math.max(2 * sphereRadiusMm, config.globe.baseDiameterMm)
  const d = Math.max(rig.distanceMm, across / (FRAME.widthFill * k * Math.max(aspect, FRAME.leastAspect)))
  rig.aimHeightMm -= FRAME.underShare * k * (d - rig.distanceMm)
  rig.distanceMm = d
  rig.yawDeg = Math.max(-L.orbitYawDeg, Math.min(L.orbitYawDeg, rig.yawDeg + yawDeg))
  rig.pitchDeg = Math.max(L.orbitPitchMinDeg, Math.min(L.orbitPitchMaxDeg, rig.pitchDeg + pitchDeg))
  return rig
}

export const livePose = (aspect: number, yawDeg = 0, pitchDeg = 0): Pose => poseOfRig(liveRig(aspect, yawDeg, pitchDeg))
