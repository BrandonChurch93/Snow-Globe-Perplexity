import zlib from 'node:zlib'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type * as THREE from 'three'
import * as rows from '../src/scene/rowsfile'
import type { Rows } from '../src/scene/rowsfile'
import { rowFile, rowSets } from '../tools/lib/grids.mjs'

type Arrival = typeof import('../src/seasons/summer/arrival')

const bytes = (a: ArrayBufferView): Buffer => Buffer.from(a.buffer, a.byteOffset, a.byteLength)
const stream = (packed: Uint8Array): ReadableStream<Uint8Array> => new Blob([new Uint8Array(packed)]).stream() as ReadableStream<Uint8Array>
const fresh = async (): Promise<Arrival> => {
  vi.resetModules()
  return import('../src/seasons/summer/arrival')
}
const setOf = (arrival: Arrival): { rows: Rows; against: readonly (number | null)[] } => (rowSets({ grains: arrival }) as Record<string, { rows: Rows; against: readonly (number | null)[] }>)[arrival.GRAIN_FILE.name]!

/** Everything of the grains the card is given, and how many of them are drawn in a flight and at rest. */
const drawn = (arrival: Arrival): Record<string, Buffer | number> => {
  const mesh = arrival.grains()
  const g = mesh.geometry
  const out: Record<string, Buffer | number> = { index: bytes(g.index!.array) }
  for (const name of Object.keys(g.attributes).sort()) out[name] = bytes((g.attributes[name] as THREE.BufferAttribute).array)
  const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms
  for (const [name, gone] of [
    ['flight', 0],
    ['rest', 1],
  ] as const) {
    uniforms.uGrain!.value.y = gone
    ;(mesh.onBeforeRender as unknown as () => void)()
    out[name] = g.drawRange.count
    ;(mesh.onAfterRender as unknown as () => void)()
  }
  return out
}

const same = (a: Record<string, Buffer | number>, b: Record<string, Buffer | number>): string[] => {
  const apart = Object.keys(a).length === Object.keys(b).length ? [] : ['the names']
  for (const [name, v] of Object.entries(a)) {
    const w = b[name]
    if (typeof v === 'number' ? v !== w : !(w instanceof Buffer) || !v.equals(w)) apart.push(name)
  }
  return apart
}

// The build works summer's grains out and the page fetches them (tools/lib/grids.mjs, `prepare` in arrival.ts). These are
// the build's own steps and the page's own reading, run here.
describe("the grains the build makes for summer's sand", () => {
  let arrival: Arrival
  let computed: Record<string, Buffer | number> = {}
  let made: Rows
  let file: Uint8Array

  beforeAll(async () => {
    arrival = await fresh()
    computed = drawn(arrival)
    const set = setOf(arrival)
    made = set.rows
    file = rowFile({ rows }, set)
  }, 120000)

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** A page at an address of its own, to which the host answers what `answer` gives. */
  const page = (answer: () => Response | Promise<Response>): ReturnType<typeof vi.fn> => {
    const asked = vi.fn(async (_at: URL) => answer())
    vi.stubGlobal('document', { baseURI: 'https://host.example/globe/index.html?quality=low' })
    vi.stubGlobal('fetch', asked)
    return asked
  }

  it('a file of rows gives every kind of number back to the bit, alone and held against another column', async () => {
    const width = 5
    const count = 9
    const odd = [0, -0, NaN, Infinity, -Infinity, 1e-45, -1e-45, 3.4028234663852886e38, -3.4028234663852886e38, 1.17549435e-38, 0.1, -0.1, 57, -57]
    const data = new Float32Array(width * count)
    for (let i = 0; i < data.length; i++) data[i] = i < odd.length ? odd[i]! : Math.sin(i * 12.9898) * 43758.5453
    // The fourth column is the first in every other row, as a grain that never flies comes from where it lies.
    for (let r = 0; r < count; r += 2) data[r * width + 3] = data[r * width]!
    new Uint32Array(data.buffer)[data.length - 1] = 0xffc12345
    const set = { width, mark: 4, data }
    for (const against of [[], [null, null, null, 0, 1], [null, 0, 0, 2, 3]]) {
      const packed = rows.packRows(set, against)
      const plain = rows.unpackRows(packed)
      expect([plain.width, plain.mark]).toEqual([width, 4])
      expect(bytes(plain.data).equals(bytes(data)), `held against ${JSON.stringify(against)}`).toBe(true)
      const read = await rows.readRows(stream(zlib.gzipSync(packed)))
      expect([read.width, read.mark]).toEqual([width, 4])
      expect(bytes(read.data).equals(bytes(data))).toBe(true)
    }
    // A column held against the one it equals leaves nothing of itself in the file.
    const kept = rows.packRows({ width: 2, mark: 0, data: new Float32Array([1.5, 1.5, -7, -7, 0.1, 0.1]) }, [null, 0])
    expect([...kept.subarray(16 + 2 + 12)]).toEqual(new Array(12).fill(0))
    expect(() => rows.unpackRows(rows.packRows(set).subarray(1))).toThrow()
    expect(() => rows.unpackRows(rows.packRows(set).subarray(0, 60))).toThrow()
    expect(() => rows.packRows({ width, mark: 0, data: new Float32Array(7) })).toThrow()
    expect(() => rows.packRows({ width, mark: 0.5, data })).toThrow()
    expect(() => rows.packRows({ width, mark: -1, data })).toThrow()
    expect(() => rows.packRows(set, [null, 1])).toThrow()
    expect(() => rows.packRows(set, [null, null, 3])).toThrow()
  })

  it('the file holds the rows grainRows makes, to the bit, in less than six tenths of their bytes', async () => {
    expect(made.width).toBe(arrival.GRAIN_ROW)
    expect(Number.isInteger(made.data.length / made.width)).toBe(true)
    expect(made.data.length / made.width).toBeGreaterThan(10000)
    expect(made.mark).toBeGreaterThan(0)
    expect(made.mark).toBeLessThan(made.data.length / made.width)
    let odd = 0
    for (const v of made.data) if (!Number.isFinite(v)) odd++
    expect(odd).toBe(0)
    const read = await rows.readRows(stream(file))
    expect([read.width, read.mark]).toEqual([made.width, made.mark])
    expect(bytes(read.data).equals(bytes(made.data))).toBe(true)
    // Made twice it is the same file: nothing of it hangs on the hour or on the machine's own order.
    const again = await fresh()
    expect(Buffer.from(rowFile({ rows }, setOf(again))).equals(Buffer.from(file))).toBe(true)
    // Most of a grain is its own chance, which no packing makes smaller; what packs away is where the grains that never
    // fly come from, and the bytes that are alike down a column.
    expect(file.length).toBeLessThan(bytes(made.data).length * 0.6)
  })

  it('a page that has the file draws the grains the page without it works out, to the bit, and works nothing out', async () => {
    const withFile = await fresh()
    const asked = page(() => new Response(new Uint8Array(file)))
    await withFile.prepare()
    expect(asked).toHaveBeenCalledTimes(1)
    expect(String(asked.mock.calls[0]![0])).toBe(`https://host.example/globe/assets/rows/summer-grains.bin?v=${__ENGINE_HASH__}`)
    const t = performance.now()
    const fromFile = drawn(withFile)
    const ms = performance.now() - t
    expect(same(fromFile, computed)).toEqual([])
    expect(Object.keys(fromFile).sort()).toEqual(['aCorner', 'aFlight', 'aFrom', 'aSeed', 'flight', 'index', 'position', 'rest'])
    expect(fromFile.rest).toBe(6 * (made.data.length / made.width - made.mark))
    expect(fromFile.flight).toBe(6 * (made.data.length / made.width))
    // What is left to the page is the laying out of four corners a grain: a small share of the working out.
    expect(ms).toBeLessThan(400)
    // The file is asked for once: a second making ready asks the host nothing.
    await withFile.prepare()
    expect(asked).toHaveBeenCalledTimes(1)
  })

  it('what the page draws is what the file says', async () => {
    const other = { width: made.width, mark: made.mark, data: new Float32Array(made.data) }
    const at = 7 * made.width + 1
    other.data[at] = other.data[at]! + 1
    const withOther = await fresh()
    page(() => new Response(new Uint8Array(zlib.gzipSync(rows.packRows(other, arrival.GRAIN_FILE.against)))))
    await withOther.prepare()
    const fromOther = drawn(withOther)
    expect(same(fromOther, computed)).toEqual(['position'])
    const lies = new Float32Array(new Uint8Array(fromOther.position as Buffer).buffer)
    for (let k = 0; k < 4; k++) expect(lies[(7 * 4 + k) * 3 + 1]).toBe(other.data[at])
  })

  it.each([
    ['is not there', () => new Response('no such file', { status: 404 })],
    ['is no file of rows', () => new Response(new Uint8Array(zlib.gzipSync(Buffer.from('<!doctype html><title>not found</title>'))))],
    ['is not deflated', () => new Response(new Uint8Array(rows.packRows({ width: 14, mark: 0, data: new Float32Array(28) })))],
    ['holds rows of another width', () => new Response(new Uint8Array(zlib.gzipSync(rows.packRows({ width: 13, mark: 0, data: new Float32Array(26) }))))],
    [
      'cannot be reached',
      () => {
        throw new TypeError('the line is down')
      },
    ],
  ])('a page whose file %s works the grains out as before', async (_what, answer) => {
    const without = await fresh()
    const asked = page(answer)
    await expect(without.prepare()).resolves.toBeUndefined()
    expect(asked).toHaveBeenCalledTimes(1)
    expect(same(drawn(without), computed)).toEqual([])
  })

  it('a page with no document, as a test or the build is, asks for nothing', async () => {
    const asked = vi.fn()
    vi.stubGlobal('fetch', asked)
    await (await fresh()).prepare()
    expect(asked).not.toHaveBeenCalled()
  })
})
