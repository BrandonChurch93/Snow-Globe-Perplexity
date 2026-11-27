import { afterEach, describe, expect, it } from 'vitest'
import { STRICT_INIT } from '../tools/lib/strict.mjs'

/**
 * The strict run reads a row that is not the plain picture by its answers (tools/strict.mjs): the same mode drawn with
 * an open case answering no number, 0, 0.577 and 1e30. That reading holds only while the four builds are the same shader but
 * for that one answer: the same wrappers, the same tests, the same names put over the same functions. This is that.
 */

const SOURCE = `#version 300 es
precision highp float;
uniform float a;
out vec4 colour;
void main() {
  colour = vec4(pow(a, 2.0), sqrt(a), smoothstep(a, a, 0.5), isnan(a) ? 1.0 : 0.0);
}`

type Scope = { window?: unknown; WebGL2RenderingContext?: unknown }
const scope = globalThis as Scope
const kept: Scope = { window: scope.window, WebGL2RenderingContext: scope.WebGL2RenderingContext }

/** What STRICT_INIT hands to WebGL for SOURCE under `mode`, and what it says of itself. */
function rewritten(mode: string): { source: string; shaders: number; missed: number } {
  let handed = ''
  const page: { __strict?: { shaders: number; missed: number } } = {}
  const proto = { shaderSource(_shader: unknown, source: string) { handed = source } }
  scope.window = page
  scope.WebGL2RenderingContext = { prototype: proto }
  ;(STRICT_INIT as (mode: string) => void)(mode)
  proto.shaderSource({}, SOURCE)
  return { source: handed, shaders: page.__strict!.shaders, missed: page.__strict!.missed }
}

afterEach(() => {
  scope.window = kept.window
  scope.WebGL2RenderingContext = kept.WebGL2RenderingContext
})

describe('the four answers of the strict rule', () => {
  for (const mode of ['pow', 'all+smooth', 'all+smooth+noguard']) {
    it(`${mode}: the builds with no number, 0, 0.577 and 1e30 differ in one line, the answer`, () => {
      const none = rewritten(mode)
      const zero = rewritten(`${mode}+as0`)
      const unit = rewritten(`${mode}+asunit`)
      const big = rewritten(`${mode}+asbig`)
      for (const r of [none, zero, unit, big]) expect([r.shaders, r.missed]).toEqual([1, 0])
      const lines = (r: { source: string }) => r.source.split('\n')
      expect(lines(zero).length).toBe(lines(none).length)
      expect(lines(unit).length).toBe(lines(none).length)
      expect(lines(big).length).toBe(lines(none).length)
      const differs = (r: { source: string }) => lines(none).map((l, i) => [l, lines(r)[i]] as const).filter(([a, b]) => a !== b)
      expect(differs(zero)).toEqual([['float sm_nan() { return intBitsToFloat(2143289344); }', 'float sm_nan() { return 0.0; }']])
      expect(differs(unit)).toEqual([['float sm_nan() { return intBitsToFloat(2143289344); }', 'float sm_nan() { return 0.57735027; }']])
      expect(differs(big)).toEqual([['float sm_nan() { return intBitsToFloat(2143289344); }', 'float sm_nan() { return 1.0e30; }']])
    })
  }

  it('the answer is the one every open case gives: each wrapper of the mode reaches it', () => {
    const { source } = rewritten('all+smooth')
    const wrappers = source.split('\n').filter((l) => /^(float|vec[234]) sm_\w+\(/.test(l) && !l.startsWith('float sm_nan()'))
    expect(wrappers.length).toBeGreaterThan(30)
    // A wrapper answers through sm_nan() itself or through the float wrapper of its own name, part by part.
    for (const l of wrappers) expect(/sm_nan\(\)|sm_\w+\([^)]*\.[xyzw]|return atan\(y\)/.test(l), l).toBe(true)
    expect(source).toContain('#define pow sm_pow')
    expect(source).toContain('#define smoothstep sm_smoothstep')
  })
})
