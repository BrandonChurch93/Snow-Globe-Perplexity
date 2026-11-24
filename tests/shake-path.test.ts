import { describe, expect, it, vi } from 'vitest'
import { config, shots } from '../src/config'
import { FRAME } from '../src/app/framing'
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

const film = shots.filter((shot) => shot.kind === 'shake').map((shot) => shot.id)
const NAMES = ['test', ...config.seasons.map((season) => `test:${season}`), 'preroll', ...film, 'loop', ...Array.from({ length: FRAME.shakePaths }, (_, i) => `live-${i}`)]
const LINEAR: ShakeChannel[] = ['x', 'y', 'z']
const ANGULAR: ShakeChannel[] = ['tiltX', 'tiltZ']

const rimGap = (p: GlobePose): number => p.y - FOOT_MM * tiltSine(p.tiltX, p.tiltZ)
const tiltOf = (p: GlobePose): number => Math.asin(Math.min(1, tiltSine(p.tiltX, p.tiltZ)))

describe('the shake path: a table in beats from the seed', () => {
  it('is written in the config beats and ends with the settle', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      expect(path.standIn).toBe(false)
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
  it('is gripped before it lifts: the foot rocks on the surface, then leaves it with effort and eases at the top, tilted back', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const off = m.plan.liftOff
      expect(off).toBeGreaterThan(0.1 * s.liftBeats)
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
      for (let b = off; b <= s.liftBeats; b += 0.002) if (m.at('y', b, 1) > fastest.v) fastest = { beat: b, v: m.at('y', b, 1) }
      expect(fastest.beat, `${name} lift`).toBeGreaterThan((off + s.liftBeats) / 2)
      expect(m.at('y', s.liftBeats, 1)).toBe(0)
      expect(m.at('y', s.liftBeats, 2)).toBe(0)
      const top = path.poseAt(s.liftBeats)
      expect(top.y).toBeCloseTo(s.liftMm, 9)
      expect(top.tiltX * DEG).toBeLessThan(-3)
      expect(tiltOf(top) * DEG).toBeLessThanOrEqual(s.tiltDeg)
      expect(top.z).toBeLessThan(0)
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

  it('rocks about two axes inside the config tilt, the tilt trailing the stroke and the second axis out of step with the first', () => {
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
      const lagOf = (f: (b: number) => number): { lag: number; fit: number; swing: number } => {
        const mid = mean(f)
        let best = { lag: 0, fit: 0, swing: 0 }
        let lo = Infinity
        let hi = -Infinity
        for (let b = from; b <= to; b += 0.002) {
          lo = Math.min(lo, f(b))
          hi = Math.max(hi, f(b))
        }
        for (let lag = -0.1; lag <= 0.2; lag += 0.001) {
          let fit = 0
          for (let b = from; b <= to - 0.2; b += 0.002) fit += rate(b) * (f(b + lag) - mid)
          if (Math.abs(fit) > Math.abs(best.fit)) best = { lag, fit, swing: hi - lo }
        }
        return best
      }
      const first = lagOf(whip)
      const second = lagOf(rock)
      expect(first.fit, name).toBeGreaterThan(0)
      expect(first.lag, `${name} whip lag`).toBeGreaterThan(0.012)
      expect(first.lag, `${name} whip lag`).toBeLessThan(0.12)
      expect(first.swing * DEG, `${name} whip`).toBeGreaterThan(2)
      expect(second.swing * DEG, `${name} second axis`).toBeGreaterThan(0.4)
      expect(Math.abs(second.lag - first.lag), `${name} out of step`).toBeGreaterThan(0.004)
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
      let before = path.poseAt(strokesEnd).y
      for (let b = strokesEnd + FRAME_BEATS / 4; b <= landing - FRAME_BEATS + 1e-9; b += FRAME_BEATS / 4) {
        const p = path.poseAt(b)
        expect(rimGap(p), `${name} at ${b}`).toBeGreaterThan(0)
        expect(p.y, `${name} at ${b}`).toBeLessThan(before)
        expect(p.x).toBe(0)
        before = p.y
      }
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

  it('settles as a heavy base does: it rocks over once, rattles out inside the settle and never leaves the surface again', () => {
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const landing = path.parts.landing
      const settle = m.endBeat - landing
      expect(settle * BEAT_S).toBeCloseTo(s.landSettleSeconds, 12)
      const lean = (b: number): { x: number; z: number } => ({ x: m.at('tiltX', b), z: m.at('tiltZ', b) })
      const into = lean(landing - 0.02)
      let over = 0
      let overBeat = landing
      let late = 0
      let crossings = 0
      let side = 0
      for (let b = landing + 0.0005; b < m.endBeat; b += 0.0005) {
        const p = path.poseAt(b)
        expect(Math.abs(rimGap(p)), `${name} at ${b}`).toBeLessThan(PAD_MM)
        expect(p.x).toBe(0)
        const t = tiltOf(p) * DEG
        if (t > over) {
          over = t
          overBeat = b
        }
        if (b > landing + 0.5 * settle) late = Math.max(late, t)
        const now = lean(b)
        const along = Math.sign(now.x * into.x + now.z * into.z)
        if (t > 0.002 && along !== 0) {
          if (side !== 0 && along !== side) crossings++
          side = along
        }
      }
      const peak = lean(overBeat)
      expect(peak.x * into.x + peak.z * into.z, `${name} rocks over to the other side`).toBeLessThan(0)
      expect(over, `${name} overshoot`).toBeGreaterThan(0.3)
      expect(over, `${name} overshoot`).toBeLessThan(0.7)
      expect(m.plan.overshoot * DEG).toBeCloseTo(over, 1)
      expect(overBeat - landing).toBeLessThan(0.3 * settle)
      expect(late / over, `${name} dies`).toBeLessThan(0.12)
      expect(crossings, `${name} rattles`).toBeGreaterThanOrEqual(2)
      expect(tiltOf(path.poseAt(m.endBeat - 0.02)) * DEG).toBeLessThan(0.002)
    }
  })
})
