import * as THREE from 'three'
import type { Gfx } from './gl'
import { Pass } from './fullscreen'

const MEAN = `uniform sampler2D uMean;
uniform sampler2D uSample;
uniform float uWeight;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uSample, p, 0);
  if (uWeight >= 1.0) { o = s; return; }
  vec4 m = texelFetch(uMean, p, 0);
  o = m + (s - m) * uWeight;
}`

export class Accumulator {
  readonly sample: THREE.WebGLRenderTarget
  private readonly mean: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  private readonly pass: Pass
  private flip = 0
  count = 0
  readonly precision: 'float32' | 'half' | 'byte'

  constructor(private readonly gfx: Gfx, width: number, height: number, msaa = 0) {
    const { caps } = gfx
    this.precision = caps.float32 ? 'float32' : caps.half ? 'half' : 'byte'
    const sampleType = caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType
    const meanType = caps.float32 ? THREE.FloatType : sampleType
    this.sample = new THREE.WebGLRenderTarget(width, height, {
      type: sampleType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: msaa,
      generateMipmaps: false,
    })
    const mk = () =>
      new THREE.WebGLRenderTarget(width, height, {
        type: meanType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      })
    this.mean = [mk(), mk()]
    this.pass = new Pass(MEAN, { uMean: { value: null }, uSample: { value: null }, uWeight: { value: 1 } })
  }

  get width(): number {
    return this.sample.width
  }
  get height(): number {
    return this.sample.height
  }

  begin(): void {
    this.count = 0
  }

  add(): void {
    const from = this.mean[this.flip]
    const to = this.mean[1 - this.flip]
    const u = this.pass.material.uniforms
    u.uMean.value = from.texture
    u.uSample.value = this.sample.texture
    u.uWeight.value = 1 / (this.count + 1)
    this.pass.render(this.gfx.renderer, to)
    this.flip = 1 - this.flip
    this.count++
  }

  get result(): THREE.Texture {
    return this.mean[this.flip].texture
  }

  dispose(): void {
    this.sample.dispose()
    this.mean[0].dispose()
    this.mean[1].dispose()
    this.pass.dispose()
  }
}
