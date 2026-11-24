import fs from 'node:fs'
import path from 'node:path'

const FLOAT = 5126
const USHORT = 5123
const UINT = 5125
const TYPES = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' }

export function fromThree(name, geometry, extras) {
  const g = geometry.index ? geometry : geometry.toNonIndexed()
  const a = (k) => (g.getAttribute(k) ? new Float32Array(g.getAttribute(k).array) : undefined)
  const count = g.getAttribute('position').count
  const index = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: count }, (_, i) => i)
  return { name, position: a('position'), normal: a('normal'), uv: a('uv'), uv2: a('uv1') ?? a('uv2'), color: a('color'), colorSize: g.getAttribute('color')?.itemSize, tangent: a('tangent'), index, extras }
}

export function writeGlb(file, meshes, extras = {}) {
  const chunks = []
  let offset = 0
  const views = []
  const accessors = []
  const push = (array, target, size, minmax) => {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
    const pad = (4 - (offset % 4)) % 4
    if (pad) {
      chunks.push(Buffer.alloc(pad))
      offset += pad
    }
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target })
    chunks.push(bytes)
    offset += bytes.length
    const componentType = array instanceof Float32Array ? FLOAT : array instanceof Uint16Array ? USHORT : UINT
    const acc = { bufferView: views.length - 1, componentType, count: array.length / size, type: TYPES[size] }
    if (minmax) {
      const min = Array(size).fill(Infinity)
      const max = Array(size).fill(-Infinity)
      for (let i = 0; i < array.length; i++) {
        const k = i % size
        if (array[i] < min[k]) min[k] = array[i]
        if (array[i] > max[k]) max[k] = array[i]
      }
      acc.min = min
      acc.max = max
    }
    accessors.push(acc)
    return accessors.length - 1
  }
  const gltf = { asset: { version: '2.0', generator: 'snow-globe tools/lib/glb.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], extras }
  let triangles = 0
  for (const m of meshes) {
    if (!m.position || !m.index) throw new Error(`mesh ${m.name} needs position and index`)
    const count = m.position.length / 3
    const attributes = { POSITION: push(m.position, 34962, 3, true) }
    if (m.normal) attributes.NORMAL = push(m.normal, 34962, 3)
    if (m.tangent) attributes.TANGENT = push(m.tangent, 34962, 4)
    if (m.uv) attributes.TEXCOORD_0 = push(m.uv, 34962, 2)
    if (m.uv2) attributes.TEXCOORD_1 = push(m.uv2, 34962, 2)
    if (m.color) attributes.COLOR_0 = push(m.color, 34962, m.colorSize ?? m.color.length / count)
    const index = count > 65535 ? Uint32Array.from(m.index) : Uint16Array.from(m.index)
    const indices = push(index, 34963, 1)
    triangles += m.index.length / 3
    gltf.meshes.push({ name: m.name, primitives: [{ attributes, indices, mode: 4 }] })
    gltf.nodes.push({ name: m.name, mesh: gltf.meshes.length - 1, ...(m.extras ? { extras: m.extras } : {}) })
    gltf.scenes[0].nodes.push(gltf.nodes.length - 1)
  }
  const bin = Buffer.concat(chunks)
  const binPad = (4 - (bin.length % 4)) % 4
  gltf.bufferViews = views
  gltf.accessors = accessors
  gltf.buffers = [{ byteLength: bin.length + binPad }]
  let json = Buffer.from(JSON.stringify(gltf))
  const jsonPad = (4 - (json.length % 4)) % 4
  json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)])
  const total = 12 + 8 + json.length + 8 + bin.length + binPad
  const head = Buffer.alloc(12)
  head.writeUInt32LE(0x46546c67, 0)
  head.writeUInt32LE(2, 4)
  head.writeUInt32LE(total, 8)
  const jh = Buffer.alloc(8)
  jh.writeUInt32LE(json.length, 0)
  jh.writeUInt32LE(0x4e4f534a, 4)
  const bh = Buffer.alloc(8)
  bh.writeUInt32LE(bin.length + binPad, 0)
  bh.writeUInt32LE(0x004e4942, 4)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.concat([head, jh, json, bh, bin, Buffer.alloc(binPad)]))
  return { file, bytes: total, meshes: meshes.length, triangles }
}
