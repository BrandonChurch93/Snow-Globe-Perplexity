import type { Dressing, KitMoment } from '../kit'

// Part `surface-dressing-fall`. Still a stand-in (a tint): its builder replaces this file as the surface half of the recipe
// "One more dressing for the glass" and adds `dressing(): THREE.Object3D`.
export const standIns: string[] = []

export const surfaceDressing: Dressing & { reachMm: number } = { tint: [0.9, 0.4, 0.05], amount: 0.32, reachMm: 145 }

export async function prepare(): Promise<void> {}

export function update(_moment: KitMoment): void {}
