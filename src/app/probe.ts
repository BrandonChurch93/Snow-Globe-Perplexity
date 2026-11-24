import { config } from '../config'
import type { ProbeBridge, ProbeLevelResult, ProbeResult } from '../core/bridge'
import { levels, median } from '../core/quality'
import { barSeconds } from '../film/timeline'

export interface ProbeHost {
  setLevel(id: string): void
  shake(): void
  onFrame(fn: ((seconds: number) => void) | null): void
  graphics(): string
}

export const slowest = (frames: number[]): number => {
  if (!frames.length) return 0
  const s = [...frames].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.99) - 1)]!
}

const fps = (seconds: number): number => (seconds > 0 ? Math.round((1 / seconds) * 10) / 10 : 0)

export function pickLevel(done: ProbeLevelResult[]): string {
  for (const l of levels) {
    const r = done.find((d) => d.level === l.id)
    if (r && Math.min(r.restMedianFps, r.stormMedianFps) >= l.minFps) return l.id
  }
  return levels.at(-1)!.id
}

export function createProbe(host: ProbeHost): ProbeBridge {
  const total = config.perf.probeSeconds
  const storm = Math.min(total / 2, barSeconds + config.shake.settleCheckSeconds)
  return {
    levels: () => levels.map((l) => l.id),
    secondsPerLevel: () => total,
    run(onProgress) {
      return new Promise<ProbeResult>((resolve) => {
        const done: ProbeLevelResult[] = []
        let at = 0
        let spent = 0
        let warm = 2
        let shaken = false
        let rest: number[] = []
        let busy: number[] = []
        const begin = () => {
          spent = 0
          warm = 2
          shaken = false
          rest = []
          busy = []
          host.setLevel(levels[at]!.id)
          onProgress([...done], { level: levels[at]!.id, phase: 'rest', fraction: 0 })
        }
        host.onFrame((seconds) => {
          if (warm > 0) {
            warm--
            return
          }
          spent += seconds
          const inStorm = spent >= total - storm
          if (inStorm && !shaken) {
            shaken = true
            host.shake()
          }
          ;(inStorm ? busy : rest).push(seconds)
          const id = levels[at]!.id
          if (spent < total) {
            onProgress([...done], { level: id, phase: inStorm ? 'storm' : 'rest', fraction: spent / total })
            return
          }
          done.push({ level: id, restMedianFps: fps(median(rest)), restSlowFps: fps(slowest(rest)), stormMedianFps: fps(median(busy)), stormSlowFps: fps(slowest(busy)) })
          at++
          if (at < levels.length) {
            begin()
            return
          }
          host.onFrame(null)
          onProgress([...done], null)
          resolve({ levels: done, graphics: host.graphics(), screen: `${window.screen.width} x ${window.screen.height}`, pixelRatio: window.devicePixelRatio || 1, pick: pickLevel(done), userAgent: navigator.userAgent })
        })
        begin()
      })
    },
  }
}
