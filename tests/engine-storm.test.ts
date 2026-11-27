import { describe, expect, it } from 'vitest'
import { Euler, Vector3 } from 'three'
import { config } from '../src/config'
import { stream } from '../src/core/rng'
import { filmCut } from '../src/film/cut'
import { barSeconds, filmTimeline, globePoseAt, prerollSeconds, stateSeconds, stillTimeline } from '../src/film/timeline'
import { LIQUID_PIVOT_MM, LIQUID_R, LIQUID_ROLL, LIQUID_TURBULENCE, ROLL_AXIS, ROLL_CENTRE, ROLL_MAX, ROLL_SLAB_MM, TURBULENCE_MAX } from '../src/globe/liquid'
import { ParticleEngine, STATE_HIDDEN, STATE_LIQUID, WALL } from '../src/particles/engine/engine'
import { KINDS } from '../src/particles/engine/kinds'
import { sdfSample } from '../src/particles/engine/sdf'
import { buildCollider, groundAt } from '../src/scene/layout'

const HZ = config.sim.stepHz
const steps = (seconds: number): number => Math.round(seconds * HZ)
const season = config.lookLockUnit
const collider = buildCollider()
const tl = stillTimeline(season)
const LIFTS = [0, 3, 12, 48, 200]

function bandOf(x: number, y: number, z: number): number {
  const up = y - groundAt(x, z)
  for (let b = 0; b < LIFTS.length - 1; b++) if (up < LIFTS[b + 1]!) return b
  return LIFTS.length - 2
}

const even = ((): number[] => {
  const rng = stream('test:engine:even')
  const out = new Array<number>(LIFTS.length - 1).fill(0)
  let n = 0
  while (n < 60000) {
    const x = rng.range(-WALL, WALL)
    const y = rng.range(-WALL, WALL)
    const z = rng.range(-WALL, WALL)
    if (x * x + y * y + z * z > WALL * WALL || sampleAt(x, y, z) < 0) continue
    out[bandOf(x, y, z)]!++
    n++
  }
  return out.map((c) => c / n)
})()

function sampleAt(x: number, y: number, z: number): number {
  return sdfSample(collider, x, y, z, new Float64Array(3))
}

function fill(e: ParticleEngine): number[] {
  const out = new Array<number>(LIFTS.length - 1).fill(0)
  let n = 0
  for (let i = 0; i < e.count; i++) {
    if (e.state[i] !== STATE_LIQUID) continue
    out[bandOf(e.pos[i * 3]!, e.pos[i * 3 + 1]!, e.pos[i * 3 + 2]!)]!++
    n++
  }
  return out.map((c, b) => c / n / even[b]!)
}

function swirl(e: ParticleEngine): { median: number; fast: number; slow: number; round: number; flat: number; outer: number } {
  const speeds: number[] = []
  const beyond: number[] = []
  let round = 0
  let across = 0
  let upright = 0
  for (let i = 0; i < e.count; i++) {
    if (e.state[i] !== STATE_LIQUID) continue
    const o = i * 3
    const vx = e.vel[o]!
    const vy = e.vel[o + 1]!
    const vz = e.vel[o + 2]!
    const rx = e.pos[o]! - ROLL_CENTRE[0]
    const ry = e.pos[o + 1]! - ROLL_CENTRE[1]
    const rz = e.pos[o + 2]! - ROLL_CENTRE[2]
    const off = Math.abs(rx * ROLL_AXIS[0] + ry * ROLL_AXIS[1] + rz * ROLL_AXIS[2])
    const seen = Math.hypot(vx, vy)
    if (off > 2 * ROLL_SLAB_MM) beyond.push(seen)
    if (off > ROLL_SLAB_MM) continue
    speeds.push(seen)
    const v = Math.hypot(vx, vy, vz)
    const tx = ROLL_AXIS[1] * rz - ROLL_AXIS[2] * ry
    const ty = ROLL_AXIS[2] * rx - ROLL_AXIS[0] * rz
    const tz = ROLL_AXIS[0] * ry - ROLL_AXIS[1] * rx
    const t = Math.hypot(tx, ty, tz)
    if (t > 1e-6 && v > 1e-6) round += (vx * tx + vy * ty + vz * tz) / (t * v)
    across += Math.abs(vx)
    upright += Math.abs(vy)
  }
  speeds.sort((a, b) => a - b)
  beyond.sort((a, b) => a - b)
  const at = (q: number): number => speeds[Math.floor((speeds.length - 1) * q)] ?? 0
  return { median: at(0.5), fast: at(0.9), slow: at(0.1), round: round / Math.max(1, speeds.length), flat: across / Math.max(1e-9, upright), outer: beyond[beyond.length >> 1] ?? 0 }
}

describe('the hand moves first', () => {
  it.each([false, true])('banks the same petals while the dome goes right (twist: %s)', (twisted) => {
    const grid = filmCut()
    const film = filmTimeline(grid)
    const shot = grid.spans.find((s) => s.shot.kind === 'shake' && s.shot.from === 'spring' && s.shot.to === 'summer')!
    const shake = film.events.find((event) => event.id === shot.shot.id)!
    const path = shake.path
    shake.path = { ...path, poseAt: (beat) => ({ ...path.poseAt(beat), twist: twisted ? 0.09 * Math.sin(2.8 * beat) : 0 }) }
    const e = new ParticleEngine({ season: film.startSeason, fraction: 0.1, collider })
    const petal = KINDS.indexOf('petal')
    const fresh = (frame: number): number => {
      const t = prerollSeconds + (shot.first + frame) / grid.fps
      e.advanceTo(steps(t), film)
      return t
    }
    const countPetals = (): number => e.kindOf.reduce((sum, k, i) => sum + +(k === petal && e.state[i] === STATE_LIQUID), 0)
    fresh(0)
    const before = countPetals()
    fresh(3)
    expect(countPetals()).toBeGreaterThan(before * 0.9)
    expect(countPetals()).toBeLessThan(before * 1.15)

    const measure = (time: number) => {
      const p: ReturnType<typeof globePoseAt> & { twist?: number } = globePoseAt(film, time)
      const rot = new Euler(p.tiltX, p.twist ?? 0, p.tiltZ, 'XZY')
      const centre = new Vector3(0, LIQUID_PIVOT_MM, 0).applyEuler(rot).add(new Vector3(p.x, p.y, p.z))
      const world = (i: number): number => new Vector3().fromArray(e.pos, i * 3).applyEuler(rot).x + centre.x
      return { centre, world }
    }
    const a = measure(fresh(12))
    const cohort: [number, number][] = []
    for (let i = 0; i < e.count; i++) if (e.kindOf[i] === petal && e.state[i] === STATE_LIQUID) cohort.push([i, a.world(i)])
    expect(cohort.length).toBeGreaterThan(50)
    const b = measure(fresh(26))
    const same = cohort.filter(([i]) => e.state[i] === STATE_LIQUID)
    const delta = same.reduce((sum, [i, x]) => sum + b.world(i) - x, 0) / same.length
    expect(same.length).toBeGreaterThan(cohort.length * 0.9)
    expect(Math.abs(delta)).toBeLessThan(0.45 * (b.centre.x - a.centre.x))
    fresh(38)
    expect(countPetals()).toBeGreaterThan(before * 4)
    for (let i = 0; i < e.count; i++) {
      if (e.state[i] !== STATE_LIQUID) continue
      const o = i * 3
      expect(Math.hypot(e.pos[o]!, e.pos[o + 1]!, e.pos[o + 2]!)).toBeLessThanOrEqual(WALL + 1e-4)
    }
  }, 120000)

  it('has a sparse crown at the end of the hold while summer keeps all three kinds in the air', () => {
    const grid = filmCut()
    const film = filmTimeline(grid)
    const e = new ParticleEngine({ season: film.startSeason, fraction: 0.075, collider })
    const samples = (f: number, name: string) => {
      e.advanceTo(steps(prerollSeconds + f / grid.fps), film)
      const k = KINDS.indexOf(name)
      let afloat = 0
      let crown = 0
      let alpha = 0
      const pos = e.pos
      for (let i = 0; i < e.count; i++) {
        if (e.kindOf[i] !== k || e.state[i] !== STATE_LIQUID) continue
        afloat++
        alpha += e.opacity[i]!
        if (pos[i * 3 + 1]! > LIQUID_R * 0.5) crown++
      }
      return { afloat, alpha, crown }
    }
    const spring = grid.spans.find((s) => s.shot.kind === 'hold' && s.shot.season === 'spring')!
    const first = samples(spring.first, 'mote')
    const late = samples(spring.last, 'mote')
    expect(late.afloat).toBe(first.afloat)
    expect(late.alpha / first.alpha).toBeGreaterThan(0.25)
    expect(late.alpha / first.alpha).toBeLessThan(0.5)
    expect(late.crown).toBeLessThan(first.crown * 0.45)
    const summer = grid.spans.find((s) => s.shot.kind === 'hold' && s.shot.season === 'summer')!
    const after = ['mote', 'firefly', 'seed'].map((k) => samples(summer.first, k))
    const still = ['mote', 'firefly', 'seed'].map((k) => samples(summer.last, k))
    expect(still[0]!.afloat).toBe(after[0]!.afloat)
    expect(still[0]!.alpha).toBe(still[0]!.afloat)
    expect(still[0]!.crown).toBeGreaterThan(0)
    expect(still[0]!.crown).toBeLessThan(after[0]!.crown * 0.65)
    expect(still[1]!.afloat).toBe(after[1]!.afloat)
    expect(still[2]!.afloat).toBeGreaterThan(0)
    expect(still[2]!.afloat).toBeLessThan(after[2]!.afloat * 0.22)
  }, 120000)
})

describe('the storm of the look lock season', () => {
  it('turns as one flat swirl at the landing, at the pace of the streaks in the approved picture, and slows over seconds', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    e.advanceTo(steps(stateSeconds('landed')), tl)
    const landed = swirl(e)
    expect(e.liquid[LIQUID_ROLL]!).toBeGreaterThan(0.5 * ROLL_MAX)
    expect(e.liquid[LIQUID_ROLL]!).toBeLessThanOrEqual(ROLL_MAX)
    expect(e.liquid[LIQUID_TURBULENCE]! / TURBULENCE_MAX).toBeGreaterThan(0.5)
    expect(landed.median).toBeGreaterThan(250)
    expect(landed.median).toBeLessThan(450)
    expect(landed.slow).toBeGreaterThan(80)
    expect(landed.slow).toBeLessThan(0.55 * landed.median)
    expect(landed.fast).toBeGreaterThan(1.5 * landed.median)
    expect(landed.fast).toBeLessThan(750)
    expect(landed.round).toBeGreaterThan(0.6)
    expect(landed.round).toBeLessThan(0.9)
    expect(landed.flat).toBeGreaterThan(1.25)
    expect(landed.flat).toBeLessThan(2.2)
    expect(landed.outer).toBeLessThan(0.6 * landed.median)
    expect(landed.outer).toBeGreaterThan(60)
    e.advanceTo(steps(stateSeconds('landed') + 1), tl)
    const later = swirl(e)
    expect(later.median).toBeGreaterThan(0.3 * landed.median)
    expect(later.median).toBeLessThan(0.7 * landed.median)
    expect(later.round).toBeGreaterThan(0.45)
    e.advanceTo(steps(stateSeconds('landed') + 2.5), tl)
    const late = swirl(e)
    expect(late.median).toBeGreaterThan(0.05 * landed.median)
    expect(late.median).toBeLessThan(0.2 * landed.median)
    e.advanceTo(steps(stateSeconds('rest')), tl)
    expect(e.liquid[LIQUID_ROLL]).toBe(0)
    expect(swirl(e).median).toBeLessThan(6)
  }, 120000)

  it('banks the heavy flakes low in the storm and leaves the light ones through the dome', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    e.advanceTo(steps(stateSeconds('landed')), tl)
    const [low, near, mid, high] = fill(e) as [number, number, number, number]
    expect(low).toBeGreaterThan(1.3)
    expect(near).toBeGreaterThan(1)
    expect(high).toBeLessThan(0.8 * mid)
    e.advanceTo(steps(stateSeconds('landed') + 1), tl)
    const [lower, nearer] = fill(e) as [number, number, number, number]
    expect(lower).toBeGreaterThan(low)
    expect(lower).toBeGreaterThan(1.8)
    expect(nearer).toBeGreaterThan(1)
    let dense = 0
    const cells = new Map<number, number>()
    let afloat = 0
    for (let i = 0; i < e.count; i++) {
      if (e.state[i] !== STATE_LIQUID) continue
      afloat++
      const key = Math.floor(e.pos[i * 3]! / 4 + 64) + 128 * (Math.floor(e.pos[i * 3 + 1]! / 4 + 64) + 128 * Math.floor(e.pos[i * 3 + 2]! / 4 + 64))
      const c = (cells.get(key) ?? 0) + 1
      cells.set(key, c)
      if (c > dense) dense = c
    }
    expect(dense).toBeLessThan((afloat / cells.size) * 25)
  }, 120000)

  it('fills the whole dome at the landing and does not press into a low layer', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    for (const seconds of [barSeconds, stateSeconds('landed')]) {
      e.advanceTo(steps(seconds), tl)
      expect(e.floating()).toBeGreaterThan(e.count * 0.97)
      const [low, near, mid, high] = fill(e) as [number, number, number, number]
      expect(low).toBeLessThan(3)
      expect(near).toBeLessThan(2)
      expect(mid).toBeGreaterThan(0.7)
      expect(mid).toBeLessThan(1.4)
      expect(high).toBeGreaterThan(0.4)
      expect(high).toBeLessThan(1.4)
    }
  }, 120000)

  it('still has flakes through the whole dome at rest, a little denser low down, and far fewer once settled', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    e.advanceTo(steps(stateSeconds('rest')), tl)
    const rest = e.floating()
    expect(rest).toBeGreaterThan(e.count * 0.04)
    expect(rest).toBeLessThan(e.count * 0.2)
    const [, , mid, high] = fill(e) as [number, number, number, number]
    expect(high).toBeGreaterThan(0.3)
    expect(high).toBeLessThan(mid)
    e.advanceTo(steps(stateSeconds('settled')), tl)
    const settled = e.floating()
    expect(settled).toBeLessThan(rest * 0.6)
    expect(settled).toBeGreaterThan(e.count * 0.01)
    expect(fill(e)[3]).toBeGreaterThan(0.4)
  }, 240000)

  it('gives sizes in millimetres with most flakes small and a long tail of large ones', () => {
    const e = new ParticleEngine({ season, fraction: 0.25, collider })
    e.reset(season)
    const flake = KINDS.indexOf('flake')
    const sizes: number[] = []
    for (let i = 0; i < e.count; i++) if (e.kindOf[i] === flake && e.state[i] !== STATE_HIDDEN) sizes.push(e.sizes[i]!)
    sizes.sort((a, b) => a - b)
    const at = (p: number): number => sizes[Math.floor((sizes.length - 1) * p)]!
    expect(at(0.5)).toBeGreaterThan(0.2)
    expect(at(0.5)).toBeLessThan(0.34)
    expect(at(0.9)).toBeGreaterThan(2 * at(0.5))
    expect(at(0.99)).toBeGreaterThan(4 * at(0.5))
    expect(at(1)).toBeLessThanOrEqual(1.9 + 1e-6)
    expect(at(0)).toBeGreaterThan(0.05)
  })

  it('shows the same positions whether they are read at every step or only at the end', () => {
    const watched = new ParticleEngine({ season, fraction: 0.02, collider })
    const blind = new ParticleEngine({ season, fraction: 0.02, collider })
    const last = steps(barSeconds + 0.5)
    let before = watched.pos.slice()
    let jumps = 0
    for (let n = 1; n <= last; n++) {
      watched.advanceTo(n, tl)
      const now = watched.pos
      const prev = watched.prev
      for (let i = 0; i < watched.count; i++) {
        if (watched.state[i] !== STATE_LIQUID) continue
        const o = i * 3
        if (Math.hypot(prev[o]! - before[o]!, prev[o + 1]! - before[o + 1]!, prev[o + 2]! - before[o + 2]!) > 0.6) jumps++
      }
      before = now.slice()
    }
    blind.advanceTo(last, tl)
    expect(watched.pos).toEqual(blind.pos)
    expect(watched.prev).toEqual(blind.prev)
    expect(watched.vel).toEqual(blind.vel)
    expect(watched.state).toEqual(blind.state)
    expect(jumps).toBeLessThan(watched.count * 0.02)
  }, 120000)
})
