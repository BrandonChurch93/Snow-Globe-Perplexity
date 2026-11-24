import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel, loadConfig, writeJson } from './lib/paths.mjs'
import { Session, stillSpec, renderStill } from './lib/page.mjs'
import { pixels } from './lib/pixels.mjs'

/**
 * What the first picture of the live page costs in sharpness.
 *
 * The live page draws its first picture from the `.first.` files of the web set (each picture at half its size, see
 * tools/lib/webset.mjs) and fetches the whole files behind it. This renders the same still twice from the web set, once held at
 * the first files (`detail=first`) and once whole, and says how far the two are apart, per camera.
 * `--camera hero,macro` names the cameras, `--season` and `--state` the picture, `--tier` the tier (draft).
 * Files: out/work/firstlook/<camera>-first.png, <camera>-whole.png, <camera>-pair.jpg, result.json.
 */

const args = parseArgs(process.argv.slice(2))
const cfg = loadConfig()
const cameras = args.camera && args.camera !== true ? String(args.camera).split(',') : ['hero', 'macro']
const season = args.season && args.season !== true ? String(args.season) : cfg.defaultSeason
const state = args.state && args.state !== true ? String(args.state) : 'rest'
const tier = args.tier && args.tier !== true ? String(args.tier) : 'draft'
const dir = rel('out', 'work', 'firstlook')

function compare(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('the two pictures do not have the same size')
  const n = a.width * a.height
  let max = 0
  let sum = 0
  let sq = 0
  let over2 = 0
  let over8 = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    let m = 0
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(a.data[o + k] - b.data[o + k])
      sum += d
      sq += d * d
      if (d > m) m = d
    }
    if (m > max) max = m
    if (m > 2) over2++
    if (m > 8) over8++
  }
  return { largest: max, mean: sum / (n * 3), psnr: sq === 0 ? null : 10 * Math.log10((255 * 255) / (sq / (n * 3))), shareOver2: over2 / n, shareOver8: over8 / n }
}

const session = await Session.open()
const result = { time: new Date().toISOString(), season, state, tier, format: cfg.formats.hd.id, cameras: {} }
try {
  for (const camera of cameras) {
    const spec = stillSpec({ season, state, camera, tier, format: cfg.formats.hd.id, assets: 'web' })
    const files = {}
    const standIns = {}
    for (const [which, extra] of [
      ['first', '&detail=first'],
      ['whole', ''],
    ]) {
      const page = await session.page({ format: spec.format, assets: 'web', extra })
      const file = path.join(dir, `${camera}-${which}.png`)
      const r = await renderStill(session, spec, { file, force: true, page })
      standIns[which] = r.record.standIns
      if (r.record.errors?.length) console.log(`page messages (${camera}, ${which}):\n${r.record.errors.join('\n')}`)
      await page.context().close()
      files[which] = file
    }
    // A part whose files did not load is drawn as a stand-in: the first files must give every part the whole set gives.
    if (standIns.first !== standIns.whole) throw new Error(`${camera}: ${standIns.first} parts are stand-ins from the first files, ${standIns.whole} from the whole set`)
    const d = compare(await pixels(files.first), await pixels(files.whole))
    const meta = await sharp(files.whole).metadata()
    const half = Math.min(600, meta.width)
    const side = async (f) => sharp(f).resize({ width: half }).toBuffer()
    const pair = path.join(dir, `${camera}-pair.jpg`)
    await sharp({ create: { width: half * 2, height: Math.round((meta.height * half) / meta.width), channels: 3, background: '#000' } })
      .composite([
        { input: await side(files.first), left: 0, top: 0 },
        { input: await side(files.whole), left: half, top: 0 },
      ])
      .jpeg({ quality: 92 })
      .toFile(pair)
    result.cameras[camera] = { ...d, first: path.relative(rel(), files.first), whole: path.relative(rel(), files.whole), pair: path.relative(rel(), pair) }
    console.log(
      `${camera}: first files against the whole set · largest difference ${d.largest} of 255, mean ${d.mean.toFixed(3)}, ${d.psnr === null ? 'identical' : `${d.psnr.toFixed(1)} dB`}, ${(d.shareOver2 * 100).toFixed(2)} % of pixels differ by more than 2, ${(d.shareOver8 * 100).toFixed(2)} % by more than 8`,
    )
  }
} finally {
  await session.close()
}
writeJson(path.join(dir, 'result.json'), result)
console.log(`firstlook: ${path.relative(rel(), path.join(dir, 'result.json'))}`)
