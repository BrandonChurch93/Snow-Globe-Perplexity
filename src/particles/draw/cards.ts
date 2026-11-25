import { viewCode } from '../../diagnostics/views'
import { CARD, LENS_LOOK, LIGHT_LOOK, LIT_MOST, MAX_KINDS, PIXEL_SIGMA2, SHAPE } from './looks'

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
    float whole = way.z < 0.5 || u5 < max(way.x, way.y) || own > ${n(1 - CARD.chosen)} ? 1.0 : 0.0;
    float keepC = mix(afloat * gustC * mix(${n(CARD.dabKeep[0])}, ${n(CARD.dabKeep[1])}, smoothstep(${n(1 - CARD.chosen - CARD.dabShare - 0.02)}, ${n(1 - CARD.chosen - CARD.dabShare)}, own)), 1.0, whole);
    if (${at(SHAPE.spark)}) keepC = mix(${n(CARD.sparkKeep[0])}, ${n(CARD.sparkKeep[1])}, pow(own, ${n(CARD.sparkSkew)}));
    if (${at(SHAPE.fleck)}) keepC = mix(${n(CARD.fleckKeep[0])}, ${n(CARD.fleckKeep[1])}, pow(own, ${n(CARD.fleckSkew)}));
    rC *= mix(${n(CARD.dabSize)}, 1.0, whole);
    float ph = aData.w;
    float yaw = 6.2831853 * h.x + ${n(CARD.yawSway)} * sin(ph + 6.2831853 * h2.x) * afloat;
    float rock = mix(${at(SHAPE.petal)} ? ${n(CARD.petalRock)} : (${at(SHAPE.leaf)} ? ${n(CARD.leafRock)} : ${n(CARD.fleckRock)}), ${n(CARD.stormRock)}, gustC);
    float r1 = rock * sin(ph + 6.2831853 * h.y);
    float r2 = 0.6 * rock * sin(2.0 * ph + 6.2831853 * h.z);
    if (${at(SHAPE.leaf)}) r1 = ph + 6.2831853 * h.y;
    if (${at(SHAPE.seed)}) {
      rock = mix(${n(CARD.seedRock)}, ${n(CARD.stormRock)}, gustC);
      r1 = rock * sin(ph + 6.2831853 * h.y) + (aState > 0.5 ? 2.6 : ${n(CARD.seedTilt)}) * tilt.x;
      r2 = 0.6 * rock * sin(2.0 * ph + 6.2831853 * h.z) + (aState > 0.5 ? 2.6 : ${n(CARD.seedTilt)}) * tilt.y;
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
    if (shape > ${n(SHAPE.bat - 0.5)}) bends = vec3(0.0, ${n(CARD.batFlap)} * sin(ph), 0.0);
    if (${at(SHAPE.petal)}) bends = vec3(${n(CARD.petalCup[0])}, ${n(CARD.petalCup[1])}, 0.0) * mix(0.6, 1.4, h2.z) * mix(1.0, ${n(CARD.lieFlat)}, lying);
    if (${at(SHAPE.leaf)}) bends = vec3(${n(CARD.leafCurl[0])} * (h2.z * 2.0 - 0.6), ${n(CARD.leafCurl[1])} * mix(0.3, 1.0, h2.w), ${n(CARD.leafCurl[2])} * (h2.y * 2.0 - 1.0));
    vec3 uV = toView * cU;
    vec3 vV = toView * cV;
    vec3 nV = toView * cN;
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
    stC *= uLimit.x / (uLimit.x + length(stC));
    float hlC = 0.5 * length(stC);
    vec2 alC = hlC > 1e-4 ? stC / (2.0 * hlC) : vec2(1.0, 0.0);
    float sgC = 0.5 * uBlur.z * (1.0 - exp(-(coc > 0.0 ? coc * uBlur.x : -coc * uBlur.y) / uBlur.z)) * afloat;
    float s2C = sgC * sgC + ${n(PIXEL_SIGMA2)} * uPoint.w * uPoint.w;
    float reachC = (${n(CARD.bound)} + abs(bends.x) + abs(bends.y)) * rC + 2.2 * sqrt(s2C) + 1.0;
    if (shape > ${n(SHAPE.light - 0.5)} && shape < ${n(SHAPE.spark + 0.5)}) reachC = ${n(CARD.glow.wide)} * 2.2 * rC + 2.6 * sqrt(s2C) + 1.0;
    vec2 extC = min(vec2(reachC) + 1.05 * hlC * abs(alC), vec2(uLimit.y));
    alpha = aData.z * rim * mix(1.0, mix(${n(LENS_LOOK.farDim)}, 1.0, smoothstep(${n(LENS_LOOK.farDimFrom)}, ${n(LENS_LOOK.farDimTo)}, depth)), afloat) * keepC;
    if (${at(SHAPE.light)}) alpha *= mix(${n(CARD.glow.blinkLow)}, 1.0, pow(0.5 + 0.5 * sin(ph + 6.2831853 * h.y), 3.0));
    if (alpha < 0.003) extC = vec2(0.0);
    vL0 = vec4(ca, cb);
    vL1 = vec4(nV.xy * rC, uV.z, vV.z);
    vL2 = vec4(nV, gustC);
    vL3 = vec4(h2.x, fract(h.w * 37.0), ph, fract(h.z * 61.0));
    vL4 = vec4(bends, rC);
    vStreak = vec4(alC, hlC, s2C);
    vKind = vec4(aData.y, 2.0 * lying + 0.5, float(pid & 4095u) + 0.01 + 0.98 * gustC, 0.0);
    vGrid = vec4(base0 * min(1.0, ${n(LIT_MOST)} / max(max(base0.r, max(base0.g, base0.b)), 1e-3)), 0.0);
    vDom = vec4(keyIn * uRigPoint.x, 0.0);
    clip = clipC;
    #ifdef POINT_SPRITES
    float sideC = 2.0 * max(extC.x, extC.y);
    gl_PointSize = sideC;
    vCore = vec4(sideC, reachC, 1.0, alpha);
    #else
    vec2 offC = position.xy * extC;
    vCore = vec4(offC, 1.0, alpha);
    clip.xy += offC * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * (clip.w / uPoint.y);
    #endif
    vec4 nearC = projectionMatrix * vec4(view.xy, view.z + min(1.2 * rC * zImg / (uPoint.y * mag), ${n(LENS_LOOK.liftMostMm)}), 1.0);
    clip.z = nearC.z / nearC.w * clip.w;
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
    float rim = 0.62 + 0.2 * sin(3.0 * ang + 6.2831853 * own.x) + 0.12 * sin(5.0 * ang + 6.2831853 * own.y);
    return vec3(r - rim, q.x / r, q.y / r);
  }
  if (shape > ${n(SHAPE.bat - 0.5)}) {
    float tt = abs(q.y);
    float lead = 0.3 - 0.05 * tt - 0.3 * tt * tt * tt;
    float trail = -0.3 + 0.25 * tt + 0.15 * abs(sin(7.85398 * tt));
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
  float stem = 0.16;
  float v = clamp((u - stem) / (1.0 - stem), 0.0, 1.0);
  float w = u < stem ? 0.035 : max(cardLeafHalf(v, own), 0.035 * (1.0 - smoothstep(0.0, 0.2, v)));
  float dw = u < stem ? 0.0 : (cardLeafHalf(min(v + 0.02, 1.0), own) - cardLeafHalf(max(v - 0.02, 0.0), own)) * 12.5 / (1.0 - stem);
  vec3 e = vec3(abs(q.y) - w, -dw, side);
  float ends = abs(q.x) - 1.0;
  if (ends > e.x) e = vec3(ends, q.x < 0.0 ? -1.0 : 1.0, 0.0);
  return e;
}
vec2 cardSolve(vec2 p, vec2 a, vec2 b, float inv) {
  vec2 q = vec2(p.x * b.y - p.y * b.x, a.x * p.y - a.y * p.x) * inv;
  for (int i = 0; i < 2; i++) {
    vec2 qc = clamp(q, -1.2, 1.2);
    vec2 pp = p - vL1.xy * (vL4.x * qc.x * qc.x + vL4.y * qc.y * qc.y + vL4.z * qc.x * qc.y);
    q = vec2(pp.x * b.y - pp.y * b.x, a.x * pp.y - a.y * pp.x) * inv;
  }
  return q;
}
float cardTap(float shape, vec2 p, vec2 a, vec2 b, float inv, float wide, inout vec2 qSum) {
  vec2 q = cardSolve(p, a, b, inv);
  vec3 e = cardEdge(shape, q, vL3.xy);
  vec2 grow = (e.y * vec2(b.y, -b.x) + e.z * vec2(-a.y, a.x)) * inv;
  float c = clamp(0.5 - 0.5 * e.x / (max(length(grow), 1e-4) * wide), 0.0, 1.0);
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
  vec2 qSum = vec2(0.0);
  float cov = 0.0;
  if (vStreak.z > 0.25) {
    vec2 q0 = vec2(p.x * b.y - p.y * b.x, a.x * p.y - a.y * p.x) * inv;
    vec2 dq = vec2(vStreak.x * b.y - vStreak.y * b.x, a.x * vStreak.y - a.y * vStreak.x) * inv;
    float bound = ${n(CARD.bound)} + abs(vL4.x) + abs(vL4.y) + wide * abs(inv) * max(length(a), length(b));
    float qa = dot(dq, dq);
    float qb = dot(q0, dq);
    float disc = qb * qb - qa * (dot(q0, q0) - bound * bound);
    if (disc > 0.0) {
      float root = sqrt(disc);
      float t0 = max((qb - root) / qa, -vStreak.z);
      float t1 = min((qb + root) / qa, vStreak.z);
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
    vec3 t = mix(vec3(0.82, 0.5, 0.62), vec3(1.0), smoothstep(0.0, 0.6, u)) * mix(vec3(1.0, 0.6, 0.74), vec3(1.0, 1.28, 1.2), pow(own.y, 1.5));
    t *= 1.0 - 0.12 * exp(-q.y * q.y * 70.0) * (1.0 - u);
    return vec4(t, 1.0);
  }
  if (shape < ${n(SHAPE.fleck + 0.5)}) return vec4(vec3(mix(0.7, 1.15, own.y)), 0.4);
  if (shape > ${n(SHAPE.bat - 0.5)}) return vec4(vec3(1.0 + 1.5 * smoothstep(0.12, 0.9, abs(q.y))), 0.35 * smoothstep(0.12, 0.5, abs(q.y)));
  float stem = 0.16;
  float v = clamp((u - stem) / (1.0 - stem), 0.0, 1.0);
  vec3 t = mix(vec3(1.22, 1.18, 0.6), vec3(0.72, 0.36, 0.3), smoothstep(0.1, 0.95, own.y + 0.25 * (own.x - 0.5)));
  float w = max(cardLeafHalf(v, own), 1e-3);
  float out1 = abs(q.y) / w;
  t *= mix(1.05, 0.72, smoothstep(0.35, 1.0, out1) * mix(0.4, 1.0, own.x));
  float rib = exp(-q.y * q.y * 900.0);
  float ribs = fract(v * 6.5 - abs(q.y) * 2.4);
  float fine = smoothstep(0.1, 0.0, abs(ribs - 0.5)) * (1.0 - smoothstep(0.75, 1.0, out1));
  float veins = max(rib, 0.6 * fine);
  if (u < stem) return vec4(vec3(0.5, 0.36, 0.26), 0.0);
  return vec4(t * (1.0 - 0.38 * veins), 1.0 - 0.6 * veins);
}
float cardLine(vec2 p, vec2 a, vec2 b, float wide, float s2, out float along) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  along = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  vec2 d = pa - ba * along;
  float v = s2 + wide * wide;
  return min(1.0, 1.6 * wide / sqrt(v)) * exp(-0.5 * dot(d, d) / v);
}
/** A seed: a thin stem with its grain at the foot and two rings of hairs opening from its head, each a line in the particle's own three axes. */
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
  vec2 pp = p - vStreak.xy * (vStreak.z > 0.5 ? vStreak.z : 0.0);
  for (int i = 0; i < ${CARD.hair.ringA[0] + CARD.hair.ringB[0] + CARD.hair.ringC[0]}; i++) {
    vec3 ring = i < ${CARD.hair.ringA[0]} ? vec3(${CARD.hair.ringA.map(n).join(', ')}) : (i < ${CARD.hair.ringA[0] + CARD.hair.ringB[0]} ? vec3(${CARD.hair.ringB.map(n).join(', ')}) : vec3(${CARD.hair.ringC.map(n).join(', ')}));
    float open = ring.y;
    float turn = 6.2831853 * (vL3.x + (float(i) + 0.37 * ring.x) / ring.x);
    vec2 tip = hub + ring.z * (cos(open) * a + sin(open) * (cos(turn) * b + sin(turn) * c));
    float line = cardLine(pp, hub, tip, ${n(CARD.hair.wide)} * rC, s2, along);
    hairs = max(hairs, line * (1.0 - 0.55 * along));
  }
  hairs = max(hairs, cardLine(pp, hub, hub, 0.09 * rC, s2, along)) * mix(1.0, ${n(CARD.hair.runHead)}, run);
  stems = max(cardLine(pp, -a, hub, ${n(CARD.hair.stem)} * rC, s2, along), cardLine(pp, -a, -0.74 * a, ${n(CARD.hair.body)} * rC, s2, along)) * mix(1.0, ${n(CARD.hair.runHead)}, run);
  float trail = cardLine(p, -vStreak.xy * vStreak.z, vStreak.xy * vStreak.z, ${n(CARD.hair.runWide)} * rC, s2, along);
  hairs = max(hairs, run * ${n(CARD.hair.runTrail)} * trail * (0.25 + 0.75 * along));
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
  vec3 col = k.rgb * mix(vec3(1.0), vec3(0.5, 0.38, 0.26), stems / max(hairs + stems, 1e-4)) * light;
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * uTone.z);
  gl_FragColor = vec4(col * cover, cover);
}
/** A light (a firefly) or a spark (an ember): a hot core in a glow, drawn along its path through the shutter. Its light is added, and its core hides a little of what is behind. */
void cardGlow(vec2 p, int kind, vec4 k, vec4 look) {
  bool spark = look.x > ${n(SHAPE.spark - 0.5)};
  float r = max(vL4.w, 1e-3);
  float reachLong = vStreak.z + (spark ? ${n(CARD.spark.tail)} * r : 0.0);
  float t = clamp(dot(p, vStreak.xy), -reachLong, vStreak.z);
  vec2 d = p - vStreak.xy * t;
  float d2 = dot(d, d);
  float fade = spark ? 1.0 - 0.75 * clamp((-t - vStreak.z) / max(${n(CARD.spark.tail)} * r, 1e-3) + 0.3, 0.0, 1.0) : 1.0;
  float rc = (spark ? ${n(CARD.spark.core)} : ${n(CARD.glow.core)}) * r;
  float rh = (spark ? ${n(CARD.spark.halo)} : ${n(CARD.glow.halo)}) * r;
  float rw = ${n(CARD.glow.wide)} * r;
  float vc = rc * rc + vStreak.w;
  float vh = rh * rh + vStreak.w;
  float vw = rw * rw + vStreak.w;
  float core = rc * rc / vc / (1.0 + 0.8 * vStreak.z / sqrt(vc)) * exp(-0.5 * d2 / vc) * fade;
  float halo = (spark ? ${n(CARD.spark.haloShare)} : ${n(CARD.glow.haloShare)}) * rh * rh / vh / (1.0 + 0.8 * vStreak.z / sqrt(vh)) * exp(-0.5 * d2 / vh);
  float wide = spark ? 0.0 : ${n(CARD.glow.wideShare)} * rw * rw / vw * exp(-0.5 * d2 / vw);
  float lum = vCore.w * (core + halo + wide);
  float cover = min(vCore.w * core * ${n(CARD.glow.hide)}, 1.0);
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
  vec3 tint = mix(k.rgb, vec3(1.0, 1.0, 0.86), 0.65 * core / max(core + halo + wide, 1e-4));
  if (spark) {
    float part = vL3.z / 6.2831853;
    tint = mix(mix(vec3(${CARD.spark.hot.map(n).join(', ')}), k.rgb, smoothstep(0.0, 0.4, part)), vec3(${CARD.spark.dying.map(n).join(', ')}), smoothstep(0.55, 1.0, part));
    tint = mix(tint, vec3(${CARD.spark.hot.map(n).join(', ')}), 0.5 * core / max(core + halo, 1e-4) * (1.0 - part));
  }
  vec3 col = tint * (k.a * lum) * (1.0 - vFog.a * uTone.z);
  gl_FragColor = vec4(col, cover);
}
void cardMain(vec2 p, int kind, vec4 k, vec4 look, float lying) {
  float shape = look.x;
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
  float keyShare = mix(${n(LIGHT_LOOK.keyFloor)} + ${n(LIGHT_LOOK.keySide)} * front * front, stageWrap(nk, uRigInside.z) * 0.31831 / max(uRigPoint.x, 1e-3), lying);
  vec3 light = vGrid.rgb * (1.0 + ${n(LIGHT_LOOK.skyTilt)} * dot(nv, upV)) + vDom.rgb * keyShare;
  light *= min(1.0, ${n(CARD.litMost)} / max(max(light.r, max(light.g, light.b)), 1e-3));
  vec3 body = k.rgb * tint.rgb;
  vec3 col = body * light * mix(1.0, ${n(CARD.lieShade)}, lying);
  col += body * body * vDom.rgb * (${n(LIGHT_LOOK.keySide)} * back * back * (1.0 - lying));
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * mix(uTone.z, 1.0, lying));
  gl_FragColor = vec4(col * cover, cover);
}
`
