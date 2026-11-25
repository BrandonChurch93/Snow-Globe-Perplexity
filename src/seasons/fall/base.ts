import type * as THREE from 'three'
import type { Rgb } from '../../core/materials'
import { blockBase } from '../blockout'
import type { KitMoment } from '../kit'

// Part `base-fall`. Still the blockout shape: its builder replaces this file by the recipe "One more base".
export const season = 'fall'
export const main: Rgb = [0.06, 0.04, 0.07]

export async function prepare(): Promise<void> {}

export function base(): THREE.Object3D {
  return blockBase(season, main, 0.7)
}

export function update(_moment: KitMoment): void {}
