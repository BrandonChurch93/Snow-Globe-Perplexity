import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Budget = {
  runHours: number
  phaseHours: Record<string, number>
  afterReviewHours: number
  reserveHours: Record<string, number>
  reviewRoundHours: number
  continueHours: number
  statusMaxGapMinutes: number
}

type Config = { budget: Budget }

type Segment = {
  kind: 'run' | 'afterReview'
  allowedHours: number
  boxes: Record<string, number>
  used: number
  phaseUsed: Record<string, number>
  continuation: number
}

type Side = { used: number; allowedHours: number }

type Clock = {
  bootId: string | null
  last: number | null
  sinceStatus: number
  segment: Segment | null
  totals: { run: number; afterReview: number; reviewRounds: number; extensions: number }
  phaseTotals: Record<string, number>
  reviewApproved: boolean
  continuations: number
  reviewRounds: Record<string, Side>
  extensions: Record<string, Side>
  ticks: number
  lastReport: string[]
}

type TickArgs = { phase: number; now: number; boot: string; status?: boolean }
type SideArgs = { n: number; now: number; boot: string; status?: boolean }
type ContinueArgs = { n: number; now: number; boot: string; donePhases: number[] }

type Core = {
  emptyClock(): Clock
  applyStart(state: Clock, cfg: Config, now: number, boot: string): Clock
  applyTick(state: Clock, cfg: Config, args: TickArgs): number
  applyReview(state: Clock, cfg: Config, now: number, boot: string): boolean
  applyContinue(state: Clock, cfg: Config, args: ContinueArgs): Record<string, number>
  applyReviewRoundTick(state: Clock, cfg: Config, args: SideArgs): number
  phaseReport(state: Clock, cfg: Config, phase: number, dt?: number): string[]
  sideReport(state: Clock, cfg: Config, kind: string, n: number, dt?: number): string[]
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const corePath = pathToFileURL(path.join(ROOT, 'tools', 'lib', 'clock-core.mjs')).href
const core = (await import(corePath)) as Core
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'showcase.json'), 'utf8')) as Config
const budget = cfg.budget

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const HOUR_S = HOUR / SECOND

const runPhases = Object.keys(budget.phaseHours).map(Number).sort((a, b) => a - b)
const firstPhase = need(runPhases[0])
const secondPhase = need(runPhases[1])
const lastRunPhase = need(runPhases[runPhases.length - 1])
const finalPhase = lastRunPhase + 1
const donePhases = runPhases.slice(0, Math.floor(runPhases.length / 2))
const openPhases = runPhases.filter((p) => donePhases.includes(p) === false)
const firstOpenPhase = need(openPhases[0])

function need<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('missing value')
  return value
}

const box = (phase: number): number => need(budget.phaseHours[String(phase)])
const reserve = (phase: number): number => need(budget.reserveHours[String(phase)])
const seg = (state: Clock): Segment => need(state.segment)
const line = (lines: string[], prefix: string): string => need(lines.find((l) => l.startsWith(prefix)))

function session(config: Config = cfg) {
  const state = core.emptyClock()
  let now = Date.UTC(2026, 0, 1)
  let boot = 'boot-a'
  let boots = 0
  const api = {
    state,
    wait(ms: number) {
      now += ms
      return api
    },
    reboot() {
      boots += 1
      boot = `boot-${boots}`
      return api
    },
    start() {
      core.applyStart(state, config, now, boot)
      return api
    },
    tick(phase: number, status = false): number {
      return core.applyTick(state, config, { phase, now, boot, status })
    },
    report(phase: number, status = false): string[] {
      const dt = api.tick(phase, status)
      return core.phaseReport(state, config, phase, dt)
    },
    review(): boolean {
      return core.applyReview(state, config, now, boot)
    },
    proceed(n: number, done: number[]): Record<string, number> {
      return core.applyContinue(state, config, { n, now, boot, donePhases: done })
    },
    round(n: number, status = false): number {
      return core.applyReviewRoundTick(state, config, { n, now, boot, status })
    },
    roundReport(n: number, status = false): string[] {
      const dt = api.round(n, status)
      return core.sideReport(state, config, 'review round', n, dt)
    },
  }
  return api
}

const beforeReview = (config: Config = cfg) => session(config).start()

function afterReview(config: Config = cfg) {
  const s = session(config).start()
  s.review()
  return s
}

describe('--start', () => {
  it('adds nothing to a new clock', () => {
    const s = beforeReview()
    expect(s.state.totals).toEqual({ run: 0, afterReview: 0, reviewRounds: 0, extensions: 0 })
    expect(s.state.phaseTotals).toEqual({})
    expect(seg(s.state).used).toBe(0)
    expect(seg(s.state).phaseUsed).toEqual({})
    expect(s.state.sinceStatus).toBe(0)
  })

  it('adds nothing when time has passed since the last tick', () => {
    const s = beforeReview()
    s.wait(HOUR).tick(firstPhase)
    const before = structuredClone(s.state)
    s.wait(5 * HOUR).start()
    expect(s.state.totals).toEqual(before.totals)
    expect(s.state.phaseTotals).toEqual(before.phaseTotals)
    expect(seg(s.state)).toEqual(before.segment)
    expect(s.state.sinceStatus).toBe(before.sinceStatus)
  })

  it('makes the next tick count from the start', () => {
    const s = beforeReview()
    s.wait(HOUR).tick(firstPhase)
    s.wait(5 * HOUR).start()
    expect(s.wait(20 * MINUTE).tick(firstPhase)).toBe((20 * MINUTE) / SECOND)
    expect(s.state.totals.run).toBe((HOUR + 20 * MINUTE) / SECOND)
  })
})

describe('a tick on a new machine boot', () => {
  it('adds nothing', () => {
    const s = beforeReview()
    s.wait(HOUR).tick(firstPhase)
    const before = structuredClone(s.state)
    const dt = s.wait(9 * HOUR).reboot().tick(firstPhase)
    expect(dt).toBe(0)
    expect(s.state.totals).toEqual(before.totals)
    expect(s.state.phaseTotals).toEqual(before.phaseTotals)
    expect(seg(s.state).used).toBe(need(before.segment).used)
    expect(s.state.sinceStatus).toBe(before.sinceStatus)
  })

  it('adds nothing after the review either', () => {
    const s = afterReview()
    s.wait(HOUR).tick(finalPhase)
    expect(s.wait(9 * HOUR).reboot().tick(finalPhase)).toBe(0)
    expect(s.state.totals.afterReview).toBe(HOUR_S)
  })

  it('makes the next tick on that boot count from it', () => {
    const s = beforeReview()
    s.wait(HOUR).tick(firstPhase)
    s.wait(9 * HOUR).reboot().tick(firstPhase)
    expect(s.wait(40 * MINUTE).tick(firstPhase)).toBe((40 * MINUTE) / SECOND)
    expect(s.state.totals.run).toBe((HOUR + 40 * MINUTE) / SECOND)
  })
})

describe('every other gap', () => {
  it.each([
    ['one second', SECOND],
    ['seven minutes', 7 * MINUTE],
    ['three hours', 3 * HOUR],
    ['fifty hours', 50 * HOUR],
  ])('of %s is counted in full', (_name, gap) => {
    const s = beforeReview()
    const dt = s.wait(gap).tick(firstPhase)
    expect(dt).toBe(gap / SECOND)
    expect(seg(s.state).used).toBe(gap / SECOND)
    expect(seg(s.state).phaseUsed[String(firstPhase)]).toBe(gap / SECOND)
    expect(s.state.totals.run).toBe(gap / SECOND)
    expect(s.state.phaseTotals[String(firstPhase)]).toBe(gap / SECOND)
    expect(s.state.sinceStatus).toBe(gap / SECOND)
  })

  it('goes to the phase named in the tick and to the allowance in force', () => {
    const s = beforeReview()
    s.wait(HOUR).tick(firstPhase)
    s.wait(2 * HOUR).tick(secondPhase)
    s.wait(3 * HOUR).tick(firstPhase)
    expect(seg(s.state).phaseUsed).toEqual({ [String(firstPhase)]: 4 * HOUR_S, [String(secondPhase)]: 2 * HOUR_S })
    expect(seg(s.state).used).toBe(6 * HOUR_S)
    expect(s.state.totals.run).toBe(6 * HOUR_S)
    expect(s.state.totals.afterReview).toBe(0)
  })

  it('is counted in full on a status tick', () => {
    const s = beforeReview()
    expect(s.wait(2 * HOUR).tick(firstPhase, true)).toBe(2 * HOUR_S)
    expect(seg(s.state).used).toBe(2 * HOUR_S)
  })

  it('is counted in full after the review', () => {
    const s = afterReview()
    expect(s.wait(3 * HOUR).tick(finalPhase)).toBe(3 * HOUR_S)
    expect(s.state.totals.afterReview).toBe(3 * HOUR_S)
    expect(s.state.totals.run).toBe(0)
  })
})

describe('--review', () => {
  it('starts the second allowance from zero with Phase 6 holding all of it', () => {
    const s = beforeReview()
    s.wait(5 * HOUR).tick(lastRunPhase)
    expect(s.wait(HOUR).review()).toBe(true)
    expect(s.state.reviewApproved).toBe(true)
    expect(seg(s.state)).toEqual({
      kind: 'afterReview',
      allowedHours: budget.afterReviewHours,
      boxes: { [String(finalPhase)]: budget.afterReviewHours },
      used: 0,
      phaseUsed: {},
      continuation: 0,
    })
    expect(s.state.totals.run).toBe(5 * HOUR_S)
    expect(s.state.totals.afterReview).toBe(0)
  })

  it('counts later ticks from the approval under the second allowance', () => {
    const s = beforeReview()
    s.wait(5 * HOUR).tick(lastRunPhase)
    s.wait(4 * HOUR).review()
    const lines = s.wait(HOUR).report(finalPhase)
    expect(seg(s.state).used).toBe(HOUR_S)
    expect(s.state.totals.afterReview).toBe(HOUR_S)
    expect(s.state.totals.run).toBe(5 * HOUR_S)
    expect(line(lines, 'allowance')).toBe(
      `allowance (after the review): 1.00 h used of ${budget.afterReviewHours.toFixed(2)} h allowed`,
    )
  })

  it('changes nothing the second time', () => {
    const s = afterReview()
    s.wait(2 * HOUR).tick(finalPhase)
    const before = structuredClone(s.state)
    expect(s.wait(3 * HOUR).reboot().review()).toBe(false)
    expect(s.state).toEqual(before)
  })
})

describe('a review round', () => {
  it('opens with its own hours and no time', () => {
    const s = beforeReview()
    s.wait(HOUR).tick(lastRunPhase)
    expect(s.wait(2 * HOUR).round(1)).toBe(0)
    expect(s.state.reviewRounds).toEqual({ 1: { used: 0, allowedHours: budget.reviewRoundHours } })
    expect(s.state.totals.reviewRounds).toBe(0)
  })

  it.each([
    ['before the review', beforeReview, lastRunPhase],
    ['after the review', afterReview, finalPhase],
  ])('touches neither allowance %s', (_name, make, phase) => {
    const s = make()
    s.wait(HOUR).tick(phase)
    const before = structuredClone(s.state)
    s.wait(HOUR).round(1)
    expect(s.wait(2 * HOUR).round(1)).toBe(2 * HOUR_S)
    expect(s.wait(30 * MINUTE).round(1)).toBe((30 * MINUTE) / SECOND)
    expect(need(s.state.reviewRounds['1']).used).toBe(2.5 * HOUR_S)
    expect(s.state.totals.reviewRounds).toBe(2.5 * HOUR_S)
    expect(s.state.totals.run).toBe(before.totals.run)
    expect(s.state.totals.afterReview).toBe(before.totals.afterReview)
    expect(s.state.phaseTotals).toEqual(before.phaseTotals)
    expect(seg(s.state)).toEqual(before.segment)
  })

  it('is not swept into the allowance by the next phase tick', () => {
    const s = beforeReview()
    s.wait(HOUR).tick(lastRunPhase)
    s.wait(HOUR).round(1)
    s.wait(2 * HOUR).round(1)
    expect(s.wait(30 * MINUTE).tick(lastRunPhase)).toBe((30 * MINUTE) / SECOND)
    expect(seg(s.state).used).toBe(1.5 * HOUR_S)
    expect(s.state.totals.run).toBe(1.5 * HOUR_S)
    expect(s.state.totals.reviewRounds).toBe(2 * HOUR_S)
  })

  it('keeps each round apart from the others', () => {
    const s = beforeReview()
    s.round(1)
    s.wait(HOUR).round(1)
    s.wait(HOUR).round(2)
    s.wait(2 * HOUR).round(2)
    expect(need(s.state.reviewRounds['1']).used).toBe(HOUR_S)
    expect(need(s.state.reviewRounds['2']).used).toBe(2 * HOUR_S)
    expect(seg(s.state).used).toBe(0)
  })
})

describe('the reserve', () => {
  const withoutReserve: Config = { ...cfg, budget: { ...budget, reserveHours: {} } }
  const phase5Moment = (budget.runHours - reserve(lastRunPhase)) * HOUR
  const phase6Moment = (budget.afterReviewHours - reserve(finalPhase)) * HOUR

  it('keeps extra rounds in Phase 5 while the time left is not under the reserve', () => {
    const lines = beforeReview().wait(phase5Moment).report(lastRunPhase)
    expect(line(lines, 'extra rounds')).toBe('extra rounds: yes')
  })

  it('stops extra rounds in Phase 5 once the time left is under the reserve', () => {
    const lines = beforeReview().wait(phase5Moment + SECOND).report(lastRunPhase)
    expect(line(lines, 'extra rounds')).toBe('extra rounds: no')
    expect(line(lines, 'budget report')).toBe('budget report: not due')
    const free = beforeReview(withoutReserve).wait(phase5Moment + SECOND).report(lastRunPhase)
    expect(line(free, 'extra rounds')).toBe('extra rounds: yes')
  })

  it('keeps extra rounds in Phase 6 while the time left is not under the reserve', () => {
    const lines = afterReview().wait(phase6Moment).report(finalPhase)
    expect(line(lines, 'extra rounds')).toBe('extra rounds: yes')
  })

  it('stops extra rounds in Phase 6 once the time left is under the reserve', () => {
    const lines = afterReview().wait(phase6Moment + SECOND).report(finalPhase)
    expect(line(lines, 'extra rounds')).toBe('extra rounds: no')
    expect(line(lines, 'budget report')).toBe('budget report: not due')
    const free = afterReview(withoutReserve).wait(phase6Moment + SECOND).report(finalPhase)
    expect(line(free, 'extra rounds')).toBe('extra rounds: yes')
  })

  it('is measured against the hours of a continuation', () => {
    const run = beforeReview()
    run.proceed(1, [])
    const runMoment = (budget.continueHours - reserve(lastRunPhase)) * HOUR
    expect(line(run.wait(runMoment).report(lastRunPhase), 'extra rounds')).toBe('extra rounds: yes')
    expect(line(run.wait(SECOND).report(lastRunPhase), 'extra rounds')).toBe('extra rounds: no')

    const late = afterReview()
    late.proceed(1, runPhases)
    const lateMoment = (budget.continueHours - reserve(finalPhase)) * HOUR
    expect(line(late.wait(lateMoment).report(finalPhase), 'extra rounds')).toBe('extra rounds: yes')
    expect(line(late.wait(SECOND).report(finalPhase), 'extra rounds')).toBe('extra rounds: no')
  })
})

describe('--continue', () => {
  const openSum = openPhases.reduce((a, p) => a + box(p), 0)

  it('gives each unfinished phase before the review a share of the new hours', () => {
    const s = beforeReview()
    s.wait(budget.runHours * HOUR).tick(firstOpenPhase)
    const boxes = s.wait(HOUR).proceed(1, donePhases)
    expect(Object.keys(boxes).map(Number)).toEqual(openPhases)
    for (const p of openPhases) {
      expect(need(boxes[String(p)])).toBeCloseTo((budget.continueHours * box(p)) / openSum, 9)
    }
    expect(Object.values(boxes).reduce((a, h) => a + h, 0)).toBeCloseTo(budget.continueHours, 9)
  })

  it('counts the new boxes from zero and keeps the totals', () => {
    const s = beforeReview()
    s.wait(budget.runHours * HOUR).tick(firstOpenPhase)
    const boxes = s.wait(HOUR).proceed(1, donePhases)
    expect(seg(s.state)).toEqual({
      kind: 'run',
      allowedHours: budget.continueHours,
      boxes,
      used: 0,
      phaseUsed: {},
      continuation: 1,
    })
    expect(s.state.continuations).toBe(1)
    expect(s.state.totals.run).toBe(budget.runHours * HOUR_S)
    expect(s.wait(HOUR).tick(firstOpenPhase)).toBe(HOUR_S)
    expect(seg(s.state).used).toBe(HOUR_S)
  })

  it('measures the printed lines against the new boxes', () => {
    const s = beforeReview()
    const first = s.wait(budget.runHours * HOUR).report(firstOpenPhase)
    expect(line(first, 'budget report')).toBe('budget report: due')
    expect(line(first, 'box end')).toBe('box end: reached')
    const boxes = s.proceed(1, donePhases)
    const half = Math.round((need(boxes[String(firstOpenPhase)]) * HOUR) / 2)
    const early = s.wait(half - SECOND).report(firstOpenPhase)
    expect(line(early, 'budget report')).toBe('budget report: not due')
    expect(line(early, 'extra rounds')).toBe('extra rounds: yes')
    expect(line(early, 'half point')).toBe('half point: not reached')
    expect(line(early, 'box end')).toBe('box end: not reached')
    expect(line(early, 'allowance')).toContain('continuation 1')
    const later = s.wait(2 * SECOND).report(firstOpenPhase)
    expect(line(later, 'half point')).toBe('half point: reached')
    expect(line(later, 'box end')).toBe('box end: not reached')
    const end = s.wait(budget.continueHours * HOUR).report(firstOpenPhase)
    expect(line(end, 'budget report')).toBe('budget report: due')
  })

  it('gives Phase 6 all of the new hours after the review', () => {
    const s = afterReview()
    s.wait(budget.afterReviewHours * HOUR).tick(finalPhase)
    const boxes = s.proceed(1, runPhases)
    expect(boxes).toEqual({ [String(finalPhase)]: budget.continueHours })
    expect(seg(s.state)).toEqual({
      kind: 'afterReview',
      allowedHours: budget.continueHours,
      boxes,
      used: 0,
      phaseUsed: {},
      continuation: 1,
    })
    expect(s.state.totals.afterReview).toBe(budget.afterReviewHours * HOUR_S)
  })

  it('gives new boxes again on the next continuation', () => {
    const s = beforeReview()
    s.proceed(1, donePhases)
    s.wait(budget.continueHours * HOUR).tick(firstOpenPhase)
    const boxes = s.proceed(2, [...donePhases, firstOpenPhase])
    expect(Object.keys(boxes).map(Number)).toEqual(openPhases.slice(1))
    expect(Object.values(boxes).reduce((a, h) => a + h, 0)).toBeCloseTo(budget.continueHours, 9)
    expect(seg(s.state).used).toBe(0)
    expect(seg(s.state).continuation).toBe(2)
  })

  it('refuses a number that does not follow the last one', () => {
    const s = beforeReview()
    expect(() => s.proceed(2, donePhases)).toThrow()
    expect(s.state.continuations).toBe(0)
  })
})

describe('the printed lines', () => {
  it('switch extra rounds to no when the time used reaches the boxes up to this phase', () => {
    const s = beforeReview()
    const early = s.wait(box(firstPhase) * HOUR - SECOND).report(firstPhase)
    expect(line(early, 'extra rounds')).toBe('extra rounds: yes')
    const late = s.wait(SECOND).report(firstPhase)
    expect(line(late, 'extra rounds')).toBe('extra rounds: no')
    expect(line(s.report(secondPhase), 'extra rounds')).toBe('extra rounds: yes')
  })

  it('pass unused time forward to the extra rounds of the next phase', () => {
    const s = beforeReview()
    s.wait((box(firstPhase) * HOUR) / 2).tick(firstPhase)
    const left = (box(firstPhase) * HOUR) / 2 + box(secondPhase) * HOUR
    expect(line(s.wait(left - SECOND).report(secondPhase), 'extra rounds')).toBe('extra rounds: yes')
    expect(line(s.wait(SECOND).report(secondPhase), 'extra rounds')).toBe('extra rounds: no')
  })

  it('let an overrun eat the extra rounds of the next phase', () => {
    const s = beforeReview()
    s.wait((box(firstPhase) + box(secondPhase)) * HOUR).tick(firstPhase)
    const lines = s.report(secondPhase)
    expect(line(lines, 'extra rounds')).toBe('extra rounds: no')
    expect(line(lines, 'half point')).toBe('half point: not reached')
    expect(line(lines, 'box end')).toBe('box end: not reached')
  })

  it('switch the half point when the phase has used half of its own box', () => {
    const s = beforeReview()
    s.wait(box(firstPhase) * HOUR).tick(firstPhase)
    const half = (box(secondPhase) * HOUR) / 2
    expect(line(s.wait(half - SECOND).report(secondPhase), 'half point')).toBe('half point: not reached')
    const lines = s.wait(SECOND).report(secondPhase)
    expect(line(lines, 'half point')).toBe('half point: reached')
    expect(line(lines, 'box end')).toBe('box end: not reached')
  })

  it('switch the box end when the phase has used all of its own box', () => {
    const s = beforeReview()
    s.wait(box(firstPhase) * HOUR).tick(firstPhase)
    expect(line(s.wait(box(secondPhase) * HOUR - SECOND).report(secondPhase), 'box end')).toBe('box end: not reached')
    expect(line(s.wait(SECOND).report(secondPhase), 'box end')).toBe('box end: reached')
  })

  it('switch the budget report when the time used reaches the first allowance', () => {
    const s = beforeReview()
    const early = s.wait(budget.runHours * HOUR - SECOND).report(lastRunPhase)
    expect(line(early, 'budget report')).toBe('budget report: not due')
    const late = s.wait(SECOND).report(lastRunPhase)
    expect(line(late, 'budget report')).toBe('budget report: due')
    expect(line(late, 'extra rounds')).toBe('extra rounds: no')
  })

  it('switch the budget report when the time used reaches the second allowance', () => {
    const s = afterReview()
    const early = s.wait(budget.afterReviewHours * HOUR - SECOND).report(finalPhase)
    expect(line(early, 'budget report')).toBe('budget report: not due')
    expect(line(early, 'box end')).toBe('box end: not reached')
    const late = s.wait(SECOND).report(finalPhase)
    expect(line(late, 'budget report')).toBe('budget report: due')
    expect(line(late, 'box end')).toBe('box end: reached')
  })

  it('switch to status overdue once the gap passes the limit', () => {
    const s = beforeReview()
    const atLimit = s.wait(budget.statusMaxGapMinutes * MINUTE).report(firstPhase)
    expect(line(atLimit, 'minutes since')).toBe(`minutes since the last status: ${budget.statusMaxGapMinutes}`)
    const past = s.wait(SECOND).report(firstPhase)
    expect(line(past, 'minutes since')).toBe(
      `minutes since the last status: ${budget.statusMaxGapMinutes}, status overdue`,
    )
    const cleared = s.wait(MINUTE).report(firstPhase, true)
    expect(line(cleared, 'minutes since')).toBe('minutes since the last status: 0')
  })

  it('switch extra rounds in a review round once its hours are used and never print a budget report', () => {
    const s = beforeReview()
    s.round(1)
    const early = s.wait(budget.reviewRoundHours * HOUR - SECOND).roundReport(1, true)
    expect(line(early, 'extra rounds')).toBe('extra rounds: yes')
    const late = s.wait(SECOND).roundReport(1)
    expect(line(late, 'extra rounds')).toBe('extra rounds: no')
    const over = s.wait(budget.runHours * HOUR).roundReport(1)
    expect(line(over, 'extra rounds')).toBe('extra rounds: no')
    expect(line(over, 'minutes since')).toMatch(/, status overdue$/)
    for (const lines of [early, late, over]) {
      expect(lines.some((l) => l.includes('budget report'))).toBe(false)
    }
  })
})

describe('the command line on a copy in the temp folder', () => {
  let dir = ''
  const clockFile = () => path.join(dir, 'kit', 'CLOCK.json')
  const read = (): Clock => JSON.parse(fs.readFileSync(clockFile(), 'utf8')) as Clock
  const write = (state: Clock) => fs.writeFileSync(clockFile(), JSON.stringify(state))
  const run = (...args: string[]): string =>
    execFileSync(process.execPath, [path.join(dir, 'tools', 'clock.mjs'), ...args], { cwd: dir, encoding: 'utf8' })

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clock-test-'))
    fs.cpSync(path.join(ROOT, 'tools'), path.join(dir, 'tools'), { recursive: true })
    fs.cpSync(path.join(ROOT, 'config'), path.join(dir, 'config'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'kit'))
    const rows = [...runPhases, finalPhase].map(
      (p) => `| ${p} · Phase ${p} | ${donePhases.includes(p) ? 'done' : 'in progress'} | | | |`,
    )
    const progress = ['# Progress', '', '## Clock', '', 'none', '', '## Phases', '', '| Phase | State | Started | Ended | Gate evidence |', '| --- | --- | --- | --- | --- |', ...rows, '']
    fs.writeFileSync(path.join(dir, 'kit', 'PROGRESS.md'), progress.join('\n'))
  })

  afterAll(() => {
    if (dir.startsWith(os.tmpdir())) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('adds nothing on --start', () => {
    const out = run('--start')
    expect(out).toContain('No time added.')
    expect(read().totals).toEqual({ run: 0, afterReview: 0, reviewRounds: 0, extensions: 0 })
  })

  it('counts a gap on the same boot in full', () => {
    const state = read()
    state.last = need(state.last) - 2 * HOUR
    write(state)
    run('--phase', String(firstOpenPhase))
    const used = read().totals.run
    expect(used).toBeGreaterThanOrEqual(2 * HOUR_S)
    expect(used).toBeLessThan(2 * HOUR_S + 60)
  })

  it('adds nothing on a tick after a new boot', () => {
    const state = read()
    state.last = need(state.last) - 2 * HOUR
    state.bootId = 'another-boot'
    write(state)
    const out = run('--phase', String(firstOpenPhase))
    expect(out).toContain('tick of 0.0 minutes')
    expect(read().totals.run).toBe(state.totals.run)
    expect(read().bootId).not.toBe('another-boot')
  })

  it('gives the unfinished phases new boxes on --continue', () => {
    const out = run('--continue', '1')
    expect(out).toContain('clock: continuation 1.')
    const boxes = need(read().segment).boxes
    expect(Object.keys(boxes).map(Number)).toEqual(openPhases)
    expect(Object.values(boxes).reduce((a, h) => a + h, 0)).toBeCloseTo(budget.continueHours, 9)
  })

  it('starts the second allowance on --review and changes nothing the second time', () => {
    expect(run('--review')).toContain(`${budget.afterReviewHours} h, counted from zero`)
    const first = read()
    expect(need(first.segment).kind).toBe('afterReview')
    expect(need(first.segment).allowedHours).toBe(budget.afterReviewHours)
    expect(run('--review')).toContain('Nothing changed.')
    const second = read()
    expect({ ...second, lastReport: [] }).toEqual({ ...first, lastReport: [] })
  })
})
