import type { SeasonKit } from '../kit'

// Part `light-summer`: the last hour of sun. The key is one strong warm light, low, behind the globe and to its right: it draws
// the flare on the glass's upper right shoulder (its reflection at the limb), throws the globe's shadow toward the camera and
// to the left, and is focused by the globe into the pool of light there (`glass.ts` reads the same direction). The rim is the
// same sun's spill from the back left; the card is the warm bounce that lights the front of the base and of the miniature.
// Fitted to `references/approved/summer-rest.png` by the recipe "The light of one more season".
export const rig: SeasonKit['rig'] = {
  key: { color: [1, 0.8, 0.56], intensity: 1.3, from: [250, 230, -400] },
  rim: { color: [1, 0.82, 0.6], intensity: 0.9, from: [-330, 250, -280] },
  sky: [0.1, 0.082, 0.062],
  ground: [0.035, 0.028, 0.02],
  fill: 0.7,
  card: { color: [1, 0.8, 0.58], intensity: 0.16, from: [500, 140, 60], wrap: 0.2, specular: 0.4, inside: 0.3 },
}
