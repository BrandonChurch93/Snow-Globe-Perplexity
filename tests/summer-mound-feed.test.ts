import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import '../src/seasons/summer/arrival'
import { FEED, SAND_FED, feedCap, feedSurge, sandFeed } from '../src/seasons/summer/slab'

// Decision 294, W4: summer's mound was not there on the landing frame (film 1440), a wedge four frames on and whole by
// 1452: it came as one piece scaled up. It is fed by the sand that jumps and falls: a plainly denser spill off the ledge
// at the landing, and the mound growing under it over about two seconds, a low fan first and the peak last, ending in
// the same mound as today.
describe("summer's mound at the landing", () => {
  const FRAME = 1 / 60
  const PEAK = 10.2
  /** What stands of sand that will stand `tall` mm high, `seconds` after the foot came down. */
  const stands = (tall: number, seconds: number): number => {
    const cap = feedCap(seconds)
    return cap === Infinity ? tall : cap > 0 ? cap * (1 - Math.exp(-tall / cap)) : 0
  }
  const steps = Array.from({ length: 121 }, (_, k) => (k * FEED.seconds) / 120)

  it('is nothing on the landing frame and the heap of the still pictures from two seconds on', () => {
    expect(FEED.seconds).toBeGreaterThanOrEqual(1.6)
    expect(FEED.seconds).toBeLessThanOrEqual(2.4)
    expect(feedCap(0)).toBe(0)
    for (const tall of [0.3, 2, 5, PEAK]) expect(stands(tall, 0)).toBe(0)
    // Before the landing, at rest and from the end of the feed no cut is left: every height is its own.
    for (const s of [-1, -1e-9, FEED.seconds, FEED.seconds + FRAME, 10, Infinity, NaN]) {
      expect(feedCap(s)).toBe(Infinity)
      expect(sandFeed(s).flat).toBe(0)
      for (const tall of [0.3, 2, 5, PEAK]) expect(stands(tall, s)).toBe(tall)
    }
    // And it comes to that without a step: a frame before the end the peak lacks less than a hundredth of a millimetre.
    expect(PEAK - stands(PEAK, FEED.seconds - FRAME)).toBeLessThan(0.01)
    expect(PEAK - stands(PEAK, FEED.seconds - FRAME)).toBeGreaterThan(0)
  })

  it('grows all the time, and nothing of it is ever higher than it will stand', () => {
    for (const tall of [0.3, 1, 2, 5, PEAK]) {
      let was = 0
      for (const s of steps.slice(0, -1)) {
        const now = stands(tall, s)
        expect(now).toBeGreaterThanOrEqual(was)
        expect(now).toBeLessThanOrEqual(tall)
        if (s > 0) expect(now).toBeGreaterThan(0)
        was = now
      }
    }
    // What will stand higher never stands lower, and from a quarter of a second on it stands plainly higher: the heap
    // keeps the order of its form and is no flat plate.
    for (const s of steps.slice(1, -1)) {
      expect(stands(PEAK, s)).toBeGreaterThanOrEqual(stands(2, s))
      if (s >= 0.25) expect(stands(PEAK, s)).toBeGreaterThan(1.02 * stands(2, s))
    }
  })

  it('is a low fan first and its peak last', () => {
    const when = (tall: number, share: number): number => steps.find((s) => stands(tall, s) >= share * tall) ?? FEED.seconds
    // The fan's edge (sand 0.3 mm deep) is nine tenths there inside the first half second, the peak after one and a half.
    expect(when(0.3, 0.9)).toBeLessThan(0.5)
    expect(when(PEAK, 0.9)).toBeGreaterThan(1.4)
    expect(when(PEAK, 0.9)).toBeLessThan(FEED.seconds)
    // The order holds all the way up: the lower the sand, the sooner it is whole.
    let before = 0
    for (const tall of [0.3, 1, 2, 4, 7, PEAK]) {
      const at = when(tall, 0.9)
      expect(at).toBeGreaterThanOrEqual(before)
      before = at
    }
    // Four frames on (film 1444) the heap is a fan under a tenth of a millimetre, where a wedge stood; at 1452 it is
    // not whole, as it was, but under a millimetre; half a second on the peak stands under a quarter of its height.
    expect(stands(PEAK, 4 * FRAME)).toBeLessThan(0.2)
    expect(stands(PEAK, 12 * FRAME)).toBeLessThan(1)
    expect(stands(PEAK, 0.5)).toBeLessThan(PEAK / 4)
    expect(stands(PEAK, 1)).toBeGreaterThan(PEAK / 3)
    expect(stands(PEAK, 1)).toBeLessThan(PEAK * 0.75)
  })

  it('pours plainly more off the ledge at the landing, and comes down to the standing fall', () => {
    const S = FEED.spill
    for (const s of [-1, Infinity, NaN, S.over, S.over + 1]) expect(feedSurge(s)).toBe(0)
    for (const s of [0, FRAME, S.hold / 2, S.hold]) expect(feedSurge(s)).toBe(1)
    let was = 1
    for (const s of steps) {
      const now = feedSurge(s)
      expect(now).toBeLessThanOrEqual(was)
      expect(now).toBeGreaterThanOrEqual(0)
      was = now
    }
    expect(feedSurge(S.over - FRAME)).toBeLessThan(0.01)
    // Plainly denser: at the landing a thread carries at least twice the length of sand and is half as thick again.
    expect(1 + S.long).toBeGreaterThanOrEqual(2)
    expect(1 + S.wide).toBeGreaterThanOrEqual(1.5)
    // The surge is over when the heap is whole, not before the fan has come and not after.
    expect(S.hold).toBeGreaterThanOrEqual(0.25)
    expect(S.over).toBeLessThanOrEqual(FEED.seconds)
    expect(sandFeed(0.1).surge).toBe(1)
    expect(sandFeed(0.1).flat).toBeCloseTo(1 / feedCap(0.1), 9)
    expect(sandFeed(0).flat).toBe(FEED.flat)
  })

  it('is one law in the shaders and here, on the rows the fall has', () => {
    expect(SAND_FED).toContain('uniform vec4 uSandFeed;')
    expect(SAND_FED).toContain('return uSandFeed.x > 0.0 ? (1.0 - exp(-tall * uSandFeed.x)) / uSandFeed.x : tall;')
    const slab = readFileSync('src/seasons/summer/slab.ts', 'utf8')
    // The skin, its normals and its shadow are cut alike.
    expect(slab).toContain('if (uSandFeed.x > 0.0) slabTall = sandFed(slabTall);')
    expect(slab).toContain('float slabLow = exp(-max(position.y - ')
    expect(slab).toContain('sandFed(max(position.y - ')
    const update = slab.slice(slab.indexOf('export function update(moment: KitMoment)'))
    expect(update).toContain('const fed = sandFeed(arrivalPart.sinceDown(moment))')
    expect(update).toContain('sandFed.value.set(fed.flat, fed.surge, 0, 0)')
    // While it is fed the heap is not scaled as one piece.
    expect(update).toContain('const grown = fed.flat > 0 && come > 0 ? 1 : come')
    const grains = readFileSync('src/seasons/summer/arrival.ts', 'utf8')
    // The grains on the heap lie as high as it stands; a grain in the air comes down on it where it stands.
    expect(grains).toContain('nowAt.y = uSandFeed.x > 0.0 ? ')
    expect(grains).toContain('float low = (uSandFeed.x > 0.0 ? ')
    // The spill: the threads the fall has, longer and thicker. No row is added to the fall (tests/summer-fall.test.ts
    // holds its count).
    expect(grains).toContain('if (uSandFeed.y > 0.0) open *= 1.0 + ')
    expect(grains).toContain('float fat = uSandFeed.y > 0.0 ? 1.0 + ')
    expect(grains).toContain('export const sinceDown = (moment: KitMoment): number => {')
  })

  it('lets the fall come down on the heap as it stands, not on the heap it will be', () => {
    const grains = readFileSync('src/seasons/summer/arrival.ts', 'utf8')
    const path = grains.slice(grains.indexOf('vec3 grainPath(float tau) {'), grains.indexOf('const VERT_MAIN'))
    // How far under its place at rest sand lies while the heap is fed: all that the cut takes of its height.
    expect(grains).toContain('float fedUnder(float y) {')
    expect(grains).toContain('return tall - sandFed(tall);')
    // Each of the fall's three ways down ends on the fed heap: the loose grain, the thread that stays where it lands,
    // and the thread that lands and runs down the slope (its fall to where it touches, its run along the heap).
    expect(path).toContain('if (uSandFeed.x > 0.0) loose.y -= fedUnder(to.y) * clamp(tau / max(T, 1e-5), 0.0, 1.0);')
    expect(path).toContain('if (uSandFeed.x > 0.0) fly.y -= fedUnder(to.y) * clamp(tau / max(T, 1e-5), 0.0, 1.0);')
    expect(path).toContain('fly.y -= fedUnder(touchY) * clamp(tau / max(T, 1e-5), 0.0, 1.0);')
    expect(path).toContain('run.y -= fedUnder(run.y);')
    // What that is worth: twelve frames on (film 1452) a thread to the peak's place would end over nine millimetres up
    // in the air, on a ruled line where the whole heap's flank will be.
    expect(PEAK - stands(PEAK, 12 * FRAME)).toBeGreaterThan(9)
    // With no feed on nothing is taken: the fall of every other frame is drawn as it was.
    for (const s of [-1, FEED.seconds, 10]) expect(PEAK - stands(PEAK, s)).toBe(0)
  })
})
