import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { faceLevel } from '../src/seasons/fall/base'
import { SKITTER, skitterLeft, skitterPush } from '../src/seasons/fall/slab'

// Decision 294, W2: fall's leaves lay still for six frames after the globe came down (film 2160 to 2165), began to move
// at 2166 to 2168 and moved most at 2172 to 2182, after the first face had lit. The skitter begins on the landing frame
// itself, it is strongest in its first third of a second, and it is over where it was over: at each leaf's place.
describe("fall's leaves at the landing", () => {
  const FRAME = 1 / 60
  // The law before this what-if, to measure "more" and "farther" against.
  const BEFORE = { pushMm: 34, reachMm: 85, waveMmPerSecond: 520, slideSeconds: 0.75, tumble: 0.1, ownWaitSeconds: 0.05, clearMm: 2 }
  const pushBefore = (gap: number, own: number): number => Math.min(BEFORE.pushMm * Math.exp(-gap / BEFORE.reachMm) * (0.45 + 0.9 * own), Math.max(gap - BEFORE.clearMm, 0))
  const leftBefore = (gap: number, wait: number, long: number, seconds: number): number => {
    const t = Math.min(1, Math.max(0, (seconds - gap / BEFORE.waveMmPerSecond - BEFORE.ownWaitSeconds * wait) / (BEFORE.slideSeconds * (0.6 + 1.3 * long))))
    return (1 - t) ** 3
  }
  // Leaves all over the table: every 5 mm out from the foot to 300 mm, each with its own three numbers.
  const shares = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]
  const leaves: { gap: number; own: number; wait: number; long: number }[] = []
  for (let gap = 5; gap <= 300; gap += 5) for (const own of shares) for (const wait of [0.05, 0.5, 0.95]) for (const long of [0.05, 0.5, 0.95]) leaves.push({ gap, own, wait, long })
  const gone = (l: (typeof leaves)[number], seconds: number): number => skitterPush(l.gap, l.own) * (1 - skitterLeft(l.gap, l.wait, l.long, seconds))
  const goneBefore = (l: (typeof leaves)[number], seconds: number): number => pushBefore(l.gap, l.own) * (1 - leftBefore(l.gap, l.wait, l.long, seconds))
  const share = (test: (l: (typeof leaves)[number]) => boolean): number => leaves.filter(test).length / leaves.length
  const mean = (of: (l: (typeof leaves)[number]) => number): number => leaves.reduce((sum, l) => sum + of(l), 0) / leaves.length

  it('holds every leaf where it lay until the landing', () => {
    for (const l of leaves) {
      expect(skitterLeft(l.gap, l.wait, l.long, 0)).toBe(1)
      expect(skitterLeft(l.gap, l.wait, l.long, -1)).toBe(1)
      expect(gone(l, 0)).toBe(0)
    }
  })

  it('begins on the landing frame itself', () => {
    // The air is at the farthest leaf of the table inside two frames, and no leaf waits a frame of its own.
    expect(300 / SKITTER.waveMmPerSecond).toBeLessThan(2 * FRAME)
    expect(SKITTER.ownWaitSeconds).toBeLessThan(FRAME)
    // By the end of the landing frame's own sixtieth every leaf within a hand's breadth of the foot is on its way.
    for (const l of leaves) if (l.gap <= 100) expect(skitterLeft(l.gap, l.wait, l.long, FRAME)).toBeLessThan(1)
    expect(Math.max(...leaves.map((l) => gone(l, FRAME)))).toBeGreaterThan(3)
    // One frame on, every leaf of the table is.
    for (const l of leaves) expect(skitterLeft(l.gap, l.wait, l.long, 2 * FRAME)).toBeLessThan(1)
    // Before, not one leaf had gone a millimetre and a half three frames after the landing.
    expect(Math.max(...leaves.map((l) => goneBefore(l, 3 * FRAME)))).toBeLessThan(1.5)
  })

  it('has plainly moved the leaves by the third frame after the landing', () => {
    // 1 mm is 3 px of the preview and 12 px of the master.
    expect(share((l) => gone(l, 2 * FRAME) >= 1)).toBeGreaterThan(0.4)
    expect(share((l) => gone(l, 3 * FRAME) >= 1)).toBeGreaterThan(0.65)
    expect(share((l) => gone(l, 3 * FRAME) >= 3)).toBeGreaterThan(0.3)
    expect(Math.max(...leaves.map((l) => gone(l, 3 * FRAME)))).toBeGreaterThan(15)
    expect(share((l) => goneBefore(l, 3 * FRAME) >= 1)).toBeLessThan(0.01)
  })

  it('is strongest in its first third of a second', () => {
    const whole = mean((l) => skitterPush(l.gap, l.own))
    // Most of the way is gone in the first third of a second; before, well under half of it was.
    expect(mean((l) => gone(l, 1 / 3)) / whole).toBeGreaterThan(0.8)
    expect(mean((l) => goneBefore(l, 1 / 3)) / mean((l) => pushBefore(l.gap, l.own))).toBeLessThan(0.5)
    // A leaf goes fastest as it starts and never gathers speed again: no frame's step is longer than the one before it,
    // from the first whole frame of its slide on.
    let back = 0
    let gathers = 0
    for (const l of leaves) {
      const starts = l.gap / SKITTER.waveMmPerSecond + SKITTER.ownWaitSeconds * l.wait
      let last = Infinity
      for (let k = 1; k <= 90; k++) {
        const step = gone(l, k * FRAME) - gone(l, (k - 1) * FRAME)
        back = Math.min(back, step)
        if ((k - 1) * FRAME >= starts) {
          gathers = Math.max(gathers, step - last)
          last = step
        }
      }
    }
    expect(back).toBe(0)
    expect(gathers).toBeLessThan(1e-9)
    // The table's whole movement by frames: the first ten carry more than the next ten, those more than the ten after.
    const span = (a: number, b: number): number => mean((l) => gone(l, b * FRAME) - gone(l, a * FRAME))
    expect(span(0, 10)).toBeGreaterThan(span(10, 20) * 1.5)
    expect(span(10, 20)).toBeGreaterThan(span(20, 30) * 1.5)
  })

  it('goes before the candles', () => {
    // The first frame in which any of the three faces a viewer sees is over half its light.
    let lit = 0
    while (Math.max(faceLevel(0, lit * FRAME), faceLevel(1, lit * FRAME), faceLevel(2, lit * FRAME)) < 0.5) lit++
    expect(lit).toBeGreaterThan(6)
    const whole = mean((l) => skitterPush(l.gap, l.own))
    expect(mean((l) => gone(l, lit * FRAME)) / whole).toBeGreaterThan(0.6)
    expect(mean((l) => goneBefore(l, lit * FRAME)) / mean((l) => pushBefore(l.gap, l.own))).toBeLessThan(0.3)
  })

  it('moves more leaves, moves them farther, and turns a few of them over', () => {
    expect(SKITTER.pushMm).toBeGreaterThan(BEFORE.pushMm)
    expect(SKITTER.reachMm).toBeGreaterThan(BEFORE.reachMm)
    for (const l of leaves) expect(skitterPush(l.gap, l.own)).toBeGreaterThanOrEqual(pushBefore(l.gap, l.own))
    expect(share((l) => skitterPush(l.gap, l.own) >= 3)).toBeGreaterThan(share((l) => pushBefore(l.gap, l.own) >= 3) * 1.4)
    expect(mean((l) => skitterPush(l.gap, l.own))).toBeGreaterThan(mean((l) => pushBefore(l.gap, l.own)) * 1.8)
    expect(SKITTER.tumble).toBeGreaterThan(BEFORE.tumble)
    expect(SKITTER.tumble).toBeLessThanOrEqual(0.25)
  })

  it('never lays a leaf under the foot', () => {
    for (const l of leaves) expect(l.gap - skitterPush(l.gap, l.own)).toBeGreaterThanOrEqual(Math.min(l.gap, SKITTER.clearMm) - 1e-9)
    expect(skitterPush(0, 1)).toBe(0)
  })

  it('ends every leaf at its place, as before, and sooner', () => {
    for (const l of leaves) {
      expect(skitterLeft(l.gap, l.wait, l.long, 1.25)).toBe(0)
      expect(skitterLeft(l.gap, l.wait, l.long, 12)).toBe(0)
      expect(skitterLeft(l.gap, l.wait, l.long, 1e3)).toBe(0)
      expect(gone(l, 1e3)).toBe(skitterPush(l.gap, l.own))
    }
    // Half a second after the landing (the still `landed`) a leaf is not yet at rest; twelve seconds after it (`rest`) it is.
    expect(share((l) => skitterLeft(l.gap, l.wait, l.long, 0.5) > 0)).toBeGreaterThan(0.2)
  })

  it('is the same law in the drawing', () => {
    const text = readFileSync(new URL('../src/seasons/fall/slab.ts', import.meta.url), 'utf8')
    // The drawing takes its four lengths from the one table, and its place from the leaf's own place less what is left.
    expect(text).toContain('uLeafMove: { value: new THREE.Vector4(SKITTER.pushMm, SKITTER.reachMm, SKITTER.waveMmPerSecond, SKITTER.slideSeconds) }')
    expect(text).toContain('float leafLeft = (1.0 - leafT) * (1.0 - leafT) * (1.0 - leafT) * (1.0 - leafT);')
    expect(text).toContain('vec2 leafAt = leafRest - leafDir * (leafPush * leafLeft)')
    expect(text).toContain('${SKITTER.ownWaitSeconds.toFixed(3)} * leafHash(leafId * 9.7)')
    expect(text).toContain('max(leafGap - ${SKITTER.clearMm.toFixed(1)}, 0.0)')
    expect(text).not.toContain('float leafEase = 1.0 - (1.0 - leafT) * (1.0 - leafT) * (1.0 - leafT);')
  })
})
