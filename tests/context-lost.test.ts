import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { ContextWatch, MEMORY, SOON_MS, WAIT_MS, drewBefore, type LossPage } from '../src/app/lost'
import { copy } from '../src/copy'
import { showCannot } from '../src/ui/cannot'

/**
 * The page's answer to a WebGL context that the browser takes away (src/app/lost.ts), with a canvas, a card, a clock,
 * a memory and an address that the test holds in its hands. The same cases are driven in a browser, on the built page,
 * by `npm run lostcontext` (tools/lostcontext.mjs), which takes the context with the WEBGL_lose_context extension.
 */

const LINK_STATUS = 0x8b82
const COMPLETION_STATUS_KHR = 0x91b1

interface Opts {
  address?: string
  hidden?: boolean
  /** When the page last loaded itself after a loss, in ms before now. */
  loadedAgo?: number
  /** A browser that gives a page no memory: every read and every write throws. */
  sealed?: boolean
  season?: string
  /** The app is not there yet when the context goes. */
  late?: boolean
  /** What the app does when the watch tells it that the page stays as it stands. */
  says?: () => void
}

function page(o: Opts = {}) {
  const heard: Record<string, ((e: Event) => void)[]> = {}
  const shown: (() => void)[] = []
  const waits: { over: () => void; ms: number }[] = []
  const loads: string[] = []
  const reached: string[] = []
  const memory: Record<string, string> = {}
  const clock = { now: 1_700_000_000_000 }
  const told = { stood: 0, cannot: 0 }
  if (o.loadedAgo !== undefined) memory[MEMORY] = String(clock.now - o.loadedAgo)

  // As a browser has it: the calls live on the prototype and are listed with the object.
  const card: Record<string, unknown> = Object.create({
    drawArrays: () => void reached.push('drawArrays'),
    useProgram: () => void reached.push('useProgram'),
    deleteTexture: () => void reached.push('deleteTexture'),
    getError: () => (reached.push('getError'), 0),
    isContextLost: () => (reached.push('isContextLost'), false),
    getProgramParameter: () => (reached.push('getProgramParameter'), false),
  })
  card.drawingBufferWidth = 300
  const gl = card as unknown as WebGL2RenderingContext

  const canvas = {
    addEventListener: (type: string, fn: (e: Event) => void): void => void (heard[type] ??= []).push(fn),
    getContext: (): WebGL2RenderingContext => gl,
  }
  const doc = {
    visibilityState: (o.hidden ? 'hidden' : 'visible') as DocumentVisibilityState,
    addEventListener: (_type: string, fn: () => void): void => void shown.push(fn),
  }
  const store = {
    getItem: (key: string): string | null => {
      if (o.sealed) throw new Error('no storage')
      return memory[key] ?? null
    },
    setItem: (key: string, value: string): void => {
      if (o.sealed) throw new Error('no storage')
      memory[key] = value
    },
  }
  const win: LossPage = {
    location: { href: o.address ?? 'https://globe.test/?quality=low&season=winter', replace: (to: string | URL): void => void loads.push(String(to)) },
    sessionStorage: store,
    document: doc as unknown as LossPage['document'],
    setTimeout: (over: () => void, ms: number): number => waits.push({ over, ms }),
  }
  const watch = new ContextWatch(canvas as unknown as HTMLCanvasElement, win, () => clock.now)
  const answer = {
    stand: (): string => {
      told.stood++
      return o.season ?? 'spring'
    },
    cannot: (): void => {
      told.cannot++
      o.says?.()
    },
  }
  if (!o.late) watch.answerWith(answer)

  /** An event as the browser hands it to the canvas: each listener in the order it was added, until one says that no other hears it. */
  const fire = (type: string): { kept: boolean } => {
    let kept = false
    let on = true
    const e = { preventDefault: (): void => void (kept = true), stopImmediatePropagation: (): void => void (on = false) }
    for (const fn of heard[type] ?? []) if (on) fn(e as unknown as Event)
    return { kept }
  }
  const show = (state: DocumentVisibilityState): void => {
    doc.visibilityState = state
    for (const fn of shown) fn()
  }
  return { watch, answer, win, canvas, gl, fire, show, waits, loads, reached, memory, clock, told, lose: () => fire('webglcontextlost'), giveBack: () => fire('webglcontextrestored') }
}

describe('a page whose WebGL context is taken away', () => {
  it('waits 4 s for its context and takes a second loss within 120 s of its own load for the last', () => {
    expect(WAIT_MS).toBe(4000)
    expect(SOON_MS).toBe(120_000)
  })

  it('a loss and then a restore: it stands at once, asks for its context back, and loads once at the season of the still when the context is back', () => {
    const p = page()
    const lost = p.lose()
    expect(lost.kept).toBe(true)
    expect(p.watch.lost).toBe(true)
    expect(p.told).toEqual({ stood: 1, cannot: 0 })
    expect(p.loads).toEqual([])
    expect(p.waits.map((w) => w.ms)).toEqual([WAIT_MS])
    p.giveBack()
    expect(p.loads).toEqual(['https://globe.test/?quality=low&season=spring'])
    expect(p.memory[MEMORY]).toBe(String(p.clock.now))
    // Nothing that follows loads it a second time.
    p.waits[0]!.over()
    p.giveBack()
    p.lose()
    p.show('visible')
    expect(p.loads).toHaveLength(1)
    expect(p.told).toEqual({ stood: 1, cannot: 0 })
  })

  it('a loss with no restore: it loads once by itself when the wait is over, and not before', () => {
    const p = page({ address: 'https://globe.test/', season: 'fall' })
    p.lose()
    expect(p.loads).toEqual([])
    expect(p.waits.map((w) => w.ms)).toEqual([WAIT_MS])
    p.waits[0]!.over()
    expect(p.loads).toEqual(['https://globe.test/?season=fall'])
    expect(p.memory[MEMORY]).toBe(String(p.clock.now))
    p.giveBack()
    expect(p.loads).toHaveLength(1)
    expect(p.told.cannot).toBe(0)
  })

  it('a second loss soon after such a load: no load and no wait, the context is not asked back, and the page says that the globe stopped drawing', () => {
    for (const ago of [0, 1500, SOON_MS - 1]) {
      const p = page({ loadedAgo: ago })
      const lost = p.lose()
      expect(lost.kept, String(ago)).toBe(false)
      expect(p.told, String(ago)).toEqual({ stood: 1, cannot: 1 })
      expect(p.waits, String(ago)).toEqual([])
      // Not when a browser gives the context back all the same, not when the tab comes back, not at a third loss.
      p.giveBack()
      p.show('hidden')
      p.show('visible')
      p.lose()
      expect(p.loads, String(ago)).toEqual([])
      expect(p.told, String(ago)).toEqual({ stood: 1, cannot: 1 })
      expect(p.memory[MEMORY], String(ago)).toBe(String(p.clock.now - ago))
    }
  })

  it('a loss long after such a load is answered as the first was', () => {
    const p = page({ loadedAgo: SOON_MS })
    expect(p.lose().kept).toBe(true)
    expect(p.told).toEqual({ stood: 1, cannot: 0 })
    p.clock.now += WAIT_MS
    p.waits[0]!.over()
    expect(p.loads).toHaveLength(1)
    expect(p.memory[MEMORY]).toBe(String(p.clock.now))
  })

  it('a memory that reads as no time at all counts as soon: the page does not load on what it cannot read', () => {
    const p = page()
    p.memory[MEMORY] = 'yesterday'
    expect(p.lose().kept).toBe(false)
    expect(p.loads).toEqual([])
    expect(p.told).toEqual({ stood: 1, cannot: 1 })
  })

  it('a page that cannot keep the memory of its load makes none: it could not tell the next loss from the first', () => {
    const p = page({ sealed: true })
    p.lose()
    expect(p.told).toEqual({ stood: 1, cannot: 0 })
    p.giveBack()
    expect(p.loads).toEqual([])
    expect(p.told).toEqual({ stood: 1, cannot: 1 })
    p.waits[0]!.over()
    p.giveBack()
    expect(p.loads).toEqual([])
    expect(p.told).toEqual({ stood: 1, cannot: 1 })
  })

  it('a hidden tab stands on its still and loads nothing: at once when it is shown with its context back', () => {
    const p = page({ hidden: true })
    expect(p.lose().kept).toBe(true)
    expect(p.told.stood).toBe(1)
    expect(p.waits).toEqual([])
    p.giveBack()
    expect(p.loads).toEqual([])
    p.show('visible')
    expect(p.loads).toHaveLength(1)
  })

  it('a hidden tab that is shown without its context waits from then, and a wait that ran out while it was hidden does not count', () => {
    const late = page({ hidden: true })
    late.lose()
    late.show('visible')
    expect(late.loads).toEqual([])
    expect(late.waits.map((w) => w.ms)).toEqual([WAIT_MS])
    late.waits[0]!.over()
    expect(late.loads).toHaveLength(1)

    const away = page()
    away.lose()
    away.show('hidden')
    away.waits[0]!.over()
    expect(away.loads).toEqual([])
    away.show('visible')
    expect(away.loads).toEqual([])
    expect(away.waits.map((w) => w.ms)).toEqual([WAIT_MS, WAIT_MS])
    away.waits[1]!.over()
    expect(away.loads).toHaveLength(1)
  })

  it('nothing reaches the card from the loss on, whoever calls and whenever', () => {
    const p = page()
    p.gl.drawArrays(0, 0, 3)
    expect(p.gl.isContextLost()).toBe(false)
    expect(p.reached).toEqual(['drawArrays', 'isContextLost'])
    p.reached.length = 0
    p.lose()
    p.gl.drawArrays(0, 0, 3)
    p.gl.useProgram(null)
    p.gl.deleteTexture(null)
    expect(p.gl.getError()).toBeNull()
    expect(p.gl.isContextLost()).toBe(true)
    // three asks every 10 ms whether a program it links aside is done, for as long as it is not.
    expect(p.gl.getProgramParameter({} as WebGLProgram, COMPLETION_STATUS_KHR)).toBe(true)
    // And reads a link that failed as `false`: what a lost context answers is no failure, and writes no line.
    expect(p.gl.getProgramParameter({} as WebGLProgram, LINK_STATUS)).toBeNull()
    expect(p.reached).toEqual([])
    expect(p.gl.drawingBufferWidth).toBe(300)
  })

  it('is heard first and alone: a listener added to the canvas after it, as the renderer adds its own, hears neither the loss nor the return', () => {
    const p = page()
    const others: string[] = []
    p.canvas.addEventListener('webglcontextlost', () => void others.push('lost'))
    p.canvas.addEventListener('webglcontextrestored', () => void others.push('restored'))
    p.lose()
    p.giveBack()
    expect(others).toEqual([])
    expect(p.loads).toHaveLength(1)
  })

  it('a loss before the app is there is kept, quiet, and answered when the app is', () => {
    const p = page({ late: true })
    expect(p.lose().kept).toBe(true)
    p.gl.drawArrays(0, 0, 3)
    expect(p.reached).toEqual([])
    expect(p.told.stood).toBe(0)
    expect(p.waits).toEqual([])
    p.watch.answerWith(p.answer)
    expect(p.told).toEqual({ stood: 1, cannot: 0 })
    expect(p.waits.map((w) => w.ms)).toEqual([WAIT_MS])
    p.waits[0]!.over()
    expect(p.loads).toEqual(['https://globe.test/?quality=low&season=spring'])
  })
})

/**
 * The words of a page that stays on its still. The notice is written by the page's own code (src/ui/cannot.ts) on a
 * document that the test holds. Which words it is given is one line in the app's answer to the watch (src/app/app.ts)
 * and one line where the page is given no context at all (src/main.ts): both are read here as they are written.
 */
describe('the words of a page that stays on its still', () => {
  const CANNOT = 'This browser cannot draw the globe. A current Chrome, Safari, Firefox or Edge can.'
  const LOST = 'The globe stopped drawing. Reload the page to try again.'
  const app = readFileSync('src/app/app.ts', 'utf8')
  const main = readFileSync('src/main.ts', 'utf8')

  class Part {
    kids: (Part | string)[] = []
    textContent = ''
    className = ''
    attrs: Record<string, string> = {}
    setAttribute(name: string, value: string): void {
      this.attrs[name] = value
    }
    append(...parts: (Part | string)[]): void {
      this.kids.push(...parts)
    }
    replaceChildren(...parts: (Part | string)[]): void {
      this.kids = parts
    }
  }
  const read = (p: Part | string): string => (typeof p === 'string' ? p : p.kids.length ? p.kids.map(read).join('') : p.textContent)

  /** All that a visitor reads in the interface once the notice is written over the controls. */
  const notice = (words?: 'cannot' | 'lost'): string => {
    const dataset: Record<string, string> = {}
    vi.stubGlobal('document', { createElement: () => new Part(), documentElement: { dataset } })
    const ui = new Part()
    ui.append('Shake', 'Sound')
    try {
      const line = showCannot(ui as unknown as HTMLElement, words) as unknown as Part
      // In either words it is the same line: the one thing in the interface, a status, and the page marked.
      expect([ui.kids, line.attrs, dataset]).toEqual([[line], { role: 'status' }, { cannot: '1' }])
    } finally {
      vi.unstubAllGlobals()
    }
    return read(ui)
  }

  /** The app's answer when the watch tells it that the page stays. */
  const stays = (): string => {
    expect(app.match(/showCannot\(/g)).toHaveLength(1)
    expect(app).toContain("    cannot(): void {\n      if (!ui) return\n      face?.dispose()\n      void import('../ui/cannot').then((m) => m.showCannot(ui, 'lost')).catch(() => undefined)\n    },\n")
    return notice('lost')
  }

  /** The page's answer when it is given no WebGL2 context at all: the words go by the memory, and the throw is main's. */
  const refused = (p: ReturnType<typeof page>): string => {
    expect(main.match(/showCannot\(/g)).toHaveLength(1)
    expect(main).toContain("    if (!capture && ui) void import('./ui/cannot').then((m) => m.showCannot(ui, drewBefore() ? 'lost' : 'cannot'))\n    throw e\n")
    return notice(drewBefore(p.win) ? 'lost' : 'cannot')
  }

  const stopped = (reads: string[], note = ''): void => {
    expect(reads, note).toEqual([LOST])
    expect(reads.join(' '), note).not.toContain('cannot')
  }

  it('a second loss soon after a load the page made: the notice says that the globe stopped drawing, not that this browser cannot draw it', () => {
    for (const ago of [0, 1500, SOON_MS - 1]) {
      const said: string[] = []
      const p = page({ loadedAgo: ago, says: () => void said.push(stays()) })
      p.lose()
      stopped(said, String(ago))
    }
  })

  it('a page that cannot keep the memory of its load: the same words, when the context is back and when the wait is over without it', () => {
    for (const how of ['back', 'over'] as const) {
      const said: string[] = []
      const p = page({ sealed: true, says: () => void said.push(stays()) })
      p.lose()
      expect(said, how).toEqual([])
      if (how === 'back') p.giveBack()
      else p.waits[0]!.over()
      stopped(said, how)
    }
  })

  it('a memory that is no number: the same words', () => {
    const said: string[] = []
    const p = page({ says: () => void said.push(stays()) })
    p.memory[MEMORY] = 'yesterday'
    p.lose()
    stopped(said)
  })

  it('a load that is given no WebGL2 while the tab holds the memory, whatever its age: the same words, since such a tab drew the globe before', () => {
    for (const ago of [0, 1500, SOON_MS - 1, SOON_MS, 24 * 3600 * 1000]) stopped([refused(page({ loadedAgo: ago }))], String(ago))
    const p = page()
    p.memory[MEMORY] = 'yesterday'
    stopped([refused(p)])
  })

  it('a visit with no memory that is given no WebGL2 reads what it read before, word for word', () => {
    expect(copy.cannot).toBe(CANNOT)
    expect(refused(page())).toBe(CANNOT)
    // A browser that gives the page no memory holds none: there is nothing to say that the globe was ever drawn.
    expect(refused(page({ sealed: true }))).toBe(CANNOT)
    expect(notice()).toBe(CANNOT)
  })

  it('the words of the stopped globe are the ordered ones and hold no em dash, no exclamation point and no upright bar', () => {
    expect(copy.lost).toBe(LOST)
    expect(copy.lost).not.toMatch(/[\u2014!|]/)
  })
})

/**
 * The season marks are painted from the app's state (src/ui/index.ts): the season it names is the lit one. From the loss
 * on the app (src/app/app.ts) names the season of the still. Both are read here as they are written; on the built page
 * the marks are read in every case of `npm run lostcontext`, and in its case "shake" the loss comes in the middle of a change.
 */
describe('the season marks of a page that stands on its still', () => {
  it('the lit mark is the season of the still that is laid, in the middle of a change too, and Shake stays held as it was', () => {
    const app = readFileSync('src/app/app.ts', 'utf8')
    const face = readFileSync('src/ui/index.ts', 'utf8')
    const stand = app.slice(app.indexOf('    stand(): string {\n'), app.indexOf('    cannot(): void {\n'))
    // One value for the still, for the address (it is what the watch is handed back) and for the mark, told once the still is laid.
    const steps = ["const season = playing === 'live' ? (session.target ?? session.season) : shown\n", 'laid = season\n', 'window.stillOf?.(season)\n', 'tell()\n', 'return season\n']
    const at = steps.map((step) => stand.indexOf(step))
    expect(at.every((a, i) => a >= 0 && (i === 0 || a > at[i - 1]!))).toBe(true)
    expect(app.match(/\blaid = /g)).toHaveLength(1)
    // The state the interface is told: the season of the still, with the change and its hold as they were at the loss.
    expect(app).toContain("    season: laid ?? session.season,\n    target: session.target,\n    busy: playing === 'live' && session.busy,\n")
    // The interface: lit by the state's season alone; the mark of where a change goes shows only while that is another season; Shake is held by the change.
    expect(face).toContain("      b.setAttribute('aria-pressed', String(id === state.season))\n")
    expect(face).toContain("      b.toggleAttribute('data-target', state.busy && id === state.target && id !== state.season)\n")
    expect(face).toContain('    const held = state.busy || latched\n')
  })
})
