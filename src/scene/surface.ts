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
export const KEY_POOL_MM = 650
export const SLAB_DETAIL = 'shared/scene-slab-detail.lin.tile.png'
export const SLAB_DETAIL_PX = 2048

export const SLAB_SHAPE = { turnDeg: 18, farMm: 328, nearMm: 620, halfWidthMm: 900, cornerMm: 14 }

export const SLAB = {
  fineMm: 163,
  broadMm: 613,
  broadTurnDeg: 15,
  normalFine: 0.5,
  normalBroad: 0.0016,
  dustFine: 0.85,
  dustBroad: 0.35,
  dustAlbedo: 0.16,
  vein: 1.4,
  f0: 0.05,
  roughSpread: 0.0115,
  roomRough: 0.09,
  mirrorTaps: 13,
  mirrorMaxPx: 0.05,
  farPathMm: 2600,
  fadeHeightMm: 170,
  fadeFloor: 0.42,
  poolGain: 9,
  poolRiseMm: 46,
  contactMm: 7,
  shadowReach: 0.6,
  bakedGain: 0.5,
}

const f = (v: number) => v.toFixed(4)
const turn = (SLAB_SHAPE.turnDeg * Math.PI) / 180
const broadTurn = (SLAB.broadTurnDeg * Math.PI) / 180

export const SLAB_SHAPE_GLSL = `
float slabInside(vec2 p) {
  vec2 q = vec2(p.x * ${f(Math.cos(turn))} - p.y * ${f(Math.sin(turn))}, p.x * ${f(Math.sin(turn))} + p.y * ${f(Math.cos(turn))});
  vec2 d = abs(q - vec2(0.0, ${f((SLAB_SHAPE.nearMm - SLAB_SHAPE.farMm) / 2)})) - vec2(${f(SLAB_SHAPE.halfWidthMm)}, ${f((SLAB_SHAPE.nearMm + SLAB_SHAPE.farMm) / 2)}) + ${f(SLAB_SHAPE.cornerMm)};
  return ${f(SLAB_SHAPE.cornerMm)} - length(max(d, 0.0)) - min(max(d.x, d.y), 0.0);
}
`

const blank = new THREE.DataTexture(new Uint8Array([128, 128, 0, 0]), 1, 1)
blank.needsUpdate = true
const dark = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
dark.needsUpdate = true

export const surfaceUniforms = {
  uSlab: { value: new THREE.Color(0.0016, 0.0022, 0.0032) },
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyCol: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() },
  uFoot: { value: new THREE.Vector4(0, 0, footRadius, 0) },
  uLean: { value: new THREE.Vector4(0, 0, 0, 0) },
  uPool: { value: new THREE.Color() },
  uReflect: { value: new THREE.Vector4(1, 0, 0, 0) },
  uBaked: { value: new THREE.Color() },
  uMirror: { value: dark as THREE.Texture },
  uMirrorSize: { value: new THREE.Vector4(1, 1, 1, 0) },
  uDetail: { value: blank as THREE.Texture },
}

const SLAB_FRAG = `${ROOM_GLSL}
${FAR_GLSL}
${SLAB_SHAPE_GLSL}
uniform vec3 uSlab;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uSky;
uniform vec4 uFoot;
uniform vec4 uLean;
uniform vec3 uPool;
uniform vec4 uReflect;
uniform vec3 uBaked;
uniform sampler2D uMirror;
uniform vec4 uMirrorSize;
uniform sampler2D uDetail;
float discShare(float x) {
  x = clamp(x, -1.0, 1.0);
  return 0.5 + (asin(x) + x * sqrt(1.0 - x * x)) * 0.31830989;
}
float capsule(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}
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
  vec2 uvB = vec2(P.x * ${f(Math.cos(broadTurn))} + P.z * ${f(Math.sin(broadTurn))}, P.z * ${f(Math.cos(broadTurn))} - P.x * ${f(Math.sin(broadTurn))}) / ${f(SLAB.broadMm)};
  vec2 ax = dFdx(uvA);
  vec2 ay = dFdy(uvA);
  vec4 fine = textureGrad(uDetail, uvA, ax * spread, ay * spread);
  vec4 broad = textureGrad(uDetail, uvB, dFdx(uvB) * spread, dFdy(uvB) * spread);
  vec2 tilt = (fine.rg - 0.5) * ${f(2 * SLAB.normalFine)};
  vec2 wave = (broad.rg - 0.5) * ${f(2 * SLAB.normalBroad)};
  vec3 n = normalize(vec3(tilt.x, 1.0, tilt.y));
  float dust = clamp(fine.a * ${f(SLAB.dustFine)} + broad.a * ${f(SLAB.dustBroad)}, 0.0, 1.0);
  float vein = broad.b;

  vec2 q = P.xz - uFoot.xy - uLean.xy;
  float d = length(q);
  float lift = uFoot.w;
  float gap = d - uFoot.z;
  float tight = exp(-max(gap, 0.0) / (${f(SLAB.contactMm)} + 0.9 * lift)) / (1.0 + 0.07 * lift);
  float wide = (1.0 - smoothstep(-0.25 * uFoot.z, uFoot.z * (${f(SLAB.shadowReach)} + 0.035 * lift), gap)) * 0.6 / (1.0 + 0.045 * lift);
  float under = (1.0 - smoothstep(-5.0 - lift, 1.0 + 0.6 * lift, gap)) / (1.0 + 0.05 * lift);
  float occl = (1.0 - 0.85 * tight) * (1.0 - wide) * (1.0 - 0.9 * under);

  vec2 along = uKeyDir.xz / max(uKeyDir.y, 0.25);
  vec2 foot = uFoot.xy + uLean.xy;
  float rise = ${f(G.baseHeightMm)};
  float baseFar = length(along) * (lift + rise);
  float baseSoft = 2.5 + 0.11 * baseFar + 0.5 * lift;
  float baseShade = 1.0 - smoothstep(-baseSoft, baseSoft, capsule(P.xz, foot - along * lift, foot - along * (lift + rise)) - uFoot.z);
  vec2 ball = P.xz - (foot - along * (lift + ${f(centreHeight)}));
  vec2 dirL = along / max(length(along), 1e-3);
  float stretch = sqrt(1.0 + dot(along, along));
  float ballAt = length(vec2(dot(ball, dirL) / stretch, dot(ball, vec2(-dirL.y, dirL.x)))) / ${f(globeRadius)};
  float ballShade = 0.5 * (1.0 - smoothstep(0.72, 1.12, ballAt));
  float caustic = 2.2 * exp(-ballAt * ballAt / 0.06);
  float pool = exp(-dot(P.xz - uFoot.xy, P.xz - uFoot.xy) / ${f(2 * KEY_POOL_MM * KEY_POOL_MM)});
  vec3 key = uKeyCol * (max(dot(n, uKeyDir), 0.0) * pool * (1.0 - baseShade) * (1.0 - ballShade + caustic));

  float source = ${f(centreHeight)} + lift;
  float glowFall = pow(source * source / (source * source + d * d), 1.5);
  float glowRise = smoothstep(uFoot.z - 4.0, uFoot.z + ${f(SLAB.poolRiseMm)} + lift, d);
  vec3 warm = uPool * (${f(SLAB.poolGain)} * glowFall * glowRise);

  vec3 albedo = uSlab * (1.0 + ${f(SLAB.vein)} * vein);
  vec3 scatter = albedo + vec3(${f(SLAB.dustAlbedo)}) * dust;
  vec3 col = scatter * (key + uSky * occl + warm * occl);

  vec3 r0 = vec3(v.x, -v.y, v.z);
  vec2 ground = v.xz / max(length(v.xz), 1e-4);
  vec2 slope = wave + tilt * 0.006;
  vec3 r = normalize(r0 + 2.0 * vec3(slope.x * grazing, -dot(v.xz, slope), slope.y * grazing));
  float fres = ${f(SLAB.f0)} + ${f(1 - SLAB.f0)} * pow(1.0 - clamp(grazing, 0.0, 1.0), 5.0);

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

  vec3 seen = vec3(0.0);
  float held = 0.0;
  if (uReflect.x > 0.5) {
    vec2 st = gl_FragCoord.xy * uMirrorSize.xy;
    vec2 kick = vec2(dot(slope, vec2(-ground.y, ground.x)) * grazing, dot(slope, ground)) * 2.0 * reach * uFocal;
    float gapPx = 2.0 * tall / ${f(SLAB.mirrorTaps - 1)};
    float lod = log2(max(gapPx * uMirrorSize.z, 1.0));
    float total = 0.0;
    for (int i = 0; i < ${SLAB.mirrorTaps}; i++) {
      float u = float(i) / ${f(SLAB.mirrorTaps - 1)} * 2.0 - 1.0;
      float w = exp(-2.6 * u * u);
      vec4 m = textureLod(uMirror, st + (kick + vec2(0.0, u * tall)) * uMirrorSize.xy, lod);
      seen += w * m.rgb * mix(1.0 - m.a, 1.0, sil);
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
  vec3 room = stageRoomSoft(r, ${f(SLAB.roomRough)});
  col += (seen * fade + room * (1.0 - held)) * fres * (1.0 - 0.6 * dust);

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
  float d = length(vStageWorld.xz - uFoot.xy);
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
  const ring = new THREE.Mesh(new THREE.RingGeometry(footRadius - 1, d.reachMm, 96, 1), m)
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
  su.uKeyDir.value.copy(f.keyDir)
  su.uKeyCol.value.copy(f.keyCol)
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
