import type { SeasonKit } from '../kit'

// Part `veil-summer` and the colours of the season's particle kinds. The veil is a golden haze: thick and honey coloured in the
// storm, and at rest only the faint warmth of dusty air in low sun. The fireflies are yellow-green lights, far brighter than
// anything they pass; the seeds are the cream white of dandelion down and take the light they hang in; the motes are fine gold
// dust, dim enough that tens of thousands of them read as air and never as snow.
export const standIns: string[] = []

export const veil: SeasonKit['veil'] = { tint: [1, 0.84, 0.52], density: 0.09, rest: 0 }
export const particles: SeasonKit['particles'] = { firefly: { color: [0.72, 1, 0.22], glow: 6 }, seed: { color: [0.98, 0.95, 0.86], glow: 0 }, mote: { color: [0.5, 0.39, 0.2], glow: 0.15 } }
