import { describe, expect, it } from 'vitest'
import { inSteps, stepsOf, whole, type InSteps } from '../src/scene/steps'
import { kit as fall } from '../src/seasons/fall'
import { kit as spring } from '../src/seasons/spring'
import { kit as summer } from '../src/seasons/summer'
import { kit as winter } from '../src/seasons/winter'

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
