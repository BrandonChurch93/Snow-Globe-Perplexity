import { cameraById, config } from '../config'
import { poseById, poseOf, type Pose } from '../scene/cameras'
import { globeTopMm, sphereCentreHeightMm, sphereRadiusMm } from '../scene/framing'
import { centreHeightMm, groundY, innerRadiusMm, shapePoints, shapes } from '../scene/layout'
import { REST_POSE, makeShake, type GlobePose } from '../shake/table'
import type { CameraKey, Cut } from './cut'
import { barSeconds, beatSeconds, type ShotSpan } from './timeline'

export interface Rig {
  fovDeg: number
  distanceMm: number
  yawDeg: number
  pitchDeg: number
  aimHeightMm: number
  apertureMm: number
  focusShiftMm: number
}

export const MOVES = {
  wide: 'hero',
  close: 'macro',
  details: ['base', 'interior', 'low'],
  pullBars: 2,
  pullStartSpeed: 0.55,
  driftYawDeg: 2.6,
  driftPitchDeg: 0.5,
  backBeats: 1,
  detailStartBars: 0.75,
  detailTravel: 0.45,
  detailReach: { base: 0.55, interior: 1, low: 1 } as Record<string, number>,
  detailKeep: { base: ['foot', 'ridge'], interior: ['ground', 'ridge'], low: ['foot', 'dome'] } as Record<string, [keyof Room, keyof Room]>,
  detailRoom: { base: 0.06, interior: 0, low: 0 } as Record<string, number>,
  detailGrid: 0.05,
  sweepYawDeg: 1.6,
  settleBars: 1,
  closeHoldBars: 1,
  holdAimDropMm: 4.5,
  holdAimBars: 1,
  breathYawDeg: 0.18,
  breathPitchDeg: 0.07,
  breathYawSeconds: 7.3,
  breathPitchSeconds: 5.1,
  loopYawDeg: 1.2,
  loopPitchDeg: 0.3,
  loopCropMargin: 0.03,
}

const TAU = Math.PI * 2
const RAD = Math.PI / 180
const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v)
export const smoother = (v: number): number => {
  const u = clamp01(v)
  return u * u * u * (u * (u * 6 - 15) + 10)
}
export const pullCurve = (v: number, speed: number): number => {
  const u = clamp01(v)
  return smoother(u) + speed * u * (1 - u) * (1 - u) * (1 - u) * (1 + 3 * u)
}

export function rigOf(id: string): Rig {
  const c = cameraById(id)
  const p = poseById(id)
  return { fovDeg: c.fovDeg, distanceMm: c.distanceMm, yawDeg: c.yawDeg, pitchDeg: c.pitchDeg, aimHeightMm: c.aimHeightMm, apertureMm: p.apertureMm, focusShiftMm: p.focusMm - c.distanceMm }
}

export const poseOfRig = (r: Rig): Pose => poseOf(r, { apertureMm: r.apertureMm, focusShiftMm: r.focusShiftMm })

export function mixRig(a: Rig, b: Rig, w: number): Rig {
  if (w <= 0) return { ...a }
  if (w >= 1) return { ...b }
  const l = (x: number, y: number) => x + (y - x) * w
  return {
    fovDeg: l(a.fovDeg, b.fovDeg),
    distanceMm: a.distanceMm * Math.pow(b.distanceMm / a.distanceMm, w),
    yawDeg: l(a.yawDeg, b.yawDeg),
    pitchDeg: l(a.pitchDeg, b.pitchDeg),
    aimHeightMm: l(a.aimHeightMm, b.aimHeightMm),
    apertureMm: l(a.apertureMm, b.apertureMm),
    focusShiftMm: l(a.focusShiftMm, b.focusShiftMm),
  }
}

export type Role = 'open' | 'detail' | 'close' | 'shake' | 'plain'

export interface Move {
  span: ShotSpan
  role: Role
  camera: string
  start: number
  end: number
  from: number
  to: number
  back: number
}

const plans = new WeakMap<Cut, Move[]>()

export function barTime(cut: Cut, bars: number): number {
  const last = cut.lines.length - 1
  const x = Math.max(0, Math.min(last, bars))
  const i = Math.min(last - 1, Math.floor(x))
  return cut.lines[i]! + (x - i) * (cut.lines[i + 1]! - cut.lines[i]!)
}

export function movesOf(cut: Cut): Move[] {
  const had = plans.get(cut)
  if (had) return had
  const holds = cut.spans.filter((s) => s.shot.kind === 'hold')
  const beats = config.film.beatsPerBar
  let detail = 0
  const out = cut.spans.map((span, i): Move => {
    const start = cut.lines[span.firstBar]!
    const end = cut.lines[span.firstBar + span.bars]!
    const next = cut.spans[i + 1]
    const lastBar = end - cut.lines[span.firstBar + span.bars - 1]!
    const back = next && next.shot.kind === 'shake' ? end - (lastBar / beats) * MOVES.backBeats : end
    if (span.shot.kind === 'shake') return { span, role: 'shake', camera: MOVES.wide, start, end, from: start, to: end, back: end }
    if (span === holds[0] && i === 0) return { span, role: 'open', camera: MOVES.close, start, end, from: start, to: Math.min(barTime(cut, span.firstBar + MOVES.pullBars), (start + back) / 2), back }
    if (span === holds.at(-1) && i === cut.spans.length - 1) {
      const settle = barTime(cut, span.firstBar + Math.min(MOVES.settleBars, span.bars / 4))
      return { span, role: 'close', camera: MOVES.close, start, end, from: settle, to: barTime(cut, span.firstBar + span.bars - Math.min(MOVES.closeHoldBars, span.bars / 4)), back: end }
    }
    if (!MOVES.details.length) return { span, role: 'plain', camera: MOVES.wide, start, end, from: start, to: back, back }
    const camera = MOVES.details[detail++ % MOVES.details.length]!
    return { span, role: 'detail', camera, start, end, from: barTime(cut, span.firstBar + Math.min(MOVES.detailStartBars, span.bars / 4)), to: back, back }
  })
  plans.set(cut, out)
  return out
}

export function moveAt(cut: Cut, t: number): Move {
  const all = movesOf(cut)
  for (const m of all) if (t < m.end) return m
  return all.at(-1)!
}

export function aimDropAt(move: Move, t: number, away: number): number {
  if (move.role === 'shake') return 0
  const from = move.role === 'open' ? move.to : move.start
  const room = move.back - from
  if (room <= 0) return 0
  const ramp = Math.min(((move.end - move.start) / move.span.bars) * MOVES.holdAimBars, room / 2)
  return MOVES.holdAimDropMm * (1 - clamp01(away)) * smoother((t - from) / ramp) * smoother((move.back - t) / ramp)
}

export function breathAt(cut: Cut, t: number): number {
  const end = cut.lines.at(-1)!
  const firstBar = cut.lines[1]! - cut.lines[0]!
  const lastBar = end - cut.lines.at(-2)!
  let env = smoother(t / firstBar) * smoother((end - 1 / cut.fps - t) / lastBar)
  for (const s of cut.shakes) {
    const beat = s.seconds / config.film.beatsPerBar
    if (t >= s.startSec && t < s.endSec) return 0
    env *= t < s.startSec ? smoother((s.startSec - t) / beat) : smoother((t - s.endSec) / (2 * beat))
  }
  return env
}

export const detailReach = (camera: string): number => clamp01(MOVES.detailReach[camera] ?? 1)
export const detailKeep = (camera: string): [keyof Room, keyof Room] => MOVES.detailKeep[camera] ?? ['foot', 'ridge']
export const detailRoom = (camera: string): number => MOVES.detailRoom[camera] ?? 0

const aims = new Map<string, number>()

/** How far a detail move that stops short lowers its aim at the nearest point, beyond the mix, so the two things it keeps, one low and one high, have the same room. Nothing for a move that goes the whole way. */
export function nearestAimDropMm(camera: string, reach = detailReach(camera)): number {
  const r = clamp01(reach)
  if (r >= 1) return 0
  const key = `${camera}:${r}`
  const had = aims.get(key)
  if (had !== undefined) return had
  const [under, over] = detailKeep(camera)
  const rig = mixRig(rigOf(MOVES.wide), rigOf(camera), r)
  rig.aimHeightMm -= MOVES.holdAimDropMm * (1 - r)
  let lo = -globeTopMm
  let hi = globeTopMm
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const room = roomOf(poseOfRig({ ...rig, aimHeightMm: rig.aimHeightMm - mid }))
    if (room[under] < room[over]) lo = mid
    else hi = mid
  }
  const drop = Math.round(((lo + hi) / 2) * 100) / 100
  aims.set(key, drop)
  return drop
}

/** The camera of a detail move where it is nearest to its detail camera: `reach` of the way from the wide camera, with what is left of the hold's lowered aim. */
export function nearestRig(camera: string, reach = detailReach(camera)): Rig {
  const r = clamp01(reach)
  const rig = mixRig(rigOf(MOVES.wide), rigOf(camera), r)
  rig.aimHeightMm -= MOVES.holdAimDropMm * (1 - r) + nearestAimDropMm(camera, r)
  return rig
}

export interface Room {
  foot: number
  ground: number
  ridge: number
  dome: number
  side: number
}

const GROUND_R = Math.sqrt(Math.max(0, innerRadiusMm * innerRadiusMm - groundY * groundY))
const RIDGE = shapes.filter((s) => s.role === 'roof').flatMap(shapePoints)
const HOUSE = shapes.filter((s) => s.role === 'cottage' || s.role === 'roof' || s.role === 'trunk').flatMap(shapePoints)

/** The room left around what a detail move must keep, through the real pose, as shares of the frame's height: under the foot of the base, under the ground of the miniature, over the cottage's ridge and over the top of the glass.
 * `side` is the least room beside the cottage and the trunk, as a share of the frame's width at `aspect`. Under 0 is outside the frame. */
export function roomOf(pose: Pose, aspect = 16 / 9): Room {
  const ex = pose.position.x
  const ey = pose.position.y
  const ez = pose.position.z
  let fx = pose.aim.x - ex
  let fy = pose.aim.y - ey
  let fz = pose.aim.z - ez
  const fl = Math.hypot(fx, fy, fz)
  fx /= fl
  fy /= fl
  fz /= fl
  const rl = Math.hypot(fz, fx)
  const rx = -fz / rl
  const rz = fx / rl
  const ux = -rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy
  const k = Math.tan((pose.fovDeg * RAD) / 2)
  const seen = (x: number, y: number, z: number): [number, number] => {
    const wx = x - ex
    const wy = y - ey
    const wz = z - ez
    const depth = (wx * fx + wy * fy + wz * fz) * k
    return [(wx * rx + wz * rz) / depth, (wx * ux + wy * uy + wz * uz) / depth]
  }
  const half = config.globe.baseDiameterMm / 2
  let foot = -Infinity
  let ground = -Infinity
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU
    foot = Math.max(foot, -seen(Math.cos(a) * half, 0, Math.sin(a) * half)[1])
    ground = Math.max(ground, -seen(Math.cos(a) * GROUND_R, config.globe.islandLevelMm, Math.sin(a) * GROUND_R)[1])
  }
  let ridge = -Infinity
  for (const p of RIDGE) ridge = Math.max(ridge, seen(p[0], p[1] + centreHeightMm, p[2])[1])
  let side = 0
  for (const p of HOUSE) side = Math.max(side, Math.abs(seen(p[0], p[1] + centreHeightMm, p[2])[0]))
  const c = seen(0, sphereCentreHeightMm, 0)
  const depth = Math.hypot(ex, ey - sphereCentreHeightMm, ez)
  const dome = Math.tan(Math.atan(c[1] * k) + Math.asin(Math.min(1, sphereRadiusMm / depth))) / k
  return { foot: (1 - foot) / 2, ground: (1 - ground) / 2, ridge: (1 - ridge) / 2, dome: (1 - dome) / 2, side: (aspect - side) / (2 * aspect) }
}

/** The least room at the nearest point of a detail move, over the sweep and the breath that play on it. */
export function nearestRoom(camera: string, reach = detailReach(camera)): Room {
  const rig = nearestRig(camera, reach)
  const a = MOVES.detailTravel
  const yaw = MOVES.breathYawDeg + Math.abs(MOVES.sweepYawDeg * (2 * a - 1) * Math.sin(Math.PI * a))
  const out: Room = { foot: Infinity, ground: Infinity, ridge: Infinity, dome: Infinity, side: Infinity }
  for (const y of [-yaw, 0, yaw]) {
    for (const p of [-MOVES.breathPitchDeg, 0, MOVES.breathPitchDeg]) {
      const r = roomOf(poseOfRig({ ...rig, yawDeg: rig.yawDeg + y, pitchDeg: rig.pitchDeg + p }))
      out.foot = Math.min(out.foot, r.foot)
      out.ground = Math.min(out.ground, r.ground)
      out.ridge = Math.min(out.ridge, r.ridge)
      out.dome = Math.min(out.dome, r.dome)
      out.side = Math.min(out.side, r.side)
    }
  }
  return out
}

/** The largest share of the way to a detail camera, on the grid, that leaves its `detailRoom` around the two things the move keeps in the frame. */
export function largestReach(camera: string): number {
  const steps = Math.round(1 / MOVES.detailGrid)
  const [under, over] = detailKeep(camera)
  for (let i = steps; i > 0; i--) {
    const r = nearestRoom(camera, i / steps)
    if (r[under] >= detailRoom(camera) && r[over] >= detailRoom(camera)) return i / steps
  }
  return 0
}

export function filmRig(cut: Cut, t: number): { rig: Rig; move: Move } {
  const move = moveAt(cut, t)
  const wide = rigOf(MOVES.wide)
  let rig: Rig
  let away = 0
  if (move.role === 'open') {
    if (t < move.to) rig = mixRig(rigOf(move.camera), wide, pullCurve((t - move.from) / (move.to - move.from), MOVES.pullStartSpeed))
    else {
      const v = clamp01((t - move.to) / (move.back - move.to))
      const arc = Math.sin(Math.PI * v) ** 2
      rig = { ...wide, yawDeg: wide.yawDeg + MOVES.driftYawDeg * arc, pitchDeg: wide.pitchDeg + MOVES.driftPitchDeg * arc * Math.sin(TAU * v) }
    }
  } else if (move.role === 'detail') {
    const v = clamp01((t - move.from) / (move.to - move.from))
    const a = MOVES.detailTravel
    const near = v < a ? smoother(v / a) : v > 1 - a ? smoother((1 - v) / a) : 1
    away = detailReach(move.camera) * near
    rig = mixRig(wide, rigOf(move.camera), away)
    rig.aimHeightMm -= nearestAimDropMm(move.camera) * near
    rig.yawDeg += MOVES.sweepYawDeg * (2 * v - 1) * Math.sin(Math.PI * v)
  } else if (move.role === 'close') {
    away = smoother((t - move.from) / (move.to - move.from))
    rig = mixRig(wide, rigOf(move.camera), away)
  } else if (move.role === 'plain') {
    const v = clamp01((t - move.from) / (move.to - move.from))
    rig = { ...wide, yawDeg: wide.yawDeg + MOVES.driftYawDeg * Math.sin(Math.PI * v) ** 2 }
  } else rig = { ...wide }
  rig.aimHeightMm -= aimDropAt(move, t, away)
  const breath = breathAt(cut, t)
  if (breath > 0) {
    rig.yawDeg += breath * MOVES.breathYawDeg * Math.sin((TAU * t) / MOVES.breathYawSeconds + 1.3)
    rig.pitchDeg += breath * MOVES.breathPitchDeg * Math.sin((TAU * t) / MOVES.breathPitchSeconds + 0.4)
  }
  return { rig, move }
}

export const filmPose = (cut: Cut, t: number): Pose => poseOfRig(filmRig(cut, t).rig)

/** How far the glass and the base reach from the middle of the frame, in half heights of the frame: to either side, up and down.
 * A centred square crop ends at 1 to the side, a centred 4:3 crop at 4/3. */
export function reachOf(pose: Pose, g: GlobePose): { side: number; top: number; foot: number } {
  const ex = pose.position.x
  const ey = pose.position.y
  const ez = pose.position.z
  let fx = pose.aim.x - ex
  let fy = pose.aim.y - ey
  let fz = pose.aim.z - ez
  const fl = Math.hypot(fx, fy, fz)
  fx /= fl
  fy /= fl
  fz /= fl
  const rl = Math.hypot(fz, fx)
  const rx = -fz / rl
  const rz = fx / rl
  const ux = -rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy
  const k = Math.tan((pose.fovDeg * RAD) / 2)
  const cz = Math.cos(g.tiltZ)
  const sz = Math.sin(g.tiltZ)
  const cx = Math.cos(g.tiltX)
  const sx = Math.sin(g.tiltX)
  const seen = (x: number, y: number, z: number): [number, number, number] => {
    const ax = x * cz - y * sz
    const ay = x * sz + y * cz
    const wx = ax + g.x - ex
    const wy = ay * cx - z * sx + g.y - ey
    const wz = ay * sx + z * cx + g.z - ez
    return [wx * rx + wz * rz, wx * ux + wy * uy + wz * uz, wx * fx + wy * fy + wz * fz]
  }
  const c = seen(0, sphereCentreHeightMm, 0)
  const round = (off: number, depth: number): number => Math.asin(Math.min(1, sphereRadiusMm / Math.hypot(off, depth)))
  let side = Math.tan(Math.abs(Math.atan2(c[0], c[2])) + round(c[0], c[2])) / k
  let top = Math.tan(Math.atan2(c[1], c[2]) + round(c[1], c[2])) / k
  let foot = Math.tan(round(c[1], c[2]) - Math.atan2(c[1], c[2])) / k
  const half = config.globe.baseDiameterMm / 2
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU
    for (const y of [0, config.globe.baseHeightMm]) {
      const b = seen(Math.cos(a) * half, y, Math.sin(a) * half)
      side = Math.max(side, Math.abs(b[0] / b[2]) / k)
      top = Math.max(top, b[1] / b[2] / k)
      foot = Math.max(foot, -b[1] / b[2] / k)
    }
  }
  return { side, top, foot }
}

let cardDistance: number | null = null

/** The card is cropped to a centred 4:3 or to a centred square, so the loop's camera is the config's camera moved back along its own axis,
 * by the least that keeps the glass and the base inside the square, and inside the frame, on every frame of the loop's shake.
 * It stands there for the whole loop: the first frame is the card's still. */
export function loopDistanceMm(): number {
  if (cardDistance !== null) return cardDistance
  const rig = rigOf(config.deliver.cardLoop.camera)
  const path = makeShake('loop')
  const fps = config.film.fps
  const shaken: GlobePose[] = []
  for (let i = 0; i < Math.round(barSeconds * fps); i++) shaken.push(path.poseAt(i / fps / beatSeconds))
  const drift = [-1, 1].flatMap((y) => [-1, 1].map((p) => [y * MOVES.loopYawDeg, p * MOVES.loopPitchDeg] as const))
  const most = (distanceMm: number): number => {
    const at = { ...rig, distanceMm }
    const locked = poseOfRig(at)
    let m = 0
    const add = (pose: Pose, g: GlobePose): void => {
      const r = reachOf(pose, g)
      m = Math.max(m, r.side, r.top, r.foot)
    }
    add(locked, REST_POSE)
    for (const g of shaken) add(locked, g)
    for (const [y, p] of drift) add(poseOfRig({ ...at, yawDeg: at.yawDeg + y, pitchDeg: at.pitchDeg + p }), REST_POSE)
    return m
  }
  const room = 1 - MOVES.loopCropMargin
  let d = rig.distanceMm
  for (let i = 0; i < 12; i++) {
    const m = most(d)
    if (m <= room) break
    d *= m / room
  }
  cardDistance = d
  return d
}

export function loopRig(t: number): Rig {
  const c = config.deliver.cardLoop
  const period = c.seconds
  const u = ((t % period) + period) % period
  const rig = rigOf(c.camera)
  rig.distanceMm = loopDistanceMm()
  const s0 = c.shakeStartSeconds
  const s1 = s0 + barSeconds
  const env = u < s0 ? smoother((s0 - u) / Math.min(beatSeconds, s0)) : u < s1 ? 0 : smoother((u - s1) / Math.min(2 * beatSeconds, period - s1))
  if (env > 0) {
    rig.yawDeg += env * MOVES.loopYawDeg * Math.sin((TAU * u) / period + 0.6)
    rig.pitchDeg += env * MOVES.loopPitchDeg * Math.sin((2 * TAU * u) / period + 1.9)
  }
  return rig
}

export const loopPose = (t: number): Pose => poseOfRig(loopRig(t))

export const cameraNumbers = (p: Pose): number[] => [p.position.x, p.position.y, p.position.z, p.aim.x, p.aim.y, p.aim.z, p.fovDeg]

/** What the cut list says of the loop's camera: how far it stands, its numbers on the first frame, and why it is not the config's as given. */
export function loopCamera(): { distanceMm: number; numbers: number[]; fit: string } {
  const given = rigOf(config.deliver.cardLoop.camera).distanceMm
  const stood = loopDistanceMm()
  return {
    distanceMm: Math.round(stood * 10) / 10,
    numbers: cameraNumbers(loopPose(0)).map((v) => Math.round(v * 1000) / 1000),
    fit: stood > given ? `moved back from ${Math.round(given * 10) / 10} mm along its own axis, so the glass and the base stay inside the centred square crop of the card through the shake` : 'as the config gives it',
  }
}

export interface ShotNote {
  shot: string
  kind: string
  role: Role
  lens: string
  move: string
  focus: string
  start: string
  end: string
  keys: { frame: number; what: string }[]
}

const n1 = (v: number): string => String(Math.round(v * 10) / 10)

function framing(r: Rig): string {
  const h = 2 * r.distanceMm * Math.tan((r.fovDeg * Math.PI) / 360)
  return `${n1(r.distanceMm)} mm from a point ${n1(r.aimHeightMm)} mm up the axis, yaw ${n1(r.yawDeg)}, pitch ${n1(r.pitchDeg)}, the frame ${n1(h)} mm tall there, the globe and base ${Math.round((globeTopMm / h) * 100)} percent of that height`
}

const lensWords = (r: Rig): string => `field of view ${n1(r.fovDeg)} degrees, aperture ${n1(r.apertureMm)} mm`
const focusWords = (r: Rig): string => `${n1(r.distanceMm + r.focusShiftMm)} mm from the lens, ${n1(Math.abs(r.focusShiftMm))} mm ${r.focusShiftMm > 0 ? 'behind' : 'in front of'} the aim point`

export function shotNotes(cut: Cut): ShotNote[] {
  const fps = cut.fps
  const frame = (t: number) => Math.round(t * fps)
  const drop = `lowers its aim by up to ${n1(MOVES.holdAimDropMm)} mm`
  return movesOf(cut).map((m): ShotNote => {
    const s = m.span
    const a = filmRig(cut, s.first / fps).rig
    const b = filmRig(cut, s.last / fps).rig
    const keys: { frame: number; what: string }[] = [{ frame: s.first, what: 'first frame' }]
    let move = ''
    let lens = lensWords(a)
    let focus = focusWords(a)
    if (m.role === 'open') {
      keys.push({ frame: frame(config.film.hookSeconds), what: 'film.hookSeconds: the pull back is plain' })
      keys.push({ frame: frame(config.film.revealBySeconds), what: 'film.revealBySeconds: the edge of the glass is in frame' })
      keys.push({ frame: frame(m.to), what: `the ${MOVES.wide} camera reached` })
      keys.push({ frame: frame((m.to + m.back) / 2), what: 'the widest point of the drift' })
      keys.push({ frame: frame(m.back), what: `back at ${MOVES.wide}, ${MOVES.backBeats} beat before the shake` })
      move = `Starts on the ${m.camera} camera already moving and pulls back to ${MOVES.wide} over the first ${MOVES.pullBars} bars, fast at first and easing to nothing. Then an arc of ${n1(MOVES.driftYawDeg)} degrees to one side and back, which ${drop} and gives it back.`
      lens = `${lensWords(a)}, opening to ${n1(rigOf(MOVES.wide).apertureMm)} mm at ${MOVES.wide}`
      focus = `${focusWords(a)}; at ${MOVES.wide} ${focusWords(rigOf(MOVES.wide))}`
    } else if (m.role === 'detail') {
      const span = m.to - m.from
      const reach = detailReach(m.camera)
      const near = nearestRig(m.camera)
      const there = reach < 1 ? `the nearest point to ${m.camera}` : m.camera
      keys.push({ frame: frame(m.from), what: `the move toward ${m.camera} begins` })
      keys.push({ frame: frame(m.from + span * MOVES.detailTravel), what: reach < 1 ? `the nearest point to the ${m.camera} camera` : `the ${m.camera} camera reached` })
      keys.push({ frame: frame(m.from + span * (1 - MOVES.detailTravel)), what: `leaving ${there}` })
      keys.push({ frame: frame(m.back), what: `back at ${MOVES.wide}, ${MOVES.backBeats} beat before the shake` })
      const way = reach < 1 ? `one slow move toward the ${m.camera} camera and back, ${Math.round(reach * 100)} percent of the way, so the ${detailKeep(m.camera).some((k) => k === 'ridge' || k === 'ground') ? 'miniature' : 'globe'} stays in the frame` : `one slow move to the ${m.camera} camera and back`
      move = `Starts on ${MOVES.wide} and ${drop} as the globe settles, then ${way}, with a sweep of ${n1(MOVES.sweepYawDeg)} degrees across it so the camera never rests there.`
      lens = `${lensWords(a)} at ${MOVES.wide}; ${lensWords(near)} at ${there}`
      focus = `${focusWords(a)}; at ${there} ${focusWords(near)}`
    } else if (m.role === 'close') {
      keys.push({ frame: frame(m.from), what: `the push toward ${m.camera} begins` })
      keys.push({ frame: frame(m.to), what: `the ${m.camera} camera reached, held to the end` })
      move = `Starts on ${MOVES.wide} and ${drop} over the first bar, then one unbroken push from ${MOVES.wide} to the ${m.camera} camera, which is held for the last bar. The last frame is the camera of frame 0.`
      lens = `${lensWords(a)}, closing to ${n1(rigOf(m.camera).apertureMm)} mm at ${m.camera}`
      focus = `${focusWords(a)}; at ${m.camera} ${focusWords(rigOf(m.camera))}`
    } else if (m.role === 'shake') {
      keys.push({ frame: frame(m.end), what: 'the landing, the first frame of the next shot' })
      move = `Locked at ${MOVES.wide} on every frame, with no ease in. Only the globe moves.`
      focus = `${focusWords(a)}: it stays where ${MOVES.wide} holds it, on the glass, and does not follow the globe`
    } else {
      keys.push({ frame: frame(m.back), what: `back at ${MOVES.wide}` })
      move = `An arc of ${n1(MOVES.driftYawDeg)} degrees to one side and back.`
    }
    keys.push({ frame: s.last, what: 'last frame' })
    const seen = new Set<number>()
    return { shot: s.shot.id, kind: s.shot.kind, role: m.role, lens, move, focus, start: framing(a), end: framing(b), keys: keys.filter((k) => k.frame >= s.first && k.frame <= s.last + 1 && !seen.has(k.frame) && !!seen.add(k.frame)).sort((x, y) => x.frame - y.frame) }
  })
}

export function cameraKeys(cut: Cut): CameraKey[] {
  const out: CameraKey[] = []
  for (const note of shotNotes(cut)) {
    for (const k of note.keys) {
      if (k.frame > cut.frameCount - 1 || out.some((o) => o.frame === k.frame)) continue
      const pose = filmPose(cut, k.frame / cut.fps)
      out.push({ frame: k.frame, shot: note.shot, what: k.what, camera: cameraNumbers(pose).map((v) => Math.round(v * 1000) / 1000), focusMm: Math.round(pose.focusMm * 10) / 10, apertureMm: Math.round(pose.apertureMm * 100) / 100 })
    }
  }
  return out.sort((a, b) => a.frame - b.frame)
}
