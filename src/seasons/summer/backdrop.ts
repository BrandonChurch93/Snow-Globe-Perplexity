import type { SeasonKit } from '../kit'

// The lights behind the globe: cream, honey, gold and a little amber, none of them a saturated orange. The list runs from the
// dimmest level to the brightest (`DISCS.colourByLevel` in `src/scene/backdrop.ts`). Each colour carries its light's strength
// too: the shared layout places its lights where winter's picture has them and makes a few of them many times brighter than the
// rest, so here the low levels are lifted and the high ones held down until the lights of one part of the room are near one
// another in brightness. Where they are bright is then the field's alone (`CLUSTER`): a dense cluster high on the right, bright
// enough that the film takes it to cream white and its haze fills the dark between the discs, a warm soft column on the left,
// and next to nothing round the globe, where a half-lit soft disc reads as a brown stain.
const tone = (lift: number, r: number, g: number, b: number): [number, number, number] => [r * lift, g * lift, b * lift]
const cream = (lift: number) => tone(lift, 1, 0.72, 0.47)
const honey = (lift: number) => tone(lift, 1, 0.61, 0.34)
const gold = (lift: number) => tone(lift, 1, 0.57, 0.3)
const amber = (lift: number) => tone(lift, 1, 0.5, 0.24)

// Where a light stands in the approved picture (pixels of its 2816 x 1584 frame), from the view the shared layout was placed in
// (`PLACED.view` in `src/scene/backdrop.ts`).
const VIEW = { widthPx: 2816, heightPx: 1584, fovDeg: 16, distanceMm: 615.3, pitchDeg: 4.5, aimHeightMm: 64 }
const TILT = (VIEW.pitchDeg * Math.PI) / 180
const FOCAL = VIEW.heightPx / 2 / Math.tan((VIEW.fovDeg * Math.PI) / 360)
const EYE = [0, VIEW.aimHeightMm + Math.sin(TILT) * VIEW.distanceMm, Math.cos(TILT) * VIEW.distanceMm] as const
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Where the lights burn, as one smooth field over the approved frame: `floor` everywhere, `near` of that beside the globe
 * (`nearPx`), `column` more in the column on the left (`columnPx`, fading out at its top over `columnTopPx`), and right of
 * `fromPx` both `lift` more above `topPx` and `spill` more down to `spillPx`. `pools` are the places where one light burns
 * brighter than its neighbours: where, and how much more, each reaching `reachPx`, short of the next light.
 */
export const CLUSTER = {
  floor: 0.07,
  near: 0.2,
  nearPx: [700, 900, 1900, 2100] as const,
  column: 0.5,
  columnPx: [120, 260, 640, 800] as const,
  columnTopPx: [60, 200] as const,
  lift: 4.7,
  fromPx: [1930, 2230] as const,
  topPx: [250, 350] as const,
  spill: 0.8,
  spillPx: [520, 620] as const,
  reachPx: 55,
  pools: [
    [2098, 180, 26],
    [2045, 108, 20],
    [2270, 70, 6],
    [2275, 212, 9.5],
    [2238, 275, 2],
    [2604, 108, 9],
    [2788, 148, 11],
    [2000, 30, 0.6],
    [2020, 365, 1.2],
    [2330, 455, 4.5],
    [2560, 665, 6],
    [285, 605, 7.5],
    [700, 610, 5.5],
    [285, 790, 4.5],
  ] as const,
}

function gain(at: readonly [number, number, number]): number {
  const dx = at[0] - EYE[0]
  const dy = at[1] - EYE[1]
  const dz = at[2] - EYE[2]
  const depth = Math.max(1, -dy * Math.sin(TILT) - dz * Math.cos(TILT))
  const u = VIEW.widthPx / 2 + (FOCAL * dx) / depth
  const v = VIEW.heightPx / 2 - (FOCAL * (dy * Math.cos(TILT) - dz * Math.sin(TILT))) / depth
  const C = CLUSTER
  const near = smooth(C.nearPx[0], C.nearPx[1], u) * (1 - smooth(C.nearPx[2], C.nearPx[3], u))
  const column = smooth(C.columnPx[0], C.columnPx[1], u) * (1 - smooth(C.columnPx[2], C.columnPx[3], u)) * smooth(C.columnTopPx[0], C.columnTopPx[1], v)
  const high = 1 - smooth(C.topPx[0], C.topPx[1], v)
  const spill = 1 - smooth(C.spillPx[0], C.spillPx[1], v)
  let sum = C.floor * (1 - (1 - C.near) * near) + C.column * column + smooth(C.fromPx[0], C.fromPx[1], u) * (C.lift * high + C.spill * spill)
  for (const [pu, pv, more] of C.pools) sum += more * (1 - smooth(0, C.reachPx, Math.hypot(u - pu, v - pv)))
  return sum
}

export const backdrop: SeasonKit['backdrop'] = {
  colors: [honey(3), gold(2), gold(1.8), gold(1.6), gold(1.3), gold(1.1), cream(0.9), honey(3.5), gold(0.7), amber(0.15)],
  room: [0.002, 0.0033, 0.0036],
  floor: [0.0024, 0.0042, 0.0046],
  gain,
}
