import type { Dressing, KitMoment } from '../kit'

// Part `glass-dressing-summer`. Still a stand-in (a tint): its builder replaces this file by the recipe
// "One more dressing for the glass", empties `standIns` and adds `dressing(): THREE.Object3D`.
export const standIns: string[] = ['glass-dressing-summer']

export const glassDressing: Dressing = { tint: [1, 0.9, 0.6], amount: 0.06 }

export async function prepare(): Promise<void> {}

export function update(_moment: KitMoment): void {}
