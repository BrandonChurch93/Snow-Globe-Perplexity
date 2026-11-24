import * as THREE from 'three'
import { config } from '../../config'
import { stageShader, stageUniforms } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { texture } from '../../core/textures'
import { shellUniforms } from '../../globe/shell'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { SLAB_LIGHT_GLSL, slabLightUniforms, surfaceUniforms } from '../../scene/surface'
import type { Dressing, KitMoment } from '../kit'
import { season } from './base'

const MODEL = `${season}/frost-shapes.glb`
const GLASS_MAP = `${season}/frost-glass.lin.w1536.png`
const SLAB_MAP = `${season}/frost-slab.lin.w1536.png`
const GRAIN_MAP = `${season}/frost-grain.lin.tile.png`
const GLASS_PART = `glass-dressing-${season}`
const SLAB_PART = `surface-dressing-${season}`
const RS = config.globe.sphereDiameterMm / 2
const RAD = Math.PI / 180

export const FULL = 2

export const standIns: string[] = []

export const glassDressing: Dressing = { tint: [0.86, 0.92, 1], amount: 0 }
export const surfaceDressing: Dressing & { reachMm: number } = { tint: [0.86, 0.92, 1], amount: 0, reachMm: 132 }

const look = {
  glass: { cover: 1.7, haze: 0.5, slope: 0.55, micro: 1.1, glint: 1.6, light: 0.96, through: 2.4, thin: 0.6, thick: 0.8, blur: 0.012, bend: 0.012, scatter: 0.4, room: 0.5, soften: 0.2, rimMu: 0.3, front: 1.9, sugarMm: 0.3, gritty: 0.45, clear: [0.255, 0.28, 0.8] },
  slab: { cover: 2.2, film: 1.7, slope: 1.6, micro: 1.2, glint: 1.6, pool: 0.5, poolBack: 0.12, poolThick: 0.9, skyCut: 0.55, gainFar: 0.9, gainKey: 1.5, gainFront: 0.24, grey: 0.85, light: 2.95, wrap: 0.3, broad: 1.4, shade: 0.35, edge: 0.6, ball: 0.3, rim: 0.55, sky: 1.3, sugarMm: 0.34, clotMm: 1.15, room: 0.1, lace: 0.3, gritty: 0.75 },
}
const SNOW = { thin: [0.32, 0.49, 0.7], thick: [0.92, 0.955, 0.99], body: [0.9, 0.93, 0.98] }
const vec = (v: number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`

const frostUniforms = {
  uGlassMap: { value: null as THREE.Texture | null },
  uSlabMap: { value: null as THREE.Texture | null },
  uGrain: { value: null as THREE.Texture | null },
  uGrow: { value: new THREE.Vector4(FULL, FULL, 1, 1) },
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
float frostRnd(vec2 cell, float k) {
  return stageHash(vec3(cell + 8192.0, k));
}
bool frostHidden(float keep) {
  return keep < 1.0 && stageHash(vec3(gl_FragCoord.xy + 17.0, uSeed + 0.37)) >= keep;
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
vec3 frostBehind(vec2 uv, float thickness, vec2 slope) {
  vec2 px = 1.0 / uBehindSize;
  vec2 at = uv + slope * (thickness * ${look.glass.bend.toFixed(4)} * uBehindSize.y) * px;
  float r = thickness * ${look.glass.blur.toFixed(4)} * uBehindSize.y;
  vec3 sum = textureLod(uBehind, at, 0.0).rgb;
  float total = 1.0;
  for (int i = 1; i <= 12; i++) {
    float fi = float(i);
    float a = fi * 2.3999632;
    float k = sqrt(fi / 12.0);
    float w = 1.0 - 0.5 * k;
    sum += textureLod(uBehind, at + vec2(cos(a), sin(a)) * (k * r) * px, 0.0).rgb * w;
    total += w;
  }
  return sum / total;
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
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
  float lvl = uGrow.x + (grain.r - 0.33) * 0.07 + (fine.r - 0.33) * 0.03;
  vec3 m0 = texture(uGlassMap, uv, -0.6).rgb;
  vec3 m1 = texture(uGlassMap, uv + e2 * e, -0.6).rgb;
  vec3 m2 = texture(uGlassMap, uv + t2 * e, -0.6).rgb;
  vec3 ms = texture(uGlassMap, uv, 1.4).rgb;
  vec3 mb = texture(uGlassMap, uv, 3.0).rgb;
  float on = smoothstep(0.0, FROST_SOFT, lvl - m0.g);
  float h0 = m0.r * on;
  float hs = ms.r * smoothstep(0.0, 1.5 * FROST_SOFT, lvl - ms.g + 0.02);
  float h1 = m1.r * smoothstep(0.0, FROST_SOFT, lvl - m1.g);
  float h2 = m2.r * smoothstep(0.0, FROST_SOFT, lvl - m2.g);
  float haze = mb.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - mb.g + 0.04);
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
  float alpha = 1.0 - exp(-tau);
  alpha *= 1.0 - ${look.glass.clear[2]!.toFixed(3)} * (1.0 - smoothstep(${look.glass.clear[0]!.toFixed(3)}, ${look.glass.clear[1]!.toFixed(3)}, mu));
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
  if (uDiag != 0) {
    if (alpha < 0.3) discard;
    gl_FragColor = stageDiag(albedo, n, 0.0, c, fw / uShape.y);
  } else if (alpha < 0.004) discard;
}`

const SLAB_GLSL = `
${FROST_GLSL}
uniform sampler2D uSlabMap;
uniform vec4 uField;
uniform vec4 uSlabLook;
${SLAB_LIGHT_GLSL}
vec3 frostSlabLight(vec3 n, vec3 P, vec3 albedo, float open) {
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
  return albedo * (0.3183 * ${look.slab.light.toFixed(3)} * gain) * (lit + (uSky * ((0.55 + 0.45 * n.y) * ${look.slab.sky.toFixed(3)} * (1.0 - ${look.slab.skyCut.toFixed(3)} * lean)) + warm * mix(${look.slab.poolBack.toFixed(3)}, 1.0, lean) * (uSlabLook.y * (1.0 - ${look.slab.poolThick.toFixed(3)} * heaped))) * (occl * open));
}
vec2 frostSlabUv(vec2 xz) {
  return vec2(xz.x + uField.x, uField.x - xz.y) / (2.0 * uField.x);
}
`

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
  float e = max(min(length(dFdx(uv)), length(dFdy(uv))), uField.y) * 1.2;
  float eb = max(4.0 * e, 0.45 / uField.x);
  float lvl = uGrow.y + (grain.r - 0.33) * 0.07 + (fine.r - 0.33) * 0.03;
  vec3 m0 = texture(uSlabMap, uv).rgb;
  vec3 m1 = texture(uSlabMap, uv + vec2(e, 0.0)).rgb;
  vec3 m2 = texture(uSlabMap, uv - vec2(0.0, e)).rgb;
  vec3 b0 = texture(uSlabMap, uv, 2.5).rgb;
  vec3 b1 = texture(uSlabMap, uv + vec2(eb, 0.0), 2.5).rgb;
  vec3 b2 = texture(uSlabMap, uv - vec2(0.0, eb), 2.5).rgb;
  float on = smoothstep(0.0, FROST_SOFT, lvl - m0.g);
  float h0 = m0.r * on;
  float h1 = m1.r * smoothstep(0.0, FROST_SOFT, lvl - m1.g);
  float h2 = m2.r * smoothstep(0.0, FROST_SOFT, lvl - m2.g);
  float s0 = b0.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - b0.g + 0.03);
  float s1 = b1.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - b1.g + 0.03);
  float s2 = b2.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - b2.g + 0.03);
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  float sugar = smoothstep(0.26, 0.74, frostSugar(vStageWorld, pxMm, ${look.slab.sugarMm.toFixed(3)}, 0.31));
  float clot = smoothstep(0.3, 0.7, frostSugar(vStageWorld, pxMm, ${look.slab.clotMm.toFixed(3)}, 0.47));
  float body = mix(s0, h0, 0.72) * (0.4 + 0.75 * sugar + 0.45 * clot);
  vec2 slope = uField.z * uSlabLook.z * vec2(h1 - h0, h2 - h0) / (e * 2.0 * uField.x);
  slope += uField.z * ${look.slab.broad.toFixed(3)} * vec2(s1 - s0, s2 - s0) / (eb * 2.0 * uField.x);
  vec2 micro = ((grain.gb - 0.5) * 1.2 + (fine.gb - 0.5) * 0.8) * uSlabLook.w * (0.2 + 0.8 * smoothstep(0.0, 0.25, h0));
  vec3 n = normalize(vec3(-slope.x - micro.x, 1.0, -slope.y + micro.y));
  vec3 v = normalize(vStageWorld - cameraPosition);
  float mu = max(-v.y, 0.0);
  float alpha = 1.0 - exp(-uSlabLook.x * body * body / max(mu, 0.3) - ${look.slab.film.toFixed(3)} * body);
  float thick = smoothstep(0.16, 0.86, mix(s0, h0, 0.6));
  vec3 albedo = mix(${vec(SNOW.thin)}, ${vec(SNOW.thick)}, thick);
  float open = 0.55 + 0.45 * smoothstep(-0.12, 0.2, h0 - s0 + 0.35 * thick);
  vec3 col = frostSlabLight(n, vStageWorld, albedo, open) * (0.7 + 0.6 * sugar);
  vec3 spark = frostGlints(xz, pxMm, vec3(0.0, 1.0, 0.0), v, ${look.slab.room.toFixed(3)}) * uGlint.y * (0.05 + 1.5 * m0.b * on) * smoothstep(0.02, 0.25, alpha) * thick;
  gl_FragColor = vec4(col * alpha + spark, alpha);
  if (uDiag != 0) {
    if (alpha < 0.3) discard;
    gl_FragColor = stageDiag(albedo, n, 0.0, c, fw / uField.y);
  } else if (alpha < 0.004) discard;
}`

const SHAPES = `
${SLAB_GLSL}
varying vec3 vFrostN;
varying vec4 vFrostOn;
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
  float lvl = uGrow.y + (grain.r - 0.33) * 0.07;
  float leaf = fern.r * smoothstep(0.0, FROST_SOFT, lvl - fern.g);
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  float sugar = smoothstep(0.26, 0.74, frostSugar(vStageWorld, pxMm, ${look.slab.sugarMm.toFixed(3)}, 0.31));
  float sugar2 = smoothstep(0.26, 0.74, frostSugar(vStageWorld, pxMm, ${look.slab.sugarMm.toFixed(3)}, 0.63));
  float clot = smoothstep(0.3, 0.7, frostSugar(vStageWorld, pxMm, ${look.slab.clotMm.toFixed(3)}, 0.47));
  float edge = vFrostOn.z * vFrostOn.x;
  float from = ${look.slab.edge.toFixed(3)} * (0.55 * sugar + 0.45 * clot) * (1.0 - 0.5 * leaf);
  float alpha = smoothstep(from, from + 0.42, edge);
  alpha *= mix(${look.slab.lace.toFixed(3)} + ${(1 - look.slab.lace).toFixed(3)} * (0.6 * sugar2 + 0.4 * clot), 1.0, smoothstep(0.35, 0.95, vFrostOn.y));
  if (alpha < 0.012) discard;
  vec2 micro = (vec2(sugar, sugar2) - 0.5) * 2.0 + (coarse.gb - 0.5) * 0.8;
  vec3 n = normalize(normalize(vFrostN) + vec3(-micro.x, 0.0, micro.y) * (${look.slab.gritty.toFixed(3)} * uSlabLook.w));
  vec3 v = normalize(vStageWorld - cameraPosition);
  float open = vFrostOn.w * (0.86 + 0.14 * alpha);
  float deep = (0.22 + 0.78 * vFrostOn.y) * smoothstep(0.1, 0.75, alpha);
  vec3 albedo = mix(${vec(SNOW.thin)}, ${vec(SNOW.body)}, deep) * (0.9 + 0.16 * leaf);
  vec3 col = frostSlabLight(n, vStageWorld, albedo, open) * (0.58 + 0.62 * sugar + 0.22 * clot);
  vec3 spark = frostGlints(xz + vStageWorld.y * 3.1, pxMm, normalize(vFrostN), v, ${look.slab.room.toFixed(3)}) * uGlint.y * 1.3 * alpha * open;
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
  surfaceDressing.reachMm = extras.slabHalfMm!
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
  if (!target || target.samples > 0 || stageUniforms.uDiag.value !== 0) {
    u.uBehindSize.value.set(0, 0)
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
  const shared = { ...roomUniforms, ...lightUniforms, uSlabMap: frostUniforms.uSlabMap, uGrain: frostUniforms.uGrain, uGrow: frostUniforms.uGrow, uField: frostUniforms.uField, uSlabLook: frostUniforms.uSlabLook, uGlint: frostUniforms.uGlint, ...slabLightUniforms }
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
      vertexPars: 'attribute vec2 uv1;\nuniform vec4 uGrow;\nvarying vec3 vFrostN;\nvarying vec4 vFrostOn;',
      vertexMain: `
float frostOn = smoothstep(0.0, 0.07, uGrow.y - uv.x);
vec4 frostW = modelMatrix * vec4(position.x, position.y * frostOn, position.z, 1.0);
vec4 frostV = viewMatrix * frostW;
gl_Position = projectionMatrix * frostV;
vStageWorld = frostW.xyz;
vStageLocal = (uGlobeInv * frostW).xyz;
vStageAux = vec3(0.0, -frostV.z, length(frostV.xyz));
vStagePlaced = frostW.xyz;
vFrostN = normalize(mat3(modelMatrix) * normal);
vFrostOn = vec4(frostOn, uv.y, uv1.x, uv1.y);`,
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

export function setGrowth(glassLevel: number, slabLevel: number, keepGlass: number, keepSlab: number): void {
  frostUniforms.uGrow.value.set(glassLevel, slabLevel, keepGlass, keepSlab)
}

export function update(_moment: KitMoment): void {}
