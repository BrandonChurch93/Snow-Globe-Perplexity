// What the render handoff reads from the machine it stands on: processor, memory, video cards, system, tools, power, Desktop.
// Nothing here is taken from a description of the machine: every line is read, and a line that cannot be read says so.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { findIn, pathDirs } from './handoff.mjs'

const WIN = process.platform === 'win32'
const MAC = process.platform === 'darwin'

export const powershellExe = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

/** Runs a PowerShell script from its text, without a shell and without quoting: the text travels encoded. */
export function powershell(script, { timeout = 120000 } = {}) {
  const encoded = Buffer.from(`$ProgressPreference = 'SilentlyContinue'\n${script}`, 'utf16le').toString('base64')
  const r = spawnSync(powershellExe(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 1 << 26 })
  if (r.error) throw new Error(`Windows PowerShell could not be started (${r.error.message})`)
  if (r.status !== 0) throw new Error(`Windows PowerShell ended with code ${r.status}: ${String(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')}`)
  return r.stdout
}

const run = (file, args, opts = {}) => {
  const r = spawnSync(file, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26, ...opts })
  return { ok: !r.error && r.status === 0, out: String(r.stdout ?? ''), err: String(r.stderr ?? ''), error: r.error ?? null }
}

const WINDOWS_FACTS = `
$ErrorActionPreference = 'Stop'
$p = @(Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, Manufacturer)
$c = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, TotalPhysicalMemory, HypervisorPresent
$v = @(Get-CimInstance Win32_VideoController | ForEach-Object { [pscustomobject]@{ Name = $_.Name; DriverVersion = $_.DriverVersion; DriverDate = $(if ($_.DriverDate) { ([datetime]$_.DriverDate).ToString('yyyy-MM-dd') } else { '' }); AdapterRAM = [int64]$_.AdapterRAM; VideoProcessor = $_.VideoProcessor; Status = $_.Status; PNPDeviceID = $_.PNPDeviceID } })
$o = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture
$b = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object BatteryStatus, EstimatedChargeRemaining)
$m = @{}
try { Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue | ForEach-Object { $q = $_.'HardwareInformation.qwMemorySize'; if ($q -and $_.DriverDesc) { $m[[string]$_.DriverDesc] = [int64]$q } } } catch {}
[pscustomobject]@{ processor = $p; system = $c; video = $v; os = $o; battery = $b; memory = $m; desktop = [Environment]::GetFolderPath('Desktop') } | ConvertTo-Json -Depth 6 -Compress
`

function windowsFacts() {
  const j = JSON.parse(powershell(WINDOWS_FACTS).trim())
  const list = (x) => (Array.isArray(x) ? x : x ? [x] : [])
  const procs = list(j.processor)
  const battery = list(j.battery)
  // Win32_Battery.BatteryStatus: 2 is on mains power, 1 is running down.
  const power = !battery.length ? 'mains power (the system names no battery)' : battery.some((b) => b.BatteryStatus === 1) ? `on battery (${battery[0].EstimatedChargeRemaining ?? '?'} % left)` : `mains power (battery at ${battery[0].EstimatedChargeRemaining ?? '?'} %)`
  return {
    os: `${j.os?.Caption ?? 'Windows'} ${j.os?.Version ?? ''} (build ${j.os?.BuildNumber ?? '?'}, ${j.os?.OSArchitecture ?? '?'})`.replace(/\s+/g, ' '),
    model: `${j.system?.Manufacturer ?? ''} ${j.system?.Model ?? ''}`.trim(),
    processor: { name: procs.map((p) => String(p.Name).trim()).join(' + ') || 'not named', cores: procs.reduce((n, p) => n + (p.NumberOfCores || 0), 0), threads: procs.reduce((n, p) => n + (p.NumberOfLogicalProcessors || 0), 0) },
    memoryBytes: Number(j.system?.TotalPhysicalMemory) || os.totalmem(),
    cards: list(j.video).map((v) => ({ name: String(v.Name ?? '').trim(), driverVersion: v.DriverVersion ?? '', driverDate: v.DriverDate ?? '', memoryBytes: Number(j.memory?.[v.Name]) || Number(v.AdapterRAM) || 0, memoryFrom: j.memory?.[v.Name] ? 'the registry' : 'AdapterRAM, which stops at 4 GB', status: v.Status ?? '' })),
    power,
    onBattery: battery.some((b) => b.BatteryStatus === 1),
    desktop: j.desktop || path.join(os.homedir(), 'Desktop'),
    readWith: 'Get-CimInstance Win32_Processor, Win32_ComputerSystem, Win32_VideoController, Win32_OperatingSystem, Win32_Battery',
  }
}

function macFacts() {
  const sysctl = (k) => run('/usr/sbin/sysctl', ['-n', k]).out.trim()
  const cards = []
  const sp = run('/usr/sbin/system_profiler', ['SPDisplaysDataType', '-json'], { timeout: 60000 })
  try {
    for (const c of JSON.parse(sp.out).SPDisplaysDataType ?? []) cards.push({ name: c.sppci_model ?? c._name ?? 'not named', driverVersion: c.spdisplays_mtlgpufamilysupport ? `Metal ${String(c.spdisplays_mtlgpufamilysupport).replace(/^spdisplays_/, '')}` : '', driverDate: '', memoryBytes: 0, memoryFrom: 'shared with the system', status: c.spdisplays_vendor ?? '' })
  } catch {}
  const batt = run('/usr/bin/pmset', ['-g', 'batt']).out
  const from = /Now drawing from '([^']+)'/.exec(batt)?.[1] ?? ''
  const pct = /(\d+)%/.exec(batt)?.[1]
  return {
    os: `macOS ${run('/usr/bin/sw_vers', ['-productVersion']).out.trim()} (build ${run('/usr/bin/sw_vers', ['-buildVersion']).out.trim()}, ${os.arch()})`,
    model: sysctl('hw.model'),
    processor: { name: sysctl('machdep.cpu.brand_string') || 'not named', cores: Number(sysctl('hw.physicalcpu')) || 0, threads: Number(sysctl('hw.logicalcpu')) || 0 },
    memoryBytes: Number(sysctl('hw.memsize')) || os.totalmem(),
    cards,
    power: from ? `${from === 'AC Power' ? 'mains power' : `on battery (${from})`}${pct ? `, battery at ${pct} %` : ''}` : 'not read (pmset gave no answer)',
    onBattery: !!from && from !== 'AC Power',
    desktop: path.join(os.homedir(), 'Desktop'),
    readWith: 'sysctl, sw_vers, system_profiler SPDisplaysDataType, pmset',
  }
}

function otherFacts() {
  const cpu = os.cpus()
  return { os: `${os.type()} ${os.release()} (${os.arch()})`, model: '', processor: { name: cpu[0]?.model ?? 'not named', cores: 0, threads: cpu.length }, memoryBytes: os.totalmem(), cards: [], power: 'not read on this system', onBattery: false, desktop: path.join(os.homedir(), 'Desktop'), readWith: "node's os module" }
}

/** The machine as it is, read now. */
export function readMachine() {
  return { platform: process.platform, ...(WIN ? windowsFacts() : MAC ? macFacts() : otherFacts()) }
}

// ---------------------------------------------------------------------------------------------------------------------
// Tools. A program installed a moment ago is not on the path of a terminal that was open before, so the places the
// installers use are looked in as well, and what is found there is put on the path of this process and its children.

function winPlaces() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  const pf = process.env.ProgramFiles || 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const packages = []
  for (const root of [path.join(local, 'Microsoft', 'WinGet', 'Packages'), path.join(pf, 'WinGet', 'Packages')]) {
    let names = []
    try {
      names = fs.readdirSync(root).filter((n) => /ffmpeg/i.test(n))
    } catch {}
    for (const n of names) {
      const dir = path.join(root, n)
      packages.push(path.join(dir, 'bin'))
      try {
        for (const sub of fs.readdirSync(dir)) packages.push(path.join(dir, sub, 'bin'))
      } catch {}
    }
  }
  return {
    ffmpeg: [path.join(local, 'Microsoft', 'WinGet', 'Links'), path.join(pf, 'WinGet', 'Links'), ...packages, path.join(pf, 'ffmpeg', 'bin'), 'C:\\ffmpeg\\bin', 'C:\\ProgramData\\chocolatey\\bin', path.join(os.homedir(), 'scoop', 'shims')],
    git: [path.join(pf, 'Git', 'cmd'), path.join(pf86, 'Git', 'cmd'), path.join(local, 'Programs', 'Git', 'cmd')],
    chrome: [path.join(pf, 'Google', 'Chrome', 'Application'), path.join(pf86, 'Google', 'Chrome', 'Application'), path.join(local, 'Google', 'Chrome', 'Application')],
  }
}
const macPlaces = () => ({ ffmpeg: ['/opt/homebrew/bin', '/usr/local/bin'], git: ['/usr/bin', '/opt/homebrew/bin', '/usr/local/bin'], chrome: ['/Applications/Google Chrome.app/Contents/MacOS', path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS')] })
const otherPlaces = () => ({ ffmpeg: ['/usr/bin', '/usr/local/bin'], git: ['/usr/bin'], chrome: ['/opt/google/chrome', '/usr/bin'] })

const exe = (name) => (WIN ? [`${name}.exe`] : [name])

/** Where a program is: on the path first, then in the places its installer uses. `from` says which. */
export function locate(name, kind = name) {
  const places = WIN ? winPlaces() : MAC ? macPlaces() : otherPlaces()
  const names = kind === 'chrome' ? (WIN ? ['chrome.exe'] : MAC ? ['Google Chrome'] : ['chrome', 'google-chrome', 'google-chrome-stable']) : exe(name)
  const onPath = kind === 'chrome' ? '' : findIn(pathDirs(process.env, process.platform), names)
  if (onPath) return { file: onPath, from: 'the path of this terminal' }
  const file = findIn(places[kind] ?? [], names)
  return file ? { file, from: 'the place its installer uses (this terminal does not have it on its path yet)' } : { file: '', from: '' }
}

/** Puts folders at the front of the path of this process, so that every child finds what was found. */
export function prependPath(dirs) {
  const key = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  const have = pathDirs(process.env, process.platform)
  const add = [...new Set(dirs.filter(Boolean))].filter((d) => !have.some((h) => path.resolve(h).toLowerCase() === path.resolve(d).toLowerCase()))
  if (add.length) process.env[key] = [...add, ...have].join(WIN ? ';' : ':')
  return add
}

/** npm's own program beside this node, started by this node: never the npm.cmd of Windows by its bare name. */
export function npmCli() {
  const dir = path.dirname(process.execPath)
  const tries = [path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), path.join(dir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  try {
    tries.push(path.join(path.dirname(fs.realpathSync(process.execPath)), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'))
  } catch {}
  return tries.find((f) => fs.existsSync(f)) ?? ''
}

const firstLine = (text) => String(text).split(/\r?\n/)[0] ?? ''

/** Every tool the render needs, with where it is and what it says of itself. Found tools are put on this process's path. */
export function readTools() {
  const out = { node: { file: process.execPath, version: process.version, from: 'this is the node that runs the tool' } }
  const npm = npmCli()
  out.npm = npm ? { file: npm, version: run(process.execPath, [npm, '--version']).out.trim(), from: 'beside this node' } : { file: '', version: '', from: '' }
  for (const name of ['git', 'ffmpeg', 'ffprobe']) {
    const at = locate(name, name === 'ffprobe' ? 'ffmpeg' : name)
    const said = at.file ? run(at.file, [name === 'git' ? '--version' : '-version']) : { ok: false, out: '' }
    out[name] = { ...at, version: said.ok ? firstLine(said.out).replace(/\s+Copyright.*$/, '') : '', runs: said.ok }
  }
  if (out.ffmpeg.runs) {
    const enc = run(out.ffmpeg.file, ['-hide_banner', '-encoders']).out
    out.ffmpeg.libx264 = /^\s*V\S*\s+libx264\s/m.test(enc)
    out.ffmpeg.aac = /^\s*A\S*\s+aac\s/m.test(enc)
  }
  out.chrome = locate('chrome', 'chrome')
  prependPath([out.ffmpeg.file, out.ffprobe.file, out.git.file].filter(Boolean).map((f) => path.dirname(f)))
  return out
}

/** The x264 a build of ffmpeg carries, read from what it encodes, for systems without ldd. */
export function x264Core(ffmpeg = 'ffmpeg') {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1', '-frames:v', '1', '-c:v', 'libx264', '-f', 'h264', '-'], { encoding: 'latin1', maxBuffer: 1 << 22, windowsHide: true })
  const m = !r.error && r.status === 0 ? /x264 - core (\d+)/.exec(r.stdout) : null
  return m ? `core ${m[1]}` : 'unknown'
}

export const freeBytes = (dir) => {
  const s = fs.statfsSync(dir)
  return s.bavail * s.bsize
}

/** True when two folders are on one drive, as far as the system says. */
export function sameDrive(a, b) {
  try {
    if (WIN) return path.parse(path.resolve(a)).root.toLowerCase() === path.parse(path.resolve(b)).root.toLowerCase()
    return fs.statSync(a).dev === fs.statSync(b).dev
  } catch {
    return true
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Awake.

const AWAKE_SCRIPT = (pid) => `
$sig = '[DllImport("kernel32.dll", SetLastError = true)] public static extern uint SetThreadExecutionState(uint esFlags);'
$k = Add-Type -MemberDefinition $sig -Name 'Awake' -Namespace 'SnowGlobe' -PassThru
# ES_CONTINUOUS 0x80000000, ES_SYSTEM_REQUIRED 0x00000001, ES_DISPLAY_REQUIRED 0x00000002
[void]$k::SetThreadExecutionState([uint32]2147483651)
Write-Output 'awake'
while (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 5 }
[void]$k::SetThreadExecutionState([uint32]2147483648)
`

/**
 * Keeps the machine and its screen awake for as long as process `pid` lives: on Windows a small PowerShell child that
 * holds SetThreadExecutionState, on macOS caffeinate. The child ends by itself when the process is gone.
 * @returns {Promise<{ how: string, pid: number | null, stop: () => void }>}
 */
export function keepAwake(pid = process.pid) {
  return new Promise((resolve) => {
    let child
    let how
    try {
      if (WIN) {
        const encoded = Buffer.from(AWAKE_SCRIPT(pid), 'utf16le').toString('base64')
        child = spawn(powershellExe(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
        how = 'a PowerShell child holds SetThreadExecutionState (system and display required)'
      } else if (MAC) {
        child = spawn('/usr/bin/caffeinate', ['-dims', '-w', String(pid)], { stdio: 'ignore' })
        how = 'caffeinate -dims holds the machine awake'
      } else return resolve({ how: 'nothing keeps this system awake (the tool knows no way here)', pid: null, stop: () => {} })
    } catch (e) {
      return resolve({ how: `the machine could not be kept awake (${e.message})`, pid: null, stop: () => {} })
    }
    const done = (ok, why = '') => resolve({ how: ok ? how : `the machine could not be kept awake (${why})`, pid: ok ? child.pid : null, stop: () => child.kill() })
    child.on('error', (e) => done(false, e.message))
    if (!WIN) return setTimeout(() => done(child.exitCode === null, 'caffeinate ended at once'), 300)
    const timer = setTimeout(() => done(false, 'PowerShell gave no answer in 60 s'), 60000)
    child.stdout.on('data', (d) => {
      if (String(d).includes('awake')) {
        clearTimeout(timer)
        done(true)
      }
    })
    child.on('exit', () => {
      clearTimeout(timer)
      done(false, 'PowerShell ended at once')
    })
  })
}

/** Stops the browsers a stopped render left behind: those the driver started with a profile of its own, and no other. */
export function stopLeftBrowsers() {
  try {
    if (WIN) {
      const out = powershell(`$n = 0; Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*playwright_chromiumdev_profile*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; $n++ } catch {} }; Write-Output $n`)
      return Number(out.trim()) || 0
    }
    const list = run('/usr/bin/pgrep', ['-f', 'playwright_chromiumdev_profile']).out.split('\n').map((l) => Number(l.trim())).filter((n) => n > 0 && n !== process.pid)
    for (const pid of list) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {}
    }
    return list.length
  } catch {
    return 0
  }
}

/** Whether a process with this number lives. */
export const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
