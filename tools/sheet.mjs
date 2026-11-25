import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, formatById, stillSpec, stillName, renderStill } from './lib/page.mjs'
import { addLook } from './lib/looks.mjs'
import { appLegend, appMarks, appParts, appSpacing, APP_SCRIPTS } from './lib/appsheets.mjs'
import { SHEETS, across, appSource, around, composeSheet, gridLayout, labelUnits, layoutHashFor, matches, nameParts, overview, pageInfo, pages, readPlan, renderFrames, run, secondsText, shown, snapUp, sourceOf } from './lib/sheetlayout.mjs'

const USAGE = `npm run sheet -- <what> [--tier T] [--format F] [--assets A] [--diag V] [--cols N] [--force] [--look no] [--by NAME]
  --shot ID                 ${cfg.critics.contactSheetFrames} frames across a shot. ID may be test, for the test shake and the clearing after it
  --mark N=WORD[,N=WORD]    with --shot or --film: film frame N is put on the sheet of its shot and WORD is added to its label
  --film                    one sheet for every shot and one overview
  --loop [--seam]           across the card loop, or its last frames then its first
  --opening                 across the opening of film A
  --seasons                 the four at-rest keys
  --first N --last M        across a range of the film, or of the test shake with --shot test, or of the loop with --loop
  --motion NAME [--shot ID] consecutive frames at film.previewFps: lift, strokes, setdown, landing, swap, arrival (ID a shake, the hold after it, or test), move (ID a shot)
                            with --at S and --seconds S to choose a part, --stride K to show every Kth frame, --fit to choose the stride that fills one sheet
  --app NAME                a script of the live app, drawn through the app's own path: ${APP_SCRIPTS.join(', ')}
                            with --level L (${Object.keys(cfg.live.quality).join(', ')}; high unless asked), --from SEASON, --to SEASON (jump),
                            --part ID for one part (whole, and bar and landing for shake and jump, turn for stir and drag),
                            --stride K or --fit for the whole script in consecutive frames
exit 0 when every sheet is written, 3 when the chunk budget ran out: run the same command again to carry on`

const layoutHash = layoutHashFor(import.meta.url)
const args = parseArgs(process.argv.slice(2))
const str = (k) => (args[k] !== undefined && args[k] !== true ? String(args[k]) : '')
const fail = (msg, code = 1) => {
  console.error(msg)
  process.exit(code)
}
if (args.help === true || args.h === true) {
  console.log(USAGE)
  process.exit(0)
}

const o = { tier: str('tier') || 'draft', format: str('format') || cfg.formats.preview.id, assets: str('assets') || 'full', diag: str('diag') === 'none' ? '' : str('diag'), force: args.force === true }
if (!(o.tier in cfg.tiers)) fail(`no such tier: ${o.tier}`, 2)
if (!(o.assets in cfg.assetSets)) fail(`no such asset set: ${o.assets}`, 2)
const format = formatById(o.format)
const per = cfg.critics.contactSheetFrames
const cols = Number(str('cols')) || 0
const by = str('by') || 'builder'
const motion = str('motion')
const shotArg = str('shot')
const app = str('app')
if (app && !APP_SCRIPTS.includes(app)) fail(`no such script of the app: ${app}. One of ${APP_SCRIPTS.join(', ')}`, 2)
const ranged = str('first') !== '' && str('last') !== ''
if (!motion && (str('first') !== '') !== (str('last') !== '')) fail('give --first and --last together', 2)
const mode = app ? 'app' : motion ? 'motion' : args.film === true ? 'film' : args.seasons === true ? 'seasons' : args.opening === true ? 'opening' : ranged ? 'range' : args.loop === true ? 'loop' : shotArg ? 'shot' : ''
if (!mode) fail(USAGE, 2)
const MOTIONS = ['lift', 'strokes', 'setdown', 'landing', 'swap', 'arrival', 'move']
if (motion && !MOTIONS.includes(motion)) fail(`no such motion: ${motion}. One of ${MOTIONS.join(', ')}`, 2)
const marks = new Map()
for (const m of str('mark') ? str('mark').split(',') : []) {
  const [n, word] = m.split('=')
  if (!/^\d+$/.test(n ?? '') || !/^[a-z]+$/.test(word ?? '')) fail(`give --mark as N=WORD, a film frame and a word in small letters: ${m}`, 2)
  marks.set(Number(n), word)
}
if (marks.size && mode !== 'shot' && mode !== 'film') fail('--mark goes with --shot or --film', 2)
const LANDING_SECONDS = 1
class Stop extends Error {}
const MOVING = 0.05

const started = Date.now()
o.deadline = started + cfg.sandbox.chunkBudgetMinutes * 60000
const tag = nameParts(o).join('-')
const tail = `${o.format}, ${o.tier}${o.assets === 'full' ? '' : `, ${o.assets} assets`}${o.diag ? `, ${o.diag} view` : ''}`
const sheetFile = (...parts) => path.join(SHEETS, `${parts.map(String).filter(Boolean).join('-')}.jpg`)

function cutShake(id, first, landing) {
  const file = rel('cut', 'CUTLIST.json')
  if (!fs.existsSync(file)) return null
  try {
    return (readJson(file).shakes ?? []).find((s) => s.shot === id && s.first === first && s.landing === landing) ?? null
  } catch {
    return null
  }
}

function shakeMarks(plan, id, holdOk) {
  if (id === 'test') {
    if (!plan.test) throw new Stop('the page gives no test shake')
    return { source: 'test', name: 'the test shake', ...plan.test, end: plan.test.frameCount }
  }
  const shots = plan.film.shots
  const isShake = (s) => plan.film.swaps.some((w) => w.shot === s.id)
  let k = shots.findIndex((s) => s.id === id)
  if (k < 0) throw new Stop(`no such shot: ${id}. The film has ${shots.map((s) => s.id).join(', ')}`)
  if (!isShake(shots[k])) {
    if (holdOk && k > 0 && isShake(shots[k - 1])) k--
    else throw new Stop(holdOk ? `no shake ends on ${id}` : `${id} is not a shake`)
  }
  const s = shots[k]
  const landing = s.last + 1
  const length = landing - s.first
  const b = cfg.shake
  const cut = cutShake(s.id, s.first, landing)
  const hold = shots[k + 1]
  return {
    source: 'film',
    name: s.id,
    first: s.first,
    liftEnd: cut?.liftEnd ?? s.first + Math.round((length * b.liftBeats) / cfg.film.beatsPerBar),
    strokesEnd: cut?.strokesEnd ?? s.first + Math.round((length * (b.liftBeats + b.strokeBeats)) / cfg.film.beatsPerBar),
    landing,
    swap: plan.film.swaps.find((w) => w.shot === s.id),
    end: hold ? hold.last + 1 : plan.film.frameCount,
  }
}

async function moveRange(page, shot, step) {
  const first = snapUp(shot.first, step)
  const cams = await page.evaluate(
    ([a, b, st]) => {
      const out = []
      for (let i = a; i <= b; i += st) out.push(window.showcase.filmState(i).camera)
      return out
    },
    [first, shot.last, step],
  )
  const dist = (a, b, from, to) => Math.hypot(...a.slice(from, to).map((v, i) => v - b[from + i]))
  const groups = [[0, 3], [3, 6], [6, 7]]
  const speeds = groups.map(([f, t]) => cams.slice(1).map((c, j) => dist(c, cams[j], f, t)))
  const peaks = speeds.map((s) => Math.max(0, ...s))
  const moving = cams.slice(1).map((_, j) => speeds.some((s, g) => peaks[g] > 1e-9 && s[j] >= peaks[g] * MOVING))
  const a = moving.indexOf(true)
  if (a < 0) return null
  const b = moving.lastIndexOf(true)
  return { first: first + a * step, end: first + (b + 1) * step + 1 }
}

const frameLabel = (src, i, step, name) => [String(i), secondsText(i, src.fps, step), ...(name && name(i) ? [name(i)] : [])]

function marked(frames, shot, step) {
  const found = new Map()
  for (const [n, word] of marks) {
    const i = snapUp(n, step)
    if (i >= shot.first && i <= shot.last) found.set(i, word)
  }
  if (!found.size) return null
  const out = [...frames]
  for (const i of found.keys()) {
    if (out.includes(i)) continue
    const free = out.map((f, k) => ({ f, k })).filter(({ f, k }) => k > 0 && !found.has(f))
    if (!free.length) throw new Stop(`the sheet of ${shot.id} has no room for the marked frame ${i}`)
    out[free.reduce((a, b) => (Math.abs(b.f - i) < Math.abs(a.f - i) ? b : a)).k] = i
  }
  return { frames: out.sort((a, b) => a - b), words: Object.fromEntries(found) }
}

const session = await Session.open({ what: `sheet ${process.argv.slice(2).join(' ')}` })
const done = []
let complete = true
let frameCounts = { total: 0, rendered: 0, reused: 0 }
let messages = []
let stopped = ''
try {
  const page = await session.page({ format: o.format, assets: o.assets })
  const plan = await readPlan(page)

  if (mode === 'seasons') {
    const keys = cfg.seasons.map((s) => cfg.keys.find((k) => k.season === s && k.state === 'rest')).filter(Boolean)
    if (!keys.length) throw new Stop('the config holds no at-rest key')
    const stills = []
    let fresh = false
    for (const key of keys) {
      const spec = stillSpec({ key: key.id, tier: o.tier, format: o.format, assets: o.assets, diag: o.diag || undefined })
      const have = !o.force && reusable(spec)
      if (!have && stills.some((s) => !s.reused) && Date.now() > o.deadline) {
        complete = false
        break
      }
      const r = await renderStill(session, spec, { page, force: o.force })
      fresh ||= !r.reused
      stills.push({ id: key.id, file: r.file, reused: r.reused })
      console.log(`${r.reused ? 'reused' : 'rendered'} ${shown(r.file)}${r.reused ? '' : ` in ${r.record.seconds.toFixed(1)} s`}`)
    }
    frameCounts = { total: keys.length, rendered: stills.filter((s) => !s.reused).length, reused: stills.filter((s) => s.reused).length }
    if (complete) {
      const file = sheetFile('seasons', tag)
      const spec = { kind: 'seasons', stills: stills.map((s) => s.id) }
      const layout = gridLayout({ count: stills.length, frameWidth: format.width, frameHeight: format.height, labelUnits: Math.max(...stills.map((s) => labelUnits([s.id]))), cols })
      const caption = `Sheet: the ${stills.length} at-rest keys, ${stills.map((s) => s.id).join(', ')}, ${tail}`
      await write({ file, spec, caption, layout, fresh, tiles: stills.map((s) => ({ file: s.file, label: [s.id] })), frames: stills.map((s, k) => ({ id: s.id, file: shown(s.file), at: layout.cells[k] })), info: await pageInfo(page) })
    }
  } else {
    const jobs = []
    let src
    if (mode === 'shot' || mode === 'film') {
      const wanted = mode === 'film' ? plan.film.shots : shotArg === 'test' ? [] : plan.film.shots.filter((s) => s.id === shotArg)
      src = sourceOf(plan, mode === 'shot' && shotArg === 'test' ? 'test' : 'film')
      if (mode === 'shot' && shotArg === 'test') {
        const frames = across(0, src.count - 1, per, src.step)
        jobs.push({ file: sheetFile('shot', 'test', tag), frames, perSheet: per, spec: { kind: 'shot', source: 'test', shot: 'test', frames }, caption: `Sheet: ${frames.length} frames across the test shake and the clearing after it, ${tail}` })
      } else if (!wanted.length) throw new Stop(`no such shot: ${shotArg}. The film has ${plan.film.shots.map((s) => s.id).join(', ')}, and test is the test shake`)
      for (const s of wanted) {
        const plain = across(s.first, s.last, per, src.step)
        const mk = marked(plain, s, src.step)
        const frames = mk?.frames ?? plain
        const said = mk ? Object.entries(mk.words).map(([i, w]) => `frame ${i} marked ${w}`).join(', ') : ''
        jobs.push({ file: sheetFile('shot', s.id, tag, ...(mk ? ['marked'] : [])), frames, perSheet: per, ...(mk ? { name: (i) => mk.words[i] ?? '' } : {}), spec: { kind: 'shot', source: 'film', shot: s.id, frames, ...(mk ? { marks: mk.words } : {}) }, caption: `Sheet: ${frames.length} frames across the shot ${s.id}, frames ${s.first} to ${s.last}${said ? `, ${said}` : ''}, ${tail}` })
      }
      if (mode === 'film') {
        const frames = overview(plan.film.shots, src.count, per, src.step)
        jobs.push({ file: sheetFile('film', tag, 'overview'), frames, perSheet: per, name: (i) => plan.film.shots.find((s) => i >= s.first && i <= s.last)?.id ?? '', spec: { kind: 'film-overview', source: 'film', frames }, caption: `Sheet: the whole film in ${frames.length} frames, every shot at least once, ${tail}` })
      }
    } else if (mode === 'loop') {
      src = sourceOf(plan, 'loop')
      if (args.seam === true) {
        const half = Math.floor(per / 2)
        const all = run(0, src.count, src.step)
        const frames = [...all.slice(-half), ...all.slice(0, per - half)]
        jobs.push({ file: sheetFile('loop', 'seam', tag), frames, ordered: true, perSheet: per, spec: { kind: 'loop-seam', source: 'loop', frames }, caption: `Sheet: the seam of the card loop, its last ${half} frames then its first ${per - half}, ${tail}` })
      } else {
        const frames = around(src.count, per, src.step)
        jobs.push({ file: sheetFile('loop', tag), frames, perSheet: per, spec: { kind: 'loop', source: 'loop', frames }, caption: `Sheet: ${frames.length} frames across the card loop, ${tail}` })
      }
    } else if (mode === 'opening') {
      src = sourceOf(plan, 'opening')
      if (src.count < 1) throw new Stop('the opening is not built yet: opening().frameCount is 0, so there is nothing to put on a sheet')
      const frames = across(0, src.count - 1, per, src.step)
      jobs.push({ file: sheetFile('opening', nameParts(o, false).join('-')), frames, perSheet: per, spec: { kind: 'opening', source: 'opening', frames }, caption: `Sheet: ${frames.length} frames across the opening of film A, ${o.format}` })
    } else if (mode === 'range') {
      src = sourceOf(plan, args.loop === true ? 'loop' : shotArg === 'test' ? 'test' : 'film')
      const first = Number(str('first'))
      const last = Number(str('last'))
      if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first || last >= src.count) throw new Stop(`give --first and --last as frames of the ${src.what}, 0 to ${src.count - 1}`)
      const frames = across(first, last, per, src.step)
      jobs.push({ file: sheetFile('range', src.id, first, last, tag), frames, perSheet: per, spec: { kind: 'range', source: src.id, frames }, caption: `Sheet: ${frames.length} frames across frames ${first} to ${last} of the ${src.what}, ${tail}` })
    } else if (mode === 'app') {
      const level = str('level') || 'high'
      if (!(level in cfg.live.quality)) throw new Stop(`no such level: ${level}. One of ${Object.keys(cfg.live.quality).join(', ')}`)
      const ask = { ...(str('from') ? { from: str('from') } : {}), ...(str('to') ? { to: str('to') } : {}) }
      const got = await page.evaluate(
        ([n, a]) => {
          try {
            return { plan: window.showcase.dev.appScript(n, a) }
          } catch (e) {
            return { error: String(e?.message ?? e) }
          }
        },
        [app, ask],
      )
      if (got.error) throw new Stop(got.error)
      const sp = got.plan
      src = appSource(sp, level)
      const parts = appParts(sp, per)
      const marksOf = appMarks(sp, cfg.shake, cfg.film.beatsPerBar)
      const labelKind = sp.name === 'drag' ? 'yaw' : sp.name === 'stir' ? '' : 'season'
      let chosen
      if (args.fit === true || str('stride')) {
        const stride = args.fit === true ? Math.ceil(sp.frameCount / per) : Math.max(1, Math.floor(Number(str('stride')) || 1))
        chosen = [{ id: `x${stride}`, what: 'the whole script', frames: run(0, sp.frameCount, stride), stride }]
      } else if (str('part')) {
        chosen = parts.all.filter((x) => x.id === str('part'))
        if (!chosen.length) throw new Stop(`the ${sp.name} script has no part ${str('part')}. It has ${parts.all.map((x) => x.id).join(', ')}`)
      } else chosen = parts.all.filter((x) => parts.usual.includes(x.id))
      const said = { shake: `the shake from ${sp.from} to ${sp.to}`, jump: `the jump from ${sp.from} to ${sp.to}`, stir: `a stir in ${sp.from}`, drag: `a drag around the globe in ${sp.from}` }[sp.name]
      const appLabel = (i) => {
        const a = readJson(`${have.get(i)}.json`).app
        return labelKind === 'season' ? (a.target && a.target !== a.season ? `${a.season} to ${a.target}` : a.season) : labelKind === 'yaw' ? `yaw ${a.yawDeg.toFixed(1)}` : ''
      }
      for (const part of chosen) {
        const sets = pages(part.frames, per)
        const stem = ['app', sp.name, sp.from, sp.to === sp.from ? '' : sp.to, level, nameParts(o, false).join('-'), part.id].filter(Boolean).join('-')
        const spacing = appSpacing(part, sp.fps)
        sets.forEach((frames, n) => {
          const spec = { kind: 'app', script: sp.name, part: part.id, what: part.what, level, source: src.id, stride: part.stride, spacing, sheet: n + 1, sheets: sets.length, label: labelKind, frames, plan: sp, marks: marksOf }
          jobs.push({ file: sheetFile(stem, String(n + 1)), frames, ordered: true, perSheet: Math.min(per, part.frames.length), step: part.stride || 1, name: appLabel, spec, caption: `App sheet ${n + 1} of ${sets.length}: ${said}, ${part.what}, frames ${frames[0]} to ${frames[frames.length - 1]}, ${spacing}, ${nameParts(o, false).join(', ')}, level ${level}`, legend: appLegend(spec) })
        })
        for (const f of fs.existsSync(SHEETS) ? fs.readdirSync(SHEETS) : []) {
          const m = f.startsWith(`${stem}-`) ? /^(\d+)\.jpg(\.json)?$/.exec(f.slice(stem.length + 1)) : null
          if (m && Number(m[1]) > sets.length) fs.rmSync(path.join(SHEETS, f), { force: true })
        }
      }
      // A sheet drawn in another VM is kept without its frames: the scripts of a pack can be drawn by one render agent each and only the sheets carried over.
      for (const job of o.force ? [] : jobs) {
        if (!matches(job.file, { format: o.format, assets: o.assets, diagnostic: o.diag, layoutHash, spec: job.spec })) continue
        const record = readJson(`${job.file}.json`)
        const meta = await sharp(job.file).metadata()
        if (meta.width !== record.width || meta.height !== record.height || (cols && record.layout?.cols !== cols)) continue
        job.done = true
        done.push({ order: jobs.indexOf(job), file: job.file, reused: true, width: meta.width, height: meta.height, count: job.frames.length })
      }
    } else {
      const id = shotArg || (motion === 'move' ? '' : 'test')
      let range
      let name
      if (motion === 'move') {
        if (!id) throw new Stop('give --shot ID with --motion move')
        const shot = plan.film.shots.find((s) => s.id === id)
        if (!shot) throw new Stop(id === 'test' ? 'the camera does not move in the test shake' : `no such shot: ${id}. The film has ${plan.film.shots.map((s) => s.id).join(', ')}`)
        src = sourceOf(plan, 'film')
        const found = await moveRange(page, shot, src.step)
        if (!found) throw new Stop(`the camera does not move in ${id}: filmState gives the same camera for every frame of it`)
        range = { first: found.first, end: Math.min(found.end, shot.last + 1), limit: shot.last + 1 }
        name = id
      } else {
        const m = shakeMarks(plan, id, motion === 'landing' || motion === 'arrival')
        src = sourceOf(plan, m.source)
        name = id
        const spans = {
          lift: [m.first, m.liftEnd],
          strokes: [m.liftEnd, m.strokesEnd],
          setdown: [m.strokesEnd, m.landing],
          swap: [m.swap.first, m.swap.last + 1],
          landing: [m.landing, m.landing + Math.round(LANDING_SECONDS * src.fps)],
          arrival: [m.landing, m.landing + Math.round(cfg.shake.settleCheckSeconds * src.fps)],
        }
        range = { first: spans[motion][0], end: Math.min(spans[motion][1], m.end), limit: m.end }
      }
      const at = Number(str('at')) || 0
      const seconds = Number(str('seconds')) || 0
      if (at < 0 || seconds < 0) throw new Stop('--at and --seconds are seconds, zero or more')
      const custom = at > 0 || seconds > 0
      range.first += Math.round(at * src.fps)
      if (seconds > 0) range.end = Math.min(range.limit, range.first + Math.round(seconds * src.fps))
      range.end = Math.min(range.end, src.count)
      const every = run(range.first, range.end, src.step)
      if (!every.length) throw new Stop(`that part of the ${motion} holds no frame`)
      const stride = args.fit === true ? Math.ceil(every.length / per) : Math.max(1, Math.floor(Number(str('stride')) || 1))
      const list = every.filter((_, k) => k % stride === 0)
      const sets = pages(list, per)
      const stem = ['motion', motion, name, tag, stride > 1 ? `x${stride}` : '', custom ? `f${list[0]}-${list[list.length - 1]}` : ''].filter(Boolean).join('-')
      const spacing = `${stride * src.step} frame${stride * src.step > 1 ? 's' : ''} apart at ${src.fps} frames a second`
      sets.forEach((frames, n) => {
        jobs.push({ file: sheetFile(stem, String(n + 1)), frames, ordered: true, perSheet: Math.min(per, list.length), step: stride * src.step, spec: { kind: 'motion', motion, source: src.id, shot: name, stride, frames }, caption: `Motion sheet ${n + 1} of ${sets.length}: the ${motion} of ${name === 'test' ? 'the test shake' : name}, frames ${frames[0]} to ${frames[frames.length - 1]}, ${spacing}, ${tail}` })
      })
      for (const f of fs.existsSync(SHEETS) ? fs.readdirSync(SHEETS) : []) {
        const m = f.startsWith(`${stem}-`) ? /^(\d+)\.jpg(\.json)?$/.exec(f.slice(stem.length + 1)) : null
        if (m && Number(m[1]) > sets.length) fs.rmSync(path.join(SHEETS, f), { force: true })
      }
    }

    const have = new Map()
    const freshFrames = new Set()
    const composeReady = async () => {
      for (const job of jobs) {
        if (job.done || !job.frames.every((i) => have.has(i))) continue
        job.done = true
        const step = job.step ?? src.step
        const layout = gridLayout({ count: job.frames.length, perSheet: job.perSheet, frameWidth: format.width, frameHeight: format.height, labelUnits: Math.max(...job.frames.map((i) => labelUnits(frameLabel(src, i, step, job.name)))), cols })
        await write({
          order: jobs.indexOf(job),
          file: job.file,
          spec: job.spec,
          caption: job.caption,
          legend: job.legend,
          layout,
          fresh: job.frames.some((i) => freshFrames.has(i)),
          tiles: job.frames.map((i) => ({ file: have.get(i), label: frameLabel(src, i, step, job.name) })),
          frames: job.frames.map((i, k) => ({ index: i, seconds: i / src.fps, file: shown(have.get(i)), at: layout.cells[k] })),
          info: await pageInfo(page),
          tiered: src.tiered,
        })
      }
    }
    const r = await renderFrames(session, page, src, jobs.filter((j) => !j.done).flatMap((j) => j.frames), o, async (i, file, reused) => {
      have.set(i, file)
      if (!reused) freshFrames.add(i)
      if (!reused) await composeReady()
    })
    await composeReady()
    complete = r.complete
    frameCounts = { total: r.total, rendered: r.rendered, reused: r.reused }
  }
  messages = page.errors.slice(0, 20)
} catch (e) {
  if (!(e instanceof Stop)) throw e
  stopped = e.message
} finally {
  await session.close()
}

function reusable(spec) {
  return matches(rel('out', 'work', 'stills', stillName(spec)), { format: spec.format, tier: spec.tier, assets: spec.assets, diagnostic: spec.diag })
}

async function write({ file, spec, caption, legend, layout, fresh, tiles, frames, info, tiered = true, order = 0 }) {
  const want = { format: o.format, tier: tiered ? o.tier : undefined, assets: o.assets, diagnostic: o.diag, layoutHash, spec }
  if (!fresh && !o.force && matches(file, want)) {
    const meta = await sharp(file).metadata()
    if (meta.width === layout.width && meta.height === layout.height) {
      done.push({ order, file, reused: true, width: meta.width, height: meta.height, count: tiles.length })
      return
    }
  }
  await composeSheet({ tiles, out: file, layout })
  const record = {
    ...session.record(info, { diag: o.diag }),
    format: o.format,
    tier: tiered ? o.tier : '',
    assets: o.assets,
    layoutHash,
    spec,
    caption,
    ...(legend ? { legend } : {}),
    width: layout.width,
    height: layout.height,
    limits: layout.limits,
    layout: { cols: layout.cols, rows: layout.rows, cell: { width: layout.cellW, height: layout.cellH }, labelHeight: layout.strip, gap: layout.gap, rowGap: layout.rowGap, margin: layout.margin },
    frames,
  }
  writeJson(`${file}.json`, record)
  if (args.look !== 'no') addLook(file, caption, by)
  done.push({ order, file, reused: false, width: layout.width, height: layout.height, count: tiles.length })
}

if (stopped) fail(stopped)
for (const d of done.sort((a, b) => a.order - b.order)) console.log(`${d.reused ? 'reused' : 'wrote'} ${shown(d.file)} · ${d.width} x ${d.height} · ${d.count} frames`)
if (messages.length) console.log(`page messages:\n${messages.join('\n')}`)
const secs = ((Date.now() - started) / 1000).toFixed(0)
const counts = `${frameCounts.rendered} rendered, ${frameCounts.reused} reused`
if (complete) console.log(`sheet: done · ${done.length} sheet${done.length === 1 ? '' : 's'} · ${frameCounts.total} frames (${counts}) · ${secs} s`)
else {
  console.log(`sheet: incomplete · ${frameCounts.rendered + frameCounts.reused} of ${frameCounts.total} frames (${counts}) · ${done.length} sheet${done.length === 1 ? '' : 's'} written · sandbox.chunkBudgetMinutes ran out after ${secs} s · run the same command again to carry on`)
  process.exit(3)
}
