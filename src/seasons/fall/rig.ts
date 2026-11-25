import type { SeasonKit } from '../kit'

// Part `light-fall`. Darker than the other seasons: a dim cream key from the upper right (the soft streak on the glass's right
// shoulder), an orange rim from the lights behind, a low teal sky, and a dim orange card from the left, the warm
// streak on the glass's left edge. The green of the fog and the orange of the faces on the base do the lighting.
export const rig: SeasonKit['rig'] = {
  key: { color: [1, 0.9, 0.78], intensity: 0.5, from: [450, 455, 80] },
  rim: { color: [1, 0.55, 0.22], intensity: 0.5, from: [-240, 230, -380] },
  sky: [0.085, 0.105, 0.085],
  ground: [0.035, 0.04, 0.035],
  fill: 0.6,
  card: { color: [1, 0.62, 0.3], intensity: 0.6, from: [-460, 190, -40], wrap: 0.1, specular: 0.6, inside: 0.2 },
}
