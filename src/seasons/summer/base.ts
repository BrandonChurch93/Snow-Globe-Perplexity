import type * as THREE from 'three'
import type { Rgb } from '../../core/materials'
import { blockBase } from '../blockout'
import type { KitMoment } from '../kit'

// Part `base-summer`. Still the blockout shape: its builder replaces this file by the recipe "One more base".
export const season = 'summer'
export const main: Rgb = [0.36, 0.2, 0.06]

export async function prepare(): Promise<void> {}

export function base(): THREE.Object3D {
  return blockBase(season, main, 0.74)
}

export function update(_moment: KitMoment): void {}
