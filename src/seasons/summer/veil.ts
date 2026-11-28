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
export const veil: SeasonKit['veil'] = { tint: [1.7, 1.45, 1.1], density: 0.09, rest: -0.0007, bankWhite: 0.3 }
export const particles: SeasonKit['particles'] = { firefly: { color: [1, 0.97, 0.2], glow: 11 }, seed: { color: [1.3, 1.16, 0.9], glow: 0 }, mote: { color: [0.9, 0.62, 0.24], glow: 0.2 } }

// The storm outlasts the shake. The shared veil thins with the liquid's turbulence, which is spent by the time the globe is set
// down, so the air was clear on the landing frame. Summer holds its own storm from the swap through the set down and the
// landing, and lets it go smoothly after it: whole for `holdSeconds`, gone `fallSeconds` later, never in a step. While it holds,
// the veil is summer's own: `share` of the storm haze, `uneven` of it in the liquid's wisps so the dark shows between them, and
// `calms` of the shared drift bank taken off. That bank is winter's snow going to the wall; in summer it stood as a cream slab
// over the ground and a white crescent inside the left limb, where the approved image has seeds over a ghosted miniature.
// None of that bank is kept now (`calms` is 1): the bright haze low down is the held storm's own bank, below.
// All of it is weighted by summer's share of the change, so the other seasons see nothing of it.
// `white` is the haze of the held storm in the liquid itself, in folds (`fold` of it; the rest is even): it is thickest where the
// line of sight through the ball is longest, at its middle, so the tree and the cottage are washed and the lanterns bloom in it.
// `bank` is the haze of the held storm that lies over the miniature: below `level` (in radii, up from the middle) it is whole, and
// it thins over `soft` above that, so the cottage and the foot of the tree are ghosted and the upper dome keeps its dark gaps.
// It lies low and thin now, over the ground, the pond and the foot of the cottage, so the lower inside keeps its lights and its darks
// under the down. Its `density` is also the floor the take over's way was proved on: under about 0.005 a line of sight 100 mm deep
// opens by more than a sixth between two frames near the take over's end, and the take over's test says so.
export const STORM = { share: 0.2, holdSeconds: 0.3, fallSeconds: 3, uneven: 0.97, calms: 1, bank: { level: -0.4, soft: 0.25, density: 0.005, even: 0.7 }, white: 0.0003, fold: 0.75 }

const ramp = (v: number, from: number, to: number): number => {
  const t = Math.min(1, Math.max(0, (v - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** How much of the storm summer still holds at a moment, 0 to 1: a pure function of the beat, the time since the landing and the change. */
export function stormHeld(moment: KitMoment): number {
  const f = moment.frame
  const t = f.mix.veil
  // The held storm is summer's landing. Summer coming holds its share of the change; a shake of summer alone holds all of it;
  // summer leaving holds nothing, so the storm that hides the swap out of summer is the shared one, whole.
  const mine = f.to.veil === veil ? (f.from.veil === veil ? 1 : t) : 0
  const beat = moment.beat
  const since = moment.sinceLanding
  const w = config.shake.swapWindow
  const held = beat !== null ? ramp(beat, w.fromBeat, w.toBeat) : since >= 0 && since < Infinity ? 1 - ramp(since, STORM.holdSeconds, STORM.holdSeconds + STORM.fallSeconds) : 0
  return Math.min(1, mine) * held
}

/**
 * The take over: how the shared storm gives way to the held one where summer comes out of another season, while the globe is
 * still in the hand. The shared storm is whole to `fromFrames` frames of the film about the swap window's end (below zero:
 * before it), so the change stays under it, and the take over runs from there, past the window's end. What stands of the flood
 * at the take over's end before the last of it goes is `left` of it. A shake of summer alone has nothing to hide and no take
 * over: its held storm comes in over the whole window by `stormHeld`, as it always did.
 *
 * Its way is the flood's fall by ratio (`floodLeft`), and `way` is how far along that way each frame of the film stands, in
 * sixteenths of it; `frames` is the count of its steps. A haze's value and the picture's level are not in a line, and the
 * flood's own light falls by about a third between frames 1409 and 1413 of the film whatever the course. At an even pace, a
 * frame a sixteenth, the glass's mean level stood for six frames while nine tenths of the flood went, then fell by 5.3, 8.0,
 * 8.7, 8.5 and 6.5 levels on five frames running (shake 2 of the film at draft and hd on main b4bc96c0, frames 1408 to 1412,
 * by the change's ruler: the mean luma of the 8 bit frame over 0.85 of the ball's disc, the change's cover off). That is a
 * step the eye reads as a cut, since the room about the globe stands still. So the course is bent to the picture: the level was read on that
 * course and on two bent ones, and the way set so it falls by 2.8 to 4.0 a frame on thirteen frames running, 1407 to 1419
 * (3.96 at the most, as drawn). The first six frames keep the even pace: the thinnest lines of sight open in them a seventh
 * between two frames as it is, and the change is under them. Then the course all but stands for five frames, one sixteenth
 * in all, while the flood's own light falls and does the work. The last four go fast again, from 10.57 to 16: the shared
 * storm opens by itself from `openFromBeats` to `openToBeats` of the shared veil, and the take over has to stay under it
 * and be over before it, or the bank would dip under the held storm's and rise again. It is over at frame 1421, eighteen
 * frames before the shake's end. The way was bent on the held storm as it stood on that main: when the held storm's look
 * changes, the table is read again.
 */
const WAY = [0, 1, 2, 3, 4, 5, 6, 6.77, 7.14, 7.4, 7.53, 7.55, 7.8, 8.39, 8.98, 9.88, 10.57, 11.3, 12.5, 14.9, 16] as const
export const TAKE = { fromFrames: -3, way: WAY, frames: WAY.length - 1, left: 0.002 }

const FRAMES_A_BEAT = (60 * config.film.fps) / config.film.defaultBpm

/** Whether summer comes out of another season at a moment. After the window's end the season that has come stands alone, and the moment names the one it left. */
export function comesOfAnother(moment: KitMoment): boolean {
  const f = moment.frame
  return moment.beat !== null && f.to.veil === veil && (f.from.veil !== veil || (f.moment?.left ?? null) !== null)
}

/** How far the take over has run at a moment, 0 to 1: `way` at the frames of the film, in a line between two of them. A pure function of the beat. Nothing where there is none. */
export function takePace(moment: KitMoment): number {
  if (moment.beat === null || !comesOfAnother(moment)) return 0
  const from = config.shake.swapWindow.toBeat + TAKE.fromFrames / FRAMES_A_BEAT
  const run = (moment.beat - from) * FRAMES_A_BEAT
  if (!(run > 1e-9)) return 0
  if (run >= TAKE.frames - 1e-9) return 1
  const i = Math.floor(run)
  const whole = TAKE.way[TAKE.frames]!
  return (TAKE.way[i]! + (TAKE.way[i + 1]! - TAKE.way[i]!) * (run - i)) / whole
}

/**
 * Decision 222, the see through at the landing: the storm's look has a course of its own in time. While the take over runs the
 * down is the storm at its full, dense, as the take over was proved on it. From the take over's end to the landing it goes over
 * to the look of the landing (looks.ts, `STORM_LANDING`), so the cottage, the lanterns and the tree are seen through the down when
 * the globe is set down. The course runs on the shake's own beat, the clock the take over runs on, so the page and the film do
 * the same thing; it eases in and out, with no corner at the take over's end and none at the landing. A shake of summer alone
 * runs the same course on the same beats.
 *
 * After the landing the look of the landing stands for as long as a storm does: whole to `settled[0]` seconds after it, and back
 * at the storm's full numbers by `settled[1]`, when the liquid is calm and no stroke of the storm is drawn that could show the
 * way back (read on the film after the landing of shake 2, frame 1440: the liquid's turbulence falls under the level where the
 * draw's storm ends, looks.ts `LENS_LOOK.stormFrom`, 5.6 s after the landing, and the draw's storm is nothing from there). So the
 * rest state reads the storm's full numbers, a shake out of summer at rest starts dense, as it did, and the swap out of summer
 * is hidden as it was. A shake that starts sooner carries the look of the landing in and eases it out over its first `carryBeats`.
 */
export const LANDING_LOOK = { settled: [6.5, 9] as const, carryBeats: 1 }

/** The beat of a shake at which the take over is over: frame 1421 of the film, where shake 2 runs from frame 1296. */
export const TAKE_END_BEAT = config.shake.swapWindow.toBeat + (TAKE.fromFrames + TAKE.frames) / FRAMES_A_BEAT
/** The beat of a shake at which the globe lands. */
export const LANDING_BEAT = config.shake.liftBeats + config.shake.strokeBeats + config.shake.setDownBeats

/** How far the storm's look has gone over to the look of the landing at a moment, 0 to 1: a pure function of the beat, the time since the landing and the seasons of the moment. */
export function landingLook(f: { moment: { beat: number | null; sinceLanding: number }; from: { veil: unknown }; to: { veil: unknown } }): number {
  const beat = f.moment.beat
  const since = f.moment.sinceLanding
  const stands = since >= 0 && since < Infinity ? 1 - ramp(since, LANDING_LOOK.settled[0], LANDING_LOOK.settled[1]) : 0
  if (beat === null) return f.to.veil === veil ? stands : 0
  const carried = f.from.veil === veil ? stands * (1 - ramp(beat, 0, LANDING_LOOK.carryBeats)) : 0
  const eased = f.to.veil === veil ? ramp(beat, TAKE_END_BEAT, LANDING_BEAT) : 0
  return Math.max(carried, eased)
}

/**
 * The share of the flood that still stands when the take over has run `pace` of its way: all of it at 0, none at 1, and between
 * them less by one and the same share of itself on every equal step of the way. A haze thins by ratio. Taken over by sum, the bank stood whole
 * until the last frames of the swap window and went tenfold in two of them: what stands 60 mm deep in it was 4, 30 and 70
 * hundredths seen on three frames running, and the tree came out of the fog in a step. By ratio every line of sight opens at one
 * pace when its turn comes, the thin ones first (the dome, the crown) and the deepest last (the bank over the cottage), and none
 * by more than a sixth of itself between two frames.
 */
export const floodLeft = (pace: number): number => (Math.pow(TAKE.left, pace) - TAKE.left) / (1 - TAKE.left)

/**
 * A haze of the shared storm on its way to the held storm's. `most` is that haze at the fullest flood, and the take over's own
 * course runs from it: the held storm's haze and what is left of the flood. The shared storm thins by itself once the window is
 * past, and a share of its value of the moment would thin twice over; so the haze is the take over's own course, and never more
 * than the shared storm has. Where the shared haze is the thinner (a light shake) it rises to the held storm's by sum.
 */
const taken = (shared: number, held: number, most: number, pace: number): number => (shared <= held ? shared + (held - shared) * pace : Math.min(shared, held + (Math.max(most, shared) - held) * floodLeft(pace)))

/** Turns the shared veil to summer's held storm. Runs after the shared veil has set its own values for the frame. */
export function holdStorm(moment: KitMoment): number {
  const kept = stormHeld(moment)
  // Out of another season the held storm comes by the take over. In a shake of summer alone it comes, and after every landing
  // it goes, by the share that is kept and by sum, as it did.
  const taking = comesOfAnother(moment)
  const held = taking ? takePace(moment) : kept
  const u = veilUniforms
  const storm = veil.density * VEIL_LOOK.haze * STORM.share * held
  const density = veil.rest + veil.density * VEIL_LOOK.haze * STORM.share
  if (held > 0 && density > 0) {
    u.uVeilUp.value.w += (Math.min(STORM.uneven, storm / density) - u.uVeilUp.value.w) * held
    const roll = u.uVeilRoll.value
    const bank = u.uVeilBank.value
    roll.w += (STORM.fold - roll.w) * held
    if (taking) {
      u.uVeil.value.w = taken(u.uVeil.value.w, density, veil.rest + veil.density * VEIL_LOOK.haze, held)
      u.uVeilDrift.value.x *= 1 - STORM.calms * (1 - floodLeft(held))
      roll.z = taken(roll.z, STORM.white, veil.density * VEIL_LOOK.white, held)
      bank.set(bank.x + (STORM.bank.level - bank.x) * held, bank.y + (STORM.bank.soft - bank.y) * held, taken(bank.z, STORM.bank.density, veil.density * VEIL_LOOK.bank * VEIL_LOOK.bankFloodGain, held), bank.w + (STORM.bank.even - bank.w) * held)
    } else {
      u.uVeil.value.w += (density - u.uVeil.value.w) * held
      u.uVeilDrift.value.x *= 1 - STORM.calms * held
      roll.z += (STORM.white - roll.z) * held
      bank.set(bank.x + (STORM.bank.level - bank.x) * held, bank.y + (STORM.bank.soft - bank.y) * held, bank.z + (STORM.bank.density - bank.z) * held, bank.w + (STORM.bank.even - bank.w) * held)
    }
  }
  // `rest` is below zero: it takes back the share of haze the shared veil keeps while the pool is afloat. Where the shared haze is
  // thinner than that share (seeds that lie count as landed, and the kept share falls with them), the sum went below zero. A veil
  // below zero takes light away, and the drift bank's share of the whole haze, bank over thin and bank, then leaves 0 to 1 and
  // carries the bank's whitening far past white: pure yellow where the sum is below zero and blue where it is just above.
  // The sum stops at zero.
  if (u.uVeil.value.w < 0) u.uVeil.value.w = 0
  return kept
}
