import { config } from '../config'
import type { Moment } from '../core/stage'

/**
 * A making that can stop between its pieces. Called, it runs through and gives what it made, as a plain function would;
 * `steps` gives the same statements in the same order with a place to stop after each piece, so a page that is drawing can
 * give a frame in between.
 */
export interface InSteps<T> {
  (): T
  steps(): Generator<void, T>
}

/** How many points of a mesh a making works through before it stops. */
export const ROW = 256

/** One step of a set that is built. One that answers true says the next is a small one of many and may follow it in the same frame. */
export type Step = () => boolean | void

/**
 * What one turn spends on the small steps of a making: a share of the time the page took to come round, and no less than
 * `ms`. A season nobody waits for takes a quarter of the page's own time, so the picture at rest keeps its pace. The season
 * a shake is on its way into takes as long again as the page itself, because the shake is held for it only so long.
 */
export const PACE = { aside: { ms: 4, share: 0.25 }, awaited: { ms: 12, share: 1 } }

export function spendOf(waitedMs: number, awaited: boolean): number {
  const pace = awaited ? PACE.awaited : PACE.aside
  return Math.max(pace.ms, pace.share * waitedMs)
}

/** How long a step waits for a frame before it goes without one. A frame older than this is none to keep to either: the page draws slowly or its thread stood, and the wait says what to take. */
export const SOON_MS = 50
/** What a frame keeps free after work done aside in it: the browser's own work on the frame, which comes after the page's script. */
export const KEEP_MS = 4
/** What work aside takes of a frame that has nothing left, so that it still comes to an end. Once a frame, of what the frame keeps free. */
export const LEAST_MS = 1
/** The least of a frame's rest that the season a shake waits for stays inside the frame for. */
export const FIT_MS = 8
/** How many gaps between frames are seen before the display's pace is taken as known. */
export const GAPS = 8

/**
 * The pace of the display, as far as the page has shown it: the third shortest gap there ever was between the times two
 * frames began. The shortest and not the usual one, because frames that work aside made late must not become the pace that
 * work is fitted to; the third, so that a frame or two that some accident brought early do not set it.
 */
export class FramePace {
  every = Infinity
  /** What work aside has taken of the frame that began last. */
  taken = 0
  private last = -1
  private seen = 0
  private readonly shortest: number[] = []

  /** A frame that began at `at`. Two that wait in one frame both tell of it, and it counts once. */
  frame(at: number): void {
    if (at <= this.last) return
    if (this.last >= 0) {
      const gap = at - this.last
      const longer = this.shortest.findIndex((g) => gap < g)
      this.shortest.splice(longer < 0 ? this.shortest.length : longer, 0, gap)
      this.shortest.length = Math.min(this.shortest.length, 3)
      if (++this.seen >= GAPS) this.every = this.shortest.at(-1)!
    }
    this.last = at
    this.taken = 0
  }
}

/** What is left of a frame of which `usedMs` are gone, up to the next one a display shows that has one every `everyMs`. */
export function leftIn(usedMs: number, everyMs: number): number {
  return (Math.floor(usedMs / everyMs) + 1) * everyMs - usedMs - KEEP_MS
}

/**
 * `planMs` of work aside, cut to what the frame has left, and to the least where that is nothing and work aside has not
 * taken as much of the frame yet (`takenMs`). The least also while the display's pace is not known, so that the first
 * frames show it; the whole where the frame is too old to keep to.
 */
export function fitIn(planMs: number, usedMs: number, everyMs: number, takenMs = 0): number {
  if (usedMs >= SOON_MS) return planMs
  const least = Math.max(0, LEAST_MS - takenMs)
  return Number.isFinite(everyMs) ? Math.min(planMs, Math.max(least, leftIn(usedMs, everyMs))) : least
}

/**
 * What a turn spends that a frame brought. The page's rate is judged by its frames (the governor of src/core/quality.ts,
 * by the middle one of two seconds of them), and a making that pushed frame after frame past the next one would cost the
 * visitor a level of quality for the rest of the visit. A season nobody waits for therefore takes no more than the frame
 * has left. The season a shake waits for takes all the frame has left; where that is less than `FIT_MS` it gives up as few
 * frames as bring it over that, at 60 a second one, and takes them whole, which gets more done than staying inside.
 */
export function spendIn(usedMs: number, everyMs: number, waitedMs: number, awaited: boolean, takenMs = 0): number {
  if (!awaited || usedMs >= SOON_MS || !Number.isFinite(everyMs)) return fitIn(spendOf(waitedMs, awaited), usedMs, everyMs, takenMs)
  const left = leftIn(usedMs, everyMs)
  return left + Math.max(0, Math.ceil((FIT_MS - left) / everyMs)) * everyMs
}

/** Takes one frame's steps off the front: until one does not answer true or `ms` have gone by. The step that passes `ms` is the frame's last. */
export function runFor(steps: Step[], ms: number, now: () => number): void {
  const until = now() + ms
  let small: boolean | void
  do small = steps.shift()?.()
  while (small && now() < until)
}

/**
 * How long a press holds other seasons' work back where nothing answers it, neither a shake nor the season on show: as
 * long as the page keeps the wish. In the seconds the session counts, as all the times of a wish are: a frame counts a
 * quarter of a second there at most, so a page that draws slowly keeps a wish far longer than the clock says. Counted by
 * the clock, the wish would go on such a page before the season pressed for had its turn at the last piece, and the
 * press would land nowhere.
 */
export const PRESS_S = config.live.loadWaitSeconds
/** How long after a press its season is made in steps. What is left then is made in one piece: the picture stands for it, and the wish is not lost. */
export const LAST_S = PRESS_S - 0.5
/** How long after a landing the picture is still watched as a shake: until the storm has cleared and the liquid stands. */
export const SETTLE_S = Math.max(config.shake.settleCheckSeconds, config.shake.spinDownSeconds)

/**
 * The season a press asked for. The wish stands until the change it asked for has been shown: with a shake, until the
 * shake has landed and settled; without one (reduced motion), until the season is on show; and for `PRESS_S` where
 * neither comes. While it stands nothing is made for any other season, and nothing at all through a shake nobody
 * pressed for.
 */
export class Wish {
  private inAir = false
  private answered = false
  private into: string | null = null
  private at = 0
  private time = 0
  private giving = false
  private given = false

  /** A press for `season`, at the moment drawn last: the session has not counted on since. */
  press(season: string): void {
    this.into = season
    this.at = this.time
    this.answered = false
  }

  /** A frame of `moment` is drawn. A landing is no rest: what arrived is still coming down, and a stop there is seen. */
  drawn(moment: Pick<Moment, 'beat' | 'season' | 'sinceLanding' | 'time'>): void {
    // The time runs back where a session begins again or a state is set. The wish keeps its age through that: let go in
    // mid shake, it would leave the season pressed for held with all the others.
    if (moment.time < this.time) this.at -= this.time - moment.time
    this.time = moment.time
    this.given = this.giving
    this.giving = false
    if (moment.beat !== null) this.answered = true
    this.inAir = moment.beat !== null || moment.sinceLanding < SETTLE_S
    if (!this.inAir && (this.answered || moment.season === this.into || !(this.time - this.at < PRESS_S))) this.into = null
  }

  awaits(season: string): boolean {
    return this.into === season
  }

  /** Whether nothing is made for `season` now. */
  holds(season: string): boolean {
    return (this.inAir || this.into !== null) && this.into !== season
  }

  /** Whether what is left of `season` is made in one piece: it is the season pressed for, and the press is `LAST_S` old. */
  last(season: string): boolean {
    return this.into === season && this.time - this.at > LAST_S
  }

  /** The page works on the season pressed for, in the time before the frame that comes next. */
  gives(): void {
    this.giving = true
  }

  /**
   * Whether the page worked on the season pressed for in the time the frame drawn last took to come. It gave that time
   * up by its own choice (`spendIn`), so the frame says nothing of the machine's pace, and the governor is not told of
   * it. Only where that work was in fact done: a season whose files fail or never come is not worked on, and holds the
   * governor off for no frame. And it ends, because what is left `LAST_S` after the press is made in one piece.
   */
  get gave(): boolean {
    return this.given
  }
}

/** A turn at work that is done aside: how long it took to come, and when the frame began that brought it. None began where the page did not draw in time. */
export interface Turn {
  waited: number
  frame: number | null
}

/**
 * One turn at the making of `season` on a page that draws. What it spends: the whole wait counts, however long: where a
 * frame holds the thread for seconds (no GPU, a program linked inside the frame) that is the page's pace, and a share of
 * 50 ms of it left a season a minute in the making. Where a frame brought the turn it is spent by what that frame has left.
 */
export function workIn(steps: Step[], season: string, turn: Turn, wish: Wish, pace: FramePace, now: () => number): void {
  const awaited = wish.awaits(season)
  if (awaited) wish.gives()
  const from = now()
  if (wish.last(season)) while (steps.length) steps.shift()!()
  else runFor(steps, turn.frame === null ? spendOf(turn.waited, awaited) : spendIn(now() - turn.frame, pace.every, turn.waited, awaited, pace.taken), now)
  pace.taken += now() - from
}

export function whole<T>(steps: Generator<void, T>): T {
  for (;;) {
    const s = steps.next()
    if (s.done) return s.value
  }
}

export const inSteps = <T>(steps: () => Generator<void, T>): InSteps<T> => Object.assign((): T => whole(steps()), { steps })

/** The steps of a making where it has them, and where it has none one step that is all of it. */
export function stepsOf<T>(make: () => T): Generator<void, T> {
  const own = (make as Partial<InSteps<T>>).steps
  if (own) return own()
  return (function* (): Generator<void, T> {
    return make()
  })()
}
