import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { config } from '../../../config'
import { COVER_GLSL, coverUniforms } from '../../../core/chunks/cover'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial, type Rgb } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { GLOW, glowGeometry, glowMaterial, glowPiece, haloGeometry, haloMaterial } from '../../../miniature/glow'
import { MIRROR_GLSL, mirrorUniforms } from '../../../miniature/mirror'
import { prepareVillage, tileMm, villageGeometry, villageGrain } from '../../../miniature/model'
import { hangPoints, lampFlame, pitch, ridgeY, roofLength, shrubDistance, slopeLength } from '../../../miniature/roof'
import { BUMP_GLSL, NEAR_LIGHT, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, withSurface, type Cover, type GlowSource } from '../../../miniature/surface'
import { wispGeometry, wispMaterial, wispPose, type Wisp } from '../../../miniature/wisp'
import { anchors, bankAt, cottage, cottageFrame, cottagePoint, driftAt, groundAt, heapAt, moundSlope, pond, pondField, rimAt, solidDistance } from '../../../scene/layout'
import { gainOf } from '../../../scene/lightgrid'
import type { InnerLight, KitMoment } from '../../kit'
import { isTree, season, tones } from './palette'

const MODEL = 'winter/village-winter.glb'
const SNOW = 'winter/village-snow.lin.tile.png'
const ICE = 'winter/village-ice.lin.tile.png'
const PART = `miniature-${season}`
const LIGHT = `light-${season}`
const ARRIVAL = `arrival-${season}`

const LAMP = { power: 3, reachMm: 12, flicker: 0.05, cycles: 3, phase: 0.1 }
const WINDOW = { power: 0.8, reachMm: 8, flicker: 0.1, cycles: 5, phase: 0.4 }
const SIDE = { power: 0.8, reachMm: 7, flicker: 0.1, cycles: 4, phase: 0.75 }
const BULB = { power: 0.6, reachMm: 4.5, flicker: 0.07, cycles: 2 }
const NEAR = { bulb: { power: 0.6, reachMm: 1.2, ends: 3 }, lamp: { power: 4, reachMm: 7 }, pane: { power: 0.7, reachMm: 2.4 } }
const NEAR_WALL = { bulb: { power: 8.5, reachMm: 1.7, ends: 3 }, lamp: { power: 3.4, reachMm: 9, ends: 3 }, pane: { power: 1.7, reachMm: 5, ends: 3 } }
const MIRROR = { lamp: 9, pane: 1.2, bulb: 0.5, tight: 0.0011, wide: 0.03, wideShare: 0.004, bump: 0.8, lowMm: 3.4, sparkle: 1.7 }
const HALO = { radiusMm: 0.75, strength: 1, hot: 2, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 1, glare: [1.6, 1.12, 0.66] as Rgb }
const HALO_KIND = { bulb: { size: 1.2, rest: 1.5, hot: 1, bloom: 0.2 }, lamp: { size: 3.4, rest: 0.4, hot: 0, bloom: 0.3 }, pane: { size: 2.4, rest: 0, hot: 0, bloom: 0.3 }, pool: { size: 7, rest: 0, hot: 0, bloom: 0.17 } }
const THROUGH = 6
const LAMP_GLASS: Rgb = [7.5, 6.7, 5.2]
const COVER_GAIN = 0.12
const FRESH_RISE_MM = 0.3
const SNOW_GRAIN_MM = 0.05
const SNOW_LUMP_MM = 0.3
const SNOW_DRIFT_MM = 1.1
const SPARK = 2.6
const SNOW_WRAP = 0.4
const BANK_RELIEF = 0.7
const BANK_TIP = 0.8
const BANK_WRAP = 1.3
const BANK_BODY = 3.6
const BANK_GRAIN = 2.5
const BANK_HOLLOW = 0.45
const BANK_FOOT = 0.33
const BANK_CREST = 0.5
const BANK_AIR = 0.6
const ICE_NEAR = 0.15
const POOL: Rgb = [1, 0.5, 0.22]
const POOL_TINT = { blue: 0.78, from: 0.4, to: 0.62, underMm: -16, fadeMm: 3 }
const ICE_RIM = 0.9
const SNOW_FILL = 1.6
const WALL_FILL = 2.4
const BANK_SIDES = { front: 0.72, side: 1.25 }

const bulbs = hangPoints()
const flame = lampFlame()
const mirrored: [number, number, number] = [flame[0], flame[1] - MIRROR.lowMm, flame[2]]
const potTop = cottagePoint(cottage.chimney.across - 0.2, cottage.chimney.top + 1.45, cottage.chimney.along + 0.1)

export const innerLights: InnerLight[] = [
  { at: flame, color: tones.lampLight, ...LAMP },
  { at: anchors.window, color: tones.roomLight, ...WINDOW },
  { at: anchors.sideWindow, color: tones.roomLight, ...SIDE },
  ...bulbs.map((at, i): InnerLight => ({ at, color: tones.bulbLight, power: BULB.power, reachMm: BULB.reachMm, flicker: BULB.flicker, cycles: BULB.cycles, phase: (i * 0.381966) % 1 })),
]

const near: GlowSource[] = [
  { at: flame, color: POOL, ...NEAR.lamp },
  { at: anchors.window, color: POOL, ...NEAR.pane },
  { at: anchors.sideWindow, color: POOL, ...NEAR.pane },
  ...bulbs.map((at): GlowSource => ({ at, color: tones.bulbLight, ...NEAR.bulb })),
]

const nearWall: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR_WALL.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR_WALL.pane },
  { at: anchors.sideWindow, color: tones.roomLight, ...NEAR_WALL.pane },
  ...bulbs.map((at): GlowSource => ({ at, color: tones.bulbLight, ...NEAR_WALL.bulb })),
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
  float winterDust = smoothstep(0.86 - 0.36 * winterLain, 0.98, winterUp) * (0.3 + 0.7 * winterLain);
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
        .replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}\n${COVER_GLSL}\nuniform float uRise;\nvarying vec3 vPuff;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}\nvPuff = normalize(normalMatrix * vec3(0.0, 1.0, 0.0)) * aSurf.y;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * (stageCover(position.xz) * aSurf.x * ${COVER_GAIN.toFixed(3)} * max(normal.y, 0.0)${lift});`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
varying vec3 vPuff;
vec3 snowWeights;
float bankMask = 0.0;
float bankDeep = 0.0;
float bankSpan = 0.0;
vec3 bankN = vec3(0.0, 0.0, 1.0);
vec3 snowAt(vec3 p) {
  return texture2D(map, p.zy).rgb * snowWeights.x + texture2D(map, p.xz).rgb * snowWeights.y + texture2D(map, p.xy).rgb * snowWeights.z;
}
float snowHeight(vec3 p) {
  vec3 t = snowAt(p);
  return (t.r * ${SNOW_GRAIN_MM.toFixed(3)} + t.b * ${SNOW_LUMP_MM.toFixed(3)}) * (1.0 + ${BANK_GRAIN.toFixed(2)} * bankMask) + snowAt(p * 0.23 + 0.41).b * ${SNOW_DRIFT_MM.toFixed(3)} * (1.0 + ${BANK_RELIEF.toFixed(2)} * bankMask);
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
bankSpan = length(vPuff);
bankMask = smoothstep(0.0, 0.3, bankSpan);
bankDeep = clamp((bankSpan - 0.3) / 0.7, 0.0, 1.0);
snowWeights = pow(abs(normalize(vObjN)), vec3(4.0));
snowWeights /= snowWeights.x + snowWeights.y + snowWeights.z;
vec3 snowP = vStageLocal * ${tile};
vec3 snowT = snowAt(snowP);
float snowWide = snowAt(snowP * 0.23 + 0.41).b;
diffuseColor.rgb *= ${glsl(tones.snow)} * (0.92 + 0.16 * snowT.r + 0.12 * (snowWide - 0.5));
`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float snowH = snowHeight(snowP);
  vec2 snowDh = vec2(snowHeight(snowP + dFdx(snowP)) - snowH, snowHeight(snowP + dFdy(snowP)) - snowH);
  normal = villageBump(-vViewPosition, normal, snowDh, faceDirection);
  bankN = normal;
  normal = normalize(normal + vPuff * (${BANK_TIP.toFixed(2)} * bankMask / max(bankSpan, 1e-4)));
}
`,
        )
      afterLight(
        shader,
        `${NEAR_LIGHT}
{
  reflectedLight.directDiffuse += (stageWrapped(geometryNormal, ${SNOW_WRAP.toFixed(2)}) + stageKeyC * (RECIPROCAL_PI * ${SNOW_FILL.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 1.0))) * material.diffuseContribution;
  if (bankMask > 0.0) {
    float bankTop = smoothstep(-0.95, -0.15, dot(bankN, vPuff) / max(bankSpan, 1e-4));
    bankTop = mix(bankTop, 1.0, 0.85 * (1.0 - smoothstep(0.0, ${BANK_CREST.toFixed(2)}, bankDeep)));
    float bankSide = stageWrap(dot(geometryNormal, stageKeyL), ${BANK_WRAP.toFixed(2)});
    float bankFall = mix(1.0, ${BANK_FOOT.toFixed(2)}, smoothstep(0.0, 1.0, bankDeep));
    float bankAside = mix(${BANK_SIDES.front.toFixed(2)}, ${BANK_SIDES.side.toFixed(2)}, smoothstep(0.15, 0.75, abs(vStageLocal.x) / max(length(vStageLocal.xz), 1e-3)));
    vec3 bankBody = stageKeyC * (RECIPROCAL_PI * ${BANK_BODY.toFixed(2)} * bankSide * bankAside * mix(${BANK_HOLLOW.toFixed(2)}, 1.0, bankTop) * bankFall) * material.diffuseContribution;
    reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, bankBody, bankMask);
    reflectedLight.indirectDiffuse *= mix(1.0, ${BANK_AIR.toFixed(2)} * bankFall, bankMask);
  }
  float snowPool = smoothstep(${POOL_TINT.from.toFixed(2)}, ${POOL_TINT.to.toFixed(2)}, vGlow.r * uGlowGain) * (1.0 - smoothstep(${POOL_TINT.underMm.toFixed(1)}, ${(POOL_TINT.underMm + POOL_TINT.fadeMm).toFixed(1)}, vStageLocal.y));
  vec3 snowPooled = vec3(1.0, 1.0, mix(1.0, ${POOL_TINT.blue.toFixed(2)}, snowPool));
  reflectedLight.directDiffuse *= snowPooled;
  reflectedLight.indirectDiffuse *= snowPooled;
  float snowTwinkle = fract(snowT.g * 61.7 + dot(normalize(vViewPosition), vec3(17.3, 31.7, 23.1)) + dot(normal, vec3(5.1, 3.3, 7.7)));
  float snowSpark = smoothstep(0.3, 0.9, snowT.g) * smoothstep(0.62, 1.0, snowTwinkle);
  reflectedLight.directSpecular += (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * snowSpark * ${SPARK.toFixed(2)};
}`,
      )
    },
  })
}

function iceMaterial(): THREE.MeshStandardMaterial {
  const sources = [{ at: mirrored, strength: MIRROR.lamp }, { at: anchors.window, strength: MIRROR.pane }, { at: anchors.sideWindow, strength: MIRROR.pane }, ...bulbs.map((at) => ({ at, strength: MIRROR.bulb }))]
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
vec3 iceFlat = vec3(0.0, 0.0, 1.0);
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
float iceRim = smoothstep(${ICE_RIM.toFixed(2)}, 1.0, vSurf.x);
float iceFrost = clamp(iceRim * iceRim * 0.9 + smoothstep(0.4, 0.8, iceWide.g) * (0.35 + 0.4 * iceRim) + (iceT.g - 0.5) * 0.24, 0.0, 1.0);
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
  iceFlat = normal;
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
  float iceGlitter = 0.6 + 1.4 * smoothstep(0.45, 0.85, texture2D(map, vMapUv * 2.3 + 0.37).g);
  float iceGlint = iceGlitter * villageMirror(villageInside(normalize(mix(iceFlat, normal, ${MIRROR.bump.toFixed(2)}))), iceSight, ${MIRROR.tight.toFixed(5)}, ${MIRROR.wide.toFixed(5)}, ${MIRROR.wideShare.toFixed(3)});
  totalEmissiveRadiance += ${glsl(tones.lamp)} * iceGlint * iceFresnel * (1.0 - 0.55 * iceFrost) * (1.0 + ${MIRROR.sparkle.toFixed(2)} * (iceT.g - 0.5 + iceT.r)) * uGlowGain * vColor.r;
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * ${ICE_NEAR.toFixed(2)}) * material.diffuseContribution;\nreflectedLight.directSpecular *= vColor.r;\nreflectedLight.indirectSpecular *= vColor.r;`)
    },
  })
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

const SWEPT = Math.hypot(potTop[0], potTop[2])
const WISP: Wisp = { from: potTop, height: 7.2, lean: [-2.7, 0.4], sway: 0.6, curl: 1.1, thin: 1, wide: 1.5, rings: 64, sides: 14, swept: [-potTop[2] / SWEPT, potTop[0] / SWEPT], sweepMm: 12 }
const WISP_STRENGTH = 1
const plume = wispGeometry(WISP)
const storm = { value: 0 }

export function build(): THREE.Object3D {
  const solids = withSurface(mergeGeometries([villageGeometry('solid'), geometry(MODEL, 'decor')]), nearWall)
  const walls = shadowed(new THREE.Mesh(solids, surfaceMaterial({ part: PART, map: villageGrain(), gain, cover: dusting, key: 'village-solid-winter', fill: WALL_FILL })))
  const snow = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'snow'), near), snowMaterial(PART, 'miniature', 'village-snow', '')))
  const ice = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'ice'), near), iceMaterial()), false)
  const smoke = new THREE.Mesh(plume, wispMaterial(PART, tones.smoke, WISP_STRENGTH, 2, clock, storm))
  smoke.renderOrder = 3
  smoke.frustumCulled = false
  return new THREE.Group().add(walls, snow, ice, smoke)
}

export function lights(): THREE.Object3D {
  const pieces = [
    glowPiece(geometry(MODEL, 'bulbs'), (_i, index, phase) => [GLOW.bulb, phase, index, 0]),
    glowPiece(villageGeometry('lamp-glass'), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1]),
    glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2]),
  ]
  const look = { bulb: 1.7, bulbCore: 3.4, glass: LAMP_GLASS, flame: tones.flame.map((v) => v * 6) as unknown as Rgb, room: tones.room.map((v) => v * 0.8) as unknown as Rgb, curtain: tones.curtain.map((v) => v * 1.5) as unknown as Rgb, frost: tones.rime.map((v) => v * 0.55) as unknown as Rgb, frostAmount: 0.3, flicker: 0.08, cycles: 3, through: THROUGH, paneHot: 0.12 }
  const lit = (x: number, z: number): [number, number, number] => [x, groundAt(x, z) + 1.5, z]
  const pools = [lit(flame[0] + 0.4, flame[2] + 1.6), lit(anchors.door[0] * 0.75 + flame[0] * 0.25, anchors.door[2] * 0.75 + flame[2] * 0.25)]
  const halos = new THREE.Mesh(
    haloGeometry([...bulbs, flame, anchors.window, anchors.sideWindow, ...pools], HALO.radiusMm, [...bulbs.map(() => HALO_KIND.bulb), HALO_KIND.lamp, HALO_KIND.pane, HALO_KIND.pane, ...pools.map(() => HALO_KIND.pool)], HALO.wide),
    haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, HALO, clock, storm),
  )
  halos.renderOrder = 3
  return new THREE.Group().add(new THREE.Mesh(glowGeometry(pieces), glowMaterial(LIGHT, look, clock)), halos)
}

export function arrival(): THREE.Object3D {
  return shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'fresh'), near), snowMaterial(ARRIVAL, 'arrival', 'village-fresh', ` + (uRise - 1.0) * ${FRESH_RISE_MM.toFixed(2)}`)), false)
}

const keep = (role: string): boolean => !isTree(role) && role !== 'ground' && role !== 'pond'
const SINK = { depthMm: 3.2, from: 0.74, to: 0.97 }
const BANK_SHUTS = { from: 0.2, to: 0.8 }
const BANK_SLOPE = 0.9
const RIM_SLOPE = 1.2
const DRIFT_SLOPE = 0.5
const HEAP_SLOPE = 1.3

function groundDistance(x: number, y: number, z: number): number {
  const t = Math.min(1, Math.max(0, (pondField(x, z) - SINK.from) / (SINK.to - SINK.from)))
  const bank = bankAt(x, z)
  const rim = rimAt(x, z)
  const drift = driftAt(x, z)
  const heap = heapAt(x, z)
  const b = Math.min(1, Math.max(0, (bank - BANK_SHUTS.from) / (BANK_SHUTS.to - BANK_SHUTS.from)))
  const under = (SINK.depthMm - pond.dip) * (1 - t * t * (3 - 2 * t)) * (1 - b * b * (3 - 2 * b))
  const slope = moundSlope(z) + BANK_SLOPE * Math.min(1, bank * 0.5) + RIM_SLOPE * Math.min(1, rim) + DRIFT_SLOPE * Math.min(1, drift * 2) + HEAP_SLOPE * Math.min(1, heap * 2)
  return (y - (groundAt(x, z) + bank + rim + drift + heap - under)) / Math.sqrt(1 + slope * slope)
}

const LOAD = { topMm: 1.1, outMm: 0.6 }
const frame = cottageFrame()
const loadCos = Math.cos(pitch)
const loadSin = Math.sin(pitch)

function loadDistance(x: number, y: number, z: number): number {
  const dx = x - cottage.x
  const dz = z - cottage.z
  const across = dx * frame.v[0] + dz * frame.v[1]
  const along = dx * frame.u[0] + dz * frame.u[1]
  const up = y - frame.floor - ridgeY
  const from = -LOAD.topMm * (loadSin / loadCos)
  const to = slopeLength + LOAD.outMm
  let d = Infinity
  for (const side of [-1, 1]) {
    const qs = Math.abs(side * across * loadCos - up * loadSin - (from + to) / 2) - (to - from) / 2
    const ql = Math.abs(side * across * loadSin + up * loadCos - LOAD.topMm / 2) - LOAD.topMm / 2
    const qa = Math.abs(along) - (roofLength + LOAD.outMm)
    d = Math.min(d, Math.hypot(Math.max(qs, 0), Math.max(ql, 0), Math.max(qa, 0)) + Math.min(Math.max(qs, ql, qa), 0))
  }
  return d
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(solidDistance(x, y, z, keep), shrubDistance(x, y, z), groundDistance(x, y, z), loadDistance(x, y, z))
}

export function update(moment: KitMoment): void {
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  gain.value = gainOf(innerLights, moment.time, moment.period)
  const t = Math.min(1, Math.max(0, moment.sinceLanding / config.shake.settleCheckSeconds))
  rise.value = t * t * (3 - 2 * t)
  storm.value = 1 - rise.value
  wispPose(plume, WISP, clock.value, storm.value)
}
