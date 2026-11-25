import type { SeasonKit } from '../kit'

// Part `veil-summer` and the colours of the season's particle kinds. The veil is a golden haze: thick and honey coloured in the
// storm, and at rest only the faint warmth of dusty air in low sun. The fireflies are yellow-green lights, far brighter than
// anything they pass; the seeds are the cream white of dandelion down and take the light they hang in; the motes are fine gold
// dust, dim enough that tens of thousands of them read as air and never as snow.
export const standIns: string[] = []

// The shared veil keeps a fifth of its storm haze for as long as most of the pool is afloat, and summer's motes never land:
// `rest` takes most of that share back, so the storm can be thick and the air at rest stays clear (0.04 x 0.2 x density is the share).
export const veil: SeasonKit['veil'] = { tint: [1.15, 1, 0.8], density: 0.1, rest: -0.00075 }
export const particles: SeasonKit['particles'] = { firefly: { color: [0.95, 1, 0.3], glow: 4 }, seed: { color: [1.45, 1.36, 1.2], glow: 0 }, mote: { color: [1.25, 1, 0.66], glow: 0.5 } }
