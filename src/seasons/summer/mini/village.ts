import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { config } from '../../../config'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial, type Rgb } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { GLOW, glowGeometry, glowMaterial, glowPiece, haloGeometry, haloMaterial } from '../../../miniature/glow'
import { MIRROR_GLSL, MIRROR_MAX, mirrorUniforms } from '../../../miniature/mirror'
import { prepareVillage, tileMm, villageGeometry, villageGrain } from '../../../miniature/model'
import { lampFlame, lampFoot, shrubDistance } from '../../../miniature/roof'
import { BUMP_GLSL, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, withSurface, type GlowSource } from '../../../miniature/surface'
import { anchors, cottage as house, cottageFrame, groundAt, moundAt, moundSlope, pond, solidDistance, tree } from '../../../scene/layout'
import { gainOf } from '../../../scene/lightgrid'
import type { InnerLight, KitMoment } from '../../kit'
import { lanterns, type Lantern } from './lanterns'
import { isTree, season, tones } from './palette'
import { riseAt } from './turf'

const MODEL = 'summer/village-summer.glb'
const TURF = 'summer/village-turf.lin.tile.png'
const PART = `miniature-${season}`
const LIGHT = `light-${season}`

const LAMP = { power: 3, reachMm: 12, flicker: 0.05, cycles: 3, phase: 0.1 }
const WINDOW = { power: 0.9, reachMm: 8, flicker: 0.1, cycles: 5, phase: 0.4 }
const NEAR = { lamp: { power: 2.1, reachMm: 7 }, pane: { power: 2.2, reachMm: 4 }, paper: { power: 2.6, reachMm: 7 } }
// Each paper lantern lays a pool of orange gold on what stands behind it and under it, a lantern and a half wide. A wall
// takes it from the lantern drawn up to it, the turf from a point just over it; the lamp post lays its own on the path.
// It follows its lantern up after the landing (the times are the tree's, `LANTERN` in tree.ts) and never burns: what it adds
// bends over under `cap`.
const POOL = { patch: 600, patchReach: 1.3, patchCap: 0.5, ember: [1, 0.4, 0.1] as Rgb, emberShare: 0.65, down: 0.55, face: 0.3, frontMm: 8, leaf: 0.015, hug: 1.1, lawn: 2.0, lawnReach: 2.4, overMm: 3, ends: 2.2, wrap: 0.22, post: 10, postReachMm: 4.5, postOverMm: 2.5, wash: 0.12, cap: 0.65, dim: 0.4, firstStepS: 0.23, firstRampS: 0.42, rampS: 0.8, stepS: 0.6, orange: [1, 0.5, 0.17] as Rgb, cream: [1, 0.68, 0.34] as Rgb, gold: [1, 0.62, 0.28] as Rgb, straw: [0.32, 0.27, 0.17] as Rgb, strawShare: 0.45 }
// The liquid is lit: it lies between the eye and every dark thing in the ball, so nothing in it is black.
const LIFT: Rgb = [0.012, 0.0098, 0.0062]
// The bank's turf faces away from the low sun: it takes the sky's light, as the mound's front does in the approved image.
const SLOPE = { ground: 2.6, blade: 6.5, fromMm: 55.6, toMm: 56.3 }
// The low sun stands behind the scene to the right. What turns from the eye toward it takes a rim of it; a blade's tip lets it through.
const RIM = { wall: 2.0, tint: [0.62, 0.46, 0.26] as Rgb, share: 0.5, turf: 0.5, tip: 2.4, tipFar: 1.6, tipLow: 0.12, tipTint: [1.0, 0.7, 0.26] as Rgb, tipShare: 0.8, edge: 1.8, edgeTint: [1.0, 0.82, 0.55] as Rgb, edgeFromMm: 0.1, edgeToMm: 0.9, topMm: 0.85, eave: 0.7, eaveFromMm: 1.25, eaveToMm: 1.6, leaf: 1.2, petal: 3.0, rail: 0.65 }
const NEAR_WALL = { lamp: { power: 1.6, reachMm: 8, ends: 3 }, pane: { power: 2.0, reachMm: 4.5, ends: 3 }, paper: { power: 3.4, reachMm: 6.5, ends: 3 } }
const MIRROR = { lamp: 9, flame: 5, pane: 1.2, paper: 1.6, tight: 0.002, wide: 0.03, wideShare: 0.01, lowMm: 3.4 }
const HALO = { radiusMm: 0.75, strength: 1, hot: 2, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 1, glare: [1.6, 1.12, 0.66] as Rgb }
const HALO_KIND = { lamp: { size: 3.6, rest: 0.08, hot: 0, bloom: 0.2 }, pane: { size: 2.6, rest: 0.07, hot: 0, bloom: 0.2 }, pool: { size: 5, rest: 0, hot: 0, bloom: 0.06 } }
const THROUGH = 6
const LAMP_GLASS: Rgb = [1.6, 0.66, 0.15]
const WALL_FILL = 0.3
const SAND = { white: [0.93, 0.86, 0.72] as Rgb, whiten: 0.9, clumpPerMm: 1.1, midPerMm: 2.1, sparkMid: 0.08, grainPerMm: 4.2, heapPerMm: 0.16, heapLow: 0.9, heap: 0.16, reliefMm: 0.5, reliefClump: 0.12, reliefMid: 0.05, body: 1.15, floor: 1.0, wrap: 0.6, foot: [0.5, 0.42, 0.33] as Rgb, footFrom: 0.55, footTo: 1.0, mottleLow: 0.8, mottle: 1.1, lip: 1.1, lipLow: 0.5, lipFrom: 0.15, lipTo: 0.75, breakPerMm: 0.3, shade: [1.2, 1.36, 1.6] as Rgb, shadeLow: 0.8, right: [0.75, 0.7, 0.64] as Rgb, rightFromMm: 6, rightToMm: 26, left: 0.5, leftFromMm: -36, leftToMm: -14, edgeSoft: 0.12, lipTint: [0.95, 1.0, 1.08] as Rgb, edgeVary: 0.1, fadeFrom: 0.95, fadeTo: 1.4, bump: 0.6, grainLow: 0.68, grain: 0.36, spark: 0.3, glint: 1.2 }
const TURF_LOOK = { tone: 0.5, fineMm: 0.05, clumpMm: 0.22, fill: 0.4, wrap: 0.5, sun: 0.7, moss: [0.15, 0.2, 0.34] as Rgb, rim: 0.9, rimFromMm: 30, rimToMm: 46 }
// Where the low sun reaches the floor: the same four pools as `sunAt` in assets-src/village-summer/build.mjs, which the grass carries.
const SUN_POOLS: readonly [number, number, number, number, number][] = [[1.5, 24, 4, 13, 9], [0.7, 6, -4, 9, 6], [0.4, -24, 21, 6, 5], [0.5, 24, 22, 9, 6]]
const GRASS_LOOK = { fill: 0.2, wrap: 1.0, through: 0.16, near: 0.3, sun: 0.9, patchLow: 0.12, moss: [0.15, 0.2, 0.34] as Rgb, patchPerMm: 0.3, sunRoot: 0.12, rightDark: 0.35, rightGlow: 0.15, rightFromMm: 1, rightToMm: 6, shade: [0.26, 0.3, 0.45] as Rgb }
const ROOF = { slate: [0.2, 0.25, 0.33] as Rgb, chimney: [0.21, 0.225, 0.25] as Rgb, vary: 0.75, varyMm: 1.3, stone: [0.66, 0.58, 0.46] as Rgb, block: [0.7, 0.62, 0.5] as Rgb, paneMm: 2.2, stoneMid: 0.42, blockMid: 0.6, gableMm: 0.55, stoneFlat: 1.0, stoneHue: 0.5, plank: [0.36, 0.3, 0.26] as Rgb, plankMm: 2.2, plankTall: 3.8, pitch: 0.2, stoneMm: 1.4, picket: [0.85, 0.5, 0.27] as Rgb, picketMm: 1.6, boardMm: 0.9, boardVary: 0.9, grainMm: 0.22, grainVary: 0.5, boardFoot: 0.7, boardTall: 3.2, pale: 0.25, rail: [3.0, 2.0, 1.15] as Rgb, railTop: 1.9, door: [0.1, 0.052, 0.034] as Rgb, verge: [0.11, 0.085, 0.07] as Rgb, sheen: 4.2, sheenMm: 3.5, doorMm: 2.9, reachMm: 0.4, buryMm: 1.5 }
const DARK_PANE = 0.8
// The shared stone map lies stretched along the walls and reads as courses of logs. The approved's walls are round cobbles of
// unlike size in dark joints, lit on their upper left: cells drawn pixel by pixel in place of the map's grain, the bump laid flat.
// The lanterns' patch is capped and would level the stones out: it takes their light and dark after the cap.
const COBBLE = { cellMm: 1.9, joint: 0.3, dark: 0.2, lit: 0.9, flat: 1.0, base: 0.66, grain: 0.3, smooth: 0.8, patch: 0.8, patchTop: 1.2 }
// The approved cottage has a short stack: what stands over the ridge is drawn in to under half its height, in this season's
// copy of the mesh and in what the particles meet.
const STACK = { fromMm: 18.8, squash: 0.45, marginMm: 0.9, pot: 0.3 }
const WATER = { spark: 0.5, mass: 0.975, houseMm: 9.5, houseTall: 17, flat: 0.14, wobble: 0.4, rough: 0.035, ripple: 0.0045, fine: 0.0012, shoreFrom: 0.84, shoreTo: 1.0, sky: 1.25, skyFrom: -0.75, skyTo: 0.35, skyAt: -2.3, skyWide: 8, skyLow: 0.1, bankMm: 0.7, bankVary: 1.1, bankEdge: 0.16, bankDark: 0.6, env: 0.1, glint: 0.65, squash: 0.14, paperGlint: 0.16, paperMm: 0.9, paperTall: 0.5, post: 0.93, postMm: 0.75, postTall: 11.5, trunk: 0.975, trunkMm: 5.2, trunkTall: 26, body: 0.4 }

const flame = lampFlame()
const mirrored: [number, number, number] = [flame[0], flame[1] - MIRROR.lowMm, flame[2]]
const postFoot = lampFoot() as Rgb
const trunkFoot: Rgb = [tree.x, groundAt(tree.x, tree.z), tree.z]
const houseFoot: Rgb = [-9.6, groundAt(-9.6, -3), -3]
const paperOf = (tone: string): Rgb => (tone === 'cream' ? tones.creamLight : tones.paperLight)

export const innerLights: InnerLight[] = [
  { at: flame, color: tones.lampLight, ...LAMP },
  { at: anchors.window, color: tones.roomLight, ...WINDOW },
]

const frame = cottageFrame()
const poolOf = (tone: string): Rgb => (tone === 'cream' ? POOL.cream : POOL.orange)
const embered = (c: Rgb): Rgb => [c[0] + (POOL.ember[0] - c[0]) * POOL.emberShare, c[1] + (POOL.ember[1] - c[1]) * POOL.emberShare, c[2] + (POOL.ember[2] - c[2]) * POOL.emberShare]
const over = (x: number, z: number, mm: number): [number, number, number] => [x, groundAt(x, z) + riseAt(x, z) + mm, z]
// A lantern that hangs before the gable is drawn up to within a little more than its own radius of the wall.
function hugged(l: Lantern): readonly [number, number, number] {
  const dx = l.at[0] - house.x
  const dz = l.at[2] - house.z
  const gap = frame.u[0] * dx + frame.u[1] * dz - house.halfLength
  if (gap < 0 || Math.abs(frame.v[0] * dx + frame.v[1] * dz) > house.halfWidth + l.radius) return l.at
  const pull = Math.max(0, gap - POOL.hug * l.radius)
  return [l.at[0] - frame.u[0] * pull, l.at[1], l.at[2] - frame.u[1] * pull]
}
interface Pool {
  at: readonly [number, number, number]
  color: Rgb
  power: number
  reachMm: number
  startS: number
}
const startOf = (order: number): number => (order < 2 ? order * POOL.firstStepS : POOL.firstRampS + POOL.stepS * (order - 2))
const postPool: Pool = { at: over(flame[0] + 0.4, flame[2] + 1.6, POOL.postOverMm), color: POOL.gold, power: POOL.post, reachMm: POOL.postReachMm, startS: -1 }
const lawnPools = [...lanterns.map((l): Pool => ({ at: over(l.at[0], l.at[2], POOL.overMm), color: poolOf(l.tone), power: POOL.lawn, reachMm: POOL.lawnReach * l.radius, startS: startOf(l.order) })), postPool]
// A wall has too few points to hold a patch one lantern wide: the lanterns that hang before the gable lay theirs on it
// pixel by pixel, each a bell round its lantern that reaches further down than up, onto the arch and the door.
const patches = lanterns
  .filter((l) => {
    const dx = l.at[0] - house.x
    const dz = l.at[2] - house.z
    const gap = frame.u[0] * dx + frame.u[1] * dz - house.halfLength
    return gap > 0 && gap < POOL.frontMm && Math.abs(frame.v[0] * dx + frame.v[1] * dz) < house.halfWidth + l.radius
  })
  .map((l) => ({ at: hugged(l), color: embered(poolOf(l.tone)), reachMm: POOL.patchReach * l.radius, startS: startOf(l.order), rampS: l.order < 2 ? POOL.firstRampS : POOL.rampS }))

function withPools(g: THREE.BufferGeometry, pools: readonly Pool[]): THREE.BufferGeometry {
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal')
  const out = new Float32Array(P.count * 4)
  for (let i = 0; i < P.count; i++) {
    let weight = 0
    let start = 0
    for (const l of pools) {
      const dx = l.at[0] - P.getX(i)
      const dy = l.at[1] - P.getY(i)
      const dz = l.at[2] - P.getZ(i)
      const d2 = dx * dx + dy * dy + dz * dz
      const reach2 = l.reachMm * l.reachMm
      const far = d2 / (reach2 * POOL.ends * POOL.ends)
      if (far >= 1) continue
      const d = Math.sqrt(d2) || 1e-6
      const facing = Math.max(0, ((N.getX(i) * dx + N.getY(i) * dy + N.getZ(i) * dz) / d) * (1 - POOL.wrap) + POOL.wrap)
      const f = (l.power * facing * (1 - far) * (1 - far)) / (1 + d2 / reach2)
      for (let c = 0; c < 3; c++) out[i * 4 + c]! += l.color[c]! * f
      weight += f
      start += f * l.startS
    }
    out[i * 4 + 3] = weight > 0 ? start / weight : 0
  }
  g.setAttribute('aPool', new THREE.BufferAttribute(out, 4))
  return g
}

const PATCH_VERT_PARS = 'varying vec3 vPoolN;'
const COBBLE_AT = 'float villageMetal = villageIron * 0.55;'
const BUMP_AT = 'normal = villageBump(-vViewPosition, normal, villageDh, faceDirection);'
const COBBLE_PARS = `varying float vCobble;
float cobbleShade = 1.0;
vec2 cobbleHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}`
const cobbleMap = (): string => `if (vCobble > 0.001) {
  vec2 cobbleP = vec2(dot(vStageLocal.xz, vec2(${(frame.u[0] + frame.v[0]).toFixed(4)}, ${(frame.u[1] + frame.v[1]).toFixed(4)})), vStageLocal.y) * ${(1 / COBBLE.cellMm).toFixed(4)};
  vec2 cobbleI = floor(cobbleP);
  vec2 cobbleF = cobbleP - cobbleI;
  float cobbleNear = 8.0;
  float cobbleNext = 8.0;
  vec2 cobbleTo = vec2(0.0);
  vec2 cobbleId = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cobbleG = vec2(float(i), float(j));
      vec2 cobbleH = cobbleHash(cobbleI + cobbleG);
      vec2 cobbleR = cobbleG + 0.15 + 0.7 * cobbleH - cobbleF;
      float cobbleD = dot(cobbleR, cobbleR);
      if (cobbleD < cobbleNear) {
        cobbleNext = cobbleNear;
        cobbleNear = cobbleD;
        cobbleTo = cobbleR;
        cobbleId = cobbleH;
      } else if (cobbleD < cobbleNext) {
        cobbleNext = cobbleD;
      }
    }
  }
  float cobbleJoint = smoothstep(0.02, ${COBBLE.joint.toFixed(2)}, sqrt(cobbleNext) - sqrt(cobbleNear));
  float cobbleLit = clamp(1.0 + ${COBBLE.lit.toFixed(2)} * dot(cobbleTo, vec2(0.6, -0.8)), 0.5, 1.6);
  vec3 cobbleTone = mix(vec3(0.78, 0.74, 0.68), vec3(1.3, 1.22, 1.08), cobbleId.x) * mix(vec3(1.0), vec3(1.05, 0.9, 0.74), step(0.62, cobbleId.y));
  cobbleShade = mix(1.0, clamp(cobbleLit * mix(${COBBLE.dark.toFixed(2)}, 1.0, cobbleJoint) * dot(cobbleTone, vec3(0.3, 0.6, 0.1)) * ${COBBLE.patch.toFixed(2)}, 0.0, ${COBBLE.patchTop.toFixed(2)}), vCobble);
  diffuseColor.rgb *= mix(vec3(1.0), cobbleTone * (cobbleLit * mix(${COBBLE.dark.toFixed(2)}, 1.0, cobbleJoint) * mix(${COBBLE.base.toFixed(2)}, villageTone, ${COBBLE.grain.toFixed(2)}) / max(villageTone, 0.05)), vCobble);
}`
const PATCH_VERT_MAIN = 'vPoolN = normal;'
const POOL_VERT_PARS = 'attribute vec4 aPool;\nvarying vec4 vPool;'
const POOL_VERT_MAIN = 'vPool = aPool;'
const POOL_FRAG_PARS = 'varying vec4 vPool;\nuniform float uPoolSince;'
const poolLight = (body: string): string => `{
  vec3 poolC = vPool.rgb * (uGlowGain * mix(${POOL.dim.toFixed(2)}, 1.0, smoothstep(0.0, mix(${POOL.firstRampS.toFixed(2)}, ${POOL.rampS.toFixed(2)}, step(0.4, vPool.a)), uPoolSince - vPool.a))) * ${body};
  float poolM = max(max(poolC.r, poolC.g), poolC.b);
  totalEmissiveRadiance += poolC * (${POOL.cap.toFixed(2)} * (1.0 - exp(-poolM / ${POOL.cap.toFixed(2)})) / max(poolM, 1e-4));
}`

const patchLight = (body: string): string => `{
  vec3 poolN = normalize(vPoolN);
  vec3 poolSum = vec3(0.0);
  vec3 poolD;
  float poolR;
  float poolF;
${patches
  .map(
    (q) => `  poolD = vec3(${q.at[0].toFixed(3)}, ${q.at[1].toFixed(3)}, ${q.at[2].toFixed(3)}) - vStageLocal;
  poolD.y *= poolD.y > 0.0 ? ${POOL.down.toFixed(2)} : 1.0;
  poolR = dot(poolD, poolD);
  poolF = dot(poolN, poolD) * inversesqrt(max(poolR, 0.01));
  poolSum += ${glsl(q.color)} * (exp(-poolR / ${(q.reachMm * q.reachMm).toFixed(3)}) * mix(${POOL.face.toFixed(2)}, 1.0, mix(max(poolF, 0.0), abs(poolF), villageLeaf)) * mix(${POOL.dim.toFixed(2)}, 1.0, smoothstep(0.0, ${q.rampS.toFixed(2)}, uPoolSince - ${q.startS.toFixed(2)})));`,
  )
  .join('\n')}
  vec3 poolP = poolSum * (uGlowGain * ${POOL.patch.toFixed(1)}) * ${body} / max(cobbleShade, 0.05);
  float poolQ = max(max(poolP.r, poolP.g), poolP.b);
  totalEmissiveRadiance += poolP * (${POOL.patchCap.toFixed(2)} * (1.0 - exp(-poolQ / ${POOL.patchCap.toFixed(2)})) / max(poolQ, 1e-4)) * cobbleShade;
}`

const near: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR.paper.power * l.radius, reachMm: NEAR.paper.reachMm * l.radius })),
]

const nearWall: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR_WALL.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR_WALL.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR_WALL.paper.power * l.radius * POOL.wash, reachMm: NEAR_WALL.paper.reachMm * l.radius, ends: NEAR_WALL.paper.ends })),
]

const gain = { value: 1 }
const since = { value: 100 }
const clock = { value: 0 }
const storm = { value: 0 }

const glsl = (c: Rgb): string => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`

export async function prepare(): Promise<void> {
  await Promise.all([prepareVillage(), prepareModel(MODEL)])
}

function turfMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(TURF),
    roughness: 0.95,
    metalness: 0,
    change: 'miniature',
    key: 'village-turf-summer',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uPoolSince: since })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}\n${POOL_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}\n${POOL_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
${POOL_FRAG_PARS}
// Grains of sand have no tile: they are counted off in the globe's own millimetres, so no weave shows where the map repeats.
float sandHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float sandNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sandHash(i), sandHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(sandHash(i + vec3(0.0, 1.0, 0.0)), sandHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(sandHash(i + vec3(0.0, 0.0, 1.0)), sandHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(sandHash(i + vec3(0.0, 1.0, 1.0)), sandHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float turfSunAt(vec2 p) {
  // No pool of sun on the bank of the pond: it lies under the grass that hangs over the water.
  vec2 turfPondD = p - vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)});
  vec2 turfPondL = abs(vec2(${Math.cos(pond.yaw).toFixed(4)} * turfPondD.x - ${Math.sin(pond.yaw).toFixed(4)} * turfPondD.y, ${Math.sin(pond.yaw).toFixed(4)} * turfPondD.x + ${Math.cos(pond.yaw).toFixed(4)} * turfPondD.y) / vec2(${pond.rx.toFixed(2)}, ${pond.rz.toFixed(2)}));
  float turfBank = smoothstep(1.06, 1.4, pow(abs(pow(abs(turfPondL.x), ${pond.power.toFixed(1)}) + pow(abs(turfPondL.y), ${pond.power.toFixed(1)})), ${(1 / pond.power).toFixed(4)}));
  return turfBank * clamp(${SUN_POOLS.map(([k, x, z, rx, rz]) => `${k.toFixed(2)} * exp(-dot((p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)}), (p - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / vec2(${rx.toFixed(1)}, ${rz.toFixed(1)})))`).join(' + ')}, 0.0, 1.0);
}
float turfHeight(vec2 uv) {
  vec3 t = texture2D(map, uv).rgb;
  return t.r * ${TURF_LOOK.fineMm.toFixed(3)} + t.g * ${TURF_LOOK.clumpMm.toFixed(3)} + texture2D(map, uv * 4.7 + 0.31).r * ${TURF_LOOK.fineMm.toFixed(3)};
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
vec3 turfT = texture2D(map, vMapUv).rgb;
float turfFine = texture2D(map, vMapUv * 4.7 + 0.31).r;
// The lawn falls into shade toward the bank: the light is on the yard, under the lanterns and by the door.
diffuseColor.rgb *= ${glsl(TURF_LOOK.moss)} * mix(1.0, ${TURF_LOOK.rim.toFixed(2)}, smoothstep(${TURF_LOOK.rimFromMm.toFixed(1)}, ${TURF_LOOK.rimToMm.toFixed(1)}, length(vStageLocal.xz))) * (1.0 + ${TURF_LOOK.tone.toFixed(2)} * (0.5 * (turfT.g - 0.5) + 0.3 * (turfT.b - 0.5) + 0.45 * (turfFine - 0.5) + 0.25 * (turfT.r - 0.5)));
// The sand is a thin layer under the mound: the turf comes down over it, and its upper edge is soft.
float sandAmt = smoothstep(0.0, ${SAND.edgeSoft.toFixed(2)}, vSurf.y + ${SAND.edgeVary.toFixed(2)} * (turfT.g - 0.5));
float sandFineB = sandNoise(vStageLocal * ${SAND.clumpPerMm.toFixed(2)});
float sandFineC = sandNoise(vStageLocal * ${SAND.grainPerMm.toFixed(2)} + 7.3);
// A middle grain, half a millimetre wide: the one the hero lens resolves. It carries the sparkle of the lit grains.
float sandFineM = sandNoise(vStageLocal * ${SAND.midPerMm.toFixed(2)} + 4.1);
// A grain finer than the picture's pixel crawls as the lens drifts: it fades out before it gets there.
float sandPx = length(fwidth(vStageLocal));
sandFineC = mix(0.5, sandFineC, 1.0 - smoothstep(${SAND.fadeFrom.toFixed(2)}, ${SAND.fadeTo.toFixed(2)}, sandPx * ${SAND.grainPerMm.toFixed(2)}));
sandFineM = mix(0.5, sandFineM, 1.0 - smoothstep(${SAND.fadeFrom.toFixed(2)}, ${SAND.fadeTo.toFixed(2)}, sandPx * ${SAND.midPerMm.toFixed(2)}));
// Single grains sparkle, where the lens resolves a grain.
float sandSpark = smoothstep(0.66, 0.8, sandFineC * (0.45 + 0.9 * sandFineB));
float sandHeap = sandNoise(vStageLocal * ${SAND.heapPerMm.toFixed(2)} + 3.1);
// The bed has relief: heaps, clumps and grains, in millimetres, which the low sun shades.
float sandRelief = ${SAND.reliefMm.toFixed(2)} * sandHeap + ${SAND.reliefClump.toFixed(2)} * sandFineB + ${SAND.reliefMid.toFixed(2)} * sandFineM;
float sandGrain = 0.4 * turfT.g + 0.35 * sandFineB + 0.3 * sandFineC + 0.75 * sandFineM;
diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, ${glsl(SAND.white)}, ${SAND.whiten.toFixed(2)}) * (${SAND.heapLow.toFixed(2)} + ${SAND.heap.toFixed(2)} * sandHeap) * (${SAND.grainLow.toFixed(2)} + ${SAND.grain.toFixed(2)} * sandGrain + ${SAND.spark.toFixed(2)} * sandSpark + ${SAND.sparkMid.toFixed(2)} * smoothstep(0.6, 0.78, sandFineM)), sandAmt);
`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float turfH = turfHeight(vMapUv);
  vec2 turfDh = vec2(turfHeight(vMapUv + dFdx(vMapUv)) - turfH, turfHeight(vMapUv + dFdy(vMapUv)) - turfH);
  normal = villageBump(-vViewPosition, normal, turfDh * (${tileMm().toFixed(2)} * mix(1.0, ${SAND.bump.toFixed(2)}, sandAmt)) + sandAmt * vec2(dFdx(sandRelief), dFdy(sandRelief)), faceDirection);
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * uGlowGain * material.diffuseContribution;\n${poolLight(`mix(material.diffuseContribution, ${glsl(POOL.straw)}, ${POOL.strawShare.toFixed(2)} * (1.0 - sandAmt))`)}\n{\n  float sandBank = sandAmt;\n  vec3 sandBody = stageKeyC * (RECIPROCAL_PI * ${SAND.body.toFixed(2)} * mix(${SAND.floor.toFixed(2)}, 1.0, stageWrap(dot(geometryNormal, stageKeyL), ${SAND.wrap.toFixed(2)})) * mix(vec3(1.0), ${glsl(SAND.foot)}, smoothstep(${SAND.footFrom.toFixed(2)}, ${SAND.footTo.toFixed(2)}, vSurf.y))) * material.diffuseContribution;\n  // The low sun whitens the lip of the sand where it meets the ground and leaves the face against the glass in warm shade, deepest at the left end.\n  float sandLip = (1.0 - smoothstep(${SAND.lipFrom.toFixed(2)}, ${SAND.lipTo.toFixed(2)}, vSurf.y + 0.1 * (sandNoise(vStageLocal * 0.3 + 2.3) - 0.5)));\n  // The shelf is not one white band: heaps catch the sun, the hollows between them stay in shade.\n  float sandBreak = smoothstep(0.25, 0.75, 0.6 * sandNoise(vStageLocal * ${SAND.breakPerMm.toFixed(2)} + 9.7) + 0.4 * sandFineB);\n  sandBody *= mix(${glsl(SAND.shade)} * mix(${SAND.shadeLow.toFixed(2)}, 1.0, sandBreak), ${glsl(SAND.lipTint)} * (1.0 + mix(${SAND.lipLow.toFixed(2)}, ${SAND.lip.toFixed(2)}, sandBreak) + ${SAND.glint.toFixed(2)} * sandSpark), sandLip) * (1.0 + ${SAND.left.toFixed(2)} * (1.0 - smoothstep(${SAND.leftFromMm.toFixed(1)}, ${SAND.leftToMm.toFixed(1)}, vStageLocal.x))) * mix(vec3(1.0), ${glsl(SAND.right)}, smoothstep(${SAND.rightFromMm.toFixed(1)}, ${SAND.rightToMm.toFixed(1)}, vStageLocal.x)) * mix(${SAND.mottleLow.toFixed(2)}, ${SAND.mottle.toFixed(2)}, 0.5 * sandFineB + 0.5 * sandFineM);\n  reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, sandBody, sandBank);\n}\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${TURF_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${TURF_LOOK.wrap.toFixed(2)}) + ${SLOPE.ground.toFixed(2)} * smoothstep(0.0, 0.25, -vSurf.y))) * material.diffuseContribution;\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${TURF_LOOK.sun.toFixed(2)} * turfSunAt(vStageLocal.xz) * (1.0 - sandAmt) * (1.0 - ${GRASS_LOOK.rightDark.toFixed(2)} * smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x))) * mix(material.diffuseContribution, vec3(0.2, 0.19, 0.08), 0.3);\n{\n  float turfTurn = 1.0 - max(dot(geometryNormal, geometryViewDir), 0.0);\n  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${RIM.turf.toFixed(2)} * turfTurn * turfTurn * turfTurn * smoothstep(-0.2, 0.5, dot(geometryNormal, stageKeyL)) * (1.0 - sandAmt)) * mix(material.diffuseContribution, ${glsl(POOL.straw)}, ${POOL.strawShare.toFixed(2)});\n}\ntotalEmissiveRadiance += ${glsl(LIFT)};`)
    },
  })
}

function grassMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(TURF),
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
    extra: { shadowSide: THREE.BackSide },
    change: 'miniature',
    key: 'village-grass-summer',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uPoolSince: since })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}\n${POOL_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}\n${POOL_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${BUMP_GLSL}\n${POOL_FRAG_PARS}`)
        .replace('#include <map_fragment>', `diffuseColor.rgb *= ${glsl(GRASS_LOOK.moss)} * mix(1.0, ${TURF_LOOK.rim.toFixed(2)}, smoothstep(${TURF_LOOK.rimFromMm.toFixed(1)}, ${TURF_LOOK.rimToMm.toFixed(1)}, length(vStageLocal.xz))) * (0.85 + 0.3 * texture2D(map, vMapUv * 3.0).g) * mix(${glsl(GRASS_LOOK.shade)}, vec3(1.0), vSurf.y);`)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
        // The glass's outline cuts a blade last. A pixel that is cut stops being worked out, and the lighting of the pixel beside
        // it reads its numbers (the slope of the shadow's place): cut at the head, the grass at the outline was lit from numbers
        // nobody set.
        .replace('if (stageOutside()) discard;', 'bool grassOutside = stageOutside();')
        .replace(/\}\s*$/, '#ifdef STAGE_INSIDE\nif (grassOutside) discard;\n#endif\n}')
      afterLight(
        shader,
        `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * ${GRASS_LOOK.near.toFixed(2)}) * material.diffuseContribution;
${poolLight(`mix(material.diffuseContribution, ${glsl(POOL.straw)}, ${POOL.strawShare.toFixed(2)})`)}
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${GRASS_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${GRASS_LOOK.wrap.toFixed(2)}) + ${SLOPE.blade.toFixed(2)} * smoothstep(${SLOPE.fromMm.toFixed(1)}, ${SLOPE.toMm.toFixed(1)}, length(vStageLocal)) * (0.35 + 0.65 * vSurf.y) + ${GRASS_LOOK.through.toFixed(2)} * vSurf.x * pow(clamp(dot(normalize(vViewPosition), -stageKeyL), 0.0, 1.0), 2.0))) * material.diffuseContribution;
// The low sun does not lie evenly on the lawn: it catches tufts and leaves the moss between them in shade.
float grassPatch = 0.5 + 0.5 * sin(vStageLocal.x * ${GRASS_LOOK.patchPerMm.toFixed(2)} + 1.7 * sin(vStageLocal.z * ${(GRASS_LOOK.patchPerMm * 0.87).toFixed(3)} + 0.6)) * sin(vStageLocal.z * ${(GRASS_LOOK.patchPerMm * 1.16).toFixed(3)} + 1.3 * sin(vStageLocal.x * ${(GRASS_LOOK.patchPerMm * 0.71).toFixed(3)}) + 2.1);
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${GRASS_LOOK.sun.toFixed(2)} * mix(${GRASS_LOOK.patchLow.toFixed(2)}, 1.0, smoothstep(0.35, 0.8, grassPatch)) * vSurf.y * vSurf.y * mix(${GRASS_LOOK.sunRoot.toFixed(2)}, 1.0, vSurf.x)) * mix(material.diffuseContribution, vec3(0.22, 0.2, 0.06), 0.4);
// The key does not reach the lawn right of the lamp post: it lies in the crown's shade and is the dark moss of the rest.
reflectedLight.directDiffuse *= 1.0 - ${GRASS_LOOK.rightDark.toFixed(2)} * smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x);
reflectedLight.indirectDiffuse *= 1.0 - ${GRASS_LOOK.rightGlow.toFixed(2)} * smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x);
// The tips stand against the low sun behind them and let it through, in the shade of the crown as on the open lawn.
// Under the lanterns right of the lamp the tall blades are lit already: there only the last of a tip sparks.
float tipH = vSurf.x * vSurf.x;
tipH *= tipH;
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * mix(${RIM.tip.toFixed(2)} * tipH, ${RIM.tipFar.toFixed(2)} * tipH * tipH, smoothstep(${GRASS_LOOK.rightFromMm.toFixed(1)}, ${GRASS_LOOK.rightToMm.toFixed(1)}, vStageLocal.x)) * mix(${RIM.tipLow.toFixed(2)}, 1.0, smoothstep(0.3, 0.75, grassPatch))) * mix(material.diffuseContribution, ${glsl(RIM.tipTint)}, ${RIM.tipShare.toFixed(2)});
totalEmissiveRadiance += ${glsl(LIFT)};`,
      )
    },
  })
}

function waterMaterial(): THREE.MeshStandardMaterial {
  const level = moundAt(pond.z) - pond.level
  const sources = [{ at: mirrored, strength: MIRROR.flame }, { at: anchors.window, strength: 0 }, ...lanterns.map((l) => ({ at: [l.at[0], level + (l.at[1] - level) * WATER.squash, l.at[2]] as [number, number, number], strength: MIRROR.paper * l.radius }))]
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(TURF),
    roughness: WATER.rough,
    metalness: 0,
    change: 'miniature',
    key: 'village-water-summer',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain }, mirrorUniforms(sources))
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
${MIRROR_GLSL}
vec3 waterFlat = vec3(0.0, 0.0, 1.0);
float waterShade = 0.0;
float waterBank = 0.0;
float waterHeight(vec2 uv) {
  return texture2D(map, uv * 0.6).b * ${WATER.ripple.toFixed(4)} + texture2D(map, uv * vec2(1.3, 3.1) + 0.37).g * ${WATER.fine.toFixed(4)};
}
float waterPond(vec2 p) {
  vec2 d = p - vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)});
  vec2 l = vec2(${Math.cos(pond.yaw).toFixed(5)} * d.x - ${Math.sin(pond.yaw).toFixed(5)} * d.y, ${Math.sin(pond.yaw).toFixed(5)} * d.x + ${Math.cos(pond.yaw).toFixed(5)} * d.y);
  float a = dot(l, l) > 0.0 ? atan(l.y, l.x) : 0.0;
  float wobble = 1.0 + 0.045 * sin(3.0 * a + 1.3) + 0.03 * sin(5.0 * a + 0.4) + 0.018 * sin(9.0 * a + 2.1);
  vec2 q = abs(l / vec2(${pond.rx.toFixed(2)}, ${pond.rz.toFixed(2)}));
  return pow(abs(q.x * q.x * q.x + q.y * q.y * q.y), 1.0 / 3.0) / wobble;
}
// How much of the bank the mirrored sight line meets: the line is walked across the water to the shore, and what stands on
// the shore (moss, stones, grass) is as tall there as the turf map says.
float waterShoreline(vec3 r) {
  vec2 dir = r.xz / max(length(r.xz), 1e-4);
  float rise = r.y / max(length(r.xz), 1e-4);
  float last = waterPond(vStageLocal.xz);
  float t = 0.0;
  float hit = 60.0;
  for (int i = 0; i < 14; i++) {
    float tn = t + 2.6;
    float f = waterPond(vStageLocal.xz + dir * tn);
    if (f > 0.97) { hit = mix(t, tn, clamp((0.97 - last) / max(f - last, 1e-4), 0.0, 1.0)); break; }
    last = f;
    t = tn;
  }
  vec2 at = vStageLocal.xz + dir * hit;
  float tall = ${WATER.bankMm.toFixed(2)} + ${WATER.bankVary.toFixed(2)} * texture2D(map, at * 0.021 + 0.3).g + 0.7 * texture2D(map, at * 0.083).r;
  return 1.0 - smoothstep(tall - ${WATER.bankEdge.toFixed(2)}, tall + ${WATER.bankEdge.toFixed(2)}, hit * rise);
}
float waterPost(vec3 r, vec3 foot, float radius, float tall) {
  vec2 to = foot.xz - vStageLocal.xz;
  float along = dot(to, r.xz) / max(dot(r.xz, r.xz), 1e-5);
  float miss = length(vStageLocal.xz + r.xz * along - foot.xz);
  float up = vStageLocal.y + r.y * along - foot.y;
  return step(0.0, along) * (1.0 - smoothstep(radius * 0.8, radius * 1.2, miss)) * (1.0 - smoothstep(tall * 0.85, tall, up));
}
vec3 waterLights(vec3 r) {
  vec3 sum = vec3(0.0);
  vec2 dir = r.xz / max(length(r.xz), 1e-4);
  float rise = r.y / max(length(r.xz), 1e-4);
  for (int i = 0; i < ${MIRROR_MAX}; i++) {
    if (i >= uMirrorCount) break;
    vec2 to = uMirror[i].xz - vStageLocal.xz;
    float along = dot(to, dir);
    float side = length(to - dir * along) / ${WATER.paperMm.toFixed(2)};
    float tall = uMirror[i].y - vStageLocal.y;
    float off = (along * rise - tall) / (${WATER.paperTall.toFixed(2)} * tall + 0.25);
    sum += (i == 0 ? ${glsl(tones.lampLight)} : ${glsl(tones.paperLight)}) * (${WATER.paperGlint.toFixed(2)} * step(0.0, along) * exp(-side * side - off * off)) * uMirror[i].w;
  }
  return sum;
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
float waterShore = smoothstep(${WATER.shoreFrom.toFixed(2)}, ${WATER.shoreTo.toFixed(2)}, vSurf.x + 0.09 * (texture2D(map, vMapUv * 0.8).g - 0.5) + 0.05 * (texture2D(map, vMapUv * 2.7).g - 0.5));
// At its rim the water is a thin film over damp sand and stones, not a black line.
diffuseColor.rgb = mix(${glsl(tones.waterDeep)}, vec3(0.08, 0.085, 0.05), waterShore * waterShore);
`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(${WATER.rough.toFixed(3)}, 0.22, waterShore * waterShore);`)
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float waterH = waterHeight(vMapUv);
  vec2 waterDh = vec2(waterHeight(vMapUv + dFdx(vMapUv)) - waterH, waterHeight(vMapUv + dFdy(vMapUv)) - waterH);
  waterFlat = normal;
  normal = villageBump(-vViewPosition, normal, waterDh * ${tileMm().toFixed(2)}, faceDirection);
}
`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
{
  vec3 waterN = villageInside(normal);
  vec3 waterSight = villageSight();
  float waterFresnel = 0.03 + 0.97 * pow(abs(1.0 - clamp(dot(waterN, waterSight), 0.0, 1.0)), 5.0);
  vec3 waterR = reflect(-waterSight, waterN);
  // The pond is drawn as the low view of a pond: what it mirrors is looked up along a flatter line than the lens gives, so
  // that the bank, the foot of the tree and the lamp post lie in it and the open evening sky fills the rest.
  vec2 waterAway = normalize(vStageLocal.xz - (uGlobeInv * vec4(cameraPosition, 1.0)).xz);
  vec3 waterLow = normalize(vec3(waterAway.x, ${WATER.flat.toFixed(2)}, waterAway.y) + ${WATER.wobble.toFixed(2)} * vec3(waterN.x, 0.0, waterN.z));
  vec3 waterGlint = waterLights(waterLow);
  waterShade = max(${WATER.post.toFixed(2)} * waterPost(waterLow, ${glsl(postFoot)}, ${WATER.postMm.toFixed(2)}, ${WATER.postTall.toFixed(1)}), ${WATER.trunk.toFixed(2)} * waterPost(waterLow, ${glsl(trunkFoot)}, ${WATER.trunkMm.toFixed(2)}, ${WATER.trunkTall.toFixed(1)}));
  waterShade = max(waterShade, ${WATER.mass.toFixed(2)} * waterPost(waterLow, ${glsl(houseFoot)}, ${WATER.houseMm.toFixed(2)}, ${WATER.houseTall.toFixed(1)}));
  waterBank = ${WATER.bankDark.toFixed(2)} * waterShoreline(waterLow);
  waterShade = max(waterShade, waterBank);
  float waterSky = smoothstep(${WATER.skyFrom.toFixed(2)}, ${WATER.skyTo.toFixed(2)}, waterR.x * 0.75 - waterR.z * 0.5 + 0.2);
  // Held low: one glint alone on the pond, clipped to white, reads as a fault and not as a ripple.
  float waterSpark = min(pow(abs(texture2D(map, vMapUv * 2.3 + 0.41).r * texture2D(map, vMapUv * 5.9 + 0.13).r * 2.2), 5.0), 0.35);
  totalEmissiveRadiance += waterGlint * (uGlowGain * ${WATER.glint.toFixed(2)}) * (1.0 - 0.6 * waterShore) * (1.0 - 0.5 * waterBank) + ${glsl(tones.waterSky)} * (${WATER.sky.toFixed(2)} * waterSky * (0.55 + 0.45 * waterFresnel) * (0.86 + 0.14 * texture2D(map, vMapUv * vec2(0.9, 2.2)).b + ${WATER.spark.toFixed(2)} * waterSpark)) * (1.0 - waterShade) * (1.0 - 0.75 * waterShore) * (${WATER.skyLow.toFixed(2)} + ${(1 - WATER.skyLow).toFixed(2)} * exp(-pow(abs((vStageLocal.x + 14.0 * waterN.x - ${(pond.x + WATER.skyAt).toFixed(2)}) / ${WATER.skyWide.toFixed(2)}), 2.0)));
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * 0.12) * material.diffuseContribution;\nreflectedLight.indirectSpecular *= ${WATER.env.toFixed(2)} * (1.0 - waterShade);\nreflectedLight.directDiffuse *= 1.0 - ${WATER.body.toFixed(2)} * waterShade;\nreflectedLight.indirectDiffuse *= 1.0 - ${WATER.body.toFixed(2)} * waterShade;`)
    },
  })
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

// The planar mirror of the slab (src/scene/passes.ts) draws the whole stage a second time, turned over (the world's scale is
// -1 in height then). Single blades of grass cannot be told apart in that picture, the turf under them can: the grass gives
// the mirror none of its triangles. The ground casts no shadow either: nothing lies under it, and its own slopes are shaded
// by the light that leaves them.
// `keep` is how much of the mesh the mirror still gets, counted from its start: the cottage keeps its walls and loses the
// roses, leaves and blooms that stand on them.
const unmirrored = <T extends THREE.Mesh>(m: T, keep = 0): T => {
  m.onBeforeRender = () => {
    if (m.matrixWorld.determinant() < 0) m.geometry.setDrawRange(0, keep)
  }
  m.onAfterRender = () => {
    m.geometry.setDrawRange(0, Infinity)
  }
  return m
}

// Summer's tones on the shared cottage: the roof as dark slate, the chimney as weathered grey stone, the last sun on the tops
// of the fence. Only the colours of this season's own copy of the mesh change; the shapes are the shared ones.
// One stone lighter, the next darker: a value noise counted in millimetres, so the masonry is not one even tone.
function stoneVary(x: number, y: number, z: number, mm = ROOF.varyMm, tall = 1.6, amount = ROOF.vary): number {
  const h = (i: number, j: number, k: number): number => {
    const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453
    return v - Math.floor(v)
  }
  const s = 1 / mm
  const [px, py, pz] = [x * s, y * s * tall, z * s]
  const [ix, iy, iz] = [Math.floor(px), Math.floor(py), Math.floor(pz)]
  const f = (t: number): number => t * t * (3 - 2 * t)
  const [fx, fy, fz] = [f(px - ix), f(py - iy), f(pz - iz)]
  const at = (dy: number, dz: number): number => h(ix, iy + dy, iz + dz) * (1 - fx) + h(ix + 1, iy + dy, iz + dz) * fx
  const n = (at(0, 0) * (1 - fy) + at(1, 0) * fy) * (1 - fz) + (at(0, 1) * (1 - fy) + at(1, 1) * fy) * fz
  return 1 + amount * (n - 0.5)
}

function inStack(x: number, z: number): boolean {
  const dx = x - house.x
  const dz = z - house.z
  const across = frame.v[0] * dx + frame.v[1] * dz
  const along = frame.u[0] * dx + frame.u[1] * dz
  return Math.abs(across - house.chimney.across) < house.chimney.half + STACK.marginMm && Math.abs(along - house.chimney.along) < house.chimney.halfAlong + STACK.marginMm
}
const stackLow = (y: number): number => (y - frame.floor > STACK.fromMm ? frame.floor + STACK.fromMm + (y - frame.floor - STACK.fromMm) * STACK.squash : y)

function dressed(g: THREE.BufferGeometry, sharedCount: number): THREE.BufferGeometry {
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal')
  const C = g.getAttribute('color')
  const only = (role: string) => (r: string): boolean => r === role
  const roof = only('roof')
  const chimney = only('chimney')
  const fence = only('fence')
  const cottage = only('cottage')
  // The low sun from the back right draws the ridge and the right verge: how near a point of the roof lies to that edge.
  const rim = new Float32Array(P.count)
  const cobble = new Float32Array(P.count)
  const flatten = (i: number): void => {
    const along = frame.u[0] * (P.getX(i) - house.x) + frame.u[1] * (P.getZ(i) - house.z)
    const across = frame.v[0] * (P.getX(i) - house.x) + frame.v[1] * (P.getZ(i) - house.z)
    const gable = Math.abs(along) / house.halfLength >= Math.abs(across) / house.halfWidth
    const axis = gable ? frame.u : frame.v
    const out = (gable ? along : across) < 0 ? -COBBLE.flat : COBBLE.flat
    const x = (1 - COBBLE.flat) * N.getX(i) + out * axis[0]
    const y = (1 - COBBLE.flat) * N.getY(i)
    const z = (1 - COBBLE.flat) * N.getZ(i) + out * axis[1]
    const l = Math.hypot(x, y, z) || 1
    N.setXYZ(i, x / l, y / l, z / l)
  }
  const ridgeY = frame.floor + house.wall + house.rise + RIM.topMm
  // The top of a rail or a post is seen edge on and holds no light: the sides take it at their upper edge, where they meet it.
  const placed = (i: number): string => `${Math.round(P.getX(i) * 20)},${Math.round(P.getY(i) * 20)},${Math.round(P.getZ(i) * 20)}`
  const tops = new Set<string>()
  for (let i = 0; i < sharedCount; i++) if (N.getY(i) > 0.5 && solidDistance(P.getX(i), P.getY(i), P.getZ(i), fence) < ROOF.reachMm) tops.add(placed(i))
  for (let i = 0; i < sharedCount; i++) {
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    // The approved fence is posts and two rails. The pale boards between them are laid flat under the turf.
    if (solidDistance(x, y, z, fence) < ROOF.picketMm && Math.min(C.getX(i), C.getY(i), C.getZ(i)) > 0.45 * Math.max(C.getX(i), C.getY(i), C.getZ(i))) P.setY(i, groundAt(x, z) - ROOF.buryMm)
    const stack = inStack(x, z) && y - frame.floor > STACK.fromMm
    if (stack) {
      P.setY(i, stackLow(y))
      const l = Math.hypot(N.getX(i), N.getY(i) / STACK.squash, N.getZ(i)) || 1
      N.setXYZ(i, N.getX(i) / l, N.getY(i) / STACK.squash / l, N.getZ(i) / l)
    }
    const lum = Math.max(0.3 * C.getX(i) + 0.6 * C.getY(i) + 0.1 * C.getZ(i), stack ? STACK.pot : 0)
    // The roof's solid fills the gable too: only what faces up is slate, the wall under the verge stays stone.
    const nearRoof = solidDistance(x, y, z, roof) < ROOF.reachMm
    // The gable's own face under the verge boards is wall, not board: it lies in the wall's plane, inside the eaves, and does not face down.
    const gableWall = nearRoof && N.getY(i) > -0.5 && Math.abs(frame.u[0] * (x - house.x) + frame.u[1] * (z - house.z)) < house.halfLength + ROOF.gableMm && Math.abs(frame.v[0] * (x - house.x) + frame.v[1] * (z - house.z)) < house.halfWidth + 0.3
    if (tops.has(placed(i)) && solidDistance(x, y, z, fence) < ROOF.reachMm) rim[i] = RIM.rail
    if (nearRoof && !stack && solidDistance(x, y, z, chimney) >= ROOF.reachMm) {
      const across = frame.v[0] * (x - house.x) + frame.v[1] * (z - house.z)
      const eave = Math.min(1, Math.max(0, (-across - house.halfWidth - RIM.eaveFromMm) / (RIM.eaveToMm - RIM.eaveFromMm)))
      const t = Math.min(1, Math.max(0, (ridgeY - Math.max(across, 0) * (house.rise / house.halfWidth) - y - RIM.edgeFromMm) / (RIM.edgeToMm - RIM.edgeFromMm)))
      rim[i] = Math.max(1 - t * t * (3 - 2 * t), RIM.eave * eave * eave * (3 - 2 * eave))
    }
    if (stack || solidDistance(x, y, z, chimney) < ROOF.reachMm) {
      const v = 2 * stoneVary(x, y, z)
      C.setXYZ(i, lum * ROOF.chimney[0] * v, lum * ROOF.chimney[1] * v, lum * ROOF.chimney[2] * v)
      cobble[i] = 1
    }
    else if (nearRoof && N.getY(i) > ROOF.pitch) {
      // A soft sheen along the ridge, where the slate turns up to the sky.
      const v = 2.9 * (1 + ROOF.sheen * Math.min(1, Math.max(0, (y - frame.floor - (house.wall + house.rise - ROOF.sheenMm)) / ROOF.sheenMm)))
      C.setXYZ(i, lum * ROOF.slate[0] * v, lum * ROOF.slate[1] * v, lum * ROOF.slate[2] * v)
    }
    else if (Math.hypot(x - anchors.door[0], z - anchors.door[2]) < ROOF.doorMm && C.getX(i) > 1.2 * C.getZ(i) && Math.abs(y - anchors.door[1]) < ROOF.doorMm * 1.6) C.setXYZ(i, lum * ROOF.door[0], lum * ROOF.door[1], lum * ROOF.door[2])
    else if (Math.hypot(x - anchors.door[0], z - anchors.door[2]) < ROOF.plankMm && Math.abs(y - anchors.door[1]) < ROOF.plankTall) C.setXYZ(i, lum * ROOF.plank[0], lum * ROOF.plank[1], lum * ROOF.plank[2])
    else if (nearRoof && !gableWall && C.getX(i) > 1.25 * C.getZ(i)) C.setXYZ(i, C.getX(i) * ROOF.verge[0], C.getY(i) * ROOF.verge[1], C.getZ(i) * ROOF.verge[2])
    else if ((nearRoof || solidDistance(x, y, z, cottage) < ROOF.stoneMm) && Math.abs(C.getX(i) - C.getZ(i)) < ROOF.stoneHue * lum) {
      const v = stoneVary(x, y, z)
      C.setXYZ(i, (C.getX(i) + (ROOF.stoneMid - lum) * ROOF.stoneFlat) * ROOF.stone[0] * v, (C.getY(i) + (ROOF.stoneMid - lum) * ROOF.stoneFlat) * ROOF.stone[1] * v, (C.getZ(i) + (ROOF.stoneMid - lum) * ROOF.stoneFlat) * ROOF.stone[2] * v)
      cobble[i] = 1
      flatten(i)
    }
    // The warm blocks left on the walls are painted in courses and read as logs: they take the stone's cream and one level, and the cobbles drawn on them give the light and dark.
    else if ((gableWall || solidDistance(x, y, z, cottage) < ROOF.stoneMm) && Math.hypot(x - anchors.window[0], y - anchors.window[1], z - anchors.window[2]) > ROOF.paneMm) {
      const level = lum + (ROOF.blockMid - lum) * ROOF.stoneFlat
      C.setXYZ(i, level * ROOF.block[0], level * ROOF.block[1], level * ROOF.block[2])
      cobble[i] = 1
      flatten(i)
    }
    else if (solidDistance(x, y, z, fence) < ROOF.picketMm && Math.min(C.getX(i), C.getY(i), C.getZ(i)) > 0.45 * Math.max(C.getX(i), C.getY(i), C.getZ(i)) && lum > ROOF.pale) {
      // Each board has its own tone and a grain that runs up it; the foot of the fence stands in the shade of the grass.
      const v = stoneVary(x, y, z, ROOF.boardMm, 0.12, ROOF.boardVary) * stoneVary(x, y, z, ROOF.grainMm, 0.2, ROOF.grainVary) * (ROOF.boardFoot + (1 - ROOF.boardFoot) * Math.min(1, Math.max(0, (y - groundAt(x, z)) / ROOF.boardTall)))
      C.setXYZ(i, lum * ROOF.picket[0] * v, lum * ROOF.picket[1] * v, lum * ROOF.picket[2] * v)
    }
    else if (solidDistance(x, y, z, fence) < ROOF.reachMm) {
      const v = stoneVary(x, y, z, ROOF.grainMm, 0.2, ROOF.grainVary) * (N.getY(i) > 0.6 ? ROOF.railTop : 1)
      C.setXYZ(i, C.getX(i) * ROOF.rail[0] * v, C.getY(i) * ROOF.rail[1] * v, C.getZ(i) * ROOF.rail[2] * v)
    }
  }
  g.setAttribute('aRim', new THREE.BufferAttribute(rim, 1))
  g.setAttribute('aCobble', new THREE.BufferAttribute(cobble, 1))
  C.needsUpdate = true
  P.needsUpdate = true
  N.needsUpdate = true
  return g
}

// The shared material of the walls knows no rim and no lit liquid: both are laid on after its own light.
function rimmed(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const before = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    before.call(m, shader, renderer)
    Object.assign(shader.uniforms, { uPoolSince: since })
    shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${POOL_VERT_PARS}\n${PATCH_VERT_PARS}\nattribute float aRim;\nvarying float vRim;\nattribute float aCobble;\nvarying float vCobble;`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${POOL_VERT_MAIN}\n${PATCH_VERT_MAIN}\nvRim = aRim;\nvCobble = aCobble;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${POOL_FRAG_PARS}\n${PATCH_VERT_PARS}\nvarying float vRim;\n${COBBLE_PARS}`)
    if (!shader.fragmentShader.includes(COBBLE_AT)) throw new Error('village-summer: the surface map of the walls has moved')
    shader.fragmentShader = shader.fragmentShader.replace(COBBLE_AT, `${COBBLE_AT}\n${cobbleMap()}`)
    if (!shader.fragmentShader.includes(BUMP_AT)) throw new Error('village-summer: the bump of the walls has moved')
    shader.fragmentShader = shader.fragmentShader.replace(BUMP_AT, `${BUMP_AT}\n  normal = mix(normal, nonPerturbedNormal, ${COBBLE.smooth.toFixed(2)} * vCobble);\n  normal /= max(length(normal), 1e-4);`)
    afterLight(
      shader,
      `${poolLight(`(material.diffuseContribution * (1.0 - ${(1 - POOL.leaf).toFixed(2)} * villageLeaf))`)}
${patchLight(`(material.diffuseContribution * (1.0 - ${(1 - POOL.leaf).toFixed(2)} * villageLeaf))`)}
{
  float rimTurn = 1.0 - max(dot(geometryNormal, geometryViewDir), 0.0);
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${RIM.wall.toFixed(2)} * pow(abs(rimTurn), 4.0) * smoothstep(0.1, 0.6, dot(geometryNormal, stageKeyL)))) * mix(material.diffuseContribution, ${glsl(RIM.tint)}, ${RIM.share.toFixed(2)});
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${RIM.edge.toFixed(2)} * vRim * vRim) * ${glsl(RIM.edgeTint)};
  // A leaf, a petal lets the sun behind it through.
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${RIM.leaf.toFixed(2)} * villageLeaf * max(dot(-geometryNormal, stageKeyL), 0.0) * mix(1.0, ${RIM.petal.toFixed(2)}, smoothstep(0.0, 0.08, material.diffuseContribution.r - material.diffuseContribution.g))) * material.diffuseContribution;
}
totalEmissiveRadiance += ${glsl(LIFT)};`,
    )
  }
  return m
}

export function build(): THREE.Object3D {
  const shared = villageGeometry('solid')
  const solids = withPools(withSurface(dressed(mergeGeometries([shared, geometry(MODEL, 'decor')]), shared.getAttribute('position').count), nearWall), lawnPools)
  const walls = unmirrored(shadowed(new THREE.Mesh(solids, rimmed(surfaceMaterial({ part: PART, map: villageGrain(), gain, key: 'village-solid-summer', fill: WALL_FILL })))), shared.index ? shared.index.count : shared.getAttribute('position').count)
  const ground = shadowed(new THREE.Mesh(withPools(withSurface(geometry(MODEL, 'ground'), near), lawnPools), turfMaterial()), false)
  const grass = unmirrored(shadowed(new THREE.Mesh(withPools(withSurface(geometry(MODEL, 'grass'), near), lawnPools), grassMaterial()), false))
  const water = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'water'), near), waterMaterial()), false)
  return new THREE.Group().add(walls, ground, grass, water)
}

export function lights(): THREE.Object3D {
  const pieces = [
    glowPiece(villageGeometry('lamp-glass'), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1]),
  ]
  const unlit = [glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2])]
  const look = { bulb: 0.75, bulbCore: 1.7, glass: LAMP_GLASS, flame: tones.flame.map((v) => v * 4) as unknown as Rgb, room: tones.room.map((v) => v * 1.25) as unknown as Rgb, curtain: tones.curtain.map((v) => v * 0.45) as unknown as Rgb, frost: tones.haze.map((v) => v * 0.4) as unknown as Rgb, frostAmount: 0, flicker: 0.08, cycles: 3, through: THROUGH, paneHot: 0.4 }
  const lit = (x: number, z: number): [number, number, number] => [x, groundAt(x, z) + 1.5, z]
  const pools = [lit(flame[0] + 0.4, flame[2] + 1.6), lit(anchors.door[0] * 0.75 + flame[0] * 0.25, anchors.door[2] * 0.75 + flame[2] * 0.25)]
  const halos = new THREE.Mesh(haloGeometry([flame, anchors.window, ...pools], HALO.radiusMm, [HALO_KIND.lamp, HALO_KIND.pane, ...pools.map(() => HALO_KIND.pool)], HALO.wide), haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, HALO, clock, storm))
  halos.renderOrder = 3
  const dark = { ...look, room: tones.room.map((v) => v * DARK_PANE) as unknown as Rgb, curtain: tones.curtain.map((v) => v * DARK_PANE) as unknown as Rgb, paneHot: 0, through: 0 }
  return new THREE.Group().add(new THREE.Mesh(glowGeometry(pieces), glowMaterial(LIGHT, look, clock)), new THREE.Mesh(glowGeometry(unlit), glowMaterial(LIGHT, dark, clock)), halos)
}

const keep = (role: string): boolean => !isTree(role) && role !== 'ground' && role !== 'pond' && role !== 'chimney'
const stackOnly = (role: string): boolean => role === 'chimney'
const stackTop = frame.floor + STACK.fromMm + (house.chimney.top - STACK.fromMm) * STACK.squash
const STEMS = { radiusMm: 0.45, headMm: 1.1 }
let stems: number[] | null = null

function stemDistance(x: number, y: number, z: number): number {
  if (!stems) stems = ((geometry(MODEL, 'decor').userData.extras as { sunflowers?: number[] } | undefined)?.sunflowers ?? []).slice()
  let d = Infinity
  for (let i = 0; i < stems.length; i += 4) {
    const dx = x - stems[i]!
    const dz = z - stems[i + 2]!
    const h = stems[i + 3]!
    const dy = y - stems[i + 1]!
    const along = Math.min(h, Math.max(0, dy))
    const stem = Math.hypot(dx, dy - along, dz) - STEMS.radiusMm
    const head = Math.hypot(dx, dy - h, dz - 0.5) - STEMS.headMm
    d = Math.min(d, stem, head)
  }
  return d
}

function groundDistance(x: number, y: number, z: number): number {
  const slope = moundSlope(z)
  return (y - groundAt(x, z) - riseAt(x, z)) / Math.sqrt(1 + slope * slope)
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(solidDistance(x, y, z, keep), Math.max(solidDistance(x, y, z, stackOnly), y - stackTop), shrubDistance(x, y, z), groundDistance(x, y, z), stemDistance(x, y, z))
}

export function update(moment: KitMoment): void {
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  gain.value = gainOf(innerLights, moment.time, moment.period)
  since.value = Number.isFinite(moment.sinceLanding) ? Math.min(100, Math.max(0, moment.sinceLanding)) : 100
  const t = Number.isFinite(moment.sinceLanding) ? Math.min(1, Math.max(0, moment.sinceLanding / config.shake.settleCheckSeconds)) : 1
  storm.value = 1 - t * t * (3 - 2 * t)
}
