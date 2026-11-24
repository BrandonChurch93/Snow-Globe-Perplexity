export const MAX_KINDS = 16
export const LOBES = 5
export const LAMPS = 6
export const LOBE_TABLE = 'shared/flake-lobes.lin.png'
export const TABLE_COLUMNS = 8

export const SHAPE = { soft: 0, cluster: 1, mirror: 2 } as const

export interface KindLook {
  shape: number
  size: number
  body: number
  flash: number
  real: boolean
}

const LOOKS: Record<string, KindLook> = {
  flake: { shape: SHAPE.cluster, size: 0.8, body: 0.85, flash: 0, real: true },
  glitter: { shape: SHAPE.mirror, size: 1.15, body: 0.3, flash: 5.5, real: true },
}

const PLAIN: KindLook = { shape: SHAPE.soft, size: 1, body: 1, flash: 0, real: false }

export const lookOf = (kind: string): KindLook => LOOKS[kind] ?? PLAIN

export const LENS_LOOK = {
  nearGain: 4,
  farGain: 0.12,
  maxBlurPx: 60,
  farShrink: 0.36,
  maxStreakPx: 110,
  sampleSpanSteps: 0.25,
  stormSpanSteps: 22,
  stormFrom: 0.3,
  stormTo: 0.62,
  referenceHeightPx: 1080,
}

export const FLOW_LOOK = {
  nodes: 14,
  most: 30000,
  minWeight: 1.5,
  ownShare: 0.5,
}

export const LIGHT_LOOK = {
  wrap: 0.55,
  grid: 1.9,
  veilShare: 0.7,
  lampFlash: 9,
  keyFloor: 0.55,
  keySide: 1.7,
  skyTilt: 0.25,
}

export const LYING_LOOK = {
  flat: 0.22,
  size: 0.6,
  lobe: 0.72,
  mergeFromMm: 0.3,
  mergeToMm: 2.2,
  mergeSpread: 0.4,
  glitterTilt: 0.7,
}

export const LOBE_CORE = 0.5
export const EDGE_LOW = 0.03
export const EDGE_HIGH = 1.25
export const EDGE_DISC = 0.5
export const PIXEL_SIGMA2 = 0.5
export const STREAK_HOLD = 0.7
export const STREAK_TAPER = 0.6
export const STREAK_REACH = 1.5
export const BLUR_HOLD = 0.62
export const BLUR_STRICT_FROM_PX = 5
export const BLUR_STRICT_TO_PX = 24
export const SIZE_LOW = 0.22
export const SIZE_HIGH = 1.7
export const SIZE_SKEW = 1.8
export const STRETCH_LOW = 0.1
export const STRETCH_HIGH = 1.5
export const GLITTER_STREAK = 0.5
export const STORM_SOFT = 0.06
export const STORM_SHARP_SHARE = 0.14
export const GLINT_LOW = 0.9925
export const GLINT_HIGH = 0.9994
