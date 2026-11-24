import * as THREE from 'three'
import { config } from '../../../config'
import { COVER_GLSL, coverUniforms } from '../../../core/chunks/cover'
import { stageMaterial } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { bakeGlow, buildTrunk, crownCap, crownField, crownOffset, glow, glowHook, pads, placeGeometry, placePoint, prepareTrunk, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { season } from './palette'

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
const BULB_GAIN = 12
const GLOW = { needles: { power: 6.8, reachMm: 1.7, star: 0.6 }, snow: { power: 1.56, reachMm: 1.3, star: 0.36 }, wood: { power: 1.8, reachMm: 1.3, star: 0.6 } }
const HALO = { cover: 0.55, edge: 2.5, glow: 0.85, core: 10 }
const STAR_LOCAL: Vec3 = [0.05, 45.7, 0.1]

const offset = crownOffset()
const star = placePoint(STAR_LOCAL)
const arrive = { value: 1 }
const bulbGain = { value: BULB_GAIN }

export const innerLights: InnerLight[] = [
  ...pads.map((p, i): InnerLight => ({ at: [p.at[0], p.at[1] - 0.7 * p.size[1], p.at[2]], color: WARM, power: 0.16, reachMm: 4.5, flicker: FLICKER, cycles: CYCLES, phase: (0.13 + i * 0.381) % 1 })),
  ...[7, 13, 19.5].map((h, i): InnerLight => ({ at: placePoint([0.4, h, 2.6]), color: WARM, power: 0.16, reachMm: 4.5, flicker: FLICKER, cycles: CYCLES, phase: (0.52 + i * 0.29) % 1 })),
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
  glowHook(shader)
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
      diffuseColor.rgb *= treeC.rgb;`,
    )
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = min(pow(diffuseColor.rgb, vec3(1.35)) * vec3(8.4, 5.8, 16.0), vec3(0.85));')
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nif (vCard.x > 0.5) normal *= faceDirection;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${TREE_BUMP}`)
}

const SNOW_MAP = `vec3 treeN = normalize(vTreeN);
vec4 treeC = treeTri(map, vTreeP * uTile, treeN);
float treeH = treeC.g + 0.6 * treeTri(map, vTreeP * uTile * 3.3 + 0.37, treeN).g;
${TREE_SLOPES}
diffuseColor.rgb *= mix(vec3(1.0), treeC.rgb, 0.55);`

function snowFragment(shader: Shader): void {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}`)
    .replace('#include <map_fragment>', SNOW_MAP)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${TREE_BUMP}`)
}

function snowHook(shader: Shader): void {
  glowHook(shader)
  Object.assign(shader.uniforms, coverUniforms, { uTile: { value: 1 / tileOf('snow') }, uBump: { value: 0.22 } })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${COVER_GLSL}\n${TREE_VERT_PARS}`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${TREE_VERT}\ntransformed += normalize(normal + vec3(0.0, 1.2, 0.0)) * (${COVER_RISE.toFixed(3)} * stageCover(position.xz) * smoothstep(-0.2, 0.6, normal.y));`,
    )
  snowFragment(shader)
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
    .replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat treeLit = vColor.a;\nvec3 treeTint = diffuseColor.rgb;\nbool treeHalo = vBulb.y > 2.5;\nfloat treeFace = 0.0;\ndiffuseColor.rgb *= treeHalo ? 0.0 : 1.0 - 0.8 * treeLit;',
    )
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (treeHalo) roughnessFactor = 1.0;')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (treeHalo) metalnessFactor = 0.0;')
    .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      if (treeHalo) {
        treeFace = max(dot(normal, normalize(vViewPosition)), 0.0);
        if (${HALO.cover.toFixed(2)} * pow(treeFace, ${HALO.edge.toFixed(1)}) < stageHash(vec3(gl_FragCoord.xy, uSeed + floor(vBulb.x * 64.0 + 0.5) / 64.0))) discard;
      }`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float treeBlink = uTwinkle.z * (1.0 + uTwinkle.y * sin(6.2831853 * (uTwinkle.x + vBulb.x)));
      totalEmissiveRadiance = treeHalo ? treeTint * treeBlink * (${HALO.glow.toFixed(2)} + uBulb * pow(treeFace, ${HALO.core.toFixed(1)})) : treeTint * treeLit * uBulb * treeBlink;`,
    )
}

const tileOf = (name: string): number => (geometry(MODEL, name).userData.extras as { tileMm: number }).tileMm

function bulbs(on: { power: number; reachMm: number; star: number }): GlowLight[] {
  const list = (geometry(MODEL, 'lights').userData.extras as { bulbs: number[] }).bulbs
  const out: GlowLight[] = []
  for (let i = 0; i < list.length; i += 4) out.push({ at: placePoint([list[i]!, list[i + 1]!, list[i + 2]!]), color: WARM, power: on.power, reachMm: on.reachMm, phase: list[i + 3]! })
  out.push({ at: star, color: GOLD, power: on.star, reachMm: 3, phase: 0.31 })
  return out
}

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
  const needles = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: texture(NEEDLES), vertexColors: true, roughness: 0.88, side: THREE.DoubleSide, hook: needleHook, key: 'tree-needles' })
  const snow = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: texture(SNOW), vertexColors: true, roughness: 0.8, hook: snowHook, key: 'tree-snow' })
  return new THREE.Group().add(buildTrunk(part, bulbs(GLOW.wood)), solidMesh(placed('needles', bulbs(GLOW.needles)), needles), solidMesh(placed('snow', bulbs(GLOW.snow)), snow))
}

export function lights(): THREE.Object3D {
  const m = stageMaterial({ part: `light-${season}`, standIn: false, inside: true, miniature: true, change: 'light', vertexColors: true, roughness: 0.35, metalness: 0.2, hook: lightHook, key: 'tree-lights' })
  const mesh = new THREE.Mesh(placeGeometry(geometry(MODEL, 'lights')), m)
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}

export function arrival(): THREE.Object3D {
  const g = placed('arrival', bulbs(GLOW.snow))
  const base = g.getAttribute('tangent')
  const out = new Float32Array(base.count * 4)
  for (let i = 0; i < base.count; i++) {
    const p = placePoint([base.getX(i), base.getY(i), base.getZ(i)])
    out.set([p[0], p[1], p[2], base.getW(i)], i * 4)
  }
  g.deleteAttribute('tangent')
  g.setAttribute('aBase', new THREE.BufferAttribute(out, 4))
  const m = stageMaterial({ part: `arrival-${season}`, standIn: false, inside: true, miniature: true, change: 'arrival', map: texture(SNOW), vertexColors: true, roughness: 0.82, hook: arrivalHook, key: 'tree-arrival' })
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
  const t = Number.isFinite(moment.sinceLanding) ? Math.min(1, Math.max(0, moment.sinceLanding / config.states.restSeconds)) : 1
  arrive.value = t * t * (3 - 2 * t)
}
