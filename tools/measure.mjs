import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { Session, cfg, currentSeasonHashes, formatById } from './lib/page.mjs'
import { composeComparison } from './lib/compose.mjs'
import { METHOD, MEASURES, Pages, approvedFor, drawJudged, m1, m2, m3, m4, m5, m6, measuresFor, miniatureInFrame, momentEntry, printLine, rgba, shakesFor, shownParts, toMarkdown } from './lib/measures.mjs'

const args = parseArgs(process.argv.slice(2))
const unit = args.unit && args.unit !== true ? String(args.unit) : ''
if (!cfg.units.some((u) => u.id === unit)) throw new Error(`give --unit ID. Units: ${cfg.units.map((u) => u.id).join(', ')}`)
const tier = args.tier && args.tier !== true ? String(args.tier) : 'final'
if (!(tier in cfg.tiers)) throw new Error(`no such tier: ${tier}`)
const applicable = measuresFor(unit)
const asked = args.only && args.only !== true ? String(args.only).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : null
for (const m of asked ?? []) if (!(m in MEASURES)) throw new Error(`no such measure: ${m}. Measures: ${Object.keys(MEASURES).join(', ')}`)
const now = asked ? asked.filter((m) => applicable.includes(m)) : applicable
const notes = []
for (const m of asked ?? []) if (!applicable.includes(m)) notes.push(`${m} is not measured for the unit ${unit}.`)

const dir = rel('out', 'work', 'measure')
const jsonFile = path.join(dir, `${unit}.json`)
const mdFile = path.join(dir, `${unit}.md`)
const budgetMs = cfg.sandbox.chunkBudgetMinutes * 60000
const started = Date.now()

const session = await Session.open({ what: `measure ${unit}` })
const head = { unit, tier, assets: 'full', method: METHOD, engineHash: session.hash, seasonHashes: currentSeasonHashes() }
const same = (r) => Object.keys(head).every((k) => JSON.stringify(r[k]) === JSON.stringify(head[k]))
const lines = new Map()
if (args.force !== true && fs.existsSync(jsonFile)) {
  const prev = readJson(jsonFile)
  if (same(prev)) for (const l of prev.lines) if (!(asked && now.includes(l.measure))) lines.set(`${l.measure}:${l.still}`, l)
}
const kept = lines.size

const has = (m, still) => lines.has(`${m}:${still}`)
const put = (l) => {
  lines.set(`${l.measure}:${l.still}`, l)
  console.log(printLine(l))
}
const failed = (m, still, error) => ({ measure: m, still, pass: false, value: 'none', threshold: thresholdOf(m), key: MEASURES[m].key, detail: `could not be measured: ${String(error?.message ?? error).split('\n')[0]}` })
const thresholdOf = (m) => (m === 'M1' ? 0 : MEASURES[m].key.split('.').reduce((o, k) => o[k], cfg))

let planned = []
let stopped = false
const write = () => {
  const order = new Map(planned.map((p, i) => [p, i]))
  const list = [...lines.values()].filter((l) => order.has(`${l.measure}:${l.still}`)).sort((a, b) => order.get(`${a.measure}:${a.still}`) - order.get(`${b.measure}:${b.still}`))
  const result = {
    ...head,
    browser: session.browserVersion,
    time: new Date().toISOString(),
    complete: list.length === planned.length,
    planned: planned.length,
    red: list.filter((l) => !l.pass).length,
    measures: applicable,
    notes,
    lines: list,
  }
  writeJson(jsonFile, result)
  fs.writeFileSync(mdFile, toMarkdown(result))
  return result
}

try {
  const pages = new Pages(session)
  const first = await pages.first()
  const page = await first.evaluate(() => ({ judged: window.showcase.dev.judged(), parts: window.showcase.dev.parts(), film: window.showcase.film() }))
  const entries = page.judged.filter((e) => e.unit === unit)
  const shakes = shakesFor(unit, page.film)
  const restKeys = new Set(cfg.keys.filter((k) => k.unit === unit && k.state === 'rest').map((k) => k.id))
  const wants = (e) => {
    const w = []
    if (applicable.includes('M1')) w.push('M1')
    if (applicable.includes('M2')) w.push('M2')
    if (applicable.includes('M3') && restKeys.has(e.id)) w.push('M3')
    if (applicable.includes('M6')) w.push('M6')
    return w
  }
  for (const e of entries) for (const m of wants(e)) planned.push(`${m}:${e.id}`)
  for (const s of shakes) for (const m of ['M4', 'M5']) if (applicable.includes(m)) planned.push(`${m}:${s}`)
  if (!entries.length) notes.push(`The judged list holds no still for the unit ${unit}.`)

  const overBudget = () => Date.now() - started > budgetMs

  for (const e of entries) {
    const todo = wants(e).filter((m) => now.includes(m) && !has(m, e.id))
    if (!todo.length) continue
    if (overBudget()) {
      stopped = true
      break
    }
    const size = formatById(e.format)
    let real = null
    let ids = null
    const need = (m) => todo.includes(m)
    try {
      if (need('M1') || need('M3')) real = await drawJudged(session, pages, e, { tier })
      if ((need('M1') && e.camera === 'interior') || need('M2') || need('M3') || (need('M6') && !real)) ids = await drawJudged(session, pages, e, { tier, diag: 'ids' })
    } catch (error) {
      for (const m of todo) put(failed(m, e.id, error))
      write()
      continue
    }
    if (need('M1')) {
      try {
        const mini = e.camera === 'interior' ? miniatureInFrame(await rgba(ids.file), page.parts, e.season) : null
        put(m1(e, real.record, size, mini))
      } catch (error) {
        put(failed('M1', e.id, error))
      }
    }
    if (need('M2')) {
      try {
        const view = await drawJudged(session, pages, e, { tier, diag: 'texels' })
        put(m2(e.id, await rgba(view.file), shownParts(await rgba(ids.file), page.parts, e.season)))
      } catch (error) {
        put(failed('M2', e.id, error))
      }
    }
    if (need('M3')) {
      try {
        const key = cfg.keys.find((k) => k.id === e.id)
        const approved = approvedFor(key.image)
        if (!approved) throw new Error(`references/regions.json has no entry for ${key.image}`)
        const out = path.join(dir, `m3-${e.id}-${tier}.png`)
        await composeComparison({ a: { file: rel(approved.file), globe: approved.globe, base: approved.base }, b: { file: real.file, globe: real.record.framing.globe, base: real.record.framing.base }, out, caption: `${e.id}: matching regions for M3` })
        put(await m3(e.id, e.season, readJson(out.replace(/\.png$/, '.json')), await rgba(ids.file), page.parts))
      } catch (error) {
        put(failed('M3', e.id, error))
      }
    }
    if (need('M6')) put(m6(e.id, (real ?? ids).record))
    write()
  }

  for (const s of shakes) {
    if (stopped) break
    for (const [m, at, fn] of [['M4', 'swap', m4], ['M5', 'settle', m5]]) {
      if (!now.includes(m) || has(m, s)) continue
      if (overBudget()) {
        stopped = true
        break
      }
      try {
        const view = await drawJudged(session, pages, momentEntry(s, at), { tier, diag: 'cover' })
        put(fn(s, await rgba(view.file)))
      } catch (error) {
        put(failed(m, s, error))
      }
      write()
    }
  }
} finally {
  await session.close()
}

const result = write()
const reused = kept ? `, ${kept} lines kept from the last run of this build` : ''
for (const n of notes) console.log(n)
if (stopped) console.log(`measure ${unit}: stopped at sandbox.chunkBudgetMinutes with ${result.lines.length} of ${result.planned} lines done. Run the same command again to carry on.`)
console.log(`measure ${unit}: ${result.complete ? 'complete' : 'not complete'} · ${result.lines.length} of ${result.planned} lines, ${result.red} red${reused} · ${tier} · ${((Date.now() - started) / 1000).toFixed(0)} s`)
console.log(path.relative(rel(), jsonFile))
console.log(path.relative(rel(), mdFile))
process.exit(0)
