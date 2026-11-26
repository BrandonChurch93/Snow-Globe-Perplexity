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
 * What one frame spends on the small steps of a making: a share of the time the page took to come round, and no less than
 * `ms`. A season nobody waits for takes a quarter of the page's own time, so the picture at rest keeps its pace. The season
 * a shake is on its way into takes as long again as the page itself, because the shake is held for it only so long.
 */
export const PACE = { aside: { ms: 4, share: 0.25 }, awaited: { ms: 12, share: 1 } }

export function spendOf(waitedMs: number, awaited: boolean): number {
  const pace = awaited ? PACE.awaited : PACE.aside
  return Math.max(pace.ms, pace.share * waitedMs)
}

/** Takes one frame's steps off the front: until one does not answer true or `ms` have gone by. The step that passes `ms` is the frame's last. */
export function runFor(steps: Step[], ms: number, now: () => number): void {
  const until = now() + ms
  let small: boolean | void
  do small = steps.shift()?.()
  while (small && now() < until)
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
