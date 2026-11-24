import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { sampleSdf } from '../src/core/sdf'
import { buildCollider, centreHeightMm, colliderCells, domeHeightMm, emitters, groundAt, groundY, heights, innerRadiusMm, islandEdge, shapePoints, shapes, solidDistance, type Role } from '../src/scene/layout'

const by = (role: Role) => shapes.filter((s) => s.role === role)
const middle = (role: Role): [number, number] => {
  const pts = by(role).flatMap(shapePoints)
  return [pts.reduce((n, p) => n + p[0], 0) / pts.length, pts.reduce((n, p) => n + p[2], 0) / pts.length]
}

describe('the layout', () => {
  it('reads the globe from the config', () => {
    expect(innerRadiusMm).toBe(config.globe.sphereDiameterMm / 2 - config.globe.glassThicknessMm)
    expect(centreHeightMm).toBe(config.globe.baseHeightMm - config.globe.collarDepthMm + config.globe.sphereDiameterMm / 2)
    expect(groundY + centreHeightMm).toBe(config.globe.islandLevelMm)
  })

  it('keeps everything inside the glass', () => {
    for (const s of shapes) for (const p of shapePoints(s)) expect(Math.hypot(...p), `${s.role}`).toBeLessThan(innerRadiusMm - 0.5)
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2
      const r = islandEdge(a)
      const y = groundAt(Math.cos(a) * r, Math.sin(a) * r)
      expect(Math.hypot(r, y)).toBeLessThan(innerRadiusMm)
      expect(Math.hypot(r, y)).toBeGreaterThan(innerRadiusMm - 1.5)
    }
  })

  it('holds the heights of the subject', () => {
    const h = heights()
    expect(h.dome).toBe(domeHeightMm)
    expect(h.island).toBe(config.globe.islandLevelMm)
    expect(h.cottage / h.dome).toBeGreaterThan(0.21)
    expect(h.cottage / h.dome).toBeLessThan(0.29)
    expect(h.tree / h.dome).toBeGreaterThan(0.71)
    expect(h.tree / h.dome).toBeLessThan(0.79)
    expect(h.tree).toBeGreaterThan(h.cottage)
    expect(h.tree).toBeGreaterThan(h.lamp)
  })

  it('makes the island a low mound, higher at the back, its top at the island level', () => {
    let top = -Infinity
    for (let x = -50; x <= 50; x += 2) for (let z = -50; z <= 50; z += 2) top = Math.max(top, groundAt(x, z))
    expect(top).toBeLessThanOrEqual(groundY)
    expect(top).toBeGreaterThan(groundY - 0.05)
    expect(groundAt(0, -30)).toBeGreaterThan(groundAt(0, 30))
    expect(groundY - groundAt(0, islandEdge(Math.PI / 2))).toBeLessThan(12)
  })

  it('puts each thing where the subject says, seen from the hero camera', () => {
    const cottage = middle('cottage')
    const tree = middle('crown')
    const lamp = middle('lamp')
    const pond = middle('pond')
    const fence = middle('fence')
    const path = by('path').map((s) => shapePoints(s)[0]!)
    expect(cottage[0]).toBeLessThan(-5)
    expect(tree[0]).toBeGreaterThan(5)
    expect(lamp[0]).toBeGreaterThan(cottage[0])
    expect(lamp[0]).toBeLessThan(tree[0])
    expect(lamp[1]).toBeGreaterThan(Math.max(cottage[1], tree[1]))
    expect(Math.abs(pond[0])).toBeLessThan(8)
    expect(pond[1]).toBeGreaterThan(lamp[1])
    expect(islandEdge(Math.PI / 2) - pond[1]).toBeLessThan(16)
    expect(fence[0]).toBeLessThan(-10)
    expect(fence[1]).toBeGreaterThan(cottage[1])
    expect(path[0]![2]).toBeLessThan(path[path.length - 1]![2])
    expect(path[path.length - 1]![2]).toBeLessThan(pond[1])
    const box = by('cottage')[0]!
    expect(box.kind).toBe('box')
    if (box.kind === 'box') {
      expect(box.yaw).toBeGreaterThan(0.1)
      expect(box.yaw).toBeLessThan(0.7)
    }
  })

  it('gives a collider that agrees with the shapes', () => {
    const g = buildCollider()
    expect(g.n).toBe(colliderCells)
    expect(g.data.length).toBe(g.n ** 3)
    expect(g.sizeMm).toBe(2 * innerRadiusMm)
    expect(sampleSdf(g, -20, 30, 25)).toBeGreaterThan(5)
    expect(sampleSdf(g, 0, groundY - 6, 0)).toBeLessThan(-3)
    const crown = by('crown')[0]!
    if (crown.kind === 'ball') {
      expect(sampleSdf(g, crown.centre[0], crown.centre[1], crown.centre[2])).toBeLessThan(-crown.radius + 2.5)
      expect(sampleSdf(g, crown.centre[0], crown.centre[1] + crown.radius + 4, crown.centre[2])).toBeGreaterThan(2)
    }
    const walls = by('cottage')[0]!
    if (walls.kind === 'box') expect(sampleSdf(g, walls.centre[0], walls.centre[1], walls.centre[2])).toBeLessThan(-4)
    let worst = 0
    for (let i = 0; i < 500; i++) {
      const x = ((i * 37) % 90) - 45
      const y = ((i * 53) % 80) - 30
      const z = ((i * 71) % 90) - 45
      if (Math.hypot(x, y, z) > innerRadiusMm - 3) continue
      worst = Math.max(worst, Math.abs(sampleSdf(g, x, y, z) - solidDistance(x, y, z)))
    }
    expect(worst).toBeLessThan(1.2)
  })

  it('hands out emitters that lie in the liquid, clear of every solid and of the glass', () => {
    expect(Object.keys(emitters).sort()).toEqual(['ember', 'leaf', 'petal'])
    for (const [kind, list] of Object.entries(emitters)) {
      expect(list.length, kind).toBeGreaterThan(0)
      for (const e of list) {
        expect(solidDistance(e.x, e.y, e.z), `${kind} at ${e.x.toFixed(1)}, ${e.y.toFixed(1)}, ${e.z.toFixed(1)}`).toBeGreaterThanOrEqual(e.r)
        expect(Math.hypot(e.x, e.y, e.z) + e.r, `${kind} at ${e.x.toFixed(1)}, ${e.y.toFixed(1)}, ${e.z.toFixed(1)}`).toBeLessThanOrEqual(innerRadiusMm - 1)
      }
    }
  })
})
