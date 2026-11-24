import type { SeasonKit } from '../kit'

export const rig: SeasonKit['rig'] = {
  key: { color: [0.85, 0.91, 1], intensity: 0.75, from: [450, 455, 80] },
  rim: { color: [0.5, 0.68, 1], intensity: 0.35, from: [-240, 230, -380] },
  sky: [0.14, 0.2, 0.34],
  ground: [0.05, 0.06, 0.09],
  fill: 0.7,
  card: { color: [1, 0.74, 0.48], intensity: 1, from: [-460, 190, -40], wrap: 0.1, specular: 0.6, inside: 0.2 },
}
