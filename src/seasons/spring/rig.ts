import type { SeasonKit } from '../kit'

// Part `light-spring`. A gentle key like early morning: pearl with a little warmth, from the right, high and in front. The
// approved image has its glass highlights on the limbs, which only lights behind the globe give: the rim stands behind on the
// right (the broad pink highlight from 2 to 4 o'clock and the lit right side of the base), the rose card behind on the left
// (the thin arc from 8 to 10 o'clock).
export const rig: SeasonKit['rig'] = {
  key: { color: [1, 0.9, 0.84], intensity: 0.75, from: [380, 430, 200] },
  rim: { color: [1, 0.6, 0.62], intensity: 0.75, from: [430, 170, -330] },
  sky: [0.2, 0.16, 0.2],
  ground: [0.06, 0.05, 0.055],
  fill: 0.7,
  card: { color: [1, 0.72, 0.7], intensity: 1, from: [-420, 170, -260], wrap: 0.1, specular: 0.6, inside: 0.45 },
}
