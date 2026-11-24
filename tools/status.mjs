import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { rel, parseArgs, loadConfig, readJson, writeJson, replaceSection } from './lib/paths.mjs'
import { readLooks, shownSet, markShown } from './lib/looks.mjs'
import { ensureDir } from './lib/browser.mjs'

const args = parseArgs(process.argv.slice(2))
if (args.help === true || args.h === true) {
  console.log('npm run status -- --phase N [--unit ID] [--key ID] [--say "a|b"] [--pics a,b --captions "x|y"] [--pair-note T] [--sounds] [--no-render] [--no-tick] [--review-round N] [--extension N]')
  process.exit(0)
}
const cfg = loadConfig()
const outDir = rel('out', 'stills', 'status')
const workDir = rel('out', 'work', 'status')
const progressFile = rel('kit', 'PROGRESS.md')
const MAX = cfg.status.maxPictures
const EDGE = cfg.status.pictureLongEdgePx
const time = `${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`

const tickArgs = args['review-round'] ? ['--review-round', String(args['review-round'])] : args.extension ? ['--extension', String(args.extension)] : ['--phase', String(args.phase ?? 0)]
let clockLines = []
if (args['no-tick'] !== true) clockLines = execFileSync('node', [rel('tools', 'clock.mjs'), ...tickArgs, '--status'], { encoding: 'utf8' }).trim().split('\n')
else clockLines = execFileSync('node', [rel('tools', 'clock.mjs'), ...tickArgs, '--peek'], { encoding: 'utf8' }).trim().split('\n')

const picks = []
const have = (f) => picks.some((p) => p.file === f)
const add = (file, caption, n) => {
  if (picks.length < MAX && fs.existsSync(file) && !have(file)) picks.push({ file, caption, n })
}

async function pair(aFile, bFile, out) {
  const h = 1080
  const a = await sharp(aFile).resize({ height: h }).toBuffer({ resolveWithObject: true })
  const b = await sharp(bFile).resize({ height: h }).toBuffer({ resolveWithObject: true })
  const gap = 16
  await sharp({ create: { width: a.info.width + b.info.width + gap, height: h, channels: 3, background: '#0b0d10' } })
    .composite([
      { input: a.data, left: 0, top: 0 },
      { input: b.data, left: a.info.width + gap, top: 0 },
    ])
    .jpeg({ quality: 90 })
    .toFile(out)
  return out
}

const allPics = [...cfg.keys, ...cfg.stills]
const keyId = args.key && args.key !== true ? String(args.key) : args.unit && args.unit !== true ? (cfg.keys.find((k) => k.unit === args.unit)?.id ?? '') : ''
if (keyId) {
  const key = allPics.find((k) => k.id === keyId)
  if (key?.image) {
    const dir = rel('out', 'work', 'stills')
    const candidates = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png') && (f.startsWith(`${key.id}-`) || f.startsWith(`${key.season}-${key.state}-${key.camera}-${key.format}-`)) && !/-(ids|standins|ui)\b/.test(f)) : []
    let best = candidates.map((f) => path.join(dir, f)).sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs)[0]
    if (!best && args['no-render'] !== true) {
      const { renderBusy } = await import('./lib/page.mjs')
      if (!renderBusy()) {
        try {
          execFileSync('node', [rel('tools', 'still.mjs'), '--key', key.id, '--tier', 'review'], { stdio: 'ignore' })
          best = path.join(dir, `${key.id}-${key.format}-review.png`)
        } catch {}
      }
    }
    if (best && fs.existsSync(best)) {
      ensureDir(workDir)
      const out = path.join(workDir, `pair-${key.id}.jpg`)
      await pair(rel(key.image), best, out)
      add(out, `Left: the approved image for ${key.id}. Right: the build's still of it${args['pair-note'] && args['pair-note'] !== true ? `. ${args['pair-note']}` : ''}`)
    }
  }
}

if (args.sounds === true) add(rel('out', 'work', 'audio', 'sheet.jpg'), 'The kept sounds as waveforms')
if (args.pics && args.pics !== true) {
  const files = String(args.pics).split(',')
  const captions = args.captions && args.captions !== true ? String(args.captions).split('|') : []
  files.forEach((f, i) => add(path.resolve(f), captions[i] ?? path.basename(f)))
}
const shown = shownSet()
const looks = readLooks().filter((l) => !shown.has(l.n) && fs.existsSync(rel(l.file)) && /\.(png|jpe?g|webp)$/i.test(l.file))
for (const l of looks.reverse()) add(rel(l.file), `${l.caption}${l.by && l.by !== 'builder' ? ` (by ${l.by})` : ''}`, l.n)
if (!picks.length) add(rel('references', 'approved', 'contact-sheet.jpg'), 'Nothing new was rendered since the last status. The approved images, for reference')

const previous = fs.existsSync(path.join(outDir, 'status.json')) ? readJson(path.join(outDir, 'status.json')) : null
const lastNumber = previous?.number ?? fs.readdirSync(ensureDir(outDir)).map((f) => Number(/^status-(\d+)/.exec(f)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0)
const number = lastNumber + 1
for (const f of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, f))
ensureDir(workDir)

const pictures = []
const gallery = []
for (let i = 0; i < picks.length; i++) {
  const p = picks[i]
  const name = `status-${number}-${i + 1}.jpg`
  const img = sharp(p.file).resize({ width: EDGE, height: EDGE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 })
  const { data, info } = await img.toBuffer({ resolveWithObject: true })
  fs.writeFileSync(path.join(outDir, name), data)
  pictures.push({ file: `out/stills/status/${name}`, caption: p.caption, w: info.width, h: info.height })
  gallery.push({ label: p.caption, w: info.width, h: info.height, src: `data:image/jpeg;base64,${data.toString('base64')}` })
}
markShown(picks.filter((p) => p.n).map((p) => p.n))

const md = fs.readFileSync(progressFile, 'utf8')
const field = (k) => new RegExp(`^- ${k}: (.*)$`, 'm').exec(md)?.[1] ?? ''
const phase = args.phase ?? field('Phase')
const unit = args.unit && args.unit !== true ? String(args.unit) : ''
const say = args.say && args.say !== true ? String(args.say).split('|').map((s) => s.trim()).filter(Boolean) : []
const used = clockLines.filter((l) => /used of|extra rounds|half point|box end|budget report|status overdue/.test(l))
const lines = [
  `Status ${number} · ${time} · Phase ${phase}${unit ? ` · unit ${unit}` : ''}`,
  ...say,
  ...used.filter((l) => /used of/.test(l)),
  `App: ${field('App URL')}`,
  `Review page: ${field('Review page')}`,
]
writeJson(path.join(outDir, 'status.json'), { number, time, phase: String(phase), unit, lines, pictures })
fs.writeFileSync(path.join(outDir, 'STATUS.md'), [`# Status ${number}`, '', time, '', ...lines.slice(1).map((l) => `- ${l}`), '', ...pictures.map((p) => `- \`${p.file}\`: ${p.caption}`), ''].join('\n'))
fs.writeFileSync(path.join(workDir, 'gallery.json'), JSON.stringify({ lines, pics: gallery }))
const latest = ['The pictures of the newest status, with their captions and the time. Files are in `out/stills/status/`.', '', `Status ${number} · ${time}`, '', ...pictures.map((p) => `- \`${p.file}\`: ${p.caption}`)].join('\n')
fs.writeFileSync(progressFile, replaceSection(fs.readFileSync(progressFile, 'utf8'), 'Latest pictures', latest))
console.log(lines.join('\n'))
console.log('---')
console.log(clockLines.join('\n'))
console.log(`pictures: ${pictures.length}, gallery ${(fs.statSync(path.join(workDir, 'gallery.json')).size / 1024).toFixed(0)} kB`)
