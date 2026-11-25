import type { SeasonKit } from '../kit'

// The lights behind: orange and amber, a few of the dimmest a dark teal, the brightest at about six tenths of winter's energy. The list
// runs from the dimmest discs to the brightest (`DISCS.colourByLevel` in `src/scene/backdrop.ts`).
const teal: [number, number, number] = [0.1, 0.2, 0.22]
const slate: [number, number, number] = [0.14, 0.2, 0.2]
const rust: [number, number, number] = [0.8, 0.27, 0.07]
const orange: [number, number, number] = [0.9, 0.34, 0.09]
const amber: [number, number, number] = [0.65, 0.28, 0.08]
const warm: [number, number, number] = [0.85, 0.37, 0.1]
const gold: [number, number, number] = [0.68, 0.33, 0.11]

export const backdrop: SeasonKit['backdrop'] = { colors: [teal, slate, rust, teal, orange, orange, warm, amber, gold, amber], room: [0.0026, 0.0036, 0.0046], floor: [0.0065, 0.0048, 0.0063] }
