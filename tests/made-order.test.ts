import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config'
import { createStage, MADE_ORDER } from '../src/scene/createStage'
import { kitOf } from '../src/seasons'

/**
 * The order in which a page that captures makes the seasons' sets, and the numbers three.js gives to what is made.
 *
 * three.js numbers every object and every material as it is made, and it draws two solid things that nothing else parts in
 * the order of those numbers. The page made each set when the files of its season had come, so the order of the sets, and
 * every number in them, hung on which season's files came first. Here the files are made to come in other orders, and the
 * order of making and the numbers are read each time.
 */

/** The order the sets are made in, written out here so that a change of it in the source is seen. */
const ORDER = ['winter', 'spring', 'fall', 'summer']

/** How many objects, each with a material of its own, the reading of a season's models leaves behind, as the reader of a model file does. */
const READ: Record<string, number> = { winter: 3, spring: 5, summer: 7, fall: 11 }
/** How many objects, each with a material of its own, a season's set has. */
const SET: Record<string, number> = { winter: 4, spring: 6, summer: 2, fall: 8 }

interface Numbers {
  objects: number[]
  materials: number[]
}

interface Inner {
  makings: Map<string, { steps: (() => void)[] }>
  fetchCollider(season: string): Promise<void>
}

const turns = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve()
}

const thing = (): THREE.Mesh => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial())

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * A page and its stage. With `order` it is the page that captures, without it the page that paints. The files of a season
 * come when the test says so, and the reading of its models makes objects and materials then, as on the page. What a
 * making makes is numbered from the last thing made before the page asked for anything.
 */
function pageOf(order: readonly string[] | null) {
  const base: Record<string, unknown> = {
    capabilities: { getMaxAnisotropy: () => 1 },
    shadowMap: { enabled: false, type: 0, autoUpdate: true, needsUpdate: false },
    extensions: { has: () => false },
    info: { render: { calls: 0, triangles: 0, points: 0, lines: 0 } },
    properties: { get: () => ({ uniforms: {} }) },
  }
  const renderer = new Proxy(base, { get: (t, k: string) => (k in t ? t[k] : () => undefined) })
  const gl = { ALIASED_POINT_SIZE_RANGE: 1, getParameter: () => new Float32Array([1, 256]) }
  const n = 8
  const source = { count: n, step: 0, pos: new Float32Array(n * 3), prev: new Float32Array(n * 3), sizes: new Float32Array(n), kindOf: new Uint8Array(n), kinds: ['flake'], state: new Uint8Array(n), liquid: new Float64Array(8) }
  const assets = { entries: () => [] }
  const stage = createStage({ renderer, gl } as never, source as never, assets as never, order)
  const inner = stage as unknown as Inner
  inner.fetchCollider = () => Promise.resolve()

  const asked: string[] = []
  const made: string[] = []
  const numbers: Record<string, Numbers> = {}
  const come = new Map<string, (how?: Error) => void>()
  let from: THREE.Mesh | null = null

  for (const season of config.seasons) {
    vi.spyOn(kitOf(season), 'prepare').mockImplementation(() => {
      asked.push(season)
      return new Promise<void>((resolve, reject) => {
        come.set(season, (how) => {
          if (how) return reject(how)
          for (let i = 0; i < READ[season]!; i++) thing()
          resolve()
        })
      })
    })
    inner.makings.set(season, {
      steps: [
        () => {
          const zero = from!
          const things = Array.from({ length: SET[season]! }, thing)
          made.push(season)
          numbers[season] = {
            objects: things.map((t) => t.id - zero.id),
            materials: things.map((t) => (t.material as THREE.Material).id - (zero.material as THREE.Material).id),
          }
        },
      ],
    })
  }

  return {
    stage,
    asked,
    made,
    numbers,
    /** The page asks for `seasons` in one go, as src/main.ts does on a page that captures. */
    ask(seasons: readonly string[] = config.seasons): Promise<unknown> {
      from = thing()
      return Promise.all(seasons.map((s) => stage.prepare?.(s)))
    },
    /** The files of `season` have come, or have failed to. The page then has all the turns it can use before anything else comes. */
    async comes(season: string, how?: Error): Promise<void> {
      come.get(season)!(how)
      await turns()
    },
  }
}

/** A page that captures, the files of its seasons coming in the order `ends`: what was made in which order, and with which numbers. */
async function captured(ends: readonly string[], asks: readonly string[] = config.seasons): Promise<{ made: string[]; numbers: Record<string, Numbers> }> {
  const page = pageOf(MADE_ORDER)
  const all = page.ask(asks)
  await turns()
  for (const season of ends) await page.comes(season)
  await all
  await page.stage.settled?.()
  return { made: page.made, numbers: page.numbers }
}

const ENDS: Record<string, string[]> = {
  'in the order the page asks': ['winter', 'spring', 'summer', 'fall'],
  'in the order of making': ['winter', 'spring', 'fall', 'summer'],
  // The order of the two drawings of film frame 2828 that had the other pixel in the count of Nov 28 (b012 and c017): their sets were made fall, winter, spring, summer.
  'fall first': ['fall', 'winter', 'spring', 'summer'],
  'winter last': ['spring', 'summer', 'fall', 'winter'],
  'all reversed': ['fall', 'summer', 'spring', 'winter'],
  'summer first, winter third': ['summer', 'fall', 'winter', 'spring'],
}

describe('the sets of a page that captures', () => {
  it('has one order of making, of the same seasons as the config', () => {
    expect(MADE_ORDER).toEqual(ORDER)
    expect([...ORDER].sort()).toEqual([...config.seasons].sort())
  })

  it('is the stage of the page that captures, and of no other page', () => {
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
    const stages = main.split('\n').filter((l) => l.includes('createStage(gfx'))
    expect(stages.map((l) => l.trim())).toEqual(['const stage = levelled(createStage(gfx, particles, assets, MADE_ORDER))', 'const stage = levelled(createStage(gfx, particles, assets))'])
    expect(main.indexOf('if (capture) {')).toBeLessThan(main.indexOf(stages[0]!))
    expect(main.indexOf(stages[0]!)).toBeLessThan(main.indexOf('} else {', main.indexOf('if (capture) {')))
    expect(main.indexOf('} else {', main.indexOf('if (capture) {'))).toBeLessThan(main.indexOf(stages[1]!))
  })

  for (const [name, ends] of Object.entries(ENDS)) {
    it(`are made in the one order when the files come ${name}`, async () => {
      const { made } = await captured(ends)
      expect(made).toEqual(ORDER)
    })
  }

  it('have the same numbers whichever files come first', async () => {
    const [first, ...others] = Object.values(ENDS)
    const usual = await captured(first!)
    expect(Object.keys(usual.numbers).sort()).toEqual([...ORDER].sort())
    for (const ends of others) {
      const got = await captured(ends)
      expect(got.numbers, `the files came ${ends.join(', ')}`).toEqual(usual.numbers)
    }
    // Every set is numbered after every reading of a model, and the sets one after another in the order of making.
    const read = Object.values(READ).reduce((a, b) => a + b, 0)
    let next = read + 1
    for (const season of ORDER) {
      const want = Array.from({ length: SET[season]! }, (_, i) => next + i)
      expect(usual.numbers[season], season).toEqual({ objects: want, materials: want })
      next += SET[season]!
    }
  })

  it('are not begun before the last file has come', async () => {
    for (const ends of Object.values(ENDS)) {
      const page = pageOf(MADE_ORDER)
      const all = page.ask()
      await turns()
      for (const season of ends.slice(0, -1)) {
        await page.comes(season)
        expect(page.made, `the files came ${ends.join(', ')}, and ${ends.at(-1)}'s have not`).toEqual([])
      }
      await page.comes(ends.at(-1)!)
      await all
      expect(page.made).toEqual(ORDER)
    }
  })

  it('have their files read side by side, begun in the order the page asks', async () => {
    const page = pageOf(MADE_ORDER)
    const all = page.ask()
    await turns()
    expect(page.asked).toEqual(config.seasons)
    expect(page.made).toEqual([])
    for (const season of config.seasons) await page.comes(season)
    await all
  })

  it('are all made, in the one order and with the same numbers, where the page asks for one season only', async () => {
    const usual = await captured(ENDS['in the order the page asks']!)
    for (const only of config.seasons) {
      const page = pageOf(MADE_ORDER)
      const one = page.ask([only])
      await turns()
      expect(page.asked, `the page asked for ${only}`).toEqual([only])
      await page.comes(only)
      expect(page.asked.slice().sort(), `the page asked for ${only}`).toEqual([...config.seasons].sort())
      expect(page.made).toEqual([])
      for (const season of ['fall', 'summer', 'spring', 'winter']) if (season !== only) await page.comes(season)
      await one
      await page.stage.settled?.()
      expect(page.made, `the page asked for ${only}`).toEqual(ORDER)
      expect(page.numbers, `the page asked for ${only}`).toEqual(usual.numbers)
    }
  })

  it('fail as one when the files of a season fail, and nothing waits for ever', async () => {
    for (const lost of config.seasons) {
      const page = pageOf(MADE_ORDER)
      const each = config.seasons.map((s) => page.stage.prepare!(s).then(() => 'made', (e: Error) => e.message))
      await turns()
      for (const season of ['fall', 'summer', 'spring', 'winter']) await page.comes(season, season === lost ? new Error(`no ${lost}`) : undefined)
      expect(await Promise.all(each), `${lost}'s files failed`).toEqual(config.seasons.map(() => `no ${lost}`))
      expect(page.made).toEqual([])
    }
  })
})

describe('the sets of a page that paints', () => {
  it('are made each when its own files have come, as before', async () => {
    for (const ends of Object.values(ENDS)) {
      const page = pageOf(null)
      const all = page.ask()
      await turns()
      const seen: string[][] = []
      for (const season of ends) {
        await page.comes(season)
        seen.push([...page.made])
      }
      await all
      expect(seen, `the files came ${ends.join(', ')}`).toEqual(ends.map((_, i) => ends.slice(0, i + 1)))
    }
  })

  it('asks for no season the page did not ask for, and waits for none', async () => {
    const page = pageOf(null)
    const first = page.ask(['summer'])
    await turns()
    await page.comes('summer')
    await first
    expect(page.asked).toEqual(['summer'])
    expect(page.made).toEqual(['summer'])
  })
})
