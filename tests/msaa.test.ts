import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIVE_SAMPLES, liveSamples } from '../src/core/accumulator'

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

describe('multisampling in the live picture', () => {
  it('asks for the same count whatever the level, clamped to what the device reports', () => {
    expect(LIVE_SAMPLES).toBe(4)
    expect(liveSamples(16)).toBe(4)
    expect(liveSamples(8)).toBe(4)
    expect(liveSamples(4)).toBe(4)
    expect(liveSamples(3)).toBe(3)
    expect(liveSamples(2)).toBe(2)
  })

  it('asks for none where the device gives none, so the picture is drawn as before', () => {
    expect(liveSamples(1)).toBe(0)
    expect(liveSamples(0)).toBe(0)
    expect(liveSamples(-1)).toBe(0)
    expect(liveSamples(Number.NaN)).toBe(0)
    expect(liveSamples(undefined as unknown as number)).toBe(0)
  })

  it('gives the live target its samples from the device and from nothing else', () => {
    const painter = read('src/app/painter.ts')
    expect(painter).toContain('samples: liveSamples(this.gfx.caps.maxSamples)')
    expect(painter).not.toMatch(/quality|level/i)
  })

  it('leaves the capture path without samples', () => {
    const capture = read('src/capture/showcase.ts')
    const made = capture.match(/new Accumulator\([^)]*\)/g) ?? []
    expect(made.length).toBeGreaterThan(0)
    for (const call of made) expect(call).toBe('new Accumulator(gfx, format.width, format.height)')
  })
})
