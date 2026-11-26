export const MAX_KINDS = 16
export const LOBES = 5
export const LAMPS = 6
export const LOBE_TABLE = 'shared/flake-lobes.lin.png'

/** The most bats a picture hides the air behind. */
export const BATS = 4
export const SHAPE = { cluster: 1, mirror: 2, petal: 3, fleck: 4, leaf: 5, seed: 6, light: 7, spark: 8, bat: 9 } as const

export interface KindLook {
  shape: number
  size: number
  body: number
  flash: number
}

const LOOKS: Record<string, KindLook> = {
  flake: { shape: SHAPE.cluster, size: 0.95, body: 0.95, flash: 0 },
  glitter: { shape: SHAPE.mirror, size: 1.15, body: 0.3, flash: 5.5 },
  petal: { shape: SHAPE.petal, size: 1.25, body: 0.9, flash: 0.75 },
  mote: { shape: SHAPE.fleck, size: 1.2, body: 0.8, flash: 1 },
  leaf: { shape: SHAPE.leaf, size: 1.6, body: 1, flash: 0.35 },
  seed: { shape: SHAPE.seed, size: 4.2, body: 0.9, flash: 0 },
  firefly: { shape: SHAPE.light, size: 0.42, body: 1, flash: 0 },
  ember: { shape: SHAPE.spark, size: 1.35, body: 1, flash: 0 },
  bat: { shape: SHAPE.bat, size: 2.3, body: 1, flash: 0 },
}

export const lookOf = (kind: string): KindLook => {
  const look = LOOKS[kind]
  if (!look) throw new Error(`no look for the particle kind ${kind}`)
  return look
}

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
/** The arc of a path in the storm: the least radius about the roll's axis that a path is bent by, and the most the ends of a trail leave the straight line through its middle, as a share of half its length. */
export const STREAK_ARC = { leastMm: 5, most: 0.45 }
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
/** In the storm the sharp share is softened by its motion too: its share of the smear's blur, and how much of it is seen, so that its stroke is a soft one and no brighter for it. */
export const STORM_SHARP_SOFT = { soft: 0.4, seen: 0.5 }
export const STORM_DAB_LIGHT = 1.35
export const STORM_FINE_SHARE = 0.18
export const STORM_SMEAR = 0.44
export const STORM_OFF_DISC = 0.75
export const STORM_CROSS = { keep: 1, from: 0.8, to: 0.97, fromPx: 1.5, toPx: 4 }
export const STORM_SIDE = 0.9
export const STORM_WALL = { dim: 0.8, from: 0.3, to: 0.85 }
/** The share of the film's shutter for which a thing in the storm is seen: its stroke is this share of the path of one exposure, so that a piece is blurred by about its own size and stays one piece. */
export const STORM_SHUTTER = 0.3
/** The kinds that are drawn along their own path in the storm: the leaf, the seed, the light and the spark (shapes above this). The flake, the glitter, the petal and the mote are turned to the veil's current and seen for this share of the shutter, as the approved winter and spring are. */
export const STORM_OWN_PATH_FROM = 4.5
export const STORM_SHUTTER_TURNED = 0.8
export const STORM_ALIGN = 0.7
/** The whirl loosened in the storm: the least share of the turn to the current that a flake takes (each its own, up to the whole), the level the clumps of the dabs are evened toward and by how much, how much of a far dab is seen, and how long a far and a near stroke are beside the stroke of the middle. */
export const STORM_LOOSE = { alignLow: 0.25, even: 0.5, spread: 0.5, farSeen: 0.6, farLong: 0.65, nearLong: 1.35 }
export const STORM_TOP = { keep: 0.22, from: 0.15, to: 0.7 }
export const STORM_SLOW = { keep: 0.35, fromPx: 2, toPx: 9 }
export const STORM_SMEAR_FAINT = 0.1
export const STORM_SMEAR_BRIGHT = 9
export const STORM_SMEAR_SKEW = 4.5
export const STORM_DAB_TIGHT = 0.35
export const STORM_DAB_REACH = { low: 0.5, high: 2, skew: 1.8 }
export const STORM_DAB_SLOW = 0.12
export const STORM_VEILED = 0.5
/** After a landing the large soft dabs thin with the veil's pocket: the share of them taken off where the pocket is fully open, so that the cottage and the tree stand plain while the sharp flakes still go round in front of them. */
export const STORM_POCKET_SMEARS = 0.8
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
/** The flood of the swap: how fast a thing sinks into it with its depth behind the glass, its gain, and the ones just behind the front glass that stand in front of it: the depths (mm) they end between, how much of the flood is taken off them and how much more of them is seen. */
export const STORM_FLOOD = { fogPerMm: 0.022, gain: 1.4, frontMm: [6, 22] as const, frontClear: 0.8, frontGain: 1.5 }
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
/**
 * Where a few seeds lie when the liquid is calm: on the roof at its eaves, at the chimney's foot and in the seams of the
 * shingles, on bare wood of the tree, on the lawn and on the fence. Each is a place on the drawn thing itself (given by the
 * owners of the miniature and of the tree), in millimetres from the ball's centre, with the way out of the surface there and
 * the head's own radius. A head stands on its down, so its heart is `lift` of that radius off the surface. In the storm they
 * are gone with all the others (`until` of the storm's share; they fade over `fade`), and lie again when it has settled.
 */
export const SEED_RESTS = {
  until: 0.3,
  fade: [0.04, 0.25] as const,
  lift: 0.75,
  at: [
    [-26.11, -9.23, -10.41, -0.5, 0.82, 0.27, 1.2],
    [-23.31, -9.24, -5.11, -0.5, 0.82, 0.27, 0.93],
    [-20.56, -9.31, 0.23, -0.5, 0.82, 0.27, 1.35],
    [-18.63, -3.17, -10.43, -0.48, 0.83, 0.27, 1.43],
    [-21.57, -5.16, -11.58, -0.5, 0.82, 0.27, 0.99],
    [-19.14, -6.99, -2.79, -0.5, 0.82, 0.27, 1.05],
    [-18.88, -4.3, -8.59, -0.5, 0.82, 0.27, 0.87],
    [-19.21, -8.38, 0.07, -0.5, 0.82, 0.27, 0.9],
    [5.8, -0.2, -4.5, 0.14, 0.99, 0.05, 1.28],
    [18.4, -2.95, -1.9, -0.67, 0.74, -0.11, 1.05],
    [24.1, -3.52, -0.8, -0.07, 0.99, 0.09, 1.43],
    [-17.3, -19.62, 14.15, 0, 1, 0, 1.35],
    [25.75, -18.18, 7.2, 0, 1, 0, 1.5],
    [1.7, -18.96, 3.15, 0, 1, 0, 1.2],
    [-29.5, -19.99, 14.96, 0, 1, 0, 1.05],
    [-26, -20.95, 18.87, 0, 1, 0, 0.9],
    [-21.73, -21.99, 21.93, 0, 1, 0, 1.28],
    [-27.78, -19.55, 16.95, 0, 1, 0, 1.13],
  ] as const,
} as const

export const CARD = {
  thick: 0.1,
  petalThick: 0.42,
  /** A petal's deeper pink at its foot, and how far along the petal it has paled to the row's colour. */
  petalFoot: [0.92, 0.5, 0.62] as const,
  petalFootTo: 0.75,
  /** The spread of the sizes of the petals and the leaves: the least and the most as shares of the row's size, and the skew toward the small. */
  spread: [0.5, 1.35, 1.5] as const,
  /** The few near the eye that are far out of focus: in the storm the share of the leaves and petals and the depths they come in between; at rest their share, the depths they start and are full at, how much larger they are drawn, their blur in pixels of a 1080 picture, and how much of them is kept off the middle of the picture. */
  near: { stormShare: 0.12, stormFrom: [0.45, 0.85] as const, share: 0.4, from: 0.05, to: 0.7, size: 1.7, petalSize: [1.2, 3.4] as const, petalSkew: 2.5, px: [2.5, 12] as const, clear: 0.55 },
  /** At rest nothing is drawn large or soft in front of the cottage and the tree (winter's REST_CLEAR for the cards): inside the middle of the picture, from this depth forward and up to this height above the globe's centre, a sheet and a seed head are held to these radii in pixels of a 1080 picture, keep this share of the lens's blur, and none is of the large soft class. */
  clear: { back: -0.25, front: 0.05, lowMm: 6, highMm: 26, blur: 0.25, sheetPx: 11, seedPx: 30, snagPx: [5, 14] as const, snagSkew: 3, snagLiftMm: 3, snagSeen: 0.25 },
  /** The ones far behind are a little out of focus too. */
  far: { from: -0.25, to: -0.9, px: [0.6, 2.2] as const },
  /** From this blur on (as a share of the card's own width on the picture) a card is drawn as the soft blob of its outline. */
  blob: [0.45, 1.3] as const,
  /** The most a card's bends may move its outline on the picture, as a share of what keeps the outline whole when the card is seen edge on. */
  bendFit: 0.55,
  /** The storm's fine streaks, for the petals and for the leaves: their share of the ones not drawn whole, the least and most they are seen and its skew, how much longer than the shutter's path, their bow, width in pixels, the tail's share of the head's light, how pale (petals) and the tints (leaves). In the storm a streak is the true path of one exposure: the lengths in pixels it comes in between, the half length up to which it keeps its light (longer ones thin with their length), its width's share and the skew of its paleness. `stormHold` is the share of a stroke's path through the shutter that it is held back from: all of it, so that a short stroke is one stroke and not a row of dashes. `stormWhite` is how far the body of a stroke of the storm's down goes to white. */
  line: { shutFromPx: [3, 14] as const, dwellPx: 13, shutLong: [1.2, 2.6] as const, shutSeedSkew: 1.9, shutSeedWide: 1.4, stormLong: [1.5, 14] as const, stormLongSkew: 2.6, stormArms: 3, stormArmPitchMm: 16, stormArmWide: 0.5, stormArmEdge: 0.14, stormArmJitter: 0.12, stormGapSeen: 0.08, stormGapHeads: 0.5, stormMostPx: 520, stormDwellPx: 70, stormHold: 1, stormSoft: 0.08, stormHue: 0.06, stormWhite: 0.6, stormFog: 0.15, stormFromPx: [0.8, 3] as const, stormWidePx: [0.08, 0.6] as const, stormWideSkew: 3.2, stormWideFaint: 0.4, stormBow: [0, 0.05] as const, stormBowSkew: 2, stormArc: 1, stormBowMost: 0.3, stormTaper: 0.4, stormTail: 0.3, stormGain: 9, stormAlign: [0.8, 1] as const, stormLeaves: 0, stormLeafLongPx: [12, 30] as const, stormLeafWidePx: [3, 7] as const, stormLeafSeen: 0.9, stormLeaf: [0.07, 0.17, 0.03] as const, shutWide: 0.6, shutPale: 2.2, deepMostMm: 14, seedKeep: [0.015, 0.75] as const, seedSkew: 3.5, seedStretch: [0.5, 1.6] as const, seedWidePx: [0.3, 0.6] as const, seedHeads: 0.3, fanPx: [9, 24] as const, fanHairs: 7, fanSpread: 1.2, fanShort: 0.55, fanWide: 0.7, fanCore: 0.06, fanOpen: [0.08, 0.4] as const, headSeen: 0.6, deep: [0.6, 1.2] as const, frontCut: 0.2, share: [0.2, 0.4] as const, leafStretch: [1, 2.8] as const, leafPale: 0.6, leafSkew: 1.8, petalHeads: 0.55, petalHeadPx: [4.5, 10] as const, leafHeads: 0.45, leafHeadPx: [3, 8] as const, leafWidePx: [0.9, 1.9] as const, headOval: [0.5, 0.85] as const, headLift: 3, headGain: 1.1, petalHead: [[1, 0.74, 0.86], [1.25, 1.25, 1.25]] as const, petalWhite: 0.72, leafHead: [[1, 0.52, 0.18], [1.25, 0.85, 0.4]] as const, leafWhite: 0.85, keep: [0.03, 0.9] as const, skew: 3.5, stretch: [0.8, 2.4] as const, align: 0.85, fromPx: [6, 30] as const, bow: [0.03, 0.16] as const, widePx: [0.8, 1.8] as const, tail: 0.1, pale: [0.2, 0.8] as const, gain: 1.15, seedGain: 1.9, leafLow: [1.5, 1.0, 0.6] as const, leafHigh: [1.7, 1.25, 0.75] as const },
  /** A card in the storm, seen for the whole shutter: the places along its path it is drawn at, from which length of a piece of the path (in the card's own thin width) the card is the soft blob of its outline, and for a seed's head from which length of path (in its own radius) the hairs give way to the smear of the tuft, how much of the tuft is seen and how fast it thins with the path. */
  run: { taps: 5, blob: [0.35, 1.1] as const, seedFrom: [0.5, 2] as const, seedTuft: 0.02, seedTailMost: 1, seedThin: 0.8, seedHairs: 1, seedTrail: 0.6, seedDrawn: 0.35 },
  /** How much of the storm's sheets is taken away in front of the cottage, so that it still reads. */
  window: 0.75,
  /** How much a lying sheet is lit as one in the air, how much of the veil lies over it, and how much of its own colour the light takes on its way through a sheet. */
  /** How far a lying sheet's facing strays from the facing of what it lies on. */
  lieLoose: 0.08,
  /** The size of a lying petal or leaf as a share of its size in the air: what lies on the ground reads smaller than what hangs before it. */
  lieSize: 0.7,
  lieLit: 0.8,
  lieVeil: 0.45,
  throughHue: 0.35,
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
  chosen: [0.01, 0.012, 0.2] as const,
  dabSize: 0.36,
  leafDab: 0.55,
  /** How far inside the glass's outline a bat's middle stays, in its own radius: no wing is drawn outside the globe. */
  batInside: 1.05,
  /** How much of a dab is drawn where the storm's water is slow for a moment: the storm of a change holds its leaves from the window on, not only where they race. */
  dabCalm: 0.8,
  /** A dab of the storm: how much of the veil lies over it, how much of its streak it keeps, and the deeper pink of a petal's dab, so that the storm holds distinct small petals among its pale streaks. */
  dabFog: 0.45,
  dabStreak: 0.5,
  dabTint: [1, 0.74, 0.86] as const,
  /** The size of a whole petal and of a whole leaf in the storm, as a share of its size at rest. */
  stormSize: [0.45, 1] as const,
  /** The most of the veil that lies over a leaf in the storm: the flood of a change is thick, and its leaves are seen in it from the window on. */
  leafFogMost: 0.4,
  /** How much of the colour of the light a leaf takes; the rest it takes as white light, so that it stays orange in the green of fall. */
  leafHue: 0.22,
  /** The share of the petals and of the leaves that lie which is drawn: the approved ground shows a scatter with the path and the grass between, not a carpet. */
  lieKeep: [0.6, 0.35] as const,
  /** A leaf lit from behind glows in its own deepened colour, and no leaf is drawn brighter than this, so that orange stays orange and does not burn to yellow. */
  leafThrough: 0.9,
  leafMost: 0.48,
  /** The tints of the palest and of the reddest leaves against the row's orange, the share of the pale ones, and where the red ones start and are full along the leaves' own numbers. */
  leafGold: [1.0, 1.22, 1.0] as const,
  leafGoldShare: 0.12,
  leafRed: [0.98, 0.4, 0.5] as const,
  leafRedFrom: [0.3, 0.7] as const,
  /** The maple among the leaf outlines: its share of the leaves, its middle along the card, the lengths, places (as angles from the tip) and half widths of its tip, side and base lobes, how pointed they are, the rim between them and the depth of its teeth. */
  maple: { share: 0.42, mid: -0.12, long: [1.05, 0.9, 0.55] as const, at: [1.08, 2.1] as const, wide: [0.52, 0.5, 0.45] as const, point: 0.75, floor: 0.3, teeth: 0.12 },
  /** A leaf's own shading from the side turned from the key to the side turned to it, the darkening of a leaf that lies, and the waxy sheen of its curl. */
  leafShade: [0.5, 1.15] as const,
  leafLie: 0.7,
  leafSheen: 0.22,
  /** Of the rest, the share that is a solid small dab in the storm, and how much the others and they are seen. */
  dabShare: [0.2, 0.12, 0.42] as const,
  dabKeep: [0, 1] as const,
  /** How much of a moving card is drawn sharp at the head of its path; the rest is its trail through the shutter. */
  head: 0.85,
  fleckKeep: [0.01, 0.5] as const,
  fleckSkew: 8,
  fleckStorm: 3,
  /** The spread of the flecks' sizes, so that the smallest are not one stamp. */
  fleckSpread: [0.6, 1.7, 2] as const,
  /** How much of the veil lies over a card in the air, and over a bat. */
  fog: 0.3,
  batFog: 0.01,
  /** The warm glow a bat's edge takes from the light around it, over a body that stays black. */
  batGlow: [0.12, 0.06, 0.02] as const,
  /** How dark a bat's body is drawn against the row's colour: black on the dark air, a silhouette. */
  batBody: 0.1,
  /** How much of the lens's blur a bat keeps: the approved bats are crisp black shapes wherever they fly. */
  batSoft: 0.2,
  /** A bat is a solid black shape: nothing of the air is drawn over it. A card or a light fades out from this far to this far from a bat's middle, as shares of the bat's half span on the picture. */
  batHide: [0.6, 0.95] as const,
  petalCup: [0.2, 0.42] as const,
  leafCurl: [0.45, 0.65, 0.4] as const,
  seedRock: 0.5,
  /** How far each seed leans its own way, so that no two show the same side. */
  seedLean: 0.95,
  seedTilt: 1.2,
  litMost: 1.25,
  sparkKeep: [0.012, 1] as const,
  sparkSkew: 7,
  /** The embers that are seen as clear points: from this one of the embers' own numbers on an ember is drawn whole, whatever its share above. */
  sparkClear: [0.76, 0.85] as const,
  batFlap: 0.3,
  batBank: 0.7,
  /** How far a bat holds its wings raised about which they beat, and the spread of the bats' sizes: no two bats of a picture share a silhouette. */
  batRaise: 0.12,
  batSpread: [0.78, 1.2] as const,
  /** How far a bat leans its head the way it is going across the picture. */
  batLean: 0.5,
  /** How much lighter a bat's edge is than its body, so that its outline holds on dark air. */
  batRim: 1.5,
  /** A light's core, its glow and its wide glow, as radii in the particle's radius and as shares of its light. In the storm: how much brighter a light is (`stormGain`), how much of its wide glow is taken off (`stormHalo`), and the share of its path through the shutter it is held back from (`stormHold`), so that it is a short stroke and not a faint thread. */
  glow: { unlit: 0.4, gain: 5.6, lightHide: 0, stormHalo: 0.6, stormHold: 0.8, stormGain: 3.2, discSeen: 0.55, swarm: [9, 1.3, 8, 0.4, 15, 2] as const, swarmFine: 0.45, swarmFrom: [-0.35, 0.45] as const, swarmEdge: 0.4, swarmFly: [2, 5] as const, swarmOut: 0.97, cottageOut: 0.75, spread: [0.42, 2, 5] as const, nearPx: [8, 13] as const, discEdge: 0.7, discFrom: [3.5, 6] as const, discWide: 1.55, discRim: 0.3, discHold: 0.8, core: 0.26, coreVary: [0.6, 1.5] as const, coreSkew: 2, halo: 0.95, haloVary: [0.5, 1.8] as const, haloSkew: 1.5, haloSeen: [0.4, 1.8] as const, wide: 4.5, haloShare: 0.15, wideShare: 0.01, soft: 0.1, hide: 0.6, blinkLow: 0.25, blinkSkew: 1.2, lensFilm: 0.5, pale: 0.7, sparkPale: 0.65, nearShare: 0.05, lowAt: [-0.25, -0.28] as const, lowWide: [0.7, 0.26] as const, ring: [0.95, 0.4] as const, moreKeep: 1, fieldOut: 0.5, topAt: [-0.05, 0.7] as const, topWide: [0.6, 0.3] as const, topOut: 0.92, green: [0.9, 1, 0.9] as const, gold: [1, 0.82, 1.4] as const, goldFrom: [0.4, 0.8] as const },
  spark: { gain: 2.1, core: 0.3, halo: 1.3, haloShare: 0.07, tail: 1.6, calmTail: 0.1, hotCore: 0.8, hotWide: 0.3, hotFrom: [0.8, 2.2] as const, discHold: 0.25, discRim: 0.08, soft: 0.12, nearShare: 0.022, nearFrom: [0.05, 0.45] as const, nearPx: [9, 20] as const, calmStreak: 0.08, small: 1.8, large: 0.75, fromMm: [0.12, 0.7] as const, hot: [1, 0.68, 0.2] as const, dying: [0.85, 0.17, 0.03] as const },
  // `stormHold` is the share of a head's path through the shutter that it is held back from: a head of the storm smears by about its own width and keeps its tuft.
  // `inside` is the share of the ball's outline on the picture that no part of a seed is drawn past, and `insidePad` a seed's spare room to it in its own radius.
  // In the storm: `stormScene` of the heads before the cottage, the lanterns and the trunk (the cottage's own place, and the low band at `stormLowAt` of the width `stormLowWide`, in radii of the ball on the picture) and `stormCrown` of those before the crown are not drawn, but only those in front of the miniature (`stormFront`, depth in radii toward the eye): the ones behind it stay and are the bright air in its gaps. `stormThin` of all the others is taken off outside the upper left (`stormUpAt`, `stormUpWide`) and the right limb (`stormLimb`), where the storm is thickest. At rest `puffSeen` is how much of a far puff is seen: a crowd of small bright ones reads as snow.
  hair: { gain: 2.1, inside: 0.97, insidePad: 0.2, soft: 0.015, stormSoft: 0.05, stormBall: 0.04, stormSize: 0.85, stormShare: 0.9, stormFog: 0.35, nearSeen: 1.2, restSize: 2.7, restShare: 0.45, restClear: 0.45, even: 0.62, evenX: [-0.45, -0.15] as const, evenY: [-0.25, 0.1] as const, evenMost: 0.92, evenAt: [-0.32, 0.34] as const, evenWide: [0.27, 0.19] as const, nearDense: 0.9, nearLow: [-0.4, -0.28] as const, litMost: 0.95, rimFrom: [0.84, 0.92] as const, farSize: 0.75, farFrom: [-0.6, 0.2] as const, farSoft: 0.15, nearShare: 0.27, nearFrom: [-0.15, 0.2] as const, nearSize: 1.15, dim: [0.3, 0.52] as const, softPx: [0, 0.04] as const, puffFrom: [-0.55, -0.1] as const, puffPx: [2, 3] as const, puffBall: 1.4, sceneEdge: [0.75, 1.1] as const, cottageAt: [-0.48, -0.17] as const, cottageWide: [0.36, 0.27] as const, crownAt: [0.34, 0.26] as const, crownWide: [0.41, 0.3] as const, sceneOut: [0.7, 0.78] as const, sceneDim: 0.3, heartShare: 1, heartWide: 0.09, heartSeen: 1, heartTint: [4.2, 3.9, 3.1] as const, rayHeart: 1.5, rayTip: 0.6, restBall: 0.05, runHead: 0.5, runTrail: 0.6, runWide: 0.04, seen: 1.25, seedSeen: 2, hairSeen: 1.25, faint: 0.7, hubSeen: 0.6, stemSeen: 0.45, stalks: 0.25, lens: 0.09, lensFilm: 0.3, stormSeen: 1.3, reach: 2, foot: 1.6, footSpan: [0.85, 1.1] as const, stem: 0.004, body: 0.03, grain: 0.07, hub: 0.8, spread: [0.8, 2.6, 2.2] as const, bigFrom: [0.45, 0.95] as const, bigSoftPx: 0.05, bigSeen: 0.85, lensShare: 0.08, lensPx: [1.6, 4.5] as const, stormStalks: 0.12, lean: 0.1, ballAt: 0.05, ballWide: 0.3, ball: [0.3, 0.5] as const, ballFrom: [0.06, 0.45] as const, stemTint: [1.25, 1.1, 0.85] as const, grainTint: [0.22, 0.1, 0.05] as const, heartDim: 0.5, dimTint: [1, 0.9, 0.76] as const, stormHold: 0.7, stormPale: 0.35, stormScene: 0.85, stormCrown: 0.5, puffSeen: 0.4, stormLowAt: [-0.05, -0.3] as const, stormLowWide: [0.8, 0.3] as const, stormFront: [-0.35, 0] as const, stormThin: 0.45, stormUpAt: [-0.45, 0.42] as const, stormUpWide: [0.4, 0.35] as const, stormLimb: [0.5, 0.8] as const },
  down: { tile: 256, tilts: 8, half: 1.3, size: 0.66, most: 4, lodMost: 5, lodPx: 0.3, lodBlur: 3, leanSkew: 1.5, stormLeanSkew: 0.5, faceOn: 0.03, jitter: 0.06, wide: 0.5, long: [0.82, 1] as const, weight: [0.8, 1.1] as const, bow: 0.05, tipFade: 0.5, tips: 0.9, tipSeen: 0.5, tipWide: 1.8, fineShare: 0.3, fineLong: 0.94, fineSeen: 0.75, heart: 3, heartWide: 0.03, forms: [{ hairs: 64, cap: [0.7, 0.15] }, { hairs: 58, cap: [0.75, 0.2] }, { hairs: 70, cap: [0.6, 0.05] }, { hairs: 60, cap: [0.8, 0.25] }] as const },
}
