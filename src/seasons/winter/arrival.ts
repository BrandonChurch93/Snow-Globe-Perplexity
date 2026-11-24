import * as THREE from 'three'
import { config } from '../../config'
import { partChange } from '../../shake/change'
import type { KitMoment } from '../kit'
import * as frost from './frost'
import { fresh } from './miniature'

const own = frost as { arrival?: () => THREE.Object3D }

const GLASS = { burst: 0.46, burstSeconds: 0.22, creep: 0.66, creepSeconds: 2.2 }
const SLAB = { burst: 0.86, burstSeconds: 0.16, creep: 0.26, creepSeconds: 1.6 }

const rise = (t: number, seconds: number): number => 1 - Math.exp(-t / seconds)

export function growth(sinceLanding: number): { glass: number; slab: number } {
  if (!(sinceLanding < Infinity)) return { glass: frost.FULL, slab: frost.FULL }
  const t = Math.max(0, sinceLanding)
  return {
    glass: GLASS.burst * rise(t, GLASS.burstSeconds) + GLASS.creep * rise(t, GLASS.creepSeconds),
    slab: SLAB.burst * rise(t, SLAB.burstSeconds) + SLAB.creep * rise(t, SLAB.creepSeconds),
  }
}

export async function prepare(): Promise<void> {}

export function arrival(): THREE.Object3D {
  const g = new THREE.Group().add(fresh())
  if (own.arrival) g.add(own.arrival())
  return g
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  const swap = config.shake.swapWindow
  const shaking = moment.beat !== null && moment.beat >= swap.fromBeat
  const two = f.from !== f.to && f.change > 0 && f.change < 1
  if (two) {
    if (moment.arrived >= 1) frost.setGrowth(frost.FULL, frost.FULL, 1)
    else if (shaking) frost.setGrowth(0, 0, 0)
    else {
      const g = growth(moment.sinceLanding)
      frost.setGrowth(g.glass, g.slab, 1)
    }
    return
  }
  if (shaking) {
    const through = (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat)
    frost.setGrowth(frost.FULL, frost.FULL, 1 - partChange('glass-dressing', through))
    return
  }
  const g = growth(moment.sinceLanding)
  frost.setGrowth(g.glass, g.slab, 1)
}
