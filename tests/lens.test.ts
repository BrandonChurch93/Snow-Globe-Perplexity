import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { LENS_GLSL, LENS_STEPS, innerRadiusMm, lensIor, lensPlace, lensRadiusMm } from '../src/globe/lens'
import { poseById, sphereCentreMm } from '../src/scene/cameras'

type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(...a)
const unit = (a: V3): V3 => {
  const l = len(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
const centre: V3 = [0, sphereCentreMm, 0]

function missOf(p: V3, eye: V3): number {
  const r = lensPlace(p, eye, centre)
  const d = unit(sub(r.exit, eye))
  const n = unit(sub(r.exit, centre))
  const eta = 1 / lensIor
  const c = dot(n, d)
  const k = 1 - eta * eta * (1 - c * c)
  const m = eta * c + Math.sqrt(k)
  const t: V3 = [eta * d[0] - m * n[0], eta * d[1] - m * n[1], eta * d[2] - m * n[2]]
  const to = sub(p, r.exit)
  const along = dot(to, t)
  return len([to[0] - along * t[0], to[1] - along * t[1], to[2] - along * t[2]])
}

describe('the lens', () => {
  it('reads its numbers from the config', () => {
    expect(lensRadiusMm).toBe(config.globe.sphereDiameterMm / 2)
    expect(innerRadiusMm).toBe(lensRadiusMm - config.globe.glassThicknessMm)
    expect(lensIor).toBe(config.globe.liquidIor)
    expect(LENS_GLSL).toContain(`i < ${LENS_STEPS}`)
  })

  it('finds the ray that obeys Snell for points all through the liquid, from every camera', () => {
    let worst = 0
    let seen = 0
    for (const id of Object.keys(config.cameras)) {
      const e = poseById(id).position
      const eye: V3 = [e.x, e.y, e.z]
      for (let i = 0; i < 400; i++) {
        const a = i * 2.399963
        const y = 1 - (2 * (i + 0.5)) / 400
        const rr = Math.sqrt(1 - y * y)
        const rad = innerRadiusMm * Math.cbrt(((i * 37) % 400) / 400 + 0.001) * 0.72
        const p: V3 = [centre[0] + Math.cos(a) * rr * rad, centre[1] + y * rad, centre[2] + Math.sin(a) * rr * rad]
        const r = lensPlace(p, eye, centre)
        expect(r.seen).toBe(true)
        seen++
        worst = Math.max(worst, missOf(p, eye))
      }
    }
    expect(seen).toBe(400 * Object.keys(config.cameras).length)
    expect(worst).toBeLessThan(2e-4)
  })

  it('leaves the centre on the line to the eye, at its optical path length', () => {
    const eye: V3 = [0, sphereCentreMm, 620]
    const r = lensPlace(centre, eye, centre)
    expect(r.apparent[0]).toBeCloseTo(0, 9)
    expect(r.apparent[1]).toBeCloseTo(sphereCentreMm, 9)
    expect(len(sub(r.apparent, eye))).toBeCloseTo(620 - lensRadiusMm + lensIor * lensRadiusMm, 9)
    expect(r.pathMm).toBeCloseTo(lensRadiusMm, 9)
  })

  it('magnifies the middle by about the index for a far eye', () => {
    const eye: V3 = [0, sphereCentreMm, 1e6]
    const b = 0.5
    const r = lensPlace([b, sphereCentreMm, 0], eye, centre)
    const angle = Math.atan2(r.apparent[0] - eye[0], eye[2] - r.apparent[2])
    const plain = Math.atan2(b, 1e6)
    expect(angle / plain).toBeGreaterThan(lensIor * 0.99)
    expect(angle / plain).toBeLessThan(lensIor * 1.01)
  })

  it('is mirror symmetric and keeps order along a ray', () => {
    const eye: V3 = [40, sphereCentreMm + 90, 600]
    const p: V3 = [12, sphereCentreMm - 9, 17]
    const q: V3 = [-12, sphereCentreMm - 9, 17]
    const a = lensPlace(p, [eye[0], eye[1], eye[2]], centre)
    const b = lensPlace(q, [-eye[0], eye[1], eye[2]], centre)
    expect(b.apparent[0]).toBeCloseTo(-a.apparent[0], 9)
    expect(b.apparent[1]).toBeCloseTo(a.apparent[1], 9)
    expect(b.apparent[2]).toBeCloseTo(a.apparent[2], 9)
    const near = lensPlace([0, sphereCentreMm, 20], [0, sphereCentreMm, 620], centre)
    const far = lensPlace([0, sphereCentreMm, -20], [0, sphereCentreMm, 620], centre)
    expect(len(sub(far.apparent, [0, sphereCentreMm, 620]))).toBeGreaterThan(len(sub(near.apparent, [0, sphereCentreMm, 620])))
  })

  it('puts what cannot be seen on the outline', () => {
    const eye: V3 = [0, sphereCentreMm, 620]
    const r = lensPlace([innerRadiusMm - 0.2, sphereCentreMm, 0], eye, centre)
    expect(r.seen).toBe(false)
    const tangent = Math.asin(lensRadiusMm / 620)
    const angle = Math.atan2(r.apparent[0], 620 - r.apparent[2])
    expect(angle).toBeCloseTo(tangent, 6)
  })

  it('does nothing for an eye inside the glass', () => {
    const p: V3 = [3, sphereCentreMm + 4, 5]
    const r = lensPlace(p, [0, sphereCentreMm, 10], centre)
    expect(r.apparent).toEqual(p)
  })
})
