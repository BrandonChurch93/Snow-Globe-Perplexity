import type * as THREE from 'three'
import { anchors } from '../../scene/layout'
import { blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, KitMoment } from '../kit'

// Part `miniature-summer`. Still the blockout shapes: its builder replaces this file by the recipe
// "One more season of the miniature" and adds `collider` (see `../winter/miniature.ts`).
const season = 'summer'
const palette: Palette = { ground: [0.2, 0.36, 0.08], cottage: [0.55, 0.47, 0.36], roof: [0.42, 0.2, 0.1], chimney: [0.38, 0.32, 0.27], trunk: [0.22, 0.14, 0.08], crown: [0.12, 0.38, 0.1], post: [0.03, 0.03, 0.035], lamp: [1, 0.85, 0.5], pond: [0.1, 0.3, 0.42], fence: [0.5, 0.4, 0.26], path: [0.56, 0.5, 0.42] }
const list: InnerLight[] = [
    { at: anchors.lamp, color: [1, 0.8, 0.4], power: 0.72, reachMm: 26, flicker: 0.04, cycles: 2, phase: 0.3 },
    { at: anchors.window, color: [1, 0.7, 0.3], power: 0.52, reachMm: 18, flicker: 0.06, cycles: 3, phase: 0.6 },
    { at: anchors.pond, color: [0.75, 1, 0.3], power: 0.44, reachMm: 24, flicker: 0.3, cycles: 6, phase: 0.2 },
  ]

export const innerLights = (): InnerLight[] => list

export async function prepare(): Promise<void> {}

export const miniature = (): THREE.Object3D => blockMiniature(season, palette)
export const lights = (): THREE.Object3D => blockLights(season, list)

export function update(_moment: KitMoment): void {}
