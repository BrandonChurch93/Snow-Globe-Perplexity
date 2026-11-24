import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { rel, loadConfig, parseArgs, writeJson, readJson } from './lib/paths.mjs'
import { fileSha, listFiles, sha256 } from './lib/hashes.mjs'

const cfg = loadConfig()
const FILE = rel('parts', 'PARTS.json')
const first = cfg.seasons[0]
const head = () => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: rel('.'), encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

export function partList() {
  const out = []
  const add = (name, unit, files) => out.push({ name, unit, files })
  add('glass', first, ['src/globe/shell.ts'])
  add('liquid', first, ['src/globe/shell.ts', 'src/globe/liquid.ts'])
  add('surface', first, ['src/scene/surface.ts'])
  add('backdrop', first, ['src/scene/backdrop.ts'])
  add('lens', first, ['src/scene/cameras.ts', 'src/post'])
  add('shake', first, ['src/shake/table.ts'])
  add('particle-engine', first, ['src/particles'])
  add('light-engine', first, ['src/scene/lightgrid.ts', 'src/scene/stage.ts', 'src/core/materials.ts'])
  const seen = new Set()
  for (const s of cfg.seasons) {
    for (const p of ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'arrival']) add(`${p}-${s}`, s, [`src/seasons/${s}`, `public/assets/${s}`])
    for (const k of cfg.particles[s]) {
      if (seen.has(k.kind)) continue
      seen.add(k.kind)
      add(`particle-${k.kind}`, s, ['src/particles/draw', 'src/particles/engine', `src/seasons/${s}`])
    }
  }
  for (const shot of cfg.film.shots) if (shot.kind === 'shake') add(`change-${shot.from}-${shot.to}`, 'change', ['src/shake/change.ts', `src/seasons/${shot.from}`, `src/seasons/${shot.to}`])
  for (const n of ['interface', 'sound-engine', 'quality-levels']) add(n, 'globe', n === 'interface' ? ['src/ui'] : n === 'sound-engine' ? ['src/audio'] : ['src/core'])
  add('opening', 'film', ['src/film'])
  add('loop', 'film', ['src/film', 'src/particles'])
  return out
}

export function filesHash(files) {
  const list = files.flatMap((f) => {
    const p = rel(f)
    if (!fs.existsSync(p)) return []
    return fs.statSync(p).isDirectory() ? listFiles(p) : [p]
  })
  return sha256(list.map((f) => `${path.relative(rel(), f).split(path.sep).join('/')}:${fileSha(f)}`).join('\n')).slice(0, 16)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2))
  const existing = fs.existsSync(FILE) ? readJson(FILE) : { parts: [] }
  const byName = new Map(existing.parts.map((p) => [p.name, p]))
  if (args.set) {
    const [name, state] = String(args.set).split('=')
    const p = byName.get(name)
    if (!p) throw new Error(`no such part: ${name}`)
    const allowed = ['stand-in', 'built', 'fallback', 'general fallback', 'last resort']
    if (!allowed.includes(state)) throw new Error(`state must be one of: ${allowed.join(', ')}`)
    p.state = state
    p.commit = head()
    if (args.note) p.note = String(args.note)
    writeJson(FILE, existing)
    console.log(`${name}: ${state}`)
  } else if (args.list) {
    for (const p of existing.parts) console.log(`${p.state.padEnd(16)} ${p.unit.padEnd(8)} ${p.name}`)
  } else {
    const parts = partList().map((p) => {
      const old = byName.get(p.name)
      const hash = filesHash(p.files)
      if (old) return { ...old, unit: p.unit, files: p.files, standInHash: old.state === 'stand-in' ? hash : old.standInHash }
      return { name: p.name, unit: p.unit, state: 'stand-in', files: p.files, standInHash: hash, commit: head() }
    })
    writeJson(FILE, { parts })
    const n = parts.filter((p) => p.state === 'stand-in').length
    console.log(`parts register: ${parts.length} parts, ${n} stand-ins`)
  }
}
