import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { lensPlace } from '../src/globe/lens'
import { poseById, sphereCentreMm } from '../src/scene/cameras'
import { framingOf, globeTopMm, sphereRadiusMm } from '../src/scene/framing'
import { anchors, centreHeightMm, shapePoints, shapes, type Role } from '../src/scene/layout'

const hd = config.formats.hd
const RAD = Math.PI / 180

type V3 = [number, number, number]

function viewOf(id: string) {
  const pose = poseById(id)
  const eye: V3 = [pose.position.x, pose.position.y, pose.position.z]
  const fwd = pose.aim.clone().sub(pose.position).normalize()
  const right = fwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
  const up = right.clone().cross(fwd)
  const f = hd.height / 2 / Math.tan((pose.fovDeg * RAD) / 2)
  const centre: V3 = [0, sphereCentreMm, 0]
  const project = (p: V3) => {
    const v = { x: p[0] - eye[0], y: p[1] - eye[1], z: p[2] - eye[2] }
    const z = v.x * fwd.x + v.y * fwd.y + v.z * fwd.z
    return {
      x: (hd.width / 2 + (f * (v.x * right.x + v.y * right.y + v.z * right.z)) / z) / hd.width,
      y: (hd.height / 2 - (f * (v.x * up.x + v.y * up.y + v.z * up.z)) / z) / hd.height,
      z,
    }
  }
  const inside = (p: readonly number[]) => {
    const r = lensPlace([p[0]!, p[1]! + centreHeightMm, p[2]!], eye, centre)
    return { ...project(r.apparent), seen: r.seen }
  }
  const box = (roles: Role[]) => {
    const b = { left: Infinity, right: -Infinity, top: Infinity, foot: -Infinity }
    for (const s of shapes) {
      if (!roles.includes(s.role)) continue
      for (const p of shapePoints(s)) {
        const q = inside(p)
        b.left = Math.min(b.left, q.x)
        b.right = Math.max(b.right, q.x)
        b.top = Math.min(b.top, q.y)
        b.foot = Math.max(b.foot, q.y)
      }
    }
    return b
  }
  return { pose, project, inside, box }
}

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

  it('surface shows the surface: the foot in the upper part, half a base of surface on each side', () => {
    const c = config.cameras.surface
    const f = framingOf('surface', hd.width, hd.height)
    expect(c.pitchDeg).toBeGreaterThanOrEqual(14)
    expect(c.pitchDeg).toBeLessThanOrEqual(24)
    expect(f.base.foot / hd.height).toBeLessThanOrEqual(0.4)
    expect(f.base.foot / hd.height).toBeGreaterThan(0.3)
    const baseWidth = f.base.right - f.base.left
    expect(f.base.left).toBeGreaterThanOrEqual(0.5 * baseWidth)
    expect(hd.width - f.base.right).toBeGreaterThanOrEqual(0.5 * baseWidth)
    const v = viewOf('surface')
    const mirrored = v.project([0, -(config.globe.baseHeightMm + sphereRadiusMm), 0])
    expect(mirrored.y).toBeGreaterThan(0.5)
    expect(mirrored.y).toBeLessThan(1)
  })

  it('interior holds the miniature from the floor to the top of the crown, and little else', () => {
    const f = framingOf('interior', hd.width, hd.height)
    const v = viewOf('interior')
    const all = v.box(['cottage', 'roof', 'chimney', 'trunk', 'crown', 'post', 'lamp', 'fence', 'path'])
    expect(all.top).toBeGreaterThanOrEqual(0.03)
    expect(all.top).toBeLessThanOrEqual(0.08)
    expect(all.foot).toBeLessThan(0.94)
    expect(all.left).toBeGreaterThan(0.2)
    expect(all.right).toBeLessThan(0.8)
    expect(f.globe.cx - f.globe.r).toBeGreaterThan(0)
    expect(f.globe.cx + f.globe.r).toBeLessThan(hd.width)
    expect(f.globe.cy - f.globe.r).toBeLessThan(0)
    expect(f.base.foot).toBeGreaterThan(hd.height)
    const rim = v.project([0, config.globe.baseHeightMm, config.globe.baseDiameterMm / 2])
    expect(rim.y).toBeGreaterThan(0.93)
    expect(all.foot - all.top).toBeGreaterThan(0.75)
  })

  it('low stands near the surface and looks up at the whole globe, with room over the crown and under the foot', () => {
    const c = config.cameras.low
    const hero = config.cameras.hero
    const f = framingOf('low', hd.width, hd.height)
    const height = poseById('low').position.y
    expect(c.pitchDeg).toBeLessThan(0)
    expect(height).toBeGreaterThanOrEqual(12)
    expect(height).toBeLessThanOrEqual(30)
    expect((f.globe.cy - f.globe.r) / hd.height).toBeGreaterThanOrEqual(0.05)
    expect(1 - f.base.foot / hd.height).toBeGreaterThanOrEqual(0.04)
    expect(f.base.left).toBeGreaterThan(0)
    expect(f.base.right).toBeLessThan(hd.width)
    expect(f.globe.cx - f.globe.r).toBeGreaterThan(0)
    expect(f.globe.cx + f.globe.r).toBeLessThan(hd.width)
    expect(Math.abs(c.yawDeg - hero.yawDeg)).toBeGreaterThanOrEqual(15)
    expect(height).toBeLessThan(poseById('hero').position.y / 4)
  })
  it('macro holds the door, the window, the chimney, a lamppost clear of the cottage and the trunk, and focuses on the door', () => {
    const v = viewOf('macro')
    const door = v.inside(anchors.door)
    const win = v.inside(anchors.window)
    const chimney = v.box(['chimney'])
    const house = v.box(['cottage', 'roof', 'chimney'])
    const lamp = v.box(['post', 'lamp'])
    const trunk = v.box(['trunk'])
    for (const p of [door, win]) {
      expect(p.seen).toBe(true)
      expect(p.x).toBeGreaterThan(0.05)
      expect(p.x).toBeLessThan(0.95)
      expect(p.y).toBeGreaterThan(0.05)
      expect(p.y).toBeLessThan(0.95)
    }
    expect(chimney.left).toBeGreaterThan(0)
    expect(chimney.top).toBeGreaterThan(0)
    expect(house.left).toBeGreaterThan(-0.12)
    expect(lamp.left - house.right).toBeGreaterThanOrEqual(0.01)
    expect(lamp.top).toBeGreaterThan(0)
    expect(trunk.left).toBeGreaterThan(lamp.right)
    expect(trunk.right).toBeLessThan(1)
    expect(Math.abs(v.pose.focusMm - door.z)).toBeLessThanOrEqual(5)
    expect(v.pose.apertureMm).toBeLessThanOrEqual(3)
  })
})
