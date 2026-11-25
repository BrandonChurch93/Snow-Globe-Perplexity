import * as THREE from 'three'
import { config } from '../../../config'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial } from '../../../core/materials'
import { geometry, meshLevel, prepareModel } from '../../../core/models'
import { levels } from '../../../core/quality'
import { lampFlame } from '../../../miniature/roof'
import { bakeGlow, buildTrunk, crownOffset, glowHook, prepareTrunk, trunkShape, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import { emitters } from '../../../scene/layout'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { season, tones } from './palette'

const TOP = levels[0]!.id

const MODEL = 'spring/tree-blossom.glb'
const PART = `miniature-${season}`
const LAMP_ON_WOOD = { power: 5, reachMm: 13, wrap: -0.3 }
const LAMP_ON_BLOSSOM = { power: 5, reachMm: 13, wrap: 0.3 }
const BLOSSOM = { wrap: 0.85, fill: 1.1, through: 1.3, thin: 0.6, tight: 2.5, rough: 0.78 }
const TWIG = { wrap: 0.45, fill: 0.9 }
const BARK = { wrap: 0.4, fill: 1.1, normal: 2.6, rough: 0.9, ridgeMm: 0.22, ridge: 3.1, grainMm: 0.07, relief: 0.95 }
const WARM: [number, number, number] = [1, 0.6, 0.34]
const CLEAR_MM = 1
// While the storm turns, the crown is a pale glowing cloud in the approved mid-shake image and no dark branch shows in it.
const STORM = { blossom: [0.5, 0.39, 0.43] as const, pale: 0.4, wood: [0.5, 0.38, 0.38] as const, woodPale: 0.8 }
const storm = { value: 0 }

const offset = crownOffset()
const FORK_Y = offset[1] + trunkShape.fork
const v3 = (c: readonly [number, number, number]): string => `vec3(${c[0].toFixed(3)}, ${c[1].toFixed(3)}, ${c[2].toFixed(3)})`
const lamp = lampFlame()

export const innerLights: InnerLight[] = []

const lampOn = (look: { power: number; reachMm: number; wrap: number }): GlowLight[] => [{ at: lamp, color: WARM, phase: 0.1, ...look }]

function placed(name: string, lights: readonly GlowLight[]): THREE.BufferGeometry {
  const g = geometry(MODEL, name).clone()
  g.translate(offset[0], offset[1], offset[2])
  bakeGlow(g, lights)
  return g
}

function blossomMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    color: new THREE.Color(tones.blossom[0], tones.blossom[1], tones.blossom[2]),
    roughness: BLOSSOM.rough,
    metalness: 0,
    side: THREE.DoubleSide,
    change: 'miniature',
    key: 'tree-blossom-spring',
    hook: (shader) => {
      glowHook(shader)
      shader.uniforms.uTreeStorm = storm
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <normal_fragment_maps>', 'normal = normalize(vNormal);')
        .replace('#include <common>', '#include <common>\nuniform float uTreeStorm;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += ${v3(STORM.blossom)} * (uTreeStorm * (0.55 + 0.45 * dot(diffuseColor.rgb, vec3(0.3333))));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.93, 0.95), ${STORM.pale.toFixed(2)} * uTreeStorm);`)
      afterLight(
        shader,
        `
{
  vec3 blossomLit = stageWrapped(geometryNormal, ${BLOSSOM.wrap.toFixed(2)}) + stageKeyC * (RECIPROCAL_PI * ${BLOSSOM.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 1.0));
  blossomLit += stageThrough(geometryNormal, geometryViewDir, ${BLOSSOM.thin.toFixed(2)}, ${BLOSSOM.tight.toFixed(1)}) * ${BLOSSOM.through.toFixed(2)};
  reflectedLight.directDiffuse += blossomLit * material.diffuseContribution;
}`,
      )
    },
  })
}

function twigMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    change: 'miniature',
    key: 'tree-twigs-spring',
    hook: (shader) => {
      glowHook(shader)
      shader.uniforms.uTreeStorm = storm
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTreeStorm;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += ${v3(STORM.wood)} * uTreeStorm;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.86), ${STORM.woodPale.toFixed(2)} * uTreeStorm);`)
      afterLight(shader, `reflectedLight.directDiffuse += (stageWrapped(geometryNormal, ${TWIG.wrap.toFixed(2)}) + stageKeyC * (RECIPROCAL_PI * ${TWIG.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 1.0))) * material.diffuseContribution;`)
    },
  })
}

function barkMaterial(shared: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    change: 'miniature',
    map: shared.map ?? undefined,
    color: new THREE.Color(tones.bark[0], tones.bark[1], tones.bark[2]),
    vertexColors: true,
    roughness: BARK.rough,
    extra: { normalMap: shared.normalMap, normalScale: new THREE.Vector2(BARK.normal, BARK.normal) },
    key: 'trunk-spring',
    hook: (shader) => {
      glowHook(shader, undefined, BARK.relief)
      shader.uniforms.uTreeStorm = storm
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTreeStorm;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{\n  float barkUp = uTreeStorm * smoothstep(${(FORK_Y + 1).toFixed(2)}, ${(FORK_Y + 8).toFixed(2)}, vStageLocal.y);\n  totalEmissiveRadiance += ${v3(STORM.wood)} * barkUp;\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.86), ${STORM.woodPale.toFixed(2)} * barkUp);\n}`)
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
float barkHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1) * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float barkNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(barkHash(i), barkHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(barkHash(i + vec3(0.0, 1.0, 0.0)), barkHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(barkHash(i + vec3(0.0, 0.0, 1.0)), barkHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(barkHash(i + vec3(0.0, 1.0, 1.0)), barkHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float barkHeight(vec3 p) {
  vec3 q = vec3(p.x * ${BARK.ridge.toFixed(2)}, p.y * 0.42, p.z * ${BARK.ridge.toFixed(2)});
  float plate = barkNoise(q + 1.7 * barkNoise(q * 0.5 + 4.1));
  float ridge = 1.0 - abs(2.0 * plate - 1.0);
  return ${BARK.ridgeMm.toFixed(3)} * ridge * ridge + ${BARK.grainMm.toFixed(3)} * barkNoise(vec3(p.x * 9.0, p.y * 2.2, p.z * 9.0));
}
float barkH = 0.0;`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
barkH = barkHeight(vStageLocal);
diffuseColor.rgb *= 0.5 + 0.85 * smoothstep(0.02, ${(BARK.ridgeMm + BARK.grainMm).toFixed(3)}, barkH);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
{
  vec2 barkDh = vec2(barkHeight(vStageLocal + dFdx(vStageLocal)) - barkH, barkHeight(vStageLocal + dFdy(vStageLocal)) - barkH);
  vec3 barkSx = dFdx(-vViewPosition);
  vec3 barkSy = dFdy(-vViewPosition);
  vec3 barkR1 = cross(barkSy, normal);
  vec3 barkR2 = cross(normal, barkSx);
  float barkDet = dot(barkSx, barkR1);
  normal = normalize(abs(barkDet) * normal - sign(barkDet) * (barkDh.x * barkR1 + barkDh.y * barkR2));
}`,
        )
      afterLight(shader, `reflectedLight.directDiffuse += (stageWrapped(geometryNormal, ${BARK.wrap.toFixed(2)}) + stageKeyC * (RECIPROCAL_PI * ${BARK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 1.0))) * material.diffuseContribution;`)
    },
  })
}

export async function prepare(): Promise<void> {
  await Promise.all([prepareTrunk(), prepareModel(MODEL)])
}

export function build(): THREE.Object3D {
  const trunk = buildTrunk(PART, lampOn(LAMP_ON_WOOD), tones.bark)
  trunk.material = barkMaterial(trunk.material as THREE.MeshStandardMaterial)
  const blossom = new THREE.Mesh(placed('blossom', lampOn(LAMP_ON_BLOSSOM)), blossomMaterial())
  blossom.castShadow = true
  blossom.receiveShadow = true
  const inShadow = (geometry(MODEL, 'blossom').userData.extras as { shadow?: Record<string, number> } | undefined)?.shadow ?? {}
  blossom.onBeforeShadow = (_r, _o, _c, _s, g) => g.setDrawRange(0, inShadow[meshLevel()] ?? Infinity)
  blossom.onAfterShadow = (_r, _o, _c, _s, g) => g.setDrawRange(0, Infinity)
  const lighter = (): boolean => meshLevel() !== TOP
  blossom.onBeforeRender = (_r, _s, _c, g) => g.setDrawRange(0, lighter() && blossom.matrixWorld.determinant() < 0 ? (inShadow[meshLevel()] ?? Infinity) : Infinity)
  blossom.onAfterRender = (_r, _s, _c, g) => g.setDrawRange(0, Infinity)
  const twigs = new THREE.Mesh(placed('twigs', lampOn(LAMP_ON_WOOD)), twigMaterial())
  twigs.castShadow = true
  twigs.receiveShadow = true
  twigs.onBeforeShadow = (_r, _o, _c, _s, g) => g.setDrawRange(0, lighter() ? 0 : Infinity)
  twigs.onAfterShadow = (_r, _o, _c, _s, g) => g.setDrawRange(0, Infinity)
  twigs.onBeforeRender = (_r, _s, _c, g) => g.setDrawRange(0, lighter() && twigs.matrixWorld.determinant() < 0 ? 0 : Infinity)
  twigs.onAfterRender = (_r, _s, _c, g) => g.setDrawRange(0, Infinity)
  return new THREE.Group().add(trunk, blossom, twigs)
}

export function lights(): THREE.Object3D {
  return new THREE.Group()
}

let balls: Float32Array | null = null

function crownBalls(): Float32Array {
  if (balls) return balls
  const list = ((geometry(MODEL, 'blossom').userData.extras as { balls?: number[][] } | undefined)?.balls ?? []).map((b): [number, number, number, number] => [b[0]! + offset[0], b[1]! + offset[1], b[2]! + offset[2], b[3]!])
  const sources = emitters.petal ?? []
  const free = list.filter((b) => sources.every((e) => Math.hypot(e.x - b[0], e.y - b[1], e.z - b[2]) > e.r + b[3] + CLEAR_MM))
  balls = new Float32Array(free.flat())
  return balls
}

export function solid(x: number, y: number, z: number): number {
  let d = trunkSolid(x, y, z)
  const b = crownBalls()
  for (let i = 0; i < b.length; i += 4) {
    const v = Math.hypot(x - b[i]!, y - b[i + 1]!, z - b[i + 2]!) - b[i + 3]!
    if (v < d) d = v
  }
  return d
}

export const crownTop = (): Vec3 => [offset[0] + 1.2, offset[1] + 45, offset[2] + 1]

export function update(moment: KitMoment): void {
  const t = Number.isFinite(moment.sinceLanding) ? Math.min(1, Math.max(0, moment.sinceLanding / config.shake.settleCheckSeconds)) : 1
  storm.value = 1 - t * t * (3 - 2 * t)
}
