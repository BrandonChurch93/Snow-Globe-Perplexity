import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARD_FRAG_PARS, CARD_VERT } from '../src/particles/draw/cards'
import { CARD, SHAPE, STORM_FLOOD, STORM_LOOSE, STORM_OWN_PATH_FROM, STORM_SHUTTER, STORM_SHUTTER_TURNED, STREAK_ARC } from '../src/particles/draw/looks'
import { VERT_MAIN } from '../src/particles/draw/shader'

const DRAW = join(__dirname, '..', 'src', 'particles', 'draw')

describe('how the storm is drawn', () => {
  it('a trail costs a few joined pieces', () => {
    expect(CARD.run.taps).toBeGreaterThanOrEqual(3)
    expect(CARD.run.taps).toBeLessThanOrEqual(6)
    expect(CARD_FRAG_PARS).toContain(`i < ${CARD.run.taps};`)
  })

  it('a kind drawn along its own path is seen for its stroke alone and the samples add none of it', () => {
    expect(STORM_SHUTTER).toBeGreaterThan(0)
    expect(STORM_SHUTTER).toBeLessThanOrEqual(1)
    expect(VERT_MAIN).toContain('uPoint.x + shut * uStorm.y * afloat * (storming ? 1.0 - uStorm.x : 1.0)')
  })

  it('the leaf, the seed, the light and the spark take their own path; the flake, the glitter, the petal and the mote are turned to the current', () => {
    expect(STORM_OWN_PATH_FROM).toBeGreaterThan(SHAPE.fleck)
    expect(STORM_OWN_PATH_FROM).toBeLessThan(SHAPE.leaf)
    expect(STORM_SHUTTER_TURNED).toBeGreaterThan(STORM_SHUTTER)
    expect(STORM_SHUTTER_TURNED).toBeLessThanOrEqual(1)
    expect(VERT_MAIN).toContain(`bool storming = uStorm.x > 0.0 && shape > ${STORM_OWN_PATH_FROM.toFixed(1)};`)
  })

  it('a kind on its own path is not turned to the current; its line runs longer along that same path, each by its own share', () => {
    expect(VERT_MAIN).toContain('if (gusty > 0.0 && !storming) {')
    expect(CARD_VERT).toContain('if (!storming) mvC = mix(mvC, curC')
    expect(CARD_VERT).toContain('if (!storming) stC *= ')
    expect(CARD_VERT).toContain('if (storming) {\n        headC = 0.0;')
    expect(CARD_VERT).toContain('if (storming) mvC *= mix(')
    expect(CARD_VERT).toContain('pointSag(nowL, pathC)')
    expect(CARD.line.shutLong[0]).toBeGreaterThanOrEqual(1)
    expect(CARD.line.shutLong[1] * STORM_SHUTTER).toBeLessThanOrEqual(1)
  })

  it('the whirl of the dabs is loosened only while the storm is drawn, so a still liquid is drawn as before', () => {
    expect(STORM_LOOSE.alignLow).toBeGreaterThan(0)
    expect(STORM_LOOSE.alignLow).toBeLessThan(1)
    expect(STORM_LOOSE.farLong).toBeLessThan(STORM_LOOSE.nearLong)
    expect(STORM_LOOSE.farSeen).toBeLessThanOrEqual(1)
    expect(VERT_MAIN).toContain(`clump = mix(clump, ${STORM_LOOSE.even}, ${STORM_LOOSE.spread} * uStorm.x);`)
    expect(VERT_MAIN).toContain('uStorm.x * gusty * (1.0 - glints));')
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

  it('the seed of summer alone is turned to the whirl on its own path: in the storm its stroke is a curved swish of its own length and width, and a few are bits of green leaf', () => {
    expect(CARD_VERT).toContain('mix(mvC, curC * (length(mvC) * (dot(mvC, curC) < 0.0 ? -1.0 : 1.0)), mix(')
    expect(CARD.line.stormAlign[0]).toBeGreaterThan(0)
    expect(CARD.line.stormAlign[1]).toBeLessThanOrEqual(1)
    expect(CARD.line.stormLong[0]).toBeLessThan(CARD.line.stormLong[1])
    expect(CARD.line.stormWidePx[0]).toBeLessThan(CARD.line.stormWidePx[1])
    expect(CARD.line.stormBow[1]).toBeLessThanOrEqual(CARD.line.stormBowMost)
    expect(CARD.line.stormBowMost).toBeLessThanOrEqual(STREAK_ARC.most)
    expect(CARD.line.stormLeaves).toBeGreaterThan(0)
    expect(CARD.line.stormLeaves).toBeLessThan(0.05)
    expect(CARD.line.stormDwellPx).toBeGreaterThan(0)
  })
})
