import { config } from '../config'
import type { Moment } from '../core/stage'
import { barSeconds } from '../film/timeline'
import type { Pose } from '../scene/cameras'
import { livePose, liveRig } from './framing'
import { Drag, Look, stirAxis } from './gestures'
import { LiveSession, type LiveSim } from './session'

export const SCRIPTS = ['shake', 'stir', 'drag', 'jump', 'set'] as const
export type ScriptName = (typeof SCRIPTS)[number]

export const SCRIPT = {
  leadSeconds: 0.5,
  tailSeconds: 3,
  stirSeconds: 0.15,
  stirShare: 0.5,
  dragSeconds: 1.6,
  dragShare: 0.55,
  dragRise: 0.12,
  holdSeconds: 0.6,
  backSeconds: 2.4,
  refPx: 1000,
}

export interface ScriptPlan {
  name: ScriptName
  fps: number
  frameCount: number
  from: string
  to: string
  events: { frame: number; what: string }[]
}

export interface ScriptFrame {
  frame: number
  frameCount: number
  season: string
  target: string | null
  busy: boolean
  state: string
  yawDeg: number
  pitchDeg: number
  stirs: number
  stirStrength: number
}

const FPS = config.film.fps
const frames = (seconds: number): number => Math.round(seconds * FPS)
const ease = (v: number): number => {
  const u = v <= 0 ? 0 : v >= 1 ? 1 : v
  return u * u * (3 - 2 * u)
}

export function scriptPlan(name: string, from?: string, to?: string): ScriptPlan {
  if (!(SCRIPTS as readonly string[]).includes(name)) throw new Error(`no such script: ${name}. The scripts are ${SCRIPTS.join(', ')}`)
  const all = config.seasons
  const start = from ?? config.defaultSeason
  if (!all.includes(start)) throw new Error(`no such season: ${start}`)
  const next = all[(all.indexOf(start) + 1) % all.length]!
  const far = all[(all.indexOf(start) + 2) % all.length]!
  const end = name === 'shake' ? next : name === 'jump' || name === 'set' ? (to ?? far) : start
  if (!all.includes(end)) throw new Error(`no such season: ${end}`)
  if ((name === 'jump' || name === 'set') && end === start) throw new Error(`${name} needs a season other than ${start}`)
  const lead = frames(SCRIPT.leadSeconds)
  const tail = frames(SCRIPT.tailSeconds)
  const bar = frames(barSeconds)
  const events: { frame: number; what: string }[] = []
  let frameCount = lead + tail
  if (name === 'shake' || name === 'jump') {
    events.push({ frame: lead, what: name === 'shake' ? 'the Shake control is pressed' : `the mark of ${end} is pressed` }, { frame: lead + bar, what: `the landing in ${end}` })
    frameCount = lead + bar + tail
  } else if (name === 'set') {
    events.push({ frame: lead, what: `the season is set to ${end} with no shake` })
  } else if (name === 'stir') {
    const run = frames(SCRIPT.stirSeconds)
    events.push({ frame: lead, what: 'the pointer goes down: the stir builds with the drag' }, { frame: lead + run, what: 'the pointer is let go' })
    frameCount = lead + run + tail
  } else {
    const run = frames(SCRIPT.dragSeconds)
    const hold = frames(SCRIPT.holdSeconds)
    events.push({ frame: lead, what: 'the pointer goes down' }, { frame: lead + run, what: 'the drag ends and is held' }, { frame: lead + run + hold, what: 'the pointer is let go: the camera eases back' })
    frameCount = lead + run + hold + frames(SCRIPT.backSeconds)
  }
  return { name: name as ScriptName, fps: FPS, frameCount, from: start, to: end, events }
}

export class Replay {
  frame = 0
  stirs = 0
  stirStrength = 0
  readonly look = new Look()
  readonly session: LiveSession
  private readonly drag: Drag
  private mix = 1

  constructor(
    private readonly sim: LiveSim,
    readonly plan: ScriptPlan,
    private readonly aspect: number,
  ) {
    sim.reset()
    this.session = new LiveSession(sim, plan.from)
    this.drag = new Drag(this.look)
  }

  private point(k: number): [number, number] | null {
    const lead = frames(SCRIPT.leadSeconds)
    const ref = SCRIPT.refPx
    if (this.plan.name === 'stir') {
      const run = frames(SCRIPT.stirSeconds)
      if (k < lead || k > lead + run) return null
      return [ref * (0.5 + SCRIPT.stirShare * ((k - lead) / run - 0.5)), ref * 0.5]
    }
    if (this.plan.name === 'drag') {
      const run = frames(SCRIPT.dragSeconds)
      if (k < lead || k > lead + run) return null
      const v = ease((k - lead) / run)
      return [ref * (0.5 + SCRIPT.dragShare * (v - 0.5)), ref * (0.5 - SCRIPT.dragRise * v)]
    }
    return null
  }

  private input(k: number): void {
    const p = this.plan
    const lead = frames(SCRIPT.leadSeconds)
    const t = k / FPS
    if (p.name === 'shake' && k === lead) this.session.shake()
    else if (p.name === 'jump' && k === lead) this.session.goTo(p.to)
    else if (p.name === 'set' && k === lead) this.session.jump(p.to)
    else if (p.name === 'stir' || p.name === 'drag') {
      const at = this.point(k)
      const last = lead + frames(p.name === 'stir' ? SCRIPT.stirSeconds : SCRIPT.dragSeconds) + (p.name === 'drag' ? frames(SCRIPT.holdSeconds) : 0)
      if (at && k === lead) this.drag.down(at[0], at[1], t, SCRIPT.refPx)
      else if (at) this.stir(this.drag.move(at[0], at[1], t))
      if (k === last) this.drag.up()
    }
  }

  private stir(s: ReturnType<Drag['move']>): void {
    if (!s) return
    if (s.begins) this.stirs++
    this.stirStrength += s.strength
    this.sim.stir?.(...stirAxis(s, liveRig(this.aspect, this.look.yaw, this.look.pitch).yawDeg))
  }

  advanceTo(index: number): void {
    const to = Math.max(0, Math.min(this.plan.frameCount - 1, Math.round(index)))
    while (this.frame < to) {
      const k = ++this.frame
      this.input(k)
      this.mix = this.session.tick(1 / FPS)
      this.look.tick(1 / FPS)
    }
  }

  pose(under: number): Pose {
    return livePose(this.aspect, this.look.yaw, this.look.pitch, under)
  }

  moment(): Moment {
    return this.session.moment(this.mix, 1 + (this.frame % 600) * 0.618)
  }

  record(): ScriptFrame {
    const s = this.session
    return { frame: this.frame, frameCount: this.plan.frameCount, season: s.season, target: s.target, busy: s.busy, state: s.stateName, yawDeg: this.look.yaw, pitchDeg: this.look.pitch, stirs: this.stirs, stirStrength: this.stirStrength }
  }
}
