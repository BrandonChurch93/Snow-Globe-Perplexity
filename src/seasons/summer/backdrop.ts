import type { SeasonKit } from '../kit'

// The lights behind the globe: amber and gold, the dim ones deep orange, the brightest a pale warm white. The list runs from
// the dimmest level to the brightest (`DISCS.colourByLevel` in `src/scene/backdrop.ts`).
const ember: [number, number, number] = [1, 0.46, 0.15]
const amber: [number, number, number] = [1, 0.6, 0.25]
const gold: [number, number, number] = [1, 0.72, 0.36]
const pale: [number, number, number] = [1, 0.8, 0.5]
const cream: [number, number, number] = [1, 0.88, 0.68]

export const backdrop: SeasonKit['backdrop'] = { colors: [ember, amber, ember, amber, gold, amber, gold, pale, cream, pale], room: [0.0034, 0.0058, 0.0062], floor: [0.005, 0.0078, 0.0095] }
