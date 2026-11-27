import { inSteps, stepsOf } from '../../scene/steps'
import type { KitMoment, SeasonKit } from '../kit'
import * as arrivalPart from './arrival'
import { backdrop } from './backdrop'
import * as basePart from './base'
import * as glassPart from './glass'
import * as miniaturePart from './miniature'
import { rig } from './rig'
import * as slabPart from './slab'
import { particles, veil } from './veil'

// Wiring only. Each part of the season lives in its own file with one owner; this file is `/root`'s.
export const kit: SeasonKit = {
  season: basePart.season,
  main: basePart.main,
  prepare: async () => {
    await Promise.all([basePart.prepare(), miniaturePart.prepare(), glassPart.prepare(), slabPart.prepare(), arrivalPart.prepare()])
  },
  base: basePart.base,
  miniature: miniaturePart.miniature,
  arrival: arrivalPart.arrival,
  lights: miniaturePart.lights,
  collider: miniaturePart.collider,
  dressing: inSteps(function* () {
    const glass = glassPart.dressing()
    yield
    return { glass, surface: yield* stepsOf(slabPart.dressing) }
  }),
  update: (moment: KitMoment) => {
    basePart.update(moment)
    miniaturePart.update(moment)
    arrivalPart.update(moment)
    glassPart.update(moment)
    slabPart.update(moment)
  },
  rig,
  get innerLights() {
    return miniaturePart.innerLights()
  },
  veil,
  backdrop,
  particles,
}
