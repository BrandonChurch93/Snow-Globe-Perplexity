import type { SeasonKit } from '../kit'

// Part `light-summer`: the last hour of sun. The key is one strong warm light, low, behind the globe and to its right: it draws
// the flare on the glass's upper right shoulder (its reflection at the limb), throws the globe's shadow toward the camera and
// to the left, and is focused by the globe into the pool of light there (`glass.ts` reads the same direction). The rim is the
// same sun's spill from the back left: the two rake the shoulder and the flanks of the base. It is kept low, because the glass
// shows it as a broad pale card inside its left limb, where the approved image has clear dark air between the seed heads.
// The sky is cool, so what the sun does not reach is blue-grey, as the approved image has the shade between the ridges. The
// card is the warm light the glowing liquid and the lit table send back: it stands in front, upper left, lights the front of
// the base to cream and reaches inside the glass (`inside` above 1: the liquid round the miniature is itself bright).
// Fitted to `references/approved/summer-rest.png` by the recipe "The light of one more season".
export const rig: SeasonKit['rig'] = {
  key: { color: [1, 0.82, 0.6], intensity: 1.9, from: [250, 230, -400] },
  rim: { color: [1, 0.84, 0.64], intensity: 0.3, from: [-330, 250, -280] },
  sky: [0.075, 0.092, 0.115],
  ground: [0.03, 0.03, 0.032],
  fill: 0.7,
  card: { color: [1, 0.84, 0.66], intensity: 0.45, from: [-240, 300, 450], wrap: 0.25, specular: 0.4, inside: 1.2 },
}
