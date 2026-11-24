import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { config } from '../../../config'
import { COVER_GLSL, coverUniforms } from '../../../core/chunks/cover'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial, type Rgb } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { GLOW, glowGeometry, glowMaterial, glowPiece } from '../../../miniature/glow'
import { MIRROR_GLSL, mirrorUniforms } from '../../../miniature/mirror'
import { prepareVillage, tileMm, villageGeometry, villageGrain } from '../../../miniature/model'
import { hangPoints, lampFlame, shrubDistance } from '../../../miniature/roof'
import { BUMP_GLSL, NEAR_LIGHT, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, withSurface, type Cover, type GlowSource } from '../../../miniature/surface'
import { wispGeometry, wispMaterial } from '../../../miniature/wisp'
import { anchors, cottage, cottagePoint, groundAt, moundSlope, pond, pondField, solidDistance } from '../../../scene/layout'
import { gainOf } from '../../../scene/lightgrid'
import type { InnerLight, KitMoment } from '../../kit'
import { isTree, season, tones } from './palette'

const MODEL = 'winter/village-winter.glb'
const SNOW = 'winter/village-snow.lin.tile.png'
const ICE = 'winter/village-ice.lin.tile.png'
const PART = `miniature-${season}`
const LIGHT = `light-${season}`
const ARRIVAL = `arrival-${season}`

const LAMP = { power: 1.2, reachMm: 12, flicker: 0.05, cycles: 3, phase: 0.1 }
const WINDOW = { power: 0.8, reachMm: 8, flicker: 0.1, cycles: 5, phase: 0.4 }
const SIDE = { power: 0.6, reachMm: 7, flicker: 0.1, cycles: 4, phase: 0.75 }
const BULB = { power: 0.18, reachMm: 4.5, flicker: 0.07, cycles: 2 }
const NEAR = { bulb: { power: 0.75, reachMm: 2 }, lamp: { power: 4, reachMm: 7 }, pane: { power: 0.9, reachMm: 2.4 } }
const MIRROR = { lamp: 7, pane: 1.2, bulb: 0.5, tight: 0.0016, wide: 0.028, wideShare: 0.04 }
const COVER_GAIN = 0.12
const FRESH_RISE_MM = 0.3
const SNOW_GRAIN_MM = 0.05
const SNOW_LUMP_MM = 0.16
const SPARK = 2.6
const SNOW_WRAP = 0.45

const bulbs = hangPoints()
const flame = lampFlame()
const potTop = cottagePoint(cottage.chimney.across - 0.2, cottage.chimney.top + 1.45, cottage.chimney.along + 0.1)

export const innerLights: InnerLight[] = [
  { at: flame, color: tones.lampLight, ...LAMP },
  { at: anchors.window, color: tones.roomLight, ...WINDOW },
  { at: anchors.sideWindow, color: tones.roomLight, ...SIDE },
  ...bulbs.map((at, i): InnerLight => ({ at, color: tones.bulbLight, power: BULB.power, reachMm: BULB.reachMm, flicker: BULB.flicker, cycles: BULB.cycles, phase: (i * 0.381966) % 1 })),
]

const near: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR.pane },
  { at: anchors.sideWindow, color: tones.roomLight, ...NEAR.pane },
  ...bulbs.map((at): GlowSource => ({ at, color: tones.bulbLight, ...NEAR.bulb })),
]

const gain = { value: 1 }
const clock = { value: 0 }
const rise = { value: 1 }

const glsl = (c: Rgb): string => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`

export async function prepare(): Promise<void> {
  await Promise.all([prepareVillage(), prepareModel(MODEL)])
}

const dusting: Cover = {
  uniforms: coverUniforms,
  pars: COVER_GLSL,
  apply: `
{
  float winterLain = clamp(stageCover(vStageLocal.xz) * 0.5, 0.0, 1.0);
  float winterUp = normalize(vObjN).y + 0.5 * (villageMottle - 0.5) + 0.3 * (villageGrain.r - 0.5);
  float winterDust = smoothstep(0.5 - 0.22 * winterLain, 0.93, winterUp) * (0.6 + 0.4 * winterLain);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${glsl(tones.dust)} * (0.86 + 0.2 * villageGrain.r), winterDust * 0.88);
  villageRough = mix(villageRough, 0.96, winterDust);
  villageMetal *= 1.0 - winterDust;
}
`,
}

function snowMaterial(part: string, change: string, key: string, lift: string): THREE.MeshStandardMaterial {
  const tile = (1 / tileMm()).toFixed(6)
  return stageMaterial({
    part,
    standIn: false,
    inside: true,
    miniature: part === PART,
    vertexColors: true,
    map: texture(SNOW),
    roughness: 0.94,
    metalness: 0,
    physical: true,
    extra: { sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(tones.sheen[0], tones.sheen[1], tones.sheen[2]) },
    change,
    key,
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uRise: rise }, coverUniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}\n${COVER_GLSL}\nuniform float uRise;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * (stageCover(position.xz) * aSurf.x * ${COVER_GAIN.toFixed(3)} * max(normal.y, 0.0)${lift});`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
vec3 snowWeights;
vec3 snowAt(vec3 p) {
  return texture2D(map, p.zy).rgb * snowWeights.x + texture2D(map, p.xz).rgb * snowWeights.y + texture2D(map, p.xy).rgb * snowWeights.z;
}
float snowHeight(vec3 t) {
  return t.r * ${SNOW_GRAIN_MM.toFixed(3)} + t.b * ${SNOW_LUMP_MM.toFixed(3)};
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
snowWeights = pow(abs(normalize(vObjN)), vec3(4.0));
snowWeights /= snowWeights.x + snowWeights.y + snowWeights.z;
vec3 snowP = vStageLocal * ${tile};
vec3 snowT = snowAt(snowP);
float snowWide = snowAt(snowP * 0.23 + 0.41).b;
diffuseColor.rgb *= ${glsl(tones.snow)} * (0.88 + 0.16 * snowT.r + 0.12 * (snowWide - 0.5));
`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float snowH = snowHeight(snowT);
  vec2 snowDh = vec2(snowHeight(snowAt(snowP + dFdx(snowP))) - snowH, snowHeight(snowAt(snowP + dFdy(snowP))) - snowH);
  normal = villageBump(-vViewPosition, normal, snowDh, faceDirection);
}
`,
        )
      afterLight(
        shader,
        `${NEAR_LIGHT}
{
  reflectedLight.directDiffuse += stageWrapped(geometryNormal, ${SNOW_WRAP.toFixed(2)}) * material.diffuseContribution;
  float snowTwinkle = fract(snowT.g * 61.7 + dot(normalize(vViewPosition), vec3(17.3, 31.7, 23.1)) + dot(normal, vec3(5.1, 3.3, 7.7)));
  float snowSpark = smoothstep(0.3, 0.9, snowT.g) * smoothstep(0.62, 1.0, snowTwinkle);
  reflectedLight.directSpecular += (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * snowSpark * ${SPARK.toFixed(2)};
}`,
      )
    },
  })
}

function iceMaterial(): THREE.MeshStandardMaterial {
  const sources = [{ at: flame, strength: MIRROR.lamp }, { at: anchors.window, strength: MIRROR.pane }, { at: anchors.sideWindow, strength: MIRROR.pane }, ...bulbs.map((at) => ({ at, strength: MIRROR.bulb }))]
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(ICE),
    roughness: 0.2,
    metalness: 0,
    change: 'miniature',
    key: 'village-ice',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain }, mirrorUniforms(sources))
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
${MIRROR_GLSL}
float iceHeight(vec2 uv) {
  vec3 t = texture2D(map, uv).rgb;
  return t.g * 0.05 + t.b * 0.035 - t.r * 0.05 + texture2D(map, uv * 3.1 + 0.17).g * 0.012;
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
vec3 iceT = texture2D(map, vMapUv).rgb;
vec3 iceWide = texture2D(map, vMapUv * 0.37 + 0.21).rgb;
float iceRim = smoothstep(0.42, 1.0, vSurf.x);
float iceFrost = clamp(iceRim * iceRim * 0.9 + smoothstep(0.42, 0.8, iceWide.g) * (0.35 + 0.4 * iceRim) + (iceT.g - 0.5) * 0.24, 0.0, 1.0);
iceFrost = max(iceFrost, iceT.r * 0.75);
diffuseColor.rgb = mix(${glsl(tones.iceDeep)}, ${glsl(tones.icePale)}, iceFrost * 0.9) + ${glsl(tones.icePale)} * iceT.b * 0.07;
float iceRough = mix(0.09, 0.72, iceFrost);
`,
        )
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = iceRough;')
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float iceH = iceHeight(vMapUv);
  vec2 iceDh = vec2(iceHeight(vMapUv + dFdx(vMapUv)) - iceH, iceHeight(vMapUv + dFdy(vMapUv)) - iceH);
  normal = villageBump(-vViewPosition, normal, iceDh, faceDirection);
}
`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
{
  vec3 iceN = villageInside(normal);
  vec3 iceSight = villageSight();
  float iceFresnel = 0.03 + 0.97 * pow(1.0 - clamp(dot(iceN, iceSight), 0.0, 1.0), 5.0);
  float iceGlint = villageMirror(iceN, iceSight, ${MIRROR.tight.toFixed(5)}, ${MIRROR.wide.toFixed(5)}, ${MIRROR.wideShare.toFixed(3)});
  totalEmissiveRadiance += ${glsl(tones.lamp)} * iceGlint * iceFresnel * (1.0 - 0.55 * iceFrost) * uGlowGain;
}
`,
        )
      afterLight(shader, NEAR_LIGHT)
    },
  })
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

export function build(): THREE.Object3D {
  const solids = withSurface(mergeGeometries([villageGeometry('solid'), geometry(MODEL, 'decor')]), near)
  const walls = shadowed(new THREE.Mesh(solids, surfaceMaterial({ part: PART, map: villageGrain(), gain, cover: dusting, key: 'village-solid-winter' })))
  const snow = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'snow'), near), snowMaterial(PART, 'miniature', 'village-snow', '')))
  const ice = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'ice'), near), iceMaterial()), false)
  const smoke = new THREE.Mesh(wispGeometry({ from: potTop, height: 15, lean: [1.6, 0.5], sway: 0.5, thin: 0.42, wide: 1.5, rings: 40, sides: 10 }), wispMaterial(PART, tones.smoke, 1.15, 2, clock))
  smoke.renderOrder = 2
  return new THREE.Group().add(walls, snow, ice, smoke)
}

export function lights(): THREE.Object3D {
  const pieces = [
    glowPiece(geometry(MODEL, 'bulbs'), (_i, index, phase) => [GLOW.bulb, phase, index, 0]),
    glowPiece(villageGeometry('lamp-glass'), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1]),
    glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2]),
  ]
  const look = { bulb: 0.9, bulbCore: 1.7, glass: tones.lamp.map((v) => v * 1.8) as unknown as Rgb, flame: tones.flame.map((v) => v * 4.5) as unknown as Rgb, room: tones.room.map((v) => v * 2.3) as unknown as Rgb, curtain: tones.curtain.map((v) => v * 1.5) as unknown as Rgb, frost: tones.rime.map((v) => v * 0.55) as unknown as Rgb, frostAmount: 0.8, flicker: 0.08, cycles: 3 }
  return new THREE.Mesh(glowGeometry(pieces), glowMaterial(LIGHT, look, clock))
}

export function arrival(): THREE.Object3D {
  return shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'fresh'), near), snowMaterial(ARRIVAL, 'arrival', 'village-fresh', ` + (uRise - 1.0) * ${FRESH_RISE_MM.toFixed(2)}`)), false)
}

const keep = (role: string): boolean => !isTree(role) && role !== 'ground' && role !== 'pond'
const SINK = { depthMm: 3.2, from: 0.74, to: 0.97 }

function groundDistance(x: number, y: number, z: number): number {
  const t = Math.min(1, Math.max(0, (pondField(x, z) - SINK.from) / (SINK.to - SINK.from)))
  const under = (SINK.depthMm - pond.dip) * (1 - t * t * (3 - 2 * t))
  const slope = moundSlope(z)
  return (y - (groundAt(x, z) - under)) / Math.sqrt(1 + slope * slope)
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(solidDistance(x, y, z, keep), shrubDistance(x, y, z), groundDistance(x, y, z))
}

export function update(moment: KitMoment): void {
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  gain.value = gainOf(innerLights, moment.time, moment.period)
  const t = Math.min(1, Math.max(0, moment.sinceLanding / config.shake.settleCheckSeconds))
  rise.value = t * t * (3 - 2 * t)
}
