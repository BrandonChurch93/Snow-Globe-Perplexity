import * as THREE from 'three'
import { lightUniforms } from '../../core/chunks/light'
import { GUST, STAGE_GUST_FRAG_GLSL, STAGE_GUST_GLSL, gustStreaks, gustTwin, stageShader } from '../../core/materials'
import { geometry, prepareModel } from '../../core/models'
import { texture } from '../../core/textures'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { SLAB_LIGHT_GLSL, slabLightUniforms, surfaceUniforms } from '../../scene/surface'
import type { KitMoment } from '../kit'
import { cobweb, FACE_COUNT, faceUniforms } from './base'

// Part `surface-dressing-fall`: the dry leaves that lie round the foot (curled ones near the camera, flat ones further
// off, crumbs at the foot) and the light on the slab at the foot: a rim that parts the black base from the dark slab,
// and the candle light each face throws in front of itself.

const PART = 'surface-dressing-fall'
const MODEL = 'fall/slab-fall.glb'
const SHEET = 'fall/slab-leaves.srgb.w1024.png'

interface LeafExtras {
  footMm: number
  centreSpanMm: number
  sizeSpanMm: number
}

// The skitter. A leaf lies `pushMm` nearer the foot than its place before the landing (less the further off it lies,
// by `reachMm`); the thump's air reaches it at `waveMmPerSecond` and it slides out to its place over `slideSeconds`
// (a longer slide for some), hopping `hopMm` and turning `spin` radians as it goes; one in `tumble` turns over.
const SKITTER = { pushMm: 34, reachMm: 85, waveMmPerSecond: 520, slideSeconds: 0.75, hopMm: 3.2, spin: 2.6, tumble: 0.1, wakeSeconds: 0.05 }
const leafUniforms = {
  uLeafMap: { value: null as THREE.Texture | null },
  uLeafTime: { value: new THREE.Vector4(99, 0, 0, 0) },
  uLeafSpan: { value: new THREE.Vector4(1100, 32, 58, 0) },
  uLeafMove: { value: new THREE.Vector4(SKITTER.pushMm, SKITTER.reachMm, SKITTER.waveMmPerSecond, SKITTER.slideSeconds) },
  uLeafTurn: { value: new THREE.Vector4(SKITTER.hopMm, SKITTER.spin, SKITTER.tumble, 0) },
}

const LEAF_VERT_PARS = `
attribute vec2 uv1;
attribute vec3 color;
uniform vec4 uLeafTime;
uniform vec4 uLeafSpan;
uniform vec4 uLeafMove;
uniform vec4 uLeafTurn;
varying vec2 vLeafUv;
varying vec3 vLeafN;
varying vec4 vLeafOne;
float leafHash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}
${STAGE_GUST_GLSL}
`
const LEAF_VERT_MAIN = `
vec2 leafRest = (color.xy - 0.5) * uLeafSpan.x;
float leafId = uv1.x;
float leafFar = length(leafRest);
vec2 leafDir = leafRest / max(leafFar, 1.0);
float leafGap = max(leafFar - uLeafSpan.z, 0.0);
float leafPush = min(uLeafMove.x * exp(-leafGap / uLeafMove.y) * (0.45 + 0.9 * leafHash(leafId * 3.1)), max(leafGap - 2.0, 0.0));
float leafWait = leafGap / uLeafMove.z + 0.05 * leafHash(leafId * 9.7);
float leafLong = uLeafMove.w * (0.6 + 1.3 * leafHash(leafId * 5.3));
float leafT = clamp((uLeafTime.x - leafWait) / leafLong, 0.0, 1.0);
float leafEase = 1.0 - (1.0 - leafT) * (1.0 - leafT) * (1.0 - leafT);
float leafLeft = 1.0 - leafEase;
float leafLive = leafLeft * smoothstep(0.0, ${SKITTER.wakeSeconds.toFixed(2)}, uLeafTime.x - leafWait);
float leafStir = smoothstep(0.0, 6.0, leafPush);
float leafSide = (leafHash(leafId * 7.9) - 0.5) * 0.9 * leafPush;
vec2 leafAt = leafRest - leafDir * (leafPush * leafLeft) + vec2(-leafDir.y, leafDir.x) * (leafSide * leafLeft * (1.0 - leafLeft) * 4.0 * 0.5);
float leafHops = 2.0 + floor(3.0 * leafHash(leafId * 2.3));
float leafHop = abs(sin(leafEase * 3.14159265 * leafHops)) * leafLive * uLeafTurn.x * (0.4 + leafHash(leafId * 4.1)) * leafStir;
float leafYaw = (leafHash(leafId * 6.7) - 0.5) * 2.0 * uLeafTurn.y * leafLeft * leafStir;
float leafOver = step(leafHash(leafId * 8.3), uLeafTurn.z) * leafStir;
float leafRoll = leafOver * leafLeft * 6.2831853 * (leafHash(leafId * 1.7) < 0.5 ? 1.0 : 2.0) + (1.0 - leafOver) * 0.5 * sin(leafEase * 9.0 + leafId * 40.0) * leafLive * leafStir;
// Inside a change the leaves are carried: blown out ahead of the front of light when fall leaves, flown out behind it when fall comes.
if (uState.w > 0.5) {
  float gustSeed = leafHash(leafId * 11.3);
  vec3 leafGust = stageGust(leafRest, gustSeed, leafHash(leafId * 12.7));
  leafAt += (dot(leafRest, leafRest) > 0.0 ? normalize(leafRest) : vec2(1.0, 0.0)) * leafGust.x;
  leafHop += ${GUST.heightMm.toFixed(1)} * (0.4 + 0.6 * leafHash(leafId * 12.7)) * leafGust.y;
  float gustTurns = uState.w < 1.5 ? 1.0 + 0.4 * gustSeed : 1.0 + floor(gustSeed * 2.99);
  leafRoll += 3.14159265 * gustTurns * leafGust.z;
  leafYaw += (leafHash(leafId * 12.7) - 0.5) * 3.0 * leafGust.z;
}
vec3 leafOff = vec3(position.x - leafRest.x, position.y, position.z - leafRest.y);
float leafCy = cos(leafYaw);
float leafSy = sin(leafYaw);
leafOff = vec3(leafOff.x * leafCy + leafOff.z * leafSy, leafOff.y, -leafOff.x * leafSy + leafOff.z * leafCy);
vec3 leafNo = vec3(normal.x * leafCy + normal.z * leafSy, normal.y, -normal.x * leafSy + normal.z * leafCy);
vec3 leafAxis = vec3(-leafDir.y, 0.0, leafDir.x);
float leafCr = cos(leafRoll);
float leafSr = sin(leafRoll);
leafOff = leafOff * leafCr + cross(leafAxis, leafOff) * leafSr + leafAxis * dot(leafAxis, leafOff) * (1.0 - leafCr);
leafNo = leafNo * leafCr + cross(leafAxis, leafNo) * leafSr + leafAxis * dot(leafAxis, leafNo) * (1.0 - leafCr);
float leafSize = color.z * uLeafSpan.y;
float leafUp = leafHop + leafSize * 0.55 * abs(sin(leafRoll)) + 0.06;
vec3 leafPlace = vec3(leafAt.x + leafOff.x, max(leafOff.y + leafUp, 0.03), leafAt.y + leafOff.z);
vec4 leafW = modelMatrix * vec4(leafPlace, 1.0);
vec4 leafV = viewMatrix * leafW;
gl_Position = projectionMatrix * leafV;
vStageWorld = leafW.xyz;
vStageLocal = (uGlobeInv * leafW).xyz;
vStageAux = vec3(0.0, -leafV.z, length(leafV.xyz));
vStagePlaced = leafW.xyz;
vLeafUv = uv;
vLeafN = normalize(mat3(modelMatrix) * leafNo);
vLeafOne = vec4(leafId, uv1.y, leafLive, leafFar);
`

const CANDLE_GLSL = `
uniform vec3 uFaceAt[${FACE_COUNT}];
uniform vec4 uFaceOut[${FACE_COUNT}];
uniform float uFaceGlow[${FACE_COUNT}];
uniform vec3 uFaceCol;
vec3 candleOnSlab(vec3 P, vec3 n, float lift) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${FACE_COUNT}; i++) {
    vec3 at = vec3(uFaceAt[i].x + uFoot.x, uFaceAt[i].y + lift, uFaceAt[i].z + uFoot.y);
    vec3 to = at - P;
    float far = length(to);
    vec3 l = to / max(far, 0.01);
    vec3 out3 = vec3(uFaceOut[i].x, 0.0, uFaceOut[i].y);
    float cone = smoothstep(-0.1, 0.55, dot(-l, normalize(out3 + vec3(0.0, -0.35, 0.0))));
    float size = uFaceOut[i].z;
    sum += uFaceCol * (uFaceGlow[i] * cone * size * size / (far * far + size * size) * clamp(dot(n, l) * 0.7 + 0.3, 0.0, 1.0));
  }
  return sum;
}
// The faces seen in the wet slab: each is mirrored below it, and the roughness of the slab draws the mirror image out
// along the line of sight, so a streak of it reaches up to the foot.
#define MIRROR_DEPTH 0.5
vec3 candleInSlab(vec3 P, float lift) {
  vec3 look = normalize(P - cameraPosition);
  vec3 side = dot(look.xz, look.xz) > 0.0 ? normalize(cross(vec3(0.0, 1.0, 0.0), look)) : vec3(1.0, 0.0, 0.0);
  vec3 rise = cross(look, side);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${FACE_COUNT}; i++) {
    vec3 at = vec3(uFaceAt[i].x + uFoot.x, -(MIRROR_DEPTH * uFaceAt[i].y + lift), uFaceAt[i].z + uFoot.y);
    vec3 to = at - cameraPosition;
    float far = length(to);
    vec3 off = to / far - look;
    float size = uFaceOut[i].z / far;
    float across = dot(off, side) / (size * 0.36);
    float along = dot(off, rise) / (size * 1.25);
    float seen = smoothstep(0.1, 0.6, dot(vec3(uFaceOut[i].x, 0.0, uFaceOut[i].y), dot(to.xz, to.xz) > 0.0 ? normalize(vec3(-to.x, 0.0, -to.z)) : vec3(uFaceOut[i].x, 0.0, uFaceOut[i].y)));
    float core = exp(-across * across - along * along);
    sum += uFaceCol * mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.8, 0.5), core * core) * (uFaceGlow[i] * seen * core);
  }
  return sum;
}
`

const LEAF_FRAG = `
uniform sampler2D uLeafMap;
uniform vec3 uKeyCol;
uniform vec3 uRimCol;
uniform vec3 uSky;
varying vec2 vLeafUv;
varying vec3 vLeafN;
varying vec4 vLeafOne;
${ROOM_GLSL}
${SLAB_LIGHT_GLSL}
${CANDLE_GLSL}
${STAGE_GUST_FRAG_GLSL}
void main() {
#ifdef STAGE_STREAK
  if (stageGustElse()) discard;
#endif
  float c = stageChange();
  if (stageGone(c)) discard;
  vec4 leaf = texture2D(uLeafMap, vLeafUv);
  if (leaf.a < 0.5) discard;
  vec3 n = normalize(vLeafN);
  vec3 view = normalize(cameraPosition - vStageWorld);
  float under = step(dot(n, view), 0.0);
  n = mix(n, -n, under);
  vec3 keyDir;
  vec3 rimDir;
  vec3 warm;
  float keyGain;
  float rimGain;
  float occl;
  slabLight(vec3(vStageWorld.x, 0.0, vStageWorld.z), keyDir, keyGain, rimDir, rimGain, occl, warm);
  float tone = 0.6 + 0.6 * fract(vLeafOne.x * 7.3);
  // The leaves fell at different times: russet, a few still ochre, the oldest gone to dark brown.
  float leafAge = fract(vLeafOne.x * 11.9);
  vec3 leafDye = mix(mix(vec3(1.0, 0.7, 0.4), vec3(0.86, 0.66, 0.3), smoothstep(0.78, 0.9, leafAge)), vec3(0.62, 0.3, 0.2), smoothstep(0.42, 0.18, leafAge));
  vec3 albedo = mix(vec3(dot(leaf.rgb, vec3(0.3, 0.5, 0.2))) * leafDye * 1.2, leaf.rgb * 1.1, 0.18 + 0.42 * fract(vLeafOne.x * 3.7)) * tone * mix(1.0, 0.55, smoothstep(0.42, 0.1, leafAge)) * mix(1.0, 0.72, under);
  float key = clamp(dot(n, keyDir) * 0.75 + 0.25, 0.0, 1.0);
  float rim = clamp(dot(n, rimDir) * 0.6 + 0.4, 0.0, 1.0);
  float thru = clamp(-dot(n, keyDir), 0.0, 1.0) * 0.35;
  float shade = mix(0.35, 1.0, occl);
  vec3 lit = uKeyCol * (keyGain * (key + thru)) + uRimCol * (rimGain * rim) + uSky * (0.9 * shade) + warm * 0.6 + uRigCardCol * 0.25 * shade;
  lit += candleOnSlab(vStageWorld, n, uFoot.w) * 3.2;
  vec3 col = albedo * lit * RECIPROCAL_PI;
  vec3 h = normalize(keyDir + view);
  float waxy = pow(max(dot(n, h), 0.0), 60.0) * 0.16 * keyGain;
  vec3 hr = normalize(rimDir + view);
  waxy += pow(max(dot(n, hr), 0.0), 18.0) * 0.22 * rimGain * dot(uRimCol, vec3(0.333)) / max(dot(uKeyCol, vec3(0.333)), 1e-4);
  col += uKeyCol * waxy * (1.0 - under);
  gl_FragColor = vec4(col, 1.0);
  vec2 leafTexel = vLeafUv * 1024.0;
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, n, 0.0, c, max(length(dFdx(leafTexel)), length(dFdy(leafTexel))));
}
`

// The light on the slab at the foot. It is added to the slab, so it is drawn as a sheet that only brightens.
const RIM_FRAG = `
uniform vec3 uKeyCol;
uniform vec3 uRimCol;
uniform vec3 uSky;
uniform vec4 uRimLook;
varying vec3 vRimAt;
${SLAB_LIGHT_GLSL}
${CANDLE_GLSL}
float rimHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float rimNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rimHash(i), rimHash(i + vec2(1.0, 0.0)), f.x), mix(rimHash(i + vec2(0.0, 1.0)), rimHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  vec3 P = vRimAt;
  float lift = uFoot.w;
  vec2 out2 = P.xz - uFoot.xy - uLean.xy;
  float far = length(out2);
  float gap = far - uRimLook.x;
  float down = exp(-lift / uRimLook.w);
  float dust = 0.55 + 0.9 * rimNoise(P.xz * 0.9) * rimNoise(P.xz * 0.23 + 7.0);
  float line = exp(-pow(abs((gap - 1.6) / uRimLook.y), 2.0)) * smoothstep(-1.5, 1.0, gap);
  float skirt = exp(-max(gap, 0.0) / uRimLook.z) * smoothstep(-1.5, 2.0, gap);
  vec2 dir2 = out2 / max(far, 1.0);
  float toRim = clamp(dot(dir2, normalize(uRimAt.xz + vec2(1e-4))) * 0.5 + 0.5, 0.0, 1.0);
  float toKey = clamp(dot(dir2, normalize(uKeyAt.xz + vec2(1e-4))) * 0.5 + 0.5, 0.0, 1.0);
  vec3 cold = uKeyCol * (0.35 + 0.65 * toKey) + uSky * 2.0;
  vec3 hot = uRimCol * (0.3 + 0.7 * toRim);
  // A lifted foot no longer lays its line of dust and its cut in the lanterns' light on the slab: both open and fade with the height.
  vec3 col = (cold * 0.05 + hot * 0.06) * (line * 1.0 + skirt * 0.22) * dust * down * exp(-lift / 1.2);
  col += candleOnSlab(P, vec3(0.0, 1.0, 0.0), lift) * vec3(1.0, 0.6, 0.3) * (0.07 * dust) * smoothstep(-2.0 - 3.0 * lift, 3.0 + 1.0 * lift, gap);
  float ripple = 0.2 + 0.8 * rimNoise(vec2(P.x * 1.7, P.z * 0.3)) + 0.9 * pow(abs(rimNoise(P.xz * vec2(3.1, 0.6) + 11.0)), 3.0);
  col += candleInSlab(P, lift) * (0.55 * ripple) * smoothstep(-1.0 - 3.0 * lift, 2.0 + 1.0 * lift, gap) * down;
  gl_FragColor = vec4(col, 0.0);
  if (uDiag != 0) gl_FragColor = stageDiag(vec3(0.02), vec3(0.0, 1.0, 0.0), 0.0, c, 0.0);
}
`

let surface: THREE.Object3D | null = null
let inAir: ((on: boolean) => void) | null = null

export async function prepare(): Promise<void> {
  await prepareModel(MODEL)
  leafUniforms.uLeafMap.value = texture(SHEET)
}

function makeSurface(): THREE.Group {
  const mesh = geometry(MODEL, 'leaves')
  const extras = mesh.userData.extras as LeafExtras
  leafUniforms.uLeafSpan.value.set(extras.centreSpanMm, extras.sizeSpanMm, extras.footMm, 0)
  const shared = { ...roomUniforms, ...lightUniforms, ...slabLightUniforms, ...faceUniforms, uKeyCol: surfaceUniforms.uKeyCol, uRimCol: surfaceUniforms.uRimCol, uSky: surfaceUniforms.uSky }
  const leaves = new THREE.Mesh(
    mesh,
    stageShader({
      part: PART,
      standIn: false,
      change: 'surface-dressing',
      textured: true,
      texels: 1024,
      uniforms: { ...shared, ...leafUniforms },
      vertexPars: LEAF_VERT_PARS,
      vertexMain: LEAF_VERT_MAIN,
      fragment: LEAF_FRAG,
      params: { side: THREE.DoubleSide },
    }),
  )
  leaves.frustumCulled = false
  leaves.renderOrder = 3
  const sheet = new THREE.Mesh(
    new THREE.RingGeometry(1, extras.footMm + 220, 96, 16).rotateX(-Math.PI / 2),
    stageShader({
      part: PART,
      standIn: false,
      change: 'surface-dressing',
      uniforms: { ...shared, uRimLook: { value: new THREE.Vector4(extras.footMm - 2.5, 2.4, 16, 7) } },
      vertexPars: 'varying vec3 vRimAt;',
      vertexMain: 'vRimAt = (modelMatrix * vec4(position, 1.0)).xyz;',
      fragment: RIM_FRAG,
      params: { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor },
    }),
  )
  sheet.position.y = 0.04
  sheet.renderOrder = 2
  sheet.frustumCulled = false
  const group = new THREE.Group().add(leaves, sheet, cobweb())
  inAir = gustTwin(leaves)
  return group
}

export function dressing(): THREE.Object3D {
  surface ??= makeSurface()
  return surface
}

/** Seconds since the landing the leaves answer; 0 holds them where they lie before it, a large number where they rest. */
export function setSkitter(seconds: number): void {
  leafUniforms.uLeafTime.value.x = seconds
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  inAir?.(f.from !== f.to && (f.from.season === 'fall' || f.to.season === 'fall') && gustStreaks(f.sample, f.to.season === 'fall'))
}
