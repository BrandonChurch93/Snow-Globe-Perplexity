import { viewCode } from '../../diagnostics/views'
import { BATS, CARD, LENS_LOOK, LIGHT_LOOK, LIT_MOST, MAX_KINDS, PIXEL_SIGMA2, SEED_RESTS, SHAPE, STORM_FLOOD, STORM_BLOOM, STORM_OWN_PATH_FROM, STORM_WINDOW, STREAK_ARC, SEED_NEAR, STORM_LANDING } from './looks'
import { ROLL_CENTRE } from '../../globe/liquid'

const n = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))
const at = (shape: number) => `(shape > ${n(shape - 0.5)} && shape < ${n(shape + 0.5)})`
/** A number of the storm's down on its course from the storm at its full to the look of the landing (looks.ts, STORM_LANDING; decision 222): the first where `uStormLanding` is 0, the second where it is 1, in a line between. */
const eased = (full: number, landed: number) => `mix(${n(full)}, ${n(landed)}, uStormLanding)`

/**
 * A light at rest by its place in the row of the lit (0 the finest, 1 the largest), by how far it stands before the miniature and by its own number:
 * its heart's and its glow's softness in pixels of the hd picture, and its glow's light as a share of its heart's. Both stages read it, so the card reaches as far as the light does.
 */
const REST_LIGHT = `
vec3 cardRestLight(float u, float scene, float own) {
  float big = smoothstep(${n(CARD.glow.restBig[0])}, ${n(CARD.glow.restBig[1])}, u) * (1.0 - scene);
  float heart = ${n(CARD.glow.restHeart[0])} + ${n(CARD.glow.restHeart[1])} * pow(max(u, 0.0), ${n(CARD.glow.restHeart[2])});
  heart = mix(heart, min(heart, ${n(CARD.glow.restHeartScene)}), scene);
  float glow = mix(${n(CARD.glow.restGlow[0])} + ${n(CARD.glow.restGlow[1])} * heart, mix(${n(CARD.glow.restGlowBig[0])}, ${n(CARD.glow.restGlowBig[1])}, fract(own * 13.0)), big);
  float share = mix(${n(CARD.glow.restGlowOf[0])}, ${n(CARD.glow.restGlowOf[1])} * mix(${n(CARD.glow.restGlowVary[0])}, ${n(CARD.glow.restGlowVary[1])}, fract(own * 7.0)), big);
  return vec3(heart, glow, share);
}
`

/**
 * The kinds that are drawn as cards: every shape from `SHAPE.petal` on. This block runs at the end of the
 * vertex stage and writes every output again for those kinds, so the flakes and the glitter take no part of it.
 * A card is a thin curved sheet with three axes (along, across, out of the sheet), turned by the particle's own
 * turn. What goes to the fragment stage: the two in-sheet axes on the picture in pixels (vL0), the out-of-sheet
 * axis on the picture and the depth parts of the other two (vL1), the sheet's facing in view space and the storm
 * share (vL2), the particle's own numbers (vL3), and its bends and radius (vL4).
 */
/** A clock's own numbers (looks.ts, CARD.clock), in the vertex and in the pixel alike, so the two agree on which head is a stout one. */
const CLOCK_HASH = `/** Three numbers of its own for each hair of a clock, and for the clock itself: whole numbers in, so they are the same on every machine and in every pixel of the card. */
vec3 cardHairHash(uint id) {
  uvec3 v = uvec3(id) * uvec3(1664525u, 22695477u, 747796405u) + uvec3(1013904223u, 12345u, 2891336453u);
  v ^= v >> 15u;
  v *= 2246822519u;
  v ^= v >> 13u;
  v *= 3266489917u;
  v ^= v >> 16u;
  return vec3(v >> 8u) / 16777216.0;
}
`

export const CARD_VERT_PARS = `${REST_LIGHT}
${CLOCK_HASH}uniform vec4 uKindWay[${MAX_KINDS}];
/** Where the bats are in the globe's own frame, and each one's radius in millimetres (0: no bat). */
uniform vec4 uBat[${BATS}];
/** 1 where each particle is drawn once and whole (the app), 0 where the film's samples draw it many times over. */
uniform float uWhole;
uniform float uStormLanding;
/** How a light of the storm rides with the ball through one exposure of the film (points.ts, lightRide). uMidPose takes a point of the liquid to where it is as the ball stands at the middle of the exposure, said in the liquid's own space as the ball stands now. uMidHold is the share of that hold that stands, and how far this sample's moment was moved from its share of the shutter. Both are nothing but in a sample of the film's frames. */
uniform mat4 uMidPose;
uniform vec2 uMidHold;
/** The engine's own hash (hash2 in src/core/rng.ts): the same number that gives a particle its way of falling there. */
uint cardHash2(uint a, uint b) {
  uint v = ((a ^ 0x9e3779b9u) * 0x85ebca6bu) ^ ((b + 0x7f4a7c15u) * 0xc2b2ae35u);
  v ^= v >> 16u;
  v *= 0x7feb352du;
  v ^= v >> 15u;
  v *= 0x846ca68bu;
  v ^= v >> 16u;
  return v;
}
`

export const CARD_VERT = `
  if (shape > 2.5) {
    float gustC = afloat * gust;
    // the storm goes out by degrees (looks.ts, CARD.hair.stormEase): what it does by its being there alone is weighed by this, and is whole from stormEase on
    float easeC = smoothstep(0.0, ${n(CARD.hair.stormEase)}, uStorm.x);
    float rC = aData.x * look.y * uPoint.y * mag / zImg * shrink;
    vec4 way = uKindWay[kind];
    float u5 = float(cardHash2(pid, 191u + uint(kind)) >> 8u) / 16777216.0;
    float own = fract(h2.y * 211.0);
    float chosen = ${at(SHAPE.petal)} ? ${n(CARD.chosen[0])} : (${at(SHAPE.seed)} ? ${n(CARD.chosen[2])} : ${n(CARD.chosen[1])});
    float dabShare = ${at(SHAPE.leaf)} ? ${n(CARD.dabShare[1])} : (${at(SHAPE.seed)} ? ${n(CARD.dabShare[2])} : ${n(CARD.dabShare[0])});
    // a head that lies where the scene has a place for it (points.ts) is a whole head, lit and sharp, of its own size
    bool laidB = ${at(SHAPE.seed)} && abs(aState - 1.5) < 0.25;
    // some seeds of the list are no seeds (points.ts): each stands at one of the lights inside and is the glow of the storm's haze round it
    bool glowB = ${at(SHAPE.seed)} && abs(aState - 0.25) < 0.1;
    float whole = laidB || glowB || way.z < 0.5 || u5 < max(way.x, way.y) || own > 1.0 - chosen ? 1.0 : 0.0;
    float paleC = 0.0;
    float skirtC = 0.0;
    float keepC = mix(afloat * max(gustC, ${n(CARD.dabCalm)} * uStorm.x * uStorm.w) * mix(${n(CARD.dabKeep[0])}, ${n(CARD.dabKeep[1])}, smoothstep(1.0 - chosen - dabShare - 0.02, 1.0 - chosen - dabShare, own)), 1.0, whole);
    // a seed that lands is of the storm: under its full level it is not seen at the touch of what it can snag on, nor where it has snagged (looks.ts, SEED_NEAR), so none comes into the picture or leaves it where it touches. A head the scene has a place for lies as it lay
    float calmS = 1.0 - smoothstep(${n(SEED_NEAR.stormOff[0])}, ${n(SEED_NEAR.stormOff[1])}, uStorm.x);
    if (${at(SHAPE.seed)} && whole > 0.5 && way.z > 0.5 && u5 >= max(way.x, way.y)) keepC *= max(max(afloat * gustC, uStorm.x * uStorm.w * (1.0 - nearS)), lying * step(fract(own * 977.0), ${n(CARD.clear.snagSeen)}) * (laidB ? 1.0 : 1.0 - calmS));
    // a head that floats in the calm can come to what it snags on too, and is held there as any seed is. Under the storm's full level it is not seen where it has snagged either: the clock went out before the touch (snagC below), and no tuft comes into the picture in one frame where it went
    if (uStorm.x < 0.99 && ${at(SHAPE.seed)} && !laidB && !glowB && way.z > 0.5 && u5 < max(way.x, way.y)) keepC *= 1.0 - calmS * lying;
    if (${at(SHAPE.spark)}) keepC = max(mix(${n(CARD.sparkKeep[0])}, ${n(CARD.sparkKeep[1])}, pow(abs(own), mix(${n(CARD.sparkRestSkew)}, ${n(CARD.sparkSkew)}, gust))), smoothstep(mix(${n(CARD.sparkRestClear[0])}, ${n(CARD.sparkClear[0])}, gust), mix(${n(CARD.sparkRestClear[1])}, ${n(CARD.sparkClear[1])}, gust), own));
    if (${at(SHAPE.spark)}) keepC = max(keepC, ${n(CARD.sparkRestFine[0])} * smoothstep(${n(CARD.sparkRestFine[1])}, ${n(CARD.sparkRestFine[1] + 0.05)}, own) * (1.0 - gust));
    if (${at(SHAPE.fleck)}) keepC = mix(${n(CARD.fleckKeep[0])}, ${n(CARD.fleckKeep[1])}, pow(abs(own), mix(${n(CARD.fleckSkew)}, ${n(CARD.fleckStorm)}, gustC)));
    float stormSize = ${at(SHAPE.petal)} ? ${n(CARD.stormSize[0])} : (${at(SHAPE.leaf)} ? ${n(CARD.stormSize[1])} : 1.0);
    rC *= mix(${at(SHAPE.leaf)} ? ${n(CARD.leafDab)} : ${n(CARD.dabSize)}, mix(1.0, stormSize, gustC * (own > 1.0 - chosen ? 0.0 : 1.0)), whole);
    float sheet = ${at(SHAPE.petal)} || ${at(SHAPE.leaf)} ? 1.0 : 0.0;
    float vary = fract(h2.w * 173.0);
    float spreadC = mix(${n(CARD.spread[0])}, ${n(CARD.spread[1])}, pow(abs(vary), ${n(CARD.spread[2])}));
    rC *= mix(1.0, spreadC, sheet) * mix(1.0, ${n(CARD.lieSize)}, lying * sheet);
    if (${at(SHAPE.leaf)}) {
      float restL = afloat * (1.0 - gustC) * whole;
      // the slow turn of the liquid gathers the leaves at the right of the ball: fewer of them are drawn there, so the open air of the left holds its share, few stand before the cottage, and none at the limb, where the lens would carry a leaf over the edge of the glass
      vec2 atL = (view.xy * (centreV.z / view.z) - centreV.xy) / max(uLens.x, 1e-4);
      vec2 cotL = (atL - vec2(${n(CARD.spark.restCottageAt[0])}, ${n(CARD.spark.restCottageAt[1])})) / vec2(${n(CARD.spark.restCottageWide[0])}, ${n(CARD.spark.restCottageWide[1])});
      vec2 fenceL = (atL - vec2(${n(CARD.leafRestFenceAt[0])}, ${n(CARD.leafRestFenceAt[1])})) / vec2(${n(CARD.leafRestFenceWide[0])}, ${n(CARD.leafRestFenceWide[1])});
      // the chimney's keep-out goes with the chimney: its place in the ball is carried through the lens as the miniature is, so it holds in every camera
      vec4 chimVL = viewMatrix * vec4(lensPlace((modelMatrix * vec4(${CARD.spark.restChimneyBall.map(n).join(', ')}, 1.0)).xyz, eye).xyz, 1.0);
      vec2 chimL = (atL - (chimVL.xy * (centreV.z / chimVL.z) - centreV.xy) / max(uLens.x, 1e-4)) / vec2(${n(CARD.spark.restChimneyWide[0])}, ${n(CARD.spark.restChimneyWide[1])});
      keepC *= mix(1.0, step(fract(own * 431.0), ${n(CARD.leafRestShare)} * mix(1.0, ${n(CARD.leafRestRight)}, smoothstep(${n(CARD.leafRestRightFrom[0])}, ${n(CARD.leafRestRightFrom[1])}, atL.x)) * (1.0 - ${n(CARD.leafRestCottage)} * exp(-0.5 * dot(cotL, cotL))) * (1.0 - ${n(CARD.leafRestFence)} * exp(-0.5 * dot(fenceL, fenceL))) * (1.0 - min(${n(CARD.leafRestChimney)} * exp(-0.5 * dot(chimL, chimL)), 1.0))) * (1.0 - smoothstep(${n(CARD.leafRestRim[0])}, ${n(CARD.leafRestRim[1])}, length(atL))), restL);
      rC *= mix(1.0, mix(${n(CARD.leafRestMm[0])}, ${n(CARD.leafRestMm[1])}, pow(abs(1.0 - fract(h2.x * 13.0 + fract(h.w * 37.0) * 5.0)), mix(${n(CARD.leafRestMm[2])}, ${n(CARD.leafRestRightSkew)}, smoothstep(${n(CARD.leafRestRightFrom[0])}, ${n(CARD.leafRestRightFrom[1])}, atL.x)))) / max(aData.x * spreadC, 1e-3), restL);
      rC = mix(rC, min(rC, uPoint.w * ${n(CARD.leafRestPx)}), restL) * mix(1.0, ${n(CARD.leafLieSize)}, lying * sheet);
    }
    keepC *= mix(1.0, step(fract(h2.z * 57.0), ${at(SHAPE.petal)} ? ${n(CARD.lieKeep[0])} : ${n(CARD.lieKeep[1])}), lying * sheet);
    float lineShare = ${at(SHAPE.petal)} ? ${n(CARD.line.share[0])} : ${n(CARD.line.share[1])};
    float lineC = (1.0 - whole) * (sheet * step(own, lineShare) + (${at(SHAPE.seed)} ? 1.0 : 0.0));
    // a share of the storm's strokes are its sheets: each a band of fine hairs side by side along the whirl, the down that the eye cannot count. A sheet stands where the down stands: whole in an arm of the whirl, gone toward the limb, where the way through the liquid is short, and lit by the lights inside as every seed is
    // on the way to the landing the sheets grow few (decision 222): one that the look of the landing does not have goes out by its own share over the first half of the way (fastest at first, when the course itself has hardly begun, and with no corner where it is gone), is a stroke from there, where nothing of it is seen, and comes back in as a stroke over the second half. None is dropped between two frames
    float mistC = storming && ${at(SHAPE.seed)} && lineC > 0.5 && fract(own * 271.0) >= ${n(CARD.line.stormLeaves)} && fract(own * 523.0) < (uStormLanding < 0.5 ? ${n(CARD.line.stormMist)} : ${n(STORM_LANDING.line.stormMist)}) ? 1.0 : 0.0;
    float sheetSeenC = storming && ${at(SHAPE.seed)} && lineC > 0.5 && fract(own * 271.0) >= ${n(CARD.line.stormLeaves)} && fract(own * 523.0) >= ${n(STORM_LANDING.line.stormMist)} && fract(own * 523.0) < ${n(CARD.line.stormMist)} ? (uStormLanding < 0.5 ? (1.0 - 2.0 * uStormLanding) * (1.0 - 2.0 * uStormLanding) : smoothstep(0.5, 1.0, uStormLanding)) : 1.0;
    if (${at(SHAPE.seed)}) rC *= mix(1.0, mix(${n(CARD.hair.spread[0])}, ${n(CARD.hair.spread[1])}, pow(abs(vary), ${n(CARD.hair.spread[2])})), whole);
    if (${at(SHAPE.fleck)}) rC *= mix(${n(CARD.fleckSpread[0])}, ${n(CARD.fleckSpread[1])}, pow(abs(vary), ${n(CARD.fleckSpread[2])}));
    if (${at(SHAPE.spark)}) rC *= mix(${n(CARD.spark.small)}, ${n(CARD.spark.large)}, smoothstep(${n(CARD.spark.fromMm[0])}, ${n(CARD.spark.fromMm[1])}, aData.x));
    if (${at(SHAPE.light)}) rC *= mix(${n(CARD.glow.spread[0])}, ${n(CARD.glow.spread[1])}, pow(abs(vary), ${n(CARD.glow.spread[2])}));
    if (shape > ${n(SHAPE.bat - 0.5)}) rC *= mix(${n(CARD.batSpread[0])}, ${n(CARD.batSpread[1])}, vary);
    keepC = mix(keepC, afloat * gustC * (${at(SHAPE.seed)} ? mix(${n(CARD.line.seedKeep[0])}, ${n(CARD.line.seedKeep[1])}, pow(fract(own * 53.0), storming ? ${n(CARD.line.shutSeedSkew)} : ${n(CARD.line.seedSkew)})) : mix(${n(CARD.line.keep[0])}, ${n(CARD.line.keep[1])}, pow(fract(own * 53.0), ${at(SHAPE.leaf)} ? ${n(CARD.line.leafSkew)} : ${n(CARD.line.skew)}))), lineC);
    // a seed's stroke is the storm's: it goes out with the storm (CARD.hair.stormEase), and in the calm a seed has none
    if (${at(SHAPE.seed)} && lineC > 0.5 && !storming) keepC = 0.0;
    float windowC = (1.0 - smoothstep(${n(STORM_WINDOW.from)}, ${n(STORM_WINDOW.to)}, length((nowL.xy - vec2(${n(STORM_WINDOW.x)}, ${n(STORM_WINDOW.y)})) / vec2(${n(STORM_WINDOW.wide)}, ${n(STORM_WINDOW.high)})))) * smoothstep(${n(STORM_WINDOW.back)}, ${n(STORM_WINDOW.front)}, nowL.z);
    keepC *= 1.0 - (${at(SHAPE.seed)} && lineC > 0.5 ? ${n(CARD.line.stormWindow)} : ${n(CARD.window)}) * windowC * gustC * (sheet + (${at(SHAPE.seed)} ? 1.0 : 0.0));
    float clearC = over * smoothstep(${n(CARD.clear.back)}, ${n(CARD.clear.front)}, depth) * (1.0 - smoothstep(${n(CARD.clear.lowMm)}, ${n(CARD.clear.highMm)}, nowL.y)) * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0);
    float nearC = afloat * (storming ? max(1.0 - gustC, smoothstep(0.0, 0.3, uStorm.x) * sheet * step(fract(h.y * 29.0), ${n(CARD.near.stormShare)}) * smoothstep(${n(CARD.near.stormFrom[0])}, ${n(CARD.near.stormFrom[1])}, depth)) : 1.0 - gustC) * whole * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0) * (${at(SHAPE.seed)} ? step(${n(CARD.hair.nearShare)}, fract(h.y * 29.0)) * step(fract(h.y * 29.0), ${n(CARD.hair.nearShare + CARD.hair.lensShare)}) : step(fract(h.y * 29.0), ${at(SHAPE.spark)} ? ${n(CARD.spark.nearShare)} : (${at(SHAPE.light)} ? ${n(CARD.glow.nearShare)} : (${at(SHAPE.leaf)} ? mix(${n(CARD.leafNearShare)}, ${n(CARD.near.share)}, gustC) : ${n(CARD.near.share)})))) * (${at(SHAPE.spark)} ? smoothstep(${n(CARD.spark.nearFrom[0])}, ${n(CARD.spark.nearFrom[1])}, depth) : smoothstep(${n(CARD.near.from)}, ${n(CARD.near.to)}, depth)) * (1.0 - ${n(CARD.near.clear)} * over) * (1.0 - clearC);
    if (${at(SHAPE.light)}) nearC *= 1.0 - uStorm.x;
    float seedNear = 0.0;
    float seedFar = 0.0;
    float seedSoft = 0.0;
    float clockC = 0.0;
    float stalkOutC = 0.0;
    float mistSceneC = 0.0;
    float mistPullC = 0.0;
    float pullC = 0.0;
    if (${at(SHAPE.seed)}) {
      nearC = 0.0;
      float calmC = whole * afloat * (1.0 - gustC);
      // how much of the calm's own laws stands (looks.ts, CARD.clock): all of them under the lower of the two levels, none at the storm's full level
      float offC = 0.0;
      if (uStorm.x < 0.99) offC = 1.0 - smoothstep(${n(CARD.clock.stormOff[0])}, ${n(CARD.clock.stormOff[1])}, uStorm.x);
      // a head's tuft is wider than the glass's own fade at its edge: one that floats at the limb would stand half outside the ball. In the calm the fade is wider, so a head that drifts to the limb goes over twelve frames and more
      if (on > 0.5) keepC *= 1.0 - calmC * smoothstep(mix(${n(CARD.hair.rimFrom[0])}, ${n(CARD.clock.rimFrom)}, offC), ${n(CARD.hair.rimFrom[1])}, length(rimAxis) / max(R, 1e-4));
      // the ball is deepest at its middle on the picture and holds the most heads there: a share of them is not drawn, the larger the longer the way through the ball is, so that the crowd is even on the picture from the middle to the limb. The heads hang thickest in the lower half of the liquid, and more still are left out there
      vec2 atC = (view.xy * (centreV.z / view.z) - centreV.xy) / max(uLens.x, 1e-4);
      float denseC = 1.0 - min(${n(CARD.hair.even)} / sqrt(max(1.0 - dot(atC, atC), 0.04)), 1.0) * (1.0 - ${n(CARD.hair.lowOut)} * (1.0 - smoothstep(${n(CARD.hair.lowY[0])}, ${n(CARD.hair.lowY[1])}, atC.y)));
      // few heads stand before the cottage and the crown, and none of those is lit
      float cotC = 1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.hair.sceneEdge[1])}, length((atC - vec2(${n(CARD.hair.cottageAt[0])}, ${n(CARD.hair.cottageAt[1])})) / vec2(${n(CARD.hair.cottageWide[0])}, ${n(CARD.hair.cottageWide[1])})));
      float crownC = 1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.hair.sceneEdge[1])}, length((atC - vec2(${n(CARD.hair.crownAt[0])}, ${n(CARD.hair.crownAt[1])})) / vec2(${n(CARD.hair.crownWide[0])}, ${n(CARD.hair.crownWide[1])})));
      // the lanterns, the trunk and the yard between the two are the miniature as well
      float bandC = 1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.hair.sceneEdge[1])}, length((atC - vec2(${n(CARD.glow.bandAt[0])}, ${n(CARD.glow.bandAt[1])})) / vec2(${n(CARD.glow.bandWide[0])}, ${n(CARD.glow.bandWide[1])})));
      float sceneC = max(max(cotC, crownC), bandC);
      // in the storm few stand before the cottage, the lanterns and the tree, so that the miniature is read through it: those behind it stay, and are the bright air seen in its gaps. The storm is thickest at the upper left and along the right limb, and thinner elsewhere
      vec2 lowC = (atC - vec2(${n(CARD.hair.stormLowAt[0])}, ${n(CARD.hair.stormLowAt[1])})) / vec2(${n(CARD.hair.stormLowWide[0])}, ${n(CARD.hair.stormLowWide[1])});
      float frontC = smoothstep(${n(CARD.hair.stormFront[0])}, ${n(CARD.hair.stormFront[1])}, depth);
      // the storm stands thickest over the crown and low over the yard: there its sheets come forward of the miniature, so the tree and the ground are ghosted by them, and their haze is the denser
      float lowZoneC = 1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.hair.sceneEdge[1])}, length(lowC));
      mistSceneC = max(max(crownC, lowZoneC), ${n(CARD.line.stormMistCottage)} * cotC);
      mistPullC = max(max(${n(CARD.line.stormMistPull[0])} * crownC, ${n(CARD.line.stormMistPull[1])} * lowZoneC), ${n(CARD.line.stormMistPull[2])} * cotC) * gustC;
      // the storm's down goes round the crown and through it: its strokes come forward of the crown, so the tree is ghosted by them as the cottage is
      if (storming && lineC > 0.5) pullC = ${n(CARD.line.stormPullMm)} * crownC * gustC * mix(step(fract(own * 577.0), ${n(CARD.line.stormPullShare)}), step(fract(own * 577.0), ${n(STORM_LANDING.line.stormPullShare)}), uStormLanding);
      keepC *= 1.0 - (lineC > 0.5 ? (mistC > 0.5 ? ${n(CARD.line.stormMistCut)} : ${eased(CARD.line.stormScene, STORM_LANDING.line.stormScene)}) : 1.0) * max(${eased(CARD.hair.stormScene, STORM_LANDING.hair.stormScene)} * max(cotC, lineC > 0.5 ? 0.0 : lowZoneC), ${eased(CARD.hair.stormCrown, STORM_LANDING.hair.stormCrown)} * crownC) * frontC * gustC;
      vec2 upC = (atC - vec2(${n(CARD.hair.stormUpAt[0])}, ${n(CARD.hair.stormUpAt[1])})) / vec2(${n(CARD.hair.stormUpWide[0])}, ${n(CARD.hair.stormUpWide[1])});
      keepC *= 1.0 - (lineC > 0.5 ? ${n(CARD.line.stormThin)} : ${n(CARD.hair.stormThin)}) * (1.0 - max(exp(-0.5 * dot(upC, upC)), smoothstep(${n(CARD.hair.stormLimb[0])}, ${n(CARD.hair.stormLimb[1])}, atC.x))) * gustC;
      // toward the limb the way through the liquid is short: the storm thins there, and the dark of the glass shows between its hairs
      keepC *= 1.0 - (lineC > 0.5 ? ${n(CARD.line.stormRimOut)} : ${n(CARD.hair.stormRimOut)}) * smoothstep(${n(CARD.line.stormRim[0])}, ${n(CARD.line.stormRim[1])}, length(atC)) * gustC;
      if (mistC > 0.5) keepC *= 1.0 - smoothstep(${n(CARD.line.stormMistRim[0])}, ${n(CARD.line.stormMistRim[1])}, length(atC)) * gustC;
      denseC = max(denseC, max(${n(CARD.hair.sceneOut[0])} * max(cotC, bandC), ${n(CARD.hair.sceneOut[1])} * crownC));
      // in the calm the count is the clocks' own (looks.ts, CARD.clock), and goes over to it as the storm goes. That law is gentle over the whole picture, so a head that drifts is not let in or taken out at a line: where it changes (with the depth, low in the ball, at the height where the heads hang thickest) it changes slowly, and the step's edge is so wide that a head comes or goes over twelve frames and more
      float edgeC = 0.1;
      if (uStorm.x < 0.99) {
        float depthQ = depth + ${n(CARD.clock.depthVary)} * (fract(h.w * 113.0) * 2.0 - 1.0);
        // where the still liquid gathers the heads (looks.ts, CARD.clock.clumpAt, a place in the ball in millimetres) fewer are drawn, in a bell about that place, so they stand apart there as they do everywhere else
        vec3 clumpK = (nowL - vec3(${CARD.clock.clumpAt.map(n).join(', ')})) / ${n(CARD.clock.clumpMm)};
        denseC = mix(denseC, 1.0 - min(${n(CARD.clock.even)} * mix(${n(CARD.clock.farMore)}, ${n(CARD.clock.nearLess)}, smoothstep(${n(CARD.clock.keepAt[0])}, ${n(CARD.clock.keepAt[1])}, depthQ)), 1.0) * (1.0 - ${n(CARD.clock.lowOut)} * (1.0 - smoothstep(${n(CARD.clock.lowY[0])}, ${n(CARD.clock.lowY[1])}, atC.y))) * (1.0 - ${n(CARD.clock.bandOut)} * exp(-0.5 * (atC.y - ${n(CARD.clock.bandY[0])}) * (atC.y - ${n(CARD.clock.bandY[0])}) / ${n(CARD.clock.bandY[1] * CARD.clock.bandY[1])})) * (1.0 - ${n(CARD.clock.clumpOut)} * exp(-0.5 * dot(clumpK, clumpK))), offC);
        edgeC = mix(0.1, ${n(CARD.clock.edge)}, offC);
      }
      // how much of this head the count lets stand. A clock that the count takes out or lets in as it drifts does not stand there as a ghost of itself: it is small while it comes and grows to its size, as a head does that floats up out of the deep of the ball (rC below), and is whole to see well before it is full grown
      float wholeC = smoothstep(denseC - edgeC, denseC, fract(own * 211.0));
      keepC *= mix(1.0, mix(wholeC, smoothstep(0.0, ${n(CARD.clock.goSeen)}, wholeC), offC), calmC);
      // a head afloat that comes to what it can snag on is held there by the engine in one step, and a held head is no clock. So in the calm it goes out over the whole way of its nearness (looks.ts, SEED_NEAR; points.ts tells the nearness of every seed afloat) and is gone at the touch, and it is the smaller the nearer it is (rC below), as a head is that the count takes out: none leaves the picture between two frames where it snags
      float snagC = 0.0;
      if (uStorm.x < 0.99 && aState < ${n(SEED_NEAR.state * 1.25)}) snagC = offC * min(aState * ${n(1 / SEED_NEAR.state)}, 1.0);
      keepC *= 1.0 - calmC * snagC;
      // before the cottage and the lanterns all but a few of the clocks are not drawn: each of the others fades as it drifts there, over the whole width of a wide edge round the miniature, and the few stay whole, so none is taken out at a line. Before the crown every clock is a little fainter
      float stalkQ = 0.0;
      if (uStorm.x < 0.99) {
        float cotQ = 1.0 - smoothstep(${n(CARD.clock.sceneEdge[0])}, ${n(CARD.clock.sceneEdge[1])}, length((atC - vec2(${n(CARD.hair.cottageAt[0])}, ${n(CARD.hair.cottageAt[1])})) / vec2(${n(CARD.hair.cottageWide[0])}, ${n(CARD.hair.cottageWide[1])})));
        float bandQ = 1.0 - smoothstep(${n(CARD.clock.sceneEdge[0])}, ${n(CARD.clock.sceneEdge[1])}, length((atC - vec2(${n(CARD.glow.bandAt[0])}, ${n(CARD.glow.bandAt[1])})) / vec2(${n(CARD.glow.bandWide[0])}, ${n(CARD.glow.bandWide[1])})));
        float crownQ = 1.0 - smoothstep(${n(CARD.clock.sceneEdge[0])}, ${n(CARD.clock.sceneEdge[1])}, length((atC - vec2(${n(CARD.hair.crownAt[0])}, ${n(CARD.hair.crownAt[1])})) / vec2(${n(CARD.hair.crownWide[0])}, ${n(CARD.hair.crownWide[1])})));
        keepC *= 1.0 - calmC * offC * max(max(cotQ, bandQ) * (1.0 - smoothstep(${n(CARD.clock.sceneOut[0] - 0.03)}, ${n(CARD.clock.sceneOut[0])}, fract(own * 211.0))), ${n(CARD.clock.sceneOut[1])} * crownQ);
        stalkQ = max(cotQ, crownQ);
      }
      // a head on a stalk that drifts before the cottage or the crown would lay a line across the face or end one among the branches: it fades as it comes there, and the heads without a stalk stay. A clock shows no stalk there (stalkOutC below), so the rule goes as the clocks come
      if (!laidB) keepC *= 1.0 - calmC * (1.0 - offC) * step(fract(h2.x * 47.0), ${n(CARD.hair.stalks)}) * smoothstep(0.0, ${n(CARD.hair.stalkScene)}, max(cotC, crownC));
      // depth and light: about one head in five is near and sharp and lit; the others are dimmer and a little soft; the far ones are small soft puffs
      seedNear = calmC * step(fract(h2.x * 47.0), ${n(CARD.down.star.share)}) * smoothstep(${n(CARD.hair.nearFrom[0])}, ${n(CARD.hair.nearFrom[1])}, depth) * (1.0 - sceneC) * step(${n(CARD.hair.nearDense)} * denseC, fract(h.z * 157.0)) * smoothstep(${n(CARD.hair.nearLow[0])}, ${n(CARD.hair.nearLow[1])}, atC.y);
      // the crowd changes as a head drifts: under the storm's full level the edge of that step is wide, so no head's light steps between two frames; at the full storm the line above stands as it is
      if (uStorm.x < 0.99) seedNear = mix(calmC * step(fract(h2.x * 47.0), ${n(CARD.down.star.share)}) * smoothstep(${n(CARD.hair.nearFrom[0])}, ${n(CARD.hair.nearFrom[1])}, depth) * (1.0 - sceneC) * smoothstep(${n(CARD.hair.nearDense)} * denseC - 0.05, ${n(CARD.hair.nearDense)} * denseC + 0.05, fract(h.z * 157.0)) * smoothstep(${n(CARD.hair.nearLow[0])}, ${n(CARD.hair.nearLow[1])}, atC.y), seedNear, smoothstep(${n(CARD.clock.stormOff[0])}, ${n(CARD.clock.stormOff[1])}, uStorm.x));
      float puffC = 1.0 - smoothstep(${n(CARD.hair.puffFrom[0])}, ${n(CARD.hair.puffFrom[1])}, depth);
      keepC *= mix(1.0, mix(${n(CARD.hair.dim[0])}, ${n(CARD.hair.dim[1])}, fract(h.w * 71.0)) * (1.0 - ${n(CARD.hair.sceneDim)} * sceneC), calmC * (1.0 - seedNear));
      // the far puffs are faint: a crowd of small bright ones reads as snow
      keepC *= mix(1.0, ${n(CARD.hair.puffSeen)}, calmC * (1.0 - seedNear) * puffC);
      // a far puff's softness is its own, so it grows with the puff on the picture: a camera that stands nearer than the hero sees it larger and as much softer, a soft speck and never a bunch of dots
      float closeC = max(1.0, uPoint.y / (max(zImg, 1.0) * uPoint.w * ${n(CARD.hair.puffMmPx)}));
      seedSoft = calmC * (1.0 - seedNear) * mix(mix(${n(CARD.hair.softPx[0])}, ${n(CARD.hair.softPx[1])}, fract(h.y * 173.0)), closeC * mix(${n(CARD.hair.puffPx[0])}, ${n(CARD.hair.puffPx[1])}, fract(h.y * 173.0)), puffC);
      if (laidB) {
        seedNear = 1.0;
        seedSoft = 0.0;
      }
      // the few large heads are the ones close to the eye: the lens has them soft, and the scene shows through them
      float bigC = calmC * smoothstep(${n(CARD.hair.bigFrom[0])}, ${n(CARD.hair.bigFrom[1])}, pow(abs(vary), ${n(CARD.hair.spread[2])}));
      seedSoft += bigC * ${n(CARD.hair.bigSoftPx)};
      keepC *= mix(1.0, ${n(CARD.hair.bigSeen)}, bigC);
      // three or four heads float close to the eye and are clearly larger than every other
      // they stand off to the sides and above: one that drifts before the cottage, the lanterns or the crown is as small there as every other
      float bigZoneC = (1.0 - sceneC) * max(smoothstep(${n(CARD.hair.bigUp[0])}, ${n(CARD.hair.bigUp[1])}, atC.y), smoothstep(${n(CARD.hair.bigSide[0])}, ${n(CARD.hair.bigSide[1])}, abs(atC.x)));
      rC *= 1.0 + ${n(CARD.hair.bigMore - 1)} * calmC * step(${n(1 - CARD.hair.bigShare)}, vary) * bigZoneC;
      // at rest nearly every head is small and fine, a point of down at the size of the whole picture: the storm's spread of sizes is taken in
      rC *= mix(1.0, mix(${n(CARD.hair.restSpread[0])}, ${n(CARD.hair.restSpread[1])}, pow(abs(vary), ${n(CARD.hair.spread[2])})) / mix(${n(CARD.hair.spread[0])}, ${n(CARD.hair.spread[1])}, pow(abs(vary), ${n(CARD.hair.spread[2])})), calmC);
      rC *= mix(${n(CARD.hair.restSize)}, mix(1.0, ${eased(CARD.hair.stormSize, STORM_LANDING.hair.stormSize)}, whole), max(gustC, 1.0 - whole));
      rC *= mix(1.0, mix(${n(CARD.hair.farSize)}, 1.0, smoothstep(${n(CARD.hair.farFrom[0])}, ${n(CARD.hair.farFrom[1])}, depth)), calmC) * (1.0 + ${n(CARD.hair.nearSize - 1)} * seedNear);
      keepC *= mix(1.0, step(fract(own * 733.0), ${n(CARD.hair.stormShare)}), whole * afloat * max(gustC, uStorm.x * uStorm.w) * (u5 < max(way.x, way.y) ? 0.0 : 1.0));
      // a head that hardly moves while the storm is up would stand in it as the still wheel it is at rest: it is all but gone until the storm is
      if (!laidB && !glowB) keepC *= 1.0 - ${n(CARD.hair.stormStill)} * uStorm.x * whole * afloat * (1.0 - gustC);
      keepC *= mix(step(fract(own * 419.0), ${n(CARD.hair.restShare)}), 1.0, max(max(gustC, uStorm.x), 1.0 - whole * afloat));
      keepC *= 1.0 - ${n(CARD.hair.restClear)} * over * (1.0 - smoothstep(${n(CARD.clear.lowMm)}, ${n(CARD.clear.highMm)}, nowL.y)) * whole * (1.0 - gustC) * afloat;
      // a head afloat in the calm is a clock (looks.ts, CARD.clock): clockC is how much of one this head is, none at the storm's full level, where every line above and below is the storm's own. The clocks come in three classes by depth: small soft puffs far behind the miniature, the middle ones, and the few large sharp ones near the eye, none of those before the miniature
      if (uStorm.x < 0.99) {
        clockC = calmC * (1.0 - smoothstep(${n(CARD.clock.stormOff[0])}, ${n(CARD.clock.stormOff[1])}, uStorm.x));
        if (clockC > 0.0) {
          float atK = depth + ${n(CARD.clock.depthVary)} * (fract(h.w * 113.0) * 2.0 - 1.0);
          float midK = smoothstep(${n(CARD.clock.farAt[0])}, ${n(CARD.clock.farAt[1])}, atK);
          float nearK = smoothstep(${n(CARD.clock.nearAt[0])}, ${n(CARD.clock.nearAt[1])}, atK) * (1.0 - sceneC);
          rC = mix(rC, look.y * uPoint.y * mag / zImg * shrink * mix(mix(${n(CARD.clock.mm[0])}, ${n(CARD.clock.mm[1])}, midK), ${n(CARD.clock.mm[2])} * mix(1.0, ${n(CARD.clock.stoutMm)}, mix(step(cardHairHash((pid & 4095u) * 64u + 63u).y, ${n(CARD.clock.stoutShare)}), step(cardHairHash((pid & 4095u) * 64u + 63u).y, ${n(CARD.clock.warmShare)}), smoothstep(${n(CARD.clock.stoutClose[0])}, ${n(CARD.clock.stoutClose[1])}, closeC))), nearK) * mix(${n(CARD.clock.vary[0])}, ${n(CARD.clock.vary[1])}, fract(vary * 7.0)) * mix(${n(CARD.clock.goSize)}, 1.0, wholeC * (1.0 - snagC)), clockC);
          seedSoft = mix(seedSoft, closeC * mix(mix(${n(CARD.clock.softPx[0])}, ${n(CARD.clock.softPx[1])}, midK), ${n(CARD.clock.softPx[2])}, nearK), clockC);
          keepC *= mix(1.0, mix(mix(${n(CARD.clock.classSeen[0])}, ${n(CARD.clock.classSeen[1])}, midK), ${n(CARD.clock.classSeen[2])}, nearK), clockC);
          // a clock takes back the lens look's dimming of what floats far behind the miniature (looks.ts, LENS_LOOK.farDim; the line that sets alpha below): a far puff is whole to see, a soft grey ball, and it is the count that says how many there are, not a crowd of ghosts
          keepC *= mix(1.0, 1.0 / mix(${n(LENS_LOOK.farDim)}, 1.0, smoothstep(${n(LENS_LOOK.farDimFrom)}, ${n(LENS_LOOK.farDimTo)}, depth)), clockC * ${n(CARD.clock.farLit)});
          seedNear = mix(seedNear, nearK, clockC);
          seedFar = (1.0 - midK) * clockC;
          // a stalk would lay a line across the cottage's face or end one among the branches: before the two a clock shows none
          stalkOutC = smoothstep(0.0, ${n(CARD.clock.stalkScene)}, stalkQ);
        }
      }
    }
    float sceneL = 0.0;
    if (${at(SHAPE.light)}) {
      // the lights gather in loose swarms with dark between them, and few stand before the cottage
      vec2 atG = (view.xy * (centreV.z / view.z) - centreV.xy) / max(uLens.x, 1e-4);
      float swarmG = sin(atG.x * ${n(CARD.glow.swarm[0])} + ${n(CARD.glow.swarm[1])}) * sin(atG.y * ${n(CARD.glow.swarm[2])} + ${n(CARD.glow.swarm[3])}) + ${n(CARD.glow.swarmFine)} * sin((atG.x - atG.y) * ${n(CARD.glow.swarm[4])} + ${n(CARD.glow.swarm[5])});
      float cotG = 1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.hair.sceneEdge[1])}, length((atG - vec2(${n(CARD.hair.cottageAt[0])}, ${n(CARD.hair.cottageAt[1])})) / vec2(${n(CARD.hair.cottageWide[0])}, ${n(CARD.hair.cottageWide[1])})));
      // many more of them low at the left, some more in the open air of the upper left and round the crown, and few in the upper middle
      vec2 lowG = (atG - vec2(${n(CARD.glow.lowAt[0])}, ${n(CARD.glow.lowAt[1])})) / vec2(${n(CARD.glow.lowWide[0])}, ${n(CARD.glow.lowWide[1])});
      float ringG = (length((atG - vec2(${n(CARD.hair.crownAt[0])}, ${n(CARD.hair.crownAt[1])})) / vec2(${n(CARD.hair.crownWide[0])}, ${n(CARD.hair.crownWide[1])})) - ${n(CARD.glow.ring[0])}) / ${n(CARD.glow.ring[1])};
      vec2 upG = (atG - vec2(${n(CARD.glow.upAt[0])}, ${n(CARD.glow.upAt[1])})) / vec2(${n(CARD.glow.upWide[0])}, ${n(CARD.glow.upWide[1])});
      float moreG = max(max(exp(-0.5 * dot(lowG, lowG)), ${n(CARD.glow.ringKeep)} * exp(-0.5 * ringG * ringG)), ${n(CARD.glow.upKeep)} * exp(-0.5 * dot(upG, upG)));
      vec2 topG = (atG - vec2(${n(CARD.glow.topAt[0])}, ${n(CARD.glow.topAt[1])})) / vec2(${n(CARD.glow.topWide[0])}, ${n(CARD.glow.topWide[1])});
      float outG = max(${n(CARD.glow.swarmOut)} * (1.0 - smoothstep(${n(CARD.glow.swarmFrom[0])}, ${n(CARD.glow.swarmFrom[1])}, swarmG)) * (1.0 - ${n(CARD.glow.moreKeep)} * moreG), ${n(CARD.glow.cottageOut)} * cotG);
      outG = max(outG, max(${n(CARD.glow.fieldOut)} * (1.0 - moreG), ${n(CARD.glow.topOut)} * exp(-0.5 * dot(topG, topG))));
      // before the cottage and the tree a light is a small point with a tight glow: they are few there, none is thrown out of focus, and none is large
      float crownG = 1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.hair.sceneEdge[1])}, length((atG - vec2(${n(CARD.hair.crownAt[0])}, ${n(CARD.hair.crownAt[1])})) / vec2(${n(CARD.hair.crownWide[0])}, ${n(CARD.hair.crownWide[1])})));
      // the lanterns, the trunk and the yard between the two are the miniature as well
      float bandG = 1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.hair.sceneEdge[1])}, length((atG - vec2(${n(CARD.glow.bandAt[0])}, ${n(CARD.glow.bandAt[1])})) / vec2(${n(CARD.glow.bandWide[0])}, ${n(CARD.glow.bandWide[1])})));
      // summer's own, in the calm alone: the tree's lowest boughs hang out past the crown's outline, and a large glow whose disc lay over their tips stood wider than a light may before the tree. For a light's size and its focus the crown reaches further (looks.ts, CARD.glow.treeReach); how many are lit there goes by crownG as it did, and at the storm's full level this is crownG itself
      float treeG = crownG;
      if (uStorm.x < 0.99) treeG = max(crownG, (1.0 - smoothstep(${n(CARD.hair.sceneEdge[0])}, ${n(CARD.glow.treeReach)}, length((atG - vec2(${n(CARD.hair.crownAt[0])}, ${n(CARD.hair.crownAt[1])})) / vec2(${n(CARD.hair.crownWide[0])}, ${n(CARD.hair.crownWide[1])})))) * (1.0 - smoothstep(0.9, 0.99, uStorm.x)));
      float sceneG = max(max(cotG, treeG), bandG) * afloat * (1.0 - gustC);
      outG = max(outG, max(${n(CARD.glow.crownOut)} * crownG, ${n(CARD.glow.bandOut)} * bandG));
      nearC *= 1.0 - sceneG;
      sceneL = sceneG;
      rC = mix(rC, min(rC, uPoint.w * ${n(CARD.glow.scenePx)}), sceneG);
      // where a light stands decides how brightly it is lit, so a light that crossed the edge of a swarm went out or came on within a frame or two. The edge is wide now: a light swells and fades as it flies in and out of a swarm, and one that flies fast is lit wherever it is, so none flashes
      float flyG = smoothstep(${n(CARD.glow.swarmFly[0])}, ${n(CARD.glow.swarmFly[1])}, pace);
      keepC *= mix(1.0, smoothstep(outG - ${n(CARD.glow.swarmEdge)}, outG, fract(own * 211.0)), afloat * (1.0 - gustC) * (1.0 - flyG));
      // at rest a share of the lights is not lit: the ones that are stand in a row by their own number, from fine points to a few large soft glows (restSC below). They come on as the storm rises, which needs them all
      keepC *= mix(1.0, step(${n(CARD.glow.restOut - CARD.glow.restSpeck[0])}, fract(h2.x * 113.0)), afloat * (1.0 - max(gustC, uStorm.x)));
      // in the storm few of them are seen and fewer still before the cottage, each smaller: small warm sparks, not a rain of dashes
      keepC *= 1.0 - gustC * (1.0 - smoothstep(-0.08, 0.0, ${n(CARD.glow.stormShare)} * (1.0 - ${n(CARD.glow.stormCottage)} * cotG) - fract(own * 389.0)));
      rC *= mix(1.0, ${n(CARD.glow.stormSize)}, gustC);
    }
    if (${at(SHAPE.spark)}) {
      // at rest the sparks stand thick in the open air of the upper left and thin before the crown and the cottage, so that the tree is read whole against the air. The edge is wide: a spark fades as it drifts across it and none goes out within a frame
      vec2 atK = (view.xy * (centreV.z / view.z) - centreV.xy) / max(uLens.x, 1e-4);
      vec2 upK = (atK - vec2(${n(CARD.spark.restUpAt[0])}, ${n(CARD.spark.restUpAt[1])})) / vec2(${n(CARD.spark.restUpWide[0])}, ${n(CARD.spark.restUpWide[1])});
      vec2 crownK = (atK - vec2(${n(CARD.spark.restCrownAt[0])}, ${n(CARD.spark.restCrownAt[1])})) / vec2(${n(CARD.spark.restCrownWide[0])}, ${n(CARD.spark.restCrownWide[1])});
      vec2 cotK = (atK - vec2(${n(CARD.spark.restCottageAt[0])}, ${n(CARD.spark.restCottageAt[1])})) / vec2(${n(CARD.spark.restCottageWide[0])}, ${n(CARD.spark.restCottageWide[1])});
      float outK = max(mix(${n(CARD.spark.restOutField)}, ${n(CARD.spark.restOutUp)}, exp(-0.5 * dot(upK, upK))), ${n(CARD.spark.restOutScene)} * max(exp(-0.5 * dot(crownK, crownK)), exp(-0.5 * dot(cotK, cotK))));
      vec4 chimVK = viewMatrix * vec4(lensPlace((modelMatrix * vec4(${CARD.spark.restChimneyBall.map(n).join(', ')}, 1.0)).xyz, eye).xyz, 1.0);
      vec2 chimK = (atK - (chimVK.xy * (centreV.z / chimVK.z) - centreV.xy) / max(uLens.x, 1e-4)) / vec2(${n(CARD.spark.restChimneyWide[0])}, ${n(CARD.spark.restChimneyWide[1])});
      outK = max(outK, ${n(CARD.spark.restOutChimney)} * exp(-0.5 * dot(chimK, chimK)));
      outK = max(outK, ${n(CARD.spark.restOutRim)} * smoothstep(${n(CARD.spark.restRim[0])}, ${n(CARD.spark.restRim[1])}, length(atK)));
      keepC *= mix(1.0, smoothstep(outK - ${n(CARD.spark.restEdge)}, outK, fract(own * 211.0)), afloat * (1.0 - gustC));
      paleC = mix(${n(CARD.spark.restPaleShare[0])}, ${n(CARD.spark.restPaleShare[1])}, smoothstep(${n(CARD.spark.restPaleFrom[0])}, ${n(CARD.spark.restPaleFrom[1])}, atK.x)) * (1.0 - ${n(CARD.spark.restPaleRim)} * smoothstep(${n(CARD.spark.restRim[0])}, ${n(CARD.spark.restRim[1])}, length(atK)));
      skirtC = 1.0 - max(smoothstep(${n(CARD.spark.restSkirtTree[0])}, ${n(CARD.spark.restSkirtTree[1])}, atK.x) * (1.0 - smoothstep(${n(CARD.spark.restSkirtTree[2])}, ${n(CARD.spark.restSkirtTree[3])}, atK.x)) * (1.0 - smoothstep(${n(CARD.spark.restSkirtTree[4])}, ${n(CARD.spark.restSkirtTree[5])}, atK.y)), 1.0 - smoothstep(${n(CARD.spark.restSkirtLow[0])}, ${n(CARD.spark.restSkirtLow[1])}, atK.y));
      // a spark that is going out is gone sooner than its light falls: a crowd of half lit ones reads as dust, not as sparks
      keepC *= mix(1.0, aData.z * aData.z * aData.z * aData.z, afloat * (1.0 - gustC));
      vec2 rightK = (atK - vec2(${n(CARD.spark.nearRightAt[0])}, ${n(CARD.spark.nearRightAt[1])})) / vec2(${n(CARD.spark.nearRightWide[0])}, ${n(CARD.spark.nearRightWide[1])});
      nearC *= step(fract(own * 97.0), mix(${n(CARD.spark.nearField)}, 1.0, max(exp(-0.5 * dot(upK, upK)), exp(-0.5 * dot(rightK, rightK))))) * (1.0 - smoothstep(${n(CARD.spark.nearCottage[0])}, ${n(CARD.spark.nearCottage[1])}, exp(-0.5 * dot(cotK, cotK))));
      keepC = mix(keepC, 1.0, nearC);
    }
    float farC = afloat * (1.0 - gustC) * whole * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0) * smoothstep(${n(CARD.far.from)}, ${n(CARD.far.to)}, depth);
    rC *= 1.0 + (${at(SHAPE.petal)} ? mix(${n(CARD.near.petalSize[0] - 1)}, ${n(CARD.near.petalSize[1] - 1)}, pow(fract(h.y * 173.0), ${n(CARD.near.petalSkew)})) : (${at(SHAPE.leaf)} ? mix(${n(CARD.leafNearSize - 1)}, ${n(CARD.near.size - 1)}, gustC) : ${n(CARD.near.size - 1)})) * nearC * (sheet + (${at(SHAPE.seed)} ? 0.6 : 0.0));
    rC = mix(rC, min(rC, uPoint.w * (${at(SHAPE.seed)} ? ${n(CARD.clear.seedPx)} : (sheet > 0.5 ? ${n(CARD.clear.sheetPx)} : 1e4))), clearC);
    if (laidB) rC = aData.x * ${n(1 / CARD.down.size)} * uPoint.y * mag / zImg;
    else if (${at(SHAPE.seed)} && aState > 0.5) rC = min(rC, uPoint.w * mix(${n(CARD.clear.snagPx[0])}, ${n(CARD.clear.snagPx[1])}, pow(fract(h.w * 113.0), ${n(CARD.clear.snagSkew)})));
    if (shape > ${n(SHAPE.bat - 0.5)}) rC /= shrink;
    float ph = aData.w;
    float yaw = 6.2831853 * h.x + ${n(CARD.yawSway)} * sin(ph + 6.2831853 * h2.x) * afloat;
    float rock = mix(${at(SHAPE.petal)} ? ${n(CARD.petalRock)} : (${at(SHAPE.leaf)} ? ${n(CARD.leafRock)} : ${n(CARD.fleckRock)}), ${n(CARD.stormRock)}, gustC);
    float r1 = rock * sin(ph + 6.2831853 * h.y);
    float r2 = 0.6 * rock * sin(2.0 * ph + 6.2831853 * h.z);
    if (${at(SHAPE.leaf)}) {
      // a leaf that tumbles lingers with its face to the eye and is quick through its edge, so at rest most are read as leaves and few as lines
      float faceL = ${n(CARD.leafFace)} * afloat * (1.0 - gustC);
      float thL = ph + 6.2831853 * h.y;
      r1 = thL + faceL * sin(2.0 * thL);
      yaw -= faceL * sin(2.0 * yaw);
    }
    if (${at(SHAPE.seed)}) {
      rock = mix(${n(CARD.seedRock)}, ${n(CARD.stormRock)}, gustC);
      r1 = rock * sin(ph + 6.2831853 * h.y) + (aState > 0.5 ? 2.6 : ${n(CARD.seedTilt)}) * tilt.x + ${n(CARD.seedLean)} * (fract(h.w * 91.0) * 2.0 - 1.0) * afloat;
      r2 = 0.6 * rock * sin(2.0 * ph + 6.2831853 * h.z) + (aState > 0.5 ? 2.6 : ${n(CARD.seedTilt)}) * tilt.y + ${n(CARD.seedLean)} * (fract(h.w * 57.0) * 2.0 - 1.0) * afloat;
      // a clock hangs: its stalk stands near upright under its head, each at its own lean, and rocks a little. So no stalk points at the eye, where the head's picture would whip round with it, and the hairs turn far less in a frame than the angle between two of them
      if (clockC > 0.0) {
        r1 = mix(r1, ${n(CARD.clock.rock)} * sin(ph + 6.2831853 * h.y) + ${n(CARD.clock.lean)} * (fract(h.w * 91.0) * 2.0 - 1.0), clockC);
        r2 = mix(r2, ${n(0.6 * CARD.clock.rock)} * sin(2.0 * ph + 6.2831853 * h.z) + ${n(CARD.clock.lean)} * (fract(h.w * 57.0) * 2.0 - 1.0), clockC);
      }
      lying = 0.0;
    }
    r1 = mix(r1, ${n(CARD.lieTilt)} * tilt.x, lying);
    r2 = mix(r2, ${n(CARD.lieTilt)} * tilt.y, lying);
    vec3 cU = vec3(cos(yaw), 0.0, sin(yaw));
    vec3 cV = vec3(sin(yaw), 0.0, -cos(yaw));
    vec3 cN = vec3(0.0, 1.0, 0.0);
    cV = pointTurn(cV, cU, cos(r1), sin(r1));
    cN = pointTurn(cN, cU, cos(r1), sin(r1));
    cU = pointTurn(cU, cV, cos(r2), sin(r2));
    cN = pointTurn(cN, cV, cos(r2), sin(r2));
    if (lying > 0.5 && (${at(SHAPE.petal)} || ${at(SHAPE.leaf)})) {
      float code = floor(ph * ${n(65536 / (2 * Math.PI))});
      float fz = floor(code / 256.0);
      vec2 lvl = vec2(code - 256.0 * fz, fz) / 127.5 - 1.0;
      float l2 = dot(lvl, lvl);
      vec3 onto = l2 < 1.0 ? vec3(lvl.x, sqrt(1.0 - l2), lvl.y) : vec3(0.0, 1.0, 0.0);
      onto = normalize(onto + ${n(CARD.lieLoose)} * vec3(tilt.x, 0.0, tilt.y));
      vec3 flatU = vec3(cos(yaw), 0.0, sin(yaw));
      cN = onto;
      cU = normalize(flatU - onto * dot(flatU, onto));
      cV = cross(cN, cU);
    }
    if (${at(SHAPE.seed)}) {
      vec3 was = cU;
      cU = cN;
      cN = cV;
      cV = was;
    }
    if (shape > ${n(SHAPE.bat - 0.5)}) {
      vec3 going = aNow - aPrev;
      float pace2 = dot(going, going);
      cU = pace2 > 1e-10 ? going / sqrt(pace2) : vec3(cos(yaw), 0.0, sin(yaw));
      vec3 side = cross(vec3(0.0, 1.0, 0.0), cU);
      cV = normalize(side + vec3(0.0, ${n(CARD.batBank)} * sin(ph * 0.0 + 6.2831853 * h.y), 0.0) + 1e-4);
      cN = normalize(cross(cU, cV));
      cV = cross(cN, cU);
    }
    vec3 bends = vec3(0.0);
    if (shape > ${n(SHAPE.bat - 0.5)}) bends = vec3(0.0, ${n(CARD.batRaise)} + ${n(CARD.batFlap)} * sin(ph + 6.2831853 * h.z), 0.0);
    if (${at(SHAPE.petal)}) bends = vec3(${n(CARD.petalCup[0])}, ${n(CARD.petalCup[1])}, 0.0) * mix(0.6, 1.4, h2.z) * mix(1.0, ${n(CARD.lieFlat)}, lying);
    if (${at(SHAPE.leaf)}) bends = vec3(${n(CARD.leafCurl[0])} * (h2.z * 2.0 - 0.6), ${n(CARD.leafCurl[1])} * mix(0.3, 1.0, h2.w), ${n(CARD.leafCurl[2])} * (h2.y * 2.0 - 1.0));
    vec3 uV = toView * cU;
    vec3 vV = toView * cV;
    vec3 nV = toView * cN;
    if (${at(SHAPE.leaf)}) {
      // a leaf afloat is turned about the line to the eye by its own angle: its long axis lies level in the water, and on the picture the leaves would all lie one way
      float rollL = 6.2831853 * fract(h.z * 47.0) * afloat * (1.0 - gustC);
      mat2 turnL = mat2(cos(rollL), sin(rollL), -sin(rollL), cos(rollL));
      uV.xy = turnL * uV.xy;
      vV.xy = turnL * vV.xy;
      nV.xy = turnL * nV.xy;
      // a leaf seen on its edge is a hairline: at rest it is let go as it turns through its edge, so the air holds leaves and no dark strokes
      keepC *= mix(1.0, smoothstep(${n(CARD.leafRestEdge[0])}, ${n(CARD.leafRestEdge[1])}, abs(nV.z)), afloat * (1.0 - gustC) * whole);
    }
    if (shape > ${n(SHAPE.bat - 0.5)}) {
      vec2 goes = (toView * (aNow - aPrev)).xy;
      float lean = (${n(CARD.batLean)} * goes.x / max(length(goes), 1e-5) + ${n(CARD.batBank)} * (h.y * 2.0 - 1.0)) * mix(${n(CARD.batRestTilt)}, 1.0, gustC);
      uV = vec3(sin(lean), cos(lean), 0.0);
      vV = vec3(cos(lean), -sin(lean), 0.0);
      nV = vec3(0.0, 0.0, 1.0);
    }
    vec2 ca = uV.xy * rC;
    vec2 cb = vV.xy * rC;
    float need = (${at(SHAPE.petal)} ? ${n(CARD.petalThick)} : ${n(CARD.thick)}) * rC;
    float la = length(ca);
    float lb = length(cb);
    if (${at(SHAPE.seed)}) need = 0.0;
    if (la >= lb) {
      vec2 pa = vec2(-ca.y, ca.x) / max(la, 1e-4);
      float comp = dot(cb, pa);
      if (abs(comp) < need) cb += pa * ((comp < 0.0 ? -need : need) - comp);
    } else {
      vec2 pb = vec2(-cb.y, cb.x) / max(lb, 1e-4);
      float comp = dot(ca, pb);
      if (abs(comp) < need) ca += pb * ((comp < 0.0 ? -need : need) - comp);
    }
    vec2 stC = (toView * ((aNow - aPrev) * shut)).xy * (uPoint.y * mag / zImg) * afloat;
    vec2 holdC = vec2(0.0);
    // the down and the lights of the storm are drawn near where they are at the middle of the exposure: carried along its whole path from one moment of the shutter to the next, a short stroke is a row of dashes, a head a long smear and a light a faint thread
    if (storming && (${at(SHAPE.seed)} || ${at(SHAPE.light)})) holdC = -stC * uStorm.y * (uPoint.z / max(shut, 1e-6) - (1.0 - uStorm.x)) * (${at(SHAPE.light)} ? ${n(CARD.glow.stormHold)} : (whole > 0.5 ? ${n(CARD.hair.stormHold)} : ${n(CARD.line.stormHold)}));
    // above the pixels of the hd picture a light of the storm stands at its place of the middle of the exposure in every sample already (shader.ts, VERT_MAIN), so there is nothing of its own path to hold it back from
    if (storming && ${at(SHAPE.light)} && uPoint.w > 1.0) holdC *= 1.0 - min(uPoint.w - 1.0, 1.0);
    if (storming && ${at(SHAPE.light)} && uMidHold.x > 0.0) {
      // In a frame of the film the ball travels a little inside the shutter while it is set down and while it rocks after the landing, and each sample draws the ball where it stands at its own moment. A light's one streak, carried with the ball from sample to sample, was a band of lines side by side. So a light is held against the ball's travel as it is held against its own path: it is drawn at its place in the ball as the ball stands at the middle of the exposure, through the glass as the glass stands there, by the share that stands (points.ts, lightRide)
      // the moments of a travelling frame's samples are moved a little from their shares of the shutter, and the hold above reads the share: the light is put back by that much of its own path
      holdC += stC * (uPoint.z / max(shut, 1e-6)) * (uMidHold.y * uMidHold.x);
      vec3 rideC = mat3(modelMatrix) * uMidPose[3].xyz;
      vec4 midP = lensPlace((modelMatrix * (uMidPose * vec4(nowL, 1.0))).xyz - rideC, eye - rideC);
      vec4 midV = viewMatrix * vec4(midP.xyz + rideC, 1.0);
      holdC -= ((midV.xy + uAperture.xy * (lensC * (1.0 + uAperture.z * midV.z))) / -midV.z - (view.xy + uAperture.xy * (lensC * uAperture.z * view.z)) / -view.z) * (uPoint.y * uMidHold.x);
    }
    vec3 pathC = (aNow - aPrev) * shut;
    if (storming && ${at(SHAPE.light)}) {
      // a light of the storm is a short bright streak that lies along the swirl of the picture, each a little out of its way: never a dot
      vec2 atW = (view.xy * (centreV.z / view.z) - centreV.xy) / max(uLens.x, 1e-4) - vec2(${n(CARD.line.stormSwirlAt[0])}, ${n(CARD.line.stormSwirlAt[1])});
      vec2 tanW = vec2(-atW.y, atW.x) / max(length(atW), 1e-3);
      if (dot(tanW, stC) < 0.0) tanW = -tanW;
      float tnW = (2.0 * fract(own * 317.0) - 1.0) * ${n(CARD.glow.stormStray)};
      vec2 swW = mat2(cos(tnW), sin(tnW), -sin(tnW), cos(tnW)) * tanW * max(length(stC), uPoint.w * mix(${n(CARD.glow.stormStreakPx[0])}, ${n(CARD.glow.stormStreakPx[1])}, pow(fract(own * 613.0), ${n(CARD.glow.stormStreakSkew)})) * gustC);
      stC = easeC < 1.0 ? mix(stC, swW, easeC) : swW;
    }
    if (${at(SHAPE.spark)} && !storming) {
      holdC = stC * uStorm.y * (1.0 - mix(${n(CARD.spark.calmStreak)}, 1.0, gustC));
      stC *= mix(${n(CARD.spark.calmStreak)}, 1.0, gustC);
    }
    if (whole < 0.5 && lineC < 0.5 && !storming) stC *= ${n(CARD.dabStreak)};
    float limC = uLimit.x / (uLimit.x + length(stC));
    stC *= limC;
    float bowC = 0.0;
    // where a stroke of the storm's down stands from the middle of the storm's swirl on the picture, in the ball's radii
    vec2 swirlC = vec2(0.0, 1.0);
    float dzC = 0.0;
    // a few of the storm's strokes are bits of green leaf torn from the tree
    float bitC = storming && ${at(SHAPE.seed)} && lineC > 0.5 && fract(own * 271.0) < ${n(CARD.line.stormLeaves)} ? 1.0 : 0.0;
    if (lineC > 0.5) {
      vec3 mvC = (aNow - aPrev) * shut;
      vec3 curC = veilCurrent(nowL);
      if (storming && ${at(SHAPE.seed)}) {
        // the whirl goes round an axis that leans to the eye: before its middle the down goes one way on the picture and behind it the other, and at every depth between at its own slant, so the strokes would cross one another all over the picture. Every stroke lies as the whirl goes in one plane across the line of sight, stormPlaneMm from the whirl's middle: one whirl on the picture
        vec3 eyeC = vec3(toView[0].z, toView[1].z, toView[2].z);
        curC = veilCurrent(nowL + eyeC * (${n(CARD.line.stormPlaneMm)} - dot(eyeC, nowL - vec3(${ROLL_CENTRE.map(n).join(', ')}))) - vec3(toView[0].x, toView[1].x, toView[2].x) * ${n(CARD.line.stormAcrossMm)});
      }
      if (!storming) mvC = mix(mvC, curC * (length(mvC) * (dot(mvC, curC) < 0.0 ? -1.0 : 1.0)), ${n(CARD.line.align)} * uVeilRoll.x);
      // the down goes round with the whirl: its strokes lie along the current, each by its own share, and not across one another
      if (storming && ${at(SHAPE.seed)}) mvC = mix(mvC, curC * (length(mvC) * (dot(mvC, curC) < 0.0 ? -1.0 : 1.0)), mix(${n(CARD.line.stormAlign[0])}, ${n(CARD.line.stormAlign[1])}, fract(own * 151.0)));
      if (storming) mvC *= mix(${n(CARD.line.shutLong[0])}, ${n(CARD.line.shutLong[1])}, fract(own * 97.0));
      if (storming && ${at(SHAPE.seed)}) mvC *= mix(${n(CARD.line.stormLong[0])}, ${n(CARD.line.stormLong[1])}, pow(fract(own * 97.0), ${n(CARD.line.stormLongSkew)})) / mix(${n(CARD.line.shutLong[0])}, ${n(CARD.line.shutLong[1])}, fract(own * 97.0));
      if (mistC > 0.5) mvC *= ${n(CARD.line.stormMistLong)};
      stC = (toView * mvC).xy * (uPoint.y * mag / zImg) * afloat;
      if (storming && ${at(SHAPE.seed)}) {
        // on the picture the storm is one swirl round the glass: level at the top, down the sides and round again below. The liquid's own current runs across it low over the ground, so a stroke lies along the swirl of the picture by the larger share, and keeps the sense in which it goes
        swirlC = (view.xy * (centreV.z / view.z) - centreV.xy) / max(uLens.x, 1e-4) - vec2(${n(CARD.line.stormSwirlAt[0])}, ${n(CARD.line.stormSwirlAt[1])});
        float lenS = length(stC);
        vec2 tanS = vec2(-swirlC.y, swirlC.x) / max(length(swirlC), 1e-3);
        // the swirl has no eye that is seen: near its middle the hair runs nearly level, as it does across the cottage and the trunk
        tanS = normalize(mix(vec2(${n(CARD.line.stormLevel[0])}, ${n(CARD.line.stormLevel[1])}) * (tanS.x < 0.0 ? -1.0 : 1.0), tanS, smoothstep(${n(CARD.line.stormEye[0])}, ${n(CARD.line.stormEye[1])}, length(swirlC))));
        if (dot(tanS, stC) < 0.0) tanS = -tanS;
        vec2 dirS = mix(stC / max(lenS, 1e-4), tanS, ${n(CARD.line.stormSwirl)});
        stC = dirS * (lenS / max(length(dirS), 1e-4));
        // no two of the down's strokes lie alike: each is turned out of the swirl's way by its own angle. At the top the hair lies close along the swirl; at the sides and in the lower half it crosses itself, each lock up to half a right angle off
        float openS = 1.0 - smoothstep(${n(CARD.line.stormStrayTop[0])}, ${n(CARD.line.stormStrayTop[1])}, swirlC.y) * (1.0 - smoothstep(${n(CARD.line.stormStraySide[0])}, ${n(CARD.line.stormStraySide[1])}, abs(swirlC.x)));
        float tnC = (fract(own * 317.0) < 0.5 ? -1.0 : 1.0) * mix(${n(CARD.line.stormStray)} * pow(fract(own * 839.0), ${n(CARD.line.stormStraySkew)}), ${n(CARD.line.stormStrayLow)} * pow(fract(own * 839.0), ${n(CARD.line.stormStrayLowSkew)}), openS);
        stC = mat2(cos(tnC), sin(tnC), -sin(tnC), cos(tnC)) * stC;
        // the locks are long and few: the down the eye reads as silk is a few hundred long locks of many hairs, not thousands of short strokes
        if (mistC < 0.5 && bitC < 0.5) keepC *= mix(step(fract(own * 613.0), ${n(CARD.line.stormKeep)}), step(fract(own * 613.0), ${n(STORM_LANDING.line.stormKeep)}), uStormLanding);
      }
      if (!storming) stC *= ${at(SHAPE.seed)} ? mix(${n(CARD.line.seedStretch[0])}, ${n(CARD.line.seedStretch[1])}, pow(fract(own * 97.0), 2.0)) : (${at(SHAPE.leaf)} ? mix(${n(CARD.line.leafStretch[0])}, ${n(CARD.line.leafStretch[1])}, pow(fract(own * 97.0), 2.0)) : mix(${n(CARD.line.stretch[0])}, ${n(CARD.line.stretch[1])}, pow(fract(own * 97.0), 2.0)));
      // the down's strokes at the storm are the long arcs of the whirl: they run far past the length that holds every other trail
      float mostC = storming && ${at(SHAPE.seed)} ? ${n(CARD.line.stormMostPx)} * uPoint.w : uLimit.x;
      limC = mostC / (mostC + length(stC));
      stC *= limC;
      if (bitC > 0.5) {
        float blC = length(stC);
        stC = (blC > 1e-4 ? stC / blC : vec2(1.0, 0.0)) * uPoint.w * mix(${n(CARD.line.stormLeafLongPx[0])}, ${n(CARD.line.stormLeafLongPx[1])}, fract(own * 613.0)) * mix(${n(CARD.line.deep[0])}, ${n(CARD.line.deep[1])}, smoothstep(-0.8, 0.8, depth));
      }
      pathC = mvC;
      // how far the trail runs toward or away from the eye, in millimetres over its drawn length
      dzC = clamp((toView * mvC).z * length(stC) / max(length((toView * mvC).xy) * (uPoint.y * mag / zImg), 1e-4), ${n(-CARD.line.deepMostMm)}, ${n(CARD.line.deepMostMm)}) * afloat;
      keepC *= storming ? (${at(SHAPE.seed)} ? smoothstep(${n(CARD.line.stormFromPx[0])}, ${n(CARD.line.stormFromPx[1])}, length(stC) / uPoint.w) : smoothstep(${n(CARD.line.shutFromPx[0])}, ${n(CARD.line.shutFromPx[1])}, length(stC) / uPoint.w)) : smoothstep(${n(CARD.line.fromPx[0])}, ${n(CARD.line.fromPx[1])}, length(stC) / uPoint.w);
      vec2 inC = (toView * (vec3(${ROLL_CENTRE.map(n).join(', ')}) - nowL)).xy;
      bowC = mix(${n(CARD.line.bow[0])}, ${n(CARD.line.bow[1])}, fract(h2.z * 131.0)) * (dot(vec2(-stC.y, stC.x), inC) < 0.0 ? -1.0 : 1.0) * (fract(h2.z * 17.0) < 0.25 ? -1.0 : 1.0);
    }
    if (storming && ${at(SHAPE.seed)}) {
      // the whirl is a spiral of arms with dark air between them: the down in an arm is seen whole, a stroke between two arms is nearly lost and a head there is fainter. The arms turn with the liquid, so a seed stays in its arm
      vec2 inS = (toView * (nowL - vec3(${ROLL_CENTRE.map(n).join(', ')}))).xy;
      float turnS = dot(inS, inS) > 0.0 ? atan(inS.y, inS.x) : 0.0;
      float armS = fract((turnS * ${n(1 / (2 * Math.PI))} - uVeilDrift.y) * ${n(CARD.line.stormArms)} + length(inS) / ${n(CARD.line.stormArmPitchMm)} + ${n(CARD.line.stormArmJitter)} * (fract(own * 733.0) - 0.5));
      float gapS = mix(lineC > 0.5 ? ${n(CARD.line.stormGapSeen)} : ${n(CARD.line.stormGapHeads)}, 1.0, smoothstep(0.0, ${n(CARD.line.stormArmEdge)}, armS) * (1.0 - smoothstep(${n(CARD.line.stormArmWide)}, ${n(CARD.line.stormArmWide + CARD.line.stormArmEdge)}, armS)));
      keepC *= lineC > 0.5 ? gapS * easeC : (easeC < 1.0 ? mix(1.0, gapS, easeC) : gapS);
    }
    float hlC = 0.5 * length(stC);
    if (shape > ${n(SHAPE.bat - 0.5)}) hlC *= ${n(CARD.batStreak)};
    vec2 alC = hlC > 1e-4 ? stC / (2.0 * hlC) : vec2(1.0, 0.0);
    float arcC = 0.0;
    if (storming && afloat > 0.5 && hlC > 1e-3 && shape < ${n(SHAPE.bat - 0.5)}) {
      // the trail of a thing that goes round with the liquid is an arc: the same arc for a leaf, a petal, a seed, a light and a spark
      arcC = clamp(dot((toView * pointSag(nowL, pathC)).xy, vec2(-alC.y, alC.x)) * (uPoint.y * mag / zImg) * limC * limC / hlC, ${n(-STREAK_ARC.most)}, ${n(STREAK_ARC.most)});
      if (lineC > 0.5) {
        bowC = -arcC;
        // a seed's stroke goes round the whirl in a plain curve: the path's own arc and no less than the stroke's own bow, to the same side
        // a seed's stroke bows with the swirl of the picture: the arc of the circle round the swirl's middle on which it lies, its middle the farther out, and no less than the stroke's own small bow
        if (${at(SHAPE.seed)}) bowC = (dot(vec2(-alC.y, alC.x), swirlC) < 0.0 ? -1.0 : 1.0) * min(max(${n(CARD.line.stormArc)} * hlC / max(2.0 * length(swirlC) * uLens.x * uPoint.y * mag / zImg, 1.0), mix(${n(CARD.line.stormBow[0])}, ${n(CARD.line.stormBow[1])}, pow(fract(h2.z * 131.0), ${n(CARD.line.stormBowSkew)}))), ${n(CARD.line.stormBowMost)});
        // a thing seen for the whole shutter leaves on each place of its path the share of the shutter it spent there: the faster, the longer and the fainter
        keepC *= min(1.0, (${at(SHAPE.seed)} ? ${n(CARD.line.stormDwellPx)} : ${n(CARD.line.dwellPx)}) * uPoint.w / hlC);
      }
    }
    float sgC = 0.5 * uBlur.z * (1.0 - exp(-(coc > 0.0 ? coc * uBlur.x : -coc * uBlur.y) / uBlur.z)) * afloat * mix(1.0, ${n(CARD.clear.blur)}, clearC);
    if (${at(SHAPE.spark)}) sgC *= mix(${n(CARD.spark.soft)}, 1.0, gustC);
    if (${at(SHAPE.seed)}) sgC *= mix(${n(CARD.hair.soft)}, lineC > 0.5 ? (storming ? ${n(CARD.line.stormSoft)} : 1.0) : ${n(CARD.hair.stormSoft)}, gustC);
    if (${at(SHAPE.light)}) sgC *= ${n(CARD.glow.soft)};
    sgC += uPoint.w * (nearC * (${at(SHAPE.spark)} ? mix(${n(CARD.spark.nearPx[0])}, ${n(CARD.spark.nearPx[1])}, pow(fract(h2.w * 173.0), ${n(CARD.spark.nearSkew)})) : (${at(SHAPE.light)} ? mix(${n(CARD.glow.nearPx[0])}, ${n(CARD.glow.nearPx[1])}, fract(h.y * 173.0)) : (${at(SHAPE.seed)} ? mix(${n(CARD.hair.lensPx[0])}, ${n(CARD.hair.lensPx[1])}, fract(h.y * 173.0)) : mix(${at(SHAPE.leaf)} ? mix(${n(CARD.leafNearPx[0])}, ${n(CARD.near.px[0])}, gustC) : ${n(CARD.near.px[0])}, ${at(SHAPE.leaf)} ? mix(${n(CARD.leafNearPx[1])}, ${n(CARD.near.px[1])}, gustC) : ${n(CARD.near.px[1])}, fract(h.y * 173.0))))) + farC * (${at(SHAPE.seed)} ? ${n(CARD.hair.farSoft)} : (${at(SHAPE.light)} ? ${n(CARD.glow.farSoft)} : 1.0)) * mix(${n(CARD.far.px[0])}, ${n(CARD.far.px[1])}, fract(h.y * 173.0)) + seedSoft);
    if (shape > ${n(SHAPE.bat - 0.5)}) sgC *= ${n(CARD.batSoft)};
    float s2C = sgC * sgC + ${n(PIXEL_SIGMA2)} * uPoint.w * uPoint.w;
    if (shape > ${n(SHAPE.bat - 0.5)}) s2C *= ${n(CARD.batEdge)};
    // The film's samples each look through another place of the lens, and so spread a seed or a light over the lens's blur circle
    // at its depth. Drawn once, it is spread by the same circle here, or the app's air holds more of them, and sharper.
    if (${at(SHAPE.seed)} || ${at(SHAPE.light)}) s2C += uWhole * 0.25 * coc * coc * afloat * (${at(SHAPE.seed)} ? (storming ? (lineC > 0.5 ? ${n(CARD.line.stormLens)} : mix(${n(CARD.hair.lens)}, ${n(CARD.hair.stormLens)}, gustC)) : ${n(CARD.hair.lens)}) * mix(1.0, ${n(CARD.clock.lens / CARD.hair.lens)}, clockC) : ${n(CARD.glow.lens)} * (1.0 - sceneL) * mix(1.0, ${n(CARD.glow.stormLens)}, gustC));
    float reachC = ((${at(SHAPE.seed)} ? ${n(CARD.hair.reach)} : ${n(CARD.bound)}) + abs(bends.x) + abs(bends.y)) * rC + 2.2 * sqrt(s2C) + 1.0;
    if (shape > ${n(SHAPE.light - 0.5)} && shape < ${n(SHAPE.spark + 0.5)}) reachC = ${n(CARD.glow.wide)} * 2.2 * rC + 2.6 * sqrt(s2C) + 1.0;
    // an ember's card is fall's and keeps its reach; a light's wide glow is summer's own
    if (${at(SHAPE.light)}) reachC = ${n(CARD.glow.lightWide)} * 2.2 * rC + 2.6 * sqrt(s2C) + 1.0;
    // a light's glow has a least width on the picture (cardGlow): the card holds it
    if (${at(SHAPE.light)}) reachC = max(reachC, ${n(2.2 * CARD.glow.widePx)} * uPoint.w + 2.6 * sqrt(s2C) + 1.0);
    // at rest a light is a bright heart in a soft glow (cardGlow, cardRestLight): restSC is how many pixels one pixel of the hd picture is for it, each a little of its own and no more than restClose larger at the close camera. The card reaches to where the heart's and the glow's light go to nothing
    float restSC = 1.0;
    if (${at(SHAPE.light)}) {
      float uR = clamp((fract(h2.x * 113.0) - ${n(CARD.glow.restOut)}) / ${n(1 - CARD.glow.restOut)}, 0.0, 1.0);
      float ownR = fract(h.z * 61.0);
      vec3 lawR = cardRestLight(uR, sceneL, ownR);
      restSC = mix(${n(1 - CARD.glow.restVary)}, ${n(1 + CARD.glow.restVary)}, ownR) * uPoint.w * min(max(1.0, uPoint.y / (max(zImg, 1.0) * uPoint.w * ${n(CARD.hair.puffMmPx)})), ${n(CARD.glow.restClose)});
      float tightC = max(gustC, uStorm.x);
      if (tightC < 1.0) {
        float reachR = max(${n(Math.sqrt(2 * Math.log(CARD.glow.restTop / CARD.glow.restCut[0])))} * sqrt(lawR.x * lawR.x * restSC * restSC + s2C), sqrt(2.0 * log(max(${n(CARD.glow.restTop / CARD.glow.restCut[0])} * lawR.z, 1.0))) * sqrt(lawR.y * lawR.y * restSC * restSC + s2C)) + 1.0;
        reachC = tightC > 0.0 ? max(reachC, reachR) : reachR;
      }
    }
    float headC = 0.0;
    float wideC = 0.0;
    // a sheet of the storm says how much of the lanterns' light falls where it stands: the haze glows round a lantern
    vec3 warmC = mistC > 0.5 ? stageGridWarm(nowL) * uTone.y : vec3(0.0);
    float warmestC = max(warmC.r, max(warmC.g, warmC.b));
    // wide and soft about a lantern, and far brighter right before it: the lantern blooms in the haze
    float glowC = smoothstep(${n(CARD.line.stormGlowFrom[0])}, ${n(CARD.line.stormGlowFrom[1])}, warmestC) + ${n(CARD.line.stormGlowHot)} * smoothstep(${n(CARD.line.stormGlowHotFrom[0])}, ${n(CARD.line.stormGlowHotFrom[1])}, warmestC);
    if (lineC > 0.5) {
      float hk = fract(h2.x * 29.0);
      if (${at(SHAPE.seed)}) {
        headC = step(fract(h2.x * 61.0), ${n(CARD.line.seedHeads)}) * mix(${n(CARD.line.fanPx[0])}, ${n(CARD.line.fanPx[1])}, hk * hk);
        wideC = mix(${n(CARD.line.seedWidePx[0])}, ${n(CARD.line.seedWidePx[1])}, fract(h2.w * 41.0));
      } else if (${at(SHAPE.leaf)}) {
        headC = step(fract(h2.x * 61.0), ${n(CARD.line.leafHeads)}) * mix(${n(CARD.line.leafHeadPx[0])}, ${n(CARD.line.leafHeadPx[1])}, pow(abs(hk), 1.5));
        wideC = mix(${n(CARD.line.leafWidePx[0])}, ${n(CARD.line.leafWidePx[1])}, fract(h2.w * 41.0));
      } else {
        headC = step(fract(h2.x * 61.0), ${n(CARD.line.petalHeads)}) * mix(${n(CARD.line.petalHeadPx[0])}, ${n(CARD.line.petalHeadPx[1])}, pow(abs(hk), 1.5));
        wideC = mix(${n(CARD.line.widePx[0])}, ${n(CARD.line.widePx[1])}, fract(h2.w * 41.0));
      }
      float deepC = mix(${n(CARD.line.deep[0])}, ${n(CARD.line.deep[1])}, smoothstep(-0.8, 0.8, depth));
      if (storming) {
        headC = 0.0;
        wideC *= ${at(SHAPE.seed)} ? ${n(CARD.line.shutSeedWide)} : ${n(CARD.line.shutWide)};
        if (${at(SHAPE.seed)}) {
          // the strokes of the down are of every width, most of them fine; a wide one is a soft one and fainter for it
          float wk = pow(fract(h2.w * 41.0), ${n(CARD.line.stormWideSkew)});
          wideC = mix(${n(CARD.line.stormWidePx[0])}, ${n(CARD.line.stormWidePx[1])}, wk);
          keepC *= mix(1.0, ${n(CARD.line.stormWideFaint)}, wk);
          if (mistC > 0.5) {
            wideC = mix(${n(CARD.line.stormMistPx[0])}, ${n(CARD.line.stormMistPx[1])}, fract(own * 389.0));
            keepC *= ${n(CARD.line.stormMistSeen)} / mix(1.0, ${n(CARD.line.stormWideFaint)}, wk);
          }
          if (bitC > 0.5) {
            wideC = mix(${n(CARD.line.stormLeafWidePx[0])}, ${n(CARD.line.stormLeafWidePx[1])}, fract(own * 389.0));
            keepC = afloat * gustC * ${n(CARD.line.stormLeafSeen)};
          }
        }
      }
      headC *= uPoint.w * deepC;
      wideC *= uPoint.w * deepC;
      if (bitC > 0.5) headC = -1.0;
      if (mistC > 0.5) headC = -2.0;
      keepC *= 1.0 - ${n(CARD.line.frontCut)} * smoothstep(0.35, 0.9, depth);
      // a sheet's card is as wide as its band of hairs and the haze round them, and a little wider where the lanterns' light makes that haze glow
      reachC = (mistC > 0.5 ? mix(2.0, 2.3, step(0.01, glowC)) * wideC + 2.0 * sqrt(s2C) : 2.6 * sqrt(s2C + wideC * wideC)) + 2.0 + abs(bowC) * hlC + 1.3 * max(headC, 0.0);
      // a stroke of the storm's down is a lock of hairs side by side: the card is wide enough for all of them, and tells the lock's half width (below -5: -1 is a bit of leaf, -2 a sheet)
      if (storming && ${at(SHAPE.seed)} && bitC < 0.5 && mistC < 0.5 && fract(h2.x * 733.0) < (uStormLanding < 1.0 ? ${n(CARD.line.stormLockShare)} : ${n(STORM_LANDING.line.stormLockShare)})) {
        // a lock is long and slim: no wider than a share of its stroke's length, so a short stroke is a few hairs close together and never a hatch
        float lockC = min(mix(${n(CARD.line.stormLockPx[0])}, ${n(CARD.line.stormLockPx[1])}, pow(fract(h2.x * 911.0), ${n(CARD.line.stormLockSkew)})) * uPoint.w * deepC, ${n(CARD.line.stormLockSlim)} * hlC);
        // on the way to the landing a lock grows slim (decision 222): its width goes in a line from the storm's to the landing's, each taken whole, so that the lock of the storm at its full is the same to the last bit
        lockC = mix(lockC, min(mix(${n(STORM_LANDING.line.stormLockPx[0])}, ${n(STORM_LANDING.line.stormLockPx[1])}, pow(fract(h2.x * 911.0), ${n(CARD.line.stormLockSkew)})) * uPoint.w * deepC, ${n(CARD.line.stormLockSlim)} * hlC), uStormLanding);
        reachC += lockC;
        headC = -10.0 - lockC;
      }
      keepC *= sheetSeenC;
    }
    // a light of the storm is drawn out past its head's end by stormEnds[1] of its half length, along its arc (cardGlow): its card holds that too
    float endC = storming && ${at(SHAPE.light)} ? ${n(CARD.glow.stormEnds[1])} : 0.0;
    vec2 extC = min(vec2(reachC + (0.67 + endC * (2.0 + endC)) * abs(arcC) * hlC) + (1.05 + endC) * hlC * abs(alC), vec2(uLimit.y));
    // a head that lies is a pale tuft on what it lies on, each seen by its own share: none is a white point on the dark roof
    if (laidB) keepC = (1.0 - smoothstep(${n(SEED_RESTS.fade[0])}, ${n(SEED_RESTS.fade[1])}, uStorm.x)) * mix(${n(SEED_RESTS.seen[0])}, ${n(SEED_RESTS.seen[1])}, fract(own * 71.0));
    alpha = aData.z * (shape > ${n(SHAPE.bat - 0.5)} ? 1.0 : rim) * mix(1.0, mix(${n(LENS_LOOK.farDim)}, 1.0, smoothstep(${n(LENS_LOOK.farDimFrom)}, ${n(LENS_LOOK.farDimTo)}, depth)), afloat * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0)) * keepC * (1.0 + ${n(STORM_FLOOD.frontGain)} * front);
    if (${at(SHAPE.light)}) alpha *= mix(1.0, mix(${n(CARD.glow.blinkLow)}, 1.0, pow(abs(0.5 + 0.5 * sin(ph + 6.2831853 * h.y)), ${n(CARD.glow.blinkSkew)})), smoothstep(${n(CARD.glow.unlit)}, 1.0, aData.z));
    if (shape < ${n(SHAPE.bat - 0.5)}) {
      for (int b = 0; b < ${BATS}; b++) {
        vec4 bt = uBat[b];
        if (bt.w <= 0.0) continue;
        vec3 bW = (modelMatrix * vec4(bt.xyz, 1.0)).xyz;
        vec4 bV = viewMatrix * vec4(lensPlace(bW, eye).xyz, 1.0);
        float ab = dot(bW - uLensCentre, oe / dist);
        float denB = max(R + (uLens.y - 1.0) * ab, 0.3 * R);
        float brPx = bt.w * uPoint.y * mix(1.0, uLens.y * R / denB, on) / max(dist - mix(ab, R - R * (R - ab) / denB, on), 1.0);
        float gapB = length((view.xy / view.z - bV.xy / bV.z) * uPoint.y) - 1.3 * sgC - 0.4 * rC;
        alpha *= smoothstep(${n(CARD.batHide[0])}, ${n(CARD.batHide[1])}, gapB / max(brPx, 1e-3));
      }
    }
    if (glowB) {
      // the glow's radius on the picture, its light (it comes and goes with the storm), and a card wide enough for the fainter glow round it
      rC = aData.x * uPoint.y * mag / zImg;
      alpha = aData.z * uStorm.x;
      reachC = min((aData.w < -1.5 ? ${n(STORM_BLOOM.lowReach)} : (aData.w < 0.0 ? ${n(STORM_BLOOM.reach)} : ${n(STORM_BLOOM.reach * STORM_BLOOM.far)})) * rC + 1.0, uLimit.y);
      extC = vec2(reachC);
    }
    if (alpha < 0.003) extC = vec2(0.0);
    vL0 = vec4(ca, cb);
    vL1 = vec4(nV.xy * rC, uV.z, vV.z);
    vL2 = vec4(nV, gustC);
    vL3 = vec4(h2.x, fract(h.w * 37.0), ph, fract(h.z * 61.0));
    if (${at(SHAPE.seed)}) vL3.z = seedNear + (laidB ? 1.0 : 0.0) - seedFar;
    // a light's own turn is of no use to its picture: the card says instead how far the light stands before the miniature
    if (${at(SHAPE.light)}) vL3.z = sceneL;
    // a sheet carries its own faint haze, the down too fine to be a hair at all: the miniature stands in the thick of it, so the haze before the cottage and the tree is the denser and ghosts them
    if (mistC > 0.5) {
      vL3.z = glowC;
      vL3.w = 1.0 + ${n(CARD.line.stormMistScene)} * mistSceneC;
    }
    // the film's lens looks through another place in every sample and lays a seed's stroke out once for each, over what is left of its circle beside the share the stroke stands still by (shader.ts, lensC). The small glint at a stroke's head then stands once for every sample, a bunch of dots, two dozen of them at the stills' close camera (open item 277). A stroke that is no mist reads nothing else here, so its card says how far the lens lays it out, in pixels of the hd picture, and the glint goes out by that (cardStreak)
    if (${at(SHAPE.seed)} && lineC > 0.5 && mistC < 0.5) vL3.z = (1.0 - lensC) * abs(coc) / uPoint.w;
    float detC = ca.x * cb.y - ca.y * cb.x;
    detC = abs(detC) < 1e-5 ? 1e-5 : detC;
    vec2 qnC = vec2(nV.x * cb.y - nV.y * cb.x, ca.x * nV.y - ca.y * nV.x) * (rC / detC);
    float bendFit = min(1.0, ${n(CARD.bendFit)} / (length(qnC) * 2.4 * (abs(bends.x) + abs(bends.y) + 0.5 * abs(bends.z)) + 1e-4));
    vL4 = vec4(bends, rC);
    if (lineC > 0.5) vL4 = vec4(bowC, fract(h2.x * 83.0), headC, wideC);
    else if (${at(SHAPE.spark)}) vL4.xy = vec2(paleC, skirtC);
    // a seed's card has no bends: under the storm's full level it says instead how far its stalk is hidden before the miniature, how much of a clock it is, and whether it is a whole head afloat
    else if (${at(SHAPE.seed)} && uStorm.x < 0.99) vL4.xyz = vec3(stalkOutC, clockC, whole * afloat);
    vStreak = vec4(alC, hlC, s2C);
    vKind = vec4(aData.y, 2.0 * lying + 0.5 + arcC, float(pid & 4095u) + 0.01 + 0.98 * gustC, whole);
    if (glowB) {
      vKind.w = 2.0;
      vL3.y = aData.w;
      vL4 = vec4(0.0, 0.0, reachC, rC);
    }
    vFog.a *= shape > ${n(SHAPE.bat - 0.5)} ? ${n(CARD.batFog)} : mix(${n(CARD.fog)}, 1.0, lying) * mix(${n(CARD.dabFog)}, 1.0, max(whole, lineC));
    if (${at(SHAPE.leaf)}) vFog.a = mix(vFog.a, min(vFog.a, ${n(CARD.leafFogMost)}), afloat * uStorm.x);
    // the storm's sheets are lit by the lights inside: round a lantern a sheet takes the lantern's own light, whole, so the storm glows from within
    vec3 litC = base0;
    if (mistC > 0.5) litC += warmC * ${n(CARD.line.stormMistWarm)};
    vGrid = vec4(litC * min(1.0, ${n(LIT_MOST)} * uLightBurn / max(max(litC.r, max(litC.g, litC.b)), 1e-3)), bendFit);
    // the storm's down is lit through and through: a stroke in the miniature's shade takes most of the light a stroke in the open takes, thrown on it by the bright down all round it
    vec3 keyC = keyIn;
    if (storming && ${at(SHAPE.seed)} && lineC > 0.5) keyC = mix(keyIn, uRigKeyCol * uRigInside.x, ${n(CARD.line.stormLit)} * gustC);
    vDom = vec4(keyC * uRigPoint.x, lineC);
    clip = clipC;
    if (${at(SHAPE.seed)} && aState > 0.5) {
      // a head that has come to rest on a roof or a stone stands on it: its card is drawn that far nearer, so the thing it lies on does not cut it
      vec4 nearerC = projectionMatrix * vec4(view.xy, view.z + min(reachC * zImg / (uPoint.y * mag), ${n(CARD.clear.snagLiftMm)}), 1.0);
      clip.z = nearerC.z / nearerC.w * clip.w;
    }
    if (shape > ${n(SHAPE.bat - 0.5)} && on > 0.5) {
      vec2 fromC = (view.xy / -view.z - centreV.xy / -centreV.z) * uPoint.y;
      float mostC = max(R * uPoint.y / sqrt(max(dist * dist - R * R, 1.0)) - ${n(CARD.batInside)} * rC, 1.0);
      float isC = length(fromC);
      if (isC > mostC) clip.xy += fromC * (mostC / isC - 1.0) * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * (clip.w / uPoint.y);
    }
    clip.xy -= holdC * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * (clip.w / uPoint.y);
    if (${at(SHAPE.seed)} && on > 0.5 && !laidB && !glowB) {
      // The glass's fade at its edge looks at where a particle's centre stands, and that is enough for a flake or a mote. A seed is wider than that: its down stands at the end of its stalk, up to nearly two of its own radii from its centre, and a stroke of the storm runs on for half its length. So a seed near the wall is drawn further in by what would have stood past the ball's outline: no hair, stalk or stroke is drawn in the room.
      // The film looks through another place of its lens in every sample, and a clock stands at one place in all of them (shader.ts, lensC). The ball's middle does not: taken as each sample sees it, a head by the wall was drawn in by another length in every sample, and stood as many times as the frame has samples, a few pixels apart (seen at the right rim in the film's close camera once the near heads were let in). So the middle is moved here by the share the head itself is moved by; in the storm, from the level at which the clocks' look is gone (looks.ts, CARD.clock.stormOff), it is as it was.
      vec2 midS = (centreV.xy + uAperture.xy * (lensC * (1.0 - smoothstep(${n(CARD.clock.stormOff[0])}, ${n(CARD.clock.stormOff[1])}, uStorm.x)))) / -centreV.z;
      vec2 fromS = (view.xy / -view.z - midS) * uPoint.y - holdC;
      float isS = length(fromS);
      vec2 dirS = fromS / max(isS, 1e-3);
      float outS;
      if (lineC > 0.5) {
        float endS = max(length(fromS + alC * hlC), length(fromS - alC * hlC));
        outS = (endS - isS) * endS / max(isS, 1.0) + reachC + 0.67 * abs(arcC) * hlC;
      } else {
        float leanS = pow(abs(asin(min(length(ca) / max(rC, 1e-3), 1.0)) * ${n(2 / Math.PI)}), mix(mix(${n(CARD.down.leanSkew)}, ${n(CARD.down.star.leanSkew)}, step(fract(h2.x * 47.0), ${n(CARD.down.star.share)})), ${n(CARD.down.stormLeanSkew)}, gustC));
        vec2 stS = ca * (sin(leanS * ${n(Math.PI / 2)}) * rC / max(length(ca), 1e-3));
        outS = max(${n(CARD.hair.hub)} * dot(stS, dirS) + (${n(CARD.down.half * CARD.down.size)} + ${n(CARD.run.seedDrawn)} * gustC) * rC, ${n(-CARD.hair.foot * CARD.hair.footSpan[1])} * dot(stS, dirS) + ${n(CARD.hair.insidePad)} * rC) + ${n(CARD.hair.insidePad)} * rC + 2.2 * sqrt(s2C) + 1.0 + (1.0 - easeC) * hlC;
        // a clock stands at its true lean on a longer stalk: it reaches as far as its hub and its foot stand out at that lean
        if (clockC > 0.0) {
          vec2 stK = ca * min(1.0, rC / max(length(ca), 1e-3));
          outS = max(outS, max(${n(CARD.hair.hub)} * dot(stK, dirS) + ${n(CARD.down.half * CARD.down.size)} * rC, ${n(-(CARD.clock.foot[1] + CARD.hair.grain))} * dot(stK, dirS) + ${n(CARD.hair.insidePad)} * rC) + ${n(CARD.hair.insidePad)} * rC + 2.2 * sqrt(s2C) + 1.0);
        }
      }
      float mostS = max(${n(CARD.hair.inside)} * R * uPoint.y / sqrt(max(dist * dist - R * R, 1.0)) - outS, 1.0);
      if (isS > mostS) clip.xy += fromS * (mostS / isS - 1.0) * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * (clip.w / uPoint.y);
    }
    // the low glow is light in the liquid, so it is drawn no nearer than the glass: the fragment stage finds the glass on each pixel's own ray, from the ray through the card's middle
    if (glowB && aData.w < -1.5) vL4.xy = (clip.xy / clip.w + vec2(projectionMatrix[2][0], projectionMatrix[2][1])) / vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
    // the third number is read by a light alone (cardGlow): the softness of its glow at rest
    #ifdef POINT_SPRITES
    float sideC = 2.0 * max(extC.x, extC.y);
    gl_PointSize = sideC;
    vCore = vec4(sideC, reachC, restSC, alpha);
    #else
    vec2 offC = position.xy * extC;
    vCore = vec4(offC, restSC, alpha);
    if (lineC > 0.5 && hlC > 1e-3) {
      // a trail keeps its own depth along its whole length, so a wall or a trunk hides the part of it that runs behind
      vec4 alongC = projectionMatrix * vec4(view.xy, view.z + dzC * clamp(dot(offC, alC) / (2.0 * hlC), -0.5, 0.5), 1.0);
      clip.z = alongC.z / alongC.w * clip.w;
    }
    clip.xy += offC * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * (clip.w / uPoint.y);
    #endif
    vec4 liftC = projectionMatrix * vec4(view.xy, view.z + min(1.2 * rC * zImg / (uPoint.y * mag), ${n(LENS_LOOK.liftMostMm)}) + (mistC > 0.5 ? mistPullC : pullC) + (glowB ? (aData.w < -1.5 ? ${n(STORM_BLOOM.lowLiftMm)} : (aData.w < 0.0 ? ${n(-STORM_BLOOM.poolBackMm)} : ${n(STORM_BLOOM.liftMm)})) : 0.0), 1.0);
    clip.z = liftC.z / liftC.w * clip.w;
  }
`

/** The outline of each card in its own two axes (x along, y across, both from -1 to 1): the distance to the edge, under 0 inside, and how it grows along each axis. */
export const CARD_FRAG_PARS = `${REST_LIGHT}
/** The down of the seeds' heads: every form at every lean, drawn once at start (down.ts). */
uniform sampler2D uDown;
uniform vec4 uPoint;
uniform float uWhole;
uniform float uStormLanding;
uniform mat4 projectionMatrix;
${CLOCK_HASH}/** One ring of a clock's hairs (looks.ts, CARD.clock): the three hairs about the pixel's own angle, each a line that fades toward its tip and ends in a tuft, or the mean of them all where they stand closer than a hair is wide. The share told of the ring's light stands as hairs that are told apart and the rest as the mean. */
float cardClockRing(float th, float r, float u, float R, float n, uint id, float turn, float v, float thin, float vT, float thinT, vec2 weight, vec2 span, float tip, float fall, float told) {
  float stepK = 6.2831853 / n;
  float i0 = floor(th / stepK + 0.5);
  float sum = 0.0;
  for (int j = -1; j <= 1; j++) {
    float i = i0 + float(j);
    vec3 h = cardHairHash(id + uint(mod(i, n) + 0.5));
    float len = mix(span.x, span.y, 1.0 - h.y * h.y);
    float bend = ${n(CARD.clock.bow)} * (fract(h.z * 13.0) * 2.0 - 1.0) + ${n(CARD.clock.swirl)} * sin(2.0 * i * stepK + turn);
    float d = sin(th - i * stepK - (h.x - 0.5) * ${n(CARD.clock.jitter)} * stepK - bend * u * u) * r;
    float end = (u - len) * R;
    sum += mix(weight.x, weight.y, h.z) * (thin * exp(-0.5 * d * d / v) * (1.0 - smoothstep(len - ${n(CARD.clock.tipFade)}, len, u)) * mix(1.0, fall, min(u / len, 1.0)) + tip * thinT * exp(-0.5 * (d * d + end * end) / vT));
  }
  float gap = stepK * r;
  float mean = min(${n(0.5 * Math.sqrt(2 * Math.PI))} * (weight.x + weight.y) * sqrt(v) / gap * thin, ${n(CARD.clock.most)}) * sqrt(1.0 - clamp((u - span.x) / (span.y - span.x), 0.0, 1.0)) * mix(1.0, fall, min(u, 1.0));
  return mix(mean, sum, told * smoothstep(${n(CARD.clock.merge[0])}, ${n(CARD.clock.merge[1])}, gap / sqrt(v)));
}
float cardPetalHalf(float u) {
  return 0.64 * sqrt(max(sin(3.14159265 * pow(abs(u), 0.8)), 0.0)) * mix(0.5, 1.0, smoothstep(0.0, 0.5, u));
}
float cardLeafHalf(float v, vec2 own) {
  float w = 0.56 * sin(3.14159265 * pow(abs(v), 0.7)) * (1.0 - 0.25 * v) * mix(0.8, 1.2, own.x);
  float lobes = mix(0.0, 0.42, smoothstep(0.45, 1.0, own.y));
  w *= 1.0 - lobes * (0.5 + 0.5 * cos(6.2831853 * 3.5 * v));
  return w * (1.0 - 0.1 * abs(fract(v * 9.0) * 2.0 - 1.0));
}
/** Which of the leaf outlines a leaf has: under 0.5 the long oval and the lobed oak (by the leaf's own number), over it the maple. */
float cardLeafForm(vec2 own) {
  return step(fract(own.x * 13.0 + own.y * 5.0), mix(${n(CARD.leafRestMaple)}, ${n(CARD.maple.share)}, vL2.w));
}
/** The maple: five pointed lobes about a middle a little ahead of the stem's end; the rim's radius at this place and the place's own radius. */
vec2 cardMaple(vec2 q) {
  vec2 c = q - vec2(${n(CARD.maple.mid)}, 0.0);
  float r = length(c) + 1e-4;
  float a = abs(dot(c, c) > 0.0 ? atan(c.y, c.x) : 0.0);
  float rim = ${n(CARD.maple.floor)};
  rim = max(rim, ${n(CARD.maple.long[0])} * pow(max(1.0 - a / ${n(CARD.maple.wide[0])}, 0.0), ${n(CARD.maple.point)}));
  rim = max(rim, ${n(CARD.maple.long[1])} * pow(max(1.0 - abs(a - ${n(CARD.maple.at[0])}) / ${n(CARD.maple.wide[1])}, 0.0), ${n(CARD.maple.point)}));
  rim = max(rim, ${n(CARD.maple.long[2])} * pow(max(1.0 - abs(a - ${n(CARD.maple.at[1])}) / ${n(CARD.maple.wide[2])}, 0.0), ${n(CARD.maple.point)}));
  rim *= 1.0 - ${n(CARD.maple.teeth)} * abs(sin(a * 10.0));
  return vec2(rim, r);
}
vec3 cardEdge(float shape, vec2 q, vec2 own) {
  float u = q.x * 0.5 + 0.5;
  float side = q.y < 0.0 ? -1.0 : 1.0;
  if (shape < ${n(SHAPE.petal + 0.5)}) {
    float uc = clamp(u, 0.0, 1.0);
    float w = cardPetalHalf(uc);
    float dw = (cardPetalHalf(min(uc + 0.02, 1.0)) - cardPetalHalf(max(uc - 0.02, 0.0))) * 12.5;
    vec3 e = vec3(abs(q.y) - w, -dw, side);
    float notch = (q.x - 0.72) * 0.5 - abs(q.y);
    if (notch > e.x) e = vec3(notch, 0.5, -side);
    float ends = abs(q.x) - 1.0;
    if (ends > e.x) e = vec3(ends, q.x < 0.0 ? -1.0 : 1.0, 0.0);
    return e;
  } else if (shape < ${n(SHAPE.fleck + 0.5)}) {
    float r = length(q) + 1e-4;
    float ang = dot(q, q) > 0.0 ? atan(q.y, q.x) : 0.0;
    float lobes = 2.0 + floor(fract(own.x * 7.0) * 4.0);
    float rim = (0.6 + 0.2 * mix(0.3, 1.0, own.y) * sin(lobes * ang + 6.2831853 * own.x) + 0.1 * sin((lobes + 3.0) * ang + 6.2831853 * own.y)) * mix(1.0, 0.45, fract(own.y * 13.0) * abs(sin(ang + 6.2831853 * own.x)));
    return vec3(r - rim, q.x / r, q.y / r);
  } else if (shape > ${n(SHAPE.bat - 0.5)}) {
    float tt = abs(q.y);
    q.x -= vL4.y * tt * tt;
    float lead = 0.1 + 0.24 * smoothstep(0.0, 0.4, tt) - 0.52 * pow(smoothstep(0.4, 1.0, tt), 1.4);
    float trail = -0.3 + 0.12 * tt + 0.17 * abs(sin(9.42478 * tt));
    float wq = (q.x - 0.1) * ${n(CARD.batSlim)} + 0.1;
    vec3 e = wq - lead > trail - wq ? vec3(wq - lead, 1.0, side * (0.05 + 0.9 * tt * tt)) : vec3(trail - wq, -1.0, side * 0.25);
    float tip = tt - 1.0;
    if (tip > e.x) e = vec3(tip, 0.0, side);
    vec2 bq = vec2(q.x / 0.36, q.y / 0.1);
    float body = (length(bq) - 1.0) * 0.1;
    if (body < e.x) e = vec3(body, 0.2 * bq.x, side);
    vec2 hq = vec2(q.x - 0.34, q.y);
    float head = length(hq) - 0.1;
    if (head < e.x) e = vec3(head, hq.x / max(length(hq), 1e-4), hq.y / max(length(hq), 1e-4));
    float ear = max(abs(tt - 0.065) * 2.2 + (q.x - 0.52), 0.4 - q.x);
    if (ear < e.x) e = vec3(ear, 1.0, 0.0);
    return e;
  } else if (cardLeafForm(own) > 0.5) {
    vec2 m = cardMaple(q);
    vec2 c = (q - vec2(${n(CARD.maple.mid)}, 0.0)) / m.y;
    vec3 e = vec3(m.y - m.x, c.x, c.y);
    float st = max(abs(q.y) - 0.035, max(q.x - ${n(CARD.maple.mid)}, -1.0 - q.x));
    if (st < e.x) e = vec3(st, 0.0, side);
    return e;
  } else {
  float stem = 0.16;
  float v = clamp((u - stem) / (1.0 - stem), 0.0, 1.0);
  float w = u < stem ? 0.035 : max(cardLeafHalf(v, own), 0.035 * (1.0 - smoothstep(0.0, 0.2, v)));
  float dw = u < stem ? 0.0 : (cardLeafHalf(min(v + 0.02, 1.0), own) - cardLeafHalf(max(v - 0.02, 0.0), own)) * 12.5 / (1.0 - stem);
  vec3 e = vec3(abs(q.y) - w, -dw, side);
  float ends = abs(q.x) - 1.0;
  if (ends > e.x) e = vec3(ends, q.x < 0.0 ? -1.0 : 1.0, 0.0);
  return e;
  }
}
/** A card far out of focus is its outline spread by the lens: a soft blob with the outline's own middle, length and width. x, y, z: the blob's form in the card's axes; w: how much of the blob is drawn (0 for a sharp card). */
vec4 cardBlob = vec4(0.0);
vec2 cardMid(float shape) {
  return shape < ${n(SHAPE.petal + 0.5)} ? vec2(0.08, 0.0) : (shape > ${n(SHAPE.leaf - 0.5)} && shape < ${n(SHAPE.leaf + 0.5)} ? vec2(0.12, 0.0) : vec2(0.0));
}
vec2 cardSpan(float shape) {
  if (shape < ${n(SHAPE.petal + 0.5)}) return vec2(0.44, 0.3);
  if (shape < ${n(SHAPE.fleck + 0.5)}) return vec2(0.32, 0.32);
  if (shape > ${n(SHAPE.bat - 0.5)}) return vec2(0.2, 0.46);
  return vec2(0.42, 0.24);
}
void cardBlobSet(float shape, vec2 a, vec2 b, float inv, float s2) {
  vec2 r1 = vec2(b.y, -b.x) * inv;
  vec2 r2 = vec2(-a.y, a.x) * inv;
  vec2 span = cardSpan(shape);
  float sxx = span.x * span.x + s2 * dot(r1, r1);
  float sxy = s2 * dot(r1, r2);
  float syy = span.y * span.y + s2 * dot(r2, r2);
  float d = max(sxx * syy - sxy * sxy, 1e-8);
  float thin = abs(1.0 / inv) / max(length(a), length(b)) * 2.0 * span.y;
  cardBlob = vec4(syy / d, -sxy / d, sxx / d, smoothstep(${n(CARD.blob[0])}, ${n(CARD.blob[1])}, sqrt(s2) / max(thin, 1e-3)));
}
/** The same blob for a card that moves through the shutter: each of the places it is drawn at along its path stands for a piece of the path of this length, so the blob is spread by that piece along the path and is that much fainter. The blob's light comes back. */
float cardBlobRun(float shape, vec2 a, vec2 b, float inv, float s2, vec2 along, float piece) {
  vec2 r1 = vec2(b.y, -b.x) * inv;
  vec2 r2 = vec2(-a.y, a.x) * inv;
  vec2 span = cardSpan(shape);
  float m2 = 0.25 * piece * piece;
  float m1 = dot(r1, along);
  float m3 = dot(r2, along);
  float sxx = span.x * span.x + s2 * dot(r1, r1);
  float sxy = s2 * dot(r1, r2);
  float syy = span.y * span.y + s2 * dot(r2, r2);
  float d0 = max(sxx * syy - sxy * sxy, 1e-8);
  sxx += m2 * m1 * m1;
  sxy += m2 * m1 * m3;
  syy += m2 * m3 * m3;
  float d = max(sxx * syy - sxy * sxy, 1e-8);
  float thin = abs(1.0 / inv) / max(length(a), length(b)) * 2.0 * span.y;
  cardBlob = vec4(syy / d, -sxy / d, sxx / d, max(smoothstep(${n(CARD.blob[0])}, ${n(CARD.blob[1])}, sqrt(s2) / max(thin, 1e-3)), smoothstep(${n(CARD.run.blob[0])}, ${n(CARD.run.blob[1])}, piece / max(thin, 1e-3))));
  return mix(1.0, sqrt(d0 / d), cardBlob.w);
}
vec2 cardSolve(vec2 p, vec2 a, vec2 b, float inv) {
  vec2 q = vec2(p.x * b.y - p.y * b.x, a.x * p.y - a.y * p.x) * inv;
  for (int i = 0; i < 3; i++) {
    vec2 qc = clamp(q, -1.2, 1.2);
    vec2 pp = p - vL1.xy * (vGrid.w * (vL4.x * qc.x * qc.x + vL4.y * qc.y * qc.y + vL4.z * qc.x * qc.y));
    q = vec2(pp.x * b.y - pp.y * b.x, a.x * pp.y - a.y * pp.x) * inv;
  }
  return q;
}
float cardTap(float shape, vec2 p, vec2 a, vec2 b, float inv, float wide, inout vec2 qSum) {
  vec2 q = cardSolve(p, a, b, inv);
  vec3 e = cardEdge(shape, q, vL3.xy);
  vec2 grow = (e.y * vec2(b.y, -b.x) + e.z * vec2(-a.y, a.x)) * inv;
  float c = clamp(0.5 - 0.5 * e.x / (max(length(grow), 1e-4) * wide), 0.0, 1.0);
  c = c * c * (3.0 - 2.0 * c);
  if (cardBlob.w > 0.0) {
    vec2 q0 = vec2(p.x * b.y - p.y * b.x, a.x * p.y - a.y * p.x) * inv - cardMid(shape);
    c = mix(c, exp(-0.5 * (cardBlob.x * q0.x * q0.x + 2.0 * cardBlob.y * q0.x * q0.y + cardBlob.z * q0.y * q0.y)), cardBlob.w);
  }
  qSum += q * c;
  return c;
}
/** How much of the pixel the card covers, with the lens blur as a soft edge and the shutter as a mean along the card's path; the mean place on the card comes back in q. */
float cardCover(float shape, vec2 p, out vec2 q) {
  vec2 a = vL0.xy;
  vec2 b = vL0.zw;
  float det = a.x * b.y - a.y * b.x;
  det = abs(det) < 1e-5 ? 1e-5 : det;
  float inv = 1.0 / det;
  float wide = 1.5 * sqrt(vStreak.w);
  float area = ${n(CARD.area)} * abs(det);
  float amp = pow(abs(min(1.0, 2.0 * area / (area + 6.2831853 * vStreak.w))), ${n(CARD.hold)});
  cardBlobSet(shape, a, b, inv, vStreak.w);
  vec2 qSum = vec2(0.0);
  float cov = 0.0;
  if (vStreak.z > 0.25) {
    vec2 q0 = vec2(p.x * b.y - p.y * b.x, a.x * p.y - a.y * p.x) * inv;
    vec2 dq = vec2(vStreak.x * b.y - vStreak.y * b.x, a.x * vStreak.y - a.y * vStreak.x) * inv;
    float bound = ${n(CARD.bound)} + abs(vL4.x) + abs(vL4.y) + (wide + (uStorm.x > 0.0 && shape > ${n(STORM_OWN_PATH_FROM)} ? 0.67 * abs(pointBend) * vStreak.z : 0.0)) * abs(inv) * max(length(a), length(b));
    float qa = dot(dq, dq);
    float qb = dot(q0, dq);
    float disc = qb * qb - qa * (dot(q0, q0) - bound * bound);
    if (disc > 0.0) {
      float root = sqrt(disc);
      float t0 = max((qb - root) / qa, -vStreak.z);
      float t1 = min((qb + root) / qa, vStreak.z);
      if (t1 > t0 && uStorm.x > 0.0 && shape > ${n(STORM_OWN_PATH_FROM)} && shape < ${n(SHAPE.bat - 0.5)}) {
        // the storm: the card is seen for the whole shutter along its bent path, alike from end to end, with no sharp place
        float light = cardBlobRun(shape, a, b, inv, vStreak.w, vStreak.xy, (t1 - t0) / ${n(CARD.run.taps)});
        vec2 across = vec2(-vStreak.y, vStreak.x);
        for (int i = 0; i < ${CARD.run.taps}; i++) {
          float tt = mix(t0, t1, (float(i) + 0.5) / ${n(CARD.run.taps)});
          cov += cardTap(shape, p - vStreak.xy * tt - across * (pointBend * (tt * tt / vStreak.z - 0.333 * vStreak.z)), a, b, inv, wide, qSum);
        }
        q = qSum / max(cov, 1e-4);
        return amp * light * cov * (t1 - t0) / (${n(2 * CARD.run.taps)} * vStreak.z);
      }
      if (t1 > t0) {
        for (int i = 0; i < 4; i++) cov += cardTap(shape, p - vStreak.xy * mix(t0, t1, (float(i) + 0.5) * 0.25), a, b, inv, wide, qSum);
        float trail = cov * (t1 - t0) / (8.0 * vStreak.z);
        vec2 qHead = vec2(0.0);
        float head = ${n(CARD.head)} * cardTap(shape, p - vStreak.xy * vStreak.z, a, b, inv, wide, qHead);
        q = head > trail ? qHead / max(head, 1e-4) * ${n(CARD.head)} : qSum / max(cov, 1e-4);
        return amp * max(head, trail);
      }
    }
    q = vec2(0.0);
    return 0.0;
  }
  cov = cardTap(shape, p, a, b, inv, wide, qSum);
  q = qSum / max(cov, 1e-4);
  return amp * cov;
}
/** The card's own colouring over the kind's colour, and in w how much of the light from behind comes through there. */
vec4 cardTint(float shape, vec2 q, vec2 own) {
  float u = clamp(q.x * 0.5 + 0.5, 0.0, 1.0);
  if (shape < ${n(SHAPE.petal + 0.5)}) {
    vec3 t = mix(vec3(${CARD.petalFoot.map(n).join(', ')}), vec3(1.0), smoothstep(0.0, ${n(CARD.petalFootTo)}, u)) * mix(vec3(1.0, 0.82, 0.89), vec3(1.0, 1.24, 1.16), own.y);
    t *= 1.0 - 0.12 * exp(-q.y * q.y * 70.0) * (1.0 - u);
    return vec4(t, 1.0);
  }
  if (shape < ${n(SHAPE.fleck + 0.5)}) return vec4(vec3(mix(0.7, 1.15, own.y)), 0.4);
  if (shape > ${n(SHAPE.bat - 0.5)}) return vec4(vec3(1.0 + ${n(CARD.batRim)} * smoothstep(-0.14, 0.0, cardEdge(shape, q, own).x)), 0.15 * smoothstep(0.12, 0.5, abs(q.y)));
  float stem = 0.16;
  float v = clamp((u - stem) / (1.0 - stem), 0.0, 1.0);
  // at rest the large lobed leaves are the orange and red ones and the small ovals the gold; the storm keeps the hues it had
  float hueL = mix(own.y, mix(${n(CARD.leafMapleHue[0])}, ${n(CARD.leafMapleHue[1])}, own.y), cardLeafForm(own));
  vec3 t = mix(vec3(${CARD.leafGold.map(n).join(', ')}), vec3(${CARD.leafOrange.map(n).join(', ')}), smoothstep(${n(CARD.leafGoldFrom[0])}, ${n(CARD.leafGoldFrom[1])}, hueL));
  t = mix(t, vec3(${CARD.leafRed.map(n).join(', ')}), smoothstep(${n(CARD.leafRedFrom[0])}, ${n(CARD.leafRedFrom[1])}, hueL));
  vec3 tGust = mix(vec3(${CARD.leafStormGold.map(n).join(', ')}), vec3(1.0, 1.0, 1.0), smoothstep(0.0, ${n(CARD.leafStormGoldShare)}, own.y));
  tGust = mix(tGust, vec3(${CARD.leafStormRed.map(n).join(', ')}), smoothstep(${n(CARD.leafStormRedFrom[0])}, ${n(CARD.leafStormRedFrom[1])}, own.y + 0.25 * (own.x - 0.5)));
  t = mix(t, tGust, vL2.w);
  float restAirL = (1.0 - vL2.w) * (1.0 - step(1.5, vKind.y));
  t *= mix(vec3(1.0), vec3(${CARD.leafDark.map(n).join(', ')}), smoothstep(mix(${n(CARD.leafDarkFrom[0])}, ${n(CARD.leafRestDarkFrom[0])}, restAirL), mix(${n(CARD.leafDarkFrom[1])}, ${n(CARD.leafRestDarkFrom[1])}, restAirL), fract(own.x * 5.0 + own.y * 3.0)));
  float out1;
  float rib;
  float fine;
  if (cardLeafForm(own) > 0.5) {
    vec2 m = cardMaple(q);
    vec2 c = q - vec2(${n(CARD.maple.mid)}, 0.0);
    float a = abs(dot(c, c) > 0.0 ? atan(c.y, c.x) : 0.0);
    out1 = m.y / max(m.x, 1e-3);
    float da = min(a, min(abs(a - ${n(CARD.maple.at[0])}), abs(a - ${n(CARD.maple.at[1])})));
    rib = exp(-da * da * m.y * m.y * 900.0);
    fine = 0.0;
    if (q.x < ${n(CARD.maple.mid)} && abs(q.y) < 0.05 && out1 > 1.0) return vec4(vec3(0.5, 0.36, 0.26), 0.0);
  } else {
    float w = max(cardLeafHalf(v, own), 1e-3);
    out1 = abs(q.y) / w;
    rib = exp(-q.y * q.y * 900.0);
    float ribs = fract(v * 6.5 - abs(q.y) * 2.4);
    fine = smoothstep(0.1, 0.0, abs(ribs - 0.5)) * (1.0 - smoothstep(0.75, 1.0, out1));
    if (u < stem) return vec4(vec3(0.5, 0.36, 0.26), 0.0);
  }
  t *= mix(${n(CARD.leafEdge[0])}, ${n(CARD.leafEdge[1])}, smoothstep(0.35, 1.0, out1) * mix(0.4, 1.0, own.x));
  float veins = max(rib, 0.6 * fine);
  return vec4(t * (1.0 - 0.38 * veins), 1.0 - 0.6 * veins);
}
float cardLine(vec2 p, vec2 a, vec2 b, float wide, float s2, out float along) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  along = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  vec2 d = pa - ba * along;
  float v = s2 + wide * wide;
  return min(1.0, ${n(CARD.hair.seedSeen)} * wide / sqrt(v)) * exp(-0.5 * dot(d, d) / v);
}
/** A seed: a slender stem with its grain at the foot and a tuft of fine hairs opening from its head, each hair a line in the particle's own three axes with its own length and droop; the hairs too fine to be told apart are the soft ball of the tuft. */
void cardSeed(vec2 p, int kind, vec4 k, vec4 look) {
  vec2 a = vL0.xy;
  vec2 b = vL0.zw;
  vec2 c = vL1.xy;
  float rC = max(vL4.w, 1e-3);
  float s2 = vStreak.w;
  // the card says how near and lit the head is, and one more for a head that lies
  float laidS = step(1.5, vL3.z);
  float nearS = clamp(vL3.z, 0.0, 1.0);
  // a clock far behind the miniature says so under 0: it is a small puff in the shade
  float farS = clamp(-vL3.z, 0.0, 1.0);
  // most heads are drawn nearer to face on than they stand, a round wheel of down, and a few from the side, a fan; the stalk is drawn at that same lean, so a wheel carries no long stick
  // at rest one head in five is an open star, a few stout hairs of unequal length on a long stalk, seen at the lean it has; every other is a fine round puff of down, turned nearly face on
  float starK = step(fract(vL3.x * 47.0), ${n(CARD.down.star.share)});
  float leanU = pow(abs(asin(min(length(a) / rC, 1.0)) * ${n(2 / Math.PI)}), mix(mix(${n(CARD.down.leanSkew)}, ${n(CARD.down.star.leanSkew)}, starK), mix(${n(CARD.down.stormLeanSkew)}, ${n(CARD.hair.stormFace)}, step(fract(vL3.w * 31.0), ${n(CARD.hair.stormFaceSkew)})), vL2.w)) * mix(mix(${n(CARD.down.restLean)}, ${n(CARD.down.star.lean)}, starK), 1.0, vL2.w);
  // a head afloat in the calm is a clock (looks.ts, CARD.clock): clockS is how much of one this head is and floatS how much of the calm's stalk a whole head afloat has. Both are none at the storm's full level, where a head is drawn as it was
  float clockS = 0.0;
  float floatS = 0.0;
  if (uStorm.x < 0.99) {
    clockS = vL4.y;
    floatS = vL4.z * (1.0 - smoothstep(${n(CARD.clock.stormOff[0])}, ${n(CARD.clock.stormOff[1])}, uStorm.x));
  }
  // a clock is drawn at the lean it has: its stalk is as long on the picture as it hangs
  if (clockS > 0.0) leanU = mix(leanU, asin(min(length(a) / rC, 1.0)) * ${n(2 / Math.PI)}, clockS);
  // a clock's own three numbers, by the particle's whole number: how many hairs it has, whether it is one of the stout ones, and the way its hairs are swept
  vec3 ownK = vec3(0.0);
  if (clockS > 0.0) ownK = cardHairHash(uint(floor(vKind.z)) * 64u + 63u);
  // the near clocks are the stout ones, of stouter hairs with faint ones between (CARD.clock.stoutShare of them, by the head's own number); the first of them by that same number stand in the low sun and are warm (warmShare), the others keep the down's own white. A camera that stands nearer than the hero has a near head far out of focus, and a stout hair so soft is a grey bar: there the stout ones are the warm ones alone, going over between the two of stoutClose, as the vertex has their size (this pixel's own depth says how near the camera stands)
  float stoutS = step(ownK.y, ${n(CARD.clock.stoutShare)});
  if (clockS > 0.0) stoutS = mix(stoutS, step(ownK.y, ${n(CARD.clock.warmShare)}), smoothstep(${n(CARD.clock.stoutClose[0])}, ${n(CARD.clock.stoutClose[1])}, uPoint.y * gl_FragCoord.w / (uPoint.w * ${n(CARD.hair.puffMmPx)})));
  float warmK = nearS * stoutS;
  float tintK = nearS * step(ownK.y, ${n(CARD.clock.warmShare)});
  vec2 st = a * (sin(leanU * ${n(Math.PI / 2)}) * rC / max(length(a), 1e-3));
  vec2 hub = ${n(CARD.hair.hub)} * st;
  float hairs = 0.0;
  float stems = 0.0;
  float along;
  float run = smoothstep(0.5, 3.0, vStreak.z / rC);
  bool storm = uStorm.x > 0.0;
  // the storm goes out by degrees (looks.ts, CARD.hair.stormEase): where a head is drawn on its path, its smear, its brush and its trail go over between the storm's way and the calm's by this, and are the storm's whole from stormEase on
  float easeS = smoothstep(0.0, ${n(CARD.hair.stormEase)}, uStorm.x);
  // in the storm a head is seen for the whole shutter: its hairs are drawn at the middle of its path and fade as the path grows past the head's own size
  vec2 pp = p - vStreak.xy * (vStreak.z > 0.5 ? vStreak.z * (1.0 - easeS) : 0.0);
  float smear = storm ? easeS * smoothstep(${n(CARD.run.seedFrom[0])}, ${n(CARD.run.seedFrom[1])}, vStreak.z / rC) : 0.0;
  vec2 lean = ${n(CARD.hair.lean)} * ((vL3.y - 0.5) * b + (vL3.w - 0.5) * c);
  vec2 mid = hub + ${n(CARD.hair.ballAt)} * st + 0.5 * lean;
  // a head that moves through the shutter is drawn out along its path, hair by hair, and stays a head
  if (storm) pp -= vStreak.xy * (dot(pp - mid, vStreak.xy) * (1.0 - 1.0 / (1.0 + ${n(CARD.run.seedDrawn)} * smear)));
  // a head is a small ball of down: some hundred fine hairs of nearly one length over a cap of a sphere, drawn once at start into the sheet uDown (down.ts). The card reads the form its particle was given, at the lean its stalk has to the eye, turned to its stalk on the picture: along the stalk a round disc that is brightest at its heart, from the side a cup. A small head or one out of focus reads a smaller copy, which is the soft ball the fine hairs are then
  float gauze = 0.0;
  vec2 axis = a + ${n(CARD.down.faceOn)} * b;
  vec2 ya = axis / max(length(axis), 1e-4);
  // in the storm the down of a head trails behind its seed: the brush lies back along the head's own path, as every stroke of the storm lies along the whirl
  if (uStorm.x > 0.0 && vL2.w > 0.0 && vStreak.z > 0.5) {
    vec2 yb = ya - ${n(CARD.hair.stormTrail)} * vL2.w * easeS * smoothstep(${n(CARD.hair.stormTrailFrom[0])}, ${n(CARD.hair.stormTrailFrom[1])}, fract(vL3.y * 17.0)) * vStreak.xy;
    ya = yb / max(length(yb), 1e-4);
  }
  vec2 xa = vec2(ya.y, -ya.x) * (fract(vL3.x * 37.0) < 0.5 ? -1.0 : 1.0);
  float span = ${n(CARD.down.half * CARD.down.size)} * rC;
  vec2 q = vec2(dot(pp - hub, xa), dot(pp - hub, ya)) / span;
  // in the storm a head flies with its down drawn together about its stalk: a brush of hairs, and no wheel. Each hair is read at its own angle from the stalk, the angles drawn together by stormFan
  float fanS = 1.0;
  if (storm && vL2.w > 0.0) {
    // no two heads fly alike: about half keep the whole wheel of their down, the others are drawn together by their own share
    float fanK = smoothstep(${n(CARD.hair.stormFanFrom[0])}, ${n(CARD.hair.stormFanFrom[1])}, fract(vL3.x * 61.0));
    float fa = (dot(q, q) > 0.0 ? atan(q.x, q.y) : 0.0) * mix(1.0, ${n(CARD.hair.stormFan)}, vL2.w * easeS * fanK);
    fanS = 1.0 - vL2.w * easeS * smoothstep(0.0, 0.25, fanK) * smoothstep(${n(0.8 * Math.PI)}, ${n(Math.PI)}, abs(fa));
    q = length(q) * vec2(sin(fa), cos(fa));
  }
  if (abs(q.x) < 1.0 && abs(q.y) < 1.0) {
    if (clockS < 1.0) {
      // the copy whose one pixel is as wide as what this pixel sees: a sharp head reads finer than the screen by lodPx, so a hair stays a hair; a soft one reads as wide as its blur
      float lod = clamp(log2(max(${n(CARD.down.tile / 2)} / span * sqrt(max(${n(CARD.down.lodBlur)} * (s2 - ${n(PIXEL_SIGMA2)} * uPoint.w * uPoint.w), 0.0) + ${n(CARD.down.lodPx * CARD.down.lodPx)} * uPoint.w * uPoint.w), 1.0)), 0.0, ${n(CARD.down.lodMost)});
      float edge = 0.5 * exp2(lod) / ${n(CARD.down.tile)};
      vec2 uvT = clamp(0.5 + 0.5 * q, vec2(edge), vec2(1.0 - edge));
      float form = floor(fract(vL3.y * 29.0) * ${n(CARD.down.forms.length)});
      float tiltAt = leanU * ${n(CARD.down.tilts - 1)};
      float k0 = min(floor(tiltAt), ${n(CARD.down.tilts - 2)});
      vec2 cell = vec2(${n(1 / CARD.down.tilts)}, ${n(1 / (CARD.down.forms.length + CARD.down.stars.length + CARD.down.puffs.length + CARD.down.drifts.length))});
      // a head that is small on the picture is a star: some sixty fine hairs of unequal length, each told apart, a whole fine line each and never a row of dots. A head that is large is the dense ball of down. Between the two sizes both are read
      float starS = 1.0 - smoothstep(${n(CARD.down.star.px[0])}, ${n(CARD.down.star.px[1])}, ${n(2 * CARD.down.size)} * rC / uPoint.w);
      float dense = 0.0;
      if (starS < 1.0) dense = mix(textureLod(uDown, (vec2(k0, form) + uvT) * cell, lod).r, textureLod(uDown, (vec2(k0 + 1.0, form) + uvT) * cell, lod).r, tiltAt - k0);
      float star = 0.0;
      if (starS > 0.0) {
        // a star's hair is as wide as a pixel where it is read, so a hair is a line at any place between the pixels
        float lodS = clamp(log2(max(${n(CARD.down.tile / 2)} / span * sqrt(max(${n(CARD.down.lodBlur)} * (s2 - ${n(PIXEL_SIGMA2)} * uPoint.w * uPoint.w), 0.0) + ${n(CARD.down.star.lodPx * CARD.down.star.lodPx)} * uPoint.w * uPoint.w), 1.0)), 0.0, ${n(CARD.down.lodMost)});
        float edgeS = 0.5 * exp2(lodS) / ${n(CARD.down.tile)};
        vec2 uvS = clamp(0.5 + 0.5 * q, vec2(edgeS), vec2(1.0 - edgeS));
        // in the storm every head is the star: its few stout hairs are each read through the shutter
        float kindS = max(starK, vL2.w);
        float open = 0.0;
        float puff = 0.0;
        if (kindS > 0.0) {
          float rowS = ${n(CARD.down.forms.length)} + floor(fract(vL3.y * 29.0) * ${n(CARD.down.stars.length)});
          open = ${n(CARD.down.star.seen)} * mix(textureLod(uDown, (vec2(k0, rowS) + uvS) * cell, lodS).r, textureLod(uDown, (vec2(k0 + 1.0, rowS) + uvS) * cell, lodS).r, tiltAt - k0);
          // in the storm most heads are of the storm's own forms (CARD.down.drifts): few hairs or many, long or short, a whole wheel or a part of one
          float driftAt = fract(vL3.y * 131.0) * ${n(CARD.down.stars.length + CARD.down.drifts.length)} - ${n(CARD.down.stars.length)};
          if (vL2.w > 0.0 && driftAt >= 0.0) {
            float rowD = ${n(CARD.down.forms.length + CARD.down.stars.length + CARD.down.puffs.length)} + floor(driftAt);
            open = mix(open, ${n(CARD.down.star.seen)} * mix(textureLod(uDown, (vec2(k0, rowD) + uvS) * cell, lodS).r, textureLod(uDown, (vec2(k0 + 1.0, rowD) + uvS) * cell, lodS).r, tiltAt - k0), smoothstep(0.0, ${n(CARD.down.driftFrom)}, vL2.w));
          }
        }
        if (kindS < 1.0) {
          float rowP = ${n(CARD.down.forms.length + CARD.down.stars.length)} + floor(fract(vL3.y * 29.0) * ${n(CARD.down.puffs.length)});
          puff = ${n(CARD.down.puff.seen)} * mix(textureLod(uDown, (vec2(k0, rowP) + uvS) * cell, lodS).r, textureLod(uDown, (vec2(k0 + 1.0, rowP) + uvS) * cell, lodS).r, tiltAt - k0);
        }
        star = mix(puff, open, kindS);
      }
      gauze = ${n(CARD.down.most * CARD.hair.hairSeen)} * mix(dense, star, starS) * mix(${n(CARD.hair.faint)}, 1.0, fract(vL3.y * 53.0)) * fanS;
    }
  }
  // a clock's hairs are drawn by the card itself, hair by hair (looks.ts, CARD.clock): two rings of lines from the hub, a ring of strong hairs and a ring of fine ones that stand between them, thirty to forty in all, each with its own length, weight and bend and a tuft at its end. A hair is never finer than about a pixel, so it is a whole line at any place between the pixels and at any turn of the head; a pixel looks at the three hairs about its own angle in each ring, and where the hairs stand closer than a hair is wide, toward the hub and in a small or soft head, it takes the mean of all of them, which is the soft ball they are there. A share of each ring's light stands as that mean everywhere: the haze of a ball of down under its hairs
  float gauzeK = 0.0;
  float hotK = 0.0;
  if (clockS > 0.0) {
    vec2 dK = pp - hub;
    float RK = ${n(CARD.clock.reach)} * rC;
    float rK = max(length(dK), 1e-3);
    float uK = rK / RK;
    if (uK < ${n(Math.max(CARD.clock.long[1], CARD.clock.downLong[1]) + 0.35)}) {
      float stoutK = step(ownK.y, ${n(CARD.clock.warmShare)});
      float nK = min(floor(mix(mix(${n(CARD.clock.hairs[0])}, ${n(CARD.clock.hairs[1] + 1)}, ownK.x), mix(${n(CARD.clock.stoutHairs[0])}, ${n(CARD.clock.stoutHairs[1] + 1)}, ownK.x), stoutK)), mix(${n(CARD.clock.hairs[1])}, ${n(CARD.clock.stoutHairs[1])}, stoutK));
      // the angle round the hub, which has none at the hub itself: there it is asked of nothing and stands at 0
      vec2 aroundK = vec2(dot(dK, xa), dot(dK, ya));
      float thK = dot(aroundK, aroundK) > 0.0 ? atan(aroundK.x, aroundK.y) : 0.0;
      float pxK = ${n(PIXEL_SIGMA2)} * uPoint.w * uPoint.w;
      float wideK = max(${n(CARD.clock.wide)} * uPoint.w, ${n(CARD.clock.wideOf)} * RK) * mix(1.0, ${n(CARD.clock.stoutWide)}, warmK);
      float vK = s2 + wideK * wideK;
      // a hair out of focus is as much fainter as it is wider
      float thinK = sqrt((pxK + wideK * wideK) / vK);
      float wideD = ${n(CARD.clock.downWide)} * uPoint.w;
      float vD = vK + wideD * wideD;
      float thinD = sqrt((pxK + wideK * wideK + wideD * wideD) / vD);
      float tipK = max(${n(CARD.clock.tipWide)} * uPoint.w, ${n(CARD.clock.tipOf)} * RK);
      float vT = s2 + tipK * tipK;
      float thinT = (pxK + tipK * tipK) / vT;
      uint headK = uint(floor(vKind.z)) * 64u;
      float turnK = 6.2831853 * ownK.z;
      float strongK = cardClockRing(thK, rK, uK, RK, nK, headK, turnK, vK, thinK, vT, thinT, vec2(${n(CARD.clock.weight[0])}, ${n(CARD.clock.weight[1])}), vec2(${n(CARD.clock.long[0])}, ${n(CARD.clock.long[1])}), mix(${n(CARD.clock.tip)}, ${n(CARD.clock.stoutTip)}, warmK), mix(${n(CARD.clock.fall)}, ${n(CARD.clock.stoutFall)}, warmK), mix(${n(CARD.clock.told[0])}, ${n(CARD.clock.told[1])}, warmK));
      float downK = 0.0;
      float inK = smoothstep(${n(CARD.clock.downFrom[0])}, ${n(CARD.clock.downFrom[1])}, uK);
      if (inK > 0.0) downK = inK * cardClockRing(thK + 3.14159265 / nK, rK, uK, RK, nK, headK + ${CARD.clock.hairsMost}u, turnK + 2.0, vD, thinD, vT, thinT, vec2(${n(CARD.clock.downWeight[0])}, ${n(CARD.clock.downWeight[1])}), vec2(${n(CARD.clock.downLong[0])}, ${n(CARD.clock.downLong[1])}), ${n(CARD.clock.downTip)}, ${n(CARD.clock.downFall)}, mix(${n(CARD.clock.downTold[0])}, ${n(CARD.clock.downTold[1])}, warmK));
      // the hub is a small bright heart, where every hair begins
      float heartW = ${n(CARD.clock.heartWide)} * RK * mix(1.0, ${n(CARD.clock.stoutHeartWide)}, warmK);
      hotK = heartW * heartW / (heartW * heartW + s2) * exp(-0.5 * rK * rK / (s2 + heartW * heartW));
      float heartK = mix(mix(${n(CARD.clock.heart)}, ${n(CARD.clock.heart * CARD.clock.farHeart)}, farS), ${n(CARD.clock.stoutHeart)}, warmK) * hotK;
      gauzeK = (mix(${n(CARD.clock.seen)}, ${n(CARD.clock.stoutSeen)}, warmK) * (strongK + mix(1.0, ${n(CARD.clock.stoutDown)}, warmK) * downK) + heartK) * mix(${n(CARD.hair.faint)}, 1.0, fract(vL3.y * 53.0));
    }
  }
  float ballV = s2 + ${n(CARD.hair.ballWide * CARD.hair.ballWide)} * rC * rC;
  float ball = mix(${n(CARD.hair.ball[0])}, ${n(CARD.hair.ball[1])}, smoothstep(${n(CARD.hair.ballFrom[0])}, ${n(CARD.hair.ballFrom[1])}, sqrt(s2) / rC)) * rC * rC / ballV * ${n(CARD.hair.ballWide * CARD.hair.ballWide)} * exp(-0.5 * dot(pp - mid, pp - mid) / ballV);
  // many hairs, each too faint to stand alone: where they cross they add, so the tuft is a gauze that is densest at its heart
  hairs = 1.0 - exp(-gauze * mix(1.0, ${n(CARD.hair.stormSeen)}, vL2.w) * (1.0 + ${n(CARD.hair.nearSeen - 1)} * nearS) - ball * mix(mix(${n(CARD.hair.restBall)}, ${n(CARD.hair.puffBall)}, smoothstep(${n(CARD.hair.ballFrom[0])}, ${n(CARD.hair.ballFrom[1])}, sqrt(s2) / rC)), ${n(CARD.hair.stormBall)}, vL2.w));
  if (clockS > 0.0) hairs = mix(hairs, 1.0 - exp(-gauzeK), clockS);
  if (storm) {
    float ts = clamp(dot(p - mid, vStreak.xy), -vStreak.z, vStreak.z);
    vec2 ds = p - mid - vStreak.xy * ts - vec2(-vStreak.y, vStreak.x) * (pointBend * (ts * ts / max(vStreak.z, 1e-3) - 0.333 * vStreak.z));
    float tuft = ${n(CARD.run.seedTuft)} * rC * rC / ballV * ${n(CARD.hair.ballWide * CARD.hair.ballWide)} * exp(-0.5 * dot(ds, ds) / ballV) / (1.0 + ${n(CARD.run.seedThin)} * vStreak.z / sqrt(ballV));
    // a head in the storm keeps its shape: it is smeared by no more than about its own width, a tuft with a short tail
    float tailLong = min(vStreak.z, ${n(CARD.run.seedTailMost)} * rC);
    float tail = cardLine(p - mid, -vStreak.xy * tailLong, vStreak.xy * tailLong, ${n(CARD.hair.runWide)} * rC, s2, along);
    hairs = max(hairs * (1.0 - ${n(1 - CARD.run.seedHairs)} * smear), smear * max(tuft, ${n(CARD.run.seedTrail)} * tail * along * (1.0 - along) * 4.0));
  }
  hairs = max(hairs, ${n(CARD.hair.hubSeen)} * cardLine(pp, hub, hub, 0.07 * rC, s2, along)) * mix(1.0, ${n(CARD.hair.runHead)}, run);
  vec2 foot = mix(-${n(CARD.hair.foot)} * mix(${n(CARD.hair.footSpan[0])}, ${n(CARD.hair.footSpan[1])}, vL3.w) * st - 0.25 * lean, hub - ${n(CARD.hair.stormFoot)} * rC * ya, storm ? vL2.w * easeS : 0.0);
  // a clock hangs its seed on a stalk of its own length, most of them short
  if (clockS > 0.0) foot = mix(foot, -mix(mix(${n(CARD.clock.foot[0])}, ${n(CARD.clock.foot[1])}, pow(max(vL3.w, 0.0), ${n(CARD.clock.footSkew)})), mix(${n(CARD.clock.footNear[0])}, ${n(CARD.clock.footNear[1])}, vL3.w), nearS) * st - 0.25 * lean, clockS);
  // the stalk is a pale hair; the grain at its foot is the one dark thing of the seed
  float grain = cardLine(pp, foot, foot + ${n(CARD.hair.grain)} * st, ${n(CARD.hair.body)} * rC, s2, along);
  // about one head in three hangs its stalk with the seed at its end
  float stemW = mix(${n(CARD.hair.stem)}, ${n(CARD.hair.stormStem)}, vL2.w) * rC;
  float stalkK = step(fract(vL3.x * 47.0), mix(${n(CARD.hair.stalks)}, ${n(CARD.hair.stormStalks)}, vL2.w)) * mix(${n(CARD.hair.stemSeen)}, ${n(CARD.hair.stormStemSeen)}, vL2.w);
  // in the calm more of the heads show their stalk, a golden hair a little stouter than the storm's, and none before the cottage or the crown: the calm's stalks come in with the calm by degrees, so none is there in one frame
  if (floatS > 0.0) {
    stemW = mix(stemW, mix(mix(${n(CARD.clock.stem[0])}, ${n(CARD.clock.stem[1])}, nearS), ${n(CARD.hair.stormStem)}, vL2.w) * rC, floatS);
    // which heads show a stalk is each head's own for good, by its own number: the middle ones' few show theirs at every depth, and the others that show one near the eye let it come with the near class itself, so a stalk grows as its head does and none is there in one frame
    float ownStalkK = fract(vL3.x * 47.0);
    stalkK = mix(stalkK, mix(mix(step(ownStalkK, ${n(CARD.clock.stalks[0])}), step(ownStalkK, ${n(CARD.clock.stalks[1])}), nearS), step(ownStalkK, ${n(CARD.hair.stormStalks)}), vL2.w) * mix(mix(${n(CARD.clock.stemSeen[0])}, ${n(CARD.clock.stemSeen[1])}, nearS) * (1.0 - vL4.x), ${n(CARD.hair.stormStemSeen)}, vL2.w), floatS);
  }
  // no stalk is a ruled line: each is bent a little at a knee, to its own side
  vec2 knee = 0.5 * (foot + hub) + ${n(2 * CARD.hair.stalkBend)} * (fract(vL3.w * 13.0) - 0.5) * vec2(-st.y, st.x);
  stems = stalkK * max(max(cardLine(pp, foot, knee, stemW, s2, along), cardLine(pp, knee, hub, stemW, s2, along)), grain) * mix(1.0, ${n(CARD.hair.runHead)}, run) * (1.0 - smear);
  float trail = cardLine(p, -vStreak.xy * vStreak.z, vStreak.xy * vStreak.z, ${n(CARD.hair.runWide)} * rC, s2, along);
  if (easeS < 1.0) hairs = max(hairs, (1.0 - easeS) * run * ${n(CARD.hair.runTrail)} * trail * (0.25 + 0.75 * along));
  float cover = min(max(hairs, stems) * vCore.w * look.z, 1.0);
  // a head that lies has its soft shade on what it lies on: a low dark oval just under the down, drawn with the head
  vec2 shS = (p - vec2(0.0, ${n(-CARD.hair.shadeAt)} * rC)) / (vec2(${n(CARD.hair.shadeWide[0])}, ${n(CARD.hair.shadeWide[1])}) * rC);
  float shade = laidS * ${n(CARD.hair.shadeSeen)} * exp(-0.5 * dot(shS, shS)) * vCore.w * look.z;
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  if (cover < 0.003 && shade < 0.003) discard;
  if (uDiag != 0) {
    if (cover < 0.5) discard;
    vec4 part = uKindPart[kind];
    if (uDiag == ${viewCode('ids')}) gl_FragColor = vec4(part.rgb, 1.0);
    else if (uDiag == ${viewCode('standins')}) gl_FragColor = vec4(part.rgb * part.a, 1.0);
    else gl_FragColor = stageDiag(k.rgb, inverseTransformDirection(vec3(0.0, 0.0, 1.0), viewMatrix), vFog.a, uPointChange, 0.0);
    return;
  }
  vec3 light = vGrid.rgb + vDom.rgb * (${n(LIGHT_LOOK.keyFloor)} + ${n(LIGHT_LOOK.keySide * 0.45)});
  // a hair is fine: in the low sun it is lit and white, never burnt to a solid stroke
  light *= min(1.0, ${n(CARD.hair.litMost)} * uLightBurn / max(max(light.r, max(light.g, light.b)), 1e-3));
  // down is warm in any light: in the cool light near the glass it keeps the cream of the low sun, as bright as the light there is
  light = mix(light, dot(light, vec3(0.2126, 0.7152, 0.0722)) * vec3(${CARD.hair.cream.map(n).join(', ')}), ${n(CARD.hair.warm)});
  // the low sun comes through the down from behind: a hair is brightest where it leaves the heart and falls off to its tip
  float rays = mix(1.0, mix(${n(CARD.hair.rayHeart)}, ${n(CARD.hair.rayTip)}, smoothstep(0.0, 1.0, length(q) * ${n(CARD.down.half)})), max(starK, vL2.w));
  vec3 col = k.rgb * mix(vec3(rays), mix(vec3(${CARD.hair.stemTint.map(n).join(', ')}), vec3(${CARD.hair.grainTint.map(n).join(', ')}), grain), stems / max(hairs + stems, 1e-4)) * light * mix(mix(${n(CARD.down.puff.gain)}, ${n(CARD.hair.restGain)}, starK), ${n(CARD.hair.gain)}, vL2.w);
  // in the storm the down is lit gold by the low sun and the lights inside
  col *= mix(vec3(1.0), vec3(${CARD.hair.stormTint.map(n).join(', ')}), vL2.w);
  // a puff is the paler of the two: fine down in the shade of the glass, where a star stands in the low sun
  col *= mix(vec3(${CARD.down.puff.tint.map(n).join(', ')}), vec3(1.0), max(starK, vL2.w));
  // a head that is not lit is the warmer for it: dim down in low light is cream gold, never grey
  col *= mix(vec3(${CARD.hair.dimTint.map(n).join(', ')}), vec3(${CARD.hair.litTint.map(n).join(', ')}), max(nearS, ${n(CARD.hair.stormPale)} * vL2.w));
  // no two stars are of one white: each stands in its own share of the low sun's colour
  col *= mix(vec3(1.0), vec3(${CARD.hair.peach.map(n).join(', ')}), starK * mix(${n(CARD.hair.peachShare)}, 1.0, fract(vL3.w * 23.0)) * (1.0 - vL2.w));
  // the down of a clock is white in the liquid's light, and the stout near ones stand warm in the low sun; its stalk is golden and its seed dark
  if (clockS > 0.0) {
    vec3 colK = k.rgb * mix(mix(mix(vec3(${CARD.clock.tint.map(n).join(', ')}), vec3(${CARD.clock.farTint.map(n).join(', ')}), farS), vec3(${CARD.clock.warm.map(n).join(', ')}), tintK), mix(vec3(${CARD.clock.stemTint.map(n).join(', ')}), vec3(${CARD.hair.grainTint.map(n).join(', ')}), grain), stems / max(hairs + stems, 1e-4)) * light * ${n(CARD.clock.gain)};
    colK *= min(1.0, mix(mix(${n(CARD.clock.white)}, ${n(CARD.clock.farWhite)}, farS), ${n(CARD.clock.stoutWhite)}, warmK) * uLightBurn / max(max(colK.r, max(colK.g, colK.b)), 1e-3));
    // the heart of a clock is white hot, where the low sun comes through the hub
    colK = mix(colK, vec3(${CARD.clock.heartTint.map(n).join(', ')}) * uLightBurn, mix(${n(CARD.clock.heartLit[0])}, ${n(CARD.clock.heartLit[1])}, warmK) * hotK * (1.0 - stems / max(hairs + stems, 1e-4)));
    col = mix(col, colK, clockS);
  }
  // a few of the lit heads glow warm at the heart, where the low sun comes through the down
  float heart = mix(${n(CARD.hair.heartDim)}, 1.0, nearS) * step(fract(vL3.y * 91.0), ${n(CARD.hair.heartShare)}) * exp(-0.5 * dot(pp - hub, pp - hub) / (s2 + mix(${n(CARD.down.puff.glowWide * CARD.down.puff.glowWide)}, ${n(CARD.hair.heartWide * CARD.hair.heartWide)}, max(starK, vL2.w)) * rC * rC));
  col = mix(col, vec3(${CARD.hair.heartTint.map(n).join(', ')}) * light * ${n(CARD.hair.restGain)}, ${n(CARD.hair.heartSeen)} * heart * mix(${n(CARD.down.puff.heartSeen)}, 1.0, starK) * (1.0 - vL2.w));
  // the down stands white in the storm's mist: it is lit from before, and takes a share only of the haze it stands in
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * uTone.z * mix(1.0, ${n(CARD.hair.stormFog)}, vL2.w));
  gl_FragColor = vec4(col * cover, cover + (1.0 - cover) * shade);
}
/** A light (a firefly) or a spark (an ember): a hot core in a glow, drawn along its path through the shutter. Its light is added, and its core hides a little of what is behind. */
void cardGlow(vec2 p, int kind, vec4 k, vec4 look) {
  bool spark = look.x > ${n(SHAPE.spark - 0.5)};
  float r = max(vL4.w, 1e-3);
  float tailC = ${n(CARD.spark.tail)} * mix(${n(CARD.spark.calmTail)}, 1.0, vL2.w) * r;
  bool run = uStorm.x > 0.0;
  float reachLong = vStreak.z + (spark && !run ? tailC : 0.0);
  float t = clamp(dot(p, vStreak.xy), -reachLong, vStreak.z);
  vec2 d = p - vStreak.xy * t;
  if (run) d -= vec2(-vStreak.y, vStreak.x) * (pointBend * (t * t / max(vStreak.z, 1e-3) - 0.333 * vStreak.z));
  float d2 = dot(d, d);
  float fade = spark && !run ? 1.0 - 0.75 * clamp((-t - vStreak.z) / max(tailC, 1e-3) + 0.3, 0.0, 1.0) : 1.0;
  // a light of the storm is a streak of light, bright at its head and fading down its tail
  if (!spark) fade = mix(1.0, mix(${n(CARD.glow.stormTail)}, 1.0, smoothstep(-vStreak.z, 0.4 * vStreak.z, t)), vL2.w);
  float tightL = max(vL2.w, uStorm.x);
  // how much of its rest look a light has: none of it in the storm, and an ember none at all
  float restL = spark ? 0.0 : 1.0 - tightL;
  float rc = 0.0;
  float vc = 1.0;
  float core = 0.0;
  float disc = 0.0;
  float halo = 0.0;
  float wide = 0.0;
  float lum = 0.0;
  float cover = 0.0;
  // how much of a glow an ember at rest has (set below, read where the ember is tinted)
  float glowS = 0.0;
  float sg = sqrt(vStreak.w);
  float paleS = 0.0;
  float vcBare = 1.0;
  if (restL < 1.0) {
    // no two lights alike: the point of each and the glow round it are each of their own size, most points tiny and sharp
    // of the embers at rest about one in six sits in a wide orange glow of its own, and the rest are fine points with little round them
    float bigS = spark ? smoothstep(${n(CARD.spark.restBigFrom[0])}, ${n(CARD.spark.restBigFrom[1])}, fract(vL3.w * 71.0)) * (1.0 - vL2.w) : 0.0;
    rc = (spark ? mix(${n(CARD.spark.restCore)}, ${n(CARD.spark.core)}, vL2.w) : ${n(CARD.glow.core)} * mix(${n(CARD.glow.coreVary[0])}, ${n(CARD.glow.coreVary[1])}, pow(fract(vL3.x * 113.0), ${n(CARD.glow.coreSkew)}))) * r;
    float rh = (spark ? ${n(CARD.spark.halo)} : ${n(CARD.glow.halo)} * mix(${n(CARD.glow.haloVary[0])}, ${n(CARD.glow.haloVary[1])}, pow(fract(vL3.w * 71.0), ${n(CARD.glow.haloSkew)}))) * r;
    float rw = ${n(CARD.glow.lightWide)} * r;
    // a light of the storm is a hot point in a glow of its own: however small the point is drawn, the point is no smaller than corePx on the picture, the glow round it than haloPx (each by its own share) and the faint wide glow than widePx. Before the miniature the glow is the tighter
    if (!spark) {
      rc = max(rc, mix(${n(CARD.glow.corePx)}, ${n(CARD.glow.stormCorePx)}, vL2.w) * uPoint.w);
      rh = max(rh, ${n(CARD.glow.haloPx)} * mix(${n(CARD.glow.haloPxVary[0])}, ${n(CARD.glow.haloPxVary[1])}, fract(vL3.w * 71.0)) * (1.0 - ${n(CARD.glow.sceneTight)} * vL3.z) * mix(1.0, ${n(CARD.glow.stormHaloPx)}, tightL) * uPoint.w);
      rw = max(rw, ${n(CARD.glow.widePx)} * uPoint.w);
    }
    vc = rc * rc + vStreak.w;
    glowS = spark ? max(max(bigS, step(fract(vL3.w * 29.0), ${n(CARD.spark.restGlowShare)})), smoothstep(${n(CARD.spark.restGlowPx[0])}, ${n(CARD.spark.restGlowPx[1])}, sqrt(vc) / uPoint.w)) : 0.0;
    // an ember at rest sits in a glow of its own, so many times its point wide: the larger the point the wider its glow and the more of its light is in it
    if (spark) rh = mix(min(mix(${n(CARD.spark.restHalo[0])}, ${n(CARD.spark.restHalo[1])}, bigS) * sqrt(vc), ${n(CARD.spark.restHaloReach)} * (${n(CARD.glow.wide * 2.2)} * r + 2.6 * sqrt(vStreak.w) + 1.0)), rh, vL2.w);
    float vh = rh * rh + vStreak.w;
    float vw = rw * rw + vStreak.w;
    // over its path a light is spread thin by the shutter; a light of the storm keeps the larger share of it, so its streak is bright and never a pale bar
    disc = smoothstep(${n(CARD.glow.discFrom[0])}, ${n(CARD.glow.discFrom[1])}, sg / max(rc, 0.6)) * (spark ? 1.0 : 1.0 - uStorm.x);
    // the brighter a bare ember's point stands at rest, the more light it is given and the tighter it is drawn: the approved picture's fine points are bright to clipping at the middle and still under two and a half pixels wide, and its faint ones are the fainter
    float bareGain = spark ? mix(1.0, clamp(pow(max(vCore.w * rc * rc / vc / ${n(CARD.spark.restBareLift[0])}, 1e-4), ${n(CARD.spark.restBareLift[1])}), ${n(CARD.spark.restBareLift[2])}, ${n(CARD.spark.restBareLift[3])}), (1.0 - glowS) * (1.0 - disc) * (1.0 - vL2.w)) : 1.0;
    paleS = spark ? step(fract(vL3.w * 47.0), vL4.x * mix(${n(CARD.spark.restPaleBy[0])}, ${n(CARD.spark.restPaleBy[1])}, smoothstep(${n(CARD.spark.restPaleLift[0])}, ${n(CARD.spark.restPaleLift[1])}, bareGain))) * (1.0 - glowS) * (1.0 - disc) * (1.0 - vL2.w) : 0.0;
    float bareTight = 1.0 + ${n(CARD.spark.restBareTight)} * max(log2(bareGain), 0.0);
    // a light of the storm is a slim spindle of light: both its ends go out to nothing, so it has no square end. The tail's end goes out inside the streak, where its light is low already. The head's end is laid past where the streak ended, along the streak's own arc: up to its old end the streak has all the light it had, so no light is fainter at its brightest for its soft end. A streak that is no longer than its core is soft is a round point and keeps its ends, as a light does that the storm has only just taken up or is letting go
    if (!spark && vL2.w > 0.0) {
      float endsE = smoothstep(0.0, ${n(CARD.glow.stormEndsBy)}, vL2.w) * smoothstep(${n(CARD.glow.stormEndsFrom[0])}, ${n(CARD.glow.stormEndsFrom[1])}, vStreak.z / sqrt(vc));
      float tE = clamp(dot(p, vStreak.xy), -vStreak.z, vStreak.z * (1.0 + ${n(CARD.glow.stormEnds[1])} * endsE));
      vec2 dE = p - vStreak.xy * tE;
      if (run) dE -= vec2(-vStreak.y, vStreak.x) * (pointBend * (tE * tE / max(vStreak.z, 1e-3) - 0.333 * vStreak.z));
      d2 = dot(dE, dE);
      float alongE = tE / max(vStreak.z, 1e-3);
      fade *= mix(1.0, smoothstep(-1.0, ${n(CARD.glow.stormEnds[0] - 1)}, alongE) * (1.0 - smoothstep(1.0, ${n(1 + CARD.glow.stormEnds[1])}, alongE)), endsE);
    }
    bareGain *= mix(1.0, ${n(CARD.spark.restPaleDim)}, paleS);
    bareGain = mix(bareGain, min(bareGain, ${n(CARD.spark.restPaleMost)} / max(vCore.w * rc * rc / vc, 1e-4)), paleS);
    vcBare = max(vc / bareTight, spark ? (1.0 - paleS) * (1.0 - glowS) * (1.0 - disc) * (1.0 - vL2.w) * ${n(CARD.spark.restWarmPx * CARD.spark.restWarmPx)} * uPoint.w * uPoint.w : 0.0);
    float bell = exp(-0.5 * d2 / vcBare);
    // above the pixels of the hd picture (the film at 3840) a light of the storm is slim (looks.ts, CARD.glow, stormSlim): across, its core is no softer than so many pixels of the hd picture, and it falls off at its sides more steeply than a bell does, so that it is a whole bright line at its middle with no wide soft flank for the film's curve to lift into a slab. Its length, its ends, its place and the light at its middle are as they were. Where a pixel is a pixel of the hd picture none of this is read, and none of it in the app at any size (uWhole)
    if (!spark && uPoint.w > 1.0 && uWhole < 0.5 && tightL > 0.0) {
      // no base of a power is below nought here (a variance over a square, one and a power, a squared distance over a variance): the guards say so to a graphics card that has no answer for one that is, and change no value
      float slimV = vcBare * pow(max(1.0 + pow(max(vcBare / (${n(CARD.glow.stormSlim[0] * CARD.glow.stormSlim[0])} * uPoint.w * uPoint.w), 0.0), ${n(CARD.glow.stormSlim[1])}), 1.0), ${n(-1 / CARD.glow.stormSlim[1])});
      bell = mix(bell, exp(-0.5 * pow(max(d2 / slimV, 0.0), ${n(CARD.glow.stormSlim[2])})), tightL * min(uPoint.w - 1.0, 1.0));
    }
    core = rc * rc / vc / (1.0 + 0.8 * (spark ? 1.0 : mix(1.0, ${n(CARD.glow.stormThin)}, vL2.w)) * vStreak.z / sqrt(vc)) * bell * fade * bareGain;
    float lid = 0.0;
    if (disc > 0.0) {
      float rd = ${n(CARD.glow.discWide)} * sg;
      float dd = sqrt(d2);
      float softD = ${n(CARD.spark.restDiscSoft)} * smoothstep(${n(CARD.spark.restDiscSoftPx[0])}, ${n(CARD.spark.restDiscSoftPx[1])}, rd / uPoint.w) * (1.0 - vL2.w);
      float face = (spark ? (1.0 - smoothstep((${n(CARD.spark.discEdge)} - 0.55 * softD) * rd - 0.6, (1.0 + 0.45 * softD) * rd + 0.6, dd)) * mix(${n(CARD.spark.discVary[0])}, ${n(CARD.spark.discVary[1])}, fract(vL3.x * 113.0)) : 1.0 - smoothstep(${n(CARD.glow.discEdge)} * rd, 1.1 * rd + 0.6, dd)) * (1.0 - (spark ? ${n(CARD.spark.discRim)} : ${n(CARD.glow.discRim)}) * (1.0 - smoothstep(0.45 * rd, rd, dd)));
      // a near spark at rest is a flat disc that hides some of what is behind it: laid on as light alone it turns pink over the green air
      if (spark) lid = ${n(CARD.spark.restDiscCover)} * disc * face * (1.0 - vL2.w) * (1.0 - smoothstep(0.55, 1.0, vL3.z / 6.2831853));
      core = mix(core, pow(abs(rc * rc / vc), spark ? mix(${n(CARD.spark.restDiscHold)}, ${n(CARD.spark.discHold)}, vL2.w) : ${n(CARD.glow.discHold)}) * face * (spark ? mix(${n(CARD.spark.restDiscSeen)}, 1.0, vL2.w) : ${n(CARD.glow.discSeen)}), disc);
    }
    halo = (spark ? mix(glowS * mix(${n(CARD.spark.restHaloShare[0])}, ${n(CARD.spark.restHaloShare[1])}, bigS) * (1.0 - smoothstep(${n(CARD.spark.restHaloTo[0])}, ${n(CARD.spark.restHaloTo[1])}, sqrt(vc) / uPoint.w)) * rc * rc / vc * vh / (rh * rh), ${n(CARD.spark.haloShare)}, vL2.w) : ${n(CARD.glow.haloShare)} * mix(${n(CARD.glow.haloSeen[0])}, ${n(CARD.glow.haloSeen[1])}, pow(fract(vL3.y * 43.0), ${n(CARD.glow.haloSeenSkew)})) * (1.0 - ${n(CARD.glow.stormHalo)} * tightL)) * rh * rh / vh / (1.0 + 0.8 * vStreak.z / sqrt(vh)) * exp(-0.5 * d2 / vh);
    // a bare ember keeps a small glow of its own orange round its point
    if (spark) halo += (1.0 - glowS) * (1.0 - disc) * (1.0 - vL2.w) * vL4.y * mix(${n(CARD.spark.restSkirtShare[0])}, ${n(CARD.spark.restSkirtShare[1])}, paleS) * min(bareGain * rc * rc / vc / (1.0 + 0.8 * vStreak.z / sqrt(vc)), ${n(CARD.spark.restSkirtMost / CARD.spark.restGain)} / max(vCore.w, 1e-4)) * exp(-0.5 * d2 / (${n(CARD.spark.restSkirtPx * CARD.spark.restSkirtPx)} * uPoint.w * uPoint.w + vcBare)) * fade;
    // the brightest lights, one in four, have a soft wide glow as well, and before the miniature none has: a point with a tight glow
    wide = spark ? 0.0 : ${n(CARD.glow.wideShare)} * step(${n(1 - CARD.glow.wideOf)}, fract(vL3.x * 113.0)) * (1.0 - vL3.z) * (1.0 - ${n(CARD.glow.stormHalo)} * tightL) * rw * rw / vw * exp(-0.5 * d2 / vw);
    // a light in the storm is a thin bright streak: it keeps over its path the light the shutter spread thin
    lum = vCore.w * (core + halo + wide) * (spark ? mix(${n(CARD.spark.restGain)}, ${n(CARD.spark.gain)}, vL2.w) : ${n(CARD.glow.gain)} * (1.0 + ${n(CARD.glow.stormGain - 1)} * vL2.w));
    // a light of the storm flies before the white of the down: its core hides what is behind it, or its colour is lost in the white
    cover = min(spark ? vCore.w * (core * ${n(CARD.glow.hide)} * (1.0 - disc) + lid) : vCore.w * core * mix(${n(CARD.glow.lightHide)}, ${n(CARD.glow.stormHide)}, vL2.w) * (1.0 - disc), 1.0);
  }
  // at rest a light is a bright heart in a soft glow of its own colour, with no edge, no ring and no disc (cardRestLight): the heart fine and hot, the glow faint and tight round most and wide and soft round the few large. The light at the heart is less for the finest
  float solid = core;
  float paleR = 0.0;
  if (restL > 0.0) {
    float uR = clamp((fract(vL3.x * 113.0) - ${n(CARD.glow.restOut)}) / ${n(1 - CARD.glow.restOut)}, 0.0, 1.0);
    vec3 lawR = cardRestLight(uR, vL3.z, vL3.w);
    float vh = lawR.x * lawR.x * vCore.z * vCore.z;
    float vg = lawR.y * lawR.y * vCore.z * vCore.z;
    float heartR = vh / (vh + vStreak.w) / (1.0 + 0.8 * vStreak.z / sqrt(vh + vStreak.w)) * exp(-0.5 * d2 / (vh + vStreak.w));
    float glowR = lawR.z * vg / (vg + vStreak.w) / (1.0 + 0.8 * vStreak.z / sqrt(vg + vStreak.w)) * exp(-0.5 * d2 / (vg + vStreak.w));
    float fineR = smoothstep(0.0, ${n(CARD.glow.restDim[1])}, uR);
    paleR = mix(${n(CARD.glow.restPale[0])}, mix(${n(CARD.glow.restPale[2])}, ${n(CARD.glow.restPale[1])}, fineR), heartR / max(heartR + glowR, 1e-6));
    solid = mix(core, heartR, restL);
    // under the finest of the lit stand the specks (looks.ts, CARD.glow.restSpeck): lights too faint to be more than a point, each one fainter than the one before down their own row. The row of the lit goes over to them with no step, so no light stands at a line between the two
    float speckR = clamp((${n(CARD.glow.restOut)} - fract(vL3.x * 113.0)) / ${n(CARD.glow.restSpeck[0])}, 0.0, 1.0);
    lum = mix(lum, vCore.w * (heartR + glowR) * ${n(CARD.glow.restTop)} * mix(${n(CARD.glow.restDim[0])}, 1.0, fineR) * mix(1.0, exp(mix(${n(Math.log(CARD.glow.restSpeck[2]))}, ${n(Math.log(CARD.glow.restSpeck[1]))}, speckR)), smoothstep(0.0, 0.02, speckR)), restL);
  }
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  if (lum < mix(0.002, ${n(CARD.glow.restCut[0])}, restL)) discard;
  if (uDiag != 0) {
    if (vCore.w * solid < 0.25) discard;
    vec4 part = uKindPart[kind];
    if (uDiag == ${viewCode('ids')}) gl_FragColor = vec4(part.rgb, 1.0);
    else if (uDiag == ${viewCode('standins')}) gl_FragColor = vec4(part.rgb * part.a, 1.0);
    else gl_FragColor = stageDiag(k.rgb, inverseTransformDirection(vec3(0.0, 0.0, 1.0), viewMatrix), vFog.a, uPointChange, 0.0);
    return;
  }
  // a glow at rest goes to nothing inside its card, so the card's end is no edge on the picture
  if (restL > 0.0) lum *= mix(1.0, smoothstep(${n(CARD.glow.restCut[0])}, ${n(CARD.glow.restCut[1])}, lum), restL);
  // the lights run from yellow green to warm gold, each its own
  vec3 own = spark ? k.rgb : k.rgb * mix(vec3(${CARD.glow.green.map(n).join(', ')}), vec3(${CARD.glow.gold.map(n).join(', ')}), smoothstep(${n(CARD.glow.goldFrom[0])}, ${n(CARD.glow.goldFrom[1])}, vL3.y));
  // in the storm the lights are warmer: from yellow green toward a warm yellow
  if (!spark) own *= mix(vec3(1.0), vec3(${CARD.glow.stormTint.map(n).join(', ')}), vL2.w);
  // the middle of a light is hot and pale, and its own colour stands round it
  vec3 tint = mix(own, spark ? vec3(1.0, 1.0, 0.86) : vec3(${CARD.glow.hot.map(n).join(', ')}), (spark ? ${n(CARD.glow.sparkPale)} : mix(${n(CARD.glow.pale)}, ${n(CARD.glow.stormPale)}, vL2.w) * exp(-${n(CARD.glow.paleIn)} * d2 / vc)) * (1.0 - disc) * core / max(core + halo + wide, 1e-4));
  // the soft wide glow is the paler: light spread thin in the liquid, where the tight glow keeps the light's own colour
  if (!spark) tint = mix(tint, vec3(${CARD.glow.hot.map(n).join(', ')}), ${n(CARD.glow.widePale)} * wide / max(core + halo + wide, 1e-4));
  // the heart of a light at rest is hot and pale; its own colour stands round it, a little pale as well, as light spread in the liquid is
  if (restL > 0.0) tint = mix(tint, mix(own * vec3(${n(CARD.glow.restWarm)}, 1.0, 1.0), vec3(${CARD.glow.hot.map(n).join(', ')}), paleR), restL);
  if (spark) {
    float part = vL3.z / 6.2831853;
    float sharp = 1.0 - smoothstep(${n(CARD.spark.hotFrom[0])}, ${n(CARD.spark.hotFrom[1])}, sg / max(rc, 0.6));
    tint = mix(mix(mix(vec3(${CARD.spark.restEmber.map(n).join(', ')}), vec3(${CARD.spark.restDiscTint.map(n).join(', ')}), disc), k.rgb, vL2.w), vec3(${CARD.spark.dying.map(n).join(', ')}), smoothstep(0.55, 1.0, part));
    tint = mix(tint, mix(vec3(${CARD.spark.restHot.map(n).join(', ')}), vec3(${CARD.spark.hot.map(n).join(', ')}), vL2.w), mix(${n(CARD.spark.restHotCore)}, ${n(CARD.spark.hotCore)}, vL2.w) * sharp * (1.0 - disc) * exp(-0.5 * d2 / (mix(${n(CARD.spark.restHotWide)}, ${n(CARD.spark.hotWide)}, vL2.w) * vc)) * (1.0 - 0.7 * part * vL2.w));
    tint = mix(tint, vec3(${CARD.spark.restFineHot.map(n).join(', ')}), ${n(CARD.spark.restFineSeen[2])} * (1.0 - vL2.w) * (1.0 - smoothstep(${n(CARD.spark.restFineSeen[0])}, ${n(CARD.spark.restFineSeen[1])}, vCore.w)) * (1.0 - smoothstep(0.55, 1.0, part)));
    tint = mix(tint, mix(vec3(${CARD.spark.restSkirt.map(n).join(', ')}), mix(vec3(${CARD.spark.restBare.map(n).join(', ')}), vec3(${CARD.spark.restPale.map(n).join(', ')}), paleS * exp(-0.5 * d2 / (${n(CARD.spark.restPaleWide)} * vcBare))), core / max(core + halo, 1e-5)), (1.0 - glowS) * (1.0 - disc) * (1.0 - vL2.w));
  }
  vec3 col = tint * (k.a * lum) * (1.0 - vFog.a * uTone.z);
  gl_FragColor = vec4(col, cover);
}
/** One of the storm's fine streaks: a petal or a leaf seen through the whole shutter as a thin bowed line, bright at its head and fading down its trail. */
void cardStreak(vec2 p, int kind, vec4 k, vec4 look) {
  float lg = max(vStreak.z, 1.0);
  float s = dot(p, vStreak.xy) / lg;
  float off = dot(p, vec2(-vStreak.y, vStreak.x)) - vL4.x * lg * (1.0 - s * s);
  float past = max(abs(s) - 1.0, 0.0) * lg;
  float sc = clamp(s, -1.0, 1.0);
  bool seedy = look.x > ${n(SHAPE.seed - 0.5)};
  // a seed's stroke in the storm is a swish: full at its middle and drawn out to a point at both ends, the tail the fainter
  bool swish = seedy && uStorm.x > 0.0;
  bool bit = swish && vL4.z < -0.5 && vL4.z > -1.5;
  // the storm's mist: a wide soft band, faint, that fades out to both of its ends
  bool mist = swish && vL4.z < -1.5 && vL4.z > -2.5;
  // the half width of a lock of hairs, where the stroke is one
  float lockW = swish && vL4.z < -5.0 ? -vL4.z - 10.0 : 0.0;
  float wide = vL4.w * (swish && !mist ? mix(bit ? 0.08 : ${n(CARD.line.stormTaper)}, 1.0, 1.0 - sc * sc) : 1.0);
  float v = vStreak.w + wide * wide;
  // the stroke of every kind reads one number; the seed alone, whose hairs are finer, reads its own, so no other season's stroke moves with it
  float line = min(1.0, (seedy && look.x < ${n(SHAPE.seed + 0.5)} ? ${n(CARD.hair.seedSeen)} : ${n(CARD.hair.seen)}) * wide / sqrt(v)) * exp(-0.5 * (off * off + past * past) / v);
  // a bit of leaf is a blade with an edge, not a soft stroke
  if (bit) line = (1.0 - smoothstep(-1.0, 1.0, (abs(off) - wide) / (sqrt(vStreak.w) + 0.5))) * (1.0 - smoothstep(0.0, 1.5, past));
  float lit = line * (swish ? mix(bit ? 1.0 : ${n(CARD.line.stormTail)}, 1.0, smoothstep(-1.0, 0.2, sc)) : (uStorm.x > 0.0 && look.x > ${n(STORM_OWN_PATH_FROM)} ? 1.0 : mix(${n(CARD.line.tail)}, 1.0, smoothstep(-1.0, 0.7, sc))));
  // a stroke of the storm's down has no end that is seen: it comes out of nothing and goes back to nothing, a hair and never a dash
  if (swish && !bit && !mist) lit *= 1.0 - smoothstep(${n(1 - CARD.line.stormEnds)}, 1.0, abs(s));
  float glowM = 0.0;
  if (mist) {
    // the storm's sheet: fine hairs side by side along the whirl, each of its own place across the band, its own length, lean and light, with the dark between them; the band fades out to both of its ends
    float rowW = 2.0 * vL4.w / ${n(CARD.line.stormSheetRows)};
    float ro = floor(off / rowW + ${n(0.5 * CARD.line.stormSheetRows)});
    float fw = ${n(CARD.line.stormSheetPx)} * uPoint.w;
    float vf = vStreak.w + fw * fw;
    float amp = min(1.0, ${n(CARD.hair.seedSeen)} * fw / sqrt(vf));
    float sw = ${n(CARD.line.stormSheetSoftPx)} * uPoint.w;
    float vs = vf + sw * sw;
    float wisps = 0.0;
    lit = 0.0;
    for (int j = -1; j <= 1; j++) {
      float ri = ro + float(j);
      if (ri < 0.0 || ri > ${n(CARD.line.stormSheetRows - 0.5)}) continue;
      float hj = fract(sin((ri + 3.0) * 12.9898 + vL3.x * 78.233 + vL4.y * 37.719) * 43758.5453);
      float mj = (2.0 * fract(hj * 13.7) - 1.0) * ${n(CARD.line.stormSheetSpan)};
      float lj = mix(${n(CARD.line.stormSheetLong[0])}, ${n(CARD.line.stormSheetLong[1])}, fract(hj * 29.3) * fract(hj * 29.3));
      float sj = (s - mj) / lj;
      float dj = off - ((ri + 0.1 + 0.8 * fract(hj * 53.1)) * rowW - vL4.w) - ${n(CARD.line.stormSheetSlope)} * (fract(hj * 97.0) - 0.5) * (s - mj) * lg;
      float pj = max(abs(sj) - 1.0, 0.0) * lj * lg;
      float seenJ = mix(${n(CARD.line.stormSheetSeen[0])}, ${n(CARD.line.stormSheetSeen[1])}, fract(hj * 71.0) * fract(hj * 71.0)) * mix(${n(CARD.line.stormTail)}, 1.0, smoothstep(-1.0, 0.2, sj));
      lit = max(lit, seenJ * amp * exp(-0.5 * (dj * dj + pj * pj) / vf));
      // each hair is the bright middle of a wisp of finer down: wider, softer, longer and far fainter, so the haze of a sheet lies in streaks with the dark between them
      float qj = max(abs(sj) - ${n(CARD.line.stormSheetSoftLong)}, 0.0) * lj * lg;
      wisps += seenJ * exp(-0.5 * (dj * dj / vs + qj * qj / (vs + 16.0 * uPoint.w * uPoint.w)));
    }
    lit = 1.0 - (1.0 - lit) * (1.0 - min(${n(CARD.line.stormSheetSoft)} * wisps * vL3.w, 0.9));
    lit *= 1.0 - smoothstep(0.75, 1.0, abs(s));
    // the haze of the sheet: wide, soft and faint, one of many that lie over one another
    lit = 1.0 - (1.0 - lit) * (1.0 - ${n(CARD.line.stormMistHaze)} * vL3.w * exp(-0.5 * off * off / v) * max(1.0 - s * s, 0.0));
    // where the lanterns' light falls on it the haze of the sheet glows: a soft light at the sheet's middle, added to what is behind
    float ga = s * lg / max(${n(CARD.line.stormGlowLong)} * vL4.w, 1e-3);
    glowM = vL3.z * exp(-0.5 * (off * off / v + ga * ga));
  }
  float glint = 0.0;
  if (swish && !bit && !mist) {
    // back from the stroke's head along its path, and across it
    vec2 hp = vec2((1.0 - s) * lg, off);
    // a stroke of the storm's down is a seed's own down drawn out along its path: a lock of fine hairs side by side that follow the stroke's own curve, each at its own place across the lock and along it, of its own length, lean and light, and each comes out of nothing and goes back to nothing. A stream of short hairs, never a comb and never a feather. Not every stroke is one: the others are a single hair
    if (lockW > 0.0) {
      // a lock has no hair down its whole length: every one of its hairs is short and stands at its own place along it
      float plainL = lit;
      lit = 0.0;
      // the lock is the down of one seed drawn out along its path: its hairs run together toward the seed at the stroke's head and spread behind it
      float sF = fract(vL3.x * 613.0) < ${n(CARD.line.stormLockFlip)} ? -s : s;
      float fanW = lockW * mix(1.0, mix(${n(CARD.line.stormLockFan[0])}, ${n(CARD.line.stormLockFan[1])}, fract(vL3.x * 271.0)), smoothstep(-1.0, 1.0, sF));
      // on the way to the landing a lock comes to fewer rows of hairs (decision 222): the count is a real number, the rows stand closer or wider by it, and the last row goes by its own share, never at once
      float rowsL = ${eased(CARD.line.stormLockRows, STORM_LANDING.line.stormLockRows)};
      float rowW = 2.0 * fanW / rowsL;
      float ro = floor(off / rowW + 0.5 * rowsL);
      for (int j = -1; j <= 1; j++) {
        float ri = ro + float(j);
        if (ri < 0.0 || ri >= rowsL) continue;
        float hj = fract(sin((ri + 3.0) * 12.9898 + vL3.x * 78.233 + vL4.y * 37.719) * 43758.5453);
        float lj = mix(${n(CARD.line.stormLockLong[0])}, ${n(CARD.line.stormLockLong[1])}, fract(hj * 29.3));
        // every hair ends near the seed, each a little short of it
        float mj = mix(${n(CARD.line.stormLockHeaded)}, 1.0, fract(hj * 13.7)) * (1.0 - lj);
        float sj = (sF - mj) / lj;
        float dj = off - ((ri + 0.15 + 0.7 * fract(hj * 53.1)) * rowW - fanW) - ${n(CARD.line.stormLockSlope)} * (fract(hj * 97.0) - 0.5) * (sF - mj) * lg;
        // some of the hairs are soft: wider and fainter, the down the eye cannot tell hair from hair
        float softJ = step(fract(hj * 173.0), ${n(CARD.line.stormLockSoft)});
        float wj = vL4.w * mix(1.0, ${n(CARD.line.stormLockSoftWide)}, softJ);
        float vj = vStreak.w + wj * wj;
        // how much a hair is seen goes in a line from the storm's to the landing's, each taken whole (decision 222), so the hair of the storm at its full is the same to the last bit; the last row of a lock goes by its own share
        float seenJ = mix(mix(${n(CARD.line.stormLockSeen[0])}, ${n(CARD.line.stormLockSeen[1])}, fract(hj * 71.0) * fract(hj * 71.0)), mix(${n(STORM_LANDING.line.stormLockSeen[0])}, ${n(STORM_LANDING.line.stormLockSeen[1])}, fract(hj * 71.0) * fract(hj * 71.0)), uStormLanding) * mix(1.0, ${n(CARD.line.stormLockSoftSeen)}, softJ) * min(rowsL - ri, 1.0);
        lit = max(lit, seenJ * min(1.0, ${n(CARD.hair.seedSeen)} * wj / sqrt(vj)) * exp(-0.5 * dj * dj / vj) * (1.0 - smoothstep(${n(1 - CARD.line.stormEnds)}, 1.0, -sj)) * (1.0 - smoothstep(0.7, 1.0, sj)));
      }
      // between its hairs a lock holds the finest of the down, which no eye tells hair from hair: a faint soft band, one of the many that lie over one another and are the milk of the storm
      float hz = off / (${n(CARD.line.stormLockHazeWide)} * fanW);
      lit = 1.0 - (1.0 - lit) * (1.0 - ${eased(CARD.line.stormLockHaze, STORM_LANDING.line.stormLockHaze)} * exp(-0.5 * hz * hz) * (1.0 - s * s) * (1.0 - s * s) * step(abs(s), 1.0));
      // a lock that the thin look does not have goes over to the one fine stroke it is there (decision 222): by its own share over the whole way to the landing, never at once
      if (fract(vL3.x * 733.0) >= ${n(STORM_LANDING.line.stormLockShare)}) lit = mix(lit, plainL, uStormLanding);
    }
    // the seed at the head of some strokes catches the low sun: one small warm glint
    // where the film's lens lays the stroke out over more than a couple of pixels of the hd picture, as its card says, the glint goes out by degrees, the stroke stays (decision 246): under the first of the two it is whole to the last bit, so no frame of the film and no still at the hero camera moves
    if (fract(vL3.x * 419.0) < ${n(CARD.line.stormGlint)}) glint = exp(-0.5 * dot(hp, hp) / (vStreak.w + ${n(CARD.line.stormGlintPx * CARD.line.stormGlintPx)} * uPoint.w * uPoint.w)) * (1.0 - smoothstep(${n(CARD.line.stormGlintLaidPx[0])}, ${n(CARD.line.stormGlintLaidPx[1])}, vL3.z));
  }
  float headW = 0.0;
  float seen = vCore.w * look.z;
  float glintW = glint * min(1.0, seen * ${n(CARD.line.stormGlintLift)});
  float cover = min(max(lit * seen, glintW), 1.0);
  if (vL4.z > 0.0) {
    vec2 hd = p - vStreak.xy * lg;
    if (seedy) {
      vec2 back = -vStreak.xy;
      float rr = length(hd);
      float gap = ${n((2 * CARD.line.fanSpread) / CARD.line.fanHairs)};
      vec2 fanAt = vec2(dot(back, hd), back.x * hd.y - back.y * hd.x);
      float ua = atan(fanAt.y, abs(fanAt.x) + abs(fanAt.y) > 0.0 ? fanAt.x : 1.0) / gap;
      float ia = floor(ua + 0.5);
      float da = abs(ua - ia) * gap * rr;
      float reach = vL4.z * mix(${n(CARD.line.fanShort)}, 1.0, fract(sin((ia + 7.0) * 12.9898 + vL3.x * 50.0) * 43758.5453));
      float hw = ${n(CARD.line.fanWide)} * vL4.w;
      float hv = vStreak.w + hw * hw;
      float fan = step(abs(ia), ${n((CARD.line.fanHairs - 1) / 2 + 0.1)}) * min(1.0, 1.6 * hw / sqrt(hv)) * exp(-0.5 * da * da / hv) * (1.0 - smoothstep(0.75 * reach, reach, rr)) * smoothstep(${n(CARD.line.fanOpen[0])} * vL4.z, ${n(CARD.line.fanOpen[1])} * vL4.z, rr);
      float cv = vStreak.w + ${n(CARD.line.fanCore * CARD.line.fanCore)} * vL4.z * vL4.z;
      fan = max(fan, exp(-0.5 * rr * rr / cv) * min(1.0, ${n(CARD.line.fanCore * CARD.line.fanCore)} * vL4.z * vL4.z / (vStreak.w + 1e-3)));
      cover = min(max(lit * seen, ${n(CARD.line.headSeen)} * fan * min(1.0, seen * ${n(CARD.line.headLift)})), 1.0);
    } else {
      float ang = 6.2831853 * vL3.x;
      vec2 e = vec2(cos(ang) * hd.x + sin(ang) * hd.y, (cos(ang) * hd.y - sin(ang) * hd.x) / mix(${n(CARD.line.headOval[0])}, ${n(CARD.line.headOval[1])}, vL3.y));
      float edge = sqrt(vStreak.w) + 0.5;
      headW = (1.0 - smoothstep(vL4.z - edge, vL4.z + edge, length(e))) * min(1.0, vL4.z * vL4.z / (vStreak.w + 1e-3)) * min(1.0, seen * ${n(CARD.line.headLift)});
      cover = max(cover * (1.0 - headW), headW);
    }
  }
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  if (cover < 0.003 && glowM * seen < 0.003) discard;
  if (uDiag != 0) {
    if (cover < 0.5) discard;
    vec4 part = uKindPart[kind];
    if (uDiag == ${viewCode('ids')}) gl_FragColor = vec4(part.rgb, 1.0);
    else if (uDiag == ${viewCode('standins')}) gl_FragColor = vec4(part.rgb * part.a, 1.0);
    else gl_FragColor = stageDiag(k.rgb, inverseTransformDirection(vec3(0.0, 0.0, 1.0), viewMatrix), vFog.a, uPointChange, 0.0);
    return;
  }
  bool leafy = look.x > ${n(SHAPE.leaf - 0.5)};
  vec3 light = vGrid.rgb + vDom.rgb * (${n(LIGHT_LOOK.keyFloor)} + ${n(LIGHT_LOOK.keySide * 0.45)});
  light *= min(1.0, (mist ? ${n(CARD.line.stormMistLit)} : ${n(CARD.litMost)}) * uLightBurn / max(max(light.r, max(light.g, light.b)), 1e-3));
  if (leafy) light = mix(vec3(max(light.r, max(light.g, light.b))), light, ${n(CARD.leafHue)});
  // the down is white: its strokes take the light's brightness and half of its colour; the mist takes the light's colour whole
  if (swish && !bit && !mist) light = mix(vec3(max(light.r, max(light.g, light.b))), light, ${n(CARD.line.stormHue)});
  vec3 body = leafy ? mix(k.rgb * vec3(${CARD.line.leafLow.map(n).join(', ')}), vec3(${CARD.line.leafHigh.map(n).join(', ')}), pow(abs(vL4.y), uStorm.x > 0.0 ? ${n(CARD.line.shutPale)} : ${n(CARD.line.leafPale)})) : mix(k.rgb, vec3(1.0), mix(${n(CARD.line.pale[0])}, ${n(CARD.line.pale[1])}, vL4.y));
  if (bit) body = vec3(${CARD.line.stormLeaf.map(n).join(', ')}) * mix(0.55, 1.3, vL4.y);
  // the storm's down is the warm cream of the heads: a stroke goes a little way to white, each by its own share
  if (swish && !bit) body = mix(k.rgb * vec3(${CARD.line.stormCream.map(n).join(', ')}), vec3(1.0), ${eased(CARD.line.stormWhite, STORM_LANDING.line.stormWhite)} * vL4.y);
  vec3 col = body * light * (seedy ? (swish && !bit ? (mist ? ${n(CARD.line.stormMistGain)} : ${n(CARD.line.stormGain)}) : (bit ? ${n(CARD.line.stormLeafGain)} : ${n(CARD.line.seedGain)})) : ${n(CARD.line.gain)});
  if (glintW > 0.0) col = mix(col, vec3(${CARD.line.stormGlintTint.map(n).join(', ')}) * (max(light.r, max(light.g, light.b)) * ${n(CARD.line.stormGain)}), min(glintW / max(cover, 1e-3), 1.0));
  if (headW > 0.0) {
    vec3 own = look.x > ${n(SHAPE.leaf - 0.5)} ? mix(k.rgb * vec3(${CARD.line.leafHead[0].map(n).join(', ')}), vec3(${CARD.line.leafHead[1].map(n).join(', ')}), step(${n(CARD.line.leafWhite)}, vL3.w)) : k.rgb * mix(vec3(${CARD.line.petalHead[0].map(n).join(', ')}), vec3(${CARD.line.petalHead[1].map(n).join(', ')}), step(${n(CARD.line.petalWhite)}, vL3.w));
    col = mix(col, own * light * ${n(CARD.line.headGain)}, headW / max(cover, 1e-3));
  }
  // the down's strokes stand white in the storm's mist: they take a share only of the haze they are in; every other stroke takes it whole
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * uTone.z * (swish ? ${n(CARD.line.stormFog)} : 1.0));
  gl_FragColor = vec4(col * cover, cover);
  if (mist) gl_FragColor.rgb += body * light * (${n(CARD.line.stormMistGlow)} * glowM * seen);
}
/** The glow of the storm's haze round one of the lights inside (STORM_BLOOM): a soft bloom over the light and a wider, fainter glow round it, added to what is behind. It covers nothing. */
void cardStormGlow(vec2 p) {
  if (uDiag != 0) discard;
  float s2 = max(vL4.w * vL4.w, 1e-3);
  // the low glow is flat: as wide as the others, and a share of that high
  float r2 = vL3.y < -1.5 ? p.x * p.x + ${n(STORM_BLOOM.lowFlat * STORM_BLOOM.lowFlat)} * p.y * p.y : dot(p, p);
  // nothing of it is left where the card ends, whatever the card is cut to
  float edge = 1.0 - smoothstep(0.7, 1.0, length(p) / max(vL4.z, 1.0));
  // the pool and the low glow are each one wide glow of the cream alone
  bool pool = vL3.y < 0.0;
  if (vL3.y < -1.5) {
    // the low glow's card stands before the ground, which is nearer than the glass where the ball goes down into the base: it lay on the base there as a pale sheet with the base's outline. Its depth is the glass's own on this pixel's ray, so whatever stands before the glass hides it, and past the ball's outline there is none of it
    vec3 rayG = normalize(vec3(vL4.xy + p / uPoint.y, -1.0));
    vec3 midG = (viewMatrix * vec4(uLensCentre, 1.0)).xyz;
    float nearG = dot(rayG, midG);
    float wallG = 0.5 * (uLens.x + uLens.w);
    float underG = nearG * nearG - dot(midG, midG) + wallG * wallG;
    if (underG <= 0.0) discard;
    float deepG = max(-rayG.z * (nearG - sqrt(underG)), 1e-3);
    gl_FragDepth = 0.5 + 0.5 * (projectionMatrix[3][2] - projectionMatrix[2][2] * deepG) / deepG;
  }
  float heart = exp(-0.5 * r2 / s2);
  // a warm light's blue goes with the square of its green
  vec3 own = vec3(1.0, vL3.y, 0.77 * vL3.y * vL3.y);
  // over the light itself the glow is hot and pale, so the lantern blooms to cream; round it the haze has the light's own warm colour
  vec3 glowS = pool ? vec3(${STORM_BLOOM.cream.map(n).join(', ')}) * heart : vec3(${STORM_BLOOM.hot.map(n).join(', ')}) * (${n(STORM_BLOOM.core)} * heart) + mix(own, vec3(${STORM_BLOOM.cream.map(n).join(', ')}), ${n(STORM_BLOOM.pale)}) * (${n(STORM_BLOOM.haze)} * exp(-0.5 * r2 / (${n(STORM_BLOOM.far * STORM_BLOOM.far)} * s2)));
  gl_FragColor = vec4(glowS * (edge * vCore.w), 0.0);
}
void cardMain(vec2 p, int kind, vec4 k, vec4 look, float lying) {
  float shape = look.x;
  if (vKind.w > 1.5) {
    cardStormGlow(p);
    return;
  }
  if (vDom.w > 0.5) {
    cardStreak(p, kind, k, look);
    return;
  }
  if (shape > ${n(SHAPE.seed - 0.5)} && shape < ${n(SHAPE.seed + 0.5)}) {
    cardSeed(p, kind, k, look);
    return;
  }
  if (shape > ${n(SHAPE.light - 0.5)} && shape < ${n(SHAPE.spark + 0.5)}) {
    cardGlow(p, kind, k, look);
    return;
  }
  vec2 q;
  float cover = min(cardCover(shape, p, q) * vCore.w * look.z, 1.0);
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  if (cover < 0.003) discard;
  float rC = max(vL4.w, 1e-3);
  vec3 uV = normalize(vec3(vL0.xy / rC, vL1.z));
  vec3 vV = normalize(vec3(vL0.zw / rC, vL1.w));
  vec2 qc = clamp(q, -1.0, 1.0);
  vec3 nv = normalize(vL2.xyz - (2.0 * vL4.x * qc.x + vL4.z * qc.y) * uV - (2.0 * vL4.y * qc.y + vL4.z * qc.x) * vV);
  if (nv.z < 0.0) nv = -nv;
  if (uDiag != 0) {
    if (cover < 0.5) discard;
    vec4 part = uKindPart[kind];
    if (uDiag == ${viewCode('ids')}) gl_FragColor = vec4(part.rgb, 1.0);
    else if (uDiag == ${viewCode('standins')}) gl_FragColor = vec4(part.rgb * part.a, 1.0);
    else gl_FragColor = stageDiag(k.rgb, inverseTransformDirection(nv, viewMatrix), vFog.a, uPointChange, 0.0);
    return;
  }
  vec4 tint = cardTint(shape, q, vL3.xy);
  vec3 upV = normalize(mat3(modelViewMatrix) * uUpLocal);
  float nk = dot(nv, normalize(mat3(viewMatrix) * stageKeyBent(vStageLocal)));
  float front = stageWrap(nk, uTone.x);
  float back = stageWrap(-nk, uTone.x) * look.w * tint.a;
  float keyShare = mix(${n(LIGHT_LOOK.keyFloor)} + ${n(LIGHT_LOOK.keySide)} * front * front, mix(stageWrap(nk, uRigInside.z) * 0.31831 / max(uRigPoint.x, 1e-3), ${n(LIGHT_LOOK.keyFloor)} + ${n(LIGHT_LOOK.keySide)} * front * front, ${n(CARD.lieLit)}), lying);
  vec3 light = vGrid.rgb * (1.0 + ${n(LIGHT_LOOK.skyTilt)} * dot(nv, upV)) + vDom.rgb * keyShare;
  light *= min(1.0, ${n(CARD.litMost)} * uLightBurn / max(max(light.r, max(light.g, light.b)), 1e-3));
  if (shape > ${n(SHAPE.leaf - 0.5)} && shape < ${n(SHAPE.leaf + 0.5)}) light = mix(vec3(max(light.r, max(light.g, light.b))), light, ${n(CARD.leafHue)});
  vec3 body = k.rgb * tint.rgb;
  if (vKind.w < 0.5 && shape < ${n(SHAPE.petal + 0.5)}) body *= vec3(${CARD.dabTint.map(n).join(', ')});
  if (shape > ${n(SHAPE.bat - 0.5)}) body *= ${n(CARD.batBody)};
  bool leafC = shape > ${n(SHAPE.leaf - 0.5)} && shape < ${n(SHAPE.leaf + 0.5)};
  vec3 col = body * light * mix(1.0, ${n(CARD.lieShade)}, lying);
  col += body * mix(vec3(1.0), body, leafC ? ${n(CARD.leafThrough)} : ${n(CARD.throughHue)}) * vDom.rgb * (${n(LIGHT_LOOK.keySide)} * back * back * (1.0 - lying));
  if (leafC) {
    vec3 keyV = normalize(mat3(viewMatrix) * stageKeyBent(vStageLocal));
    col *= mix(mix(${n(CARD.leafShade[0])}, ${n(CARD.leafShade[1])}, smoothstep(-0.7, 0.7, nk)), ${n(CARD.leafLie)}, lying);
    col *= min(1.0, mix(${n(CARD.leafRestMost)}, ${n(CARD.leafMost)}, vL2.w) * uLightBurn / max(max(col.r, max(col.g, col.b)), 1e-3));
    col += ${n(CARD.leafSheen)} * pow(max(dot(nv, normalize(keyV + vec3(0.0, 0.0, 1.0))), 0.0), 26.0) * vDom.rgb * (1.0 - lying);
  }
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * mix(uTone.z, ${n(CARD.lieVeil)}, lying));
  if (shape > ${n(SHAPE.bat - 0.5)}) col += (tint.r - 1.0) * vec3(${CARD.batGlow.map(n).join(', ')}) * (vGrid.rgb + vDom.rgb);
  gl_FragColor = vec4(col * cover, cover);
}
`
