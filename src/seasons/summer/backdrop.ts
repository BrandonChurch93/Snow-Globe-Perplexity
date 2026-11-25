import type { SeasonKit } from '../kit'

// The lights behind the globe: amber and gold, the dim ones deep orange, the brightest a pale warm white. The list runs from
// the dimmest level to the brightest (`DISCS.colourByLevel` in `src/scene/backdrop.ts`).
// Each colour carries its light's strength too: the dim far lamps stay embers, the near ones burn like the last hour of sun.
const tone = (lift: number, r: number, g: number, b: number): [number, number, number] => [r * lift, g * lift, b * lift]
const ember = tone(0.9, 1, 0.46, 0.15)
const amber = tone(1.1, 1, 0.6, 0.25)
const gold = tone(1.5, 1, 0.72, 0.36)
const pale = tone(2, 1, 0.8, 0.5)
const cream = tone(2.4, 1, 0.88, 0.68)

export const backdrop: SeasonKit['backdrop'] = { colors: [ember, amber, ember, amber, gold, amber, gold, pale, cream, pale], room: [0.003, 0.0048, 0.0052], floor: [0.0036, 0.0056, 0.0072] }
