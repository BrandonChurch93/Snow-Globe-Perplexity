import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, rel, loadConfig } from './paths.mjs'

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex')
export const fileSha = (file) => sha256(fs.readFileSync(file))

export function listFiles(dir) {
  const out = []
  const walk = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name !== '.DS_Store' && e.name !== '.gitkeep') out.push(p)
    }
  }
  walk(dir)
  return out
}

export function hashList(files) {
  const h = crypto.createHash('sha256')
  for (const f of files) h.update(`${path.relative(ROOT, f).split(path.sep).join('/')}\0${fileSha(f)}\n`)
  return h.digest('hex').slice(0, 16)
}

/** Everything a rendered frame depends on: the source, the config, the packages, and the approved audio map when there is one, since the cut is fitted to it. */
export const engineFiles = (exists = (f) => fs.existsSync(f)) => [...listFiles(rel('src')), ...listFiles(rel('config')), rel('package-lock.json'), rel('cut', 'AUDIO-MAP.json')].filter((f) => exists(f))

export function engineHash() {
  return hashList(engineFiles())
}

const INDEX = rel('public', 'assets', 'index.json')
const groupFiles = (root, group) => listFiles(path.join(root, group))

export function buildAssetIndex() {
  const cfg = loadConfig()
  const groups = ['shared', ...cfg.seasons]
  const roots = { web: rel('public', 'assets'), full: rel('assets-full') }
  const sets = {}
  for (const [set, root] of Object.entries(roots)) {
    sets[set] = {}
    for (const g of groups) {
      sets[set][g] = groupFiles(root, g).map((f) => ({ path: path.relative(root, f).split(path.sep).join('/'), bytes: fs.statSync(f).size, sha: fileSha(f).slice(0, 16) }))
    }
  }
  const seasonHashes = {}
  for (const s of cfg.seasons) {
    seasonHashes[s] = hashList([...groupFiles(roots.web, 'shared'), ...groupFiles(roots.web, s), ...groupFiles(roots.full, 'shared'), ...groupFiles(roots.full, s)])
  }
  return { version: 1, sets, seasonHashes }
}

export function writeAssetIndex() {
  const index = buildAssetIndex()
  const text = JSON.stringify(index, null, 2) + '\n'
  fs.mkdirSync(path.dirname(INDEX), { recursive: true })
  if (!fs.existsSync(INDEX) || fs.readFileSync(INDEX, 'utf8') !== text) fs.writeFileSync(INDEX, text)
  return index
}

export function approvedPresent() {
  const cfg = loadConfig()
  return cfg.keys.map((k) => k.image).filter((p) => fs.existsSync(rel(p)))
}

export function packageVersions() {
  const pkg = JSON.parse(fs.readFileSync(rel('package.json'), 'utf8'))
  return { ...pkg.dependencies, ...pkg.devDependencies }
}
