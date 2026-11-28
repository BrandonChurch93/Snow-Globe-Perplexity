/**
 * A browser may take the WebGL context away: a phone short of memory, a tab long in the background, a graphics process
 * that is started again. three answers a context that comes back by making its own state again, while every program,
 * picture and buffer the page made belongs to the context that is gone: a page that drew on wrote warnings and errors
 * by the dozen and showed nothing. Here the page stands instead. From the loss on nothing asks the card, the still of
 * the season on show lies where the picture was, and the page is loaded again at that season, once: when the browser
 * gives the context back, or after `WAIT_MS` without it. A page that loses its context within `SOON_MS` of such a
 * load is not loaded again: it keeps its still and says that the globe stopped drawing.
 */

/** How long a page that is shown waits for its context before it is loaded again without one. A browser that gives a context back does so within a second or two. */
export const WAIT_MS = 4000
/** A loss this soon after a load the page made by itself is not answered with another: about twice the time a slow machine takes to make the whole page. */
export const SOON_MS = 120_000
/** Where the time of that load is kept: it lives through a load, belongs to this tab alone and goes with it. */
export const MEMORY = 'globe:loaded-after-loss'

const COMPLETION_STATUS_KHR = 0x91b1

export interface LossAnswer {
  /** Stops all that asks the card, lays the still, and says which season it is the still of. */
  stand(): string
  /** The page stays as it stands and shows the notice, in the words of a globe that stopped drawing (src/copy.ts, `lost`). */
  cannot(): void
}

export interface LossPage {
  location: Pick<Location, 'href' | 'replace'>
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>
  document: Pick<Document, 'visibilityState' | 'addEventListener'>
  setTimeout(fn: () => void, ms: number): unknown
}

/**
 * No call reaches the card from here on, whoever makes it and whenever: a timer of three's, a promise that was on its
 * way. Once the context is back its old objects are not, and each such call would be a warning of the browser's.
 * three asks every 10 ms whether a program it links aside is done, for as long as it is not: it is told yes.
 */
function quiet(gl: unknown): void {
  if (!gl) return
  const card = gl as Record<string, unknown>
  for (const name in card) {
    if (typeof card[name] !== 'function') continue
    if (name === 'isContextLost') card[name] = () => true
    else if (name === 'getProgramParameter') card[name] = (_program: unknown, what: number) => (what === COMPLETION_STATUS_KHR ? true : null)
    else card[name] = () => null
  }
}

/**
 * Whether this tab loaded itself after a loss, however long ago. Such a tab drew the globe before: a notice there says
 * that the globe stopped, never that the browser cannot draw.
 */
export function drewBefore(page: Pick<LossPage, 'sessionStorage'> = window): boolean {
  try {
    return page.sessionStorage.getItem(MEMORY) !== null
  } catch {
    return false
  }
}

export class ContextWatch {
  lost = false
  private answer: LossAnswer | null = null
  private season: string | null = null
  private stays = false
  private back = false
  private waiting = false
  private waited = false
  private over = false

  /** The listeners go on the canvas before the renderer is made: they are heard first, and three's own are not heard at all. */
  constructor(
    canvas: HTMLCanvasElement,
    private readonly page: LossPage = window,
    private readonly now: () => number = Date.now,
  ) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.stopImmediatePropagation()
      if (this.lost) return void e.preventDefault()
      this.lost = true
      this.stays = this.soon()
      // A browser gives back only a context it was asked to keep, and a page that stays as it is asks for none.
      if (!this.stays) e.preventDefault()
      quiet(canvas.getContext('webgl2'))
      this.begin()
    })
    canvas.addEventListener('webglcontextrestored', (e) => {
      e.stopImmediatePropagation()
      this.back = true
      this.move()
    })
    page.document.addEventListener('visibilitychange', () => this.move())
  }

  /** What the app does at a loss. Told at once where the context went before the app was there. */
  answerWith(answer: LossAnswer): void {
    this.answer = answer
    if (this.lost) this.begin()
  }

  private soon(): boolean {
    try {
      const at = this.page.sessionStorage.getItem(MEMORY)
      return at !== null && !(this.now() - Number(at) >= SOON_MS)
    } catch {
      return false
    }
  }

  private begin(): void {
    if (!this.answer || this.season !== null) return
    this.season = this.answer.stand()
    if (this.stays) {
      this.over = true
      this.answer.cannot()
    } else this.move()
  }

  /** A hidden tab loads nothing and its wait does not run: a browser that took the context of a tab in the background may give it back when the tab is shown. */
  private move(): void {
    if (this.season === null || this.over || this.page.document.visibilityState === 'hidden') return
    if (this.back || this.waited) return this.again()
    if (this.waiting) return
    this.waiting = true
    this.page.setTimeout(() => {
      this.waiting = false
      this.waited = this.page.document.visibilityState !== 'hidden'
      this.move()
    }, WAIT_MS)
  }

  /** The one load. A page that cannot keep the memory of it could not tell the next loss from the first, and makes none. */
  private again(): void {
    this.over = true
    try {
      this.page.sessionStorage.setItem(MEMORY, String(this.now()))
    } catch {
      return void this.answer?.cannot()
    }
    const to = new URL(this.page.location.href)
    to.searchParams.set('season', this.season ?? '')
    this.page.location.replace(to.href)
  }
}
