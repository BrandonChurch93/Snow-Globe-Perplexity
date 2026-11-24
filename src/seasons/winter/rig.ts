import type { SeasonKit } from '../kit'
import type { RigCard } from '../../scene/lighting'

export const rig: SeasonKit['rig'] & { card: RigCard } = {
  key: { color: [0.85, 0.91, 1], intensity: 0.75, from: [450, 455, 80] },
  rim: { color: [0.5, 0.68, 1], intensity: 0.35, from: [-240, 230, -380] },
  sky: [0.2, 0.22, 0.27],
  ground: [0.065, 0.065, 0.075],
  fill: 0.85,
  card: { color: [1, 0.74, 0.48], intensity: 1, from: [-460, 190, -40], wrap: 0.1, specular: 0.6, inside: 0.2 },
}
