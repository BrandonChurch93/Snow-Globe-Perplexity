import { config } from '../config'

export const SEASONAL_PARTS = ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'particles'] as const

export interface ChangeSpan {
  from: number
  to: number
  lag: number
}

const WINDOW_FRAMES = ((config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat) * 60 * config.film.fps) / config.film.defaultBpm
const frames = (n: number): number => n / WINDOW_FRAMES

const SHUTTER = config.film.shutterDegrees / 360

/**
 * What is outside the glass (the base, what lies on the table, what is on the glass, the lights of the backdrop, the light of
 * the room) changes in one span of the window, three frames long, in the middle of the last and fastest stroke: table.ts puts
 * the middle of that stroke on the middle of this span. Across it the old base gives way to the new. Both are drawn whole and
 * every pixel of every sample holds one or the other, so a frame of the film holds the two laid over each other and never a
 * base that is neither season's. A shake of one season changes nothing outside the glass; what it sheds, and the swell of the
 * light inside in every shake, keep the wider span about the same middle (`shed`).
 */
const SHED: ChangeSpan = { from: 0.69, to: 0.85, lag: 0 }
const OUTSIDE_MID = (SHED.from + SHED.to) / 2
const OUTSIDE: ChangeSpan = { from: OUTSIDE_MID - frames(1.5), to: OUTSIDE_MID + frames(1.5), lag: 0 }

/**
 * The cover of that span, as places in the swap window: the new season's light pours out of the glass and the room falls
 * away from it, as a camera's exposure does when a lamp flares in the dark (lighting.ts, `CHANGE_BLOOM`). It is whole from
 * `fullFrom` to `fullTo`: on every exposure of the film that opens or closes inside the span, and a quarter of a frame past
 * each, so that a live picture taken on any instant of the span is under it as well. It rises from `riseFrom` over seven
 * frames and is gone at `goneAt`, five and a half after `fullTo` and inside the window, so that no frame of it is a step.
 */
const COVER_ROOM = frames(SHUTTER + 0.25)
const COVER_RISE = frames(7)
const COVER_FALL = frames(5.5)
export const CHANGE_COVER = {
  riseFrom: OUTSIDE.from - COVER_ROOM - COVER_RISE,
  fullFrom: OUTSIDE.from - COVER_ROOM,
  fullTo: OUTSIDE.to + COVER_ROOM,
  goneAt: OUTSIDE.to + COVER_ROOM + COVER_FALL,
} as const

/**
 * What lies on the table, as places in the swap window, all of them inside the span and so under the whole cover. The old
 * season's dressing leaves in the first half of the span, from the foot outward (`liftFrom`: the first instant anything on the
 * table moves), the table is bare at the middle, and the new season's comes in the second half.
 */
export const DRESSING_CHANGE = { liftFrom: OUTSIDE.from, leaveFrom: OUTSIDE.from, leaveTo: OUTSIDE_MID, comeFrom: OUTSIDE_MID, comeTo: OUTSIDE.to } as const

/**
 * Every part outside the glass reads the one span. The heaps of the slab (`surface-leave`, `surface-come`) sink with the old
 * dressing and rise with the new. A shake of one season reads `shed` and none of the others.
 */
const SPANS: Record<string, ChangeSpan> = {
  miniature: { from: 0.05, to: 0.95, lag: 0.5 },
  arrival: { from: 0.05, to: 0.95, lag: 0.5 },
  light: { from: 0, to: 1, lag: 0 },
  veil: { from: 0, to: 1, lag: 0 },
  particles: { from: 0, to: 1, lag: 0 },
  base: OUTSIDE,
  'glass-dressing': OUTSIDE,
  'surface-dressing': OUTSIDE,
  'surface-leave': { from: DRESSING_CHANGE.leaveFrom, to: DRESSING_CHANGE.leaveTo, lag: 0 },
  'surface-come': { from: DRESSING_CHANGE.comeFrom, to: DRESSING_CHANGE.comeTo, lag: 0 },
  backdrop: OUTSIDE,
  room: OUTSIDE,
  shed: SHED,
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

// The exposure falls by the cover as an exponent (lighting.ts), so a straight ramp is the room falling by the same share of a
// stop on every frame, the slowest it can fall and rise in the frames it has.
const ramp = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v)

/** How much of the cover stands at a place in the window: 0 before `riseFrom` and after `goneAt`, 1 from `fullFrom` to `fullTo`. */
export function changeBloom(change: number): number {
  if (!(change > 0) || change >= 1) return 0
  const c = CHANGE_COVER
  if (change < c.fullFrom) return ramp((change - c.riseFrom) / (c.fullFrom - c.riseFrom))
  if (change > c.fullTo) return ramp((c.goneAt - change) / (c.goneAt - c.fullTo))
  return 1
}
