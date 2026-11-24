import * as THREE from 'three'
import { config } from '../../config'
import { partChange } from '../../shake/change'
import type { KitMoment } from '../kit'
import * as frost from './frost'
import { fresh } from './miniature'

const own = frost as { arrival?: () => THREE.Object3D }

// The frost starts on the landing frame itself: `start` is the growth at the landing, just past the level at which the first
// texels of the maps appear (frost.ts takes 0.07 off the growth), so only the first rime hugs the foot on that frame and nothing
// stands there at once; the heap and the arms then grow out of it over the next frames.
// The glass reaches almost its rest pattern by `states.landedSeconds`, as in `references/approved/winter-shake.png`; the last tips
// creep on after that.
const GLASS = { start: 0.1, burst: 0.83, burstSeconds: 0.2, creep: 0.27, creepSeconds: 1.2 }
const SLAB = { start: 0.1, burst: 0.7, burstSeconds: 0.2, creep: 0.39, creepSeconds: 1.4 }

const rise = (t: number, seconds: number): number => 1 - Math.exp(-t / seconds)
const burst = (t: number, seconds: number): number => 1 - Math.exp(-((t / seconds) ** 2))

export function growth(sinceLanding: number): { glass: number; slab: number } {
  if (!(sinceLanding < Infinity)) return { glass: frost.FULL, slab: frost.FULL }
  const t = Math.max(0, sinceLanding)
  return {
    glass: GLASS.start + GLASS.burst * burst(t, GLASS.burstSeconds) + GLASS.creep * rise(t, GLASS.creepSeconds),
    slab: SLAB.start + SLAB.burst * burst(t, SLAB.burstSeconds) + SLAB.creep * rise(t, SLAB.creepSeconds),
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
  // The growth is always the one function of the time since the landing, so it cannot step when the swap window opens or when
  // the arrival is counted as done; only how much of the frost is kept changes inside the window.
  const g = growth(moment.sinceLanding)
  if (two) {
    if (shaking && moment.arrived < 1) frost.setGrowth(0, 0, 0, 0)
    else frost.setGrowth(g.glass, g.slab, 1, 1)
    return
  }
  if (shaking) {
    const through = (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat)
    frost.setGrowth(g.glass, g.slab, 1 - partChange('glass-dressing', through), 1 - partChange('surface-dressing', through))
    return
  }
  frost.setGrowth(g.glass, g.slab, 1, 1)
}
