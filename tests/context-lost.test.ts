import { describe, expect, it } from 'vitest'
import { ContextWatch, MEMORY, SOON_MS, WAIT_MS, type LossPage } from '../src/app/lost'

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
    cannot: (): void => void told.cannot++,
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
  return { watch, answer, canvas, gl, fire, show, waits, loads, reached, memory, clock, told, lose: () => fire('webglcontextlost'), giveBack: () => fire('webglcontextrestored') }
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

  it('a second loss soon after such a load: no load and no wait, the context is not asked back, and the page says that it cannot draw', () => {
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
