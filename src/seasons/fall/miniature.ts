import type * as THREE from 'three'
import { anchors } from '../../scene/layout'
import { blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, KitMoment } from '../kit'

// Part `miniature-fall`. Still the blockout shapes: its builder replaces this file by the recipe
// "One more season of the miniature" and adds `collider` (see `../winter/miniature.ts`).
const season = 'fall'
const palette: Palette = { ground: [0.3, 0.17, 0.06], cottage: [0.3, 0.27, 0.27], roof: [0.1, 0.08, 0.12], chimney: [0.22, 0.2, 0.2], trunk: [0.09, 0.06, 0.05], crown: [0.8, 0.3, 0.04], post: [0.03, 0.03, 0.035], lamp: [1, 0.6, 0.2], pond: [0.08, 0.14, 0.1], fence: [0.2, 0.16, 0.13], path: [0.34, 0.32, 0.3] }
const list: InnerLight[] = [
    { at: anchors.lamp, color: [1, 0.55, 0.15], power: 0.8, reachMm: 26, flicker: 0.1, cycles: 3, phase: 0.5 },
    { at: anchors.window, color: [1, 0.45, 0.08], power: 0.72, reachMm: 18, flicker: 0.25, cycles: 7, phase: 0.1 },
    { at: anchors.pond, color: [0.3, 1, 0.3], power: 0.48, reachMm: 28, flicker: 0.1, cycles: 2, phase: 0.8 },
  ]

export const innerLights = (): InnerLight[] => list

export async function prepare(): Promise<void> {}

export const miniature = (): THREE.Object3D => blockMiniature(season, palette)
export const lights = (): THREE.Object3D => blockLights(season, list)

export function update(_moment: KitMoment): void {}
