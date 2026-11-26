import { config } from '../config'
import { copy, timing } from '../copy'
import type { ProbeBridge, ProbeLevelResult, ProbeResult } from '../core/bridge'
import '../ui/face.css'
import s from './probe.module.css'

type Running = { level: string; phase: 'rest' | 'storm'; fraction: number } | null

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text) e.textContent = text
  return e
}

const fps = (v: number): string => (Number.isFinite(v) ? v.toFixed(1) : copy.probe.empty)

const floorOf = (level: string): number => {
  const spec = (config.live.quality as Record<string, { minFps: number } | undefined>)[level]
  return spec ? spec.minFps : 0
}

function report(levels: ProbeLevelResult[], result: ProbeResult | null): string {
  const lines = [`${config.name}: ${copy.probe.title.toLowerCase()}`]
  for (const l of levels) lines.push(copy.probe.line(l.level, fps(l.restMedianFps), fps(l.restSlowFps), fps(l.stormMedianFps), fps(l.stormSlowFps)))
  if (result) {
    lines.push(`${copy.probe.graphics.toLowerCase()}: ${result.graphics}`)
    lines.push(`${copy.probe.screen.toLowerCase()}: ${copy.probe.screenAt(result.screen, Number(result.pixelRatio.toFixed(2)))}`)
    lines.push(`${copy.probe.pick.toLowerCase()}: ${result.pick}`)
    lines.push(`${copy.probe.browser.toLowerCase()}: ${result.userAgent}`)
    if (result.glass) lines.push(`${copy.probe.glass.toLowerCase()}: ${result.glass}`)
    if (result.maths.length) lines.push(`${copy.probe.maths.toLowerCase()}: ${result.maths.join('; ')}`)
  }
  return lines.join('\n')
}

export function mountProbe(root: HTMLElement, bridge: ProbeBridge): void {
  const levels = bridge.levels()
  const total = Math.max(levels.length * bridge.secondsPerLevel(), 0)

  const page = make('section', s.page)
  const card = make('div', s.card)
  const title = make('h1', s.title, copy.probe.title)
  title.id = 'probe-title'
  page.setAttribute('aria-labelledby', title.id)
  const status = make('p', s.status, copy.probe.waiting)
  status.setAttribute('role', 'status')
  const left = make('span', s.left)
  const head = make('header', s.head)
  const line = make('div', s.line)
  line.append(status, left)
  head.append(title, line)

  const track = make('div', s.track)
  const fill = make('i', s.fill)
  track.append(fill)

  const table = make('table', s.table)
  const thead = make('thead')
  const groups = make('tr')
  const first = make('th', s.level, copy.probe.level)
  first.rowSpan = 2
  first.scope = 'col'
  groups.append(first)
  for (const name of [copy.probe.rest, copy.probe.storm]) {
    const th = make('th', s.group, name)
    th.colSpan = 2
    th.scope = 'colgroup'
    th.append(make('span', s.unit, copy.probe.unit))
    groups.append(th)
  }
  const subs = make('tr')
  for (let i = 0; i < 2; i++) {
    for (const name of [copy.probe.median, copy.probe.slow]) {
      const th = make('th', s.sub, name)
      th.scope = 'col'
      subs.append(th)
    }
  }
  thead.append(groups, subs)
  const tbody = make('tbody')
  const rows = levels.map((level) => {
    const tr = make('tr', s.row)
    tr.dataset.level = level
    const th = make('th', s.name, level)
    th.scope = 'row'
    const cells = [0, 1, 2, 3].map(() => make('td', s.cell, copy.probe.empty))
    tr.append(th, ...cells)
    tbody.append(tr)
    return { tr, cells }
  })
  table.append(thead, tbody)

  const facts = make('dl', s.facts)
  const fact = (label: string): HTMLElement => {
    const dd = make('dd', s.value, copy.probe.empty)
    facts.append(make('dt', s.term, label), dd)
    return dd
  }
  const graphics = fact(copy.probe.graphics)
  const screen = fact(copy.probe.screen)
  const pick = fact(copy.probe.pick)
  const glass = fact(copy.probe.glass)

  const text = make('pre', s.text)
  text.tabIndex = 0
  text.setAttribute('aria-label', copy.probe.textName)
  const button = make('button', s.copy, copy.probe.copy)
  button.type = 'button'
  const foot = make('div', s.foot)
  foot.append(button)
  const after = [facts, text, button]
  for (const e of after) e.hidden = true

  const scroll = make('div', s.scroll)
  scroll.append(head, track, table, facts, text, foot)
  card.append(scroll)
  page.append(card)
  root.append(page)
  root.dataset.probe = 'running'

  let measured: ProbeLevelResult[] = []
  let copiedTimer = 0
  let reached = 0
  let seenDone = -1
  let seenLevel = ''
  let seenPhase = ''
  let seenStep = -1
  let seenLeft = -1

  const more = (): void => {
    card.toggleAttribute('data-above', scroll.scrollTop > 1)
    card.toggleAttribute('data-more', scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight > 1)
  }

  const fillRows = (done: ProbeLevelResult[], running: Running, picked: string): void => {
    rows.forEach(({ tr, cells }, i) => {
      const r = done.find((d) => d.level === levels[i])
      const values = r ? [r.restMedianFps, r.restSlowFps, r.stormMedianFps, r.stormSlowFps] : null
      cells.forEach((cell, k) => {
        cell.textContent = values ? fps(values[k]) : copy.probe.empty
        cell.toggleAttribute('data-short', values !== null && values[k] < floorOf(levels[i]))
        cell.toggleAttribute('data-now', !values && running !== null && running.level === levels[i] && (running.phase === 'rest') === k < 2)
      })
      tr.toggleAttribute('data-now', running !== null && running.level === levels[i])
      tr.toggleAttribute('data-pick', picked !== '' && picked === levels[i])
    })
  }

  const onProgress = (done: ProbeLevelResult[], running: Running): void => {
    measured = done
    const level = running ? running.level : ''
    const phase = running ? running.phase : ''
    if (done.length !== seenDone || level !== seenLevel || phase !== seenPhase) {
      seenDone = done.length
      seenLevel = level
      seenPhase = phase
      fillRows(done, running, '')
      if (running) status.textContent = copy.probe.measuring(running.level, running.phase)
    }
    const at = running ? Math.max(levels.indexOf(running.level), 0) + Math.min(Math.max(running.fraction, 0), 1) : done.length
    reached = Math.max(reached, levels.length > 0 ? Math.min(at / levels.length, 1) : 1)
    const step = Math.round(reached * timing.lineSteps)
    if (step !== seenStep) {
      seenStep = step
      fill.style.transform = `scaleX(${step / timing.lineSteps})`
    }
    const seconds = running && total > 0 ? Math.max(Math.ceil(total * (1 - reached)), 1) : 0
    if (seconds !== seenLeft) {
      seenLeft = seconds
      left.textContent = seconds > 0 ? copy.probe.left(seconds) : ''
    }
  }

  const finish = (result: ProbeResult | null): void => {
    const done = result ? result.levels : measured
    fillRows(done, null, result ? result.pick : '')
    fill.style.transform = 'scaleX(1)'
    track.toggleAttribute('data-done', true)
    left.textContent = ''
    status.textContent = result ? copy.probe.done : copy.probe.failed
    if (result) {
      graphics.textContent = result.graphics
      screen.textContent = copy.probe.screenAt(result.screen, Number(result.pixelRatio.toFixed(2)))
      pick.textContent = result.pick
      glass.textContent = result.glass || copy.probe.empty
    }
    text.textContent = report(done, result)
    facts.hidden = !result
    text.hidden = false
    button.hidden = false
    root.dataset.probe = result ? 'done' : 'failed'
    more()
  }

  const selectText = (): void => {
    const range = document.createRange()
    range.selectNodeContents(text)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const say = (label: string): void => {
    button.textContent = label
    window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => {
      button.textContent = copy.probe.copy
    }, timing.copiedSeconds * 1000)
  }

  const fallback = (): void => {
    selectText()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    say(ok ? copy.probe.copied : copy.probe.select)
  }

  button.addEventListener('click', () => {
    const value = text.textContent ?? ''
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(() => say(copy.probe.copied), fallback)
    else fallback()
  })

  scroll.addEventListener('scroll', more, { passive: true })
  new ResizeObserver(more).observe(scroll)
  fillRows([], null, '')
  bridge.run(onProgress).then(finish, () => finish(null))
}
