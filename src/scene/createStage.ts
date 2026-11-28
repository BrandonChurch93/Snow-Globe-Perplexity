import type { Assets } from '../core/assets'
import type { Gfx } from '../core/gl'
import type { ParticleSource, Stage } from '../core/stage'
import { GlobeStage } from './stage'

/**
 * The order in which a page that captures makes the seasons' sets, whichever season's files come first. three.js numbers
 * every object and every material as it is made, and it draws two solid things that nothing else parts in the order of
 * those numbers. The sets were made as their files came, so a load of the page on which fall's came before winter's drew
 * solid things of the two seasons the other way round, and film frame 2828 had one other pixel. Made in this order the
 * frame has the bytes of the list.
 */
export const MADE_ORDER: readonly string[] = ['winter', 'spring', 'fall', 'summer']

/** `order` is for the page that captures: the order in which its sets are made. A page that paints gives none, and makes each set when its files have come. */
export function createStage(gfx: Gfx, particles: ParticleSource, assets: Assets, order: readonly string[] | null = null): Stage {
  return new GlobeStage(gfx, particles, assets, order)
}
