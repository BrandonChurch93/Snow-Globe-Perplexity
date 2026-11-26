import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { setGlass } from '../../globe/shell'
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
//    shadow: a soft pool of warm light, brightest at a knot by the foot, and inside it the net of light that water throws on
//    the floor of a pool, long in the light's direction because the sun is low. The net slides when the globe moves, swings
//    to rest after the landing and breathes a little while the water is still.
// 3. The wall: the sun, bent by the globe, burns a patch on the inside of the glass low on the far side; the same billboard
//    carries the warm haze of the liquid at rest and the glow of the storm (by the liquid's turbulence). It is drawn with the
//    interior, straight after the view through the liquid and before the miniature, so all of it lies behind the cottage and
//    the tree: the crown is a dark mass against bright air, as the approved image has it, and nothing is laid over the
//    miniature's detail.
// Nothing here is stepped: both are functions of the moment's pose, of the time and of the time since the landing.
const PART = 'glass-dressing-summer'
const RS = config.globe.sphereDiameterMm / 2
const TAU = Math.PI * 2

setGlass('summer', { windowTint: [0.9, 0.86, 0.78], windowGain: [0.14, 0.1, 0.14, 0.1], windowSoftDeg: 5, windowGrain: 0.5, rimTint: [0.8, 1, 1.25], wallTint: [0.9, 0.75, 0.45], ringCover: 0.35, strip: 0, bend: 0, ringThin: 1, rimClear: 0.3, topLine: 0, ringMottle: 0.3, ceiling: 0.35, roomHue: [0.85, 0.98, 1.15], roomHueOn: 1, windowShade: 0, rimGlow: 0, arcs: 0.4, arcTint: [1, 0.9, 0.74], arcCool: 1.6 })

export const look = {
  // leaving: the light goes out between these two counts of beats before the swap window opens
  leaveBeats: [1.1, 0.2] as const,
  flare: {
    halfMm: 30,
    core: 30,
    coreAcross: 0.036,
    coreAlong: 0.07,
    // the bloom of the lens round the core: a soft ball a few millimetres wide
    bloom: 3.2,
    bloomWide: 0.06,
    halo: 1.3,
    haloWide: 0.12,
    veil: 0.04,
    // the star: many soft tapered rays, short, each with its own length, widest at the core, fanning away from the globe
    rays: 1.4,
    spikes: 14,
    reach: [0.31, 0.22] as const,
    rayWide: [0.008, 0.02] as const,
    arc: 1.6,
    hot: [1, 0.9, 0.72] as const,
    warm: [1, 0.7, 0.38] as const,
    amber: [1, 0.52, 0.2] as const,
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
    // the hot patch: the sun, bent by the globe, lands on the inside of the glass low on the far side and burns out there.
    // Where (share of the radius, radians up the limb from the wall's middle), how wide, how far it runs down to the ground
    // and how far up the limb, how strong
    hot: 60,
    hotAt: [0.875, -0.05] as const,
    hotSize: [0.046, 0.09, 0.13] as const,
    hotColor: [1, 0.8, 0.55] as const,
    // above the burn the wall parts the light into slanted strokes that climb the limb: how many lie across one globe
    // radius, how far each leans out toward the limb as it climbs, how far up they reach (radians), how wide the sheaf is
    // and how strong
    brush: 62,
    brushLean: 0.16,
    brushTall: 0.22,
    brushWide: 0.055,
    brushGain: 0.03,
    // how much of the burn's skirt and of the glow the strokes take away between them
    brushDeep: [0.8, 0.6] as const,
    // the amber glow of the liquid round the patch
    glow: 1,
    glowSize: [0.12, 0.2] as const,
    // its spill past the limb: the lens blooms round the patch, outside the glass too
    spill: 0.3,
    spillAt: 0.12,
    spillColor: [1, 0.62, 0.3] as const,
    // the limb's own warm edge on the far side: the glass wall takes the sun's amber low on the left, round the burn. How
    // strong, where up the limb (radians) and how far it runs, where in the radius and how thick
    edge: 2.6,
    edgeAt: [0, 0.34] as const,
    edgeIn: [0.966, 0.02] as const,
    edgeColor: [1, 0.5, 0.18] as const,
    // the air: the low sun in the liquid, warm on the side the light falls toward and nothing on the side it comes from
    air: 0.012,
    airColor: [1, 0.66, 0.36] as const,
    // the haze: the liquid behind the miniature holds the last sun. It is gold and fullest low, just over the ground
    // (`hazeLow`, in globe radii up the picture), and stands highest in a plume between the cottage and the tree (`hazeAt`,
    // `hazeWide`), `hazeTall` radii tall there and `hazeSideTall` of that at the sides, where it is `hazeRim` as strong. Over
    // it the liquid is clear: `hazeSky` is all it holds under the dome, so the dark of the room shows through the top of the
    // glass. `hazeBanks` is how unevenly it lies, in soft banks `hazeBankSize` globe radii across, so it reads as lit liquid
    // and never as a flat card
    haze: 0.32,
    hazeColor: [1, 0.64, 0.35] as const,
    hazeRim: 0.07,
    hazeAt: -0.08,
    hazeWide: 0.5,
    hazeLow: -0.46,
    hazeTall: 0.66,
    hazeSideTall: 0.55,
    hazeSky: 0.037,
    hazeSkySun: 0.3,
    hazeSkyColor: [1, 0.6, 0.33] as const,
    // the sun stands behind the glass at the flare: the liquid is brightest there, in a soft lobe that is down to a third
    // `sunLobeWide` globe radii from it and gone on the far side
    sunLobe: 0.138,
    sunLobeWide: 0.85,
    sunLobeColor: [1, 0.74, 0.5] as const,
    hazeBanks: 0.35,
    hazeBankSize: 0.42,
    // the storm: the seeds and the dust aloft take the sun and the whole dome glows white-gold; it goes with the liquid's
    // turbulence, in slow arms that turn with the time, and is thinner over the miniature so the lanterns stay
    storm: 0.03,
    // and the still air's haze behind the miniature gives way to it by this much: the storm is in front, in the veil
    stormClears: 0.45,
    stormFrom: 0.12,
    stormTo: 0.75,
    stormColor: [1, 0.68, 0.34] as const,
    stormArms: 0.22,
    stormOpen: 0.55,
    stormDulls: 0.8,
  },
  pool: {
    // where the hot middle of the pool lies from the foot's centre: down the light's way on the slab and a little across it
    reachMm: 76,
    sideMm: 2.7,
    // how far the low sun draws the pool out along its way
    stretch: 2.2,
    softMm: 16,
    gain: 0.006,
    core: 3.2,
    coreMm: 1.6,
    glow: 0.3,
    glowMm: 3,
    // the water's light: thin lines that run out from the knot, sway and fork. `trunks` lines leave the knot; each parts in
    // two between `forkMm` from it and each of those in two again, by up to `fork` radians a time. `kinkMm` is how far a
    // line sways aside, `kinkEveryMm` over what length, `thinMm` its half width, `lines` its brightness, `linesMm` how far it
    // reaches on the left, where the sun throws it, and `rightReach` of that on the right, where only a star of it shows
    trunks: 15,
    forkMm: [5, 26] as const,
    fork: [0.12, 0.3] as const,
    kinkMm: 1.5,
    kinkEveryMm: [24, 46] as const,
    thinMm: 0.12,
    lines: 3.5,
    // the soft light each line lies in, as a share of the line
    lineGlow: 0.004,
    // how far the lines' bearings are drawn together toward the side the sun throws them to (0 even, 1 all of them)
    gather: 0.4,
    // the brightest lines are `stout` times thicker again at the knot and back to their own width `stoutMm` out; every
    // line is `hair` of its width at its tip. Along it the light gathers in knots, `knots` times brighter and `swell`
    // times thicker again, and fails between them: below the first of `breaks` in the line's own noise it is gone, whole
    // above the second
    stout: 0.7,
    stoutMm: 26,
    hair: 0.6,
    knots: 2.2,
    swell: 0.4,
    knotPerMm: 0.42,
    breaks: [0.26, 0.36] as const,
    // grains of sand on the table take the light where a line passes within `grainsNearMm`: one to a cell `grainCellMm`
    // wide, `grainMm` in radius, one in seven of them lit
    grains: 12,
    grainMm: 0.07,
    grainCellMm: 1.3,
    grainsNearMm: 1.2,
    linesMm: 54,
    rightReach: 0.33,
    // the soft pool under the lines: the width of the water's cells that shade it, and how much of it they shade
    cellMm: 38,
    mottle: 0.4,
    drift: 0.35,
    breath: 0.06,
    breathCycles: 2,
    liftPerMm: 2.2,
    tiltMm: 160,
    swing: 1,
    swingSeconds: 1.1,
    swingHz: 1.7,
    // the arrival: the pool comes last, after the lanterns have come up one by one (kit, "The arrival": the flare kindles on
    // the landing, the lanterns over the next seconds, then "the pool of light settles on the surface"): nothing of it until
    // `afterSeconds` past the landing, whole `settleSeconds` later
    // `early` of it kindles with the flare (the approved mid-shake image has the pool under a stormy globe), within `kindleSeconds`
    afterSeconds: 2.0,
    settleSeconds: 1.1,
    early: 0.75,
    kindleSeconds: 0.18,
    gold: [1, 0.55, 0.14] as const,
    amber: [1, 0.36, 0.06] as const,
    pale: [1, 0.8, 0.5] as const,
    // the low sun on the table itself: a strip of dusty warm light past the far side of the globe's long shadow, which lies
    // down the light's way (the pool lies inside that shadow); its strength, how far it reaches along and across, the shadow's
    // half width and softness
    sun: 0.18,
    sunMm: 130,
    stripMm: 45,
    shadeMm: 52,
    shadeSoftMm: 9,
    sunColor: [1, 0.72, 0.42] as const,
  },
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
}

const F = look.flare
const FLARE = `
uniform vec4 uFlareSun;
uniform vec4 uSummer;
varying vec2 vFl;
varying vec2 vFlOut;
varying float vFlGain;
float flRnd(float i, float k) {
  return stageHash(vec3(i + 3.0, k * 17.0 + 5.0, 0.37));
}
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
  // the core: the light itself, mirrored small; across the limb the sphere squeezes it
  float core = exp(-(q.x * q.x / ${n(F.coreAcross * F.coreAcross)} + q.y * q.y / ${n(F.coreAlong * F.coreAlong)}));
  // the glass beside it takes the light along the limb
  float arc = exp(-q.x * q.x / 0.0009) * exp(-q.y * q.y / 0.09);
  float halo = exp(-r * r / ${n(F.haloWide * F.haloWide)}) + ${n(F.veil)} * exp(-r / 0.34);
  float bloom = exp(-r * r / ${n(F.bloomWide * F.bloomWide)});
  // the star: soft tapered rays through the core, each with its own length, breathing a little
  float star = 0.0;
  for (int i = 0; i < ${F.spikes}; i++) {
    float fi = float(i);
    float a = (fi + 0.8 * flRnd(fi, 1.0)) * ${n(Math.PI / F.spikes)} + 0.35;
    vec2 d = vec2(cos(a), sin(a));
    float along = dot(p, d);
    float across = p.x * d.y - p.y * d.x;
    float side = along > 0.0 ? flRnd(fi, 2.0) : flRnd(fi, 3.0);
    float reach = (${n(F.reach[0])} + ${n(F.reach[1])} * side * side) * (0.7 + 0.6 * max(dot(d * sign(along), vFlOut), 0.0)) * (1.0 + ${n(F.breath)} * sin(uSummer.x * (0.9 + 1.3 * flRnd(fi, 4.0)) + 6.28 * flRnd(fi, 5.0)));
    float t = abs(along) / reach;
    float wide = ${n(F.rayWide[0])} + ${n(F.rayWide[1])} * (1.0 - min(t, 1.0)) * (1.0 - min(t, 1.0));
    star += exp(-across * across / (wide * wide)) * exp(-2.6 * t) * (1.0 - smoothstep(0.6, 1.2, t)) * (0.4 + 0.6 * side) * (0.3 + 0.7 * max(dot(d * sign(along), vFlOut), 0.0));
  }
  vec3 col = ${vec(F.hot)} * (${n(F.core)} * core + ${n(F.bloom)} * bloom) + ${vec(F.warm)} * (${n(F.rays)} * star + ${n(F.arc)} * arc) + ${vec(F.amber)} * (${n(F.halo)} * halo);
  gl_FragColor = vec4(col * (lit * edge), 0.0);
}`

const W = look.wall
const WALL = `
uniform vec4 uFlareSun;
uniform vec4 uSummer;
varying vec2 vWl;
varying vec2 vWlDir;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float lit = min(uFlareSun.w, 1.0);
  float storm = uSummer.w;
  if (lit <= 0.0 && storm <= 0.0) discard;
  float r = length(vWl);
  if (r > 1.24) discard;
  vec2 e = vWl / max(r, 1e-4);
  float a = atan(e.x * vWlDir.y - e.y * vWlDir.x, dot(e, vWlDir));
  float inside = 1.0 - smoothstep(0.965, 0.993, r);
  // the crescent: thin toward the middle of the globe, full just inside the limb, gone at the limb itself
  float band = pow(smoothstep(${n(W.from)}, ${n(W.peak)}, r), 2.2) * (1.0 - smoothstep(0.955, 0.992, r)) * exp(-a * a / ${n(W.wide * W.wide)});
  // the hot patch: a burn against the limb, white at its middle, falling off through gold into the liquid's amber glow.
  // Above it the wall parts the light into a sheaf of slanted strokes that climbs the limb and thins out
  float dr = r - ${n(W.hotAt[0])};
  float da = a - ${n(W.hotAt[1])};
  float tall = da > 0.0 ? ${n(W.hotSize[2])} : ${n(W.hotSize[1])};
  float brush = stageNoise(vec3((r - ${n(W.brushLean)} * a) * ${n(W.brush)}, a * 3.0, 1.3));
  float stroked = smoothstep(0.3, 0.6, brush);
  float ragged = ${n(1 - W.brushDeep[0])} + ${n(W.brushDeep[0])} * stroked;
  float hot = exp(-dr * dr / ${n(W.hotSize[0] * W.hotSize[0])} - da * da / (tall * tall));
  hot *= mix(1.0, ragged, smoothstep(0.35, 1.2, dr * dr / ${n(W.hotSize[0] * W.hotSize[0])} + da * da / (tall * tall)));
  float sheafAt = r - ${n(W.hotAt[0] + 0.012)} - 0.05 * da;
  float sheaf = exp(-sheafAt * sheafAt / ${n(W.brushWide * W.brushWide)}) * smoothstep(-0.02, 0.12, da) * exp(-max(da, 0.0) / ${n(W.brushTall)});
  hot += ${n(W.brushGain)} * sheaf * smoothstep(0.52, 0.66, brush);
  float glow = exp(-dr * dr / ${n(W.glowSize[0] * W.glowSize[0])} - da * da / ${n(W.glowSize[1] * W.glowSize[1])}) * (${n(1 - W.brushDeep[1])} + ${n(W.brushDeep[1])} * stroked);
  float edge = exp(-pow(abs((r - ${n(W.edgeIn[0])}) / ${n(W.edgeIn[1])}), 2.0)) * exp(-pow(abs((a - ${n(W.edgeAt[0])}) / ${n(W.edgeAt[1])}), 2.0));
  // in the storm the liquid scatters the sun: the patch is a dull amber glow, not a burn
  float clear = 1.0 - ${n(W.stormDulls)} * storm;
  vec3 col = ${vec(W.color)} * (${n(W.band)} * band + ${n(W.glow)} * glow * inside * clear) + ${vec(W.edgeColor)} * (${n(W.edge)} * edge) + ${vec(W.hotColor)} * (${n(W.hot)} * hot * inside * clear * clear);
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
  air += ${vec(W.hazeColor)} * (${n(W.haze)} * still * body * bank * (${n(W.hazeRim)} + ${n(1 - W.hazeRim)} * plume) * exp(-rise * rise * rise));
  air += ${vec(W.hazeSkyColor)} * (${n(W.hazeSky)} * (1.0 + ${n(W.hazeSkySun)} * (1.0 - 2.0 * toward)) * still * body);
  air += ${vec(W.sunLobeColor)} * (${n(W.sunLobe)} * exp(-dot(vWl + 0.93 * vWlDir, vWl + 0.93 * vWlDir) / ${n(W.sunLobeWide * W.sunLobeWide)}) * smoothstep(0.15, 0.6, 1.0 - toward) * still * body);
  // the storm's light: slow broad arms about the middle, turning with the time
  float turn = atan(vWl.y, vWl.x);
  float arms = 1.0 - ${n(W.stormArms)} + ${n(W.stormArms)} * sin(2.0 * turn + 5.0 * r - 1.7 * uSummer.x) * smoothstep(0.05, 0.4, r);
  float open = 1.0 - ${n(W.stormOpen)} * exp(-(vWl.x * vWl.x / 0.42 + (vWl.y + 0.34) * (vWl.y + 0.34) / 0.14));
  vec3 gale = ${vec(W.stormColor)} * (${n(W.storm)} * storm * arms * open * body * (0.75 + 0.25 * toward));
  gl_FragColor = vec4(col * (${n(W.gain)} * lit) + air * lit + gale + spill, 0.0);
}`

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
float poolRnd(float i, float k) {
  return stageHash(vec3(i + 11.0, k * 13.0 + 2.0, 0.71));
}
// a line's sway to either side as it runs, -1 to 1
float poolKink(float t) {
  return sin(6.2831853 * t);
}
void main() {
  vec2 way = uPoolAt.zw;
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
  float len = length(h);
  float soft = exp(-len * len / ${n(P.softMm * P.softMm)});
  float core = exp(-len * len / ${n(P.coreMm * P.coreMm)});
  float glow = exp(-len / ${n(P.glowMm)});
  float z = ${n(P.drift)} * uSummer.y + uPoolFoot.z;
  float wide = poolWater(h / ${n(P.cellMm)} + 3.1, 0.6 * z + 0.37);
  float sheet = min(2.5 * wide * wide, 1.0);
  // the water's light runs out from the knot in thin lines. Each keeps its bearing, sways as it runs, and
  // parts in two and in two again; a line thinner than a pixel is drawn a pixel wide and as much dimmer, so it never steps
  float lines = 0.0;
  float tips = 0.0;
  float sown = 0.0;
  float near = max(len, 5.0);
  if (len < ${n(P.linesMm * 3.4)}) for (int j = 0; j < ${P.trunks}; j++) {
    float fj = float(j);
    float spread = ${n(TAU / P.trunks)} * (fj + 0.7 * poolRnd(fj, 1.0)) + 0.4;
    float bearing = spread - ${n(P.gather)} * sin(spread - 3.385);
    float every = ${n(P.kinkEveryMm[0])} + ${n(P.kinkEveryMm[1] - P.kinkEveryMm[0])} * poolRnd(fj, 4.0);
    float kink = ${n(P.kinkMm)} * (poolKink(len / every + poolRnd(fj, 5.0) + 0.02 * z) + 0.25 * poolKink(len / (0.37 * every) + poolRnd(fj, 2.0))) / near;
    float forkAt = ${n(P.forkMm[0])} + ${n(P.forkMm[1] - P.forkMm[0])} * poolRnd(fj, 3.0);
    float first = (${n(P.fork[0])} + ${n(P.fork[1] - P.fork[0])} * poolRnd(fj, 11.0)) * smoothstep(forkAt, 2.2 * forkAt + 4.0, len);
    for (int k = 0; k < 4; k++) {
      float fk = fj + 31.0 * float(k);
      float pair = fj + 17.0 * float(k / 2);
      float againAt = forkAt * (1.7 + 1.5 * poolRnd(pair, 12.0)) + 6.0;
      float again = (${n(P.fork[0])} + ${n(P.fork[1] - P.fork[0])} * poolRnd(pair, 13.0)) * 0.7 * smoothstep(againAt, 1.8 * againAt + 4.0, len);
      float phi = bearing + kink + (k < 2 ? -first : first) * (0.6 + 0.8 * poolRnd(pair, 6.0)) + (k == 0 || k == 2 ? -again : again)
        + 0.6 * ${n(P.kinkMm)} * poolKink(len / (0.6 * every) + poolRnd(fk, 7.0)) / near * smoothstep(forkAt, forkAt + 6.0, len);
      vec2 e = vec2(cos(phi), sin(phi));
      float across = h.x * e.y - h.y * e.x;
      float foot = abs(e.y * hx.x - e.x * hx.y) + abs(e.y * hy.x - e.x * hy.y);
      float reach = ${n(P.linesMm)} * (0.25 + 1.2 * poolRnd(fk, 9.0) * poolRnd(fk, 9.0)) * (${n(P.rightReach)} + ${n(1 - P.rightReach)} * smoothstep(-0.3, 0.8, dot(e, vec2(-0.97, -0.24))));
      float far = len / reach;
      float grainy = stageNoise(vec3(len * ${n(P.knotPerMm)}, fk * 3.1, 2.0));
      float knot = smoothstep(0.6, 0.78, grainy);
      float whole = mix(1.0, smoothstep(${n(P.breaks[0])}, ${n(P.breaks[1])}, grainy), smoothstep(6.0, 16.0, len));
      float byKnot = exp(-len * len / ${n(P.stoutMm * P.stoutMm)});
      float thin = ${n(P.thinMm)} * (0.7 + 0.6 * poolRnd(fk, 8.0)) * (1.0 + ${n(P.stout)} * byKnot * poolRnd(fj, 14.0) * poolRnd(fj, 14.0)) * mix(1.0, ${n(P.hair)}, smoothstep(0.5, 1.1, far)) * (1.0 + ${n(P.swell)} * knot);
      float drawn = max(thin, 0.8 * foot);
      float off = across * across / (drawn * drawn);
      float weight = exp(-far * far) * (1.0 - smoothstep(1.0, 1.6, far)) * mix(smoothstep(0.12, 0.5, poolRnd(fk, 10.0) * poolRnd(fj, 14.0)), 0.15 + 0.85 * poolRnd(fj, 14.0) * poolRnd(fj, 14.0), byKnot) * (dot(h, e) > 0.0 ? 1.0 : 0.0);
      float lit = (thin / drawn) * (exp(-off) + ${n(P.lineGlow)} * exp(-off / 16.0)) * weight * whole * (0.6 + ${n(P.knots)} * knot) * (1.0 + 1.6 * byKnot);
      sown += weight * exp(-across * across / ${n(P.grainsNearMm * P.grainsNearMm)});
      lines += lit;
      tips += lit * smoothstep(0.35, 1.1, far);
    }
  }
  float tip = tips / max(lines, 1e-4);
  lines = min(lines, 3.0);
  float pool = ${n(P.gain)} * soft * (${n(1 - P.mottle)} + ${n(P.mottle)} * sheet);
  float net = ${n(P.lines)} * lines * smoothstep(0.0, 3.0, len);
  vec2 cell = floor(h / ${n(P.grainCellMm)});
  vec2 grainAt = (cell + 0.25 + 0.5 * vec2(stageHash(vec3(cell + 4096.0, 0.31)), stageHash(vec3(cell + 4096.0, 0.57)))) * ${n(P.grainCellMm)};
  float grainWide = max(${n(P.grainMm)}, 0.6 * max(length(hx), length(hy)));
  float chance = stageHash(vec3(cell + 4096.0, 0.83));
  float sparks = ${n(P.grains)} * exp(-dot(h - grainAt, h - grainAt) / (grainWide * grainWide)) * (${n(P.grainMm)} / grainWide) * smoothstep(0.86, 1.0, chance) * min(2.5 * sown, 1.0) * smoothstep(2.0, 12.0, len);
  vec3 col = ${vec(P.gold)} * pool + mix(${vec(P.gold)}, ${vec(P.amber)}, tip) * net + ${vec(P.pale)} * (${n(P.core)} * core + ${n(P.glow)} * glow + sparks);
  // the sun on the table: a strip of it gets past the globe on the far side of its shadow, which runs down the light's way
  // and softens as it goes; the strip is brightest by the foot and gone a hand's width out
  vec2 f = vStageWorld.xz - uPoolFoot.xy;
  float along = dot(f, way);
  float beside = dot(f, vec2(-way.y, way.x));
  float soften = ${n(P.shadeSoftMm)} + 0.12 * max(along, 0.0);
  float strip = smoothstep(${n(P.shadeMm)} - soften, ${n(P.shadeMm)} + soften, beside) * exp(-max(beside - ${n(P.shadeMm)}, 0.0) / ${n(P.stripMm)});
  col += ${vec(P.sunColor)} * (${n(P.sun)} * strip * exp(-length(f) / ${n(P.sunMm)}));
  gl_FragColor = vec4(col * there, 0.0);
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

function makeWall(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uFlareSun: uniforms.uFlareSun, uSummer: uniforms.uSummer },
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
    fragment: WALL,
    params: { ...added, transparent: false, depthTest: false },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)
  mesh.renderOrder = -0.25
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
export function dressing(): THREE.Object3D {
  if (!flare) {
    flare = new THREE.Group()
    flare.add(makeWall(), makeFlare())
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
  const there = lit * (1 - 0.65 * smooth(held)) * (shaking || two ? 1 : P.early * smooth(t / P.kindleSeconds) + (1 - P.early) * smooth((t - P.afterSeconds) / P.settleSeconds))
  // the storm's glow goes with the liquid: none in still water, whole when it churns
  const kept = holdStorm(moment)
  // and it hands over with the veil: leaving, it thins as the next season's veil takes the liquid, never in a cut
  const gale = Math.max(smooth((f.turbulence - W.stormFrom) / (W.stormTo - W.stormFrom)) * (leaving ? 1 - f.mix.veil : 1), kept)
  uniforms.uSummer.value.set(moment.time, P.swing * swing + 8 * (Math.sin(g.tiltZ) - Math.sin(g.tiltX)), there, gale)
}
