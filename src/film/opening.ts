import { config } from '../config'

export interface OpeningPlan {
  fps: number
  frameCount: number
  seconds: number
  typing: { first: number; last: number }
  reasoning: { first: number; open: number; choose: number; last: number }
  send: number
  build: { first: number; last: number }
  steps: number[]
  keyTaps: number[]
  pointer: { enter: number; atControl: number; toLevel: number; atLevel: number; gone: number; toSend: number; atSend: number }
  menu: { full: number; fade: number; gone: number }
  lastDone: number
  pacing: { toControl: number; rest: number; menuIn: number; read: number; toLevel: number; settle: number; menuOut: number; pointerOut: number; beat: number }
}

export const PAUSES = {
  lead: 0.4,
  toControl: 0.55,
  rest: 0.12,
  menuIn: 0.2,
  read: 0.12,
  toLevel: 0.35,
  settle: 0.2,
  menuOut: 0.16,
  pointerOut: 0.18,
  beat: 0.25,
  restOnSend: 0.22,
  sendPress: 0.65,
  beforeFirstStep: 0.6,
  doneBeforeCut: 0.4,
}

export function openingPlan(fps: number = config.film.fps): OpeningPlan {
  const i = config.intro
  const p = PAUSES
  const typing = i.prompt.length / i.charsPerSecond
  const change = p.toControl + p.rest + p.menuIn + p.read + p.toLevel + p.rest + p.settle + p.pointerOut + p.beat
  const fixed = change + typing + p.sendPress + (i.steps.length - 1) * i.stepSeconds
  const soft = p.lead + i.pauseBeforeSendSeconds + p.beforeFirstStep + i.holdSeconds
  const k = Math.min(1, Math.max(0, (i.maxSeconds - fixed) / soft))
  const f = (s: number) => Math.round(s * fps)
  const from = (s: number) => Math.ceil(s * fps - 1e-6)

  const enter = f(p.lead * k) / fps
  const arrive = enter + p.toControl
  const open = arrive + p.rest
  const full = open + p.menuIn
  const leave = full + p.read
  const onLevel = leave + p.toLevel
  const choose = onLevel + p.rest
  const close = choose + p.settle
  const menuGone = close + p.menuOut
  const gone = close + p.pointerOut

  const typingFirst = from(gone + p.beat)
  let t = typingFirst / fps
  const keyTaps: number[] = []
  for (let c = 0; c < i.prompt.length; c++) keyTaps.push(f(t + c / i.charsPerSecond))
  t += typing
  const toSend = f(t)
  t += i.pauseBeforeSendSeconds * k
  const send = f(t)
  const atSend = f(t - Math.min(p.restOnSend, i.pauseBeforeSendSeconds * k * 0.5))
  t += p.sendPress
  const buildFirst = f(t)
  t += p.beforeFirstStep * k
  const steps = i.steps.map((_, n) => f(t + n * i.stepSeconds))
  t += (i.steps.length - 1) * i.stepSeconds + i.holdSeconds * k
  const frameCount = f(t)
  return {
    fps,
    frameCount,
    seconds: frameCount / fps,
    typing: { first: typingFirst, last: toSend - 1 },
    reasoning: { first: from(enter), open: from(open), choose: from(choose), last: from(gone) - 1 },
    send,
    build: { first: buildFirst, last: frameCount - 1 },
    steps,
    keyTaps,
    pointer: { enter: from(enter), atControl: from(arrive), toLevel: from(leave), atLevel: from(onLevel), gone: from(gone), toSend, atSend },
    menu: { full: from(full), fade: from(close), gone: from(menuGone) },
    lastDone: f(t - p.doneBeforeCut * k),
    pacing: { toControl: p.toControl, rest: p.rest, menuIn: p.menuIn, read: p.read, toLevel: p.toLevel, settle: p.settle, menuOut: p.menuOut, pointerOut: p.pointerOut, beat: p.beat },
  }
}
