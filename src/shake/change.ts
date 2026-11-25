export const SEASONAL_PARTS = ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'particles'] as const

export interface ChangeSpan {
  from: number
  to: number
  lag: number
}

const OUTSIDE: ChangeSpan = { from: 0.69, to: 0.85, lag: 0 }
const BLOOM_RAMP = 0.12
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
export const BUILT_CHANGES: ReadonlySet<string> = new Set<string>([])

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
  const mid = (OUTSIDE.from + OUTSIDE.to) / 2
  const half = (OUTSIDE.to - OUTSIDE.from) / 2
  const v = Math.min(1, (half + BLOOM_RAMP - Math.abs(change - mid)) / BLOOM_RAMP)
  return v <= 0 ? 0 : v * v * (3 - 2 * v)
}
