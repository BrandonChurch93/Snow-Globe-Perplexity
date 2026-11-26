const MAGIC = 0x53574f52
const HEAD = 16

/** Numbers in rows as the build makes them for the page: `width` numbers a row, and one whole number of the maker's own. */
export interface Rows {
  width: number
  mark: number
  data: Float32Array
}

/**
 * Rows as the bytes of their file before they are deflated: sixteen bytes that say what they are, a byte a column, then
 * column after column as four planes of bytes, because the numbers of a column are alike and their like bytes deflate
 * together. A column that `against` gives another column is held as the bits in which it differs from that one, so where
 * the two are the same number nothing is left of it. Nothing is rounded: `unpackRows` gives every number back to the bit.
 */
export function packRows(rows: Rows, against: readonly (number | null)[] = []): Uint8Array {
  const { width, data } = rows
  const count = data.length / width
  if (!(width > 0 && width < 256) || !Number.isInteger(count)) throw new Error(`${data.length} numbers are not rows of ${width}`)
  if (!Number.isInteger(rows.mark) || rows.mark < 0 || rows.mark > 0xffffffff) throw new Error(`the mark of a file of rows is a whole number, not ${rows.mark}`)
  const bits = new Uint32Array(new Float32Array(data).buffer)
  const out = new Uint8Array(HEAD + width + 4 * data.length)
  const head = new DataView(out.buffer)
  head.setUint32(0, MAGIC, true)
  head.setUint32(4, width, true)
  head.setUint32(8, count, true)
  head.setUint32(12, rows.mark, true)
  for (let c = 0; c < width; c++) {
    const base = against[c] ?? null
    if (base !== null && !(Number.isInteger(base) && base >= 0 && base < c)) throw new Error(`column ${c} can be held against an earlier column, not against ${base}`)
    out[HEAD + c] = base === null ? 0 : base + 1
    const at = HEAD + width + 4 * count * c
    for (let r = 0; r < count; r++) {
      const v = base === null ? bits[r * width + c]! : bits[r * width + c]! ^ bits[r * width + base]!
      out[at + r] = v & 255
      out[at + count + r] = (v >>> 8) & 255
      out[at + 2 * count + r] = (v >>> 16) & 255
      out[at + 3 * count + r] = v >>> 24
    }
  }
  return out
}

export function unpackRows(bytes: Uint8Array): Rows {
  const head = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < HEAD || head.getUint32(0, true) !== MAGIC) throw new Error('not a file of rows')
  const width = head.getUint32(4, true)
  const count = head.getUint32(8, true)
  if (!(width > 0 && width < 256) || bytes.length !== HEAD + width + 4 * width * count) throw new Error(`a file of ${count} rows of ${width} has ${HEAD + width + 4 * width * count} bytes, not ${bytes.length}`)
  const bits = new Uint32Array(width * count)
  for (let c = 0; c < width; c++) {
    const base = bytes[HEAD + c]! - 1
    if (base >= c) throw new Error(`column ${c} of a file of rows is held against column ${base}, which comes no earlier`)
    const at = HEAD + width + 4 * count * c
    for (let r = 0; r < count; r++) {
      const v = bytes[at + r]! | (bytes[at + count + r]! << 8) | (bytes[at + 2 * count + r]! << 16) | (bytes[at + 3 * count + r]! << 24)
      bits[r * width + c] = base < 0 ? v : v ^ bits[r * width + base]!
    }
  }
  return { width, mark: head.getUint32(12, true), data: new Float32Array(bits.buffer) }
}

/** Rows from their file as the host sends it: the build deflates the packed bytes, and the browser inflates them off the page's script. */
export async function readRows(file: ReadableStream<Uint8Array>): Promise<Rows> {
  const plain = file.pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  return unpackRows(new Uint8Array(await new Response(plain).arrayBuffer()))
}

/** Where the page finds a file of rows, beside the assets: `version` changes whenever the rows may, so the host can keep the file for good. */
export const rowsAddress = (name: string, version: string): string => `assets/rows/${name}.bin?v=${version}`
