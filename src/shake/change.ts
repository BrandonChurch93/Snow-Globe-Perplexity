export const SEASONAL_PARTS = ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'particles'] as const

export function partChange(_part: string, change: number): number {
  return change <= 0 ? 0 : change >= 1 ? 1 : change
}
