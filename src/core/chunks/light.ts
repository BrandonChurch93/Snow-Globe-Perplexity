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
  uGridAir: { value: 0 },
  uLightFrame: { value: new THREE.Matrix3() },
  uLightGlow: { value: new THREE.Vector4(0, 0, 0, 0) },
  uLightGlowAt: { value: new THREE.Vector4(0, 0, 0, 1) },
  uLightFlood: { value: new THREE.Color(0, 0, 0) },
  uLightFloodAt: { value: new THREE.Vector4(60, 0.35, 0.84, 40) },
  uLightFloodFloor: { value: new THREE.Vector4(-79, 50, 0.18, 70) },
  uLightFloodNear: { value: new THREE.Vector2(1, 10) },
  uLightEye: { value: new THREE.Vector3(0, 0, 400) },
  uRigKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uRigKeyIn: { value: new THREE.Vector3(0, 1, 0) },
  uRigKeyCol: { value: new THREE.Color(0, 0, 0) },
  uRigRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uRigRimCol: { value: new THREE.Color(0, 0, 0) },
  uRigCardDir: { value: new THREE.Vector3(0, 1, 0) },
  uRigCardCol: { value: new THREE.Color(0, 0, 0) },
  uRigCard: { value: new THREE.Vector4(0.5, 0.3, 0, 1) },
  uRigBounce: { value: new THREE.Vector4(0, 0, 0, 1) },
  uRigSky: { value: new THREE.Color(0, 0, 0) },
  uRigGround: { value: new THREE.Color(0, 0, 0) },
  uRigShadow: { value: new THREE.Vector4(0.15, 0.3, 0.001, 0.4) },
  uRigShadowUv: { value: new THREE.Vector4(0.004, 0.004, 5, 2) },
  uRigInside: { value: new THREE.Vector4(0.9, 0.25, 0.25, 1.5) },
  uRigLobe: { value: new THREE.Vector4(0.2, 1, 0.1, 1) },
  uRigRoom: { value: new THREE.Vector4(1, 1, 0.5, 0.6) },
  uRigGlow: { value: new THREE.Vector4(0.3, 1, 0.04, 0.3) },
  uRigPoint: { value: new THREE.Vector4(0.14, 0.05, 0.32, 0) },
  ...roomLit,
}

export const gridAir = (lum: number, knee: number): number => {
  const q = lum * lum
  const k = knee * knee
  return (q * q) / Math.max(q * q + k * k, 1e-9)
}

export const floodCore = (offMm: number, reachMm: number): number => {
  const q = 1 + (offMm * offMm) / (reachMm * reachMm)
  return 1 / (q * Math.sqrt(q))
}

const f1 = (v: number) => v.toFixed(1)

export const LIGHT_FRAG_PARS = `
uniform highp sampler3D uGridA;
uniform highp sampler3D uGridB;
uniform vec4 uGrid;
uniform vec4 uGridGainA;
uniform vec4 uGridGainB;
uniform vec4 uGridShade;
uniform float uGridAir;
uniform mat3 uLightFrame;
uniform vec4 uLightGlow;
uniform vec4 uLightGlowAt;
uniform vec3 uLightFlood;
uniform vec4 uLightFloodAt;
uniform vec4 uLightFloodFloor;
uniform vec2 uLightFloodNear;
uniform vec3 uLightEye;
uniform vec3 uRigKeyDir;
uniform vec3 uRigKeyIn;
uniform vec3 uRigKeyCol;
uniform vec3 uRigRimDir;
uniform vec3 uRigRimCol;
uniform vec3 uRigCardDir;
uniform vec3 uRigCardCol;
uniform vec4 uRigCard;
uniform vec4 uRigBounce;
uniform vec3 uRigSky;
uniform vec3 uRigGround;
uniform vec4 uRigShadow;
uniform vec4 uRigShadowUv;
uniform vec4 uRigInside;
uniform vec4 uRigLobe;
uniform vec4 uRigRoom;
uniform vec4 uRigGlow;
uniform vec4 uRigPoint;
vec3 stageGridAt(vec3 local, float page) {
  vec3 at = clamp(local / (2.0 * uGrid.w) + 0.5, 0.0, 1.0);
  at.z = (clamp(at.z * ${f1(GRID_CELLS)}, 0.5, ${f1(GRID_CELLS - 0.5)}) + page * ${f1(GRID_CELLS)}) / ${f1(GRID_CELLS * GRID_PAGES)};
  return at;
}
float stageGridGain(vec4 share, vec4 gain) {
  float sum = share.x + share.y + share.z + share.w;
  return sum > 1e-6 ? dot(share, gain) / sum : dot(gain, vec4(0.25));
}
vec3 stageFlood(vec3 local) {
  vec3 d = local - uLightGlowAt.xyz;
  float along = dot(d, normalize(local - uLightEye));
  float q = 1.0 + max(dot(d, d) - along * along, 0.0) / (uLightFloodAt.w * uLightFloodAt.w);
  return uLightFlood * (uLightFloodAt.z / (q * sqrt(q)));
}
vec3 stageGridAir(vec3 colour) {
  float l = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  float q = l * l;
  return colour * (q * q / max(q * q + uGridAir * uGridAir, 1e-9));
}
vec3 stageGrid(vec3 local) {
  vec3 a = vec3(0.0);
  vec3 b = vec3(0.0);
  if (uGrid.x < 1.0) a = stageGridAir(texture(uGridA, stageGridAt(local, 0.0)).rgb) * stageGridGain(texture(uGridA, stageGridAt(local, 2.0)), uGridGainA);
  if (uGrid.x > 0.0) b = stageGridAir(texture(uGridB, stageGridAt(local, 0.0)).rgb) * stageGridGain(texture(uGridB, stageGridAt(local, 2.0)), uGridGainB);
  return mix(a, b, uGrid.x) + stageFlood(local);
}
void stageGridRead(vec3 local, out vec3 colour, out vec3 air, out vec3 toward, out float open, out float shade) {
  vec4 e = vec4(0.0);
  vec3 m = vec3(0.0);
  air = vec3(0.0);
  shade = 0.0;
  if (uGrid.x < 1.0) {
    float gain = stageGridGain(texture(uGridA, stageGridAt(local, 2.0)), uGridGainA) * (1.0 - uGrid.x);
    vec4 c = texture(uGridA, stageGridAt(local, 0.0));
    vec4 d = texture(uGridA, stageGridAt(local, 1.0));
    e += vec4(c.rgb * gain, c.a * (1.0 - uGrid.x));
    air += stageGridAir(c.rgb) * gain;
    m += d.xyz * gain;
    shade += d.a * (1.0 - uGrid.x);
  }
  if (uGrid.x > 0.0) {
    float gain = stageGridGain(texture(uGridB, stageGridAt(local, 2.0)), uGridGainB) * uGrid.x;
    vec4 c = texture(uGridB, stageGridAt(local, 0.0));
    vec4 d = texture(uGridB, stageGridAt(local, 1.0));
    e += vec4(c.rgb * gain, c.a * uGrid.x);
    air += stageGridAir(c.rgb) * gain;
    m += d.xyz * gain;
    shade += d.a * uGrid.x;
  }
  vec3 flood = stageFlood(local);
  colour = e.rgb + flood;
  air += flood;
  open = e.a;
  toward = m / max(dot(colour, vec3(0.2126, 0.7152, 0.0722)), 1e-5);
}
void stageGridLit(vec3 local, out vec3 colour, out vec3 toward, out float open, out float shade) {
  vec3 soft;
  stageGridRead(local, soft, colour, toward, open, shade);
}
vec3 stageGridToward(vec3 local) {
  vec3 colour;
  vec3 toward;
  float open;
  float shade;
  stageGridLit(local, colour, toward, open, shade);
  return toward;
}
float stageGridShade(vec3 local) {
  float a = 1.0;
  float b = 1.0;
  if (uGrid.x < 1.0) a = texture(uGridA, stageGridAt(local, 1.0)).a;
  if (uGrid.x > 0.0) b = texture(uGridB, stageGridAt(local, 1.0)).a;
  return mix(a, b, uGrid.x);
}
float stageGridOpen(vec3 local) {
  float a = 1.0;
  float b = 1.0;
  if (uGrid.x < 1.0) a = texture(uGridA, stageGridAt(local, 0.0)).a;
  if (uGrid.x > 0.0) b = texture(uGridB, stageGridAt(local, 0.0)).a;
  return mix(uGridShade.w, 1.0, mix(a, b, uGrid.x));
}
vec3 stageGridWarm(vec3 local) {
  vec3 a = vec3(0.0);
  vec3 b = vec3(0.0);
  if (uGrid.x < 1.0) a = texture(uGridA, stageGridAt(local, 0.0)).rgb * stageGridGain(texture(uGridA, stageGridAt(local, 2.0)), uGridGainA);
  if (uGrid.x > 0.0) b = texture(uGridB, stageGridAt(local, 0.0)).rgb * stageGridGain(texture(uGridB, stageGridAt(local, 2.0)), uGridGainB);
  return mix(a, b, uGrid.x);
}
vec3 stageKeyBent(vec3 local) {
  vec3 kl = uLightFrame * uRigKeyIn;
  vec3 off = (local - kl * dot(local, kl)) / uGrid.w;
  float s2 = dot(off, off);
  return normalize(kl + off * (uRigInside.y * (1.0 + s2 * sqrt(s2)))) * uLightFrame;
}
vec3 stageKeyIn(vec3 local, out vec3 toward) {
  toward = stageKeyBent(local);
  return uRigKeyCol * (uRigInside.x * stageGridShade(local));
}
vec3 stageSoftIn(vec3 local) {
  return ((uRigSky + uRigGround) * (0.5 * uRigPoint.z) + uRigRimCol * (uRigInside.x * uRigPoint.y)) * stageGridOpen(local);
}
vec3 stageCold(vec3 local) {
  vec3 toward;
  return stageKeyIn(local, toward) * uRigPoint.x + stageSoftIn(local);
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
vec3 stageWrapped(vec3 n, float wrap) {
  float k = dot(n, stageKeyL);
  float r = dot(n, stageRimL);
  float g = dot(n, stageGridL);
  vec3 room = stageKeyC * (stageKeyS * (stageWrap(k, wrap) - stageWrap(k, stageWraps.x)));
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
  float lgShade = 1.0;
  float lgCardIn = 1.0;
  vec4 lgBounce = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef STAGE_INSIDE
  {
    vec3 lgCol;
    vec3 lgToward;
    float lgAir;
    vec3 lgThin;
    stageGridRead(vStageLocal, lgCol, lgThin, lgToward, lgAir, lgShade);
    stageLit = lgCol;
    lgOpen = mix(uGridShade.w, 1.0, lgAir);
    float lgLen = length(lgToward);
    float lgSided = min(lgLen, 1.0);
    vec3 lgDir = lgToward / max(lgLen, 1e-4);
    reflectedLight.indirectDiffuse += lgCol * mix(uGridShade.x, stageWrap(dot(lgNl, lgDir), uGridShade.y), lgSided) * lgAlbedo;
    vec3 lgDirV = normalize(lgView * ((lgDir * uLightFrame) * lgMirror));
    float lgNdg = saturate(dot(geometryNormal, lgDirV)) * lgSided * uGridShade.z;
    if (lgNdg > 0.0 && lgLen > 1e-3) reflectedLight.directSpecular += lgCol * (PI * lgNdg) * BRDF_GGX(lgDirV, geometryViewDir, geometryNormal, material);
    #ifdef USE_CLEARCOAT
    if (lgLen > 1e-3) clearcoatSpecularDirect += lgCol * (PI * saturate(dot(geometryClearcoatNormal, lgDirV)) * lgSided * uGridShade.z) * BRDF_GGX_Clearcoat(lgDirV, geometryViewDir, geometryClearcoatNormal, material);
    #endif
    stageGridL = lgLen > 1e-3 ? lgDirV : geometryNormal;
    stageGridC = lgCol * lgSided;
    lgKey = stageKeyBent(vStageLocal);
    lgThrough = uRigInside.x;
    lgWrap = uRigInside.z;
    lgSpread *= uRigInside.w;
    lgCardIn = uRigCard.w;
    lgBounce = uRigBounce;
  }
  #else
  {
    vec3 lgTo = uLightGlowAt.xyz - vStageLocal;
    float lgD2 = max(dot(lgTo, lgTo), 1.0);
    float lgT = (uLightGlow.w - vStageLocal.y) / max(lgTo.y, 1e-3);
    float lgClear = vStageLocal.y >= uLightGlow.w ? 1.0 : smoothstep(0.85 * uLightGlowAt.w, 1.05 * uLightGlowAt.w, length(vStageLocal.xz + lgTo.xz * lgT));
    vec3 lgGlow = uLightGlow.rgb * (lgClear / lgD2);
    vec3 lgToN = lgTo * inversesqrt(lgD2);
    reflectedLight.indirectDiffuse += lgGlow * saturate(dot(lgNl, lgToN)) * lgAlbedo;
    vec3 lgGlowV = normalize(lgView * ((lgToN * uLightFrame) * lgMirror));
    float lgNdw = saturate(dot(geometryNormal, lgGlowV)) * uRigGlow.y;
    if (lgNdw > 0.0) {
      PhysicalMaterial lgWide = material;
      lgWide.roughness = min(1.0, material.roughness + uRigGlow.x);
      reflectedLight.directSpecular += lgGlow * (PI * lgNdw) * BRDF_GGX(lgGlowV, geometryViewDir, geometryNormal, lgWide);
      #ifdef USE_CLEARCOAT
      lgWide.clearcoatRoughness = min(1.0, material.clearcoatRoughness + uRigGlow.x);
      clearcoatSpecularDirect += lgGlow * (PI * saturate(dot(geometryClearcoatNormal, lgGlowV)) * uRigGlow.y) * BRDF_GGX_Clearcoat(lgGlowV, geometryViewDir, geometryClearcoatNormal, lgWide);
      #endif
    }
    if (uLightFlood.r + uLightFlood.g + uLightFlood.b > 0.0) {
      float lgFar = max(length(vStageLocal), uLightFloodAt.x);
      vec3 lgUp = -vStageLocal / lgFar;
      float lgSize = uLightFloodAt.x / lgFar;
      float lgTurn = dot(lgNl, lgUp);
      float lgBall = lgSize * lgSize * clamp((lgTurn + lgSize * uLightFloodAt.y) / (1.0 + lgSize * uLightFloodAt.y), 0.0, 1.0);
      float lgRise = max(vStageLocal.y - uLightFloodFloor.x, 0.0);
      float lgFloor = uLightFloodFloor.z * (0.5 - 0.5 * lgNl.y) * (1.0 - lgRise * inversesqrt(lgRise * lgRise + uLightFloodFloor.y * uLightFloodFloor.y));
      float lgNear = uLightFloodNear.x * exp((uLightFloodAt.x - lgFar) / uLightFloodNear.y);
      vec3 lgFlood = uLightFlood * (uLightFloodFloor.w * RECIPROCAL_PI);
      reflectedLight.indirectDiffuse += lgFlood * (lgBall + lgNear + lgFloor) * lgAlbedo;
      vec3 lgBallV = normalize(lgView * ((lgUp * uLightFrame) * lgMirror));
      float lgNdb = saturate(dot(geometryNormal, lgBallV)) * lgSize * lgSize;
      if (lgNdb > 0.0) {
        PhysicalMaterial lgWash = material;
        lgWash.roughness = min(1.0, material.roughness + lgSize * 0.5);
        reflectedLight.directSpecular += lgFlood * (PI * lgNdb) * BRDF_GGX(lgBallV, geometryViewDir, geometryNormal, lgWash);
      }
    }
  }
  #endif
  float lgNdk = dot(lgN, lgKey);
  float lgLitK = stageWrap(lgNdk, lgWrap);
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0 && defined( SHADOWMAP_TYPE_PCF )
  vec3 lgAt = vDirectionalShadowCoord[0].xyz / vDirectionalShadowCoord[0].w;
  vec3 lgDx = dFdx(lgAt);
  vec3 lgDy = dFdy(lgAt);
  float lgFacing = dot(lgN, uRigKeyDir);
  #ifdef STAGE_INSIDE
  vec3 lgFace = cross(dFdx(vStageLocal), dFdy(vStageLocal));
  float lgFaceSq = dot(lgFace, lgFace);
  if (lgFaceSq > 1e-20) {
    lgFace *= inversesqrt(lgFaceSq) * (dot(lgFace, lgNl) < 0.0 ? -1.0 : 1.0);
    lgFacing = min(lgFacing, dot(lgFace * uLightFrame, uRigKeyDir));
  }
  #endif
  float lgSure = receiveShadow ? smoothstep(uRigGlow.z, uRigGlow.w, lgFacing) : 0.0;
  if (lgSure > 0.0) lgShade = mix(lgShade, stageKeyShade(directionalShadowMap[0], lgAt, lgDx, lgDy, lgSpread), lgSure);
  #endif
  vec3 lgKeyC = uRigKeyCol * lgThrough;
  float lgShadeK = lgShade;
  vec3 lgKeyV = normalize(lgView * (lgKey * lgMirror));
  reflectedLight.directDiffuse += lgKeyC * (lgLitK * lgShadeK * RECIPROCAL_PI) * lgAlbedo;
  PhysicalMaterial lgSoft = material;
  lgSoft.roughness = min(1.0, material.roughness + uRigLobe.x);
  #ifdef USE_CLEARCOAT
  lgSoft.clearcoatRoughness = min(1.0, material.clearcoatRoughness + uRigLobe.x);
  #endif
  if (lgNdk > 0.0) reflectedLight.directSpecular += lgKeyC * (uRigLobe.y * lgShade * lgNdk) * BRDF_GGX(lgKeyV, geometryViewDir, geometryNormal, lgSoft);
  float lgNdr = dot(lgN, uRigRimDir);
  vec3 lgRimV = normalize(lgView * (uRigRimDir * lgMirror));
  vec3 lgRimC = uRigRimCol * (lgThrough * lgOpen);
  reflectedLight.directDiffuse += lgRimC * (stageWrap(lgNdr, uRigLobe.z) * RECIPROCAL_PI) * lgAlbedo;
  if (lgNdr > 0.0) reflectedLight.directSpecular += lgRimC * (uRigLobe.w * lgNdr) * BRDF_GGX(lgRimV, geometryViewDir, geometryNormal, lgSoft);
  #ifdef USE_CLEARCOAT
  clearcoatSpecularDirect += lgKeyC * (uRigLobe.y * lgShade * saturate(dot(geometryClearcoatNormal, lgKeyV))) * BRDF_GGX_Clearcoat(lgKeyV, geometryViewDir, geometryClearcoatNormal, lgSoft);
  clearcoatSpecularDirect += lgRimC * (uRigLobe.w * saturate(dot(geometryClearcoatNormal, lgRimV))) * BRDF_GGX_Clearcoat(lgRimV, geometryViewDir, geometryClearcoatNormal, lgSoft);
  #endif
  float lgNdc = dot(lgN, uRigCardDir);
  vec3 lgCardC = uRigCardCol * (lgOpen * lgThrough * lgCardIn);
  reflectedLight.directDiffuse += lgCardC * (stageWrap(lgNdc, uRigCard.x) * RECIPROCAL_PI) * lgAlbedo;
  if (lgNdc > 0.0 && uRigCard.z > 0.0) {
    vec3 lgCardV = normalize(lgView * (uRigCardDir * lgMirror));
    PhysicalMaterial lgBroad = material;
    lgBroad.roughness = min(1.0, material.roughness + uRigCard.y);
    reflectedLight.directSpecular += lgCardC * (uRigCard.z * lgNdc) * BRDF_GGX(lgCardV, geometryViewDir, geometryNormal, lgBroad);
    #ifdef USE_CLEARCOAT
    lgBroad.clearcoatRoughness = min(1.0, material.clearcoatRoughness + uRigCard.y);
    clearcoatSpecularDirect += lgCardC * (uRigCard.z * saturate(dot(geometryClearcoatNormal, lgCardV))) * BRDF_GGX_Clearcoat(lgCardV, geometryViewDir, geometryClearcoatNormal, lgBroad);
    #endif
  }
  reflectedLight.indirectDiffuse += (mix(uRigGround, uRigSky, 0.5 + 0.5 * lgN.y) * lgBounce.w + lgBounce.rgb) * (lgOpen * RECIPROCAL_PI) * lgAlbedo;
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
