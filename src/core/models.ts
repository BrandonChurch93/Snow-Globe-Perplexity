import type * as THREE from 'three'
import { BufferAttribute } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader, type GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { levels as qualityLevels } from './quality'
import type { StageQuality } from './stage'
import { binary } from './textures'

const models = new Map<string, Map<string, THREE.BufferGeometry>>()
const loading = new Map<string, Promise<void>>()

type Indices = Uint16Array | Uint32Array
/** One list of triangles of a mesh. Every list of a mesh has the length of the full one, so the GPU keeps one buffer for them all; `count` says how much of it is drawn. */
export interface LevelList {
  array: Indices
  count: number
}

/** The quality levels, the first being the full mesh, and the one the page draws now. */
const ORDER = qualityLevels.map((l) => l.id)
let current = ORDER[0]!
const live = new Set<WeakRef<LevelIndex>>()

/**
 * The index of a mesh that has lighter lists of triangles for the lower quality levels (tools/lib/glblevels.mjs makes them
 * for the web set). It is an ordinary index to three.js and to the code of every part: a geometry may be cloned, moved and
 * given new attributes, and its copy follows the level like the model it came from. Every draw of the mesh reads it, so the
 * shadow and the mirror get lighter with the picture. Code that reads the triangles one by one (a merge, a list without an
 * index) reads the list of the level the page is at, and what it makes of them stays as it is.
 */
export class LevelIndex extends BufferAttribute {
  constructor(readonly lists: Record<string, LevelList>) {
    const top = lists[ORDER[0]!]!
    super(top.array, 1)
    live.add(new WeakRef(this))
    this.use(current)
  }

  /** Takes the list of a level, or of the nearest level above it that has one. */
  use(level: string): void {
    let list = this.lists[ORDER[0]!]!
    for (let i = ORDER.indexOf(level); i > 0; i--) {
      const l = this.lists[ORDER[i]!]
      if (l) {
        list = l
        break
      }
    }
    if (this.array === list.array) return
    this.array = list.array
    ;(this as unknown as { count: number }).count = list.count
    this.needsUpdate = true
  }

  override clone(): this {
    const copy = new LevelIndex(this.lists)
    copy.name = this.name
    copy.usage = this.usage
    return copy as this
  }
}

/** The level whose meshes the page draws from now on. Every model that is prepared, and every copy a part made of one, follows. */
export function setMeshLevel(level: string): void {
  current = ORDER.includes(level) ? level : ORDER[0]!
  for (const ref of live) {
    const index = ref.deref()
    if (index) index.use(current)
    else live.delete(ref)
  }
}

export const meshLevel = (): string => current

/** The quality level a stage was told, by what it was told: the stage takes the numbers of a level, not its name. */
export function meshLevelOf(q: StageQuality): string {
  const l = qualityLevels.find((x) => x.particleFraction === q.particleFraction && x.shadowMapPx === q.shadowMapPx && x.surfaceReflection === q.surfaceReflection)
  return (l ?? qualityLevels[0]!).id
}

/** Puts a LevelIndex in place of the index of a geometry whose primitive names lighter lists (`extras.levels`: level to accessor). */
async function takeLevels(parser: GLTFParser, g: THREE.BufferGeometry): Promise<void> {
  const named = g.userData.levels as Record<string, number> | undefined
  const index = g.index
  if (!named || !index) return
  const full = index.array as Indices
  const lists: Record<string, LevelList> = { [ORDER[0]!]: { array: full, count: full.length } }
  for (const [level, accessor] of Object.entries(named)) {
    if (!ORDER.includes(level) || level === ORDER[0]) continue
    const got = ((await parser.getDependency('accessor', accessor)) as THREE.BufferAttribute).array as Indices
    if (got.length > full.length) continue
    const array = new (full.constructor as new (n: number) => Indices)(full.length)
    array.set(got)
    lists[level] = { array, count: got.length }
  }
  if (Object.keys(lists).length > 1) g.setIndex(new LevelIndex(lists))
}

export function prepareModel(path: string): Promise<void> {
  let p = loading.get(path)
  if (!p) {
    // The web set packs a model's streams with EXT_meshopt_compression (tools/lib/glbpack.mjs); the full set's models have none and are read as before.
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    p = loader.parseAsync(binary(path), '').then(async (gltf) => {
      const found = new Map<string, THREE.BufferGeometry>()
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry.userData.extras = o.userData
        found.set(o.name, mesh.geometry)
        ;(mesh.material as THREE.Material).dispose()
      })
      await Promise.all([...found.values()].map((g) => takeLevels(gltf.parser, g)))
      models.set(path, found)
    })
    loading.set(path, p)
  }
  return p
}

export function geometry(path: string, name: string): THREE.BufferGeometry {
  const g = models.get(path)?.get(name)
  if (!g) throw new Error(`model is not prepared or has no mesh named ${name}: ${path}`)
  return g
}

export const hasModel = (path: string): boolean => models.has(path)

export function geometryNames(path: string): string[] {
  return [...(models.get(path)?.keys() ?? [])]
}

export function modelTriangles(path: string): number {
  let n = 0
  for (const g of models.get(path)?.values() ?? []) n += (g.index ? g.index.count : g.getAttribute('position').count) / 3
  return n
}
