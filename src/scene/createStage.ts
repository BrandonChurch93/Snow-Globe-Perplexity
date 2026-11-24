import type { Assets } from '../core/assets'
import type { Gfx } from '../core/gl'
import type { ParticleSource, Stage } from '../core/stage'
import { GlobeStage } from './stage'

export function createStage(gfx: Gfx, particles: ParticleSource, assets: Assets): Stage {
  return new GlobeStage(gfx, particles, assets)
}
