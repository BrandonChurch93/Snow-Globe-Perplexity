import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { sampleSdf } from '../src/core/sdf'
import { anchors, buildCollider, centreHeightMm, colliderCells, cottage, domeHeightMm, emitters, groundAt, groundY, heights, innerRadiusMm, islandEdge, lamppost, moundAt, moundSlope, pond, pondField, shapePoints, shapes, solidDistance, tree, type Role } from '../src/scene/layout'

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
      const y = moundAt(Math.sin(a) * r)
      expect(Math.hypot(r, y)).toBeLessThan(innerRadiusMm)
      expect(Math.hypot(r, y)).toBeGreaterThan(innerRadiusMm - 1.5)
    }
  })

  it('holds the heights of the subject as the approved image has them', () => {
    const h = heights()
    expect(h.dome).toBe(domeHeightMm)
    expect(h.island).toBe(config.globe.islandLevelMm)
    expect(h.cottage / h.dome).toBeGreaterThan(0.21)
    expect(h.cottage / h.dome).toBeLessThan(0.29)
    expect(h.tree / h.dome).toBeGreaterThan(0.55)
    expect(h.tree / h.dome).toBeLessThan(0.7)
    expect(h.tree).toBeGreaterThan(h.cottage)
    expect(h.tree).toBeGreaterThan(h.lamp)
    expect(h.lamp).toBeGreaterThan(10.5)
    expect(h.lamp).toBeLessThan(13.5)
  })

  it('makes the island a mound raked toward the viewer, higher at the back, the island level through the pond', () => {
    expect(groundAt(0, -30)).toBeGreaterThan(groundAt(0, 30))
    expect(groundAt(0, -45)).toBeGreaterThan(groundAt(0, -10))
    for (const [x, z] of [[cottage.x, cottage.sill], [lamppost.x, lamppost.z], [tree.x, tree.z]] as const) {
      expect(groundAt(x, z) - groundY, `${x}, ${z}`).toBeGreaterThan(6.5)
      expect(groundAt(x, z) - groundY, `${x}, ${z}`).toBeLessThan(9)
    }
    expect(Math.abs(groundAt(tree.x, tree.z) - -19.6)).toBeLessThan(0.3)
    expect(Math.abs(moundAt(pond.z) - groundY)).toBeLessThan(1.5)
    expect(groundY - moundAt(islandEdge(Math.PI / 2))).toBeLessThan(6)
    expect(groundAt(pond.x, pond.z)).toBeLessThan(moundAt(pond.z) - 0.8)
    expect(Math.abs(groundAt(pond.x + pond.rx + 6, pond.z) - moundAt(pond.z))).toBeLessThan(1e-9)
    for (let z = -50; z < 46; z += 1) {
      expect(moundAt(z)).toBeGreaterThan(moundAt(z + 1))
      expect(Math.abs((moundAt(z) - moundAt(z + 1e-4)) / 1e-4 - moundSlope(z))).toBeLessThan(1e-3)
    }
  })

  it('puts each thing where the subject says, seen from the hero camera', () => {
    const house = middle('cottage')
    const crown = middle('crown')
    const lamp = middle('lamp')
    const water = middle('pond')
    const rails = middle('fence')
    const path = by('path').map((s) => shapePoints(s)[0]!)
    expect(house[0]).toBeLessThan(-5)
    expect(crown[0]).toBeGreaterThan(5)
    expect(lamp[0]).toBeGreaterThan(house[0])
    expect(lamp[0]).toBeLessThan(crown[0])
    expect(lamp[1]).toBeGreaterThan(Math.max(house[1], crown[1]))
    expect(Math.abs(water[0])).toBeLessThan(8)
    expect(water[1]).toBeGreaterThan(lamp[1])
    expect(islandEdge(Math.PI / 2) - (pond.z + pond.rz)).toBeLessThan(4)
    expect(pondField(pond.x, pond.z)).toBeLessThan(0.05)
    expect(pondField(pond.x, pond.z + pond.rz * 1.2)).toBeGreaterThan(1)
    expect(rails[0]).toBeLessThan(-10)
    expect(rails[1]).toBeGreaterThan(house[1])
    expect(path[0]![2]).toBeLessThan(path[path.length - 1]![2])
    expect(path[path.length - 1]![2]).toBeLessThan(water[1])
    const box = by('cottage')[0]!
    expect(box.kind).toBe('box')
    if (box.kind === 'box') {
      expect(box.yaw).toBeGreaterThan(0.1)
      expect(box.yaw).toBeLessThan(0.7)
      expect(box.half[2]).toBeGreaterThan(box.half[0])
    }
    expect(anchors.door[0]).toBeGreaterThan(anchors.window[0])
    expect(anchors.door[2]).toBeGreaterThan(house[1])
    expect(solidDistance(...anchors.door)).toBeGreaterThan(0)
    expect(solidDistance(...anchors.window)).toBeGreaterThan(0)
    expect(solidDistance(...anchors.sideWindow)).toBeGreaterThan(0)
  })

  it('gives a collider that agrees with the shapes', () => {
    const g = buildCollider()
    expect(g.n).toBe(colliderCells)
    expect(g.data.length).toBe(g.n ** 3)
    expect(g.sizeMm).toBe(2 * innerRadiusMm)
    expect(sampleSdf(g, -20, 30, 25)).toBeGreaterThan(5)
    expect(sampleSdf(g, 0, groundY - 6, -10)).toBeLessThan(-3)
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
