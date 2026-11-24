import { describe, expect, it } from 'vitest'
import { config, shots } from '../src/config'
import { barSeconds, beatSeconds, defaultGrid, filmTimeline, globePoseAt, prerollSeconds, seasonAt } from '../src/film/timeline'
import { makeShake } from '../src/shake/table'
import { buildCut } from '../src/film/cut'
import { MOVES, cameraKeys, cameraNumbers, filmPose, filmRig, loopPose, movesOf, rigOf, shotNotes } from '../src/film/moves'
import { judgedList, loopPlan } from '../src/film/judged'
import { openingPlan } from '../src/film/opening'
import { loopGlobe, loopSeconds, standInLoop, wrapLoop } from '../src/film/loop'
import { partChange, SEASONAL_PARTS } from '../src/shake/change'
import type { ParticleSource } from '../src/core/stage'

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

const far = (a: number[], b: number[]): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)))

describe('the cut on the default grid', () => {
  const cut = buildCut()
  const fps = cut.fps
  const perBar = Math.round(barSeconds * fps)

  it('is the default grid when there is no map', () => {
    const grid = defaultGrid()
    expect(cut.source).toBe('default-grid')
    expect(cut.frameCount).toBe(grid.frameCount)
    expect(cut.spans.map((s) => [s.shot.id, s.first, s.last])).toEqual(grid.spans.map((s) => [s.shot.id, s.first, s.last]))
    expect(cut.landings).toEqual(grid.landings)
    expect(cut.swaps).toEqual(grid.swaps)
    expect(cut.barLines).toEqual(grid.barLines)
    expect(cut.seconds).toBeGreaterThanOrEqual(config.film.minSeconds)
    expect(cut.seconds).toBeLessThanOrEqual(config.film.maxSeconds)
  })

  it('fills the film with its shots, in the order the config gives', () => {
    expect(cut.spans.map((s) => s.shot.id)).toEqual(shots.map((s) => s.id))
    expect(cut.spans[0]!.first).toBe(0)
    for (let i = 1; i < cut.spans.length; i++) expect(cut.spans[i]!.first).toBe(cut.spans[i - 1]!.last + 1)
    expect(cut.spans.at(-1)!.last).toBe(cut.frameCount - 1)
  })

  it('makes every shake exactly one bar, from a bar line to a landing on the next', () => {
    expect(cut.shakes.length).toBe(shots.filter((s) => s.kind === 'shake').length)
    for (const s of cut.shakes) {
      expect(s.landing - s.first).toBe(perBar)
      expect(cut.barLines).toContain(s.first)
      expect([...cut.barLines, cut.frameCount]).toContain(s.landing)
      expect(s.seconds).toBeCloseTo(barSeconds, 9)
      expect(s.first).toBeLessThan(s.liftEnd)
      expect(s.liftEnd).toBeLessThan(s.swap.first)
      expect(s.swap.last).toBeLessThan(s.strokesEnd)
      expect(s.strokesEnd).toBeLessThan(s.landing)
    }
  })

  it('changes every part only inside the swap window', () => {
    const tl = filmTimeline(cut)
    for (let i = 0; i < cut.frameCount; i++) {
      const at = seasonAt(tl, prerollSeconds + i / fps)
      const inside = cut.swaps.some((w) => i >= w.first && i <= w.last)
      if (inside) continue
      for (const part of SEASONAL_PARTS) {
        const v = partChange(part, at.change)
        expect(v === 0 || v === 1, `${part} at frame ${i}`).toBe(true)
      }
    }
    for (const w of cut.swaps) {
      const before = seasonAt(tl, prerollSeconds + (w.first - 1) / fps)
      const after = seasonAt(tl, prerollSeconds + (w.last + 1) / fps)
      const shake = cut.shakes.find((s) => s.shot === w.shot)!
      expect(before.change === 0 ? before.season : before.to).toBe(shake.from)
      expect(after.change === 0 ? after.season : after.to).toBe(shake.to)
    }
  })

  it('lists its camera keys in order, every one inside the film', () => {
    const list = cameraKeys(cut)
    expect(list.length).toBeGreaterThan(cut.spans.length)
    for (const k of list) {
      expect(k.frame).toBeGreaterThanOrEqual(0)
      expect(k.frame).toBeLessThan(cut.frameCount)
    }
    for (let i = 1; i < list.length; i++) expect(list[i]!.frame).toBeGreaterThan(list[i - 1]!.frame)
  })
})

describe('the camera of the film', () => {
  const cut = buildCut()
  const fps = cut.fps
  const wide = rigOf(MOVES.wide)
  const at = (frame: number) => cameraNumbers(filmPose(cut, frame / fps))

  it('is the wide camera of the config on the first frame of every shake', () => {
    expect(wide).toEqual(rigOf('hero'))
    for (const s of cut.shakes) {
      const { rig, move } = filmRig(cut, s.first / fps)
      expect(move.role).toBe('shake')
      expect(rig.distanceMm).toBeCloseTo(wide.distanceMm, 6)
      expect(rig.yawDeg).toBeCloseTo(wide.yawDeg, 6)
      expect(rig.pitchDeg).toBeCloseTo(wide.pitchDeg, 6)
      expect(rig.aimHeightMm).toBeCloseTo(wide.aimHeightMm, 6)
      expect(rig.fovDeg).toBeCloseTo(wide.fovDeg, 6)
    }
  })

  it('is back at the wide camera one beat before every shake', () => {
    const beat = Math.round((barSeconds / config.film.beatsPerBar) * fps)
    for (const s of cut.shakes) {
      for (let i = s.first - beat; i <= s.first; i++) {
        const { rig } = filmRig(cut, i / fps)
        expect(Math.abs(rig.distanceMm - wide.distanceMm), `frame ${i}`).toBeLessThan(wide.distanceMm * 0.002)
        expect(Math.abs(rig.aimHeightMm - wide.aimHeightMm), `frame ${i}`).toBeLessThan(0.01)
        expect(Math.abs(rig.yawDeg - wide.yawDeg), `frame ${i}`).toBeLessThan(0.2)
        expect(Math.abs(rig.pitchDeg - wide.pitchDeg), `frame ${i}`).toBeLessThan(0.2)
      }
    }
  })

  it('is locked through every shake but for the ease in of a few percent', () => {
    expect(MOVES.shakeEaseIn).toBeGreaterThan(0)
    expect(MOVES.shakeEaseIn).toBeLessThanOrEqual(0.05)
    for (const s of cut.shakes) {
      let last = wide.distanceMm
      for (let i = s.first; i < s.landing; i++) {
        const { rig } = filmRig(cut, i / fps)
        expect(rig.yawDeg, `frame ${i}`).toBe(wide.yawDeg)
        expect(rig.pitchDeg, `frame ${i}`).toBe(wide.pitchDeg)
        expect(rig.aimHeightMm, `frame ${i}`).toBe(wide.aimHeightMm)
        expect(rig.fovDeg, `frame ${i}`).toBe(wide.fovDeg)
        expect(rig.focusShiftMm, `frame ${i}`).toBe(wide.focusShiftMm)
        expect(rig.distanceMm).toBeLessThanOrEqual(last + 1e-9)
        expect(rig.distanceMm).toBeGreaterThanOrEqual(wide.distanceMm * (1 - MOVES.shakeEaseIn) - 1e-9)
        last = rig.distanceMm
      }
      const after = filmRig(cut, (s.landing + Math.round(barSeconds * fps * MOVES.settleBars)) / fps).rig
      expect(Math.abs(after.distanceMm - wide.distanceMm) / wide.distanceMm).toBeLessThan(MOVES.shakeEaseIn)
    }
  })

  it('never stops in a hold: no two frames next to each other hold the same camera', () => {
    for (const span of cut.spans) {
      if (span.shot.kind !== 'hold') continue
      let prev = at(span.first)
      for (let i = span.first + 1; i <= span.last; i++) {
        const now = at(i)
        expect(far(now, prev), `frames ${i - 1} and ${i} of ${span.shot.id}`).toBeGreaterThan(1e-7)
        prev = now
      }
    }
  })

  it('moves without a jump from one frame to the next, across every cut', () => {
    let prev = at(0)
    let most = 0
    for (let i = 1; i < cut.frameCount; i++) {
      const now = at(i)
      most = Math.max(most, far(now, prev))
      prev = now
    }
    const pull = Math.abs(rigOf(MOVES.close).distanceMm - wide.distanceMm)
    expect(most).toBeLessThan((pull / (barSeconds * fps)) * 3)
  })

  it('opens already moving, and has pulled back plainly by film.hookSeconds and to the edge of the glass by film.revealBySeconds', () => {
    const d = (t: number) => filmRig(cut, t).rig.distanceMm
    const close = rigOf(MOVES.close).distanceMm
    expect(d(0)).toBeCloseTo(close, 6)
    expect(d(1 / fps) - d(0)).toBeGreaterThan(0.2)
    const total = wide.distanceMm - close
    expect((d(config.film.hookSeconds) - close) / total).toBeGreaterThan(0.35)
    expect((d(config.film.revealBySeconds) - close) / total).toBeGreaterThan(0.6)
    for (let i = 1; i <= Math.round(config.film.revealBySeconds * fps); i++) expect(d(i / fps)).toBeGreaterThan(d((i - 1) / fps))
  })

  it("ends on frame 0's camera so the film can repeat", () => {
    expect(far(at(cut.frameCount - 1), at(0))).toBeLessThan(1e-6)
  })

  it('gives every hold between two shakes a detail camera from the config and every shot its notes', () => {
    const moves = movesOf(cut)
    expect(moves.length).toBe(cut.spans.length)
    expect(moves[0]!.role).toBe('open')
    expect(moves.at(-1)!.role).toBe('close')
    for (const m of moves) {
      expect(m.camera in config.cameras, m.camera).toBe(true)
      if (m.span.shot.kind === 'shake') expect(m.role).toBe('shake')
    }
    const notes = shotNotes(cut)
    expect(notes.map((n) => n.shot)).toEqual(cut.spans.map((s) => s.shot.id))
    for (const n of notes) {
      expect(n.move.length).toBeGreaterThan(20)
      expect(n.keys[0]!.frame).toBe(cut.spans.find((s) => s.shot.id === n.shot)!.first)
    }
  })
})

describe('the judged list', () => {
  const cut = buildCut()
  const list = judgedList(cut, openingPlan(cut.fps))
  const byId = new Map(list.map((e) => [e.id, e]))

  it('has one entry for every id, each inside its own film', () => {
    expect(byId.size).toBe(list.length)
    const loop = loopPlan(cut.fps)
    const opening = openingPlan(cut.fps)
    for (const e of list) {
      expect(e.what.length).toBeGreaterThan(0)
      expect(Object.values(config.formats).some((f) => f.id === e.format), e.id).toBe(true)
      if (e.kind === 'film') expect(e.frame! >= 0 && e.frame! < cut.frameCount, e.id).toBe(true)
      if (e.kind === 'loop') expect(e.frame! >= 0 && e.frame! < loop.frameCount, e.id).toBe(true)
      if (e.kind === 'opening') expect(e.frame! >= 0 && e.frame! < opening.frameCount, e.id).toBe(true)
    }
  })

  it('holds every key and still, two frames of every change, a live picture of every season, the film, the opening and the loop', () => {
    for (const p of [...config.keys, ...config.stills]) expect(byId.has(p.id), p.id).toBe(true)
    for (const s of cut.shakes) {
      expect(byId.get(`change-${s.shot}-swap`)?.at).toBe('swap')
      expect(byId.get(`change-${s.shot}-landing`)?.at).toBe('landing')
      expect(byId.get(`film-${s.shot}-swap`)!.frame).toBe(Math.round((s.swap.first + s.swap.last) / 2))
      expect(byId.get(`film-${s.shot}-landing`)!.frame).toBe(s.landing)
      expect(byId.get(`film-${s.shot}-landed`)!.frame).toBe(s.landing + Math.round(config.states.landedSeconds * cut.fps))
    }
    for (const season of config.seasons) expect(byId.get(`live-${season}`)?.level).toBe(Object.keys(config.live.quality)[0])
    expect(byId.get('film-first')!.frame).toBe(0)
    expect(byId.get('film-hook')!.frame).toBe(Math.round(config.film.hookSeconds * cut.fps))
    expect(byId.get('film-reveal')!.frame).toBe(Math.round(config.film.revealBySeconds * cut.fps))
    expect(byId.get('film-last')!.frame).toBe(cut.frameCount - 1)
    for (const span of cut.spans) if (span.shot.kind === 'hold') expect(byId.get(`film-hold-${span.shot.id}`)!.frame).toBe(Math.floor((span.first + span.last) / 2))
    expect(list.filter((e) => e.kind === 'opening').length).toBe(3)
    const loop = list.filter((e) => e.kind === 'loop')
    expect(loop.length).toBe(4)
    expect(loop.map((e) => e.frame)).toContain(Math.round(loopPlan(cut.fps).frameCount * 0.75))
    expect(loop.every((e) => e.format === config.deliver.cardLoop.format)).toBe(true)
  })
})

describe('the card loop', () => {
  const plan = loopPlan()
  const fps = config.film.fps

  it('is as long as the config says and holds one shake of one bar', () => {
    expect(plan.frameCount).toBe(Math.round(config.deliver.cardLoop.seconds * fps))
    expect(plan.shake.landing - plan.shake.first).toBe(Math.round(barSeconds * fps))
    expect(plan.shake.landing).toBeLessThan(plan.frameCount)
    expect(loopSeconds).toBe(config.deliver.cardLoop.seconds)
  })

  it('has the camera and the globe of frame 0 one frame past the last', () => {
    const n = plan.frameCount
    expect(cameraNumbers(loopPose(n / fps))).toEqual(cameraNumbers(loopPose(0)))
    expect(loopGlobe(n / fps)).toEqual(loopGlobe(0))
    expect(wrapLoop(n / fps)).toBe(0)
    expect(far(cameraNumbers(loopPose((n - 1) / fps)), cameraNumbers(loopPose(0)))).toBeLessThan(0.2)
    for (let i = plan.shake.first; i < plan.shake.landing; i++) {
      const a = cameraNumbers(loopPose(i / fps))
      const b = cameraNumbers(loopPose(plan.shake.first / fps))
      expect(a[6]).toBe(b[6])
      expect(far(a.slice(3, 6), b.slice(3, 6))).toBe(0)
    }
  })

  it('puts every particle of frame 0 back where it was one frame past the last', () => {
    const count = 400
    const like: ParticleSource = { count, step: 0, pos: new Float32Array(count * 3), prev: new Float32Array(count * 3), sizes: new Float32Array(count), kindOf: new Uint8Array(count), kinds: ['flake'], state: new Uint8Array(count), liquid: new Float64Array(4) }
    const loop = standInLoop(like, 60, 10)
    loop.setTime(0)
    const first = { pos: Array.from(loop.source.pos), prev: Array.from(loop.source.prev), state: Array.from(loop.source.state), liquid: Array.from(loop.source.liquid) }
    loop.setTime((plan.shake.first + plan.shake.landing) / 2 / fps)
    const mid = Array.from(loop.source.pos)
    expect(far(mid, first.pos)).toBeGreaterThan(1)
    for (let i = 0; i < count; i++) expect(Math.hypot(mid[i * 3]!, mid[i * 3 + 1]!, mid[i * 3 + 2]!)).toBeLessThanOrEqual(60)
    loop.setTime(plan.frameCount / fps)
    expect(Array.from(loop.source.pos)).toEqual(first.pos)
    expect(Array.from(loop.source.prev)).toEqual(first.prev)
    expect(Array.from(loop.source.state)).toEqual(first.state)
    expect(Array.from(loop.source.liquid)).toEqual(first.liquid)
  })
})
