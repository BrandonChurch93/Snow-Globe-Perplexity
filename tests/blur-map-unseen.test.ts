import { describe, expect, it } from 'vitest'
import { lensPlace } from '../src/globe/lens'
import { STAGE_VERT_MAIN } from '../src/core/materials'
import { sphereCentreMm } from '../src/scene/cameras'

type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}
const moved = (a: V3, by: V3, mm: number): V3 => [a[0] + mm * by[0], a[1] + mm * by[1], a[2] + mm * by[2]]

// The eye of film frame 30 of the winter landing, where one such vertex blurred the backdrop beside the frond
const centre: V3 = [0, sphereCentreMm, 0]
const eye: V3 = [-16.62, 89.62, 239.96]
const back = unit(sub(eye, [0, 66.47, 0]))
const right = unit(cross([0, 1, 0], back))
const up = cross(back, right)
const view = (p: V3): V3 => {
  const r = sub(p, eye)
  return [dot(r, right), dot(r, up), dot(r, back)]
}

function texels(p: V3, focus: number) {
  const here = lensPlace(p, eye, centre)
  const a = lensPlace(p, moved(eye, right, 4), centre)
  const b = lensPlace(p, moved(eye, up, 4), centre)
  const v = view(here.apparent)
  const va = view(a.apparent)
  const vb = view(b.apparent)
  const across = ((va[0] - 4) / va[2] - v[0] / v[2]) / 4
  const down = ((vb[1] - 4) / vb[2] - v[1] / v[2]) / 4
  const image = 1 / Math.max(Math.abs(across - focus) > Math.abs(down - focus) ? across : down, 1e-5)
  const seen = here.seen && a.seen && b.seen
  return { seen: [here.seen, a.seen, b.seen], across, down, image, placed: -v[2], depth: seen ? image : Math.max(-v[2], 1) }
}

describe('the blur map at the limit of what the ball shows', () => {
  const focus = 1 / 241.6

  it('meets a point that the eye sees and the eye moved across does not, whose parallax is the limb\'s', () => {
    const r = texels([38.15, 83, -24.44], focus)
    expect(r.seen).toEqual([true, false, true])
    expect(r.across).toBeLessThan(0)
    expect(r.image).toBeGreaterThan(99999)
    expect(r.placed).toBeGreaterThan(280)
    expect(r.placed).toBeLessThan(295)
  })

  it('gives it the depth it is placed at, and leaves a point all three eyes see to its image', () => {
    const lost = texels([38.15, 83, -24.44], focus)
    expect(lost.depth).toBe(lost.placed)
    const kept = texels([-30, sphereCentreMm - 12, -25], focus)
    expect(kept.seen).toEqual([true, true, true])
    expect(kept.depth).toBe(kept.image)
    expect(Math.abs(kept.depth - kept.placed)).toBeLessThan(10)
  })

  it('states the same rule in the shader of the texels view, after the choice of the parallax', () => {
    const branch = STAGE_VERT_MAIN.slice(STAGE_VERT_MAIN.indexOf('if (uDiag =='))
    expect(branch).toContain('lensPlace(stageWorld.xyz, cameraPosition + 4.0 * stageRight, stageSeenA)')
    expect(branch).toContain('lensPlace(stageWorld.xyz, cameraPosition + 4.0 * stageUp, stageSeenB)')
    const choice = branch.indexOf('vStageAux.y = 1.0 / max(')
    const rule = branch.indexOf('if (vStageSeen + stageSeenA + stageSeenB < 2.5) vStageAux.y = max(-stageView.z, 1.0);')
    expect(choice).toBeGreaterThan(0)
    expect(rule).toBeGreaterThan(choice)
  })
})
