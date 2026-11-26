import { describe, expect, it } from 'vitest'
import { config, tierMotion, tierSamples } from '../src/config'
import { framesamples, shutterTravelPx } from '../src/film/motion'
import { REST_POSE } from '../src/shake/table'
import { poseById } from '../src/scene/cameras'

const shutter = config.film.shutterDegrees / 360 / config.film.fps
const pose = () => poseById('hero')
const at = (x: number) => (sec: number) => ({ ...REST_POSE, x: x * (sec / shutter) })

describe('the sample count follows the motion', () => {
  it('a ball and a camera at rest travel nothing, so the tier keeps its own count', () => {
    const travel = shutterTravelPx(1, shutter, () => REST_POSE, pose, 3840, 2160)
    expect(travel).toBe(0)
    expect(framesamples(tierSamples('final'), tierMotion('final'), () => travel)).toBe(tierSamples('final'))
  })

  it('a ball that moves fast gets more samples, never above the tier maximum, and a bigger format asks for more', () => {
    const motion = tierMotion('final')!
    const uhd = shutterTravelPx(1, shutter, at(12), pose, 3840, 2160)
    const hd = shutterTravelPx(1, shutter, at(12), pose, 1920, 1080)
    expect(uhd).toBeGreaterThan(hd)
    expect(framesamples(24, motion, () => uhd)).toBeGreaterThan(24)
    expect(framesamples(24, motion, () => 1e6)).toBe(motion.maxSamplesPerFrame)
  })

  it('draft and review have no motion rule, so their pictures keep a fixed count', () => {
    expect(tierMotion('draft')).toBeUndefined()
    expect(tierMotion('review')).toBeUndefined()
    expect(framesamples(tierSamples('review'), tierMotion('review'), () => 1e6)).toBe(tierSamples('review'))
  })
})
