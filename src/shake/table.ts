import { config } from '../config'
import { stream, type Rng } from '../core/rng'
import { changeSpan } from './change'

export interface GlobePose {
  x: number
  y: number
  z: number
  tiltX: number
  tiltZ: number
  /** The turn of the globe about its own upright axis, in radians, taken before the tilt: the stage turns it by Euler(tiltX, twist, tiltZ, 'XZY'). Absent is none. */
  twist?: number
}

export const REST_POSE: GlobePose = { x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0 }

export interface ShakePath {
  readonly parts: { liftEnd: number; strokesEnd: number; landing: number }
  poseAt(beat: number): GlobePose
}

export const SHAKE_CHANNELS = ['x', 'y', 'z', 'tiltX', 'tiltZ'] as const
export type ShakeChannel = (typeof SHAKE_CHANNELS)[number]
/** The channels of a table: the five every hand has and the twist, which only the held hand makes. */
export const MOTION_CHANNELS = [...SHAKE_CHANNELS, 'twist'] as const
export type MotionChannel = (typeof MOTION_CHANNELS)[number]

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
  dipMm: number
  windMm: number
  lastTurn: ShakeStroke
  touch: number
  peakTilt: number
  rollStart: number
  overshoot: number
  settleEnd: number
  /** The most the wrist turns the globe about its upright axis, in radians: zero for the first hand. */
  twistPeak: number
}

export interface ShakeMotion {
  readonly name: string
  readonly knotsPerBeat: number
  readonly parts: { liftEnd: number; strokesEnd: number; landing: number }
  readonly endBeat: number
  readonly plan: ShakePlan
  /** The channel or one of its derivatives per beat, order 0 to 3. */
  at(channel: MotionChannel, beat: number, order?: number): number
  /** The largest third derivative per beat cubed that any piece of the table between the two beats holds. */
  jerkPeak(channel: MotionChannel, from: number, to: number): number
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
  turnBeats: 0.175,
  easeBeats: 0.075,
  startTurn: 0.24,
  startEase: 0.1,
  stopTurn: 0.34,
  stopEase: 0.16,
  stopRest: 0.03,
  turnFloor: 0.2,
  firstReach: 1.4,
  slowStroke: 1.38,
  fastStroke: 1,
  breath: 0.72,
  returnBlend: 0.22,
  reachEnds: 1.08,
  reachWaist: 0.33,
  reachDraw: 0.04,
  /** The weight and the reach of each stroke, first to last, where a hand sets them one by one; empty, the two curves above draw them. */
  strokeWeights: [] as readonly number[],
  strokeReach: [] as readonly number[],
  peakReach: [1.02, 1.12],
  planDeg: [6, 10],
  leanDeg: [1.6, 1.9],
  leanShare: 0.74,
  awayMm: [13.3, 14.3],
  rimAirMm: 1.06,
  tiltHair: 0.00005,
  unlikeLength: 0.05,
  unlikeMoment: 0.06,
  redraws: 24,
  gripRockDeg: [1.6, 2],
  gripBeats: 0.36,
  gripSnap: 0,
  liftOffBeats: 0.14,
  liftEffort: 1.05,
  liftQuick: 0,
  windReach: [0.5, 0.62],
  windLate: 1.2,
  windShare: 0.84,
  windCarry: 0.8,
  dipShare: 0.286,
  dipRampBeats: 0.2,
  turnRoom: 0.04,
  lastReach: [0.5, 0.6],
  lastTurn: 0.34,
  touchShare: 0.8,
  lastTurnSlow: 1.7,
  fallPower: 9,
  fallSink: 0.3,
  fallStopBeats: 0.07,
  leanLag: 1.4,
  sagShare: 0.012,
  whipReach: 2.3,
  homeLead: 0,
  heldFlip: 0,
  heldLead: 0.028,
  heldTrace: 0.1,
  heldLast: 0.85,
  heldReach: 0.5,
  heldJoin: [0.055, 0.11],
  whipTurns: 3.2,
  whipDamping: 0.42,
  rockTurns: 3.1,
  rockDamping: 0.5,
  rockGain: [0.12, 0.2],
  ringFade: 0.75,
  lastUpright: 0.2,
  tremorTurns: [4.4, 7.4],
  tremorMm: 0.11,
  tremorDeg: 0.045,
  padRad: 0.003,
  landDeg: [8, 18],
  gripDeg: [8, 18],
  overshootDeg: [1.15, 1.25],
  approachDeg: 3.0,
  approachLead: 0.4,
  crestShare: 0.95,
  rockFirst: 0.34,
  rockChirp: 3,
  rockDecay: 3.2,
  contactLead: 0.11,
  rockShrink: 0,
  rockPower: 1.5,
  rockFade: 0.82,
  twistDeg: 0,
  twistEase: 3,
  twistTurns: 2.5,
  twistDamping: 0.55,
} as const

type Hand = { [K in keyof typeof HAND]: (typeof HAND)[K] extends readonly number[] ? readonly number[] : number }

/**
 * The hand of the film's shakes, the loop and the app. The stills of every season stand on the test shakes and the film's
 * opening on the preroll: those keep the first hand, number for number, so no still and no frame before the first shake moves.
 */
const HELD: Hand = {
  ...HAND,
  /** A lighter base lean and a lighter second axis leave the room under the cap to the lean of the strokes; a little more than that, so the top
   * still leans away from the lens through the quick strokes at the end. */
  leanDeg: [1.28, 1.48],
  rockGain: [0.11, 0.15],
  /** Beats before its edge meets the surface at which the globe is over its mark: it comes down the last of the way straight. */
  homeLead: 0.17,
  /** Beats one reversal of the lean takes. The fewest the limit on how hard a hand can turn a weight leaves. */
  heldFlip: 0.255,
  heldTrace: 0.2,
  heldReach: 0.6,
  heldJoin: [0.14, 0.09],
  heldLead: 0.07,
  /** More than the room under the rim gives, so each swoop is as deep as the rim's air allows: about 4 mm in the film, where 0.4 left 2.9. */
  dipShare: 0.7,
  /** The strokes, one by one. The first two are the heavy ones, slow, as a hand gets a weight going (about 14.5 frames each, 2.4 to 2.8 mm
   * a frame, and on the whole shorter); the last three are quick and long (12, 12 and 9 frames, 3.3 to 5.2 mm a frame). The middle breath the
   * curves drew is gone: it made the third stroke the slowest and the strokes before and after it alike. The three turns inside the swap
   * window keep their frames within half a frame, and the fastest instant of the last stroke keeps its frame. */
  strokeWeights: [1.35, 1.76, 1.62, 1.45, 1.42, 1],
  strokeReach: [1, 0.74, 0.74, 1, 0.95, 1.05],
  /** The rock after the landing: each rock lasts this share of the one before it, so the foot rocks over once, back, and once more, quicker each time. */
  overshootDeg: [2.3, 2.4],
  rockFirst: 0.74,
  rockShrink: 0.26,
  /** The set down. The foot comes down tipped further and is already turning toward flat when its edge meets the surface, and the fall is eased out over
   * the frames in which that turn gathers: the way down runs into the roll with no stop on the edge, and the foot goes flat faster than it fell. */
  approachDeg: 4.2,
  touchShare: 0.55,
  fallStopBeats: 0.16,
  rockPower: 1,
  rockFade: 0.74,
  /** The pick up. The hand takes the foot by the edge near the lens and tips it up in this share of the lift, as quickly as a hand can turn a weight:
   * the lean is there on the first frames, the far edge leaves the surface under it, and the globe comes up fast at first and slower toward the top. */
  gripSnap: 0.16,
  gripRockDeg: [3.6, 3.9],
  gripDeg: [26, 34],
  liftOffBeats: 0.055,
  liftQuick: 2.2,
  windLate: 1,
  awayMm: [13.6, 14.6],
  /** The twist. The wrist turns the globe about its own upright axis as it swings it, which needs no room under the foot: the turn trails the
   * wrist through a softer spring than the lean, so it whips past a few frames after each reversal and comes back more slowly than it went. */
  twistDeg: 10,
}
const keepsOldHand = (name: string): boolean => name === 'test' || name.startsWith('test:') || name === 'preroll'

const s5 = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 + u * (-15 + 6 * u)))
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
/** From 0 to 1 and at rest at both ends in speed, pull and the rate of the pull: a turn of the wrist with no step in jerk. */
const s7 = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * u * (35 + u * (-84 + u * (70 - 20 * u))))
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
const rockHeight = (sine: number, e: number): number => {
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
  const H: Hand = keepsOldHand(name) ? HAND : HELD
  const c = config.shake
  const rng = stream(`shake:${name}`)
  const liftEnd = c.liftBeats
  const strokesEnd = c.liftBeats + c.strokeBeats
  const landing = strokesEnd + c.setDownBeats
  const settle = c.landSettleSeconds / BEAT_SECONDS
  const endBeat = landing + settle
  const K = H.knots
  const h = 1 / K
  const last = Math.ceil(endBeat * K - 1e-9)
  const count = last + 1
  const iLift = Math.round(liftEnd * K)
  const iStrokes = Math.round(strokesEnd * K)
  const iLand = Math.round(landing * K)
  const beatOf = (i: number): number => i * h

  const first = rng.sign()
  const planAngle = rng.sign() * pick(rng, H.planDeg) * RAD
  const cap = Math.max(0, Math.min(c.tiltDeg * RAD, Math.asin(clamp((c.liftMm - H.rimAirMm) / FOOT_MM, 0, 1))))
  const lean = Math.min(pick(rng, H.leanDeg) * RAD, H.leanShare * cap)
  const awayMm = pick(rng, H.awayMm)
  const gripRock = pick(rng, H.gripRockDeg) * RAD
  const gripAngle = pick(rng, H.gripDeg) * RAD
  const landAngle = pick(rng, H.landDeg) * RAD
  const overshoot = pick(rng, H.overshootDeg) * RAD
  const windMm = pick(rng, H.windReach) * c.strokeMm
  const lastReach = pick(rng, H.lastReach)
  const iOff = Math.round(H.liftOffBeats * liftEnd * K)
  const liftOff = iOff * h
  const contactLead = H.contactLead * settle
  // The landing, solved backward from the bar: the foot rolls flat exactly on it, rocks over by the overshoot and rattles out.
  const lobe = H.rockFirst * settle
  const chirp = H.rockChirp / settle
  const decay = H.rockDecay / settle
  const rate = Math.PI / (lobe * (1 + chirp * lobe))
  const rockEnd = lobe / (1 - H.rockShrink)
  const shrinking = (t: number): number => {
    const left = 1 - t / rockEnd
    if (left <= 0) return 0
    return -Math.pow(left, H.rockPower) * Math.sin((Math.PI * Math.log(left)) / Math.log(H.rockShrink)) * (t > 0 ? 1 - s5((t / settle - H.rockFade) / (1 - H.rockFade)) : 1)
  }
  const chirped = (t: number): number => -Math.exp(-decay * t) * Math.sin(rate * t * (1 + chirp * t)) * (t > 0 ? 1 - s5(t / settle) : 1)
  const rattle = H.rockShrink > 0 ? shrinking : chirped
  let over = 0
  for (let t = 0; t < lobe; t += lobe / 400) over = Math.max(over, -rattle(t))
  const landGain = over > 0 ? overshoot / over : 0
  let crest = contactLead
  let crestValue = rattle(-contactLead)
  for (let t = contactLead; t < Math.min(0.9 * c.setDownBeats, 3 * contactLead); t += contactLead / 200) {
    const value = rattle(-t)
    if (value < crestValue || (H.rockShrink > 0 && value * landGain > H.approachDeg * RAD)) break
    crest = t
    crestValue = value
  }
  // The trailing edge meets the surface at the approach tilt, and the foot rolls flat on it, faster and faster, to be level exactly on the bar.
  const approach = Math.max(crestValue * landGain, H.approachDeg * RAD)
  const approachLead = Math.max(crest, H.approachLead * settle)
  const easeSpan = 2 * (H.crestShare * crest - contactLead)
  const eased = (lead: number): number => {
    const u = (lead - contactLead) / easeSpan
    return u >= 1 ? contactLead + 0.5 * easeSpan : lead - easeSpan * u * u * u * u * (2.5 + u * (u - 3))
  }
  const landTilt = (beat: number): number => {
    const t = beat - landing
    if (t >= -contactLead) return landGain * rattle(t)
    if (t <= -approachLead) return approach
    return approach + (landGain * rattle(-eased(-t)) - approach) * s5((t + approachLead) / (approachLead - contactLead))
  }
  const touch = landing - H.touchShare * approachLead
  const iTouch = Math.floor(touch * K)
  // Where the sideways travel is over. The first hand carries the globe across until its edge meets the surface; the held hand has it over its mark
  // before the last of the way down, so it comes down straight.
  const iHome = iTouch - Math.round(H.homeLead * K)
  const home = H.homeLead > 0 ? iHome * h : touch

  const lastBeat = strokesEnd + H.lastTurn * c.setDownBeats
  const lastSide = first * (Math.max(1, Math.round(c.strokes)) % 2 === 0 ? 1 : -1)
  /** The wind up: while it lifts, the hand draws the globe back to the side away from the first stroke. */
  const windEnd = Math.round((liftOff + H.windShare * (liftEnd - liftOff)) * K) * h
  // It is still moving out when the first stroke takes it back: the wind up ends in a reversal, not in a rest.
  const wind = (beat: number): number => (-first * windMm * s5(H.windCarry * Math.pow(clamp((beat - liftOff) / (windEnd - liftOff), 0, 1), H.windLate))) / s5(H.windCarry)

  // The strokes: targets on alternating sides, each with its own reach and its own moment, the hand speeding up.
  const n = Math.max(1, Math.round(c.strokes))
  let weights: number[] = []
  let reach: number[] = []
  let peakReach = 1
  let before = 0
  let whole = 0
  const drawStrokes = (): void => {
    const own = H.strokeWeights.length === n && H.strokeReach.length === n
    weights = [(own ? H.strokeWeights[0]! : H.firstReach) * rng.range(0.94, 1.06)]
    for (let i = 1; i < n; i++) {
      const t = n > 2 ? (i - 1) / (n - 2) : 1
      // The hand speeds up on the whole, but it takes one long breath in the middle: a slow, wide stroke before the last quick ones.
      const w = own ? H.strokeWeights[i]! : H.slowStroke + (H.fastStroke - H.slowStroke) * t * t * t + H.breath * Math.pow(Math.sin(Math.PI * t), 4)
      weights.push(i === n - 1 ? w * rng.range(0.96, 1) : Math.max(w * rng.range(0.93, 1.07), H.fastStroke * 1.05))
    }
    reach = []
    for (let k = 0; k < n; k++) {
      // Wide at both ends and narrow at the waist, so the strokes the lens sees differ in length as well as in time.
      const waist = Math.pow(Math.sin((Math.PI * k) / Math.max(1, n - 1)), 1.5)
      reach.push((own ? H.strokeReach[k]! : H.reachEnds - H.reachWaist * waist) + rng.range(-H.reachDraw, H.reachDraw))
    }
    peakReach = pick(rng, H.peakReach)
    before = weights.slice(0, n - 1).reduce((s, w) => s + w, 0)
    whole = weights.reduce((s, w) => s + w, 0)
  }
  const omega = TAU * H.springTurns
  const span = changeSpan('base')
  const bloomBeat = c.swapWindow.fromBeat + (c.swapWindow.toBeat - c.swapWindow.fromBeat) * ((span.from + span.to) / 2)
  const jerkLimit = H.jerkPerMm * c.strokeMm

  // The grip sweeps straight from target to target and makes each turn with a pull that cannot change faster than the limit on jerk.
  // The globe follows it through a stiff spring: it lags, and it overshoots a little at each turn.
  const sweepOf = (lag: number): { turnBeat: number[]; turnMm: number[]; stroke: Float64Array; anchored: boolean } => {
    let unit = (bloomBeat - lag - windEnd) / (before + (n > 1 ? weights[n - 1]! / 2 : 0))
    const anchored = n > 1 && unit > 0 && windEnd + whole * unit <= strokesEnd - H.turnRoom
    if (!anchored) unit = (strokesEnd - windEnd - 2 * H.turnRoom) / whole
    const back = home - lastBeat
    const turnBeat: number[] = [windEnd]
    const carry = (wind(windEnd) - wind(windEnd - h / 4)) / (h / 4)
    const turnMm: number[] = [-first * windMm]
    for (let k = 0; k < n; k++) {
      turnBeat.push(turnBeat[k]! + weights[k]! * unit)
      turnMm.push(first * (k % 2 === 0 ? 1 : -1) * reach[k]! * c.strokeMm)
    }
    // The last, slower swing carries the globe to the side it comes down from.
    turnBeat.push(lastBeat)
    turnMm.push(lastSide * lastReach * c.strokeMm)
    const stopCentre = home - H.stopRest * back - (H.stopTurn + H.stopEase) * back * 0.5
    const startCentre = windEnd + (H.startTurn + H.startEase) * unit * 0.5
    const sweeps: number[] = []
    for (let k = 0; k <= n; k++) sweeps.push((turnMm[k + 1]! - turnMm[k]! - (k === 0 ? carry * (startCentre - windEnd) : 0)) / (turnBeat[k + 1]! - (k === 0 ? startCentre : turnBeat[k]!)))
    sweeps.push(-turnMm[n + 1]! / (stopCentre - turnBeat[n + 1]!))
    const pulls: { at: number; dv: number; turn: number; ease: number }[] = []
    for (let k = 0; k <= n + 2; k++) {
      const dv = (k <= n + 1 ? sweeps[k]! : 0) - (k > 0 ? sweeps[k - 1]! : carry)
      const slow = k === n + 1 ? H.lastTurnSlow : 1
      const turn = k === 0 ? H.startTurn * unit : k === n + 2 ? H.stopTurn * back : H.turnBeats * unit * slow
      const ease = k === 0 ? H.startEase * unit : k === n + 2 ? H.stopEase * back : H.easeBeats * unit * slow
      pulls.push({ at: k === 0 ? startCentre : k === n + 2 ? stopCentre : turnBeat[k]!, dv, turn, ease: Math.max(ease, Math.abs(dv) / (turn * jerkLimit)) })
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
    const dt = h / H.substeps
    let g = 0
    let gv = 0
    let p = 0
    let v = 0
    for (let i = iOff; i <= iHome; i++) {
      stroke[i] = p
      for (let k = 0; k < H.substeps; k++) {
        const b = beatOf(i) + k * dt
        if (b + dt / 2 < windEnd) {
          g = wind(b + dt)
          gv = (wind(b + dt) - wind(b)) / dt
        } else {
          const ga = pull(b + dt / 2)
          g += gv * dt + (ga * dt * dt) / 2
          gv += ga * dt
        }
        const stop = s5((b - lastBeat) / (home - lastBeat))
        const zeta = H.damping + (H.stopDamping - H.damping) * stop
        v += (omega * omega * (g - p) + 2 * zeta * omega * (gv - v)) * dt
        p += v * dt
      }
    }
    const blend = back * H.returnBlend
    let peak = 0
    for (let i = iOff; i <= iHome; i++) {
      stroke[i] = stroke[i]! * (1 - s5((beatOf(i) - (home - blend)) / blend))
      if (i >= iLift && i <= iStrokes) peak = Math.max(peak, Math.abs(stroke[i]!))
    }
    const scale = peak > 0 ? (c.strokeMm * peakReach) / peak : 0
    for (let i = iOff; i <= iHome; i++) stroke[i] = i === iOff || i === iHome ? 0 : stroke[i]! * scale
    return { turnBeat, turnMm, stroke, anchored }
  }
  const extremesOf = (s: Float64Array): ShakeStroke[] => {
    const out: ShakeStroke[] = []
    let from = iLift + 1
    while (from < iStrokes && s[from]! * first <= 0) from++
    for (let i = from; i < iStrokes; i++) {
      const d0 = s[i]! - s[i - 1]!
      const d1 = s[i + 1]! - s[i]!
      if (d0 !== 0 && d0 * d1 <= 0 && Math.abs(s[i]!) > H.turnFloor * c.strokeMm) {
        const bend = d0 - d1
        out.push({ beat: beatOf(i) + (bend !== 0 ? (h * (d0 + d1)) / (2 * bend) : 0), mm: s[i]! })
      }
    }
    return out
  }

  // The fastest stroke is the last one: its middle is put on the middle of the outside parts' span, where the bloom peaks.
  const anchor = (): ReturnType<typeof sweepOf> => {
    let lag = (2 * H.damping) / omega
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
        least = Math.min(least, Math.max(length / H.unlikeLength, moment / H.unlikeMoment))
      }
    }
    return least
  }
  drawStrokes()
  let made = anchor()
  let unlike = unlikeOf(extremesOf(made.stroke))
  for (let again = 0; again < H.redraws && unlike < 1; again++) {
    drawStrokes()
    const next = anchor()
    const score = unlikeOf(extremesOf(next.stroke))
    if (score > unlike) {
      made = next
      unlike = score
    }
  }
  const { turnBeat, turnMm, stroke } = made
  const strokeRate = derive(stroke, h, (i) => i <= iOff || i >= iHome, [iOff, iHome]).d1

  // The rocking. A held globe pivots about the wrist: its top swings out with each stroke and is furthest over just after each reversal,
  // which the lens sees as a roll. The second axis follows the stroke's speed, so it is out of step with the first.
  const ringHold = lastBeat
  const ringEnd = lastBeat + H.ringFade * (touch - lastBeat)
  const follower = (drive: Float64Array, turns: number, damping: number): Float64Array => {
    const out = new Float64Array(count)
    const w = TAU * turns
    const dt = h / H.substeps
    let p = 0
    let v = 0
    for (let i = iOff; i < count && beatOf(i) < ringEnd; i++) {
      out[i] = p * (1 - s5((beatOf(i) - ringHold) / (ringEnd - ringHold)))
      const u0 = drive[i]!
      const u1 = i + 1 < count ? drive[i + 1]! : 0
      for (let k = 0; k < H.substeps; k++) {
        const u = u0 + ((u1 - u0) * k) / H.substeps
        v += (w * w * (u - p) - 2 * damping * w * v) * dt
        p += v * dt
      }
    }
    return out
  }
  // The wrist is over as far as it goes well before the end of a long stroke, so a short stroke rolls the globe nearly as far as a long one.
  const wrist = new Float64Array(count)
  for (let i = 0; i < count; i++) wrist[i] = Math.tanh((H.whipReach * stroke[i]!) / c.strokeMm)
  const whip = follower(wrist, H.whipTurns, H.whipDamping)
  const rock = follower(strokeRate, H.rockTurns, H.rockDamping)
  let whipPeak = 0
  let rockPeak = 0
  for (let i = iLift; i <= iStrokes; i++) {
    whipPeak = Math.max(whipPeak, Math.abs(whip[i]!))
    rockPeak = Math.max(rockPeak, Math.abs(rock[i]!))
  }
  const rockGain = rng.sign() * pick(rng, H.rockGain)
  // The twist answers the pull, not the place: the globe sits in the hand ahead of the wrist, so the hand's pull at a reversal swings the
  // front of the glass on past the turn, some frames late, and between the turns, where the hand only carries it, it comes back. The pull
  // is eased through a stiff spring first, so the turn is as quick as the bound on jerk lets a hand turn a weight and no quicker.
  const twist = new Float64Array(count)
  if (H.twistDeg > 0) {
    const pullOf = derive(stroke, h, (i) => i <= iOff || i >= iHome, [iOff, iHome]).d2
    const kick = new Float64Array(count)
    for (let i = 0; i < count; i++) kick[i] = -pullOf[i]!
    const spun = follower(follower(kick, H.twistEase, 1), H.twistTurns, H.twistDamping)
    let most = 0
    for (let i = 0; i < count; i++) most = Math.max(most, Math.abs(spun[i]!))
    for (let i = 0; i < count; i++) twist[i] = most > 0 ? (spun[i]! / most) * H.twistDeg * RAD : 0
  }

  const strokes = extremesOf(stroke)
  let lastSwing: ShakeStroke = { beat: lastBeat, mm: 0 }
  for (let i = iStrokes; i < iHome; i++) if (Math.abs(stroke[i]!) > Math.abs(lastSwing.mm) && stroke[i]! * lastSide > 0) lastSwing = { beat: beatOf(i), mm: stroke[i]! }
  // The roll the lens sees, as a share of the whole. The first hand lets the top follow the stroke as a spring does, so it is upright through
  // the middle of every stroke. The held hand keeps the lean it took at a reversal through the stroke that follows and brings the top across
  // late, in one move as quick as the limit on jerk allows, so that it is over on the new side just after the next reversal: most frames of
  // a stroke show a leaning globe, and the lean trails the hand.
  const swing = new Float64Array(count)
  for (let i = 0; i < count; i++) swing[i] = whipPeak > 0 ? whip[i]! / whipPeak : 0
  if (H.heldFlip > 0 && strokes.length > 0) {
    // A long stroke throws the top further over than a short one.
    const longest = strokes.reduce((most, t) => Math.max(most, Math.abs(t.mm)), 0)
    const flips = [...strokes.map((t) => ({ end: t.beat + H.heldLead, to: Math.sign(t.mm) * Math.pow(Math.abs(t.mm) / longest, H.heldReach) })), { end: lastSwing.beat + H.heldLead, to: lastSide * H.heldLast }]
    const joinFrom = strokes[0]!.beat - H.heldJoin[0]!
    const joinTo = strokes[0]!.beat + H.heldJoin[1]!
    for (let i = 0; i < count; i++) {
      const b = beatOf(i)
      if (b <= joinFrom) continue
      let side = -Math.sign(strokes[0]!.mm)
      let held = side
      for (const f of flips) {
        held += (f.to - side) * s5((b - f.end + H.heldFlip) / H.heldFlip)
        side = f.to
      }
      const faded = b < ringEnd ? held * (1 - s5((b - ringHold) / (ringEnd - ringHold))) : 0
      const mixed = (1 - H.heldTrace) * faded + H.heldTrace * swing[i]!
      swing[i] = swing[i]! + (mixed - swing[i]!) * s5((b - joinFrom) / (joinTo - joinFrom))
    }
  }

  const gripBeats = H.gripBeats * liftEnd
  const hold = { x: -Math.cos(planAngle), z: -Math.sin(planAngle) }
  const along = { x: Math.sin(planAngle), z: -Math.cos(planAngle) }
  // The hand takes the globe from the side it will draw it back to, so that edge of the foot comes up first and the top tips the other way,
  // toward the first stroke. The far edge breaks contact as the wind up swings the foot level, and the whole rim is clear before the roll comes back over.
  // It comes down on the edge that trails the last swing.
  const gripDir = { x: -Math.sin(gripAngle), z: -first * Math.cos(gripAngle) }
  const landDir = { x: -Math.sin(landAngle), z: -lastSide * Math.cos(landAngle) }
  const landGap = c.liftMm - rockHeight(Math.sin(approach), H.padRad)
  const rise = (beat: number): number => {
    const u = clamp((beat - liftOff) / (liftEnd - liftOff), 0, 1)
    return H.liftQuick > 0 ? s5(1 - Math.pow(1 - u, H.liftQuick)) : s5(Math.pow(u, H.liftEffort))
  }
  // The fall: it sinks through the last swing, then comes down faster and faster, and is stopped short as the trailing edge meets the surface.
  const fallen = new Float64Array(count)
  {
    const stop = H.fallStopBeats / (touch - strokesEnd)
    const speed = (beat: number): number => {
      const u = clamp((beat - strokesEnd) / (touch - strokesEnd), 0, 1)
      return (H.fallSink * 2 * u + (1 - H.fallSink) * H.fallPower * Math.pow(u, H.fallPower - 1)) * (1 - s5((u - (1 - stop)) / stop))
    }
    let sum = 0
    for (let i = iStrokes + 1; i < count; i++) {
      if (beatOf(i) <= touch) sum += (speed(beatOf(i - 1)) + 4 * speed(beatOf(i) - h / 2) + speed(beatOf(i))) / 6
      fallen[i] = sum
    }
    for (let i = iStrokes + 1; i < count; i++) fallen[i] = beatOf(i) >= touch ? 1 : fallen[i]! / sum
  }

  const shiver = { x: tremorOf(rng), y: tremorOf(rng), z: tremorOf(rng), tiltX: tremorOf(rng), tiltZ: tremorOf(rng) }
  const airFade = Math.min(strokesEnd + 0.75 * c.setDownBeats, touch)
  const inAir = (beat: number): number => s5((beat - liftOff - 0.1 * liftEnd) / (liftEnd - liftOff - 0.1 * liftEnd)) * (1 - s5((beat - ringHold) / (airFade - ringHold)))
  const inHold = (beat: number): number => s5((beat - liftEnd) / (0.125 * c.strokeBeats)) * (1 - s5((beat - strokesEnd + 0.125 * c.strokeBeats) / (0.125 * c.strokeBeats)))

  const x = new Float64Array(count)
  const y = new Float64Array(count)
  const z = new Float64Array(count)
  const yTop = new Float64Array(count)
  const pump = new Float64Array(count)
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
    const a = swing[i]!
    let lx: number
    let lz: number
    if (b <= liftEnd) {
      const up = rise(b)
      const held = Math.pow(up, H.leanLag)
      const rocked = gripRock * (H.gripSnap > 0 ? s7(b / (H.gripSnap * liftEnd)) : s5(b / gripBeats)) * (1 - held)
      lx = rocked * gripDir.x + lean * held * hold.x
      lz = rocked * gripDir.z + lean * held * hold.z
      yTop[i] = rockHeight(tiltSine(lx, lz), H.padRad) + (c.liftMm - rockHeight(Math.sin(lean), H.padRad)) * up
      z[i] = -awayMm * up
    } else if (b < strokesEnd) {
      lx = lean * hold.x
      lz = lean * hold.z
      yTop[i] = c.liftMm - H.sagShare * c.liftMm * inHold(b) * (0.5 + 0.5 * shiver.y(b))
      // The pump: the globe swoops low through the middle of a stroke, where it is upright, and is carried up to each end, where it is furthest over.
      pump[i] = (1 - a * a) * (1 - a * a) * s5((b - liftEnd) / H.dipRampBeats) * (1 - s5((b - bloomBeat) / (strokesEnd - bloomBeat)))
      z[i] = -awayMm
    } else {
      const down = 1 - fallen[i]!
      const flat = landTilt(b)
      // The hand turns the foot toward the edge it will land on all the way down, not at the last moment.
      const held = 1 - s5((b - strokesEnd) / (touch - strokesEnd))
      lx = flat * landDir.x + (lean * hold.x - approach * landDir.x) * held
      lz = flat * landDir.z + (lean * hold.z - approach * landDir.z) * held
      yTop[i] = rockHeight(Math.sin(Math.abs(flat)), H.padRad) + landGap * down
      z[i] = -awayMm * down
    }
    x[i] = s * Math.cos(planAngle) + H.tremorMm * 0.6 * inHold(b) * shiver.x(b)
    z[i] = z[i]! + s * Math.sin(planAngle) + H.tremorMm * air * shiver.z(b)
    baseX[i] = lx + H.tremorDeg * RAD * air * shiver.tiltX(b)
    baseZ[i] = lz + H.tremorDeg * RAD * air * shiver.tiltZ(b)
    leanOnly[i] = Math.hypot(lx, lz)
    const r = rockPeak > 0 ? (rock[i]! / rockPeak) * rockGain : 0
    // The hand is already bringing the globe upright for the table through the last swing, so that swing rolls it less than a stroke does.
    const upright = b > strokesEnd ? 1 - H.lastUpright * s5((b - strokesEnd) / (lastBeat - strokesEnd)) : 1
    moveX[i] = (a * along.x + r * hold.x) * upright
    moveZ[i] = (a * along.z + r * hold.z) * upright
  }

  // One factor for the whole shake: the rocking as large as the config's tilt allows. Then the pump as deep as the room under the rim allows.
  const fits = (k: number, dip: number): boolean => {
    for (let i = iOff + 1; i < count && beatOf(i) < touch; i++) {
      const tx = baseX[i]! + k * moveX[i]!
      const tz = baseZ[i]! + k * moveZ[i]!
      const sine = tiltSine(tx, tz)
      if (Math.asin(Math.min(1, sine)) > c.tiltDeg * RAD - H.tiltHair) return false
      const height = yTop[i]! - dip * pump[i]!
      const gap = height - FOOT_MM * sine
      // In the lift the foot may still be on the felt: it is never asked to stand higher than a foot rocking on its rim does.
      const needs = i < iLift ? Math.min(0, rockHeight(sine, H.padRad) - FOOT_MM * sine) : i <= iStrokes ? H.rimAirMm : Math.min(H.rimAirMm, 0.5 * (height - FOOT_MM * Math.sin(leanOnly[i]!)))
      if (gap < needs) return false
    }
    return true
  }
  const most = (ok: (v: number) => boolean, top: number): number => {
    if (ok(top)) return top
    let lo = 0
    let hi = top
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2
      if (ok(mid)) lo = mid
      else hi = mid
    }
    return ok(lo) ? lo : 0
  }
  const rocking = most((k) => fits(k, 0), c.tiltDeg * RAD * 2)
  const dipMm = most((d) => fits(rocking, d), H.dipShare * c.liftMm)
  for (let i = 0; i < count; i++) y[i] = yTop[i]! - dipMm * pump[i]!
  const tiltX = new Float64Array(count)
  const tiltZ = new Float64Array(count)
  let peakTilt = 0
  for (let i = 0; i < count; i++) {
    tiltX[i] = baseX[i]! + rocking * moveX[i]!
    tiltZ[i] = baseZ[i]! + rocking * moveZ[i]!
    peakTilt = Math.max(peakTilt, Math.asin(Math.min(1, tiltSine(tiltX[i]!, tiltZ[i]!))))
  }
  let twistPeak = 0
  for (let i = 0; i < count; i++) {
    if (beatOf(i) >= touch) twist[i] = 0
    twistPeak = Math.max(twistPeak, Math.abs(twist[i]!))
  }
  for (const v of [x, y, z, tiltX, tiltZ, twist]) {
    v[0] = 0
    v[iLand] = 0
    for (let i = 0; i < count; i++) if (beatOf(i) >= endBeat) v[i] = 0
  }
  y[iLift] = c.liftMm
  y[iStrokes] = c.liftMm
  const iRest = iHome

  const ends = (i: number): boolean => i === 0 || beatOf(i) >= endBeat
  const iEnd = Math.min(last, Math.ceil(endBeat * K - 1e-9))
  const channels: Record<MotionChannel, Channel> = {
    x: derive(x, h, (i) => ends(i) || i <= iOff || i >= iRest, [iOff, iRest]),
    y: derive(y, h, (i) => ends(i) || i === iLift || i === iStrokes, [0, iLift, iStrokes, iEnd]),
    z: derive(z, h, ends, [0, iEnd]),
    tiltX: derive(tiltX, h, ends, [0, iEnd]),
    tiltZ: derive(tiltZ, h, ends, [0, iEnd]),
    twist: derive(twist, h, ends, [0, iEnd]),
  }

  let fastest = { beat: liftEnd, mmPerBeat: 0 }
  for (let i = iLift + 1; i < iStrokes; i++) if (Math.abs(strokeRate[i]!) > fastest.mmPerBeat) fastest = { beat: beatOf(i), mmPerBeat: Math.abs(strokeRate[i]!) }

  const at = (channel: MotionChannel, beat: number, order = 0): number => {
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
  const jerkPeak = (channel: MotionChannel, from: number, to: number): number => {
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
      gripTurns: turnBeat.slice(1, n + 1).map((beat, k) => ({ beat, mm: turnMm[k + 1]! })),
      strokes,
      fastest,
      rocking,
      dipMm,
      windMm,
      lastTurn: lastSwing,
      touch,
      peakTilt,
      rollStart: touch,
      overshoot,
      settleEnd: endBeat,
      twistPeak,
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
  const twists = m.plan.twistPeak > 0
  const path: ShakePath = {
    parts: { ...m.parts },
    poseAt(beat: number): GlobePose {
      if (!(beat > 0) || beat >= m.endBeat || beat === landing) return REST_POSE
      const x = m.at('x', beat)
      const pose: GlobePose = { x: x === 0 ? 0 : x, y: m.at('y', beat), z: m.at('z', beat), tiltX: m.at('tiltX', beat), tiltZ: m.at('tiltZ', beat) }
      if (twists) {
        const twist = m.at('twist', beat)
        pose.twist = twist === 0 ? 0 : twist
      }
      return pose
    },
  }
  paths.set(name, path)
  return path
}
