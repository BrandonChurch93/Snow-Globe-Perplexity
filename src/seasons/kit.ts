import type * as THREE from 'three'
import type { Rgb } from '../core/materials'
import type { SdfGrid } from '../core/stage'

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
}

export interface Dressing {
  tint: Rgb
  amount: number
  map?: THREE.Texture | null
}

export interface SeasonKit {
  readonly season: string
  readonly main: Rgb
  prepare?(): Promise<void>
  base(): THREE.Object3D
  miniature(): THREE.Object3D
  arrival(): THREE.Object3D
  lights(): THREE.Object3D
  collider?(): SdfGrid
  update?(moment: KitMoment): void
  readonly glassDressing: Dressing
  readonly surfaceDressing: Dressing & { reachMm: number }
  readonly rig: { key: RoomLight; rim: RoomLight; sky: Rgb; ground: Rgb; fill: number }
  readonly innerLights: readonly InnerLight[]
  readonly veil: { tint: Rgb; density: number; rest: number }
  readonly backdrop: { colors: readonly Rgb[]; room: Rgb; floor: Rgb }
  readonly particles: Readonly<Record<string, { color: Rgb; glow: number }>>
}
