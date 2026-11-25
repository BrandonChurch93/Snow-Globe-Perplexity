import fs from 'node:fs'
import { MeshoptSimplifier } from 'meshoptimizer'
import { addLevels } from '../../tools/lib/glblevels.mjs'

/**
 * Fewer triangles where no camera can tell (G15). Two steps, both by meshoptimizer's simplifier, which only ever moves a
 * vertex onto a neighbour: `thin` shortens the full list of a mesh before it is written (the surface moves by at most
 * `error` millimetres and the vertices nobody names any more are dropped), and `lighter` adds the lists of the lower
 * quality levels to the written .glb with a larger error than the web set would allow on its own (tools/lib/glblevels.mjs
 * leaves a mesh that already carries its lists alone).
 */
export async function thin(mesh, { share, error }) {
  await MeshoptSimplifier.ready
  const target = Math.floor((mesh.index.length * share) / 3) * 3
  const [list] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(mesh.index), mesh.position, 3, mesh.normal, 3, [0.5, 0.5, 0.5], null, target, error, ['ErrorAbsolute'])
  const count = mesh.position.length / 3
  const slot = new Int32Array(count).fill(-1)
  let kept = 0
  const index = new Uint32Array(list.length)
  for (let i = 0; i < list.length; i++) {
    if (slot[list[i]] < 0) slot[list[i]] = kept++
    index[i] = slot[list[i]]
  }
  const out = { ...mesh, index }
  for (const key of ['position', 'normal', 'uv', 'uv2', 'color', 'tangent']) {
    const from = mesh[key]
    if (!from) continue
    const size = from.length / count
    const to = new Float32Array(kept * size)
    for (let v = 0; v < count; v++) if (slot[v] >= 0) for (let c = 0; c < size; c++) to[slot[v] * size + c] = from[v * size + c]
    out[key] = to
  }
  return out
}

export async function lighter(file, levels) {
  const r = await addLevels(fs.readFileSync(file), { levels })
  fs.writeFileSync(file, r.glb)
  return r.meshes
}
