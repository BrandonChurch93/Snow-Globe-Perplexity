import { config } from '../config'
import type { Moment } from '../core/stage'
import { filmCut, type Cut } from '../film/cut'
import { loopSeconds, wrapLoop, type LoopParticles, type SourceSwitch } from '../film/loop'
import { loopMoment, timelineMoment } from '../film/moments'
import { filmPose, loopPose } from '../film/moves'
import { openingPlan } from '../film/opening'
import { eventSeconds, filmTimeline, lastLandingBefore, prerollSeconds, seasonAt, type Timeline } from '../film/timeline'
import type { Pose } from '../scene/cameras'
import { LIVE, type LiveSim } from './session'

export interface Frame {
  pose: Pose
  moment: Moment
  opening: number | null
}

const HZ = config.sim.stepHz
const pace = (dt: number): number => Math.min(Math.max(dt, 0), LIVE.maxFrameSeconds)

export class Autopilot {
  readonly cut: Cut = filmCut()
  readonly from: number
  readonly to: number
  readonly lead: number
  readonly tl: Timeline
  private readonly film: Timeline
  private t: number
  restarts = 0

  constructor(private readonly sim: LiveSim, withOpening: boolean, shot = '') {
    const span = this.cut.spans.find((s) => s.shot.id === shot)
    this.from = span ? span.startSec : 0
    this.to = span ? span.startSec + span.seconds : this.cut.seconds
    this.lead = withOpening && !span ? openingPlan(this.cut.fps).seconds : 0
    this.film = filmTimeline(this.cut)
    const at = prerollSeconds + this.from
    this.tl = {
      id: 'autopilot',
      startSeason: seasonAt(this.film, at).season,
      events: this.film.events.filter((e) => e.startSec + eventSeconds(e) > at && e.startSec >= prerollSeconds).map((e) => ({ ...e, startSec: e.startSec - at })),
    }
    this.t = this.from - this.lead
    this.sim.reset()
  }

  get seconds(): number {
    return this.t
  }

  restart(): void {
    this.t = this.from - this.lead
    this.sim.reset()
    this.restarts++
  }

  frame(dt: number, seed: number): Frame {
    let next = this.t + pace(dt)
    if (next >= this.to) {
      this.restart()
      next = this.t
    }
    if (next < this.from) {
      this.t = next
      return { ...this.picture(this.from, 1, seed), opening: Math.floor((next - this.from + this.lead) * this.cut.fps) }
    }
    let target = Math.max(1, Math.ceil((next - this.from) * HZ - 1e-7))
    if (target - this.sim.step > LIVE.stepCap) {
      target = this.sim.step + LIVE.stepCap
      next = this.from + target / HZ
    }
    this.sim.advanceTo(target, this.tl)
    this.t = next
    return this.picture(next, Math.min(1, Math.max(0, (next - this.from) * HZ - (target - 1))), seed)
  }

  private picture(t: number, mix: number, seed: number): Frame {
    const at = prerollSeconds + t
    const moment = { ...timelineMoment(this.tl, t - this.from, mix, seed), time: at, sinceLanding: at - lastLandingBefore(this.film, at) }
    return { pose: filmPose(this.cut, t), moment, opening: null }
  }
}

export class LoopPlayer {
  private t = 0

  constructor(private readonly particles: SourceSwitch, private readonly loop: LoopParticles, private readonly season: string = config.defaultSeason) {}

  get seconds(): number {
    return this.t
  }

  frame(dt: number, seed: number): Frame {
    this.t = wrapLoop(this.t + pace(dt))
    this.loop.setTime(this.t)
    this.particles.use(this.loop.source)
    return { pose: loopPose(this.t), moment: loopMoment(this.season, this.t, seed), opening: null }
  }
}

export const loopLength = loopSeconds
