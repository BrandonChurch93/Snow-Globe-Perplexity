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
  /**
   * The season a change has just left: its name from the end of the swap window to the landing of the shake that made the change, and
   * null everywhere else (at rest, before the end of the window, through a shake that keeps its season, through the preroll). After
   * the window `from` and `to` are both the season that has come, so without this a stage could not tell the frames after a change
   * from a shake that changed nothing; the cover of a change dies away over those frames (src/shake/change.ts, `CHANGE_COVER`).
   */
  left?: string | null
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
  readonly cover?: { readonly n: number; readonly spanMm: number; readonly mm: Float32Array }
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
  parts(): { name: string; color: number }[]
  resize(width: number, height: number): void
  drawSample(target: THREE.WebGLRenderTarget, pose: Pose, sample: Sample | null, moment: Moment, shadows: boolean): void
  setDiagnostic(view: string): void
  /** Off for the one still that is a measuring aid: the same picture with no particle and no haze in it. Never off in a picture that is judged. */
  setAir?(on: boolean): void
  setQuality?(level: StageQuality): void
  prepare?(season: string): Promise<void>
  /** A shake has been asked that goes into `season`: until it has landed, nothing is made ready for any other season. Gives what the shake waits for where the season is built and not yet in the GPU's hands. */
  expect?(season: string): Promise<void> | void
  /** Whether the page worked on the season last asked for with `expect` in the time the frame drawn last took to come. It gave that time up itself: the frame says nothing of the machine's pace. Only a stage that has been pressed has this. */
  awaited?(): boolean
  /** Resolves when every season asked for so far is ready down to the GPU, so that the first frame of it makes nothing. */
  settled?(): Promise<void>
  /** The card is gone (src/app/lost.ts): from here on nothing is made and nothing is handed to it. */
  stop?(): void
  collider(season: string): SdfGrid
  emitters(season: string): Record<string, Emitter[]>
  particleCount(): number
  textureBytes(): number
}
