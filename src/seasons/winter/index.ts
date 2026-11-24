import type { SeasonKit } from '../kit'
import * as arrivalPart from './arrival'
import * as basePart from './base'
import * as frostPart from './frost'
import * as miniaturePart from './miniature'
import { backdrop } from './backdrop'
import { rig } from './rig'
import { particles, standIns as veilStandIns, veil } from './veil'

const frost = frostPart as { dressing?: SeasonKit['dressing'] }

export const kit: SeasonKit = {
  season: basePart.season,
  main: basePart.main,
  prepare: async () => {
    await Promise.all([basePart.prepare(), miniaturePart.prepare(), frostPart.prepare(), arrivalPart.prepare()])
  },
  base: basePart.base,
  miniature: miniaturePart.miniature,
  arrival: arrivalPart.arrival,
  lights: miniaturePart.lights,
  collider: miniaturePart.collider,
  ...(frost.dressing ? { dressing: frost.dressing } : {}),
  standIns: [...frostPart.standIns, ...veilStandIns],
  update: (moment) => {
    basePart.update(moment)
    miniaturePart.update(moment)
    arrivalPart.update(moment)
    frostPart.update(moment)
  },
  get glassDressing() {
    return frostPart.glassDressing
  },
  get surfaceDressing() {
    return frostPart.surfaceDressing
  },
  rig,
  get innerLights() {
    return miniaturePart.innerLights()
  },
  veil,
  backdrop,
  particles,
}
