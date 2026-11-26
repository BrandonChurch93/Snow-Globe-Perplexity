import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * GLSL leaves pow(x, y) open when x is below zero. A software renderer answers with a number and the picture looks
 * right; Apple's graphics cards answer with no number at all, which the glass's shoulder then turns into a flat bright
 * sheet across the whole globe. So no shader of this build may hand pow a base that can be negative.
 */

const SAFE_HEADS = ['abs(', 'fract(', 'smoothstep(', 'saturate(', 'length(', 'exp(', 'exp2(']
const NUMBER = /^\d+(\.\d*)?(e-?\d+)?$/

function splitArgs(s: string, from: number): { args: string[]; end: number } | null {
  let depth = 0
  let start = from
  const args: string[] = []
  for (let j = from; j < s.length; j++) {
    const c = s[j]
    if (c === '$' && s[j + 1] === '{') {
      let open = 1
      j += 2
      while (j < s.length && open) {
        if (s[j] === '{') open++
        else if (s[j] === '}') open--
        j++
      }
      j--
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      if (depth === 0) {
        args.push(s.slice(start, j))
        return { args, end: j }
      }
      depth--
    } else if (c === ',' && depth === 0) {
      args.push(s.slice(start, j))
      start = j + 1
    }
  }
  return null
}

function wholeCall(a: string, head: string): string[] | null {
  if (!a.startsWith(head)) return null
  const got = splitArgs(a, head.length)
  return got && got.end === a.length - 1 ? got.args : null
}

export function cannotBeNegative(base: string): boolean {
  const a = base.trim()
  if (NUMBER.test(a)) return true
  if (SAFE_HEADS.some((h) => wholeCall(a, h))) return true
  const max = wholeCall(a, 'max(')
  if (max && max.some((x) => NUMBER.test(x.trim()))) return true
  const clamp = wholeCall(a, 'clamp(')
  if (clamp && clamp.length === 3 && NUMBER.test(clamp[1]!.trim())) return true
  return false
}

/** The probe's own test of the card, which asks these very questions on purpose and draws nothing of the picture. */
const ASKS = join('core', 'maths.ts')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sources(path))
    else if (path.endsWith('.ts')) out.push(path)
  }
  return out
}

describe('shader arithmetic', () => {
  it('knows a base that cannot be negative from one that can', () => {
    expect(cannotBeNegative('abs((s - 0.9655) / 0.0022)')).toBe(true)
    expect(cannotBeNegative('max(dot(n, l), 0.0)')).toBe(true)
    expect(cannotBeNegative('clamp(x, 0.0, 1.0)')).toBe(true)
    expect(cannotBeNegative('fract(h.w * 37.0)')).toBe(true)
    expect(cannotBeNegative('(s - 0.9655) / 0.0022')).toBe(false)
    expect(cannotBeNegative('1.0 - nv')).toBe(false)
    expect(cannotBeNegative('abs(a) - abs(b)')).toBe(false)
    expect(cannotBeNegative('clamp(x, -1.0, 1.0)')).toBe(false)
    expect(cannotBeNegative('max(a, b)')).toBe(false)
  })

  it('never hands pow a base that can be negative', () => {
    const open: string[] = []
    let calls = 0
    for (const file of sources('src')) {
      if (file.endsWith(ASKS)) continue
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/(?<![\w.])pow\(/g)) {
        const got = splitArgs(text, m.index + m[0].length)
        if (!got || got.args.length !== 2) {
          open.push(`${file}: a pow call that could not be read`)
          continue
        }
        calls++
        if (!cannotBeNegative(got.args[0]!)) open.push(`${file}:${text.slice(0, m.index).split('\n').length}: pow(${got.args[0]!.trim().slice(0, 60)}, ...)`)
      }
    }
    expect(calls).toBeGreaterThan(200)
    expect(open).toEqual([])
  })
})
