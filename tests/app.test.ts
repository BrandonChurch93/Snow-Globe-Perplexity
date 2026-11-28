import { readFileSync, readdirSync } from 'node:fs'
import sharp from 'sharp'
import { build, loadConfigFromFile, type Plugin } from 'vite'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config'
import { reveal } from '../src/app/app'
import { FRAME, baseSide, edges, framingOfRig, livePath, liveRig, margins, roomUnder, shakeReach } from '../src/app/framing'
import { Drag, Look, MotionShake, TOUCH, stirAxis } from '../src/app/gestures'
import { INTERFACE_STATES, createOverlay } from '../src/app/overlay'
import { Autopilot, LoopPlayer } from '../src/app/players'
import { createProbe, pickLevel, slowest, type ProbeHost } from '../src/app/probe'
import { Replay, SCRIPT, SCRIPTS, scriptPlan } from '../src/app/replay'
import { LIVE, LiveSession, SeasonLoader, type LiveSim } from '../src/app/session'
import { GOVERN, Governor, levelById, levels, median, stageQuality, topLevel } from '../src/core/quality'
import type { AppBridge, AppState } from '../src/core/bridge'
import type { ParticleSource } from '../src/core/stage'
import { filmCut } from '../src/film/cut'
import { SourceSwitch, loopSeconds, standInLoop } from '../src/film/loop'
import { cameraNumbers, filmPose, poseOfRig, reachOf, rigOf } from '../src/film/moves'
import { openingPlan } from '../src/film/opening'
import { barSeconds, beatSeconds, type Timeline } from '../src/film/timeline'
import { REST_POSE, makeShake } from '../src/shake/table'
import { framingOf } from '../src/scene/framing'
import { seasonsIn } from '../src/scene/steps'

const ui = vi.hoisted(() => ({ mount: null as null | ((root: unknown, bridge: unknown) => { setVisible(v: boolean): void; dispose(): void }) }))
vi.mock('../src/app/mounts', () => ({ audioShips: false, loadInterface: async () => (ui.mount ? { mountInterface: ui.mount } : null) }))

const HZ = config.sim.stepHz
const FRAME_S = 1 / 60
const seasons = config.seasons
const first = config.defaultSeason
const next = (s: string) => seasons[(seasons.indexOf(s) + 1) % seasons.length]!

class FakeSim implements LiveSim {
  step = 0
  calls = 0
  resets = 0
  stuck = false
  seen: Timeline | null = null
  advanceTo(step: number, tl: Timeline): void {
    this.calls++
    this.seen = tl
    if (!this.stuck) this.step = Math.max(this.step, step)
  }
  reset(): void {
    this.step = 0
    this.resets++
  }
}

const run = (s: LiveSession, seconds: number, each: () => void = () => undefined): void => {
  for (let i = 0; i < Math.round(seconds / FRAME_S); i++) {
    s.tick(FRAME_S)
    each()
  }
}

describe('a shake in the app', () => {
  it('starts a shake asked during the settle only when the settle is over, so the globe never jumps between two paths', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    s.shake()
    const landing = s.shaking!.startSec + barSeconds
    run(s, barSeconds + 2 * FRAME_S)
    expect(s.busy).toBe(false)
    expect(s.clock).toBeLessThan(landing + config.shake.landSettleSeconds)
    expect(s.shake()).not.toBeNull()
    const e = s.shaking!
    expect(e.startSec).toBeGreaterThanOrEqual(landing + config.shake.landSettleSeconds - 1e-9)
    expect(e.startSec).toBeLessThan(landing + config.shake.landSettleSeconds + 2 / config.sim.stepHz)
    run(s, config.shake.landSettleSeconds + 2 * FRAME_S)
    const later = new LiveSession(new FakeSim(), first)
    later.shake()
    run(later, barSeconds + config.shake.landSettleSeconds + 4 * FRAME_S)
    later.shake()
    expect(later.shaking!.startSec).toBeCloseTo((later.clock * config.sim.stepHz + 1) / config.sim.stepHz, 1)
  })

  it('is one bar, goes to the next season and lands there', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    expect(s.busy).toBe(false)
    expect(s.shake()).toBe(next(first))
    expect(s.busy).toBe(true)
    expect(s.target).toBe(next(first))
    const e = s.shaking!
    expect(e.from).toBe(first)
    expect(e.to).toBe(next(first))
    let lifted = 0
    run(s, barSeconds - 2 * FRAME_S, () => {
      if (s.moment(1, 1).globe.y > 0) lifted++
    })
    expect(lifted).toBeGreaterThan(60)
    expect(s.busy).toBe(true)
    expect(s.season).toBe(first)
    run(s, 4 * FRAME_S)
    expect(s.busy).toBe(false)
    expect(s.season).toBe(next(first))
    expect(s.target).toBeNull()
    expect(s.moment(1, 1).season).toBe(next(first))
    // The tilt that settles after the landing dies inside `shake.landSettleSeconds`; after that the globe is at rest exactly.
    run(s, config.shake.landSettleSeconds + 2 * FRAME_S)
    expect(s.moment(1, 1).globe).toEqual(REST_POSE)
    expect(s.shakes).toBe(1)
    expect(sim.step).toBe(Math.ceil(s.clock * HZ - 1e-7))
    expect(sim.seen).toBe(s.tl)
  })

  it('does not start while another is running, by Shake or by a season mark', () => {
    const s = new LiveSession(new FakeSim(), first)
    expect(s.shake()).toBe(next(first))
    run(s, 0.5)
    expect(s.shake()).toBeNull()
    expect(s.goTo(seasons.at(-1)!)).toBeNull()
    expect(s.shakes).toBe(1)
    expect(s.tl.events.length).toBe(1)
    run(s, barSeconds)
    expect(s.season).toBe(next(first))
    expect(s.shake()).toBe(next(next(first)))
    expect(s.shakes).toBe(2)
  })

  it('goes to a named season in one shake, and nowhere for the season it is in or a name it does not know', () => {
    const s = new LiveSession(new FakeSim(), first)
    const far = seasons[(seasons.indexOf(first) + 2) % seasons.length]!
    expect(s.goTo(first)).toBeNull()
    expect(s.goTo('monsoon')).toBeNull()
    expect(s.busy).toBe(false)
    expect(s.goTo(far)).toBe(far)
    expect(s.shaking!.to).toBe(far)
    run(s, barSeconds + 0.1)
    expect(s.season).toBe(far)
    expect(s.shakes).toBe(1)
  })

  it('goes round every season and back', () => {
    const s = new LiveSession(new FakeSim(), first)
    const seen = [s.season]
    for (let i = 0; i < seasons.length; i++) {
      s.shake()
      run(s, barSeconds + config.shake.landSettleSeconds + 0.1)
      seen.push(s.season)
    }
    expect(seen).toEqual([...seasons.map((_, i) => seasons[(seasons.indexOf(first) + i) % seasons.length]!), first])
    expect(s.tl.events.length).toBeLessThanOrEqual(1)
  })

  it('names the state it is in by the time since the landing', () => {
    const s = new LiveSession(new FakeSim(), first)
    expect(s.stateName).toBe('settled')
    s.shake()
    expect(s.stateName).toBe('')
    run(s, barSeconds + 0.1)
    expect(s.stateName).toBe('landed')
    run(s, config.states.restSeconds)
    expect(s.stateName).toBe('rest')
  })
})

describe('a season that is not loaded yet', () => {
  it('holds the storm, then lands in the new season on a beat of the cycle', () => {
    const loaded = new Set([first])
    const sim = new FakeSim()
    const s = new LiveSession(sim, first, (season) => loaded.has(season))
    s.shake()
    const e = s.shaking!
    run(s, barSeconds + 0.3)
    expect(s.busy).toBe(true)
    expect(s.season).toBe(first)
    expect(e.holdBeats).toBeGreaterThan(0)
    expect(s.moment(1, 1).globe.y).toBeGreaterThan(0)
    loaded.add(next(first))
    const held = e.holdBeats!
    let landedAt = 0
    run(s, config.live.loadWaitSeconds + barSeconds, () => {
      if (!landedAt && !s.busy) landedAt = s.clock
    })
    expect(s.season).toBe(next(first))
    expect(e.holdBeats! - held).toBeLessThanOrEqual(2 * (config.shake.swapWindow.fromBeat - config.shake.liftBeats))
    expect((e.holdBeats! / (2 * (config.shake.swapWindow.fromBeat - config.shake.liftBeats))) % 1).toBe(0)
    expect(landedAt).toBeGreaterThanOrEqual(e.startSec + barSeconds + e.holdBeats! * beatSeconds)
    expect(landedAt).toBeLessThan(e.startSec + barSeconds + e.holdBeats! * beatSeconds + 2 * FRAME_S)
  })

  it('gives up after live.loadWaitSeconds and lands in the season it left', () => {
    const s = new LiveSession(new FakeSim(), first, (season) => season === first)
    expect(s.shake()).toBe(next(first))
    const e = s.shaking!
    let landedAt = 0
    const shown = new Set<string>()
    run(s, barSeconds + config.live.loadWaitSeconds + 1, () => {
      if (!landedAt && !s.busy) landedAt = s.clock
      const m = s.moment(1, 1)
      shown.add(m.season).add(m.from).add(m.to)
    })
    expect([...shown]).toEqual([first])
    expect(landedAt).toBeGreaterThan(0)
    expect((e.holdBeats ?? 0) * beatSeconds).toBeLessThanOrEqual(config.live.loadWaitSeconds)
    expect(landedAt - e.startSec).toBeLessThanOrEqual(barSeconds + config.live.loadWaitSeconds + 2 * FRAME_S)
    expect(s.season).toBe(first)
    expect(s.target).toBeNull()
    expect(s.moment(1, 1).season).toBe(first)
    expect(s.moment(1, 1).globe).toEqual(REST_POSE)
    expect(s.busy).toBe(false)
  })

  it('does not wait for a season that is ready', () => {
    const s = new LiveSession(new FakeSim(), first, () => true)
    s.shake()
    const e = s.shaking!
    run(s, barSeconds + 0.1)
    expect(e.holdBeats ?? 0).toBe(0)
    expect(s.season).toBe(next(first))
  })

  it('loads the first season first and the others one at a time after it', async () => {
    const order: string[] = []
    const ready: string[] = []
    let running = 0
    let most = 0
    const loader = new SeasonLoader(
      first,
      async (season) => {
        running++
        most = Math.max(most, running)
        order.push(season)
        await Promise.resolve()
        running--
      },
      (season) => ready.push(season),
    )
    expect(loader.ready(first)).toBe(false)
    await loader.first
    expect(loader.ready(first)).toBe(true)
    for (let i = 0; i < 40; i++) await Promise.resolve()
    expect(order[0]).toBe(first)
    expect([...order].sort()).toEqual([...seasons].sort())
    expect(ready).toEqual(order)
    expect(most).toBe(1)
    for (const season of seasons) expect(loader.ready(season)).toBe(true)
  })

  it('keeps loading the others when one fails', async () => {
    const bad = next(first)
    const loader = new SeasonLoader(first, async (season) => {
      if (season === bad) throw new Error('missing')
    })
    await loader.first
    for (let i = 0; i < 40; i++) await Promise.resolve()
    expect(loader.ready(bad)).toBe(false)
    for (const season of seasons) if (season !== bad) expect(loader.ready(season)).toBe(true)
  })

  const shakenFrom = (season: string): string[] => {
    const s = new LiveSession(new FakeSim(), season)
    const led: string[] = []
    for (let n = 1; n < seasons.length; n++) {
      led.push(s.shake()!)
      run(s, barSeconds + config.shake.landSettleSeconds + 4 * FRAME_S)
      expect(s.season).toBe(led.at(-1))
    }
    return led
  }

  it('makes the others in the order the shakes lead to them, whichever season the page opens on', async () => {
    for (const opens of seasons) {
      const made: string[] = []
      const loader = new SeasonLoader(opens, async (season) => void made.push(season))
      await loader.all
      expect(made).toEqual([opens, ...shakenFrom(opens)])
      expect(made).toHaveLength(seasons.length)
    }
  })

  it('goes on from the season a press asked for with those that are not begun', async () => {
    for (const opens of seasons) {
      const made: string[] = []
      let go: () => void = () => undefined
      const loader = new SeasonLoader(opens, async (season) => void made.push(season), undefined, new Promise<void>((resolve) => (go = resolve)))
      await loader.first
      const asked = next(next(opens))
      await loader.want(asked)
      go()
      await loader.all
      expect(made).toEqual([opens, asked, ...shakenFrom(asked).filter((season) => season !== opens)])
      expect(made).toHaveLength(seasons.length)
    }
  })

  it('goes on to the next when a load throws at once, and begins none beside a season that was asked for', async () => {
    const bad = next(first)
    const asked = next(bad)
    const begun: string[] = []
    let end: () => void = () => undefined
    let go: () => void = () => undefined
    const loader = new SeasonLoader(
      first,
      (season) => {
        begun.push(season)
        if (season === bad) throw new Error('missing')
        return season === asked ? new Promise<void>((done) => (end = done)) : Promise.resolve()
      },
      undefined,
      new Promise<void>((resolve) => (go = resolve)),
    )
    await loader.first
    void loader.want(asked)
    go()
    let all = false
    void loader.all.then(() => (all = true))
    for (let i = 0; i < 40; i++) await Promise.resolve()
    expect(all).toBe(false)
    expect(begun).toEqual([first, asked])
    end()
    await loader.all
    expect(begun).toEqual([first, asked, ...shakenFrom(asked).filter((season) => season !== first)])
    for (const season of seasons) expect(loader.ready(season)).toBe(season !== bad)
  })

  /** A page whose picture rests or not, as the test says: what the loader is given to wait on. */
  const picture = () => {
    let air: Promise<void> | null = null
    let land: () => void = () => undefined
    return {
      rest: (): Promise<void> => air ?? Promise.resolve(),
      shake: (): void => void (air = new Promise<void>((resolve) => (land = resolve))),
      lands: (): void => {
        air = null
        land()
      },
    }
  }

  it('begins none of the others while the picture does not rest, and all of them in their order once it does', async () => {
    for (const opens of seasons) {
      const begun: string[] = []
      const p = picture()
      let go: () => void = () => undefined
      const loader = new SeasonLoader(opens, async (season) => void begun.push(season), undefined, new Promise<void>((resolve) => (go = resolve)), p.rest)
      await loader.first
      p.shake()
      go()
      for (let i = 0; i < 40; i++) await Promise.resolve()
      expect(begun, 'in the air').toEqual([opens])
      p.lands()
      await loader.all
      expect(begun).toEqual([opens, ...shakenFrom(opens)])
    }
  })

  it('begins the season a press asks for in mid air all the same, and the one after it only when the picture rests again', async () => {
    const begun: string[] = []
    const ready: string[] = []
    const p = picture()
    const asked = next(first)
    let end: () => void = () => undefined
    const loader = new SeasonLoader(
      first,
      (season) => {
        begun.push(season)
        return season === asked ? new Promise<void>((done) => (end = done)) : Promise.resolve()
      },
      (season) => void ready.push(season),
      undefined,
      p.rest,
    )
    await loader.first
    p.shake()
    void loader.want(asked)
    for (let i = 0; i < 40; i++) await Promise.resolve()
    expect(begun).toEqual([first, asked])
    end()
    for (let i = 0; i < 40; i++) await Promise.resolve()
    expect(ready, 'the season pressed for is ready in mid air').toEqual([first, asked])
    expect(begun, 'and nothing is begun behind it there').toEqual([first, asked])
    p.lands()
    await loader.all
    expect(begun).toEqual([first, asked, ...shakenFrom(asked).filter((season) => season !== first)])
  })

  it('goes on with the others where the page cannot say whether its picture rests', async () => {
    const begun: string[] = []
    const loader = new SeasonLoader(first, async (season) => void begun.push(season), undefined, undefined, () => Promise.reject(new Error('no stage')))
    await loader.all
    expect(begun).toEqual([first, ...shakenFrom(first)])
    const thrown = new SeasonLoader(first, async () => undefined, undefined, undefined, () => {
      throw new Error('no stage')
    })
    await thrown.all
    for (const season of seasons) expect(thrown.ready(season)).toBe(true)
  })
})

describe('a season that is loaded and still owed something', () => {
  const to = next(first)
  const loaded = async (): Promise<SeasonLoader> => {
    const loader = new SeasonLoader(first, async () => undefined)
    await loader.all
    return loader
  }
  const told = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

  it('is not ready until what it is held for is over, however that ends, and no other season is held with it', async () => {
    for (const ends of ['done', 'failed'] as const) {
      const loader = await loaded()
      let end = (): void => undefined
      loader.hold(to, new Promise<void>((done, fail) => (end = ends === 'done' ? done : () => fail(new Error('lost')))))
      expect(seasons.filter((season) => !loader.ready(season))).toEqual([to])
      await told()
      expect(loader.ready(to)).toBe(false)
      end()
      await told()
      for (const season of seasons) expect(loader.ready(season)).toBe(true)
    }
  })

  it('is held until the last of what it is held for is over, and by nothing where nothing is owed', async () => {
    const loader = await loaded()
    loader.hold(to, undefined)
    expect(loader.ready(to)).toBe(true)
    const ends: (() => void)[] = []
    for (let n = 0; n < 2; n++) loader.hold(to, new Promise<void>((done) => ends.push(done)))
    ends[1]!()
    await told()
    expect(loader.ready(to)).toBe(false)
    ends[0]!()
    await told()
    expect(loader.ready(to)).toBe(true)
  })

  it('is not made ready by a hold that ends before it is loaded', async () => {
    let load = (): void => undefined
    const loader = new SeasonLoader(first, (season) => (season === to ? new Promise<void>((done) => (load = done)) : Promise.resolve()))
    await loader.first
    await told()
    let end = (): void => undefined
    loader.hold(to, new Promise<void>((done) => (end = done)))
    end()
    await told()
    expect(loader.ready(to)).toBe(false)
    load()
    await told()
    expect(loader.ready(to)).toBe(true)
  })

  it('holds the storm of a shake into it and shows nothing of it meanwhile, then lands in it on a beat of the cycle', async () => {
    const loader = await loaded()
    let end = (): void => undefined
    loader.hold(to, new Promise<void>((done) => (end = done)))
    const s = new LiveSession(new FakeSim(), first, loader.ready)
    expect(s.shake()).toBe(to)
    const e = s.shaking!
    const shown = new Set<string>()
    const look = (): void => {
      for (const season of seasonsIn(s.moment(1, 1))) shown.add(season)
    }
    run(s, barSeconds + 0.3, look)
    expect(s.busy).toBe(true)
    expect(e.holdBeats).toBeGreaterThan(0)
    expect([...shown]).toEqual([first])
    end()
    await told()
    const held = e.holdBeats!
    let landedAt = 0
    run(s, config.live.loadWaitSeconds + barSeconds, () => {
      look()
      if (!landedAt && !s.busy) landedAt = s.clock
    })
    expect(s.season).toBe(to)
    expect([...shown]).toEqual([first, to])
    expect(e.holdBeats! - held).toBeLessThanOrEqual(2 * (config.shake.swapWindow.fromBeat - config.shake.liftBeats))
    expect(landedAt).toBeGreaterThanOrEqual(e.startSec + barSeconds + e.holdBeats! * beatSeconds)
    expect(landedAt).toBeLessThan(e.startSec + barSeconds + e.holdBeats! * beatSeconds + 2 * FRAME_S)
  })

  it('gives the shake up after live.loadWaitSeconds where the hold does not end, as for a season that does not load', async () => {
    const loader = await loaded()
    loader.hold(to, new Promise<void>(() => undefined))
    const s = new LiveSession(new FakeSim(), first, loader.ready)
    expect(s.shake()).toBe(to)
    const shown = new Set<string>()
    run(s, barSeconds + config.live.loadWaitSeconds + 1, () => {
      for (const season of seasonsIn(s.moment(1, 1))) shown.add(season)
    })
    expect([...shown]).toEqual([first])
    expect(s.busy).toBe(false)
    expect(s.season).toBe(first)
  })
})

describe('reduced motion', () => {
  it('changes the season whole in one frame, after one frame of the season it leaves, with the globe at rest and no shake', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    s.reduced = true
    expect(s.shake()).toBe(next(first))
    expect(s.shaking).toBeNull()
    expect(s.busy).toBe(true)
    expect(s.shakes).toBe(0)
    expect(s.tl.events.length).toBe(0)
    s.tick(FRAME_S)
    expect(s.season).toBe(first)
    expect(s.moment(1, 1).season).toBe(first)
    s.tick(FRAME_S)
    expect(s.season).toBe(next(first))
    let moved = false
    let between = false
    run(s, LIVE.dissolveSeconds - 0.1, () => {
      const m = s.moment(1, 1)
      if (m.globe.y !== 0 || m.globe.x !== 0 || m.globe.tiltX !== 0) moved = true
      if (m.change !== 0 || m.season !== next(first)) between = true
      expect(s.busy).toBe(true)
      expect(s.target).toBe(next(first))
    })
    expect(moved).toBe(false)
    expect(between).toBe(false)
    expect(s.shake()).toBeNull()
    run(s, 0.3)
    expect(s.busy).toBe(false)
    expect(s.target).toBeNull()
    expect(s.season).toBe(next(first))
    expect(s.tl.events.length).toBe(0)
    expect(s.moment(1, 1).change).toBe(0)
    expect(s.moment(1, 1).season).toBe(next(first))
  })

  it('never asks the stage for half a change, at any frame of any press', () => {
    const s = new LiveSession(new FakeSim(), first)
    s.reduced = true
    for (const season of [...seasons.slice(1), first]) {
      expect(s.goTo(season)).toBe(season)
      run(s, LIVE.dissolveSeconds + 0.5, () => {
        const m = s.moment(1, 1)
        expect(m.change).toBe(0)
        expect(m.from).toBe(m.season)
        expect(m.to).toBe(m.season)
      })
      expect(s.busy).toBe(false)
      expect(s.season).toBe(season)
    }
  })

  it('ends the dissolve in the seconds of the screen, in three frames on a machine that draws one frame in two seconds', () => {
    const slow = LIVE.dissolveSeconds + 0.2
    const s = new LiveSession(new FakeSim(), first)
    s.reduced = true
    s.shake()
    s.tick(slow)
    expect(s.season).toBe(first)
    s.tick(slow)
    expect(s.season).toBe(next(first))
    expect(s.busy).toBe(true)
    s.tick(slow)
    expect(s.busy).toBe(false)
    expect(s.target).toBeNull()
    expect(s.shake()).toBe(next(next(first)))
  })

  it('waits for a late season before the change and gives up after live.loadWaitSeconds', () => {
    const loaded = new Set([first])
    const s = new LiveSession(new FakeSim(), first, (season) => loaded.has(season))
    s.reduced = true
    s.goTo(next(first))
    run(s, 1)
    expect(s.busy).toBe(true)
    expect(s.season).toBe(first)
    expect(s.moment(1, 1).season).toBe(first)
    loaded.add(next(first))
    s.tick(FRAME_S)
    expect(s.season).toBe(next(first))
    expect(s.busy).toBe(true)
    run(s, LIVE.dissolveSeconds + 0.2)
    expect(s.busy).toBe(false)
    expect(s.season).toBe(next(first))
    const far = next(next(first))
    s.goTo(far)
    run(s, config.live.loadWaitSeconds + 0.2)
    expect(s.busy).toBe(false)
    expect(s.season).toBe(next(first))
    expect(s.target).toBeNull()
  })
})

describe('the pace of the live simulation', () => {
  it('never steps more than the cap in one frame, however long the frame was', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    s.tick(10)
    expect(sim.step).toBeLessThanOrEqual(LIVE.stepCap)
    expect(s.clock).toBeLessThanOrEqual(LIVE.maxFrameSeconds + 1e-9)
    expect(s.clock).toBeCloseTo(sim.step / HZ, 9)
    s.tick(-5)
    expect(s.clock).toBeCloseTo(sim.step / HZ, 9)
  })

  it('slows its clock when the time budget of the frame is spent, and catches nothing up later', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    s.tick(0.1, () => true)
    expect(sim.step).toBe(LIVE.sliceSteps)
    expect(s.clock).toBeCloseTo(LIVE.sliceSteps / HZ, 9)
    s.tick(FRAME_S)
    expect(sim.step).toBe(Math.ceil((LIVE.sliceSteps / HZ + FRAME_S) * HZ - 1e-7))
    let slices = 0
    s.tick(0.2, () => ++slices >= 5)
    expect(s.clock).toBeCloseTo(sim.step / HZ, 9)
    expect(s.clock).toBeLessThan(LIVE.sliceSteps / HZ + FRAME_S + 0.2)
  })

  it('still lands a shake on its bar of simulated time when the clock runs slow', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    s.shake()
    const e = s.shaking!
    let frames = 0
    while (s.busy && frames < 100000) {
      s.tick(FRAME_S, () => true)
      frames++
    }
    expect(s.season).toBe(next(first))
    expect(s.clock).toBeGreaterThanOrEqual(e.startSec + barSeconds)
    expect(s.clock).toBeLessThan(e.startSec + barSeconds + 2 / HZ)
    expect(frames).toBeGreaterThan(barSeconds / FRAME_S)
  })

  it('does not spin when the simulation cannot advance', () => {
    const sim = new FakeSim()
    sim.stuck = true
    const s = new LiveSession(sim, first)
    s.tick(FRAME_S)
    expect(sim.calls).toBe(1)
  })

  it('gives the share of the last step for the picture, between 0 and 1', () => {
    const s = new LiveSession(new FakeSim(), first)
    for (let i = 0; i < 200; i++) {
      const mix = s.tick(0.0123)
      expect(mix).toBeGreaterThanOrEqual(0)
      expect(mix).toBeLessThanOrEqual(1)
    }
  })

  it('jumps to a season with no shake and skips ahead to a state in slices inside a budget', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    const other = seasons.at(-1)!
    s.jump(other)
    expect(s.season).toBe(other)
    expect(s.busy).toBe(false)
    expect(s.moment(1, 1).season).toBe(other)
    s.jump('monsoon')
    expect(s.season).toBe(other)
    s.setState('rest')
    expect(sim.resets).toBe(1)
    expect(s.skipping).toBe(true)
    expect(s.busy).toBe(true)
    expect(s.shake()).toBeNull()
    let spent = 0
    s.skip(() => (spent += 1), 3)
    expect(sim.step).toBeGreaterThan(0)
    expect(sim.step).toBeLessThanOrEqual(3 * LIVE.skipSliceSteps)
    expect(s.skipping).toBe(true)
    s.skip(() => 0, 1)
    expect(s.skipping).toBe(false)
    expect(s.busy).toBe(false)
    expect(s.clock).toBeCloseTo(barSeconds + config.states.restSeconds, 6)
    expect(s.stateName).toBe('rest')
    expect(s.season).toBe(other)
    s.setState('nonsense')
    expect(sim.resets).toBe(1)
  })
})

describe('touch', () => {
  const ref = 500
  const drag = (pxPerSecond: number, px: number, look = new Look()) => {
    const d = new Drag(look)
    d.down(100, 300, 0, ref)
    const stirs = []
    const dt = 1 / 120
    let x = 100
    let t = 0
    while (x - 100 < px) {
      x += pxPerSecond * dt
      t += dt
      const s = d.move(x, 300, t)
      if (s) stirs.push(s)
    }
    d.up()
    return { look, stirs, drag: d }
  }
  const total = (stirs: { strength: number }[]): number => stirs.reduce((a, s) => a + s.strength, 0)

  it('a slow drag turns the view and stirs nothing', () => {
    const { look, stirs } = drag(0.4 * ref, 120)
    expect(stirs).toEqual([])
    expect(look.yaw).toBeLessThan(-10)
    expect(Math.abs(look.yaw)).toBeLessThanOrEqual(config.live.orbitYawDeg)
    expect(look.pitch).toBeCloseTo(0, 6)
  })

  it('a fast drag stirs along its direction and hardly turns the view', () => {
    const slow = drag(0.4 * ref, 300).look
    const { look, stirs } = drag(6 * ref, 300)
    expect(stirs.length).toBeGreaterThan(0)
    for (const s of stirs) {
      expect(s.x).toBeGreaterThan(0.95)
      expect(Math.abs(s.y)).toBeLessThan(0.2)
    }
    expect(Math.abs(look.yaw)).toBeLessThan(Math.abs(slow.yaw) * 0.35)
  })

  it('a fast drag feeds the liquid while the pointer is down: many small pushes from the moment it is quick, and none at the release', () => {
    const d = new Drag(new Look())
    d.down(100, 300, 0, ref)
    const dt = 1 / 120
    const at: number[] = []
    const got = []
    for (let i = 1; i <= 36; i++) {
      const s = d.move(100 + 3.3 * ref * dt * i, 300, dt * i)
      if (s) {
        at.push(i)
        got.push(s)
      }
    }
    expect(d.up()).toBeUndefined()
    expect(at[0]! * dt).toBeLessThan(0.12)
    expect(got.length).toBeGreaterThan(20)
    expect(got.map((s) => s.begins)).toEqual([true, ...got.slice(1).map(() => false)])
    for (const s of got.slice(1)) expect(s.strength).toBeLessThan(0.08)
    expect(got[0]!.strength).toBeLessThan(0.25)
    expect(total(got)).toBeGreaterThan(TOUCH.leastStrength)
    expect(total(got)).toBeLessThanOrEqual(TOUCH.stirMost * (1 + (36 * dt) / TOUCH.stirRestSeconds))
  })

  it('a faster drag stirs harder, and a hold never gives more than its most and what it earns back meanwhile', () => {
    const a = drag(2.6 * ref, 150)
    const b = drag(8 * ref, 150)
    expect(total(b.stirs)).toBeGreaterThan(total(a.stirs) * 1.5)
    expect(b.stirs.at(-1)!.force).toBeCloseTo(1, 6)
    expect(a.stirs.at(-1)!.force).toBeLessThan(0.7)
    const long = total(drag(8 * ref, 4 * ref).stirs)
    expect(long).toBeLessThanOrEqual(TOUCH.stirMost * (1 + 0.5 / TOUCH.stirRestSeconds) + 1e-9)
    expect(long).toBeGreaterThan(TOUCH.stirMost)
  })

  it('a tap or a twitch does nothing', () => {
    const look = new Look()
    const d = new Drag(look)
    d.down(10, 10, 0, ref)
    d.up()
    expect(d.move(400, 10, 0.01)).toBeNull()
    expect(look.yaw).toBe(0)
    expect(drag(6 * ref, 12).stirs).toEqual([])
  })

  it('keeps the view inside the orbit limits and lets it ease back to the front when let go', () => {
    const look = new Look()
    for (let i = 0; i < 400; i++) look.turn(-3, 2, 1 / 60)
    const front = rigOf('hero')
    expect(look.yaw).toBe(-config.live.orbitYawDeg)
    expect(front.pitchDeg + look.pitch).toBeCloseTo(config.live.orbitPitchMaxDeg, 9)
    for (let i = 0; i < 400; i++) look.turn(3, -2, 1 / 60)
    expect(look.yaw).toBe(config.live.orbitYawDeg)
    expect(front.pitchDeg + look.pitch).toBeCloseTo(config.live.orbitPitchMinDeg, 9)
    look.held = true
    look.tick(1)
    expect(look.yaw).toBe(config.live.orbitYawDeg)
    look.held = false
    let last = Math.abs(look.yaw)
    for (let i = 0; i < 600; i++) {
      look.tick(1 / 60)
      expect(Math.abs(look.yaw)).toBeLessThanOrEqual(config.live.orbitYawDeg)
      last = Math.abs(look.yaw)
    }
    expect(last).toBeLessThan(0.01)
    expect(Math.abs(look.pitch)).toBeLessThan(0.01)
  })

  it('turns a stir into a spin about the axis across the drag, as the camera sees it', () => {
    const across = stirAxis({ x: 1, y: 0, strength: 1 }, 0)
    expect(across[0]).toBeCloseTo(0, 9)
    expect(across[1]).toBeCloseTo(TOUCH.stirRate, 9)
    expect(across[2]).toBeCloseTo(0, 9)
    const down = stirAxis({ x: 0, y: 1, strength: 0.5 }, 0)
    expect(down[0]).toBeCloseTo(TOUCH.stirRate * 0.5, 9)
    expect(down[1]).toBeCloseTo(0, 9)
    const turned = stirAxis({ x: 0, y: 1, strength: 1 }, 90)
    expect(turned[0]).toBeCloseTo(0, 6)
    expect(turned[2]).toBeCloseTo(-TOUCH.stirRate, 6)
  })

  it('takes two hard jolts of the device close together as a shake, and nothing less', () => {
    const m = new MotionShake()
    expect(m.feed(0, 0, 9.81, 0, true)).toBe(false)
    expect(m.feed(0, 0, 9.81 + MotionShake.threshold, 0.1, true)).toBe(false)
    expect(m.feed(0, 0, 9.81 + MotionShake.threshold, 0.12, true)).toBe(false)
    expect(m.feed(0, MotionShake.threshold, 9.81, 0.4, true)).toBe(false)
    expect(m.feed(0, 2 * MotionShake.threshold, 9.81, 0.5, true)).toBe(true)
    expect(m.feed(MotionShake.threshold + 1, 0, 0, 2, false)).toBe(false)
    expect(m.feed(MotionShake.threshold + 1, 0, 0, 2 + MotionShake.withinSeconds + 0.5, false)).toBe(false)
    expect(m.feed(3, 3, 3, 3.3, false)).toBe(false)
    expect(m.feed(MotionShake.threshold + 1, 0, 0, 3.4, false)).toBe(true)
  })
})

describe('the framing of the app', () => {
  const sizes = [
    ['hd', config.formats.hd.width, config.formats.hd.height],
    ['phone', config.formats.phone.width, config.formats.phone.height],
    ['tablet', config.formats.tablet.width, config.formats.tablet.height],
    ['landscape phone', config.formats.phone.height, config.formats.phone.width],
  ] as const
  const bars = [null, 60, 130] as const
  const high = 1 - 2 * FRAME.edgeShare
  const bar = config.film.beatsPerBar

  const measure = (w: number, h: number, controls: number | null) => {
    const under = roomUnder(h, controls, w)
    const rig = liveRig(w / h, 0, 0, under)
    const pose = poseOfRig(rig)
    const rest = reachOf(pose, REST_POSE)
    let top = rest.top
    let side = rest.side
    for (let n = 0; n < FRAME.shakePaths; n++) {
      const path = livePath(n)
      for (let b = 0; b <= bar; b += 0.004) {
        const r = reachOf(pose, path.poseAt(b))
        top = Math.max(top, r.top)
        side = Math.max(side, r.side)
      }
    }
    const barPx = controls ?? Math.min(Math.max(FRAME.barShare * h, FRAME.barPx), FRAME.barMost * h)
    const clearPx = ((1 - rest.foot) / 2) * h - barPx
    const heap = edges(rig).heap
    const heapPx = ((1 + heap) / 2) * h - barPx
    return { under, rig, rest, top, side, base: baseSide(rig), aspect: w / h, low: -1 + 2 * under, clearPx, clear: clearPx / h, heap, heapPx, heapClear: heapPx / h }
  }

  it('is the wide camera of the film moved back along its own axis, never nearer', () => {
    const hero = rigOf('hero')
    for (const [, w, h] of sizes) {
      const rig = liveRig(w / h, 0, 0, roomUnder(h))
      expect(rig.distanceMm).toBeGreaterThanOrEqual(hero.distanceMm)
      expect(rig.pitchDeg).toBe(hero.pitchDeg)
      if (w / h >= FRAME.narrowAspect) expect(rig.yawDeg).toBe(hero.yawDeg)
      expect(rig.fovDeg).toBe(hero.fovDeg)
      expect(rig.apertureMm).toBe(hero.apertureMm)
      expect(rig.focusShiftMm).toBe(hero.focusShiftMm)
    }
    expect(liveRig(0.01).distanceMm).toBe(liveRig(FRAME.leastAspect).distanceMm)
  })

  it('plays one of a fixed ring of shake paths, the ones the framing is fitted to', () => {
    for (const b of [0.5, 1.3, 2.2, 3.1, 3.7]) {
      expect(livePath(FRAME.shakePaths).poseAt(b)).toEqual(livePath(0).poseAt(b))
      expect(livePath(3).poseAt(b)).toEqual(makeShake('live-3').poseAt(b))
    }
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    for (let n = 0; n < FRAME.shakePaths + 2; n++) {
      expect(s.shake()).not.toBeNull()
      const e = s.tl.events.at(-1)!
      expect(e.id).toBe(`live-${n}`)
      for (const b of [1.4, 2.6]) expect(e.path.poseAt(b)).toEqual(livePath(n).poseAt(b))
      for (let i = 0; i < 60 * 12 && s.busy; i++) s.tick(FRAME_S)
      expect(s.busy).toBe(false)
    }
  })

  it('keeps the lifted glass under the top edge through every shake, at every size', () => {
    for (const [name, w, h] of sizes) {
      for (const controls of bars) {
        const m = measure(w, h, controls)
        expect(m.top, `${name} ${controls}`).toBeLessThanOrEqual(high + 1e-6)
        expect(m.rest.top, `${name} ${controls}`).toBeLessThan(m.top)
      }
    }
  })

  it('keeps the foot of the base at rest clear of the controls, at every size', () => {
    for (const [name, w, h] of sizes) {
      for (const controls of bars) {
        const m = measure(w, h, controls)
        expect(-m.rest.foot, `${name} ${controls}`).toBeGreaterThanOrEqual(m.low - 1e-9)
        expect(margins(m.rig).under, `${name} ${controls}`).toBeGreaterThanOrEqual(m.under - 1e-9)
      }
    }
  })

  it('keeps the widest stroke between the sides of a wide screen', () => {
    for (const [name, w, h] of sizes) {
      if (w < h) continue
      for (const controls of bars) {
        const m = measure(w, h, controls)
        expect(m.side / m.aspect, `${name} ${controls}`).toBeLessThanOrEqual(1 - 2 * FRAME.edgeShare + 1e-6)
      }
    }
    for (const aspect of [1, 1.05, 1.2]) {
      const m = measure(1000 * aspect, 1000, null)
      expect(m.side / m.aspect, `${aspect}`).toBeLessThanOrEqual(1 - 2 * FRAME.edgeShare + 1e-6)
      expect(m.top, `${aspect}`).toBeLessThanOrEqual(high + 1e-6)
    }
  })

  it('lets the whole globe at rest, the glass and the widest base, fill the width of an upright screen, where the strokes may pass the sides', () => {
    const p = config.formats.phone
    const m = measure(p.width, p.height, 130)
    expect(m.base / m.aspect).toBeCloseTo(1 - 2 * FRAME.edgeShare, 4)
    expect(m.rest.side).toBeLessThan(m.base)
    expect(m.rest.side / m.aspect).toBeGreaterThan(0.78)
    expect(m.side / m.aspect).toBeGreaterThan(1)
    expect(-m.rest.foot).toBeGreaterThan(m.low)
    const t = config.formats.tablet
    const tablet = measure(t.width, t.height, null)
    expect(tablet.base / tablet.aspect).toBeLessThanOrEqual(1 - 2 * FRAME.edgeShare + 1e-4)
    expect(tablet.rest.side / tablet.aspect).toBeLessThan(1 - 2 * FRAME.edgeShare)
    expect(tablet.rest.side / tablet.aspect).toBeGreaterThan(0.75)
  })

  it('stands as near as the edges allow: a limit is met exactly at every size', () => {
    const hero = rigOf('hero')
    for (const aspect of [0.3, 0.46, 0.6, 0.75, 0.95, 1, 1.1, 1.33, 16 / 9, 2.16, 3]) {
      for (const under of [0.08, 0.0889, 0.12, 0.18, 0.25, 0.35]) {
        const m = measure(4000 * aspect, 4000, 4000 * (under - (aspect < FRAME.narrowAspect ? FRAME.thumbShare : FRAME.clearShare)))
        expect(m.under).toBeCloseTo(under, 9)
        const upright = Math.abs(m.top - high) < 1e-4 && Math.abs(m.heap - m.low) < 1e-6
        const across = Math.abs((aspect >= 1 ? m.side : m.base) / aspect - (1 - 2 * FRAME.edgeShare)) < 1.5e-3
        expect(upright || across || m.rig.distanceMm === hero.distanceMm, `${aspect} ${under}`).toBe(true)
        expect(m.top, `${aspect} ${under}`).toBeLessThanOrEqual(high + 1e-4)
        expect(-m.rest.foot, `${aspect} ${under}`).toBeGreaterThanOrEqual(m.low - 1e-9)
        expect(m.heap, `${aspect} ${under}`).toBeGreaterThanOrEqual(m.low - 1e-9)
        expect((aspect >= 1 ? m.side : m.base) / aspect, `${aspect} ${under}`).toBeLessThanOrEqual(1 - 2 * FRAME.edgeShare + 1e-4)
      }
    }
  })

  it('stands the foot at rest, with what the season heaps in front of the base, 7 percent of the height over the highest control on a wide screen and on a tablet, with the globe as large as that, the top edge and, on the tablet, the sides allow', () => {
    const hero = rigOf('hero')
    for (const [w, h] of [[config.formats.hd.width, config.formats.hd.height], [config.formats.tablet.width, config.formats.tablet.height]] as const) {
      for (const controls of [60, 74, 86, 130]) {
        const m = measure(w, h, controls)
        expect(m.heapClear, `${w} ${controls}`).toBeGreaterThanOrEqual(FRAME.clearShare - 1e-9)
        expect(m.heapClear, `${w} ${controls}`).toBeCloseTo(FRAME.clearShare, 6)
        expect(m.heapPx, `${w} ${controls}`).toBeCloseTo(FRAME.clearShare * h, 3)
        expect(m.clear, `${w} ${controls}`).toBeGreaterThan(FRAME.clearShare + 0.03)
        expect(m.top, `${w} ${controls}`).toBeLessThanOrEqual(high + 1e-4)
        expect(m.rig.distanceMm, `${w} ${controls}`).toBeGreaterThan(hero.distanceMm)
        const nearer = { ...m.rig, distanceMm: m.rig.distanceMm * 0.995 }
        const pose = poseOfRig(nearer)
        let top = -Infinity
        for (let n = 0; n < FRAME.shakePaths; n++) for (let b = 0; b <= bar; b += 0.004) top = Math.max(top, reachOf(pose, livePath(n).poseAt(b)).top)
        const span = top - edges(nearer).heap
        const tall = span > high - m.low
        const broad = baseSide(nearer) / m.aspect > 1 - 2 * FRAME.edgeShare
        expect(tall || broad, `${w} ${controls}`).toBe(true)
        if (w > h) {
          expect(m.top, `${w} ${controls}`).toBeCloseTo(high, 4)
          expect(tall, `${w} ${controls}`).toBe(true)
        }
      }
    }
  })

  it('keeps the framing of a phone: the whole globe fills the width, and the foot stands 5 percent of the height or more over the highest control', () => {
    const p = config.formats.phone
    for (const controls of [100, 128, 150]) {
      const m = measure(p.width, p.height, controls)
      expect(m.base / m.aspect, `${controls}`).toBeCloseTo(1 - 2 * FRAME.edgeShare, 4)
      expect(m.clear, `${controls}`).toBeGreaterThanOrEqual(FRAME.thumbShare - 1e-9)
      expect(m.top, `${controls}`).toBeLessThanOrEqual(high + 1e-6)
      expect(Math.abs(m.rig.distanceMm / measure(p.width, p.height, 0).rig.distanceMm - 1), `${controls}`).toBeLessThan(0.003)
    }
    expect(roomUnder(p.height, 128, p.width) - 128 / p.height).toBeCloseTo(FRAME.thumbShare, 12)
    expect(roomUnder(p.width, 60, p.height) - 60 / p.width).toBeCloseTo(FRAME.clearShare, 12)
  })

  it('holds the base of every season, as its model is built, between the sides of the phone and of the tablet', () => {
    const reachOfModel = (season: string): { left: number; right: number; top: number } => {
      const file = readFileSync(`public/assets/${season}/base-${season}.glb`)
      const gltf = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8')) as {
        meshes: { primitives: { attributes: { POSITION: number } }[] }[]
        accessors: { min?: number[]; max?: number[] }[]
        nodes: { scale?: number[]; translation?: number[]; rotation?: number[]; matrix?: number[] }[]
      }
      for (const n of gltf.nodes) expect(n.scale ?? n.translation ?? n.rotation ?? n.matrix, season).toBeUndefined()
      const out = { left: 0, right: 0, top: 0 }
      for (const mesh of gltf.meshes) {
        for (const prim of mesh.primitives) {
          const a = gltf.accessors[prim.attributes.POSITION]!
          out.left = Math.min(out.left, a.min![0]!)
          out.right = Math.max(out.right, a.max![0]!)
          out.top = Math.max(out.top, a.max![1]!)
        }
      }
      return out
    }
    const models = config.seasons.map((season) => ({ season, ...reachOfModel(season) }))
    const widest = Math.max(...models.map((m) => Math.max(-m.left, m.right)))
    expect(widest).toBeLessThanOrEqual(FRAME.baseReachMm)
    expect(widest).toBeGreaterThan(FRAME.baseReachMm - 1.5)
    expect(widest).toBeGreaterThan(config.globe.baseDiameterMm / 2)
    for (const [name, w, h] of sizes) {
      if (w > h) continue
      for (const controls of [null, 86, 128, 150]) {
        const rig = liveRig(w / h, 0, 0, roomUnder(h, controls, w))
        const pose = poseOfRig(rig)
        const f = h / 2 / Math.tan((rig.fovDeg * Math.PI) / 360)
        const { x: px, y: py, z: pz } = pose.position
        const d = pose.aim.distanceTo(pose.position)
        const dir = [(pose.aim.x - px) / d, (pose.aim.y - py) / d, (pose.aim.z - pz) / d] as const
        for (const m of models) {
          for (const y of [0, m.top]) {
            const depth = (0 - px) * dir[0] + (y - py) * dir[1] + (0 - pz) * dir[2]
            const left = w / 2 + (f * m.left) / depth
            const right = w / 2 + (f * m.right) / depth
            expect(left, `${name} ${controls} ${m.season}`).toBeGreaterThanOrEqual(FRAME.edgeShare * w - 0.0005 * w)
            expect(right, `${name} ${controls} ${m.season}`).toBeLessThanOrEqual(w - FRAME.edgeShare * w + 0.0005 * w)
          }
        }
      }
    }
  })

  it('places the smaller globe of a phone between the top edge and the controls: the room over the glass FRAME.overUnder times the room under the foot, never more than twice', () => {
    for (const [w, h] of [[config.formats.phone.width, config.formats.phone.height], [360, 800], [414, 896], [430, 932]] as const) {
      for (const controls of [100, 128, 150]) {
        const m = measure(w, h, controls)
        const over = (1 - m.rest.top) / 2
        const underFoot = (1 - m.rest.foot) / 2 - controls / h
        expect(over / underFoot, `${w} ${controls}`).toBeCloseTo(FRAME.overUnder, 2)
        expect(over / underFoot, `${w} ${controls}`).toBeLessThanOrEqual(2)
        expect(underFoot, `${w} ${controls}`).toBeGreaterThanOrEqual(FRAME.thumbShare)
        expect(m.top, `${w} ${controls}`).toBeLessThanOrEqual(high + 1e-6)
        expect(m.heap, `${w} ${controls}`).toBeGreaterThanOrEqual(m.low - 1e-9)
      }
    }
    const t = config.formats.tablet
    const tablet = measure(t.width, t.height, 86)
    expect((1 - tablet.rest.top) / 2 / ((1 - tablet.rest.foot) / 2 - 86 / t.height)).toBeLessThan(FRAME.overUnder)
    expect(tablet.heapClear).toBeCloseTo(FRAME.clearShare, 6)
  })

  it('gives a screen still the framing numbers of the camera that drew it, as the harness gives them for a camera of the config', () => {
    for (const f of [config.formats.hd, config.formats.phone]) {
      const a = framingOf('hero', f.width, f.height)
      const b = framingOfRig(rigOf('hero'), f.width, f.height)
      for (const k of ['cx', 'cy', 'r'] as const) expect(b.globe[k]).toBeCloseTo(a.globe[k], 6)
      for (const k of ['left', 'right', 'top', 'foot'] as const) expect(b.base[k]).toBeCloseTo(a.base[k], 6)
      for (const k of ['frameHeightMm', 'frameWidthMm', 'heroFill', 'cornerReachMm'] as const) expect(b[k]).toBeCloseTo(a[k], 6)
    }
    for (const [, w, h] of sizes) {
      const rig = liveRig(w / h, 0, 0, roomUnder(h))
      const f = framingOfRig(rig, w, h)
      expect(1 - (2 * f.base.foot) / h).toBeCloseTo(edges(rig).foot, 6)
      expect(1 - (2 * (f.globe.cy - f.globe.r)) / h).toBeCloseTo(edges(rig).top, 2)
      expect(f.base.foot).toBeLessThanOrEqual(h * (1 - roomUnder(h)) + 1e-6)
      expect(f.globe.cx).toBeCloseTo(w / 2, 6)
    }
    const hd = config.formats.hd
    expect(framingOfRig(liveRig(hd.width / hd.height, 0, 0, roomUnder(hd.height)), hd.width, hd.height).globe.r).toBeLessThan(framingOf('hero', hd.width, hd.height).globe.r)
  })

  it('measures the top of the glass and the foot of the base as the harness does', () => {
    const hd = config.formats.hd
    const f = framingOf('hero', hd.width, hd.height)
    const e = edges(rigOf('hero'))
    expect(e.top).toBeCloseTo(1 - (2 * (f.globe.cy - f.globe.r)) / hd.height, 2)
    expect(e.foot).toBeCloseTo(1 - (2 * f.base.foot) / hd.height, 6)
    const m = margins(rigOf('hero'))
    expect(m.over).toBeCloseTo((f.globe.cy - f.globe.r) / hd.height, 2)
    expect(m.under).toBeCloseTo(1 - f.base.foot / hd.height, 6)
    const rig = liveRig(16 / 9, 0, 0, 0.1)
    const r = reachOf(poseOfRig(rig), REST_POSE)
    expect(edges(rig).top).toBeCloseTo(r.top, 9)
    expect(edges(rig).foot).toBeCloseTo(-r.foot, 3)
    expect(shakeReach(rig).top).toBeGreaterThan(r.top)
  })

  it('takes the room from the height of the window and from the controls when they are measured', () => {
    expect(roomUnder(1080)).toBeCloseTo(Math.max(FRAME.barShare, FRAME.barPx / 1080) + FRAME.clearShare, 12)
    expect(roomUnder(4000)).toBeCloseTo(FRAME.barShare + FRAME.clearShare, 12)
    expect(roomUnder(390)).toBeCloseTo(FRAME.barMost + FRAME.clearShare, 12)
    expect(Math.abs(roomUnder(390) - roomUnder(390, 54)) * 390).toBeLessThan(1)
    expect(roomUnder(1080, 74)).toBeCloseTo(74 / 1080 + FRAME.clearShare, 12)
    expect(roomUnder(1080, 74, 1920)).toBe(roomUnder(1080, 74))
    expect(roomUnder(1366, 86, 1024)).toBeCloseTo(86 / 1366 + FRAME.clearShare, 12)
    expect(roomUnder(844, 130, 390)).toBeCloseTo(130 / 844 + FRAME.thumbShare, 12)
    expect(roomUnder(100, 500)).toBe(FRAME.mostUnder)
    expect(roomUnder(0)).toBeCloseTo(FRAME.barMost + FRAME.clearShare, 12)
    const far = liveRig(16 / 9, 0, 0, 5)
    expect((1 + edges(far).heap) / 2).toBeCloseTo(FRAME.mostUnder, 6)
    expect(margins(far).under).toBeGreaterThan(FRAME.mostUnder)
  })

  it('keeps a turned view inside the orbit limits', () => {
    const rig = liveRig(16 / 9, 500, 500)
    expect(rig.yawDeg).toBe(config.live.orbitYawDeg)
    expect(rig.pitchDeg).toBe(config.live.orbitPitchMaxDeg)
    const low = liveRig(16 / 9, -500, -500)
    expect(low.yawDeg).toBe(-config.live.orbitYawDeg)
    expect(low.pitchDeg).toBe(config.live.orbitPitchMinDeg)
  })
})

describe('the fixed states of the interface for the harness', () => {
  class FakeAnim {
    playbackRate = 1
    currentTime = 0
    ended = false
    effect: { getComputedTiming(): { duration: number } }
    constructor(readonly ms: number) {
      this.effect = { getComputedTiming: () => ({ duration: ms }) }
    }
    finish(): void {
      this.ended = true
    }
    cancel(): void {
      this.ended = true
    }
  }
  class FakeTransition extends FakeAnim {}
  class FakeEl {
    dataset: Record<string, string> = {}
    kids: FakeEl[] = []
    anims: FakeAnim[] = []
    events: string[] = []
    focused = 0
    constructor(
      readonly attrs: Record<string, string> = {},
      public box: [number, number, number, number] = [0, 0, 0, 0],
    ) {}
    getBoundingClientRect() {
      const [left, top, width, height] = this.box
      return { left, top, width, height, right: left + width, bottom: top + height }
    }
    is(one: string): boolean {
      const m = /^\[data-([a-z]+)(?:="([^"]*)")?\]$/.exec(one.trim())
      if (!m) return false
      const v = this.attrs[m[1]!]
      return v !== undefined && (m[2] === undefined || v === m[2])
    }
    querySelectorAll(sel: string): FakeEl[] {
      return this.kids.filter((k) => sel.split(',').some((one) => k.is(one)))
    }
    querySelector(sel: string): FakeEl | null {
      return this.querySelectorAll(sel)[0] ?? null
    }
    getAnimations(): FakeAnim[] {
      return this.anims
    }
    dispatchEvent(e: Event): boolean {
      this.events.push(e.type)
      return true
    }
    focus(): void {
      this.focused++
      doc.activeElement = this
    }
    blur(): void {
      if (doc.activeElement === this) doc.activeElement = null
    }
    matches(sel: string): boolean {
      return sel === ':focus-visible' && doc.activeElement === this
    }
  }
  const doc = { activeElement: null as FakeEl | null, anims: [] as FakeAnim[], frame: new FakeEl({}, [0, 0, 390, 844]) }
  let root: FakeEl
  let seen: AppState[]
  let visible: boolean[]
  const shake = () => root.querySelector('[data-control="shake"]')!
  const overlay = () => createOverlay(root as unknown as HTMLElement)

  beforeEach(() => {
    root = new FakeEl()
    root.kids = [
      new FakeEl({ control: 'shake' }, [133, 772, 124, 50]),
      new FakeEl({ control: 'sound' }, [0, 0, 0, 0]),
      ...seasons.map((s, i) => new FakeEl({ season: s }, [100 + 54 * i, 716, 44, 44])),
    ]
    seen = []
    visible = []
    doc.activeElement = null
    doc.anims = [new FakeAnim(300)]
    ui.mount = (_el, bridge) => {
      const b = bridge as AppBridge
      seen.push(b.state())
      b.subscribe((st) => seen.push(st))
      return {
        setVisible(v) {
          visible.push(v)
          if (v) root.dataset.interface = 'shown'
          else delete root.dataset.interface
        },
        dispose: () => undefined,
      }
    }
    vi.stubGlobal('window', { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id) })
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 0))
    vi.stubGlobal('document', { getAnimations: () => doc.anims, getElementById: (id: string) => (id === 'app' ? doc.frame : null), get activeElement() { return doc.activeElement } })
    vi.stubGlobal('HTMLElement', FakeEl)
    vi.stubGlobal('CSSTransition', FakeTransition)
    vi.stubGlobal('MutationObserver', class { observe(): void {} disconnect(): void {} })
  })
  afterEach(() => {
    ui.mount = null
    vi.unstubAllGlobals()
  })

  it('shows the interface at rest in the asked season, undimmed, and says where the control is', async () => {
    const o = overlay()
    expect(o.controlsPx()).toBeNull()
    const r = await o.put('rest', {})
    expect(r).toEqual({ state: 'rest', control: 'shake', season: first, target: null, phase: null, rect: [133, 772, 124, 50], at: [195, 797], focusVisible: false, paused: 0, shown: true })
    expect(visible).toEqual([true])
    expect(seen.at(-1)).toMatchObject({ season: first, state: 'rest', target: null, busy: false, playing: 'live', ready: true })
    expect(seen.some((st) => st.busy)).toBe(true)
    expect(doc.anims[0]!.ended).toBe(true)
    expect(o.controlsPx()).toBe(844 - 716)
    expect(roomUnder(844, o.controlsPx(), 390)).toBeCloseTo(128 / 844 + FRAME.thumbShare, 12)
    const other = await o.put('rest', { season: next(first), control: next(first) })
    expect(other.season).toBe(next(first))
    expect(other.control).toBe(next(first))
    expect(other.rect).toEqual([154, 716, 44, 44])
    expect(seen.at(-1)!.season).toBe(next(first))
    expect(visible).toEqual([true, true])
    o.hide()
    expect(visible.at(-1)).toBe(false)
    expect(o.controlsPx()).toBe(128)
  })

  it('gives a control the focus a keyboard gives it', async () => {
    const o = overlay()
    const mark = root.querySelector(`[data-season="${first}"]`)!
    mark.focus()
    const r = await o.put('focus', {})
    expect(r.state).toBe('focus')
    expect(r.focusVisible).toBe(true)
    expect(shake().focused).toBe(1)
    expect(doc.activeElement).toBe(shake())
    expect(r.phase).toBeNull()
    expect((await o.put('rest', {})).focusVisible).toBe(false)
  })

  it('holds a press at the asked phase of each animation, a press on a mark going to its season', async () => {
    const o = overlay()
    const slow = new FakeAnim(400)
    const quick = new FakeAnim(120)
    const fade = new FakeTransition(200)
    root.anims = [slow, quick, fade]
    const r = await o.put('pressed', { phase: 0.25 })
    expect(r).toMatchObject({ state: 'pressed', control: 'shake', target: next(first), phase: 0.25, paused: 2, shown: true })
    expect(seen.at(-1)).toMatchObject({ busy: true, target: next(first), season: first })
    expect([slow.playbackRate, quick.playbackRate]).toEqual([0, 0])
    expect(slow.currentTime).toBeCloseTo(100, 9)
    expect(quick.currentTime).toBeCloseTo(30, 9)
    expect(fade.ended).toBe(true)
    expect(fade.playbackRate).toBe(1)
    const far = seasons[(seasons.indexOf(first) + 2) % seasons.length]!
    const mark = await o.put('pressed', { control: far, phase: 7 })
    expect(mark.target).toBe(far)
    expect(mark.phase).toBe(1)
    expect(slow.currentTime).toBeCloseTo(399, 9)
    expect((await o.put('pressed', {})).phase).toBe(0.5)
    expect((await o.put('pressed', { phase: -3 })).phase).toBe(0)
    await expect(o.put('pressed', { control: first })).rejects.toThrow(/season shown/)
  })

  it('holds the hint at one phase of its longest animation, so its parts stay together', async () => {
    const o = overlay()
    const slow = new FakeAnim(1000)
    const quick = new FakeAnim(200)
    root.anims = [slow, quick]
    const r = await o.put('hint', { phase: 0.5 })
    expect(root.events).toEqual(['hint'])
    expect(r).toMatchObject({ state: 'hint', phase: 0.5, paused: 2, target: null })
    expect(slow.currentTime).toBeCloseTo(500, 9)
    expect(quick.currentTime).toBeCloseTo(199, 9)
    expect(seen.at(-1)!.busy).toBe(false)
  })

  it('says a control is not on screen, and refuses what it does not know', async () => {
    const o = overlay()
    const r = await o.put('rest', { control: 'sound' })
    expect(r.rect).toBeNull()
    expect(r.at).toBeNull()
    expect(INTERFACE_STATES).toEqual(['rest', 'focus', 'pressed', 'hint'])
    await expect(o.put('dimmed', {})).rejects.toThrow(/no such interface state/)
    await expect(o.put('rest', { season: 'monsoon' })).rejects.toThrow(/no such season/)
    await expect(o.put('rest', { control: 'menu' })).rejects.toThrow(/no such control/)
  })

  it('says so when the build has no interface', async () => {
    ui.mount = null
    await expect(overlay().put('rest', {})).rejects.toThrow(/no interface/)
    await expect(createOverlay(null).put('rest', {})).rejects.toThrow(/no interface/)
  })
})

describe('the quality levels', () => {
  it('come from the config, best first', () => {
    expect(levels.map((l) => l.id)).toEqual(Object.keys(config.live.quality))
    expect(topLevel).toBe(levels[0])
    expect(stageQuality(levelById(levels.at(-1)!.id)).particleFraction).toBe(levels.at(-1)!.particleFraction)
    expect(() => levelById('ultra')).toThrow()
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBe(0)
  })

  /** A fake clock: frames arrive at `fps` for `seconds`, and a changed level is applied as the app applies it. Returns when the level changed, and to what. */
  const run = (g: Governor, fps: number, seconds: number, clock: { t: number } = { t: 0 }, hitchEvery = 0): { at: number; to: string }[] => {
    const out: { at: number; to: string }[] = []
    const end = clock.t + seconds
    let sinceHitch = 0
    while (clock.t < end - 1e-9) {
      let dt = 1 / fps
      sinceHitch += dt
      if (hitchEvery > 0 && sinceHitch >= hitchEvery) {
        dt = 1.4
        sinceHitch = 0
      }
      clock.t += dt
      if (g.frame(dt)) {
        out.push({ at: clock.t, to: g.level.id })
        g.rest()
      }
    }
    return out
  }
  const last = levels.at(-1)!

  it('steps down one level at a time when the frames are too slow, and only on automatic', () => {
    const g = new Governor('auto')
    expect(g.auto).toBe(true)
    expect(g.level).toBe(topLevel)
    const rate = topLevel.minFps - 8
    const wait = Math.min(config.live.probeFrames / rate, GOVERN.spanSeconds)
    const steps = run(g, rate, wait + 2 / rate)
    expect(steps.length).toBe(1)
    expect(steps[0]!.to).toBe(levels[1]!.id)
    expect(Math.abs(steps[0]!.at - wait)).toBeLessThanOrEqual(1.5 / rate)
    expect(g.measuredFps).toBeCloseTo(rate, 6)
    run(g, 5, 60)
    expect(g.level).toBe(last)
    const fixed = new Governor(topLevel.id)
    expect(fixed.auto).toBe(false)
    expect(run(fixed, 5, 60)).toEqual([])
    expect(fixed.level).toBe(topLevel)
  })

  it('judges by the clock as well as by the count: a page at 2 frames a second is on the lowest level within seconds', () => {
    const g = new Governor('auto')
    const steps = run(g, 2, 30)
    expect(steps.map((s) => s.to)).toEqual(levels.slice(1).map((l) => l.id))
    const each = Math.max(GOVERN.spanSeconds, GOVERN.minFrames / 2)
    steps.forEach((s, i) => expect(s.at).toBeCloseTo((i + 1) * each, 6))
    expect(steps.at(-1)!.at).toBeLessThan(config.live.probeFrames / 2)
    expect(g.level).toBe(last)
    expect(g.measuredFps).toBeCloseTo(2, 6)

    const shaken = new Governor('auto')
    const clock = { t: 0 }
    const every = GOVERN.spanSeconds + 2
    expect(every * 2).toBeLessThan(config.live.probeFrames)
    for (let i = 0; i < 6 && shaken.level !== last; i++) {
      run(shaken, 2, every, clock)
      shaken.rest()
    }
    expect(shaken.level).toBe(last)
    expect(clock.t).toBeLessThanOrEqual(every * (levels.length - 1))

    const crawl = new Governor('auto')
    const slow = run(crawl, 0.25, 4 * GOVERN.minFrames * (levels.length - 1))
    expect(slow.map((s) => s.to)).toEqual(levels.slice(1).map((l) => l.id))
    expect(crawl.measuredFps).toBeCloseTo(1, 6)
  })

  it('holds its level when the frames are fast enough, through a long frame now and then, and for a level of one frame too few', () => {
    const g = new Governor('auto')
    expect(run(g, topLevel.minFps + 5, 120)).toEqual([])
    expect(run(g, topLevel.minFps + 5, 120, { t: 0 }, 3)).toEqual([])
    expect(g.level).toBe(topLevel)
    const brief = new Governor('auto')
    for (let i = 0; i < GOVERN.minFrames - 1; i++) expect(brief.frame(5)).toBe(false)
    expect(brief.level).toBe(topLevel)
    expect(brief.frame(5)).toBe(true)
    expect(brief.level).toBe(levels[1])
  })

  it('never comes back up at a rate that is only fast enough, and comes back once when the page is clearly fast', () => {
    const above = topLevel
    const clearly = GOVERN.upFactor * above.minFps + 5
    const enough = GOVERN.upFactor * above.minFps - 5
    expect(enough).toBeGreaterThan(levels[1]!.minFps)

    const g = new Governor('auto')
    const clock = { t: 0 }
    expect(run(g, above.minFps - 10, 4, clock).length).toBe(1)
    expect(g.level).toBe(levels[1])
    expect(run(g, enough, 300, clock)).toEqual([])
    expect(g.level).toBe(levels[1])

    const started = clock.t
    const up = run(g, clearly, GOVERN.upSeconds + 3, clock)
    expect(up.map((s) => s.to)).toEqual([above.id])
    expect(up[0]!.at - started).toBeGreaterThanOrEqual(GOVERN.upSeconds - 1e-6)
    expect(up[0]!.at - started).toBeLessThanOrEqual(GOVERN.upSeconds + 2)
    expect(run(g, clearly, 120, clock)).toEqual([])
    expect(g.level).toBe(above)

    expect(run(g, above.minFps - 10, 4, clock).map((s) => s.to)).toEqual([levels[1]!.id])
    expect(run(g, clearly, 600, clock)).toEqual([])
    expect(g.level).toBe(levels[1])

    const broken = new Governor('auto')
    const t = { t: 0 }
    run(broken, above.minFps - 10, 4, t)
    run(broken, clearly, GOVERN.upSeconds - 3, t)
    run(broken, enough, 3, t)
    expect(run(broken, clearly, GOVERN.upSeconds - 3, t)).toEqual([])
    expect(broken.level).toBe(levels[1])
  })

  it('forgets a pause, and takes a fixed level when one is chosen', () => {
    const g = new Governor('auto')
    for (let i = 0; i < GOVERN.minFrames - 1; i++) g.frame(1 / 2)
    g.rest()
    for (let i = 0; i < GOVERN.minFrames - 1; i++) expect(g.frame(1 / 2)).toBe(false)
    expect(g.level).toBe(topLevel)
    g.fix(last.id)
    expect(g.auto).toBe(false)
    expect(g.level).toBe(last)
    expect(run(g, 200, 60)).toEqual([])
    g.fix('auto')
    expect(g.auto).toBe(true)
    expect(g.level).toBe(topLevel)
    expect(g.frame(0)).toBe(false)
    expect(g.frame(-1)).toBe(false)
  })
})

describe('the probe', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the slowest one percent of frames', () => {
    expect(slowest([])).toBe(0)
    expect(slowest([0.016])).toBe(0.016)
    const frames = Array.from({ length: 200 }, (_, i) => (i === 7 || i === 90 || i === 150 ? 0.1 : 0.016))
    expect(slowest(frames)).toBe(0.1)
    const steady = Array.from({ length: 200 }, (_, i) => (i === 7 || i === 150 ? 0.1 : 0.016))
    expect(slowest(steady)).toBe(0.016)
  })

  it('picks the best level that holds its frame rate at rest and in the storm', () => {
    const row = (level: string, rest: number, storm: number) => ({ level, restMedianFps: rest, restSlowFps: rest, stormMedianFps: storm, stormSlowFps: storm })
    const [a, b, c] = levels
    expect(pickLevel([row(a!.id, a!.minFps + 1, a!.minFps), row(b!.id, 90, 90), row(c!.id, 90, 90)])).toBe(a!.id)
    expect(pickLevel([row(a!.id, a!.minFps + 20, a!.minFps - 1), row(b!.id, b!.minFps, b!.minFps), row(c!.id, 90, 90)])).toBe(b!.id)
    expect(pickLevel([row(a!.id, 5, 5), row(b!.id, 6, 6), row(c!.id, 7, 7)])).toBe(c!.id)
    expect(pickLevel([])).toBe(c!.id)
  })

  it('runs every level for perf.probeSeconds, through one shake each, and reports them', async () => {
    vi.stubGlobal('window', { screen: { width: 1280, height: 720 }, devicePixelRatio: 2 })
    vi.stubGlobal('navigator', { userAgent: 'test' })
    const set: string[] = []
    let shakes = 0
    let feed: ((seconds: number) => void) | null = null
    let glassReads = 0
    const host: ProbeHost = {
      setLevel: (id) => set.push(id),
      shake: () => shakes++,
      onFrame: (fn) => (feed = fn),
      graphics: () => 'a test renderer',
      maths: () => ['pow(-2, 2) nan'],
      glass: () => `picture ${++glassReads}`,
    }
    const probe = createProbe(host)
    expect(probe.levels()).toEqual(levels.map((l) => l.id))
    expect(probe.secondsPerLevel()).toBe(config.perf.probeSeconds)
    const phases: string[] = []
    const result = probe.run((done, running) => {
      if (running) {
        const key = `${running.level}:${running.phase}`
        if (phases.at(-1) !== key) phases.push(key)
        expect(running.fraction).toBeGreaterThanOrEqual(0)
        expect(running.fraction).toBeLessThanOrEqual(1)
      } else expect(done.length).toBe(levels.length)
    })
    const rate = (i: number) => [60, 44, 36][i] ?? 30
    let frames = 0
    while (feed && frames < 100000) {
      ;(feed as (seconds: number) => void)(1 / rate(set.length - 1))
      frames++
    }
    const r = await result
    expect(set).toEqual(levels.map((l) => l.id))
    expect(shakes).toBe(levels.length)
    expect(phases).toEqual(levels.flatMap((l) => [`${l.id}:rest`, `${l.id}:storm`]))
    expect(r.levels.map((l) => l.level)).toEqual(levels.map((l) => l.id))
    expect(r.levels[0]!.restMedianFps).toBe(60)
    expect(r.levels[0]!.stormSlowFps).toBe(60)
    expect(r.levels[1]!.stormMedianFps).toBe(44)
    expect(r.pick).toBe(pickLevel(r.levels))
    expect(r.graphics).toBe('a test renderer')
    expect(r.maths).toEqual(['pow(-2, 2) nan'])
    expect(r.glass).toBe('picture 1')
    expect(glassReads).toBe(1)
    expect(r.screen).toBe('1280 x 720')
    expect(r.pixelRatio).toBe(2)
    expect(frames).toBeGreaterThan(levels.length * config.perf.probeSeconds * 30)
  })
})

describe('the players', () => {
  const source = (count: number): ParticleSource => ({ count, step: 0, pos: new Float32Array(count * 3), prev: new Float32Array(count * 3), sizes: new Float32Array(count), kindOf: new Uint8Array(count), kinds: ['flake'], state: new Uint8Array(count), liquid: new Float64Array(4) })

  it('autopilot plays the film from frame 0, with the cameras of the cut, and starts again at the end', () => {
    const sim = new FakeSim()
    const cut = filmCut()
    const auto = new Autopilot(sim, false)
    expect(sim.resets).toBe(1)
    expect(auto.lead).toBe(0)
    const f = auto.frame(0, 1)
    expect(f.opening).toBeNull()
    expect(cameraNumbers(f.pose)).toEqual(cameraNumbers(filmPose(cut, 0)))
    expect(f.moment.season).toBe(cut.sections[0]!.season)
    let t = 0
    let lifted = 0
    while (auto.restarts === 0 && t < cut.seconds + 5) {
      const frame = auto.frame(0.1, 1)
      t += 0.1
      if (frame.moment.globe.y > 0) lifted++
      expect(auto.seconds).toBeGreaterThanOrEqual(0)
      expect(auto.seconds).toBeLessThanOrEqual(cut.seconds)
    }
    expect(auto.restarts).toBe(1)
    expect(sim.resets).toBe(2)
    expect(lifted).toBeGreaterThan(cut.shakes.length * 10)
    expect(t).toBeGreaterThan(cut.seconds - 0.2)
  })

  it('autopilot with the opening counts its frames first, then the film', () => {
    const cut = filmCut()
    const plan = openingPlan(cut.fps)
    const auto = new Autopilot(new FakeSim(), true)
    expect(auto.lead).toBe(plan.seconds)
    const seen: number[] = []
    let filmAt = -1
    for (let i = 0; i < Math.ceil((plan.seconds + 1) / 0.05); i++) {
      const f = auto.frame(0.05, 1)
      if (f.opening !== null) seen.push(f.opening)
      else if (filmAt < 0) filmAt = i * 0.05
    }
    expect(seen[0]).toBeGreaterThanOrEqual(0)
    expect(seen.at(-1)!).toBeLessThan(plan.frameCount)
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThan(seen[i - 1]!)
    expect(filmAt).toBeGreaterThan(plan.seconds - 0.1)
    expect(filmAt).toBeLessThan(plan.seconds + 0.1)
  })

  it('autopilot can play one shot on its own', () => {
    const cut = filmCut()
    const span = cut.spans.find((s) => s.shot.kind === 'shake')!
    const auto = new Autopilot(new FakeSim(), true, span.shot.id)
    expect(auto.lead).toBe(0)
    expect(auto.from).toBeCloseTo(span.startSec, 9)
    expect(auto.to).toBeCloseTo(span.startSec + span.seconds, 9)
    const f = auto.frame(span.seconds / 2, 1)
    expect(f.moment.globe.y).toBeGreaterThan(0)
    expect(cameraNumbers(f.pose)).toEqual(cameraNumbers(filmPose(cut, auto.seconds)))
  })

  it('the loop player goes round in the length of the loop', () => {
    const base = source(50)
    const particles = new SourceSwitch(base)
    const loop = standInLoop(base, 57, -28)
    const player = new LoopPlayer(particles, loop)
    const a = player.frame(0, 1)
    expect(a.moment.period).toBe(loopSeconds)
    expect(particles.pos).toBe(loop.source.pos)
    const stamp = particles.step
    const frames = Math.round(loopSeconds / 0.05)
    for (let i = 0; i < frames - 2; i++) player.frame(0.05, 1)
    expect(particles.step).not.toBe(stamp)
    expect(player.seconds).toBeCloseTo(loopSeconds - 0.1, 6)
    for (let i = 0; i < 4; i++) player.frame(0.05, 1)
    expect(player.seconds).toBeCloseTo(0.1, 6)
    particles.use(null)
    expect(particles.pos).toBe(base.pos)
    expect(particles.step).toBe(base.step)
  })
})

describe('the scripted replays of the app', () => {
  const fps = config.film.fps
  const lead = Math.round(SCRIPT.leadSeconds * fps)
  const bar = Math.round(barSeconds * fps)
  class StirSim extends FakeSim {
    stirred: number[][] = []
    stir(x: number, y: number, z: number): void {
      this.stirred.push([x, y, z])
    }
  }
  const play = (name: string, to?: string) => {
    const sim = new StirSim()
    const plan = scriptPlan(name, first, to)
    const run = new Replay(sim, plan, 16 / 9)
    return { sim, plan, run }
  }

  it('gives every script its length and its events on the clock of the film, and refuses what it does not know', () => {
    for (const name of SCRIPTS) {
      const plan = scriptPlan(name)
      expect(plan.fps).toBe(fps)
      expect(plan.from).toBe(first)
      expect(plan.events[0]!.frame).toBe(lead)
      for (const e of plan.events) expect(e.frame).toBeLessThan(plan.frameCount)
    }
    expect(scriptPlan('shake').to).toBe(next(first))
    expect(scriptPlan('shake').frameCount).toBe(lead + bar + Math.round(SCRIPT.tailSeconds * fps))
    expect(scriptPlan('jump', first, seasons[3]).to).toBe(seasons[3])
    expect(scriptPlan('stir').to).toBe(first)
    expect(() => scriptPlan('dance')).toThrow()
    expect(() => scriptPlan('shake', 'monsoon')).toThrow()
    expect(() => scriptPlan('jump', first, first)).toThrow()
  })

  it('plays the same frames whether it is asked for one frame or walked through all of them', () => {
    for (const name of SCRIPTS) {
      const a = play(name)
      const b = play(name)
      const at = Math.round(a.plan.frameCount * 0.6)
      a.run.advanceTo(at)
      for (let i = 0; i <= at; i += 7) b.run.advanceTo(i)
      b.run.advanceTo(at)
      expect(b.run.record()).toEqual(a.run.record())
      expect(b.run.moment()).toEqual(a.run.moment())
      expect(cameraNumbers(b.run.pose(0))).toEqual(cameraNumbers(a.run.pose(0)))
      expect(b.sim.step).toBe(a.sim.step)
      expect(a.sim.step).toBe(Math.ceil((at / fps) * HZ - 1e-7))
    }
  })

  it('shakes into the next season on the landing, and jumps straight into the named one', () => {
    const s = play('shake')
    s.run.advanceTo(lead - 1)
    expect(s.run.record().busy).toBe(false)
    s.run.advanceTo(lead + 1)
    expect(s.run.record()).toMatchObject({ busy: true, season: first, target: next(first) })
    s.run.advanceTo(lead + bar - 2)
    expect(s.run.record().season).toBe(first)
    s.run.advanceTo(lead + bar + 2)
    expect(s.run.record()).toMatchObject({ busy: false, season: next(first), target: null })
    expect(s.run.session.shakes).toBe(1)
    const j = play('jump', seasons[3])
    j.run.advanceTo(j.plan.frameCount - 1)
    expect(j.run.record()).toMatchObject({ busy: false, season: seasons[3], frame: j.plan.frameCount - 1 })
    expect(j.run.session.shakes).toBe(1)
  })

  it('sets a season with no shake', () => {
    const s = play('set', seasons[2])
    s.run.advanceTo(lead - 1)
    expect(s.run.record().season).toBe(first)
    s.run.advanceTo(lead)
    expect(s.run.record()).toMatchObject({ season: seasons[2], busy: false })
    expect(s.run.moment().globe).toEqual(REST_POSE)
    expect(s.run.session.shakes).toBe(0)
  })

  it('stirs once with a quick drag, in small pushes while the pointer is down, and leaves the season and the camera where they were', () => {
    const s = play('stir')
    const down = s.plan.events[0]!.frame
    const up = s.plan.events[1]!.frame
    s.run.advanceTo(down + 4)
    expect(s.sim.stirred.length).toBeGreaterThan(0)
    s.run.advanceTo(up)
    const fed = s.sim.stirred.length
    expect(fed).toBeGreaterThan(4)
    const rates = s.sim.stirred.map((p) => Math.hypot(...p))
    expect(Math.max(...rates)).toBeLessThan(TOUCH.stirRate * 0.25)
    s.run.advanceTo(s.plan.frameCount - 1)
    const r = s.run.record()
    expect(r.stirs).toBe(1)
    expect(s.sim.stirred).toHaveLength(fed)
    expect(r.stirStrength).toBeGreaterThanOrEqual(TOUCH.leastStrength)
    expect(r.stirStrength).toBeLessThanOrEqual(1)
    expect(r).toMatchObject({ season: first, busy: false })
    expect(s.run.session.shakes).toBe(0)
    expect(Math.abs(r.yawDeg)).toBeLessThan(0.5)
  })

  it('turns the camera with a slow drag, holds it while the pointer is down and eases back when it is let go', () => {
    const s = play('drag')
    const held = lead + Math.round(SCRIPT.dragSeconds * fps)
    const up = held + Math.round(SCRIPT.holdSeconds * fps)
    s.run.advanceTo(held)
    const a = s.run.record()
    expect(Math.abs(a.yawDeg)).toBeGreaterThan(config.live.orbitYawDeg * 0.5)
    expect(Math.abs(a.yawDeg)).toBeLessThanOrEqual(config.live.orbitYawDeg + 1e-9)
    s.run.advanceTo(up - 1)
    expect(s.run.record().yawDeg).toBeCloseTo(a.yawDeg, 6)
    s.run.advanceTo(s.plan.frameCount - 1)
    const b = s.run.record()
    expect(Math.abs(b.yawDeg)).toBeLessThan(Math.abs(a.yawDeg) * 0.05)
    expect(b).toMatchObject({ stirs: 0, season: first, busy: false })
  })
})

describe('the canvas over the first still', () => {
  const sheet = readFileSync('index.html', 'utf8')
  const rule = (selector: string): string => new RegExp(`\\n\\s*${selector.replace(/[[\]]/g, '\\$&')} \\{([^}]*)\\}`).exec(sheet)![1]!
  const fadeMs = 1000 * Number(/transition: opacity ([\d.]+)s/.exec(rule('#view[data-live]'))![1])

  /** A page as a browser keeps it. What the canvas stood at when the still was ended is written down: its mark, and its own word on its fade. */
  const page = (still: boolean) => {
    const heard: Record<string, (() => void)[]> = {}
    const waits: { over: () => void; ms: number }[] = []
    const ended: { mark: string | undefined; fade: string }[] = []
    const told = { gone: 0 }
    const canvas = {
      style: { transition: '' },
      dataset: {} as Record<string, string>,
      addEventListener: (type: string, f: () => void): void => void (heard[type] ??= []).push(f),
    }
    const win = {
      firstStill: still ? { place: (): void => undefined, end: (): void => void ended.push({ mark: canvas.dataset.live, fade: canvas.style.transition }) } : undefined,
      setTimeout: (over: () => void, ms: number): number => waits.push({ over, ms }),
    }
    reveal(canvas as unknown as HTMLCanvasElement, win as unknown as Window, () => void told.gone++)
    return { canvas, heard, waits, ended, told }
  }

  it('fades the canvas in to full sight over half a second, by the sheet of the page', () => {
    expect(rule('#view')).toMatch(/opacity: 0;/)
    expect(rule('#view[data-live]')).toMatch(/opacity: 1;/)
    expect(fadeMs).toBe(500)
  })

  it('leaves the still under the canvas while the canvas comes in, and waits longer than the fade lasts', () => {
    const p = page(true)
    expect(p.canvas.dataset.live).toBe('')
    expect(p.canvas.style.transition).toBe('')
    expect(p.ended).toHaveLength(0)
    expect(p.told.gone).toBe(0)
    expect(p.heard.transitionend).toHaveLength(1)
    expect(p.waits).toHaveLength(1)
    expect(p.waits[0]!.ms).toBeGreaterThanOrEqual(2 * fadeMs)
  })

  // A fade keeps the time of the frames the page draws and the wait the time of the wall. Where frames are few the wait is over
  // 33 ms into the fade: the still went from under a canvas at a twentieth of its sight, and the page was black for seconds.
  it('cuts the fade short as the still goes when the wait is over and the fade is not: the still never goes from under a canvas short of full sight', () => {
    const p = page(true)
    p.waits[0]!.over()
    expect(p.ended).toEqual([{ mark: '', fade: 'none' }])
    expect(p.canvas.style.transition).toBe('none')
    expect(p.canvas.dataset.live).toBe('')
    expect(p.told.gone).toBe(1)
    p.heard.transitionend![0]!()
    p.waits[0]!.over()
    expect(p.ended).toHaveLength(1)
    expect(p.told.gone).toBe(1)
  })

  it('ends the still once, at the end of a fade that is over in time, and leaves the wait nothing to do', () => {
    const p = page(true)
    p.heard.transitionend![0]!()
    expect(p.ended.map((e) => e.mark)).toEqual([''])
    expect(p.told.gone).toBe(1)
    p.waits[0]!.over()
    expect(p.ended).toHaveLength(1)
    expect(p.told.gone).toBe(1)
  })

  it('starts a film or the loop at once: no still, no fade and no wait', () => {
    const p = page(false)
    expect(p.canvas.style.transition).toBe('none')
    expect(p.canvas.dataset.live).toBe('')
    expect(p.waits).toHaveLength(0)
    expect(p.heard.transitionend).toBeUndefined()
    expect(p.told.gone).toBe(1)
  })
})

describe('where the page puts a picture of the first still', () => {
  type Box = { x: number; y: number; w: number; h: number }
  type Pic = { style: Record<string, string>; naturalWidth: number; naturalHeight: number; laid?: Box; heard: (() => void)[]; addEventListener(kind: string, heard: () => void): void }
  type Still = [string, number, number, ...(string | number)[]]
  type Put = (img: Pic, b: Box) => void
  const script = /<script>([\s\S]*?)<\/script>/.exec(readFileSync('index.html', 'utf8'))![1]!
  const source = /\n( *var NEAR = [\d.e-]+\n *var HAIR = [\d.e-]+\n *var LOOSE = [\d.e-]+\n *function put\(img, b\) \{[\s\S]*?\n {8}\})\n/.exec(script)![1]!
  const near = Number(/var NEAR = ([\d.e-]+)/.exec(source)![1])
  const hair = Number(/var HAIR = ([\d.e-]+)/.exec(source)![1])
  const loose = Number(/var LOOSE = ([\d.e-]+)/.exec(source)![1])
  const table = JSON.parse(/\/\*first:begin\*\/([\s\S]*?)\/\*first:end\*\//.exec(script)![1]!) as { season: string; stills: Still[] }
  /** The sizes the stills of the places below were drawn for, written here: these tests are of `put` and not of the table. */
  const drawnFor: Record<string, readonly [number, number]> = { hd: [1920, 1080], wide: [2560, 1080], tablet: [1024, 1366], phone: [390, 844], phone590: [390, 590], mid: [719, 600] }
  const still = (name: string): Still => [name, ...drawnFor[name]!]
  const made = new Function('window', 'exact', 'box', 'layers', `${source}\nreturn put`) as (window: object, exact: object | null, box: object | null, layers: { still: Still; over: Pic }[]) => Put
  /** The page's own `put` once the app has said where the glass is, on a screen that draws so many pixels for one of the page's. */
  const putOn = (ratio: number | undefined): Put => made({ devicePixelRatio: ratio }, {}, null, [])
  /** The same `put` before the app has spoken, unless it is said to have: on a screen of that size, with those stills in place. */
  const readOn = (ratio: number, wide: number, high: number, layers: { still: Still; over: Pic }[], said = false, inner: readonly [number, number] = [1, 1]): Put =>
    made({ devicePixelRatio: ratio, innerWidth: inner[0], innerHeight: inner[1] }, said ? {} : null, { clientWidth: wide, clientHeight: high }, layers)
  const px = (v: string | undefined): number => Number((v ?? '').replace(/px$/, ''))
  /** Where a browser draws the picture: its box, moved and sized by its matrix if it has one. */
  const drawn = (img: { style: Record<string, string> }): Box => {
    const m = /^matrix\((.+)\)$/.exec(img.style.transform ?? '')
    const [a = 1, , , d = 1, e = 0, f = 0] = m ? m[1]!.split(',').map(Number) : []
    return { x: px(img.style.left) + e, y: px(img.style.top) + f, w: px(img.style.width) * a, h: px(img.style.height) * d }
  }
  /** A picture and the pixels of its file, none while the file has not arrived. Its list of listeners is read as it grows. */
  const pic = (naturalWidth = 0, naturalHeight = 0): Pic => {
    const heard: (() => void)[] = []
    return { style: {}, naturalWidth, naturalHeight, heard, addEventListener: (kind, f) => void (kind === 'load' && heard.push(f)) }
  }
  const arrive = (img: Pic, naturalWidth: number, naturalHeight: number): void => {
    Object.assign(img, { naturalWidth, naturalHeight })
    for (let i = 0; i < img.heard.length; i++) {
      expect(i, 'a listener that listens again never lets the list end').toBeLessThan(4)
      img.heard[i]!()
    }
  }
  const sameBox = (a: Box, b: Box, digits = 9): void => {
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k], k).toBeCloseTo(b[k], digits)
  }
  const plainly = (img: Pic, b: Box): void => {
    expect(img.style).toMatchObject({ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, transform: '', willChange: '' })
  }
  // Places the built page works out once the app has said where the globe stands, each with the pixels of its still's file.
  const hd = { at: { x: 0.009, y: 0.0025, w: 1919.982, h: 1079.9899 }, file: [1920, 1080] } as const
  const phone = { at: { x: 0.0029, y: 0.0017, w: 389.9942, h: 843.9875 }, file: [780, 1688] } as const
  const hdIn1280 = { at: { x: 11.5091, y: 0.1821, w: 1256.9818, h: 707.0523 }, file: [1920, 1080] } as const
  const midIn600 = { at: { x: -59.5046, y: -0.0003, w: 719.0093, h: 600.0078 }, file: [1438, 1200] } as const
  const midIn601 = { at: { x: -59.0046, y: -0.0003, w: 719.0093, h: 600.0078 }, file: [1438, 1200] } as const
  const midIn590 = { at: { x: -56.4389, y: 0.0435, w: 702.8779, h: 586.5462 }, file: [1438, 1200] } as const
  const lowIn600 = { at: { x: -59.4955, y: 0.001, w: 718.991, h: 480.994 }, file: [1438, 962] } as const
  const between: Box = { x: 10.3, y: 0.4, w: 701.3, h: 501.1 }
  // Places the built page reads from its table before the app has spoken, each with its still, its screen and the pixels of its file.
  type Read = { still: string; screen: readonly [number, number]; at: Box; file: readonly [number, number] }
  const midRead: Read = { still: 'mid', screen: [600, 600], at: { x: -59.33537, y: -0.00433, w: 718.67074, h: 599.72523 }, file: [1438, 1200] }
  const hdRead: Read = { still: 'hd', screen: [1800, 1080], at: { x: -59.70198, y: -0.00311, w: 1919.40396, h: 1079.66473 }, file: [1920, 1080] }
  const wideRead: Read = { still: 'wide', screen: [2600, 1080], at: { x: 20.04518, y: -0.00035, w: 2559.90964, h: 1079.96188 }, file: [2560, 1080] }
  const tallRead: Read = { still: 'mid', screen: [600, 601], at: { x: -60.23459, y: -0.00651, w: 720.46918, h: 601.22602 }, file: [1438, 1200] }
  const narrowRead: Read = { still: 'phone', screen: [389, 844], at: { x: 0.00588, y: 0.94597, w: 388.98823, h: 841.81043 }, file: [780, 1688] }
  const widerRead: Read = { still: 'phone', screen: [391, 844], at: { x: 0.00158, y: -0.90529, w: 390.99683, h: 846.15724 }, file: [780, 1688] }
  const tabletRead: Read = { still: 'tablet', screen: [1023, 1366], at: { x: 0.02797, y: 1.21255, w: 1022.94407, h: 1364.5914 }, file: [1229, 1639] }
  const shortRead: Read = { still: 'phone590', screen: [369, 590], at: { x: -10.13621, y: 0.73277, w: 389.27243, h: 588.89931 }, file: [780, 1180] }
  /** A picture put where the page read it: the top picture of its still unless another is, of the file of the read unless of another. */
  const reads = (r: Read, ratio = 1, o: { said?: boolean; top?: boolean; file?: readonly [number, number]; mask?: string } = {}): Pic => {
    const img = pic(...(o.file ?? r.file))
    if (o.mask) img.style.maskImage = img.style.webkitMaskImage = o.mask
    readOn(ratio, r.screen[0], r.screen[1], [{ still: still(r.still), over: o.top === false ? pic(...r.file) : img }], o.said)(img, r.at)
    return img
  }
  const wholly = (img: { style: Record<string, string> }, b: Box): void => {
    expect(img.style).toMatchObject({ transform: '', willChange: '' })
    sameBox(drawn(img), b, 6)
  }

  it('lays a picture whose place is on whole pixels there, with no matrix and no layer, to be drawn pixel for pixel', () => {
    for (const [ratio, still] of [[1, hd], [3, phone], [1, midIn601], [2, midIn600]] as const) {
      const img = pic(...still.file)
      putOn(ratio)(img, still.at)
      plainly(img, still.at)
      expect(img.heard, `${ratio}`).toHaveLength(0)
    }
  })

  it('lays any other in the corner, in a box of whole pixels, and moves and sizes it from there to its place', () => {
    for (const [still, w, h] of [[hdIn1280, 1257, 707], [midIn590, 703, 587]] as const) {
      const img = pic(...still.file)
      putOn(1)(img, still.at)
      expect(img.style).toMatchObject({ left: '0px', top: '0px', width: `${w}px`, height: `${h}px`, transformOrigin: '0 0', willChange: '' })
      expect(img.style.transform).toMatch(/^matrix\([-\d.e]+,0,0,[-\d.e]+,[-\d.e]+,[-\d.e]+\)$/)
      sameBox(drawn(img), still.at)
    }
  })

  it('takes a place for whole only within the little the rounding of the table moves an edge by', () => {
    // On a phone at three to one a still is 3 x 844 pixels high, and the table gives the glass and its row to five places.
    expect(near).toBeGreaterThanOrEqual(0.08)
    expect(near).toBeLessThanOrEqual(0.1)
    for (const [edge, whole] of [[near * 0.9, true], [near * 1.1, false], [0.5, false], [1 - near * 0.9, true]] as const) {
      for (const b of [{ x: edge, y: 0, w: 700, h: 500 }, { x: 0, y: edge, w: 700, h: 500 }, { x: 0, y: 0, w: 700 + edge, h: 500 }, { x: 0, y: 0, w: 700, h: 500 + edge }]) {
        const img = pic(1920, 1080)
        putOn(1)(img, b)
        expect(img.style.transform === '', `${edge} ${JSON.stringify(b)}`).toBe(whole)
        sameBox(drawn(img), b)
      }
    }
  })

  it('counts in the pixels of the screen, and makes the box whole in those as in the pixels of the page', () => {
    // A ratio is a number of 32 bits by the time a browser gives it: 1.1 is not 1.1.
    for (const ratio of [1.25, 1.5, 1.75, 2, 2.625, 3, Math.fround(1.1), Math.fround(1.65)]) {
      const img = pic(1920, 1080)
      putOn(ratio)(img, between)
      expect(img.style.transform, `${ratio}`).not.toBe('')
      for (const side of [px(img.style.width), px(img.style.height)]) {
        expect(Number.isInteger(side), `${ratio}`).toBe(true)
        expect(Math.abs(side * ratio - Math.round(side * ratio)), `${ratio}`).toBeLessThan(1e-3)
      }
      sameBox(drawn(img), between)
    }
    const odd = pic(1920, 1080)
    putOn(1.0123)(odd, between)
    expect(odd.style).toMatchObject({ width: '701px', height: '501px' })
    sameBox(drawn(odd), between)
    const whole = pic(1920, 1080)
    putOn(1.25)(whole, { x: 0, y: 0, w: 1536, h: 864 })
    plainly(whole, { x: 0, y: 0, w: 1536, h: 864 })
    const unsaid = pic(1920, 1080)
    const atOne = pic(1920, 1080)
    putOn(undefined)(unsaid, between)
    putOn(1)(atOne, between)
    expect(unsaid.style).toEqual(atOne.style)
  })

  it('gives a picture drawn at half its file on half pixels a layer of its own, and a hair more than half', () => {
    expect(hair).toBeGreaterThan(0)
    expect((hair * 2560) / 2).toBeLessThan(0.02)
    for (const still of [midIn600, lowIn600]) {
      const img = pic(...still.file)
      putOn(1)(img, still.at)
      expect(img.style).toMatchObject({ left: '0px', top: '0px', width: `${still.file[0] / 2}px`, height: `${still.file[1] / 2}px`, willChange: 'transform' })
      const to = drawn(img)
      expect(to.w).toBeCloseTo((still.file[0] / 2) * (1 + hair), 9)
      expect(to.h).toBeCloseTo((still.file[1] / 2) * (1 + hair), 9)
      expect(to.w).toBeGreaterThan(still.file[0] / 2)
      expect(to.h).toBeGreaterThan(still.file[1] / 2)
      expect(to.x + to.w / 2).toBeCloseTo(still.at.x + still.at.w / 2, 9)
      expect(to.y + to.h / 2).toBeCloseTo(still.at.y + still.at.h / 2, 9)
      sameBox(to, still.at, 1)
    }
    const twice = pic(1438, 1200)
    const half: Box = { x: midIn600.at.x / 2, y: midIn600.at.y / 2, w: midIn600.at.w / 2, h: midIn600.at.h / 2 }
    putOn(2)(twice, half)
    expect(twice.style).toMatchObject({ width: '360px', height: '300px', willChange: 'transform' })
    expect(drawn(twice).w * 2).toBeCloseTo(719 * (1 + hair), 9)
    sameBox(drawn(twice), half, 1)
  })

  it('gives no layer where the browser would not halve the file in place', () => {
    const masked = pic(...midIn600.file)
    masked.style.maskImage = 'linear-gradient(to top, transparent, #000 10px)'
    const quarter = { x: -59.25, y: 0, w: 719, h: 600 }
    const unknown = pic()
    for (const [img, at] of [[masked, midIn600.at], [pic(...midIn600.file), quarter], [pic(...midIn590.file), midIn590.at], [pic(...hdIn1280.file), hdIn1280.at], [unknown, midIn600.at]] as const) {
      putOn(1)(img, at)
      expect(img.style.willChange).toBe('')
      expect(img.style.transform).not.toBe('')
      sameBox(drawn(img), at)
    }
    expect(unknown.heard).toHaveLength(1)
  })

  it('puts a picture again when its file arrives, where it was last put, and listens once', () => {
    const img = pic()
    const put = putOn(1)
    put(img, between)
    put(img, midIn600.at)
    expect(img.heard).toHaveLength(1)
    expect(img.style.willChange).toBe('')
    arrive(img, 0, 0)
    expect(img.heard).toHaveLength(1)
    arrive(img, ...midIn600.file)
    expect(img.heard).toHaveLength(1)
    expect(img.style.willChange).toBe('transform')
    sameBox(drawn(img), midIn600.at, 1)
  })

  it('leaves no matrix and no layer on a picture that is put on whole pixels after', () => {
    const img = pic(...midIn600.file)
    const put = putOn(1)
    put(img, midIn600.at)
    expect(img.style.willChange).toBe('transform')
    put(img, midIn601.at)
    plainly(img, midIn601.at)
  })

  // The table is kept within a thousandth of the height of the app. A still drawn at half its file, read a third of a pixel
  // beside its place, was the browser's own soft copy until the app spoke, and sharpened and moved when it did.
  it('stands a still read within a little of the size it was drawn for at that size from the top, before the app has spoken', () => {
    const half = reads(midRead)
    expect(half.style).toMatchObject({ left: '0px', top: '0px', width: '719px', height: '600px', willChange: 'transform' })
    sameBox(drawn(half), { x: -59.5, y: 0, w: 719, h: 600 }, 1)
    expect(drawn(half).x + drawn(half).w / 2).toBeCloseTo(midRead.at.x + midRead.at.w / 2, 9)
    wholly(reads(hdRead), { x: -60, y: 0, w: 1920, h: 1080 })
    wholly(reads(midRead, 2), { x: -59.5, y: 0, w: 719, h: 600 })
    // Of all the screens that show a still at half or the whole of its file, the table is furthest off on this one.
    const short = reads(shortRead, 2)
    expect(short.style).toMatchObject({ transform: '', willChange: '' })
    sameBox(drawn(short), { x: -10.5, y: 0, w: 390, h: 590 }, 4)
    expect(reads(shortRead).style.willChange).toBe('transform')
    for (const [read, said, ratio] of [[midRead, midIn600, 1], [midRead, midIn600, 2], [hdRead, { at: { x: -59.991, y: 0.0025, w: 1919.982, h: 1079.9899 }, file: hdRead.file }, 1]] as const) {
      const before = reads(read, ratio)
      const after = pic(...said.file)
      putOn(ratio)(after, said.at)
      expect([before.style.transform === '', before.style.willChange], `${read.still} ${ratio}`).toEqual([after.style.transform === '', after.style.willChange])
      sameBox(drawn(before), drawn(after), 1)
    }
  })

  it('takes a place for read at the size of its still only within less than one pixel across the narrowest still', () => {
    expect(loose).toBeLessThan(1 / (Math.min(...table.stills.map((s) => s[1])) + 1))
    const own: Box = { x: -59.5, y: 0, w: 719, h: 600 }
    for (const [share, stands] of [[0.9, true], [1.1, false]] as const) {
      for (const off of [share * loose, -share * loose]) {
        for (const b of [{ ...own, x: own.x - (off * own.w) / 2, w: own.w * (1 + off) }, { ...own, h: own.h * (1 + off) }, { ...own, y: off * own.h }]) {
          const img = pic(...midRead.file)
          readOn(1, 600, 600, [{ still: still('mid'), over: img }])(img, b)
          sameBox(drawn(img), stands ? own : b, 1)
        }
      }
    }
  })

  it('leaves a place as it was read wherever the screen does not show the still at half or the whole of its file from the top', () => {
    const left: [string, Pic, Box][] = [
      ['the app has spoken', reads(midRead, 1, { said: true }), midRead.at],
      ['not the top picture of its still', reads(midRead, 1, { top: false }), midRead.at],
      ['a screen of another height', reads(tallRead), tallRead.at],
      ['a screen a pixel narrower than a still that fills its width', reads(narrowRead, 2), narrowRead.at],
      ['a screen a pixel wider than it', reads(widerRead, 2), widerRead.at],
      ['a file as wide as the still and not as high', reads(midRead, 1, { file: [1438, 1202] }), midRead.at],
      ['a file that has not arrived', reads(midRead, 1, { file: [0, 0] }), midRead.at],
    ]
    for (const ratio of [1.25, 1.5, 1.75, 3, Math.fround(1.1)]) left.push([`${ratio} pixels of the screen for one`, reads(midRead, ratio), midRead.at])
    for (const ratio of [1.5, 2, 3]) left.push([`a whole file on ${ratio} pixels for one`, reads(hdRead, ratio), hdRead.at])
    // The largest still is kept at four fifths of its size, and at less where the browser reads no avif.
    for (const file of [[1229, 1639], [983, 1311]] as const) for (const ratio of [1, 1.5, 2]) left.push([`a file of ${file[0]} pixels across at ${ratio}`, reads(tabletRead, ratio, { file }), tabletRead.at])
    for (const [what, img, at] of left) {
      expect(img.style.transform, what).not.toBe('')
      expect(img.style.willChange, what).toBe('')
      for (const k of ['x', 'y', 'w', 'h'] as const) expect(drawn(img)[k], `${what} ${k}`).toBeCloseTo(at[k], 9)
    }
    const late = left[6]![1]
    expect(late.heard).toHaveLength(1)
    arrive(late, ...midRead.file)
    expect(late.heard).toHaveLength(1)
    expect(late.style.willChange).toBe('transform')
    sameBox(drawn(late), { x: -59.5, y: 0, w: 719, h: 600 }, 1)
  })

  it('reads each top picture against its own still while two stills are in place', () => {
    const hdOn600: Box = { x: -127.793, y: 1.569, w: 855.587, h: 481.267 }
    for (const first of [true, false]) {
      const [old, now] = [pic(...hdRead.file), pic(...midRead.file)]
      const layers = [{ still: still('hd'), over: old }, { still: still('mid'), over: now }]
      const put = readOn(1, 600, 600, first ? layers : layers.reverse())
      put(old, hdOn600)
      put(now, midRead.at)
      sameBox(drawn(old), hdOn600)
      expect(now.style.willChange).toBe('transform')
      sameBox(drawn(now), { x: -59.5, y: 0, w: 719, h: 600 }, 1)
    }
  })

  // A picture thins out toward an edge it does not reach. Read a little small, a still was thinned toward the foot of a screen
  // it fills, and a thinned picture is never halved in place.
  it('takes the thinning from a still that stands at its own size and reaches both sides, and from no other', () => {
    const foot = 'linear-gradient(to top, transparent, #000 1px)'
    const sides = 'linear-gradient(to left, transparent, #000 60px),linear-gradient(to right, transparent, #000 60px)'
    expect(reads(midRead, 1, { mask: foot }).style).toMatchObject({ maskImage: '', webkitMaskImage: '', willChange: 'transform' })
    expect(reads(hdRead, 1, { mask: foot }).style).toMatchObject({ maskImage: '', webkitMaskImage: '', transform: '' })
    const bare = reads(wideRead, 1, { mask: sides })
    expect(bare.style).toMatchObject({ maskImage: sides, webkitMaskImage: sides })
    wholly(bare, { x: 20, y: 0, w: 2560, h: 1080 })
    for (const read of [narrowRead, widerRead, tallRead]) expect(reads(read, 2, { mask: foot }).style, read.still).toMatchObject({ maskImage: foot, webkitMaskImage: foot })
    expect(reads(midRead, 1, { mask: foot, said: true }).style).toMatchObject({ maskImage: foot, webkitMaskImage: foot })
    const mid = still('mid')
    for (const [ratio, wide, x, thinned] of [[1, 600, 5, true], [1, 600, -124, true], [1, 600, -119, false], [1, 719, 0.09, false], [1, 719, 0.11, true], [1, 719, -0.11, true], [2, 719, 0.04, false], [2, 719, 0.06, true], [2, 719, -0.06, true]] as const) {
      const img = pic(...midRead.file)
      img.style.maskImage = img.style.webkitMaskImage = sides
      readOn(ratio, wide, 600, [{ still: mid, over: img }])(img, { x, y: 0, w: 719, h: 600 })
      expect(img.style.maskImage, `${ratio} ${wide} ${x}`).toBe(thinned ? sides : '')
      expect(img.style.webkitMaskImage, `${ratio} ${wide} ${x}`).toBe(thinned ? sides : '')
    }
  })

  it('reads the size of the screen from the box of the stills, and from the window where the box gives none', () => {
    const foot = 'linear-gradient(to top, transparent, #000 1px)'
    for (const [high, inner, stands] of [[600, 700, true], [0, 600, true], [0, 601, false], [601, 600, false]] as const) {
      const img = pic(...midRead.file)
      readOn(1, 600, high, [{ still: still('mid'), over: img }], false, [600, inner])(img, midRead.at)
      expect(img.style.willChange === 'transform', `${high} ${inner}`).toBe(stands)
    }
    for (const [wide, inner, thinned] of [[600, 2000, false], [0, 600, false], [0, 2000, true], [2000, 600, true]] as const) {
      const img = pic(...midRead.file)
      img.style.maskImage = img.style.webkitMaskImage = foot
      readOn(1, wide, 600, [{ still: still('mid'), over: img }], false, [inner, 600])(img, midRead.at)
      expect(img.style.maskImage, `${wide} ${inner}`).toBe(thinned ? foot : '')
    }
  })

  describe('on the whole page, with the files of the stills and the word of the app', () => {
    type Heard = { kind: string; f: () => void; once: boolean }
    type Globe = { cx: number; cy: number; r: number }
    type Screen = { w: number; h: number; ratio?: number; coarse?: boolean; coder?: 'avif' | 'webp' }
    class Piece {
      style: Record<string, string> = {}
      children: Piece[] = []
      parentNode: Piece | null = null
      naturalWidth = 0
      naturalHeight = 0
      complete = false
      src = ''
      clientWidth = 0
      clientHeight = 0
      laid?: Box
      heard: Heard[] = []
      appendChild(c: Piece): Piece {
        c.parentNode?.removeChild(c)
        c.parentNode = this
        this.children.push(c)
        return c
      }
      insertBefore(c: Piece, before: Piece): Piece {
        c.parentNode?.removeChild(c)
        c.parentNode = this
        this.children.splice(this.children.indexOf(before), 0, c)
        return c
      }
      removeChild(c: Piece): Piece {
        this.children.splice(this.children.indexOf(c), 1)
        c.parentNode = null
        return c
      }
      setAttribute(): void {}
      getBoundingClientRect(): { height: number } {
        return { height: 0 }
      }
      addEventListener(kind: string, f: () => void, how?: { once?: boolean }): void {
        this.heard.push({ kind, f, once: !!how?.once })
      }
      set textContent(_: string) {
        this.children = []
      }
    }

    const files = new Map<string, readonly [number, number]>()
    beforeAll(async () => {
      for (const s of table.stills)
        for (const coder of ['avif', 'webp'] as const) {
          const m = await sharp(`public/first/${table.season}-${s[0]}.${coder}`).metadata()
          files.set(`${s[0]}.${coder}`, [m.width ?? 0, m.height ?? 0])
        }
    })

    /** Whether a screen answers a media rule of the kind the table asks. */
    const holds = (rule: string, w: number, h: number, coarse: boolean): boolean =>
      rule.split(',').some((part) =>
        part
          .trim()
          .split(' and ')
          .every((term) => {
            const [name, value = ''] = term
              .trim()
              .replace(/^\(|\)$/g, '')
              .split(':')
              .map((v) => v.trim())
            const size = parseFloat(value)
            if (name === 'min-width') return w >= size
            if (name === 'max-width') return w <= size
            if (name === 'min-height') return h >= size
            if (name === 'max-height') return h <= size
            if (name === 'orientation') return value === (h >= w ? 'portrait' : 'landscape')
            if (name === 'pointer') return value === (coarse ? 'coarse' : 'fine')
            throw new Error(`a media rule this test cannot read: ${term}`)
          }),
      )

    const whole = new Function('window', 'document', 'location', script) as (window: object, document: object, location: object) => void
    const cut = script.slice(script.indexOf('function between(axis, v) {'), script.indexOf('// A still is [name'))
    const controlsOn = new Function('T', 'window', 'document', 'box', `${cut}\nreturn controls`) as (T: object, window: object, document: object, box: object) => (h: number) => number
    const said = new Map<string, Globe>()
    /** Where the app says the glass is, as `placeStill` in src/app/app.ts does: over controls as high as the page takes them to be. */
    const word = (w: number, h: number, drawnRatio: number, coarse: boolean): Globe => {
      const bar = controlsOn(table, { matchMedia: (rule: string) => ({ matches: holds(rule, w, h, coarse) }) }, { createElement: () => new Piece() }, new Piece())(h)
      const aspect = Math.max(2, Math.round(w * drawnRatio)) / Math.max(2, Math.round(h * drawnRatio))
      const key = `${w} ${h} ${bar} ${aspect}`
      const known = said.get(key)
      if (known) return known
      const globe = framingOfRig(liveRig(aspect, 0, 0, roomUnder(h, bar, w)), w, h).globe
      said.set(key, globe)
      return globe
    }

    /** The page's whole script of the first still, run on a screen: its box of stills, and the files arriving when told to. */
    const open = (at: Screen) => {
      const box = new Piece()
      const size = { w: at.w, h: at.h }
      const heard = new Map<string, (() => void)[]>()
      const win = {
        innerWidth: at.w,
        innerHeight: at.h,
        devicePixelRatio: at.ratio ?? 1,
        firstStill: undefined as undefined | { place(globe: Globe): void; end(): void },
        matchMedia: (rule: string) => ({ matches: holds(rule, size.w, size.h, !!at.coarse) }),
        setTimeout: (f: () => void) => (f(), 0),
        addEventListener: (kind: string, f: () => void) => void heard.set(kind, [...(heard.get(kind) ?? []), f]),
        removeEventListener: (kind: string, f: () => void) => void heard.set(kind, (heard.get(kind) ?? []).filter((g) => g !== f)),
      }
      box.clientWidth = at.w
      box.clientHeight = at.h
      whole(win, { getElementById: (id: string) => (id === 'first' ? box : null), createElement: () => new Piece() }, { search: '' })
      const stills = (): Piece[] => {
        const out: Piece[] = []
        const walk = (p: Piece): void => {
          if (p.src.startsWith('first/')) out.push(p)
          p.children.forEach(walk)
        }
        walk(box)
        return out
      }
      return {
        box,
        stills,
        /** The picture that lies over all others. */
        top: (): Piece => box.children.at(-1)!.children.at(-1)!.children[1]!,
        arrive: (): void => {
          for (const img of stills()) {
            if (img.complete) continue
            const [wide, high] = files.get(`${shapeOf(img)}.${at.coder ?? 'avif'}`)!
            Object.assign(img, { naturalWidth: wide, naturalHeight: high, complete: true })
            const now = img.heard.filter((l) => l.kind === 'load')
            img.heard = img.heard.filter((l) => l.kind !== 'load' || !l.once)
            for (const l of now) l.f()
          }
        },
        resize: (w: number, h: number): void => {
          size.w = box.clientWidth = win.innerWidth = w
          size.h = box.clientHeight = win.innerHeight = h
          for (const f of heard.get('resize') ?? []) f()
        },
        speak: (drawnRatio = at.ratio ?? 1): void => win.firstStill!.place(word(size.w, size.h, drawnRatio, !!at.coarse)),
      }
    }
    const shapeOf = (img: Piece): string => /^first\/\w+-(\w+)\./.exec(img.src)![1]!
    const inTable = (name: string): Still => table.stills.find((s) => s[0] === name)!
    const kindOf = (img: Piece): 'whole' | 'halved' | 'moved' => (img.style.transform === '' ? 'whole' : img.style.willChange === 'transform' ? 'halved' : 'moved')
    const apart = (a: Box, b: Box): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.w - b.x - b.w), Math.abs(a.y + a.h - b.y - b.h))
    /** How far a place is, as a share, from the size its still was drawn for from the top: what `put` reads. */
    const offOf = (b: Box, s: Still): number => Math.max(Math.abs(b.w / s[1] - 1), Math.abs(b.h / s[2] - 1), Math.abs(b.y) / s[2])

    it('reads the page with the script and the heights of the controls it was written with', () => {
      expect(cut).toContain('function controls(h) {')
      expect(files.size).toBe(2 * table.stills.length)
      for (const [name, size] of files) expect(Math.min(...size), name).toBeGreaterThan(0)
      expect(word(1280, 720, 1, true).r).toBeLessThan(word(1280, 720, 1, false).r)
    })

    it('stands a still at the size it was drawn for before the app has spoken, and the word of the app leaves it there', () => {
      for (const [at, name, kind] of [
        [{ w: 600, h: 600 }, 'mid', 'halved'],
        [{ w: 600, h: 600, ratio: 2 }, 'mid', 'whole'],
        [{ w: 1800, h: 1080 }, 'hd', 'whole'],
        [{ w: 369, h: 590, coarse: true }, 'phone590', 'halved'],
        [{ w: 369, h: 590, ratio: 2, coarse: true }, 'phone590', 'whole'],
      ] as const)
        for (const coder of ['avif', 'webp'] as const) {
          const what = `${at.w} x ${at.h} at ${'ratio' in at ? at.ratio : 1}, ${coder}`
          const s = inTable(name)
          const own: Box = { x: (at.w - s[1]) / 2, y: 0, w: s[1], h: s[2] }
          const page = open({ ...at, coder })
          const img = page.top()
          expect(shapeOf(img), what).toBe(name)
          const read = { ...img.laid! }
          expect(offOf(read, s), what).toBeGreaterThan(0)
          sameBox(drawn(img), read)
          page.arrive()
          expect(kindOf(img), what).toBe(kind)
          sameBox(drawn(img), own, 1)
          expect([img.style.maskImage, img.style.webkitMaskImage], what).toEqual(['', ''])
          page.speak()
          expect(kindOf(img), what).toBe(kind)
          expect(apart(drawn(img), own) * ('ratio' in at ? at.ratio : 1), what).toBeLessThan(near)
          expect([img.style.maskImage, img.style.webkitMaskImage], what).toEqual(['', ''])
          const spoken = open({ ...at, coder })
          spoken.speak()
          spoken.arrive()
          expect(spoken.top().style, what).toEqual(img.style)
        }
    })

    it('keeps the thinning toward the sides of a screen wider than the still, the same as the word of the app lays it', () => {
      const page = open({ w: 2600, h: 1080 })
      const img = page.top()
      page.arrive()
      wholly(img, { x: 20, y: 0, w: 2560, h: 1080 })
      const mask = img.style.maskImage
      expect(mask).toMatch(/^linear-gradient\(to (left|right), transparent, #000 \d+px\),linear-gradient\(to (left|right), transparent, #000 \d+px\)$/)
      expect(img.style.webkitMaskImage).toBe(mask)
      const under = page.stills().length
      expect(under).toBeGreaterThan(1)
      page.speak()
      expect(kindOf(img)).toBe('whole')
      expect(apart(drawn(img), { x: 20, y: 0, w: 2560, h: 1080 })).toBeLessThan(near)
      expect(img.style.maskImage).toBe(mask)
      expect(page.stills()).toHaveLength(under)
    })

    it('leaves a still as the table reads it on a screen a pixel off the one it was drawn for', () => {
      for (const at of [{ w: 389, h: 844, ratio: 2, coarse: true }, { w: 391, h: 844, ratio: 2, coarse: true }, { w: 600, h: 601 }, { w: 600, h: 599 }] as const) {
        const page = open(at)
        const img = page.top()
        const read = { ...img.laid! }
        page.arrive()
        expect(kindOf(img), `${at.w} x ${at.h}`).toBe('moved')
        sameBox(drawn(img), read)
        sameBox(img.laid!, read)
      }
    })

    it('stands the still of a new shape of screen when its file arrives, as the one before it is taken away', () => {
      const page = open({ w: 1800, h: 1080 })
      page.arrive()
      page.speak()
      const old = page.top()
      expect(kindOf(old)).toBe('whole')
      page.resize(600, 600)
      const img = page.top()
      expect(page.box.children).toHaveLength(2)
      expect([shapeOf(old), shapeOf(img)]).toEqual(['hd', 'mid'])
      expect([kindOf(old), kindOf(img)]).toEqual(['moved', 'moved'])
      page.arrive()
      expect(page.box.children).toHaveLength(1)
      expect(page.top()).toBe(img)
      expect(kindOf(img)).toBe('halved')
      sameBox(drawn(img), { x: -59.5, y: 0, w: 719, h: 600 }, 1)
      page.speak()
      expect(kindOf(img)).toBe('halved')
      expect(apart(drawn(img), { x: -59.5, y: 0, w: 719, h: 600 })).toBeLessThan(near)
      // The word of the app is for one shape of screen: on the next the table is read again.
      page.resize(620, 600)
      expect(page.top()).toBe(img)
      expect(kindOf(img)).toBe('halved')
      sameBox(drawn(img), { x: -49.5, y: 0, w: 719, h: 600 }, 1)
      page.resize(620, 601)
      expect(kindOf(img)).toBe('moved')
    })

    // Every width at every height a still was drawn for, with a mouse and with a finger, on screens of one and of two pixels
    // for one of the page's, the app drawing at each size its levels allow. The table is kept about a thousandth of the
    // height from the app, which moves a still on a screen as high as its own by well under four times `LOOSE` of its size:
    // the app is asked wherever a still is read nearer than that.
    it('shows a still the way the app means it before the app has spoken, wherever that is at half or the whole of its file', () => {
      const caps = levels.map((l) => l.pixelRatioCap)
      const heights = [...new Set(table.stills.map((s) => s[2]))]
      const wrong: string[] = []
      const meant = new Set<string>()
      let need = 0
      for (const s of table.stills) expect((1e-3 * Math.max(1e5, Number(s[3]) + Number(s[4]))) / Number(s[4]), s[0]).toBeLessThan(4 * loose)
      for (const coder of ['avif', 'webp'] as const)
        for (const h of heights) {
          const other = table.stills.some((s) => s[2] === h && `${files.get(`${s[0]}.webp`)}` !== `${files.get(`${s[0]}.avif`)}`)
          if (coder === 'webp' && !other) continue
          for (let w = 200; w <= 3200; w++)
            for (const coarse of [false, true])
              for (const ratio of [1, 2]) {
                const page = open({ w, h, ratio, coarse, coder })
                const img = page.top()
                const s = inTable(shapeOf(img))
                const read = { ...img.laid! }
                page.arrive()
                const before = { at: drawn(img), kind: kindOf(img), mask: img.style.maskImage }
                if (offOf(read, s) >= 4 * loose && apart(before.at, read) * ratio < near / 2) continue
                const file = files.get(`${s[0]}.${coder}`)!
                for (const drawnRatio of new Set(caps.map((cap) => Math.min(ratio, cap)))) {
                  const what = `${s[0]} on ${w} x ${h} ${coarse ? 'coarse' : 'fine'} at ${ratio}, drawn at ${drawnRatio}, ${coder}`
                  page.speak(drawnRatio)
                  const after = { at: drawn(img), kind: kindOf(img), mask: img.style.maskImage }
                  const to = img.laid!
                  const ofFile = (n: number): boolean => Math.abs(after.at.w * ratio * n - file[0]) < near * n * 2 && Math.abs(after.at.h * ratio * n - file[1]) < near * n * 2
                  if (apart(before.at, to) * ratio > apart(read, to) * ratio + near) wrong.push(`${what}: further from the app than as read`)
                  if (after.kind === 'moved' || !(ofFile(1) || ofFile(2))) continue
                  meant.add(s[0])
                  need = Math.max(need, offOf(read, s))
                  if (before.kind !== after.kind || apart(before.at, after.at) * ratio >= near) wrong.push(`${what}: ${before.kind} ${JSON.stringify(before.at)} and then ${after.kind} ${JSON.stringify(after.at)}`)
                  const sides = (mask: string): string => (mask.match(/linear-gradient\(to (left|right)[^)]*\)/g) ?? []).join()
                  const rest = before.mask.replace(/linear-gradient\(to (left|right)[^)]*\),?/g, '').replace(/,$/, '')
                  if (sides(before.mask) !== sides(after.mask) || !['', 'linear-gradient(to top, transparent, #000 1px)'].includes(rest)) wrong.push(`${what}: thinned ${before.mask} and then ${after.mask}`)
                }
              }
        }
      expect(wrong.slice(0, 20)).toEqual([])
      expect(wrong).toHaveLength(0)
      expect(need).toBeLessThan(loose)
      const shown = table.stills.filter((s) => ['avif', 'webp'].some((coder) => [1, 2, 4].includes(files.get(`${s[0]}.${coder}`)![0] / s[1])))
      expect(shown.length).toBeGreaterThan(table.stills.length / 2)
      expect([...meant].sort()).toEqual(shown.map((s) => s[0]).sort())
    }, 600_000)
  })
})

describe('the tints of the controls', () => {
  const [ui = '', menu = ''] = ['src/ui/ui.module.css', 'src/ui/menu.module.css'].map((file) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''))
  /** Every rule of a sheet, those inside a media query among them, as its selector and what it declares. */
  const rules = (text: string): { selector: string; body: string }[] => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]! }))
  /** What a rule fades: the name at the head of each part of its transition, and how the part says to fade it. */
  const fades = (body: string): { what: string; how: string }[] =>
    [...body.matchAll(/(?:^|;)\s*transition(?:-property)?\s*:([^;]*)/g)].flatMap((m) =>
      m[1]!.split(/,(?![^()]*\))/).map((part) => {
        const [, what = '', how = ''] = /^\s*(var\([^)]*\)|\S+)\s*([\s\S]*?)\s*$/.exec(part) ?? []
        return { what, how: how.replace(/\s+/g, ' ') }
      }),
    )
  const INSTEAD = 'var(--colour-instead, background-color)'
  const NUMBERS = ['--tint', '--warmth']
  const numberOf = (selector: string, name: string): number => {
    const said = rules(ui)
      .filter((r) => r.selector.split(',').map((s) => s.trim()).includes(selector))
      .map((r) => new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([\\d.]+)\\s*(?:;|$)`).exec(r.body)?.[1])
      .filter((v) => v !== undefined)
    return said.length === 1 ? Number(said[0]) : Number.NaN
  }

  // A browser hands a fading background colour to its compositor, which then builds pictures of its own between the page's
  // frames. A frame that answers a press waits for them, and where a frame is slow that wait is long.
  it('fades no background colour where a number can fade, and nothing without a name', () => {
    const all = rules(ui).flatMap((r) => fades(r.body).map((f) => `${r.selector}: ${f.what}`))
    expect(all.length).toBeGreaterThan(0)
    expect(all.filter((line) => /: (background(-color)?|all|[\d.].*)$/.test(line))).toEqual([])
    expect(all.filter((line) => /: var\(/.test(line) && !line.endsWith(`: ${INSTEAD}`))).toEqual([])
  })

  // A colour holds its alpha in whole 255ths and its fade steps through them. The tint is that whole number, so a fade
  // starts and ends on the colour it always had and takes the same steps between.
  it('fades each tint as a whole number the sheet itself has named', () => {
    const names = [...new Set(rules(ui).flatMap((r) => fades(r.body)).map((f) => f.what).filter((what) => what.startsWith('--')))].sort()
    expect(names).toEqual(NUMBERS)
    for (const name of names) {
      const named = rules(ui).filter((r) => r.selector === `@property ${name}`)
      expect(named).toHaveLength(1)
      expect(named[0]!.body).toMatch(/syntax:\s*'<integer>'/)
      expect(named[0]!.body).toMatch(/inherits:\s*false/)
      expect(named[0]!.body).toMatch(/initial-value:\s*0\s*;/)
    }
  })

  // A browser that knows no registration cannot fade a number, and there the tint would step. In such a browser the name
  // below has no value, so the list falls back to the colour; in one that knows it, the name stands for no property at all.
  it('fades the colour itself only where no number can fade, for as long and along the same curve', () => {
    const named = rules(ui).filter((r) => r.selector === '@property --colour-instead')
    expect(named).toHaveLength(1)
    expect(named[0]!.body).toMatch(/syntax:\s*'<custom-ident>'/)
    expect(named[0]!.body).toMatch(/inherits:\s*false/)
    expect(named[0]!.body).toMatch(/initial-value:\s*no-property\s*;/)
    expect(ui).not.toMatch(/--colour-instead\s*:/)
    let lists = 0
    for (const r of rules(ui)) {
      const list = fades(r.body)
      const numbers = list.filter((f) => f.what.startsWith('--'))
      const colour = list.filter((f) => f.what === INSTEAD)
      if (numbers.length === 0) {
        expect(`${r.selector}: ${colour.length}`).toBe(`${r.selector}: 0`)
        continue
      }
      lists += 1
      expect(`${r.selector}: ${colour.length}`).toBe(`${r.selector}: 1`)
      expect([...new Set(numbers.map((f) => f.how))]).toEqual([colour[0]!.how])
      expect(colour[0]!.how).toMatch(/^[\d.]+s ease$/)
    }
    expect(lists).toBe(3)
  })

  it('keeps every tint where it stood', () => {
    /** The alphas the colours had before a tint was a number, in the whole 255ths a browser held them in. */
    const whole = (...alphas: number[]): number[] => alphas.map((alpha) => Math.round(alpha * 255))
    expect(whole(0, 0.46, 0.62, 0.34, 0.56, 0.13, 0.17)).toEqual([0, 117, 158, 87, 143, 33, 43])
    const tint = (selector: string): number => numberOf(selector, '--tint')
    const warmth = (selector: string): number => numberOf(selector, '--warmth')
    expect([tint('.shake'), tint('.shake[data-press]'), tint(".shake[aria-disabled='true']"), tint(".shake:hover:not([aria-disabled='true'])")]).toEqual(whole(0.46, 0.62, 0.34, 0.56))
    expect([warmth('.shake::before'), warmth('.shake[data-press]::before')]).toEqual(whole(0, 0.13))
    expect([warmth('.disc'), warmth('.mark[data-press] .disc')]).toEqual(whole(0, 0.17))
    expect([tint('.sound .disc'), tint('.sound[data-press] .disc')]).toEqual(whole(0.46, 0.62))
    const painted = (selector: string): string => rules(ui).find((r) => r.selector === selector)?.body ?? ''
    expect(painted('.shake')).toMatch(/background: rgb\(var\(--glass\) \/ calc\(var\(--tint\) \/ 255\)\);/)
    expect(painted('.shake::before')).toMatch(/background-color: rgb\(var\(--glow\) \/ calc\(var\(--warmth\) \/ 255\)\);/)
    expect(painted('.disc')).toMatch(/background-color: rgb\(var\(--glow\) \/ calc\(var\(--warmth\) \/ 255\)\);/)
    expect(painted('.sound .disc')).toMatch(/background: rgb\(var\(--glass\) \/ calc\(var\(--tint\) \/ 255\)\);/)
    for (const name of NUMBERS) {
      // nowhere is the number itself taken for an alpha, and nowhere is it set to anything but whole 255ths
      const uses = ui.split(`var(${name})`).length - 1
      expect(uses, name).toBeGreaterThan(0)
      expect(ui.split(` / calc(var(${name}) / 255))`).length - 1, name).toBe(uses)
      const set = [...ui.matchAll(new RegExp(`[;{]\\s*${name}\\s*:\\s*([^;}]*)`, 'g'))].map((m) => m[1]!.trim())
      expect(set.length, name).toBeGreaterThan(2)
      expect(set.filter((v) => !/^\d+$/.test(v) || Number(v) > 255), name).toEqual([])
    }
    // no state paints a plain colour over the tint it fades
    for (const r of rules(ui)) {
      if (!/^\.shake(?![\w-])/.test(r.selector) || /::(before|after)|\.(word|arcs|globe)|svg|focus-visible/.test(r.selector)) continue
      if (r.selector === '.shake') continue
      expect(`${r.selector} {${/(?:^|;)\s*background(-color)?\s*:/.test(r.body) ? ' background' : ''} }`).toBe(`${r.selector} { }`)
    }
  })

  // Measured at phone width: with the wash of an option as a number, the corners of the chosen options beside a pressed one
  // came out up to 12 levels off the picture the colour's fade gives. The menu was to look as it did, so its sheet stays.
  it('leaves the options of the menu to fade as colours', () => {
    expect(menu).not.toMatch(/@property|--(?:tint|warmth|wash|colour-instead)/)
    expect(rules(menu).flatMap((r) => fades(r.body).map((f) => `${r.selector}: ${f.what} ${f.how}`))).toEqual(['.option: color 0.15s ease', '.option: background-color 0.15s ease'])
    const painted = (selector: string): string[] => rules(menu).filter((r) => r.selector === selector).flatMap((r) => [...r.body.matchAll(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]*)/g)].map((m) => m[1]!.trim()))
    expect([painted('.option'), painted(".option[aria-pressed='true']"), painted('.option:active')]).toEqual([['none'], ['rgb(var(--line) / 0.1)'], ['rgb(var(--line) / 0.16)']])
  })
})

describe('the tints of the controls in the sheet as the build makes it', () => {
  type Rule = { under: string[]; selector: string; body: string }
  let rules: Rule[] = []

  const plain = (text: string): string => text.replace(/\._([A-Za-z][\w-]*?)_[0-9a-z]{1,5}_\d+(?![\w-])/g, '.$1')
  /** Every rule of a built sheet under the conditions it stands in, its classes named as the source names them. */
  const read = (text: string, under: string[] = []): Rule[] => {
    const out: Rule[] = []
    let from = 0
    for (let open = text.indexOf('{'); open >= 0; open = text.indexOf('{', from)) {
      let depth = 1
      let end = open + 1
      for (; end < text.length && depth > 0; end++) depth += text[end] === '{' ? 1 : text[end] === '}' ? -1 : 0
      const head = text.slice(from, open).trim()
      const inner = text.slice(open + 1, end - 1)
      if (/^@(media|supports|layer|container)\b/.test(head)) out.push(...read(inner, [...under, head]))
      else out.push({ under, selector: plain(head), body: inner })
      from = end
    }
    return out
  }
  const said = (body: string): Record<string, string> => Object.fromEntries(body.split(';').filter((d) => d.includes(':')).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim().replace(/'/g, '"')]))
  /** A list of fades as a browser reads it: what fades, for how long, along which curve. A part that names no curve fades along ease. */
  const fades = (list: string): string[] =>
    list.split(/,(?![^()]*\))/).map((part) => {
      const [what = '', long = '', ...curve] = part.trim().split(/\s+(?![^()]*\))/)
      return `${what} ${/^[\d.]+s$/.test(long) ? `${Math.round(Number.parseFloat(long) * 1000)}ms` : long} ${curve.join(' ').replace(/\s+/g, '') || 'ease'}`
    })
  const listOf = (selector: string): string => {
    const found = rules.filter((r) => r.under.length === 0 && r.selector === selector && said(r.body).transition !== undefined)
    return found.length === 1 ? said(found[0]!.body).transition! : `${found.length} rules of ${selector} with a list of fades`
  }
  /** The fades of the tinted controls as the build of main made them before a tint was a number. */
  const BEFORE: Record<string, string[]> = {
    '.shake': ['opacity var(--fade) ease-out', 'transform 160ms cubic-bezier(.2,.7,.2,1)', 'background-color 250ms ease', 'box-shadow 250ms ease', 'color 250ms ease'],
    '.shake:before': ['opacity 300ms ease', 'background-color 300ms ease'],
    '.disc': ['background-color 300ms ease', 'box-shadow 300ms ease', 'transform 160ms cubic-bezier(.2,.7,.2,1)'],
  }
  const NUMBERS = ['--tint', '--warmth']
  const NAME = '--colour-instead'

  // The build's own plugins make the asset index and the colliders, which no sheet passes through, so they are left out.
  // The interface is asked for as the app asks for it, by an import that waits, or the build drops it as unused.
  beforeAll(async () => {
    const own = (await loadConfigFromFile({ command: 'build', mode: 'production' }, 'vite.config.ts'))!.config
    const ASK = 'the-interface-as-the-app-asks-for-it'
    const ask: Plugin = { name: 'ask', resolveId: (id) => (id === ASK ? `\0${ASK}` : null), load: (id) => (id === `\0${ASK}` ? "export const asked = import('/src/ui/index.ts')" : null) }
    const made = await build({ configFile: false, logLevel: 'silent', base: own.base, define: own.define, css: own.css, plugins: [ask], build: { ...own.build, write: false, rollupOptions: { ...own.build?.rollupOptions, input: ASK } } })
    const files = (Array.isArray(made) ? made : [made]).flatMap((m) => ('output' in m ? m.output : []))
    const sheet = files.flatMap((f) => (f.type === 'asset' && f.fileName.endsWith('.css') ? [String(f.source)] : [])).join('')
    rules = read(sheet)
  }, 120000)

  it('reads the sheet the interface ships with', () => {
    for (const selector of ['.ui', '.shake', '.shake:before', '.disc', '.sound .disc', '.option', '.menu']) expect(rules.filter((r) => r.selector === selector).length, selector).toBeGreaterThan(0)
  })

  // A browser that knows no registration drops the rule that registers a name. The name then has no value, the list takes
  // what stands after its comma, and a number it cannot fade steps at once under a colour that fades as it always did.
  it('fades the colour as before in a browser that cannot fade a number', () => {
    expect(rules.filter((r) => !r.selector.startsWith('@property') && said(r.body)[NAME] !== undefined).map((r) => r.selector)).toEqual([])
    const texts = (readdirSync('src', { recursive: true }) as string[]).map((f) => `src/${f.replace(/\\/g, '/')}`).filter((f) => /\.(ts|css|html|json)$/.test(f))
    expect([...texts, 'index.html'].filter((f) => readFileSync(f, 'utf8').includes(NAME)).sort()).toEqual(['src/ui/ui.module.css'])
    for (const [selector, before] of Object.entries(BEFORE)) {
      const without = fades(listOf(selector).replace(new RegExp(`var\\(${NAME},([^()]*)\\)`, 'g'), (_, instead: string) => instead.trim()))
      expect(without.filter((f) => !f.startsWith('--')), selector).toEqual(before)
    }
  })

  it('fades the number and no colour in a browser that can', () => {
    for (const name of NUMBERS) {
      const named = rules.filter((r) => r.selector === `@property ${name}`).map((r) => said(r.body))
      expect(named.length, name).toBeGreaterThan(0)
      for (const n of named) expect(n, name).toEqual({ syntax: '"<integer>"', inherits: 'false', 'initial-value': '0' })
    }
    const named = rules.filter((r) => r.selector === `@property ${NAME}`).map((r) => said(r.body))
    expect(named.length).toBeGreaterThan(0)
    for (const n of named) expect(n).toEqual({ syntax: '"<custom-ident>"', inherits: 'false', 'initial-value': 'no-property' })
    for (const [selector, before] of Object.entries(BEFORE)) {
      const colour = before.find((f) => f.startsWith('background-color '))!
      const how = colour.slice('background-color'.length)
      const withName = fades(listOf(selector).replace(new RegExp(`var\\(${NAME},[^()]*\\)`, 'g'), 'no-property'))
      const numbers = withName.filter((f) => f.startsWith('--'))
      expect(numbers.length, selector).toBeGreaterThan(0)
      for (const n of numbers) expect(NUMBERS.map((name) => `${name}${how}`), selector).toContain(n)
      expect(withName.filter((f) => f.startsWith('no-property')), selector).toEqual([`no-property${how}`])
      expect(withName.filter((f) => !f.startsWith('--') && !f.startsWith('no-property')), selector).toEqual(before.filter((f) => f !== colour))
    }
  })

  // A number without a registration is inherited, so a rule that paints with one sets it too: a control then takes no tint
  // from the control around it, whether the browser registers the number or not. And the number is whole 255ths of alpha
  // wherever it is set, so no rule paints with it but over 255.
  it('paints each tint with a whole number of 255ths that its own rule sets', () => {
    const painted: string[] = []
    const set: string[] = []
    for (const r of rules) {
      if (r.selector.startsWith('@property')) continue
      for (const name of NUMBERS) {
        const value = said(r.body)[name]
        if (value !== undefined) {
          set.push(`${r.selector} ${name} ${value}`)
          expect(/^\d+$/.test(value) && Number(value) <= 255, `${r.selector} ${name}: ${value}`).toBe(true)
        }
        const uses = r.body.split(`var(${name})`).length - 1
        if (uses === 0) continue
        painted.push(`${r.selector} ${name}`)
        expect(value, `${r.selector} ${name}`).toBeDefined()
        expect(r.body.split(new RegExp(`/\\s*calc\\(var\\(${name}\\)\\s*/\\s*255\\)\\)`)).length - 1, `${r.selector} ${name}`).toBe(uses)
      }
    }
    expect(painted.sort()).toEqual(['.disc --warmth', '.shake --tint', '.shake:before --warmth', '.sound .disc --tint', '.sound:active .disc,.sound[data-press] .disc --tint'])
    expect(set.sort()).toEqual(
      [
        '.shake --tint 117',
        '.shake:hover:not([aria-disabled=true]) --tint 143',
        '.shake:active:not([aria-disabled=true]),.shake[data-press] --tint 158',
        '.shake[aria-disabled=true] --tint 87',
        '.shake:before --warmth 0',
        '.shake:active:not([aria-disabled=true]):before,.shake[data-press]:before --warmth 33',
        '.disc --warmth 0',
        '.mark:active:not([aria-disabled=true]) .disc,.mark[data-press] .disc,.sound:active .disc,.sound[data-press] .disc --warmth 43',
        '.sound .disc --tint 117',
        '.sound:active .disc,.sound[data-press] .disc --tint 158',
      ].sort(),
    )
  })

  // The options of the menu fade as colours in every browser: see the tints of the controls above.
  it('fades the options of the menu as the build of main made them', () => {
    expect(fades(listOf('.option'))).toEqual(['color 150ms ease', 'background-color 150ms ease'])
    expect(rules.filter((r) => /\.(option|menu|group|row|label)(?![\w-])/.test(r.selector) && /--(?:tint|warmth|wash|colour-instead)/.test(r.body)).map((r) => r.selector)).toEqual([])
    expect(rules.filter((r) => r.selector.startsWith('@property')).map((r) => r.selector).sort()).toEqual(['@property --colour-instead', '@property --tint', '@property --warmth'])
  })

  it('fades nothing where less motion is asked for, as before', () => {
    const still = 'transition:none!important;animation:none!important'
    const line = (r: Rule): string => `${r.under.join(' ')} ${r.selector}{${r.body}}`.trim()
    const asked = rules.filter((r) => r.under.some((u) => u.includes('prefers-reduced-motion')))
    expect(asked.map(line)).toEqual([`@media (prefers-reduced-motion:reduce) .ui,.ui *,.ui :before,.ui :after{${still}}`])
    const told = rules.filter((r) => r.selector.includes('[data-reduced]'))
    expect(told.map(line)).toEqual([`.ui[data-reduced],.ui[data-reduced] *,.ui[data-reduced] :before,.ui[data-reduced] :after{${still}}`])
    const stronger = rules.filter((r) => !asked.includes(r) && !told.includes(r) && /(?:^|;)(transition|animation)[\w-]*:[^;]*!important/.test(r.body))
    expect(stronger.map(line)).toEqual([])
  })
})
