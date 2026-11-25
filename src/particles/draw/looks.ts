export const MAX_KINDS = 16
export const LOBES = 5
export const LAMPS = 6
export const LOBE_TABLE = 'shared/flake-lobes.lin.png'
export const TABLE_COLUMNS = 8

export const SHAPE = { soft: 0, cluster: 1, mirror: 2, petal: 3, fleck: 4, leaf: 5, seed: 6, light: 7, spark: 8, bat: 9 } as const

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
  petal: { shape: SHAPE.petal, size: 1, body: 0.96, flash: 0.75, real: true },
  mote: { shape: SHAPE.fleck, size: 1.2, body: 0.8, flash: 1, real: true },
  leaf: { shape: SHAPE.leaf, size: 1.35, body: 1, flash: 0.5, real: true },
  seed: { shape: SHAPE.seed, size: 3.6, body: 0.9, flash: 0, real: true },
  firefly: { shape: SHAPE.light, size: 1, body: 1, flash: 0, real: true },
  ember: { shape: SHAPE.spark, size: 1.5, body: 1, flash: 0, real: true },
  bat: { shape: SHAPE.bat, size: 1.15, body: 1, flash: 0, real: true },
}

const PLAIN: KindLook = { shape: SHAPE.soft, size: 1, body: 1, flash: 0, real: false }

export const lookOf = (kind: string): KindLook => LOOKS[kind] ?? PLAIN

export const LENS_LOOK = {
  nearGain: 2.6,
  farGain: 0.5,
  glassDiscPx: 6,
  glassDiscCover: 0.62,
  glassDiscWarm: [1.3, 0.92, 0.62] as const,
  glassDiscWarmShare: 0.5,
  glassDiscLow: 0.45,
  glassDiscHigh: 1.25,
  glassFrom: 0.8,
  glassShare: 0.45,
  maxBlurPx: 60,
  liftMostMm: 1.5,
  farShrink: 0.36,
  farDim: 0.3,
  farDimFrom: -0.7,
  farDimTo: 0.3,
  maxStreakPx: 160,
  stormFrom: 0.03,
  stormTo: 0.3,
  referenceHeightPx: 1080,
}

export const LIGHT_LOOK = {
  wrap: 0.55,
  grid: 3.3,
  veilShare: 0.7,
  lampFlash: 9,
  keyFloor: 2.3,
  keySide: 5.4,
  cardShare: 2.72,
  skyTilt: 0.25,
}

export const LYING_LOOK = {
  flat: 0.22,
  size: 0.32,
  alpha: 0.4,
  shade: 0.5,
  lobe: 0.72,
  mergeFromMm: 0.3,
  mergeToMm: 2.2,
  mergeSpread: 0.4,
  glitterTilt: 0.7,
}

export const LOBE_CORE = 0.5
export const LOBE_REACH = { low: 0.7, high: 1.25 }
export const LOBE_GIRTH = { low: 0.75, high: 1.3 }
export const EDGE_SOFT_LOW = 0.03
export const EDGE_SOFT_HIGH = 2.3
export const EDGE_CRISP_LOW = 0.1
export const EDGE_CRISP_HIGH = 1.5
export const PIXEL_SIGMA2 = 0.18
export const STREAK_HOLD = 0.7
export const STREAK_CAPSULE = 0.8
export const STREAK_TAPER = 0.75
export const STREAK_REACH = 1.05
export const BLUR_HOLD = 0.5
export const BLUR_STRICT_FROM_PX = 5
export const BLUR_STRICT_TO_PX = 24
export const SIZE_LOW = 0.32
export const SIZE_HIGH = 3
export const SIZE_SKEW = 7
export const THIN_LOW = 0.24
export const THIN_FROM = 0.3
export const THIN_TO = 0.7
export const STRETCH_LOW = 0.1
export const STRETCH_HIGH = 0.7
export const STORM_SMEAR_SHARE = 0.36
export const STORM_SHARP_SHARE = 0.13
export const STORM_SHARP_REACH = 0.85
export const STORM_DAB_LIGHT = 1.35
export const STORM_FINE_SHARE = 0.18
export const STORM_SMEAR = 0.44
export const STORM_OFF_DISC = 0.75
export const STORM_CROSS = { keep: 1, from: 0.8, to: 0.97, fromPx: 1.5, toPx: 4 }
export const STORM_SIDE = 0.9
export const STORM_WALL = { dim: 0.8, from: 0.3, to: 0.85 }
export const STORM_SHUTTER = 0.8
export const STORM_ALIGN = 0.7
export const STORM_TOP = { keep: 0.22, from: 0.15, to: 0.7 }
export const STORM_SLOW = { keep: 0.35, fromPx: 2, toPx: 9 }
export const STORM_SMEAR_FAINT = 0.1
export const STORM_SMEAR_BRIGHT = 9
export const STORM_SMEAR_SKEW = 4.5
export const STORM_DAB_TIGHT = 0.35
export const STORM_DAB_REACH = { low: 0.5, high: 2, skew: 1.8 }
export const STORM_DAB_SLOW = 0.12
export const STORM_VEILED = 0.5
export const STORM_WINDOW = { x: -11, y: -12, wide: 20, high: 18, from: 0.75, to: 1.5, floor: 0.03, small: 0.5, back: -20, front: 0 }
export const STORM_PACE = { fromPx: 0.5, toPx: 2, unseen: 0.1 }
export const STORM_SHARP = 0.9
export const STORM_FINE_HIGH = 0.45
export const STORM_FINE_SOFT = 0.5
export const STORM_FINE_LOW = 0.1
export const STORM_THIN = 0.04
export const STORM_STREAK_DIM = 0.85
export const STORM_FAR = 1
export const STORM_SMEAR_FAR = 0.45
export const STORM_SMEAR_NEAR = 1.25
export const SETTLE_SHOWN = 0.13
export const SETTLE_FADE = 0.08
export const STORM_SMEAR_LOW_PX = 1.4
export const STORM_SMEAR_HIGH_PX = 5.5
export const STORM_SOFT_TOP = 5.5
export const STORM_MOST_PX = 1.5
export const STORM_GLITTER_PX = 0.5
export const STORM_GLITTER = 0.9
export const STORM_GLITTER_FROM = 0.25
export const STORM_GLITTER_TO = 1.6
export const STORM_GOLD = [1, 0.84, 0.58] as const
export const STORM_FLASH = 1.6
export const STORM_GLINT = 0.05
export const STORM_GLINT_REACH = { low: 0.3, high: 0.95 }
export const STORM_GLINT_KEEP = 0.4
export const REST_CLEAR = { from: 0.72, to: 0.92, near: 0.3, size: 1.6, mostPx: 3.1 }
export const STORM_FLOOD = { fogPerMm: 0.022, gain: 1.4 }
/** The storm's flecks near the lamp take its colour at their own brightness: the warm light spreads through the storm and the field gets no brighter. */
export const STORM_GLOW = { to: [1.529, 0.894, 0.501] as const, most: 0.8, reachMm: 30 }
/** The few very large near ones: a small share of the soft dabs, near the eye, far out of focus and bright enough to be seen. */
export const STORM_BIG = { share: 0.008, from: 0.3, to: 0.75, blur: 2.4, gain: 3, bright: 0.3 }
export const STORM_WARM = 0.4
export const STORM_PALE = 0.6
export const STORM_PALE_TO = [0.93, 1.05, 1.045] as const
export const STORM_BEND = { low: 0, high: 0.3, against: 0.3 }
export const FLASH_WHITE = 0.7
export const FLASH_MOST = 2
export const LIT_MOST = 2
export const GLINT_SOFT_PX = 0.7
export const CLUMP = { floor: 0.06, gain: 1.2, most: 1.6, core: 0.5 }
export const GLINT_LOW = 0.9925
export const GLINT_HIGH = 0.9994

/** The kinds drawn as cards (shapes from 3 on): a thin curved sheet with its own outline, turned by the particle's turn. For these `flash` is the share of light let through from behind. */
export const CARD = {
  thick: 0.1,
  petalThick: 0.3,
  bound: 1.12,
  area: 1.3,
  hold: 0.6,
  lieTilt: 0.22,
  lieShade: 1,
  lieFlat: 0.45,
  petalRock: 1.1,
  fleckRock: 2.6,
  leafRock: 0.55,
  stormRock: 2.8,
  yawSway: 0.6,
  /** Of the ones that settle and stay down, the share drawn whole, in the storm and lying; the rest are the storm's small dabs and are gone once they are down. */
  chosen: [0.004, 0.012] as const,
  dabSize: 0.36,
  /** The size of a whole petal and of a whole leaf in the storm, as a share of its size at rest. */
  stormSize: [0.45, 0.6] as const,
  /** Of the rest, the share that is a solid small dab in the storm, and how much the others and they are seen. */
  dabShare: [0.2, 0.3, 0.6] as const,
  dabKeep: [0, 1] as const,
  /** How much of a moving card is drawn sharp at the head of its path; the rest is its trail through the shutter. */
  head: 0.85,
  fleckKeep: [0.01, 0.5] as const,
  fleckSkew: 8,
  fleckStorm: 3,
  /** How much of the veil lies over a card in the air, and over a bat. */
  fog: 0.3,
  batFog: 0.08,
  petalCup: [0.2, 0.42] as const,
  leafCurl: [0.34, 0.5, 0.3] as const,
  seedRock: 0.35,
  seedTilt: 1.2,
  litMost: 1.25,
  sparkKeep: [0.08, 1] as const,
  sparkSkew: 2.5,
  batFlap: 0.45,
  batBank: 0.3,
  /** How far a bat leans its head the way it is going across the picture. */
  batLean: 0.5,
  /** How much lighter a bat's edge is than its body, so that its outline holds on dark air. */
  batRim: 1.5,
  /** A light's core, its glow and its wide glow, as radii in the particle's radius and as shares of its light. */
  glow: { core: 0.34, halo: 1.5, wide: 4.5, haloShare: 0.1, wideShare: 0.01, hide: 0.6, blinkLow: 0.04 },
  spark: { gain: 1.1, core: 0.42, halo: 1.5, haloShare: 0.05, tail: 1.6, hotCore: 0.3, hot: [1, 0.8, 0.5] as const, dying: [0.85, 0.17, 0.03] as const },
  hair: { runHead: 0.5, runTrail: 0.6, runWide: 0.04, runLeast: 1.2, runSeen: 1.6, runStretch: 2, runKeep: 0.2, wide: 0.011, seen: 1.25, reach: 1.7, foot: 1.5, stem: 0.022, body: 0.06, hub: 0.3, ringA: [15, 1.45, 1] as const, ringB: [10, 0.8, 0.9] as const, ringC: [9, 2.1, 0.8] as const },
}
