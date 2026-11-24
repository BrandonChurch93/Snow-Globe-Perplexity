import { config } from '../config'
import { copy, timing } from '../copy'
import type { AppBridge, AppState, InterfaceHandle } from '../core/bridge'
import { seasonGlyphs, shakeGlyph, soundGlyph } from './glyphs'
import { mountMenu } from './menu'
import './face.css'
import s from './ui.module.css'

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = className
  return e
}

function button(className: string, control: string, glyph: string): HTMLButtonElement {
  const b = make('button', className)
  b.type = 'button'
  b.dataset.control = control
  b.innerHTML = glyph
  return b
}

function named(text: string): HTMLSpanElement {
  const e = make('span', s.hidden)
  e.textContent = text
  return e
}

export function mountInterface(root: HTMLElement, bridge: AppBridge): InterfaceHandle {
  const seasons: readonly string[] = config.seasons
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  const ui = make('div', s.ui)
  ui.style.setProperty('--dim-to', String(timing.dimTo))
  ui.style.setProperty('--dim-out', `${timing.dimOutSeconds}s`)
  ui.style.setProperty('--dim-in', `${timing.dimInSeconds}s`)
  ui.style.setProperty('--hint', `${timing.hintSeconds}s`)

  const bar = make('div', s.bar)
  bar.hidden = true

  const shake = button(s.shake, 'shake', shakeGlyph(s.globe, s.arcs))
  const word = make('span', s.word)
  word.textContent = copy.shake.word
  shake.append(word, named(` ${copy.shake.rest}`))

  const marks = make('div', s.marks)
  marks.setAttribute('role', 'group')
  marks.setAttribute('aria-label', copy.seasons.group)
  const markOf = seasons.map((id, i) => {
    const b = button(s.mark, 'season', seasonGlyphs[i % seasonGlyphs.length])
    b.dataset.season = id
    b.append(named(copy.seasons.name(id)))
    marks.append(b)
    return b
  })

  const sound = button(s.sound, 'sound', soundGlyph(s.waves, s.cross))
  sound.append(named(copy.sound.name))

  const live = make('div', s.hidden)
  live.setAttribute('role', 'status')

  bar.append(shake, marks, sound)
  ui.append(bar, live)
  const menu = mountMenu(ui, s.hidden, bridge)
  root.append(ui)

  let state = bridge.state()
  let visible = true
  let fontReady = false
  let shown = false
  let latched = false
  let moved = false
  let hintDone = false
  let lastMove = -Infinity
  let latchTimer = 0
  let hintTimer = 0
  let idleTimer = 0
  let fontTimer = 0

  const still = (): boolean => state.reducedMotion || reduce.matches

  const endPulse = (): void => shake.classList.remove(s.pulse)

  const pulse = (): void => {
    endPulse()
    if (still()) return
    void shake.offsetWidth
    shake.classList.add(s.pulse)
  }

  const cancelHint = (): void => {
    hintDone = true
    window.clearTimeout(hintTimer)
    endPulse()
  }

  const armHint = (): void => {
    window.clearTimeout(hintTimer)
    if (hintDone || !shown || document.visibilityState !== 'visible') return
    hintTimer = window.setTimeout(() => {
      if (hintDone || !shown) return
      hintDone = true
      if (!state.busy && !latched) pulse()
    }, config.live.hintAfterSeconds * 1000)
  }

  const undim = (): void => {
    window.clearTimeout(idleTimer)
    delete ui.dataset.dim
  }

  const wake = (): void => {
    undim()
    idleTimer = window.setTimeout(() => {
      ui.dataset.dim = ''
    }, timing.idleSeconds * 1000)
  }

  const paint = (): void => {
    const show = visible && fontReady && state.ready && state.playing === 'live'
    ui.toggleAttribute('data-reduced', state.reducedMotion)
    if (show !== shown) {
      shown = show
      bar.hidden = !show
      if (show) {
        root.dataset.interface = 'shown'
        armHint()
      } else {
        delete root.dataset.interface
        window.clearTimeout(hintTimer)
        endPulse()
      }
    }
    const held = state.busy || latched
    shake.setAttribute('aria-disabled', String(held))
    markOf.forEach((b, i) => {
      const id = seasons[i]
      b.setAttribute('aria-pressed', String(id === state.season))
      b.setAttribute('aria-disabled', String(held))
      b.toggleAttribute('data-target', state.busy && id === state.target && id !== state.season)
    })
    sound.hidden = !state.soundAvailable
    sound.setAttribute('aria-pressed', String(state.soundOn))
    menu.update(state)
  }

  const latch = (): void => {
    latched = true
    window.clearTimeout(latchTimer)
    latchTimer = window.setTimeout(() => {
      latched = false
      paint()
    }, timing.latchSeconds * 1000)
    cancelHint()
    paint()
  }

  const free = (): boolean => shown && !state.busy && !latched

  const pressShake = (): void => {
    if (!free()) return
    latch()
    bridge.shake()
  }

  const go = (id: string): boolean => {
    if (!free() || id === state.season) return false
    latch()
    bridge.goTo(id)
    return true
  }

  const step = (by: number): void => {
    const from = Math.max(seasons.indexOf(state.season), 0)
    const to = (from + by + seasons.length) % seasons.length
    const within = markOf.some((b) => b === document.activeElement)
    if (go(seasons[to]) && within) markOf[to].focus()
  }

  const toggleSound = (): void => {
    if (shown && state.soundAvailable) bridge.setSound(!state.soundOn)
  }

  const onState = (next: AppState): void => {
    const prev = state
    state = next
    if (shown && ((next.busy && !prev.busy) || next.season !== prev.season)) {
      cancelHint()
      if (moved) wake()
    }
    if (prev.busy && !next.busy) {
      latched = false
      window.clearTimeout(latchTimer)
    }
    if (shown && next.season !== prev.season) live.textContent = copy.seasons.name(next.season)
    paint()
  }

  const onInput = (): void => {
    moved = true
    wake()
    bridge.activity()
  }

  const onMove = (e: Event): void => {
    if (e.timeStamp - lastMove < timing.moveGapSeconds * 1000) return
    lastMove = e.timeStamp
    onInput()
  }

  const onKey = (e: KeyboardEvent): void => {
    if (!visible) return
    if (!e.repeat) onInput()
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    if (t instanceof HTMLElement && (t.isContentEditable || t.matches('input, textarea, select'))) return
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    if (key === 'm') {
      menu.toggle()
      return
    }
    if (key === 'Escape') {
      menu.close()
      return
    }
    if (key === 's') {
      toggleSound()
      return
    }
    if (key === ' ' || key === 'Enter') {
      if (t instanceof Node && ui.contains(t)) return
      e.preventDefault()
      if (!e.repeat) pressShake()
      return
    }
    const by = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0
    if (by !== 0) {
      e.preventDefault()
      if (!e.repeat) step(by)
    }
  }

  const onClick = (e: MouseEvent): void => {
    const a = document.activeElement
    if (e.detail > 0 && a instanceof HTMLElement && ui.contains(a)) a.blur()
  }

  const onPulseEnd = (e: AnimationEvent): void => {
    if (e.target === shake && e.pseudoElement === '::after') endPulse()
  }

  const onHint = (): void => {
    if (shown) pulse()
  }

  const fontSettled = (): void => {
    window.clearTimeout(fontTimer)
    if (fontReady) return
    fontReady = true
    paint()
  }

  shake.addEventListener('click', pressShake)
  shake.addEventListener('animationend', onPulseEnd)
  markOf.forEach((b, i) => b.addEventListener('click', () => go(seasons[i])))
  sound.addEventListener('click', toggleSound)
  ui.addEventListener('click', onClick)
  root.addEventListener('hint', onHint)
  window.addEventListener('pointermove', onMove, { capture: true, passive: true })
  window.addEventListener('pointerdown', onInput, { capture: true, passive: true })
  window.addEventListener('wheel', onMove, { capture: true, passive: true })
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', armHint)
  const unsubscribe = bridge.subscribe(onState)

  const font = `${getComputedStyle(shake).fontWeight} ${getComputedStyle(shake).fontSize} ${getComputedStyle(ui).fontFamily}`
  if (!document.fonts || document.fonts.check(font, copy.shake.word)) fontSettled()
  else {
    fontTimer = window.setTimeout(fontSettled, timing.fontWaitSeconds * 1000)
    document.fonts.load(font, copy.shake.word).then(fontSettled, fontSettled)
  }
  paint()

  return {
    setVisible(next: boolean): void {
      visible = next
      root.hidden = !next
      if (next) {
        moved = false
        undim()
      } else menu.close()
      paint()
    },
    dispose(): void {
      unsubscribe()
      for (const t of [latchTimer, hintTimer, idleTimer, fontTimer]) window.clearTimeout(t)
      root.removeEventListener('hint', onHint)
      window.removeEventListener('pointermove', onMove, { capture: true })
      window.removeEventListener('pointerdown', onInput, { capture: true })
      window.removeEventListener('wheel', onMove, { capture: true })
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', armHint)
      delete root.dataset.interface
      ui.remove()
    },
  }
}
