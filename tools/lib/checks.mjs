import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { rel, readJson, readSection } from './paths.mjs'
import { engineHash, hashList, listFiles } from './hashes.mjs'
import { compareFiles, diff, pixels } from './pixels.mjs'

const SOUND = /\.(wav|mp3|flac|ogg|m4a|aac)$/i
const POSE_TOLERANCE = 0.001
const COLOR_TOLERANCE = 2
const STILL_MIN_PSNR = 30
const short = (f) => path.relative(rel(), f).split(path.sep).join('/')
const list = (items, n = 6) => (items.length > n ? `${items.slice(0, n).join('; ')}; and ${items.length - n} more` : items.join('; '))
const mb = (bytes) => bytes / 1048576

export const shippedHash = () =>
  hashList(
    spawnSync('git', ['ls-files', '-z', 'public', 'index.html'], { cwd: rel(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .stdout.split('\0')
      .filter(Boolean)
      .map((f) => rel(f))
      .filter((f) => fs.existsSync(f)),
  )

export const uiState = () => {
  const ui = document.getElementById('ui')
  if (!ui) return { exists: false, empty: true, hidden: true }
  const cs = getComputedStyle(ui)
  const r = ui.getBoundingClientRect()
  return {
    exists: true,
    empty: ui.childElementCount === 0 && ui.textContent.trim() === '',
    hidden: ui.hidden || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || r.width === 0 || r.height === 0,
    children: ui.childElementCount,
  }
}

export const controlState = () => {
  const seen = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) return false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
    }
    return true
  }
  const one = (sel) => {
    const all = [...document.querySelectorAll(sel)]
    return { count: all.length, visible: all.filter(seen).length }
  }
  return {
    shake: one('[data-control="shake"]'),
    sound: one('[data-control="sound"]'),
    seasons: [...document.querySelectorAll('[data-control="season"][data-season]')].map((el) => ({ season: el.dataset.season, visible: seen(el) })),
  }
}

const drawJudged = (page, entry, tier, diag, season) =>
  page.evaluate(
    async ([e, t, view, fallback]) => {
      const sc = window.showcase
      await sc.setFormat(e.format)
      sc.setDiagnostic(view || 'none')
      try {
        if (e.kind === 'film') await sc.renderFilmFrame(e.frame, t)
        else if (e.kind === 'opening') await sc.renderOpeningFrame(e.frame)
        else if (e.kind === 'loop') await sc.renderLoopFrame(e.frame, t)
        else {
          const call = { season: e.season ?? fallback, state: e.state ?? 'rest', camera: e.camera ?? 'hero', tier: t }
          if (e.kind === 'change') call.change = { shot: e.shot, at: e.at }
          if (e.kind === 'live') call.live = e.level
          if (e.interface) call.interface = true
          await sc.renderStill(call)
        }
      } finally {
        sc.setDiagnostic('none')
      }
      return sc.info()
    },
    [entry, tier, diag, season],
  )

function unitRows(progress) {
  const out = {}
  for (const line of (readSection(progress, 'Units') ?? '').split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    const id = /^`([^`]+)`$/.exec(cells[0] ?? '')?.[1]
    if (!id) continue
    out[id] = { state: cells[1] ?? '', rounds: Number(cells[2]) || 0 }
  }
  return out
}

export function addChecks(checks, { cfg, phase, args, dir, run, tail, probe, gridFrames }) {
  const fps = cfg.film.fps
  const previewStep = fps / cfg.film.previewFps
  const fresh = args.fresh === true
  const cutFile = rel('cut', 'CUTLIST.json')
  const readCut = () => (fs.existsSync(cutFile) ? readJson(cutFile) : null)
  const previewFrames = (frames) => Math.ceil(frames / previewStep)
  const soundFiles = () => [...['kept', 'mix', 'final'].flatMap((d) => listFiles(rel('audio', d))), ...listFiles(rel('public', 'audio'))].filter((f) => SOUND.test(f))
  const open = async (what) => {
    const lib = await import('./page.mjs')
    return { lib, session: await lib.Session.open({ what }) }
  }

  checks.G5 = {
    from: 2,
    name: 'no interface pixel where none belongs',
    async run() {
      const { lib, session } = await open('gate G5')
      const out = path.join(dir, 'g5')
      const problems = []
      const pages = new Map()
      const pageFor = async (format) => {
        if (!pages.has(format)) pages.set(format, await session.page({ format }))
        return pages.get(format)
      }
      const tier = 'draft'
      const all = [...cfg.keys, ...cfg.stills]
      const plain = all.filter((p) => !p.interface)
      const screens = cfg.stills.filter((p) => p.interface)
      const seen = { stills: 0, film: [], loop: [], screens: [], reused: 0, least: Infinity, most: 0 }
      const lacking = new Map()
      const pair = async (name, entry, wantSeasons) => {
        const canvasFile = path.join(out, `${name}-canvas.png`)
        const stageFile = path.join(out, `${name}-stage.png`)
        const want = { seasons: wantSeasons, format: entry.format, tier, diagnostic: '' }
        const same = (f) => lib.recordMatches(f, want) && JSON.stringify(readJson(`${f}.json`).judged) === JSON.stringify(entry)
        if (!fresh && same(canvasFile) && same(stageFile)) {
          seen.reused++
          return readJson(`${stageFile}.json`).check
        }
        const page = await pageFor(entry.format)
        const info = await drawJudged(page, entry, tier, '', cfg.defaultSeason)
        const canvas = await session.grab(page)
        const stage = await session.grabStage(page)
        const d = diff(await pixels(canvas), await pixels(stage))
        const check = { sameSize: d.sameSize, identical: d.identical, differing: d.differing, ui: await page.evaluate(uiState), controls: entry.interface ? await page.evaluate(controlState) : null }
        lib.writeWithRecord(canvasFile, canvas, session.record(info, { judged: entry, grab: 'canvas' }))
        lib.writeWithRecord(stageFile, stage, session.record(info, { judged: entry, grab: 'stage', check }))
        return check
      }
      const clean = (label, c) => {
        if (!c.sameSize) problems.push(`${label}: the stage and the canvas differ in size`)
        else if (!c.identical) problems.push(`${label}: the stage differs from the canvas in ${c.differing} pixels`)
        if (!(c.ui.empty || c.ui.hidden)) problems.push(`${label}: #ui holds ${c.ui.children} elements and is shown`)
      }
      try {
        for (const p of plain) {
          const entry = { id: p.id, kind: 'still', format: p.format, season: p.season, state: p.state, camera: p.camera }
          clean(p.id, await pair(`still-${p.id}`, entry, [p.season]))
          seen.stills++
        }
        const probePage = await pageFor(cfg.formats.hd.id)
        const plan = await probePage.evaluate(() => {
          const sc = window.showcase
          const film = sc.film()
          return { film: { frameCount: film.frameCount, swaps: film.swaps, landings: film.landings }, loop: sc.loop().frameCount, loopPlan: sc.dev.loopPlan ? sc.dev.loopPlan() : null }
        })
        const onGrid = (i, step, count) => Math.max(0, Math.min(Math.floor((count - 1) / step) * step, Math.round(i / step) * step))
        const swap = plan.film.swaps[0]
        const filmFrames = [0, swap ? (swap.first + swap.last) / 2 : plan.film.frameCount / 3, plan.film.landings[0] ?? plan.film.frameCount / 2, plan.film.frameCount - 1].map((i) => onGrid(i, previewStep, plan.film.frameCount))
        for (const frame of [...new Set(filmFrames)]) {
          clean(`film B frame ${frame}`, await pair(`film-${frame}`, { id: `film-${frame}`, kind: 'film', format: cfg.formats.hd.id, frame }, cfg.seasons))
          seen.film.push(frame)
        }
        const loopStep = fps / cfg.deliver.cardLoop.fps
        const strokes = plan.loopPlan ? (plan.loopPlan.shake.liftEnd + plan.loopPlan.shake.strokesEnd) / 2 : plan.loop / 3
        const loopFrames = [0, strokes, plan.loop - 1].map((i) => onGrid(i, loopStep, plan.loop))
        for (const frame of [...new Set(loopFrames)]) {
          clean(`loop frame ${frame}`, await pair(`loop-${frame}`, { id: `loop-${frame}`, kind: 'loop', format: cfg.deliver.cardLoop.format, frame }, cfg.seasons))
          seen.loop.push(frame)
        }
        for (const p of screens) {
          const entry = { id: p.id, kind: 'still', format: p.format, season: p.season, state: p.state, camera: p.camera, interface: true }
          const c = await pair(`screen-${p.id}`, entry, [p.season])
          const k = c.controls
          const missing = []
          if (k.shake.visible < 1) missing.push(k.shake.count ? 'the Shake control is not visible' : 'no [data-control="shake"]')
          const marks = cfg.seasons.filter((s) => k.seasons.some((m) => m.season === s && m.visible))
          if (marks.length < cfg.seasons.length) missing.push(`${marks.length} of ${cfg.seasons.length} season marks are present and visible`)
          if (k.sound.visible < 1) missing.push(k.sound.count ? `the sound control is not visible${fs.existsSync(rel('public', 'audio', 'index.json')) ? '' : ' (public/audio/index.json does not exist, and the app hides the control when it has no sound files)'}` : 'no [data-control="sound"]')
          if (c.identical) missing.push('the stage grab is the same as the canvas grab, so no control was drawn')
          if (missing.length) {
            const why = missing.join(', ')
            lacking.set(why, [...(lacking.get(why) ?? []), p.id])
          } else {
            seen.screens.push(p.id)
            seen.least = Math.min(seen.least, c.differing)
            seen.most = Math.max(seen.most, c.differing)
          }
        }
      } finally {
        await session.close()
      }
      const dirty = problems.length
      for (const [why, ids] of lacking) problems.push(`${ids.length} of ${screens.length} screen stills (${ids.join(', ')}): ${why}`)
      const measured = `${seen.stills} stills without interface, film B frames ${seen.film.join(', ')} and loop frames ${seen.loop.join(', ')}`
      const reused = seen.reused ? `; ${seen.reused} pictures reused from records of this build` : ''
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? `${dirty ? '' : `in ${measured} the stage is pixel-identical to the canvas and #ui is empty or hidden; `}${list(problems)}${reused}`
          : `in ${measured} the stage is pixel-identical to the canvas and #ui is empty or hidden; ${seen.screens.length} screen stills (${seen.screens.join(', ')}) show the Shake control, ${cfg.seasons.length} season marks and the sound control, and their stage differs from the canvas in ${seen.least} to ${seen.most} pixels${reused}`,
      }
    },
  }

  checks.G6 = {
    from: 2,
    name: 'startup validation and the judged list',
    async run() {
      const { session } = await open('gate G6')
      let judged
      try {
        let page
        try {
          page = await session.page({ format: cfg.formats.hd.id })
        } catch (e) {
          return { pass: false, detail: `the page does not start in capture mode: ${e.message.split('\n')[0]}` }
        }
        if (page.errors.some((l) => l.startsWith('pageerror'))) return { pass: false, detail: `the page starts with an error: ${page.errors.find((l) => l.startsWith('pageerror'))}` }
        judged = await page.evaluate(() => window.showcase.dev.judged())
      } finally {
        await session.close()
      }
      const section = readSection(fs.readFileSync(rel('kit', 'PROGRESS.md'), 'utf8'), 'Judged list')
      if (section === null) return { pass: false, detail: `the page starts and computes ${judged.length} judged entries, but kit/PROGRESS.md has no "Judged list" section` }
      const spans = new Set([...section.matchAll(/`([^`]+)`/g)].map((m) => m[1]))
      const rows = new Map()
      for (const line of section.split('\n')) {
        if (!line.startsWith('|')) continue
        const cells = line.split('|').slice(1, -1).map((c) => c.trim())
        const id = /^`([^`]+)`$/.exec(cells[0] ?? '')?.[1]
        if (id) rows.set(id, (cells[1] ?? '').replaceAll('`', ''))
      }
      const missing = judged.filter((e) => !spans.has(e.id)).map((e) => e.id)
      const wrongUnit = judged.filter((e) => rows.has(e.id) && rows.get(e.id) !== e.unit).map((e) => `${e.id} is listed under ${rows.get(e.id) || 'no unit'}, the page computes ${e.unit}`)
      const problems = []
      if (missing.length) problems.push(`${missing.length} of ${judged.length} computed judged ids are not in the Judged list of kit/PROGRESS.md${rows.size ? '' : ', which has no table rows'}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' and more' : ''}`)
      problems.push(...wrongUnit)
      return { pass: problems.length === 0, detail: problems.length ? `the page starts, so the config passes startup validation; ${list(problems, 4)}` : `the page starts in capture mode with no error, so the config passes startup validation; all ${judged.length} ids of dev.judged() are in the Judged list of kit/PROGRESS.md (${rows.size} rows), each under its unit` }
    },
  }

  checks.G7 = {
    from: 2,
    name: 'lengths',
    async run() {
      const { session } = await open('gate G7')
      let n
      try {
        const page = await session.page({ format: cfg.formats.preview.id })
        n = await page.evaluate(() => ({ film: window.showcase.film().frameCount, opening: window.showcase.opening().frameCount }))
      } finally {
        await session.close()
      }
      const problems = []
      const b = n.film / fps
      const o = n.opening / fps
      const a = o + b
      const mapFile = rel('cut', 'AUDIO-MAP.json')
      const music = fs.existsSync(mapFile) ? Number(readJson(mapFile).seconds) : null
      if (b > cfg.film.maxSeconds) problems.push(`film B is ${b.toFixed(2)} s, over film.maxSeconds ${cfg.film.maxSeconds}`)
      let floor = `at least film.minSeconds ${cfg.film.minSeconds}`
      if (b < cfg.film.minSeconds) {
        if (music !== null && music < cfg.film.minSeconds) floor = `under film.minSeconds ${cfg.film.minSeconds} because the approved music is ${music.toFixed(2)} s`
        else problems.push(`film B is ${b.toFixed(2)} s, under film.minSeconds ${cfg.film.minSeconds}, and ${music === null ? 'cut/AUDIO-MAP.json does not exist' : `the approved music is ${music.toFixed(2)} s`}`)
      }
      if (n.opening === 0) problems.push('opening().frameCount is 0: the opening is not built, so its length and the length of film A cannot be measured')
      else if (o > cfg.intro.maxSeconds) problems.push(`the opening is ${o.toFixed(2)} s, over intro.maxSeconds ${cfg.intro.maxSeconds}`)
      if (a > cfg.platform.standardAccountMaxSeconds) problems.push(`film A is ${a.toFixed(2)} s, over platform.standardAccountMaxSeconds ${cfg.platform.standardAccountMaxSeconds}`)
      const bits = cfg.export.bitrateMbps * 1e6 + cfg.export.audioKbps * 1e3
      const size = (bits * a) / 8 / 1e6
      if (!(size < cfg.platform.maxFileMb)) problems.push(`film A in ${cfg.formats.hd.id} at ${cfg.export.bitrateMbps} Mbit/s with ${cfg.export.audioKbps} kbit/s of sound would be ${size.toFixed(0)} MB, not under platform.maxFileMb ${cfg.platform.maxFileMb}`)
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? list(problems)
          : `film B is ${n.film} frames, ${b.toFixed(2)} s: at most film.maxSeconds ${cfg.film.maxSeconds} and ${floor}; the opening is ${n.opening} frames, ${o.toFixed(2)} s of at most ${cfg.intro.maxSeconds}; film A is ${a.toFixed(2)} s of at most ${cfg.platform.standardAccountMaxSeconds}; at ${cfg.export.bitrateMbps} Mbit/s of picture and ${cfg.export.audioKbps} kbit/s of sound film A is ${size.toFixed(0)} MB (${((bits * b) / 8 / 1e6).toFixed(0)} MB for film B), under platform.maxFileMb ${cfg.platform.maxFileMb}`,
      }
    },
  }

  checks.G11 = {
    from: 2,
    name: 'the change stays in its window',
    async run() {
      const { session } = await open('gate G11')
      let r
      try {
        const page = await session.page({ format: cfg.formats.preview.id })
        r = await page.evaluate(() => {
          const sc = window.showcase
          const d = sc.dev
          const missing = ['testShake', 'testShakeState', 'loopState'].filter((k) => typeof d[k] !== 'function')
          if (missing.length) return { missing }
          const scan = (count, state, windows) => {
            const out = { frames: count, parts: 0, outside: 0, moving: 0, bad: [] }
            for (let i = 0; i < count; i++) {
              const change = state(i).change
              const names = Object.keys(change)
              out.parts = Math.max(out.parts, names.length)
              const inside = windows.some((w) => i >= w.first && i <= w.last)
              const part = names.find((k) => change[k] !== 0 && change[k] !== 1)
              if (inside) {
                if (part) out.moving++
                continue
              }
              out.outside++
              if (part && out.bad.length < 4) out.bad.push(`frame ${i}: ${part} is at ${change[part]}`)
            }
            return out
          }
          const film = sc.film()
          const test = d.testShake()
          const loopCount = sc.loop().frameCount
          const first = JSON.stringify(d.loopState(0).change)
          const loop = { frames: loopCount, parts: Object.keys(d.loopState(0).change).length, bad: [] }
          for (let i = 1; i <= loopCount; i++) {
            const now = JSON.stringify(d.loopState(i).change)
            if (now !== first && loop.bad.length < 4) loop.bad.push(`frame ${i}: ${now} against ${first} on frame 0`)
          }
          return { film: scan(film.frameCount, (i) => sc.filmState(i), film.swaps), swaps: film.swaps, test: scan(test.frameCount, (i) => d.testShakeState(i), [test.swap]), testSwap: test.swap, loop }
        })
      } finally {
        await session.close()
      }
      if (r.missing) return { pass: false, detail: `the page has no dev.${r.missing.join(', dev.')}` }
      const problems = []
      if (!r.film.parts) problems.push('filmState(i).change names no seasonal part')
      if (!r.swaps.length) problems.push('film().swaps is empty')
      for (const b of r.film.bad) problems.push(`film, outside the swap windows, ${b}`)
      for (const b of r.test.bad) problems.push(`test shake, outside its swap window, ${b}`)
      for (const b of r.loop.bad) problems.push(`loop, ${b}`)
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? list(problems)
          : `film: ${r.film.parts} seasonal parts read on all ${r.film.frames} frames, every value 0 or 1 on the ${r.film.outside} frames outside the ${r.swaps.length} swap windows (${r.swaps.map((s) => `${s.first} to ${s.last}`).join(', ')}), a part mid change on ${r.film.moving} frames inside them; test shake: the same on ${r.test.outside} of ${r.test.frames} frames outside ${r.testSwap.first} to ${r.testSwap.last}; loop: no value changes across ${r.loop.frames} frames and the frame one past the last`,
      }
    },
  }

  checks.G12 = {
    from: 2,
    name: 'landings',
    async run() {
      const cut = readCut()
      if (!cut) return { pass: false, detail: 'cut/CUTLIST.json does not exist, so the shakes with their liftEnd frames and the bar lines of the cut list cannot be read. Run npm run cut' }
      if (!Array.isArray(cut.shakes) || !cut.shakes.length) return { pass: false, detail: 'cut/CUTLIST.json holds no shakes' }
      const { session } = await open('gate G12')
      let r
      try {
        const page = await session.page({ format: cfg.formats.preview.id })
        r = await page.evaluate((shakes) => {
          const sc = window.showcase
          const hero = sc.dev.pose('hero')
          const film = sc.film()
          return {
            landings: film.landings,
            barLines: film.barLines,
            swaps: film.swaps.length,
            shakes: shakes.map((s) => {
              let lowest = Infinity
              let frames = 0
              const grounded = []
              for (let i = s.liftEnd; i < s.landing; i++) {
                const h = sc.filmState(i).globe.heightMm
                frames++
                if (h < lowest) lowest = h
                if (!(h > 0) && grounded.length < 3) grounded.push(i)
              }
              const cam = sc.filmState(s.first).camera
              return { frames, lowest, grounded, landingHeight: sc.filmState(s.landing).globe.heightMm, off: Math.max(...hero.map((v, k) => Math.abs(v - cam[k]))), sameLength: cam.length === hero.length }
            }),
          }
        }, cut.shakes)
      } finally {
        await session.close()
      }
      const problems = []
      if (r.swaps !== cut.shakes.length) problems.push(`the cut list holds ${cut.shakes.length} shakes, film() holds ${r.swaps}`)
      let frames = 0
      let lowest = Infinity
      let off = 0
      cut.shakes.forEach((s, k) => {
        const m = r.shakes[k]
        const name = s.shot ?? s.id ?? `shake ${k + 1}`
        frames += m.frames
        lowest = Math.min(lowest, m.lowest)
        off = Math.max(off, m.off)
        if (m.grounded.length) problems.push(`${name}: globe.heightMm is not above zero on frame ${m.grounded.join(', ')}, between liftEnd ${s.liftEnd} and the frame before the landing ${s.landing}`)
        if (!cut.barLines.includes(s.landing)) problems.push(`${name}: the landing frame ${s.landing} is not a bar line of the cut list`)
        if (!r.landings.includes(s.landing)) problems.push(`${name}: the cut list lands on ${s.landing}, film().landings holds ${r.landings.join(', ')}`)
        if (!m.sameLength || !(m.off <= POSE_TOLERANCE)) problems.push(`${name}: the camera on its first frame ${s.first} is ${m.off.toFixed(4)} from dev.pose('hero'), over ${POSE_TOLERANCE}`)
      })
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? list(problems)
          : `${cut.shakes.length} shakes of the cut list: globe.heightMm is above zero on all ${frames} frames from each liftEnd to the frame before each landing (the lowest is ${lowest.toFixed(2)} mm); every landing frame (${cut.shakes.map((s) => s.landing).join(', ')}) is one of the ${cut.barLines.length} bar lines of the cut list and of film().landings; the camera on each first frame (${cut.shakes.map((s) => s.first).join(', ')}) equals dev.pose('hero') within ${POSE_TOLERANCE} mm and degrees (the largest difference is ${off.toExponential(1)})`,
      }
    },
  }

  checks.G13 = {
    from: 3,
    name: 'stand-ins',
    async run() {
      const registerFile = rel('parts', 'PARTS.json')
      if (!fs.existsSync(registerFile)) return { pass: false, detail: 'parts/PARTS.json does not exist. Run npm run parts' }
      const register = readJson(registerFile).parts
      const { filesHash } = await import('../parts.mjs')
      const unit = args.unit && args.unit !== true ? String(args.unit) : ''
      const ids = cfg.units.map((u) => u.id)
      if (unit && !ids.includes(unit)) return { pass: false, detail: `no such unit: ${unit}` }
      const rows = unitRows(fs.readFileSync(rel('kit', 'PROGRESS.md'), 'utf8'))
      const begun = (id) => unit === id || (rows[id] && (rows[id].rounds > 0 || rows[id].state.startsWith('finished')))
      const last = Math.max(...cfg.units.map((u) => u.phase))
      const filmUnits = cfg.units.filter((u) => u.phase === last).map((u) => u.id)
      const wholeUnits = cfg.units.filter((u) => u.phase === last - 1).map((u) => u.id)
      const covered = new Set()
      const why = []
      if (unit) {
        covered.add(unit)
        why.push(`the unit of this round, ${unit}`)
      }
      const finished = ids.filter((id) => rows[id]?.state.startsWith('finished'))
      for (const id of finished) covered.add(id)
      if (finished.length) why.push(`the units marked finished in kit/PROGRESS.md (${finished.join(', ')})`)
      if (phase > last - 1 || (phase === last - 1 && wholeUnits.some(begun))) {
        for (const id of ids) if (!filmUnits.includes(id)) covered.add(id)
        why.push(`every part outside ${filmUnits.join(', ')}, from the first round on ${wholeUnits.join(', ')}`)
      }
      if (phase >= last && filmUnits.some(begun)) {
        for (const id of ids) covered.add(id)
        why.push(`every part there is, from the first round on ${filmUnits.join(', ')}`)
      }
      const parts = register.filter((p) => covered.has(p.unit))
      if (!parts.length) return { pass: true, detail: `it covers no part yet: no unit is marked finished in kit/PROGRESS.md and no --unit was given, so none of the ${register.length} parts of the register is tested` }
      const problems = []
      const labelled = parts.filter((p) => p.state === 'stand-in')
      if (labelled.length) problems.push(`${labelled.length} of ${parts.length} covered parts are stand-in in the register: ${labelled.slice(0, 6).map((p) => p.name).join(', ')}${labelled.length > 6 ? ' and more' : ''}`)
      const unchanged = parts.filter((p) => filesHash(p.files) === p.standInHash)
      if (unchanged.length) problems.push(`the files of ${unchanged.length} covered parts still have the hash recorded when they were stand-ins: ${unchanged.slice(0, 6).map((p) => p.name).join(', ')}${unchanged.length > 6 ? ' and more' : ''}`)
      const { lib, session } = await open('gate G13')
      const out = path.join(dir, 'g13')
      const names = new Set(parts.map((p) => p.name))
      const flaggedPixels = new Map()
      let drawn = 0
      let reused = 0
      let skipped = 0
      let judged = []
      try {
        const page = await session.page({ format: cfg.formats.hd.id })
        const facts = await page.evaluate(() => {
          const d = window.showcase.dev
          return { judged: d.judged(), parts: d.parts(), flagged: typeof d.flagged === 'function' ? d.flagged() : null }
        })
        judged = facts.judged
        if (facts.flagged === null) problems.push('the page has no dev.flagged(), so it cannot report flagged code paths')
        else {
          const paths = facts.flagged.filter((n) => names.has(n))
          if (paths.length) problems.push(`the page reports a flagged code path for ${paths.length} covered parts: ${paths.slice(0, 6).join(', ')}${paths.length > 6 ? ' and more' : ''}`)
        }
        const colors = facts.parts.filter((p) => names.has(p.name)).map((p) => ({ name: p.name, r: (p.color >> 16) & 255, g: (p.color >> 8) & 255, b: p.color & 255 }))
        const order = { film: 1, opening: 2, loop: 3 }
        const sorted = [...judged].sort((a, b) => (order[a.kind] ?? 0) - (order[b.kind] ?? 0) || (a.frame ?? 0) - (b.frame ?? 0))
        for (const e of sorted) {
          const file = path.join(out, `${e.id}.png`)
          const same = lib.recordMatches(file, { seasons: cfg.seasons, format: e.format, diagnostic: 'standins' }) && JSON.stringify(readJson(`${file}.json`).judged) === JSON.stringify(e)
          if (fresh || !same) {
            try {
              const info = await drawJudged(page, e, 'draft', 'standins', cfg.defaultSeason)
              lib.writeWithRecord(file, await session.grab(page), session.record(info, { diag: 'standins', judged: e }))
            } catch (err) {
              const needed = covered.has(e.unit)
              if (needed) problems.push(`${e.id} cannot be drawn in the standins view: ${err.message.split('\n')[0].slice(0, 160)}`)
              else skipped++
              continue
            }
          } else reused++
          drawn++
          const p = await pixels(file)
          const count = new Array(colors.length).fill(0)
          for (let i = 0; i < p.width * p.height; i++) {
            const o = i * 4
            if (p.data[o] === 0 && p.data[o + 1] === 0 && p.data[o + 2] === 0) continue
            for (let c = 0; c < colors.length; c++) {
              const k = colors[c]
              if (Math.abs(p.data[o] - k.r) <= COLOR_TOLERANCE && Math.abs(p.data[o + 1] - k.g) <= COLOR_TOLERANCE && Math.abs(p.data[o + 2] - k.b) <= COLOR_TOLERANCE) {
                count[c]++
                break
              }
            }
          }
          colors.forEach((k, c) => {
            if (!count[c]) return
            const f = flaggedPixels.get(k.name) ?? { pictures: 0, pixels: 0, worst: '', most: 0 }
            f.pictures++
            f.pixels += count[c]
            if (count[c] > f.most) {
              f.most = count[c]
              f.worst = e.id
            }
            flaggedPixels.set(k.name, f)
          })
        }
      } finally {
        await session.close()
      }
      if (flaggedPixels.size) problems.push(`the standins view shows flagged pixels for ${flaggedPixels.size} covered parts: ${[...flaggedPixels].slice(0, 6).map(([n, f]) => `${n} in ${f.pictures} pictures (${f.most} pixels in ${f.worst})`).join(', ')}${flaggedPixels.size > 6 ? ' and more' : ''}`)
      const scope = `covers ${parts.length} of ${register.length} parts: ${why.join('; ')}`
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? `${scope}. ${list(problems)}`
          : `${scope}. None is stand-in in the register, the files of each differ from its stand-in hash, the standins view of ${drawn} of ${judged.length} judged stills and frames shows no pixel within ${COLOR_TOLERANCE} of a covered part's colour${skipped ? ` (${skipped} that cannot be drawn yet belong to units not covered)` : ''}, and dev.flagged() names none of them${reused ? `; ${reused} views reused from records of this build` : ''}`,
      }
    },
  }

  checks.G14 = {
    from: 2,
    name: "the loop's seam",
    async run() {
      const { lib, session } = await open('gate G14')
      const format = cfg.deliver.cardLoop.format
      const tier = 'draft'
      let n
      const file = (i) => path.join(dir, `g14-loop-${i}.png`)
      try {
        const page = await session.page({ format })
        n = await page.evaluate(() => window.showcase.loop().frameCount)
        for (const i of [0, n]) {
          const info = await page.evaluate(
            async ([index, t]) => {
              await window.showcase.renderLoopFrame(index, t)
              return window.showcase.info()
            },
            [i, tier],
          )
          lib.writeWithRecord(file(i), await session.grab(page), session.record(info, { call: 'renderLoopFrame', index: i }))
        }
      } finally {
        await session.close()
      }
      const d = await compareFiles(file(0), file(n))
      return { pass: d.identical, detail: d.identical ? `renderLoopFrame(${n}), one past the last, is pixel-identical to frame 0 (${format}, ${tier})` : `renderLoopFrame(${n}) differs from frame 0 in ${d.differing} pixels, the largest difference ${d.maxDiff} of 255 (${format}, ${tier})` }
    },
  }

  checks.G15 = {
    from: 3,
    name: 'memory and counts',
    async run() {
      const { session } = await open('gate G15')
      const problems = []
      const texture = {}
      const counts = {}
      const largest = Object.values(cfg.formats).reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
      try {
        for (const [set, limit] of Object.entries(cfg.assetSets)) {
          const page = await session.page({ format: largest.id, assets: set })
          texture[set] = { most: 0, season: '' }
          for (const season of cfg.seasons) {
            const info = await page.evaluate(async (s) => {
              await window.showcase.renderStill({ season: s, state: 'rest', camera: 'hero', tier: 'draft' })
              return window.showcase.info()
            }, season)
            if (info.assets !== set) problems.push(`asked for the ${set} asset set, info().assets is ${info.assets}`)
            if (info.textureMb > texture[set].most) texture[set] = { most: info.textureMb, season }
            if (!(info.textureMb <= limit.maxTextureMb)) problems.push(`${season} with the ${set} set: info().textureMb is ${info.textureMb}, over assetSets.${set}.maxTextureMb ${limit.maxTextureMb}`)
          }
          await page.context().close()
        }
        const page = await session.page({ format: cfg.formats.hd.id, assets: 'web' })
        for (const level of Object.keys(cfg.live.quality)) {
          counts[level] = { triangles: 0, drawCalls: 0, particles: 0 }
          for (const season of cfg.seasons) {
            let info
            try {
              info = await page.evaluate(
                async ([s, l]) => {
                  await window.showcase.renderStill({ season: s, state: 'rest', camera: 'hero', tier: 'draft', live: l })
                  return window.showcase.info()
                },
                [season, level],
              )
            } catch (e) {
              problems.push(`${season} at the ${level} level cannot be drawn through the app's path: ${e.message.split('\n')[0].slice(0, 160)}`)
              continue
            }
            const c = info.counts
            for (const k of Object.keys(counts[level])) counts[level][k] = Math.max(counts[level][k], c[k])
            if (!(c.triangles <= cfg.perf.maxTriangles[level])) problems.push(`${season} at ${level}: ${c.triangles} triangles, over perf.maxTriangles.${level} ${cfg.perf.maxTriangles[level]}`)
            if (!(c.drawCalls <= cfg.perf.maxDrawCalls)) problems.push(`${season} at ${level}: ${c.drawCalls} draw calls, over perf.maxDrawCalls ${cfg.perf.maxDrawCalls}`)
          }
        }
      } finally {
        await session.close()
      }
      const levels = Object.keys(counts)
      const sameCounts = levels.length > 1 && levels.every((l) => JSON.stringify(counts[l]) === JSON.stringify(counts[levels[0]]))
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? list(problems)
          : `info().textureMb in ${largest.id}, the largest format, after all ${cfg.seasons.length} seasons were drawn on one page: ${Object.entries(texture).map(([set, t]) => `${set} ${t.most} of ${cfg.assetSets[set].maxTextureMb} MB (most in ${t.season})`).join(', ')}; the most info().counts gives in any season through the app's path in ${cfg.formats.hd.id}: ${levels.map((l) => `${l} ${counts[l].triangles} of ${cfg.perf.maxTriangles[l]} triangles and ${counts[l].drawCalls} of ${cfg.perf.maxDrawCalls} draw calls with ${counts[l].particles} particles`).join(', ')}${sameCounts ? '; the levels do not differ yet' : ''}`,
      }
    },
  }

  checks.G16 = {
    from: 5,
    name: 'hosting',
    async run() {
      const file = rel('out', 'work', 'hostcheck', 'result.json')
      if (!fs.existsSync(file)) return { pass: false, detail: 'out/work/hostcheck/result.json does not exist. Run npm run hostcheck' }
      const r = readJson(file)
      const h = cfg.host
      const problems = []
      if (r.engineHash !== engineHash()) problems.push(`the result is from build ${r.engineHash}, the current build is ${engineHash()}. Run npm run hostcheck again`)
      else if (r.shippedHash !== shippedHash()) problems.push('the tracked files under public/ or index.html have changed since the result was written. Run npm run hostcheck again')
      if (!r.build?.ok) problems.push(`the clean build failed: ${r.build?.error ?? 'no build result'}`)
      else {
        if (!(r.dist.mb <= h.maxShippedMb)) problems.push(`dist/ is ${r.dist.mb.toFixed(2)} MB, over host.maxShippedMb ${h.maxShippedMb}`)
        if (!(r.dist.largest.mb <= h.maxFileMb)) problems.push(`${r.dist.largest.file} is ${r.dist.largest.mb.toFixed(2)} MB, over host.maxFileMb ${h.maxFileMb}`)
        if (!(r.build.minutes <= h.maxBuildMinutes)) problems.push(`the clean build took ${r.build.minutes.toFixed(1)} minutes, over host.maxBuildMinutes ${h.maxBuildMinutes}`)
        if (!r.live?.opened) problems.push(`the built site does not open in live mode: ${r.live?.error ?? 'no page result'}`)
        else if (!r.live.firstPicture) problems.push(`the built site opened in live mode but never set dataset.firstPicture within ${r.live.waitSeconds} s, so what loads before the first complete picture cannot be measured (${r.firstLoad.mb.toFixed(2)} MB fetched by then)`)
        else if (!(r.firstLoad.mb <= h.firstLoadMaxMb)) problems.push(`${r.firstLoad.mb.toFixed(2)} MB are fetched before the first complete picture, over host.firstLoadMaxMb ${h.firstLoadMaxMb}`)
        if (r.live?.errors?.length) problems.push(`the live page logged: ${r.live.errors[0]}`)
        if (r.dist.never?.length) problems.push(`dist/ holds ${r.dist.never.join(', ')}, which the Hosting section says is never copied into it`)
      }
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? list(problems)
          : `npm run hostcheck on this build: dist/ is ${r.dist.mb.toFixed(2)} of ${h.maxShippedMb} MB in ${r.dist.files} files, the largest ${r.dist.largest.mb.toFixed(2)} of ${h.maxFileMb} MB (${r.dist.largest.file}); ${r.firstLoad.mb.toFixed(2)} of ${h.firstLoadMaxMb} MB in ${r.firstLoad.requests} requests before the first complete picture of ${cfg.defaultSeason}; the clean install and build took ${r.build.minutes.toFixed(1)} of ${h.maxBuildMinutes} minutes; the built site opens in live mode and reaches its first picture in ${r.live.seconds.toFixed(1)} s`,
      }
    },
  }

  const filmFrames = () => {
    const cut = readCut()
    return cut ? { film: previewFrames(cut.frameCount), opening: previewFrames(cut.opening?.frameCount ?? 0), from: 'the cut list' } : { film: gridFrames(cfg.film.previewFps), opening: 0, from: 'the default grid, because cut/CUTLIST.json does not exist' }
  }
  const shape = (p, frames) => {
    const want = { width: cfg.formats.preview.width, height: cfg.formats.preview.height, fps: cfg.film.previewFps, frames }
    return Object.keys(want).filter((k) => p[k] !== want[k]).map((k) => `${k} is ${p[k]}, not ${want[k]}`)
  }

  checks.D2 = {
    at: [2, 6],
    name: 'the preview of film B',
    async run() {
      const name = `out/${cfg.export.files.previewB}`
      const file = rel('out', cfg.export.files.previewB)
      if (!fs.existsSync(file)) return { pass: false, detail: `${name} does not exist. Render film B in ${cfg.formats.preview.id}, then npm run keep -- --film` }
      const p = probe(file)
      if (!p) return { pass: false, detail: `ffprobe cannot read ${name}` }
      const want = filmFrames()
      const problems = shape(p, want.film)
      const hash = engineHash()
      if (!fs.existsSync(`${file}.json`)) problems.push(`${name}.json does not exist, so the build it was rendered from is not known`)
      else if (readJson(`${file}.json`).engineHash !== hash) problems.push(`its record names build ${readJson(`${file}.json`).engineHash}, the current build is ${hash}`)
      const sounds = soundFiles().length
      if (phase >= 6 && sounds && !p.sound) problems.push(`${sounds} sound files exist and it carries no sound stream`)
      const size = mb(fs.statSync(file).size)
      if (size > cfg.repo.maxFileMb) problems.push(`it is ${size.toFixed(1)} MB, over repo.maxFileMb ${cfg.repo.maxFileMb}`)
      return { pass: problems.length === 0, detail: problems.length ? `${name}: ${list(problems)}` : `${name} is ${p.width} x ${p.height} at ${p.fps} frames a second with ${p.frames} frames, the count of ${want.from} at film.previewFps; its record names the current build ${hash}; ${p.sound ? 'it carries a sound stream' : `it is silent${phase >= 6 ? ' and no sound file exists' : ', as this phase expects'}`}; ${size.toFixed(1)} of ${cfg.repo.maxFileMb} MB` }
    },
  }

  checks.D3 = {
    at: [2, 6],
    name: 'the local render proof',
    async run() {
      const name = 'out/work/local/proof.json'
      const file = rel('out', 'work', 'local', 'proof.json')
      if (!fs.existsSync(file)) return { pass: false, detail: `${name} does not exist. Run npm run render:local -- --proof` }
      const proof = readJson(file)
      const hash = engineHash()
      const problems = []
      if (proof.engineHash !== hash) problems.push(`it names build ${proof.engineHash}, the current build is ${hash}`)
      const results = Array.isArray(proof.results) ? proof.results : Object.entries(proof.results ?? {}).map(([what, r]) => ({ what, ...r }))
      const label = (r) => [r.what, r.id, r.name, r.which].filter((v) => typeof v === 'string').join(' ') || path.basename(String(r.file ?? ''))
      const wanted = [['film B', /film[-_ ]?b\b/i]]
      if (phase >= 6) wanted.push(['the opening', /opening|film[-_ ]?a\b/i])
      const rates = [fps, cfg.film.previewFps]
      const seen = []
      for (const [what, re] of wanted) {
        const r = results.find((x) => re.test(label(x)))
        if (!r) {
          problems.push(`it holds no result for ${what}`)
          continue
        }
        const f = r.file ? (path.isAbsolute(r.file) ? r.file : rel(r.file)) : ''
        if (!f || !fs.existsSync(f)) {
          problems.push(`the file of ${what}, ${r.file ?? 'not named'}, does not exist`)
          continue
        }
        const p = probe(f)
        if (!p) {
          problems.push(`ffprobe cannot read ${short(f)}`)
          continue
        }
        const want = { width: cfg.formats.preview.width, height: cfg.formats.preview.height }
        const off = Object.keys(want).filter((k) => p[k] !== want[k]).map((k) => `${k} is ${p[k]}, not ${want[k]}`)
        if (!rates.includes(p.fps)) off.push(`fps is ${p.fps}, not film.fps ${fps} or film.previewFps ${cfg.film.previewFps}`)
        else if (p.frames !== Math.round(cfg.export.proofSeconds * p.fps)) off.push(`frames is ${p.frames}, not ${Math.round(cfg.export.proofSeconds * p.fps)}, which is export.proofSeconds at ${p.fps} frames a second`)
        if (off.length) problems.push(`${what}, ${short(f)}: ${off.join(', ')}`)
        seen.push(`${what} ${short(f)}: ${p.codec}, ${p.width} x ${p.height}, ${p.fps} frames a second, ${p.frames} frames`)
      }
      return { pass: problems.length === 0, detail: problems.length ? `${name}: ${list(problems)}` : `${name} names the current build ${hash}; ffprobe reads ${seen.join('; ')}, each export.proofSeconds (${cfg.export.proofSeconds} s) long in ${cfg.formats.preview.id}` }
    },
  }

  checks.D4 = {
    at: [5],
    name: 'the review cuts',
    async run() {
      const ext = cfg.export.container
      const places = (id) => [rel('out', 'work', `review-${id}.${ext}`), rel('out', 'work', 'review-cuts', id, cfg.export.files.reviewCut)]
      const makeable = cfg.audio.candidates.filter((c) => listFiles(rel('audio', 'mix')).some((f) => SOUND.test(f) && path.basename(f).replace(SOUND, '') === c))
      const frames = gridFrames(cfg.film.previewFps)
      const problems = []
      const seen = []
      const one = (id, sound) => {
        const f = places(id).find((x) => fs.existsSync(x))
        if (!f) {
          const part = rel('out', 'work', `review-${id}-partial.${ext}`)
          return problems.push(`out/work/review-${id}.${ext} does not exist${fs.existsSync(part) ? `; ${short(part)} does, and it is not the whole film` : ''}. Run npm run film -- --review${sound ? ` --candidate ${id}` : ''}`)
        }
        const p = probe(f)
        if (!p) return problems.push(`ffprobe cannot read ${short(f)}`)
        const off = shape(p, frames)
        if (sound && !p.sound) off.push('it carries no sound stream')
        if (off.length) problems.push(`${short(f)}: ${off.join(', ')}`)
        else seen.push(`${short(f)} (${p.frames} frames${p.sound ? ', with a sound stream' : ', silent'})`)
      }
      if (makeable.length) for (const c of makeable) one(c, true)
      else one('silent', false)
      const not = cfg.audio.candidates.filter((c) => !makeable.includes(c))
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? `${list(problems)}${not.length ? `; no mix exists in audio/mix/ for ${not.join(', ')}` : ''}`
          : `${makeable.length ? `one review cut for each of the ${makeable.length} candidates with a mix in audio/mix/` : 'no candidate has a mix in audio/mix/, and one review cut without music exists'}: ${seen.join(', ')}, each ${cfg.formats.preview.width} x ${cfg.formats.preview.height} at ${cfg.film.previewFps} frames a second with the frame count of the default grid${makeable.length && not.length ? `; no mix exists for ${not.join(', ')}` : ''}`,
      }
    },
  }

  checks.D5 = {
    at: [6],
    name: 'the preview of film A',
    async run() {
      const name = `out/${cfg.export.files.previewA}`
      const file = rel('out', cfg.export.files.previewA)
      if (!fs.existsSync(file)) return { pass: false, detail: `${name} does not exist. Render film A in ${cfg.formats.preview.id}, then npm run keep -- --film` }
      const p = probe(file)
      if (!p) return { pass: false, detail: `ffprobe cannot read ${name}` }
      const cut = readCut()
      if (!cut) return { pass: false, detail: `${name} exists, but cut/CUTLIST.json does not, so the lengths of the opening and of film B are not known` }
      const want = filmFrames()
      const problems = []
      if (!want.opening) problems.push('the cut list gives the opening no frames')
      problems.push(...shape(p, want.opening + want.film))
      const mix = rel('audio', 'final', 'film-a.wav')
      const sounds = soundFiles().length
      if (sounds && !fs.existsSync(mix)) problems.push(`${sounds} sound files exist but the final mix audio/final/film-a.wav does not`)
      if (sounds && !p.sound) problems.push(`${sounds} sound files exist and it carries no sound stream`)
      return { pass: problems.length === 0, detail: problems.length ? `${name}: ${list(problems)}` : `${name} is ${p.width} x ${p.height} at ${p.fps} frames a second with ${p.frames} frames: ${want.opening} of the opening followed by ${want.film} of film B; ${p.sound ? 'it carries a sound stream and audio/final/film-a.wav exists' : 'it is silent and no sound file exists'}` }
    },
  }

  checks.D6 = {
    at: [6],
    name: 'the card',
    async run() {
      const c = cfg.deliver.cardLoop
      const f = cfg.export.files
      const format = Object.values(cfg.formats).find((x) => x.id === c.format)
      const frames = Math.round(c.seconds * c.fps)
      const even = (v) => Math.round(v / 2) * 2
      const problems = []
      const seen = []
      const video = (name, width, height) => {
        const file = rel('deliver', name)
        if (!fs.existsSync(file)) return problems.push(`deliver/${name} does not exist`)
        const p = probe(file)
        if (!p) return problems.push(`ffprobe cannot read deliver/${name}`)
        const want = { width, height, fps: c.fps, frames }
        const off = Object.keys(want).filter((k) => p[k] !== want[k]).map((k) => `${k} is ${p[k]}, not ${want[k]}`)
        if (off.length) problems.push(`deliver/${name}: ${off.join(', ')}`)
        else seen.push(`deliver/${name} ${p.width} x ${p.height}, ${p.fps} frames a second, ${p.frames} frames`)
      }
      video(f.cardLoop, format.width, format.height)
      video(f.cardLoopWeb, c.webWidth, even((c.webWidth * format.height) / format.width))
      const still = rel('deliver', f.cardStill)
      if (!fs.existsSync(still)) problems.push(`deliver/${f.cardStill} does not exist`)
      else {
        const s = await pixels(still)
        if (s.width !== format.width || s.height !== format.height) problems.push(`deliver/${f.cardStill} is ${s.width} x ${s.height}, not ${format.width} x ${format.height}`)
        else if (fs.existsSync(rel('deliver', f.cardLoop))) {
          const first = path.join(dir, 'd6-loop-frame-0.png')
          const r = run('ffmpeg', ['-v', 'error', '-y', '-i', rel('deliver', f.cardLoop), '-frames:v', '1', first])
          if (r.status !== 0) problems.push(`ffmpeg cannot read frame 0 of deliver/${f.cardLoop}: ${tail(r.stderr, 2)}`)
          else {
            const d = await compareFiles(still, first)
            if (!(d.psnr >= STILL_MIN_PSNR)) problems.push(`deliver/${f.cardStill} is ${d.psnr.toFixed(1)} dB from frame 0 of the loop, under ${STILL_MIN_PSNR} dB, so it is not frame 0`)
            else seen.push(`deliver/${f.cardStill} ${s.width} x ${s.height}, ${Number.isFinite(d.psnr) ? `${d.psnr.toFixed(1)} dB from` : 'identical to'} frame 0 of the loop as encoded (at least ${STILL_MIN_PSNR} dB asked)`)
          }
        }
      }
      return { pass: problems.length === 0, detail: problems.length ? list(problems) : seen.join('; ') }
    },
  }
}
