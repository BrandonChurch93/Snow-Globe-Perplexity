import * as THREE from 'three'
import { config } from '../config'
import type { Gfx } from '../core/gl'
import { hashText, stream } from '../core/rng'
import type { Sample } from '../core/sampler'
import type { Moment, Stage } from '../core/stage'
import { CENTRE_Y, GROUND_Y, INNER_R, SHAPES, type SpikeSim } from '../particles/spikeSim'
import { applyPose, type Pose } from './cameras'

const G = config.globe
const OUTER_R = G.sphereDiameterMm / 2

const POINT_VERT = `
in vec3 position;
in vec3 aPrev;
in float aSize;
in float aKind;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uMix;
uniform float uScale;
out float vKind;
out float vId;
out float vDepth;
void main() {
  vec3 p = mix(aPrev, position, uMix);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, 2.0 * aSize * uScale / -mv.z);
  vKind = aKind;
  vId = float(gl_VertexID);
  vDepth = p.y;
}`

const POINT_FRAG = `
precision highp float;
uniform float uSeed;
uniform int uFlat;
uniform vec3 uFlatColor;
in float vKind;
in float vId;
in float vDepth;
out vec4 o;
float hash(vec3 p) {
  uvec3 v = uvec3(uint(p.x), uint(p.y), uint(p.z * 4096.0));
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
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  if (uFlat == 1) { o = vec4(uFlatColor, 1.0); return; }
  float a = (1.0 - d) * (vKind < 0.5 ? 0.9 : 1.0);
  if (a < hash(vec3(gl_FragCoord.xy, uSeed + vId * 0.013))) discard;
  float lift = 0.75 + 0.25 * clamp((vDepth + 30.0) / 80.0, 0.0, 1.0);
  vec3 col = vKind < 0.5 ? vec3(0.86, 0.9, 0.96) * lift : vec3(2.6, 2.3, 1.7) * step(0.82, hash(vec3(vId, uSeed, 1.0)));
  if (vKind > 0.5 && col.r < 0.1) col = vec3(0.5, 0.48, 0.42);
  o = vec4(col, 1.0);
}`

const GLASS_VERT = `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const GLASS_FRAG = `
uniform sampler2D uInner;
uniform mat4 uViewProj;
uniform vec3 uCentre;
uniform float uIor;
uniform int uFlat;
uniform vec3 uFlatColor;
in vec3 vWorld;
in vec3 vNormal;
out vec4 o;
vec3 env(vec3 r) {
  float up = r.y * 0.5 + 0.5;
  vec3 c = mix(vec3(0.004, 0.005, 0.007), vec3(0.03, 0.035, 0.045), up * up);
  float key = smoothstep(0.90, 0.985, dot(r, normalize(vec3(-0.55, 0.62, 0.56))));
  float strip = smoothstep(0.05, 0.0, abs(r.x - 0.55)) * smoothstep(0.1, 0.5, r.y) * smoothstep(0.95, 0.6, r.y);
  return c + vec3(9.0, 8.6, 8.0) * key + vec3(1.6, 1.8, 2.2) * strip;
}
void main() {
  if (uFlat == 1) {
    if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 4.0) > 0.5) discard;
    o = vec4(uFlatColor, 1.0);
    return;
  }
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float nv = clamp(dot(n, v), 0.0, 1.0);
  float f = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  vec3 t = refract(-v, n, 1.0 / uIor);
  float reach = max(dot(uCentre - vWorld, t), 0.0);
  vec3 p = vWorld + t * reach;
  vec4 clip = uViewProj * vec4(p, 1.0);
  vec2 uv = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.001, 0.999);
  vec3 inner = texture(uInner, uv).rgb;
  vec3 refl = env(reflect(-v, n));
  o = vec4(inner * (1.0 - f) * vec3(0.97, 0.985, 1.0) + refl * f, 1.0);
}`

const partColor = (name: string) => {
  const h = hashText(name, 77)
  return new THREE.Color().setHSL((h % 360) / 360, 0.75, 0.35 + ((h >>> 9) % 30) / 100)
}

export class SpikeStage implements Stage {
  readonly standIn = true
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera()
  private readonly globe = new THREE.Group()
  private readonly interior = new THREE.Group()
  private readonly glass: THREE.Mesh
  private readonly glassMaterial: THREE.ShaderMaterial
  private readonly points: THREE.Points
  private readonly pointMaterial: THREE.RawShaderMaterial
  private readonly position: THREE.BufferAttribute
  private readonly previous: THREE.BufferAttribute
  private readonly key: THREE.DirectionalLight
  private inner: THREE.WebGLRenderTarget
  private diag = ''
  private uploaded = -1
  private readonly flat = new Map<THREE.Object3D, THREE.Material>()
  private readonly lit = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>()
  private readonly names = new Set<string>()

  constructor(private readonly gfx: Gfx, private readonly sim: SpikeSim, width: number, height: number) {
    const { scene, globe, interior } = this
    scene.background = new THREE.Color(0.0035, 0.004, 0.0055)
    this.inner = this.makeInner(width, height)

    const std = (color: number, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
    const tag = <T extends THREE.Object3D>(o: T, part: string): T => {
      o.userData.standIn = part
      this.names.add(part)
      return o
    }

    const slab = tag(new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), std(0x0b0c0f, 0.32)), 'surface')
    slab.rotation.x = -Math.PI / 2
    slab.receiveShadow = true
    scene.add(slab)

    const rng = stream('spike:lights')
    const n = Math.round(config.scene.bokehLights)
    const lights = tag(new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), n), 'backdrop')
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const z = -rng.range(700, 2400)
      const spread = 0.42 * -z
      const r = rng.range(5, 13)
      m.makeScale(r, r, r).setPosition(rng.range(-spread, spread), rng.range(20, 0.3 * -z), z)
      lights.setMatrixAt(i, m)
      const warm = rng.next()
      const power = rng.range(1.5, 7)
      c.setRGB(power * (0.9 + 0.3 * warm), power * (0.75 + 0.1 * warm), power * (0.9 - 0.55 * warm))
      lights.setColorAt(i, c)
    }
    lights.frustumCulled = false
    scene.add(lights)

    const base = tag(new THREE.Mesh(new THREE.CylinderGeometry(G.baseDiameterMm / 2, G.baseDiameterMm / 2 + 3, G.baseHeightMm, 96, 1), std(0x2a1c14, 0.55)), 'base-winter')
    base.position.y = G.baseHeightMm / 2
    base.castShadow = true
    base.receiveShadow = true
    globe.add(base)

    interior.position.y = CENTRE_Y
    const groundR = Math.sqrt(INNER_R * INNER_R - GROUND_Y * GROUND_Y)
    const island = tag(new THREE.Mesh(new THREE.CylinderGeometry(groundR, groundR - 6, 6, 72, 1), std(0xdfe6ee, 0.9)), 'miniature-winter')
    island.position.y = GROUND_Y - 3
    island.receiveShadow = true
    interior.add(island)
    const b = SHAPES.box
    const box = tag(new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, b.hy * 2, b.hz * 2), std(0x8a5a3c, 0.8)), 'miniature-winter')
    box.position.set(b.cx, b.cy, b.cz)
    const k = SHAPES.cone
    const cone = tag(new THREE.Mesh(new THREE.ConeGeometry(k.r, k.h, 48, 1), std(0x1f4d33, 0.85)), 'miniature-winter')
    cone.position.set(k.cx, GROUND_Y + k.h / 2, k.cz)
    const s = SHAPES.ball
    const ball = tag(new THREE.Mesh(new THREE.SphereGeometry(s.r, 32, 20), std(0xc8452e, 0.4)), 'miniature-winter')
    ball.position.set(s.cx, s.cy, s.cz)
    for (const o of [box, cone, ball]) {
      o.castShadow = true
      o.receiveShadow = true
      interior.add(o)
    }

    const geo = new THREE.BufferGeometry()
    this.position = new THREE.BufferAttribute(new Float32Array(sim.count * 3), 3).setUsage(THREE.DynamicDrawUsage)
    this.previous = new THREE.BufferAttribute(new Float32Array(sim.count * 3), 3).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', this.position)
    geo.setAttribute('aPrev', this.previous)
    geo.setAttribute('aSize', new THREE.BufferAttribute(sim.sizes, 1))
    geo.setAttribute('aKind', new THREE.BufferAttribute(Float32Array.from(sim.kindOf), 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), OUTER_R)
    this.pointMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: { uMix: { value: 1 }, uScale: { value: 1 }, uSeed: { value: 0 }, uFlat: { value: 0 }, uFlatColor: { value: partColor('particle-flake') } },
    })
    this.points = tag(new THREE.Points(geo, this.pointMaterial), 'particle-flake')
    this.names.add('particle-glitter')
    this.points.frustumCulled = false
    interior.add(this.points)
    globe.add(interior)

    this.glassMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
      uniforms: { uInner: { value: null }, uViewProj: { value: new THREE.Matrix4() }, uCentre: { value: new THREE.Vector3() }, uIor: { value: G.liquidIor }, uFlat: { value: 0 }, uFlatColor: { value: partColor('glass') } },
    })
    this.glass = tag(new THREE.Mesh(new THREE.SphereGeometry(OUTER_R, 128, 80), this.glassMaterial), 'glass')
    this.glass.position.y = CENTRE_Y
    for (const p of ['liquid', 'lens', 'shake', 'particle-engine', 'light-engine']) this.names.add(p)
    globe.add(this.glass)
    scene.add(globe)

    this.key = new THREE.DirectionalLight(0xfff1dc, 3.2)
    this.key.position.set(-260, 420, 300)
    this.key.target.position.set(0, 70, 0)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    const sc = this.key.shadow.camera
    sc.left = -130
    sc.right = 130
    sc.top = 130
    sc.bottom = -130
    sc.near = 100
    sc.far = 1100
    this.key.shadow.bias = -0.0004
    this.key.shadow.normalBias = 0.6
    scene.add(this.key, this.key.target)
    const rim = new THREE.DirectionalLight(0x9db8ff, 1.1)
    rim.position.set(300, 200, -380)
    scene.add(rim)
    scene.add(new THREE.HemisphereLight(0x3c4a66, 0x0a0806, 0.9))

    gfx.renderer.shadowMap.enabled = true
    gfx.renderer.shadowMap.type = THREE.PCFShadowMap
    gfx.renderer.shadowMap.autoUpdate = false
  }

  private makeInner(width: number, height: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(width, height, {
      type: this.gfx.caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    })
  }

  parts(): { name: string; color: number }[] {
    return [...this.names].sort().map((name) => ({ name, color: partColor(name).getHex(THREE.LinearSRGBColorSpace) }))
  }

  resize(width: number, height: number): void {
    this.inner.dispose()
    this.inner = this.makeInner(width, height)
  }

  setDiagnostic(view: string): void {
    this.diag = view
    this.flat.clear()
  }

  particleCount(): number {
    return this.sim.count
  }

  textureBytes(): number {
    const s = this.key.shadow.mapSize
    return this.inner.width * this.inner.height * (this.gfx.caps.half ? 8 : 4) + s.x * s.y * 4
  }

  private upload(): void {
    if (this.uploaded === this.sim.step) return
    ;(this.position.array as Float32Array).set(this.sim.pos)
    ;(this.previous.array as Float32Array).set(this.sim.prev)
    this.position.needsUpdate = true
    this.previous.needsUpdate = true
    this.uploaded = this.sim.step
  }

  private flatten(on: boolean): void {
    const show = this.diag === 'ids' || this.diag === 'standins'
    this.pointMaterial.uniforms.uFlat!.value = on && show ? 1 : 0
    this.glassMaterial.uniforms.uFlat!.value = on && show ? 1 : 0
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || mesh === this.glass) return
      if (on && show) {
        if (!this.lit.has(mesh)) this.lit.set(mesh, mesh.material)
        let f = this.flat.get(mesh)
        if (!f) {
          const part = mesh.userData.standIn as string | undefined
          const color = this.diag === 'standins' && !part ? new THREE.Color(0, 0, 0) : partColor(part ?? mesh.uuid)
          f = new THREE.MeshBasicMaterial({ color })
          this.flat.set(mesh, f)
        }
        mesh.material = f
      } else if (this.lit.has(mesh)) {
        mesh.material = this.lit.get(mesh)!
      }
    })
  }

  drawSample(target: THREE.WebGLRenderTarget, pose: Pose, sample: Sample | null, moment: Moment, shadows: boolean): void {
    const { renderer } = this.gfx
    const w = target.width
    const h = target.height
    const g = moment.globe
    this.globe.position.set(g.x, g.y, g.z)
    this.globe.rotation.set(g.tiltX, 0, g.tiltZ)
    this.globe.updateMatrixWorld(true)
    this.upload()
    applyPose(this.camera, pose, w, h, sample)
    const u = this.pointMaterial.uniforms
    u.uMix!.value = moment.mix
    u.uScale!.value = h / (2 * Math.tan((pose.fovDeg * Math.PI) / 360))
    u.uSeed!.value = moment.seed + (sample ? sample.index * 7.31 : 0)
    const flat = this.diag === 'ids' || this.diag === 'standins'
    const background = this.scene.background
    if (flat) this.scene.background = new THREE.Color(0, 0, 0)
    this.flatten(true)
    renderer.shadowMap.needsUpdate = shadows && !flat
    this.glass.visible = false
    this.interior.visible = true
    renderer.setRenderTarget(this.inner)
    renderer.render(this.scene, this.camera)
    this.interior.visible = flat
    this.glass.visible = true
    this.glassMaterial.uniforms.uInner!.value = this.inner.texture
    this.glass.getWorldPosition(this.glassMaterial.uniforms.uCentre!.value as THREE.Vector3)
    ;(this.glassMaterial.uniforms.uViewProj!.value as THREE.Matrix4).multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
    renderer.setRenderTarget(target)
    renderer.render(this.scene, this.camera)
    this.interior.visible = true
    this.flatten(false)
    this.scene.background = background
  }
}
