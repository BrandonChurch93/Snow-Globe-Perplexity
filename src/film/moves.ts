import { cameraById, config } from '../config'
import { poseById, poseOf, type Pose } from '../scene/cameras'
import { globeTopMm } from '../scene/framing'
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
  sweepYawDeg: 1.6,
  settleBars: 1,
  closeHoldBars: 1,
  shakeEaseIn: 0.025,
  breathYawDeg: 0.18,
  breathPitchDeg: 0.07,
  breathYawSeconds: 7.3,
  breathPitchSeconds: 5.1,
  loopYawDeg: 1.2,
  loopPitchDeg: 0.3,
}

const TAU = Math.PI * 2
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

export function easeAt(cut: Cut, t: number): number {
  let k = 0
  for (const s of cut.shakes) {
    if (t < s.startSec) break
    if (t < s.endSec) return smoother((t - s.startSec) / s.seconds)
    k = 1 - smoother((t - s.endSec) / (s.seconds * MOVES.settleBars))
  }
  return k
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

export function filmRig(cut: Cut, t: number): { rig: Rig; move: Move } {
  const move = moveAt(cut, t)
  const wide = rigOf(MOVES.wide)
  let rig: Rig
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
    const w = v < a ? smoother(v / a) : v > 1 - a ? smoother((1 - v) / a) : 1
    rig = mixRig(wide, rigOf(move.camera), w)
    rig.yawDeg += MOVES.sweepYawDeg * (2 * v - 1) * Math.sin(Math.PI * v)
  } else if (move.role === 'close') {
    rig = mixRig(wide, rigOf(move.camera), smoother((t - move.from) / (move.to - move.from)))
  } else if (move.role === 'plain') {
    const v = clamp01((t - move.from) / (move.to - move.from))
    rig = { ...wide, yawDeg: wide.yawDeg + MOVES.driftYawDeg * Math.sin(Math.PI * v) ** 2 }
  } else rig = { ...wide }
  const ease = easeAt(cut, t)
  if (ease > 0) rig.distanceMm *= 1 - MOVES.shakeEaseIn * ease
  const breath = breathAt(cut, t)
  if (breath > 0) {
    rig.yawDeg += breath * MOVES.breathYawDeg * Math.sin((TAU * t) / MOVES.breathYawSeconds + 1.3)
    rig.pitchDeg += breath * MOVES.breathPitchDeg * Math.sin((TAU * t) / MOVES.breathPitchSeconds + 0.4)
  }
  return { rig, move }
}

export const filmPose = (cut: Cut, t: number): Pose => poseOfRig(filmRig(cut, t).rig)

export function loopRig(t: number): Rig {
  const c = config.deliver.cardLoop
  const period = c.seconds
  const u = ((t % period) + period) % period
  const rig = rigOf(c.camera)
  const s0 = c.shakeStartSeconds
  const s1 = s0 + barSeconds
  const settle = Math.min(barSeconds, (period - s1) / 2)
  const ease = u < s0 ? 0 : u < s1 ? smoother((u - s0) / barSeconds) : 1 - smoother((u - s1) / settle)
  if (ease > 0) rig.distanceMm *= 1 - MOVES.shakeEaseIn * ease
  const env = u < s0 ? smoother((s0 - u) / Math.min(beatSeconds, s0)) : u < s1 ? 0 : smoother((u - s1) / Math.min(2 * beatSeconds, period - s1))
  if (env > 0) {
    rig.yawDeg += env * MOVES.loopYawDeg * Math.sin((TAU * u) / period + 0.6)
    rig.pitchDeg += env * MOVES.loopPitchDeg * Math.sin((2 * TAU * u) / period + 1.9)
  }
  return rig
}

export const loopPose = (t: number): Pose => poseOfRig(loopRig(t))

export const cameraNumbers = (p: Pose): number[] => [p.position.x, p.position.y, p.position.z, p.aim.x, p.aim.y, p.aim.z, p.fovDeg]

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
const focusWords = (r: Rig): string => `${n1(r.distanceMm + r.focusShiftMm)} mm from the lens, ${n1(-r.focusShiftMm)} mm in front of the aim point`

export function shotNotes(cut: Cut): ShotNote[] {
  const fps = cut.fps
  const frame = (t: number) => Math.round(t * fps)
  const pc = n1(MOVES.shakeEaseIn * 100)
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
      move = `Starts on the ${m.camera} camera already moving and pulls back to ${MOVES.wide} over the first ${MOVES.pullBars} bars, fast at first and easing to nothing. Then an arc of ${n1(MOVES.driftYawDeg)} degrees to one side and back.`
      lens = `${lensWords(a)}, opening to ${n1(rigOf(MOVES.wide).apertureMm)} mm at ${MOVES.wide}`
      focus = `${focusWords(a)}; at ${MOVES.wide} ${focusWords(rigOf(MOVES.wide))}`
    } else if (m.role === 'detail') {
      const span = m.to - m.from
      keys.push({ frame: frame(m.from), what: `the move toward ${m.camera} begins` })
      keys.push({ frame: frame(m.from + span * MOVES.detailTravel), what: `the ${m.camera} camera reached` })
      keys.push({ frame: frame(m.from + span * (1 - MOVES.detailTravel)), what: `leaving ${m.camera}` })
      keys.push({ frame: frame(m.back), what: `back at ${MOVES.wide}, ${MOVES.backBeats} beat before the shake` })
      move = `Settles from the shake over the first bar, then one slow move to the ${m.camera} camera and back, with a sweep of ${n1(MOVES.sweepYawDeg)} degrees across it so the camera never rests there.`
      lens = `${lensWords(a)} at ${MOVES.wide}; ${lensWords(rigOf(m.camera))} at ${m.camera}`
      focus = `${focusWords(a)}; at ${m.camera} ${focusWords(rigOf(m.camera))}`
    } else if (m.role === 'close') {
      keys.push({ frame: frame(m.from), what: `the push toward ${m.camera} begins` })
      keys.push({ frame: frame(m.to), what: `the ${m.camera} camera reached, held to the end` })
      move = `Settles from the shake over the first bar, then one unbroken push from ${MOVES.wide} to the ${m.camera} camera, which is held for the last bar. The last frame is the camera of frame 0.`
      lens = `${lensWords(a)}, closing to ${n1(rigOf(m.camera).apertureMm)} mm at ${m.camera}`
      focus = `${focusWords(a)}; at ${m.camera} ${focusWords(rigOf(m.camera))}`
    } else if (m.role === 'shake') {
      keys.push({ frame: frame(m.end), what: 'the landing, the first frame of the next shot' })
      move = `Locked at ${MOVES.wide}. Only the globe moves. The camera closes ${pc} percent of its distance over the bar and gives it back over the bar after the landing.`
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
