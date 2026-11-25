import type { SeasonKit } from '../kit'

// Part `veil-spring` and the colours of the season's particle kinds. First numbers from the blockout.
export const standIns: string[] = ['veil-spring']

export const veil: SeasonKit['veil'] = { tint: [1, 0.82, 0.88], density: 0.1, rest: 0 }
export const particles: SeasonKit['particles'] = { petal: { color: [1, 0.72, 0.8], glow: 0 }, mote: { color: [1, 0.95, 0.9], glow: 0.3 } }
