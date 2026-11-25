import type { SdfGrid } from '../src/core/stage'
import { buildSdf, GROUND_Y, type Emitter, type Shape } from '../src/particles/engine/sdf'

// A test fixture, not a part of the picture: a box, a cone and a ball on the ground for the engine's tests to collide with, and places for its emitted kinds to be born.
export const blockoutShapes = (): Shape[] => [
  { kind: 'ground', y: GROUND_Y },
  { kind: 'box', cx: -15, cy: GROUND_Y + 10, cz: 2, hx: 12, hy: 10, hz: 10 },
  { kind: 'cone', cx: 17, baseY: GROUND_Y, cz: -3, r: 13, h: 44 },
  { kind: 'ball', cx: 3, cy: GROUND_Y + 5, cz: 22, r: 5 },
]

export const blockoutEmitters = (): Record<string, Emitter[]> => ({
  petal: [{ x: 17, y: GROUND_Y + 40, z: -3, r: 16 }],
  leaf: [{ x: 17, y: GROUND_Y + 40, z: -3, r: 16 }],
  ember: [
    { x: 3, y: GROUND_Y + 12, z: 22, r: 2.5 },
    { x: -15, y: GROUND_Y + 22, z: 2, r: 4 },
    { x: -2, y: GROUND_Y + 3, z: -18, r: 5 },
  ],
})

let grid: SdfGrid | null = null
export const blockoutSdf = (): SdfGrid => (grid ??= buildSdf(blockoutShapes()))
