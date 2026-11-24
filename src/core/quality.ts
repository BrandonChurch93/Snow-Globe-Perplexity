import { config } from '../config'
import type { StageQuality } from './stage'

export interface Level {
  id: string
  particleFraction: number
  pixelRatioCap: number
  shadowMapPx: number
  surfaceReflection: string
  minFps: number
}

export const AUTO = 'auto'
export const levels: Level[] = Object.entries(config.live.quality).map(([id, q]) => ({ id, ...q }))
export const topLevel: Level = levels[0]!
export const isLevel = (id: string): boolean => levels.some((l) => l.id === id)

export function levelById(id: string): Level {
  const l = levels.find((x) => x.id === id)
  if (!l) throw new Error(`no such quality level: ${id}`)
  return l
}

export const stageQuality = (l: Level): StageQuality => ({ particleFraction: l.particleFraction, shadowMapPx: l.shadowMapPx, surfaceReflection: l.surfaceReflection })

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

const LONGEST_FRAME = 1

/** How the governor judges a page on automatic.
 * A window of frames closes at `live.probeFrames` frames, or sooner on a slow page: once it holds `spanSeconds` of running and at least `minFrames` frames.
 * A window whose median rate is under the `minFps` of its level drops one level, down to the last.
 * A level is taken back only when the page is clearly fast: `upFactor` times the `minFps` of the level above or more, in every window, for `upSeconds`.
 * Each level is taken back at most once in a visit, so a level that was too slow twice is not tried again. */
export const GOVERN = {
  spanSeconds: 2,
  minFrames: 5,
  upFactor: 2,
  upSeconds: 10,
}

export class Governor {
  level: Level
  auto: boolean
  measuredFps = 0
  private frames: number[] = []
  private span = 0
  private fast = 0
  private retried = new Set<string>()

  constructor(start: string = config.live.defaultQuality) {
    this.auto = !isLevel(start)
    this.level = this.auto ? topLevel : levelById(start)
  }

  /** A level chosen by hand, or automatic again, which starts over from the top. */
  fix(id: string): void {
    this.auto = !isLevel(id)
    this.level = this.auto ? topLevel : levelById(id)
    this.retried.clear()
    this.fast = 0
    this.rest()
  }

  /** Forgets the frames in hand: a level was applied, the picture changed size, a shake ended. */
  rest(): void {
    this.frames = []
    this.span = 0
  }

  /** One frame that took `seconds`. True when the level changed and has to be applied. */
  frame(seconds: number): boolean {
    if (!(seconds > 0)) return false
    const took = Math.min(seconds, LONGEST_FRAME)
    this.frames.push(took)
    this.span += took
    const count = this.frames.length
    if (count < config.live.probeFrames && !(this.span >= GOVERN.spanSeconds && count >= GOVERN.minFrames)) return false
    const ran = this.span
    this.measuredFps = 1 / median(this.frames)
    this.rest()
    if (!this.auto) return false
    const at = levels.indexOf(this.level)
    if (this.measuredFps < this.level.minFps) {
      this.fast = 0
      const below = levels[at + 1]
      if (!below) return false
      this.level = below
      return true
    }
    const above = levels[at - 1]
    if (!above || this.retried.has(above.id) || this.measuredFps < GOVERN.upFactor * above.minFps) {
      this.fast = 0
      return false
    }
    this.fast += ran
    if (this.fast < GOVERN.upSeconds) return false
    this.fast = 0
    this.retried.add(above.id)
    this.level = above
    return true
  }
}
