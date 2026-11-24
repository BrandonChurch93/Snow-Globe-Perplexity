import type { Gfx } from '../core/gl'
import type { ParticleSource, Stage } from '../core/stage'
import { GlobeStage } from './stage'

export function createStage(gfx: Gfx, particles: ParticleSource, _width: number, _height: number): Stage {
  return new GlobeStage(gfx, particles)
}
