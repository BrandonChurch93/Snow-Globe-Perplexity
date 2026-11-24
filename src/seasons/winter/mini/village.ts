import type * as THREE from 'three'
import type { Rgb } from '../../../core/materials'
import { anchors, solidDistance } from '../../../scene/layout'
import { blockArrival, blockLights, blockMiniature } from '../../blockout'
import type { InnerLight, KitMoment } from '../../kit'
import { isTree, palette, season } from './palette'

const arrivalTint: Rgb = [0.92, 0.95, 1]

export const innerLights: InnerLight[] = [
  { at: anchors.lamp, color: [1, 0.66, 0.3], power: 0.88, reachMm: 26, flicker: 0.06, cycles: 3, phase: 0.1 },
  { at: anchors.window, color: [1, 0.55, 0.2], power: 0.64, reachMm: 18, flicker: 0.12, cycles: 5, phase: 0.4 },
]

export async function prepare(): Promise<void> {}

export function build(): THREE.Object3D {
  return blockMiniature(season, palette, (role) => !isTree(role))
}

export function lights(): THREE.Object3D {
  return blockLights(season, innerLights)
}

export function arrival(): THREE.Object3D {
  return blockArrival(season, arrivalTint, (role) => !isTree(role))
}

export function solid(x: number, y: number, z: number): number {
  return solidDistance(x, y, z, (role) => !isTree(role))
}

export function update(_moment: KitMoment): void {}
