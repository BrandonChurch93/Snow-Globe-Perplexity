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

const SHUTTER = config.film.shutterDegrees / 360

/**
 * The cut of the base, as a place in the swap window. The base is the old season's before it and the new season's after it, with
 * nothing between. It lies where the film's shutter is closed, after the exposure of the frame before `frame` has ended and
 * before the exposure of `frame` begins (`frame` is counted from the first frame of the window), between the two frames on
 * which the last stroke runs fastest: no frame of the film holds both bases, the last frame of the old base and the first of
 * the new are each drawn out by the stroke. A quarter of the way through the closed shutter, so that no picture taken on a
 * whole, a half or a quarter of a frame's time falls on it.
 */
export const CHANGE_CUT = { frame: 26, at: frames(25 + SHUTTER + (1 - SHUTTER) / 4) } as const

/**
 * What lies on the table, as places in the swap window. The old season's dressing leaves under the strokes before the cut
 * (`liftFrom`: the first frame anything on the table moves; `leaveFrom` to `leaveTo`: the frames across which it is gone, from
 * the foot outward, the last of it inside the last exposure of the old base), the table is bare on the cut, and the new
 * season's dressing comes with the first frame of the new base and after it (`comeFrom` to `comeTo`).
 */
export const DRESSING_CHANGE = { liftFrom: frames(12), leaveFrom: frames(15.5), leaveTo: frames(25 + SHUTTER), comeFrom: frames(26), comeTo: frames(34.5) } as const

/** The bloom rises over this much of the window to the cut and falls over as much after it. */
const BLOOM_HALF = frames(6)

/** What the table carries as one number crossed straight from the old season to the new goes with the base, where the shutter is closed. */
const ON_THE_CUT: ChangeSpan = { from: CHANGE_CUT.at - frames(0.125), to: CHANGE_CUT.at + frames(0.125), lag: 0 }
/**
 * What is on the glass goes before the cut and is gone on it: no frame shows the old season's dressing on the glass over the new base.
 * The heaps of the slab (`surface-leave`, `surface-come`) sink with the old dressing before the cut and rise with the new after it.
 * A shake of one season reads the base's span and none of these.
 */
const SPANS: Record<string, ChangeSpan> = {
  miniature: { from: 0.05, to: 0.95, lag: 0.5 },
  arrival: { from: 0.05, to: 0.95, lag: 0.5 },
  light: { from: 0, to: 1, lag: 0 },
  veil: { from: 0, to: 1, lag: 0 },
  particles: { from: 0, to: 1, lag: 0 },
  base: OUTSIDE,
  'glass-dressing': { from: OUTSIDE.from, to: CHANGE_CUT.at, lag: 0 },
  'surface-dressing': ON_THE_CUT,
  'surface-leave': { from: DRESSING_CHANGE.leaveFrom, to: DRESSING_CHANGE.leaveTo, lag: 0 },
  'surface-come': { from: DRESSING_CHANGE.comeFrom, to: DRESSING_CHANGE.comeTo, lag: 0 },
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
