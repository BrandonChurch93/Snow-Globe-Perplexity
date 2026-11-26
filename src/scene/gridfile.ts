import type { SdfGrid } from '../core/stage'

const MAGIC = 0x47464453
const HEAD = 16
const FLIP = 0x7fffffff

/** A float's bits as an integer that rises as the float does, and back: the same step both ways. */
const ordered = (bits: number): number => (bits < 0 ? bits ^ FLIP : bits)

/**
 * A grid as the bytes of its file before they are deflated: sixteen bytes that say what it is, then what each sample differs
 * by from the guess its seven finished neighbours give, as four planes of bytes. Nothing is rounded: `unpackGrid` gives every
 * sample back to the bit.
 */
export function packGrid(grid: SdfGrid): Uint8Array {
  const n = grid.n
  const cells = n * n * n
  if (grid.data.length !== cells) throw new Error(`a grid of ${n} cells a side has ${cells} samples, not ${grid.data.length}`)
  const bits = new Int32Array(new Float32Array(grid.data).buffer)
  const out = new Uint8Array(HEAD + 4 * cells)
  const head = new DataView(out.buffer)
  head.setUint32(0, MAGIC, true)
  head.setUint32(4, n, true)
  head.setFloat64(8, grid.sizeMm, true)
  const m = new Int32Array(cells)
  const row = n
  const page = n * n
  let c = 0
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++, c++) {
        const v = ordered(bits[c]!)
        m[c] = v
        const x = i > 0
        const y = j > 0
        const z = k > 0
        const guess =
          (x ? m[c - 1]! : 0) + (y ? m[c - row]! : 0) + (z ? m[c - page]! : 0) - (x && y ? m[c - 1 - row]! : 0) - (x && z ? m[c - 1 - page]! : 0) - (y && z ? m[c - row - page]! : 0) + (x && y && z ? m[c - 1 - row - page]! : 0)
        const r = (v - guess) | 0
        const zig = (r << 1) ^ (r >> 31)
        out[HEAD + c] = zig & 255
        out[HEAD + cells + c] = (zig >>> 8) & 255
        out[HEAD + 2 * cells + c] = (zig >>> 16) & 255
        out[HEAD + 3 * cells + c] = zig >>> 24
      }
    }
  }
  return out
}

export function unpackGrid(bytes: Uint8Array): SdfGrid {
  const head = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < HEAD || head.getUint32(0, true) !== MAGIC) throw new Error('not a grid file')
  const n = head.getUint32(4, true)
  const cells = n * n * n
  if (bytes.length !== HEAD + 4 * cells) throw new Error(`a grid file of ${n} cells a side has ${HEAD + 4 * cells} bytes, not ${bytes.length}`)
  const m = new Int32Array(cells)
  const row = n
  const page = n * n
  let c = 0
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++, c++) {
        const zig = bytes[HEAD + c]! | (bytes[HEAD + cells + c]! << 8) | (bytes[HEAD + 2 * cells + c]! << 16) | (bytes[HEAD + 3 * cells + c]! << 24)
        const r = (zig >>> 1) ^ -(zig & 1)
        const x = i > 0
        const y = j > 0
        const z = k > 0
        const guess =
          (x ? m[c - 1]! : 0) + (y ? m[c - row]! : 0) + (z ? m[c - page]! : 0) - (x && y ? m[c - 1 - row]! : 0) - (x && z ? m[c - 1 - page]! : 0) - (y && z ? m[c - row - page]! : 0) + (x && y && z ? m[c - 1 - row - page]! : 0)
        m[c] = (r + guess) | 0
      }
    }
  }
  for (c = 0; c < cells; c++) m[c] = ordered(m[c]!)
  return { n, sizeMm: head.getFloat64(8, true), data: new Float32Array(m.buffer) }
}

/** A grid from its file as the host sends it: the build deflates the packed bytes, and the browser inflates them off the page's script. */
export async function readGrid(file: ReadableStream<Uint8Array>): Promise<SdfGrid> {
  const plain = file.pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  return unpackGrid(new Uint8Array(await new Response(plain).arrayBuffer()))
}

/** Where the page finds a season's grid, beside the assets: `version` changes whenever the grid may, so the host can keep the file for good. */
export const gridAddress = (season: string, version: string): string => `assets/grids/${season}.bin?v=${version}`
