import * as THREE from 'three'
import type { SdfGrid } from '../../core/stage'
import { gridOf } from '../../scene/layout'
import type { InnerLight, KitMoment } from '../kit'
import * as tree from './mini/tree'
import * as village from './mini/village'

const group = (...parts: THREE.Object3D[]): THREE.Object3D => new THREE.Group().add(...parts)

export const innerLights = (): InnerLight[] => [...village.innerLights, ...tree.innerLights]

export async function prepare(): Promise<void> {
  await Promise.all([village.prepare(), tree.prepare()])
}

export const miniature = (): THREE.Object3D => group(village.build(), tree.build())
export const lights = (): THREE.Object3D => group(village.lights(), tree.lights())
export const fresh = (): THREE.Object3D => group(village.arrival(), tree.arrival())
export const collider = (): SdfGrid => gridOf((x, y, z) => Math.min(village.solid(x, y, z), tree.solid(x, y, z)))

export function update(moment: KitMoment): void {
  village.update(moment)
  tree.update(moment)
}
