import type { Rgb } from '../../core/materials'
import { anchors } from '../../scene/layout'
import { blockArrival, blockBase, blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, SeasonKit } from '../kit'

const season = 'summer'
const main: Rgb = [0.36, 0.2, 0.06]
const palette: Palette = { ground: [0.2, 0.36, 0.08], cottage: [0.55, 0.47, 0.36], roof: [0.42, 0.2, 0.1], chimney: [0.38, 0.32, 0.27], trunk: [0.22, 0.14, 0.08], crown: [0.12, 0.38, 0.1], post: [0.03, 0.03, 0.035], lamp: [1, 0.85, 0.5], pond: [0.1, 0.3, 0.42], fence: [0.5, 0.4, 0.26], path: [0.56, 0.5, 0.42] }
const arrivalTint: Rgb = [0.85, 0.95, 0.3]
const innerLights: InnerLight[] = [
    { at: anchors.lamp, color: [1, 0.8, 0.4], power: 0.72, reachMm: 26, flicker: 0.04, cycles: 2, phase: 0.3 },
    { at: anchors.window, color: [1, 0.7, 0.3], power: 0.52, reachMm: 18, flicker: 0.06, cycles: 3, phase: 0.6 },
    { at: anchors.pond, color: [0.75, 1, 0.3], power: 0.44, reachMm: 24, flicker: 0.3, cycles: 6, phase: 0.2 },
  ]

export const kit: SeasonKit = {
  season,
  main,
  standIns: [`glass-dressing-${season}`, `veil-${season}`],
  base: () => blockBase(season, main, 0.74),
  miniature: () => blockMiniature(season, palette),
  arrival: () => blockArrival(season, arrivalTint),
  lights: () => blockLights(season, innerLights),
  glassDressing: { tint: [1, 0.9, 0.6], amount: 0.06 },
  surfaceDressing: { tint: [0.9, 0.75, 0.3], amount: 0.28, reachMm: 130 },
  rig: { key: { color: [1, 0.74, 0.42], intensity: 2.5, from: [-340, 260, 300] }, rim: { color: [0.4, 0.6, 0.9], intensity: 0.9, from: [300, 240, -340] }, sky: [0.3, 0.3, 0.42], ground: [0.1, 0.085, 0.075], fill: 1.5 },
  innerLights,
  veil: { tint: [1, 0.86, 0.5], density: 0.1, rest: 0.0014 },
  backdrop: { colors: [[1, 0.7, 0.3], [1, 0.85, 0.5], [0.4, 0.75, 0.8], [0.8, 1, 0.4]], room: [0.0062, 0.0056, 0.0086], floor: [0.012, 0.0108, 0.0158] },
  particles: { firefly: { color: [0.8, 1, 0.3], glow: 5 }, seed: { color: [0.95, 0.93, 0.85], glow: 0 }, mote: { color: [1, 0.9, 0.6], glow: 0.3 } },
}
