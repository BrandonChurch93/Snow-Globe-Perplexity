import { config } from '../config'
import { timing } from '../copy'
import type { Moment } from '../core/stage'
import { timelineMoment } from '../film/moments'
import { beatSeconds, eventSeconds, stateSeconds, stillTimeline, type ShakeEvent, type Timeline } from '../film/timeline'
import { livePath } from './framing'

export interface LiveSim {
  readonly step: number
  readonly remote?: boolean
  advanceTo(step: number, tl: Timeline): void
  reset(): void
  stir?(x: number, y: number, z: number): void
}

export const LIVE = {
  maxFrameSeconds: 0.25,
  stepCap: Math.round(config.sim.stepHz * 0.25),
  dissolveSeconds: timing.dissolveSeconds,
  skipSliceSteps: 12,
  sliceSteps: 1,
}

const HZ = config.sim.stepHz
const STATES = Object.keys(config.states).map((k) => k.replace(/Seconds$/, ''))

/**
 * Loads the season the page opens on, then the others one at a time. `after` holds the others back until it resolves, so that
 * nothing the first picture does not need is fetched before it; a season that is asked for (`want`) starts at once, ahead of its turn.
 * `load` is told whether somebody waits for the season, which is when it should come from what the first picture needs.
 */
export class SeasonLoader {
  private readonly done = new Set<string>()
  private readonly held = new Map<string, number>()
  private readonly started = new Map<string, Promise<void>>()
  readonly first: Promise<void>
  readonly all: Promise<void>

  constructor(
    first: string,
    private readonly load: (season: string, asked: boolean) => Promise<void>,
    private readonly onReady: (season: string) => void = () => undefined,
    after: Promise<void> = Promise.resolve(),
  ) {
    this.first = this.start(first, true)
    const rest = config.seasons.filter((s) => s !== first)
    const held: Promise<void> = Promise.all([this.first.catch(() => undefined), after.catch(() => undefined)]).then(() => undefined)
    this.all = rest.reduce<Promise<void>>((chain, s) => chain.then(() => this.start(s, false)).catch(() => undefined), held)
  }

  private start(season: string, asked: boolean): Promise<void> {
    let p = this.started.get(season)
    if (!p) {
      p = this.load(season, asked).then(() => {
        this.done.add(season)
        this.onReady(season)
      })
      this.started.set(season, p)
    }
    return p
  }

  /** Starts a season now if it has not started: the visitor asked for it. */
  want(season: string): Promise<void> {
    return config.seasons.includes(season) ? this.start(season, true) : Promise.resolve()
  }

  /**
   * Something is still owed to `season` before it can be shown without a stop, as when the stage has built it and the GPU
   * does not have it yet: it is not ready until `until` is over, however that ends.
   */
  hold(season: string, until: Promise<unknown> | void): void {
    if (!until) return
    this.held.set(season, (this.held.get(season) ?? 0) + 1)
    const over = (): void => {
      const left = (this.held.get(season) ?? 1) - 1
      if (left > 0) this.held.set(season, left)
      else this.held.delete(season)
    }
    until.then(over, over)
  }

  ready = (season: string): boolean => this.done.has(season) && !this.held.has(season)
}

export class LiveSession {
  readonly tl: Timeline
  clock = 0
  season: string
  target: string | null = null
  reduced = false
  shakes = 0
  private made = 0
  private playing: ShakeEvent | null = null
  /** The change with reduced motion: `drawn` once a frame of the season it leaves has been drawn since the press, `left` the seconds of the dissolve still to run once the picture has changed. */
  private dissolve: { to: string; asked: number; drawn: boolean; left: number | null } | null = null
  private skipTo = 0
  private landed = -config.states.settledSeconds

  constructor(
    private readonly sim: LiveSim,
    season: string,
    private readonly ready: (season: string) => boolean = () => true,
  ) {
    this.season = season
    this.tl = { id: 'live', startSeason: season, events: [] }
  }

  get busy(): boolean {
    return this.playing !== null || this.dissolve !== null || this.skipping
  }

  get skipping(): boolean {
    return this.skipTo > this.sim.step
  }

  get stateName(): string {
    if (this.busy) return ''
    const since = this.clock - this.landed
    const s = config.states
    return since < s.restSeconds ? STATES[0]! : since < s.settledSeconds ? STATES[1]! : STATES[2]!
  }

  shake(): string | null {
    const all = config.seasons
    return this.go(all[(all.indexOf(this.season) + 1) % all.length]!)
  }

  goTo(season: string): string | null {
    return config.seasons.includes(season) && season !== this.season ? this.go(season) : null
  }

  private go(to: string): string | null {
    if (this.busy) return null
    this.target = to
    if (this.reduced) {
      this.dissolve = { to, asked: this.clock, drawn: false, left: null }
      return to
    }
    const n = this.made++
    // A shake asked while the last one's tilt still settles begins when that settle is over, so the globe never jumps between two paths.
    const last = this.tl.events.at(-1)
    const free = last ? last.startSec + eventSeconds(last) + config.shake.landSettleSeconds : 0
    const e: ShakeEvent = { id: `live-${n}`, startSec: Math.max(this.sim.step + 1, Math.ceil(free * HZ - 1e-7)) / HZ, from: this.season, to, path: livePath(n) }
    this.tl.events.push(e)
    this.playing = e
    this.shakes++
    return to
  }

  jump(season: string): void {
    if (!config.seasons.includes(season)) return
    this.tl.events.length = 0
    this.tl.startSeason = season
    this.season = season
    this.target = null
    this.playing = null
    this.dissolve = null
    this.skipTo = 0
  }

  setState(state: string): void {
    if (!STATES.includes(state)) return
    const season = this.season
    this.jump(season)
    this.sim.reset()
    this.tl.events.push(...stillTimeline(season).events)
    this.clock = 0
    this.skipTo = Math.round(stateSeconds(state) * HZ)
    this.landed = eventSeconds(this.tl.events[0]!)
  }

  skip(spent: () => number, budgetMs: number): void {
    if (this.sim.remote) this.sim.advanceTo(this.skipTo, this.tl)
    else while (this.skipping && spent() < budgetMs) this.sim.advanceTo(Math.min(this.skipTo, this.sim.step + LIVE.skipSliceSteps), this.tl)
    this.clock = this.sim.step / HZ
    if (!this.skipping) this.skipTo = 0
  }

  tick(dt: number, over: () => boolean = () => false): number {
    if (this.skipping) return 1
    let next = this.clock + Math.min(Math.max(dt, 0), LIVE.maxFrameSeconds)
    this.hold(next)
    let target = Math.max(1, Math.ceil(next * HZ - 1e-7))
    if (target - this.sim.step > LIVE.stepCap) {
      target = this.sim.step + LIVE.stepCap
      next = target / HZ
    }
    while (this.sim.step < target) {
      const to = this.sim.remote ? target : Math.min(target, this.sim.step + LIVE.sliceSteps)
      this.sim.advanceTo(to, this.tl)
      if (this.sim.step < to) break
      if (to < target && over()) {
        target = to
        next = to / HZ
      }
    }
    this.clock = next
    this.settle(Math.max(dt, 0))
    return this.sim.step < target ? 1 : Math.min(1, Math.max(0, next * HZ - (target - 1)))
  }

  private hold(next: number): void {
    const e = this.playing
    if (!e || e.to === e.from || this.ready(e.to)) return
    const at = config.shake.swapWindow.fromBeat
    const cycle = 2 * (at - config.shake.liftBeats)
    const held = e.holdBeats ?? 0
    if ((next + LIVE.maxFrameSeconds - e.startSec) / beatSeconds < at + held) return
    if (cycle > 0 && (held + cycle) * beatSeconds <= config.live.loadWaitSeconds) e.holdBeats = held + cycle
    else {
      e.to = e.from
      this.target = null
    }
  }

  private settle(dt: number): void {
    const e = this.playing
    if (e && this.clock >= e.startSec + eventSeconds(e)) {
      this.season = e.to
      this.target = null
      this.playing = null
      this.landed = e.startSec + eventSeconds(e)
      while (this.tl.events.length > 1) this.tl.startSeason = this.tl.events.shift()!.to
    }
    const d = this.dissolve
    if (!d) return
    if (d.left === null) {
      // The picture changes whole, in one frame, and never before a frame of the old season has been drawn since the press:
      // the interface keeps that frame and fades it out over the new one. The stage is never asked for half a change, which
      // it draws as a grain that only a shake's blur hides.
      if (d.drawn && this.ready(d.to)) {
        this.tl.startSeason = d.to
        this.tl.events.length = 0
        this.season = d.to
        d.left = LIVE.dissolveSeconds
      } else if (this.clock - d.asked >= config.live.loadWaitSeconds) {
        this.dissolve = null
        this.target = null
      }
      d.drawn = true
      return
    }
    // The fade runs on the screen's clock, so its end is counted in real seconds, not in the capped ones of the simulation.
    d.left -= dt
    if (d.left <= 0) {
      this.target = null
      this.dissolve = null
    }
  }

  get shaking(): ShakeEvent | null {
    return this.playing
  }

  moment(mix: number, seed: number): Moment {
    return { ...timelineMoment(this.tl, this.clock, mix, seed), sinceLanding: this.clock - this.landed }
  }
}
