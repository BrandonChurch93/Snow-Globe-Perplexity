import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ROOT, rel, readJson, loadConfig, parseArgs, readSection } from './lib/paths.mjs'

const args = parseArgs(process.argv.slice(2))
const maxMb = Number(args['max-mb']) > 0 ? Number(args['max-mb']) : 450
const MB = 1048576

const config = loadConfig()
const seasons = config.seasons ?? []
const files = config.export?.files ?? {}
const candidates = config.audio?.candidates ?? []
const hdId = config.formats?.hd?.id ?? 'hd'

const DIST = rel('dist')
const OUT = path.join(DIST, 'review')
const IMAGE = /\.(jpe?g|png|webp|avif|gif)$/i
const SOUND = ['wav', 'mp3', 'm4a']

const exists = (p) => {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}
const sizeOf = (p) => {
  try {
    return fs.statSync(p).size
  } catch {
    return 0
  }
}
const list = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}
const dirSize = (dir, skip) => {
  let total = 0
  for (const e of list(dir)) {
    const p = path.join(dir, e.name)
    if (p === skip) continue
    total += e.isDirectory() ? dirSize(p, skip) : sizeOf(p)
  }
  return total
}
const tryJson = (p) => {
  try {
    return readJson(p)
  } catch {
    return null
  }
}
const tryText = (p) => {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}
const run = (cmd, argv) => {
  try {
    return execFileSync(cmd, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * MB })
  } catch {
    return null
  }
}

function probe(file) {
  const raw = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file])
  if (!raw) return {}
  try {
    const j = JSON.parse(raw)
    const v = (j.streams ?? []).find((s) => s.codec_type === 'video' && s.width)
    const d = Number(j.format?.duration)
    return { seconds: Number.isFinite(d) ? d : null, w: v?.width ?? null, h: v?.height ?? null }
  } catch {
    return {}
  }
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = (s) => String(s ?? '').replace(/\s*\u2014\s*/g, ', ').replace(/!/g, '.')
const text = (s) => esc(plain(s))
const url = (p) => './review/' + p.split('/').map(encodeURIComponent).join('/')
const words = (s) => String(s).replace(/[-_]+/g, ' ')
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function length(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 10) return `${Number(seconds.toFixed(2))} s`
  if (seconds < 60) return `${Number(seconds.toFixed(1))} s`
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)} min ${whole % 60} s`
}
function size(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  return `${bytes > 0 ? Math.max(1, Math.round(bytes / 1024)) : 0} KB`
}

function put(src, to) {
  const dest = path.join(OUT, to)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  return to
}

function putSound(src, base) {
  const ext = path.extname(src).slice(1).toLowerCase()
  if (ext !== 'wav') return put(src, `audio/${base}.${ext}`)
  const to = `audio/${base}.m4a`
  const dest = path.join(OUT, to)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const done = run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', dest])
  if (done !== null && sizeOf(dest) > 0) return to
  fs.rmSync(dest, { force: true })
  asWav.push(path.basename(src))
  return put(src, `audio/${base}.wav`)
}

function walk(dir, skip, found = []) {
  for (const e of list(dir).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name)
    if (p === skip) continue
    if (e.isDirectory()) walk(p, skip, found)
    else found.push(p)
  }
  return found
}

function readClock() {
  const md = tryText(rel('kit', 'PROGRESS.md'))
  if (!md) return { phase: null, lines: [] }
  const phase = (readSection(md, 'Status') ?? '').match(/^- Phase:\s*(.+)$/m)?.[1]?.trim() ?? null
  const lines = (readSection(md, 'Clock') ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(phase|allowance)\b/.test(l))
  return { phase, lines }
}

function readStatus() {
  const dir = rel('out', 'stills', 'status')
  const record = tryJson(path.join(dir, 'status.json'))
  if (record && Array.isArray(record.pictures)) {
    const pictures = record.pictures.filter((p) => p?.file && exists(path.join(dir, path.basename(p.file)))).map((p) => ({ src: path.join(dir, path.basename(p.file)), caption: p.caption ?? '', w: p.w, h: p.h }))
    const head = [record.number != null ? `Status ${record.number}` : null, record.time].filter(Boolean).join(', ')
    return { head, lines: Array.isArray(record.lines) ? record.lines : [], pictures }
  }
  const md = tryText(path.join(dir, 'STATUS.md'))
  if (md) {
    const pictures = []
    for (const line of md.split('\n')) {
      const m = line.match(/^\s*[-*]\s*`([^`]+)`\s*:?\s*(.*)$/)
      if (!m) continue
      const src = path.join(dir, path.basename(m[1]))
      if (IMAGE.test(src) && exists(src)) pictures.push({ src, caption: m[2].trim() })
    }
    const time = md.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/)?.[0] ?? ''
    const number = md.match(/^#*\s*Status (\d+)/m)?.[1]
    if (pictures.length) return { head: [number ? `Status ${number}` : null, time].filter(Boolean).join(', '), lines: [], pictures }
  }
  const max = config.status?.maxPictures ?? 4
  const pictures = list(dir)
    .filter((e) => e.isFile() && IMAGE.test(e.name))
    .map((e) => ({ src: path.join(dir, e.name), caption: '', at: fs.statSync(path.join(dir, e.name)).mtimeMs }))
    .sort((a, b) => b.at - a.at || b.src.localeCompare(a.src, undefined, { numeric: true }))
    .slice(0, max)
    .reverse()
  return { head: '', lines: [], pictures }
}

function readCues() {
  const dir = rel('audio', 'kept')
  const names = list(dir).filter((e) => e.isFile()).map((e) => e.name)
  const cues = []
  const used = new Set()
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    const record = tryJson(path.join(dir, name))
    if (!record || typeof record !== 'object') continue
    const id = String(record.id ?? name.slice(0, -5))
    const file = [record.file, ...SOUND.map((x) => `${id}.${x}`)].filter(Boolean).map((f) => path.basename(String(f))).find((f) => names.includes(f))
    if (!file) continue
    used.add(file)
    cues.push({ id, cls: String(record.class ?? ''), season: record.season ?? null, src: path.join(dir, file), seconds: Number(record.seconds), prompt: record.prompt ?? '', line: record.line ?? '' })
  }
  for (const name of names.sort()) {
    const ext = path.extname(name).slice(1).toLowerCase()
    if (!SOUND.includes(ext) || used.has(name)) continue
    cues.push({ id: name.slice(0, -ext.length - 1), cls: '', season: null, src: path.join(dir, name), seconds: NaN, prompt: '', line: '' })
  }
  const order = (config.audio?.sfx ?? []).map((s) => s.id)
  const rank = (c) => (order.indexOf(c.id) < 0 ? order.length : order.indexOf(c.id))
  cues.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
  return cues
}

function newestHd() {
  const dir = rel('out', 'work')
  const pattern = new RegExp(`^film-(.+)-${hdId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-([^-]+)\\.mp4$`)
  const best = new Map()
  for (const e of list(dir)) {
    const m = e.isFile() && e.name.match(pattern)
    if (!m) continue
    const src = path.join(dir, e.name)
    const at = fs.statSync(src).mtimeMs
    if (!best.has(m[1]) || best.get(m[1]).at < at) best.set(m[1], { which: m[1], tier: m[2], src, at })
  }
  return [...best.values()].sort((a, b) => b.which.localeCompare(a.which))
}

function firstOf(name) {
  if (!name) return null
  return [rel('deliver', name), rel('out', 'work', 'loop', name)].find(exists) ?? null
}

function gather() {
  const videos = []
  const video = (part, src, to, title, extra = {}) => {
    if (!src || !exists(src)) return
    videos.push({ part, src, to: `video/${to}`, title, bytes: sizeOf(src), ...extra })
  }
  const cut = files.reviewCut ?? 'review-cut.mp4'
  // the film tool writes out/work/review-<candidate>.mp4. The older place, out/work/review-cuts/<candidate>/, is still read.
  const reviewCut = (c) => [rel('out', 'work', `review-${c}.mp4`), rel('out', 'work', 'review-cuts', c, cut)].find((f) => exists(f))
  for (const c of candidates) video('listen', reviewCut(c), `review-cut-${c}.mp4`, `Review cut, ${words(c)}`)
  video('listen', reviewCut('silent'), 'review-cut-silent.mp4', 'Review cut, no music')
  video('films', rel('out', 'roughcut.mp4'), 'roughcut.mp4', 'Rough cut')
  if (files.previewB) video('films', rel('out', files.previewB), files.previewB, 'Film B, preview')
  if (files.previewA) video('films', rel('out', files.previewA), files.previewA, 'Film A, preview, with the prompt opening')
  for (const f of newestHd()) video('films', f.src, path.basename(f.src), `Film ${f.which.toUpperCase()}, full size, ${words(f.tier)} tier`)
  video('card', firstOf(files.cardLoop), files.cardLoop, 'Card loop', { loop: true })
  video('card', firstOf(files.cardLoopWeb), files.cardLoopWeb, 'Card loop, web copy', { loop: true })
  return videos
}

function fit(videos, fixedBytes) {
  const limit = maxMb * MB
  const kept = [...videos]
  const dropped = []
  const total = () => fixedBytes + kept.reduce((n, v) => n + v.bytes + 150000, 0) + 200000
  while (kept.length && total() > limit) {
    const largest = kept.reduce((a, b) => (b.bytes > a.bytes ? b : a))
    kept.splice(kept.indexOf(largest), 1)
    dropped.push(largest)
  }
  return { kept, dropped }
}

function placeVideo(v) {
  put(v.src, v.to)
  Object.assign(v, probe(v.src))
  const poster = v.to.replace(/\.[^.]+$/, '.jpg').replace(/^video\//, 'poster/')
  const dest = path.join(OUT, poster)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const at = Number.isFinite(v.seconds) ? Math.min(1, v.seconds / 4) : 0
  const made = run('ffmpeg', ['-v', 'error', '-y', '-ss', at.toFixed(3), '-i', v.src, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '4', dest])
  v.poster = made !== null && sizeOf(dest) > 0 ? poster : null
  if (!v.poster) fs.rmSync(dest, { force: true })
}

function removeVideo(v) {
  fs.rmSync(path.join(OUT, v.to), { force: true })
  if (v.poster) fs.rmSync(path.join(OUT, v.poster), { force: true })
}

const asWav = []

const NOTHING = '<p class="none">Nothing here yet.</p>'
const label = (s) => `<p class="label">${text(s)}</p>`

function videoTag(v) {
  const dims = v.w && v.h ? ` width="${v.w}" height="${v.h}"` : ''
  const poster = v.poster ? ` poster="${url(v.poster)}"` : ''
  const mode = v.loop ? ' autoplay loop muted' : ''
  const facts = [length(v.seconds), size(v.bytes)].filter(Boolean).join(', ')
  return `<figure class="film"><video controls playsinline preload="metadata"${mode}${dims}${poster} aria-label="${text(v.title)}" src="${url(v.to)}"></video><figcaption><span>${text(v.title)}</span><span class="facts">${esc(facts)}</span></figcaption></figure>`
}

function pictureTag(p) {
  const dims = p.w && p.h ? ` width="${p.w}" height="${p.h}"` : ''
  const caption = p.caption ? `<figcaption>${text(p.caption)}</figcaption>` : ''
  return `<figure><a href="${url(p.to)}"><img loading="lazy" decoding="async"${dims} alt="${text(p.alt || p.caption || 'Picture')}" src="${url(p.to)}"></a>${caption}</figure>`
}

function soundTag(s) {
  const facts = length(s.seconds)
  const line = s.line ? `<p class="cue-line">${text(s.line)}</p>` : ''
  const prompt = s.prompt ? `<p class="cue-prompt"><span>Prompt</span> ${text(s.prompt)}</p>` : ''
  return `<li class="cue"><div><p class="cue-name"><span>${text(s.name)}</span>${facts ? `<span class="facts">${esc(facts)}</span>` : ''}</p>${line}${prompt}</div><audio controls preload="metadata" aria-label="${text(s.name)}" src="${url(s.to)}"></audio></li>`
}

function page(d) {
  const title = `${plain(config.name ?? 'Showcase')} review`
  const meta = [`Built ${d.built}`, d.clock.phase != null ? `Phase ${d.clock.phase}` : null, ...d.clock.lines].filter(Boolean)
  const left = d.dropped.length ? `<p class="left">Left out to fit ${maxMb} MB: ${d.dropped.map((v) => `${text(v.title)} (${size(v.bytes)})`).join('; ')}.</p>` : ''
  const over = d.over ? `<p class="left">The site is still over ${maxMb} MB.</p>` : ''

  const latest = d.status.pictures.length
    ? [d.status.head ? `<p class="when">${text(d.status.head)}</p>` : '', ...d.status.lines.map((l) => `<p class="note">${text(l)}</p>`), ...d.status.pictures.map((p) => pictureTag(p))].join('\n')
    : NOTHING

  const links = [
    ['./index.html', 'The app'],
    ...seasons.map((s) => [`./index.html?season=${encodeURIComponent(s)}`, cap(words(s))]),
    ['./index.html?mode=probe', 'Probe'],
    ['./index.html?mode=autopilot', 'Film B, autopilot'],
    ['./index.html?mode=autopilot&which=a', 'Film A, autopilot'],
    ['./index.html?mode=loop', 'Loop'],
  ]
  const open = `${d.app ? '' : '<p class="none">The app is not built yet. These links work once it is.</p>\n'}<ul class="links">${links.map(([href, name]) => `<li><a href="${esc(href)}">${text(name)}</a></li>`).join('')}</ul>`

  const of = (part) => d.videos.filter((v) => v.part === part)
  const group = (name, cues) => (cues.length ? `${label(name)}\n<ul class="cues">${cues.map(soundTag).join('\n')}</ul>` : '')
  const music = d.cues.filter((c) => c.cls === 'music')
  const known = ['music', 'sfx', 'ambience', 'ui']
  const listen = [
    of('listen').length ? `${label('Review cuts')}\n${of('listen').map(videoTag).join('\n')}` : '',
    group('Mixes', d.mixes),
    ...seasons.map((s) => group(`Music, ${words(s)}`, music.filter((c) => c.season === s))),
    group('Music', music.filter((c) => !seasons.includes(c.season))),
    group('Shake and landing', d.cues.filter((c) => c.cls === 'sfx')),
    group('Ambience', d.cues.filter((c) => c.cls === 'ambience')),
    group('Interface', d.cues.filter((c) => c.cls === 'ui')),
    group('Other', d.cues.filter((c) => !known.includes(c.cls))),
  ].filter(Boolean)

  const card = [...of('card').map(videoTag), ...(d.still ? [pictureTag(d.still)] : [])]
  const parts = [
    ['latest', 'Latest', latest],
    ['open', 'Open it', open],
    ['listen', 'Listen', listen.join('\n') || NOTHING],
    ['films', 'Films', of('films').map(videoTag).join('\n') || NOTHING],
    ['card', 'The card', card.join('\n') || NOTHING],
    ['comparisons', 'Comparisons', d.compares.map((p) => pictureTag(p)).join('\n') || NOTHING],
    ['motion', 'Motion', d.sheets.map((p) => pictureTag(p)).join('\n') || NOTHING],
  ]

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>${esc(title)}</title>
<style>
:root{color-scheme:dark;--page:#0b0d10;--panel:#12151a;--line:#262a30;--text:#e6e3dc;--quiet:#a9a59b;--warm:#e0c39a}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--page);color:var(--text);font:400 17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1100px;margin:0 auto;padding:clamp(28px,5vw,64px) clamp(18px,4vw,40px) 96px}
h1{margin:0;font-size:clamp(28px,4.4vw,40px);font-weight:300;letter-spacing:.01em;line-height:1.15}
h2{margin:0 0 28px;font-size:clamp(22px,3vw,28px);font-weight:300;letter-spacing:.01em;line-height:1.2;color:var(--warm)}
p{margin:0}
.meta{margin-top:14px;color:var(--quiet);font-size:14px;line-height:1.7}
.meta span:not(:last-child)::after{content:"\\00b7";margin:0 .6em;color:#6d6a63}
.left{margin-top:8px;color:var(--warm);font-size:14px}
section{margin-top:clamp(56px,8vw,88px);padding-top:clamp(28px,4vw,40px);border-top:1px solid var(--line)}
.none,.note,.when{color:var(--quiet)}
.none{font-size:15px}
.when{font-size:15px;margin-bottom:10px}
.note{font-size:16px;max-width:70ch;margin-bottom:6px}
.note+figure,.when+figure{margin-top:22px}
.label{margin:44px 0 16px;color:var(--quiet);font-size:13px;letter-spacing:.09em;text-transform:uppercase}
h2+.label{margin-top:0}
figure{margin:0 0 36px}
figure:last-child{margin-bottom:0}
figure a{display:block;border-radius:6px}
img,video{display:block;width:100%;height:auto;border-radius:6px;background:var(--panel)}
video{max-height:86vh;max-height:86svh;object-fit:contain}
figcaption{margin-top:12px;color:var(--quiet);font-size:15px;line-height:1.5;overflow-wrap:anywhere}
.film figcaption{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 24px;color:var(--text);font-size:16px}
.facts{color:var(--quiet);font-variant-numeric:tabular-nums;white-space:nowrap}
.links{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.links a{display:flex;align-items:center;min-height:64px;padding:12px 20px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font-size:18px;text-decoration:none}
.links a:hover{border-color:var(--warm)}
.none+.links{margin-top:18px}
.cues{list-style:none;margin:0;padding:0}
.cue{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,420px);gap:12px 32px;align-items:center;padding:18px 0;border-top:1px solid var(--line)}
.cue:last-child{border-bottom:1px solid var(--line)}
.cue-name{display:flex;flex-wrap:wrap;gap:2px 16px;align-items:baseline;font-size:17px;overflow-wrap:anywhere}
.cue-name .facts{font-size:14px}
.cue-line{margin-top:4px;color:var(--text);font-size:15px;overflow-wrap:anywhere}
.cue-prompt{margin-top:6px;color:var(--quiet);font-size:14px;line-height:1.5;overflow-wrap:anywhere}
.cue-prompt span{font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-right:.4em}
audio{display:block;width:100%;height:44px}
a:focus-visible,video:focus-visible,audio:focus-visible{outline:2px solid var(--warm);outline-offset:3px}
@media (max-width:720px){body{font-size:16px}.cue{grid-template-columns:minmax(0,1fr)}.links{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.links a{padding:12px 16px;font-size:17px}}
</style>
</head>
<body>
<div class="wrap">
<header>
<h1>${esc(title)}</h1>
<p class="meta">${meta.map((m) => `<span>${text(m)}</span>`).join('')}</p>
${left}${over}
</header>
<main>
${parts.map(([id, name, body]) => `<section aria-labelledby="h-${id}">\n<h2 id="h-${id}">${name}</h2>\n${body}\n</section>`).join('\n')}
</main>
</div>
<script>
document.addEventListener('play',function(e){if(e.target.loop)return;document.querySelectorAll('audio,video').forEach(function(m){if(m!==e.target&&!m.loop)m.pause()})},true)
if(matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelectorAll('video[autoplay]').forEach(function(v){v.removeAttribute('autoplay');v.pause()})
</script>
</body>
</html>
`
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })

  const status = readStatus()
  for (const p of status.pictures) {
    p.to = put(p.src, `status/${path.basename(p.src)}`)
    if (!p.w || !p.h) Object.assign(p, probe(p.src), { seconds: undefined })
    p.alt = p.caption || `Status picture ${path.basename(p.src, path.extname(p.src))}`
  }

  const mixes = []
  for (const c of candidates) {
    const src = rel('audio', 'mix', `${c}.wav`)
    if (!exists(src)) continue
    mixes.push({ name: `Mix, ${words(c)}`, to: putSound(src, `mix-${c}`), seconds: probe(src).seconds })
  }

  const cues = readCues()
  for (const c of cues) {
    c.name = c.id
    c.to = putSound(c.src, `cue-${c.id}`)
    if (!Number.isFinite(c.seconds) || c.seconds <= 0) c.seconds = probe(c.src).seconds
  }

  const stillSrc = firstOf(files.cardStill)
  const still = stillSrc ? { to: put(stillSrc, files.cardStill), caption: 'Card still', ...probe(stillSrc) } : null

  const stillsDir = rel('out', 'stills')
  const pictures = walk(stillsDir, path.join(stillsDir, 'status')).filter((p) => IMAGE.test(p))
  const shown = (prefix) =>
    pictures
      .filter((p) => path.basename(p).startsWith(prefix))
      .map((src) => {
        const name = path.basename(src, path.extname(src))
        const record = tryJson(path.join(path.dirname(src), `${name}.json`))
        const caption = typeof record?.caption === 'string' && record.caption.trim() ? record.caption.trim() : name
        const dims = probe(src)
        return { to: put(src, `stills/${path.relative(stillsDir, src).split(path.sep).join('/')}`), caption, w: dims.w, h: dims.h }
      })
  const compares = shown('compare-')
  const sheets = shown('sheet-')

  const all = gather()
  const { kept, dropped } = fit(all, dirSize(DIST))
  for (const v of kept) placeVideo(v)

  if (!list(path.join(OUT, 'poster')).length) fs.rmSync(path.join(OUT, 'poster'), { recursive: true, force: true })

  const clock = readClock()
  const built = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  const data = { built, clock, status, mixes, cues, still, compares, sheets, videos: kept, dropped, app: exists(path.join(DIST, 'index.html')), over: false }
  const write = () => fs.writeFileSync(path.join(DIST, 'review.html'), page(data))
  write()
  while (dirSize(DIST) > maxMb * MB && data.videos.length) {
    const largest = data.videos.reduce((a, b) => (b.bytes > a.bytes ? b : a))
    data.videos = data.videos.filter((v) => v !== largest)
    removeVideo(largest)
    dropped.push(largest)
    write()
  }
  if (dirSize(DIST) > maxMb * MB) {
    data.over = true
    write()
  }

  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const names = (part) => data.videos.filter((v) => v.part === part).map((v) => path.basename(v.to))
  const say = (part, what) => console.log(`review: ${part}: ${what.length ? what.join(', ') : 'nothing yet'}`)
  say('latest', status.pictures.length ? [count(status.pictures.length, 'picture', 'pictures')] : [])
  say('listen', [...names('listen'), ...(mixes.length ? [count(mixes.length, 'mix', 'mixes')] : []), ...(cues.length ? [count(cues.length, 'cue', 'cues')] : [])])
  say('films', names('films'))
  say('the card', [...names('card'), ...(still ? [still.to] : [])])
  say('comparisons', compares.length ? [count(compares.length, 'picture', 'pictures')] : [])
  say('motion', sheets.length ? [count(sheets.length, 'picture', 'pictures')] : [])
  if (asWav.length) console.log(`review: ffmpeg could not make an .m4a of ${asWav.join(', ')}. Copied as .wav`)
  if (dropped.length) console.log(`review: left out to fit ${maxMb} MB: ${dropped.map((v) => `${path.relative(ROOT, v.src)} (${size(v.bytes)})`).join(', ')}`)
  if (data.over) console.log(`review: dist/ is still over ${maxMb} MB with every video left out`)
  console.log(`review: wrote dist/review.html. dist/ is ${size(dirSize(DIST))}, dist/review/ is ${size(dirSize(OUT))}`)
}

build()
