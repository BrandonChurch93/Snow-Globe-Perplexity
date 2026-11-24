import type * as THREE from 'three'
import type { Rgb } from '../../core/materials'
import { blockBase } from '../blockout'
import type { KitMoment } from '../kit'

export const season = 'winter'
export const main: Rgb = [0.1, 0.05, 0.028]

export async function prepare(): Promise<void> {}

export function base(): THREE.Object3D {
  return blockBase(season, main, 0.8)
}

export function update(_moment: KitMoment): void {}
