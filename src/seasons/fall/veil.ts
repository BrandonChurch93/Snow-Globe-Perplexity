import type { SeasonKit } from '../kit'

// Part `veil-fall` and the colours of the season's particle kinds. First numbers from the blockout.
export const standIns: string[] = ['veil-fall']

export const veil: SeasonKit['veil'] = { tint: [0.42, 0.95, 0.5], density: 0.16, rest: 0 }
export const particles: SeasonKit['particles'] = { leaf: { color: [0.9, 0.38, 0.06], glow: 0 }, ember: { color: [1, 0.5, 0.1], glow: 4 }, mote: { color: [0.8, 0.95, 0.7], glow: 0.3 }, bat: { color: [0.02, 0.02, 0.03], glow: 0 } }
