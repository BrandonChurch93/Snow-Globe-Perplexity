/** The pixels of a picture as the card takes them: four bytes a pixel, straight alpha, rows from the bottom up. */
export interface Pixels {
  width: number
  height: number
  data: Uint8Array
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

async function inflate(parts: Uint8Array[]): Promise<Uint8Array> {
  const packed = new Blob(parts as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(packed).arrayBuffer())
}

/**
 * Reads a PNG of 8 bits a channel with red, green, blue and alpha, not interlaced, and gives its bytes as they are in the
 * file: nothing is multiplied by the alpha and no colour is converted. Any other PNG gives null. The rows come out from the
 * bottom up, which is what `imageOrientation: 'flipY'` gives.
 */
export async function pngPixels(file: ArrayBuffer): Promise<Pixels | null> {
  const d = new Uint8Array(file)
  const v = new DataView(file)
  if (d.length < 8 || v.getUint32(0) !== 0x89504e47 || v.getUint32(4) !== 0x0d0a1a0a) return null
  let width = 0
  let height = 0
  const packed: Uint8Array[] = []
  for (let at = 8; at + 12 <= d.length; ) {
    const n = v.getUint32(at)
    const type = v.getUint32(at + 4)
    if (type === 0x49484452) {
      width = v.getUint32(at + 8)
      height = v.getUint32(at + 12)
      if (d[at + 16] !== 8 || d[at + 17] !== 6 || d[at + 20] !== 0) return null
    } else if (type === 0x49444154) packed.push(d.subarray(at + 8, at + 8 + n))
    else if (type === 0x49454e44) break
    at += 12 + n
  }
  if (!width || !height || !packed.length) return null
  const raw = await inflate(packed)
  const row = width * 4
  if (raw.length !== (row + 1) * height) return null
  const data = new Uint8Array(row * height)
  for (let y = 0; y < height; y++) {
    const o = y * (row + 1) + 1
    const up = o - row - 1
    const filter = raw[o - 1]!
    if (filter === 1) for (let i = o + 4; i < o + row; i++) raw[i] = raw[i]! + raw[i - 4]!
    else if (filter === 2) {
      if (y) for (let i = 0; i < row; i++) raw[o + i] = raw[o + i]! + raw[up + i]!
    } else if (filter === 3)
      for (let i = 0; i < row; i++) raw[o + i] = raw[o + i]! + (((i >= 4 ? raw[o + i - 4]! : 0) + (y ? raw[up + i]! : 0)) >> 1)
    else if (filter === 4)
      for (let i = 0; i < row; i++) raw[o + i] = raw[o + i]! + paeth(i >= 4 ? raw[o + i - 4]! : 0, y ? raw[up + i]! : 0, i >= 4 && y ? raw[up + i - 4]! : 0)
    else if (filter !== 0) return null
    data.set(raw.subarray(o, o + row), (height - 1 - y) * row)
  }
  return { width, height, data }
}
