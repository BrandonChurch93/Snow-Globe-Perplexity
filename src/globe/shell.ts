import * as THREE from 'three'
import { config } from '../config'
import { stageShader } from '../core/materials'
import { stream } from '../core/rng'
import { partBytes, viewCode } from '../diagnostics/views'
import type { StageFrame } from '../scene/frame'
import { centreHeightMm, collarY } from '../scene/layout'
import { ROOM_GLSL, ROOM_LIGHTS, roomUniforms } from '../scene/room'
import { surfaceUniforms } from '../scene/surface'
import { innerRadiusMm, lensRadiusMm } from './lens'
import { LIQUID_BUBBLE, LIQUID_PHASE, LIQUID_PHASE_B, LIQUID_SLOSH, LIQUID_TURBULENCE, TURBULENCE_MAX } from './liquid'

type V3 = readonly [number, number, number]

export const glassLook = {
  ownSources: true,
  window: {
    centre: [0.4179, 0.3537, -0.8368] as V3,
    along: [-0.5279, 0.8442, 0.0931] as V3,
    across: [0.7394, 0.4029, 0.5395] as V3,
    alongDeg: [-18.6, 17.4] as const,
    acrossDeg: [-10.5, 13.5] as const,
    cornerDeg: 3,
    edgeDeg: [0.45, 1.5] as const,
    taper: 0.55,
    chamferDeg: 15.5,
    gain: 3.2,
    fall: 0.68,
  },
  rimCard: { wide: 0.26, widePower: 3, core: 1.1, corePower: 26 },
  fillCard: { dir: [-0.955, 0.25, -0.16] as V3, tint: [0.42, 0.62, 1] as V3, gain: 0.5, power: 9 },
  room: 0.34,
  second: { face: 0.72, gain: 3, tint: [1, 1, 1] as V3, softDeg: 0.25, grow: [0.6, 0.85] as const },
  third: { face: 0.6, gain: 0.34, tint: [0.2, 0.5, 1] as V3, softDeg: 2.2, grow: [0.86, 0.9] as const },
  band: { from: 0.962, to: 0.988, wander: 0.007, dim: 0.6, shade: 0.42 },
  edge: { from: 0.985, peak: 0.9935, key: 0.12, rim: 0.5, sky: 0.45, pool: 0.5 },
  wave: { rings: 46, ringDeg: 0.3, driftDeg: 0.35, inner: 1.9 },
  dust: { cells: 240, share: 0.085, depth: 0.42 },
  hair: { count: 7, widthMm: 0.035, depth: 0.55, bend: 0.012 },
  seat: { lineMm: 1.3, shadeMm: 8, gain: 2.4 },
  through: { disc: 0.0009, point: 3, pointGain: 2.5, wall: [0.94, 0.975, 0.985] as V3, mirror: 0.75, steps: 5, own: 0.4 },
  bubble: { widthMm: 20.5, depthMm: 4.4, gapMm: 0.12, patch: 0.5, waist: 0.4, flat: 2.7, slide: 0.0025, wobble: 0.09, glint: 5, body: 0.8 },
}

const G = config.globe
const RAD = Math.PI / 180
const baseRadiusMm = G.baseDiameterMm / 2
const seatRadiusMm = Math.sqrt(Math.max(lensRadiusMm * lensRadiusMm - collarY * collarY, 1))
const num = (x: number): string => {
  const s = String(x)
  return /[.e]/.test(s) ? s : `${s}.0`
}
const vec = (a: readonly number[]): string => `vec${a.length}(${a.map(num).join(', ')})`
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

function hairs(): { planes: string; spans: string } {
  const rng = stream('glass:hair')
  const planes: string[] = []
  const spans: string[] = []
  const n = glassLook.hair.count
  for (let i = 0; i < n; i++) {
    const near = i < Math.ceil(n * 0.6)
    const c = unit(near ? [0.62 + rng.range(-0.3, 0.3), 0.6 + rng.range(-0.3, 0.3), 0.45 + rng.range(-0.25, 0.3)] : [rng.range(-1, 1), rng.range(-0.6, 1), rng.range(0.1, 1)])
    const k = unit([rng.gauss(), rng.gauss(), rng.gauss()])
    const m = unit([c[1] * k[2] - c[2] * k[1], c[2] * k[0] - c[0] * k[2], c[0] * k[1] - c[1] * k[0]])
    planes.push(vec([m[0], m[1], m[2], rng.range(0.45, 1)]))
    spans.push(vec([c[0], c[1], c[2], Math.cos(rng.range(5, 17) * RAD)]))
  }
  return { planes: `vec4[${n}](${planes.join(', ')})`, spans: `vec4[${n}](${spans.join(', ')})` }
}

const W = glassLook.window
const HAIR = hairs()

const GLASS_GLSL = `
${ROOM_GLSL}
uniform mat3 uTurn;
uniform vec3 uGlobeAt;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uBase;
uniform vec3 uPool;
uniform vec3 uSlab;
uniform float uOwn;
varying vec3 vEye;
const float GLASS_IOR = ${num(G.glassIor)};
const float SEAT_Y = ${num(collarY)};
const float SEAT_R = ${num(seatRadiusMm)};
const float BASE_R = ${num(baseRadiusMm)};
const float CENTRE_Y = ${num(centreHeightMm)};
const vec3 WIN_C = ${vec(unit(W.centre))};
const vec3 WIN_A = ${vec(unit(W.along))};
const vec3 WIN_B = ${vec(unit(W.across))};
const vec2 WIN_MID = ${vec([(W.alongDeg[0] + W.alongDeg[1]) * 0.5 * RAD, (W.acrossDeg[0] + W.acrossDeg[1]) * 0.5 * RAD])};
const vec2 WIN_HALF = ${vec([(W.alongDeg[1] - W.alongDeg[0]) * 0.5 * RAD, (W.acrossDeg[1] - W.acrossDeg[0]) * 0.5 * RAD])};
const vec4 HAIR_M[${glassLook.hair.count}] = ${HAIR.planes};
const vec4 HAIR_C[${glassLook.hair.count}] = ${HAIR.spans};

float glassFresnel(float c, float n) {
  float g2 = n * n - 1.0 + c * c;
  if (g2 <= 0.0) return 1.0;
  float g = sqrt(g2);
  float a = (g - c) / (g + c);
  float b = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
  return clamp(0.5 * a * a * (1.0 + b * b), 0.0, 1.0);
}
float glassHash(vec3 c) {
  uvec3 v = uvec3(ivec3(c) + 32768);
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return float(v.x >> 8u) / 16777216.0;
}
float glassNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(glassHash(i), glassHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(glassHash(i + vec3(0.0, 1.0, 0.0)), glassHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(glassHash(i + vec3(0.0, 0.0, 1.0)), glassHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(glassHash(i + vec3(0.0, 1.0, 1.0)), glassHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float glassWindow(vec3 d, float soft, vec2 grow) {
  float z = dot(d, WIN_C);
  if (z < 0.25) return 0.0;
  vec2 q = vec2(atan(dot(d, WIN_A), z), atan(dot(d, WIN_B), z)) - WIN_MID;
  vec2 h = WIN_HALF * grow;
  float tip = smoothstep(0.05, 1.0, q.x / h.x);
  float inner = smoothstep(-h.y, h.y, q.y);
  float narrow = h.y * (1.0 - ${num(W.taper)} * tip);
  float corner = min(${num(W.cornerDeg * RAD)}, narrow * 0.9);
  vec2 e = vec2(abs(q.x), abs(q.y + (h.y - narrow))) - (vec2(h.x, narrow) - corner);
  float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - corner;
  sd = max(sd, dot(q, vec2(-0.78, 0.626)) - ${num(W.chamferDeg * RAD)} * grow.x);
  float edge = mix(${num(W.edgeDeg[0] * RAD)}, ${num(W.edgeDeg[1] * RAD)}, inner) + soft;
  float m = 1.0 - smoothstep(-edge, edge * 0.3, sd);
  return m * mix(1.0, ${num(W.fall)}, inner) * (0.9 + 0.1 * glassNoise(vec3(q * 22.0, 3.0)));
}
vec3 glassPoints(vec3 d) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${ROOM_LIGHTS}; i++) {
    float w = uRoomDir[i].w;
    float narrow = inversesqrt(1.0 + (1.0 - w * w) / (w * w * ${num(glassLook.through.point * glassLook.through.point)}));
    sum += uRoomCol[i] * smoothstep(narrow - (1.0 - narrow) * 1.8, narrow + (1.0 - narrow) * 0.2, dot(d, uRoomDir[i].xyz));
  }
  return sum * ${num(glassLook.through.pointGain)};
}
vec3 glassRoom(vec3 d, float soft, vec2 grow, float own) {
  vec3 c = soft > 0.0 ? stageRoomSoft(d, soft) : stageRoom(d);
  c += soft < 0.0 ? glassPoints(d) : stageRoomLights(d, ${num(glassLook.through.disc)} + soft * 0.05);
  if (uOwn < 0.5) return c;
  soft = max(soft, 0.0);
  c += mix(uGround, uSky, smoothstep(-0.3, 0.45, d.y)) * ${num(glassLook.room)} * own * smoothstep(-0.8, 0.2, d.z);
  c += uKeyCol * ${num(W.gain)} * own * glassWindow(d, soft, grow);
  float rim = max(dot(d, uRimDir), 0.0);
  c += uRimCol * own * (${num(glassLook.rimCard.wide)} * pow(rim, ${num(glassLook.rimCard.widePower)}) + ${num(glassLook.rimCard.core)} * pow(rim, ${num(glassLook.rimCard.corePower)}));
  c += ${vec(glassLook.fillCard.tint)} * uKeyCol.b * ${num(glassLook.fillCard.gain)} * own * pow(max(dot(d, ${vec(unit(glassLook.fillCard.dir))}), 0.0), ${num(glassLook.fillCard.power)}) * smoothstep(-0.25, 0.2, d.y);
  return c;
}
vec3 glassSeen(vec3 o, vec3 d, float soft, vec2 grow, float own) {
  vec3 dw = uTurn * d;
  vec3 c = glassRoom(dw, soft, grow, own);
  if (d.y < -0.003) {
    float t = (SEAT_Y - o.y) / d.y;
    vec3 q = o + d * t;
    float rho = length(q.xz);
    if (t > 0.0 && rho < BASE_R) {
      float open = smoothstep(SEAT_R - 2.0, SEAT_R + 17.0, rho);
      vec3 keyLocal = uKeyDir * uTurn;
      vec3 lit = uSky * (0.2 + 0.8 * open) + uKeyCol * max(keyLocal.y, 0.0) * open * (0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(normalize(q.xz), normalize(keyLocal.xz + 1e-4))));
      float wear = 0.75 + 0.5 * glassNoise(vec3(q.xz * 0.35, 1.0));
      return uBase * lit * wear * 0.3183 + uPool * uBase * 0.2 * (1.0 - open);
    }
    vec3 ow = uTurn * (o + vec3(0.0, CENTRE_Y, 0.0)) + uGlobeAt;
    if (dw.y < -0.003 && ow.y > 0.0) {
      vec3 s = ow + dw * (-ow.y / dw.y);
      float dist = length(s.xz - uGlobeAt.xz);
      float contact = 0.8 * (1.0 - smoothstep(BASE_R * 0.85, BASE_R * 1.5, dist));
      float lit = exp(-dist * dist / (2.0 * 650.0 * 650.0));
      vec3 slab = uRoomFloor * (1.0 - 0.6 * contact) + uSlab * uKeyCol * max(uKeyDir.y, 0.0) * (1.0 - contact) * lit;
      slab += uSlab * uPool * 3.0 * exp(-dist * dist / (2.0 * 110.0 * 110.0)) * (1.0 - 0.6 * contact);
      float away = smoothstep(1400.0, 2900.0, length(s.xz));
      return mix(slab, c, away);
    }
  }
  return c;
}
vec3 glassWavy(vec3 n, float amount) {
  float ring = sin(n.y * ${num(glassLook.wave.rings)} + 2.6 * glassNoise(n * 2.3 + 4.0));
  vec3 up = vec3(0.0, 1.0, 0.0) - n * n.y;
  vec3 drift = vec3(glassNoise(n * 5.7 + 11.0), glassNoise(n * 5.7 + 23.0), glassNoise(n * 5.7 + 37.0)) - 0.5;
  vec3 w = up * ring * ${num(glassLook.wave.ringDeg * RAD)} + (drift - n * dot(drift, n)) * ${num(glassLook.wave.driftDeg * RAD * 2)};
  return normalize(n + w * amount);
}
float glassDust(vec3 n) {
  vec3 x = n * ${num(glassLook.dust.cells)};
  vec3 i = floor(x);
  float h = glassHash(i);
  if (h > ${num(glassLook.dust.share)}) return 0.0;
  vec3 c = vec3(glassHash(i + 91.0), glassHash(i + 173.0), glassHash(i + 257.0)) * 0.6 + 0.2;
  float size = 0.14 + 0.22 * glassHash(i + 311.0);
  return (1.0 - smoothstep(size * 0.45, size, length(x - i - c))) * (0.35 + 0.65 * h / ${num(glassLook.dust.share)});
}
float glassHair(vec3 n) {
  float bend = glassNoise(n * 6.0 + 51.0) - 0.5;
  float sum = 0.0;
  for (int i = 0; i < ${glassLook.hair.count}; i++) {
    float d = dot(n, HAIR_M[i].xyz) + ${num(glassLook.hair.bend)} * bend * (mod(float(i), 2.0) * 2.0 - 1.0);
    float w = max(fwidth(d), ${num(glassLook.hair.widthMm / lensRadiusMm)});
    sum += (1.0 - smoothstep(0.4 * w, 1.3 * w, abs(d))) * smoothstep(HAIR_C[i].w, HAIR_C[i].w + 0.015, dot(n, HAIR_C[i].xyz)) * HAIR_M[i].w;
  }
  return min(sum, 1.0);
}
`

const THROUGH = `
${GLASS_GLSL}
void main() {
  vec3 n = normalize(vStageLocal);
  vec3 p = n * uLens.x;
  vec3 v = normalize(p - vEye);
  float c1 = clamp(dot(n, -v), 0.0, 1.0);
  vec3 t = uLens.z > 0.5 ? refract(v, n, 1.0 / uLens.y) : v;
  float chord = 2.0 * uLens.x * max(dot(-n, t), 0.0);
  vec3 q = p + t * chord;
  vec3 n2 = normalize(q);
  vec3 o = uLens.z > 0.5 ? refract(t, -n2, uLens.y) : v;
  if (dot(o, o) < 0.5) o = reflect(t, -n2);
  float wall = uLens.z > 0.5 ? glassFresnel(c1, GLASS_IOR) : 0.0;
  vec3 mid = stageGrid(p + t * chord * 0.5);
  vec3 back = glassSeen(q, o, -1.0, vec2(1.0), ${num(glassLook.through.own)});
  if (q.y < SEAT_Y) back = uBase * (0.12 * uSky + 0.3183 * stageGrid(q * 0.96));
  vec3 col = back * (1.0 - wall) * ${vec(glassLook.through.wall)};
  vec3 m = reflect(t, -n2);
  vec3 glow = vec3(0.0);
  for (int i = 1; i <= ${glassLook.through.steps}; i++) glow += stageGrid(q + m * chord * (float(i) / ${num(glassLook.through.steps + 1)}));
  col += wall * ${num(glassLook.through.mirror)} * uVeil.rgb * (0.35 * uVeilLight + glow / ${num(glassLook.through.steps)});
  float fog = stageVeil(chord);
  col = stageFogged(col, mid, fog);
  gl_FragColor = vec4(col, 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(col, normalize(vStageWorld - uLensCentre), fog, 0.0, 0.0);
}`

const SHELL = `
uniform vec4 uDress;
uniform vec3 uBloom;
uniform vec3 uOverlay[3];
uniform vec3 uOverlayOn;
${GLASS_GLSL}
void main() {
  if (uDiag != 0) {
    if (uDiag != ${viewCode('ids')} && uDiag != ${viewCode('standins')}) discard;
    vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
    if (cell.x == 0.0 && cell.y == 0.0 && uOverlayOn.x > 0.5) gl_FragColor = vec4(uOverlay[0], 0.0);
    else if (cell.x == 2.0 && cell.y == 0.0 && uOverlayOn.y > 0.5) gl_FragColor = vec4(uOverlay[1], 0.0);
    else if (cell.x == 0.0 && cell.y == 2.0 && uOverlayOn.z > 0.5) gl_FragColor = vec4(uOverlay[2], 0.0);
    else discard;
    return;
  }
  vec3 n = normalize(vStageLocal);
  vec3 p = n * uLens.x;
  vec3 v = normalize(p - vEye);
  float eyeDist = length(vEye);
  float along = dot(v, -vEye / eyeDist);
  float s = clamp(sqrt(max(1.0 - along * along, 0.0)) / max(along, 1e-4) * sqrt(max(eyeDist * eyeDist - uLens.x * uLens.x, 1.0)) / uLens.x, 0.0, 1.0);
  float nv = clamp(dot(n, -v), 0.0, 1.0);

  vec3 nw = glassWavy(n, 1.0);
  float cw = clamp(dot(nw, -v), 0.0, 1.0);
  vec3 tang = v + nw * cw;
  float st = length(tang);
  tang = st > 1e-5 ? tang / st : normalize(cross(nw, vec3(0.0, 1.0, 0.0)));
  float theta = atan(st, cw);
  float f1 = glassFresnel(nv, GLASS_IOR);
  float marks = 1.0 - ${num(glassLook.dust.depth)} * glassDust(n) - ${num(glassLook.hair.depth)} * glassHair(n);

  vec3 col = glassSeen(p, cos(theta) * nw + sin(theta) * tang, 0.0, vec2(1.0), 1.0) * f1 * marks;

  vec3 ni = glassWavy(n, ${num(glassLook.wave.inner)});
  float ci = clamp(dot(ni, -v), 0.0, 1.0);
  vec3 ti = v + ni * ci;
  float si = length(ti);
  ti = si > 1e-5 ? ti / si : tang;
  float thetaI = atan(si, ci);
  float inGlass = si / GLASS_IOR;
  float pass = (1.0 - f1) * (1.0 - f1) * (0.6 + 0.4 * marks);
  float s2 = inGlass / ${num(glassLook.second.face)};
  if (s2 < 1.0) {
    float a2 = thetaI + 2.0 * (asin(s2) - asin(inGlass));
    float f2 = glassFresnel(sqrt(1.0 - s2 * s2), GLASS_IOR) * (1.0 - smoothstep(0.78, 0.97, s2)) * smoothstep(0.0, 0.2, cos(a2));
    col += glassSeen(p, cos(a2) * ni + sin(a2) * ti, ${num(glassLook.second.softDeg * RAD)}, ${vec(glassLook.second.grow)}, 0.5) * ${vec(glassLook.second.tint)} * (${num(glassLook.second.gain)} * f2 * pass);
  }
  float s3 = inGlass / ${num(glassLook.third.face)};
  if (s3 < 1.0) {
    float a3 = thetaI + 2.0 * (asin(s3) - asin(inGlass));
    float f3 = glassFresnel(sqrt(1.0 - s3 * s3), GLASS_IOR) * (1.0 - smoothstep(0.78, 0.97, s3)) * smoothstep(0.0, 0.2, cos(a3));
    col += glassSeen(p, cos(a3) * ni + sin(a3) * ti, ${num(glassLook.third.softDeg * RAD)}, ${vec(glassLook.third.grow)}, 0.35) * ${vec(glassLook.third.tint)} * (${num(glassLook.third.gain)} * f3 * pass);
  }

  float thick = glassNoise(n * 3.1 + 7.0);
  float fine = glassNoise(n * 8.3 + 2.0);
  float from = ${num(glassLook.band.from)} + ${num(glassLook.band.wander)} * (thick - 0.5) * 2.0;
  float to = ${num(glassLook.band.to)} + ${num(glassLook.band.wander * 0.4)} * (fine - 0.5) * 2.0;
  float band = smoothstep(from - 0.007, from + 0.004, s) * (1.0 - smoothstep(to - 0.003, to + 0.004, s)) * (0.5 + 0.5 * fine);
  col *= 1.0 - ${num(glassLook.band.dim)} * band;

  vec3 nWorld = uTurn * n;
  float facingKey = 0.5 + 0.5 * dot(nWorld, uKeyDir);
  float facingRim = 0.5 + 0.5 * dot(nWorld, uRimDir);
  vec3 piped = uKeyCol * ${num(glassLook.edge.key)} * facingKey * facingKey + uRimCol * ${num(glassLook.edge.rim)} * facingRim * facingRim;
  if (uOwn > 0.5) piped += uSky * ${num(glassLook.edge.sky)} * (0.4 + 0.6 * smoothstep(-0.7, 0.5, nWorld.y));
  piped += uPool * ${num(glassLook.edge.pool)} * smoothstep(-0.2, -0.75, n.y);
  float edge = smoothstep(${num(glassLook.edge.from)}, ${num(glassLook.edge.peak)}, s) * (0.35 + 0.65 * thick) * (0.7 + 0.3 * fine);
  col += piped * edge;

  float lift = p.y - SEAT_Y;
  float shade = 1.0 - smoothstep(0.0, ${num(glassLook.seat.shadeMm)}, lift);
  float line = 1.0 - smoothstep(${num(glassLook.seat.lineMm * 0.25)}, ${num(glassLook.seat.lineMm)}, lift);
  float low = smoothstep(${num(glassLook.seat.shadeMm * 2.5)}, 0.0, lift);
  col *= 1.0 + (${num(glassLook.seat.gain)} - 1.0) * low * step(0.0, -(cos(theta) * nw + sin(theta) * tang).y);
  float seat = (1.0 - 0.55 * shade * shade) * (1.0 - 0.8 * line);
  col *= seat;

  float alpha = (1.0 - f1) * (1.0 - ${num(glassLook.band.shade)} * band) * seat;
  col += uDress.rgb * uDress.a * 0.05 * (0.4 + 0.6 * pow(1.0 - nv, 2.0));
  col += uBloom * (0.25 + 0.75 * nv);
  alpha *= 1.0 - 0.5 * uDress.a;

  float limb = 1.0 - smoothstep(1.0 - max(1.5 * fwidth(s), 1e-4), 1.0, s);
  gl_FragColor = vec4(col * limb, mix(1.0, alpha, limb));
}`

const BUBBLE = `
${GLASS_GLSL}
varying vec3 vBubbleNormal;
varying vec3 vBubblePlaced;
varying vec3 vBubbleShape;
void main() {
  if (stageOutside()) discard;
  vec3 dir = normalize(vBubblePlaced - vEye);
  float b = dot(vEye, dir);
  float disc = b * b - (dot(vEye, vEye) - uLens.x * uLens.x);
  vec3 at = vEye + dir * (-b - sqrt(max(disc, 0.0)));
  vec3 vin = uLens.z > 0.5 && disc > 0.0 ? normalize(vStageLocal - at) : dir;
  vec3 nb = normalize(vBubbleNormal);
  float c = dot(-vin, nb);
  vec3 nn = c > 0.0 ? nb : -nb;
  float ca = abs(c);
  float f = c > 0.0 ? glassFresnel(ca, 1.0 / uLens.y) : glassFresnel(ca, uLens.y);
  vec3 r = reflect(vin, nn);
  vec3 lit = stageGrid(vStageLocal);
  vec3 keyLocal = uKeyDir * uTurn;
  vec3 inside = uVeil.rgb * (uVeilLight + 0.6 * lit) + uKeyCol * 0.16 * max(keyLocal.y, 0.0) * smoothstep(0.15, -0.6, r.y) + uSky * 0.3 * smoothstep(0.3, -0.5, r.y);
  vec3 rOut = refract(r, -normalize(vStageLocal + r * 4.0), uLens.y);
  vec3 outside = dot(rOut, rOut) > 0.5 ? glassRoom(uTurn * rOut, 0.01, vec2(1.0), 1.0) : inside;
  vec3 seen = mix(inside, outside, smoothstep(0.0, 0.35, dot(r, normalize(vStageLocal))));
  float graze = 1.0 - ca;
  vec3 col = seen * f;
  col += uKeyCol * ${num(glassLook.bubble.glint)} * pow(max(dot(uTurn * r, uKeyDir), 0.0), 90.0) * (0.2 + 0.8 * f);
  col += (uSky * 0.55 + uKeyCol * 0.07 + 0.5 * lit) * pow(graze, 3.0) * (0.6 + 0.4 * vBubbleShape.z);
  float ring = smoothstep(0.1, 0.0, abs(vBubbleShape.x - ${num(glassLook.bubble.patch)})) * vBubbleShape.y;
  col += (uSky * 0.5 + uKeyCol * 0.06) * ring;
  float alpha = (1.0 - f) * (1.0 - 0.75 * pow(graze, 3.0)) * mix(1.0, ${num(glassLook.bubble.body)}, vBubbleShape.y) * (1.0 - 0.35 * ring);
  gl_FragColor = vec4(col, alpha);
  if (uDiag != 0) gl_FragColor = vec4(stageDiag(vec3(1.0), nb, 0.0, 0.0, 0.0).rgb, 0.0);
}`

const eyeChunk = { pars: 'varying vec3 vEye;', main: 'vEye = (uGlobeInv * vec4(cameraPosition, 1.0)).xyz;' }

export const shellUniforms = {
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyCol: { value: new THREE.Color() },
  uRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uRimCol: { value: new THREE.Color() },
  uDress: { value: new THREE.Vector4(1, 1, 1, 0) },
  uBloom: { value: new THREE.Color() },
  uOverlay: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  uOverlayOn: { value: new THREE.Vector3(1, 1, 1) },
  uTurn: { value: new THREE.Matrix3() },
  uGlobeAt: { value: new THREE.Vector3() },
  uSky: { value: new THREE.Color() },
  uGround: { value: new THREE.Color() },
  uBase: { value: new THREE.Color() },
  uPool: { value: new THREE.Color() },
  uSlab: surfaceUniforms.uSlab,
  uOwn: { value: 1 },
}

const blend: THREE.ShaderMaterialParameters = {
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.SrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
}

function bubbleGeometry(): THREE.BufferGeometry {
  const B = glassLook.bubble
  const a = B.widthMm / 2
  const wall = innerRadiusMm - B.gapMm
  const sag = (rho: number) => wall - Math.sqrt(wall * wall - rho * rho)
  const patch = a * B.patch
  const waist = -B.depthMm * B.waist
  const profile: [number, number, number][] = []
  const cap = 10
  const shoulder = 12
  const under = 22
  for (let i = 0; i <= cap; i++) {
    const rho = (patch * i) / cap
    profile.push([rho, -sag(rho), 0])
  }
  const y0 = -sag(patch)
  for (let i = 1; i <= shoulder; i++) {
    const t = (i / shoulder) * (Math.PI / 2)
    profile.push([patch + (a - patch) * Math.sin(t), y0 - (y0 - waist) * (1 - Math.cos(t)), i / shoulder])
  }
  for (let i = 1; i <= under; i++) {
    const t = (i / under) * (Math.PI / 2)
    const k = 2 / B.flat
    profile.push([a * Math.pow(Math.cos(t), k), waist - (B.depthMm + waist) * Math.pow(Math.sin(t), k), 1])
  }
  const around = 56
  const rows = profile.length
  const position = new Float32Array(rows * (around + 1) * 3)
  const shape = new Float32Array(rows * (around + 1) * 3)
  const index: number[] = []
  for (let j = 0; j < rows; j++) {
    const [rho, y, side] = profile[j]!
    for (let i = 0; i <= around; i++) {
      const phi = (i / around) * Math.PI * 2
      const o = (j * (around + 1) + i) * 3
      position[o] = rho * Math.cos(phi)
      position[o + 1] = y
      position[o + 2] = rho * Math.sin(phi)
      shape[o] = rho / a
      shape[o + 1] = j <= cap + 2 ? 1 : 0
      shape[o + 2] = side
    }
  }
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < around; i++) {
      const p = j * (around + 1) + i
      const q = p + around + 1
      index.push(p, p + 1, q, p + 1, q + 1, q)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aShape', new THREE.BufferAttribute(shape, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

export class Shell {
  readonly through: THREE.Mesh
  readonly shell: THREE.Mesh
  readonly bubble: THREE.Mesh
  readonly stamp: THREE.Mesh
  readonly bubbleRadius = glassLook.bubble.widthMm / 2
  private readonly turn = new THREE.Matrix4()
  private readonly euler = new THREE.Euler()
  private readonly up = new THREE.Vector3()
  private readonly slosh = new THREE.Vector3()
  private readonly lean = new THREE.Quaternion()
  private readonly spin = new THREE.Quaternion()
  private readonly yAxis = new THREE.Vector3(0, 1, 0)
  private wobble = 0
  private phase = 0
  private phaseB = 0

  constructor() {
    const sphere = new THREE.SphereGeometry(lensRadiusMm, 128, 64)
    const uniforms = { ...roomUniforms, ...shellUniforms }
    this.through = new THREE.Mesh(sphere, stageShader({ part: 'liquid', standIn: false, uniforms, vertexPars: eyeChunk.pars, vertexMain: eyeChunk.main, fragment: THROUGH, params: { depthWrite: false } }))
    this.through.renderOrder = -0.5
    this.shell = new THREE.Mesh(sphere, stageShader({ part: 'glass', standIn: false, uniforms, vertexPars: eyeChunk.pars, vertexMain: eyeChunk.main, fragment: SHELL, params: { ...blend, transparent: true } }))
    this.shell.renderOrder = 10
    this.bubble = new THREE.Mesh(
      bubbleGeometry(),
      stageShader({
        part: 'liquid',
        standIn: false,
        inside: true,
        uniforms,
        vertexPars: `${eyeChunk.pars}\nattribute vec3 aShape;\nvarying vec3 vBubbleNormal;\nvarying vec3 vBubblePlaced;\nvarying vec3 vBubbleShape;`,
        vertexMain: `${eyeChunk.main}\nvBubbleNormal = mat3(uGlobeInv) * (mat3(modelMatrix) * normal);\nvBubblePlaced = (uGlobeInv * vec4(vStagePlaced, 1.0)).xyz;\nvBubbleShape = aShape;`,
        fragment: BUBBLE,
        params: { ...blend, side: THREE.DoubleSide },
      }),
    )
    this.bubble.renderOrder = 4
    this.bubble.frustumCulled = false
    this.stamp = new THREE.Mesh(new THREE.SphereGeometry(lensRadiusMm, 64, 40), stageShader({ part: 'glass', standIn: false, fragment: 'void main() { gl_FragColor = vec4(0.0); }', params: { colorWrite: false } }))
    this.stamp.scale.setScalar(0.998)
    this.stamp.renderOrder = 6
  }

  update(f: StageFrame): void {
    const sh = shellUniforms
    const a = f.from
    const b = f.to
    const t = f.mix.base
    sh.uKeyDir.value.copy(f.keyDir)
    sh.uKeyCol.value.copy(f.keyCol)
    sh.uRimDir.value.copy(f.rimDir)
    sh.uRimCol.value.copy(f.rimCol)
    sh.uSky.value.copy(f.ambient)
    sh.uGround.value.copy(f.ground).multiplyScalar(f.fill)
    sh.uBase.value.setRGB(a.main[0] + (b.main[0] - a.main[0]) * t, a.main[1] + (b.main[1] - a.main[1]) * t, a.main[2] + (b.main[2] - a.main[2]) * t)
    sh.uPool.value.copy(f.pool)
    sh.uOwn.value = glassLook.ownSources ? 1 : 0
    sh.uTurn.value.setFromMatrix4(this.turn.makeRotationFromEuler(this.euler.set(f.globe.tiltX, 0, f.globe.tiltZ)))
    sh.uGlobeAt.value.set(f.globe.x, f.globe.y, f.globe.z)
    const da = a.glassDressing
    const db = b.glassDressing
    sh.uDress.value.set(da.tint[0] + (db.tint[0] - da.tint[0]) * t, da.tint[1] + (db.tint[1] - da.tint[1]) * t, da.tint[2] + (db.tint[2] - da.tint[2]) * t, da.amount + (db.amount - da.amount) * t)
    sh.uBloom.value.copy(f.bloomTint).multiplyScalar(0.12)
    const shown = t < 0.5 ? a : b
    const veiled = f.mix.veil < 0.5 ? a : b
    const dressing = `glass-dressing-${shown.season}`
    const veil = `veil-${veiled.season}`
    ;[partBytes('glass'), partBytes(dressing), partBytes(veil)].forEach((c, i) => sh.uOverlay.value[i]!.set(c[0] / 255, c[1] / 255, c[2] / 255))
    const flagged = f.view === 'standins'
    sh.uOverlayOn.value.set(flagged ? 0 : 1, flagged ? (shown.standIns?.includes(dressing) ? 1 : 0) : sh.uDress.value.w > 0 ? 1 : 0, flagged && !veiled.standIns?.includes(veil) ? 0 : 1)

    const L = f.liquid
    const has = L.length > LIQUID_BUBBLE + 1
    const bx = has ? L[LIQUID_BUBBLE]! : 0
    const bz = has ? L[LIQUID_BUBBLE + 1]! : 0
    const tilted = f.globeUp.x * f.globeUp.x + f.globeUp.z * f.globeUp.z > 1e-8
    if (has && (bx !== 0 || bz !== 0 || !tilted)) this.up.set(bx, Math.sqrt(Math.max(1 - bx * bx - bz * bz, 0)), bz)
    else this.up.copy(f.globeUp)
    this.slosh.set(L[LIQUID_SLOSH] ?? 0, L[LIQUID_SLOSH + 1] ?? 0, L[LIQUID_SLOSH + 2] ?? 0)
    this.wobble = Math.min(1, (L[LIQUID_TURBULENCE] ?? 0) / TURBULENCE_MAX + this.slosh.length() / 400)
    this.phase = L[LIQUID_PHASE] ?? 0
    this.phaseB = L[LIQUID_PHASE_B] ?? 0
    this.placeBubble(this.up, this.slosh)

    const on = f.view !== 'flow' && f.view !== 'lightgrid'
    this.through.visible = on
    this.shell.visible = on
    this.bubble.visible = on
    this.stamp.visible = on
  }

  placeBubble(up: THREE.Vector3, slosh: THREE.Vector3): void {
    const B = glassLook.bubble
    const d = up.clone().addScaledVector(slosh, -B.slide)
    if (d.lengthSq() < 1e-9) d.set(0, 1, 0)
    d.normalize()
    const w = this.wobble * B.wobble
    const p = this.phase
    const q = this.phaseB
    this.bubble.position.copy(d).multiplyScalar(innerRadiusMm - B.gapMm)
    this.bubble.quaternion.copy(this.lean.setFromUnitVectors(this.yAxis, d)).multiply(this.spin.setFromAxisAngle(this.yAxis, 3 * q))
    this.bubble.scale.set(1 + w * Math.cos(5 * p), 1 + 1.6 * w * Math.sin(4 * q + 1.3), 1 - w * Math.cos(5 * p) + 0.5 * w * Math.sin(7 * q))
  }
}
