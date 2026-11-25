import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { partChange } from '../../shake/change'
import type { Dressing, KitMoment } from '../kit'
import { rig } from './rig'

// Part `glass-dressing-summer`: the glass is clear, and what the season puts on it is light.
// 1. The flare: the reflection of the one strong warm light (the rig's key) on the outside of the glass. It sits where a sphere
//    mirrors that light toward the eye (the half vector between the eye and the light), which from the hero camera is the upper
//    right shoulder, at the limb. It is a small hot core squeezed along the limb, a warm halo and the star a lens draws round a
//    point that bright. It kindles on the landing.
// 2. The pool: the same light focused by the globe onto the slab, in front of the globe and to its left, inside the globe's own
//    shadow: a soft bright patch, long in the light's direction because the sun is low, with a few broad curved bands round it.
//    The bands move when the globe moves and swing to rest after the landing. No thin veins.
// Nothing here is stepped: both are functions of the moment's pose, of the time and of the time since the landing.
const PART = 'glass-dressing-summer'
const RS = config.globe.sphereDiameterMm / 2
const TAU = Math.PI * 2

export const standIns: string[] = []

export const glassDressing: Dressing = { tint: [1, 0.9, 0.6], amount: 0 }

export const look = {
  flare: {
    halfMm: 30,
    core: 34,
    coreAcross: 0.03,
    coreAlong: 0.062,
    halo: 1.1,
    haloWide: 0.2,
    veil: 0.16,
    rays: 2.6,
    spikes: 9,
    arc: 2.2,
    hot: [1, 0.9, 0.72] as const,
    warm: [1, 0.7, 0.38] as const,
    amber: [1, 0.52, 0.2] as const,
    // the landing: the flare is out while the globe is in the hand after the change, catches on the landing frame, overshoots and settles
    kindleSeconds: 0.22,
    flash: 0.55,
    flashSeconds: 0.3,
    breath: 0.05,
  },
  pool: {
    // where the hot middle of the pool lies from the foot's centre: down the light's way on the slab and a little across it
    reachMm: 86,
    sideMm: 5,
    // how far the low sun draws the pool out along its way
    stretch: 4.5,
    softMm: 26,
    gain: 0.1,
    core: 2.4,
    coreMm: 2.4,
    glow: 0.5,
    glowMm: 5,
    bands: 1.5,
    liftPerMm: 2.2,
    tiltMm: 160,
    swing: 1,
    swingSeconds: 1.1,
    swingHz: 1.7,
    settleSeconds: 0.18,
    gold: [1, 0.64, 0.28] as const,
    pale: [1, 0.86, 0.6] as const,
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
  // the star: thin spikes through the core, each with its own length, breathing a little
  float star = 0.0;
  for (int i = 0; i < ${F.spikes}; i++) {
    float fi = float(i);
    float a = (fi + 0.7 * flRnd(fi, 1.0)) * ${n(Math.PI / F.spikes)} + 0.35;
    vec2 d = vec2(cos(a), sin(a));
    float along = dot(p, d);
    float across = p.x * d.y - p.y * d.x;
    float side = along > 0.0 ? flRnd(fi, 2.0) : flRnd(fi, 3.0);
    float reach = (0.2 + 0.72 * side * side) * (0.75 + 0.5 * max(dot(d * sign(along), vFlOut), 0.0)) * (1.0 + ${n(F.breath)} * sin(uSummer.x * (0.9 + 1.3 * flRnd(fi, 4.0)) + 6.28 * flRnd(fi, 5.0)));
    float t = abs(along) / reach;
    float wide = 0.0035 + 0.012 * (1.0 - min(t, 1.0));
    star += exp(-across * across / (wide * wide)) * exp(-3.2 * t) * (0.45 + 0.55 * side);
  }
  vec3 col = ${vec(F.hot)} * (${n(F.core)} * core) + ${vec(F.warm)} * (${n(F.rays)} * star + ${n(F.arc)} * arc) + ${vec(F.amber)} * (${n(F.halo)} * halo);
  gl_FragColor = vec4(col * (lit * edge), 0.0);
}`

const P = look.pool
const POOL = `
uniform vec4 uSummer;
uniform vec4 uPoolAt;
// One fold of the light: a band along an arc that leaves the hot middle in the direction th and bends with the radius r
// (its sign is the side it bends to). It is brightest on its crest, widens as it runs and dies away along its length.
float poolFold(vec2 h, float th, float r, float len, float wide) {
  vec2 t = vec2(cos(th), sin(th));
  vec2 nrm = vec2(-t.y, t.x);
  vec2 d = h - nrm * r;
  float x = length(d) - abs(r);
  float s = atan(dot(d, t), -dot(d, nrm) * sign(r)) * abs(r);
  float w = wide * (1.0 + max(s, 0.0) / 70.0);
  // a fold of light has a hard bright edge on its outer side and thins away slowly on its inner side
  float crest = x > 0.0 ? exp(-x * x / (0.3 * w * w)) : exp(x / (1.6 * w)) * 0.6 + 0.4 * exp(-x * x / (0.3 * w * w));
  float run = 0.72 + 0.28 * sin(s * 0.21 + th * 7.0);
  return crest * run * exp(-max(s, 0.0) / len) * smoothstep(-1.0, 3.0, s);
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
  float folds = 0.0;
  folds += poolFold(h, 3.42 + 0.07 * s, 95.0 * (1.0 + 0.1 * s), 30.0, 1.1);
  folds += 0.85 * poolFold(h, 3.86 - 0.06 * s, -70.0 * (1.0 - 0.08 * s), 24.0, 1.0);
  folds += 0.8 * poolFold(h, 0.16 - 0.05 * s, -120.0 * (1.0 + 0.1 * s), 22.0, 1.1);
  folds += 0.6 * poolFold(h, 2.55 + 0.08 * s, -40.0 * (1.0 - 0.1 * s), 12.0, 0.9);
  folds += 0.55 * poolFold(h, 0.75 - 0.07 * s, 36.0 * (1.0 + 0.08 * s), 10.0, 0.9);
  folds += 0.45 * poolFold(h, 4.75 + 0.05 * s, 55.0, 12.0, 1.1);
  vec3 col = ${vec(P.gold)} * (${n(P.gain)} * soft + ${n(P.bands)} * folds) + ${vec(P.pale)} * (${n(P.core)} * core + ${n(P.glow)} * glow);
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

function makePool(): THREE.Mesh {
  const m = stageShader({
    part: PART,
    standIn: false,
    change: 'glass-dressing',
    uniforms: { uSummer: uniforms.uSummer, uPoolAt: uniforms.uPoolAt },
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

let flare: THREE.Mesh | undefined
let pool: THREE.Mesh | undefined

/** What the season puts on the glass: the flare. It rides in the globe's group and places itself from the eye and the light. */
export function dressing(): THREE.Object3D {
  flare ??= makeFlare()
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
  if (two) lit = shaking && moment.arrived < 1 ? 0 : 1
  else if (shaking) {
    const through = (moment.beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat)
    lit = through >= 1 ? 0 : 1 - partChange('glass-dressing', through)
  }
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
  const held = Math.min(1, Math.max(0, g.y / config.shake.liftMm))
  const there = lit * (1 - 0.65 * smooth(held)) * (shaking || two ? 1 : smooth(t / P.settleSeconds) * 0.999 + 0.001)
  uniforms.uSummer.value.set(moment.time, P.swing * swing + 8 * (Math.sin(g.tiltZ) - Math.sin(g.tiltX)), there, 0)
}
