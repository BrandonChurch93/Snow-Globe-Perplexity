import * as THREE from 'three'
import { NUMBER_GLSL } from './chunks/number'

const VERT = `in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

export class Pass {
  readonly material: THREE.RawShaderMaterial
  private readonly scene = new THREE.Scene()
  constructor(fragment: string, uniforms: Record<string, THREE.IUniform>) {
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: `precision highp float;\nprecision highp int;\nprecision highp sampler2D;\n${NUMBER_GLSL}${fragment}`,
      uniforms,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    })
    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }
  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null): void {
    renderer.setRenderTarget(target)
    renderer.render(this.scene, camera)
  }
  dispose(): void {
    this.material.dispose()
  }
}
