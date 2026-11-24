import type { SeasonKit } from '../kit'

const teal: [number, number, number] = [0.2, 0.62, 1]
const blue: [number, number, number] = [0.42, 0.68, 1]
const white: [number, number, number] = [0.78, 0.88, 1]
const amber: [number, number, number] = [1, 0.7, 0.4]

export const backdrop: SeasonKit['backdrop'] = { colors: [teal, teal, teal, blue, blue, white, white, amber], room: [0.002, 0.0054, 0.0085], floor: [0.0092, 0.0113, 0.019] }
