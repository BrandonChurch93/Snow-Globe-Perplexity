import type * as THREE from 'three'
import type { Sample } from './sampler'
import type { Pose } from '../scene/cameras'
import type { GlobePose } from '../shake/table'

export interface Moment {
  season: string
  from: string
  to: string
  change: number
  sinceLanding: number
  globe: GlobePose
  mix: number
  seed: number
  time: number
  beat: number | null
  period: number | null
}

export interface Counts {
  triangles: number
  drawCalls: number
  particles: number
}

export interface SdfGrid {
  n: number
  sizeMm: number
  data: Float32Array
}

export interface ParticleSource {
  readonly count: number
  readonly step: number
  readonly pos: Float32Array
  readonly prev: Float32Array
  readonly sizes: Float32Array
  readonly kindOf: Uint8Array
  readonly kinds: readonly string[]
  readonly state: Uint8Array
  readonly liquid: Float64Array
  readonly opacity?: Float32Array
  readonly phase?: Float32Array
}

export interface Emitter {
  x: number
  y: number
  z: number
  r: number
}

export interface StageQuality {
  particleFraction: number
  shadowMapPx: number
  surfaceReflection: string
}

export interface Stage {
  readonly standIn: boolean
  parts(): { name: string; color: number }[]
  resize(width: number, height: number): void
  drawSample(target: THREE.WebGLRenderTarget, pose: Pose, sample: Sample | null, moment: Moment, shadows: boolean): void
  setDiagnostic(view: string): void
  setQuality?(level: StageQuality): void
  collider?(season: string): SdfGrid
  emitters?(season: string): Record<string, Emitter[]>
  particleCount(): number
  textureBytes(): number
}
