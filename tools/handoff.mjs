// The render handoff: one word for each step of RENDER-ON-YOUR-PC.md.
//   node tools/handoff.mjs setup | doctor | test | render | check | deliver | clean
// Every word prints PASS or FAIL and one sentence as its last line, writes a report file under out/work/handoff, and
// ends with exit code 0 only on PASS. The long words (setup, test, render, check) do their work in a process of their
// own in the background: the line that started it watches for some minutes and then answers RUNNING (exit code 3),
// and the same line run again goes on watching. Nothing is started twice and nothing finished is done again.
// The rules are in tools/lib/handoff.mjs, the work in tools/lib/handoff-work.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as L from './lib/handoff.mjs'
import * as X from './lib/handoff-machine.mjs'
import { rel } from './lib/paths.mjs'

const WIN = process.platform === 'win32'
const SELF = fileURLToPath(import.meta.url)
const H = rel('out', 'work', 'handoff')
const LONG = ['setup', 'test', 'render', 'check']
const WATCH_SECONDS = 510
const FAST_WATCH_SECONDS = 20
const file = (name) => path.join(H, name)
const readOr = (f, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  const tmp = `${f}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + '\n')
  fs.renameSync(tmp, f)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clock = () => new Date().toISOString().slice(11, 19)

function end(state, sentence) {
  console.log(L.verdictLine(state, sentence))
  process.exit(L.EXIT[state])
}

// ---------------------------------------------------------------------------------------------------------------------
// What a command says, and its report.

function makeCtx(cmd, T, { background, live = true }) {
  fs.mkdirSync(H, { recursive: true })
  const log = file(`job-${cmd}.log`)
  const out = file(`job-${cmd}.out`)
  const lines = []
  const write = (f, text) => {
    try {
      fs.appendFileSync(f, text)
    } catch {}
  }
  return {
    cmd,
    T,
    H,
    lines,
    tables: [],
    /** A line the reader sees, and the report holds. */
    say(line) {
      lines.push(line)
      write(log, `${clock()} ${line}\n`)
      if (background) write(out, `${line}\n`)
      else if (live) console.log(line)
    },
    /** A line for the log file alone. */
    note(line) {
      write(log, `${clock()} ${line}\n`)
    },
    heartbeat: null,
    heartbeatLine: null,
  }
}

function gitLine(args) {
  const r = spawnSync('git', args, { cwd: rel(), encoding: 'utf8', windowsHide: true })
  return !r.error && r.status === 0 ? r.stdout.trim() : ''
}

function reportText(cmd, ctx, result, state) {
  const bar = '-'.repeat(100)
  const head = [
    `${L.TITLE}: the render handoff, "${cmd}"`,
    `written    ${new Date().toISOString()}`,
    `clone      ${rel()}`,
    `commit     ${gitLine(['rev-parse', 'HEAD']) || 'not read'}`,
    `tool       node tools/handoff.mjs ${cmd}, Node ${process.version} on ${process.platform} ${process.arch}`,
    ...(L.anyTestSwitch(ctx.T) ? [`NOTE       this was a run of the tool's own tests (${Object.entries(ctx.T).filter(([, v]) => v).map(([k, v]) => (v === true ? k : `${k}=${v}`)).join(', ')}). It is no run of the film`] : []),
  ]
  const tables = ctx.tables.filter((t) => t.rows.length).flatMap((t) => [bar, `${t.title}:`, L.tableText(t.rows)])
  return [...head, bar, ...ctx.lines, ...tables, bar, L.verdictLine(state, result.why), ''].join('\n')
}

/** The report of the whole render, which goes to the Desktop with the files. */
function finalReport(ctx, { machine, mode, checked, files, rows, folder }) {
  const Work = ctx.work
  const bar = '-'.repeat(100)
  const doc = readOr(file('doctor.json'))
  const test = readOr(file('test.json'))
  const hist = Work.renderHistory(H)
  const stamp = Work.readStamp()
  const lines = [
    `${L.TITLE}: the render report`,
    `written    ${new Date().toISOString()}`,
    ...(mode.small ? ["NOTE       this was a small run of the tool's own tests. These files are no film"] : []),
    bar,
    `machine    ${machine.os}${machine.model ? `, ${machine.model}` : ''}`,
    `processor  ${machine.processor.name}, ${machine.processor.cores || '?'} cores, ${machine.processor.threads} threads`,
    `memory     ${L.gb(machine.memoryBytes).toFixed(1)} GB`,
    ...machine.cards.map((c) => `video card ${c.name}${c.driverVersion ? `, driver ${c.driverVersion}` : ''}${c.driverDate ? ` of ${c.driverDate}` : ''}`),
    `drawn on   ${test?.renderer ?? doc?.renderer ?? 'not recorded'}`,
    `browser    Google Chrome ${test?.browser ?? 'not recorded'}`,
    `engine     ${stamp?.engineHash ?? 'not recorded'} at commit ${gitLine(['rev-parse', 'HEAD']) || 'not read'}`,
    `size       ${mode.format.width} x ${mode.format.height}, ${mode.fps} frames a second`,
    bar,
    `the render took ${L.hoursText(hist.seconds)} in ${hist.starts} ${hist.starts === 1 ? 'start' : 'starts'}, with ${hist.stops} ${hist.stops === 1 ? 'stop' : 'stops'} on the way`,
    ...hist.sessions.map((s, i) => `  start ${i + 1}: ${s.start} to ${s.end ?? s.last ?? '?'}, ${s.how ?? 'no end recorded'}`),
    `awake      ${hist.awake || 'not recorded'}`,
    ...(test?.projection ? [`projected  ${L.hoursText(test.projection.seconds)} by the short test, with --procs ${test.procs}`] : []),
    bar,
    'the delivered files:',
    L.tableText(rows),
    bar,
    'the check:',
    L.tableText(checked.rows),
    bar,
    `folder     ${folder}`,
    ...files.map((f) => `  ${path.basename(f.file)}  ${(f.bytes / 1e6).toFixed(1)} MB  sha256 ${f.sha256}`),
    '',
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------------------------------
// The commands.

async function runCommand(cmd, ctx) {
  const Work = await import('./lib/handoff-work.mjs')
  ctx.work = Work
  if (cmd === 'setup') return Work.setup(ctx)
  // the packages are needed from here on
  if (!fs.existsSync(rel('node_modules', 'playwright-core')) && cmd !== 'doctor' && cmd !== 'clean') return { pass: false, why: 'the packages are not installed yet. Run this line first: node tools/handoff.mjs setup' }
  if (cmd === 'doctor') return Work.doctor(ctx)
  if (cmd === 'test') return Work.shortTest(ctx)
  if (cmd === 'render') return Work.fullRender(ctx)
  if (cmd === 'check') return Work.check(ctx)
  if (cmd === 'deliver') return Work.deliver(ctx, (facts) => finalReport(ctx, facts))
  if (cmd === 'clean') return Work.clean(ctx)
  throw new Error(`${cmd} is no word of this tool`)
}

const KEPT = { doctor: 'doctor.json', test: 'test.json', check: 'check.json', deliver: 'deliver.json' }

/** Runs a command to its end and writes its report and its record. */
async function carryOut(cmd, ctx) {
  let result
  try {
    result = await runCommand(cmd, ctx)
  } catch (e) {
    ctx.note(String(e?.stack ?? e))
    result = { pass: false, why: `the tool itself stopped on an error, which is a fault of the tool and not of this machine: ${String(e?.message ?? e).split('\n')[0]}`, error: String(e?.stack ?? e) }
  }
  const state = result.pass ? 'PASS' : 'FAIL'
  if (result.rows?.length && !ctx.tables.some((t) => t.rows === result.rows)) ctx.tables.push({ title: `the checks of "${cmd}"`, rows: result.rows })
  if (KEPT[cmd] && !result.refused) {
    const { rows, ...rest } = result
    writeJson(file(KEPT[cmd]), { ...rest, ...(cmd === 'check' || cmd === 'deliver' ? { rows } : {}), command: cmd })
  }
  const text = reportText(cmd, ctx, result, state)
  fs.writeFileSync(file(`report-${cmd}.txt`), text)
  return { state, why: result.why, text }
}

function printReport(cmd, text) {
  console.log('')
  console.log(`===== REPORT: ${file(`report-${cmd}.txt`)} =====`)
  console.log(text.trimEnd().split('\n').slice(0, -1).join('\n'))
  console.log('===== END OF REPORT =====')
}

// ---------------------------------------------------------------------------------------------------------------------
// The work in the background.

const jobFile = () => file('job.json')
const seenFile = () => file('job-seen.json')
const beatFile = () => file('heartbeat.json')

function killTree(pid) {
  try {
    if (WIN) spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(pid), '/T', '/F'], { windowsHide: true })
    else {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {}
      process.kill(pid, 'SIGKILL')
    }
  } catch {}
}

/** Ends what a stopped run left behind: its tools, its browsers and the lock of a render that is gone. */
function sweepLeftovers(ctx) {
  const kids = readOr(file('children.json'), [])
  let ended = 0
  for (const pid of kids) {
    if (pid !== process.pid && X.alive(pid)) {
      killTree(pid)
      ended++
    }
  }
  try {
    fs.rmSync(file('children.json'), { force: true })
  } catch {}
  const browsers = X.stopLeftBrowsers()
  try {
    fs.rmSync(rel('out', 'work', 'render.lock'), { force: true })
  } catch {}
  if (ended || browsers) ctx.say(`a stopped run had left ${ended} ${ended === 1 ? 'tool' : 'tools'} and ${browsers} ${browsers === 1 ? 'browser' : 'browsers'} behind; they are ended`)
}

async function worker(cmd, T) {
  const id = process.env.HANDOFF_JOB || `${cmd}-${Date.now().toString(36)}`
  const job = { id, cmd, state: 'running', pid: process.pid, started: new Date().toISOString() }
  writeJson(jobFile(), job)
  const ctx = makeCtx(cmd, T, { background: true })
  ctx.note(`===== ${cmd} started, process ${process.pid}, job ${id} =====`)
  const beat = () => {
    let more = {}
    try {
      more = ctx.heartbeat?.() ?? {}
    } catch {}
    writeJson(beatFile(), { time: new Date().toISOString(), id, cmd, pid: process.pid, ...more })
  }
  beat()
  const ticking = setInterval(beat, 20000)
  const saying = setInterval(() => {
    try {
      if (ctx.heartbeatLine) ctx.say(ctx.heartbeatLine())
    } catch {}
  }, 60000)
  process.on('uncaughtException', (e) => ctx.note(`uncaught: ${e?.stack ?? e}`))
  process.on('unhandledRejection', (e) => ctx.note(`unhandled: ${e?.stack ?? e}`))
  if (cmd !== 'setup') sweepLeftovers(ctx)
  const done = await carryOut(cmd, ctx)
  clearInterval(ticking)
  clearInterval(saying)
  beat()
  writeJson(jobFile(), { ...job, state: 'done', verdict: done.state, why: done.why, ended: new Date().toISOString() })
  ctx.note(`===== ${cmd} ended: ${done.state} =====`)
  process.exit(0)
}

function startWorker(cmd) {
  const id = `${cmd}-${Date.now().toString(36)}`
  fs.mkdirSync(H, { recursive: true })
  writeJson(jobFile(), { id, cmd, state: 'starting', pid: null, started: new Date().toISOString() })
  fs.writeFileSync(file(`job-${cmd}.out`), '')
  fs.rmSync(seenFile(), { force: true })
  process.env.HANDOFF_JOB = id
  if (WIN) {
    // A process of its own with a hidden console of its own: the tools it starts open no windows, and ending the
    // terminal that started it does not end it.
    const q = (s) => `'${String(s).replace(/'/g, "''")}'`
    X.powershell(`$p = Start-Process -FilePath ${q(process.execPath)} -ArgumentList ${q(`"${SELF}" ${cmd} --worker`)} -WorkingDirectory ${q(rel())} -WindowStyle Hidden -RedirectStandardOutput ${q(file(`job-${cmd}.stdout`))} -RedirectStandardError ${q(file(`job-${cmd}.stderr`))} -PassThru; Write-Output $p.Id`)
  } else {
    const err = fs.openSync(file(`job-${cmd}.stderr`), 'w')
    const child = spawn(process.execPath, [SELF, cmd, '--worker'], { cwd: rel(), detached: true, stdio: ['ignore', 'ignore', err], env: process.env })
    child.unref()
    fs.closeSync(err)
  }
  return id
}

/** Prints what the background work has said since `from`, whole lines only, and returns where it stopped reading. */
function printNew(cmd, from) {
  let text = ''
  try {
    const fd = fs.openSync(file(`job-${cmd}.out`), 'r')
    const size = fs.fstatSync(fd).size
    if (size > from) {
      const buf = Buffer.alloc(size - from)
      fs.readSync(fd, buf, 0, buf.length, from)
      text = buf.toString('utf8')
    }
    fs.closeSync(fd)
  } catch {}
  const cut = text.lastIndexOf('\n')
  if (cut < 0) return from
  const whole = text.slice(0, cut)
  if (whole) console.log(whole)
  return from + Buffer.byteLength(text.slice(0, cut + 1))
}

const SAME_LINE = (cmd) => `node tools/handoff.mjs ${cmd}`

async function foreground(cmd, T) {
  fs.mkdirSync(H, { recursive: true })
  let job = readOr(jobFile())
  const seen = readOr(seenFile())
  if (job && seen?.id === job.id && seen.shown) job.shown = true
  const beat = readOr(beatFile())
  const last = job ? Date.parse(beat?.id === job.id ? beat.time : job.started) : 0
  const age = job ? (Date.now() - last) / 1000 : 0
  const live = !!job?.pid && X.alive(job.pid)
  const step = L.jobStep({ job, cmd, alive: live || job?.state === 'starting', age })
  let from = 0
  if (step.do === 'busy') end('FAIL', step.why)
  if (step.do === 'show') {
    from = printNew(cmd, seen?.id === job.id ? (seen.offset ?? 0) : 0)
  } else if (step.do === 'follow') {
    console.log(`"${cmd}" is at work in the background since ${job.started}; following it`)
    from = printNew(cmd, seen?.id === job.id ? (seen.offset ?? 0) : 0)
  } else {
    if (job?.state === 'running' && live) {
      // it lives and has given no sign for too long: it is ended before another is started
      console.log(`the last "${job.cmd}" gave no sign of life for ${Math.round(age / 60)} min; it is ended and started again`)
      killTree(job.pid)
    } else if (step.stopped) console.log(`${step.why}. Nothing finished is lost: carrying on from there`)
    try {
      startWorker(cmd)
    } catch (e) {
      end('FAIL', `the work could not be started in the background: ${e.message}`)
    }
    console.log(`"${cmd}" is started in the background; this line follows it. Its full log is ${file(`job-${cmd}.log`)}`)
  }
  const until = Date.now() + (T.fastWatch ? FAST_WATCH_SECONDS : WATCH_SECONDS) * 1000
  const t0 = Date.now()
  for (;;) {
    from = printNew(cmd, from)
    job = readOr(jobFile()) ?? job
    if (job.state === 'done') {
      from = printNew(cmd, from)
      writeJson(seenFile(), { id: job.id, offset: from, shown: true })
      let text = ''
      try {
        text = fs.readFileSync(file(`report-${cmd}.txt`), 'utf8')
      } catch {}
      if (text) printReport(cmd, text)
      end(job.verdict === 'PASS' ? 'PASS' : 'FAIL', job.why)
    }
    if (job.state === 'running' && job.pid && !X.alive(job.pid)) {
      await sleep(1500)
      job = readOr(jobFile()) ?? job
      if (job.state === 'done') continue
      writeJson(jobFile(), { ...job, state: 'stopped', ended: new Date().toISOString() })
      end('FAIL', `"${cmd}" was stopped before it ended: its process is gone (the machine slept or restarted, or the process was ended). Nothing finished is lost. Run the same line again and it carries on: ${SAME_LINE(cmd)}`)
    }
    if (job.state === 'starting' && Date.now() - t0 > 90000) {
      let said = ''
      try {
        said = fs.readFileSync(file(`job-${cmd}.stderr`), 'utf8').trim().split(/\r?\n/).slice(-6).join(' / ')
      } catch {}
      writeJson(jobFile(), { ...job, state: 'stopped', ended: new Date().toISOString() })
      end('FAIL', `the work did not start in the background within 90 s${said ? `. It wrote: ${said}` : ''}`)
    }
    if (Date.now() > until) {
      writeJson(seenFile(), { id: job.id, offset: from, shown: false })
      const b = readOr(beatFile())
      end('RUNNING', `"${cmd}" is still at work in the background and nothing is wrong${b?.id === job.id && b.line ? ` (${b.line})` : ''}. Run the same line again to go on following it: ${SAME_LINE(cmd)}`)
    }
    await sleep(1000)
  }
}

// ---------------------------------------------------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2)
  const problem = L.argProblem(argv)
  if (problem) end('FAIL', problem)
  let T
  try {
    T = L.testSwitches(process.env[L.TEST_VARIABLE])
  } catch (e) {
    end('FAIL', e.message)
  }
  const cmd = argv[0]
  if (cmd === 'stamp') {
    const { stamp } = await import('./lib/handoff-stamp.mjs')
    const r = await stamp(argv.slice(1))
    end(r.pass ? 'PASS' : 'FAIL', r.why)
  }
  if (argv[1] === '--worker') return worker(cmd, T)
  if (LONG.includes(cmd) && !T.inline) return foreground(cmd, T)
  // the short words, in the foreground. A long word that is at work in the background is not disturbed.
  const job = readOr(jobFile())
  if (!LONG.includes(cmd) && cmd !== 'doctor' && job?.state === 'running' && job.pid && X.alive(job.pid)) end('FAIL', `"${job.cmd}" is still at work in the background. Follow it to its end first: ${SAME_LINE(job.cmd)}`)
  if (cmd === 'doctor' && job?.state === 'running' && job.pid && X.alive(job.pid)) end('FAIL', `"${job.cmd}" is at work in the background and holds the browser, so the doctor does not run beside it. Follow it: ${SAME_LINE(job.cmd)}`)
  // a short word prints its report once, at its end; a long word run in the foreground by the tool's tests prints as it goes
  const ctx = makeCtx(cmd, T, { background: false, live: LONG.includes(cmd) })
  ctx.note(`===== ${cmd} started in the foreground, process ${process.pid} =====`)
  const done = await carryOut(cmd, ctx)
  printReport(cmd, done.text)
  end(done.state, done.why)
}

main().catch((e) => {
  console.error(e?.stack ?? e)
  end('FAIL', `the tool itself stopped on an error: ${String(e?.message ?? e).split('\n')[0]}`)
})
