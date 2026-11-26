import { config } from '../../config'
import { VEIL_LOOK, veilUniforms } from '../../core/chunks/veil'
import type { KitMoment, SeasonKit } from '../kit'

// Part `veil-summer` and the colours of the season's particle kinds. The veil is a golden haze: thick and honey coloured in the
// storm, and at rest only the faint warmth of dusty air in low sun. The fireflies are yellow-green lights, far brighter than
// anything they pass; the seeds are dandelion down lit from behind by the low sun, warm and never white; the motes are fine gold
// dust, dim enough that tens of thousands of them read as air and never as snow.

// The shared veil keeps a fifth of its storm haze for as long as most of the pool is afloat, and summer's motes never land:
// `rest` takes nearly all of that share back (0.04 x 0.2 x density is the share). The shared haze fogs what stands in the liquid
// as well as what lies behind it, and it cost the miniature a quarter of its fine detail at rest; the warm air behind the
// miniature is the wall layer's haze in `glass.ts`, which is drawn behind the cottage and the tree.
export const veil: SeasonKit['veil'] = { tint: [1.24, 0.98, 0.76], density: 0.09, rest: -0.0007 }
export const particles: SeasonKit['particles'] = { firefly: { color: [0.93, 1, 0.27], glow: 8 }, seed: { color: [1.5, 1.2, 0.72], glow: 0 }, mote: { color: [1.3, 1.08, 0.5], glow: 0.5 } }

// The storm outlasts the shake. The shared veil thins with the liquid's turbulence, which is spent by the time the globe is set
// down, so the air was clear on the landing frame. Summer holds its own storm from the swap through the set down and the
// landing, and lets it go smoothly after it: whole for `holdSeconds`, gone `fallSeconds` later, never in a step. While it holds,
// the veil is summer's own: `share` of the storm haze, `uneven` of it in the liquid's wisps so the dark shows between them, and
// `calms` of the shared drift bank taken off. That bank is winter's snow going to the wall; in summer it stood as a cream slab
// over the ground and a white crescent inside the left limb, where the approved image has seeds over a ghosted miniature.
// All of it is weighted by summer's share of the change, so the other seasons see nothing of it.
export const STORM = { share: 1.3, holdSeconds: 0.3, fallSeconds: 3, uneven: 0.8, calms: 0.97 }

const ramp = (v: number, from: number, to: number): number => {
  const t = Math.min(1, Math.max(0, (v - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** How much of the storm summer still holds at a moment, 0 to 1: a pure function of the beat, the time since the landing and the change. */
export function stormHeld(moment: KitMoment): number {
  const f = moment.frame
  const t = f.mix.veil
  const mine = (f.to.veil === veil ? t : 0) + (f.from.veil === veil ? 1 - t : 0)
  const beat = moment.beat
  const since = moment.sinceLanding
  const w = config.shake.swapWindow
  const held = beat !== null ? ramp(beat, w.fromBeat, w.toBeat) : since >= 0 && since < Infinity ? 1 - ramp(since, STORM.holdSeconds, STORM.holdSeconds + STORM.fallSeconds) : 0
  return Math.min(1, mine) * held
}

/** Turns the shared veil to summer's held storm. Runs after the shared veil has set its own values for the frame. */
export function holdStorm(moment: KitMoment): number {
  const held = stormHeld(moment)
  const u = veilUniforms
  const storm = veil.density * VEIL_LOOK.haze * STORM.share * held
  const density = veil.rest + veil.density * VEIL_LOOK.haze * STORM.share
  if (held > 0 && density > 0) {
    u.uVeilUp.value.w += (Math.min(STORM.uneven, storm / density) - u.uVeilUp.value.w) * held
    u.uVeil.value.w += (density - u.uVeil.value.w) * held
    u.uVeilDrift.value.x *= 1 - STORM.calms * held
  }
  return held
}
