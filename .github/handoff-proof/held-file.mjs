// Proof on a Windows machine that the tool's rename waits for a file another program holds.
// Another program (PowerShell) opens a file and shares it with no one for some seconds. A plain rename onto that
// file must fail at once; the tool's rename must wait and go through. Prints one line; a line that starts with
// PROBLEM is a failure of the proof.
//   node held-file.mjs <clone>
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const clone = path.resolve(process.argv[2] ?? '.')
if (process.platform !== 'win32') {
  console.log('a held file: not Windows, so not tried here')
  process.exit(0)
}
const plain = fs.renameSync
await import(pathToFileURL(path.join(clone, 'tools', 'lib', 'handoff-win-fs.mjs')).href)
const patientRename = fs.renameSync
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'held file '))
const target = path.join(dir, 'job.json')
const next = path.join(dir, 'job.json.tmp')
fs.writeFileSync(target, 'old\n')
fs.writeFileSync(next, 'new\n')
const HOLD_MS = 2500
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const holder = spawn(ps, ['-NoProfile', '-NonInteractive', '-Command', `$f = [System.IO.File]::Open(${q(target)}, 'Open', 'Read', 'None'); [Console]::Out.WriteLine('held'); [Console]::Out.Flush(); Start-Sleep -Milliseconds ${HOLD_MS}; $f.Close()`], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
const held = await new Promise((resolve) => {
  let said = ''
  holder.stdout.on('data', (d) => {
    said += d
    if (said.includes('held')) resolve(true)
  })
  holder.on('close', () => resolve(false))
  setTimeout(() => resolve(false), 30000)
})
let line
if (!held) line = 'PROBLEM: a held file: PowerShell did not open the file, so nothing was tried'
else {
  let plainSaid = 'went through'
  try {
    plain(next, target)
  } catch (e) {
    plainSaid = `answered ${e.code} at once`
  }
  if (plainSaid === 'went through') line = 'a held file: a plain rename went through although another program held the file, so this machine does not show the fault'
  else {
    const t0 = Date.now()
    let patientSaid
    try {
      patientRename(next, target)
      patientSaid = fs.readFileSync(target, 'utf8') === 'new\n' ? `went through after ${((Date.now() - t0) / 1000).toFixed(1)} s, when the file was let go` : 'PROBLEM went through and the file is not the new one'
    } catch (e) {
      patientSaid = `PROBLEM answered ${e.code} after ${((Date.now() - t0) / 1000).toFixed(1)} s`
    }
    line = `${patientSaid.startsWith('PROBLEM') ? 'PROBLEM: ' : ''}a held file: another program held a file for ${HOLD_MS / 1000} s. A plain rename onto it ${plainSaid}; the tool's rename ${patientSaid.replace(/^PROBLEM /, '')}`
  }
}
await new Promise((resolve) => (holder.exitCode === null ? holder.on('close', resolve) : resolve()))
try {
  fs.rmSync(dir, { recursive: true, force: true })
} catch {}
console.log(line)
