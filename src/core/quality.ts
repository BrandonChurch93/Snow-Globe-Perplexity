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

export class Governor {
  level: Level
  auto: boolean
  measuredFps = 0
  private frames: number[] = []

  constructor(start: string = config.live.defaultQuality) {
    this.auto = !isLevel(start)
    this.level = this.auto ? topLevel : levelById(start)
  }

  fix(id: string): void {
    this.auto = !isLevel(id)
    this.level = this.auto ? topLevel : levelById(id)
    this.frames = []
  }

  rest(): void {
    this.frames = []
  }

  frame(seconds: number): boolean {
    if (!(seconds > 0)) return false
    this.frames.push(Math.min(seconds, LONGEST_FRAME))
    if (this.frames.length < config.live.probeFrames) return false
    this.measuredFps = 1 / median(this.frames)
    this.frames = []
    if (!this.auto || this.measuredFps >= this.level.minFps) return false
    const next = levels[levels.indexOf(this.level) + 1]
    if (!next) return false
    this.level = next
    return true
  }
}
