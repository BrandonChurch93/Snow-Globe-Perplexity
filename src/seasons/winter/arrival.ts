import * as THREE from 'three'
import { config } from '../../config'
import { changeBloom, changeSpan, partChange } from '../../shake/change'
import { rimGapMm } from '../../shake/table'
import type { KitMoment } from '../kit'
import * as frost from './frost'
import { fresh } from './miniature'

const own = frost as { arrival?: () => THREE.Object3D }

// The frost answers the landing. `start` is the growth on the frame the foot is flat, just past the level at which the first
// texels of the maps appear (frost.ts takes 0.07 off the growth), so only the first rime hugs the foot on that frame and nothing
// stands there at once. The thump then throws the first of it out fast (`kick`, over `kickSeconds`: the heap at the foot and the
// roots of the arms, strongest by the first rock of the foot), and the arms grow out of that more slowly (`burst`), so no frame
// has the whole star that the frame before did not have.
// The glass reaches almost its rest pattern by `states.landedSeconds`, as in `references/approved/winter-shake.png`; the last tips
// creep on after that.
const GLASS = { start: 0.1, kick: 0.12, kickSeconds: 0.05, burst: 0.71, burstSeconds: 0.26, creep: 0.27, creepSeconds: 1.2 }
const SLAB = { start: 0.1, kick: 0.12, kickSeconds: 0.05, burst: 0.58, burstSeconds: 0.26, creep: 0.39, creepSeconds: 1.4 }
// The answer begins at the touch, before the foot is flat: from the frame the low edge of the rim meets the slab (the rim's gap
// is under `gapMm`) the growth climbs from nothing to `start` as the foot rolls flat. `riseMm` is the height of the foot's centre
// at the touch (58 mm of foot at 2.8 degrees); the pose is read, never a frame number.
const TOUCH = { gapMm: 0.1, riseMm: 2.8 }

// The leaving follows the bloom's own light. `through` is the place in the swap window. While the bloom rises the front leaves
// the foot and crosses the first `lead` of its way (the heap and the roots of the arms, where the light pool is brightest);
// it crosses the rest during the dressing's own span, when the bloom is full. Before the bloom there is no step at all, and
// the last crystal is gone while the bloom is still full.
const LEAVE = { lead: 0.3 }
export function kept(part: string, through: number): number {
  if (!(through > 0)) return 1
  const lit = through >= changeSpan(part).from ? 1 : changeBloom(through)
  return 1 - (LEAVE.lead * lit + (1 - LEAVE.lead) * partChange(part, through))
}

const rise = (t: number, seconds: number): number => 1 - Math.exp(-t / seconds)
const burst = (t: number, seconds: number): number => 1 - Math.exp(-((t / seconds) ** 2))

export function growth(sinceLanding: number): { glass: number; slab: number } {
  if (!(sinceLanding < Infinity)) return { glass: frost.FULL, slab: frost.FULL }
  const t = Math.max(0, sinceLanding)
  return {
    glass: GLASS.start + GLASS.kick * rise(t, GLASS.kickSeconds) + GLASS.burst * burst(t, GLASS.burstSeconds) + GLASS.creep * rise(t, GLASS.creepSeconds),
    slab: SLAB.start + SLAB.kick * rise(t, SLAB.kickSeconds) + SLAB.burst * burst(t, SLAB.burstSeconds) + SLAB.creep * rise(t, SLAB.creepSeconds),
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
    if (through >= 1) {
      // After the window the frost is gone until the rim meets the slab again; then the first rime comes with the foot rolling flat.
      const pose = f.globe
      const down = rimGapMm(pose) <= TOUCH.gapMm ? 1 - Math.min(1, Math.max(0, pose.y / TOUCH.riseMm)) : 0
      if (down > 0) frost.setGrowth(GLASS.start * down, SLAB.start * down, 1, 1)
      else frost.setGrowth(0, 0, 0, 0)
      return
    }
    frost.setGrowth(g.glass, g.slab, kept('glass-dressing', through), kept('surface-dressing', through))
    return
  }
  frost.setGrowth(g.glass, g.slab, 1, 1)
}
