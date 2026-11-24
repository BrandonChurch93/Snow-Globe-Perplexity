import type { Dressing, KitMoment } from '../kit'

// Part `surface-dressing-summer`. Still a stand-in (a tint): its builder replaces this file as the surface half of the recipe
// "One more dressing for the glass" and adds `dressing(): THREE.Object3D`.
export const standIns: string[] = []

export const surfaceDressing: Dressing & { reachMm: number } = { tint: [0.9, 0.75, 0.3], amount: 0.28, reachMm: 130 }

export async function prepare(): Promise<void> {}

export function update(_moment: KitMoment): void {}
