import type { SeasonKit } from '../kit'

// Part `veil-fall` and the colours of the season's particle kinds. The shared veil is kept thin: it also lays a haze at rest
// in proportion to what is afloat, and fall's motes and embers never land. The fog of the storm is the season's own lit volume
// (`glass.ts`), lifted through the dome by the stir.
export const standIns: string[] = []

export const veil: SeasonKit['veil'] = { tint: [0.62, 0.95, 0.45], density: 0.035, rest: 0 }
export const particles: SeasonKit['particles'] = { leaf: { color: [0.85, 0.27, 0.035], glow: 0 }, ember: { color: [1, 0.36, 0.06], glow: 1.3 }, mote: { color: [0.26, 0.19, 0.12], glow: 0 }, bat: { color: [0.02, 0.02, 0.03], glow: 0 } }
