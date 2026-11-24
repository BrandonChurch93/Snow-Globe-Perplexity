import type { Rgb } from '../../core/materials'
import { anchors } from '../../scene/layout'
import { blockArrival, blockBase, blockLights, blockMiniature, type Palette } from '../blockout'
import type { InnerLight, SeasonKit } from '../kit'

const season = 'fall'
const main: Rgb = [0.06, 0.04, 0.07]
const palette: Palette = { ground: [0.3, 0.17, 0.06], cottage: [0.3, 0.27, 0.27], roof: [0.1, 0.08, 0.12], chimney: [0.22, 0.2, 0.2], trunk: [0.09, 0.06, 0.05], crown: [0.8, 0.3, 0.04], post: [0.03, 0.03, 0.035], lamp: [1, 0.6, 0.2], pond: [0.08, 0.14, 0.1], fence: [0.2, 0.16, 0.13], path: [0.34, 0.32, 0.3] }
const arrivalTint: Rgb = [1, 0.45, 0.05]
const innerLights: InnerLight[] = [
    { at: anchors.lamp, color: [1, 0.55, 0.15], power: 2, reachMm: 26, flicker: 0.1, cycles: 3, phase: 0.5 },
    { at: anchors.window, color: [1, 0.45, 0.08], power: 1.8, reachMm: 18, flicker: 0.25, cycles: 7, phase: 0.1 },
    { at: anchors.pond, color: [0.3, 1, 0.3], power: 1.2, reachMm: 28, flicker: 0.1, cycles: 2, phase: 0.8 },
  ]

export const kit: SeasonKit = {
  season,
  main,
  base: () => blockBase(season, main, 0.7),
  miniature: () => blockMiniature(season, palette),
  arrival: () => blockArrival(season, arrivalTint),
  lights: () => blockLights(season, innerLights),
  glassDressing: { tint: [0.5, 1, 0.5], amount: 0.06 },
  surfaceDressing: { tint: [0.9, 0.4, 0.05], amount: 0.32, reachMm: 145 },
  rig: { key: { color: [0.7, 0.75, 1], intensity: 2, from: [-240, 400, 280] }, rim: { color: [1, 0.5, 0.15], intensity: 1.1, from: [320, 180, -360] }, sky: [0.2, 0.16, 0.3], ground: [0.05, 0.03, 0.02], fill: 0.8 },
  innerLights,
  veil: { tint: [0.5, 0.9, 0.45], density: 0.1, rest: 0.003 },
  backdrop: { colors: [[1, 0.5, 0.1], [0.6, 0.3, 0.9], [1, 0.75, 0.3], [0.4, 0.9, 0.4]], room: [0.006, 0.004, 0.008], floor: [0.013, 0.01, 0.014] },
  particles: { leaf: { color: [0.9, 0.38, 0.06], glow: 0 }, ember: { color: [1, 0.5, 0.1], glow: 4 }, mote: { color: [0.8, 0.95, 0.7], glow: 0.3 }, bat: { color: [0.02, 0.02, 0.03], glow: 0 } },
}
