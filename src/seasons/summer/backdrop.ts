import type { SeasonKit } from '../kit'

// The lights behind the globe: gold and amber, the brightest a pale warm white. The list runs from the dimmest level to the
// brightest (`DISCS.colourByLevel` in `src/scene/backdrop.ts`). Each colour carries its light's strength too: the shared layout
// places its lights where winter's picture has them and makes a few of them many times brighter than the rest, so here the low
// levels are lifted and the high ones held down until the lights of one part of the room are near one another in brightness.
// Where they are bright is then the field's alone (`CLUSTER`): a dense cream cluster high on the right, a column of clear amber
// discs on the left, and next to nothing round the globe, where a half-lit soft disc reads as a brown stain.
const tone = (lift: number, r: number, g: number, b: number): [number, number, number] => [r * lift, g * lift, b * lift]
const gold = (lift: number) => tone(lift, 1, 0.62, 0.3)
const amber = (lift: number) => tone(lift, 1, 0.52, 0.2)
const peach = (lift: number) => tone(lift, 1, 0.64, 0.34)
const cream = (lift: number) => tone(lift, 1, 0.74, 0.48)

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
 * (`nearPx`), `column` more in the column on the left (`columnPx`), `lift` more in the cluster high on the right (`fromPx`,
 * `topPx`).
 */
export const CLUSTER = {
  floor: 0.22,
  near: 0.2,
  nearPx: [700, 900, 1900, 2100] as const,
  column: 1.6,
  columnPx: [120, 260, 640, 800] as const,
  lift: 6.5,
  fromPx: [1850, 2100] as const,
  topPx: [340, 660] as const,
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
  const column = smooth(C.columnPx[0], C.columnPx[1], u) * (1 - smooth(C.columnPx[2], C.columnPx[3], u))
  const high = 1 - smooth(C.topPx[0], C.topPx[1], v)
  return C.floor * (1 - (1 - C.near) * near) + C.column * column + C.lift * high * smooth(C.fromPx[0], C.fromPx[1], u)
}

export const backdrop: SeasonKit['backdrop'] = {
  colors: [gold(3), amber(2), gold(1.8), peach(1.6), peach(1.3), gold(1.1), cream(0.9), amber(3.5), cream(0.7), cream(0.15)],
  room: [0.002, 0.0033, 0.0036],
  floor: [0.0024, 0.0042, 0.0046],
  gain,
}
