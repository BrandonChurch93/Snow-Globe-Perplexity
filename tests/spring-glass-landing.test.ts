import { describe, expect, it } from 'vitest'
import type * as THREE from 'three'
import { config } from '../src/config'
import { dressing, runAt, runOn } from '../src/seasons/spring/glass'

const SLOTS = 26
const DEG = 180 / Math.PI
const AT_LANDING = -0.6
const SWAP_OPENS = AT_LANDING - 1.2
const SWAP_CLOSES = AT_LANDING - 0.6
const REST = 12 + AT_LANDING

const live = (r: ReturnType<typeof runAt>): boolean => r.b[3] > 0
const trail = (r: ReturnType<typeof runAt>): number => r.b[1] - Math.max(r.b[2], r.a[1])

describe("spring's glass: what it carries at the landing", () => {
  it('is the rest picture at rest and after it', () => {
    for (let j = 0; j < SLOTS; j++) for (const t of [REST, 20, 40, 1e4]) for (const shed of [0, 1]) expect(runOn(j, t, shed)).toEqual(runAt(j, t, shed))
  })

  it('carries as many runs half a second after the landing as at rest, each with a head', () => {
    let landed = 0
    let rest = 0
    let wet = 0
    for (let j = 0; j < SLOTS; j++) {
      const r = runOn(j, AT_LANDING + 0.5, 0)
      if (live(r)) landed++
      if (live(r) && trail(r) > 0.5 / DEG) wet++
      if (live(runOn(j, REST, 0))) rest++
    }
    expect(rest).toBe(SLOTS)
    expect(landed).toBe(rest)
    expect(wet).toBeGreaterThanOrEqual(20)
  })

  it('never lets a head climb or jump from the swap to the rest picture, and keeps them sliding', () => {
    for (let j = 0; j < SLOTS; j++) {
      let last = runOn(j, AT_LANDING, 0)
      let moved = 0
      for (let t = AT_LANDING + 1 / 60; t < 30; t += 1 / 60) {
        const now = runOn(j, t, 0)
        if (now.a[0] === last.a[0] && live(now) && live(last)) {
          expect(now.b[1]).toBeGreaterThanOrEqual(last.b[1])
          expect((now.b[1] - last.b[1]) * 60).toBeLessThan(3)
          if (t < REST) moved += now.b[1] - last.b[1]
        } else if (now.a[0] !== last.a[0]) {
          // A new run starts only when the one before it has left no head and no trail.
          expect(last.b[3]).toBe(0)
          expect(last.b[2]).toBeGreaterThanOrEqual(last.b[1])
          expect(now.b[3]).toBeLessThan(0.05)
        }
        last = now
      }
      expect(moved * DEG).toBeGreaterThan(3)
    }
  })

  it('swells every run from nothing between the close of the swap window and the landing, none of it in one frame', () => {
    const frames = Math.round(0.6 * 60)
    for (let j = 0; j < SLOTS; j++) {
      for (const t of [SWAP_OPENS, SWAP_CLOSES]) {
        expect(runOn(j, t, 0, 0).b[3]).toBe(0)
        expect(runOn(j, t, 0, 0).c[2]).toBe(0)
      }
      const whole = runOn(j, AT_LANDING, 0).b[3]
      expect(whole).toBeGreaterThan(0)
      let last = 0
      for (let k = 1; k <= frames; k++) {
        const way = k / frames
        const r = runOn(j, SWAP_CLOSES + 0.6 * way, 0, way)
        expect(r.c[2]).toBeGreaterThanOrEqual(last)
        expect(r.c[2] - last).toBeLessThan(0.1)
        expect(r.b[3]).toBeLessThanOrEqual(whole * 1.2 + 1e-9)
        last = r.c[2]
      }
      expect(last).toBe(1)
    }
  })

  it('is shaken off whole whenever the lift comes', () => {
    for (let j = 0; j < SLOTS; j++)
      for (const t of [AT_LANDING, 0, 2, 6, 9]) {
        const r = runOn(j, t, 1)
        expect(r.b[3]).toBe(0)
        expect(r.b[2]).toBeGreaterThanOrEqual(r.b[1])
      }
  })

  // The vertex stage's own sum, for a glass whose dew has formed: how much of its size each still drop has, between the runs.
  const standing = (clock: number): { dew: number; beads: number } => {
    const RS = config.globe.sphereDiameterMm / 2
    let drops: THREE.InstancedBufferGeometry | null = null
    dressing().traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.InstancedBufferGeometry | undefined
      if (g?.getAttribute('aLife')) drops = g
    })
    const drop = drops!.getAttribute('aDrop').array
    const life = drops!.getAttribute('aLife').array
    const runs = Array.from({ length: SLOTS }, (_, j) => runOn(j, clock, 0))
    const out = { dew: 0, beads: 0 }
    for (let i = 0; i < drop.length / 4; i++) {
      const kind = life[i * 4 + 2]!
      if (kind > 1.5) continue
      const th = Math.acos(Math.min(1, Math.max(-1, drop[i * 4 + 1]!)))
      const ph = Math.atan2(drop[i * 4]!, drop[i * 4 + 2]!)
      let on = 1
      for (const r of runs) {
        if (th < r.a[1] - 0.01 || th > r.b[1] + r.b[3] / RS) continue
        const s = th - r.a[1]
        let away = ph - (r.a[0] + (r.a[2] * (Math.sin(r.a[3] * s + r.b[0]) + 0.4 * Math.sin(2.3 * r.a[3] * s + 1.7 * r.b[0]))) / Math.max(Math.sin(th), 0.35))
        away -= 2 * Math.PI * Math.floor(away / (2 * Math.PI) + 0.5)
        if (Math.abs(away) * Math.sin(th) * RS > r.c[0] * 1.6 + 0.6 * drop[i * 4 + 3]!) continue
        on *= Math.sqrt(Math.min(1, Math.max(0, (r.b[2] - th) / 0.3 - 0.15)))
      }
      if (on > 0.5) out[kind > 0.5 ? 'beads' : 'dew']++
    }
    return out
  }

  it('stands the same dew and beads half a second after the landing as at rest, to one in twenty', () => {
    const landed = standing(AT_LANDING + 0.5)
    const rest = standing(REST)
    if (process.env.GLASS_COUNTS) console.log(JSON.stringify({ landed, rest }))
    expect(rest.dew).toBeGreaterThan(8000)
    expect(rest.beads).toBeGreaterThan(380)
    expect(Math.abs(landed.dew - rest.dew)).toBeLessThan(rest.dew / 20)
    expect(Math.abs(landed.beads - rest.beads)).toBeLessThan(rest.beads / 20)
  })
})
