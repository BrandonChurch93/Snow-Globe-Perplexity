import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { barSeconds, globePoseAt, stillTimeline } from '../src/film/timeline'
import { AMBIENT_MAX, Liquid, LIQUID_LENGTH, LIQUID_R, LIQUID_SLOSH, LIQUID_TURBULENCE, LIQUID_TURN, TURBULENCE_MAX } from '../src/globe/liquid'
import { REST_POSE } from '../src/shake/table'
import { stream } from '../src/core/rng'

const HZ = config.sim.stepHz
const DT = 1 / HZ
const tl = stillTimeline(config.defaultSeason)

function run(liquid: Liquid, fromStep: number, toStep: number, each?: (step: number) => void): void {
  for (let n = fromStep; n < toStep; n++) {
    const t = n * DT
    liquid.step(globePoseAt(tl, t - DT), globePoseAt(tl, t), globePoseAt(tl, t + DT), t)
    if (each) each(n + 1)
  }
}

function energy(liquid: Liquid): number {
  const L = liquid.state
  const turn = Math.hypot(L[LIQUID_TURN]!, L[LIQUID_TURN + 1]!, L[LIQUID_TURN + 2]!) * LIQUID_R
  const slosh = Math.hypot(L[LIQUID_SLOSH]!, L[LIQUID_SLOSH + 1]!, L[LIQUID_SLOSH + 2]!)
  return turn + slosh + L[LIQUID_TURBULENCE]!
}

function points(count: number, onWall: boolean): number[][] {
  const rng = stream('test:liquid:points')
  const out: number[][] = []
  while (out.length < count) {
    const x = rng.range(-1, 1)
    const y = rng.range(-1, 1)
    const z = rng.range(-1, 1)
    const r = Math.hypot(x, y, z)
    if (r > 1 || r < 0.05) continue
    const s = onWall ? LIQUID_R / r : LIQUID_R
    out.push([x * s, y * s, z * s])
  }
  return out
}

describe('the liquid model', () => {
  it('stays at rest when the globe is at rest', () => {
    const liquid = new Liquid()
    const u = [0, 0, 0]
    for (let n = 0; n < HZ * 10; n++) {
      liquid.step(REST_POSE, REST_POSE, REST_POSE, n * DT)
      if (n % 97 === 0) {
        for (const p of points(40, false)) {
          liquid.velocityAt(p[0]!, p[1]!, p[2]!, u)
          expect(Math.hypot(u[0]!, u[1]!, u[2]!)).toBeLessThanOrEqual(AMBIENT_MAX)
        }
      }
    }
    expect(liquid.state.length).toBe(LIQUID_LENGTH)
    expect(Array.from(liquid.state).every((v) => v === 0)).toBe(true)
    expect(liquid.atRest).toBe(true)
    expect(liquid.noise).toBe(false)
  })

  it('is thrown by a shake and decays after it', () => {
    const liquid = new Liquid()
    const landing = Math.round(barSeconds * HZ)
    let peak = 0
    let peakTurb = 0
    run(liquid, 0, landing, () => {
      peak = Math.max(peak, energy(liquid))
      peakTurb = Math.max(peakTurb, liquid.state[LIQUID_TURBULENCE]!)
    })
    const atLanding = energy(liquid)
    expect(peak).toBeGreaterThan(150)
    expect(peakTurb).toBeLessThanOrEqual(TURBULENCE_MAX)
    expect(peakTurb).toBeGreaterThan(TURBULENCE_MAX * 0.5)
    expect(atLanding).toBeGreaterThan(40)
    let last = Infinity
    const settle = landing + Math.round(config.shake.landSettleSeconds * HZ)
    const spun = landing + Math.round(config.shake.spinDownSeconds * HZ)
    run(liquid, landing, spun, (step) => {
      if (step > settle && step % 24 === 0) {
        const e = energy(liquid)
        expect(e).toBeLessThanOrEqual(last)
        last = e
      }
    })
    expect(energy(liquid)).toBeLessThan(atLanding * 0.2)
    run(liquid, spun, spun + Math.round(2 * config.shake.spinDownSeconds * HZ))
    expect(energy(liquid)).toBeLessThan(atLanding * 0.01)
    run(liquid, spun + Math.round(2 * config.shake.spinDownSeconds * HZ), landing + 40 * HZ)
    expect(liquid.atRest).toBe(true)
  })

  it('settles into a turn about a near upright axis', () => {
    const liquid = new Liquid()
    const landing = Math.round(barSeconds * HZ)
    run(liquid, 0, landing + HZ)
    const L = liquid.state
    const w = Math.hypot(L[0]!, L[1]!, L[2]!)
    expect(w).toBeGreaterThan(0.2)
    expect(Math.abs(L[1]!) / w).toBeGreaterThan(0.97)
    expect(Math.hypot(L[LIQUID_SLOSH]!, L[LIQUID_SLOSH + 1]!, L[LIQUID_SLOSH + 2]!)).toBeLessThan(w * LIQUID_R * 0.2)
  })

  it('gives velocities that slide along the wall and never leave the sphere', () => {
    const liquid = new Liquid()
    const wall = points(300, true)
    const inside = points(300, false)
    const u = [0, 0, 0]
    const landing = Math.round(barSeconds * HZ)
    let checked = 0
    let fastest = 0
    run(liquid, 0, landing + 2 * HZ, (step) => {
      if (step % 9 !== 0) return
      for (const p of wall) {
        liquid.velocityAt(p[0]!, p[1]!, p[2]!, u)
        const speed = Math.hypot(u[0]!, u[1]!, u[2]!)
        const normal = (u[0]! * p[0]! + u[1]! * p[1]! + u[2]! * p[2]!) / LIQUID_R
        expect(Math.abs(normal)).toBeLessThanOrEqual(1e-9 + speed * 1e-9)
        fastest = Math.max(fastest, speed)
        checked++
      }
      for (const p of inside) {
        liquid.velocityAt(p[0]!, p[1]!, p[2]!, u)
        const speed = Math.hypot(u[0]!, u[1]!, u[2]!)
        expect(Number.isFinite(speed)).toBe(true)
        expect(speed).toBeLessThanOrEqual(liquid.maxSpeed + 1e-9)
      }
    })
    expect(checked).toBeGreaterThan(10000)
    expect(fastest).toBeGreaterThan(50)
  })

  it('keeps a carried point inside the sphere through a whole shake', () => {
    const liquid = new Liquid()
    const pts = points(120, false).map((p) => p.map((v) => v * 0.985))
    const k1 = [0, 0, 0]
    const k2 = [0, 0, 0]
    const landing = Math.round(barSeconds * HZ)
    let worst = 0
    run(liquid, 0, landing + HZ, () => {
      for (const p of pts) {
        liquid.velocityAt(p[0]!, p[1]!, p[2]!, k1)
        liquid.velocityAt(p[0]! + k1[0]! * DT * 0.5, p[1]! + k1[1]! * DT * 0.5, p[2]! + k1[2]! * DT * 0.5, k2)
        p[0] = p[0]! + k2[0]! * DT
        p[1] = p[1]! + k2[1]! * DT
        p[2] = p[2]! + k2[2]! * DT
        worst = Math.max(worst, Math.hypot(p[0]!, p[1]!, p[2]!))
      }
    })
    expect(worst).toBeLessThanOrEqual(LIQUID_R + 0.25)
  })

  it('is the same every time and takes a stir', () => {
    const a = new Liquid()
    const b = new Liquid()
    run(a, 0, HZ * 2)
    run(b, 0, HZ * 2)
    expect(Array.from(a.state)).toEqual(Array.from(b.state))
    const c = new Liquid()
    c.stir(0, 2, 0)
    c.step(REST_POSE, REST_POSE, REST_POSE, 0)
    expect(c.state[LIQUID_TURN + 1]!).toBeGreaterThan(0)
    expect(c.state[LIQUID_TURN + 1]!).toBeLessThan(0.1)
    let peak = 0
    for (let n = 1; n < HZ; n++) {
      c.step(REST_POSE, REST_POSE, REST_POSE, n * DT)
      peak = Math.max(peak, c.state[LIQUID_TURN + 1]!)
    }
    expect(peak).toBeGreaterThan(1.2)
    for (let n = HZ; n < HZ * 40; n++) c.step(REST_POSE, REST_POSE, REST_POSE, n * DT)
    expect(c.atRest).toBe(true)
  })
})
