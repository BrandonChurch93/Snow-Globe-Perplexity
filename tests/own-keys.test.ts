import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cameraById, cameras, config, particleKinds, tierEvenFromPx, tierMotion, tierSamples, tierTravelRule, tiers } from '../src/config'
import { poseById, poseOf, poseWith } from '../src/scene/cameras'

// A name that comes from outside (the address, a tool's argument) is looked up among a table's own entries only. A name
// every object carries, and one that something has put on every object, is no camera, no tier, no kind and no asset set.
const CARRIED = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', 'toLocaleString', 'propertyIsEnumerable']
const PLANTED = 'a-name-put-on-every-object'

/** Looks while every object inherits `value` under PLANTED, and takes it away again whatever comes of the look. */
function planted<T>(value: unknown, look: () => T): T {
  Object.defineProperty(Object.prototype, PLANTED, { value, configurable: true, enumerable: false, writable: true })
  try {
    return look()
  } finally {
    delete (Object.prototype as unknown as Record<string, unknown>)[PLANTED]
  }
}

describe('a name from outside finds only what a table holds itself', () => {
  it('leaves nothing behind on every object when it plants a name', () => {
    expect(planted(1, () => ({}) as Record<string, unknown>)[PLANTED]).toBeUndefined()
    expect(PLANTED in {}).toBe(false)
  })

  it('names no camera the config does not hold', () => {
    for (const id of CARRIED) expect(() => cameraById(id), id).toThrow(/no such camera/)
    expect(() => planted(cameras.hero, () => cameraById(PLANTED))).toThrow(/no such camera/)
    for (const id of Object.keys(cameras)) expect(cameraById(id)).toBe(cameras[id])
  })

  it('names no tier the config does not hold', () => {
    const final = tiers.final!
    expect(final.motion).toBeDefined()
    for (const id of CARRIED) {
      expect(() => tierSamples(id), id).toThrow(/no such tier/)
      expect(tierMotion(id), id).toBeUndefined()
      expect(tierEvenFromPx(id), id).toBeUndefined()
      expect(tierTravelRule(id), id).toBeUndefined()
    }
    planted(final, () => {
      expect(() => tierSamples(PLANTED)).toThrow(/no such tier/)
      expect(tierMotion(PLANTED)).toBeUndefined()
      expect(tierEvenFromPx(PLANTED)).toBeUndefined()
      expect(tierTravelRule(PLANTED)).toBeUndefined()
    })
    for (const id of Object.keys(tiers)) {
      expect(tierSamples(id)).toBe(tiers[id]!.samplesPerFrame)
      expect(tierMotion(id)).toBe(tiers[id]!.motion)
      expect(tierEvenFromPx(id)).toBe(tiers[id]!.motion?.evenFromPx)
      expect(tierTravelRule(id)).toBe(tiers[id]!.motion)
    }
    expect(tierSamples('samples-12')).toBe(12)
    expect(tierSamples('final-48')).toBe(48)
    expect(tierEvenFromPx('final-48')).toBe(final.motion!.evenFromPx)
    expect(tierEvenFromPx('samples-12')).toBeUndefined()
    expect(tierTravelRule('final-48')).toBe(final.motion)
    expect(tierTravelRule('samples-12')).toBeUndefined()
  })

  it('names no kind of particle for a season the config does not hold', () => {
    for (const id of CARRIED) expect(() => particleKinds(id), id).toThrow(/no particles for season/)
    expect(() => planted(particleKinds(config.defaultSeason), () => particleKinds(PLANTED))).toThrow(/no particles for season/)
    for (const season of config.seasons) expect(particleKinds(season).length).toBeGreaterThan(0)
  })

  it('gives a camera no lens but its own', () => {
    const rig = cameras.hero!
    const plain = poseOf(rig)
    for (const id of [...CARRIED, 'no-such-camera']) {
      const pose = poseWith(id, rig)
      expect(pose.focusMm, id).toBe(plain.focusMm)
      expect(pose.apertureMm, id).toBe(plain.apertureMm)
      expect(() => poseById(id), id).toThrow(/no such camera/)
    }
    planted({ apertureMm: 99, focusShiftMm: 99 }, () => {
      const pose = poseWith(PLANTED, rig)
      expect(pose.focusMm).toBe(plain.focusMm)
      expect(pose.apertureMm).toBe(plain.apertureMm)
    })
    for (const id of Object.keys(cameras)) {
      expect(poseWith(id, cameras[id]!)).toEqual(poseById(id))
      expect(poseById(id).apertureMm, id).not.toBe(plain.apertureMm)
    }
  })

  // These stand where no test can call them (a capture page, the sound engine's own lines): held by their text.
  it('asks the asset sets and the landing bars by their own names, and takes a view only if the app has it', () => {
    const read = (file: string): string => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    const capture = read('capture/showcase.ts')
    expect(capture.includes('if (!Object.hasOwn(config.assetSets, id)) throw new Error(`no such asset set: ${id}`)'), 'the asset sets').toBe(true)
    expect(/\bin config\.assetSets\b/.test(capture), 'the asset sets, by `in`').toBe(false)
    expect(capture.includes("if (view !== 'none' && view !== '' && !(VIEWS as readonly string[]).includes(view)) throw new Error(`no such view: ${view}`)"), 'the views').toBe(true)
    const sound = read('audio/index.ts')
    expect(sound.includes('Object.hasOwn(LANDING_BAR, season)'), 'the landing bars').toBe(true)
    expect(/\bin LANDING_BAR\b/.test(sound), 'the landing bars, by `in`').toBe(false)
  })
})
