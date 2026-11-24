import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { fileSha, listFiles } from './lib/hashes.mjs'

const args = parseArgs(process.argv.slice(2))
const cfg = readJson(rel('config', 'showcase.json'))
const unit = args.unit && args.unit !== true ? String(args.unit) : ''
const phase = args.phase !== undefined && args.phase !== true ? String(args.phase) : ''
const JPEG = { quality: 93, chromaSubsampling: '4:4:4', mozjpeg: true }
const kept = []
const work = rel('out', 'work')
const short = (f) => path.relative(rel(), f).split(path.sep).join('/')

async function keepPicture(src, dstDir, name, extra = {}) {
  fs.mkdirSync(dstDir, { recursive: true })
  const dst = path.join(dstDir, `${name}.jpg`)
  if (/\.jpe?g$/i.test(src)) fs.copyFileSync(src, dst)
  else await sharp(src).jpeg(JPEG).toFile(dst)
  const recFile = fs.existsSync(`${src}.json`) ? `${src}.json` : src.replace(/\.[a-z]+$/i, '.json')
  const record = fs.existsSync(recFile) ? readJson(recFile) : {}
  writeJson(`${dst}.json`, { ...record, ...extra, keptFrom: short(src), sourceSha256: fileSha(src), keptAt: new Date().toISOString() })
  kept.push(short(dst))
}

const newest = (files) => files.map((f) => ({ f, t: fs.statSync(f).mtimeMs })).sort((a, b) => b.t - a.t)[0]?.f
const tierRank = { final: 3, review: 2, draft: 1 }

async function keepStillsOf(ids, folder) {
  const stills = listFiles(path.join(work, 'stills')).filter((f) => f.endsWith('.png') && fs.existsSync(`${f}.json`))
  for (const id of ids) {
    const mine = stills.map((f) => ({ f, r: readJson(`${f}.json`) })).filter((x) => x.r.spec?.id === id && !x.r.spec?.diag && !(x.r.noext?.length))
    if (!mine.length) continue
    mine.sort((a, b) => (tierRank[b.r.tier] ?? 0) - (tierRank[a.r.tier] ?? 0) || Date.parse(b.r.time) - Date.parse(a.r.time))
    await keepPicture(mine[0].f, rel('out', 'stills', folder), id)
  }
  for (const id of ids) {
    for (const f of listFiles(path.join(work, 'compare')).filter((x) => x.endsWith('.jpg') && path.basename(x).startsWith(`compare-${id}`))) {
      await keepPicture(f, rel('out', 'stills', folder), path.basename(f, '.jpg'), fs.existsSync(path.join(work, 'compare', `compare-${id}.json`)) ? { comparison: readJson(path.join(work, 'compare', `compare-${id}.json`)).caption } : {})
    }
  }
}

async function keepSheets(match, folder) {
  for (const f of listFiles(path.join(work, 'sheets')).filter((x) => x.endsWith('.jpg') && match(path.basename(x)))) await keepPicture(f, rel('out', 'stills', folder), path.basename(f, '.jpg'))
}

if (unit) {
  if (!cfg.units.some((u) => u.id === unit)) throw new Error(`no such unit: ${unit}`)
  const ids = [...cfg.keys, ...cfg.stills].filter((p) => p.unit === unit).map((p) => p.id)
  await keepStillsOf(ids, unit)
  await keepSheets((n) => n.includes(unit), unit)
} else if (phase !== '') {
  const folder = `phase-${phase}`
  const units = cfg.units.filter((u) => String(u.phase) === phase).map((u) => u.id)
  const ids = units.length ? [...cfg.keys, ...cfg.stills].filter((p) => units.includes(p.unit)).map((p) => p.id) : [cfg.keys[0].id]
  await keepStillsOf(ids, folder)
  await keepSheets(() => true, folder)
}

if (args.film === true) {
  for (const which of ['a', 'b']) {
    const name = which === 'a' ? cfg.export.files.previewA : cfg.export.files.previewB
    const src = newest(listFiles(work).filter((f) => new RegExp(`film-${which}-${cfg.formats.preview.id}-[a-z]+\\.mp4$`).test(f)))
    if (!src) continue
    fs.copyFileSync(src, rel('out', name))
    if (fs.existsSync(`${src}.json`)) writeJson(rel('out', `${name}.json`), { ...readJson(`${src}.json`), keptFrom: short(src), sourceSha256: fileSha(src) })
    kept.push(`out/${name}`)
  }
  // the film tool writes out/work/review-<candidate>.mp4. A file marked -partial is not the whole film and is not kept.
  const top = fs.existsSync(work) ? fs.readdirSync(work).sort().map((n) => path.join(work, n)) : []
  const reviewCuts = [...top.filter((f) => /^review-[a-z-]+\.mp4$/.test(path.basename(f)) && !/-partial\.mp4$/.test(f)), ...listFiles(path.join(work, 'review')).filter((f) => f.endsWith('.mp4'))]
  for (const src of reviewCuts) {
    fs.copyFileSync(src, rel('out', path.basename(src)))
    if (fs.existsSync(`${src}.json`)) fs.copyFileSync(`${src}.json`, rel('out', `${path.basename(src)}.json`))
    kept.push(`out/${path.basename(src)}`)
  }
}

if (args.deliver === true) {
  fs.mkdirSync(rel('deliver'), { recursive: true })
  for (const name of [cfg.export.files.cardLoop, cfg.export.files.cardLoopWeb, cfg.export.files.cardStill]) {
    const src = path.join(work, 'loop', name)
    if (!fs.existsSync(src)) continue
    fs.copyFileSync(src, rel('deliver', name))
    if (fs.existsSync(`${src}.json`)) fs.copyFileSync(`${src}.json`, rel('deliver', `${name}.json`))
    kept.push(`deliver/${name}`)
  }
}

if (!kept.length) console.log('nothing to keep yet')
else for (const k of kept) console.log(`kept ${k}`)
