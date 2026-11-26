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

// atan(0, 0) is as open as normalize of no length. An angle about an axis is asked of two components of one vector,
// and the vector is tested first. A call that is sure by another road stands here with the road, and where the road is
// a line above the call, that line is looked for.
const ANGLE_SURE: [file: string, call: string, above: RegExp | null, why: string][] = [
  [join('globe', 'shell.ts'), 'atan(dot(d, WIN_A), z)', /if \(z < 0\.[2-9]\d*\) return/, 'z is over 0.2 by the return above'],
  [join('globe', 'shell.ts'), 'atan(dot(d, WIN_B), z)', /if \(z < 0\.[2-9]\d*\) return/, 'z is over 0.2 by the return above'],
  [join('globe', 'shell.ts'), 'atan(dot(d, STRIP_A), z)', /if \(z < 0\.[2-9]\d*\) return/, 'z is over 0.2 by the return above'],
  [join('globe', 'shell.ts'), 'atan(dot(d, STRIP_B), z)', /if \(z < 0\.[2-9]\d*\) return/, 'z is over 0.2 by the return above'],
  [join('globe', 'shell.ts'), 'atan(dot(seen, WIN_A), seenZ)', /seenZ > 0\.2 \? $/, 'seenZ is over 0.2 by its branch'],
  [join('globe', 'shell.ts'), 'atan(st, cw)', null, 'sine and cosine of one angle'],
  [join('globe', 'shell.ts'), 'atan(si, ci)', null, 'sine and cosine of one angle'],
  [join('particles', 'draw', 'cards.ts'), 'atan(fanAt.y, abs(fanAt.x) + abs(fanAt.y) > 0.0 ? fanAt.x : 1.0)', null, 'the second is 1 where both are 0'],
  [ASKS, 'atan(0, 0)', null, 'the question put to the machine'],
  [ASKS, 'atan(uZero, uZero)', null, 'the question put to the machine'],
]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : []
  })
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function twoArguments(arg: string): [string, string] | null {
  let depth = 0
  for (let j = 0; j < arg.length; j++) {
    if (arg[j] === '(' || arg[j] === '[') depth++
    else if (arg[j] === ')' || arg[j] === ']') depth--
    else if (arg[j] === ',' && depth === 0) return [arg.slice(0, j).trim(), arg.slice(j + 1).trim()]
  }
  return null
}

function angleTested(text: string, at: number, [a, b]: [string, string]): boolean {
  const first = /^-?([\w.[\]]+)\.([xyzw])$/.exec(a)
  const second = /^-?([\w.[\]]+)\.([xyzw])$/.exec(b)
  if (!first || !second || first[1] !== second[1] || first[2] === second[2]) return false
  const v = escaped(first[1])
  const pair = `(?:${first[2]}${second[2]}|${second[2]}${first[2]})`
  const whole = new RegExp(`\\bvec2 ${v}\\b`).test(text) ? `|${v}` : ''
  const before = text.slice(Math.max(0, at - 120), at)
  return (
    new RegExp(`dot\\((${v}\\.${pair}${whole}), \\1\\) > 0\\.0 \\? $`).test(before) ||
    new RegExp(`abs\\(${v}\\.[${first[2]}${second[2]}]\\) \\+ abs\\(${v}\\.[${first[2]}${second[2]}]\\) > 0\\.0 \\? $`).test(before)
  )
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

  it('asks an angle of two numbers only where they cannot both be nothing', () => {
    const open: string[] = []
    const met = new Set<number>()
    let tested = 0
    for (const file of sources('src')) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/(?<![\w.])atan\(/g)) {
        const arg = argument(text, m.index + m[0].length)
        const two = twoArguments(arg)
        if (!two) continue
        if (angleTested(text, m.index, two)) {
          tested++
          continue
        }
        const line = text.slice(0, m.index).split('\n').length
        const above = text.split('\n').slice(Math.max(0, line - 3), line - 1).join('\n') + '\n' + text.slice(text.lastIndexOf('\n', m.index) + 1, m.index)
        const sure = ANGLE_SURE.findIndex(([f, call, road]) => file.endsWith(f) && call === `atan(${arg})` && (!road || road.test(above)))
        if (sure < 0) open.push(`${file}:${line}: atan(${arg.trim().slice(0, 70)})`)
        else met.add(sure)
      }
    }
    expect(tested).toBeGreaterThan(20)
    expect(open).toEqual([])
    expect(ANGLE_SURE.filter((_, i) => !met.has(i)).map(([f, call]) => `${f}: ${call}`)).toEqual([])
  })
})
