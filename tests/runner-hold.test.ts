import { describe, expect, it } from 'vitest'
import { LiveRunner } from '../src/particles/engine/remote'
import { blockoutEmitters, blockoutSdf } from './blockout'

describe('a runner held until the stage has prepared the opening season', () => {
  const made = (): { runner: LiveRunner; asked: string[]; prepare: () => void } => {
    const grid = blockoutSdf()
    const asked: string[] = []
    let prepared = false
    const runner = new LiveRunner({ season: 'spring', fraction: 0.05 })
    runner.setCollider((season) => {
      if (!prepared) throw new Error(`model is not prepared: ${season}`)
      asked.push(season)
      return grid
    }, blockoutEmitters())
    return { runner, asked, prepare: () => (prepared = true) }
  }

  it('asks no collider for a reset that comes before the release, and asks the opening season at the release', () => {
    const { runner, asked, prepare } = made()
    runner.hold()
    expect(() => runner.reset()).not.toThrow()
    expect(asked).toEqual([])
    prepare()
    runner.release('spring')
    expect(asked).toEqual(['spring'])
    expect(runner.season).toBe('spring')
    expect(runner.step).toBe(0)
  })

  it('keeps the season a held reset named when the release names none', () => {
    const { runner, asked, prepare } = made()
    runner.hold()
    runner.reset('fall')
    runner.reset()
    prepare()
    runner.release()
    expect(asked).toEqual(['fall'])
    expect(runner.season).toBe('fall')
  })

  it('resets at once when it is not held, as before', () => {
    const { runner } = made()
    expect(() => runner.reset()).toThrow(/not prepared/)
  })
})
