import * as THREE from 'three'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { lampFlame } from '../../../miniature/roof'
import { bakeGlow, buildTrunk, crownOffset, glowHook, prepareTrunk, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import { emitters } from '../../../scene/layout'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { season, tones } from './palette'

const MODEL = 'spring/tree-blossom.glb'
const PART = `miniature-${season}`
const LAMP_ON_WOOD = { power: 90, reachMm: 13, wrap: -0.3 }
const LAMP_ON_BLOSSOM = { power: 5, reachMm: 13, wrap: 0.3 }
const BLOSSOM = { wrap: 0.85, fill: 1.1, through: 1.3, thin: 0.6, tight: 2.5, rough: 0.78 }
const TWIG = { wrap: 0.3, fill: 0.5 }
const WARM: [number, number, number] = [1, 0.6, 0.34]
const CLEAR_MM = 1

const offset = crownOffset()
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
    roughness: BLOSSOM.rough,
    metalness: 0,
    side: THREE.DoubleSide,
    change: 'miniature',
    key: 'tree-blossom-spring',
    hook: (shader) => {
      glowHook(shader)
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', 'normal = normalize(vNormal);')
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
      afterLight(shader, `reflectedLight.directDiffuse += (stageWrapped(geometryNormal, ${TWIG.wrap.toFixed(2)}) + stageKeyC * (RECIPROCAL_PI * ${TWIG.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 1.0))) * material.diffuseContribution;`)
    },
  })
}

export async function prepare(): Promise<void> {
  await Promise.all([prepareTrunk(), prepareModel(MODEL)])
}

export function build(): THREE.Object3D {
  const trunk = buildTrunk(PART, lampOn(LAMP_ON_WOOD), tones.bark)
  const blossom = new THREE.Mesh(placed('blossom', lampOn(LAMP_ON_BLOSSOM)), blossomMaterial())
  blossom.castShadow = true
  blossom.receiveShadow = true
  const twigs = new THREE.Mesh(placed('twigs', lampOn(LAMP_ON_WOOD)), twigMaterial())
  twigs.castShadow = true
  twigs.receiveShadow = true
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

export function update(_moment: KitMoment): void {}
