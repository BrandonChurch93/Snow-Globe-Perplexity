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
}

export interface Counts {
  triangles: number
  drawCalls: number
  particles: number
}

export interface Stage {
  readonly standIn: boolean
  parts(): { name: string; color: number }[]
  resize(width: number, height: number): void
  drawSample(target: THREE.WebGLRenderTarget, pose: Pose, sample: Sample | null, moment: Moment, shadows: boolean): void
  setDiagnostic(view: string): void
  particleCount(): number
  textureBytes(): number
}
