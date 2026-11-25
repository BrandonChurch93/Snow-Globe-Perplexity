import type { SeasonKit } from '../kit'

// Part `veil-fall` and the colours of the season's particle kinds. First numbers from the blockout.
export const standIns: string[] = []

export const veil: SeasonKit['veil'] = { tint: [0.62, 0.95, 0.45], density: 0.12, rest: 0 }
export const particles: SeasonKit['particles'] = { leaf: { color: [0.9, 0.38, 0.06], glow: 0 }, ember: { color: [1, 0.5, 0.1], glow: 4 }, mote: { color: [0.42, 0.4, 0.36], glow: 0 }, bat: { color: [0.02, 0.02, 0.03], glow: 0 } }
