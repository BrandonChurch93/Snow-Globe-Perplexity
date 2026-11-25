import { viewCode } from '../../diagnostics/views'
import { BATS, CARD, LENS_LOOK, LIGHT_LOOK, LIT_MOST, MAX_KINDS, PIXEL_SIGMA2, SHAPE, STORM_FLOOD, STORM_OWN_PATH_FROM, STORM_WINDOW, STREAK_ARC } from './looks'
import { ROLL_CENTRE } from '../../globe/liquid'

const n = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))
const at = (shape: number) => `(shape > ${n(shape - 0.5)} && shape < ${n(shape + 0.5)})`

/**
 * The kinds that are drawn as cards: every shape from `SHAPE.petal` on. This block runs at the end of the
 * vertex stage and writes every output again for those kinds, so the flakes and the glitter take no part of it.
 * A card is a thin curved sheet with three axes (along, across, out of the sheet), turned by the particle's own
 * turn. What goes to the fragment stage: the two in-sheet axes on the picture in pixels (vL0), the out-of-sheet
 * axis on the picture and the depth parts of the other two (vL1), the sheet's facing in view space and the storm
 * share (vL2), the particle's own numbers (vL3), and its bends and radius (vL4).
 */
export const CARD_VERT_PARS = `
uniform vec4 uKindWay[${MAX_KINDS}];
/** Where the bats are in the globe's own frame, and each one's radius in millimetres (0: no bat). */
uniform vec4 uBat[${BATS}];
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
    float rC = aData.x * look.y * uPoint.y * mag / zImg * shrink;
    vec4 way = uKindWay[kind];
    float u5 = float(cardHash2(pid, 191u + uint(kind)) >> 8u) / 16777216.0;
    float own = fract(h2.y * 211.0);
    float chosen = ${at(SHAPE.petal)} ? ${n(CARD.chosen[0])} : (${at(SHAPE.seed)} ? ${n(CARD.chosen[2])} : ${n(CARD.chosen[1])});
    float dabShare = ${at(SHAPE.leaf)} ? ${n(CARD.dabShare[1])} : (${at(SHAPE.seed)} ? ${n(CARD.dabShare[2])} : ${n(CARD.dabShare[0])});
    float whole = way.z < 0.5 || u5 < max(way.x, way.y) || own > 1.0 - chosen ? 1.0 : 0.0;
    float keepC = mix(afloat * max(gustC, ${n(CARD.dabCalm)} * uStorm.x * uStorm.w) * mix(${n(CARD.dabKeep[0])}, ${n(CARD.dabKeep[1])}, smoothstep(1.0 - chosen - dabShare - 0.02, 1.0 - chosen - dabShare, own)), 1.0, whole);
    if (${at(SHAPE.seed)} && whole > 0.5 && way.z > 0.5 && u5 >= max(way.x, way.y)) keepC *= max(max(afloat * gustC, uStorm.x * uStorm.w), lying * step(fract(own * 977.0), ${n(CARD.clear.snagSeen)}));
    if (${at(SHAPE.spark)}) keepC = max(mix(${n(CARD.sparkKeep[0])}, ${n(CARD.sparkKeep[1])}, pow(own, ${n(CARD.sparkSkew)})), smoothstep(${n(CARD.sparkClear[0])}, ${n(CARD.sparkClear[1])}, own));
    if (${at(SHAPE.fleck)}) keepC = mix(${n(CARD.fleckKeep[0])}, ${n(CARD.fleckKeep[1])}, pow(own, mix(${n(CARD.fleckSkew)}, ${n(CARD.fleckStorm)}, gustC)));
    float stormSize = ${at(SHAPE.petal)} ? ${n(CARD.stormSize[0])} : (${at(SHAPE.leaf)} ? ${n(CARD.stormSize[1])} : 1.0);
    rC *= mix(${at(SHAPE.leaf)} ? ${n(CARD.leafDab)} : ${n(CARD.dabSize)}, mix(1.0, stormSize, gustC * (own > 1.0 - chosen ? 0.0 : 1.0)), whole);
    float sheet = ${at(SHAPE.petal)} || ${at(SHAPE.leaf)} ? 1.0 : 0.0;
    float vary = fract(h2.w * 173.0);
    rC *= mix(1.0, mix(${n(CARD.spread[0])}, ${n(CARD.spread[1])}, pow(vary, ${n(CARD.spread[2])})), sheet) * mix(1.0, ${n(CARD.lieSize)}, lying * sheet);
    keepC *= mix(1.0, step(fract(h2.z * 57.0), ${at(SHAPE.petal)} ? ${n(CARD.lieKeep[0])} : ${n(CARD.lieKeep[1])}), lying * sheet);
    float lineShare = ${at(SHAPE.petal)} ? ${n(CARD.line.share[0])} : ${n(CARD.line.share[1])};
    float lineC = (1.0 - whole) * (sheet * step(own, lineShare) + (${at(SHAPE.seed)} ? 1.0 : 0.0));
    if (${at(SHAPE.seed)}) rC *= mix(1.0, mix(${n(CARD.hair.spread[0])}, ${n(CARD.hair.spread[1])}, pow(vary, ${n(CARD.hair.spread[2])})), whole);
    if (${at(SHAPE.fleck)}) rC *= mix(${n(CARD.fleckSpread[0])}, ${n(CARD.fleckSpread[1])}, pow(vary, ${n(CARD.fleckSpread[2])}));
    if (${at(SHAPE.spark)}) rC *= mix(${n(CARD.spark.small)}, ${n(CARD.spark.large)}, smoothstep(${n(CARD.spark.fromMm[0])}, ${n(CARD.spark.fromMm[1])}, aData.x));
    if (${at(SHAPE.light)}) rC *= mix(${n(CARD.glow.spread[0])}, ${n(CARD.glow.spread[1])}, pow(vary, ${n(CARD.glow.spread[2])}));
    if (shape > ${n(SHAPE.bat - 0.5)}) rC *= mix(${n(CARD.batSpread[0])}, ${n(CARD.batSpread[1])}, vary);
    keepC = mix(keepC, afloat * gustC * (${at(SHAPE.seed)} ? mix(${n(CARD.line.seedKeep[0])}, ${n(CARD.line.seedKeep[1])}, pow(fract(own * 53.0), ${n(CARD.line.seedSkew)})) : mix(${n(CARD.line.keep[0])}, ${n(CARD.line.keep[1])}, pow(fract(own * 53.0), ${at(SHAPE.leaf)} ? ${n(CARD.line.leafSkew)} : ${n(CARD.line.skew)}))), lineC);
    float windowC = (1.0 - smoothstep(${n(STORM_WINDOW.from)}, ${n(STORM_WINDOW.to)}, length((nowL.xy - vec2(${n(STORM_WINDOW.x)}, ${n(STORM_WINDOW.y)})) / vec2(${n(STORM_WINDOW.wide)}, ${n(STORM_WINDOW.high)})))) * smoothstep(${n(STORM_WINDOW.back)}, ${n(STORM_WINDOW.front)}, nowL.z);
    keepC *= 1.0 - ${n(CARD.window)} * windowC * gustC * (sheet + (${at(SHAPE.seed)} ? 1.0 : 0.0));
    float clearC = over * smoothstep(${n(CARD.clear.back)}, ${n(CARD.clear.front)}, depth) * (1.0 - smoothstep(${n(CARD.clear.lowMm)}, ${n(CARD.clear.highMm)}, nowL.y)) * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0);
    float nearC = afloat * (storming ? max(1.0 - gustC, smoothstep(0.0, 0.3, uStorm.x) * sheet * step(fract(h.y * 29.0), ${n(CARD.near.stormShare)}) * smoothstep(${n(CARD.near.stormFrom[0])}, ${n(CARD.near.stormFrom[1])}, depth)) : 1.0 - gustC) * whole * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0) * step(fract(h.y * 29.0), ${at(SHAPE.spark)} ? ${n(CARD.spark.nearShare)} : (${at(SHAPE.light)} ? ${n(CARD.glow.nearShare)} : ${n(CARD.near.share)})) * (${at(SHAPE.spark)} ? smoothstep(${n(CARD.spark.nearFrom[0])}, ${n(CARD.spark.nearFrom[1])}, depth) : smoothstep(${n(CARD.near.from)}, ${n(CARD.near.to)}, depth)) * (1.0 - ${n(CARD.near.clear)} * over) * (1.0 - clearC);
    if (${at(SHAPE.seed)}) {
      nearC = 0.0;
      rC *= mix(${n(CARD.hair.restSize)}, 1.0, max(gustC, 1.0 - whole));
      keepC *= 1.0 - over * (1.0 - smoothstep(${n(CARD.clear.lowMm)}, ${n(CARD.clear.highMm)}, nowL.y)) * whole * (1.0 - gustC) * afloat;
    }
    if (${at(SHAPE.spark)}) keepC = mix(keepC, 1.0, nearC);
    float farC = afloat * (1.0 - gustC) * whole * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0) * smoothstep(${n(CARD.far.from)}, ${n(CARD.far.to)}, depth);
    rC *= 1.0 + (${at(SHAPE.petal)} ? mix(${n(CARD.near.petalSize[0] - 1)}, ${n(CARD.near.petalSize[1] - 1)}, pow(fract(h.y * 173.0), ${n(CARD.near.petalSkew)})) : ${n(CARD.near.size - 1)}) * nearC * (sheet + (${at(SHAPE.seed)} ? 0.6 : 0.0));
    rC = mix(rC, min(rC, uPoint.w * (${at(SHAPE.seed)} ? ${n(CARD.clear.seedPx)} : (sheet > 0.5 ? ${n(CARD.clear.sheetPx)} : 1e4))), clearC);
    if (${at(SHAPE.seed)} && aState > 0.5) rC = min(rC, uPoint.w * mix(${n(CARD.clear.snagPx[0])}, ${n(CARD.clear.snagPx[1])}, pow(fract(h.w * 113.0), ${n(CARD.clear.snagSkew)})));
    if (shape > ${n(SHAPE.bat - 0.5)}) rC /= shrink;
    float ph = aData.w;
    float yaw = 6.2831853 * h.x + ${n(CARD.yawSway)} * sin(ph + 6.2831853 * h2.x) * afloat;
    float rock = mix(${at(SHAPE.petal)} ? ${n(CARD.petalRock)} : (${at(SHAPE.leaf)} ? ${n(CARD.leafRock)} : ${n(CARD.fleckRock)}), ${n(CARD.stormRock)}, gustC);
    float r1 = rock * sin(ph + 6.2831853 * h.y);
    float r2 = 0.6 * rock * sin(2.0 * ph + 6.2831853 * h.z);
    if (${at(SHAPE.leaf)}) r1 = ph + 6.2831853 * h.y;
    if (${at(SHAPE.seed)}) {
      rock = mix(${n(CARD.seedRock)}, ${n(CARD.stormRock)}, gustC);
      r1 = rock * sin(ph + 6.2831853 * h.y) + (aState > 0.5 ? 2.6 : ${n(CARD.seedTilt)}) * tilt.x + ${n(CARD.seedLean)} * (fract(h.w * 91.0) * 2.0 - 1.0) * afloat;
      r2 = 0.6 * rock * sin(2.0 * ph + 6.2831853 * h.z) + (aState > 0.5 ? 2.6 : ${n(CARD.seedTilt)}) * tilt.y + ${n(CARD.seedLean)} * (fract(h.w * 57.0) * 2.0 - 1.0) * afloat;
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
    if (shape > ${n(SHAPE.bat - 0.5)}) {
      vec2 goes = (toView * (aNow - aPrev)).xy;
      float lean = ${n(CARD.batLean)} * goes.x / max(length(goes), 1e-5) + ${n(CARD.batBank)} * (h.y * 2.0 - 1.0);
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
    if (${at(SHAPE.spark)} && !storming) {
      holdC = stC * uStorm.y * (1.0 - mix(${n(CARD.spark.calmStreak)}, 1.0, gustC));
      stC *= mix(${n(CARD.spark.calmStreak)}, 1.0, gustC);
    }
    if (whole < 0.5 && lineC < 0.5 && !storming) stC *= ${n(CARD.dabStreak)};
    float limC = uLimit.x / (uLimit.x + length(stC));
    stC *= limC;
    float bowC = 0.0;
    float dzC = 0.0;
    if (lineC > 0.5) {
      vec3 mvC = (aNow - aPrev) * shut;
      vec3 curC = veilCurrent(nowL);
      if (!storming) mvC = mix(mvC, curC * (length(mvC) * (dot(mvC, curC) < 0.0 ? -1.0 : 1.0)), ${n(CARD.line.align)} * uVeilRoll.x);
      stC = (toView * mvC).xy * (uPoint.y * mag / zImg) * afloat;
      if (!storming) stC *= ${at(SHAPE.seed)} ? mix(${n(CARD.line.seedStretch[0])}, ${n(CARD.line.seedStretch[1])}, pow(fract(own * 97.0), 2.0)) : (${at(SHAPE.leaf)} ? mix(${n(CARD.line.leafStretch[0])}, ${n(CARD.line.leafStretch[1])}, pow(fract(own * 97.0), 2.0)) : mix(${n(CARD.line.stretch[0])}, ${n(CARD.line.stretch[1])}, pow(fract(own * 97.0), 2.0)));
      limC = uLimit.x / (uLimit.x + length(stC));
      stC *= limC;
      // how far the trail runs toward or away from the eye, in millimetres over its drawn length
      dzC = clamp((toView * mvC).z * length(stC) / max(length((toView * mvC).xy) * (uPoint.y * mag / zImg), 1e-4), ${n(-CARD.line.deepMostMm)}, ${n(CARD.line.deepMostMm)}) * afloat;
      keepC *= storming && !(${at(SHAPE.seed)}) ? smoothstep(${n(CARD.line.shutFromPx[0])}, ${n(CARD.line.shutFromPx[1])}, length(stC) / uPoint.w) : smoothstep(${n(CARD.line.fromPx[0])}, ${n(CARD.line.fromPx[1])}, length(stC) / uPoint.w);
      vec2 inC = (toView * (vec3(${ROLL_CENTRE.map(n).join(', ')}) - nowL)).xy;
      bowC = mix(${n(CARD.line.bow[0])}, ${n(CARD.line.bow[1])}, fract(h2.z * 131.0)) * (dot(vec2(-stC.y, stC.x), inC) < 0.0 ? -1.0 : 1.0) * (fract(h2.z * 17.0) < 0.25 ? -1.0 : 1.0);
    }
    float hlC = 0.5 * length(stC);
    vec2 alC = hlC > 1e-4 ? stC / (2.0 * hlC) : vec2(1.0, 0.0);
    float arcC = 0.0;
    if (storming && afloat > 0.5 && hlC > 1e-3 && shape < ${n(SHAPE.bat - 0.5)}) {
      // the trail of a thing that goes round with the liquid is an arc: the same arc for a leaf, a petal, a seed, a light and a spark
      arcC = clamp(dot((toView * pointSag(nowL, (aNow - aPrev) * shut)).xy, vec2(-alC.y, alC.x)) * (uPoint.y * mag / zImg) * limC * limC / hlC, ${n(-STREAK_ARC.most)}, ${n(STREAK_ARC.most)});
      if (lineC > 0.5) {
        bowC = -arcC;
        // a thing seen for the whole shutter leaves on each place of its path the share of the shutter it spent there: the faster, the longer and the fainter
        keepC *= min(1.0, ${n(CARD.line.dwellPx)} * uPoint.w / hlC);
      }
    }
    float sgC = 0.5 * uBlur.z * (1.0 - exp(-(coc > 0.0 ? coc * uBlur.x : -coc * uBlur.y) / uBlur.z)) * afloat * mix(1.0, ${n(CARD.clear.blur)}, clearC);
    if (${at(SHAPE.spark)}) sgC *= mix(${n(CARD.spark.soft)}, 1.0, gustC);
    if (${at(SHAPE.seed)}) sgC *= mix(${n(CARD.hair.soft)}, 1.0, gustC);
    sgC += uPoint.w * (nearC * (${at(SHAPE.spark)} ? mix(${n(CARD.spark.nearPx[0])}, ${n(CARD.spark.nearPx[1])}, fract(h.y * 173.0)) : mix(${n(CARD.near.px[0])}, ${n(CARD.near.px[1])}, fract(h.y * 173.0))) + farC * mix(${n(CARD.far.px[0])}, ${n(CARD.far.px[1])}, fract(h.y * 173.0)));
    if (shape > ${n(SHAPE.bat - 0.5)}) sgC *= ${n(CARD.batSoft)};
    float s2C = sgC * sgC + ${n(PIXEL_SIGMA2)} * uPoint.w * uPoint.w;
    float reachC = ((${at(SHAPE.seed)} ? ${n(CARD.hair.reach)} : ${n(CARD.bound)}) + abs(bends.x) + abs(bends.y)) * rC + 2.2 * sqrt(s2C) + 1.0;
    if (shape > ${n(SHAPE.light - 0.5)} && shape < ${n(SHAPE.spark + 0.5)}) reachC = ${n(CARD.glow.wide)} * 2.2 * rC + 2.6 * sqrt(s2C) + 1.0;
    float headC = 0.0;
    float wideC = 0.0;
    if (lineC > 0.5) {
      float hk = fract(h2.x * 29.0);
      if (${at(SHAPE.seed)}) {
        headC = step(fract(h2.x * 61.0), ${n(CARD.line.seedHeads)}) * mix(${n(CARD.line.fanPx[0])}, ${n(CARD.line.fanPx[1])}, hk * hk);
        wideC = mix(${n(CARD.line.seedWidePx[0])}, ${n(CARD.line.seedWidePx[1])}, fract(h2.w * 41.0));
      } else if (${at(SHAPE.leaf)}) {
        headC = step(fract(h2.x * 61.0), ${n(CARD.line.leafHeads)}) * mix(${n(CARD.line.leafHeadPx[0])}, ${n(CARD.line.leafHeadPx[1])}, pow(hk, 1.5));
        wideC = mix(${n(CARD.line.leafWidePx[0])}, ${n(CARD.line.leafWidePx[1])}, fract(h2.w * 41.0));
      } else {
        headC = step(fract(h2.x * 61.0), ${n(CARD.line.petalHeads)}) * mix(${n(CARD.line.petalHeadPx[0])}, ${n(CARD.line.petalHeadPx[1])}, pow(hk, 1.5));
        wideC = mix(${n(CARD.line.widePx[0])}, ${n(CARD.line.widePx[1])}, fract(h2.w * 41.0));
      }
      float deepC = mix(${n(CARD.line.deep[0])}, ${n(CARD.line.deep[1])}, smoothstep(-0.8, 0.8, depth));
      if (storming) {
        headC = 0.0;
        wideC *= ${n(CARD.line.shutWide)};
      }
      headC *= uPoint.w * deepC;
      wideC *= uPoint.w * deepC;
      keepC *= 1.0 - ${n(CARD.line.frontCut)} * smoothstep(0.35, 0.9, depth);
      reachC = 2.6 * sqrt(s2C + wideC * wideC) + 2.0 + abs(bowC) * hlC + 1.3 * headC;
    }
    vec2 extC = min(vec2(reachC + 0.67 * abs(arcC) * hlC) + 1.05 * hlC * abs(alC), vec2(uLimit.y));
    alpha = aData.z * (shape > ${n(SHAPE.bat - 0.5)} ? 1.0 : rim) * mix(1.0, mix(${n(LENS_LOOK.farDim)}, 1.0, smoothstep(${n(LENS_LOOK.farDimFrom)}, ${n(LENS_LOOK.farDimTo)}, depth)), afloat * (shape > ${n(SHAPE.bat - 0.5)} ? 0.0 : 1.0)) * keepC * (1.0 + ${n(STORM_FLOOD.frontGain)} * front);
    if (${at(SHAPE.light)}) alpha *= mix(1.0, mix(${n(CARD.glow.blinkLow)}, 1.0, pow(0.5 + 0.5 * sin(ph + 6.2831853 * h.y), 3.0)), smoothstep(${n(CARD.glow.unlit)}, 1.0, aData.z));
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
    if (alpha < 0.003) extC = vec2(0.0);
    vL0 = vec4(ca, cb);
    vL1 = vec4(nV.xy * rC, uV.z, vV.z);
    vL2 = vec4(nV, gustC);
    vL3 = vec4(h2.x, fract(h.w * 37.0), ph, fract(h.z * 61.0));
    float detC = ca.x * cb.y - ca.y * cb.x;
    detC = abs(detC) < 1e-5 ? 1e-5 : detC;
    vec2 qnC = vec2(nV.x * cb.y - nV.y * cb.x, ca.x * nV.y - ca.y * nV.x) * (rC / detC);
    float bendFit = min(1.0, ${n(CARD.bendFit)} / (length(qnC) * 2.4 * (abs(bends.x) + abs(bends.y) + 0.5 * abs(bends.z)) + 1e-4));
    vL4 = vec4(bends, rC);
    if (lineC > 0.5) vL4 = vec4(bowC, fract(h2.x * 83.0), headC, wideC);
    vStreak = vec4(alC, hlC, s2C);
    vKind = vec4(aData.y, 2.0 * lying + 0.5 + arcC, float(pid & 4095u) + 0.01 + 0.98 * gustC, whole);
    vFog.a *= shape > ${n(SHAPE.bat - 0.5)} ? ${n(CARD.batFog)} : mix(${n(CARD.fog)}, 1.0, lying) * mix(${n(CARD.dabFog)}, 1.0, max(whole, lineC));
    if (${at(SHAPE.leaf)}) vFog.a = mix(vFog.a, min(vFog.a, ${n(CARD.leafFogMost)}), afloat * uStorm.x);
    vGrid = vec4(base0 * min(1.0, ${n(LIT_MOST)} / max(max(base0.r, max(base0.g, base0.b)), 1e-3)), bendFit);
    vDom = vec4(keyIn * uRigPoint.x, lineC);
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
    #ifdef POINT_SPRITES
    float sideC = 2.0 * max(extC.x, extC.y);
    gl_PointSize = sideC;
    vCore = vec4(sideC, reachC, 1.0, alpha);
    #else
    vec2 offC = position.xy * extC;
    vCore = vec4(offC, 1.0, alpha);
    if (lineC > 0.5 && hlC > 1e-3) {
      // a trail keeps its own depth along its whole length, so a wall or a trunk hides the part of it that runs behind
      vec4 alongC = projectionMatrix * vec4(view.xy, view.z + dzC * clamp(dot(offC, alC) / (2.0 * hlC), -0.5, 0.5), 1.0);
      clip.z = alongC.z / alongC.w * clip.w;
    }
    clip.xy += offC * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * (clip.w / uPoint.y);
    #endif
    vec4 liftC = projectionMatrix * vec4(view.xy, view.z + min(1.2 * rC * zImg / (uPoint.y * mag), ${n(LENS_LOOK.liftMostMm)}), 1.0);
    clip.z = liftC.z / liftC.w * clip.w;
  }
`

/** The outline of each card in its own two axes (x along, y across, both from -1 to 1): the distance to the edge, under 0 inside, and how it grows along each axis. */
export const CARD_FRAG_PARS = `
float cardPetalHalf(float u) {
  return 0.64 * sqrt(max(sin(3.14159265 * pow(u, 0.8)), 0.0)) * mix(0.5, 1.0, smoothstep(0.0, 0.5, u));
}
float cardLeafHalf(float v, vec2 own) {
  float w = 0.56 * sin(3.14159265 * pow(v, 0.7)) * (1.0 - 0.25 * v) * mix(0.8, 1.2, own.x);
  float lobes = mix(0.0, 0.42, smoothstep(0.45, 1.0, own.y));
  w *= 1.0 - lobes * (0.5 + 0.5 * cos(6.2831853 * 3.5 * v));
  return w * (1.0 - 0.1 * abs(fract(v * 9.0) * 2.0 - 1.0));
}
/** Which of the leaf outlines a leaf has: under 0.5 the long oval and the lobed oak (by the leaf's own number), over it the maple. */
float cardLeafForm(vec2 own) {
  return step(fract(own.x * 13.0 + own.y * 5.0), ${n(CARD.maple.share)});
}
/** The maple: five pointed lobes about a middle a little ahead of the stem's end; the rim's radius at this place and the place's own radius. */
vec2 cardMaple(vec2 q) {
  vec2 c = q - vec2(${n(CARD.maple.mid)}, 0.0);
  float r = length(c) + 1e-4;
  float a = abs(atan(c.y, c.x));
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
  }
  if (shape < ${n(SHAPE.fleck + 0.5)}) {
    float r = length(q) + 1e-4;
    float ang = atan(q.y, q.x);
    float lobes = 2.0 + floor(fract(own.x * 7.0) * 4.0);
    float rim = (0.6 + 0.2 * mix(0.3, 1.0, own.y) * sin(lobes * ang + 6.2831853 * own.x) + 0.1 * sin((lobes + 3.0) * ang + 6.2831853 * own.y)) * mix(1.0, 0.45, fract(own.y * 13.0) * abs(sin(ang + 6.2831853 * own.x)));
    return vec3(r - rim, q.x / r, q.y / r);
  }
  if (shape > ${n(SHAPE.bat - 0.5)}) {
    float tt = abs(q.y);
    q.x -= vL4.y * tt * tt;
    float lead = 0.1 + 0.24 * smoothstep(0.0, 0.4, tt) - 0.52 * pow(smoothstep(0.4, 1.0, tt), 1.4);
    float trail = -0.3 + 0.12 * tt + 0.17 * abs(sin(9.42478 * tt));
    vec3 e = q.x - lead > trail - q.x ? vec3(q.x - lead, 1.0, side * (0.05 + 0.9 * tt * tt)) : vec3(trail - q.x, -1.0, side * 0.25);
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
  }
  if (cardLeafForm(own) > 0.5) {
    vec2 m = cardMaple(q);
    vec2 c = (q - vec2(${n(CARD.maple.mid)}, 0.0)) / m.y;
    vec3 e = vec3(m.y - m.x, c.x, c.y);
    float st = max(abs(q.y) - 0.035, max(q.x - ${n(CARD.maple.mid)}, -1.0 - q.x));
    if (st < e.x) e = vec3(st, 0.0, side);
    return e;
  }
  float stem = 0.16;
  float v = clamp((u - stem) / (1.0 - stem), 0.0, 1.0);
  float w = u < stem ? 0.035 : max(cardLeafHalf(v, own), 0.035 * (1.0 - smoothstep(0.0, 0.2, v)));
  float dw = u < stem ? 0.0 : (cardLeafHalf(min(v + 0.02, 1.0), own) - cardLeafHalf(max(v - 0.02, 0.0), own)) * 12.5 / (1.0 - stem);
  vec3 e = vec3(abs(q.y) - w, -dw, side);
  float ends = abs(q.x) - 1.0;
  if (ends > e.x) e = vec3(ends, q.x < 0.0 ? -1.0 : 1.0, 0.0);
  return e;
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
  float amp = pow(min(1.0, 2.0 * area / (area + 6.2831853 * vStreak.w)), ${n(CARD.hold)});
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
  vec3 t = mix(vec3(${CARD.leafGold.map(n).join(', ')}), vec3(1.0, 1.0, 1.0), smoothstep(0.0, ${n(CARD.leafGoldShare)}, own.y));
  t = mix(t, vec3(${CARD.leafRed.map(n).join(', ')}), smoothstep(${n(CARD.leafRedFrom[0])}, ${n(CARD.leafRedFrom[1])}, own.y + 0.25 * (own.x - 0.5)));
  t *= mix(vec3(1.0), vec3(0.62, 0.5, 0.6), smoothstep(0.72, 0.9, fract(own.x * 5.0 + own.y * 3.0)));
  float out1;
  float rib;
  float fine;
  if (cardLeafForm(own) > 0.5) {
    vec2 m = cardMaple(q);
    vec2 c = q - vec2(${n(CARD.maple.mid)}, 0.0);
    float a = abs(atan(c.y, c.x));
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
  t *= mix(1.05, 0.72, smoothstep(0.35, 1.0, out1) * mix(0.4, 1.0, own.x));
  float veins = max(rib, 0.6 * fine);
  return vec4(t * (1.0 - 0.38 * veins), 1.0 - 0.6 * veins);
}
float cardLine(vec2 p, vec2 a, vec2 b, float wide, float s2, out float along) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  along = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  vec2 d = pa - ba * along;
  float v = s2 + wide * wide;
  return min(1.0, ${n(CARD.hair.seen)} * wide / sqrt(v)) * exp(-0.5 * dot(d, d) / v);
}
/** A seed: a slender stem with its grain at the foot and a tuft of fine hairs opening from its head, each hair a line in the particle's own three axes with its own length and droop; the hairs too fine to be told apart are the soft ball of the tuft. */
void cardSeed(vec2 p, int kind, vec4 k, vec4 look) {
  vec2 a = vL0.xy;
  vec2 b = vL0.zw;
  vec2 c = vL1.xy;
  float rC = max(vL4.w, 1e-3);
  float s2 = vStreak.w;
  vec2 hub = ${n(CARD.hair.hub)} * a;
  float hairs = 0.0;
  float stems = 0.0;
  float along;
  float run = smoothstep(0.5, 3.0, vStreak.z / rC);
  bool storm = uStorm.x > 0.0;
  // in the storm a head is seen for the whole shutter: its hairs are drawn at the middle of its path and fade as the path grows past the head's own size
  vec2 pp = p - vStreak.xy * (vStreak.z > 0.5 && !storm ? vStreak.z : 0.0);
  float smear = storm ? smoothstep(${n(CARD.run.seedFrom[0])}, ${n(CARD.run.seedFrom[1])}, vStreak.z / rC) : 0.0;
  float thinAt = 6.2831853 * vL3.w;
  float thinBy = ${n(CARD.hair.thin)} * vL3.y;
  vec2 lean = ${n(CARD.hair.lean)} * ((vL3.y - 0.5) * b + (vL3.w - 0.5) * c);
  for (int i = 0; i < ${CARD.hair.count}; i++) {
    float fi = float(i);
    float j1 = fract(sin(fi * 12.9898 + vL3.x * 78.233) * 43758.5453);
    float j2 = fract(j1 * 57.31 + 0.37);
    float open = acos(mix(${n(Math.cos(CARD.hair.open[0]))}, ${n(Math.cos(CARD.hair.open[1]))}, fract(fi * 0.7548777 + vL3.x)));
    float turn = 6.2831853 * (fi * 0.5698403 + vL3.w) + 0.6 * (j1 - 0.5);
    float len = mix(${n(CARD.hair.long[0])}, ${n(CARD.hair.long[1])}, j2) * (1.0 - thinBy * pow(max(cos(turn - thinAt), 0.0), 2.0));
    vec2 tip = hub + len * (cos(open) * a + sin(open) * (cos(turn) * b + sin(turn) * c)) + len * lean - ${n(CARD.hair.droop)} * len * sin(open) * (0.4 + j1) * a;
    float line = cardLine(pp, hub, tip, ${n(CARD.hair.wide)} * mix(${n(CARD.hair.restWide)}, 1.0, vL2.w) * rC * (0.8 + 0.4 * j2), s2, along);
    hairs = max(hairs, min(1.0, ${n(CARD.hair.hairSeen)} * mix(${n(CARD.hair.restSeen)}, 1.0, vL2.w) * line) * (1.0 - ${n(CARD.hair.tipFade)} * along) * (0.7 + 0.3 * j1) * ((i & 1) == 1 ? mix(${n(CARD.hair.restOdd)}, 1.0, vL2.w) : 1.0));
  }
  vec2 mid = hub + ${n(CARD.hair.ballAt)} * a + 0.5 * lean;
  float ballV = s2 + ${n(CARD.hair.ballWide * CARD.hair.ballWide)} * rC * rC;
  float ball = mix(${n(CARD.hair.ball[0])}, ${n(CARD.hair.ball[1])}, smoothstep(${n(CARD.hair.ballFrom[0])}, ${n(CARD.hair.ballFrom[1])}, sqrt(s2) / rC)) * rC * rC / ballV * ${n(CARD.hair.ballWide * CARD.hair.ballWide)} * exp(-0.5 * dot(pp - mid, pp - mid) / ballV);
  hairs = max(hairs, ball * mix(${n(CARD.hair.restBall)}, 1.0, vL2.w));
  if (storm) {
    float ts = clamp(dot(p - mid, vStreak.xy), -vStreak.z, vStreak.z);
    vec2 ds = p - mid - vStreak.xy * ts - vec2(-vStreak.y, vStreak.x) * (pointBend * (ts * ts / max(vStreak.z, 1e-3) - 0.333 * vStreak.z));
    float tuft = ${n(CARD.run.seedTuft)} * rC * rC / ballV * ${n(CARD.hair.ballWide * CARD.hair.ballWide)} * exp(-0.5 * dot(ds, ds) / ballV) / (1.0 + ${n(CARD.run.seedThin)} * vStreak.z / sqrt(ballV));
    hairs = mix(hairs, tuft, smear);
  }
  hairs = max(hairs, cardLine(pp, hub, hub, 0.07 * rC, s2, along)) * mix(1.0, ${n(CARD.hair.runHead)}, run);
  vec2 foot = -${n(CARD.hair.foot)} * mix(0.6, 1.15, vL3.w) * a - 0.25 * lean;
  stems = ${n(CARD.hair.stemSeen)} * max(cardLine(pp, foot, hub, ${n(CARD.hair.stem)} * rC, s2, along), cardLine(pp, foot, foot + 0.2 * a, ${n(CARD.hair.body)} * rC, s2, along)) * mix(1.0, ${n(CARD.hair.runHead)}, run) * (1.0 - smear);
  float trail = cardLine(p, -vStreak.xy * vStreak.z, vStreak.xy * vStreak.z, ${n(CARD.hair.runWide)} * rC, s2, along);
  if (!storm) hairs = max(hairs, run * ${n(CARD.hair.runTrail)} * trail * (0.25 + 0.75 * along));
  float cover = min(max(hairs, stems) * vCore.w * look.z, 1.0);
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  if (cover < 0.003) discard;
  if (uDiag != 0) {
    if (cover < 0.5) discard;
    vec4 part = uKindPart[kind];
    if (uDiag == ${viewCode('ids')}) gl_FragColor = vec4(part.rgb, 1.0);
    else if (uDiag == ${viewCode('standins')}) gl_FragColor = vec4(part.rgb * part.a, 1.0);
    else gl_FragColor = stageDiag(k.rgb, inverseTransformDirection(vec3(0.0, 0.0, 1.0), viewMatrix), vFog.a, uPointChange, 0.0);
    return;
  }
  vec3 light = vGrid.rgb + vDom.rgb * (${n(LIGHT_LOOK.keyFloor)} + ${n(LIGHT_LOOK.keySide * 0.45)});
  vec3 col = k.rgb * mix(vec3(1.0), vec3(${CARD.hair.stemTint.map(n).join(', ')}), stems / max(hairs + stems, 1e-4)) * light * ${n(CARD.hair.gain)};
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * uTone.z);
  gl_FragColor = vec4(col * cover, cover);
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
  float rc = (spark ? ${n(CARD.spark.core)} : ${n(CARD.glow.core)}) * r;
  float rh = (spark ? ${n(CARD.spark.halo)} : ${n(CARD.glow.halo)}) * r;
  float rw = ${n(CARD.glow.wide)} * r;
  float vc = rc * rc + vStreak.w;
  float vh = rh * rh + vStreak.w;
  float vw = rw * rw + vStreak.w;
  float core = rc * rc / vc / (1.0 + 0.8 * vStreak.z / sqrt(vc)) * exp(-0.5 * d2 / vc) * fade;
  float sg = sqrt(vStreak.w);
  float disc = smoothstep(${n(CARD.glow.discFrom[0])}, ${n(CARD.glow.discFrom[1])}, sg / max(rc, 0.6));
  if (disc > 0.0) {
    float rd = ${n(CARD.glow.discWide)} * sg;
    float dd = sqrt(d2);
    float face = (1.0 - smoothstep(rd - 0.12 * rd - 0.6, rd + 0.6, dd)) * (1.0 - (spark ? ${n(CARD.spark.discRim)} : ${n(CARD.glow.discRim)}) * (1.0 - smoothstep(0.45 * rd, rd, dd)));
    core = mix(core, pow(rc * rc / vc, spark ? ${n(CARD.spark.discHold)} : ${n(CARD.glow.discHold)}) * face, disc);
  }
  float halo = (spark ? ${n(CARD.spark.haloShare)} : ${n(CARD.glow.haloShare)}) * rh * rh / vh / (1.0 + 0.8 * vStreak.z / sqrt(vh)) * exp(-0.5 * d2 / vh);
  float wide = spark ? 0.0 : ${n(CARD.glow.wideShare)} * rw * rw / vw * exp(-0.5 * d2 / vw);
  float lum = vCore.w * (core + halo + wide) * (spark ? ${n(CARD.spark.gain)} : 1.0);
  float cover = min(vCore.w * core * ${n(CARD.glow.hide)} * (1.0 - disc), 1.0);
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  if (lum < 0.002) discard;
  if (uDiag != 0) {
    if (vCore.w * core < 0.25) discard;
    vec4 part = uKindPart[kind];
    if (uDiag == ${viewCode('ids')}) gl_FragColor = vec4(part.rgb, 1.0);
    else if (uDiag == ${viewCode('standins')}) gl_FragColor = vec4(part.rgb * part.a, 1.0);
    else gl_FragColor = stageDiag(k.rgb, inverseTransformDirection(vec3(0.0, 0.0, 1.0), viewMatrix), vFog.a, uPointChange, 0.0);
    return;
  }
  vec3 tint = mix(k.rgb, vec3(1.0, 1.0, 0.86), 0.65 * (1.0 - disc) * core / max(core + halo + wide, 1e-4));
  if (spark) {
    float part = vL3.z / 6.2831853;
    float sharp = 1.0 - smoothstep(${n(CARD.spark.hotFrom[0])}, ${n(CARD.spark.hotFrom[1])}, sg / max(rc, 0.6));
    tint = mix(k.rgb, vec3(${CARD.spark.dying.map(n).join(', ')}), smoothstep(0.55, 1.0, part));
    tint = mix(tint, vec3(${CARD.spark.hot.map(n).join(', ')}), ${n(CARD.spark.hotCore)} * sharp * (1.0 - disc) * exp(-0.5 * d2 / (${n(CARD.spark.hotWide)} * vc)) * (1.0 - 0.7 * part));
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
  float wide = vL4.w;
  float v = vStreak.w + wide * wide;
  float line = min(1.0, ${n(CARD.hair.seen)} * wide / sqrt(v)) * exp(-0.5 * (off * off + past * past) / v);
  float sc = clamp(s, -1.0, 1.0);
  float lit = line * (uStorm.x > 0.0 && look.x > ${n(STORM_OWN_PATH_FROM)} ? 1.0 : mix(${n(CARD.line.tail)}, 1.0, smoothstep(-1.0, 0.7, sc)));
  bool seedy = look.x > ${n(SHAPE.seed - 0.5)};
  float headW = 0.0;
  float seen = vCore.w * look.z;
  float cover = min(lit * seen, 1.0);
  if (vL4.z > 0.0) {
    vec2 hd = p - vStreak.xy * lg;
    if (seedy) {
      vec2 back = -vStreak.xy;
      float rr = length(hd);
      float gap = ${n((2 * CARD.line.fanSpread) / CARD.line.fanHairs)};
      float ua = atan(back.x * hd.y - back.y * hd.x, dot(back, hd)) / gap;
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
  if (cover < 0.003) discard;
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
  light *= min(1.0, ${n(CARD.litMost)} / max(max(light.r, max(light.g, light.b)), 1e-3));
  if (leafy) light = mix(vec3(max(light.r, max(light.g, light.b))), light, ${n(CARD.leafHue)});
  vec3 body = leafy ? mix(k.rgb * vec3(${CARD.line.leafLow.map(n).join(', ')}), vec3(${CARD.line.leafHigh.map(n).join(', ')}), pow(vL4.y, uStorm.x > 0.0 ? ${n(CARD.line.shutPale)} : ${n(CARD.line.leafPale)})) : mix(k.rgb, vec3(1.0), mix(${n(CARD.line.pale[0])}, ${n(CARD.line.pale[1])}, vL4.y));
  vec3 col = body * light * (seedy ? ${n(CARD.line.seedGain)} : ${n(CARD.line.gain)});
  if (headW > 0.0) {
    vec3 own = look.x > ${n(SHAPE.leaf - 0.5)} ? mix(k.rgb * vec3(${CARD.line.leafHead[0].map(n).join(', ')}), vec3(${CARD.line.leafHead[1].map(n).join(', ')}), step(${n(CARD.line.leafWhite)}, vL3.w)) : k.rgb * mix(vec3(${CARD.line.petalHead[0].map(n).join(', ')}), vec3(${CARD.line.petalHead[1].map(n).join(', ')}), step(${n(CARD.line.petalWhite)}, vL3.w));
    col = mix(col, own * light * ${n(CARD.line.headGain)}, headW / max(cover, 1e-3));
  }
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * uTone.z);
  gl_FragColor = vec4(col * cover, cover);
}
void cardMain(vec2 p, int kind, vec4 k, vec4 look, float lying) {
  float shape = look.x;
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
  light *= min(1.0, ${n(CARD.litMost)} / max(max(light.r, max(light.g, light.b)), 1e-3));
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
    col *= min(1.0, ${n(CARD.leafMost)} / max(max(col.r, max(col.g, col.b)), 1e-3));
    col += ${n(CARD.leafSheen)} * pow(max(dot(nv, normalize(keyV + vec3(0.0, 0.0, 1.0))), 0.0), 26.0) * vDom.rgb * (1.0 - lying);
  }
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * mix(uTone.z, ${n(CARD.lieVeil)}, lying));
  if (shape > ${n(SHAPE.bat - 0.5)}) col += (tint.r - 1.0) * vec3(${CARD.batGlow.map(n).join(', ')}) * (vGrid.rgb + vDom.rgb);
  gl_FragColor = vec4(col * cover, cover);
}
`
