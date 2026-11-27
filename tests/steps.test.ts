import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { LIVE, LiveSession, type LiveSim } from '../src/app/session'
import { config } from '../src/config'
import { Governor } from '../src/core/quality'
import { FIT_MS, FramePace, GAPS, KEEP_MS, LAST_S, LEAST_MS, PACE, PRESS_S, SETTLE_S, SOON_MS, Wish, fitIn, inSteps, leftIn, runFor, spendIn, spendOf, stepsOf, whole, workIn, type InSteps, type Step } from '../src/scene/steps'
import { kit as fall } from '../src/seasons/fall'
import { kit as spring } from '../src/seasons/spring'
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
})

// Each way is built in a process of its own (tools/miniatures.mjs says why), so the tool is run as a builder runs it.
describe('the four miniatures', () => {
  it('are the same built in one piece, in steps, and in steps with a second making in between', () => {
    const run = spawnSync(process.execPath, [rel('tools', 'miniatures.mjs')], { encoding: 'utf8' })
    expect(run.stdout + run.stderr).toMatch(/^pass: sha256 [0-9a-f]{64}$/m)
    expect(run.status).toBe(0)
  }, 300000)
})
