import * as THREE from 'three'
import { stageMaterial } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { haloGeometry, haloMaterial } from '../../../miniature/glow'
import { lampFlame } from '../../../miniature/roof'
import { bakeGlow, buildTrunk, chainSolid, glow, glowHook, limbs, placeGeometry, placePoint, prepareTrunk, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { season, tones } from './palette'
import { PUMPKINS, pumpkinFace } from './props'

type Shader = THREE.WebGLProgramParametersWithUniforms

const MODEL = 'fall/tree-fall.glb'
const BARK = 'shared/trunk-bark.srgb.tile.w1024.png'
const BARK_NORMAL = 'shared/trunk-bark-n.lin.tile.w1024.png'
const CYCLES = 5
const FLICKER = 0.2
const BARK_TINT: [number, number, number] = [0.06, 0.055, 0.052]
const TWIG_TINT: [number, number, number] = [0.05, 0.047, 0.045]
const BARK_RELIEF = 0.95
const EMBER_GAIN = 6.5
const EMBER_ON_WOOD = { power: 14, reachMm: 0.9 }
const LAMP_ON_WOOD = { power: 5.5, reachMm: 15, wrap: -0.3 }
const LAMP_SHIFT: Vec3 = [-3, 0, -5]
const PUMPKIN_ON_WOOD = { power: 16, reachMm: 6, wrap: 0.1 }
const POND_ON_WOOD = { power: 3, reachMm: 22, wrap: 0.2 }
const FILL_ON_WOOD = { power: 2.2, reachMm: 1000, wrap: 0.4 }
const FILL_FROM: Vec3 = [40, 20, 60]
const SKY: [number, number, number] = [0.62, 0.8, 0.85]
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
const GLINT = { shine: 80, ridge: [0.3, 0.8] as [number, number], rough: 0.86 }
const GLINT_LAMP = { lift: 3.6, power: 1.3, reachMm: 11 }
const GLINT_TONE: [number, number, number] = [1, 0.46, 0.14]
const GLINT_PUMPKIN = { power: 0.9, reachMm: 8 }
const GLINT_POND = { power: 0.05, reachMm: 24 }

const clock = { value: 0 }
const emberGain = { value: EMBER_GAIN }

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
    { at: [flame[0] + LAMP_SHIFT[0], flame[1] + LAMP_SHIFT[1], flame[2] + LAMP_SHIFT[2]], color: tones.lampLight, ...LAMP_ON_WOOD, phase: 0.1 },
    ...PUMPKINS.filter((p) => p.name === 'tree').map((p): GlowLight => ({ at: pumpkinFace(p, 0.4, 0.6), color: tones.pumpkinLight, ...PUMPKIN_ON_WOOD, phase: 0.68 })),
    { at: placePoint([4, 2, 26]), color: tones.pondLight, ...POND_ON_WOOD, phase: 0.8 },
    { at: placePoint(FILL_FROM), color: SKY, ...FILL_ON_WOOD, phase: 0.6 },
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
  glowHook(shader, undefined, BARK_RELIEF)
  const lit = glints()
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${lit.map((_, i) => `varying vec3 vGlint${i};`).join('\n')}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${lit.map((l, i) => `vGlint${i} = (modelViewMatrix * vec4(${vec3(l.at)}, 1.0)).xyz;`).join('\n')}`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${lit.map((_, i) => `varying vec3 vGlint${i};`).join('\n')}`)
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
}`,
    )
}

function lightHook(shader: Shader): void {
  Object.assign(shader.uniforms, { uTwinkle: glow.uTwinkle, uBulb: emberGain })
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

export function* making(): Generator<void, THREE.Object3D> {
  const part = `miniature-${season}`
  const lit = onWood()
  const g = placeGeometry(geometry(MODEL, 'twigs'))
  yield
  bakeGlow(g, lit)
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
    extra: { normalMap: texture(BARK_NORMAL), normalScale: new THREE.Vector2(1.4, 1.4) },
    hook: barkHook,
    key: 'twigs-fall',
  })
  const twigs = new THREE.Mesh(g, bark)
  twigs.castShadow = true
  twigs.receiveShadow = true
  yield
  return new THREE.Group().add(buildTrunk(part, lit, BARK_TINT), twigs)
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
  glow.uTwinkle.value.set((CYCLES * moment.time) / moment.period, FLICKER, 1, 0)
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
}
