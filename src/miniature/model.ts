import type * as THREE from 'three'
import { geometry, prepareModel } from '../core/models'
import { texture } from '../core/textures'

export const MODEL = 'shared/village-model.glb'
export const GRAIN = 'shared/village-grain.lin.tile.png'

export type VillageMesh = 'solid' | 'pane-gable' | 'pane-side' | 'lamp-glass' | 'ground'

export const prepareVillage = (): Promise<void> => prepareModel(MODEL)
export const villageGeometry = (name: VillageMesh): THREE.BufferGeometry => geometry(MODEL, name)
export const villageGrain = (): THREE.Texture => texture(GRAIN)

export function tileMm(): number {
  const extras = villageGeometry('solid').userData.extras as { tileMm?: number } | undefined
  if (!extras?.tileMm) throw new Error('the village model does not say how wide its grain tile is')
  return extras.tileMm
}
