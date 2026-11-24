import { config } from '../config'
import { copy } from '../copy'
import type { AppBridge, AppState } from '../core/bridge'
import s from './menu.module.css'

export interface Menu {
  toggle(): void
  close(): void
  isOpen(): boolean
  update(state: AppState): void
}

interface Row {
  id: string
  label: string
  values: readonly string[]
  current(state: AppState): string
  also?(state: AppState): string
  pick(value: string): void
}

export function mountMenu(parent: HTMLElement, hiddenClass: string, bridge: AppBridge): Menu {
  const rows: Row[] = [
    {
      id: 'quality',
      label: copy.menu.quality,
      values: [copy.menu.auto, ...Object.keys(config.live.quality)],
      current: (state) => (state.auto ? copy.menu.auto : state.quality),
      also: (state) => (state.auto ? state.quality : ''),
      pick: (value) => bridge.setQuality(value),
    },
    {
      id: 'season',
      label: copy.menu.season,
      values: config.seasons,
      current: (state) => state.season,
      pick: (value) => bridge.setSeason(value),
    },
    {
      id: 'state',
      label: copy.menu.state,
      values: copy.menu.states,
      current: (state) => state.state,
      pick: (value) => bridge.setState(value),
    },
    {
      id: 'view',
      label: copy.menu.view,
      values: [copy.menu.none, ...copy.menu.views],
      current: (state) => state.diagnostic || copy.menu.none,
      pick: (value) => bridge.setDiagnostic(value),
    },
    {
      id: 'play',
      label: copy.menu.play,
      values: copy.menu.plays,
      current: (state) => state.playing,
      pick: (value) => {
        const what = copy.menu.plays.find((p) => p === value)
        if (what) bridge.play(what)
      },
    },
  ]

  const panel = document.createElement('div')
  panel.className = s.menu
  panel.dataset.menu = ''
  panel.hidden = true
  panel.setAttribute('role', 'group')
  panel.setAttribute('aria-label', copy.menu.name)

  const options = rows.map((row) => {
    const line = document.createElement('div')
    line.className = s.row
    line.dataset.row = row.id
    const label = document.createElement('span')
    label.className = s.label
    label.id = `menu-${row.id}`
    label.textContent = row.label
    const group = document.createElement('div')
    group.className = s.options
    group.setAttribute('role', 'group')
    group.setAttribute('aria-labelledby', label.id)
    const buttons = row.values.map((value) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = s.option
      b.tabIndex = -1
      b.dataset.value = value
      b.textContent = value
      b.addEventListener('click', () => row.pick(value))
      group.append(b)
      return b
    })
    line.append(label, group)
    panel.append(line)
    return buttons
  })

  const name = document.createElement('span')
  name.className = hiddenClass
  name.textContent = copy.menu.name
  panel.prepend(name)
  parent.append(panel)

  let last: AppState | null = null

  const update = (state: AppState): void => {
    last = state
    if (panel.hidden !== false) return
    rows.forEach((row, i) => {
      const current = row.current(state)
      const also = row.also ? row.also(state) : ''
      for (const b of options[i]) {
        b.setAttribute('aria-pressed', String(b.dataset.value === current))
        b.toggleAttribute('data-also', also !== '' && b.dataset.value === also)
      }
    })
  }

  const set = (open: boolean): void => {
    panel.hidden = !open
    if (open && last) update(last)
  }

  return {
    toggle: () => set(panel.hidden !== false),
    close: () => set(false),
    isOpen: () => panel.hidden === false,
    update,
  }
}
