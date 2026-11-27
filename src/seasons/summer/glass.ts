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
//    right shoulder, at the limb. It is a white patch on the outline, drawn out along it, with the soft bloom and the
//    warm glow a wide open lens draws round it: no rays and no streak. It kindles on the landing.
// 2. The pool: the same light focused by the globe onto the slab, in front of the globe and to its left, inside the globe's own
//    shadow: a soft pool of warm light, brightest at a knot by the foot, and inside it a few broad curved bands of the water's
//    light, soft edged and never a net or a star. There is no pool before the landing; after it the pool swells, its bands
//    slide into place and come to rest, and they breathe a little while the water is still.
// 3. The wall: the sun, bent by the globe, burns a patch on the inside of the glass low on the far side, a tongue of light
//    that stands on the limb. The same billboard carries the warm haze of the liquid at rest, which lies low and behind
//    the miniature; above the roof line it is no more than a thin even veil, so the dark room reads through the whole
//    upper half of the glass. And it carries the glass's own reflections: one cream ribbon under the top, cool bands
//    down the right shoulder, and at the upper left the ribbon's broad end, the clear dark past it, one dash and a few
//    short strokes, no two alike. None of it grows brighter with the storm, which is the air's: the still air's light gives way to it (by the
//    liquid's turbulence). It is drawn with the interior, straight after the view through the liquid and before the
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
    // the core: white hot, a patch on the outline, drawn out along it and bent with it; how strong, and its size across
    // the outline and along it (in the quad's half width, as every length of the flare is). On the approved picture the
    // white lies 0.13 of the radius along the rim and 0.035 of it across
    core: 12,
    coreAcross: 0.035,
    coreAlong: 0.18,
    // the mirror's own place for the sun lies a hair inside the outline: the glint is pushed out along the radius by this
    // share of it, so that its middle lies on the outline and the bloom sits on the rim
    rimOut: 0.012,
    // the bloom of the lens round the patch: soft, nearly white, brightest on the rim, and a little longer along the
    // outline than across it, since the patch it blooms from is long (`bloom`, and the lengths it falls to a third in,
    // across the outline and along it); round it the warm glow, its tail, which falls off slower and has no edge
    // (`glow`, and its lengths). There are no rays and no streak: the lens is wide open, as the round discs of the
    // room's lights behind the globe say it is, and a wide open lens draws a soft bloom round a patch this bright
    bloom: 4.25,
    bloomAcross: 0.074,
    bloomAlong: 0.088,
    glow: 1.83,
    glowAcross: 0.12,
    glowAlong: 0.164,
    hot: [1, 0.92, 0.72] as const,
    amber: [1, 0.51, 0.27] as const,
    // the landing: the flare is out while the globe is in the hand after the change, catches on the landing frame, overshoots and settles
    kindleSeconds: 0.22,
    flash: 0.55,
    flashSeconds: 0.3,
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
    // the hot patch: the sun, bent by the globe, lands on the inside of the glass low on the far side and burns there.
    // It is a tongue of light that stands on the limb, about a third of a globe radius tall: white at its middle under
    // the clip, falling off through cream into amber, with a hard edge toward the middle of the globe and a soft side
    // toward the outline, which it reaches. `hot` is how strong at its whitest, `hotAt` where the glow round it has
    // its middle (share of the radius, radians up the limb from the wall's middle), and `flameAt` where the tongue has
    // its foot and where its strokes end (radians up the limb); it comes in at the foot between the two shares of its
    // length in `flameFoot`. It is made of strokes that run up along the limb: they run with it at the foot and lean
    // out toward it above `flameBend` (radians up the limb, and how gently they turn), by `flameLean` of a radius to
    // the radian. The light is whitest on the line of `flameCore` (the share of the radius where that line stands at
    // the foot, the share of the length where its middle lies, and how far it reaches across the strokes and along
    // them); round it lies a dimmer body, `flameDim` of it, that reaches `flameBody` far: toward the middle of the
    // globe and toward the outline, down the limb and up it. In the body each stroke is up to `flameLanes` brighter
    // or dimmer than the next, and the bristles within a stroke by `flameFine`, `flameTongues` strokes and
    // `flameNeedles` bristles (the first of its numbers) to a globe radius. Its outer side is whole as far as
    // `flameOut` (share of the radius) and falls off past it as a bell `flameSoft` wide; under the bell a skirt of
    // `flameSkirt` of the light reaches on to the outline and falls to a third in the length given second. Its inner
    // side is an edge, `flameHard` to either side: beside the core's middle it stands `flameIn` further in than the
    // core's line (the first and the second together), above and below it closes on that line to the second alone,
    // over the share of the length given third, so the tongue is broad at its middle and a blade at its tip; it
    // wavers from stroke to stroke by the fourth, from bristle to bristle by the fifth and along its own length by
    // the sixth, `flameFlick` times to the radian. Its upper end is feathered and nothing of it is cut: a stroke that
    // stands at the second share of the radius in `flameTop` or further out runs the whole length, one at the first
    // share ends the third short of it, each stroke ends its own share of the fourth sooner or later and each bristle
    // of the fifth, and where a stroke ends it fades over `flameFray` of the length. Further in a few strokes stand
    // alone (`flameNeedles`: how far in from the inner side they reach, between which shares of the length, how
    // bright beside the tongue's whitest, and how unlike in height). Its colour is `hotColor` where it is whitest and
    // `flameWarm` where it is faint, between the two shares of its whitest in `flameWarmAt`, and toward the outline it
    // goes over to `flameWarm` whatever its strength, between the two shares of the radius in `flameAmber`: the glass
    // wall beside the flame is amber and never milk
    hot: 11,
    hotAt: [0.9, -0.09] as const,
    flameAt: [-0.2, 0.27] as const,
    flameFoot: [-0.02, 0.12] as const,
    flameBend: [0.03, 0.05] as const,
    flameLean: 0.29,
    flameCore: [0.883, 0.36, 0.045, 0.2] as const,
    flameDim: 0.2,
    flameBody: [0.035, 0.12, 0.4, 0.6] as const,
    flameLanes: 1,
    flameFine: 0.7,
    flameTongues: 44,
    flameOut: 0.95,
    flameSoft: 0.05,
    flameSkirt: [0.25, 0.05] as const,
    flameHard: 0.004,
    flameIn: [0.03, 0.02, 0.4, 0.01, 0.008, 0.006] as const,
    flameFlick: 45,
    flameTop: [0.78, 0.9, 0.5, 0.25, 0.3] as const,
    flameFray: 0.3,
    flameNeedles: [120, 0.05, 0.45, 0.8, 0.12, 0.6] as const,
    hotColor: [1, 0.94, 0.76] as const,
    flameWarm: [1, 0.6, 0.3] as const,
    flameWarmAt: [0.15, 0.75] as const,
    flameAmber: [0.925, 0.975] as const,
    // the amber glow of the liquid round the patch: thin and close, so the turf and the fence beside the flame stay clear
    glow: 0.3,
    glowSize: [0.09, 0.2] as const,
    // its spill past the limb: the lens blooms round the patch, outside the glass too
    spill: 0.3,
    spillAt: 0.12,
    spillColor: [1, 0.62, 0.3] as const,
    // the limb's own warm edge on the far side: the glass wall takes the flame's light as one thin bright line just
    // inside the outline, beside the flame and no further. How strong, where up the limb (radians) and how far it runs,
    // where in the radius and how thick
    edge: 4,
    edgeAt: [-0.02, 0.2] as const,
    edgeIn: [0.984, 0.007] as const,
    edgeColor: [1, 0.6, 0.28] as const,
    // and this much of it lies in front, on the glass's outline, so the outline there is warm and not the room's cool line
    edgeFront: 0.3,
    // in the storm the wall's amber lies as it lay before the flame had its shape (where up the limb and how far, where
    // in the radius and how thick, its colour), but none of it past `edgeStormEnds` (share of the radius: all of it inside
    // the first, none outside the second), where the outline stands dark against the storm
    edgeStorm: [0, 0.5, 0.968, 0.012] as const,
    edgeStormColor: [1, 0.5, 0.18] as const,
    edgeStormEnds: [0.97, 0.98] as const,
    // the burn's light in the liquid, behind the miniature: a warm body close round the burn (`air`: how strong, where
    // its middle lies as a share of the radius and in radians up the limb from the wall's middle, how far it reaches
    // toward the middle of the globe and toward the outline, down the limb and up it), and a thinner one that lies
    // over the left side of the ball (`airFar`, the same), which the banks break twice over
    air: [0.45, 0.82, 0, 0.11, 0.2, 0.2, 0.17] as const,
    airColor: [1, 0.62, 0.3] as const,
    airFar: [0.065, 0.82, 0.43, 0.25, 0.3, 0.45, 0.25] as const,
    airFarColor: [1, 0.7, 0.42] as const,
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
    // the haze over the dome: above the roof line the liquid holds very little of the sun, an even thin veil that the
    // seed heads and the fireflies float in, `fill` of it, thin and as warm as the liquid's own light, so that the dark
    // room reads through the whole upper half of the glass as a warm dark and never as a grey one. It has no patches
    // and no folds. Two soft bodies of light lie in it
    // (`fillBody`, each: where, across and up, how wide and how tall in globe radii, how much): one low over the roof
    // at the left, and a faint one right of the crown on the flare's side. None lies over the middle or the upper
    // middle
    fill: 0.03,
    fillColor: [1, 0.5, 0.25] as const,
    fillBody: [
      [-0.3, 0.1, 0.34, 0.15, 0.17],
      [0.55, 0.47, 0.3, 0.26, 0.02],
    ] as const,
    bodyColor: [1, 0.58, 0.34] as const,
    // and a body falls off to the limb: all of it inside the first of these radii, none beyond the second
    bodyLimb: [0.5, 0.92] as const,
    // a faint warm body of light low over the middle, behind the cottage and left of the crown (`domeAt`, globe radii
    // across and up; `domeSize`, how far it reaches to the left, to the right and up or down). It is smooth and it ends
    // below the upper half
    dome: 0.07,
    domeAt: [-0.15, 0.25] as const,
    domeSize: [0.3, 0.35, 0.2] as const,
    domeColor: [1, 0.58, 0.34] as const,
    // behind the tree and the lanterns the liquid is brightest and warmest: a core between the trunk and the right wall
    core: 0.11,
    coreAt: [0.4, -0.12] as const,
    coreSize: [0.38, 0.26] as const,
    coreColor: [1, 0.56, 0.26] as const,
    // the sharp light on the glass inside the right arc beside the flare, where it mirrors the sky: a few thin pale blue
    // streaks that follow the arc just inside the outline. Each: its bearing (degrees from the right, counter clockwise)
    // and half its length along the arc (degrees), where in the radius it lies, half its width, how far it leans across
    // the arc and how strong. `glintBroken` of a streak is gone in the gaps along it
    glints: 2,
    glint: [
      [20, 10, 0.905, 0.005, 0.03, 0.4],
      [26, 7, 0.862, 0.0045, -0.02, 0.35],
      [3, 12, 0.948, 0.0035, 0.015, 0.45],
      [8, 6, 0.81, 0.005, 0.06, 0.2],
    ] as const,
    glintBroken: 0.8,
    glintCool: [0.74, 0.86, 1] as const,
    // the glass's own reflections: curved bands that follow the dome inside the outline. Down the right shoulder one is
    // blue white, where the room's cool light lies in the glass, and one a deep warm brown in the gap by the right limb,
    // where the lamps do; at the upper left a faint cool one lies inside the ribbon's thin end (each: bearing and half
    // length in degrees, where in the radius, half its thickness, how strong, and its colour: 1 cool, 2 deep warm). A
    // band is not smooth: `reflexLined` of it lies in fine lines that run along the arc (`reflexLines` sets how fine
    // they are across the band, `reflexLong` how short along it), so it reads as a reflection in glass and not as mist
    reflex: [
      [34, 28, 0.865, 0.038, 0.46, 1],
      [30, 26, 0.955, 0.022, 0.24, 2],
      [128, 15, 0.885, 0.02, 0.09, 1],
    ] as const,
    reflexCool: [0.9, 0.95, 1] as const,
    reflexDeep: [1, 0.52, 0.25] as const,
    reflexLined: 0.8,
    reflexLines: 55,
    reflexLong: 2.2,
    // the ribbon: the room's lit wall mirrored in the far side of the glass, one cream band with firm edges. It comes in
    // thin under the outline at the upper left, swells and sweeps down across the top and runs out level over the crown
    // toward the right shoulder. `ribbon` is how strong, `ribbonPeak` how much brighter it is where it is broadest (about
    // the bearing given second, radians, over the spread given third). Its upper edge falls slowly from the upper left
    // to an elbow (`ribbonElbow`: the bearing in radians and the share of the radius there, and how much higher it lies
    // a radian further left) and from the elbow on drops fast toward `ribbonLevel` (share of the radius, and over how
    // many radians it falls to a third of the way); the elbow is rounded over `ribbonRound` of the radius. Its lower
    // edge sinks from the first to the second of `ribbonLow` (shares of the radius) about the bearing given third over
    // the spread given fourth, and rises again by the fifth toward the right end. `ribbonEnds`: it comes in between the
    // first two bearings and is gone between the last two (radians), where the rim's own pass takes its thin end on.
    // `ribbonUpper` is half the width of its upper edge right of the elbow and left of it, `ribbonLower` of its lower
    // one: left of the elbow the upper edge is firm and the lower one soft, right of it the other way round. Left of
    // the elbow it is brightest under its upper edge and falls to `ribbonUnder` of that at the lower one; right of it
    // it is brightest low, by `ribbonDeep` more at its lower edge than at its upper one. It is not one flat tone: it
    // lies in broad soft patches along its own length and in a few soft lanes (`ribbonStreaks`: how many of each across
    // it), by `ribbonStreaked` of its light, so it is a smooth reflection bent round the ball and never a brushed one.
    // Under it the glass holds the room's warm dark as one thin brown arc (`under`: how far below the ribbon's
    // lower edge its middle lies, half its thickness, how strong; `underEnds`: it comes in between the first two
    // bearings and is gone between the last two, radians)
    ribbon: 0.16,
    ribbonColor: [1, 0.64, 0.43] as const,
    ribbonPeak: [0.65, 1.6, 0.28] as const,
    ribbonElbow: [1.536, 0.9, 0.058] as const,
    ribbonLevel: [0.73, 0.244] as const,
    ribbonRound: 0.11,
    ribbonLow: [0.925, 0.62, 1.693, 0.75, 0.04] as const,
    ribbonEnds: [0.45, 1, 1.95, 2.25] as const,
    ribbonUpper: [0.03, 0.009] as const,
    ribbonLower: [0.03, 0.06] as const,
    ribbonUnder: 0.75,
    ribbonDeep: 0.8,
    ribbonStreaks: [1.3, 6] as const,
    ribbonStreaked: [0.4, 0.16] as const,
    under: [0.075, 0.02, 0.056] as const,
    underEnds: [0.96, 1.2, 1.95, 2.2] as const,
    underColor: [1, 0.6, 0.38] as const,
    // the glass has thickness: just inside the outline lies a band of fine lines of light that run along the arc, and
    // against the outline one bright line. It is drawn last, over the shell, whose own band there bends the inside and
    // would bend these lines away with it. `rim` is the whole of its strength, `rimAt` where in the radius the band
    // begins, is whole, begins to end and has ended, `rimFoot` where it ends above the base (the height of the bearing:
    // none below the first, all above the second). The lines are hair thin and no two alike: two sets of them, `rimLines`
    // and, down the left limb alone, `rimLinesWide` to a globe radius across the band, which are hair lines that wander
    // (`rimHair`: between which shares of the way to the middle of a line's cell it is drawn, how short the lines are
    // along the arc, and how much of the arc is bare of them), as bright as `rimLinesShare` says of each there,
    // `rimLong` how short along it (the wide ones `rimWideShort` times shorter), and all of them waver by `rimWaver` of
    // a radius along the arc. `rimBare` is how much of the band stays between the lines, at the left, the right, the top
    // and the shoulder. Its colour goes by the bearing: brown down the left limb (`rimLeft`), warm white down the right
    // (`rimRight`), blue white over the top (`rimTop`, about the bearing in `rimTopAt`, degrees, with the cosines
    // between which it comes in) and white at the right shoulder, where the flare sits (`rimShoulder`,
    // `rimShoulderAt`). `rimBandBy` is the band's share at the left, the right, the top and the shoulder, `rimLineBy`
    // the bright line's; `rimLine` is where the line runs, its half width and its strength. Right of the top it lies
    // further in and wider (`rimTopLine`, about the bearing in `rimTopWide` with its cosines), a soft blue white band
    // under the outline; over the top and left of it the line stays thin and at the outline, and the glass under it is
    // dark. On the left a broken cream line marks the band's inner edge (`rimInner`: where, half width, strength).
    // At the upper left the glass mirrors the room's lit wall as the end of the ribbon, which the shell's bend would
    // hide: it is drawn here, from `rimInside` of the radius outward and only within `rimUpLeft` (a bearing and the
    // half angle about it, degrees). `satin` is that end, one broad cream band along the arc: how strong, where in the
    // radius its middle lies, half its width and how soft its two edges are; it comes in between the first two
    // bearings of `satinEnds` and is gone between the last two (radians). It is brighter toward the outline by
    // `satinOuter` and lies in broad soft lanes (`satinLanes`: how many to a globe radius across it, and by how much
    // one is brighter or dimmer than the next), so it is a smooth reflection and never a comb. Past its end the glass
    // is clear and the dark room stands in it: two oblique gaps (`shade`, each: how much of what lies behind it the
    // gap takes, its bearing in degrees at `shadeAt` of the radius, half its width in degrees, and by how many degrees
    // it turns to a globe radius further out), between the shares of the radius in `shadeIn` (none inside the first,
    // whole from the second to the third, none past the fourth). They belong to the still glass and give way to the
    // storm. Between the gaps lies one bright dash that is not along the arc: it has a head, toward the outline, and a
    // tail that runs up and in from it (`dash`: its bearing and half its length in degrees, where in the radius its
    // middle lies, half its width at the head, how far it leans across the arc, how strong). And below the dash a few
    // short strokes, no two alike in length, in place, in strength or in colour (`strokes`, each: its bearing and half
    // its length in degrees, where in the radius, half its width, how far it leans across the arc, how strong, and 1
    // if it is amber, 0 if cream).
    // The glass mirrors the room and not the storm inside it: the rim stands in the storm as it stands at rest, and
    // `reflexStorm` of the reflections comes back of what the storm takes from the still air's light, never more.
    // But where the storm's light fills the ball to the glass, the glass's edge stands against it as a thin dark line
    // down the left: `rimDark` is how much of what lies behind it the line takes at the most, where in the radius it
    // comes in (between the second and the third) and where it ends (between the fourth and the fifth, just outside
    // the outline). It follows the storm and the light, so it is not there at rest, in the hand or through a change
    rim: 1,
    rimAt: [0.925, 0.948, 0.992, 1] as const,
    rimFoot: [-0.55, -0.3] as const,
    rimLines: 120,
    rimLinesWide: 105,
    rimLinesShare: [0.15, 1] as const,
    rimHair: [0.74, 0.95, 5, 0.45] as const,
    rimWideShort: 0.5,
    rimWaver: 0.005,
    rimLong: 2.5,
    rimBare: [0.05, 0.08, 0.08, 0.08] as const,
    rimDark: [0.93, 0.976, 0.988, 1.002, 1.008] as const,
    rimLeft: [0.27, 0.175, 0.11] as const,
    rimTop: [0.16, 0.2, 0.24] as const,
    rimTopAt: [74, 0.6, 0.93] as const,
    rimRight: [0.17, 0.11, 0.065] as const,
    rimShoulder: [0.17, 0.22, 0.3] as const,
    rimShoulderAt: [42, 0.82, 0.978] as const,
    rimBandBy: [0.35, 0.5, 0.08, 1.2] as const,
    rimLine: [0.991, 0.006, 1.8] as const,
    rimLineBy: [0.25, 1, 0.2, 1] as const,
    rimTopLine: [0.975, 0.012] as const,
    rimTopWide: [72, 0.927, 0.99] as const,
    rimInner: [0.94, 0.008, 0.04] as const,
    rimInnerColor: [1, 0.8, 0.62] as const,
    rimInside: 0.84,
    rimUpLeft: [147.5, 45] as const,
    satin: [0.08, 0.895, 0.045, 0.012] as const,
    satinEnds: [1.885, 2.09, 2.36, 2.46] as const,
    satinOuter: 0.3,
    satinLanes: [30, 0.35] as const,
    satinColor: [1, 0.66, 0.5] as const,
    shade: [
      [0.45, 144, 4, 83],
      [0.45, 157, 5, 83],
    ] as const,
    shadeAt: 0.9,
    shadeIn: [0.84, 0.87, 0.935, 0.955] as const,
    dash: [152.5, 4.2, 0.919, 0.0036, -0.46, 0.8] as const,
    dashColor: [1, 0.8, 0.58] as const,
    strokes: [
      [164, 2.6, 0.935, 0.0022, -0.078, 0.585, 1],
      [168.3, 1.2, 0.945, 0.005, 0, 1.04, 0],
      [168.6, 0.8, 0.92, 0.004, 0, 0.65, 0],
      [167.2, 1.3, 0.973, 0.003, 0, 0.65, 1],
    ] as const,
    strokeCream: [1, 0.86, 0.7] as const,
    strokeAmber: [1, 0.62, 0.36] as const,
    // inside the outline the glass mirrors the lit wall a second time, and over the top the sky: thin arcs that hug the
    // rim, no two alike in length or in depth, with clear glass between them (`arcs`, each: its bearing and half its
    // length in degrees, where in the radius, half its width, how far it leans across the arc, how strong, and 1 if it
    // is the sky's blue white, 0 if the wall's cream). They waver along their length as the rim's own lines do, twice
    // as far. Above the flare the sky lies against the outline as one band that fades inward (`rimSky`: the bearing in
    // degrees about which it lies and the cosines between which it comes in, the shares of the radius between which
    // it comes in, and how strong)
    arcs: [
      [132, 15, 0.948, 0.0035, -0.058, 0.4, 0],
      [127, 24, 0.934, 0.0042, -0.02, 0.4, 0],
      [127, 14, 0.92, 0.0036, -0.04, 0.25, 0],
      [130, 6, 0.906, 0.005, 0, 0.2, 0],
      [80, 13, 0.984, 0.003, 0, 0.14, 1],
    ] as const,
    arcCream: [1, 0.64, 0.43] as const,
    arcCool: [0.74, 0.86, 1] as const,
    rimSky: [54, 0.961, 0.99, 0.92, 0.98, 0.2] as const,
    rimSkyColor: [0.9, 0.95, 1] as const,
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
const FLARE = `
uniform vec4 uFlareSun;
varying vec2 vFl;
varying vec2 vFlOut;
varying float vFlGain;
varying float vFlBend;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float lit = uFlareSun.w * vFlGain;
  if (lit <= 0.0) discard;
  vec2 p = vFl;
  float r = length(p);
  vec2 q = vec2(dot(p, vFlOut), dot(p, vec2(-vFlOut.y, vFlOut.x)));
  float edge = 1.0 - smoothstep(0.62, 1.0, r);
  // how far off the outline, which bends away under a patch this long, and how far along it: both squared
  float off = length(vec2(vFlBend + q.x, q.y)) - vFlBend;
  off *= off;
  float along = q.y * q.y;
  // the core: the light itself, mirrored; the sphere squeezes it across the outline and draws it out along it
  float core = exp(-(off / ${n(F.coreAcross * F.coreAcross)} + along / ${n(F.coreAlong * F.coreAlong)}));
  // the lens's bloom round it, brightest on the rim, and the warm glow round that as its tail: no edge, no ray, no streak
  float bloom = exp(-(off / ${n(F.bloomAcross * F.bloomAcross)} + along / ${n(F.bloomAlong * F.bloomAlong)}));
  float glow = exp(-sqrt(off / ${n(F.glowAcross * F.glowAcross)} + along / ${n(F.glowAlong * F.glowAlong)}));
  vec3 col = ${vec(F.hot)} * (${n(F.core)} * core + ${n(F.bloom)} * bloom) + ${vec(F.amber)} * (${n(F.glow)} * glow);
  gl_FragColor = vec4(col * (lit * edge), 0.0);
}`

const W = look.wall
// an arc that lies wholly in the upper left is drawn with the rest of the upper left, any other for the whole rim
const arcUpLeft = (b: readonly number[]): boolean => Math.abs(b[0] - W.rimUpLeft[0]) + b[1] <= W.rimUpLeft[1]
const arcLine = (b: readonly number[]): string =>
  `  rimGlow += ${vec(b[6] ? W.arcCool : W.arcCream)} * (${n(b[5])} * mirrored * wlStroke(e, arcAt, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${(1 - Math.cos(b[1] * RAD)).toFixed(6)}, vec3(${n(b[2])}, ${n(b[3])}, ${n(b[4])})));`
// The wall's light is drawn three times: behind the miniature all of it but the glare, in front of the miniature the
// glare alone (`front`), so the burn low on the far side lies over the turf and the fence as light on glass does, and
// last, over the shell, the band of fine lines inside the outline and the light and the dark of the upper left alone (`rim`). The
// two drawn in front are light on the glass, so whatever stands in front of the glass hides them (the base's crest and
// what lies on it): the sheet they are drawn on runs through the middle of the globe, so each of their pixels writes
// the depth of the glass's own front where its ray meets it, `seat.proud` outside the glass as the seat's band is, and
// is tested against what is already drawn
const wallText = (front: boolean, rim = false): string => `
uniform vec4 uFlareSun;
uniform vec4 uSummer;
uniform float uSummerAir;
varying vec2 vWl;
varying vec2 vWlDir;
varying vec3 vWlMid;
varying vec3 vWlDepth;
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
// one bright dash with a head: brightest and widest near one end and thinning to nothing along its tail. f: where in the
// radius its middle lies, half its width at the head, how far it leans across the arc; lead: which end the head lies
// at, over the sine of half its length
float wlDash(vec2 e, float r, vec2 u, float span, vec3 f, float lead) {
  float along = (1.0 - dot(e, u)) / span;
  if (along >= 1.0) return 0.0;
  float side = e.x * u.y - e.y * u.x;
  float off = r - f.x - f.z * side;
  float head = smoothstep(-1.0, 0.55, side * lead) * (1.0 - smoothstep(0.62, 0.98, side * lead));
  float wide = f.y * (0.3 + 0.7 * head);
  return exp(-off * off / (wide * wide)) * head * head;
}
// one short stroke: thin across the radius, thinner and fainter toward both ends and never broken. f: where in the
// radius, its half width, how far it leans across the arc
float wlStroke(vec2 e, float r, vec2 u, float span, vec3 f) {
  float along = (1.0 - dot(e, u)) / span;
  if (along >= 1.0) return 0.0;
  float off = r - f.x - f.z * (e.x * u.y - e.y * u.x);
  float wide = f.y * (1.0 - 0.6 * along);
  return exp(-off * off / (wide * wide)) * (1.0 - along) * (1.0 - along);
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
${front ? `  // light on the glass: the depth of the glass's own front along this pixel's ray, from the eye. The sheet's edge at
  // r = 1 is the outline of the sphere as the eye sees it, so every ray inside it meets the glass
  if (r > 1.0) discard;
  vec3 wlRay = normalize(vec3(vWlMid.xy + vWl * vWlDepth.z, vWlMid.z));
  float wlNear = dot(wlRay, vWlMid);
  float wlFront = wlNear - sqrt(max(wlNear * wlNear - dot(vWlMid, vWlMid) + ${n((RS + look.seat.proud) * (RS + look.seat.proud))}, 0.0));
  float wlDeep = max(-wlRay.z * wlFront, 1e-3);
  gl_FragDepth = 0.5 + 0.5 * (vWlDepth.x - vWlDepth.y * wlDeep) / wlDeep;
` : ''}${rim ? `  // the glass's thickness, drawn over the glass and nothing else of the wall with it. Inside the band of lines only
  // the upper left has anything to draw: the thin end of the ribbon, the dash and the strokes
  if (r > ${n(W.rimDark[4])} || r < ${n(W.rimInside)}) discard;
  float rimFoot = smoothstep(${n(W.rimFoot[0])}, ${n(W.rimFoot[1])}, e.y);
  if (rimFoot <= 0.0) discard;
  float upLeft = dot(e, vec2(${n(Math.cos(W.rimUpLeft[0] * RAD))}, ${n(Math.sin(W.rimUpLeft[0] * RAD))})) - ${n(Math.cos(W.rimUpLeft[1] * RAD))};
  if (r < ${n(W.rimAt[0])} && upLeft <= 0.0) discard;
  float rimBand = smoothstep(${n(W.rimAt[0])}, ${n(W.rimAt[1])}, r) * (1.0 - smoothstep(${n(W.rimAt[2])}, ${n(W.rimAt[3])}, r));
  float rimWaver = r + ${n(W.rimWaver)} * (stageNoise(vec3(e * 6.0 + 3.0, 2.2)) - 0.5);
  float rimLeft = 1.0 - smoothstep(-0.6, 0.1, e.x);
  float lines = smoothstep(0.5, 0.72, stageNoise(vec3(rimWaver * ${n(W.rimLines)} + 11.0, e * ${n(W.rimLong)})));
  float fine = lines;
  // down the left the lines are hairs that wander: each is drawn where its cell of the wall's grain is half way up
  if (rimLeft > 0.0 && r >= ${n(W.rimAt[0])}) {
    float hair = smoothstep(${n(W.rimHair[0])}, ${n(W.rimHair[1])}, 1.0 - abs(2.0 * stageNoise(vec3(rimWaver * ${n(W.rimLinesWide)} + 37.0, e * ${n(W.rimLong * W.rimWideShort)} + 5.0)) - 1.0)) * smoothstep(${n(W.rimHair[3] - 0.1)}, ${n(W.rimHair[3] + 0.1)}, stageNoise(vec3(e * ${n(W.rimHair[2])} + 9.0, rimWaver * 24.0)));
    fine = mix(fine, max(${n(W.rimLinesShare[0])} * fine, ${n(W.rimLinesShare[1])} * hair), rimLeft);
  }
  float rimRight = smoothstep(0.1, 0.6, e.x);
  float rimUp = smoothstep(${n(W.rimTopAt[1])}, ${n(W.rimTopAt[2])}, dot(e, vec2(${n(Math.cos(W.rimTopAt[0] * RAD))}, ${n(Math.sin(W.rimTopAt[0] * RAD))})));
  float rimSh = smoothstep(${n(W.rimShoulderAt[1])}, ${n(W.rimShoulderAt[2])}, dot(e, vec2(${n(Math.cos(W.rimShoulderAt[0] * RAD))}, ${n(Math.sin(W.rimShoulderAt[0] * RAD))})));
  vec3 rimHue = mix(mix(${vec(W.rimLeft)} * rimLeft + ${vec(W.rimRight)} * rimRight, ${vec(W.rimTop)}, rimUp), ${vec(W.rimShoulder)}, rimSh);
  // right of the top the line lies further in and is wider; over the top and left of it it stays at the outline
  float rimOver = smoothstep(${n(W.rimTopWide[1])}, ${n(W.rimTopWide[2])}, dot(e, vec2(${n(Math.cos(W.rimTopWide[0] * RAD))}, ${n(Math.sin(W.rimTopWide[0] * RAD))}))) * (1.0 - rimSh);
  float rimOff = (r - mix(${n(W.rimLine[0])}, ${n(W.rimTopLine[0])}, rimOver)) / mix(${n(W.rimLine[1])}, ${n(W.rimTopLine[1])}, rimOver);
  float rimIn = (r - ${n(W.rimInner[0])}) / ${n(W.rimInner[1])};
  float rimWide = mix(mix(${n(W.rimBandBy[0])} * rimLeft + ${n(W.rimBandBy[1])} * rimRight, ${n(W.rimBandBy[2])}, rimUp), ${n(W.rimBandBy[3])}, rimSh);
  float rimThin = mix(mix(${n(W.rimLineBy[0])} * rimLeft + ${n(W.rimLineBy[1])} * rimRight, ${n(W.rimLineBy[2])}, rimUp), ${n(W.rimLineBy[3])}, rimSh);
  float rimBare = mix(mix(${n(W.rimBare[0])} * rimLeft + ${n(W.rimBare[1])} * rimRight, ${n(W.rimBare[2])}, rimUp), ${n(W.rimBare[3])}, rimSh);
  float rimLight = rimBand * mix(fine, 1.0, rimBare) * rimWide + ${n(W.rimLine[2])} * exp(-rimOff * rimOff) * rimThin;
  vec3 rimGlow = rimHue * rimLight + ${vec(W.rimInnerColor)} * (${n(W.rimInner[2])} * exp(-rimIn * rimIn) * rimLeft * (0.15 + 0.85 * fine));
  rimGlow *= ${n(W.rim)} * rimFoot;
  // the sky against the outline above the flare, one band that fades inward, and the thin arcs inside the outline
  float mirrored = (1.0 - ${n(W.stormClears - W.reflexStorm)} * storm) * rimFoot;
  float arcAt = 2.0 * rimWaver - r;
  rimGlow += ${vec(W.rimSkyColor)} * (${n(W.rimSky[5])} * smoothstep(${n(W.rimSky[3])}, ${n(W.rimSky[4])}, r) * smoothstep(${n(W.rimSky[1])}, ${n(W.rimSky[2])}, dot(e, vec2(${n(Math.cos(W.rimSky[0] * RAD))}, ${n(Math.sin(W.rimSky[0] * RAD))}))) * mirrored);
${W.arcs.filter((b) => !arcUpLeft(b)).map(arcLine).join('\n')}
  // the upper left: the end of the ribbon as one broad band in soft lanes, the dash and the strokes, and between them
  // the clear dark, which the pass takes out of what lies behind it. The still air's light gives way to the storm, and
  // the reflection less than the glints
  float rimShade = 0.0;
  if (upLeft > 0.0) {
    float calm = 1.0 - ${n(W.stormClears)} * storm;
    float turn = dot(e, e) > 0.0 ? atan(e.y, e.x) : 0.0;
    float satin = (1.0 - smoothstep(-1.0, 1.0, (abs(r - ${n(W.satin[1])}) - ${n(W.satin[2])}) / ${n(W.satin[3])})) * smoothstep(${n(W.satinEnds[0])}, ${n(W.satinEnds[1])}, turn) * (1.0 - smoothstep(${n(W.satinEnds[2])}, ${n(W.satinEnds[3])}, turn));
    if (satin > 0.0) satin *= (${n(1 - W.satinOuter)} + ${n(2 * W.satinOuter)} * smoothstep(${n(W.satin[1] - W.satin[2])}, ${n(W.satin[1] + W.satin[2])}, r)) * (${n(1 - W.satinLanes[1])} + ${n(2 * W.satinLanes[1])} * stageNoise(vec3(r * ${n(W.satinLanes[0])} + 7.0, e * 1.5)));
    rimGlow += ${vec(W.satinColor)} * (${n(W.satin[0])} * satin * (calm + ${n(W.reflexStorm)} * storm));
    float shadeIn = smoothstep(${n(W.shadeIn[0])}, ${n(W.shadeIn[1])}, r) * (1.0 - smoothstep(${n(W.shadeIn[2])}, ${n(W.shadeIn[3])}, r));
${W.shade.map((b) => `    rimShade += ${n(b[0])} * exp(-(turn - ${n(b[1] * RAD)} + ${n(b[3] * RAD)} * (r - ${n(W.shadeAt)})) * (turn - ${n(b[1] * RAD)} + ${n(b[3] * RAD)} * (r - ${n(W.shadeAt)})) / ${(b[2] * RAD * b[2] * RAD).toFixed(6)});`).join('\n')}
    rimShade *= shadeIn * calm * lit;
    float sharp = ${n(W.dash[5])} * wlDash(e, r, vec2(${n(Math.cos(W.dash[0] * RAD))}, ${n(Math.sin(W.dash[0] * RAD))}), ${n(1 - Math.cos(W.dash[1] * RAD))}, vec3(${n(W.dash[2])}, ${n(W.dash[3])}, ${n(W.dash[4])}), ${n(-1 / Math.sin(W.dash[1] * RAD))});
    vec3 strokes = ${vec(W.dashColor)} * sharp;
${W.strokes.map((b) => `    strokes += ${vec(b[6] ? W.strokeAmber : W.strokeCream)} * (${n(b[5])} * wlStroke(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${(1 - Math.cos(b[1] * RAD)).toFixed(6)}, vec3(${n(b[2])}, ${n(b[3])}, ${n(b[4])})));`).join('\n')}
    rimGlow += strokes * calm;
${W.arcs.filter(arcUpLeft).map(arcLine).join('\n')}
  }
  // the landing: against the storm's light the glass's edge is a thin dark line down the left, from the upper left to
  // the foot of the band. It takes a share of what lies behind it, and of the rim's own light there
  float rimDark = ${n(W.rimDark[0])} * storm * lit * smoothstep(${n(W.rimDark[1])}, ${n(W.rimDark[2])}, r) * (1.0 - smoothstep(${n(W.rimDark[3])}, ${n(W.rimDark[4])}, r)) * (1.0 - smoothstep(0.5, 0.92, e.y)) * mix(0.75, 1.0, smoothstep(-0.5, 0.3, e.y)) * (1.0 - smoothstep(-0.6, -0.3, e.x)) * smoothstep(${n(W.rimFoot[0])}, ${n(W.rimFoot[0] + 0.1)}, e.y);
  gl_FragColor = vec4(rimGlow * (lit * step(r, 1.0) * (1.0 - rimDark)), max(rimDark, rimShade));
  return;
` : ''}  // where up the limb: the angle from the wall's middle. At the very middle of the globe there is none to take
  vec2 swung = vec2(e.x * vWlDir.y - e.y * vWlDir.x, dot(e, vWlDir));
  float a = dot(swung, swung) > 0.0 ? atan(swung.x, swung.y) : 0.0;
  float inside = 1.0 - smoothstep(0.965, 0.993, r);
  // the crescent: thin toward the middle of the globe, full just inside the limb, gone at the limb itself
  float band = pow(smoothstep(${n(W.from)}, ${n(W.peak)}, r), 2.2) * (1.0 - smoothstep(0.955, 0.992, r)) * exp(-a * a / ${n(W.wide * W.wide)});
  // the hot patch: a burn against the limb, white at its middle, falling off through gold into the liquid's amber glow
  float dr = r - ${n(W.hotAt[0])};
  float da = a - ${n(W.hotAt[1])};
${front ? `  if (r > 1.0 || ((dr < ${n(-2.8 * W.glowSize[0])} || abs(da) > ${n(Math.max(2.8 * W.glowSize[1], W.flameAt[1] - W.hotAt[1] + 0.75 * (W.flameFray + W.flameTop[3] + W.flameTop[4]) * (W.flameAt[1] - W.flameAt[0])))}) && (r < ${n(Math.min(W.edgeStorm[2] - 2.5 * W.edgeStorm[3], W.edgeIn[0] - 2.5 * W.edgeIn[1]))} || abs(a - ${n(W.edgeStorm[0])}) > ${n(2.2 * W.edgeStorm[1])}))) discard;` : ''}
  // the wall's amber at the limb: at rest one thin bright line beside the flame, in the storm the broad edge it had
  float edgeOff = (r - ${n(W.edgeIn[0])}) / ${n(W.edgeIn[1])};
  float edgeUp = (a - ${n(W.edgeAt[0])}) / ${n(W.edgeAt[1])};
  float stormOff = (r - ${n(W.edgeStorm[2])}) / ${n(W.edgeStorm[3])};
  float stormUp = (a - ${n(W.edgeStorm[0])}) / ${n(W.edgeStorm[1])};
  vec3 edge = ${vec(W.edgeColor)} * (exp(-edgeOff * edgeOff - edgeUp * edgeUp) * (1.0 - storm)) + ${vec(W.edgeStormColor)} * (exp(-stormOff * stormOff - stormUp * stormUp) * (1.0 - smoothstep(${n(W.edgeStormEnds[0])}, ${n(W.edgeStormEnds[1])}, r)) * storm);
${front ? `  // the flame: a tongue of light that stands on the limb. along runs up it, 0 at its foot and 1 where its strokes
  // end; lane names a stroke by where in the radius it stands at the foot: the strokes run with the limb there and lean
  // out toward it above the bend
  float along = (a - ${n(W.flameAt[0])}) / ${n(W.flameAt[1] - W.flameAt[0])};
  float climb = a - ${n(W.flameBend[0])};
  float lane = r - ${n(0.5 * W.flameLean)} * (climb + sqrt(climb * climb + ${(W.flameBend[1] * W.flameBend[1]).toFixed(6)}));
  float tongue = stageNoise(vec3(lane * ${n(W.flameTongues)} + 5.0, 3.3, 8.1));
  float bristle = stageNoise(vec3(lane * ${n(W.flameNeedles[0])} + 2.0, a * 1.4, 5.5));
  // its upper end is feathered: the strokes beside the outline climb highest, each to its own height, and a stroke
  // fades where it ends: none is cut
  float brief = 1.0 - clamp((lane - ${n(W.flameTop[0])}) / ${n(W.flameTop[1] - W.flameTop[0])}, 0.0, 1.0);
  float ends = 1.0 - smoothstep(0.0, ${n(W.flameFray)}, along - 1.0 + ${n(W.flameTop[2])} * brief * brief - ${n(W.flameTop[3])} * (2.0 * tongue - 1.0) - ${n(W.flameTop[4])} * (2.0 * bristle - 1.0));
  float standing = smoothstep(${n(W.flameFoot[0])}, ${n(W.flameFoot[1])}, along);
  // whitest on the core's line. Its inner side is a hard edge: furthest in beside the core's middle, closing on the
  // core's line above and below, and wavering along its length; its outer side is soft and reaches the outline
  float coreIn = lane - ${n(W.flameCore[0])};
  float coreUp = along - ${n(W.flameCore[1])};
  float innerAt = ${n(W.flameCore[0] - W.flameIn[1])} - ${n(W.flameIn[0])} * exp(-coreUp * coreUp / ${(W.flameIn[2] * W.flameIn[2]).toFixed(6)}) + ${n(W.flameIn[3])} * (2.0 * tongue - 1.0) + ${n(W.flameIn[4])} * (2.0 * bristle - 1.0) + ${n(W.flameIn[5])} * (2.0 * stageNoise(vec3(a * ${n(W.flameFlick)} + 3.0, lane * 6.0, 1.3)) - 1.0);
  float hard = smoothstep(${n(-W.flameHard)}, ${n(W.flameHard)}, lane - innerAt);
  float beyond = max(r - ${n(W.flameOut)}, 0.0);
  float fall = mix(${n(W.flameSkirt[0])} * exp(-beyond / ${n(W.flameSkirt[1])}), 1.0, exp(-beyond * beyond / ${(W.flameSoft * W.flameSoft).toFixed(6)}));
  // round the core a dimmer body, wider toward the outline than toward the middle of the globe and longer up the limb
  // than down it, and in it each stroke and each bristle a little brighter or dimmer than the next
  float mass = exp(-coreIn * coreIn / (coreIn < 0.0 ? ${(W.flameBody[0] * W.flameBody[0]).toFixed(6)} : ${(W.flameBody[1] * W.flameBody[1]).toFixed(6)}) - coreUp * coreUp / (coreUp < 0.0 ? ${(W.flameBody[2] * W.flameBody[2]).toFixed(6)} : ${(W.flameBody[3] * W.flameBody[3]).toFixed(6)}));
  float stroke = (${n(1 - W.flameLanes)} + ${n(2 * W.flameLanes)} * smoothstep(0.38, 0.62, tongue)) * (${n(1 - W.flameFine)} + ${n(2 * W.flameFine)} * bristle);
  float hot = hard * ends * standing * fall * (exp(-coreIn * coreIn / ${(W.flameCore[2] * W.flameCore[2]).toFixed(6)} - coreUp * coreUp / ${(W.flameCore[3] * W.flameCore[3]).toFixed(6)}) + ${n(W.flameDim)} * stroke * mass);
  // further in a few strokes stand alone
  float needle = smoothstep(0.62, 0.7, bristle);
  hot = max(hot, ${n(W.flameNeedles[4])} * needle * tongue * smoothstep(${n(-W.flameNeedles[1])}, ${n(-0.6 * W.flameNeedles[1])}, lane - innerAt) * smoothstep(${n(W.flameNeedles[2])}, ${n(W.flameNeedles[2] + 0.12)}, along) * (1.0 - smoothstep(${n(W.flameNeedles[3] - 0.12)}, ${n(W.flameNeedles[3])}, along + ${n(W.flameNeedles[5])} * (tongue - 0.5))));
  float glow = exp(-dr * dr / ${n(W.glowSize[0] * W.glowSize[0])} - da * da / ${n(W.glowSize[1] * W.glowSize[1])});
  // in the storm the liquid scatters the sun: the patch is a dull amber glow, not a burn
  float clear = 1.0 - ${n(W.stormDulls)} * storm;
  vec3 glare = ${vec(W.color)} * (${n(W.glow)} * glow * inside * clear) + mix(${vec(W.flameWarm)}, ${vec(W.hotColor)}, smoothstep(${n(W.flameWarmAt[0])}, ${n(W.flameWarmAt[1])}, hot) * (1.0 - smoothstep(${n(W.flameAmber[0])}, ${n(W.flameAmber[1])}, r))) * (${n(W.hot)} * hot * inside * clear * clear);
  gl_FragColor = vec4((glare + edge * ${n(W.edge * W.edgeFront)}) * (${n(W.gain)} * lit), 0.0);
  return;` : ''}
  vec3 col = ${vec(W.color)} * (${n(W.band)} * band) + edge * ${n(W.edge)};
  float body = 1.0 - smoothstep(0.86, 0.992, r);
  vec2 across = vec2(-vWlDir.y, vWlDir.x);
  vec2 off = vWl - vWlDir * 0.95 - across * ${n(W.spillAt)};
  vec3 spill = ${vec(W.spillColor)} * (${n(W.spill)} * exp(-dot(off, off) / 0.022) * lit);
  float still = 1.0 - ${n(W.stormClears)} * storm;
  float bank = 1.0 - ${n(W.hazeBanks)} + ${n(2 * W.hazeBanks)} * stageNoise(vec3(vWl / ${n(W.hazeBankSize)}, 3.7));
  // the burn's light in the liquid, behind the miniature: close round the burn, and thinner over the left side of the ball
  float nearIn = (r - ${n(W.air[1])}) / (r < ${n(W.air[1])} ? ${n(W.air[3])} : ${n(W.air[4])});
  float nearUp = (a - ${n(W.air[2])}) / (a < ${n(W.air[2])} ? ${n(W.air[5])} : ${n(W.air[6])});
  float farIn = (r - ${n(W.airFar[1])}) / (r < ${n(W.airFar[1])} ? ${n(W.airFar[3])} : ${n(W.airFar[4])});
  float farUp = (a - ${n(W.airFar[2])}) / (a < ${n(W.airFar[2])} ? ${n(W.airFar[5])} : ${n(W.airFar[6])});
  vec3 air = (${vec(W.airColor)} * (${n(W.air[0])} * exp(-nearIn * nearIn - nearUp * nearUp)) + ${vec(W.airFarColor)} * (${n(W.airFar[0])} * exp(-farIn * farIn - farUp * farUp) * bank * bank)) * (body * still);
  float column = (vWl.x - ${n(W.hazeAt)}) / ${n(W.hazeWide)};
  float plume = exp(-column * column);
  float rise = max(vWl.y - ${n(W.hazeLow)}, 0.0) / (${n(W.hazeTall * W.hazeSideTall)} + ${n(W.hazeTall * (1 - W.hazeSideTall))} * plume);
  // the thin warm veil over the dome, even and without a patch, and the bodies of light that lie in it
  float glowing = 0.0;
${W.fillBody.map((b) => `  glowing += ${n(b[4])} * exp(-dot((vWl - vec2(${n(b[0])}, ${n(b[1])})) / vec2(${n(b[2])}, ${n(b[3])}), (vWl - vec2(${n(b[0])}, ${n(b[1])})) / vec2(${n(b[2])}, ${n(b[3])})));`).join('\n')}
  air += (${vec(W.fillColor)} * (${n(W.fill)} * inside) + ${vec(W.bodyColor)} * (glowing * (1.0 - smoothstep(${n(W.bodyLimb[0])}, ${n(W.bodyLimb[1])}, r)) * bank)) * still;
  air += ${vec(W.hazeColor)} * (${n(W.haze)} * still * body * bank * (${n(W.hazeRim)} + ${n(1 - W.hazeRim)} * plume) * exp(-rise * rise * rise));
  air += ${vec(W.hazeColor)} * (${n(W.hazeHigh)} * bank * exp(-max(vWl.y - ${n(W.hazeLow)}, 0.0) / ${n(W.hazeHighTall)}) * mix(${n(W.hazeHighLeft)}, 1.0, smoothstep(-0.8, 0.5, vWl.x)) * still * body);
  vec2 fromDome = vWl - vec2(${n(W.domeAt[0])}, ${n(W.domeAt[1])});
  fromDome.x /= fromDome.x < 0.0 ? ${n(W.domeSize[0])} : ${n(W.domeSize[1])};
  fromDome.y /= ${n(W.domeSize[2])};
  air += ${vec(W.domeColor)} * (${n(W.dome)} * exp(-dot(fromDome, fromDome)) * still * body);
  vec2 fromCore = (vWl - vec2(${n(W.coreAt[0])}, ${n(W.coreAt[1])})) / vec2(${n(W.coreSize[0])}, ${n(W.coreSize[1])});
  air += ${vec(W.coreColor)} * (${n(W.core)} * exp(-dot(fromCore, fromCore)) * still * body);
  air *= uSummerAir;
  // the glass's own reflections: curved bands down the right shoulder and one inside the ribbon's end
  vec3 reflex = vec3(0.0);
${W.reflex.map((b) => `  reflex += ${vec(b[5] === 2 ? W.reflexDeep : W.reflexCool)} * (${n(b[4])} * wlArc(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec2(${n(b[2])}, ${n(b[3])})));`).join('\n')}
  if (reflex.r > 0.0) reflex *= ${n(1 - W.reflexLined)} + ${n(2 * W.reflexLined)} * smoothstep(0.25, 0.75, stageNoise(vec3(r * ${n(W.reflexLines)}, e * ${n(W.reflexLong)})));
  // the ribbon: the room's lit wall in the far side of the glass. turn is the bearing. Left of the elbow its upper
  // edge is firm and its lower one soft, right of it the other way round and it is brightest low, and it lies in a few
  // broad soft lanes along its own length
  float turn = dot(e, e) > 0.0 ? atan(e.y, e.x) : 0.0;
  float ribSlow = ${n(W.ribbonElbow[1])} + ${n(W.ribbonElbow[2])} * (turn - ${n(W.ribbonElbow[0])});
  float ribFast = ${n(W.ribbonLevel[0])} + ${n(W.ribbonElbow[1] - W.ribbonLevel[0])} * exp(min(turn - ${n(W.ribbonElbow[0])}, 1.0) / ${n(W.ribbonLevel[1])});
  float ribNear = max(${n(W.ribbonRound)} - abs(ribSlow - ribFast), 0.0);
  float ribUp = min(ribSlow, ribFast) - ribNear * ribNear * ${n(0.25 / W.ribbonRound)};
  float ribLow = mix(${n(W.ribbonLow[0])}, ${n(W.ribbonLow[1])}, smoothstep(-1.0, 1.0, (${n(W.ribbonLow[2])} - turn) / ${n(W.ribbonLow[3])})) + ${n(W.ribbonLow[4])} * (1.0 - smoothstep(0.75, 1.0, turn));
  float ribLeft = smoothstep(${n(W.ribbonElbow[0] - 0.15)}, ${n(W.ribbonElbow[0] + 0.35)}, turn);
  float ribbon = smoothstep(-1.0, 1.0, (r - ribLow) / mix(${n(W.ribbonLower[0])}, ${n(W.ribbonLower[1])}, ribLeft)) * (1.0 - smoothstep(-1.0, 1.0, (r - ribUp) / mix(${n(W.ribbonUpper[0])}, ${n(W.ribbonUpper[1])}, ribLeft))) * smoothstep(${n(W.ribbonEnds[0])}, ${n(W.ribbonEnds[1])}, turn) * (1.0 - smoothstep(${n(W.ribbonEnds[2])}, ${n(W.ribbonEnds[3])}, turn));
  if (ribbon > 0.0) {
    float ribAt = (r - ribLow) / max(ribUp - ribLow, 0.01);
    float ribUnder = clamp(ribAt, 0.0, 1.0);
    ribbon *= (1.0 + ${n(W.ribbonPeak[0])} * exp(-(turn - ${n(W.ribbonPeak[1])}) * (turn - ${n(W.ribbonPeak[1])}) / ${n(W.ribbonPeak[2] * W.ribbonPeak[2])})) * mix(1.0 + ${n(W.ribbonDeep)} * (1.0 - ribUnder), ${n(W.ribbonUnder)} + ${n(1 - W.ribbonUnder)} * ribUnder * ribUnder, ribLeft) * (${n(1 - W.ribbonStreaked[0])} + ${n(2 * W.ribbonStreaked[0])} * smoothstep(0.3, 0.7, stageNoise(vec3(ribAt * ${n(W.ribbonStreaks[0])} + 3.0, turn * 3.5 + 9.0, 7.7)))) * (${n(1 - W.ribbonStreaked[1])} + ${n(2 * W.ribbonStreaked[1])} * stageNoise(vec3(ribAt * ${n(W.ribbonStreaks[1])}, turn * 5.0 + 13.0, 2.9)));
  }
  reflex += ${vec(W.ribbonColor)} * (${n(W.ribbon)} * ribbon);
  // under it the glass holds the room's warm dark: one thin brown arc
  float underOff = (r - ribLow + ${n(W.under[0])}) / ${n(W.under[1])};
  reflex += ${vec(W.underColor)} * (${n(W.under[2])} * exp(-underOff * underOff) * smoothstep(${n(W.underEnds[0])}, ${n(W.underEnds[1])}, turn) * (1.0 - smoothstep(${n(W.underEnds[2])}, ${n(W.underEnds[3])}, turn)));
  air += reflex * (inside * (still + ${n(W.reflexStorm)} * storm));
  // the light on the glass: a few thin streaks along the arc
  vec3 glints = vec3(0.0);
${W.glint.map((b, i) => `  glints += ${vec(W.glintCool)} * (${n(b[5])} * wlStreak(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec4(${n(b[2])}, ${n(b[3])}, ${n(b[4])}, ${n(3.7 * i + 1.3)})));`).join('\n')}
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
    uniforms: { uFlareSun: uniforms.uFlareSun },
    vertexPars: 'uniform vec4 uFlareSun;\nvarying vec2 vFl;\nvarying vec2 vFlOut;\nvarying float vFlGain;\nvarying float vFlBend;',
    vertexMain: `
vec3 flV = normalize(cameraPosition - uLensCentre);
vec3 flH = normalize(flV + uFlareSun.xyz);
vec3 flP = uLensCentre + flH * ${n(RS + 0.6)};
vec4 flC = viewMatrix * vec4(uLensCentre, 1.0);
vec4 flAt = viewMatrix * vec4(flP, 1.0);
vec2 flOut = flAt.xy - flC.xy;
// out onto the outline; and the outline's radius there, in the quad's half width, for the bend of the patch
flAt.xy += flOut * ${n(F.rimOut)};
vFlBend = length(flOut) * ${n((1 + F.rimOut) / F.halfMm)};
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
    vertexPars: 'uniform vec4 uFlareSun;\nvarying vec2 vWl;\nvarying vec2 vWlDir;\nvarying vec3 vWlMid;\nvarying vec3 vWlDepth;',
    vertexMain: `
vec4 wlC = viewMatrix * vec4(uLensCentre, 1.0);
vec3 wlSun = (viewMatrix * vec4(uFlareSun.xyz, 0.0)).xyz;
// the side of the limb away from the sun, a little below the middle
vWlDir = normalize(vec2(wlSun.x < 0.0 ? 1.0 : -1.0, -${n(W.low)}));
// the limb of a sphere seen from near is a little wider than its radius
float wlR = ${n(RS)} / sqrt(max(1.0 - ${n(RS * RS)} / dot(wlC.xyz, wlC.xyz), 0.5));
vWl = position.xy * 1.25;
// for the depth of the two passes drawn in front: the globe's middle from the eye, and the two numbers of the projection that
// turn a distance in front of the eye into a depth, with the sheet's scale
vWlMid = wlC.xyz;
vWlDepth = vec3(projectionMatrix[3][2], projectionMatrix[2][2], wlR);
vec4 wlAt = wlC;
wlAt.xy += vWl * wlR;
gl_Position = projectionMatrix * wlAt;
vStageWorld = uLensCentre;
vStageLocal = (uGlobeInv * vec4(uLensCentre, 1.0)).xyz;
vStagePlaced = uLensCentre;
vStageAux = vec3(0.0, -wlAt.z, length(wlAt.xyz));`,
    fragment: rim ? WALL_RIM : front ? WALL_FRONT : WALL,
    params: rim ? { ...added, blendDst: THREE.OneMinusSrcAlphaFactor, depthTest: true } : { ...added, transparent: false, depthTest: front },
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
