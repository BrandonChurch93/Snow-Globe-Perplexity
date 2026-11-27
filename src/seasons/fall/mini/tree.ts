import * as THREE from 'three'
import { stageMaterial } from '../../../core/materials'
import { LevelIndex, geometry, prepareModel, type LevelList } from '../../../core/models'
import { texture } from '../../../core/textures'
import { haloGeometry, haloMaterial } from '../../../miniature/glow'
import { lampFlame } from '../../../miniature/roof'
import { chainSolid, glowHook, glowing, limbs, placeGeometry, placePoint, placing, prepareTrunk, treeTwinkle, trunkAxis, trunkMaking, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { season, tones } from './palette'
import { PUMPKINS, pumpkinFace } from './props'

type Shader = THREE.WebGLProgramParametersWithUniforms

const MODEL = 'fall/tree-fall.glb'
const BARK = 'shared/trunk-bark.srgb.tile.w1024.png'
const BARK_NORMAL = 'shared/trunk-bark-n.lin.tile.w1024.png'
const CYCLES = 5
const FLICKER = 0.2
const BARK_TINT: [number, number, number] = [0.14, 0.125, 0.11]
const TWIG_TINT: [number, number, number] = [0.05, 0.047, 0.045]
const BARK_RELIEF = 1.7
const EMBER_GAIN = 6.5
const EMBER_ON_WOOD = { power: 14, reachMm: 0.9 }
const LAMP_ON_WOOD = { power: 210, reachMm: 12, wrap: 0.05 }
const LAMP_TONE: [number, number, number] = [1, 0.52, 0.3]
const LAMP_SHIFT: Vec3 = [-4, -10, -8]
const PUMPKIN_ON_WOOD = { power: 8, reachMm: 6, wrap: 0.1 }
const POND_ON_WOOD = { power: 2, reachMm: 22, wrap: 0.2 }
const FILL_ON_WOOD = { power: 36, reachMm: 9, wrap: 0.5 }
const EDGE_ON_WOOD = { power: 50, reachMm: 4, wrap: 0.3 }
const FILL_FROM: Vec3 = [7, 6, 10]
const EDGE_FROM: Vec3 = [5, 14, -3]
const SKY: [number, number, number] = [0.3, 1, 1.05]
const EDGE_TONE: [number, number, number] = [0.5, 0.9, 0.9]
const GROUP = { power: 0.06, reachMm: 5.5, along: 0.72 }
const HALO = { radiusMm: 0.4, strength: 1.0, hot: 3.2, pullMm: 0.6, flicker: FLICKER, cycles: CYCLES }
const POOL = { radiusMm: 1.0, strength: 0.04, hot: 0, pullMm: 0.9, flicker: FLICKER, cycles: CYCLES }
const POOL_EDGE: [number, number, number] = [0.7, 0.26, 0.04]
const POOL_CORE: [number, number, number] = [0.95, 0.5, 0.14]
const HALO_EDGE: [number, number, number] = [0.8, 0.3, 0.05]
const HALO_CORE: [number, number, number] = [1, 0.46, 0.13]
const FOG_DIM = { from: 0.5, to: 0.9, cap: 0.6 }
// Wet black bark: the lamp, the pumpkin at the foot and the green of the pond glance off the ridges as small sharp lights
// and leave the grooves black. `shine` is the lobe's exponent, `ridge` how far a groove (dark vertex colour) is kept out.
const GLINT = { shine: 120, ridge: [0.3, 0.8] as [number, number], rough: 0.86 }
const GLINT_LAMP = { lift: 3.6, power: 1.6, reachMm: 11 }
const GLINT_TONE: [number, number, number] = [1, 0.46, 0.14]
const GLINT_PUMPKIN = { power: 0.9, reachMm: 8 }
const GLINT_POND = { power: 0.05, reachMm: 24 }
// The approved bark is black and wet: on the side turned from the lamp the trunk's edge takes a soft grey green line from
// the air. It is read off the limb's own round, not the bark's relief, so it is one even edge and not a row of bright
// ridges. Below the first fork it fades out over `fade` (heights on the trunk), so the foot's far side is as dark as the body.
const RIM = { tone: [0.55, 0.66, 0.6] as [number, number, number], power: 0.5, sharp: 3, relief: 0.08, ridge: [0.9, 0.7] as [number, number], axis: [2, 12] as [number, number], far: [0, 0.6] as [number, number], at: [3, 7, 3] as Vec3, reachMm: 7, fade: [10, 13] as [number, number] }
// The approved limbs are wet and black with one thin pale line along the side turned up to the sky, over the whole crown.
// It is read off the tube's own round (alpha of the vertex colour is 1 on limbs and twigs, 0 on the trunk's sleeve), and
// takes the tone of the embers where they hang near.
const LINE = { tone: [0.48, 0.41, 0.39] as [number, number, number], power: 0.52, sharp: 3, side: [-0.1, 0.5] as [number, number], from: [-0.2, 1, 0.15] as Vec3, glow: 0.1 }
// The air round the crown is warm with embers: it lifts the darkest side of the limbs, the twigs and the stem above the
// first fork (`stem`, heights on the trunk) out of black, and leaves the trunk below as dark as it was.
const AIR = { tone: [0.76, 0.86, 0.9] as [number, number, number], power: 4.4, stem: [12.6, 21.6] as [number, number] }

const clock = { value: 0 }
const emberGain = { value: EMBER_GAIN }
const twinkle = treeTwinkle()

const list: InnerLight[] = limbs
  .filter((l) => l.kind === 'limb')
  .map((l, i): InnerLight => {
    const p = l.points[Math.min(l.points.length - 1, Math.round(GROUP.along * (l.points.length - 1)))]!
    return { at: [p[0], p[1] + 1.2, p[2]], color: tones.emberLight, power: GROUP.power, reachMm: GROUP.reachMm, flicker: FLICKER * 0.6, cycles: CYCLES, phase: (0.13 + i * 0.381) % 1 }
  })

export const innerLights = (): InnerLight[] => list

function embers(): { at: Vec3; phase: number }[] {
  const flat = (geometry(MODEL, 'lights').userData.extras as { bulbs: number[] }).bulbs
  const out: { at: Vec3; phase: number }[] = []
  for (let i = 0; i < flat.length; i += 4) out.push({ at: placePoint([flat[i]!, flat[i + 1]!, flat[i + 2]!]), phase: flat[i + 3]! })
  return out
}

function onWood(): GlowLight[] {
  const flame = lampFlame()
  return [
    ...embers().map((e): GlowLight => ({ at: e.at, color: tones.emberLight, ...EMBER_ON_WOOD, phase: e.phase })),
    { at: [flame[0] + LAMP_SHIFT[0], flame[1] + LAMP_SHIFT[1], flame[2] + LAMP_SHIFT[2]], color: LAMP_TONE, ...LAMP_ON_WOOD, phase: 0.1 },
    ...PUMPKINS.filter((p) => p.name === 'tree').map((p): GlowLight => ({ at: pumpkinFace(p, 0.4, 0.6), color: tones.pumpkinLight, ...PUMPKIN_ON_WOOD, phase: 0.68 })),
    { at: placePoint([4, 2, 26]), color: tones.pondLight, ...POND_ON_WOOD, phase: 0.8 },
    { at: placePoint(FILL_FROM), color: SKY, ...FILL_ON_WOOD, phase: 0.6 },
    { at: placePoint(EDGE_FROM), color: EDGE_TONE, ...EDGE_ON_WOOD, phase: 0.6 },
  ]
}

const vec3 = (p: readonly number[]): string => `vec3(${p[0]!.toFixed(3)}, ${p[1]!.toFixed(3)}, ${p[2]!.toFixed(3)})`

function glints(): { at: Vec3; color: readonly number[]; power: number; reachMm: number }[] {
  const flame = lampFlame()
  const pumpkin = PUMPKINS.find((p) => p.name === 'tree')!
  return [
    { at: [flame[0], flame[1] + GLINT_LAMP.lift, flame[2]], color: GLINT_TONE, power: GLINT_LAMP.power, reachMm: GLINT_LAMP.reachMm },
    { at: pumpkinFace(pumpkin, 0.4, 0.6), color: tones.pumpkinLight, power: GLINT_PUMPKIN.power, reachMm: GLINT_PUMPKIN.reachMm },
    { at: placePoint([4, 2, 26]), color: tones.pondLight, power: GLINT_POND.power, reachMm: GLINT_POND.reachMm },
  ]
}

function barkHook(shader: Shader): void {
  glowHook(shader, twinkle, undefined, BARK_RELIEF)
  const lit = glints()
  const [low, high] = RIM.axis.map((h): Vec3 => placePoint([trunkAxis(h)[0], h, trunkAxis(h)[1]])) as [Vec3, Vec3]
  const span = Math.hypot(high[0] - low[0], high[1] - low[1], high[2] - low[2])
  const along: Vec3 = [(high[0] - low[0]) / span, (high[1] - low[1]) / span, (high[2] - low[2]) / span]
  const lineLength = Math.hypot(LINE.from[0], LINE.from[1], LINE.from[2])
  const lineFrom: Vec3 = [LINE.from[0] / lineLength, LINE.from[1] / lineLength, LINE.from[2] / lineLength]
  const fade = RIM.fade.map((h) => ((h - RIM.axis[0]) / (RIM.axis[1] - RIM.axis[0])) * span) as [number, number]
  const airFrom = AIR.stem.map((h) => ((h - RIM.axis[0]) / (RIM.axis[1] - RIM.axis[0])) * span) as [number, number]
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vRim;\nvarying vec3 vRound;\nvarying float vRimUp;\n${lit.map((_, i) => `varying vec3 vGlint${i};`).join('\n')}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\nvRim = (modelViewMatrix * vec4(${vec3(placePoint(RIM.at))}, 1.0)).xyz;\nvec3 rimOut = transformed - ${vec3(low)};\nvRimUp = dot(rimOut, ${vec3(along)});\nvRound = normalMatrix * (rimOut - ${vec3(along)} * dot(rimOut, ${vec3(along)}));\n${lit.map((l, i) => `vGlint${i} = (modelViewMatrix * vec4(${vec3(l.at)}, 1.0)).xyz;`).join('\n')}`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vRim;\nvarying vec3 vRound;\nvarying float vRimUp;\n${lit.map((_, i) => `varying vec3 vGlint${i};`).join('\n')}`)
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
{
  vec3 glintV = normalize(vViewPosition);
  vec3 glintSum = vec3(0.0);
${lit
  .map(
    (l, i) => `  {
    vec3 to = vGlint${i} + vViewPosition;
    float d2 = dot(to, to);
    vec3 l = to * inversesqrt(max(d2, 1e-6));
    float s = pow(max(dot(normal, normalize(l + glintV)), 0.0), ${GLINT.shine.toFixed(1)}) * smoothstep(0.0, 0.25, dot(normal, l));
    glintSum += ${vec3(l.color)} * (${l.power.toFixed(3)} * s / (1.0 + d2 / ${(l.reachMm * l.reachMm).toFixed(2)}));
  }`,
  )
  .join('\n')}
  reflectedLight.directSpecular += glintSum * uTwinkle.z * smoothstep(${GLINT.ridge[0].toFixed(2)}, ${GLINT.ridge[1].toFixed(2)}, dot(vColor.rgb, vec3(0.3333)));
  vec3 rimTo = vGlint0 + vViewPosition;
  vec3 rimL = rimTo * inversesqrt(max(dot(rimTo, rimTo), 1e-6));
  vec3 rimN = mix(vRound * inversesqrt(max(dot(vRound, vRound), 1e-6)), normal, ${RIM.relief.toFixed(2)});
  rimN *= inversesqrt(max(dot(rimN, rimN), 1e-6));
  vec3 rimOff = vRim + vViewPosition;
  float rimNear = dot(rimOff, rimOff) / ${(RIM.reachMm * RIM.reachMm).toFixed(1)};
  float rimEdge = pow(clamp(1.0 - dot(rimN, glintV), 0.0, 1.0), ${RIM.sharp.toFixed(1)}) * smoothstep(${RIM.far[0].toFixed(2)}, ${RIM.far[1].toFixed(2)}, -dot(rimN, rimL)) * smoothstep(${fade[0].toFixed(3)}, ${fade[1].toFixed(3)}, vRimUp) * (1.0 - vColor.a);
  reflectedLight.directSpecular += ${vec3(RIM.tone)} * (${RIM.power.toFixed(3)} * rimEdge * uTwinkle.z * (${RIM.ridge[0].toFixed(2)} + ${RIM.ridge[1].toFixed(2)} * smoothstep(${GLINT.ridge[0].toFixed(2)}, ${GLINT.ridge[1].toFixed(2)}, dot(vColor.rgb, vec3(0.3333)))) / (1.0 + rimNear * rimNear));
  vec3 lineUp = (viewMatrix * vec4(${vec3(lineFrom)}, 0.0)).xyz;
  float lineEdge = pow(clamp(1.0 - dot(nonPerturbedNormal, glintV), 0.0, 1.0), ${LINE.sharp.toFixed(1)}) * smoothstep(${LINE.side[0].toFixed(2)}, ${LINE.side[1].toFixed(2)}, dot(nonPerturbedNormal, lineUp));
  reflectedLight.directSpecular += (${vec3(LINE.tone)} + ${LINE.glow.toFixed(3)} * vGlow.rgb) * (${LINE.power.toFixed(3)} * lineEdge * vColor.a * uTwinkle.z);
  reflectedLight.indirectDiffuse += ${vec3(AIR.tone)} * (${AIR.power.toFixed(3)} * max(vColor.a, smoothstep(${airFrom[0].toFixed(3)}, ${airFrom[1].toFixed(3)}, vRimUp)) * uTwinkle.z) * material.diffuseContribution;
}`,
    )
}

function lightHook(shader: Shader): void {
  Object.assign(shader.uniforms, { uTwinkle: twinkle, uBulb: emberGain })
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vBulb;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBulb = uv;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec4 uTwinkle;\nuniform float uBulb;\nvarying vec2 vBulb;')
    .replace('#include <color_fragment>', '#include <color_fragment>\nfloat treeLit = vColor.a;\nvec3 treeTint = diffuseColor.rgb;\ndiffuseColor.rgb *= 1.0 - 0.8 * treeLit;')
    .replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nfloat treeCore = 0.45 + 0.55 * pow(clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 1.5);\ntotalEmissiveRadiance = treeTint * treeLit * treeCore * uBulb * uTwinkle.z * (1.0 + uTwinkle.y * sin(6.2831853 * (uTwinkle.x + vBulb.x)) * (0.6 + 0.4 * sin(6.2831853 * (3.0 * uTwinkle.x + 5.0 * vBulb.x))));',
    )
    .replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>\n#ifdef STAGE_INSIDE\ngl_FragColor.rgb = mix(gl_FragColor.rgb, min(gl_FragColor.rgb, vec3(${FOG_DIM.cap.toFixed(2)})), smoothstep(${FOG_DIM.from.toFixed(2)}, ${FOG_DIM.to.toFixed(2)}, stageVeil(vStageAux.x)));\n#endif`,
    )
}

export async function prepare(): Promise<void> {
  await Promise.all([prepareTrunk(), prepareModel(MODEL)])
}

// Fall leaves the layout's short pad twigs undrawn and grows its own from the same fork places (assets-src/tree-fall).
// A pad twig is a piece of its own in the trunk's mesh: one limb of kind `twig` holds every vertex of it within `PAD_SLACK`
// of its tube. The lighter lists of the lower levels lose the same pieces.
const PAD_SLACK = 0.3

function withoutPadTwigs(g: THREE.BufferGeometry): void {
  const index = g.index
  if (!index) return
  const lists: Record<string, LevelList> = index instanceof LevelIndex ? index.lists : { all: { array: index.array as LevelList['array'], count: index.count } }
  const full = Object.values(lists).reduce((a, b) => (b.count > a.count ? b : a))
  const pos = g.getAttribute('position')
  const piece = new Int32Array(pos.count)
  for (let i = 0; i < piece.length; i++) piece[i] = i
  const of = (v: number): number => {
    let i = v
    while (piece[i] !== i) {
      piece[i] = piece[piece[i]!]!
      i = piece[i]!
    }
    return i
  }
  for (let i = 0; i < full.count; i += 3) {
    const a = of(full.array[i]!)
    piece[of(full.array[i + 1]!)] = a
    piece[of(full.array[i + 2]!)] = a
  }
  const pieces = new Map<number, { box: number[]; vertices: number[] }>()
  for (let i = 0; i < pos.count; i++) {
    const root = of(i)
    let p = pieces.get(root)
    if (!p) pieces.set(root, (p = { box: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], vertices: [] }))
    p.vertices.push(i)
    for (let k = 0; k < 3; k++) {
      const v = pos.getComponent(i, k)
      if (v < p.box[k]!) p.box[k] = v
      if (v > p.box[k + 3]!) p.box[k + 3] = v
    }
  }
  const twigs = limbs
    .filter((l) => l.kind === 'twig')
    .map((l) => {
      const reach = Math.max(...l.radii) + PAD_SLACK
      const box = [0, 1, 2].map((k) => Math.min(...l.points.map((q) => q[k]!)) - reach).concat([0, 1, 2].map((k) => Math.max(...l.points.map((q) => q[k]!)) + reach))
      return { points: l.points, radii: l.radii, box }
    })
  const onTube = (i: number, t: (typeof twigs)[number]): boolean => {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    for (let k = 0; k + 1 < t.points.length; k++) {
      const a = t.points[k]!
      const b = t.points[k + 1]!
      const ux = b[0] - a[0]
      const uy = b[1] - a[1]
      const uz = b[2] - a[2]
      const px = x - a[0]
      const py = y - a[1]
      const pz = z - a[2]
      const along = Math.min(1, Math.max(0, (px * ux + py * uy + pz * uz) / Math.max(ux * ux + uy * uy + uz * uz, 1e-12)))
      if (Math.hypot(px - ux * along, py - uy * along, pz - uz * along) <= Math.max(t.radii[k]!, t.radii[k + 1]!) + PAD_SLACK) return true
    }
    return false
  }
  const dropped = new Set<number>()
  for (const [root, p] of pieces) {
    const within = (t: (typeof twigs)[number]): boolean => [0, 1, 2].every((k) => p.box[k]! >= t.box[k]! && p.box[k + 3]! <= t.box[k + 3]!)
    if (twigs.some((t) => within(t) && p.vertices.every((i) => onTube(i, t)))) dropped.add(root)
  }
  if (dropped.size === 0) return
  const kept: Record<string, LevelList> = {}
  for (const [level, list] of Object.entries(lists)) {
    const array = list.array.slice(0, list.count)
    let count = 0
    for (let i = 0; i < list.count; i += 3) {
      if (dropped.has(of(list.array[i]!))) continue
      array[count++] = list.array[i]!
      array[count++] = list.array[i + 1]!
      array[count++] = list.array[i + 2]!
    }
    kept[level] = { array, count }
  }
  if (!(index instanceof LevelIndex)) {
    g.setIndex(new THREE.BufferAttribute(kept.all!.array.slice(0, kept.all!.count), 1))
    return
  }
  // Every list of a mesh has one length, so the GPU keeps one buffer for them all.
  const longest = Math.max(...Object.values(kept).map((l) => l.count))
  for (const list of Object.values(kept)) {
    const array = new (list.array.constructor as new (n: number) => LevelList['array'])(longest)
    array.set(list.array.subarray(0, list.count))
    list.array = array
  }
  g.setIndex(new LevelIndex(kept))
}

export function* making(): Generator<void, THREE.Object3D> {
  const part = `miniature-${season}`
  const lit = onWood()
  const g = yield* placing(geometry(MODEL, 'twigs'))
  yield* glowing(g, lit)
  yield
  const bark = stageMaterial({
    part,
    standIn: false,
    inside: true,
    miniature: true,
    change: 'miniature',
    map: texture(BARK),
    color: new THREE.Color(TWIG_TINT[0], TWIG_TINT[1], TWIG_TINT[2]),
    vertexColors: true,
    roughness: GLINT.rough,
    extra: { normalMap: texture(BARK_NORMAL), normalScale: new THREE.Vector2(2.4, 2.4) },
    hook: barkHook,
    key: 'twigs-fall',
  })
  const twigs = new THREE.Mesh(g, bark)
  twigs.castShadow = true
  twigs.receiveShadow = true
  yield
  const trunk = yield* trunkMaking(part, twinkle, lit, BARK_TINT)
  withoutPadTwigs(trunk.geometry)
  trunk.name = 'trunk'
  yield
  return new THREE.Group().add(trunk, twigs)
}

export function lights(): THREE.Object3D {
  const part = `light-${season}`
  const m = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'light', vertexColors: true, roughness: 0.4, metalness: 0.1, hook: lightHook, key: 'tree-embers-fall' })
  const mesh = new THREE.Mesh(placeGeometry(geometry(MODEL, 'lights')), m)
  mesh.castShadow = false
  mesh.receiveShadow = false
  const at = embers().map((e) => e.at)
  const part01 = (v: number): number => v - Math.floor(v)
  const pools = new THREE.Mesh(haloGeometry(at, POOL.radiusMm, at.map((_, i) => ({ size: 0.8 + 0.5 * part01(i * 0.7548 + 0.4), rest: 1, hot: 0, bloom: 1 }))), haloMaterial(part, POOL_EDGE, POOL_CORE, POOL, clock))
  pools.renderOrder = 3
  const halos = new THREE.Mesh(haloGeometry(at, HALO.radiusMm, at.map((_, i) => ({ size: 0.7 + 0.8 * part01(i * 0.618 + 0.17) ** 3, rest: 1, hot: 0.4 + 0.6 * part01(i * 0.7548 + 0.4), bloom: 1 }))), haloMaterial(part, HALO_EDGE, HALO_CORE, HALO, clock))
  halos.renderOrder = 3
  return new THREE.Group().add(mesh, pools, halos)
}

let boughs: ((x: number, y: number, z: number) => number) | undefined

function boughSolid(): (x: number, y: number, z: number) => number {
  if (boughs) return boughs
  const flat = (geometry(MODEL, 'twigs').userData.extras as { chains: number[] }).chains
  const chains: { points: Vec3[]; radii: number[] }[] = []
  for (let i = 0; i < flat.length; ) {
    const n = flat[i++]!
    const points: Vec3[] = []
    const radii: number[] = []
    for (let k = 0; k < n; k++, i += 4) {
      points.push(placePoint([flat[i]!, flat[i + 1]!, flat[i + 2]!]))
      radii.push(flat[i + 3]!)
    }
    chains.push({ points, radii })
  }
  boughs = chainSolid(chains)
  return boughs
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(trunkSolid(x, y, z), boughSolid()(x, y, z))
}

export function update(moment: KitMoment): void {
  twinkle.value.set((CYCLES * moment.time) / moment.period, FLICKER, 1, 0)
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
}
