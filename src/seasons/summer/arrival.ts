import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { stream } from '../../core/rng'
import { rimGapMm } from '../../shake/table'
import type { KitMoment } from '../kit'
import { SAND_COLOUR, sinceLoose } from './base'
import { SLAB, sandHeight, sandSpread } from './slab'

const PART = 'arrival-summer'
const RAD = Math.PI / 180

// The landing shakes the sand on the ledge loose. `jump` grains leave the ledge on the thump, fly, skid and come to rest on
// the slab, where they stay: at rest they are the single grains of the scatter. `pour` grains are the run of sand over the
// lip on the right, which the landing starts and which thins to a trickle that never quite stops. Every grain's place is a
// function of the time since the landing and of the clock, nothing is kept from frame to frame.
const LOOK = {
  gravity: 3400,
  ledge: { r: [46.5, 52.0], h: 40.3 },
  jump: { count: 14000, reachMm: 26, ringShare: 0.3, ringMm: 5, liftMm: [0.8, 11], hopMm: [0.3, 2.6], quick: 0.11, tail: 0.5, tailShare: [0.6, 0.12], skidMm: [0.4, 3.2], radiusMm: [0.12, 0.27] },
  pour: { count: 16000, az: 82, spread: 4.5, r: 52.4, h: 38.8, reachMm: [4.6, 11], fanDeg: 7, rate: [1.3, 2.3], radiusMm: [0.1, 0.2] },
  flow: { rest: 0.46, surge: 0.5, seconds: 1.3, gapMm: [0.3, 2.5] },
  shadow: { r: 57, top: [36, 41] },
  streak: 2.1,
}

const vec = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`

const grainUniforms = {
  uGrain: { value: new THREE.Vector4(50, 0, LOOK.flow.rest, 1 / 120) },
  uGrainLoop: { value: new THREE.Vector2(0, 12) },
  uGrainKey: { value: new THREE.Vector3(0, 1, 0) },
  uGrainKeyCol: { value: new THREE.Color() },
  uGrainSky: { value: new THREE.Color() },
  uGrainGround: { value: new THREE.Color() },
}

const VERT_PARS = `
attribute vec3 aFrom;
attribute vec4 aFlight;
attribute vec4 aSeed;
attribute vec2 aCorner;
uniform vec4 uGrain;
uniform vec2 uGrainLoop;
uniform vec3 uGrainKey;
varying vec2 vGrainUv;
varying vec4 vGrainLook;
varying vec2 vGrainShape;
varying float vGrainCover;
const float GRAVITY = ${LOOK.gravity.toFixed(1)};
vec3 grainPath(float tau) {
  float T = aFlight.y;
  float vy = aFlight.z;
  vec3 to = position;
  vec2 dir = normalize(to.xz - aFrom.xz + vec2(1e-4, 0.0));
  float skid = aSeed.w;
  vec2 touch = to.xz - dir * skid;
  if (tau < T) {
    vec3 p;
    p.xz = mix(aFrom.xz, touch, tau / T);
    p.y = aFrom.y + vy * tau - 0.5 * GRAVITY * tau * tau;
    return p;
  }
  float after = tau - T;
  float hop = skid * 0.45 * abs(sin(after * 38.0)) * exp(-after * 16.0);
  return vec3(to.xz - dir * skid * exp(-after * 13.0), to.y + hop).xzy;
}
float grainShade(vec3 p, vec3 L) {
  float a = dot(L.xz, L.xz);
  if (a < 1e-6) return 1.0;
  float b = dot(p.xz, L.xz);
  float c = dot(p.xz, p.xz) - ${(LOOK.shadow.r * LOOK.shadow.r).toFixed(1)};
  float disc = b * b - a * c;
  if (c < 0.0) return smoothstep(-8.0, 8.0, b);
  if (disc < 0.0) return 1.0;
  float s2 = (-b + sqrt(disc)) / a;
  if (s2 < 0.0) return 1.0;
  float s1 = max((-b - sqrt(disc)) / a, 0.0);
  return smoothstep(${LOOK.shadow.top[0].toFixed(1)}, ${LOOK.shadow.top[1].toFixed(1)}, p.y + s1 * L.y);
}
`

const VERT_MAIN = `
float grainT = uGrain.x;
float tau;
float alive = 1.0;
float airborne = 0.0;
if (aSeed.y < -0.5) {
  tau = max(grainT - aFlight.x, 0.0);
} else if (aSeed.y < 0.5) {
  tau = grainT - aFlight.x;
  if (grainT < 0.0 || tau < 0.0) alive = 0.0;
} else {
  float cycles = max(1.0, floor(uGrainLoop.y * aFlight.x + 0.5));
  tau = fract(uGrainLoop.x * cycles + aSeed.z) * (uGrainLoop.y / cycles);
  if (grainT < 0.0 || tau > grainT || tau >= aFlight.y || aSeed.x > uGrain.z) alive = 0.0;
}
tau = max(tau, 0.0);
vec3 nowAt = grainPath(tau);
vec3 thenAt = grainPath(max(tau - uGrain.w, 0.0));
airborne = tau < aFlight.y ? 1.0 : 0.0;
vec4 nowV = viewMatrix * modelMatrix * vec4(nowAt, 1.0);
vec4 thenV = viewMatrix * modelMatrix * vec4(thenAt, 1.0);
float size = aFlight.w * alive;
vec2 along = nowV.xy - thenV.xy;
float len = length(along);
vec2 axis = len > 1e-4 ? along / len : vec2(0.0, 1.0);
vec2 across = vec2(-axis.y, axis.x);
vec4 grainV = mix(thenV, nowV, aCorner.y * 0.5 + 0.5);
float streak = 1.0 + len / max(2.0 * aFlight.w, 1e-4);
float wide = 1.0 + 0.6 * airborne;
grainV.xy += (axis * aCorner.y + across * aCorner.x * wide) * size;
gl_Position = projectionMatrix * grainV;
vec4 grainW = modelMatrix * vec4(nowAt, 1.0);
vStageWorld = grainW.xyz;
vStageLocal = (uGlobeInv * grainW).xyz;
vStageAux = vec3(0.0, -grainV.z, length(grainV.xyz));
vStagePlaced = grainW.xyz;
vStageSeen = 1.0;
vGrainUv = aCorner;
vGrainShape = vec2(streak / wide, airborne);
vGrainCover = min(1.0, ${LOOK.streak.toFixed(2)} / streak) / wide;
vGrainLook = vec4(aSeed.x, fract(aSeed.x * 91.7 + aSeed.z * 13.1), grainShade(grainW.xyz, uGrainKey), alive);
`

const FRAG = `
uniform vec3 uGrainKey;
uniform vec3 uGrainKeyCol;
uniform vec3 uGrainSky;
uniform vec3 uGrainGround;
varying vec2 vGrainUv;
varying vec4 vGrainLook;
varying vec2 vGrainShape;
varying float vGrainCover;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  if (vGrainLook.w < 0.5) discard;
  float L = vGrainShape.x;
  float capY = sign(vGrainUv.y) * max(abs(vGrainUv.y) * L - (L - 1.0), 0.0);
  float d2 = vGrainUv.x * vGrainUv.x + capY * capY;
  if (d2 > 1.0) discard;
  vec3 nv = normalize(vec3(vGrainUv.x, capY, sqrt(1.0 - d2)));
  vec3 n = normalize(nv * mat3(viewMatrix));
  vec3 v = normalize(cameraPosition - vStageWorld);
  float id = vGrainLook.x;
  float id2 = vGrainLook.y;
  vec3 albedo = mix(${vec(SAND_COLOUR.deep)}, ${vec(SAND_COLOUR.pale)}, smoothstep(0.1, 0.75, id));
  albedo = mix(albedo, ${vec(SAND_COLOUR.dark)}, step(0.93, id2));
  albedo = mix(albedo, ${vec(SAND_COLOUR.white)}, step(id2, 0.12));
  float shade = mix(0.35, 1.0, vGrainLook.z);
  float ndl = dot(n, uGrainKey);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  float thru = pow(clamp(dot(-v, uGrainKey) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  vec3 dome = mix(uGrainGround, uGrainSky, 0.5 + 0.5 * n.y);
  albedo = mix(albedo, vec3(0.96, 0.92, 0.84), 0.55 * vGrainShape.y);
  vec3 col = albedo * RECIPROCAL_PI * (uGrainKeyCol * shade * (wrap + 1.8 + (0.6 + 5.0 * vGrainShape.y) * thru) + dome + uRigCardCol * 0.35 * clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0));
  float hk = max(dot(n, normalize(v + uGrainKey)), 0.0);
  col += uGrainKeyCol * shade * step(0.7, fract(id * 17.9)) * pow(hk, 60.0) * 1.2;
  float cover = vGrainCover * (1.0 - smoothstep(mix(0.55, 0.0, vGrainShape.y), 1.0, d2));
  gl_FragColor = vec4(col * cover, cover);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, n, 0.0, c, 0.0);
}
`

const frontLeft = (x: number, z: number): number => {
  const az = Math.atan2(x, z) / RAD
  return az > -150 && az < -8 ? 0.06 : 1
}

const flightOf = (lift: number, drop: number): { T: number; vy: number } => {
  const g = LOOK.gravity
  const vy = Math.sqrt(2 * g * Math.max(lift, 0))
  return { T: (vy + Math.sqrt(vy * vy + 2 * g * Math.max(drop, 0.5))) / g, vy }
}

function grainGeometry(): THREE.BufferGeometry {
  const total = LOOK.jump.count + LOOK.pour.count
  const to = new Float32Array(total * 12)
  const from = new Float32Array(total * 12)
  const flight = new Float32Array(total * 16)
  const seed = new Float32Array(total * 16)
  const corner = new Float32Array(total * 8)
  const index = new Uint32Array(total * 6)
  let n = 0
  const put = (t: number[], f: number[], fl: number[], s: number[]): void => {
    for (let k = 0; k < 4; k++) {
      const o = n * 4 + k
      to.set(t, o * 3)
      from.set(f, o * 3)
      flight.set(fl, o * 4)
      seed.set(s, o * 4)
      corner[o * 2] = k % 2 === 0 ? -1 : 1
      corner[o * 2 + 1] = k < 2 ? -1 : 1
    }
    index.set([n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 2, n * 4 + 1, n * 4 + 3], n * 6)
    n++
  }

  const rj = stream(`${PART}/jump`)
  const rx = stream(`${PART}/jump-x`)
  const rz = stream(`${PART}/jump-z`)
  const J = LOOK.jump
  let made = 0
  let tries = 0
  while (made < J.count && tries < J.count * 400) {
    tries++
    const pick = rj.next()
    const ringed = pick < J.ringShare
    const wide = !ringed && pick < J.ringShare + 0.12
    const ringAz = rj.range(-Math.PI, Math.PI)
    const ringR = 61.5 + -Math.log(Math.max(rj.next(), 1e-6)) * J.ringMm
    const x = ringed ? ringR * Math.sin(ringAz) : wide ? rx.range(SLAB.x[0], SLAB.x[1]) : rx.range(-6, 132)
    const z = ringed ? ringR * Math.cos(ringAz) : wide ? rz.range(SLAB.z[0], SLAB.z[1]) : rz.range(-70, 214)
    const r = Math.hypot(x, z)
    if (r < 61.5) continue
    const h = sandHeight(x, z)
    const far = Math.exp(-(r - 60) / 55)
    const want = ringed ? frontLeft(x, z) : h < 0.9 ? Math.min(1, 0.03 * far + 0.8 * sandSpread(x, z)) : 0.22
    if (rj.next() > want) continue
    const radius = J.radiusMm[0] + (J.radiusMm[1] - J.radiusMm[0]) * rj.next() ** 2
    const y = SLAB.liftMm + h + radius * 0.7
    const near = Math.min(1, Math.max(0, (r - 62) / J.reachMm))
    const flies = rj.next() > near
    const late = rj.next() < J.tailShare[0] + (J.tailShare[1] - J.tailShare[0]) * near
    const delay = late ? J.quick + -Math.log(Math.max(rj.next(), 1e-6)) * J.tail : rj.next() ** 1.5 * J.quick
    if (flies) {
      const az = Math.atan2(x, z) + rj.gauss() * 0.12
      const rl = rj.range(LOOK.ledge.r[0], LOOK.ledge.r[1])
      const lift = late ? rj.range(0.2, 2) : J.liftMm[0] + (J.liftMm[1] - J.liftMm[0]) * rj.next() ** 2 * (0.35 + 0.65 * near)
      const f = flightOf(lift, LOOK.ledge.h - y)
      put([x, y, z], [rl * Math.sin(az), LOOK.ledge.h, rl * Math.cos(az)], [delay, f.T, f.vy, radius], [rj.next(), 0, rj.next(), rj.range(J.skidMm[0], J.skidMm[1])])
    } else {
      const lift = J.hopMm[0] + (J.hopMm[1] - J.hopMm[0]) * rj.next() ** 2 * Math.exp(-(r - 60) / 90)
      const vy = Math.sqrt(2 * LOOK.gravity * lift)
      const f = { T: (2 * vy) / LOOK.gravity, vy }
      const drift = rj.range(0.1, 0.9)
      const turn = rj.range(-Math.PI, Math.PI)
      put([x, y, z], [x + drift * Math.sin(turn), y, z + drift * Math.cos(turn)], [rj.next() ** 1.5 * 0.05, f.T, f.vy, radius], [rj.next(), -1, rj.next(), rj.range(0.05, 0.5)])
    }
    made++
  }

  const rp = stream(`${PART}/pour`)
  const P = LOOK.pour
  for (let i = 0; i < P.count; i++) {
    const az0 = (P.az + rp.gauss() * P.spread) * RAD
    const reach = P.reachMm[0] + (P.reachMm[1] - P.reachMm[0]) * rp.next() ** 1.3
    const az1 = az0 + rp.gauss() * P.fanDeg * RAD * (reach / P.reachMm[1])
    const fx = P.r * Math.sin(az0)
    const fz = P.r * Math.cos(az0)
    const tx = (P.r + reach) * Math.sin(az1)
    const tz = (P.r + reach) * Math.cos(az1)
    const radius = rp.range(P.radiusMm[0], P.radiusMm[1])
    const ty = SLAB.liftMm + sandHeight(tx, tz) + radius * 0.5
    const f = flightOf(rp.next() * 0.6, P.h - ty)
    put([tx, ty, tz], [fx, P.h + rp.range(-0.4, 0.4), fz], [rp.range(P.rate[0], P.rate[1]), f.T, f.vy, radius], [rp.next(), 1, rp.next(), 0])
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(to.subarray(0, n * 12), 3))
  g.setAttribute('aFrom', new THREE.BufferAttribute(from.subarray(0, n * 12), 3))
  g.setAttribute('aFlight', new THREE.BufferAttribute(flight.subarray(0, n * 16), 4))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, n * 16), 4))
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner.subarray(0, n * 8), 2))
  g.setIndex(new THREE.BufferAttribute(index.subarray(0, n * 6), 1))
  return g
}

export async function prepare(): Promise<void> {}

// The grains lie on the slab and fall past the foot, outside the glass, so they are drawn with the surface dressing (slab.ts
// adds them to its group); nothing of this arrival is inside the globe.
export function grains(): THREE.Mesh {
  const m = stageShader({ part: PART, standIn: false, change: 'surface-dressing', vertexPars: VERT_PARS, vertexMain: VERT_MAIN, fragment: FRAG, uniforms: grainUniforms, params: { side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } })
  const mesh = new THREE.Mesh(grainGeometry(), m)
  mesh.frustumCulled = false
  return mesh
}

export function arrival(): THREE.Object3D {
  return new THREE.Group()
}

export function update(moment: KitMoment): void {
  const f = moment.frame
  const t = sinceLoose(moment)
  const u = grainUniforms
  const film = config.film as { fps: number; shutterDegrees: number }
  const shutter = film.shutterDegrees / 360 / film.fps
  const down = 1 - Math.min(1, Math.max(0, (rimGapMm(f.globe) - LOOK.flow.gapMm[0]) / (LOOK.flow.gapMm[1] - LOOK.flow.gapMm[0])))
  const surge = t < Infinity ? LOOK.flow.surge * Math.exp(-Math.max(t, 0) / LOOK.flow.seconds) : 0
  u.uGrain.value.set(t < 0 ? -1 : Math.min(t, 50), 0, t < 0 ? 0 : (LOOK.flow.rest + surge) * down, shutter)
  u.uGrainLoop.value.set((((moment.time / moment.period) % 1) + 1) % 1, moment.period)
  u.uGrainKey.value.copy(f.keyDir)
  u.uGrainKeyCol.value.copy(f.keyCol)
  u.uGrainSky.value.copy(f.sky).multiplyScalar(f.fill)
  u.uGrainGround.value.copy(f.ground).multiplyScalar(f.fill)
}
