import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { framingOf, globeTopMm, sphereRadiusMm } from '../src/scene/framing'

const hd = config.formats.hd

describe('framing', () => {
  it('hero holds the globe and its base at the height the approved images show', () => {
    const f = framingOf('hero', hd.width, hd.height)
    const c = config.cameras.hero
    expect(f.frameHeightMm).toBeCloseTo(2 * c.distanceMm * Math.tan((c.fovDeg * Math.PI) / 360), 9)
    expect(f.heroFill).toBe(globeTopMm / f.frameHeightMm)
    expect(f.heroFill).toBeGreaterThanOrEqual(config.framing.heroFillMin)
    expect(f.heroFill).toBeLessThanOrEqual(config.framing.heroFillMax)
    expect(f.globe.cy - f.globe.r).toBeGreaterThan(0)
    expect(f.base.foot).toBeLessThan(hd.height)
    expect(f.base.left).toBeGreaterThan(0)
    expect(f.base.right).toBeLessThan(hd.width)
  })

  it('macro shows no edge of the glass', () => {
    const f = framingOf('macro', hd.width, hd.height)
    expect(f.cornerReachMm).toBeLessThanOrEqual(config.framing.macroMaxRadiusFraction * sphereRadiusMm)
  })

  it('base is wide enough for the whole base', () => {
    const f = framingOf('base', hd.width, hd.height)
    expect(f.frameWidthMm).toBeGreaterThanOrEqual(config.globe.baseDiameterMm)
  })

  it('puts the glass where the approved images have it', () => {
    const f = framingOf('hero', hd.width, hd.height)
    expect((2 * f.globe.r) / hd.width).toBeGreaterThan(0.36)
    expect((2 * f.globe.r) / hd.width).toBeLessThan(0.42)
    expect(Math.abs(f.globe.cx - hd.width / 2)).toBeLessThan(1)
  })
})
