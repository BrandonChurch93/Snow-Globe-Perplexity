import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Assets, type AssetFile } from '../src/core/assets'
import { detailOwed, loadDetail, prepareGroup, texture } from '../src/core/textures'

interface Bitmap {
  of: string
  width: number
  height: number
  close: () => void
}

const file = (path: string): AssetFile => ({ path, bytes: 1, sha: path })

/** A set of one group with `names`, each a picture with a `.first.` file, on a page that draws its first picture from those. */
function pageOf(group: string, names: string[]): Assets {
  const assets = new Assets()
  assets.use({ version: 1, seasonHashes: {}, sets: { web: { [group]: names.flatMap((n) => [file(`${group}/${n}.webp`), file(`${group}/${n}.first.webp`)]) } } }, 'web')
  assets.firstOnly = true
  assets.fetchFile = async (path) => new TextEncoder().encode(path).buffer as ArrayBuffer
  return assets
}

const frames = (n: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, n * 16))

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', async (from: Blob | Bitmap): Promise<Bitmap> => {
    const of = from instanceof Blob ? await from.text() : from.of
    return { of, width: 2, height: 2, close: () => undefined }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the whole pictures of a page that paints', () => {
  it('are not handed to the GPU while the picture does not rest, and each of them is when it does', async () => {
    const group = 'in-the-air'
    const assets = pageOf(group, ['a.lin', 'b.srgb.tile', 'c.lin.w2048'])
    await prepareGroup(assets, group)
    const names = ['a.lin', 'b.srgb.tile', 'c.lin.w2048'].map((n) => `${group}/${n}.png`)
    expect(detailOwed(group)).toBe(names.length)
    const of = (): string[] => names.map((n) => (texture(n).image as Bitmap).of)
    const versions = (): number[] => names.map((n) => texture(n).version)
    const first = of()
    const drawn = versions()
    expect(first.every((f) => f.endsWith('.first.webp'))).toBe(true)

    let lands: () => void = () => undefined
    const air = new Promise<void>((resolve) => (lands = resolve))
    let asked = 0
    const all = loadDetail(assets, () => (asked++, air))
    await frames(12)
    expect(asked, 'asked before the first of them is handed over').toBe(1)
    expect(of()).toEqual(first)
    expect(versions()).toEqual(drawn)

    lands()
    await all
    expect(of().every((f) => !f.endsWith('.first.webp'))).toBe(true)
    expect(versions()).toEqual(drawn.map((v) => v + 1))
    expect(asked, 'asked before each').toBe(names.length)
    expect(detailOwed(group)).toBe(0)
  })

  it('are handed over as they come where nothing is given to wait on, as on a page that is not shaken', async () => {
    const group = 'at-rest'
    const assets = pageOf(group, ['a.lin', 'b.srgb'])
    await prepareGroup(assets, group)
    const names = ['a.lin', 'b.srgb'].map((n) => `${group}/${n}.png`)
    await loadDetail(assets)
    expect(names.map((n) => (texture(n).image as Bitmap).of)).toEqual([`${group}/a.lin.webp`, `${group}/b.srgb.webp`])
    expect(detailOwed(group)).toBe(0)
  })

  it('keeps the first picture where what it waits on fails, and takes the whole one at the next call', async () => {
    const group = 'no-rest'
    const assets = pageOf(group, ['a.lin'])
    await prepareGroup(assets, group)
    const name = `${group}/a.lin.png`
    await loadDetail(assets, () => Promise.reject(new Error('no stage')))
    expect((texture(name).image as Bitmap).of).toBe(`${group}/a.lin.first.webp`)
    expect(detailOwed(group)).toBe(1)
    await loadDetail(assets)
    expect((texture(name).image as Bitmap).of).toBe(`${group}/a.lin.webp`)
    expect(detailOwed(group)).toBe(0)
  })
})
