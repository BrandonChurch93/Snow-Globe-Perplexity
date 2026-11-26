import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FRAME, livePath, liveRig, roomUnder, standBack, type Shaking } from '../src/app/framing'
import { config } from '../src/config'
import { poseOfRig, reachOf, rigOf, type Rig } from '../src/film/moves'
import { beatSeconds } from '../src/film/timeline'
import { lensPlace } from '../src/globe/lens'
import { poseById, sphereCentreMm } from '../src/scene/cameras'
import { framingOf, globeTopMm, sphereRadiusMm } from '../src/scene/framing'
import { anchors, centreHeightMm, shapePoints, shapes, type Role } from '../src/scene/layout'
import { REST_POSE, type GlobePose } from '../src/shake/table'

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
    const doorDepth = v.project([anchors.door[0]!, anchors.door[1]! + centreHeightMm, anchors.door[2]!]).z
    expect(Math.abs(v.pose.focusMm - doorDepth)).toBeLessThanOrEqual(5)
    expect(v.pose.apertureMm).toBeLessThanOrEqual(3)
  })
})

describe('the framing of the app through a shake', () => {
  const bar = config.film.beatsPerBar
  const liftBeats = config.shake.liftBeats
  const homeSeconds = FRAME.homeBars * bar * beatSeconds
  const settleBeats = config.shake.landSettleSeconds / beatSeconds
  const long = config.states.settledSeconds
  const screens: [string, number, number][] = [
    ['320 x 568', 320, 568],
    ['360 x 800', 360, 800],
    ['phone', config.formats.phone.width, config.formats.phone.height],
    ['tablet', config.formats.tablet.width, config.formats.tablet.height],
    ['4 to 5', 800, 1000],
    ['square', 1000, 1000],
    ['5 to 4', 1280, 1024],
    ['hd', config.formats.hd.width, config.formats.hd.height],
    ['phone on its side', config.formats.phone.height, config.formats.phone.width],
    ['2560 x 1080', 2560, 1080],
  ]
  const room = 1 - 2 * FRAME.edgeShare
  const slack = 1e-6

  /** What a shaken globe covers, in half heights of the frame from its middle: the glass and the base as `reachOf` has them,
   * and to the sides the widest base any season builds, carried by the same pose. `heap` is how low the front of what a season
   * heaps on the surface lies: it stays on the surface. */
  const cover = (rig: Rig, g: GlobePose): { side: number; top: number; foot: number; heap: number } => {
    const r = reachOf(poseOfRig(rig), g)
    const p = rig.pitchDeg * RAD
    const k = Math.tan((rig.fovDeg * RAD) / 2)
    let side = r.side
    for (const end of [-FRAME.baseReachMm, FRAME.baseReachMm]) {
      for (const up of [0, config.globe.baseHeightMm]) {
        const ax = end * Math.cos(g.tiltZ) - up * Math.sin(g.tiltZ)
        const ay = end * Math.sin(g.tiltZ) + up * Math.cos(g.tiltZ)
        const y = ay * Math.cos(g.tiltX) + g.y - rig.aimHeightMm
        const z = ay * Math.sin(g.tiltX) + g.z
        side = Math.max(side, Math.abs(ax + g.x) / (rig.distanceMm - y * Math.sin(p) - z * Math.cos(p)) / k)
      }
    }
    const reachMm = config.globe.baseDiameterMm / 2 + FRAME.heapMm
    const heap = (rig.aimHeightMm * Math.cos(p) + reachMm * Math.sin(p)) / (rig.distanceMm + rig.aimHeightMm * Math.sin(p) - reachMm * Math.cos(p)) / k
    return { side, top: r.top, foot: r.foot, heap }
  }

  /** Every moment the rule is asked at: the bar of the shake, then the landing's rock and the camera's way home. */
  const moments = (step: number): { beat: number; at: Shaking }[] => {
    const out: { beat: number; at: Shaking }[] = []
    for (let b = 0; b < bar; b += step) out.push({ beat: b, at: { beat: b, sinceLanding: long } })
    for (let b = bar; b <= bar + FRAME.homeBars * bar + 0.5; b += step) out.push({ beat: b, at: { beat: null, sinceLanding: (b - bar) * beatSeconds } })
    return out
  }

  it('keeps the glass, the widest base and the heap at its foot inside the frame by the margin, at every moment of every shake, on every shape of screen', () => {
    const all = moments(FRAME.pathStepBeats)
    for (const [name, w, h] of screens) {
      const a = w / h
      for (const controls of [null, Math.round(0.152 * h)]) {
        const under = roomUnder(h, controls, w)
        const low = -1 + 2 * under
        const worst = { side: 0, top: -Infinity, foot: -Infinity, heap: -Infinity }
        for (let n = 0; n < FRAME.shakePaths; n++) {
          const path = livePath(n)
          for (const m of all) {
            const c = cover(liveRig(a, 0, 0, under, m.at), path.poseAt(m.beat))
            worst.side = Math.max(worst.side, c.side)
            worst.top = Math.max(worst.top, c.top)
            worst.foot = Math.max(worst.foot, c.foot)
            worst.heap = Math.max(worst.heap, c.heap)
          }
        }
        expect(worst.side / a, `${name} ${controls} side`).toBeLessThanOrEqual(room + slack)
        expect(worst.top, `${name} ${controls} top`).toBeLessThanOrEqual(room + slack)
        expect(-worst.foot, `${name} ${controls} foot`).toBeGreaterThanOrEqual(low - slack)
        expect(-worst.heap, `${name} ${controls} heap`).toBeGreaterThanOrEqual(low - slack)
      }
    }
  })

  it('holds the same at rest, and through a second shake asked while the camera still comes home', () => {
    for (const [name, w, h] of screens) {
      const a = w / h
      const under = roomUnder(h, null, w)
      const rest = cover(liveRig(a, 0, 0, under), REST_POSE)
      expect(rest.side / a, name).toBeLessThanOrEqual(room + slack)
      expect(rest.top, name).toBeLessThanOrEqual(room + slack)
      expect(-rest.heap, name).toBeGreaterThanOrEqual(-1 + 2 * under - slack)
      for (const since of [config.shake.landSettleSeconds, 0.3 * homeSeconds, 0.6 * homeSeconds]) {
        for (let n = 0; n < FRAME.shakePaths; n++) {
          const path = livePath(n)
          for (let b = 0; b < bar; b += 4 * FRAME.pathStepBeats) {
            const c = cover(liveRig(a, 0, 0, under, { beat: b, sinceLanding: since + b * beatSeconds }), path.poseAt(b))
            expect(c.side / a, `${name} ${since} ${n} ${b}`).toBeLessThanOrEqual(room + slack)
            expect(c.top, `${name} ${since} ${n} ${b}`).toBeLessThanOrEqual(room + slack)
          }
        }
      }
    }
  })

  it('stands the camera back only as far as the widest stroke asks: not at all on a wide screen, and on an upright one until that stroke meets the margin', () => {
    const through: Shaking = { beat: liftBeats, sinceLanding: long }
    for (const [name, w, h] of screens) {
      const a = w / h
      const under = roomUnder(h, null, w)
      const rest = liveRig(a, 0, 0, under)
      const far = liveRig(a, 0, 0, under, through)
      for (const k of ['fovDeg', 'yawDeg', 'pitchDeg', 'aimHeightMm', 'apertureMm', 'focusShiftMm'] as const) expect(far[k], `${name} ${k}`).toBe(rest[k])
      expect(far.distanceMm, name).toBeGreaterThanOrEqual(rest.distanceMm)
      let side = 0
      for (let n = 0; n < FRAME.shakePaths; n++) for (let b = 0; b <= bar; b += FRAME.pathStepBeats / 4) side = Math.max(side, cover(far, livePath(n).poseAt(b)).side)
      if (a >= 16 / 10) expect(far.distanceMm, name).toBe(rest.distanceMm)
      if (far.distanceMm > rest.distanceMm) expect(side / a, name).toBeCloseTo(room, 4)
      else expect(side / a, name).toBeLessThanOrEqual(room + slack)
    }
    const p = config.formats.phone
    const phone = roomUnder(p.height, null, p.width)
    const back = liveRig(p.width / p.height, 0, 0, phone, through).distanceMm / liveRig(p.width / p.height, 0, 0, phone).distanceMm
    expect(back).toBeGreaterThan(1.3)
    expect(back).toBeLessThan(1.45)
    expect(liveRig(16 / 9, 0, 0, 0.14, through)).toEqual(liveRig(16 / 9, 0, 0, 0.14))
  })

  it('goes back with the lift, stays for the strokes and the set-down, and comes home over a bar after the landing, never with a step', () => {
    expect(standBack()).toBe(0)
    expect(standBack(null)).toBe(0)
    expect(standBack({ beat: null, sinceLanding: long })).toBe(0)
    expect(standBack({ beat: null, sinceLanding: homeSeconds })).toBe(0)
    expect(standBack({ beat: 0, sinceLanding: long })).toBe(0)
    for (const b of [liftBeats, config.shake.swapWindow.fromBeat, config.shake.swapWindow.toBeat, bar - 1e-9]) expect(standBack({ beat: b, sinceLanding: long })).toBe(1)
    expect(standBack({ beat: null, sinceLanding: 0 })).toBe(1)
    expect(standBack({ beat: null, sinceLanding: -1 })).toBe(1)
    const fps = config.film.fps
    const frame = 1 / fps / beatSeconds
    let last = 0
    let fastest = 0
    for (let b = 0; b <= liftBeats + frame; b += frame) {
      const v = standBack({ beat: b, sinceLanding: long })
      expect(v).toBeGreaterThanOrEqual(last)
      fastest = Math.max(fastest, v - last)
      last = v
    }
    expect(fastest).toBeLessThan(0.07)
    expect(standBack({ beat: frame, sinceLanding: long })).toBeLessThan(0.01)
    expect(standBack({ beat: liftBeats - frame, sinceLanding: long })).toBeGreaterThan(0.999)
    last = 1
    for (let t = 0; t <= homeSeconds + 1 / fps; t += 1 / fps) {
      const v = standBack({ beat: null, sinceLanding: t })
      expect(v).toBeLessThanOrEqual(last)
      expect(last - v).toBeLessThan(0.015)
      last = v
    }
    expect(last).toBe(0)
    expect(standBack({ beat: null, sinceLanding: settleBeats * beatSeconds })).toBeGreaterThan(0.95)
    for (const since of [0.2, 0.5 * homeSeconds, 0.9 * homeSeconds]) {
      const before = standBack({ beat: null, sinceLanding: since })
      expect(standBack({ beat: 0, sinceLanding: since })).toBe(before)
      let was = before
      for (let b = frame; b <= liftBeats; b += frame) {
        const v = standBack({ beat: b, sinceLanding: since + b * beatSeconds })
        expect(Math.abs(v - was)).toBeLessThan(0.07)
        expect(v).toBeGreaterThanOrEqual(standBack({ beat: b, sinceLanding: long }))
        was = v
      }
    }
  })

  it('moves the picture by little from one frame to the next: the fastest the globe shrinks on a phone is under 2.5 percent a frame at 60 a second, and it grows again under half a percent a frame', () => {
    const p = config.formats.phone
    const a = p.width / p.height
    const under = roomUnder(p.height, null, p.width)
    const fps = 60
    const frame = 1 / fps / beatSeconds
    let out = 0
    let was = liveRig(a, 0, 0, under).distanceMm
    for (let b = frame; b <= liftBeats + frame; b += frame) {
      const d = liveRig(a, 0, 0, under, { beat: b, sinceLanding: long }).distanceMm
      out = Math.max(out, d / was - 1)
      was = d
    }
    expect(out).toBeGreaterThan(0)
    expect(out).toBeLessThan(0.025)
    let home = 0
    for (let t = 1 / fps; t <= homeSeconds; t += 1 / fps) {
      const d = liveRig(a, 0, 0, under, { beat: null, sinceLanding: t }).distanceMm
      home = Math.max(home, was / d - 1)
      was = d
    }
    expect(home).toBeLessThan(0.005)
    expect(was).toBeCloseTo(liveRig(a, 0, 0, under).distanceMm, 6)
  })

  it('is still the wide camera of the film, moved back along its own axis, while it stands back', () => {
    const hero = rigOf('hero')
    for (const [name, w, h] of screens) {
      for (const back of [0.2, 0.5, 1]) {
        const rig = liveRig(w / h, 0, 0, roomUnder(h, null, w), { beat: back * liftBeats, sinceLanding: long })
        expect(rig.pitchDeg, name).toBe(hero.pitchDeg)
        expect(rig.yawDeg, name).toBe(hero.yawDeg)
        expect(rig.fovDeg, name).toBe(hero.fovDeg)
        expect(rig.distanceMm, name).toBeGreaterThanOrEqual(hero.distanceMm)
      }
    }
  })
})
