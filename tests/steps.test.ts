import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { Governor } from '../src/core/quality'
import { FIT_MS, FramePace, GAPS, KEEP_MS, LEAST_MS, PACE, SOON_MS, fitIn, inSteps, leftIn, runFor, spendIn, spendOf, stepsOf, whole, type InSteps, type Step } from '../src/scene/steps'
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

// Each way is built in a process of its own (tools/miniatures.mjs says why), so the tool is run as a builder runs it.
describe('the four miniatures', () => {
  it('are the same built in one piece, in steps, and in steps with a second making in between', () => {
    const run = spawnSync(process.execPath, [rel('tools', 'miniatures.mjs')], { encoding: 'utf8' })
    expect(run.stdout + run.stderr).toMatch(/^pass: sha256 [0-9a-f]{64}$/m)
    expect(run.status).toBe(0)
  }, 300000)
})
