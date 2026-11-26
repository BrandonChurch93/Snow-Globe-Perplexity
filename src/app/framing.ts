import { config } from '../config'
import { MOVES, poseOfRig, rigOf, smoother, type Rig } from '../film/moves'
import { beatSeconds } from '../film/timeline'
import type { Pose } from '../scene/cameras'
import { globeTopMm, sphereCentreHeightMm, sphereRadiusMm, type Framing } from '../scene/framing'
import { SLAB_SHAPE } from '../scene/surface'
import { REST_POSE, makeShake, type GlobePose, type ShakePath } from '../shake/table'

export const FRAME = {
  edgeShare: 0.01,
  underShare: 0.08,
  leastAspect: 0.2,
  barShare: 0.08,
  barPx: 96,
  barMost: 0.14,
  clearShare: 0.07,
  thumbShare: 0.05,
  heapMm: 46,
  baseReachMm: 74,
  overUnder: 1.1,
  narrowAspect: 0.6,
  narrowYawDeg: 1.2,
  tableKeepMm: 20,
  mostUnder: 0.35,
  easeRate: 4,
  shakePaths: 8,
  pathStepBeats: 0.004,
  pathFine: 40,
  nearShare: 0.02,
  keepShare: 0.0015,
  fitFar: [1, 2, 4],
  fitPasses: 16,
  backPower: 4,
  homeBars: 1,
  tiltShares: [0.25, 0.5, 0.75, 1],
  tiltPasses: 6,
}

const L = config.live
const RAD = Math.PI / 180
const BASE_R = config.globe.baseDiameterMm / 2
/** The foot the eye reads: the base and what the season heaps on the surface in front of it (winter's snow reaches furthest). */
const FOOT_R = BASE_R + FRAME.heapMm

export const livePath = (n: number): ShakePath => makeShake(`live-${((n % FRAME.shakePaths) + FRAME.shakePaths) % FRAME.shakePaths}`)

export function edges(rig: Rig): { top: number; foot: number; heap: number } {
  const p = rig.pitchDeg * RAD
  const t = Math.tan((rig.fovDeg * RAD) / 2)
  const up = sphereCentreHeightMm - rig.aimHeightMm
  const depth = rig.distanceMm - up * Math.sin(p)
  const height = up * Math.cos(p)
  const top = Math.tan(Math.atan2(height, depth) + Math.asin(sphereRadiusMm / Math.hypot(depth, height))) / t
  const at = (r: number): number => (-rig.aimHeightMm * Math.cos(p) - r * Math.sin(p)) / (rig.distanceMm + rig.aimHeightMm * Math.sin(p) - r * Math.cos(p)) / t
  return { top, foot: at(BASE_R), heap: at(FOOT_R) }
}

export const margins = (rig: Rig): { over: number; under: number } => {
  const e = edges(rig)
  return { over: (1 - e.top) / 2, under: (1 + e.foot) / 2 }
}

/** How far the base reaches to either side, in half heights of the frame, from a rig that looks from the front:
 * the widest any season builds it (fall's, with the pumpkin at its foot), since one framing holds all four. */
export const baseSide = (rig: Rig): number => {
  const p = rig.pitchDeg * RAD
  const t = Math.tan((rig.fovDeg * RAD) / 2)
  let most = 0
  for (const y of [0, config.globe.baseHeightMm]) most = Math.max(most, FRAME.baseReachMm / (rig.distanceMm - (y - rig.aimHeightMm) * Math.sin(p)) / t)
  return most
}

const clearOf = (aspect: number): number => (aspect < FRAME.narrowAspect ? FRAME.thumbShare : FRAME.clearShare)

const aimForFoot = (rig: Rig, foot: number): number => {
  const p = rig.pitchDeg * RAD
  const y = foot * Math.tan((rig.fovDeg * RAD) / 2)
  return -(y * (rig.distanceMm - FOOT_R * Math.cos(p)) + FOOT_R * Math.sin(p)) / (Math.cos(p) + y * Math.sin(p))
}

/** How much higher the camera aims to carry the globe `by` half heights of the frame down the screen. */
const sink = (rig: Rig, by: number): number => {
  const p = rig.pitchDeg * RAD
  return (by * Math.tan((rig.fovDeg * RAD) / 2) * (rig.distanceMm - (sphereCentreHeightMm - rig.aimHeightMm) * Math.sin(p))) / Math.cos(p)
}

/** The lowest the camera may aim before the lowest corners of the frame look past the near edge of the table:
 * they meet the table `tableKeepMm` inside that edge, measured from the globe's axis, so it holds however the camera is turned. */
const aimForTable = (rig: Rig, aspect: number): number => {
  const p = rig.pitchDeg * RAD
  const t = Math.tan((rig.fovDeg * RAD) / 2)
  const z = rig.distanceMm * Math.cos(p)
  const r = SLAB_SHAPE.nearMm - FRAME.tableKeepMm
  if (z <= r) return -Infinity
  const fall = Math.cos(p) - t * Math.sin(p)
  const wide = aspect * t
  const q = wide * wide + fall * fall
  const k = (z * fall - Math.sqrt(Math.max(0, z * z * fall * fall - q * (z * z - r * r)))) / q
  return k * (Math.sin(p) + t * Math.cos(p)) - rig.distanceMm * Math.sin(p)
}

/** The share of the height the foot keeps free under it: the controls, measured, or a bar of the usual height until they are
 * (on a short screen, a phone held sideways, a bar of `barMost` of the height, which is what its row measures),
 * and over them `clearShare` of the height, or `thumbShare` on a narrow upright screen, where the controls stay within reach of a thumb. */
export const roomUnder = (heightPx: number, controlsPx: number | null = null, widthPx: number | null = null): number => {
  const h = Math.max(1, heightPx)
  const bar = controlsPx === null ? Math.min(Math.max(FRAME.barShare * h, FRAME.barPx), FRAME.barMost * h) : controlsPx
  const clear = widthPx !== null ? clearOf(widthPx / h) : FRAME.clearShare
  return Math.min(FRAME.mostUnder, bar / h + clear)
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

const moved = (g: GlobePose, x: number, y: number): Centre => {
  const ax = x * Math.cos(g.tiltZ) - y * Math.sin(g.tiltZ)
  const ay = x * Math.sin(g.tiltZ) + y * Math.cos(g.tiltZ)
  return [ax + g.x, ay * Math.cos(g.tiltX) + g.y, ay * Math.sin(g.tiltX) + g.z]
}

const centreOf = (g: GlobePose): Centre => moved(g, 0, sphereCentreHeightMm)

/** The ends of the widest base, low and high, where a shaken globe carries them. */
const endsOf = (g: GlobePose): Centre[] => [-1, 1].flatMap((side) => [0, config.globe.baseHeightMm].map((y) => moved(g, side * FRAME.baseReachMm, y)))

const reach = (rig: Rig, centres: readonly Centre[], sideways: boolean, least: number, round = sphereRadiusMm): number => {
  const p = rig.pitchDeg * RAD
  const cp = Math.cos(p)
  const sp = Math.sin(p)
  let most = least
  for (const c of centres) {
    const y = c[1] - rig.aimHeightMm
    const off = sideways ? Math.abs(c[0]) : y * cp - c[2] * sp
    const depth = rig.distanceMm - y * sp - c[2] * cp
    const v = Math.tan(Math.atan2(off, depth) + Math.asin(Math.min(1, round / Math.hypot(off, depth))))
    if (v > most) most = v
  }
  return most / Math.tan((rig.fovDeg * RAD) / 2)
}

/** How far the glass reaches up and to either side, in half heights of the frame, seen from a rig that looks from the front. */
const glass = (rig: Rig, c: Centre): { top: number; side: number } => ({ top: reach(rig, [c], false, -Infinity), side: reach(rig, [c], true, 0) })

const REST: Centre = centreOf(REST_POSE)
const sideOfEnds = (rig: Rig, ends: readonly Centre[]): number => reach(rig, ends, true, 0, 0)

type Shaken = { high: Centre[]; wide: Centre[]; ends: Centre[] }
let shaken: Shaken | null = null

/** The places of the glass, and of the ends of the widest base, over every shake the app plays, that can reach furthest up or furthest to a side. */
export function shakenCentres(): Shaken {
  if (shaken) return shaken
  const bar = config.film.beatsPerBar
  const hero = rigOf(MOVES.wide)
  const rigs = FRAME.fitFar.map((far) => ({ ...hero, yawDeg: 0, distanceMm: hero.distanceMm * far }))
  const near = <T>(samples: readonly T[], seen: (rig: Rig, s: T) => number, share: number, pitches: readonly number[] = [hero.pitchDeg]): Set<number> => {
    const kept = new Set<number>()
    for (const pitchDeg of pitches) {
      rigs.forEach((level, r) => {
        const rig = { ...level, pitchDeg }
        const all = samples.map((s) => seen(rig, s))
        const most = all.reduce((m, v) => Math.max(m, v), -Infinity)
        all.forEach((v, i) => {
          if (v >= most - share / FRAME.fitFar[r]!) kept.add(i)
        })
      })
    }
    return kept
  }
  // A view tilted up turns a push away from the camera into a rise on the screen, so the highest moments differ with the tilt.
  const tilts = [hero.pitchDeg, L.orbitPitchMinDeg, ...FRAME.tiltShares.map((v) => hero.pitchDeg + v * (L.orbitPitchMaxDeg - hero.pitchDeg))]
  const top = (rig: Rig, c: Centre): number => glass(rig, c).top
  const side = (rig: Rig, c: Centre): number => glass(rig, c).side
  const out: Shaken = { high: [], wide: [], ends: [] }
  const once = new Set<string>()
  for (let n = 0; n < FRAME.shakePaths; n++) {
    const path = livePath(n)
    const beats: number[] = []
    for (let i = 0; i * FRAME.pathStepBeats <= bar + 1e-9; i++) beats.push(i * FRAME.pathStepBeats)
    const poses = beats.map((b) => path.poseAt(b))
    const grid = poses.map(centreOf)
    const fine = (kept: Set<number>): GlobePose[] => {
      const at = new Set<number>()
      for (const i of kept) for (let j = -FRAME.pathFine; j <= FRAME.pathFine; j++) at.add(i * FRAME.pathFine + j)
      return [...at].map((q) => path.poseAt((q * FRAME.pathStepBeats) / FRAME.pathFine))
    }
    for (const i of near(grid, top, FRAME.keepShare, tilts)) {
      const key = grid[i]!.map((v) => v.toFixed(2)).join()
      if (!once.has(key)) out.high.push(grid[i]!)
      once.add(key)
    }
    const wide = fine(near(grid, side, FRAME.nearShare)).map(centreOf)
    out.wide.push(...[...near(wide, side, FRAME.keepShare)].map((i) => wide[i]!))
    const ends = fine(near(poses.map(endsOf), sideOfEnds, FRAME.nearShare)).map(endsOf)
    out.ends.push(...[...near(ends, sideOfEnds, FRAME.keepShare)].flatMap((i) => ends[i]!))
  }
  shaken = out
  return out
}

const REST_ONLY = [REST]
const topOf = (rig: Rig): number => reach(rig, shakenCentres().high, false, reach(rig, REST_ONLY, false, -Infinity) * Math.tan((rig.fovDeg * RAD) / 2))
const sideOf = (rig: Rig): number => reach(rig, shakenCentres().wide, true, 0)

/** The furthest the glass reaches through a shake from a rig that looks from the front: up, and to a side. */
export const shakeReach = (rig: Rig): { top: number; side: number } => ({ top: topOf(rig), side: sideOf(rig) })

/** The furthest the whole globe reaches to a side through a shake, the glass or the widest base, from a rig that looks from the front. */
export const shakeSide = (rig: Rig): number => Math.max(sideOf(rig), sideOfEnds(rig, shakenCentres().ends))

const lowOf = (under: number): number => -1 + 2 * Math.min(Math.max(under, 0), FRAME.mostUnder)

let fitted: { aspect: number; under: number; rig: Rig; far: Rig } | null = null

/** The camera of the app: the wide camera moved back along its own axis and aimed so that the lifted glass stays under
 * the top edge, the foot stays over the controls, a wide screen holds the strokes between its sides and an upright screen
 * holds the whole globe at rest, glass and base, between its sides. It stands as near as those allow.
 * Where an upright screen leaves room over and under the globe, the room over the glass is `overUnder` times the room
 * between the foot and the highest control.
 * `farMm` is how far the same camera stands for the bar of a shake: the nearest that holds every stroke, glass and widest
 * base, between the sides. On a wide screen that is where it stands at rest; on an upright one it is further. */
function fit(aspect: number, under: number): { rig: Rig; far: Rig } {
  if (fitted && fitted.aspect === aspect && fitted.under === under) return fitted
  const wide = rigOf(MOVES.wide)
  const rig = { ...wide, yawDeg: 0 }
  const k = 2 * Math.tan((rig.fovDeg * RAD) / 2)
  const a = Math.max(aspect, FRAME.leastAspect)
  const low = lowOf(under)
  const high = 1 - 2 * FRAME.edgeShare
  const across = a * (1 - 2 * FRAME.edgeShare)
  for (let i = 0; i < FRAME.fitPasses; i++) {
    const floor = aimForFoot(rig, low)
    rig.aimHeightMm = floor
    const tall = (topOf(rig) - low) / (high - low)
    if (a >= 1) rig.aimHeightMm = Math.min(floor, wide.aimHeightMm - FRAME.underShare * k * (rig.distanceMm - wide.distanceMm))
    else {
      const controls = low - 2 * clearOf(a)
      for (let j = 0; j < 6; j++) {
        const e = edges(rig)
        const rise = (FRAME.overUnder * (e.foot - controls) - (1 - e.top)) / (1 + FRAME.overUnder)
        rig.aimHeightMm = Math.min(floor, rig.aimHeightMm + sink(rig, rise))
      }
    }
    for (let j = 0; j < 4; j++) {
      const over = topOf(rig) - high
      if (over <= 0) break
      rig.aimHeightMm = Math.min(floor, rig.aimHeightMm + sink(rig, over))
    }
    rig.aimHeightMm = Math.min(floor, Math.max(rig.aimHeightMm, aimForTable(rig, a)))
    const broad = (a >= 1 ? sideOf(rig) : Math.max(glass(rig, REST).side, baseSide(rig))) / across
    const next = Math.max(wide.distanceMm, rig.distanceMm * Math.max(tall, broad))
    if (Math.abs(next - rig.distanceMm) < 1e-7) break
    rig.distanceMm = next
  }
  const far = { ...rig }
  for (let i = 0; i < FRAME.fitPasses; i++) {
    far.aimHeightMm = Math.min(aimForFoot(far, low), Math.max(rig.aimHeightMm, aimForTable(far, a)))
    const next = Math.max(rig.distanceMm, (far.distanceMm * shakeSide(far)) / across)
    if (Math.abs(next - far.distanceMm) < 1e-7) break
    far.distanceMm = next
  }
  fitted = { aspect, under, rig, far }
  return fitted
}

export interface Shaking {
  beat: number | null
  sinceLanding: number
}

/** The way back over the lift: it leaves from standing, covers most of the way early, because the hand tips the globe
 * outward on the first frames of its grip, and arrives without a stop. */
const leave = (v: number): number => {
  const u = v <= 0 ? 0 : v >= 1 ? 1 : v
  return 1 - Math.pow(1 - u, FRAME.backPower) * (1 + FRAME.backPower * u)
}

/** How far the camera stands back, 0 at rest and 1 where the whole shake fits: it goes back with the lift and comes home
 * over `homeBars` after the landing. A shake asked while it still comes home takes it back from where it is, with no step. */
export function standBack(at: Shaking | null = null): number {
  if (!at) return 0
  const out = at.beat === null ? 0 : leave(at.beat / config.shake.liftBeats)
  const home = 1 - smoother(Math.max(0, at.sinceLanding) / (FRAME.homeBars * config.film.beatsPerBar * beatSeconds))
  return 1 - (1 - out) * (1 - home)
}

let tilted: { from: Rig; low: number; distanceMm: number; aimHeightMm: number } | null = null

/** A tilted view kept to the room the level one has, between the line over the controls and the margin under the top edge.
 * A view tilted up opens the foot of the globe downward and throws a shaken globe higher on the screen. The camera keeps
 * its aim wherever that holds the globe between the two; else it carries the globe up as far as the line or down as far
 * as the margin; and where the tilted globe is taller than the room, it stands back with the heap on the line. */
function holdTilted(rig: Rig, low: number): void {
  const from = tilted?.from
  if (tilted && from && tilted.low === low && from.pitchDeg === rig.pitchDeg && from.distanceMm === rig.distanceMm && from.aimHeightMm === rig.aimHeightMm) {
    rig.distanceMm = tilted.distanceMm
    rig.aimHeightMm = tilted.aimHeightMm
    return
  }
  const asked = { ...rig }
  const high = 1 - 2 * FRAME.edgeShare
  const floor = aimForFoot(rig, low)
  rig.aimHeightMm = Math.min(rig.aimHeightMm, floor)
  let top = topOf(rig)
  for (let i = 0; i < FRAME.tiltPasses && top > high && rig.aimHeightMm < floor; i++) {
    rig.aimHeightMm = Math.min(floor, rig.aimHeightMm + sink(rig, top - high))
    top = topOf(rig)
  }
  if (rig.aimHeightMm >= floor) {
    for (let i = 0; i < FRAME.tiltPasses; i++) {
      const next = Math.max(asked.distanceMm, (rig.distanceMm * (top - low)) / (high - low))
      if (Math.abs(next - rig.distanceMm) < 1e-7) break
      rig.distanceMm = next
      rig.aimHeightMm = aimForFoot(rig, low)
      top = topOf(rig)
    }
  }
  tilted = { from: asked, low, distanceMm: rig.distanceMm, aimHeightMm: rig.aimHeightMm }
}

/** The app's camera at one moment: the fitted camera, stood back for a shake, turned and tilted as the visitor holds it,
 * and held to the room the level view has (`holdTilted`). */
export function liveRig(aspect: number, yawDeg = 0, pitchDeg = 0, under = 0, at: Shaking | null = null): Rig {
  const base = rigOf(MOVES.wide)
  const held = fit(aspect, under)
  const rig = { ...held.rig }
  const span = held.far.distanceMm - rig.distanceMm
  const back = standBack(at)
  if (span > 0 && back > 0) {
    rig.distanceMm *= Math.pow(held.far.distanceMm / rig.distanceMm, back)
    rig.aimHeightMm += ((held.far.aimHeightMm - rig.aimHeightMm) * (rig.distanceMm - held.rig.distanceMm)) / span
  }
  rig.yawDeg = Math.max(-L.orbitYawDeg, Math.min(L.orbitYawDeg, base.yawDeg + (aspect < FRAME.narrowAspect ? FRAME.narrowYawDeg : 0) + yawDeg))
  const low = lowOf(under)
  rig.pitchDeg = Math.max(L.orbitPitchMinDeg, Math.min(L.orbitPitchMaxDeg, rig.pitchDeg + pitchDeg))
  if (rig.pitchDeg !== held.rig.pitchDeg) holdTilted(rig, low)
  rig.aimHeightMm = Math.max(rig.aimHeightMm, Math.min(aimForFoot(rig, low), aimForTable(rig, Math.max(aspect, FRAME.leastAspect))))
  return rig
}

export const livePose = (aspect: number, yawDeg = 0, pitchDeg = 0, under = 0, at: Shaking | null = null): Pose => poseOfRig(liveRig(aspect, yawDeg, pitchDeg, under, at))

/** The framing numbers of `framingOf`, for a rig that no camera of the config names: the app's own. */
export function framingOfRig(rig: Rig, width: number, height: number): Framing {
  const yaw = rig.yawDeg * RAD
  const pitch = rig.pitchDeg * RAD
  const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)] as const
  const pos = [dir[0] * rig.distanceMm, rig.aimHeightMm + dir[1] * rig.distanceMm, dir[2] * rig.distanceMm] as const
  const rl = Math.hypot(dir[2], dir[0])
  const right = [dir[2] / rl, 0, -dir[0] / rl] as const
  const up = [right[2] * dir[1], right[0] * dir[2] - right[2] * dir[0], -right[0] * dir[1]] as const
  const tanHalf = Math.tan((rig.fovDeg * RAD) / 2)
  const f = height / 2 / tanHalf
  const project = (x: number, y: number, z: number): [number, number, number] => {
    const vx = x - pos[0]
    const vy = y - pos[1]
    const vz = z - pos[2]
    const depth = -(vx * dir[0] + vy * dir[1] + vz * dir[2])
    return [width / 2 + (f * (vx * right[0] + vz * right[2])) / depth, height / 2 - (f * (vx * up[0] + vy * up[1] + vz * up[2])) / depth, depth]
  }
  const [cx, cy, cz] = project(0, sphereCentreHeightMm, 0)
  const d = Math.hypot(pos[0], sphereCentreHeightMm - pos[1], pos[2])
  const r = (f * sphereRadiusMm) / Math.sqrt(d * d - sphereRadiusMm * sphereRadiusMm)
  const base = { left: Infinity, right: -Infinity, top: Infinity, foot: -Infinity }
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2 - yaw
    for (const y of [0, config.globe.baseHeightMm]) {
      const [x, py] = project(Math.cos(a) * BASE_R, y, Math.sin(a) * BASE_R)
      base.left = Math.min(base.left, x)
      base.right = Math.max(base.right, x)
      if (y > 0) base.top = Math.min(base.top, py)
      else base.foot = Math.max(base.foot, py)
    }
  }
  const frameHeightMm = 2 * rig.distanceMm * tanHalf
  const frameWidthMm = (frameHeightMm * width) / height
  const planeH = 2 * cz * tanHalf
  const planeW = (planeH * width) / height
  const ox = ((cx - width / 2) / width) * planeW
  const oy = ((cy - height / 2) / height) * planeH
  let cornerReachMm = 0
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) cornerReachMm = Math.max(cornerReachMm, Math.hypot((sx * planeW) / 2 - ox, (sy * planeH) / 2 - oy))
  return { globe: { cx, cy, r }, base, frameHeightMm, frameWidthMm, heroFill: globeTopMm / frameHeightMm, cornerReachMm }
}
