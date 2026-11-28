// node tools/item285/run.mjs <main tree> <machine> <plan file> [HHMM]   (run from the root of the mend's tree; item 285)
// Serves the two built trees, main's on port 4183 and the mend's on 4190, and makes the walks of the plan one after the
// other, never two at a time. A plan line is: arm level start mode name [extra]. A walk marked extra is not begun at or
// after the minute HHMM (UTC) and is ended by force after 20 minutes; any other after 35. What is written, walk by
// walk as it goes: out/work/item285/table-<machine>.txt and summary-<machine>.json.
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const [, , mainTree, machine, planFile, stopAt = ''] = process.argv
if (!mainTree || !machine || !planFile) throw new Error('node tools/item285/run.mjs <main tree> <machine> <plan file> [HHMM]')
const main = path.resolve(mainTree)
const mend = process.cwd()
const OUT = 'out/work/item285'
fs.mkdirSync(OUT, { recursive: true })
const sh = (command, cwd) => execSync(command, { cwd, encoding: 'utf8' }).trim()
const utc = () => new Date().toISOString().slice(11, 19)
const table = `${OUT}/table-${machine}.txt`
const put = (line) => {
  fs.appendFileSync(table, `${line}\n`)
  console.log(line)
}
const treeLine = (what, tree, port) =>
  `${what}: ${tree} · head ${sh('git rev-parse HEAD', tree)} · files changed and not committed ${sh('git status --short', tree).split('\n').filter((l) => l && !l.startsWith('??')).length} · engine ${JSON.parse(fs.readFileSync(`${tree}/dist/build.json`, 'utf8')).engineHash} · port ${port}`

const servers = [[main, 4183], [mend, 4190]].map(([tree, port]) => spawn('node', ['tools/item285/serve.mjs', tree, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] }))
const stop = () => {
  for (const s of servers) s.kill()
}
process.on('exit', stop)
await Promise.all(
  servers.map(
    (s) =>
      new Promise((resolve, reject) => {
        s.stdout.once('data', resolve)
        s.once('exit', (code) => reject(new Error(`a server ended at once, exit ${code}: is the port taken`)))
      }),
  ),
)

fs.writeFileSync(table, '')
put(`machine ${machine} · ${os.cpus().length} processors (${os.cpus()[0]?.model ?? 'unknown'}) · ${Math.round(os.totalmem() / 1048576)} MB · the table began ${new Date().toISOString().slice(0, 19)}Z`)
put(treeLine('main', main, 4183))
put(treeLine('mend', mend, 4190))
const plan = fs
  .readFileSync(planFile, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/))
const summary = []
for (const [arm, level, start, mode, name, extra] of plan) {
  if (extra === 'extra' && stopAt && utc().slice(0, 5).replace(':', '') >= stopAt) {
    put(`== ${name}: ${arm}, ${level}, ${start}, ${mode} · NOT RUN: an extra walk, and it is ${utc()} UTC, past ${stopAt}`)
    continue
  }
  const url = `http://localhost:${arm === 'main' ? 4183 : 4190}/?quality=${level}${start === 'plain' ? '' : `&season=${start}`}`
  for (const kind of ['txt', 'json', 'full.json', 'log']) fs.rmSync(`${OUT}/${name}.${kind}`, { force: true })
  put(`== ${name}: ${arm}, ${level}, ${start}, ${mode} · began ${utc()} UTC`)
  const limit = extra === 'extra' ? 20 : 35
  const exit = await new Promise((resolve) => {
    const log = fs.openSync(`${OUT}/${name}.log`, 'w')
    const walk = spawn('node', ['tools/item285/walk.mjs', url, name, mode], { stdio: ['ignore', log, log] })
    const timer = setTimeout(() => {
      walk.kill('SIGKILL')
      try {
        execSync("pkill -9 -f 'ms-playwright/chromium'")
      } catch {}
    }, limit * 60000)
    walk.on('exit', (code, signal) => {
      clearTimeout(timer)
      fs.closeSync(log)
      resolve(signal ? `ended by force after ${limit} minutes` : code)
    })
  })
  put(`   ended ${utc()} UTC, exit ${exit}`)
  if (fs.existsSync(`${OUT}/${name}.txt`) && fs.existsSync(`${OUT}/${name}.json`)) {
    for (const line of fs.readFileSync(`${OUT}/${name}.txt`, 'utf8').trimEnd().split('\n')) put(`   ${line}`)
    summary.push({ arm, level, start, ...JSON.parse(fs.readFileSync(`${OUT}/${name}.json`, 'utf8')) })
  } else {
    const tail = fs.readFileSync(`${OUT}/${name}.log`, 'utf8').trimEnd().split('\n').slice(-4).join(' | ')
    put(`   NO RESULT. The end of its log: ${tail}`)
    summary.push({ arm, level, start, name, mode, failed: true, exit, tail })
  }
  fs.writeFileSync(`${OUT}/summary-${machine}.json`, JSON.stringify(summary))
}
put(`the table ended ${new Date().toISOString().slice(0, 19)}Z · ${summary.filter((s) => !s.failed).length} walks with a result, ${summary.filter((s) => s.failed).length} without`)
stop()
process.exit(0)
