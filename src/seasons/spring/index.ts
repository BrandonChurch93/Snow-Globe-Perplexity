import type { Rgb } from '../../core/materials'
import { anchors } from '../../scene/layout'
import { blockArrival, blockBase, blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, SeasonKit } from '../kit'

const season = 'spring'
const main: Rgb = [0.16, 0.27, 0.09]
const palette: Palette = { ground: [0.22, 0.42, 0.14], cottage: [0.46, 0.42, 0.36], roof: [0.2, 0.3, 0.12], chimney: [0.34, 0.3, 0.27], trunk: [0.2, 0.13, 0.08], crown: [0.95, 0.55, 0.68], post: [0.03, 0.03, 0.035], lamp: [0.9, 0.75, 0.5], pond: [0.25, 0.45, 0.6], fence: [0.42, 0.32, 0.22], path: [0.5, 0.48, 0.44] }
const arrivalTint: Rgb = [1, 0.72, 0.82]
const innerLights: InnerLight[] = [
    { at: anchors.lamp, color: [1, 0.78, 0.5], power: 1.6, reachMm: 24, flicker: 0.04, cycles: 2, phase: 0.2 },
    { at: anchors.window, color: [1, 0.68, 0.36], power: 1.5, reachMm: 18, flicker: 0.08, cycles: 4, phase: 0.5 },
    { at: anchors.crown, color: [1, 0.6, 0.75], power: 0.9, reachMm: 30, flicker: 0.03, cycles: 1, phase: 0 },
  ]

export const kit: SeasonKit = {
  season,
  main,
  base: () => blockBase(season, main, 0.86),
  miniature: () => blockMiniature(season, palette),
  arrival: () => blockArrival(season, arrivalTint),
  lights: () => blockLights(season, innerLights),
  glassDressing: { tint: [0.85, 0.95, 1], amount: 0.07 },
  surfaceDressing: { tint: [1, 0.7, 0.8], amount: 0.3, reachMm: 140 },
  rig: { key: { color: [1, 0.88, 0.8], intensity: 2.4, from: [-300, 360, 320] }, rim: { color: [1, 0.7, 0.8], intensity: 0.9, from: [280, 220, -360] }, sky: [0.4, 0.34, 0.38], ground: [0.05, 0.05, 0.03], fill: 1 },
  innerLights,
  veil: { tint: [1, 0.82, 0.88], density: 0.1, rest: 0.0016 },
  backdrop: { colors: [[1, 0.6, 0.75], [1, 0.9, 0.86], [0.95, 0.78, 0.9], [0.8, 0.9, 0.8]], room: [0.008, 0.006, 0.007], floor: [0.016, 0.013, 0.014] },
  particles: { petal: { color: [1, 0.72, 0.8], glow: 0 }, mote: { color: [1, 0.95, 0.9], glow: 0.3 } },
}
