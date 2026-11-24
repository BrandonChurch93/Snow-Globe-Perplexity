import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { composeComparison, composeCrops, fitForModel, limits, psnr, sideBySide } from '../tools/lib/compose.mjs'
import { loadConfig, readJson, rel } from '../tools/lib/paths.mjs'

type Limit = { longEdge: number; maxPixels: number; statusLongEdge: number }
type Raw = { data: Buffer; width: number; height: number }

const lim = limits() as Limit
let dir = ''

const pattern = (width: number, height: number, seed: number): Raw => {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3
      data[o] = (x * 7 + y * 3 + seed) & 255
      data[o + 1] = (x * 5 + y * 11 + seed * 3) & 255
      data[o + 2] = (x ^ y ^ seed) & 255
    }
  }
  return { data, width, height }
}

const blocks = (width: number, height: number, size: number): Raw => {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bx = Math.floor(x / size)
      const by = Math.floor(y / size)
      const o = (y * width + x) * 3
      data[o] = (bx + by) % 2 ? 40 + ((bx * 37) % 50) : 190 + ((by * 29) % 50)
      data[o + 1] = bx % 2 ? 50 + ((by * 13) % 40) : 180 + ((bx * 17) % 60)
      data[o + 2] = by % 2 ? 45 + ((bx * 11) % 40) : 185 + ((by * 7) % 60)
    }
  }
  return { data, width, height }
}

const writePng = async (img: Raw, file: string) => {
  await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } }).png().toFile(file)
  return file
}

const smooth = async (width: number, height: number, file: string, tint: [number, number, number]) => {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3
      data[o] = Math.round((tint[0] * x) / width)
      data[o + 1] = Math.round((tint[1] * y) / height)
      data[o + 2] = tint[2]
    }
  }
  return writePng({ data, width, height }, file)
}

const sizeOf = async (file: string) => {
  const m = await sharp(file).metadata()
  return { width: m.width as number, height: m.height as number, format: m.format, chroma: m.chromaSubsampling }
}

const expectFits = async (file: string) => {
  const s = await sizeOf(file)
  expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(lim.longEdge)
  expect(s.width * s.height).toBeLessThanOrEqual(lim.maxPixels)
  return s
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-'))
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('limits', () => {
  it('come from the config files', () => {
    const cfg = loadConfig()
    const file = readJson(rel('config', 'image-limit.json'))
    expect(lim.longEdge).toBe(cfg.critics.maxImageLongEdgePx)
    expect(lim.maxPixels).toBeLessThanOrEqual(file.maxPixels)
    expect(lim.statusLongEdge).toBe(cfg.status.pictureLongEdgePx)
  })
})

describe('composeComparison', () => {
  it('writes panels, crop sheets and a record that all obey both limits', async () => {
    const a = await smooth(2816, 1584, path.join(dir, 'a.png'), [200, 120, 60])
    const b = await smooth(1920, 1080, path.join(dir, 'b.png'), [60, 200, 120])
    const out = path.join(dir, 'compare-x.jpg')
    const res = await composeComparison({
      a: { file: a, globe: { cx: 1411, cy: 652, r: 553 }, base: { left: 872, right: 1939, top: 1075, foot: 1443 } },
      b: { file: b, globe: { cx: 960, cy: 452, r: 364 }, base: { left: 600, right: 1320, top: 730, foot: 980 } },
      out,
      caption: 'a test',
    })
    expect(res.files[0]).toBe(out)
    expect(res.files.length).toBeGreaterThan(1)
    expect(res.files.slice(1).map((f: string) => path.basename(f))).toEqual(res.files.slice(1).map((_: string, i: number) => `compare-x-crops-${i + 1}.jpg`))
    for (let i = 0; i < res.files.length; i++) {
      const s = await expectFits(res.files[i])
      expect(s.width).toBe(res.widths[i])
      expect(s.height).toBe(res.heights[i])
      expect(s.format).toBe('jpeg')
      expect(s.chroma).toBe('4:4:4')
    }
    const main = await sizeOf(out)
    expect(main.width).toBe(lim.longEdge)
    const record = readJson(path.join(dir, 'compare-x.json'))
    expect(record.caption).toBe('a test')
    expect(record.a.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(record.b.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(record.crops.map((c: { name: string }) => c.name)).toEqual(['miniature', 'crown', 'collar', 'base-front', 'foot'])
    expect(record.panels.a.width).toBe(record.panels.b.width)
    expect(record.files.length).toBe(res.files.length)
  })

  it('puts both globes at the same place and size in their panels', async () => {
    const disc = async (w: number, h: number, cx: number, cy: number, r: number, file: string) => {
      const data = Buffer.alloc(w * h * 3, 10)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) data.fill(240, (y * w + x) * 3, (y * w + x) * 3 + 3)
        }
      }
      return writePng({ data, width: w, height: h }, file)
    }
    const a = await disc(2816, 1584, 1380, 660, 550, path.join(dir, 'da.png'))
    const b = await disc(1920, 1080, 975, 440, 371, path.join(dir, 'db.png'))
    const out = path.join(dir, 'compare-d.png')
    await composeComparison({ a: { file: a, globe: { cx: 1380, cy: 660, r: 550 } }, b: { file: b, globe: { cx: 975, cy: 440, r: 371 } }, out })
    const record = readJson(path.join(dir, 'compare-d.json'))
    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const box = (p: { left: number; top: number; width: number; height: number }) => {
      let x0 = Infinity
      let x1 = -1
      let y0 = Infinity
      let y1 = -1
      for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
          if (data[((p.top + y) * info.width + p.left + x) * 3] > 128) {
            x0 = Math.min(x0, x)
            x1 = Math.max(x1, x)
            y0 = Math.min(y0, y)
            y1 = Math.max(y1, y)
          }
        }
      }
      return { cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2, r: (x1 - x0 + 1) / 2 }
    }
    const ga = box(record.panels.a)
    const gb = box(record.panels.b)
    expect(Math.abs(ga.cx - gb.cx)).toBeLessThanOrEqual(1)
    expect(Math.abs(ga.cy - gb.cy)).toBeLessThanOrEqual(1)
    expect(Math.abs(ga.r - gb.r)).toBeLessThanOrEqual(1)
    expect(Math.abs(ga.r - record.panels.globeRadiusPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(ga.cx - record.panels.a.width / 2)).toBeLessThanOrEqual(1)
  })

  it('is deterministic', async () => {
    const a = await smooth(1600, 900, path.join(dir, 'ra.png'), [90, 90, 200])
    const b = await smooth(1920, 1080, path.join(dir, 'rb.png'), [200, 90, 90])
    const args = { a: { file: a, globe: { cx: 800, cy: 370, r: 310 } }, b: { file: b, globe: { cx: 960, cy: 450, r: 360 } } }
    const one = await composeComparison({ ...args, out: path.join(dir, 'r1.jpg') })
    const two = await composeComparison({ ...args, out: path.join(dir, 'r2.jpg') })
    for (let i = 0; i < one.files.length; i++) {
      expect(fs.readFileSync(one.files[i]).equals(fs.readFileSync(two.files[i]))).toBe(true)
    }
  })
})

describe('composeCrops', () => {
  it('cuts exactly the pixels asked for and obeys both limits', async () => {
    const src = blocks(1920, 1080, 16)
    const file = await writePng(src, path.join(dir, 'src.png'))
    const regions = [
      { name: 'one', cx: 400, cy: 300, w: 696, h: 392 },
      { name: 'two', cx: 1500, cy: 300, w: 696, h: 392 },
      { name: 'three', cx: 960, cy: 540, w: 500, h: 500 },
      { name: 'corner', cx: 10, cy: 10, w: 300, h: 200 },
      { name: 'far', cx: 1915, cy: 1075, w: 640, h: 360 },
      { name: 'six', cx: 700, cy: 800, w: 696, h: 392 },
      { name: 'seven', cx: 1200, cy: 200, w: 696, h: 392 },
    ]
    const outPrefix = path.join(dir, 'crops')
    const files = await composeCrops({ file, regions, outPrefix })
    expect(files.length).toBeGreaterThan(1)
    expect(files.map((f: string) => path.basename(f))).toEqual(files.map((_: string, i: number) => `crops-${i + 1}.jpg`))
    for (const f of files) await expectFits(f)

    const record = readJson(`${outPrefix}.json`)
    const placed = record.sheets.flatMap((s: { regions: unknown[] }) => s.regions) as {
      name: string
      source: { left: number; top: number; width: number; height: number }
      at: { left: number; top: number; width: number; height: number }
    }[]
    expect(placed.map((p) => p.name)).toEqual(regions.map((r) => r.name))
    expect(placed[0].source).toEqual({ left: 52, top: 104, width: 696, height: 392 })
    expect(placed[3].source).toEqual({ left: 0, top: 0, width: 300, height: 200 })
    expect(placed[4].source).toEqual({ left: 1280, top: 720, width: 640, height: 360 })

    const pngPrefix = path.join(dir, 'exact')
    const one = [regions[0], regions[3]]
    await composeCrops({ file, regions: one, outPrefix: pngPrefix, cols: 2 })
    const rec = readJson(`${pngPrefix}.json`)
    const sheet = await sharp(path.join(dir, 'exact-1.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let worst = 0
    for (const p of rec.sheets[0].regions) {
      expect(p.at.width).toBe(p.source.width)
      expect(p.at.height).toBe(p.source.height)
      for (let y = 0; y < p.source.height; y++) {
        for (let x = 0; x < p.source.width; x++) {
          for (let c = 0; c < 3; c++) {
            const want = src.data[((p.source.top + y) * src.width + p.source.left + x) * 3 + c]
            const got = sheet.data[((p.at.top + y) * sheet.info.width + p.at.left + x) * 3 + c]
            worst = Math.max(worst, Math.abs(want - got))
          }
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(12)

    const flat = await smooth(900, 700, path.join(dir, 'flat.png'), [255, 255, 128])
    const flatPrefix = path.join(dir, 'flatcrops')
    await composeCrops({ file: flat, regions: [{ name: 'q', cx: 450, cy: 350, w: 320, h: 240 }], outPrefix: flatPrefix })
    const cutOut = path.join(dir, 'flat-cut.png')
    await sharp(flat).extract({ left: 290, top: 230, width: 320, height: 240 }).png().toFile(cutOut)
    const same = await psnr(path.join(dir, 'flatcrops-1.jpg'), cutOut)
    expect(same.width).toBe(320)
    expect(same.height).toBe(240)
    expect(same.psnr).toBeGreaterThan(45)
    expect(same.maxDiff).toBeLessThanOrEqual(4)
  })
})

describe('fitForModel', () => {
  it('scales down to both limits and never scales up', async () => {
    const wide = await smooth(2816, 1584, path.join(dir, 'wide.png'), [10, 200, 90])
    const s1 = await fitForModel(wide, path.join(dir, 'wide-fit.jpg'))
    const m1 = await expectFits(path.join(dir, 'wide-fit.jpg'))
    expect(s1).toEqual({ width: m1.width, height: m1.height })
    expect(m1.width).toBe(lim.longEdge)

    const square = await smooth(1400, 1400, path.join(dir, 'square.png'), [10, 200, 90])
    await fitForModel(square, path.join(dir, 'square-fit.png'))
    const m2 = await expectFits(path.join(dir, 'square-fit.png'))
    expect(m2.format).toBe('png')
    expect(m2.width).toBe(m2.height)
    expect(m2.width).toBeLessThan(1400)

    const small = await writePng(pattern(320, 200, 9), path.join(dir, 'small.png'))
    const s3 = await fitForModel(small, path.join(dir, 'small-fit.png'))
    expect(s3).toEqual({ width: 320, height: 200 })
    expect((await psnr(small, path.join(dir, 'small-fit.png'))).psnr).toBe(Infinity)
  })
})

describe('psnr', () => {
  it('is infinite for a file with itself', async () => {
    const f = await writePng(pattern(64, 48, 1), path.join(dir, 'p.png'))
    const r = await psnr(f, f)
    expect(r.psnr).toBe(Infinity)
    expect(r.mse).toBe(0)
    expect(r.maxDiff).toBe(0)
    expect(r.differingPixels).toBe(0)
    expect(r.width).toBe(64)
    expect(r.height).toBe(48)
  })

  it('is finite and correct for a known difference', async () => {
    const base: Raw = { data: Buffer.alloc(64 * 48 * 3, 100), width: 64, height: 48 }
    const changed: Raw = { data: Buffer.from(base.data), width: 64, height: 48 }
    for (let i = 0; i < 10; i++) changed.data[i * 3 + 1] = 110
    const fa = await writePng(base, path.join(dir, 'ka.png'))
    const fb = await writePng(changed, path.join(dir, 'kb.png'))
    const r = await psnr(fa, fb)
    const mse = (10 * 10 * 10) / (64 * 48 * 3)
    expect(r.mse).toBeCloseTo(mse, 12)
    expect(r.psnr).toBeCloseTo(10 * Math.log10((255 * 255) / mse), 9)
    expect(Number.isFinite(r.psnr)).toBe(true)
    expect(r.maxDiff).toBe(10)
    expect(r.differingPixels).toBe(10)

    const all: Raw = { data: Buffer.alloc(64 * 48 * 3, 101), width: 64, height: 48 }
    const fc = await writePng(all, path.join(dir, 'kc.png'))
    const r2 = await psnr(fa, fc)
    expect(r2.mse).toBe(1)
    expect(r2.psnr).toBeCloseTo(20 * Math.log10(255), 9)
    expect(r2.differingPixels).toBe(64 * 48)
  })

  it('throws when the sizes differ', async () => {
    const fa = await writePng(pattern(64, 48, 1), path.join(dir, 'sa.png'))
    const fb = await writePng(pattern(48, 64, 1), path.join(dir, 'sb.png'))
    await expect(psnr(fa, fb)).rejects.toThrow(/sizes differ/)
  })
})

describe('sideBySide', () => {
  it('lays pictures in one row at one height inside the long edge', async () => {
    const f1 = await smooth(1920, 1080, path.join(dir, 's1.png'), [200, 10, 10])
    const f2 = await smooth(800, 800, path.join(dir, 's2.png'), [10, 200, 10])
    const f3 = await smooth(600, 900, path.join(dir, 's3.png'), [10, 10, 200])
    const out = path.join(dir, 'row.jpg')
    const s = await sideBySide({ files: [f1, f2, f3], out })
    const m = await sizeOf(out)
    expect(s).toEqual({ width: m.width, height: m.height })
    expect(Math.max(m.width, m.height)).toBeLessThanOrEqual(lim.statusLongEdge)
    expect(m.width).toBeGreaterThan(lim.statusLongEdge - 8)

    const s2 = await sideBySide({ files: [f2, f3], out: path.join(dir, 'row2.png'), gap: 4, maxLongEdge: 500 })
    expect(Math.max(s2.width, s2.height)).toBeLessThanOrEqual(500)
  })
})
