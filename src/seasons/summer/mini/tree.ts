import * as THREE from 'three'
import { stageMaterial, stageShader } from '../../../core/materials'
import { afterLight } from '../../../core/chunks/light'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { haloGeometry } from '../../../miniature/glow'
import { lampFlame } from '../../../miniature/roof'
import { bakeGlow, buildTrunk, crownOffset, glow, glowHook, placeGeometry, placePoint, prepareTrunk, trunkSolid, type GlowLight } from '../../../miniature/trunk'
import type { InnerLight, KitMoment, Vec3 } from '../../kit'
import { leafField } from './crown'
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
const GLOW = { leaves: { power: 3.6, reachMm: 7.5 }, wood: { power: 1.5, reachMm: 7 } }
const LAMP_ON_WOOD = { power: 0.5, reachMm: 14, wrap: -0.2 }
const LAMP_ON_LEAVES = { power: 3, reachMm: 12, wrap: 0.1 }
const LAMP_SHIFT: Vec3 = [-3, 0, -5]
const FILL_ON_WOOD = { power: 0.25, reachMm: 1000, wrap: 0.4 }
const FILL_ON_LEAVES = { power: 0.5, reachMm: 1000, wrap: 0.3 }
const FILL_FROM: Vec3 = [30, 60, 60]
const BARK: Rgb3 = [0.21, 0.135, 0.095]
// The wood stands half again as thick as the shared trunk: each vertex moves out along its normal, less up in the crown and least on the twigs far from the stem.
const THICK = { footMm: 1.1, crownMm: 0.7, fromMm: 6, toMm: 22, twig: 0.25, nearMm: 5, farMm: 15 }
const BARK_BUMP = 3.4
// The bark: long flutes down the wood (the bark map drawn out along the grain), dark in their grooves, with the low sun
// on the edge of the wood that faces it and moss on what faces up near the ground.
const WOOD = { relief: 0.95, ridges: 5, warp: 2.6, fine: 0.4, low: 0.42, high: 1.45, from: 0.15, to: 0.85, depthMm: 1.5, rim: 3.0, rimTight: 3.4, side: 0.4, wrap: 0.95, mossTo: 5.5, moss: 0.45 }
const MOSS: Rgb3 = [0.3, 0.52, 0.12]
const ROOT_MM = 4.5
const LEAF_TINT: Rgb3 = [0.1, 0.145, 0.165]
const LEAF_LIT = 'vec3(1.7, 0.85, 0.42)'
const glsl3 = (c: Rgb3): string => `vec3(${c.map((v) => v.toFixed(3)).join(', ')})`
const LEAF_VARY = { big: 0.36, mid: 1.15, scaleLow: 0.56, scale: 0.4, cool: [0.5, 0.74, 0.95] as Rgb3, warm: [1.15, 1.16, 0.86] as Rgb3 }
const LEAF = { rim: 3.5, rimTight: 3.2, through: 0.08, tight: 3.0, fill: 0.06, wrap: 0.8, bump: 1.0, clumpDark: 0.8, clumpBright: 0.95, sky: 20.0, skyTint: [5.2, 1.05, 0.22] as Rgb3, skyAway: 0.28, topFrom: 0.42, topTo: 1.05, body: 0.0, under: 0.36, side: 0.35 }
const LANTERN = { rib: 0.3, gores: 12, ring: 0.16, ribs: 26, gain: 0.95, body: 0.5, core: 5.0, tight: 2.2, paper: 0.06, dim: 0.4, stepS: 0.23, rampS: 0.42, swayRad: 0.045, sway2: 0.6, kickRad: 0.16, kickFade: 1.2, kickHz: 1.3, cycles: 2 }
const HALO = { radius: 2.9, strength: 0.17, hot: 0.0 }
const HALO_EDGE: Rgb3 = [0.9, 0.36, 0.08]
const HALO_CORE: Rgb3 = [1, 0.7, 0.34]

const offset = crownOffset()
const sway = { value: new THREE.Vector4(0, 100, LANTERN.swayRad, LANTERN.kickRad) }
const paper = (l: Lantern): Rgb3 => (l.tone === 'cream' ? tones.creamLight : tones.paperLight) as Rgb3

export const innerLights: InnerLight[] = lanterns.map((l): InnerLight => ({ at: l.at, color: paper(l), power: PAPER.power * l.radius * l.radius, reachMm: PAPER.reachMm * l.radius, flicker: FLICKER, cycles: CYCLES, phase: l.phase }))

const LEVEL_GLSL = `
uniform vec4 uSway;
float lanternLevel(float order) {
  return mix(${LANTERN.dim.toFixed(3)}, 1.0, smoothstep(0.0, ${LANTERN.rampS.toFixed(3)}, uSway.y - order * ${LANTERN.stepS.toFixed(4)}));
}
`

const TREE_GLSL = `
uniform float uTile;
uniform float uBump;
varying vec3 vTreeP;
varying vec3 vTreeN;
vec4 treeTri(sampler2D t, vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= w.x + w.y + w.z;
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
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

// The crown reads as a handful of clumps: each has a side toward the low sun, a side away from it and dark between it and the next.
const CLUMP = { cellMm: 7.5, form: 0.5, lit: 0.12, from: -0.25, to: 0.85, gapTo: 0.3, gap: 0.55, away: 0.85, side: [0.619, 0.744, 0.251] as Rgb3, haze: [0.004, 0.007, 0.003] as Rgb3 }
const CLUMP_GLSL = `{
  vec3 clumpP = vTreeP / ${CLUMP.cellMm.toFixed(1)};
  vec3 clumpI = floor(clumpP);
  vec3 clumpF = clumpP - clumpI;
  float clumpD1 = 9.0;
  float clumpD2 = 9.0;
  vec3 clumpTo = vec3(0.0, 1.0, 0.0);
  for (int cz = -1; cz <= 1; cz++) {
    for (int cy = -1; cy <= 1; cy++) {
      for (int cx = -1; cx <= 1; cx++) {
        vec3 clumpO = vec3(float(cx), float(cy), float(cz));
        vec3 clumpC = clumpI + clumpO;
        vec3 clumpH = fract(sin(vec3(dot(clumpC, vec3(127.1, 311.7, 74.7)), dot(clumpC, vec3(269.5, 183.3, 246.1)), dot(clumpC, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
        vec3 clumpR = clumpO + 0.2 + 0.6 * clumpH - clumpF;
        float clumpD = dot(clumpR, clumpR);
        if (clumpD < clumpD1) {
          clumpD2 = clumpD1;
          clumpD1 = clumpD;
          clumpTo = clumpR;
        } else if (clumpD < clumpD2) {
          clumpD2 = clumpD;
        }
      }
    }
  }
  float clumpNear = sqrt(max(clumpD1, 1e-6));
  vec3 clumpMix = mix(normalize(vTreeN), -clumpTo / clumpNear, ${CLUMP.form.toFixed(2)});
  vec3 clumpN = clumpMix / max(length(clumpMix), 1e-3);
  float clumpLit = smoothstep(${CLUMP.from.toFixed(2)}, ${CLUMP.to.toFixed(2)}, dot(clumpN, ${glsl3(CLUMP.side)}));
  float clumpGap = smoothstep(0.0, ${CLUMP.gapTo.toFixed(2)}, sqrt(max(clumpD2, 1e-6)) - clumpNear);
  reflectedLight.directDiffuse *= mix(${CLUMP.gap.toFixed(2)}, 1.0, clumpGap) * mix(${CLUMP.away.toFixed(2)}, 1.0, clumpLit);
  // The side light on a clump goes through the leaf's own tone, so that it shows on the lit tops of the pads and not in their dark bodies.
  reflectedLight.directDiffuse += stageKeyC * material.diffuseContribution * (${CLUMP.lit.toFixed(2)} * clumpLit * clumpLit * clumpGap);
  // The gold air stands in front of the crown too: its deepest shade is not black.
  reflectedLight.directDiffuse += stageKeyC * ${glsl3(CLUMP.haze)};
}`

function leafHook(shader: Shader): void {
  glowHook(shader, `material.diffuseContribution * ${LEAF_LIT}`)
  Object.assign(shader.uniforms, { uTile: { value: 1 / tileOf('leaves') }, uBump: { value: LEAF.bump }, uSprigs: { value: texture(SPRIGS) } })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 uv1;\nvarying vec2 vCard;\nvarying vec3 vTreeP;\nvarying vec3 vTreeN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCard = uv1;\nvTreeP = position;\nvTreeN = normal;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}\nuniform sampler2D uSprigs;\nvarying vec2 vCard;`)
    .replace(
      '#include <map_fragment>',
      `// Two slow waves through the crown: each spray of leaves gets its own scale of leaf and its own tone, so that no two pads read as copies.
      float treeBig = 0.5 + 0.5 * sin(vTreeP.x * ${LEAF_VARY.big.toFixed(2)} + 1.7 * sin(vTreeP.y * ${(LEAF_VARY.big * 0.8).toFixed(3)} + 0.6)) * sin(vTreeP.z * ${(LEAF_VARY.big * 0.9).toFixed(3)} + 1.3 * sin(vTreeP.x * ${(LEAF_VARY.big * 0.7).toFixed(3)}) + 2.1);
      float treeMid = 0.5 + 0.5 * sin(vTreeP.x * ${LEAF_VARY.mid.toFixed(2)} + vTreeP.y * ${(LEAF_VARY.mid * 0.7).toFixed(3)} + 0.4) * sin(vTreeP.z * ${(LEAF_VARY.mid * 0.85).toFixed(3)} - vTreeP.y * ${(LEAF_VARY.mid * 0.55).toFixed(3)} + 1.9);
      vec4 treeBody = treeTri(map, vTreeP * (uTile * (${LEAF_VARY.scaleLow.toFixed(2)} + ${LEAF_VARY.scale.toFixed(2)} * treeBig)), normalize(vTreeN));
      vec4 treeSprig = texture2D(uSprigs, vMapUv);
      bool treeCard = vCard.x > 0.5;
      vec4 treeC = treeCard ? treeSprig : treeBody;
      float treeH = dot(treeC.rgb, vec3(0.3, 0.6, 0.1)) * 4.0;
      vec3 treeSx = dFdx(-vViewPosition);
      vec3 treeSy = dFdy(-vViewPosition);
      vec2 treeDh = vec2(dFdx(treeH), dFdy(treeH));
      float treeLum = dot(treeC.rgb, vec3(0.3, 0.6, 0.1));
      diffuseColor.rgb *= treeC.rgb * mix(${LEAF.clumpDark.toFixed(2)}, ${LEAF.clumpBright.toFixed(2)}, smoothstep(0.03, 0.28, treeLum)) * mix(${glsl3(LEAF_VARY.cool)}, ${glsl3(LEAF_VARY.warm)}, 0.6 * treeBig + 0.4 * treeMid);`,
    )
    .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nif (vCard.x > 0.5) normal *= faceDirection;')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = treeBump(treeSx, treeSy, treeDh, normal, faceDirection);')
    // A card is cut last. A pixel that is cut stops being worked out, and the lighting after it reads its neighbours' numbers
    // (the slope of the normal, of the shadow's place): cut early, the edge of every sprig was lit from numbers nobody set.
    .replace(/\}\s*$/, 'if (treeCard && treeC.a < 0.5) discard;\n}')
  afterLight(shader, `reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${LEAF.fill.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), ${LEAF.wrap.toFixed(2)}) + ${LEAF.through.toFixed(2)} * pow(clamp(dot(normalize(vViewPosition), -stageKeyL), 0.0, 1.0), ${LEAF.tight.toFixed(1)}) + ${LEAF.rim.toFixed(2)} * pow(abs(1.0 - abs(dot(normal, normalize(vViewPosition)))), ${LEAF.rimTight.toFixed(1)}) * smoothstep(-0.3, 0.7, dot(normal, stageKeyL)))) * material.diffuseContribution;\n{\n  vec3 treeUpN = normalize(vTreeN);\n  // Each pad of leaves is lit from above and dark underneath, so the crown reads as layers and not as one mass.\n  reflectedLight.directDiffuse *= mix(${LEAF.under.toFixed(2)}, 1.0, smoothstep(-0.55, 0.5, treeUpN.y));\n  // The gold air comes from above. The tone baked into each leaf lets it light the tops of the pads and leaves their bodies dark.\n  // A leaf whose baked tone is dark stands in a pad's body: the gold air reaches only the bright ones, the rims that have open air over them.\n  float treeTop = smoothstep(${LEAF.topFrom.toFixed(2)}, ${LEAF.topTo.toFixed(2)}, dot(vColor.rgb, vec3(0.3, 0.6, 0.1)));\n  reflectedLight.directDiffuse += material.diffuseContribution * ${glsl3(LEAF.skyTint)} * (${LEAF.sky.toFixed(2)} * mix(${LEAF.body.toFixed(2)}, 1.0, treeTop) * mix(${LEAF.skyAway.toFixed(2)}, 1.0, smoothstep(-0.5, 0.6, dot(geometryNormal, stageKeyL))) * (0.15 + 0.85 * smoothstep(-0.2, 0.9, treeUpN.y)));\n}\n${CLUMP_GLSL}`)
}

function woodHook(shader: Shader, groundY: number): void {
  glowHook(shader, undefined, WOOD.relief)
  Object.assign(shader.uniforms, { uTile: { value: 1 }, uBump: { value: WOOD.depthMm } })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTreeP;\nvarying vec3 vTreeN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTreeP = position;\nvTreeN = normal;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${TREE_GLSL}\nfloat woodH = 0.0;`)
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
  afterLight(shader, `reflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * (${WOOD.side.toFixed(2)} * stageWrap(dot(normal, stageKeyL), ${WOOD.wrap.toFixed(2)}) + ${WOOD.rim.toFixed(2)} * pow(abs(1.0 - abs(dot(normal, normalize(vViewPosition)))), ${WOOD.rimTight.toFixed(1)}) * smoothstep(-0.35, 0.5, dot(normal, stageKeyL)))) * material.diffuseContribution;`)
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

export async function prepare(): Promise<void> {
  await Promise.all([prepareTrunk(), prepareModel(MODEL)])
}

export function build(): THREE.Object3D {
  const part = `miniature-${season}`
  const fill = placePoint(FILL_FROM)
  const leaves = stageMaterial({ part, standIn: false, inside: true, miniature: true, change: 'miniature', map: texture(LEAVES), color: new THREE.Color(LEAF_TINT[0], LEAF_TINT[1], LEAF_TINT[2]), vertexColors: true, roughness: 0.82, side: THREE.DoubleSide, hook: leafHook, key: 'tree-leaves-summer' })
  const g = placeGeometry(geometry(MODEL, 'leaves'))
  bakeGlow(g, [...paperOn(GLOW.leaves), lampOn(LAMP_ON_LEAVES), { at: fill, color: tones.sun, ...FILL_ON_LEAVES, phase: 0.6 }])
  const crown = new THREE.Mesh(g, leaves)
  crown.castShadow = true
  crown.receiveShadow = true
  const trunk = buildTrunk(part, [...paperOn(GLOW.wood), lampOn(LAMP_ON_WOOD), { at: fill, color: tones.sun, ...FILL_ON_WOOD, phase: 0.6 }], BARK)
  const shared = trunk.material as THREE.MeshStandardMaterial
  const wood = trunk.geometry.getAttribute('position') as THREE.BufferAttribute
  const out = trunk.geometry.getAttribute('normal') as THREE.BufferAttribute
  const box = new THREE.Box3().setFromBufferAttribute(wood)
  const stem = { x: 0, z: 0, n: 0 }
  for (let i = 0; i < wood.count; i++) {
    if (wood.getY(i) - box.min.y > THICK.fromMm) continue
    stem.x += wood.getX(i)
    stem.z += wood.getZ(i)
    stem.n++
  }
  const ease = (a: number, b: number, v: number): number => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  for (let i = 0; i < wood.count; i++) {
    const far = ease(THICK.nearMm, THICK.farMm, Math.hypot(wood.getX(i) - stem.x / stem.n, wood.getZ(i) - stem.z / stem.n))
    const d = (THICK.footMm + (THICK.crownMm - THICK.footMm) * ease(THICK.fromMm, THICK.toMm, wood.getY(i) - box.min.y)) * (1 + (THICK.twig - 1) * far)
    wood.setXYZ(i, wood.getX(i) + out.getX(i) * d, wood.getY(i) + out.getY(i) * d, wood.getZ(i) + out.getZ(i) * d)
  }
  wood.needsUpdate = true
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
    const t = Math.min(1, Math.max(0, (lit - l.order * LANTERN.stepS) / LANTERN.rampS))
    mean += (LANTERN.dim + (1 - LANTERN.dim) * t * t * (3 - 2 * t)) / lanterns.length
  }
  glow.uTwinkle.value.set(CYCLES * turn, FLICKER, mean, 0)
}
