import * as THREE from 'three'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial, type Rgb } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { GLOW, glowGeometry, glowMaterial, glowPiece, haloGeometry, haloMaterial } from '../../../miniature/glow'
import { MIRROR_GLSL, mirrorUniforms } from '../../../miniature/mirror'
import { prepareVillage, tileMm, villageGeometry, villageGrain } from '../../../miniature/model'
import { lampFlame, lampFoot, shrubDistance } from '../../../miniature/roof'
import { BUMP_GLSL, NEAR_LIGHT, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, withSurface, type Cover, type GlowSource } from '../../../miniature/surface'
import { anchors, cottage, cottageFrame, fence, groundAt, moundAt, moundSlope, pond, pondField, solidDistance, steps, stones, tree } from '../../../scene/layout'
import { gainOf } from '../../../scene/lightgrid'
import type { InnerLight, KitMoment } from '../../kit'
import { isTree, season, tones } from './palette'

const MODEL = 'spring/village-spring.glb'
const TURF = 'spring/village-turf.lin.tile.png'
const WATER = 'spring/village-water.lin.tile.png'
const PART = `miniature-${season}`
const LIGHT = `light-${season}`

const LAMP = { power: 3.4, reachMm: 13, flicker: 0.05, cycles: 3, phase: 0.1 }
const WINDOW = { power: 1, reachMm: 8, flicker: 0.1, cycles: 5, phase: 0.4 }
const SIDE = { power: 0.9, reachMm: 7, flicker: 0.1, cycles: 4, phase: 0.75 }
const NEAR = { lamp: { power: 5.6, reachMm: 9.5 }, pane: { power: 0.9, reachMm: 2.6 } }
const NEAR_WALL = { lamp: { power: 4.8, reachMm: 12, ends: 3 }, pane: { power: 3, reachMm: 5.5, ends: 3 } }
const NEAR_GROWTH = { lamp: { power: 5, reachMm: 8 }, pane: { power: 2.2, reachMm: 4 } }
const MIRROR = { lamp: 3, pane: 1.4, tight: 0.0022, wide: 0.035, wideShare: 0.03, bump: 1, lowMm: 3.4 }
const STREAK = { strength: 20, side: 0.045, along: 0.6, bump: 0.06, rings: 0.9 }
const MOSS_FROM = [-16.8, -15]
const SKIRT_FILL = 1.7
const BANK = { wide: 0.21, wideMm: 0.9, cushion: 0.46, cushionMm: 0.7, tuft: 1.25, tuftMm: 0.26, grain: 4.2, grainMm: 0.05, deep: 0.13, lip: 1.3 }
const BANK_SPAN = BANK.cushionMm + BANK.tuftMm
const BANK_EARTH: Rgb = [0.03, 0.021, 0.012]
const SLATE = { tint: [2.2, 3.1, 3.8] as Rgb, from: cottageFrame().floor + cottage.wall - 1.2 }
const ROCK_FILL = 2.4
const POT: Rgb = [0.5, 0.2, 0.1]
const FENCE_TINT: Rgb = [0.64, 0.5, 0.39]
const PATH = { tint: [1.75, 1.58, 1.3] as Rgb, reachMm: [1.5, 2.1], tallMm: 1 }
const RING_SHOW = 1.7
const HALO = { radiusMm: 0.75, strength: 1, hot: 2, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 1, glare: [1.6, 1.12, 0.66] as Rgb }
const HALO_KIND = { lamp: { size: 4.6, rest: 0.5, hot: 0.07, bloom: 0.3 }, pane: { size: 2.6, rest: 0.28, hot: 0, bloom: 0.36 }, pool: { size: 7, rest: 0, hot: 0, bloom: 0.17 } }
const SPARK = { radiusMm: 0.75, strength: 1.2, hot: 2.5, pullMm: 1.6, flicker: 0.05, cycles: 2, through: 80, wide: 1, bloom: 0 }
const SPARK_KIND = { size: 1.5, rest: 0.9, hot: 1.2, bloom: 0 }
const THROUGH = 6
const LAMP_GLASS: Rgb = [9, 5.6, 2.3]
const WALL_FILL = 2.6
const STONE_LIFT: Rgb = [1.5, 1.36, 1.18]
const SLATE_BASE: Rgb = [0.03, 0.036, 0.046]
const BANK_TINT: Rgb = [0.62, 0.56, 0.34]
const TURF_LOOK = { wrap: 0.45, fill: 0.9, grainMm: 0.07, lumpMm: 0.26, wideMm: 0.5, fuzz: 0.5 }
const GROWTH_LOOK = { wrap: 0.7, fill: 0.7, through: 1.6, thin: 0.5, tight: 3 }
const RIPPLE = { waveMm: 4.0, heightMm: 0.3, reachMm: 22, laps: 5, chopMm: 0.016, drift: 2 }
const WATER_LOOK = { rough: 0.07, near: 0.12, sky: 0.36, crown: 0.6, post: 0.55, postMm: 0.5, postTall: 11.5, trunk: 0.5, trunkMm: 2.6, trunkTall: 16, body: 0.4, room: 0.45, far: [0.05, 0.06, 0.035] as Rgb, farFrom: 0.1, farTo: 0.42 }
const CROWN_MIRROR = { centre: [tree.x + 1.2, 9.9, tree.z + 1] as Rgb, r: [22.5, 15.5, 15] as Rgb, tone: [0.95, 0.56, 0.66] as Rgb }

const flame = lampFlame()
const mirrored: [number, number, number] = [flame[0], flame[1] - MIRROR.lowMm, flame[2]]
const postFoot = lampFoot() as Rgb
const trunkFoot: Rgb = [tree.x, groundAt(tree.x, tree.z), tree.z]
const drops: readonly Rgb[] = [
  [flame[0] + 2.2, 0.13, pond.z - 4.5],
  [pond.x + 6.5, 0.61, pond.z + 3.2],
  [pond.x - 4.6, 0.37, pond.z + 6.4],
]

export const innerLights: InnerLight[] = [
  { at: flame, color: tones.lampLight, ...LAMP },
  { at: anchors.window, color: tones.roomLight, ...WINDOW },
  { at: anchors.sideWindow, color: tones.roomLight, ...SIDE },
]

const sources = (look: { lamp: { power: number; reachMm: number; ends?: number }; pane: { power: number; reachMm: number; ends?: number } }, lamp: Rgb, room: Rgb): GlowSource[] => [
  { at: flame, color: lamp, ...look.lamp },
  { at: anchors.window, color: room, ...look.pane },
  { at: anchors.sideWindow, color: room, ...look.pane },
]
const near = sources(NEAR, tones.pool, tones.pool)
const nearWall = sources(NEAR_WALL, tones.lampLight, tones.roomLight)
const nearGrowth = sources(NEAR_GROWTH, tones.pool, tones.pool)

const gain = { value: 1 }
const clock = { value: 0 }
const storm = { value: 0 }

const glsl = (c: Rgb): string => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`

export async function prepare(): Promise<void> {
  await Promise.all([prepareVillage(), prepareModel(MODEL)])
}

const pathMask = [...steps, ...stones]
  .map(([x, z]) => `step(vStageLocal.y, ${(groundAt(x, z) + PATH.tallMm).toFixed(3)}) * (1.0 - smoothstep(${PATH.reachMm[0].toFixed(2)}, ${PATH.reachMm[1].toFixed(2)}, length(vStageLocal.xz - vec2(${x.toFixed(3)}, ${z.toFixed(3)}))))`)
  .join(' + ')

const mossy: Cover = {
  uniforms: {},
  pars: '',
  apply: `
{
  float springUp = normalize(vObjN).y + 0.6 * (villageMottle - 0.5) + 0.3 * (villageGrain.r - 0.5);
  float springMoss = 0.45 * smoothstep(0.62, 0.98, springUp) * smoothstep(0.5, 0.78, villageMottle + 0.25 * villageGrain.b) * (1.0 - villageIron) * (1.0 - villageLeaf);
  springMoss = max(springMoss, 0.5 * villageStone * smoothstep(0.52, 0.7, villageMottle) * smoothstep(0.55, 0.8, texture2D(map, vMapUv * 0.11 + 0.71).b));
  float springSlate = smoothstep(0.55, 0.7, normalize(vObjN).y) * (1.0 - smoothstep(0.86, 0.93, normalize(vObjN).y)) * smoothstep(${SLATE.from.toFixed(2)}, ${(SLATE.from + 1).toFixed(2)}, vStageLocal.y) * (1.0 - villageLeaf);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * ${glsl(STONE_LIFT)}, villageStone * (1.0 - springSlate));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * ${glsl(SLATE.tint)} + ${glsl(SLATE_BASE)} * (0.5 + villageGrain.r), springSlate);
  springMoss *= 0.2 + 0.8 * smoothstep(${MOSS_FROM[0].toFixed(1)}, ${MOSS_FROM[1].toFixed(1)}, vStageLocal.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${glsl(tones.moss)} * (0.6 + 0.9 * villageGrain.r), springMoss * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 1.9, 0.5) + vec3(0.004, 0.02, 0.0), villageLeaf);
  vec2 springRail = vec2(${(fence.to[0] - fence.from[0]).toFixed(3)}, ${(fence.to[1] - fence.from[1]).toFixed(3)});
  vec2 springOff = vStageLocal.xz - vec2(${fence.from[0].toFixed(3)}, ${fence.from[1].toFixed(3)});
  float springFence = villageWood * (1.0 - smoothstep(1.6, 2.4, length(springOff - springRail * clamp(dot(springOff, springRail) / dot(springRail, springRail), -0.1, 1.1))));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * ${glsl(FENCE_TINT)}, springFence);
  float springPath = clamp(${pathMask}, 0.0, 1.0) * (1.0 - villageLeaf) * (1.0 - villageWood) * (1.0 - villageIron);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * ${glsl(PATH.tint)}, springPath * (1.0 - 0.7 * springMoss));
  float springPot = villageIron * smoothstep(${(SLATE.from + 3.2).toFixed(2)}, ${(SLATE.from + 3.6).toFixed(2)}, vStageLocal.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${glsl(POT)} * (0.55 + 0.9 * villageGrain.r) * (0.7 + 0.6 * villageMottle), springPot);
  villageRough = mix(villageRough, 0.95, max(springMoss, springPot));
  villageMetal *= 1.0 - springPot;
}
`,
}

function turfMaterial(): THREE.MeshStandardMaterial {
  const tile = (1 / tileMm()).toFixed(6)
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(TURF),
    roughness: 0.96,
    metalness: 0,
    change: 'miniature',
    key: 'village-turf-spring',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
vec3 turfWeights;
float turfBankH = 0.0;
float bankHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1) * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float bankNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bankHash(i), bankHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(bankHash(i + vec3(0.0, 1.0, 0.0)), bankHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(bankHash(i + vec3(0.0, 0.0, 1.0)), bankHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(bankHash(i + vec3(0.0, 1.0, 1.0)), bankHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
vec3 bankSpot(vec3 p) {
  return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
}
float bankCells(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d = 1.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + bankSpot(i + g) - f;
    d = min(d, dot(r, r));
  }
  return 1.0 - min(d, 1.0);
}
float bankFine = 1.0;
float bankRelief(vec3 q) {
  return ${BANK.cushionMm.toFixed(2)} * bankCells(q * ${BANK.cushion.toFixed(3)}) + ${BANK.tuftMm.toFixed(2)} * bankCells(q.zxy * ${BANK.tuft.toFixed(3)} + 5.3);
}
float bankHeight(vec3 p) {
  vec3 q = mat3(0.81, -0.31, 0.5, 0.45, 0.86, -0.24, -0.37, 0.4, 0.83) * p;
  return ${BANK.wideMm.toFixed(2)} * bankNoise(q * ${BANK.wide.toFixed(3)}) + bankRelief(q) + ${BANK.grainMm.toFixed(3)} * bankFine * bankNoise(q.yzx * ${BANK.grain.toFixed(2)} + 3.1);
}
vec3 turfAt(vec3 p) {
  return texture2D(map, p.zy).rgb * turfWeights.x + texture2D(map, p.xz).rgb * turfWeights.y + texture2D(map, p.xy).rgb * turfWeights.z;
}
float turfHeight(vec3 p) {
  vec3 t = turfAt(p);
  return t.r * ${TURF_LOOK.grainMm.toFixed(3)} + t.b * ${TURF_LOOK.lumpMm.toFixed(3)} + turfAt(p * 0.23 + 0.41).b * ${TURF_LOOK.wideMm.toFixed(3)};
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
turfWeights = pow(abs(normalize(vObjN)), vec3(4.0));
turfWeights /= turfWeights.x + turfWeights.y + turfWeights.z;
vec3 turfP = vStageLocal * ${tile};
vec3 turfT = turfAt(turfP);
vec3 turfWide = turfAt(turfP * 0.23 + 0.41);
float turfBankA = smoothstep(1.4, 1.9, vSurf.x) * (1.0 - smoothstep(2.2, 2.8, vSurf.x));
diffuseColor.rgb *= mix((0.5 + 0.62 * turfT.r + 0.34 * (turfT.b - 0.5)) * (0.74 + 0.52 * turfWide.g), 1.0, turfBankA);
if (turfBankA > 0.01) {
  bankFine = clamp(1.3 - ${(2 * BANK.grain).toFixed(2)} * length(fwidth(vStageLocal)), 0.0, 1.0);
  turfBankH = bankHeight(vStageLocal);
  vec3 bankQ = mat3(0.81, -0.31, 0.5, 0.45, 0.86, -0.24, -0.37, 0.4, 0.83) * vStageLocal;
  float bankCrest = smoothstep(${(0.12 * BANK_SPAN).toFixed(3)}, ${(0.8 * BANK_SPAN).toFixed(3)}, bankRelief(bankQ));
  float bankPatch = bankNoise(bankQ * 0.33 + 9.1);
  float bankSpeck = bankNoise(bankQ.yzx * ${BANK.grain.toFixed(2)} + 3.1);
  vec3 bankMoss = diffuseColor.rgb * ${glsl(BANK_TINT)} * (0.36 + 1.2 * bankCrest) * (0.7 + 0.6 * bankPatch) * (0.8 + 0.4 * bankFine * bankSpeck);
  vec3 bankSoil = ${glsl(BANK_EARTH)} * (0.6 + 0.8 * bankPatch);
  vec3 bankTone = mix(bankSoil, bankMoss, smoothstep(0.04, 0.34, bankCrest) * (0.55 + 0.45 * smoothstep(0.25, 0.6, bankPatch + 0.3 * bankCrest)));
  bankTone *= mix(${BANK.lip.toFixed(2)}, ${BANK.deep.toFixed(2)}, smoothstep(0.02, 0.42, vSurf.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, bankTone, turfBankA);
}
`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float turfH = turfHeight(turfP);
  vec2 turfDh = vec2(turfHeight(turfP + dFdx(turfP)) - turfH, turfHeight(turfP + dFdy(turfP)) - turfH);
  if (turfBankA > 0.01) {
    vec2 bankDh = vec2(bankHeight(vStageLocal + dFdx(vStageLocal)) - turfBankH, bankHeight(vStageLocal + dFdy(vStageLocal)) - turfBankH);
    turfDh = mix(turfDh, bankDh, turfBankA);
  }
  normal = villageBump(-vViewPosition, normal, turfDh, faceDirection);
}
`,
        )
      afterLight(
        shader,
        `${NEAR_LIGHT}
{
  reflectedLight.directDiffuse += (stageWrapped(geometryNormal, ${TURF_LOOK.wrap.toFixed(2)}) + stageKeyC * (RECIPROCAL_PI * ${TURF_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 1.0))) * material.diffuseContribution;
  float turfFuzz = pow(1.0 - clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0), 3.0);
  float turfBank = turfBankA;
  float turfCatch = smoothstep(-0.15, 0.9, dot(geometryNormal, vec3(0.0, 0.76, 0.65)));
  float turfRock = smoothstep(2.5, 2.9, vSurf.x);
  float turfLift = normalize(vObjN).y;
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${SKIRT_FILL.toFixed(2)} * turfBank * (0.04 + 0.96 * turfCatch * turfCatch) * (0.5 + 0.5 * smoothstep(-0.8, 0.0, turfLift)) * (1.0 - 0.85 * smoothstep(0.04, 0.5, vSurf.y)) + ${ROCK_FILL.toFixed(2)} * turfRock * (0.3 + 0.7 * smoothstep(-0.2, 0.7, turfLift)))) * material.diffuseContribution;
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${TURF_LOOK.fuzz.toFixed(2)} * turfFuzz * stageWrap(dot(geometryNormal, stageKeyL), 1.0)) * material.diffuseContribution;
}`,
      )
    },
  })
}

function growthMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
    change: 'miniature',
    key: 'village-growth-spring',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${BUMP_GLSL}`)
        .replace('#include <normal_fragment_maps>', 'normal = normalize(vNormal);')
      afterLight(
        shader,
        `${NEAR_LIGHT}
{
  vec3 growthLit = stageWrapped(geometryNormal, ${GROWTH_LOOK.wrap.toFixed(2)}) + stageKeyC * (RECIPROCAL_PI * ${GROWTH_LOOK.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 1.0));
  growthLit += stageThrough(geometryNormal, geometryViewDir, ${GROWTH_LOOK.thin.toFixed(2)}, ${GROWTH_LOOK.tight.toFixed(1)}) * (vSurf.y * ${GROWTH_LOOK.through.toFixed(2)});
  reflectedLight.directDiffuse += growthLit * material.diffuseContribution;
}`,
      )
    },
  })
}

function waterMaterial(): THREE.MeshStandardMaterial {
  const mirrors = [{ at: mirrored, strength: MIRROR.lamp }, { at: anchors.window, strength: MIRROR.pane }, { at: anchors.sideWindow, strength: MIRROR.pane }]
  const rings = drops.map((d, i) => `waterRing(p, vec2(${d[0].toFixed(3)}, ${d[2].toFixed(3)}), ${d[1].toFixed(3)}, ${(1 - 0.36 * i).toFixed(2)})`).join(' + ')
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(WATER),
    roughness: WATER_LOOK.rough,
    metalness: 0,
    change: 'miniature',
    key: 'village-water-spring',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uWaterClock: clock }, mirrorUniforms(mirrors))
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
${MIRROR_GLSL}
uniform float uWaterClock;
vec3 waterFlat = vec3(0.0, 0.0, 1.0);
float waterShade = 0.0;
float waterRing(vec2 p, vec2 c, float phase, float amp) {
  float d = length(p - c);
  float front = d / ${RIPPLE.waveMm.toFixed(2)} - uWaterClock * ${RIPPLE.laps.toFixed(1)} - phase;
  float fade = exp(-d / ${RIPPLE.reachMm.toFixed(1)}) * smoothstep(0.0, 1.2, d);
  return amp * fade * sin(6.2831853 * front);
}
float waterRings(vec2 p) {
  return ${rings};
}
float waterHeight(vec2 p) {
  vec2 uv = p * ${(1 / tileMm()).toFixed(6)};
  float chop = texture2D(map, uv * 1.7 + vec2(uWaterClock * ${RIPPLE.drift.toFixed(1)}, 0.0)).r + texture2D(map, uv * 2.3 - vec2(0.0, uWaterClock * ${RIPPLE.drift.toFixed(1)})).g;
  return ${RIPPLE.heightMm.toFixed(3)} * waterRings(p) + ${RIPPLE.chopMm.toFixed(3)} * chop;
}
float waterStreak(vec3 n, vec3 sight) {
  vec3 r = reflect(-sight, n);
  vec3 to = normalize(${glsl(flame as Rgb)} - vStageLocal);
  vec3 across = normalize(cross(vec3(0.0, 1.0, 0.0), to));
  vec3 m = r - to;
  float s = dot(m, across);
  float q = max(dot(m, m) - s * s, 0.0);
  return exp(-s * s / ${(STREAK.side * STREAK.side).toFixed(5)}) * exp(-q / ${(STREAK.along * STREAK.along).toFixed(5)});
}
float waterCrown(vec3 from, vec3 r) {
  vec3 o = (from - ${glsl(CROWN_MIRROR.centre)}) / ${glsl(CROWN_MIRROR.r)};
  vec3 d = r / ${glsl(CROWN_MIRROR.r)};
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float h = b * b - a * c;
  if (h <= 0.0 || b > 0.0) return 0.0;
  float chord = 2.0 * sqrt(h) / a * length(d);
  return smoothstep(0.0, 1.1, chord);
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
vec3 waterT = texture2D(map, vMapUv * 0.9 + 0.13).rgb;
float waterEdge = smoothstep(0.78, 0.985, vSurf.x + 0.03 * (waterT.g - 0.5));
diffuseColor.rgb = mix(${glsl(tones.waterDeep)}, ${glsl(tones.bed)}, waterEdge * 0.85);
`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = ${WATER_LOOK.rough.toFixed(3)};`)
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  vec2 waterP = vStageLocal.xz;
  float waterH = waterHeight(waterP);
  vec2 waterDh = vec2(waterHeight(waterP + dFdx(waterP)) - waterH, waterHeight(waterP + dFdy(waterP)) - waterH);
  waterFlat = normal;
  normal = villageBump(-vViewPosition, normal, waterDh, faceDirection);
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
  vec3 waterMirror = villageInside(normalize(mix(waterFlat, normal, ${MIRROR.bump.toFixed(2)})));
  vec3 waterR = reflect(-waterSight, waterMirror);
  float waterGlint = villageMirror(waterMirror, waterSight, ${MIRROR.tight.toFixed(5)}, ${MIRROR.wide.toFixed(5)}, ${MIRROR.wideShare.toFixed(3)});
  waterShade = max(${WATER_LOOK.post.toFixed(2)} * villagePost(waterMirror, waterSight, ${glsl(postFoot)}, ${WATER_LOOK.postMm.toFixed(2)}, ${WATER_LOOK.postTall.toFixed(1)}), ${WATER_LOOK.trunk.toFixed(2)} * villagePost(waterMirror, waterSight, ${glsl(trunkFoot)}, ${WATER_LOOK.trunkMm.toFixed(2)}, ${WATER_LOOK.trunkTall.toFixed(1)}));
  float waterPink = waterCrown(vStageLocal, waterR) * (1.0 - waterShade);
  float waterBand = waterRings(vStageLocal.xz);
  vec3 waterSky = clamp(1.0 + ${RING_SHOW.toFixed(2)} * waterBand, 0.12, 2.8) * mix(${glsl(WATER_LOOK.far)}, ${glsl(tones.waterPale)} * (${WATER_LOOK.sky.toFixed(2)} * (0.3 + 1.3 * smoothstep(-0.05, 0.5, waterR.y))), smoothstep(${WATER_LOOK.farFrom.toFixed(2)}, ${WATER_LOOK.farTo.toFixed(2)}, waterR.y)) * (1.0 - 0.8 * waterPink);
  totalEmissiveRadiance += (waterSky + ${glsl(CROWN_MIRROR.tone)} * (${WATER_LOOK.crown.toFixed(2)} * waterPink)) * (0.25 + 0.75 * waterFresnel) * (1.0 - 0.6 * waterShade) * (1.0 - 0.7 * waterEdge) * dot(stageKeyC + vec3(0.6), vec3(0.3333));
  float waterLine = ${STREAK.strength.toFixed(1)} * waterStreak(villageInside(normalize(mix(waterFlat, normal, ${STREAK.bump.toFixed(2)}))), waterSight) * (1.0 - waterEdge) * clamp(1.0 + ${STREAK.rings.toFixed(2)} * waterBand, 0.08, 2.0);
  totalEmissiveRadiance += ${glsl(tones.lamp)} * (waterGlint + waterLine) * (0.2 + 0.8 * waterFresnel) * uGlowGain;
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * ${WATER_LOOK.near.toFixed(2)}) * material.diffuseContribution;\nreflectedLight.indirectSpecular *= ${WATER_LOOK.room.toFixed(2)} * (1.0 - waterShade);\nreflectedLight.directDiffuse *= 1.0 - ${WATER_LOOK.body.toFixed(2)} * waterShade;`)
    },
  })
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

export function build(): THREE.Object3D {
  const walls = shadowed(new THREE.Mesh(withSurface(villageGeometry('solid').clone(), nearWall), surfaceMaterial({ part: PART, map: villageGrain(), gain, cover: mossy, key: 'village-solid-spring', fill: WALL_FILL })))
  const turf = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'turf'), near), turfMaterial()), false)
  const growth = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'growth'), nearGrowth), growthMaterial()), false)
  const water = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'water'), near), waterMaterial()), false)
  return new THREE.Group().add(walls, turf, growth, water)
}

export function lights(): THREE.Object3D {
  const pieces = [
    glowPiece(villageGeometry('lamp-glass'), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1]),
    glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2]),
  ]
  const look = { bulb: 1.7, bulbCore: 3.4, glass: LAMP_GLASS, flame: tones.flame.map((v) => v * 6) as unknown as Rgb, room: tones.room.map((v) => v * 1.6) as unknown as Rgb, curtain: tones.curtain.map((v) => v * 2) as unknown as Rgb, frost: tones.pane.map((v) => v * 0.3) as unknown as Rgb, frostAmount: 0.06, flicker: 0.08, cycles: 3, through: THROUGH, paneHot: 0.14 }
  const lit = (x: number, z: number): [number, number, number] => [x, groundAt(x, z) + 1.5, z]
  const pools = [lit(flame[0] + 0.4, flame[2] + 1.6), lit(anchors.door[0] * 0.75 + flame[0] * 0.25, anchors.door[2] * 0.75 + flame[2] * 0.25)]
  const halos = new THREE.Mesh(
    haloGeometry([flame, anchors.window, anchors.sideWindow, ...pools], HALO.radiusMm, [HALO_KIND.lamp, HALO_KIND.pane, HALO_KIND.pane, ...pools.map(() => HALO_KIND.pool)], HALO.wide),
    haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, HALO, clock, storm),
  )
  halos.renderOrder = 3
  const spark = new THREE.Mesh(haloGeometry([flame], SPARK.radiusMm, [SPARK_KIND], SPARK.wide), haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, SPARK, clock))
  spark.renderOrder = 4
  return new THREE.Group().add(new THREE.Mesh(glowGeometry(pieces), glowMaterial(LIGHT, look, clock)), halos, spark)
}

const keep = (role: string): boolean => !isTree(role) && role !== 'ground' && role !== 'pond'
const SHORE = { from: 0.93, to: 1.035, underMm: 0.5 }

export const waterLevel = (z: number): number => moundAt(z) - pond.level

function groundDistance(x: number, y: number, z: number): number {
  const t = Math.min(1, Math.max(0, (pondField(x, z) - SHORE.from) / (SHORE.to - SHORE.from)))
  const lip = t * t * (3 - 2 * t)
  const mound = moundAt(z)
  const top = Math.max(mound - (pond.level + SHORE.underMm) * (1 - lip), mound - pond.level)
  return (y - top) / Math.sqrt(1 + moundSlope(z) * moundSlope(z))
}

let rocks: number[][] | null = null

function boulderDistance(x: number, y: number, z: number): number {
  rocks ??= (geometry(MODEL, 'water').userData.extras as { boulders?: number[][] } | undefined)?.boulders ?? []
  let d = 1e9
  for (const b of rocks) {
    const squash = Math.min(1, b[4]! / b[3]!)
    const v = (Math.hypot(x - b[0]!, (y - b[1]!) / squash, z - b[2]!) - b[3]!) * squash
    if (v < d) d = v
  }
  return d
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(solidDistance(x, y, z, keep), shrubDistance(x, y, z), groundDistance(x, y, z), boulderDistance(x, y, z))
}

export function update(moment: KitMoment): void {
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  gain.value = gainOf(innerLights, moment.time, moment.period)
}
