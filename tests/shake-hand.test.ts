import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { config, shots } from '../src/config'
import { FRAME } from '../src/app/framing'
import { SHAKE_CHANNELS, makeShake, shakeMotion, tiltSine, type GlobePose } from '../src/shake/table'

const s = config.shake
const BEAT_S = 60 / config.film.defaultBpm
const FRAME_BEATS = 1 / config.film.fps / BEAT_S
const DEG = 180 / Math.PI
const FOOT_MM = config.globe.baseDiameterMm / 2

const film = shots.filter((shot) => shot.kind === 'shake').map((shot) => shot.id)
const HELD = [...film, 'loop', ...Array.from({ length: FRAME.shakePaths }, (_, i) => `live-${i}`)]
const tiltOf = (p: GlobePose): number => Math.asin(Math.min(1, tiltSine(p.tiltX, p.tiltZ))) * DEG

/** Every channel and its first two derivatives at 960 samples a beat, to a billionth, for the shakes the stills and the opening stand on. Read on `8e5798b`. */
const FIRST_HAND: Record<string, string> = {
  test: 'e9662eac4e0979e1a195cbf90a955d0c4c09c0482c68fe9b42e77779c7fd6ba9',
  'test:winter': 'ce43dcad2586ac75bc335ec22f89c8cc4743d6e56434ad223871d4a5a0a792bf',
  'test:spring': 'f682e82c11d45eae62fbbdf1e5b85050cab8b3b9056fdbd60074363d2e0f2bd4',
  'test:summer': '40a6242366776b20602c452b2d39096cabc26d6fd9e8a9efd0ab2b7ce33657f4',
  'test:fall': 'bad905455d1d4049f49cc1f2f99c02bc8e38f3f54d35c8cf81ede98150eb1a7f',
  preroll: '4cc21dd1291a8700e6585e8f972d836fc23023226b4b6967db031f7899988004',
}

const digest = (name: string): string => {
  const m = shakeMotion(name)
  const h = createHash('sha256')
  for (const ch of SHAKE_CHANNELS) for (let b = 0; b <= m.endBeat + 0.01; b += 1 / 960) for (let order = 0; order < 3; order++) h.update(`${Math.round(m.at(ch, b, order) * 1e9)},`)
  return h.digest('hex')
}

describe('the hand: which shakes it holds', () => {
  it('leaves the first hand as it was, number for number: the test shake of every season and the preroll', () => {
    expect(Object.keys(FIRST_HAND).sort()).toEqual(['test', ...config.seasons.map((season) => `test:${season}`), 'preroll'].sort())
    for (const [name, was] of Object.entries(FIRST_HAND)) expect(digest(name), name).toBe(was)
  })
})

describe('the hand: the landing', () => {
  it('rocks over once and back once where the frame shows it, about the edge that is on the surface, and is still inside the settle', () => {
    for (const name of HELD) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const landing = path.parts.landing
      const into = { x: m.at('tiltX', landing - 0.02), z: m.at('tiltZ', landing - 0.02) }
      const along = (b: number): number => (m.at('tiltX', b) * into.x + m.at('tiltZ', b) * into.z) / Math.hypot(into.x, into.z)
      // One edge first, and the foot flat on the landing frame.
      expect(tiltOf(path.poseAt(m.plan.touch)), `${name} edge first`).toBeGreaterThan(2.7)
      expect(tiltOf(path.poseAt(landing)), `${name} flat on the bar`).toBe(0)
      // Frame by frame at the film's rate: over to the far edge, back to the near one, and still.
      let over = 0
      let back = 0
      let overFrame = 0
      let backFrame = 0
      let still = 0
      const frames = Math.round((m.endBeat - landing) / FRAME_BEATS)
      for (let f = -Math.ceil((landing - m.plan.touch) / FRAME_BEATS); f <= frames + 6; f++) {
        const p = path.poseAt(landing + f * FRAME_BEATS)
        const gap = p.y - FOOT_MM * tiltSine(p.tiltX, p.tiltZ)
        // It turns about the edge on the surface: that edge neither sinks into the surface nor leaves it.
        if (landing + f * FRAME_BEATS >= m.plan.touch) expect(Math.abs(gap), `${name} frame ${f}`).toBeLessThan(0.05)
        if (f <= 0) continue
        const a = along(landing + f * FRAME_BEATS) * DEG
        if (-a > over) {
          over = -a
          overFrame = f
        }
        if (f > overFrame && a > back) {
          back = a
          backFrame = f
        }
        if (tiltOf(p) > 0.02) still = f
      }
      expect(over, `${name} over`).toBeGreaterThan(1.7)
      expect(over, `${name} over`).toBeLessThan(2.5)
      expect(back, `${name} back`).toBeGreaterThan(0.5)
      expect(back, `${name} back`).toBeLessThan(0.55 * over)
      expect(backFrame, `${name} back after over`).toBeGreaterThan(overFrame + 5)
      expect((still + 1) * FRAME_BEATS * BEAT_S, `${name} still`).toBeLessThanOrEqual(s.landSettleSeconds + 1e-9)
    }
  })
})
