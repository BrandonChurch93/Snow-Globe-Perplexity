// Run inside the clone after the lines of the handoff file: lists what is on the Desktop and gathers the reports,
// the logs and the small files for the uploaded artifact. node after.mjs <folder of the artifact>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
// Called a last time by the verdict step, from anywhere: the clone is where the flow said it is, and what the flow
// has noted already is not noted twice.
const last = process.argv[3] === 'last'
let here = process.cwd()
if (last) {
  try {
    here = fs.readFileSync(path.join(out, 'clone-path.txt'), 'utf8').trim()
  } catch {
    process.exit(0)
  }
}
let noted = ''
try {
  noted = fs.readFileSync(path.join(out, 'notes.txt'), 'utf8')
} catch {}
const quiet = last && /^Desktop: /m.test(noted)
const X = await import(pathToFileURL(path.join(here, 'tools', 'lib', 'handoff-machine.mjs')).href)
const notes = []
const note = (t) => {
  console.log(t)
  notes.push(t)
}
let desktop = ''
try {
  desktop = X.readMachine().desktop
} catch (e) {
  note(`the Desktop could not be read: ${e.message}`)
}
note(`Desktop: ${desktop}`)
const MOST = 60e6
const take = (file, as = path.basename(file)) => {
  try {
    const size = fs.statSync(file).size
    if (size > MOST) return note(`not gathered, ${(size / 1e6).toFixed(1)} MB: ${file}`)
    fs.copyFileSync(file, path.join(out, as))
  } catch {}
}
const walk = (dir, depth = 0) => {
  let names = []
  try {
    names = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of names) {
    const p = path.join(dir, e.name)
    if (!e.name.startsWith('Snow Globe Seasons')) continue
    if (e.isDirectory()) {
      note(`on the Desktop: ${e.name}/`)
      if (depth === 0) for (const f of fs.readdirSync(p)) {
        const s = fs.statSync(path.join(p, f))
        note(`on the Desktop: ${e.name}/${f}  ${s.size} bytes`)
        take(path.join(p, f), `desktop-folder - ${f}`)
      }
    } else {
      note(`on the Desktop: ${e.name}  ${fs.statSync(p).size} bytes`)
      take(p, `desktop - ${e.name}`)
    }
  }
}
if (desktop) walk(desktop)
const H = path.join(here, 'out', 'work', 'handoff')
try {
  for (const n of fs.readdirSync(H)) if (/^(report-.*\.txt|job-.*\.(log|out|stderr|stdout)|.*\.json)$/.test(n)) take(path.join(H, n), `handoff - ${n}`)
} catch {}
// what the shader compiler wrote, the shaders it wrote about, and the pictures the short test compared
for (const n of ['shader-messages-doctor.txt', 'shader-messages-test.txt']) take(path.join(H, n), `handoff - ${n}`)
for (const dir of ['shaders-doctor', 'shaders-test', 'compared']) {
  try {
    const names = fs.readdirSync(path.join(H, dir))
    if (names.length) fs.mkdirSync(path.join(out, dir), { recursive: true })
    for (const n of names) take(path.join(H, dir, n), path.join(dir, n))
  } catch {}
}
if (!quiet) fs.appendFileSync(path.join(out, 'notes.txt'), notes.join('\n') + '\n')
