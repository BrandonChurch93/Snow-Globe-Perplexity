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
  flake: { shape: SHAPE.cluster, size: 0.74, body: 1, flash: 0, real: true },
  glitter: { shape: SHAPE.mirror, size: 1.15, body: 0.3, flash: 5.5, real: true },
}

const PLAIN: KindLook = { shape: SHAPE.soft, size: 1, body: 1, flash: 0, real: false }

export const lookOf = (kind: string): KindLook => LOOKS[kind] ?? PLAIN

export const LENS_LOOK = {
  nearGain: 8,
  farGain: 0.12,
  maxBlurPx: 26,
  farShrink: 0.36,
  maxStreakPx: 110,
  sampleSpanSteps: 0.25,
  stormSpanSteps: 9,
  stormFrom: 0.3,
  stormTo: 0.62,
  referenceHeightPx: 1080,
}

export const FLOW_LOOK = {
  nodes: 20,
  most: 30000,
  minWeight: 1.5,
  ownShare: 1,
}

export const LIGHT_LOOK = {
  wrap: 0.55,
  grid: 1.15,
  veilShare: 0.4,
  lampFlash: 9,
}

export const LYING_LOOK = {
  flat: 0.3,
  lobe: 0.72,
  mergeFromMm: 0.3,
  mergeToMm: 2.2,
  mergeSpread: 0.7,
  glitterTilt: 0.7,
}

export const LOBE_CORE = 0.5
export const EDGE_LOW = 0.2
export const EDGE_HIGH = 0.55
export const PIXEL_SIGMA2 = 0.25
export const STREAK_HOLD = 0.5
export const GLITTER_STREAK = 0.22
export const GLINT_LOW = 0.9925
export const GLINT_HIGH = 0.9994
