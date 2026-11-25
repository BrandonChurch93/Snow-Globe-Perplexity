import * as THREE from 'three'
import { stageMaterial, stageShader } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { haloGeometry } from '../../../miniature/glow'
import { lampFlame } from '../../../miniature/roof'
import { bakeGlow, buildTrunk, crownOffset, glow, glowHook, placeGeometry, placePoint, prepareTrunk, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { leafField } from './crown'
import { lanterns, type Lantern } from './lanterns'
import { season, tones } from './palette'

type Shader = THREE.WebGLProgramParametersWithUniforms
type Rgb3 = [number, number, number]

const MODEL = 'summer/tree-summer.glb'
const LEAVES = 'summer/tree-leaves.srgb.tile.w1024.png'
const SPRIGS = 'summer/tree-sprigs.srgb.w512.png'
const CYCLES = 3
const FLICKER = 0.06
const PAPER = { power: 0.26, reachMm: 2.5 }
const GLOW = { leaves: { power: 2.2, reachMm: 2.3 }, wood: { power: 0.55, reachMm: 2.2 } }
const LAMP_ON_WOOD = { power: 0.5, reachMm: 14, wrap: -0.2 }
const LAMP_ON_LEAVES = { power: 3, reachMm: 12, wrap: 0.1 }
const LAMP_SHIFT: Vec3 = [-3, 0, -5]
const FILL_ON_WOOD = { power: 0.22, reachMm: 1000, wrap: 0.4 }
const FILL_ON_LEAVES = { power: 0.5, reachMm: 1000, wrap: 0.3 }
const FILL_FROM: Vec3 = [30, 60, 60]
const BARK: Rgb3 = [0.3, 0.15, 0.085]
const LEAF_TINT: Rgb3 = [0.55, 0.95, 0.34]
const LEAF_LIT = 'vec3(1.25, 1.05, 0.6)'
const LEAF = { rim: 5, rimTight: 2.5, through: 1.3, tight: 3.0, fill: 0.85, wrap: 0.8, bump: 1.0, clumpDark: 0.22, clumpBright: 2.7 }
const LANTERN = { rib: 0.5, ribs: 26, gain: 0.8, body: 0.8, core: 1.6, tight: 6.0, paper: 0.06, dim: 0.1, stepS: 0.04, rampS: 0.18, swayRad: 0.045, sway2: 0.6, kickRad: 0.16, kickFade: 1.2, kickHz: 1.3, cycles: 2 }
const HALO = { radius: 2.6, strength: 0.075, hot: 0.0 }
const HALO_EDGE: Rgb3 = [0.9, 0.36, 0.08]
const HALO_CORE: Rgb3 = [1, 0.7, 0.34]

const offset = crownOffset()
const sway = { value: new THREE.Vector4(0, 100, LANTERN.swayRad, LANTERN.kickRad) }
const paper = (l: Lantern): Rgb3 => (l.tone === 'cream' ? tones.creamLight : tones.paperLight) as Rgb3

export const innerLights: InnerLight[] = lanterns.map((l): InnerLight => ({ at: l.at, color: paper(l), power: PAPER.power * l.radius * l.radius, reachMm: PAPER.reachMm * l.radius, flicker: FLICKER, cycles: CYCLES, phase: l.phase }))

const LEVEL_GLSL = `
uniform vec4 uSway;
float lanternLevel(float order) {
  return mix(${LANTERN.dim.toFixed(3)}, 1.0, smoothstep(0.0, ${LANTERN.rampS.toFixed(3)}, uSway.y - order * ${LANTERN.stepS.toFixed(4)}));
}
`

const TREE_GLSL = `
uniform float uTile;
uniform float uBump;
varying vec3 vTreeP;
varying vec3 vTreeN;
vec4 treeTri(sampler2D t, vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= w.x + w.y + w.z;
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}
vec3 treeBump(vec3 sx, vec3 sy, vec2 dh, vec3 n, float face) {
  vec2 len = max(vec2(length(sx), length(sy)), vec2(1e-5));
  vec2 d = clamp(dh * uBump / len, vec2(-2.0), vec2(2.0));
  sx /= len.x;
  sy /= len.y;
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * face;
  return normalize(abs(det) * n - sign(det) * (d.x * r1 + d.y * r2));
}
`

function leafHook(shader: Shader): void {
  glowHook(shader, `material.diffuseContribution * ${LEAF_LIT}`)
  Object.assign(shader.uniforms, { uTile: { value: 1 / tileOf('leaves') }, uBump: { value: LEAF.bump }, uSprigs: { value: texture(SPRIGS) } })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 uv1;\nvarying vec2 vCard;\nvarying vec3 vTreeP;\nvarying vec3 vTreeN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCard = uv1;\nvTreeP = position;\nvTreeN = normal;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}\nuniform sampler2D uSprigs;\nvarying vec2 vCard;`)
    .replace(
      '#include <map_fragment>',
      `vec4 treeBody = treeTri(map, vTreeP * uTile, normalize(vTreeN));
      vec4 treeSprig = texture2D(uSprigs, vMapUv);
      bool treeCard = vCard.x > 0.5;
      vec4 treeC = treeCard ? treeSprig : treeBody;
      float treeH = dot(treeC.rgb, vec3(0.3, 0.6, 0.1)) * 4.0;
      vec3 treeSx = dFdx(-vViewPosition);
      vec3 treeSy = dFdy(-vViewPosition);
      vec2 treeDh = vec2(dFdx(treeH), dFdy(treeH));
      if (treeCard && treeC.a < 0.5) discard;
      float treeLum = dot(treeC.rgb, vec3(0.3, 0.6, 0.1));
      diffuseColor.rgb *= treeC.rgb * mix(${LEAF.clumpDark.toFixed(2)}, ${LEAF.clumpBright.toFixed(2)}, smoothstep(0.02, 0.2, treeLum));`,
    )
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nif (vCard.x > 0.5) normal *= faceDirection;')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = treeBump(treeSx, treeSy, treeDh, normal, faceDirection);')
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${LEAF.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${LEAF.wrap.toFixed(2)}) + ${LEAF.through.toFixed(2)} * pow(clamp(dot(normalize(vViewPosition), -stageKeyL), 0.0, 1.0), ${LEAF.tight.toFixed(1)}) + ${LEAF.rim.toFixed(2)} * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), ${LEAF.rimTight.toFixed(1)}) * smoothstep(-0.3, 0.7, dot(normal, stageKeyL)))) * material.diffuseContribution;`,
    )
}

function lanternHook(shader: Shader): void {
  Object.assign(shader.uniforms, { uTwinkle: glow.uTwinkle, uSway: sway })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nattribute vec4 aPivot;\nvarying vec2 vLamp;\n${LEVEL_GLSL}`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vLamp = uv;
{
  vec3 arm = transformed - aPivot.xyz;
  float turn = 6.2831853 * (${LANTERN.cycles.toFixed(1)} * uSway.x + aPivot.w);
  float kick = uSway.w * exp(-${LANTERN.kickFade.toFixed(2)} * uSway.y) * sin(6.2831853 * ${LANTERN.kickHz.toFixed(2)} * uSway.y);
  float ax = uSway.z * sin(turn) + kick * cos(6.2831853 * aPivot.w);
  float az = ${LANTERN.sway2.toFixed(2)} * uSway.z * sin(2.0 * turn + 1.3) + kick * sin(6.2831853 * aPivot.w);
  transformed += cross(vec3(ax, 0.0, az), arm);
}`,
    )
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nuniform vec4 uTwinkle;\nvarying vec2 vLamp;\n${LEVEL_GLSL}`)
    .replace('#include <color_fragment>', `#include <color_fragment>\nfloat lampLit = vColor.a;\nvec3 lampTint = diffuseColor.rgb;\ndiffuseColor.rgb *= 1.0 - ${(1 - LANTERN.paper).toFixed(2)} * lampLit;`)
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
{
  float lampFace = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  float lampCore = pow(lampFace, ${LANTERN.tight.toFixed(1)});
  float lampBeat = 1.0 + ${FLICKER.toFixed(3)} * sin(6.2831853 * (uTwinkle.x + vLamp.x * 0.381966));
  float lampLat = asin(clamp((vec4(normalize(normal), 0.0) * viewMatrix).y, -1.0, 1.0));
  float lampRib = 1.0 - ${LANTERN.rib.toFixed(2)} * pow(0.5 + 0.5 * cos(lampLat * ${LANTERN.ribs.toFixed(1)}), 3.0);
  vec3 lampHot = mix(lampTint, lampTint * vec3(1.0, 1.75, 2.0) + vec3(0.0, 0.05, 0.01), lampCore * lampCore);
  totalEmissiveRadiance = lampHot * lampLit * (${LANTERN.gain.toFixed(2)} * (${LANTERN.body.toFixed(2)} + ${LANTERN.core.toFixed(2)} * lampCore)) * lanternLevel(vLamp.x) * lampBeat * lampRib;
}`,
    )
}

const v3 = (c: readonly number[]): string => `vec3(${c[0]!.toFixed(3)}, ${c[1]!.toFixed(3)}, ${c[2]!.toFixed(3)})`

function lanternHalo(part: string): THREE.ShaderMaterial {
  return stageShader({
    part,
    standIn: false,
    inside: true,
    change: 'light',
    uniforms: { uSway: sway },
    params: { side: THREE.FrontSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false },
    vertexPars: 'attribute vec4 aHalo;\nattribute vec4 aHaloSize;\nvarying vec4 vHalo;\nvarying vec4 vHaloSize;',
    vertexMain: 'vHalo = vec4((modelMatrix * vec4(aHalo.xyz, 1.0)).xyz, aHalo.w);\nvHaloSize = aHaloSize;',
    fragment: `
${LEVEL_GLSL}
varying vec4 vHalo;
varying vec4 vHaloSize;
void main() {
  if (uDiag != 0) discard;
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  vec3 d = normalize(vStagePlaced - cameraPosition);
  vec3 oc = cameraPosition - uLensCentre;
  float b = dot(oc, d);
  float h = b * b - dot(oc, oc) + uLens.x * uLens.x;
  vec3 sight = normalize(cameraPosition + d * (-b - sqrt(max(h, 0.0))) - vStageWorld);
  vec3 off = cross(sight, vStageWorld - vHalo.xyz);
  float g = max(0.0, 1.0 - dot(off, off) / (vHaloSize.x * vHaloSize.x));
  float body = g * g * g * ${HALO.strength.toFixed(3)} + pow(g, 10.0) * ${HALO.hot.toFixed(3)};
  gl_FragColor = vec4(mix(${v3(HALO_EDGE)}, ${v3(HALO_CORE)}, g * g), body * lanternLevel(vHaloSize.y) * (1.0 - 0.8 * stageVeil(vStageAux.x)));
}
`,
  })
}

const tileOf = (name: string): number => (geometry(MODEL, name).userData.extras as { tileMm: number }).tileMm

const paperOn = (on: { power: number; reachMm: number }): GlowLight[] => lanterns.map((l): GlowLight => ({ at: l.at, color: paper(l), power: on.power * l.radius, reachMm: on.reachMm * l.radius, phase: l.phase }))

function lampOn(on: { power: number; reachMm: number; wrap: number }): GlowLight {
  const flame = lampFlame()
  return { at: [flame[0] + LAMP_SHIFT[0], flame[1] + LAMP_SHIFT[1], flame[2] + LAMP_SHIFT[2]], color: tones.lampLight, ...on, phase: 0.1 }
}

export async function prepare(): Promise<void> {
  await Promise.all([prepareTrunk(), prepareModel(MODEL)])
}

export function build(): THREE.Object3D {
  const part = `miniature-${season}`
  const fill = placePoint(FILL_FROM)
  const leaves = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: texture(LEAVES), color: new THREE.Color(LEAF_TINT[0], LEAF_TINT[1], LEAF_TINT[2]), vertexColors: true, roughness: 0.82, side: THREE.DoubleSide, hook: leafHook, key: 'tree-leaves-summer' })
  const g = placeGeometry(geometry(MODEL, 'leaves'))
  bakeGlow(g, [...paperOn(GLOW.leaves), lampOn(LAMP_ON_LEAVES), { at: fill, color: tones.sun, ...FILL_ON_LEAVES, phase: 0.6 }])
  const crown = new THREE.Mesh(g, leaves)
  crown.castShadow = true
  crown.receiveShadow = true
  return new THREE.Group().add(buildTrunk(part, [...paperOn(GLOW.wood), lampOn(LAMP_ON_WOOD), { at: fill, color: tones.sun, ...FILL_ON_WOOD, phase: 0.6 }], BARK), crown)
}

export function lights(): THREE.Object3D {
  const part = `light-${season}`
  const m = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'light', vertexColors: true, roughness: 0.7, metalness: 0, hook: lanternHook, key: 'tree-lanterns-summer' })
  const g = geometry(MODEL, 'lanterns').clone()
  const pivot = g.getAttribute('tangent')
  g.deleteAttribute('tangent')
  g.setAttribute('aPivot', pivot)
  const mesh = new THREE.Mesh(g, m)
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  const halos = new THREE.Mesh(haloGeometry(lanterns.map((l) => l.at), 1, lanterns.map((l) => ({ size: HALO.radius * l.radius, rest: l.order, hot: 1, bloom: 1 }))), lanternHalo(part))
  halos.renderOrder = 3
  return new THREE.Group().add(mesh, halos)
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(trunkSolid(x, y, z), leafField(x - offset[0], y - offset[1], z - offset[2]))
}

export function update(moment: KitMoment): void {
  const turn = (((moment.time / moment.period) % 1) + 1) % 1
  const since = Number.isFinite(moment.sinceLanding) ? Math.min(100, Math.max(0, moment.sinceLanding)) : 100
  const here = moment.beat === null ? 1 : Math.min(1, Math.max(0, moment.arrived / 0.02))
  const lit = since * here * here * (3 - 2 * here)
  sway.value.set(turn, lit, LANTERN.swayRad, LANTERN.kickRad)
  let mean = 0
  for (const l of lanterns) {
    const t = Math.min(1, Math.max(0, (lit - l.order * LANTERN.stepS) / LANTERN.rampS))
    mean += (LANTERN.dim + (1 - LANTERN.dim) * t * t * (3 - 2 * t)) / lanterns.length
  }
  glow.uTwinkle.value.set(CYCLES * turn, FLICKER, mean, 0)
}
