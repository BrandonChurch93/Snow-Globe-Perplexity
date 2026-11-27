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

  /**
   * The glass's ring at the limb: the third face's branch is not taken there (s3 is 1 or more), yet its asin and its
   * sqrt stood in the shader with that input, outside -1 to 1 and below zero. With those two calls answered as a card
   * may answer them, 10881 pixels of the winter's shaken picture moved at the limb; with the inputs held, 2 (the snow).
   * So in the glass every asin and acos takes an input held inside -1 to 1, and every sine made from a cosine takes
   * the root of a number held at zero. Two inputs are left bare because they cannot leave the domain: inGlass is
   * si / glassIor with si a length of at most 1, and s2 is inGlass / second.face, at most 1 / (glassIor * second.face),
   * which the test holds below 1 from the numbers themselves.
   */
  it('holds the glass\'s asin, acos and roots inside their domains', () => {
    const file = join('src', 'globe', 'shell.ts')
    const text = readFileSync(file, 'utf8')
    const open: string[] = []
    const at = (i: number): number => text.slice(0, i).split('\n').length
    let arcs = 0
    for (const m of text.matchAll(/(?<![\w.])(asin|acos)\(/g)) {
      const got = splitArgs(text, m.index + m[0].length)
      const arg = got && got.args.length === 1 ? got.args[0]!.trim() : ''
      arcs++
      if (m[1] === 'asin' && (arg === 'inGlass' || arg === 's2')) continue
      const held = wholeCall(arg, 'clamp(')
      const lo = held && held.length === 3 ? Number(held[1]) : NaN
      const hi = held && held.length === 3 ? Number(held[2]) : NaN
      if (!(lo >= -1 && hi <= 1 && lo < hi)) open.push(`${file}:${at(m.index)}: ${m[1]}(${arg.slice(0, 60)})`)
    }
    let roots = 0
    for (const m of text.matchAll(/(?<![\w.])sqrt\(/g)) {
      const got = splitArgs(text, m.index + m[0].length)
      const arg = got && got.args.length === 1 ? got.args[0]!.trim() : ''
      if (!/1\.0 - (\w+) \* \1\b/.test(arg)) continue
      roots++
      if (/\bs2 \* s2\b/.test(arg)) continue
      if (!cannotBeNegative(arg)) open.push(`${file}:${at(m.index)}: sqrt(${arg.slice(0, 60)})`)
    }
    const ior = Number(/"glassIor": ([\d.]+)/.exec(readFileSync(join('config', 'showcase.json'), 'utf8'))?.[1])
    const face = Number(/second: \{ face: ([\d.]+)/.exec(text)?.[1])
    expect(ior).toBeGreaterThan(1)
    expect(1 / (ior * face)).toBeLessThan(1)
    expect(text).toContain('float inGlass = si / GLASS_IOR;')
    expect(text).toContain('float s2 = inGlass / ${num(glassLook.second.face)};')
    expect(arcs).toBeGreaterThanOrEqual(6)
    expect(roots).toBeGreaterThanOrEqual(4)
    expect(open).toEqual([])
  })

  it('tells a held input of asin from an open one', () => {
    expect(cannotBeNegative('max(1.0 - s3 * s3, 0.0)')).toBe(true)
    expect(cannotBeNegative('1.0 - s3 * s3')).toBe(false)
    expect(cannotBeNegative('max(1.0 - s3 * s3, -1.0)')).toBe(false)
  })
})
