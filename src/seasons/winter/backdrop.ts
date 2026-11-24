import type { SeasonKit } from '../kit'

const teal: [number, number, number] = [0.2, 0.62, 1]
const blue: [number, number, number] = [0.42, 0.68, 1]
const pale: [number, number, number] = [0.5, 0.8, 1]
const white: [number, number, number] = [0.82, 0.9, 1]
const amber: [number, number, number] = [1, 0.6, 0.25]
const warm: [number, number, number] = [1, 0.84, 0.7]

export const backdrop: SeasonKit['backdrop'] = { colors: [teal, amber, teal, blue, teal, blue, pale, warm, white, amber], room: [0.0034, 0.006, 0.0092], floor: [0.0092, 0.0113, 0.019] }
