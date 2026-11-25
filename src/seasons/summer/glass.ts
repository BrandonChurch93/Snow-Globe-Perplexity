import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { partChange } from '../../shake/change'
import type { Dressing, KitMoment } from '../kit'
import { rig } from './rig'
import { holdStorm, veil } from './veil'

// Part `glass-dressing-summer`: the glass is clear, and what the season puts on it is light.
// 1. The flare: the reflection of the one strong warm light (the rig's key) on the outside of the glass. It sits where a sphere
//    mirrors that light toward the eye (the half vector between the eye and the light), which from the hero camera is the upper
//    right shoulder, at the limb. It is a small hot core squeezed along the limb, a warm halo and the star a lens draws round a
//    point that bright. It kindles on the landing.
// 2. The pool: the same light focused by the globe onto the slab, in front of the globe and to its left, inside the globe's own
//    shadow: a bright knot with a web of thin veins of light round it, as the approved image has them, long in the light's
//    direction because the sun is low. The web moves when the globe moves and swings to rest after the landing.
// 3. The wall: the sun, bent by the globe, burns a patch on the inside of the glass low on the far side; the same billboard
//    carries the warm air at rest and the glow of the storm (by the liquid's turbulence).
// Nothing here is stepped: both are functions of the moment's pose, of the time and of the time since the landing.
const PART = 'glass-dressing-summer'
const RS = config.globe.sphereDiameterMm / 2
const TAU = Math.PI * 2

export const standIns: string[] = []

export const glassDressing: Dressing = { tint: [1, 0.9, 0.6], amount: 0 }

export const look = {
  // leaving: the light goes out between these two counts of beats before the swap window opens
  leaveBeats: [1.1, 0.2] as const,
  flare: {
    halfMm: 30,
    core: 30,
    coreAcross: 0.03,
    coreAlong: 0.062,
    // the bloom of the lens round the core: a soft ball a few millimetres wide
    bloom: 5,
    bloomWide: 0.085,
    halo: 0.7,
    haloWide: 0.24,
    veil: 0.22,
    // the star: many soft tapered rays, short, each with its own length, widest at the core, fanning away from the globe
    rays: 0.8,
    spikes: 13,
    reach: [0.17, 0.16] as const,
    rayWide: [0.016, 0.05] as const,
    arc: 1.6,
    hot: [1, 0.9, 0.72] as const,
    warm: [1, 0.7, 0.38] as const,
    amber: [1, 0.52, 0.2] as const,
    // the landing: the flare is out while the globe is in the hand after the change, catches on the landing frame, overshoots and settles
    kindleSeconds: 0.22,
    flash: 0.55,
    flashSeconds: 0.3,
    breath: 0.05,
  },
  // the far wall: the light that crosses the globe gathers on the inside of the glass opposite the sun, a warm crescent
  // along the limb
  wall: {
    gain: 0.42,
    low: 0.38,
    // the thin warm crescent along the limb
    band: 0.03,
    wide: 0.5,
    from: 0.86,
    peak: 0.95,
    color: [1, 0.74, 0.44] as const,
    // the hot patch: the sun, bent by the globe, lands on the inside of the glass low on the far side and burns out there
    hot: 26,
    hotColor: [1, 0.8, 0.5] as const,
    // the amber glow of the liquid round the patch
    glow: 0.5,
    // its spill past the limb: the lens blooms round the patch, outside the glass too
    spill: 0.16,
    // the limb's own warm edge on the far side
    edge: 0.7,
    // the air: the low sun in the liquid, warm on the side the light falls toward and nothing on the side it comes from
    air: 0.022,
    airColor: [1, 0.66, 0.36] as const,
    // the storm: the seeds and the dust aloft take the sun and the whole dome glows white-gold; it goes with the liquid's
    // turbulence, in slow arms that turn with the time, and is thinner over the miniature so the lanterns stay
    storm: 0.15,
    stormFrom: 0.12,
    stormTo: 0.75,
    stormColor: [1, 0.68, 0.34] as const,
    stormArms: 0.22,
    stormOpen: 0.55,
    stormDulls: 0.8,
  },
  pool: {
    // where the hot middle of the pool lies from the foot's centre: down the light's way on the slab and a little across it
    reachMm: 76,
    sideMm: 2.7,
    // how far the low sun draws the pool out along its way
    stretch: 2.2,
    softMm: 22,
    gain: 0.07,
    core: 3,
    coreMm: 2.4,
    glow: 0.7,
    glowMm: 5,
    bands: 8,
    // the web of veins: its cells round the knot and per e-fold of distance, the reach of its light, a vein's width and glow
    webCells: 19,
    webRings: 1.25,
    webMm: 15,
    webEndMm: [20, 46] as const,
    veinMm: 0.42,
    veinGlowMm: 1.5,
    veinGlow: 0.16,
    // the short bright rays round the hot knot, as the approved image has them: their strength and their reach
    rays: 1.5,
    raysMm: 9,
    liftPerMm: 2.2,
    tiltMm: 160,
    swing: 1,
    swingSeconds: 1.1,
    swingHz: 1.7,
    settleSeconds: 0.18,
    gold: [1, 0.6, 0.24] as const,
    pale: [1, 0.8, 0.5] as const,
    // the low sun on the table itself: a strip of dusty warm light past the far side of the globe's long shadow, which lies
    // down the light's way (the pool lies inside that shadow); its strength, how far it reaches along and across, the shadow's
    // half width and softness
    sun: 0.18,
    sunMm: 130,
    stripMm: 45,
    shadeMm: 52,
    shadeSoftMm: 9,
    sunColor: [1, 0.72, 0.42] as const,
  },
}

const vec = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`
const n = (v: number): string => v.toFixed(4)

const uniforms = {
  // xyz: toward the light, in the world; w: how far the flare is kindled
  uFlareSun: { value: new THREE.Vector4(0, 1, 0, 1) },
  // x: the time, y: the pool's swing, z: how much of the pool is there, w: free
  uSummer: { value: new THREE.Vector4(0, 0, 1, 0) },
  // xy: the pool's middle on the slab, zw: the light's way on the slab (unit)
  uPoolAt: { value: new THREE.Vector4(0, 0, 0, 1) },
  // xy: the globe's foot on the slab
  uPoolFoot: { value: new THREE.Vector2(0, 0) },
}

const F = look.flare
const FLARE = `
uniform vec4 uFlareSun;
uniform vec4 uSummer;
varying vec2 vFl;
varying vec2 vFlOut;
varying float vFlGain;
float flRnd(float i, float k) {
  return stageHash(vec3(i + 3.0, k * 17.0 + 5.0, 0.37));
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float lit = uFlareSun.w * vFlGain;
  if (lit <= 0.0) discard;
  vec2 p = vFl;
  float r = length(p);
  vec2 q = vec2(dot(p, vFlOut), dot(p, vec2(-vFlOut.y, vFlOut.x)));
  float edge = 1.0 - smoothstep(0.62, 1.0, r);
  // the core: the light itself, mirrored small; across the limb the sphere squeezes it
  float core = exp(-(q.x * q.x / ${n(F.coreAcross * F.coreAcross)} + q.y * q.y / ${n(F.coreAlong * F.coreAlong)}));
  // the glass beside it takes the light along the limb
  float arc = exp(-q.x * q.x / 0.0009) * exp(-q.y * q.y / 0.09);
  float halo = exp(-r * r / ${n(F.haloWide * F.haloWide)}) + ${n(F.veil)} * exp(-r / 0.34);
  float bloom = exp(-r * r / ${n(F.bloomWide * F.bloomWide)});
  // the star: soft tapered rays through the core, each with its own length, breathing a little
  float star = 0.0;
  for (int i = 0; i < ${F.spikes}; i++) {
    float fi = float(i);
    float a = (fi + 0.8 * flRnd(fi, 1.0)) * ${n(Math.PI / F.spikes)} + 0.35;
    vec2 d = vec2(cos(a), sin(a));
    float along = dot(p, d);
    float across = p.x * d.y - p.y * d.x;
    float side = along > 0.0 ? flRnd(fi, 2.0) : flRnd(fi, 3.0);
    float reach = (${n(F.reach[0])} + ${n(F.reach[1])} * side * side) * (0.7 + 0.6 * max(dot(d * sign(along), vFlOut), 0.0)) * (1.0 + ${n(F.breath)} * sin(uSummer.x * (0.9 + 1.3 * flRnd(fi, 4.0)) + 6.28 * flRnd(fi, 5.0)));
    float t = abs(along) / reach;
    float wide = ${n(F.rayWide[0])} + ${n(F.rayWide[1])} * (1.0 - min(t, 1.0)) * (1.0 - min(t, 1.0));
    star += exp(-across * across / (wide * wide)) * exp(-2.6 * t) * (1.0 - smoothstep(0.6, 1.2, t)) * (0.4 + 0.6 * side) * (0.3 + 0.7 * max(dot(d * sign(along), vFlOut), 0.0));
  }
  vec3 col = ${vec(F.hot)} * (${n(F.core)} * core + ${n(F.bloom)} * bloom) + ${vec(F.warm)} * (${n(F.rays)} * star + ${n(F.arc)} * arc) + ${vec(F.amber)} * (${n(F.halo)} * halo);
  gl_FragColor = vec4(col * (lit * edge), 0.0);
}`

const W = look.wall
const WALL = `
uniform vec4 uFlareSun;
uniform vec4 uSummer;
varying vec2 vWl;
varying vec2 vWlDir;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float lit = min(uFlareSun.w, 1.0);
  float storm = uSummer.w;
  if (lit <= 0.0 && storm <= 0.0) discard;
  float r = length(vWl);
  if (r > 1.24) discard;
  vec2 e = vWl / max(r, 1e-4);
  float a = atan(e.x * vWlDir.y - e.y * vWlDir.x, dot(e, vWlDir));
  float inside = 1.0 - smoothstep(0.965, 0.993, r);
  // the crescent: thin toward the middle of the globe, full just inside the limb, gone at the limb itself
  float band = pow(smoothstep(${n(W.from)}, ${n(W.peak)}, r), 2.2) * (1.0 - smoothstep(0.955, 0.992, r)) * exp(-a * a / ${n(W.wide * W.wide)});
  // the hot patch: three tongues of different length, slanting along the wall
  // each tongue is a sheaf of thin bright lines lying along the wall, sharp at the limb side and feathered toward the middle
  float lines = 0.5 + 0.5 * pow(0.5 + 0.5 * sin(r * 290.0 + 14.0 * sin(a * 9.0 + 1.3) + 5.0 * sin(a * 23.0)), 3.0) * (0.6 + 0.4 * sin(r * 97.0 + a * 40.0));
  float hot = exp(-pow((r - 0.9) / 0.044, 2.0) - pow((a + 0.02) / 0.1, 2.0));
  hot += 0.8 * exp(-pow((r - 0.94) / 0.016, 2.0) - pow((a - 0.1) / 0.12, 2.0));
  hot += 0.7 * exp(-pow((r - 0.872) / 0.022, 2.0) - pow((a + 0.1) / 0.06, 2.0));
  hot *= lines;
  // the middle of it burns out
  hot += 1.2 * exp(-pow((r - 0.908) / 0.028, 2.0) - pow((a + 0.01) / 0.065, 2.0));
  float glow = exp(-pow((r - 0.9) / 0.06, 2.0) - a * a / 0.03);
  float edge = exp(-pow((r - 0.972) / 0.012, 2.0)) * exp(-pow((a - 0.45) / 0.75, 2.0));
  // in the storm the liquid scatters the sun: the patch is a dull amber glow, not a burn
  float clear = 1.0 - ${n(W.stormDulls)} * storm;
  vec3 col = ${vec(W.color)} * (${n(W.band)} * band + ${n(W.glow)} * glow * inside * clear + ${n(W.edge)} * edge) + ${vec(W.hotColor)} * (${n(W.hot)} * hot * inside * clear * clear);
  float body = 1.0 - smoothstep(0.86, 0.992, r);
  vec2 off = vWl - vWlDir * 0.93;
  vec3 spill = ${vec(W.color)} * (${n(W.spill)} * exp(-dot(off, off) / 0.022) * lit);
  float toward = 0.5 + 0.5 * dot(vWl, vWlDir);
  vec3 air = ${vec(W.airColor)} * (${n(W.air)} * smoothstep(0.45, 1.0, toward) * body);
  // the storm's light: slow broad arms about the middle, turning with the time
  float turn = atan(vWl.y, vWl.x);
  float arms = 1.0 - ${n(W.stormArms)} + ${n(W.stormArms)} * sin(2.0 * turn + 5.0 * r - 1.7 * uSummer.x) * smoothstep(0.05, 0.4, r);
  float open = 1.0 - ${n(W.stormOpen)} * exp(-(vWl.x * vWl.x / 0.42 + (vWl.y + 0.34) * (vWl.y + 0.34) / 0.14));
  vec3 gale = ${vec(W.stormColor)} * (${n(W.storm)} * storm * arms * open * body * (0.75 + 0.25 * toward));
  gl_FragColor = vec4(col * (${n(W.gain)} * lit) + air * lit + gale + spill, 0.0);
}`

const P = look.pool
const POOL = `
uniform vec4 uSummer;
uniform vec4 uPoolAt;
uniform vec2 uPoolFoot;
// The web: what a ball of water does with a low sun. The light leaves the knot in thin veins that part and join again, fine
// near the knot and wider apart further out; where two veins meet the light gathers. It is one net, drawn in the pool's plane:
// cells in the angle round the knot and in the logarithm of the distance from it, so that every vein has the same width in
// millimetres wherever it lies.
vec2 poolWeb(vec2 h, float s) {
  float len = max(length(h), 0.6);
  float turn = atan(h.y, h.x) / 6.2831853 + 0.5;
  vec2 q = vec2(${n(P.webRings)} * log(len), turn * ${n(P.webCells)});
  q.x += 0.38 * sin(turn * 6.2831853 * 3.0 + 0.5 * s) + 0.2 * sin(turn * 6.2831853 * 7.0 + 2.0);
  q.y += 0.6 * sin(q.x * 2.9 + 1.0 + 0.3 * s) + 0.25 * sin(q.x * 6.1 + turn * 31.0);
  vec2 g = floor(q);
  vec2 f = q - g;
  float f1 = 9.0;
  float f2 = 9.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = vec2(float(i), float(j));
      vec2 id = g + cell;
      id.y = mod(id.y, ${n(P.webCells)});
      vec2 at = cell + 0.12 + 0.76 * vec2(stageHash(vec3(id, 1.7)), stageHash(vec3(id, 5.3))) - f;
      float dd = dot(at, at);
      if (dd < f1) {
        f2 = f1;
        f1 = dd;
      } else if (dd < f2) f2 = dd;
    }
  }
  float gap = sqrt(f2) - sqrt(f1);
  float per = ${n(P.webRings)} / max(len, 2.0);
  return vec2(1.0 - smoothstep(0.0, ${n(P.veinMm)} * per, gap), exp(-gap / (${n(P.veinGlowMm)} * per)));
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (uDiag != 0) discard;
  float there = uSummer.z;
  if (there <= 0.0) discard;
  vec2 way = uPoolAt.zw;
  vec2 d = vStageWorld.xz - uPoolAt.xy;
  // The sun is low and comes from behind the globe: what the globe throws on the slab is drawn out toward the front. h is
  // the pool's own plane, in millimetres across and in stretched millimetres toward the front.
  vec2 h = vec2(d.x, d.y * ${n(1 / P.stretch)}) + 0.0 * way;
  float s = uSummer.y;
  float rr = dot(h, h);
  float soft = exp(-rr / ${n(P.softMm * P.softMm)});
  float core = exp(-rr / ${n(P.coreMm * P.coreMm)});
  float glow = exp(-sqrt(rr) / ${n(P.glowMm)});
  // the veins: brightest by the knot, reaching further toward the left and the front than under the foot, the light on them
  // gathered in beads
  float lenW = sqrt(rr);
  vec2 web = poolWeb(h, s);
  float side = 0.3 + 0.7 * smoothstep(-0.5, 0.5, -h.x / max(lenW, 1.0));
  float bead = 0.55 + 0.45 * sin(h.x * 1.3 + 2.0 * sin(h.y * 0.9)) * sin(h.y * 1.7 + 1.0 + 1.5 * sin(h.x * 0.6));
  float folds = (web.x * bead + ${n(P.veinGlow)} * web.y) * exp(-lenW / ${n(P.webMm)}) * (1.0 - smoothstep(${n(P.webEndMm[0])}, ${n(P.webEndMm[1])}, lenW)) * side * smoothstep(1.0, 4.0, lenW);
  // the knot's short rays: two uneven fans of them, turning a little with the swing, gone a few millimetres out
  float ang = atan(h.y, h.x) + 0.04 * s;
  float len = sqrt(rr);
  float fan = pow(abs(sin(ang * 6.5 + 1.3)), 26.0) * (0.55 + 0.45 * sin(ang * 3.0 + 0.7)) + 0.6 * pow(abs(sin(ang * 10.5 + 0.4)), 34.0) * (0.5 + 0.5 * sin(ang * 5.0 + 2.1));
  float rays = fan * exp(-len / ${n(P.raysMm)}) * smoothstep(0.8, 3.0, len);
  vec3 col = ${vec(P.gold)} * (${n(P.gain)} * soft + ${n(P.bands)} * folds + ${n(P.rays)} * rays) + ${vec(P.pale)} * (${n(P.core)} * core + ${n(P.glow)} * glow);
  // the sun on the table: a strip of it gets past the globe on the far side of its shadow, which runs down the light's way
  // and softens as it goes; the strip is brightest by the foot and gone a hand's width out
  vec2 f = vStageWorld.xz - uPoolFoot;
  float along = dot(f, way);
  float beside = dot(f, vec2(-way.y, way.x));
  float soften = ${n(P.shadeSoftMm)} + 0.12 * max(along, 0.0);
  float strip = smoothstep(${n(P.shadeMm)} - soften, ${n(P.shadeMm)} + soften, beside) * exp(-max(beside - ${n(P.shadeMm)}, 0.0) / ${n(P.stripMm)});
  col += ${vec(P.sunColor)} * (${n(P.sun)} * strip * exp(-length(f) / ${n(P.sunMm)}));
  gl_FragColor = vec4(col * there, 0.0);
}`

const added = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const

function makeFlare(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uFlareSun: uniforms.uFlareSun, uSummer: uniforms.uSummer },
    vertexPars: 'uniform vec4 uFlareSun;\nvarying vec2 vFl;\nvarying vec2 vFlOut;\nvarying float vFlGain;',
    vertexMain: `
vec3 flV = normalize(cameraPosition - uLensCentre);
vec3 flH = normalize(flV + uFlareSun.xyz);
vec3 flP = uLensCentre + flH * ${n(RS + 0.6)};
vec4 flC = viewMatrix * vec4(uLensCentre, 1.0);
vec4 flAt = viewMatrix * vec4(flP, 1.0);
vec2 flOut = flAt.xy - flC.xy;
vFlOut = flOut / max(length(flOut), 1e-4);
vFl = position.xy;
// a mirror at a grazing angle returns far more of the light than one seen face on
float flCos = clamp(dot(flH, flV), 0.0, 1.0);
vFlGain = clamp((0.04 + 0.96 * pow(1.0 - flCos, 5.0)) / 0.2, 0.25, 1.6);
flAt.xy += position.xy * ${n(F.halfMm)};
gl_Position = projectionMatrix * flAt;
vStageWorld = flP;
vStageLocal = (uGlobeInv * vec4(flP, 1.0)).xyz;
vStagePlaced = flP;
vStageAux = vec3(0.0, -flAt.z, length(flAt.xyz));`,
    fragment: FLARE,
    params: { ...added, depthTest: false },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)
  mesh.renderOrder = 14
  mesh.frustumCulled = false
  return mesh
}

function makeWall(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uFlareSun: uniforms.uFlareSun, uSummer: uniforms.uSummer },
    vertexPars: 'uniform vec4 uFlareSun;\nvarying vec2 vWl;\nvarying vec2 vWlDir;',
    vertexMain: `
vec4 wlC = viewMatrix * vec4(uLensCentre, 1.0);
vec3 wlSun = (viewMatrix * vec4(uFlareSun.xyz, 0.0)).xyz;
// the side of the limb away from the sun, a little below the middle
vWlDir = normalize(vec2(wlSun.x < 0.0 ? 1.0 : -1.0, -${n(W.low)}));
// the limb of a sphere seen from near is a little wider than its radius
float wlR = ${n(RS)} / sqrt(max(1.0 - ${n(RS * RS)} / dot(wlC.xyz, wlC.xyz), 0.5));
vWl = position.xy * 1.25;
vec4 wlAt = wlC;
wlAt.xy += vWl * wlR;
gl_Position = projectionMatrix * wlAt;
vStageWorld = uLensCentre;
vStageLocal = (uGlobeInv * vec4(uLensCentre, 1.0)).xyz;
vStagePlaced = uLensCentre;
vStageAux = vec3(0.0, -wlAt.z, length(wlAt.xyz));`,
    fragment: WALL,
    params: { ...added, depthTest: false },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)
  mesh.renderOrder = 13
  mesh.frustumCulled = false
  return mesh
}

function makePool(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uSummer: uniforms.uSummer, uPoolAt: uniforms.uPoolAt, uPoolFoot: uniforms.uPoolFoot },
    fragment: POOL,
    params: { ...added },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), m)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.3
  mesh.renderOrder = 1
  mesh.frustumCulled = false
  return mesh
}

let flare: THREE.Object3D | undefined
let pool: THREE.Mesh | undefined

/** What the season puts on the glass: the flare and the light on the far wall. It rides in the globe's group and places itself from the eye and the light. */
export function dressing(): THREE.Object3D {
  if (!flare) {
    flare = new THREE.Group()
    flare.add(makeWall(), makeFlare())
  }
  return flare
}

/** The pool of light on the slab. It lies in the floor's group: `slab.ts` adds it to what it lays on the surface. */
export function surfacePool(): THREE.Object3D {
  pool ??= makePool()
  return pool
}

export async function prepare(): Promise<void> {}

const smooth = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v))

/** How far the light is kindled, by the time since the landing: 0 on the landing frame, over 1 for a moment, then 1. */
export function kindled(sinceLanding: number): number {
  if (!(sinceLanding < Infinity)) return 1
  const t = Math.max(0, sinceLanding)
  return smooth(t / F.kindleSeconds) * (1 + F.flash * Math.exp(-t / F.flashSeconds) * smooth(t / (0.5 * F.kindleSeconds)))
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  const swap = config.shake.swapWindow
  const shaking = moment.beat !== null && moment.beat >= swap.fromBeat
  const two = f.from !== f.to && f.change > 0 && f.change < 1
  // Inside the swap window the light goes with the dressing; after it the globe is in the hand, turning, and the light does
  // not hold on the glass until the landing kindles it.
  let lit = kindled(moment.sinceLanding)
  if (two) lit = shaking && moment.arrived < 1 ? 0 : 1 - smooth(f.change / 0.6)
  else if (shaking) {
    const through = (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat)
    lit = through >= 1 ? 0 : 1 - partChange('glass-dressing', through)
  }
  // Leaving: the liquid floods before the window opens, and a ball of milk throws no sun. The flare, the hot patch and the pool
  // go out over most of a beat before the swap, so nothing of summer's light is left on the glass or the table when the outside
  // changes; the change never has to cut them.
  const leaving = f.from.veil === veil && f.to.veil !== veil
  if (moment.beat !== null && (leaving || f.from === f.to)) lit = Math.min(lit, 1 - smooth((moment.beat - (swap.fromBeat - look.leaveBeats[0])) / (look.leaveBeats[0] - look.leaveBeats[1])))
  const key = rig.key.from
  const sun = uniforms.uFlareSun.value
  const len = Math.hypot(key[0], key[1] - 70, key[2]) || 1
  sun.set(key[0] / len, (key[1] - 70) / len, key[2] / len, lit)

  // The pool follows the globe: its middle lies down the light's way from the foot, further when the globe is lifted (the sun
  // is low), and it leans with the globe's tilt. After the landing it swings to rest with the liquid.
  const g = f.globe
  const flat = Math.hypot(key[0], key[2]) || 1
  const wx = -key[0] / flat
  const wz = -key[2] / flat
  const t = moment.sinceLanding < Infinity ? Math.max(0, moment.sinceLanding) : 1e3
  const swing = shaking || two ? 0 : Math.exp(-t / P.swingSeconds) * Math.sin(TAU * P.swingHz * t)
  const reach = P.reachMm + g.y * P.liftPerMm
  const leanX = -Math.sin(g.tiltZ) * P.tiltMm
  const leanZ = Math.sin(g.tiltX) * P.tiltMm
  uniforms.uPoolAt.value.set(g.x + wx * reach + wz * P.sideMm + leanX, g.z + wz * reach - wx * P.sideMm + leanZ, wx, wz)
  uniforms.uPoolFoot.value.set(g.x, g.z)
  const held = Math.min(1, Math.max(0, g.y / config.shake.liftMm))
  const there = lit * (1 - 0.65 * smooth(held)) * (shaking || two ? 1 : smooth(t / P.settleSeconds) * 0.999 + 0.001)
  // the storm's glow goes with the liquid: none in still water, whole when it churns
  const kept = holdStorm(moment)
  // and it hands over with the veil: leaving, it thins as the next season's veil takes the liquid, never in a cut
  const gale = Math.max(smooth((f.turbulence - W.stormFrom) / (W.stormTo - W.stormFrom)) * (leaving ? 1 - f.mix.veil : 1), kept)
  uniforms.uSummer.value.set(moment.time, P.swing * swing + 8 * (Math.sin(g.tiltZ) - Math.sin(g.tiltX)), there, gale)
}
