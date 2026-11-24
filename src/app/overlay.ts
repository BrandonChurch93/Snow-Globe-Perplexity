import { config } from '../config'
import type { AppBridge, AppState, InterfaceHandle } from '../core/bridge'
import type { Overlay } from '../capture/showcase'
import { topLevel } from '../core/quality'
import { controlsPx } from './framing'
import { audioShips, loadInterface } from './mounts'

const WAIT_MS = 8000
const FRAME_MS = 150

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

  return {
    async show(season, name) {
      await mount()
      if (!handle || !root) return
      handle.setVisible(true)
      set({ season, state: name })
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
    },
    hide() {
      handle?.setVisible(false)
    },
    controlsPx: () => bar,
  }
}
