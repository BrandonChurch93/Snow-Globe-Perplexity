import * as THREE from 'three'
import { config } from '../../../config'
import { COVER_GLSL, coverUniforms } from '../../../core/chunks/cover'
import { stageMaterial, stageShader } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { haloGeometry, haloMaterial } from '../../../miniature/glow'
import { lampFlame } from '../../../miniature/roof'
import { bakeGlow, buildTrunk, crownCap, crownField, crownOffset, glow, glowHook, pads, placeGeometry, placePoint, prepareTrunk, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { season, tones } from './palette'

type Shader = THREE.WebGLProgramParametersWithUniforms

const MODEL = 'winter/tree-crown.glb'
const NEEDLES = 'winter/tree-needles.srgb.tile.w1024.png'
const SPRIGS = 'winter/tree-sprigs.srgb.w512.png'
const SNOW = 'winter/tree-snow.srgb.tile.w1024.png'
const CYCLES = 5
const FLICKER = 0.14
const COVER_RISE = 0.12
const WARM: [number, number, number] = [1, 0.56, 0.33]
const GOLD: [number, number, number] = [1, 0.84, 0.52]
const BULB_GAIN = 16
const GLOW = { needles: { power: 30, reachMm: 0.9, star: 0.6 }, snow: { power: 1, reachMm: 1.4, star: 0.36 }, wood: { power: 7.5, reachMm: 1.5, star: 0.6 } }
const LAMP_ON_WOOD = { power: 100, reachMm: 12, wrap: -0.45 }
const LAMP_ON_SNOW = { power: 1.5, reachMm: 14, wrap: 0.6 }
const LAMP_SHIFT: Vec3 = [-3, 0, -5]
const FILL_ON_WOOD = { power: 3, reachMm: 1000, wrap: 0.4 }
const SKY_ON_SNOW = { power: 1.25, reachMm: 14, wrap: 0.15 }
const SKY_FROM: Vec3 = [20, 42, 7]
const FILL_FROM: Vec3 = [40, 20, 60]
const BARK: [number, number, number] = [0.09, 0.105, 0.1]
const SNOW_TINT: [number, number, number] = [1.16, 1.18, 1.28]
const NEEDLE_TINT: [number, number, number] = [1.3, 1.82, 3.84]
const NEEDLE_LIT = 'vec3(1.55, 1.02, 0.78)'
const LAMP_ON_NEEDLES = { power: 9, reachMm: 12, wrap: 0.1 }
const HALO = { radiusMm: 0.6, strength: 0.75, hot: 9, pullMm: 0.6, flicker: FLICKER, cycles: CYCLES }
const HALO_EDGE: [number, number, number] = [0.75, 0.36, 0.08]
const HALO_CORE: [number, number, number] = [1, 0.74, 0.4]
const AURA = { radiusMm: 2.6, strength: 0.11, flicker: 0.08, cycles: 3 }
const AURA_EDGE: [number, number, number] = [0.85, 0.5, 0.16]
const AURA_CORE: [number, number, number] = [1, 0.8, 0.46]
const FOG_DIM = { from: 0.5, to: 0.9, cap: 0.6 }
const STAR_LOCAL: Vec3 = [0.25, 45.2, 0.1]
const SPARKLE = { share: 0.014, perMm: 8, gain: 1.4 }
const EDGE_MM = 0.42
const STEM_LIGHTS: readonly Vec3[] = [[1.2, 12.5, 4.4], [-0.4, 19.5, 3.6], [0.2, 27, 3]]

const offset = crownOffset()
const star = placePoint(STAR_LOCAL)
const arrive = { value: 1 }
const bulbGain = { value: BULB_GAIN }
const clock = { value: 0 }

export const innerLights: InnerLight[] = [
  ...pads.map((p, i): InnerLight => ({ at: [p.at[0], p.at[1] - 0.7 * p.size[1], p.at[2]], color: WARM, power: 0.16, reachMm: 4.5, flicker: FLICKER, cycles: CYCLES, phase: (0.13 + i * 0.381) % 1 })),
  ...STEM_LIGHTS.map((p, i): InnerLight => ({ at: placePoint(p), color: WARM, power: 0.16, reachMm: 4.5, flicker: FLICKER, cycles: CYCLES, phase: (0.52 + i * 0.29) % 1 })),
  { at: star, color: GOLD, power: 0.7, reachMm: 8, flicker: 0.08, cycles: 3, phase: 0.31 },
]

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

const TREE_VERT_PARS = 'varying vec3 vTreeP;\nvarying vec3 vTreeN;'
const TREE_VERT = 'vTreeP = position;\nvTreeN = normal;'
const TREE_SLOPES = 'vec3 treeSx = dFdx(-vViewPosition);\nvec3 treeSy = dFdy(-vViewPosition);\nvec2 treeDh = vec2(dFdx(treeH), dFdy(treeH));'
const TREE_BUMP = 'normal = treeBump(treeSx, treeSy, treeDh, normal, faceDirection);'

function needleHook(shader: Shader): void {
  glowHook(shader, `material.diffuseContribution * ${NEEDLE_LIT}`)
  Object.assign(shader.uniforms, { uTile: { value: 1 / tileOf('needles') }, uBump: { value: 0.3 }, uSprigs: { value: texture(SPRIGS) } })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nattribute vec2 uv1;\nvarying vec2 vCard;\n${TREE_VERT_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCard = uv1;\n${TREE_VERT}`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}\nuniform sampler2D uSprigs;\nvarying vec2 vCard;`)
    .replace(
      '#include <map_fragment>',
      `vec4 treeBody = treeTri(map, vTreeP * uTile, normalize(vTreeN));
      vec4 treeSprig = texture2D(uSprigs, vMapUv);
      bool treeCard = vCard.x > 0.5;
      vec4 treeC = treeCard ? treeSprig : treeBody;
      float treeH = dot(treeC.rgb, vec3(0.3, 0.6, 0.1));
      ${TREE_SLOPES}
      if (treeCard && treeC.a < 0.04 + 0.96 * stageHash(vec3(gl_FragCoord.xy, uSeed + floor(vCard.y + 0.5) / 64.0))) discard;
      vec3 treeOwn = pow(treeC.rgb, vec3(1.9)) * 1.9;
      diffuseColor.rgb *= mix(vec3(dot(treeOwn, vec3(0.3, 0.6, 0.1))), treeOwn, 0.38);`,
    )
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nif (vCard.x > 0.5) normal *= faceDirection;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${TREE_BUMP}`)
}

const SNOW_MAP = `vec3 treeN = normalize(vTreeN);
vec4 treeC = treeTri(map, vTreeP * uTile, treeN);
float treeH = treeC.g + 0.6 * treeTri(map, vTreeP * uTile * 3.3 + 0.37, treeN).g;
${TREE_SLOPES}
float treeGlint = step(${(1 - SPARKLE.share).toFixed(4)}, stageHash(floor(vTreeP * ${SPARKLE.perMm.toFixed(1)}) + 0.5));
diffuseColor.rgb *= mix(vec3(1.0), treeC.rgb, 0.3) * (1.0 + ${SPARKLE.gain.toFixed(2)} * treeGlint);`

function snowFragment(shader: Shader): void {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}`)
    .replace('#include <map_fragment>', SNOW_MAP)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${TREE_BUMP}`)
}

function snowHook(shader: Shader): void {
  glowHook(shader)
  Object.assign(shader.uniforms, coverUniforms, { uTile: { value: 1 / tileOf('snow') }, uBump: { value: 0.16 } })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${COVER_GLSL}\n${TREE_VERT_PARS}\nattribute vec2 uv1;\nvarying float vTreeEdge;`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${TREE_VERT}\nvTreeEdge = uv1.x;\ntransformed += normalize(normal + vec3(0.0, 1.2, 0.0)) * (${COVER_RISE.toFixed(3)} * stageCover(position.xz) * smoothstep(-0.2, 0.6, normal.y));`,
    )
  snowFragment(shader)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vTreeEdge;')
    .replace('vec3 treeN = normalize(vTreeN);', `if (vTreeEdge < ${EDGE_MM.toFixed(2)} * stageHash(floor(vTreeP * ${SPARKLE.perMm.toFixed(1)}) + 0.5)) discard;\nvec3 treeN = normalize(vTreeN);`)
}

function arrivalHook(shader: Shader): void {
  glowHook(shader)
  Object.assign(shader.uniforms, { uTile: { value: 1 / tileOf('arrival') }, uBump: { value: 0.22 }, uArrive: arrive })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nuniform float uArrive;\nattribute vec4 aBase;\n${TREE_VERT_PARS}`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${TREE_VERT}\nfloat treeGrow = clamp(uArrive * 1.6 - aBase.w * 0.6, 0.0, 1.0);\ntransformed = mix(aBase.xyz, position, treeGrow * treeGrow * (3.0 - 2.0 * treeGrow));`,
    )
  snowFragment(shader)
}

function lightHook(shader: Shader): void {
  Object.assign(shader.uniforms, { uTwinkle: glow.uTwinkle, uBulb: bulbGain })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vBulb;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBulb = uv;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec4 uTwinkle;\nuniform float uBulb;\nvarying vec2 vBulb;')
    .replace('#include <color_fragment>', '#include <color_fragment>\nfloat treeLit = vColor.a;\nvec3 treeTint = diffuseColor.rgb;\ndiffuseColor.rgb *= 1.0 - 0.8 * treeLit;')
    .replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance = treeTint * treeLit * uBulb * uTwinkle.z * (1.0 + uTwinkle.y * sin(6.2831853 * (uTwinkle.x + vBulb.x)));',
    )
    .replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>\n#ifdef STAGE_INSIDE\ngl_FragColor.rgb = mix(gl_FragColor.rgb, min(gl_FragColor.rgb, vec3(${FOG_DIM.cap.toFixed(2)})), smoothstep(${FOG_DIM.from.toFixed(2)}, ${FOG_DIM.to.toFixed(2)}, stageVeil(vStageAux.x)));\n#endif`,
    )
}

const v3 = (c: readonly number[]): string => `vec3(${c[0]!.toFixed(3)}, ${c[1]!.toFixed(3)}, ${c[2]!.toFixed(3)})`

function auraMaterial(part: string): THREE.ShaderMaterial {
  return stageShader({
    part,
    standIn: false,
    inside: true,
    change: 'light',
    uniforms: { uClock: clock },
    params: { side: THREE.FrontSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false },
    vertexPars: 'attribute vec4 aHalo;\nvarying vec4 vHalo;',
    vertexMain: 'vHalo = vec4((modelMatrix * vec4(aHalo.xyz, 1.0)).xyz, aHalo.w);',
    fragment: `
uniform float uClock;
varying vec4 vHalo;
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
  float g = max(0.0, 1.0 - dot(off, off) / ${(AURA.radiusMm * AURA.radiusMm).toFixed(3)});
  float beat = 1.0 + ${AURA.flicker.toFixed(3)} * sin(6.2831853 * (${AURA.cycles.toFixed(1)} * uClock + vHalo.w));
  gl_FragColor = vec4(mix(${v3(AURA_EDGE)}, ${v3(AURA_CORE)}, g), g * g * ${AURA.strength.toFixed(3)} * beat * (1.0 - stageVeil(vStageAux.x)));
}
`,
  })
}

const tileOf = (name: string): number => (geometry(MODEL, name).userData.extras as { tileMm: number }).tileMm

function bulbs(on: { power: number; reachMm: number; star: number }): GlowLight[] {
  const list = (geometry(MODEL, 'lights').userData.extras as { bulbs: number[] }).bulbs
  const out: GlowLight[] = []
  for (let i = 0; i < list.length; i += 4) out.push({ at: placePoint([list[i]!, list[i + 1]!, list[i + 2]!]), color: WARM, power: on.power, reachMm: on.reachMm, phase: list[i + 3]! })
  out.push({ at: star, color: GOLD, power: on.star, reachMm: 3, phase: 0.31 })
  return out
}

function lampOn(on: { power: number; reachMm: number; wrap: number }): GlowLight {
  const flame = lampFlame()
  return { at: [flame[0] + LAMP_SHIFT[0], flame[1] + LAMP_SHIFT[1], flame[2] + LAMP_SHIFT[2]], color: tones.lampLight, ...on, phase: 0.1 }
}

const onSnow = (): GlowLight[] => [...bulbs(GLOW.snow), lampOn(LAMP_ON_SNOW), { at: placePoint(SKY_FROM), color: tones.sheen, ...SKY_ON_SNOW, phase: 0.6 }]

function placed(name: string, lit: readonly GlowLight[]): THREE.BufferGeometry {
  const g = placeGeometry(geometry(MODEL, name))
  bakeGlow(g, lit)
  return g
}

function solidMesh(g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export async function prepare(): Promise<void> {
  await Promise.all([prepareTrunk(), prepareModel(MODEL)])
}

export function build(): THREE.Object3D {
  const part = `miniature-${season}`
  const needles = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: texture(NEEDLES), color: new THREE.Color(NEEDLE_TINT[0], NEEDLE_TINT[1], NEEDLE_TINT[2]), vertexColors: true, roughness: 0.88, side: THREE.DoubleSide, hook: needleHook, key: 'tree-needles' })
  const snow = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: texture(SNOW), color: new THREE.Color(SNOW_TINT[0], SNOW_TINT[1], SNOW_TINT[2]), vertexColors: true, roughness: 0.8, hook: snowHook, key: 'tree-snow' })
  const fill: GlowLight = { at: placePoint(FILL_FROM), color: tones.sheen, ...FILL_ON_WOOD, phase: 0.6 }
  return new THREE.Group().add(buildTrunk(part, [...bulbs(GLOW.wood), lampOn(LAMP_ON_WOOD), fill], BARK), solidMesh(placed('needles', [...bulbs(GLOW.needles), lampOn(LAMP_ON_NEEDLES)]), needles), solidMesh(placed('snow', onSnow()), snow))
}

export function lights(): THREE.Object3D {
  const part = `light-${season}`
  const m = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'light', vertexColors: true, roughness: 0.35, metalness: 0.2, hook: lightHook, key: 'tree-lights' })
  const mesh = new THREE.Mesh(placeGeometry(geometry(MODEL, 'lights')), m)
  mesh.castShadow = false
  mesh.receiveShadow = false
  const halos = new THREE.Mesh(haloGeometry(bulbs(GLOW.wood).slice(0, -1).map((b) => b.at), HALO.radiusMm), haloMaterial(part, HALO_EDGE, HALO_CORE, HALO, clock))
  halos.renderOrder = 3
  const aura = new THREE.Mesh(haloGeometry([star], AURA.radiusMm), auraMaterial(part))
  aura.renderOrder = 3
  return new THREE.Group().add(mesh, halos, aura)
}

export function arrival(): THREE.Object3D {
  const g = placed('arrival', onSnow())
  const base = g.getAttribute('tangent')
  const out = new Float32Array(base.count * 4)
  for (let i = 0; i < base.count; i++) {
    const p = placePoint([base.getX(i), base.getY(i), base.getZ(i)])
    out.set([p[0], p[1], p[2], base.getW(i)], i * 4)
  }
  g.deleteAttribute('tangent')
  g.setAttribute('aBase', new THREE.BufferAttribute(out, 4))
  const m = stageMaterial({ part: `arrival-${season}`, standIn: false, inside: true, miniature: true, change: 'arrival', map: texture(SNOW), color: new THREE.Color(SNOW_TINT[0], SNOW_TINT[1], SNOW_TINT[2]), vertexColors: true, roughness: 0.82, hook: arrivalHook, key: 'tree-arrival' })
  return solidMesh(g, m)
}

export function solid(x: number, y: number, z: number): number {
  const lx = x - offset[0]
  const ly = y - offset[1]
  const lz = z - offset[2]
  return Math.min(trunkSolid(x, y, z), crownField(lx, ly, lz), crownCap(lx, ly, lz))
}

export function update(moment: KitMoment): void {
  glow.uTwinkle.value.set((CYCLES * moment.time) / moment.period, FLICKER, 1, 0)
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  const t = Number.isFinite(moment.sinceLanding) ? Math.min(1, Math.max(0, moment.sinceLanding / config.states.restSeconds)) : 1
  arrive.value = t * t * (3 - 2 * t)
}
