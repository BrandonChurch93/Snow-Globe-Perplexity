import type { Dressing, KitMoment } from '../kit'

// Part `glass-dressing-spring`. Still a stand-in (a tint): its builder replaces this file by the recipe
// "One more dressing for the glass", empties `standIns` and adds `dressing(): THREE.Object3D`.
export const standIns: string[] = ['glass-dressing-spring']

export const glassDressing: Dressing = { tint: [0.85, 0.95, 1], amount: 0.07 }

export async function prepare(): Promise<void> {}

export function update(_moment: KitMoment): void {}
