import type { SeasonKit } from '../kit'
import * as arrivalPart from './arrival'
import * as basePart from './base'
import * as frostPart from './frost'
import * as miniaturePart from './miniature'
import { backdrop } from './backdrop'
import { rig } from './rig'
import { particles, veil } from './veil'

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
  dressing: frostPart.dressing,
  update: (moment) => {
    basePart.update(moment)
    miniaturePart.update(moment)
    arrivalPart.update(moment)
    frostPart.update(moment)
  },
  get glassDressing() {
    return frostPart.glassDressing
  },
  rig,
  get innerLights() {
    return miniaturePart.innerLights()
  },
  veil,
  backdrop,
  particles,
}
