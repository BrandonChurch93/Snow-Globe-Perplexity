import fs from 'node:fs'
import path from 'node:path'
import { rel } from './paths.mjs'

const dir = rel('out', 'work', 'looks')
const index = path.join(dir, 'index.jsonl')

export function readLooks() {
  if (!fs.existsSync(index)) return []
  return fs
    .readFileSync(index, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

export function addLook(file, caption, by = 'builder', { copy = false } = {}) {
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true })
  const looks = readLooks()
  const n = looks.length + 1
  let stored = file
  if (copy) {
    stored = path.join(dir, 'files', `${String(n).padStart(5, '0')}-${path.basename(file)}`)
    fs.copyFileSync(file, stored)
  }
  const entry = { n, file: path.relative(rel(), stored), caption, by, time: new Date().toISOString() }
  fs.appendFileSync(index, JSON.stringify(entry) + '\n')
  return entry
}

export function markShown(ns) {
  const shown = path.join(dir, 'shown.json')
  const prev = fs.existsSync(shown) ? JSON.parse(fs.readFileSync(shown, 'utf8')) : []
  fs.writeFileSync(shown, JSON.stringify([...new Set([...prev, ...ns])]))
}

export function shownSet() {
  const shown = path.join(dir, 'shown.json')
  return new Set(fs.existsSync(shown) ? JSON.parse(fs.readFileSync(shown, 'utf8')) : [])
}
