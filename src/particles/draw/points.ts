import * as THREE from 'three'
import { config } from '../../config'
import { stageShader, type Rgb } from '../../core/materials'
import { flagStandIn } from '../../core/standins'
import type { ParticleSource } from '../../core/stage'
import { partBytes, viewCode } from '../../diagnostics/views'

export const MAX_KINDS = 16

const VERT_PARS = `
attribute vec3 aPrev;
attribute vec4 aData;
uniform vec4 uPoint;
uniform vec4 uPointClock;
varying vec4 vPoint;
varying vec4 vStreak;
`

const VERT_MAIN = `
  vec3 now = mix(aPrev, position, uPoint.x);
  vec4 nowWorld = modelMatrix * vec4(now, 1.0);
  vStageWorld = nowWorld.xyz;
  vStageLocal = (uGlobeInv * nowWorld).xyz;
  vec4 nowPlaced = lensPlace(nowWorld.xyz, cameraPosition);
  vec4 nowView = viewMatrix * vec4(nowPlaced.xyz, 1.0);
  gl_Position = projectionMatrix * nowView;
  vStageAux = vec3(nowPlaced.w, -nowView.z, length(nowView.xyz));
  float reach = max(-(viewMatrix * nowWorld).z, 1.0);
  float size = max(2.0 * aData.x * uPoint.y * (uLens.z > 0.5 ? uLens.y : 1.0) / reach, 1.5);
  vec2 streak = vec2(0.0);
  if (uPoint.z > 0.0) {
    vec4 wasPlaced = lensPlace((modelMatrix * vec4(aPrev, 1.0)).xyz, cameraPosition);
    vec4 was = projectionMatrix * viewMatrix * vec4(wasPlaced.xyz, 1.0);
    streak = (gl_Position.xy / gl_Position.w - was.xy / was.w) * uPointClock.zw * 0.5 * uPoint.z;
    float len = length(streak);
    if (len > 3.0 * size) streak *= 3.0 * size / len;
  }
  float extra = length(streak);
  size = min(size, uPoint.w);
  gl_PointSize = min(size + extra, uPoint.w);
  vPoint = vec4(aData.y, float(gl_VertexID), aData.z, aData.w);
  vStreak = vec4(streak, size, size + extra);
`

const FRAG = `
uniform vec4 uKindColor[${MAX_KINDS}];
uniform vec3 uKindPart[${MAX_KINDS}];
uniform vec3 uPointLight;
uniform vec4 uPointClock;
uniform float uPointChange;
varying vec4 vPoint;
varying vec4 vStreak;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * vec2(1.0, -1.0) * vStreak.w;
  vec2 a = vStreak.xy * 0.5;
  float along = dot(a, a) > 1e-6 ? clamp(dot(p, a) / dot(a, a), -1.0, 1.0) : 0.0;
  float d = length(p - a * along) / (0.5 * vStreak.z);
  if (d > 1.0) discard;
  int kind = int(vPoint.x + 0.5);
  float cover = (1.0 - d * d) * vPoint.z * (vStreak.z / vStreak.w);
  float fog = stageVeil(vStageAux.x);
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  if (cover < stageHash(vec3(gl_FragCoord.xy, uSeed + vPoint.y * 0.013))) discard;
  vec4 k = uKindColor[kind];
  float twinkle = pow(0.5 + 0.5 * sin(6.2831853 * (vPoint.w + 3.0 * uPointClock.x)), 6.0);
  vec3 col = k.rgb * (uPointLight + stageGrid(vStageLocal)) + k.rgb * k.a * twinkle;
  col = mix(col, uVeil.rgb * (uVeilLight + stageGrid(vStageLocal)), fog * 0.6);
  gl_FragColor = vec4(col, 1.0);
  if (uDiag == ${viewCode('ids')} || uDiag == ${viewCode('standins')}) gl_FragColor = vec4(uKindPart[kind], 1.0);
  else if (uDiag != 0) gl_FragColor = stageDiag(k.rgb, vec3(0.0, 0.0, 1.0), fog, uPointChange, 0.0);
}`

export interface PointColors {
  from: Readonly<Record<string, { color: Rgb; glow: number }>>
  to: Readonly<Record<string, { color: Rgb; glow: number }>>
  all: Readonly<Record<string, { color: Rgb; glow: number }>>
  mix: number
}

export class ParticleDraw {
  readonly points: THREE.Points
  private readonly material: THREE.ShaderMaterial
  private geometry: THREE.BufferGeometry
  private position!: THREE.BufferAttribute
  private previous!: THREE.BufferAttribute
  private data!: THREE.BufferAttribute
  private capacity = 0
  private readonly phases = new Map<number, Float32Array>()
  drawn = 0
  maxPointPx = 256

  constructor(radiusMm: number) {
    this.material = stageShader({
      part: 'particle-engine',
      standIn: false,
      inside: true,
      uniforms: {
        uPoint: { value: new THREE.Vector4(1, 1, 0, 256) },
        uPointClock: { value: new THREE.Vector4(0, 0, 1, 1) },
        uPointLight: { value: new THREE.Color() },
        uPointChange: { value: 0 },
        uKindColor: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector4()) },
        uKindPart: { value: Array.from({ length: MAX_KINDS }, () => new THREE.Vector3()) },
      },
      vertexPars: VERT_PARS,
      vertexMain: VERT_MAIN,
      fragment: FRAG,
    })
    this.geometry = new THREE.BufferGeometry()
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radiusMm)
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    this.allocate(1)
  }

  private allocate(count: number): void {
    this.capacity = count
    this.position = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage)
    this.previous = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage)
    this.data = new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage)
    const old = this.geometry
    this.geometry = new THREE.BufferGeometry()
    this.geometry.boundingSphere = old.boundingSphere
    this.geometry.setAttribute('position', this.position)
    this.geometry.setAttribute('aPrev', this.previous)
    this.geometry.setAttribute('aData', this.data)
    this.points.geometry = this.geometry
    old.dispose()
  }

  private phaseOf(count: number): Float32Array {
    let p = this.phases.get(count)
    if (!p) {
      p = new Float32Array(count)
      let s = (config.seed ^ 0x9e3779b9) >>> 0
      for (let i = 0; i < count; i++) {
        s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + i) >>> 0
        s = Math.imul(s ^ (s >>> 12), 0x297a2d39) >>> 0
        p[i] = ((s ^ (s >>> 15)) >>> 0) / 4294967296
      }
      this.phases.clear()
      this.phases.set(count, p)
    }
    return p
  }

  update(source: ParticleSource, opts: { mix: number; focalPx: number; streak: number; width: number; height: number; fraction: number; clock: number; colors: PointColors; light: Rgb; change: number; diagnostic: boolean }): void {
    const n = source.count
    if (n !== this.capacity) this.allocate(Math.max(1, n))
    ;(this.position.array as Float32Array).set(source.pos.subarray(0, n * 3))
    ;(this.previous.array as Float32Array).set(source.prev.subarray(0, n * 3))
    const d = this.data.array as Float32Array
    const sizes = source.sizes
    const kindOf = source.kindOf
    const opacity = source.opacity
    const phase = source.phase ?? this.phaseOf(n)
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      d[o] = sizes[i]!
      d[o + 1] = kindOf[i]!
      d[o + 2] = opacity ? opacity[i]! : 1
      d[o + 3] = phase[i]!
    }
    this.position.needsUpdate = true
    this.previous.needsUpdate = true
    this.data.needsUpdate = true
    this.drawn = Math.max(0, Math.min(n, Math.floor(n * opts.fraction)))
    this.geometry.setDrawRange(0, this.drawn)

    const u = this.material.uniforms
    ;(u.uPoint!.value as THREE.Vector4).set(opts.mix, opts.focalPx, opts.streak, this.maxPointPx)
    ;(u.uPointClock!.value as THREE.Vector4).set(opts.clock, 0, opts.width, opts.height)
    ;(u.uPointLight!.value as THREE.Color).setRGB(opts.light[0], opts.light[1], opts.light[2])
    u.uPointChange!.value = opts.change
    const colors = u.uKindColor!.value as THREE.Vector4[]
    const parts = u.uKindPart!.value as THREE.Vector3[]
    const names: string[] = []
    source.kinds.forEach((kind, i) => {
      if (i >= MAX_KINDS) return
      const c = opts.colors
      const a = c.from[kind] ?? c.to[kind] ?? c.all[kind]
      const b = c.to[kind] ?? c.from[kind] ?? c.all[kind]
      if (!a || !b) throw new Error(`no season gives a colour to the particle kind ${kind}`)
      const t = c.mix
      colors[i]!.set(a.color[0] + (b.color[0] - a.color[0]) * t, a.color[1] + (b.color[1] - a.color[1]) * t, a.color[2] + (b.color[2] - a.color[2]) * t, a.glow + (b.glow - a.glow) * t)
      const name = `particle-${kind}`
      const bytes = partBytes(name)
      parts[i]!.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255)
      flagStandIn(name)
      names.push(name)
    })
    this.points.userData.standIn = names[0] ?? 'particle-engine'
    this.points.userData.standIns = names
    const cover = opts.diagnostic
    const m = this.material
    if (cover !== (m.blending === THREE.CustomBlending)) {
      m.blending = cover ? THREE.CustomBlending : THREE.NoBlending
      m.blendEquation = THREE.AddEquation
      m.blendSrc = THREE.DstAlphaFactor
      m.blendDst = THREE.OneMinusSrcAlphaFactor
      m.blendSrcAlpha = THREE.ZeroFactor
      m.blendDstAlpha = THREE.OneFactor
      m.depthWrite = !cover
      m.needsUpdate = true
    }
  }
}
