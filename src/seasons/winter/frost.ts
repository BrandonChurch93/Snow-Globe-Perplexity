import * as THREE from 'three'
import { config } from '../../config'
import { stageShader, stageUniforms } from '../../core/materials'
import { resolveBehind } from '../../core/accumulator'
import { geometry, prepareModel } from '../../core/models'
import { texture } from '../../core/textures'
import { setGlass, shellUniforms } from '../../globe/shell'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { SLAB_LIGHT_GLSL, slabLightUniforms, surfaceUniforms } from '../../scene/surface'
import type { KitMoment } from '../kit'
import { season } from './base'

const MODEL = `${season}/frost-shapes.glb`
const GLASS_MAP = `${season}/frost-glass.lin.w2048.png`
const SLAB_MAP = `${season}/frost-slab.lin.w2048.png`
const GRAIN_MAP = `${season}/frost-grain.lin.tile.png`
const GLASS_PART = `glass-dressing-${season}`
const SLAB_PART = `surface-dressing-${season}`
const RS = config.globe.sphereDiameterMm / 2
const RAD = Math.PI / 180

export const FULL = 2

setGlass(season, { ringThin: 0.5, topLine: 0.4, windowSoftDeg: 0, windowGrain: 0, arcs: 1.2, arcTint: [1, 0.8, 0.58], arcCool: 2, strip: 0.6 })

const look = {
  glass: { cover: 1.72, haze: 1.38, slope: 0.55, micro: 1.1, glint: 2.6, light: 0.96, through: 2.4, thin: 0.3, thick: 1.1, blur: 0.012, bend: 0.012, scatter: 0.06, room: 0.5, soften: 0.12, rimMu: 0.3, faceOn: 0.65, front: 1.9, sugarMm: 0.3, gritty: 0.45, clear: [0.255, 0.28, 0.8] },
  slab: { cover: 2.2, film: 1.7, slope: 1.6, micro: 1.2, glint: 1.1, pool: 0.5, poolBack: 0.12, poolThick: 0.9, skyCut: 0.55, gainFar: 0.9, gainKey: 1.38, gainFront: 0.5, grey: 0.85, light: 2.95, wrap: 0.3, broad: 1.4, shade: 0.35, edge: 0.6, ball: 0.3, rim: 0.55, sky: 1.3, sugarMm: 0.34, clotMm: 1.15, room: 0.1, lace: 0.3, gritty: 0.5, leftBack: 2.0, leftMid: 0.42, leftSkyCut: 0.5, leftWarm: 0.22, leftFrontCut: 0.5, leftHeap: 0.62, leftHeapCut: 0.12, leftHeapSky: 0.6, heapGlint: 0.4, wet: 0.6, focusMm: 35, far: [40, 110], near: [28, 75], farMips: 3.0, nearMips: 3.2, shadeGlint: 0.85, lumpMm: 3.2, lump: 0.5, lumpSheet: 0.16, frontLag: 0.5, frontMm: 80, frontEnd: [0.3, 0.8] },
}
const SNOW = { thin: [0.6, 0.68, 0.8], thick: [0.92, 0.955, 0.99], body: [0.9, 0.93, 0.98] }
const vec = (v: number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`

const frostUniforms = {
  uGlassMap: { value: null as THREE.Texture | null },
  uSlabMap: { value: null as THREE.Texture | null },
  uGrain: { value: null as THREE.Texture | null },
  uGrow: { value: new THREE.Vector4(FULL, FULL, 1, 1) },
  uTouch: { value: new THREE.Vector4(0, 0, 0, 0) },
  uShape: { value: new THREE.Vector4(1, 1, 1, 1) },
  uField: { value: new THREE.Vector4(1, 1, 1, 1) },
  uGlassLook: { value: new THREE.Vector4(look.glass.cover, look.glass.haze, look.glass.slope, look.glass.micro) },
  uSlabLook: { value: new THREE.Vector4(look.slab.cover, look.slab.pool, look.slab.slope, look.slab.micro) },
  uGlint: { value: new THREE.Vector4(look.glass.glint, look.slab.glint, 0.3, look.glass.light) },
  uGlassThru: { value: new THREE.Vector4(look.glass.through, look.glass.thin, look.glass.thick, 0) },
}

export const behindUniforms = {
  uBehind: { value: null as THREE.Texture | null },
  uBehindSize: { value: new THREE.Vector2(0, 0) },
}

const lightUniforms = {
  uKeyDir: shellUniforms.uKeyDir,
  uKeyCol: shellUniforms.uKeyCol,
  uRimDir: shellUniforms.uRimDir,
  uRimCol: shellUniforms.uRimCol,
  uSky: surfaceUniforms.uSky,
}

const FROST_GLSL = `
${ROOM_GLSL}
uniform sampler2D uGrain;
uniform vec4 uGrow;
uniform vec4 uGlint;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uSky;
const float FROST_SOFT = 0.05;
const float FROST_START = 0.07;
float frostRnd(vec2 cell, float k) {
  return stageHash(vec3(cell + 8192.0, k));
}
// The leaving, inside the shake: the bloom's light crosses the frost outward from the foot and the frost goes with it. keep runs
// from 1 to 0. A texel goes when the front reaches its own place on the way out (t, its time of arrival in the map: the same
// order in which it grew), sooner where it is thin and the grain under it is low, so what is left ends in ragged crystals and
// never in a line; nothing is whole on one frame and gone on the next, and what the front leaves behind breaks into crumbs.
const float FROST_FRONT = 0.6;
float frostStay(float keep, float h, float grain, float t) {
  return keep >= 1.0 ? 1.0 : smoothstep(0.0, 0.1, FROST_FRONT * min(t, 1.0) + (1.0 - FROST_FRONT) * (0.62 * h + 0.38 * grain) + 0.1 - (1.0 - keep) * 1.2);
}
float frostCrumb(float keep, float fine) {
  return keep >= 1.0 ? 0.0 : smoothstep(0.0, 0.06, fine - mix(0.97, 0.7, keep)) * smoothstep(0.0, 0.15, keep);
}
bool frostHidden(float keep) {
  return keep <= 0.0;
}
float frostLattice(vec3 i, float k) {
  return stageHash(vec3(i.xz + 8192.0, (i.y + 64.0) * 0.015625 + k));
}
float frostValue(vec3 p, float k) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(frostLattice(i, k), frostLattice(i + vec3(1.0, 0.0, 0.0), k), f.x);
  float b = mix(frostLattice(i + vec3(0.0, 0.0, 1.0), k), frostLattice(i + vec3(1.0, 0.0, 1.0), k), f.x);
  float c = mix(frostLattice(i + vec3(0.0, 1.0, 0.0), k), frostLattice(i + vec3(1.0, 1.0, 0.0), k), f.x);
  float d = mix(frostLattice(i + vec3(0.0, 1.0, 1.0), k), frostLattice(i + vec3(1.0, 1.0, 1.0), k), f.x);
  return mix(mix(a, b, f.z), mix(c, d, f.z), f.y);
}
float frostSugar(vec3 p, float pxMm, float base, float k) {
  float lod = log2(max(pxMm * 1.6 / base, 1.0));
  float l0 = floor(lod);
  float size = base * exp2(l0);
  return mix(frostValue(p / size, k + 0.03 * l0), frostValue(p / (2.0 * size), k + 0.03 * (l0 + 1.0)), lod - l0);
}
vec3 frostGlintLayer(vec2 q, float size, float k, vec3 n, vec3 v, float room) {
  vec2 g = q / size;
  vec2 cell = floor(g);
  vec2 at = 0.3 + 0.4 * vec2(frostRnd(cell, k), frostRnd(cell, k + 0.013));
  float spot = 1.0 - smoothstep(0.08, 0.34, length(g - cell - at));
  if (spot <= 0.0) return vec3(0.0);
  vec3 tu = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 tv = cross(n, tu);
  float a = 6.2831853 * frostRnd(cell, k + 0.029);
  float t = 0.97 * sqrt(frostRnd(cell, k + 0.041));
  vec3 m = normalize(n * sqrt(1.0 - t * t) + t * (cos(a) * tu + sin(a) * tv));
  vec3 r = reflect(v, m);
  float bright = frostRnd(cell, k + 0.057);
  bright = 0.2 + 3.2 * bright * bright * bright;
  vec3 light = uKeyCol * (2.4 * smoothstep(0.95, 0.992, dot(r, uKeyDir)));
  light += uRimCol * (3.2 * smoothstep(0.955, 0.994, dot(r, uRimDir)));
  light += stageRoomLights(r, 0.012) * room;
  return light * (spot * bright);
}
vec3 frostGlints(vec2 q, float pxMm, vec3 n, vec3 v, float room) {
  float lod = log2(max(pxMm * 1.7 / uGlint.z, 1.0));
  float l0 = floor(lod);
  float f = lod - l0;
  float size = uGlint.z * exp2(l0);
  return frostGlintLayer(q, size, 0.11 + 0.07 * l0, n, v, room) * (1.0 - f) + frostGlintLayer(q, size * 2.0, 0.18 + 0.07 * l0, n, v, room) * f;
}
`

const GLASS = `
${FROST_GLSL}
uniform sampler2D uGlassMap;
uniform vec4 uShape;
uniform vec4 uGlassLook;
uniform vec4 uGlassThru;
uniform sampler2D uBehind;
uniform vec2 uBehindSize;
varying vec3 vAxisX;
varying vec3 vAxisY;
varying vec3 vAxisZ;
// One tap of what lies behind the frost. A value that is not a number there (another part's pixel) must not be smeared over
// the frost by the blur, so such a tap counts as black; the pixel itself stays as it is for the measure to find.
vec3 frostTap(vec2 at) {
  vec3 c = textureLod(uBehind, at, 0.0).rgb;
  return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : c;
}
vec3 frostBehind(vec2 uv, float thickness, vec2 slope) {
  vec2 px = 1.0 / uBehindSize;
  vec2 at = uv + slope * (thickness * ${look.glass.bend.toFixed(4)} * uBehindSize.y) * px;
  float r = thickness * ${look.glass.blur.toFixed(4)} * uBehindSize.y;
  vec3 sum = frostTap(at);
  float total = 1.0;
  for (int i = 1; i <= 12; i++) {
    float fi = float(i);
    float a = fi * 2.3999632;
    float k = sqrt(fi / 12.0);
    float w = 1.0 - 0.5 * k;
    sum += frostTap(at + vec2(cos(a), sin(a)) * (k * r) * px) * w;
    total += w;
  }
  return sum / total;
}
void main() {
  // The frost on the glass goes and comes by its cover, evenly, and not as a stipple: the app draws one sample a frame, and a
  // stipple there stands as single dark pixels along the rim. It is laid over what is behind it with its colour already times
  // its cover, so the picture times the share that stays is the mean of a film frame's samples that kept it and dropped it.
  float c = stageChange();
  float seen = (uState.w > 1.5 ? 1.0 - c : uState.w > 0.5 ? c : 1.0) * uFlags.w;
  if (seen <= 0.0) discard;
  if (frostHidden(uGrow.z)) discard;
  vec3 d = normalize(vStageLocal);
  float ct = clamp(d.z, -0.999, 0.999);
  float st = sqrt(1.0 - ct * ct);
  float th = acos(ct);
  vec2 e2 = d.xy / st;
  vec2 t2 = vec2(-e2.y, e2.x);
  vec2 uv = 0.5 + 0.5 * (th / uShape.x) * e2;
  float merc = 0.5 * (log(1.0 - ct) - log(1.0 + ct));
  vec2 ga = vec2(atan(d.x, d.y), merc);
  vec2 gb = vec2(atan(-d.x, -d.y), merc);
  float gs = uShape.w / 6.2831853;
  vec2 gdx = (d.y > 0.0 ? dFdx(ga) : dFdx(gb)) * gs;
  vec2 gdy = (d.y > 0.0 ? dFdy(ga) : dFdy(gb)) * gs;
  vec3 grain = textureGrad(uGrain, ga * gs, gdx, gdy).rgb;
  vec3 fine = textureGrad(uGrain, ga * gs * 3.0 + 0.37, gdx * 3.0, gdy * 3.0).rgb;
  float fw = max(length(dFdx(uv)), length(dFdy(uv)));
  float e = max(fw, uShape.y) * 1.2;
  float lvl = uGrow.x - FROST_START + (grain.r - 0.33) * 0.07 + (fine.r - 0.33) * 0.03;
  vec3 m0 = texture(uGlassMap, uv, -0.6).rgb;
  vec3 m1 = texture(uGlassMap, uv + e2 * e, -0.6).rgb;
  vec3 m2 = texture(uGlassMap, uv + t2 * e, -0.6).rgb;
  vec3 ms = texture(uGlassMap, uv, 1.4).rgb;
  vec3 mb = texture(uGlassMap, uv, 3.0).rgb;
  float crumb = frostCrumb(uGrow.z, fine.r);
  float on = smoothstep(0.0, FROST_SOFT, lvl - m0.g) * max(frostStay(uGrow.z, m0.r, grain.r, m0.g), crumb);
  float h0 = m0.r * on;
  float hs = ms.r * smoothstep(0.0, 1.5 * FROST_SOFT, lvl - ms.g + 0.02) * frostStay(uGrow.z, ms.r, grain.r, ms.g);
  float h1 = m1.r * smoothstep(0.0, FROST_SOFT, lvl - m1.g) * max(frostStay(uGrow.z, m1.r, grain.r, m1.g), crumb);
  float h2 = m2.r * smoothstep(0.0, FROST_SOFT, lvl - m2.g) * max(frostStay(uGrow.z, m2.r, grain.r, m2.g), crumb);
  float haze = mb.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - mb.g + 0.04) * frostStay(uGrow.z, 0.5 * mb.r, grain.r, mb.g);
  vec2 sxy = vStageLocal.xy;
  float pxS = max(sqrt(length(dFdx(sxy)) * length(dFdy(sxy))), 0.02);
  float sugar = smoothstep(0.28, 0.72, frostSugar(vec3(sxy.x, d.z > 0.0 ? 0.0 : 40.0, sxy.y), pxS, ${look.glass.sugarMm.toFixed(3)}, 0.71));
  float body = mix(h0, 1.3 * hs, ${look.glass.soften.toFixed(3)}) * (0.45 + 1.5 * grain.r) * mix(${(1 - look.glass.gritty).toFixed(3)} + ${(2 * look.glass.gritty).toFixed(3)} * sugar, 1.0, smoothstep(0.3, 0.6, h0));
  float mmR = e * 2.0 * uShape.x * ${RS.toFixed(2)};
  float mmT = mmR * st / max(th, 0.05);
  vec2 slope = uShape.z * uGlassLook.z * vec2((h1 - h0) / mmR, (h2 - h0) / mmT);
  vec2 micro = ((grain.gb - 0.5) * 1.2 + (fine.gb - 0.5) * 0.8) * uGlassLook.w * (0.2 + 0.8 * smoothstep(0.0, 0.3, h0));
  vec3 er = vec3(e2 * ct, -st);
  vec3 et = vec3(t2, 0.0);
  vec3 nl = normalize(d - (slope.x + micro.y) * er - (slope.y - micro.x) * et);
  vec3 n = normalize(vAxisX * nl.x + vAxisY * nl.y + vAxisZ * nl.z);
  vec3 ng = normalize(vStageWorld - uLensCentre);
  vec3 v = normalize(vStageWorld - cameraPosition);
  float mu = max(dot(ng, -v), 0.0);
  float tau = uGlassLook.x * body / max(mu, ${look.glass.rimMu.toFixed(3)}) + uGlassLook.y * haze / max(mu, 0.3);
  // Frost seen square on is thinner than frost seen along the glass at the rim: from a camera to one side the band opens up.
  tau *= 1.0 - ${look.glass.faceOn.toFixed(3)} * smoothstep(0.45, 0.8, mu);
  float alpha = 1.0 - exp(-tau);
  alpha *= 1.0 - ${look.glass.clear[2]!.toFixed(3)} * (1.0 - smoothstep(${look.glass.clear[0]!.toFixed(3)}, ${look.glass.clear[1]!.toFixed(3)}, mu)) * smoothstep(-0.22, -0.08, ng.y);
  float kd = dot(n, uKeyDir);
  float rd = dot(n, uRimDir);
  float keyLit = max(kd, 0.0) * ${look.glass.front.toFixed(3)} + smoothstep(-1.0, 0.6, kd) * 0.3 + max(-kd, 0.0) * uGlassThru.x;
  float rimLit = max(rd, 0.0) * 0.8 + smoothstep(-1.0, 0.6, rd) * 0.3 + max(-rd, 0.0) * uGlassThru.x;
  float thru = pow(clamp(dot(v, uRimDir), 0.0, 1.0), 2.0) * clamp(0.6 + 0.6 * dot(ng, uRimDir), 0.0, 1.0);
  vec3 lit = uKeyCol * keyLit + uRimCol * (rimLit + 1.5 * thru) + uSky * (0.55 + 0.45 * n.y);
  vec3 albedo = mix(vec3(0.76, 0.84, 0.92), vec3(0.93, 0.95, 0.98), smoothstep(0.08, 0.7, h0));
  vec3 col = albedo * (lit * 0.3183 + stageGrid(vStageLocal * 0.9) * 0.6) * uGlint.w * (uGlassThru.y + uGlassThru.z * smoothstep(0.04, 0.6, h0)) * (0.84 + 0.32 * sugar);
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  vec3 spark = frostGlints(ga * ${RS.toFixed(2)}, pxMm, ng, v, ${look.glass.room.toFixed(3)}) * uGlint.x * (0.06 + 1.5 * m0.b * on) * smoothstep(0.02, 0.25, alpha);
  if (uBehindSize.x > 0.0) {
    float thickness = clamp(h0 + 0.6 * haze, 0.0, 1.0);
    float soft = smoothstep(0.02, 0.35, thickness);
    vec3 behind = frostBehind(gl_FragCoord.xy / uBehindSize, thickness, (viewMatrix * vec4(n - ng, 0.0)).xy);
    gl_FragColor = vec4(col * alpha + spark + behind * ((1.0 - alpha) * soft + alpha * ${look.glass.scatter.toFixed(3)}), 1.0 - (1.0 - alpha) * (1.0 - soft));
  } else gl_FragColor = vec4(col * alpha + spark, alpha);
  gl_FragColor *= seen;
  if (uDiag != 0) {
    if (alpha * seen < 0.3) discard;
    gl_FragColor = stageDiag(albedo, n, 0.0, c, fw / uShape.y);
  } else if (alpha < 0.004) discard;
}`

// The slab's growth at a place. While the foot rolls flat after the touch (uTouch.x on) the rime begins under the edge that
// touched first and runs round the foot to the far edge: uTouch.y is how far the foot has rolled flat, uTouch.z how far the
// touching side leads. The side is read from the foot's own tilt (uLean), and when the foot is flat every side has the same
// growth, so nothing depends on the side from then on.
// The front of the arrival: the frost does not come back everywhere at once. A place `frontMm` out from the foot's rim is
// `frontLag` of growth behind the rim while the growth is young, so a ring starts at the contact line on the landing frame and
// runs outward, its leading edge the first of the map's time (the spines and the fine grain), and every fern grows from its root
// to its tip with its branches behind the front, the nearest to the foot first. The lag is gone by the upper end of
// `frontEnd`, a little past the growth at `states.landedSeconds`, so the landed still is nearly what it was and the rest is
// untouched; the growth at a place never falls while the level rises (the lag only ever shrinks).
const SLAB_GROW_GLSL = `
uniform vec4 uTouch;
float frostSlabGrow(vec2 xz) {
  vec2 d = xz - uFoot.xy - uLean.xy;
  float g = uGrow.y;
  if (uTouch.x > 0.0) {
    float tilt = length(uLean.zw);
    float far = tilt > 1e-6 ? 0.5 - 0.5 * dot(d / max(length(d), 1.0), uLean.zw / tilt) : 0.0;
    g *= clamp(uTouch.y * (1.0 + uTouch.z) - uTouch.z * far, 0.0, 1.0);
  }
  float out1 = clamp((length(d) - uFoot.z) / ${look.slab.frontMm.toFixed(1)}, 0.0, 1.0);
  return g - ${look.slab.frontLag.toFixed(3)} * out1 * (1.0 - smoothstep(${look.slab.frontEnd[0].toFixed(3)}, ${look.slab.frontEnd[1].toFixed(3)}, g));
}
`

const SLAB_GLSL = `
${FROST_GLSL}
uniform sampler2D uSlabMap;
uniform vec4 uField;
uniform vec4 uSlabLook;
${SLAB_LIGHT_GLSL}
vec3 frostSlabLight(vec3 n, vec3 P, vec3 albedo, float open, float piled) {
  vec3 keyDir;
  vec3 rimDir;
  vec3 warm;
  float keyGain;
  float rimGain;
  float occl;
  slabLight(P, keyDir, keyGain, rimDir, rimGain, occl, warm);
  vec2 foot = uFoot.xy + uLean.xy;
  float ball = mix(${look.slab.ball.toFixed(3)}, 1.0, smoothstep(0.9, 1.5, slabCast(P.xz, foot, uFoot.w, keyDir.xz / max(keyDir.y, 0.25)).y));
  float key = clamp((dot(n, keyDir) + ${look.slab.wrap.toFixed(3)}) / ${(1 + look.slab.wrap).toFixed(3)}, 0.0, 1.0);
  float rim = clamp(dot(n, rimDir) * 0.6 + 0.4, 0.0, 1.0);
  vec3 lit = (uKeyCol * (key * keyGain * ball) + uRimCol * (rim * rimGain * ${look.slab.rim.toFixed(3)})) * mix(${look.slab.shade.toFixed(3)}, 1.0, open);
  vec2 out2 = P.xz - foot;
  vec2 dir2 = out2 / max(length(out2), 1.0);
  float side = smoothstep(0.0, 0.8, dot(dir2, vec2(-1.0, 0.1)));
  float heaped = smoothstep(0.36, 0.7, albedo.r);
  float lean = side * (1.0 - heaped * ${look.slab.poolThick.toFixed(3)});
  albedo = mix(albedo, vec3(dot(albedo, vec3(0.3333))) * vec3(1.0, 0.98, 0.95), side * ${look.slab.grey.toFixed(3)});
  float gain = mix(${look.slab.gainFar.toFixed(3)}, ${look.slab.gainKey.toFixed(3)}, smoothstep(-0.4, 0.5, dot(dir2, vec2(0.949, -0.316)))) * (1.0 - ${look.slab.gainFront.toFixed(3)} * smoothstep(0.5, 0.95, dir2.y));
  float back = smoothstep(-0.05, 0.45, -dir2.y);
  // The arms in front of the foot on the left lie in the globe's own shade: dim, and near grey (the approved image's lowest arm).
  float frontLeft = side * smoothstep(0.05, 0.65, dir2.y) * smoothstep(0.45, 0.7, -dir2.x);
  float heapLeft = side * smoothstep(0.1, 0.55, piled) * smoothstep(-0.5, 0.0, dir2.y);
  gain *= mix(1.0, mix(${look.slab.leftMid.toFixed(3)}, ${look.slab.leftBack.toFixed(3)}, back), side);
  gain *= (1.0 - ${look.slab.leftFrontCut.toFixed(3)} * frontLeft) * (1.0 - ${look.slab.leftHeapCut.toFixed(3)} * heapLeft);
  float skyShare = (1.0 - ${look.slab.skyCut.toFixed(3)} * lean) * (1.0 - ${look.slab.leftSkyCut.toFixed(3)} * frontLeft) * (1.0 - ${look.slab.leftHeapSky.toFixed(3)} * heapLeft);
  float poolShare = mix(${look.slab.poolBack.toFixed(3)}, 1.0, lean) * (uSlabLook.y * (1.0 - ${look.slab.poolThick.toFixed(3)} * heaped)) + ${look.slab.leftWarm.toFixed(3)} * frontLeft;
  return albedo * (0.3183 * ${look.slab.light.toFixed(3)} * gain) * (lit + (uSky * ((0.55 + 0.45 * n.y) * ${look.slab.sky.toFixed(3)} * skyShare) + warm * poolShare) * (occl * open) + mix(uPool, vec3(dot(uPool, vec3(0.3333))), 0.45) * (${look.slab.leftHeap.toFixed(3)} * heapLeft * (0.5 + 0.5 * n.y)));
}
vec2 frostSlabUv(vec2 xz) {
  return vec2(xz.x + uField.x, uField.x - xz.y) / (2.0 * uField.x);
}
${SLAB_GROW_GLSL}
// How far out of the lens's focus a place on the slab lies, in mip levels of the frost's map. The approved image is sharp at
// the front of the foot and on the arms beside it; the arms behind the foot and the mound in front of it are soft. The lens of
// the stage is too small to do that to a layer this thin, so the frost softens itself by its distance from the plane of focus
// (the foot's centre, focusMm toward the camera): its map is read from a coarser level, its sugar grain and its sparkle fade.
// The share of the sparkle that the globe's own shade takes: the arms on the left in front of the foot lie in it (the approved
// image has them dim and matt), so a glint there would be brighter than the frost it sits on.
float frostShade(vec2 xz) {
  vec2 out2 = xz - uFoot.xy - uLean.xy;
  vec2 dir2 = out2 / max(length(out2), 1.0);
  return ${look.slab.shadeGlint.toFixed(3)} * smoothstep(0.0, 0.8, dot(dir2, vec2(-1.0, 0.1))) * (1.0 - smoothstep(-0.05, 0.45, -dir2.y));
}
float frostBlur(vec3 P) {
  float away = length(P - cameraPosition) - (length(vec3(uFoot.x, 0.0, uFoot.y) - cameraPosition) - ${look.slab.focusMm.toFixed(1)});
  return max(${look.slab.farMips.toFixed(2)} * smoothstep(${look.slab.far[0].toFixed(1)}, ${look.slab.far[1].toFixed(1)}, away), ${look.slab.nearMips.toFixed(2)} * smoothstep(${look.slab.near[0].toFixed(1)}, ${look.slab.near[1].toFixed(1)}, -away));
}
`

// Where the foot's image lies on the slab (see SHEET): how far in front of the foot it fades out (mm), how much of the thin
// film gives way there, and how thick the rime must be to stay.
const IMAGE_REACH_MM = [22, 36]
const IMAGE_CLEAR = 0.9
const IMAGE_LUMP = [0.5, 0.85]

const SHEET = `
${SLAB_GLSL}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (frostHidden(uGrow.w)) discard;
  vec2 xz = vStageWorld.xz;
  vec2 uv = frostSlabUv(xz);
  vec2 guv = xz * uField.w;
  vec3 grain = texture(uGrain, guv).rgb;
  vec3 fine = texture(uGrain, guv * 3.0 + 0.37).rgb;
  float fw = max(length(dFdx(uv)), length(dFdy(uv)));
  float blur = frostBlur(vStageWorld);
  float soft = clamp(blur * 0.5, 0.0, 1.0);
  float e = max(min(length(dFdx(uv)), length(dFdy(uv))), uField.y) * 1.2 * exp2(blur);
  float eb = max(4.0 * e, 0.45 / uField.x);
  float lvl = frostSlabGrow(xz) - FROST_START + (grain.r - 0.33) * 0.07 + (fine.r - 0.33) * 0.03;
  vec3 m0 = texture(uSlabMap, uv, blur).rgb;
  vec3 m1 = texture(uSlabMap, uv + vec2(e, 0.0), blur).rgb;
  vec3 m2 = texture(uSlabMap, uv - vec2(0.0, e), blur).rgb;
  vec3 b0 = texture(uSlabMap, uv, 2.5 + 0.5 * blur).rgb;
  vec3 b1 = texture(uSlabMap, uv + vec2(eb, 0.0), 2.5 + 0.5 * blur).rgb;
  vec3 b2 = texture(uSlabMap, uv - vec2(0.0, eb), 2.5 + 0.5 * blur).rgb;
  float crumb = frostCrumb(uGrow.w, fine.r);
  float on = smoothstep(0.0, FROST_SOFT, lvl - m0.g) * max(frostStay(uGrow.w, m0.r, grain.r, m0.g), crumb);
  float h0 = m0.r * on;
  float h1 = m1.r * smoothstep(0.0, FROST_SOFT, lvl - m1.g) * max(frostStay(uGrow.w, m1.r, grain.r, m1.g), crumb);
  float h2 = m2.r * smoothstep(0.0, FROST_SOFT, lvl - m2.g) * max(frostStay(uGrow.w, m2.r, grain.r, m2.g), crumb);
  float s0 = b0.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - b0.g + 0.03) * frostStay(uGrow.w, b0.r, grain.r, b0.g);
  float s1 = b1.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - b1.g + 0.03) * frostStay(uGrow.w, b1.r, grain.r, b1.g);
  float s2 = b2.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - b2.g + 0.03) * frostStay(uGrow.w, b2.r, grain.r, b2.g);
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  float sugar = mix(smoothstep(0.26, 0.74, frostSugar(vStageWorld, pxMm, ${look.slab.sugarMm.toFixed(3)}, 0.31)), 0.5, 0.9 * soft);
  float clot = mix(smoothstep(0.3, 0.7, frostSugar(vStageWorld, pxMm, ${look.slab.clotMm.toFixed(3)}, 0.47)), 0.5, 0.6 * soft);
  // The foot's image lies on the slab in front of the foot (the hero camera looks down at 12 degrees: a thing 1 mm up the foot
  // is mirrored 5 mm nearer the eye). There the thin film of rime gives way and the lumps stay, so the image of the gilt band
  // and the rope is broken by snow and not buried under it.
  float imageAhead = xz.y - sqrt(max(uFoot.z * uFoot.z - xz.x * xz.x, 0.0));
  float imageZone = (1.0 - smoothstep(${IMAGE_REACH_MM[0].toFixed(1)}, ${IMAGE_REACH_MM[1].toFixed(1)}, imageAhead)) * smoothstep(uFoot.z + 3.0, uFoot.z - 3.0, abs(xz.x)) * step(0.0, xz.y);
  float imageKeep = mix(1.0, smoothstep(${IMAGE_LUMP[0].toFixed(2)}, ${IMAGE_LUMP[1].toFixed(2)}, max(h0, s0)), ${IMAGE_CLEAR.toFixed(2)} * imageZone);
  float body = mix(s0, h0, 0.72) * (0.4 + 0.75 * sugar + 0.45 * clot) * imageKeep;
  vec2 slope = uField.z * uSlabLook.z * vec2(h1 - h0, h2 - h0) / (e * 2.0 * uField.x);
  slope += uField.z * ${look.slab.broad.toFixed(3)} * vec2(s1 - s0, s2 - s0) / (eb * 2.0 * uField.x);
  vec2 micro = ((grain.gb - 0.5) * 1.2 + (fine.gb - 0.5) * 0.8) * uSlabLook.w * (0.2 + 0.8 * smoothstep(0.0, 0.25, h0)) * (1.0 - 0.85 * soft);
  vec3 n = normalize(vec3(-slope.x - micro.x, 1.0, -slope.y + micro.y));
  vec3 v = normalize(vStageWorld - cameraPosition);
  float mu = max(-v.y, 0.0);
  float alpha = 1.0 - exp(-uSlabLook.x * body * body / max(mu, 0.3) - ${look.slab.film.toFixed(3)} * body);
  float thick = smoothstep(0.1, 0.62, max(h0, mix(s0, h0, 0.6)));
  vec3 albedo = mix(${vec(SNOW.thin)}, ${vec(SNOW.thick)}, thick);
  float open = 0.55 + 0.45 * smoothstep(-0.12, 0.2, h0 - s0 + 0.35 * thick);
  // Snow lies in lumps a few millimetres across, some of them in the shade of their neighbours: without that the frost is one
  // flat white (round 5: "flatter, sharper-edged white patches" where the approved image has "softer snowy thickness").
  float lump = smoothstep(0.3, 0.75, frostSugar(vStageWorld, pxMm, ${look.slab.lumpMm.toFixed(3)}, 0.83));
  vec3 col = frostSlabLight(n, vStageWorld, albedo, open, 0.0) * (0.7 + 0.6 * sugar) * (1.0 - ${look.slab.lumpSheet.toFixed(3)} * (1.0 - lump));
  vec3 spark = frostGlints(xz, pxMm, vec3(0.0, 1.0, 0.0), v, ${look.slab.room.toFixed(3)}) * uGlint.y * (0.05 + 1.5 * m0.b * on) * smoothstep(0.02, 0.25, alpha) * thick * (1.0 - 0.9 * soft) * (1.0 - frostShade(xz));
  // Melt water round the frost: a few millimetres past its edge the slab is wet and darker, so the frost does not end on dry wood.
  vec3 w0 = texture(uSlabMap, uv, 4.6).rgb;
  float wet = smoothstep(0.012, 0.09, w0.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - w0.g + 0.03) * frostStay(uGrow.w, w0.r, grain.r, w0.g)) * ${look.slab.wet.toFixed(3)};
  float cover = alpha + wet * (1.0 - ${IMAGE_CLEAR.toFixed(2)} * imageZone) * (1.0 - alpha);
  gl_FragColor = vec4(col * alpha + spark, cover);
  if (uDiag != 0) {
    if (alpha < 0.3) discard;
    gl_FragColor = stageDiag(albedo, n, 0.0, c, fw / uField.y);
  } else if (cover < 0.004) discard;
}`

const SHAPES = `
${SLAB_GLSL}
varying vec3 vFrostN;
varying vec4 vFrostOn;
varying float vFrostT;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (frostHidden(uGrow.w)) discard;
  if (vFrostOn.x < 0.03) discard;
  vec2 xz = vStageWorld.xz;
  vec2 guv = xz * uField.w;
  vec3 grain = texture(uGrain, guv).rgb;
  vec3 coarse = texture(uGrain, guv * 0.31 + 0.61).rgb;
  vec3 fern = texture(uSlabMap, frostSlabUv(xz), 1.0).rgb;
  float lvl = frostSlabGrow(xz) - FROST_START + (grain.r - 0.33) * 0.07;
  float leaf = fern.r * smoothstep(0.0, FROST_SOFT, lvl - fern.g);
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  float soft = clamp(frostBlur(vStageWorld) * 0.5, 0.0, 1.0);
  float sugar = mix(smoothstep(0.26, 0.74, frostSugar(vStageWorld, pxMm, ${look.slab.sugarMm.toFixed(3)}, 0.31)), 0.5, 0.9 * soft);
  float sugar2 = mix(smoothstep(0.26, 0.74, frostSugar(vStageWorld, pxMm, ${look.slab.sugarMm.toFixed(3)}, 0.63)), 0.5, 0.9 * soft);
  float clot = mix(smoothstep(0.3, 0.7, frostSugar(vStageWorld, pxMm, ${look.slab.clotMm.toFixed(3)}, 0.47)), 0.5, 0.6 * soft);
  float edge = vFrostOn.z * vFrostOn.x;
  float from = ${look.slab.edge.toFixed(3)} * (0.55 * sugar + 0.45 * clot) * (1.0 - 0.5 * leaf) * (1.0 - 0.6 * soft);
  float alpha = smoothstep(from, from + 0.42 + 0.5 * soft, edge);
  alpha *= max(frostStay(uGrow.w, 0.45 + 0.55 * vFrostOn.y * vFrostOn.z, 0.5 * (sugar2 + clot), vFrostT), frostCrumb(uGrow.w, grain.r));
  alpha *= mix(${look.slab.lace.toFixed(3)} + ${(1 - look.slab.lace).toFixed(3)} * (0.6 * sugar2 + 0.4 * clot), 1.0, smoothstep(0.35, 0.95, vFrostOn.y));
  if (alpha < 0.012) discard;
  vec2 micro = (vec2(sugar, sugar2) - 0.5) * 2.0 + (coarse.gb - 0.5) * 0.8;
  vec3 n = normalize(normalize(vFrostN) + vec3(-micro.x, 0.0, micro.y) * (${look.slab.gritty.toFixed(3)} * uSlabLook.w));
  vec3 v = normalize(vStageWorld - cameraPosition);
  float open = vFrostOn.w * (0.86 + 0.14 * alpha);
  float deep = (0.22 + 0.78 * vFrostOn.y) * smoothstep(0.1, 0.75, alpha);
  vec3 albedo = mix(${vec(SNOW.thin)}, ${vec(SNOW.body)}, deep) * (0.9 + 0.16 * leaf);
  float lump = smoothstep(0.3, 0.75, frostSugar(vStageWorld, pxMm, ${look.slab.lumpMm.toFixed(3)}, 0.83));
  vec3 col = frostSlabLight(n, vStageWorld, albedo, open, deep) * (0.58 + 0.62 * sugar + 0.22 * clot) * (1.0 - ${look.slab.lump.toFixed(3)} * (1.0 - lump));
  vec3 spark = frostGlints(xz + vStageWorld.y * 3.1, pxMm, normalize(vFrostN), v, ${look.slab.room.toFixed(3)}) * uGlint.y * ${(1.3 * look.slab.heapGlint).toFixed(3)} * alpha * open * (1.0 - 0.9 * soft) * (1.0 - frostShade(xz));
  gl_FragColor = vec4(col * alpha + spark, alpha);
  if (uDiag != 0) {
    if (alpha < 0.3) discard;
    gl_FragColor = stageDiag(albedo, n, 0.0, c, 0.0);
  }
}`

let glass: THREE.Mesh | null = null
let surface: THREE.Group | null = null

export async function prepare(): Promise<void> {
  await prepareModel(MODEL)
  const u = frostUniforms
  u.uGlassMap.value = texture(GLASS_MAP)
  u.uSlabMap.value = texture(SLAB_MAP)
  u.uGrain.value = texture(GRAIN_MAP)
  const extras = geometry(MODEL, 'glass').userData.extras as Record<string, number>
  const sizeOf = (t: THREE.Texture | null): number => (t?.image as { width: number } | undefined)?.width ?? 1
  const tiles = Math.max(1, Math.round((2 * Math.PI * RS) / extras.grainTileMm!))
  u.uShape.value.set(extras.glassMaxPolarDeg! * RAD, 1 / sizeOf(u.uGlassMap.value), extras.glassHeightMm!, tiles)
  u.uField.value.set(extras.slabHalfMm!, 1 / sizeOf(u.uSlabMap.value), extras.slabHeightMm!, 1 / extras.grainTileMm!)
}

const veil = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const

const copies = new Map<string, THREE.FramebufferTexture>()

function copyBehind(renderer: THREE.WebGLRenderer, material: THREE.Material): void {
  const target = renderer.getRenderTarget()
  const u = behindUniforms
  ;(material as THREE.ShaderMaterial).uniformsNeedUpdate = true
  if (!target || stageUniforms.uDiag.value !== 0) {
    u.uBehindSize.value.set(0, 0)
    return
  }
  if (target.samples > 0) {
    const resolved = resolveBehind(renderer, target, 'frost')
    if (resolved) u.uBehind.value = resolved
    u.uBehindSize.value.set(resolved ? target.width : 0, resolved ? target.height : 0)
    return
  }
  const type = target.texture.type
  const key = `${target.width} ${target.height} ${type}`
  let copy = copies.get(key)
  if (!copy) {
    if (copies.size >= 4) {
      for (const old of copies.values()) old.dispose()
      copies.clear()
    }
    copy = new THREE.FramebufferTexture(target.width, target.height)
    copy.type = type
    copy.magFilter = THREE.LinearFilter
    copy.minFilter = THREE.LinearFilter
    copy.colorSpace = THREE.NoColorSpace
    copies.set(key, copy)
  }
  renderer.copyFramebufferToTexture(copy)
  u.uBehind.value = copy
  u.uBehindSize.value.set(target.width, target.height)
}

function makeGlass(): THREE.Mesh {
  const m = stageShader({
    part: GLASS_PART,
    standIn: false,
    change: 'glass-dressing',
    textured: true,
    texels: 1 / frostUniforms.uShape.value.y,
    uniforms: { ...roomUniforms, ...lightUniforms, uGlassMap: frostUniforms.uGlassMap, uGrain: frostUniforms.uGrain, uGrow: frostUniforms.uGrow, uShape: frostUniforms.uShape, uGlassLook: frostUniforms.uGlassLook, uGlassThru: frostUniforms.uGlassThru, uGlint: frostUniforms.uGlint, ...behindUniforms },
    vertexPars: 'varying vec3 vAxisX;\nvarying vec3 vAxisY;\nvarying vec3 vAxisZ;',
    vertexMain: 'vAxisX = normalize(modelMatrix[0].xyz);\nvAxisY = normalize(modelMatrix[1].xyz);\nvAxisZ = normalize(modelMatrix[2].xyz);',
    fragment: GLASS,
    params: { ...veil },
  })
  const mesh = new THREE.Mesh(geometry(MODEL, 'glass'), m)
  mesh.renderOrder = 11
  mesh.frustumCulled = false
  mesh.onBeforeRender = (renderer, _scene, _camera, _geometry, material) => copyBehind(renderer, material)
  return mesh
}

function makeSurface(): THREE.Group {
  const shared = { ...roomUniforms, ...lightUniforms, uSlabMap: frostUniforms.uSlabMap, uGrain: frostUniforms.uGrain, uGrow: frostUniforms.uGrow, uTouch: frostUniforms.uTouch, uField: frostUniforms.uField, uSlabLook: frostUniforms.uSlabLook, uGlint: frostUniforms.uGlint, ...slabLightUniforms }
  const sheet = new THREE.Mesh(
    geometry(MODEL, 'sheet'),
    stageShader({ part: SLAB_PART, standIn: false, change: 'surface-dressing', textured: true, texels: 1 / frostUniforms.uField.value.y, uniforms: shared, fragment: SHEET, params: { ...veil } }),
  )
  sheet.position.y = 0.04
  sheet.renderOrder = 2
  sheet.frustumCulled = false
  const shapes = new THREE.Mesh(
    geometry(MODEL, 'shapes'),
    stageShader({
      part: SLAB_PART,
      standIn: false,
      change: 'surface-dressing',
      uniforms: shared,
      vertexPars: `attribute vec2 uv1;\nuniform vec4 uGrow;\nuniform vec4 uFoot;\nuniform vec4 uLean;\nvarying vec3 vFrostN;\nvarying vec4 vFrostOn;\nvarying float vFrostT;\n${SLAB_GROW_GLSL}`,
      vertexMain: `
float frostLoose = step(1.5, uv1.y);
float frostLvl = frostSlabGrow((modelMatrix * vec4(position, 1.0)).xz) - 0.07 - uv.x;
float frostLead = max(uv.x - 0.1, 0.05);
float frostGo = clamp(frostLvl / frostLead + 1.0, 0.0, 1.0);
float frostToGo = (1.0 - frostGo) * (1.0 - frostGo) * frostLoose;
float frostSunk = uGrow.w >= 1.0 ? 1.0 : smoothstep(0.0, 0.3, 0.6 * uv.x + 0.3 - (1.0 - uGrow.w) * 1.2);
float frostOn = mix(smoothstep(0.0, 0.14, frostLvl), smoothstep(0.0, 0.06, frostGo), frostLoose) * (0.35 + 0.65 * frostSunk);
vec3 frostAt = vec3(position.x, position.y * frostOn + 3.2 * frostToGo * frostGo, position.z);
frostAt.xz -= normalize(position.xz) * ((uv1.y - 2.0) * 64.0 * frostToGo);
vec4 frostW = modelMatrix * vec4(frostAt, 1.0);
vec4 frostV = viewMatrix * frostW;
gl_Position = projectionMatrix * frostV;
vStageWorld = frostW.xyz;
vStageLocal = (uGlobeInv * frostW).xyz;
vStageAux = vec3(0.0, -frostV.z, length(frostV.xyz));
vStagePlaced = frostW.xyz;
vFrostN = normalize(mat3(modelMatrix) * normal);
vFrostOn = vec4(frostOn, uv.y, uv1.x, mix(uv1.y, 0.9, frostLoose));
vFrostT = uv.x;`,
      fragment: SHAPES,
      params: { ...veil, depthWrite: true },
    }),
  )
  shapes.renderOrder = 3
  shapes.frustumCulled = false
  return new THREE.Group().add(shapes, sheet)
}

export function dressing(): { glass: THREE.Object3D; surface: THREE.Object3D } {
  glass ??= makeGlass()
  surface ??= makeSurface()
  return { glass, surface }
}

/** `rolled` is given only while the foot rolls flat after the touch: how far it has (0 at the touch, 1 flat), and `lead` how far the touching side leads the far side. */
export function setGrowth(glassLevel: number, slabLevel: number, keepGlass: number, keepSlab: number, rolled = -1, lead = 0): void {
  frostUniforms.uGrow.value.set(glassLevel, slabLevel, keepGlass, keepSlab)
  frostUniforms.uTouch.value.set(rolled >= 0 ? 1 : 0, Math.max(0, rolled), lead, 0)
}

export function update(_moment: KitMoment): void {}
