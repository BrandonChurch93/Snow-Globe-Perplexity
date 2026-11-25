import { config } from '../config'
import { MOVES, rigOf } from '../film/moves'

const L = config.live
const FRONT = rigOf(MOVES.wide)

export const TOUCH = {
  turnShare: 1.15,
  lookBelow: 1.1,
  stirAbove: 1.9,
  fullAt: 4.5,
  stirLeastShare: 0.07,
  stirLeastPx: 28,
  stirSpan: 0.36,
  stirMost: 1,
  stirRestSeconds: 1.2,
  smoothSeconds: 0.05,
  returnRate: 3.2,
  stirRate: 9,
  leastStrength: 0.35,
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const step = (lo: number, hi: number, v: number): number => {
  const u = clamp((v - lo) / (hi - lo), 0, 1)
  return u * u * (3 - 2 * u)
}

export class Look {
  yaw = 0
  pitch = 0
  private vy = 0
  private vp = 0
  held = false

  private get lowest(): number {
    return L.orbitPitchMinDeg - FRONT.pitchDeg
  }
  private get highest(): number {
    return L.orbitPitchMaxDeg - FRONT.pitchDeg
  }

  turn(dYaw: number, dPitch: number, dt: number): void {
    const y = clamp(this.yaw + dYaw, -L.orbitYawDeg, L.orbitYawDeg)
    const p = clamp(this.pitch + dPitch, this.lowest, this.highest)
    if (dt > 0) {
      const w = Math.min(1, dt / TOUCH.smoothSeconds)
      this.vy += ((y - this.yaw) / dt - this.vy) * w
      this.vp += ((p - this.pitch) / dt - this.vp) * w
    }
    this.yaw = y
    this.pitch = p
  }

  tick(dt: number): void {
    if (!(dt > 0)) return
    if (this.held) {
      const fade = Math.exp(-dt / TOUCH.smoothSeconds)
      this.vy *= fade
      this.vp *= fade
      return
    }
    const w = TOUCH.returnRate
    const e = Math.exp(-w * dt)
    const a = this.vy + w * this.yaw
    const b = this.vp + w * this.pitch
    this.yaw = clamp((this.yaw + a * dt) * e, -L.orbitYawDeg, L.orbitYawDeg)
    this.vy = (this.vy - w * a * dt) * e
    this.pitch = clamp((this.pitch + b * dt) * e, this.lowest, this.highest)
    this.vp = (this.vp - w * b * dt) * e
  }
}

export interface Stir {
  x: number
  y: number
  strength: number
  force: number
  begins: boolean
}

const noRun = (): { len: number; dx: number; dy: number; peak: number; begun: boolean } => ({ len: 0, dx: 0, dy: 0, peak: 0, begun: false })

/** A quick drag feeds the liquid while the pointer is down: each move gives a small push along the way the pointer went,
 * as large as the share of the short side it crossed. A full stir (`stirRate`) is a drag across `stirSpan` of the short side
 * at full speed; a hold has `stirMost` stirs to give and earns one back in `stirRestSeconds`. */
export class Drag {
  private x = 0
  private y = 0
  private t = 0
  private ref = 1
  private speed = 0
  private fed = 0
  private run = noRun()
  active = false
  travelled = 0

  constructor(private readonly look: Look) {}

  down(x: number, y: number, t: number, ref: number): void {
    this.x = x
    this.y = y
    this.t = t
    this.ref = Math.max(1, ref)
    this.speed = 0
    this.fed = 0
    this.travelled = 0
    this.run = noRun()
    this.active = true
    this.look.held = true
  }

  move(x: number, y: number, t: number): Stir | null {
    if (!this.active) return null
    const dx = x - this.x
    const dy = y - this.y
    const dt = Math.max(1e-3, t - this.t)
    this.x = x
    this.y = y
    this.t = t
    const d = Math.hypot(dx, dy)
    this.travelled += d
    const now = d / dt / this.ref
    this.speed += (now - this.speed) * Math.min(1, dt / TOUCH.smoothSeconds)
    this.fed = Math.max(0, this.fed - (dt * TOUCH.stirMost) / TOUCH.stirRestSeconds)
    const slow = 1 - step(TOUCH.lookBelow, TOUCH.stirAbove, this.speed)
    const perPx = (2 * L.orbitYawDeg * TOUCH.turnShare) / this.ref
    this.look.turn(-dx * perPx * slow, dy * perPx * slow, dt)
    if (this.speed < TOUCH.stirAbove) {
      if (this.speed < TOUCH.lookBelow) this.run = noRun()
      return null
    }
    const r = this.run
    r.len += d
    r.dx += dx
    r.dy += dy
    r.peak = Math.max(r.peak, now, this.speed)
    if (!r.begun && r.len < Math.max(TOUCH.stirLeastPx, TOUCH.stirLeastShare * this.ref)) return null
    const l = Math.hypot(r.dx, r.dy)
    if (!(l > 0)) return null
    const hard = (v: number): number => TOUCH.leastStrength + (1 - TOUCH.leastStrength) * clamp((v - TOUCH.stirAbove) / (TOUCH.fullAt - TOUCH.stirAbove), 0, 1)
    const strength = Math.min((hard(this.speed) * l) / this.ref / TOUCH.stirSpan, TOUCH.stirMost - this.fed)
    const push: Stir = { x: r.dx / l, y: r.dy / l, strength, force: hard(r.peak), begins: !r.begun }
    r.begun = true
    r.dx = 0
    r.dy = 0
    if (!(strength > 0)) return null
    this.fed += strength
    return push
  }

  up(): void {
    this.active = false
    this.look.held = false
    this.run = noRun()
  }
}

export function stirAxis(s: Pick<Stir, 'x' | 'y' | 'strength'>, yawDeg: number): [number, number, number] {
  const yaw = (yawDeg * Math.PI) / 180
  const rate = s.strength * TOUCH.stirRate
  return [s.y * Math.cos(yaw) * rate, s.x * rate, -s.y * Math.sin(yaw) * rate]
}

export class MotionShake {
  private last = -Infinity
  private hits = 0
  static readonly threshold = 13
  static readonly withinSeconds = 0.7

  feed(ax: number, ay: number, az: number, t: number, gravity: boolean): boolean {
    const a = Math.hypot(ax, ay, az)
    const over = gravity ? Math.abs(a - 9.81) > MotionShake.threshold * 0.8 : a > MotionShake.threshold
    if (!over) return false
    if (t - this.last > MotionShake.withinSeconds) this.hits = 0
    if (t - this.last < 0.08) return false
    this.last = t
    this.hits++
    if (this.hits < 2) return false
    this.hits = 0
    return true
  }
}
