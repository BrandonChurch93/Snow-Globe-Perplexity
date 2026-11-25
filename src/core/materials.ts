import * as THREE from 'three'
import { DEPTH_RANGE_MM, partBytes, viewCode } from '../diagnostics/views'
import { LENS_GLSL, innerRadiusMm, lensIor, lensRadiusMm } from '../globe/lens'
import { changeRamp } from '../shake/change'
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
  uFront: { value: new THREE.Vector3() },
}

export const MODE = { always: 0, incoming: 1, outgoing: 2 } as const

export const DRESSING_FRONT = { gain: 2, fromMm: 58, toMm: 230 } as const

/**
 * How the parts outside the glass give way inside their span. The new season's light pours out of the globe: a front runs
 * down the base from the collar to the foot over the first `share` of the span, and on across the table from the foot
 * outward over the span from `tableFrom` on. Behind the front a part is the new season, ahead of it the old; the front's
 * edge is broken into patches (`cellMm`, in the part's own space, so it travels with the globe) and feathered across the
 * samples of a frame (`feather`), and it carries a band of the new season's light (`glowBase`, `glowTable` wide, in shares
 * of the way) so the edge itself is never seen clean. The code of a part's kind rides in `uState.z`: 0 and above is the lag
 * of a part inside the glass, under 0 the table's gain, under `-BASE_CODE` the base's.
 */
export const OUTSIDE_FRONT = { share: 0.62, gain: 3, tableFrom: 0.38, cellMm: 6.5, fineMm: 2.3, fine: 0.36, contrast: 2.6, feather: 0.14, glowBase: 0.17, glowTable: 0.1, topMm: 33, footMm: 0 } as const
const BASE_CODE = 10

export interface StageHandle {
  part: string
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
  const ramp = changeRamp(spec.change ?? 'none')
  return {
    part: spec.part,
    uPart: { value: new THREE.Vector4(c[0] / 255, c[1] / 255, c[2] / 255, standIn ? 1 : 0) },
    uState: { value: new THREE.Vector4(ramp.start, ramp.length, spec.change === 'surface-dressing' ? -DRESSING_FRONT.gain : spec.change === 'base' ? -BASE_CODE - OUTSIDE_FRONT.gain : ramp.lag, MODE.always) },
    uFlags: { value: new THREE.Vector4(spec.miniature ? 1 : 0, spec.textured ? (spec.texels ?? 0) : 0, spec.inside ? 1 : 0, 1) },
  }
}

export const handleOf = (m: THREE.Material): StageHandle => m.userData.stage as StageHandle

export function setPresence(m: THREE.Material, mode: number, presence = 1): void {
  const h = handleOf(m)
  h.uState.value.w = mode
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
uniform vec3 uFront;
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
float stageFront = 0.0;
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
    float through = clamp((uChange - uState.x) / uState.y, 0.0, 1.0);
    float live = smoothstep(0.0, 0.06, through) * (1.0 - smoothstep(0.92, 1.0, through));
    if (uState.z < -${(BASE_CODE - 1).toFixed(1)}) {
      float gain = -uState.z - ${BASE_CODE.toFixed(1)};
      float way = clamp((${(OUTSIDE_FRONT.topMm).toFixed(1)} + uLightFloodFloor.x - vStageLocal.y) / ${(OUTSIDE_FRONT.topMm - OUTSIDE_FRONT.footMm).toFixed(1)}, 0.0, 1.0);
      float run = through / ${OUTSIDE_FRONT.share.toFixed(2)};
      float at = (way - (run * (1.0 + gain) - 0.5) / gain) / ${OUTSIDE_FRONT.glowBase.toFixed(2)};
      stageFront = live * exp(-at * at);
      stageEdge = stagePatch(vStageLocal);
      return clamp(run * (1.0 + gain) - gain * way, 0.0, 1.0);
    }
    float far = clamp((length(vStageWorld.xz) - ${DRESSING_FRONT.fromMm.toFixed(1)}) / ${(DRESSING_FRONT.toMm - DRESSING_FRONT.fromMm).toFixed(1)}, 0.0, 1.0);
    float run = clamp((through - ${OUTSIDE_FRONT.tableFrom.toFixed(2)}) / ${(1 - OUTSIDE_FRONT.tableFrom).toFixed(2)}, 0.0, 1.0);
    float at = (far - (run * (1.0 - uState.z) - 0.5) / -uState.z) / ${OUTSIDE_FRONT.glowTable.toFixed(2)};
    stageFront = live * step(0.0001, run) * exp(-at * at);
    stageEdge = stagePatch(vec3(vStageWorld.x, 0.0, vStageWorld.z));
    return clamp(run * (1.0 - uState.z) + uState.z * far, 0.0, 1.0);
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
if (uState.w > 0.5 && stageFront > 0.0) gl_FragColor.rgb += uFront * stageFront;
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
