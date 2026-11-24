import type { Gfx } from '../core/gl'
import type { ParticleSource, Stage } from '../core/stage'
import { SpikeStage } from './spike'

export function createStage(gfx: Gfx, particles: ParticleSource, width: number, height: number): Stage {
  return new SpikeStage(gfx, particles, width, height)
}
