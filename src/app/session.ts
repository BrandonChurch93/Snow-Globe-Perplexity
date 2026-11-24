import { config } from '../config'
import type { Moment } from '../core/stage'
import { timelineMoment } from '../film/moments'
import { smoother } from '../film/moves'
import { beatSeconds, eventSeconds, stateSeconds, stillTimeline, type ShakeEvent, type Timeline } from '../film/timeline'
import { REST_POSE, makeShake } from '../shake/table'

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
  dissolveSeconds: 1.8,
  skipSliceSteps: 12,
  sliceSteps: 1,
}

const HZ = config.sim.stepHz
const STATES = Object.keys(config.states).map((k) => k.replace(/Seconds$/, ''))

export class SeasonLoader {
  private readonly done = new Set<string>()
  readonly first: Promise<void>

  constructor(first: string, load: (season: string) => Promise<void>, onReady: (season: string) => void = () => undefined) {
    const one = (season: string) =>
      load(season).then(() => {
        this.done.add(season)
        onReady(season)
      })
    this.first = one(first)
    const rest = config.seasons.filter((s) => s !== first)
    void rest.reduce((chain, s) => chain.then(() => one(s)).catch(() => undefined), this.first.catch(() => undefined))
  }

  ready = (season: string): boolean => this.done.has(season)
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
  private dissolve: { from: string; to: string; asked: number; start: number | null } | null = null
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
      this.dissolve = { from: this.season, to, asked: this.clock, start: null }
      return to
    }
    const id = `live-${this.made++}`
    const e: ShakeEvent = { id, startSec: (this.sim.step + 1) / HZ, from: this.season, to, path: makeShake(id) }
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
    this.settle()
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

  private settle(): void {
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
    if (d.start === null) {
      if (this.ready(d.to)) d.start = this.clock
      else if (this.clock - d.asked >= config.live.loadWaitSeconds) {
        this.dissolve = null
        this.target = null
      }
    } else if (this.clock >= d.start + LIVE.dissolveSeconds) {
      this.tl.startSeason = d.to
      this.tl.events.length = 0
      this.season = d.to
      this.target = null
      this.dissolve = null
    }
  }

  get shaking(): ShakeEvent | null {
    return this.playing
  }

  moment(mix: number, seed: number): Moment {
    const d = this.dissolve
    if (d && d.start !== null) {
      const change = smoother((this.clock - d.start) / LIVE.dissolveSeconds)
      return { season: d.from, from: d.from, to: d.to, change, sinceLanding: this.clock - this.landed, globe: REST_POSE, mix, seed, time: this.clock, beat: null, period: null }
    }
    return { ...timelineMoment(this.tl, this.clock, mix, seed), sinceLanding: this.clock - this.landed }
  }
}
