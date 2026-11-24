import { config } from '../config'
import { MOVES, poseOfRig, rigOf, type Rig } from '../film/moves'
import type { Pose } from '../scene/cameras'
import { sphereCentreHeightMm, sphereRadiusMm } from '../scene/framing'

export const FRAME = {
  widthFill: 0.86,
  underShare: 0.08,
  leastAspect: 0.2,
  overShare: 0.045,
  barShare: 0.08,
  barPx: 96,
  airPx: 22,
  mostUnder: 0.35,
  easeRate: 4,
}

const L = config.live
const RAD = Math.PI / 180
const BASE_R = config.globe.baseDiameterMm / 2

export function edges(rig: Rig): { top: number; foot: number } {
  const p = rig.pitchDeg * RAD
  const t = Math.tan((rig.fovDeg * RAD) / 2)
  const up = sphereCentreHeightMm - rig.aimHeightMm
  const depth = rig.distanceMm - up * Math.sin(p)
  const height = up * Math.cos(p)
  const top = Math.tan(Math.atan2(height, depth) + Math.asin(sphereRadiusMm / Math.hypot(depth, height))) / t
  const foot = (-rig.aimHeightMm * Math.cos(p) - BASE_R * Math.sin(p)) / (rig.distanceMm + rig.aimHeightMm * Math.sin(p) - BASE_R * Math.cos(p)) / t
  return { top, foot }
}

export const margins = (rig: Rig): { over: number; under: number } => {
  const e = edges(rig)
  return { over: (1 - e.top) / 2, under: (1 + e.foot) / 2 }
}

const aimForFoot = (rig: Rig, foot: number): number => {
  const p = rig.pitchDeg * RAD
  const y = foot * Math.tan((rig.fovDeg * RAD) / 2)
  return -(y * (rig.distanceMm - BASE_R * Math.cos(p)) + BASE_R * Math.sin(p)) / (Math.cos(p) + y * Math.sin(p))
}

export const roomUnder = (heightPx: number, controlsPx: number | null = null): number => {
  const h = Math.max(1, heightPx)
  return Math.min(FRAME.mostUnder, Math.max(FRAME.barShare, FRAME.barPx / h, controlsPx === null ? 0 : (controlsPx + FRAME.airPx) / h))
}

export function controlsPx(ui: Element | null, frame: Element): number | null {
  if (!ui) return null
  let top = Infinity
  for (const el of ui.querySelectorAll('[data-control="shake"], [data-control="sound"], [data-season]')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) top = Math.min(top, r.top)
  }
  return Number.isFinite(top) ? Math.max(0, frame.getBoundingClientRect().bottom - top) : null
}

export function liveRig(aspect: number, yawDeg = 0, pitchDeg = 0, under = 0): Rig {
  const rig = rigOf(MOVES.wide)
  const k = 2 * Math.tan((rig.fovDeg * RAD) / 2)
  const across = Math.max(2 * sphereRadiusMm, config.globe.baseDiameterMm)
  const d = Math.max(rig.distanceMm, across / (FRAME.widthFill * k * Math.max(aspect, FRAME.leastAspect)))
  rig.aimHeightMm -= FRAME.underShare * k * (d - rig.distanceMm)
  rig.distanceMm = d
  if (under > 0) {
    const low = -1 + 2 * Math.min(under, FRAME.mostUnder)
    const room = 1 - 2 * FRAME.overShare - low
    for (let i = 0; i < 6; i++) {
      const e = edges(rig)
      if (e.foot >= low) break
      const span = e.top - e.foot
      if (span > room) rig.distanceMm *= span / room
      rig.aimHeightMm = aimForFoot(rig, low)
      if (span <= room) break
    }
  }
  rig.yawDeg = Math.max(-L.orbitYawDeg, Math.min(L.orbitYawDeg, rig.yawDeg + yawDeg))
  rig.pitchDeg = Math.max(L.orbitPitchMinDeg, Math.min(L.orbitPitchMaxDeg, rig.pitchDeg + pitchDeg))
  return rig
}

export const livePose = (aspect: number, yawDeg = 0, pitchDeg = 0, under = 0): Pose => poseOfRig(liveRig(aspect, yawDeg, pitchDeg, under))
