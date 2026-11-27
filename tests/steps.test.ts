import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { LIVE, LiveSession, SeasonLoader, type LiveSim } from '../src/app/session'
import { config } from '../src/config'
import { Governor } from '../src/core/quality'
import { FIT_MS, FramePace, GAPS, Hands, KEEP_MS, LAST_S, LEAST_MS, PACE, PRESS_S, SETTLE_S, SOON_MS, Wish, fitIn, handIn, inPieces, inSteps, leftIn, runFor, seasonsIn, spendIn, spendOf, stepsOf, until, whole, workIn, type InSteps, type Step, type Turn } from '../src/scene/steps'
import { kit as fall } from '../src/seasons/fall'
import { kit as spring } from '../src/seasons/spring'
import * as springGlass from '../src/seasons/spring/glass'
import { kit as summer } from '../src/seasons/summer'
import { kit as winter } from '../src/seasons/winter'
import { rel } from '../tools/lib/paths.mjs'

const said: string[] = []
const making = inSteps(function* (): Generator<void, string[]> {
  const made: string[] = []
  for (const piece of ['walls', 'ground', 'crown']) {
    said.push(piece)
    made.push(piece)
    if (piece !== 'crown') yield
  }
  return made
})

describe('a making in steps', () => {
  it('called as a plain function runs through and gives what it made', () => {
    said.length = 0
    expect(making()).toEqual(['walls', 'ground', 'crown'])
    expect(said).toEqual(['walls', 'ground', 'crown'])
  })

  it('in steps runs the same statements in the same order and stops after each piece', () => {
    said.length = 0
    const steps = making.steps()
    expect(said).toEqual([])
    expect(steps.next().done).toBe(false)
    expect(said).toEqual(['walls'])
    expect(steps.next().done).toBe(false)
    expect(said).toEqual(['walls', 'ground'])
    const last = steps.next()
    expect(last.done).toBe(true)
    expect(last.value).toEqual(making())
  })

  it('makes anew each time, whole or in steps', () => {
    expect(making()).not.toBe(making())
    expect(whole(making.steps())).not.toBe(whole(making.steps()))
  })

  it('gives a making that has no steps as one step that is all of it, and runs nothing before that step is asked for', () => {
    let runs = 0
    const plain = (): number => ++runs
    const steps = stepsOf(plain)
    expect(runs).toBe(0)
    expect(steps.next()).toEqual({ done: true, value: 1 })
    expect(runs).toBe(1)
  })

  it('gives the steps a making has, and none of them run before the first is asked for', () => {
    said.length = 0
    const steps = stepsOf(making)
    expect(said).toEqual([])
    expect(whole(steps)).toEqual(['walls', 'ground', 'crown'])
  })

  it('is what every season hands the stage for its miniature', () => {
    for (const kit of [winter, spring, summer, fall]) expect(typeof (kit.miniature as Partial<InSteps<unknown>>).steps).toBe('function')
  })

  // Summer's field of sand and its grains held the thread for a fifth of a second in one piece, on a page that was drawing.
  it('is what summer hands the stage for what it lays round its globe as well', () => {
    expect(typeof (summer.dressing as Partial<InSteps<unknown>>).steps).toBe('function')
  })
})

describe('the steps of one frame', () => {
  /** Steps that each take `cost` ms of a clock that only they move; `small` says which of them answer that more may follow. */
  const frame = (costs: number[], small: (n: number) => boolean = () => true) => {
    let clock = 0
    const ran: number[] = []
    const steps: Step[] = costs.map((cost, n) => () => {
      clock += cost
      ran.push(n)
      return small(n)
    })
    return { steps, ran, now: () => clock }
  }

  it('takes small steps one after the other until the time is spent, and the one that passes it is the last', () => {
    const f = frame([1, 1, 1, 1, 1, 1])
    runFor(f.steps, 3.5, f.now)
    expect(f.ran).toEqual([0, 1, 2, 3])
    expect(f.steps.length).toBe(2)
  })

  it('takes one step however little time there is, so a making always comes to its end', () => {
    const f = frame([40, 1])
    runFor(f.steps, 0, f.now)
    expect(f.ran).toEqual([0])
    runFor(f.steps, 0, f.now)
    expect(f.ran).toEqual([0, 1])
    runFor(f.steps, 0, f.now)
    expect(f.ran).toEqual([0, 1])
  })

  it('ends at a step that does not say more may follow, though time is left: a whole part has a frame to itself', () => {
    const f = frame([1, 1, 1, 1], (n) => n !== 1)
    runFor(f.steps, 100, f.now)
    expect(f.ran).toEqual([0, 1])
    runFor(f.steps, 100, f.now)
    expect(f.ran).toEqual([0, 1, 2, 3])
  })

  it('leaves what it did not take in its order, and takes a step that put itself back again', () => {
    const f = frame([2, 2, 2])
    let left = 3
    const again: Step = () => {
      if (--left > 0) f.steps.unshift(again)
      return left > 0
    }
    f.steps.unshift(again)
    runFor(f.steps, 100, f.now)
    expect(left).toBe(0)
    expect(f.ran).toEqual([])
    runFor(f.steps, 3, f.now)
    expect(f.ran).toEqual([0, 1])
  })
})

describe('a part made in steps, as one step of a set', () => {
  /** A set of a plain step, a part of three pieces and a plain step. Each of the five takes `cost` ms of a clock that only they move. */
  const set = (cost: number) => {
    let clock = 0
    const ran: string[] = []
    const did = (what: string): void => {
      clock += cost
      ran.push(what)
    }
    const part = inSteps(function* (): Generator<void, string> {
      did('walls')
      yield
      did('ground')
      yield
      did('crown')
      return 'the part'
    })
    const steps: Step[] = []
    steps.push(() => did('before'), inPieces(() => steps, part, (made) => ran.push(`given ${made}`)), () => did('after'))
    return { steps, ran, now: () => clock }
  }

  it('makes nothing before it is taken', () => {
    const s = set(1)
    expect(s.ran).toEqual([])
    expect(s.steps.length).toBe(3)
  })

  it('makes its pieces one after the other in a frame that has the time, gives the part with the last, and leaves the next step a frame of its own', () => {
    const s = set(1)
    runFor(s.steps, 100, s.now)
    expect(s.ran).toEqual(['before'])
    runFor(s.steps, 100, s.now)
    expect(s.ran).toEqual(['before', 'walls', 'ground', 'crown', 'given the part'])
    expect(s.steps.length).toBe(1)
    runFor(s.steps, 100, s.now)
    expect(s.ran).toEqual(['before', 'walls', 'ground', 'crown', 'given the part', 'after'])
    expect(s.steps.length).toBe(0)
  })

  it('stops between two pieces where the time of the frame is spent, stays at the front of the set, and gives no part before its last piece', () => {
    const s = set(5)
    runFor(s.steps, 8, s.now)
    runFor(s.steps, 8, s.now)
    expect(s.ran).toEqual(['before', 'walls', 'ground'])
    expect(s.steps.length).toBe(2)
    runFor(s.steps, 8, s.now)
    expect(s.ran).toEqual(['before', 'walls', 'ground', 'crown', 'given the part'])
    runFor(s.steps, 8, s.now)
    expect(s.ran.at(-1)).toBe('after')
  })

  it('is made whole, in its place among the others, by a frame that needs the season at once and takes every step', () => {
    const s = set(1)
    for (let step = s.steps.shift(); step; step = s.steps.shift()) step()
    expect(s.ran).toEqual(['before', 'walls', 'ground', 'crown', 'given the part', 'after'])
  })

  it('takes a part that has no steps as the one step it always was', () => {
    let runs = 0
    const given: number[] = []
    const steps: Step[] = []
    steps.push(inPieces(() => steps, () => ++runs, (made) => given.push(made)), () => void runs++)
    expect(runs).toBe(0)
    runFor(steps, 100, () => 0)
    expect([runs, given, steps.length]).toEqual([1, [1], 1])
  })
})

describe('what a frame spends on a making', () => {
  const waits = [0, 1, 4, 8.3, 16.7, 33.3, 50]

  it('is never nothing, and grows with the time the page took to come round', () => {
    for (const awaited of [false, true]) {
      expect(spendOf(0, awaited)).toBeGreaterThan(0)
      for (let n = 1; n < waits.length; n++) expect(spendOf(waits[n]!, awaited)).toBeGreaterThanOrEqual(spendOf(waits[n - 1]!, awaited))
    }
  })

  it('leaves the picture at rest its pace: of a frame at 60 a second or slower a season nobody waits for takes a quarter at most', () => {
    for (const w of waits.filter((w) => w >= 16)) expect(spendOf(w, false)).toBeLessThanOrEqual(w / 4)
    expect(PACE.aside.ms).toBeLessThanOrEqual(16.7 / 4)
  })

  it('gives the season a shake is on its way into at least as long as the page takes itself, and always more than one nobody waits for', () => {
    for (const w of waits) {
      expect(spendOf(w, true)).toBeGreaterThanOrEqual(w)
      expect(spendOf(w, true)).toBeGreaterThan(spendOf(w, false))
    }
  })
})

describe('the pace of the display, as the page shows it', () => {
  const paced = (gaps: number[]): FramePace => {
    const p = new FramePace()
    let t = 1000
    p.frame(t)
    for (const gap of gaps) p.frame((t += gap))
    return p
  }
  const steady = (gap: number, n: number): number[] => Array.from({ length: n }, () => gap)

  it('is not known before the page has shown enough frames', () => {
    expect(paced([]).every).toBe(Infinity)
    expect(paced(steady(16.7, GAPS - 1)).every).toBe(Infinity)
    expect(paced(steady(16.7, GAPS)).every).toBeCloseTo(16.7)
  })

  it('counts a frame once that two tell of who wait in it', () => {
    const p = new FramePace()
    for (let n = 0; n <= GAPS; n++) for (let who = 0; who < 2; who++) p.frame(n * 16.7)
    expect(p.every).toBeCloseTo(16.7)
  })

  it('is the shortest the page has shown, not the usual: frames that came late, by the work aside or by anything, never make it longer', () => {
    expect(paced([...steady(16.7, GAPS), ...steady(33.4, 400)]).every).toBeCloseTo(16.7)
    expect(paced([33.4, 50, 16.7, 16.7, 33.4, 2000, 16.6, 16.8]).every).toBeCloseTo(16.7)
  })

  it('is not set by a frame or two that came early', () => {
    expect(paced([...steady(16.7, 20), 3, 16.7, 5, ...steady(16.7, 20)]).every).toBeCloseTo(16.7)
  })

  it('is taken shorter as soon as the page has shown three frames that close', () => {
    const p = paced(steady(33.4, 30))
    expect(p.every).toBeCloseTo(33.4)
    let t = 5000
    p.frame(t)
    p.frame((t += 16.7))
    p.frame((t += 16.7))
    expect(p.every).toBeCloseTo(33.4)
    p.frame((t += 16.7))
    expect(p.every).toBeCloseTo(16.7)
  })
})

describe('what a frame has left for a making', () => {
  it('is the rest of the frame less what the browser needs after the page, and of a frame past its time the rest up to the next the display shows', () => {
    expect(leftIn(5, 16.7)).toBeCloseTo(16.7 - 5 - KEEP_MS)
    expect(leftIn(16, 16.7)).toBeCloseTo(0.7 - KEEP_MS)
    expect(leftIn(20, 16.7)).toBeCloseTo(2 * 16.7 - 20 - KEEP_MS)
    expect(leftIn(10, 8.3)).toBeCloseTo(2 * 8.3 - 10 - KEEP_MS)
  })

  it('cuts work aside to the rest of the frame and never to nothing', () => {
    expect(fitIn(4, 2, 16.7)).toBe(4)
    expect(fitIn(4, 10, 16.7)).toBeCloseTo(2.7)
    expect(fitIn(4, 15, 16.7)).toBe(LEAST_MS)
    expect(fitIn(4, 20, 16.7)).toBe(4)
    expect(fitIn(4, 31, 16.7)).toBe(LEAST_MS)
  })

  it('takes the least while the pace is not known, so that the first frames show it, and the whole in a frame too old to keep to', () => {
    for (const awaited of [false, true]) {
      expect(spendIn(3, Infinity, 16.7, awaited)).toBe(LEAST_MS)
      for (const waited of [3, 50, 2000]) {
        expect(spendIn(SOON_MS, 16.7, waited, awaited)).toBe(spendOf(waited, awaited))
        expect(spendIn(2000, Infinity, waited, awaited)).toBe(spendOf(waited, awaited))
      }
    }
    expect(fitIn(4, 3, Infinity)).toBe(LEAST_MS)
    expect(fitIn(4, 400, 16.7)).toBe(4)
  })

  it('gives a season nobody waits for no more than the frame has left, and no more than a share of the time the page took to come round', () => {
    for (const every of [6.9, 8.3, 11.1, 16.7, 33.3])
      for (let used = 0; used < SOON_MS; used += 0.4)
        for (const waited of [2, 8, 16, 33, 400]) {
          const spend = spendIn(used, every, waited, false)
          expect(spend).toBeLessThanOrEqual(spendOf(waited, false))
          expect(spend).toBeLessThanOrEqual(Math.max(LEAST_MS, leftIn(used, every)) + 1e-9)
          expect(spend).toBeGreaterThanOrEqual(LEAST_MS)
        }
  })

  it('gives the season a shake waits for all the frame has left, and where that is too little as few whole frames more as make it enough', () => {
    for (const every of [4.2, 6.9, 8.3, 11.1, 16.7, 33.3])
      for (let used = 0; used < SOON_MS; used += 0.4) {
        const left = leftIn(used, every)
        const spend = spendIn(used, every, 0, true)
        const more = (spend - left) / every
        expect(more).toBeCloseTo(Math.round(more))
        expect(spend).toBeGreaterThanOrEqual(FIT_MS - 1e-9)
        expect(spend).toBeLessThan(Math.max(left, FIT_MS + every) + 1e-9)
        if (left >= FIT_MS) expect(spend).toBeCloseTo(left)
        if (every > 16 && left < FIT_MS) expect(more).toBeCloseTo(1)
      }
  })
})

type Spend = (used: number, every: number, waited: number, taken: number) => number

/**
 * A page on a display that shows a frame every `every` ms. Each frame the page's own script takes `page` ms, then each of
 * `workers` does work aside in steps of `step` ms for as long as it says, then the browser takes `browser` ms; the next
 * frame begins at the first time the display shows one after that. Gives the gaps between the frames, the share of the
 * time that went into work aside, and the level the governor left the page at.
 */
function draw(every: number, page: number, browser: number, step: number, frames: number, workers: Spend[]) {
  const governor = new Governor('auto')
  const top = governor.level.id
  const pace = new FramePace()
  const gaps: number[] = []
  let done = 0
  let begun = 0
  let free = 0
  let idle = 0
  for (let n = 0; n < frames; n++) {
    const at = n === 0 ? 0 : Math.max(begun + every, Math.ceil(free / every - 1e-9) * every)
    if (n > 0) {
      gaps.push(at - begun)
      governor.frame((at - begun) / 1000)
    }
    begun = at
    pace.frame(at)
    let clock = Math.max(at, free) + page
    for (const spend of workers) {
      const ms = spend(clock - at, pace.every, clock - idle, pace.taken)
      const from = clock
      do clock += step
      while (clock - from < ms)
      pace.taken += clock - from
      done += clock - from
      idle = clock
    }
    free = clock + browser
  }
  return { gaps, share: done / (begun || 1), level: governor.level.id, top }
}

describe('a page that makes a season while it draws', () => {
  const displays = [16.67, 11.11, 8.33, 6.94]
  const step = 0.25
  // What the frame keeps free, less the least it may be asked for once and less the step each of two may run over by.
  const browser = KEEP_MS - LEAST_MS - 2 * step
  const aside: Spend = (used, every, waited, taken) => spendIn(used, every, waited, false, taken)
  const awaited: Spend = (used, every, waited, taken) => spendIn(used, every, waited, true, taken)
  const handing: Spend = (used, every, _waited, taken) => fitIn(4, used, every, taken)
  const inside: Spend = (used, every, _waited, taken) => fitIn(Infinity, used, every, taken)

  it('loses no frame to a season nobody waits for, nor to that and a handing in the same frame, and keeps its level', () => {
    for (const every of displays)
      for (let page = 0.5; leftIn(page, every) >= 0; page += 0.5)
        for (const workers of [[aside], [aside, handing], [handing, aside]]) {
          const run = draw(every, page, browser, step, 400, workers)
          expect(Math.max(...run.gaps), `${every} ms display, ${page} ms page, ${workers.length} at work`).toBeCloseTo(every)
          expect(run.level).toBe(run.top)
          expect(run.share).toBeGreaterThanOrEqual(LEAST_MS / every)
        }
  })

  it('does not slow a page further that draws one frame in two by its own script', () => {
    for (const every of displays)
      for (let page = every; leftIn(page, every) >= 0 && page < 2 * every; page += 0.5)
        for (const workers of [[aside], [aside, handing]]) {
          const run = draw(every, page, browser, step, 400, workers)
          expect(Math.max(...run.gaps), `${every} ms display, ${page} ms page, ${workers.length} at work`).toBeCloseTo(2 * every)
        }
  })

  it('would lose the frames by the time the page took to come round alone, and with them a level: what reading the frame is for', () => {
    const run = draw(16.67, 11, browser, step, 400, [(_used, _every, waited) => spendOf(waited, false)])
    expect(Math.min(...run.gaps)).toBeCloseTo(2 * 16.67)
    expect(run.level).not.toBe(run.top)
  })

  it('loses no frame to the season a shake waits for where the page leaves it room, and makes it faster than one nobody waits for', () => {
    for (const every of [16.67, 33.33])
      for (let page = 0.5; leftIn(page, every) >= FIT_MS; page += 0.5) {
        const run = draw(every, page, browser, step, 200, [awaited])
        expect(Math.max(...run.gaps), `${every} ms display, ${page} ms page`).toBeCloseTo(every)
        expect(run.share).toBeGreaterThan(draw(every, page, browser, step, 200, [aside]).share)
      }
  })

  it('gives up one frame in two for the season a shake waits for where a page at 60 a second leaves it no room, never two, and gets more done so', () => {
    const every = 16.67
    for (let page = every - KEEP_MS - FIT_MS + 0.5; leftIn(page, every) >= 0; page += 0.5) {
      const run = draw(every, page, browser, step, 200, [awaited])
      expect(Math.max(...run.gaps), `${page} ms page`).toBeCloseTo(2 * every)
      expect(run.share, `${page} ms page`).toBeGreaterThan(draw(every, page, browser, step, 200, [inside]).share)
    }
  })

  it('keeps a display twice or four times as fast at 60 a second for the season a shake waits for, while the page leaves it room for that', () => {
    for (const every of [8.335, 4.1675])
      for (let page = 0.5; page + FIT_MS + KEEP_MS <= 16.67; page += 0.5) {
        const run = draw(every, page, browser, step, 200, [awaited])
        expect(Math.max(...run.gaps), `${every} ms display, ${page} ms page`).toBeLessThanOrEqual(16.68)
        expect(run.level).toBe(run.top)
      }
  })
})

const seasons = config.seasons
const first = config.defaultSeason
const others = seasons.filter((s) => s !== first)

class Counted implements LiveSim {
  step = 0
  advanceTo(step: number): void {
    this.step = Math.max(this.step, step)
  }
  reset(): void {
    this.step = 0
  }
}

/** The wish without its last piece. */
class StepsOnly extends Wish {
  override last(): boolean {
    return false
  }
}

interface Visit {
  /** The ms between two frames of the display. */
  every: number
  /** The ms the page's own script takes of each frame. */
  script: number
  /** The ms of work left at the press on the season in the making, and on each one begun later. */
  work: number
  /** The season pressed for: the one in the making, or one whose making the press begins. */
  to: string
  /** The ms one step of a making takes, and whether it says that another may follow it in the same frame. */
  piece?: number
  small?: boolean
  reduced?: boolean
  wish?: Wish
  /** Whether the visit goes on after the landing until every season is made. */
  through?: boolean
}

const PRESS_FRAME = 40

/**
 * A visit to a page that rests on the season it opened on and makes the others one after the other, as the loader asks
 * for them. At the frame `PRESS_FRAME` the visitor presses for `to`. The session is the page's own and takes a season as
 * ready once its making is through. Each frame the page's script ticks the session and tells the wish of the moment it
 * draws, then every making that is not held takes its turn as the stage gives it. Gives the season the press landed in,
 * the ms worked for other seasons before the one pressed for was made (`early`), while a shake was in the air or its
 * landing settled (`storm`) and after that (`late`), how many frames after the first one that showed the season pressed
 * for at rest the others were worked on again (`resumed`), and whether every season was made in the end.
 */
function visit({ every, script, work, to, piece = 1, small = true, reduced = false, wish = new Wish(), through = false }: Visit) {
  const made = new Set([first])
  const session = new LiveSession(new Counted(), first, (s) => made.has(s))
  session.reduced = reduced
  const pace = new FramePace()
  const browser = KEEP_MS - LEAST_MS - 0.5
  const aside = { early: 0, storm: 0, late: 0 }
  const making: { season: string; steps: Step[]; step: Step; idle: number }[] = []
  let clock = 0
  const left = (ms: number, step: Step): Step[] => Array<Step>(Math.ceil(ms / piece)).fill(step)
  const begin = (season: string, ms: number): void => {
    const step = (): boolean => {
      clock += piece
      return small
    }
    making.push({ season, steps: left(ms, step), step, idle: clock })
  }
  begin(others[0]!, 0)
  let asked: string | null = null
  let landed: string | null = null
  let shown: number | null = null
  let resumed: number | null = null
  let shaken = false
  let begun = 0
  let free = 0
  for (let n = 0; n < 40000; n++) {
    const at = n === 0 ? 0 : Math.max(begun + every, Math.ceil(free / every - 1e-9) * every)
    const dt = n === 0 ? 0 : (at - begun) / 1000
    begun = at
    clock = at
    if (n < PRESS_FRAME) for (const m of making) while (m.steps.length * piece < 4 * (script + every)) m.steps.push(m.step)
    if (n === PRESS_FRAME) {
      asked = session.goTo(to)
      wish.press(to)
      for (const m of making) m.steps = left(work, m.step)
      if (!making.some((m) => m.season === to)) begin(to, work)
    }
    const moment = session.moment(session.tick(dt), 1)
    wish.drawn(moment)
    clock += script
    shaken ||= moment.beat !== null
    const storm = moment.beat !== null || (shaken && moment.sinceLanding < SETTLE_S)
    if (n > PRESS_FRAME && landed === null && !session.busy) landed = session.season
    if (n > PRESS_FRAME && shown === null && moment.beat === null && moment.season === to) shown = n
    pace.frame(at)
    for (const m of [...making]) {
      const from = clock
      if (!wish.holds(m.season)) workIn(m.steps, m.season, { waited: clock - m.idle, frame: at }, wish, pace, () => clock)
      m.idle = clock
      if (n >= PRESS_FRAME && m.season !== to) aside[!made.has(to) ? 'early' : storm ? 'storm' : 'late'] += clock - from
      if (shown !== null && resumed === null && m.season !== to && clock > from) resumed = n - shown
      if (m.steps.length) continue
      made.add(m.season)
      making.splice(making.indexOf(m), 1)
      const next = others.find((s) => !made.has(s))
      if (next !== undefined && !making.some((o) => o.season === next)) begin(next, work)
    }
    free = clock + browser
    if (landed !== null && !storm && (!through || made.size === seasons.length)) break
  }
  return { asked, landed, aside, resumed, all: made.size === seasons.length }
}

describe('a press for a season that is still in the making', () => {
  const pages: (Visit & { where: string })[] = []
  for (const reduced of [false, true])
    for (const to of [others[0]!, others[1]!])
      for (const every of [16.67, 8.33])
        for (const script of [2, 6, 10, 14, 60, 120, 300, 2000])
          for (const work of [500, 1500, 3000, 5000])
            for (const [piece, small] of [[1, true], [20, false]] as const)
              pages.push({ every, script, work, to, piece, small, reduced, where: `${reduced ? 'reduced motion, ' : ''}${to}, ${every} ms display, ${script} ms script, ${work} ms left in steps of ${piece} ms` })
  let visits: (ReturnType<typeof visit> & { where: string; to: string })[] | null = null
  const all = () => (visits ??= pages.map(({ where, ...page }) => ({ ...visit(page), where, to: page.to })))

  it('lands in the season asked for, however much of it is left and however the page draws, with a shake and with reduced motion', () => {
    for (const v of all()) {
      expect(v.asked, v.where).toBe(v.to)
      expect(v.landed, v.where).toBe(v.to)
    }
  })

  it('makes nothing for another season before the one pressed for is made, nor while the shake is in the air or its landing settles', () => {
    for (const v of all()) {
      expect(v.aside.early, v.where).toBe(0)
      expect(v.aside.storm, v.where).toBe(0)
    }
  })

  it('goes on with the other seasons after that, until all are made', () => {
    for (const reduced of [false, true])
      for (const to of [others[0]!, others[1]!])
        for (const script of [2, 14, 300]) {
          const v = visit({ every: 16.67, script, work: 1500, to, reduced, through: true })
          const where = `${reduced ? 'reduced motion, ' : ''}${to}, ${script} ms script`
          expect(v.landed, where).toBe(to)
          expect(v.aside.early + v.aside.storm, where).toBe(0)
          expect(v.aside.late, where).toBeGreaterThan(0)
          expect(v.all, where).toBe(true)
        }
  })

  it('goes on with them in the frame that shows the season pressed for where no shake brought it, however slowly the page draws', () => {
    for (const to of [others[0]!, others[1]!])
      for (const script of [2, 14, 300, 2000]) {
        const where = `reduced motion, ${to}, ${script} ms script`
        expect(visit({ every: 16.67, script, work: 1500, to, reduced: true, through: true }).resumed, where).toBe(0)
      }
  })

  it('would land in the season it left by the steps alone where more is left than the wait holds: what the last piece is for', () => {
    for (const work of [4000, 5000])
      for (const reduced of [false, true]) {
        const page = { every: 16.67, script: 2, work, to: others[0]!, reduced }
        expect(visit({ ...page, wish: new StepsOnly() }).landed).toBe(first)
        expect(visit(page).landed).toBe(others[0])
      }
  })
})

describe('a wish', () => {
  const [to, other] = others as [string, string]
  const air = (time: number) => ({ beat: 1, season: first, sinceLanding: 0, time })
  const rest = (time: number, sinceLanding = 100, season = first) => ({ beat: null, season, sinceLanding, time })
  const held = (w: Wish): string[] => seasons.filter((s) => w.holds(s))
  const but = (season: string): string[] => seasons.filter((s) => s !== season)

  it('holds nothing where nobody pressed and no shake is drawn', () => {
    const w = new Wish()
    w.drawn(rest(50))
    expect(held(w)).toEqual([])
    for (const s of seasons) {
      expect(w.awaits(s)).toBe(false)
      expect(w.last(s)).toBe(false)
    }
  })

  it('holds every other season from the press and never the one pressed for, and lets go after PRESS_S of the session where no shake answers', () => {
    const w = new Wish()
    w.drawn(rest(10))
    w.press(to)
    for (const time of [10, 10 + PRESS_S - 0.01]) {
      w.drawn(rest(time))
      expect(held(w)).toEqual(but(to))
      expect(w.awaits(to)).toBe(true)
    }
    w.drawn(rest(10 + PRESS_S))
    expect(held(w)).toEqual([])
    expect(w.awaits(to)).toBe(false)
  })

  it('holds through a shake for as long as it is in the air, and after its landing until the liquid stands', () => {
    const w = new Wish()
    w.press(to)
    w.drawn(air(0.1))
    w.drawn(air(10 * PRESS_S))
    expect(held(w)).toEqual(but(to))
    expect(w.awaits(to)).toBe(true)
    w.drawn(rest(10 * PRESS_S + 1, 0))
    w.drawn(rest(10 * PRESS_S + 2, SETTLE_S - 0.01))
    expect(held(w)).toEqual(but(to))
    w.drawn(rest(10 * PRESS_S + 3, SETTLE_S))
    expect(held(w)).toEqual([])
    expect(w.awaits(to)).toBe(false)
  })

  it('holds every season through a shake nobody pressed for', () => {
    const w = new Wish()
    w.drawn(air(1))
    expect(held(w)).toEqual(seasons)
    w.drawn(rest(2, SETTLE_S))
    expect(held(w)).toEqual([])
  })

  it('takes a press in the settle of the last shake as the wish of the next', () => {
    const w = new Wish()
    w.press(to)
    w.drawn(air(1))
    w.drawn(rest(3, 1))
    w.press(other)
    expect(held(w)).toEqual(but(other))
    w.drawn(air(3.1))
    w.drawn(rest(6, 0.5))
    expect(held(w)).toEqual(but(other))
    w.drawn(rest(9, SETTLE_S))
    expect(held(w)).toEqual([])
  })

  it('keeps a press that no shake answers past the settle of the shake before it, for as long as the page keeps it', () => {
    const w = new Wish()
    w.press(to)
    w.drawn(air(1))
    w.drawn(rest(6, SETTLE_S - 0.5))
    w.press(other)
    w.drawn(rest(6.5, SETTLE_S))
    expect(held(w)).toEqual(but(other))
    expect(w.awaits(other)).toBe(true)
    w.drawn(rest(6 + PRESS_S, SETTLE_S + PRESS_S))
    expect(held(w)).toEqual([])
    expect(w.awaits(other)).toBe(false)
  })

  it('holds through the settle of a landing though no frame of its shake was drawn', () => {
    const w = new Wish()
    w.drawn(rest(5, 0))
    expect(held(w)).toEqual(seasons)
    w.press(to)
    w.drawn(rest(6, 1, to))
    expect(held(w)).toEqual(but(to))
    w.drawn(rest(8.5, SETTLE_S, to))
    expect(held(w)).toEqual([])
    expect(w.awaits(to)).toBe(false)
  })

  it('goes as soon as the season pressed for is on show where no shake brought it', () => {
    const w = new Wish()
    w.drawn(rest(10))
    w.press(to)
    w.drawn(rest(10.25))
    expect(held(w)).toEqual(but(to))
    w.drawn(rest(10.5, 100, to))
    expect(held(w)).toEqual([])
    expect(w.awaits(to)).toBe(false)
  })

  it('goes at the settle of the shake that answered it, however young it is', () => {
    const w = new Wish()
    w.press(to)
    w.drawn(air(0.1))
    w.drawn(rest(0.2, SETTLE_S))
    expect(held(w)).toEqual([])
    expect(w.awaits(to)).toBe(false)
  })

  it('keeps its age where the time of the session runs back', () => {
    const w = new Wish()
    w.drawn(rest(100))
    w.press(to)
    w.drawn(rest(101))
    w.drawn(rest(0.5))
    expect(w.awaits(to)).toBe(true)
    w.drawn(rest(PRESS_S - 0.51))
    expect(held(w)).toEqual(but(to))
    w.drawn(rest(PRESS_S - 0.5))
    expect(held(w)).toEqual([])
    expect(w.awaits(to)).toBe(false)
  })

  it('is not lost where the time runs back in mid shake', () => {
    const w = new Wish()
    w.drawn(rest(100))
    w.press(to)
    w.drawn(air(100.5))
    w.drawn(air(0.1))
    expect(held(w)).toEqual(but(to))
    expect(w.awaits(to)).toBe(true)
    w.drawn(rest(2, SETTLE_S - 0.01))
    expect(held(w)).toEqual(but(to))
    w.drawn(rest(2.1, SETTLE_S))
    expect(held(w)).toEqual([])
  })

  it('asks for what is left in one piece only of the season pressed for, and only once the press is LAST_S old', () => {
    const w = new Wish()
    w.drawn(rest(5))
    w.press(to)
    w.drawn(rest(5 + LAST_S))
    expect(w.last(to)).toBe(false)
    w.drawn(rest(5 + LAST_S + 0.01))
    expect(w.last(to)).toBe(true)
    expect(w.last(other)).toBe(false)
  })

  it('asks for it a frame before the page gives the wish up, however long the frames are', () => {
    expect(LAST_S + LIVE.maxFrameSeconds).toBeLessThan(config.live.loadWaitSeconds)
  })

  it('is LAST_S old by the clock as well where it is asked with the clock, whichever says so first, and never by a clock the press did not have', () => {
    const w = new Wish()
    w.drawn(rest(5))
    w.press(to, 0)
    w.drawn(rest(5.25))
    expect(w.last(to, LAST_S * 1000)).toBe(false)
    expect(w.last(to, LAST_S * 1000 + 1)).toBe(true)
    expect(w.last(to)).toBe(false)
    expect(w.last(other, LAST_S * 1000 + 1)).toBe(false)
    w.drawn(rest(5 + LAST_S + 0.01))
    expect(w.last(to, 1)).toBe(true)
    const again = new Wish()
    again.drawn(rest(5))
    again.press(to, 2000)
    expect(again.last(to, 2000 + LAST_S * 1000)).toBe(false)
    expect(again.last(to, 2000 + LAST_S * 1000 + 1)).toBe(true)
    again.drawn(rest(5.5, 100, to))
    expect(again.last(to, 2000 + LAST_S * 1000 + 1)).toBe(false)
    const plain = new Wish()
    plain.drawn(rest(5))
    plain.press(to)
    expect(plain.last(to, 1e9)).toBe(false)
  })
})

/** Everything that waits on a promise settled so far has run. */
const told = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('the hands of the seasons', () => {
  const [a, b, c] = others as [string, string, string]
  /** A stage whose hand of a season is over when the test says so. */
  const stage = () => {
    const begun: string[] = []
    const ends = new Map<string, { done: () => void; fail: (e: Error) => void }>()
    const hands = new Hands((season) => {
      begun.push(season)
      return new Promise<void>((done, fail) => ends.set(season, { done, fail }))
    })
    return { begun, hands, end: (season: string) => ends.get(season)!.done(), fail: (season: string) => ends.get(season)!.fail(new Error(season)) }
  }

  it('hands them one after the other, in the order they were made', async () => {
    const s = stage()
    for (const season of [a, b, c]) expect(s.hands.made(season, false)).toBeUndefined()
    await told()
    expect(s.begun).toEqual([a])
    s.end(a)
    await told()
    expect(s.begun).toEqual([a, b])
    s.end(b)
    await told()
    expect(s.begun).toEqual([a, b, c])
    let all = false
    void s.hands.all.then(() => (all = true))
    await told()
    expect(all).toBe(false)
    s.end(c)
    await told()
    expect(all).toBe(true)
  })

  it('begins the hand of the season pressed for at the press, beside the one under way, and gives it to wait for', async () => {
    const s = stage()
    for (const season of [a, b, c]) s.hands.made(season, false)
    await told()
    const waited = s.hands.pressed(c)
    expect(s.begun).toEqual([a, c])
    let over = false
    void waited!.then(() => (over = true))
    await told()
    expect(over).toBe(false)
    s.end(c)
    await told()
    expect(over).toBe(true)
  })

  it('gives a press the hand that is under way where the turn of its season has come', async () => {
    const s = stage()
    s.hands.made(a, false)
    await told()
    let over = false
    void s.hands.pressed(a)!.then(() => (over = true))
    expect(s.begun).toEqual([a])
    s.end(a)
    await told()
    expect(over).toBe(true)
  })

  it('begins each hand once, whoever comes for it first, and the others keep their order', async () => {
    const s = stage()
    for (const season of [a, b, c]) s.hands.made(season, false)
    await told()
    expect(s.hands.pressed(c)).toBe(s.hands.pressed(c))
    s.end(a)
    await told()
    expect(s.begun).toEqual([a, c, b])
    let all = false
    void s.hands.all.then(() => (all = true))
    s.end(b)
    await told()
    expect(s.begun).toEqual([a, c, b])
    expect(all).toBe(false)
    s.end(c)
    await told()
    expect(all).toBe(true)
  })

  it('gives a press nothing to wait for where the season is not made yet, and where its hand is over, however it ended', async () => {
    const s = stage()
    expect(s.hands.pressed(a)).toBeUndefined()
    expect(s.begun).toEqual([])
    s.hands.made(a, false)
    await told()
    s.end(a)
    await told()
    expect(s.hands.pressed(a)).toBeUndefined()
    s.hands.made(b, false)
    s.hands.all.catch(() => undefined)
    await told()
    s.fail(b)
    await told()
    expect(s.hands.pressed(b)).toBeUndefined()
    expect(s.begun).toEqual([a, b])
  })

  it('begins the hand of a season that was made for a press as soon as it is made, and gives it for the making to end with', async () => {
    const s = stage()
    s.hands.made(a, false)
    await told()
    const waited = s.hands.made(b, true)
    expect(s.begun).toEqual([a, b])
    let over = false
    void waited!.then(() => (over = true))
    s.end(a)
    await told()
    expect(over).toBe(false)
    expect(s.begun).toEqual([a, b])
    s.end(b)
    await told()
    expect(over).toBe(true)
  })
})

describe('the steps of a hand', () => {
  const [season, other] = others as [string, string]
  const REST_MS = 4
  const rest = (time: number) => ({ beat: null, season: first, sinceLanding: 100, time })
  /** A display whose pace the page has seen: a frame every `every` ms up to the one at `at`. */
  const seen = (every: number, at: number): FramePace => {
    const pace = new FramePace()
    for (let n = GAPS + 1; n >= 0; n--) pace.frame(at - n * every)
    return pace
  }
  /** A hand of `n` steps of `piece` ms each on a clock of the test's own, which gives it its turns. */
  const hand = (n: number, piece: number, wish: Wish, pace = new FramePace(), of = season, byClock = false) => {
    const h = { clock: 0, done: 0, go: true, turns: [] as ((turn: Turn) => void)[], over: false }
    const steps = Array.from({ length: n }, () => (): void => {
      h.clock += piece
      h.done++
    })
    void handIn(steps, of, wish, pace, REST_MS, () => h.go, () => new Promise<Turn>((give) => h.turns.push(give)), () => h.clock, byClock).then(() => (h.over = true))
    return h
  }
  const give = async (h: ReturnType<typeof hand>, turn: Turn): Promise<number> => {
    const before = h.done
    h.turns.shift()!(turn)
    await told()
    return h.done - before
  }

  it('takes a few of them a frame while the picture rests, and the step that passes what the frame gives is the frame\'s last', async () => {
    const h = hand(40, 1.5, new Wish())
    expect(h.done).toBe(0)
    expect(await give(h, { waited: 60, frame: null })).toBe(Math.ceil(REST_MS / 1.5))
    const every = 1000 / 60
    const pace = seen(every, 1000)
    const fast = hand(40, 1.5, new Wish(), pace)
    fast.clock = 1002
    expect(await give(fast, { waited: every, frame: 1000 })).toBe(Math.ceil(REST_MS / 1.5))
    fast.clock = 1000 + every - KEEP_MS - 1
    pace.taken = 0
    expect(await give(fast, { waited: every, frame: 1000 })).toBe(1)
    expect(fast.over).toBe(false)
  })

  it('takes for the season a press waits for what its making would take, and tells the wish that the page gave the time up', async () => {
    const wish = new Wish()
    wish.drawn(rest(1))
    wish.press(season)
    const slow = hand(400, 1, wish)
    expect(await give(slow, { waited: 90, frame: null })).toBe(spendOf(90, true))
    expect(spendOf(90, true)).toBeGreaterThan(REST_MS)
    wish.drawn(rest(1.1))
    expect(wish.gave).toBe(true)
    wish.drawn(rest(1.2))
    expect(wish.gave).toBe(false)
    const every = 1000 / 60
    const pace = seen(every, 1000)
    const fast = hand(400, 1, wish, pace)
    fast.clock = 1002
    expect(await give(fast, { waited: every, frame: 1000 })).toBe(Math.ceil(spendIn(2, every, every, true)))
    expect(spendIn(2, every, every, true)).toBeGreaterThan(2 * REST_MS)
  })

  it('tells the wish nothing of a season nobody waits for', async () => {
    const wish = new Wish()
    wish.drawn(rest(1))
    wish.press(season)
    const h = hand(40, 1, wish, new FramePace(), other)
    expect(await give(h, { waited: 90, frame: null })).toBe(REST_MS)
    wish.drawn(rest(1.1))
    expect(wish.gave).toBe(false)
  })

  it('does all that is left at once when the press is LAST_S old, and waits for no turn before it', async () => {
    const wish = new Wish()
    wish.drawn(rest(1))
    wish.press(season)
    const h = hand(900, 1, wish)
    expect(await give(h, { waited: 20, frame: null })).toBe(spendOf(20, true))
    expect(h.turns).toHaveLength(1)
    wish.drawn(rest(1 + LAST_S + 0.01))
    expect(await give(h, { waited: 20, frame: null })).toBe(900 - spendOf(20, true))
    expect(h.over).toBe(true)
    expect(h.turns).toHaveLength(0)
    const late = hand(900, 1, wish)
    expect(late.done).toBe(900)
    expect(late.turns).toHaveLength(0)
    wish.drawn(rest(1 + LAST_S + 0.02))
    expect(wish.gave).toBe(true)
  })

  it('does all that is left at once when the press is LAST_S old by the clock where the browser links nothing aside, though the session has counted a quarter of a second; where it links aside the clock says nothing', async () => {
    for (const byClock of [true, false]) {
      const wish = new Wish()
      wish.drawn(rest(1))
      wish.press(season, 0)
      const h = hand(900, 1, wish, new FramePace(), season, byClock)
      const turn = spendOf(20, true)
      expect(await give(h, { waited: 20, frame: null })).toBe(turn)
      wish.drawn(rest(1.25))
      h.clock = LAST_S * 1000 - turn
      expect(await give(h, { waited: 20, frame: null })).toBe(turn)
      expect(h.turns).toHaveLength(1)
      h.clock = LAST_S * 1000 + 1
      expect(await give(h, { waited: 20, frame: null })).toBe(byClock ? 900 - 2 * turn : turn)
      expect(h.over).toBe(byClock)
      expect(h.turns).toHaveLength(byClock ? 0 : 1)
      wish.drawn(rest(1.5))
      expect(wish.gave).toBe(true)
    }
  })

  it('does nothing more once a frame has shown the season, which made the rest itself', async () => {
    const h = hand(40, 1, new Wish())
    expect(await give(h, { waited: 60, frame: null })).toBe(REST_MS)
    h.go = false
    expect(await give(h, { waited: 60, frame: null })).toBe(0)
    expect(h.over).toBe(true)
    expect(h.turns).toHaveLength(0)
  })
})

describe('the wait for what a browser links aside', () => {
  const page = () => {
    const p = { stop: false, turns: [] as (() => void)[], over: false, linked: (): void => undefined, failed: (): void => undefined }
    const links = new Promise<void>((done, fail) => {
      p.linked = done
      p.failed = () => fail(new Error('link'))
    })
    void until(links, () => p.stop, () => new Promise<void>((turn) => p.turns.push(turn))).then(() => (p.over = true))
    return p
  }
  const frame = async (p: ReturnType<typeof page>): Promise<void> => {
    p.turns.shift()?.()
    await told()
  }

  it('lasts until the programs are linked, through as many frames as that takes', async () => {
    const p = page()
    for (let n = 0; n < 5; n++) {
      await frame(p)
      expect(p.over).toBe(false)
    }
    p.linked()
    await told()
    expect(p.over).toBe(true)
  })

  it('ends at the frame that says so, though nothing is linked yet: a press that is LAST_S old, or a frame that showed the season', async () => {
    const p = page()
    await frame(p)
    expect(p.over).toBe(false)
    p.stop = true
    await frame(p)
    expect(p.over).toBe(true)
  })

  it('ends where a link fails, and leaves the failure to the draw that needs the program', async () => {
    const p = page()
    await frame(p)
    p.failed()
    await told()
    expect(p.over).toBe(true)
  })
})

describe('the seasons a frame shows', () => {
  it('are the one the session is in, and in the change of a shake the one it leaves and the one it goes into', () => {
    const session = new LiveSession(new Counted(), first)
    const to = session.shake()!
    const swap = config.shake.swapWindow
    const shown: string[] = []
    let both = 0
    for (let n = 0; n < 60 * 6 && session.busy; n++) {
      const moment = session.moment(session.tick(1 / 60), 1)
      const here = seasonsIn(moment)
      if (shown.at(-1) !== here.join('+')) shown.push(here.join('+'))
      if (here.length < 2) continue
      both++
      expect(moment.beat).toBeGreaterThanOrEqual(swap.fromBeat)
      expect(moment.beat).toBeLessThanOrEqual(swap.toBeat)
    }
    expect(shown).toEqual([first, `${first}+${to}`, to])
    expect(both).toBeGreaterThan(10)
  })

  it('is one where a change is whole or has not begun, whatever it goes from and into', () => {
    const [to] = others as [string]
    expect(seasonsIn({ season: first, from: first, to, change: 0 })).toEqual([first])
    expect(seasonsIn({ season: to, from: first, to, change: 1 })).toEqual([to])
    expect(seasonsIn({ season: first, from: first, to: first, change: 0.5 })).toEqual([first])
    expect(seasonsIn({ season: first, from: first, to, change: 0.5 })).toEqual([first, to])
  })
})

const pressLines = fs.readFileSync(rel('src', 'app', 'app.ts'), 'utf8').split('\n').filter((l) => l.includes('stage.expect'))
/** What the page does with a press once the session has taken it, as it stands in src/app/app.ts. */
const PRESS = pressLines[0]?.trim() ?? ''
/** The same before a press waited for the hand of its season. */
const PRESS_BEFORE = 'd.stage.expect?.(season)'

interface StageSide {
  expect?(season: string): Promise<void> | void
}
type Press = (loader: SeasonLoader, d: { stage: StageSide }, season: string) => void
const pressAs = (line: string): Press => new Function('loader', 'd', 'season', line) as Press

/** The hands as they were: each in its turn, and nothing for a press. */
class InTurn extends Hands {
  override made(season: string): Promise<void> | undefined {
    return super.made(season, false)
  }
  override pressed(): Promise<void> | undefined {
    return undefined
  }
}

/** The wish as a hand took it before: it was asked only whether a season is held. */
class HeldOnly extends Wish {
  override awaits(): boolean {
    return false
  }
  override last(): boolean {
    return false
  }
}

interface Early {
  /** The ms between two frames of the display. */
  every: number
  /** The ms the page's own script takes of each frame. */
  script: number
  /** The ms the hand of each season takes in all, and the ms one step of it takes. */
  work: number
  piece: number
  /** The season pressed for: the one made first, whose hand is under way, or the next, whose turn has not come. */
  to: string
  reduced?: boolean
  /** What the page does with the press. */
  press?: string
  hands?: (hand: (season: string) => Promise<void>) => Hands
  wish?: Wish
  /** Whether the visit goes on after the landing until every season is in the GPU's hands. */
  through?: boolean
  /**
   * The ms the browser takes to draw a frame where it draws with the processor. No frame begins before the last is
   * drawn, and the first step a hand takes in a turn waits for the frame as well, as every question to the GPU does.
   */
  gpu?: number
  /** Whether the session falls behind the clock as on a page whose frame is over its time: it counts one step of the simulation a frame. */
  behind?: boolean
  /** Whether a hand takes the age of the press by the clock as well, as the stage has it where the browser links nothing aside. A step here holds the thread, which is that browser. */
  byClock?: boolean
}

/**
 * A visit to a page whose seasons are all built and none but the first in the GPU's hands: the visitor presses early, at
 * the frame `PRESS_FRAME`, for `to`. The session, the loader, the wish and the hands are the page's own, and a hand is the
 * stage's own steps with a clock for a GPU: it gets its turn at each frame the wish does not hold its season, as the
 * stage gives it. A frame that shows a season whose hand is not over makes what is left itself and stands for as long
 * (`stops`: the season, the ms, the beat of the shake). Gives the season the press landed in, those stops, the longest
 * the picture stood between the press and the landing (`stood`), the ms the hands of other seasons worked from the press
 * until the landing had settled, or with reduced motion until the season was on show, from where the picture rests under
 * its fade (`aside`), and whether every hand was over in the end. Also the ms the hand of `to` had left at the press
 * (`owed`), and the ms from the press until it was over (`handed`).
 */
async function early({ every, script, work, piece, to, reduced = false, press = PRESS, hands: handsOf = (hand) => new Hands(hand), wish = new Wish(), through = false, gpu = 0, behind = false, byClock = true }: Early) {
  const loader = new SeasonLoader(first, async () => undefined)
  await loader.all
  const session = new LiveSession(new Counted(), first, loader.ready)
  session.reduced = reduced
  const pace = new FramePace()
  const browser = KEEP_MS - LEAST_MS - 0.5
  const shown = new Set([first])
  const left = new Map(others.map((season) => [season, Math.ceil(work / piece)]))
  let waiting: { season: string; from: number; give: (turn: Turn) => void }[] = []
  let clock = 0
  let drawnBy = 0
  const hands = handsOf((season) => {
    const steps = Array.from({ length: left.get(season)! }, () => (): void => {
      clock = Math.max(clock, drawnBy) + piece
      left.set(season, left.get(season)! - 1)
    })
    return handIn(steps, season, wish, pace, 4, () => !shown.has(season), () => new Promise<Turn>((give) => waiting.push({ season, from: clock, give })), () => clock, byClock)
  })
  const stage: StageSide = {
    expect: (season) => {
      wish.press(season, clock)
      return hands.pressed(season)
    },
  }
  for (const season of others) hands.made(season, false)
  let all = false
  void hands.all.then(() => (all = true))
  await told()
  const stops: { season: string; ms: number; beat: number | null }[] = []
  let asked: string | null = null
  let landed: string | null = null
  let shaken = false
  let aside = 0
  let stood = 0
  let begun = 0
  let free = 0
  let pressed = 0
  let owed = 0
  let handed: number | null = null
  for (let n = 0; n < 40000; n++) {
    const at = n === 0 ? 0 : Math.max(begun + every, Math.ceil(free / every - 1e-9) * every)
    const dt = n === 0 ? 0 : (at - begun) / 1000
    if (n > PRESS_FRAME && landed === null) stood = Math.max(stood, at - begun)
    begun = at
    clock = at
    if (n === PRESS_FRAME) {
      pressed = at
      owed = left.get(to)! * piece
      asked = session.goTo(to)
      pressAs(press)(loader, { stage }, to)
    }
    const moment = session.moment(session.tick(dt, behind ? () => true : undefined), 1)
    wish.drawn(moment)
    clock += script
    for (const season of seasonsIn(moment)) {
      if (shown.has(season)) continue
      const rest = left.get(season)! * piece
      if (rest > 0) stops.push({ season, ms: rest, beat: moment.beat })
      clock += rest
      left.set(season, 0)
      shown.add(season)
    }
    drawnBy = Math.max(drawnBy, clock) + gpu
    shaken ||= moment.beat !== null
    const storm = moment.beat !== null || (shaken && moment.sinceLanding < SETTLE_S)
    if (n > PRESS_FRAME && landed === null && !session.busy) landed = session.season
    pace.frame(at)
    const turns = waiting
    waiting = []
    for (const w of turns) {
      if (wish.holds(w.season)) {
        w.from = clock
        waiting.push(w)
        continue
      }
      const from = clock
      w.give({ waited: clock - w.from, frame: at })
      await told()
      if (n >= PRESS_FRAME && w.season !== to && (reduced ? !shown.has(to) : landed === null || storm)) aside += clock - from
    }
    if (n >= PRESS_FRAME && handed === null && left.get(to) === 0) handed = clock - pressed
    free = Math.max(clock + browser, drawnBy)
    if (landed !== null && !storm && (!through || others.every((season) => left.get(season) === 0))) break
  }
  await told()
  return { asked, landed, stops, stood, aside, all, owed, handed }
}

describe('a press for a season that is built and not yet in the GPU\'s hands', () => {
  const swap = config.shake.swapWindow
  const [soon, later] = others as [string, string]
  const pages: (Early & { where: string })[] = []
  for (const reduced of [false, true])
    for (const to of [soon, later])
      for (const every of [16.67, 8.33])
        for (const script of [2, 6, 14, 60, 300, 2000])
          for (const work of [300, 1500, 3000, 6000])
            for (const piece of [1, 40])
              pages.push({ every, script, work, piece, to, reduced, where: `${reduced ? 'reduced motion, ' : ''}${to}, ${every} ms display, ${script} ms script, a hand of ${work} ms in steps of ${piece} ms` })
  let visits: Promise<(Awaited<ReturnType<typeof early>> & { where: string; page: Early })[]> | null = null
  const all = () => (visits ??= (async () => {
    const out = []
    for (const { where, ...page } of pages) out.push({ ...(await early(page)), where, page })
    return out
  })())

  it('is held with the page\'s own line for a press', () => {
    expect(pressLines).toHaveLength(1)
    expect(PRESS).toContain('loader.hold(')
  })

  it('waits for the hand: no frame shows the season before the GPU has it, and the press lands in it, however long the hand is and however the page draws', async () => {
    for (const v of await all()) {
      expect(v.asked, v.where).toBe(v.page.to)
      expect(v.stops, v.where).toEqual([])
      expect(v.landed, v.where).toBe(v.page.to)
    }
  }, 300000)

  it('draws on while it waits: with a hand in small steps that the wait has room for, the picture never stands longer than two frames of a display at 60 a second', async () => {
    let looked = 0
    for (const v of await all()) {
      const { every, script, work, piece } = v.page
      if (piece > 1 || work > 1500 || script + KEEP_MS > every) continue
      looked++
      expect(v.stood, v.where).toBeLessThanOrEqual(2 * 16.67 + 0.01)
    }
    expect(looked).toBeGreaterThan(8)
  }, 300000)

  it('does nothing for the hands of the other seasons from the press until the landing has settled, and with reduced motion until the season pressed for is on show', async () => {
    for (const v of await all()) expect(v.aside, v.where).toBe(0)
  }, 300000)

  it('goes on with the others after that, in their order, until every season is in the GPU\'s hands', async () => {
    for (const reduced of [false, true])
      for (const to of [soon, later])
        for (const script of [2, 14, 300]) {
          const v = await early({ every: 16.67, script, work: 1500, piece: 1, to, reduced, through: true })
          const where = `${reduced ? 'reduced motion, ' : ''}${to}, ${script} ms script`
          expect(v.landed, where).toBe(to)
          expect(v.stops, where).toEqual([])
          expect(v.all, where).toBe(true)
        }
  }, 300000)

  it('was shown, as things were, by a frame that made what was left of its hand itself, in the middle of its shake: what the wait is for', async () => {
    for (const reduced of [false, true])
      for (const to of [soon, later])
        for (const script of [2, 14, 300])
          for (const work of [1500, 6000]) {
            const page = { every: 16.67, script, work, piece: 1, to, reduced }
            const where = `${reduced ? 'reduced motion, ' : ''}${to}, ${script} ms script, a hand of ${work} ms`
            const was = await early({ ...page, press: PRESS_BEFORE, hands: (hand) => new InTurn(hand), wish: new HeldOnly() })
            expect(was.landed, where).toBe(to)
            expect(was.stops.map((stop) => stop.season), where).toEqual([to])
            const [stop] = was.stops as [(typeof was.stops)[0]]
            expect(stop.ms, where).toBeGreaterThan(work / 2)
            if (to === later) expect(stop.ms, where).toBe(work)
            if (reduced) expect(stop.beat, where).toBeNull()
            else {
              expect(stop.beat, where).toBeGreaterThanOrEqual(swap.fromBeat)
              expect(stop.beat, where).toBeLessThan(swap.toBeat)
            }
            expect((await early(page)).stops, where).toEqual([])
          }
  }, 300000)

  it('would be shown the same way by a press that begins the hand and does not wait for it, with less left: what the page\'s line is for', async () => {
    for (const to of [soon, later])
      for (const script of [2, 14]) {
        const page = { every: 16.67, script, work: 6000, piece: 1, to }
        const where = `${to}, ${script} ms script`
        const was = await early({ ...page, press: PRESS_BEFORE, hands: (hand) => new InTurn(hand), wish: new HeldOnly() })
        const begun = await early({ ...page, press: PRESS_BEFORE })
        expect(begun.stops.map((stop) => stop.season), where).toEqual([to])
        expect(begun.stops[0]!.ms, where).toBeLessThan(was.stops[0]!.ms)
        expect(begun.stops[0]!.beat, where).toBeGreaterThanOrEqual(swap.fromBeat)
        expect(begun.landed, where).toBe(to)
      }
  }, 300000)

  it('does not wait a frame for each step where the browser draws with the processor and links nothing aside: what is left when the press is LAST_S old by the clock is done in one piece, long before the session has counted as much', async () => {
    const [script, gpu, piece] = [60, 1200, 350]
    for (const reduced of [false, true])
      for (const to of [soon, later]) {
        const page = { every: 16.67, script, gpu, behind: true, work: 80 * piece, piece, to, reduced }
        const where = `${reduced ? 'reduced motion, ' : ''}${to}`
        const steps = await early({ ...page, byClock: false })
        const whole = await early(page)
        for (const v of [steps, whole]) {
          expect(v.landed, where).toBe(to)
          expect(v.stops, where).toEqual([])
          expect(v.owed, where).toBeGreaterThanOrEqual(30 * piece)
        }
        expect(steps.handed, where).toBeGreaterThan((steps.owed / piece) * gpu)
        expect(whole.handed, where).toBeLessThanOrEqual(LAST_S * 1000 + whole.owed + 2 * (script + gpu + piece + 16.67))
        expect(whole.handed!, where).toBeLessThan(steps.handed! / 2)
      }
  }, 300000)

  it('has what is left of its hand done in one piece when the press is LAST_S old; by the steps alone the press would land in the season it left', async () => {
    for (const reduced of [false, true])
      for (const to of [soon, later]) {
        const page = { every: 16.67, script: 2, work: 6000, piece: 1, to, reduced }
        const where = `${reduced ? 'reduced motion, ' : ''}${to}`
        const steps = await early({ ...page, wish: new StepsOnly() })
        expect(steps.landed, where).toBe(first)
        expect(steps.stops, where).toEqual([])
        const whole = await early(page)
        expect(whole.landed, where).toBe(to)
        expect(whole.stops, where).toEqual([])
        expect(whole.stood, where).toBeGreaterThan(1000)
      }
  }, 300000)
})

// Each way is built in a process of its own (tools/miniatures.mjs says why), so the tool is run as a builder runs it.
describe('the four miniatures and what each season lays round its globe', () => {
  it('are the same built in one piece, in steps, and in steps with a second making in between', () => {
    const run = spawnSync(process.execPath, [rel('tools', 'miniatures.mjs')], { encoding: 'utf8' })
    const out = run.stdout + run.stderr
    expect(out).toMatch(/^pass: sha256 [0-9a-f]{64}$/m)
    expect(run.status).toBe(0)
    for (const season of seasons) expect(out).toMatch(new RegExp(`^${season}, the dressing: .*; the same all three ways, sha256 [0-9a-f]{64}$`, 'm'))
    // Summer stops after every row of its field of sand and every lot of its grains. A field laid in one piece again, by
    // anything that asks for it before the dressing has laid it, leaves a few hundred steps and one of them a long one.
    expect(Number(/^summer, the dressing: .*; (\d+) steps, /m.exec(out)?.[1])).toBeGreaterThan(1000)
  }, 300000)
})

// The hand of a season draws each mesh once alone, without what the mesh draws of its own before its draw: a copy of the
// frame is of no use to one pixel. A pass drawn there has a program of its own, and that program was first linked in the
// first frame of the first shake into spring. A mesh gives the stage what to draw once for it (`userData.warm`).
describe('what the glass of spring draws of its own before a draw', () => {
  type Drew = { to: THREE.WebGLRenderTarget | null; pass: THREE.Material }
  const page = (frame: THREE.WebGLRenderTarget | null) => {
    const drew: Drew[] = []
    const info = { frame: 7, calls: 3, triangles: 5, points: 0, lines: 0 }
    let bound = frame
    const renderer = {
      info: { render: info },
      getRenderTarget: () => bound,
      setRenderTarget: (to: THREE.WebGLRenderTarget | null) => void (bound = to),
      copyFramebufferToTexture: () => undefined,
      render: (scene: THREE.Object3D) => {
        info.frame++
        info.calls++
        scene.traverse((o) => {
          const pass = (o as THREE.Mesh).material as THREE.Material | undefined
          if (pass) drew.push({ to: bound, pass })
        })
      },
    }
    return { renderer: renderer as unknown as THREE.WebGLRenderer, drew, info, bound: () => bound }
  }
  const meshes = (): THREE.Mesh[] => {
    const all: THREE.Mesh[] = []
    springGlass.dressing().traverse((o) => void ((o as THREE.Mesh).isMesh && all.push(o as THREE.Mesh)))
    return all
  }
  const warms = (): ((renderer: THREE.WebGLRenderer) => void)[] => meshes().flatMap((m) => (typeof m.userData.warm === 'function' ? [m.userData.warm as (renderer: THREE.WebGLRenderer) => void] : []))
  const kind = (t: THREE.WebGLRenderTarget | null): string => `${t?.texture.type} ${t?.texture.format} ${t?.samples} ${t?.depthBuffer} ${t?.stencilBuffer}`
  const frameOf = (type: THREE.TextureDataType, side: number): THREE.WebGLRenderTarget => new THREE.WebGLRenderTarget(side, side, { type })

  it('gives the stage every pass a mesh of it draws before its own draw, to draw once into one pixel of the same kind', () => {
    for (const type of [THREE.HalfFloatType, THREE.FloatType, THREE.UnsignedByteType]) {
      const live = page(frameOf(type, 64))
      const hooked = meshes().filter((m) => m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender)
      expect(hooked.length).toBeGreaterThan(0)
      const uniforms = hooked.map((m) => (m.material as THREE.ShaderMaterial).uniforms)
      for (const m of hooked) m.onBeforeRender(live.renderer, new THREE.Scene(), new THREE.Camera(), m.geometry, m.material as THREE.Material, null as unknown as THREE.Group)
      for (const u of uniforms) {
        if (u.uBehind) u.uBehind.value = null
        if (u.uSoft) u.uSoft.value = null
        ;(u.uBehindSize?.value as THREE.Vector2 | undefined)?.set(0, 0)
      }
      expect(live.drew.length).toBeGreaterThan(0)

      const rest = page(frameOf(type, 1))
      for (const warm of warms()) warm(rest.renderer)
      for (const d of live.drew) {
        const twin = rest.drew.find((w) => w.pass === d.pass)
        expect(twin).toBeDefined()
        expect(kind(twin!.to)).toBe(kind(d.to))
        expect([twin!.to!.width, twin!.to!.height]).toEqual([1, 1])
      }
    }
  })

  it('leaves the renderer as it found it: the picture bound, and the count of what was drawn', () => {
    const like = frameOf(THREE.HalfFloatType, 1)
    const rest = page(like)
    expect(warms().length).toBeGreaterThan(0)
    for (const warm of warms()) warm(rest.renderer)
    expect(rest.drew.length).toBeGreaterThan(0)
    expect(rest.drew.every((d) => d.to !== like)).toBe(true)
    expect(rest.bound()).toBe(like)
    expect(rest.info).toEqual({ frame: 7, calls: 3, triangles: 5, points: 0, lines: 0 })
  })

  it('draws nothing where no picture is bound, which is the screen and not a frame of the stage', () => {
    const rest = page(null)
    for (const warm of warms()) warm(rest.renderer)
    expect(rest.drew).toHaveLength(0)
    expect(rest.bound()).toBeNull()
  })
})
