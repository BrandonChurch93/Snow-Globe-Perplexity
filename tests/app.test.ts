import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config'
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
})

describe('reduced motion', () => {
  it('changes the season by a dissolve with the globe at rest and no shake', () => {
    const sim = new FakeSim()
    const s = new LiveSession(sim, first)
    s.reduced = true
    expect(s.shake()).toBe(next(first))
    expect(s.shaking).toBeNull()
    expect(s.busy).toBe(true)
    expect(s.shakes).toBe(0)
    expect(s.tl.events.length).toBe(0)
    let last = -1
    let moved = false
    run(s, LIVE.dissolveSeconds - 0.1, () => {
      const m = s.moment(1, 1)
      if (m.globe.y !== 0 || m.globe.x !== 0 || m.globe.tiltX !== 0) moved = true
      expect(m.change).toBeGreaterThanOrEqual(last)
      expect(m.from).toBe(first)
      expect(m.to).toBe(next(first))
      last = m.change
    })
    expect(moved).toBe(false)
    expect(last).toBeGreaterThan(0.9)
    expect(s.shake()).toBeNull()
    run(s, 0.3)
    expect(s.busy).toBe(false)
    expect(s.season).toBe(next(first))
    expect(s.moment(1, 1).change).toBe(0)
    expect(s.moment(1, 1).season).toBe(next(first))
  })

  it('waits for a late season before the dissolve and gives up after live.loadWaitSeconds', () => {
    const loaded = new Set([first])
    const s = new LiveSession(new FakeSim(), first, (season) => loaded.has(season))
    s.reduced = true
    s.goTo(next(first))
    run(s, 1)
    expect(s.busy).toBe(true)
    expect(s.moment(1, 1).change).toBe(0)
    loaded.add(next(first))
    run(s, LIVE.dissolveSeconds + 0.2)
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
    const end = d.up()
    if (end) stirs.push(end)
    return { look, stirs, drag: d }
  }

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
    const s = stirs[0]!
    expect(s.x).toBeGreaterThan(0.95)
    expect(Math.abs(s.y)).toBeLessThan(0.2)
    expect(s.strength).toBeGreaterThanOrEqual(TOUCH.leastStrength)
    expect(s.strength).toBeLessThanOrEqual(1)
    expect(Math.abs(look.yaw)).toBeLessThan(Math.abs(slow.yaw) * 0.35)
  })

  it('a faster drag stirs harder', () => {
    const a = drag(2.6 * ref, 300).stirs[0]!
    const b = drag(8 * ref, 300).stirs[0]!
    expect(b.strength).toBeGreaterThan(a.strength)
    expect(b.strength).toBeCloseTo(1, 6)
  })

  it('a tap or a twitch does nothing', () => {
    const look = new Look()
    const d = new Drag(look)
    d.down(10, 10, 0, ref)
    expect(d.up()).toBeNull()
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
      expect(rig.yawDeg).toBe(hero.yawDeg)
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

  it('places the smaller globe of a phone between the top edge and the controls: the room over the glass 1.6 times the room under the foot, never more than twice', () => {
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
    const host: ProbeHost = {
      setLevel: (id) => set.push(id),
      shake: () => shakes++,
      onFrame: (fn) => (feed = fn),
      graphics: () => 'a test renderer',
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

  it('stirs once with a quick drag and leaves the season and the camera where they were', () => {
    const s = play('stir')
    s.run.advanceTo(s.plan.frameCount - 1)
    const r = s.run.record()
    expect(r.stirs).toBe(1)
    expect(s.sim.stirred).toHaveLength(1)
    expect(Math.hypot(...s.sim.stirred[0]!)).toBeGreaterThan(0)
    expect(r.stirStrength).toBeGreaterThanOrEqual(TOUCH.leastStrength)
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
