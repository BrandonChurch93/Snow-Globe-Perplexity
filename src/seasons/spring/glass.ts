import * as THREE from 'three'
import { config } from '../../config'
import { stageShader, stageUniforms } from '../../core/materials'
import { shellUniforms } from '../../globe/shell'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import type { Dressing, KitMoment } from '../kit'
import { mist, updateMist } from './veil'

/**
 * Part `glass-dressing-spring`: dew and rain on the outside of the glass.
 *
 * Three things are drawn, all on the glass and all from one clock, the time since the landing:
 * - the dew: thousands of beads a tenth to a third of a millimetre across, thick along the upper limbs and in patches;
 * - the beads: a few hundred larger drops;
 * - the runs: a handful of drops that gather near the top, slide down a wandering path in fits and starts, swallow the beads
 *   in their way and grow, leave a wet trail that breaks into droplets and dries from the top, hang a while where they stop
 *   and then run off to the collar. When a run is over the dew comes back on its track and a new run starts elsewhere.
 * Every drop is a small lens: it shows what is behind it upside down and small (a copy of the frame as it stands when the
 * glass has been drawn), dark at its edge, with the key's glint on it and a crescent of light on the side away from the key.
 *
 * Nothing fades. A bead comes by growing from nothing, each at its own time after the landing (the dew within the first
 * second, as in the approved shake image; the beads over the next three), and goes by shrinking, each at its own place in the
 * change. When the globe is lifted and shaken the runs run off and their trails dry, so the glass carries only still dew
 * into the swap; between the swap and the landing the glass is bare.
 */
const PART = 'glass-dressing-spring'
const RS = config.globe.sphereDiameterMm / 2
const RAD = Math.PI / 180
const SLOTS = 26
const SEGMENTS = 72
const TAU = Math.PI * 2

export const standIns: string[] = []

export const glassDressing: Dressing = { tint: [1, 1, 1], amount: 0 }

const look = {
  dew: { count: 9000, mm: [0.07, 0.34], skew: 2.2, bornBy: 0.3, growSeconds: 0.5 },
  bead: { count: 420, mm: [0.38, 1.25], skew: 2.6, bornBy: 1.2, growSeconds: 1 },
  /** Lowest place of a still drop and the place a run leaves the glass, as polar angles from the top. */
  lowDeg: 118,
  offDeg: 131,
  run: { headMm: [0.8, 1.35], track: 0.42, fromDeg: [9, 50], goDeg: [22, 52], trailDeg: [3, 8], wander: [0, 0.004], waves: [2, 4], slideSeconds: [9, 17], hangSeconds: [3, 8], offSeconds: 1.3, drySeconds: 3, firstBy: 9 },
  /** How far toward the camera a drop is drawn, so that the glass under it never cuts it at the limb. */
  liftMm: 14,
  /** How much of the frame a drop gathers, as a share of the frame's height, and how dark its edge is. */
  field: 0.2,
  trailField: 0.008,
  film: 0.98,
  /** How much of what a film gathers is lost at its edge, and how much of the film is seen at its head and where it is oldest. */
  filmEdge: 0.9,
  filmShown: [0.5, 0.18],
  body: 0.96,
  edge: 0.5,
  mirror: 0.35,
  /** Toward the limb a drop is seen edge on and would be a burr on the outline of the glass: how square to the eye the glass must be for a drop to be drawn at all, and to be drawn whole. */
  limb: [0.02, 0.2],
  glint: 5,
  crescent: 0.55,
}

const dewUniforms = {
  /** Seconds since the landing (below 0: the glass is bare), how far the runs are shaken off, the radius of the glass. */
  uDew: { value: new THREE.Vector4(-1, 0, RS, 0) },
  /** Per run: where it starts round the glass and down it, how far it wanders and how often. */
  uPathA: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
  /** Per run: the phase of its wander, where its head is, where its trail has dried to, the radius of its head. */
  uPathB: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
  /** Per run: half the width of its track in millimetres, and a number of its own. */
  uPathC: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
}

const behindUniforms = {
  uBehind: { value: null as THREE.Texture | null },
  uBehindSize: { value: new THREE.Vector2(0, 0) },
}

const lightUniforms = {
  uKeyDir: shellUniforms.uKeyDir,
  uKeyCol: shellUniforms.uKeyCol,
  uRimDir: shellUniforms.uRimDir,
  uRimCol: shellUniforms.uRimCol,
}

const f = (n: number): string => n.toFixed(4)

const PATH_GLSL = `
uniform vec4 uDew;
uniform vec4 uPathA[${SLOTS}];
uniform vec4 uPathB[${SLOTS}];
uniform vec4 uPathC[${SLOTS}];
float dewPhi(vec4 a, float phase, float th) {
  float s = th - a.y;
  return a.x + a.z * (sin(a.w * s + phase) + 0.4 * sin(2.3 * a.w * s + 1.7 * phase)) / max(sin(th), 0.35);
}
vec3 dewDir(float th, float ph) {
  float st = sin(th);
  return vec3(st * sin(ph), cos(th), st * cos(ph));
}
`

const FRAME_GLSL = `
// The frame of a drop as the camera sees it: across and down the glass, each no thinner than four tenths of its width,
// since a drop stands off the glass and is never seen edge on.
void dewFrame(vec3 dir, vec3 down, out vec3 centre, out vec3 eye, out vec3 across, out vec3 along, out vec2 squash) {
  vec3 nw = normalize(mat3(modelMatrix) * dir);
  centre = (modelMatrix * vec4(dir * (uDew.z + 0.05), 1.0)).xyz;
  eye = normalize(cameraPosition - centre);
  vec3 g = normalize(mat3(modelMatrix) * down);
  vec3 a1 = g - eye * dot(eye, g);
  float l1 = length(a1);
  along = a1 / max(l1, 1e-4);
  across = normalize(cross(eye, along));
  vec3 u = cross(nw, g);
  squash = vec2(max(length(u - eye * dot(eye, u)), 0.4), max(l1, 0.4));
}
`

const BEAD_VERT_PARS = `
attribute vec4 aDrop;
attribute vec4 aLife;
varying vec3 vDewQ;
varying vec3 vDewN;
varying vec3 vDewA0;
varying vec3 vDewA1;
varying vec2 vDewInfo;
${PATH_GLSL}
${FRAME_GLSL}
`

const BEAD_VERT = `
vec3 dDir = aDrop.xyz;
float dR = aDrop.w;
float dTail = 0.0;
float dOn = 0.0;
float tau = uDew.x;
if (aLife.z > 1.5) {
  int j = int(aLife.w + 0.5);
  float th = uPathB[j].y;
  dDir = dewDir(th, dewPhi(uPathA[j], uPathB[j].x, th));
  dR = uPathB[j].w;
  dTail = 0.55;
  dOn = dR > 0.0 && tau >= 0.0 ? 1.0 : 0.0;
} else if (tau >= 0.0) {
  float span = aLife.z > 0.5 ? ${f(look.bead.growSeconds)} : ${f(look.dew.growSeconds)};
  dOn = pow(clamp((tau - aLife.x) / span, 0.0, 1.0), 0.4);
  float th = acos(clamp(dDir.y, -1.0, 1.0));
  float ph = atan(dDir.x, dDir.z);
  for (int j = 0; j < ${SLOTS}; j++) {
    vec4 a = uPathA[j];
    vec4 b = uPathB[j];
    float reach = b.w / uDew.z;
    if (th < a.y - 0.01 || th > b.y + reach) continue;
    float away = ph - dewPhi(a, b.x, th);
    away -= 6.2831853 * floor(away / 6.2831853 + 0.5);
    if (abs(away) * sin(th) * uDew.z > uPathC[j].x * 1.6 + 0.6 * dR) continue;
    dOn *= pow(clamp((b.z - th) / 0.3 - 0.15, 0.0, 1.0), 0.5);
  }
}
vec3 dC;
vec3 dEye;
vec3 dA0;
vec3 dA1;
vec2 dSq;
dewFrame(dDir, dDir * dDir.y - vec3(0.0, 1.0, 0.0) + vec3(1e-4, 0.0, 0.0), dC, dEye, dA0, dA1, dSq);
dOn *= smoothstep(${f(look.limb[0])}, ${f(look.limb[1])}, dot(normalize(mat3(modelMatrix) * dDir), dEye));
vec2 dQ = vec2(position.x, position.y > 0.0 ? position.y * (1.0 + dTail) : position.y);
vec3 dP = dC + dR * dOn * (dA0 * dQ.x * dSq.x - dA1 * dQ.y * dSq.y) + dEye * ${f(look.liftMm)};
vec4 dView = viewMatrix * vec4(dP, 1.0);
gl_Position = projectionMatrix * dView;
vStageWorld = dP;
vStageLocal = (uGlobeInv * vec4(dC, 1.0)).xyz;
vStageAux = vec3(0.0, -dView.z, length(dView.xyz));
vStagePlaced = dP;
vStageSeen = 1.0;
vDewQ = vec3(dQ.x, dQ.y, dTail);
vDewN = normalize(mat3(modelMatrix) * dDir);
vDewA0 = dA0;
vDewA1 = dA1;
vDewInfo = vec2(aLife.y, dR * dOn);
`

const SHADE_GLSL = `
${ROOM_GLSL}
uniform sampler2D uBehind;
uniform vec2 uBehindSize;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
// One tap of the frame behind the drop; a value that is not a number there counts as black.
vec3 dewTap(vec2 at) {
  vec3 c = textureLod(uBehind, clamp(at / uBehindSize, 0.002, 0.998), 0.0).rgb;
  return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : c;
}
// Whether this drop is still on the glass in the change, and how large: each drop shrinks away at its own moment.
float dewKeep(float own) {
  float c = stageChange();
  if (uState.w > 0.5 && uState.w < 1.5) return 0.0;
  if (uFlags.w < 1.0 && stageHash(vec3(gl_FragCoord.xy + 29.0, uSeed + 0.61)) >= uFlags.w) return 0.0;
  return uState.w > 1.5 ? smoothstep(0.0, 0.3, (1.0 - c) * 1.3 - own) : 1.0;
}
// The water: what the lens gathers, dark toward the edge where the light is thrown out of the drop; the room mirrored in
// its skin; the glints of the two lights; and the crescent the key throws through the drop onto its far side.
vec3 dewWater(vec3 body, vec3 n, vec3 eye, float d2, float crescent, float skin) {
  float edge = smoothstep(0.3, 1.0, d2);
  vec3 col = body * mix(${f(look.body)}, ${f(look.edge)}, edge * edge);
  float nv = max(dot(n, eye), 0.0);
  col += stageRoomSeen(reflect(-eye, n), 0.12) * (0.03 + ${f(look.mirror)} * pow(1.0 - nv, 3.0)) * skin;
  vec3 hk = normalize(uKeyDir + eye);
  vec3 hr = normalize(uRimDir + eye);
  col += uKeyCol * (${f(look.glint)} * pow(max(dot(n, hk), 0.0), 140.0) + ${f(look.crescent)} * crescent) * skin;
  col += uRimCol * ${f(look.glint)} * pow(max(dot(n, hr), 0.0), 90.0) * skin;
  return col;
}
`

const BEAD = `
${SHADE_GLSL}
varying vec3 vDewQ;
varying vec3 vDewN;
varying vec3 vDewA0;
varying vec3 vDewA1;
varying vec2 vDewInfo;
void main() {
  float keep = dewKeep(vDewInfo.x);
  if (keep <= 0.0 || vDewInfo.y <= 0.0) discard;
  vec2 q = vDewQ.xy / keep;
  // A run is a pear: round below, drawn out and narrowing above.
  float up = q.y > 0.0 ? q.y / (1.0 + vDewQ.z) : 0.0;
  vec2 e = vec2(q.x * (1.0 + 2.2 * vDewQ.z * up * up), q.y > 0.0 ? up : q.y);
  float d2 = dot(e, e);
  float soft = max(fwidth(d2), 1e-4) * 1.2;
  float a = 1.0 - smoothstep(1.0 - soft, 1.0, d2);
  if (a <= 0.004) discard;
  float h = sqrt(max(1.0 - d2, 0.0));
  vec3 eye = normalize(cameraPosition - vStageWorld);
  vec3 face = normalize(mix(eye, vDewN, 0.5));
  vec3 n = normalize(vDewA0 * e.x + vDewA1 * (-e.y) + face * (h + 0.12));
  vec3 body;
  if (uBehindSize.x > 0.0) {
    mat2 jac = mat2(dFdx(vDewQ.xy), dFdy(vDewQ.xy));
    float det = jac[0][0] * jac[1][1] - jac[1][0] * jac[0][1];
    vec2 off = abs(det) > 1e-9 ? inverse(jac) * vDewQ.xy : vec2(0.0);
    float rpx = max(length(off) / max(length(vDewQ.xy), 1e-3), 0.5);
    float field = uBehindSize.y * ${f(look.field)} * (0.35 + 0.65 * d2);
    body = dewTap(gl_FragCoord.xy - off * (1.0 + field / rpx));
  } else {
    body = stageRoomSoft(reflect(eye, n), 0.4);
  }
  vec2 kq = vec2(dot(uKeyDir, vDewA0), -dot(uKeyDir, vDewA1));
  float crescent = smoothstep(0.2, 0.75, d2) * (1.0 - smoothstep(0.8, 1.0, d2)) * pow(max(dot(normalize(e + 1e-5), -normalize(kq + 1e-5)), 0.0), 2.5);
  vec3 col = dewWater(body, n, eye, d2, crescent, 1.0);
  gl_FragColor = vec4(col * a, a);
  if (uDiag != 0) {
    if (a < 0.5) discard;
    gl_FragColor = stageDiag(vec3(0.8, 0.85, 0.9), n, 0.0, stageChange(), 0.0);
  }
}
`

const TRAIL_VERT_PARS = `
attribute vec3 aTrail;
varying vec4 vTrail;
varying vec3 vTrailN;
varying vec3 vTrailA;
${PATH_GLSL}
`

const TRAIL_VERT = `
int tj = int(aTrail.x + 0.5);
vec4 tA = uPathA[tj];
vec4 tB = uPathB[tj];
float tFrom = max(tB.z, tA.y);
float tLong = max(tB.y - tFrom, 0.0);
float tTh = tFrom + aTrail.y * tLong;
vec3 tDir = dewDir(tTh, dewPhi(tA, tB.x, tTh));
vec3 tNext = dewDir(tTh + 0.01, dewPhi(tA, tB.x, tTh + 0.01));
vec3 tC = (modelMatrix * vec4(tDir * (uDew.z + 0.04), 1.0)).xyz;
vec3 tEye = normalize(cameraPosition - tC);
vec3 tNw = normalize(mat3(modelMatrix) * tDir);
vec3 tAcross = normalize(cross(tEye, normalize(mat3(modelMatrix) * (tNext - tDir))));
// Wide where it joins the head, thin behind, and drawn to a point where it has dried.
float tWide = uPathC[tj].x * (0.72 + 0.28 * smoothstep(1.0 - min(0.12 / max(tLong, 1e-3), 1.0), 1.0, aTrail.y)) * smoothstep(0.0, min(0.05 / max(tLong, 1e-3), 0.5), aTrail.y);
if (uDew.x < 0.0 || tLong <= 0.0) tWide = 0.0;
tWide *= smoothstep(${f(look.limb[0])}, ${f(look.limb[1])}, dot(tNw, tEye));
vec3 tP = tC + tAcross * aTrail.z * tWide + tEye * ${f(look.liftMm)};
vec4 tView = viewMatrix * vec4(tP, 1.0);
gl_Position = projectionMatrix * tView;
vStageWorld = tP;
vStageLocal = (uGlobeInv * vec4(tC, 1.0)).xyz;
vStageAux = vec3(0.0, -tView.z, length(tView.xyz));
vStagePlaced = tP;
vStageSeen = 1.0;
vTrail = vec4(aTrail.z, tTh, tLong > 0.0 ? (tB.y - tTh) : 0.0, uPathC[tj].y);
vTrailN = tNw;
vTrailA = tAcross;
`

const TRAIL = `
${SHADE_GLSL}
varying vec4 vTrail;
varying vec3 vTrailN;
varying vec3 vTrailA;
void main() {
  float keep = dewKeep(fract(vTrail.w * 7.31));
  if (keep <= 0.0) discard;
  float x = vTrail.x / keep;
  float th = vTrail.y;
  // The film is not even: it swells and necks along its length, and behind the head it parts into droplets, more of them the
  // further the head has gone on.
  float wave = 0.5 + 0.5 * sin(th * 310.0 + vTrail.w * 40.0 + 1.6 * sin(th * 83.0 + vTrail.w * 9.0));
  float old = smoothstep(0.1, 1.5, vTrail.z);
  float wide = mix(0.66, 1.0, wave) * (1.0 - 0.3 * old);
  float gap = 0.5 + 0.5 * sin(th * 173.0 + vTrail.w * 23.0 + 2.1 * sin(th * 47.0));
  float whole = smoothstep(0.0, 0.2, gap - (old * 0.75 - 0.3));
  float w = wide * whole;
  if (w <= 0.02) discard;
  float e = abs(x) / w;
  float soft = max(fwidth(e), 1e-4) * 1.2;
  float a = 1.0 - smoothstep(1.0 - soft, 1.0, e);
  if (a <= 0.004) discard;
  float d2 = e * e;
  float h = sqrt(max(1.0 - d2, 0.0));
  vec3 eye = normalize(cameraPosition - vStageWorld);
  vec3 face = normalize(mix(eye, vTrailN, 0.5));
  vec3 n = normalize(vTrailA * (x / w) + face * (h + 0.2));
  vec3 body;
  if (uBehindSize.x > 0.0) {
    vec2 grad = vec2(dFdx(vTrail.x), dFdy(vTrail.x));
    float g2 = max(dot(grad, grad), 1e-9);
    vec2 off = grad * vTrail.x / g2;
    body = dewTap(gl_FragCoord.xy - off - normalize(grad) * (x / w) * uBehindSize.y * ${f(look.trailField)});
  } else {
    body = stageRoomSoft(reflect(eye, n), 0.4);
  }
  float crescent = smoothstep(0.15, 0.7, d2) * (1.0 - smoothstep(0.8, 1.0, d2)) * max(-sign(x) * dot(uKeyDir, vTrailA), 0.0);
  // A film is thin and clear: it shifts what is behind it a little and has no dark core and no dark edge.
  float rim = smoothstep(0.3, 1.0, d2);
  vec3 col = body * ${f(look.film)} * mix(1.0, ${f(look.filmEdge)}, rim * rim) + uKeyCol * (${f(look.crescent)} * 0.14 * crescent);
  // Older film is thinner: it shows less the further behind the head it lies.
  a *= mix(${f(look.filmShown[0])}, ${f(look.filmShown[1])}, old);
  gl_FragColor = vec4(col * a, a);
  if (uDiag != 0) {
    if (a < 0.5) discard;
    gl_FragColor = stageDiag(vec3(0.8, 0.85, 0.9), n, 0.0, stageChange(), 0.0);
  }
}
`

const blend = {
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const

/** A number from 0 to 1 that depends only on what it is given. */
function rnd(a: number, b: number, c: number): number {
  let h = (Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b) ^ Math.imul(c + 13, 0xc2b2ae35)) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39) >>> 0
  h ^= h >>> 15
  return (h >>> 8) / 16777216
}

const mixOf = (r: readonly number[], t: number): number => r[0]! + (r[1]! - r[0]!) * t

/** How thick the dew is at a place on the glass, 0 to 1: patches, more toward the top and toward the limb as the camera has it. */
function dewThick(x: number, y: number, z: number): number {
  const patch = 0.5 + 0.5 * Math.sin(5.1 * x + 1.3 + 2.2 * Math.sin(3.3 * y + 0.4)) * Math.sin(4.3 * y + 0.7 + 1.9 * Math.sin(2.9 * z + 2.0)) * Math.sin(3.7 * z + 2.1 + 1.6 * Math.sin(4.1 * x))
  const limb = 1 - Math.max(z, 0)
  // Along the limbs, and as a fine dusting over the top of the glass.
  const top = Math.min(1, Math.max(0, (y - 0.42) / 0.45))
  return Math.min(1, (0.1 + 0.9 * patch * patch) * Math.max(0.14 + 0.86 * limb * limb * limb, 0.95 * top * top * (3 - 2 * top)) * (0.55 + 0.45 * Math.max(y, 0)) * 1.6)
}

function beadsGeometry(): THREE.InstancedBufferGeometry {
  const total = look.dew.count + look.bead.count + SLOTS
  const drop = new Float32Array(total * 4)
  const life = new Float32Array(total * 4)
  const low = Math.cos(look.lowDeg * RAD)
  let o = 0
  let tries = 0
  const place = (kind: number, count: number, mm: readonly number[], skew: number, bornBy: number): void => {
    const end = o + count
    while (o < end) {
      const t = tries++
      const y = low + (1 - low) * rnd(t, 1, kind)
      const ph = (rnd(t, 2, kind) - 0.5) * 1.12 * Math.PI
      const s = Math.sqrt(Math.max(0, 1 - y * y))
      const x = s * Math.sin(ph)
      const z = s * Math.cos(ph)
      if (rnd(t, 3, kind) > dewThick(x, y, z) * (kind === 1 ? 0.6 + 0.4 * Math.max(x, 0) : 1)) continue
      drop.set([x, y, z, mm[0]! + (mm[1]! - mm[0]!) * rnd(t, 4, kind) ** skew], o * 4)
      // The first dew stands at once on the limbs; the rest of it and the beads come after.
      life.set([bornBy * rnd(t, 5, kind) ** 1.6, rnd(t, 6, kind), kind, 0], o * 4)
      o++
    }
  }
  place(0, look.dew.count, look.dew.mm, look.dew.skew, look.dew.bornBy)
  place(1, look.bead.count, look.bead.mm, look.bead.skew, look.bead.bornBy)
  for (let j = 0; j < SLOTS; j++, o++) {
    drop.set([0, 1, 0, 1], o * 4)
    life.set([0, rnd(j, 7, 2), 2, j], o * 4)
  }
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.setAttribute('aDrop', new THREE.InstancedBufferAttribute(drop, 4))
  g.setAttribute('aLife', new THREE.InstancedBufferAttribute(life, 4))
  g.instanceCount = total
  return g
}

function trailsGeometry(): THREE.BufferGeometry {
  const at: number[] = []
  const idx: number[] = []
  for (let j = 0; j < SLOTS; j++) {
    const base = at.length / 3
    for (let k = 0; k <= SEGMENTS; k++) at.push(j, k / SEGMENTS, -1, j, k / SEGMENTS, 1)
    for (let k = 0; k < SEGMENTS; k++) {
      const a = base + k * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(at.length), 3))
  g.setAttribute('aTrail', new THREE.Float32BufferAttribute(at, 3))
  g.setIndex(idx)
  return g
}

const copies = new Map<string, THREE.FramebufferTexture>()
let copied = -1

// The frame as it stands when the glass has been drawn, for the drops to look through. One copy serves the beads and the
// trails: it is taken before the first of them is drawn.
function copyBehind(renderer: THREE.WebGLRenderer, material: THREE.Material, first: boolean): void {
  const target = renderer.getRenderTarget()
  const u = behindUniforms
  ;(material as THREE.ShaderMaterial).uniformsNeedUpdate = true
  if (!target || target.samples > 0 || stageUniforms.uDiag.value !== 0) {
    u.uBehindSize.value.set(0, 0)
    return
  }
  if (!first && copied === renderer.info.render.frame && u.uBehindSize.value.x === target.width) return
  const type = target.texture.type
  const key = `${target.width} ${target.height} ${type}`
  let copy = copies.get(key)
  if (!copy) {
    if (copies.size >= 4) {
      for (const old of copies.values()) old.dispose()
      copies.clear()
    }
    copy = new THREE.FramebufferTexture(target.width, target.height)
    copy.type = type
    copy.magFilter = THREE.LinearFilter
    copy.minFilter = THREE.LinearFilter
    copy.colorSpace = THREE.NoColorSpace
    copies.set(key, copy)
  }
  renderer.copyFramebufferToTexture(copy)
  copied = renderer.info.render.frame
  u.uBehind.value = copy
  u.uBehindSize.value.set(target.width, target.height)
}

let group: THREE.Group | null = null

function make(): THREE.Group {
  const uniforms = { ...roomUniforms, ...lightUniforms, ...dewUniforms, ...behindUniforms }
  const trails = new THREE.Mesh(
    trailsGeometry(),
    stageShader({ part: PART, standIn: false, change: 'glass-dressing', uniforms, vertexPars: TRAIL_VERT_PARS, vertexMain: TRAIL_VERT, fragment: TRAIL, params: { ...blend } }),
  )
  trails.renderOrder = 11
  trails.frustumCulled = false
  trails.onBeforeRender = (renderer, _scene, _camera, _geometry, material) => copyBehind(renderer, material, true)
  const beads = new THREE.Mesh(
    beadsGeometry(),
    stageShader({ part: PART, standIn: false, change: 'glass-dressing', uniforms, vertexPars: BEAD_VERT_PARS, vertexMain: BEAD_VERT, fragment: BEAD, params: { ...blend } }),
  )
  beads.renderOrder = 11.1
  beads.frustumCulled = false
  beads.onBeforeRender = (renderer, _scene, _camera, _geometry, material) => copyBehind(renderer, material, false)
  return new THREE.Group().add(trails, beads, mist())
}

export async function prepare(): Promise<void> {}

export function dressing(): THREE.Object3D {
  group ??= make()
  return group
}

/** One run at one moment: its path this time round, where its head is, how far its trail has dried and how large it is. */
export function runAt(slot: number, since: number, shed: number): { a: [number, number, number, number]; b: [number, number, number, number]; c: [number, number, number, number] } {
  const R = look.run
  const start = slot < 5 ? 0.1 + 0.18 * slot : 0.8 + (R.firstBy - 0.8) * rnd(slot, 1, 99)
  const slide = mixOf(R.slideSeconds, rnd(slot, 2, 99))
  const hang = mixOf(R.hangSeconds, rnd(slot, 3, 99))
  const period = slide + hang + R.offSeconds + R.drySeconds + 0.8
  const went = since - start
  const round = went >= 0 ? Math.floor(went / period) : 0
  const from = mixOf(R.fromDeg, rnd(slot, 4, round)) * RAD
  const to = Math.min(from + mixOf(R.goDeg, rnd(slot, 5, round)) * RAD, 100 * RAD)
  const off = look.offDeg * RAD
  const phi = (rnd(slot, 6, round) - 0.45) * 0.86 * Math.PI
  const head = mixOf(R.headMm, rnd(slot, 7, round))
  const a: [number, number, number, number] = [phi, from, mixOf(R.wander, rnd(slot, 8, round)), mixOf(R.waves, rnd(slot, 9, round))]
  const c: [number, number, number, number] = [head * R.track, rnd(slot, 10, round), 0, 0]
  const phase = TAU * rnd(slot, 11, round)
  if (went < 0) return { a, b: [phase, from, from, 0], c }
  let local = went - round * period
  local += Math.min(1, Math.max(0, shed)) * (period - 1e-3 - local)
  const u = Math.min(1, local / slide)
  // In fits and starts: the pace falls to a fifth and rises to nearly twice, a few times on the way down.
  const fits = 3 + Math.floor(4 * rnd(slot, 12, round))
  const gone = u + (0.8 * Math.sin(TAU * fits * u)) / (TAU * fits)
  const run = Math.min(1, Math.max(0, (local - slide - hang) / R.offSeconds))
  const at = run > 0 ? to + (off - to) * run * run : from + (to - from) * gone
  const grown = Math.min(1, local / 0.5)
  const radius = run >= 1 ? 0 : head * (0.55 + 0.45 * u) * grown * grown * (3 - 2 * grown)
  const dryFrom = slide + 0.6 * hang
  const dryTo = slide + hang + R.offSeconds + R.drySeconds
  const dried = Math.min(1, Math.max(0, (local - dryFrom) / (dryTo - dryFrom)))
  // The wet trail is short: it dries behind the head as the head goes, shortens while the head hangs, and is gone after it.
  const hung = Math.min(1, Math.max(0, (local - slide) / hang))
  const wet = mixOf(R.trailDeg, rnd(slot, 13, round)) * RAD * (1 - 0.8 * hung)
  const tail = Math.max(from, at - wet, from + (off + 0.45 - from) * dried)
  return { a, b: [phase, at, tail, radius], c }
}

export function update(moment: KitMoment): void {
  const frame = moment.frame
  const swap = config.shake.swapWindow
  const beat = moment.beat
  const shaking = beat !== null && beat >= swap.fromBeat
  const two = frame.from !== frame.to && frame.change > 0 && frame.change < 1
  const finite = moment.sinceLanding < Infinity
  // Bare from the swap to the landing: as the incoming season inside the window, and after the window until the foot is down.
  const bare = two ? shaking && moment.arrived < 1 : shaking && (beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat) >= 1
  // Lifted and shaken, the runs run off and their trails dry: all of it gone by the time the swap window opens, so what the
  // glass carries into the swap does not depend on how long the season has stood.
  const lifted = beat === null ? 0 : Math.min(1, Math.max(0, (beat - 0.15) / (swap.fromBeat - 0.4)))
  const shed = !finite || two || shaking ? 1 : lifted * lifted * (3 - 2 * lifted)
  const since = bare ? -1 : finite ? Math.max(0, moment.sinceLanding) : 1e4
  dewUniforms.uDew.value.set(since, shed, RS, 0)
  for (let j = 0; j < SLOTS; j++) {
    const s = runAt(j, Math.max(0, since), bare ? 1 : shed)
    dewUniforms.uPathA.value[j]!.fromArray(s.a)
    dewUniforms.uPathB.value[j]!.fromArray(s.b)
    dewUniforms.uPathC.value[j]!.fromArray(s.c)
  }
  updateMist(moment, bare)
}
