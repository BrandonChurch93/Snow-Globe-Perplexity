import { config } from '../../config'
import { VEIL_LOOK, veilUniforms } from '../../core/chunks/veil'
import type { KitMoment, SeasonKit } from '../kit'

// Part `veil-summer` and the colours of the season's particle kinds. The veil is a golden haze: a warm gold in the
// storm, thin enough that the cottage's front and its lamps read through it, and at rest only the faint warmth of dusty air in low sun. The fireflies are yellow-green lights, far brighter than
// anything they pass; the seeds are dandelion down lit from behind by the low sun, a warm white as the approved down is, never
// a pure white; the motes are single warm glints of dust, a few hundred in sight, and never a field of
// dots that sums to a veil.

// The shared veil keeps a fifth of its storm haze for as long as most of the pool is afloat, and summer's motes never land:
// `rest` takes nearly all of that share back (0.04 x 0.2 x density is the share). The shared haze fogs what stands in the liquid
// as well as what lies behind it, and it cost the miniature a quarter of its fine detail at rest; the warm air behind the
// miniature is the wall layer's haze in `glass.ts`, which is drawn behind the cottage and the tree.
export const veil: SeasonKit['veil'] = { tint: [1.75, 1.4, 0.86], density: 0.09, rest: -0.0007 }
export const particles: SeasonKit['particles'] = { firefly: { color: [1, 0.97, 0.2], glow: 11 }, seed: { color: [1.3, 1.16, 0.9], glow: 0 }, mote: { color: [0.9, 0.62, 0.24], glow: 0.2 } }

// The storm outlasts the shake. The shared veil thins with the liquid's turbulence, which is spent by the time the globe is set
// down, so the air was clear on the landing frame. Summer holds its own storm from the swap through the set down and the
// landing, and lets it go smoothly after it: whole for `holdSeconds`, gone `fallSeconds` later, never in a step. While it holds,
// the veil is summer's own: `share` of the storm haze, `uneven` of it in the liquid's wisps so the dark shows between them, and
// `calms` of the shared drift bank taken off. That bank is winter's snow going to the wall; in summer it stood as a cream slab
// over the ground and a white crescent inside the left limb, where the approved image has seeds over a ghosted miniature.
// A share of that bank is kept: it is the bright haze low down that whitens the ground and the foot of the tree.
// All of it is weighted by summer's share of the change, so the other seasons see nothing of it.
// `white` is the haze of the held storm in the liquid itself, in folds (`fold` of it; the rest is even): it is thickest where the
// line of sight through the ball is longest, at its middle, so the tree and the cottage are washed and the lanterns bloom in it.
// `bank` is the haze of the held storm that lies over the miniature: below `level` (in radii, up from the middle) it is whole, and
// it thins over `soft` above that, so the cottage and the foot of the tree are ghosted and the upper dome keeps its dark gaps.
export const STORM = { share: 0.24, holdSeconds: 0.3, fallSeconds: 3, uneven: 0.97, calms: 0.9, bank: { level: -0.17, soft: 0.25, density: 0.006, even: 0.7 }, white: 0.0004, fold: 0.9 }

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
    const roll = u.uVeilRoll.value
    roll.z += (STORM.white - roll.z) * held
    roll.w += (STORM.fold - roll.w) * held
    const bank = u.uVeilBank.value
    bank.set(bank.x + (STORM.bank.level - bank.x) * held, bank.y + (STORM.bank.soft - bank.y) * held, bank.z + (STORM.bank.density - bank.z) * held, bank.w + (STORM.bank.even - bank.w) * held)
  }
  // `rest` is below zero: it takes back the share of haze the shared veil keeps while the pool is afloat. Where the shared haze is
  // thinner than that share (seeds that lie count as landed, and the kept share falls with them), the sum went below zero. A veil
  // below zero takes light away, and the drift bank's share of the whole haze, bank over thin and bank, then leaves 0 to 1 and
  // carries the bank's whitening far past white: pure yellow where the sum is below zero and blue where it is just above.
  // The sum stops at zero.
  if (u.uVeil.value.w < 0) u.uVeil.value.w = 0
  return held
}
