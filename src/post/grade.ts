import * as THREE from 'three'

export const grade = {
  exposure: 1,

  curveGain: 2.51,
  curveToe: 0.03,
  curveShoulder: 2.43,
  curveMid: 0.59,
  curveBlack: 0.14,

  colourHold: 0.7,
  colourHoldFrom: 0.1,
  colourHoldFull: 0.6,
  whiteFrom: 3,
  whiteFull: 12,

  lift: [0, 0.0003, 0.0009] as [number, number, number],
  gamma: [1, 1, 1] as [number, number, number],
  gain: [0.985, 1, 1.02] as [number, number, number],
  saturation: 1.04,
  shadowTint: [0.9, 0.98, 1.06] as [number, number, number],
  shadowTintTo: 0.06,

  glowRows: 540,
  glowThreshold: 0.9,
  glowKnee: 0.5,
  glowCeiling: 24,
  glowStrength: 0.11,
  glowSizes: [0.55, 1, 0.8, 0.55, 0.35, 0.2] as number[],
  glowTint: 6,

  grainDark: 0.34,
  grainMid: 0.6,
  grainBright: 0.3,
  grainMidAt: 0.3,
  grainSizePx: 1.25,
  grainChroma: 0.35,

  fringePx: 0.7,
  fringePower: 1.5,

  cornerDark: 0.2,
  cornerPower: 1.4,

  ditherLsb: 0.75,
}

export type Grade = typeof grade

export const lensState = {
  bloomTint: new THREE.Color(0, 0, 0),
  /** How much of the widest level of the glow is added over the whole picture: the glare of a change between two seasons, 0 at every other time. */
  glare: 0,
}
