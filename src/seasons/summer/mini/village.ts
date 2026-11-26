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
import { BUMP_GLSL, NEAR_LIGHT, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, withSurface, type GlowSource } from '../../../miniature/surface'
import { anchors, groundAt, moundAt, moundSlope, pond, solidDistance, tree } from '../../../scene/layout'
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
const NEAR = { lamp: { power: 1.8, reachMm: 7 }, pane: { power: 0.9, reachMm: 3 }, paper: { power: 0.5, reachMm: 2.2 } }
const NEAR_WALL = { lamp: { power: 1.3, reachMm: 8, ends: 3 }, pane: { power: 1.6, reachMm: 4.5, ends: 3 }, paper: { power: 1.25, reachMm: 5.2, ends: 3 } }
const MIRROR = { lamp: 9, pane: 1.2, paper: 1.6, tight: 0.002, wide: 0.03, wideShare: 0.01, lowMm: 3.4 }
const HALO = { radiusMm: 0.75, strength: 1, hot: 2, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 1, glare: [1.6, 1.12, 0.66] as Rgb }
const HALO_KIND = { lamp: { size: 3.6, rest: 0.08, hot: 0, bloom: 0.2 }, pane: { size: 2.6, rest: 0.07, hot: 0, bloom: 0.2 }, pool: { size: 5, rest: 0, hot: 0, bloom: 0.06 } }
const THROUGH = 6
const LAMP_GLASS: Rgb = [1.7, 0.82, 0.22]
const WALL_FILL = 1.1
const SAND = { white: [0.86, 0.9, 0.98] as Rgb, whiten: 0.8, clumpPerMm: 1.1, midPerMm: 2.1, sparkMid: 2.3, grainPerMm: 4.2, heapPerMm: 0.16, heapLow: 0.72, heap: 0.42, reliefMm: 1.1, reliefClump: 0.34, reliefMid: 0.09, body: 3.6, floor: 0.28, wrap: 0.5, foot: 0.7, lip: 1.5, lipLow: 0.15, lipTo: 0.2, breakPerMm: 0.42, shade: [0.6, 0.45, 0.31] as Rgb, bump: 0.6, grainLow: 0.42, grain: 0.62, spark: 1.5, topFrom: 0.22, topTo: 0.62 }
const PEBBLE = { perMm: 0.8, from: 1.13, to: 1.2, dark: [0.34, 0.29, 0.24] as Rgb, pale: [0.7, 0.62, 0.5] as Rgb, sky: 1.1, sun: 2.6 }
const TURF_LOOK = { tone: 0.5, fineMm: 0.05, clumpMm: 0.22, fill: 0.25, wrap: 0.5, sun: 14 }
// Where the low sun reaches the floor: the same four pools as `sunAt` in assets-src/village-summer/build.mjs, which the grass carries.
const SUN_POOLS: readonly [number, number, number, number, number][] = [[1.2, 27, 3, 11, 9], [1.4, 3, -8, 9, 6], [0.4, -24, 21, 6, 5], [0.5, 24, 22, 9, 6]]
const GRASS_LOOK = { fill: 0.1, wrap: 1.0, through: 0.36, near: 2.1, sun: 40, sunRoot: 0.12, shade: [0.26, 0.23, 0.62] as Rgb }
const ROOF = { slate: [0.07, 0.11, 0.22] as Rgb, chimney: [0.2, 0.185, 0.18] as Rgb, vary: 0.75, varyMm: 1.3, stone: [0.6, 0.45, 0.37] as Rgb, stoneMid: 0.34, stoneFlat: 0.45, stoneHue: 0.5, plank: [0.5, 0.26, 0.15] as Rgb, plankMm: 2.2, plankTall: 3.8, pitch: 0.2, stoneMm: 1.4, picket: [0.5, 0.27, 0.14] as Rgb, picketMm: 1.6, boardMm: 0.9, boardVary: 0.9, grainMm: 0.22, grainVary: 0.5, boardFoot: 0.45, boardTall: 3.2, pale: 0.25, railTop: [1.5, 1.2, 0.85] as Rgb, door: [0.27, 0.125, 0.08] as Rgb, doorMm: 2.4, reachMm: 0.4 }
const DARK_PANE = 0.8
const WATER = { spark: 1.1, mass: 0.975, houseMm: 9.5, houseTall: 17, flat: 0.14, wobble: 0.9, rough: 0.035, ripple: 0.0045, fine: 0.0012, shoreFrom: 0.84, shoreTo: 1.0, sky: 2.0, skyFrom: -0.75, skyTo: 0.35, skyAt: 1.5, skyWide: 11.5, skyLow: 0.1, bankMm: 0.7, bankVary: 1.1, bankEdge: 0.16, bankDark: 0.975, env: 0.1, glint: 0.5, squash: 0.14, paperGlint: 0.25, paperMm: 1.5, paperTall: 0.5, post: 0.93, postMm: 0.75, postTall: 11.5, trunk: 0.975, trunkMm: 5.2, trunkTall: 26, body: 0.4 }

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

const near: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR.pane },
  ...lanterns.map((l): GlowSource => ({ at: l.at, color: paperOf(l.tone), power: NEAR.paper.power * l.radius, reachMm: NEAR.paper.reachMm * l.radius })),
]

const nearWall: GlowSource[] = [
  { at: flame, color: tones.lampLight, ...NEAR_WALL.lamp },
  { at: anchors.window, color: tones.roomLight, ...NEAR_WALL.pane },
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
// The stones of the pond's bank: one rounded stone to a cell, each with its own place, size and tone, dark and wet between.
vec2 turfPebR = vec2(0.0);
vec3 turfPebble(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 9.0;
  float d2 = 9.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + 0.12 + 0.76 * vec2(sandHash(vec3(i + g, 1.3)), sandHash(vec3(i + g, 7.9))) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = sandHash(vec3(i + g, 3.1)); turfPebR = r; }
      else if (d < d2) d2 = d;
    }
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
float turfBankAt(vec2 p) {
  vec2 d = p - vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)});
  vec2 l = abs(vec2(${Math.cos(pond.yaw).toFixed(4)} * d.x - ${Math.sin(pond.yaw).toFixed(4)} * d.y, ${Math.sin(pond.yaw).toFixed(4)} * d.x + ${Math.cos(pond.yaw).toFixed(4)} * d.y) / vec2(${pond.rx.toFixed(2)}, ${pond.rz.toFixed(2)}));
  return pow(abs(pow(abs(l.x), ${pond.power.toFixed(1)}) + pow(abs(l.y), ${pond.power.toFixed(1)})), ${(1 / pond.power).toFixed(4)});
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
diffuseColor.rgb *= 1.0 + ${TURF_LOOK.tone.toFixed(2)} * (0.5 * (turfT.g - 0.5) + 0.3 * (turfT.b - 0.5) + 0.45 * (turfFine - 0.5) + 0.25 * (turfT.r - 0.5));
float sandAmt = max(smoothstep(0.0, 0.2, vSurf.y), smoothstep(${SAND.topFrom.toFixed(2)}, ${SAND.topTo.toFixed(2)}, vSurf.x + 0.25 * (turfT.g - 0.5)));
float sandFineB = sandNoise(vStageLocal * ${SAND.clumpPerMm.toFixed(2)});
float sandFineC = sandNoise(vStageLocal * ${SAND.grainPerMm.toFixed(2)} + 7.3);
// A middle grain, half a millimetre wide: the one the hero lens resolves. It carries the sparkle of the lit grains.
float sandFineM = sandNoise(vStageLocal * ${SAND.midPerMm.toFixed(2)} + 4.1);
float sandHeap = sandNoise(vStageLocal * ${SAND.heapPerMm.toFixed(2)} + 3.1);
// The bed has relief: heaps, clumps and grains, in millimetres, which the low sun shades.
float sandRelief = ${SAND.reliefMm.toFixed(2)} * sandHeap + ${SAND.reliefClump.toFixed(2)} * sandFineB + ${SAND.reliefMid.toFixed(2)} * sandFineM;
float sandGrain = 0.4 * turfT.g + 0.35 * sandFineB + 0.3 * sandFineC + 0.75 * sandFineM;
diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, ${glsl(SAND.white)}, ${SAND.whiten.toFixed(2)}) * (${SAND.heapLow.toFixed(2)} + ${SAND.heap.toFixed(2)} * sandHeap) * (${SAND.grainLow.toFixed(2)} + ${SAND.grain.toFixed(2)} * sandGrain + ${SAND.spark.toFixed(2)} * smoothstep(0.5, 0.72, sandFineC * (0.45 + 0.9 * sandFineB)) + ${SAND.sparkMid.toFixed(2)} * smoothstep(0.6, 0.78, sandFineM)), sandAmt);
vec3 turfPeb = turfPebble(vStageLocal.xz * ${PEBBLE.perMm.toFixed(2)});
float turfPebRing = (1.0 - smoothstep(${PEBBLE.from.toFixed(2)}, ${PEBBLE.to.toFixed(2)}, turfBankAt(vStageLocal.xz) + 0.07 * (sandFineB - 0.5))) * (1.0 - sandAmt);
float turfPebOn = smoothstep(0.05, 0.2, turfPeb.y);
vec3 turfPebTone = mix(${glsl(PEBBLE.dark)}, ${glsl(PEBBLE.pale)}, turfPeb.z) * (0.8 + 0.4 * sandFineC);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.012, 0.01, 0.007), turfPebTone, turfPebOn), turfPebRing);
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
      afterLight(shader, `${NEAR_LIGHT}\n{\n  float sandBank = sandAmt;\n  vec3 sandBody = stageKeyC * (RECIPROCAL_PI * ${SAND.body.toFixed(2)} * mix(${SAND.floor.toFixed(2)}, 1.0, stageWrap(dot(geometryNormal, stageKeyL), ${SAND.wrap.toFixed(2)})) * mix(1.0, ${SAND.foot.toFixed(2)}, vSurf.y)) * material.diffuseContribution;\n  // The low sun whitens the lip of the sand where it meets the ground and leaves the face against the glass in warm shade.\n  float sandLip = 1.0 - smoothstep(0.0, ${SAND.lipTo.toFixed(2)}, vSurf.y);\n  // The shelf is not one white band: heaps catch the sun, the hollows between them stay in shade.\n  float sandBreak = smoothstep(0.25, 0.75, 0.6 * sandNoise(vStageLocal * ${SAND.breakPerMm.toFixed(2)} + 9.7) + 0.4 * sandFineB);\n  sandBody *= mix(${glsl(SAND.shade)}, vec3(1.0 + mix(${SAND.lipLow.toFixed(2)}, ${SAND.lip.toFixed(2)}, sandBreak)), sandLip);\n  reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, sandBody, sandBank);\n}\n// Each stone is lit on its crown by the evening sky and rimmed by the low sun on the side that faces it.\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * turfPebRing * turfPebOn * (${PEBBLE.sky.toFixed(2)} * (1.0 - 0.8 * turfPeb.x) + ${PEBBLE.sun.toFixed(2)} * smoothstep(0.15, 0.75, dot(turfPebR / max(length(turfPebR), 1e-4), vec2(-0.53, 0.85))) * smoothstep(0.1, 0.45, turfPeb.x))) * turfPebTone;\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${TURF_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${TURF_LOOK.wrap.toFixed(2)})) * material.diffuseContribution;\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${TURF_LOOK.sun.toFixed(2)} * turfSunAt(vStageLocal.xz) * (1.0 - sandAmt)) * mix(material.diffuseContribution, vec3(0.22, 0.19, 0.095), 0.58);`)
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
        .replace('#include <map_fragment>', `diffuseColor.rgb *= (0.85 + 0.3 * texture2D(map, vMapUv * 3.0).g) * mix(${glsl(GRASS_LOOK.shade)}, vec3(1.0), vSurf.y);`)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
      afterLight(
        shader,
        `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * ${GRASS_LOOK.near.toFixed(2)}) * material.diffuseContribution;
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${GRASS_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${GRASS_LOOK.wrap.toFixed(2)}) + ${GRASS_LOOK.through.toFixed(2)} * vSurf.x * pow(clamp(dot(normalize(vViewPosition), -stageKeyL), 0.0, 1.0), 2.0))) * material.diffuseContribution;
reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${GRASS_LOOK.sun.toFixed(2)} * vSurf.y * vSurf.y * mix(${GRASS_LOOK.sunRoot.toFixed(2)}, 1.0, vSurf.x)) * mix(material.diffuseContribution, vec3(0.22, 0.19, 0.095), 0.58);`,
      )
    },
  })
}

function waterMaterial(): THREE.MeshStandardMaterial {
  const level = moundAt(pond.z) - pond.level
  const sources = [{ at: mirrored, strength: 0 }, { at: anchors.window, strength: 0 }, ...lanterns.map((l) => ({ at: [l.at[0], level + (l.at[1] - level) * WATER.squash, l.at[2]] as [number, number, number], strength: MIRROR.paper * l.radius }))]
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
  float a = atan(l.y, l.x);
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
    sum += ${glsl(tones.paperLight)} * (${WATER.paperGlint.toFixed(2)} * step(0.0, along) * exp(-side * side - off * off)) * uMirror[i].w;
  }
  return sum;
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
float waterShore = smoothstep(${WATER.shoreFrom.toFixed(2)}, ${WATER.shoreTo.toFixed(2)}, vSurf.x + 0.09 * (texture2D(map, vMapUv * 0.8).g - 0.5) + 0.05 * (texture2D(map, vMapUv * 2.7).g - 0.5));
// At its rim the water is a thin film over damp sand and stones, not a black line.
diffuseColor.rgb = mix(${glsl(tones.waterDeep)}, vec3(0.3, 0.22, 0.13), waterShore * waterShore);
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
  totalEmissiveRadiance += waterGlint * (uGlowGain * ${WATER.glint.toFixed(2)}) * (1.0 - 0.6 * waterShore) * (1.0 - 0.5 * waterBank) + ${glsl(tones.waterSky)} * (${WATER.sky.toFixed(2)} * waterSky * (0.25 + 0.75 * waterFresnel) * (0.86 + 0.14 * texture2D(map, vMapUv * vec2(0.9, 2.2)).b + ${WATER.spark.toFixed(2)} * waterSpark)) * (1.0 - waterShade) * (1.0 - 0.75 * waterShore) * (${WATER.skyLow.toFixed(2)} + ${(1 - WATER.skyLow).toFixed(2)} * exp(-pow(abs((vStageLocal.x + 14.0 * waterN.x - ${(pond.x + WATER.skyAt).toFixed(2)}) / ${WATER.skyWide.toFixed(2)}), 2.0)));
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

function dressed(g: THREE.BufferGeometry, sharedCount: number): THREE.BufferGeometry {
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal')
  const C = g.getAttribute('color')
  const only = (role: string) => (r: string): boolean => r === role
  const roof = only('roof')
  const chimney = only('chimney')
  const fence = only('fence')
  const cottage = only('cottage')
  for (let i = 0; i < sharedCount; i++) {
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    const lum = 0.3 * C.getX(i) + 0.6 * C.getY(i) + 0.1 * C.getZ(i)
    // The roof's solid fills the gable too: only what faces up is slate, the wall under the verge stays stone.
    const nearRoof = solidDistance(x, y, z, roof) < ROOF.reachMm
    if (solidDistance(x, y, z, chimney) < ROOF.reachMm) {
      const v = 2 * stoneVary(x, y, z)
      C.setXYZ(i, lum * ROOF.chimney[0] * v, lum * ROOF.chimney[1] * v, lum * ROOF.chimney[2] * v)
    }
    else if (nearRoof && N.getY(i) > ROOF.pitch) C.setXYZ(i, lum * ROOF.slate[0] * 2, lum * ROOF.slate[1] * 2, lum * ROOF.slate[2] * 2)
    else if (Math.hypot(x - anchors.door[0], z - anchors.door[2]) < ROOF.doorMm && C.getX(i) > 1.2 * C.getZ(i) && Math.abs(y - anchors.door[1]) < ROOF.doorMm * 1.6) C.setXYZ(i, C.getX(i) * ROOF.door[0], C.getY(i) * ROOF.door[1], C.getZ(i) * ROOF.door[2])
    else if (Math.hypot(x - anchors.door[0], z - anchors.door[2]) < ROOF.plankMm && Math.abs(y - anchors.door[1]) < ROOF.plankTall) C.setXYZ(i, lum * ROOF.plank[0], lum * ROOF.plank[1], lum * ROOF.plank[2])
    else if ((nearRoof || solidDistance(x, y, z, cottage) < ROOF.stoneMm) && Math.abs(C.getX(i) - C.getZ(i)) < ROOF.stoneHue * lum) {
      const v = stoneVary(x, y, z)
      C.setXYZ(i, (C.getX(i) + (ROOF.stoneMid - lum) * ROOF.stoneFlat) * ROOF.stone[0] * v, (C.getY(i) + (ROOF.stoneMid - lum) * ROOF.stoneFlat) * ROOF.stone[1] * v, (C.getZ(i) + (ROOF.stoneMid - lum) * ROOF.stoneFlat) * ROOF.stone[2] * v)
    }
    else if (solidDistance(x, y, z, fence) < ROOF.picketMm && Math.min(C.getX(i), C.getY(i), C.getZ(i)) > 0.45 * Math.max(C.getX(i), C.getY(i), C.getZ(i)) && lum > ROOF.pale) {
      // Each board has its own tone and a grain that runs up it; the foot of the fence stands in the shade of the grass.
      const v = stoneVary(x, y, z, ROOF.boardMm, 0.12, ROOF.boardVary) * stoneVary(x, y, z, ROOF.grainMm, 0.2, ROOF.grainVary) * (ROOF.boardFoot + (1 - ROOF.boardFoot) * Math.min(1, Math.max(0, (y - groundAt(x, z)) / ROOF.boardTall)))
      C.setXYZ(i, lum * ROOF.picket[0] * v, lum * ROOF.picket[1] * v, lum * ROOF.picket[2] * v)
    }
    else if (N.getY(i) > 0.6 && solidDistance(x, y, z, fence) < ROOF.reachMm) C.setXYZ(i, C.getX(i) * ROOF.railTop[0], C.getY(i) * ROOF.railTop[1], C.getZ(i) * ROOF.railTop[2])
  }
  C.needsUpdate = true
  return g
}

export function build(): THREE.Object3D {
  const shared = villageGeometry('solid')
  const solids = withSurface(dressed(mergeGeometries([shared, geometry(MODEL, 'decor')]), shared.getAttribute('position').count), nearWall)
  const walls = unmirrored(shadowed(new THREE.Mesh(solids, surfaceMaterial({ part: PART, map: villageGrain(), gain, key: 'village-solid-summer', fill: WALL_FILL }))), shared.index ? shared.index.count : shared.getAttribute('position').count)
  const ground = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'ground'), near), turfMaterial()), false)
  const grass = unmirrored(shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'grass'), near), grassMaterial()), false))
  const water = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'water'), near), waterMaterial()), false)
  return new THREE.Group().add(walls, ground, grass, water)
}

export function lights(): THREE.Object3D {
  const pieces = [
    glowPiece(villageGeometry('lamp-glass'), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1]),
  ]
  const unlit = [glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2])]
  const look = { bulb: 0.75, bulbCore: 1.7, glass: LAMP_GLASS, flame: tones.flame.map((v) => v * 6) as unknown as Rgb, room: tones.room.map((v) => v * 1.25) as unknown as Rgb, curtain: tones.curtain.map((v) => v * 0.45) as unknown as Rgb, frost: tones.haze.map((v) => v * 0.4) as unknown as Rgb, frostAmount: 0, flicker: 0.08, cycles: 3, through: THROUGH, paneHot: 0.4 }
  const lit = (x: number, z: number): [number, number, number] => [x, groundAt(x, z) + 1.5, z]
  const pools = [lit(flame[0] + 0.4, flame[2] + 1.6), lit(anchors.door[0] * 0.75 + flame[0] * 0.25, anchors.door[2] * 0.75 + flame[2] * 0.25)]
  const halos = new THREE.Mesh(haloGeometry([flame, anchors.window, ...pools], HALO.radiusMm, [HALO_KIND.lamp, HALO_KIND.pane, ...pools.map(() => HALO_KIND.pool)], HALO.wide), haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, HALO, clock, storm))
  halos.renderOrder = 3
  const dark = { ...look, room: tones.room.map((v) => v * DARK_PANE) as unknown as Rgb, curtain: tones.curtain.map((v) => v * DARK_PANE) as unknown as Rgb, paneHot: 0, through: 0 }
  return new THREE.Group().add(new THREE.Mesh(glowGeometry(pieces), glowMaterial(LIGHT, look, clock)), new THREE.Mesh(glowGeometry(unlit), glowMaterial(LIGHT, dark, clock)), halos)
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
