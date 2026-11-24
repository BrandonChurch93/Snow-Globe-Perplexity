import type { Dressing } from '../kit'

export async function prepare(): Promise<void> {}

export const glassDressing: Dressing = { tint: [0.75, 0.85, 1], amount: 0.1 }
export const surfaceDressing: Dressing & { reachMm: number } = { tint: [0.7, 0.82, 1], amount: 0.35, reachMm: 150 }
