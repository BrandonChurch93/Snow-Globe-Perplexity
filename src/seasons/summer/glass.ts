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
//    warm glow a lens draws round it, and in that bloom seven soft rays that stand out from it into the room: wedges
//    without a bright root and without an end one could point at. The rays lift what lies behind them, so they stand on the
//    room's pale lights as on its dark. All of that is the lens's and is drawn last of all; the hot line the sun leaves
//    down the limb is the glass's and is drawn with the globe. It kindles on the landing.
// 2. The pool: the same light focused by the globe onto the slab, in front of the globe and to its left, inside the globe's own
//    shadow: a soft pool of warm light, brightest at a knot by the foot, and inside it a few broad curved bands of the water's
//    light, long across the picture, each clear at its outer edge and soft inward, and never a net or a star (the
//    config's settled line for summer: the approved picture's thin veins out of one point are not drawn). There is no
//    pool before the landing; after it the pool swells, its bands slide into place and come to rest, and they breathe
//    a little while the water is still.
// 3. The wall: the sun, bent by the globe, burns on the inside of the glass low on the far side: a sheaf of hairs of
//    light that follow the limb, one white body without a gap along their middles, whose core ends up the limb in
//    soft pointed tongues of unequal length and thins past them into fibres that go out; it thins to a round foot
//    and dies away into the warm halo round it. The same
//    billboard carries the warm haze of the liquid at rest, which lies low and behind
//    the miniature: gold behind the cottage, brightest along the ground right of the trunk, dark behind the crown. It
//    thins toward the outline, where the eye looks through less of the liquid, so it reads as a ball of liquid and not
//    as a wall; above the roof line it is no more than a thin even veil, so the dark room reads through the whole
//    upper half of the glass. And it carries the glass's own reflections: one cream ribbon in lanes under the top, one cool slab
//    down the right shoulder, and at the upper left the ribbon's broad end, the clear dark past it, one dash and a few
//    short strokes, no two alike. The haze and the reflections do not grow brighter with the storm, which is the air's: the
//    still air's light gives way to it (by the liquid's turbulence); the burn alone swells in it, every thread wider and
//    none brighter at its middle. The haze and the reflections are drawn with the interior, straight after the view
//    through the liquid and before the miniature, so all of that lies behind the cottage and the tree: the crown is a dark mass against bright air, as the
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
// streaks and bands, below. The shell's bend is off (`bend`): it draws the inside from further in over the outermost
// twelfth of the radius, which set the flame's white middle a second time against the outline as a cream band and the
// wall's wash into the dark gap under the rim
setGlass('summer', { windowTint: [0.9, 0.86, 0.78], windowGain: [0, 0, 0, 0], windowSoftDeg: 5, windowGrain: 0.5, rimTint: [0.8, 1, 1.25], rimSide: [1.3, 0.5, 0.28], wallTint: [0.5, 0.36, 0.2], ringCover: 0.4, strip: 0, bend: 0, ringThin: 0.75, rimClear: 0.4, topLine: 0.3, ringMottle: 0.3, ceiling: 0.5, roomHue: [0.85, 0.98, 1.15], roomHueOn: 1, windowShade: 0, rimGlow: 0, arcs: 0.34, arcTint: [1, 0.6, 0.34], arcCool: 1.88 })

export const look = {
  // leaving: the light goes out between these two counts of beats before the swap window opens
  leaveBeats: [1.1, 0.2] as const,
  flare: {
    halfMm: 30,
    // the core: white hot, a patch on the outline, drawn out along it and bent with it; how strong, and its size across
    // the outline and along it (in the quad's half width, as every length of the flare is, which is half the ball's
    // radius). On the approved picture what is white (a level of 250 and over) lies 0.069 of the radius along the rim
    // and 0.033 of it across. Here it is held under that, 0.047 by 0.026 on the drawn still: where a light of the room
    // lies behind the star, as it does in the film, the room's light is added and the white spreads, there to 0.065
    // by 0.031
    core: 10,
    coreAcross: 0.03,
    coreAlong: 0.06,
    // the mirror's own place for the sun lies a hair inside the outline: the glint is pushed out along the radius by this
    // share of it, so that its middle lies on the outline and the bloom sits on the rim
    rimOut: 0.012,
    // the bloom of the lens round the patch: soft, cream, brightest on the rim, and a little longer along the
    // outline than across it, since the patch it blooms from is long (`bloom`, and the lengths it falls to a third in,
    // across the outline and along it); round it the warm glow, its tail, which falls off slower and has no edge
    // (`glow`, and its lengths)
    bloom: 4.25,
    bloomAcross: 0.074,
    bloomAlong: 0.075,
    glow: 1.83,
    glowAcross: 0.12,
    glowAlong: 0.164,
    hot: [1, 0.88, 0.64] as const,
    amber: [1, 0.51, 0.27] as const,
    // the star is a bloom with rays in it, not a drawn star: seven soft rays, measured on the approved picture (six
    // that stand out into the room and the one that lies down the limb), and none into the ball. Each: its angle from
    // the outline's outward normal (degrees, counter clockwise), how far it reaches (in the quad's half width), the
    // tangent of half the angle it opens by, how bright beside the longest, and how strong its lift is beside the
    // strongest. A ray is a soft wedge of light. It has no bright root: it rises out of the bloom over `rayRise`, runs
    // on falling to a third in every `rayLen`, and from the share `rayEnd` of its reach it fades to nothing at its
    // reach, so it has no end one could point at. `ray` is how bright the longest is, `rayThin` half the width a ray
    // has at its root, `rayHue` its colour, copper as the approved's are. On the approved picture a ray stands 4 to 20
    // levels over what lies beside it, and is 7 to 15 degrees wide: the numbers are dealt to that. That light is
    // dealt to the approved picture, where the room behind the star is dark. Where a pale light of the room lies
    // behind the star, light of that strength is lost on it, so a ray besides lifts what lies behind it: `lift` is by
    // how many times its own strength the strongest lifts it, in the ray's own shape and falling along it half as fast
    // as the light does. On a dark room that is next to nothing, on a pale light it is the ray. The flare's own light
    // is not lifted: it is added after the lift, in the one pass
    rays: [
      [-69, 0.9, 0.06, 1, 1],
      [-83.8, 0.6, 0.035, 0.4, 0.4],
      [64, 0.75, 0.08, 0.6, 0.7],
      [34, 0.55, 0.09, 0.24, 0.4],
      [4, 0.5, 0.1, 0.2, 0.35],
      [-16, 0.7, 0.08, 0.15, 0.35],
      [-41, 0.7, 0.075, 0.27, 0.45],
    ] as const,
    ray: 0.5,
    rayRise: 0.06,
    rayLen: 0.2,
    rayEnd: 0.35,
    rayThin: 0.012,
    rayHue: [1, 0.68, 0.38] as const,
    lift: 0.7,
    // down the limb from the patch the outline itself is hot: one thin line just inside it (`line`: how strong, how far
    // inside the outline it lies and half its width, how far down the limb its middle lies and half its length there,
    // all in the quad's half width)
    line: [3, 0.014, 0.016, 0.3, 0.3] as const,
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
    // It is light drawn out along the limb in hairs, and no filled body lies under them. `hot` is how strong the white
    // ones are, `hotAt` where the amber glow round them has its middle (share of the radius, radians up the limb from
    // the wall's middle). The mass is the sheaf (`sheaf`, below): lanes side by side, each a hair. Round it stand single
    // threads (`threads`), dealt to the approved picture. Each is thirteen numbers: the bearing of its foot and of its
    // tip (degrees from the right, counter clockwise: it runs up the limb), how deep inside the outline it stands at
    // its foot and at its tip (share of the radius), half its width, how bright, 1 if it is a warm thread and 0 if a
    // white one, over how many degrees it draws to a point at its tip and over how many it comes in at its foot, how
    // bright it is at its tip beside its foot, what share of its light lies beside it in a skirt three times as wide,
    // the share of a steep side (1: its light stands across it as a flat top with steep sides, 0: as a bell), and how
    // many times longer than the others it comes in over at its foot in the storm. A thread is a spindle: it thins to
    // a needle toward its foot as toward its tip, so neither end is cut. None is drawn thinner than a pixel, only
    // fainter. They are few, and the bright ones broad or short: the camera of the film draws back from the globe, the
    // limb then crosses a thin line's own width between two frames, and every bright thin line along the limb
    // flickers there. In their order: eight beside the outline (the tan between the lines; a copper line; copper and cream further up the limb, a dash at their end, one more
    // copper line, and two broad faint ones under them); the tongue past the upper end of the mass and a hair before
    // it; one short hair above the ragged upper edge; and the faint light inward of the mass. The hairs that leave
    // the mass are the sheaf's own. The glow below the foot is the halo's (`sheaf`). A white thread's colour goes by how much white lies at the
    // place: `flameWarm` where it is faint, `hotColor` where it is strong, half way between them at `flameWarmHalf`;
    // the warm ones are `threadWarm`. In the storm the liquid scatters the burn: every thread is 1 + `threadStorm`
    // times as wide and as bright at its middle as at rest, its steep sides go, and each comes in over its own longer
    // stretch (the thirteenth number, times 1 + `threadStorm`), so the burn swells into one torn cloud whose foot is
    // ragged
    hot: 11,
    hotAt: [0.9, -0.09] as const,
    threads: [
      [212.5, 198, 0.016, 0.0149, 0.009, 0.12, 0, 4, 3, 0.4, 0, 0, 1],
      [211.5, 199, 0.0195, 0.0185, 0.002, 0.3, 1, 4, 3, 1, 0, 0, 1],
      [203, 190, 0.0295, 0.028, 0.002, 0.15, 1, 4, 4, 1, 0, 0, 1],
      [197.5, 186, 0.0255, 0.024, 0.0022, 0.3, 0, 4, 4, 1, 0.2, 0, 1],
      [189, 184.8, 0.0235, 0.0215, 0.0022, 0.4, 0, 1.6, 1.6, 1, 0.1, 0, 1],
      [200, 188, 0.039, 0.037, 0.002, 0.15, 1, 4, 4, 1, 0, 0, 1],
      [198, 183, 0.032, 0.04, 0.012, 0.07, 1, 4, 5, 1, 0, 0, 1],
      [200, 184, 0.0195, 0.026, 0.011, 0.034, 0, 3, 4, 1, 0, 0, 1],
      [198, 185.8, 0.053, 0.044, 0.0048, 1, 0, 5, 4, 0.9, 0.15, 0, 1],
      [188.2, 186.4, 0.0612, 0.0606, 0.0018, 0.4, 0, 0.8, 0.8, 1, 0, 0, 1],
      [194.6, 192.6, 0.1075, 0.1075, 0.002, 0.4, 0, 0.9, 0.9, 1, 0, 0, 1],
      [201.5, 191.5, 0.171, 0.17, 0.012, 0.1, 0, 4, 4, 1, 0, 0, 1],
    ] as const,
    // the sheaf: the mass of the burn, lanes of light side by side that follow the limb, each `lane` of the radius
    // wide. Where the lanes are whole they close into one white body without a gap. A lane is a hair: it comes in
    // softly at its foot, is as wide as its lane along its middle and draws out to a needle at its tip. The body's
    // edge is ragged and never a comb: where a lane ends goes by its count across the sheaf in three waves, tongues,
    // locks and curls (`tongue`, `lock`, `curl`, each: how many degrees, how many radians of the wave to a lane, where
    // the wave begins), every wave a row of peaks with points, so neighbours end near one another and the edge
    // stands in pointed tongues of unequal length; each lane ends within `fray` degrees of that besides, and of the
    // lanes the share above the first of `far` runs on alone as a long hair, by up to the second in degrees, its
    // point longer by the third. The mass does not end where its lanes do. Its core ends on one line across the
    // lanes, the two long waves alone (tongues and locks, taken at the place and not by the lane), and past that
    // line the light falls to 0.37 of itself over every `fall` degrees, while the lanes run on `runOn` degrees
    // further (times a share between the two in `runOnBy`, dealt by lane) and end one by one in the falling light.
    // So the core's edge is soft pointed tongues, white in their middle and cream at their rim, and beyond them
    // the mass thins into fibres that go out, each fainter the further it runs, and none ends bright: a bright
    // needle that the limb carries across its own width between two frames of the film flickers there.
    // `lean` is how far a lane moves toward the outline to a degree up the limb, `wave`
    // how the lanes swing about that, so that no two stretches run quite the same way (how far, how many radians to
    // a degree up the limb and to the radius), `warp` how far they wander from even spacing (two waves: how many
    // lanes, how many radians to the radius), `soft` the share of a lane its edge is soft over (and never less than
    // a pixel), `bright` how bright a lane is beside a white thread and `dim` what the dimmest keeps of that. At this
    // `bright` the body is white in its heart alone and warm white round it, as the approved's is: there what is
    // white lies in the lower middle only, and the body round it has the mean colour 250 240 225. `tip`
    // and `foot` are where the core ends up the limb and where the lanes begin: the bearing by the depth inside the
    // outline (pairs: depth, bearing). The foot is round: the lanes of the middle reach furthest down and those of both flanks begin
    // further up, so the body thins to its foot and no line crosses it. `side` is the share of the sheaf by the
    // depth at its two flanks. The body is many times brighter than white, so only the last twentieth of a fall
    // shows as one: the inner flank falls steeply to a quarter and runs out from a twentieth over a broad stretch,
    // and it reads as a fade and never as a line. A tip draws to its point over `point` degrees, times a share
    // between the two in `pointBy`, dealt by lane; a foot comes in over `come` degrees (`comeBy`), within
    // `footTongue` (a wave as the tongues are) and `footFray` degrees of its line, and `come` is long for the same
    // reason: the lanes' feet then die away side by side and do not stand as blunt fingers along the inner flank,
    // which their starts make. `needle` is the share of its lane a hair keeps at its very
    // end, `part` over how many point lengths it thins to that (a foot `footThin` times sooner, so it fades more
    // than it thins), `wander` how far a thinning hair strays from the middle of its lane. Round the body lies its
    // halo, the lens's bloom: `halo` of warm light (`haloColor`), whole inside the body (between the two depths of
    // `haloIn`, and from `haloTip` degrees past the core's line to `haloFoot` degrees short of the feet's) and falling
    // off outside it by the distance alone, with no edge: across the limb to a third over `haloAcross` (toward the
    // outline, inward), along it over `haloAlong` degrees (past the tips, past the feet). `haloEnd` is where it is
    // gone whatever the distance: between two depths inward, and between two pairs of bearings at its ends. So the
    // foot dies away into it and no patch stands apart under it. In
    // the storm (`storm`) the tongues are longer by the first, the feet stray further by the second and come in over
    // a stretch longer by the third, so the mass tears as the threads do
    sheaf: {
      lane: 0.0046,
      lean: 0.0006,
      wave: [0.003, 0.45, 40] as const,
      warp: [0.3, 190, 0.2, 73] as const,
      soft: 0.4,
      bright: 1.7,
      dim: 0.85,
      tip: [
        [0.058, 192.3],
        [0.085, 192.3],
        [0.105, 195.8],
        [0.125, 196.2],
        [0.145, 198.2],
        [0.17, 201.2],
        [0.195, 202.5],
        [0.215, 204],
        [0.23, 206],
      ] as const,
      foot: [
        [0.054, 208.3],
        [0.066, 210.8],
        [0.078, 214.3],
        [0.086, 215.3],
        [0.11, 215.3],
        [0.12, 214.1],
        [0.133, 212.9],
        [0.15, 211.7],
        [0.17, 210.5],
        [0.195, 209.1],
        [0.215, 207.9],
        [0.23, 206.8],
      ] as const,
      side: [
        [0.054, 0],
        [0.066, 1],
        [0.2, 1],
        [0.212, 0.25],
        [0.225, 0.05],
        [0.245, 0],
      ] as const,
      tongue: [2.2, 0.324, 0.7] as const,
      lock: [1.4, 0.593, 2.1] as const,
      curl: [0.8, 1.083, 4] as const,
      fray: 0.7,
      far: [0.75, 6, 1.6] as const,
      fall: 2,
      runOn: 4,
      runOnBy: [0.6, 0.8] as const,
      point: 2.5,
      pointBy: [0.6, 0.8] as const,
      come: 6,
      comeBy: [0.8, 0.4] as const,
      footTongue: [0.5, 0.83, 1.9] as const,
      footFray: 0.3,
      footThin: 4,
      needle: 0.2,
      part: 1.3,
      wander: 0.3,
      halo: 0.36,
      haloColor: [1, 0.5, 0.15] as const,
      haloIn: [0.075, 0.19] as const,
      haloAcross: [0.045, 0.07] as const,
      haloTip: 0,
      haloFoot: 5,
      haloAlong: [4, 3.5] as const,
      haloEnd: [0.2, 0.35, 175, 185, 222, 237] as const,
      storm: [0.6, 1, 0.5] as const,
    },
    threadStorm: 0.5,
    // the share of its width a thread keeps at its very tip and at its very foot: it draws to a needle at both
    threadPoint: 0.2,
    hotColor: [1, 0.94, 0.8] as const,
    flameWarm: [1, 0.5, 0.18] as const,
    flameWarmHalf: 1,
    threadWarm: [1, 0.42, 0.16] as const,
    // the amber glow of the liquid round the patch: thin and close, so the turf and the fence beside the flame stay
    // clear (`glowSize`: how far it reaches across the limb, down the limb and up it)
    glow: 0.3,
    glowSize: [0.09, 0.11, 0.2] as const,
    // its spill past the limb: the lens blooms round the patch, outside the glass too
    spill: 0.3,
    spillAt: 0.12,
    spillColor: [1, 0.62, 0.3] as const,
    // the limb's own warm edge on the far side: the glass wall takes the flame's light as a band of amber inside the
    // outline, beside the flame's foot and no further: it is what stands between the flame's outer threads. How strong,
    // where up the limb (radians) and how far it runs, where in the radius and how thick
    edge: 2,
    edgeAt: [-0.11, 0.17] as const,
    edgeIn: [0.972, 0.022] as const,
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
    air: [0.3, 0.82, 0, 0.11, 0.2, 0.2, 0.17] as const,
    airColor: [1, 0.62, 0.3] as const,
    airFar: [0.065, 0.82, 0.43, 0.25, 0.3, 0.45, 0.25] as const,
    airFarColor: [1, 0.7, 0.42] as const,
    // the haze: the liquid behind the miniature holds the last sun. It is gold and fullest low, just over the ground
    // (`hazeLow`, in globe radii up the picture), and stands highest in a plume over the middle of the ground (`hazeAt`,
    // `hazeWide`), `hazeTall` radii tall there and `hazeSideTall` of that at the sides, where it is `hazeRim` as strong. With
    // it goes a thinner light that lies on a slope and never on a level, `hazeHigh` at the ground, down to a third
    // `hazeHighTall` radii up, and `hazeHighLeft` of that at the far left. The liquid is a ball: the eye looks through
    // most of it at the middle and through little at the outline, so the haze and the bodies below are whole inside the
    // first of the `hazeLimb` radii and gone at the second. `hazeBanks` is how unevenly all of it lies, in soft banks
    // `hazeBankSize` globe radii across, and `hazeFine` in finer ones `hazeFineSize` across, so it reads as lit liquid
    // with depth in it and never as a flat card
    haze: 0.4,
    hazeColor: [1, 0.62, 0.28] as const,
    hazeRim: 0.07,
    hazeAt: 0.05,
    hazeWide: 0.6,
    hazeLow: -0.46,
    hazeTall: 0.38,
    hazeSideTall: 0.55,
    hazeLimb: [0.5, 0.96] as const,
    hazeHigh: 0.02,
    hazeHighTall: 0.4,
    hazeHighLeft: 0.35,
    // the haze over the dome: above the roof line the liquid holds very little of the sun, an even thin veil that the
    // seed heads and the fireflies float in, `fill` of it, thin and as warm as the liquid's own light, so that the dark
    // room reads through the whole upper half of the glass as a warm dark and never as a grey one. It has no patches
    // and no folds. Two soft bodies of light lie in it
    // (`fillBody`, each: where, across and up, how wide and how tall in globe radii, how much): one low behind the
    // cottage at the left, no higher than its chimney, and a faint one right of the crown on the flare's side. None
    // lies over the middle or the upper middle, and behind the crown the liquid is dark
    fill: 0.02,
    fillColor: [1, 0.5, 0.25] as const,
    fillBody: [
      [-0.42, 0.02, 0.34, 0.16, 0.16],
      [0.55, 0.47, 0.3, 0.26, 0.02],
    ] as const,
    bodyColor: [1, 0.6, 0.26] as const,
    // and a body falls off to the limb: all of it inside the first of these radii, none beyond the second
    bodyLimb: [0.5, 0.92] as const,
    // a warm gold body of light behind the cottage's roof and the gap between it and the trunk (`domeAt`, globe radii
    // across and up; `domeSize`, how far it reaches to the left, to the right and up or down). The banks break it and
    // it ends below the upper half
    dome: 0.09,
    domeAt: [-0.2, 0.08] as const,
    domeSize: [0.28, 0.22, 0.16] as const,
    domeColor: [1, 0.6, 0.26] as const,
    // along the ground behind the trunk's foot and right of it the liquid is brightest and most golden: a low core
    // between the trunk and the right wall, which the banks break. Over it, behind the crown, the liquid is dark
    core: 0.28,
    coreAt: [0.32, -0.3] as const,
    coreSize: [0.45, 0.15] as const,
    coreColor: [1, 0.6, 0.22] as const,
    // the sharp light on the glass low on the right limb: one thin pale streak that follows the arc just inside the
    // outline, and no other, since the approved picture has no pale patch inside the right arc. Each: its bearing
    // (degrees from the right, counter clockwise) and half its length along the arc (degrees), where in the radius it
    // lies, half its width, how far it leans across the arc and how strong. `glintBroken` of a streak is gone in the
    // gaps along it
    glints: 2,
    glint: [[351.5, 6, 0.967, 0.003, 0, 0.3]] as const,
    glintBroken: 0.8,
    glintHue: [1, 0.97, 0.92] as const,
    // the glass's own reflections: curved bands that follow the dome inside the outline. Down the right shoulder the
    // room's cool light lies in the glass as one slab (`slab`, below), and in the gap between it and the right limb,
    // where the lamps are mirrored, one band is a deep warm brown; at the upper left a faint cool one lies inside the
    // ribbon's thin end (each: bearing and half length in degrees, where in the radius, half its thickness, how
    // strong, and its colour: 1 cool, 2 deep warm, 3 steel blue, 4 slate). Right of the top the glass between the
    // outline and the ribbon is steel blue, where it mirrors the sky, and at the upper left the dark under the ribbon
    // holds one faint grey zone, broad and without an edge, so it is not brown there. A
    // band is not smooth: `reflexLined` of it lies in fine lines that run along the arc (`reflexLines` sets how fine
    // they are across the band, `reflexLong` how short along it), so it reads as a reflection in glass and not as mist
    reflex: [
      [34, 18, 0.95, 0.02, 0.17, 2],
      [128, 15, 0.885, 0.02, 0.09, 1],
      [66, 22, 0.938, 0.025, 0.1, 3],
      [113, 16, 0.8, 0.055, 0.07, 4],
    ] as const,
    reflexCool: [0.9, 0.95, 1] as const,
    reflexDeep: [1, 0.52, 0.25] as const,
    reflexSteel: [0.2, 0.55, 1] as const,
    reflexSlate: [0.8, 0.95, 1] as const,
    // the slab: down the right shoulder the room's cool light lies in the glass as one broad band with hard edges,
    // counted on the approved picture: one, and no band beside it. `slab` is how strong it is at its outer edge,
    // `slabFall` its share at the inner one. It lies between the bearings in `slabEnds` (degrees: it comes in between
    // the first two, at its lower end, and is gone between the last two, up the limb), its outer edge at the first
    // share of the radius in `slabOuter` and further in by the second past the bearings given third and fourth, its
    // inner edge at the first of `slabInner` and further out by the second below the bearings given third and fourth.
    // `slabEdge` is half the width of its outer edge and of its inner one. Its lower end is ragged: the fine lines of
    // the glass end each at its own bearing, within `slabFray` degrees, and `slabLined` of the slab lies in them.
    // They are far finer than the bands' lines (`slabLines` to a globe radius across it), so the end is a fine comb
    // and never a stair. `slabColor` is its colour, the room's cool white
    slab: 0.42,
    slabFall: 0.6,
    slabEnds: [11, 16, 36, 56] as const,
    slabOuter: [0.912, 0.032, 40, 46] as const,
    slabInner: [0.8, 0.04, 15, 25] as const,
    slabEdge: [0.004, 0.008] as const,
    slabFray: 7,
    slabLined: 0.12,
    slabLines: 200,
    slabColor: [0.83, 0.93, 1] as const,
    // streaks with one hard edge, right of the top between the outline and the ribbon: light that begins at once on a
    // line along the arc and falls off slowly to one side of it. Each: its bearing and half its length in degrees,
    // where in the radius its hard edge lies, how far its light reaches from the edge (toward the outline; toward the
    // middle of the globe if less than nothing), how far the edge leans across the arc, how strong, and its colour: 0
    // cream, 1 cool, 2 steel blue. `edgedHard` is half the width of the hard edge as a share of the reach. One is
    // cream with its hard edge below, one a dim steel blue with its hard edge above
    edged: [
      [64, 20, 0.872, 0.03, 0, 0.26, 0],
      [68, 13, 0.922, -0.02, -0.069, 0.07, 2],
    ] as const,
    edgedHard: 0.15,
    edgedCream: [1, 0.8, 0.6] as const,
    reflexLined: 0.8,
    reflexLines: 55,
    reflexLong: 2.2,
    // the ribbon: the room's lit wall mirrored in the far side of the glass, one cream band with hard edges, in lanes. It
    // comes in thin under the outline at the upper left, swells and sweeps down across the top and runs out level over
    // the crown toward the right shoulder. `ribbon` is how strong, `ribbonPeak` how much brighter it is where it is
    // broadest (about the bearing given second, radians, over the spread given third). Its upper edge falls slowly from
    // the upper left to an elbow (`ribbonElbow`: the bearing in radians and the share of the radius there, and how much
    // higher it lies a radian further left) and from the elbow on drops fast toward `ribbonLevel` (share of the radius,
    // and over how many radians it falls to a third of the way); the elbow is rounded over `ribbonRound` of the radius.
    // Its lower edge sinks from the first to the second of `ribbonLow` (shares of the radius) about the bearing given
    // third over the spread given fourth, and rises again by the fifth toward the right end; left of the top it is
    // higher by the first of `ribbonLift` (about the bearing given second, over the spread third); at the left it stays at
    // the depth in `ribbonLowTop` (the share of the radius, and how gently it comes to it). `ribbonEnds`: it comes in
    // between the first two bearings and is gone between the last two (radians), where the rim's own pass takes its
    // thin end on. `ribbonUpper` is half the width of its upper edge right of the top, where it is a slow ramp, and
    // from the top leftward, where it is hard (between the two bearings in `ribbonFirm`, radians); `ribbonLower` is
    // half the width of its lower edge, which is hard all along, right of the elbow and left of it. Across it lie
    // three lanes, counted on the approved picture along the line straight up from the middle of the globe: from the
    // lower edge a broad bright one, which dims smoothly upward into a dim tan one, and under the upper edge a cream
    // one with a hard lower edge. `ribbonLanes` is between which shares of the way from the lower edge to the upper
    // the light falls to the dim lane, and between which it steps up into the upper one; `ribbonLane` is how bright
    // the dim lane is beside the first right of the elbow and left of it, and the upper one; `ribbonBase` is the first
    // lane's own share right of the elbow and left of it. The lanes wander along the ribbon (`ribbonWander`: how far
    // and how many times to the radian, twice over). It also lies in broad soft patches along its own length and in
    // fine streaks (`ribbonStreaks`: how many of each across it), by `ribbonStreaked` of its light.
    // Over the top a copper skirt stands on its upper edge, which the light climbs before it steps into
    // the cream (`ribbonSkirt`: how strong, how far it reaches toward the outline, about which bearing and over which
    // spread, radians).
    // Under it the glass holds the room's warm dark as one thin brown arc (`under`: how far below the ribbon's
    // lower edge its middle lies, half its thickness, how strong; `underEnds`: it comes in between the first two
    // bearings and is gone between the last two, radians)
    ribbon: 0.18,
    ribbonColor: [1, 0.64, 0.43] as const,
    ribbonPeak: [0.9, 1.6, 0.2] as const,
    ribbonElbow: [1.536, 0.901, 0.092] as const,
    ribbonLevel: [0.73, 0.28] as const,
    ribbonRound: 0.06,
    ribbonLow: [0.925, 0.62, 1.693, 0.75, 0.04] as const,
    ribbonLowTop: [0.843, 0.012] as const,
    ribbonLift: [0.02, 1.78, 0.11] as const,
    ribbonEnds: [0.45, 1, 1.95, 2.25] as const,
    ribbonUpper: [0.022, 0.005] as const,
    ribbonFirm: [1.36, 1.48] as const,
    ribbonLower: [0.007, 0.008] as const,
    ribbonBase: [1.6, 1.3] as const,
    ribbonLanes: [0.1, 0.72, 0.82, 0.86] as const,
    ribbonLane: [0.58, 0.5, 0.95] as const,
    ribbonWander: [0.04, 9, 0.03, 3.7] as const,
    ribbonStreaks: [1.3, 8] as const,
    ribbonStreaked: [0.25, 0.2] as const,
    ribbonSkirt: [0.2, 0.034, 1.58, 0.12] as const,
    ribbonSkirtColor: [1, 0.5, 0.24] as const,
    under: [0.075, 0.02, 0.056] as const,
    underEnds: [0.96, 1.2, 1.95, 2.2] as const,
    underColor: [1, 0.6, 0.38] as const,
    // the glass has thickness: just inside the outline lies a band of fine lines of light that run along the arc, and
    // against the outline one bright line. It is drawn last, over the shell, whose own ring there covers the inside and
    // would cover these lines with it. `rim` is the whole of its strength, `rimAt` where in the radius the band
    // begins, is whole, begins to end and has ended (down the right limb it begins and is whole at `rimAtRight`,
    // further out, so the gap inside the right arc stays dark), `rimFoot` where it ends above the base (the height of the bearing:
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
    // At the upper left the glass mirrors the room's lit wall as the end of the ribbon, which the shell's ring would
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
    // the outline). It follows the storm and the light, so it is not there at rest, in the hand or through a change.
    // Of the rim's own light there it takes `rimDarkOwn` of that share, so the rim's hairs stand in the gap as copper
    // threads, and outside it the outline itself is one thin copper line in the storm (`rimStormLine`: how strong,
    // where in the radius, half its width)
    rim: 1,
    rimAt: [0.925, 0.948, 0.992, 1] as const,
    rimAtRight: [0.955, 0.978] as const,
    rimFoot: [-0.55, -0.3] as const,
    rimLines: 120,
    rimLinesWide: 105,
    rimLinesShare: [0.15, 1] as const,
    rimHair: [0.74, 0.95, 5, 0.45] as const,
    rimWideShort: 0.5,
    rimWaver: 0.005,
    rimLong: 2.5,
    rimBare: [0.05, 0.08, 0.08, 0.08] as const,
    rimDark: [0.8, 0.94, 0.958, 0.986, 0.995] as const,
    rimDarkOwn: 0.4,
    rimStormLine: [0.5, 0.9955, 0.003] as const,
    rimStormColor: [1, 0.42, 0.16] as const,
    rimDarkEnds: [-0.17, 0.03] as const,
    rimLeft: [0.3, 0.15, 0.062] as const,
    rimTop: [0.16, 0.2, 0.24] as const,
    rimTopAt: [74, 0.6, 0.93] as const,
    rimRight: [0.18, 0.105, 0.055] as const,
    rimShoulder: [0.17, 0.22, 0.3] as const,
    rimShoulderAt: [42, 0.82, 0.978] as const,
    rimBandBy: [0.35, 0.5, 0.08, 1.2] as const,
    rimLine: [0.991, 0.006, 1.8] as const,
    rimLineBy: [0.25, 1, 0.2, 1] as const,
    rimTopLine: [0.986, 0.008] as const,
    rimLeftLine: [0.9945, 0.003] as const,
    // beside the flame the outline takes its light: one line of copper cream along the outline, from the flame's foot up
    // the limb to where the flame ends (`rimFlame`: how strong, where in the radius, half its width; `rimFlameEnds`:
    // the heights of the bearing between which it comes in above the base and between which it goes out up the limb).
    // It dulls in the storm as the glow round the flame does
    rimFlame: [1.8, 0.9945, 0.0035] as const,
    rimFlameEnds: [-0.55, -0.52, -0.2, -0.06] as const,
    rimFlameColor: [1, 0.5, 0.24] as const,
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
    dash: [152.9, 4.8, 0.923, 0.006, -0.39, 0.8] as const,
    dashColor: [1, 0.8, 0.58] as const,
    strokes: [
      [165.2, 4.2, 0.9405, 0.003, -0.097, 0.75, 0],
      [167.6, 3.4, 0.946, 0.0022, -0.1, 0.5, 0],
      [166.9, 2.4, 0.9725, 0.0024, -0.067, 0.7, 1],
      [167.6, 1.8, 0.984, 0.002, -0.05, 0.5, 1],
      [160.2, 3.2, 0.962, 0.002, -0.09, 0.4, 1],
      [165, 4.8, 0.978, 0.002, -0.09, 0.3, 1],
      [174.6, 4.6, 0.9835, 0.0018, -0.05, 0.28, 1],
    ] as const,
    strokeCream: [1, 0.86, 0.7] as const,
    strokeAmber: [1, 0.62, 0.36] as const,
    // inside the outline the glass mirrors the lit wall a second time, and over the top the sky: thin arcs that hug the
    // rim, no two alike in length or in depth, with clear glass between them (`arcs`, each: its bearing and half its
    // length in degrees, where in the radius, half its width, how far it leans across the arc, how strong, and 1 if it
    // is the sky's blue white, 0 if the wall's cream). They waver along their length as the rim's own lines do, twice
    // as far. Above the flare the sky lies against the outline as one band that fades inward (`rimSky`: the bearing in
    // degrees about which it lies and the cosines between which it comes in, how deep inside the outline its inner
    // edge lies there and by how much less to the sine of the bearing beyond it, over what depth it fades before the
    // edge and past it, over what share of the radius it comes in from where the band of lines begins, and how
    // strong), and under it, right of the top, the glass is steel blue (`rimSteel`: the bearing
    // and its two cosines, the shares of the radius between which it comes in and between which it goes out toward the
    // outline, and how strong). Over the top two thin blue white lines follow the outline, one on it and one a hair
    // inside it, and left of the top one streak leaves the outline and runs in across the arc
    arcs: [
      [132, 15, 0.948, 0.0035, -0.058, 0.4, 0],
      [127, 24, 0.934, 0.0042, -0.02, 0.4, 0],
      [127, 14, 0.92, 0.0036, -0.04, 0.25, 0],
      [130, 6, 0.906, 0.005, 0, 0.2, 0],
      [86, 14, 0.9955, 0.0045, 0, 0.24, 1],
      [86, 15, 0.9845, 0.0022, 0, 0.1, 1],
      [106, 15, 0.966, 0.008, -0.23, 0.21, 1],
      [143, 6.5, 0.9175, 0.011, -0.24, 0.1, 2],
    ] as const,
    arcCream: [1, 0.64, 0.43] as const,
    arcCool: [0.74, 0.86, 1] as const,
    arcSteel: [0.2, 0.55, 1] as const,
    rimSky: [54, 0.961, 0.99, 0.066, 0.095, 0.035, 0.01, 0.012, 0.3] as const,
    rimSkyColor: [0.72, 0.86, 1] as const,
    rimSteel: [62, 0.88, 0.97, 0.925, 0.955, 0.975, 0.998, 0.07] as const,
    reflexStorm: 0.6,
    hazeBanks: 0.4,
    hazeBankSize: 0.17,
    hazeFine: 0.25,
    hazeFineSize: 0.06,
    // the storm is the air's, in front, in the veil: nothing here grows brighter with it. The still air's haze behind
    // the miniature gives way to it by this much, between these two turbulences, and it dulls the glow round the burn
    // and the line on the outline beside it (`stormDulls`); the burn's threads it widens (`threadStorm`, above)
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
    gain: 0.1,
    // and a smaller, brighter body of it by the foot (its radius, where, how bright)
    nearMm: 11,
    nearAt: [-5, 0] as const,
    near: 0.16,
    cellMm: 38,
    mottle: 0.35,
    // the knot by the foot: a small soft hot spot, and the glow it lies in
    core: 3.2,
    coreMm: 2.2,
    glow: 0.45,
    glowMm: 5,
    // the water's light inside the pool: a few broad curved bands, each several millimetres wide, thickest and
    // brightest at its middle and thinning and fading to its ends, of unlike length and width (each: the middle of its
    // circle from the knot, across and down the way, its radius, the bearing of its middle and its half length in
    // degrees, half its width, how bright, and how far it slides as the liquid swings, all lengths in millimetres).
    // The camera sees the table at a low angle, a millimetre toward the front as a fifth of one across, so a band
    // reads as a curve only where it runs across the picture. Three long ones are parts of wide circles whose middles
    // lie far behind the knot: one passes just in front of the knot and rises to the left, one lies behind that and
    // one in front of it, and they lie beside one another and do not meet. One short crescent bends round the knot
    // and one faint band lies to its right. A band is a fold of the water's light: its outer edge is clear (it falls
    // to 0.37 within its half width over the root of `bandEdge`) and inward it runs out softly (to 0.37 within its
    // half width over `bandTail`). So it reads as light through water and not as a smear, and it stays broad: no
    // thin line, none out of the knot
    band: [
      [2.4, -62.6, 65.2, 106.9, 28.3, 2, 1, 2.5],
      [-12.4, -44.5, 36.1, 118.3, 30.1, 1.5, 0.6, -3],
      [-19.6, -80.3, 87.6, 98.1, 16.4, 1.7, 0.7, 4],
      [2.5, -1, 8, 165, 60, 1.4, 0.9, 2],
      [37.9, -89.3, 97.3, 98.3, 10.1, 1.3, 0.45, -2.5],
    ] as const,
    bands: 2.5,
    bandEdge: 9,
    bandTail: 0.9,
    // the breath at rest slides a band by up to half of `breath` of its radius, and of no more than this radius: the
    // wide circles would else slide many times further than the small one
    breathMm: 16,
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
    // a band is gold far from the knot (`gold`) and a paler gold close by it (`bandNear`); the ground is `amber`, the
    // knot `pale`
    gold: [1, 0.52, 0.13] as const,
    bandNear: [1, 0.66, 0.28] as const,
    amber: [1, 0.5, 0.14] as const,
    pale: [1, 0.8, 0.5] as const,
  },
  // the seat: where the glass goes down into the base, its foot stands in the base's own shade and takes no light of the
  // room. A band on the glass, in millimetres above the base's foot: nothing of it above `top`, all of it from `full`
  // down to `foot`, which lies under the base's crest; `dark` of the light behind the glass is taken away in it. It lies
  // `proud` of the glass, so the glass's own lines are under it. On the sun's side of the picture the foot of the glass
  // stands in the sun's light, as the approved picture has it, and the band thins to nothing there: `thin` is between
  // which shares of the radius, counted sideways from the globe's middle toward the sun, it goes
  seat: { foot: 40.2, full: 43, top: 45, dark: 0.8, proud: 0.2, thin: [0.55, 0.72] as const },
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
// The flare is drawn twice. What the sun leaves on the glass itself, the hot line down the limb, is drawn with the globe.
// What the lens makes of the sun (the patch, its bloom and glow, the star) is drawn last of all, with the pool: the
// star lifts what lies behind it, and the stage draws the room's lights after the globe, so a lift drawn with the
// globe would miss them. What both begin with: what the vertex hands on, and where the pixel lies on the quad (q:
// along the outline's outward normal and along the outline, edge: the quad's soft end, off: how far off the
// outline, which bends away under a patch this long)
const FLARE_VARY = `
uniform vec4 uFlareSun;
varying vec2 vFl;
varying vec2 vFlOut;
varying float vFlGain;
varying float vFlBend;`
const FLARE_AT = `
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float lit = uFlareSun.w * vFlGain;
  if (lit <= 0.0) discard;
  vec2 p = vFl;
  vec2 q = vec2(dot(p, vFlOut), dot(p, vec2(-vFlOut.y, vFlOut.x)));
  float edge = 1.0 - smoothstep(0.62, 1.0, length(p));
  float off = length(vec2(vFlBend + q.x, q.y)) - vFlBend;`
// the hot line down the limb from the patch, just inside the outline
const FLARE_LINE = `${FLARE_VARY}
void main() {${FLARE_AT}
  float lineOff = (off + ${n(F.line[1])}) / ${n(F.line[2])};
  float lineUp = (q.y + ${n(F.line[3])}) / ${n(F.line[4])};
  float line = exp(-lineOff * lineOff - lineUp * lineUp);
  gl_FragColor = vec4(${vec(F.hot)} * (${n(F.line[0])} * line * lit * edge), 0.0);
}`
const FLARE_RAYS = `
// one ray of the star: a soft wedge that rises out of the bloom, runs on with it and fades to nothing before its reach.
// u: its direction, f: how far it reaches, the tangent of half the angle it opens by, how bright, how strong its lift.
// First the light it adds, second its lift. One exponential along the ray serves the lift and the light (its square)
vec2 flRay(vec2 q, vec2 u, vec4 f) {
  float ax = dot(q, u);
  if (ax <= 0.0 || ax >= f.x) return vec2(0.0);
  float cr = q.x * u.y - q.y * u.x;
  cr *= cr;
  float wide = f.y * f.y * ax * ax + ${(F.rayThin * F.rayThin).toFixed(6)};
  // nothing of it this far off its middle
  if (cr > 12.0 * wide) return vec2(0.0);
  float body = exp(-cr / wide) * smoothstep(0.0, ${n(F.rayRise)}, ax) * (1.0 - smoothstep(${n(F.rayEnd)}, 1.0, ax / f.x));
  float fall = exp(${n(-0.5 / F.rayLen)} * ax);
  return body * fall * vec2(f.z * fall, f.w);
}`
const FLARE_LENS = `${FLARE_VARY}${FLARE_RAYS}
void main() {${FLARE_AT}
  // across the outline and along it: both squared
  off *= off;
  float along = q.y * q.y;
  // the core: the light itself, mirrored; the sphere squeezes it across the outline and draws it out along it
  float core = exp(-(off / ${n(F.coreAcross * F.coreAcross)} + along / ${n(F.coreAlong * F.coreAlong)}));
  // the lens's bloom round it, brightest on the rim, and the warm glow round that as its tail: no edge
  float bloom = exp(-(off / ${n(F.bloomAcross * F.bloomAcross)} + along / ${n(F.bloomAlong * F.bloomAlong)}));
  float glow = exp(-sqrt(off / ${n(F.glowAcross * F.glowAcross)} + along / ${n(F.glowAlong * F.glowAlong)}));
  // the star: the rays stand out from the patch on the side away from the ball. x: the light they add, y: the lift
  vec2 star = vec2(0.0);
${F.rays.map((b) => `  star += flRay(q, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), vec4(${n(b[1])}, ${n(b[2])}, ${n(b[3])}, ${n(b[4])}));`).join('\n')}
  vec3 col = ${vec(F.hot)} * (${n(F.core)} * core + ${n(F.bloom)} * bloom) + ${vec(F.amber)} * (${n(F.glow)} * glow) + ${vec(F.rayHue)} * (${n(F.ray)} * star.x);
  // what is there is kept and lifted along the rays (the fourth number is what it is kept by, 1 and more), and the
  // lens's own light is added to that, itself not lifted
  gl_FragColor = vec4(col * (lit * edge), 1.0 + ${n(F.lift)} * star.y * lit * edge);
}`

const W = look.wall
// an arc that lies wholly in the upper left is drawn with the rest of the upper left, any other for the whole rim
const arcUpLeft = (b: readonly number[]): boolean => Math.abs(b[0] - W.rimUpLeft[0]) + b[1] <= W.rimUpLeft[1]
const arcLine = (b: readonly number[]): string =>
  `  rimGlow += ${vec(b[6] === 2 ? W.arcSteel : b[6] ? W.arcCool : W.arcCream)} * (${n(b[5])} * mirrored * wlStroke(e, arcAt, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${(1 - Math.cos(b[1] * RAD)).toFixed(6)}, vec3(${n(b[2])}, ${n(b[3])}, ${n(b[4])})));`
// a thread of the flame as the shader takes it: the angle up the limb at its foot and its length (radians), where in the
// radius it stands at the foot and how far it moves to the tip, half its width and how bright, the shares of its length
// over which it draws to a point and comes in, how bright it is at its tip, the share of its light in its skirt, the
// share of a steep side, and how many times longer it comes in over at its foot in the full storm. The angle is counted
// from the wall's middle, which lies at the bearing wallMid
const wallMid = Math.PI + Math.atan(W.low)
const threadLine = (t: readonly number[]): string =>
  `  ${t[6] ? 'warm' : 'white'} += wlThread(a, r, wlPx, vec4(${n(wallMid - t[0] * RAD)}, ${n((t[0] - t[1]) * RAD)}, ${n(1 - t[2])}, ${n(t[2] - t[3])}), vec4(${n(t[4])}, ${n(t[5])}, ${n(Math.max(t[7] / (t[0] - t[1]), 0.01))}, ${n(Math.max(t[8] / (t[0] - t[1]), 0.01))}), vec4(${n(t[9])}, ${n(t[10])}, ${n(t[11])}, ${n((1 + W.threadStorm) * t[12])}));`
// a line through the points k (pairs: where, how much), level before the first and past the last, as the shader takes it
const broken = (k: readonly (readonly number[])[], x: string): string =>
  n(k[0][1]) + k.slice(1).map((p, i) => ` + ${n((p[1] - k[i][1]) / (p[0] - k[i][0]))} * clamp(${x} - ${n(k[i][0])}, 0.0, ${n(p[0] - k[i][0])})`).join('')
const SH = W.sheaf
// how far up and down the limb from the glow's middle anything of the flame lies: the glow's own reach or a thread's end
const flameReach = Math.max(2.8 * W.glowSize[2], ...W.threads.map((t) => Math.max(Math.abs(wallMid - t[0] * RAD - W.hotAt[1]), Math.abs(wallMid - t[1] * RAD - W.hotAt[1])) + 0.02))
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
// one streak with one hard edge: light that begins at once on a line along the arc and falls off slowly to one side of
// it. f: where in the radius the hard edge lies, how far the light reaches from it (toward the outline, or toward the
// middle of the globe if it is less than nothing), how far the edge leans across the arc, half the edge's own width as
// a share of the reach. It is fainter toward its ends
float wlEdged(vec2 e, float r, vec2 u, float span, vec4 f) {
  float along = (1.0 - dot(e, u)) / span;
  if (along >= 1.0) return 0.0;
  float off = (r - f.x - f.z * (e.x * u.y - e.y * u.x)) / f.y;
  return smoothstep(-f.w, f.w, off) * exp(-1.4 * max(off, 0.0)) * (1.0 - along) * (1.0 - along);
}
${front && !rim ? `// one thread of the flame: it runs up the limb from its foot to its tip, comes in over the first of its length and
// draws to a point at its tip, where it goes out, and it is a spindle: as thin at its foot as at its tip, so neither
// end is cut. g: the angle up the limb at its foot and its length, where in
// the radius it stands at the foot and how far it moves to the tip; h: half its width, how bright, the share of its
// length its point takes and the share it comes in over; last: how bright it is at its tip beside its foot, the
// share of its light that lies beside it in a skirt three times as wide, which falls off slowly, the share of a steep
// side (its light then stands across it as a flat top with steep sides and not as a bell, where it is wider than a
// pixel and a half), and how many times longer it comes in over at its foot in the full storm. px: what one pixel
// spans (no thread is drawn thinner than that, only fainter), how many times wider every thread is in the storm, and
// what the storm leaves of the steep sides and of the short feet
float wlThread(float a, float r, vec3 px, vec4 g, vec4 h, vec4 last) {
  float t = (a - g.x) / g.y;
  if (t <= 0.0 || t >= 1.0) return 0.0;
  float tip = (1.0 - t) / (h.z * px.y);
  float foot = t / (h.w * mix(last.w, 1.0, px.z));
  float thin = h.x * px.y * (${n(W.threadPoint)} + ${n(1 - W.threadPoint)} * smoothstep(0.0, 2.5, min(tip, foot)));
  float wide = max(thin, px.x);
  float off = (r - g.z - g.w * t) / wide;
  float across = off * off;
  float steep = last.z * px.z * clamp(wide / (1.5 * px.x) - 1.0, 0.0, 1.0);
  float skirt = 1.0 + across / 9.0;
  return h.y * mix(1.0, last.x, t) * (exp(-across * (1.0 + steep * (across - 1.0))) + last.y / (skirt * skirt)) * (thin / wide) * smoothstep(0.0, 1.0, foot) * smoothstep(0.0, 1.0, tip);
}
// the mass of the flame: lanes of light side by side along the limb, each a hair that comes in softly at its foot,
// fills its lane along its middle and draws out to a needle at its tip. bear: the bearing in degrees, depth: how far
// inside the outline, px as the threads take it. A pixel lies between the middles of two lanes and takes the light of
// both. Each lane has its own numbers by its count across the sheaf: where it ends (three waves with pointed peaks
// and its own share) and begins, how long its points are, how bright it is. No lane is drawn thinner than its soft
// edge, only fainter. The core ends on one line across the lanes and the light falls off past it, the lanes run on
// into that fall. First the lanes' light, second the halo round the body
vec2 wlSheaf(float bear, float depth, vec3 px, float storm) {
  float dt = depth - ${n(SH.lean)} * (bear - 200.0) + ${n(SH.wave[0])} * sin((bear - 200.0) * ${n(SH.wave[1])} + depth * ${n(SH.wave[2])});
  if (dt >= ${n(SH.haloEnd[1])} || bear <= ${n(SH.haloEnd[2])} || bear >= ${n(SH.haloEnd[5])}) return vec2(0.0);
  float tipAt = ${broken(SH.tip, 'dt')};
  float footAt = ${broken(SH.foot, 'dt')};
  // the halo: whole inside the body's own box, and it falls off outside it by how far off, with no edge
  float haloOff = max(${n(SH.haloIn[0])} - dt, 0.0) * ${n(1 / SH.haloAcross[0])} + max(dt - ${n(SH.haloIn[1])}, 0.0) * ${n(1 / SH.haloAcross[1])};
  float haloPast = max(tipAt - bear - ${n(SH.haloTip)}, 0.0) * ${n(1 / SH.haloAlong[0])} + max(bear - footAt + ${n(SH.haloFoot)}, 0.0) * ${n(1 / SH.haloAlong[1])};
  float halo = ${n(SH.halo)} * exp(-length(vec2(haloOff, haloPast))) * (1.0 - smoothstep(${n(SH.haloEnd[0])}, ${n(SH.haloEnd[1])}, dt)) * smoothstep(${n(SH.haloEnd[2])}, ${n(SH.haloEnd[3])}, bear) * (1.0 - smoothstep(${n(SH.haloEnd[4])}, ${n(SH.haloEnd[5])}, bear)) * smoothstep(0.002, 0.025, depth);
  float side = clamp(${broken(SH.side, 'dt')}, 0.0, 1.0);
  if (side <= 0.0) return vec2(0.0, halo);
  float q = dt / ${n(SH.lane)} + ${n(SH.warp[0])} * sin(dt * ${n(SH.warp[1])} + 0.9) + ${n(SH.warp[2])} * sin(dt * ${n(SH.warp[3])} + 2.3) + 53.0;
  float j0 = floor(q - 0.5);
  float y = q - j0 - 0.5;
  float soft = max(${n(SH.soft)}, ${n(4 / 3)} * px.x / ${n(SH.lane)});
  // the core's edge: the two long waves at the place itself, so it is one line across the lanes, and the fall past it
  float grow = 1.0 + ${n(SH.storm[0])} * storm;
  float qc = q - 0.5;
  float edge = tipAt - (${n(SH.tongue[0])} * (1.0 - 2.0 * abs(sin(qc * ${n(SH.tongue[1])} + ${n(SH.tongue[2])}))) + ${n(SH.lock[0])} * (1.0 - 2.0 * abs(sin(qc * ${n(SH.lock[1])} + ${n(SH.lock[2])})))) * grow;
  // (and gone where the sheaf's own reach up the limb ends, so that no hair of the storm is cut there)
  float fall = exp(-max(edge - bear, 0.0) / (${n(SH.fall)} * px.y)) * smoothstep(${n(SH.haloEnd[2])}, ${n(SH.haloEnd[2] + 4)}, bear);
  float sum = 0.0;
  for (int i = 0; i < 2; i++) {
    float lane = j0 + float(i);
    float h = stageHash(vec3(lane, 13.0, 0.0));
    float hb = fract(64.0 * h);
    float hc = fract(4096.0 * h);
    float far = smoothstep(${n(SH.far[0])}, 1.0, hb);
    float reach = ${n(SH.tongue[0])} * (1.0 - 2.0 * abs(sin(lane * ${n(SH.tongue[1])} + ${n(SH.tongue[2])}))) + ${n(SH.lock[0])} * (1.0 - 2.0 * abs(sin(lane * ${n(SH.lock[1])} + ${n(SH.lock[2])}))) + ${n(SH.curl[0])} * (1.0 - 2.0 * abs(sin(lane * ${n(SH.curl[1])} + ${n(SH.curl[2])}))) + ${n(SH.fray)} * (2.0 * h - 1.0) + ${n(SH.far[1])} * far + ${n(SH.runOn)} * (${n(SH.runOnBy[0])} + ${n(SH.runOnBy[1])} * hc);
    float tip = (bear - tipAt + reach * grow) / (${n(SH.point)} * (${n(SH.pointBy[0])} + ${n(SH.pointBy[1])} * hc) * (1.0 + ${n(SH.far[2])} * far) * px.y);
    float stray = ${n(SH.footTongue[0])} * (1.0 - 2.0 * abs(sin(lane * ${n(SH.footTongue[1])} + ${n(SH.footTongue[2])}))) + ${n(SH.footFray)} * (2.0 * hb - 1.0);
    float foot = (footAt + stray * (1.0 + ${n(SH.storm[1])} * storm) - bear) / (${n(SH.come)} * (${n(SH.comeBy[0])} + ${n(SH.comeBy[1])} * hc) * (1.0 + ${n(SH.storm[2])} * storm));
    float share = ${n(SH.needle)} + ${n(1 - SH.needle)} * smoothstep(0.0, ${n(SH.part)}, min(tip, ${n(SH.footThin)} * foot));
    float box = clamp((0.5 * share - abs(y - float(i) - ${n(SH.wander)} * (hb - 0.5) * (1.0 - share))) / soft + 0.5, 0.0, 1.0) * min(share / soft, 1.0);
    float ends = smoothstep(0.0, 1.0, tip) * smoothstep(0.0, 1.0, foot);
    sum += box * ends * ends * (${n(SH.dim)} + ${n(1 - SH.dim)} * hc);
  }
  return vec2(${n(SH.bright)} * sum * fall * side, halo);
}
` : ''}void main() {
${front && !rim ? `  // what one pixel spans on the sheet, read before anything is discarded
  vec3 wlPx = vec3(0.75 * max(abs(dFdx(vWl.x)), abs(dFdy(vWl.y))), 1.0, 1.0);
` : ''}  float c = stageChange();
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
  if (r > 1.0 || r < ${n(W.rimInside)}) discard;
  float rimFoot = smoothstep(${n(W.rimFoot[0])}, ${n(W.rimFoot[1])}, e.y);
  if (rimFoot <= 0.0) discard;
  float upLeft = dot(e, vec2(${n(Math.cos(W.rimUpLeft[0] * RAD))}, ${n(Math.sin(W.rimUpLeft[0] * RAD))})) - ${n(Math.cos(W.rimUpLeft[1] * RAD))};
  if (r < ${n(W.rimAt[0])} && upLeft <= 0.0) discard;
  float rimRight = smoothstep(0.1, 0.6, e.x);
  float rimBand = smoothstep(mix(${n(W.rimAt[0])}, ${n(W.rimAtRight[0])}, rimRight), mix(${n(W.rimAt[1])}, ${n(W.rimAtRight[1])}, rimRight), r) * (1.0 - smoothstep(${n(W.rimAt[2])}, ${n(W.rimAt[3])}, r));
  float rimWaver = r + ${n(W.rimWaver)} * (stageNoise(vec3(e * 6.0 + 3.0, 2.2)) - 0.5);
  float rimLeft = 1.0 - smoothstep(-0.6, 0.1, e.x);
  float lines = smoothstep(0.5, 0.72, stageNoise(vec3(rimWaver * ${n(W.rimLines)} + 11.0, e * ${n(W.rimLong)})));
  float fine = lines;
  // down the left the lines are hairs that wander: each is drawn where its cell of the wall's grain is half way up
  if (rimLeft > 0.0 && r >= ${n(W.rimAt[0])}) {
    float hair = smoothstep(${n(W.rimHair[0])}, ${n(W.rimHair[1])}, 1.0 - abs(2.0 * stageNoise(vec3(rimWaver * ${n(W.rimLinesWide)} + 37.0, e * ${n(W.rimLong * W.rimWideShort)} + 5.0)) - 1.0)) * smoothstep(${n(W.rimHair[3] - 0.1)}, ${n(W.rimHair[3] + 0.1)}, stageNoise(vec3(e * ${n(W.rimHair[2])} + 9.0, rimWaver * 24.0)));
    fine = mix(fine, max(${n(W.rimLinesShare[0])} * fine, ${n(W.rimLinesShare[1])} * hair), rimLeft);
  }
  float rimUp = smoothstep(${n(W.rimTopAt[1])}, ${n(W.rimTopAt[2])}, dot(e, vec2(${n(Math.cos(W.rimTopAt[0] * RAD))}, ${n(Math.sin(W.rimTopAt[0] * RAD))})));
  float rimSh = smoothstep(${n(W.rimShoulderAt[1])}, ${n(W.rimShoulderAt[2])}, dot(e, vec2(${n(Math.cos(W.rimShoulderAt[0] * RAD))}, ${n(Math.sin(W.rimShoulderAt[0] * RAD))})));
  vec3 rimHue = mix(mix(${vec(W.rimLeft)} * rimLeft + ${vec(W.rimRight)} * rimRight, ${vec(W.rimTop)}, rimUp), ${vec(W.rimShoulder)}, rimSh);
  // right of the top the line lies further in and is wider; over the top and left of it it stays at the outline
  float rimOver = smoothstep(${n(W.rimTopWide[1])}, ${n(W.rimTopWide[2])}, dot(e, vec2(${n(Math.cos(W.rimTopWide[0] * RAD))}, ${n(Math.sin(W.rimTopWide[0] * RAD))}))) * (1.0 - rimSh);
  float rimOff = (r - mix(mix(${n(W.rimLine[0])}, ${n(W.rimLeftLine[0])}, rimLeft), ${n(W.rimTopLine[0])}, rimOver)) / mix(mix(${n(W.rimLine[1])}, ${n(W.rimLeftLine[1])}, rimLeft), ${n(W.rimTopLine[1])}, rimOver);
  float rimIn = (r - ${n(W.rimInner[0])}) / ${n(W.rimInner[1])};
  float rimWide = mix(mix(${n(W.rimBandBy[0])} * rimLeft + ${n(W.rimBandBy[1])} * rimRight, ${n(W.rimBandBy[2])}, rimUp), ${n(W.rimBandBy[3])}, rimSh);
  float rimThin = mix(mix(${n(W.rimLineBy[0])} * rimLeft + ${n(W.rimLineBy[1])} * rimRight, ${n(W.rimLineBy[2])}, rimUp), ${n(W.rimLineBy[3])}, rimSh);
  float rimBare = mix(mix(${n(W.rimBare[0])} * rimLeft + ${n(W.rimBare[1])} * rimRight, ${n(W.rimBare[2])}, rimUp), ${n(W.rimBare[3])}, rimSh);
  float rimLight = rimBand * mix(fine, 1.0, rimBare) * rimWide + ${n(W.rimLine[2])} * exp(-rimOff * rimOff) * rimThin;
  vec3 rimGlow = rimHue * rimLight + ${vec(W.rimInnerColor)} * (${n(W.rimInner[2])} * exp(-rimIn * rimIn) * rimLeft * (0.15 + 0.85 * fine));
  rimGlow *= ${n(W.rim)} * rimFoot;
  // the flame's light on the outline beside it
  float rimFlameOff = (r - ${n(W.rimFlame[1])}) / ${n(W.rimFlame[2])};
  float rimClear = 1.0 - ${n(W.stormDulls)} * storm;
  rimGlow += ${vec(W.rimFlameColor)} * (${n(W.rimFlame[0])} * exp(-rimFlameOff * rimFlameOff) * rimLeft * smoothstep(${n(W.rimFlameEnds[0])}, ${n(W.rimFlameEnds[1])}, e.y) * (1.0 - smoothstep(${n(W.rimFlameEnds[2])}, ${n(W.rimFlameEnds[3])}, e.y)) * rimClear * rimClear);
  // the sky against the outline above the flare, one band that fades inward, and the thin arcs inside the outline
  float mirrored = (1.0 - ${n(W.stormClears - W.reflexStorm)} * storm) * rimFoot;
  float arcAt = 2.0 * rimWaver - r;
  float skyEdge = ${n(1 - W.rimSky[3])} + ${n(W.rimSky[4])} * (e.y * ${n(Math.cos(W.rimSky[0] * RAD))} - e.x * ${n(Math.sin(W.rimSky[0] * RAD))});
  rimGlow += ${vec(W.rimSkyColor)} * (${n(W.rimSky[8])} * smoothstep(skyEdge - ${n(W.rimSky[6])}, skyEdge + ${n(W.rimSky[5])}, r) * smoothstep(${n(W.rimAt[0])}, ${n(W.rimAt[0] + W.rimSky[7])}, r) * smoothstep(${n(W.rimSky[1])}, ${n(W.rimSky[2])}, dot(e, vec2(${n(Math.cos(W.rimSky[0] * RAD))}, ${n(Math.sin(W.rimSky[0] * RAD))}))) * mirrored);
  rimGlow += ${vec(W.arcSteel)} * (${n(W.rimSteel[7])} * smoothstep(${n(W.rimSteel[3])}, ${n(W.rimSteel[4])}, r) * (1.0 - smoothstep(${n(W.rimSteel[5])}, ${n(W.rimSteel[6])}, r)) * smoothstep(${n(W.rimSteel[1])}, ${n(W.rimSteel[2])}, dot(e, vec2(${n(Math.cos(W.rimSteel[0] * RAD))}, ${n(Math.sin(W.rimSteel[0] * RAD))}))) * mirrored);
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
  float rimDarkAt = storm * (1.0 - smoothstep(0.5, 0.92, e.y)) * mix(0.75, 1.0, smoothstep(-0.5, 0.3, e.y)) * (1.0 - smoothstep(-0.6, -0.3, e.x)) * smoothstep(${n(W.rimDarkEnds[0])}, ${n(W.rimDarkEnds[1])}, e.y);
  float rimDark = ${n(W.rimDark[0])} * rimDarkAt * lit * smoothstep(${n(W.rimDark[1])}, ${n(W.rimDark[2])}, r) * (1.0 - smoothstep(${n(W.rimDark[3])}, ${n(W.rimDark[4])}, r));
  // and outside the dark line the outline itself is one thin copper line
  float stormLine = (r - ${n(W.rimStormLine[1])}) / ${n(W.rimStormLine[2])};
  rimGlow += ${vec(W.rimStormColor)} * (${n(W.rimStormLine[0])} * rimDarkAt * exp(-stormLine * stormLine));
  gl_FragColor = vec4(rimGlow * (lit * step(r, 1.0) * (1.0 - ${n(W.rimDarkOwn)} * rimDark)), max(rimDark, rimShade));
  return;
` : ''}  // where up the limb: the angle from the wall's middle. At the very middle of the globe there is none to take
  vec2 swung = vec2(e.x * vWlDir.y - e.y * vWlDir.x, dot(e, vWlDir));
  float a = dot(swung, swung) > 0.0 ? atan(swung.x, swung.y) : 0.0;
  float inside = 1.0 - smoothstep(0.965, 0.993, r);
  // the crescent: thin toward the middle of the globe, full just inside the limb, gone at the limb itself
  float band = pow(max(smoothstep(${n(W.from)}, ${n(W.peak)}, r), 0.0), 2.2) * (1.0 - smoothstep(0.955, 0.992, r)) * exp(-a * a / ${n(W.wide * W.wide)});
  // the hot patch: a burn against the limb, white at its middle, falling off through gold into the liquid's amber glow
  float dr = r - ${n(W.hotAt[0])};
  float da = a - ${n(W.hotAt[1])};
${front ? `  if (r > 1.0 || ((dr < ${n(-2.8 * W.glowSize[0])} || abs(da) > ${n(flameReach)}) && (r < ${n(Math.min(W.edgeStorm[2] - 2.5 * W.edgeStorm[3], W.edgeIn[0] - 2.5 * W.edgeIn[1]))} || abs(a - ${n(W.edgeStorm[0])}) > ${n(2.2 * W.edgeStorm[1])}))) discard;` : ''}
  // the wall's amber at the limb: at rest a band inside the outline beside the flame's foot, and none of it outside the
  // glass; in the storm the broad edge it had
  float edgeOff = (r - ${n(W.edgeIn[0])}) / ${n(W.edgeIn[1])};
  float edgeUp = (a - ${n(W.edgeAt[0])}) / ${n(W.edgeAt[1])};
  float stormOff = (r - ${n(W.edgeStorm[2])}) / ${n(W.edgeStorm[3])};
  float stormUp = (a - ${n(W.edgeStorm[0])}) / ${n(W.edgeStorm[1])};
  vec3 edge = ${vec(W.edgeColor)} * (exp(-edgeOff * edgeOff - edgeUp * edgeUp) * (1.0 - smoothstep(0.996, 1.004, r)) * (1.0 - storm)) + ${vec(W.edgeStormColor)} * (exp(-stormOff * stormOff - stormUp * stormUp) * (1.0 - smoothstep(${n(W.edgeStormEnds[0])}, ${n(W.edgeStormEnds[1])}, r)) * storm);
${front && !rim ? `  // the flame: hairs of light that follow the limb. The lanes of the mass stand side by side and are one white body
  // along their middles; each begins and ends at its own height in a needle, so the mass frays into points up the
  // limb and down it and has no cut edge. Beside the outline, past its upper end and inward of it single threads
  // stand alone. In the storm every thread is wider and as bright at its middle, its steep sides go and each comes in
  // over a longer stretch of its own, so they run together into one torn cloud with a ragged foot
  float white = 0.0;
  float warm = 0.0;
  wlPx.y = 1.0 + ${n(W.threadStorm)} * storm;
  wlPx.z = 1.0 - storm;
${W.threads.map(threadLine).join('\n')}
  vec2 sheaf = wlSheaf(${n(wallMid / RAD)} - a * ${n(1 / RAD)}, 1.0 - r, wlPx, storm);
  white += sheaf.x;
  float glow = exp(-dr * dr / ${n(W.glowSize[0] * W.glowSize[0])} - da * da / (da < 0.0 ? ${n(W.glowSize[1] * W.glowSize[1])} : ${n(W.glowSize[2] * W.glowSize[2])}));
  // in the storm the liquid scatters the sun: the amber glow round the sheaf is duller. The threads are not
  float clear = 1.0 - ${n(W.stormDulls)} * storm;
  vec3 glare = ${vec(W.color)} * (${n(W.glow)} * glow * inside * clear) + (mix(${vec(W.flameWarm)}, ${vec(W.hotColor)}, white / (white + ${n(W.flameWarmHalf)})) * white + ${vec(W.threadWarm)} * warm + ${vec(SH.haloColor)} * sheaf.y) * ${n(W.hot)};
  gl_FragColor = vec4((glare + edge * ${n(W.edge * W.edgeFront)}) * (${n(W.gain)} * lit), 0.0);
  return;` : ''}
  vec3 col = ${vec(W.color)} * (${n(W.band)} * band) + edge * ${n(W.edge)};
  float body = 1.0 - smoothstep(0.86, 0.992, r);
  vec2 across = vec2(-vWlDir.y, vWlDir.x);
  vec2 off = vWl - vWlDir * 0.95 - across * ${n(W.spillAt)};
  vec3 spill = ${vec(W.spillColor)} * (${n(W.spill)} * exp(-dot(off, off) / 0.022) * lit);
  float still = 1.0 - ${n(W.stormClears)} * storm;
  float bank = 1.0 - ${n(W.hazeBanks)} + ${n(2 * W.hazeBanks)} * stageNoise(vec3(vWl / ${n(W.hazeBankSize)}, 3.7));
  bank *= ${n(1 - W.hazeFine)} + ${n(2 * W.hazeFine)} * stageNoise(vec3(vWl / ${n(W.hazeFineSize)}, 9.2));
  // the burn's light in the liquid, behind the miniature: close round the burn, and thinner over the left side of the ball
  float nearIn = (r - ${n(W.air[1])}) / (r < ${n(W.air[1])} ? ${n(W.air[3])} : ${n(W.air[4])});
  float nearUp = (a - ${n(W.air[2])}) / (a < ${n(W.air[2])} ? ${n(W.air[5])} : ${n(W.air[6])});
  float farIn = (r - ${n(W.airFar[1])}) / (r < ${n(W.airFar[1])} ? ${n(W.airFar[3])} : ${n(W.airFar[4])});
  float farUp = (a - ${n(W.airFar[2])}) / (a < ${n(W.airFar[2])} ? ${n(W.airFar[5])} : ${n(W.airFar[6])});
  vec3 air = (${vec(W.airColor)} * (${n(W.air[0])} * exp(-nearIn * nearIn - nearUp * nearUp)) + ${vec(W.airFarColor)} * (${n(W.airFar[0])} * exp(-farIn * farIn - farUp * farUp) * bank * bank)) * (body * still);
  float thick = 1.0 - smoothstep(${n(W.hazeLimb[0])}, ${n(W.hazeLimb[1])}, r);
  float column = (vWl.x - ${n(W.hazeAt)}) / ${n(W.hazeWide)};
  float plume = exp(-column * column);
  float rise = max(vWl.y - ${n(W.hazeLow)}, 0.0) / (${n(W.hazeTall * W.hazeSideTall)} + ${n(W.hazeTall * (1 - W.hazeSideTall))} * plume);
  // the thin warm veil over the dome, even and without a patch, and the bodies of light that lie in it
  float glowing = 0.0;
${W.fillBody.map((b) => `  glowing += ${n(b[4])} * exp(-dot((vWl - vec2(${n(b[0])}, ${n(b[1])})) / vec2(${n(b[2])}, ${n(b[3])}), (vWl - vec2(${n(b[0])}, ${n(b[1])})) / vec2(${n(b[2])}, ${n(b[3])})));`).join('\n')}
  air += (${vec(W.fillColor)} * (${n(W.fill)} * inside) + ${vec(W.bodyColor)} * (glowing * (1.0 - smoothstep(${n(W.bodyLimb[0])}, ${n(W.bodyLimb[1])}, r)) * bank)) * still;
  air += ${vec(W.hazeColor)} * (${n(W.haze)} * still * thick * bank * (${n(W.hazeRim)} + ${n(1 - W.hazeRim)} * plume) * exp(-rise * rise * rise));
  air += ${vec(W.hazeColor)} * (${n(W.hazeHigh)} * bank * exp(-max(vWl.y - ${n(W.hazeLow)}, 0.0) / ${n(W.hazeHighTall)}) * mix(${n(W.hazeHighLeft)}, 1.0, smoothstep(-0.8, 0.5, vWl.x)) * still * thick);
  vec2 fromDome = vWl - vec2(${n(W.domeAt[0])}, ${n(W.domeAt[1])});
  fromDome.x /= fromDome.x < 0.0 ? ${n(W.domeSize[0])} : ${n(W.domeSize[1])};
  fromDome.y /= ${n(W.domeSize[2])};
  air += ${vec(W.domeColor)} * (${n(W.dome)} * exp(-dot(fromDome, fromDome)) * still * thick * bank);
  vec2 fromCore = (vWl - vec2(${n(W.coreAt[0])}, ${n(W.coreAt[1])})) / vec2(${n(W.coreSize[0])}, ${n(W.coreSize[1])});
  air += ${vec(W.coreColor)} * (${n(W.core)} * exp(-dot(fromCore, fromCore)) * still * thick * bank);
  air *= uSummerAir;
  // the glass's own reflections: curved bands down the right shoulder and one inside the ribbon's end
  vec3 reflex = vec3(0.0);
  float turn = dot(e, e) > 0.0 ? atan(e.y, e.x) : 0.0;
${W.reflex.map((b) => `  reflex += ${vec(b[5] === 4 ? W.reflexSlate : b[5] === 3 ? W.reflexSteel : b[5] === 2 ? W.reflexDeep : W.reflexCool)} * (${n(b[4])} * wlArc(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec2(${n(b[2])}, ${n(b[3])})));`).join('\n')}
  if (reflex.r > 0.0) reflex *= ${n(1 - W.reflexLined)} + ${n(2 * W.reflexLined)} * smoothstep(0.25, 0.75, stageNoise(vec3(r * ${n(W.reflexLines)}, e * ${n(W.reflexLong)})));
  // the slab down the right shoulder: the room's cool light in the glass, one broad band with hard edges, brightest at
  // its outer edge. Its lower end is ragged: the fine lines of the glass end each at its own bearing
  float slabOut = ${n(W.slabOuter[0])} - ${n(W.slabOuter[1])} * smoothstep(${n(W.slabOuter[2] * RAD)}, ${n(W.slabOuter[3] * RAD)}, turn);
  float slabIn = ${n(W.slabInner[0])} + ${n(W.slabInner[1])} * (1.0 - smoothstep(${n(W.slabInner[2] * RAD)}, ${n(W.slabInner[3] * RAD)}, turn));
  float slab = (1.0 - smoothstep(-1.0, 1.0, (r - slabOut) / ${n(W.slabEdge[0])})) * smoothstep(-1.0, 1.0, (r - slabIn) / ${n(W.slabEdge[1])}) * (1.0 - smoothstep(${n(W.slabEnds[2] * RAD)}, ${n(W.slabEnds[3] * RAD)}, turn)) * step(${n((W.slabEnds[0] - 0.5 * W.slabFray) * RAD)}, turn);
  if (slab > 0.0) {
    float slabGrain = stageNoise(vec3(r * ${n(W.slabLines)} + 5.0, e * ${n(W.reflexLong)}));
    slab *= smoothstep(${n(W.slabEnds[0] * RAD)}, ${n(W.slabEnds[1] * RAD)}, turn + ${n(W.slabFray * RAD)} * (smoothstep(0.3, 0.7, slabGrain) - 0.5)) * (${n(1 - W.slabLined)} + ${n(2 * W.slabLined)} * slabGrain) * mix(${n(W.slabFall)}, 1.0, smoothstep(slabIn, slabOut, r));
    reflex += ${vec(W.slabColor)} * (${n(W.slab)} * slab);
  }
  // streaks with one hard edge, right of the top between the outline and the ribbon
${W.edged.map((b) => `  reflex += ${vec(b[6] === 2 ? W.reflexSteel : b[6] ? W.reflexCool : W.edgedCream)} * (${n(b[5])} * wlEdged(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec4(${n(b[2])}, ${n(b[3])}, ${n(b[4])}, ${n(W.edgedHard)})));`).join('\n')}
  // the ribbon: the room's lit wall in the far side of the glass. turn is the bearing. Its lower edge is hard all along
  // and its upper one from the top leftward; across it lie three lanes, the brightest at the lower edge, dimming
  // smoothly upward into a dim one, and one with a hard lower edge under the upper edge; over the top a copper skirt
  // stands on its upper edge
  float ribSlow = ${n(W.ribbonElbow[1])} + ${n(W.ribbonElbow[2])} * (turn - ${n(W.ribbonElbow[0])});
  float ribFast = ${n(W.ribbonLevel[0])} + ${n(W.ribbonElbow[1] - W.ribbonLevel[0])} * exp(min(turn - ${n(W.ribbonElbow[0])}, 1.0) / ${n(W.ribbonLevel[1])});
  float ribNear = max(${n(W.ribbonRound)} - abs(ribSlow - ribFast), 0.0);
  float ribUp = min(ribSlow, ribFast) - ribNear * ribNear * ${n(0.25 / W.ribbonRound)};
  float ribLow = mix(${n(W.ribbonLow[0])}, ${n(W.ribbonLow[1])}, smoothstep(-1.0, 1.0, (${n(W.ribbonLow[2])} - turn) / ${n(W.ribbonLow[3])})) + ${n(W.ribbonLow[4])} * (1.0 - smoothstep(0.75, 1.0, turn)) + ${n(W.ribbonLift[0])} * exp(-(turn - ${n(W.ribbonLift[1])}) * (turn - ${n(W.ribbonLift[1])}) / ${(W.ribbonLift[2] * W.ribbonLift[2]).toFixed(6)});
  ribLow = 0.5 * (ribLow + ${n(W.ribbonLowTop[0])} - sqrt((ribLow - ${n(W.ribbonLowTop[0])}) * (ribLow - ${n(W.ribbonLowTop[0])}) + ${(W.ribbonLowTop[1] * W.ribbonLowTop[1]).toFixed(6)}));
  float ribLeft = smoothstep(${n(W.ribbonElbow[0] - 0.15)}, ${n(W.ribbonElbow[0] + 0.35)}, turn);
  float ribHard = mix(${n(W.ribbonUpper[0])}, ${n(W.ribbonUpper[1])}, smoothstep(${n(W.ribbonFirm[0])}, ${n(W.ribbonFirm[1])}, turn));
  float ribIn = smoothstep(${n(W.ribbonEnds[0])}, ${n(W.ribbonEnds[1])}, turn) * (1.0 - smoothstep(${n(W.ribbonEnds[2])}, ${n(W.ribbonEnds[3])}, turn));
  float ribbon = smoothstep(-1.0, 1.0, (r - ribLow) / mix(${n(W.ribbonLower[0])}, ${n(W.ribbonLower[1])}, ribLeft)) * (1.0 - smoothstep(-1.0, 1.0, (r - ribUp) / ribHard)) * ribIn;
  if (ribbon > 0.0) {
    float ribAt = (r - ribLow) / max(ribUp - ribLow, 0.01);
    float ribLane = ribAt + ${n(W.ribbonWander[0])} * sin(turn * ${n(W.ribbonWander[1])} + 2.0) + ${n(W.ribbonWander[2])} * sin(turn * ${n(W.ribbonWander[3])} + 0.5);
    float ribDim = mix(${n(W.ribbonLane[0])}, ${n(W.ribbonLane[1])}, ribLeft);
    float lanes = 1.0 - (1.0 - ribDim) * smoothstep(${n(W.ribbonLanes[0])}, ${n(W.ribbonLanes[1])}, ribLane) + (${n(W.ribbonLane[2])} - ribDim) * smoothstep(${n(W.ribbonLanes[2])}, ${n(W.ribbonLanes[3])}, ribLane);
    ribbon *= (1.0 + ${n(W.ribbonPeak[0])} * exp(-(turn - ${n(W.ribbonPeak[1])}) * (turn - ${n(W.ribbonPeak[1])}) / ${n(W.ribbonPeak[2] * W.ribbonPeak[2])})) * mix(${n(W.ribbonBase[0])}, ${n(W.ribbonBase[1])}, ribLeft) * lanes * (${n(1 - W.ribbonStreaked[0])} + ${n(2 * W.ribbonStreaked[0])} * smoothstep(0.3, 0.7, stageNoise(vec3(ribAt * ${n(W.ribbonStreaks[0])} + 3.0, turn * 3.5 + 9.0, 7.7)))) * (${n(1 - W.ribbonStreaked[1])} + ${n(2 * W.ribbonStreaked[1])} * smoothstep(0.25, 0.75, stageNoise(vec3(ribAt * ${n(W.ribbonStreaks[1])}, turn * 5.0 + 13.0, 2.9))));
  }
  reflex += ${vec(W.ribbonColor)} * (${n(W.ribbon)} * ribbon);
  float ribSkirt = clamp(1.0 - (r - ribUp) / ${n(W.ribbonSkirt[1])}, 0.0, 1.0);
  reflex += ${vec(W.ribbonSkirtColor)} * (${n(W.ribbonSkirt[0])} * ribSkirt * ribSkirt * smoothstep(-1.0, 1.0, (r - ribUp) / ribHard) * exp(-(turn - ${n(W.ribbonSkirt[2])}) * (turn - ${n(W.ribbonSkirt[2])}) / ${(W.ribbonSkirt[3] * W.ribbonSkirt[3]).toFixed(6)}) * ribIn);
  // under it the glass holds the room's warm dark: one thin brown arc
  float underOff = (r - ribLow + ${n(W.under[0])}) / ${n(W.under[1])};
  reflex += ${vec(W.underColor)} * (${n(W.under[2])} * exp(-underOff * underOff) * smoothstep(${n(W.underEnds[0])}, ${n(W.underEnds[1])}, turn) * (1.0 - smoothstep(${n(W.underEnds[2])}, ${n(W.underEnds[3])}, turn)));
  air += reflex * (inside * (still + ${n(W.reflexStorm)} * storm));
  // the light on the glass: a few thin streaks along the arc
  vec3 glints = vec3(0.0);
${W.glint.map((b, i) => `  glints += ${vec(W.glintHue)} * (${n(b[5])} * wlStreak(e, r, vec2(${n(Math.cos(b[0] * RAD))}, ${n(Math.sin(b[0] * RAD))}), ${n(1 - Math.cos(b[1] * RAD))}, vec4(${n(b[2])}, ${n(b[3])}, ${n(b[4])}, ${n(3.7 * i + 1.3)})));`).join('\n')}
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
// to both ends. Across itself it is a fold of light: clear at its outer edge, soft inward
float poolBand(vec2 h, vec2 c, float q, float at, float span, float wide) {
  vec2 v = h - c;
  float phi = dot(v, v) > 0.0 ? atan(v.y, v.x) : 0.0;
  float turn = abs(mod(phi - at + 3.14159265, 6.2831853) - 3.14159265) / span;
  if (turn >= 1.0) return 0.0;
  float ends = 1.0 - turn * turn;
  float off = (length(v) - q) / (wide * (0.4 + 0.6 * ends));
  return exp(off > 0.0 ? ${n(-P.bandEdge)} * off * off : ${n(P.bandTail)} * off) * ends * ends;
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
${P.band.map((b, i) => `  bands += ${n(b[6])} * poolBand(h, vec2(${n(b[0])}, ${n(b[1])}), ${n(b[2])} + ${n((i % 2 ? -0.5 : 0.5) * Math.min(b[2], P.breathMm))} * breath + ${n(b[7])} * sway, ${n(b[3] * RAD)} + ${n(i % 2 ? -0.1 : 0.1)} * sway, ${n(b[4] * RAD)}, ${n(b[5])});`).join('\n')}
  bands *= ${n(1 - P.bandMottle)} + ${n(P.bandMottle)} * sheet;
  float pool = (${n(P.gain)} * soft + ${n(P.near)} * near) * (${n(1 - P.mottle)} + ${n(P.mottle)} * sheet);
  // the bands lie in the pool and go out with it at its rim
  float lines = ${n(P.bands)} * bands * (0.2 + 0.8 * min(soft + near, 1.0));
${Number(P.grains) > 0 ? `  vec2 cell = floor(h / ${n(P.grainCellMm)});
  vec2 grainAt = (cell + 0.25 + 0.5 * vec2(stageHash(vec3(cell + 4096.0, 0.31)), stageHash(vec3(cell + 4096.0, 0.57)))) * ${n(P.grainCellMm)};
  float grainWide = max(${n(P.grainMm)}, 0.6 * max(length(hx), length(hy)));
  float chance = stageHash(vec3(cell + 4096.0, 0.83));
  float sparks = ${n(P.grains)} * exp(-dot(h - grainAt, h - grainAt) / (grainWide * grainWide)) * (${n(P.grainMm)} / grainWide) * smoothstep(0.86, 1.0, chance) * min(2.5 * bands, 1.0) * smoothstep(2.0, 12.0, len);` : '  float sparks = 0.0;'}
  vec3 col = ${vec(P.amber)} * pool + mix(${vec(P.bandNear)}, ${vec(P.gold)}, smoothstep(${n(0.3 * P.softMm)}, ${n(1.4 * P.softMm)}, len)) * lines + ${vec(P.pale)} * (${n(P.core)} * core + ${n(P.glow)} * glow + sparks);
  gl_FragColor = vec4(col * there, 0.0);
}`

const S = look.seat
const SEAT = `
varying float vSeatY;
varying float vSeatX;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float dark = ${n(S.dark)} * (1.0 - smoothstep(${n(S.full)}, ${n(S.top)}, vSeatY)) * (1.0 - smoothstep(${n(S.thin[0])}, ${n(S.thin[1])}, vSeatX));
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

// where the flare's quad stands: both of its passes place themselves from the eye and the light, wherever they hang
const FLARE_VERT_PARS = 'uniform vec4 uFlareSun;\nvarying vec2 vFl;\nvarying vec2 vFlOut;\nvarying float vFlGain;\nvarying float vFlBend;'
const FLARE_VERT = `
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
vFlGain = clamp((0.04 + 0.96 * pow(max(1.0 - flCos, 0.0), 5.0)) / 0.2, 0.25, 1.6);
flAt.xy += position.xy * ${n(F.halfMm)};
gl_Position = projectionMatrix * flAt;
vStageWorld = flP;
vStageLocal = (uGlobeInv * vec4(flP, 1.0)).xyz;
vStagePlaced = flP;
vStageAux = vec3(0.0, -flAt.z, length(flAt.xyz));`

function makeFlare(lens: boolean): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uFlareSun: uniforms.uFlareSun },
    vertexPars: FLARE_VERT_PARS,
    vertexMain: FLARE_VERT,
    fragment: lens ? FLARE_LENS : FLARE_LINE,
    // the lens keeps what is there by its fourth number and adds its own light to that
    params: lens ? { ...added, blendDst: THREE.SrcAlphaFactor, depthTest: false } : { ...added, depthTest: false },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)
  // the line after the glass and its rim; the lens after everything the stage draws last, the room's lights too
  mesh.renderOrder = lens ? 30 : 14
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
let pool: THREE.Object3D | undefined

// The seat's band: a strip of the sphere just outside the glass, drawn after the glass and its ring and multiplied into what
// is there, so everything seen through the foot of the glass is in shade. The base's crest stands in front of its lower part
function makeSeat(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uFlareSun: uniforms.uFlareSun },
    vertexPars: 'uniform vec4 uFlareSun;\nvarying float vSeatY;\nvarying float vSeatX;',
    // how high above the base's foot, and how far sideways from the globe's middle in the picture, toward the sun, in radii
    vertexMain: `vSeatY = position.y + ${n(centreHeightMm)};
vSeatX = ((viewMatrix * vec4(uFlareSun.xyz, 0.0)).x < 0.0 ? -1.0 : 1.0) * (mvPosition.x - (viewMatrix * vec4(uLensCentre, 1.0)).x) / ${n(RS)};`,
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
/** What the season puts on the glass: the light on the far wall, the seat's band and the sun's line. It rides in the globe's group and places itself from the eye and the light. */
export function dressing(): THREE.Object3D {
  if (!flare) {
    flare = new THREE.Group()
    flare.add(makeWall(false), makeSeat(), makeWall(true), makeWall(true, true), makeFlare(false))
  }
  return flare
}

/** The pool of light on the slab, and with it what the lens makes of the sun. They lie in the floor's group, which the stage draws last: `slab.ts` adds them to what it lays on the surface. */
export function surfacePool(): THREE.Object3D {
  if (!pool) {
    pool = new THREE.Group()
    pool.add(makePool(), makeFlare(true))
  }
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
