import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { Assets, type AssetIndex } from '../src/core/assets'
import { LevelIndex, setMeshLevel } from '../src/core/models'
import { levels } from '../src/core/quality'
import { prepareGroup } from '../src/core/textures'
import { whole } from '../src/scene/steps'
import * as village from '../src/seasons/summer/mini/village'

const root = new URL('../public/assets/', import.meta.url)

// The capture page reads the full set, which has no lighter lists, so no still shows a maker that cannot take one. This
// reads the web set, as a visitor's page does, at each of its quality levels.
it("makes summer's village from the web set at every quality level, and tells every corner of the lawn its blade whatever list is drawn", async () => {
  vi.stubGlobal('createImageBitmap', async (image: Blob) => {
    const { width, height } = await sharp(Buffer.from(await image.arrayBuffer())).metadata()
    return { width, height, close() {} }
  })
  try {
    const assets = new Assets()
    assets.use(JSON.parse(await readFile(new URL('index.json', root), 'utf8')) as AssetIndex, 'web')
    assets.fetchFile = async (file) => Uint8Array.from(await readFile(new URL(file, root))).buffer
    await prepareGroup(assets, 'shared')
    await prepareGroup(assets, 'summer')
    await village.prepare()

    const lawns = levels.map((level) => {
      setMeshLevel(level.id)
      let lawn: THREE.BufferGeometry | undefined
      whole(village.making()).traverse((object) => {
        if (object instanceof THREE.Mesh && (object.geometry as THREE.BufferGeometry).getAttribute('aBlade')) lawn = object.geometry
      })
      if (!lawn) throw new Error(`at ${level.id} the village has no lawn with blades`)
      const index = lawn.index
      const corners = lawn.getAttribute('position').count
      const drawn = Array.from({ length: index ? index.count : corners }, (_, k) => (index ? index.getX(k) : k))
      return { level: level.id, lists: index instanceof LevelIndex, drawn, corners, blades: Array.from(lawn.getAttribute('aBlade').array as Float32Array) }
    })

    const full = lawns[0]!
    expect(full.drawn.length, full.level).toBe(full.corners)
    // Without a lighter list of the lawn in the web set this would say nothing of the levels below the first.
    expect(full.lists).toBe(true)
    expect(Math.min(...lawns.map((l) => l.drawn.length))).toBeLessThan(full.corners)
    const faceOf = new Map(full.drawn.map((corner, k) => [corner, Math.floor(k / 3)]))
    expect(faceOf.size).toBe(full.corners)
    for (const lawn of lawns) {
      expect(lawn.corners, lawn.level).toBe(full.corners)
      expect(lawn.drawn.length, lawn.level).toBeGreaterThan(0)
      expect(lawn.blades.length, lawn.level).toBe(3 * full.corners)
      expect(lawn.blades.every((v, i) => v === full.blades[i]), lawn.level).toBe(true)
      // A corner is told the blade of its face in the full list. A lighter list that drew a face from the corners of two would draw it with the numbers of both.
      let mixed = 0
      for (let k = 0; k < lawn.drawn.length; k += 3) if (faceOf.get(lawn.drawn[k]!) !== faceOf.get(lawn.drawn[k + 1]!) || faceOf.get(lawn.drawn[k]!) !== faceOf.get(lawn.drawn[k + 2]!)) mixed++
      expect(mixed, lawn.level).toBe(0)
    }
    expect(full.blades.some((v) => v !== 0)).toBe(true)
  } finally {
    setMeshLevel(levels[0]!.id)
    vi.unstubAllGlobals()
  }
}, 300000)
