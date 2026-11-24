import * as THREE from 'three'
import type { KitMoment } from '../kit'
import * as frost from './frost'
import { fresh } from './miniature'

const own = frost as { arrival?: () => THREE.Object3D }

export async function prepare(): Promise<void> {}

export function arrival(): THREE.Object3D {
  const g = new THREE.Group().add(fresh())
  if (own.arrival) g.add(own.arrival())
  return g
}

export function update(_moment: KitMoment): void {}
