import fs from 'node:fs'
import { readGlb, writeGlb } from '../../tools/lib/glbpack.mjs'

export function addLists(file, name, lists) {
  const { json, bin } = readGlb(fs.readFileSync(file))
  const p = json.meshes.find((m) => m.name === name).primitives[0]
  const type = json.accessors[p.indices].componentType
  const full = json.accessors[p.indices].count
  const A = type === 5125 ? Uint32Array : Uint16Array
  const parts = [bin]
  let length = bin.length
  const found = {}
  for (const [level, list] of Object.entries(lists)) {
    if (list.length === 0 || list.length % 3 !== 0 || list.length > full) throw new Error(`the ${level} list of ${name} has ${list.length} indices, the full one ${full}`)
    const data = new A(list)
    const padding = (4 - (length % 4)) % 4
    if (padding) parts.push(Buffer.alloc(padding))
    length += padding
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.byteLength })
    json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: type, count: data.length, type: 'SCALAR' })
    parts.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
    length += data.byteLength
    found[level] = json.accessors.length - 1
  }
  p.extras = { ...(p.extras ?? {}), levels: found }
  json.buffers[0].byteLength = length
  const out = writeGlb(json, Buffer.concat(parts, length))
  fs.writeFileSync(file, out)
  return out.length
}
