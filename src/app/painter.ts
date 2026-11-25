import * as THREE from 'three'
import { liveSamples } from '../core/accumulator'
import type { Gfx } from '../core/gl'
import type { Moment, Stage } from '../core/stage'
import { Post } from '../post/post'
import type { Pose } from '../scene/cameras'

export class Painter {
  private target: THREE.WebGLRenderTarget | null = null
  private readonly post: Post
  flat = false

  constructor(private readonly gfx: Gfx, private readonly stage: Stage) {
    this.post = new Post(gfx)
  }

  get width(): number {
    return this.target?.width ?? 0
  }
  get height(): number {
    return this.target?.height ?? 0
  }

  size(width: number, height: number): boolean {
    const w = Math.max(2, Math.round(width))
    const h = Math.max(2, Math.round(height))
    if (this.target && this.target.width === w && this.target.height === h) return false
    this.gfx.renderer.setSize(w, h, false)
    this.target?.dispose()
    this.target = new THREE.WebGLRenderTarget(w, h, {
      type: this.gfx.caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      samples: liveSamples(this.gfx.caps.maxSamples),
    })
    this.stage.resize(w, h)
    return true
  }

  paint(pose: Pose, moment: Moment): void {
    if (!this.target) return
    this.stage.drawSample(this.target, pose, null, moment, true)
    this.post.seed = (moment.seed * 0.37) % 1
    this.post.resolve(this.target.texture, this.flat)
  }
}
