import type { Rgb } from '../../core/materials'
import { anchors } from '../../scene/layout'
import { blockArrival, blockBase, blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, SeasonKit } from '../kit'

const season = 'winter'
const main: Rgb = [0.1, 0.05, 0.028]
const palette: Palette = { ground: [0.82, 0.86, 0.92], cottage: [0.42, 0.36, 0.32], roof: [0.3, 0.12, 0.09], chimney: [0.3, 0.25, 0.23], trunk: [0.16, 0.1, 0.07], crown: [0.1, 0.24, 0.16], post: [0.03, 0.03, 0.035], lamp: [0.9, 0.7, 0.4], pond: [0.5, 0.62, 0.72], fence: [0.3, 0.22, 0.16], path: [0.5, 0.52, 0.56] }
const arrivalTint: Rgb = [0.92, 0.95, 1]
const innerLights: InnerLight[] = [
    { at: anchors.lamp, color: [1, 0.66, 0.3], power: 0.88, reachMm: 26, flicker: 0.06, cycles: 3, phase: 0.1 },
    { at: anchors.window, color: [1, 0.55, 0.2], power: 0.64, reachMm: 18, flicker: 0.12, cycles: 5, phase: 0.4 },
    { at: anchors.crownTop, color: [1, 0.8, 0.4], power: 0.48, reachMm: 22, flicker: 0.2, cycles: 7, phase: 0.7 },
  ]

export const kit: SeasonKit = {
  season,
  main,
  base: () => blockBase(season, main, 0.8),
  miniature: () => blockMiniature(season, palette),
  arrival: () => blockArrival(season, arrivalTint),
  lights: () => blockLights(season, innerLights),
  glassDressing: { tint: [0.75, 0.85, 1], amount: 0.1 },
  surfaceDressing: { tint: [0.7, 0.82, 1], amount: 0.35, reachMm: 150 },
  rig: { key: { color: [0.82, 0.9, 1], intensity: 2.6, from: [-260, 420, 300] }, rim: { color: [0.55, 0.7, 1], intensity: 1, from: [300, 200, -380] }, sky: [0.2, 0.26, 0.4], ground: [0.04, 0.035, 0.03], fill: 0.9 },
  innerLights,
  veil: { tint: [0.86, 0.9, 1], density: 0.11, rest: 0.0012 },
  backdrop: { colors: [[0.45, 0.62, 1], [0.8, 0.88, 1], [0.55, 0.75, 1], [1, 0.72, 0.4]], room: [0.004, 0.005, 0.008], floor: [0.012, 0.013, 0.016] },
  particles: { flake: { color: [0.86, 0.9, 0.96], glow: 0 }, glitter: { color: [1, 0.9, 0.65], glow: 2.2 } },
}
