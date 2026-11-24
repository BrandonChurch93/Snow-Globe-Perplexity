import type * as THREE from 'three'
import type { Rgb } from '../../core/materials'
import { blockArrival } from '../blockout'
import type { KitMoment } from '../kit'

const season = 'winter'
const arrivalTint: Rgb = [0.92, 0.95, 1]

export async function prepare(): Promise<void> {}

export function arrival(): THREE.Object3D {
  return blockArrival(season, arrivalTint)
}

export function update(_moment: KitMoment): void {}
