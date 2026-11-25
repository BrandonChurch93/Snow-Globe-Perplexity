import { config } from '../config'

export const SEASONAL_PARTS = ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'particles'] as const

export interface ChangeSpan {
  from: number
  to: number
  lag: number
}

const OUTSIDE: ChangeSpan = { from: 0.69, to: 0.85, lag: 0 }

const WINDOW_FRAMES = ((config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat) * 60 * config.film.fps) / config.film.defaultBpm
const frames = (n: number): number => n / WINDOW_FRAMES

/**
 * The cut of the base, as a place in the swap window. The base is the old season's before it and the new season's after it, with
 * nothing between. It lies in the middle of the shutter of the film frame on which the last stroke runs fastest (`frame`,
 * counted from the first frame of the window), so that one frame of the film holds the old base in the first half of its
 * exposure and the new one in the second, both drawn out by the stroke, and every other frame holds one base whole.
 */
export const CHANGE_CUT = { frame: 26, at: frames(26 + config.film.shutterDegrees / 720) } as const

/**
 * What lies on the table, as places in the swap window. The old season's dressing leaves under the strokes before the cut
 * (`liftFrom`: the first frame anything on the table moves; `leaveFrom` to `leaveTo`: the frames across which it is gone, from
 * the foot outward), the table is bare on the cut, and the new season's dressing comes after it (`comeFrom` to `comeTo`).
 */
export const DRESSING_CHANGE = { liftFrom: frames(12), leaveFrom: frames(16), leaveTo: frames(26), comeFrom: frames(27), comeTo: frames(35.5) } as const

/** The bloom rises over this much of the window to the cut and falls over as much after it. */
const BLOOM_HALF = frames(6)
const SPANS: Record<string, ChangeSpan> = {
  miniature: { from: 0.05, to: 0.95, lag: 0.5 },
  arrival: { from: 0.05, to: 0.95, lag: 0.5 },
  light: { from: 0, to: 1, lag: 0 },
  veil: { from: 0, to: 1, lag: 0 },
  particles: { from: 0, to: 1, lag: 0 },
  base: OUTSIDE,
  'glass-dressing': OUTSIDE,
  'surface-dressing': OUTSIDE,
  backdrop: OUTSIDE,
}

const WHOLE: ChangeSpan = { from: 0, to: 1, lag: 0 }

export const changeSpan = (part: string): ChangeSpan => SPANS[part] ?? WHOLE

export function changeRamp(part: string): { start: number; length: number; lag: number } {
  const s = changeSpan(part)
  const whole = s.to - s.from
  return { start: s.from, length: whole * (1 - s.lag), lag: whole * s.lag }
}

export function partChange(part: string, change: number, side = 0.5): number {
  if (!(change > 0)) return 0
  if (change >= 1) return 1
  const r = changeRamp(part)
  const v = (change - r.start - r.lag * Math.min(1, Math.max(0, side))) / r.length
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

export function changeBloom(change: number): number {
  if (!(change > 0) || change >= 1) return 0
  const v = 1 - Math.abs(change - CHANGE_CUT.at) / BLOOM_HALF
  return v <= 0 ? 0 : v * v * (3 - 2 * v)
}
