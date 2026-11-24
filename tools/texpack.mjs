import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { writeAssetIndex } from './lib/hashes.mjs'
import { loadConfig, parseArgs, rel } from './lib/paths.mjs'

const cfg = loadConfig()
const args = parseArgs(process.argv.slice(2))
const only = args.group && args.group !== true ? String(args.group).split(',') : null
const cap = Math.max(cfg.assetSets.web.baseMapPx, cfg.assetSets.web.interiorMapPx)
const full = rel('assets-full')
let pictures = 0
let copies = 0
let bytes = 0
for (const group of fs.existsSync(full) ? fs.readdirSync(full) : []) {
  if (only && !only.includes(group)) continue
  const dir = path.join(full, group)
  if (!fs.statSync(dir).isDirectory()) continue
  const out = rel('public', 'assets', group)
  fs.mkdirSync(out, { recursive: true })
  for (const name of fs.readdirSync(dir)) {
    const from = path.join(dir, name)
    const to = path.join(out, name)
    if (!fs.statSync(from).isFile()) continue
    if (/\.png$/i.test(name)) {
      const meta = await sharp(from).metadata()
      const long = Math.max(meta.width, meta.height)
      const limit = Number(/\.w(\d+)\./.exec(name)?.[1] ?? cap)
      const buf = long > limit ? await sharp(from).resize({ width: Math.round((meta.width * limit) / long), height: Math.round((meta.height * limit) / long), kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer() : fs.readFileSync(from)
      if (!fs.existsSync(to) || !fs.readFileSync(to).equals(buf)) fs.writeFileSync(to, buf)
      pictures++
      bytes += buf.length
    } else {
      const buf = fs.readFileSync(from)
      if (!fs.existsSync(to) || !fs.readFileSync(to).equals(buf)) fs.writeFileSync(to, buf)
      copies++
      bytes += buf.length
    }
  }
  for (const name of fs.readdirSync(out)) if (!fs.existsSync(path.join(dir, name))) fs.rmSync(path.join(out, name))
}
writeAssetIndex()
console.log(`texpack: ${pictures} pictures at most ${cap} px and ${copies} other files into public/assets, ${(bytes / 1e6).toFixed(1)} MB; asset index written`)
