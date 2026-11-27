import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { setGlass } from '../../globe/shell'
import { centreHeightMm } from '../../scene/layout'
import { partChange } from '../../shake/change'
import type { KitMoment } from '../kit'
import { rig } from './rig'
import { holdStorm, veil } from './veil'

// Part `glass-dressing-summer`: the glass is clear, and what the season puts on it is light.
// 1. The flare: the reflection of the one strong warm light (the rig's key) on the outside of the glass. It sits where a sphere
//    mirrors that light toward the eye (the half vector between the eye and the light), which from the hero camera is the upper
//    right shoulder, at the limb. It is a small hot core squeezed along the limb, a warm halo and the star a lens draws round a
//    point that bright. It kindles on the landing.
// 2. The pool: the same light focused by the globe onto the slab, in front of the globe and to its left, inside the globe's own
//    shadow: a soft pool of warm light, brightest at a knot by the foot, and inside it a few broad curved bands of the water's
//    light, soft edged and never a net or a star. There is no pool before the landing; after it the pool swells, its bands
//    slide into place and come to rest, and they breathe a little while the water is still.
// 3. The wall: the sun, bent by the globe, burns a patch on the inside of the glass low on the far side; the same billboard
//    carries the warm haze of the liquid at rest, the room seen through the upper half (dark, with the red brown shapes of
//    its walls and a few dim discs of its lamps) and the thin streaks and the few curved bands of reflection on the glass.
//    None of it grows brighter with the storm, which is the air's: the still air's light gives way to it (by the liquid's
//    turbulence). It is drawn with the interior, straight after the view through the liquid and before the
//    miniature, so all of it lies behind the cottage and the tree: the crown is a dark mass against bright air, as the
//    approved image has it, and nothing is laid over the miniature's detail. No band of light runs all the way round the
//    outline.
// Nothing here is stepped: both are functions of the moment's pose, of the time and of the time since the landing.
const PART = 'glass-dressing-summer'
const RS = config.globe.sphereDiameterMm / 2
const TAU = Math.PI * 2
const RAD = Math.PI / 180

// The shell's own light this season: no window, no even glow across the rim, and the wall low on the glass takes about half
// the room's light, so no pale band stands inside the outline. The ring at the outline is thin and hides little of the inside
// (`ringThin`, `ringCover`, `rimClear`), its cool line over the top and the ceiling's reflection are held low (`topLine`,
// `ceiling`), and the lamps outside the frame show as fine arcs (`arcs`). The rest of the light on the glass is the wall's
// streaks and bands, below
setGlass('summer', { windowTint: [0.9, 0.86, 0.78], windowGain: [0, 0, 0, 0], windowSoftDeg: 5, windowGrain: 0.5, rimTint: [0.8, 1, 1.25], rimSide: [1.3, 0.5, 0.28], wallTint: [0.5, 0.36, 0.2], ringCover: 0.4, strip: 0, bend: 1, ringThin: 0.75, rimClear: 0.4, topLine: 0.3, ringMottle: 0.3, ceiling: 0.5, roomHue: [0.85, 0.98, 1.15], roomHueOn: 1, windowShade: 0, rimGlow: 0, arcs: 0.4, arcTint: [1, 0.9, 0.74], arcCool: 1.6 })

export const look = {
  // leaving: the light goes out between these two counts of beats before the swap window opens
  leaveBeats: [1.1, 0.2] as const,
  flare: {
    halfMm: 30,
    // the core: white hot and on the outline, drawn out along it; how strong, and its size across the outline and along it
    // (in the quad's half width, as every length of the flare is)
    core: 12,
    coreAcross: 0.0225,
    coreAlong: 0.045,
    // the bloom of the lens round the core: a soft warm ball that takes the core's hard edge away
    bloom: 1.8,
    bloomWide: 0.07,
    // the warm glow under the rays: brightest against the core and falling off fast (`glow`, and the length it falls to
    // a third in), then a faint broad ball of it a quarter of a globe radius wide (`halo`) and the thin `veil` that
    // carries it on. It is never a disc with an edge
    glow: 1.6,
    glowWide: 0.06,
    halo: 0.5,
    haloWide: 0.2,
    veil: 0.07,
    // the rays: many fine straight lines through the core, `spikes` of them, never evenly spaced. Each end has its own
    // length (`reach`: the shortest, and how much longer the longest is; most are short) and its own strength, some
    // nearly out. They are longer and brighter away from the globe. `rayWide` is a ray's width at its tip and how much
    // wider it is at the core
    rays: 1.8,
    spikes: 33,
    reach: [0.07, 0.3] as const,
    rayWide: [0.0022, 0.003] as const,
    // and how much wider a ray grows out to its tip, so the ends are soft
    raySoft: 0.007,
    arc: 1.6,
    hot: [1, 0.92, 0.78] as const,
    warm: [1, 0.72, 0.42] as const,
    amber: [1, 0.47, 0.16] as const,
    // the landing: the flare is out while the globe is in the hand after the change, catches on the landing frame, overshoots and settles
    kindleSeconds: 0.22,
    flash: 0.55,
    flashSeconds: 0.3,
    breath: 0.05,
  },
  // the far wall: the light that crosses the globe gathers on the inside of the glass opposite the sun, a warm crescent
  // along the limb
  wall: {
    gain: 0.42,
    low: 0.38,
    // the thin warm crescent along the limb
    band: 0.03,
    wide: 0.5,
    from: 0.86,
    peak: 0.95,
    color: [1, 0.74, 0.44] as const,
    // the hot patch: the sun, bent by the globe, lands on the inside of the glass low on the far side and glows there,
    // warm white under the clip, with its strokes in it, and about a third of a globe radius tall. How strong, where (share of the radius, radians up the limb from
    // the wall's middle), how wide, how far it runs down to the ground and how far up the limb
    hot: 19,
    hotAt: [0.9, -0.09] as const,
    hotSize: [0.048, 0.15, 0.2] as const,
    // how steeply the burn ends: 1 is a soft bell, more is a patch with an edge
    hotEdge: 1.6,
    // the burn is a flame: this much wider than `hotSize` at its foot and this much of it at its tip
    hotFlame: [1.4, 0.55] as const,
    hotColor: [1, 0.78, 0.52] as const,
    // the wall parts the light into fine slanted strokes: they fray the burn's edge and climb the limb above it. How many
    // lie across one globe radius, how far each leans out toward the limb as it climbs, how far up they reach (radians),
    // how wide the sheaf is and how strong
    brush: 130,
    brushLean: 0.34,
    brushTall: 0.15,
    brushWide: 0.03,
    brushGain: 0.1,
    // how much of the burn's skirt and of the glow the strokes take away between them
    brushDeep: [0.96, 0.3] as const,
    // the amber glow of the liquid round the patch
    glow: 0.85,
    glowSize: [0.17, 0.2] as const,
    // its spill past the limb: the lens blooms round the patch, outside the glass too
    spill: 0.3,
    spillAt: 0.12,
    spillColor: [1, 0.62, 0.3] as const,
    // the limb's own warm edge on the far side: the glass wall takes the sun's amber low on the left, round the burn. How
    // strong, where up the limb (radians) and how far it runs, where in the radius and how thick
    edge: 4,
    edgeAt: [0, 0.5] as const,
    edgeIn: [0.968, 0.012] as const,
    edgeColor: [1, 0.5, 0.18] as const,
    // and this much of it lies in front, on the glass's outline, so the outline there is warm and not the room's cool line
    edgeFront: 0.3,
    // the air: the low sun in the liquid, warm on the side the light falls toward and nothing on the side it comes from
    air: 0.012,
    airColor: [1, 0.66, 0.36] as const,
    // the haze: the liquid behind the miniature holds the last sun. It is cream gold and fullest low, just over the ground
    // (`hazeLow`, in globe radii up the picture), and stands highest in a plume between the cottage and the tree (`hazeAt`,
    // `hazeWide`), `hazeTall` radii tall there and `hazeSideTall` of that at the sides, where it is `hazeRim` as strong. With
    // it goes a thinner light that lies on a slope and never on a level, `hazeHigh` at the ground, down to a third
    // `hazeHighTall` radii up, and `hazeHighLeft` of that at the far left. `hazeBanks` is how unevenly all of it lies, in
    // soft banks `hazeBankSize` globe radii across, so it reads as lit liquid and never as a flat card
    haze: 0.32,
    hazeColor: [1, 0.68, 0.4] as const,
    hazeRim: 0.07,
    hazeAt: -0.12,
    hazeWide: 0.45,
    hazeLow: -0.46,
    hazeTall: 0.5,
    hazeSideTall: 0.55,
    hazeHigh: 0.04,
    hazeHighTall: 0.4,
    hazeHighLeft: 0.35,
    // the haze over the dome: above the roof line the liquid holds the sun too, a cream veil that the seed heads and the
    // fireflies float in, `fill` of it. It thins to nothing toward the top of the glass (`fillTop`, globe radii up: all of
    // it below the first, none above the second) and toward the left, where the air is clear and dark between the heads
    // (`fillLeft`, globe radii across: left of the first the share given third is gone, right of the second none of it
    // is). It gathers in soft bodies (`fillBody`, each: where, across and up, how wide and how tall in globe radii, how
    // much, and 1 if it goes with the veil and reaches the limb, 0 if it is a glow that falls off to the limb): low over
    // the roof, at the middle, a broad one behind and above the crown on the flare's side, which is the light the crown
    // and the heads stand against, one under the top of the glass and one at the upper left, which brings the clear air
    // between the heads there up to a warm brown. The room's dark patches cut the veil down to `fillDark` of itself and a glow to `bodyDark`,
    // so they show through faintly
    fill: 0.045,
    fillColor: [1, 0.72, 0.47] as const,
    fillTop: [0.66, 1] as const,
    fillLeft: [-0.5, 0.1, 0.9] as const,
    fillDark: 0.4,
    fillBody: [
      [-0.3, 0.1, 0.34, 0.15, 0.17, 0],
      [0, 0.26, 0.26, 0.26, 0.08, 0],
      [0.55, 0.5, 0.42, 0.36, 0.36, 1],
      [0.2, 0.8, 0.42, 0.16, 0.14, 1],
      [-0.4, 0.35, 0.42, 0.45, 0.06, 1],
    ] as const,
    bodyColor: [1, 0.58, 0.34] as const,
    bodyDark: 0.6,
    // and the glow falls off to the limb: all of it inside the first of these radii, none beyond the second
    bodyLimb: [0.5, 0.92] as const,
    // a faint warm body of light over the middle, behind the cottage and left of the crown (`domeAt`, globe radii
    // across and up; `domeSize`, how far it reaches to the left, to the right and up or down). It lies in broad soft folds
    // that follow the glass, `folds` of them to a globe radius, `foldDeep` of it is gone in the gaps between them, and the
    // room's dark patches cut it
    dome: 0.07,
    domeAt: [-0.05, 0.16] as const,
    domeSize: [0.35, 0.45, 0.22] as const,
    domeColor: [1, 0.58, 0.34] as const,
    folds: 7,
    foldLong: 1.3,
    foldDeep: 0.6,
    // the room: above the roof line (`roomFrom`, globe radii up: nothing of it below the first, all of it above the second)
    // the dark room shows through the glass in patches that lie along the arc, `room` of them to a globe radius across it and
    // `roomLong` along it, broken finer by `roomFine`. In a dark patch `roomDark` of the liquid's light is left, in a lit one
    // `roomLit`, so the ground is never one tone
    room: 7.5,
    roomLong: 1.6,
    roomFine: 9,
    roomDark: 0.05,
    roomLit: 1.3,
    roomFrom: [-0.2, 0.12] as const,
    // behind the tree and the lanterns the liquid is brightest and warmest: a core between the trunk and the right wall
    core: 0.11,
    coreAt: [0.4, -0.12] as const,
    coreSize: [0.38, 0.26] as const,
    coreColor: [1, 0.56, 0.26] as const,
    // the sharp light on the glass: thin streaks that follow the arc just inside the outline, warm at the upper left and
    // down the left limb, where the wall mirrors the room's lamps, and pale blue inside the right arc beside
    // the flare, where it mirrors the sky. Each: its bearing (degrees from the right, counter clockwise) and half its length
    // along the arc (degrees), where in the radius it lies, half its width, how far it leans across the arc, how strong, and
    // 1 if it is cool. Between them the outline is bare: they lie along less than half of it. `glintBroken` of a streak is
    // gone in the gaps along it
    glints: 2,
    glint: [
      [127, 17, 0.966, 0.0042, 0.012, 1.8, 0],
      [117, 9, 0.944, 0.0036, -0.01, 1.5, 0],
      [152, 6, 0.9, 0.0045, 0.05, 2.6, 0],
      [168, 10, 0.962, 0.004, 0.01, 1.8, 0],
      [139, 5, 0.925, 0.004, -0.03, 1.3, 0],
      [160, 14, 0.948, 0.004, 0.006, 1.3, 0],
      [182, 12, 0.955, 0.0035, 0.006, 1, 0],
      [148, 18, 0.972, 0.005, 0.002, 2.2, 0],
      [176, 16, 0.968, 0.0055, 0.004, 2.1, 0],
      [196, 12, 0.958, 0.005, 0.008, 1.7, 0],
      [16, 13, 0.905, 0.009, 0.03, 0.75, 1],
      [22, 7, 0.862, 0.0055, -0.02, 0.6, 1],
      [3, 12, 0.948, 0.0045, 0.015, 0.9, 1],
      [8, 6, 0.81, 0.01, 0.06, 0.4, 1],
    ] as const,
    glintBroken: 0.8,
    glintWarm: [1, 0.8, 0.58] as const,
    glintCool: [0.74, 0.86, 1] as const,
    // the glass's own reflections across the top and down the right shoulder: a few curved bands that follow the dome
    // inside the outline, cream at the upper left, blue white down the right shoulder and faintly under the top, where the room's cool light lies in
    // them, and a deep warm brown in the gap by the right limb and broad at the upper left, where the lamps do (each: bearing and
    // half length in degrees, where in the radius, half its thickness, how strong, and its colour: 0 cream, 1 cool, 2 deep
    // warm). A band is not smooth: `reflexLined` of it lies in fine lines that run along the arc (`reflexLines` sets how
    // fine they are across the band, `reflexLong` how short along it), so it reads as a reflection in glass and not as mist.
    // `sheen` holds the broad smooth one, the room's lit wall: a brown band under the outline at the top, which lies
    // further in toward the right (bearing and half length in degrees, where in the radius, half its thickness, how
    // strong, and how far it leans inward along the arc, clockwise). The upper left one is lined, so the dark shows between its streaks
    reflex: [
      [116, 32, 0.89, 0.045, 0.27, 0],
      [80, 26, 0.945, 0.022, 0.03, 1],
      [24, 30, 0.875, 0.03, 0.47, 1],
      [30, 26, 0.955, 0.022, 0.24, 2],
      [138, 30, 0.76, 0.08, 0.13, 2],
    ] as const,
    reflexCool: [0.9, 0.95, 1] as const,
    reflexWarm: [1, 0.8, 0.56] as const,
    reflexDeep: [1, 0.52, 0.25] as const,
    sheen: [
      [84, 34, 0.769, 0.085, 0.36, -0.33],
    ] as const,
    sheenColor: [1, 0.54, 0.28] as const,
    reflexLined: 0.8,
    reflexLines: 55,
    reflexLong: 2.2,
    // right of the top, under the blue white band at the outline, the glass is clear and the dark room shows: the air's
    // light is cut there (bearing and half length in degrees, where in the radius, half its thickness, how much of the
    // air's light goes at its middle)
    topShade: [62, 34, 0.82, 0.09, 0.7] as const,
    // the glass has thickness: just inside the outline lies a band of fine lines of light that run along the arc, and
    // against the outline one bright line. It is drawn last, over the shell, whose own band there bends the inside and
    // would bend these lines away with it. `rim` is the whole of its strength, `rimAt` where in the radius the band
    // begins, is whole, begins to end and has ended, `rimFoot` where it ends above the base (the height of the bearing:
    // none below the first, all above the second), `rimLines` how fine the lines are across it, `rimLong` how short
    // along it and `rimBare` how much of it stays between the lines. Its colour goes by the bearing: amber down the
    // left limb (`rimLeft`), warm white down the right (`rimRight`), blue white over the top (`rimTop`, about the
    // bearing in `rimTopAt`, degrees, with the cosines between which it comes in) and white at the right shoulder,
    // where the flare sits (`rimShoulder`, `rimShoulderAt`). `rimBandBy` is the band's share at the left, the right,
    // the top and the shoulder, `rimLineBy` the bright line's; `rimLine` is where the line runs, its half width and
    // its strength, and over the top it lies further in and wider (`rimTopLine`), a soft blue white band under the
    // outline. On the left a broken cream line marks the band's inner edge (`rimInner`: where, half width, strength).
    // The glass mirrors the room and not the storm inside it: the rim stands in the storm as it stands at rest, and
    // `reflexStorm` of the reflections comes back of what the storm takes from the still air's light, never more
    rim: 1,
    rimAt: [0.925, 0.97, 0.992, 1] as const,
    rimFoot: [-0.55, -0.3] as const,
    rimLines: 120,
    rimLong: 2.5,
    rimBare: 0.08,
    rimLeft: [0.16, 0.06, 0.01] as const,
    rimTop: [0.16, 0.2, 0.24] as const,
    rimTopAt: [74, 0.6, 0.93] as const,
    rimRight: [0.17, 0.11, 0.065] as const,
    rimShoulder: [0.17, 0.22, 0.3] as const,
    rimShoulderAt: [42, 0.82, 0.978] as const,
    rimBandBy: [0.65, 0.5, 0.15, 1.2] as const,
    rimLine: [0.991, 0.006, 1.8] as const,
    rimLineBy: [0.25, 1, 0.2, 1] as const,
    rimTopLine: [0.975, 0.012] as const,
    rimInner: [0.94, 0.008, 0.09] as const,
    rimInnerColor: [1, 0.8, 0.62] as const,
    reflexStorm: 0.6,
    hazeBanks: 0.35,
    hazeBankSize: 0.42,
    // the storm is the air's, in front, in the veil: nothing here grows brighter with it. The still air's haze behind
    // the miniature gives way to it by this much, between these two turbulences, and it dulls the burn
    stormClears: 0.75,
    stormFrom: 0.12,
    stormTo: 0.75,
    stormDulls: 0.35,
  },
  pool: {
    // where the hot middle of the pool lies from the foot's centre: down the light's way on the slab and a little across it
    reachMm: 76,
    sideMm: 2.7,
    // how far the low sun draws the pool out along its way
    stretch: 2.2,
    // the pool: a soft patch of warm light that a glass ball full of water throws on the table, brightest by the foot and
    // falling off without an edge. `softMm` is its radius, `at` where its middle lies from the bright knot (across, and
    // down the light's way), `gain` its brightness; the water's cells (`cellMm` wide) shade `mottle` of it, so it is
    // never one flat tone
    softMm: 26,
    at: [-18, -2] as const,
    gain: 0.175,
    // and a smaller, brighter body of it by the foot (its radius, where, how bright)
    nearMm: 11,
    nearAt: [-5, 0] as const,
    near: 0.27,
    cellMm: 38,
    mottle: 0.35,
    // the knot by the foot: a small soft hot spot, and the glow it lies in
    core: 1.4,
    coreMm: 2.6,
    glow: 0.3,
    glowMm: 5,
    // the water's light inside the pool: a few broad curved bands that bend round the knot, each several millimetres wide,
    // soft edged, thickest and brightest at its middle and fading to its ends, of unlike length and width (each: the
    // middle of its circle from the knot, across and down the way, its radius, the bearing of its middle and its half
    // length in degrees, half its width, how bright, and how far it slides as the liquid swings, all lengths in
    // millimetres). No line runs out from the knot
    band: [
      [3, -2, 11, 205, 45, 1.7, 1, 2],
      [-6, 4, 16, 185, 40, 2.4, 0.85, -3],
      [4, -4, 40, 200, 35, 3.2, 0.6, 4.5],
      [-10, -14, 12, 240, 35, 1.5, 0.5, -2.5],
      [2, 0, 13, 40, 28, 1.5, 0.45, 2.5],
    ] as const,
    bands: 1,
    // the water's cells take this much of a band's light away in places, so it is uneven along its length
    bandMottle: 0.3,
    // grains of sand on the table take the light where a band lies: one to a cell `grainCellMm` wide, `grainMm` in
    // radius, one in seven of them lit. Off (0, and then no line of them is in the shader): the lens's fringe gave
    // each grain a red rim at 3840 x 2160, and a grain wide enough to hide it is no grain
    grains: 0,
    grainMm: 0.11,
    grainCellMm: 1.3,
    drift: 0.35,
    breath: 0.06,
    breathCycles: 2,
    liftPerMm: 2.2,
    tiltMm: 160,
    swing: 1,
    swingSeconds: 1.1,
    swingHz: 1.7,
    // the arrival (kit, "The arrival": "the pool of light settles on the surface" over the seconds after the landing): a
    // globe in the hand throws no pool. From the landing the pool swells over `swellSeconds`, from `small` of its size
    // to all of it, and the bands slide out into their places with the liquid's swing and come to rest
    swellSeconds: 0.8,
    small: 0.6,
    gold: [1, 0.66, 0.26] as const,
    amber: [1, 0.5, 0.14] as const,
    pale: [1, 0.8, 0.5] as const,
  },
  // the seat: where the glass goes down into the base, its foot stands in the base's own shade and takes no light of the
  // room. A band on the glass, in millimetres above the base's foot: nothing of it above `top`, all of it from `full`
  // down to `foot`, which lies under the base's crest; `dark` of the light behind the glass is taken away in it. It lies
  // `proud` of the glass, so the glass's own lines are under it
  seat: { foot: 40.2, full: 43, top: 45, dark: 0.8, proud: 0.2 },
}

const vec = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`
const n = (v: number): string => v.toFixed(4)

const uniforms = {
  // xyz: toward the light, in the world; w: how far the flare is kindled
  uFlareSun: { value: new THREE.Vector4(0, 1, 0, 1) },
  // x: the time, y: the pool's swing, z: how much of the pool is there, w: free
  uSummer: { value: new THREE.Vector4(0, 0, 1, 0) },
  // xy: the pool's middle on the slab, zw: the light's way on the slab (unit)
  uPoolAt: { value: new THREE.Vector4(0, 0, 0, 1) },
  // xy: the globe's foot on the slab, z: how far the still water has slid
  uPoolFoot: { value: new THREE.Vector3(0, 0, 0) },
  // 1, and 0 in the one still that leaves the air out (a measuring aid): the lit liquid on the far wall goes, the glass's own light stays
  uSummerAir: { value: 1 },
}

const F = look.flare
// The flare's rays, laid out once: each line through the core has its own bearing, a little off its even place, and each
// of its two ends its own reach and strength. Most ends are short and a few long, and some are nearly out
const flareRnd = (i: number, k: number): number => {
  const x = Math.sin(i * 127.1 + k * 311.7 + 1.3) * 43758.5453
  return x - Math.floor(x)
}
const FLARE_RAYS = Array.from({ length: F.spikes }, (_, i) => ({
  a: ((i + 0.5 + 1.5 * (flareRnd(i, 1) - 0.5)) * Math.PI) / F.spikes + 0.35,
  ends: [2, 3].flatMap((k) => [F.reach[0] + F.reach[1] * flareRnd(i, k) ** 2, 0.2 + 0.8 * flareRnd(i, k + 3) ** 1.5]),
}))
// how far from the core a ray can reach at the most
const FLARE_REACH = (F.reach[0] + F.reach[1]) * 1.25 * 1.2 * (1 + F.breath)
const FLARE = `
uniform vec4 uFlareSun;
uniform vec4 uSummer;
varying vec2 vFl;
varying vec2 vFlOut;
varying float vFlGain;
// one fine ray: d its way, e the reach and the strength of its end along d and of the other end, breathe its breath, fine
// the least width a pixel can carry. A ray is widest at the core, thins along its length and grows soft at its tip
float flRay(vec2 p, vec2 d, vec4 e, float breathe, float fine) {
  float along = dot(p, d);
  float across = p.x * d.y - p.y * d.x;
  float away = max(sign(along) * dot(d, vFlOut), 0.0);
  vec2 end = along > 0.0 ? e.xy : e.zw;
  float t = abs(along) / (end.x * (0.75 + 0.5 * away) * breathe);
  float u = min(t, 1.0);
  float thin = ${n(F.rayWide[0])} + ${n(F.rayWide[1])} * (1.0 - u) * (1.0 - u) + ${n(F.raySoft)} * u;
  float wide = max(thin, fine);
  return exp(-across * across / (wide * wide)) * exp(-2.6 * t) * (1.0 - smoothstep(0.6, 1.2, t)) * end.y * (0.5 + 0.5 * away) * (thin / wide);
}
void main() {
  // the least width a ray can have and still be carried by the pixels: read before anything is discarded
  float fine = 0.55 * max(length(dFdx(vFl)), length(dFdy(vFl)));
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float lit = uFlareSun.w * vFlGain;
  if (lit <= 0.0) discard;
  vec2 p = vFl;
  float r = length(p);
  vec2 q = vec2(dot(p, vFlOut), dot(p, vec2(-vFlOut.y, vFlOut.x)));
  float edge = 1.0 - smoothstep(0.62, 1.0, r);
  // the core: the light itself, mirrored small; across the limb the sphere squeezes it
  float core = exp(-(q.x * q.x / ${n(F.coreAcross * F.coreAcross)} + q.y * q.y / ${n(F.coreAlong * F.coreAlong)}));
  // the glass beside it takes the light along the limb
  float arc = exp(-q.x * q.x / 0.0009) * exp(-q.y * q.y / 0.09);
  float halo = exp(-r * r / ${n(F.haloWide * F.haloWide)}) + ${n(F.veil)} * exp(-r / 0.34);
  float glow = exp(-r / ${n(F.glowWide)});
  float bloom = exp(-r * r / ${n(F.bloomWide * F.bloomWide)});
  // the rays: fine tapered lines through the core, each end with its own length and strength, breathing a little. They
  // are written out one by one with their numbers, and only drawn where the longest of them can reach
  float star = 0.0;
  if (r < ${n(FLARE_REACH)}) {
    vec3 breathe = 1.0 + ${n(F.breath)} * sin(uSummer.x * vec3(0.9, 1.5, 2.1) + vec3(0.0, 2.1, 4.2));
${FLARE_RAYS.map((ray, i) => `    star += flRay(p, vec2(${n(Math.cos(ray.a))}, ${n(Math.sin(ray.a))}), vec4(${ray.ends.map(n).join(', ')}), breathe.${'xyz'[i % 3]}, fine);`).join('\n')}
  }
  vec3 col = ${vec(F.hot)} * (${n(F.core)} * core) + ${vec(F.warm)} * (${n(F.bloom)} * bloom + ${n(F.glow)} * glow + ${n(F.rays)} * star + ${n(F.arc)} * arc) + ${vec(F.amber)} * (${n(F.halo)} * halo);
  gl_FragColor = vec4(col * (lit * edge), 0.0);
}`

const W = look.wall
// The wall's light is drawn three times: behind the miniature all of it but the glare, in front of the miniature the
// glare alone (`front`), so the burn low on the far side lies over the turf and the fence as light on glass does, and
// last, over the shell, the band of fine lines inside the outline alone (`rim`)
const wallText = (front: boolean, rim = false): string => `
uniform vec4 uFlareSun;
uniform vec4 uSummer;
uniform float uSummerAir;
varying vec2 vWl;
varying vec2 vWlDir;
// one streak of light in the glass: thin across the radius, as long as span (1 - the cosine of half its length) along the
// arc about the bearing u, thinner and fainter toward its ends and broken along its length. f: where in the radius, its
// half width, how far it leans across the arc, its own seed
float wlStreak(vec2 e, float r, vec2 u, float span, vec4 f) {
  float along = (1.0 - dot(e, u)) / span;
  if (along >= 1.0) return 0.0;
  float side = e.x * u.y - e.y * u.x;
  float off = r - f.x - f.z * side;
  float wide = f.y * (1.0 - 0.5 * along);
  float broken = mix(${n(1 - W.glintBroken)}, 1.0, smoothstep(0.38, 0.56, stageNoise(vec3(side * 17.0 + f.w, f.w * 1.9, 4.2))));
  return exp(-off * off / (wide * wide)) * (1.0 - along) * (1.0 - along) * broken;
}
// one broad band of reflection in the glass. f: where in the radius, half its thickness. It is thickest and brightest at
// its middle and thins to a point at both ends
float wlArc(vec2 e, float r, vec2 u, float span, vec2 f) {
  float along = (1.0 - dot(e, u)) / span;
  if (along >= 1.0) return 0.0;
  float off = r - f.x;
  float wide = f.y * (1.0 - 0.7 * along);
  return exp(-off * off / (wide * wide)) * (1.0 - along) * (1.0 - along);
}
// one broad smooth band of the room's lit wall in the glass. f: where in the radius, half its thickness, its lean. It
// is flat across its middle, ends softly and narrows fast toward its two ends
float wlSheen(vec2 e, float r, vec2 u, float span, vec3 f) {
  float along = (1.0 - dot(e, u)) / span;
  if (along >= 1.0) return 0.0;
  float off = r - f.x - f.z * (e.x * u.y - e.y * u.x);
  float wide = f.y * max(1.0 - 1.5 * along, 0.05);
  float q = off * off / (wide * wide);
  return exp(-q * q) * (1.0 - along) * (1.0 - along);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float lit = min(uFlareSun.w, 1.0);
  float storm = uSummer.w;
  if (lit <= 0.0) discard;
  float r = length(vWl);
  if (r > 1.24) discard;
  vec2 e = vWl / max(r, 1e-4);
${rim ? `  // the glass's thickness, drawn over the glass and nothing else of the wall with it
  if (r > 1.0 || r < ${n(W.rimAt[0])}) discard;
  float rimFoot = smoothstep(${n(W.rimFoot[0])}, ${n(W.rimFoot[1])}, e.y);
  if (rimFoot <= 0.0) discard;
  float rimBand = smoothstep(${n(W.rimAt[0])}, ${n(W.rimAt[1])}, r) * (1.0 - smoothstep(${n(W.rimAt[2])}, ${n(W.rimAt[3])}, r));
  float fine = smoothstep(0.44, 0.7, stageNoise(vec3(r * ${n(W.rimLines)} + 11.0, e * ${n(W.rimLong)})));
  float rimLeft = 1.0 - smoothstep(-0.6, 0.1, e.x);
  float rimRight = smoothstep(0.1, 0.6, e.x);
  float rimUp = smoothstep(${n(W.rimTopAt[1])}, ${n(W.rimTopAt[2])}, dot(e, vec2(${n(Math.cos(W.rimTopAt[0] * RAD))}, ${n(Math.sin(W.rimTopAt[0] * RAD))})));
  float rimSh = smoothstep(${n(W.rimShoulderAt[1])}, ${n(W.rimShoulderAt[2])}, dot(e, vec2(${n(Math.cos(W.rimShoulderAt[0] * RAD))}, ${n(Math.sin(W.rimShoulderAt[0] * RAD))})));
  vec3 rimHue = mix(mix(${vec(W.rimLeft)} * rimLeft + ${vec(W.rimRight)} * rimRight, ${vec(W.rimTop)}, rimUp), ${vec(W.rimShoulder)}, rimSh);
  float rimOver = rimUp * (1.0 - rimSh);
  float rimOff = (r - mix(${n(W.rimLine[0])}, ${n(W.rimTopLine[0])}, rimOver)) / mix(${n(W.rimLine[1])}, ${n(W.rimTopLine[1])}, rimOver);
  float rimIn = (r - ${n(W.rimInner[0])}) / ${n(W.rimInner[1])};
  float rimWide = mix(mix(${n(W.rimBandBy[0])} * rimLeft + ${n(W.rimBandBy[1])} * rimRight, ${n(W.rimBandBy[2])}, rimUp), ${n(W.rimBandBy[3])}, rimSh);
  float rimThin = mix(mix(${n(W.rimLineBy[0])} * rimLeft + ${n(W.rimLineBy[1])} * rimRight, ${n(W.rimLineBy[2])}, rimUp), ${n(W.rimLineBy[3])}, rimSh);
  float rimLight = rimBand * (${n(W.rimBare)} + ${n(1 - W.rimBare)} * fine) * rimWide + ${n(W.rimLine[2])} * exp(-rimOff * rimOff) * rimThin;
  vec3 rimGlow = rimHue * rimLight + ${vec(W.rimInnerColor)} * (${n(W.rimInner[2])} * exp(-rimIn * rimIn) * rimLeft * (0.15 + 0.85 * fine));
  gl_FragColor = vec4(rimGlow * (${n(W.rim)} * rimFoot * lit), 0.0);
  return;
` : ''}  // where up the limb: the angle from the wall's middle. At the very middle of the globe there is none to take
  vec2 swung = vec2(e.x * vWlDir.y - e.y * vWlDir.x, dot(e, vWlDir));
  float a = dot(swung, swung) > 0.0 ? atan(swung.x, swung.y) : 0.0;
  float inside = 1.0 - smoothstep(0.965, 0.993, r);
  // the crescent: thin toward the middle of the globe, full just inside the limb, gone at the limb itself
  float band = pow(smoothstep(${n(W.from)}, ${n(W.peak)}, r), 2.2) * (1.0 - smoothstep(0.955, 0.992, r)) * exp(-a * a / ${n(W.wide * W.wide)});
  // the hot patch: a burn against the limb, white at its middle, falling off through gold into the liquid's amber glow.
  // Above it the wall parts the light into a sheaf of slanted strokes that climbs the limb and thins out
  float dr = r - ${n(W.hotAt[0])};
  float da = a - ${n(W.hotAt[1])};
${front ? `  if (r > 1.0 || ((dr < ${n(-2.8 * W.glowSize[0])} || abs(da) > ${n(2.8 * W.glowSize[1])}) && (abs(r - ${n(W.edgeIn[0])}) > ${n(2.5 * W.edgeIn[1])} || abs(a - ${n(W.edgeAt[0])}) > ${n(2.2 * W.edgeAt[1])}))) discard;` : ''}
  float tall = da > 0.0 ? ${n(W.hotSize[2])} : ${n(W.hotSize[1])};
  float brush = stageNoise(vec3((r - ${n(W.brushLean)} * a) * ${n(W.brush)}, a * 3.0, 1.3));
  float stroked = smoothstep(0.4, 0.56, brush);
  float ragged = ${n(1 - W.brushDeep[0])} + ${n(W.brushDeep[0])} * stroked;
  float flame = ${n(W.hotSize[0])} * mix(${n(W.hotFlame[0])}, ${n(W.hotFlame[1])}, smoothstep(${n(-W.hotSize[1])}, ${n(W.hotSize[2])}, da));
  float burnt = dr * dr / (flame * flame) + da * da / (tall * tall);
  float hot = exp(-pow(max(burnt, 0.0), ${n(W.hotEdge)})) * mix(1.0, ragged, smoothstep(0.12, 0.75, burnt));
  float sheafAt = r - ${n(W.hotAt[0] + 0.012)} - 0.05 * da;
  float sheaf = exp(-sheafAt * sheafAt / ${n(W.brushWide * W.brushWide)}) * smoothstep(-0.02, 0.12, da) * exp(-max(da, 0.0) / ${n(W.brushTall)});
  hot += ${n(W.brushGain)} * sheaf * smoothstep(0.52, 0.66, brush);
  float glow = exp(-dr * dr / ${n(W.glowSize[0] * W.glowSize[0])} - da * da / ${n(W.glowSize[1] * W.glowSize[1])}) * (${n(1 - W.brushDeep[1])} + ${n(W.brushDeep[1])} * stroked);
  float edge = exp(-pow(abs((r - ${n(W.edgeIn[0])}) / ${n(W.edgeIn[1])}), 2.0)) * exp(-pow(abs((a - ${n(W.edgeAt[0])}) / ${n(W.edgeAt[1])}), 2.0));
  // in the storm the liquid scatters the sun: the patch is a dull amber glow, not a burn
  float clear = 1.0 - ${n(W.stormDulls)} * storm;
  vec3 glare = ${vec(W.color)} * (${n(W.glow)} * glow * inside * clear) + ${vec(W.hotColor)} * (${n(W.hot)} * hot * inside * clear * clear);
${front ? `  gl_FragColor = vec4((glare + ${vec(W.edgeColor)} * (${n(W.edge * W.edgeFront)} * edge)) * (${n(W.gain)} * lit), 0.0);
  return;` : ''}
  vec3 col = ${vec(W.color)} * (${n(W.band)} * band) + ${vec(W.edgeColor)} * (${n(W.edge)} * edge);
  float body = 1.0 - smoothstep(0.86, 0.992, r);
  vec2 across = vec2(-vWlDir.y, vWlDir.x);
  vec2 off = vWl - vWlDir * 0.95 - across * ${n(W.spillAt)};
  vec3 spill = ${vec(W.spillColor)} * (${n(W.spill)} * exp(-dot(off, off) / 0.022) * lit);
  float toward = 0.5 + 0.5 * dot(vWl, vWlDir);
  vec3 air = ${vec(W.airColor)} * (${n(W.air)} * smoothstep(0.45, 1.0, toward) * body);
  float column = (vWl.x - ${n(W.hazeAt)}) / ${n(W.hazeWide)};
  float plume = exp(-column * column);
  float still = 1.0 - ${n(W.stormClears)} * storm;
  float rise = max(vWl.y - ${n(W.hazeLow)}, 0.0) / (${n(W.hazeTall * W.hazeSideTall)} + ${n(W.hazeTall * (1 - W.hazeSideTall))} * plume);
  float bank = 1.0 - ${n(W.hazeBanks)} + ${n(2 * W.hazeBanks)} * stageNoise(vec3(vWl / ${n(W.hazeBankSize)}, 3.7));
  vec2 ring = e * min(r * 2.5, 1.0) + 1.5;
  float room = smoothstep(0.4, 0.62, 0.62 * stageNoise(vec3(r * ${n(W.room)} + 7.0, ring * ${n(W.roomLong)})) + 0.38 * stageNoise(vec3(vWl * ${n(W.roomFine)}, 9.1)));
  float above = smoothstep(${n(W.roomFrom[0])}, ${n(W.roomFrom[1])}, vWl.y);
  float shown = mix(1.0, mix(${n(W.roomDark)}, ${n(W.roomLit)}, room), above);
  // the cream veil over the dome and its bodies
  float veil = ${n(W.fill)} * above * (1.0 - smoothstep(${n(W.fillTop[0])}, ${n(W.fillTop[1])}, vWl.y)) * (1.0 - ${n(W.fillLeft[2])} * (1.0 - smoothstep(${n(W.fillLeft[0])}, ${n(W.fillLeft[1])}, vWl.x)));
  float glowing = 0.0;
${W.fillBody.map((b) => `  ${b[5] ? 'veil' : 'glowing'} += ${n(b[4])} * exp(-dot((vWl - vec2(${n(b[0])}, ${n(b[1])})) / vec2(${n(b[2])}, ${n(b[3])}), (vWl - vec2(${n(b[0])}, ${n(b[1])})) / vec2(${n(b[2])}, ${n(b[3])})));`).join('\n')}
  air += (${vec(W.fillColor)} * (veil * mix(1.0, mix(${n(W.fillDark)}, 1.0, room), above)) + ${vec(W.bodyColor)} * (glowing * (1.0 - smoothstep(${n(W.bodyLimb[0])}, ${n(W.bodyLimb[1])}, r)) * mix(1.0, mix(${n(W.bodyDark)}, 1.0, room), above))) * (bank * still * body);
  air += ${vec(W.hazeColor)} * (${n(W.haze)} * still * body * bank * shown * (${n(W.hazeRim)} + ${n(1 - W.hazeRim)} * plume) * exp(-rise * rise * rise));
  air += ${vec(W.hazeColor)} * (${n(W.hazeHigh)} * bank * shown * exp(-max(vWl.y - ${n(W.hazeLow)}, 0.0) / ${n(W.hazeHighTall)}) * mix(${n(W.hazeHighLeft)}, 1.0, smoothstep(-0.8, 0.5, vWl.x)) * still * body);
  vec2 fromDome = vWl - vec2(${n(W.domeAt[0])}, ${n(W.domeAt[1])});
  fromDome.x /= fromDome.x < 0.0 ? ${n(W.domeSize[0])} : ${n(W.domeSize[1])};
  fromDome.y /= ${n(W.domeSize[2])};
  float folds = mix(${n(1 - W.foldDeep)}, ${n(1 + 0.8 * W.foldDeep)}, smoothstep(0.24, 0.54, stageNoise(vec3(r * ${n(W.folds)} + 3.0, ring * ${n(W.foldLong)}))));
  air += ${vec(W.domeColor)} * (${n(W.dome)} * exp(-dot(fromDome, fromDome)) * folds * shown * still * body);
  vec2 fromCore = (vWl - vec2(${n(W.coreAt[0])}, ${n(W.coreAt[1])})) / vec2(${n(W.coreSize[0])}, ${n(W.coreSize[1])});
  air += ${vec(W.coreColor)} * (${n(W.core)} * exp(-dot(fromCore, fromCore)) * still * body);
  air *= 1.0 - ${n(W.topShade[4])} * wlArc(e, r, vec2(${n(Math.cos(W.topShade[0] * RAD))}, ${n(Math.sin(W.topShade[0] * RAD))}), ${n(1 - Math.cos(W.topShade[1] * RAD))}, vec2(${n(W.topShade[2])}, ${n(W.topShade[3])}));
  air *= uSummerAir;
  // the glass's own reflections: broad curved bands across the top and down the right shoulder
  vec3 reflex = vec3(0.0);
${W.reflex.map((b) => `  reflex += ${vec(b[5] === 2 ? W.reflexDeep : b[5] ? W.reflexCool : W.reflexWarm)} * (${n(b[4])} * wlArc(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec2(${n(b[2])}, ${n(b[3])})));`).join('\n')}
  if (reflex.r > 0.0) reflex *= ${n(1 - W.reflexLined)} + ${n(2 * W.reflexLined)} * smoothstep(0.25, 0.75, stageNoise(vec3(r * ${n(W.reflexLines)}, e * ${n(W.reflexLong)})));
${W.sheen.map((b) => `  reflex += ${vec(W.sheenColor)} * (${n(b[4])} * wlSheen(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec3(${n(b[2])}, ${n(b[3])}, ${n(b[5])})));`).join('\n')}
  air += reflex * (inside * (still + ${n(W.reflexStorm)} * storm));
  // the light on the glass: a few thin streaks along the arc
  vec3 glints = vec3(0.0);
${W.glint.map((b, i) => `  glints += ${vec(b[6] ? W.glintCool : W.glintWarm)} * (${n(b[5])} * wlStreak(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec4(${n(b[2])}, ${n(b[3])}, ${n(b[4])}, ${n(3.7 * i + 1.3)})));`).join('\n')}
  air += glints * (${n(W.glints)} * inside * still);
  gl_FragColor = vec4(col * (${n(W.gain)} * lit) + air * lit + spill, 0.0);
}`
const WALL = wallText(false)
const WALL_FRONT = wallText(true)
const WALL_RIM = wallText(true, true)

const P = look.pool
const POOL = `
uniform vec4 uSummer;
uniform vec4 uPoolAt;
uniform vec3 uPoolFoot;
// Light through water: three sheets of cells laid across one another, each finer than the last. The light gathers where the
// cells of all three end, broad where the sheets run together and bright where they cross, as on the floor of a pool in the
// sun. z slides the sheets through one another, which is the water moving.
float poolWater(vec2 p, float z) {
  mat3 m = mat3(-2.0, -1.0, 2.0, 3.0, -2.0, 1.0, 1.0, 2.0, 2.0);
  vec3 a = vec3(p, z) * m;
  vec3 b = a * m * 0.4;
  vec3 c = b * m * 0.3;
  return min(min(length(0.5 - fract(a)), length(0.5 - fract(b))), length(0.5 - fract(c)));
}
// one broad band of the water's light: part of a circle round c with the radius q, its middle at the bearing at and
// span radians long to either side, wide its half width. It is thickest and brightest at its middle and thins and fades
// to both ends
float poolBand(vec2 h, vec2 c, float q, float at, float span, float wide) {
  vec2 v = h - c;
  float phi = dot(v, v) > 0.0 ? atan(v.y, v.x) : 0.0;
  float turn = abs(mod(phi - at + 3.14159265, 6.2831853) - 3.14159265) / span;
  if (turn >= 1.0) return 0.0;
  float ends = 1.0 - turn * turn;
  float off = (length(v) - q) / (wide * (0.4 + 0.6 * ends));
  return exp(-off * off) * ends * ends;
}
void main() {
  vec2 d = vStageWorld.xz - uPoolAt.xy;
  // The sun is low and comes from behind the globe: what the globe throws on the slab is drawn out toward the front. h is
  // the pool's own plane, in millimetres across and in stretched millimetres toward the front.
  vec2 h = vec2(d.x, d.y * ${n(1 / P.stretch)});
  // how far h moves from one pixel to the next: read before anything is discarded
  vec2 hx = dFdx(h);
  vec2 hy = dFdy(h);
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float there = uSummer.z;
  if (there <= 0.0) discard;
  // the pool swells as it comes: small at first, whole when it is all there
  float grown = ${n(P.small)} + ${n(1 - P.small)} * min(there, 1.0);
  h /= grown;
  float len = length(h);
  if (len > ${n(P.softMm * 3.2)}) discard;
  vec2 fromMiddle = h - vec2(${n(P.at[0])}, ${n(P.at[1])});
  float soft = exp(-dot(fromMiddle, fromMiddle) / ${n(P.softMm * P.softMm)});
  vec2 fromNear = h - vec2(${n(P.nearAt[0])}, ${n(P.nearAt[1])});
  float near = exp(-dot(fromNear, fromNear) / ${n(P.nearMm * P.nearMm)});
  float core = exp(-len * len / ${n(P.coreMm * P.coreMm)});
  float glow = exp(-len / ${n(P.glowMm)});
  // the liquid's swing after the landing and its breath at rest move the water's cells and slide the bands
  float sway = uSummer.y;
  float breath = uPoolFoot.z;
  float z = ${n(P.drift)} * sway + breath;
  float wide = poolWater(h / ${n(P.cellMm)} + 3.1, 0.6 * z + 0.37);
  float sheet = min(2.5 * wide * wide, 1.0);
  float bands = 0.0;
${P.band.map((b, i) => `  bands += ${n(b[6])} * poolBand(h, vec2(${n(b[0])}, ${n(b[1])}), ${n(b[2])} * (1.0 + ${n(i % 2 ? -0.5 : 0.5)} * breath) + ${n(b[7])} * sway, ${n(b[3] * RAD)} + ${n(i % 2 ? -0.1 : 0.1)} * sway, ${n(b[4] * RAD)}, ${n(b[5])});`).join('\n')}
  bands *= ${n(1 - P.bandMottle)} + ${n(P.bandMottle)} * sheet;
  float pool = (${n(P.gain)} * soft + ${n(P.near)} * near) * (${n(1 - P.mottle)} + ${n(P.mottle)} * sheet);
  // the bands lie in the pool and go out with it at its rim
  float lines = ${n(P.bands)} * bands * (0.2 + 0.8 * min(soft + near, 1.0));
${Number(P.grains) > 0 ? `  vec2 cell = floor(h / ${n(P.grainCellMm)});
  vec2 grainAt = (cell + 0.25 + 0.5 * vec2(stageHash(vec3(cell + 4096.0, 0.31)), stageHash(vec3(cell + 4096.0, 0.57)))) * ${n(P.grainCellMm)};
  float grainWide = max(${n(P.grainMm)}, 0.6 * max(length(hx), length(hy)));
  float chance = stageHash(vec3(cell + 4096.0, 0.83));
  float sparks = ${n(P.grains)} * exp(-dot(h - grainAt, h - grainAt) / (grainWide * grainWide)) * (${n(P.grainMm)} / grainWide) * smoothstep(0.86, 1.0, chance) * min(2.5 * bands, 1.0) * smoothstep(2.0, 12.0, len);` : '  float sparks = 0.0;'}
  vec3 col = ${vec(P.amber)} * pool + mix(${vec(P.pale)}, ${vec(P.gold)}, smoothstep(${n(0.3 * P.softMm)}, ${n(1.4 * P.softMm)}, len)) * lines + ${vec(P.pale)} * (${n(P.core)} * core + ${n(P.glow)} * glow + sparks);
  gl_FragColor = vec4(col * there, 0.0);
}`

const S = look.seat
const SEAT = `
varying float vSeatY;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float dark = ${n(S.dark)} * (1.0 - smoothstep(${n(S.full)}, ${n(S.top)}, vSeatY));
  gl_FragColor = vec4(vec3(1.0 - dark), 1.0);
}`

const added = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const

function makeFlare(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uFlareSun: uniforms.uFlareSun, uSummer: uniforms.uSummer },
    vertexPars: 'uniform vec4 uFlareSun;\nvarying vec2 vFl;\nvarying vec2 vFlOut;\nvarying float vFlGain;',
    vertexMain: `
vec3 flV = normalize(cameraPosition - uLensCentre);
vec3 flH = normalize(flV + uFlareSun.xyz);
vec3 flP = uLensCentre + flH * ${n(RS + 0.6)};
vec4 flC = viewMatrix * vec4(uLensCentre, 1.0);
vec4 flAt = viewMatrix * vec4(flP, 1.0);
vec2 flOut = flAt.xy - flC.xy;
vFlOut = flOut / max(length(flOut), 1e-4);
vFl = position.xy;
// a mirror at a grazing angle returns far more of the light than one seen face on
float flCos = clamp(dot(flH, flV), 0.0, 1.0);
vFlGain = clamp((0.04 + 0.96 * pow(abs(1.0 - flCos), 5.0)) / 0.2, 0.25, 1.6);
flAt.xy += position.xy * ${n(F.halfMm)};
gl_Position = projectionMatrix * flAt;
vStageWorld = flP;
vStageLocal = (uGlobeInv * vec4(flP, 1.0)).xyz;
vStagePlaced = flP;
vStageAux = vec3(0.0, -flAt.z, length(flAt.xyz));`,
    fragment: FLARE,
    params: { ...added, depthTest: false },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)
  mesh.renderOrder = 14
  mesh.frustumCulled = false
  return mesh
}

function makeWall(front: boolean, rim = false): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uFlareSun: uniforms.uFlareSun, uSummer: uniforms.uSummer, uSummerAir: uniforms.uSummerAir },
    vertexPars: 'uniform vec4 uFlareSun;\nvarying vec2 vWl;\nvarying vec2 vWlDir;',
    vertexMain: `
vec4 wlC = viewMatrix * vec4(uLensCentre, 1.0);
vec3 wlSun = (viewMatrix * vec4(uFlareSun.xyz, 0.0)).xyz;
// the side of the limb away from the sun, a little below the middle
vWlDir = normalize(vec2(wlSun.x < 0.0 ? 1.0 : -1.0, -${n(W.low)}));
// the limb of a sphere seen from near is a little wider than its radius
float wlR = ${n(RS)} / sqrt(max(1.0 - ${n(RS * RS)} / dot(wlC.xyz, wlC.xyz), 0.5));
vWl = position.xy * 1.25;
vec4 wlAt = wlC;
wlAt.xy += vWl * wlR;
gl_Position = projectionMatrix * wlAt;
vStageWorld = uLensCentre;
vStageLocal = (uGlobeInv * vec4(uLensCentre, 1.0)).xyz;
vStagePlaced = uLensCentre;
vStageAux = vec3(0.0, -wlAt.z, length(wlAt.xyz));`,
    fragment: rim ? WALL_RIM : front ? WALL_FRONT : WALL,
    params: rim ? { ...added, depthTest: false } : { ...added, transparent: false, depthTest: false },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)
  mesh.renderOrder = front ? 13 : -0.25
  mesh.frustumCulled = false
  return mesh
}

function makePool(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uSummer: uniforms.uSummer, uPoolAt: uniforms.uPoolAt, uPoolFoot: uniforms.uPoolFoot },
    fragment: POOL,
    params: { ...added },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), m)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.3
  mesh.renderOrder = 1
  mesh.frustumCulled = false
  return mesh
}

let flare: THREE.Object3D | undefined
let pool: THREE.Mesh | undefined

/** What the season puts on the glass: the flare and the light on the far wall. It rides in the globe's group and places itself from the eye and the light. */
// The seat's band: a strip of the sphere just outside the glass, drawn after the glass and its ring and multiplied into what
// is there, so everything seen through the foot of the glass is in shade. The base's crest stands in front of its lower part
function makeSeat(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    vertexPars: 'varying float vSeatY;',
    vertexMain: `vSeatY = position.y + ${n(centreHeightMm)};`,
    fragment: SEAT,
    params: {
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    },
  })
  const radius = RS + S.proud
  const from = Math.acos((S.top - centreHeightMm) / radius)
  const to = Math.acos((S.foot - centreHeightMm) / radius)
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 6, 0, 2 * Math.PI, from, to - from), m)
  mesh.renderOrder = 12.5
  return mesh
}
export function dressing(): THREE.Object3D {
  if (!flare) {
    flare = new THREE.Group()
    flare.add(makeWall(false), makeSeat(), makeWall(true), makeWall(true, true), makeFlare())
  }
  return flare
}

/** The pool of light on the slab. It lies in the floor's group: `slab.ts` adds it to what it lays on the surface. */
export function surfacePool(): THREE.Object3D {
  pool ??= makePool()
  return pool
}

export async function prepare(): Promise<void> {}

const smooth = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v))

/** How far the light is kindled, by the time since the landing: 0 on the landing frame, over 1 for a moment, then 1. */
export function kindled(sinceLanding: number): number {
  if (!(sinceLanding < Infinity)) return 1
  const t = Math.max(0, sinceLanding)
  return smooth(t / F.kindleSeconds) * (1 + F.flash * Math.exp(-t / F.flashSeconds) * smooth(t / (0.5 * F.kindleSeconds)))
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  const swap = config.shake.swapWindow
  const shaking = moment.beat !== null && moment.beat >= swap.fromBeat
  const two = f.from !== f.to && f.change > 0 && f.change < 1
  // Inside the swap window the light goes with the dressing; after it the globe is in the hand, turning, and the light does
  // not hold on the glass until the landing kindles it.
  let lit = kindled(moment.sinceLanding)
  if (two) lit = shaking && moment.arrived < 1 ? 0 : 1 - smooth(f.change / 0.6)
  else if (shaking) {
    const through = (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat)
    lit = through >= 1 ? 0 : 1 - partChange('base', through)
  }
  // Leaving: the liquid floods before the window opens, and a ball of milk throws no sun. The flare, the hot patch and the pool
  // go out over most of a beat before the swap, so nothing of summer's light is left on the glass or the table when the outside
  // changes; the change never has to cut them.
  const leaving = f.from.veil === veil && f.to.veil !== veil
  if (moment.beat !== null && (leaving || f.from === f.to)) lit = Math.min(lit, 1 - smooth((moment.beat - (swap.fromBeat - look.leaveBeats[0])) / (look.leaveBeats[0] - look.leaveBeats[1])))
  const key = rig.key.from
  const sun = uniforms.uFlareSun.value
  const len = Math.hypot(key[0], key[1] - 70, key[2]) || 1
  sun.set(key[0] / len, (key[1] - 70) / len, key[2] / len, lit)

  // The pool follows the globe: its middle lies down the light's way from the foot, further when the globe is lifted (the sun
  // is low), and it leans with the globe's tilt. After the landing it swings to rest with the liquid.
  const g = f.globe
  const flat = Math.hypot(key[0], key[2]) || 1
  const wx = -key[0] / flat
  const wz = -key[2] / flat
  const t = moment.sinceLanding < Infinity ? Math.max(0, moment.sinceLanding) : 1e3
  const swing = shaking || two ? 0 : Math.exp(-t / P.swingSeconds) * Math.sin(TAU * P.swingHz * t)
  const reach = P.reachMm + g.y * P.liftPerMm
  const leanX = -Math.sin(g.tiltZ) * P.tiltMm
  const leanZ = Math.sin(g.tiltX) * P.tiltMm
  uniforms.uPoolAt.value.set(g.x + wx * reach + wz * P.sideMm + leanX, g.z + wz * reach - wx * P.sideMm + leanZ, wx, wz)
  uniforms.uPoolFoot.value.set(g.x, g.z, P.breath * Math.sin(TAU * P.breathCycles * ((((moment.time / moment.period) % 1) + 1) % 1)))
  const held = Math.min(1, Math.max(0, g.y / config.shake.liftMm))
  // a globe in the hand throws no pool: it comes after the landing, swelling, and it goes as the globe is lifted
  const there = lit * (1 - smooth(held)) * (shaking || two ? 0 : smooth(t / P.swellSeconds))
  // the storm goes with the liquid: none in still water, whole when it churns
  const kept = holdStorm(moment)
  // and it hands over with the veil: leaving, it thins as the next season's veil takes the liquid, never in a cut
  const gale = Math.max(smooth((f.turbulence - W.stormFrom) / (W.stormTo - W.stormFrom)) * (leaving ? 1 - f.mix.veil : 1), kept)
  uniforms.uSummer.value.set(moment.time, P.swing * swing + 8 * (Math.sin(g.tiltZ) - Math.sin(g.tiltX)), there, gale)
  uniforms.uSummerAir.value = f.air ? 1 : 0
}
