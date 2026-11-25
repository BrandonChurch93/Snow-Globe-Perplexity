import type { SeasonKit } from '../kit'

// The lights behind: soft pink and pearl. The list runs from the dimmest discs to the brightest (the stage picks by a disc's
// level): the dim ones are rose, the middle ones salmon, the bright ones peach and pearl, with one pale green slot among them, as in
// `references/approved/spring-rest.png` (disc colours there, in linear light: 1, 0.45 to 0.66, 0.42 to 0.65).
const G = 1.7
const rose: [number, number, number] = [G, 0.42 * G, 0.5 * G]
const blush: [number, number, number] = [G, 0.5 * G, 0.54 * G]
const salmon: [number, number, number] = [G, 0.54 * G, 0.46 * G]
// The brightest two are held lower, so that where the lights are lifted they stay peach and do not burn white.
const P = 1.25
const peach: [number, number, number] = [P, 0.61 * P, 0.5 * P]
const pearl: [number, number, number] = [P, 0.66 * P, 0.56 * P]
const green: [number, number, number] = [0.6, 0.85, 0.58]

// Where the hero camera sees a light: across and up from the middle of its frame, as tangents. (The hero stands 615.3 mm from
// its aim at 67.4 mm, 4.5 degrees above it; the lights are placed for that view and the other cameras see the same room.)
const HERO_PITCH = (4.5 * Math.PI) / 180
const HERO_AT: [number, number, number] = [0, 67.4 + Math.sin(HERO_PITCH) * 615.3, Math.cos(HERO_PITCH) * 615.3]
const seen = (at: readonly [number, number, number]): [number, number] => {
  const v = [at[0] - HERO_AT[0], at[1] - HERO_AT[1], at[2] - HERO_AT[2]]
  const ahead = Math.max(1, -v[1]! * Math.sin(HERO_PITCH) - v[2]! * Math.cos(HERO_PITCH))
  return [v[0]! / ahead, (v[1]! * Math.cos(HERO_PITCH) - v[2]! * Math.sin(HERO_PITCH)) / ahead]
}
/** The large warm oval that stands beside the globe's upper left shoulder in the approved image: where the hero sees it, how wide the lift is, how many times brighter. */
const OVAL = { at: [-0.0898, 0.0827], wide: 0.02, gain: 1.6 }

export const backdrop: SeasonKit['backdrop'] = {
  colors: [rose, blush, rose, blush, rose, salmon, blush, salmon, rose, salmon, peach, salmon, peach, salmon, pearl, peach, green, pearl, peach, pearl],
  // Slate blue, not purple: the approved field is blue-black (12, 13, 16 to 33, 37, 48 of 255 from the corners to the top middle).
  room: [0.0068, 0.0082, 0.0114],
  floor: [0.0064, 0.007, 0.0092],
  // By place: the approved image has its lights massed to the right of the globe, a warm peach cloud of them, and a sparser,
  // dimmer left with one large warm oval beside the globe's shoulder. The same levels stand left and right, so the right is
  // lifted (its dim discs become part of the mass, but not so far that its bright ones burn white) and the left is held back
  // a little, except the oval.
  gain: (at) => {
    const side = at[0] / Math.hypot(at[0], at[1], at[2])
    const t = Math.min(1, Math.abs(side) / 0.12)
    const s = t * t * (3 - 2 * t)
    const [x, y] = seen(at)
    const oval = Math.exp(-((x - OVAL.at[0]!) * (x - OVAL.at[0]!) + (y - OVAL.at[1]!) * (y - OVAL.at[1]!)) / (OVAL.wide * OVAL.wide))
    return (side > 0 ? 1 + 0.9 * s : 1 - 0.25 * s) * (1 + OVAL.gain * oval)
  },
}
