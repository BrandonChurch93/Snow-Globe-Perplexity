import type { SeasonKit } from '../kit'

// The lights behind: soft pink and pearl. The list runs from the dimmest discs to the brightest (the stage picks by a disc's
// level): the dim ones are rose, the middle ones salmon, the bright ones peach and pearl, with one pale green slot among them, as in
// `references/approved/spring-rest.png` (disc colours there, in linear light: 1, 0.45 to 0.66, 0.42 to 0.65).
const G = 1.5
const rose: [number, number, number] = [G, 0.4 * G, 0.5 * G]
const blush: [number, number, number] = [G, 0.48 * G, 0.56 * G]
const salmon: [number, number, number] = [G, 0.5 * G, 0.44 * G]
const peach: [number, number, number] = [G, 0.6 * G, 0.46 * G]
const pearl: [number, number, number] = [G, 0.72 * G, 0.62 * G]
const green: [number, number, number] = [0.6, 0.85, 0.58]

export const backdrop: SeasonKit['backdrop'] = {
  colors: [rose, blush, rose, blush, rose, salmon, blush, salmon, rose, salmon, peach, salmon, peach, salmon, pearl, peach, green, pearl, peach, pearl],
  room: [0.0082, 0.0086, 0.0104],
  floor: [0.006, 0.0068, 0.0085],
}
