import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { sha256File } from './handoff.mjs'

export const BUNDLE_RECORDS = 'failed-test-ownership'
const sumOf = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const digest = (value) => /^[a-f0-9]{64}$/.test(value ?? '')
const present = (p) => {
  try { return fs.lstatSync(p) } catch (e) { if (e.code === 'ENOENT') return null; throw e }
}
const safeName = (name) => name !== '.' && name !== '..' && name === path.posix.basename(name) && name === path.win32.basename(name)

export function fileMatches(file, sha256, bytes = null) {
  if (!digest(sha256)) return false
  try {
    const stat = fs.lstatSync(file)
    return stat.isFile() && (bytes === null || stat.size === bytes) && sha256File(file) === sha256
  } catch {
    return false
  }
}

function recordPath(work, folder) {
  return path.join(work, BUNDLE_RECORDS, `${sumOf(path.resolve(folder))}.json`)
}

function readOwned(work, folder, stat) {
  try {
    const record = JSON.parse(fs.readFileSync(recordPath(work, folder), 'utf8'))
    if (record.folder === path.resolve(folder) && record.dev === stat.dev && record.ino === stat.ino && Array.isArray(record.files)) return record
  } catch {}
  return null
}

function saveOwned(work, folder, record) {
  const file = recordPath(work, folder)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(record))
  fs.renameSync(tmp, file)
}

/** A Desktop folder with any other or altered entry stays wholly as it is. */
export function discardBundle(work, folder, say) {
  const stat = present(folder)
  if (!stat) return true
  if (!stat.isDirectory()) {
    say(`left ${folder} alone: it is not a regular folder`)
    return false
  }
  const record = readOwned(work, folder, stat)
  const names = fs.readdirSync(folder)
  const notOurs = names.filter((name) => !safeName(name) || !fileMatches(path.join(folder, name), record?.files.find((f) => f.name === name)?.sha256))
  if (notOurs.length) {
    say(`left ${folder} alone: it has other or changed files: ${notOurs.join(', ')}`)
    return false
  }
  if (!record) return true
  for (const name of names) {
    const file = path.join(folder, name)
    if (!fileMatches(file, record.files.find((f) => f.name === name)?.sha256)) {
      say(`left ${file} alone: it changed during cleanup`)
      return false
    }
    fs.unlinkSync(file)
  }
  if (record.made) fs.rmdirSync(folder)
  fs.rmSync(recordPath(work, folder), { force: true })
  say(`removed the recorded files of the earlier failed test from ${folder}`)
  return true
}

export function startBundle(work, folder, say) {
  if (!discardBundle(work, folder, say)) return false
  let stat = present(folder)
  const made = !stat
  if (made) {
    fs.mkdirSync(folder)
    stat = fs.lstatSync(folder)
  }
  if (!stat.isDirectory() || fs.readdirSync(folder).length) return false
  saveOwned(work, folder, { folder: path.resolve(folder), dev: stat.dev, ino: stat.ino, made, files: [] })
  return true
}

export function addBundleFile(work, folder, name, put) {
  const stat = fs.lstatSync(folder)
  const record = stat.isDirectory() ? readOwned(work, folder, stat) : null
  if (!record || !safeName(name) || record.files.some((f) => f.name === name)) throw new Error('the test bundle is not the folder the handoff prepared')
  const to = path.join(folder, name)
  put(to)
  record.files.push({ name, sha256: sha256File(to) })
  saveOwned(work, folder, record)
}

export function unexpectedEntries(folder, names) {
  const stat = present(folder)
  if (!stat) return []
  if (!stat.isDirectory()) return [folder]
  return fs.readdirSync(folder).filter((name) => !names.includes(name))
}
