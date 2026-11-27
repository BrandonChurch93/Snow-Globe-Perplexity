import fs from 'node:fs'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config'
import * as assets from '../src/core/assets'
import * as models from '../src/core/models'
import type { SdfGrid } from '../src/core/stage'
import * as textures from '../src/core/textures'
import * as file from '../src/scene/gridfile'
import { colliderCells, gridOf, innerRadiusMm } from '../src/scene/layout'
import * as seasons from '../src/seasons'
import { gridFile, seasonGrids } from '../tools/lib/grids.mjs'
import { rel } from '../tools/lib/paths.mjs'

const bytes = (g: SdfGrid): Buffer => Buffer.from(g.data.buffer, g.data.byteOffset, g.data.byteLength)
const fromFile = (packed: Uint8Array): Promise<SdfGrid> => file.readGrid(new Blob([new Uint8Array(packed)]).stream() as ReadableStream<Uint8Array>)

// The build makes each season's collider and the page fetches it (tools/lib/grids.mjs). These are the build's own steps, run
// here: the kit's collider from the models of the web set, the file made of it, and the page's reading of that file.
describe('the colliders the build makes', () => {
  const src = { assets, textures, models, seasons, file }
  let made: Record<string, SdfGrid> = {}

  beforeAll(async () => {
    made = (await seasonGrids(src)) as Record<string, SdfGrid>
  }, 180000)

  it('a grid file gives every kind of number back to the bit', async () => {
    const n = 5
    const odd = [0, -0, NaN, Infinity, -Infinity, 1e-45, -1e-45, 3.4028234663852886e38, -3.4028234663852886e38, 1.17549435e-38, 0.1, -0.1, 57, -57]
    const data = new Float32Array(n * n * n)
    for (let i = 0; i < data.length; i++) data[i] = i < odd.length ? odd[i]! : Math.sin(i * 12.9898) * 43758.5453
    new Uint32Array(data.buffer)[data.length - 1] = 0xffc12345
    const grid = { n, sizeMm: 113.99999999999999, data }
    const plain = file.unpackGrid(file.packGrid(grid))
    expect(plain.n).toBe(n)
    expect(plain.sizeMm).toBe(grid.sizeMm)
    expect(bytes(plain).equals(bytes(grid))).toBe(true)
    const read = await fromFile(gridFile(src, grid))
    expect(bytes(read).equals(bytes(grid))).toBe(true)
    expect(() => file.unpackGrid(file.packGrid(grid).subarray(1))).toThrow()
    expect(() => file.packGrid({ n, sizeMm: 1, data: new Float32Array(7) })).toThrow()
  })

  it.each(config.seasons)('the file of %s holds the grid gridOf made of it, to the bit', async (season) => {
    const grid = made[season]!
    expect(grid.n).toBe(colliderCells)
    expect(grid.sizeMm).toBe(2 * innerRadiusMm)
    const plain = gridOf(() => 0)
    expect(grid.data.length).toBe(plain.data.length)
    const packed = gridFile(src, grid)
    const read = await fromFile(packed)
    expect(read.n).toBe(grid.n)
    expect(read.sizeMm).toBe(grid.sizeMm)
    expect(bytes(read).equals(bytes(grid))).toBe(true)
    expect(packed.length).toBeLessThan(bytes(grid).length)
  })

  it('no two seasons have the same grid, and every grid has an inside and an outside', () => {
    const seen = new Set<string>()
    for (const season of config.seasons) {
      const g = made[season]!
      seen.add(bytes(g).toString('base64'))
      let inside = 0
      let outside = 0
      let odd = 0
      for (const v of g.data) {
        if (!Number.isFinite(v)) odd++
        else if (v < 0) inside++
        else outside++
      }
      expect(odd).toBe(0)
      expect(inside).toBeGreaterThan(1000)
      expect(outside).toBeGreaterThan(1000)
    }
    expect(seen.size).toBe(config.seasons.length)
  })

  // A film is drawn from the full set and the build's grids are made from the web set: the two must say the same of every model.
  it.skipIf(!fs.existsSync(rel('assets-full', 'shared')))(
    'the models of the full set give the same grids',
    async () => {
      vi.resetModules()
      const again = {
        assets: await import('../src/core/assets'),
        textures: await import('../src/core/textures'),
        models: await import('../src/core/models'),
        seasons: await import('../src/seasons'),
        file: await import('../src/scene/gridfile'),
      }
      const full = (await seasonGrids(again, rel('assets-full'))) as Record<string, SdfGrid>
      for (const season of config.seasons) expect(bytes(full[season]!).equals(bytes(made[season]!)), season).toBe(true)
    },
    180000,
  )
})

// The browser's own record of the page's requests called a grid's file cancelled when the page inflated it as it came,
// though the grid was whole: the page takes the file whole and inflates it after.
describe('a grid the page fetches', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is taken whole before it is inflated, and is the grid of its file to the bit', async () => {
    const n = 6
    const data = new Float32Array(n * n * n)
    for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 78.233) * 43758.5453
    const grid = { n, sizeMm: 113.99999999999999, data }
    const packed = gridFile({ file }, grid)
    const asked: string[] = []
    vi.stubGlobal('fetch', async (address: URL) => {
      asked.push(address.href)
      return {
        ok: true,
        get body(): never {
          throw new Error('the file was read as it came')
        },
        arrayBuffer: async () => new Uint8Array(packed).buffer,
      }
    })
    const read = await file.fetchGrid('summer', 'abc', 'https://host.example/globe/')
    expect(asked).toEqual(['https://host.example/globe/assets/grids/summer.bin?v=abc'])
    expect(read.n).toBe(n)
    expect(read.sizeMm).toBe(grid.sizeMm)
    expect(bytes(read).equals(bytes(grid))).toBe(true)
  })

  it('names the season whose file the host does not give', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }))
    await expect(file.fetchGrid('fall', 'abc', 'https://host.example/')).rejects.toThrow('collider did not load: fall')
  })
})
