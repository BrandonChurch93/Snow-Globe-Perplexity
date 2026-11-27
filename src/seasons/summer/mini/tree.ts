import * as THREE from 'three'
import { stageMaterial, stageShader } from '../../../core/materials'
import { afterLight } from '../../../core/chunks/light'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { haloGeometry } from '../../../miniature/glow'
import { lampFlame } from '../../../miniature/roof'
import { crownOffset, foot, glow, glowHook, glowing, padAxes, placePoint, placing, prepareTrunk, trunkMaking, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import { ROW } from '../../../scene/steps'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { clumps, crownPads, leafField, newHit, wind, winding, type Xyz } from './crown'
import { lanterns, type Lantern } from './lanterns'
import { season, tones } from './palette'

type Shader = THREE.WebGLProgramParametersWithUniforms
type Rgb3 = [number, number, number]

const MODEL = 'summer/tree-summer.glb'
const LEAVES = 'summer/tree-leaves.srgb.tile.w1024.png'
const SPRIGS = 'summer/tree-sprigs.srgb.w512.png'
const CYCLES = 3
const FLICKER = 0.06
const PAPER = { power: 0.26, reachMm: 2.5 }
const GLOW = { leaves: { power: 0.5, reachMm: 4.5 }, wood: { power: 0.1, reachMm: 9 } }
const LAMP_ON_WOOD = { power: 0.45, reachMm: 14, wrap: -0.2 }
const LAMP_ON_LEAVES = { power: 0.8, reachMm: 12, wrap: 0.1 }
const LAMP_SHIFT: Vec3 = [-3, 0, -5]
const FILL_ON_WOOD = { power: 0.15, reachMm: 1000, wrap: 0.4 }
const FILL_ON_LEAVES = { power: 0.03, reachMm: 1000, wrap: 0.3 }
const FILL_FROM: Vec3 = [30, 60, 60]
const BARK: Rgb3 = [0.26, 0.152, 0.09]
// The wood keeps the shared trunk's girth at the waist. What this season adds is the foot: under the waist each vertex moves out
// along its normal, by a length (millimetres, against the height over the ground) that grows toward the ground, so that the stem
// flares into its roots over the grass, to about twice its waist. The limbs wind and the stem bends in a slow S (`winding`, in
// crown.ts). `STEM` says what counts as stem for the low sun's rim.
const FOOT_FLARE: readonly (readonly [number, number])[] = [[1.9, 3.1], [3.4, 2.0], [4.8, 1.0], [6.3, 0.35], [7.8, 0]]
// The foot reaches farther to the left than to the right, as a root that runs along the ground does.
const FOOT_LEFT = 0.15
const STEM = { fromMm: 6, toMm: 22, nearMm: 5, farMm: 15, limb: 0.85 }
const BARK_BUMP = 3.4
// The bark: long flutes down the wood (the bark map drawn out along the grain), dark in their grooves, with the low sun
// on the edge of the wood that faces it and moss on what faces up near the ground.
const WOOD = { relief: 0.95, ridges: 5, warp: 2.6, fine: 0.4, low: 0.55, high: 1.35, from: 0.15, to: 0.85, depthMm: 1.5, rim: 150.0, rimTight: 2.6, rimFrom: -0.2, rimTo: 0.5, side: 0.1, wrap: 0.95, air: [0.045, 0.0375, 0.034] as Rgb3, haze: [0.011, 0.0085, 0.0055] as Rgb3, pool: 1.5, poolReachMm: 4.5, poolWrap: 0.3, poolFrom: [-2.2, 0, 0.5] as Vec3, arms: 3.0, armsReach: 1.5, armsWrap: 0.9, armsFrom: 0.7, armsTo: 1.8, top: 0.45, mossTo: 5.5, moss: 0.45 }
const MOSS: Rgb3 = [0.3, 0.52, 0.12]
const ROOT_MM = 4.5
const LEAF_TINT: Rgb3 = [1, 1, 1]
const LEAF_LIT = 'vec3(1.5, 0.9, 0.45)'
const glsl3 = (c: Rgb3): string => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`
const LEAF_VARY = { big: 0.36, mid: 1.15, scaleLow: 0.56, scale: 0.4, cool: [0.8, 0.94, 1.02] as Rgb3, warm: [1.06, 1.04, 0.9] as Rgb3 }
// A leaf's tone runs from the dark between the leaves to the bright of a leaf's face, by the map's own light (one over each map's mean stands in `gain`).
// The maps are read close to their own sharpness (`lod`), so that single leaves stay crisp at the hero's size.
const LEAF_TONE = { deep: [0.0095, 0.011, 0.0068] as Rgb3, high: [0.045, 0.06, 0.033] as Rgb3, from: 0.15, to: 2.4, gain: { body: 18.6, sprig: 7.9 }, lod: { body: 0.4, sprig: 0.4 }, bump: 0.5 }
// Each clump is a dark body, lit as one: its top and the side toward the low sun are a little brighter, what is underneath is in shade. The low sun
// behind the tree lies on each clump's outline where that is turned to it (the clump's own rounded body decides, with little of the single lump, `hem`):
// the tips of the tufts there are lit yellow green (`fringe`) and a few of the brightest leaves on them stand out as points (`rim`), low in the crown as high
// (`rimBelow`). The lamp's gold points stay off (`lamp`).
const PAD = { soft: 7, round: 0.7, upFrom: -0.75, upTo: 0.55, under: 0.22, sky: [1.3, 1.38, 1.15] as Rgb3, ground: [0.43, 0.36, 0.23] as Rgb3, light: 1.7, wrap: 0.7, shade: 0.45, rim: 60.0, cap: 7.0, fringe: 0.4, patchFrom: 0.25, patchTo: 0.55, even: 0.1, hem: 0.5, rimTight: 6.0, rimFrom: -0.2, rimTo: 0.45, rimTone: [1.0, 0.72, 0.14] as Rgb3, rimShut: 0.45, tipFrom: 0.45, tipTo: 0.9, tipBody: 0.3, rimBelow: 1.0, leafFrom: 0.4, leafTo: 2.0, gold: [1.0, 0.62, 0.14] as Rgb3, speckFrom: 1.3, speckTo: 2.4, inFrom: 0.5, inTo: 0.9, openFrom: 0.5, openTo: 0.9, closed: 0.3, lamp: 0.0, lampFrom: 1.8, lampTo: 4.5, dapEven: 0.15, dapLowAt: 24, dapHighAt: 36, lightShut: 0.5, warm: 0.14, warmLobe: 0.35, warmTone: [0.5, 0.3, 0.1] as Rgb3, warmFrom: 0.5, warmTo: 3.0, haze: [0.016, 0.0165, 0.0095] as Rgb3 }
// The leaf is in rounded lobes, each `mm` across. A lobe is a form in the light the clump already has: its top, turned up and to the left where
// the sky's light comes from (`light`), takes more of it (`bright`) and it falls to dark underneath and in the seams between lobes (`dark`, `seam`),
// so that the body stays as dark as it was. On the tops of the clumps the lobes' tops are a little pale as well (`tone`, `top`).
const LOBE = { mm: 1.8, seam: 0.24, from: -0.3, to: 0.8, dark: 0.2, bright: 3.2, top: 1.4, tone: [0.9, 1.0, 0.62] as Rgb3, light: [-0.497, 0.795, 0.348] as Vec3 }
// The large lantern at the fork lights the lobes nearest to it from below: the side of each lobe that is turned to it, most under the clumps (`top` is what their tops keep).
const LEAF_POOL = { power: 5.0, reachMm: 3.6, from: -0.2, to: 0.8, top: 0.25 }
const LANTERN = { rib: 0.3, gores: 12, ring: 0.16, ribs: 26, gain: 0.95, body: 0.5, core: 5.0, tight: 2.2, paper: 0.06, dim: 0.4, first: 2, firstStepS: 0.23, firstRampS: 0.42, stepS: 0.6, rampS: 0.8, swayRad: 0.045, sway2: 0.6, kickRad: 0.16, kickFade: 1.2, kickHz: 1.3, cycles: 2 }
// The sky a leaf looks for stands up and to the right of the crown, a little toward the lens. A clump counts as a rounded body a
// little inside its leaves (`side`, `top` and `under` are what it keeps of the leaves' reach beyond the clump's own size).
const OPEN = { toward: [0.4575, 0.8642, 0.2087] as Vec3, side: 0.3, top: 1.2, under: 1.4, skinMm: 0.25, fromMm: 0.4, toMm: 2.4 }
const HALO = { radius: 2.9, strength: 0.17, hot: 0.0 }
const HALO_EDGE: Rgb3 = [0.9, 0.36, 0.08]
const HALO_CORE: Rgb3 = [1, 0.7, 0.34]

const offset = crownOffset()
const sway = { value: new THREE.Vector4(0, 100, LANTERN.swayRad, LANTERN.kickRad) }
const paper = (l: Lantern): Rgb3 => (l.tone === 'cream' ? tones.creamLight : tones.paperLight) as Rgb3

export const innerLights: InnerLight[] = lanterns.map((l): InnerLight => ({ at: l.at, color: paper(l), power: PAPER.power * l.radius * l.radius, reachMm: PAPER.reachMm * l.radius, flicker: FLICKER, cycles: CYCLES, phase: l.phase }))

// The first two lanterns are up as the globe lands. The others follow one by one, each a step after the last, while the storm thins.
export function lanternRise(order: number): { start: number; ramp: number; dim: number } {
  if (order < LANTERN.first) return { start: order * LANTERN.firstStepS, ramp: LANTERN.firstRampS, dim: LANTERN.dim }
  return { start: LANTERN.firstRampS + (order - LANTERN.first) * LANTERN.stepS, ramp: LANTERN.rampS, dim: LANTERN.dim }
}

const LEVEL_GLSL = `
uniform vec4 uSway;
float lanternLevel(float order) {
  float late = step(${(LANTERN.first - 0.5).toFixed(1)}, order);
  float start = mix(order * ${LANTERN.firstStepS.toFixed(4)}, ${LANTERN.firstRampS.toFixed(4)} + (order - ${LANTERN.first.toFixed(1)}) * ${LANTERN.stepS.toFixed(4)}, late);
  return mix(${LANTERN.dim.toFixed(3)}, 1.0, smoothstep(0.0, mix(${LANTERN.firstRampS.toFixed(3)}, ${LANTERN.rampS.toFixed(3)}, late), uSway.y - start));
}
`

const TREE_GLSL = `
uniform float uTile;
uniform float uBump;
varying vec3 vTreeP;
varying vec3 vTreeN;
vec4 treeTri(sampler2D t, vec3 p, vec3 n, float lod) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= w.x + w.y + w.z;
  return texture2D(t, p.zy, lod) * w.x + texture2D(t, p.xz, lod) * w.y + texture2D(t, p.xy, lod) * w.z;
}
vec3 treeHash(vec3 c) {
  uvec3 q = uvec3(ivec3(c) + 512);
  uint n = (q.x * 1597334673u) ^ (q.y * 3812015801u) ^ (q.z * 2798796415u);
  n = (n ^ (n >> 15u)) * 2246822519u;
  uvec3 r = uvec3(n, n * 3266489917u, n * 668265263u);
  r ^= r >> 13u;
  r *= 1274126177u;
  r ^= r >> 16u;
  return vec3(r) * (1.0 / 4294967295.0);
}
// The lobe a point lies in: the way to it from that lobe's middle (in lobes), and how far it is from the seam with the next lobe.
vec4 treeLobes(vec3 p) {
  vec3 base = floor(p - 0.5);
  vec3 f = p - base;
  float d1 = 1e9;
  float d2 = 1e9;
  vec3 way = vec3(0.0);
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));
    vec3 d = f - (o + 0.25 + 0.5 * treeHash(base + o));
    float q = dot(d, d);
    if (q < d1) {
      d2 = d1;
      d1 = q;
      way = d;
    } else if (q < d2) d2 = q;
  }
  return vec4(way, sqrt(d2) - sqrt(d1));
}
vec3 treeBump(vec3 sx, vec3 sy, vec2 dh, vec3 n, float face) {
  vec2 len = max(vec2(length(sx), length(sy)), vec2(1e-5));
  vec2 d = clamp(dh * uBump / len, vec2(-2.0), vec2(2.0));
  sx /= len.x;
  sy /= len.y;
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * face;
  vec3 v = abs(det) * n - sign(det) * (d.x * r1 + d.y * r2);
  return dot(v, v) > 0.0 ? normalize(v) : n;
}
`

function leafHook(shader: Shader): void {
  glowHook(shader, `(material.diffuseContribution * ${LEAF_LIT} + ${glsl3(PAD.gold)} * (${PAD.lamp.toFixed(2)} * treeSpeck * smoothstep(${PAD.lampFrom.toFixed(2)}, ${PAD.lampTo.toFixed(2)}, vGlow.r)))`)
  Object.assign(shader.uniforms, { uTile: { value: 1 / tileOf('leaves') }, uBump: { value: LEAF_TONE.bump }, uSprigs: { value: texture(SPRIGS) }, uSway: sway })
  const fork = lanterns.reduce((a, b) => (b.radius > a.radius ? b : a))
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 uv1;\nattribute vec4 aPad;\nvarying vec2 vCard;\nvarying vec3 vTreeP;\nvarying vec3 vTreeN;\nvarying vec3 vPadN;\nvarying vec2 vPad;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCard = uv1;\nvTreeP = position;\nvTreeN = normal;\nvPadN = normalMatrix * aPad.xyz;\nvPad = vec2(aPad.y, aPad.w);')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}\n${LEVEL_GLSL}\nuniform sampler2D uSprigs;\nvarying vec2 vCard;\nvarying vec3 vPadN;\nvarying vec2 vPad;`)
    .replace(
      '#include <map_fragment>',
      `// Two slow waves through the crown: each spray of leaves gets its own scale of leaf and its own tone, so that no two pads read as copies.
      float treeBig = 0.5 + 0.5 * sin(vTreeP.x * ${LEAF_VARY.big.toFixed(2)} + 1.7 * sin(vTreeP.y * ${(LEAF_VARY.big * 0.8).toFixed(3)} + 0.6)) * sin(vTreeP.z * ${(LEAF_VARY.big * 0.9).toFixed(3)} + 1.3 * sin(vTreeP.x * ${(LEAF_VARY.big * 0.7).toFixed(3)}) + 2.1);
      float treeMid = 0.5 + 0.5 * sin(vTreeP.x * ${LEAF_VARY.mid.toFixed(2)} + vTreeP.y * ${(LEAF_VARY.mid * 0.7).toFixed(3)} + 0.4) * sin(vTreeP.z * ${(LEAF_VARY.mid * 0.85).toFixed(3)} - vTreeP.y * ${(LEAF_VARY.mid * 0.55).toFixed(3)} + 1.9);
      bool treeCard = vCard.x > 0.5;
      vec4 treeC = treeCard ? texture2D(uSprigs, vMapUv, ${LEAF_TONE.lod.sprig.toFixed(2)}) : treeTri(map, vTreeP * (uTile * (${LEAF_VARY.scaleLow.toFixed(2)} + ${LEAF_VARY.scale.toFixed(2)} * treeBig)), normalize(vTreeN), ${LEAF_TONE.lod.body.toFixed(2)});
      float treeLum = dot(treeC.rgb, vec3(0.3, 0.6, 0.1)) * (treeCard ? ${LEAF_TONE.gain.sprig.toFixed(1)} : ${LEAF_TONE.gain.body.toFixed(1)});
      float treeIn = treeC.a;
      float treeSpeck = treeCard ? smoothstep(${PAD.speckFrom.toFixed(2)}, ${PAD.speckTo.toFixed(2)}, treeLum) * smoothstep(${PAD.inFrom.toFixed(2)}, ${PAD.inTo.toFixed(2)}, treeIn) : 0.0;
      float treeH = treeLum * 0.22;
      vec3 treeSx = dFdx(-vViewPosition);
      vec3 treeSy = dFdy(-vViewPosition);
      vec2 treeDh = vec2(dFdx(treeH), dFdy(treeH));
      diffuseColor.rgb *= mix(${glsl3(LEAF_TONE.deep)}, ${glsl3(LEAF_TONE.high)}, smoothstep(${LEAF_TONE.from.toFixed(2)}, ${LEAF_TONE.to.toFixed(2)}, treeLum)) * mix(${glsl3(LEAF_VARY.cool)}, ${glsl3(LEAF_VARY.warm)}, 0.6 * treeBig + 0.4 * treeMid);`,
    )
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nif (vCard.x > 0.5) normal *= faceDirection;')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = treeBump(treeSx, treeSy, treeDh, normal, faceDirection);')
    // A card is cut last. A pixel that is cut stops being worked out, and the lighting after it reads its neighbours' numbers
    // (the slope of the normal, of the shadow's place): cut early, the edge of every sprig was lit from numbers nobody set.
    .replace(/\}\s*$/, 'if (treeCard && treeC.a < 0.5) discard;\n}')
  afterLight(
    shader,
    `{
  vec3 treeV = normalize(vViewPosition);
  vec3 treePad = normalize(vPadN);
  vec3 treeRound = normalize(treePad + ${PAD.round.toFixed(2)} * normalize(vNormal));
  float treeUp = smoothstep(${PAD.upFrom.toFixed(2)}, ${PAD.upTo.toFixed(2)}, vPad.x);
  float treeSky = mix(${PAD.closed.toFixed(2)}, 1.0, vCard.y);
  float treeToSun = dot(treeRound, stageKeyL);
  float treeSide = stageWrap(treeToSun, ${PAD.wrap.toFixed(2)});
  vec3 treeTone = material.diffuseContribution;
  vec4 treeLobe = treeLobes(vTreeP * ${(1 / LOBE.mm).toFixed(4)});
  float treeTop = smoothstep(${LOBE.from.toFixed(2)}, ${LOBE.to.toFixed(2)}, 2.0 * dot(treeLobe.xyz, ${glsl3(LOBE.light as Rgb3)})) * smoothstep(0.0, ${LOBE.seam.toFixed(2)}, treeLobe.w);
  float treeForm = mix(${LOBE.dark.toFixed(2)}, ${LOBE.bright.toFixed(2)}, treeTop);
  reflectedLight.directDiffuse *= mix(${PAD.under.toFixed(2)}, 1.0, treeUp) * treeForm;
  reflectedLight.indirectDiffuse *= mix(${PAD.under.toFixed(2)}, 1.0, treeUp) * treeForm;
  reflectedLight.indirectDiffuse += treeTone * mix(${glsl3(PAD.ground)}, ${glsl3(PAD.sky)}, treeUp) * treeForm + ${glsl3(PAD.haze)};
  reflectedLight.directDiffuse += stageKeyC * treeTone * (RECIPROCAL_PI * ${PAD.light.toFixed(2)} * treeForm * treeSide * treeSide * treeSky * mix(${PAD.lightShut.toFixed(2)}, 1.0, vPad.y) * mix(${PAD.shade.toFixed(2)}, 1.0, stageKeyS));
  float treeTurn = smoothstep(${PAD.rimFrom.toFixed(2)}, ${PAD.rimTo.toFixed(2)}, treeToSun);
  float treeOpen = smoothstep(${PAD.openFrom.toFixed(2)}, ${PAD.openTo.toFixed(2)}, vCard.y);
  float treeHem = pow(clamp(1.0 - dot(normalize(treePad + ${PAD.hem.toFixed(2)} * normalize(vNormal)), treeV), 0.0, 1.0), ${PAD.rimTight.toFixed(1)});
  float treeInside = treeCard ? smoothstep(${PAD.inFrom.toFixed(2)}, ${PAD.inTo.toFixed(2)}, treeIn) : 1.0;
  float treeLeaf = mix(${PAD.even.toFixed(2)}, 1.0, smoothstep(${PAD.leafFrom.toFixed(2)}, ${PAD.leafTo.toFixed(2)}, treeLum)) * treeInside;
  float treeDot = treeCard ? smoothstep(${PAD.speckFrom.toFixed(2)}, ${PAD.speckTo.toFixed(2)}, treeLum) * smoothstep(${PAD.inFrom.toFixed(2)}, ${PAD.inTo.toFixed(2)}, treeIn) : 0.0;
  float treeHigh = smoothstep(${(PAD.dapLowAt + offset[1]).toFixed(2)}, ${(PAD.dapHighAt + offset[1]).toFixed(2)}, vTreeP.y);
  reflectedLight.directDiffuse += stageKeyC * treeTone * ${glsl3(LOBE.tone)} * (${LOBE.top.toFixed(2)} * treeTop * treeTop * treeSky * mix(${PAD.lightShut.toFixed(2)}, 1.0, vPad.y) * treeUp * treeUp * mix(${PAD.shade.toFixed(2)}, 1.0, stageKeyS));
  vec3 treeTo = ${v3(fork.at)} - vTreeP;
  float treeFar = max(length(treeTo), 1e-3);
  float treePool = pow(clamp(1.0 - treeFar / ${(LEAF_POOL.reachMm * fork.radius).toFixed(2)}, 0.0, 1.0), 2.0) * smoothstep(${LEAF_POOL.from.toFixed(2)}, ${LEAF_POOL.to.toFixed(2)}, 2.0 * dot(treeLobe.xyz, treeTo / treeFar)) * smoothstep(0.0, ${LOBE.seam.toFixed(2)}, treeLobe.w) * mix(1.0, ${LEAF_POOL.top.toFixed(2)}, treeUp);
  reflectedLight.indirectDiffuse += treeTone * ${glsl3(paper(fork))} * (${LEAF_POOL.power.toFixed(2)} * treePool * lanternLevel(${fork.order.toFixed(1)}));
  reflectedLight.indirectDiffuse += vGlow.rgb * uTwinkle.z * ${glsl3(PAD.warmTone)} * (${PAD.warm.toFixed(3)} * mix(1.0, ${PAD.warmLobe.toFixed(2)}, treeTop) * (1.0 - treeUp) * (1.0 - treeUp) * smoothstep(${PAD.warmFrom.toFixed(2)}, ${PAD.warmTo.toFixed(2)}, vGlow.r) * mix(${PAD.dapEven.toFixed(2)}, 1.0, smoothstep(${PAD.leafFrom.toFixed(2)}, ${PAD.leafTo.toFixed(2)}, treeLum)));
  reflectedLight.directDiffuse += stageKeyC * ${glsl3(PAD.rimTone)} * (min(${PAD.cap.toFixed(2)}, treeHem * treeTurn * smoothstep(${PAD.patchFrom.toFixed(2)}, ${PAD.patchTo.toFixed(2)}, treeMid) * mix(${PAD.rimShut.toFixed(2)}, 1.0, treeOpen) * mix(${PAD.rimBelow.toFixed(2)}, 1.0, treeHigh) * (${PAD.fringe.toFixed(2)} * treeLeaf + ${PAD.rim.toFixed(2)} * treeDot) * (treeCard ? smoothstep(${PAD.tipFrom.toFixed(2)}, ${PAD.tipTo.toFixed(2)}, fract(vMapUv.y * 1.999)) : ${PAD.tipBody.toFixed(2)})) * mix(${PAD.shade.toFixed(2)}, 1.0, stageKeyS));
}`,
  )
}

function woodHook(shader: Shader, groundY: number): void {
  glowHook(shader, undefined, WOOD.relief)
  Object.assign(shader.uniforms, { uTile: { value: 1 }, uBump: { value: WOOD.depthMm }, uSway: sway })
  const fork = lanterns.reduce((a, b) => (b.radius > a.radius ? b : a))
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aStem;\nvarying vec3 vTreeP;\nvarying vec3 vTreeN;\nvarying float vStem;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTreeP = position;\nvTreeN = normal;\nvStem = aStem;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}\n${LEVEL_GLSL}\nvarying float vStem;\nfloat woodH = 0.0;`)
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
{
  float woodA = dot(texture2D(map, vMapUv * vec2(0.3333, 0.07)).rgb, vec3(0.3, 0.6, 0.1));
  float woodB = dot(texture2D(map, vMapUv * vec2(1.0, 0.35) + 0.31).rgb, vec3(0.3, 0.6, 0.1));
  float woodWave = 0.5 + 0.5 * sin(6.2831853 * (vMapUv.x * ${WOOD.ridges.toFixed(1)} + ${WOOD.warp.toFixed(2)} * woodA + 0.5 * sin(vMapUv.y * 1.3) + 0.25 * sin(vMapUv.y * 3.1 + 1.0)));
  woodH = smoothstep(${WOOD.from.toFixed(2)}, ${WOOD.to.toFixed(2)}, mix(woodWave, woodB * 2.2, ${WOOD.fine.toFixed(2)}));
  diffuseColor.rgb *= mix(${WOOD.low.toFixed(2)}, ${WOOD.high.toFixed(2)}, woodH);
  float woodMoss = ${WOOD.moss.toFixed(2)} * (1.0 - smoothstep(${(groundY + 1).toFixed(2)}, ${(groundY + WOOD.mossTo).toFixed(2)}, vTreeP.y + 2.5 * woodB)) * smoothstep(-0.25, 0.45, normalize(vTreeN).y + 0.5 * (woodA - 0.3));
  diffuseColor.rgb = mix(diffuseColor.rgb, ${v3(MOSS)} * (0.25 + 1.5 * woodB), woodMoss);
}`,
    )
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = treeBump(dFdx(-vViewPosition), dFdy(-vViewPosition), vec2(dFdx(woodH), dFdy(woodH)), normal, faceDirection);')
  afterLight(
    shader,
    `{
  vec3 woodTone = material.diffuseContribution;
  reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${WOOD.side.toFixed(2)} * stageWrap(dot(normal, stageKeyL), ${WOOD.wrap.toFixed(2)}))) * woodTone;
  reflectedLight.indirectDiffuse += woodTone * ${glsl3(WOOD.air)} + ${glsl3(WOOD.haze)};
  // The low sun lies on the side of the stem that is turned from the lens and toward it, wide and soft. A limb is too thin to carry it: there it drew a bright rope.
  vec3 woodRound = normalize(mix(normal, normalize(vNormal) * faceDirection, 0.85));
  float woodEdge = pow(clamp(1.0 - dot(woodRound, normalize(vViewPosition)), 0.0, 1.0), ${WOOD.rimTight.toFixed(1)});
  reflectedLight.directDiffuse += stageKeyC * woodTone * (${WOOD.rim.toFixed(2)} * vStem * woodEdge * smoothstep(${WOOD.rimFrom.toFixed(2)}, ${WOOD.rimTo.toFixed(2)}, dot(woodRound, stageKeyL)));
  vec3 woodTo = ${v3([fork.at[0] + WOOD.poolFrom[0], fork.at[1] + WOOD.poolFrom[1], fork.at[2] + WOOD.poolFrom[2]])} - vTreeP;
  float woodFar = max(length(woodTo), 1e-3);
  // Over the large lantern its light climbs the arms: there it reaches farther and lies on more of each arm's round, so that the wood in the notch about the stem is lit.
  float woodOver = smoothstep(${(WOOD.armsFrom * fork.radius).toFixed(2)}, ${(WOOD.armsTo * fork.radius).toFixed(2)}, -woodTo.y);
  float woodPool = pow(clamp(1.0 - woodFar / (${(WOOD.poolReachMm * fork.radius).toFixed(2)} * mix(1.0, ${WOOD.armsReach.toFixed(2)}, woodOver)), 0.0, 1.0), 2.0) * stageWrap(dot(normalize(vTreeN), woodTo / woodFar), mix(${WOOD.poolWrap.toFixed(2)}, ${WOOD.armsWrap.toFixed(2)}, woodOver));
  reflectedLight.indirectDiffuse += woodTone * ${glsl3(paper(fork))} * (${WOOD.pool.toFixed(2)} * mix(1.0, ${WOOD.arms.toFixed(2)}, woodOver) * woodPool * lanternLevel(${fork.order.toFixed(1)}));
  reflectedLight.directDiffuse += stageKeyC * woodTone * (${WOOD.top.toFixed(2)} * smoothstep(0.15, 0.9, normalize(vTreeN).y));
}`,
  )
}

function lanternHook(shader: Shader): void {
  Object.assign(shader.uniforms, { uTwinkle: glow.uTwinkle, uSway: sway })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nattribute vec4 aPivot;\nvarying vec2 vLamp;\n${LEVEL_GLSL}`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vLamp = uv;
{
  vec3 arm = transformed - aPivot.xyz;
  float turn = 6.2831853 * (${LANTERN.cycles.toFixed(1)} * uSway.x + aPivot.w);
  float kick = uSway.w * exp(-${LANTERN.kickFade.toFixed(2)} * uSway.y) * sin(6.2831853 * ${LANTERN.kickHz.toFixed(2)} * uSway.y);
  float ax = uSway.z * sin(turn) + kick * cos(6.2831853 * aPivot.w);
  float az = ${LANTERN.sway2.toFixed(2)} * uSway.z * sin(2.0 * turn + 1.3) + kick * sin(6.2831853 * aPivot.w);
  transformed += cross(vec3(ax, 0.0, az), arm);
}`,
    )
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nuniform vec4 uTwinkle;\nvarying vec2 vLamp;\n${LEVEL_GLSL}`)
    .replace('#include <color_fragment>', `#include <color_fragment>\nfloat lampLit = vColor.a;\nvec3 lampTint = diffuseColor.rgb;\ndiffuseColor.rgb *= 1.0 - ${(1 - LANTERN.paper).toFixed(2)} * lampLit;`)
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
{
  float lampFace = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  float lampCore = pow(abs(lampFace), ${LANTERN.tight.toFixed(1)});
  float lampBeat = 1.0 + ${FLICKER.toFixed(3)} * sin(6.2831853 * (uTwinkle.x + vLamp.x * 0.381966));
  vec3 lampOut = (vec4(normalize(normal), 0.0) * viewMatrix).xyz;
  float lampRib = (1.0 - ${LANTERN.rib.toFixed(2)} * pow(abs(0.5 + 0.5 * cos((abs(lampOut.x) + abs(lampOut.z) > 0.0 ? atan(lampOut.x, lampOut.z) : 0.0) * ${LANTERN.gores.toFixed(1)})), 5.0)) * (1.0 - ${LANTERN.ring.toFixed(2)} * pow(abs(0.5 + 0.5 * cos(asin(clamp(lampOut.y, -1.0, 1.0)) * ${LANTERN.ribs.toFixed(1)})), 3.0));
  vec3 lampHot = mix(lampTint * vec3(1.15, 0.5 + 0.5 * lampTint.g, 0.45), vec3(1.0, 0.5 + 0.56 * lampTint.g, 0.14 + 0.5 * lampTint.g) * max(lampTint.r, lampTint.g), lampCore * lampCore);
  totalEmissiveRadiance = lampHot * lampLit * (${LANTERN.gain.toFixed(2)} * (${LANTERN.body.toFixed(2)} + ${LANTERN.core.toFixed(2)} * lampCore)) * lanternLevel(vLamp.x) * lampBeat * lampRib;
}`,
    )
}

const v3 = (c: readonly number[]): string => `vec3(${c[0]!.toFixed(3)}, ${c[1]!.toFixed(3)}, ${c[2]!.toFixed(3)})`

function lanternHalo(part: string): THREE.ShaderMaterial {
  return stageShader({
    part,
    standIn: false,
    inside: true,
    change: 'light',
    uniforms: { uSway: sway },
    params: { side: THREE.FrontSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false },
    vertexPars: 'attribute vec4 aHalo;\nattribute vec4 aHaloSize;\nvarying vec4 vHalo;\nvarying vec4 vHaloSize;',
    vertexMain: 'vHalo = vec4((modelMatrix * vec4(aHalo.xyz, 1.0)).xyz, aHalo.w);\nvHaloSize = aHaloSize;',
    fragment: `
${LEVEL_GLSL}
varying vec4 vHalo;
varying vec4 vHaloSize;
void main() {
  if (uDiag != 0) discard;
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  vec3 d = normalize(vStagePlaced - cameraPosition);
  vec3 oc = cameraPosition - uLensCentre;
  float b = dot(oc, d);
  float h = b * b - dot(oc, oc) + uLens.x * uLens.x;
  vec3 sight = normalize(cameraPosition + d * (-b - sqrt(max(h, 0.0))) - vStageWorld);
  vec3 off = cross(sight, vStageWorld - vHalo.xyz);
  float g = max(0.0, 1.0 - dot(off, off) / (vHaloSize.x * vHaloSize.x));
  float body = g * g * g * ${HALO.strength.toFixed(3)} + pow(abs(g), 10.0) * ${HALO.hot.toFixed(3)};
  gl_FragColor = vec4(mix(${v3(HALO_EDGE)}, ${v3(HALO_CORE)}, g * g), body * lanternLevel(vHaloSize.y) * (1.0 - 0.8 * stageVeil(vStageAux.x)));
}
`,
  })
}

const tileOf = (name: string): number => (geometry(MODEL, name).userData.extras as { tileMm: number }).tileMm

const paperOn = (on: { power: number; reachMm: number }): GlowLight[] => lanterns.map((l): GlowLight => ({ at: l.at, color: paper(l), power: on.power * l.radius, reachMm: on.reachMm * l.radius, phase: l.phase }))

function lampOn(on: { power: number; reachMm: number; wrap: number }): GlowLight {
  const flame = lampFlame()
  return { at: [flame[0] + LAMP_SHIFT[0], flame[1] + LAMP_SHIFT[1], flame[2] + LAMP_SHIFT[2]], color: tones.lampLight, ...on, phase: 0.1 }
}

// Which pad a leaf belongs to, as the way that pad's own rounded body faces there (a flat ellipsoid about the pad's middle), and how open
// it lies to the sky up and to the right, where the pale light on the tops comes from: the length of leaf that stands in the way, with
// every clump taken as a plain rounded body. A clump under another, or behind its shoulder, stays dark, and so the clumps read apart.
function* bakePads(g: THREE.BufferGeometry): Generator<void, void> {
  const pos = g.getAttribute('position')
  const out = new Float32Array(pos.count * 4)
  const frames = crownPads.map((p) => ({ ...p, at: placePoint(p.at) })).map((p) => ({ at: p.at, size: p.size, ...padAxes(p) }))
  const toward = OPEN.toward
  const bodies = clumps.map((k) => {
    const axes = padAxes(k)
    const mid = (k.size[1] + OPEN.top - OPEN.under) / 2
    const half = [k.size[0] + OPEN.side, (k.size[1] + OPEN.top + OPEN.under) / 2, k.size[2] + OPEN.side]
    const rows = [axes.side, axes.up, axes.depth].map((a, j) => [a[0] / half[j]!, a[1] / half[j]!, a[2] / half[j]!])
    const l = rows.map((r) => r[0]! * toward[0] + r[1]! * toward[1] + r[2]! * toward[2])
    return { at: placePoint([k.at[0] + k.dir[0] * mid, k.at[1] + k.dir[1] * mid, k.at[2] + k.dir[2] * mid]), rows, l, a: l[0]! * l[0]! + l[1]! * l[1]! + l[2]! * l[2]! }
  })
  const open = (x: number, y: number, z: number): number => {
    let leaf = 0
    for (const b of bodies) {
      const dx = x - b.at[0]
      const dy = y - b.at[1]
      const dz = z - b.at[2]
      const q0 = b.rows[0]![0]! * dx + b.rows[0]![1]! * dy + b.rows[0]![2]! * dz
      const q1 = b.rows[1]![0]! * dx + b.rows[1]![1]! * dy + b.rows[1]![2]! * dz
      const q2 = b.rows[2]![0]! * dx + b.rows[2]![1]! * dy + b.rows[2]![2]! * dz
      const half = q0 * b.l[0]! + q1 * b.l[1]! + q2 * b.l[2]!
      const disc = half * half - b.a * (q0 * q0 + q1 * q1 + q2 * q2 - 1)
      if (disc <= 0) continue
      const root = Math.sqrt(disc)
      leaf += Math.max(0, (root - half) / b.a - Math.max((-root - half) / b.a, OPEN.skinMm))
    }
    const t = Math.min(1, Math.max(0, (leaf - OPEN.fromMm) / (OPEN.toMm - OPEN.fromMm)))
    return 1 - t * t * (3 - 2 * t)
  }
  const dist = new Float64Array(frames.length)
  const dirs = new Float64Array(frames.length * 3)
  for (let i = 0; i < pos.count; i++) {
    if (i % ROW === 0) yield
    let least = Infinity
    frames.forEach((f, k) => {
      const dx = pos.getX(i) - f.at[0]
      const dy = pos.getY(i) - f.at[1]
      const dz = pos.getZ(i) - f.at[2]
      const s = (dx * f.side[0] + dy * f.side[1] + dz * f.side[2]) / f.size[0]
      const u = (dx * f.up[0] + dy * f.up[1] + dz * f.up[2]) / f.size[1]
      const d = (dx * f.depth[0] + dy * f.depth[1] + dz * f.depth[2]) / f.size[2]
      const nx = (f.side[0] * s) / f.size[0] + (f.up[0] * u) / f.size[1] + (f.depth[0] * d) / f.size[2]
      const ny = (f.side[1] * s) / f.size[0] + (f.up[1] * u) / f.size[1] + (f.depth[1] * d) / f.size[2]
      const nz = (f.side[2] * s) / f.size[0] + (f.up[2] * u) / f.size[1] + (f.depth[2] * d) / f.size[2]
      const len = Math.hypot(nx, ny, nz) || 1
      dirs.set([nx / len, ny / len, nz / len], k * 3)
      dist[k] = Math.hypot(s, u, d)
      if (dist[k]! < least) least = dist[k]!
    })
    let x = 0
    let y = 0
    let z = 0
    for (let k = 0; k < frames.length; k++) {
      const w = Math.exp(-PAD.soft * (dist[k]! - least))
      x += w * dirs[k * 3]!
      y += w * dirs[k * 3 + 1]!
      z += w * dirs[k * 3 + 2]!
    }
    const len = Math.hypot(x, y, z) || 1
    out.set([x / len, y / len, z / len, open(pos.getX(i), pos.getY(i), pos.getZ(i))], i * 4)
  }
  g.setAttribute('aPad', new THREE.BufferAttribute(out, 4))
}

export async function prepare(): Promise<void> {
  await Promise.all([prepareTrunk(), prepareModel(MODEL)])
}

export function* making(): Generator<void, THREE.Object3D> {
  const part = `miniature-${season}`
  const fill = placePoint(FILL_FROM)
  const leaves = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: texture(LEAVES), color: new THREE.Color(LEAF_TINT[0], LEAF_TINT[1], LEAF_TINT[2]), vertexColors: true, roughness: 0.82, side: THREE.DoubleSide, hook: leafHook, key: 'tree-leaves-summer' })
  const g = yield* placing(geometry(MODEL, 'leaves'))
  yield* bakePads(g)
  yield* glowing(g, [...paperOn(GLOW.leaves), lampOn(LAMP_ON_LEAVES), { at: fill, color: tones.sun, ...FILL_ON_LEAVES, phase: 0.6 }])
  yield
  const crown = new THREE.Mesh(g, leaves)
  crown.castShadow = true
  crown.receiveShadow = false
  yield
  const trunk = yield* trunkMaking(part, [...paperOn(GLOW.wood), lampOn(LAMP_ON_WOOD), { at: fill, color: tones.sun, ...FILL_ON_WOOD, phase: 0.6 }], BARK)
  yield
  const shared = trunk.material as THREE.MeshStandardMaterial
  const wood = trunk.geometry.getAttribute('position') as THREE.BufferAttribute
  const out = trunk.geometry.getAttribute('normal') as THREE.BufferAttribute
  const box = new THREE.Box3().setFromBufferAttribute(wood)
  const stem = { x: 0, z: 0, n: 0 }
  for (let i = 0; i < wood.count; i++) {
    if (wood.getY(i) - box.min.y > STEM.fromMm) continue
    stem.x += wood.getX(i)
    stem.z += wood.getZ(i)
    stem.n++
  }
  const ease = (a: number, b: number, v: number): number => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const flare = (h: number): number => {
    if (h <= FOOT_FLARE[0]![0]) return FOOT_FLARE[0]![1]
    for (let k = 1; k < FOOT_FLARE.length; k++) {
      const [h0, d0] = FOOT_FLARE[k - 1]!
      const [h1, d1] = FOOT_FLARE[k]!
      if (h <= h1) return d0 + (d1 - d0) * ease(h0, h1, h)
    }
    return 0
  }
  const wound = yield* winding()
  const hit = newHit()
  const to: Xyz = [0, 0, 0]
  const stemmed = new Float32Array(wood.count)
  for (let i = 0; i < wood.count; i++) {
    if (i % ROW === 0) yield
    const far = ease(STEM.nearMm, STEM.farMm, Math.hypot(wood.getX(i) - stem.x / stem.n, wood.getZ(i) - stem.z / stem.n))
    const high = ease(STEM.fromMm, STEM.toMm, wood.getY(i) - box.min.y)
    const d = flare(wood.getY(i) - foot[1])
    wind(wound, wood.getX(i), wood.getY(i), wood.getZ(i), hit, to)
    const reach = d * (1 - FOOT_LEFT * out.getX(i))
    wood.setXYZ(i, to[0] + out.getX(i) * reach, to[1] + out.getY(i) * reach, to[2] + out.getZ(i) * reach)
    stemmed[i] = (1 - far) * (1 - STEM.limb * high)
  }
  trunk.geometry.computeBoundingSphere()
  trunk.geometry.computeBoundingBox()
  wood.needsUpdate = true
  trunk.geometry.setAttribute('aStem', new THREE.BufferAttribute(stemmed, 1))
  yield
  trunk.material = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: shared.map ?? undefined, color: new THREE.Color(BARK[0], BARK[1], BARK[2]), vertexColors: true, roughness: 0.86, extra: { normalMap: shared.normalMap, normalScale: new THREE.Vector2(BARK_BUMP, BARK_BUMP) }, hook: (shader) => woodHook(shader, box.min.y + ROOT_MM), key: 'tree-wood-summer' })
  return new THREE.Group().add(trunk, crown)
}

export function lights(): THREE.Object3D {
  const part = `light-${season}`
  const m = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'light', vertexColors: true, roughness: 0.7, metalness: 0, hook: lanternHook, key: 'tree-lanterns-summer' })
  const g = geometry(MODEL, 'lanterns').clone()
  const pivot = g.getAttribute('tangent')
  g.deleteAttribute('tangent')
  g.setAttribute('aPivot', pivot)
  const mesh = new THREE.Mesh(g, m)
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  const halos = new THREE.Mesh(haloGeometry(lanterns.map((l) => l.at), 1, lanterns.map((l) => ({ size: HALO.radius * l.radius, rest: l.order, hot: 1, bloom: 1 }))), lanternHalo(part))
  halos.renderOrder = 3
  return new THREE.Group().add(mesh, halos)
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(trunkSolid(x, y, z), leafField(x - offset[0], y - offset[1], z - offset[2]))
}

export function update(moment: KitMoment): void {
  const turn = (((moment.time / moment.period) % 1) + 1) % 1
  const since = Number.isFinite(moment.sinceLanding) ? Math.min(100, Math.max(0, moment.sinceLanding)) : 100
  const here = moment.beat === null ? 1 : Math.min(1, Math.max(0, moment.arrived / 0.02))
  const lit = since * here * here * (3 - 2 * here)
  sway.value.set(turn, lit, LANTERN.swayRad, LANTERN.kickRad)
  let mean = 0
  for (const l of lanterns) {
    const rise = lanternRise(l.order)
    const t = Math.min(1, Math.max(0, (lit - rise.start) / rise.ramp))
    mean += (rise.dim + (1 - rise.dim) * t * t * (3 - 2 * t)) / lanterns.length
  }
  glow.uTwinkle.value.set(CYCLES * turn, FLICKER, mean, 0)
}
