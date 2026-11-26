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
      expect(over, `${name} over`).toBeGreaterThan(2.2)
      expect(over, `${name} over`).toBeLessThan(2.5)
      // The one rock over takes three quarters of the settle; what is left of it holds a rock back of under half a degree and the stillness.
      expect(back, `${name} back`).toBeGreaterThan(0.4)
      expect(back, `${name} back`).toBeLessThan(0.55 * over)
      expect(backFrame, `${name} back after over`).toBeGreaterThan(overFrame + 5)
      expect((still + 1) * FRAME_BEATS * BEAT_S, `${name} still`).toBeLessThanOrEqual(s.landSettleSeconds + 1e-9)
    }
  })
})

describe('the hand: the set down', () => {
  it('does not stop on the edge: from the last of the fall to the bar the height falls on every frame, and fastest as the foot goes flat', () => {
    for (const name of HELD) {
      const m = shakeMotion(name)
      const path = makeShake(name)
      const landing = path.parts.landing
      const touchFrames = Math.ceil((landing - m.plan.touch) / FRAME_BEATS)
      let slowest = Infinity
      let fastest = 0
      let fall = 0
      for (let f = -touchFrames - 3; f < 0; f++) {
        const drop = path.poseAt(landing + f * FRAME_BEATS).y - path.poseAt(landing + (f + 1) * FRAME_BEATS).y
        slowest = Math.min(slowest, drop)
        if (f >= -touchFrames) fastest = Math.max(fastest, drop)
        else fall = Math.max(fall, drop)
      }
      // A foot that sticks on its edge shows as two frames with next to no fall between the way down and the roll.
      expect(slowest, `${name} slowest frame`).toBeGreaterThan(0.3)
      // Weight: it goes flat faster than it came down.
      expect(fastest, `${name} roll`).toBeGreaterThan(1.15 * fall)
    }
  })
})

describe('the hand: the strokes', () => {
  it('arcs in height through every stroke, highest at its turns, inside the lift', () => {
    for (const name of HELD) {
      const m = shakeMotion(name)
      const turns = m.plan.strokes
      for (let i = 0; i + 1 < turns.length; i++) {
        let low = Infinity
        for (let b = turns[i]!.beat; b <= turns[i + 1]!.beat; b += FRAME_BEATS / 8) {
          const y = m.at('y', b)
          expect(y, `${name} stroke ${i}`).toBeLessThanOrEqual(s.liftMm + 1e-9)
          low = Math.min(low, y)
        }
        expect(m.at('y', turns[i]!.beat) - low, `${name} stroke ${i} from its first turn`).toBeGreaterThan(1.5)
        expect(m.at('y', turns[i + 1]!.beat) - low, `${name} stroke ${i} to its second turn`).toBeGreaterThan(1.5)
      }
    }
  })

  it('takes strokes of unequal length and unequal time', () => {
    for (const name of HELD) {
      const turns = shakeMotion(name).plan.strokes
      const frames = turns.slice(1).map((t, i) => (t.beat - turns[i]!.beat) / FRAME_BEATS)
      const reach = turns.map((t) => Math.abs(t.mm))
      expect(Math.max(...frames) / Math.min(...frames), `${name} time`).toBeGreaterThan(1.6)
      expect(Math.max(...reach) / Math.min(...reach), `${name} reach`).toBeGreaterThan(1.3)
    }
  })

  it('leans on past every turn for a frame or more, is not level where it crosses the centre, and rocks on a second axis', () => {
    for (const name of HELD) {
      const m = shakeMotion(name)
      const turns = m.plan.strokes
      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i]!.beat
        const lean = (b: number): number => Math.abs(m.at('tiltZ', b)) * DEG
        let peak = { frames: 0, deg: 0 }
        for (let f = -3; f <= 6; f += 1 / 8) if (lean(turn + f * FRAME_BEATS) > peak.deg) peak = { frames: f, deg: lean(turn + f * FRAME_BEATS) }
        expect(peak.frames, `${name} turn ${i} lag`).toBeGreaterThanOrEqual(1.5)
        expect(peak.frames, `${name} turn ${i} lag`).toBeLessThanOrEqual(4)
        expect(peak.deg, `${name} turn ${i} lean`).toBeGreaterThan(4)
        expect(peak.deg - lean(turn), `${name} turn ${i} goes on`).toBeGreaterThan(0.7)
        const next = turns[i + 1]
        if (!next) continue
        let cross = Number.NaN
        let fore = { lo: Infinity, hi: -Infinity }
        for (let b = turn; b <= next.beat; b += FRAME_BEATS / 8) {
          const t = m.at('tiltX', b) * DEG
          fore = { lo: Math.min(fore.lo, t), hi: Math.max(fore.hi, t) }
          if (Number.isNaN(cross) && m.at('x', b) * m.at('x', b + FRAME_BEATS / 8) <= 0) cross = b
        }
        expect(lean(cross), `${name} stroke ${i} at the centre`).toBeGreaterThan(3)
        expect(fore.hi - fore.lo, `${name} stroke ${i} second axis`).toBeGreaterThan(0.8)
      }
    }
  })
})

describe('the hand: the arc', () => {
  it('swoops through the strokes as deep as the air under the rim allows, about 4 mm under the lift in every held shake', () => {
    for (const name of HELD) {
      const m = shakeMotion(name)
      expect(m.plan.dipMm, name).toBeGreaterThan(3.8)
      expect(m.plan.dipMm, name).toBeLessThan(s.liftMm * 0.7)
    }
  })
})

describe('the hand: the heavy start', () => {
  it('takes the first two strokes slower than the last three, in time and in speed, in every held shake', () => {
    for (const name of HELD) {
      const t = shakeMotion(name).plan.strokes
      const gap = (k: number): number => t[k]!.beat - t[k - 1]!.beat
      const speed = (k: number): number => Math.abs(t[k]!.mm - t[k - 1]!.mm) / gap(k)
      expect(Math.min(gap(1), gap(2)), `${name} time`).toBeGreaterThan(Math.max(gap(3), gap(4), gap(5)))
      expect((speed(1) + speed(2)) / 2, `${name} speed`).toBeLessThan(0.75 * ((speed(3) + speed(4) + speed(5)) / 3))
    }
  })
})
