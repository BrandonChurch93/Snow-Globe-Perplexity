import type * as THREE from 'three'
import type { Rgb } from '../core/materials'
import type { SdfGrid } from '../core/stage'
import type { StageFrame } from '../scene/frame'

export type Vec3 = readonly [number, number, number]

export interface RoomLight {
  color: Rgb
  intensity: number
  from: Vec3
}

export interface InnerLight {
  at: Vec3
  color: Rgb
  power: number
  reachMm: number
  flicker: number
  cycles: number
  phase: number
}

export interface KitMoment {
  time: number
  period: number
  sinceLanding: number
  arrived: number
  beat: number | null
  seed: number
  frame: StageFrame
}

export interface SeasonKit {
  readonly season: string
  readonly main: Rgb
  prepare?(): Promise<void>
  base(): THREE.Object3D
  miniature(): THREE.Object3D
  arrival(): THREE.Object3D
  lights(): THREE.Object3D
  collider(): SdfGrid
  update?(moment: KitMoment): void
  dressing(): { glass: THREE.Object3D; surface: THREE.Object3D }
  readonly rig: { key: RoomLight; rim: RoomLight; sky: Rgb; ground: Rgb; fill: number; card?: { color: Rgb; intensity: number; from: Vec3; wrap: number; specular: number; inside: number } }
  readonly innerLights: readonly InnerLight[]
  /** `bankWhite`, when a season gives one, is how far the bank of its flood is turned from the tint toward white: 0 leaves it the tint, 1 is white, past 1 is the tint's opposite. A season that gives none has the shared veil's (`VEIL_LOOK.bankWhite`). */
  readonly veil: { tint: Rgb; density: number; rest: number; bankWhite?: number }
  /** `gain`, when a season gives one, scales each background light by where it stands (1 leaves it as placed). */
  readonly backdrop: { colors: readonly Rgb[]; room: Rgb; floor: Rgb; gain?: (at: Vec3) => number }
  readonly particles: Readonly<Record<string, { color: Rgb; glow: number }>>
}
