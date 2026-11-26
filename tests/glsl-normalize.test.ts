import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A bump that tilts a normal by `abs(det) * n - sign(det) * slope` has no length where `det` is exactly zero, which a
 * card whose shading normal lies in its own plane reaches at a rare sample. normalize of it is no number on every
 * machine, so the strict run, which compares two pictures, cannot see it. The vector is tested before it is normalized.
 */

const ASKS = join('core', 'maths.ts')

// Two of three components: the vector has no length on a whole line through the scene (the axis, straight up), which
// a camera, a ray or a vertex can meet. A vector of uniforms and numbers alone is the config's matter, not a sample's.
const FLAT = [/^[\w.[\]]+\.(xz|xy|yz)$/, /^cross\(vec3\([-\d., ]+\), [\w.]+\)$/, /^vec3\(-?[\w.]+, 0\.0, -?[\w.]+\)$/]
const FIXED = /^(?:(?:vec3|cross)\b|u[A-Z]\w*(?:\.[xyz]+)?|-?\d[\d.]*|[\s(),-])+$/
const TESTED = /dot\(([\w.[\]]+), \1\) > 0\.0 \? $/

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : []
  })
}

export function argument(text: string, from: number): string {
  let depth = 0
  for (let j = from; j < text.length; j++) {
    if (text[j] === '(') depth++
    else if (text[j] === ')' && depth-- === 0) return text.slice(from, j)
  }
  return text.slice(from)
}

describe('shader arithmetic: normalize', () => {
  it('reads the whole argument of a call', () => {
    expect(argument('normalize(abs(d) * n - sign(d) * (a + b)); x', 10)).toBe('abs(d) * n - sign(d) * (a + b)')
  })

  it('never normalizes a vector that a sign() can leave with no length', () => {
    const open: string[] = []
    let calls = 0
    for (const file of sources('src')) {
      if (file.endsWith(ASKS)) continue
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/(?<![\w.])normalize\(/g)) {
        calls++
        const arg = argument(text, m.index + m[0].length)
        if (/(?<![\w.])sign\(/.test(arg)) open.push(`${file}:${text.slice(0, m.index).split('\n').length}: normalize(${arg.trim().slice(0, 70)})`)
      }
    }
    expect(calls).toBeGreaterThan(300)
    expect(open).toEqual([])
  })

  it('tests a vector laid flat in a plane before it normalizes it', () => {
    const open: string[] = []
    let flat = 0
    for (const file of sources('src')) {
      if (file.endsWith(ASKS)) continue
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/(?<![\w.])normalize\(/g)) {
        const arg = argument(text, m.index + m[0].length).trim()
        if (!FLAT.some((form) => form.test(arg)) || FIXED.test(arg)) continue
        flat++
        if (!TESTED.test(text.slice(Math.max(0, m.index - 80), m.index))) open.push(`${file}:${text.slice(0, m.index).split('\n').length}: normalize(${arg.slice(0, 70)})`)
      }
    }
    expect(flat).toBeGreaterThan(8)
    expect(open).toEqual([])
  })
})
