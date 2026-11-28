import * as THREE from 'three'
import { config } from '../../config'
import { stageShader, stageUniforms } from '../../core/materials'
import { resolveBehind } from '../../core/accumulator'
import { Pass } from '../../core/fullscreen'
import { setGlass, shellUniforms } from '../../globe/shell'
import { ROOM_GLSL, roomUniforms } from '../../scene/room'
import { lensUniforms } from '../../scene/cameras'
import type { KitMoment } from '../kit'
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
 * Nothing fades. A bead comes by growing from nothing, each at its own time, and goes by shrinking, each at its own place
 * in the change. When the globe is lifted and shaken the runs run off and their trails dry, so the glass carries only still
 * dew into the swap. The season that comes is dressed while the storm hides it: inside the swap window the dew grows, then
 * the beads, and the film forms patch by patch; from the window's close to the landing the runs swell where they stand, each
 * at its own time. At the landing the glass carries what it carries at rest, and the runs slide on from there.
 */
const PART = 'glass-dressing-spring'
const RS = config.globe.sphereDiameterMm / 2
const RAD = Math.PI / 180
const SLOTS = 26

setGlass('spring', { windowTint: [1, 0.9, 0.93], windowGain: [0.5, 0.25, 1, 1], windowSoftDeg: 3, windowGrain: 0.5, rimTint: [1.4, 1.3, 1], wallTint: [0.72, 0.83, 0.61], ringCover: 0.35, strip: 0, bend: 0, ringThin: 1, rimClear: 0.3, topLine: 0, ringMottle: 0.3, ceiling: 0.15, roomHue: [1.1, 0.92, 0.95], roomHueOn: 1, windowShade: 0, rimGlow: 1, arcs: 3, arcTint: [1, 0.74, 0.8], arcCool: 0.45 })
const SEGMENTS = 14
const TAU = Math.PI * 2

const look = {
  /** Where the runs' clock stands at the landing, seconds before its zero: the first run of the rest picture starts this long after the landing and a little more. */
  afterLanding: 0.6,
  /**
   * The glass at the landing. `formed` is what the dew's clock reads from the swap window's close on (past the film's
   * `formSeconds`, so all of it stands), reached through the window along `formPower` so that the first dew takes its time.
   * A run that would start within `carried` seconds of its clock's zero is already on its way at the landing, `young`
   * seconds old, and gathers pace until `paceBy`; a later one has the run before it still on the glass, which slides on,
   * hangs for `hangSeconds`, runs off and has dried `drySeconds` and `gapSeconds` before the new one starts. Each swells
   * from nothing over `swell` of the way from the window's close to the landing, starting within `swellFrom` of it.
   */
  landing: { formed: 8, formPower: 1.5, carried: 2.8, young: 1.2, paceBy: 11, hangSeconds: 1, drySeconds: 1.2, gapSeconds: 0.2, swellFrom: [0.05, 0.5], swell: 0.5 },
  dew: { count: 8600, mm: [0.07, 0.34], skew: 2.2, bornBy: 0.3, growSeconds: 0.5 },
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
  limb: [0.08, 0.3],
  /** Out of focus a drop is a soft disc: how much blur, as an angle (its radius over its distance; 0.0007 is under 3 pixels of the hd frame at the hero), the lens gives away before a drop is drawn soft at all. From the hero the glass is within it and the dew is sharp; from the macro it is far outside it. */
  sharp: 0.0007,
  glint: 5,
  crescent: 0.55,
  /**
   * The breath of condensation on the glass: a thin pale film, thickest over the top of the glass and where the glass turns
   * away from the eye, in patches, drawn out downward where water has run through it, with the finest dew standing in it as
   * bright specks. It is one cap of the glass (its triangles are taken out of the dew's count) and all of it is worked out
   * where the eye's ray meets the glass, so the cap's own facets are never seen.
   */
  breath: {
    cols: 32,
    rows: 12,
    lowDeg: 112,
    /** How far down the cap itself reaches (the caustic low on the left stands below the film). */
    capDeg: 128,
    offMm: 0.5,
    /** How thick the film is (its share of the light at a square look, where it is thickest), and how much of that stands low on the glass. */
    thick: 0.2,
    lowShare: 0.07,
    /** How much of it the patches and the runs take away. */
    patch: 0.55,
    streak: 0.3,
    /** The light it scatters: of the key, of the rim, of the room. */
    key: 0.5,
    rim: 0.35,
    room: 1.2,
    tint: [1, 0.95, 0.97],
    /** Seconds after the landing by which it has formed, patch by patch. */
    formSeconds: 7,
    /** The specks: the cell they stand in, their radius, and how bright they are against the film. */
    speckMm: [0.55, 1.3],
    speckR: [0.035, 0.13],
    speck: 2.6,
    /**
     * The rivulets: where water has run down through the film it has left thin winding lines of clear water, each with a
     * bright edge toward the key and a dark one away from it. One to a cell around the glass, in two sets: how many cells, the
     * share of them that carry a run on the shoulder toward the key (which way round that is, and the share of that share left on the far side), where a run starts and how long it is (degrees down from the top), how far it winds (a
     * share of its cell) and how often, its half width in mm, and how bright and how dark its edges are.
     */
    rill: { cells: [64, 41], share: 0.85, sideRad: 1.12, off: 0, fromDeg: [30, 48], lenDeg: [10, 22], wind: 0.75, windPer: 8, mm: [0.28, 0.5], bright: 1.4, key: 0.08, dark: 0.07, darkCover: 0.8 },
    /** The shoulder toward the key: the film is thicker there and scatters the key's light cool, in the texture of the film. Its direction, how tight it is, how much thicker, how bright, its colour. */
    sheen: { dir: [0.74, 0.48, 0.47], power: 6, thick: 1.4, gain: 0.4, tint: [0.66, 0.84, 1] },
    /** The caustic: the key's light, gathered by the globe, falls on the inside of the glass low on the far side, a warm patch of bright curved threads. Its direction, how wide, how bright, its colour, how much it veils, and the seconds after the landing by which it stands. */
    caustic: { dir: [-0.86, -0.3, 0.41], wide: 0.2, gain: 3.2, tint: [1, 0.7, 0.46], veil: 0.25, formSeconds: 0.8 },
  },
}

const dewUniforms = {
  /** Seconds since the landing (below 0: the glass is bare), how far the runs are shaken off, the radius of the glass. */
  uDew: { value: new THREE.Vector4(-1, 0, RS, 0) },
  /** Per run: where it starts round the glass and down it, how far it wanders and how often. */
  uPathA: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
  /** Per run: the phase of its wander, where its head is, where its trail has dried to, the radius of its head. */
  uPathB: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
  /** Per run: half the width of its track in millimetres, a number of its own, and how far it has swollen from nothing. */
  uPathC: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
}

const behindUniforms = {
  uBehind: { value: null as THREE.Texture | null },
  uBehindSize: { value: new THREE.Vector2(0, 0) },
  uSoft: { value: null as THREE.Texture | null },
}

// The lens as the stage has it this frame: its aperture and the distance it is focused at.
const lensOwn = {
  uDewLens: lensUniforms.uFar,
}

const lightUniforms = {
  uKeyDir: shellUniforms.uKeyDir,
  uKeyCol: shellUniforms.uKeyCol,
  uRimDir: shellUniforms.uRimDir,
  uRimCol: shellUniforms.uRimCol,
}

const f = (n: number): string => n.toFixed(4)
const vec = (v: readonly number[]): string => `vec3(${v.map(f).join(', ')})`
const norm = (v: readonly number[]): number[] => {
  const l = Math.hypot(...v)
  return v.map((x) => x / l)
}

const PATH_GLSL = `
uniform vec4 uDew;
uniform vec4 uPathA[${SLOTS}];
uniform vec4 uPathB[${SLOTS}];
uniform vec4 uPathC[${SLOTS}];
uniform vec4 uDewLens;
// How far out of focus a thing of this size (millimetres) at this depth is: the radius of its blur over its own radius.
float dewSoft(float size, float depth) {
  float blur = max(uDewLens.z * abs(depth * uDewLens.w - 1.0) - ${f(look.sharp)} * depth, 0.0);
  return blur / max(size, 0.0001 * depth);
}
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
  vec3 wide = cross(eye, along);
  across = dot(wide, wide) > 0.0 ? normalize(wide) : vec3(1.0, 0.0, 0.0);
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
varying float vDewSoft;
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
  float ph = dot(dDir.xz, dDir.xz) > 0.0 ? atan(dDir.x, dDir.z) : 0.0;
  for (int j = 0; j < ${SLOTS}; j++) {
    vec4 a = uPathA[j];
    vec4 b = uPathB[j];
    float reach = b.w / uDew.z;
    if (th < a.y - 0.01 || th > b.y + reach) continue;
    float away = ph - dewPhi(a, b.x, th);
    away -= 6.2831853 * floor(away / 6.2831853 + 0.5);
    if (abs(away) * sin(th) * uDew.z > uPathC[j].x * 1.6 + 0.6 * dR) continue;
    float back = pow(clamp((b.z - th) / 0.3 - 0.15, 0.0, 1.0), 0.5);
    dOn *= uPathC[j].z < 1.0 ? mix(1.0, back, clamp(uPathC[j].z, 0.0, 1.0)) : back;
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
float dSoft = dewSoft(dR * dOn, max(dot(cameraPosition - dC, vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])), 1.0));
dQ *= 1.0 + dSoft;
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
vDewSoft = dSoft;
`

const SHADE_GLSL = `
${ROOM_GLSL}
uniform sampler2D uBehind;
uniform sampler2D uSoft;
uniform vec2 uBehindSize;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
// The frame behind the drop: the mean of the span pixels of it that one pixel of the drop stands for.
vec3 dewTap(vec2 at, float span) {
  vec2 uv = clamp(at / uBehindSize, 0.002, 0.998);
  float level = log2(max(span, 1.0));
  vec3 soft = textureLod(uSoft, uv, max(level - 1.0, 0.0)).rgb;
  if (level >= 1.0) return soft;
  vec3 c = textureLod(uBehind, uv, 0.0).rgb;
  return mix(any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : c, soft, level);
}
// Whether this drop is still on the glass in the change, and how large: each drop shrinks away at its own moment.
float dewKeep(float own) {
  float c = stageChange();
  if (uFlags.w < 1.0 && stageHash(vec3(gl_FragCoord.xy + 29.0, uSeed + 0.61)) >= uFlags.w) return 0.0;
  return uState.w > 1.5 ? smoothstep(0.0, 0.3, (1.0 - c) * 1.3 - own) : 1.0;
}
// The water: what the lens gathers, dark toward the edge where the light is thrown out of the drop; the room mirrored in
// its skin; the glints of the two lights; and the crescent the key throws through the drop onto its far side.
vec3 dewWater(vec3 body, vec3 n, vec3 eye, float d2, float crescent, float skin) {
  float edge = smoothstep(0.3, 1.0, d2);
  vec3 col = body * mix(${f(look.body)}, ${f(look.edge)}, edge * edge * skin);
  float nv = max(dot(n, eye), 0.0);
  // A glint is drawn no narrower than two pixels, with the same light in all, and the room in the skin is as soft.
  float turn = max(length(dFdx(n)), length(dFdy(n)));
  float lobe = 1.386 / max(turn * turn, 1e-6);
  float pk = clamp(lobe, 1.0, 140.0);
  float pr = clamp(lobe, 1.0, 90.0);
  col += stageRoomSeen(reflect(-eye, n), sqrt(0.0144 + 1.2 * min(turn, 2.0))) * (0.03 + ${f(look.mirror)} * pow(abs(1.0 - nv), 3.0)) * skin;
  vec3 hk = normalize(uKeyDir + eye);
  vec3 hr = normalize(uRimDir + eye);
  col += uKeyCol * (${f(look.glint)} * (pk / 140.0) * pow(max(dot(n, hk), 0.0), pk) + ${f(look.crescent)} * crescent) * skin;
  col += uRimCol * ${f(look.glint)} * (pr / 90.0) * pow(max(dot(n, hr), 0.0), pr) * skin;
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
varying float vDewSoft;
void main() {
  float keep = dewKeep(vDewInfo.x);
  if (keep <= 0.0 || vDewInfo.y <= 0.0) discard;
  vec2 q = vDewQ.xy / keep;
  // A run is a pear: round below, drawn out and narrowing above.
  float up = q.y > 0.0 ? q.y / (1.0 + vDewQ.z) : 0.0;
  vec2 e = vec2(q.x * (1.0 + 2.2 * vDewQ.z * up * up), q.y > 0.0 ? up : q.y);
  // Out of focus the drop is a wider, fainter, softer disc with the same light in it, and what is sharp in it goes first.
  float wide = 1.0 + vDewSoft;
  float rr = length(e);
  float soft = max(fwidth(rr), 1e-4) * 1.2;
  float a = (1.0 - smoothstep(max(1.0 - vDewSoft, 0.0) - soft, wide, rr)) / (wide * wide);
  if (a <= 0.002) discard;
  if (rr > 0.999) e *= 0.999 / rr;
  float d2 = dot(e, e);
  float sharp = 1.0 / (1.0 + 3.0 * vDewSoft);
  float h = sqrt(max(1.0 - d2, 0.0));
  vec3 eye = normalize(cameraPosition - vStageWorld);
  vec3 mid = mix(eye, vDewN, 0.5);
  vec3 face = dot(mid, mid) > 0.0 ? normalize(mid) : eye;
  vec3 n = normalize(vDewA0 * e.x + vDewA1 * (-e.y) + face * (h + 0.12));
  vec3 body;
  if (uBehindSize.x > 0.0) {
    mat2 jac = mat2(dFdx(vDewQ.xy), dFdy(vDewQ.xy));
    float det = jac[0][0] * jac[1][1] - jac[1][0] * jac[0][1];
    vec2 off = abs(det) > 1e-9 ? inverse(jac) * vDewQ.xy : vec2(0.0);
    float rpx = max(length(off) / max(length(vDewQ.xy), 1e-3), 0.5);
    float reach = uBehindSize.y * ${f(look.field)};
    float field = reach * (0.35 + 0.65 * d2);
    float span = min(1.0 + reach * (0.35 + 1.95 * d2) / rpx, max(reach, 1.0));
    body = dewTap(gl_FragCoord.xy - off * (1.0 + field / rpx), span);
  } else {
    body = stageRoomSoft(reflect(eye, n), 0.4);
  }
  vec2 kq = vec2(dot(uKeyDir, vDewA0), -dot(uKeyDir, vDewA1));
  float crescent = smoothstep(0.2, 0.75, d2) * (1.0 - smoothstep(0.8, 1.0, d2)) * pow(max(dot(normalize(e + 1e-5), -normalize(kq + 1e-5)), 0.0), 2.5);
  vec3 col = dewWater(body, n, eye, d2, crescent, sharp);
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
varying float vTrailSoft;
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
vec3 tSide = cross(tEye, normalize(mat3(modelMatrix) * (tNext - tDir)));
vec3 tAcross = dot(tSide, tSide) > 0.0 ? normalize(tSide) : vec3(1.0, 0.0, 0.0);
// Wide where it joins the head, thin behind, and drawn to a point where it has dried.
float tWide = uPathC[tj].x * (0.72 + 0.28 * smoothstep(1.0 - min(0.12 / max(tLong, 1e-3), 1.0), 1.0, aTrail.y)) * smoothstep(0.0, min(0.05 / max(tLong, 1e-3), 0.5), aTrail.y);
if (uDew.x < 0.0 || tLong <= 0.0) tWide = 0.0;
tWide *= uPathC[tj].z;
tWide *= smoothstep(${f(look.limb[0])}, ${f(look.limb[1])}, dot(tNw, tEye));
float tSoft = dewSoft(tWide, max(dot(cameraPosition - tC, vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])), 1.0));
vec3 tP = tC + tAcross * aTrail.z * tWide * (1.0 + tSoft) + tEye * ${f(look.liftMm)};
vec4 tView = viewMatrix * vec4(tP, 1.0);
gl_Position = projectionMatrix * tView;
vStageWorld = tP;
vStageLocal = (uGlobeInv * vec4(tC, 1.0)).xyz;
vStageAux = vec3(0.0, -tView.z, length(tView.xyz));
vStagePlaced = tP;
vStageSeen = 1.0;
vTrailSoft = tSoft;
vTrail = vec4(aTrail.z * (1.0 + tSoft), tTh, tLong > 0.0 ? (tB.y - tTh) : 0.0, uPathC[tj].y);
vTrailN = tNw;
vTrailA = tAcross;
`

const TRAIL = `
${SHADE_GLSL}
varying vec4 vTrail;
varying vec3 vTrailN;
varying vec3 vTrailA;
varying float vTrailSoft;
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
  float a = (1.0 - smoothstep(max(1.0 - vTrailSoft, 0.0) - soft, 1.0 + vTrailSoft, e)) / (1.0 + vTrailSoft);
  if (a <= 0.002) discard;
  e = min(e, 0.999);
  x = clamp(x, -0.999 * w, 0.999 * w);
  float d2 = e * e;
  float h = sqrt(max(1.0 - d2, 0.0));
  vec3 eye = normalize(cameraPosition - vStageWorld);
  vec3 mid = mix(eye, vTrailN, 0.5);
  vec3 face = dot(mid, mid) > 0.0 ? normalize(mid) : eye;
  vec3 n = normalize(vTrailA * (x / w) + face * (h + 0.2));
  vec3 body;
  if (uBehindSize.x > 0.0) {
    vec2 grad = vec2(dFdx(vTrail.x), dFdy(vTrail.x));
    float g2 = max(dot(grad, grad), 1e-9);
    vec2 off = grad * vTrail.x / g2;
    body = dewTap(gl_FragCoord.xy - off - grad * inversesqrt(g2) * (x / w) * uBehindSize.y * ${f(look.trailField)}, 1.0 + uBehindSize.y * ${f(look.trailField)} * sqrt(g2) / w);
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

const FILM_VERT_PARS = `
varying vec3 vFilmCentre;
`

const FILM_VERT = `
vFilmCentre = modelMatrix[3].xyz;
`

const FILM = `
${SHADE_GLSL}
uniform vec4 uDew;
uniform vec4 uDewLens;
varying vec3 vFilmCentre;
float filmHash(vec3 c) {
  return fract(sin(dot(c, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float filmNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(filmHash(i), filmHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(filmHash(i + vec3(0.0, 1.0, 0.0)), filmHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(filmHash(i + vec3(0.0, 0.0, 1.0)), filmHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(filmHash(i + vec3(0.0, 1.0, 1.0)), filmHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// The specks of one size: one to a cell, each at its own place and of its own radius; x is how much of the pixel a speck
// covers, y how brightly it glints. Out of focus (blur, mm) a speck is wider and fainter.
vec2 filmSpecks(vec3 pm, float cell, float blur) {
  vec3 id = floor(pm / cell);
  vec3 h = vec3(filmHash(id + 0.13), filmHash(id + 17.31), filmHash(id + 41.77));
  float r = mix(${f(look.breath.speckR[0])}, ${f(look.breath.speckR[1])}, pow(abs(filmHash(id + 71.9)), 2.2)) * cell / ${f(look.breath.speckMm[0])};
  float d = length(pm - (id + 0.5 + (h - 0.5) * 0.5) * cell);
  float wide = min(r + blur, 0.42 * cell);
  float aa = max(fwidth(d), 1e-4);
  float there = step(filmHash(id + 29.3), 0.55);
  return vec2(there * (1.0 - smoothstep(wide - aa, wide + aa, d)) * (r * r) / (wide * wide), step(0.6, filmHash(id + 5.5)));
}
// The rivulets of one set: x is how much of the pixel a run covers, y where across the run the pixel is (-1 to 1).
vec2 filmRill(float th, float ph, float cells, float seed, float grown, float blur) {
  float u = ph * cells / 6.2831853;
  float id = floor(u);
  vec3 k = vec3(id, seed, 0.0);
  float there = step(filmHash(k + 0.31), ${f(look.breath.rill.share)} * mix(${f(look.breath.rill.off)}, 1.0, smoothstep(0.62, 0.93, cos((id + 0.5) * 6.2831853 / cells - ${f(look.breath.rill.sideRad)}))));
  float from = mix(${f(look.breath.rill.fromDeg[0] * RAD)}, ${f(look.breath.rill.fromDeg[1] * RAD)}, filmHash(k + 3.7));
  float len = mix(${f(look.breath.rill.lenDeg[0] * RAD)}, ${f(look.breath.rill.lenDeg[1] * RAD)}, pow(abs(filmHash(k + 9.1)), 1.6)) * grown;
  float t = (th - from) / max(len, 1e-3);
  float c = 0.5 + ${f(look.breath.rill.wind)} * (filmNoise(vec3(th * ${f(look.breath.rill.windPer)}, id * 3.3, seed)) - 0.5) + ${f(look.breath.rill.wind * 0.12)} * (filmNoise(vec3(th * ${f(look.breath.rill.windPer * 3.1)}, id * 1.7, seed + 5.0)) - 0.5);
  float mmPer = 6.2831853 / cells * sin(th) * uDew.z;
  float d = (fract(u) - c) * mmPer;
  // Thin where it starts, widest at its head.
  float w = mix(${f(look.breath.rill.mm[0])}, ${f(look.breath.rill.mm[1])}, filmHash(k + 13.3)) * (0.45 + 0.55 * smoothstep(0.0, 0.5, t) + 1.5 * smoothstep(0.88, 0.985, t));
  float wide = w + blur;
  float aa = max(fwidth(u) * mmPer, 1e-4);
  float along = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.985, 1.0, t));
  return vec2(there * along * (1.0 - smoothstep(wide - aa, wide + aa, abs(d))) * w / wide, clamp(d / wide, -1.0, 1.0));
}
void main() {
  if (uDew.x < 0.0) discard;
  // Where the eye's ray meets the glass.
  vec3 ro = cameraPosition - vFilmCentre;
  vec3 rd = normalize(vStageWorld - cameraPosition);
  float b = dot(ro, rd);
  float disc = b * b - dot(ro, ro) + uDew.z * uDew.z;
  if (disc <= 0.0) discard;
  vec3 n = (ro + rd * (-b - sqrt(disc))) / uDew.z;
  float nv = max(-dot(n, rd), 0.0);
  vec3 pl = normalize(vStageLocal);
  float blot = filmNoise(pl * 3.1 + 7.3);
  float fine = filmNoise(pl * 11.0 + 2.9);
  float keep = dewKeep(0.6 * blot + 0.4 * fine);
  if (keep <= 0.0) discard;
  // It forms blot by blot after the landing, from the places where it will be thickest.
  float formed = smoothstep(0.0, 0.3, 1.4 * clamp(uDew.x / ${f(look.breath.formSeconds)}, 0.0, 1.0) - (1.0 - 0.6 * blot - 0.4 * fine)) * keep;
  float th = acos(clamp(pl.y, -1.0, 1.0));
  float ph = dot(pl.xz, pl.xz) > 0.0 ? atan(pl.x, pl.z) : 0.0;
  // Drawn out downward where water has run through it: fine across the glass, long down it.
  float bend = filmNoise(vec3(th * 7.0, ph * 2.6, 1.7));
  float run = filmNoise(vec3(ph * sin(th) * uDew.z / 2.6 + 5.0 * bend, th * uDew.z / 22.0 + 1.5 * bend, 3.1));
  float streak = 1.0 - ${f(look.breath.streak)} * smoothstep(0.34, 0.2, run) * smoothstep(0.1, 0.5, pl.y);
  float high = mix(${f(look.breath.lowShare)}, 1.0, smoothstep(0.1, 0.9, pl.y)) * smoothstep(${f(Math.cos(look.breath.lowDeg * RAD))}, ${f(Math.cos(look.breath.lowDeg * RAD) + 0.25)}, pl.y);
  float shoulder = pow(max(dot(n, ${vec(norm(look.breath.sheen.dir))}), 0.0), ${f(look.breath.sheen.power)});
  float m = ${f(look.breath.thick)} * high * (1.0 - ${f(look.breath.patch)} * smoothstep(0.62, 0.3, blot)) * (0.8 + 0.4 * fine) * streak * formed * (1.0 + ${f(look.breath.sheen.thick)} * shoulder);
  float a = 1.0 - exp(-m / max(nv, 0.24));
  // The specks: two sizes, standing where the film is.
  float blur = max(uDewLens.z * abs(vStageAux.y * uDewLens.w - 1.0) - ${f(look.sharp)} * vStageAux.y, 0.0);
  vec3 pm = pl * uDew.z;
  vec2 s0 = filmSpecks(pm, ${f(look.breath.speckMm[0])}, blur);
  vec2 s1 = filmSpecks(pm + 3.7, ${f(look.breath.speckMm[1])}, blur);
  float speck = max(s0.x, s1.x) * smoothstep(0.02, 0.1, m) * formed;
  float glint = max(s0.x * s0.y, s1.x * s1.y) * smoothstep(0.02, 0.1, m) * formed;
  vec3 light = uKeyCol * (${f(look.breath.key)} * (0.25 + 0.75 * max(dot(n, uKeyDir), 0.0))) + uRimCol * (${f(look.breath.rim)} * max(dot(n, uRimDir), 0.0)) + stageRoomSoft(n, 1.0) * ${f(look.breath.room)};
  light *= vec3(${look.breath.tint.map(f).join(', ')});
  // The shoulder toward the key scatters it cool, in the film's own texture.
  light += uKeyCol.b * ${vec(look.breath.sheen.tint)} * (${f(look.breath.sheen.gain)} * shoulder * (0.4 + 1.2 * fine) * (0.5 + blot));
  float limb = smoothstep(${f(look.limb[0])}, ${f(look.limb[1])}, nv);
  float cover = (a + (1.0 - a) * 0.6 * speck) * limb;
  vec3 col = light * (a + (1.0 - a) * 0.6 * speck * (1.0 + ${f(look.breath.speck)} * glint)) * limb;
  // The rivulets: clear water where the film was, a bright edge toward the key and a dark one away from it. They grow down the glass after the landing.
  float grown = clamp(1.25 * uDew.x / ${f(look.breath.formSeconds)}, 0.0, 1.0);
  vec2 r0 = filmRill(th, ph, ${f(look.breath.rill.cells[0])}, 1.0, grown, blur);
  vec2 r1 = filmRill(th, ph, ${f(look.breath.rill.cells[1])}, 2.0, grown, blur);
  vec2 rill = r0.x >= r1.x ? r0 : r1;
  float ran = rill.x * formed * limb;
  float toKey = rill.y * sign(dot(normalize(cross(vec3(0.0, 1.0, 0.0), n) + 1e-5), uKeyDir));
  float lightEdge = smoothstep(0.0, 0.7, toKey);
  float darkEdge = smoothstep(0.2, 0.9, -toKey);
  col = col * (1.0 - ran) + (light * ${f(look.breath.rill.bright)} + uKeyCol * ${f(look.breath.rill.key)}) * (ran * lightEdge) + light * (${f(look.breath.rill.dark)} * ran * darkEdge);
  cover = cover * (1.0 - ran) + ran * (lightEdge + ${f(look.breath.rill.darkCover)} * darkEdge * (1.0 - lightEdge));
  // The caustic low on the far side from the key: warm threads of gathered light on the inside of the glass.
  vec3 cd = n - ${vec(norm(look.breath.caustic.dir))};
  float gathered = exp(-dot(cd, cd) / ${f(look.breath.caustic.wide * look.breath.caustic.wide)});
  float threads = 0.3 + 1.5 * smoothstep(0.38, 0.72, filmNoise(pl * vec3(8.0, 2.6, 8.0) + 31.0 + 1.5 * fine));
  float lit = gathered * threads * limb * keep * smoothstep(0.0, 0.3, 1.4 * clamp(uDew.x / ${f(look.breath.caustic.formSeconds)}, 0.0, 1.0) - (1.0 - 0.6 * blot - 0.4 * fine));
  col += uKeyCol * ${vec(look.breath.caustic.tint)} * (${f(look.breath.caustic.gain)} * lit);
  cover = min(cover + ${f(look.breath.caustic.veil)} * lit, 1.0);
  if (cover <= 0.002) discard;
  gl_FragColor = vec4(col, cover);
  if (uDiag != 0) discard;
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

function filmGeometry(): THREE.BufferGeometry {
  const F = look.breath
  const at: number[] = []
  const idx: number[] = []
  const R = RS + F.offMm
  for (let i = 0; i <= F.rows; i++) {
    const th = (F.capDeg * RAD * i) / F.rows
    for (let k = 0; k <= F.cols; k++) {
      const ph = (TAU * k) / F.cols
      at.push(R * Math.sin(th) * Math.sin(ph), R * Math.cos(th), R * Math.sin(th) * Math.cos(ph))
    }
  }
  const row = F.cols + 1
  for (let i = 0; i < F.rows; i++)
    for (let k = 0; k < F.cols; k++) {
      const a = i * row + k
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(at, 3))
  g.setIndex(idx)
  return g
}

const copies = new Map<string, THREE.FramebufferTexture>()
let copied = -1

const SOFT = `uniform sampler2D uFrom;
uniform ivec2 uFromSize;
out vec4 o;
vec3 tap(ivec2 q) {
  vec3 c = texelFetch(uFrom, min(q, uFromSize - 1), 0).rgb;
  return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : clamp(c, 0.0, 30000.0);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  o = vec4(0.25 * (tap(p) + tap(p + ivec2(1, 0)) + tap(p + ivec2(0, 1)) + tap(p + ivec2(1, 1))), 1.0);
}`

const softUniforms = {
  uFrom: { value: null as THREE.Texture | null },
  uFromSize: { value: new THREE.Vector2(1, 1) },
}
const softs = new Map<string, THREE.WebGLRenderTarget>()
let softPass: Pass | null = null

// The soft copy: the frame at half its size with every value that is not a number taken out, and its levels under it.
function soften(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, from: THREE.Texture): void {
  const w = Math.ceil(target.width / 2)
  const h = Math.ceil(target.height / 2)
  const type = target.texture.type === THREE.FloatType ? THREE.HalfFloatType : target.texture.type
  const key = `${w} ${h} ${type}`
  let soft = softs.get(key)
  if (!soft) {
    if (softs.size >= 4) {
      for (const old of softs.values()) old.dispose()
      softs.clear()
    }
    soft = new THREE.WebGLRenderTarget(w, h, {
      type,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: true,
    })
    soft.texture.colorSpace = THREE.NoColorSpace
    softs.set(key, soft)
  }
  softPass ??= new Pass(SOFT, softUniforms)
  softUniforms.uFrom.value = from
  softUniforms.uFromSize.value.set(target.width, target.height)
  const drawn = { ...renderer.info.render }
  softPass.render(renderer, soft)
  renderer.setRenderTarget(target)
  Object.assign(renderer.info.render, drawn)
  behindUniforms.uSoft.value = soft.texture
}

const warmed = new Map<THREE.TextureDataType, THREE.WebGLRenderTarget>()

/**
 * The soft copy drawn once into one pixel of its own kind, for the stage to ask for while the picture rests
 * (`userData.warm`): the picture bound is of the frame's kind. First drawn in the first shake into spring, its program
 * was linked there and held the shake.
 */
function warmSoft(renderer: THREE.WebGLRenderer): void {
  const like = renderer.getRenderTarget()
  if (!like) return
  const type = like.texture.type === THREE.FloatType ? THREE.HalfFloatType : like.texture.type
  let to = warmed.get(type)
  if (!to) warmed.set(type, (to = new THREE.WebGLRenderTarget(1, 1, { type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false })))
  softPass ??= new Pass(SOFT, softUniforms)
  const from = softUniforms.uFrom.value
  softUniforms.uFrom.value = null
  const drawn = { ...renderer.info.render }
  softPass.render(renderer, to)
  renderer.setRenderTarget(like)
  Object.assign(renderer.info.render, drawn)
  softUniforms.uFrom.value = from
}

// The frame as it stands when the glass has been drawn, for the drops to look through. One copy serves the beads and the
// trails: it is taken before the first of them is drawn.
function copyBehind(renderer: THREE.WebGLRenderer, material: THREE.Material, first: boolean): void {
  const target = renderer.getRenderTarget()
  const u = behindUniforms
  ;(material as THREE.ShaderMaterial).uniformsNeedUpdate = true
  if (!target || stageUniforms.uDiag.value !== 0) {
    u.uBehindSize.value.set(0, 0)
    return
  }
  if (!first && copied === renderer.info.render.frame && u.uBehindSize.value.x === target.width) return
  if (target.samples > 0) {
    const resolved = resolveBehind(renderer, target, 'drops')
    if (resolved) u.uBehind.value = resolved
    u.uBehindSize.value.set(resolved ? target.width : 0, resolved ? target.height : 0)
    if (resolved) soften(renderer, target, resolved)
    copied = renderer.info.render.frame
    return
  }
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
  soften(renderer, target, copy)
  copied = renderer.info.render.frame
  u.uBehind.value = copy
  u.uBehindSize.value.set(target.width, target.height)
}

let group: THREE.Group | null = null

function make(): THREE.Group {
  const uniforms = { ...roomUniforms, ...lightUniforms, ...dewUniforms, ...behindUniforms, ...lensOwn }
  const trails = new THREE.Mesh(
    trailsGeometry(),
    stageShader({ part: PART, standIn: false, change: 'glass-dressing', uniforms, vertexPars: TRAIL_VERT_PARS, vertexMain: TRAIL_VERT, fragment: TRAIL, params: { ...blend } }),
  )
  trails.renderOrder = 11
  trails.frustumCulled = false
  trails.onBeforeRender = (renderer, _scene, _camera, _geometry, material) => copyBehind(renderer, material, true)
  trails.userData.warm = warmSoft
  const beads = new THREE.Mesh(
    beadsGeometry(),
    stageShader({ part: PART, standIn: false, change: 'glass-dressing', uniforms, vertexPars: BEAD_VERT_PARS, vertexMain: BEAD_VERT, fragment: BEAD, params: { ...blend } }),
  )
  beads.renderOrder = 11.1
  beads.frustumCulled = false
  beads.onBeforeRender = (renderer, _scene, _camera, _geometry, material) => copyBehind(renderer, material, false)
  const film = new THREE.Mesh(
    filmGeometry(),
    stageShader({
      part: PART,
      standIn: false,
      change: 'glass-dressing',
      uniforms,
      vertexPars: FILM_VERT_PARS,
      vertexMain: FILM_VERT,
      fragment: FILM,
      params: { ...blend, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 },
    }),
  )
  film.renderOrder = 10.9
  film.frustumCulled = false
  return new THREE.Group().add(film, trails, beads, mist())
}

export async function prepare(): Promise<void> {}

export function dressing(): THREE.Object3D {
  group ??= make()
  return group
}

type Run = { a: [number, number, number, number]; b: [number, number, number, number]; c: [number, number, number, number] }

const startOf = (slot: number): number => (slot < 5 ? 0.1 + 0.18 * slot : 0.8 + (look.run.firstBy - 0.8) * rnd(slot, 1, 99))

/** One run of one round, `local` seconds old (null: not yet started), `on` of its size. */
function runIn(slot: number, round: number, local: number | null, slide: number, hang: number, dry: number, period: number, shed: number, on: number): Run {
  const R = look.run
  const from = mixOf(R.fromDeg, rnd(slot, 4, round)) * RAD
  const to = Math.min(from + mixOf(R.goDeg, rnd(slot, 5, round)) * RAD, 100 * RAD)
  const off = look.offDeg * RAD
  const phi = (rnd(slot, 6, round) - 0.45) * 0.86 * Math.PI
  const head = mixOf(R.headMm, rnd(slot, 7, round))
  const a: [number, number, number, number] = [phi, from, mixOf(R.wander, rnd(slot, 8, round)), mixOf(R.waves, rnd(slot, 9, round))]
  const c: [number, number, number, number] = [head * R.track, rnd(slot, 10, round), on, 0]
  const phase = TAU * rnd(slot, 11, round)
  if (local === null) return { a, b: [phase, from, from, 0], c }
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
  const dryTo = slide + hang + R.offSeconds + dry
  const dried = Math.min(1, Math.max(0, (local - dryFrom) / (dryTo - dryFrom)))
  // The wet trail is short: it dries behind the head as the head goes, shortens while the head hangs, and is gone after it.
  const hung = Math.min(1, Math.max(0, (local - slide) / hang))
  const wet = mixOf(R.trailDeg, rnd(slot, 13, round)) * RAD * (1 - 0.8 * hung)
  const tail = Math.max(from, at - wet, from + (off + 0.45 - from) * dried)
  return { a, b: [phase, at, tail, on < 1 ? radius * on : radius], c }
}

/** One run at one moment: its path this time round, where its head is, how far its trail has dried and how large it is. */
export function runAt(slot: number, since: number, shed: number): Run {
  const R = look.run
  const start = startOf(slot)
  const slide = mixOf(R.slideSeconds, rnd(slot, 2, 99))
  const hang = mixOf(R.hangSeconds, rnd(slot, 3, 99))
  const period = slide + hang + R.offSeconds + R.drySeconds + 0.8
  const went = since - start
  const round = went >= 0 ? Math.floor(went / period) : 0
  return runIn(slot, round, went < 0 ? null : went - round * period, slide, hang, R.drySeconds, period, shed, 1)
}

/**
 * The run of a slot as the glass carries it from the swap on. `clock` is the runs' clock (it reads `-afterLanding` at the
 * landing and less before it) and `coming` how far the glass is from the swap window's close to the landing. From
 * `paceBy` on, and for a late run from its own start on, this is `runAt`.
 */
export function runOn(slot: number, clock: number, shed: number, coming = 1): Run {
  const R = look.run
  const L = look.landing
  const start = startOf(slot)
  if (clock >= (start > L.carried ? start : L.paceBy)) return runAt(slot, clock, shed)
  const slide = mixOf(R.slideSeconds, rnd(slot, 2, 99))
  const begun = Math.min(1, Math.max(0, (coming - mixOf(L.swellFrom, rnd(slot, 14, 99))) / L.swell))
  const on = coming >= 1 ? 1 : begun * begun * (3 - 2 * begun)
  if (start > L.carried) {
    const period = slide + L.hangSeconds + R.offSeconds + L.drySeconds + L.gapSeconds
    return runIn(slot, -1, Math.max(0, clock - start + period), slide, L.hangSeconds, L.drySeconds, period, shed, on)
  }
  const hang = mixOf(R.hangSeconds, rnd(slot, 3, 99))
  const period = slide + hang + R.offSeconds + R.drySeconds + 0.8
  const span = L.paceBy + look.afterLanding
  const short = L.young + look.afterLanding + start
  const pace = 1 - (2 * short) / span
  const local = clock < -look.afterLanding ? L.young + pace * (clock + look.afterLanding) : clock - start + (short * (L.paceBy - clock) ** 2) / (span * span)
  return runIn(slot, 0, Math.max(0, local), slide, hang, R.drySeconds, period, shed, on)
}

export function update(moment: KitMoment): void {
  const frame = moment.frame
  const S = config.shake
  const swap = S.swapWindow
  const L = look.landing
  const beat = moment.beat
  const shaking = beat !== null && beat >= swap.fromBeat
  const two = frame.from !== frame.to && frame.change > 0 && frame.change < 1
  const finite = moment.sinceLanding < Infinity
  // Coming on from the swap to the landing: as the incoming season inside the window, and after the window until the foot is
  // down. A globe shaken into the season it had keeps its dew through the window and has only its runs to come, and after
  // the window the two are one.
  const coming = two ? shaking && moment.arrived < 1 : shaking && (beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat) >= 1
  const land = S.liftBeats + S.strokeBeats + S.setDownBeats
  const through = coming ? Math.min(1, Math.max(0, (beat! - swap.fromBeat) / (swap.toBeat - swap.fromBeat))) : 1
  const down = coming ? Math.min(1, Math.max(0, (beat! - swap.toBeat) / (land - swap.toBeat))) : 1
  // Lifted and shaken, the runs run off and their trails dry: all of it gone by the time the swap window opens, so what the
  // glass carries into the swap does not depend on how long the season has stood.
  const lifted = beat === null ? 0 : Math.min(1, Math.max(0, (beat - 0.15) / (swap.fromBeat - 0.4)))
  const shed = coming ? 0 : !finite || two || shaking ? 1 : lifted * lifted * (3 - 2 * lifted)
  const formed = coming ? L.formed * through ** L.formPower : finite ? Math.max(L.formed, moment.sinceLanding - look.afterLanding) : 1e4
  const clock = coming ? -look.afterLanding - (Math.max(0, land - beat!) * 60) / config.film.defaultBpm : finite ? moment.sinceLanding - look.afterLanding : 1e4
  dewUniforms.uDew.value.set(formed, shed, RS, 0)
  for (let j = 0; j < SLOTS; j++) {
    const s = runOn(j, clock, shed, down)
    dewUniforms.uPathA.value[j]!.fromArray(s.a)
    dewUniforms.uPathB.value[j]!.fromArray(s.b)
    dewUniforms.uPathC.value[j]!.fromArray(s.c)
  }
  updateMist(moment, coming)
}
