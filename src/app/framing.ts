import { config } from '../config'
import { MOVES, poseOfRig, rigOf, type Rig } from '../film/moves'
import type { Pose } from '../scene/cameras'
import { sphereCentreHeightMm, sphereRadiusMm } from '../scene/framing'
import { REST_POSE, makeShake, type GlobePose, type ShakePath } from '../shake/table'

export const FRAME = {
  edgeShare: 0.01,
  underShare: 0.08,
  leastAspect: 0.2,
  barShare: 0.08,
  barPx: 96,
  airPx: 22,
  mostUnder: 0.35,
  easeRate: 4,
  shakePaths: 8,
  pathStepBeats: 0.004,
  pathFine: 40,
  nearShare: 0.02,
  keepShare: 0.0015,
  fitFar: [1, 2, 4],
  fitPasses: 16,
}

const L = config.live
const RAD = Math.PI / 180
const BASE_R = config.globe.baseDiameterMm / 2

export const livePath = (n: number): ShakePath => makeShake(`live-${((n % FRAME.shakePaths) + FRAME.shakePaths) % FRAME.shakePaths}`)

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

type Centre = readonly [number, number, number]

const centreOf = (g: GlobePose): Centre => {
  const ax = -sphereCentreHeightMm * Math.sin(g.tiltZ)
  const ay = sphereCentreHeightMm * Math.cos(g.tiltZ)
  return [ax + g.x, ay * Math.cos(g.tiltX) + g.y, ay * Math.sin(g.tiltX) + g.z]
}

const reach = (rig: Rig, centres: readonly Centre[], sideways: boolean, least: number): number => {
  const p = rig.pitchDeg * RAD
  const cp = Math.cos(p)
  const sp = Math.sin(p)
  let most = least
  for (const c of centres) {
    const y = c[1] - rig.aimHeightMm
    const off = sideways ? Math.abs(c[0]) : y * cp - c[2] * sp
    const depth = rig.distanceMm - y * sp - c[2] * cp
    const v = Math.tan(Math.atan2(off, depth) + Math.asin(Math.min(1, sphereRadiusMm / Math.hypot(off, depth))))
    if (v > most) most = v
  }
  return most / Math.tan((rig.fovDeg * RAD) / 2)
}

/** How far the glass reaches up and to either side, in half heights of the frame, seen from a rig that looks from the front. */
const glass = (rig: Rig, c: Centre): { top: number; side: number } => ({ top: reach(rig, [c], false, -Infinity), side: reach(rig, [c], true, 0) })

const REST: Centre = centreOf(REST_POSE)
let shaken: { high: Centre[]; wide: Centre[] } | null = null

/** The places of the glass, over every shake the app plays, that can reach furthest up or furthest to a side. */
export function shakenCentres(): { high: Centre[]; wide: Centre[] } {
  if (shaken) return shaken
  const bar = config.film.beatsPerBar
  const hero = rigOf(MOVES.wide)
  const rigs = FRAME.fitFar.map((far) => ({ ...hero, yawDeg: 0, distanceMm: hero.distanceMm * far }))
  const near = (centres: Centre[], share: number): { high: Set<number>; wide: Set<number> } => {
    const high = new Set<number>()
    const wide = new Set<number>()
    rigs.forEach((rig, r) => {
      const seen = centres.map((c) => glass(rig, c))
      const top = seen.reduce((m, s) => Math.max(m, s.top), -Infinity)
      const side = seen.reduce((m, s) => Math.max(m, s.side), -Infinity)
      seen.forEach((s, i) => {
        if (s.top >= top - share / FRAME.fitFar[r]!) high.add(i)
        if (s.side >= side - share / FRAME.fitFar[r]!) wide.add(i)
      })
    })
    return { high, wide }
  }
  const out = { high: [] as Centre[], wide: [] as Centre[] }
  const once = new Set<string>()
  for (let n = 0; n < FRAME.shakePaths; n++) {
    const path = livePath(n)
    const beats: number[] = []
    for (let i = 0; i * FRAME.pathStepBeats <= bar + 1e-9; i++) beats.push(i * FRAME.pathStepBeats)
    const coarse = near(beats.map((b) => centreOf(path.poseAt(b))), FRAME.nearShare)
    const fine = (kept: Set<number>): Centre[] => {
      const at = new Set<number>()
      for (const i of kept) for (let j = -FRAME.pathFine; j <= FRAME.pathFine; j++) at.add(i * FRAME.pathFine + j)
      return [...at].map((q) => centreOf(path.poseAt((q * FRAME.pathStepBeats) / FRAME.pathFine)))
    }
    const wide = fine(coarse.wide)
    const grid = beats.map((b) => centreOf(path.poseAt(b)))
    for (const i of near(grid, FRAME.keepShare).high) {
      const key = grid[i]!.map((v) => v.toFixed(2)).join()
      if (!once.has(key)) out.high.push(grid[i]!)
      once.add(key)
    }
    out.wide.push(...[...near(wide, FRAME.keepShare).wide].map((i) => wide[i]!))
  }
  shaken = out
  return out
}

const REST_ONLY = [REST]
const topOf = (rig: Rig): number => reach(rig, shakenCentres().high, false, reach(rig, REST_ONLY, false, -Infinity) * Math.tan((rig.fovDeg * RAD) / 2))
const sideOf = (rig: Rig): number => reach(rig, shakenCentres().wide, true, 0)

/** The furthest the glass reaches through a shake from a rig that looks from the front: up, and to a side. */
export const shakeReach = (rig: Rig): { top: number; side: number } => ({ top: topOf(rig), side: sideOf(rig) })

let fitted: { aspect: number; under: number; rig: Rig } | null = null

/** The camera of the app at rest and through a shake: the wide camera moved back along its own axis and aimed so that
 * the lifted glass stays under the top edge, the foot stays over the controls, a wide screen holds the strokes between its sides
 * and an upright screen holds the glass at rest between its sides. It stands as near as those allow. */
function fit(aspect: number, under: number): Rig {
  if (fitted && fitted.aspect === aspect && fitted.under === under) return fitted.rig
  const wide = rigOf(MOVES.wide)
  const rig = { ...wide, yawDeg: 0 }
  const k = 2 * Math.tan((rig.fovDeg * RAD) / 2)
  const a = Math.max(aspect, FRAME.leastAspect)
  const low = -1 + 2 * Math.min(Math.max(under, 0), FRAME.mostUnder)
  const high = 1 - 2 * FRAME.edgeShare
  const across = a * (1 - 2 * FRAME.edgeShare)
  for (let i = 0; i < FRAME.fitPasses; i++) {
    const floor = aimForFoot(rig, low)
    rig.aimHeightMm = floor
    const tall = (topOf(rig) - low) / (high - low)
    rig.aimHeightMm = Math.min(floor, wide.aimHeightMm - FRAME.underShare * k * (rig.distanceMm - wide.distanceMm))
    for (let j = 0; j < 4; j++) {
      const over = topOf(rig) - high
      if (over <= 0) break
      const p = rig.pitchDeg * RAD
      rig.aimHeightMm = Math.min(floor, rig.aimHeightMm + (over * (k / 2) * (rig.distanceMm - (sphereCentreHeightMm - rig.aimHeightMm) * Math.sin(p))) / Math.cos(p))
    }
    const broad = (a >= 1 ? sideOf(rig) : glass(rig, REST).side) / across
    const next = Math.max(wide.distanceMm, rig.distanceMm * Math.max(tall, broad))
    if (Math.abs(next - rig.distanceMm) < 1e-7) break
    rig.distanceMm = next
  }
  fitted = { aspect, under, rig }
  return rig
}

export function liveRig(aspect: number, yawDeg = 0, pitchDeg = 0, under = 0): Rig {
  const base = rigOf(MOVES.wide)
  const rig = { ...fit(aspect, under) }
  rig.yawDeg = Math.max(-L.orbitYawDeg, Math.min(L.orbitYawDeg, base.yawDeg + yawDeg))
  rig.pitchDeg = Math.max(L.orbitPitchMinDeg, Math.min(L.orbitPitchMaxDeg, rig.pitchDeg + pitchDeg))
  return rig
}

export const livePose = (aspect: number, yawDeg = 0, pitchDeg = 0, under = 0): Pose => poseOfRig(liveRig(aspect, yawDeg, pitchDeg, under))
