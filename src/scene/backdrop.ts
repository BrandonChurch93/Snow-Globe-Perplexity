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
import { SLAB_SHAPE_GLSL } from './surface'

const RAD = Math.PI / 180
const CLEAR_SIDE = 16 * RAD
const CLEAR_UP = 9 * RAD

export const DISCS = {
  zones: [
    { share: 0.42, azFrom: 5.6, azTo: 14.6, elFrom: -2.3, elTo: 4.8, sidePower: 0.8, rightShare: 1, levelFrom: 0, depthFrom: 0 },
    { share: 0.33, azFrom: 5.8, azTo: 15, elFrom: -3.8, elTo: 4.6, sidePower: 0.8, rightShare: 0, levelFrom: 0, depthFrom: 0 },
    { share: 0.1, azFrom: 5, azTo: 22, elFrom: 4.4, elTo: 11, sidePower: 1, rightShare: 0.75, levelFrom: 0.3, depthFrom: 0.45 },
    { share: 0.15, azFrom: 15, azTo: 48, elFrom: -6.2, elTo: 12, sidePower: 1, rightShare: 0.5, levelFrom: 0, depthFrom: 0 },
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
  sizeMm: [0.8, 3.5] as [number, number],
  largeShare: 0.02,
  largeMm: [5, 11] as [number, number],
  dimmest: 0.035,
  decades: 1.57,
  dimPower: 1.6,
  colourByLevel: 0.55,
  soft: [0.28, 0.7] as [number, number],
  edgeShare: 0.32,
  edge: [0.1, 0.36] as [number, number],
  lean: [0.06, 0.3] as [number, number],
  quad: 2,
  catEye: 0.52,
  roomLightGain: 0.8,
}

export const WALL = { seen: ROOM_SEEN, streaks: 0.16, fine: 0.1, folds: 0.2, mottle: 0.22 }

interface Emitter {
  at: THREE.Vector3
  size: number
  shown: number
  level: number
  pick: number
  energy: number
  heroRadius: number
}

const f4 = (v: number) => v.toFixed(4)

const DOME = `${ROOM_GLSL}
${FAR_GLSL}
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
  vec3 col = roomWall(d, blur) * max(marks, 0.2) + roomSources(d, blur) * ${f4(WALL.seen)};
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
    const counts = D.zones.map((z) => Math.round(z.share * n))
    counts[0] = n - counts.slice(1).reduce((a, b) => a + b, 0)
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
      stageShader({ part: 'backdrop', standIn: false, uniforms: { ...roomUniforms, ...lensUniforms }, fragment: DOME, params: { side: THREE.BackSide, depthWrite: false } }),
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
