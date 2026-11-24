import { config } from '../config'
import { stream } from '../core/rng'

export interface GlobePose {
  x: number
  y: number
  z: number
  tiltX: number
  tiltZ: number
}

export const REST_POSE: GlobePose = { x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0 }
const RAD = Math.PI / 180
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
/** How far the globe leans back while it is held, and how much lower the ends of a stroke are than its middle, per millimetre of stroke. */
const TILT_BACK = 4 * RAD
const ARC = 0.15

export interface ShakePath {
  readonly standIn: true
  readonly parts: { liftEnd: number; strokesEnd: number; landing: number }
  poseAt(beat: number): GlobePose
}

export function makeShake(name: string): ShakePath {
  const s = config.shake
  const rng = stream(`shake:${name}`)
  const n = Math.round(s.strokes)
  const amps: number[] = []
  for (let i = 0; i < n; i++) amps.push((i % 2 === 0 ? 1 : -1) * s.strokeMm * rng.range(0.8, 1.2))
  const lean = rng.range(-0.35, 0.35)
  const bar = config.film.beatsPerBar
  const liftEnd = s.liftBeats
  const strokesEnd = s.liftBeats + s.strokeBeats
  const lateral = (beat: number): number => {
    if (beat <= liftEnd || beat >= strokesEnd) return 0
    const u = (beat - liftEnd) / (strokesEnd - liftEnd)
    const warped = u * (0.6 + 0.4 * u)
    const f = warped * n
    const i = Math.min(n - 1, Math.floor(f))
    const local = f - i
    const env = smooth(u / 0.08) * smooth((1 - u) / 0.1)
    return amps[i]! * Math.sin(Math.PI * local) * env
  }
  return {
    standIn: true,
    parts: { liftEnd, strokesEnd, landing: bar },
    poseAt(beat: number): GlobePose {
      if (beat <= 0 || beat >= bar) return REST_POSE
      let y: number
      if (beat < liftEnd) y = s.liftMm * smooth(beat / liftEnd)
      else if (beat < strokesEnd) y = s.liftMm
      else {
        const u = (beat - strokesEnd) / s.setDownBeats
        y = s.liftMm * (1 - u * u)
      }
      const d = 0.02
      const l0 = lateral(beat - d)
      const l1 = lateral(beat + d)
      const l = lateral(beat)
      const rate = (l1 - l0) / (2 * d)
      const tilt = Math.max(-1, Math.min(1, rate / (s.strokeMm * 6))) * s.tiltDeg * RAD
      // The hand holds the globe tilted back a few degrees from the end of the lift to the set down,
      // and its strokes swing on an arc that is highest in the middle, as a forearm does.
      // So the top of the glass never rises more than shake.liftMm above where it rests.
      const held = beat < liftEnd ? smooth(beat / liftEnd) : beat < strokesEnd ? 1 : 1 - smooth((beat - strokesEnd) / s.setDownBeats)
      return { x: l, y: y - Math.abs(l) * ARC, z: l * lean, tiltX: tilt * lean * 0.6 - TILT_BACK * held, tiltZ: -tilt }
    },
  }
}
