import { describe, expect, it, vi } from 'vitest'
import { config, shots } from '../src/config'
import { FRAME } from '../src/app/framing'
import { poseOfRig, rigOf } from '../src/film/moves'
import { sphereCentreHeightMm } from '../src/scene/framing'
import { REST_POSE, SHAKE_CHANNELS, makeShake, shakeMotion, tiltSine, type GlobePose, type ShakeChannel } from '../src/shake/table'

const s = config.shake
const BEAT_S = 60 / config.film.defaultBpm
const FRAME_BEATS = 1 / config.film.fps / BEAT_S
const DEG = 180 / Math.PI
const G_MM_S2 = 9810
const FOOT_MM = config.globe.baseDiameterMm / 2

/** The hand's limits at the default tempo. A snap, a step in speed or in pull, breaks every one of them at any sampling. */
const JERK_MM_S3 = 2e6
const JERK_DEG_S3 = 2.5e5
const PULL_G = 3
const SPEED_MM_S = 600
/** A reversal is sharp when the globe is under half of the stroke's speed for less than this share of the stroke. A sine spends a third. */
const SLOW_SHARE = 0.2
const REVERSAL_G = 1.8
/** The felt under the foot: how far the model lets the rim sink while the foot rolls flat. */
const PAD_MM = 0.05
/** Two strokes are alike when they agree in length to within this share of `strokeMm` and in time to within this share of the longer one. */
const UNLIKE_LENGTH = 0.04
const UNLIKE_MOMENT = 0.05
/** A globe in the air is still when the lens sees its glass move less than this share of the frame's width across three frames: 4 px of 1920, 80 px a second. */
const STILL_SHARE = 4 / 1920
/** What the lens must see of the strokes: the longest over the shortest, in length and in time, and the rise and fall of the glass as a share of the frame's height. */
const SEEN_LENGTH = 1.25
const SEEN_MOMENT = 1.5
const SEEN_PUMP = 9 / 1080

/** The shakes that keep the first hand: every still of a season and the film's opening stand on them. */
const FIRST_HAND = (name: string): boolean => name === 'test' || name.startsWith('test:') || name === 'preroll'
/** The most the foot of the held hand rocks over after the landing, in degrees. */
const OVERSHOOT_HELD_DEG = 1.9

const film = shots.filter((shot) => shot.kind === 'shake').map((shot) => shot.id)
const NAMES = ['test', ...config.seasons.map((season) => `test:${season}`), 'preroll', ...film, 'loop', ...Array.from({ length: FRAME.shakePaths }, (_, i) => `live-${i}`)]
const LINEAR: ShakeChannel[] = ['x', 'y', 'z']
const ANGULAR: ShakeChannel[] = ['tiltX', 'tiltZ']

const rimGap = (p: GlobePose): number => p.y - FOOT_MM * tiltSine(p.tiltX, p.tiltZ)
const tiltOf = (p: GlobePose): number => Math.asin(Math.min(1, tiltSine(p.tiltX, p.tiltZ)))

const HD = config.formats.hd
const hero = poseOfRig(rigOf('hero'))
/** A point of the globe through the `hero` lens at `hd`, in pixels: the globe turned and placed as the stage turns and places it. */
function throughLens(g: GlobePose, x: number, y: number, z: number): { x: number; y: number } {
  const e = hero.position
  const a = hero.aim
  const f = [a.x - e.x, a.y - e.y, a.z - e.z]
  const fl = Math.hypot(f[0]!, f[1]!, f[2]!)
  const [fx, fy, fz] = [f[0]! / fl, f[1]! / fl, f[2]! / fl]
  const rl = Math.hypot(fz, fx)
  const [rx, rz] = [-fz / rl, fx / rl]
  const [ux, uy, uz] = [-rz * fy, rz * fx - rx * fz, rx * fy]
  const k = Math.tan((hero.fovDeg * Math.PI) / 360)
  const cz = Math.cos(g.tiltZ)
  const sz = Math.sin(g.tiltZ)
  const cx = Math.cos(g.tiltX)
  const sx = Math.sin(g.tiltX)
  const ax = x * cz - y * sz
  const ay = x * sz + y * cz
  const wx = ax + g.x - e.x
  const wy = ay * cx - z * sx + g.y - e.y
  const wz = ay * sx + z * cx + g.z - e.z
  const X = wx * rx + wz * rz
  const Y = wx * ux + wy * uy + wz * uz
  const Z = wx * fx + wy * fy + wz * fz
  return { x: HD.width / 2 + (X / Z / k) * (HD.height / 2), y: HD.height / 2 - (Y / Z / k) * (HD.height / 2) }
}
/** What the eye follows: the middle of the glass in pixels, and the roll of the globe about the lens axis in degrees, the top to the right counted up. */
function seen(g: GlobePose): { x: number; y: number; roll: number } {
  const glass = throughLens(g, 0, sphereCentreHeightMm, 0)
  const foot = throughLens(g, 0, 0, 0)
  return { x: glass.x, y: glass.y, roll: Math.atan2(glass.x - foot.x, foot.y - glass.y) * DEG }
}

describe('the shake path: a table in beats from the seed', () => {
  it('is written in the config beats and ends with the settle', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      expect(path.parts).toEqual({ liftEnd: s.liftBeats, strokesEnd: s.liftBeats + s.strokeBeats, landing: s.liftBeats + s.strokeBeats + s.setDownBeats })
      expect(m.parts).toEqual(path.parts)
      expect(m.endBeat).toBeCloseTo(path.parts.landing + s.landSettleSeconds / BEAT_S, 12)
      expect(m.plan.strokes.length).toBe(s.strokes)
    }
  })

  it('rests before the lift, on the landing and once the settle is over', () => {
    for (const name of NAMES) {
      const path = makeShake(name)
      const end = shakeMotion(name).endBeat
      for (const b of [-3, 0, path.parts.landing, end, end + 1e-9, end + 0.5, end + 40]) {
        const p = path.poseAt(b)
        expect(p, `${name} at ${b}`).toEqual(REST_POSE)
        expect(Object.is(p.x, 0)).toBe(true)
      }
      expect(tiltOf(path.poseAt(path.parts.landing + 0.15 * (end - path.parts.landing))) * DEG).toBeGreaterThan(0.1)
    }
  })

  it('reads the pose from the table', () => {
    for (const name of ['test', 'shake-2', 'loop']) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      for (let b = 0.013; b < m.endBeat; b += 0.0371) {
        const p = path.poseAt(b)
        for (const ch of SHAKE_CHANNELS) expect(p[ch]).toBe(m.at(ch, b) === 0 ? 0 : m.at(ch, b))
      }
    }
  })

  it('is the same table from a fresh module, in any order of asking', async () => {
    const beats = Array.from({ length: 240 }, (_, i) => 0.01 + i * 0.0194)
    const first = ['test', 'shake-3', 'live-5'].map((name) => beats.map((b) => makeShake(name).poseAt(b)))
    vi.resetModules()
    const fresh = await import('../src/shake/table')
    const again = ['live-5', 'shake-3', 'test'].map((name) => [...beats].reverse().map((b) => fresh.makeShake(name).poseAt(b)))
    expect(fresh.makeShake('test')).not.toBe(makeShake('test'))
    expect(again[2]!.reverse()).toEqual(first[0])
    expect(again[1]!.reverse()).toEqual(first[1])
    expect(again[0]!.reverse()).toEqual(first[2])
    expect(makeShake('test')).toBe(makeShake('test'))
  })
})

describe('the shake path: continuous from the first frame of the lift to the end of the settle', () => {
  it('joins its pieces in position, velocity and acceleration at every knot', () => {
    const tolerance = [1e-6, 1e-4, 1e-3]
    const hair = 1e-10
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const knots = Math.round(m.endBeat * m.knotsPerBeat)
      for (const ch of SHAKE_CHANNELS) {
        const scale = ANGULAR.includes(ch) ? 1 / 58 : 1
        for (let i = 1; i < knots; i++) {
          const b = i / m.knotsPerBeat
          for (let order = 0; order <= 2; order++) {
            const gap = Math.abs(m.at(ch, b - hair, order) - m.at(ch, b, order))
            if (gap > tolerance[order]! * scale) throw new Error(`${name} ${ch} order ${order} steps by ${gap} at beat ${b}`)
          }
        }
      }
    }
  })

  it('leaves rest and returns to it without a step: zero, with no speed and no pull, at both ends and flat on the landing', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      for (const ch of SHAKE_CHANNELS) {
        for (let order = 0; order <= 2; order++) {
          expect(Math.abs(m.at(ch, 1e-10, order)), `${name} ${ch} ${order} at the start`).toBeLessThan(1e-3)
          expect(Math.abs(m.at(ch, m.endBeat - 1e-10, order)), `${name} ${ch} ${order} at the end`).toBeLessThan(1e-3)
        }
        expect(Math.abs(m.at(ch, m.parts.landing - 1e-10))).toBeLessThan(1e-8)
        expect(Math.abs(m.at(ch, m.parts.landing + 1e-10))).toBeLessThan(1e-8)
        expect(m.at(ch, m.parts.landing)).toBe(0)
      }
    }
  })

  it('bounds the jerk of every piece', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      for (const ch of LINEAR) expect(m.jerkPeak(ch, 0, m.endBeat) / BEAT_S ** 3, `${name} ${ch}`).toBeLessThan(JERK_MM_S3)
      for (const ch of ANGULAR) expect((m.jerkPeak(ch, 0, m.endBeat) * DEG) / BEAT_S ** 3, `${name} ${ch}`).toBeLessThan(JERK_DEG_S3)
      for (const ch of SHAKE_CHANNELS) {
        const peak = m.jerkPeak(ch, 0, m.endBeat)
        expect(peak).toBeGreaterThan(0)
        for (let b = 0.0003; b < m.endBeat; b += 0.00137) expect(Math.abs(m.at(ch, b, 3))).toBeLessThanOrEqual(peak * (1 + 1e-9))
      }
    }
  })

  it('never snaps: speed, pull and jerk read from the pose alone stay inside the hand, at 2400 samples a second', () => {
    const dt = 1 / 2400 / BEAT_S
    for (const name of NAMES) {
      const path = makeShake(name)
      const m = shakeMotion(name)
      const steps = Math.ceil((m.endBeat + 0.05) / dt)
      const worst = { speed: 0, pull: 0, jerk: 0, spin: 0 }
      const p: GlobePose[] = []
      for (let i = -3; i <= steps; i++) {
        p.push(path.poseAt(i * dt))
        if (p.length < 4) continue
        const [a, b, c, d] = p.slice(-4) as [GlobePose, GlobePose, GlobePose, GlobePose]
        const of = (k: ShakeChannel): [number, number, number] => [(d[k] - c[k]) / dt, (d[k] - 2 * c[k] + b[k]) / (dt * dt), (d[k] - 3 * c[k] + 3 * b[k] - a[k]) / (dt * dt * dt)]
        for (const ch of LINEAR) {
          const [v, acc, j] = of(ch)
          worst.speed = Math.max(worst.speed, Math.abs(v) / BEAT_S)
          worst.pull = Math.max(worst.pull, Math.abs(acc) / BEAT_S ** 2 / G_MM_S2)
          worst.jerk = Math.max(worst.jerk, Math.abs(j) / BEAT_S ** 3)
        }
        for (const ch of ANGULAR) worst.spin = Math.max(worst.spin, (Math.abs(of(ch)[2]) * DEG) / BEAT_S ** 3)
      }
      expect(worst.speed, `${name} speed`).toBeLessThan(SPEED_MM_S)
      expect(worst.pull, `${name} pull`).toBeLessThan(PULL_G)
      expect(worst.jerk, `${name} jerk`).toBeLessThan(JERK_MM_S3)
      expect(worst.spin, `${name} tilt jerk`).toBeLessThan(JERK_DEG_S3)
    }
  })
})

describe('the shake path: a heavy thing in a hand', () => {
  it('is gripped before it lifts: the foot rocks on the surface, then leaves it, drawn to the side away from the first stroke and rolled that way, and eases at the top', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const off = m.plan.liftOff
      // The first hand waits on the felt and leaves it with effort. The held hand does not wait: its far edge is off within three frames of the press.
      if (FIRST_HAND(name)) expect(off).toBeGreaterThan(0.1 * s.liftBeats)
      else expect(off).toBeLessThanOrEqual(3 * FRAME_BEATS)
      expect(off).toBeLessThan(0.5 * s.liftBeats)
      let rocked = 0
      for (let b = 0.002; b <= off; b += 0.002) {
        const p = path.poseAt(b)
        rocked = Math.max(rocked, tiltOf(p) * DEG)
        expect(Math.abs(rimGap(p)), `${name} at ${b}`).toBeLessThan(PAD_MM)
      }
      expect(rocked).toBeGreaterThan(0.3)
      expect(rocked).toBeLessThan(1)
      let fastest = { beat: 0, v: 0 }
      for (let b = 0.002; b <= s.liftBeats; b += 0.002) if (m.at('y', b, 1) > fastest.v) fastest = { beat: b, v: m.at('y', b, 1) }
      if (FIRST_HAND(name)) expect(fastest.beat, `${name} lift`).toBeGreaterThan((off + s.liftBeats) / 2)
      else {
        // The held hand reads from its first three frames: the lean leads the rise, the near edge of the foot is up before the far one leaves,
        // and the globe comes up quickly off the table and slower toward the top, never falling back.
        const third = path.poseAt(3 * FRAME_BEATS)
        expect(tiltOf(third) * DEG, `${name} lean on the third frame`).toBeGreaterThan(1.8)
        expect(third.tiltX, `${name} the edge near the lens comes up`).toBeLessThan(0)
        expect(FOOT_MM * tiltSine(third.tiltX, third.tiltZ) + third.y, `${name} high edge on the third frame`).toBeGreaterThan(4)
        expect(rimGap(third), `${name} low edge on the third frame`).toBeLessThan(0.5)
        expect(fastest.beat, `${name} lift`).toBeLessThan(0.15 * s.liftBeats)
        expect(path.poseAt(0.25 * s.liftBeats).y, `${name} up early`).toBeGreaterThan(0.6 * s.liftMm)
        expect(path.poseAt(0.5 * s.liftBeats).y, `${name} up early`).toBeGreaterThan(0.9 * s.liftMm)
        for (let b = FRAME_BEATS / 4; b <= s.liftBeats; b += FRAME_BEATS / 4) expect(m.at('y', b, 1), `${name} rises at ${b.toFixed(3)}`).toBeGreaterThan(-1e-6)
      }
      expect(m.at('y', s.liftBeats, 1)).toBe(0)
      expect(m.at('y', s.liftBeats, 2)).toBe(0)
      const top = path.poseAt(s.liftBeats)
      expect(top.y).toBeCloseTo(s.liftMm, 9)
      expect(top.tiltX).toBeLessThan(0)
      expect(tiltOf(top) * DEG).toBeLessThanOrEqual(s.tiltDeg)
      expect(top.z).toBeLessThan(0)
      // A lean away from the lens is not seen from the front. The pick up is a wind up: the lens sees the glass go to the side and roll that way.
      const side = -Math.sign(m.plan.strokes[0]!.mm)
      const rest = seen(REST_POSE)
      let shift = 0
      let roll = 0
      let across = 0
      for (let b = off; b <= s.liftBeats; b += FRAME_BEATS / 4) {
        const p = path.poseAt(b)
        const now = seen(p)
        shift = Math.max(shift, side * p.x)
        roll = Math.max(roll, side * now.roll)
        across = Math.max(across, side * (now.x - rest.x))
      }
      expect(shift / s.strokeMm, `${name} wind up`).toBeGreaterThan(0.4)
      expect(shift, `${name} wind up`).toBeLessThan(1.1 * m.plan.windMm)
      expect(roll, `${name} roll in the lift`).toBeGreaterThan(0.5 * s.tiltDeg)
      expect(across / HD.width, `${name} shift on screen`).toBeGreaterThan(0.04)
    }
  })

  it('breaks contact cleanly: the grip tips the top toward the first stroke, the far edge leaves as the wind up swings the foot level, and the whole rim is clear before the roll comes back over', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const off = m.plan.liftOff
      const side = -Math.sign(m.plan.strokes[0]!.mm)
      // The hand takes it from the side it will draw it back to: that edge comes up first, so the lens sees the top go the other way before the wind up.
      expect(side * seen(path.poseAt(off)).roll, `${name} tip at lift off`).toBeLessThan(-0.3)
      let tip = { beat: off, roll: 0 }
      for (let b = off; b <= s.liftBeats; b += FRAME_BEATS / 8) {
        const roll = side * seen(path.poseAt(b)).roll
        if (roll < tip.roll) tip = { beat: b, roll }
      }
      // The held hand tips it further, so that the frame shows the edge come up.
      expect(tip.roll, `${name} tip`).toBeLessThan(FIRST_HAND(name) ? -1.2 : -2.6)
      expect(tip.roll, `${name} tip`).toBeGreaterThan(FIRST_HAND(name) ? -2.2 : -4.2)
      expect(tip.beat, `${name} tip`).toBeLessThan(0.4 * s.liftBeats)
      // The foot swings level in the first part of the lift, and when it is level the whole rim is off the surface.
      let level = { beat: tip.beat, tilt: Infinity }
      for (let b = tip.beat; b <= s.liftBeats; b += FRAME_BEATS / 8) {
        const t = tiltOf(path.poseAt(b)) * DEG
        if (t < level.tilt) level = { beat: b, tilt: t }
      }
      // The held hand tips the edge near the lens up as well, and keeps that lean away from the lens as the roll swings level.
      expect(level.tilt, `${name} level`).toBeLessThan(FIRST_HAND(name) ? 1.2 : 1.9)
      expect(level.beat, `${name} level`).toBeLessThan(0.6 * s.liftBeats)
      expect(rimGap(path.poseAt(level.beat)), `${name} clear when level`).toBeGreaterThan(0.3 * s.liftMm)
      // No edge drags: once the low edge is off the felt it only rises until the foot is level, it is a millimetre clear before the middle of the lift, and the roll of the wind up never brings it back down.
      let clear = Number.NaN
      let free = false
      let before = -Infinity
      for (let b = off; b <= level.beat; b += FRAME_BEATS / 8) {
        const gap = rimGap(path.poseAt(b))
        if (!free && gap > PAD_MM) free = true
        if (free) expect(gap, `${name} low edge at ${b.toFixed(3)}`).toBeGreaterThan(before)
        if (free) before = gap
        if (Number.isNaN(clear) && gap >= 1) clear = b
      }
      expect(clear, `${name} a millimetre clear`).toBeLessThan(0.45 * s.liftBeats)
      let low = Infinity
      for (let b = level.beat; b <= s.liftBeats; b += FRAME_BEATS / 8) low = Math.min(low, rimGap(path.poseAt(b)))
      expect(low, `${name} rim through the wind up`).toBeGreaterThan(0.3 * s.liftMm)
    }
  })

  it('makes the config count of strokes on alternating sides, each about strokeMm, unequal, the hand speeding up', () => {
    for (const name of NAMES) {
      const turns = shakeMotion(name).plan.strokes
      expect(turns.length).toBe(s.strokes)
      const gaps = turns.map((t, k) => t.beat - (k === 0 ? s.liftBeats : turns[k - 1]!.beat))
      const lengths = turns.map((t, k) => Math.abs(t.mm - (k === 0 ? 0 : turns[k - 1]!.mm)))
      for (let k = 0; k < turns.length; k++) {
        const t = turns[k]!
        if (k > 0) expect(Math.sign(t.mm)).toBe(-Math.sign(turns[k - 1]!.mm))
        expect(Math.abs(t.mm) / s.strokeMm, `${name} stroke ${k}`).toBeGreaterThan(0.65)
        expect(Math.abs(t.mm) / s.strokeMm, `${name} stroke ${k}`).toBeLessThan(1.25)
        for (let j = 0; j < k; j++) {
          const length = Math.abs(lengths[k]! - lengths[j]!) / s.strokeMm
          const moment = Math.abs(gaps[k]! - gaps[j]!) / Math.max(gaps[j]!, gaps[k]!)
          expect(length > UNLIKE_LENGTH || moment > UNLIKE_MOMENT, `${name} strokes ${j} and ${k} are alike`).toBe(true)
        }
      }
      const reaches = turns.map((t) => Math.abs(t.mm))
      expect(Math.max(...reaches) - Math.min(...reaches)).toBeGreaterThan(0.12 * s.strokeMm)
      expect(gaps.at(-1)!).toBeLessThan(0.8 * gaps[1]!)
      expect(gaps.at(-1)! + gaps.at(-2)!).toBeLessThan(gaps[1]! + gaps[2]!)
      expect(turns[0]!.beat).toBeGreaterThan(s.liftBeats)
      expect(turns.at(-1)!.beat).toBeLessThan(s.liftBeats + s.strokeBeats)
    }
  })

  it('reverses sharply and never as a sine does', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const turns = m.plan.strokes
      const along = (b: number, order: number): number => Math.hypot(m.at('x', b, order), m.at('z', b, order))
      let hardest = 0
      for (let k = 1; k < turns.length; k++) {
        const from = turns[k - 1]!.beat
        const to = turns[k]!.beat
        let peak = 0
        for (let b = from; b <= to; b += 0.001) peak = Math.max(peak, along(b, 1))
        let slow = 0
        for (let b = from; b <= to; b += 0.001) if (along(b, 1) < 0.5 * peak) slow += 0.001
        expect(slow / (to - from), `${name} stroke ${k}`).toBeLessThan(SLOW_SHARE)
        let pull = 0
        for (let b = to - 0.04; b <= to + 0.04; b += 0.001) pull = Math.max(pull, along(b, 2))
        hardest = Math.max(hardest, pull / BEAT_S ** 2 / G_MM_S2)
        expect(pull / BEAT_S ** 2 / G_MM_S2, `${name} turn ${k}`).toBeGreaterThan(1)
      }
      expect(hardest, name).toBeGreaterThan(REVERSAL_G)
      expect(hardest, name).toBeLessThan(PULL_G)
    }
  })

  it('makes no two shakes alike', () => {
    for (let a = 0; a < NAMES.length; a++) {
      for (let b = a + 1; b < NAMES.length; b++) {
        const one = shakeMotion(NAMES[a]!).plan
        const two = shakeMotion(NAMES[b]!).plan
        const apart = one.strokes.reduce((sum, t, k) => sum + Math.abs(t.mm - two.strokes[k]!.mm) + s.strokeMm * Math.abs(t.beat - two.strokes[k]!.beat), 0)
        expect(apart, `${NAMES[a]} and ${NAMES[b]}`).toBeGreaterThan(1)
        expect(Math.abs(one.planAngle - two.planAngle) + Math.abs(one.lean - two.lean)).toBeGreaterThan(0)
      }
    }
  })

  it('rocks about two axes inside the config tilt: the top swings out with each stroke and trails it, and the second axis is out of step with the first', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const th = m.plan.planAngle
      let peak = 0
      for (let b = 0; b < m.endBeat; b += 0.001) peak = Math.max(peak, tiltOf(path.poseAt(b)) * DEG)
      expect(peak, name).toBeLessThanOrEqual(s.tiltDeg + 1e-9)
      expect(peak, name).toBeGreaterThan(0.8 * s.tiltDeg)
      expect(m.plan.peakTilt * DEG).toBeCloseTo(peak, 2)
      const from = s.liftBeats + 0.05
      const to = s.liftBeats + s.strokeBeats - 0.05
      const place = (b: number): number => m.at('x', b) / Math.cos(th)
      const rate = (b: number): number => m.at('x', b, 1) / Math.cos(th)
      const whip = (b: number): number => m.at('tiltX', b) * Math.sin(th) - m.at('tiltZ', b) * Math.cos(th)
      const rock = (b: number): number => -m.at('tiltX', b) * Math.cos(th) - m.at('tiltZ', b) * Math.sin(th)
      const mean = (f: (b: number) => number): number => {
        let sum = 0
        let n = 0
        for (let b = from; b <= to; b += 0.002) {
          sum += f(b)
          n++
        }
        return sum / n
      }
      const lagOf = (f: (b: number) => number, drive: (b: number) => number): { lag: number; fit: number; swing: number } => {
        const mid = mean(f)
        const base = mean(drive)
        let best = { lag: 0, fit: 0, swing: 0 }
        let lo = Infinity
        let hi = -Infinity
        for (let b = from; b <= to; b += 0.002) {
          lo = Math.min(lo, f(b))
          hi = Math.max(hi, f(b))
        }
        for (let lag = -0.1; lag <= 0.2; lag += 0.001) {
          let fit = 0
          for (let b = from; b <= to - 0.2; b += 0.002) fit += (drive(b) - base) * (f(b + lag) - mid)
          if (Math.abs(fit) > Math.abs(best.fit)) best = { lag, fit, swing: hi - lo }
        }
        return best
      }
      // The first axis follows where the stroke has carried the globe, a moment late. The second follows how fast it is going, so the two are a quarter of a stroke apart.
      const first = lagOf(whip, place)
      const second = lagOf(rock, rate)
      expect(first.fit, name).toBeGreaterThan(0)
      expect(first.lag, `${name} whip lag`).toBeGreaterThan(0.012)
      expect(first.lag, `${name} whip lag`).toBeLessThan(0.12)
      expect(first.swing * DEG, `${name} whip`).toBeGreaterThan(1.4 * s.tiltDeg)
      expect(second.swing * DEG, `${name} second axis`).toBeGreaterThan(0.4)
      const midWhip = mean(whip)
      const midRock = mean(rock)
      let both = 0
      let whips = 0
      let rocks = 0
      for (let b = from; b <= to; b += 0.002) {
        both += (whip(b) - midWhip) * (rock(b) - midRock)
        whips += (whip(b) - midWhip) ** 2
        rocks += (rock(b) - midRock) ** 2
      }
      expect(Math.abs(both) / Math.sqrt(whips * rocks), `${name} out of step`).toBeLessThan(0.6)
    }
  })

  it('trembles a little while it is held, each shake in its own way, and not at all at rest', () => {
    const seen: number[][] = []
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const th = m.plan.planAngle
      const from = s.liftBeats + 0.3 * s.strokeBeats
      const to = s.liftBeats + 0.7 * s.strokeBeats
      const tremor = (b: number): number => m.at('z', b) + m.plan.awayMm - m.at('x', b) * Math.tan(th)
      const row: number[] = []
      let lo = Infinity
      let hi = -Infinity
      let turns = 0
      let last = 0
      for (let b = from; b <= to; b += 0.004) {
        const v = tremor(b)
        row.push(v)
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
        const slope = Math.sign(tremor(b + 0.004) - v)
        if (slope !== 0 && last !== 0 && slope !== last) turns++
        if (slope !== 0) last = slope
      }
      expect(hi - lo, `${name} tremor`).toBeGreaterThan(0.04)
      expect(hi - lo, `${name} tremor`).toBeLessThan(0.5)
      expect(turns, `${name} tremor`).toBeGreaterThanOrEqual(5)
      for (const other of seen) expect(other.reduce((sum, v, i) => sum + Math.abs(v - row[i]!), 0) / row.length).toBeGreaterThan(0.01)
      seen.push(row)
    }
  })

  it('comes down onto the landing and not before, moving down, and stops firmly', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const landing = path.parts.landing
      const strokesEnd = path.parts.strokesEnd
      const touch = m.plan.touch
      let before = path.poseAt(strokesEnd).y
      let swung = 0
      for (let b = strokesEnd + FRAME_BEATS / 4; b <= landing - FRAME_BEATS + 1e-9; b += FRAME_BEATS / 4) {
        const p = path.poseAt(b)
        expect(rimGap(p), `${name} at ${b}`).toBeGreaterThan(0)
        expect(p.y, `${name} at ${b}`).toBeLessThan(before)
        if (b >= touch) expect(p.x, `${name} slides at ${b}`).toBe(0)
        swung = Math.max(swung, -Math.sign(m.plan.strokes.at(-1)!.mm) * p.x)
        before = p.y
      }
      // It comes down on an arc: one more, slower swing carries it across and back while it sinks, and it is over its mark when its edge meets the surface.
      expect(swung / s.strokeMm, `${name} last swing`).toBeGreaterThan(0.3)
      expect(m.plan.lastTurn.beat, `${name} last swing`).toBeGreaterThan(strokesEnd)
      expect(m.plan.lastTurn.beat, `${name} last swing`).toBeLessThan(touch - 4 * FRAME_BEATS)
      expect(path.poseAt(m.plan.lastTurn.beat).y, `${name} sinks through the swing`).toBeLessThan(s.liftMm - 0.25)
      expect(touch).toBeGreaterThan(strokesEnd + 0.5 * s.setDownBeats)
      expect(touch).toBeLessThan(landing - FRAME_BEATS)
      // Faster and faster: it falls further in the last third of the way down than in the first two, and is at its fastest inside the last three frames before the edge meets the surface.
      const third = (touch - strokesEnd) / 3
      const fell = (from: number, to: number): number => path.poseAt(from).y - path.poseAt(to).y
      expect(fell(strokesEnd + 2 * third, touch), `${name} speeds up`).toBeGreaterThan(fell(strokesEnd, strokesEnd + 2 * third))
      let fastest = { beat: strokesEnd, v: 0 }
      for (let b = strokesEnd; b <= touch; b += FRAME_BEATS / 8) if (-m.at('y', b, 1) > fastest.v) fastest = { beat: b, v: -m.at('y', b, 1) }
      expect(touch - fastest.beat, `${name} fastest at the end`).toBeLessThan(3 * FRAME_BEATS)
      for (let b = landing - FRAME_BEATS; b < landing; b += 0.0005) {
        expect(rimGap(path.poseAt(b))).toBeGreaterThan(-PAD_MM)
        expect(m.at('y', b, 1)).toBeLessThan(0)
      }
      expect(path.poseAt(landing - 1e-6).y).toBeLessThan(0.01)
      expect(path.poseAt(landing - FRAME_BEATS).y).toBeGreaterThan(0.1)
      expect(-m.at('y', landing - FRAME_BEATS / 2, 1) / BEAT_S).toBeGreaterThan(8)
      let stop = 0
      for (let b = landing - 0.06; b <= landing + 0.06; b += 0.0005) stop = Math.max(stop, m.at('y', b, 2) / BEAT_S ** 2 / G_MM_S2)
      expect(stop, `${name} stop`).toBeGreaterThan(0.4)
      expect(stop, `${name} stop`).toBeLessThan(1.5)
    }
  })

  it('settles as a heavy base does: one edge meets the surface first, the foot rolls flat onto the bar, rocks over once, rattles out inside the settle and never leaves the surface again', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const landing = path.parts.landing
      const settle = m.endBeat - landing
      expect(settle * BEAT_S).toBeCloseTo(s.landSettleSeconds, 12)
      const lean = (b: number): { x: number; z: number } => ({ x: m.at('tiltX', b), z: m.at('tiltZ', b) })
      const into = lean(landing - 0.02)
      // One edge takes the load: at the touch the foot is tipped, toward the side the last swing came back from, and from there it stands on its rim and rolls flat.
      const touch = m.plan.touch
      const tipped = path.poseAt(touch)
      expect(tiltOf(tipped) * DEG, `${name} edge first`).toBeGreaterThan(2.7)
      expect(Math.sign(seen(tipped).roll), `${name} trailing edge`).toBe(Math.sign(m.plan.lastTurn.mm))
      let flatter = tiltOf(tipped)
      for (let b = touch + FRAME_BEATS / 4; b < landing; b += FRAME_BEATS / 4) {
        const p = path.poseAt(b)
        expect(Math.abs(rimGap(p)), `${name} at ${b}`).toBeLessThan(PAD_MM)
        expect(tiltOf(p), `${name} at ${b}`).toBeLessThan(flatter)
        flatter = tiltOf(p)
      }
      let over = 0
      let overBeat = landing
      let late = 0
      let crossings = 0
      let side = 0
      // The first hand is all but still past half of the settle. The held hand rocks further and so for longer: it is all but still past 0.85 of it.
      const lateFrom = FIRST_HAND(name) ? 0.5 : 0.85
      const rocks: number[] = [0]
      for (let b = landing + 0.0005; b < m.endBeat; b += 0.0005) {
        const p = path.poseAt(b)
        expect(Math.abs(rimGap(p)), `${name} at ${b}`).toBeLessThan(PAD_MM)
        expect(p.x).toBe(0)
        const t = tiltOf(p) * DEG
        if (t > over) {
          over = t
          overBeat = b
        }
        if (b > landing + lateFrom * settle) late = Math.max(late, t)
        const now = lean(b)
        const along = Math.sign(now.x * into.x + now.z * into.z)
        if (t > 0.002 && along !== 0) {
          if (side !== 0 && along !== side) {
            crossings++
            rocks.push(0)
          }
          side = along
          rocks[rocks.length - 1] = Math.max(rocks.at(-1)!, t)
        }
      }
      // Damped: every rock is well under the one before it, and after the overshoot no more than two can be seen at all.
      for (let k = 1; k < rocks.length; k++) expect(rocks[k]! / rocks[k - 1]!, `${name} rock ${k}`).toBeLessThan(0.55)
      expect(rocks.slice(1).filter((r) => r > 0.1).length, `${name} rocks after the overshoot`).toBeLessThanOrEqual(2)
      const peak = lean(overBeat)
      expect(peak.x * into.x + peak.z * into.z, `${name} rocks over to the other side`).toBeLessThan(0)
      expect(over, `${name} overshoot`).toBeGreaterThan(0.3)
      // Decision 59 caps the rock of the first hand at 1.3 degrees; it is kept close under the cap. The hand of the film, the loop and the app
      // rocks further, so that the frame shows it: under OVERSHOOT_HELD_DEG, and never over the 2.5 degrees the ruling of 14:40 UTC on 2026-11-25 allows.
      expect(over, `${name} overshoot`).toBeGreaterThan(1.1)
      expect(over, `${name} overshoot`).toBeLessThan(FIRST_HAND(name) ? 1.3 : OVERSHOOT_HELD_DEG)
      expect(m.plan.overshoot * DEG).toBeCloseTo(over, 1)
      expect(overBeat - landing).toBeLessThan(0.3 * settle)
      expect(late / over, `${name} dies`).toBeLessThan(0.12)
      expect(crossings, `${name} rattles`).toBeGreaterThanOrEqual(2)
      expect(tiltOf(path.poseAt(m.endBeat - 0.02)) * DEG).toBeLessThan(0.002)
    }
  })
})

describe('the shake path: as the hero lens sees it', () => {
  it('is never still off the slab: from the foot leaving the surface to its edge meeting it again, no three frames pass in which the glass stays put', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      for (const phase of [0, 0.25, 0.5, 0.75]) {
        let slowest = { beat: 0, moved: Infinity }
        for (let b = m.plan.liftOff + phase * FRAME_BEATS; b + 3 * FRAME_BEATS <= m.plan.touch; b += FRAME_BEATS) {
          let moved = 0
          for (let k = 0; k < 3; k++) {
            const one = seen(path.poseAt(b + k * FRAME_BEATS))
            const two = seen(path.poseAt(b + (k + 1) * FRAME_BEATS))
            moved += Math.hypot(two.x - one.x, two.y - one.y)
          }
          if (moved < slowest.moved) slowest = { beat: b, moved }
        }
        expect(slowest.moved / HD.width, `${name} from beat ${slowest.beat.toFixed(3)}`).toBeGreaterThan(STILL_SHARE)
      }
    }
  })

  it('makes strokes that differ on screen in length and in time, on an arc: low through the middle and carried up to each end', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const turns = m.plan.strokes
      let wind = { beat: m.plan.liftOff, x: seen(REST_POSE).x }
      const side = Math.sign(turns[0]!.mm)
      for (let b = m.plan.liftOff; b < turns[0]!.beat; b += FRAME_BEATS / 8) {
        const x = seen(path.poseAt(b)).x
        if (-side * x > -side * wind.x) wind = { beat: b, x }
      }
      const ends = [wind, ...turns.map((t) => ({ beat: t.beat, x: seen(path.poseAt(t.beat)).x }))]
      const lengths = turns.map((_, k) => Math.abs(ends[k + 1]!.x - ends[k]!.x))
      const moments = turns.map((_, k) => ends[k + 1]!.beat - ends[k]!.beat)
      expect(Math.max(...lengths) / Math.min(...lengths), `${name} lengths on screen`).toBeGreaterThan(SEEN_LENGTH)
      expect(Math.max(...moments) / Math.min(...moments), `${name} moments on screen`).toBeGreaterThan(SEEN_MOMENT)
      expect(Math.min(...lengths) / HD.width, `${name} shortest stroke on screen`).toBeGreaterThan(0.08)
      let high = Infinity
      let low = -Infinity
      let arcs = 0
      for (let k = 1; k < turns.length; k++) {
        const from = turns[k - 1]!.beat
        const to = turns[k]!.beat
        let dip = -Infinity
        for (let b = from; b <= to; b += FRAME_BEATS / 8) {
          const y = seen(path.poseAt(b)).y
          dip = Math.max(dip, y)
          high = Math.min(high, y)
          low = Math.max(low, y)
        }
        if (dip - Math.max(seen(path.poseAt(from)).y, seen(path.poseAt(to)).y) > SEEN_PUMP * HD.height * 0.4) arcs++
      }
      expect((low - high) / HD.height, `${name} pump on screen`).toBeGreaterThan(SEEN_PUMP)
      expect(arcs, `${name} strokes that swoop`).toBeGreaterThanOrEqual(turns.length - 2)
    }
  })

  it('rolls about the lens axis toward the side it has swung to, furthest over just after each reversal and near the config tilt', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      let most = 0
      for (const turn of m.plan.strokes) {
        const side = Math.sign(turn.mm)
        let peak = { beat: 0, roll: -Infinity }
        for (let b = turn.beat - 3 * FRAME_BEATS; b <= turn.beat + 5 * FRAME_BEATS; b += FRAME_BEATS / 8) {
          const roll = side * seen(path.poseAt(b)).roll
          if (roll > peak.roll) peak = { beat: b, roll }
        }
        expect(peak.roll, `${name} roll at the turn at beat ${turn.beat.toFixed(3)}`).toBeGreaterThan(0.6 * s.tiltDeg)
        // The tilt lags the travel: the top is still going over when the hand has turned. The first pull starts from the wind up with the wrist already coming over,
        // so its roll may peak on the turn itself, never more than a quarter of a frame before it; every later one trails its turn.
        const first = turn === m.plan.strokes[0]
        expect(peak.beat - turn.beat, `${name} roll trails the turn at beat ${turn.beat.toFixed(3)}`).toBeGreaterThan(first ? -0.25 * FRAME_BEATS : 0)
        expect(peak.beat - turn.beat, `${name} roll trails the turn at beat ${turn.beat.toFixed(3)}`).toBeLessThan(3 * FRAME_BEATS)
        most = Math.max(most, peak.roll)
      }
      expect(most, `${name} roll`).toBeGreaterThan(0.87 * s.tiltDeg)
      expect(most, `${name} roll`).toBeLessThan(s.tiltDeg + 0.5)
    }
  })
})
