import type { SeasonKit } from '../kit'

// Part `veil-summer` and the colours of the season's particle kinds. First numbers from the blockout.
export const standIns: string[] = ['veil-summer']

export const veil: SeasonKit['veil'] = { tint: [1, 0.86, 0.5], density: 0.1, rest: 0.0014 }
export const particles: SeasonKit['particles'] = { firefly: { color: [0.8, 1, 0.3], glow: 5 }, seed: { color: [0.95, 0.93, 0.85], glow: 0 }, mote: { color: [1, 0.9, 0.6], glow: 0.3 } }
