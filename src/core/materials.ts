import * as THREE from 'three'
import { DEPTH_RANGE_MM, partBytes, viewCode } from '../diagnostics/views'
import { LENS_GLSL, innerRadiusMm, lensIor, lensRadiusMm } from '../globe/lens'
import { CHANGE_COVER, DRESSING_CHANGE, changeRamp } from '../shake/change'
import { LIGHT_FRAG, LIGHT_FRAG_PARS, lightUniforms } from './chunks/light'
import { VEIL_FRAG, VEIL_FRAG_PARS, veilUniforms } from './chunks/veil'
import { flagStandIn } from './standins'

export type Rgb = readonly [number, number, number]

export const stageUniforms = {
  uLensCentre: { value: new THREE.Vector3() },
  uLens: { value: new THREE.Vector4(lensRadiusMm, lensIor, 1, innerRadiusMm) },
  uGlobeInv: { value: new THREE.Matrix4() },
  ...lightUniforms,
  ...veilUniforms,
  uDiag: { value: 0 },
  uSeed: { value: 0 },
  uChange: { value: 0 },
  uCoc: { value: new THREE.Vector3() },
}

export const MODE = { always: 0, incoming: 1, outgoing: 2 } as const

export const DRESSING_FRONT = { gain: 2, fromMm: 58, toMm: 230 } as const

/**
 * How the parts outside the glass give way, all of them inside the one span of change.ts and under its cover.
 * The base is swapped, never morphed and never mixed: its line cuts the lit glass, the one thing the cover leaves in sight,
 * so every sample holds one base whole, the old one to the middle of the span and the new one after it.
 * The table's dressing never holds two seasons: the old season's is gone in the first half of the span and the new season's
 * comes in the second (`DRESSING_CHANGE`). Each goes and comes from the foot outward; the edge of that front is broken into
 * patches (`cellMm`, `fineMm`) drawn out along the way a gust runs (`streak` times as long as wide, `rayMm` to a radian across)
 * and feathered across the samples of a frame (`feather`), so a field of frost or of sand thins in fingers and never along a line.
 * Nothing here lays light on a part: the cover is the fall of the exposure, which leaves the glass alone in sight (lighting.ts, `CHANGE_BLOOM`).
 * The code of a part's kind rides in `uState.z`: 0 and above is the lag of a part inside the glass, under 0 the table's gain,
 * under `-BASE_CODE` the base's.
 */
export const OUTSIDE_FRONT = { rayMm: 110, streak: 3.4, cellMm: 6.5, fineMm: 2.3, fine: 0.36, contrast: 2.6, feather: 0.14 } as const
const BASE_CODE = 10

const OUTSIDE_RAMP = changeRamp('base')
/**
 * The dressing on the glass is on the one thing the cover leaves in sight, so it is not there while the base changes: the old
 * season's goes as the cover rises, burnt off by the light, and the new season's comes as the cover falls.
 */
export const GLASS_LEAVE = { start: CHANGE_COVER.riseFrom, length: CHANGE_COVER.fullFrom - CHANGE_COVER.riseFrom } as const
export const GLASS_COME = { start: CHANGE_COVER.fullTo, length: CHANGE_COVER.goneAt - CHANGE_COVER.fullTo } as const
/** A place in the window as a share of the outside span, read past both of its ends: what `(uChange - uState.x) / uState.y` gives. */
const share = (at: number): number => (at - OUTSIDE_RAMP.start) / OUTSIDE_RAMP.length
const TABLE = {
  liftFrom: share(DRESSING_CHANGE.liftFrom),
  leaveFrom: share(DRESSING_CHANGE.leaveFrom),
  leaveLong: share(DRESSING_CHANGE.leaveTo) - share(DRESSING_CHANGE.leaveFrom),
  comeFrom: share(DRESSING_CHANGE.comeFrom),
  comeLong: share(DRESSING_CHANGE.comeTo) - share(DRESSING_CHANGE.comeFrom),
  closes: share(1),
} as const

/**
 * The scatter on the table is carried by the strokes, not swapped. What lies there lifts `leadOut` shares of the outside span
 * before its place is cleared (never before `DRESSING_CHANGE.liftFrom`), is blown out from the foot, faster and faster, and is
 * gone in the air; what the new season lays starts `leadIn` shares before its place fills, from further out, flies in and
 * comes down on its place, the far places first and the foot last, and every new piece is down while the cover of the change
 * is still whole (`GUST_LAST_DOWN_AT` stays under `CHANGE_COVER.fullTo`), so no piece is seen in the air.
 * Lengths in millimetres. With one season on the stage the mode is 0 and nothing here is read.
 */
export const GUST = { leadOut: 1, longOut: 1.25, reachOutMm: 170, leadIn: 0.45, longIn: 0.65, reachInMm: 70, heightMm: 14 } as const
/** The share of the outside span at which the last new piece on the table is down. */
export const GUST_LAST_DOWN = TABLE.comeFrom + (TABLE.comeLong * (0.5 + DRESSING_FRONT.gain)) / (1 + DRESSING_FRONT.gain) - GUST.leadIn + 1.2 * GUST.longIn
export const GUST_CLOSES = TABLE.closes
/** The same instant as a place in the swap window. */
export const GUST_LAST_DOWN_AT = OUTSIDE_RAMP.start + GUST_LAST_DOWN * OUTSIDE_RAMP.length

/** For a vertex shader of a part of the table's dressing: x the way a piece is moved along the line out from the stage's axis, y its height as a share, z how far it is from lying (1 to 0). */
export const STAGE_GUST_GLSL = `
uniform float uChange;
uniform vec4 uState;
vec3 stageGust(vec2 rest, float a, float b) {
  if (uState.w < 0.5 || uState.z >= 0.0) return vec3(0.0);
  float s = (uChange - uState.x) / uState.y;
  float r = length(rest);
  float far = clamp((r - ${DRESSING_FRONT.fromMm.toFixed(1)}) / ${(DRESSING_FRONT.toMm - DRESSING_FRONT.fromMm).toFixed(1)}, 0.0, 1.0);
  if (uState.w < 1.5) {
    float at = (0.5 - uState.z * (1.0 - far)) / (1.0 - uState.z);
    float over = ${TABLE.comeFrom.toFixed(4)} + ${TABLE.comeLong.toFixed(4)} * at;
    float q = clamp((s - over + ${GUST.leadIn.toFixed(2)}) / (${GUST.longIn.toFixed(2)} * (0.8 + 0.4 * b)), 0.0, 1.0);
    float left = (1.0 - q) * (1.0 - q);
    return vec3(${GUST.reachInMm.toFixed(1)} * (0.5 + a) * left, q < 1.0 ? sin(3.14159265 * (0.2 + 0.8 * q)) : 0.0, left);
  }
  float at = (0.5 - uState.z * far) / (1.0 - uState.z);
  float over = ${TABLE.leaveFrom.toFixed(4)} + ${TABLE.leaveLong.toFixed(4)} * at;
  float q = clamp((s - max(over - ${GUST.leadOut.toFixed(2)}, ${TABLE.liftFrom.toFixed(4)})) / ${GUST.longOut.toFixed(2)}, 0.0, 1.0);
  return vec3(${GUST.reachOutMm.toFixed(1)} * (0.5 + a) * q * q, sin(1.5707963 * q), q);
}
`

export interface StageHandle {
  part: string
  onGlass: boolean
  uPart: { value: THREE.Vector4 }
  uState: { value: THREE.Vector4 }
  uFlags: { value: THREE.Vector4 }
}

export interface PartSpec {
  part: string
  standIn?: boolean
  inside?: boolean
  miniature?: boolean
  textured?: boolean
  texels?: number
  change?: string
}

export function makeHandle(spec: PartSpec): StageHandle {
  const c = partBytes(spec.part)
  const standIn = spec.standIn !== false
  if (standIn) flagStandIn(spec.part)
  const ramp = spec.change === 'surface-dressing' ? OUTSIDE_RAMP : changeRamp(spec.change ?? 'none')
  return {
    part: spec.part,
    onGlass: spec.change === 'glass-dressing',
    uPart: { value: new THREE.Vector4(c[0] / 255, c[1] / 255, c[2] / 255, standIn ? 1 : 0) },
    uState: { value: new THREE.Vector4(ramp.start, ramp.length, spec.change === 'surface-dressing' ? -DRESSING_FRONT.gain : spec.change === 'base' ? -BASE_CODE - 1 : ramp.lag, MODE.always) },
    uFlags: { value: new THREE.Vector4(spec.miniature ? 1 : 0, spec.textured ? (spec.texels ?? 0) : 0, spec.inside ? 1 : 0, 1) },
  }
}

export const handleOf = (m: THREE.Material): StageHandle => m.userData.stage as StageHandle

export function setPresence(m: THREE.Material, mode: number, presence = 1): void {
  const h = handleOf(m)
  h.uState.value.w = mode
  if (h.onGlass && mode !== MODE.always) {
    const r = mode === MODE.outgoing ? GLASS_LEAVE : GLASS_COME
    h.uState.value.x = r.start
    h.uState.value.y = r.length
  }
  h.uFlags.value.w = presence
}

export const STAGE_VERT_PARS = `
${LENS_GLSL}
uniform mat4 uGlobeInv;
uniform int uDiag;
uniform vec3 uCoc;
varying vec3 vStageWorld;
varying vec3 vStageLocal;
varying vec3 vStageAux;
varying vec3 vStagePlaced;
varying float vStageSeen;
`

export const STAGE_VERT_MAIN = `
vec4 stageWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
stageWorld = instanceMatrix * stageWorld;
#endif
stageWorld = modelMatrix * stageWorld;
vStageWorld = stageWorld.xyz;
vStageLocal = (uGlobeInv * stageWorld).xyz;
vStageAux = vec3(0.0, -mvPosition.z, length(mvPosition.xyz));
vStagePlaced = stageWorld.xyz;
vStageSeen = 1.0;
#ifdef STAGE_INSIDE
vec4 stagePlaced = lensPlace(stageWorld.xyz, cameraPosition, vStageSeen);
vec4 stageView = viewMatrix * vec4(stagePlaced.xyz, 1.0);
gl_Position = projectionMatrix * stageView;
// y is the depth the lens focuses at. Each lens sample places the vertex again from its own eye, so what is held sharp
// follows the image of the point behind the glass and not the depth it is placed at (the door: sharp at 152 mm, placed
// at 171). The true depth is right near the middle of the globe; the texels view takes the image itself, from the
// parallax of an eye moved 4 mm across and 4 mm up, and of the two keeps the one further from the focus
vStageAux = vec3(stagePlaced.w, -mvPosition.z, length(stageView.xyz));
vStagePlaced = stagePlaced.xyz;
if (uDiag == ${viewCode('texels')}) {
  vec3 stageRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 stageUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 stageA = (viewMatrix * vec4(lensPlace(stageWorld.xyz, cameraPosition + 4.0 * stageRight).xyz, 1.0)).xyz;
  vec3 stageB = (viewMatrix * vec4(lensPlace(stageWorld.xyz, cameraPosition + 4.0 * stageUp).xyz, 1.0)).xyz;
  float stageAcross = ((stageA.x - 4.0) / stageA.z - stageView.x / stageView.z) / 4.0;
  float stageDown = ((stageB.y - 4.0) / stageB.z - stageView.y / stageView.z) / 4.0;
  vStageAux.y = 1.0 / max(abs(stageAcross - uCoc.y) > abs(stageDown - uCoc.y) ? stageAcross : stageDown, 1e-5);
}
#endif
`

export const STAGE_FRAG_PARS = `
uniform int uDiag;
uniform float uSeed;
uniform float uChange;
uniform vec3 uCoc;
uniform vec4 uPart;
uniform vec4 uState;
uniform vec4 uFlags;
uniform vec3 uLensCentre;
uniform vec4 uLens;
varying vec3 vStageWorld;
varying vec3 vStageLocal;
varying vec3 vStageAux;
varying vec3 vStagePlaced;
varying float vStageSeen;
bool stageOutside() {
  if (vStageSeen <= 0.0) return true;
  vec3 c = cross(normalize(vStagePlaced - cameraPosition), uLensCentre - cameraPosition);
  return dot(c, c) > uLens.x * uLens.x;
}
float stageHash(vec3 p) {
  uvec3 v = uvec3(uint(p.x), uint(p.y), uint(p.z * 4096.0));
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return float(v.x >> 8u) / 16777216.0;
}
${LIGHT_FRAG_PARS}
float stageEdge = -1.0;
float stageNoise(vec3 p) {
  vec3 q = p + 2048.0;
  vec3 i = floor(q);
  vec3 f = q - i;
  f = f * f * (3.0 - 2.0 * f);
  float z0 = i.z / 4096.0;
  float z1 = (i.z + 1.0) / 4096.0;
  float a = mix(mix(stageHash(vec3(i.x, i.y, z0)), stageHash(vec3(i.x + 1.0, i.y, z0)), f.x), mix(stageHash(vec3(i.x, i.y + 1.0, z0)), stageHash(vec3(i.x + 1.0, i.y + 1.0, z0)), f.x), f.y);
  float b = mix(mix(stageHash(vec3(i.x, i.y, z1)), stageHash(vec3(i.x + 1.0, i.y, z1)), f.x), mix(stageHash(vec3(i.x, i.y + 1.0, z1)), stageHash(vec3(i.x + 1.0, i.y + 1.0, z1)), f.x), f.y);
  return mix(a, b, f.z);
}
float stagePatch(vec3 p) {
  float n = ${(1 - OUTSIDE_FRONT.fine).toFixed(2)} * stageNoise(p / ${OUTSIDE_FRONT.cellMm.toFixed(1)}) + ${OUTSIDE_FRONT.fine.toFixed(2)} * stageNoise(p / ${OUTSIDE_FRONT.fineMm.toFixed(1)} + 37.0);
  return (n - 0.5) * ${OUTSIDE_FRONT.contrast.toFixed(1)} + 0.5;
}
float stageChange() {
  if (uState.w < 0.5) return 0.0;
  if (uState.z < 0.0) {
    float s = (uChange - uState.x) / uState.y;
    if (uState.z < -${(BASE_CODE - 1).toFixed(1)}) return step(0.5, s);
    float far = clamp((length(vStageWorld.xz) - ${DRESSING_FRONT.fromMm.toFixed(1)}) / ${(DRESSING_FRONT.toMm - DRESSING_FRONT.fromMm).toFixed(1)}, 0.0, 1.0);
    float run = uState.w > 1.5 ? (s - ${TABLE.leaveFrom.toFixed(4)}) / ${TABLE.leaveLong.toFixed(4)} : (s - ${TABLE.comeFrom.toFixed(4)}) / ${TABLE.comeLong.toFixed(4)};
    float reach = clamp(run, 0.0, 1.0) * (1.0 - uState.z) + uState.z * (uState.w > 1.5 ? far : 1.0 - far);
    stageEdge = stagePatch(vec3(atan(vStageWorld.x, vStageWorld.z) * ${OUTSIDE_FRONT.rayMm.toFixed(1)}, 0.0, length(vStageWorld.xz) / ${OUTSIDE_FRONT.streak.toFixed(1)}));
    return clamp(reach, 0.0, 1.0);
  }
  float side = clamp(0.5 + vStageLocal.z / (2.0 * uGrid.w), 0.0, 1.0);
  return clamp((uChange - uState.x - uState.z * side) / uState.y, 0.0, 1.0);
}
bool stageGone(float c) {
  if (uState.w > 0.5) {
    float h = stageHash(vec3(gl_FragCoord.xy, uSeed));
    if (stageEdge > -0.5) h = clamp(stageEdge + (h - 0.5) * ${OUTSIDE_FRONT.feather.toFixed(2)}, 0.001, 0.999);
    if (uState.w > 1.5 ? h < c : h >= c) return true;
  }
  if (uFlags.w < 1.0 && stageHash(vec3(gl_FragCoord.xy + 29.0, uSeed + 0.61)) >= uFlags.w) return true;
  return false;
}
${VEIL_FRAG_PARS}
float stageBlur() {
  return clamp(uCoc.x * abs(1.0 / max(vStageAux.y, 1.0) - uCoc.y) / 8.0, 0.0, 1.0);
}
vec4 stageDiag(vec3 albedo, vec3 n, float veil, float c, float texels) {
  if (uDiag == ${viewCode('ids')}) return vec4(uPart.rgb, 1.0);
  if (uDiag == ${viewCode('standins')}) return vec4(uPart.rgb * uPart.a, 1.0);
  if (uDiag == ${viewCode('albedo')}) return vec4(albedo, 1.0);
  if (uDiag == ${viewCode('normals')}) return vec4(n * 0.5 + 0.5, 1.0);
  if (uDiag == ${viewCode('depth')}) {
    float q = floor(clamp(vStageAux.z / ${DEPTH_RANGE_MM}.0, 0.0, 1.0) * 65535.0);
    float hi = floor(q / 256.0);
    return vec4(hi / 255.0, (q - hi * 256.0) / 255.0, uFlags.z, 1.0);
  }
  if (uDiag == ${viewCode('texels')}) return vec4(clamp(texels / 4.0, 0.0, 1.0), stageBlur(), uFlags.y > 0.0 ? 1.0 : 0.0, 1.0);
  if (uDiag == ${viewCode('cover')}) return uFlags.x > 0.5 ? vec4(veil, 0.0, 1.0, 1.0) : vec4(0.0);
  if (uDiag == ${viewCode('change')}) return vec4(c, 0.0, 0.0, 1.0);
  return vec4(0.0, 0.0, 0.0, 1.0);
}
`

const FRAG_HEAD = `
float stageC = stageChange();
if (stageGone(stageC)) discard;
#ifdef STAGE_INSIDE
if (stageOutside()) discard;
#endif
`

const FRAG_LIGHT = LIGHT_FRAG

const FRAG_TAIL = `
${VEIL_FRAG}
if (uDiag != 0) {
  float stageTexels = 0.0;
  #ifdef USE_MAP
  vec2 stageUv = vMapUv * uFlags.y;
  stageTexels = max(length(dFdx(stageUv)), length(dFdy(stageUv)));
  #endif
  gl_FragColor = stageDiag(diffuseColor.rgb, inverseTransformDirection(normal, viewMatrix), stageFog, stageC, stageTexels);
}
`

export interface LitSpec extends PartSpec {
  color?: THREE.ColorRepresentation
  vertexColors?: boolean
  roughness?: number
  metalness?: number
  emissive?: Rgb
  map?: THREE.Texture
  side?: THREE.Side
  physical?: boolean
  extra?: THREE.MeshPhysicalMaterialParameters
  hook?: (shader: THREE.WebGLProgramParametersWithUniforms) => void
  key?: string
}

export function stageMaterial(spec: LitSpec): THREE.MeshStandardMaterial {
  const handle = makeHandle({ ...spec, texels: spec.map ? Math.max((spec.map.image as { width: number }).width, (spec.map.image as { height: number }).height) : 0, textured: !!spec.map && spec.textured !== false })
  const given = {
    color: spec.color ?? 0xffffff,
    vertexColors: !!spec.vertexColors,
    roughness: spec.roughness ?? 0.8,
    metalness: spec.metalness ?? 0,
    map: spec.map ?? null,
    side: spec.side ?? THREE.FrontSide,
    ...spec.extra,
  }
  const m = spec.physical ? new THREE.MeshPhysicalMaterial(given) : new THREE.MeshStandardMaterial(given)
  if (spec.emissive) m.emissive.setRGB(spec.emissive[0], spec.emissive[1], spec.emissive[2])
  m.userData.stage = handle
  if (spec.inside) m.defines = { ...m.defines, STAGE_INSIDE: 1 }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, stageUniforms, { uPart: handle.uPart, uState: handle.uState, uFlags: handle.uFlags })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${STAGE_VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${STAGE_VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${STAGE_FRAG_PARS}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FRAG_HEAD}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${FRAG_LIGHT}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${FRAG_TAIL}`)
    spec.hook?.(shader)
  }
  const key = spec.key ?? (spec.hook ? spec.part : '')
  m.customProgramCacheKey = () => `stage:${spec.inside ? 'in' : 'out'}:${key}`
  return m
}

export interface ShaderSpec extends PartSpec {
  vertexPars?: string
  vertexMain?: string
  fragment: string
  uniforms?: Record<string, THREE.IUniform>
  params?: THREE.ShaderMaterialParameters
}

export function stageShader(spec: ShaderSpec): THREE.ShaderMaterial {
  const handle = makeHandle(spec)
  const m = new THREE.ShaderMaterial({
    ...spec.params,
    uniforms: { ...stageUniforms, uPart: handle.uPart, uState: handle.uState, uFlags: handle.uFlags, ...spec.uniforms },
    defines: spec.inside ? { STAGE_INSIDE: 1 } : {},
    vertexShader: `#include <common>
${STAGE_VERT_PARS}
${spec.vertexPars ?? ''}
void main() {
  vec3 transformed = position;
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
  ${STAGE_VERT_MAIN}
  ${spec.vertexMain ?? ''}
}`,
    fragmentShader: `#include <common>
${STAGE_FRAG_PARS}
${spec.fragment}`,
  })
  m.userData.stage = handle
  return m
}
