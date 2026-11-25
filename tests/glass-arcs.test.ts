import { describe, expect, it } from 'vitest'
import { glassLook, glassOf } from '../src/globe/shell'

describe('the arcs of the lamps outside the frame', () => {
  it('lie in the rim and never on the outline', () => {
    for (const g of glassLook.arcs.groups) {
      expect(g.share[0]).toBeGreaterThanOrEqual(0.88)
      expect(g.share[1]).toBeLessThanOrEqual(0.988)
      expect(g.share[0]).toBeLessThan(g.share[1])
    }
  })
  it('are fine: no lamp is thicker than its length, and the lamps are thinner than the ceiling', () => {
    const top = glassLook.arcs.top
    for (const g of glassLook.arcs.groups) {
      expect(g.thick[1]).toBeLessThan(g.half[0])
      expect(g.thick[1]).toBeLessThan(top[2])
    }
  })
  it('are off in a season that does not set them', () => {
    const plain = glassOf('a season that sets nothing')
    expect(plain.arcs).toBe(0)
    expect(plain.arcCool).toBe(0)
  })
})
