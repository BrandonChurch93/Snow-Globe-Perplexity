import { describe, expect, it } from 'vitest'
import { config, shots } from '../src/config'
import { barSeconds, beatSeconds, defaultGrid, filmTimeline, globePoseAt, prerollSeconds, seasonAt } from '../src/film/timeline'
import { makeShake } from '../src/shake/table'

describe('the film on the default grid', () => {
  const grid = defaultGrid()

  it('fills the film with no gap or overlap', () => {
    expect(grid.spans[0]!.first).toBe(0)
    for (let i = 1; i < grid.spans.length; i++) expect(grid.spans[i]!.first).toBe(grid.spans[i - 1]!.last + 1)
    expect(grid.spans.at(-1)!.last).toBe(grid.frameCount - 1)
    const bars = shots.reduce((n, s) => n + s.bars, 0)
    expect(grid.frameCount).toBe(Math.round(bars * barSeconds * config.film.fps))
  })

  it('makes every shake one bar and lands it on a bar line', () => {
    const perBar = Math.round(barSeconds * config.film.fps)
    const shakes = grid.spans.filter((s) => s.shot.kind === 'shake')
    expect(shakes.length).toBe(grid.landings.length)
    for (const s of shakes) {
      expect(s.last - s.first + 1).toBe(perBar)
      expect(grid.barLines).toContain(s.first)
      expect(grid.barLines).toContain(s.last + 1)
      expect(grid.landings).toContain(s.last + 1)
    }
  })

  it('keeps every swap window inside its shake', () => {
    for (const w of grid.swaps) {
      const span = grid.spans.find((s) => s.shot.id === w.shot)!
      expect(w.first).toBeGreaterThan(span.first)
      expect(w.last).toBeLessThan(span.last)
      expect(w.first).toBeLessThan(w.last)
    }
  })

  it('changes the season only inside the swap window', () => {
    const tl = filmTimeline(grid)
    for (let i = 0; i < grid.frameCount; i += 3) {
      const at = seasonAt(tl, prerollSeconds + i / config.film.fps)
      const inside = grid.swaps.some((w) => i >= w.first && i <= w.last)
      if (!inside) expect(at.change === 0, `frame ${i}`).toBe(true)
      else expect(at.change).toBeGreaterThanOrEqual(0)
    }
    const end = seasonAt(tl, prerollSeconds + (grid.frameCount - 1) / config.film.fps)
    const last = shots.at(-1)!
    expect(end.season).toBe(last.kind === 'hold' ? last.season : last.to)
  })

  it('rests outside the shakes and is lifted inside them', () => {
    const tl = filmTimeline(grid)
    for (const s of grid.spans) {
      const mid = prerollSeconds + (s.first + s.last + 1) / 2 / config.film.fps
      const pose = globePoseAt(tl, mid)
      if (s.shot.kind === 'hold') expect(pose.y).toBe(0)
      else expect(pose.y).toBeGreaterThan(0)
    }
  })
})

describe('the shake path', () => {
  const path = makeShake('test')
  const s = config.shake
  const bar = config.film.beatsPerBar

  it('starts and ends at rest height', () => {
    expect(path.poseAt(0)).toEqual({ x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0 })
    expect(path.poseAt(bar)).toEqual({ x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0 })
    expect(path.poseAt(bar - 1e-6).y).toBeLessThan(0.01)
  })

  it('touches the surface on the landing and not before', () => {
    for (let b = s.liftBeats; b < bar - 0.02; b += 0.01) expect(path.poseAt(b).y, `beat ${b}`).toBeGreaterThan(0)
  })

  it('has three parts of the lengths the config gives', () => {
    expect(path.parts).toEqual({ liftEnd: s.liftBeats, strokesEnd: s.liftBeats + s.strokeBeats, landing: s.liftBeats + s.strokeBeats + s.setDownBeats })
    expect(path.parts.landing).toBe(bar)
    expect(path.poseAt(s.liftBeats).y).toBeCloseTo(s.liftMm, 6)
    expect(path.poseAt(s.liftBeats + s.strokeBeats).y).toBeCloseTo(s.liftMm, 6)
    for (let b = 0.01; b < s.liftBeats; b += 0.01) {
      const p = path.poseAt(b)
      expect(p.x, `no stroke in the lift, beat ${b}`).toBe(0)
      expect(p.y).toBeLessThan(s.liftMm)
      expect(p.y).toBeGreaterThan(path.poseAt(b - 0.01).y - 1e-9)
    }
    for (let b = s.liftBeats + s.strokeBeats; b < bar; b += 0.01) {
      const p = path.poseAt(b)
      expect(p.x, `no stroke in the set down, beat ${b}`).toBe(0)
      expect(p.y).toBeLessThanOrEqual(s.liftMm + 1e-9)
    }
    let peak = 0
    let turns = 0
    let last = 0
    for (let b = s.liftBeats; b <= s.liftBeats + s.strokeBeats; b += 0.002) {
      const x = path.poseAt(b).x
      peak = Math.max(peak, Math.abs(x))
      expect(path.poseAt(b).y).toBeGreaterThanOrEqual(s.liftMm - 1e-9)
      const sign = Math.abs(x) < 0.2 ? 0 : Math.sign(x)
      if (sign !== 0 && sign !== last) {
        turns++
        last = sign
      }
    }
    expect(turns).toBe(Math.round(s.strokes))
    expect(peak).toBeGreaterThan(s.strokeMm * 0.5)
    expect(peak).toBeLessThanOrEqual(s.strokeMm * 1.25)
    expect(beatSeconds * bar).toBeCloseTo(barSeconds, 12)
  })

  it('is the same path for the same name', () => {
    const again = makeShake('test')
    for (let b = 0; b <= bar; b += 0.25) expect(again.poseAt(b)).toEqual(path.poseAt(b))
  })
})
