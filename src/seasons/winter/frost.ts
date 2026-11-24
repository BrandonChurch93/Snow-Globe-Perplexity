import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { texture } from '../../core/textures'
import { shellUniforms } from '../../globe/shell'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { KEY_POOL_MM, surfaceUniforms } from '../../scene/surface'
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
  glass: { cover: 1.15, haze: 0.09, slope: 0.55, micro: 1.1, glint: 1.6, light: 0.52, through: 0.55, thin: 0.7, thick: 0.6 },
  slab: { cover: 1.5, slope: 0.8, micro: 0.9, glint: 1.6, pool: 0.035 },
}

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
vec3 frostGlintLayer(vec2 q, float size, float k, vec3 n, vec3 v) {
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
  light += stageRoomLights(r, 0.012) * 0.5;
  return light * (spot * bright);
}
vec3 frostGlints(vec2 q, float pxMm, vec3 n, vec3 v) {
  float lod = log2(max(pxMm * 1.7 / uGlint.z, 1.0));
  float l0 = floor(lod);
  float f = lod - l0;
  float size = uGlint.z * exp2(l0);
  return frostGlintLayer(q, size, 0.11 + 0.07 * l0, n, v) * (1.0 - f) + frostGlintLayer(q, size * 2.0, 0.18 + 0.07 * l0, n, v) * f;
}
`

const GLASS = `
${FROST_GLSL}
uniform sampler2D uGlassMap;
uniform vec4 uShape;
uniform vec4 uGlassLook;
uniform vec4 uGlassThru;
varying vec3 vAxisX;
varying vec3 vAxisY;
varying vec3 vAxisZ;
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
  vec3 mb = texture(uGlassMap, uv, 3.0).rgb;
  float on = smoothstep(0.0, FROST_SOFT, lvl - m0.g);
  float h0 = m0.r * on;
  float h1 = m1.r * smoothstep(0.0, FROST_SOFT, lvl - m1.g);
  float h2 = m2.r * smoothstep(0.0, FROST_SOFT, lvl - m2.g);
  float haze = mb.r * smoothstep(0.0, 2.0 * FROST_SOFT, lvl - mb.g + 0.04);
  float body = h0 * (0.45 + 1.5 * grain.r);
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
  float tau = uGlassLook.x * body / max(mu, 0.42) + uGlassLook.y * haze / max(mu, 0.3);
  float alpha = 1.0 - exp(-tau);
  float kd = dot(n, uKeyDir);
  float rd = dot(n, uRimDir);
  float keyLit = max(kd, 0.0) * 0.8 + smoothstep(-1.0, 0.6, kd) * 0.3 + max(-kd, 0.0) * uGlassThru.x;
  float rimLit = max(rd, 0.0) * 0.8 + smoothstep(-1.0, 0.6, rd) * 0.3 + max(-rd, 0.0) * uGlassThru.x;
  float thru = pow(clamp(dot(v, uRimDir), 0.0, 1.0), 2.0) * clamp(0.6 + 0.6 * dot(ng, uRimDir), 0.0, 1.0);
  vec3 lit = uKeyCol * keyLit + uRimCol * (rimLit + 1.5 * thru) + uSky * (0.55 + 0.45 * n.y);
  vec3 albedo = mix(vec3(0.7, 0.8, 0.93), vec3(0.93, 0.95, 0.98), smoothstep(0.08, 0.7, h0));
  vec3 col = albedo * (lit * 0.3183 + stageGrid(vStageLocal * 0.9) * 0.6) * uGlint.w * (uGlassThru.y + uGlassThru.z * smoothstep(0.04, 0.6, h0));
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  vec3 spark = frostGlints(ga * ${RS.toFixed(2)}, pxMm, ng, v) * uGlint.x * (0.06 + 1.5 * m0.b * on) * smoothstep(0.02, 0.25, alpha);
  gl_FragColor = vec4(col * alpha + spark, alpha);
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
uniform vec4 uFoot;
uniform vec3 uPool;
vec3 frostSlabLight(vec3 n, vec2 xz, vec3 albedo) {
  float d = length(xz - uFoot.xy);
  float lift = uFoot.w;
  float contact = (0.8 / (1.0 + lift * 0.1)) * (1.0 - smoothstep(uFoot.z * 0.85, uFoot.z * (1.5 + lift * 0.03), d));
  vec2 throwAt = uFoot.xy - uKeyDir.xz / max(uKeyDir.y, 0.2) * (40.0 + lift);
  float thrown = 0.45 * (1.0 - smoothstep(uFoot.z * 0.6, uFoot.z * 1.5, length(xz - throwAt)));
  float shade = mix(1.0, (1.0 - contact) * (1.0 - thrown), 0.75);
  float pool = exp(-d * d / (2.0 * ${KEY_POOL_MM.toFixed(1)} * ${KEY_POOL_MM.toFixed(1)}));
  float wrapK = clamp(dot(n, uKeyDir) * 0.7 + 0.3, 0.0, 1.0) * shade * pool;
  float wrapR = clamp(dot(n, uRimDir) * 0.6 + 0.4, 0.0, 1.0);
  vec3 lit = uKeyCol * wrapK + uRimCol * wrapR * 0.6 + uSky * (0.55 + 0.45 * n.y) * (1.0 - 0.45 * contact);
  vec3 glow = uPool * (uSlabLook.y * exp(-d * d / (2.0 * 110.0 * 110.0)) * (1.0 - 0.6 * contact));
  return albedo * (lit * 0.3183 + glow);
}
`

const SHEET = `
${SLAB_GLSL}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (frostHidden(uGrow.w)) discard;
  vec2 xz = vStageWorld.xz;
  vec2 uv = vec2(xz.x + uField.x, uField.x - xz.y) / (2.0 * uField.x);
  vec2 guv = xz * uField.w;
  vec3 grain = texture(uGrain, guv).rgb;
  vec3 fine = texture(uGrain, guv * 3.0 + 0.37).rgb;
  float fw = max(length(dFdx(uv)), length(dFdy(uv)));
  float e = max(min(length(dFdx(uv)), length(dFdy(uv))), uField.y) * 1.2;
  float lvl = uGrow.y + (grain.r - 0.33) * 0.07 + (fine.r - 0.33) * 0.03;
  vec3 m0 = texture(uSlabMap, uv).rgb;
  vec3 m1 = texture(uSlabMap, uv + vec2(e, 0.0)).rgb;
  vec3 m2 = texture(uSlabMap, uv - vec2(0.0, e)).rgb;
  float on = smoothstep(0.0, FROST_SOFT, lvl - m0.g);
  float h0 = m0.r * on;
  float h1 = m1.r * smoothstep(0.0, FROST_SOFT, lvl - m1.g);
  float h2 = m2.r * smoothstep(0.0, FROST_SOFT, lvl - m2.g);
  float body = h0 * (0.65 + 0.7 * grain.r);
  vec2 slope = uField.z * uSlabLook.z * vec2(h1 - h0, h2 - h0) / (e * 2.0 * uField.x);
  vec2 micro = ((grain.gb - 0.5) * 1.2 + (fine.gb - 0.5) * 0.8) * uSlabLook.w * (0.2 + 0.8 * smoothstep(0.0, 0.25, h0));
  vec3 n = normalize(vec3(-slope.x - micro.x, 1.0, -slope.y + micro.y));
  vec3 v = normalize(vStageWorld - cameraPosition);
  float mu = max(-v.y, 0.0);
  float alpha = max(1.0 - exp(-uSlabLook.x * body / max(mu, 0.2)), smoothstep(0.1, 0.38, body));
  vec3 albedo = mix(vec3(0.8, 0.87, 0.96), vec3(0.96, 0.97, 0.98), smoothstep(0.05, 0.4, h0));
  vec3 col = frostSlabLight(n, xz, albedo);
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  vec3 spark = frostGlints(xz, pxMm, vec3(0.0, 1.0, 0.0), v) * uGlint.y * (0.05 + 1.5 * m0.b * on) * smoothstep(0.02, 0.25, alpha);
  gl_FragColor = vec4(col * alpha + spark, alpha);
  if (uDiag != 0) {
    if (alpha < 0.3) discard;
    gl_FragColor = stageDiag(albedo, n, 0.0, c, fw / uField.y);
  } else if (alpha < 0.004) discard;
}`

const SHAPES = `
${SLAB_GLSL}
varying vec3 vFrostN;
varying vec2 vFrostOn;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (frostHidden(uGrow.w)) discard;
  if (vFrostOn.x < 0.03) discard;
  vec2 xz = vStageWorld.xz;
  vec2 guv = xz * uField.w;
  vec3 grain = texture(uGrain, guv).rgb;
  vec3 fine = texture(uGrain, guv * 3.0 + 0.37).rgb;
  vec2 micro = ((grain.gb - 0.5) * 1.2 + (fine.gb - 0.5) * 0.8) * uSlabLook.w;
  vec3 n = normalize(normalize(vFrostN) + vec3(-micro.x, 0.0, micro.y) * 0.7);
  vec3 v = normalize(vStageWorld - cameraPosition);
  vec3 albedo = vec3(0.95, 0.965, 0.98) * (0.86 + 0.14 * vFrostOn.y);
  vec3 col = frostSlabLight(n, xz, albedo);
  float pxMm = sqrt(length(dFdx(vStageWorld)) * length(dFdy(vStageWorld)));
  vec3 spark = frostGlints(xz + vStageWorld.y * 3.1, pxMm, normalize(vFrostN), v) * uGlint.y * 1.3;
  gl_FragColor = vec4(col + spark, 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, n, 0.0, c, 0.0);
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

function makeGlass(): THREE.Mesh {
  const m = stageShader({
    part: GLASS_PART,
    standIn: false,
    change: 'glass-dressing',
    textured: true,
    texels: 1 / frostUniforms.uShape.value.y,
    uniforms: { ...roomUniforms, ...lightUniforms, uGlassMap: frostUniforms.uGlassMap, uGrain: frostUniforms.uGrain, uGrow: frostUniforms.uGrow, uShape: frostUniforms.uShape, uGlassLook: frostUniforms.uGlassLook, uGlassThru: frostUniforms.uGlassThru, uGlint: frostUniforms.uGlint },
    vertexPars: 'varying vec3 vAxisX;\nvarying vec3 vAxisY;\nvarying vec3 vAxisZ;',
    vertexMain: 'vAxisX = normalize(modelMatrix[0].xyz);\nvAxisY = normalize(modelMatrix[1].xyz);\nvAxisZ = normalize(modelMatrix[2].xyz);',
    fragment: GLASS,
    params: { ...veil },
  })
  const mesh = new THREE.Mesh(geometry(MODEL, 'glass'), m)
  mesh.renderOrder = 11
  mesh.frustumCulled = false
  return mesh
}

function makeSurface(): THREE.Group {
  const shared = { ...roomUniforms, ...lightUniforms, uSlabMap: frostUniforms.uSlabMap, uGrain: frostUniforms.uGrain, uGrow: frostUniforms.uGrow, uField: frostUniforms.uField, uSlabLook: frostUniforms.uSlabLook, uGlint: frostUniforms.uGlint, uFoot: surfaceUniforms.uFoot, uPool: surfaceUniforms.uPool }
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
      vertexPars: 'uniform vec4 uGrow;\nvarying vec3 vFrostN;\nvarying vec2 vFrostOn;',
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
vFrostOn = vec2(frostOn, uv.y);`,
      fragment: SHAPES,
    }),
  )
  shapes.renderOrder = 2
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
