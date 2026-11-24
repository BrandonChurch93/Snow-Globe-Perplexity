import type * as THREE from 'three'
import type { Rgb } from '../../../core/materials'
import { anchors, solidDistance } from '../../../scene/layout'
import { blockArrival, blockLights, blockMiniature } from '../../blockout'
import type { InnerLight, KitMoment } from '../../kit'
import { isTree, palette, season } from './palette'

const arrivalTint: Rgb = [0.92, 0.95, 1]

export const innerLights: InnerLight[] = [{ at: anchors.crownTop, color: [1, 0.8, 0.4], power: 0.48, reachMm: 22, flicker: 0.2, cycles: 7, phase: 0.7 }]

export async function prepare(): Promise<void> {}

export function build(): THREE.Object3D {
  return blockMiniature(season, palette, isTree)
}

export function lights(): THREE.Object3D {
  return blockLights(season, innerLights)
}

export function arrival(): THREE.Object3D {
  return blockArrival(season, arrivalTint, isTree)
}

export function solid(x: number, y: number, z: number): number {
  return solidDistance(x, y, z, isTree)
}

export function update(_moment: KitMoment): void {}
