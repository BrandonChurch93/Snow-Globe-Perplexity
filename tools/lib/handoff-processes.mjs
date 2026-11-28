import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { rel } from './paths.mjs'

export const PROFILE_ENV = 'SHOWCASE_HANDOFF_PROFILE_ROOT'
export const profileRoot = (work) => path.join(work, 'browser-profiles')
const browserRecords = (work) => path.join(work, 'browser-processes')
const validPid = (pid) => Number.isSafeInteger(pid) && pid > 1
const normalPath = (file) => process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file)
const samePath = (a, b) => normalPath(a) === normalPath(b)

function windowsProcess(script) {
  const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const r = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8', timeout: 5000, windowsHide: true })
  return r.status === 0 ? r.stdout.trim() : ''
}

const winHandle = (pid) => `
$ErrorActionPreference = 'Stop'
$p = Get-Process -Id ${pid}
$null = $p.Handle
$started = $p.StartTime.ToUniversalTime().Ticks.ToString()
`

function processInfo(pid, command = false) {
  if (!validPid(pid)) return null
  try {
    if (process.platform === 'win32') {
      const started = windowsProcess(`${winHandle(pid)}\n$started`)
      return /^\d+$/.test(started) ? { started } : null
    }
    if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
      const fields = stat.slice(stat.lastIndexOf(') ') + 2).split(' ')
      const birth = fields[19]
      const boot = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()
      if (fields[0] === 'Z' || !/^\d+$/.test(birth) || !boot) return null
      const args = command ? fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0') : null
      return { started: `${boot}:${birth}`, args }
    }
    const r = spawnSync('/bin/ps', ['-ww', '-p', String(pid), '-o', 'state=', '-o', 'lstart=', '-o', 'command='], { encoding: 'utf8', timeout: 5000, env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' } })
    if (r.status !== 0) return null
    const m = /^\s*(\S+)\s+(\w+ \w+ +\d+ \d\d:\d\d:\d\d \d+)\s+(.+)$/.exec(r.stdout.trim())
    return m && !m[1].includes('Z') ? { started: m[2], command: m[3] } : null
  } catch {
    return null
  }
}

export const processStart = (pid) => processInfo(pid)?.started ?? null

function winMatches(record, stop, profile) {
  if (!/^\d+$/.test(record.started)) return false
  const checkProfile = profile ? String.raw`
$arg = '--user-data-dir=' + [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(profile).toString('base64')}'))
$line = (Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}').CommandLine
$exactArg = [Regex]::Escape($arg)
if ($line -notmatch ('(?:^|\s)(?:"' + $exactArg + '"|' + $exactArg + ')(?=\s|$)')) { exit 1 }
` : ''
  return windowsProcess(`${winHandle(record.pid)}
if ($started -cne '${record.started}') { exit 1 }
${checkProfile}
if ($p.HasExited) { exit 1 }
${stop ? '$p.Kill()' : ''}
'matched'
`) === 'matched'
}

/** A process number alone proves nothing: a recycled number belongs to whoever started it next. */
export function stopVerifiedProcess(record, { stop = true, profile = null } = {}) {
  if (!validPid(record?.pid) || record.pid === process.pid || typeof record.started !== 'string' || !record.started) return false
  try {
    if (process.platform === 'win32') return winMatches(record, stop, profile)
    const seen = processInfo(record.pid, !!profile)
    if (!seen || seen.started !== record.started) return false
    if (profile) {
      const arg = `--user-data-dir=${profile}`
      const quoted = arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const macMatch = () => new RegExp(`(?:^|\\s)${quoted}(?=\\s+--|$)`).test(seen.command)
      if (!(seen.args ? seen.args.includes(arg) : macMatch())) return false
    }
    if (stop) process.kill(record.pid, 'SIGKILL')
    return true
  } catch {
    return false
  }
}

const validProfile = (work, profile) => typeof profile === 'string' && path.isAbsolute(profile) && samePath(path.dirname(profile), profileRoot(work)) && /^playwright_chromiumdev_profile-[A-Za-z0-9_-]+$/.test(path.basename(profile))

export function rememberBrowser(work, pid, profile) {
  const record = { pid, started: processStart(pid), profile }
  if (!validProfile(work, profile) || !stopVerifiedProcess(record, { stop: false, profile })) throw new Error('the handoff could not verify its browser process and profile')
  const folder = browserRecords(work)
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${pid}.json`)
  fs.writeFileSync(file, JSON.stringify(record))
  return () => {
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (saved.pid === pid && saved.started === record.started && saved.profile === profile) fs.rmSync(file)
    } catch {}
  }
}

export function endRememberedBrowsers(work) {
  if (!work) return 0
  const folder = browserRecords(work)
  let names
  try { names = fs.readdirSync(folder) } catch { return 0 }
  let ended = 0
  for (const name of names) {
    if (!/^\d+\.json$/.test(name)) continue
    const file = path.join(folder, name)
    try {
      if (!fs.lstatSync(file).isFile()) continue
      const record = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (name === `${record.pid}.json` && validProfile(work, record.profile) && stopVerifiedProcess(record, { profile: record.profile })) ended++
      fs.rmSync(file)
    } catch {}
  }
  return ended
}

// Only the handoff uses this branch. It keeps Playwright's normal, temporary browser context and flags.
let launchTail = Promise.resolve()
export function launchHandoffBrowser(chromium, options, wanted) {
  const launch = async () => {
    const work = rel('out', 'work', 'handoff')
    const root = profileRoot(work)
    if (!samePath(root, wanted)) throw new Error('the handoff browser profile must be inside this clone')
    fs.mkdirSync(root, { recursive: true })
    if (!samePath(root, fs.realpathSync(root))) throw new Error('the handoff browser profile folder points outside its place')
    const saved = { ...process.env }
    const temp = ['TMPDIR', 'TMP', 'TEMP']
    let browser
    try {
      for (const key of temp) process.env[key] = root
      if (!samePath(root, os.tmpdir())) throw new Error('the handoff could not set the browser profile folder')
      browser = await chromium.launch({ ...options, env: options.env ?? saved })
    } finally {
      for (const key of temp) {
        if (saved[key] === undefined) delete process.env[key]
        else process.env[key] = saved[key]
      }
    }
    try {
      const session = await browser.newBrowserCDPSession()
      const [{ processInfo: list }, { arguments: args }] = await Promise.all([
        session.send('SystemInfo.getProcessInfo'),
        session.send('Browser.getBrowserCommandLine'),
      ])
      await session.detach()
      const pid = list.find(({ type }) => type.toLowerCase() === 'browser')?.id
      const profile = args.find((arg) => arg.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length)
      browser.once('disconnected', rememberBrowser(work, pid, profile))
      return browser
    } catch (e) {
      await browser.close().catch(() => {})
      throw e
    }
  }
  const pending = launchTail.then(launch)
  launchTail = pending.catch(() => {})
  return pending
}
