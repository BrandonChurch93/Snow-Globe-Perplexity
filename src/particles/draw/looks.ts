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
  leaf: { shape: SHAPE.leaf, size: 1.3, body: 1, flash: 0.35 },
  seed: { shape: SHAPE.seed, size: 4.2, body: 0.9, flash: 0 },
  firefly: { shape: SHAPE.light, size: 0.42, body: 1, flash: 0 },
  ember: { shape: SHAPE.spark, size: 1.35, body: 1, flash: 0 },
  bat: { shape: SHAPE.bat, size: 2.1, body: 1, flash: 0 },
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
/** Summer's seeds and lights are of the storm by how fast they go in the globe, not by how fast they cross the picture: their pace is read as the wide camera would see it. `mmPx` is the pixels a millimetre at the globe's middle may be before the pace is taken down by the camera's closeness: a little over the wide camera's own 6.244, so the wide camera's pictures keep their sums to the bit and a head that drifts in the calm is a calm head at any camera. */
export const SUMMER_PACE = { mmPx: 6.5 }
/** A seed that lands comes near what it can snag on and goes out of the storm before it touches (points.ts): `fromMm` and nearer it is at the touch, from `toMm` on it is in the open air. A seed is at most 1.2 mm off what it lies on (kinds.ts, `layerMm`) and comes no faster than half a millimetre a frame when it snags (`restSpeedMmS`), so the 6 mm between are twelve frames and more: no seed leaves the picture or comes into it where it touches. In the storm at its full none of this counts (`stormOff`, the storm's level it goes off between), and its pictures stand to the bit. `state` is the state the draw gives a seed in the liquid at the touch: afloat for the shader, its nearness in it. */
export const SEED_NEAR = { fromMm: 1.4, toMm: 7.4, stormOff: [0.9, 0.99] as const, state: 0.1 }
/** Summer's seeds and lights at the back of the ball. The lens (src/globe/lens.ts, `lensPlace`) puts a point that the ray through the limb does not reach on the outline, where the outline's hide takes it; at the back of the ball the rays fold, and a point that this ray comes to reach is put at once well inside the outline, at 0.9 to 0.45 of its radius, whole and at its full light in one frame of the film. So a seed or a light there comes in with its distance past that ray, from nothing at the ray to its full `mm` millimetres past it, and goes out the same way. A seed afloat goes no faster than it can snag at (kinds.ts, `restSpeedMmS`, half a millimetre a frame of the film) and a firefly cruises at a third of that, so the 6 mm are twelve frames and more. Near the limb itself the outline's hide is the lesser of the two and stands as it was. In the storm at its full none of this counts (`stormOff`, the storm's level it goes off between), and its pictures stand to the bit. Read by the seed's and the light's shapes only, which are summer's alone: a mote is spring's and fall's too and keeps the lens's own place. */
export const SUMMER_EDGE = { mm: 6, stormOff: [0.9, 0.99] as const }
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
/**
 * The storm lit from within (kit/04-LOOK.md: the veil is lit by the inside lights): the haze of the storm glows round each of the lights inside. `most` seeds of the
 * list, the first after the laid heads', are no seeds at all: each stands at one of the season's inner lights and is that glow, wide and soft, added to what is behind
 * it and gone with the storm. A glow is `wide` of its light's reach in radius, with a fainter one `far` times as wide round it; `core` and `haze` are the two's light
 * for a light of the power 1, and a stronger light glows the more by the root of its power. The card stands `liftMm` nearer the eye than the light, so the lantern
 * itself blooms; `reach` of the far glow's radius is the card's half side. Its colour is the light's own, `pale` of the way to `cream`.
 */
export const STORM_BLOOM = { most: 16, reachMostMm: 6, most1: 1.2, wide: 0.18, far: 5, core: 1.1, haze: 0.008, hot: [1, 0.82, 0.4] as const, paneBelow: 0.018, liftMm: 5, reach: 2.3, pale: 0.5, cream: [1, 0.78, 0.46] as const, pool: 0.45, poolMm: 16, poolAtMm: [6, -10, 0] as const, poolBackMm: 12, low: 0.42, lowMm: 17, lowFlat: 2.4, lowAtMm: [0, -25, 0] as const, lowLiftMm: 58, lowReach: 1.6 }
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
  /** How much of a laid head is seen, the least and the most: each by its own share. */
  seen: [0.3, 0.55] as const,
  /** The seats that hold a head, by their place in the list: one or two on the roof, the crown's, a few on the lawn. The others stay listed for the day a head is wanted there. A laid head is drawn `size` times its listed radius: a whole wheel of down, as wide as the ones in the air. */
  held: [5, 1, 8, 9, 10, 11, 13, 16] as const,
  size: 1.25,
  /**
   * The seats of the tree's crown follow the crown as it is made (points.ts reads the engine's own collider): `crown` is the first of them in the list and
   * one past the last, and of each only the column counts, its place over the ground. The seat is the first surface under the column from the top of the
   * liquid, so a head lies on whatever crown is made there; round the column, as far as `seek` mm, the most level place is taken, and a place the whole of
   * `seek` away must be the more level by `near` to be taken. The collider's cells are coarse (1.8 mm), so a seat found on it is raised by `rise` mm: a
   * head may stand a hair high, it never sinks into the leaves. The other seats, and every seat where the source keeps no scene, stand as listed.
   */
  follow: { crown: [8, 11] as const, seek: 2.4, near: 0.2, rise: 0.4 },
  at: [
    [-26.11, -9.23, -10.41, -0.5, 0.82, 0.27, 1.2],
    [-23.31, -9.24, -5.11, -0.5, 0.82, 0.27, 0.93],
    [-20.56, -9.31, 0.23, -0.5, 0.82, 0.27, 1.35],
    [-18.63, -3.17, -10.43, -0.48, 0.83, 0.27, 1.43],
    [-21.57, -5.16, -11.58, -0.5, 0.82, 0.27, 0.99],
    [-19.14, -6.99, -2.79, -0.5, 0.82, 0.27, 1.4],
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
  /** The storm's fine streaks, for the petals and for the leaves: their share of the ones not drawn whole, the least and most they are seen and its skew, how much longer than the shutter's path, their bow, width in pixels, the tail's share of the head's light, how pale (petals) and the tints (leaves). In the storm a streak is the true path of one exposure: the lengths in pixels it comes in between, the half length up to which it keeps its light (longer ones thin with their length), its width's share and the skew of its paleness. `stormHold` is the share of a stroke's path through the shutter that it is held back from: all of it, so that a short stroke is one stroke and not a row of dashes. `stormWhite` is how far the body of a stroke of the storm's down goes to white from the warm cream of the heads (`stormCream`), each stroke by its own share. A stroke of the storm's down is a lock of fine hairs side by side, each told from the next: `stormLock` of them beside the first, half on each side, `stormLockPx` pixels from it, each `stormLockLong` of its length, up to `stormLockShift` of it up or down the path and `stormLockSeen` as bright. A stroke is a hair, and a hair is fine at any depth: of the lens's blur circle it takes `stormLens` only. Toward the limb (`stormRim`, in radii of the ball on the picture) `stormRimOut` of the strokes are not drawn. The strokes are fine enough to cross the miniature: of the clearing the heads keep before it they take `stormScene` only, of the thinning outside the thick of the storm `stormThin`, and of the cottage's window `stormWindow`. In summer's storm the strokes lie on one swirl. About the point `stormSwirlAt` (from the ball's middle on the picture, in its radii) a stroke is turned `stormSwirl` of the way from its own path to the tangent of the circle through it; nearer that point than the two of `stormEye` the tangent itself goes over to the level drift `stormLevel`, so the swirl has no eye. Off that line every stroke is turned by its own angle, to one side or the other: up to `stormStray` radians in the upper middle, most of them far less (`stormStraySkew`), and up to `stormStrayLow` (`stormStrayLowSkew`) in the lower half and at the sides, which is what lies below the two of `stormStrayTop` or outside the two of `stormStraySide`. `stormKeep` of the strokes are drawn: fewer of them, and longer. `stormLockShare` of them are locks of `stormLockRows` hairs across that run together toward the seed at the head and spread behind it, to between the two of `stormLockFan` of the lock's width at the head, in a soft haze of `stormLockHaze` at the lock's middle. A stroke of mist is `stormMistLong` times its path. `stormLeaves` of the strokes are leaves, carried in the strokes' own draw and at no draw of their own: few and dark, at `stormLeafGain` of their colour. */
  line: { shutFromPx: [3, 14] as const, dwellPx: 13, shutLong: [1.2, 2.6] as const, shutSeedSkew: 1.2, shutSeedWide: 1.4, stormLong: [6, 16] as const, stormLongSkew: 1.3, stormArms: 3, stormArmPitchMm: 16, stormArmWide: 0.5, stormArmEdge: 0.14, stormArmJitter: 0.12, stormGapSeen: 0.25, stormGapHeads: 0.55, stormMostPx: 520, stormDwellPx: 160, stormHold: 1, stormSoft: 0.12, stormHue: 0.5, stormWhite: 0.2, stormFog: 0.15, stormFromPx: [10, 22] as const, stormWidePx: [0.35, 0.7] as const, stormWideSkew: 2, stormWideFaint: 0.7, stormBow: [0, 0.12] as const, stormBowSkew: 2, stormArc: 1, stormBowMost: 0.3, stormTaper: 1, stormTail: 0.3, stormGain: 4, stormAlign: [0.5, 1] as const, stormSwirl: 0.85, stormSwirlAt: [-0.1, -0.14] as const, stormEye: [0.12, 0.42] as const, stormLevel: [0.98, -0.2] as const, stormKeep: 0.55, stormStray: 0.45, stormStraySkew: 2, stormStrayLow: 0.62, stormStrayLowSkew: 0.8, stormStrayTop: [0.25, 0.55] as const, stormStraySide: [0.4, 0.7] as const, stormPlaneMm: -27, stormAcrossMm: 23, stormLeaves: 0.008, stormLeafGain: 0.5, stormLeafLongPx: [12, 30] as const, stormLeafWidePx: [3, 7] as const, stormLeafSeen: 0.9, stormLeaf: [0.07, 0.17, 0.03] as const, shutWide: 0.6, shutPale: 2.2, deepMostMm: 14, seedKeep: [0.35, 0.9] as const, seedSkew: 3.5, seedStretch: [0.5, 1.6] as const, seedWidePx: [0.3, 0.6] as const, seedHeads: 0.3, fanPx: [9, 24] as const, fanHairs: 7, fanSpread: 1.2, fanShort: 0.55, fanWide: 0.7, fanCore: 0.06, fanOpen: [0.08, 0.4] as const, headSeen: 0.6, deep: [0.6, 1.2] as const, frontCut: 0.2, share: [0.2, 0.4] as const, leafStretch: [1, 2.8] as const, leafPale: 0.6, leafSkew: 1.8, petalHeads: 0.55, petalHeadPx: [4.5, 10] as const, leafHeads: 0.45, leafHeadPx: [3, 8] as const, leafWidePx: [0.9, 1.9] as const, headOval: [0.5, 0.85] as const, headLift: 3, headGain: 1.1, petalHead: [[1, 0.74, 0.86], [1.25, 1.25, 1.25]] as const, petalWhite: 0.72, leafHead: [[1, 0.52, 0.18], [1.25, 0.85, 0.4]] as const, leafWhite: 0.85, keep: [0.03, 0.9] as const, skew: 3.5, stretch: [0.8, 2.4] as const, align: 0.85, fromPx: [6, 30] as const, bow: [0.03, 0.16] as const, widePx: [0.8, 1.8] as const, tail: 0.1, pale: [0.2, 0.8] as const, gain: 1.15, seedGain: 1.9, leafLow: [1.5, 1.0, 0.6] as const, leafHigh: [1.7, 1.25, 0.75] as const, stormScene: 0.68, stormPullMm: 40, stormPullShare: 1, stormThin: 0.25, stormWindow: 0.15, stormCream: [0.97, 0.85, 0.64] as const, stormLockShare: 0.8, stormLockRows: 8, stormLockPx: [1.8, 5.5] as const, stormLockSlim: 0.45, stormLockSkew: 1.5, stormLockSlope: 0.1, stormLockFan: [0.4, 0.85] as const, stormLockFlip: 0.35, stormLockHeaded: 0, stormEnds: 0.85, stormLit: 0.85, stormLockLong: [0.35, 0.9] as const, stormLockSeen: [0.08, 0.4] as const, stormLockSoft: 0, stormLockSoftWide: 3, stormLockSoftSeen: 0.4, stormLockHaze: 0.1, stormLockHazeWide: 0.45, stormMist: 0.08, stormMistLong: 1.2, stormMistPx: [20, 40] as const, stormMistSeen: 0.6, stormMistHaze: 0.08, stormMistScene: 0.6, stormMistCottage: 0, stormMistCut: 0.7, stormMistPull: [16, 10, 12] as const, stormSheetSoft: 0, stormSheetSoftPx: 1.5, stormSheetSoftLong: 2, stormMistWarm: 1.5, stormMistLit: 1.4, stormMistRim: [0.7, 0.9] as const, stormMistGain: 1, stormSheetRows: 5, stormSheetPx: 0.3, stormSheetSpan: 0.65, stormSheetLong: [0.25, 0.8] as const, stormSheetSeen: [0, 0] as const, stormSheetSlope: 0.12, stormGlowFrom: [1.2, 9] as const, stormGlowHot: 0, stormGlowHotFrom: [6, 18] as const, stormGlowLong: 1.6, stormMistGlow: 0.25, stormGlint: 0.1, stormGlintPx: 0.7, stormGlintLift: 2, stormGlintTint: [1.6, 1.15, 0.5] as const, stormLens: 0.01, stormRim: [0.6, 0.93] as const, stormRimOut: 0.92 },
  /** A card in the storm, seen for the whole shutter: the places along its path it is drawn at, from which length of a piece of the path (in the card's own thin width) the card is the soft blob of its outline, and for a seed's head from which length of path (in its own radius) the hairs give way to the smear of the tuft, how much of the tuft is seen and how fast it thins with the path. */
  run: { taps: 5, blob: [0.35, 1.1] as const, seedFrom: [0.05, 0.35] as const, seedTuft: 0.02, seedTailMost: 1, seedThin: 0.8, seedHairs: 1, seedTrail: 0.6, seedDrawn: 2 },
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
  leafFace: 0.32,
  stormRock: 2.8,
  yawSway: 0.6,
  /** Of the ones that settle and stay down, the share drawn whole, in the storm and lying; the rest are the storm's small dabs and are gone once they are down. */
  chosen: [0.01, 0.012, 0.2] as const,
  dabSize: 0.36,
  leafDab: 0.677,
  /** The share of the leaves afloat at rest that stand near the eye, large and out of focus: the approved air holds a few, among many small sharp ones. */
  leafNearShare: 0.03,
  leafNearSize: 1.2,
  leafNearPx: [1.5, 5] as const,
  /** At rest a few dozen leaves carry the air and each is read as a leaf: the share of the leaves afloat that is drawn, and their size in mm from the smallest to the largest with the skew between. */
  leafRestShare: 0.95,
  leafRestRight: 0.62,
  leafRestCottage: 0.7,
  leafRestRim: [0.84, 0.91] as const,
  leafRestRightFrom: [-0.1, 0.5] as const,
  leafRestMm: [0.9, 1.8, 6] as const,
  /** The lens of the ball swells a leaf that floats deep in it: at rest no leaf is drawn larger than this, in pixels of its half length, and a leaf that lies is this share of its size. The approved leaves are about 12 px long, the largest under 30. */
  leafRestPx: 11,
  leafLieSize: 0.6,
  /** At rest the slow turn gathers leaves low by the fence at the left, where the approved air holds a few: the place, its width, and the share taken out at its middle. */
  leafRestFenceAt: [-0.45, -0.44] as const,
  leafRestFenceWide: [0.2, 0.14] as const,
  leafRestFence: 0.8,
  /** How far inside the glass's outline a bat's middle stays, in its own radius: no wing is drawn outside the globe. */
  batInside: 1.05,
  /** How much of a dab is drawn where the storm's water is slow for a moment: the storm of a change holds its leaves from the window on, not only where they race. */
  dabCalm: 0.8,
  /** A dab of the storm: how much of the veil lies over it, how much of its streak it keeps, and the deeper pink of a petal's dab, so that the storm holds distinct small petals among its pale streaks. */
  dabFog: 0.45,
  dabStreak: 0.5,
  dabTint: [1, 0.74, 0.86] as const,
  /** The size of a whole petal and of a whole leaf in the storm, as a share of its size at rest. */
  stormSize: [0.45, 1.231] as const,
  /** The most of the veil that lies over a leaf in the storm: the flood of a change is thick, and its leaves are seen in it from the window on. */
  leafFogMost: 0.4,
  /** How much of the colour of the light a leaf takes; the rest it takes as white light, so that it stays orange in the green of fall. */
  leafHue: 0.22,
  /** The share of the petals and of the leaves that lie which is drawn: the approved ground shows a scatter with the path and the grass between, not a carpet. */
  lieKeep: [0.6, 0.35] as const,
  /** A leaf lit from behind glows in its own deepened colour, and no leaf is drawn brighter than this, so that orange stays orange and does not burn to yellow. */
  leafThrough: 0.9,
  leafMost: 0.43,
  /** The tints of the palest and of the reddest leaves against the row's orange, the share of the pale ones, and where the red ones start and are full along the leaves' own numbers. */
  leafGold: [1.0, 1.18, 1.15] as const,
  leafGoldShare: 0.3,
  leafRed: [0.92, 0.5, 0.5] as const,
  leafRedFrom: [0.5, 0.95] as const,
  /** The dark leaves, rust and brown, among the orange ones: their tint and the share of the leaves that has it. */
  leafDark: [0.5, 0.4, 0.5] as const,
  leafDarkFrom: [0.56, 0.78] as const,
  /** The maple among the leaf outlines: its share of the leaves, its middle along the card, the lengths, places (as angles from the tip) and half widths of its tip, side and base lobes, how pointed they are, the rim between them and the depth of its teeth. */
  maple: { share: 0.3, mid: -0.12, long: [1.05, 0.9, 0.55] as const, at: [1.08, 2.1] as const, wide: [0.52, 0.5, 0.45] as const, point: 0.75, floor: 0.42, teeth: 0.12 },
  /** A leaf's own shading from the side turned from the key to the side turned to it, the darkening of a leaf that lies, and the waxy sheen of its curl. */
  leafShade: [0.26, 1.25] as const,
  /** A leaf's tint from its middle to its edge: the edge is the thin part, where the light comes through. */
  leafEdge: [0.72, 1.2] as const,
  leafLie: 0.7,
  leafSheen: 0.35,
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
  batGlow: [0.015, 0.009, 0.004] as const,
  /** How dark a bat's body is drawn against the row's colour: black on the dark air, a silhouette. */
  batBody: 0.1,
  /** How much of the lens's blur a bat keeps: the approved bats are crisp black shapes wherever they fly. */
  batSoft: 0.05,
  /** How much of its path through the shutter a bat is drawn along: none, the approved bats have hard edges. */
  batStreak: 0,
  /** How much of a pixel's own softness a bat's outline keeps. */
  batEdge: 0.35,
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
  sparkRestSkew: 30,
  /** The embers that are seen as clear points: from this one of the embers' own numbers on an ember is drawn whole, whatever its share above. */
  sparkClear: [0.76, 0.85] as const,
  sparkRestClear: [0.35, 0.39] as const,
  /** At rest the sparks under the clear ones are fine points, too faint for a halo: how much of their light they keep, and from which of the sparks' own numbers on. */
  sparkRestFine: [0.16, 0.35] as const,
  batFlap: 0.3,
  batBank: 0.7,
  /** At rest a bat holds its wings near level, as the approved bats do: this much of the bank and of the lean is left. */
  batRestTilt: 0.45,
  /** How much narrower a bat's wing is from its leading to its trailing edge than the plain outline: the approved bats are slender. */
  batSlim: 1.9,
  /** How far a bat holds its wings raised about which they beat, and the spread of the bats' sizes: no two bats of a picture share a silhouette. */
  batRaise: 0.05,
  batSpread: [0.78, 1.2] as const,
  /** How far a bat leans its head the way it is going across the picture. */
  batLean: 0.5,
  /** How much lighter a bat's edge is than its body, so that its outline holds on dark air. */
  batRim: 0.6,
  /** A light's core, its glow and its wide glow, as radii in the particle's radius and as shares of its light. In the storm: how much brighter a light is (`stormGain`), how much of its wide glow is taken off (`stormHalo`), and the share of its path through the shutter it is held back from (`stormHold`), so that it is a short stroke and not a faint thread. In the storm a light is `stormSize` of its size, `stormShare` of the lights are seen and `stormCottage` fewer of those before the cottage, and its colour goes by `stormTint` from yellow green toward a warm yellow. A light of the storm is a short streak laid along the swirl of the down and turned off it by up to `stormStray` radians: between the two of `stormStreakPx` pixels long at the least, most of them short (`stormStreakSkew`), with a tail that falls to `stormTail` of the head's light, `stormThin` of the thinning a long streak takes, a core of `stormCorePx` pixels at the least, `stormLens` of the lens's blur circle and `stormPale` of the way to the hot tint at its heart; `stormHide` is how much its core hides of what lies behind it. At rest a light is a bright heart in a soft glow of its own colour, with no edge, no ring and no disc (cardGlow, `cardRestLight`): `restOut` of the lights are not lit, and the others stand in a row by their own number, from the finest to the largest. The heart is `restHeart[0]` pixels of the hd picture soft for the finest and `restHeart[1]` more for the largest, by the power `restHeart[2]` of its place in the row, so most hearts are fine; and none is softer than `restHeartScene` before the miniature; each light is up to `restVary` larger or smaller of its own, and at the close camera at most `restClose` times larger. Round the heart of most stands a faint tight glow, `restGlow[0]` pixels and `restGlow[1]` of the heart's softness wide, with `restGlowOf[0]` of the heart's light. Over the band `restBig` of the row a light becomes one of the large: its glow is from `restGlowBig[0]` to `restGlowBig[1]` pixels soft and holds `restGlowOf[1]` of the heart's light, each between the two of `restGlowVary` of that; before the miniature none is large. Such a glow is faint beside its heart, so it is seen round the largest hearts alone, about one light in six of the lit. The heart's light is `restTop`, and `restDim[0]` of it for the finest (whole from `restDim[1]` of the row on). The glow keeps the light's own colour, its red `restWarm` times the storm's, so that it is the yellow green of the approved lights and not a lime, with `restPale[0]` of the hot tint; the heart has `restPale[1]` of it and the finest hearts `restPale[2]`. The light goes to nothing between the two of `restCut`, inside the card, which reaches as far as the light does. In the storm (`tightL` 1) nothing of this is read. The disc of a light out of focus has no ring and no edge (`discRim`, `discEdge`), and `wideOf` of the lights of the storm's rise have a wide faint glow, `widePx` pixels at the least and `wideShare` of their light. `nearShare` of the lights stand near the lens, large and soft: none now, the large glows are the last of the row. Of the lights in the open air `fieldOut`, of those at the top `topOut` and of those outside the swarm `swarmOut` are not drawn. `wide` is the reach of an ember's card, which fall reads, and stays as fall has it; a light's own wide glow is `lightWide`, read by the lights alone, as are `hot` and the disc that goes out in the storm. `lensFilm` is the share of the film's lens shift that is taken back from a light (shader.ts, `lensShare`): at 1 a light stands at one place in every sample of the lens and is one point; at less the samples lay it out as so many dots over its blur circle, a bunch of 8 at review in the macro camera. */
  glow: { unlit: 0.4, gain: 1.1, lightHide: 0, stormHalo: 0.85, stormHaloPx: 0.45, stormHold: 0.955, stormGain: 2, stormSize: 0.4, stormTail: 0.12, stormThin: 0.14, stormLens: 0.2, stormHide: 2.5, stormPale: 0.35, stormStray: 0.5, stormCorePx: 0.45, stormStreakPx: [4, 34] as const, stormStreakSkew: 2, stormShare: 0.6, stormCottage: 0.85, stormTint: [1.12, 1, 0.6] as const, discSeen: 0.12, swarm: [9, 1.3, 8, 0.4, 15, 2] as const, swarmFine: 0.45, swarmFrom: [-0.5, 0.5] as const, swarmEdge: 0.4, swarmFly: [2, 5] as const, swarmOut: 0.15, cottageOut: 0.92, crownOut: 0.8, scenePx: 1.5, bandAt: [-0.12, -0.22] as const, bandWide: [0.72, 0.3] as const, bandOut: 0.92, lens: 0.04, farSoft: 0.35, spread: [0.42, 2, 5] as const, nearPx: [8, 13] as const, discEdge: 0, discFrom: [3.5, 6] as const, discWide: 1.55, discRim: 0, discHold: 0.8, core: 0.5, corePx: 0.7, coreVary: [0.6, 1.5] as const, coreSkew: 2, halo: 0.6, haloPx: 1.9, haloPxVary: [0.7, 1.4] as const, widePx: 6, wideOf: 0.03, widePale: 0.15, sceneTight: 0.15, haloVary: [0.4, 1.1] as const, haloSkew: 1.5, haloSeen: [0.2, 1.6] as const, haloSeenSkew: 1.5, wide: 4.5, lightWide: 2, haloShare: 0.011, wideShare: 0.05, soft: 0.1, hide: 0.6, blinkLow: 0.25, blinkSkew: 1.2, lensFilm: 1, pale: 0.95, paleIn: 0.45, sparkPale: 0.65, nearShare: 0, restOut: 0.69, restHeart: [0.3, 1, 1.7] as const, restHeartScene: 1, restBig: [0.36, 0.46] as const, restGlow: [1, 1.2] as const, restGlowBig: [3.8, 6.4] as const, restGlowOf: [0.075, 0.068] as const, restGlowVary: [0.7, 1.4] as const, restVary: 0.2, restClose: 2, restTop: 0.6, restDim: [0.56, 0.6] as const, restPale: [0.2, 0.55, 0.75] as const, restWarm: 1.05, restCut: [0.00015, 0.001] as const, lowAt: [-0.25, -0.28] as const, lowWide: [0.55, 0.24] as const, ring: [0.95, 0.4] as const, ringKeep: 0.15, upAt: [-0.45, 0.42] as const, upWide: [0.4, 0.35] as const, upKeep: 0.25, moreKeep: 1, fieldOut: 0, topAt: [-0.05, 0.7] as const, topWide: [0.6, 0.3] as const, topOut: 0.1, green: [0.9, 1, 0.3] as const, gold: [1, 0.82, 0.7] as const, hot: [1.05, 1, 0.62] as const, goldFrom: [0.3, 0.9] as const },
  spark: { gain: 2.1, core: 0.3, halo: 1.3, haloShare: 0.07, restGain: 6.2, restCore: 0.13, restHalo: 0.6, restHaloVary: [1, 1.5, 8] as const, restHaloShare: 0.12, restHaloFaint: 0, restEmber: [1, 0.25, 0.03] as const, restHotWide: 3, restDiscSeen: 0.08, restDiscHold: 0.1, restDiscCover: 0.15, restHot: [1, 0.77, 0.6] as const, restFineHot: [1, 0.6, 0.26] as const, restFineSeen: [0.35, 0.6, 0.8] as const, restHotCore: 1, restOutField: 0.05, restOutScene: 1.2, restOutRim: 0.6, restRim: [0.74, 0.9] as const, restEdge: 0.2, restUpAt: [-0.4, 0.42] as const, restUpWide: [0.45, 0.4] as const, restCrownAt: [0.32, 0.12] as const, restCrownWide: [0.4, 0.4] as const, restCottageAt: [-0.27, -0.22] as const, restCottageWide: [0.28, 0.18] as const, tail: 1.6, calmTail: 0.1, hotCore: 0.8, hotWide: 0.3, hotFrom: [0.8, 2.2] as const, discHold: 0.25, discRim: 0.08, discEdge: 0.8, discVary: [0.55, 1.1] as const, soft: 0.05, nearShare: 0.03, nearField: 0.12, nearRightAt: [0.4, 0.36] as const, nearRightWide: [0.25, 0.25] as const, nearCottage: [0.25, 0.6] as const, nearFrom: [0.05, 0.45] as const, nearPx: [8, 44] as const, nearSkew: 2.4, calmStreak: 0.08, small: 1.8, large: 0.75, fromMm: [0.12, 0.7] as const, hot: [1, 0.68, 0.2] as const, dying: [0.85, 0.17, 0.03] as const },
  // `stormHold` is the share of a head's path through the shutter that it is held back from: nearly all of it, so that every hair of a head is read through the shutter; the head is drawn out a little along its path by the card itself (`run.seedDrawn`).
  // At rest `bigShare` of the heads, the largest, are `bigMore` times larger again: the three or four that float close to the eye. A head that lies has a soft shade under it: `shadeSeen` dark at its middle, `shadeAt` of the card's radius under the heart, and `shadeWide` of it wide and high.
  // `inside` is the share of the ball's outline on the picture that no part of a seed is drawn past, and `insidePad` a seed's spare room to it in its own radius.
  // In the storm: `stormScene` of the heads before the cottage, the lanterns and the trunk (the cottage's own place, and the low band at `stormLowAt` of the width `stormLowWide`, in radii of the ball on the picture) and `stormCrown` of those before the crown are not drawn, but only those in front of the miniature (`stormFront`, depth in radii toward the eye): the ones behind it stay and are the bright air in its gaps. `stormThin` of all the others is taken off outside the upper left (`stormUpAt`, `stormUpWide`) and the right limb (`stormLimb`), where the storm is thickest. At rest `puffSeen` is how much of a far puff is seen: a crowd of small bright ones reads as snow. `puffPx` is a far puff's softness in pixels where a millimetre is `puffMmPx` pixels on the picture, which is the hero camera at the ball's middle; where a millimetre is more, before a nearer camera, the softness is as much more.
  // In the storm a head is `stormSize` of its size, `stormShare` of the heads afloat are drawn (the others are the strokes) and the down takes `stormTint`. At rest the heads come in sizes between the two of `restSpread`, the largest nearly three times the smallest across; `stalks` of them carry a stalk, and of those none is drawn before the cottage or the crown (`stalkScene`); `restClear` of the heads low over the clearing are not drawn.
  // The down's sheet: `puffs` are the forms of a head at rest, round tufts of some forty to sixty hairs of nearly one length, none longer than the tuft's radius, that thin from a small bright heart (`puff.heartSeen`) to nothing at the tip (`puff.tipFade`); a hair of a puff can be beaded (`puff.bead`), and none is now. `drifts` are the heads as the storm leaves them: fewer hairs, and of some only those of one side (`part`); a head goes over to its drift over the first `driftFrom` of the storm.
  // The storm goes out by degrees: what it does to a head and to a light by the storm alone, with no weight of its own (the whirl's arms and the dark between them, where a head is drawn on its path, a light's streak along the swirl), is weighed by how much of the storm is left under `stormEase`, so that no head is the brighter and no light the rounder in the one frame in which the storm comes to nothing. From `stormEase` on it is whole, as it was.
  hair: { gain: 4, stormEase: 0.05, stormTint: [0.97, 0.94, 0.8] as const, restGain: 1.1, warm: 0.6, cream: [1.06, 0.99, 0.9] as const, peach: [1.1, 0.88, 0.72] as const, peachShare: 0.6, inside: 0.97, insidePad: 0.2, soft: 0.015, stormSoft: 0.05, stormBall: 0.04, stormSize: 1.7, stormShare: 0.16, stormFan: 1.7, stormFanFrom: [0.45, 1] as const, stormTrail: 4, stormTrailFrom: [0.3, 0.9] as const, stormFace: 2.6, stormFaceSkew: 0.15, stormStill: 1, stormFog: 0.35, nearSeen: 1.2, restSize: 2.05, restSpread: [0.62, 1.7] as const, restShare: 1, restClear: 0.8, even: 0.6, lowOut: 0.5, lowY: [0.45, 0.75] as const, nearDense: 0.9, nearLow: [-0.4, -0.28] as const, litMost: 0.95, rimFrom: [0.88, 0.95] as const, farSize: 0.85, farFrom: [-0.6, 0.2] as const, farSoft: 0.15, nearShare: 0.16, nearFrom: [-0.15, 0.2] as const, nearSize: 1.1, dim: [0.8, 1] as const, softPx: [0, 0.04] as const, puffFrom: [-0.55, -0.1] as const, puffPx: [0.3, 0.6] as const, puffMmPx: 6.25, puffBall: 1.4, sceneEdge: [0.75, 1.1] as const, cottageAt: [-0.48, -0.17] as const, cottageWide: [0.36, 0.27] as const, crownAt: [0.34, 0.26] as const, crownWide: [0.41, 0.3] as const, sceneOut: [0.95, 0.6] as const, sceneDim: 0.5, heartShare: 1, heartWide: 0.09, heartSeen: 0.3, heartTint: [4.2, 3.9, 3.1] as const, rayHeart: 1.3, rayTip: 0.9, restBall: 0.05, runHead: 0.5, runTrail: 0.6, runWide: 0.04, seen: 1.25, seedSeen: 2, hairSeen: 1.25, faint: 0.7, hubSeen: 0.35, stemSeen: 0.45, stalks: 0.125, stalkScene: 0.4, stalkBend: 0.14, lens: 0.09, lensFilm: 0.3, stormLens: 0.015, stormSeen: 0.5, reach: 2, foot: 0.2, footSpan: [0.85, 1.1] as const, stem: 0.004, body: 0.045, grain: 0.12, hub: 0.8, spread: [0.8, 2.6, 2.2] as const, bigFrom: [0.45, 0.95] as const, bigSoftPx: 0.05, bigSeen: 0.85, lensShare: 0.04, lensPx: [1.6, 4.5] as const, stormStalks: 0.45, stormFoot: 0.32, stormStem: 0.007, stormStemSeen: 0.8, lean: 0.1, ballAt: 0.05, ballWide: 0.3, ball: [0.3, 0.5] as const, ballFrom: [0.06, 0.45] as const, stemTint: [1.25, 1.1, 0.85] as const, grainTint: [0.22, 0.1, 0.05] as const, heartDim: 0.5, dimTint: [1.02, 0.92, 0.84] as const, litTint: [1, 0.92, 0.84] as const, stormHold: 0.93, stormPale: 0.6, stormScene: 0.82, stormCrown: 0.25, puffSeen: 0.85, stormLowAt: [-0.05, -0.3] as const, stormLowWide: [0.8, 0.3] as const, stormFront: [-0.35, 0] as const, stormThin: 0.4, stormUpAt: [-0.3, 0.4] as const, stormUpWide: [0.6, 0.5] as const, stormLimb: [1.5, 2] as const, stormRimOut: 0.6, bigShare: 0.04, bigMore: 1.12, bigUp: [0.12, 0.3] as const, bigSide: [0.62, 0.8] as const, shadeSeen: 0.4, shadeAt: 0.55, shadeWide: [0.6, 0.17] as const },
  down: { tile: 256, tilts: 8, half: 1.3, size: 0.66, most: 4, lodMost: 5, lodPx: 0.3, lodBlur: 3, leanSkew: 2.5, stormLeanSkew: 0.45, restLean: 0.6, faceOn: 0.03, jitter: 0.06, wide: 0.5, long: [0.82, 1] as const, weight: [0.8, 1.1] as const, bow: 0.05, tipFade: 0.5, tips: 0.9, tipSeen: 0.5, tipWide: 1.8, fineShare: 0.3, fineLong: 0.94, fineSeen: 0.75, heart: 3, heartWide: 0.03, forms: [{ hairs: 64, cap: [0.7, 0.15] }, { hairs: 58, cap: [0.75, 0.2] }, { hairs: 70, cap: [0.6, 0.05] }, { hairs: 60, cap: [0.8, 0.25] }] as const, stars: [{ hairs: 46, cap: [0.98, 0.3] }, { hairs: 38, cap: [0.96, 0.15] }, { hairs: 56, cap: [0.99, 0.4] }, { hairs: 42, cap: [0.97, 0.22] }] as const, star: { wide: 0.6, long: [0.7, 1] as const, weight: [0.8, 1.5] as const, tipFade: 0.4, bow: 0.12, flare: -0.55, flarePow: 1, flareHold: 0.7, heart: 1.2, heartWide: 0.028, px: [52, 90] as const, lodPx: 0.55, seen: 1.8, share: 0.12, leanSkew: 0.6, lean: 0.95 }, drifts: [{ hairs: 26, cap: [0.98, 0.3], long: [0.5, 1.15], weight: [1.2, 2.2], part: 1 }, { hairs: 48, cap: [0.97, 0.1], long: [0.6, 1], weight: [0.8, 1.5], part: 1 }, { hairs: 20, cap: [0.99, 0.45], long: [0.4, 1.15], weight: [1.3, 2.4], part: 0.6 }, { hairs: 14, cap: [0.95, 0.35], long: [0.55, 1.2], weight: [1.5, 2.6], part: 0.4 }, { hairs: 34, cap: [0.99, 0.2], long: [0.35, 1.05], weight: [1.1, 2.2], part: 1 }, { hairs: 58, cap: [0.96, 0.3], long: [0.5, 1.1], weight: [0.8, 1.6], part: 0.85 }] as const, driftFrom: 0.3, puffs: [{ hairs: 44, cap: [0.5, -0.2] }, { hairs: 52, cap: [0.6, -0.1] }, { hairs: 60, cap: [0.42, -0.3] }, { hairs: 48, cap: [0.55, -0.15] }] as const, puff: { wide: 0.4, long: [0.78, 1] as const, weight: [0.9, 1.5] as const, tipFade: 0.9, root: 0.25, bow: 0.06, tip: 0, tipWide: 1, bead: 0, beadLong: [0.11, 0.21] as const, heart: 0.6, heartWide: 0.022, seen: 1.2, gain: 2.2, heartSeen: 0.8, glowWide: 0.05, tint: [1.04, 0.97, 0.9] as const } },
  // A head afloat in the calm is a clock: a ball of fine hairs all round its hub on a stalk that hangs under it, with the seed at the stalk's foot (cards.ts, cardSeed). These are summer's own numbers and are read by the seed's card alone, and only under the storm's full level: at the full storm a head is drawn as it was, to the byte.
  // The card draws the hairs itself, hair by hair, with no sheet, as two rings round the hub: a ring of strong hairs and, turned half a step so that each stands between two strong ones, a ring of fine ones. A ring has between the two of `hairs` hairs (a stout head's between the two of `stoutHairs`), by the particle's own whole number, so a fine head has 32 to 40 in all; `hairsMost` is the most a ring may have, the room each ring's hairs have among the 64 whole numbers of a head. A hair is `reach` of the card's radius long at the most and between the two of `long` of that (`downLong` in the fine ring), most of them long, so the outline is round with a few short hairs in it. It stands off its even place round the hub by up to half of `jitter` of the angle between two, is bent toward its tip by up to `bow` radians of its own and by `swirl` that its neighbours share, is between the two of `weight` bright (`downWeight`), and falls to `fall` of that at its tip (`downFall`). A strong hair is `wide` pixels of the hd picture wide, or `wideOf` of the head's radius where that is more (before a nearer camera), and a stout one `stoutWide` times that: with the pixel's own softness a line a pixel wide at half its height, never finer, so a hair is a whole line at any place between the pixels and at any turn of the head. A fine hair is softer by `downWide` pixels and begins between the two of `downFrom` of the reach from the hub. `seen` is how much one hair hides where it is sharp (`stoutSeen` a stout one, whose fine ring is `stoutDown` as bright, so a stout head is its twenty or so strong spokes with faint ones between); out of focus it is as much fainter as it is wider. A hair fades over the last `tipFade` of the reach and ends in a tuft, a dot `tipWide` pixels (or `tipOf` of the radius) wide and `tip` as bright as the hair (`downTip`). Of a ring's light `told` stands as hairs that are told apart (the first for a fine head, the second for a stout one; `downTold` the same for the fine ring) and the rest is the ring's mean, the soft ball of down the approved's fine heads are under their hairs. Where the hairs stand closer than a hair is wide (between `merge[0]` and `merge[1]` hair widths apart) the card takes the mean of them all, which is the soft ball they are toward the hub and in a small or a soft head, and never more than `most` hairs deep. The hub is a small bright heart, `heart` seen and `heartWide` of the reach wide (`stoutHeart`, and `stoutHeartWide` times as wide), and `heartLit` of it (fine, stout) is of `heartTint`, white hot, where the low sun comes through. A clock takes back `lensFilm` of the film's lens shift, all of it, so it stands at one place in every sample of the lens and each hair is one line (shader.ts, `lensShare`), and where the picture is drawn once it is spread by `lens` of the lens's blur circle in place of the storm's `hair.lens`.
  // The look goes over to the storm's by degrees: it is whole under `stormOff[0]` of the storm's level and gone at `stormOff[1]`, and of a head that the storm moves it is as much less as the head is the storm's.
  // A head hangs: its stalk stands within `lean` radians of upright, each at its own lean, and rocks by `rock` radians, so the hairs turn far less in a frame than the angle between two of them.
  // Three classes by depth: a head is `mm[0]` millimetres in radius far behind the miniature, `mm[1]` in the middle and `mm[2]` near the eye, going over between the depths of `farAt` and of `nearAt` (in radii of the ball toward the eye, each head `depthVary` off its own depth), and each `vary` larger or smaller. The far ones are soft by `softPx[0]` pixels of the hd picture and `classSeen[0]` as bright, small grey puffs in the shade; the middle ones by `softPx[1]` and `classSeen[1]`; the near ones sharp and whole. Before the miniature no head is of the near class. How many are drawn is the clocks' own: `even` of the middle and near ones and `farMore` times as many of the far, a little more toward the limb where the way through the ball is shorter (by the power `evenPow` of that way; half would even a ball that is filled alike, and the heads are not, they stand thickest round the miniature), `lowOut` fewer under the heights of `lowY` (in radii of the ball over its middle), where they hang thickest, and `sceneOut` of them not drawn before the cottage and the lanterns, and before the crown.
  // `stalks` of the heads show their stalk (the first of the middle ones, the second of the near): it ends `foot` of the head's reach under the middle of the card, most of them short (`footSkew`), and `footNear` for a near head, whose stalk is the long one; it is `stem` of the card's radius wide, `stemSeen` seen and of `stemTint`, a pale gold, and none is shown before the cottage or the crown. `gain` and `tint` are the light and the colour of the down, which is never brighter than `white` of the level that burns to white, so a fine hair stays a hair and the down is of one white in the sun and in the shade. The far puffs are of `farTint` and no brighter than `farWhite`. `warm` is the colour of the `warmShare` of the near heads that stand in the low sun, which are the stout ones, and they may be as bright as `stoutWhite`.
  clock: { hairs: [16, 20] as const, stoutHairs: [20, 23] as const, hairsMost: 24, reach: 0.66, long: [0.7, 1.08] as const, downLong: [0.55, 1] as const, jitter: 0.5, bow: 0.2, swirl: 0.08, weight: [0.25, 1.2] as const, downWeight: [0.3, 0.6] as const, told: [0.75, 1] as const, downTold: [0.5, 0.85] as const, fall: 0.45, downFall: 0.8, wide: 0.1, wideOf: 0.01, downWide: 0.3, stoutWide: 1.4, seen: 0.7, stoutSeen: 1.2, stoutDown: 0.45, downFrom: [0.2, 0.45] as const, tipFade: 0.2, tip: 0.4, downTip: 0.5, tipWide: 0.3, tipOf: 0.018, heart: 1.2, heartWide: 0.06, stoutHeart: 2.2, stoutHeartWide: 1.4, heartLit: [0.75, 1] as const, heartTint: [1.5, 1.4, 1.2] as const, merge: [1.2, 2] as const, most: 4, lensFilm: 1, lens: 0.02, stormOff: [0.5, 0.99] as const, rock: 0.2, lean: 0.75, mm: [0.34, 0.72, 1.05] as const, farAt: [-0.05, 0.05] as const, nearAt: [0.3, 0.5] as const, even: 0.55, evenPow: 0.15, farMore: 1.8, lowOut: 0.6, lowY: [0.32, 0.45] as const, sceneOut: [0.95, 0.4] as const, depthVary: 0.15, vary: [0.85, 1.15] as const, softPx: [0.8, 0, 0] as const, classSeen: [1, 0.9, 1] as const, stalks: [0.15, 0.7] as const, foot: [0.15, 0.8] as const, footNear: [0.6, 1.3] as const, footSkew: 2, stem: [0.007, 0.011] as const, stemSeen: [0.35, 0.8] as const, stemTint: [1.3, 1.08, 0.66] as const, gain: 4, white: 1.05, farWhite: 0.6, stoutWhite: 1.35, tint: [0.92, 0.97, 1.16] as const, farTint: [0.74, 0.88, 1.1] as const, warm: [1.15, 0.76, 0.6] as const, warmShare: 0.85 },
}
