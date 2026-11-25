import { config } from '../../config'
import { VEIL_LOOK, veilUniforms } from '../../core/chunks/veil'
import type { KitMoment, SeasonKit } from '../kit'

// Part `veil-summer` and the colours of the season's particle kinds. The veil is a golden haze: thick and honey coloured in the
// storm, and at rest only the faint warmth of dusty air in low sun. The fireflies are yellow-green lights, far brighter than
// anything they pass; the seeds are the cream white of dandelion down and take the light they hang in; the motes are fine gold
// dust, dim enough that tens of thousands of them read as air and never as snow.
export const standIns: string[] = []

// The shared veil keeps a fifth of its storm haze for as long as most of the pool is afloat, and summer's motes never land:
// `rest` takes most of that share back, so the storm can be thick and the air at rest stays clear (0.04 x 0.2 x density is the share).
export const veil: SeasonKit['veil'] = { tint: [1.2, 1, 0.74], density: 0.09, rest: -0.00068 }
export const particles: SeasonKit['particles'] = { firefly: { color: [0.95, 1, 0.3], glow: 4 }, seed: { color: [1.8, 1.66, 1.4], glow: 0 }, mote: { color: [1.25, 1, 0.66], glow: 0.5 } }

// The storm outlasts the shake. The shared veil thins with the liquid's turbulence, which is spent by the time the globe is set
// down, so the air was clear on the landing frame. Summer holds its own storm density from the swap through the set down and
// the landing, and lets it go smoothly after it: whole for `holdSeconds`, gone `fallSeconds` later, never in a step. It only ever
// thickens what the shared veil holds, and only by summer's share of the change, so the other seasons see nothing of it.
export const STORM = { share: 1, holdSeconds: 0.3, fallSeconds: 3 }

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

/** Thickens the shared veil to summer's held storm. Runs after the shared veil has set its own density for the frame. */
export function holdStorm(moment: KitMoment): number {
  const held = stormHeld(moment)
  const u = veilUniforms
  const storm = veil.density * VEIL_LOOK.haze * STORM.share * held
  const density = veil.rest * held + storm
  if (density > u.uVeil.value.w) {
    u.uVeil.value.w = density
    u.uVeilUp.value.w = Math.min(VEIL_LOOK.uneven, storm / density)
  }
  return held
}
