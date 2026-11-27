import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { config, tierEvenFromPx, tierMotion, tierSamples } from '../src/config'
import { sampleSet } from '../src/core/sampler'
import { SPREAD_BALL, TRAVEL_MARKS, centrePacePx, evenSet, framesamples, shutterTravelPx, spreadAt } from '../src/film/motion'
import { applyPose, poseById } from '../src/scene/cameras'
import { REST_POSE } from '../src/shake/table'
import { countFacts, countsLine, recordMatchesRun, ruleCount, sampleRule, tierOf } from '../tools/lib/master.mjs'

const shutter = config.film.shutterDegrees / 360 / config.film.fps
const pose = () => poseById('hero')
const W = 3840
const H = 2160
const ordered = (n: number) => sampleSet(n, 0, 'picture').sort((a, b) => a.t - b.t)

describe('the marks the travel is read at', () => {
  it('see a twist, which the centre and the top do not', () => {
    const twist = (sec: number) => ({ ...REST_POSE, twist: 0.3 * (sec / shutter) })
    const travel = shutterTravelPx(0, shutter, twist, pose, W, H)
    const mmToPx = H / (2 * Math.tan((poseById('hero').fovDeg * Math.PI) / 360) * poseById('hero').position.distanceTo(poseById('hero').aim))
    expect(travel).toBeGreaterThan(0.3 * (config.globe.baseDiameterMm / 2) * mmToPx * 0.9)
    expect(travel).toBeLessThan(0.3 * (config.globe.sphereDiameterMm / 2) * mmToPx * 1.3)
  })

  it('see a tilt about the foot at least as well as the top alone', () => {
    const tilt = (sec: number) => ({ ...REST_POSE, tiltZ: 0.1 * (sec / shutter) })
    const top = config.globe.baseHeightMm - config.globe.collarDepthMm + config.globe.sphereDiameterMm
    const mmToPx = H / (2 * Math.tan((poseById('hero').fovDeg * Math.PI) / 360) * poseById('hero').position.distanceTo(poseById('hero').aim))
    expect(shutterTravelPx(0, shutter, tilt, pose, W, H)).toBeGreaterThan(0.1 * top * mmToPx * 0.95)
  })

  it('hold the centre and the top first, and stand still when nothing moves', () => {
    expect(TRAVEL_MARKS[0]![0]).toBe(0)
    expect(TRAVEL_MARKS[1]![1]).toBeGreaterThan(TRAVEL_MARKS[0]![1])
    expect(shutterTravelPx(1, shutter, () => REST_POSE, pose, W, H)).toBe(0)
    expect(centrePacePx(1, shutter, () => REST_POSE, pose, W, H)).toEqual([0, 0])
  })

  it('the cap is above what the fastest frame of the films needs', () => {
    const motion = tierMotion('final')!
    expect(framesamples(24, motion, () => 80)).toBe(Math.ceil(80 / motion.spacingPx))
    expect(motion.maxSamplesPerFrame).toBeGreaterThanOrEqual(Math.ceil(80 / motion.spacingPx))
  })
})

describe('the samples of a frame that travels', () => {
  it('the place in the pixel moves the picture by minus itself, x to the right and y down', () => {
    const camera = new THREE.PerspectiveCamera()
    const at = (sample: { px: number; py: number } | null) => {
      applyPose(camera, { ...poseById('hero'), apertureMm: 0 }, W, H, sample ? { index: 0, lu: 0, lv: 0, t: 0, ...sample } : null)
      const p = new THREE.Vector3(20, 70, 5).project(camera)
      return [(p.x * 0.5 + 0.5) * W, (0.5 - p.y * 0.5) * H]
    }
    const plain = at(null)
    const moved = at({ px: 0.3, py: -0.2 })
    expect(moved[0]! - plain[0]!).toBeCloseTo(-0.3, 6)
    expect(moved[1]! - plain[1]!).toBeCloseTo(0.2, 6)
  })

  it('have even times, each the middle of its part, and keep the lens points and numbers of the set', () => {
    for (const n of [24, 60, 91, 128]) {
      const own = ordered(n)
      const set = evenSet(own, () => [0, 0])
      set.forEach((s, k) => {
        expect(s.at).toBeCloseTo((k + 0.5) / n, 12)
        expect(s.sample.t).toBe(s.at)
        expect(s.sample.index).toBe(own[k]!.index)
        expect(s.sample.lu).toBe(own[k]!.lu)
        expect(s.sample.of).toBe(n)
        expect(Math.floor(s.sample.t * n)).toBe(k)
      })
    }
  })

  it('draw what moves with the ball at even steps along the travel, whatever the place in the pixel', () => {
    for (const [vx, vy] of [[45, 0], [0, -67.5], [30, 40], [-6, 2]] as const) {
      const n = Math.max(24, Math.ceil(Math.hypot(vx, vy) / 0.75))
      const speed = Math.hypot(vx, vy)
      const set = evenSet(ordered(n), () => [vx, vy]).sort((a, b) => a.sample.t - b.sample.t)
      const along = set.map((s) => ((vx * s.at - s.sample.px) * vx + (vy * s.at - s.sample.py) * vy) / speed)
      for (let k = 4; k < n - 3; k++) expect(along[k]! - along[k - 1]!).toBeCloseTo(speed / n, 9)
      for (const s of set) {
        expect(Math.abs(s.sample.px)).toBeLessThanOrEqual(Math.SQRT1_2)
        expect(Math.abs(s.sample.py)).toBeLessThanOrEqual(Math.SQRT1_2)
        expect(s.at).toBeGreaterThanOrEqual(0)
        expect(s.at).toBeLessThanOrEqual(1)
      }
    }
  })

  it('fill the pixel across the travel in every short run of neighbours', () => {
    const n = 60
    const set = evenSet(ordered(n), () => [45, 0]).sort((a, b) => a.sample.t - b.sample.t)
    for (let k = 0; k + 6 <= n; k++) {
      const run = set.slice(k, k + 6).map((s) => s.sample.py + 0.5).sort((a, b) => a - b)
      let gap = run[0]! + 1 - run[5]!
      for (let i = 1; i < 6; i++) gap = Math.max(gap, run[i]! - run[i - 1]!)
      expect(gap).toBeLessThan(0.45)
    }
  })

  it('are drawn in the order of their moments, the same every time', () => {
    const a = evenSet(ordered(72), (u) => [50 * Math.cos(6 * u), 20])
    const b = evenSet(ordered(72), (u) => [50 * Math.cos(6 * u), 20])
    expect(a).toEqual(b)
    for (let k = 1; k < a.length; k++) expect(a[k]!.at).toBeGreaterThanOrEqual(a[k - 1]!.at)
    expect(new Set(a.map((s) => s.sample.index)).size).toBe(72)
  })
})

describe('the spread of a sample along the ball\'s motion', () => {
  const moving = (sec: number) => ({ ...REST_POSE, x: 14 * (sec / shutter), tiltZ: 0.05 * (sec / shutter) })
  const n = 60

  it('moves a point of the ball by one sample spacing of its own travel', () => {
    const s = spreadAt(shutter / 2, shutter / n, moving, pose, W, H)
    for (const mark of [TRAVEL_MARKS[0]!, TRAVEL_MARKS[1]!, TRAVEL_MARKS[9]!]) {
      const a = new THREE.Vector3(...mark).applyMatrix4(s.before)
      const b = new THREE.Vector3(...mark).applyMatrix4(s.after)
      const hop = [((b.x - a.x) / 2) * W, ((a.y - b.y) / 2) * H]
      const at = (sec: number) => {
        const g = moving(sec)
        const camera = new THREE.PerspectiveCamera()
        applyPose(camera, pose(), W, H, null)
        const p = new THREE.Vector3(...mark).applyEuler(new THREE.Euler(g.tiltX, 0, g.tiltZ, 'XZY')).add(new THREE.Vector3(g.x, g.y, g.z)).project(camera)
        return [(p.x * 0.5 + 0.5) * W, (0.5 - p.y * 0.5) * H]
      }
      const from = at(shutter / 2 - shutter / n / 2)
      const to = at(shutter / 2 + shutter / n / 2)
      expect(hop[0]!).toBeCloseTo(to[0]! - from[0]!, 4)
      expect(hop[1]!).toBeCloseTo(to[1]! - from[1]!, 4)
      expect(Math.hypot(hop[0]!, hop[1]!)).toBeGreaterThan(0.3)
      expect(Math.hypot(hop[0]!, hop[1]!)).toBeLessThan(4)
    }
  })

  it('finds the ball under the pixel its centre lands on, and nothing in a corner of the picture', () => {
    const s = spreadAt(shutter / 2, shutter / n, moving, pose, W, H)
    const g = moving(shutter / 2)
    const camera = new THREE.PerspectiveCamera()
    applyPose(camera, pose(), W, H, null)
    const centre = new THREE.Vector3(0, SPREAD_BALL.sphere[0], 0)
    const ndc = centre.clone().applyEuler(new THREE.Euler(g.tiltX, 0, g.tiltZ, 'XZY')).add(new THREE.Vector3(g.x, g.y, g.z)).project(camera)
    const ray = (x: number, y: number) => {
      const from = new THREE.Vector3(x, y, -1).applyMatrix4(s.toWorld).applyMatrix4(s.toBall)
      const to = new THREE.Vector3(x, y, 1).applyMatrix4(s.toWorld).applyMatrix4(s.toBall)
      return new THREE.Ray(from, to.sub(from).normalize())
    }
    expect(ray(ndc.x, ndc.y).distanceToPoint(centre)).toBeLessThan(1e-3)
    expect(ray(-0.98, 0.98).distanceToPoint(centre)).toBeGreaterThan(SPREAD_BALL.sphere[1] * 2)
    expect(SPREAD_BALL.sphere[1]).toBeGreaterThan(config.globe.sphereDiameterMm / 2)
    expect(SPREAD_BALL.base[0]).toBeGreaterThan(config.globe.baseDiameterMm / 2)
  })
})

describe('which tier draws with even times', () => {
  it('the final tier and its counted form do, draft, review and a plain count do not', () => {
    const from = config.tiers.final.motion.evenFromPx
    expect(from).toBeGreaterThan(0)
    expect(tierEvenFromPx('final')).toBe(from)
    expect(tierEvenFromPx('final-60')).toBe(from)
    expect(tierSamples('final-60')).toBe(60)
    expect(tierMotion('final-60')).toBeUndefined()
    expect(tierEvenFromPx('samples-60')).toBeUndefined()
    expect(tierEvenFromPx('draft')).toBeUndefined()
    expect(tierEvenFromPx('review')).toBeUndefined()
    expect(() => tierSamples('final-0')).toThrow(/no such tier/)
  })

  it('a frame at rest stays under the floor at the base count, so it is drawn as it always was', () => {
    const from = tierEvenFromPx('final')!
    const motion = tierMotion('final')!
    expect(from).toBeLessThan(tierSamples('final') * motion.spacingPx)
    expect(framesamples(tierSamples('final'), motion, () => from)).toBe(tierSamples('final'))
  })

  it('the masters name the rule in full and draw a counted frame at the final tier', () => {
    const rule = sampleRule('film-b') as { base: number; motion: { spacingPx: number; maxSamplesPerFrame: number; evenFromPx: number }; tier: string }
    expect(rule.motion).toEqual({ spacingPx: 0.75, maxSamplesPerFrame: config.tiers.final.motion.maxSamplesPerFrame, evenFromPx: config.tiers.final.motion.evenFromPx })
    expect(tierOf(60, rule)).toBe('final-60')
    expect(tierOf(60, sampleRule('film-b', 60))).toBe('samples-60')
    expect(tierOf(60, { base: 24, motion: { spacingPx: 0.75, maxSamplesPerFrame: 96 }, tier: 'final' })).toBe('samples-60')
    expect(ruleCount(rule, 678, { samples: 100, travelPx: 74.3 })).toBe(100)
    expect(() => ruleCount(rule, 678, { samples: rule.motion.maxSamplesPerFrame + 1 })).toThrow(/whole count/)
    expect(countsLine(rule, countFacts([24, 100], 24, 677))).toBe(
      `the count of a frame follows its motion (tiers.final.motion: a sample every 0.75 px of travel, at most ${rule.motion.maxSamplesPerFrame}, even sample times from ${rule.motion.evenFromPx} px of travel): 1 of these 2 frames draws more than the base of 24 samples, the most is 100 (frame 678); 124 samples in all, 2.58 times the base`,
    )
  })

  it('a chunk drawn under the rule as it was cannot stand for one drawn under this rule', () => {
    const rule = sampleRule('film-b') as { motion: { spacingPx: number; maxSamplesPerFrame: number; evenFromPx: number } }
    const record = { what: 'film-b', first: 0, last: 1, engineHash: 'e', samples: 24, format: 'uhd', fps: 60, test: false, renderer: 'r', calibration: 'c', encoderArgs: ['x'], frameSamples: [24, 30] }
    const want = { what: 'film-b', first: 0, last: 1, engineHash: 'e', samples: 24, format: 'uhd', fps: 60, test: false, renderer: 'r', calibration: 'c', encoderArgs: ['x'], motion: rule.motion }
    const old = { spacingPx: 0.75, maxSamplesPerFrame: 96 }
    const now = recordMatchesRun({ ...record, motion: rule.motion }, want)
    expect(recordMatchesRun({ ...record, motion: old }, want)).toBe(false)
    expect(recordMatchesRun({ ...record, motion: { ...old, maxSamplesPerFrame: rule.motion.maxSamplesPerFrame } }, want)).toBe(false)
    expect(now).toBe(recordMatchesRun({ ...record, motion: JSON.parse(JSON.stringify(rule.motion)) }, want))
  })
})
