import { config } from '../config'
import { copy, timing } from '../copy'
import type { AppBridge, AppState, InterfaceHandle } from '../core/bridge'
import { seasonGlyphs, shakeGlyph, soundGlyph } from './glyphs'
import { mountMenu } from './menu'
import './face.css'
import s from './ui.module.css'

const PROBE_PX = 16

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = className
  return e
}

function button(className: string, control: string, glyph: string, disc = ''): HTMLButtonElement {
  const b = make('button', className)
  b.type = 'button'
  b.dataset.control = control
  b.innerHTML = (disc ? `<span class="${disc}" aria-hidden="true"></span>` : '') + glyph
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

  const veil = make('canvas', s.veil)
  veil.hidden = true
  veil.setAttribute('aria-hidden', 'true')
  const pen = veil.getContext('2d', { alpha: false })

  const bar = make('div', s.bar)
  bar.hidden = true

  const shake = button(s.shake, 'shake', shakeGlyph(s.globe, s.arcs))
  const word = make('span', s.word)
  word.textContent = copy.shake.word
  shake.append(word, named(` ${copy.shake.rest}`))
  const globe = shake.getElementsByClassName(s.globe)[0] ?? null

  const marks = make('div', s.marks)
  marks.setAttribute('role', 'group')
  marks.setAttribute('aria-label', copy.seasons.group)
  const markOf = seasons.map((id, i) => {
    const b = button(s.mark, 'season', seasonGlyphs[i % seasonGlyphs.length], s.disc)
    b.dataset.season = id
    b.append(named(copy.seasons.name(id)))
    marks.append(b)
    return b
  })

  const sound = button(s.sound, 'sound', soundGlyph(s.waves, s.cross), s.disc)
  sound.append(named(copy.sound.name))

  const live = make('div', s.hidden)
  live.setAttribute('role', 'status')

  bar.append(marks, shake, sound)
  ui.append(veil, bar, live)
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
  let said = state.season
  let watching = 0
  let kept = false
  let fade: Animation | null = null

  const still = (): boolean => state.reducedMotion || reduce.matches

  // The arrival is played once by the script when the controls come, and no style rule holds it: a rule would play it again
  // from nothing each time another rule that covered it let go.
  const rise: Keyframe[] = [{ offset: 0, opacity: 0, transform: `translateY(${timing.arriveRisePx}px)` }]
  const arrive = (...parts: readonly Element[]): void => {
    if (still()) return
    for (const el of parts) el.animate(rise, { duration: timing.arriveSeconds * 1000, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' })
  }
  const arriveShade = (): void => {
    if (!still()) bar.animate([{ offset: 0, opacity: 0 }], { duration: timing.arriveSeconds * 1000, easing: 'ease-out', pseudoElement: '::before' })
  }

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

  // With reduced motion the season changes whole in one frame of the picture. The frame before it is kept here and faded out
  // over the new one: a dissolve of two whole pictures, at the screen's own rate however slowly the picture is drawn.
  const picture = (): HTMLCanvasElement | null => root.parentElement?.querySelector<HTMLCanvasElement>(':scope > canvas') ?? null

  const unveil = (): void => {
    const f = fade
    fade = null
    f?.cancel()
    veil.hidden = true
    veil.width = 0
    veil.height = 0
  }

  const unwatch = (): void => {
    window.cancelAnimationFrame(watching)
    watching = 0
    kept = false
  }

  // Asked for outside the picture's own frame, this runs after it in the same frame, while what it drew can still be read.
  const watch = (): void => {
    if (!watching) watching = window.requestAnimationFrame(keep)
  }

  const keep = (): void => {
    watching = window.requestAnimationFrame(keep)
    const view = picture()
    if (!view || !pen || view.width < 1 || view.height < 1 || fade) return
    if (veil.width !== view.width || veil.height !== view.height) {
      veil.width = view.width
      veil.height = view.height
    }
    pen.drawImage(view, 0, 0)
    kept = true
  }

  // A picture read too late is one flat black: it is never shown. It is looked at small, on a canvas made for reading,
  // so the kept picture itself stays where the graphics card can fade it.
  const empty = (): boolean => {
    if (veil.width < 1 || veil.height < 1) return true
    const small = document.createElement('canvas')
    small.width = PROBE_PX
    small.height = PROBE_PX
    const look = small.getContext('2d', { alpha: false, willReadFrequently: true })
    if (!look) return true
    look.drawImage(veil, 0, 0, PROBE_PX, PROBE_PX)
    return look.getImageData(0, 0, PROBE_PX, PROBE_PX).data.every((v, i) => i % 4 === 3 || v === 0)
  }

  const dissolve = (): void => {
    const view = picture()
    const had = kept
    unwatch()
    if (!had || !view || !shown || empty()) return
    const at = view.getBoundingClientRect()
    const from = ui.getBoundingClientRect()
    veil.style.left = `${at.left - from.left}px`
    veil.style.top = `${at.top - from.top}px`
    veil.style.width = `${at.width}px`
    veil.style.height = `${at.height}px`
    veil.hidden = false
    const f = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: timing.dissolveSeconds * 1000, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' })
    fade = f
    f.onfinish = () => {
      if (fade === f) unveil()
    }
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
    const calm = still()
    const came = show && !shown
    const soundCame = show && state.soundAvailable && (came || sound.hidden)
    ui.toggleAttribute('data-reduced', state.reducedMotion)
    if (calm) endPulse()
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
    if (held) shake.dataset.rock = ''
    else if (calm || !show) delete shake.dataset.rock
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
    if (came) {
      arrive(marks, shake)
      arriveShade()
    }
    if (soundCame) arrive(sound)
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
    // The season is said when it is there: at the landing, and with reduced motion at the end of the dissolve.
    if (!next.busy && next.season !== said) {
      said = next.season
      if (shown) live.textContent = copy.seasons.name(next.season)
    }
    const calm = next.reducedMotion && next.busy && next.playing === 'live'
    if (calm && next.season !== prev.season) dissolve()
    else if (calm && !fade) watch()
    else if (!calm) unwatch()
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

  const pressed = new Map<HTMLElement, { since: number; timer: number }>()

  const controlOf = (t: EventTarget | null): HTMLElement | null => (t instanceof Element ? t.closest<HTMLElement>('[data-control]') : null)

  const press = (el: HTMLElement, now: number): void => {
    if (el.getAttribute('aria-disabled') === 'true') return
    window.clearTimeout(pressed.get(el)?.timer)
    pressed.set(el, { since: now, timer: 0 })
    el.dataset.press = ''
  }

  const release = (el: HTMLElement, now: number): void => {
    const p = pressed.get(el)
    if (!p) return
    window.clearTimeout(p.timer)
    p.timer = window.setTimeout(() => {
      pressed.delete(el)
      delete el.dataset.press
    }, Math.max(0, timing.pressSeconds * 1000 - (now - p.since)))
  }

  const onPress = (e: PointerEvent): void => {
    const el = controlOf(e.target)
    if (el) press(el, e.timeStamp)
  }

  const onRelease = (e: Event): void => {
    for (const el of pressed.keys()) release(el, e.timeStamp)
  }

  const onClick = (e: MouseEvent): void => {
    const a = document.activeElement
    if (e.detail > 0 && a instanceof HTMLElement && ui.contains(a)) a.blur()
    const el = e.detail === 0 ? controlOf(e.target) : null
    if (el) {
      press(el, e.timeStamp)
      release(el, e.timeStamp)
    }
  }

  const onPulseEnd = (e: AnimationEvent): void => {
    if (e.target === shake && e.pseudoElement === '::after') endPulse()
  }

  // The glyph rocks while a shake plays and comes to rest at the end of a swing, upright, not wherever the landing caught it.
  const onRockTurn = (e: AnimationEvent): void => {
    if (e.target === globe && !state.busy && !latched) delete shake.dataset.rock
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
  shake.addEventListener('animationiteration', onRockTurn)
  shake.addEventListener('animationcancel', onRockTurn)
  reduce.addEventListener('change', paint)
  window.addEventListener('resize', unveil)
  markOf.forEach((b, i) => b.addEventListener('click', () => go(seasons[i])))
  sound.addEventListener('click', toggleSound)
  ui.addEventListener('click', onClick)
  ui.addEventListener('pointerdown', onPress)
  window.addEventListener('pointerup', onRelease, { capture: true, passive: true })
  window.addEventListener('pointercancel', onRelease, { capture: true, passive: true })
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
      } else {
        menu.close()
        unwatch()
        unveil()
      }
      paint()
    },
    dispose(): void {
      unsubscribe()
      for (const t of [latchTimer, hintTimer, idleTimer, fontTimer, ...[...pressed.values()].map((p) => p.timer)]) window.clearTimeout(t)
      window.removeEventListener('pointerup', onRelease, { capture: true })
      window.removeEventListener('pointercancel', onRelease, { capture: true })
      root.removeEventListener('hint', onHint)
      window.removeEventListener('pointermove', onMove, { capture: true })
      window.removeEventListener('pointerdown', onInput, { capture: true })
      window.removeEventListener('wheel', onMove, { capture: true })
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', armHint)
      reduce.removeEventListener('change', paint)
      window.removeEventListener('resize', unveil)
      unwatch()
      unveil()
      delete root.dataset.interface
      ui.remove()
    },
  }
}
