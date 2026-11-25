import type { SeasonKit } from '../kit'

// Part `light-summer`: the last hour of sun. The key is one strong warm light, low, behind the globe and to its right: it draws
// the flare on the glass's upper right shoulder (its reflection at the limb), throws the globe's shadow toward the camera and
// to the left, and is focused by the globe into the pool of light there (`glass.ts` reads the same direction). The rim is the
// same sun's spill from the back left; the card is the warm bounce that lights the front of the base and of the miniature.
// Fitted to `references/approved/summer-rest.png` by the recipe "The light of one more season".
export const rig: SeasonKit['rig'] = {
  key: { color: [1, 0.74, 0.44], intensity: 0.75, from: [250, 230, -400] },
  rim: { color: [1, 0.8, 0.52], intensity: 0.35, from: [-330, 250, -280] },
  sky: [0.2, 0.17, 0.13],
  ground: [0.1, 0.075, 0.05],
  fill: 0.7,
  card: { color: [1, 0.78, 0.5], intensity: 1, from: [380, 170, 300], wrap: 0.35, specular: 0.4, inside: 0.3 },
}
