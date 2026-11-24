import fs from 'node:fs'
import path from 'node:path'
import { writeAssetIndex } from './lib/hashes.mjs'
import { loadConfig, parseArgs, rel, writeJson } from './lib/paths.mjs'
import { webFiles } from './lib/webset.mjs'

/**
 * Makes the web set (public/assets) from the full set (assets-full). The rules are in tools/lib/webset.mjs.
 * `--group winter,shared` packs only those groups, `--fresh` makes every file again instead of taking it from the cache,
 * `--table` prints one line per file: its size in the full set, as the web set held it before these rules (`plain`: a lossless
 * PNG at the web size, a model as it is), and now. What was made is also written to out/work/texpack/report.json.
 */

const cfg = loadConfig()
const args = parseArgs(process.argv.slice(2))
const only = args.group && args.group !== true ? String(args.group).split(',') : null
const cap = Math.max(cfg.assetSets.web.baseMapPx, cfg.assetSets.web.interiorMapPx)
const full = rel('assets-full')
const JOBS = 4

const jobs = []
const groups = []
for (const group of fs.existsSync(full) ? fs.readdirSync(full).sort() : []) {
  if (only && !only.includes(group)) continue
  const dir = path.join(full, group)
  if (!fs.statSync(dir).isDirectory()) continue
  groups.push(group)
  for (const name of fs.readdirSync(dir).sort()) {
    const from = path.join(dir, name)
    if (fs.statSync(from).isFile() && name !== '.DS_Store' && name !== '.gitkeep') jobs.push({ group, name, from })
  }
}

const rows = new Array(jobs.length)
let next = 0
const work = async () => {
  while (next < jobs.length) {
    const i = next++
    const job = jobs[i]
    const files = await webFiles(job.from, job.name, cap, { cache: args.fresh !== true })
    rows[i] = { ...job, fullBytes: fs.statSync(job.from).size, files }
  }
}
await Promise.all(Array.from({ length: JOBS }, work))

/** A file is written under another name and renamed, so a page or a render that reads beside this run never sees half a file. */
const put = (to, data) => {
  if (fs.existsSync(to) && fs.readFileSync(to).equals(data)) return false
  const temp = `${to}.${process.pid}.part`
  fs.writeFileSync(temp, data)
  fs.renameSync(temp, to)
  return true
}

let written = 0
let bytes = 0
let first = 0
const kinds = {}
const report = []
for (const group of groups) {
  const out = rel('public', 'assets', group)
  fs.mkdirSync(out, { recursive: true })
  const wanted = new Set()
  for (const row of rows.filter((r) => r.group === group)) {
    const early = row.files.some((f) => f.first)
    for (const f of row.files) {
      wanted.add(f.name)
      if (put(path.join(out, f.name), f.data)) written++
      bytes += f.data.length
      if (!early || f.first) first += f.data.length
      kinds[f.coding.split(',')[0]] = (kinds[f.coding.split(',')[0]] ?? 0) + 1
    }
    report.push({ group, source: row.name, fullBytes: row.fullBytes, files: row.files.map(({ data, cached, ...rest }) => ({ ...rest, bytes: data.length })) })
  }
  for (const name of fs.readdirSync(out)) if (!wanted.has(name) && fs.statSync(path.join(out, name)).isFile()) fs.rmSync(path.join(out, name))
}
writeAssetIndex()

const mib = (n) => (n / 1048576).toFixed(3)
// `plain` is what a file weighed in the web set before these rules: the lossless PNG at the web size, or the model as it is.
const plain = report.reduce((n, r) => n + (r.files[0]?.plain ?? r.files.reduce((m, f) => m + f.bytes, 0)), 0)
writeJson(rel('out', 'work', 'texpack', 'report.json'), { time: new Date().toISOString(), cap, bytes, firstBytes: first, plainBytes: plain, files: report })
if (args.table === true) {
  for (const r of report) {
    const was = r.files[0]?.plain
    console.log(
      `${`${r.group}/${r.source}`.padEnd(50)} full ${mib(r.fullBytes).padStart(7)}  plain ${(was === undefined ? '' : mib(was)).padStart(6)}  web ${mib(r.files.reduce((n, f) => n + f.bytes, 0)).padStart(6)}  ${r.files
        .map((f) => `${f.name.replace(/^.*?(\.first)?(\.[a-z0-9]+)$/i, '$1$2')} ${mib(f.bytes)} ${f.width ? `${f.width}x${f.height} ` : ''}${f.coding}${f.max !== undefined ? `, largest change ${f.max} of 255` : ''}`)
        .join(' | ')}`,
    )
  }
}
console.log(
  `texpack: ${jobs.length} files of the full set into ${report.reduce((n, r) => n + r.files.length, 0)} of public/assets (${Object.entries(kinds)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ')}), ${mib(bytes)} MiB (${mib(plain)} as lossless PNG and plain models), of which the first picture needs ${mib(first)} MiB; ${written} written, asset index written`,
)
