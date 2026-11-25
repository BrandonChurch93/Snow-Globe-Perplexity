import * as THREE from 'three'
import { config } from '../../config'
import type { KitMoment } from '../kit'
import { setCandles } from './base'
import { setSkitter } from './slab'

// Part `arrival-fall`: what the landing sets off. The dry leaves on the slab skitter out from the foot (slab.ts moves
// them) and the faces on the base take light one after another (base.ts lights them). Both are read from the time since
// the landing and nothing else. While the globe is in the air on its way into fall the candles are out and the leaves
// lie where they lay before the thump; a fall that is leaving, or at rest, has every face lit and every leaf at rest.
const REST = 1e3

export function seconds(moment: KitMoment): number {
  const swap = config.shake.swapWindow
  const inAir = moment.beat !== null && moment.beat >= swap.fromBeat && moment.arrived < 0.5
  if (inAir) return 0
  return moment.sinceLanding < Infinity ? Math.max(0, moment.sinceLanding) : REST
}

export async function prepare(): Promise<void> {}

export function arrival(): THREE.Object3D {
  return new THREE.Group()
}

export function update(moment: KitMoment): void {
  const t = seconds(moment)
  setCandles(moment, t)
  setSkitter(t)
}
