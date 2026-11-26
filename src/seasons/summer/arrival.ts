import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { meshLevel } from '../../core/models'
import { stream } from '../../core/rng'
import { rimGapMm } from '../../shake/table'
import type { KitMoment } from '../kit'
import { SAND_COLOUR, sinceLoose } from './base'
import { SLAB, sandHeight, sandSpread } from './slab'

const PART = 'arrival-summer'
const RAD = Math.PI / 180

// The landing shakes the sand on the ledge loose. `jump` grains leave the ledge on the thump, fly, skid and come to rest on
// the slab; once they lie still they fade and are no longer drawn, and the slab's own sand is what lies there. `fall`
// grains are the sand that runs over the lip at the right shoulder and falls past the flank onto the crest of the mound:
// the landing starts it with a surge, and it runs on as a thin standing fall for as long as the globe stands on the
// table. A grain leaves the lip with the speed it has from sliding down the bank, far enough out to clear the belly of
// the stone, and falls under gravity less the drag on a grain a fifth of a millimetre wide. Every grain's place is a
// function of the time since the landing and of the clock, nothing is kept from frame to frame. The mirror of the slab
// gets none of the grains; medium and low draw a share.
//
// A grain is drawn where it is when the shutter opens, with its own short blur along its path, and does not move through
// the samples of one picture: across a whole shutter a falling grain is a line dozens of pixels long, and a line drawn
// from a few samples is a row of dashes.
const LOOK = {
  gravity: 3400,
  ledge: { r: [46.5, 52.0], h: 40.3 },
  jump: { count: 14000, reachMm: 26, ringShare: 0, ringMm: 5, edgeDeg: [62, 76], liftMm: [1.2, 8], hopMm: [0.6, 5], quick: 0.11, tail: 0.5, tailShare: [0.6, 0.12], skidMm: [0.4, 3.2], radiusMm: [0.07, 0.15] },
  fall: { count: 14000, gravity: 7000, az: 85, spread: 5, r: [53.0, 53.4], h: [41.3, 42.4], outMmS: [4, 165], lean: 2.4, fanDeg: 2.5, downMmS: [10, 110], rate: [5.0, 6.7], radiusMm: [0.04, 0.11], fadeFrom: 0.94, core: [0.66, 5, 90] },
  slope: { clearMm: 0.25, keeps: 0.75, crestMm: [60.5, 62.1], offMm: [0.5, 1.3], belly: [[60.3, 8], [60.3, 11.2], [59.7, 14.6], [58.6, 18], [57.3, 21.2], [55.8, 24.4], [54.3, 27.4], [53, 30.5], [52.8, 34], [52.7, 37.5], [52.6, 40]] },
  flow: { stand: 0.65, seconds: 1.6, gapMm: [0.3, 2.5] },
  exposure: 0.15,
  gold: [1, 0.89, 0.72],
  backlit: 2.6,
  shadow: { r: 57, top: [36, 41] },
  streak: 2.1,
  blurRadii: 3,
  gone: [6.5, 8],
  share: { medium: 0.6, low: 0.3 } as Record<string, number>,
  stride: 7919,
}

const vec = (v: readonly number[]): string => `vec3(${v.map((x) => x.toFixed(3)).join(', ')})`

const grainUniforms = {
  uGrain: { value: new THREE.Vector4(50, 0, 0, 1 / 120) },
  uGrainLoop: { value: new THREE.Vector2(0, 12) },
  uGrainLevel: { value: 1 },
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
uniform float uGrainLevel;
uniform vec3 uGrainKey;
varying vec2 vGrainUv;
varying vec4 vGrainLook;
varying vec2 vGrainShape;
varying float vGrainCover;
varying float vGrainLit;
float fallSlide() {
  if (aSeed.w <= 0.0) return 0.0;
  float G = ${LOOK.fall.gravity.toFixed(1)};
  float T = aFlight.y;
  float touchY = aFrom.y + aFlight.z * T - 0.5 * G * T * T;
  return max(touchY - position.y, 0.0) / (${LOOK.slope.keeps.toFixed(2)} * (G * T - aFlight.z));
}
vec3 grainPath(float tau) {
  float GRAVITY = aSeed.y > 0.5 ? ${LOOK.fall.gravity.toFixed(1)} : ${LOOK.gravity.toFixed(1)};
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
  if (aSeed.y > 0.5) {
    float touchY = aFrom.y + vy * T - 0.5 * GRAVITY * T * T;
    float s = clamp((tau - T) / max(fallSlide(), 1e-4), 0.0, 1.0);
    float off = sin(3.14159 * s) * mix(${LOOK.slope.offMm[0].toFixed(2)}, ${LOOK.slope.offMm[1].toFixed(2)}, abs(sin(s * 7.0 + aSeed.z * 40.0)));
    return vec3(mix(touch, to.xz, s) + dir * off, mix(touchY, to.y, s)).xzy;
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
  if (grainT < 0.0 || tau > grainT || tau >= aFlight.y + fallSlide() || fract(aSeed.z * 61.3 + aSeed.x * 17.7) > uGrain.z || fract(aSeed.z * 23.9 + 0.37) > uGrainLevel) alive = 0.0;
}
tau = max(tau, 0.0);
vec3 nowAt = grainPath(tau);
vec3 thenAt = grainPath(max(tau - uGrain.w, 0.0));
airborne = tau < aFlight.y || aSeed.y > 0.5 ? 1.0 : 0.0;
vec4 nowV = viewMatrix * modelMatrix * vec4(nowAt, 1.0);
vec4 thenV = viewMatrix * modelMatrix * vec4(thenAt, 1.0);
float size = aFlight.w * alive;
vec2 along = nowV.xy - thenV.xy;
float len = length(along);
vec2 axis = len > 1e-4 ? along / len : vec2(0.0, 1.0);
vec2 across = vec2(-axis.y, axis.x);
float blur = min(len, ${LOOK.blurRadii.toFixed(2)} * aFlight.w);
vec4 grainV = nowV;
grainV.xy -= axis * (blur * (0.5 - 0.5 * aCorner.y));
float streak = 1.0 + blur / max(2.0 * aFlight.w, 1e-4);
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
vGrainCover = (aSeed.y > 0.5 ? 1.0 : 1.0 - uGrain.y) * min(1.0, ${LOOK.streak.toFixed(2)} / streak) / wide;
if (aSeed.y > 0.5) vGrainCover *= 1.0 - smoothstep(${LOOK.fall.fadeFrom.toFixed(2)}, 1.0, tau / max(aFlight.y + fallSlide(), 1e-4));
vGrainLit = aSeed.y > 0.5 ? mix(${LOOK.fall.core[0].toFixed(2)}, 1.0, smoothstep(${LOOK.fall.core[1].toFixed(1)}, ${LOOK.fall.core[2].toFixed(1)}, (length(position.xz - aFrom.xz) - aSeed.w) / max(aFlight.y, 1e-3))) : 1.0;
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
varying float vGrainLit;
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
  float shade = mix(0.25, 1.0, vGrainLook.z) * vGrainLit;
  float ndl = dot(n, uGrainKey);
  float wrap = clamp((ndl + 0.45) / 1.45, 0.0, 1.0);
  float thru = pow(clamp(dot(-v, uGrainKey) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  vec3 dome = mix(uGrainGround, uGrainSky, 0.5 + 0.5 * n.y);
  albedo *= mix(vec3(1.0), ${vec(LOOK.gold)} * (0.7 + 0.6 * fract(id2 * 7.3)), vGrainShape.y);
  vec3 col = albedo * RECIPROCAL_PI * (uGrainKeyCol * shade * (wrap + 1.8 + (0.6 + ${LOOK.backlit.toFixed(2)} * vGrainShape.y) * thru) + dome + uRigCardCol * 0.35 * clamp(dot(n, uRigCardDir) * 0.5 + 0.5, 0.0, 1.0));
  float hk = max(dot(n, normalize(v + uGrainKey)), 0.0);
  col += uGrainKeyCol * shade * step(0.7, fract(id * 17.9)) * pow(abs(hk), 60.0) * 1.2;
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

export interface FallPath {
  from: [number, number, number]
  to: [number, number, number]
  seconds: number
  life: number
  slide: number
  vy: number
  rate: number
  radius: number
  id: number
  phase: number
}

export const FALL = { gravity: LOOK.fall.gravity, count: LOOK.fall.count, stand: LOOK.flow.stand }

// The stone's flank below the lip, radius at height (assets-src/base-summer/profile.mjs, BODY).
const stoneAt = (h: number): number => {
  const b = LOOK.slope.belly
  for (let i = 0; i + 1 < b.length; i++) if (h >= b[i]![1]! && h <= b[i + 1]![1]!) return b[i]![0]! + ((b[i + 1]![0]! - b[i]![0]!) * (h - b[i]![1]!)) / (b[i + 1]![1]! - b[i]![1]!)
  return h < b[0]![1]! ? b[0]![0]! : 0
}

// A grain leaves the lip with the speed it has from sliding down the bank. The quick ones clear the belly of the stone
// and land on the mound. The slow ones meet the belly, and tumble down it onto the crest of the mound.
export function fallPaths(): FallPath[] {
  const rf = stream(`${PART}/fall`)
  const F = LOOK.fall
  const S = LOOK.slope
  const out: FallPath[] = []
  const step = 0.0005
  let tries = 0
  while (out.length < F.count && tries++ < F.count * 50) {
    const az0 = (F.az + rf.gauss() * F.spread) * RAD
    const az1 = az0 + rf.gauss() * F.fanDeg * RAD
    const speed = F.outMmS[0] + (F.outMmS[1] - F.outMmS[0]) * rf.next() ** F.lean
    const r0 = rf.range(F.r[0], F.r[1])
    const h0 = rf.range(F.h[0], F.h[1])
    const radius = F.radiusMm[0] + (F.radiusMm[1] - F.radiusMm[0]) * rf.next() ** 2
    const vy = -rf.range(F.downMmS[0], F.downMmS[1])
    const rate = rf.range(F.rate[0], F.rate[1])
    const id = rf.next()
    const phase = rf.next()
    const crest = rf.range(S.crestMm[0], S.crestMm[1])
    const from: [number, number, number] = [r0 * Math.sin(az0), h0, r0 * Math.cos(az0)]
    const at = (s: number): [number, number, number] => [from[0] + speed * s * Math.sin(az1), h0 + vy * s - 0.5 * F.gravity * s * s, from[2] + speed * s * Math.cos(az1)]
    const ground = (x: number, z: number): number => SLAB.liftMm + sandHeight(x, z) + radius * 0.5
    let done: FallPath | undefined
    for (let s = step; s < 0.2 && !done; s += step) {
      const [x, h, z] = at(s)
      const r = Math.hypot(x, z)
      if (r <= stoneAt(h) + S.clearMm) {
        const seconds = s - step
        const [tx, th, tz] = at(seconds)
        const tr = Math.hypot(tx, tz)
        const slide = Math.max(crest - tr, 0.3)
        const to: [number, number, number] = [tx + slide * Math.sin(az1), 0, tz + slide * Math.cos(az1)]
        to[1] = ground(to[0], to[2])
        if (th - to[1] < 1) break
        done = { from, to, seconds, life: seconds + (th - to[1]) / (S.keeps * (F.gravity * seconds - vy)), slide, vy, rate, radius, id, phase }
      } else if (h <= ground(x, z)) {
        const seconds = s - step
        const [tx, , tz] = at(seconds)
        const ty = ground(tx, tz)
        const exact = (vy + Math.sqrt(vy * vy + 2 * F.gravity * Math.max(h0 - ty, 0.5))) / F.gravity
        done = { from, to: [from[0] + speed * exact * Math.sin(az1), ty, from[2] + speed * exact * Math.cos(az1)], seconds: exact, life: exact, slide: 0, vy, rate, radius, id, phase }
      }
    }
    if (done) out.push(done)
  }
  return out
}

function grainGeometry(): THREE.BufferGeometry {
  const total = LOOK.jump.count + LOOK.fall.count
  const to = new Float32Array(total * 12)
  const from = new Float32Array(total * 12)
  const flight = new Float32Array(total * 16)
  const seed = new Float32Array(total * 16)
  const corner = new Float32Array(total * 8)
  const index = new Uint32Array(total * 6)
  let n = 0
  const put = (t: readonly number[], f: readonly number[], fl: readonly number[], s: readonly number[]): void => {
    for (let k = 0; k < 4; k++) {
      const o = n * 4 + k
      to.set(t, o * 3)
      from.set(f, o * 3)
      flight.set(fl, o * 4)
      seed.set(s, o * 4)
      corner[o * 2] = k % 2 === 0 ? -1 : 1
      corner[o * 2 + 1] = k < 2 ? -1 : 1
    }
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
    const want = ringed ? frontLeft(x, z) : h < 0.9 ? Math.min(1, 0.8 * sandSpread(x, z)) : 0.22
    if (rj.next() > want) continue
    const radius = J.radiusMm[0] + (J.radiusMm[1] - J.radiusMm[0]) * rj.next() ** 2
    const y = SLAB.liftMm + h + radius * 0.7
    const near = Math.min(1, Math.max(0, (r - 62) / J.reachMm))
    // Only the grains bound for the right edge leave the ledge: a narrow shower against the light, as the approved image has it.
    // The rest hop where they lie, so nothing falls across the front of the stone and no line of fresh grains rings the foot.
    const edge = Math.min(1, Math.max(0, (Math.atan2(x, z) / RAD - J.edgeDeg[0]) / (J.edgeDeg[1] - J.edgeDeg[0])))
    const flies = rj.next() > near && rj.next() < edge
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

  const firstFall = n
  for (const g of fallPaths()) put(g.to, g.from, [g.rate, g.seconds, g.vy, g.radius], [g.id, 1, g.phase, g.slide])

  // The fall is first in the list, so that at rest it alone is drawn; within each kind the order is shuffled.
  const order = (first: number, count: number, at: number): void => {
    for (let k = 0; k < count; k++) {
      const q = first + ((k * LOOK.stride) % count)
      index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], (at + k) * 6)
    }
  }
  order(firstFall, n - firstFall, 0)
  order(0, firstFall, n - firstFall)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(to.subarray(0, n * 12), 3))
  g.setAttribute('aFrom', new THREE.BufferAttribute(from.subarray(0, n * 12), 3))
  g.setAttribute('aFlight', new THREE.BufferAttribute(flight.subarray(0, n * 16), 4))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, n * 16), 4))
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner.subarray(0, n * 8), 2))
  g.setIndex(new THREE.BufferAttribute(index.subarray(0, n * 6), 1))
  return g
}

let field: THREE.Mesh | undefined

export function fallShare(sinceLoose: number): number {
  const F = LOOK.flow
  if (sinceLoose < 0) return 0
  if (!(sinceLoose < Infinity)) return F.stand
  return F.stand + (1 - F.stand) * Math.exp(-sinceLoose / F.seconds)
}

export async function prepare(): Promise<void> {}

// The grains lie on the slab and fall past the foot, outside the glass, so they are drawn with the surface dressing (slab.ts
// adds them to its group); nothing of this arrival is inside the globe.
export function grains(): THREE.Mesh {
  const m = stageShader({ part: PART, standIn: false, change: 'surface-dressing', vertexPars: VERT_PARS, vertexMain: VERT_MAIN, fragment: FRAG, uniforms: grainUniforms, params: { side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } })
  const mesh = new THREE.Mesh(grainGeometry(), m)
  mesh.frustumCulled = false
  const whole = mesh.geometry.index!.count / 6
  const fall = LOOK.fall.count
  mesh.onBeforeRender = () => {
    const share = LOOK.share[meshLevel()] ?? 1
    grainUniforms.uGrainLevel.value = share
    const drawn = mesh.matrixWorld.determinant() < 0 ? 0 : grainUniforms.uGrain.value.y < 1 ? fall + Math.floor((whole - fall) * share) : fall
    mesh.geometry.setDrawRange(0, 6 * drawn)
  }
  mesh.onAfterRender = () => {
    mesh.geometry.setDrawRange(0, Infinity)
  }
  field = mesh
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
  const open = f.sample === null ? moment.time : Math.floor(moment.time * film.fps + 0.25) / film.fps
  const at = t >= 0 && t < Infinity ? Math.max(0, t - (moment.time - open)) : t
  const down = 1 - Math.min(1, Math.max(0, (rimGapMm(f.globe) - LOOK.flow.gapMm[0]) / (LOOK.flow.gapMm[1] - LOOK.flow.gapMm[0])))
  const out = Math.min(1, Math.max(0, (at - LOOK.gone[0]!) / (LOOK.gone[1]! - LOOK.gone[0]!)))
  const gone = at < 0 || !(at < Infinity) ? 1 : out * out * (3 - 2 * out)
  const falling = fallShare(at) * down
  if (field) field.visible = gone < 1 || falling > 0
  u.uGrain.value.set(at < 0 ? -1 : Math.min(at, 50), gone, falling, shutter * LOOK.exposure)
  u.uGrainLoop.value.set((((open / moment.period) % 1) + 1) % 1, moment.period)
  u.uGrainKey.value.copy(f.keyDir)
  u.uGrainKeyCol.value.copy(f.keyCol)
  u.uGrainSky.value.copy(f.sky).multiplyScalar(f.fill)
  u.uGrainGround.value.copy(f.ground).multiplyScalar(f.fill)
}
