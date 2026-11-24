import * as THREE from 'three'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'

const GRID_CELLS = 32
const GRID_PAGES = 3
const SHADOW_TAPS = 8
const SHADOW_STEPS_MM = [0, 3, 9, 27] as const
const SHADOW_SPANS_MM = [3, 6, 18, 54] as const

export const lightGridShape = { cells: GRID_CELLS, pages: GRID_PAGES } as const

const names = (re: RegExp): string[] => [...ROOM_GLSL.matchAll(re)].map((m) => m[1]!)
const roomNames = [
  ...new Set([
    ...names(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+(\w+)/g),
    ...names(/^[ \t]*(?:float|int|bool|vec[234]|mat[234]|void)\s+(\w+)\s*\(/gm),
    ...names(/^[ \t]*(?:const\s+\w+|#define)\s+(\w{3,})/gm),
    ...names(/^[ \t]*struct\s+(\w+)/gm),
  ]),
]
const ROOM_LIT = roomNames.reduce((src, name) => src.replace(new RegExp(`(?<![.\\w])${name}\\b`, 'g'), `${name}Lit`), ROOM_GLSL)
const roomLit: Record<string, THREE.IUniform> = {}
for (const [name, holder] of Object.entries(roomUniforms)) roomLit[`${name}Lit`] = holder

export const lightUniforms = {
  uGridA: { value: null as THREE.Texture | null },
  uGridB: { value: null as THREE.Texture | null },
  uGrid: { value: new THREE.Vector4(0, 1, 1, 1) },
  uGridGainA: { value: new THREE.Vector4(1, 1, 1, 1) },
  uGridGainB: { value: new THREE.Vector4(1, 1, 1, 1) },
  uGridShade: { value: new THREE.Vector4(0.25, 0.3, 1, 0.3) },
  uLightFrame: { value: new THREE.Matrix3() },
  uLightGlow: { value: new THREE.Vector4(0, 0, 0, 0) },
  uLightGlowAt: { value: new THREE.Vector4(0, 0, 0, 1) },
  uRigKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uRigKeyCol: { value: new THREE.Color(0, 0, 0) },
  uRigRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uRigRimCol: { value: new THREE.Color(0, 0, 0) },
  uRigCardDir: { value: new THREE.Vector3(0, 1, 0) },
  uRigCardCol: { value: new THREE.Color(0, 0, 0) },
  uRigSky: { value: new THREE.Color(0, 0, 0) },
  uRigGround: { value: new THREE.Color(0, 0, 0) },
  uRigShadow: { value: new THREE.Vector4(0.15, 0.3, 0.001, 0.4) },
  uRigShadowUv: { value: new THREE.Vector4(0.004, 0.004, 5, 2) },
  uRigInside: { value: new THREE.Vector4(0.9, 0.25, 0.25, 1.5) },
  uRigLobe: { value: new THREE.Vector4(0.2, 1, 0.1, 1) },
  uRigRoom: { value: new THREE.Vector4(1, 1, 0.5, 0.6) },
  ...roomLit,
}

const f1 = (v: number) => v.toFixed(1)

export const LIGHT_FRAG_PARS = `
uniform highp sampler3D uGridA;
uniform highp sampler3D uGridB;
uniform vec4 uGrid;
uniform vec4 uGridGainA;
uniform vec4 uGridGainB;
uniform vec4 uGridShade;
uniform mat3 uLightFrame;
uniform vec4 uLightGlow;
uniform vec4 uLightGlowAt;
uniform vec3 uRigKeyDir;
uniform vec3 uRigKeyCol;
uniform vec3 uRigRimDir;
uniform vec3 uRigRimCol;
uniform vec3 uRigCardDir;
uniform vec3 uRigCardCol;
uniform vec3 uRigSky;
uniform vec3 uRigGround;
uniform vec4 uRigShadow;
uniform vec4 uRigShadowUv;
uniform vec4 uRigInside;
uniform vec4 uRigLobe;
uniform vec4 uRigRoom;
vec3 stageGridAt(vec3 local, float page) {
  vec3 at = clamp(local / (2.0 * uGrid.w) + 0.5, 0.0, 1.0);
  at.z = (clamp(at.z * ${f1(GRID_CELLS)}, 0.5, ${f1(GRID_CELLS - 0.5)}) + page * ${f1(GRID_CELLS)}) / ${f1(GRID_CELLS * GRID_PAGES)};
  return at;
}
float stageGridGain(vec4 share, vec4 gain) {
  float sum = share.x + share.y + share.z + share.w;
  return sum > 1e-6 ? dot(share, gain) / sum : dot(gain, vec4(0.25));
}
vec3 stageGrid(vec3 local) {
  vec3 a = vec3(0.0);
  vec3 b = vec3(0.0);
  if (uGrid.x < 1.0) a = texture(uGridA, stageGridAt(local, 0.0)).rgb * stageGridGain(texture(uGridA, stageGridAt(local, 2.0)), uGridGainA);
  if (uGrid.x > 0.0) b = texture(uGridB, stageGridAt(local, 0.0)).rgb * stageGridGain(texture(uGridB, stageGridAt(local, 2.0)), uGridGainB);
  return mix(a, b, uGrid.x);
}
void stageGridLit(vec3 local, out vec3 colour, out vec3 toward, out float open) {
  vec4 e = vec4(0.0);
  vec3 m = vec3(0.0);
  if (uGrid.x < 1.0) {
    float gain = stageGridGain(texture(uGridA, stageGridAt(local, 2.0)), uGridGainA) * (1.0 - uGrid.x);
    vec4 c = texture(uGridA, stageGridAt(local, 0.0));
    e += vec4(c.rgb * gain, c.a * (1.0 - uGrid.x));
    m += texture(uGridA, stageGridAt(local, 1.0)).xyz * gain;
  }
  if (uGrid.x > 0.0) {
    float gain = stageGridGain(texture(uGridB, stageGridAt(local, 2.0)), uGridGainB) * uGrid.x;
    vec4 c = texture(uGridB, stageGridAt(local, 0.0));
    e += vec4(c.rgb * gain, c.a * uGrid.x);
    m += texture(uGridB, stageGridAt(local, 1.0)).xyz * gain;
  }
  colour = e.rgb;
  open = e.a;
  toward = m / max(dot(e.rgb, vec3(0.2126, 0.7152, 0.0722)), 1e-5);
}
vec3 stageGridToward(vec3 local) {
  vec3 colour;
  vec3 toward;
  float open;
  stageGridLit(local, colour, toward, open);
  return toward;
}
float stageWrap(float ndl, float wrap) {
  return clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
}
vec3 stageKeyL = vec3(0.0, 1.0, 0.0);
vec3 stageKeyC = vec3(0.0);
float stageKeyS = 1.0;
vec3 stageRimL = vec3(0.0, 1.0, 0.0);
vec3 stageRimC = vec3(0.0);
vec3 stageGridL = vec3(0.0, 1.0, 0.0);
vec3 stageGridC = vec3(0.0);
vec3 stageWraps = vec3(0.0);
float stageOpen = 1.0;
float stageShadeFade(float shade, float ndl, float wrap) {
  return mix(1.0, shade, smoothstep(-wrap, 0.5 * wrap + 0.05, ndl));
}
vec3 stageWrapped(vec3 n, float wrap) {
  float k = dot(n, stageKeyL);
  float r = dot(n, stageRimL);
  float g = dot(n, stageGridL);
  vec3 room = stageKeyC * (stageWrap(k, wrap) * stageShadeFade(stageKeyS, k, wrap) - stageWrap(k, stageWraps.x) * stageShadeFade(stageKeyS, k, stageWraps.x));
  room += stageRimC * (stageWrap(r, wrap) - stageWrap(r, stageWraps.y));
  return max(room, 0.0) * 0.3183098861837907 + stageGridC * max(stageWrap(g, wrap) - stageWrap(g, stageWraps.z), 0.0);
}
vec3 stageThrough(vec3 n, vec3 v, float thin, float tight) {
  float k = pow(clamp(dot(v, -normalize(stageKeyL + n * thin)), 0.0, 1.0), tight);
  float r = pow(clamp(dot(v, -normalize(stageRimL + n * thin)), 0.0, 1.0), tight);
  float g = pow(clamp(dot(v, -normalize(stageGridL + n * thin)), 0.0, 1.0), tight);
  return ((stageKeyC * k + stageRimC * r) * 0.3183098861837907 + stageGridC * g) * stageOpen;
}
#ifdef STANDARD
${ROOM_LIT}
vec2 stageSpiral(int i, float turn) {
  float r = sqrt((float(i) + 0.5) / ${f1(SHADOW_TAPS)});
  float a = float(i) * 2.399963229728653 + turn;
  return vec2(cos(a), sin(a)) * r;
}
float stageKeyShade(sampler2DShadow map, vec3 c, vec3 dx, vec3 dy, float spread) {
  if (c.x <= 0.0 || c.x >= 1.0 || c.y <= 0.0 || c.y >= 1.0 || c.z >= 1.0) return 1.0;
  float det = dx.x * dy.y - dx.y * dy.x;
  vec2 tilt = abs(det) > 1e-14 ? vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / det : vec2(0.0);
  tilt = clamp(tilt, -uRigShadowUv.w, uRigShadowUv.w);
  float perMm = uRigShadow.z;
  float z = c.z - uRigShadow.w * perMm;
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uSeed * 0.6180339887);
  float turn = noise * 6.283185307179586;
  vec2 wide = uRigShadowUv.xy * uRigShadowUv.z;
  vec4 hit = vec4(0.0);
  for (int i = 0; i < ${SHADOW_TAPS}; i++) {
    vec2 o = stageSpiral(i, turn) * wide;
    int level = i - 4 * (i / 4);
    float back = level == 0 ? ${f1(SHADOW_STEPS_MM[0])} : level == 1 ? ${f1(SHADOW_STEPS_MM[1])} : level == 2 ? ${f1(SHADOW_STEPS_MM[2])} : ${f1(SHADOW_STEPS_MM[3])};
    float dark = 1.0 - texture(map, vec3(c.xy + o, z + dot(tilt, o) - back * perMm));
    if (level == 0) hit.x += dark;
    else if (level == 1) hit.y += dark;
    else if (level == 2) hit.z += dark;
    else hit.w += dark;
  }
  hit *= ${f1(4)} / ${f1(SHADOW_TAPS)};
  float any = max(max(hit.x, hit.y), max(hit.z, hit.w));
  if (any <= 0.0) return 1.0;
  float gap = dot(hit, vec4(${SHADOW_SPANS_MM.map(f1).join(', ')})) / any;
  vec2 blur = uRigShadowUv.xy * clamp(spread * gap, uRigShadow.y, uRigShadowUv.z);
  float lit = 0.0;
  for (int i = 0; i < ${SHADOW_TAPS}; i++) {
    vec2 o = stageSpiral(i, turn + 1.9) * blur;
    lit += texture(map, vec3(c.xy + o, z + dot(tilt, o)));
  }
  return lit / ${f1(SHADOW_TAPS)};
}
#endif
`

export const LIGHT_DONE = '#define STAGE_LIGHT_DONE'

export const LIGHT_FRAG = `
vec3 stageLit = vec3(0.0);
{
  float lgFlip = uLensCentre.y < 0.0 ? -1.0 : 1.0;
  vec3 lgMirror = vec3(1.0, lgFlip, 1.0);
  mat3 lgView = mat3(viewMatrix);
  vec3 lgN = inverseTransformDirection(geometryNormal, viewMatrix) * lgMirror;
  vec3 lgV = inverseTransformDirection(geometryViewDir, viewMatrix) * lgMirror;
  vec3 lgNl = uLightFrame * lgN;
  vec3 lgAlbedo = material.diffuseContribution;
  vec3 lgKey = uRigKeyDir;
  float lgThrough = 1.0;
  float lgWrap = 0.0;
  float lgSpread = uRigShadow.x;
  float lgOpen = 1.0;
  #ifdef STAGE_INSIDE
  {
    vec3 lgCol;
    vec3 lgToward;
    float lgAir;
    stageGridLit(vStageLocal, lgCol, lgToward, lgAir);
    stageLit = lgCol;
    lgOpen = mix(uGridShade.w, 1.0, lgAir);
    float lgLen = length(lgToward);
    float lgSided = min(lgLen, 1.0);
    vec3 lgDir = lgToward / max(lgLen, 1e-4);
    reflectedLight.indirectDiffuse += lgCol * mix(uGridShade.x, stageWrap(dot(lgNl, lgDir), uGridShade.y), lgSided) * lgAlbedo;
    vec3 lgDirV = normalize(lgView * ((lgDir * uLightFrame) * lgMirror));
    float lgNdg = saturate(dot(geometryNormal, lgDirV)) * lgSided * uGridShade.z;
    if (lgNdg > 0.0 && lgLen > 1e-3) reflectedLight.directSpecular += lgCol * (PI * lgNdg) * BRDF_GGX(lgDirV, geometryViewDir, geometryNormal, material);
    stageGridL = lgLen > 1e-3 ? lgDirV : geometryNormal;
    stageGridC = lgCol * lgSided;
    vec3 lgKl = uLightFrame * lgKey;
    vec3 lgOff = (vStageLocal - lgKl * dot(vStageLocal, lgKl)) / uGrid.w;
    float lgS2 = dot(lgOff, lgOff);
    lgKey = normalize(lgKl + lgOff * (uRigInside.y * (1.0 + lgS2 * sqrt(lgS2)))) * uLightFrame;
    lgThrough = uRigInside.x;
    lgWrap = uRigInside.z;
    lgSpread *= uRigInside.w;
  }
  #else
  {
    vec3 lgTo = uLightGlowAt.xyz - vStageLocal;
    float lgD2 = max(dot(lgTo, lgTo), 1.0);
    float lgT = (uLightGlow.w - vStageLocal.y) / max(lgTo.y, 1e-3);
    float lgClear = vStageLocal.y >= uLightGlow.w ? 1.0 : smoothstep(0.85 * uLightGlowAt.w, 1.05 * uLightGlowAt.w, length(vStageLocal.xz + lgTo.xz * lgT));
    reflectedLight.indirectDiffuse += uLightGlow.rgb * (lgClear * saturate(dot(lgNl, lgTo) * inversesqrt(lgD2)) / lgD2) * lgAlbedo;
  }
  #endif
  float lgNdk = dot(lgN, lgKey);
  float lgLitK = stageWrap(lgNdk, lgWrap);
  float lgShade = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0 && defined( SHADOWMAP_TYPE_PCF )
  vec3 lgAt = vDirectionalShadowCoord[0].xyz / vDirectionalShadowCoord[0].w;
  vec3 lgDx = dFdx(lgAt);
  vec3 lgDy = dFdy(lgAt);
  if (receiveShadow && lgLitK > 0.0) lgShade = stageKeyShade(directionalShadowMap[0], lgAt, lgDx, lgDy, lgSpread);
  #endif
  vec3 lgKeyC = uRigKeyCol * lgThrough;
  float lgShadeK = stageShadeFade(lgShade, lgNdk, lgWrap);
  vec3 lgKeyV = normalize(lgView * (lgKey * lgMirror));
  reflectedLight.directDiffuse += lgKeyC * (lgLitK * lgShadeK * RECIPROCAL_PI) * lgAlbedo;
  PhysicalMaterial lgSoft = material;
  lgSoft.roughness = min(1.0, material.roughness + uRigLobe.x);
  if (lgNdk > 0.0) reflectedLight.directSpecular += lgKeyC * (uRigLobe.y * lgShade * lgNdk) * BRDF_GGX(lgKeyV, geometryViewDir, geometryNormal, lgSoft);
  float lgNdr = dot(lgN, uRigRimDir);
  vec3 lgRimV = normalize(lgView * (uRigRimDir * lgMirror));
  vec3 lgRimC = uRigRimCol * (lgThrough * lgOpen);
  reflectedLight.directDiffuse += lgRimC * (stageWrap(lgNdr, uRigLobe.z) * RECIPROCAL_PI) * lgAlbedo;
  if (lgNdr > 0.0) reflectedLight.directSpecular += lgRimC * (uRigLobe.w * lgNdr) * BRDF_GGX(lgRimV, geometryViewDir, geometryNormal, lgSoft);
  reflectedLight.directDiffuse += uRigCardCol * (stageWrap(dot(lgN, uRigCardDir), 0.5) * lgOpen * lgThrough * RECIPROCAL_PI) * lgAlbedo;
  reflectedLight.indirectDiffuse += mix(uRigGround, uRigSky, 0.5 + 0.5 * lgN.y) * (lgOpen * RECIPROCAL_PI) * lgAlbedo;
  float lgRough = material.roughness;
  vec3 lgR = normalize(mix(reflect(-lgV, lgN), lgN, lgRough * lgRough));
  vec3 lgRoom = stageRoomSoftLit(lgR, lgRough) * uRigRoom.x;
  if (lgRough < uRigRoom.w) lgRoom += stageRoomLightsLit(lgR, uRigRoom.z * lgRough * lgRough + 0.002) * (uRigRoom.y * (1.0 - lgRough / uRigRoom.w) * mix(1.0, lgShade, smoothstep(0.6, 0.95, dot(lgR, lgKey))));
  reflectedLight.indirectSpecular += lgRoom * (lgThrough * lgOpen) * (material.specularColorBlended * material.dfg.x + material.specularF90 * material.dfg.y);
  #ifdef USE_CLEARCOAT
  {
    vec3 lgNc = inverseTransformDirection(geometryClearcoatNormal, viewMatrix) * lgMirror;
    float lgRc = material.clearcoatRoughness;
    vec3 lgCr = normalize(mix(reflect(-lgV, lgNc), lgNc, lgRc * lgRc));
    vec3 lgCoat = stageRoomSoftLit(lgCr, lgRc) * uRigRoom.x;
    if (lgRc < uRigRoom.w) lgCoat += stageRoomLightsLit(lgCr, uRigRoom.z * lgRc * lgRc + 0.002) * (uRigRoom.y * (1.0 - lgRc / uRigRoom.w));
    clearcoatSpecularIndirect += lgCoat * (lgThrough * lgOpen) * EnvironmentBRDF(geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness);
  }
  #endif
  stageKeyL = lgKeyV;
  stageKeyC = lgKeyC;
  stageKeyS = lgShade;
  stageRimL = lgRimV;
  stageRimC = lgRimC;
  stageWraps = vec3(lgWrap, uRigLobe.z, uGridShade.y);
  stageOpen = lgOpen;
}
${LIGHT_DONE}
`

export function afterLight(shader: { fragmentShader: string }, glsl: string): void {
  shader.fragmentShader = shader.fragmentShader.replace(LIGHT_DONE, `${LIGHT_DONE}\n${glsl}`)
}
