import * as THREE from 'three'
import { buildTrunk, glow, pads, prepareTrunk, trunkSolid } from '../../../miniature/trunk'
import type { InnerLight, KitMoment } from '../../kit'
import { season } from './palette'

const CYCLES = 5
const FLICKER = 0.12

export const innerLights: InnerLight[] = pads.map((p, i) => ({ at: [p.at[0], p.at[1] - 0.6 * p.size[1], p.at[2]], color: [1, 0.72, 0.4], power: 0.3, reachMm: 9, flicker: FLICKER, cycles: CYCLES, phase: (i * 0.37) % 1 }))

export async function prepare(): Promise<void> {
  await prepareTrunk()
}

export function build(): THREE.Object3D {
  const group = new THREE.Group()
  group.add(buildTrunk(`miniature-${season}`))
  return group
}

export function lights(): THREE.Object3D {
  return new THREE.Group()
}

export function arrival(): THREE.Object3D {
  return new THREE.Group()
}

export function solid(x: number, y: number, z: number): number {
  return trunkSolid(x, y, z)
}

export function update(moment: KitMoment): void {
  glow.uTwinkle.value.set((CYCLES * moment.time) / moment.period, FLICKER, 1, 0)
}
