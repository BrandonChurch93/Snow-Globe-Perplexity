import * as THREE from 'three'
import { config } from '../../config'
import type { KitMoment } from '../kit'
import { FLOW, trickle } from './base'
import { poolFill, setJump, setPool } from './slab'

export const HELD = 1e3
/** The petals on the table start their jump on the landing's own frame: the jump's clock runs this far ahead of the landing, seconds, so that frame already shows the first small burst beside the base. */
export const JUMP_LEAD = 0.05

export async function prepare(): Promise<void> {}

export function arrival(): THREE.Object3D {
  return new THREE.Group()
}

export function landingClock(moment: KitMoment): number {
  const f = moment.frame
  const swap = config.shake.swapWindow
  const shaking = moment.beat !== null && moment.beat >= swap.fromBeat
  const two = f.from !== f.to && f.change > 0 && f.change < 1
  const through = shaking ? (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat) : 0
  if ((two && shaking && moment.arrived < 1) || (!two && shaking && through >= 1)) return 0
  return moment.sinceLanding < Infinity ? Math.min(Math.max(0, moment.sinceLanding), HELD) : HELD
}

export function update(moment: KitMoment): void {
  const since = landingClock(moment)
  const landed = moment.sinceLanding >= 0 && since >= Math.min(moment.sinceLanding, HELD)
  setJump(landed ? since + JUMP_LEAD : since)
  const reached = since >= FLOW.startSeconds + 0.9 * FLOW.runSeconds ? 1 : 0
  setPool(trickle.foot, since >= HELD ? 1 : poolFill(since), moment.time, reached)
}
