import type { SeasonKit } from '../kit'

// The lights behind: soft pink and pearl. The list runs from the dimmest discs to the brightest (the stage picks by a disc's
// level): the dim ones are rose, the middle ones salmon, the bright ones peach and pearl, with one pale green slot among them, as in
// `references/approved/spring-rest.png` (disc colours there, in linear light: 1, 0.45 to 0.66, 0.42 to 0.65).
const G = 1.7
const rose: [number, number, number] = [G, 0.42 * G, 0.44 * G]
const blush: [number, number, number] = [G, 0.5 * G, 0.48 * G]
const salmon: [number, number, number] = [G, 0.52 * G, 0.4 * G]
const peach: [number, number, number] = [G, 0.62 * G, 0.42 * G]
const pearl: [number, number, number] = [G, 0.74 * G, 0.56 * G]
const green: [number, number, number] = [0.6, 0.85, 0.58]

export const backdrop: SeasonKit['backdrop'] = {
  colors: [rose, blush, rose, blush, rose, salmon, blush, salmon, rose, salmon, peach, salmon, peach, salmon, pearl, peach, green, pearl, peach, pearl],
  room: [0.0088, 0.0084, 0.0098],
  floor: [0.0082, 0.007, 0.0076],
  // By place: the approved image has its lights massed to the right of the globe, a warm peach cloud of them, and a sparser,
  // dimmer left. The same levels stand left and right, so the right is lifted (its dim discs become part of the mass) and the
  // left is held back a little.
  gain: (at) => {
    const side = at[0] / Math.hypot(at[0], at[1], at[2])
    const t = Math.min(1, Math.abs(side) / 0.12)
    const s = t * t * (3 - 2 * t)
    return side > 0 ? 1 + 1.1 * s : 1 - 0.25 * s
  },
}
