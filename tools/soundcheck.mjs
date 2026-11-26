import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { engineHash, fileSha, sha256 } from './lib/hashes.mjs'
import { cfg, AUDIO, encodeWav, ffmpegLoudness, mixFilm, readKept, readLedger } from './lib/audio.mjs'

const args = parseArgs(process.argv.slice(2))
const only = args.only && args.only !== true ? String(args.only).toUpperCase().split(',') : null
const wanted = (id) => !only || only.includes(id)
const show = (f) => path.relative(rel(), f).split(path.sep).join('/')
const WORK = rel('out', 'work', 'soundcheck')
const results = {}
const set = (id, state, detail, more = {}) => {
  results[id] = { state, detail, ...more }
}
const list = (items, n = 6) => (items.length > n ? `${items.slice(0, n).join(', ')} and ${items.length - n} more` : items.join(', '))
const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`

const INIT = `(() => {
  const seen = { contexts: 0, plays: 0, fetches: [], media: [], firstAt: null }
  const first = () => !!document.documentElement && document.documentElement.dataset.firstPicture === '1'
  window.__soundcheck = seen
  new MutationObserver(() => {
    if (seen.firstAt === null && first()) seen.firstAt = performance.now()
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-first-picture'] })
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const C = window[k]
    if (!C) continue
    window[k] = class extends C {
      constructor(...a) {
        super(...a)
        seen.contexts += 1
      }
    }
  }
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...a) {
    seen.plays += 1
    seen.media.push({ url: String(this.currentSrc || this.src), afterFirstPicture: first() })
    return play.apply(this, a)
  }
  const f = window.fetch
  window.fetch = function (input, ...rest) {
    const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input)
    seen.fetches.push({ url, afterFirstPicture: first() })
    return f.call(this, input, ...rest)
  }
})()`

const isSound = (url) => /\/audio\/[^?]+\.(mp3|m4a|ogg|wav|flac|aac|opus|webm)(\?|$)/i.test(url)

function chunks() {
  const dir = rel('dist', 'assets')
  if (!fs.existsSync(dir)) return { audio: [], entry: [] }
  const html = fs.existsSync(rel('dist', 'index.html')) ? fs.readFileSync(rel('dist', 'index.html'), 'utf8') : ''
  const js = fs.readdirSync(dir).filter((n) => n.endsWith('.js'))
  const audio = js.filter((n) => fs.readFileSync(path.join(dir, n), 'utf8').includes('decodeAudioData'))
  return { audio: audio.filter((n) => !html.includes(n)), entry: audio.filter((n) => html.includes(n)) }
}

function packed() {
  const dir = rel('dist', 'audio')
  if (!fs.existsSync(dir)) return null
  const files = fs
    .readdirSync(dir)
    .filter((n) => isSound(`/audio/${n}`))
    .map((n) => ({ file: n, bytes: fs.statSync(path.join(dir, n)).size }))
  return { files, bytes: files.reduce((s, f) => s + f.bytes, 0) }
}

async function pageChecks() {
  const ids = ['A1', 'A2', 'A3', 'A4'].filter(wanted)
  if (!ids.length) return
  let session = null
  let mod
  try {
    mod = await import('./lib/page.mjs')
    session = await mod.Session.open({ what: 'soundcheck' })
  } catch (e) {
    for (const id of ids) set(id, 'not run', String(e.message ?? e))
    return
  }
  try {
    if (wanted('A1') || wanted('A2') || wanted('A4')) await liveChecks(session)
    if (wanted('A3')) await stillCheck(session, mod)
  } catch (e) {
    for (const id of ids) if (!results[id]) set(id, 'not run', `the page check stopped: ${String(e.message ?? e)}`)
  } finally {
    await session.close().catch(() => undefined)
  }
}

async function liveChecks(session) {
  const hd = cfg.formats.hd
  const context = await session.browser.newContext({ viewport: { width: hd.width, height: hd.height }, deviceScaleFactor: 1 })
  await context.addInitScript(INIT)
  const page = await context.newPage()
  const requests = []
  page.on('request', (r) => {
    if (isSound(r.url())) requests.push({ url: r.url(), bytes: 0 })
  })
  page.on('response', async (r) => {
    const hit = requests.find((q) => q.url === r.url() && !q.bytes)
    if (!hit) return
    try {
      hit.bytes = (await r.body()).length
    } catch {
      hit.bytes = Number(r.headers()['content-length'] ?? 0)
    }
  })
  await page.goto(`${session.server.url}?mode=live`)
  // Asked every quarter second, not once a frame: the frame after the first picture loads the rest of the detail and
  // can take a minute where the picture is drawn in software, and a question tied to frames is answered only after it.
  const patience = cfg.live.loadWaitSeconds * 15000
  const asked = Date.now()
  let marked = false
  while (!marked && Date.now() - asked < patience) {
    marked = await page.evaluate(() => document.documentElement.dataset.firstPicture === '1').catch(() => false)
    if (!marked) await new Promise((r) => setTimeout(r, 250))
  }
  await page.waitForTimeout(1500)
  const state = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-control="sound"]')
      const label = (e) => {
        if (!e) return ''
        const by = (e.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
        return by || e.getAttribute('aria-label') || (e.textContent ?? '').trim() || e.getAttribute('title') || ''
      }
      const shown = (e) => {
        if (!e) return null
        for (const k of ['aria-pressed', 'aria-checked', 'data-state']) if (e.hasAttribute(k)) return `${k}=${e.getAttribute(k)}`
        return null
      }
      const s = window.__soundcheck
      return { audio: document.documentElement.dataset.audio ?? null, contexts: s.contexts, plays: s.plays, fetches: s.fetches, media: s.media, firstAt: s.firstAt, resources: performance.getEntriesByType('resource').map((e) => ({ url: e.name, at: e.startTime })), control: !!el, name: label(el), shown: shown(el), tag: el ? el.tagName.toLowerCase() : '', focusable: el ? el.tabIndex >= 0 : false }
    })
  const before = await state()

  if (wanted('A1')) {
    const bad = []
    if (before.contexts > 0) bad.push(`${before.contexts} audio context made`)
    if (before.plays > 0) bad.push(`${before.plays} media element played`)
    if (before.audio === 'started') bad.push('the page says audio has started')
    const note = before.audio === 'none' ? 'the page says none' : `the page marks data-audio as ${before.audio === null ? 'nothing yet, it should say none' : before.audio}`
    if (bad.length) set('A1', 'open', `before any interaction: ${bad.join(', ')}`, { before })
    else set('A1', 'pass', `before any interaction no audio context was made and nothing played, ${note}${marked ? '' : ', and the page never marked its first picture'}`, { audio: before.audio, firstPictureMarked: marked })
  }

  let after = before
  if (wanted('A2') || wanted('A4')) {
    if (!before.control) {
      if (wanted('A2')) set('A2', 'open', 'the page has no [data-control="sound"]')
    } else {
      const control = page.locator('[data-control="sound"]').first()
      const steps = []
      const bad = []
      try {
        const frameMs = await page.evaluate(() => new Promise((r) => requestAnimationFrame((t0) => requestAnimationFrame((t1) => r(t1 - t0)))))
        await control.click({ timeout: Math.max(5000, Math.ceil(6 * frameMs)) })
        await page.waitForTimeout(1200)
        const clicked = await state()
        steps.push(`pointer: ${before.shown} to ${clicked.shown}`)
        if (clicked.shown === before.shown) bad.push('a click does not change the state it shows')
        await control.focus()
        await page.keyboard.press('Enter')
        await page.waitForTimeout(600)
        const entered = await state()
        steps.push(`Enter: ${clicked.shown} to ${entered.shown}`)
        if (entered.shown === clicked.shown) bad.push('Enter does not change the state it shows')
        await page.keyboard.press('Space')
        await page.waitForTimeout(1200)
        after = await state()
        steps.push(`Space: ${entered.shown} to ${after.shown}`)
        if (after.shown === entered.shown) bad.push('Space does not change the state it shows')
        if (!before.name) bad.push('it has no name')
        if (before.shown === null) bad.push('it shows no state (aria-pressed, aria-checked or data-state)')
        if (!before.focusable) bad.push('it cannot take the keyboard focus')
        if (packed()?.files.length && after.audio !== 'started' && clicked.audio !== 'started') bad.push('turning it on did not start audio')
      } catch (e) {
        bad.push(`the control could not be used: ${String(e.message ?? e).split('\n')[0]}`)
      }
      if (wanted('A2')) set('A2', bad.length ? 'open' : 'pass', bad.length ? `${bad.join(', ')} · ${steps.join(', ')}` : `named "${before.name}", ${steps.join(', ')}`, { name: before.name, steps })
      await page.waitForTimeout(2500)
      after = await state()
    }
  }

  if (wanted('A4')) {
    const pack = packed()
    const limit = cfg.audio.appMaxMb * 1048576
    if (!pack || !pack.files.length) set('A4', 'not run', 'dist/audio/ holds no sound file. Run npm run sound -- --pack, then npm run build.')
    else {
      const early = [...after.resources.filter((r) => isSound(r.url) && (after.firstAt === null || r.at < after.firstAt)).map((r) => r.url), ...after.fetches.filter((f) => isSound(f.url) && !f.afterFirstPicture).map((f) => f.url), ...after.media.filter((m) => isSound(m.url) && !m.afterFirstPicture).map((m) => m.url)]
      const names = [...new Set(early.map((u) => u.split('/').pop()))]
      const got = requests.reduce((s, r) => s + r.bytes, 0)
      const bad = []
      if (pack.bytes > limit) bad.push(`the files are ${mb(pack.bytes)} together, over audio.appMaxMb of ${cfg.audio.appMaxMb} MB`)
      if (!marked) bad.push('the page never marked its first picture (data-first-picture), so the order cannot be shown')
      else if (names.length) bad.push(`fetched before the first picture was complete: ${list(names)}`)
      const fetched = `${new Set(requests.map((r) => r.url)).size} of ${pack.files.length} files fetched in this visit (${mb(got)})${before.control ? '' : ', sound could not be turned on without its control'}`
      set('A4', bad.length ? 'open' : 'pass', bad.length ? `${bad.join(', ')} · ${fetched}` : `${pack.files.length} files, ${mb(pack.bytes)} together, under ${cfg.audio.appMaxMb} MB, none asked for before the first picture · ${fetched}`, { files: pack.files, fetched: requests })
    }
  }
  await context.close()
}

async function stillCheck(session, mod) {
  const found = chunks()
  if (found.entry.length) return set('A3', 'open', `the audio code is inside the entry file ${found.entry[0]}, so capture loads it. It must be a dynamic import.`)
  if (!found.audio.length) return set('A3', 'not run', 'the built app holds no audio code yet (no file in dist/assets has it), so there is nothing to compare')
  const pic = cfg.keys[0] ?? cfg.stills[0]
  const spec = mod.stillSpec({ key: pic.id, tier: 'draft' })
  const run = async (name, withAudio) => {
    const page = await session.page({ format: spec.format, assets: spec.assets })
    let made = null
    if (withAudio) {
      made = await page.evaluate(
        async ({ url, seasons }) => {
          const m = await import(url)
          if (typeof m.createSoundEngine !== 'function') return { imported: true, engine: false }
          const engine = m.createSoundEngine({ index: { version: 1, bytes: 0, files: [], sprites: {}, loops: {} }, baseUrl: new URL('audio/', document.baseURI).href, afterFirstPicture: Promise.resolve(), seasons })
          engine.setSeason(seasons[0], true)
          return { imported: true, engine: true, available: engine.available() }
        },
        { url: `${session.server.url}assets/${found.audio[0]}`.replace(/([^:])\/\//g, '$1/'), seasons: cfg.seasons },
      )
    }
    const file = path.join(WORK, name)
    await mod.renderStill(session, spec, { file, force: true, page })
    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name))
    await page.context().close()
    return { file, sha: fileSha(file), loaded, made }
  }
  const plain = await run('still-without-audio.png', false)
  const withAudio = await run('still-with-audio.png', true)
  const leaked = plain.loaded.filter((u) => found.audio.some((n) => u.includes(n)) || isSound(u) || /\/audio\/index\.json/.test(u))
  const bad = []
  if (plain.sha !== withAudio.sha) bad.push(`the two stills differ (${plain.sha.slice(0, 12)} and ${withAudio.sha.slice(0, 12)})`)
  if (leaked.length) bad.push(`capture loaded audio by itself: ${list(leaked.map((u) => u.split('/').pop()))}`)
  set('A3', bad.length ? 'open' : 'pass', bad.length ? bad.join(', ') : `${pic.id} at draft is byte equal with the audio code loaded and without it (${plain.sha.slice(0, 12)}), and capture loads no audio by itself`, { still: pic.id, without: plain.sha, with: withAudio.sha, engine: withAudio.made })
}

function keptCheck() {
  const kept = readKept()
  if (!kept.length) return set('A5', 'not run', 'no sound is kept yet')
  const assets = fs.existsSync(rel('ASSETS.md')) ? fs.readFileSync(rel('ASSETS.md'), 'utf8') : ''
  const bad = []
  for (const { id, record: k } of kept) {
    const miss = []
    if (!Number.isInteger(k.take)) miss.push('take')
    if (!k.prompt) miss.push('prompt')
    if (!k.measured || !Number.isFinite(k.measured.lufs)) miss.push('measurements')
    if (!k.answers || (typeof k.answers === 'object' && !Object.keys(k.answers).length)) miss.push("the listener's answers")
    if (!assets.includes(`audio/kept/${id}.`)) miss.push('ASSETS.md row')
    if (miss.length) bad.push(`${id} (${miss.join(', ')})`)
  }
  set('A5', bad.length ? 'open' : 'pass', bad.length ? `${bad.length} of ${kept.length} kept sounds lack something: ${list(bad, 8)}` : `all ${kept.length} kept sounds have take, prompt, measurements, answers and a row`, { kept: kept.length, lacking: bad })
}

function mixFiles() {
  const out = []
  for (const dir of ['mix', 'final']) {
    const d = path.join(AUDIO, dir)
    if (!fs.existsSync(d)) continue
    for (const n of fs.readdirSync(d).sort()) {
      if (!n.endsWith('.wav') || !fs.existsSync(path.join(d, n.replace(/\.wav$/, '.json')))) continue
      out.push(path.join(d, n))
    }
  }
  return out
}

function levelCheck(files) {
  if (!files.length) return set('A6', 'not run', 'no mix exists yet')
  const bad = []
  const ok = []
  const rows = []
  for (const f of files) {
    const m = ffmpegLoudness(f)
    rows.push({ file: show(f), ...m })
    const miss = []
    if (!Number.isFinite(m.lufs)) miss.push('silent')
    else {
      if (Math.abs(m.lufs - cfg.audio.filmLoudnessLufs) > 1) miss.push(`${m.lufs} LUFS`)
      if (m.truePeakDb > cfg.audio.truePeakDb) miss.push(`peak ${m.truePeakDb} dB`)
    }
    if (miss.length) bad.push(`${path.basename(f)} (${miss.join(', ')})`)
    else ok.push(`${path.basename(f)} ${m.lufs} LUFS, peak ${m.truePeakDb} dB`)
  }
  set('A6', bad.length ? 'open' : 'pass', bad.length ? `wanted ${cfg.audio.filmLoudnessLufs} LUFS within 1 and a peak at or under ${cfg.audio.truePeakDb} dB: ${list(bad)}` : list(ok), { mixes: rows })
}

function twiceCheck(files) {
  if (!files.length) return set('A7', 'not run', 'no mix exists yet')
  const cutFile = rel('cut', 'CUTLIST.json')
  if (!fs.existsSync(cutFile)) return set('A7', 'not run', 'cut/CUTLIST.json does not exist')
  const cut = readJson(cutFile)
  const bad = []
  const stale = []
  const rows = []
  for (const f of files) {
    const rec = readJson(f.replace(/\.wav$/, '.json'))
    const music = rec.args?.music ? rel(rec.args.music) : null
    if (music && !fs.existsSync(music)) {
      stale.push(`${path.basename(f)} (its music file is gone)`)
      continue
    }
    const once = () => sha256(encodeWav(mixFilm({ cut, which: rec.which, candidate: rec.candidate, musicFile: music, skip: rec.args?.skip ?? [], gains: rec.args?.gains ?? {} }).audio))
    const a = once()
    const b = once()
    const disk = fileSha(f)
    rows.push({ file: show(f), first: a, second: b, onDisk: disk })
    if (a !== b) bad.push(path.basename(f))
    else if (a !== disk) stale.push(`${path.basename(f)} (the file is older than its inputs, mix it again)`)
  }
  if (bad.length) set('A7', 'open', `mixed twice and the bytes differ: ${list(bad)}`, { mixes: rows })
  else if (stale.length) set('A7', 'open', `two fresh mixes are byte equal, but: ${list(stale)}`, { mixes: rows })
  else set('A7', 'pass', `${rows.length} ${rows.length === 1 ? 'mix' : 'mixes'} made twice more, each byte equal to the file (${list(rows.map((r) => `${path.basename(r.file)} ${r.first.slice(0, 12)}`))})`, { mixes: rows })
}

function takesCheck() {
  const ledger = readLedger()
  if (!ledger.takes.length) return set('A8', 'not run', 'no take is filed yet')
  const counts = {}
  // A take is a call of the sound tool. A layer laid from takes costs nothing and is not one (decision 111).
  for (const t of ledger.takes) {
    if (t.layer) continue
    const k = `${t.cue} in ${t.round ?? 'build'}`
    counts[k] = (counts[k] ?? 0) + 1
  }
  const over = Object.entries(counts).filter(([, n]) => n > cfg.audio.maxTakesPerCue)
  const cues = new Set(ledger.takes.map((t) => t.cue)).size
  const most = Math.max(...Object.values(counts))
  set('A8', over.length ? 'open' : 'pass', over.length ? `over audio.maxTakesPerCue of ${cfg.audio.maxTakesPerCue}: ${list(over.map(([k, n]) => `${k} (${n})`))}` : `${ledger.takes.filter((t) => !t.layer).length} takes over ${cues} cues, at most ${most} for one cue in one round, limit ${cfg.audio.maxTakesPerCue}${ledger.takes.some((t) => t.layer) ? `; ${ledger.takes.filter((t) => t.layer).length} layers laid from them, not counted` : ''}`, { counts })
}

async function main() {
  const guard = (id, fn) => {
    if (!wanted(id)) return
    try {
      return fn()
    } catch (e) {
      set(id, 'not run', `the check stopped: ${String(e.message ?? e).split('\n')[0]}`)
    }
  }
  await pageChecks()
  guard('A5', keptCheck)
  const files = mixFiles().filter((f) => !/-music\.wav$/.test(f) && path.basename(f) !== 'music.wav')
  guard('A6', () => levelCheck(files))
  guard('A7', () => twiceCheck(files))
  guard('A8', takesCheck)
  const order = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'].filter(wanted)
  for (const id of order) {
    const r = results[id] ?? { state: 'not run', detail: 'nothing was reported' }
    console.log(`${id} ${r.state} · ${r.detail}`)
  }
  const tally = (s) => order.filter((id) => results[id]?.state === s).length
  console.log(`${tally('pass')} pass, ${tally('open')} open, ${tally('not run')} not run`)
  try {
    writeJson(path.join(WORK, 'result.json'), { engineHash: engineHash(), time: new Date().toISOString(), checks: results })
  } catch {}
}

main()
  .catch((e) => console.log(`soundcheck stopped: ${String(e.message ?? e)}`))
  .finally(() => {
    process.exitCode = 0
  })
