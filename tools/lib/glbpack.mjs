import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

/**
 * Packs a .glb for the web set: every vertex stream and every index stream is stored with EXT_meshopt_compression.
 * Nothing is reordered and no accessor changes its type, so the page reads the same Float32Array layout, vertex for vertex and index for index, that the full set gives.
 * Vertex streams keep `bits` of mantissa (the EXPONENTIAL filter); the index streams are exact.
 */

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942
const FLOAT = 5126
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const EXT = 'EXT_meshopt_compression'

/** Mantissa bits kept per stream, and how the exponent is shared. Positions are in millimetres: 21 bits on a 128 mm part is a grid of 0.12 µm, under a hundredth of a pixel of the macro camera. */
export const STREAMS = {
  POSITION: { bits: 21, mode: 'SharedComponent' },
  NORMAL: { bits: 16, mode: 'SharedVector' },
  TANGENT: { bits: 16, mode: 'SharedVector' },
  TEXCOORD: { bits: 20, mode: 'SharedComponent' },
  COLOR: { bits: 14, mode: 'SharedVector' },
  OTHER: { bits: 24, mode: 'Separate' },
}

export function readGlb(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC || buf.readUInt32LE(4) !== 2) throw new Error('not a glTF 2 binary')
  let at = 12
  let json = null
  let bin = Buffer.alloc(0)
  while (at < buf.length) {
    const length = buf.readUInt32LE(at)
    const type = buf.readUInt32LE(at + 4)
    const body = buf.subarray(at + 8, at + 8 + length)
    if (type === CHUNK_JSON) json = JSON.parse(body.toString('utf8'))
    else if (type === CHUNK_BIN) bin = body
    at += 8 + length
  }
  if (!json) throw new Error('the glb has no JSON chunk')
  return { json, bin }
}

export function writeGlb(json, bin) {
  const pad = (b, fill) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b)
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20)
  const b = pad(bin, 0)
  const head = Buffer.alloc(12)
  head.writeUInt32LE(GLB_MAGIC, 0)
  head.writeUInt32LE(2, 4)
  head.writeUInt32LE(12 + 8 + j.length + (b.length ? 8 + b.length : 0), 8)
  const chunk = (type, body) => {
    const h = Buffer.alloc(8)
    h.writeUInt32LE(body.length, 0)
    h.writeUInt32LE(type, 4)
    return [h, body]
  }
  return Buffer.concat([head, ...chunk(CHUNK_JSON, j), ...(b.length ? chunk(CHUNK_BIN, b) : [])])
}

const streamOf = (semantic) => STREAMS[semantic] ?? STREAMS[semantic.replace(/_\d+$/, '')] ?? STREAMS.OTHER

/** What each buffer view holds, from the accessors and primitives that use it. A view is packed only when one accessor fills it exactly. */
function describe(json) {
  const views = (json.bufferViews ?? []).map(() => ({ accessors: [], semantic: null, index: false }))
  ;(json.accessors ?? []).forEach((a, i) => {
    if (a.bufferView !== undefined) views[a.bufferView].accessors.push(i)
  })
  const mark = (accessor, semantic, index) => {
    const v = json.accessors[accessor]?.bufferView
    if (v === undefined) return
    if (index) views[v].index = true
    else if (views[v].semantic === null) views[v].semantic = semantic
    else if (views[v].semantic !== semantic) views[v].semantic = 'OTHER'
  }
  for (const m of json.meshes ?? [])
    for (const p of m.primitives ?? []) {
      for (const [semantic, accessor] of Object.entries(p.attributes ?? {})) mark(accessor, semantic, false)
      for (const t of p.targets ?? []) for (const [semantic, accessor] of Object.entries(t)) mark(accessor, semantic, false)
      if (p.indices !== undefined) mark(p.indices, null, true)
    }
  return views
}

/**
 * Returns the packed glb and, per stream, the largest absolute change of a value.
 * `streams` overrides STREAMS; `exactIndices: false` lets the triangle codec rotate triangles (smaller, same picture).
 */
export async function packGlb(buf, { streams = STREAMS, exactIndices = true } = {}) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  const { json, bin } = readGlb(buf)
  if ((json.extensionsUsed ?? []).includes(EXT) || (json.buffers ?? []).length !== 1 || json.buffers[0].uri !== undefined) return { glb: buf, packed: 0, kept: (json.bufferViews ?? []).length, change: {} }
  const pick = (semantic) => streams[semantic] ?? streams[semantic.replace(/_\d+$/, '')] ?? streams.OTHER ?? streamOf(semantic)
  const views = describe(json)
  const parts = []
  let length = 0
  let fallback = 0
  let packed = 0
  const change = {}
  const place = (data) => {
    const at = length
    parts.push(data)
    length += data.length
    const padding = (4 - (length % 4)) % 4
    if (padding) {
      parts.push(Buffer.alloc(padding))
      length += padding
    }
    return at
  }
  const out = (json.bufferViews ?? []).map((view, i) => {
    const d = views[i]
    const raw = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    const a = d.accessors.length === 1 ? json.accessors[d.accessors[0]] : null
    const size = a ? COMPONENTS[a.type] * BYTES[a.componentType] : 0
    const whole = a && !a.sparse && (a.byteOffset ?? 0) === 0 && (view.byteStride ?? size) === size && a.count * size === view.byteLength && a.count > 0
    let coded = null
    let ext = null
    if (whole && d.index && !d.semantic && (a.componentType === 5123 || a.componentType === 5125) && a.type === 'SCALAR') {
      const source = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength).slice()
      const triangles = !exactIndices && a.count % 3 === 0
      coded = triangles ? MeshoptEncoder.encodeIndexBuffer(source, a.count, size) : MeshoptEncoder.encodeIndexSequence(source, a.count, size)
      ext = { byteStride: size, count: a.count, mode: triangles ? 'TRIANGLES' : 'INDICES' }
      const back = new Uint8Array(view.byteLength)
      MeshoptDecoder.decodeGltfBuffer(back, a.count, size, coded, ext.mode)
      if (!triangles && Buffer.compare(Buffer.from(back.buffer), Buffer.from(source.buffer)) !== 0) throw new Error(`index stream ${i} does not decode to itself`)
    } else if (whole && !d.index && d.semantic && a.componentType === FLOAT && size % 4 === 0) {
      const { bits, mode } = pick(d.semantic)
      const floats = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
      const filtered = MeshoptEncoder.encodeFilterExp(floats, a.count, size, bits, mode)
      coded = MeshoptEncoder.encodeVertexBufferLevel(filtered, a.count, size, 2, 0)
      ext = { byteStride: size, count: a.count, mode: 'ATTRIBUTES', filter: 'EXPONENTIAL' }
      const back = new Uint8Array(view.byteLength)
      MeshoptDecoder.decodeGltfBuffer(back, a.count, size, coded, 'ATTRIBUTES', 'EXPONENTIAL')
      const decoded = new Float32Array(back.buffer)
      const n = COMPONENTS[a.type]
      const min = new Array(n).fill(Infinity)
      const max = new Array(n).fill(-Infinity)
      let worst = 0
      for (let k = 0; k < decoded.length; k++) {
        const v = decoded[k]
        if (!Number.isFinite(v)) throw new Error(`vertex stream ${i} (${d.semantic}) holds a value that is not finite`)
        const c = k % n
        if (v < min[c]) min[c] = v
        if (v > max[c]) max[c] = v
        const e = Math.abs(v - floats[k])
        if (e > worst) worst = e
      }
      if (a.min) a.min = min
      if (a.max) a.max = max
      change[d.semantic] = Math.max(change[d.semantic] ?? 0, worst)
    }
    if (!coded || coded.length >= view.byteLength) {
      const at = place(raw)
      return { ...view, buffer: 0, byteOffset: at }
    }
    packed++
    const at = place(Buffer.from(coded.buffer, coded.byteOffset, coded.byteLength))
    const next = { ...view, buffer: 1, byteOffset: fallback, extensions: { ...(view.extensions ?? {}), [EXT]: { buffer: 0, byteOffset: at, byteLength: coded.length, ...ext } } }
    delete next.byteStride
    fallback += view.byteLength + ((4 - (view.byteLength % 4)) % 4)
    return next
  })
  if (!packed) return { glb: buf, packed: 0, kept: out.length, change }
  json.bufferViews = out
  json.buffers = [{ byteLength: length }, { byteLength: fallback, extensions: { [EXT]: { fallback: true } } }]
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), EXT])]
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), EXT])]
  return { glb: writeGlb(json, Buffer.concat(parts, length)), packed, kept: out.length - packed, change }
}
