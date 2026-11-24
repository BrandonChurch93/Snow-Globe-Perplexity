import * as THREE from 'three'
import { config } from '../config'
import { stageShader } from '../core/materials'
import { stream } from '../core/rng'
import { lensState } from '../post/grade'
import type { SeasonKit } from '../seasons/kit'
import { FAR_GLSL, ROOM_RADIUS_MM, farApertureMm, farFromMm, lensUniforms, poseById, setLens } from './cameras'
import type { StageFrame } from './frame'
import { centreHeightMm } from './layout'
import { ROOM_GLSL, ROOM_LIGHTS, ROOM_SEEN, roomUniforms } from './room'
import { SLAB_SHAPE, SLAB_SHAPE_GLSL } from './surface'

const RAD = Math.PI / 180
const CLEAR_SIDE = 16 * RAD
const CLEAR_UP = 9 * RAD

const COOL = 0.05
const BLUE = 0.35
const PALE = 0.65
const WARM = 0.75
const WHITE = 0.85
const AMBER = 0.95

export const PLACED = {
  view: { widthPx: 2816, heightPx: 1584, fovDeg: 16, distanceMm: 619.9, pitchDeg: 4.5, aimHeightMm: 62.8 },
  sizeMm: 2.5,
  reachMm: [1100, 3200] as [number, number],
  discs: [
    [2525, 368, 48, AMBER, 0.85, 0.14, 0.45, 1900],
    [2640, 650, 45, WHITE, 1.5, 0.3, 0.1, 1600],
    [2295, 510, 55, PALE, 0.47, 0.32, 0.1, 1557],
    [2275, 212, 48, PALE, 0.24, 0.34, 0.15],
    [2605, 333, 48, PALE, 0.2, 0.37, 0.1],
    [2045, 108, 50, PALE, 0.19, 0.5, 0.1],
    [2285, 585, 50, BLUE, 0.14, 0.55, 0],
    [2620, 190, 47, BLUE, 0.11, 0.55, 0.05],
    [2330, 455, 45, BLUE, 0.1, 0.6, 0],
    [2560, 665, 45, BLUE, 0.07, 0.65, 0],
    [2238, 275, 50, BLUE, 0.06, 0.65, 0],
    [2200, 515, 40, BLUE, 0.05, 0.65, 0],
    [2352, 632, 45, AMBER, 0.05, 0.6, 0.05],
    [2098, 180, 45, AMBER, 0.045, 0.65, 0],
    [2170, 410, 55, AMBER, 0.035, 0.7, 0],
    [2655, 555, 42, COOL, 0.06, 0.65, 0],
    [2780, 420, 42, COOL, 0.05, 0.6, 0],
    [2270, 70, 58, COOL, 0.055, 0.65, 0],
    [2020, 365, 55, COOL, 0.035, 0.7, 0],
    [2330, 380, 50, COOL, 0.035, 0.7, 0],
    [2000, 30, 45, COOL, 0.03, 0.7, 0],
    [2604, 108, 50, COOL, 0.03, 0.7, 0],
    [2788, 148, 42, COOL, 0.03, 0.7, 0],
    [2330, 830, 60, COOL, 0.025, 0.7, 0],
    [2788, 610, 40, WARM, 0.02, 0.7, 0],
    [252, 478, 48, PALE, 0.42, 0.34, 0.1],
    [300, 470, 48, PALE, 0.16, 0.5, 0.05],
    [285, 740, 45, PALE, 0.14, 0.5, 0.05],
    [455, 935, 45, BLUE, 0.06, 0.75, 0],
    [250, 545, 48, BLUE, 0.12, 0.55, 0],
    [650, 80, 55, BLUE, 0.12, 0.5, 0.05],
    [400, 668, 55, BLUE, 0.08, 0.55, 0],
    [285, 605, 50, BLUE, 0.07, 0.6, 0],
    [640, 560, 60, BLUE, 0.05, 0.7, 0],
    [215, 420, 45, BLUE, 0.05, 0.65, 0],
    [700, 610, 55, BLUE, 0.045, 0.7, 0],
    [472, 172, 50, WARM, 0.12, 0.37, 0.1],
    [890, 320, 50, WARM, 0.125, 0.5, 0.05],
    [465, 215, 48, AMBER, 0.05, 0.6, 0],
    [285, 790, 45, AMBER, 0.05, 0.6, 0],
    [75, 150, 45, AMBER, 0.02, 0.7, 0],
    [690, 815, 58, COOL, 0.075, 0.6, 0],
    [815, 250, 50, COOL, 0.04, 0.7, 0],
    [650, 225, 50, COOL, 0.035, 0.7, 0],
    [492, 345, 50, COOL, 0.035, 0.7, 0],
    [295, 270, 50, COOL, 0.035, 0.7, 0],
    [140, 820, 50, COOL, 0.025, 0.7, 0],
  ] as [number, number, number, number, number, number, number, number?][],
}

export const DISCS = {
  zones: [
    { share: 0.12, azFrom: 5.6, azTo: 14.6, elFrom: -2.3, elTo: 4.8, sidePower: 0.8, rightShare: 1, levelFrom: 0, depthFrom: 0 },
    { share: 0.12, azFrom: 5.8, azTo: 15, elFrom: -3.8, elTo: 4.6, sidePower: 0.8, rightShare: 0, levelFrom: 0, depthFrom: 0 },
    { share: 0.08, azFrom: 5, azTo: 22, elFrom: 4.4, elTo: 11, sidePower: 1, rightShare: 0.75, levelFrom: 0.3, depthFrom: 0.45 },
    { share: 0.68, azFrom: 15, azTo: 48, elFrom: -6.2, elTo: 12, sidePower: 1, rightShare: 0.5, levelFrom: 0, depthFrom: 0 },
  ],
  spread: [0.6180339887, 0.8191725134, 0.6710436067, 0.5497004779] as [number, number, number, number],
  rightLevel: 0.65,
  stringMost: 2,
  stringAcrossDeg: 1.3,
  stringDownDeg: 2.2,
  stringLevel: 0.18,
  stringDepth: 0.16,
  nearMm: 1000,
  spanMm: 2000,
  depthPower: 1,
  sizeMm: [1.5, 5] as [number, number],
  largeShare: 0.02,
  largeMm: [5, 11] as [number, number],
  dimmest: 0.03,
  decades: 1.05,
  dimPower: 2,
  colourByLevel: 0.55,
  soft: [0.45, 1] as [number, number],
  edgeShare: 0.32,
  edge: [0.1, 0.36] as [number, number],
  lean: [0.06, 0.3] as [number, number],
  quad: 2,
  catEye: 0.52,
  roomLightGain: 0.8,
}

export const WALL = {
  seen: ROOM_SEEN,
  streaks: 0.16,
  fine: 0.1,
  folds: 0.2,
  mottle: 0.22,
  base: 1,
  column: 2.8,
  columnDeg: 5.5,
  rightLift: 0.5,
  tints: { winter: { base: [0.9, 1, 1.05], column: [0.67, 0.85, 0.83] } } as Record<string, { base: [number, number, number]; column: [number, number, number] }>,
}

export const APRON = {
  tone: [1.56, 2.6, 2.4] as [number, number, number],
  reachMm: 150,
  leftShare: 0.33,
  sideMm: 150,
  ledgeAtMm: [-230.6, -302.5] as [number, number],
  ledgeDir: [0.3745, -0.9273] as [number, number],
  band: [3.4, 3, 2.3] as [number, number, number],
  bandMm: 16,
  bandFadeMm: [400, 1100] as [number, number],
}

const wallUniforms = {
  uWallBase: { value: new THREE.Vector3(1, 1, 1) },
  uWallColumn: { value: new THREE.Vector3(1, 1, 1) },
}
const PLAIN = { base: [1, 1, 1], column: [1, 1, 1] } as const
const tintOf = (season: string) => WALL.tints[season] ?? PLAIN

interface Emitter {
  at: THREE.Vector3
  size: number
  shown: number
  level: number
  pick: number
  energy: number
  heroRadius: number
  look?: [number, number]
}

const f4 = (v: number) => v.toFixed(4)

const DOME = `${ROOM_GLSL}
${FAR_GLSL}
uniform vec3 uWallBase;
uniform vec3 uWallColumn;
float wallHash(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  q = q * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n >> 8u) / 16777216.0;
}
float wallNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(wallHash(i), wallHash(i + vec2(1.0, 0.0)), u.x), mix(wallHash(i + vec2(0.0, 1.0)), wallHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 d = normalize(vStageWorld - vec3(0.0, ${centreHeightMm.toFixed(1)}, 0.0));
  float blur = lensBlurMm(vStageAux.y) / max(vStageAux.z, 1.0);
  float keep = 1.0 / (1.0 + 40.0 * blur);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float bands = 0.5 * sin(az * 23.0 + 1.3 + 0.9 * el) + 0.3 * sin(az * 41.0 + 4.1 - 1.4 * el) + 0.2 * sin(az * 67.0 + 0.7 + 0.5 * el);
  float folds = wallNoise(vec2(az * 11.0 + 3.0, el * 1.7 + 5.0)) - 0.5;
  float mottle = wallNoise(vec2(az * 3.3 + 7.0, el * 4.1 + 2.0)) + 0.5 * wallNoise(vec2(az * 7.9 + 1.0, el * 9.3 + 8.0)) - 0.75;
  float fine = wallNoise(vec2(az * 260.0, el * 5.0 + 3.0)) + 0.6 * wallNoise(vec2(az * 610.0 + 9.0, el * 8.0 + 1.0)) - 0.8;
  float marks = 1.0 + ${f4(WALL.streaks)} * keep * bands + ${f4(WALL.fine)} * keep * fine + ${f4(WALL.folds)} * folds + ${f4(WALL.mottle)} * mottle;
  float wide = ${f4(WALL.columnDeg * RAD)};
  float column = exp(-az * az / (2.0 * (wide * wide + blur * blur)));
  vec3 col = uRoomWall * (uWallBase * (1.0 + ${f4(WALL.rightLift)} * smoothstep(0.0, 0.25, az)) + uWallColumn * column) * max(marks, 0.2) + roomSources(d, blur) * ${f4(WALL.seen)};
  vec3 ray = normalize(vStageWorld - cameraPosition);
  if (ray.y < -0.002 && cameraPosition.y > 0.0) {
    float reach = -cameraPosition.y / ray.y;
    vec2 g = cameraPosition.xz + ray.xz * reach;
    float soft = 1.2 * lensBlurMm(reach);
    float beyond = max(-(g.x * ${f4(Math.sin(SLAB_SHAPE.turnDeg * RAD))} + g.y * ${f4(Math.cos(SLAB_SHAPE.turnDeg * RAD))} + ${f4(SLAB_SHAPE.farMm)}), 0.0);
    vec2 from = g - vec2(${f4(APRON.ledgeAtMm[0])}, ${f4(APRON.ledgeAtMm[1])});
    float across = dot(from, vec2(${f4(-APRON.ledgeDir[1])}, ${f4(APRON.ledgeDir[0])}));
    float along = dot(from, vec2(${f4(APRON.ledgeDir[0])}, ${f4(APRON.ledgeDir[1])}));
    float wideMm = length(vec2(${f4(APRON.bandMm)}, soft));
    float ledge = smoothstep(-wideMm, wideMm, across);
    float band = exp(-across * across / (2.0 * wideMm * wideMm)) * (${f4(APRON.bandMm)} / wideMm) * (1.0 - smoothstep(${f4(APRON.bandFadeMm[0])}, ${f4(APRON.bandFadeMm[1])}, along));
    col += uRoomWall * (vec3(${APRON.tone.map(f4).join(', ')}) * (exp(-beyond / ${f4(APRON.reachMm)}) * ledge * mix(${f4(APRON.leftShare)}, 1.0, smoothstep(${f4(-APRON.sideMm)}, ${f4(APRON.sideMm)}, g.x))) + vec3(${APRON.band.map(f4).join(', ')}) * band) * max(marks, 0.2);
  }
  gl_FragColor = vec4(col, 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(col, -d, 0.0, stageChange(), 0.0);
}`

const DISC_VERT_PARS = `${FAR_GLSL}
attribute vec3 aColorA;
attribute vec3 aColorB;
attribute vec4 aLook;
attribute vec2 aLean;
uniform float uBackMix;
varying vec3 vColor;
varying vec2 vDisc;
varying vec4 vLook;
varying vec4 vCat;
varying vec3 vLensAt;
varying vec4 vEmitter;`

const DISC_VERT = `
  vec3 mid = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float size = length((instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  float mirrored = modelMatrix[1][1] < 0.0 ? 1.0 : 0.0;
  vec4 placed = viewMatrix * vec4(mid, 1.0);
  float depth = max(-placed.z, 1.0);
  float pull = depth * uFar.w - 1.0;
  float radius = size + lensBlurMm(depth);
  placed.xy -= uShift * pull;
  vec4 centre = projectionMatrix * placed;
  vec2 corner = position.xy * ${f4(DISCS.quad)};
  placed.xy += corner * radius;
  gl_Position = projectionMatrix * placed;
  if (mirrored > 0.5 && mid.y > 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vec2 frame = centre.xy / max(centre.w, 1e-3) * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0);
  frame /= length(vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0));
  float out2 = length(frame);
  vCat = vec4(out2 > 1e-4 ? frame / out2 : vec2(1.0, 0.0), 0.5 * ${f4(DISCS.catEye)} * smoothstep(0.3, 1.1, out2), mirrored);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vLensAt = uEye + (right * corner.x + up * corner.y) * (radius / max(pull, 0.05));
  vEmitter = vec4(mid, size);
  vStageWorld = mid;
  vStageAux = vec3(0.0, depth, length(placed.xyz));
  vDisc = corner;
  vLook = aLook;
  vColor = mix(aColorA, aColorB, uBackMix) * (size * size) / (radius * radius);
  vColor *= 1.0 + dot(corner, aLean);`

const DISC = `${SLAB_SHAPE_GLSL}
varying vec3 vColor;
varying vec2 vDisc;
varying vec4 vLook;
varying vec4 vCat;
varying vec3 vLensAt;
varying vec4 vEmitter;
float discHash(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  q = q * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n >> 8u) / 16777216.0;
}
float discNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(discHash(i), discHash(i + vec2(1.0, 0.0)), u.x), mix(discHash(i + vec2(0.0, 1.0)), discHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  float ca = cos(vLook.w);
  float sa = sin(vLook.w);
  vec2 q = vec2(ca * vDisc.x - sa * vDisc.y, sa * vDisc.x + ca * vDisc.y);
  q.x *= vLook.z;
  q = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);
  vec2 cut = vCat.xy * vCat.z;
  float r = max(length(q - cut), length(q + cut));
  if (r >= ${f4(DISCS.quad)}) discard;
  float body = 1.0 - smoothstep(1.0 - vLook.x, 1.0 + vLook.x, r);
  float edge = 1.0 + vLook.y * smoothstep(0.45, 0.93, r);
  float dust = 1.0 - 0.1 * smoothstep(0.62, 0.85, discNoise(vDisc * 5.3 + 17.0 * vLook.w)) - 0.12 * (discNoise(vDisc * 2.1 + 3.0 * vLook.w) - 0.5);
  float seen = 1.0;
  if (vCat.w < 0.5 && vEmitter.y < 0.0 && vLensAt.y > 0.0) {
    float s = vLensAt.y / (vLensAt.y - vEmitter.y);
    vec2 hit = mix(vLensAt.xz, vEmitter.xz, s);
    float w = max(vEmitter.w * s, 0.6);
    seen = 1.0 - smoothstep(-w, w, slabInside(hit));
  }
  vec3 col = vColor * (body * edge * dust * seen);
  gl_FragColor = vec4(col, 1.0);
  if (uDiag != 0) {
    if (r >= 1.0) discard;
    gl_FragColor = stageDiag(vColor, vec3(0.0, 0.0, 1.0), 0.0, stageChange(), 0.0);
  }
}`

export class Backdrop {
  readonly group = new THREE.Group()
  private readonly emitters: Emitter[] = []
  readonly lights: THREE.InstancedMesh
  private readonly material: THREE.ShaderMaterial
  private readonly colorA: THREE.InstancedBufferAttribute
  private readonly colorB: THREE.InstancedBufferAttribute
  private a = ''
  private b = ''
  private readonly brightest: number[]
  readonly dome: THREE.Mesh

  constructor() {
    const rng = stream('backdrop:lights')
    const n = Math.round(config.scene.bokehLights)
    const hero = poseById('hero')
    const forward = hero.aim.clone().sub(hero.position).normalize()
    const farMm = farApertureMm(hero)
    const fromMm = farFromMm(hero)
    const D = DISCS
    const V = PLACED.view
    const tilt = V.pitchDeg * RAD
    const eye = new THREE.Vector3(0, V.aimHeightMm + Math.sin(tilt) * V.distanceMm, Math.cos(tilt) * V.distanceMm)
    const focal = V.heightPx / 2 / Math.tan((V.fovDeg * RAD) / 2)
    const perMm = hero.apertureMm / hero.focusMm + farMm / fromMm
    PLACED.discs.slice(0, n).forEach(([x, y, r, tone, shown, soft, edge, set]) => {
      const narrow = perMm - r / focal
      const depth = set ?? Math.min(PLACED.reachMm[1], Math.max(PLACED.reachMm[0], narrow > 1e-6 ? (hero.apertureMm + farMm - PLACED.sizeMm) / narrow : PLACED.reachMm[1]))
      const size = Math.max(1, (r * depth) / focal - hero.apertureMm * (depth / hero.focusMm - 1) - farMm * (depth / fromMm - 1))
      const ray = new THREE.Vector3(x - V.widthPx / 2, (V.heightPx / 2 - y) * Math.cos(tilt) - focal * Math.sin(tilt), -(V.heightPx / 2 - y) * Math.sin(tilt) - focal * Math.cos(tilt))
      const at = eye.clone().addScaledVector(ray, depth / focal)
      const seenAt = at.clone().sub(hero.position).dot(forward)
      const heroRadius = size + hero.apertureMm * Math.abs(seenAt / hero.focusMm - 1) + farMm * Math.max(0, seenAt / fromMm - 1)
      this.emitters.push({ at, size, shown, level: tone, pick: tone, energy: (shown * heroRadius * heroRadius) / (size * size), heroRadius, look: [soft, edge] })
    })
    const spare = n - this.emitters.length
    const counts = D.zones.map((z) => Math.round(z.share * spare))
    counts[0] = Math.max(0, spare - counts.slice(1).reduce((a, b) => a + b, 0))
    D.zones.forEach((zone, z) => {
      let left = counts[z]!
      const start = [rng.next(), rng.next(), rng.next(), rng.next()]
      const turns = [0, 0]
      let strings = 0
      while (left > 0) {
        const members = Math.min(left, 1 + rng.int(D.stringMost))
        left -= members
        const right = (start[0]! + strings * D.spread[0]) % 1 < zone.rightShare
        strings += 1
        const side = right ? 1 : -1
        const j = turns[right ? 1 : 0]!
        turns[right ? 1 : 0] = j + 1
        const offset = right ? 0.5 : 0
        const azMid = zone.azFrom + (zone.azTo - zone.azFrom) * Math.pow((start[1]! + offset + j * D.spread[1]) % 1, zone.sidePower)
        const elMid = zone.elFrom + (zone.elTo - zone.elFrom) * ((start[2]! + offset + j * D.spread[2]) % 1)
        const levelMid = Math.pow((start[3]! + offset + j * D.spread[3]) % 1, right ? D.rightLevel : 1 / D.rightLevel)
        const pickMid = rng.next()
        const reachMid = D.nearMm + D.spanMm * (zone.depthFrom + (1 - zone.depthFrom) * Math.pow(rng.next(), D.depthPower))
        for (let k = 0; k < members; k++) {
          const lone = members === 1
          const az = side * Math.max(zone.azFrom, azMid + (lone ? 0 : rng.range(-D.stringAcrossDeg, D.stringAcrossDeg))) * RAD
          const el = Math.max(zone.elFrom, elMid + (lone ? 0 : rng.range(-D.stringDownDeg, D.stringDownDeg))) * RAD
          const reach = reachMid * (1 + (lone ? 0 : rng.range(-D.stringDepth, D.stringDepth)))
          const at = hero.position.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).multiplyScalar(reach))
          const large = rng.next() < D.largeShare
          const size = large ? rng.range(D.largeMm[0], D.largeMm[1]) : rng.range(D.sizeMm[0], D.sizeMm[1])
          const level = zone.levelFrom + (1 - zone.levelFrom) * Math.min(1, Math.max(0, levelMid + (lone ? 0 : rng.range(-D.stringLevel, D.stringLevel))))
          const shown = D.dimmest * Math.pow(10, D.decades * Math.pow(level, D.dimPower))
          const depth = at.clone().sub(hero.position).dot(forward)
          const heroRadius = size + hero.apertureMm * Math.abs(depth / hero.focusMm - 1) + farMm * Math.max(0, depth / fromMm - 1)
          this.emitters.push({ at, size, shown, level, pick: Math.min(0.999, Math.max(0, pickMid + (lone ? 0 : rng.range(-D.stringLevel, D.stringLevel)))), energy: (shown * heroRadius * heroRadius) / (size * size), heroRadius })
        }
      }
    })
    const centre = new THREE.Vector3(0, centreHeightMm, 0)
    this.brightest = this.emitters
      .map((e, i) => ({ i, w: (e.shown * e.heroRadius * e.heroRadius) / e.at.distanceToSquared(centre), d: e.at.clone().sub(centre).normalize() }))
      .filter((p) => Math.abs(Math.atan2(p.d.x, -p.d.z)) >= CLEAR_SIDE || Math.asin(p.d.y) >= CLEAR_UP)
      .sort((p, q) => q.w - p.w)
      .slice(0, ROOM_LIGHTS)
      .map((p) => p.i)
    this.brightest.forEach((i, slot) => {
      const e = this.emitters[i]!
      const dir = e.at.clone().sub(centre)
      const dist = dir.length()
      dir.normalize()
      roomUniforms.uRoomDir.value[slot]!.set(dir.x, dir.y, dir.z, Math.cos(Math.atan2(e.heroRadius, dist)))
    })

    const dome = (this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(ROOM_RADIUS_MM, 48, 24),
      stageShader({ part: 'backdrop', standIn: false, uniforms: { ...roomUniforms, ...lensUniforms, ...wallUniforms }, fragment: DOME, params: { side: THREE.BackSide, depthWrite: false } }),
    ))
    dome.frustumCulled = false
    dome.renderOrder = -2
    this.group.add(dome)

    this.material = stageShader({
      part: 'backdrop',
      standIn: false,
      change: 'backdrop',
      uniforms: { ...lensUniforms, uBackMix: { value: 0 } },
      vertexPars: DISC_VERT_PARS,
      vertexMain: DISC_VERT,
      fragment: DISC,
      params: { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, side: THREE.DoubleSide },
    })
    const g = new THREE.PlaneGeometry(2, 2)
    this.lights = new THREE.InstancedMesh(g, this.material, n)
    const m = new THREE.Matrix4()
    const look = new Float32Array(n * 4)
    const lean = new Float32Array(n * 2)
    const looks = stream('backdrop:looks')
    this.emitters.forEach((e, i) => {
      m.makeScale(e.size, e.size, e.size).setPosition(e.at)
      this.lights.setMatrixAt(i, m)
      look[i * 4] = looks.range(DISCS.soft[0], DISCS.soft[1])
      look[i * 4 + 1] = looks.next() < DISCS.edgeShare ? looks.range(DISCS.edge[0], DISCS.edge[1]) : looks.range(-0.12, 0.05)
      if (e.look) {
        look[i * 4] = e.look[0]
        look[i * 4 + 1] = e.look[1]
      }
      look[i * 4 + 2] = looks.range(0.93, 1.07)
      look[i * 4 + 3] = looks.range(0, Math.PI)
      const turn = looks.range(0, 2 * Math.PI)
      const tilt = looks.range(DISCS.lean[0], DISCS.lean[1])
      lean[i * 2] = Math.cos(turn) * tilt
      lean[i * 2 + 1] = Math.sin(turn) * tilt
    })
    this.colorA = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    this.colorB = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    g.setAttribute('aColorA', this.colorA)
    g.setAttribute('aColorB', this.colorB)
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 4))
    g.setAttribute('aLean', new THREE.InstancedBufferAttribute(lean, 2))
    this.lights.frustumCulled = false
    this.lights.renderOrder = 20
    this.group.add(this.lights)
  }

  private fill(attr: THREE.InstancedBufferAttribute, kit: SeasonKit): void {
    const a = attr.array as Float32Array
    this.emitters.forEach((e, i) => {
      const list = kit.backdrop.colors
      const c = list[Math.min(list.length - 1, Math.floor(list.length * (DISCS.colourByLevel * e.level + (1 - DISCS.colourByLevel) * e.pick)))]!
      a[i * 3] = c[0] * e.energy
      a[i * 3 + 1] = c[1] * e.energy
      a[i * 3 + 2] = c[2] * e.energy
    })
    attr.needsUpdate = true
  }

  update(f: StageFrame): void {
    setLens(f.pose, f.sample, f.focalPx, f.lensOn)
    roomUniforms.uRoomKey.value.copy(f.keyDir)
    roomUniforms.uRoomKeyCol.value.copy(f.keyCol)
    roomUniforms.uRoomRim.value.copy(f.rimDir)
    roomUniforms.uRoomRimCol.value.copy(f.rimCol)
    lensState.bloomTint.copy(f.bloomTint)
    this.set(f.from, f.to, f.mix.base)
    this.group.visible = f.view !== 'flow' && f.view !== 'lightgrid'
  }

  set(from: SeasonKit, to: SeasonKit, mix: number): void {
    if (this.a !== from.season) {
      this.fill(this.colorA, from)
      this.a = from.season
    }
    if (this.b !== to.season) {
      this.fill(this.colorB, to)
      this.b = to.season
    }
    this.material.uniforms.uBackMix!.value = mix
    const wall = roomUniforms.uRoomWall.value
    const floor = roomUniforms.uRoomFloor.value
    const ra = from.backdrop.room
    const rb = to.backdrop.room
    const fa = from.backdrop.floor
    const fb = to.backdrop.floor
    wall.setRGB(ra[0] + (rb[0] - ra[0]) * mix, ra[1] + (rb[1] - ra[1]) * mix, ra[2] + (rb[2] - ra[2]) * mix)
    const ta = tintOf(from.season)
    const tb = tintOf(to.season)
    wallUniforms.uWallBase.value.set(ta.base[0] + (tb.base[0] - ta.base[0]) * mix, ta.base[1] + (tb.base[1] - ta.base[1]) * mix, ta.base[2] + (tb.base[2] - ta.base[2]) * mix).multiplyScalar(WALL.base)
    wallUniforms.uWallColumn.value.set(ta.column[0] + (tb.column[0] - ta.column[0]) * mix, ta.column[1] + (tb.column[1] - ta.column[1]) * mix, ta.column[2] + (tb.column[2] - ta.column[2]) * mix).multiplyScalar(WALL.column)
    floor.setRGB(fa[0] + (fb[0] - fa[0]) * mix, fa[1] + (fb[1] - fa[1]) * mix, fa[2] + (fb[2] - fa[2]) * mix)
    const A = this.colorA.array as Float32Array
    const B = this.colorB.array as Float32Array
    this.brightest.forEach((i, slot) => {
      const e = this.emitters[i]!
      const k = (DISCS.roomLightGain * e.shown) / e.energy
      roomUniforms.uRoomCol.value[slot]!.setRGB(
        (A[i * 3]! + (B[i * 3]! - A[i * 3]!) * mix) * k,
        (A[i * 3 + 1]! + (B[i * 3 + 1]! - A[i * 3 + 1]!) * mix) * k,
        (A[i * 3 + 2]! + (B[i * 3 + 2]! - A[i * 3 + 2]!) * mix) * k,
      )
    })
  }
}
