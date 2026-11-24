import * as THREE from 'three'
import { config } from '../config'
import { stageShader } from '../core/materials'
import { hasTexture, texture } from '../core/textures'
import type { SeasonKit } from '../seasons/kit'
import { FAR_GLSL, lensUniforms } from './cameras'
import type { StageFrame } from './frame'
import { ROOM_GLSL, roomUniforms } from './room'

const G = config.globe
const footRadius = G.baseDiameterMm / 2
const globeRadius = G.sphereDiameterMm / 2
const centreHeight = G.baseHeightMm - G.collarDepthMm + globeRadius
export const SLAB_MM = 6000
export const FADE_FROM_MM = 1400
export const FADE_TO_MM = 2900
export const KEY_POOL_MM = 650
export const KEY_CONE = 0.07
export const RIM_NEAR_GAIN = 3
export const SLAB_DETAIL = 'shared/scene-slab-detail.lin.tile.png'
export const SLAB_STONE = 'shared/scene-slab-stone.lin.tile.png'
export const SLAB_DETAIL_PX = 2048

export const SLAB_SHAPE = { turnDeg: 18, farMm: 328, nearMm: 620, halfWidthMm: 900, cornerMm: 14 }

export const SLAB = {
  fineMm: 163,
  crumbMm: 271,
  crumbTurnDeg: -31,
  broadMm: 613,
  broadTurnDeg: 15,
  streakMm: 157,
  streakTurnDeg: 20,
  streakLong: 3,
  washMm: 280,
  washTurnDeg: -25,
  washLong: 2.5,
  slopeFull: 1,
  crumbDust: 0.3,
  dustAlbedo: 0.3,
  vein: 1.1,
  cloud: 0.7,
  markFloor: 0.3,
  markCloud: 8.3,
  markPower: 2.6,
  markWipe: 0.95,
  markMost: 2.6,
  filmAlbedo: 0.002,
  filmTint: [0.7, 1, 1.05],
  hazeAlbedo: 0.012,
  hazeMm: 50,
  gloss: 0.65,
  f0: 0.05,
  fresnelPower: 4.2,
  mirrorShare: 0.5,
  mirrorMark: 0.35,
  farGain: 1.6,
  farFrom: 0.165,
  farTo: 0.125,
  roughSpread: 0.03,
  coreShare: 0.8,
  coreWidth: 0.2,
  farWidth: 0.32,
  roomRough: 0.046,
  mirrorTaps: 25,
  mirrorMaxPx: 0.075,
  farPathMm: 2600,
  farShare: 0.5,
  sideShare: 0.08,
  fadeHeightMm: 170,
  fadeFloor: 0.42,
  poolGain: 4,
  poolRiseMm: 46,
  contactMm: 7,
  shadowReach: 0.6,
  bakedGain: 0.5,
}

const f = (v: number) => v.toFixed(4)
const turn = (SLAB_SHAPE.turnDeg * Math.PI) / 180
const broadTurn = (SLAB.broadTurnDeg * Math.PI) / 180
const crumbTurn = (SLAB.crumbTurnDeg * Math.PI) / 180
const streakTurn = (SLAB.streakTurnDeg * Math.PI) / 180
const washTurn = (SLAB.washTurnDeg * Math.PI) / 180
const tail = (((1 - SLAB.coreShare) / SLAB.coreShare) * Math.sqrt(2 * Math.PI)) / (4 / 3)

export const SLAB_SHAPE_GLSL = `
float slabInside(vec2 p) {
  vec2 q = vec2(p.x * ${f(Math.cos(turn))} - p.y * ${f(Math.sin(turn))}, p.x * ${f(Math.sin(turn))} + p.y * ${f(Math.cos(turn))});
  vec2 d = abs(q - vec2(0.0, ${f((SLAB_SHAPE.nearMm - SLAB_SHAPE.farMm) / 2)})) - vec2(${f(SLAB_SHAPE.halfWidthMm)}, ${f((SLAB_SHAPE.nearMm + SLAB_SHAPE.farMm) / 2)}) + ${f(SLAB_SHAPE.cornerMm)};
  return ${f(SLAB_SHAPE.cornerMm)} - length(max(d, 0.0)) - min(max(d.x, d.y), 0.0);
}
`

export const SLAB_LIGHT_GLSL = `
uniform vec3 uKeyAt;
uniform vec3 uRimAt;
uniform vec4 uFoot;
uniform vec4 uLean;
uniform vec3 uPool;
float slabCapsule(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}
vec2 slabCast(vec2 at, vec2 foot, float lift, vec2 along) {
  float rise = ${f(G.baseHeightMm)};
  float baseFar = length(along) * (lift + rise);
  float baseSoft = 2.5 + 0.11 * baseFar + 0.5 * lift;
  float baseShade = 1.0 - smoothstep(-baseSoft, baseSoft, slabCapsule(at, foot - along * lift, foot - along * (lift + rise)) - uFoot.z);
  vec2 ball = at - (foot - along * (lift + ${f(centreHeight)}));
  vec2 dirL = along / max(length(along), 1e-3);
  float stretch = sqrt(1.0 + dot(along, along));
  float ballAt = length(vec2(dot(ball, dirL) / stretch, dot(ball, vec2(-dirL.y, dirL.x)))) / ${f(globeRadius)};
  return vec2(1.0 - baseShade, ballAt);
}
float slabShade(vec2 at) {
  float lift = uFoot.w;
  float gap = length(at - uFoot.xy - uLean.xy) - uFoot.z;
  float tight = exp(-max(gap, 0.0) / (${f(SLAB.contactMm)} + 0.9 * lift)) / (1.0 + 0.07 * lift);
  float wide = (1.0 - smoothstep(-0.25 * uFoot.z, uFoot.z * (${f(SLAB.shadowReach)} + 0.035 * lift), gap)) * 0.6 / (1.0 + 0.045 * lift);
  float under = (1.0 - smoothstep(-5.0 - lift, 1.0 + 0.6 * lift, gap)) / (1.0 + 0.05 * lift);
  return (1.0 - 0.85 * tight) * (1.0 - wide) * (1.0 - 0.9 * under);
}
void slabLight(vec3 P, out vec3 keyDir, out float keyGain, out vec3 rimDir, out float rimGain, out float occl, out vec3 warm) {
  float lift = uFoot.w;
  vec2 foot = uFoot.xy + uLean.xy;
  float d = length(P.xz - foot);
  vec3 heart = vec3(0.0, ${f(centreHeight)}, 0.0);
  vec3 toKey = uKeyAt - P;
  float keyFar = length(toKey);
  keyDir = toKey / keyFar;
  vec3 keyAxis = uKeyAt - heart;
  float keyReach = length(keyAxis);
  float cone = exp(-(1.0 - dot(keyDir, keyAxis / keyReach)) / ${f(KEY_CONE)});
  vec2 keyCast = slabCast(P.xz, foot, lift, keyDir.xz / max(keyDir.y, 0.25));
  float keyBall = 0.5 * (1.0 - smoothstep(0.72, 1.12, keyCast.y));
  float caustic = 2.2 * exp(-keyCast.y * keyCast.y / 0.06);
  keyGain = cone * keyReach * keyReach / (keyFar * keyFar) * keyCast.x * (1.0 - keyBall + caustic);
  vec3 toRim = uRimAt - P;
  float rimFar = length(toRim);
  rimDir = toRim / rimFar;
  float rimReach = length(uRimAt - heart);
  vec2 rimCast = slabCast(P.xz, foot, lift, rimDir.xz / max(rimDir.y, 0.25));
  float rimBall = 0.5 * (1.0 - smoothstep(0.72, 1.12, rimCast.y));
  rimGain = min(rimReach * rimReach / (rimFar * rimFar), ${f(RIM_NEAR_GAIN)}) * rimCast.x * (1.0 - rimBall);
  float source = ${f(centreHeight)} + lift;
  float glowFall = pow(source * source / (source * source + d * d), 1.5);
  float glowRise = smoothstep(uFoot.z - 4.0, uFoot.z + ${f(SLAB.poolRiseMm)} + lift, d);
  warm = uPool * (${f(SLAB.poolGain)} * glowFall * glowRise);
  occl = slabShade(P.xz);
}
`

const blank = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1)
blank.needsUpdate = true
const dark = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
dark.needsUpdate = true

export const surfaceUniforms = {
  uSlab: { value: new THREE.Color(0.0004, 0.001, 0.0022) },
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyCol: { value: new THREE.Color() },
  uKeyAt: { value: new THREE.Vector3(0, 1000, 0) },
  uRimAt: { value: new THREE.Vector3(0, 1000, 0) },
  uRimCol: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() },
  uFoot: { value: new THREE.Vector4(0, 0, footRadius, 0) },
  uLean: { value: new THREE.Vector4(0, 0, 0, 0) },
  uPool: { value: new THREE.Color() },
  uReflect: { value: new THREE.Vector4(1, 0, 0, 0) },
  uBaked: { value: new THREE.Color() },
  uMirror: { value: dark as THREE.Texture },
  uMirrorSize: { value: new THREE.Vector4(1, 1, 1, 0) },
  uDetail: { value: blank as THREE.Texture },
  uStone: { value: dark as THREE.Texture },
}

export const slabLightUniforms = {
  uKeyAt: surfaceUniforms.uKeyAt,
  uRimAt: surfaceUniforms.uRimAt,
  uFoot: surfaceUniforms.uFoot,
  uLean: surfaceUniforms.uLean,
  uPool: surfaceUniforms.uPool,
}

const SLAB_FRAG = `${ROOM_GLSL}
${FAR_GLSL}
${SLAB_SHAPE_GLSL}
uniform vec3 uSlab;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimCol;
uniform vec3 uSky;
uniform vec4 uReflect;
uniform vec3 uBaked;
uniform sampler2D uMirror;
uniform vec4 uMirrorSize;
uniform sampler2D uDetail;
uniform sampler2D uStone;
vec2 slabSlope(vec4 t) {
  vec2 c = (t.rg * 255.0 - 128.0) / 127.0;
  return vec2(c.x, -c.y) * abs(c) * ${f(SLAB.slopeFull)};
}
float discShare(float x) {
  x = clamp(x, -1.0, 1.0);
  return 0.5 + (asin(x) + x * sqrt(1.0 - x * x)) * 0.31830989;
}
${SLAB_LIGHT_GLSL}
void main() {
  vec3 P = vStageWorld;
  vec3 toP = P - cameraPosition;
  float dist = length(toP);
  vec3 v = toP / dist;
  float depth = max(vStageAux.y, 1.0);
  float grazing = max(-v.y, 0.004);
  float blurPx = lensBlurMm(depth) * uFocal / depth;

  float inside = slabInside(P.xz);
  float perPx = max(length(vec2(dFdx(inside), dFdy(inside))), 1e-4);
  float cover = discShare(inside / (max(blurPx, 0.75) * perPx));
  if (uDiag == 0 && cover < 0.002) discard;

  float spread = max(1.0, 1.7 * blurPx);
  vec2 uvA = P.xz / ${f(SLAB.fineMm)} + vec2(0.37, 0.11);
  vec2 uvC = vec2(P.x * ${f(Math.cos(crumbTurn))} + P.z * ${f(Math.sin(crumbTurn))}, P.z * ${f(Math.cos(crumbTurn))} - P.x * ${f(Math.sin(crumbTurn))}) / ${f(SLAB.crumbMm)} + vec2(0.13, 0.71);
  vec2 uvB = vec2(P.x * ${f(Math.cos(broadTurn))} + P.z * ${f(Math.sin(broadTurn))}, P.z * ${f(Math.cos(broadTurn))} - P.x * ${f(Math.sin(broadTurn))}) / ${f(SLAB.broadMm)};
  vec4 fine = textureGrad(uDetail, uvA, dFdx(uvA) * spread, dFdy(uvA) * spread);
  vec4 crumb = textureGrad(uDetail, uvC, dFdx(uvC) * spread, dFdy(uvC) * spread);
  vec2 uvS = vec2(P.x * ${f(Math.cos(streakTurn))} + P.z * ${f(Math.sin(streakTurn))}, P.z * ${f(Math.cos(streakTurn))} - P.x * ${f(Math.sin(streakTurn))}) / vec2(${f(SLAB.streakMm)}, ${f(SLAB.streakMm * SLAB.streakLong)}) + vec2(0.29, 0.53);
  vec2 uvW = vec2(P.x * ${f(Math.cos(washTurn))} + P.z * ${f(Math.sin(washTurn))}, P.z * ${f(Math.cos(washTurn))} - P.x * ${f(Math.sin(washTurn))}) / vec2(${f(SLAB.washMm)}, ${f(SLAB.washMm * SLAB.washLong)}) + vec2(0.61, 0.17);
  vec4 stone = textureGrad(uStone, uvB, dFdx(uvB) * spread, dFdy(uvB) * spread);
  vec4 fleck = textureGrad(uStone, uvS, dFdx(uvS) * spread, dFdy(uvS) * spread);
  vec4 wash = textureGrad(uStone, uvW, dFdx(uvW) * spread, dFdy(uvW) * spread);
  vec2 turned = slabSlope(crumb);
  vec2 tilt = slabSlope(fine) + vec2(turned.x * ${f(Math.cos(crumbTurn))} - turned.y * ${f(Math.sin(crumbTurn))}, turned.x * ${f(Math.sin(crumbTurn))} + turned.y * ${f(Math.cos(crumbTurn))});
  vec3 n = normalize(vec3(tilt.x, 1.0, tilt.y));
  float dust = clamp(max(fine.b, crumb.b * ${f(SLAB.crumbDust)}), 0.0, 1.0);
  float vein = stone.r;
  float cloud = stone.g;
  float patchy = 0.5 * (wash.g + fleck.g);
  float mark = min(${f(SLAB.markFloor)} + ${f(SLAB.markCloud)} * pow(max(patchy, 1e-4), ${f(SLAB.markPower)}) + ${f(SLAB.markWipe)} * max(wash.b, fleck.b), ${f(SLAB.markMost)});

  float lift = uFoot.w;
  float haze = exp(-max(length(P.xz - uFoot.xy - uLean.xy) - uFoot.z, 0.0) / ${f(SLAB.hazeMm)});

  vec3 film = vec3(${SLAB.filmTint.map(f).join(', ')}) * mark;
  vec3 albedo = uSlab * (1.0 + ${f(SLAB.vein)} * vein + ${f(SLAB.cloud)} * cloud) + film * ${f(SLAB.filmAlbedo)};
  vec3 scatter = albedo + vec3(${f(SLAB.dustAlbedo)}) * dust;
  vec3 keyDir;
  vec3 rimDir;
  vec3 warm;
  float keyGain;
  float rimGain;
  float occl;
  slabLight(P, keyDir, keyGain, rimDir, rimGain, occl, warm);
  vec3 direct = uKeyCol * (max(dot(n, keyDir), 0.0) * keyGain) + uRimCol * (max(dot(n, rimDir), 0.0) * rimGain);
  vec3 col = scatter * (direct + (uSky + warm) * occl) + film * direct * (${f(SLAB.hazeAlbedo)} * haze);

  vec3 r0 = vec3(v.x, -v.y, v.z);
  vec2 ground = v.xz / max(length(v.xz), 1e-4);
  vec2 slope = tilt;
  vec3 r = normalize(r0 + 2.0 * vec3(slope.x * grazing, -dot(v.xz, slope), slope.y * grazing));
  float fres = ${f(SLAB.f0)} + ${f(1 - SLAB.f0)} * pow(1.0 - clamp(grazing, 0.0, 1.0), ${f(SLAB.fresnelPower)});

  float rl = max(length(r0.xz), 1e-4);
  vec2 rdir = r0.xz / rl;
  vec2 fq = P.xz - uFoot.xy;
  float th = -dot(fq, rdir);
  float side = abs(fq.x * rdir.y - fq.y * rdir.x);
  float girth = ${f(globeRadius)};
  float tIn = (th - sqrt(max(girth * girth - side * side, 0.0))) / rl;
  float tGlobe = max(max(tIn, lift / max(r0.y, 1e-3)), 0.0);
  float sil = (1.0 - smoothstep(girth - 1.5, girth + 1.5, side)) * step(0.0, th + girth);
  float path = mix(${f(SLAB.farPathMm)}, tGlobe, sil);
  float reach = path / (dist + path);
  float tall = min(2.0 * ${f(SLAB.roughSpread)} * reach * uFocal, ${f(SLAB.mirrorMaxPx)} * uFocal);
  float height = tGlobe * r0.y;
  float fade = mix(1.0, mix(1.0, ${f(SLAB.fadeFloor)}, smoothstep(0.0, ${f(SLAB.fadeHeightMm)}, height)), sil);

  float tUnder = lift / max(r0.y, 1e-3);
  float underSoft = 1.0 + ${f(SLAB.roughSpread)} * tUnder;
  float underHit = (1.0 - smoothstep(uFoot.z - underSoft, uFoot.z + underSoft, length(P.xz + r0.xz * tUnder - uFoot.xy))) * smoothstep(0.0, 0.5, lift);

  vec3 seen = vec3(0.0);
  float held = 0.0;
  if (uReflect.x > 0.5) {
    vec2 st = gl_FragCoord.xy * uMirrorSize.xy;
    vec2 kick = vec2(dot(slope, vec2(-ground.y, ground.x)) * grazing, dot(slope, ground)) * 2.0 * reach * uFocal;
    kick = clamp(kick, vec2(-1.5 * tall - 2.0), vec2(1.5 * tall + 2.0));
    float gapPx = 2.0 * tall / ${f(SLAB.mirrorTaps - 1)};
    float lod = log2(max(gapPx * uMirrorSize.z * ${f(Math.max(1, Math.sqrt(SLAB.sideShare / SLAB.mirrorTaps) * (SLAB.mirrorTaps - 1)))}, 1.0));
    float total = 0.0;
    float span = mix(${f(SLAB.coreWidth)}, ${f(SLAB.farWidth)}, smoothstep(0.25, 0.7, reach));
    for (int i = 0; i < ${SLAB.mirrorTaps}; i++) {
      float u = float(i) / ${f(SLAB.mirrorTaps - 1)} * 2.0 - 1.0;
      float w = exp(-u * u / (2.0 * span * span)) + ${f(tail)} * span * (1.0 - u * u);
      float across = (fract(float(i) * 0.6180339887 + 0.25) * 2.0 - 1.0) * ${f(SLAB.sideShare)} * tall;
      vec4 m = textureLod(uMirror, st + (kick + vec2(across, u * tall)) * uMirrorSize.xy, lod);
      seen += w * m.rgb * mix((1.0 - m.a) * ${f(SLAB.farShare)}, 1.0, sil);
      held += w * m.a * sil;
      total += w;
    }
    seen /= total;
    held /= total;
  } else if (uReflect.y > 0.5) {
    float soft = 0.004 + 0.02 * reach;
    seen = stageRoomLights(normalize(r + vec3(0.0, 0.5 * ${f(SLAB.roughSpread)} * reach, 0.0)), soft) * 0.6;
    float bodyTop = lift + ${f(G.baseHeightMm)};
    float blurMm = max(${f(SLAB.roughSpread)} * tGlobe * 2.0, 1.0);
    float body = sil * (1.0 - smoothstep(bodyTop - blurMm, bodyTop + blurMm, height)) * smoothstep(lift - blurMm, lift + blurMm, height);
    float domeTop = lift + ${f(centreHeight + globeRadius)};
    float glass = sil * smoothstep(bodyTop - blurMm, bodyTop + blurMm, height) * (1.0 - smoothstep(domeTop - 3.0 * blurMm, domeTop, height));
    vec3 lit = uBaked * (uSky + uKeyCol * 0.22) * ${f(SLAB.bakedGain)};
    seen += lit * body + (uPool * 0.35 + uSky * 0.05) * glass;
    held = clamp(body + glass, 0.0, 1.0);
  }
  seen *= 1.0 - underHit;
  held = max(held, underHit);
  vec3 room = stageRoomSeen(r, ${f(SLAB.roomRough)});
  float farGloss = fres * mark * ${f(SLAB.gloss)} * mix(1.0, ${f(SLAB.farGain)}, smoothstep(${f(SLAB.farFrom)}, ${f(SLAB.farTo)}, grazing));
  float nearGloss = max(fres, ${f(SLAB.mirrorShare)}) * fade * mix(1.0, mark, ${f(SLAB.mirrorMark)});
  col += (seen * mix(farGloss, nearGloss, sil) + room * (1.0 - held) * farGloss) * (1.0 - 0.6 * dust);

  gl_FragColor = vec4(col * cover, 1.0 - cover);
  if (uDiag != 0) {
    if (inside < 0.0) discard;
    vec2 texel = uvA * ${f(SLAB_DETAIL_PX)};
    gl_FragColor = vec4(stageDiag(scatter, n, 0.0, 0.0, max(length(dFdx(texel)), length(dFdy(texel)))).rgb, 0.0);
  }
}`

const DRESSING = `
uniform vec3 uTint;
uniform vec3 uShape;
uniform vec4 uFoot;
uniform vec3 uSky;
uniform vec3 uKeyCol;
uniform vec3 uKeyDir;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  float d = length(vStageWorld.xz);
  float a = uShape.x * (1.0 - smoothstep(uFoot.z, uShape.y, d));
  vec3 col = uTint * (uSky + uKeyCol * max(uKeyDir.y, 0.0)) * 0.22;
  gl_FragColor = vec4(col, a);
  if (uDiag != 0) gl_FragColor = stageDiag(uTint, vec3(0.0, 1.0, 0.0), 0.0, c, 0.0);
  else if (a < 0.004) discard;
}`

export function makeSlab(): THREE.Mesh {
  const m = stageShader({
    part: 'surface',
    standIn: false,
    textured: true,
    texels: SLAB_DETAIL_PX,
    uniforms: { ...surfaceUniforms, ...roomUniforms, ...lensUniforms },
    fragment: SLAB_FRAG,
    params: {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.SrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.SrcAlphaFactor,
      depthWrite: false,
    },
  })
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_MM, SLAB_MM), m)
  slab.rotation.x = -Math.PI / 2
  slab.frustumCulled = false
  slab.renderOrder = -3
  return slab
}

export function makeDressing(kit: SeasonKit): THREE.Mesh {
  const d = kit.surfaceDressing
  const m = stageShader({
    part: `surface-dressing-${kit.season}`,
    change: 'surface-dressing',
    uniforms: {
      uTint: { value: new THREE.Color(d.tint[0], d.tint[1], d.tint[2]) },
      uShape: { value: new THREE.Vector3(d.amount, d.reachMm, 0) },
      uFoot: surfaceUniforms.uFoot,
      uSky: surfaceUniforms.uSky,
      uKeyCol: surfaceUniforms.uKeyCol,
      uKeyDir: surfaceUniforms.uKeyDir,
    },
    fragment: DRESSING,
    params: { transparent: true, depthWrite: false },
  })
  const ring = new THREE.Mesh(new THREE.CircleGeometry(d.reachMm, 96), m)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.08
  ring.userData.standIn = `surface-dressing-${kit.season}`
  ring.renderOrder = 2
  return ring
}

export function updateSurface(f: StageFrame): void {
  const su = surfaceUniforms
  const g = f.globe
  const t = f.mix.base
  if (su.uDetail.value === blank && hasTexture(SLAB_DETAIL)) su.uDetail.value = texture(SLAB_DETAIL)
  if (su.uStone.value === dark && hasTexture(SLAB_STONE)) su.uStone.value = texture(SLAB_STONE)
  su.uKeyDir.value.copy(f.keyDir)
  su.uKeyCol.value.copy(f.keyCol)
  const light = f.mix.light
  const ka = f.from.rig.key.from
  const kb = f.to.rig.key.from
  su.uKeyAt.value.set(ka[0] + (kb[0] - ka[0]) * light, ka[1] + (kb[1] - ka[1]) * light, ka[2] + (kb[2] - ka[2]) * light)
  const ra = f.from.rig.rim.from
  const rb = f.to.rig.rim.from
  su.uRimAt.value.set(ra[0] + (rb[0] - ra[0]) * light, ra[1] + (rb[1] - ra[1]) * light, ra[2] + (rb[2] - ra[2]) * light)
  su.uRimCol.value.copy(f.rimCol)
  su.uSky.value.copy(f.ambient)
  su.uFoot.value.set(g.x, g.z, footRadius, g.y)
  const lean = 0.5 * G.baseHeightMm + g.y
  su.uLean.value.set(-Math.sin(g.tiltZ) * lean, Math.sin(g.tiltX) * lean, 0, 0)
  su.uPool.value.copy(f.pool)
  const mirror = f.view === '' && f.planar
  su.uReflect.value.set(mirror ? 1 : 0, mirror ? 0 : 1, 0, 0)
  const a = f.from.main
  const b = f.to.main
  su.uBaked.value.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}
