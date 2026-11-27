import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const rel = (...p) => path.join(ROOT, ...p)
export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
export const writeJson = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
}
export const loadConfig = () => readJson(rel('config', 'showcase.json'))

// `--no-air` is `npm run still`'s alone (`aid`). Every other tool reads its flags here, and so a gate, a guard, a measure,
// a film or a poster stops on it before it draws anything.
export function parseArgs(argv, { aid = false } = {}) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out[key] = true
      else {
        out[key] = next
        i++
      }
    } else out._.push(a)
  }
  if ('no-air' in out && !aid) throw new Error('--no-air is a measuring aid of `npm run still` alone. No gate, guard, measure, judged still, film or poster is drawn without the air, and nothing was drawn.')
  return out
}

export function bootId() {
  try {
    return fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()
  } catch {
    return 'no-boot-id'
  }
}

export function replaceSection(markdown, heading, body) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`)
  if (start < 0) throw new Error(`section not found: ${heading}`)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  }
  const head = lines.slice(0, start + 1)
  const tail = lines.slice(end)
  return [...head, '', ...body.trimEnd().split('\n'), '', ...tail].join('\n')
}

export function readSection(markdown, heading) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  }
  return lines.slice(start + 1, end).join('\n').trim()
}
