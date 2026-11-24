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
}

const PAUSES = { lead: 0.5, beforeReasoning: 0.35, reasoningOpen: 0.9, afterChoice: 0.3, sendPress: 0.25, beforeFirstStep: 0.6 }

export function openingPlan(fps: number = config.film.fps): OpeningPlan {
  const i = config.intro
  const typing = i.prompt.length / i.charsPerSecond
  const fixed = typing + (i.steps.length - 1) * i.stepSeconds
  const soft = PAUSES.lead + PAUSES.beforeReasoning + PAUSES.reasoningOpen + PAUSES.afterChoice + i.pauseBeforeSendSeconds + PAUSES.sendPress + PAUSES.beforeFirstStep + i.holdSeconds
  const k = Math.min(1, Math.max(0, (i.maxSeconds - fixed) / soft))
  const f = (s: number) => Math.round(s * fps)
  let t = PAUSES.lead * k
  const typingFirst = f(t)
  const keyTaps: number[] = []
  for (let c = 0; c < i.prompt.length; c++) keyTaps.push(f(t + c / i.charsPerSecond))
  t += typing
  const typingLast = f(t) - 1
  const reasoningFirst = f(t)
  t += PAUSES.beforeReasoning * k
  const open = f(t)
  t += PAUSES.reasoningOpen * k
  const choose = f(t)
  t += PAUSES.afterChoice * k
  const reasoningLast = f(t) - 1
  t += i.pauseBeforeSendSeconds * k
  const send = f(t)
  t += PAUSES.sendPress * k
  const buildFirst = f(t)
  t += PAUSES.beforeFirstStep * k
  const steps = i.steps.map((_, n) => f(t + n * i.stepSeconds))
  t += (i.steps.length - 1) * i.stepSeconds + i.holdSeconds * k
  const frameCount = f(t)
  return {
    fps,
    frameCount,
    seconds: frameCount / fps,
    typing: { first: typingFirst, last: typingLast },
    reasoning: { first: reasoningFirst, open, choose, last: reasoningLast },
    send,
    build: { first: buildFirst, last: frameCount - 1 },
    steps,
    keyTaps,
  }
}
