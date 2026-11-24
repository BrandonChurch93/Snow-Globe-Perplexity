import type * as THREE from 'three'
import type { SdfGrid } from '../../core/stage'
import type { KitMoment, SeasonKit } from '../kit'
import * as arrivalPart from './arrival'
import { backdrop } from './backdrop'
import * as basePart from './base'
import * as glassPart from './glass'
import * as miniaturePart from './miniature'
import { rig } from './rig'
import * as slabPart from './slab'
import { particles, standIns as veilStandIns, veil } from './veil'

// Wiring only. Each part of the season lives in its own file with one owner; this file is `/root`'s.
interface Optional {
  dressing?: () => THREE.Object3D
  collider?: () => SdfGrid
  standIns?: string[]
}
const glass = glassPart as Optional
const slab = slabPart as Optional
const mini = miniaturePart as Optional
const base = basePart as Optional
const arrival = arrivalPart as Optional

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
  ...(mini.collider ? { collider: mini.collider } : {}),
  ...(glass.dressing || slab.dressing
    ? { dressing: () => ({ ...(glass.dressing ? { glass: glass.dressing() } : {}), ...(slab.dressing ? { surface: slab.dressing() } : {}) }) }
    : {}),
  get standIns() {
    return [...(base.standIns ?? []), ...(mini.standIns ?? []), ...(glass.standIns ?? []), ...(slab.standIns ?? []), ...(arrival.standIns ?? []), ...veilStandIns]
  },
  update: (moment: KitMoment) => {
    basePart.update(moment)
    miniaturePart.update(moment)
    arrivalPart.update(moment)
    glassPart.update(moment)
    slabPart.update(moment)
  },
  get glassDressing() {
    return glassPart.glassDressing
  },
  get surfaceDressing() {
    return slabPart.surfaceDressing
  },
  rig,
  get innerLights() {
    return miniaturePart.innerLights()
  },
  veil,
  backdrop,
  particles,
}
