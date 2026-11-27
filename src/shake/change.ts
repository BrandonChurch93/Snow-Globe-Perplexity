import { config } from '../config'

export const SEASONAL_PARTS = ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'particles'] as const

export interface ChangeSpan {
  from: number
  to: number
  lag: number
}

const WINDOW_FRAMES = ((config.shake.swapWindow.toBeat - config.shake.swapWindow.fromBeat) * 60 * config.film.fps) / config.film.defaultBpm
const frames = (n: number): number => n / WINDOW_FRAMES

const SHUTTER = config.film.shutterDegrees / 360
/** How far the change number goes while the film's shutter is open. */
const SHUTTER_CHANGE = frames(SHUTTER)

/**
 * What is outside the glass and stands (the base, the slab, the lights of the backdrop, the light of the room) changes in one
 * span of the window, three frames long, in the middle of the last and fastest stroke: table.ts puts the middle of that
 * stroke on the middle of this span. What lies on the table leaves before it and comes after it, as motion
 * (`DRESSING_CHANGE`), and what is on the glass goes and comes with the cover (materials.ts, `GLASS_LEAVE`). A shake of one
 * season changes nothing outside the glass; what it sheds, and the swell of the light inside in every shake, keep the wider
 * span about the same middle (`shed`).
 */
const SHED: ChangeSpan = { from: 0.69, to: 0.85, lag: 0 }
const OUTSIDE_MID = (SHED.from + SHED.to) / 2
const OUTSIDE: ChangeSpan = { from: OUTSIDE_MID - frames(1.5), to: OUTSIDE_MID + frames(1.5), lag: 0 }

/**
 * The base alone takes six frames about the same middle. Under the cover both bases stand in the light the glass pours on
 * them (lighting.ts, `CHANGE_BLOOM`): lip and shoulder near white, the flank dim and in its own colour. Swapped in one frame
 * the shape and the stuff of the base step, and the eye reads that at sixty frames a second even under a bright rim. So the
 * old base gives way to the new over these frames, at every tier and on the page, as a share of each pixel's samples or of
 * the pixels themselves (materials.ts, `passShare`).
 */
export const BASE_PASS = { from: OUTSIDE_MID - frames(3), to: OUTSIDE_MID + frames(3) } as const

/**
 * The cover of that span, as places in the swap window: the glass burns from inside and what the room lights falls away
 * from it, as a camera's exposure does when a lamp flares in the dark, while the light of the glass pours out on the table
 * and the base and keeps the room there (lighting.ts, `CHANGE_BLOOM`). The glass stays in sight, so what is
 * on it goes as the cover rises and comes as it begins to fall (materials.ts, `GLASS_LEAVE` and `GLASS_COME`, which ends at
 * `goneAt`). It is whole from `fullFrom` to `fullTo`: on every exposure of the film that opens or closes inside the span, and
 * a quarter of a frame past each, so that a live picture taken on any instant of the span is under it as well. It rises from
 * `riseFrom` over twelve frames, and from `fullTo` it dies away as a tail of eighteen frames that ends at `tailTo`, past the
 * end of the window: up fast, then a fall that eases out, so that no frame of it is a step and the last of it does not blink
 * off. Twelve frames and not ten: the glass that stands lowest before its cover is spring's storm, 47 levels of 255 under the
 * whole cover's, and what that storm itself gains in those frames (two levels a frame and more) comes on top of what the
 * cover brings it. Drawn with the pace of the rise eased over a fifth of it at each end, and read on the film's frames with
 * the cover and with the cover held off, the cover brought that glass 5.7 levels in its steepest frame and the two
 * together 6.5. So the ease is a tenth (`RISE_EASE`), which takes a ninth off the pace of the middle, and ten frames would
 * put a fifth on it.
 */
const COVER_ROOM = frames(SHUTTER + 0.25)
const COVER_RISE = frames(12)
const COVER_FALL = frames(5.5)
const COVER_TAIL = frames(18)
export const CHANGE_COVER = {
  riseFrom: OUTSIDE.from - COVER_ROOM - COVER_RISE,
  fullFrom: OUTSIDE.from - COVER_ROOM,
  fullTo: OUTSIDE.to + COVER_ROOM,
  goneAt: OUTSIDE.to + COVER_ROOM + COVER_FALL,
  tailTo: OUTSIDE.to + COVER_ROOM + COVER_TAIL,
} as const

/**
 * What lies on the table, as places in the swap window. It is not swapped under the cover. Swapped there, in the span's three
 * frames, the petals lay lit round the foot on one frame and were gone on the next, and the first clear view had a table
 * that something had been taken from: a cut, however well the base was covered. So it leaves and comes as motion the eye
 * can follow. The old season's dressing leaves over the six frames before the base begins to pass (`leaveFrom` to
 * `leaveTo`; `liftFrom` is the first instant anything on the table moves), as the cover rises: from the foot outward, blown
 * out along the table by the light that bursts from the glass and thinned into its pool (materials.ts, `GUST`). The table
 * is bare while the base passes, and so while the cover is whole. The new season's comes when the base has passed, from the
 * far places in to the foot, over the first frames of the cover's tail (`comeFrom` to `comeTo`, which is the cover's
 * `goneAt`, inside the window), and its last pieces come down in the pool as the light dies. No instant holds the dressing
 * of two seasons, and none holds a dressing while anything else outside the glass is between two.
 */
const DRESSING_LEAVE = frames(6)
export const DRESSING_CHANGE = {
  liftFrom: BASE_PASS.from - DRESSING_LEAVE,
  leaveFrom: BASE_PASS.from - DRESSING_LEAVE,
  leaveTo: BASE_PASS.from,
  comeFrom: BASE_PASS.to,
  comeTo: CHANGE_COVER.goneAt,
} as const

/**
 * Every part outside the glass that stands reads the one span, and the dressing of the table is told by it as well (which
 * season's it is). The heaps of the slab (`surface-leave`, `surface-come`) sink with the old dressing as it leaves and rise
 * with the new as it comes (`DRESSING_CHANGE`). A shake of one season reads `shed` and none of the others.
 */
const SPANS: Record<string, ChangeSpan> = {
  miniature: { from: 0.05, to: 0.95, lag: 0.5 },
  arrival: { from: 0.05, to: 0.95, lag: 0.5 },
  light: { from: 0, to: 1, lag: 0 },
  veil: { from: 0, to: 1, lag: 0 },
  particles: { from: 0, to: 1, lag: 0 },
  base: OUTSIDE,
  'glass-dressing': OUTSIDE,
  'surface-dressing': OUTSIDE,
  'surface-leave': { from: DRESSING_CHANGE.leaveFrom, to: DRESSING_CHANGE.leaveTo, lag: 0 },
  'surface-come': { from: DRESSING_CHANGE.comeFrom, to: DRESSING_CHANGE.comeTo, lag: 0 },
  backdrop: OUTSIDE,
  room: OUTSIDE,
  shed: SHED,
}

const WHOLE: ChangeSpan = { from: 0, to: 1, lag: 0 }

export const changeSpan = (part: string): ChangeSpan => SPANS[part] ?? WHOLE

export function changeRamp(part: string): { start: number; length: number; lag: number } {
  const s = changeSpan(part)
  const whole = s.to - s.from
  return { start: s.from, length: whole * (1 - s.lag), lag: whole * s.lag }
}

export function partChange(part: string, change: number, side = 0.5): number {
  if (!(change > 0)) return 0
  if (change >= 1) return 1
  const r = changeRamp(part)
  const v = (change - r.start - r.lag * Math.min(1, Math.max(0, side))) / r.length
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

/**
 * What lies on the table as one piece and leaves it as one piece (summer's sand, winter's frost and the lumps of snow
 * behind it) is not thinned where it lies: it goes out along the table, away from the foot, over the span `surface-leave`,
 * slowly at first and then fast, as the petals and the leaves go, and in every sample it is the whole thing a little
 * further out. `leaveOut` says how far, for a thing that is gone at `reachMm` and thins from `thinFromMm` out, in a change
 * that takes it away (`leaves`; in every other, and at rest, it says the thing lies where it lay):
 *
 * - `run`, the share of the span that has passed, and `out`, how far out the thing is drawn in this sample, in mm: both 0
 *   before the leaving. `kept` is the share of it that is left past `thinFromMm`, 1 before.
 * - Such a thing goes faster than the globe, and the globe's travel sets how many samples a frame has and when each is
 *   taken (src/film/motion.ts, `evenSet`): drawn at those moments its copies lie at uneven steps, some wider than its
 *   grain, and every grain is a row of beads. So in a frame of `join` samples or more (`of`, else 0) the thing is drawn
 *   where it is at even shares of the shutter from the frame's first sample on (`sample.hold`), a sample's share being
 *   its rank in time, and the part that draws it reads its grain along the way over `tent` steps to either side, most at
 *   the copy's own place: `behind` and `ahead` are those reaches in mm. Tents at even steps add up to the same at every
 *   place, so a grain is the one line it leaves. A frame of fewer samples holds the whole thing, sharp, at each sample's
 *   moment: they lie too far apart to be joined.
 */
export const LEAVE_OUT = { join: 8, tent: 3 } as const

export interface LeaveOut {
  run: number
  out: number
  behind: number
  ahead: number
  of: number
  kept: number
}

export function leaveOut(leaves: boolean, change: number, sample: { t: number; of?: number; hold?: number } | null, reachMm: number, thinFromMm: number): LeaveOut {
  if (!leaves) return { run: 0, out: 0, behind: 0, ahead: 0, of: 0, kept: 1 }
  const gone = (c: number): number => reachMm * partChange('surface-leave', c) ** 2
  const of = sample?.of ?? 1
  const joins = sample !== null && sample.hold !== undefined && of >= LEAVE_OUT.join
  const at = joins ? sample.hold! + (Math.floor(sample.t * of) / of) * SHUTTER_CHANGE : change
  const out = gone(at)
  const reach = joins ? (LEAVE_OUT.tent * SHUTTER_CHANGE) / of : 0
  return {
    run: partChange('surface-leave', at),
    out,
    behind: joins ? out - gone(at - reach) : 0,
    ahead: joins ? gone(at + reach) - out : 0,
    of: joins ? of : 0,
    kept: Math.min(1, (reachMm - out) / (reachMm - thinFromMm)),
  }
}

const ramp = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v)

/** The share of the rise over which its pace comes up from nothing, and the share at its end over which it comes to rest. */
const RISE_EASE = 0.1

/** A ramp from 0 to 1 eased at both ends: the pace comes up over `RISE_EASE` of it, is even between and comes to rest over the same. */
function easeBoth(v: number): number {
  const pace = 1 / (1 - RISE_EASE)
  if (v < RISE_EASE) return (pace * v * v) / (2 * RISE_EASE)
  if (v > 1 - RISE_EASE) return 1 - (pace * (1 - v) * (1 - v)) / (2 * RISE_EASE)
  return pace * (v - RISE_EASE / 2)
}

/**
 * How the picture answers the cover. The cover is an exponent (lighting.ts: the exposure falls by it and the lens takes the
 * heart of the storm to that power), and a glass that burns near white answers it less the higher it stands. Read on the
 * film's own frames with the cover held at nine places from none to whole, on the storm that leaves and on the storm that
 * has come in each of the four changes, the mean of the glass rises in two parts. `quick` of it comes at once, as the air of
 * the storm is lit and its middle goes to white, and is in by a cover of about three times `by`; the rest comes evenly with
 * the cover to its end, as the white spreads outward. The law below is within three thousandths of the mean of seven of
 * those eight storms at every place read, and within nine hundredths of each. The eighth is fall's storm as its change has
 * just brought it: thin and dark, the village in sight through it, it answers the cover nearly evenly from end to end, and
 * no law that is true of the seven is true of it (`EVEN_AS_IT_COMES`).
 *
 * So an exponent that moves at an even pace is not a picture that does: its first frames bring most of the light and its
 * last little, and what the room alone lights is gone in three frames. The cover is therefore told as how far the picture
 * has gone, `shown`, and turned into the exponent that shows that much.
 */
const COVER_ANSWER = { quick: 0.56, by: 0.18 } as const

/**
 * The storms that answer the cover evenly as their change brings them: on the tail of a change into one of them the cover
 * is the picture's share itself, and is not turned by the law above. Read on the film's frames 2118 to 2132 with the cover
 * and without it, the share of the cover that stood in the mean of fall's glass was the exponent itself from the whole
 * cover down to four tenths (0.95 at 0.94, 0.83 at 0.82, 0.61 at 0.66, 0.47 at 0.51) and less than it below. Turned by the
 * law of the seven, that tail took the exponent from 0.82 to 0.66 in one frame and to 0.25 in four more, so the glass lost
 * 86 in 100 of its cover in the tail's first seven frames where the picture was meant to lose 47, and its mean fell 9.6
 * levels of 255 from frame 2120 to 2121 with the room standing.
 *
 * Such a storm takes a longer shoulder as well (`TAIL.roundEven`). Its glass stands at the white of the film under the
 * whole cover and answers the first twentieth of the fall by a third of what it answers below (0.03 of its cover for the
 * exponent's 1 to 0.92, then 0.14 for 0.92 to 0.84), and in the same two frames the storm loses two levels a frame of its
 * own as the bank of the season that left thins (`VEIL_LEAVE`). With the shoulder of three frames the full pace of the fall
 * came down on those frames, and frame 2120 to 2121 fell 7.9 levels where no other pair of the tail fell 5.
 */
const EVEN_AS_IT_COMES: readonly string[] = ['fall']
const evenAsItComes = (came: string | undefined): boolean => came !== undefined && EVEN_AS_IT_COMES.includes(came)
const ANSWER_TOP = COVER_ANSWER.quick * (1 - Math.exp(-1 / COVER_ANSWER.by)) + (1 - COVER_ANSWER.quick)

/** How far the picture has gone under a cover, 0 to 1. What must move as the picture does reads this. */
export const coverShown = (cover: number): number =>
  cover <= 0 ? 0 : cover >= 1 ? 1 : (COVER_ANSWER.quick * (1 - Math.exp(-cover / COVER_ANSWER.by)) + (1 - COVER_ANSWER.quick) * cover) / ANSWER_TOP

/**
 * The other way round: the cover that shows that much. The answer bends one way only, so Newton's steps from no cover come
 * up to the place from below and never past it; twelve of them are exact to the last digit a number holds.
 */
function coverOf(shown: number): number {
  if (shown <= 0) return 0
  if (shown >= 1) return 1
  let cover = 0
  for (let i = 0; i < 12; i++) {
    const quick = COVER_ANSWER.quick * Math.exp(-cover / COVER_ANSWER.by)
    const at = (COVER_ANSWER.quick - quick + (1 - COVER_ANSWER.quick) * cover) / ANSWER_TOP
    cover += ((shown - at) * ANSWER_TOP) / (quick / COVER_ANSWER.by + (1 - COVER_ANSWER.quick))
  }
  return cover >= 1 ? 1 : cover
}

/**
 * How the tail falls, as what the picture still shows of the cover by the share of the tail that is left. Its pace comes up
 * from nothing over the first `round` of it (three frames), so the top of the cover is a shoulder and not a corner and the
 * last of the base's pass is still under nine tenths of the cover; from there it shows the power `ease` of what is left,
 * each frame less than the one before, to nothing at the end. The two meet with one pace. A storm that answers the cover
 * evenly as it comes takes `roundEven` (five frames) for its shoulder: see `EVEN_AS_IT_COMES`.
 */
const TAIL = { ease: 1.45, round: 3 / 18, roundEven: 5 / 18 } as const
function tailBy(round: number): (left: number) => number {
  const top = 1 / (round * round + (2 * round * (1 - round)) / TAIL.ease)
  const rest = (2 * top * round * Math.pow(1 - round, 1 - TAIL.ease)) / TAIL.ease
  return (left) => (left > 1 - round ? 1 - top * (1 - left) * (1 - left) : rest * Math.pow(left, TAIL.ease))
}
const tailShown = tailBy(TAIL.round)
const tailShownEven = tailBy(TAIL.roundEven)

/**
 * The place in the window the cover is read at. Between two seasons it is the change itself. With one season on the stage it
 * is nowhere (0): a shake that keeps its season has no cover at any beat. The one exception is the frames after a change, from
 * the end of the window to the landing: there both seasons of the moment are the one that has come, the moment names the
 * season the change has left (`left`), and the place runs on past 1 at the window's own pace, so the tail of the cover is read.
 */
export function coverPlace(two: boolean, change: number, left: string | null | undefined, beat: number | null): number {
  if (two) return change
  if (typeof left !== 'string' || beat === null) return 0
  const w = config.shake.swapWindow
  return (beat - w.fromBeat) / (w.toBeat - w.fromBeat)
}

/**
 * How far the picture has gone under the cover at a place in the window: 0 before `riseFrom` and from `tailTo` on, 1 from
 * `fullFrom` to `fullTo`. The place runs on past the end of the window (1) at the window's own pace, so the tail is read
 * there as well. What must move as the picture does reads this (`mix.shown` on the frame): the lamps of the backdrop.
 *
 * What is eased is the picture (`coverShown`), not the exponent. The rise is eased at both of its ends: the picture's pace
 * comes up over the first tenth of its twelve frames, is even through the middle and comes to rest on the whole cover over
 * the last tenth, so its first frame and its last each bring under half of what a frame of the middle does, and its
 * steepest frame brings under a tenth of the picture. The fall is eased out
 * (`TAIL`): a shoulder of three frames, then the power `TAIL.ease` of what is left of the tail, steepest on its fourth
 * frame (a twelfth of the cover) and slower on every frame after, to nothing at the end. `came` is the season the change
 * brings: a storm that answers the cover evenly as it comes has a shoulder of five frames and is steepest on its sixth.
 */
export function changeShown(change: number, came?: string): number {
  if (!(change > 0)) return 0
  const c = CHANGE_COVER
  if (change < c.fullFrom) return easeBoth(ramp((change - c.riseFrom) / (c.fullFrom - c.riseFrom)))
  if (change > c.fullTo) return (evenAsItComes(came) ? tailShownEven : tailShown)(ramp((c.tailTo - change) / (c.tailTo - c.fullTo)))
  return 1
}

/**
 * The cover itself at a place in the window: the exponent that shows `changeShown` of the picture there. `came` is the
 * season the change brings. On the rise the storm in the glass is the one that leaves, and all four answer by the one law;
 * on the tail it is the one that came, and where that storm answers evenly (`EVEN_AS_IT_COMES`) the cover is the share
 * itself. The two meet at the whole cover, which both make 1.
 */
export function changeBloom(change: number, came?: string): number {
  const shown = changeShown(change, came)
  if (change > CHANGE_COVER.fullTo && evenAsItComes(came)) return shown
  return coverOf(shown)
}

/**
 * How far the veil has crossed at a place in the window where the season that leaves has the thicker veil. It crosses late,
 * by the power `late` of the place: a sixth of the way at the middle of the window, four tenths where the base begins to
 * change, so the storm of the season that leaves stands through the swap. Carried so to the end of the window, the last of
 * that storm went in the window's last frame, at its steepest pace, and its bank with it. The bank is two hundred times the
 * haze and hides what is behind it until a few hundredths of it are left: summer's 0.09 gave way to fall's 0.001 with 5
 * hundredths of it standing on frame 2123, a pale wash over the foot of the ball, and frame 2124 had the fence clear. So from
 * `ratioFrom` what is left goes by ratio, less by about a quarter of itself in every frame, at the pace it had there, and
 * runs on past the end of the window under the cover's tail to nothing at `tailTo`: a haze thins by ratio, and the bank
 * opens over half a dozen frames and not in one. On that tail the season that came stands alone and the moment names the
 * one it left; stage.ts lays the shared veil from that one (frame.ts, `withVeilLeft`).
 */
export const VEIL_LEAVE = { late: 2.5, ratioFrom: 0.9 } as const
const VEIL_AT = 1 - Math.pow(VEIL_LEAVE.ratioFrom, VEIL_LEAVE.late)
const VEIL_SPAN = CHANGE_COVER.tailTo - VEIL_LEAVE.ratioFrom
// The ratio's pace, such that what is left sets out at the very pace the power had at `ratioFrom` and is nothing at the
// tail's end. What it loses by ending there is a fiftieth of its pace, so the pace is found by going round: each round
// brings it thirteen times nearer, and sixteen rounds are exact to the last digit a number holds.
const VEIL_PACE_AT = (VEIL_LEAVE.late * Math.pow(VEIL_LEAVE.ratioFrom, VEIL_LEAVE.late - 1)) / VEIL_AT
const VEIL_PACE = ((): number => {
  let pace = VEIL_PACE_AT
  for (let i = 0; i < 16; i++) pace = VEIL_PACE_AT * (1 - Math.exp(-pace * VEIL_SPAN))
  return pace
})()
const VEIL_END = Math.exp(-VEIL_PACE * VEIL_SPAN)
export function veilCrossed(place: number): number {
  if (!(place > 0)) return 0
  if (place <= VEIL_LEAVE.ratioFrom) return Math.pow(place, VEIL_LEAVE.late)
  if (place >= CHANGE_COVER.tailTo) return 1
  return 1 - (VEIL_AT * (Math.exp(-VEIL_PACE * (place - VEIL_LEAVE.ratioFrom)) - VEIL_END)) / (1 - VEIL_END)
}
