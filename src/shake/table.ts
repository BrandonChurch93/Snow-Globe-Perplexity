import { config } from '../config'
import { stream, type Rng } from '../core/rng'
import { changeSpan } from './change'

export interface GlobePose {
  x: number
  y: number
  z: number
  tiltX: number
  tiltZ: number
}

export const REST_POSE: GlobePose = { x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0 }

export interface ShakePath {
  readonly standIn: boolean
  readonly parts: { liftEnd: number; strokesEnd: number; landing: number }
  poseAt(beat: number): GlobePose
}

export const SHAKE_CHANNELS = ['x', 'y', 'z', 'tiltX', 'tiltZ'] as const
export type ShakeChannel = (typeof SHAKE_CHANNELS)[number]

export interface ShakeStroke {
  beat: number
  mm: number
}

/** What the seed drew and what the hand model made of it. Beats, millimetres, radians. */
export interface ShakePlan {
  planAngle: number
  lean: number
  awayMm: number
  gripRock: number
  liftOff: number
  gripTurns: ShakeStroke[]
  strokes: ShakeStroke[]
  fastest: { beat: number; mmPerBeat: number }
  rocking: number
  peakTilt: number
  rollStart: number
  overshoot: number
  settleEnd: number
}

export interface ShakeMotion {
  readonly name: string
  readonly knotsPerBeat: number
  readonly parts: { liftEnd: number; strokesEnd: number; landing: number }
  readonly endBeat: number
  readonly plan: ShakePlan
  /** The channel or one of its derivatives per beat, order 0 to 3. */
  at(channel: ShakeChannel, beat: number, order?: number): number
  /** The largest third derivative per beat cubed that any piece of the table between the two beats holds. */
  jerkPeak(channel: ShakeChannel, from: number, to: number): number
}

const RAD = Math.PI / 180
const TAU = Math.PI * 2
const FOOT_MM = config.globe.baseDiameterMm / 2
const BEAT_SECONDS = 60 / config.film.defaultBpm

/** The hand, in beats, millimetres and degrees. None of these is in the config: they are the model, not the brief. */
const HAND = {
  knots: 480,
  substeps: 8,
  springTurns: 5.4,
  damping: 0.62,
  stopDamping: 1.15,
  jerkPerMm: 16000,
  turnBeats: 0.19,
  easeBeats: 0.075,
  startTurn: 0.34,
  startEase: 0.16,
  stopTurn: 0.5,
  stopEase: 0.25,
  stopRest: 0.08,
  turnFloor: 0.2,
  firstReach: 0.78,
  slowStroke: 1.28,
  fastStroke: 0.84,
  returnShare: 1.35,
  returnBlend: 0.55,
  reach: [0.74, 1.08],
  lateReach: [0.9, 1.06],
  peakReach: [1.02, 1.12],
  planDeg: [8, 18],
  leanDeg: [4.1, 4.4],
  leanShare: 0.74,
  awayMm: [7.5, 9],
  rimAirMm: 1.06,
  tiltHair: 0.00005,
  unlikeLength: 0.05,
  unlikeMoment: 0.06,
  redraws: 24,
  gripRockDeg: [0.45, 0.65],
  gripBeats: 0.2,
  liftOffBeats: 0.24,
  liftEffort: 1.18,
  leanLag: 1.4,
  droopHigh: [0.1, 0.16],
  droopLow: [0.045, 0.085],
  droopKnee: 0.3,
  sagShare: 0.012,
  whipTurns: 3.9,
  whipDamping: 0.42,
  rockTurns: 3.1,
  rockDamping: 0.5,
  rockGain: [0.3, 0.45],
  ringHold: 0.2,
  ringFade: 0.62,
  tremorTurns: [4.4, 7.4],
  tremorMm: 0.11,
  tremorDeg: 0.045,
  padRad: 0.003,
  landDeg: [38, 58],
  gripDeg: [30, 55],
  overshootDeg: [0.4, 0.5],
  rockFirst: 0.21,
  rockChirp: 1.07,
  rockDecay: 5,
  contactLead: 0.11,
  descentPull: 1.5,
} as const

const s5 = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 + u * (-15 + 6 * u)))
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const pick = (rng: Rng, span: readonly [number, number] | readonly number[]): number => rng.range(span[0]!, span[1]!)

/** The sine of the angle between the globe's axis and the vertical. */
export const tiltSine = (tiltX: number, tiltZ: number): number => {
  const sx = Math.sin(tiltX)
  const sz = Math.sin(tiltZ) * Math.cos(tiltX)
  return Math.hypot(sx, sz)
}

/** How far the lowest point of the foot's rim stands above the surface, in millimetres. */
export const rimGapMm = (pose: GlobePose): number => pose.y - FOOT_MM * tiltSine(pose.tiltX, pose.tiltZ)

/** The height of the foot's centre while the foot rocks on its rim: zero and flat when level, the rim's own rise beyond a hair of tilt. */
const rockHeight = (sine: number): number => {
  const e = HAND.padRad
  return FOOT_MM * (Math.hypot(sine, e) - e * Math.exp((-sine * sine) / (2 * e * e)))
}

function tremorOf(rng: Rng): (beat: number) => number {
  const parts = [0, 1, 2].map(() => ({ turns: pick(rng, HAND.tremorTurns), phase: rng.range(0, TAU), gain: rng.range(0.6, 1) }))
  const total = parts.reduce((s, p) => s + p.gain, 0)
  return (beat) => parts.reduce((s, p) => s + p.gain * Math.sin(TAU * p.turns * beat + p.phase), 0) / total
}

interface Channel {
  v: Float64Array
  d1: Float64Array
  d2: Float64Array
}

/** Slopes and bends at the knots by five-point differences. At a corner the channel is flat on both sides, so a difference never reads across it: it reads the near side turned about the corner instead. */
function derive(v: Float64Array, h: number, pinned: (i: number) => boolean, corners: number[]): Channel {
  const n = v.length
  const d1 = new Float64Array(n)
  const d2 = new Float64Array(n)
  const raw = (j: number): number => (j < 0 || j >= n ? 0 : v[j]!)
  const f = (i: number, j: number): number => {
    for (const p of corners) if ((i > p && j < p) || (i < p && j > p)) return 2 * raw(p) - raw(2 * p - j)
    return raw(j)
  }
  for (let i = 0; i < n; i++) {
    if (pinned(i)) continue
    d1[i] = (-f(i, i + 2) + 8 * f(i, i + 1) - 8 * f(i, i - 1) + f(i, i - 2)) / (12 * h)
    d2[i] = (-f(i, i + 2) + 16 * f(i, i + 1) - 30 * raw(i) + 16 * f(i, i - 1) - f(i, i - 2)) / (12 * h * h)
  }
  return { v, d1, d2 }
}

function piece(c: Channel, i: number, h: number): [number, number, number, number, number, number] {
  const p0 = c.v[i]!
  const p1 = c.v[i + 1]!
  const v0 = c.d1[i]! * h
  const v1 = c.d1[i + 1]! * h
  const a0 = c.d2[i]! * h * h
  const a1 = c.d2[i + 1]! * h * h
  return [p0, v0, a0 / 2, -10 * p0 - 6 * v0 - 1.5 * a0 + 10 * p1 - 4 * v1 + 0.5 * a1, 15 * p0 + 8 * v0 + 1.5 * a0 - 15 * p1 + 7 * v1 - a1, -6 * p0 - 3 * v0 - 0.5 * a0 + 6 * p1 - 3 * v1 + 0.5 * a1]
}

function build(name: string): ShakeMotion {
  const c = config.shake
  const rng = stream(`shake:${name}`)
  const liftEnd = c.liftBeats
  const strokesEnd = c.liftBeats + c.strokeBeats
  const landing = strokesEnd + c.setDownBeats
  const settle = c.landSettleSeconds / BEAT_SECONDS
  const endBeat = landing + settle
  const K = HAND.knots
  const h = 1 / K
  const last = Math.ceil(endBeat * K - 1e-9)
  const count = last + 1
  const iLift = Math.round(liftEnd * K)
  const iStrokes = Math.round(strokesEnd * K)
  const iLand = Math.round(landing * K)
  const beatOf = (i: number): number => i * h

  const first = rng.sign()
  const planAngle = rng.sign() * pick(rng, HAND.planDeg) * RAD
  const cap = Math.max(0, Math.min(c.tiltDeg * RAD, Math.asin(clamp((c.liftMm - HAND.rimAirMm) / FOOT_MM, 0, 1))))
  const lean = Math.min(pick(rng, HAND.leanDeg) * RAD, HAND.leanShare * cap)
  const awayMm = pick(rng, HAND.awayMm)
  const gripRock = Math.min(pick(rng, HAND.gripRockDeg) * RAD, 0.5 * lean)
  const gripAngle = rng.sign() * pick(rng, HAND.gripDeg) * RAD
  const landAngle = rng.sign() * pick(rng, HAND.landDeg) * RAD
  const overshoot = pick(rng, HAND.overshootDeg) * RAD

  // The strokes: targets on alternating sides, each with its own reach and its own moment, the hand speeding up.
  const n = Math.max(1, Math.round(c.strokes))
  let weights: number[] = []
  let reach: number[] = []
  let peakReach = 1
  let before = 0
  let whole = 0
  const drawStrokes = (): void => {
    weights = [HAND.firstReach * rng.range(0.94, 1.06)]
    for (let i = 1; i < n; i++) {
      const t = n > 2 ? (i - 1) / (n - 2) : 1
      const w = HAND.slowStroke + (HAND.fastStroke - HAND.slowStroke) * t
      weights.push(i === n - 1 ? w * rng.range(0.96, 1) : Math.max(w * rng.range(0.93, 1.07), HAND.fastStroke * 1.05))
    }
    reach = []
    for (let k = 0; k < n; k++) {
      let r = pick(rng, k >= n - 2 ? HAND.lateReach : HAND.reach)
      if (k > 0 && Math.abs(r - reach[k - 1]!) < 0.05) r += r < reach[k - 1]! ? -0.06 : 0.06
      reach.push(r)
    }
    peakReach = pick(rng, HAND.peakReach)
    before = weights.slice(0, n - 1).reduce((s, w) => s + w, 0)
    whole = weights.reduce((s, w) => s + w, 0)
  }
  const omega = TAU * HAND.springTurns
  const span = changeSpan('base')
  const bloomBeat = c.swapWindow.fromBeat + (c.swapWindow.toBeat - c.swapWindow.fromBeat) * ((span.from + span.to) / 2)
  const jerkLimit = HAND.jerkPerMm * c.strokeMm

  // The grip sweeps straight from target to target and makes each turn with a pull that cannot change faster than the limit on jerk.
  // The globe follows it through a stiff spring: it lags, and it overshoots a little at each turn.
  const sweepOf = (lag: number): { turnBeat: number[]; turnMm: number[]; stroke: Float64Array; anchored: boolean } => {
    let unit = (bloomBeat - lag - liftEnd) / (before + (n > 1 ? weights[n - 1]! / 2 : 0))
    let back = c.strokeBeats - whole * unit
    const anchored = n > 1 && unit > 0 && back >= 0.75 * unit && back <= 2.2 * unit
    if (!anchored) {
      unit = c.strokeBeats / (whole + HAND.returnShare)
      back = HAND.returnShare * unit
    }
    const turnBeat: number[] = [liftEnd]
    const turnMm: number[] = [0]
    for (let k = 0; k < n; k++) {
      turnBeat.push(turnBeat[k]! + weights[k]! * unit)
      turnMm.push(first * (k % 2 === 0 ? 1 : -1) * reach[k]! * c.strokeMm)
    }
    const stopCentre = strokesEnd - HAND.stopRest * back - (HAND.stopTurn + HAND.stopEase) * back * 0.5
    const startCentre = liftEnd + (HAND.startTurn + HAND.startEase) * unit * 0.5
    const sweeps: number[] = []
    for (let k = 0; k < n; k++) sweeps.push((turnMm[k + 1]! - turnMm[k]!) / (turnBeat[k + 1]! - (k === 0 ? startCentre : turnBeat[k]!)))
    sweeps.push(-turnMm[n]! / (stopCentre - turnBeat[n]!))
    const pulls: { at: number; dv: number; turn: number; ease: number }[] = []
    for (let k = 0; k <= n + 1; k++) {
      const dv = (k <= n ? sweeps[k]! : 0) - (k > 0 ? sweeps[k - 1]! : 0)
      const turn = k === 0 ? HAND.startTurn * unit : k === n + 1 ? HAND.stopTurn * back : HAND.turnBeats * unit
      const ease = k === 0 ? HAND.startEase * unit : k === n + 1 ? HAND.stopEase * back : HAND.easeBeats * unit
      pulls.push({ at: k === 0 ? startCentre : k === n + 1 ? stopCentre : turnBeat[k]!, dv, turn, ease: Math.max(ease, Math.abs(dv) / (turn * jerkLimit)) })
    }
    const pull = (beat: number): number => {
      let a = 0
      for (const p of pulls) {
        const inside = (p.turn + p.ease) / 2 - Math.abs(beat - p.at)
        if (inside > 0) a += (p.dv * Math.min(inside, p.turn, p.ease)) / (p.turn * p.ease)
      }
      return a
    }
    const stroke = new Float64Array(count)
    const dt = h / HAND.substeps
    let g = 0
    let gv = 0
    let p = 0
    let v = 0
    for (let i = iLift; i <= iStrokes; i++) {
      stroke[i] = p
      for (let k = 0; k < HAND.substeps; k++) {
        const b = beatOf(i) + k * dt
        const ga = pull(b + dt / 2)
        g += gv * dt + (ga * dt * dt) / 2
        gv += ga * dt
        const stop = s5((b - turnBeat[n]!) / (strokesEnd - turnBeat[n]!))
        const zeta = HAND.damping + (HAND.stopDamping - HAND.damping) * stop
        v += (omega * omega * (g - p) + 2 * zeta * omega * (gv - v)) * dt
        p += v * dt
      }
    }
    const blend = back * HAND.returnBlend
    let peak = 0
    for (let i = iLift; i <= iStrokes; i++) {
      stroke[i] = stroke[i]! * (1 - s5((beatOf(i) - (strokesEnd - blend)) / blend))
      peak = Math.max(peak, Math.abs(stroke[i]!))
    }
    const scale = peak > 0 ? (c.strokeMm * peakReach) / peak : 0
    for (let i = iLift; i <= iStrokes; i++) stroke[i] = i === iLift || i === iStrokes ? 0 : stroke[i]! * scale
    return { turnBeat, turnMm, stroke, anchored }
  }
  const extremesOf = (s: Float64Array): ShakeStroke[] => {
    const out: ShakeStroke[] = []
    for (let i = iLift + 1; i < iStrokes; i++) {
      const d0 = s[i]! - s[i - 1]!
      const d1 = s[i + 1]! - s[i]!
      if (d0 !== 0 && d0 * d1 <= 0 && Math.abs(s[i]!) > HAND.turnFloor * c.strokeMm) {
        const bend = d0 - d1
        out.push({ beat: beatOf(i) + (bend !== 0 ? (h * (d0 + d1)) / (2 * bend) : 0), mm: s[i]! })
      }
    }
    return out
  }

  // The fastest stroke is the last one: its middle is put on the middle of the outside parts' span, where the bloom peaks.
  const anchor = (): ReturnType<typeof sweepOf> => {
    let lag = (2 * HAND.damping) / omega
    let swept = sweepOf(lag)
    for (let pass = 0; pass < 4 && swept.anchored; pass++) {
      const turns = extremesOf(swept.stroke)
      if (turns.length < 2) break
      const off = (turns[turns.length - 1]!.beat + turns[turns.length - 2]!.beat) / 2 - bloomBeat
      if (Math.abs(off) < h / 8) break
      lag += off
      swept = sweepOf(lag)
    }
    return swept
  }
  // No two strokes of the globe alike: a draw in which two agree in both length and time is drawn again.
  const unlikeOf = (turns: ShakeStroke[]): number => {
    let least = Infinity
    for (let k = 0; k < turns.length; k++) {
      const gapK = turns[k]!.beat - (k === 0 ? liftEnd : turns[k - 1]!.beat)
      const lengthK = Math.abs(turns[k]!.mm - (k === 0 ? 0 : turns[k - 1]!.mm))
      for (let j = 0; j < k; j++) {
        const gapJ = turns[j]!.beat - (j === 0 ? liftEnd : turns[j - 1]!.beat)
        const lengthJ = Math.abs(turns[j]!.mm - (j === 0 ? 0 : turns[j - 1]!.mm))
        const length = Math.abs(lengthK - lengthJ) / c.strokeMm
        const moment = Math.abs(gapK - gapJ) / Math.max(gapJ, gapK)
        least = Math.min(least, Math.max(length / HAND.unlikeLength, moment / HAND.unlikeMoment))
      }
    }
    return least
  }
  drawStrokes()
  let made = anchor()
  let unlike = unlikeOf(extremesOf(made.stroke))
  for (let again = 0; again < HAND.redraws && unlike < 1; again++) {
    drawStrokes()
    const next = anchor()
    const score = unlikeOf(extremesOf(next.stroke))
    if (score > unlike) {
      made = next
      unlike = score
    }
  }
  const { turnBeat, turnMm, stroke } = made
  const strokeRate = derive(stroke, h, (i) => i <= iLift || i >= iStrokes, [iLift, iStrokes]).d1

  // The rocking: the globe tips into each stroke and whips back at each reversal, a second axis a little out of step.
  const ringEnd = strokesEnd + HAND.ringFade * c.setDownBeats
  const ringHold = strokesEnd + HAND.ringHold * c.setDownBeats
  const follower = (turns: number, damping: number): Float64Array => {
    const out = new Float64Array(count)
    const w = TAU * turns
    const dt = h / HAND.substeps
    let p = 0
    let v = 0
    for (let i = iLift; i < count && beatOf(i) < ringEnd; i++) {
      out[i] = p * (1 - s5((beatOf(i) - ringHold) / (ringEnd - ringHold)))
      const u0 = strokeRate[i]!
      const u1 = i + 1 < count ? strokeRate[i + 1]! : 0
      for (let k = 0; k < HAND.substeps; k++) {
        const u = u0 + ((u1 - u0) * k) / HAND.substeps
        v += (w * w * (u - p) - 2 * damping * w * v) * dt
        p += v * dt
      }
    }
    return out
  }
  const whip = follower(HAND.whipTurns, HAND.whipDamping)
  const rock = follower(HAND.rockTurns, HAND.rockDamping)
  let whipPeak = 0
  for (let i = 0; i < count; i++) whipPeak = Math.max(whipPeak, Math.abs(whip[i]!))
  const rockGain = rng.sign() * pick(rng, HAND.rockGain)

  // The landing, solved backward from the bar: the foot rolls flat exactly on it, rocks over by the overshoot and rattles out.
  const lobe = HAND.rockFirst * settle
  const chirp = HAND.rockChirp / settle
  const decay = HAND.rockDecay / settle
  const rate = Math.PI / (lobe * (1 + chirp * lobe))
  const rattle = (t: number): number => -Math.exp(-decay * t) * Math.sin(rate * t * (1 + chirp * t)) * (t > 0 ? 1 - s5(t / settle) : 1)
  let over = 0
  for (let t = 0; t < lobe; t += lobe / 400) over = Math.max(over, -rattle(t))
  const landGain = over > 0 ? overshoot / over : 0
  const contactLead = HAND.contactLead * settle
  let crest = contactLead
  let crestValue = rattle(-contactLead)
  for (let t = contactLead; t < Math.min(0.9 * c.setDownBeats, 3 * contactLead); t += contactLead / 200) {
    const value = rattle(-t)
    if (value < crestValue) break
    crest = t
    crestValue = value
  }
  const approach = crestValue * landGain
  const landTilt = (beat: number): number => {
    const t = beat - landing
    if (t >= -contactLead) return landGain * rattle(t)
    if (t <= -crest) return approach
    return approach + (landGain * rattle(t) - approach) * s5((t + crest) / (crest - contactLead))
  }

  const liftOff = HAND.liftOffBeats * liftEnd
  const gripBeats = HAND.gripBeats * liftEnd
  const hold = { x: -Math.cos(planAngle), z: -Math.sin(planAngle) }
  const along = { x: Math.sin(planAngle), z: -Math.cos(planAngle) }
  const gripDir = { x: -Math.cos(gripAngle), z: Math.sin(gripAngle) }
  const landDir = { x: -Math.cos(landAngle), z: Math.sin(landAngle) }
  const rockRest = rockHeight(Math.sin(gripRock))
  const liftGap = c.liftMm - rockRest
  const landGap = c.liftMm - rockHeight(Math.sin(approach))
  const rise = (beat: number): number => s5(Math.pow(clamp((beat - liftOff) / (liftEnd - liftOff), 0, 1), HAND.liftEffort))
  const fall = (beat: number): number => 1 - s5(Math.pow(clamp((beat - strokesEnd) / (landing - strokesEnd), 0, 1), HAND.descentPull))

  const droopFirst = pick(rng, HAND.droopHigh)
  const droopOther = pick(rng, HAND.droopLow)
  const lowSide = rng.sign()
  const knee = HAND.droopKnee * c.strokeMm
  const droop = (s: number): number => {
    const share = Math.sign(s) === lowSide ? droopFirst : droopOther
    const a = Math.abs(s)
    return ((share * c.liftMm * (c.strokeMm * c.strokeMm + knee * knee)) / (c.strokeMm * c.strokeMm * c.strokeMm)) * ((a * a * a) / (a * a + knee * knee))
  }

  const shiver = { x: tremorOf(rng), y: tremorOf(rng), z: tremorOf(rng), tiltX: tremorOf(rng), tiltZ: tremorOf(rng) }
  const airFade = Math.min(strokesEnd + 0.75 * c.setDownBeats, landing - crest)
  const inAir = (beat: number): number => s5((beat - liftOff - 0.1 * liftEnd) / (liftEnd - liftOff - 0.1 * liftEnd)) * (1 - s5((beat - ringHold) / (airFade - ringHold)))
  const inHold = (beat: number): number => s5((beat - liftEnd) / (0.125 * c.strokeBeats)) * (1 - s5((beat - strokesEnd + 0.125 * c.strokeBeats) / (0.125 * c.strokeBeats)))

  const x = new Float64Array(count)
  const y = new Float64Array(count)
  const z = new Float64Array(count)
  const baseX = new Float64Array(count)
  const baseZ = new Float64Array(count)
  const moveX = new Float64Array(count)
  const moveZ = new Float64Array(count)
  const leanOnly = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const b = beatOf(i)
    if (b >= endBeat) continue
    const s = stroke[i]!
    const air = inAir(b)
    let lx: number
    let lz: number
    let held: number
    if (b <= liftEnd) {
      const up = rise(b)
      held = Math.pow(up, HAND.leanLag)
      const rocked = gripRock * s5(b / gripBeats) * (1 - held)
      lx = rocked * gripDir.x + lean * held * hold.x
      lz = rocked * gripDir.z + lean * held * hold.z
      y[i] = b <= liftOff ? rockHeight(tiltSine(lx, lz)) : rockRest + liftGap * up
      z[i] = -awayMm * Math.pow(up, 1.2)
    } else if (b < strokesEnd) {
      held = 1
      lx = lean * hold.x
      lz = lean * hold.z
      y[i] = c.liftMm - droop(s) - HAND.sagShare * c.liftMm * inHold(b) * (0.5 + 0.5 * shiver.y(b))
      z[i] = -awayMm + s * Math.sin(planAngle)
    } else {
      const down = fall(b)
      held = down
      const flat = landTilt(b)
      lx = flat * landDir.x + (lean * hold.x - approach * landDir.x) * down
      lz = flat * landDir.z + (lean * hold.z - approach * landDir.z) * down
      y[i] = rockHeight(Math.sin(Math.abs(flat))) + landGap * down
      z[i] = -awayMm * down
    }
    x[i] = i <= iLift || i >= iStrokes ? 0 : s * Math.cos(planAngle) + HAND.tremorMm * 0.6 * inHold(b) * shiver.x(b)
    z[i] = z[i]! + HAND.tremorMm * air * shiver.z(b)
    baseX[i] = lx + HAND.tremorDeg * RAD * air * shiver.tiltX(b)
    baseZ[i] = lz + HAND.tremorDeg * RAD * air * shiver.tiltZ(b)
    leanOnly[i] = Math.hypot(lx, lz)
    if (whipPeak > 0) {
      const a = whip[i]! / whipPeak
      const r = (rock[i]! / whipPeak) * rockGain
      moveX[i] = a * along.x + r * hold.x
      moveZ[i] = a * along.z + r * hold.z
    }
  }

  // One factor for the whole shake: the rocking as large as the config's tilt and the room under the rim allow.
  const fits = (k: number): boolean => {
    for (let i = iLift; i < count && beatOf(i) < ringEnd; i++) {
      const tx = baseX[i]! + k * moveX[i]!
      const tz = baseZ[i]! + k * moveZ[i]!
      const sine = tiltSine(tx, tz)
      if (Math.asin(Math.min(1, sine)) > c.tiltDeg * RAD - HAND.tiltHair) return false
      const gap = y[i]! - FOOT_MM * sine
      const needs = i <= iStrokes ? HAND.rimAirMm : Math.min(HAND.rimAirMm, 0.5 * (y[i]! - FOOT_MM * Math.sin(leanOnly[i]!)))
      if (gap < needs) return false
    }
    return true
  }
  let rocking = 0
  {
    let lo = 0
    let hi = c.tiltDeg * RAD * 2
    if (fits(hi)) lo = hi
    else
      for (let step = 0; step < 40; step++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
    rocking = fits(lo) ? lo : 0
  }
  const tiltX = new Float64Array(count)
  const tiltZ = new Float64Array(count)
  let peakTilt = 0
  for (let i = 0; i < count; i++) {
    tiltX[i] = baseX[i]! + rocking * moveX[i]!
    tiltZ[i] = baseZ[i]! + rocking * moveZ[i]!
    peakTilt = Math.max(peakTilt, Math.asin(Math.min(1, tiltSine(tiltX[i]!, tiltZ[i]!))))
  }
  for (const v of [x, y, z, tiltX, tiltZ]) {
    v[0] = 0
    v[iLand] = 0
    for (let i = 0; i < count; i++) if (beatOf(i) >= endBeat) v[i] = 0
  }
  y[iLift] = c.liftMm
  y[iStrokes] = c.liftMm

  const ends = (i: number): boolean => i === 0 || beatOf(i) >= endBeat
  const iEnd = Math.min(last, Math.ceil(endBeat * K - 1e-9))
  const channels: Record<ShakeChannel, Channel> = {
    x: derive(x, h, (i) => ends(i) || i <= iLift || i >= iStrokes, [iLift, iStrokes]),
    y: derive(y, h, (i) => ends(i) || i === iLift || i === iStrokes, [0, iLift, iStrokes, iEnd]),
    z: derive(z, h, ends, [0, iEnd]),
    tiltX: derive(tiltX, h, ends, [0, iEnd]),
    tiltZ: derive(tiltZ, h, ends, [0, iEnd]),
  }

  const strokes = extremesOf(stroke)
  let fastest = { beat: liftEnd, mmPerBeat: 0 }
  for (let i = iLift + 1; i < iStrokes; i++) if (Math.abs(strokeRate[i]!) > fastest.mmPerBeat) fastest = { beat: beatOf(i), mmPerBeat: Math.abs(strokeRate[i]!) }

  const at = (channel: ShakeChannel, beat: number, order = 0): number => {
    if (!(beat > 0) || beat >= endBeat) return 0
    const f = beat * K
    const i = Math.min(last - 1, Math.floor(f))
    const u = f - i
    const k = piece(channels[channel], i, h)
    if (order === 0) return k[0] + u * (k[1] + u * (k[2] + u * (k[3] + u * (k[4] + u * k[5]))))
    if (order === 1) return (k[1] + u * (2 * k[2] + u * (3 * k[3] + u * (4 * k[4] + u * 5 * k[5])))) * K
    if (order === 2) return (2 * k[2] + u * (6 * k[3] + u * (12 * k[4] + u * 20 * k[5]))) * K * K
    return (6 * k[3] + u * (24 * k[4] + u * 60 * k[5])) * K * K * K
  }
  const jerkPeak = (channel: ShakeChannel, from: number, to: number): number => {
    let peak = 0
    const i0 = Math.max(0, Math.floor(from * K))
    const i1 = Math.min(last - 1, Math.ceil(to * K) - 1)
    for (let i = i0; i <= i1; i++) {
      const k = piece(channels[channel], i, h)
      const j = (u: number): number => Math.abs(6 * k[3] + u * (24 * k[4] + u * 60 * k[5]))
      peak = Math.max(peak, j(0), j(1))
      if (k[5] !== 0) {
        const u = -k[4] / (5 * k[5])
        if (u > 0 && u < 1) peak = Math.max(peak, j(u))
      }
    }
    return peak * K * K * K
  }

  return {
    name,
    knotsPerBeat: K,
    parts: { liftEnd, strokesEnd, landing },
    endBeat,
    plan: {
      planAngle,
      lean,
      awayMm,
      gripRock,
      liftOff,
      gripTurns: turnBeat.slice(1).map((beat, k) => ({ beat, mm: turnMm[k + 1]! })),
      strokes,
      fastest,
      rocking,
      peakTilt,
      rollStart: landing - contactLead,
      overshoot,
      settleEnd: endBeat,
    },
    at,
    jerkPeak,
  }
}

const motions = new Map<string, ShakeMotion>()

/** The table behind a shake, for tests and tools: the same numbers `makeShake` reads. */
export function shakeMotion(name: string): ShakeMotion {
  let m = motions.get(name)
  if (!m) {
    m = build(name)
    motions.set(name, m)
  }
  return m
}

const paths = new Map<string, ShakePath>()

export function makeShake(name: string): ShakePath {
  const made = paths.get(name)
  if (made) return made
  const m = shakeMotion(name)
  const landing = m.parts.landing
  const path: ShakePath = {
    standIn: false,
    parts: { ...m.parts },
    poseAt(beat: number): GlobePose {
      if (!(beat > 0) || beat >= m.endBeat || beat === landing) return REST_POSE
      const x = m.at('x', beat)
      return { x: x === 0 ? 0 : x, y: m.at('y', beat), z: m.at('z', beat), tiltX: m.at('tiltX', beat), tiltZ: m.at('tiltZ', beat) }
    },
  }
  paths.set(name, path)
  return path
}
