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
  flake: { shape: SHAPE.cluster, size: 0.95, body: 0.95, flash: 0, real: true },
  glitter: { shape: SHAPE.mirror, size: 1.15, body: 0.3, flash: 5.5, real: true },
}

const PLAIN: KindLook = { shape: SHAPE.soft, size: 1, body: 1, flash: 0, real: false }

export const lookOf = (kind: string): KindLook => LOOKS[kind] ?? PLAIN

export const LENS_LOOK = {
  nearGain: 2,
  farGain: 0.5,
  glassDiscPx: 9,
  glassFrom: 0.78,
  maxBlurPx: 60,
  farShrink: 0.36,
  maxStreakPx: 160,
  stormFrom: 0.03,
  stormTo: 0.3,
  referenceHeightPx: 1080,
}

export const LIGHT_LOOK = {
  wrap: 0.55,
  grid: 2.3,
  veilShare: 0.7,
  lampFlash: 9,
  keyFloor: 1.9,
  keySide: 4.5,
  cardShare: 2.5,
  skyTilt: 0.25,
}

export const LYING_LOOK = {
  flat: 0.22,
  size: 0.45,
  shade: 0.55,
  lobe: 0.72,
  mergeFromMm: 0.3,
  mergeToMm: 2.2,
  mergeSpread: 0.4,
  glitterTilt: 0.7,
}

export const LOBE_CORE = 0.5
export const EDGE_LOW = 0.06
export const EDGE_HIGH = 1.25
export const EDGE_DISC = 0.5
export const PIXEL_SIGMA2 = 0.5
export const STREAK_HOLD = 0.7
export const STREAK_CAPSULE = 0.8
export const STREAK_TAPER = 0.75
export const STREAK_REACH = 1.05
export const BLUR_HOLD = 0.62
export const BLUR_STRICT_FROM_PX = 5
export const BLUR_STRICT_TO_PX = 24
export const SIZE_LOW = 0.3
export const SIZE_HIGH = 1.7
export const SIZE_SKEW = 2
export const STRETCH_LOW = 0.1
export const STRETCH_HIGH = 1.5
export const STORM_SMEAR_SHARE = 0.012
export const STORM_SHARP_SHARE = 0.008
export const STORM_FINE_SHARE = 0.06
export const STORM_SMEAR = 0.75
export const STORM_SHARP = 0.9
export const STORM_FINE_HIGH = 0.5
export const STORM_FINE_LOW = 0.1
export const STORM_THIN = 0.1
export const STORM_SMEAR_LOW_PX = 1.2
export const STORM_SMEAR_HIGH_PX = 4.6
export const STORM_SOFT_TOP = 4.5
export const STORM_MOST_PX = 0.5
export const STORM_GLITTER_PX = 0.5
export const STORM_GLITTER = 0.9
export const STORM_GLITTER_FROM = 0.6
export const STORM_GLITTER_TO = 2.2
export const STORM_FLASH = 1.6
export const STORM_GLINT = 0.012
export const FLASH_WHITE = 0.7
export const CLUMP = { floor: 0.15, gain: 1.2, most: 1.6, core: 0.5 }
export const GLINT_LOW = 0.9925
export const GLINT_HIGH = 0.9994
