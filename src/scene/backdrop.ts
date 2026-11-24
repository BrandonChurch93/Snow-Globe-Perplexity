import * as THREE from 'three'
import { config } from '../config'
import { stageShader } from '../core/materials'
import { stream } from '../core/rng'
import type { SeasonKit } from '../seasons/kit'
import { centreHeightMm } from './layout'

export const ROOM_LIGHTS = 12

export const ROOM_GLSL = `
uniform vec3 uRoomWall;
uniform vec3 uRoomFloor;
uniform vec4 uRoomDir[${ROOM_LIGHTS}];
uniform vec3 uRoomCol[${ROOM_LIGHTS}];
vec3 stageRoom(vec3 d) {
  vec3 wall = uRoomWall * (1.0 + 2.0 * smoothstep(-0.05, 0.6, d.y));
  return d.y < 0.0 ? mix(uRoomFloor, uRoomWall, smoothstep(-0.03, 0.0, d.y)) : wall;
}
vec3 stageRoomLights(vec3 d, float soft) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${ROOM_LIGHTS}; i++) {
    float c = dot(d, uRoomDir[i].xyz);
    sum += uRoomCol[i] * smoothstep(uRoomDir[i].w - soft, uRoomDir[i].w + soft * 0.2, c);
  }
  return sum;
}
`

export const roomUniforms = {
  uRoomWall: { value: new THREE.Color() },
  uRoomFloor: { value: new THREE.Color() },
  uRoomDir: { value: Array.from({ length: ROOM_LIGHTS }, () => new THREE.Vector4(0, 1, 0, 2)) },
  uRoomCol: { value: Array.from({ length: ROOM_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
}

interface Emitter {
  at: THREE.Vector3
  radius: number
  power: number
  pick: number
}

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
    for (let i = 0; i < n; i++) {
      const z = -rng.range(700, 2400)
      const spread = 0.42 * -z
      const radius = rng.range(5, 13)
      this.emitters.push({ at: new THREE.Vector3(rng.range(-spread, spread), rng.range(20, 0.3 * -z), z), radius, power: rng.range(1.5, 7), pick: rng.int(1 << 16) })
    }
    const centre = new THREE.Vector3(0, centreHeightMm, 0)
    this.brightest = this.emitters
      .map((e, i) => ({ i, w: (e.power * e.radius * e.radius) / e.at.distanceToSquared(centre) }))
      .sort((p, q) => q.w - p.w)
      .slice(0, ROOM_LIGHTS)
      .map((p) => p.i)
    this.brightest.forEach((i, slot) => {
      const e = this.emitters[i]!
      const dir = e.at.clone().sub(centre)
      const dist = dir.length()
      dir.normalize()
      roomUniforms.uRoomDir.value[slot]!.set(dir.x, dir.y, dir.z, Math.cos(Math.atan2(e.radius * 3, dist)))
    })

    const dome = (this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(5000, 48, 24),
      stageShader({
        part: 'backdrop',
        uniforms: { ...roomUniforms },
        fragment: `${ROOM_GLSL}
void main() {
  vec3 d = normalize(vStageWorld - vec3(0.0, ${centreHeightMm.toFixed(1)}, 0.0));
  vec3 col = stageRoom(d);
  gl_FragColor = vec4(col, 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(col, -d, 0.0, stageChange(), 0.0);
}`,
        params: { side: THREE.BackSide, depthWrite: false },
      }),
    ))
    dome.userData.standIn = 'backdrop'
    dome.frustumCulled = false
    dome.renderOrder = -2
    this.group.add(dome)

    this.material = stageShader({
      part: 'backdrop',
      change: 'backdrop',
      uniforms: { uBokeh: { value: new THREE.Vector4() }, uBackMix: { value: 0 } },
      vertexPars: `attribute vec3 aColorA;\nattribute vec3 aColorB;\nuniform vec4 uBokeh;\nuniform float uBackMix;\nvarying vec3 vColor;`,
      vertexMain: `
  vec3 mid = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float size = length((instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  float depth = -(viewMatrix * vec4(mid, 1.0)).z;
  float defocus = 1.0 - depth * uBokeh.y;
  float grow = (size + uBokeh.x * abs(defocus)) / size;
  vec4 placed = viewMatrix * vec4(mid + (stageWorld.xyz - mid) * grow, 1.0);
  placed.xy += uBokeh.zw * defocus;
  gl_Position = projectionMatrix * placed;
  vColor = mix(aColorA, aColorB, uBackMix) / (grow * grow);`,
      fragment: `varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(vColor, vec3(0.0, 0.0, 1.0), 0.0, stageChange(), 0.0);
}`,
      params: { blending: THREE.AdditiveBlending, depthWrite: false },
    })
    const g = new THREE.SphereGeometry(1, 14, 10)
    this.lights = new THREE.InstancedMesh(g, this.material, n)
    const m = new THREE.Matrix4()
    this.emitters.forEach((e, i) => {
      m.makeScale(e.radius, e.radius, e.radius).setPosition(e.at)
      this.lights.setMatrixAt(i, m)
    })
    this.colorA = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    this.colorB = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    g.setAttribute('aColorA', this.colorA)
    g.setAttribute('aColorB', this.colorB)
    this.lights.frustumCulled = false
    this.lights.userData.standIn = 'backdrop'
    this.lights.renderOrder = -1
    this.group.add(this.lights)
  }

  private fill(attr: THREE.InstancedBufferAttribute, kit: SeasonKit): void {
    const a = attr.array as Float32Array
    this.emitters.forEach((e, i) => {
      const c = kit.backdrop.colors[e.pick % kit.backdrop.colors.length]!
      a[i * 3] = c[0] * e.power
      a[i * 3 + 1] = c[1] * e.power
      a[i * 3 + 2] = c[2] * e.power
    })
    attr.needsUpdate = true
  }

  set(from: SeasonKit, to: SeasonKit, mix: number, apertureMm: number, focusMm: number, shiftX: number, shiftY: number): void {
    if (this.a !== from.season) {
      this.fill(this.colorA, from)
      this.a = from.season
    }
    if (this.b !== to.season) {
      this.fill(this.colorB, to)
      this.b = to.season
    }
    const u = this.material.uniforms
    u.uBackMix!.value = mix
    ;(u.uBokeh!.value as THREE.Vector4).set(apertureMm, 1 / focusMm, shiftX, shiftY)
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
      const k = 0.35
      roomUniforms.uRoomCol.value[slot]!.setRGB(
        (A[i * 3]! + (B[i * 3]! - A[i * 3]!) * mix) * k,
        (A[i * 3 + 1]! + (B[i * 3 + 1]! - A[i * 3 + 1]!) * mix) * k,
        (A[i * 3 + 2]! + (B[i * 3 + 2]! - A[i * 3 + 2]!) * mix) * k,
      )
    })
  }
}
