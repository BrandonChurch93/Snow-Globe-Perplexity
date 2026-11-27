import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { Assets, type AssetIndex } from '../src/core/assets'
import { setMeshLevel } from '../src/core/models'
import { levels } from '../src/core/quality'
import { prepareGroup } from '../src/core/textures'
import { buildTrunk, limbs } from '../src/miniature/trunk'
import * as fall from '../src/seasons/fall/miniature'

const root = new URL('../public/assets/', import.meta.url)

function drawn(g: THREE.BufferGeometry): number[] {
  const index = g.index!
  return Array.from(index.array as ArrayLike<number>).slice(0, index.count)
}

function piecesOf(g: THREE.BufferGeometry): { of: (vertex: number) => number; count: number } {
  const list = drawn(g)
  const piece = Array.from({ length: g.getAttribute('position').count }, (_, i) => i)
  const of = (vertex: number): number => {
    let i = vertex
    while (piece[i] !== i) i = piece[i] = piece[piece[i]!]!
    return i
  }
  for (let i = 0; i < list.length; i += 3) {
    const a = of(list[i]!)
    piece[of(list[i + 1]!)] = a
    piece[of(list[i + 2]!)] = a
  }
  return { of, count: new Set(list.map(of)).size }
}

it('leaves exactly the layout\'s pad twigs out of the trunk and nothing else, at every level', async () => {
  vi.stubGlobal('createImageBitmap', async (image: Blob) => {
    const { width, height } = await sharp(Buffer.from(await image.arrayBuffer())).metadata()
    return { width, height, close() {} }
  })
  try {
    const assets = new Assets()
    assets.use(JSON.parse(await readFile(new URL('index.json', root), 'utf8')) as AssetIndex, 'web')
    assets.fetchFile = async file => Uint8Array.from(await readFile(new URL(file, root))).buffer
    await prepareGroup(assets, 'shared')
    await prepareGroup(assets, 'fall')
    await fall.prepare()
    setMeshLevel(levels[0]!.id)

    const whole = buildTrunk('miniature-fall').geometry
    let bare: THREE.BufferGeometry | undefined
    fall.miniature().traverse(object => {
      if (object instanceof THREE.Mesh && object.name === 'trunk') bare = object.geometry
    })
    if (!bare) throw new Error('fall draws no mesh named trunk')

    const padTwigs = limbs.filter(l => l.kind === 'twig')
    expect(padTwigs.length).toBeGreaterThan(0)
    const all = piecesOf(whole)
    expect(all.count - piecesOf(bare).count).toBe(padTwigs.length)

    const at = whole.getAttribute('position')
    const middles = new Map<number, { sum: [number, number, number]; n: number }>()
    for (let i = 0; i < at.count; i++) {
      const piece = all.of(i)
      const m = middles.get(piece) ?? { sum: [0, 0, 0], n: 0 }
      m.sum[0] += at.getX(i)
      m.sum[1] += at.getY(i)
      m.sum[2] += at.getZ(i)
      m.n++
      middles.set(piece, m)
    }
    const theirs = new Set(
      padTwigs.map(twig => {
        const mid = [0, 1, 2].map(k => twig.points.reduce((sum, p) => sum + p[k]!, 0) / twig.points.length)
        let nearest = -1
        let least = Infinity
        for (const [piece, m] of middles) {
          const d = Math.hypot(m.sum[0] / m.n - mid[0]!, m.sum[1] / m.n - mid[1]!, m.sum[2] / m.n - mid[2]!)
          if (d < least) {
            least = d
            nearest = piece
          }
        }
        return nearest
      }),
    )
    expect(theirs.size).toBe(padTwigs.length)

    for (const level of levels) {
      setMeshLevel(level.id)
      const list = drawn(whole)
      const without: number[] = []
      for (let i = 0; i < list.length; i += 3) if (!theirs.has(all.of(list[i]!))) without.push(list[i]!, list[i + 1]!, list[i + 2]!)
      expect(without.length, level.id).toBeLessThan(list.length)
      expect(drawn(bare), level.id).toEqual(without)
    }
  } finally {
    setMeshLevel(levels[0]!.id)
    vi.unstubAllGlobals()
  }
})
