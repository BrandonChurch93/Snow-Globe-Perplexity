import { config } from '../../src/config'
import type { AppBridge, AppState, ProbeBridge, ProbeLevelResult, ProbeResult } from '../../src/core/bridge'
import { mountInterface } from '../../src/ui/index'
import { mountProbe } from '../../src/probe/index'

const query = new URLSearchParams(location.search)
const flag = (name: string): boolean => query.get(name) === '1'
const root = document.getElementById('ui') as HTMLElement
const view = document.getElementById('view') as HTMLElement
const barSeconds = (60 / config.film.defaultBpm) * config.film.beatsPerBar

function backdrop(season: string): void {
  const key = config.keys.find((k) => k.season === season && k.state === 'rest') ?? config.keys[0]
  for (const layer of view.querySelectorAll('i')) layer.style.backgroundImage = `url(/${key.image})`
}

function mockApp(): AppBridge {
  const listeners = new Set<(s: AppState) => void>()
  let state: AppState = {
    ready: !flag('unready'),
    season: query.get('season') ?? config.defaultSeason,
    target: null,
    busy: false,
    quality: query.get('quality') ?? Object.keys(config.live.quality)[0],
    auto: query.get('auto') !== '0',
    soundAvailable: !flag('nosound'),
    soundOn: flag('sound'),
    reducedMotion: flag('reduced'),
    diagnostic: 'none',
    state: 'rest',
    playing: 'live',
  }
  const set = (patch: Partial<AppState>): void => {
    state = { ...state, ...patch }
    backdrop(state.season)
    for (const fn of listeners) fn(state)
  }
  const shakeTo = (season: string): void => {
    if (state.busy || !state.ready) return
    set({ busy: true, target: season, state: 'storm' })
    if (flag('hold')) return
    window.setTimeout(() => set({ busy: false, target: null, season, state: 'landed' }), (state.reducedMotion ? 0.5 : 1) * barSeconds * 1000)
  }
  const next = (): string => config.seasons[(config.seasons.indexOf(state.season) + 1) % config.seasons.length]
  backdrop(state.season)
  if (!state.ready) window.setTimeout(() => set({ ready: true }), Number(query.get('readyAfter') ?? 1.5) * 1000)
  const calls: string[] = []
  const note = (name: string, value: unknown = ''): void => {
    calls.push(value === '' ? name : `${name}:${String(value)}`)
  }
  const bridge: AppBridge & { set: typeof set; calls: string[] } = {
    state: () => state,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    shake: () => {
      note('shake')
      shakeTo(next())
    },
    goTo: (season) => {
      note('goTo', season)
      shakeTo(season)
    },
    setSound: (on) => {
      note('setSound', on)
      set({ soundOn: on })
    },
    setQuality: (level) => {
      note('setQuality', level)
      set(level === 'auto' ? { auto: true } : { auto: false, quality: level })
    },
    setSeason: (season) => {
      note('setSeason', season)
      set({ season })
    },
    setState: (s) => {
      note('setState', s)
      set({ state: s })
    },
    setDiagnostic: (v) => {
      note('setDiagnostic', v)
      set({ diagnostic: v })
    },
    play: (what) => {
      note('play', what)
      set({ playing: what })
    },
    activity: () => note('activity'),
    set,
    calls,
  }
  return bridge
}

function mockProbe(): ProbeBridge {
  const levels = Object.keys(config.live.quality)
  const seconds = Number(query.get('seconds') ?? 1.2)
  const numbers: Record<string, number[]> = { 0: [119.8, 96.4, 71.3, 52.6], 1: [120, 110.2, 96.8, 74.1], 2: [120, 118.9, 119.6, 101.7] }
  const row = (level: string, i: number): ProbeLevelResult => {
    const [restMedianFps, restSlowFps, stormMedianFps, stormSlowFps] = numbers[i % 3]
    return { level, restMedianFps, restSlowFps, stormMedianFps, stormSlowFps }
  }
  const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))
  return {
    levels: () => levels,
    secondsPerLevel: () => seconds,
    run: async (onProgress) => {
      const done: ProbeLevelResult[] = []
      const stopAt = query.get('stop')
      for (const [i, level] of levels.entries()) {
        for (const phase of ['rest', 'storm'] as const) {
          for (let k = 0; k < 6; k++) {
            onProgress([...done], { level, phase, fraction: k / 6 })
            if (stopAt === `${level}-${phase}` && k === 3) {
              document.documentElement.dataset.parked = ''
              await new Promise(() => {})
            }
            await wait((seconds * 1000) / 12)
          }
        }
        done.push(row(level, i))
      }
      onProgress([...done], null)
      const result: ProbeResult = {
        levels: done,
        graphics: query.get('graphics') ?? 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
        screen: `${window.screen.width} x ${window.screen.height}`,
        pixelRatio: window.devicePixelRatio,
        pick: levels[Math.min(1, levels.length - 1)],
        userAgent: navigator.userAgent,
      }
      return result
    },
  }
}

if (query.get('page') === 'probe') {
  view.classList.add('blank')
  mountProbe(root, mockProbe())
} else {
  const bridge = mockApp()
  const handle = mountInterface(root, bridge)
  Object.assign(window, { preview: { bridge, handle } })
}
