import { MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SeasonLoader } from '../src/app/session'
import { Assets, entriesOf, type AssetFile } from '../src/core/assets'
import { config } from '../src/config'
import { packGlb, readGlb, writeGlb, STREAMS } from '../tools/lib/glbpack.mjs'
import { WEB, difference, halve, webFiles, webLimit, webSize } from '../tools/lib/webset.mjs'

const seasons = config.seasons
const first = config.defaultSeason
const file = (p: string): AssetFile => ({ path: p, bytes: 1, sha: p })
const ticks = async (n = 40): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

describe('the names of the web set', () => {
  it('gives a picture the name the full set has, whatever its coding, and keeps what the first picture needs apart', () => {
    const e = entriesOf([file('winter/base-carve.lin.w2048.webp'), file('winter/base-carve.lin.w2048.first.webp'), file('winter/tree-crown.glb'), file('shared/flake-lobes.lin.png'), file('winter/base-snow.srgb.tile.w256.webp')])
    const by = new Map(e.map((x) => [x.name, x]))
    expect([...by.keys()].sort()).toEqual(['shared/flake-lobes.lin.png', 'winter/base-carve.lin.w2048.png', 'winter/base-snow.srgb.tile.w256.png', 'winter/tree-crown.glb'])
    const carve = by.get('winter/base-carve.lin.w2048.png')!
    expect(carve.picture).toBe(true)
    expect(carve.file.path).toBe('winter/base-carve.lin.w2048.webp')
    expect(carve.first?.path).toBe('winter/base-carve.lin.w2048.first.webp')
    expect(by.get('winter/base-snow.srgb.tile.w256.png')!.first).toBeNull()
    expect(by.get('shared/flake-lobes.lin.png')!.file.path).toBe('shared/flake-lobes.lin.png')
    const glb = by.get('winter/tree-crown.glb')!
    expect(glb.picture).toBe(false)
    expect(glb.first).toBeNull()
  })

  it('reads the full set as it always did: one entry per file, under the file name', () => {
    const files = [file('winter/a.lin.png'), file('winter/b.srgb.tile.png'), file('winter/c.glb'), file('winter/d.bin')]
    const e = entriesOf(files)
    expect(e.map((x) => x.name)).toEqual(files.map((f) => f.path))
    expect(e.map((x) => x.file)).toEqual(files)
    expect(e.every((x) => x.first === null)).toBe(true)
    expect(e.map((x) => x.picture)).toEqual([true, true, false, false])
  })

  it('draws from the first file alone when the whole file is missing, and never names a first file as its own picture', () => {
    const e = entriesOf([file('winter/x.lin.first.webp')])
    expect(e).toHaveLength(1)
    expect(e[0]!.name).toBe('winter/x.lin.png')
    expect(e[0]!.file.path).toBe('winter/x.lin.first.webp')
    expect(e[0]!.first).toBeNull()
  })

  it('asks for the first file only when it is told that the first picture is what matters', () => {
    const a = new Assets()
    const [e] = entriesOf([file('winter/x.lin.webp'), file('winter/x.lin.first.webp')])
    expect(a.firstOnly).toBe(false)
    expect(a.early(e!).path).toBe('winter/x.lin.webp')
    a.firstOnly = true
    expect(a.early(e!).path).toBe('winter/x.lin.first.webp')
    const [whole] = entriesOf([file('winter/y.lin.webp')])
    expect(a.early(whole!).path).toBe('winter/y.lin.webp')
  })
})

describe('the order in which seasons load', () => {
  it('fetches nothing of another season before it is let go, and tells each load whether somebody waits for it', async () => {
    const calls: [string, boolean][] = []
    let go: () => void = () => undefined
    const after = new Promise<void>((resolve) => (go = resolve))
    const loader = new SeasonLoader(first, async (season, asked) => void calls.push([season, asked]), undefined, after)
    await loader.first
    await ticks()
    expect(calls).toEqual([[first, true]])
    go()
    await loader.all
    expect(calls.map((c) => c[0]).sort()).toEqual([...seasons].sort())
    expect(calls.slice(1).every((c) => c[1] === false)).toBe(true)
    for (const s of seasons) expect(loader.ready(s)).toBe(true)
  })

  it('starts a season that is asked for at once, ahead of its turn, and loads it only once', async () => {
    const calls: [string, boolean][] = []
    let go: () => void = () => undefined
    const after = new Promise<void>((resolve) => (go = resolve))
    const loader = new SeasonLoader(first, async (season, asked) => void calls.push([season, asked]), undefined, after)
    await loader.first
    const wanted = seasons[seasons.length - 1]!
    await loader.want(wanted)
    expect(calls).toEqual([
      [first, true],
      [wanted, true],
    ])
    expect(loader.ready(wanted)).toBe(true)
    go()
    await loader.all
    expect(calls.filter((c) => c[0] === wanted)).toHaveLength(1)
    expect(calls.map((c) => c[0]).sort()).toEqual([...seasons].sort())
    await loader.want('no-such-season')
    expect(calls).toHaveLength(seasons.length)
  })

  it('still loads the others when the picture never comes', async () => {
    const calls: string[] = []
    const loader = new SeasonLoader(first, async (season) => void calls.push(season), undefined, Promise.reject(new Error('no picture')))
    await loader.all
    expect(calls.sort()).toEqual([...seasons].sort())
  })
})

describe('the pictures of the web set', () => {
  it('sizes a picture by the limit in its name, or by the cap of the set', () => {
    expect(webLimit('tree-needles.srgb.tile.w1024.png', 2048)).toBe(1024)
    expect(webLimit('scene-slab-detail.lin.tile.png', 2048)).toBe(2048)
    expect(webSize(4096, 4096, 1024)).toEqual({ width: 1024, height: 1024, resized: true })
    expect(webSize(4096, 2048, 1536)).toEqual({ width: 1536, height: 768, resized: true })
    expect(webSize(512, 256, 1024)).toEqual({ width: 512, height: 256, resized: false })
  })

  it('halves a data map by the plain mean of each 2x2 block and a colour map by the mean of its light', () => {
    const data = Buffer.from([0, 255, 0, 255, 10, 20, 30, 40])
    expect([...halve(data, 4, 2, 1, false).data]).toEqual([71, 81])
    expect([...halve(Buffer.from([0, 255, 0, 255]), 2, 2, 1, true).data]).toEqual([188])
    const rgba = Buffer.from([0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255])
    const h = halve(rgba, 2, 2, 4, true)
    expect([h.width, h.height, h.channels]).toEqual([1, 1, 4])
    expect([...h.data]).toEqual([188, 188, 188, 128])
    const flat = Buffer.alloc(8 * 8 * 3, 97)
    expect([...new Set(halve(flat, 8, 8, 3, true).data)]).toEqual([97])
    expect([...new Set(halve(flat, 8, 8, 3, false).data)]).toEqual([97])
  })

  it('measures the largest change of any channel', () => {
    expect(difference(Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3]))).toEqual({ max: 0, psnr: Infinity })
    expect(difference(Buffer.from([1, 2, 3]), Buffer.from([1, 5, 2])).max).toBe(3)
    expect(difference(Buffer.from([1, 2, 3]), Buffer.from([1, 2])).max).toBe(255)
  })

  it('codes a picture so that no channel of any pixel moves by more than the rule allows, and the first file is its next mip level', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webset-'))
    try {
      const w = 1024
      const h = 512
      const raw = Buffer.alloc(w * h * 3)
      let seed = 12345
      const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16) & 15
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 3
          raw[o] = Math.min(255, Math.round(127 + 100 * Math.sin(x / 37) * Math.cos(y / 23)) + noise())
          raw[o + 1] = Math.min(255, ((x * 255) / w) | 0) ^ (noise() >> 2)
          raw[o + 2] = Math.min(255, ((y * 255) / h) | 0)
        }
      const name = 'probe.lin.tile.png'
      const from = path.join(dir, name)
      await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toFile(from)
      const made = (await webFiles(from, name, 2048, { cache: false })) as { name: string; data: Buffer; coding: string; max: number; first?: boolean; width: number; height: number }[]
      expect(made.map((m) => m.name)).toEqual(['probe.lin.tile.webp', 'probe.lin.tile.first.webp'])
      const whole = await sharp(made[0]!.data).raw().toBuffer({ resolveWithObject: true })
      expect([whole.info.width, whole.info.height, whole.info.channels]).toEqual([w, h, 3])
      expect(difference(raw, whole.data).max).toBeLessThanOrEqual(WEB.maxError)
      expect(made[0]!.max).toBeLessThanOrEqual(WEB.maxError)
      const half = await sharp(made[1]!.data).raw().toBuffer({ resolveWithObject: true })
      expect([half.info.width, half.info.height]).toEqual([w / 2, h / 2])
      expect(difference(halve(raw, w, h, 3, false).data, half.data).max).toBeLessThanOrEqual(WEB.maxError)
      expect(made[1]!.first).toBe(true)
      expect(made[0]!.data.length + made[1]!.data.length).toBeLessThan(fs.statSync(from).size)

      const small = 'table.lin.png'
      const table = path.join(dir, small)
      await sharp(raw.subarray(0, 64 * 64 * 3), { raw: { width: 64, height: 64, channels: 3 } }).png().toFile(table)
      const kept = (await webFiles(table, small, 2048, { cache: false })) as { name: string; data: Buffer; coding: string }[]
      expect(kept).toHaveLength(1)
      expect(kept[0]!.name).toBe(small)
      expect(kept[0]!.data.equals(fs.readFileSync(table))).toBe(true)

      const cut = 'cut.srgb.w2048.png'
      const alpha = path.join(dir, cut)
      const rgba = Buffer.alloc(w * w * 4)
      for (let i = 0; i < w * w; i++) {
        rgba[i * 4] = raw[(i % (w * h)) * 3]!
        rgba[i * 4 + 1] = raw[(i % (w * h)) * 3 + 1]!
        rgba[i * 4 + 2] = raw[(i % (w * h)) * 3 + 2]!
        rgba[i * 4 + 3] = (i % w) < w / 2 ? 255 : (i >> 3) & 255
      }
      await sharp(rgba, { raw: { width: w, height: w, channels: 4 } }).png().toFile(alpha)
      const cutout = (await webFiles(alpha, cut, 2048, { cache: false })) as { name: string; data: Buffer; first?: boolean }[]
      expect(cutout.some((m) => m.first)).toBe(false)
      if (/\.webp$/.test(cutout[0]!.name)) {
        const back = await sharp(cutout[0]!.data).raw().toBuffer({ resolveWithObject: true })
        expect(back.info.channels).toBe(4)
        expect(difference(rgba, back.data).max).toBeLessThanOrEqual(WEB.maxError)
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('the models of the web set', () => {
  const grid = (n: number) => {
    const count = n * n
    const position = new Float32Array(count * 3)
    const normal = new Float32Array(count * 3)
    const uv = new Float32Array(count * 2)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        const x = (i / (n - 1)) * 128 - 64
        const z = (j / (n - 1)) * 128 - 64
        const y = 7 * Math.sin(x / 9) * Math.cos(z / 11) + 0.013 * ((k * 7919) % 97)
        position.set([x, y, z], k * 3)
        const nx = -Math.cos(x / 9) * Math.cos(z / 11) * (7 / 9)
        const nz = Math.sin(x / 9) * Math.sin(z / 11) * (7 / 11)
        const l = Math.hypot(nx, 1, nz)
        normal.set([nx / l, 1 / l, nz / l], k * 3)
        uv.set([i / (n - 1), j / (n - 1)], k * 2)
      }
    const index = new Uint32Array((n - 1) * (n - 1) * 6)
    let o = 0
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i
        index.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], o)
        o += 6
      }
    const parts = [position, normal, uv, index].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength))
    let at = 0
    const bufferViews = parts.map((p) => {
      const v = { buffer: 0, byteOffset: at, byteLength: p.length }
      at += p.length
      return v
    })
    const json = {
      asset: { version: '2.0' },
      buffers: [{ byteLength: at }],
      bufferViews,
      accessors: [
        { bufferView: 0, componentType: 5126, count, type: 'VEC3', min: [-64, -8, -64], max: [64, 9, 64] },
        { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count, type: 'VEC2' },
        { bufferView: 3, componentType: 5125, count: index.length, type: 'SCALAR' },
      ],
      meshes: [{ name: 'part', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3 }], extras: { role: 'roof', lod: 2 } }],
      nodes: [{ mesh: 0, name: 'part', extras: { anchor: [1, 2, 3] } }],
      scenes: [{ nodes: [0] }],
      scene: 0,
      extras: { made: 'by the test' },
    }
    return { glb: writeGlb(json, Buffer.concat(parts)), position, normal, uv, index, json }
  }

  it('packs every stream, keeps the order of vertices and every index, and says how far a value moved', async () => {
    const g = grid(48)
    const r = await packGlb(g.glb)
    expect(r.packed).toBe(4)
    expect(r.kept).toBe(0)
    expect(r.glb.length).toBeLessThan(g.glb.length * 0.6)
    const { json, bin } = readGlb(r.glb)
    expect(json.extensionsRequired).toEqual(['EXT_meshopt_compression'])
    expect(json.meshes[0].extras).toEqual({ role: 'roof', lod: 2 })
    expect(json.nodes[0].extras).toEqual({ anchor: [1, 2, 3] })
    expect(json.extras).toEqual({ made: 'by the test' })
    expect(json.accessors.map((a: { componentType: number; type: string; count: number }) => [a.componentType, a.type, a.count])).toEqual(g.json.accessors.map((a) => [a.componentType, a.type, a.count]))
    await MeshoptDecoder.ready
    const stream = (i: number): Uint8Array => {
      const view = json.bufferViews[i]
      const ext = view.extensions.EXT_meshopt_compression
      const out = new Uint8Array(ext.count * ext.byteStride)
      MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, new Uint8Array(bin.buffer, bin.byteOffset + ext.byteOffset, ext.byteLength), ext.mode, ext.filter)
      expect(out.length).toBe(view.byteLength)
      return out
    }
    const worst = (a: Float32Array, b: Float32Array): number => a.reduce((m, v, k) => Math.max(m, Math.abs(v - b[k]!)), 0)
    const position = new Float32Array(stream(0).buffer)
    const normal = new Float32Array(stream(1).buffer)
    const uv = new Float32Array(stream(2).buffer)
    expect(new Uint32Array(stream(3).buffer)).toEqual(g.index)
    expect(worst(position, g.position)).toBeLessThanOrEqual(64 / 2 ** (STREAMS.POSITION.bits - 1))
    expect(worst(position, g.position)).toBeLessThan(1e-4)
    expect(worst(normal, g.normal)).toBeLessThan(1e-4)
    expect(worst(uv, g.uv)).toBeLessThan(1e-5)
    const change = r.change as Record<string, number>
    expect(change.POSITION).toBeCloseTo(worst(position, g.position), 12)
    expect(change.NORMAL).toBeCloseTo(worst(normal, g.normal), 12)
    expect(change.TEXCOORD_0).toBeCloseTo(worst(uv, g.uv), 12)
    const box = json.accessors[0]
    for (let c = 0; c < 3; c++) {
      let lo = Infinity
      let hi = -Infinity
      for (let k = c; k < position.length; k += 3) {
        lo = Math.min(lo, position[k]!)
        hi = Math.max(hi, position[k]!)
      }
      expect(box.min[c]).toBe(lo)
      expect(box.max[c]).toBe(hi)
    }
  })

  it('gives the same bytes for the same model, and leaves a model that is already packed as it is', async () => {
    const g = grid(24)
    const a = await packGlb(g.glb)
    const b = await packGlb(g.glb)
    expect(a.glb.equals(b.glb)).toBe(true)
    const again = await packGlb(a.glb)
    expect(again.packed).toBe(0)
    expect(again.glb.equals(a.glb)).toBe(true)
  })
})
