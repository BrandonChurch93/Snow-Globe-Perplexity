import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { config, tierEvenFromPx, tierMotion, tierSamples } from '../src/config'
import { sampleSet } from '../src/core/sampler'
import { SPREAD_BALL, TRAVEL_MARKS, centrePacePx, evenSet, framesamples, lensOrder, shutterTravelPx, spreadAt, spreadReach } from '../src/film/motion'
import { SPREAD } from '../src/core/accumulator'
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

  it('have even times, each the middle of its part, and keep the numbers of the set and its lens points as a set', () => {
    for (const n of [24, 60, 91, 128]) {
      const own = ordered(n)
      const set = evenSet(own, () => [0, 0])
      const order = lensOrder(own)
      expect([...order].sort((a, b) => a - b)).toEqual(own.map((_, k) => k))
      expect(lensOrder(own)).toEqual(order)
      set.forEach((s, k) => {
        expect(s.at).toBeCloseTo((k + 0.5) / n, 12)
        expect(s.sample.t).toBe(s.at)
        expect(s.sample.index).toBe(own[k]!.index)
        expect(s.sample.lu).toBe(own[order[k]!]!.lu)
        expect(s.sample.lv).toBe(own[order[k]!]!.lv)
        expect(s.sample.of).toBe(n)
        expect(Math.floor(s.sample.t * n)).toBe(k)
      })
    }
  })

  it('deal the lens points so that they lean with the place in the pixel and the moment as in the set as it stands, whatever the travel', () => {
    const lean = (a: number[], b: number[]) => {
      const ma = a.reduce((x, y) => x + y, 0) / a.length
      const mb = b.reduce((x, y) => x + y, 0) / b.length
      const c = (p: number[], q: number[], mp: number, mq: number) => p.reduce((x, y, i) => x + (y - mp) * (q[i]! - mq), 0)
      return c(a, b, ma, mb) / Math.sqrt(c(a, a, ma, ma) * c(b, b, mb, mb))
    }
    const leans = (set: { px: number; py: number; t: number; lu: number; lv: number }[]) =>
      [set.map((s) => s.px), set.map((s) => s.py), set.map((s) => s.t)].flatMap((place) => [lean(place, set.map((s) => s.lu)), lean(place, set.map((s) => s.lv))])
    for (const n of [24, 33, 51, 99, 128]) {
      const was = leans(ordered(n))
      for (const [vx, vy] of [[0.5, 0], [-3, 0], [2, 2], [0, -40], [-20, 30]] as const) {
        const now = leans(evenSet(ordered(n), () => [vx, vy]).map((s) => s.sample))
        now.forEach((v, i) => expect(Math.abs(v - was[i]!)).toBeLessThan(0.05))
      }
    }
  })

  it('deal the lens points so that their mean under the spread stays near nothing all through the shutter', () => {
    // Measured with this sum (white noise gives 0.344), five travels each: the set's own order 0.09 to 0.30; the deal at
    // 24 samples 0.017 to 0.043, 26: 0.011 to 0.023, 33: 0.009 to 0.018, 51: 0.006 to 0.009, 96 to 128: 0.005 to 0.007.
    // Under one even stride the lens point along the travel swung at 51 samples with a period of 12.8 samples holding
    // 0.26 of its variance (9.4 px on the picture, the beads of a small light's streak); under the deal the periods over
    // 6 samples hold 0.02 to 0.07 together.
    const tent = [1, 2, 3, 4, 3, 2, 1].map((w) => w / 16)
    const unit = (v: number[]) => {
      const m = v.reduce((x, y) => x + y, 0) / v.length
      const w = v.map((x) => x - m)
      const norm = Math.sqrt(w.reduce((x, y) => x + y * y, 0))
      return w.map((x) => x / norm)
    }
    const swing = (lens: number[], moments: number[]) => {
      const rank = unit(lens.map((_, k) => k))
      const own = unit(lens)
      const trend = unit(moments).reduce((x, v, k) => x + v * own[k]!, 0)
      const left = own.map((v, k) => v - trend * rank[k]!)
      let sum = 0
      for (let i = 0; i < left.length; i++) {
        let mean = 0
        for (let k = -3; k <= 3; k++) if (i + k >= 0 && i + k < left.length) mean += tent[k + 3]! * left[i + k]!
        sum += mean * mean
      }
      return sum
    }
    for (const n of [24, 26, 33, 51, 96, 100, 128]) {
      const own = ordered(n)
      const moments = own.map((s) => s.t)
      const rest = swing(own.map((s) => s.lu), moments) + swing(own.map((s) => s.lv), moments)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0.6, 0.8], [0, -1], [-0.8, 0.6]] as const) {
        const set = evenSet(own, () => [dx * n * 0.74, dy * n * 0.74]).map((s) => s.sample).sort((a, b) => a.t - b.t)
        const now = swing(set.map((s) => s.lu), moments) + swing(set.map((s) => s.lv), moments)
        expect(now).toBeLessThan(0.05)
        expect(now).toBeLessThan(rest * 0.5)
      }
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

describe('the reach of the spread by the travel', () => {
  const { evenFromPx: even, spreadFromPx: from, spreadFullPx: full, spacingPx } = config.tiers.final.motion

  it('is none up to the travel the spread starts from, which is not under the travel of the even times', () => {
    expect(from).toBeGreaterThanOrEqual(even)
    expect(spreadReach(even, from, full)).toBe(0)
    expect(spreadReach(from, from, full)).toBe(0)
    expect(spreadReach(from - 1, from, full)).toBe(0)
    expect(spreadReach(from + 0.03, from, full)).toBeLessThan(0.01)
  })

  it('is whole, and exactly one, from the travel at which the count begins to follow it', () => {
    expect(full).toBe(tierSamples('final') * spacingPx)
    expect(spreadReach(full, from, full)).toBe(1)
    expect(spreadReach(47.24, from, full)).toBe(1)
    expect(spreadReach((from + full) / 2, from, full)).toBeCloseTo(0.5, 12)
  })

  it('grows in step with the travel in between and is carried to the pass', () => {
    let last = -1
    for (let px = from; px <= full; px += 0.5) {
      const r = spreadReach(px, from, full)
      expect(r).toBeGreaterThan(last)
      last = r
    }
    expect(spreadAt(shutter / 2, shutter / 24, () => REST_POSE, pose, W, H, 0.25).reach).toBe(0.25)
    expect(spreadAt(shutter / 2, shutter / 24, () => REST_POSE, pose, W, H).reach).toBe(1)
  })
})

describe('the weights of the spread', () => {
  const through = (period: number) => {
    const mid = (SPREAD.weights.length - 1) / 2
    const sum = SPREAD.weights.reduce((a, b) => a + b, 0)
    return Math.abs(SPREAD.weights.reduce((a, w, k) => a + w * Math.cos((2 * Math.PI * (k - mid)) / period), 0)) / sum
  }

  it('are a tent about the sample itself', () => {
    const w = SPREAD.weights
    expect(w.length % 2).toBe(1)
    for (let k = 0; k < w.length; k++) expect(w[k]).toBe(w[w.length - 1 - k])
    for (let k = 1; k <= (w.length - 1) / 2; k++) expect(w[k]! - w[k - 1]!).toBe(1)
  })

  it('let nothing through of a row of copies two or four spacings apart, and little of three', () => {
    expect(through(2)).toBeLessThan(1e-12)
    expect(through(4)).toBeLessThan(1e-12)
    expect(through(3)).toBeLessThan(0.07)
    expect(through(40)).toBeGreaterThan(0.95)
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
    expect(rule.motion).toEqual({ spacingPx: 0.75, maxSamplesPerFrame: config.tiers.final.motion.maxSamplesPerFrame, evenFromPx: config.tiers.final.motion.evenFromPx, spreadFromPx: config.tiers.final.motion.spreadFromPx, spreadFullPx: config.tiers.final.motion.spreadFullPx, slow: config.deliver.master.slow })
    expect(tierOf(60, rule)).toBe('final-60')
    expect(tierOf(60, sampleRule('film-b', 60))).toBe('samples-60')
    expect(tierOf(60, { base: 24, motion: { spacingPx: 0.75, maxSamplesPerFrame: 96 }, tier: 'final' })).toBe('samples-60')
    expect(ruleCount(rule, 678, { samples: 100, travelPx: 74.3 })).toBe(100)
    expect(() => ruleCount(rule, 678, { samples: rule.motion.maxSamplesPerFrame + 1 })).toThrow(/whole count/)
    expect(countsLine(rule, countFacts([24, 100], 24, 677))).toBe(
      `the count of a frame follows its motion (tiers.final.motion: a sample every 0.75 px of travel, at most ${rule.motion.maxSamplesPerFrame}, even sample times from ${rule.motion.evenFromPx} px of travel, a spread from ${config.tiers.final.motion.spreadFromPx} px, the full spread from ${config.tiers.final.motion.spreadFullPx} px; ${config.deliver.master.slow.samples} in runs of ${config.deliver.master.slow.runFrames} frames or more under ${config.deliver.master.slow.underPx} px of travel): 1 of these 2 frames draws more than the base of 24 samples, the most is 100 (frame 678); 124 samples in all, 2.58 times the base`,
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
    expect(recordMatchesRun({ ...record, motion: { spacingPx: 0.75, maxSamplesPerFrame: rule.motion.maxSamplesPerFrame, evenFromPx: rule.motion.evenFromPx } }, want)).toBe(false)
  })
})
