// A browser that is not the handoff's own is never ended by the handoff. Proven on the machine of the job, with the
// tool's own code and real browsers, in the clone of the flow (a folder with a space in its path).
// node other-browser.mjs <the clone> [a file for the lines]
//   1. a second Playwright Chromium is started as any other program would start one: its profile lies in the
//      temporary folder of the system, outside the clone's own profile root
//   2. the sweep of the tool runs before the handoff has a browser: it ends nothing
//   3. the handoff's own browser is started as the tool starts it, with its profile in the clone, and is recorded
//   4. a made up record names the other browser's process number under a profile of this clone
//   5. the sweep runs again: it ends the handoff's own browser and nothing else
// After every sweep the other browser must still answer, under the same start token as at its start. Between 2
// and 3 a made up record names the other browser by its true profile, which gives the sweep no leave either.
// It prints one line: "the other browser: PASS ..." or "PROBLEM: the other browser: ...". Exit code 0 either way
// when it ran to its end; the verdict reads the line.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const clone = path.resolve(process.argv[2] ?? '.')
const file = process.argv[3] ? path.resolve(process.argv[3]) : ''
const lib = (name) => import(pathToFileURL(path.join(clone, 'tools', 'lib', name)).href)
const lines = []
const problems = []
const say = (text) => lines.push(text)
const hold = (ok, what) => {
  say(`${ok ? 'ok     ' : 'PROBLEM'}  ${what}`)
  if (!ok) problems.push(what)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function facts(browser) {
  const session = await browser.newBrowserCDPSession()
  const [{ processInfo: list }, { arguments: args }] = await Promise.all([session.send('SystemInfo.getProcessInfo'), session.send('Browser.getBrowserCommandLine')])
  await session.detach()
  const pid = list.find(({ type }) => type.toLowerCase() === 'browser')?.id
  const profile = args.find((arg) => arg.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length) ?? ''
  return { pid, profile }
}
const answers = async (browser) => {
  try {
    return browser.isConnected() && typeof (await browser.version()) === 'string'
  } catch {
    return false
  }
}

let other = null
let own = null
let facts1 = ''
try {
  const P = await lib('handoff-processes.mjs')
  const X = await lib('handoff-machine.mjs')
  const B = await lib('browser.mjs')
  const work = path.join(clone, 'out', 'work', 'handoff')
  const root = P.profileRoot(work)
  const local = process.platform !== 'linux'
  const inRoot = (p) => path.resolve(path.dirname(p)).toLowerCase() === path.resolve(root).toLowerCase()
  say(`MEASURED on ${process.platform}, node ${process.version}. The clone: ${clone}${/\s/.test(clone) ? ' (its path holds a space)' : ' (its path holds no space)'}`)
  say(`the clone's own profile root: ${root}`)

  // 1. the other browser, started with nothing of the handoff in its environment
  delete process.env[P.PROFILE_ENV]
  other = await B.launch({ local, headless: true })
  const o = await facts(other)
  const token = P.processStart(o.pid)
  say(`the other browser: process ${o.pid}, start token ${token}, profile ${o.profile}`)
  hold(Number.isSafeInteger(o.pid) && !!token, 'the other browser has a process number and a start token')
  hold(!!o.profile && !inRoot(o.profile), "the other browser's profile lies outside the clone's own profile root")

  // 2. the sweep before the handoff has a browser of its own
  const first = X.stopLeftBrowsers(work)
  await sleep(1500)
  hold(first === 0, `the sweep before the handoff's own browser was started ended ${first} (wanted 0)`)
  hold(await answers(other), 'the other browser still answers after that sweep')
  hold(P.processStart(o.pid) === token, 'the other browser has the same start token after that sweep')
  // a made up record that names the other browser truly, by its number, its start token and its own profile: that
  // profile lies outside the clone, so the record gives the sweep no leave
  fs.mkdirSync(path.join(work, 'browser-processes'), { recursive: true })
  const outside = path.join(work, 'browser-processes', `${o.pid}.json`)
  fs.writeFileSync(outside, JSON.stringify({ pid: o.pid, started: token, profile: o.profile }))
  const between = X.stopLeftBrowsers(work)
  await sleep(1500)
  hold(between === 0, `the sweep over a made up record with the other browser's true profile ended ${between} (wanted 0)`)
  hold(await answers(other), 'the other browser still answers after that sweep')

  // 3. the handoff's own browser, started as the tool starts it
  process.env[P.PROFILE_ENV] = root
  own = await B.launch({ local, headless: true })
  delete process.env[P.PROFILE_ENV]
  const w = await facts(own)
  const record = path.join(work, 'browser-processes', `${w.pid}.json`)
  say(`the handoff's own browser: process ${w.pid}, profile ${w.profile}`)
  hold(!!w.profile && inRoot(w.profile), "the handoff's own browser has its profile in the clone's own profile root")
  hold(fs.existsSync(record), "the handoff's own browser is on record with its process number, its start token and its profile")
  hold(P.stopVerifiedProcess({ pid: w.pid, started: P.processStart(w.pid) }, { stop: false, profile: w.profile }), "the handoff's own browser is known again by number, start token and profile, without being ended")
  hold(!P.stopVerifiedProcess({ pid: o.pid, started: token }, { stop: false, profile: w.profile }), "the other browser is not taken for the handoff's own under the handoff's profile")

  // 4. a made up record: the other browser's number and start token, under a profile name inside the clone
  const forged = path.join(work, 'browser-processes', `${o.pid}.json`)
  fs.writeFileSync(forged, JSON.stringify({ pid: o.pid, started: token, profile: path.join(root, 'playwright_chromiumdev_profile-madeup') }))

  // 5. the sweep with the handoff's own browser on record
  const gone = new Promise((r) => own.once('disconnected', () => r(true)))
  const second = X.stopLeftBrowsers(work)
  const ended = await Promise.race([gone, sleep(15000).then(() => false)])
  hold(second === 1, `the sweep with the handoff's own browser on record ended ${second} (wanted 1)`)
  hold(ended, "the handoff's own browser was ended by that sweep")
  hold(await answers(other), 'the other browser still answers after that sweep, though a made up record named its process number under a profile of this clone')
  hold(P.processStart(o.pid) === token, 'the other browser has the same start token after that sweep')
  hold(!fs.existsSync(record) && !fs.existsSync(forged), 'the sweep left no record of a browser behind')
  facts1 = `the sweep ended ${first} before and ${second} after the handoff's own browser was started; the other browser (process ${o.pid}) kept start token ${token} and still answers; ${/\s/.test(clone) ? "the clone's path holds a space" : "the clone's path holds no space"}`
} catch (e) {
  hold(false, `the check could not run to its end: ${String(e?.message ?? e).split('\n')[0]}`)
} finally {
  for (const b of [own, other]) {
    try {
      await b?.close()
    } catch {}
  }
}
const last = problems.length ? `PROBLEM: the other browser: ${problems.join('; ')}` : `the other browser: PASS on ${os.platform()}. MEASURED: ${facts1}`
say(last)
if (file) {
  try {
    fs.writeFileSync(file, lines.join('\n') + '\n')
  } catch {}
}
console.log(last)
