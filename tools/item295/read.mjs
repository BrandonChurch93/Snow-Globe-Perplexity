// node tools/item295/read.mjs <folder of one arm's artifact> [--lines] [--memory] [--load <tag part>]
//
// Item 295: reads what tools/item295/listen.mjs wrote for one arm (the folder a hosted run's artifact unpacks to) and
// prints, load by load, what the questions of the item ask for: when the card was lost after the first picture, when it
// came back, the browser's graphics processes before and after, the frames that did not come, and Chrome's own lines
// around the loss with their time after the first picture. --memory adds the readings every 2 s (the graphics process,
// the machine); --lines prints every telling line of Chrome instead of the ones around the loss. It measures nothing itself.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const dir = path.resolve(process.argv[2] ?? '.')
const has = (f) => process.argv.includes(f)
const only = process.argv.includes('--load') ? process.argv[process.argv.indexOf('--load') + 1] : null
const files = fs.readdirSync(dir)
const jsonFile = files.find((f) => f.endsWith('.json'))
if (!jsonFile) {
  console.log(`no json in ${dir}: ${files.join(' ')}`)
  process.exit(0)
}
const results = JSON.parse(fs.readFileSync(path.join(dir, jsonFile), 'utf8'))
const table = files.find((f) => f === jsonFile.replace(/\.json$/, '.txt'))
if (table) console.log(fs.readFileSync(path.join(dir, table), 'utf8').split('\n').slice(0, 3).join('\n'))

const readLog = (tag) => {
  const plain = path.join(dir, `${tag}-chrome.log`)
  if (fs.existsSync(plain)) return fs.readFileSync(plain, 'utf8')
  if (fs.existsSync(`${plain}.gz`)) return zlib.gunzipSync(fs.readFileSync(`${plain}.gz`)).toString('utf8')
  return ''
}
// A line of the driver: "<ISO time> pw:browser [pid=N][err] <Chrome's line>".
const lineTime = (l) => {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z)/.exec(l)
  return m ? Date.parse(m[1]) : null
}
const KEY = /MTLCommandBuffer|Metal command buffer|kIOGPU|IOGPU|[Cc]ontext (was )?lost|Context reset|lost context|exit_code|GPU process (exited|crash|launch|isn)|Exiting GPU process|watchdog|Watchdog|GL_OUT_OF_MEMORY|OUT_OF_MEMORY|out of memory|ContextResult|blocked|Hang|hang detected|GpuProcessHost|RestartGpuProcess|device (was )?lost|command buffer|SharedImage.*fail|Failed to|ERROR:/

const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
const span = (a) => (a.length ? `${Math.min(...a)} to ${Math.max(...a)}, median ${median(a)} (${a.length})` : 'none')
const byQuery = new Map()
for (const r of results) {
  if (only && !r.tag.includes(only)) continue
  const what = r.query === '' ? 'the plain address' : `?${r.query}`
  if (!byQuery.has(what)) byQuery.set(what, [])
  byQuery.get(what).push(r)
  if (r.failed) {
    console.log(`\n${r.tag}: FAILED ${r.failed}`)
    continue
  }
  const first = r.marks.find((m) => m.mark === 'first-picture' && m.value === '1')?.at ?? null
  const firstWall = first === null ? null : r.wall0 + (first - r.page0)
  const rel = (t) => (first === null ? `${t}p` : `${t - first >= 0 ? '+' : ''}${t - first}`)
  const relWall = (w) => (firstWall === null ? '?' : `${w - firstWall >= 0 ? '+' : ''}${Math.round(w - firstWall)}`)
  const gaps = r.gaps.filter(([from, ms]) => first !== null && from + ms > first && ms >= 500)
  console.log(`\n${r.tag} (${r.beganUtc} to ${r.endedUtc}): first picture ${first} ms of the page; marks ${r.marks.map((m) => `${m.mark}=${m.value} ${rel(m.at)}`).join(', ')}`)
  console.log(`  lost ${r.lost.length ? r.lost.map((l) => `${rel(l.at)}${l.message ? ` "${l.message}"` : ''}`).join(', ') : 'never'}; back ${r.back.length ? r.back.map(rel).join(', ') : 'never'}; refused ${r.refused.length ? r.refused.map((l) => `${rel(l.at)} "${l.message}"`).join(', ') : 'none'}; lost at the end ${r.lostNow}; made ${r.made}; detail ${r.detail}; canvas ${r.canvas ? `${r.canvas.width}x${r.canvas.height}` : 'none'} ratio ${r.ratio}; card by the page ${r.cardByPage ?? 'not asked'}`)
  console.log(`  no frame for 0.5 s and more after the first picture: ${gaps.length ? gaps.map(([from, ms]) => `${ms} ms from ${rel(from)}`).join(', ') : 'none'}; frames ${r.frames}; ended by ${r.endedBy} at ${rel(r.endMs)}`)
  const gpuSeen = []
  for (const s of r.samples) for (const p of s.processes) if (p.kind === 'gpu-process') gpuSeen.push({ at: s.at, pid: p.pid, rssMb: p.rssMb, cpuS: p.cpuS })
  const pids = [...new Set(gpuSeen.map((g) => g.pid))]
  console.log(`  graphics processes: ${pids.map((pid) => {
    const of = gpuSeen.filter((g) => g.pid === pid)
    return `${pid} seen ${relWall(of[0].at)} to ${relWall(of[of.length - 1].at)}, ${Math.min(...of.map((g) => g.rssMb))} to ${Math.max(...of.map((g) => g.rssMb))} MB, processor time ${of[of.length - 1].cpuS} s`
  }).join('; ') || 'none seen'}; crash count on chrome://gpu ${r.crashCount ?? 'not read'}; crash reports ${r.reports?.length ?? 0}${r.reports?.length ? ` (${r.reports.map((x) => path.basename(x.file)).join(', ')})` : ''}`)
  if (r.told) console.log(`  the browser's own list at the end: ${r.told.map((p) => `${p.type} ${p.id} ${Math.round(p.cpuTime * 10) / 10} s`).join(', ')}`)
  const free = r.samples.map((s) => s.memory?.freeMb).filter(Number.isFinite)
  const swap = r.samples.map((s) => s.memory?.swapUsedMb).filter(Number.isFinite)
  const comp = r.samples.map((s) => s.memory?.compressorMb).filter(Number.isFinite)
  console.log(`  the machine: free ${span(free)} MB; compressor ${span(comp)} MB; swap used ${span(swap)} MB`)
  if (has('--memory')) {
    for (const s of r.samples) {
      const m = s.memory ?? {}
      console.log(`    ${relWall(s.at).padStart(8)} ${s.why.padEnd(30)} ${s.processes.map((p) => `${p.kind.replace('utility:', 'u:').replace('network.mojom.NetworkService', 'net').replace('gpu-process', 'GPU')} ${p.pid} ${p.rssMb}MB ${p.cpu}%`).join(' | ')} || free ${m.freeMb} active ${m.activeMb} inactive ${m.inactiveMb} wired ${m.wiredMb} compressor ${m.compressorMb} swap ${m.swapUsedMb}${s.card ? ` || card ${s.card.replace(/\s+/g, ' ').slice(0, 400)}` : ''}`)
    }
  }
  for (const m of r.messages.slice(0, 6)) console.log(`  message ${relWall(r.t0 + m.afterGotoMs)}: ${m.text.slice(0, 300)}`)
  const lines = readLog(r.tag).split('\n')
  const lossWall = r.lost.length && firstWall !== null ? r.wall0 + (r.lost[0].at - r.page0) : null
  const chosen = []
  for (const l of lines) {
    if (!/\[(err|out)\]/.test(l) || /\]cmd: /.test(l) || /<launching>/.test(l) || /chrome\/updater\/|crashpad\/util\/file|GoogleUpdater/.test(l)) continue
    if (!KEY.test(l)) continue
    const t = lineTime(l)
    if (!has('--lines') && lossWall !== null && t !== null && (t < lossWall - 12000 || t > lossWall + 6000)) continue
    if (!has('--lines') && lossWall === null && !/MTL|Metal|kIOGPU|lost|exit_code|watchdog|OUT_OF_MEMORY/.test(l)) continue
    chosen.push(`    ${t === null || firstWall === null ? '?' : relWall(t)}: ${l.replace(/^\S+ pw:browser /, '').slice(0, 520)}`)
  }
  console.log(`  Chrome's lines ${lines.length}${lossWall === null ? ', of the telling kind' : ', around the loss (12 s before to 6 s after)'}: ${chosen.length}`)
  for (const c of chosen.slice(0, has('--lines') ? 400 : 40)) console.log(c)
  for (const n of r.notes ?? []) console.log(`  note: ${n}`)
}

console.log('\nIN SUM')
for (const [what, of] of byQuery) {
  const ok = of.filter((r) => !r.failed)
  const firstOf = (r) => r.marks.find((m) => m.mark === 'first-picture' && m.value === '1')?.at ?? null
  const drew = ok.filter((r) => firstOf(r) !== null)
  const lost = drew.filter((r) => r.lost.length)
  const lossAt = lost.map((r) => r.lost[0].at - firstOf(r))
  const back = lost.filter((r) => r.back.length).map((r) => r.back[0] - r.lost[0].at)
  const firstGap = drew.map((r) => r.gaps.find(([from, ms]) => from + ms > firstOf(r) && ms >= 1000)).filter(Boolean)
  const died = lost.filter((r) => r.graphicsProcesses.length > 1)
  const gapsAll = drew.map((r) => r.gaps.filter(([from, ms]) => from + ms > firstOf(r) && ms >= 1000).reduce((s, [, ms]) => s + ms, 0))
  console.log(`${what}: ${of.length} browsers; a first picture in ${drew.length} (at ${span(drew.map(firstOf))} ms); lost in ${lost.length} at ${span(lossAt)} ms after the first picture; back in ${back.length} after ${span(back)} ms; lost at the end in ${drew.filter((r) => r.lostNow === true).length}; a new graphics process in ${died.length} of the lost and in ${drew.filter((r) => !r.lost.length && r.graphicsProcesses.length > 1).length} of the kept; crash reports ${ok.reduce((s, r) => s + (r.reports?.length ?? 0), 0)}; the first gap of 1 s and more after the first picture in ${firstGap.length}: ${span(firstGap.map(([, ms]) => ms))} ms; all gaps of 1 s and more summed ${span(gapsAll)} ms; most of the graphics process ${span(ok.map((r) => r.samples.reduce((m, s) => Math.max(m, ...s.processes.filter((p) => p.kind === 'gpu-process').map((p) => p.rssMb)), 0)))} MB; least free memory ${span(ok.map((r) => Math.min(...r.samples.map((s) => s.memory?.freeMb).filter(Number.isFinite))))} MB`)
}
