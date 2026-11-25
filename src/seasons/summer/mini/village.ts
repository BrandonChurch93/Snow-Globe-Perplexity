import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { config } from '../../../config'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial, type Rgb } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { GLOW, glowGeometry, glowMaterial, glowPiece, haloGeometry, haloMaterial } from '../../../miniature/glow'
import { MIRROR_GLSL, mirrorUniforms } from '../../../miniature/mirror'
import { prepareVillage, tileMm, villageGeometry, villageGrain } from '../../../miniature/model'
import { lampFlame, lampFoot, shrubDistance } from '../../../miniature/roof'
import { BUMP_GLSL, NEAR_LIGHT, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, withSurface, type GlowSource } from '../../../miniature/surface'
import { anchors, groundAt, moundSlope, solidDistance, tree } from '../../../scene/layout'
import { gainOf } from '../../../scene/lightgrid'
import type { InnerLight, KitMoment } from '../../kit'
import { lanterns } from './lanterns'
import { isTree, season, tones } from './palette'

const MODEL = 'summer/village-summer.glb'
const TURF = 'summer/village-turf.lin.tile.png'
const PART = `miniature-${season}`
const LIGHT = `light-${season}`

const LAMP = { power: 3, reachMm: 12, flicker: 0.05, cycles: 3, phase: 0.1 }
const WINDOW = { power: 0.9, reachMm: 8, flicker: 0.1, cycles: 5, phase: 0.4 }
const SIDE = { power: 0.8, reachMm: 7, flicker: 0.1, cycles: 4, phase: 0.75 }
const NEAR = { lamp: { power: 1.8, reachMm: 7 }, pane: { power: 0.9, reachMm: 3 }, paper: { power: 0.5, reachMm: 2.2 } }
const NEAR_WALL = { lamp: { power: 1.3, reachMm: 8, ends: 3 }, pane: { power: 1.2, reachMm: 4.5, ends: 3 }, paper: { power: 2.4, reachMm: 2.9, ends: 3 } }
const MIRROR = { lamp: 9, pane: 1.2, paper: 1.6, tight: 0.002, wide: 0.03, wideShare: 0.01, lowMm: 3.4 }
const HALO = { radiusMm: 0.75, strength: 1, hot: 2, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 1, glare: [1.6, 1.12, 0.66] as Rgb }
const HALO_KIND = { lamp: { size: 3.6, rest: 0.14, hot: 0, bloom: 0.2 }, pane: { size: 2.2, rest: 0, hot: 0, bloom: 0.2 }, pool: { size: 5, rest: 0, hot: 0, bloom: 0.06 } }
const THROUGH = 6
const LAMP_GLASS: Rgb = [4.2, 3.3, 2.0]
const WALL_FILL = 1.3
const SAND = { body: 5, floor: 0.8, wrap: 1.5, foot: 0.85, bump: 0.3, grainLow: 0.55, grain: 1.8 }
const TURF_LOOK = { tone: 0.5, fineMm: 0.05, clumpMm: 0.22, fill: 0.45, wrap: 0.5 }
const GRASS_LOOK = { fill: 0.3, wrap: 1.0, through: 0.6, near: 2.1 }
const WATER = { spark: 1.4, mass: 0.88, crownMm: 11, crownTall: 38, houseMm: 8.5, houseTall: 17, rough: 0.05, ripple: 0.006, shoreFrom: 0.9, shoreTo: 1.0, sky: 0.62, skyFrom: -0.7, skyTo: 0.5, post: 0.85, postMm: 0.55, postTall: 11.5, trunk: 0.55, trunkMm: 3, trunkTall: 26, body: 0.4 }

const flame = lampFlame()
const mirrored: [number, number, number] = [flame[0], flame[1] - MIRROR.lowMm, flame[2]]
const postFoot = lampFoot() as Rgb
const trunkFoot: Rgb = [tree.x, groundAt(tree.x, tree.z), tree.z]
const houseFoot: Rgb = [-9.6, groundAt(-9.6, -3), -3]
const paperOf = (tone: string): Rgb => (tone === 'cream' ? tones.creamLight : tones.paperLight)

export const innerLights: InnerLight[] = [
  { at: flame, color: tones.lampLight, ...LAMP },
  { at: anchors.window, color: tones.roomLight, ...WINDOW },
  { at: anchors.sideWindow, color: tones.roomLight, ...SIDE },
]

const near: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR.pane },
  { at: anchors.sideWindow, color: tones.roomLight, ...NEAR.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR.paper.power * l.radius, reachMm: NEAR.paper.reachMm * l.radius })),
]

const nearWall: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR_WALL.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR_WALL.pane },
  { at: anchors.sideWindow, color: tones.roomLight, ...NEAR_WALL.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR_WALL.paper.power * l.radius, reachMm: NEAR_WALL.paper.reachMm * l.radius, ends: NEAR_WALL.paper.ends })),
]

const gain = { value: 1 }
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
      Object.assign(shader.uniforms, { uGlowGain: gain })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
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
diffuseColor.rgb *= 1.0 + ${TURF_LOOK.tone.toFixed(2)} * (0.5 * (turfT.g - 0.5) + 0.3 * (turfT.b - 0.5) + 0.45 * (turfFine - 0.5) + 0.25 * (turfT.r - 0.5));
float sandGrain = texture2D(map, vMapUv * 3.3 + 0.17).r * texture2D(map, vMapUv * 7.1 + 0.53).r;
diffuseColor.rgb *= mix(1.0, ${SAND.grainLow.toFixed(2)} + ${SAND.grain.toFixed(2)} * sandGrain, smoothstep(0.0, 0.2, vSurf.y));
`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float turfH = turfHeight(vMapUv);
  vec2 turfDh = vec2(turfHeight(vMapUv + dFdx(vMapUv)) - turfH, turfHeight(vMapUv + dFdy(vMapUv)) - turfH);
  normal = villageBump(-vViewPosition, normal, turfDh * (${tileMm().toFixed(2)} * mix(1.0, ${SAND.bump.toFixed(2)}, smoothstep(0.0, 0.2, vSurf.y))), faceDirection);
}
`,
        )
      afterLight(shader, `${NEAR_LIGHT}\n{\n  float sandBank = smoothstep(0.0, 0.2, vSurf.y);\n  vec3 sandBody = stageKeyC * (RECIPROCAL_PI * ${SAND.body.toFixed(2)} * mix(${SAND.floor.toFixed(2)}, 1.0, stageWrap(dot(geometryNormal, stageKeyL), ${SAND.wrap.toFixed(2)})) * mix(1.0, ${SAND.foot.toFixed(2)}, vSurf.y)) * material.diffuseContribution;\n  reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, sandBody, sandBank);\n}\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${TURF_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${TURF_LOOK.wrap.toFixed(2)})) * material.diffuseContribution;`)
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
      Object.assign(shader.uniforms, { uGlowGain: gain })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${BUMP_GLSL}`)
        .replace('#include <map_fragment>', 'diffuseColor.rgb *= 0.85 + 0.3 * texture2D(map, vMapUv * 3.0).g;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
      afterLight(
        shader,
        `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * ${GRASS_LOOK.near.toFixed(2)}) * material.diffuseContribution;
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${GRASS_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${GRASS_LOOK.wrap.toFixed(2)}) + ${GRASS_LOOK.through.toFixed(2)} * vSurf.x * pow(clamp(dot(normalize(vViewPosition), -stageKeyL), 0.0, 1.0), 2.0))) * material.diffuseContribution;`,
      )
    },
  })
}

function waterMaterial(): THREE.MeshStandardMaterial {
  const sources = [{ at: mirrored, strength: MIRROR.lamp }, { at: anchors.window, strength: MIRROR.pane }, ...lanterns.map((l) => ({ at: l.at, strength: MIRROR.paper * l.radius }))]
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
float waterHeight(vec2 uv) {
  return texture2D(map, uv * 0.6).b * ${WATER.ripple.toFixed(4)};
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
float waterShore = smoothstep(${WATER.shoreFrom.toFixed(2)}, ${WATER.shoreTo.toFixed(2)}, vSurf.x + 0.03 * (texture2D(map, vMapUv * 0.8).g - 0.5));
diffuseColor.rgb = mix(${glsl(tones.waterDeep)}, ${glsl(tones.waterDeep)} * 2.4 + vec3(0.02, 0.022, 0.012), waterShore);
`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(${WATER.rough.toFixed(3)}, 0.3, waterShore);`)
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
  float waterFresnel = 0.03 + 0.97 * pow(1.0 - clamp(dot(waterN, waterSight), 0.0, 1.0), 5.0);
  vec3 waterR = reflect(-waterSight, waterN);
  float waterGlint = villageMirror(waterN, waterSight, ${MIRROR.tight.toFixed(5)}, ${MIRROR.wide.toFixed(5)}, ${MIRROR.wideShare.toFixed(3)});
  waterShade = max(${WATER.post.toFixed(2)} * villagePost(waterN, waterSight, ${glsl(postFoot)}, ${WATER.postMm.toFixed(2)}, ${WATER.postTall.toFixed(1)}), ${WATER.trunk.toFixed(2)} * villagePost(waterN, waterSight, ${glsl(trunkFoot)}, ${WATER.trunkMm.toFixed(2)}, ${WATER.trunkTall.toFixed(1)}));
  waterShade = max(waterShade, ${WATER.mass.toFixed(2)} * max(villagePost(waterN, waterSight, ${glsl(trunkFoot)}, ${WATER.crownMm.toFixed(2)}, ${WATER.crownTall.toFixed(1)}), villagePost(waterN, waterSight, ${glsl(houseFoot)}, ${WATER.houseMm.toFixed(2)}, ${WATER.houseTall.toFixed(1)})));
  float waterSky = smoothstep(${WATER.skyFrom.toFixed(2)}, ${WATER.skyTo.toFixed(2)}, waterR.x * 0.75 - waterR.z * 0.5 + 0.2);
  float waterSpark = pow(texture2D(map, vMapUv * 2.3 + 0.41).r * texture2D(map, vMapUv * 5.9 + 0.13).r * 2.2, 5.0);
  totalEmissiveRadiance += (${glsl(tones.lamp)} * waterGlint * uGlowGain * waterFresnel + ${glsl(tones.waterSky)} * (${WATER.sky.toFixed(2)} * waterSky * (0.25 + 0.75 * waterFresnel) * (0.55 + 0.45 * texture2D(map, vMapUv * vec2(0.7, 2.6)).b + ${WATER.spark.toFixed(2)} * waterSpark))) * (1.0 - waterShade) * (1.0 - 0.7 * waterShore);
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * 0.12) * material.diffuseContribution;\nreflectedLight.indirectSpecular *= 1.0 - waterShade;\nreflectedLight.directDiffuse *= 1.0 - ${WATER.body.toFixed(2)} * waterShade;\nreflectedLight.indirectDiffuse *= 1.0 - ${WATER.body.toFixed(2)} * waterShade;`)
    },
  })
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

export function build(): THREE.Object3D {
  const solids = withSurface(mergeGeometries([villageGeometry('solid'), geometry(MODEL, 'decor')]), nearWall)
  const walls = shadowed(new THREE.Mesh(solids, surfaceMaterial({ part: PART, map: villageGrain(), gain, key: 'village-solid-summer', fill: WALL_FILL })))
  const ground = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'ground'), near), turfMaterial()))
  const grass = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'grass'), near), grassMaterial()), false)
  const water = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'water'), near), waterMaterial()), false)
  return new THREE.Group().add(walls, ground, grass, water)
}

export function lights(): THREE.Object3D {
  const pieces = [
    glowPiece(villageGeometry('lamp-glass'), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1]),
    glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2]),
  ]
  const look = { bulb: 1.2, bulbCore: 2.2, glass: LAMP_GLASS, flame: tones.flame.map((v) => v * 6) as unknown as Rgb, room: tones.room.map((v) => v * 0.9) as unknown as Rgb, curtain: tones.curtain.map((v) => v * 1.5) as unknown as Rgb, frost: tones.haze.map((v) => v * 0.4) as unknown as Rgb, frostAmount: 0, flicker: 0.08, cycles: 3, through: THROUGH, paneHot: 0.14 }
  const lit = (x: number, z: number): [number, number, number] => [x, groundAt(x, z) + 1.5, z]
  const pools = [lit(flame[0] + 0.4, flame[2] + 1.6), lit(anchors.door[0] * 0.75 + flame[0] * 0.25, anchors.door[2] * 0.75 + flame[2] * 0.25)]
  const halos = new THREE.Mesh(haloGeometry([flame, anchors.window, anchors.sideWindow, ...pools], HALO.radiusMm, [HALO_KIND.lamp, HALO_KIND.pane, HALO_KIND.pane, ...pools.map(() => HALO_KIND.pool)], HALO.wide), haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, HALO, clock, storm))
  halos.renderOrder = 3
  return new THREE.Group().add(new THREE.Mesh(glowGeometry(pieces), glowMaterial(LIGHT, look, clock)), halos)
}

const keep = (role: string): boolean => !isTree(role) && role !== 'ground' && role !== 'pond'
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
  return (y - groundAt(x, z)) / Math.sqrt(1 + slope * slope)
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(solidDistance(x, y, z, keep), shrubDistance(x, y, z), groundDistance(x, y, z), stemDistance(x, y, z))
}

export function update(moment: KitMoment): void {
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  gain.value = gainOf(innerLights, moment.time, moment.period)
  const t = Number.isFinite(moment.sinceLanding) ? Math.min(1, Math.max(0, moment.sinceLanding / config.shake.settleCheckSeconds)) : 1
  storm.value = 1 - t * t * (3 - 2 * t)
}
