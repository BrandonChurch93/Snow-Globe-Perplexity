import type * as THREE from 'three'
import { anchors } from '../../scene/layout'
import { blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, KitMoment } from '../kit'

// Part `miniature-spring`. Still the blockout shapes: its builder replaces this file by the recipe
// "One more season of the miniature" and adds `collider` (see `../winter/miniature.ts`).
const season = 'spring'
const palette: Palette = { ground: [0.22, 0.42, 0.14], cottage: [0.46, 0.42, 0.36], roof: [0.2, 0.3, 0.12], chimney: [0.34, 0.3, 0.27], trunk: [0.2, 0.13, 0.08], crown: [0.95, 0.55, 0.68], post: [0.03, 0.03, 0.035], lamp: [0.9, 0.75, 0.5], pond: [0.25, 0.45, 0.6], fence: [0.42, 0.32, 0.22], path: [0.5, 0.48, 0.44] }
const list: InnerLight[] = [
    { at: anchors.lamp, color: [1, 0.78, 0.5], power: 0.64, reachMm: 24, flicker: 0.04, cycles: 2, phase: 0.2 },
    { at: anchors.window, color: [1, 0.68, 0.36], power: 0.6, reachMm: 18, flicker: 0.08, cycles: 4, phase: 0.5 },
    { at: anchors.crown, color: [1, 0.6, 0.75], power: 0.36, reachMm: 30, flicker: 0.03, cycles: 1, phase: 0 },
  ]

export const innerLights = (): InnerLight[] => list

export async function prepare(): Promise<void> {}

export const miniature = (): THREE.Object3D => blockMiniature(season, palette)
export const lights = (): THREE.Object3D => blockLights(season, list)

export function update(_moment: KitMoment): void {}
