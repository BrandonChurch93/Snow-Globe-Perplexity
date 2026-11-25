import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARD_FRAG_PARS, CARD_VERT } from '../src/particles/draw/cards'
import { CARD, STORM_FLOOD, STORM_SHUTTER, STREAK_ARC } from '../src/particles/draw/looks'
import { VERT_MAIN } from '../src/particles/draw/shader'

const DRAW = join(__dirname, '..', 'src', 'particles', 'draw')

describe('how the storm is drawn', () => {
  it('a trail costs a few joined pieces', () => {
    expect(CARD.run.taps).toBeGreaterThanOrEqual(3)
    expect(CARD.run.taps).toBeLessThanOrEqual(6)
    expect(CARD_FRAG_PARS).toContain(`i < ${CARD.run.taps};`)
  })

  it('the drawn stroke is the whole exposure in a storm and the samples add none of it', () => {
    expect(STORM_SHUTTER).toBeGreaterThan(0)
    expect(STORM_SHUTTER).toBeLessThanOrEqual(1)
    expect(VERT_MAIN).toContain('uPoint.x + shut * uStorm.y * afloat * (1.0 - uStorm.x)')
  })

  it('in a storm no kind is turned to the current or stretched by its class', () => {
    expect(VERT_MAIN).toContain('if (gusty > 0.0 && !storming) {')
    expect(CARD_VERT).toContain('if (!storming) mvC = mix(mvC, curC')
    expect(CARD_VERT).toContain('if (!storming) stC *= ')
    expect(CARD_VERT).toContain('if (storming) {\n        headC = 0.0;')
  })

  it('the arc of a trail and the front of the flood stay within their bounds', () => {
    expect(STREAK_ARC.most).toBeGreaterThan(0)
    expect(STREAK_ARC.most).toBeLessThanOrEqual(0.5)
    expect(STREAK_ARC.leastMm).toBeGreaterThan(0)
    expect(STORM_FLOOD.frontMm[0]).toBeLessThan(STORM_FLOOD.frontMm[1])
    expect(STORM_FLOOD.frontClear).toBeLessThanOrEqual(1)
    expect(CARD.line.dwellPx).toBeGreaterThan(0)
  })

  it('the drawing takes no number that is not the particle own seed', () => {
    for (const name of readdirSync(DRAW)) {
      if (!name.endsWith('.ts')) continue
      const text = readFileSync(join(DRAW, name), 'utf8')
      expect(text, name).not.toMatch(/Math\.random|Date\.now|performance\.now/)
    }
  })
})
