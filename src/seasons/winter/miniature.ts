import type * as THREE from 'three'
import { anchors } from '../../scene/layout'
import { blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, KitMoment } from '../kit'

const season = 'winter'
const palette: Palette = { ground: [0.82, 0.86, 0.92], cottage: [0.42, 0.36, 0.32], roof: [0.3, 0.12, 0.09], chimney: [0.3, 0.25, 0.23], trunk: [0.16, 0.1, 0.07], crown: [0.1, 0.24, 0.16], post: [0.03, 0.03, 0.035], lamp: [0.9, 0.7, 0.4], pond: [0.5, 0.62, 0.72], fence: [0.3, 0.22, 0.16], path: [0.5, 0.52, 0.56] }

export const innerLights: InnerLight[] = [
  { at: anchors.lamp, color: [1, 0.66, 0.3], power: 0.88, reachMm: 26, flicker: 0.06, cycles: 3, phase: 0.1 },
  { at: anchors.window, color: [1, 0.55, 0.2], power: 0.64, reachMm: 18, flicker: 0.12, cycles: 5, phase: 0.4 },
  { at: anchors.crownTop, color: [1, 0.8, 0.4], power: 0.48, reachMm: 22, flicker: 0.2, cycles: 7, phase: 0.7 },
]

export async function prepare(): Promise<void> {}

export function miniature(): THREE.Object3D {
  return blockMiniature(season, palette)
}

export function lights(): THREE.Object3D {
  return blockLights(season, innerLights)
}

export function update(_moment: KitMoment): void {}
