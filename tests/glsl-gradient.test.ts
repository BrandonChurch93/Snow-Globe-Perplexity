import { describe, expect, it } from 'vitest'
import { LIGHT_FRAG_PARS } from '../src/core/chunks/light'
import { VEIL_FRAG_PARS } from '../src/core/chunks/veil'

/**
 * A read that takes its level of detail from the picture (texture(), dFdx, dFdy, fwidth) is not defined inside a loop
 * that can end early, nor under Direct3D in one that follows an early return (Microsoft's warning X3595): there one
 * card may read another level than the next. The reads below sit in such loops and their textures have one level, so
 * each names that level itself and every card reads the same. A shadow map is read with textureGrad and no gradient:
 * of its reads that one alone is written for Direct3D without a gradient instruction.
 */

const TEXT = LIGHT_FRAG_PARS + VEIL_FRAG_PARS
const IMPLICIT = /(?<![\w.])(?:texture|texture2D|textureProj|dFdx|dFdy|fwidth)\s*\(/

const functions = new Map<string, string>()
for (const m of TEXT.matchAll(/^(?:float|vec[234]|mat[34]|void|bool|int) (\w+)\([^)]*\) \{\n([\s\S]*?)\n\}$/gm)) functions.set(m[1]!, (functions.get(m[1]!) ?? '') + m[2]!)

/** Every function of the two chunks that `text` calls, and what those call. */
function reached(text: string, seen = new Set<string>()): Set<string> {
  for (const m of text.matchAll(/\b(\w+)\s*\(/g)) {
    const name = m[1]!
    if (!functions.has(name) || seen.has(name)) continue
    seen.add(name)
    reached(functions.get(name)!, seen)
  }
  return seen
}

describe('shader reads in loops that can end early', () => {
  it('finds a read that takes its level from the picture, and not one that names it', () => {
    expect('a = texture(m, p);').toMatch(IMPLICIT)
    expect('w = fwidth (d);').toMatch(IMPLICIT)
    expect('a = textureLod(m, p, 0.0) + textureGrad(m, p, vec2(0.0), vec2(0.0)) + texelFetch(m, i, 0).r;').not.toMatch(IMPLICIT)
  })

  it('reads the shadow of the key light with no gradient in both loops, which follow an early return', () => {
    const shade = functions.get('stageKeyShade') ?? ''
    const first = shade.indexOf('for (int i = 0;')
    expect(first).toBeGreaterThan(shade.indexOf('return 1.0;'))
    expect(shade.match(/for \(int i = 0;/g)?.length).toBe(2)
    expect(shade.match(/textureGrad\(map, vec3\(.*\), vec2\(0\.0\), vec2\(0\.0\)\)/g)?.length).toBe(2)
    expect(shade.slice(first)).not.toMatch(IMPLICIT)
  })

  it('names level 0 in every read the march through the veil makes, which leaves its loop early', () => {
    const path = functions.get('veilPath') ?? ''
    const march = path.slice(path.indexOf('for (int i = 0;'), path.indexOf('  if (seen > 0.004 && uVeilDrift.x > 0.0) {'))
    expect(march).toContain('break;')
    expect(march).not.toMatch(IMPLICIT)
    const called = reached(march)
    for (const name of ['veilFibre', 'veilField', 'veilLit', 'stageGrid', 'stageGridShade', 'stageGridOpen', 'stageGridWarm', 'stageKeyIn', 'stageSoftIn']) expect([...called], name).toContain(name)
    for (const name of called) expect(functions.get(name), name).not.toMatch(IMPLICIT)
    expect(functions.get('veilFibre')?.match(/textureLod\(uVeilNoise, .*, 0\.0\)\.a;/g)?.length).toBe(2)
    for (const name of ['stageGrid', 'stageGridShade', 'stageGridOpen', 'stageGridWarm']) expect(functions.get(name), name).toMatch(/textureLod\(uGrid[AB], stageGridAt\(local, [012]\.0\), 0\.0\)/)
  })
})
