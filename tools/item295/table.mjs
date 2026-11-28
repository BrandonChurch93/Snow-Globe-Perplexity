// Item 295: one line a load from an arm's JSON (tools/item295/listen.mjs). node tools/item295/table.mjs <arm folder> [more folders]
// Times are ms after the page's mark of the first picture. Nothing is drawn or loaded here; it only reads.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : null)
const span = (a) => (a.length ? `${Math.min(...a)} to ${Math.max(...a)}, median ${med(a)} (${a.length})` : 'none')

for (const dir of process.argv.slice(2)) {
  const file = readdirSync(dir).find((f) => f.endsWith('.json') && !f.includes('-r'))
  if (!file) {
    console.log(`${dir}: no JSON`)
    continue
  }
  const loads = Object.values(JSON.parse(readFileSync(join(dir, file), 'utf8')))
  console.log(`\n${file.replace(/\.json$/, '')}: ${loads.length} loads`)
  const byQuery = new Map()
  for (const l of loads) {
    const first = l.marks?.find((m) => m.mark === 'first-picture')?.at
    const rel = (t) => (first === undefined ? t : t - first)
    const lost = (l.lost ?? []).map((x) => rel(x.at))
    const back = (l.back ?? []).map(rel)
    const gaps = (l.gaps ?? []).filter(([at, ms]) => first !== undefined && at + ms > first && ms >= 1000).map(([at, ms]) => `${ms}@${rel(at)}`)
    const firstGap = (l.gaps ?? []).find(([at, ms]) => first !== undefined && at + ms > first && ms >= 1000)
    const exits = (l.telling ?? []).map((t) => /exit_code=(\d+)/.exec(t)?.[1]).filter(Boolean)
    const dawn = (l.telling ?? []).filter((t) => /\[Device\] is lost/.test(t)).length
    const gpu = (l.samples ?? []).flatMap((s) => (s.processes ?? []).filter((p) => p.kind === 'gpu-process').map((p) => p.rssMb))
    const made = l.marks?.find((m) => m.mark === 'made' && m.value === 'ready')
    const detail = l.marks?.find((m) => m.mark === 'detail' && m.value === 'ready')
    const row = { first, lost, back, firstGap: firstGap?.[1] ?? null, exits, lostNow: l.lostNow, procs: (l.graphicsProcesses ?? []).length, gpuMost: gpu.length ? Math.max(...gpu) : null }
    const key = l.query || '(plain)'
    if (!byQuery.has(key)) byQuery.set(key, [])
    byQuery.get(key).push(row)
    console.log(
      `  r${l.round} ${key}: first ${first ?? 'none'}; lost ${lost.join(',') || 'never'}; back ${back.join(',') || 'never'}; at the end ${l.lostNow ? 'LOST' : 'kept'}; ` +
        `exits ${exits.join(',') || 'none'}; device lines ${dawn}; graphics processes ${row.procs}; gaps ${gaps.slice(0, 5).join(' ') || 'none'}; ` +
        `detail ${detail ? rel(detail.at) : 'not'}; made ${made ? rel(made.at) : 'not'}; frames ${l.frames}; most ${row.gpuMost} MB; crash count ${l.crashCount ?? '?'}; reports ${(l.reports ?? []).length}`,
    )
  }
  for (const [key, rows] of byQuery) {
    const n = rows.length
    const lostRows = rows.filter((r) => r.lost.length)
    const died = rows.filter((r) => r.exits.length || r.procs > 1)
    console.log(
      `  SUM ${key}: ${n} loads; first picture in ${rows.filter((r) => r.first !== undefined).length}; the page saw a loss in ${lostRows.length} (first at ${span(lostRows.map((r) => r.lost[0]))}); ` +
        `a graphics process ended in ${died.length}; lost at the end ${rows.filter((r) => r.lostNow).length}; first gap of 1 s and more in ${rows.filter((r) => r.firstGap).length}: ${span(rows.filter((r) => r.firstGap).map((r) => r.firstGap))}; ` +
        `exits ${JSON.stringify(rows.flatMap((r) => r.exits).reduce((o, c) => ((o[c] = (o[c] ?? 0) + 1), o), {}))}`,
    )
  }
}
