import type * as THREE from 'three'
import type { Rgb } from '../../core/materials'
import { blockArrival } from '../blockout'
import type { KitMoment } from '../kit'

// Part `arrival-summer`. Still the blockout: its builder replaces this file by the recipe "One more arrival".
const tint: Rgb = [0.85, 0.95, 0.3]

export async function prepare(): Promise<void> {}

export function arrival(): THREE.Object3D {
  return blockArrival('summer', tint)
}

export function update(_moment: KitMoment): void {}
