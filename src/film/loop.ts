import { config } from '../config'
import { stream } from '../core/rng'
import { flagStandIn } from '../core/standins'
import type { ParticleSource } from '../core/stage'
import { REST_POSE, makeShake, type GlobePose } from '../shake/table'
import { barSeconds, beatSeconds } from './timeline'

export interface LoopParticles {
  readonly source: ParticleSource
  setTime(seconds: number): void
}

export const loopSeconds = config.deliver.cardLoop.seconds
export const loopShakeStart = config.deliver.cardLoop.shakeStartSeconds
export const loopLanding = loopShakeStart + barSeconds
export const wrapLoop = (t: number): number => ((t % loopSeconds) + loopSeconds) % loopSeconds

const path = makeShake('loop')

export function loopBeat(t: number): number | null {
  const u = wrapLoop(t)
  return u >= loopShakeStart && u < loopLanding ? (u - loopShakeStart) / beatSeconds : null
}

export function loopGlobe(t: number): GlobePose {
  const beat = loopBeat(t)
  return beat === null ? REST_POSE : path.poseAt(beat)
}

export function loopSinceLanding(t: number): number {
  const u = wrapLoop(t)
  return u >= loopLanding ? u - loopLanding : u + loopSeconds - loopLanding
}

export class SourceSwitch implements ParticleSource {
  private other: ParticleSource | null = null
  private stamp = 1

  constructor(private readonly base: ParticleSource) {}

  use(source: ParticleSource | null): void {
    this.other = source
    this.stamp++
  }
  touch(): void {
    this.stamp++
  }
  private get now(): ParticleSource {
    return this.other ?? this.base
  }
  get count(): number {
    return this.now.count
  }
  get step(): number {
    return this.other ? -this.stamp : this.base.step
  }
  get pos(): Float32Array {
    return this.now.pos
  }
  get prev(): Float32Array {
    return this.now.prev
  }
  get sizes(): Float32Array {
    return this.now.sizes
  }
  get kindOf(): Uint8Array {
    return this.now.kindOf
  }
  get kinds(): readonly string[] {
    return this.now.kinds
  }
  get state(): Uint8Array {
    return this.now.state
  }
  get liquid(): Float64Array {
    return this.now.liquid
  }
  get opacity(): Float32Array | undefined {
    return this.now.opacity
  }
  get phase(): Float32Array | undefined {
    return this.now.phase
  }
}

const TAU = Math.PI * 2
const STAND_IN = { floatShare: 0.0015, liftShare: 0.012 }
const smooth5 = (v: number): number => {
  const u = v <= 0 ? 0 : v >= 1 ? 1 : v
  return u * u * u * (u * (u * 6 - 15) + 10)
}

export function standInLoop(like: ParticleSource, innerR: number, groundY: number): LoopParticles {
  flagStandIn('loop-particles')
  const n = like.count
  const rng = stream('loop:stand-in')
  const pos = new Float32Array(n * 3)
  const prev = new Float32Array(n * 3)
  const state = new Uint8Array(n)
  const liquid = new Float64Array(like.liquid.length)
  const home = new Float32Array(n * 3)
  const far = new Float32Array(n * 2)
  const turns = new Float32Array(n)
  const from = new Float32Array(n)
  const sink = new Float32Array(n)
  const drift = new Float32Array(n * 3)
  const rise = config.shake.liftBeats * beatSeconds
  const up = config.shake.strokeBeats * beatSeconds
  const quiet = loopSeconds - loopLanding
  const groundR = Math.sqrt(Math.max(0, innerR * innerR - groundY * groundY)) - 1
  const reach = innerR - 2
  for (let i = 0; i < n; i++) {
    const floats = rng.next() < STAND_IN.floatShare
    const lifts = rng.next() < STAND_IN.liftShare
    const r = Math.sqrt(rng.next()) * groundR
    home[i * 3] = r
    home[i * 3 + 1] = rng.next() * TAU
    home[i * 3 + 2] = groundY + rng.next() * 0.6
    let fr = 0
    let fy = 0
    for (let k = 0; k < 8; k++) {
      fr = Math.sqrt(rng.next()) * reach
      fy = rng.range(groundY + 3, reach)
      if (fr * fr + fy * fy < reach * reach) break
      fr *= 0.5
      fy *= 0.5
    }
    far[i * 2] = fr
    far[i * 2 + 1] = fy
    if (floats) {
      home[i * 3] = fr
      home[i * 3 + 2] = fy
      drift[i * 3] = rng.range(0.5, 1.8)
      drift[i * 3 + 1] = 1 + rng.int(3)
      drift[i * 3 + 2] = rng.next() * TAU
    }
    turns[i] = 1 + rng.int(3)
    from[i] = lifts ? loopShakeStart + rise * rng.range(0.85, 1.25) : Infinity
    sink[i] = quiet * rng.range(0.3, 0.92)
  }
  const dt = 1 / config.sim.stepHz

  const place = (out: Float32Array, t: number): void => {
    const u = wrapLoop(t)
    for (let i = 0; i < n; i++) {
      const o = i * 3
      const a = from[i]!
      const b = loopLanding + sink[i]!
      let r = home[o]!
      let angle = home[o + 1]!
      let y = home[o + 2]!
      if (u > a && u < b) {
        const e = u < loopLanding ? smooth5((u - a) / up) : 1 - smooth5((u - loopLanding) / sink[i]!)
        const p = smooth5((u - a) / (b - a))
        r += (far[i * 2]! - r) * e
        y += (far[i * 2 + 1]! - y) * e
        angle += TAU * turns[i]! * p
      }
      const d = drift[o]!
      if (d > 0) {
        const w = (TAU * drift[o + 1]! * u) / loopSeconds + drift[o + 2]!
        y += d * 0.6 * Math.sin(w)
        angle += (d / Math.max(8, r)) * Math.cos(w)
      }
      out[o] = Math.cos(angle) * r
      out[o + 1] = y
      out[o + 2] = Math.sin(angle) * r
    }
  }

  let stamp = 0
  const source: ParticleSource = {
    count: n,
    get step() {
      return stamp
    },
    pos,
    prev,
    sizes: like.sizes,
    kindOf: like.kindOf,
    kinds: like.kinds,
    state,
    liquid,
  }

  return {
    source,
    setTime(seconds: number): void {
      const u = wrapLoop(seconds)
      place(prev, u - dt)
      place(pos, u)
      for (let i = 0; i < n; i++) state[i] = drift[i * 3]! > 0 || (u > from[i]! && u < loopLanding + sink[i]!) ? 0 : 1
      const storm = u < loopShakeStart ? 0 : u < loopLanding ? smooth5((u - loopShakeStart - rise) / up) : 1 - smooth5((u - loopLanding) / quiet)
      liquid.fill(0)
      if (liquid.length > 1) {
        liquid[0] = storm
        liquid[1] = storm
      }
      stamp++
    },
  }
}
