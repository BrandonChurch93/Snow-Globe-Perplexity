import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { PACE, inSteps, runFor, spendOf, stepsOf, whole, type InSteps, type Step } from '../src/scene/steps'
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

// Each way is built in a process of its own (tools/miniatures.mjs says why), so the tool is run as a builder runs it.
describe('the four miniatures', () => {
  it('are the same built in one piece, in steps, and in steps with a second making in between', () => {
    const run = spawnSync(process.execPath, [rel('tools', 'miniatures.mjs')], { encoding: 'utf8' })
    expect(run.stdout + run.stderr).toMatch(/^pass: sha256 [0-9a-f]{64}$/m)
    expect(run.status).toBe(0)
  }, 300000)
})
