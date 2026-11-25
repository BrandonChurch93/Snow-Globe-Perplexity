import type { SeasonKit } from '../kit'

// The lights behind the globe: amber and gold, the dim ones deep orange, the brightest a pale warm white. The list runs from
// the dimmest level to the brightest (`DISCS.colourByLevel` in `src/scene/backdrop.ts`).
// Each colour carries its light's strength too. The two lights the shared layout makes brightest (the last two levels) stand low
// on the right, where summer's picture is dark, so their colours are held down; the pale middle levels carry the cream cluster.
const tone = (lift: number, r: number, g: number, b: number): [number, number, number] => [r * lift, g * lift, b * lift]
const ember = tone(1, 1, 0.36, 0.1)
const amber = tone(1.2, 1, 0.46, 0.16)
const gold = tone(1.6, 1, 0.55, 0.24)
const peach = tone(1.3, 1, 0.6, 0.3)
const cream = tone(1.1, 1, 0.72, 0.46)
// The dimmest lights are held far down: in the approved picture the left side is a few clear amber discs on blue-black, and a
// crowd of half-lit ones there reads as brown haze.
const dim = (c: [number, number, number]): [number, number, number] => [c[0] * 0.4, c[1] * 0.4, c[2] * 0.4]
const low = tone(0.15, 1, 0.66, 0.38)
const lowest = tone(0.25, 1, 0.72, 0.46)

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

/** The cluster: the lights high on the right burn several times brighter than they are placed. One smooth field over the room. */
export const CLUSTER = { lift: 8, fromPx: [1500, 2000] as const, topPx: [210, 430] as const, left: 0.7, leftPx: [900, 1900] as const }

function gain(at: readonly [number, number, number]): number {
  const dx = at[0] - EYE[0]
  const dy = at[1] - EYE[1]
  const dz = at[2] - EYE[2]
  const depth = Math.max(1, -dy * Math.sin(TILT) - dz * Math.cos(TILT))
  const u = VIEW.widthPx / 2 + (FOCAL * dx) / depth
  const v = VIEW.heightPx / 2 - (FOCAL * (dy * Math.cos(TILT) - dz * Math.sin(TILT))) / depth
  const side = CLUSTER.left + (1 - CLUSTER.left) * smooth(CLUSTER.leftPx[0], CLUSTER.leftPx[1], u)
  const high = 1 - smooth(CLUSTER.topPx[0], CLUSTER.topPx[1], v)
  return side * (1 + CLUSTER.lift * high * smooth(CLUSTER.fromPx[0], CLUSTER.fromPx[1], u))
}

export const backdrop: SeasonKit['backdrop'] = {
  colors: [dim(gold), dim(ember), dim(amber), dim(peach), gold, amber, cream, gold, low, lowest],
  room: [0.0028, 0.0038, 0.0058],
  floor: [0.0032, 0.0048, 0.0076],
  gain,
}
