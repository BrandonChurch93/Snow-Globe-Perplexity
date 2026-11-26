import * as THREE from 'three'
import { config } from '../../config'
import { ROOM_RIG, changeSwell } from '../../scene/lighting'
import { changeSpan, partChange } from '../../shake/change'
import { rimGapMm } from '../../shake/table'
import type { KitMoment } from '../kit'
import * as frost from './frost'
import { fresh } from './miniature'

const own = frost as { arrival?: () => THREE.Object3D }

// The frost answers the landing. `start` is the growth on the frame the foot is flat, just past the level at which the first
// texels of the maps appear (frost.ts takes 0.07 off the growth), so only the first rime hugs the foot on that frame and nothing
// stands there at once.
// The glass: the thump throws the first of it out fast (`kick`, over `kickSeconds`) and the feathers grow out of that (`burst`);
// it reaches almost its rest pattern by `states.landedSeconds`, as in `references/approved/winter-shake.png`, and the last tips
// creep on after that.
// The slab: no kick. The spines of the arms hold the first sixth of the map's time, so a kick put every spine out at its full
// length two frames after the landing. The growth climbs at a near even pace (`burst` over `burstSeconds` with `power` 1.35)
// and frost.ts holds the far places back behind the rim while the growth is young (`look.slab.frontLag`): a ring starts at the
// contact line on the landing frame and runs outward, the spines reach their tips about 20 frames after the landing with the
// side branches filling in behind the front, the nearest to the foot first; about 95 in 100 of the frost stands at
// `states.landedSeconds` (the approved image has it nearly whole there, which is what bounds how slow this can be), and the
// last needles creep in under the settling storm for a second and more.
const GLASS = { start: 0.1, kick: 0.12, kickSeconds: 0.05, burst: 0.71, burstSeconds: 0.26, power: 2, creep: 0.27, creepSeconds: 1.2 }
const SLAB = { start: 0.16, kick: 0, kickSeconds: 0.05, burst: 0.66, burstSeconds: 0.5, power: 1.35, creep: 0.39, creepSeconds: 1.4 }
// The answer begins at the touch, before the foot is flat: from the frame the low edge of the rim meets the slab (the rim's gap
// is under `gapMm`) the rime begins under that edge and runs round the foot as it rolls flat, the touching side `lead` of the
// roll ahead of the far side, until every side has `start` on the frame the foot is flat. `riseMm` is the height of the foot's
// centre at the touch (58 mm of foot at 3 degrees); the pose is read, never a frame number. The roll is eased (`ease`, a power
// under 1) so the edge that touched has its rime two frames after the touch instead of four: the foot comes down slowly at
// first, and the rime should not wait for it.
const TOUCH = { gapMm: 0.1, riseMm: 3, lead: 1.5, ease: 0.5 }

// The leaving follows the light of the change. `through` is the place in the swap window. The light inside the glass swells
// slowly (`changeSwell` of the lighting) and the frost melts into it: the front leaves the foot as the swell begins and has
// crossed `lead` of its way when the swell is full, each step as large as the light the slab receives on that frame (ten to
// the swell's `glow`, as the lighting gives it to the slab), so the frost goes fastest where the light grows fastest and
// never moves on a frame the light does not. The rest, the far tips and the thick of the heap, goes during the dressing's own
// span, when the light is full. Before the swell there is no step at all.
const LEAVE = { lead: 0.5 }
export function kept(part: string, through: number): number {
  if (!(through > 0)) return 1
  const gain = ROOM_RIG.bloomGain
  const lit = through >= changeSpan(part).from ? 1 : Math.min(1, ((1 + gain) ** changeSwell(through).glow - 1) / gain)
  return 1 - (LEAVE.lead * lit + (1 - LEAVE.lead) * partChange(part, through))
}

const rise = (t: number, seconds: number): number => 1 - Math.exp(-t / seconds)
const burst = (t: number, seconds: number, power: number): number => 1 - Math.exp(-((t / seconds) ** power))
const level = (t: number, p: typeof GLASS): number => p.start + p.kick * rise(t, p.kickSeconds) + p.burst * burst(t, p.burstSeconds, p.power) + p.creep * rise(t, p.creepSeconds)

export function growth(sinceLanding: number): { glass: number; slab: number } {
  if (!(sinceLanding < Infinity)) return { glass: frost.FULL, slab: frost.FULL }
  const t = Math.max(0, sinceLanding)
  return { glass: level(t, GLASS), slab: level(t, SLAB) }
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
      // After the window the frost is gone until the rim meets the slab again; then the first rime comes with the foot rolling
      // flat, from the edge that touched round to the far edge (frost.ts reads the side from the foot's tilt).
      const pose = f.globe
      const rolled = rimGapMm(pose) <= TOUCH.gapMm ? (1 - Math.min(1, Math.max(0, pose.y / TOUCH.riseMm))) ** TOUCH.ease : 0
      if (rolled > 0) frost.setGrowth(GLASS.start * rolled, SLAB.start, 1, 1, rolled, TOUCH.lead)
      else frost.setGrowth(0, 0, 0, 0)
      return
    }
    frost.setGrowth(g.glass, g.slab, kept('shed', through), kept('shed', through))
    return
  }
  frost.setGrowth(g.glass, g.slab, 1, 1)
}
