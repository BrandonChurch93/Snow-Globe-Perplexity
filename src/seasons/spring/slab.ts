import type { Dressing, KitMoment } from '../kit'

// Part `surface-dressing-spring`. Still a stand-in (a tint): its builder replaces this file as the surface half of the recipe
// "One more dressing for the glass" and adds `dressing(): THREE.Object3D`.
export const standIns: string[] = []

export const surfaceDressing: Dressing & { reachMm: number } = { tint: [1, 0.7, 0.8], amount: 0.3, reachMm: 140 }

export async function prepare(): Promise<void> {}

export function update(_moment: KitMoment): void {}
