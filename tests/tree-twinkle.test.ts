import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { Assets, type AssetIndex } from '../src/core/assets'
import { stageQuality, topLevel } from '../src/core/quality'
import { prepareGroup } from '../src/core/textures'
import { newFrame } from '../src/scene/frame'
import { kitOf } from '../src/seasons'
import * as fall from '../src/seasons/fall/miniature'
import * as spring from '../src/seasons/spring/miniature'
import * as summer from '../src/seasons/summer/miniature'
import * as winter from '../src/seasons/winter/miniature'

const parts = { winter, spring, summer, fall }
const root = new URL('../public/assets/', import.meta.url)

it('binds each miniature to its own twinkle object and updates only the one it owns', async () => {
  vi.stubGlobal('createImageBitmap', async (image: Blob) => {
    const { width, height } = await sharp(Buffer.from(await image.arrayBuffer())).metadata()
    return { width, height, close() {} }
  })
  try {
    const assets = new Assets()
    assets.use(JSON.parse(await readFile(new URL('index.json', root), 'utf8')) as AssetIndex, 'web')
    assets.fetchFile = async file => Uint8Array.from(await readFile(new URL(file, root))).buffer
    await prepareGroup(assets, 'shared')
    const bindings = new Map<string, { value: THREE.Vector4 }>()
    for (const [season, part] of Object.entries(parts)) {
      await prepareGroup(assets, season)
      await part.prepare()
      const found = new Set<{ value: THREE.Vector4 }>()
      const materials = new Set<THREE.Material>()
      part.miniature().traverse(object => {
        if (object instanceof THREE.Mesh) for (const material of [object.material].flat()) materials.add(material)
      })
      for (const material of materials) {
        const lib = THREE.ShaderLib.standard
        const shader = { ...lib, uniforms: THREE.UniformsUtils.clone(lib.uniforms) } as THREE.WebGLProgramParametersWithUniforms
        material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
        const bound = (material instanceof THREE.ShaderMaterial ? material.uniforms : shader.uniforms).uTwinkle
        if (bound) found.add(bound)
      }
      expect(found.size, season).toBe(1)
      for (const bound of found) bindings.set(season, bound)
    }
    expect(new Set(bindings.values()).size).toBe(4)
    expect(new Set(Array.from(bindings.values(), bound => bound.value)).size).toBe(4)
    for (const [season, part] of Object.entries(parts)) {
      const before = new Map(Array.from(bindings, ([name, bound]) => [name, bound.value.toArray()]))
      const frame = newFrame(kitOf(season), stageQuality(topLevel))
      part.update({ time: 3.25, period: 7, sinceLanding: 2, arrived: 1, beat: null, seed: 1, frame })
      for (const [name, bound] of bindings) {
        if (name === season && season !== 'spring') expect(bound.value.toArray(), season).not.toEqual(before.get(name))
        else expect(bound.value.toArray(), `${season} → ${name}`).toEqual(before.get(name))
      }
    }
  } finally {
    vi.unstubAllGlobals()
  }
})
