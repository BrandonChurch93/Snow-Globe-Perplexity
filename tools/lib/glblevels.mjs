import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { readGlb, writeGlb } from './glbpack.mjs'

/**
 * Lighter meshes for the lower quality levels of the live page (`live.quality` in config/showcase.json).
 * Every mesh of a model is simplified once per level by meshoptimizer's simplifier. The simplifier only ever moves a vertex
 * onto a neighbour, so a lighter mesh is a second list of triangles over the very same vertices: no vertex is added, moved or
 * dropped, nothing is replaced by a stand-in, borders and the seams of the UV map stay where they are (a seam is only
 * collapsed along itself), and the picture differs by at most the error named here.
 * The lists are stored in the same .glb, as index accessors that `primitive.extras.levels` names by level:
 * `{ medium: 12, low: 13 }`. The page reads them in src/core/models.ts; a reader that does not know them sees the full mesh.
 */

/**
 * Per level: `error`, the largest distance in the units of the model (millimetres) that a surface may move, and `worth`: a list
 * is kept only when it holds at most this share of the triangles of the list above it, because every list is weight on the
 * wire for every visitor. The first level of `live.quality` is the full mesh and has no entry.
 */
export const LEVELS = { medium: { error: 0.03, worth: 0.75 }, low: { error: 0.1, worth: 0.9 } }
/** How much a turn of the normal counts against a move of the surface, so that shading keeps its shape too. */
export const NORMAL_WEIGHT = 0.5

const FLOAT = 5126
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const BYTES = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }
const ARRAYS = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }

/** The values of an accessor that fills its view without gaps, or null. */
function read(json, bin, index) {
  const a = json.accessors?.[index]
  if (!a || a.bufferView === undefined || a.sparse || !ARRAYS[a.componentType]) return null
  const view = json.bufferViews[a.bufferView]
  const size = COMPONENTS[a.type] * BYTES[a.componentType]
  if ((view.byteStride ?? size) !== size) return null
  const at = bin.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return new ARRAYS[a.componentType](bin.buffer.slice(at, at + a.count * size))
}

/**
 * The same triangles over the same vertices, in the order that suits the vertex cache: the GPU draws them faster, and the
 * triangle codec of the web set (tools/lib/glbpack.mjs) needs about 2 bytes a triangle for them instead of 4.
 */
function inCacheOrder(list, vertices) {
  const work = new Uint32Array(list)
  const [remap] = MeshoptEncoder.reorderMesh(work, true, false)
  const old = new Uint32Array(vertices)
  for (let v = 0; v < remap.length; v++) if (remap[v] !== 0xffffffff) old[remap[v]] = v
  return work.map((v) => old[v])
}

/**
 * Returns the .glb with the lighter lists added, and per mesh how many triangles each level holds.
 * `levels` overrides LEVELS. A mesh without indices, without normals or of a kind other than triangles is left as it is.
 */
export async function addLevels(buf, { levels = LEVELS } = {}) {
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready])
  const { json, bin } = readGlb(buf)
  if ((json.extensionsUsed ?? []).includes('EXT_meshopt_compression') || (json.buffers ?? []).length !== 1 || json.buffers[0].uri !== undefined) return { glb: buf, meshes: [] }
  const parts = [bin]
  let length = bin.length
  const meshes = []
  let added = 0
  for (const mesh of json.meshes ?? []) {
    for (const p of mesh.primitives ?? []) {
      if ((p.mode ?? 4) !== 4 || p.indices === undefined || p.extras?.levels) continue
      const type = json.accessors[p.indices].componentType
      const index = type === 5123 || type === 5125 ? read(json, bin, p.indices) : null
      const position = json.accessors[p.attributes?.POSITION]?.type === 'VEC3' && json.accessors[p.attributes.POSITION].componentType === FLOAT ? read(json, bin, p.attributes.POSITION) : null
      const normal = json.accessors[p.attributes?.NORMAL]?.type === 'VEC3' && json.accessors[p.attributes.NORMAL].componentType === FLOAT ? read(json, bin, p.attributes.NORMAL) : null
      if (!index || !position || !normal || index.length % 3 !== 0 || normal.length !== position.length) continue
      const row = { name: mesh.name ?? '', triangles: index.length / 3 }
      const found = {}
      let above = index.length
      for (const [level, { error, worth }] of Object.entries(levels)) {
        const [list, moved] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(index), position, 3, normal, 3, [NORMAL_WEIGHT, NORMAL_WEIGHT, NORMAL_WEIGHT], null, 0, error, ['ErrorAbsolute'])
        if (list.length === 0 || list.length % 3 !== 0 || list.length > above * worth) continue
        for (const v of list) if (v >= position.length / 3) throw new Error(`the ${level} list of ${row.name} names a vertex the mesh does not have`)
        const data = new ARRAYS[type](inCacheOrder(list, position.length / 3))
        const padding = (4 - (length % 4)) % 4
        if (padding) parts.push(Buffer.alloc(padding))
        length += padding
        json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.byteLength })
        json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: type, count: data.length, type: 'SCALAR' })
        parts.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
        length += data.byteLength
        found[level] = json.accessors.length - 1
        row[level] = data.length / 3
        row[`${level}Moved`] = moved
        above = data.length
        added++
      }
      if (Object.keys(found).length) p.extras = { ...(p.extras ?? {}), levels: found }
      meshes.push(row)
    }
  }
  if (!added) return { glb: buf, meshes }
  json.buffers[0].byteLength = length
  return { glb: writeGlb(json, Buffer.concat(parts, length)), meshes }
}
