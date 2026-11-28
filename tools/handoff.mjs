// The render handoff: one word for each step of RENDER-ON-YOUR-PC.md.
//   node tools/handoff.mjs setup | doctor | test | approve | render | check | deliver | upload | clean | status
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
import * as A from './lib/handoff-approve.mjs'
import { rel } from './lib/paths.mjs'
// on Windows: a rename that waits for a file another program holds, here and in every node process started from here
import './lib/handoff-win-fs.mjs'

const WIN = process.platform === 'win32'
const SELF = fileURLToPath(import.meta.url)
const H = rel('out', 'work', 'handoff')
const LONG = ['setup', 'test', 'render', 'check', 'upload', L.UPLOAD_TEST_WORD]
const WATCH_SECONDS = 510
// the longest a word in the foreground may take before the tool ends it with a last line of its own
const SHORT_SECONDS = 540
const FAST_WATCH_SECONDS = 20
const file = (name) => path.join(H, name)
const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
/** A record of the tool. A file that is there and cannot be read at this moment (another process is writing it) is read again for two seconds before the fallback is given. */
const readOr = (f, fallback = null) => {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8'))
    } catch (e) {
      if (e?.code === 'ENOENT' || i >= 20) return fallback
      nap(100)
    }
  }
}
/** Writes a record whole: beside its place first, then into its place. If the place is held for too long, it is written there directly. */
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  const text = JSON.stringify(v, null, 2) + '\n'
  const tmp = `${f}.${process.pid}.tmp`
  try {
    fs.writeFileSync(tmp, text)
    fs.renameSync(tmp, f)
  } catch {
    fs.writeFileSync(f, text)
    fs.rmSync(tmp, { force: true })
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clock = () => new Date().toISOString().slice(11, 19)

/** The last lines of every call: where the files are, each by its whole path, and under them the verdict on one line. */
function end(state, sentence, where = []) {
  for (const l of L.whereLines(where)) console.log(l)
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
    /** What stood after the word on its line: Brandon's words, for approve alone. */
    args: process.argv.slice(3).filter((a) => a !== '--worker'),
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
  if (cmd === 'test' && !result.refused) {
    head.push(...L.plainWordsLines())
    const firstFail = (result.rows ?? []).find((r) => r.pass === false)
    head.unshift(...L.inShortLines({ pass: state === 'PASS', renderer: result.renderer, notReady: result.notReady ?? [], firstFail: firstFail ? `${firstFail.check} is ${firstFail.found}, wanted ${firstFail.wanted}` : String(result.why).split(':')[0], where: result.where ?? [], toSend: result.toSend?.folder ?? '' }), bar)
  }
  const tables = ctx.tables.filter((t) => t.rows.length).flatMap((t) => [bar, `${t.title}:`, L.tableText(t.rows), ...(t.after?.length ? ['', ...t.after] : [])])
  const look = (result.look ?? []).length ? [bar, `TO LOOK AT, ${result.look.length}. It stops nothing here, and the remote team must read it:`, ...result.look.map((l) => `  LOOK  ${l}`)] : []
  const send = L.toSendLines(result.toSend)
  const where = L.whereLines(result.where)
  return [...head, bar, ...ctx.lines, ...tables, ...look, ...(send.length ? [bar, ...send] : []), ...(where.length ? [bar, 'WHERE THE FILES ARE, each by its whole path:', ...where.map((l) => `  ${l}`)] : []), bar, L.verdictLine(state, result.why), ''].join('\n')
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
    `browser    ${L.browsersLine(hist.sessions, test?.browser)}`,
    `engine     ${stamp?.engineHash ?? 'not recorded'} at commit ${gitLine(['rev-parse', 'HEAD']) || 'not read'}`,
    `size       ${mode.format.width} x ${mode.format.height}, ${mode.fps} frames a second`,
    bar,
    `the render took ${L.hoursText(hist.seconds)} in ${hist.starts} ${hist.starts === 1 ? 'start' : 'starts'}, with ${hist.stops} ${hist.stops === 1 ? 'stop' : 'stops'} on the way`,
    ...hist.sessions.map((s, i) => `  start ${i + 1}: ${s.start} to ${s.end ?? s.last ?? '?'}, ${s.browser ? `Chrome ${s.browser}, ` : ''}${s.how ?? 'no end recorded'}`),
    `awake      ${hist.awake || 'not recorded'}`,
    ...(test?.projection ? [`projected  ${L.hoursText(test.projection.seconds)} by the short test, with ${test.procs} ${test.procs === 1 ? 'worker' : 'workers'}`] : []),
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
  // the word of the tool's own tests sends stand-ins it makes itself and needs no package
  if (cmd === L.UPLOAD_TEST_WORD) return (await import('./lib/handoff-upload.mjs')).uploadTest(ctx)
  if (!fs.existsSync(rel('node_modules', 'playwright-core')) && cmd !== 'doctor' && cmd !== 'clean') return { pass: false, why: 'the packages are not installed yet. Run this line first: node tools/handoff.mjs setup' }
  if (cmd === 'doctor') return Work.doctor(ctx)
  if (cmd === 'test') return Work.shortTest(ctx)
  if (cmd === 'approve') return Work.approve(ctx)
  if (cmd === 'render') return Work.fullRender(ctx)
  if (cmd === 'check') return Work.check(ctx)
  if (cmd === 'deliver') {
    // the Desktop's own drive is looked at before the first of the four files is written there
    const room = Work.desktopRoom(ctx)
    if (room) return { pass: false, why: room, refused: true }
    return Work.deliver(ctx, (facts) => finalReport(ctx, facts))
  }
  if (cmd === 'upload') return (await import('./lib/handoff-upload.mjs')).upload(ctx)
  if (cmd === 'clean') return Work.clean(ctx, (await import('./lib/handoff-upload.mjs')).recordsZip)
  throw new Error(`${cmd} is no word of this tool`)
}

const KEPT = { doctor: 'doctor.json', test: 'test.json', check: 'check.json', deliver: 'deliver.json', upload: 'upload.json' }

/** Runs a command to its end and writes its report and its record. */
async function carryOut(cmd, ctx) {
  let result
  // how each word last ended here is kept in one record, read before the work: the clean word deletes what it does not know
  const endedBefore = readOr(file('ended.json'), {})
  try {
    result = await runCommand(cmd, ctx)
  } catch (e) {
    ctx.note(String(e?.stack ?? e))
    result = { pass: false, why: `the tool itself stopped on an error, which is a fault of the tool and not of this machine: ${String(e?.message ?? e).split('\n')[0]}`, error: String(e?.stack ?? e) }
  }
  const state = result.pass ? 'PASS' : 'FAIL'
  if (result.rows?.length && !ctx.tables.some((t) => t.rows === result.rows)) ctx.tables.push({ title: `the checks of "${cmd}"`, rows: result.rows, after: result.after })
  if (KEPT[cmd] && !result.refused) {
    const { rows, ...rest } = result
    writeJson(file(KEPT[cmd]), { ...rest, ...(cmd === 'check' || cmd === 'deliver' || cmd === 'upload' ? { rows } : {}), command: cmd })
  }
  // A short test that failed: what the remote team needs to rule on it goes into one folder, the report names the
  // folder and is put into it last. A test that passed takes the folder of an earlier failed test away.
  if (cmd === 'test' && !result.refused) {
    try {
      if (result.pass) ctx.work?.dropFailedTest(ctx, result)
      else result.toSend = ctx.work?.keepFailedTest(ctx, result) ?? null
    } catch (e) {
      ctx.note(`the folder of a failed test: ${String(e?.stack ?? e)}`)
    }
  }
  // where the files are, each by its whole path: the report first, then what the word itself names
  const where = [{ label: 'THE REPORT', path: file(`report-${cmd}.txt`) }, ...(result.where ?? []), ...(cmd === 'deliver' && result.folder ? [{ label: 'THE DELIVERED FILES', path: result.folder }] : []), ...(result.toSend ? [{ label: 'THE FOLDER TO SEND', path: result.toSend.folder }] : [])]
  result.where = where
  const text = reportText(cmd, ctx, result, state)
  fs.writeFileSync(file(`report-${cmd}.txt`), text)
  if (result.toSend) {
    try {
      if (ctx.work?.writeFailedTestReport) ctx.work.writeFailedTestReport(ctx, result.toSend.folder, text)
      else fs.copyFileSync(file(`report-${cmd}.txt`), path.join(result.toSend.folder, `report-${cmd}.txt`))
    } catch (e) {
      ctx.note(`the report could not be put into ${result.toSend.folder}: ${e.message}`)
    }
  }
  let engine = ''
  try {
    engine = (await import('./lib/hashes.mjs')).engineHash()
  } catch {}
  writeJson(file('ended.json'), { ...endedBefore, [cmd]: { state, why: String(result.why).replace(/\s+/g, ' ').trim(), time: new Date().toISOString(), engineHash: engine, ...(result.refused ? { refused: true } : {}) } })
  return { state, why: result.why, text, where }
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
  // the start time of this process stands beside its number, so that a later call ends this process and no other
  // the stops in a row that the line counted before this start are carried in the record of the work
  const asked = readOr(jobFile())
  const carried = asked?.id === id && asked.stops ? { stops: asked.stops, doneBefore: asked.doneBefore ?? null } : {}
  const job = { id, cmd, state: 'running', pid: process.pid, processStart: X.processStart?.(process.pid) ?? null, started: new Date().toISOString(), ...carried }
  writeJson(jobFile(), job)
  const ctx = makeCtx(cmd, T, { background: true })
  ctx.note(`===== ${cmd} started, process ${process.pid}, job ${id} =====`)
  const beat = () => {
    // The record of the work names one start. When it names another by now, a later line has taken the work over:
    // this start ends itself, so that two never draw side by side and the record is never written by the older one.
    const onRecord = readOr(jobFile())
    if (onRecord?.id && onRecord.id !== id) {
      ctx.note(`===== ${cmd} of job ${id} ends itself: the record of the work names another start by now (${onRecord.id}) =====`)
      process.exit(0)
    }
    let more = {}
    try {
      more = ctx.heartbeat?.() ?? {}
    } catch {}
    try {
      writeJson(beatFile(), { time: new Date().toISOString(), id, cmd, pid: process.pid, ...more })
    } catch (e) {
      ctx.note(`the heartbeat file could not be written this time: ${e.message}`)
    }
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
  const ownRecord = readOr(jobFile())
  if (!ownRecord?.id || ownRecord.id === id) writeJson(jobFile(), { ...job, state: 'done', verdict: done.state, why: done.why, where: done.where, ended: new Date().toISOString() })
  else ctx.note(`the record of the work names another start by now (${ownRecord.id}); this one leaves it alone`)
  ctx.note(`===== ${cmd} ended: ${done.state} =====`)
  process.exit(0)
}

function startWorker(cmd, carried = {}) {
  const id = `${cmd}-${Date.now().toString(36)}`
  fs.mkdirSync(H, { recursive: true })
  writeJson(jobFile(), { id, cmd, state: 'starting', pid: null, started: new Date().toISOString(), ...carried })
  fs.writeFileSync(file(`job-${cmd}.out`), '')
  fs.rmSync(seenFile(), { force: true })
  process.env.HANDOFF_JOB = id
  if (WIN) {
    // A process of its own with a hidden console of its own: the tools it starts open no windows, and ending the
    // terminal that started it does not end it.
    const q = (s) => `'${String(s).replace(/'/g, "''")}'`
    X.powershellStart(`Start-Process -FilePath ${q(process.execPath)} -ArgumentList ${q(`"${SELF}" ${cmd} --worker`)} -WorkingDirectory ${q(rel())} -WindowStyle Hidden -RedirectStandardOutput ${q(file(`job-${cmd}.stdout`))} -RedirectStandardError ${q(file(`job-${cmd}.stderr`))} | Out-Null`)
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

/** The last lines of a file of the tool, for a report. */
function tailOf(name, most) {
  try {
    return fs.readFileSync(file(name), 'utf8').split(/\r?\n/).filter((l) => l.trim()).slice(-most)
  } catch {
    return []
  }
}

/**
 * A word whose work went away before it could say how it ended leaves a report all the same, written here by the
 * line that found it gone: what happened, what the work said last, and where its log is. The report of an earlier
 * run of the word does not stand in for it. It is recorded as a word that died, which is no failure of the film.
 * @returns {Promise<{ label: string, path: string }[]>} where the report is, for the lines above the verdict
 */
async function deathReport(cmd, why, { died = true, lines = null } = {}) {
  const report = file(`report-${cmd}.txt`)
  const bar = '-'.repeat(100)
  const said = lines ? lines.slice(-40) : tailOf(`job-${cmd}.out`, 40)
  const wrote = tailOf(`job-${cmd}.stderr`, 20)
  const text = [
    `${L.TITLE}: the render handoff, "${cmd}"`,
    `written    ${new Date().toISOString()}`,
    `clone      ${rel()}`,
    `commit     ${gitLine(['rev-parse', 'HEAD']) || 'not read'}`,
    `tool       node tools/handoff.mjs ${cmd}, Node ${process.version} on ${process.platform} ${process.arch}`,
    bar,
    `THE WORK OF "${cmd}" ENDED WITHOUT A REPORT OF ITS OWN. This report is written by the line that found it so.`,
    bar,
    said.length ? `what the work said last, ${said.length} ${said.length === 1 ? 'line' : 'lines'}:` : 'the work had said nothing yet.',
    ...said.map((l) => `  ${l}`),
    ...(wrote.length ? [bar, `what the work wrote as errors, ${wrote.length} ${wrote.length === 1 ? 'line' : 'lines'}:`, ...wrote.map((l) => `  ${l}`)] : []),
    bar,
    `the full log of the work: ${file(`job-${cmd}.log`)}`,
    bar,
    L.verdictLine('FAIL', why),
    '',
  ].join('\n')
  try {
    fs.writeFileSync(report, text)
  } catch {}
  let engine = ''
  try {
    engine = (await import('./lib/hashes.mjs')).engineHash()
  } catch {}
  try {
    writeJson(file('ended.json'), { ...readOr(file('ended.json'), {}), [cmd]: { state: 'FAIL', why: String(why).replace(/\s+/g, ' ').trim(), time: new Date().toISOString(), engineHash: engine, ...(died ? { died: true } : {}) } })
  } catch {}
  return [{ label: 'THE REPORT', path: report }]
}

/**
 * Ends the line for a word whose work was found gone, or was ended here for its silence: the stop is counted in
 * the record of the work, a report of its own is written, and the last line is a FAIL that names the one act.
 */
async function stopEnd(cmd, job, how, minutes = 0) {
  // two lines can follow the same work. The stop is counted once: the line that comes second says what is on record
  const onRecord = readOr(jobFile())
  if (onRecord?.id === job.id && onRecord.state === 'stopped' && onRecord.why) end('FAIL', onRecord.why, [{ label: 'THE REPORT', path: file(`report-${cmd}.txt`) }])
  const beat = readOr(beatFile())
  const done = beat?.id === job.id && typeof beat.framesDone === 'number' ? beat.framesDone : null
  const stops = (job.stops ?? 0) + 1
  const v = A.stopVerdict({ cmd, stops, how, minutes, line: SAME_LINE(cmd), made: (done ?? 0) > (job.doneBefore ?? 0) })
  writeJson(jobFile(), { ...job, state: 'stopped', stops, doneBefore: done ?? job.doneBefore ?? null, final: !v.again, why: v.why, ended: new Date().toISOString() })
  end('FAIL', v.why, await deathReport(cmd, v.why))
}

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
      console.log(`the last "${job.cmd}" gave no sign of life for ${Math.round(age / 60)} min; it is ended here`)
      // a process is ended only when it is known to be the tool's own: its start time is held against the record.
      // A live process that cannot be told for sure is a stop, and nothing is started beside it.
      const gone = X.processStart ? killTree({ pid: job.pid, started: job.processStart ?? null }) : killTree(job.pid)
      if (gone === false) {
        const why = `the last "${job.cmd}" gave no sign of life for ${Math.round(age / 60)} min, and the process under its number could not be told for sure to be the tool's own, so it is not ended and nothing is started beside it. Stop and report`
        end('FAIL', why, await deathReport(cmd, why, { died: false }))
      }
      // The work of this same word, ended here for its silence, is a stop like any other: the line says it as a
      // FAIL with a report, and the next line carries on.
      if (job.cmd === cmd) await stopEnd(cmd, job, 'silent', Math.round(age / 60))
    } else if (step.stopped) {
      // The work of this same word is gone and no line has said so yet. It is not started again in silence: the
      // stop is said as a FAIL with a report of its own, it is counted, and the next line carries on.
      await stopEnd(cmd, job, 'gone')
    }
    // a word that is carried on after a stop keeps the count of its stops in a row
    const carried = job?.cmd === cmd && job.state === 'stopped' && job.stops ? { stops: job.stops, doneBefore: job.doneBefore ?? null } : {}
    try {
      startWorker(cmd, carried)
    } catch (e) {
      const why = `the work could not be started in the background: ${e.message}. Run the same line once more: ${SAME_LINE(cmd)}. If it says this again, stop and report`
      end('FAIL', why, await deathReport(cmd, why))
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
      end(job.verdict === 'PASS' ? 'PASS' : 'FAIL', job.why, job.where ?? [])
    }
    // another line said the stop of this work already: this line says the same and counts nothing
    if (job.state === 'stopped' && job.cmd === cmd) end('FAIL', job.why ?? `"${cmd}" was stopped before it ended. Nothing finished is lost. Run the same line again and it carries on: ${SAME_LINE(cmd)}`, [{ label: 'THE REPORT', path: file(`report-${cmd}.txt`) }])
    if (job.state === 'running' && job.pid && !X.alive(job.pid)) {
      const dead = job.id
      await sleep(1500)
      job = readOr(jobFile()) ?? job
      // the record on disk rules: the work may have ended well, or another line may have started it again meanwhile
      if (job.id !== dead || job.state !== 'running' || X.alive(job.pid)) continue
      await stopEnd(cmd, job, 'gone')
    }
    if (job.state === 'starting' && Date.now() - t0 > 90000) {
      let said = ''
      try {
        said = fs.readFileSync(file(`job-${cmd}.stderr`), 'utf8').trim().split(/\r?\n/).slice(-6).join(' / ')
      } catch {}
      writeJson(jobFile(), { ...job, state: 'stopped', ended: new Date().toISOString() })
      const why = `the work did not start in the background within 90 s${said ? `. It wrote: ${said}` : ''}. Run the same line once more: ${SAME_LINE(cmd)}. If it says this again, stop and report`
      end('FAIL', why, await deathReport(cmd, why))
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
// Where the work stands. It reads the records and starts nothing, so it may be run at any time, beside work in the
// background too.

async function status() {
  fs.mkdirSync(H, { recursive: true })
  const { engineHash } = await import('./lib/hashes.mjs')
  const engineHere = engineHash()
  const built = readOr(rel('dist', 'build.json'))
  const stamp = readOr(rel('render', 'STAMP.json'))
  const jobNow = readOr(jobFile())
  const job = jobNow ? { cmd: jobNow.cmd, state: jobNow.state, alive: !!jobNow.pid && X.alive(jobNow.pid), stops: jobNow.stops ?? 0, final: jobNow.final === true } : null
  const ended = readOr(file('ended.json'), {})
  const renderBegun = (readOr(file('render-state.json'))?.sessions ?? []).length > 0
  const plan = L.statusPlan({ packages: fs.existsSync(rel('node_modules', 'playwright-core')), engineHere, engineBuilt: built?.engineHash ?? '', ended, job, renderBegun })
  const lines = L.statusLines({ clone: rel(), engineHere, engineBuilt: built?.engineHash ?? '', engineStamp: stamp?.engineHash ?? '', released: stamp?.releasedForFinalRender === true, ended, job, plan })
  const sentence = `this is the clone of the film, at ${rel()}. ${plan.stage}: ${plan.why}. Next line: ${plan.next || 'none'}`
  const text = [`${L.TITLE}: the render handoff, "status"`, `written    ${new Date().toISOString()}`, '-'.repeat(100), ...lines, '-'.repeat(100), L.verdictLine('PASS', sentence), ''].join('\n')
  fs.writeFileSync(file('report-status.txt'), text)
  printReport('status', text)
  end('PASS', sentence, [{ label: 'THE REPORT', path: file('report-status.txt') }])
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
  if (cmd === 'status') return status()
  if (argv[1] === '--worker') return worker(cmd, T)
  if (LONG.includes(cmd) && !T.inline) return foreground(cmd, T)
  // the short words, in the foreground. A long word that is at work in the background is not disturbed.
  const job = readOr(jobFile())
  if (!LONG.includes(cmd) && cmd !== 'doctor' && job?.state === 'running' && job.pid && X.alive(job.pid)) end('FAIL', `"${job.cmd}" is still at work in the background. Follow it to its end first: ${SAME_LINE(job.cmd)}`)
  if (cmd === 'doctor' && job?.state === 'running' && job.pid && X.alive(job.pid)) end('FAIL', `"${job.cmd}" is still at work in the background and holds the browser, so the doctor does not run beside it. Follow it to its end first: ${SAME_LINE(job.cmd)}`)
  // a short word prints its report once, at its end; a long word run in the foreground by the tool's tests prints as it goes
  const ctx = makeCtx(cmd, T, { background: false, live: LONG.includes(cmd) })
  ctx.note(`===== ${cmd} started in the foreground, process ${process.pid} =====`)
  // A short word answers inside the limit the handoff file names, whatever it waits for: a word that has not ended
  // by then is ended here with a report of its own and a last line, and what it started is ended with it.
  if (!LONG.includes(cmd)) {
    const limit = T.stop > 0 ? T.stop : SHORT_SECONDS
    setTimeout(() => {
      const why = `"${cmd}" did not end within ${limit >= 120 ? `${Math.round(limit / 60)} minutes` : `${limit} s`} on this machine, which it should, and was ended here. Nothing of the film is lost. Stop and give Brandon the report`
      ctx.note(`===== ${cmd} ended by the tool: it did not end within ${limit} s =====`)
      deathReport(cmd, why, { died: false, lines: ctx.lines })
        .then((where) => {
          for (const pid of readOr(file('children.json'), [])) if (pid !== process.pid && X.alive(pid)) killTree(pid)
          end('FAIL', why, where)
        })
        .catch(() => end('FAIL', why))
    }, limit * 1000).unref()
  }
  const done = await carryOut(cmd, ctx)
  printReport(cmd, done.text)
  end(done.state, done.why, done.where)
}

main().catch((e) => {
  console.error(e?.stack ?? e)
  end('FAIL', `the tool itself stopped on an error: ${String(e?.message ?? e).split('\n')[0]}`)
})
