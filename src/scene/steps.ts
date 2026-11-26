/**
 * A making that can stop between its pieces. Called, it runs through and gives what it made, as a plain function would;
 * `steps` gives the same statements in the same order with a place to stop after each piece, so a page that is drawing can
 * give a frame in between.
 */
export interface InSteps<T> {
  (): T
  steps(): Generator<void, T>
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
