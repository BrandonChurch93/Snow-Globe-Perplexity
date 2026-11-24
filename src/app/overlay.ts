import { config } from '../config'
import type { AppBridge, AppState, InterfaceHandle } from '../core/bridge'
import type { Overlay } from '../capture/showcase'
import { topLevel } from '../core/quality'
import { controlsPx } from './framing'
import { audioShips, loadInterface } from './mounts'

const WAIT_MS = 8000
const FRAME_MS = 150
export const INTERFACE_STATES = ['rest', 'focus', 'pressed', 'hint']
/** An animation is held by a playback rate of zero and not by a pause: the harness grabs the stage with animations off,
 * which ends every animation that is still running or paused and leaves alone only those whose rate is zero.
 * It is held this far short of its own end, so that its end is never announced and the interface does not clear it. */
const HELD_SHORT_MS = 1

const frames = (count: number): Promise<void> =>
  new Promise((resolve) => {
    let left = count
    const timer = window.setTimeout(resolve, FRAME_MS)
    const next = (): void => {
      if (left-- > 0) requestAnimationFrame(next)
      else {
        window.clearTimeout(timer)
        resolve()
      }
    }
    next()
  })

export function createOverlay(root: HTMLElement | null): Overlay {
  let handle: InterfaceHandle | null = null
  let mounting: Promise<void> | null = null
  let bar: number | null = null
  const fns = new Set<(s: AppState) => void>()
  let state: AppState = {
    ready: true,
    season: config.defaultSeason,
    target: null,
    busy: false,
    quality: topLevel.id,
    auto: true,
    soundAvailable: audioShips,
    soundOn: audioShips,
    reducedMotion: false,
    diagnostic: '',
    state: '',
    playing: 'live',
  }
  const set = (next: Partial<AppState>): void => {
    state = { ...state, ...next }
    for (const fn of [...fns]) fn(state)
  }
  const nothing = (): void => undefined
  const bridge: AppBridge = {
    state: () => state,
    subscribe(fn) {
      fns.add(fn)
      return () => {
        fns.delete(fn)
      }
    },
    shake: nothing,
    goTo: nothing,
    setSound: nothing,
    setQuality: nothing,
    setSeason: nothing,
    setState: nothing,
    setDiagnostic: nothing,
    play: nothing,
    activity: nothing,
  }
  const mount = (): Promise<void> =>
    (mounting ??= loadInterface().then((m) => {
      if (m && root) handle = m.mountInterface(root, bridge)
    }))
  const shown = (el: HTMLElement): Promise<void> =>
    new Promise((resolve) => {
      if (el.dataset.interface === 'shown') return resolve()
      const done = (): void => {
        seen.disconnect()
        window.clearTimeout(timer)
        resolve()
      }
      const seen = new MutationObserver(() => {
        if (el.dataset.interface === 'shown') done()
      })
      const timer = window.setTimeout(done, WAIT_MS)
      seen.observe(el, { attributes: true })
    })

  const show = async (season: string, name: string): Promise<void> => {
    await mount()
    if (!handle || !root) return
    handle.setVisible(true)
    set({ season, state: name, target: null })
    await shown(root)
    set({ busy: true })
    set({ busy: false })
    for (const a of document.getAnimations()) {
      try {
        a.finish()
      } catch {
        a.cancel()
      }
    }
    await frames(2)
    bar = controlsPx(root, document.getElementById('app') ?? root) ?? bar
  }
  const hold = (within: Element, phase: number, together: boolean): number => {
    const all = within.getAnimations({ subtree: true })
    const moving = all.filter((a) => !(a instanceof CSSTransition))
    for (const a of all) if (a instanceof CSSTransition) a.finish()
    const length = (a: Animation): number => Number(a.effect?.getComputedTiming().duration) || 0
    const longest = Math.max(0, ...moving.map(length))
    for (const a of moving) {
      a.playbackRate = 0
      a.currentTime = Math.min(phase * (together ? longest : length(a)), Math.max(0, length(a) - HELD_SHORT_MS))
    }
    return moving.length
  }

  return {
    show,
    async put(name, ask) {
      if (!INTERFACE_STATES.includes(name)) throw new Error(`no such interface state: ${name}. The states are ${INTERFACE_STATES.join(', ')}`)
      const all = config.seasons
      const season = ask.season ?? config.defaultSeason
      if (!all.includes(season)) throw new Error(`no such season: ${season}`)
      await show(season, 'rest')
      if (!handle || !root) throw new Error('this build has no interface')
      const control = ask.control ?? 'shake'
      const el = root.querySelector<HTMLElement>(all.includes(control) ? `[data-season="${control}"]` : `[data-control="${control}"]`)
      if (!el) throw new Error(`no such control: ${control}`)
      const had = document.activeElement
      if (had instanceof HTMLElement) had.blur()
      const phase = Math.min(1, Math.max(0, ask.phase ?? 0.5))
      let target: string | null = null
      let paused = 0
      if (name === 'focus') el.focus({ focusVisible: true } as FocusOptions)
      else if (name === 'pressed') {
        target = all.includes(control) ? control : all[(all.indexOf(season) + 1) % all.length]!
        if (target === season) throw new Error(`the mark of ${season} is the season shown: press another`)
        set({ busy: true, target })
        await frames(2)
        paused = hold(root, phase, false)
      } else if (name === 'hint') {
        root.dispatchEvent(new Event('hint'))
        await frames(2)
        paused = hold(root, phase, true)
      }
      await frames(2)
      const r = el.getBoundingClientRect()
      const hidden = r.width === 0 || r.height === 0
      return {
        state: name,
        control,
        season,
        target,
        phase: name === 'pressed' || name === 'hint' ? phase : null,
        rect: hidden ? null : [r.left, r.top, r.width, r.height],
        at: hidden ? null : [r.left + r.width / 2, r.top + r.height / 2],
        focusVisible: el.matches(':focus-visible'),
        paused,
        shown: root.dataset.interface === 'shown',
      }
    },
    hide() {
      handle?.setVisible(false)
    },
    controlsPx: () => bar,
  }
}
